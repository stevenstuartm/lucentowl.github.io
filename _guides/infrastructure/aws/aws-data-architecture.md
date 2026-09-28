---
title: "Data Architecture on AWS: Lakes, Warehouses & Lakehouses"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "How AWS's analytics services fit together and how to choose among them: data lakes on S3, Redshift warehouses, and lakehouses built on Apache Iceberg, S3 Tables, and the SageMaker lakehouse catalog; ingestion paths; choosing a query and processing engine; and governing access across accounts with Lake Formation."
tags: [data-lake, lakehouse, lake-formation, s3-tables, apache-iceberg, decision-making, practical]
---

## The Parts of an AWS Data Platform

An analytics platform on AWS is assembled from services that each do one job, and most of the design work is deciding which of them a given dataset passes through. The lake, warehouse, and lakehouse ideas this guide maps onto AWS are covered as concepts in [Data Architecture](/study-guides/data/data-architecture.html). This guide maps each part to the AWS services that play it.

| Job | AWS services |
|---|---|
| **Bring data in** | Zero-ETL integrations, Amazon Data Firehose, Kinesis Data Streams, Amazon MSK, AWS DMS, Glue jobs, file drops to S3 |
| **Store it** | S3 general purpose buckets holding open file formats, S3 table buckets holding managed Apache Iceberg tables, Redshift Managed Storage |
| **Describe and govern it** | AWS Glue Data Catalog, AWS Lake Formation, the lakehouse catalog in Amazon SageMaker |
| **Transform it** | Glue, Amazon EMR and EMR Serverless, Athena and Redshift SQL, Managed Service for Apache Flink |
| **Query and present it** | Athena, Redshift, Amazon Quick Sight, OpenSearch Service |

Two choices shape everything else: where each dataset is stored, and which catalog describes it. Engines can be swapped later if the data sits in an open format under a shared catalog. Data locked into one engine's storage can only be read by that engine or by copying it out.

---

## Where Data Lives

### A data lake on S3

A **data lake** on AWS is S3 buckets holding files in open formats, usually Parquet, a columnar format that stores each column separately so queries read only the columns they need. Tables in the Glue Data Catalog describe the files, and Athena, EMR, Glue, and Redshift Spectrum (Redshift's feature for querying S3 files in place) query them. A lake stores anything, raw or refined, at S3 prices, costs nothing to query when idle, and lets many engines read the same files. Most lakes keep raw feeds separate from cleaned and curated layers, so raw data can be reprocessed when logic changes.

On AWS, plain files have three practical limits. A job that fails halfway leaves partial output that readers can see, deleting or correcting individual rows means rewriting whole files, and small files from streaming slow every query until something compacts them.

### A warehouse on Redshift

A **warehouse** loads data into Redshift's own managed storage, where it's sorted, distributed across nodes, and cached for fast joins and consistent dashboard latency under many concurrent users. It supports transactions, updates, and `MERGE`. The price is that data must be loaded before it's queried, and that other engines reach it through Redshift, through data sharing (Redshift's live, copy-free access for other warehouses), or, once its tables are published to a Redshift managed catalog in the lakehouse architecture described below, through that catalog's Iceberg REST endpoint.

### A lakehouse of open tables that behave like a warehouse

A **lakehouse** keeps data in open storage but gives it warehouse behavior through a table format. On AWS that format is **Apache Iceberg**, which tracks a table's files through metadata snapshots and so adds transactions, row-level updates and deletes, schema changes without rewrites, and queries against earlier snapshots. Athena, Redshift, EMR, Glue, and Firehose all read or write Iceberg, and Quick Sight reads it through Athena or Redshift, so one copy of a table serves all of them. Every update leaves a snapshot and files behind, so Iceberg tables need maintenance: compaction merges small files, snapshot expiry drops old versions, and orphan file cleanup deletes files no snapshot references any more.

Iceberg tables can live in two places:

| | Iceberg in a general purpose bucket | S3 Tables (table buckets) |
|---|---|---|
| **Who maintains the table** | You, by running compaction, snapshot expiry, and orphan file cleanup, for example with Glue table optimization or Athena's `OPTIMIZE` and `VACUUM` | S3, automatically, configured per table for compaction and snapshots and per table bucket for file cleanup |
| **Access control** | S3 bucket policies and IAM on objects, plus Lake Formation | The separate `s3tables` IAM namespace, down to individual tables, plus Lake Formation. Public access is always blocked |
| **Engines find it through** | The Glue Data Catalog | The Glue Data Catalog, after integrating the table bucket, or an Iceberg REST catalog endpoint |
| **Price** (US East, N. Virginia) | S3 Standard storage and requests, plus whatever maintenance jobs cost | $0.0265 per GB-month for the first 50 TB, a monitoring fee of $0.025 per 1,000 objects, and compaction billed per object and GB processed |

S3 Tables fit teams that want Iceberg without operating its maintenance, and workloads with many small writes, such as streaming ingestion, where compaction matters most. Firehose and, since August 2026, Kinesis Data Streams can deliver directly into S3 Tables. The trade-offs are that every table must be Iceberg, that data is reached through the S3 Tables API and table-aware engines rather than ordinary S3 object tools, and that engines need the catalog integration or the REST endpoint to find tables.

The **lakehouse architecture of Amazon SageMaker** ties these stores together in one catalog. Built on the Glue Data Catalog and Lake Formation, it organizes data into **catalogs**, each holding databases that hold tables. **Managed catalogs** store their tables in S3, including S3 table buckets, or in Redshift Managed Storage. **Federated catalogs** mount existing sources and query them in place, such as a Redshift warehouse, DynamoDB, or Snowflake. Any Iceberg-compatible engine can read these tables through its Iceberg REST endpoint, and Redshift mounts the catalogs as databases. That lets a table stored in Redshift be read by Spark on EMR, and a table in S3 be joined in Redshift, without copying either. Spark reads and writes of Redshift-stored tables run on a managed Redshift Serverless workgroup that the catalog creates, which is compute to budget for. **SageMaker Unified Studio** is the workspace over the same catalog, bringing SQL, notebooks, pipelines, and ML tools together for data teams.

{% include figure.html id="aws-lakehouse-catalogs" %}

### Choosing where each dataset lives

| Dataset | Store it as |
|---|---|
| Raw feeds kept for reprocessing | Files in a general purpose bucket, in the format they arrived, with lifecycle rules |
| Refined tables read by several engines, or updated in place | Iceberg, in S3 Tables unless you already run your own table maintenance |
| Append-only, well-partitioned history read mostly by Athena | Parquet in a general purpose bucket is enough |
| Tables behind many concurrent dashboards needing consistent latency | Redshift tables, or Iceberg tables with Quick Sight's in-memory SPICE copy in front, refreshed on a schedule |
| Operational data replicated for analysis | Wherever the zero-ETL integration targets: Redshift, or Iceberg tables in S3 |

A platform usually ends up with all of these, which is why a shared catalog matters more than any one storage choice.

---

## Getting Data In

| Source | Path |
|---|---|
| Aurora, RDS, DynamoDB, and some SaaS applications | **Zero-ETL integrations**, managed replication into Redshift or Iceberg tables with no pipeline to build. Aurora and RDS changes arrive within seconds, and DynamoDB every 15 to 30 minutes |
| Other databases, including on premises | **AWS DMS**, for full loads and ongoing change data capture into S3 or Redshift |
| Event streams and logs | **Firehose**, which buffers records, converts them to Parquet, and writes to S3, Iceberg tables, S3 Tables, Redshift, or OpenSearch, or **Kinesis Data Streams** and **Amazon MSK** when several consumers need the stream |
| Files from partners and batch exports | Drops into an S3 prefix that trigger a Glue job, or a Redshift auto-copy job that loads new files as they arrive |
| Transformation between layers | **Glue** or **EMR Serverless** for Spark, **Athena** or **Redshift** SQL for set-based work, **Flink** for continuous transformation |

Zero-ETL deserves the first look for operational databases, because a pipeline nobody writes is a pipeline nobody maintains. Its limits are that it replicates tables as they are, so reshaping still happens downstream, and that it supports a fixed list of sources and targets.

---

## Choosing Engines

Most platforms run several engines over the same data. This tree picks the primary one for a workload:

```
What does the workload need?
├── Ad hoc SQL over the lake, occasional queries, SQL over archived logs → Athena
├── Dashboards or reports for many concurrent users
│   ├── Data changes daily or less, moderate size → Quick Sight with SPICE, refreshed from Athena
│   └── Large data, complex joins, steady load → Redshift (Serverless or provisioned)
├── Batch transformation
│   ├── Expressible in SQL → Athena CREATE TABLE AS SELECT and INSERT, or Redshift SQL
│   └── Needs code, custom logic, or large joins in Spark
│       ├── Periodic jobs, minimal tuning → Glue
│       └── Long-running, tuned, or version-specific Spark → EMR or EMR Serverless
├── Continuous processing of streams with state (windows, joins) → Managed Service for Apache Flink
├── Search, text relevance, interactive exploration of recent logs → OpenSearch Service
└── Single-record lookups for an application → a database (DynamoDB, Aurora), not an analytics engine
```

The tree picks a starting point, not a boundary. A common shape runs Glue or EMR to build curated Iceberg tables, Athena for exploration, Redshift for heavy BI on the hottest data, and Quick Sight in front of both.

---

## Governing Access with Lake Formation

With many engines reading the same data, permissions can't live in each engine. **AWS Lake Formation** holds them centrally, as grants on catalog objects that every integrated engine enforces, including Athena, Redshift Spectrum, EMR, Glue, and Quick Sight.

### How Lake Formation permissions work

An administrator **registers** S3 locations with Lake Formation, which then accesses them with its own role. Instead of granting users S3 permissions, Lake Formation **vends temporary credentials** to an engine for the specific data a query is allowed to read. Access is granted like database permissions:

- **Grants** on databases, tables, and columns, such as `SELECT` on `sales.orders` except `customer_email`.
- **Data filters** restrict rows and cells, such as `region = 'EU'` combined with hiding a column, for row- and cell-level security.
- **LF-Tags** are labels such as `domain = sales` or `sensitivity = pii` attached to databases, tables, and columns. Granting on a tag expression instead of named tables, called tag-based access control, lets permissions for thousands of tables follow their tags as tables are added.

Lake Formation augments IAM rather than replacing it. New catalog resources start with a default grant to a group called `IAMAllowedPrincipals`, which leaves IAM policies in control, and Lake Formation grants have no effect on a table until that default is removed. **Hybrid access mode** makes the move gradual. An S3 location is registered in hybrid mode, and specific principals are then opted in to Lake Formation permissions for specific catalogs, databases, or tables, while everyone else keeps using IAM. Lake Formation logs grants and each credential request in CloudTrail.

Engines don't support every operation on governed tables. Athena, for example, runs no DDL on Iceberg tables registered with Lake Formation, and a row or cell filter on a table blocks queries against its Iceberg metadata tables. Check each engine's Lake Formation support before relying on it for a workload.

### Sharing across accounts

Platforms are often split into a **producer** account per data domain and **consumer** accounts per team. A producer grants a database or table to another account, an organization, or an IAM principal in another account, and Lake Formation shares it through AWS Resource Access Manager. The consumer creates a **resource link**, a catalog entry pointing at the shared table, and queries it in place with its own engines and its own bill. No data is copied, and the producer can revoke access at any time. Redshift data sharing, which covers tables stored in Redshift, can be governed by Lake Formation the same way.

Raw grants scale poorly when many teams need to find data and ask for it. **Amazon SageMaker Catalog**, the business catalog in SageMaker Unified Studio built on Amazon DataZone, adds a publish and subscribe workflow on top. Producers publish tables with business descriptions, consumers search and request access, and when a producer approves, the catalog creates the Lake Formation or Redshift grants itself.

---

## Where the Money Goes

- **Storage** is rarely the largest line. S3 Standard is about $0.023 per GB-month, S3 Tables $0.0265, and Redshift Managed Storage $0.024, and lifecycle rules move raw data that nobody reads to colder classes.
- **Query and compute** usually dominate: Athena's $5 per TB scanned, Redshift Serverless capacity-hours or provisioned node-hours, and Glue and EMR job hours. Columnar formats, partitioning, and compaction cut all of them, because every engine bills for what it reads or how long it runs.
- **Duplication** is the hidden cost. Each copy of a dataset, in another format, another account, or another engine's storage, adds storage, a pipeline to keep it current, and a chance to disagree with the original. Shared catalogs, Iceberg, and cross-account sharing exist largely to avoid copies.
- **Small files** raise costs everywhere, through S3 request charges, slower scans, and S3 Tables monitoring fees per object.

---

## Common Pitfalls

- **A catalog per engine.** Tables defined separately in each tool drift apart. Keep one Glue Data Catalog, shared across accounts through Lake Formation.
- **Copying data to share it.** Exporting tables to another account's bucket creates copies that fall out of date. Share catalog tables with Lake Formation, or share Redshift data through datashares.
- **Mutable data in plain Parquet.** Tables that need corrections or deletions end up rewritten by hand-built jobs. Make them Iceberg tables.
- **Iceberg tables nobody maintains.** Without compaction and snapshot expiry, Iceberg tables in general purpose buckets grow slower and more expensive. Schedule maintenance, or use S3 Tables.
- **Lake Formation grants that do nothing.** While the default `IAMAllowedPrincipals` grant remains on a table, IAM policies still decide access. Opt principals in with hybrid access mode or remove the default, and then remove direct S3 access once tables are governed.

---

## Key Takeaways

- An AWS data platform combines ingestion, storage, a catalog, processing engines, and serving tools. Storage and catalog choices outlast engine choices.
- A lake on S3 is cheap and open but lacks transactions. Redshift gives warehouse performance for data loaded into it. A lakehouse uses Apache Iceberg to give open tables transactions, updates, and time travel.
- S3 Tables store managed Iceberg tables with automatic maintenance. The SageMaker lakehouse architecture puts S3, S3 Tables, Redshift, and federated sources behind one catalog that any Iceberg engine can query.
- Zero-ETL, DMS, Firehose, and Kinesis cover most ingestion. Choose Athena for ad hoc SQL, Redshift for heavy concurrent BI, Glue or EMR for code-based transformation, Flink for stateful streams, and OpenSearch for search.
- Lake Formation holds permissions centrally, down to rows and cells and by LF-Tags, vends credentials to engines, and shares tables across accounts without copies. SageMaker Catalog adds discovery and approval workflows on top.
