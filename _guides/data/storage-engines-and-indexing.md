---
layout: guide
title: "Storage Engines and Indexing"
category: Databases
subcategory: Database Foundations
description: "How databases lay data out on disk: pages, the write-ahead log, B-trees versus LSM trees, row versus column storage, and how indexes speed reads, slow writes, and sometimes go unused."
tags: [storage-engines, indexing, b-tree, lsm-tree, write-ahead-log, columnar, fundamentals]
---

## The Storage Engine Decides What a Database Is Good At

A database has two halves. The query layer parses requests and decides how to answer them. The storage engine underneath decides how bytes are laid out on disk and how they're found again. Most of what makes one database fast at writes and another fast at range scans (reading every key between two values, such as all orders from last week) comes from the storage engine. A few servers let you choose one per table. Percona Server and MariaDB, for example, offer MyRocks, an engine built on RocksDB, alongside the default InnoDB.

Two physical facts drive every design. Disks and SSDs read and write in blocks, so touching one byte costs a whole block. And sequential I/O is much cheaper than random I/O, dramatically so on spinning disks and still noticeably on SSDs. Each engine design below is a different answer to how to turn random application writes into I/O the hardware handles well.

---

## Pages and the Buffer Pool

Most engines store data in fixed-size **pages**: 8 KB in PostgreSQL and SQL Server, 16 KB by default in InnoDB. A page holds many rows, and it's the unit the engine reads from and writes to disk. Reading one row means reading its whole page.

Pages that have been read stay cached in memory in the **buffer pool** (PostgreSQL calls it shared buffers). A query whose pages are already cached never touches the disk, which is why a database's working set, the data its queries touch regularly, fitting in memory matters so much to its performance. A change is first made to the cached page, which is then "dirty" until the engine writes it back.

---

## The Write-Ahead Log

Writing every dirty page to disk before confirming a commit would be slow, because the pages a transaction touches are scattered across the file. Engines instead use a **write-ahead log (WAL)**. Before a change is applied to a page, a record describing it is appended to the log, and a commit is confirmed once its log records are safely on disk.

The appends are sequential, which makes them cheap, and the dirty pages are written back later in the background during **checkpoints**. PostgreSQL calls it the WAL, InnoDB calls it the redo log, and SQL Server calls it the transaction log, but the mechanism is the same.

If the server crashes, recovery replays the log from the last checkpoint and rebuilds any change that hadn't reached its page yet. Engines that update rows in place, such as InnoDB and SQL Server, also use the log or a separate undo log to roll back transactions that were in progress at the crash. PostgreSQL never overwrites a row, so an unfinished transaction's new row versions simply stay invisible.

A log of every change is useful beyond recovery. PostgreSQL and SQL Server replicas stay in sync by replaying the primary's log, and change data capture tools read it to stream committed changes to other systems. MySQL keeps a separate log for this, the binary log, which records changes at a higher level than InnoDB's redo log and is what its replicas and CDC tools read.

---

## B-Trees: Update in Place

The B-tree is the default index structure in PostgreSQL, MySQL's InnoDB, SQL Server, Oracle, and MongoDB's WiredTiger, and in InnoDB, SQL Server clustered tables, and WiredTiger the table itself is stored as one. It's a balanced tree of pages. The root and internal pages hold keys and pointers to child pages, and the leaf pages hold the keys with either the rows themselves or pointers to them. In PostgreSQL, InnoDB, and SQL Server, leaves are linked to their neighbors, so a range scan finds its starting key and then walks sideways.

```
                    [ root: 100 | 500 ]
                   /         |          \
       [ 20 | 60 ]     [ 200 | 350 ]     [ 700 | 900 ]      internal pages
       /   |    \       /    |    \        /    |    \
    leaf ↔ leaf ↔ leaf ↔ leaf ↔ leaf ↔ leaf ↔ leaf ↔ leaf     leaves linked for range scans
```

Because each page holds hundreds of keys, the tree stays shallow. With around 500 keys per page, three levels reach about 125 million entries and four reach tens of billions, so a lookup reads a handful of pages, and the upper levels are almost always cached.

Writes find the right leaf and modify it in place. When a leaf fills up, it splits into two and the parent gains a pointer, which can cascade upward. That in-place update is the B-tree's defining trade-off. Reads are fast and predictable, but each small write dirties a whole page, and inserts that land at random positions in the key space scatter writes across the file.

---

## LSM Trees: Append Now, Merge Later

The **log-structured merge tree (LSM tree)** never updates data in place. Cassandra, ScyllaDB, HBase, and RocksDB use it, and RocksDB in turn sits under many other systems, including TiDB's storage layer, while CockroachDB uses its own LSM engine, Pebble.

A write is appended to the WAL and inserted into a sorted in-memory structure called the **memtable**. When the memtable fills up, it's written to disk in one sequential pass as an immutable sorted file, an **SSTable** (sorted string table). No file is ever modified after it's written. An update is a newer entry for the same key, and a delete is a marker called a **tombstone**.

{% include figure.html id="db-lsm-tree" %}

Left alone, SSTables would pile up and reads would slow down. A background process called **compaction** merges SSTables together, keeping the newest version of each key and discarding overwritten values and deleted keys. Engines differ in how they schedule it. **Leveled compaction**, the default in RocksDB and the arrangement the figure shows, keeps the files within each level below level 0 non-overlapping and merges a file down into the next, larger level, which keeps reads fast at the cost of more rewriting. **Size-tiered compaction**, Cassandra's long-standing default, waits until several files of similar size exist and merges them, which rewrites less but leaves more files for a read to check and more space held by old versions.

Reads pay for the write speed. A point lookup checks the memtable, then SSTables from newest to oldest until it finds the key. To avoid opening every file, SSTables are commonly configured with a **Bloom filter**, a compact structure that can answer "this key is definitely not in this file" without reading it. It occasionally answers "maybe" for a key that isn't there, which costs one wasted file read but never a wrong answer. Standard Bloom filters help point lookups, not general range scans. A range scan has to read the matching key range from the memtable and from every file that could overlap it, merging them as it goes.

### Comparing B-Trees and LSM Trees

| | B-tree | LSM tree |
| --- | --- | --- |
| Write path | Find the page, modify it in place | Append to memtable, flush sequentially |
| Write throughput | Good, limited by random page writes | Tends to be higher, since disk writes are sequential |
| Point reads | One path from root to leaf | May check several files, helped by Bloom filters |
| Latency | Predictable | Compaction runs in the background and can cause latency spikes |
| Space | Pages carry free space after splits and fragment over time | Old versions occupy space until compacted, but sorted immutable files compress well |
| Typical homes | Relational databases and most transactional systems | Write-heavy and distributed engines |

Both designs pay three kinds of overhead, and tuning moves cost between them. **Write amplification** is how many bytes reach the disk per byte the application wrote: a B-tree writes a log record and then a whole page for a small change, and an LSM tree writes a log record, flushes the memtable, and then rewrites the same data at each compaction. **Read amplification** is how many pages or files a read touches. **Space amplification** is how much disk the data takes beyond its logical size. Leveled compaction spends writes to save reads and space, and size-tiered compaction does the reverse. None of the three can be minimized without raising another, which is why the choice is about workload rather than one design being faster overall.

---

## Row and Column Layout

Everything above assumes **row-oriented** storage, where all of a row's columns sit together on the same page. That suits operational workloads, which read or update whole records at a time.

{% include figure.html id="db-row-column-layout" %}

**Column-oriented** storage keeps each column's values together instead. A query that sums `order_total` across a billion orders reads only that column rather than every column of every row. Values in one column tend to resemble each other, so they compress far better, and engines can process them in batches. Data warehouses such as Amazon Redshift, Google BigQuery, and Snowflake store data this way, as do analytical engines like ClickHouse and file formats like Apache Parquet.

The cost is the mirror image. Inserting or updating one row touches every column's storage separately, so columnar systems favor bulk loads over row-at-a-time writes. That split is why operational and analytical workloads usually live in different systems.

---

## Indexes

### What an Index Costs

Without an index, finding the orders for customer 12345 means scanning every row in the orders table. A **secondary index** is a separate structure, usually a B-tree, that maps a column's values to the rows that hold them, so the lookup becomes a short tree walk.

Every index has to be maintained as rows are inserted, updated, and deleted. So each index speeds up the reads that use it and slows down all writes to the table, and it takes disk space and buffer pool memory. An index nobody queries is pure cost.

### Clustered Tables and Heap Tables

Engines differ in where the rows themselves live, and it changes how keys should be designed.

In InnoDB, and in SQL Server tables with a clustered index, the table **is** a B-tree ordered by the primary key, with rows stored in its leaves. Secondary indexes store the primary key, so a lookup through a secondary index walks two trees. Primary keys that arrive in increasing order append to the right-hand edge of the tree, while random keys such as UUIDv4 values insert all over it, causing page splits and scattered writes. Time-ordered identifiers such as UUIDv7 avoid that.

PostgreSQL stores rows in an unordered **heap**, and every index, including the primary key's, points to a row's physical location. Insert order matters less for the table itself, though a random key still scatters writes across its own index. PostgreSQL writes each updated row as a new version and leaves the old one behind for cleanup. When the update changes no indexed column and the page has room, the new version goes on the same page and the indexes are left alone, which PostgreSQL calls a HOT (heap-only tuple) update. Otherwise every index gets a new entry.

{% include figure.html id="db-clustered-vs-heap" %}

Increasing keys have the opposite problem in distributed databases that split tables into key ranges across nodes, such as CockroachDB, TiDB, and Spanner. Every new row lands in the last range, so one node takes all the inserts. Those systems recommend random or hashed keys, or a hashed prefix on a time-ordered key, to spread the writes.

### Composite Indexes and Column Order

An index on several columns is sorted by the first column, then by the second within each value of the first, and so on. An index on `(customer_id, created_at)` serves `WHERE customer_id = 42` and `WHERE customer_id = 42 AND created_at > '2026-01-01'`, because both start from the leading column.

A query filtering only on `created_at` traditionally can't use that index efficiently, since matching rows are scattered across every customer's section of the tree. Some engines can now **skip-scan** in that case, jumping between the distinct values of the leading column: Oracle, MySQL since 8.0.13, and [PostgreSQL since version 18](https://www.postgresql.org/docs/release/18.0/){:target="_blank" rel="noopener noreferrer"}. Skip scan works well when the leading column has few distinct values and poorly when it has many, so column order still matters. Put the columns queries filter on by equality first.

### Covering Indexes

When an index contains every column a query needs, the engine can answer from the index alone without visiting the table. That's a **covering index**, and the resulting plan is an index-only scan. PostgreSQL and SQL Server let you add non-key columns to an index with an `INCLUDE` clause for exactly this purpose, so the extra columns are carried in the leaves without affecting the sort order.

### Index Types Beyond the B-Tree

| Index structure | How it works | Good for |
| --- | --- | --- |
| B-tree | Sorted balanced tree | Equality, ranges, sorting, prefix matches; the default |
| Hash | Hash of the key | Equality only |
| Inverted (PostgreSQL GIN) | Maps each element or term to the rows containing it | Arrays, JSON containment, full-text search |
| Spatial (R-tree, PostgreSQL GiST) | Nests bounding boxes | Geometry and "what's near this point" queries |
| Block range (PostgreSQL BRIN) | Stores the minimum and maximum value per range of pages | Very large tables whose physical order follows the column, such as append-only timestamps |

Two modifiers apply on top of most of these structures. A **partial index** covers only rows matching a condition, such as `WHERE status = 'pending'`, which keeps it small when queries always filter the same way. An **expression index** indexes a computed value, such as `lower(email)`, for queries that filter on that expression. PostgreSQL supports both. MySQL has no partial indexes but has supported expression indexes since 8.0.13, and SQL Server calls partial indexes filtered indexes and indexes expressions through computed columns.

---

## Why an Index Goes Unused

The query planner chooses between available indexes and a full scan by estimating cost, and it can reasonably decline an index that exists.

**The query matches too many rows.** Reading the index and then fetching a large fraction of the table's pages one at a time costs more than scanning the table sequentially. An index on a boolean column is rarely used for this reason.

**The query wraps the column.** `WHERE lower(email) = 'a@x.com'` can't use a plain index on `email`, because the index is sorted by `email`, not by `lower(email)`. An expression index on `lower(email)` fixes it, as does storing the value already normalized. In MySQL and SQL Server, implicit type conversions, such as comparing a text column to a number, cause the same problem. PostgreSQL rejects that comparison with an error instead.

**The statistics are stale.** The planner's estimates come from sampled statistics about each column. After a large data change, stale statistics can make it pick the wrong plan until they're refreshed.

`EXPLAIN` shows the plan the planner chose, and `EXPLAIN ANALYZE` in PostgreSQL (or the actual execution plan in SQL Server) runs the query and shows where the time went. Checking the plan is the only reliable way to know whether an index is being used.

---
