---
layout: guide
title: "Distributed SQL (NewSQL) Databases"
category: Databases
subcategory: Database Types
description: "How distributed SQL databases like Spanner, CockroachDB, and TiDB keep SQL and ACID transactions while sharding and replicating across nodes, what that costs in latency, and when a single relational server is still the better choice."
tags: [distributed-sql, newsql, sharding, distributed-transactions, spanner, advanced]
---

## What They Are

Distributed SQL databases, also called NewSQL, keep the relational model, SQL, and ACID transactions, and spread the data across many nodes so that capacity grows by adding servers. They target a specific gap: applications that outgrew a single relational server but can't give up transactions for an eventually consistent store.

Sharding MySQL or PostgreSQL by hand is possible but painful. Transactions across shards are no longer atomic, foreign keys between shards can't be enforced, some queries have to be run on every shard and combined in application code, and moving data between shards as they fill up is a project of its own. Distributed SQL databases do the sharding, replication, and cross-shard transactions inside the database and present what looks like one ordinary SQL database.

The term NewSQL dates from 2011 and originally covered several kinds of scalable SQL systems. Google's Spanner paper (2012) set the pattern most of today's products follow, and "distributed SQL" is the name most of them use now.

---

## Data Structure

```
LOGICAL VIEW (what the application sees):

  orders                                     one SQL table
  ┌────────┬─────────────┬─────────┬────────────┐
  │ id     │ customer_id │ total   │ created_at │
  ├────────┼─────────────┼─────────┼────────────┤
  │ 1      │ 100         │ 99.99   │ 2026-01-15 │
  │ 2      │ 101         │ 45.50   │ 2026-01-16 │
  │ ...    │ ...         │ ...     │ ...        │
  └────────┴─────────────┴─────────┴────────────┘

PHYSICAL VIEW (how it's stored):

  The table is split into ranges by key, and each range is
  replicated to three nodes with a consensus protocol.

              Node 1          Node 2          Node 3          Node 4
  Range A   [ leader ]      [ replica ]     [ replica ]
  Range B                   [ leader ]      [ replica ]     [ replica ]
  Range C   [ replica ]                     [ leader ]      [ replica ]

  A write to Range A commits once two of its three replicas have it.
  Losing any one node loses no data, and each range stays available.

Query: BEGIN;
       INSERT INTO orders (customer_id, total) VALUES (100, 50.00);
       UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 5;
       COMMIT;
       → one ACID transaction, even if the order row and the inventory
         row live in different ranges on different nodes
```

---

## How They Work

### Automatic Sharding

Tables are split into pieces, called ranges in CockroachDB and regions in TiDB, either by contiguous key ranges or by a hash of the key. The database splits a piece when it grows or gets busy and moves pieces between nodes to balance load, so the application never implements sharding logic. With range splitting, sequential keys such as timestamps or auto-incrementing IDs all land in the last range and turn one node into a hotspot, so these databases recommend random or hashed keys.

### Replication by Consensus

Each piece is replicated to several nodes, usually three or five, using Raft or Paxos. A write commits once a majority of that piece's replicas have it. A node failure costs no committed data and no downtime, because the remaining majority carries on and elects a new leader for any pieces the failed node led.

### Distributed Transactions

A transaction that touches several pieces has to commit on all of them or none. These databases run a two-phase commit across the pieces involved, with each piece's part of the commit itself replicated by consensus, so the coordinator failing doesn't leave the transaction stuck the way classic two-phase commit can. Ordering transactions consistently across nodes needs agreement about time. Spanner's TrueTime uses GPS receivers and atomic clocks in Google's data centers to bound clock uncertainty and waits out that uncertainty at commit. CockroachDB and YugabyteDB instead use hybrid logical clocks on ordinary servers, combined with checks that restart a transaction when clock uncertainty makes its order ambiguous.

### Isolation Defaults

Distributed SQL databases tend to default to stronger isolation than single-server ones. Spanner and CockroachDB default to Serializable, while TiDB defaults to snapshot isolation under the name Repeatable Read. Code moved from a Read Committed database gains protection, and it also meets more transaction retries under contention, which the application has to handle.

### SQL Compatibility

Most products speak an existing wire protocol and dialect. CockroachDB and YugabyteDB are PostgreSQL-compatible, and TiDB is MySQL-compatible, so existing drivers, ORMs, and tools mostly work. Compatibility is partial, though. Features that assume one machine, such as sequences that hand out gap-free increasing numbers, triggers, and some extensions, behave differently or are missing, so migrations need testing rather than a connection-string change.

---

## Why They Excel

### Scale Without Giving Up Transactions

Capacity for both reads and writes grows by adding nodes, and the application keeps SQL, joins, constraints, and multi-row transactions.

### Resilience

With every piece replicated by consensus, losing a node or, with replicas spread across zones or regions, a whole zone or region loses no committed data, and failover is automatic.

### Data Placement Across Regions

Several products can pin rows to regions, such as keeping European customers' data in European data centers, which serves both latency and data-residency requirements while the application still sees one database.

---

## Why They Struggle

### Latency

Every write waits for a majority of replicas, and a transaction that spans pieces adds a commit round. Within one region that's a few milliseconds. With replicas spread across distant regions, each write pays cross-region round trips. Features like follower reads, which serve slightly stale reads from a nearby replica, and region-pinned tables reduce this, but a single-server database on local disk is faster for any one query.

### Contention

Transactions that update the same rows conflict across nodes, and under Serializable isolation the losers retry. Workloads with hot rows, such as a single counter every request increments, scale poorly here.

### Operational Complexity and Cost

A cluster of at least three nodes, usually more, costs more and has more to understand than a single server, and query performance now depends on data placement. Managed services absorb much of the operational work but not the cost.

---

## When to Use Them

Distributed SQL fits applications that:

- Have outgrown a single relational server, or will soon, and still need transactions, as in payments, orders, and inventory
- Serve users in several regions and need consistent data, or need to keep some data in specific regions
- Need to survive the loss of a node, zone, or region without losing data or failing over by hand

---

## When to Look Elsewhere

If your data and write load fit on a single server with replicas, a traditional relational database is simpler, cheaper, and faster per query, and most applications never outgrow one. If eventual consistency is acceptable, a wide-column or key-value store may be cheaper at very large scale. If the workload is mostly analytical, a columnar warehouse is the right tool.

---

## Examples

**Google Spanner**, available as Cloud Spanner, is the system whose design most of the category follows, with TrueTime and external consistency, the strictest form of serializability. **CockroachDB** is PostgreSQL-compatible and built for surviving failures across zones and regions. **TiDB** is MySQL-compatible and separates SQL processing from its TiKV storage layer, with an optional columnar replica for analytics. **YugabyteDB** offers a PostgreSQL-compatible API and a Cassandra-compatible one on the same distributed storage. **Vitess**, the MySQL sharding system that PlanetScale runs as a service, takes a different route: it shards ordinary MySQL servers behind a routing layer rather than building a new storage engine.

---
