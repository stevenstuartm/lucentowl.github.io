---
title: "AWS Glue: Data Catalog & Serverless ETL"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "How AWS Glue catalogs data and runs serverless Spark ETL: the Data Catalog as the shared metadata layer, crawlers and their schema policies, job types, worker types, Flex execution, job bookmarks for incremental loads, orchestration, VPC connections, pricing, and when EMR, Athena, or Lambda fits better."
tags: [glue, data-catalog, etl, apache-spark, crawlers, job-bookmarks, practical]
---

## What Glue Does

AWS Glue is two services that happen to share a name and a console. The **Data Catalog** is a metadata store. It records which tables exist, what their columns are, how they are partitioned, and where their files live in S3. **Glue ETL** runs Apache Spark and Python jobs on compute that Glue provisions for each run and releases afterward, so there is no cluster to size or keep running. **Crawlers** connect the two by reading data and writing table definitions into the catalog.

Everything in Glue is Regional. Each account has one Data Catalog per Region, and jobs, crawlers, and connections live in a Region too. A table in the `us-east-1` catalog is invisible to Athena in `eu-west-1` unless it is shared or defined again there.

---

## The Data Catalog

The catalog holds **databases**, which are namespaces, and **tables**, each with a schema, a storage format, an S3 location, and optionally **partitions**. A partition is a subset of a table's files, usually a date or a key value encoded in the S3 path such as `s3://lake/events/dt=2026-09-28/`, so a query that filters on `dt` reads only that folder. The catalog is compatible with the Apache Hive metastore, the table registry that Hadoop-era engines such as Hive, Spark, and Presto already know how to read, which is why so many engines can use it.

The catalog stores metadata only. The data stays in S3, and each engine reads it directly after looking up where it is:

{% include figure.html id="aws-glue-catalog-paths" %}

That split is what makes the catalog the center of an S3 data lake. Athena, Redshift Spectrum, EMR, and Glue jobs all read the same table definitions, so a table defined once is queryable from each of them, and Lake Formation can govern access to all of them in one place. It also means a catalog entry can be wrong: if files are written with a new column and nobody updates the table, every engine keeps reading the old schema.

A few catalog features matter at scale:

- **Partition indexes** let the catalog return only the partitions a filter matches instead of every partition, which matters once a table has tens of thousands of partitions. Crawlers create them by default for S3 and Delta Lake crawl targets. Redshift Spectrum, EMR, and Glue jobs working with Spark DataFrames use them automatically. Athena needs the table property `partition_filtering.enabled` set to `true`, and a Glue job reading DynamicFrames needs a server-side `catalogPartitionPredicate`.
- **Apache Iceberg tables** are first-class. Iceberg is an open table format that tracks a table's files through metadata snapshots, which gives S3 tables transactional writes, updates, and deletes. The catalog can run **table optimization** for Iceberg tables, compacting small files, expiring old snapshots, and deleting orphan files no snapshot references, billed by compute time like a job.
- **Access** is controlled by IAM policies, by a catalog resource policy for cross-account sharing, or by AWS Lake Formation, which adds column- and row-level grants on top. Lake Formation is the usual choice once more than one team shares a lake. It also issues the temporary credentials engines use to read the table's files, so users querying through a supported engine don't need their own S3 permissions on the table's location.
- **Encryption** of catalog metadata with a KMS key is a per-catalog setting, off by default.

The catalog is free up to 1 million stored objects (tables, partitions, and other metadata entries) and 1 million requests a month, then $1 per 100,000 objects and $1 per million requests. Tables with deep time-based partitioning are what push a catalog past the free tier.

---

## Crawlers

A **crawler** reads a data store, such as an S3 path, a relational database over JDBC (Java Database Connectivity), or a DynamoDB table, infers the schema and format from a sample, and creates or updates tables and partitions in the catalog. For S3 it recognizes Hive-style `key=value` folders as partitions.

What a crawler does when data changes is configurable. By default it rewrites the table's schema to match the data it finds, and marks a table whose data has disappeared as deprecated rather than deleting it:

| Setting | Options | Effect |
|---|---|---|
| **Update behavior** | Update the table, add new columns only, or ignore the change and only log it | Whether a new column or changed type rewrites the catalog table. Adding new columns only keeps hand-edited types while picking up new fields |
| **Delete behavior** | Delete the table, mark it deprecated, or only log | What happens when the files behind a table disappear |
| **Recrawl policy** | Crawl everything, only new folders, or S3 event mode | Whether each run lists the whole path, only new partitions, or only the folders that S3 event notifications (delivered through SQS) say changed |
| **Grouping** | Separate tables, or one schema per include path | Whether similar folders become one table or many |

A crawler pointed at a path with inconsistent files can create hundreds of tables, one per folder it can't reconcile. Setting a maximum table threshold and a single schema per include path prevents that.

Crawlers cost $0.44 per DPU-hour with a 10-minute minimum per run. For tables whose schema is known and stable, defining them in CloudFormation, CDK, or Terraform and registering partitions from the job that writes them is cheaper and more predictable than crawling. A Glue job registers new partitions itself when it writes through a catalog sink with `enableUpdateCatalog` set, for JSON, CSV, Avro, and Parquet output in S3. For time-partitioned data that only Athena reads, Athena's partition projection computes partitions from a pattern and needs no registered partitions, but EMR, Redshift Spectrum, and Glue jobs still read the catalog's partition list. Crawlers earn their place where many teams drop data with schemas nobody declared in advance.

---

## ETL Jobs

### Job types

| Type | Runs | Fits |
|---|---|---|
| **Spark** | Distributed Apache Spark in Python (PySpark) or Scala, minimum 2 DPUs, 10 by default | Batch transformation of gigabytes to terabytes: joins, aggregation, format conversion |
| **Spark Streaming** | Spark Structured Streaming against Kinesis Data Streams or Kafka, saving progress to S3 as checkpoints so a restarted job resumes where it stopped | Continuous transformation. The default micro-batch mode processes accumulated records every few seconds or minutes. Glue 6.0 adds a sub-second real-time mode for stateless Kafka pipelines written in Scala |
| **Python shell** | One Python process on 0.0625 or 1 DPU | Small tasks: API calls, light file handling, a SQL statement against Redshift |
| **Ray** | Distributed Python on Ray | Closed to new customers since April 30, 2026. AWS points to KubeRay on EKS |

A **DPU** (data processing unit) is 4 vCPUs and 16 GB of memory, and it is the unit Glue bills in. Jobs run on a **Glue version** that fixes the Spark and Python versions. Glue 5.1 (Spark 3.5) is the default for new jobs, and Glue 6.0 (Spark 4.1, August 2026) costs about 30% less per DPU-hour. Glue 0.9, 1.0, and 2.0 reached end of life on April 1, 2026. **Generative AI upgrades for Apache Spark** analyze a job and rewrite its script for a newer version, and the result still needs testing, because Spark major versions change behavior. Spark 4.1 turns ANSI SQL mode on by default, for example, so an integer overflow or invalid cast that returned null on Glue 5.1 throws an exception on Glue 6.0.

### Worker types

A Spark job runs on a number of workers of one type:

| Worker | Resources | Use |
|---|---|---|
| **G.1X, G.2X** | 1 or 2 DPUs (4 vCPU, 16 GB per DPU) | Most jobs |
| **G.4X, G.8X** | 4 or 8 DPUs | Heavy joins and aggregations, and large shuffles, where Spark redistributes rows between workers |
| **G.12X, G.16X** | 12 or 16 DPUs | The largest jobs. Slower to start, Glue 4.0 or later, and in a limited set of Regions |
| **R.1X to R.8X** | 1 to 8 M-DPUs, each 4 vCPU with 32 GB, double a DPU's memory | Jobs that fail with out-of-memory errors on G workers. Billed at a higher rate, slower to start, and limited like G.12X |

**Auto scaling** lets a job use fewer workers than its maximum when stages need less parallelism, and **Flex execution** runs non-urgent jobs on spare capacity for about a third less, at the cost of a less predictable start time. Flex works only for Spark batch jobs on Glue 3.0 or later with G.1X or G.2X workers. It suits nightly batch, tests, and backfills, and not jobs on a deadline.

Two job defaults catch teams out. A job's timeout defaults to 480 minutes on Glue 5.0 and later (2,880 on earlier versions, 7 days at most), and a run that times out isn't retried. **Maximum concurrency** defaults to 1, so a scheduled run that starts while the previous run is still going fails instead of waiting, unless job run queuing is enabled.

### DynamicFrames and pushdown

Glue's Spark library adds the **DynamicFrame**, a DataFrame variant that tolerates records whose fields disagree. A column that is a string in some files and a number in others becomes a **choice type**, which `resolveChoice` settles, for example by casting everything to a string. DynamicFrames also read from and write to catalog tables by name. Regular Spark DataFrames work too, and a job can convert between them. A **pushdown predicate** on a catalog read filters the table's partition list before any file is listed, which is the difference between reading one day and reading the whole table.

This job reads one day, cleans it, and replaces that day's output, so running it twice for the same date leaves one copy of the data rather than two. Its DataFrame write goes straight to S3 and doesn't register the partition in the catalog, so a table over this path also needs a crawler, a partition-adding step, or a catalog sink with `enableUpdateCatalog` instead:

```python
import sys
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ["JOB_NAME", "run_date"])
glue = GlueContext(SparkContext.getOrCreate())
job = Job(glue)
job.init(args["JOB_NAME"], args)

events = glue.create_dynamic_frame.from_catalog(
    database="raw",
    table_name="events",
    push_down_predicate=f"dt = '{args['run_date']}'",
    transformation_ctx="events_source",
)

cleaned = events.resolveChoice(specs=[("user_id", "cast:string")]).drop_fields(["debug"])

spark = glue.spark_session
spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
(cleaned.toDF()
    .write.mode("overwrite")
    .partitionBy("dt")
    .parquet("s3://lake/curated/events/"))

job.commit()
```

### Incremental loads with job bookmarks

A **job bookmark** records what a job has already processed, so the next run reads only what is new. It is off by default and enabled per job. For S3 sources, Glue compares object last-modified times against the previous run's state. For JDBC sources, it tracks one or more **bookmark key** columns, the primary key by default if it increases without gaps. Bookmarks work only for S3 (JSON, CSV, Avro, XML, Parquet, ORC) and JDBC sources, not for DynamoDB or streams.

Three details decide whether bookmarks work:

- Each source needs a `transformation_ctx`, the key the bookmark state is stored under, and the script must call `job.commit()` at the end. A job that fails before the commit reprocesses that run's input next time.
- An S3 object that is rewritten in place gets a new modification time and is processed again, so rewriting files upstream causes duplicates downstream.
- Bookmarks track sources, not targets. Rewinding or resetting a bookmark reprocesses input without removing what earlier runs wrote, so a backfill needs a clean target or an idempotent write, such as overwriting the partitions it produces.

Jobs reading tables that Lake Formation protects with row- or cell-level filters lose job bookmarks, pushdown predicates, catalog partition predicates, and `enableUpdateCatalog`, so plan incremental loads differently for those tables.

### Developing and debugging jobs

Jobs are usually written interactively first. **Interactive sessions** run a Spark session on Glue from a Jupyter notebook, Glue Studio's notebook, or a local IDE, billed per DPU-second while the session is active, and an idle timeout ends forgotten sessions. **Glue Studio's visual editor** builds jobs as a graph of sources, transforms, and targets and generates the script. For a slow or failing job, the **Spark UI**, **continuous logging** to CloudWatch Logs while the job runs, and **job metrics** show which stage is slow, whether workers sat idle, and whether the driver ran out of memory.

### Writing open table formats

Plain Parquet folders can only be appended to or overwritten a partition at a time. Enabling Iceberg, Hudi, or Delta Lake in a job with the `--datalake-formats` parameter lets it write tables that support `MERGE`, updates, and deletes, which is how most pipelines now handle upserts and late-arriving data. Iceberg format version 3 tables written by Glue 6.0 can't yet be read by Athena SQL, so keep tables other engines share on version 2.

---

## Orchestrating Jobs

A pipeline is usually a chain: a crawler or partition update, then one or more jobs, then a notification. Glue can run that itself with **triggers**, which start jobs on a schedule, on demand, or when earlier jobs or crawlers finish, and **workflows**, which group triggers, jobs, and crawlers into a graph whose steps can pass values to each other through shared run properties.

Glue's orchestration only knows about Glue. A pipeline that also calls Lambda, waits for an approval, or loads Redshift is easier to build in **Step Functions**, which starts a Glue job and waits for it with a `.sync` integration, or in **Amazon MWAA** (managed Apache Airflow) when a team already writes pipelines as Airflow DAGs. **EventBridge** can start a pipeline when Glue reports a job state change or when files land in S3.

---

## Reaching Private Data Stores

Jobs that read an RDS database or a Redshift cluster in a VPC use a **connection**, which names one subnet, security groups, and credentials, preferably a Secrets Manager secret. Glue places network interfaces for the job's workers in that subnet, so every worker runs in that subnet's Availability Zone and the subnet needs a free IP address for each one. The security group needs a self-referencing inbound rule for all TCP ports, because Glue workers talk to each other through it. Without a NAT gateway, the job reaches S3 through an S3 gateway endpoint, and reaches other AWS APIs through interface endpoints for them.

The job's IAM role grants what the script touches: the S3 paths, the catalog databases and tables, the secret, and CloudWatch Logs. Scope S3 access to specific buckets and prefixes rather than `s3:*`.

---

## Data Quality

**Glue Data Quality** evaluates rules written in a small rule language, DQDL, such as completeness of a column, uniqueness of a key, or a value range, either against catalog tables or inside a job as a step. A job can stop or route bad records when rules fail, rather than loading them. It can also compute statistics over time and flag anomalies, like a row count far below normal, without hand-written rules. It is billed per DPU-hour like a job.

---

## What Glue Costs

In US East (N. Virginia):

| Item | Glue 5.1 and earlier | Glue 6.0 |
|---|---|---|
| Spark and streaming jobs, per DPU-hour | $0.44 | $0.308 |
| Flex execution, per DPU-hour | $0.29 | $0.203 |
| R (memory-optimized) workers, per M-DPU-hour | $0.52 | $0.364 |
| Python shell jobs, per DPU-hour | $0.44 | Not version-dependent |
| Crawlers, per DPU-hour (10-minute minimum per run) | $0.44 | Not version-dependent |

Jobs bill per second with a 1-minute minimum. A daily Spark job on 10 G.1X workers that runs 20 minutes uses about 3.3 DPU-hours, roughly $1.47 a run on Glue 5.1, $1.03 on Glue 6.0, and $0.68 with Flex on 6.0, or $20 to $45 a month. Worker count times runtime is the whole bill, so the usual savings come from reading less, through pushdown predicates, bookmarks, and columnar formats, rather than from fewer workers. A job that reads Parquet partitions for one day finishes faster on the same workers than one that scans a year of JSON.

---

## When Glue Is the Wrong Engine

- **Long-running or heavily tuned Spark.** **Amazon EMR** runs Spark, Hive, Presto, and other frameworks on clusters you configure, with any version and library you need, and **EMR Serverless** runs Spark and Hive jobs without clusters while exposing more tuning than Glue. Both suit teams whose Spark work needs control Glue doesn't give.
- **Transformation that is really SQL.** When the data is already in S3 tables or a warehouse, Athena `CREATE TABLE AS SELECT` and `INSERT INTO`, or SQL models run in Redshift (often managed with dbt), are simpler than a Spark job and keep the logic in the language analysts read.
- **Small, event-driven work.** Transforming a file as it arrives, within the 15-minute limit and memory of a standard Lambda function, is cheaper and faster to start in Lambda than as a Glue job with its minute-scale startup.
- **Low-latency stateful streams.** Glue's sub-second real-time mode is limited to stateless Kafka pipelines. Stateful processing at that latency, such as windowed aggregations and joins across streams, fits **Managed Service for Apache Flink**, and delivery of streams to S3 without transformation logic fits **Amazon Data Firehose**.
- **Replication from databases and SaaS applications.** **Zero-ETL integrations** are managed replication that AWS runs from supported sources, such as Aurora, DynamoDB, and some SaaS applications, into Redshift or S3, with no jobs to write.

---

## Common Pitfalls

- **Small files.** Thousands of kilobyte-sized files make Spark spend its time listing and opening files. Write fewer, larger files, around 128 MB to 1 GB for Parquet, by repartitioning before a write or by compacting Iceberg tables with table optimization.
- **Skewed keys.** One key with far more rows than the rest leaves one worker running long after the others finish. Salting, which appends a random suffix to the hot key so its rows spread across several workers and are combined afterward, or an extra partitioning dimension splits it.
- **Overlapping scheduled runs.** With maximum concurrency at its default of 1, a run that starts while the last one is still going fails. Raise the limit only if the job is safe to run twice at once, or enable job run queuing.
- **Silent timeouts on long jobs.** A job that outgrows the 480-minute default stops without a retry. Set the timeout from measured runtimes, with headroom.
- **Upgrading to Glue 6.0 without testing SQL.** ANSI mode turns silent nulls into exceptions. Run the upgraded job against real data before switching the schedule.

---

## Key Takeaways

- The Data Catalog is Regional, metadata-only, and Hive-compatible. Athena, Redshift Spectrum, EMR, and Glue share its table definitions, Lake Formation governs access to them, and the data stays in S3.
- Crawlers infer schemas and partitions, with configurable update, delete, and recrawl behavior. Define stable tables in infrastructure code and let writing jobs register their own partitions.
- Glue runs Spark, Spark Streaming, and Python shell jobs billed per DPU-second. Glue 6.0 costs about 30% less per DPU-hour than 5.1, and Flex execution cuts another third for work that can wait.
- Job bookmarks give incremental loads for S3 and JDBC sources when every source has a `transformation_ctx` and the job commits. They track sources, not targets.
- Glue triggers and workflows orchestrate Glue alone. Step Functions or MWAA orchestrate pipelines that span services.
- Choose EMR or EMR Serverless for Spark that needs control, SQL engines for SQL-shaped transformation, Lambda for small event-driven work, and Flink for low-latency stateful streams.
