---
layout: guide
title: "Data Management Patterns"
category: Architecture
subcategory: Patterns
description: "How distributed systems store and read data once one database becomes several: database per service, shared database, eventual consistency, event sourcing, CQRS, and materialized views."
tags: [practical, database-per-service, cqrs, event-sourcing, materialized-view, eventual-consistency]
---

A single database gives a system two things for free: any query can join any two tables, and any write can commit across all of them atomically. Splitting that database is what makes services independent, and it is also what takes both of those guarantees away. The patterns here are the ways systems get back some of what the split cost them.

They compose rather than compete. A service can own its own database, publish events from it, project those events into a read model, and cache an expensive rollup on top, all at once.

## Database per Service

Each service owns its data and its schema. No other service reads or writes those tables directly, so the owning service can change them without coordinating with anyone.

{% include figure.html id="pat-db-per-service" %}

**Use when**:
- Services need to deploy and evolve on their own schedules
- Different services genuinely suit different storage engines
- Database-level coupling is the thing currently blocking teams from moving independently

**Example**: An e-commerce system where the user service uses a relational database, the product catalog uses a document store, and recommendations use a graph database, each chosen for how that service actually queries its data.

```
User Service           → PostgreSQL
Product Service        → MongoDB
Recommendation Service → Neo4j
```

**Trade-offs**: A transaction can no longer span two services, so a write that touches both becomes a multi-step workflow with compensation when a step fails. A query that needs data from three services becomes three calls and an assembly step. Reporting across the whole system needs somewhere to bring the data back together, which is usually a warehouse or a set of projections rather than a query.

---

## Shared Database

Several services read and write the same database. This is the arrangement most systems start in and the one a monolith migration is leaving, which makes it easy to dismiss. It still has the strengths that made it the default.

**Use when**:
- Transactional integrity across what would otherwise be separate services is a hard requirement
- The services in question change together anyway, so independent schemas would buy nothing
- A monolith is being decomposed and the data split hasn't happened yet

**Trade-offs**: The schema becomes a shared interface that nobody declared. Any service can depend on any column, so a change that looks local can break a consumer the owning team doesn't know about, and every migration turns into a cross-team negotiation. The database is also a single point of contention for load and a single blast radius for failure.

---

## Eventual Consistency

Once data lives in more than one place, whether that is two service databases or a write model and a read model, a change can't land in all of them at the same instant. Eventual consistency is the guarantee that replaces atomicity: given enough time and no further writes, every copy converges on the same answer. In between, they disagree.

The useful question is never whether a system is eventually consistent. It is how long the window lasts, and which reader is looking during it.

{% include figure.html id="pat-consistency-window" %}

| Reader | Tolerance for the window |
|--------|--------------------------|
| The user who just made the write | Very low. Their own change appearing to vanish reads as a bug, not as latency |
| Another user viewing the same data | Higher. They have no expectation about when the change happened |
| A dashboard or analytics job | High. These often read a deliberately lagged snapshot anyway |
| A decision that commits money or stock | None. This one needs the authoritative model, not a projection |

Read-your-own-writes is the case that surfaces first and the one users notice. The usual fixes are to route a writer's own subsequent reads to the authoritative model for a short window, to have the client hold the value it just submitted and render that instead of refetching, or to return the new state directly from the write so there is nothing to refetch.

Where the window genuinely cannot be tolerated, the answer is to stop spreading that particular piece of data. Keeping the decision and the data it depends on inside one transactional boundary is a design choice available at any point, and it is usually cheaper than engineering around a lag the business won't accept.

---

## Event Sourcing

*Documented by Martin Fowler in 2005, and later paired with CQRS by Greg Young*

Rather than storing current state and overwriting it on each change, event sourcing stores every change as an immutable event and derives current state by replaying them. A bank statement works this way: the balance is not stored as a fact, it is what the transactions add up to.

**How it works**:

{% include figure.html id="pat-event-sourcing" %}

**Use when**:
- The history of how state changed is itself required, as in finance, healthcare, or anything audited
- The system has to answer questions about a past point in time, not just the present
- Understanding why the data looks this way is a recurring business need rather than a debugging convenience
- New read models will be built later against history that already happened

**Snapshotting**: Replaying a long log to answer one question gets slow. A snapshot stores the computed state at a point in the log so replay only has to cover what came after it.

{% include figure.html id="pat-es-snapshots" %}

**Schema evolution**: Events are immutable, but the shape of new events changes over time, so a replay has to handle every version ever written.

| Strategy | How it works | Trade-off |
|----------|--------------|-----------|
| Upcasting | Transform old events into the current shape as they are read | No migration, but the transform code lives forever |
| Versioned events | Store a version on each event and handle each version explicitly | Clear, but every version adds a code path |
| Copy-transform | Rewrite the whole log into the new shape | One-time cost, and it gives up the immutability that the log is for |

```
Adding a field to DepositedEvent

v1: { "type": "Deposited", "amount": 100 }
v2: { "type": "Deposited", "amount": 100, "currency": "USD" }

Upcaster, v1 to v2:
  if event.version == 1:
    event.currency = "USD"   // the only currency that existed then
```

<div class="callout callout--warning">
<p class="callout__title">GDPR and Data Deletion</p>
<p>An immutable log sits badly with a right-to-erasure request, because the whole point is that events are never rewritten. The two common answers are crypto-shredding, where each subject's personal data is encrypted under its own key and the key is destroyed to render the data unreadable, and tombstone events that instruct every projection to treat the subject as though it never existed.</p>
</div>

**Trade-offs**: Every consumer that derives state from the log is coupled to the shape of events written years ago, and those events can't be edited to fix a bad design. Replay cost grows with the log until snapshots are added, and snapshots are then another thing to invalidate when projection logic changes. Event sourcing is also hard to reverse: once downstream systems depend on the log, moving back to state-based storage means recreating a history you would no longer be recording.

---

## CQRS (Command Query Responsibility Segregation)

*Named by Greg Young, following Bertrand Meyer's command-query separation principle from Object-Oriented Software Construction (1988)*

CQRS uses separate models for writing and reading. Writes go to a model normalized for correctness. Reads come from one or more models denormalized for the specific queries they serve. Something keeps the read models up to date from the write model, and that something runs after the write commits.

**How it works**:

{% include figure.html id="pat-cqrs" %}

```
Write: CreatePost(userId, content)
  → Command DB: INSERT into posts, users_posts (normalized)
  → Publish: PostCreated event

Sync: PostCreated received
  → Query DB: UPDATE user_feed (denormalized: name and avatar inlined)

Read: GetUserFeed(userId)
  → Query DB: SELECT * FROM user_feed WHERE user_id = ? (one table, no joins)
```

**Use when**:
- Reads vastly outnumber writes, or the two need to scale on different hardware
- The queries the system has to answer don't fit the shape the write model needs
- Reads and writes have genuinely different consistency requirements
- One write feeds several different read shapes that would otherwise all be joins

**Synchronization**: How the read model is kept current sets both the lag readers see and how much the write side has to know about it.

| Mechanism | How it works | Lag | Notes |
|-----------|--------------|-----|-------|
| Same transaction | Both models written in one transaction | None | Gives up the independence that motivated CQRS in the first place |
| Domain events | The write side publishes, a projector updates the read model | Broker delivery plus projection time | The write side has to publish, so it knows CQRS exists |
| Change data capture | A connector tails the write database's log and feeds the projector | Similar to events | The write side needs no changes at all |
| Polling | A job queries the write model on an interval | The polling interval | Simplest to build, and the lag is whatever you configured |

**Example**: An order history page.

```
Command Model (normalized):
  orders:      id, user_id, status, total, created_at
  order_items: order_id, product_id, quantity, price
  products:    id, name, description, current_price

Query Model (denormalized for the "My Orders" page):
  user_orders: user_id, order_id, status, total, created_at,
               items: [{name, quantity, price, image_url}, ...]

Write: PlaceOrder  → insert orders + order_items (normalized, one transaction)
Sync:  OrderPlaced → update user_orders (denormalized)
Read:  GetMyOrders → one select, no joins
```

**Trade-offs**: CQRS is two models, a projector, and a lag that users can see, in exchange for read and write shapes that no longer have to compromise with each other. That is a poor trade unless the compromise was actually hurting. Projections also need rebuilding when their logic changes, which means the write side has to retain enough history to rebuild from, and that is the point where teams often find they wanted event sourcing underneath.

---

## Materialized View

A query result computed ahead of time and stored as though it were a table, refreshed on a schedule or when its inputs change. The read becomes a single lookup, and the cost of computing it moves off the request path.

**Use when**:
- A query is expensive enough that computing it per request is the bottleneck
- The same expensive query is asked repeatedly with the same shape
- The answer being slightly out of date is acceptable to whoever reads it

**Example**: An analytics dashboard showing daily sales by category and region, computed overnight and read directly during the day.

```
Nightly job: aggregate sales by category, region, and day → write to daily_sales_summary
Dashboard:   SELECT * FROM daily_sales_summary WHERE date = ?
```

**Trade-offs**: The view is as stale as the time since its last refresh, so the refresh schedule is a product decision about acceptable staleness rather than an operational detail. Refreshing costs whatever the original query cost, just moved elsewhere, and a full rebuild of a large view can be heavy enough to need its own window. The view also has to be invalidated when the logic that produces it changes, not only when its data does.

---

## Quick Reference

| Pattern | What it buys | What it costs |
|---------|--------------|---------------|
| **Database per service** | Each service owns its schema and changes it without coordinating | Cross-service reads become API calls, cross-service writes become multi-step workflows |
| **Shared database** | Joins and atomic transactions across everything in it | Schema changes become cross-team negotiations, and the database is shared contention and shared blast radius |
| **Event sourcing** | A complete, replayable record of how the state got here | Replay cost, schema evolution on data that can't be rewritten, and difficulty deleting |
| **CQRS** | Read and write models shaped and scaled independently | Two models, a projector, and a lag readers can observe |
| **Materialized view** | An expensive query answered in a single read | Storage, a refresh job, and answers as old as the last refresh |
