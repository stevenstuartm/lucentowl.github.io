---
title: "AWS Glue: Serverless ETL & Data Catalog"
layout: guide
category: AWS
subcategory: Analytics & Data Processing
description: "ETL job orchestration, data crawlers, schema discovery, and serverless data transformation at scale"
tags: [aws, data-architecture, analytics, etl, automation, cost-analysis, governance]
---

## What Problems AWS Glue Solves

AWS Glue addresses the operational complexity and infrastructure burden of building and maintaining data pipelines at scale.

**Traditional ETL challenges**:
- Organizations spend weeks provisioning and configuring ETL infrastructure (servers, clusters, schedulers)
- Data schema changes break pipelines, requiring manual intervention to fix
- Teams build custom code to discover and catalog data across multiple data stores
- ETL jobs require constant capacity planning and resource tuning
- Pipeline failures go undetected until downstream consumers complain

**Concrete scenario**: Your analytics team runs nightly ETL jobs that transform raw event data from S3 into Parquet files for Athena queries. The existing solution uses a fleet of EC2 instances running custom Python scripts orchestrated by cron jobs. When event schema changes (new fields added), the pipeline breaks. When data volume spikes during promotions, jobs time out. The team spends 40% of their time managing infrastructure instead of building transformations. Worse, there's no central catalog showing what data exists, where it lives, or what its schema looks like. Data discovery happens through Slack messages and tribal knowledge.

**What Glue provides**: A serverless ETL service that automatically discovers data schemas, maintains a central metadata catalog, generates transformation code, and runs PySpark/Python jobs at scale without managing infrastructure. You define transformations, Glue provisions resources automatically, runs jobs on schedule or triggers, and handles retries and monitoring.

**Real-world impact**: After migrating to Glue, the analytics team eliminated EC2 management overhead entirely. Crawlers automatically detect schema changes and update the catalog. Jobs scale automatically with data volume. Cost dropped from $8,000/month (24/7 EC2 cluster) to $2,500/month (pay-per-job execution). The Data Catalog became the single source of truth for all datasets, enabling self-service analytics across the organization.

## Service Fundamentals

AWS Glue has four core components that work together: the Data Catalog (metadata repository), Crawlers (schema discovery), ETL Jobs (transformation logic), and Job Scheduling (orchestration).

### Glue Data Catalog

The Data Catalog is a centralized metadata repository that stores table definitions, schema information, and partition structures. It's fully compatible with Apache Hive Metastore, making it a drop-in replacement for existing Hive-based workflows.

**What it stores**:
- Database definitions (logical groupings of tables)
- Table schemas (column names, types, partitioning keys)
- Partition information (S3 paths for each partition)
- Connection details (JDBC URLs, credentials for data sources)
- Classifier definitions (custom parsers for proprietary formats)

<div class="callout callout--tip">
<p class="callout__title">Integration Points</p>
<p>Athena, Redshift Spectrum, EMR, QuickSight, SageMaker, and Lake Formation all use the Data Catalog as their metadata layer. Define a table once in Glue, query it from multiple services.</p>
</div>

**Example catalog structure**:
```
Database: ecommerce_raw
  └─ Table: clickstream_events
      ├─ Columns: user_id (string), event_type (string), timestamp (bigint), session_id (string)
      ├─ Partition Keys: year, month, day
      ├─ Location: s3://my-data-lake/clickstream/
      └─ Format: Parquet

Database: ecommerce_analytics
  └─ Table: user_sessions
      ├─ Columns: user_id (string), session_count (bigint), total_duration (bigint)
      ├─ Location: s3://my-data-lake/analytics/sessions/
      └─ Format: Parquet
```

**Permission model**: Uses IAM policies and resource policies. You can grant specific databases or tables to specific principals. Lake Formation adds fine-grained access control (column-level, row-level filtering).

### Crawlers

Crawlers connect to data sources, infer schemas, and populate the Data Catalog automatically. They handle schema evolution, partition discovery, and table updates without manual intervention.

**How crawlers work**:
1. Connect to data source (S3, RDS, Redshift, DynamoDB, JDBC)
2. Sample data to infer schema
3. Identify partitions based on S3 prefix patterns
4. Create or update table definitions in Data Catalog
5. Track schema changes and version metadata

**Crawler configuration**:
- **Data source**: S3 path, database connection, or DynamoDB table
- **IAM role**: Permissions to read source data and write to catalog
- **Schedule**: Run on demand, hourly, daily, weekly, or cron expression
- **Classifiers**: Built-in (JSON, CSV, Avro, Parquet, ORC, XML) or custom (Grok patterns)
- **Schema change policy**: Log changes, update catalog, or trigger alerts

**Partition discovery**: Crawlers automatically detect Hive-style partitions in S3 paths.

**Example S3 structure**:
```
s3://my-bucket/logs/
  ├─ year=2024/
  │   ├─ month=11/
  │   │   ├─ day=01/
  │   │   │   └─ events.parquet
  │   │   └─ day=02/
  │   │       └─ events.parquet
  │   └─ month=12/
```

Crawler creates table with partition keys `year`, `month`, `day` and registers each partition's S3 path. Athena queries can prune partitions efficiently.

**Schema evolution handling**:
- **Log mode**: Record changes but don't update catalog
- **Update catalog**: Add new columns, update types (if compatible)
- **Alert mode**: Send SNS notification on schema changes for manual review

**When to use crawlers**:
- ✅ Data arrives continuously with consistent structure (logs, events, sensor data)
- ✅ Schema evolves gradually (new fields added, existing fields rarely change types)
- ✅ Multiple partition keys require regular discovery (time-based partitions)
- ✅ Multiple teams contribute data to shared buckets (self-service catalog population)

**When NOT to use crawlers**:
- ❌ Static datasets with known schema (define tables manually via CloudFormation/Terraform)
- ❌ High-frequency small files (crawler overhead exceeds value; batch files first)
- ❌ Complex schema inference requirements (use custom ETL to define schema explicitly)

### ETL Jobs

ETL jobs contain transformation logic written in PySpark or Python Shell scripts. Glue provisions Spark clusters (or Python runtimes) automatically, runs your code, and tears down resources when complete.

**Job types**:

1. **Spark ETL Jobs**: Use PySpark on distributed Spark clusters for large-scale transformations
   - Best for: Processing TBs of data, complex joins, aggregations, machine learning prep
   - Worker types: G.1X (4 vCPU, 16 GB), G.2X (8 vCPU, 32 GB), G.025X (2 vCPU, 4 GB for light workloads)
   - Python Shell compatibility layer for pandas-style operations

2. **Python Shell Jobs**: Run Python scripts in single-node environments
   - Best for: Lightweight tasks, API calls, simple file operations, orchestration logic
   - Max runtime: 1 DPU (Data Processing Unit) = 1 vCPU, 4 GB memory
   - Cost: ~$0.44/hour (much cheaper than Spark for small tasks)

3. **Streaming ETL Jobs**: Process continuous data from Kinesis or Kafka
   - Micro-batching with configurable window sizes (10 seconds to minutes)
   - Checkpointing for exactly-once processing semantics

**DynamicFrame vs DataFrame**: Glue introduces DynamicFrame, a schema-flexible version of Spark DataFrame that handles schema inconsistencies gracefully.

**Example: Handle schema variance**
```python
from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame

glueContext = GlueContext(SparkContext.getOrCreate())

# Read from Data Catalog
datasource = glueContext.create_dynamic_frame.from_catalog(
    database="ecommerce_raw",
    table_name="clickstream_events"
)

# DynamicFrame handles records with different schemas
# Some records have "user_id", others have "userId", some have neither
resolved = datasource.resolveChoice(specs=[('user_id', 'cast:string')])

# Apply transformations using Glue transforms
transformed = resolved.apply_mapping([
    ("user_id", "string", "user_id", "string"),
    ("event_type", "string", "event_type", "string"),
    ("timestamp", "long", "timestamp", "timestamp")
])

# Write to S3 in Parquet format with partitioning
glueContext.write_dynamic_frame.from_catalog(
    frame=transformed,
    database="ecommerce_analytics",
    table_name="processed_events"
)
```

**Job bookmarks**: Track processed data to avoid reprocessing. Glue maintains state about which S3 objects or database rows have been processed in previous runs. Enable job bookmarks to achieve incremental ETL.

**Example incremental processing**:
- Day 1: Job processes 1,000 files in s3://bucket/2024/11/01/
- Day 2: Job processes only new files in s3://bucket/2024/11/02/
- Bookmark tracks last processed timestamp or S3 object list

**Job parameters**: Pass runtime parameters for flexibility.

```python
import sys
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'target_date', 'environment'])
target_date = args['target_date']  # e.g., "2024-11-15"
environment = args['environment']  # e.g., "production"
```

Invoke job with parameters:
```bash
aws glue start-job-run \
  --job-name process-daily-events \
  --arguments '{"--target_date":"2024-11-15","--environment":"production"}'
```

**Development endpoints** (legacy): Provision persistent Spark environments for interactive development. WARNING: Deprecated in favor of Glue Studio notebooks and SageMaker notebooks with Glue kernels.

### Job Scheduling and Triggers

**Triggers** start jobs automatically based on schedules or events.

**Trigger types**:

1. **Scheduled Triggers**: Cron-based scheduling
   ```
   cron(0 2 * * ? *)  # Daily at 2 AM UTC
   cron(0 */4 * * ? *)  # Every 4 hours
   ```

2. **Conditional Triggers**: Start job when previous jobs complete
   - **ANY**: Start when any watched job succeeds
   - **ALL**: Start when all watched jobs succeed
   - Useful for DAG-style workflows (extract → transform → load)

3. **On-Demand Triggers**: Start jobs via API, console, or EventBridge integration

**Example multi-job workflow**:
```
Crawler (discovers new partitions)
   ↓
Extract Job (reads raw data from S3)
   ↓
Transform Job (applies business logic, joins with reference data)
   ↓
Load Job (writes to Redshift)
   ↓
SNS Notification (alerts data consumers)
```

Configure triggers to orchestrate this flow:
- Crawler runs daily at 1 AM
- Conditional trigger starts Extract Job when crawler succeeds
- Conditional trigger starts Transform Job when Extract Job succeeds
- Conditional trigger starts Load Job when Transform Job succeeds

**EventBridge integration**: More powerful orchestration via EventBridge rules.

**Example EventBridge rule**: Start Glue job when new files arrive in S3.
```json
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": {
      "name": ["my-raw-data-bucket"]
    },
    "object": {
      "key": [{
        "prefix": "incoming/clickstream/"
      }]
    }
  }
}
```

Target: Glue job via EventBridge Pipes or Lambda function that calls `start-job-run`.

### Glue Studio

Visual ETL development environment that generates PySpark code automatically. Drag-and-drop interface for building transformations without writing code.

**Features**:
- Visual DAG editor (nodes represent data sources, transforms, targets)
- Built-in transforms (join, aggregate, filter, drop fields, map types)
- Code preview and editing (switch between visual and code views)
- Job monitoring with visual execution graphs
- Notebooks for interactive development (Jupyter-style with Glue kernel)

**When to use Glue Studio**:
- ✅ Analysts and data engineers who prefer visual tools
- ✅ Simple ETL pipelines with standard transforms (80% of use cases)
- ✅ Rapid prototyping before refining in code

**When to use code directly**:
- ✅ Complex business logic requiring custom functions
- ✅ Advanced Spark optimizations (caching, broadcast joins, repartitioning)
- ✅ CI/CD pipelines that version-control job definitions

## Architecture Patterns

### Pattern 1: S3 Data Lake with Athena

Use Glue to catalog data in S3 and enable SQL queries via Athena.

**Components**:
- S3 buckets organized by zone (raw, processed, curated)
- Crawlers discover and catalog data in each zone
- ETL jobs transform raw → processed → curated
- Athena queries curated tables directly

**Example zones**:
- **Raw**: Original data in original format (JSON, CSV, logs)
- **Processed**: Cleaned, deduplicated, converted to columnar format (Parquet/ORC)
- **Curated**: Business-level aggregations, joined with dimensions, optimized for BI

**Cost optimization**: Convert raw JSON to Parquet in processed zone. Query costs drop 90% (scan less data, better compression).

**Example transformation**:
- Raw zone: 1 TB of JSON logs
- Processed zone: 100 GB Parquet (10x compression)
- Athena query scans 100 GB instead of 1 TB → $5 vs $0.50 per query

### Pattern 2: Incremental ETL with Job Bookmarks

Process only new data each run to minimize cost and runtime.

**Setup**:
1. Enable job bookmarks in job configuration
2. Partition source data by time (year/month/day or hour)
3. Job reads from catalog, bookmark tracks last processed partition
4. Subsequent runs process only new partitions

**Example scenario**: Daily clickstream processing.
- Day 1: Process year=2024/month=11/day=01/ (100 GB)
- Day 2: Process year=2024/month=11/day=02/ (100 GB) — previous day's data skipped
- Runtime: 30 minutes/day instead of hours reprocessing entire history

**Limitation**: Bookmarks work with S3, relational databases (JDBC), and DynamoDB. Not compatible with all sources (e.g., Kafka requires manual offset management).

### Pattern 3: Cross-Account Data Sharing

Share Data Catalog with other AWS accounts using resource policies and Lake Formation.

**Use case**: Central data platform team manages catalog, business units query from their own accounts.

**Setup**:
1. Grant catalog access via resource policy
2. Use Lake Formation grants for fine-grained permissions
3. Consumers query via Athena/Redshift Spectrum in their account
4. Data stays in producer's S3 bucket (cross-account access via bucket policy)

**Example policy**: Allow account 222222222222 to read database `ecommerce_analytics`.
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::222222222222:root"},
    "Action": [
      "glue:GetDatabase",
      "glue:GetTable",
      "glue:GetPartitions"
    ],
    "Resource": [
      "arn:aws:glue:us-east-1:111111111111:catalog",
      "arn:aws:glue:us-east-1:111111111111:database/ecommerce_analytics",
      "arn:aws:glue:us-east-1:111111111111:table/ecommerce_analytics/*"
    ]
  }]
}
```

Consumer account also needs S3 bucket policy allowing `s3:GetObject` on data location.

### Pattern 4: Real-Time Streaming ETL

Process data continuously from Kinesis or Kafka using Glue streaming jobs.

**Components**:
- Kinesis Data Stream or MSK (Kafka) as source
- Glue streaming job with windowing and aggregation
- S3 or Kinesis Firehose as sink
- Checkpointing for fault tolerance

**Example**: Real-time user activity aggregation.
```python
from awsglue.context import GlueContext
from pyspark.sql import SparkSession
from pyspark.sql.functions import window, count

glueContext = GlueContext(SparkSession.builder.getOrCreate())

# Read from Kinesis stream
stream_df = glueContext.create_data_frame.from_options(
    connection_type="kinesis",
    connection_options={
        "streamARN": "arn:aws:kinesis:us-east-1:123456789012:stream/clickstream",
        "startingPosition": "TRIM_HORIZON"
    }
)

# Apply windowed aggregation (5-minute windows)
windowed = stream_df \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(
        window("timestamp", "5 minutes"),
        "user_id"
    ) \
    .agg(count("*").alias("event_count"))

# Write to S3 with checkpointing
query = windowed.writeStream \
    .format("parquet") \
    .option("path", "s3://my-bucket/streaming-output/") \
    .option("checkpointLocation", "s3://my-bucket/checkpoints/") \
    .start()

query.awaitTermination()
```

**Checkpointing**: Glue saves processing state to S3. If job crashes, it resumes from last checkpoint without data loss or duplication.

## Cost Optimization Strategies

Glue pricing has three components: DPU-hours for jobs, crawler runtime, and Data Catalog storage. Optimize each independently.

### Job Cost Optimization

**DPU pricing**: $0.44 per DPU-hour. Jobs use minimum 2 DPUs for Python Shell, 2-100 DPUs for Spark jobs.

**Right-size worker allocation**:
- Start with 10 DPUs for typical workloads
- Monitor job metrics (CPU utilization, data shuffle size)
- Increase DPUs if job is slow and CPU-bound
- Decrease DPUs if utilization is low (<50%)

**Example cost reduction**: Job processes 500 GB daily, initially allocated 50 DPUs.
- Initial: 50 DPUs × 2 hours × $0.44 = $44/day = $1,320/month
- After optimization: 20 DPUs × 1.5 hours × $0.44 = $13.20/day = $396/month
- Savings: $924/month (70% reduction)

**Worker type selection**:
- **G.025X** (2 vCPU, 4 GB): Small datasets (<10 GB), light transformations → $0.44/hour
- **G.1X** (4 vCPU, 16 GB): Standard workloads (10-500 GB) → $0.44/hour
- **G.2X** (8 vCPU, 32 GB): Memory-intensive joins, large shuffles → $0.88/hour

Default is G.1X. Use G.025X for simple jobs to cut costs in half.

**Auto Scaling**: Enable auto scaling to adjust DPU count dynamically based on workload. Glue monitors execution and adds/removes workers automatically.

**Partitioning strategy**: Process only necessary partitions.
```python
# Inefficient: reads entire table
datasource = glueContext.create_dynamic_frame.from_catalog(
    database="logs",
    table_name="events"
)

# Efficient: reads only yesterday's partition
datasource = glueContext.create_dynamic_frame.from_catalog(
    database="logs",
    table_name="events",
    push_down_predicate="year='2024' and month='11' and day='14'"
)
```

**File format conversion**: Convert JSON/CSV to Parquet early in pipeline. Downstream jobs process compressed Parquet faster than uncompressed text formats.

**Job bookmarks**: Avoid reprocessing data. Enable bookmarks for incremental ETL.

### Crawler Cost Optimization

**Crawler pricing**: $0.44 per DPU-hour (same as jobs). Crawlers use 2-10 DPUs depending on data source complexity.

**Reduce crawler frequency**:
- Don't run crawlers on fixed schedules if data arrival is sporadic
- Trigger crawlers via EventBridge when S3 bucket receives new files
- Run crawlers weekly instead of daily for slowly-changing datasets

**Example cost reduction**:
- Initial: Crawler runs hourly (24 runs/day × 5 minutes × $0.44/hour × 2 DPUs) = $1.76/day = $53/month
- Optimized: Crawler runs on S3 event trigger (5 runs/day × 5 minutes × $0.44/hour × 2 DPUs) = $0.37/day = $11/month
- Savings: $42/month per crawler

**Exclude unnecessary paths**: Configure crawler to skip temporary directories, logs, or non-data files.
```
Include paths: s3://my-bucket/data/
Exclude patterns: s3://my-bucket/data/_temp/*, s3://my-bucket/data/*.log
```

**Manual table definitions**: For static datasets, define tables via CloudFormation/Terraform instead of running crawlers. One-time setup instead of recurring cost.

### Data Catalog Cost Optimization

**Catalog pricing**:
- First 1 million objects stored: Free
- Beyond 1 million: $1 per 100,000 objects per month
- First 1 million requests: Free
- Beyond 1 million: $1 per 1 million requests

**Most organizations never pay for catalog storage** because they have fewer than 1 million table/partition combinations. Only high-scale data lakes with thousands of tables and millions of partitions hit this threshold.

**Partition management**: Delete old partitions no longer needed.
```python
import boto3

glue = boto3.client('glue')

# Delete partitions older than 90 days
glue.batch_delete_partition(
    DatabaseName='logs',
    TableName='events',
    PartitionsToDelete=[
        {'Values': ['2024', '08', '01']},
        {'Values': ['2024', '08', '02']},
        # ... more partitions
    ]
)
```

Automate partition deletion with Lambda function triggered by EventBridge schedule.

## Security Best Practices

### IAM Roles and Policies

**Principle of least privilege**: Grant only necessary permissions to crawlers and jobs.

**Example job role policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-raw-bucket/*",
        "arn:aws:s3:::my-processed-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:UpdateTable",
        "glue:CreateTable"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:/aws-glue/*"
    }
  ]
}
```

**Avoid wildcard permissions** on S3. Specify exact buckets and prefixes.

### Data Encryption

**Encryption at rest**:
- S3: Enable SSE-S3 or SSE-KMS on buckets
- Glue catalog: Enable encryption with KMS key
- Job outputs: Configure jobs to write encrypted data

**Enable catalog encryption**:
```bash
aws glue put-data-catalog-encryption-settings \
  --data-catalog-encryption-settings \
  'EncryptionAtRest={CatalogEncryptionMode=SSE-KMS,SseAwsKmsKeyId=arn:aws:kms:us-east-1:123456789012:key/abc-123}'
```

**Encryption in transit**:
- Glue jobs communicate with S3 over HTTPS automatically
- JDBC connections: Use SSL/TLS connection parameters
- Enforce encryption for database connections

### Network Isolation

**VPC configuration**: Run Glue jobs in VPC to access private resources (RDS, Redshift, ElastiCache).

**Requirements**:
- Subnet with available IP addresses (Glue provisions ENIs)
- Security group allowing outbound traffic to data sources
- S3 VPC endpoint for S3 access without internet gateway
- Glue VPC endpoint for Glue API calls from private subnets

**Example setup**:
1. Create private subnets in VPC
2. Create S3 gateway endpoint
3. Create Glue interface endpoint (com.amazonaws.region.glue)
4. Attach security group to job allowing outbound to RDS (port 5432)
5. Configure job to use VPC, subnets, and security group

**Avoid NAT Gateway costs**: Use VPC endpoints instead of routing S3/Glue traffic through NAT Gateway. Saves $0.045/GB in NAT processing charges.

### Secrets Management

**Don't hardcode credentials in job code**. Use Secrets Manager or Systems Manager Parameter Store.

**Example: Retrieve database password**:
```python
import boto3
import json

secrets = boto3.client('secretsmanager')

response = secrets.get_secret_value(SecretId='prod/db/redshift')
secret = json.loads(response['SecretString'])

jdbc_url = f"jdbc:redshift://{secret['host']}:5439/{secret['database']}"
connection_options = {
    "url": jdbc_url,
    "user": secret['username'],
    "password": secret['password']
}

df = glueContext.create_dynamic_frame.from_options(
    connection_type="redshift",
    connection_options=connection_options
)
```

**IAM policy for Secrets Manager access**:
```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db/*"
}
```

### Lake Formation Integration

AWS Lake Formation adds fine-grained access control on top of Glue Data Catalog.

**Capabilities**:
- Column-level permissions (hide sensitive fields like SSN, credit cards)
- Row-level filtering (filter data by region, department, etc.)
- Tag-based access control (grant access to tables with specific tags)
- Cross-account data sharing with governed access

**Example column-level security**: Grant analytics team access to user table but exclude PII columns.
```
Table: users
Columns: user_id, email, name, address, created_at
Grant: SELECT on user_id, created_at (analytics_team)
Deny: SELECT on email, name, address (analytics_team)
```

Users in analytics_team see filtered view when querying via Athena or Redshift Spectrum.

## When to Use AWS Glue

**Strong fit**:
- ✅ Building serverless data lakes on S3
- ✅ ETL workloads with unpredictable or variable volume (pay per job execution)
- ✅ Teams want to avoid managing Spark clusters (EMR, Databricks)
- ✅ Need centralized metadata catalog for Athena, Redshift Spectrum, EMR
- ✅ Schema evolution and discovery requirements (crawlers handle automatically)
- ✅ Incremental processing patterns with job bookmarks
- ✅ Integration with AWS analytics services (Athena, QuickSight, Lake Formation)

**Consider alternatives when**:
- ❌ **Continuous high-throughput streaming** → Kinesis Data Analytics (Flink) or self-managed Spark Streaming on EMR for sub-second latency
- ❌ **Complex DAGs with dependencies** → Step Functions with Lambda/ECS, Airflow on MWAA, or dbt for transformation orchestration
- ❌ **Real-time requirements** → Kinesis + Lambda for event-driven processing with millisecond latency
- ❌ **Existing Hadoop ecosystem investment** → EMR provides full control over Spark/Hive versions and configurations
- ❌ **Advanced Spark features** → EMR for Spark Structured Streaming, Delta Lake, or custom libraries not available in Glue

## Glue vs Alternatives

### Glue vs EMR

| Aspect | Glue | EMR |
|--------|------|-----|
| **Management** | Fully serverless, no clusters to manage | Self-managed Spark/Hadoop clusters |
| **Pricing** | Pay per job (DPU-hour), $0.44/DPU-hour | Pay for EC2 instances, $0.096/hour + EC2 costs |
| **Scaling** | Auto-scales per job | Manual cluster resizing or auto-scaling groups |
| **Startup time** | 1-3 minutes per job | 5-10 minutes for cluster launch (or keep persistent cluster) |
| **Spark versions** | Glue 4.0 = Spark 3.3, limited version control | Choose any Spark version, custom builds |
| **Use case** | Periodic batch ETL, unpredictable workloads | Continuous processing, advanced Spark features, custom libraries |

**Cost example**: Processing 100 GB daily.
- Glue: 10 DPUs × 0.5 hours × $0.44 = $2.20/day = $66/month
- EMR: 3 × m5.xlarge (persistent cluster) × 24 hours × $0.288 = $20.74/day = $622/month

Glue wins for intermittent workloads. EMR wins if you run jobs continuously or need persistent interactive clusters.

### Glue vs AWS Data Pipeline

AWS Data Pipeline is a legacy orchestration service. **Prefer Glue + Step Functions for new projects**.

| Aspect | Glue | Data Pipeline |
|--------|------|---------------|
| **Job runtime** | PySpark or Python Shell | Any script (shell, SQL, Hadoop) |
| **Orchestration** | Triggers, EventBridge, Step Functions | Built-in scheduling and dependency management |
| **Metadata** | Glue Data Catalog (Athena integration) | No catalog integration |
| **Status** | Actively developed, new features | Maintenance mode |

Data Pipeline is useful if you have complex shell-script-based workflows already built. Otherwise, use Glue for ETL and Step Functions for orchestration.

### Glue vs Lambda

Lambda is excellent for lightweight data processing but not suitable for large-scale ETL.

| Aspect | Glue | Lambda |
|--------|------|-------|
| **Execution time** | No limit (jobs run until complete) | 15-minute timeout |
| **Memory** | Up to 32 GB per worker | Max 10 GB |
| **Parallelism** | Distributed Spark processing | Single-function execution (invoke many Lambdas for parallelism) |
| **Best for** | Batch ETL, large datasets (GBs to TBs) | Event-driven processing, small payloads (<10 MB) |

**Example boundary**: Processing 10,000 small JSON files (1 MB each) → Lambda with S3 event triggers. Processing 1,000 large Parquet files (1 GB each) → Glue Spark job.

### Glue vs dbt

dbt (data build tool) transforms data using SQL and runs on top of data warehouses (Redshift, Snowflake, BigQuery). Glue transforms data using PySpark and runs on S3 data lakes.

**They solve different problems**:
- **Glue**: Extract and transform raw data into clean datasets (schema evolution, format conversion, complex logic)
- **dbt**: Transform clean datasets into analytics models (joins, aggregations, business metrics)

**Common pattern**: Use both together.
1. Glue jobs extract raw data from sources (databases, APIs, logs) and load into S3 (or Redshift staging tables)
2. dbt models transform staged data into final analytics tables
3. BI tools (QuickSight, Tableau) query dbt models

Glue handles infrastructure complexity, dbt handles transformation logic and testing.

## Common Pitfalls

### Small File Problem

**Symptom**: Glue job runs slowly and costs more than expected despite small total data volume.

**Root cause**: Thousands of small files (KBs to MBs) create excessive overhead. Spark spends more time listing and opening files than processing data.

**Example**: 1 TB of data split into 1 million × 1 MB files vs 1,000 × 1 GB files. The former takes 10× longer to process due to file I/O overhead.

**Solution**: Compact small files into larger files using Glue job or AWS Lambda.

**Compaction job**:
```python
# Read small files
df = spark.read.parquet("s3://my-bucket/small-files/")

# Repartition and write as fewer large files
df.repartition(100).write.parquet("s3://my-bucket/compacted/")
```

**Recommendation**: Target `128 MB − 1 GB` file sizes for optimal Spark performance.

### Skewed Partitions

**Symptom**: Job takes hours despite low average partition size. Most workers idle while one worker processes enormous partition.

**Root cause**: Unbalanced data distribution across partitions. One user, region, or date has 100× more data than others.

**Example**: User activity logs partitioned by user_id. Power users (bots, test accounts) generate 90% of events.

**Solution**: Use composite partition keys or bucketing.

**Composite partitioning**:
```
Partition by: year, month, day, hour (instead of just year, month, day)
```

Spreads data more evenly across partitions.

**Bucketing** (Spark 3+):
```python
df.write \
  .bucketBy(100, "user_id") \
  .sortBy("timestamp") \
  .parquet("s3://my-bucket/bucketed/")
```

Divides data into fixed number of buckets regardless of key distribution.

### Job Bookmark Gaps

**Symptom**: Job bookmarks enabled but job still reprocesses old data.

**Root cause**: Bookmarks track S3 objects or database timestamps. If source data is updated in place (overwritten), bookmarks don't detect changes.

**Example**: Daily batch updates S3 file `s3://bucket/latest.parquet` in place. Bookmark sees same object key, assumes already processed.

**Solution**: Use immutable data patterns. Write new files instead of overwriting.

**Immutable pattern**:
```
s3://bucket/data/year=2024/month=11/day=01/run-20241101-143022.parquet
s3://bucket/data/year=2024/month=11/day=01/run-20241101-183014.parquet
```

Bookmark tracks processed files by path. New runs create new files, triggering reprocessing.

### Schema Mismatch Failures

**Symptom**: Job fails with "cannot resolve column" or type casting errors.

**Root cause**: Schema evolved (column renamed, type changed) but job code still references old schema.

**Example**: Raw data changes `userId` → `user_id`. Job code still reads `userId`.

**Solution**: Use schema-flexible DynamicFrame and handle missing columns gracefully.

```python
# Resolve ambiguous columns
df = df.resolveChoice(specs=[('user_id', 'cast:string')])

# Handle missing columns
if 'userId' in df.columns:
    df = df.withColumnRenamed('userId', 'user_id')
```

**Better solution**: Enforce schema at ingestion (validate before writing to S3). Use Glue Schema Registry or JSON Schema validation.

### Connection Timeout to Private Resources

**Symptom**: Job fails to connect to RDS/Redshift in VPC with timeout errors.

**Root cause**: Missing VPC configuration or incorrect security groups.

**Checklist**:
1. ✅ Job configured with VPC, subnets, and security group
2. ✅ Subnets have available IP addresses (Glue provisions ENIs)
3. ✅ Security group allows outbound to database port (3306, 5432, 5439)
4. ✅ Database security group allows inbound from Glue security group
5. ✅ Glue VPC endpoint exists (com.amazonaws.region.glue) for private API calls
6. ✅ S3 VPC endpoint exists (gateway endpoint) for S3 access

**Test connectivity**: Run simple Python Shell job that connects to database and prints result.

```python
import psycopg2

conn = psycopg2.connect(
    host="my-db.cluster.us-east-1.rds.amazonaws.com",
    port=5432,
    user="admin",
    password="password",
    database="mydb"
)

cursor = conn.cursor()
cursor.execute("SELECT 1")
print(cursor.fetchone())
```

If this fails, issue is network/security groups, not Glue job logic.

## Key Takeaways

**AWS Glue eliminates ETL infrastructure management** through serverless job execution, automatic schema discovery, and centralized metadata catalog. It's the foundation for modern S3 data lakes integrated with Athena, Redshift Spectrum, and analytics services.

**Cost efficiency comes from right-sizing and incremental processing**. Use job bookmarks to avoid reprocessing data, choose appropriate worker types (G.025X for light jobs, G.1X for standard, G.2X for memory-intensive), and trigger crawlers based on actual data arrival instead of fixed schedules.

**The Data Catalog is the central value proposition**. Define schemas once, query from multiple services (Athena, Redshift, EMR, QuickSight). Share catalogs across accounts with Lake Formation for governed data access.

**Glue excels for batch ETL on unpredictable workloads** where serverless scaling and pay-per-job pricing outweigh the control of self-managed clusters. For continuous streaming with sub-second latency, complex orchestration, or advanced Spark features, consider Kinesis + Lambda, Step Functions + ECS, or EMR.

**Security defaults matter**. Enable catalog encryption, use VPC endpoints to avoid NAT costs, store credentials in Secrets Manager, and apply least-privilege IAM policies. Lake Formation adds fine-grained access control (column-level, row-level) on top of catalog permissions.

**Common pitfalls involve file size, partition skew, and network configuration**. Compact small files into `128 MB − 1 GB` sizes, use composite partitioning or bucketing to balance data distribution, and verify VPC endpoint and security group setup when accessing private resources.

**Integrate with broader AWS ecosystem**: Glue catalogs data, Athena queries it, QuickSight visualizes it, Lake Formation governs it. This combination provides enterprise-grade data platform capabilities without managing infrastructure.
