---
layout: guide
title: "Performance and Scalability Patterns"
category: Architecture
subcategory: Patterns
description: "Patterns for handling more load: load balancing across instances, rate limiting with token bucket and window algorithms, cache-aside and read-through and write-through caching, and sharding with consistent hashing."
tags: [practical, load-balancing, rate-limiting, token-bucket, caching, sharding, consistent-hashing]
---

A system meets more load in one of three ways. It can add copies of the thing doing the work and spread requests across them, it can avoid doing the same work repeatedly, or it can split the data so no single store holds all of it. When none of those is enough, or while they catch up, it has to refuse some of the load deliberately so the rest still gets served.

Load balancing spreads requests, rate limiting decides what to refuse, caching avoids repeated work, and sharding splits the data. Sharding comes last because it is the most expensive of the four to undo.

## Load Balancing

A load balancer sits in front of several instances of a service and distributes requests among them, so capacity grows by adding instances and a failed instance stops receiving traffic instead of failing requests.

**Use when**:
- A service runs as several interchangeable instances
- Capacity has to grow by adding instances rather than by buying a larger machine
- An instance failing should reduce capacity, not cause errors

### Choosing an Algorithm

| Algorithm | How it picks | Suits | Watch for |
|-----------|--------------|-------|-----------|
| Round robin | Each instance in turn | Identical instances and similar requests | Uneven load when requests vary widely in cost |
| Weighted round robin | In turn, in proportion to assigned weights | Instances of different sizes | Weights going stale as instances change |
| Least connections | The instance with the fewest open connections | Long-lived connections or variable request duration | Newly added instances getting flooded |
| Least response time | The instance responding fastest recently | Instances whose performance drifts | Oscillation as traffic chases the fastest instance |
| Hash or sticky sessions | The same client always goes to the same instance | Servers holding per-client session state | Hot instances, and lost sessions when an instance dies |

Sticky sessions are usually a sign that session state should move out of the instance into a shared store, so that any instance can serve any request.

### Layer 4 and Layer 7

A layer 4 balancer routes TCP or UDP connections by address and port without reading their contents. That makes it cheap and protocol-agnostic, but it balances connections rather than requests. When a client holds one long-lived connection and sends many requests over it, as HTTP/2 and gRPC clients do, every one of those requests lands on the same instance.

A layer 7 balancer terminates the connection and reads the application protocol, so it can route by path, header, or cookie, and balance individual requests. It pays for that in per-request processing and in being a point where TLS has to terminate.

{% include figure.html id="pat-l4-l7-balancing" %}

**Common implementations**: NGINX, HAProxy, Envoy, and cloud balancers such as AWS Application Load Balancer at layer 7 and Network Load Balancer at layer 4.

**Trade-offs**: A load balancer only helps a service whose instances are interchangeable, which pushes state out into databases and caches that then become the bottleneck. The balancer itself is on every request's path and has to be redundant. And its health checks decide which instances are in rotation, so a health check that tests the wrong thing removes healthy instances or keeps broken ones.

---

## Rate Limiting and Throttling

A rate limiter caps how many requests a client, key, or tenant can make in a period, and rejects or delays the rest. Throttling is the same mechanism applied from the server's side to protect its own capacity. Both trade some rejected requests for keeping the service usable by everyone else.

**Use when**:
- One client could consume capacity every other client depends on
- A downstream dependency has a hard limit or a per-call cost
- Usage tiers need enforcing, such as a free plan and a paid plan with different limits
- Abusive or runaway clients need containing, alongside rather than instead of dedicated DDoS protection

### Algorithms

| Algorithm | How it works | Bursts | Memory per client |
|-----------|--------------|--------|-------------------|
| **Token bucket** | A bucket holds up to N tokens and refills at a steady rate, and each request spends one | Allowed, up to the bucket size | Two values |
| **Leaky bucket** | Requests join a queue drained at a fixed rate, and overflow is rejected | Smoothed out, at the cost of queueing delay | A queue |
| **Fixed window counter** | Count requests per calendar window, such as per minute | Up to double the limit across a window boundary | One counter |
| **Sliding window log** | Keep a timestamp for every request and count those within the last window | None beyond the limit | One entry per request |
| **Sliding window counter** | Weight the previous window's count by how much of it still overlaps, and add the current count | Approximately bounded | Two counters |

The fixed window's boundary problem is the one that surprises people. A limit of 100 per minute allows 100 requests at 12:00:59 and another 100 at 12:01:00, so 200 arrive within two seconds.

{% include figure.html id="pat-fixed-window-boundary" %}

Token bucket is the common default for APIs because it permits short bursts while holding the long-run average, and it is what [Amazon API Gateway throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html){:target="_blank" rel="noopener noreferrer"} uses. The sliding window counter gets close to a log's accuracy with a counter's memory, and Cloudflare [described using it](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/){:target="_blank" rel="noopener noreferrer"} to rate limit across its edge network.

**Example**: Each API key gets 1,000 requests an hour with bursts of up to 100. As a token bucket, that is a capacity of 100 tokens refilled at 10 tokens every 36 seconds. In ASP.NET Core, the built-in rate limiting middleware partitions that bucket per API key, which should already have been authenticated by this point.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("per-api-key", httpContext =>
        RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: httpContext.Request.Headers["X-API-Key"].ToString(),
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 100,                              // burst size
                TokensPerPeriod = 10,
                ReplenishmentPeriod = TimeSpan.FromSeconds(36), // 1,000 per hour
                QueueLimit = 0
            }));
});

app.UseRateLimiter();
app.MapGet("/orders", GetOrders).RequireRateLimiting("per-api-key");
```

A rejected client should get `429 Too Many Requests` with a `Retry-After` header saying when a token will next be available, which for this bucket is at most 36 seconds, not the hour the quota is expressed in.

**Trade-offs**: A limiter that runs on each instance separately enforces its limit per instance, so ten instances allow ten times the intended rate. Enforcing a global limit needs a shared counter, typically in Redis, which adds a network call to every request and a dependency to fail. Partitioning by a value the client controls, such as an unauthenticated API key header or a spoofable IP address, lets an attacker create unlimited partitions, each with a fresh bucket. And limits set too low turn legitimate traffic spikes into errors, so they need to come from measured usage rather than guesses.

---

## Caching

A cache keeps a copy of data somewhere faster to read than its source, trading freshness and memory for fewer trips to the database. The patterns differ in which component is responsible for loading the cache and keeping it current.

{% include figure.html id="pat-cache-patterns" %}

### Cache-Aside

The application checks the cache, and on a miss it reads the database and populates the cache itself. On an update, it writes the database and invalidates the cache entry. The cache knows nothing about the database.

```
GET /users/123
  1. value = cache.get("user:123")
  2. if miss: value = db.query(...); cache.set("user:123", value, ttl = 10 min)
  3. return value

PUT /users/123
  1. db.update(...)
  2. cache.delete("user:123")
```

**Use when**:
- Reads far outnumber writes, and the same keys are read repeatedly
- Only a fraction of the data is hot, so caching everything would waste memory
- The application needs control over what is cached and for how long

### Read-Through and Write-Through

Here the cache sits in front of the database and handles loading itself. With **read-through**, a miss makes the cache provider fetch the value from the source through a loader the application registers, so application code only ever calls the cache. With **write-through**, writes go to the cache, which writes the database synchronously before returning. **Write-behind** is the asynchronous variant, where the cache acknowledges the write and persists it later.

**Use when**:
- The caching logic is repeated across many call sites and belongs in one place
- The cache product supports loaders natively, as many distributed caches and caching libraries do
- With write-behind, write throughput matters more than guaranteeing every write reached the database before responding

### Invalidation and Stampedes

Both patterns share the hard parts. A TTL bounds how stale an entry can get but guarantees it will sometimes be stale. Deleting on update is fresher but has a race: a reader that fetched the old value just before the update can write it back into the cache just after the delete. Short TTLs are the usual backstop for that race.

A **cache stampede** happens when a popular entry expires and every concurrent request misses at once, sending them all to the database together. The mitigations are to let only one caller per key recompute while the rest wait for its result, to refresh popular entries before they expire, or to add random jitter to TTLs so entries written together don't all expire together.

**Trade-offs**: A cache is a second copy of the data, and every second copy can disagree with the first. It also changes the system's failure behavior. A database sized for the load that reaches it through a warm cache can't survive a cold one, so a cache restart or a mass expiry becomes a database outage. Write-behind adds the possibility of losing writes the client was told had succeeded.

---

## Sharding

Sharding splits one database's data across several databases, each holding a subset chosen by a shard key. Every query is routed to the shard that holds its key. It is how a data store grows past the limits of one machine, and it is the pattern here that is hardest to reverse.

{% include figure.html id="pat-sharding" %}

**Use when**:
- Write volume exceeds what one database server can sustain
- The data set no longer fits on one server
- Read replicas, caching, query tuning, and a larger server have all been tried or ruled out

Read replicas scale reads without any of the costs below, and a larger server is almost always cheaper than sharding to operate. Sharding earns its cost when writes or storage, not reads, are what outgrew the machine.

### Shard Key Strategies

| Strategy | How it works | Strength | Weakness |
|----------|--------------|----------|----------|
| Range-based | Contiguous key ranges, such as A-H, I-P, Q-Z | Range queries stay on one shard | Uneven distribution, and sequential keys pile onto the last shard |
| Hash-based | `hash(key) % shard_count` | Even distribution | Range queries hit every shard, and changing the shard count moves most keys |
| Directory-based | A lookup table maps each key or tenant to a shard | Any placement you like, including moving one hot key | Every query needs the lookup, and the directory must be highly available |

```
Range by creation date:
  Shard 1: older orders
  Shard 2: this year's orders
  Every new order lands on Shard 2, so it takes all the write load

Hash by user id:
  hash(user_id) = 7834 → 7834 % 3 = 1 → Shard 1
  hash(user_id) = 2942 → 2942 % 3 = 2 → Shard 2
  Writes spread evenly, but "orders placed last month" must ask all three
```

### Hot Spots

A hot spot is one shard taking a disproportionate share of traffic, usually because of a single very active key such as a celebrity account, a large tenant, or a viral item. An even hash can't prevent this, because it spreads keys evenly, not the traffic on each key.

Mitigations run from simple to invasive: cache the hot key's reads in front of the shard, move a known hot key to a dedicated shard through a directory, or split the key itself by appending a suffix (`user_123#0` through `user_123#9`) so its writes spread across shards, at the cost of every read of that key gathering from all of them.

### Resharding and Consistent Hashing

With `hash(key) % N`, changing N remaps most keys. Going from 3 shards to 4 leaves a key in place only when `hash % 3` equals `hash % 4`, which holds for a quarter of keys, so three quarters of the data has to move.

```
hash = 7834:  % 3 = 1,  % 4 = 2   → moves
hash = 2942:  % 3 = 2,  % 4 = 2   → stays
hash = 5310:  % 3 = 0,  % 4 = 2   → moves
```

Consistent hashing places both shards and keys on a ring of hash values, and each key belongs to the first shard found moving clockwise from it. Adding a shard claims only the arc of the ring just before it, taking keys from the one shard that previously owned that arc and leaving every other key where it was. Going from 3 shards to 4 moves roughly a quarter of the keys instead of three quarters.

{% include figure.html id="pat-consistent-hashing" %}

In practice each physical shard is placed at many points on the ring, called virtual nodes, which evens out how much of the ring each shard owns.

### Cross-Shard Queries

Any query that isn't keyed to one shard has to fan out to all of them in parallel and combine the answers in the application. Counts and sums combine cheaply. Sorting and paging don't: a request for the top 20 results has to fetch the top 20 from every shard and re-sort them, and a request for page 50 has to fetch the first 1,000 from each. Joins across shards generally have to be rebuilt in application code or avoided by design.

<div class="callout callout--warning">
<p class="callout__title">Choose the Shard Key Carefully</p>
<p>The shard key decides which queries stay cheap for the life of the system, and changing it later means moving all of the data. Choose it from the queries the system runs most, so that they stay on a single shard, and exhaust replicas, caching, and vertical scaling before sharding at all.</p>
</div>

**Trade-offs**: Transactions and joins that used to be local now span databases. Operations multiply, since backups, schema migrations, and failovers happen once per shard. Rebalancing is a live data migration. And every query that the shard key doesn't serve gets slower, not faster.

---

## Quick Reference

| Pattern | What it scales or protects | Reach for it when | Main cost |
|---------|---------------------------|-------------------|-----------|
| **Load balancing** | Request throughput, across stateless instances | One instance isn't enough, or shouldn't be a single point of failure | State pushed out to shared stores, and a balancer on every path |
| **Rate limiting** | Shared capacity, against any one client | One client could starve the rest, or a dependency has a hard limit | Rejected requests, and a shared counter for global limits |
| **Cache-aside** | Read throughput for hot keys | Reads dominate and a fraction of keys are hot | Staleness, invalidation races, and a database that can't survive a cold cache |
| **Read-through / write-through** | The same, with loading centralized in the cache | Caching logic is repeated across call sites | Dependence on cache product features, and lost writes with write-behind |
| **Sharding** | Write throughput and data volume beyond one server | Writes or storage have outgrown vertical scaling and replicas | Cross-shard queries, per-shard operations, and a shard key that is hard to change |
