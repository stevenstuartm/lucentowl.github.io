---
title: "AWS Athena: Serverless SQL Analytics"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "Serverless SQL queries on S3 data lakes with partition optimization, cost control, and performance tuning strategies"
tags: [aws, data-architecture, analytics, cost-analysis, performance, sql]
---

## What Problems AWS Athena Solves

AWS Athena eliminates the infrastructure complexity and upfront cost of running SQL analytics on large datasets stored in S3.

**Traditional analytics challenges**:
- Organizations spend weeks provisioning and tuning database clusters for ad-hoc analytics
- Analysts need data engineering support to load data from S3 into databases before querying
- Query performance degrades unpredictably as data volume grows
- Teams pay for 24/7 database capacity even when running queries 2 hours per day
- Schema changes require ETL pipeline updates and data reloads

**Concrete scenario**: Your product analytics team needs to query 5 TB of clickstream data stored in S3 to answer questions about user behavior. The existing approach loads subsets into Redshift for analysis, but this process takes 4 hours per dataset and requires dedicated data engineering time. When analysts ask new questions, they wait days for data engineers to prepare the dataset. The Redshift cluster costs $15,000/month but sits idle 18 hours per day. Simple queries work fine, but complex joins and aggregations time out unpredictably.

**What Athena provides**: A serverless query engine that runs SQL directly against S3 data without loading or transforming it first. You define table schemas in the Glue Data Catalog, write standard SQL queries, and Athena scans S3 files in parallel. You pay only for data scanned ($5 per TB), not for servers or idle capacity.

**Real-world impact**: After migrating to Athena, the analytics team eliminated the Redshift cluster and data loading pipelines entirely. Analysts query S3 data directly using SQL they already know. Query costs dropped from $15,000/month to $800/month (160 GB scanned daily × 30 days × $5/TB). Analysts get answers in seconds instead of days because they don't wait for data loading. The team converted raw JSON to Parquet with partitioning, reducing scan volume by 90% and query costs to $80/month.

## Service Fundamentals

AWS Athena is built on Presto (now Trino), a distributed SQL query engine designed for fast analytics across large datasets. Athena runs as a fully managed service. You submit SQL via console, CLI, JDBC/ODBC drivers, or API, and AWS handles all infrastructure provisioning and scaling.

### Core Architecture

**How Athena works**:
1. Define table schemas in Glue Data Catalog (column names, types, S3 location, file format, partitions)
2. Submit SQL query via Athena interface
3. Athena query planner reads table metadata from catalog
4. Athena allocates compute resources automatically
5. Workers read S3 files in parallel, filter/aggregate data
6. Results written to S3 results bucket (or streamed to client)
7. Resources deallocated after query completes

**No persistent infrastructure**: Unlike Redshift or EMR, Athena doesn't maintain running clusters. Every query starts fresh workers, executes, and tears down. This eliminates idle costs but introduces cold-start overhead (typically 1-3 seconds per query).

**Pricing model**:
- **Standard Athena**: $5.00 per TB scanned
- **Query result caching**: Repeat identical queries within 24 hours = free (reads from cache)
- **Failed queries**: No charge if query fails before scanning data
- **DDL operations**: CREATE TABLE, ALTER TABLE, DROP TABLE = free

**Example cost calculation**: Query scans 500 GB across Parquet files.
- Cost: 500 GB ÷ 1,024 GB/TB × $5.00 = $2.44 per query
- Run query 100 times/day: $244/day = $7,320/month
- Enable result caching, 90 queries hit cache: 10 × $2.44 = $24.40/day = $732/month (90% savings)

### Supported Data Formats

Athena reads multiple file formats with varying cost and performance characteristics.

| Format | Compression | Query Performance | Cost Efficiency | Best For |
|--------|-------------|-------------------|-----------------|----------|
| **Parquet** | Columnar + Snappy/Gzip | Excellent | Excellent | Most analytics workloads |
| **ORC** | Columnar + Zlib/Snappy | Excellent | Excellent | Hive-compatible workflows |
| **Avro** | Row-based + Snappy | Good | Moderate | Schema evolution, streaming ingestion |
| **JSON** | Text-based, optionally Gzip | Poor | Poor | Raw data ingestion, ad-hoc exploration |
| **CSV** | Text-based, optionally Gzip | Poor | Poor | Data exchange, legacy compatibility |
| **Parquet (Snappy)** | Columnar + Snappy | Excellent | Best | **Recommended default** |

**Why columnar formats matter**: Athena queries often select a few columns from wide tables (e.g., "SELECT event_type, user_id FROM events" selecting 2 of 50 columns). Columnar formats store each column separately, allowing Athena to read only needed columns. Row-based formats (JSON, CSV) require reading entire rows.

**Example cost comparison**: Query selects 2 columns from 50-column table with 1 TB total size.
- **Parquet**: Reads 2 columns = 40 GB scanned = $0.20
- **JSON**: Reads all columns = 1 TB scanned = $5.00
- **Savings**: 96% cost reduction

<div class="callout callout--tip">
<p class="callout__title">Compression Best Practice</p>
<p>Always compress files. Athena decompresses automatically. Snappy provides good balance of compression ratio and query performance.</p>
</div>

### Partitioning Strategy

Partitioning divides tables into chunks based on column values, allowing Athena to skip reading irrelevant data.

**How partitioning works**: Organize S3 files into directories based on partition keys (commonly date-based).

**Example S3 structure with partitions**:
```
s3://my-bucket/events/
  year=2024/
    month=11/
      day=01/
        events-001.parquet
        events-002.parquet
      day=02/
        events-001.parquet
    month=12/
      day=01/
        events-001.parquet
```

**Table definition with partitions**:
```sql
CREATE EXTERNAL TABLE events (
  event_id STRING,
  user_id STRING,
  event_type STRING,
  timestamp BIGINT,
  properties STRING
)
PARTITIONED BY (
  year INT,
  month INT,
  day INT
)
STORED AS PARQUET
LOCATION 's3://my-bucket/events/'
```

**Register partitions**: After creating partitioned table, add partition metadata.

**Option 1: Automatic (using Glue crawler)**:
```bash
aws glue start-crawler --name events-crawler
```

Crawler discovers partitions and updates catalog.

**Option 2: Manual (using MSCK REPAIR)**:
```sql
MSCK REPAIR TABLE events;
```

Scans S3 and registers partitions matching the Hive pattern (key=value).

**Option 3: Explicit (using ALTER TABLE)**:
```sql
ALTER TABLE events ADD PARTITION (year=2024, month=11, day=15)
LOCATION 's3://my-bucket/events/year=2024/month=11/day=15/';
```

**Query with partition pruning**:
```sql
SELECT event_type, COUNT(*) as count
FROM events
WHERE year = 2024
  AND month = 11
  AND day BETWEEN 1 AND 7
GROUP BY event_type;
```

Athena reads only the specified partitions (7 days), skipping all other data.

**Cost impact**: Without partitioning, query scans entire table (1 year = 365 TB). With daily partitions, query scans 7 days = 7 TB. Cost reduction: $1,825 → $35 (98% savings).

**Partition design guidelines**:
- ✅ Partition by time (year, month, day, hour) when queries filter by date ranges
- ✅ Use multiple partition keys for common query patterns (e.g., year/month/day/region)
- ✅ Target partition sizes of 100 MB - 1 GB (balance between granularity and metadata overhead)
- ❌ Avoid over-partitioning (millions of tiny partitions create catalog performance issues)
- ❌ Avoid partitioning by high-cardinality columns (user_id with millions of values = millions of partitions)

### Query Result Reuse and Caching

Athena caches query results automatically for 24 hours. If you run identical queries within that window, Athena returns cached results instantly without scanning S3.

**How caching works**:
- Athena computes hash of query text and table metadata
- If hash matches previous query within 24 hours, return cached results
- If source data changes (new partitions added, files modified), cache invalidated
- Manual cache refresh: Run query again (cache expires after 24 hours)

**Example caching scenario**: Dashboard refreshes every 5 minutes running same aggregation query.
- First execution: Scans 100 GB = $0.49
- Next 287 executions (24 hours ÷ 5 minutes): $0.00 (cached)
- Daily cost: $0.49 instead of $140.63 (287 × $0.49)

**When caching doesn't help**:
- Queries with non-deterministic functions (NOW(), RAND(), UUID())
- Queries filtering by "last N hours" where N changes (filter values differ)
- Parameterized queries with different parameters each run

**Maximize cache hits**: Standardize query text exactly (whitespace, comments, capitalization matter for hash calculation).

### Workgroups

Workgroups provide query isolation, cost tracking, and resource management for different teams or use cases.

**What workgroups offer**:
- **Cost tracking**: Tag queries by team/project, track spending per workgroup
- **Query result location**: Each workgroup writes results to separate S3 bucket
- **Data usage limits**: Enforce per-query or per-workgroup scan limits
- **Execution parameters**: Set query timeout, encryption settings, engine version
- **IAM integration**: Control which users can submit queries to which workgroups

**Example workgroup configuration**:
```json
{
  "Name": "analytics-team",
  "Description": "Analytics team ad-hoc queries",
  "Configuration": {
    "ResultConfigurationUpdates": {
      "OutputLocation": "s3://analytics-results/",
      "EncryptionConfiguration": {
        "EncryptionOption": "SSE_S3"
      }
    },
    "EnforceWorkGroupConfiguration": true,
    "BytesScannedCutoffPerQuery": 10737418240,  // 10 GB limit
    "EngineVersion": {
      "SelectedEngineVersion": "Athena engine version 3"
    }
  },
  "Tags": [
    {"Key": "Team", "Value": "Analytics"},
    {"Key": "CostCenter", "Value": "12345"}
  ]
}
```

**Use cases**:
- **Multi-tenant environments**: Separate workgroups for each customer/team
- **Cost control**: Set per-query scan limits to prevent runaway queries
- **Environment isolation**: Development vs production workgroups with different result locations
- **Compliance**: Enforce encryption and audit settings per workgroup

## Performance Optimization Strategies

Athena performance depends on data organization, query structure, and resource allocation. Apply these techniques systematically.

### File Size Optimization

**Problem**: Many small files or few giant files both degrade performance.

**Why small files hurt**: Athena parallelizes across files. With 10,000 × 1 MB files, Athena can't fully parallelize (overhead of opening 10,000 S3 objects). With 10 × 1 GB files, Athena achieves better parallelism.

**Why giant files hurt**: Athena splits large files internally but can't split optimally across workers.

**Optimal file size**: `128 MB − 1 GB` per file (Parquet/ORC).

**Compaction strategy**: Use Glue ETL job or CTAS (CREATE TABLE AS SELECT) to rewrite small files into larger files.

**Example CTAS compaction**:
```sql
CREATE TABLE events_compacted
WITH (
  format = 'PARQUET',
  parquet_compression = 'SNAPPY',
  partitioned_by = ARRAY['year', 'month', 'day'],
  bucketed_by = ARRAY['user_id'],
  bucket_count = 10
)
AS SELECT *
FROM events
WHERE year = 2024 AND month = 11;
```

This query reads small fragmented files from `events` and writes compacted Parquet files to `events_compacted`.

### Partition Pruning

**Ensure queries filter on partition keys** to limit data scanned.

**Inefficient query** (scans all partitions):
```sql
SELECT COUNT(*)
FROM events
WHERE timestamp > 1699747200;  -- Unix timestamp for 2024-11-01
```

**Efficient query** (scans only November 2024):
```sql
SELECT COUNT(*)
FROM events
WHERE year = 2024
  AND month = 11
  AND timestamp > 1699747200;
```

Always include partition key predicates even if they're redundant with other filters.

### Columnar Projection

**Select only needed columns** instead of `SELECT *`.

**Inefficient**:
```sql
SELECT *
FROM events
WHERE year = 2024 AND month = 11;
```

Scans all 50 columns even if you only need 2.

**Efficient**:
```sql
SELECT event_type, user_id
FROM events
WHERE year = 2024 AND month = 11;
```

Scans only 2 columns (96% data reduction in this example).

### Predicate Pushdown

**Apply filters early** to reduce data Athena processes.

**Inefficient** (filter after aggregation):
```sql
SELECT event_type, COUNT(*) as count
FROM events
WHERE year = 2024 AND month = 11
GROUP BY event_type
HAVING event_type = 'purchase';
```

**Efficient** (filter before aggregation):
```sql
SELECT event_type, COUNT(*) as count
FROM events
WHERE year = 2024
  AND month = 11
  AND event_type = 'purchase'
GROUP BY event_type;
```

Moving `event_type = 'purchase'` from HAVING to WHERE reduces data processed before grouping.

### Join Optimization

**Broadcast joins** work well when one table is small (<1 GB) and the other is large.

**Example**: Join 10 TB fact table with 100 MB dimension table.
```sql
SELECT f.user_id, d.user_name, COUNT(*) as event_count
FROM events f
INNER JOIN users d ON f.user_id = d.user_id
WHERE f.year = 2024 AND f.month = 11
GROUP BY f.user_id, d.user_name;
```

Athena broadcasts small `users` table to all workers processing `events`. Each worker performs local join without shuffling large table across network.

**Partition-wise joins**: When both tables are large and partitioned on join key, filter both tables on partition keys.

```sql
SELECT a.user_id, COUNT(*) as total
FROM events a
INNER JOIN sessions b ON a.session_id = b.session_id
WHERE a.year = 2024 AND a.month = 11 AND a.day = 15
  AND b.year = 2024 AND b.month = 11 AND b.day = 15
GROUP BY a.user_id;
```

Both tables filtered to same partition before join, reducing shuffle volume.

### Approximate Aggregations

**Use approximate functions** for large datasets when exact precision isn't required.

**Exact count distinct** (scans all data):
```sql
SELECT COUNT(DISTINCT user_id)
FROM events
WHERE year = 2024 AND month = 11;
```

**Approximate count distinct** (much faster, ~2% error):
```sql
SELECT APPROX_DISTINCT(user_id)
FROM events
WHERE year = 2024 AND month = 11;
```

**Approximate percentiles**:
```sql
SELECT APPROX_PERCENTILE(response_time, 0.95) as p95
FROM api_logs
WHERE year = 2024 AND month = 11;
```

Faster than exact percentile calculation on TBs of data.

### Query Execution Optimization

**Athena engine versions**: Always use Athena engine version 3 (latest as of 2024). Version 3 includes Trino 400+ with significant performance improvements, better memory management, and additional SQL functions.

**Set engine version in workgroup**:
```json
"EngineVersion": {
  "SelectedEngineVersion": "Athena engine version 3"
}
```

**Query hints**: Athena supports some query hints for advanced optimization.

**Force broadcast join**:
```sql
SELECT /*+ BROADCAST(d) */ f.user_id, d.user_name
FROM events f
INNER JOIN users d ON f.user_id = d.user_id;
```

Forces Athena to broadcast `users` table even if optimizer would choose different strategy.

## Cost Optimization Strategies

Athena cost is purely data scanned. Every optimization that reduces bytes scanned reduces cost proportionally.

### Convert to Columnar Formats

**Most impactful cost reduction**: Convert JSON/CSV to Parquet with compression.

**Cost comparison** (1 TB raw data, select 10% of columns):

| Format | Compression | File Size | Data Scanned | Cost per Query |
|--------|-------------|-----------|--------------|----------------|
| JSON | None | 1,000 GB | 1,000 GB | $5.00 |
| JSON | Gzip | 200 GB | 200 GB | $1.00 |
| Parquet | None | 400 GB | 40 GB (10% columns) | $0.20 |
| Parquet | Snappy | 250 GB | 25 GB (10% columns) | $0.12 |

**ROI calculation**: One-time Glue job to convert 1 TB JSON to Parquet costs $5 (1 hour, 10 DPUs). Querying JSON 100 times = $500. Querying Parquet 100 times = $12. Savings: $488. Break-even: 2 queries.

### Implement Aggressive Partitioning

**Partition by query patterns** to maximize pruning.

**Example**: Queries typically filter by date range and region.

**Partitioning scheme**:
```
s3://data/events/year=2024/month=11/region=us-east-1/
s3://data/events/year=2024/month=11/region=eu-west-1/
```

**Query filtering by region**:
```sql
SELECT event_type, COUNT(*) as count
FROM events
WHERE year = 2024
  AND month = 11
  AND region = 'us-east-1'
GROUP BY event_type;
```

Scans only `us-east-1` partition, skipping other regions entirely.

**Cost impact**: Table has 10 regions, query filters to 1 region. Cost reduction: 90%.

### Use CTAS for Derived Tables

**CTAS (CREATE TABLE AS SELECT)** materializes frequently-queried results to avoid re-scanning raw data.

**Example**: Dashboard queries aggregate daily metrics from raw events.

**Without CTAS** (query raw table every dashboard refresh):
```sql
-- This query runs every 5 minutes, scans 500 GB each time
SELECT event_date, event_type, COUNT(*) as count
FROM raw_events
WHERE year = 2024 AND month = 11
GROUP BY event_date, event_type;
```

Daily cost: 288 queries × 500 GB × $5/TB = $720.

**With CTAS** (materialize aggregates once daily):
```sql
-- Run once per day via scheduled query
CREATE TABLE daily_metrics
WITH (
  format = 'PARQUET',
  external_location = 's3://my-bucket/daily-metrics/'
)
AS
SELECT event_date, event_type, COUNT(*) as count
FROM raw_events
WHERE year = 2024 AND month = 11
GROUP BY event_date, event_type;

-- Dashboard queries the pre-aggregated table (scans 1 GB)
SELECT event_date, event_type, count
FROM daily_metrics
WHERE event_date >= DATE '2024-11-01';
```

Daily cost: 1 × 500 GB (materialization) + 288 × 1 GB (dashboard) = 788 GB × $5/TB = $3.85.

Savings: $716/day = $21,480/month.

### Enforce Query Limits

**Set per-query scan limits** in workgroups to prevent runaway costs.

**Example workgroup limit**: 100 GB per query.
```json
"BytesScannedCutoffPerQuery": 107374182400  // 100 GB in bytes
```

Query exceeding limit fails with error:
```
Query exhausted resources at this scale factor.
Data scanned: 120.5 GB.
Limit: 100 GB.
```

**Use case**: Prevent accidental full-table scans by analysts forgetting WHERE clauses.

### Leverage Result Caching

**Enable result caching** by default (enabled automatically, no configuration required).

**Best practices for cache hits**:
- Use exact same query text (parameterize queries in application code)
- Avoid non-deterministic functions (RAND(), UUID(), NOW())
- Understand cache invalidation (adding new partitions invalidates cache for queries on that table)

**Example**: BI dashboard runs same 20 queries every hour.
- First run: 20 queries × 100 GB each = 2 TB scanned = $10
- Next 23 hours: 20 queries × 23 runs = 460 cached queries = $0
- Daily cost: $10 instead of $230

### Monitor Query Costs

**CloudWatch metrics**: Athena publishes metrics per workgroup and per query.

**Key metrics**:
- `DataScannedInBytes`: Total data scanned (multiply by $5/TB for cost)
- `QueryExecutionTime`: Query duration
- `EngineExecutionTime`: Time spent processing (vs queue time)

**Cost allocation tags**: Tag workgroups by team/project, view costs in Cost Explorer.

**Cost anomaly detection**: Set CloudWatch alarms for unexpected cost spikes.

**Example alarm**: Alert if daily scanned data exceeds 5 TB (expected: 2 TB).
```json
{
  "AlarmName": "athena-high-data-scan",
  "MetricName": "DataScannedInBytes",
  "Namespace": "AWS/Athena",
  "Statistic": "Sum",
  "Period": 86400,  // 1 day
  "Threshold": 5497558138880,  // 5 TB
  "ComparisonOperator": "GreaterThanThreshold"
}
```

## Security Best Practices

### Data Encryption

**Encryption at rest**: S3 source data and query results should be encrypted.

**S3 encryption options**:
- **SSE-S3**: AWS-managed keys (default, easiest)
- **SSE-KMS**: Customer-managed KMS keys (audit key usage, rotate keys)
- **SSE-C**: Customer-provided keys (full control, more complexity)

**Query result encryption**: Configure per workgroup.
```json
"EncryptionConfiguration": {
  "EncryptionOption": "SSE_KMS",
  "KmsKey": "arn:aws:kms:us-east-1:123456789012:key/abc-123"
}
```

Athena encrypts query results before writing to S3.

**Encryption in transit**: Athena uses TLS 1.2+ for all API calls and JDBC/ODBC connections automatically.

### IAM Permissions

**Principle of least privilege**: Grant only necessary permissions.

**Example policy for analyst role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:StartQueryExecution",
        "athena:StopQueryExecution"
      ],
      "Resource": "arn:aws:athena:us-east-1:123456789012:workgroup/analytics-team"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-data-bucket/*",
        "arn:aws:s3:::my-data-bucket"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::analytics-results/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:GetPartitions"
      ],
      "Resource": "*"
    }
  ]
}
```

**Permissions required**:
- Athena: Start queries, get results
- S3 (source data): Read data files
- S3 (results): Write query results
- Glue: Read catalog metadata

### Lake Formation Integration

**Fine-grained access control**: Use Lake Formation to grant column-level and row-level permissions.

**Column-level filtering**: Hide sensitive columns from specific users.

**Example**: Grant analysts access to `users` table but exclude PII columns.
```
Table: users
Columns: user_id, email, name, created_at, last_login
Grant to analytics_team: SELECT on user_id, created_at, last_login
Exclude: email, name
```

When analysts query `users`, they see filtered view without `email` and `name` columns.

**Row-level filtering**: Filter data by attribute.

**Example**: Restrict regional teams to their region's data.
```sql
-- Lake Formation filter expression
region = 'us-east-1'
```

Users in US East team see only rows where `region = 'us-east-1'` regardless of their WHERE clause.

### Query Result Lifecycle

**Automatically delete old query results** to reduce storage costs and minimize data exposure.

**S3 lifecycle policy** on results bucket:
```json
{
  "Rules": [{
    "Id": "delete-old-athena-results",
    "Status": "Enabled",
    "Prefix": "",
    "Expiration": {
      "Days": 30
    }
  }]
}
```

Query results older than 30 days are deleted automatically.

**Consideration**: Cached queries reference results in S3. If result files are deleted before cache expires (24 hours), cache becomes invalid. Set expiration > 1 day.

## When to Use AWS Athena

**Strong fit**:
- ✅ Ad-hoc SQL analytics on S3 data lakes
- ✅ Infrequent queries where paying per query beats paying for 24/7 database
- ✅ Log analysis and exploration (CloudTrail, VPC Flow Logs, ALB logs)
- ✅ Serverless architectures avoiding operational overhead
- ✅ Data lake queries integrated with Glue Data Catalog
- ✅ Cost-sensitive workloads where optimizing file format and partitioning yields major savings
- ✅ Multi-tenant analytics where workgroups provide cost isolation

**Consider alternatives when**:
- ❌ **Sub-second query latency required** → ElastiCache, DynamoDB, or in-memory databases for hot data
- ❌ **Continuous high-frequency queries** → Redshift provides better TCO when query volume is predictable and constant
- ❌ **Complex ETL transformations** → Glue or EMR for batch processing, Kinesis for streaming
- ❌ **Transactional workloads (INSERT/UPDATE/DELETE)** → RDS, Aurora, or DynamoDB for OLTP
- ❌ **Real-time dashboards refreshing every second** → Redshift with materialized views or OpenSearch for real-time analytics

## Athena vs Alternatives

### Athena vs Redshift

| Aspect | Athena | Redshift |
|--------|--------|----------|
| **Pricing** | $5/TB scanned (pay per query) | $0.25/hour per node (pay for cluster) |
| **Infrastructure** | Serverless, zero management | Managed clusters, resize/pause manually |
| **Query latency** | 1-30 seconds (cold start + execution) | Sub-second to seconds (warm cluster) |
| **Concurrency** | High (isolated queries) | Limited by cluster size (max 500 concurrent) |
| **Data format** | Parquet/ORC/JSON/CSV on S3 | Proprietary columnar storage |
| **Use case** | Sporadic ad-hoc analytics | Continuous BI dashboards, predictable workloads |

**Cost crossover**: Athena cheaper if you scan <5 TB/month. Redshift cheaper for high-frequency queries on same datasets.

**Example**: Scan 100 TB/month.
- Athena: 100 TB × $5 = $500/month
- Redshift: 2-node dc2.large cluster = $0.25/hour × 2 × 730 hours = $365/month

Redshift wins on cost, but requires managing cluster (pausing when idle, resizing for growth).

### Athena vs Redshift Spectrum

Redshift Spectrum runs queries from Redshift cluster against S3 data (similar to Athena).

**When to use Spectrum over Athena**:
- Already have Redshift cluster for hot data
- Join S3 data with Redshift tables frequently
- Want single SQL interface for both Redshift and S3

**Pricing**: Spectrum charges $5/TB scanned (same as Athena) plus Redshift cluster costs.

### Athena vs EMR

EMR provides full control over Spark/Presto/Hive clusters.

| Aspect | Athena | EMR |
|--------|--------|-----|
| **Management** | Fully serverless | Self-managed clusters |
| **Startup time** | 1-3 seconds per query | 5-10 minutes to launch cluster |
| **Pricing** | $5/TB scanned | EC2 costs + EMR fee ($0.096/hour + instance cost) |
| **Use case** | SQL analytics, no custom code | Complex Spark jobs, custom transformations, ML |

**When to choose EMR**:
- Need custom Spark/PySpark code
- Use Spark libraries not available in Athena (MLlib, GraphX)
- Run long-running batch jobs where per-TB pricing exceeds cluster cost
- Need specific Spark/Presto versions

### Athena vs BigQuery / Snowflake

Cloud-native data warehouses with similar serverless query capabilities.

**BigQuery** (Google Cloud):
- Pricing: $5/TB scanned (same as Athena)
- Better: Streaming inserts, real-time analytics, more SQL functions
- Worse: Requires Google Cloud, less integration with AWS ecosystem

**Snowflake** (multi-cloud):
- Pricing: Per-second compute billing (more granular than Redshift)
- Better: Instant elastic scaling, time travel, data sharing
- Worse: Higher cost for light workloads, additional vendor lock-in

**Athena advantages**: Native AWS integration (IAM, S3, Glue), no vendor lock-in (standard Parquet/ORC on S3), lowest cost for infrequent queries.

## Common Pitfalls

### Querying Uncompressed JSON

**Symptom**: High query costs despite small result sets.

**Root cause**: JSON files are uncompressed text, and Athena must scan entire files regardless of how many columns you select.

**Example**: 1 TB of uncompressed JSON, query selects 2 columns.
- Cost: 1 TB × $5 = $5.00 per query
- With Parquet (Snappy): 25 GB × $5 = $0.12 per query

**Solution**: Convert to Parquet using Glue ETL job or CTAS query (one-time effort, ongoing savings).

### Missing Partition Filters

**Symptom**: Queries take minutes and scan TBs when you expect GBs.

**Root cause**: Query doesn't filter on partition keys, so Athena scans all partitions.

**Example query**:
```sql
-- Missing year/month/day filters
SELECT COUNT(*)
FROM events
WHERE timestamp > 1699747200;  -- Date in timestamp column, not partition
```

Athena scans all partitions (entire table history).

**Solution**: Always include partition key predicates.
```sql
SELECT COUNT(*)
FROM events
WHERE year = 2024
  AND month = 11
  AND day >= 1
  AND timestamp > 1699747200;
```

### SELECT * in Production Queries

**Symptom**: Costs 10× higher than expected for simple queries.

**Root cause**: `SELECT *` reads all columns, even when application only displays 3 columns.

**Solution**: Always specify exact columns needed.

**Before**:
```sql
SELECT * FROM events WHERE year = 2024 AND month = 11;
```

**After**:
```sql
SELECT event_id, event_type, user_id
FROM events
WHERE year = 2024 AND month = 11;
```

### Schema Mismatch Between Files

**Symptom**: Query succeeds but returns NULL for some rows or columns.

**Root cause**: S3 contains files with different schemas (column added/removed over time).

**Example**: Early files have columns `[user_id, event_type]`, later files added `session_id`.

**Query**:
```sql
SELECT user_id, session_id FROM events;
```

Rows from old files show `NULL` for `session_id`.

**Solution**: Use schema evolution-friendly formats (Parquet with schema merging, Avro) or enforce schema validation at ingestion.

### Not Registering New Partitions

**Symptom**: Query returns incomplete results, missing recent data.

**Root cause**: New S3 data uploaded but partitions not registered in Glue catalog.

**Example**: ETL job writes new partition `year=2024/month=11/day=15/` to S3 but doesn't update catalog. Athena doesn't know partition exists.

**Solution**: Register partitions after uploading data.

**Option 1: MSCK REPAIR (scans all prefixes)**:
```sql
MSCK REPAIR TABLE events;
```

**Option 2: Explicit ADD PARTITION (faster, targeted)**:
```sql
ALTER TABLE events ADD PARTITION (year=2024, month=11, day=15)
LOCATION 's3://my-bucket/events/year=2024/month=11/day=15/';
```

**Option 3: Glue crawler (automatic, scheduled)**:
Schedule crawler to run after ETL job completes.

### Query Timeout Due to Large Scans

**Symptom**: Query fails with timeout error after 30 minutes.

**Root cause**: Query scans TBs of data without sufficient optimization.

**Solution**: Apply multiple optimizations together:
1. Add partition filters to reduce data scanned
2. Convert to columnar format (Parquet) to read only needed columns
3. Use approximate aggregations (APPROX_DISTINCT instead of COUNT DISTINCT)
4. Split large query into smaller CTAS materialization + final query

**Example refactor**:

**Original (times out)**:
```sql
SELECT user_id, COUNT(DISTINCT session_id) as sessions
FROM events
WHERE timestamp > 1699747200
GROUP BY user_id;
```

**Optimized**:
```sql
-- Step 1: Materialize filtered data once
CREATE TABLE events_nov_2024
WITH (format = 'PARQUET', partitioned_by = ARRAY['day'])
AS SELECT user_id, session_id, DAY(from_unixtime(timestamp)) as day
FROM events
WHERE year = 2024 AND month = 11 AND timestamp > 1699747200;

-- Step 2: Query materialized table (much faster)
SELECT user_id, APPROX_DISTINCT(session_id) as sessions
FROM events_nov_2024
GROUP BY user_id;
```

## Key Takeaways

**AWS Athena provides serverless SQL analytics on S3 data lakes** with pay-per-query pricing that eliminates idle infrastructure costs. You pay $5 per TB scanned, and cost directly correlates with data volume processed.

**Cost optimization is achieved through format and partitioning**. Converting JSON to Parquet reduces costs by 90-98% by enabling columnar scans and compression. Partitioning by query patterns (date, region) reduces scanned data by skipping irrelevant partitions. These two optimizations combined can reduce costs from $10,000/month to $200/month for typical workloads.

**Performance depends on data organization, not infrastructure tuning**. Athena auto-scales workers per query. Improve performance by optimizing file sizes (`128 MB − 1 GB`), using columnar formats, applying partition pruning, and selecting only needed columns. Query execution time is dominated by S3 scan time, not compute.

**Use Athena for ad-hoc and infrequent analytics** where serverless simplicity and pay-per-query pricing outweigh Redshift's constant cluster costs. For high-frequency dashboards querying the same datasets repeatedly, Redshift or Redshift Spectrum may provide better TCO despite operational overhead.

**Security is handled through IAM and Lake Formation integration**. Control access at table and column level, encrypt data at rest and in transit, and isolate costs and permissions using workgroups. Lake Formation adds row-level filtering and cross-account data sharing without copying data.

**Common pitfalls involve forgetting optimizations that reduce scanned data**. Always filter on partition keys, avoid `SELECT *`, convert to Parquet, and register new partitions after data uploads. Enable query result caching to reuse identical queries, and set per-query scan limits to prevent runaway costs.

**Integrate with Glue Data Catalog for centralized metadata** that works across Athena, Redshift Spectrum, EMR, and QuickSight. Define schemas once, query from multiple services, and share catalogs across AWS accounts for governed data access.
