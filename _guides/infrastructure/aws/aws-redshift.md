---
title: "Amazon Redshift for System Architects"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "How Amazon Redshift works as a data warehouse and how to run it: massively parallel processing and managed storage, Serverless versus RG and RA3 clusters, distribution and sort keys, loading with COPY and streaming ingestion, querying S3, data sharing, workload management and concurrency scaling, materialized views, security and recovery, and what drives cost."
tags: [redshift, data-warehouse, redshift-serverless, distribution-keys, sort-keys, workload-management, fundamentals]
---

## What Redshift Is For

Amazon Redshift is a data warehouse, a SQL database built for analytical queries that scan, join, and aggregate millions or billions of rows, such as revenue by region by month or a cohort's retention over a year. It is the engine a BI tool points at when dashboards need consistent, fast answers over large, structured data that many people query at once.

It differs from a transactional database such as Aurora in how it stores and runs work. Rows are stored by column, so a query that reads 4 columns of a 100-column table reads only those 4. Queries run in parallel across many machines, each working on its share of the data. Both choices make large scans fast and single-row lookups and frequent small updates slow, which is why Redshift sits beside an application's database rather than replacing it. Data arrives from operational databases, event streams, and files, in batches or continuously.

Compared with Athena, which queries files in S3 on demand and bills per byte scanned, Redshift keeps data in its own optimized storage and runs on capacity you size or let it scale. That buys lower and steadier latency for repeated, concurrent queries, at the cost of loading data and paying for compute.

---

## How a Query Runs

Redshift is a **massively parallel processing (MPP)** system. A **leader node** receives each query, plans it, and sends compiled steps to **compute nodes**. Each compute node is divided into **slices**, and every table's rows are spread across all slices, so each slice scans and processes its own part of every table at the same time. The leader combines the results.

Storage is separate from compute. **Redshift Managed Storage (RMS)** keeps table data durably in S3-backed storage, with hot data cached on the compute nodes' local SSDs. Because compute and storage scale independently, a warehouse can hold far more data than its nodes have disk, and adding compute doesn't require moving data. Redshift Serverless and the current node families, RG and RA3, all use RMS.

{% include figure.html id="aws-redshift-mpp" %}

How rows are spread across slices matters for joins. When two tables being joined have matching rows on the same slice, each slice joins its own rows. When they don't, Redshift has to redistribute or broadcast rows between nodes over the network before joining, which is often the slowest part of a query. Distribution keys, below, control that placement.

---

## Serverless or Provisioned

| | Redshift Serverless | Provisioned cluster |
|---|---|---|
| **Capacity unit** | Redshift Processing Units (RPUs), each 16 GB of memory | Nodes of a chosen type and count |
| **Scaling** | Automatic from a base capacity, up to a maximum you set | Resize by changing node count or type, or let concurrency scaling (below) add temporary capacity for bursts |
| **Idle cost** | No compute charge when no queries run | Nodes bill every hour they run. A paused cluster bills only for storage and backups |
| **Compute price** (US East, N. Virginia) | $0.375 per RPU-hour, per second with a 60-second minimum | Per node-hour, such as $3.04 for rg.4xlarge or $3.26 for ra3.4xlarge |
| **Commitments** | Serverless Reservations, up to 24% off for 1 year and 50% for 3 years paid all upfront | Reserved nodes, 1 or 3 years |

**Serverless** runs as a **workgroup** of compute with a **base capacity** from 4 to 1,024 RPUs (128 by default), and a **namespace** that holds the databases and users. It scales above the base as queries demand, and a **price-performance target**, set to Balanced by default, lets its AI-driven scaling decide how aggressively to add RPUs for a given workload. **Max capacity** and **max RPU-hours** limits cap what it can spend in a day, week, or month. Suppose a team's queries keep an 8 RPU warehouse busy about 2 hours a day. That's roughly 60 hours a month × 8 RPUs × $0.375, or about $180 a month for compute.

A **provisioned cluster** runs a fixed set of nodes. The current families are:

| Family | Sizes | Notes |
|---|---|---|
| **RG** (May 2026) | rg.large, rg.xlarge, rg.4xlarge, rg.12xlarge | AWS Graviton, AWS's Arm-based processors. About 30% lower price per vCPU than RA3, and an integrated engine that queries data in S3 on the cluster itself |
| **RA3** | ra3.large, ra3.xlplus, ra3.4xlarge, ra3.16xlarge | The previous generation, still current. Queries S3 through Redshift Spectrum, a separate scanning layer billed per TB |
| **DC2** | dc2.large, dc2.8xlarge | Deprecated since April 2025. Local storage only, with no managed storage, data sharing, or zero-ETL. Migrate to RG, RA3, or Serverless |

Two rg.4xlarge nodes running all month cost about $4,440, before storage. The same cluster paused outside a 10-hour working day costs about $1,850, roughly 40% of that, and less again if it stays paused at weekends. Workgroups and namespaces exist only in Serverless, and pausing only for provisioned clusters.

Serverless fits workloads with idle periods, unpredictable load, and teams that don't want to size clusters. Provisioned clusters fit steady, heavy load, where nodes stay busy and reserved nodes cut the price, and cases that need a cluster-only feature. As a rough guide, a warehouse busy most hours of the day is usually cheaper provisioned, and one busy a few hours a day is usually cheaper on Serverless.

Storage in RMS costs $0.024 per GB-month for Serverless, RG, and RA3, billed separately from compute. Automated snapshots are free and kept for up to 35 days, and Serverless recovery points younger than 24 hours are free. Manual snapshots are billed, as backup storage at S3 rates on RA3 and by unique data blocks on RG and Serverless.

---

## Designing Tables

Redshift has no indexes in the transactional sense. Performance comes from where rows live and how they're ordered.

### Distribution styles

| Style | Places rows | Fits |
|---|---|---|
| **AUTO** (the default) | Starts small tables as ALL, and moves them to KEY or EVEN as they grow | Most tables. Redshift changes the style in the background and records recommendations |
| **KEY** | By the value of one column, so equal values land on the same slice | Large tables joined on the same column, such as `orders` and `order_lines` on `order_id` |
| **EVEN** | Round-robin across slices | Tables that aren't joined, or have no single dominant join column |
| **ALL** | A full copy on every node | Slowly changing tables joined often. Multiplies storage and slows writes, and AUTO already applies it to small tables when it helps |

A distribution key needs many distinct values spread evenly. A column with few values, or one value that dominates, such as a `status` column or a null-heavy foreign key, puts most rows on a few slices, and those slices do most of the work while the rest wait. The system view `SVV_TABLE_INFO` reports skew for each table.

### Sort keys

A **sort key** orders a table's rows on disk. Redshift stores the minimum and maximum value of each column for every 1 MB block, called a **zone map**, and skips blocks whose range can't match a filter. A table of a year's events sorted by `event_time` answers a query for the last 7 days by reading about 2% of its blocks.

- **Compound** sort keys order by the first column, then the second, and help queries that filter on a leading prefix of the key.
- **AUTO**, the default, lets Redshift choose and change the sort key from observed query patterns.
- **Interleaved** sort keys weight several columns equally. They cost more to maintain, and queries on tables with them can't use concurrency scaling, so AWS steers toward compound or AUTO.

**Automatic table optimization** applies distribution and sort key changes itself when a table uses AUTO. Explicit keys make sense where the join and filter patterns are known and stable.

---

## Getting Data In

### COPY from S3

`COPY` loads files from S3 in parallel, with each slice loading its own files. It's far faster than individual `INSERT` statements, which don't load in parallel across slices.

```sql
COPY analytics.orders
FROM 's3://lake/exports/orders/2026-09-28/'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftLoad'
FORMAT AS PARQUET;
```

Load speed depends on the files. Parquet, ORC, and uncompressed CSV files of 128 MB or more are split into chunks automatically, so slices share the work. Gzipped CSV and JSON files can't be split, so split them yourself into files of similar size, between 1 MB and 1 GB after compression, in a number that's a multiple of the slice count. An **auto-copy job** (`COPY ... JOB CREATE ... AUTO ON`) watches an S3 prefix in the same Region through an S3 event integration and loads new files as they arrive, remembering which files it has loaded. `UNLOAD` goes the other way, writing query results to S3 as Parquet or text.

### Continuous and replicated data

- **Streaming ingestion** reads Kinesis Data Streams, Amazon MSK, Confluent Cloud, or self-managed Kafka into a **materialized view**, a stored query result covered below, in near real time when the view refreshes automatically, with no staging in S3.
- **Zero-ETL integrations** replicate Aurora, RDS, DynamoDB, and some SaaS applications into Redshift continuously, without pipelines to build.
- **Upserts** use `MERGE`, or a staging table followed by delete-and-insert in one transaction.

### Keeping tables healthy

Deleted and updated rows leave space behind, and new rows are appended outside the table's sort order, leaving unsorted regions. Redshift runs **automatic vacuum** and **automatic analyze** in the background during quiet periods, which covers most tables. After very large loads or deletes, a manual `VACUUM` or `ANALYZE` brings a table back to shape sooner, and `SVV_TABLE_INFO` shows how unsorted a table is and how stale its statistics are.

---

## Querying S3 and Sharing Data

**Redshift Spectrum** lets RA3 clusters and Serverless query tables defined in the Glue Data Catalog, the shared registry of table definitions over files in S3, and join them with warehouse tables in one statement. What those queries cost depends on the deployment, as the cost section below describes. The same rules that cut Athena's cost apply: columnar formats, partitioning, and reasonably sized files. A common layout keeps recent, heavily queried data in the warehouse and older history in S3, queried only when needed.

**Data sharing** gives another Redshift warehouse live access to tables without copying them, read-only by default and with writes allowed where the producer grants them. A **producer** creates a datashare, and **consumers** in the same account, other accounts, or other Regions query it with their own compute. That lets one team load and own a dataset while others query it on warehouses sized and billed separately, and it separates heavy ETL from dashboards. Data sharing works on RG, RA3, and Serverless. Consumers in another Region pay cross-Region data transfer.

---

## Workload Management and Concurrency

Many users and jobs share a warehouse, and a long ETL statement shouldn't block dashboards. On provisioned clusters, **workload management (WLM)** assigns queries to queues with their own share of memory and concurrency. **Automatic WLM**, the default for new clusters, sizes concurrency and memory itself, and **query priorities** let dashboards outrank batch work. **Short query acceleration** runs quick queries on a dedicated path so they don't wait behind long ones. **Query monitoring rules** log, move, or cancel queries that exceed limits such as runtime or rows scanned. Serverless manages concurrency and memory itself, and since January 2026 it offers query queues per workgroup, each with monitoring rules that log or abort queries, but not priorities or short query acceleration.

**Concurrency scaling** adds temporary clusters when queued queries pile up on a provisioned cluster, runs eligible reads and common writes such as `COPY`, `INSERT`, and `UPDATE` there, and removes them when the queue clears. Each cluster earns up to one hour of free concurrency scaling credit per day, and usage beyond that is billed per second at the cluster's on-demand rate. It's available to RG, RA3, and DC2 clusters, and for RG and RA3 only to clusters of 32 nodes or fewer. Serverless scales on its own and doesn't use it.

**Materialized views** store the result of a query, such as a daily revenue rollup, and refresh on demand or, with `AUTO REFRESH`, automatically when Redshift has spare capacity. A refresh is incremental where the query allows and full where it uses outer joins, window functions, and similar constructs. Dashboards that run the same aggregation repeatedly read the stored result instead of recomputing it. Redshift can also rewrite queries to use a matching materialized view automatically.

---

## Security, Availability, and Access

A cluster or Serverless workgroup runs in your VPC, reachable through its subnets and security groups. Since January 2025, new provisioned clusters have public access off, encryption at rest on with an AWS-managed key unless you choose a KMS key, and a parameter group that requires TLS connections. Inside the database, access is managed with database users and roles, or with IAM identities mapped to database roles, and row-level security and dynamic data masking restrict what each role sees. `COPY`, `UNLOAD`, and Spectrum reach S3 with IAM roles associated with the cluster or namespace.

Applications connect through JDBC and ODBC drivers, through the **Redshift Data API**, which runs SQL over HTTPS without managing connections and suits Lambda and other short-lived callers, or through Query Editor v2 in the console.

Provisioned RG and RA3 clusters can run **Multi-AZ**, with compute in two Availability Zones and a 99.99% availability SLA, and a single-AZ cluster can be relocated to another zone. Automated snapshots, and recovery points on Serverless, restore a warehouse to an earlier point, and snapshots can be copied to another Region for disaster recovery.

---

## What Drives Cost

- **Compute is most of the bill.** Serverless charges for RPU time while queries run, and provisioned clusters charge for every running node-hour. The waste to look for is a Serverless base set higher than the workload needs, and a provisioned cluster running idle overnight.
- **Commitments** fit the steady part of the load. Reserved nodes cover provisioned clusters, and Serverless Reservations cover RPUs across the accounts in an organization.
- **Storage** is cheap next to compute, but snapshots, long history, and copies from ALL-distributed tables add up.
- **S3 queries** on RA3 add $5 per TB scanned through Spectrum, rounded to the megabyte with a 10 MB minimum. Serverless bills them as RPU time, and RG clusters run them on their own nodes with no per-TB charge, which makes RG attractive when much of the workload reads the data lake.
- **Concurrency scaling** beyond the daily free credit, and cross-Region data sharing, appear as separate lines.

Suppose a warehouse is busy 12 hours a day. On Serverless at an average of 32 RPUs, that's about 360 hours × 32 × $0.375, or $4,320 a month. Two rg.4xlarge nodes cost about $4,440 a month running around the clock, less with reserved nodes, and would also serve the other 12 hours. At that level of use the choice turns on whether the load fits two nodes, and on how spiky it is.

---

## When Redshift Is the Wrong Engine

- **Occasional queries over data that already lives in S3.** Athena costs nothing when idle and needs no loading.
- **Serving an application's reads and writes.** Single-row lookups and frequent small transactions belong in Aurora, RDS, or DynamoDB.
- **Search and log exploration.** Free-text search, and investigating recent logs by keyword, fit OpenSearch Service or CloudWatch Logs Insights.
- **Small data.** Tens of gigabytes that one PostgreSQL instance handles comfortably don't need a warehouse, though Serverless at 4 RPUs has narrowed the gap.

---

## Common Pitfalls

- **Skew nobody checked.** A distribution key with one dominant value makes every query wait on a few slices. `SVV_TABLE_INFO` shows it, and AUTO avoids choosing such a key.
- **A development cluster that never sleeps.** Pause it on a schedule, or run development on Serverless.
- **Serverless without limits.** A runaway query or a new workload can scale spend far past budget. Set max capacity and max RPU-hours on every workgroup.
- **Manual snapshots kept forever.** Automated snapshots are free, but manual ones accumulate charges long after the data they protected is gone. Give them a retention policy.
- **Python user-defined functions.** Redshift ended support for Python UDFs after June 30, 2026 and is enforcing it in phases. Rewrite them as SQL UDFs or Lambda UDFs.

---

## Key Takeaways

- Redshift is a columnar, massively parallel warehouse. A leader node plans queries, compute node slices run them in parallel, and managed storage keeps data independent of compute.
- Serverless bills RPU time at $0.375 per RPU-hour with no charge when idle, and scales from a base of 4 to 1,024 RPUs. Provisioned RG and RA3 clusters bill per node-hour. DC2 is deprecated.
- Distribution style decides which rows share a slice for joins, and sort keys let zone maps skip blocks. AUTO for both is the default and usually right.
- Load with `COPY` from evenly split files, stream from Kinesis or MSK, or replicate operational databases with zero-ETL.
- Spectrum queries S3 at $5 per TB on RA3, RG clusters query S3 with no per-TB charge, and data sharing gives other warehouses live access without copies.
- New clusters are private, encrypted, and TLS-only by default. Multi-AZ, automated snapshots, and cross-Region snapshot copies cover availability and recovery.
- Workload management, short query acceleration, and concurrency scaling keep mixed workloads responsive, and materialized views serve repeated aggregations.
