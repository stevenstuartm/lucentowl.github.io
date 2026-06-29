---
layout: guide
title: "Key-Value Stores"
category: Databases
subcategory: Database Types
description: "Deep dive into key-value stores—the simplest database type, how they work, and when to use them for caching, sessions, and high-throughput lookups."
tags: [databases, key-value, redis, caching, distributed-systems, performance]
---

## What They Are

Key-value stores are the simplest database type: they map unique keys to values. You can set a value for a key, get the value for a key, and delete a key. That's the entire API. The database treats values as opaque blobs and doesn't know or care what's inside them.

Key-value stores emerged from the need for speed and simplicity. If your access pattern is always "look up this specific thing by its identifier," why pay the overhead of schema enforcement, query parsing, and transaction coordination?

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────┐
│  KEY-VALUE STORE                                            │
├─────────────────────────┬───────────────────────────────────┤
│  KEY                    │  VALUE (opaque to database)       │
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
  SET  session:abc123  <value>  → stores/updates the value
  DEL  session:abc123           → removes the key
  INCR rate:ip:192.168.1.1      → atomic increment (Redis)
```

The database doesn't understand value structure. Keys are often namespaced with prefixes (session:, user:, cache:) to organize data and enable prefix scans.

---

## How They Work

### Hash-Based Storage

Most key-value stores use hash tables internally. When you store a value, the key is hashed to determine where the value lives. Lookups hash the key and jump directly to the location. This gives O(1) average-case performance regardless of how much data you have.

### Distributed Operation

In distributed key-value stores, the key also determines which server holds the data. Keys hash to a position on a "ring," and each server owns a portion of that ring. This consistent hashing approach means adding or removing servers only requires moving data for keys near the affected portion of the ring, not reshuffling everything.

### Eventual Consistency

Most distributed key-value stores favor availability over consistency. When you write a value, the write succeeds as soon as one replica acknowledges it. Other replicas receive the update asynchronously. For a brief period, different readers might see different values. For many use cases like caching, session storage, and user preferences, this is acceptable.

### Data Structures Beyond Strings

While the simplest key-value stores only support string values, Redis (the most popular key-value store) supports rich data structures: lists (for queues), sets (for unique collections), sorted sets (for leaderboards), hashes (for objects with fields), and streams (for event logs). Operations on these structures are atomic, so you can push to a list, pop from a queue, or increment a counter without worrying about race conditions.

---

## Why They Excel

### Speed

Without query parsing, schema validation, or transaction coordination, operations complete in microseconds. Redis processes millions of operations per second on modest hardware.

### Simplicity

The API is trivial to understand. No query language to learn, no schema to design, no joins to optimize.

### Horizontal Scaling

Data partitions naturally by key. Adding servers increases capacity linearly.

---

## Why They Struggle

### No Queries

You cannot ask "find all sessions for user X" unless you've designed your keys to support that (like using a prefix "session:user123:*" and supporting prefix scans). Any query beyond key lookup requires scanning or maintaining secondary indexes manually.

### No Relationships

If order 456 references customer 123, the database doesn't know or care. Enforcing referential integrity is your application's responsibility.

### Value Size Limits

Most key-value stores optimize for small values. Storing multi-megabyte blobs degrades performance.

---

## When to Use Them

Key-value stores shine for:

- **Caching**: Store computed results, database query results, or API responses
- **Session storage**: Look up session data by session ID
- **Rate limiting**: Atomic increment operations with expiration
- **Feature flags and configuration**: Simple key-based lookups
- **Any scenario where you're always accessing data by a known identifier**

---

## When to Look Elsewhere

If you need to query by attributes other than the key, enforce relationships between records, perform transactions across multiple keys, or store complex data that you'll need to search within, a key-value store will force you to build database features in your application.

---

## Examples

**Redis** dominates this category, offering rich data structures, Lua scripting, pub/sub messaging, clustering, and persistence options. It's the Swiss Army knife of caching and real-time data.

**Memcached** is simpler and more focused, offering pure caching with multi-threaded performance. Choose it when you need only caching and want operational simplicity.

**Amazon DynamoDB** is a managed service that's technically a wide-column store but often used for key-value patterns. It scales automatically and requires no operational overhead.

**etcd** provides strong consistency guarantees, making it suitable for distributed coordination and configuration management. Kubernetes uses it to store cluster state.

---
