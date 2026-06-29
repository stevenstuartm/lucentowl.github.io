---
title: "Azure Synapse Analytics for System Architects"
layout: guide
category: Azure
subcategory: Database Services
description: "Architecture patterns, pool types, and workload management for Azure Synapse Analytics, including dedicated SQL pools, Spark pools, and data warehouse design considerations."
tags: [azure, databases, analytics, scalability, performance, cloud-computing, fundamentals]
---

## What Is Azure Synapse Analytics

[Azure Synapse Analytics](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is){:target="_blank" rel="noopener noreferrer"} is Microsoft's answer to distributed analytics platforms. Unlike single-purpose database systems, Synapse integrates multiple computation engines and storage layers into one workspace, allowing data engineers to conduct exploratory analysis, load data at scale, and run complex queries on massive datasets.

The platform combines three core components: dedicated SQL pools (formerly Azure SQL Data Warehouse) for traditional MPP data warehousing, Apache Spark pools for distributed data processing and machine learning, and built-in data integration through pipelines and linked services. This convergence of technologies eliminates the need to stitch together separate services.

### What Problems Synapse Solves

**Without Synapse (separate services):**
- Multiple services to manage (data warehouse, Spark cluster, data factory, storage accounts)
- Complex authentication and authorization across services
- Difficult data movement between analytics engines
- Separate performance tuning requirements per service
- Higher operational complexity and cost

**With Synapse:**
- Single workspace integrating SQL, Spark, and integration capabilities
- Unified authentication through workspace identity
- Direct data access between engines (minimal movement)
- Unified performance tuning through workload management
- Simplified operations and cost optimization

### How Synapse Differs from AWS Redshift

Architects familiar with AWS should understand these key differences:

| Aspect | AWS Redshift | Azure Synapse |
|--------|-------------|--------------|
| **Architecture** | Single MPP cluster (all nodes same type) | Flexible pools: dedicated SQL, Spark, Data Explorer |
| **Scaling** | Resize cluster (downtime or Redshift RA3 with managed storage) | Scale DWUs independently; Spark auto-scales |
| **Storage** | Attached SSD for dc2/ra3; object storage for Spectrum | Separate (Data Lake Storage Gen2) with compute pools |
| **Compute engines** | SQL only (Spark requires separate EMR) | SQL + Spark + Data Explorer in one workspace |
| **Data integration** | AWS Glue, Lambda, or custom ETL | Synapse Pipelines (Azure Data Factory) built-in |
| **Authentication** | IAM roles | Entra ID + RBAC + SQL authentication (legacy) |
| **Cost model** | Per-node-hour | DWU-hour (SQL) + Spark cluster-hour |
| **PolyBase** | Redshift Spectrum (limited to S3/DynamoDB/RDS) | PolyBase (S3-compatible, SQL Server, Delta Lake, Parquet) |
| **Query optimization** | Automatic query optimization | Workload management + result set caching + materialized views |

---

## Dedicated SQL Pools (MPP Data Warehouse)

### What Dedicated SQL Pools Are

[Dedicated SQL pools](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/sql-data-warehouse-overview-what-is){:target="_blank" rel="noopener noreferrer"} are the core data warehousing engine in Synapse. They implement massive parallel processing (MPP), distributing data across multiple nodes and executing queries in parallel.

**Key Characteristics:**
- MPP architecture with 60 nodes maximum per pool
- Data Distribution Units (DWUs) as the capacity metric (100 to 30,000 DWUs)
- Reserved compute (you pay for capacity whether used or not)
- Scales in 100-DWU increments
- Pause/resume capability to reduce costs when not in use
- Built-in redundancy and backup

### Data Warehouse Units (DWUs)

DWUs represent compute capacity and are the primary scaling metric. A DWU encompasses CPU, memory, and I/O bundled together.

**DWU scaling tiers:**

| DWU Level | Compute Nodes | vCores per Node | Memory per Node | Use Case |
|-----------|---------------|-----------------|-----------------|----------|
| DW100c | 2 | 4 | 32 GB | Development, testing, small workloads |
| DW500c | 5 | 4 | 32 GB | Small production workloads |
| DW1000c | 10 | 4 | 32 GB | Medium workloads with standard concurrency |
| DW2000c | 20 | 4 | 32 GB | Medium-large workloads |
| DW5000c | 50 | 4 | 32 GB | Large workloads with high concurrency |
| DW10000c | 100 | 4 | 32 GB | Very large workloads |
| DW30000c | 300 | 4 | 32 GB | Extreme scale (enterprise workloads) |

**Scaling rules of thumb:**
- Start with DW500c or DW1000c for initial workloads
- Scale up by 2x when query performance degrades
- Scale down when sustained CPU utilization is below 20%
- Each DWU increase doubles the compute and storage IOPS capacity
- Scaling takes 10-15 minutes and causes connections to drop briefly

<div class="callout callout--tip">
<p class="callout__title">DWU vs Gen2 Generations</p>
<p>Synapse only supports Gen2 (newest architecture). Gen1 is deprecated. Gen2 provides significantly better query performance and is the only option for new pools. Do not consider Gen1 for new designs.</p>
</div>

### Distribution Strategies

Data in a dedicated SQL pool is distributed across nodes according to a distribution key. This key determines which rows reside on which nodes and critically affects query performance.

**Three distribution types:**

**1. Hash Distribution (most common)**
- Rows are distributed based on a hash of the distribution column
- Distributes data evenly across nodes when the column has high cardinality
- Best for: Fact tables and columns that are frequently joined
- Avoid: Boolean columns, date columns with sparse values, or columns with skewed distributions

Example:
```sql
CREATE TABLE Orders (
    OrderID INT,
    CustomerID INT,
    Amount DECIMAL,
    OrderDate DATE
)
WITH (
    DISTRIBUTION = HASH(CustomerID)
);
```

For a query joining Orders to Customers on CustomerID, both tables should be hash-distributed on CustomerID. This collocates the join data on the same nodes, eliminating network shuffles.

**2. Round-Robin Distribution (default)**
- Rows are distributed sequentially across nodes in round-robin fashion
- Provides even distribution regardless of data patterns
- Best for: Staging tables, temporary work tables, or tables without obvious join columns
- Avoid: Tables that are frequently joined on specific columns (causes shuffle)

When you create a table without specifying distribution, Synapse defaults to round-robin.

**3. Replicated Distribution (smallest tables only)**
- The entire table is replicated to every node
- Eliminates shuffle when the table is joined on any column
- Best for: Small reference/dimension tables (< 2 GB recommended)
- Storage overhead: Replicated table occupies (number of nodes) × (table size) storage

Use case: A Customers table (100 MB) replicated across 10 nodes occupies 1 GB total.

**Distribution design pattern:**
1. Identify your largest fact table
2. Hash-distribute on the primary join column
3. Hash-distribute other large tables on compatible join columns
4. Replicate small dimension tables
5. Use round-robin for staging/temporary tables

### Workload Management

Workload management controls resource allocation across concurrent queries, preventing one user or query from monopolizing the pool.

**Resource Classes (legacy approach, still used):**

Resource classes allocate memory and concurrency slots:

| Resource Class | Memory per Distribution | Max Concurrency | Use Case |
|----------------|------------------------|-----------------|----------|
| smallrc | 100 MB | 128 | Lightweight queries, reports |
| mediumrc | 400 MB | 32 | Standard analytical queries |
| largerc | 1.6 GB | 8 | Complex queries, index builds |
| xlargerc | 6.4 GB | 4 | Very large data processing jobs |
| staticrc10 | 10% of pool memory | 128 | Admin tasks, system operations |
| staticrc20 | 20% of pool memory | 64 | Heavy analytical workloads |

**Workload Groups (newer, recommended):**

Workload groups provide finer-grained control through classification and resource allocation policies:

```sql
CREATE WORKLOAD GROUP AnalyticsGroup
WITH (
    MIN_PERCENTAGE_RESOURCE = 20,
    CAP_PERCENTAGE_RESOURCE = 50,
    REQUEST_MIN_RESOURCE_GRANT_PERCENT = 1.0
);
```

This defines a workload group that guarantees 20% of pool resources, caps usage at 50%, and allocates minimum 1% per request.

**Best practice:** Use workload groups for production workloads. Resource classes are simpler but less flexible. Most organizations blend both approaches: resource classes for interactive queries, workload groups for batch jobs.

### Performance Optimization Techniques

**1. Materialized Views**

Materialized views pre-aggregate and cache query results, reducing computation for repeated queries.

```sql
CREATE MATERIALIZED VIEW DailySalesSummary AS
SELECT
    OrderDate,
    ProductID,
    SUM(Amount) as DailyTotal,
    COUNT(*) as OrderCount
FROM Orders
GROUP BY OrderDate, ProductID;
```

Queries referencing the underlying tables may automatically use the materialized view if the result matches. This is called automatic query rewrite and does not require changing application code.

**When to use:** High-cost aggregations that are queried repeatedly (dashboards, reports). Maintenance occurs through manual refresh (incremental refresh is not available in Synapse dedicated SQL pools).

**2. Result Set Caching**

Result set caching automatically caches query results at the pool level, serving identical queries from cache without recomputation.

```sql
SELECT * FROM Orders WHERE OrderDate = '2025-01-15'
OPTION (RESULT_CACHE = ON);
```

Cache is invalidated when underlying tables are modified. This is particularly effective for dashboards where the same queries run repeatedly within short time windows.

**Trade-off:** Cache takes pool memory. For very large result sets, the overhead may not be worth it.

**3. Table Design**

- Use clustered columnstore indexes (the default). They compress data by 10x on average
- Partition large tables by date or region to enable partition elimination
- Keep tables in columnar format; avoid heaps
- Use appropriate data types (BIGINT when INT suffices wastes storage)

### PolyBase for External Data

[PolyBase](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/polybase-overview){:target="_blank" rel="noopener noreferrer"} allows queries against external data sources without loading data into the pool. You define external tables pointing to data in Azure Data Lake Storage, Azure Blob Storage, SQL Server, or other sources.

```sql
CREATE EXTERNAL DATA SOURCE AzureLake
WITH (
    TYPE = HADOOP,
    LOCATION = 'abfss://data@datalake.dfs.core.windows.net',
    CREDENTIAL = WorkspaceIdentity
);

CREATE EXTERNAL TABLE ExternalOrders (
    OrderID INT,
    CustomerID INT,
    Amount DECIMAL
)
WITH (
    LOCATION = '/orders/2025/',
    DATA_SOURCE = AzureLake,
    FILE_FORMAT = ParquetFormat
);

SELECT * FROM ExternalOrders WHERE Amount > 1000;
```

Queries push filters to the external source when possible, reducing data movement.

**When to use PolyBase:**
- Exploratory queries on data lake data before loading to the warehouse
- Real-time access to frequently changing external data
- Archiving historical data to cheaper storage while maintaining queryability
- Joining external and warehouse data

**Trade-off:** External queries are slower than internal table queries (network latency, no local optimization). Use for ad-hoc queries or infrequent access patterns.

### COPY Command

The [COPY statement](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/copy-statement){:target="_blank" rel="noopener noreferrer"} is the modern way to load data into Synapse SQL pools. It replaces the older BULK INSERT and is simpler than PolyBase for data ingestion.

```sql
COPY INTO Orders
FROM 'https://datalake.blob.core.windows.net/data/orders.parquet'
WITH (
    CREDENTIAL = (IDENTITY = 'Shared Access Signature', SECRET = 'SAS_TOKEN'),
    FILE_FORMAT = 'ParquetFormat'
);
```

COPY is faster than INSERT SELECT and handles various formats (CSV, Parquet, ORC, JSON).

**When to use:** Loading raw data from data lakes or external storage during ETL processes. Use COPY as your default ingestion method.

---

## Synapse Workspace and Studio

### Workspace Architecture

A Synapse workspace is the container for all analytics resources: dedicated SQL pools, Spark pools, pipelines, notebooks, and configurations.

**Workspace components:**
- **Dedicated SQL pools:** Data warehouse compute engines
- **Spark pools:** Apache Spark clusters for big data processing
- **Data Explorer pools:** Kusto Query Language (KQL) for log and telemetry analytics
- **Synapse Pipelines:** ETL orchestration (Azure Data Factory)
- **Linked Services:** Connections to external data sources
- **Integration Runtimes:** Compute engines for pipelines and Spark

**Workspace-level settings:**
- Managed VNet: Optional network isolation for workspace resources
- Storage account: Primary data lake (Data Lake Storage Gen2)
- SQL Server firewall: Controls client access to SQL pools
- Authentication: Entra ID by default, SQL authentication available but not recommended

### Synapse Studio

[Synapse Studio](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is#synapse-studio){:target="_blank" rel="noopener noreferrer"} is the web-based IDE for Synapse development. It provides:

- SQL query editor for writing T-SQL against dedicated pools
- Notebook environment for interactive Spark and Python development
- Pipeline builder for visual ETL workflow design
- Linked service configuration and management
- Data integration and publishing workflows

Studio is where data engineers and analysts spend most of their time. It eliminates the need for separate tools like SQL Server Management Studio or Jupyter notebooks.

### Data Lake Storage Integration

Synapse tightly integrates with [Azure Data Lake Storage Gen2](https://learn.microsoft.com/en-us/azure/storage/blades/overview){:target="_blank" rel="noopener noreferrer"}. Every workspace has a default storage account where raw data is stored before loading into SQL pools.

**Typical data flow:**
1. Raw data lands in Data Lake Storage (via ingestion pipelines, ADLS SDKs, or ADF Copy activity)
2. Spark jobs transform and clean data (written as Parquet)
3. Cleaned data is loaded into dedicated SQL pools via COPY
4. Analytics queries run against the warehouse
5. Results are cached or exported

This separation (storage separate from compute) allows independent scaling: you can have a massive data lake with small compute pools (pay only for processing time) or vice versa.

---

## Spark Pools

### What Spark Pools Are

[Apache Spark pools](https://learn.microsoft.com/en-us/azure/synapse-analytics/spark/apache-spark-overview){:target="_blank" rel="noopener noreferrer"} provide distributed big data processing within Synapse. Unlike dedicated SQL pools which require structured, schema-enforced data, Spark handles unstructured data (images, logs, raw text) and complex transformations.

**Key characteristics:**
- On-demand auto-scaling (0 to 600 nodes)
- Support for PySpark (Python), Spark SQL, Scala, and .NET Spark
- Integration with notebooks for interactive development
- Access to the same data lake as SQL pools
- Can write results back to data lake or SQL pools

### Spark vs Dedicated SQL Pools

| Aspect | Spark Pools | Dedicated SQL Pools |
|--------|------------|-------------------|
| **Data format** | Unstructured, semi-structured, structured | Structured, schema-enforced |
| **Language** | Python, Scala, SQL, .NET | T-SQL only |
| **Processing model** | MapReduce/DAG | MPP query execution |
| **State** | Stateless, auto-scales to 0 | Reserved capacity |
| **Latency** | Minutes to hours | Seconds to minutes |
| **Use case** | ETL, ML feature engineering, data exploration | Analytics queries, reports |
| **Cost** | Per core-hour of usage | Per DWU-hour |

**When to use Spark:**
- Transforming raw data before loading to warehouse
- Building machine learning features from raw data
- Processing unstructured data (logs, images, documents)
- Interactive data exploration (notebooks)

**When to use Dedicated SQL pools:**
- Running analytical queries on structured data
- Building dashboards and reports
- Complex OLAP operations with joins and aggregations
- Serving data via BI tools

---

## Data Explorer Pools

[Data Explorer pools](https://learn.microsoft.com/en-us/azure/synapse-analytics/data-explorer/data-explorer-overview){:target="_blank" rel="noopener noreferrer"} provide Kusto Query Language (KQL) for analyzing logs, metrics, and telemetry data. They are optimized for time-series queries with rapid ingestion and interactive exploration.

**When to use Data Explorer:**
- Analyzing application logs and diagnostics
- Real-time monitoring and alerting on metrics
- Time-series analysis (system performance over time)
- Ad-hoc exploration of operational data
- Not recommended for data warehouse workloads (use dedicated SQL pools instead)

---

## Synapse Pipelines (Data Integration)

[Synapse Pipelines](https://learn.microsoft.com/en-us/azure/synapse-analytics/integrate/concepts-data-factory-differences){:target="_blank" rel="noopener noreferrer"} (built on Azure Data Factory) orchestrate data movement and transformation workflows.

**Common pipeline patterns:**
- **Copy Activity:** Move data from source (Blob Storage, SQL Server, Salesforce) to Data Lake Storage Gen2
- **Data Flow Activity:** Visual transformation of data (join, filter, aggregate)
- **Notebook Activity:** Execute Spark notebooks as part of the pipeline
- **SQL Script Activity:** Execute T-SQL stored procedures or queries
- **Wait Activity:** Pause execution until a condition is met

**Example pipeline flow:**
1. Copy Activity: Download data from external API to Data Lake
2. Data Flow: Clean and transform data
3. Notebook Activity: Run Spark ML feature engineering
4. Copy Activity: Load results into dedicated SQL pool
5. SQL Script: Execute stored procedure to update aggregate tables

Pipelines are triggered on schedule, via webhooks, or manually.

---

## Common Pitfalls

### Pitfall 1: Hash Distribution Without Understanding Join Cardinality

**Problem:** Hash-distributing a table on a column that is frequently joined, but the join is not on that column.

**Result:** Every query involving that join shuffles data across all nodes, causing severe performance degradation (queries run 100x slower).

**Solution:** Hash-distribute on the column used in the most common joins. For fact tables, this is typically the foreign key to the largest dimension. Analyze your query patterns before choosing distribution keys.

---

### Pitfall 2: Replicating Large Tables

**Problem:** Replicating a table that grows to 10+ GB.

**Result:** Storage multiplies across nodes (10 GB × 100 nodes = 1 TB storage cost). Replication also adds latency during updates (all nodes must be synchronized).

**Solution:** Replicate only small reference tables (< 2 GB). For larger tables, use hash distribution on join columns instead.

---

### Pitfall 3: Leaving Dedicated SQL Pools Running During Off-Hours

**Problem:** Pausing the pool only during scheduled maintenance, not during nights/weekends.

**Result:** Unnecessary compute costs accumulate. A DW2000c running 24/7 for a month costs roughly 2x the cost of pausing at nights.

**Solution:** Automate pause/resume on a schedule. Use Synapse Pipelines, Azure Logic Apps, or Automation Accounts to pause the pool when no queries are running (e.g., 6 PM to 8 AM).

---

### Pitfall 4: No Workload Management, All Queries Same Priority

**Problem:** Running ad-hoc developer queries and critical business reports with the same resource allocation.

**Result:** A long-running exploration query from a developer blocks important executive reports. SLAs are violated.

**Solution:** Implement workload groups. Assign critical reports high priority and more resources. Assign exploration queries lower priority and limit their concurrent sessions. Use query classification to automatically route queries to appropriate groups.

---

### Pitfall 5: Not Pausing Materialized View Refreshes

**Problem:** Refreshing materialized views during peak usage hours when the pool should be reserved for user queries.

**Result:** View refreshes consume resources, slowing user queries and violating query SLAs.

**Solution:** Schedule materialized view refreshes during off-peak hours (late night, early morning). Use MAXDOP and SET SESSION settings to limit the resources a refresh job consumes.

---

### Pitfall 6: PolyBase Queries on Massive External Datasets

**Problem:** Using PolyBase to query 100+ GB of Parquet files in the data lake for exploratory analysis.

**Result:** Query takes 30+ minutes even with filter pushdown. Network and compute become bottlenecks.

**Solution:** For exploratory queries, load a sample of external data into the warehouse first. Use Spark pools for transformations on the full dataset, then load results to SQL for final analysis. PolyBase is best for smaller datasets or joining external data with warehouse data.

---

### Pitfall 7: Ignoring Data Skew in Distribution

**Problem:** Hash-distributing on a column with highly skewed values (e.g., 90% of rows have the same value).

**Result:** One node receives 90% of the data, becoming a bottleneck. Queries run at the speed of the slowest node.

**Solution:** Before distributing, query the system to check for data skew across distributions. If one distribution has > 5% more rows than others, choose a different column or use round-robin. Uneven distribution compounds over time as data grows.

---

## Architectural Patterns

### Pattern 1: Standard Data Warehouse

**Use case:** Structured analytics with multiple data sources, moderate scale (1-10 billion rows).

```
Data Sources (CRM, ERP, Web Logs)
    ↓
Data Lake Storage Gen2 (Raw Zone)
    ↓
Synapse Pipelines (Copy Activity)
    ↓
Spark Pool (Cleaning & Transformation)
    ↓
Data Lake Storage (Prepared Zone)
    ↓
Dedicated SQL Pool (Analytics)
    ↓
Power BI / Reporting Tools
```

**Components:**
- One or two small Spark pools (32-128 cores) for nightly ETL
- One dedicated SQL pool (DW1000c-DW2000c) for day-time queries
- Data Lake organized as raw → prepared → analytics zones
- Materialized views for common aggregations
- Workload groups separating user queries from ETL jobs

---

### Pattern 2: High-Concurrency Analytics (Multi-tenant SaaS)

**Use case:** SaaS analytics platform serving many tenants, 100+ concurrent users, strict query latency SLAs.

```
Application Data
    ↓
Dedicated SQL Pool (DW5000c+)
    ↓
Result Set Caching + Materialized Views
    ↓
Power BI Embedded or Custom Portal
```

**Design considerations:**
- Higher DWU level (DW5000c or above) for concurrency
- Workload groups with priority: critical reports (higher), ad-hoc (lower)
- Aggressive caching: result set cache + materialized views
- Row-level security (RLS) to isolate tenant data in queries
- Replicated dimensions for quick joins
- Connection pooling at the application level

---

### Pattern 3: Data Lake + Ad-hoc Analytics

**Use case:** Data science and exploration, large datasets (100+ GB), interactive queries via notebooks.

```
Raw Data (Data Lake)
    ↓
Spark Pools (Notebook-based exploration)
    ↓
Subset → Dedicated SQL Pool (for final analysis)
    ↓
Visualization
```

**Design considerations:**
- Larger Spark pools (256+ cores) for interactive workloads
- Smaller dedicated SQL pool (or none) if primary work is in Spark
- Delta format in data lake for ACID transactions
- Notebooks as the primary development environment
- Use PolyBase for joining external data with warehouse data

---

## Key Takeaways

1. **Synapse is a unified analytics platform combining SQL, Spark, and integration.** This convergence reduces operational complexity compared to managing separate data warehouse, Spark clusters, and ETL services.

2. **Data distribution strategy is the most important design decision for dedicated SQL pools.** Hash-distribute on join columns, replicate small tables, and use round-robin for staging. Bad distribution keys cause orders-of-magnitude performance degradation.

3. **DWUs are your primary scaling lever, but pause/resume is your primary cost control.** Pausing during off-hours saves 50% of compute costs. Scaling up improves concurrency and query speed.

4. **Workload management prevents query interference.** Without it, a single slow query can block all others. Resource classes or workload groups are essential for any production environment.

5. **Spark pools are for transformation, SQL pools are for analytics.** Use Spark for ETL and exploratory work; use dedicated SQL pools for queries that need sub-second latency and support many concurrent users.

6. **Materialized views cache expensive aggregations without code changes.** They automatically rewrite queries that match their definition. Build them on high-cost, frequently accessed aggregations.

7. **Result set caching provides easy wins for repeated queries.** Dashboards and reports that run the same queries multiple times per day benefit significantly.

8. **PolyBase is for exploration, not for large-scale joins.** Use it to query sample data or reference small external tables. For large external datasets, load to the data lake first, transform with Spark, then load to SQL.

9. **Integration with Data Lake Storage is a core strength.** Synapse reads/writes Parquet efficiently. This storage-compute separation allows flexible scaling of each independently.

10. **Data exploration should happen in Spark notebooks before loading to the warehouse.** Spark handles unstructured and semi-structured data naturally. SQL pools are optimized for structured, pre-validated data.
