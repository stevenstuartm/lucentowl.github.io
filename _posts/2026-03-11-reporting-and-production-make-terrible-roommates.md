---
layout: post
title: "Reporting and Production Make Terrible Roommates"
date: 2026-03-11
description: "Reporting pressure gradually distorts production schemas until they serve two masters and compromise for both. Separating the workloads lets each model evolve for the consumers it was designed to serve."
tags: [architecture, databases, design-patterns, distributed-systems, data-modeling, event-sourcing, cqrs]
---

I tend to think of reporting and production as incompatible roommates. They need the same space, they optimize for completely different things, and every accommodation one makes for the other is a debt that gets called in later. The production schema is usually what accumulates the most debt and gets hit the hardest.

Consider what happens when the analytics team asks for a denormalized `order_summary` view on the production database so their dashboards load faster. The DBA obliges, adds a materialized view, and now every schema migration has to account for it. Six months later the team wants to split the `orders` table into `orders` and `order_line_items`, but the view is embedded in 10 dashboard queries and a nightly export job. The refactor stalls, and the production schema fossilizes around a reporting concern.

The cause is structural. A transactional schema optimizes for write consistency, referential integrity, and the access patterns of the application that owns it. A reporting schema optimizes for read throughput, aggregation, and the access patterns of analysts and dashboards. When both share a schema, every design decision becomes a negotiation, and reporting usually wins, because it's the most visible to leadership and the most painful to change after the fact.

Not every system needs a separation on day one. A small team with a single database, low reporting complexity, and a schema that's still fluid can query production directly without meaningful friction. But this fossilization is predictable. It emerges when reporting consumers multiply, when dashboards become load-bearing, and when schema changes require cross-team coordination. Architects who recognize this trajectory can keep the door open for separation without building the full pipeline prematurely, by resisting the urge to denormalize production schemas for reporting convenience and by keeping reporting access patterns from becoming implicit contracts on the production schema. When the separation does happen, it can be reactive, tapping into what the database already captures, or intentional, making the application responsible for producing reporting-quality records in the write path.

## Reactive Separation

### A Dedicated Reporting Replica

The simplest place to start is to point reporting tools at a read replica of the production DB. Many teams already have replicas for distributing query load, and so dedicating one to reporting keeps analytical queries from competing with production traffic. No new infrastructure, no async pipeline, no application code changes.

```
  ┌─────────────┐         ┌─────────────────┐
  │ Application │────────>│  Production DB   │
  └─────────────┘  writes │  (Primary)       │
                          └────────┬─────────┘
                                   │ replication
                                   v
                          ┌─────────────────┐
                          │  Read Replica    │
                          │  (Same Schema)   │
                          └────────┬─────────┘
                                   │ direct queries
                          ┌────────┴─────────┐
                          │  BI / Dashboards  │
                          └──────────────────┘
```

This is a feasible fit when reporting needs are straightforward, the production schema is close enough to what reporting consumers need, and data that's a few seconds stale is acceptable. "A few seconds stale" is the optimistic case, though. Heavy analytical queries on the replica can cause replication lag to spike well beyond that, especially during peak reporting windows.

The replica breaks down when reporting needs diverge far enough from the production schema's shape. Reporting consumers write increasingly complex queries with multiple joins, or they start requesting schema changes to production to make their queries simpler, which is exactly the distortion this post is about. The replica can't capture intermediate transitions. It reflects whatever state the database holds at query time, so if a record changes twice between one poll and the next, the intermediate state is gone.

### Change Data Capture: State History Without Intent

CDC tools like Debezium tap the database's transaction log and emit changes as events without any application code changes. The application writes normally to whatever schema makes sense, and CDC streams those changes to a separate store. The stream is async by default, and unlike the replica approach, CDC captures every intermediate state change because it reads from the transaction log rather than polling snapshots.

```
  ┌─────────────┐         ┌─────────────────┐
  │ Application │────────>│  Production DB   │
  └─────────────┘  writes └────────┬─────────┘
                                   │ transaction log
                                   v
                          ┌─────────────────┐
                          │  CDC Connector   │
                          │  (e.g. Debezium) │
                          └────────┬─────────┘
                                   │ change events
                                   v
                          ┌─────────────────┐
                          │  Stream / Queue  │
                          │  (Kafka, Kinesis)│
                          └────────┬─────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     v                           v
            ┌────────────────┐          ┌────────────────┐
            │  Transform (T) │          │  Schema        │
            │  Reshape/Join  │          │  Registry      │
            └───────┬────────┘          └────────────────┘
                    v
            ┌────────────────┐
            │ Reporting Store│
            │ (Warehouse/DL) │
            └────────────────┘
```

CDC's greatest strength is that it requires no application code changes, no additional transaction overhead, and no new abstractions in the write path. For legacy systems where the risk of changing the write path is too high, or for teams that need separation now and can't afford to modify every service that writes data, CDC is often the only viable option. It also solves payload completeness for free: the transaction log captures the full row state after each write, regardless of whether the application only updated a single field.

The first limitation is semantic. CDC events originate from the database layer, so they capture *what* changed but not *why* it changed. A row update that represents a customer canceling an order looks identical to a row update that represents a system correcting a data entry error. The database can't distinguish between them because it only sees the state change, not the business intent. For financial ledgers or audit-critical workflows, where intent is as important as state, event sourcing is the appropriate tool because it captures the intent as the primary record.

The second limitation is the absence of a contract boundary. The table structure *is* the contract, implicitly. When that schema changes, nothing fails at build time. The CDC pipeline either silently emits differently shaped events or breaks at runtime, and reporting consumers discover the problem in production rather than in development. A schema registry can partially close this gap by enforcing compatibility rules at deserialization, but that's added infrastructure catching incompatibility at runtime rather than at build time.

The third limitation is database dependency. PostgreSQL and DynamoDB have mature CDC options, but weaker change stream capabilities can push teams toward application-layer alternatives earlier than expected.

## Intentional Separation

Reactive approaches separate the workload but not the context: they capture *what* changed, not *who* changed it or *why*. That context exists at the application layer when the write happens, and it's lost the moment the data hits the database unless someone deliberately captures it.

### The Outbox Pattern

The outbox pattern makes the application responsible for producing reporting-quality records. Instead of letting the database schema define the downstream contract implicitly, the application writes a versioned record to an outbox table within the same database transaction as the domain state change. Either both commit or neither does, so consistency is guaranteed. A separate process reads from the outbox and projects into whatever reporting store analytics needs. The application controls the payload shape, the versioning, and the context included in each record.

```
  ┌─────────────┐
  │ Application │
  └──────┬──────┘
         │ single transaction
         v
  ┌──────────────────────────────────────┐
  │          Production DB               │
  │                                      │
  │  ┌──────────────┐  ┌──────────────┐  │
  │  │ Domain Table  │  │ Outbox Table │  │
  │  │ (orders,      │  │ (versioned   │  │
  │  │  customers)   │  │  records)    │  │
  │  └──────────────┘  └──────┬───────┘  │
  └───────────────────────────┼──────────┘
                              │ poll / stream
                              v
                     ┌─────────────────┐
                     │ Relay Process   │
                     │ (reads outbox)  │
                     └────────┬────────┘
                              │ publish
                              v
                     ┌─────────────────┐
                     │ Reporting Store │
                     └─────────────────┘
```

**Outbox table via a relational database:**

```sql
CREATE TABLE outbox (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        UUID          NOT NULL DEFAULT gen_random_uuid(),  -- globally unique, used downstream
    aggregate_type  VARCHAR(100)  NOT NULL,  -- e.g. 'Order', 'Customer'
    aggregate_id    VARCHAR(100)  NOT NULL,  -- e.g. order ID
    event_type      VARCHAR(100)  NOT NULL,  -- e.g. 'OrderCancelled'
    schema_version  INT           NOT NULL,  -- contract versioning
    occurred_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    initiated_by    VARCHAR(200),            -- who: user ID, system name
    reason          VARCHAR(500),            -- why: 'customer_request', 'admin_override'
    payload         JSONB         NOT NULL,  -- full state snapshot + context
    published       BOOLEAN       NOT NULL DEFAULT FALSE
);
```

**Outbox record via a Kinesis/Kafka stream (JSON envelope):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "aggregateType": "Order",
  "aggregateId": "ORD-20260218-4417",
  "eventType": "OrderCancelled",
  "schemaVersion": 2,
  "occurredAt": "2026-02-18T14:32:08.771Z",
  "initiatedBy": "user:jsmith",
  "reason": "customer_request",
  "payload": {
    "orderId": "ORD-20260218-4417",
    "customerId": "CUST-8821",
    "previousStatus": "Confirmed",
    "newStatus": "Cancelled",
    "lineItems": 3,
    "totalAmount": 284.50,
    "currency": "USD"
  }
}
```

The outbox has an explicit, versionable contract boundary. The application decides what the downstream record looks like and versions it independently. A breaking change to the outbox record is a code change that has to compile, pass tests, and go through review. If a developer renames a column in the production schema, the outbox record doesn't change unless someone deliberately updates it. And because the outbox doesn't rely on transaction log capabilities or vendor-specific change feed APIs, any database that supports transactions supports the pattern.

The outbox does not require a record for every database write. It only fires when a specific entity type has a meaningful state change, and only for the types that reporting cares about. Background jobs updating internal timestamps produce nothing. Even deletions produce a record, because knowing that an entity was removed and who removed it is itself meaningful. This keeps the coupling concentrated in write paths that produce meaningful state transitions, not spread across every query and update in the codebase.

For most teams that have outgrown a read replica but don't need full event sourcing, the outbox is my recommendation. It provides intentional separation, explicit contracts, and rich context without the architectural commitment of an append-only event store.

### CQRS and Event Sourcing

CQRS (Command Query Responsibility Segregation) formally separates the write model from the read model. The write side accepts commands and persists state. The read side maintains whatever views consumers need, shaped however they need them, updated as fast or as lazily as the use case demands. The two sides share no schema and no storage. What CQRS adds is the explicit acknowledgment that "what happened" and "what is the current state" are different questions that deserve different models. CQRS does not require event sourcing. It can sit in front of a traditional stateful database where the write side persists state normally and the read side maintains separate, denormalized views optimized for queries.

Event sourcing takes this further by changing what the write side stores. Instead of persisting current state and producing reporting records alongside it, every state mutation is recorded as an immutable event, and current state is derived by replaying those events. The event log becomes the source of truth, not the current snapshot. Nothing is overwritten. Every transition is preserved in the order it occurred. Production state is a projection of the event stream, and so is reporting state, and so is any other view you need. If the analytics team changes their requirements six months from now, you replay the same events through a new projection and the full history is there.

```
                          Commands
                              │
                              v
                     ┌─────────────────┐
                     │   Write Side    │
                     │ (Command Handler│
                     │  + Aggregates)  │
                     └────────┬────────┘
                              │ append events
                              v
                     ┌─────────────────┐
                     │  Event Store    │
                     │  (append-only)  │
                     └────────┬────────┘
                              │ project
                              v
                     ┌─────────────────┐
                     │  Projected      │
                     │  State Tables   │
                     │  (per entity)   │
                     └────────┬────────┘
                              │ query (read side)
              ┌───────────────┼───────────────┐
              v               v               v
     ┌────────────┐  ┌─────────────┐  ┌────────────────┐
     │  Prod API  │  │  Reporting  │  │  Audit /       │
     │  Queries   │  │  Store      │  │  Compliance    │
     └────────────┘  └─────────────┘  └────────────────┘
```

**Event store document (append-only, NoSQL):**

```json
{
  "streamId": "Order-ORD-4417",
  "position": 4,
  "eventType": "OrderCancelled",
  "occurredAt": "2026-02-18T14:32:07Z",
  "payload": {
    "initiatedBy": "user:jsmith",
    "reason": "customer_request",
    "previousStatus": "Shipped",
    "newStatus": "Cancelled",
    "lineItems": 3,
    "totalAmount": 284.50,
    "currency": "USD"
  },
  "metadata": {
    "correlationId": "req-88a1c",
    "causationId": "cmd-cancel-4417",
    "userId": "user:jsmith"
  }
}
```

**Projected state table (derived from events, used by reporting/ETL):**

```sql
CREATE TABLE order_projections (
    order_id         VARCHAR(100) PRIMARY KEY,
    customer_id      VARCHAR(100) NOT NULL,
    current_status   VARCHAR(50)  NOT NULL,
    item_count       INT          NOT NULL,
    total_amount     DECIMAL(12,2) NOT NULL,
    currency         VARCHAR(3)   NOT NULL,
    placed_at        TIMESTAMPTZ,
    shipped_at       TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    cancelled_by     VARCHAR(200),
    cancel_reason    VARCHAR(500),
    last_event_pos   INT          NOT NULL,  -- tracks replay position
    projected_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

In practice, reporting consumers rarely subscribe to the event stream directly. Event sourcing produces projected state tables, one per entity, where each row represents the current state derived from the event history. Reporting and ETL pull from these projections rather than from raw events. This keeps the event stream internal to the domain, which matters because not everything in the stream is a clean domain event. The projections give reporting consumers a familiar, queryable surface while the event stream retains full history for replay and audit.

This is a good fit for domains where the complete history of state transitions is genuinely valuable, like financial ledgers, audit-critical workflows, or systems where "undo" and "replay" are first-class requirements. The combination of event sourcing and CQRS provides the most complete separation: full history, arbitrary projections, and independent evolution of read and write models.

Most teams should not reach for this combination. Martin Fowler has [warned consistently](https://martinfowler.com/bliki/CQRS.html){:target="_blank" rel="noopener noreferrer"} that CQRS is misapplied far more often than it's applied well. Many systems fit a CRUD mental model and should stay that way. CQRS should only apply to specific bounded contexts where the read and write access patterns are genuinely different, not across entire applications. Event sourcing compounds the cost: events are immutable and permanent so schema design requires careful thought, aggregate replay gets expensive without snapshotting, and debugging production issues means reasoning about event sequences rather than inspecting current state.

## Choosing an Approach

| Approach | Use when | Key limitation | Complexity |
|---|---|---|---|
| Read replica | Schema shape is close to what reporting needs; slight staleness is acceptable | Replication lag under analytical load; no intermediate state history | Low |
| CDC (e.g. Debezium) | Write path can't be modified; full row history is needed | Captures state, not business intent; table structure is an implicit contract | Medium |
| Outbox pattern | Business context (who/why) matters; write path can be modified | Each tracked entity requires application updates; relay process and versioning discipline needed | Medium |
| CQRS + Event Sourcing | Audit-critical domain; "undo" and "replay" are first-class requirements | Events are permanent; aggregate replay is expensive without snapshotting | High |

## Separate Early or Pay Later

A read replica is enough to start, but every shortcut that ties these workloads together makes the eventual separation harder. The analytics team and the application team end up negotiating every schema change, and the production schema accumulates the concerns of whoever complained most recently.

The central question for choosing an approach is whether reporting consumers need to know *why* something changed, not just *what* changed. If current state is enough, a replica or CDC pipeline will serve. If intent matters (who acted, why, under what conditions), the write path has to capture it deliberately, because the database layer never will. Once the two workloads have separate schemas, neither team has to wait on the other.
