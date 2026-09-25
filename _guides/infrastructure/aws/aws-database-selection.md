---
title: "Choosing an AWS Database"
layout: guide
category: AWS
subcategory: Database Services
description: "How to choose where a workload's data lives on AWS: relational first, when DynamoDB or Aurora DSQL fits better, caches versus MemoryDB, the purpose-built engines (DocumentDB, Neptune, Keyspaces, Timestream, OpenSearch), vectors, analytics copies, and what a second store costs."
tags: [database-selection, purpose-built-databases, aurora-dsql, memorydb, zero-etl, polyglot-persistence, practical]
---

## Questions That Narrow the Choice

AWS runs more than a dozen database services, and most workloads are served by a relational database, DynamoDB, or one of them behind a cache. The choice rests on a handful of questions about the data and how it's used, asked before any service name comes up:

| Question | Why it narrows the choice |
|---|---|
| **Are the queries known in advance?** | A store built around its keys, like DynamoDB, answers only the questions it was designed for. A relational database answers new ones with a new query. |
| **How far do transactions reach?** | Updating many rows across tables atomically is what relational engines do best. Key-value stores support smaller, bounded transactions. |
| **What shape is the data?** | Rows, documents, graphs of relationships, time-stamped measurements, and text to search each have an engine built around them. |
| **How much must it write?** | A database with one writer grows write throughput by moving to a larger instance. A distributed store spreads writes across many servers. |
| **How fast must reads be?** | Memory answers in microseconds, SSD-backed stores in milliseconds. Latency below a millisecond means an in-memory engine somewhere in the path. |
| **Where must it be reachable from?** | Some services place nodes in your subnets. Others are Regional endpoints outside your VPC. |

Every service in this guide is Regional, and its quotas are per account per Region. The last question shapes networking and security more than it first appears to:

- **In your VPC.** RDS, Aurora, DocumentDB, Neptune Database, ElastiCache, MemoryDB, and Timestream for InfluxDB place database nodes in your subnets, including their serverless variants. Clients reach them on the database port, and a security group decides which clients can.
- **Regional endpoints.** DynamoDB, Keyspaces, and Aurora DSQL run outside your VPC. Clients connect over TLS, using DynamoDB's HTTPS API, Cassandra drivers for Keyspaces, or PostgreSQL drivers for DSQL. IAM authorizes each request or connection. A VPC endpoint keeps that traffic off the internet.

---

## Relational Is the Default

Start with a relational database unless something specific rules it out. SQL answers questions nobody planned for, joins keep related data in one place without copying it, constraints keep bad data out, and a transaction can change many rows in many tables or none of them. Most teams already know how to design, query, and operate one. When the access patterns of a new application are still moving, that flexibility is worth more than any scaling property.

On AWS that means RDS or Aurora, and for MySQL or PostgreSQL either runs the same application. What limits them is the write path. Each database has one writer instance, so write throughput and connection count grow by moving to a larger instance class, while reads scale out through replicas. Most applications never reach that ceiling. The ones that do tend to find out through a write-heavy workload, a very large number of short-lived connections (from Lambda, for example), or a need to accept writes in more than one Region.

For the first two, and for load that swings, Aurora and RDS have options that keep full MySQL or PostgreSQL compatibility:

- **Aurora Serverless** resizes the writer's capacity with load, so a database whose traffic swings needs no instance sizing.
- **Aurora PostgreSQL Limitless Database** (generally available since October 2024) shards tables across several writer instances behind one endpoint, for write volumes beyond the largest instance.
- **RDS Proxy**, a managed connection pooler, lets thousands of short-lived clients share a small pool of database connections.

Writing in more than one Region is harder. **Aurora Global Database** copies a cluster to other Regions asynchronously, but only one Region takes writes.

### Aurora DSQL: Relational Without a Single Writer

**Amazon Aurora DSQL** (generally available since May 2025) is a serverless, PostgreSQL-compatible distributed SQL database. There's no instance to size and no primary. It spreads data and transactions across servers on its own and scales reads, writes, and storage independently. A multi-Region cluster accepts reads and writes at every Regional endpoint with strong consistency, and it's designed for 99.999% availability across Regions (99.99% in one).

The trade is that DSQL isn't PostgreSQL underneath, and the differences show up in application code:

- It uses **optimistic concurrency control**. Transactions don't lock rows. Instead, DSQL checks for conflicts at commit and fails the later transaction with a serialization error, so the application must retry. Keys that many transactions update at once, like a shared counter, turn into constant retries.
- Isolation is fixed at repeatable read, where each transaction reads from one snapshot taken when it starts.
- A transaction can modify at most 3,000 rows, and schema changes (DDL) can't share a transaction with data changes (DML).
- There are no temporary tables, triggers, or PL/pgSQL procedures, and a cluster holds one database. Connections last at most an hour.

DSQL suits a new application that wants SQL, needs multi-Region writes or no capacity planning, and can keep its transactions short. An existing PostgreSQL application that leans on locking, stored procedures, or large batch updates is usually better served by Aurora.

---

## When DynamoDB Fits Better

DynamoDB gives up query flexibility for three things a relational database can't match:

- **No fixed write ceiling.** A table is split into partitions, slices of its data each with their own throughput, and it adds partitions as traffic and data grow. Writes scale as long as the keys spread them across partitions. The per-table quota, 40,000 write units per second by default, can be raised.
- **No connections to manage.** Every request is an independent HTTPS call, which suits Lambda and other short-lived compute.
- **No capacity to size.** In on-demand mode a table bills per request, so an idle table costs only its storage.

It's the better primary store when all of these hold:

- The application's questions are known and stable, so the table can be designed around them.
- Each request touches one item or one small group of related items, not a join across entities.
- Transactions are small. DynamoDB supports them, but across at most 100 items, and each item costs twice the usual capacity.
- Scale, spiky traffic, or zero operations matter more than ad-hoc queries.

DynamoDB is also the other answer to multi-Region writes. **Global tables** keep a replica of a table in several Regions, each accepting writes. They replicate asynchronously by default, and since June 2025 a global table spanning three Regions can be strongly consistent instead.

When the questions aren't settled yet, or reporting needs to slice data in ways nobody designed for, a relational database fits better. Reporting over DynamoDB data belongs in an analytics copy (see below), not in scans of the table.

---

## Caches in Front, MemoryDB Alone

An in-memory engine answers in microseconds where a disk-backed database takes milliseconds. How it's used decides which service fits.

**A cache sits in front of a database.** ElastiCache runs the Valkey, Redis OSS, or Memcached engine and holds copies of data whose source of truth lives elsewhere, so losing a key costs a trip to the database, not the data. That's the usual answer when a relational database is overloaded by repeated reads, and it's cheaper than scaling the database for them. DynamoDB has its own cache, **DAX**, which speaks the DynamoDB API and stays current without invalidation code as long as every write goes through it. It caches only eventually consistent reads, the default kind, which can miss a write made in the last second or so.

**MemoryDB is a primary database.** It speaks the same Valkey and Redis OSS commands as ElastiCache, but every write is committed to a transaction log stored across several Availability Zones before it's acknowledged. A node failure loses no acknowledged write. Reads take microseconds and writes take single-digit milliseconds, because each waits for the log. It suits data that needs Valkey's structures, like sorted sets for leaderboards or streams, and must survive on its own without a database behind it. ElastiCache for Valkey can now add durability to node-based clusters too, so the line between them is thinner than it was. MemoryDB remains the one built to be the only copy.

---

## Purpose-Built Engines

When the data has a shape a general-purpose store handles badly, AWS offers an engine built around it. Reach for one when that shape dominates the workload, not when it appears in one corner of it.

| Data shape | Service | What it is | Watch for |
|---|---|---|---|
| **JSON documents, MongoDB applications** | DocumentDB | MongoDB-compatible document database. Instance-based clusters separate compute from one replicated storage volume, as Aurora does. Elastic clusters split data across shards, each with its own writer, for more write throughput. A serverless option (since July 2025) scales capacity automatically. | It implements the MongoDB API, not MongoDB. Check that the operators and features your application uses are supported before migrating. |
| **Highly connected data** (fraud rings, recommendations, identity graphs) | Neptune | Graph database. **Neptune Database** serves transactional graph queries in Gremlin, openCypher, or SPARQL. **Neptune Analytics** loads a graph into memory for algorithms and vector search, queried with openCypher. | Worth it when queries follow relationships several hops deep. One-hop lookups are ordinary joins. |
| **Wide-column, Cassandra applications** | Keyspaces | Serverless, Cassandra-compatible, queried with Cassandra's query language (CQL), billed per request or by provisioned capacity. | Not every Cassandra feature exists, so check compatibility before migrating. A new workload with no Cassandra code to keep is usually weighed against DynamoDB, which serves the same key-based access. |
| **Time-stamped measurements** (metrics, sensor readings) | Timestream for InfluxDB | Managed InfluxDB in your VPC. InfluxDB 2 runs on single instances with optional Multi-AZ standbys. InfluxDB 3 (since October 2025) comes as open-source Core on one node or Enterprise on multi-node clusters. | **Timestream for LiveAnalytics**, the serverless variant, closed to new customers on June 20, 2025. |
| **Full-text search, faceting, log analytics** | OpenSearch Service | Managed OpenSearch clusters, or OpenSearch Serverless. | It's a search index, not a system of record. Feed it from the primary store. |

Two needs that used to have their own answer no longer do:

- **Vectors.** Embeddings, the numeric vectors used for similarity search, can live in the store you already run. Aurora and RDS for PostgreSQL support the `pgvector` extension, DynamoDB has vector indexes, MemoryDB, OpenSearch, and Neptune Analytics search vectors, and S3 Vectors stores them cheaply at large scale. Keep embeddings next to the data they describe unless the vector volume or the search features you need push you to a dedicated engine.
- **Ledgers.** Amazon QLDB reached end of support on July 31, 2025. AWS points ledger and audit workloads to Aurora PostgreSQL with audit logging, which records history but loses QLDB's cryptographic proof that the history wasn't altered.

---

## Analytics Belongs in a Separate Copy

The databases above store data by row or by item, which makes fetching one record fast and scanning millions of them slow and expensive. Dashboards, reports, and ad-hoc analysis belong on an analytics store instead, such as Redshift for a warehouse or Athena for SQL over files in S3. Run against the operational database, they compete with the application for the same capacity.

Moving the data no longer needs a pipeline for the common sources. **Zero-ETL integrations** replicate Aurora MySQL and PostgreSQL, and RDS for MySQL, PostgreSQL, and Oracle, into Redshift continuously, typically seconds behind the source after an initial load. The DynamoDB integration copies changes every 15 to 30 minutes. DynamoDB can also export a table to S3 for Athena without consuming table capacity.

---

## Adding a Second Store

Real systems often combine stores. An order service keeps orders in Aurora, a product catalog sits behind ElastiCache, a search box queries OpenSearch, and finance reads from Redshift. That's sound when each store does a job the primary can't. It goes wrong when data is written independently to two stores that are both treated as the truth, because nothing then keeps them in agreement.

The pattern that holds up has one **source of truth** per piece of data, with every other store a **derived copy** fed from it:

- **Change streams.** DynamoDB Streams, or change data capture from a relational database through AWS DMS, deliver each change to a consumer that updates the copy.
- **Managed integrations.** Zero-ETL into Redshift, and DynamoDB into OpenSearch through OpenSearch Ingestion, handle the replication for you.
- **Cache-aside.** The application fills the cache on a miss and sets a TTL, so stale entries expire on their own.

{% include figure.html id="aws-db-derived-copies" %}

Every derived copy lags its source, by anything from seconds to tens of minutes, so a read from it can miss a write the user just made. Each store also adds a service to secure, monitor, back up, pay for, and learn. A second store earns its place when the job it does is worth all of that. A primary that could do the job with an index, an extension, or a read replica usually wins.

---

## How the Bill Behaves

The services bill in two shapes, and the shape matters as much as the rate:

- **Per request or per unit of work.** DynamoDB on-demand, Keyspaces, and Aurora DSQL charge for what each request does, so the bill rises and falls with traffic and an idle database costs only its storage.
- **Per hour of capacity.** Instance-based databases charge for the instance whether it's busy or not, which buys a fixed amount of throughput. Aurora Serverless, ElastiCache Serverless, and DocumentDB Serverless sit between the two, billing hours of capacity that resize with load.

For a small or bursty workload, paying per request usually wins. For heavy, steady traffic, compare the per-request bill against provisioned capacity or an instance before assuming serverless is cheaper.

**Database Savings Plans** apply one hourly commitment across Aurora, RDS, Aurora DSQL, DynamoDB, ElastiCache for Valkey, DocumentDB, Neptune, Keyspaces, Timestream, OpenSearch Service, and DMS, so adding a store from that list doesn't fragment a commitment. MemoryDB and Redshift sit outside it and use reserved nodes instead.

---

## Choosing Wrong Costs Most Across Models

A decision within one model is cheap to revisit. Moving an RDS MySQL or PostgreSQL database to Aurora, changing an instance size, or turning on Aurora Serverless keeps the schema and the queries. A decision across models is expensive. Moving from a relational database to DynamoDB means redesigning the data around access patterns and rewriting every query, and moving back means rebuilding the joins and constraints the application learned to live without. AWS DMS moves the data either way, but it can't redesign the model. That asymmetry is the reason to default to relational and move to another model only for a reason you can name.

---

## Putting It Together

```
What is the data for?
│
├─ Operational records the application reads and writes
│  ├─ Queries still evolving, joins, multi-table transactions
│  │  ├─ One writing Region ──────────────────────────────── RDS or Aurora
│  │  │  (Aurora Serverless for swinging load,
│  │  │   Limitless Database beyond one writer)
│  │  └─ Writes in several Regions, short transactions ───── Aurora DSQL
│  ├─ Known access patterns, huge or spiky scale ──────────── DynamoDB
│  │  └─ Writes in several Regions ───────────────────────── DynamoDB global tables
│  └─ Dominant special shape
│     ├─ MongoDB documents ────────────────────────────────── DocumentDB
│     ├─ Multi-hop relationships ──────────────────────────── Neptune
│     ├─ Existing Cassandra application ───────────────────── Keyspaces
│     └─ Time-stamped measurements ────────────────────────── Timestream for InfluxDB
│
├─ Data held in memory
│  ├─ Copies of data stored elsewhere ─────────────────────── ElastiCache (or DAX for DynamoDB)
│  └─ Valkey data structures that must be the only copy ───── MemoryDB
│
├─ Text search over records stored elsewhere ──────────────── OpenSearch Service
│
└─ Analysis across many records ───────────────────────────── Redshift or Athena
                                                               (fed by zero-ETL or exports)
```

---

## Key Takeaways

- Choose from the queries, transactions, data shape, write volume, latency, and reachability the workload needs, not from the list of services.
- Default to RDS or Aurora. Leave relational for a reason you can name, since moving between data models is the costly mistake.
- Aurora Serverless and Limitless Database stretch Aurora past load swings and one writer. Aurora DSQL is relational with strongly consistent multi-Region writes, at the price of optimistic concurrency, short transactions, and missing PostgreSQL features.
- DynamoDB fits when access patterns are known and scale, spiky traffic, or zero operations matter more than ad-hoc queries. Global tables give it multi-Region writes.
- ElastiCache and DAX speed up data that lives elsewhere. MemoryDB is the in-memory engine built to be the only copy.
- Pick a purpose-built engine when a data shape dominates the workload. Vectors usually belong in the store you already run, and QLDB is gone.
- Keep analytics on a separate copy fed by zero-ETL or exports, and give every piece of data one source of truth with derived copies downstream.
