---
title: "AWS ElastiCache for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "Comprehensive guide to AWS ElastiCache covering Redis vs Memcached, cluster modes, caching strategies, ElastiCache Serverless, cost optimization, and high availability patterns"
tags: [aws, elasticache, redis, memcached, caching, performance, cost-optimization, fundamentals]
---

## What Is Amazon ElastiCache?

Amazon ElastiCache is a fully managed in-memory caching service that supports Redis, Valkey, and Memcached. ElastiCache delivers sub-millisecond latency for read-heavy and compute-intensive workloads by storing frequently accessed data in memory.

**What Problems ElastiCache Solves**:
- **Database load reduction**: Offload read traffic from databases to cache (50-90% database query reduction)
- **Performance bottlenecks**: Provide sub-millisecond response times (vs. milliseconds to seconds for databases)
- **Scalability limitations**: Handle millions of requests per second without database scaling
- **Session storage**: Centralized session management for stateless applications
- **Real-time analytics**: In-memory data structures for leaderboards, counters, and queues

**When to use ElastiCache**:
- Your application has read-heavy workloads with frequently accessed data
- You need sub-millisecond latency for user-facing applications
- You require session storage for distributed applications
- You need real-time analytics (leaderboards, counters, rate limiting)
- You want to reduce database costs by caching query results

## Redis/Valkey vs Memcached

ElastiCache supports three engines: **Redis**, **Valkey** (Redis fork), and **Memcached**. Each has distinct characteristics.

### Engine Comparison

| Dimension | Redis / Valkey | Memcached |
|-----------|----------------|-----------|
| **Data Structures** | Strings, lists, sets, sorted sets, hashes, bitmaps, hyperloglogs, streams | Strings only |
| **Persistence** | Snapshots (RDB), append-only file (AOF) | None (volatile) |
| **Replication** | Primary-replica replication, up to 5 replicas | None |
| **High Availability** | Multi-AZ with automatic failover | Multi-node (manual failover) |
| **Transactions** | MULTI/EXEC transactions, Lua scripting | None |
| **Pub/Sub** | Publish/subscribe messaging | None |
| **Partitioning** | Cluster Mode (up to 500 shards) | Multi-threaded horizontal scaling |
| **Use Case** | Complex caching, session storage, real-time analytics, queues | Simple key-value caching at scale |

### When to Use Redis/Valkey

**Choose Redis or Valkey when you need**:
- **Advanced data structures**: Lists, sets, sorted sets (e.g., leaderboards, queues)
- **Data persistence**: Snapshots for recovery after restarts
- **Replication**: Read replicas for scaling reads and high availability
- **Automatic failover**: Multi-AZ with <6 minute failover time
- **Pub/sub messaging**: Real-time notifications and event-driven architectures
- **Transactions**: Atomic operations across multiple keys

**Example Use Cases**:
- Session storage with automatic expiration (TTL)
- Gaming leaderboards using sorted sets (ZADD, ZRANGE)
- Real-time analytics counters (INCR, DECR)
- Message queues using lists (LPUSH, RPOP)
- Rate limiting with sliding window counters

### When to Use Memcached

**Choose Memcached when you need**:
- **Simplest caching**: Pure key-value storage without advanced features
- **Multi-threaded performance**: Memcached uses multiple CPU cores per node
- **Horizontal scaling**: Add/remove nodes dynamically without downtime
- **No persistence required**: Data loss on restart is acceptable

**Example Use Cases**:
- Database query result caching
- HTML fragment caching for web pages
- API response caching
- Computed result caching (expensive calculations)

### Valkey vs Redis (Licensing Considerations)

**Valkey** is a Linux Foundation-led open source fork of Redis created in March 2024 after Redis changed its licensing model.

**Key Differences**:
- **Valkey**: Fully open source (BSD license), 33% lower ElastiCache Serverless pricing, backed by 40+ companies
- **Redis**: Redis 7.2 is the last fully open source version; Redis 8.0 uses AGPLv3 (restrictive for commercial use)

<div class="callout callout--tip">
<p class="callout__title">AWS Recommendation (2024-2025)</p>
<p>ElastiCache for Valkey offers 33% lower Serverless pricing and 20% lower node-based pricing compared to Redis. For new deployments, Valkey is the recommended engine.</p>
</div>

## ElastiCache Deployment Options

ElastiCache offers three deployment models: **Serverless**, **Node-based (Cluster Mode Disabled)**, and **Node-based (Cluster Mode Enabled)**.

### ElastiCache Serverless

Fully managed caching with zero infrastructure management, launched 2024.

**How It Works**:
- Automatically scales capacity based on demand
- Pay-per-use pricing (no upfront capacity planning)
- Minimum data storage: 100 MB (Valkey), 1 GB (Redis/Memcached)
- Instant scaling to handle traffic spikes

**Pricing (us-east-1, 2024)**:
- **Data storage**: $0.125/GB-hour (Valkey: 33% cheaper)
- **Compute (ECPUs)**: 1 ECPU per simple SET/GET request (up to 1 KB)
- **Example**: 10 GB average storage + 10,000 requests/second = $900/month storage + $90/month compute = **$990/month**

**When to Use Serverless**:
- Unpredictable or variable workloads
- New applications with unknown cache requirements
- Development and testing environments
- Cost optimization (pay only for actual usage)

**Limitations**:
- Higher per-request cost compared to node-based for steady workloads
- Less control over configuration (auto-tuned by AWS)

### Node-Based: Cluster Mode Disabled

Single shard with one primary node and up to 5 read replicas.

**Architecture**:
- **Primary node**: Handles all writes and reads
- **Read replicas**: Handle reads only (eventually consistent)
- **Maximum capacity**: Limited by single node instance size (e.g., cache.r7g.16xlarge = 419 GB memory)

**When to Use Cluster Mode Disabled**:
- Simpler architecture with single endpoint
- Workload fits within single node memory limits (<419 GB)
- You need strongly consistent reads from primary

**High Availability**:
- Enable Multi-AZ with automatic failover
- Failover time: <6 minutes
- 99.99% SLA (for Redis 6.2+ created after January 2023)

### Node-Based: Cluster Mode Enabled

Distributed architecture with up to 500 shards, each containing 1 primary + up to 5 replicas.

**Architecture**:
- **Sharding**: Data partitioned across multiple shards using hash slots
- **Scaling**: Add/remove shards to scale capacity horizontally
- **Maximum capacity**: 500 shards × 419 GB/shard = **209 TB total**
- **Maximum replicas**: 500 shards × 5 replicas = **3,000 nodes total** (up to 90 nodes per cluster)

**When to Use Cluster Mode Enabled**:
- Workload exceeds single node memory (>419 GB)
- You need to scale beyond 5 read replicas
- You want to distribute load across multiple endpoints

**Trade-offs**:
- More complex application logic (sharding-aware client required)
- Some Redis commands unsupported (e.g., KEYS, MGET across shards)
- Higher operational complexity

## Node Types and Instance Families

ElastiCache offers four instance families optimized for different workload characteristics.

### T-type (Burstable Performance)

General-purpose burstable nodes (T4g, T3, T2) providing baseline CPU with burst capability.

**Characteristics**:
- Baseline CPU performance with burst credits
- Suitable for variable or low-traffic workloads
- Lowest cost per hour

**When to Use**:
- Development and testing environments
- Applications with intermittent traffic
- Non-production workloads

**Pricing Example** (cache.t4g.micro, us-east-1):
- On-demand: $0.016/hour ($12/month)
- Reserved (3-year): $0.005/hour ($3.65/month, 69% savings)

### M-type (General Purpose)

Balanced compute, memory, and network (M7g, M6g, M5).

**Characteristics**:
- Balanced resources for general workloads
- Latest M7g (Graviton3) offers best price-performance
- Suitable for most caching use cases

**When to Use**:
- General-purpose caching
- Moderate read/write throughput requirements
- Cost-sensitive production workloads

**Pricing Example** (cache.m7g.large, us-east-1):
- On-demand: $0.144/hour ($105/month)
- 2 vCPUs, 6.38 GB memory

### R-type (Memory-Optimized)

Memory-optimized nodes (R7g, R6g, R5) with 2:1 memory-to-vCPU ratio.

**Characteristics**:
- Optimized for memory-intensive workloads
- R7g (Graviton3): 28% higher throughput, 21% better P99 latency vs R6g
- Largest instance: cache.r7g.16xlarge (64 vCPUs, 419 GB memory)

**When to Use**:
- Large dataset caching (>100 GB)
- High-throughput applications
- Production workloads requiring maximum performance

**Pricing Example** (cache.r7g.large, us-east-1):
- On-demand: $0.226/hour ($165/month)
- 2 vCPUs, 13.07 GB memory

**Performance**: R7g provides up to 28% increased throughput compared to R6g for Redis workloads.

### R6gd-type (Data Tiering)

Memory + SSD hybrid nodes (R6gd) that automatically tier least-recently-used data to SSD.

**Characteristics**:
- Memory for hot data, SSD for warm data
- 5x total storage capacity compared to R6g (same cost)
- Ideal for workloads accessing <20% of dataset frequently
- Supports Redis 6.2+ only

**Pricing Example** (cache.r6gd.xlarge, us-east-1):
- On-demand: $0.302/hour ($221/month)
- 4 vCPUs, 26.32 GB memory + 158.25 GB SSD = **184.57 GB total**

**Cost Savings**: 60% cost savings at maximum utilization vs memory-only R6g nodes.

**When to Use**:
- Large datasets (>100 GB) with infrequent access patterns
- Cost optimization for caching workloads with low cache hit rates on most data
- Applications tolerant of slightly higher latency for SSD reads (single-digit milliseconds vs sub-millisecond)

**Performance**: SSD reads add 1-3ms latency compared to memory-only reads.

## Cluster Modes and Replication

### Cluster Mode Disabled (Single Shard)

**Architecture**:
- 1 primary node (read/write)
- 0-5 read replicas (read-only)
- All data stored on every node

**Scaling**:
- **Vertical**: Resize node instance type (requires downtime)
- **Read scaling**: Add read replicas (up to 5)

**Endpoints**:
- **Primary endpoint**: Write operations
- **Reader endpoint**: Automatically distributes reads across replicas

**Replication**:
- Asynchronous replication from primary to replicas
- Replication lag typically <1 second

**Use Case**: Workloads fitting in single node memory with read scaling needs.

### Cluster Mode Enabled (Multi-Shard)

**Architecture**:
- 1-500 shards (node groups)
- Each shard: 1 primary + 0-5 replicas
- Data partitioned using 16,384 hash slots

**Scaling**:
- **Horizontal (shards)**: Add/remove shards to scale capacity
- **Vertical (nodes)**: Resize node instance type within shard
- **Read scaling**: Add replicas per shard

**Endpoints**:
- **Configuration endpoint**: Single endpoint routes requests to correct shard

**Data Distribution**:
- Hash slot = CRC16(key) mod 16384
- Shards split hash slots evenly (e.g., 4 shards = 4,096 slots per shard)

**Use Case**: Workloads exceeding single node capacity or requiring >5 read replicas.

**Scaling Limits** (Redis 5.0.6+):
- Maximum 500 shards
- Maximum 90 nodes per cluster (shards × replicas ≤ 90)
- Examples: 90 shards × 0 replicas, 45 shards × 1 replica, 15 shards × 5 replicas

## Caching Strategies

ElastiCache supports multiple caching patterns optimized for different access patterns.

### Lazy Loading (Cache-Aside)

Load data into cache only when requested (on cache miss).

**How It Works**:
1. Application queries cache
2. **Cache hit**: Return data from cache
3. **Cache miss**: Query database, write to cache, return data

**Advantages**:
- Only frequently accessed data is cached
- Cache doesn't fill with unused data
- Simple to implement

**Disadvantages**:
- First request always misses (cold cache)
- Cached data can become stale
- Cache misses add latency (database query + cache write)

**Best For**:
- Read-heavy workloads
- Workloads tolerant of occasional stale data
- Minimizing cache storage costs

**Example Use Case**: Product catalog caching (products queried frequently are cached, rarely viewed products are not).

### Write-Through

Write data to cache and database simultaneously.

**How It Works**:
1. Application writes data
2. Write to cache (synchronous)
3. Write to database (synchronous)
4. Return success

**Advantages**:
- Cache is always up-to-date (no stale data)
- Read requests always hit cache (low latency)

**Disadvantages**:
- Every write incurs double latency (cache + database)
- Cache fills with all data (even rarely accessed)
- Wasted cache space for write-once, read-never data

**Best For**:
- Write-heavy workloads requiring consistency
- Applications intolerant of stale data
- Use cases where every write is eventually read

**Example Use Case**: User session storage (every session write must be immediately available to all servers).

### Combining Strategies (Hybrid)

Use lazy loading + write-through together for optimal performance.

**How It Works**:
- **Writes**: Write-through (cache + database)
- **Reads**: Lazy loading (cache miss → database → cache)
- **TTL**: Set expiration times to evict stale data

**Advantages**:
- Cache stays fresh for written data
- Lazy loading prevents cache bloat
- TTL handles edge cases (deletes, external updates)

**Best For**: Most production applications requiring balance between consistency, performance, and cache efficiency.

**Example Use Case**: E-commerce application where product inventory (written frequently) uses write-through, while product descriptions (updated rarely) use lazy loading with 1-hour TTL.

### Time-to-Live (TTL)

Set expiration times on cached data to automatically evict stale entries.

**How It Works**:
- Set TTL when writing to cache (e.g., SETEX key 3600 value for 1-hour expiration)
- ElastiCache automatically deletes key after TTL expires
- Next read triggers cache miss → lazy load from database

**Best Practices**:
- **Short TTL (seconds to minutes)**: Frequently changing data (stock prices, inventory)
- **Medium TTL (hours)**: Slowly changing data (product catalogs, user profiles)
- **Long TTL (days)**: Rarely changing data (configuration, static content)

**Example**: Cache product descriptions with 1-hour TTL, product inventory with 30-second TTL.

## High Availability and Failover

### Multi-AZ with Automatic Failover

ElastiCache Redis supports Multi-AZ deployments with automatic failover for high availability.

**How It Works**:
- Primary node in AZ-A
- Read replicas in AZ-B, AZ-C (cross-AZ replication)
- Automatic failover if primary fails

**Failover Process**:
1. Primary node failure detected
2. ElastiCache selects a replica to promote
3. Promoted replica becomes new primary
4. DNS updated to point to new primary
5. Old primary becomes replica when recovered

**Failover Time**: <6 minutes (typically 1-3 minutes)

**SLA**: 99.99% availability for Redis 6.2+ clusters created after January 13, 2023.

**Best Practices**:
- Use **primary endpoint** for writes (automatically updates DNS on failover)
- Use **reader endpoint** for reads (distributes across replicas)
- Enable **automatic backups** for disaster recovery

**Cost**: ~50% premium (3 nodes instead of 1: 1 primary + 2 replicas across 3 AZs).

### Backup and Restore

**Snapshots** (Redis only):
- Manual or automatic snapshots (RDB files)
- Stored in Amazon S3
- Retention: 1-35 days (automatic), indefinite (manual)

**Backup Frequency**:
- Automatic: Once per day during maintenance window
- Manual: On-demand

**Restore Time**: 10-30 minutes depending on dataset size.

**Cost**: Standard S3 storage pricing ($0.023/GB/month).

**Best Practice**: Enable automatic backups with 7-day retention for production clusters.

## Performance Optimization

### Connection Pooling

Reuse connections to reduce overhead of establishing new connections.

**Why It Matters**:
- Establishing new connections: 10-50ms overhead
- Connection pools: <1ms to acquire existing connection

**Best Practices**:
- Use connection pooling libraries (e.g., redis-py with connection_pool, StackExchange.Redis with ConnectionMultiplexer)
- Set pool size based on concurrency (100-500 connections typical)
- Configure timeouts: connection timeout (5s), socket timeout (3s)

### Pipelining

Send multiple commands in a single request to reduce network round trips.

**Performance**: 5-10x throughput improvement for bulk operations.

**Example** (Redis):
```
# Without pipelining: 3 round trips
SET key1 value1  # Round trip 1
SET key2 value2  # Round trip 2
SET key3 value3  # Round trip 3

# With pipelining: 1 round trip
PIPELINE
SET key1 value1
SET key2 value2
SET key3 value3
EXEC
```

**Use Case**: Bulk data loading, batch updates.

### Read Replicas for Scaling Reads

Distribute read traffic across up to 5 read replicas.

**Architecture**:
- Primary endpoint: Writes
- Reader endpoint: Reads (automatically load-balances)

**Scaling Pattern**:
- 1 primary: 100,000 reads/second
- 1 primary + 5 replicas: 600,000 reads/second (6x scaling)

**Replication Lag**: <1 second typical (eventually consistent).

**Use Case**: Read-heavy applications (e.g., product catalog, user profiles).

### Monitoring and Metrics

**Key CloudWatch Metrics**:
- **CPUUtilization**: Target <70% (scale up if sustained >80%)
- **DatabaseMemoryUsagePercentage**: Target <80% (scale up if >90%)
- **CacheHitRate**: Target >90% (optimize cache keys/TTLs if <80%)
- **Evictions**: High evictions indicate insufficient memory (scale up or increase TTLs)
- **ReplicationLag**: Target <1 second (investigate if >5 seconds)

**Alarms to Set**:
- CPUUtilization >80% for 5 minutes
- DatabaseMemoryUsagePercentage >90%
- CacheHitRate <80%
- Evictions >1,000/minute

## Cost Optimization

### Reserved Nodes

Purchase 1-year or 3-year reserved capacity for predictable workloads.

**Savings**:
- **1-year partial upfront**: 37% discount
- **3-year all upfront**: 69% discount

**Example** (cache.r7g.large):
- On-demand: $0.226/hour ($165/month)
- Reserved (3-year all upfront): $0.070/hour ($51/month)
- **Savings**: $114/month (69%)

**When to Use**: Stable baseline capacity for production workloads.

### ElastiCache Serverless for Variable Workloads

For unpredictable or low-traffic workloads, Serverless offers cost savings.

**Cost Comparison** (10 GB cache, 1,000 requests/second):
- **Node-based** (cache.r6g.large always running): $128/month
- **Serverless** (10 GB + 1,000 req/s): $90 + $9 = $99/month
- **Savings**: $29/month (23%)

**Breakeven**: Serverless is cheaper when utilization <70% or traffic is highly variable.

### Data Tiering for Large Datasets

Use R6gd nodes for workloads with large datasets accessed infrequently.

**Cost Comparison** (150 GB cache):
- **R6g (memory-only)**: cache.r6g.2xlarge (209 GB memory) = $0.806/hour ($588/month)
- **R6gd (memory + SSD)**: cache.r6gd.xlarge (26 GB memory + 158 GB SSD = 184 GB total) = $0.302/hour ($221/month)
- **Savings**: $367/month (62%)

**Trade-off**: Slightly higher latency for SSD reads (1-3ms vs sub-millisecond).

**Use Case**: Large datasets with <20% hot data (e.g., historical analytics, time-series data).

### Right-Sizing Instances

Monitor metrics and downsize over-provisioned instances.

**Metrics to Check**:
- **CPUUtilization**: <30% sustained → downsize
- **DatabaseMemoryUsagePercentage**: <50% sustained → downsize
- **NetworkBytesIn/Out**: Low network utilization → downsize

**Example**:
- cache.r6g.xlarge (52 GB) at 30% memory usage
- Downsize to cache.r6g.large (26 GB)
- **Savings**: $0.403/hour → $0.201/hour = $147/month (50%)

## Security Best Practices

### Encryption

**Encryption at Rest**:
- Enabled during cluster creation (cannot enable later)
- Uses AWS KMS (customer-managed or AWS-managed keys)
- No performance impact

**Encryption in Transit**:
- TLS encryption for client connections
- Enable during cluster creation (Redis 6.0+, Memcached 1.6+)
- Minimal performance overhead (<5%)

**Best Practice**: Enable both encryption at rest and in transit for production clusters.

### VPC Deployment

Deploy ElastiCache in VPC private subnets with security groups.

**Network Isolation**:
- ElastiCache in private subnets (no internet access)
- Security groups allow inbound traffic only from application subnets
- Port 6379 (Redis) or 11211 (Memcached) restricted to application tier

**Best Practice**: Never expose ElastiCache publicly. Use VPC Peering or PrivateLink for cross-VPC access.

### AUTH Token (Redis)

Require AUTH token for Redis connections to prevent unauthorized access.

**How It Works**:
- Set password during cluster creation
- Clients must authenticate with AUTH command before executing commands

**Best Practice**: Use complex passwords (64+ characters), rotate passwords periodically using IAM Secrets Manager.

## Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **1. Not enabling Multi-AZ** | Downtime during failures | Enable Multi-AZ for production (99.99% SLA) |
| **2. Using default security groups** | Security risk: open access | Create restrictive security groups (only application subnets) |
| **3. Not monitoring CacheHitRate** | Poor performance, high database load | Monitor hit rate; target >90%, optimize keys/TTLs if <80% |
| **4. Over-provisioning instances** | 50%+ wasted costs | Right-size using CloudWatch metrics (CPU <70%, memory <80%) |
| **5. Not using connection pooling** | High connection overhead (10-50ms/connection) | Use connection pooling libraries |
| **6. Setting TTLs too long** | Stale data | Set TTLs based on data freshness requirements (seconds to hours) |
| **7. Not enabling encryption** | Compliance violations, security risk | Enable encryption at rest and in transit |
| **8. Using Cluster Mode Enabled unnecessarily** | Higher complexity | Use Cluster Mode Disabled if workload fits in single node |
| **9. Not using Reserved Nodes** | 37-69% higher costs | Purchase Reserved Nodes for stable baseline capacity |
| **10. Choosing Memcached over Redis** | Losing persistence, replication, failover | Use Redis unless you specifically need multi-threaded simplicity |
| **11. Not setting alarms** | Unnoticed performance degradation | Set CloudWatch alarms: CPU >80%, Memory >90%, Evictions >1000/min |
| **12. Large object sizes in cache** | Memory exhaustion | Store large objects (>100 KB) in S3, cache references only |
| **13. Not using reader endpoint** | Reads hitting primary only | Use reader endpoint to distribute reads across replicas |
| **14. Serverless for steady workloads** | Higher costs than reserved nodes | Use node-based with Reserved Nodes for predictable workloads |
| **15. Not enabling automatic backups** | Data loss risk | Enable automatic backups (7-day retention minimum) |

**Cost Impact Examples**:
- **Pitfall #4** (over-provisioning): cache.r6g.xlarge ($294/month) at 30% usage → cache.r6g.large ($147/month) = **$147/month savings**
- **Pitfall #9** (not using Reserved Nodes): cache.r7g.large on-demand ($165/month) → 3-year reserved ($51/month) = **$114/month savings (69%)**
- **Pitfall #14** (Serverless for steady workloads): 10 GB + 10,000 req/s Serverless ($990/month) → cache.r6g.large reserved ($95/month) = **$895/month savings**

## When to Use ElastiCache vs DAX vs CloudFront

| Dimension | ElastiCache | DAX (DynamoDB Accelerator) | CloudFront |
|-----------|-------------|----------------------------|------------|
| **Purpose** | General-purpose caching | DynamoDB-specific caching | CDN / edge caching |
| **Latency** | Sub-millisecond | Microseconds | Edge-based (10-50ms) |
| **Use Case** | Database queries, sessions, APIs | DynamoDB read acceleration | Static assets, API Gateway |
| **Cache Invalidation** | Manual or TTL-based | Automatic (write-through) | TTL or manual invalidation |
| **Complexity** | Moderate (manual cache logic) | Low (transparent caching) | Low (origin-based caching) |
| **Cost** | $12-$600+/month per node | $29-$227+/month per node | $0.085/GB transferred |

**Decision Framework**:
- **ElastiCache**: General caching for RDS, Aurora, application-level caching
- **DAX**: Exclusively for DynamoDB read acceleration
- **CloudFront**: Static assets, API responses for global users

## Key Takeaways

**Redis vs Memcached**:
- Use Redis for advanced features (data structures, persistence, replication, high availability)
- Use Memcached for simple key-value caching with multi-threaded performance
- **Valkey** (Redis fork) offers 33% lower Serverless pricing and is recommended for new deployments

**Deployment Options**:
- **Serverless**: Zero management, pay-per-use, ideal for variable workloads
- **Cluster Mode Disabled**: Simpler architecture, <419 GB per cluster, up to 5 read replicas
- **Cluster Mode Enabled**: Horizontal scaling, up to 209 TB capacity, 500 shards

**Node Types**:
- **T-type**: Burstable performance for dev/test ($12/month)
- **M-type**: General-purpose production ($105/month)
- **R-type**: Memory-optimized, highest performance ($165/month)
- **R6gd-type**: Data tiering (memory + SSD), 60% cost savings for large datasets

**Caching Strategies**:
- **Lazy loading**: Cache on demand, prevent cache bloat
- **Write-through**: Always fresh, higher write latency
- **Hybrid**: Combine both + TTLs for optimal balance

**High Availability**:
- Enable Multi-AZ for 99.99% SLA
- Automatic failover in <6 minutes
- Use primary/reader endpoints for automatic DNS updates

**Cost Optimization**:
- Reserved Nodes: 69% savings for stable workloads
- Serverless: Cost-effective for variable workloads (<70% utilization)
- Data Tiering (R6gd): 60% savings for large infrequently accessed datasets
- Right-sizing: Monitor CPU (<70%) and memory (<80%)

**Security**:
- Enable encryption at rest and in transit
- Deploy in VPC private subnets with restrictive security groups
- Use AUTH tokens for Redis authentication
- Enable automatic backups (7-day retention)

**Performance**:
- Target >90% cache hit rate
- Use connection pooling (100-500 connections)
- Pipeline bulk operations (5-10x throughput)
- Distribute reads across replicas (6x scaling with 5 replicas)
