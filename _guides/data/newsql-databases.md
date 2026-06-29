---
layout: guide
title: "NewSQL Databases"
category: Databases
subcategory: Database Types
description: "Deep dive into NewSQL databases—how they combine ACID transactions with horizontal scalability for distributed SQL."
tags: [databases, newsql, distributed-systems, sql, acid, transactions, scalability]
---

## What They Are

NewSQL databases combine the ACID guarantees and SQL interface of traditional relational databases with the horizontal scalability of NoSQL systems. They emerged to address a gap: organizations that outgrew single-server relational databases but couldn't sacrifice transactions for NoSQL's eventual consistency.

Sharding MySQL or PostgreSQL is possible but painful. You lose cross-shard transactions, foreign keys become unenforceable, and some queries become impossible or require application-level coordination. NewSQL databases solve sharding at the database level, presenting a standard SQL interface while distributing data across a cluster.

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NewSQL: Distributed SQL with ACID                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LOGICAL VIEW (what you see):                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  orders (standard SQL table)                                      │ │
│  │  ┌────────┬─────────────┬─────────┬────────────────────────────┐  │ │
│  │  │ id     │ customer_id │ total   │ created_at                 │  │ │
│  │  ├────────┼─────────────┼─────────┼────────────────────────────┤  │ │
│  │  │ 1      │ 100         │ 99.99   │ 2024-01-15                 │  │ │
│  │  │ 2      │ 101         │ 45.50   │ 2024-01-16                 │  │ │
│  │  │ ...    │ ...         │ ...     │ ...                        │  │ │
│  │  └────────┴─────────────┴─────────┴────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼ Automatic sharding                       │
│  PHYSICAL VIEW (how it's stored):                                       │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Node 1    │    │   Node 2    │    │   Node 3    │                 │
│  │  (US-East)  │    │  (US-West)  │    │  (EU)       │                 │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤                 │
│  │ orders:     │    │ orders:     │    │ orders:     │                 │
│  │  id 1-1000  │    │  id 1001-   │    │  id 2001-   │                 │
│  │             │    │  2000       │    │  3000       │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│              Distributed transactions across nodes                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Query: BEGIN;
       INSERT INTO orders (customer_id, total) VALUES (100, 50.00);
       UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 5;
       COMMIT;
       → ACID transaction works even if orders and inventory are on
         different nodes in different regions
```

Standard SQL tables are automatically sharded across nodes. Distributed transactions coordinate across shards transparently. The application sees a single logical database.

---

## How They Work

### Distributed Transactions

The key technical challenge. NewSQL databases use protocols like two-phase commit or variations with better availability characteristics to ensure ACID properties across distributed nodes. Google Spanner famously uses GPS clocks and atomic clocks for its TrueTime API, enabling globally-consistent transactions.

### Automatic Sharding

Data partitions across nodes based on key ranges. The database handles split and merge operations as data grows or hotspots emerge. Applications don't need to implement sharding logic.

### SQL Compatibility

Standard SQL queries work. Existing applications can often migrate with minimal code changes. ORMs and tools that work with PostgreSQL or MySQL work with PostgreSQL-compatible or MySQL-compatible NewSQL databases.

### Distributed Query Execution

Queries that span multiple nodes coordinate automatically. A join between two tables sharded across different nodes happens transparently.

---

## Why They Excel

### Scale + Consistency

The main value proposition. Horizontal scaling without giving up transactions.

### Familiarity

SQL skills transfer, and existing tooling works.

### High Availability

Distributed architecture with replication means no single point of failure.

---

## Why They Struggle

### Latency

Distributed transactions require coordination. A transaction that touches multiple nodes will have higher latency than a single-node transaction.

### Operational Complexity

Running a distributed database cluster is more complex than running a single server.

### Cost

For workloads that don't require horizontal scale, NewSQL adds overhead without benefit.

---

## When to Use Them

NewSQL databases fit applications that:

- Have outgrown single-server relational databases but need ACID transactions (financial systems, e-commerce)
- Are global applications requiring data distribution across regions with consistency
- Are migrations from MySQL/PostgreSQL where maintaining SQL compatibility reduces risk

---

## When to Look Elsewhere

If your data fits on a single server, traditional relational databases are simpler. If eventual consistency is acceptable, NoSQL options may be simpler and cheaper. If your workload is primarily analytical rather than transactional, columnar analytics databases are more appropriate.

---

## Examples

**CockroachDB** is PostgreSQL-compatible with automatic sharding, replication, and survival of datacenter failures.

**TiDB** is MySQL-compatible, separating compute from storage (TiKV) and supporting both OLTP and OLAP workloads.

**YugabyteDB** offers both PostgreSQL and Cassandra-compatible APIs on a distributed SQL foundation.

**Google Spanner** pioneered the category, providing global distribution with strong consistency through TrueTime.

**PlanetScale** offers managed MySQL-compatible database built on Vitess, focusing on developer experience and branching workflows.

---
