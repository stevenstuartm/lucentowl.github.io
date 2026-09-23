---
layout: guide
title: "Key-Value and In-Memory Stores"
category: Databases
subcategory: Database Types
description: "How key-value stores map keys to opaque values, why keeping data in RAM makes stores like Redis fast, how they persist and distribute data, and when their narrow query model is the right trade."
tags: [key-value, in-memory, redis, caching, low-latency, practical]
redirect_from:
  - /study-guides/data/in-memory-databases.html
---

## What They Are

Key-value stores are the simplest database type. They map unique keys to values, and the core API is three operations: set a value for a key, get the value for a key, and delete a key. The store treats the value as opaque bytes and doesn't know what's inside it.

The model exists for speed and simplicity. If an access pattern is always "look up this specific thing by its identifier," there's no need to pay for schema enforcement, query parsing, or a query planner.

Many key-value stores also keep their data in memory. An **in-memory** store holds the whole dataset in RAM rather than on disk, which removes disk I/O from every operation and brings latency down from milliseconds to microseconds inside the server. In-memory is a storage choice rather than a data model, and in-memory relational engines exist too, but the two ideas meet most often in stores like Redis, so this guide covers both.

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────┐
│  KEY-VALUE STORE                                            │
├─────────────────────────┬───────────────────────────────────┤
│  KEY                    │  VALUE (opaque to the store)      │
├─────────────────────────┼───────────────────────────────────┤
│  session:abc123         │  {"user_id": 42, "expires": ...}  │
├─────────────────────────┼───────────────────────────────────┤
│  user:42:preferences    │  {"theme": "dark", "lang": "en"}  │
├─────────────────────────┼───────────────────────────────────┤
│  cache:product:789      │  <serialized product data>        │
├─────────────────────────┼───────────────────────────────────┤
│  rate:ip:192.168.1.1    │  47                               │
└─────────────────────────┴───────────────────────────────────┘

Operations:
  GET  session:abc123           → returns the value
  SET  session:abc123  <value>  → stores or replaces the value
  DEL  session:abc123           → removes the key
  INCR rate:ip:192.168.1.1      → atomic increment (Redis)
```

Keys are usually namespaced with prefixes like `session:`, `user:`, and `cache:` to keep different kinds of data apart and make them easy to find by pattern.

---

## How They Work

### Hash-Based Lookup

Most key-value stores find values through a hash table. The key is hashed to a location, and a lookup hashes the key and goes straight there. That gives constant-time lookups on average, however much data is stored.

In a distributed key-value store, the key's hash also decides which server holds it, so a client or proxy can route each request to the right node without a central lookup. Redis Cluster, for example, divides the key space into 16,384 hash slots spread across its nodes.

### Data Structures Beyond Strings

The simplest stores only hold strings or bytes. Redis also stores typed values and operates on them in place:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STRINGS        counter:pageviews   158472                              │
│  LISTS          queue:emails        ["msg1", "msg2", "msg3"]            │
│  SETS           user:42:tags        {"premium", "early-adopter"}        │
│  SORTED SETS    leaderboard:game1   {alice: 9500, bob: 8200}  by score  │
│  HASHES         session:abc123      {user_id: 42, ip: "10.0.0.1"}       │
│  STREAMS        events:orders       append-only log of entries          │
└─────────────────────────────────────────────────────────────────────────┘

  INCR counter:pageviews              → 158473
  LPUSH queue:emails "msg4"           → adds to the head of the list
  ZADD leaderboard:game1 9600 alice   → updates alice's score and rank
```

Because the server understands these structures, operations like pushing to a queue, adding to a set, or updating a leaderboard score happen on the server in one step, without the client reading a value, changing it, and writing it back.

### Single-Threaded Execution

Redis executes commands on a single thread. Since version 6 it can use extra threads for network I/O, but commands themselves still run one at a time. Each command is therefore atomic, and there are no race conditions between two commands on the same key. `MULTI`/`EXEC` blocks and Lua scripts extend that to a group of commands that run without anything else interleaving. The cost is that one slow command, such as fetching every key matching a pattern, stalls every other client until it finishes.

### Persistence

An in-memory store loses everything on restart unless it writes data to disk. Redis offers two mechanisms, which can be combined:

- **RDB snapshots** write a point-in-time copy of the whole dataset periodically. Restarting from one is fast, but writes since the last snapshot are lost.
- **The append-only file (AOF)** logs every write, and the store replays the log on restart. With the common setting of flushing to disk once per second, a crash loses at most about a second of writes, at some cost in throughput.

Redis enables RDB snapshots and leaves AOF off in its default configuration, so a default installation can lose minutes of writes on a crash. For a cache that's fine. For data that exists nowhere else, it's a decision to make deliberately.

### Replication and Consistency

Consistency depends on the product. Redis replicates asynchronously, so a replica can briefly serve stale data, and a failover can lose writes the old primary hadn't yet shipped. DynamoDB serves eventually consistent reads by default and strongly consistent reads on request. etcd uses consensus and gives strongly consistent reads. For caches, sessions, and preferences, brief staleness is usually acceptable. For locks and coordination, it often isn't.

---

## Why They Excel

### Latency and Throughput

With no query parsing or planning, and in-memory stores with no disk I/O, operations complete in microseconds on the server, and network round trips dominate the time a client sees. A single Redis instance can handle hundreds of thousands of simple operations per second, and more when clients pipeline requests.

### Simplicity

The API is small enough to learn in an afternoon. There's no query language to master, no schema to design, and no joins to tune.

### Atomic Operations on Shared State

Counters, rate limits, queues, and leaderboards need many clients to update the same value without losing updates. Server-side atomic operations make that straightforward.

### Horizontal Scaling

Data partitions naturally by key, and each key lives on exactly one partition. Adding nodes adds capacity roughly in proportion, as long as no single key is so hot that one node takes most of the traffic.

---

## Why They Struggle

### No Queries Beyond the Key

You can't ask "find all sessions for user 123" unless you designed for it, for example by keeping a set of session IDs under `user:123:sessions`. Any lookup other than by key means scanning everything or maintaining secondary indexes by hand in application code.

### No Relationships or Integrity

If order 456 refers to customer 123, the store doesn't know. Enforcing that the customer exists, and cleaning up when it's deleted, is the application's job.

### Value Size Limits

Stores optimize for small values, and most set hard limits: an item in DynamoDB can be at most 400 KB, Memcached's default item limit is 1 MB, and a Redis string can hold up to 512 MB but large values slow every operation that touches them. Large blobs belong in object storage, with the key-value store holding a reference.

### Dataset Size and Cost of RAM

An in-memory store's data must fit in RAM, and RAM costs far more per gigabyte than disk. A dataset that grows without bound, or one that's mostly cold, is expensive to keep in memory. Setting an eviction policy and expiry times keeps a cache within its memory budget.

---

## When to Use Them

Key-value and in-memory stores fit well for:

- **Caching** computed results, query results, and API responses
- **Session storage**, looked up by session ID
- **Rate limiting**, with atomic counters that expire
- **Leaderboards**, kept ranked by sorted sets
- **Lightweight queues and pub/sub messaging**, where losing an occasional message is acceptable
- **Feature flags and configuration**, read by key
- **Distributed locks**, with care about what happens during failover

---

## When to Look Elsewhere

If you need to query by attributes other than the key, enforce relationships between records, run transactions across many keys on different nodes, or search within values, a key-value store forces you to build database features in your application. If the dataset is much larger than affordable memory, or durability matters more than latency, a disk-based database fits better.

---

## Examples

**Redis** is the most widely used in-memory key-value store, with rich data structures, scripting, replication, and clustering. After Redis changed its license in 2024, the Linux Foundation's **Valkey** fork continued under the original open-source license. **Memcached** is a simpler cache with no persistence or data structures beyond strings, and it's multi-threaded, so a single instance uses many cores. **Amazon DynamoDB** is a managed key-value and document database that scales without servers to operate. **etcd** trades raw speed for strong consistency and is where Kubernetes stores cluster state.

---
