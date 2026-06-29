---
layout: guide
title: "Performance and Scalability Patterns"
category: Architecture
subcategory: Patterns
description: "Optimize system performance and scale with patterns for caching, throttling, load shedding, horizontal/vertical scaling, and partitioning strategies."
tags: [architecture, design-patterns, performance, scalability, caching, rate-limiting]
---

These patterns optimize system performance, handle increased load, and ensure systems can scale efficiently as demand grows.

## Throttling and Rate Limiting

<blockquote class="pull-quote">
<p>Rate limiting protects your system from overload, but choosing the right algorithm determines whether you allow bursts or enforce smooth traffic.</p>
</blockquote>

Controls the rate of requests to prevent system overload and ensure fair resource usage. Essential for API protection and multi-tenant systems.

**Use When**:
- Protecting against traffic spikes
- Ensuring fair usage among clients
- Preventing abuse or DDoS attacks
- Managing resource costs (e.g., cloud API calls)
- Implementing tiered pricing (free vs paid tiers)

**Implementation Strategies**:

**Token Bucket Algorithm**:
- Bucket holds tokens, refilled at fixed rate
- Each request consumes a token
- **Pros**: Allows bursts up to bucket capacity, smooth long-term rate
- **Cons**: Burst at start of period possible
- **Used by**: AWS, Google Cloud, Stripe

**Leaky Bucket Algorithm**:
- Requests enter queue (bucket), processed at fixed rate
- Overflow requests rejected
- **Pros**: Smooth, predictable output rate
- **Cons**: No burst allowance, can delay requests

**Fixed Window Counter**:
- Count requests per fixed time window (e.g., per minute)
- **Pros**: Simple, low memory
- **Cons**: Burst at window boundaries (2x rate possible at edges)

**Sliding Window Log**:
- Track timestamp of each request
- **Pros**: Most accurate, no boundary issues
- **Cons**: High memory usage

**Sliding Window Counter**:
- Hybrid approach: fixed windows with weighted count
- **Pros**: Good accuracy, lower memory than log
- **Used by**: CloudFlare, Redis

<div class="callout callout--tip">
<p class="callout__title">Algorithm Selection</p>
<p>Token bucket is the most common choice for APIs, as it allows bursts while ensuring long-term rate compliance. Use leaky bucket when you need predictable, smooth output rates.</p>
</div>

**Example**: API gateway limiting each API key to 1000 requests per hour, with burst allowance of 100 requests per minute using token bucket.

```
Client → API Gateway (Rate Limiter) → Backend
  Request 1-100: ALLOWED (burst using bucket tokens)
  Request 101-1000: ALLOWED (within hourly limit)
  Request 1001: REJECTED (429 Too Many Requests, Retry-After: 3600)
```

---

## Cache-Aside

Application manages cache explicitly, loading data from cache first and falling back to database if not found.

**Use When**:
- Need fine-grained control over caching
- Cache and database can become inconsistent temporarily
- Read-heavy workloads with predictable access patterns

**How It Works**:

1. Check cache for data
2. If cache miss, load from database
3. Store data in cache for future requests
4. Handle cache invalidation on updates

**Example**: User profile service that checks Redis cache first, loads from PostgreSQL on cache miss, and stores result in cache.

```
GET /user/123:
  1. Check Redis for user:123
  2. If miss, query PostgreSQL
  3. Store in Redis with TTL
  4. Return to client

UPDATE /user/123:
  1. Update PostgreSQL
  2. Invalidate Redis cache for user:123
```

---

## Cache-Through

Cache sits between application and database, automatically loading and storing data.

**Use When**:
- Want automatic cache management
- Can tolerate cache-through latency
- Prefer consistency over performance

**Example**: Application server with cache-through layer that automatically manages product catalog caching between application and database.

```
Application → Cache Layer → Database
  Read: Cache handles fetching from DB if not cached
  Write: Cache handles updating both cache and DB
```

---

## Sharding

Splits a single database into multiple smaller databases (shards), each holding a portion of the data. Requests are routed to the appropriate shard based on a sharding key. This allows horizontal scaling when a single database can't handle the load.

**How It Works**:

```
Before Sharding:                    After Sharding:
┌─────────────────────┐            ┌─────────┐ ┌─────────┐ ┌─────────┐
│   Single Database   │            │ Shard 0 │ │ Shard 1 │ │ Shard 2 │
│   100M users        │     →      │ Users   │ │ Users   │ │ Users   │
│   (overloaded)      │            │ A-H     │ │ I-P     │ │ Q-Z     │
└─────────────────────┘            └─────────┘ └─────────┘ └─────────┘

Application:
  user = getUser("john_doe")
  shard = routeToShard("john_doe")  // → Shard 1 (I-P)
  return shard.query("SELECT * FROM users WHERE username = ?", "john_doe")
```

**Use When**:
- Single database cannot handle load (CPU, connections, IOPS)
- Data set is too large for one server (storage limits)
- Need to scale beyond vertical limits (can't buy bigger hardware)

**Sharding Strategies**:

| Strategy | How It Works | Pros | Cons |
|----------|--------------|------|------|
| Range-based | Partition by value ranges (A-H, I-P, Q-Z) | Simple, range queries work | Uneven distribution, hot spots |
| Hash-based | hash(key) % num_shards | Even distribution | Range queries hit all shards |
| Directory-based | Lookup table maps keys to shards | Flexible placement | Lookup overhead, single point of failure |

```
Range-based example (by date):
  Shard 1: orders from 2023
  Shard 2: orders from 2024
  Problem: Shard 2 gets all new traffic (hot spot)

Hash-based example:
  Shard = hash(user_id) % 3
  user_id=100 → hash=7834 → 7834 % 3 = 1 → Shard 1
  user_id=101 → hash=2941 → 2941 % 3 = 2 → Shard 2
  Evenly distributed, but "get orders from Jan 2024" hits all shards
```

**Hot Spot Problem and Mitigation**:

A hot spot occurs when one shard receives disproportionate traffic. Causes include popular users, trending content, or time-based keys.

```
Hot Spot Example:
  Shard by user_id, celebrity user has 10M followers
  All "get celebrity's posts" queries hit one shard
  That shard is overloaded, others are idle

Mitigations:
  1. Add random suffix to hot keys: user_123 → user_123_0, user_123_1
     (scatter reads across shards, aggregate in application)
  2. Dedicated shard for known hot entities
  3. Caching layer in front of hot shards
```

**Resharding (Adding/Removing Shards)**:

When you add or remove shards, data must be rebalanced. This is complex and risky.

```
Before: 3 shards, hash(key) % 3
After:  4 shards, hash(key) % 4

Problem: Most keys now map to different shards
  key=100: hash % 3 = 1, hash % 4 = 2  (must move)
  key=101: hash % 3 = 2, hash % 4 = 1  (must move)

Solution: Consistent Hashing
  Keys are placed on a ring, each shard owns a portion
  Adding a shard only moves keys from adjacent shards

  Ring before:     Ring after:
  ┌─────────┐      ┌─────────┐
  │ Shard 0 │      │ Shard 0 │
  ├─────────┤      ├─────────┤
  │ Shard 1 │  →   │ Shard 1 │
  ├─────────┤      ├─NEW─────┤
  │ Shard 2 │      │ Shard 3 │ ← Only takes some of Shard 2's keys
  └─────────┘      ├─────────┤
                   │ Shard 2 │
                   └─────────┘
```

**Cross-Shard Queries**:

Queries that span multiple shards are expensive. They require scatter-gather: query all shards, aggregate results.

```
Query: "SELECT COUNT(*) FROM orders WHERE date > '2024-01-01'"

Without sharding: Single query, fast
With sharding:
  1. Send query to all 4 shards in parallel
  2. Each shard returns its count
  3. Application sums counts: 1000 + 2500 + 1800 + 700 = 6000

For ORDER BY + LIMIT queries, worse:
  1. Each shard returns top N sorted results
  2. Application merges and re-sorts all results
  3. Significant memory and CPU overhead
```

<div class="callout callout--warning">
<p class="callout__title">Sharding is a Last Resort</p>
<p>Sharding adds significant complexity. Before sharding: optimize queries, add read replicas, implement caching, scale vertically. Shard only when these options are exhausted.</p>
</div>

---

## Quick Reference

### Pattern Comparison

| Pattern | Purpose | Complexity | Performance Gain |
|---------|---------|------------|-----------------|
| **Throttling** | Prevent overload | Low | N/A (protection) |
| **Cache-Aside** | Reduce DB load | Low | High for reads |
| **Cache-Through** | Simplify caching | Low | Medium for reads |
| **Sharding** | Horizontal scaling | High | High for reads/writes |

### Decision Tree

| Question | Pattern |
|----------|---------|
| Protecting against overload? | Throttling and Rate Limiting |
| Read-heavy workload? | Cache-Aside or Cache-Through |
| Single DB can't handle load? | Sharding |
| Need fine-grained cache control? | Cache-Aside |
| Want simple cache management? | Cache-Through |

### Cache Strategies

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Cache-Aside (Lazy Loading)</h4>
<p><strong>Pros:</strong></p>
<ul>
<li>Only cache what's needed</li>
<li>Simple to implement</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>Cache misses impact performance</li>
<li>Manual invalidation required</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Cache-Through (Write-Through)</h4>
<p><strong>Pros:</strong></p>
<ul>
<li>Data always in cache</li>
<li>Simpler application code</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>Every write pays cache penalty</li>
<li>Unused data gets cached</li>
</ul>
</div>
</div>

### Sharding Considerations

**Range-based**: Easy to implement, risk of hot spots
**Hash-based**: Even distribution, complex range queries
**Directory-based**: Flexible, additional lookup overhead

---
