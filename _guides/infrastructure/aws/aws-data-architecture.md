---
title: "Modern Data Architecture on AWS"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "Data lake patterns, service selection frameworks, data warehouse vs lake house architectures, and integration strategies"
tags: [aws, data-architecture, architecture, decision-making, integration, cost-analysis, design-patterns]
---

## What Problems Modern Data Architecture Solves

Modern data architecture eliminates the silos, rigidity, and cost inefficiencies of traditional data warehousing while enabling analytics at scale across structured and unstructured data.

**Traditional data architecture challenges**:
- Data warehouses require schema-on-write, making it expensive to store exploratory or semi-structured data (JSON, logs, events)
- ETL pipelines break when source schemas evolve, requiring constant maintenance
- Separate systems for batch analytics (data warehouse), real-time analytics (streaming), and machine learning (feature stores) create data silos
- Scaling data warehouses vertically costs $50,000-$500,000/year for enterprise capacity
- Analysts wait days for data engineering to load new datasets into the warehouse

**Concrete scenario**: Your e-commerce company runs analytics on PostgreSQL, storing orders, customers, and products in normalized tables. The analytics team wants to analyze clickstream data (20 GB/day of JSON logs), customer support tickets (unstructured text), and product images (binary data). Loading this data into PostgreSQL requires complex ETL: flatten JSON into tables, parse text into structured fields, extract image metadata. The ETL pipeline takes 2 weeks to build per new data source and breaks monthly when schemas change. PostgreSQL storage costs $15,000/month and query performance degrades as data grows. The data science team can't access raw clickstream data for ML because it's been aggregated away in the ETL process.

**What modern data architecture provides**: A data lake on S3 stores all data in raw form (JSON, Parquet, CSV, images) for $23/TB/month. Glue catalogs schemas automatically. Athena queries structured data with SQL. SageMaker reads raw data for ML. QuickSight visualizes aggregates. Redshift Spectrum queries S3 directly when needed. Each team accesses the same source data using the right tool for their use case; no ETL required unless transforming data adds value.

**Real-world impact**: After implementing a data lake, storage costs dropped from $15,000/month (PostgreSQL) to $500/month (S3 for 20 TB). New data sources go live in hours instead of weeks: upload to S3, run Glue crawler, query with Athena. Schema evolution is handled automatically by Glue crawlers. Data scientists access raw clickstream data directly for ML models. Analysts query aggregated views via Athena or Redshift Spectrum. Total analytics cost: $2,000/month (S3 + Athena + QuickSight) vs $30,000/month (PostgreSQL cluster + ETL infrastructure + BI licenses).

## Core Architectural Patterns

Modern data architecture on AWS follows three primary patterns: Data Lake, Data Warehouse, and Lake House (hybrid). The choice depends on data types, query patterns, and team skills.

### Pattern 1: Data Lake (S3 + Glue + Athena)

**What it is**: Store all data in S3 in open formats (Parquet, JSON, CSV), catalog with Glue, query with Athena or other compute engines.

**Key characteristics**:
- **Schema-on-read**: Store raw data first, apply schema when querying
- **Open formats**: Parquet, ORC, Avro, JSON—no proprietary storage
- **Decoupled storage and compute**: S3 for storage, Athena/EMR/Redshift Spectrum for compute
- **Pay per query**: No idle infrastructure costs

**Architecture components**:

```
Data Sources → S3 Data Lake → Glue Data Catalog → Query Engines
                   ↓                                    ↓
           (Parquet files)                    Athena, Redshift Spectrum,
           Organized by zone:                  EMR, SageMaker, QuickSight
           - Raw
           - Processed
           - Curated
```

**Zone organization**:

1. **Raw zone**: Original data in original format
   - Location: `s3://datalake/raw/`
   - Format: JSON, CSV, logs (as received)
   - Retention: Indefinite (compliance, reprocessing)
   - Who writes: Ingestion pipelines, Kinesis Firehose, IoT

2. **Processed zone**: Cleaned, deduplicated, converted to columnar format
   - Location: `s3://datalake/processed/`
   - Format: Parquet with Snappy compression
   - Partitioning: By date (year/month/day)
   - Who writes: Glue ETL jobs

3. **Curated zone**: Business-level aggregates, joined with dimensions
   - Location: `s3://datalake/curated/`
   - Format: Parquet optimized for BI queries
   - Partitioning: By business dimensions (region, product category, date)
   - Who writes: Glue ETL jobs, dbt transformations

**Example folder structure**:
```
s3://my-datalake/
  raw/
    clickstream/
      year=2024/month=11/day=15/events-20241115-143022.json.gz
    orders/
      year=2024/month=11/day=15/orders.csv
  processed/
    clickstream/
      year=2024/month=11/day=15/events.parquet
    orders/
      year=2024/month=11/day=15/orders.parquet
  curated/
    daily_revenue/
      year=2024/month=11/day=15/revenue.parquet
    user_segments/
      snapshot_date=2024-11-15/segments.parquet
```

**When to use data lake pattern**:
- ✅ Diverse data types (structured, semi-structured, unstructured)
- ✅ Schema evolution frequent or unpredictable
- ✅ ML/AI workloads requiring raw data access
- ✅ Cost-sensitive (S3 storage cheapest option)
- ✅ Infrequent or ad-hoc queries (pay per query via Athena)

**Limitations**:
- ❌ Query performance slower than data warehouse for complex joins
- ❌ No transactional support (ACID) without Delta Lake/Iceberg
- ❌ Requires data engineering discipline to maintain quality

### Pattern 2: Data Warehouse (Redshift)

**What it is**: Centralized columnar database optimized for OLAP queries with fast joins, aggregations, and concurrent access.

**Key characteristics**:
- **Schema-on-write**: Define schema before loading data
- **Proprietary storage**: Redshift columnar format optimized for queries
- **Provisioned capacity**: Pay for cluster (nodes) 24/7 or pause when idle
- **ACID transactions**: Support for INSERT, UPDATE, DELETE, MERGE

**Architecture components**:

```
Data Sources → Staging (S3) → COPY to Redshift → BI Tools
                                     ↓
                              Materialized Views
                              Stored Procedures
                              Concurrency Scaling
```

**Redshift cluster types**:

| Cluster Type | Use Case | Node Type | Cost (approx) |
|--------------|----------|-----------|---------------|
| **Development** | Testing, small datasets | dc2.large (2 nodes) | $0.25/hour ($365/month) |
| **Production Small** | 1-10 TB, <50 users | ra3.4xlarge (2 nodes) | $6.80/hour ($4,964/month) |
| **Production Large** | 10-100 TB, 100+ users | ra3.16xlarge (4 nodes) | $52/hour ($37,960/month) |

**Redshift optimization techniques**:

1. **Distribution styles**: Control how data distributes across nodes
   - **KEY**: Distribute by join key (co-locate related rows)
   - **ALL**: Replicate small dimension tables to all nodes
   - **EVEN**: Round-robin distribution (default)
   - **AUTO**: Redshift chooses based on table size

2. **Sort keys**: Order data on disk for faster range scans
   - **Compound**: Optimal when queries filter on multiple columns in order
   - **Interleaved**: Optimal when queries filter on different column combinations

3. **Materialized views**: Pre-compute expensive aggregations
   ```sql
   CREATE MATERIALIZED VIEW daily_revenue AS
   SELECT
     DATE_TRUNC('day', order_date) as day,
     product_category,
     SUM(revenue) as total_revenue
   FROM orders
   GROUP BY DATE_TRUNC('day', order_date), product_category;
   ```

4. **Concurrency scaling**: Auto-add query capacity during peak usage
   - Free for 60 minutes/day
   - $6.80/hour beyond free tier
   - Scales to 10× base cluster capacity

**When to use data warehouse pattern**:
- ✅ Primarily structured data (tables with known schemas)
- ✅ High-frequency queries on same datasets (amortize cluster cost)
- ✅ Complex joins across many tables (100+ table star schemas)
- ✅ Concurrent users (100+ analysts querying simultaneously)
- ✅ Sub-second query latency required for dashboards

**Limitations**:
- ❌ Expensive for infrequent queries (pay for idle cluster)
- ❌ Schema changes require ALTER TABLE, data reload
- ❌ Not suitable for raw unstructured data (JSON, logs, images)

### Pattern 3: Lake House (S3 + Glue + Redshift Spectrum + Athena)

**What it is**: Combine data lake flexibility with data warehouse performance by querying S3 data from Redshift and using Redshift for hot data.

**Key characteristics**:
- **Hybrid storage**: Hot data in Redshift, cold data in S3
- **Unified query interface**: SQL queries across both Redshift and S3
- **Federated queries**: Join Redshift tables with S3 tables in single query
- **Cost optimization**: Pay for Redshift cluster (hot data) + $5/TB scanned (S3 data)

**Architecture components**:

```
S3 Data Lake (Cold Data)
    ↓
Redshift Spectrum (External Tables)
    ↓
Redshift Cluster (Hot Data) ←→ BI Tools, Applications
    ↓
Materialized Views (Pre-aggregated S3 data)
```

**Example use cases**:

**Use case 1: Hot/cold data separation**

Store last 90 days of transaction data in Redshift (frequently queried, fast access). Store older data in S3 (rarely queried, cheap storage). Query across both seamlessly.

```sql
-- Redshift table (hot data, last 90 days)
CREATE TABLE orders_recent (
  order_id BIGINT,
  order_date DATE,
  customer_id BIGINT,
  revenue DECIMAL(10,2)
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (order_date);

-- Spectrum external table (cold data, older than 90 days)
CREATE EXTERNAL TABLE orders_historical (
  order_id BIGINT,
  order_date DATE,
  customer_id BIGINT,
  revenue DECIMAL(10,2)
)
STORED AS PARQUET
LOCATION 's3://my-datalake/curated/orders/';

-- Union query across hot and cold data
SELECT
  DATE_TRUNC('month', order_date) as month,
  SUM(revenue) as total_revenue
FROM (
  SELECT order_date, revenue FROM orders_recent
  UNION ALL
  SELECT order_date, revenue FROM orders_historical
)
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

**Use case 2: Enrich data warehouse with data lake data**

Join Redshift customer table with S3 clickstream events for comprehensive analysis.

```sql
-- Redshift table (customer master data)
SELECT c.customer_id, c.customer_name, c.region
FROM customers c;

-- Spectrum external table (clickstream events in S3)
CREATE EXTERNAL TABLE clickstream_events (
  event_id STRING,
  customer_id BIGINT,
  event_type STRING,
  event_timestamp TIMESTAMP
)
PARTITIONED BY (year INT, month INT, day INT)
STORED AS PARQUET
LOCATION 's3://my-datalake/processed/clickstream/';

-- Federated query joining Redshift and S3 data
SELECT
  c.customer_name,
  c.region,
  COUNT(e.event_id) as total_events,
  COUNT(DISTINCT e.event_type) as unique_event_types
FROM customers c
INNER JOIN clickstream_events e
  ON c.customer_id = e.customer_id
WHERE e.year = 2024 AND e.month = 11
GROUP BY c.customer_name, c.region;
```

**Cost optimization with lake house**:

| Scenario | Data Warehouse Only | Lake House |
|----------|---------------------|------------|
| 10 TB hot data (last 90 days) | 10 TB in Redshift | 10 TB in Redshift |
| 90 TB cold data (older) | 90 TB in Redshift | 90 TB in S3 |
| **Storage cost/month** | 100 TB × $24/TB = $2,400 | 10 TB × $24 + 90 TB × $0.023 = $242 |
| **Query cost** (100 TB/month scanned) | Included in cluster | $5/TB × 100 TB = $500 |
| **Total cost/month** | $2,400 + cluster | $742 + cluster |

Lake house saves $1,658/month on storage, adds $500/month in Spectrum query costs. Net savings: $1,158/month.

**When to use lake house pattern**:
- ✅ Mix of hot data (queried daily) and cold data (queried rarely)
- ✅ Need to join structured data warehouse data with semi-structured S3 data
- ✅ Want Redshift performance for critical dashboards while reducing storage costs
- ✅ Existing Redshift cluster can be extended with S3 data

**Limitations**:
- ❌ Spectrum query performance slower than native Redshift tables (network I/O to S3)
- ❌ Still requires Redshift cluster (ongoing cost)
- ❌ Spectrum charges $5/TB scanned (optimize with partitioning and Parquet)

## Service Selection Framework

Choose services based on data characteristics, query patterns, and team capabilities.

### Decision Matrix: Storage Layer

| Data Type | Volume | Change Frequency | Best Storage |
|-----------|--------|------------------|--------------|
| **Structured** | <1 TB | Low | RDS/Aurora (OLTP), Redshift (OLAP) |
| **Structured** | 1-100 TB | Low-Medium | Redshift, S3 + Athena |
| **Structured** | >100 TB | Any | S3 + Athena, Redshift (hot data only) |
| **Semi-structured** (JSON, logs) | Any | Any | S3 (convert to Parquet for analytics) |
| **Unstructured** (images, videos) | Any | Any | S3 |

### Decision Matrix: Query Engine

| Query Pattern | Concurrency | Latency Requirement | Best Engine |
|---------------|-------------|---------------------|-------------|
| **Ad-hoc exploration** | Low (1-10 users) | 5-30 seconds OK | Athena |
| **Scheduled reports** | Low | Minutes OK | Athena, Glue |
| **Interactive dashboards** | High (50+ users) | <3 seconds | Redshift, QuickSight with SPICE |
| **Real-time analytics** | High | <1 second | ElastiCache, DynamoDB, OpenSearch |
| **Complex joins** (10+ tables) | Medium | <10 seconds | Redshift |
| **ML feature extraction** | Low | Minutes-hours OK | SageMaker Processing, EMR |

### Decision Matrix: Transformation Layer

| Transformation Complexity | Data Volume | Skill Set | Best Tool |
|---------------------------|-------------|-----------|-----------|
| **Simple** (aggregations, filters) | Any | SQL | Athena CTAS, Redshift views |
| **Moderate** (joins, deduplication) | <100 GB/day | SQL | Glue ETL (PySpark), dbt |
| **Complex** (ML features, custom logic) | Any | Python/Scala | Glue ETL, EMR, SageMaker |
| **Real-time** (streaming transformations) | Any | SQL/Python | Kinesis Data Analytics, Lambda |

### Cost-Based Decision Framework

**Example scenario**: 50 TB of transaction data, 20 queries/day averaging 500 GB scanned each.

**Option 1: Athena only**
- Storage: 50 TB × $0.023/GB = $1,150/month
- Queries: 20 × 500 GB × 30 days × $5/TB = $1,500/month
- Total: $2,650/month

**Option 2: Redshift only**
- Storage: 50 TB on ra3.16xlarge (16 TB per node) = 4 nodes = $52/hour = $37,960/month
- Queries: Included
- Total: $37,960/month

**Option 3: Lake house (Athena + Redshift)**
- Storage S3: 45 TB × $0.023/GB = $1,035/month
- Storage Redshift: 5 TB (hot data) on ra3.4xlarge (2 nodes) = $6.80/hour = $4,964/month
- Queries (Athena): 10 × 500 GB × 30 days × $5/TB = $750/month (half queries on Redshift)
- Total: $6,749/month

**Option 4: QuickSight SPICE + Athena**
- Storage S3: 50 TB × $0.023/GB = $1,150/month
- Athena (SPICE refresh): 1 × 500 GB × 30 days × $5/TB = $75/month
- QuickSight: 10 authors × $24 + 40 readers × $5 = $440/month
- Total: $1,665/month

**Winner**: Option 4 (QuickSight SPICE + Athena) for dashboard-centric workloads. Option 1 (Athena only) for ad-hoc analytics.

## Integration Patterns

Modern data architecture integrates multiple services to handle different workloads efficiently.

### Pattern 1: Batch Ingestion Pipeline

**Use case**: Daily batch files from external systems (partners, SaaS tools, databases).

**Architecture**:
```
External System → S3 (Landing) → Lambda (Trigger) → Glue Job (Transform) → S3 (Curated) → Glue Crawler → Athena
```

**Implementation**:

1. **Ingestion**: Upload CSV/JSON files to `s3://datalake/raw/source-system/`
2. **Trigger**: S3 event triggers Lambda function
3. **Transform**: Lambda starts Glue ETL job
4. **Glue job**: Read raw files, clean, convert to Parquet, write to `s3://datalake/curated/`
5. **Catalog**: Glue crawler updates Data Catalog with new partitions
6. **Query**: Athena queries curated data, QuickSight dashboards refresh

**Example Glue job** (PySpark):
```python
from awsglue.context import GlueContext
from pyspark.context import SparkContext

glueContext = GlueContext(SparkContext.getOrCreate())

# Read raw CSV from S3
raw_df = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": ["s3://datalake/raw/orders/"]},
    format="csv",
    format_options={"withHeader": True}
)

# Transform: clean, deduplicate, add columns
from pyspark.sql.functions import current_timestamp
cleaned_df = raw_df.toDF() \
    .dropDuplicates(["order_id"]) \
    .withColumn("processed_at", current_timestamp())

# Write to curated zone as Parquet with partitioning
cleaned_df.write \
    .partitionBy("order_date") \
    .mode("overwrite") \
    .parquet("s3://datalake/curated/orders/")
```

### Pattern 2: Real-Time Streaming Pipeline

**Use case**: Clickstream events, IoT sensor data, application logs requiring near-real-time analytics.

**Architecture**:
```
Application → Kinesis Data Stream → Kinesis Firehose → S3 (Parquet) → Glue Catalog → Athena
                                        ↓
                                   Lambda (Real-time processing)
                                        ↓
                                   DynamoDB (Real-time dashboards)
```

**Implementation**:

1. **Ingest**: Application sends events to Kinesis Data Stream
2. **Real-time processing**: Lambda function consumes stream, writes aggregates to DynamoDB
3. **Batch storage**: Kinesis Firehose buffers events, writes to S3 in Parquet format every 5 minutes
4. **Catalog**: Glue crawler runs hourly to discover new S3 partitions
5. **Query**: Athena for historical analysis, DynamoDB for real-time dashboards

**Example Firehose configuration** (Parquet conversion):
```json
{
  "DeliveryStreamName": "clickstream-to-s3",
  "S3DestinationConfiguration": {
    "BucketARN": "arn:aws:s3:::my-datalake",
    "Prefix": "raw/clickstream/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/",
    "BufferingHints": {
      "SizeInMBs": 128,
      "IntervalInSeconds": 300
    },
    "CompressionFormat": "UNCOMPRESSED",
    "DataFormatConversionConfiguration": {
      "SchemaConfiguration": {
        "DatabaseName": "clickstream_db",
        "TableName": "events",
        "Region": "us-east-1"
      },
      "OutputFormatConfiguration": {
        "Serializer": {
          "ParquetSerDe": {
            "Compression": "SNAPPY"
          }
        }
      }
    }
  }
}
```

### Pattern 3: Data Warehouse Offload

**Use case**: Move historical data from expensive Redshift to cheap S3 while maintaining query compatibility.

**Architecture**:
```
Redshift (Last 90 days) ←→ Redshift Spectrum ←→ S3 (Historical data)
```

**Implementation**:

1. **Current state**: All historical data (10 years) in Redshift = 500 TB × $24/TB = $12,000/month
2. **Target state**: 90 days in Redshift (12 TB), rest in S3 (488 TB)

**Migration process**:

```sql
-- 1. Unload historical data to S3 in Parquet format
UNLOAD ('SELECT * FROM orders WHERE order_date < CURRENT_DATE - 90')
TO 's3://my-datalake/curated/orders_historical/'
IAM_ROLE 'arn:aws:iam::123456789012:role/RedshiftSpectrumRole'
PARQUET
PARTITION BY (year, month);

-- 2. Create Spectrum external table pointing to S3
CREATE EXTERNAL TABLE orders_historical (
  order_id BIGINT,
  customer_id BIGINT,
  order_date DATE,
  revenue DECIMAL(10,2)
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://my-datalake/curated/orders_historical/';

-- 3. Add partitions
ALTER TABLE orders_historical ADD
  PARTITION (year=2014, month=1) LOCATION 's3://my-datalake/curated/orders_historical/year=2014/month=1/'
  PARTITION (year=2014, month=2) LOCATION 's3://my-datalake/curated/orders_historical/year=2014/month=2/';
  -- ... repeat for all partitions

-- 4. Delete historical data from Redshift
DELETE FROM orders WHERE order_date < CURRENT_DATE - 90;
VACUUM DELETE ONLY orders;

-- 5. Create view unifying recent and historical data
CREATE VIEW orders_all AS
SELECT * FROM orders  -- Recent data in Redshift
UNION ALL
SELECT * FROM orders_historical;  -- Historical data in S3
```

**Cost savings**:
- Before: 500 TB × $24/TB = $12,000/month
- After: 12 TB × $24/TB + 488 TB × $0.023/TB = $288 + $11 = $299/month
- Savings: $11,701/month (97.5% reduction)

### Pattern 4: Multi-Account Data Sharing

**Use case**: Centralized data lake accessed by multiple AWS accounts (business units, customers, partners).

**Architecture (using Lake Formation)**:
```
Central Data Lake Account (S3 + Glue Catalog)
    ↓ (Lake Formation Grants)
Consumer Account 1 → Athena queries via shared catalog
Consumer Account 2 → Redshift Spectrum queries via shared catalog
Consumer Account 3 → QuickSight dashboards via shared catalog
```

**Implementation**:

**In producer account (data lake owner)**:

1. **Enable Lake Formation** on S3 bucket and Glue database
2. **Grant permissions** to consumer accounts

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::222222222222:root \
  --resource '{"Database": {"Name": "my_database"}}' \
  --permissions SELECT DESCRIBE
```

3. **Grant table-level access**:

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::222222222222:root \
  --resource '{"Table": {"DatabaseName": "my_database", "Name": "orders"}}' \
  --permissions SELECT
```

**In consumer account**:

1. **Create resource link** to shared database

```sql
CREATE EXTERNAL DATABASE shared_db
FROM DATA CATALOG
DATABASE 'my_database'
ACCOUNT '111111111111'  -- Producer account ID
REGION 'us-east-1';
```

2. **Query shared data** via Athena or Redshift Spectrum

```sql
SELECT * FROM shared_db.orders
WHERE order_date >= DATE '2024-11-01';
```

**Security**: Lake Formation enforces permissions at table and column level. Consumer accounts see only granted tables/columns.

## Data Governance and Quality

### Data Catalog Standards

**Naming conventions**:
- **Databases**: `{env}_{domain}_{purpose}` (e.g., `prod_sales_analytics`, `dev_marketing_raw`)
- **Tables**: `{source}_{entity}` (e.g., `shopify_orders`, `ga4_events`)
- **Columns**: Snake_case, descriptive (e.g., `customer_id`, `order_total_usd`)

**Metadata standards**:
- Table descriptions: Business purpose, data owner, refresh frequency
- Column descriptions: Data type, sample values, business meaning
- Tags: Environment (prod/dev), PII status (contains_pii/no_pii), cost center

**Example well-documented table**:

```sql
CREATE EXTERNAL TABLE shopify_orders (
  order_id BIGINT COMMENT 'Unique order identifier from Shopify',
  customer_id BIGINT COMMENT 'Foreign key to customers table',
  order_date DATE COMMENT 'Date order was placed (UTC)',
  total_price_usd DECIMAL(10,2) COMMENT 'Total order value in USD after discounts',
  order_status STRING COMMENT 'Current status: pending, fulfilled, cancelled, refunded'
)
COMMENT 'Daily snapshot of Shopify orders. Refreshes nightly at 2 AM UTC. Owner: sales-analytics@company.com'
PARTITIONED BY (year INT, month INT, day INT)
STORED AS PARQUET
LOCATION 's3://my-datalake/curated/shopify_orders/'
TBLPROPERTIES (
  'classification'='parquet',
  'data_owner'='sales-analytics@company.com',
  'refresh_frequency'='daily',
  'contains_pii'='yes'
);
```

### Data Quality Framework

**Implement data quality checks** at multiple stages:

**1. Ingestion validation** (Lambda/Glue):
```python
def validate_schema(df, required_columns):
    """Ensure required columns exist with correct types."""
    missing = set(required_columns) - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

def validate_data_quality(df):
    """Check for nulls, duplicates, invalid values."""
    # Check for nulls in critical columns
    null_counts = df.select([
        count(when(col(c).isNull(), c)).alias(c)
        for c in df.columns
    ]).collect()[0].asDict()

    critical_nulls = {k: v for k, v in null_counts.items() if k in ['order_id', 'customer_id'] and v > 0}
    if critical_nulls:
        raise ValueError(f"Nulls found in critical columns: {critical_nulls}")

    # Check for duplicates on primary key
    duplicate_count = df.groupBy("order_id").count().filter("count > 1").count()
    if duplicate_count > 0:
        raise ValueError(f"Found {duplicate_count} duplicate order_ids")

    return True
```

**2. Athena queries for ongoing monitoring**:
```sql
-- Detect schema drift (unexpected new columns)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name NOT IN ('order_id', 'customer_id', 'order_date', 'total_price_usd');

-- Detect data freshness issues (no data in last 24 hours)
SELECT MAX(order_date) as latest_order_date
FROM orders
HAVING MAX(order_date) < CURRENT_DATE - INTERVAL '1' DAY;

-- Detect data volume anomalies (daily row count varies >20%)
WITH daily_counts AS (
  SELECT
    order_date,
    COUNT(*) as row_count,
    AVG(COUNT(*)) OVER (ORDER BY order_date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) as avg_count
  FROM orders
  WHERE order_date >= CURRENT_DATE - INTERVAL '30' DAY
  GROUP BY order_date
)
SELECT order_date, row_count, avg_count
FROM daily_counts
WHERE ABS(row_count - avg_count) / avg_count > 0.20;
```

**3. Glue Data Quality** (built-in service):
```python
# Define data quality ruleset
ruleset = """
Rules = [
  IsComplete "order_id",
  IsUnique "order_id",
  ColumnValues "order_status" in ["pending", "fulfilled", "cancelled", "refunded"],
  ColumnLength "customer_email" <= 255,
  Completeness "customer_id" > 0.95
]
"""

# Evaluate ruleset
quality_result = glueContext.evaluate_data_quality(
    frame=orders_df,
    ruleset=ruleset,
    publishing_options={
        "cloudwatch_metrics_enabled": True,
        "results_s3_prefix": "s3://my-bucket/dq-results/"
    }
)

# Fail job if quality thresholds not met
if quality_result.overall_status == "FAIL":
    raise Exception("Data quality checks failed")
```

### Access Control with Lake Formation

**Implement fine-grained permissions**:

**Row-level filtering** (restrict data by region):
```sql
-- Create data filter
CREATE DATA FILTER sales_us_only
ON TABLE sales_data
COLUMN_NAMES *
ROW_FILTER '(region = "US")'
```

**Column-level filtering** (hide PII from analysts):
```bash
# Grant access to orders table but exclude PII columns
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::123456789012:role/AnalystRole \
  --resource '{
    "TableWithColumns": {
      "DatabaseName": "sales_db",
      "Name": "orders",
      "ColumnNames": ["order_id", "order_date", "total_price_usd", "order_status"]
    }
  }' \
  --permissions SELECT
```

Analysts with `AnalystRole` cannot see `customer_email`, `customer_phone`, or other PII columns.

## Common Pitfalls

### Storing Raw Data in Wrong Format

**Symptom**: Athena queries cost 10× more than expected, performance slow.

**Root cause**: Raw JSON stored uncompressed instead of Parquet with Snappy compression.

**Example cost impact**:
- 1 TB raw JSON, query selects 5 columns of 50 = 1 TB scanned = $5.00/query
- 1 TB converted to Parquet (10:1 compression) = 100 GB, query selects 5 columns = 10 GB scanned = $0.05/query

**Solution**: Always convert raw data to Parquet in processed/curated zones.

### Missing Partition Filters

**Symptom**: Queries slow and expensive despite partitioned tables.

**Root cause**: Queries don't filter on partition keys, Athena scans all partitions.

**Example**:
```sql
-- Bad: scans all 365 days
SELECT SUM(revenue) FROM orders WHERE order_status = 'completed';

-- Good: scans only November 2024
SELECT SUM(revenue)
FROM orders
WHERE year = 2024 AND month = 11 AND order_status = 'completed';
```

**Solution**: Always include partition key predicates (`year`, `month`, `day`) in WHERE clause.

### Over-Provisioning Redshift Cluster

**Symptom**: Redshift cluster costs $40,000/month but CPU utilization averages 15%.

**Root cause**: Cluster sized for peak load (Black Friday) but runs 24/7 at low utilization rest of year.

**Solution**: Use Redshift Serverless or implement auto-pause/resume.

**Redshift Serverless**:
- Pay per RPU-hour (Redshift Processing Unit)
- Auto-scales from 8 RPUs to 512 RPUs based on load
- Cost: $0.375/RPU-hour
- Example: Average 32 RPUs × 730 hours/month = $8,760/month vs $40,000 for over-provisioned cluster

**Alternative**: Pause cluster during off-hours (nights, weekends).
- Cluster runs 12 hours/day × 5 days/week = 260 hours/month (vs 730 hours 24/7)
- Cost reduction: 65% ($40,000 → $14,250)

### Not Implementing Data Lifecycle Policies

**Symptom**: S3 storage costs grow unbounded, storing 10 years of raw logs that are never queried after 90 days.

**Root cause**: No lifecycle policy to transition old data to cheaper storage or delete it.

**Solution**: Implement S3 lifecycle policies.

**Example lifecycle policy**:
```json
{
  "Rules": [{
    "Id": "archive-raw-logs",
    "Filter": {"Prefix": "raw/logs/"},
    "Status": "Enabled",
    "Transitions": [
      {
        "Days": 90,
        "StorageClass": "INTELLIGENT_TIERING"
      },
      {
        "Days": 365,
        "StorageClass": "GLACIER_DEEP_ARCHIVE"
      }
    ],
    "Expiration": {
      "Days": 2555  // 7 years retention
    }
  }]
}
```

**Cost impact**:
- S3 Standard: $0.023/GB/month
- S3 Intelligent-Tiering (infrequent access): $0.0125/GB/month
- S3 Glacier Deep Archive: $0.00099/GB/month

1 TB data stored 7 years:
- All S3 Standard: $0.023 × 1,000 GB × 84 months = $1,932
- Lifecycle policy: 3 months Standard + 9 months Intelligent-Tiering + 72 months Glacier = $69 + $113 + $71 = $253
- Savings: $1,679 (87%)

### Mixing Concerns in Data Lake Zones

**Symptom**: Processed zone contains mix of clean Parquet files and incomplete/corrupted files from failed jobs.

**Root cause**: Writing directly to final location instead of staging-then-promotion pattern.

**Solution**: Use staging directory, atomic promotion.

**Bad pattern**:
```python
# Write directly to final location
df.write.parquet("s3://datalake/processed/orders/year=2024/month=11/day=15/")
# If job fails mid-write, partial data left in final location
```

**Good pattern**:
```python
# Write to staging location
staging_path = "s3://datalake/staging/orders-20241115-143022/"
df.write.parquet(staging_path)

# Validate data quality
validate_data_quality(spark.read.parquet(staging_path))

# Atomic promotion (S3 rename is atomic)
import boto3
s3 = boto3.client('s3')

final_path = "s3://datalake/processed/orders/year=2024/month=11/day=15/"
# Copy staging to final, then delete staging
# Use S3 batch operations or AWS CLI sync for large datasets
```

### Not Monitoring Data Quality

**Symptom**: Dashboards show incorrect metrics for weeks before discovery.

**Root cause**: No automated data quality checks, rely on users reporting issues.

**Solution**: Implement automated quality checks with alerts.

**Example CloudWatch alarm**:
```python
# Glue job publishes data quality metrics to CloudWatch
cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_data(
    Namespace='DataQuality',
    MetricData=[{
        'MetricName': 'NullPercentage',
        'Dimensions': [
            {'Name': 'TableName', 'Value': 'orders'},
            {'Name': 'ColumnName', 'Value': 'customer_id'}
        ],
        'Value': null_percentage,
        'Unit': 'Percent'
    }]
)

# Create alarm: alert if null percentage > 5%
cloudwatch.put_metric_alarm(
    AlarmName='orders-customer-id-nulls',
    MetricName='NullPercentage',
    Namespace='DataQuality',
    Statistic='Average',
    Period=3600,
    EvaluationPeriods=1,
    Threshold=5.0,
    ComparisonOperator='GreaterThanThreshold',
    ActionsEnabled=True,
    AlarmActions=['arn:aws:sns:us-east-1:123456789012:data-quality-alerts']
)
```

## Key Takeaways

**Modern data architecture decouples storage from compute** using S3 as the central data lake. This eliminates the rigid schema-on-write requirement of traditional warehouses, reduces storage costs by 90-95%, and enables diverse tools (Athena, Redshift, SageMaker, QuickSight) to access the same data without duplication.

**Choose architecture pattern based on workload characteristics**. Use pure data lake (S3 + Athena) for cost-sensitive ad-hoc analytics on diverse data types. Use data warehouse (Redshift) for high-frequency, complex queries on structured data with sub-second latency requirements. Use lake house (Redshift + Spectrum) to combine hot data performance with cold data cost efficiency.

**Organize data lake into three zones**: Raw (original format, immutable), Processed (cleaned, Parquet with partitioning), Curated (business-level aggregates optimized for queries). This separation enables reprocessing, clear ownership, and performance optimization without compromising data lineage.

**Cost optimization comes from format conversion and lifecycle policies**. Converting JSON to Parquet reduces query costs by 90-98% through columnar compression and column pruning. S3 lifecycle policies transition infrequently-accessed data to Glacier, reducing storage costs by 95% (from $0.023/GB to $0.001/GB).

**Implement data governance from day one** using Glue Data Catalog naming conventions, Lake Formation access controls, and automated data quality checks. Row-level and column-level security enable multi-tenant architectures where different teams query the same catalog with appropriate filtering.

**Common pitfalls involve format choices and lifecycle management**. Storing raw JSON instead of Parquet increases costs 10-50×. Not implementing partition pruning causes full-table scans. Over-provisioning Redshift clusters wastes 50-80% of capacity. Missing lifecycle policies cause unbounded storage growth.

**Integration patterns connect batch and streaming pipelines** to the data lake. Use Glue for batch ETL, Kinesis Firehose for streaming ingestion, and Lambda for event-driven processing. Redshift Spectrum enables federated queries across data warehouse and data lake without data movement.

**The lake house pattern is the pragmatic default** for most organizations. Keep 90 days of hot data in Redshift for fast dashboards, archive historical data to S3, query both seamlessly with Redshift Spectrum. This provides Redshift performance where needed while achieving 95% storage cost reduction on cold data.
