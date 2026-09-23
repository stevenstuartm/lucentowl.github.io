---
layout: guide
title: "Database Fundamentals"
category: Databases
subcategory: Database Foundations
description: "What databases do, the main data models and the workloads they serve, normalization and schema trade-offs, and how to choose, combine, and migrate between database types."
tags: [fundamentals, data-modeling, normalization, polyglot-persistence, decision-making, oltp-olap]
redirect_from:
  - /study-guides/database-types.html
  - /study-guides/data/multi-model-databases.html
---

## Why Databases Exist

Applications need to persist data beyond the lifetime of a single process. They need to share data across multiple processes, servers, and users. They need to query data in flexible ways, ensure data isn't lost during failures, and prevent concurrent modifications from corrupting state.

A database is software that solves these problems. It provides durable storage so data survives crashes, concurrent access so multiple users can read and write safely, queries that find data matching specific criteria, and often transactions that group several operations into one all-or-nothing unit.

Without a database, each application would have to build all of this itself, and the hard parts (crash recovery, concurrent writers, efficient lookup) are exactly where hand-built versions tend to go wrong.

---

## Why So Many Database Types Exist

For decades, relational databases were the default choice for nearly every application. They worked well enough for most use cases, but "well enough" started breaking down as applications scaled and data patterns diversified.

Relational databases make specific trade-offs. They enforce schemas, run transactions that either fully commit or leave no trace, and optimize for flexible queries across related tables. Those trade-offs suit some workloads and hurt others.

Consider write throughput. A relational database must maintain indexes, enforce constraints, and coordinate transactions, so every write involves several disk operations. For an e-commerce order system processing hundreds of transactions per second, that overhead is negligible. For a telemetry system ingesting millions of sensor readings per second, it becomes the bottleneck.

Or consider data shape. Relational databases put data into rows with fixed columns. A user profile with varying attributes needs either many nullable columns or several tables joined back together. Some users have phone numbers while others don't, and some have multiple addresses while others have none.

Specialized databases emerged because different problems have different optimal solutions. An engine whose storage is laid out to follow relationships from one record to the next is poorly suited to scanning and aggregating billions of time-stamped metrics, and the reverse holds too.

### The Main Data Models

Each data model fixes what the database understands about your data, and that decides which questions it can answer efficiently.

| Model | What it stores | What it's built to answer |
| --- | --- | --- |
| Relational | Rows in tables with fixed columns, linked by keys | Ad hoc queries and joins across related entities, with strong transactional guarantees |
| Key-value | An opaque value per key | "Give me the value for this key," very fast |
| Document | Self-contained JSON-like documents | "Give me this whole object," plus queries on fields inside it |
| Wide-column | Rows partitioned by key, each with its own set of columns | Very high write volume with reads by partition key |
| Graph | Nodes and the edges between them | Multi-hop traversals across relationships |
| Time-series | Timestamped measurements | Writes in time order and reads over time ranges |
| Search engine | Analyzed text in an inverted index | Relevance-ranked full-text search |
| Vector | High-dimensional embeddings | "Find the items most similar to this one" |

Distributed SQL (NewSQL) databases keep the relational model and change the architecture underneath it, spreading tables across many nodes while keeping transactions.

### Operational and Analytical Workloads

Cutting across the data model is the workload. **Operational (OLTP)** workloads run the application: many small reads and writes, each touching a few rows, with low latency expected. **Analytical (OLAP)** workloads answer business questions: fewer queries, each scanning and aggregating millions of rows.

The two want opposite physical layouts. Row-oriented storage keeps each record together, which suits reading or updating one order at a time. Column-oriented storage keeps each column together, which suits summing one column across every order. Running heavy analytics on the operational database competes with the application for the same resources, which is why analytical data usually moves to a separate warehouse or lakehouse.

---

## Data Modeling Fundamentals

### Normalization

Normalization organizes relational data to reduce redundancy. Instead of storing a customer's address with every order, you store it once in a customers table and reference it by ID. Updates happen in one place and the data can't disagree with itself, at the cost of joins to reassemble it and more complex queries.

The normal forms (1NF, 2NF, 3NF, Boyce-Codd normal form, and the rarer 4NF and 5NF) define progressively stricter rules about which columns may depend on which. Third normal form is the common practical target for transactional schemas.

### Denormalization

Denormalization intentionally introduces redundancy for read performance. Store the customer's name directly in the order record, and displaying an order no longer needs a join.

It pays off for read-heavy workloads with known access patterns, for performance targets that joins can't meet, and in distributed databases where a join would cross nodes or isn't supported at all. The price is that every copy has to be updated when the source changes, and any copy that isn't updated is now wrong.

### Schema-on-Write vs Schema-on-Read

**Schema-on-write**, the relational approach, defines the schema before data goes in, and the database rejects anything that doesn't fit. **Schema-on-read**, the default in document databases and data lakes, stores data without enforcing structure, and the application interprets it when reading.

Schema-on-write catches errors at insert time but requires migrations when the structure changes. Schema-on-read makes change easy but moves validation into every reader, and inconsistent data can accumulate unnoticed. Many document databases now offer optional schema validation, which lets a team choose a point between the two.

---

## Choosing a Database

### Start With Access Patterns

Database selection should flow from access patterns, not the other way around. Four questions narrow the field:

- **How will data be written?** High-volume streams, transactional batches, or user-driven updates?
- **How will data be read?** By primary key, by arbitrary attributes, by time range, or by relationship traversal?
- **What are the consistency requirements?** Must every read reflect the latest write, or is briefly stale data acceptable?
- **What's the expected scale?** Hundreds of gigabytes or petabytes? Thousands or millions of operations per second?

### The PostgreSQL Default

**Start with relational unless you have a specific reason not to.** PostgreSQL covers more use cases than many teams expect:

- `jsonb` columns store and index JSON documents
- The pgvector extension adds vector similarity search
- Full-text search is built in
- The TimescaleDB extension adds time-series partitioning and compression

If you're not sure what you need, PostgreSQL is a safe default. You can add specialized databases later when a specific need emerges.

### Operational Considerations

A database your team can operate well beats a theoretically better one it operates poorly. Weigh the team's experience with the technology, whether a managed service exists to take on patching, backup, and failover, the maturity of its backup, monitoring, and debugging tools, and how easy it is to find help when something goes wrong.

---

## Polyglot Persistence

Many non-trivial applications use more than one database, each chosen for a specific access pattern. A web application might keep orders in PostgreSQL, sessions and cached pages in Redis, and a product search index in Elasticsearch. This pattern is called polyglot persistence.

### Keeping Stores in Sync

The hard part of polyglot persistence is keeping the stores consistent with each other. One store is the system of record, and the others hold copies derived from it.

**Dual writes** have the application write to each store in turn. They're simple, but nothing makes the writes atomic, so a crash or error between them leaves the stores disagreeing with no record of it.

**Change data capture (CDC)** reads the primary database's transaction log and turns each committed change into an event. Debezium is a widely used example. It publishes changes as events, typically to Kafka, and each secondary store consumes that stream. Because the log only contains committed changes, the copies can lag the primary but won't drift from it.

{% include figure.html id="db-cdc-sync" %}

**The transactional outbox** is the application-side alternative. The application writes an event row into an outbox table in the same transaction as the business change, and a separate process publishes those rows. The event exists if and only if the change committed.

**Scheduled sync** periodically copies data from the primary to the secondaries. It's the simplest option, and the copies are stale by up to one full interval.

**Event sourcing** goes further and makes an append-only event log the system of record, with every database building its own view from the events. That changes how the whole application is designed, not just how copies are synchronized.

### Multi-Model Databases as the Alternative

A multi-model database supports several data models in one system, such as documents, graphs, and key-value access over the same underlying data. It trades polyglot persistence's many systems for one.

The appeal is operational. One system to deploy, secure, back up, and monitor is easier than four, and nothing needs to be synchronized between stores. The cost is that an engine serving several models can't optimize as aggressively for any one of them, so a specialized database usually does better at its own workload.

A multi-model database fits when the same data genuinely needs more than one access pattern, such as being queried as documents and traversed as a graph, and operational simplicity matters more than peak performance on either. If you only use one model, the extra models are complexity you pay for without using.

---

## Migrating Between Database Types

### Don't Migrate Prematurely

The operational cost of running a second database type often exceeds the performance benefit until you've actually hit the current database's limits. The signs that you have are specific: you've already tuned queries and indexes and still can't meet requirements, the team spends significant effort working around the database's model, or the access pattern plainly doesn't match what the database was built for.

### Consider Extending Before Replacing

Before a full migration, check whether an extension or a companion store covers the gap. TimescaleDB adds time-series handling to PostgreSQL, pgvector adds vector search, Redis alongside the primary database handles caching, and a search engine alongside it handles full-text search. These approaches keep the existing system of record and often deliver much of the benefit for a fraction of the migration effort.

### Migration Is Never Just Moving Data

When you do migrate, budget for more than data transfer, because query patterns differ between database types. Application code that relied on joins needs restructuring for a document database. Code that relied on multi-row transactions needs compensating logic for an eventually consistent store. The ORM may not support the new database at all.

Plan for four pieces of work:

- Schema redesign for the new data model
- Application code changes
- Testing for behavioral differences, especially around consistency and transactions
- A rollback strategy if problems emerge after cutover

---
