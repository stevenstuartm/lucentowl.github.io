---
title: "Azure Synapse: Serverless & Dedicated Query"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Querying the data lake with Synapse serverless SQL pools: what data processed actually measures, CETAS and the logical data warehouse, the read-only surface area, and how dedicated pool concurrency, materialized views, and result set caching differ."
tags: [synapse, serverless-sql, data-lake, delta-lake, query-optimization, cetas, practical]
---

## What Synapse Serverless SQL Is

[Serverless SQL pool](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/on-demand-workspace-overview){:target="_blank" rel="noopener noreferrer"} is a distributed query engine that reads files in place using T-SQL. Every Synapse workspace gets a serverless endpoint automatically, so there is nothing to provision and no cluster to size. You are charged only for data processed by the queries you run.

It has no local storage. A serverless database holds metadata only, meaning views, external tables, credentials, and stored procedures, while every byte of actual data stays in the lake. That single property explains most of what follows, including why the surface area is read-only and why the cost model measures bytes moved rather than time elapsed.

### Fabric Data Warehouse Is the Successor

Synapse SQL documentation now carries a consistent notice: [Microsoft Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse){:target="_blank" rel="noopener noreferrer"} is described as "an enterprise scale relational warehouse on a data lake foundation, with a future-ready architecture," with guidance that new data warehousing work should start there and that [existing dedicated SQL pool workloads can upgrade](https://learn.microsoft.com/en-us/fabric/data-warehouse/migration-synapse-dedicated-sql-pool-warehouse){:target="_blank" rel="noopener noreferrer"}, assisted by a migration tool.

Synapse is not retired and carries no announced end date, so existing workspaces keep running. But new analytics platforms should evaluate Fabric first, and a large Synapse estate should treat migration as a scheduling question. The concepts here transfer, since Fabric's warehouse and lakehouse SQL endpoints use the same T-SQL surface and the same lake-file substrate.

### What Serverless Can and Cannot Do

The supported T-SQL surface is narrow by design, and knowing its shape prevents architecting toward something that does not exist.

**Supported:** the full `SELECT` surface area including most SQL functions, `CETAS` (CREATE EXTERNAL TABLE AS SELECT), and DDL for views and security objects only.

**Not supported:** tables, triggers, materialized views, DML statements of any kind, and DDL beyond views and security.

The absence of DML is the one that reshapes designs. Serverless SQL pool is **read-only apart from CETAS**. There is no `INSERT`, no `UPDATE`, no `DELETE` against external tables. Every write goes through CETAS producing new files, which is why transformation in serverless is expressed as materializing a new dataset rather than modifying an existing one.

### Supported Data Sources

Serverless SQL pool queries the [Azure Data Lake](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/query-data-storage){:target="_blank" rel="noopener noreferrer"} in Parquet, Delta Lake, and delimited text formats, plus the **Azure Cosmos DB analytical store** and **Dataverse**. It also queries external Spark tables created by a Synapse Spark pool. It does not query Amazon S3.

Storage authorization uses one of three mechanisms:

- **Shared access signature**, giving delegated, time-bounded access without sharing account keys.
- **User identity** (pass-through), where the signed-in Microsoft Entra user's own permissions authorize the read. Not available to SQL-authenticated users, who exist only inside the serverless pool.
- **Workspace identity**, where the Synapse workspace's managed identity is authorized on the storage account.

Private Link brings the serverless endpoint into the workspace's managed virtual network.

### How Serverless Compares to AWS Athena

| Concept | AWS Athena | Synapse serverless SQL |
|---------|-----------|------------------------|
| **Query language** | Trino/Presto SQL | T-SQL |
| **Packaging** | Standalone service | An endpoint in every Synapse workspace |
| **Data sources** | S3, plus federated connectors | ADLS Gen2 and Blob, Cosmos DB analytical store, Dataverse, Spark tables |
| **Formats** | Parquet, CSV, JSON, ORC, Iceberg, Hudi | Parquet, CSV, JSON, Delta Lake |
| **Catalog** | Glue Data Catalog | Serverless databases, plus Spark metastore sync |
| **Ad-hoc file access** | External tables | External tables and `OPENROWSET` |
| **Writes** | `INSERT INTO`, CTAS | CETAS only; no DML |
| **Time travel** | Iceberg time travel | Not supported in serverless; use Spark pools |
| **Billing** | Per TB scanned | Per TB processed, 10 MB minimum per query |
| **Cost guardrail** | Workgroup data limits | Daily, weekly, and monthly budgets in TB |
| **Concurrency** | Service quotas | No fixed limit; about 1,000 lightweight sessions |

---

## Core Query Constructs

### OPENROWSET for Ad-Hoc Reads

[OPENROWSET](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/develop-openrowset){:target="_blank" rel="noopener noreferrer"} reads files directly in a single statement with no object definition. Synapse extends the standard function to query multiple files and folders with wildcards, read Parquet and Delta, handle custom delimited formats, infer schema, project a subset of columns, and expose the `filename()` and `filepath()` functions for partition-aware filtering.

It suits first contact with a dataset: inspecting structure, sampling rows, and checking whether a format parses. Its weakness is reuse, since every query repeats the path and the format options, and schema inference costs data processed on each run.

### External Tables for Repeated Access

An external table gives files a named, typed definition backed by an external data source and file format. Queries then read it like a table, without the path handling that `OPENROWSET` requires.

External tables carry no data, no indexes, and no enforced constraints. The schema is a promise about the files rather than something storage enforces, so a file whose columns drift from the definition produces errors or silently wrong types at query time rather than at write time. External table names are limited to 100 characters.

Defining the schema explicitly rather than relying on inference also avoids paying to re-infer it on every query.

### CETAS for Materialization

CETAS runs a `SELECT` and writes the results to storage as Parquet, then defines an external table over the output. It is the only write path in serverless SQL, and it is the mechanism behind transformation pipelines built on the service.

The cost profile is what makes it worthwhile. A CETAS run is charged for the data processed by the `SELECT` plus the data written. Every downstream query then reads the smaller, columnar, pre-computed result instead of re-scanning and re-computing from raw files. An expensive transformation queried many times is paid for once.

Materialize where the computation is expensive and the result is reused. Leave cheap projections and filters as views, since materializing them adds storage and a pipeline step without saving meaningful compute.

### Views and the Logical Data Warehouse

Views over external tables give a relational abstraction across raw and disparate files without relocating anything, which Microsoft calls the logical data warehouse pattern. Cleaning views filter malformed records and cast types, business views apply rules and naming, and consumption views present a facts-and-dimensions shape.

A view recomputes on every query, so its cost recurs. That is the deciding trade-off against CETAS. A view is always current and costs nothing to store; a CETAS result is fast and cheap to read but is a point-in-time copy that a pipeline has to refresh.

Serverless supports views, stored procedures, and inline table-valued functions, which is enough to encode a full semantic layer, with the caveat that it holds no data of its own.

---

## What Data Processed Actually Measures

Serverless billing is not "bytes of file scanned." Getting this wrong leads to cost surprises that look inexplicable.

[Data processed](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/data-processed){:target="_blank" rel="noopener noreferrer"} is the data the system temporarily handles while running a query, and it has three parts.

```
                       ONE QUERY
                           |
     +---------------------+---------------------+
     |                     |                     |
     v                     v                     v
  1. READ from       2. INTERMEDIATE       3. WRITE to
     storage            RESULTS               storage
     |                     |                     |
  file bytes read      data moved between    only for CETAS:
  + metadata bytes     nodes, and to your    bytes written out
  (Parquet footers,    endpoint, ALWAYS      are added to the
  statistics)          UNCOMPRESSED          SELECT's total
     |                     |                     |
     +---------------------+---------------------+
                           |
                           v
              Rounded UP to the nearest MB,
              with a MINIMUM of 10 MB per query

   Not counted: server metadata, database objects, DDL
   (except CREATE STATISTICS), and metadata-only queries.
```

The uncompressed intermediate transfer is the part that catches people. In Microsoft's own worked example, a `SELECT *` against a 1 TB Parquet table with 5:1 compression processes **6 TB**, because it reads 1 TB from storage and then transfers 5 TB uncompressed to the endpoint. The same table answering `SELECT SUM(population)` processes about 0.2 TB, because only one column is read and only a running total moves between nodes.

Two consequences follow. Column projection matters more than the file size suggests, and `SELECT *` on a wide compressed table is the most expensive thing you can casually type. And the 10 MB per-query minimum means a workload of thousands of trivial queries has a cost floor unrelated to the data involved.

Statistics have their own cost. The optimizer creates them automatically if you do not, by running a separate sampling query that processes data. For a Parquet column only that column is read; for a CSV column whole files are read and parsed. Once created they are reused at no further charge.

### Cost Control Budgets

Serverless has a built-in budget in TB of data processed, settable for a **day, a week, and a month** simultaneously, through Synapse Studio or `sp_set_data_processed_limit`. Current usage is visible in `sys.dm_external_data_processed`.

The enforcement behavior needs stating precisely. Exceeding a limit **does not terminate the running query**. The next query submitted is rejected with an error naming the period, the limit, and the data processed. The budget is therefore a circuit breaker on future work, not a kill switch on the query that blew through it, so a single enormous query can still overrun a limit by a wide margin.

---

## Optimizing Query Cost and Performance

### File Format

Format choice dominates every other optimization.

**Parquet** is columnar, so only referenced columns are read, and it carries metadata the engine uses to skip data. Microsoft's worked comparison has 5 TB of CSV compressing to 1 TB of Parquet with the same content.

**CSV** is row-oriented, so every column is read regardless of what the query selects, and it compresses far less. The `PARSER_VERSION='2.0'` parser reads files in parallel chunks and adds a small overhead because it reads fragments of adjacent chunks to complete rows.

**JSON** handles nested and semi-structured data but is larger and slower to infer than Parquet.

**Delta Lake** is Parquet plus a transaction log, so read cost resembles Parquet with the log reads added.

Converting raw CSV to Parquet once with CETAS is usually the highest-return change available, because it reduces both the bytes read and the bytes of intermediate transfer for every query afterward.

### Partition Layout

Files organized into folders named for common filter columns let the engine skip whole directories. A layout like `/year=2024/month=01/day=01/` allows a query filtering on those columns to read only the matching folders, and the `filepath()` function exposes the folder values to predicates.

Partition on the dimensions that appear in `WHERE` clauses, which is often not the ingestion date. A lake partitioned only by load date cannot skip anything for a query filtered by region.

### File Size

Both extremes hurt. Thousands of small files add per-file metadata reads, connection overhead, and scheduling, and the aggregate overhead can dominate the actual data. Very few very large files limit parallelism.

Target Parquet files in the low hundreds of megabytes and run periodic compaction, either as a Spark job or a CETAS rewrite. Delta tables have `OPTIMIZE` for the same purpose.

### Delta Lake Constraints in Serverless

Serverless SQL pool reads Delta Lake tables, giving consistent snapshot reads over data that Spark writes transactionally. Two limits shape the architecture.

**No writes.** Delta writes go through Spark pools; serverless only reads.

**No time travel.** Serverless SQL pool does not support time travel queries. Reading a historical version of a Delta table requires a Spark pool. A design that depends on querying prior versions from SQL needs rethinking.

---

## Dedicated SQL Pool Query Execution

Serverless and dedicated pools are separate engines that share a workspace and a T-SQL dialect. The dedicated pool's behavior comes from being a distributed, provisioned warehouse.

### Distributions and Scale

Data in a dedicated pool table is spread across **60 distributions** using one of three strategies: hash, round-robin, or replicated. Distribution is fixed at table creation and cannot be changed without recreating the table.

Sixty is a constant regardless of size. Scaling changes how many compute nodes those 60 distributions are spread over, not how many distributions exist, which is why the number of nodes tracks the service level as roughly DWU divided by 500. At the smallest levels one node owns all 60 distributions; at the largest, each node owns far fewer.

### Concurrency Slots and Resource Classes

A dedicated pool allocates memory and concurrency through [resource classes](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/resource-classes-for-workload-management){:target="_blank" rel="noopener noreferrer"}, implemented as database roles. **Static** classes (`staticrc10` through `staticrc80`) grant a fixed memory amount regardless of service level, so scaling out increases how many can run at once. **Dynamic** classes (`smallrc`, `mediumrc`, `largerc`, `xlargerc`) grant a percentage of memory that grows with the service level.

At DW1000c and above, the dynamic classes grant 3%, 10%, 22%, and 70% of memory respectively. Every user defaults to `smallrc`, and the service administrator is fixed at `smallrc`.

Concurrency works through slots. The service level determines the total slots available and the maximum concurrent queries, and each resource class consumes a number of slots that varies by service level. A query runs when it can reserve enough slots.

| Service level | Max concurrent queries | Total slots |
|---|---|---|
| DW100c | 4 | 4 |
| DW500c | 20 | 20 |
| DW1000c | 32 | 40 |
| DW2000c | 48 | 80 |
| DW6000c | 128 | 240 |
| DW30000c | 128 | 1,200 |

The concurrent query ceiling is **128** and stops rising above DW6000c, so scaling past that point buys memory per query rather than more simultaneous queries.

Some statements are exempt and always run as `smallrc` without consuming slots, including `CREATE`/`DROP TABLE`, `TRUNCATE TABLE`, statistics operations, `INSERT ... VALUES`, `EXPLAIN`, and selects against DMVs. Monitoring queries therefore do not compete with the workload.

Microsoft now points toward [workload management](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/sql-data-warehouse-workload-isolation){:target="_blank" rel="noopener noreferrer"} instead, using workload groups, classifiers, and importance for finer control and more predictable performance. Resource classes remain supported, and the guidance is to prefer static over dynamic classes when using them, but new work should look at workload management first.

### Materialized Views

Dedicated pools support [materialized views](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/performance-tuning-materialized-views){:target="_blank" rel="noopener noreferrer"}, which serverless does not. They differ from standard views in three ways that matter.

They are **automatically and synchronously maintained**. Incremental changes to base tables are applied in the same transaction, so a materialized view always returns what querying the base tables would return. There is no refresh job and no staleness window.

The **optimizer uses them without the query referencing them**. A query written against base tables can be answered from a materialized view, in whole or in part, with no code change. `EXPLAIN WITH_RECOMMENDATIONS` suggests candidates for a given statement.

They can carry a **different distribution** from their base tables, hash or round-robin, so a view can be distributed for the queries that use it rather than for the tables underneath.

The cost is maintenance. A materialized view is stored as a clustered columnstore index, and reading it means scanning that index plus applying accumulated base-table deltas. Once the delta volume is high enough, answering from the view can be slower than reading the base tables. Monitor `overhead_ratio` with `DBCC PDW_SHOWMATERIALIZEDVIEWOVERHEAD` and rebuild when it climbs. A disabled view stops being maintained but keeps costing storage.

### Result Set Caching

Result set caching is a dedicated pool feature and is **off by default** at both database and session level. Serverless SQL pool does not have it.

When on, results are cached in the user database and reused when the new query matches the cached one exactly, the caller has permission on every referenced table, and no data or schema has changed underneath. Cache hits **consume no concurrency slots**, so they do not count against the concurrency limit, which is what makes the feature valuable for repetitive dashboard traffic.

The cache holds up to **1 TB per database**, invalidates automatically when underlying data changes, and evicts entries every 48 hours if unused or invalidated, or sooner when approaching the size limit. Pausing the pool does not clear it. `DBCC DROPRESULTSETCACHE` clears it manually.

Several query shapes are never cached: those using non-deterministic functions like `GETDATE()`, user-defined functions, tables with row-level security, results with rows larger than 64 KB, and results larger than 10 GB.

One caution shapes when to enable it. Cache creation and retrieval happen on the **control node**, so queries returning large result sets can throttle that node and slow the whole instance. Turn result set caching off for exploration and ETL work that returns big result sets, and on for the repetitive reporting it was built for.

---

## Choosing Between Serverless and Dedicated

| Workload | Serverless | Dedicated |
|----------|-----------|-----------|
| **Exploring unfamiliar files** | Well suited; no setup, cost follows usage | Requires loading first |
| **Occasional large scans** | Cost tracks the scan | Pays for the pool whether used or not |
| **High-frequency repeated queries** | Every run re-reads and re-computes | Amortizes across runs, with caching and materialized views |
| **Sub-second dashboards** | Not suited; latency varies | Suited, with result set caching and materialized views |
| **Writes and updates** | CETAS only, no DML | Full DML |
| **High concurrency** | About 1,000 lightweight sessions, no fixed cap | Hard ceiling of 128 concurrent queries |
| **Cost shape** | Variable, per query | Fixed, per provisioned hour |

The two ceilings run opposite ways, which is the part most easily missed. Serverless imposes no fixed concurrency limit and handles roughly 1,000 concurrent lightweight sessions, with the number falling as queries get heavier. A dedicated pool caps at 128 concurrent queries no matter how large it is. For many small simultaneous queries, serverless scales further; for sustained heavy analytical queries, dedicated gives each one far more memory.

A common arrangement uses serverless to explore and to build curated layers with CETAS, then loads the results a dedicated pool serves to BI tools under a latency expectation.

---

## Serverless Constraints That Shape a Design

| Property | Limit |
|---|---|
| Maximum query duration | 30 minutes, **not configurable** |
| Maximum result set size | 400 GB, shared across concurrent queries |
| Databases per serverless pool | 100, excluding Spark-synchronized databases |
| External table name length | 100 characters |
| Concurrency | No fixed limit; about 1,000 lightweight sessions, fewer as complexity rises |
| Minimum billed per query | 10 MB |

The timeout is the one to design around. Thirty minutes is a hard ceiling that cannot be raised, so a transformation that might approach it needs splitting into CETAS stages rather than tuning.

The database limit rarely binds if you use schemas for isolation, which Microsoft recommends over separate databases since all data lives outside the pool anyway.

---

## Common Pitfalls

### Pitfall 1: Designing for Updates in a Read-Only Engine

**Problem:** An architecture calls for serverless SQL to correct records, apply late-arriving changes, or maintain a slowly changing dimension in place.

**Result:** None of it is possible. Serverless supports no DML, no tables, and no materialized views. The work stalls once someone tries to write the first `UPDATE`.

**Solution:** Express changes as new materializations. CETAS the corrected dataset and swap the external table definition to point at it. Where genuine in-place updates are required, write with Spark to Delta Lake and let serverless read the result, or load into a dedicated pool where DML exists.

---

### Pitfall 2: `SELECT *` on a Compressed Table

**Problem:** Exploratory queries select every column from a wide Parquet dataset, on the assumption that cost tracks the file size.

**Result:** Data processed includes the uncompressed intermediate transfer, so a 1 TB Parquet table compressed 5:1 processes about 6 TB for a full select. The bill exceeds what the storage footprint suggests.

**Solution:** Project only needed columns, which is where Parquet earns its cost advantage. Use `TOP` when sampling. Reserve full-width reads for genuinely narrow tables, and check the data processed figure for a query before scheduling it to run repeatedly.

---

### Pitfall 3: Expecting the Cost Budget to Stop a Runaway Query

**Problem:** Daily and monthly data-processed budgets are configured and treated as a hard cap.

**Result:** A limit breach does not terminate the running query. It only causes the **next** query to be rejected. One badly written query can overshoot the budget substantially before anything is blocked.

**Solution:** Treat the budget as a circuit breaker on subsequent work. Combine it with the 30-minute timeout, review expensive queries in the DMVs, and estimate data processed before scheduling anything new that scans broadly.

---

### Pitfall 4: Expecting Delta Time Travel from SQL

**Problem:** An auditing or point-in-time reporting requirement is designed around querying historical Delta versions through the serverless endpoint.

**Result:** Serverless SQL pool does not support time travel queries. The requirement fails at implementation, after the surrounding design assumed it.

**Solution:** Read historical versions with a Synapse Spark pool, which does support Delta time travel, and materialize the versions SQL consumers need. Where the requirement is really point-in-time reporting rather than arbitrary versions, snapshot with CETAS on a schedule instead.

---

### Pitfall 5: Thousands of Small Files

**Problem:** A streaming or micro-batch ingest writes many small files into the lake, and serverless queries read them directly.

**Result:** Per-file overhead dominates. The 10 MB per-query minimum compounds the effect for small queries, and query latency grows with file count rather than data volume.

**Solution:** Compact on a schedule, with a Spark job, `OPTIMIZE` on Delta tables, or a CETAS rewrite that produces properly sized Parquet. Separate the raw landing area from a compacted serving area so ingest frequency and query layout stop competing.

---

### Pitfall 6: Assuming Serverless Caches Results

**Problem:** A dashboard is pointed at serverless SQL on the expectation that repeated identical queries return from cache without charge.

**Result:** Result set caching is a dedicated pool feature, off by default even there, and serverless has no equivalent. Every dashboard refresh re-reads files and is billed for the data processed.

**Solution:** Materialize the dashboard's dataset with CETAS so refreshes read a small pre-computed result, or serve the dashboard from a dedicated pool with result set caching enabled and materialized views where they help.

---

### Pitfall 7: Scaling a Dedicated Pool to Fix Concurrency

**Problem:** Queries queue during peak reporting, so the pool is scaled up to a higher DWU expecting more of them to run at once.

**Result:** Concurrent query count caps at 128 and stops rising above DW6000c. Scaling beyond that buys memory per query and more distributions per node, but not more simultaneous queries, so the queue persists at a much higher cost.

**Solution:** Check whether the constraint is memory or slot count. Lower resource classes let more queries run concurrently at less memory each. Enable result set caching so repetitive queries stop consuming slots at all, and use materialized views to make expensive queries cheap enough to finish quickly. Workload management with classifiers and importance controls which queries get priority when the ceiling binds.

---

## Key Takeaways

1. **Serverless SQL pool has no storage, and everything else follows from that.** Databases hold metadata only, the surface area is read-only apart from CETAS, and there are no tables, materialized views, or DML statements.

2. **Fabric Data Warehouse is the documented successor.** Synapse is not retired and has no end date, but Microsoft directs new warehousing work to Fabric and provides an upgrade path for dedicated pools.

3. **Data processed is not bytes scanned.** It is storage reads plus uncompressed intermediate transfer plus CETAS writes, rounded up per MB with a 10 MB per-query minimum. A `SELECT *` on a 1 TB Parquet table at 5:1 compression processes about 6 TB.

4. **CETAS is the only write, and it is the transformation pattern.** Pay once to compute an expensive result, then read the small columnar output repeatedly. Views stay current and cost nothing to store, but recompute on every query.

5. **Cost budgets reject the next query, not the current one.** Daily, weekly, and monthly limits are a circuit breaker, and a single query can overshoot before anything is blocked.

6. **The 30-minute query timeout cannot be changed.** Long transformations have to be split into stages rather than tuned into the limit.

7. **Serverless reads Delta Lake but cannot write it or time travel.** Both need a Spark pool.

8. **Dedicated pool tables always have 60 distributions.** Scaling changes how many nodes share them, roughly DWU divided by 500, not how many distributions exist.

9. **Materialized views are automatically and synchronously maintained, and the optimizer uses them unreferenced.** The cost is base-table delta accumulation, which can eventually make the view slower than the tables, so monitor `overhead_ratio` and rebuild.

10. **Result set caching is dedicated-pool only and off by default, and cache hits consume no concurrency slots.** That matters because concurrent queries cap at 128 regardless of service level, so relieving slot pressure often beats scaling up.
