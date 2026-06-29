---
layout: guide
title: "Data Management Patterns"
category: Architecture
subcategory: Patterns
description: "Database patterns for distributed systems including database-per-service, CQRS, event sourcing, saga pattern, and handling data consistency challenges."
tags: [architecture, design-patterns, databases, distributed-systems, microservices, consistency]
---

Data management patterns address how distributed systems handle data storage, access, and consistency across multiple services and databases.

## Database per Service

Each microservice owns its data and database, ensuring loose coupling and service autonomy.

**Use When**:
- Building microservices architecture
- Services have different data storage requirements
- Want to enable independent service evolution
- Need to prevent database-level coupling

<div class="callout callout--warning">
<p class="callout__title">Database per Service Challenges</p>
<ul>
<li>No ACID transactions across services</li>
<li>Data consistency becomes more complex</li>
<li>Reporting across services requires aggregation</li>
</ul>
</div>

**Example**: E-commerce system where user service uses SQL database, product catalog uses document database, and recommendation engine uses graph database.

```
User Service → PostgreSQL
Product Service → MongoDB
Recommendation Service → Neo4j
```

---

## Shared Database

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When to Use Shared Database</h4>
<ul>
<li>Tight coupling between services is acceptable</li>
<li>ACID transactions across services are required</li>
<li>Migrating from monolithic applications</li>
<li>Services have significant data overlap</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Drawbacks of Shared Database</h4>
<ul>
<li>Creates tight coupling between services</li>
<li>Database becomes a bottleneck</li>
<li>Reduces service autonomy</li>
<li>Schema changes affect multiple services</li>
</ul>
</div>
</div>

---

## Event Sourcing

*Pattern popularized by Martin Fowler and Greg Young in early 2000s*

Instead of storing just the current state, stores every change as an immutable event. The current state is derived by replaying all events from the beginning. Think of it like a bank statement: you can see every transaction, not just the current balance.

**How It Works**:

```
Traditional (state-based):              Event Sourcing:
┌─────────────────────┐                 ┌─────────────────────────────────┐
│ Account             │                 │ Event Store                     │
│ ─────────────────── │                 │ ─────────────────────────────── │
│ id: 123             │                 │ 1. AccountOpened(id:123)        │
│ balance: $120       │                 │ 2. Deposited($100)              │
│ status: active      │                 │ 3. Withdrawn($30)               │
│                     │                 │ 4. Deposited($50)               │
│ (only current state)│                 │                                 │
└─────────────────────┘                 │ Current state = replay all      │
                                        │ Balance = 0 + 100 - 30 + 50     │
                                        │         = $120                  │
                                        └─────────────────────────────────┘
```

<blockquote class="pull-quote">
<p>Event sourcing maintains a complete audit trail of all changes, allowing you to replay events for testing, analytics, or answering temporal queries like "what was the state at time X?"</p>
</blockquote>

**Use When**:
- Need complete audit trail of all changes (finance, healthcare, legal)
- Want to replay events for testing, debugging, or analytics
- Building systems that answer temporal queries ("what was the state on March 1st?")
- Implementing complex business domains where understanding "how we got here" matters

**Snapshotting for Performance**:

Replaying millions of events to get current state is slow. Snapshots periodically save the computed state so you only replay events since the last snapshot.

```
Event Store with Snapshots:
┌────────────────────────────────────────────────────────────────────┐
│ Events 1-1000 │ Snapshot @ 1000 │ Events 1001-2000 │ Snapshot @2000│
│               │ balance: $5000  │                  │ balance: $7500│
└────────────────────────────────────────────────────────────────────┘

To get current state (at event 2347):
  1. Load snapshot @ 2000 (balance: $7500)
  2. Replay only events 2001-2347
  3. Much faster than replaying all 2347 events
```

**Schema Evolution**:

Events are immutable, but your event schema will change over time. Strategies:

| Strategy | How It Works | Trade-off |
|----------|--------------|-----------|
| Upcasting | Transform old events to new schema on read | No data migration, runtime overhead |
| Versioned events | Store schema version with event, handle each version | Explicit handling, more code paths |
| Copy-transform | Migrate all events to new schema | One-time cost, breaks immutability |

```
Example: Adding a field to DepositedEvent

v1: { type: "Deposited", amount: 100 }
v2: { type: "Deposited", amount: 100, currency: "USD" }

Upcaster for v1 → v2:
  if event.version == 1:
    event.currency = "USD"  // Default for legacy events
```

<div class="callout callout--warning">
<p class="callout__title">GDPR and Data Deletion</p>
<p>Event sourcing conflicts with "right to be forgotten" requirements. Solutions include crypto-shredding (encrypt PII per user, delete keys to make data unreadable) or keeping deletion tombstone events that indicate "treat as if this user never existed."</p>
</div>

---

## CQRS (Command Query Responsibility Segregation)

*Pattern introduced by Greg Young (2010), based on Bertrand Meyer's Command-Query Separation principle (1988)*

Uses separate models for reading and writing data. Writes go to a normalized model optimized for consistency; reads come from a denormalized model optimized for queries. The two models are synchronized asynchronously.

**How It Works**:

```
                    Commands (writes)              Queries (reads)
                          │                              │
                          ▼                              ▼
                  ┌───────────────┐              ┌───────────────┐
                  │ Command Model │              │  Query Model  │
                  │  (normalized) │              │(denormalized) │
                  └───────┬───────┘              └───────────────┘
                          │                              ▲
                          │    ┌─────────────────┐       │
                          └───→│ Sync Mechanism  │───────┘
                               │ (events/CDC/    │
                               │  polling)       │
                               └─────────────────┘

Write: CreatePost(userId, content)
  → Command DB: INSERT into posts, users_posts, etc. (normalized)
  → Publish: PostCreated event

Sync: PostCreated event received
  → Query DB: UPDATE user_feed (denormalized: includes user name, avatar, etc.)

Read: GetUserFeed(userId)
  → Query DB: SELECT * FROM user_feed WHERE user_id = ? (single table, fast)
```

**Use When**:
- Read and write patterns are significantly different (10:1 or higher read ratio)
- Need to scale reads and writes independently
- Complex reporting requirements that don't fit the write model
- Different consistency requirements (strong for writes, eventual OK for reads)

**Synchronization Mechanisms**:

| Mechanism | How It Works | Latency | Complexity |
|-----------|--------------|---------|------------|
| Same transaction | Write to both in one transaction | 0ms | Low (but defeats purpose) |
| Events | Publish domain events, projector updates query model | 10-100ms | Medium |
| CDC (Change Data Capture) | Stream database changes to projector | 1-10s | Medium |
| Polling | Periodically query command DB for changes | 1-60s | Low |

```
Eventual Consistency Timeline:

T=0:    User creates post
T=1ms:  Post saved to Command DB
T=2ms:  PostCreated event published
T=50ms: Event received by projector
T=55ms: Query DB updated
T=60ms: User's feed shows new post

Reader sees stale data for ~60ms
(Acceptable for most use cases; not acceptable for banking)
```

**Example**: E-commerce order history.

```
Command Model (normalized):
  orders: id, user_id, status, total, created_at
  order_items: order_id, product_id, quantity, price
  products: id, name, description, current_price

Query Model (denormalized for "My Orders" page):
  user_orders: user_id, order_id, status, total, created_at,
               items: [{name, quantity, price, image_url}, ...]

Write: PlaceOrder → Insert into orders + order_items (normalized, ACID)
Sync:  OrderPlaced event → Update user_orders (denormalized, fast reads)
Read:  GetMyOrders → SELECT from user_orders (single query, no joins)
```

<div class="callout callout--warning">
<p class="callout__title">Warning</p>
<p>CQRS adds complexity: two models, synchronization logic, eventual consistency handling. Don't use unless you have a specific problem it solves (high read/write ratio, complex queries, independent scaling needs).</p>
</div>

---

## Materialized View

Pre-computed and stored query results that are periodically updated, optimizing read performance for complex queries.

**Use When**:
- Complex queries are expensive to compute
- Query results don't need to be real-time
- Read-heavy workloads with predictable query patterns

**Trade-offs**:
- Data freshness vs. performance
- Storage space for additional views
- Complexity of keeping views updated

**Example**: E-commerce analytics dashboard showing daily sales summaries, computed overnight and stored for fast display during business hours.

```
Nightly Job: Compute sales by category, region, time period → Store in materialized view
Dashboard: SELECT * FROM daily_sales_summary WHERE date = today
```

---

## Quick Reference

### Pattern Comparison

| Pattern | Data Distribution | Consistency | Complexity | Use Case |
|---------|------------------|-------------|------------|----------|
| **Database per Service** | Isolated | Eventual | High | Microservices independence |
| **Shared Database** | Shared | Strong | Low | Monolith or tight coupling OK |
| **Event Sourcing** | Event log | Eventual | High | Audit trail, event replay |
| **CQRS** | Separate read/write | Varies | Medium-High | Different read/write patterns |
| **Materialized View** | Cached | Stale | Low | Expensive query optimization |

### Decision Tree

| Question | Pattern |
|----------|---------|
| Independent services? | Database per Service |
| Need ACID across services? | Shared Database (consider monolith instead) |
| Need full audit trail? | Event Sourcing |
| Different read/write patterns? | CQRS |
| Expensive queries? | Materialized View |

### Consistency Trade-offs

**Strong Consistency**: Shared Database | CQRS (same DB)
**Eventual Consistency**: Database per Service | Event Sourcing | CQRS (separate DBs)
**Stale Data OK**: Materialized View

---
