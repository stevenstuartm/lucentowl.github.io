---
title: "Amazon ElastiCache for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "How ElastiCache runs in-memory caches and data stores: choosing Valkey, Redis OSS, or Memcached; serverless versus node-based clusters; shards, replicas, and cluster mode; data tiering; failover, durability, and backups; eviction and TTLs; security; and cost."
tags: [elasticache, valkey, redis, memcached, elasticache-serverless, caching, fundamentals]
---

## What ElastiCache Is

**Amazon ElastiCache** runs in-memory key-value engines as a managed service inside your VPC. Because data lives in memory, reads and writes typically take well under a millisecond, which is why applications put ElastiCache in front of a database to absorb repeated reads, and use it directly for data that's short-lived and hot: sessions, rate-limit counters, leaderboards, and locks.

ElastiCache runs three engines:

| | Valkey and Redis OSS | Memcached |
|---|---|---|
| **Data types** | Strings, hashes, lists, sets, sorted sets, streams, bitmaps, geospatial, and more | Strings only |
| **Replication and failover** | Replicas with automatic Multi-AZ failover | None. A lost node loses its data |
| **Persistence** | Snapshots, and optional durability on Valkey | None |
| **Scaling** | Shards and replicas (cluster mode) | More nodes, with the client spreading keys across them |
| **Extras** | Transactions, Lua scripts, pub/sub | Multithreaded nodes |

The Memcached column describes node-based clusters. Serverless Memcached (below) is replicated across zones and can take snapshots. Replicas, shards, and durability are each covered later in this guide.

**Valkey** is the open-source fork of Redis that the Linux Foundation started in 2024, after Redis moved to source-available licenses. It's compatible with the Redis OSS protocol and commands, it's where ElastiCache's new engine features arrive, and it costs less. Node-based Valkey clusters are 20% cheaper than the same nodes running Redis OSS, and serverless Valkey is about a third cheaper. For a new cache, Valkey is the default choice. **Memcached** still suits a plain, disposable cache of strings where multithreaded nodes and the simplest possible model matter more than replication, failover, or data structures.

ElastiCache is a Regional service. A cache lives in subnets of your VPC. A node-based cluster takes them from a **cache subnet group**, which also decides the Availability Zones its nodes can use, and a serverless cache takes a list of subnets directly when it's created. Quotas are per account per Region, such as 300 nodes and 40 serverless caches by default.

---

## Serverless or Node-Based

ElastiCache offers two deployment options with different trade-offs between control and effort.

**ElastiCache Serverless** gives you a single endpoint and no nodes to choose. A proxy layer in front of the cache routes each request, and ElastiCache scales memory, compute, and network up and out as load grows, without the client reconnecting or rediscovering the cluster. Data is always replicated across Availability Zones, always encrypted in transit and at rest, and every serverless cache carries a 99.99% availability SLA. Valkey and Redis OSS clients must support TLS and cluster mode (covered below).

You pay for data stored and for compute, measured in **ElastiCache Processing Units (ECPUs)**. One ECPU covers a simple read or write of up to 1 KB. Larger values consume one ECPU per KB transferred, and commands that take more CPU time consume proportionally more.

| | Valkey | Redis OSS and Memcached |
|---|---|---|
| **Data stored** | $0.084 per GB-hour | $0.125 per GB-hour |
| **Compute** | $0.0023 per million ECPUs | $0.0034 per million ECPUs |

Each serverless cache is billed for at least 100 MB of data on Valkey, or 1 GB on Redis OSS and Memcached. Optional usage limits cap the data stored and ECPUs per second, which bounds the bill.

**Node-based clusters** are the original model. You choose the node type, the number of shards, and the number of replicas in each shard, and pay per node-hour whether the nodes are busy or not. In exchange you get control of engine settings through **parameter groups**, data tiering, durability, reserved-node discounts, and often a lower bill for steady load.

For steady traffic, the comparison depends on request volume. A Valkey cache holding 10 GB and serving 10,000 simple requests per second all month costs about $613 for storage and $60 for compute on Serverless, around $673. The same data needs a `cache.r7g.xlarge` node, since ElastiCache reserves a quarter of each node's memory (see Node Types and Memory below), and a primary with one replica costs about $510 a month, a quarter less. The gap widens as request rates rise, because Serverless bills every request while a node serves far more than 10,000 per second at the same hourly price. Serverless earns its price when load is spiky or unknown, when a cache is new and can't be sized yet, or when there's no one to manage node capacity.

---

## Node-Based Clusters

### Shards, Replicas, and Cluster Mode

A Valkey or Redis OSS cluster is made of **shards**. Each shard has one **primary** node that takes writes and up to five **replicas** that copy it asynchronously and serve reads. The layout depends on **cluster mode**:

- With **cluster mode disabled**, the cluster has a single shard that holds every key. Clients write through the **primary endpoint** and read through the **reader endpoint**, which spreads connections across replicas. Capacity is capped by one node's memory, and write throughput by one primary.
- With **cluster mode enabled**, the key space is divided into 16,384 **hash slots**, and the slots are split among up to 500 shards. Each key belongs to the slot given by a hash of its name. A cluster-aware client reads the slot map through the cluster's **configuration endpoint**, then sends each command straight to the primary of the shard that owns the key. Capacity and write throughput grow with the number of shards. A cluster can have 90 nodes by default, counting primaries and replicas.

{% include figure.html id="aws-elasticache-cluster-modes" %}

Cluster mode has a cost for application code. A command that touches several keys, such as `MGET`, a transaction, or a Lua script, works only if all the keys are in the same slot. **Hash tags** put related keys in one slot deliberately. Only the part of a key inside braces is hashed, so `{user:42}:profile` and `{user:42}:cart` always land together. A key that's much hotter than the rest is still limited to its shard's primary, as in any partitioned store, so a very popular counter or leaderboard needs splitting across several keys.

With cluster mode enabled, shards can be added or removed online, with ElastiCache moving slots between them, and **auto scaling** (Valkey 7.2 and Redis OSS 6 and later, on a subset of node sizes) can add or remove shards or replicas on a schedule or from CPU and memory metrics. Nodes in either mode can be scaled to a larger or smaller type.

Cluster mode disabled still suits a data set that fits comfortably on one node, clients that don't speak the cluster protocol, and applications that rely heavily on multi-key operations. The choice only moves one way. A cluster running Valkey 7.2 or Redis OSS 7 or later can switch from disabled to enabled online, through an intermediate compatible mode, but an enabled cluster can't go back.

### Node Types and Memory

Nodes come in the familiar families: memory optimized (`cache.r`), general purpose (`cache.m`), and burstable (`cache.t`) for development, mostly on Graviton processors. Not all of a node's memory holds data. The `reserved-memory-percent` parameter sets aside 25% by default for replication buffers, backups, and fragmentation, and AWS advises against lowering it, so a node with 13 GB of memory holds just under 10 GB of data. Size nodes for the data set plus that reserve and some headroom, and watch memory use as it grows.

**Data tiering** on `cache.r6gd` nodes adds local SSDs to each node. When memory fills, the least recently used values move to SSD, while keys always stay in memory, and a value read from SSD moves back to memory first. Nodes hold about 4.8 times as much data as memory-only `r6g` nodes, and AWS cites over 60% savings at full use. A request for a value on SSD takes about 300 microseconds longer. It suits large data sets where roughly a fifth or less of the data is read regularly.

---

## Availability and Durability

### Multi-AZ Failover

With **Multi-AZ** enabled and replicas in other Availability Zones, ElastiCache promotes the replica with the least replication lag when a primary fails, and writes typically resume within seconds. The primary endpoint's DNS name moves to the new primary, so applications that write through it need no configuration change, only the ability to reconnect. ElastiCache then replaces the lost node in the zone where it failed. Clusters with cluster mode enabled always have automatic failover on. Without Multi-AZ, a failed primary is replaced by a new node, which starts empty if the shard has no replicas to copy from.

Replication is asynchronous, so a failover can lose writes that the old primary accepted but hadn't yet sent to the replica. For a cache that's usually acceptable, since the data can be reloaded from its source. When it isn't, there are two options.

### Durability

Since June 2026, node-based **Valkey 9.0** clusters can turn on **durability**. The primary writes each change to a transaction log replicated across at least two Availability Zones, and data survives even the loss of every node.

- **Synchronous writes** are acknowledged only after the log has them, so a failover loses nothing, but writes take single-digit milliseconds instead of microseconds.
- **Asynchronous writes** keep microsecond write latency and can lose up to 10 seconds of acknowledged writes in a failure.

Reads stay in memory either way. Durability turns ElastiCache from a cache into a primary data store for data that needs memory speed, and it can't be combined with data tiering. **Amazon MemoryDB** offers a similar durable, Valkey-compatible database as a separate service.

### Backups

Valkey and Redis OSS clusters and all serverless caches, including Serverless Memcached, can take **snapshots**, automatically each day or on demand, kept for a retention period of up to 35 days or until deleted. A restore creates a new cache, which then needs its endpoint wired into the application. Snapshots of node-based clusters can also be exported to S3. Node-based Memcached clusters have no backups.

**Global Datastore** replicates a Valkey or Redis OSS cluster to clusters in other Regions for disaster recovery and local reads.

---

## Running a Cache Well

**Every cached key needs a lifetime.** A **TTL** (time to live) set with the write, such as `SET key value EX 300`, removes the key after five minutes and bounds how stale a cached copy can get. Keys without a TTL stay until they're deleted or evicted, and the default eviction policy never evicts them.

**Eviction policy decides what happens when memory fills.** The `maxmemory-policy` parameter chooses whether to evict least recently used keys, least frequently used keys, keys with a TTL only, or nothing, in which case writes fail with an out-of-memory error. ElastiCache's default, `volatile-lru`, evicts only keys that have a TTL. A cache full of keys without TTLs therefore starts rejecting writes instead of evicting, which is a common surprise. Choose `allkeys-lru` for a pure cache where any key can be rebuilt. Default parameter groups can't be edited, so changing the policy means attaching a custom parameter group.

**Watch a few metrics.** In CloudWatch, `Evictions` rising steadily means the cache is too small for its working set. `CacheHitRate` shows whether the cache is saving the database any work. `DatabaseMemoryUsagePercentage`, `EngineCPUUtilization` (the engine's main thread, which matters more than host CPU), `CurrConnections`, and `ReplicationLag` round out the picture.

**Reuse connections.** Opening a connection, especially a TLS connection, costs far more than a command. Keep a small number of long-lived connections per application process, and use pipelining to send batches of commands without waiting for each reply.

The patterns for keeping a cache consistent with its source, such as cache-aside, write-through, and invalidation on change, apply to ElastiCache as to any cache. The ElastiCache-specific decisions are the TTLs, the eviction policy, and whether stale reads from a replica are acceptable.

---

## Security

**Network.** Caches are reachable only inside the VPC. A **security group** on the cache allows the engine port (6379 for Valkey and Redis OSS, 11211 for Memcached) only from the application's security groups.

**Encryption.** Serverless caches always encrypt in transit and at rest. For node-based Valkey and Redis OSS clusters, at-rest encryption can only be chosen at creation, and it's on by default for Valkey. Adding it later means backing up, restoring into a new encrypted cluster, and moving the application to it. In-transit encryption (TLS) can be turned on for existing clusters running Valkey 7.2 or Redis OSS 7 and later. Memcached supports TLS only when the cluster is created.

**Authentication.** Valkey and Redis OSS offer three levels, all of which require in-transit encryption:

- An **AUTH token**, one shared password for a node-based cluster. Serverless caches don't support it.
- **Role-based access control (RBAC)**, with named users whose access strings limit which commands and keys each can use, grouped into user groups attached to the cache. Serverless caches always use it.
- **IAM authentication** (Valkey 7.2 and Redis OSS 7 and later), where an application connects as an RBAC user with a 15-minute token signed with its IAM role instead of a stored password. An IAM-authenticated connection is closed after 12 hours unless it re-authenticates.

IAM authentication removes cache passwords from configuration entirely, and it's the natural choice for applications that already run with IAM roles.

---

## Where the Money Goes

- **Node-hours** for node-based clusters, for every primary and replica. A Multi-AZ shard with one replica doubles the node count.
- **Data stored and ECPUs** for Serverless, with a minimum of 100 MB per Valkey cache or 1 GB for other engines.
- **Synchronous durability**, which adds 18% to the node-hour price. Asynchronous durability costs nothing extra.
- **Backup storage** at $0.085 per GiB-month, with no free allowance.
- **Cross-AZ traffic**, $0.01 per GiB in each direction on the EC2 side, between application instances and cache nodes in different Availability Zones.

Reserved nodes discount node-based clusters that run all the time, and Database Savings Plans cover ElastiCache for Valkey, including Serverless.

---

## Key Takeaways

1. **Choose Valkey for new caches.** It's open source, compatible with Redis OSS, cheaper, and where new ElastiCache features land. Memcached remains an option for a plain string cache.
2. **Serverless trades money for simplicity.** It scales and patches itself behind one endpoint, but steady load usually costs less on nodes, and the gap grows with request volume.
3. **Cluster mode scales writes and memory across shards.** It needs a cluster-aware client, and multi-key commands need their keys in one slot, which hash tags arrange.
4. **Run production caches Multi-AZ.** Failover promotes a replica within seconds, but asynchronous replication can drop the last few writes.
5. **Durability makes ElastiCache a data store.** Valkey 9.0 clusters can log every write across zones, synchronously for no loss or asynchronously for speed.
6. **Set TTLs and pick an eviction policy on purpose.** The default evicts only keys with a TTL, so a cache of keys without TTLs fills up and rejects writes.
7. **Keep caches private and prefer IAM authentication.** Serverless always encrypts, node-based at-rest encryption is a creation-time choice, and IAM tokens remove stored cache passwords.
