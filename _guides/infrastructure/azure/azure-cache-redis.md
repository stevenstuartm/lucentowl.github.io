---
title: "Azure Cache for Redis"
layout: guide
category: Azure
subcategory: Database Services
description: "Architecture patterns, tier selection, clustering, and operational strategies for Azure Cache for Redis, including geo-replication, data persistence, and cache-aside patterns."
tags: [azure, caching, performance, scalability, databases, cloud-computing, fundamentals]
---

## What Is Azure Cache for Redis

[Azure Cache for Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview){:target="_blank" rel="noopener noreferrer"} is a managed implementation of the open-source Redis in-memory data store, hosted on Azure's infrastructure. Redis holds data structures like strings, hashes, lists, sets, and sorted sets in memory, providing sub-millisecond read/write latency. The service handles replication, failover, patching, and scaling so you focus on application logic rather than operational complexity.

Common use cases include session storage, real-time analytics, rate limiting, distributed locks, leaderboards, and pub/sub messaging. Any scenario where you need fast access to data that changes frequently or where serving from disk is too slow benefits from Redis caching.

### What Problems Azure Cache for Redis Solves

**Without a cache:**
- Applications query databases for every request, adding latency
- Database throughput becomes the bottleneck as load increases
- Repeated queries for the same data waste compute and storage resources
- Scaling requires expensive database expansion

**With Azure Cache for Redis:**
- In-memory data access eliminates database latency (sub-millisecond vs milliseconds)
- Reduces load on backend databases by caching frequently accessed data
- Enables horizontal scaling of cache capacity independent of database size
- Provides distributed locking and session storage without custom code
- Supports pub/sub messaging for real-time event distribution

### How Redis Differs from AWS ElastiCache for Redis

Architects familiar with AWS should note several important differences:

| Concept | AWS ElastiCache for Redis | Azure Cache for Redis |
|---------|---------------------------|----------------------|
| **Deployment** | You manage subnet, security groups, and node placement | Fully managed; you choose tier and enable features |
| **Tiers** | Cache nodes (cache.t4g, cache.r7g, etc.) | Basic, Standard, Premium, Enterprise, Enterprise Flash |
| **Clustering** | Manual cluster configuration with cluster-mode enabled/disabled support | Enabled by default in Premium+; cluster-aware clients required |
| **High availability** | Multi-AZ with automatic failover | Zone-redundant in Premium+ with automatic failover |
| **Data persistence** | Optional RDB snapshots | RDB or AOF (Append-Only File) options in Premium+ |
| **Geo-replication** | Read replicas (active-passive) | Active-passive (Premium) and active-active geo-replication (Enterprise) |
| **VNet integration** | VNet subnet deployment | VNet injection (Premium+) or Private Link (all tiers) |
| **Modules** | Limited (few available) | RediSearch, RedisBloom, RedisTimeSeries, RedisJSON in Enterprise tier |
| **Scaling strategy** | Create new larger node, migrate data manually | Scale up (tier change) or out (cluster shards) with minimal downtime |
| **Cost model** | Per-node pricing + data transfer | Hourly + per-GB persistence + geo-replication charges |

---

## Cache Tiers and Selecting Your Tier

Azure Cache for Redis offers five tiers, each addressing different performance, availability, and persistence requirements:

### Basic Tier

A single node with no replication or high availability. Suitable for development and non-critical caching.

**Characteristics:**
- Single node deployment (no automatic failover)
- No data persistence by default
- No clustering (no data is sharded)
- No zone redundancy
- Sizes: 250 MB to 53 GB

**When to use:**
- Development and testing
- Learning Redis
- Caching non-critical data where loss is acceptable
- Small applications with bursty traffic

**Limitations:**
- No SLA (no availability guarantee)
- No replication means data loss on node failure
- Cannot upgrade to Standard without recreating the cache
- Least suitable for production

---

### Standard Tier

Two nodes (primary and replica) with automatic failover. No data persistence or clustering.

**Characteristics:**
- Primary-replica topology with automatic failover
- No data persistence by default
- No clustering
- No zone redundancy (both nodes in same zone)
- Sizes: 250 MB to 53 GB

**When to use:**
- Production workloads with moderate availability requirements
- Applications where data can be rebuilt from a source
- High-traffic scenarios where replication helps distribute reads
- Cost-conscious production environments

**Failover behavior:**
- If primary fails, the replica automatically promotes to primary
- Clients experience brief connection reset (usually <30 seconds)
- No data loss during failover (replica is synchronized)

**Limitations:**
- No data persistence (loss of all data if entire cluster fails)
- No clustering (single primary is a throughput bottleneck)
- Not suitable for scenarios requiring geographic redundancy

---

### Premium Tier

Single or multi-node configuration with replication, data persistence, clustering, and zone redundancy.

**Characteristics:**
- Primary-replica topology with automatic failover
- Data persistence: RDB snapshots or AOF logging
- Clustering enabled (distribute data across shards)
- Zone-redundant deployment (replica in different zone)
- Sizes: 6 GB to 1.2 TB
- Supports VNet injection and Private Link

**When to use:**
- Production workloads with strict availability requirements
- Large datasets that exceed single-node capacity
- Scenarios requiring data durability (persistence enabled)
- Applications needing geographic redundancy (geo-replication)
- Compliance environments requiring network isolation

**Premium capabilities:**
- **Data persistence:** RDB snapshots every 6-60 minutes, or AOF continuous logging
- **Clustering:** Data automatically distributed across shards; supports up to 500 shards
- **Geo-replication:** Passive replica in another region for disaster recovery
- **VNet injection:** Deploy Redis instance inside your VNet
- **Firewall rules:** IP-based or firewall rules for network access

**Trade-offs:**
- Higher cost than Standard
- Clustering requires cluster-aware clients
- Persistence adds latency (async writes don't block client, but RDB snapshots impact performance)

---

### Enterprise Tier

Multi-node with Redis modules, active-active geo-replication, and high throughput.

**Characteristics:**
- 3+ nodes with replication and automatic failover
- All Premium features (persistence, clustering, zone redundancy)
- Redis modules included: RediSearch, RedisBloom, RedisTimeSeries, RedisJSON
- Active-active geo-replication (write to replica, changes sync bidirectionally)
- Sizes: 12 GB to 3 TB per region
- Per-shard data management for large datasets

**When to use:**
- Applications needing advanced data structures (RediSearch for full-text search, RedisTimeSeries for metrics)
- Write-heavy scenarios across multiple regions with bi-directional sync
- Mission-critical applications requiring maximum uptime and performance
- Complex data access patterns beyond basic caching

**Enterprise modules:**
- **RediSearch:** Full-text search, aggregations, and SQL-like queries on cached data
- **RedisBloom:** Probabilistic data structures (Bloom filters, HyperLogLog, Count-Min Sketch)
- **RedisTimeSeries:** Time-series data aggregation and analytics
- **RedisJSON:** JSON document storage and manipulation within Redis

**Active-active geo-replication:**
- Writes replicate bidirectionally between regions
- Suitable for applications serving multiple regions with local write capability
- Requires conflict resolution strategy (last-write-wins or custom logic)

---

### Enterprise Flash Tier

Like Enterprise, but uses NVMe flash storage for hot data and memory for cache.

**Characteristics:**
- Same as Enterprise tier features
- Tiered storage: hot data in memory, less-accessed data on NVMe flash
- Sizes: up to 6 TB (much larger than Enterprise)
- ~10x more capacity than Enterprise at lower cost
- Slightly higher latency for flash-backed data

**When to use:**
- Extremely large datasets (multi-TB) that cannot fit in memory
- Cost-sensitive scenarios with acceptable latency increase
- Hybrid workloads mixing hot (frequent) and cold (infrequent) data
- Tiered storage reduces memory cost significantly

**Trade-offs:**
- Flash access is slower than memory (microseconds vs nanoseconds)
- Automatic promotion of frequently accessed data from flash to memory
- Still much faster than database queries

---

## Clustering and Sharding

### How Clustering Works

Premium and Enterprise tiers support clustering, which distributes data across multiple Redis nodes (shards). Each shard holds a subset of the keyspace, allowing the cache to scale horizontally beyond single-node memory limits.

**Cluster topology:**
- Each shard is a primary-replica pair (for redundancy)
- Shards are distributed across cluster nodes
- Data is partitioned using Redis Cluster hash slots (16,384 total slots)
- Clients use cluster-aware libraries to route commands to the correct shard

**Hash slot calculation:**
Redis distributes keys across slots using: `slot = CRC16(key) mod 16384`

A cache with 4 shards divides the 16,384 slots into 4 ranges (~4,096 slots per shard). When a client wants to read a key, it calculates the slot, determines which shard owns that slot, and routes the request accordingly.

**Cluster advantages:**
- Horizontal scalability: add more shards to increase capacity
- Better utilization: no single node becomes the bottleneck
- Distributed processing: aggregate operations can fan out across shards

**Cluster limitations:**
- Multi-key operations must use hash tags if keys are on different shards
- Transactions (MULTI/EXEC) only work within a single slot
- Some commands (e.g., KEYS, SCAN) require cluster-aware clients

---

### Scaling in Clustered Caches

**Scaling up (vertical):** Increase the tier to a larger size. This involves recreating the Redis instance with more memory, causing brief downtime.

**Scaling out (horizontal):** Increase the number of shards in a Premium or Enterprise cluster. Azure redistributes data across the new shards with minimal client impact.

Horizontal scaling is preferred for large, growing datasets because it avoids recreating the entire instance.

---

## Data Persistence

### RDB Snapshots

RDB (Redis Database) persistence periodically snapshots the entire dataset to durable storage. On recovery, Redis loads the snapshot into memory.

**Characteristics:**
- Snapshots occur every 6, 15, 30, or 60 minutes (configurable)
- Asynchronous: snapshots do not block client operations
- Point-in-time recovery: restore from any snapshot
- Suitable when losing recent changes (since last snapshot) is acceptable

**Trade-offs:**
- Large snapshots can consume significant I/O and storage
- Recovery time depends on snapshot size (larger snapshots take longer to load)
- Only point-in-time recovery (not continuous protection)

---

### AOF (Append-Only File)

AOF (Append-Only File) logs every write operation to a durable file. On recovery, Redis replays the operations to reconstruct the dataset.

**Characteristics:**
- Continuous logging: every write is recorded
- Asynchronous writes: clients do not wait for disk I/O
- Granular recovery: can restore to any point
- Data loss is minimal (only operations after the last disk sync)

**Trade-offs:**
- AOF files grow larger than RDB snapshots over time (because they log all operations, not snapshots)
- Disk I/O overhead from continuous logging
- Recovery is slower (replaying operations vs loading snapshot)
- Requires periodic compaction (rewriting the AOF file)

**When to choose AOF over RDB:**
- Durability is critical (financial transactions, user preferences)
- Can tolerate slightly higher latency from logging
- Operating costs of continuous logging are acceptable

---

## Cache-Aside Pattern

Cache-aside (or lazy loading) is the most common caching pattern. The application checks the cache first; if the data is not there, it queries the database and populates the cache.

**Flow:**

1. Client requests data
2. Application checks cache (Redis)
3. **Cache hit:** Return cached data to client
4. **Cache miss:** Query database, cache result, return to client

**Implementation:**
- Set cache expiry (TTL) to automatically evict stale data
- Handle cache misses gracefully (do not let database overwhelm)
- Consider cache warming on startup for critical data

**Code pattern (pseudocode):**

```
function getData(id):
  value = cache.get("key:" + id)
  if value is not null:
    return value

  value = database.query(id)
  cache.set("key:" + id, value, TTL=3600)
  return value
```

**Advantages:**
- Simple to implement
- Works well for read-heavy workloads
- Doesn't require pre-loading all data

**Disadvantages:**
- Cache misses cause database queries (slower first access)
- Data can become stale if TTL is too long
- Requires TTL management to avoid memory bloat

---

## Write-Through Pattern

Write-through ensures data is written to cache and database in a single operation, keeping them synchronized.

**Flow:**

1. Client writes data
2. Application writes to cache
3. Application writes to database
4. Return success to client

**Trade-offs:**
- Stronger consistency (cache and database never diverge)
- Higher latency (must wait for both writes)
- Increased load on database (every cache write hits database)

**Use when:**
- Consistency is more important than latency
- Data must be recoverable even if cache is lost
- Small datasets where database load is manageable

---

## Write-Behind Pattern

Write-behind (write-back) writes to cache immediately and to database asynchronously, optimizing for latency at the cost of durability.

**Flow:**

1. Client writes data
2. Application writes to cache
3. Return immediately to client (database write happens asynchronously)
4. Application writes to database when convenient

**Trade-offs:**
- Lowest latency (client gets immediate response)
- Risk of data loss if cache fails before database write
- Complexity in handling failed database writes

**Use when:**
- Latency is critical
- Data loss is acceptable or recoverable
- Can tolerate eventual consistency
- Examples: user preferences, analytics events, session data

---

## Session Storage and Distributed Locking

### Session Storage

Redis is ideal for storing user session data because it provides fast reads, built-in expiry, and atomic operations.

**Session pattern:**
- Store session as hash or JSON (use [RedisJSON](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-redis-modules){:target="_blank" rel="noopener noreferrer"} for complex structures)
- Key: `session:{sessionId}`
- Set expiry (TTL) equal to session timeout
- Automatically clean up expired sessions

**Advantages:**
- Fast authentication lookups
- Shared sessions across multiple servers
- Automatic cleanup via TTL

---

### Distributed Locking

Redis supports atomic operations that enable distributed locking without a separate coordination service.

**Lock pattern using SET with EX (expire) and NX (only if not exists):**
- Acquire: `SET lock:resource {unique-id} EX 30 NX`
- Release: Delete the key if it still holds your unique ID (prevents accidentally releasing someone else's lock)
- TTL ensures deadlocked locks eventually expire

**Use cases:**
- Prevent concurrent updates to shared resources
- Coordinate work across multiple service instances
- Rate limiting (increment counter, check against limit)

**Important:** Always include a unique ID (process ID, request ID) and verify before releasing to prevent race conditions.

---

## Geo-Replication

Azure Cache for Redis supports read replicas in different regions for disaster recovery and geographic distribution.

### Passive Geo-Replication (Premium)

A read-only replica in another region replicates data from the primary asynchronously.

**Characteristics:**
- Primary is in one region, replica in another
- Replica is read-only
- Write operations go to primary, then replicate to replica
- On primary failure, manually promote replica to primary

**Use when:**
- Need disaster recovery with data in another region
- Can tolerate brief downtime to promote replica
- Read-heavy workloads can be distributed to replica

---

### Active-Active Geo-Replication (Enterprise)

Two caches in different regions both accept writes. Changes replicate bidirectionally with automatic conflict resolution.

**Characteristics:**
- Both regions are active (accept writes)
- Clients write locally for lowest latency
- Changes sync to other region asynchronously
- Conflict resolution: last-write-wins by default

**Use when:**
- Multiple regions need write capability
- Acceptable to resolve write conflicts (last-write-wins)
- Latency-sensitive workloads across regions

---

## VNet Integration and Private Link

### VNet Injection (Premium and Enterprise)

VNet injection deploys the Redis instance inside your VNet, giving it a private IP address and isolation from the public internet.

**Characteristics:**
- Redis instance gets a private IP from your VNet's address space
- No public endpoint
- Traffic stays within your VNet (lower latency, more secure)
- Requires delegated subnet

**When to use:**
- Sensitive data requiring network isolation
- Compliance requirements for private connectivity
- Applications in the same VNet (lowest latency)

---

### Private Link (All Tiers)

Private Link creates a private endpoint for Redis without VNet injection, allowing applications outside the VNet (across VNet peering, VPN, ExpressRoute) to access it privately.

**Characteristics:**
- Works with all tiers (Basic, Standard, Premium, Enterprise)
- Creates private IP in your VNet via a private endpoint
- Public endpoint can be disabled entirely
- Supports cross-region and on-premises access via peering/VPN

**When to use:**
- Need private connectivity across VNets or on-premises
- Want to start with non-injected tiers but add private access later
- Hybrid environments requiring secure connectivity

---

## Connection Management and Best Practices

### Connection Pooling

Redis connections are expensive to establish. Reuse connections via pooling rather than creating a new connection per request.

**How it works:**
- Connection pool maintains a set of open connections
- Clients request connections from the pool, use them, and return them
- Pool automatically manages connection lifecycle

**Configuration guidelines:**
- Pool size: typically 5-10x the number of concurrent clients
- Idle timeout: keep connections alive to avoid reconnection overhead
- Connection retry: implement exponential backoff for failed connections

**Libraries with built-in pooling:**
- StackExchange.Redis (C#)
- Jedis (Java)
- redis-py (Python)
- node-redis (Node.js)

---

### SSL/TLS

Azure Cache for Redis supports SSL/TLS encryption for data in transit. All connections should use SSL unless connecting from within the same VNet.

**Configuration:**
- Enable SSL in connection string (port 6380 for SSL, 6379 for non-SSL)
- Certificate validation: verify Azure-provided certificate to prevent man-in-the-middle attacks
- Disable non-SSL port in firewalls if public endpoint is exposed

---

### Monitoring and Alerts

Monitor key metrics to detect problems early:

**Critical metrics:**
- **Connected clients:** Drop indicates connection issues
- **CPU:** High CPU suggests operations are too expensive
- **Memory used:** Exceeding tier capacity causes eviction
- **Evicted keys:** High eviction rate means cache is too small
- **Cache hits/misses:** Low hit rate suggests ineffective caching strategy

**Set alerts for:**
- Memory usage >80% (consider scaling)
- High eviction rate (data not staying cached)
- Server failures or disconnects (triggers automatic failover)

---

### Configuring Maxmemory Policies

When Redis reaches max memory, the `maxmemory-policy` setting determines what happens. Common policies:

| Policy | Behavior |
|--------|----------|
| `allkeys-lru` | Evict least-recently-used key (standard for caches) |
| `volatile-lru` | Evict least-recently-used key with expiry set |
| `noeviction` | Reject new writes when memory full (fail fast) |

**Recommendation:** Use `allkeys-lru` for general caching to automatically free space for new data.

---

## Common Pitfalls

### Pitfall 1: No TTL on Cached Data

**Problem:** Storing data in cache without setting an expiry (TTL), leading to stale data persisting indefinitely.

**Result:** Users see outdated information. Memory fills with data that is no longer needed. Cache becomes unreliable.

**Solution:** Always set appropriate TTLs when caching. For session data, set TTL to session timeout. For reference data, match TTL to expected change frequency.

---

### Pitfall 2: Caching Large Objects Without Compression

**Problem:** Storing large uncompressed objects (e.g., JSON documents, serialized objects) in cache, consuming excessive memory.

**Result:** Cache fills quickly. Cost increases. Bandwidth waste during replication.

**Solution:** Compress large objects before caching (gzip, brotli). Store only essential fields (exclude nulls, verbose metadata). Consider using RedisJSON or RediSearch if structure is complex.

---

### Pitfall 3: Single-Node Bottleneck with Standard Tier

**Problem:** Using Standard tier for high-traffic applications, relying on a single primary for all writes.

**Result:** Primary becomes bottleneck. Throughput plateaus regardless of data growth.

**Solution:** Upgrade to Premium tier with clustering to shard data across multiple nodes. Sharding distributes write load horizontally.

---

### Pitfall 4: Missing Connection Pool Configuration

**Problem:** Creating a new Redis connection for each request instead of pooling connections.

**Result:** Excessive connection overhead. Latency increases. Redis server maxconnections limit is hit.

**Solution:** Always use a connection pool. Configure pool size based on expected concurrency. Reuse connections.

---

### Pitfall 5: No Monitoring of Cache Hit Rate

**Problem:** Deploying cache without measuring whether it is actually reducing database load.

**Result:** Cache may be ineffective, wasting money and complexity. Developers don't know if caching strategy is working.

**Solution:** Monitor cache hit rate and memory usage. Adjust TTLs or caching strategy if hit rate is below 80%. Use Azure Monitor dashboards for visibility.

---

### Pitfall 6: Cluster-Unaware Clients

**Problem:** Using non-cluster-aware Redis clients with a clustered cache (Premium tier+).

**Result:** All requests go to a single node. Multi-key operations fail. Client cannot route to correct shard.

**Solution:** Use cluster-aware clients: StackExchange.Redis, Lettuce (Java), redis-py with cluster support. Client must understand cluster topology and hash slot mapping.

---

## Key Takeaways

1. **Choose the right tier for your use case.** Basic and Standard are suitable for development. Premium provides production caching with durability. Enterprise adds advanced data structures and active-active replication across regions.

2. **Clustering is essential for large datasets.** Premium and Enterprise tiers automatically shard data, avoiding single-node bottlenecks. Use cluster-aware clients to leverage sharding.

3. **Set TTLs on all cached data to prevent memory bloat and stale data.** Expiry automatically removes data no longer needed, freeing capacity for new data.

4. **Cache-aside pattern is the most common and effective for read-heavy workloads.** Check cache first, query database on miss, populate cache with result. Simple to implement and scales well.

5. **Data persistence is a trade-off between durability and latency.** RDB snapshots are lightweight but point-in-time; AOF is continuous but higher overhead. Choose based on data criticality.

6. **Use connection pooling to avoid connection overhead.** New connections are expensive. Maintain a pool of open connections and reuse them across requests.

7. **VNet injection and Private Link provide network security and isolation.** Use one of these for sensitive data or compliance requirements. Private Link works with all tiers; VNet injection requires Premium+.

8. **Monitor cache hit rate and memory usage to validate effectiveness.** High hit rate (>80%) and stable memory indicate effective caching. Adjust TTLs or caching strategy if hit rate is low.

9. **Geo-replication enables disaster recovery and multi-region deployments.** Premium tiers support passive geo-replication; Enterprise supports active-active writes across regions.

10. **Distributed locking and session storage are native Redis capabilities.** Use SET with NX and EX for locks, hash structures for sessions, and TTL for automatic cleanup. No additional coordination service needed.
