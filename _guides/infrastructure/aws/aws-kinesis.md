---
title: "AWS Kinesis for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "Comprehensive guide to AWS Kinesis covering Data Streams and Firehose for real-time streaming, sharding strategies, scaling patterns, cost optimization, and comparison with SQS for event processing"
tags: [aws, kinesis, streaming, real-time, data-processing, analytics, architecture, cost-optimization, fundamentals]
---

## What Problems Kinesis Solves

### Without Streaming Infrastructure

**Real-Time Data Processing Challenges:**
- Batch processing delays prevent real-time insights (hours/days lag)
- Custom infrastructure required to handle high-throughput data ingestion
- No ordering guarantees for events from same source
- Difficult to replay historical data for reprocessing
- Complex fan-out logic to distribute data to multiple consumers
- Manual sharding and partition management

**Real-World Impact:**
- Clickstream analytics delayed by 24 hours; can't respond to user behavior in real-time
- IoT sensor data processed in hourly batches; anomalies detected too late
- Log aggregation from 10,000 servers requires custom collection infrastructure
- Failed processing job requires manual reconstruction of input data
- Adding new analytics consumer requires changing producer code

### With Kinesis

**Managed Streaming Platform:**
- **Real-time ingestion**: Millisecond latency from data production to consumption
- **Ordered delivery**: Events from same partition key delivered in order
- **Replay capability**: Reprocess historical data with up to 365 days retention
- **Multiple consumers**: Fan-out to multiple applications reading same stream
- **Automatic scaling**: On-demand mode scales with traffic for Data Streams or fully managed for Firehose
- **Durable storage**: Data replicated across 3 Availability Zones

**Problem-Solution Mapping:**

| Problem | Kinesis Data Streams Solution | Kinesis Firehose Solution |
|---------|------------------------------|---------------------------|
| Real-time processing needed | Sub-second latency with immediate consumer processing | Near real-time delivery to destinations in 60-900 seconds |
| High throughput exceeding 10,000 events/sec | Scales to millions of events/sec with sharding | Auto-scales without throughput limits |
| Need to replay data | Retain data 1-365 days and reprocess anytime | No replay with direct delivery; use Data Streams if needed |
| Multiple consumers need same data | Enhanced fan-out provides 2 MB/sec per consumer | Single destination per delivery stream |
| Custom processing before storage | Lambda and KCL apps process and transform | Built-in Lambda transformation before delivery |
| Complex infrastructure management | Managed service with no servers to manage | Fully managed with zero infrastructure |

---

## Kinesis Service Family

AWS Kinesis comprises four services for different streaming use cases.

### Service Comparison

| Service | Purpose | Use Case | Latency | Consumer Types |
|---------|---------|----------|---------|---------------|
| **Kinesis Data Streams** | Real-time data streaming with custom processing | Build custom real-time applications (analytics, monitoring, ML) | 70ms-200ms | Lambda, KCL apps, Firehose, Analytics |
| **Kinesis Firehose** | Serverless data delivery to AWS services | Load streaming data into S3, Redshift, OpenSearch, HTTP endpoints | 60s (minimum) | S3, Redshift, OpenSearch, Splunk, HTTP |
| **Kinesis Data Analytics** | SQL queries on streaming data | Real-time SQL analytics, anomaly detection | Real-time | Firehose, Lambda, Streams |
| **Kinesis Video Streams** | Stream video from devices | Video surveillance, computer vision, media analytics | Real-time | EC2, SageMaker, custom apps |

**This guide focuses on Data Streams and Firehose** (most commonly used for event processing and data ingestion).

---

## Kinesis Data Streams Fundamentals

### What is Kinesis Data Streams?

**Kinesis Data Streams** is a real-time data streaming service that captures and stores data streams for processing by custom applications.

**Architecture:**

```
Producers → [Kinesis Data Stream] → Consumers
              (Shards)                (KCL, Lambda, Firehose)

Stream = Ordered sequence of data records
Shard = Unit of capacity (1 MB/sec write, 2 MB/sec read)
```

### Core Concepts

**1. Stream**

Logical collection of shards that ingest and store data records.

**2. Shard**

Basic unit of capacity and parallelism.

<div class="callout callout--note">
<p class="callout__title">Shard Capacity</p>
<ul>
<li>Write: 1 MB/sec or 1,000 records/sec</li>
<li>Read: 2 MB/sec (shared mode) or 2 MB/sec per consumer (enhanced fan-out)</li>
</ul>
</div>

**3. Data Record**

Individual unit of data written to stream.

**Record Structure:**

```json
{
  "Data": "base64-encoded payload",
  "PartitionKey": "user-12345",
  "SequenceNumber": "49590338271490256608559692538361571095921575989136588898"
}
```

**Key Fields:**
- `Data`: Payload (up to 1 MB)
- `PartitionKey`: Determines which shard receives record
- `SequenceNumber`: Unique identifier; increases over time within shard

**4. Partition Key**

String used to group related records into same shard (ensures ordering).

**Example:** `user-12345` ensures all events from user 12345 go to same shard and are processed in order.

### Capacity Modes

**1. On-Demand Mode (2022+)**

**Characteristics:**
- Automatically scales shards based on traffic
- No capacity planning required
- Pay per GB ingested/retrieved

**When to Use:**
- Unpredictable or variable traffic
- New workloads with unknown capacity needs
- Traffic with large spikes

**Pricing:**
- $0.040 per GB ingested
- $0.015 per GB retrieved

**2. Provisioned Mode**

**Characteristics:**
- Manually specify number of shards
- Predictable capacity and cost
- Pay per shard-hour

**When to Use:**
- Predictable traffic patterns
- Cost optimization for steady workloads

**Pricing:**
- $0.015 per shard-hour ($10.80/month per shard)
- $0.014 per million PUT requests (>1 million/month)

### Retention Period

**Configurable retention:**
- Default: 24 hours
- Maximum: 365 days (8,760 hours)

**Pricing:** $0.023 per GB-month for retention >24 hours

**Use Case:** Replay data for reprocessing, debugging, or backfilling analytics.

---

## Kinesis Data Firehose Fundamentals

### What is Kinesis Firehose?

**Kinesis Data Firehose** is a fully managed service for loading streaming data into AWS data stores and analytics services.

**Architecture:**

```
Producers → [Firehose Delivery Stream] → Transformation (optional) → Destination
                                            (Lambda)                  (S3, Redshift, etc.)
```

**Key Difference from Data Streams:** Firehose is a **delivery service** (push model) vs Data Streams is a **streaming platform** (pull model with custom consumers).

### Core Concepts

**1. Delivery Stream**

Configuration defining source, transformation, and destination.

**2. Destinations**

Supported targets:
- **S3**: Data lake storage, archival, analytics
- **Redshift**: Data warehousing (via S3 COPY)
- **OpenSearch**: Log analytics, full-text search
- **Splunk**: Third-party SIEM
- **HTTP Endpoint**: Custom destinations, third-party services
- **Datadog, New Relic, MongoDB, Snowflake**: Partner integrations

**3. Buffering**

Firehose batches records before delivery.

**Buffer Configuration:**
- **Size**: `1 MB − 128 MB` (default: 5 MB)
- **Interval**: `60 seconds − 900 seconds` (default: 300s)

**Delivery triggers when EITHER condition met:**
- Buffer size reached
- Buffer interval elapsed

**Example:** 5 MB buffer, 60s interval
- If 5 MB accumulated in 30s, deliver immediately
- If only 1 MB after 60s, deliver anyway

### Data Transformation

**Built-in Lambda transformation:**

```
Source → [Firehose] → Lambda (transform) → Destination
```

**Common Transformations:**
- Convert formats (JSON → Parquet, CSV → JSON)
- Enrich data (add metadata, lookup values)
- Filter records (exclude certain events)
- Decompress/compress

**Lambda Limitations:**
- 6 MB payload limit
- 5 minutes execution timeout

### Dynamic Partitioning (S3 Only)

**Problem:** All records written to single S3 prefix; queries scan entire dataset.

**Solution:** Partition records by key (e.g., `year/month/day/hour`) for efficient queries.

**Configuration:**

```json
{
  "PartitioningConfiguration": {
    "Enabled": true,
    "PartitionKeys": [
      {
        "Name": "year",
        "Type": "Date",
        "Path": "$.timestamp",
        "Format": "yyyy"
      },
      {
        "Name": "month",
        "Type": "Date",
        "Path": "$.timestamp",
        "Format": "MM"
      }
    ]
  }
}
```

**Output Structure:**

```
s3://my-bucket/
  └── year=2025/
      └── month=01/
          └── day=14/
              └── data-2025-01-14-12-00.parquet
```

**Benefit:** Athena and Redshift queries filter by partition and scan only relevant data.

---

## Sharding Strategies

### Understanding Shards

**Shard determines:**
1. Which records are processed together (partition key grouping)
2. Order guarantees (records in same shard ordered by sequence number)
3. Throughput capacity (1 MB/sec write per shard)

### Choosing Partition Key

**Good Partition Keys:**
- High cardinality (many unique values)
- Evenly distributed (no hot shards)
- Groups related events (e.g., user ID, device ID, session ID)

**Examples:**

| Use Case | Good Partition Key | Bad Partition Key |
|----------|-------------------|-------------------|
| Clickstream | `user-{userId}` | `page-name` (few unique values) |
| IoT sensors | `device-{deviceId}` | `sensor-type` (creates hot shards) |
| Application logs | `request-{requestId}` | `log-level` (ERROR/INFO/DEBUG = 3 shards) |
| Financial transactions | `account-{accountId}` | `transaction-type` (buy/sell = 2 shards) |

### Calculating Required Shards

**Formula:**

```
Required Shards = MAX(
  CEIL(Write Throughput MB/sec / 1 MB/sec),
  CEIL(Read Throughput MB/sec / 2 MB/sec)
)
```

**Example 1: Write-Heavy**

```
Write: 5 MB/sec
Read: 3 MB/sec

Shards needed = MAX(CEIL(5/1), CEIL(3/2)) = MAX(5, 2) = 5 shards
```

**Example 2: Read-Heavy (3 consumers, shared mode)**

```
Write: 2 MB/sec
Read: 2 MB/sec per consumer × 3 consumers = 6 MB/sec total

Shared mode: All consumers share 2 MB/sec per shard
Shards needed = MAX(CEIL(2/1), CEIL(6/2)) = MAX(2, 3) = 3 shards
```

**Example 3: Enhanced Fan-Out (3 consumers)**

```
Write: 2 MB/sec
Read: 2 MB/sec per consumer (each gets dedicated 2 MB/sec per shard)

Enhanced fan-out: Each consumer gets 2 MB/sec per shard independently
Shards needed = MAX(CEIL(2/1), CEIL(2/2)) = MAX(2, 1) = 2 shards
```

### Hot Shards

**Problem:** Uneven distribution causes some shards to hit limits while others are underutilized.

**Cause:** Poor partition key choice (e.g., celebrity user gets 80% of traffic).

**Detection:**

```
CloudWatch Metric: WriteProvisionedThroughputExceeded > 0 on specific shards
CloudWatch Metric: IncomingBytes per shard (identify which shards hot)
```

**Solutions:**

**1. Add Random Suffix to Partition Key:**

```python
# Before (hot shard for celebrity user)
partition_key = f"user-{user_id}"

# After (distribute across shards)
import random
partition_key = f"user-{user_id}-{random.randint(0, 9)}"
```

**Trade-Off:** Loses ordering guarantees across suffixes (records for same user split across shards).

**2. Use Composite Key:**

```python
# Combine user ID with timestamp hour
partition_key = f"user-{user_id}-{hour}"
```

**3. Increase Shard Count:**

Add more shards so hot key doesn't saturate single shard.

### Resharding

**Shard Splitting:**

Split single shard into two (increase capacity).

```
Before: Shard-001 (1 MB/sec write)
After: Shard-002 (1 MB/sec write) + Shard-003 (1 MB/sec write) = 2 MB/sec total
```

**Shard Merging:**

Merge two shards into one (decrease capacity, reduce cost).

**On-Demand Mode:** Automatic resharding (no manual intervention).

**Provisioned Mode:** Manual or use Application Auto Scaling.

---

## Kinesis vs SQS Decision Framework

### Feature Comparison

| Feature | Kinesis Data Streams | SQS |
|---------|---------------------|-----|
| **Ordering** | Guaranteed per shard (partition key) | FIFO queues only (up to 300 TPS) |
| **Delivery** | At-least-once (consumers read records) | At-least-once (Standard), Exactly-once (FIFO) |
| **Retention** | `24 hours − 365 days` | `1 minute − 14 days` |
| **Replay** | Yes (reprocess any point in retention) | No (message deleted after processing) |
| **Multiple Consumers** | Yes (fan-out to unlimited consumers) | No (each message consumed once; use SNS+SQS for fan-out) |
| **Latency** | `70ms − 200ms` | <10ms (polling latency separate) |
| **Throughput** | Millions of events/sec (with sharding) | Unlimited (Standard), 300-3,000 TPS (FIFO) |
| **Message Size** | Up to 1 MB | Up to 256 KB |
| **Consumer Model** | Pull (consumers poll shards) | Pull (consumers poll queue) |
| **Routing** | Partition key (deterministic sharding) | Random (Standard), Message group ID (FIFO) |

### When to Use Kinesis Data Streams

✅ **Use Kinesis Data Streams when:**
- Need to replay data for reprocessing
- Multiple consumers need same data stream
- Ordering required at high throughput (>300 TPS)
- Real-time analytics, dashboards, monitoring
- Event sourcing patterns
- Log aggregation from distributed systems
- IoT data ingestion
- Clickstream analytics
- Financial transaction streams

**Examples:**
- Clickstream: 100,000 events/sec, multiple consumers (real-time dashboard, ML model, data lake)
- IoT: 1M devices sending sensor data; need to replay for model retraining
- Event sourcing: Append-only log of domain events; rebuild state by replaying

### When to Use SQS

✅ **Use SQS when:**
- Simple point-to-point messaging (one producer, one consumer)
- No need to replay messages
- Lower latency required (<10ms)
- Message processing order unimportant (or low throughput FIFO acceptable)
- Dead letter queue for failed messages
- Decoupling microservices
- Task queues, job processing

**Examples:**
- Order processing: Place order → process order (no need to replay)
- Background jobs: Resize image, send email (one-time tasks)
- Microservices: Service A → Queue → Service B (loose coupling)

### When to Use Kinesis Firehose

✅ **Use Kinesis Firehose when:**
- Need to load streaming data into S3, Redshift, OpenSearch, Splunk
- Don't need custom consumer logic (just delivery)
- Near real-time acceptable (60s+ latency)
- Zero infrastructure management desired
- Built-in transformation sufficient (Lambda)

**Examples:**
- Log aggregation to S3 for long-term storage
- Clickstream to Redshift for analytics
- Application logs to OpenSearch for search/visualization
- Streaming ETL with Lambda transformation

### Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| Need to replay data | Kinesis Data Streams |
| Multiple consumers need same data | Kinesis Data Streams |
| High-throughput ordered delivery (>300 TPS) | Kinesis Data Streams |
| Simple job queue, no replay needed | SQS |
| Low latency (<10ms), simple fanout | SQS + SNS |
| Load data into S3/Redshift/OpenSearch | Kinesis Firehose |
| Custom processing, then delivery | Kinesis Data Streams → Lambda → Firehose |
| Event sourcing, audit log | Kinesis Data Streams (365 day retention) |

### Hybrid Patterns

**Pattern 1: Kinesis → Firehose (Real-Time + Archival)**

```
Producers → [Kinesis Data Streams] → Lambda (real-time processing)
                ↓
            Firehose → S3 (archive)
```

**Benefit:** Real-time processing + automatic S3 archival.

**Pattern 2: Kinesis → SQS (Distribute to Independent Consumers)**

```
Producers → [Kinesis Data Streams] → Lambda (filter/route) → SQS Queues
                                                                 ↓
                                                           Consumer Services
```

**Benefit:** Kinesis provides replay capability; SQS provides independent consumer scaling.

---

## Scaling Patterns

### Data Streams Scaling

**On-Demand Mode (Recommended for Variable Traffic):**

- Auto-scales up to 200 MB/sec write, 400 MB/sec read (default)
- Request limit increase via AWS Support
- Scales down after 15 minutes of reduced traffic
- No manual intervention

**Provisioned Mode:**

**1. Application Auto Scaling (Target Tracking):**

```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "KinesisDataStreamsIncomingBytes"
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

**Configuration:**
- Target: 70% of shard capacity (0.7 MB/sec per shard)
- Scale out: Add shards when exceeds target
- Scale in: Remove shards when below target

**2. Scheduled Scaling:**

```python
# Scale up before daily 9 AM traffic spike
schedule = "cron(0 8 * * ? *)"  # 8 AM UTC
min_capacity = 20  # 20 shards
max_capacity = 50
```

### Firehose Scaling

**Fully Automatic:**
- No configuration required
- Scales to any throughput
- Zero operational overhead

**Buffering Considerations:**

High throughput → reduce buffer size/interval for faster delivery:

```json
{
  "BufferingHints": {
    "SizeInMBs": 64,
    "IntervalInSeconds": 60
  }
}
```

Low throughput → increase buffer for cost efficiency (fewer S3 PUTs):

```json
{
  "BufferingHints": {
    "SizeInMBs": 128,
    "IntervalInSeconds": 900
  }
}
```

---

## Cost Optimization Strategies

### Kinesis Data Streams Pricing (us-east-1, 2025)

**On-Demand Mode:**
- $0.040 per GB ingested
- $0.015 per GB retrieved
- Extended retention (>24h): $0.023 per GB-month

**Provisioned Mode:**
- $0.015 per shard-hour ($10.80/shard/month)
- $0.014 per million PUT requests (>1M/month)
- Extended retention: $0.023 per GB-month

**Enhanced Fan-Out:**
- $0.015 per shard-hour per consumer ($10.80/consumer/month per shard)
- $0.015 per GB retrieved

### Kinesis Firehose Pricing

- $0.029 per GB ingested
- Data format conversion (Parquet, ORC): +$0.018 per GB
- Dynamic partitioning: +$0.0075 per GB
- VPC delivery: +$0.01 per hour per AZ

### 1. Choose Right Capacity Mode

**On-Demand vs Provisioned (Data Streams):**

**Scenario:** 100 GB/day = 4.17 GB/hour = 1.16 MB/sec average

**Peak Traffic:** 5× average = 5.8 MB/sec → need 6 shards provisioned

**On-Demand Cost:**
- Ingestion: 100 GB × $0.040 = $4.00/day = $120/month
- Retrieval (1 consumer): 100 GB × $0.015 = $1.50/day = $45/month
- **Total: $165/month**

**Provisioned Cost (6 shards):**
- Shard hours: 6 shards × $10.80 = $64.80/month
- PUT requests: 100 GB ÷ 25 KB avg size = 4.2M records/day = 126M/month
- PUT cost: 126M × $0.014/M = $1.76/month
- Retrieval: Free (included)
- **Total: $66.56/month**

**Savings: 60% with provisioned mode for predictable traffic**

**When On-Demand Makes Sense:**
- Unpredictable traffic (spikes 10×+ average)
- New workloads (unknown capacity)
- Variable daily patterns

---

### 2. Optimize Retention Period

**Problem:** Extended retention costs $0.023 per GB-month.

**Example:** 100 GB/day, 7-day retention

```
Daily ingestion: 100 GB
Retention: 7 days
Storage: 700 GB average

Cost: 700 GB × $0.023 = $16.10/month
```

**24-hour retention:** $0 (included)

**Optimization:** Use minimum retention required; archive to S3 for long-term storage (cheaper).

**Alternative: Firehose → S3**

```
Kinesis Data Streams (24h retention) → Firehose → S3

S3 cost: 100 GB/day × 30 days = 3 TB/month
S3 Standard: 3 TB × $0.023 = $69/month (includes unlimited retention)
```

**Benefit:** S3 cheaper for long-term storage than Kinesis extended retention.

---

### 3. Batch Records

**Problem:** Each PUT request costs $0.014 per million (after 1M free/month).

**Without Batching:**

```
100 GB/day, 1 KB per record
Records: 100 GB ÷ 1 KB = 100M records/day = 3B records/month
PUT calls: 3B (one per record)
Cost: 3,000M × $0.014 = $42,000/month
```

**With Batching (PutRecords, 500 records per batch):**

```
PUT calls: 3B ÷ 500 = 6M calls/month
Cost: 6M × $0.014 = $84/month

Savings: $41,916/month (99.8% reduction)
```

**Best Practice:** Use `PutRecords` API (batch up to 500 records per call).

---

### 4. Use Firehose for Simple Delivery

**Scenario:** Load logs into S3 (no custom processing needed).

**Data Streams + Lambda + S3:**

```
Data Streams: $120/month (on-demand, 100 GB)
Lambda: 100M invocations = $20/month
S3 PUTs: Depends on batch size

Total: $140+/month
```

**Firehose → S3:**

```
Firehose: 100 GB × $0.029 = $87/month (auto-batches to S3)

Savings: $53/month (38%)
```

**Benefit:** Firehose eliminates Lambda and auto-batches S3 writes.

---

### 5. Compress Data Before Ingestion

**Problem:** Kinesis charges per GB ingested.

**Example:** 100 GB/day uncompressed JSON

**With Gzip Compression (typical 80% reduction):**

```
Compressed size: 20 GB/day
Kinesis cost: 20 GB × $0.040 = $0.80/day = $24/month (vs $120/month)

Savings: $96/month (80%)
```

**Trade-Off:** Consumer must decompress (minimal CPU cost with modern libraries).

---

### 6. Shared vs Enhanced Fan-Out

**Scenario:** 3 consumers, 6 shards, 100 GB/day

**Shared Mode (Default):**

```
Cost: Free (consumers share 2 MB/sec per shard)
Latency: 200ms average (pull model, polling every 1s)
```

**Enhanced Fan-Out:**

```
Cost: 3 consumers × 6 shards × $10.80 = $194.40/month
     + (100 GB × 3 consumers) × $0.015 = $4.50/month
     = $198.90/month

Latency: 70ms average (push model, HTTP/2)

Additional Cost: $198.90/month for lower latency
```

**Use Enhanced Fan-Out Only When:**
- Need <100ms latency
- Have >2 consumers (shared mode throughput split across consumers)
- Read throughput per consumer limited by 2 MB/sec shard limit

---

## Performance Optimization

### Data Streams Throughput Optimization

**1. Optimize Record Size**

**Problem:** 1,000 records/sec shard limit hit before 1 MB/sec limit.

**Without Aggregation:**

```
1 KB per record
Throughput: 1,000 records/sec per shard = 1 MB/sec ✓
Limit: 1,000 records/sec ✗ (hit first)
```

**With Kinesis Producer Library (KPL) Aggregation:**

```
Aggregate 100 records into single 100 KB record
Throughput: 10,000 records/sec per shard (100 records × 100 aggregated)
           = 1 MB/sec (100 KB × 10)
Limit: Neither limit hit

10× throughput improvement
```

**2. Parallel Shard Processing**

**KCL (Kinesis Client Library) automatically parallelizes:**

```
6 shards, 6 consumer instances
Each instance reads 1 shard (default: max 1 instance per shard)

Throughput: 6 shards × 2 MB/sec = 12 MB/sec read
```

**Scaling Consumers:**
- Scale consumer instances to match shard count
- KCL handles shard assignment via DynamoDB coordination table

**3. Enhanced Fan-Out for Low Latency**

**Shared Mode:**
- Consumers poll every 200ms-1s
- Latency: 200ms-1s

**Enhanced Fan-Out:**
- Kinesis pushes records via HTTP/2
- Latency: 70ms average

**Use Case:** Real-time dashboards, fraud detection (latency-sensitive).

### Firehose Throughput Optimization

**1. Adjust Buffer Settings**

**High Throughput Scenario (100 MB/sec):**

```json
{
  "BufferingHints": {
    "SizeInMBs": 128,
    "IntervalInSeconds": 60
  }
}
```

**Benefit:** Larger buffers = fewer S3 PUTs = lower S3 request costs.

**2. Data Format Conversion**

**Convert JSON → Parquet for analytics:**

```
JSON: 100 GB/day
Parquet: 20 GB/day (80% compression)

Firehose conversion cost: 100 GB × $0.018 = $1.80/day
S3 storage savings: 80 GB × $0.023 = $1.84/day (breaks even immediately)

Athena query cost savings: 80% less data scanned
```

**Benefit:** Parquet columnar format 10× faster for Athena queries.

---

## Security Best Practices

### 1. Encryption at Rest

**Data Streams:**
- Server-side encryption with AWS KMS
- Encryption applied to entire stream

**Enable Encryption:**

```bash
aws kinesis start-stream-encryption \
  --stream-name my-stream \
  --encryption-type KMS \
  --key-id arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
```

**Cost:** KMS API requests ($0.03 per 10,000 requests) for encrypt/decrypt operations.

**Firehose:**
- Automatically encrypted in transit and at rest
- Uses AWS-managed keys or customer-managed KMS keys

---

### 2. Encryption in Transit

**All Kinesis services:**
- TLS 1.2+ for all API calls
- Automatic (no configuration required)

---

### 3. IAM Policies

**Principle of Least Privilege:**

**Producer Policy:**

```json
{
  "Effect": "Allow",
  "Action": [
    "kinesis:PutRecord",
    "kinesis:PutRecords"
  ],
  "Resource": "arn:aws:kinesis:us-east-1:123456789012:stream/my-stream"
}
```

**Consumer Policy:**

```json
{
  "Effect": "Allow",
  "Action": [
    "kinesis:GetRecords",
    "kinesis:GetShardIterator",
    "kinesis:DescribeStream",
    "kinesis:ListShards"
  ],
  "Resource": "arn:aws:kinesis:us-east-1:123456789012:stream/my-stream"
}
```

**KCL Consumer (Additional DynamoDB/CloudWatch Permissions):**

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DescribeTable",
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/my-app"
}
```

---

### 4. VPC Endpoints (PrivateLink)

**Keep traffic private (no internet):**

```
Application in VPC → VPC Endpoint → Kinesis (private connection)
```

**Benefit:** Traffic doesn't traverse internet; reduced attack surface.

---

## Observability and Monitoring

### Key CloudWatch Metrics (Data Streams)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `IncomingBytes` | Bytes ingested per stream | Monitor trends; detect anomalies |
| `IncomingRecords` | Records ingested per stream | Compare to expected throughput |
| `WriteProvisionedThroughputExceeded` | Requests throttled due to shard limit | >0 (scale up or optimize partition key) |
| `ReadProvisionedThroughputExceeded` | Consumers throttled (shared mode) | >0 (use enhanced fan-out or reduce polling) |
| `GetRecords.IteratorAgeMilliseconds` | Time lag between ingestion and consumption | >60000 (1 minute) indicates consumer falling behind |
| `PutRecord.Success` | Successful put operations | Monitor for drops |

### Key CloudWatch Metrics (Firehose)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `IncomingBytes` | Bytes ingested | Monitor trends |
| `DeliveryToS3.Success` | Successful S3 deliveries | <100% (investigate failures) |
| `DeliveryToS3.DataFreshness` | Age of oldest record in Firehose | >900 (15 min) indicates backlog |
| `IncomingRecords` | Records ingested | Compare to expected |
| `DataTransformation.Duration` | Lambda transformation time | >30s (optimize Lambda) |

### CloudWatch Alarms

**1. Consumer Lag (Data Streams)**

```
Metric: GetRecords.IteratorAgeMilliseconds
Threshold: >60000 (1 minute lag)
Duration: 5 minutes
Action: Alert on-call; scale consumers or shards
```

**2. Throttling (Data Streams)**

```
Metric: WriteProvisionedThroughputExceeded
Threshold: >100
Duration: 1 minute
Action: Scale up shards or optimize partition key distribution
```

**3. Delivery Failures (Firehose)**

```
Metric: DeliveryToS3.Success
Threshold: <100%
Duration: 5 minutes
Action: Check IAM permissions, S3 bucket policy, Lambda errors
```

### Enhanced Monitoring

**Data Streams:**
- Shard-level metrics (per-shard throughput)
- Enable via `EnableEnhancedMonitoring` API

**Cost:** $0.015 per shard-hour per metric (7 metrics available)

**When to Enable:** Debugging hot shard issues, uneven traffic distribution.

---

## Integration Patterns

### Pattern 1: Kinesis Data Streams → Lambda (Real-Time Processing)

**Use Case:** Process events in real-time (filtering, enrichment, aggregation).

**Architecture:**

```
Producers → [Kinesis Data Streams] → Lambda → DynamoDB/S3/SNS
```

**Lambda Configuration:**
- Batch size: 100-10,000 records (trade-off: latency vs efficiency)
- Batch window: 0-300 seconds (wait to accumulate records)
- Parallelization factor: 1-10 (concurrent executions per shard)

**Example: Clickstream Analytics**

```
Clickstream → Kinesis → Lambda (aggregate clicks per user) → DynamoDB (user profile)
```

---

### Pattern 2: Kinesis Data Streams → Firehose → S3 (Archive)

**Use Case:** Real-time processing + long-term archival.

**Architecture:**

```
Producers → [Kinesis Data Streams] → Lambda (process)
                ↓
            Firehose → S3 (archive)
```

**Benefit:** Lambda processes for real-time insights; Firehose archives for historical analysis.

---

### Pattern 3: Kinesis Firehose → Lambda → S3 (ETL)

**Use Case:** Transform data before storage (format conversion, enrichment).

**Architecture:**

```
Producers → [Firehose] → Lambda (transform) → S3 (Parquet)
```

**Example: Log Processing**

```python
def lambda_handler(event, context):
    output = []
    for record in event['records']:
        # Decode, transform, enrich
        payload = base64.b64decode(record['data'])
        log = json.loads(payload)

        # Add metadata
        log['processed_at'] = datetime.now().isoformat()

        # Re-encode
        output_record = {
            'recordId': record['recordId'],
            'result': 'Ok',
            'data': base64.b64encode(json.dumps(log).encode())
        }
        output.append(output_record)

    return {'records': output}
```

---

### Pattern 4: EventBridge → Kinesis Data Streams

**Use Case:** Route events from EventBridge to Kinesis for replay capability.

**Architecture:**

```
AWS Services → EventBridge → Kinesis Data Streams → Consumers
```

**Benefit:** EventBridge provides content-based routing; Kinesis provides replay and multiple consumers.

---

### Pattern 5: Multi-Region Active-Active (Data Streams)

**Use Case:** Global application with regional processing.

**Architecture:**

```
Region 1: Producers → Kinesis Stream 1 → Consumers
Region 2: Producers → Kinesis Stream 2 → Consumers

Cross-region replication via Lambda or Firehose
```

**Note:** Kinesis Data Streams has no native cross-region replication; implement via Lambda or Firehose.

---

## Common Pitfalls

### Pitfall 1: Hot Shards

**Problem:** Poor partition key choice causes uneven shard utilization; some shards throttled while others idle.

**Example:** Partition key = celebrity user ID; 80% of traffic to 1 shard out of 10.

**Solution:** Add random suffix or use composite key (user ID + timestamp hour).

**Cost Impact:** Wasted capacity (9 idle shards) and throttling (lost data).

---

### Pitfall 2: Consumer Lag Not Monitored

**Problem:** Consumer falling behind; `IteratorAgeMilliseconds` increasing over time.

**Symptom:** Real-time dashboard shows data from 10 minutes ago.

**Solution:** CloudWatch alarm on `IteratorAgeMilliseconds > 60000`; scale consumers or shards.

**Cost Impact:** Stale data reduces business value of real-time processing.

---

### Pitfall 3: Not Using KPL/KCL

**Problem:** Custom producer/consumer code doesn't handle retries, aggregation, checkpointing.

**Solution:** Use Kinesis Producer Library (KPL) for producers and Kinesis Client Library (KCL) for consumers.

**Benefit:**
- KPL: Automatic retry, batching, aggregation (10× throughput)
- KCL: Automatic shard discovery, checkpointing, failover

**Cost Impact:** Development time wasted reinventing built-in functionality.

---

### Pitfall 4: Firehose Buffer Too Large

**Problem:** 900s interval, 128 MB buffer; low throughput means data delayed 15 minutes.

**Example:** 1 MB/hour throughput; 128 MB buffer never fills; data always waits 15 minutes.

**Solution:** Reduce buffer interval to 60s for near real-time delivery.

**Cost Impact:** Delayed insights; defeats purpose of streaming.

---

### Pitfall 5: Not Compressing Data

**Problem:** Sending uncompressed JSON; paying for 5× more data ingestion.

**Solution:** Compress with Gzip before sending to Kinesis.

**Cost Impact:** 80% higher Kinesis costs (for typical JSON compression ratios).

---

### Pitfall 6: Using Data Streams for Simple S3 Delivery

**Problem:** Data Streams + Lambda → S3 when Firehose sufficient.

**Solution:** Use Firehose for simple delivery to S3/Redshift/OpenSearch (no custom processing needed).

**Cost Impact:** 40%+ higher costs vs Firehose; operational overhead of managing Lambda.

---

### Pitfall 7: Retention Too Long Without Archival Strategy

**Problem:** 365-day retention on Data Streams for 100 GB/day = 36.5 TB storage.

**Cost:** 36.5 TB × $0.023 = $839/month (just for retention)

**Solution:** Use 24-hour retention; archive to S3 via Firehose ($69/month for 3 TB).

**Cost Impact:** 92% savings by using S3 for long-term storage.

---

## Key Takeaways

1. **Kinesis Data Streams enables real-time streaming with replay capability.** Ingest millions of events/sec, consumers process in real-time, and replay data up to 365 days for reprocessing.

2. **Kinesis Firehose delivers streaming data to AWS services with zero infrastructure.** Fully managed service with automatic scaling and built-in transformation. It loads data into S3, Redshift, OpenSearch, and Splunk.

3. **Choose Data Streams for custom processing and replay; Firehose for simple delivery.** Data Streams: custom consumers, multiple readers, replay needed. Firehose: delivery to S3/Redshift/OpenSearch without custom code.

4. **Sharding determines throughput, ordering, and parallelism.** Each shard: 1 MB/sec write, 2 MB/sec read. Partition key groups related records into same shard for ordering guarantees.

5. **Partition key choice critical to avoid hot shards.** Use high-cardinality, evenly distributed keys (user ID, device ID, request ID). Avoid low-cardinality keys (log level, page name).

6. **On-demand mode recommended for variable traffic; provisioned for steady workloads.** On-demand auto-scales, while provisioned saves 60%+ for predictable traffic.

7. **Use KPL/KCL for production workloads.** KPL: automatic batching, aggregation, retry (10× throughput). KCL: automatic shard discovery, checkpointing, failover.

8. **Enhanced fan-out provides dedicated throughput per consumer.** Each consumer gets 2 MB/sec per shard (vs shared 2 MB/sec across all consumers). Use for low latency (<100ms) or >2 consumers.

9. **Batch records to reduce PUT request costs.** `PutRecords` API batches up to 500 records per call; saves 99% on request costs vs individual `PutRecord` calls.

10. **Monitor IteratorAgeMilliseconds to detect consumer lag.** Increasing iterator age means consumer falling behind; scale consumers or shards.

11. **Compress data before ingestion to reduce costs 80%.** Gzip compression typical for JSON; pay only for compressed size.

12. **Use Firehose for S3/Redshift delivery to save 40% vs Data Streams + Lambda.** Firehose auto-batches S3 writes; eliminates Lambda costs and operational overhead.

13. **Data Streams supports multiple consumers; SQS supports single consumer.** Use Data Streams for fan-out to multiple applications reading same stream. Use SQS for point-to-point messaging.

14. **Firehose buffer configuration trades latency vs cost.** Smaller buffer/interval = faster delivery, more S3 PUTs. Larger buffer = delayed delivery, fewer S3 PUTs (lower cost).

15. **Kinesis provides ordering guarantees per partition key; SQS FIFO limited to 300 TPS.** Use Kinesis for high-throughput ordered delivery (millions/sec). Use SQS FIFO for low-throughput strict ordering (<300 TPS).

**AWS Kinesis is the strategic service for real-time streaming on AWS, providing millisecond latency, replay capability, and multiple consumer fan-out that batch processing and message queues cannot. Choose Data Streams for custom real-time processing and Firehose for zero-infrastructure delivery to AWS data stores.**
