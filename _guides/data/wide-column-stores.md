---
layout: guide
title: "Wide-Column Stores"
category: Databases
subcategory: Database Types
description: "How wide-column stores like Cassandra, HBase, and Bigtable organize sparse rows under a partition key, why they absorb huge write volumes, why every table is designed around one query, and what they can't do."
tags: [wide-column, cassandra, partition-key, query-first-modeling, write-throughput, practical]
---

## What They Are

Wide-column stores organize data into rows identified by a key, where each row can hold a different set of columns, potentially thousands of them. A useful mental model is a two-level map: a row key leads to a sorted collection of column-value pairs. The design came from Google's Bigtable paper (2006), which described storing billions of rows across thousands of commodity servers. Apache HBase and Google Cloud Bigtable follow that design closely, while Apache Cassandra and ScyllaDB combined the data model with Amazon Dynamo's leaderless replication.

Despite the name, wide-column stores are not columnar databases. Columnar analytics databases store each column separately so a query can scan one column across billions of rows. Wide-column stores keep a row's data together by key and are built for fast writes and lookups of one key's data at a time. They're closer to key-value stores than to data warehouses.

---

## Data Structure

The two families present the model differently.

**Bigtable and HBase** use a row key, **column families** declared when the table is created, and any number of columns inside each family, created on write. Rows are sparse, so a column with no value takes no space.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TABLE: user_activity  (Bigtable / HBase style)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                    │     FAMILY: profile           │  FAMILY: events        │
│  ROW KEY           ├───────────┬───────────────────┼────────────────────────┤
│                    │  name     │  email            │  (columns per event)   │
├────────────────────┼───────────┼───────────────────┼────────────────────────┤
│  user:alice        │  Alice    │  alice@email.com  │  2026-01-15:login      │
│                    │           │                   │  2026-01-15:purchase   │
│                    │           │                   │  2026-01-16:login      │
├────────────────────┼───────────┼───────────────────┼────────────────────────┤
│  user:bob          │  Bob      │  bob@email.com    │  2026-01-16:login      │
├────────────────────┼───────────┼───────────────────┼────────────────────────┤
│  user:charlie      │  Charlie  │  (no email)       │  2026-01-14:signup     │
│                    │           │                   │  2026-01-15:purchase   │
└────────────────────┴───────────┴───────────────────┴────────────────────────┘
```

**Cassandra and ScyllaDB** present the same idea through tables with a two-part primary key. The **partition key** decides which nodes hold the data, and the **clustering columns** sort the rows inside each partition. A partition can hold millions of rows, which is where the "wide" comes from.

```sql
CREATE TABLE user_events (
    user_id    text,
    event_time timestamp,
    event_type text,
    PRIMARY KEY ((user_id), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);

-- All of alice's recent events, newest first, from one partition
SELECT * FROM user_events
WHERE user_id = 'alice' AND event_time > '2026-01-15';
```

In both families, the key is the primary way in. A lookup or range read by key is fast. A query that doesn't start from the key has no efficient path.

---

## How They Work

### Distribution by Key

Every row's key determines which servers hold it, but the two families split data differently. Cassandra and ScyllaDB hash the partition key, which spreads data evenly across nodes, and every node is a peer that can coordinate any request. HBase and Bigtable instead keep rows sorted by row key and split them into contiguous key ranges, each served by one server, with a master assigning the ranges. Sorted ranges make scans over neighboring keys efficient, and they also mean sequential keys like timestamps all land on one server unless the key is designed to spread them.

### Write Path

Wide-column stores are built on LSM trees. A write is appended to a commit log and an in-memory table and later flushed to disk as an immutable sorted file, so writes are sequential and cheap. Updates and deletes are new entries rather than changes in place, and background compaction merges them away.

### Versions, Timestamps, and TTLs

Every cell carries a timestamp. HBase and Bigtable can keep several timestamped versions of a cell and return the history. Cassandra uses the timestamp to resolve conflicting writes, keeping the latest, and lets each write carry a time-to-live after which the value expires on its own, which suits data that's only useful for a period.

### Tunable Consistency

Cassandra and ScyllaDB replicate each partition to several nodes and let each request choose a consistency level, such as `ONE` for the fastest response or `QUORUM` to wait for a majority of replicas. HBase and Bigtable give strongly consistent reads and writes for each row within a cluster, since one server owns each key range.

---

## Why They Excel

### Scale

Wide-column stores run clusters of hundreds of nodes holding petabytes. Because data is split by key and most operations touch one partition, capacity grows roughly in proportion to the nodes added.

### Write Throughput

The LSM write path turns every write into a sequential append, so these stores absorb very high write volumes, such as millions of sensor readings or messages per second across a cluster.

### Availability

Cassandra and ScyllaDB have no leader or master to fail. Data is replicated across nodes and often across data centers, and at low consistency levels the cluster keeps accepting reads and writes while nodes are down.

### Append-Heavy, Time-Ordered Data

A partition sorted by time is a natural fit for logs, metrics, messages, and activity feeds: new entries append, and the common read is "the latest N entries for this key."

---

## Why They Struggle

### Every Table Is Designed Around One Query

Because queries must start from the partition key, the data model starts from the queries. The usual practice in Cassandra is one table per query pattern, with the same data written to several tables, each keyed for a different read. A question nobody planned for either scans the whole cluster or needs a new table and a backfill.

### Key Design Is Unforgiving

A bad key creates **hot partitions**, where one node takes a disproportionate share of traffic, or partitions that grow without limit and slow every read of them. Keys often add a time bucket, such as `(sensor_id, day)`, to keep each partition bounded.

### No Joins and Limited Transactions

Related data must be denormalized into the same partition or read with separate queries. There are no multi-partition transactions in the relational sense. Cassandra offers lightweight transactions, which give compare-and-set on a single partition at the cost of extra round trips.

### Deletes Are Expensive

A delete writes a marker called a tombstone, and the data isn't removed until compaction runs after a grace period. Workloads that delete heavily, such as using a table as a queue, pile up tombstones that every read has to skip over, and reads slow down.

### Operational Complexity

Running a large cluster takes expertise in capacity planning, repair, compaction tuning, and recovering from node failures. Managed services remove much of that burden.

---

## When to Use Them

Wide-column stores fit well for:

- **Time-series data at large scale**, such as metrics, sensor readings, and financial ticks
- **Activity logs and feeds**, read as "the latest entries for this key"
- **Messaging**, such as chat history and notifications per user or conversation
- **Any workload with very high write volume and a small number of known read patterns**

---

## When to Look Elsewhere

If you need ad hoc queries, joins, or transactions across rows, wide-column stores will fight you. If the data fits comfortably on one server, the operational cost of a cluster isn't worth it. For analytics that scan and aggregate whole columns, a columnar warehouse is the right tool.

---

## Examples

**Apache Cassandra** is the most widely used wide-column store, with leaderless replication, tunable consistency, and multi-data-center support. **ScyllaDB** is a Cassandra-compatible reimplementation in C++ aimed at lower and more predictable latency. **Apache HBase** runs on the Hadoop file system and follows the Bigtable design, and **Google Cloud Bigtable** is Google's managed service built on the original.

---
