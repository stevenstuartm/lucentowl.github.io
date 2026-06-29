---
title: "C# Caching Patterns"
layout: guide
category: ".NET & C#"
subcategory: "Libraries & Frameworks"
description: "In-memory caching, distributed caching, cache strategies, and best practices for performance optimization."
tags: [c-sharp, dotnet, caching, performance, distributed-systems, scalability, practical]
---

## Why Caching

Caching stores computed or fetched data for quick retrieval, reducing latency and load on downstream systems.

```csharp
// Without caching - hits database every time
public async Task<Product> GetProductAsync(int id)
{
    return await _database.Products.FindAsync(id);  // ~50ms per call
}

// With caching - returns cached data when available
public async Task<Product> GetProductAsync(int id)
{
    var cacheKey = $"product:{id}";

    if (_cache.TryGetValue(cacheKey, out Product cached))
        return cached;  // ~1ms

    var product = await _database.Products.FindAsync(id);
    _cache.Set(cacheKey, product, TimeSpan.FromMinutes(5));
    return product;
}
```

## Choosing Between Cache Types

<div class="callout callout--tip">
<p class="callout__title">Cache Type Decision Guide</p>
<p>Choose your cache type based on deployment topology and consistency requirements. The wrong choice can cause subtle bugs in production.</p>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>IMemoryCache (In-Process)</h4>
<ul>
<li>Fast: no serialization, no network</li>
<li>Each instance has its own cache</li>
<li>Use for: single instance, or latency-critical read-heavy data</li>
<li>Trade-off: no cache consistency across instances</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>IDistributedCache</h4>
<ul>
<li>Shared across instances via external store (Redis, SQL)</li>
<li>Survives application restarts</li>
<li>Use for: multi-instance deployments needing consistency</li>
<li>Trade-off: serialization overhead, network latency</li>
</ul>
</div>
</div>

**Hybrid approach**: Use both. IMemoryCache as an L1 cache for hot data with very short TTL, backed by IDistributedCache as L2 for shared, longer-lived data. .NET 9's HybridCache formalizes this pattern.

## IMemoryCache (In-Process)

Built-in memory cache for single-instance applications.

### Basic Usage

```csharp
using Microsoft.Extensions.Caching.Memory;

// Registration
services.AddMemoryCache();

// Injection
public class ProductService
{
    private readonly IMemoryCache _cache;
    private readonly IProductRepository _repository;

    public ProductService(IMemoryCache cache, IProductRepository repository)
    {
        _cache = cache;
        _repository = repository;
    }

    public async Task<Product?> GetProductAsync(int id)
    {
        var cacheKey = $"product:{id}";

        // Try to get from cache
        if (_cache.TryGetValue(cacheKey, out Product? product))
        {
            return product;
        }

        // Load from source
        product = await _repository.GetByIdAsync(id);

        if (product != null)
        {
            // Cache with options
            var options = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10))
                .SetSlidingExpiration(TimeSpan.FromMinutes(2))
                .SetPriority(CacheItemPriority.Normal);

            _cache.Set(cacheKey, product, options);
        }

        return product;
    }
}
```

### GetOrCreate Pattern

```csharp
// Synchronous
var product = _cache.GetOrCreate($"product:{id}", entry =>
{
    entry.SetAbsoluteExpiration(TimeSpan.FromMinutes(10));
    return _repository.GetById(id);
});

// Async
var product = await _cache.GetOrCreateAsync($"product:{id}", async entry =>
{
    entry.SetAbsoluteExpiration(TimeSpan.FromMinutes(10));
    return await _repository.GetByIdAsync(id);
});
```

### Cache Entry Options

```csharp
var options = new MemoryCacheEntryOptions
{
    // Time-based expiration
    AbsoluteExpiration = DateTimeOffset.Now.AddHours(1),
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
    SlidingExpiration = TimeSpan.FromMinutes(5),  // Resets on access

    // Eviction priority under memory pressure
    Priority = CacheItemPriority.High,

    // Size for bounded cache
    Size = 1  // Relative size
};

// Callback on eviction
options.RegisterPostEvictionCallback((key, value, reason, state) =>
{
    Console.WriteLine($"Cache entry {key} evicted: {reason}");
});

_cache.Set("key", value, options);
```

### Bounded Cache

Limit memory usage by setting cache size.

```csharp
// Configuration
services.AddMemoryCache(options =>
{
    options.SizeLimit = 1000;  // Maximum entries (by size sum)
});

// Each entry must specify size
_cache.Set("key", value, new MemoryCacheEntryOptions
{
    Size = 1  // Counts as 1 toward limit
});
```

### Cache Invalidation

```csharp
// Remove specific entry
_cache.Remove($"product:{id}");

// Invalidate with tokens
var cts = new CancellationTokenSource();
var options = new MemoryCacheEntryOptions()
    .AddExpirationToken(new CancellationChangeToken(cts.Token));

_cache.Set("key", value, options);

// Later: invalidate all entries with this token
cts.Cancel();

// Linked invalidation
var parentCts = new CancellationTokenSource();
_cache.Set("products:all", allProducts, new MemoryCacheEntryOptions()
    .AddExpirationToken(new CancellationChangeToken(parentCts.Token)));

// Child entries depend on parent
_cache.Set($"product:{id}", product, new MemoryCacheEntryOptions()
    .AddExpirationToken(new CancellationChangeToken(parentCts.Token)));

// Invalidate all product caches
parentCts.Cancel();
```

## IDistributedCache

Shared cache across multiple application instances.

### Interface

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

### Implementations

```csharp
// In-memory (for development/testing)
services.AddDistributedMemoryCache();

// SQL Server
services.AddDistributedSqlServerCache(options =>
{
    options.ConnectionString = connectionString;
    options.SchemaName = "dbo";
    options.TableName = "Cache";
});

// Redis
services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
    options.InstanceName = "myapp:";
});

// NCache
services.AddNCacheDistributedCache(options =>
{
    options.CacheName = "myCache";
    options.EnableLogs = true;
});
```

### Usage

```csharp
public class ProductService
{
    private readonly IDistributedCache _cache;
    private readonly IProductRepository _repository;
    private static readonly JsonSerializerOptions JsonOptions = new();

    public ProductService(IDistributedCache cache, IProductRepository repository)
    {
        _cache = cache;
        _repository = repository;
    }

    public async Task<Product?> GetProductAsync(int id, CancellationToken ct = default)
    {
        var cacheKey = $"product:{id}";

        // Try cache
        var cached = await _cache.GetStringAsync(cacheKey, ct);
        if (cached != null)
        {
            return JsonSerializer.Deserialize<Product>(cached, JsonOptions);
        }

        // Load from source
        var product = await _repository.GetByIdAsync(id, ct);
        if (product != null)
        {
            var json = JsonSerializer.Serialize(product, JsonOptions);
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                SlidingExpiration = TimeSpan.FromMinutes(2)
            };
            await _cache.SetStringAsync(cacheKey, json, options, ct);
        }

        return product;
    }

    public async Task InvalidateProductAsync(int id, CancellationToken ct = default)
    {
        await _cache.RemoveAsync($"product:{id}", ct);
    }
}
```

### Extension Methods

```csharp
// Built-in extensions for string values
await _cache.SetStringAsync("key", "value");
var value = await _cache.GetStringAsync("key");

// Custom extensions for objects
public static class DistributedCacheExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static async Task SetAsync<T>(
        this IDistributedCache cache,
        string key,
        T value,
        DistributedCacheEntryOptions options,
        CancellationToken ct = default)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        await cache.SetAsync(key, json, options, ct);
    }

    public static async Task<T?> GetAsync<T>(
        this IDistributedCache cache,
        string key,
        CancellationToken ct = default)
    {
        var bytes = await cache.GetAsync(key, ct);
        if (bytes == null) return default;
        return JsonSerializer.Deserialize<T>(bytes, JsonOptions);
    }

    public static async Task<T> GetOrSetAsync<T>(
        this IDistributedCache cache,
        string key,
        Func<Task<T>> factory,
        DistributedCacheEntryOptions options,
        CancellationToken ct = default)
    {
        var cached = await cache.GetAsync<T>(key, ct);
        if (cached != null) return cached;

        var value = await factory();
        await cache.SetAsync(key, value, options, ct);
        return value;
    }
}
```

## Redis with StackExchange.Redis

Direct Redis access for advanced scenarios.

```csharp
using StackExchange.Redis;

// Connection
var redis = ConnectionMultiplexer.Connect("localhost:6379");
var db = redis.GetDatabase();

// Basic operations
await db.StringSetAsync("key", "value", TimeSpan.FromMinutes(10));
var value = await db.StringGetAsync("key");

// Objects (with serialization)
var json = JsonSerializer.Serialize(user);
await db.StringSetAsync($"user:{user.Id}", json);

// Hash operations
await db.HashSetAsync($"user:{id}", new HashEntry[]
{
    new("name", user.Name),
    new("email", user.Email),
    new("age", user.Age)
});

var name = await db.HashGetAsync($"user:{id}", "name");
var allFields = await db.HashGetAllAsync($"user:{id}");

// Sets (unique collections)
await db.SetAddAsync("active-users", userId);
await db.SetRemoveAsync("active-users", userId);
var isActive = await db.SetContainsAsync("active-users", userId);

// Sorted sets (ranked data)
await db.SortedSetAddAsync("leaderboard", playerId, score);
var topPlayers = await db.SortedSetRangeByRankAsync("leaderboard", 0, 9, Order.Descending);

// Lists (queues)
await db.ListRightPushAsync("queue:tasks", taskJson);
var task = await db.ListLeftPopAsync("queue:tasks");

// Pub/Sub
var sub = redis.GetSubscriber();
await sub.SubscribeAsync("notifications", (channel, message) =>
{
    Console.WriteLine($"Received: {message}");
});
await sub.PublishAsync("notifications", "Hello!");
```

## Caching Patterns

### Cache-Aside (Lazy Loading)

Application manages cache reads and writes.

```csharp
public async Task<Product?> GetProductAsync(int id)
{
    // 1. Check cache
    var cached = await _cache.GetAsync<Product>($"product:{id}");
    if (cached != null) return cached;

    // 2. Load from database
    var product = await _repository.GetByIdAsync(id);

    // 3. Populate cache
    if (product != null)
    {
        await _cache.SetAsync($"product:{id}", product, DefaultOptions);
    }

    return product;
}

public async Task UpdateProductAsync(Product product)
{
    // 1. Update database
    await _repository.UpdateAsync(product);

    // 2. Invalidate cache
    await _cache.RemoveAsync($"product:{product.Id}");
}
```

### Write-Through

Update cache synchronously with database.

```csharp
public async Task UpdateProductAsync(Product product)
{
    // Update both atomically
    await _repository.UpdateAsync(product);
    await _cache.SetAsync($"product:{product.Id}", product, DefaultOptions);
}
```

### Write-Behind (Write-Back)

Buffer writes in cache, persist asynchronously.

```csharp
public class WriteBackCache<T>
{
    private readonly IDistributedCache _cache;
    private readonly Channel<(string Key, T Value)> _writeQueue;

    public WriteBackCache(IDistributedCache cache)
    {
        _cache = cache;
        _writeQueue = Channel.CreateUnbounded<(string, T)>();
        _ = ProcessWritesAsync();
    }

    public async Task SetAsync(string key, T value)
    {
        // Write to cache immediately
        await _cache.SetAsync(key, value, DefaultOptions);

        // Queue for database write
        await _writeQueue.Writer.WriteAsync((key, value));
    }

    private async Task ProcessWritesAsync()
    {
        await foreach (var (key, value) in _writeQueue.Reader.ReadAllAsync())
        {
            try
            {
                await PersistToDatabaseAsync(key, value);
            }
            catch (Exception ex)
            {
                // Log and potentially retry
            }
        }
    }
}
```

### Stampede Prevention

Prevent multiple cache misses from overloading the database.

```csharp
public class StampedeProtectedCache
{
    private readonly IDistributedCache _cache;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public async Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<Task<T>> factory,
        DistributedCacheEntryOptions options)
    {
        // Check cache first
        var cached = await _cache.GetAsync<T>(key);
        if (cached != null) return cached;

        // Get or create lock for this key
        var semaphore = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));

        await semaphore.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            cached = await _cache.GetAsync<T>(key);
            if (cached != null) return cached;

            // Only one caller loads data
            var value = await factory();
            await _cache.SetAsync(key, value, options);
            return value;
        }
        finally
        {
            semaphore.Release();
        }
    }
}
```

### Probabilistic Early Expiration

Refresh cache before expiration to prevent misses.

```csharp
public async Task<T?> GetWithEarlyRefreshAsync<T>(
    string key,
    Func<Task<T>> factory,
    TimeSpan expiration)
{
    var entry = await _cache.GetAsync<CacheEntry<T>>(key);

    if (entry != null)
    {
        // Calculate if we should refresh early
        var remainingTime = entry.ExpiresAt - DateTimeOffset.UtcNow;
        var refreshThreshold = expiration * 0.1;  // 10% of TTL

        if (remainingTime > refreshThreshold)
        {
            return entry.Value;  // Still fresh
        }

        // Refresh in background
        _ = Task.Run(async () =>
        {
            var value = await factory();
            await SetCacheEntryAsync(key, value, expiration);
        });

        return entry.Value;  // Return stale while refreshing
    }

    // Cache miss - load synchronously
    var newValue = await factory();
    await SetCacheEntryAsync(key, newValue, expiration);
    return newValue;
}

private record CacheEntry<T>(T Value, DateTimeOffset ExpiresAt);
```

## Response Caching

Cache HTTP responses in ASP.NET Core.

```csharp
// Register middleware
services.AddResponseCaching();
app.UseResponseCaching();

// Cache for 60 seconds
[ResponseCache(Duration = 60)]
public IActionResult GetProducts()
{
    return Ok(_service.GetProducts());
}

// Vary by query parameter
[ResponseCache(Duration = 60, VaryByQueryKeys = new[] { "category" })]
public IActionResult GetProducts(string category)
{
    return Ok(_service.GetProducts(category));
}

// No cache
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public IActionResult GetUserData()
{
    return Ok(_service.GetUserData());
}

// Cache profiles
services.AddControllersWithViews(options =>
{
    options.CacheProfiles.Add("Default", new CacheProfile
    {
        Duration = 60,
        Location = ResponseCacheLocation.Any
    });
    options.CacheProfiles.Add("Private", new CacheProfile
    {
        Duration = 300,
        Location = ResponseCacheLocation.Client
    });
});

[ResponseCache(CacheProfileName = "Default")]
public IActionResult Index() { }
```

## Output Caching (.NET 7+)

Server-side caching of HTTP responses.

```csharp
// Register
services.AddOutputCache();
app.UseOutputCache();

// Basic caching
app.MapGet("/products", [OutputCache] () => GetProducts());

// With policy
app.MapGet("/products", () => GetProducts())
   .CacheOutput(policy => policy
       .Expire(TimeSpan.FromMinutes(10))
       .SetVaryByQuery("category")
       .Tag("products"));

// Named policies
services.AddOutputCache(options =>
{
    options.AddPolicy("ProductCache", builder =>
        builder.Expire(TimeSpan.FromMinutes(10))
               .SetVaryByQuery("category", "page"));

    options.AddPolicy("UserCache", builder =>
        builder.Expire(TimeSpan.FromMinutes(1))
               .SetVaryByHeader("Authorization"));
});

app.MapGet("/products", [OutputCache(PolicyName = "ProductCache")] () => GetProducts());

// Tag-based invalidation
app.MapPost("/products", async (IOutputCacheStore store) =>
{
    await CreateProduct();
    await store.EvictByTagAsync("products", default);
});
```

## HybridCache (.NET 9)

Combines local and distributed caching with stampede protection.

```csharp
// Registration
services.AddHybridCache();

// Usage
public class ProductService
{
    private readonly HybridCache _cache;

    public async Task<Product?> GetProductAsync(int id)
    {
        return await _cache.GetOrCreateAsync(
            $"product:{id}",
            async ct => await _repository.GetByIdAsync(id, ct),
            new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromMinutes(10),
                LocalCacheExpiration = TimeSpan.FromMinutes(1)
            });
    }
}
```

## Best Practices

### Cache Key Design

```csharp
// Include all relevant parameters
var key = $"user:{userId}:orders:{status}:page:{page}";

// Use consistent naming convention
var key = $"{prefix}:{entityType}:{id}:{variant}";

// Consider key length for distributed cache
// Redis: keep keys under 1KB, ideally < 100 bytes
```

### What to Cache

```csharp
// Good candidates:
// - Expensive database queries
// - External API responses
// - Computed/aggregated data
// - Configuration data

// Avoid caching:
// - User-specific sensitive data
// - Rapidly changing data
// - Data requiring strong consistency
// - Very large objects (serialize cost > db cost)
```

### Monitoring

```csharp
public class InstrumentedCache : IDistributedCache
{
    private readonly IDistributedCache _inner;
    private readonly ILogger _logger;
    private static readonly Counter<long> HitCount = /* metrics */;
    private static readonly Counter<long> MissCount = /* metrics */;

    public async Task<byte[]?> GetAsync(string key, CancellationToken token)
    {
        var result = await _inner.GetAsync(key, token);

        if (result != null)
        {
            HitCount.Add(1);
            _logger.LogDebug("Cache hit: {Key}", key);
        }
        else
        {
            MissCount.Add(1);
            _logger.LogDebug("Cache miss: {Key}", key);
        }

        return result;
    }
}
```

## Key Takeaways

**IMemoryCache for single-instance**: Fast, no serialization, but doesn't scale horizontally.

**IDistributedCache for multi-instance**: Shared cache via Redis, SQL Server, etc.

**Cache-aside is most common**: Application manages cache reads and invalidation.

**Prevent stampede**: Use locks or semaphores to prevent thundering herd on cache miss.

**Set appropriate TTL**: Balance freshness against cache hit rate.

**Invalidate on writes**: Update or remove cache entries when source data changes.

**Monitor cache effectiveness**: Track hit rate, latency, and memory usage.
