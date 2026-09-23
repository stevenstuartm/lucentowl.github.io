---
title: "C# Caching Patterns"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Caching in .NET with IMemoryCache, IDistributedCache, and HybridCache: expiration and eviction, bounding memory, why GetOrCreate doesn't stop stampedes, shared-reference and serialized-copy semantics, Redis as a distributed store, tag invalidation, invalidating on write, and key design."
tags: [caching, imemorycache, idistributedcache, hybridcache, redis, cache-invalidation, practical]
---

## What a Cache Trades

A cache keeps a copy of data that is expensive to get, so later requests can skip the database query, the HTTP call, or the computation. The pattern almost every .NET cache follows is **cache-aside**: look in the cache, and on a miss load from the source and store the result:

```csharp
public async Task<Product?> GetProductAsync(int id, CancellationToken cancellationToken)
{
    string key = $"product:{id}";

    if (_cache.TryGetValue(key, out Product? cached))
        return cached;

    Product? product = await _db.Products.FindAsync([id], cancellationToken);
    _cache.Set(key, product, TimeSpan.FromMinutes(5));
    return product;
}
```

The copy can be wrong. From the moment it's stored, the source can change and the cache won't know. Every caching decision in this guide is a choice about how long a stale copy is acceptable, who can see it, and what happens when many callers miss at once.

## Choosing a Cache Abstraction

.NET has three caching abstractions, and they differ in where the data lives:

| | `IMemoryCache` | `IDistributedCache` | `HybridCache` |
|---|---|---|---|
| Where entries live | This process's memory | An external store such as Redis or SQL Server | This process's memory, backed by an `IDistributedCache` if one is registered |
| What you store | The object itself, by reference | `byte[]`, serialized by you | Objects, serialized for you when stored in the distributed layer |
| Shared across instances | No | Yes | The distributed layer is, the local layer isn't |
| Survives a restart | No | Yes | The distributed layer does |
| Concurrent misses for one key | Each caller runs the factory | Each caller loads from the source | One caller per instance runs the factory, the rest wait |

In a deployment of several instances behind a load balancer, the layers look like this:

{% include figure.html id="dn-l1-l2-cache" %}

`IMemoryCache` alone is the L1 layer, which works well for one instance or for data where each instance holding its own copy is fine. `IDistributedCache` alone is the L2 layer. Every instance sees the same entry and an invalidation reaches all of them, at the cost of a network call and serialization on every read. `HybridCache` combines them, and is the default choice for new code that needs both.

## IMemoryCache

`services.AddMemoryCache()` registers a singleton `MemoryCache` from `Microsoft.Extensions.Caching.Memory`. Entries are keyed by `object` and stored as-is, with no serialization.

### Expiration

```csharp
var options = new MemoryCacheEntryOptions
{
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
    SlidingExpiration = TimeSpan.FromMinutes(2)
};

_cache.Set(key, product, options);
```

**Absolute expiration** ends the entry at a fixed point, no matter how often it's read. **Sliding expiration** ends it after a period with no reads, and every read restarts that period. Sliding expiration on its own can keep a frequently read entry alive indefinitely, serving data that went stale hours ago, so pair it with an absolute limit. With both set, the entry expires at whichever comes first.

Expired entries are removed lazily. A read of an expired entry treats it as a miss and removes it, and a background scan removes the rest, no more often than `ExpirationScanFrequency` (one minute by default). An expired entry can therefore stay in memory, and its post-eviction callback can wait to run, until something touches the cache.

### The Cache Holds References

`IMemoryCache` stores the object you give it, and every reader gets that same object back:

```csharp
var tags = new List<string> { "sale" };
_cache.Set("featured-tags", tags);

tags.Add("clearance");   // The cached list now has two items
```

A caller that modifies a cached object modifies it for every other caller, from any thread, with no synchronization. Cache immutable types such as records with `init` properties, `IReadOnlyList<T>`, or frozen collections, or treat anything read from the cache as read-only by convention. This is the opposite of a distributed cache, where every read deserializes a fresh copy.

### Bounding Memory

A `MemoryCache` with no size limit grows until entries expire. It doesn't react to memory pressure, and the `CompactOnMemoryPressure` option that suggested otherwise is obsolete. A cache keyed by something unbounded, like a user ID or a search string, grows with the number of distinct keys. To bound it, set `SizeLimit`:

```csharp
services.AddMemoryCache(options => options.SizeLimit = 10_000);

_cache.Set(key, product, new MemoryCacheEntryOptions
{
    Size = 1,
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
});
```

`SizeLimit` has no unit. The cache adds up each entry's `Size` and compares the sum to the limit, so the units are whatever the application decides: one per entry, an estimate in kilobytes, or anything consistent. Once a limit is set, every entry has to declare a `Size`, and `Set` throws `InvalidOperationException` for one that doesn't. That includes entries added by other code sharing the same registered cache, which is why a library that needs a bounded cache should create its own `MemoryCache` instance rather than set a limit on the shared one.

When a new entry would push the total past the limit, the cache doesn't store it. `Set` returns normally, the entry is silently dropped, and the cache starts a background compaction. Compaction removes expired entries first, then evicts others, lowest `Priority` first and least recently used within a priority, aiming to free `CompactionPercentage` of the limit (5% by default). Until compaction frees room, a cache at its limit misses on every new key while the old entries stay resident.

### GetOrCreate Doesn't Prevent Stampedes

`GetOrCreate` and `GetOrCreateAsync` are shorthand for the cache-aside code above:

```csharp
Product? product = await _cache.GetOrCreateAsync(key, async entry =>
{
    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
    return await _repository.GetByIdAsync(id, cancellationToken);
});
```

They don't lock. When an entry expires under load, every request that arrives before the first load finishes also misses and runs the factory. Twenty concurrent callers for one missing key run the factory twenty times. This is a **cache stampede**, and it hits the source exactly when the cache was supposed to shield it. See [Preventing Stampedes](#preventing-stampedes).

### Invalidating Groups of Entries

`Remove(key)` drops one entry. To drop a group at once, attach a change token to each entry in the group and fire it:

```csharp
private CancellationTokenSource _productsVersion = new();

_cache.Set(key, product, new MemoryCacheEntryOptions()
    .SetAbsoluteExpiration(TimeSpan.FromMinutes(10))
    .AddExpirationToken(new CancellationChangeToken(_productsVersion.Token)));

// Later: expire every entry registered with this token, then start a new group
var old = Interlocked.Exchange(ref _productsVersion, new CancellationTokenSource());
old.Cancel();
old.Dispose();
```

Canceling the token expires every entry that carries it. `IMemoryCache` has no other notion of a group or tag.

### Measuring Hit Rate

A cache with a low hit rate costs memory and adds a lookup to every request while saving little. `MemoryCache` can count for you:

```csharp
services.AddMemoryCache(options => options.TrackStatistics = true);

MemoryCacheStatistics? stats = _cache.GetCurrentStatistics();
// stats.TotalHits, stats.TotalMisses, stats.CurrentEntryCount, stats.CurrentEstimatedSize
```

Tracking is off by default. Export the hit and miss counts to whatever metrics system the application already uses, and watch the ratio over time rather than at one moment.

## IDistributedCache

`IDistributedCache` stores `byte[]` values in a store outside the process:

```csharp
public interface IDistributedCache
{
    byte[]? Get(string key);
    Task<byte[]?> GetAsync(string key, CancellationToken token = default);
    void Set(string key, byte[] value, DistributedCacheEntryOptions options);
    Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default);
    void Refresh(string key);
    Task RefreshAsync(string key, CancellationToken token = default);
    void Remove(string key);
    Task RemoveAsync(string key, CancellationToken token = default);
}
```

`Refresh` resets an entry's sliding expiration without reading its value. Implementations come from separate packages:

```csharp
// Redis (Microsoft.Extensions.Caching.StackExchangeRedis)
services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "orders:";   // Prefix added to every key
});

// SQL Server (Microsoft.Extensions.Caching.SqlServer)
services.AddDistributedSqlServerCache(options =>
{
    options.ConnectionString = builder.Configuration.GetConnectionString("Cache");
    options.SchemaName = "dbo";
    options.TableName = "Cache";
});

// In-process, for development and tests only: not shared between instances
services.AddDistributedMemoryCache();
```

`InstanceName` keeps several applications that share one Redis server from overwriting each other's keys.

### Serialization Is Yours

The interface only handles bytes, so code that caches objects serializes them itself:

```csharp
public async Task<Product?> GetProductAsync(int id, CancellationToken cancellationToken)
{
    string key = $"product:{id}";

    byte[]? cached = await _cache.GetAsync(key, cancellationToken);
    if (cached is not null)
        return JsonSerializer.Deserialize<Product>(cached);

    Product? product = await _repository.GetByIdAsync(id, cancellationToken);
    if (product is not null)
    {
        await _cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(product),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            },
            cancellationToken);
    }

    return product;
}
```

Every read pays for a network round trip and deserialization, and returns a fresh object, so the shared-mutation problem of `IMemoryCache` doesn't arise. The serialized form is also a contract. After a deployment renames a property, entries written by the old version still deserialize, silently leaving the new property at its default. Include a version in the key, like `product:v2:{id}`, when a cached type's shape changes.

### When the Cache Store Is Down

A distributed cache is a network dependency. When Redis is unreachable, `GetAsync` throws rather than returning `null`, and code written as above turns a cache outage into an application outage. A cache is meant to be optional, so catch the failure, log it, and fall through to the source. That fallback is only safe if the source can absorb the full load the cache normally absorbs.

## HybridCache

`HybridCache`, in the `Microsoft.Extensions.Caching.Hybrid` package, puts an in-process L1 cache in front of whatever `IDistributedCache` is registered as L2, and it serializes values for the L2 layer itself. It supports target frameworks back to .NET Framework 4.7.2 and .NET Standard 2.0, so it isn't tied to a runtime version.

```csharp
services.AddStackExchangeRedisCache(options =>
    options.Configuration = builder.Configuration.GetConnectionString("Redis"));

services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(10),          // L2, and L1 unless overridden
        LocalCacheExpiration = TimeSpan.FromMinutes(1)  // L1
    };
});

public class ProductService(HybridCache cache, IProductRepository repository)
{
    public async Task<Product?> GetProductAsync(int id, CancellationToken cancellationToken) =>
        await cache.GetOrCreateAsync(
            $"product:{id}",
            async ct => await repository.GetByIdAsync(id, ct),
            tags: ["products"],
            cancellationToken: cancellationToken);
}
```

A read checks L1, then L2, then runs the factory and stores the result in both. Without a registered `IDistributedCache`, it works as an in-process cache.

### One Factory Call per Key per Instance

`HybridCache` coordinates concurrent callers. When twenty requests miss on the same key at once, one of them runs the factory and the other nineteen wait for its result. The factory's cancellation token is canceled only when every waiting caller has canceled. The coordination stops at the process boundary. Ten instances that miss at the same moment still produce up to ten loads, one per instance, which is usually an acceptable ceiling.

### Invalidation and Other Instances' L1

`RemoveAsync(key)` removes an entry from this instance's L1 and from L2. `RemoveByTagAsync(tag)` invalidates every entry created with that tag, and `"*"` invalidates everything. Tag invalidation is logical. The entries stay in storage until they expire, and `HybridCache` treats any entry created before the invalidation as a miss.

Neither call reaches the L1 caches of other instances. After instance A removes `product:42`, instances B and C keep serving their local copies until `LocalCacheExpiration` passes. That setting is the bound on cross-instance staleness, so keep it short for data that changes, and longer only for data that rarely does.

### Copies Unless the Type Is Immutable

To avoid the shared-mutation problem, `HybridCache` deserializes a new instance for each caller by default, as `IDistributedCache` code would. A type that is `sealed` and marked `[ImmutableObject(true)]` from `System.ComponentModel` tells it instances are safe to share, and it then returns the same instance from L1 without deserializing again:

```csharp
[ImmutableObject(true)]
public sealed record ProductSummary(int Id, string Name, decimal Price);
```

### Limits and Serialization

Values are serialized with `System.Text.Json`, except `string` and `byte[]`, which are stored directly. `AddSerializer` on the `AddHybridCache` builder plugs in another format. A value larger than `MaximumPayloadBytes` (1 MB by default) or a key longer than `MaximumKeyLength` (1,024 characters by default) isn't cached. The attempt is logged and the factory's result is returned uncached, so an oversized value quietly turns into a miss on every call.

## Using Redis Directly

`IDistributedCache` exposes only get, set, refresh, and remove. For anything else Redis offers, like atomic counters, sets, sorted sets, key expiry inspection, or pub/sub, use the `StackExchange.Redis` client directly. Its `ConnectionMultiplexer` is designed to be created once and shared by the whole application:

```csharp
services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!));

public class RateCounter(IConnectionMultiplexer redis)
{
    public async Task<long> IncrementAsync(string clientId)
    {
        IDatabase db = redis.GetDatabase();
        string key = $"requests:{clientId}:{DateTime.UtcNow:yyyyMMddHHmm}";

        long count = await db.StringIncrementAsync(key);
        if (count == 1)
            await db.KeyExpireAsync(key, TimeSpan.FromMinutes(2));

        return count;
    }
}
```

Creating a multiplexer per operation opens a new connection each time, which is the Redis equivalent of creating an `HttpClient` per request. `GetDatabase()` is cheap and can be called wherever it's needed.

## Preventing Stampedes

The fix for a stampede is to make concurrent misses for one key share one load. `HybridCache` does this, and it's the first thing to reach for. Code that has to stay on `IMemoryCache` or `IDistributedCache` can hold a per-key lock around the load and check the cache again once inside:

```csharp
private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

public async Task<T?> GetOrLoadAsync<T>(string key, Func<Task<T?>> load)
{
    if (_cache.TryGetValue(key, out T? value))
        return value;

    SemaphoreSlim gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
    await gate.WaitAsync();
    try
    {
        if (_cache.TryGetValue(key, out value))   // Another caller may have loaded it
            return value;

        value = await load();
        _cache.Set(key, value, TimeSpan.FromMinutes(10));
        return value;
    }
    finally
    {
        gate.Release();
    }
}
```

This protects one process only, like `HybridCache`. It also keeps one semaphore per key forever, so over an unbounded key space the lock dictionary becomes its own memory leak. Removing semaphores safely while other callers may be waiting on them is subtle, which is a good reason to use `HybridCache` instead of maintaining this.

A stampede can also come from many keys expiring together, such as everything loaded at startup with the same ten-minute expiration. Adding a small random amount to each entry's expiration spreads the reloads out.

## Keeping the Cache Consistent with the Source

### Invalidate on Write

With cache-aside, the code that changes the data removes the cached copy after the write succeeds:

```csharp
public async Task UpdateProductAsync(Product product, CancellationToken cancellationToken)
{
    await _repository.UpdateAsync(product, cancellationToken);
    await _cache.RemoveAsync($"product:{product.Id}", cancellationToken);
}
```

Removing is safer than writing the new value into the cache, because two concurrent updates can write their cache values in the opposite order from their database writes and leave the older value cached. Removal still has a narrow race. A reader that loaded the old row just before the update can store it just after the removal. The expiration time is the backstop that bounds how long such a stale entry survives, which is why even explicitly invalidated entries should expire.

Writes that bypass this code, like another service updating the same table, a migration, or a manual fix, leave the cache stale until expiration. Where that happens, the expiration time is the only consistency guarantee the cache has. Write-through, write-behind, and event-driven invalidation are architecture patterns with their own trade-offs, and the choice between them isn't specific to .NET.

### Cache Misses Too

The cache-aside code in [Serialization Is Yours](#serialization-is-yours) caches only non-null results. A request for a product that doesn't exist misses every time and queries the database every time. A client, or an attacker, requesting random IDs bypasses the cache entirely. Caching the absence for a short time, with a sentinel value or a nullable wrapper, closes that gap. `HybridCache` caches a `null` factory result like any other value.

### Key Design

A key has to identify everything the cached value depends on. A key built from a user ID and a page number, where the query also filters by status, serves one status's results to requests for another. Separate the parts with a delimiter, so that `order:{customerId}:{orderId}` can't produce the same key for customer 42 with order 123 and customer 421 with order 23.

Build keys from trusted identifiers, not raw user input. A key taken directly from a query string lets a client create unlimited distinct entries and fill the cache, and it can collide with keys the application relies on.

## Key Takeaways

**Every cached value is a stale copy with a lifetime.** Choose that lifetime on purpose, and keep an absolute expiration on entries you also invalidate explicitly.

**Know what a read returns.** `IMemoryCache` returns the shared instance, so cache immutable types. A distributed cache returns a fresh deserialized copy.

**Bound `IMemoryCache` when keys are unbounded.** It doesn't evict under memory pressure, and a full cache silently drops new entries.

**`GetOrCreateAsync` on `IMemoryCache` doesn't stop stampedes.** `HybridCache` does, per instance.

**With `HybridCache`, `LocalCacheExpiration` bounds cross-instance staleness,** because invalidation never reaches another instance's local copy.

**Treat the distributed store as optional.** Decide what happens when it's down before it is.
