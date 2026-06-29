---
title: "AWS Redshift for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "Comprehensive guide to AWS Redshift covering Serverless vs provisioned clusters, RA3 node types, distribution and sort keys, Redshift Spectrum, cost optimization, and data warehousing best practices"
tags: [aws, redshift, data-warehousing, analytics, sql, cost-optimization, fundamentals]
---

## What Is Amazon Redshift?

Amazon Redshift is a fully managed, petabyte-scale data warehouse service that uses SQL to analyze structured and semi-structured data. Redshift uses massively parallel processing (MPP) and columnar storage to deliver fast query performance on large datasets.

**What Problems Redshift Solves**:
- **Analytical query performance**: Traditional databases struggle with complex analytical queries; Redshift handles petabyte-scale analytics with sub-second latency
- **Data warehouse cost**: On-premises data warehouses are expensive to scale; Redshift offers pay-as-you-go pricing starting at $0.25/hour
- **Data lake integration**: Querying S3 data lakes requires complex ETL; Redshift Spectrum queries S3 directly without loading
- **Scalability bottlenecks**: Vertical scaling limits constrain growth; Redshift scales horizontally to petabytes
- **Operational overhead**: Managing data warehouse infrastructure is complex; Redshift is fully managed with automated backups, patching, and scaling

**When to use Redshift**:
- You need a data warehouse for OLAP (Online Analytical Processing) workloads
- You have large datasets (>100 GB) requiring complex analytical queries
- You want to query data in S3 without ETL (Redshift Spectrum)
- You need BI tool integration (Tableau, PowerBI, Looker, QuickSight)
- You require sub-second query performance on aggregations and joins

## Redshift Serverless vs Provisioned Clusters

Redshift offers two deployment models with distinct cost and operational characteristics.

### Redshift Serverless

Zero-configuration data warehouse that auto-scales compute capacity.

**How It Works**:
- Capacity measured in Redshift Processing Units (RPUs)
- Minimum 8 RPUs (base capacity), scales automatically based on workload
- Per-second billing (60-second minimum)
- No cluster management required

**Pricing (us-east-1, 2024)**:
- **$0.375/RPU-hour** (minimum 8 RPUs = $3/hour when active)
- Storage: $0.024/GB/month (Redshift Managed Storage)
- **Free credits**: None (pay only when queries run)
- **Serverless Reservations**: Up to 24% discount for 1-year or 3-year commitments

**Cost Example**:
- 8 RPUs base capacity running 2 hours/day × 30 days = 60 hours
- Compute: 60 hours × 8 RPUs × $0.375 = $180/month
- Storage: 500 GB × $0.024 = $12/month
- **Total**: $192/month

**When to Use Serverless**:
- Unpredictable or spiky workloads (ad-hoc analytics, BI dashboards)
- Development and testing environments
- Infrequent usage (<8 hours/day)
- Workloads with idle periods (no charges when not querying)
- Teams wanting zero operational overhead

<div class="callout callout--tip">
<p class="callout__title">Serverless Savings</p>
<p>40-65% cost reduction vs provisioned for variable workloads (AWS customer reports). No charges when not querying.</p>
</div>

### Provisioned Clusters

Node-based clusters with configurable instance types and node counts.

**Architecture**:
- **Leader node**: Receives queries, develops query plans, distributes work
- **Compute nodes**: Store data and execute queries in parallel (2-128 nodes)
- **RA3 nodes**: Separate compute and storage (recommended)

**Pricing (us-east-1, 2024)**:
- **ra3.xlplus**: $1.235/hour (4 vCPUs, 32 GB memory)
- **ra3.4xlarge**: $3.26/hour (12 vCPUs, 96 GB memory)
- **ra3.16xlarge**: $13.04/hour (48 vCPUs, 384 GB memory)
- **Storage (RA3)**: $0.024/GB/month (Redshift Managed Storage, separate from compute)
- **Reserved Instances**: Up to 64% discount (3-year commitment)

**Cost Example** (2-node ra3.4xlarge cluster):
- Compute: 2 nodes × $3.26/hour × 730 hours = $4,760/month
- Storage: 500 GB × $0.024 = $12/month
- **Total**: $4,772/month
- **Reserved (3-year)**: $1,718/month (64% savings)

**When to Use Provisioned**:
- Predictable, steady workloads (>8 hours/day)
- Cost optimization with Reserved Instances
- Performance-sensitive applications requiring dedicated resources
- Workloads requiring specific node configurations

**Breakeven Analysis**:
- Serverless at 8 RPUs: $3/hour active time
- Provisioned ra3.4xlarge (2 nodes): $6.52/hour (always running)
- **Breakeven**: Serverless is cheaper if active <50% of the time (12 hours/day)

### Decision Framework: Serverless vs Provisioned

| Dimension | Serverless | Provisioned |
|-----------|------------|-------------|
| **Cost Model** | Pay-per-use (RPU-hours) | Pay for provisioned capacity (always running) |
| **Best For** | Variable workloads | Steady, predictable workloads |
| **Cost Savings** | Cheaper for <50% utilization | Cheaper for >50% utilization + Reserved Instances |
| **Setup** | Zero configuration | Manual cluster sizing |
| **Scaling** | Automatic (seconds) | Manual (add/remove nodes) |
| **Performance** | Auto-tuned | Configurable (node type, count) |
| **Use Case** | Ad-hoc queries, dev/test, BI dashboards | Production analytics, 24/7 workloads |

## RA3 Node Types and Architecture

RA3 nodes (recommended for new clusters) separate compute and storage for independent scaling.

### RA3 Instance Types

| Node Type | vCPUs | Memory | Local Storage | Price/Hour (us-east-1) | Use Case |
|-----------|-------|--------|---------------|------------------------|----------|
| **ra3.xlplus** | 4 | 32 GB | Managed Storage | $1.235 | Small-medium workloads |
| **ra3.4xlarge** | 12 | 96 GB | Managed Storage | $3.26 | General production |
| **ra3.16xlarge** | 48 | 384 GB | Managed Storage | $13.04 | Large analytical workloads |

**Managed Storage** (separate pricing):
- $0.024/GB/month
- Automatically scales from 0 GB to 8 PB per cluster
- Pay only for data stored (not reserved capacity)
- Backed by Amazon S3 (99.999999999% durability)

### Why RA3 vs Legacy Node Types

**RA3 Advantages**:
- **Independent scaling**: Scale compute (add nodes) and storage (automatic) separately
- **Cost efficiency**: Pay only for storage used, not reserved capacity
- **Performance**: Enhanced I/O and network performance
- **Flexibility**: Upgrade compute without data migration

**Legacy Node Types** (DC2, DS2):
- Tightly coupled compute and storage
- Storage capacity limited by node type
- Cannot scale storage without changing node type (requires data migration)
- Being phased out (AWS recommends RA3 for new clusters)

### Cluster Sizing Guidance

**Small Cluster** (ra3.xlplus):
- 2 nodes: 8 vCPUs, 64 GB memory
- Use case: Dev/test, small analytical workloads (<1 TB)
- Cost: $1,810/month (on-demand) or $652/month (3-year reserved)

**Medium Cluster** (ra3.4xlarge):
- 2-4 nodes: 24-48 vCPUs, 192-384 GB memory
- Use case: Production analytics, BI dashboards (1-10 TB)
- Cost: $4,760-$9,520/month (on-demand) or $1,718-$3,436/month (3-year reserved)

**Large Cluster** (ra3.16xlarge):
- 2-16 nodes: 96-768 vCPUs, 768-6,144 GB memory
- Use case: Enterprise data warehousing, petabyte-scale analytics
- Cost: $19,083-$152,666/month (on-demand)

## Distribution Keys and Sort Keys

Redshift's performance depends on how data is distributed across nodes and how it's sorted within nodes.

### Distribution Keys (DISTKEY)

Distribution keys determine how rows are distributed across compute nodes.

**Three Distribution Styles**:

1. **KEY Distribution**:
   - Rows with same distribution key value stored on same node
   - **Use when**: Joining large tables on the same key (co-locates data, avoids network shuffling)
   - **Example**: Distribute `orders` and `order_items` by `order_id`

2. **EVEN Distribution** (default):
   - Rows distributed in round-robin fashion across all nodes
   - **Use when**: Table not frequently joined or no single join key
   - **Example**: Staging tables, tables with many different join patterns

3. **ALL Distribution**:
   - Full copy of table on every node
   - **Use when**: Small dimension tables (<1M rows) frequently joined with fact tables
   - **Example**: `product_categories`, `countries`, lookup tables

**Performance Impact**:
- Correct distribution key: Avoids data shuffling during joins (10-100x faster)
- Incorrect distribution key: Requires network shuffling (kills performance)

**Best Practices**:
- Choose distribution key based on most frequent join columns
- Avoid columns with few unique values (creates data skew)
- Monitor data skew: `SELECT slice, COUNT(*) FROM table GROUP BY slice` (ideally even distribution)

### Sort Keys (SORTKEY)

Sort keys define the physical order of data stored on disk.

**Two Sort Key Types**:

1. **Compound Sort Key** (default):
   - Sorts by first column, then second, then third (like phone book: last name, first name)
   - **Use when**: Queries filter on prefix of sort key columns
   - **Example**: SORTKEY(date, region, product_id) — efficient for queries filtering on date, date+region, or date+region+product_id

2. **Interleaved Sort Key**:
   - Gives equal weight to all columns in sort key
   - **Use when**: Queries filter on different columns in different queries
   - **Trade-off**: Slower writes (more overhead maintaining interleaved sort), not recommended unless queries have highly variable filters

**AUTO SORTKEY** (recommended):
- Redshift automatically chooses sort key based on query patterns
- Continuously optimizes as workload changes
- Eliminates guesswork

**Performance Impact**:
- Correct sort key: Query scans only relevant blocks (zone maps), 10-1000x faster
- Example: 1 TB table sorted by date, query filters last 7 days → scans <1% of blocks

**Best Practices**:
- Choose sort key columns frequently used in WHERE, JOIN, or ORDER BY clauses
- Use timestamps or dates as first sort key column (time-series data)
- Use AUTO SORTKEY unless you have specific requirements

## Redshift Spectrum

Redshift Spectrum queries data in Amazon S3 without loading it into Redshift.

**How It Works**:
- Redshift cluster delegates S3 scanning to Spectrum compute layer
- Spectrum layer scales independently (thousands of nodes)
- Results returned to Redshift for final processing (joins, aggregations)

**Use Cases**:
- **Data lake queries**: Query petabytes in S3 without ETL
- **Historical data**: Keep infrequently accessed data in S3 (cheaper storage)
- **Mixed queries**: Join Redshift tables with S3 data in single query

**Pricing**:
- **$5 per TB scanned** in S3 (us-east-1)
- No additional cluster costs (uses existing Redshift cluster)

**Performance Optimization**:

1. **Use Parquet format**:
   - Columnar format: Only scans queried columns
   - 92% faster than JSON, 90% cheaper (less data scanned)
   - Example: 1 TB JSON → $5, 1 TB Parquet (10% of columns queried) → $0.50

2. **Partition data**:
   - Partition by time (year/month/day) or region
   - Partition pruning skips irrelevant partitions
   - Example: Query last 7 days → scans 7 partitions instead of 365

3. **Optimize file sizes**:
   - Target 64 MB - 1 GB per file (compressed)
   - Multiple files enable parallel processing
   - Avoid small files (<1 MB) — increases overhead

4. **Compress data**:
   - GZIP, Snappy, or LZO compression
   - Reduces data scanned (lower costs)

**Cost Example**:
- 10 TB S3 data lake (Parquet, partitioned by date)
- Query filters last 30 days (330 GB) and 5 columns (50 GB actual scan)
- **Cost**: 0.05 TB × $5 = $0.25/query

**vs Loading into Redshift**:
- Spectrum: Query without loading, $5/TB scanned
- COPY into Redshift: $0.024/GB/month storage + COPY time + storage capacity

**When to Use Spectrum**:
- Data queried infrequently (<once per month)
- Exploratory analysis on raw data
- Data lake already in S3
- Avoid storage costs in Redshift

**When to Load into Redshift**:
- Data queried frequently (>once per day)
- Complex joins and aggregations
- Sub-second query latency required

## Data Loading Best Practices

### COPY Command

The COPY command is the most efficient way to load data into Redshift.

**Supported Sources**:
- Amazon S3 (CSV, JSON, Parquet, Avro, ORC)
- Amazon DynamoDB
- Amazon EMR
- Remote host (SSH)

**Best Practices**:

1. **Split data into multiple files**:
   - Target 1 MB - 1 GB per file (compressed)
   - Number of files = multiple of cluster slice count
   - Example: 16-slice cluster → 16, 32, or 64 files (evenly distributed)

2. **Compress data**:
   - GZIP or LZOP compression
   - Reduces I/O, faster loading
   - Redshift auto-detects compression

3. **Load in sort key order**:
   - Pre-sort data by sort key before loading
   - Avoids VACUUM operation (saves time)
   - Example: Sort by timestamp before loading time-series data

4. **Use STATUPDATE OFF for large loads**:
   - Skips automatic statistics update during COPY
   - Run manual ANALYZE after all loads complete
   - 20-50% faster bulk loads

5. **Parallel loading**:
   - Use manifest file to load multiple files in parallel
   - Leverage Redshift's MPP architecture
   - Example: 64 files loaded in parallel across 16 slices

**COPY Performance**:
- 1 TB compressed data: 10-30 minutes (depending on cluster size)
- Scales linearly with cluster size

### VACUUM and ANALYZE

**VACUUM**:
- Reclaims space from deleted rows
- Re-sorts rows based on sort key
- **When to run**: After large deletes or updates
- **Automatic**: Redshift auto-vacuums in background (usually sufficient)

**ANALYZE**:
- Updates table statistics for query planner
- **When to run**: After bulk loads or significant data changes
- **Automatic**: Redshift auto-analyzes, but manual ANALYZE recommended after large loads

## Concurrency Scaling

Automatically adds compute capacity during peak query loads.

**How It Works**:
- Queues enabled for concurrency scaling route queries to additional clusters
- Clusters added in seconds, removed when load decreases
- Users experience consistent performance (no queuing delays)

**Pricing**:
- **1 hour free credits per day** (sufficient for 97% of customers)
- After free credits: $6.52/hour per concurrency scaling cluster (us-east-1, based on ra3.4xlarge pricing)

**When to Use**:
- Unpredictable query spikes (end-of-month reports, ad-hoc analysis)
- Peak business hours with higher concurrency
- Mixed workloads (batch ETL + interactive BI)

**Configuration**:
- Enable in Workload Management (WLM) queues
- Set max_concurrency_scaling_clusters limit (prevent runaway costs)

## Materialized Views

Pre-computed query results for faster repeated queries.

**How It Works**:
- Materialized view stores query result as table
- Queries against materialized view return instantly (no re-computation)
- Refreshed manually or automatically

**Auto-Refresh** (2024 feature):
- Redshift auto-refreshes based on base table changes
- Incremental refresh: Only updates changed data (faster than full refresh)
- Prioritizes user queries over refresh (no performance impact)

**Use Cases**:
- Dashboard queries (same query runs repeatedly)
- Complex aggregations (SUM, AVG, COUNT over large tables)
- Join-heavy queries (pre-join tables in materialized view)

**Performance**:
- 10-100x faster queries (pre-computed vs re-executing)
- Example: Complex join + aggregation (30 seconds) → materialized view (<1 second)

**Best Practices**:
- Partition base tables to speed up incremental refresh
- Monitor refresh frequency (balance freshness vs cost)
- Use AUTO REFRESH for frequently changing data

## Cost Optimization

### Reserved Instances

Purchase 1-year or 3-year capacity reservations for predictable workloads.

**Savings**:
- **1-year no upfront**: 20-25% discount
- **1-year partial upfront**: 35-40% discount
- **3-year all upfront**: 60-64% discount

**Example** (2-node ra3.4xlarge cluster):
- On-demand: $4,760/month
- Reserved (3-year all upfront): $1,718/month
- **Savings**: $3,042/month (64%)

**When to Use**: Stable baseline capacity running >50% of the time.

### Pause and Resume

Pause provisioned clusters when not in use (Serverless does this automatically).

**Use Cases**:
- Development and testing environments (pause overnight, weekends)
- Non-production workloads with idle periods

**Cost Savings**:
- Paused cluster: Pay only for storage ($0.024/GB/month)
- Example: 2-node ra3.4xlarge cluster (500 GB), paused 50% of time
  - Compute savings: $2,380/month
  - Storage cost: $12/month
  - **Total savings**: $2,368/month (50%)

### Right-Sizing Clusters

Monitor utilization and resize clusters to match workload.

**Metrics to Monitor**:
- **CPUUtilization**: Target 50-70% (scale up if sustained >80%, scale down if <30%)
- **Query throughput**: Queries per hour
- **Disk space used**: Percentage of managed storage

**Elastic Resize**:
- Add/remove nodes in minutes (not hours)
- No downtime for reads during resize

**Example**:
- 4-node ra3.4xlarge cluster at 30% CPU utilization
- Downsize to 2-node cluster
- **Savings**: $4,760/month (50%)

### Serverless for Variable Workloads

Switch from provisioned to Serverless for workloads with idle periods.

**Cost Comparison** (usage: 4 hours/day, 20 days/month = 80 hours/month):
- **Provisioned** (2-node ra3.4xlarge): $4,760/month (always running)
- **Serverless** (8 RPUs): 80 hours × 8 RPUs × $0.375 = $240/month
- **Savings**: $4,520/month (95%)

## Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **1. Wrong distribution key** | 10-100x slower queries (data shuffling) | Distribute by most frequent join columns; monitor data skew |
| **2. No sort key** | Full table scans, 10-1000x slower | Use AUTO SORTKEY or manually choose timestamp/frequently filtered columns |
| **3. Loading with INSERT** | 100x slower than COPY | Always use COPY for bulk loads (parallel, compressed) |
| **4. Not compressing data** | Higher storage costs, slower queries | Use GZIP/LZO compression for S3 files |
| **5. Using Spectrum on Parquet** | 10x higher costs | Use Parquet format (90% cost reduction vs JSON) |
| **6. Not partitioning Spectrum data** | Scanning entire dataset | Partition by date/region (only scan relevant partitions) |
| **7. Provisioned cluster always running** | Paying for idle time | Pause clusters or use Serverless for variable workloads |
| **8. Not using Reserved Instances** | 64% higher costs | Purchase Reserved Instances for stable workloads |
| **9. Small files in S3** | Slow Spectrum queries | Combine into `64 MB−1 GB` files |
| **10. Skipping VACUUM/ANALYZE** | Degraded query performance | Run VACUUM after large deletes, ANALYZE after bulk loads |
| **11. ALL distribution for large tables** | Wastes storage (copied to every node) | Use ALL only for small dimension tables (<1M rows) |
| **12. Not monitoring query performance** | Unoptimized queries waste resources | Use Query Monitoring Rules (QMR) and System Tables (STL, STV) |
| **13. Interleaved sort keys** | Slow writes, complex maintenance | Use compound sort keys or AUTO SORTKEY |
| **14. Overloading single WLM queue** | Query queuing, slow performance | Configure multiple WLM queues for different workload types |
| **15. Not using concurrency scaling** | Query queuing during peaks | Enable concurrency scaling (1 free hour/day) |

**Cost Impact Examples**:
- **Pitfall #7** (always-on cluster): 2-node ra3.4xlarge paused 50% = **$2,368/month savings**
- **Pitfall #8** (no Reserved Instances): 3-year reserved = **$3,042/month savings (64%)**
- **Pitfall #5** (JSON vs Parquet): 10 TB Spectrum queries = **$45/month savings (90%)**

## When to Use Redshift vs Other AWS Databases

| Dimension | Redshift | RDS/Aurora | DynamoDB | Athena |
|-----------|----------|------------|----------|--------|
| **Workload** | OLAP (analytical) | OLTP (transactional) | NoSQL key-value | Ad-hoc S3 queries |
| **Query Type** | Complex aggregations, joins | Simple CRUD operations | Key-based lookups | SQL on S3 data lake |
| **Data Size** | Petabytes | Gigabytes to terabytes | Unlimited | Petabytes (S3) |
| **Latency** | Sub-second (analytical) | Milliseconds (transactional) | Single-digit milliseconds | Seconds to minutes |
| **Cost** | $0.25/hour to $13/hour per node | $0.12-$0.50/hour per instance | $0.25 per million reads | $5 per TB scanned |
| **Use Case** | Data warehouse, BI, analytics | Web apps, APIs, transactions | Session storage, IoT, gaming | One-time S3 queries |

**Decision Framework**:
- **Redshift**: Analytical workloads, BI dashboards, data warehousing (OLAP)
- **RDS/Aurora**: Transactional workloads, web applications (OLTP)
- **DynamoDB**: High-scale key-value access, sub-millisecond latency
- **Athena**: Ad-hoc S3 queries without infrastructure (serverless SQL)

## Key Takeaways

**Deployment Options**:
- **Serverless**: Zero management, pay-per-use, ideal for variable workloads (<50% utilization), 40-65% cost savings
- **Provisioned**: Reserved Instances for stable workloads (>50% utilization), 64% savings with 3-year commitment
- **Breakeven**: Serverless cheaper if active <12 hours/day

**RA3 Node Types**:
- **ra3.xlplus**: $1.235/hour, small-medium workloads
- **ra3.4xlarge**: $3.26/hour, general production (most common)
- **ra3.16xlarge**: $13.04/hour, large analytical workloads
- **Managed Storage**: $0.024/GB/month, scales independently (0-8 PB)

**Distribution and Sort Keys**:
- Distribution key: Co-locate data for joins (avoid network shuffling)
- Sort key: Physical ordering on disk (10-1000x faster queries with zone maps)
- Use AUTO SORTKEY for automatic optimization

**Redshift Spectrum**:
- Query S3 data without loading ($5/TB scanned)
- Use Parquet format (90% cost savings vs JSON)
- Partition data for query pruning (only scan relevant partitions)
- Cheaper for infrequently accessed data (<once per month)

**Data Loading**:
- Use COPY command (100x faster than INSERT)
- Split into 1 MB - 1 GB files, compress with GZIP
- Load in sort key order (avoid VACUUM)

**Cost Optimization**:
- Reserved Instances: 64% savings (3-year)
- Pause clusters: 50% savings for dev/test
- Serverless for variable workloads: 95% savings vs always-on provisioned
- Right-size clusters: Monitor CPU utilization (target 50-70%)

**Performance**:
- Concurrency scaling: 1 free hour/day
- Materialized views: 10-100x faster repeated queries
- Auto-refresh: Incremental updates (2024 feature)
- Monitor query performance with System Tables (STL, STV)
