---
title: "Amazon Athena: Serverless SQL on S3"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "How Amazon Athena runs SQL over data in S3: what drives the bytes it bills, columnar formats, partitioning and partition projection, CTAS and INSERT INTO, Iceberg tables with updates and deletes, workgroups and scan limits, query result reuse, Capacity Reservations, federated queries, and where Athena stops being the right engine."
tags: [athena, serverless-sql, data-lake, partitioning, partition-projection, iceberg, practical]
---

## What Athena Does

Amazon Athena runs SQL against data where it already sits, mostly files in S3, with no cluster or database to provision. It reads table definitions from the AWS Glue Data Catalog, plans the query, reads the files it needs from S3 in parallel, and writes the result. Its SQL engine, **Athena engine version 3**, is based on the open-source Trino engine, so the SQL dialect and functions are Trino's.

{% include figure.html id="aws-glue-catalog-paths" %}

The same table definitions serve other engines too: Redshift Spectrum, which lets a Redshift warehouse query S3 tables, Amazon EMR, which runs Spark and other open-source engines on clusters, and AWS Glue's Spark jobs. Athena and its tables are Regional. Queries in a Region read that Region's catalog, and while Athena can read buckets in other Regions, doing so adds cross-Region transfer charges and latency. Queries run inside a **workgroup**, which is where result settings, engine version, limits, and cost tracking live.

Athena suits ad hoc analysis, investigation of logs such as CloudTrail, VPC Flow Logs, and load balancer logs, scheduled reports, and serving a BI tool over a data lake. With the default per-query billing, nothing runs between queries, so an idle Athena costs nothing beyond the S3 storage and catalog it reads.

---

## What a Query Costs

By default Athena charges **$5 per TB of data scanned**, rounded up to the nearest megabyte with a 10 MB minimum per query. DDL statements such as `CREATE TABLE` and `ALTER TABLE ADD PARTITION` are free, and so are failed queries. A cancelled query is billed for what it scanned before it stopped.

Bytes scanned is what the query engine reads from S3, not the size of the result, so the cost of a query comes down to how much of the table it has to read. The S3 requests and data transfer a query causes, the storage of its results, and Glue Data Catalog requests are billed separately at those services' rates, and many small files raise the S3 request count along with the time. Four things decide how much a query reads.

### Columnar formats

Parquet and ORC store each column separately, with statistics for each block of rows. A query that selects 3 columns from a 60-column table reads only those 3 columns, and Athena can skip row groups whose minimum and maximum values rule out a filter. JSON and CSV store whole rows, so every query reads every byte of every file it touches.

Consider a year of event data, 2 TB as gzipped JSON, stored in one folder per day so a query can read a single day. A query that reads 3 of its 60 columns for one day scans that day's whole JSON, about 5.5 GB, for roughly $0.03. As Parquet with Snappy compression, the same data is typically a fraction of the size, and the query reads only the three columns it needs, often well under 1 GB. Across thousands of queries a month from a dashboard, that difference is most of the bill. Compression helps every format, and Athena reads gzip, Snappy, and Zstandard files directly.

### Partitioning

A **partitioned** table stores its files under folders named for a column's values, such as `dt=2026-09-28/`, and the catalog records each folder as a partition. A query that filters on the partition column reads only the matching folders:

```sql
SELECT event_type, count(*) AS events
FROM events
WHERE dt BETWEEN '2026-09-01' AND '2026-09-07'
GROUP BY event_type;
```

Filtering on a timestamp column that isn't the partition key, such as `event_time > timestamp '2026-09-01'`, has to consider every partition and open files in each, because Athena can't know from folder names which ones hold matching rows. Queries need a predicate on the partition column itself, even when it's redundant with another filter.

Partition on what queries filter by, usually a date, and keep each partition large enough that skipping it saves a meaningful amount of reading. Partitioning by a high-cardinality column, one with millions of distinct values such as a user ID, creates millions of tiny partitions, and planning time grows with partition count. Athena reads at most 1 million partitions in a single scan of a table. For lookups on a high-cardinality key, **bucketing** is the alternative. CTAS can write a table bucketed by user ID into a fixed number of files, and a query for one user reads only the file that can hold that ID.

Declare partition columns as `STRING`, which lets Athena push partition filters down to the catalog, and cast them to dates in queries. Prefixing a query with `EXPLAIN` lists the partition values it will read, which confirms the filter prunes what you expect.

### File sizes

Athena parallelizes across files and chunks of files. Thousands of kilobyte-sized files spend more time opening objects than reading them, so avoid files much smaller than 128 MB, Parquet's default row-group size. At the other extreme, a few huge gzipped JSON or CSV files can't be split between workers, because most compression formats must be read from the start. Streaming ingestion is the usual source of small files, and rewriting them into larger files with a Glue job or the writing statements below fixes it.

### Query shape

Select named columns instead of `SELECT *`. For large distinct counts and percentiles where an exact answer isn't needed, `approx_distinct` and `approx_percentile` use far less memory than `count(DISTINCT ...)` and exact percentiles. Filters in `WHERE` reduce what a query processes, and the optimizer pushes them down to the scan, but they reduce bytes scanned only when they hit partition columns or columnar statistics.

---

## Keeping Partitions Registered

For a Hive-style partitioned table, a partition only exists to Athena once it is registered in the catalog. Iceberg tables, covered below, track their own partitions and need none of this. New data written to a new folder is invisible until someone adds it, which is the most common reason a query "misses" recent data. There are four ways to keep up:

| Method | How it works | Fits |
|---|---|---|
| `ALTER TABLE ADD PARTITION` | Registers named partitions, one statement for many | The job that writes the data, right after writing it |
| `MSCK REPAIR TABLE` | Lists the table's S3 location and adds any Hive-style (`key=value`) folders it doesn't know | Occasional catch-up. Slow on large tables, because it lists everything |
| Glue crawler | Discovers folders and schema changes on a schedule or from S3 events | Data from producers you don't control |
| **Partition projection** | Athena computes partitions from rules in the table properties and never reads the catalog's partition list | Predictable, high-cardinality partitions, such as dates or hours |

**Partition projection** replaces the lookup entirely. The table's properties say, for example, that `dt` is a date from `2020-01-01` to `NOW` in daily steps and where each value's files live, and Athena works out the partitions a query needs in memory:

```sql
ALTER TABLE events SET TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.dt.type' = 'date',
  'projection.dt.range' = '2020-01-01,NOW',
  'projection.dt.format' = 'yyyy-MM-dd',
  'projection.dt.interval' = '1',
  'projection.dt.interval.unit' = 'DAYS',
  'storage.location.template' = 's3://lake/events/dt=${dt}/'
);
```

Projection replaces the catalog's partition list for Athena. Nothing has to register new days, and planning stays fast with hundreds of thousands of possible partitions. Three limits come with it. Athena ignores any partitions registered in the catalog once projection is on. Only Athena uses projection, so Redshift Spectrum, EMR, and Glue jobs reading the same table see only registered partitions. And a projected partition with no files returns nothing rather than an error, so tables with mostly empty projected ranges plan slower than they would with registered partitions.

For very large registered partition lists, **partition indexes** in the Glue Data Catalog are the alternative. Athena uses them once the table property `partition_filtering.enabled` is set to `true`.

---

## Writing Data with Athena

Athena writes as well as reads, which makes it a lightweight transformation engine for data already in S3.

- **CREATE TABLE AS SELECT (CTAS)** runs a query and writes the result as a new table, in the format, compression, and partitioning you choose. It's the quickest way to convert JSON to partitioned Parquet or to build a smaller summary table for a dashboard.
- **INSERT INTO** appends a query's results to an existing table.

Each CTAS or INSERT INTO statement can write at most 100 partitions, so converting a table with years of daily partitions takes a CTAS for the first 100 and a series of INSERT INTO statements for the rest, each covering a non-overlapping range. A CTAS `external_location` must be empty, so rerunning the statement means deleting its output first.

```sql
CREATE TABLE curated.daily_events
WITH (
  format = 'PARQUET',
  write_compression = 'SNAPPY',
  external_location = 's3://lake/curated/daily_events/',
  partitioned_by = ARRAY['dt']
) AS
SELECT user_id, event_type, event_time, dt
FROM raw.events
WHERE dt BETWEEN '2026-06-01' AND '2026-08-31';
```

Through Athena, a plain Parquet or JSON table only takes appends with `INSERT INTO`. Replacing a partition means deleting its files in S3 and inserting again. **Apache Iceberg** tables, an open table format that tracks a table's files through metadata snapshots, support `UPDATE`, `DELETE`, and `MERGE INTO`, so late-arriving corrections and upserts become SQL statements. Iceberg tracks partitions in its own metadata, so there is nothing to register and filters prune without partition columns in the query. A CTAS creates one with `table_type = 'ICEBERG'` in its `WITH` clause, and uses `location` and `partitioning` in place of the `external_location` and `partitioned_by` properties in the example above.

Iceberg keeps every snapshot until told otherwise, which enables **time travel**, querying a table as of an earlier snapshot, and costs storage. Tables need regular maintenance: `OPTIMIZE` compacts the small files that updates and streaming leave behind, and `VACUUM` expires old snapshots and removes files nothing references. Athena reads and writes Iceberg format version 2, so tables written as version 3 by newer Spark engines, such as Glue 6.0, can't be read by Athena SQL.

---

## Workgroups and Cost Controls

A **workgroup** separates users, applications, or teams, and holds the settings their queries run with:

- **Query result location and encryption.** Athena writes every query's result to S3. A workgroup can use a bucket you own, or **managed query results**, where Athena stores results itself at no charge for 24 hours and then deletes them, with access controlled by IAM permissions on the workgroup rather than a bucket policy.
- **Engine version.** Workgroups upgrade automatically by default. Pinning a version lets you test a new one in a separate workgroup first.
- **Per-query scan limit.** A query that would scan more than the limit is cancelled, which stops an unfiltered query against a large table from costing tens of dollars.
- **Workgroup data usage alarms.** Thresholds on total bytes scanned per period send alerts through CloudWatch and SNS when a team's usage climbs.
- **Enforcement.** With workgroup settings enforced, users can't override them per query.

Tag workgroups for cost allocation, and grant users `athena:StartQueryExecution` on specific workgroups in IAM, so each team's queries land in its own workgroup and its own line in Cost Explorer. Queries also need permission to read the catalog tables and the S3 data. For tables registered with **AWS Lake Formation**, the service that manages table, column, and row permissions over the catalog, Athena enforces those grants at query time and reads the data with credentials Lake Formation issues.

---

## Reusing Results

**Query result reuse** returns a previous result instead of running the query again. It is off unless a query asks for it, by enabling it in the console or API with a maximum age from 60 minutes (the default) up to 7 days. It applies within one workgroup, to `SELECT` and `EXECUTE` statements whose text matches, ignoring whitespace and comments for queries under 100 KB.

Reuse doesn't check whether the source data changed within the maximum age, so a result can be stale by up to that age. It doesn't apply to tables with Lake Formation row or column filters, to sources outside S3 reached through connectors, to non-deterministic queries such as `LIMIT` without `ORDER BY`, or to workgroups using managed query results. It fits dashboards that refresh often over data that changes hourly or daily.

---

## Capacity Reservations

Per-TB pricing makes cost follow data volume, and it gives no control over how many queries run at once. **Capacity Reservations** instead buy dedicated query capacity in **DPUs** (data processing units, each about 4 vCPU and 16 GB) at $0.30 per DPU-hour, billed per minute, from 4 DPUs upward in steps of 4. Queries in workgroups assigned to the reservation don't pay per TB scanned, and they run only on the reserved capacity, queuing when it is busy.

Athena gives each DML query between 4 and 124 DPUs depending on its complexity, and each DDL statement 4, so a small reservation runs only a few queries at a time and queues the rest, for up to 10 hours. A reservation of 24 DPUs costs about $7.20 an hour whether queries run or not, the same as scanning 1.44 TB an hour on demand.

A reservation belongs to one account and Region. Up to 20 workgroups can share one, and a workgroup uses at most one. Queries on a reservation don't count against the account's active query quotas, which keeps interactive on-demand queries from being throttled by scheduled work. Capacity requests aren't guaranteed and can take up to 30 minutes, so add capacity ahead of a known peak rather than during it. A reservation makes sense when heavy, steady query volume would cost more per TB than the DPUs would, or when one workload must not be slowed by others, and reservations and per-query billing can run side by side in one account.

---

## Querying Beyond S3

- **Federated queries** reach sources outside S3, such as DynamoDB, RDS and Aurora, Redshift, OpenSearch, CloudWatch Logs, and third-party databases, through data source connectors that run as Lambda functions in your account. A query can join S3 tables with them. Connector Lambda invocations are billed separately, and pushing filters down to the source matters, because the connector pulls whatever it reads over the network.
- **S3 Tables**, S3's managed Iceberg table buckets, are queryable through the catalog that integrates them with the Glue Data Catalog.
- **Apache Spark in Athena** runs PySpark code in notebooks or through Spark Connect, billed at $0.35 per DPU-hour, for analysis and transformation that needs more than SQL.

---

## Limits That Shape Designs

- A DML query (`SELECT`, CTAS, `INSERT INTO`) times out after 30 minutes by default, raisable to 240. Queries that need longer are usually scanning far more than they should.
- The number of active DML queries per account is a quota that varies by Region and counts queued queries too. Exceeding it returns a throttling error to the caller, so applications that fire many concurrent queries need retries or a Capacity Reservation.
- On-demand queries can wait in a queue before running when the service is busy, which makes their latency variable. Capacity Reservations make it predictable, since queries wait only for your own reserved capacity.

---

## When Athena Is the Wrong Engine

- **Many concurrent dashboard queries with steady, predictable load.** A warehouse such as Amazon Redshift, with data loaded into its own storage, gives consistent latency and caching for repeated queries. Athena Capacity Reservations are the middle ground.
- **Point lookups and operational queries.** Fetching one customer's record in milliseconds is a database's job, such as DynamoDB, Aurora, or ElastiCache.
- **Transformations that need code.** Joins and aggregations are SQL, and CTAS handles them. Parsing irregular files, calling APIs, or custom logic fits Spark, in Athena itself, Glue, or EMR, or small functions in Lambda.
- **High-frequency small writes.** Athena writes in batches through CTAS, `INSERT INTO`, and Iceberg DML. Streams belong in Kinesis or Firehose, landing in S3 for Athena to query.

---

## Common Pitfalls

- **`HIVE_TOO_MANY_OPEN_PARTITIONS`.** A CTAS or INSERT INTO tried to write more than 100 partitions. Split it into statements over non-overlapping ranges.
- **`TooManyRequestsException` from Athena.** The account hit its active query quota, queued queries included. Add retries with backoff, spread scheduled queries out, or move steady workloads to a Capacity Reservation.
- **`SlowDown` errors from S3.** Queries are reading so many small files under one prefix that they exceed S3's request rate. Compact the files, and stagger concurrent queries over the same data.
- **Partitions that outlive their data.** `MSCK REPAIR TABLE` only adds partitions. When lifecycle rules delete old files, remove their partitions too, or every query that matches them still lists empty folders.
- **Ungoverned result buckets.** Results in your own bucket persist until a lifecycle rule deletes them, and they can contain sensitive query output. Use managed query results, or a lifecycle rule and encryption on the bucket.

---

## Key Takeaways

- Athena runs Trino-based SQL over S3 through the Glue Data Catalog, with no infrastructure and, on per-query billing, no query charges while idle.
- On-demand queries cost $5 per TB scanned with a 10 MB minimum, so format, partitioning, file size, and column selection decide the bill.
- Partitions must be registered to be visible. Partition projection computes them instead, for Athena only.
- CTAS and INSERT INTO write up to 100 partitions per statement, and plain tables only take appends. Iceberg tables add updates, deletes, `MERGE`, time travel, and their own partition tracking, and need regular `OPTIMIZE` and `VACUUM`.
- Workgroups hold result settings, engine version, scan limits, and cost tags. Managed query results remove the result bucket.
- Result reuse is opt-in with a maximum age of up to 7 days. Capacity Reservations trade per-TB billing for dedicated DPUs at $0.30 per DPU-hour.
- Use a warehouse for steady high-concurrency BI, a database for point lookups, and Spark engines for transformation that needs code.
