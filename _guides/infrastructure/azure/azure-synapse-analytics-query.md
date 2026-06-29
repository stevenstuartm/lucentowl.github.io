---
title: "Azure Synapse: Serverless & Dedicated Query"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Serverless SQL pools for on-demand data lake querying, external tables, CETAS patterns, and query optimization strategies for cost-effective analytics on Azure Synapse Analytics."
tags: [infrastructure, azure, analytics, databases, performance, cost-analysis, practical]
---

## What Is Synapse Serverless Query

[Azure Synapse serverless SQL pools](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/on-demand-workspace-overview){:target="_blank" rel="noopener noreferrer"} allow you to query data directly in cloud storage (Azure Data Lake Storage Gen2, S3-compatible storage) using standard SQL without provisioning compute capacity. Serverless SQL pools differ from [dedicated SQL pools](/study-guides/infrastructure/azure/azure-synapse-analytics.html) (covered in the companion guide), which are provisioned data warehouse engines with reserved capacity. Serverless pools scale elastically on a per-query basis, charging only for data scanned, not for idle capacity.

Serverless SQL pools are the Azure equivalent of AWS Athena, offering similar cost-per-query models and data lake querying capabilities. They complement dedicated pools in hybrid analytics architectures where some queries are exploratory (serverless) and others are repetitive and performance-critical (dedicated pools).

---

## What Problems Serverless Query Solves

**Without Serverless Query:**
- Data lives in cloud storage but requires loading into a database before querying
- Data movement creates latency and operational complexity
- Exploring raw data lake files requires custom scripts or extraction
- Every new data source requires provisioning and managing compute capacity
- Exploratory analytics costs are unpredictable and depend on cluster sizes

**With Serverless Query:**
- Query data lake files directly without loading or data movement
- Ad-hoc exploration and discovery with immediate feedback
- Pay only for data scanned, not for idle compute
- Easily add new data sources without infrastructure changes
- Blend data lake exploration with dedicated pool warehousing in one workspace

---

## How Synapse Serverless Differs from AWS Athena

| Concept | AWS Athena | Azure Synapse Serverless |
|---------|-----------|------------------------|
| **Service model** | Standalone query service | Integrated into Synapse workspace |
| **Query language** | Presto SQL (subset of standard SQL) | T-SQL (Microsoft SQL dialect) |
| **Data formats** | Parquet, CSV, JSON, ORC, CloudTrail, VPC Flow Logs | Parquet, CSV, JSON, Delta Lake, ORC |
| **Catalog** | AWS Glue Data Catalog or Hive Metastore | Synapse metadata (Spark pool metastore integration) |
| **Concurrency** | Unlimited query concurrency (throttle by resource class) | Query concurrency limited by workspace resource class |
| **External tables** | CREATE EXTERNAL TABLE with custom serialization format | CREATE EXTERNAL TABLE with OPENROWSET |
| **Performance features** | Partition projection, data lake optimization | Result set caching, partition elimination via folder structure |
| **Cost | Per-TB data scanned (standard, provisioned, or per-request pricing) | Per-TB data scanned with slight variance by complexity |
| **Integration** | Lake Formation, Redshift Spectrum | Dedicated SQL pools, Spark pools, Power BI |
| **DML support** | SELECT only (cannot write results easily) | SELECT, INSERT (CETAS), UPDATE, DELETE (limited) |
| **Network isolation** | VPC endpoints (separate) | Integrated Private Endpoint in Synapse workspace |

---

## Core Concepts

### Serverless SQL Pool: The Pay-Per-Query Model

A serverless SQL pool is a stateless query engine that scales automatically. You do not provision capacity, configure memory, or manage clusters. Instead, you submit queries and pay based on the amount of data scanned.

**Characteristics:**
- No provisioning or capacity management required
- Scales elastically; each query runs in isolation
- Costs are proportional to data scanned, regardless of query complexity
- Charges show up in Azure subscription as "On-Demand Compute" charges
- Perfect for exploratory analysis and ad-hoc queries
- Suitable for small-to-medium analytics workloads that do not require consistent performance guarantees

**When to use serverless pools:**
- Data exploration and schema discovery
- One-off analytical queries
- Ad-hoc reporting
- Querying rarely-accessed datasets
- Building the initial layer of a data lake

**When to use dedicated pools instead:**
- Queries run hundreds of times per day
- Performance SLAs are required
- Complex multi-join queries on large datasets
- Real-time dashboards with predictable access patterns

---

### External Tables and External Data Sources

External tables provide a SQL interface to data files stored outside the database. Instead of loading data, external tables define a schema that maps to files in cloud storage, allowing you to query them as if they were tables.

**How external tables work:**
1. Data exists as files in cloud storage (Parquet, CSV, JSON, or Delta Lake format)
2. You define an external data source pointing to the storage location
3. You define an external table that specifies the file format and column schema
4. Queries against the external table read directly from the files

**External data source characteristics:**
- Location: Path to cloud storage (Azure Data Lake Storage Gen2, S3-compatible blob storage)
- Credentials: Managed identity, shared key, or connection string
- Format: Parquet, CSV, JSON, ORC, Delta Lake

**External table characteristics:**
- Schema is defined in metadata, not enforced in storage
- File format must match the defined format
- Column order and naming must align with file structure
- Data types are inferred or explicitly specified
- No indexes or statistics (unlike traditional tables)

**Example architecture:**
```
Azure Data Lake Storage (ADLS Gen2)
└── /data/sales/2024/01/01/sales.parquet
└── /data/sales/2024/01/02/sales.parquet
    ↓
External Data Source → abfss://container@account.dfs.core.windows.net/data/sales
    ↓
External Table → SALES_EXTERNAL (defined schema)
    ↓
Serverless SQL queries against SALES_EXTERNAL
```

---

### OPENROWSET: Ad-Hoc File Querying

[OPENROWSET](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/develop-openrowset){:target="_blank" rel="noopener noreferrer"} is a function that reads files directly without defining an external table. It is useful for one-off queries where creating a formal table definition is unnecessary.

**When to use OPENROWSET:**
- Exploring a new data source for the first time
- Querying files that rarely change or are queried once
- Testing file format compatibility before committing to external tables

**OPENROWSET advantages:**
- No metadata management required
- Direct file querying in a single statement
- Flexible schema inference
- Useful for prototyping

**OPENROWSET limitations:**
- Every query must specify the file path (no reusability)
- Schema inference can be slower than pre-defined external table metadata
- Less performant than external tables for repeated queries

---

### CETAS: CREATE EXTERNAL TABLE AS SELECT

CETAS materializes query results into Parquet files in cloud storage, creating a new external table that references those files. This pattern is useful for data transformation, curation, and creating intermediate results.

**How CETAS works:**
1. Define a SELECT query that transforms source data
2. CETAS executes the query and writes results as Parquet files
3. The results become a new external table
4. Downstream queries reference the external table (not re-running the original transformation)

**CETAS use cases:**
- Creating curated datasets (silver layer in medallion architecture)
- Aggregating or enriching raw data
- Partitioning data for faster downstream queries
- Building reusable transformations without stored procedures

**Cost considerations with CETAS:**
- You pay for data scanned during the CETAS query
- You pay for storage of the output files
- Subsequent queries against the result table incur cost per TB scanned
- Avoids re-running expensive transformations repeatedly (cost optimization)

**Example medallion layer pattern:**
```
Bronze (raw) → OPENROWSET/external table
    ↓
Silver (cleaned) → CETAS transforms bronze data
    ↓
Gold (aggregated) → CETAS creates business-ready tables
    ↓
Views on gold tables provide business logic
```

---

### Views Over External Data

Views provide a reusable, named SQL interface over external tables. A view encapsulates column selection, filtering, joins, and transformations, allowing consumers to query without understanding the underlying storage structure.

**Why views matter:**
- Hide complexity from downstream users
- Decouple application queries from physical storage layout
- Facilitate schema evolution (change view definition, not applications)
- Enforce business logic (filtering, aggregations, transformations)
- Simplify security (control access through views, not raw tables)

**View patterns:**
- **Data cleaning view:** Filters out malformed records, applies type conversions, deduplicates rows
- **Business view:** Applies business rules, calculations, and naming conventions
- **Grain view:** Aggregates to a specific grain (daily summaries, weekly rollups)
- **Logical warehouse view:** Joins multiple external tables to create a "facts and dimensions" feel

**Views on external tables vs materialized results (CETAS):**
- Views: Recomputed on each query. No storage costs but higher compute per query.
- CETAS: Materialized once. Storage costs but faster repeated queries.

---

### Data Lake File Organization and Query Performance

Physical file layout in cloud storage has profound impact on query performance. Serverless SQL pools can push file filtering down to the storage layer, scanning only relevant files.

**Partitioning strategy:**
- Files should be organized in folder hierarchies that reflect common filter dimensions
- Common partitioning schemes: date (year/month/day), region, product line
- Partitioning allows serverless SQL to skip entire folder structures when WHERE clauses filter by partition key

**Example partition structure:**
```
/data/sales/
  /year=2024/
    /month=01/
      /day=01/
        sales_part_1.parquet
        sales_part_2.parquet
      /day=02/
        sales_part_1.parquet
    /month=02/
      /day=01/
        sales_part_1.parquet
```

A query filtering `WHERE year=2024 AND month=01 AND day=01` scans only files in that folder, not the entire dataset.

**File size and count optimization:**
- Too many small files: Overhead increases (one open/read per file)
- Too few large files: Parallelism decreases (limited file partitioning)
- Optimal: Parquet files 64-256 MB each
- Many small files (e.g., thousands of 1 MB files) dramatically slow queries

**Columnar format benefits:**
- Parquet stores data columnar, not row-wise
- Queries selecting 3 columns from 100-column files scan only 3 columns
- Row-wise formats (CSV) must scan all columns regardless of projection
- Compression is significantly better for columnar data

---

### Serverless SQL Pool vs Dedicated SQL Pool: Choosing Between Them

| Scenario | Serverless | Dedicated |
|----------|-----------|-----------|
| **Exploratory queries** | Excellent (no setup, pay-per-query) | Acceptable (but wastes reserved capacity) |
| **Real-time dashboards** | Poor (variable latency) | Excellent (predictable performance) |
| **Large one-time scans** | Good (cost aligns with usage) | Poor (full cluster cost even for single query) |
| **Repetitive OLAP queries** | Acceptable (repeated scans cost more) | Excellent (amortized cost over many runs) |
| **Data exploration** | Excellent (low barrier to trying) | Not ideal (requires provisioning first) |
| **ETL/data movement** | Fair (good for small-to-medium volumes) | Excellent (high throughput) |
| **Ad-hoc BI tools** | Good (matches unpredictable demand) | Challenging (fixed cost regardless of demand) |

**Hybrid strategy:**
- Use serverless for initial data exploration, ad-hoc queries, and one-time analysis
- Identify high-frequency queries that would benefit from dedicated capacity
- Move those queries to dedicated pools or materialize their results
- Serverless queries feed into CETAS to create dedicated pool source tables

---

## Query Patterns

### Data Exploration and Discovery

Serverless SQL pools are ideal for exploring raw data lakes before committing to structure and ETL.

**Pattern workflow:**
1. New data arrives in cloud storage
2. Use OPENROWSET to inspect file structure, sample records, and data types
3. Run aggregations to understand data distribution and quality
4. Define external tables for data that meets quality standards
5. Create views that hide raw schema complexity

**Exploration queries:**
- Sample data: `SELECT TOP 100 * FROM external_table`
- Count records: `SELECT COUNT(*) FROM external_table`
- Column analysis: `SELECT column, COUNT(*) as cnt FROM external_table GROUP BY column`
- Null analysis: `SELECT column, COUNT(*) FILTER (WHERE column IS NULL) as nulls FROM external_table`

---

### Logical Data Warehouse Pattern

The logical data warehouse pattern combines external tables and views to provide a SQL interface over raw data lake files, without loading data into a database.

**Pattern structure:**
- **Bronze layer (raw):** External tables directly referencing data lake files
- **Silver layer (cleaned):** Views that apply data quality rules, type conversions, filtering
- **Gold layer (curated):** Views that aggregate, enrich, and apply business logic
- **Consumption layer:** User-facing views that hide complexity and enforce naming conventions

**Benefits:**
- No data loading; queries read directly from files
- Transformations are captured in view definitions, not in separate ETL processes
- Easy to version and audit transformation logic
- Supports incremental discovery as business requirements evolve
- Minimal operational overhead

**Trade-off:** Each query re-scans raw files, so gold layer views may need materialization (CETAS) if queried repeatedly.

---

### Data Transformation and Enrichment

CETAS patterns create curated datasets by transforming raw data once and storing results for repeated access.

**Example transformation workflow:**
1. Raw sales data arrives daily in cloud storage
2. CETAS query reads raw files, cleans data, and writes cleaned results to silver layer
3. Gold layer CETAS reads silver, aggregates by region, and stores by-region tables
4. BI tools query gold layer tables (which are external tables backed by Parquet files)

**Cost implications:**
- First run: Pay for scanning raw data + storing intermediate results
- Repeated runs: Pay for scanning intermediate results only
- Saves cost on repetitive transformations vs re-running complex logic each time

---

### Cross-Database and Cross-Workspace Queries

Serverless SQL pools can query external tables in different databases and linked databases in other Synapse workspaces, supporting unified analytics across distributed data.

**Pattern:**
- Database A contains silver layer tables
- Database B contains gold layer tables
- Queries can join across database boundaries
- Workspace A can query external tables in Workspace B's Synapse database

**Use case:** Multiple business units maintain separate data lakes; central analytics queries across all units.

---

### Querying Delta Lake Format

[Delta Lake](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/query-delta-lake-format){:target="_blank" rel="noopener noreferrer"} is an open-source table format that adds ACID transactions and schema governance to data lake files. Serverless SQL pools can query Delta Lake tables, enabling transactional consistency in the data lake.

**Delta Lake benefits:**
- ACID transactions: Readers never see partial writes
- Schema enforcement: All files conform to the same schema
- Time travel: Query previous versions of tables
- Updates and deletes: Modify data in place (unlike append-only Parquet)

**When to use Delta Lake:**
- Data must be updated after initial write (not pure append-only)
- Multi-table transactions are required
- Historical auditing requires version tracking
- Data pipeline requires strong consistency guarantees

**Serverless SQL pool support:**
- Full read support for Delta tables
- No write support directly (use Spark pools for Delta writes)
- Can query historical versions with TIME TRAVEL syntax

---

## Performance Optimization

### File Format Impact

File format selection directly affects query performance and cost.

**Parquet (recommended):**
- Columnar storage (only scanned columns are read)
- Compression: 90%+ reduction vs CSV for typical analytics data
- Metadata: Built-in statistics for predicate pushdown
- Schema: Enforced at file level
- Cost per query: Lowest (fewer bytes scanned)

**CSV:**
- Row-oriented (all columns scanned even if only one is needed)
- Minimal compression (typically 30-50% reduction with compression algorithms)
- No embedded statistics
- Human-readable (useful for debugging and data transfer)
- Cost per query: 2-5x higher than equivalent Parquet

**JSON:**
- Semi-structured (flexible schema, supports nested data)
- Larger file size than Parquet (higher costs)
- Useful for logs, events, and configuration data
- Schema inference is slower

**Delta Lake:**
- Parquet underneath with transaction log
- Same cost as Parquet for querying
- Additional cost for maintaining transaction log
- Worth the cost if ACID semantics are needed

**Optimization strategy:**
- Convert CSV to Parquet in the bronze layer (one-time cost)
- Save 2-5x on all downstream queries
- Use JSON only for semi-structured data (logs, events)
- Use Delta Lake when transactional consistency is required

---

### File Size and Count Optimization

Serverless SQL query performance degrades significantly with many small files.

**The small-files problem:**
- 10,000 small 1 MB files cost more to scan than a single 10 GB file
- Each file requires metadata read, connection setup, and column scanning
- Aggregated overhead can 2-3x query costs

**Optimization strategy:**
- Monitor file count and size in data lake
- Run periodic compaction: Read many small files, write to larger files
- Target file size: 64-256 MB for Parquet (balance between I/O overhead and parallelism)
- Use Delta Lake optimization: `OPTIMIZE table_name` consolidates small files

**Implementation:**
- Spark pool job runs nightly: Reads raw files, consolidates to optimal size, writes to silver layer
- Serverless queries read pre-consolidated files (faster, cheaper)

---

### Partition Elimination

Serverless SQL pools can eliminate entire file partitions based on WHERE clause predicates, avoiding unnecessary scans.

**How it works:**
- If files are organized in folders by date, serverless SQL can skip folders that do not match the WHERE clause
- Predicate: `WHERE year=2024 AND month=01` skips all other year/month folders
- Partition pruning is automatic; no configuration required

**Optimization strategy:**
- Organize files by dimensions that appear frequently in WHERE clauses
- Ensure partition column values are in folder names (e.g., `/year=2024/month=01/`)
- Query planner learns partition structure from metadata

**Cost example:**
- Dataset: 10 TB across 12 years
- Query: `WHERE year=2024` (1/12 of dataset)
- Partition elimination scans only ~833 GB, not 10 TB
- Cost savings: 91%

---

### Statistics and Metadata Caching

Serverless SQL maintains metadata and statistics about external tables to optimize query planning.

**Metadata:**
- File count, size, and modification time
- Column names, types, and order
- Partition key information

**Result set caching:**
- Query results are cached for a limited time
- Identical queries within the cache period return results instantly
- Cache invalidation: Automatic when underlying files change

**How to use caching:**
- Understand that your query results may be cached
- Cached results do not incur data scan charges (only network transfer)
- Cache duration: Typically minutes to hours, depends on Synapse configuration
- View DMVs (dynamic management views) to see cache statistics

---

### Resource Class and Concurrency for Dedicated Pools

While this guide focuses on serverless querying, dedicated pools (when combined with serverless) benefit from proper resource class configuration.

**Resource classes:**
- `smallrc`: 1 concurrent query, minimal memory
- `mediumrc`: 2 concurrent queries, moderate memory
- `largerc`: 4 concurrent queries, high memory
- `xlargerc`: 8 concurrent queries, highest memory

**Trade-off:** Increasing resource class per query reduces concurrency. A single `xlargerc` query consumes resources that could run 8 `smallrc` queries.

**Serverless does not use resource classes.** Serverless queries scale automatically without manual concurrency management. However, understanding resource classes helps when blending serverless and dedicated workloads.

---

## Architecture Patterns

### Medallion Architecture with Serverless SQL

The medallion (or delta lake) architecture organizes data into bronze, silver, and gold layers. Serverless SQL pools efficiently query each layer.

**Bronze layer (raw):**
- External tables over raw data lake files
- Minimal transformation
- Served by serverless SQL for exploration

**Silver layer (cleaned):**
- CETAS queries transform bronze data
- Schema enforcement and data quality rules
- External tables enable downstream queries

**Gold layer (curated):**
- CETAS queries aggregate and enrich silver data
- Business-ready datasets
- External tables or dedicated SQL pool for frequent access

**Query path:**
```
Serverless SQL (exploration) → CETAS (silver materialization)
                             → CETAS (gold aggregation)
                             → Dedicated SQL (repeated access)
                             → BI tools (visualizations)
```

**Cost optimization:**
- Exploratory queries on bronze use serverless (cheap, data-scanned pricing)
- High-frequency queries move to dedicated pools (fixed cost, predictable performance)
- Materialization (CETAS) breaks the pipeline; each layer pays once for computation

---

### Data Lakehouse Pattern with Synapse as Query Engine

A lakehouse combines data lake (low cost, flexible schema) with data warehouse (SQL performance, consistency). Serverless SQL pools and Delta Lake enable this pattern.

**Components:**
- **Data lake storage:** Azure Data Lake Storage Gen2 or S3-compatible
- **Delta Lake tables:** Transactional format with ACID properties
- **Serverless SQL:** On-demand querying with ACID semantics
- **Dedicated SQL (optional):** For performance-critical workloads
- **Spark pools:** For ETL, complex transformations, and Delta Lake writes

**Pattern workflow:**
1. Spark pipeline writes data in Delta Lake format (ACID guarantees)
2. Serverless SQL queries Delta tables directly (consistent reads)
3. Multiple engines (SQL, Spark, Python) share the same data
4. No data movement between layers (single source of truth)

**Trade-off vs traditional warehouse:**
- Lakehouse: Lower storage cost, flexible schema, eventual consistency
- Traditional warehouse: Higher cost, stricter schema, strong consistency

---

### Hybrid Analytics Combining Serverless and Dedicated Pools

Many organizations use both serverless and dedicated pools for different workload characteristics.

**Hybrid pattern:**
- **Exploratory phase:** Serverless SQL for data discovery and prototyping
- **Production phase:** CETAS materializes promising queries to dedicated pool
- **Real-time dashboards:** Dedicated pool for SLA-required performance
- **Ad-hoc reporting:** Serverless SQL for unpredictable, one-time queries

**Cost implications:**
- Serverless: High variable cost for exploration, low fixed cost
- Dedicated: High fixed cost, low per-query cost
- Hybrid: Minimizes total cost by matching tool to workload

---

### Serving Layer for Power BI and BI Tools

Serverless SQL pools and external tables provide a SQL interface for Power BI and other BI tools, enabling dashboards over data lake data without data movement.

**Pattern:**
1. Create external tables or views over data lake files
2. Configure Power BI as a Synapse workspace connection
3. Power BI queries reference external tables
4. Results update as data lake files change

**Performance considerations:**
- Initial query latency: Higher for serverless (variable)
- Refresh frequency: Serverless works well for hourly or daily refreshes
- Dashboard interactivity: May be sluggish for serverless (users expect <1 second response)
- Solution: Pre-materialize dashboard data to dedicated pool

---

## Cost Considerations

### Pay-Per-TB-Processed Model

Serverless SQL charges per TB of data scanned, not per query, not per node-hour.

**How costs are calculated:**
- Data scanned = (file size × compression ratio × selective scan efficiency)
- Cost per TB: Published price per region (typically $5-10 per TB)
- Parquet compression typically reduces effective TB by 10-20x vs CSV

**Cost optimization strategies:**
1. **File format:** Parquet reduces costs 2-5x vs CSV
2. **Partition elimination:** Filter by partition key to skip files
3. **Column projection:** SELECT only needed columns (Parquet advantage)
4. **Result set caching:** Identical queries use cache (no charge)
5. **External table metadata:** Pre-defined external tables are faster than OPENROWSET

---

### File Format, Partitioning, and Column Pruning Impact

Each architectural choice affects per-query cost.

**Example cost comparison:**
```
Scenario: Query 10 TB dataset selecting 3 columns from 100 columns

CSV (row-oriented):
- All 100 columns scanned: 10 TB
- Cost: 10 × $6/TB = $60

Parquet (columnar):
- Only 3 columns scanned: 10 TB × 3% = 0.3 TB (approximate)
- Cost: 0.3 × $6/TB = $1.80
- Savings: 97%

CSV with partition elimination (WHERE year=2024):
- All 100 columns scanned: 10 TB / 10 years = 1 TB
- Cost: 1 × $6/TB = $6
- Savings: 90% vs full scan

Parquet with partition elimination:
- Only 3 columns, 1 TB after partition elimination: 0.03 TB
- Cost: 0.03 × $6/TB = $0.18
- Savings: 99.7% vs unoptimized CSV
```

---

### Cost Comparison: Serverless vs Dedicated for Different Workload Patterns

| Workload | Serverless Cost | Dedicated Cost | Winner |
|----------|-----------------|----------------|------|
| 10 exploratory queries (1 TB each, unique) | $60 | $2,000/month | Serverless by 33x |
| Same query run 1,000x/month (1 TB each) | $6,000 | $2,000/month | Dedicated by 3x |
| Mixed: 50 one-time + 500 repeated (2 TB total/month) | $300 | $2,000/month | Serverless by 6.7x |
| High-performance dashboard (SLA required) | Variable latency (fail) | $2,000/month | Dedicated required |

**Decision framework:**
- **Query frequency < 10 times/month:** Serverless (cost scales with usage)
- **Query frequency 10-100 times/month:** Consider dedicated if consistent performance required
- **Query frequency > 100 times/month:** Dedicated typically cheaper, provides predictable latency

---

### Built-In Cost Controls and Query Governors

Synapse provides tools to prevent runaway costs.

**Query timeout:**
- Prevent long-running queries from consuming excessive resources
- Default: 30 minutes (configurable)
- Queries exceeding timeout are cancelled

**Data scanned limits:**
- Prevent single queries from scanning entire data lake
- Configure maximum data per query
- Queries exceeding limit are cancelled

**Workload management (in dedicated pools):**
- Allocate resources to query classes
- Prevent high-priority queries from queuing behind low-priority ones
- Monitor actual vs allocated resources

**Monitoring:**
- Query Store logs every query: duration, data scanned, cost
- Identify expensive queries and optimize or restrict
- DMVs expose actual resource consumption

---

## AWS Comparison Table

| Concept | AWS Athena | Azure Synapse Serverless |
|---------|-----------|------------------------|
| **Query engine** | Presto SQL | T-SQL (Microsoft SQL dialect) |
| **Data source** | S3, Redshift, RDS, data lake, Glue | ADLS Gen2, S3-compatible, Synapse SQL, Spark |
| **Table format** | Parquet, CSV, JSON, ORC, Iceberg | Parquet, CSV, JSON, Delta Lake, ORC |
| **Metadata catalog** | Glue Data Catalog or Hive Metastore | Synapse metadata, Spark metastore integration |
| **External tables** | CREATE EXTERNAL TABLE | CREATE EXTERNAL TABLE, OPENROWSET |
| **Materialization** | INSERT INTO → S3 | CETAS (CREATE EXTERNAL TABLE AS SELECT) |
| **Query language** | Presto (limited SQL compatibility) | Full T-SQL (more standard than Presto) |
| **Cost model** | Per-TB scanned (DW capacity or provisioned pricing available) | Per-TB scanned (slight variance by region) |
| **Performance** | Variable (depends on file layout) | Variable (depends on file layout and caching) |
| **ACID transactions** | Iceberg format (supported) | Delta Lake (natively supported) |
| **Integration** | Redshift Spectrum, Lake Formation | Dedicated pools, Spark pools, Power BI |
| **Concurrency** | Handled automatically (DW throttles) | Automatically scaled (workspace concurrency limits) |
| **Workspace integration** | None (standalone) | Unified Synapse workspace with SQL, Spark, Pipelines |

---

## Common Pitfalls

### Pitfall 1: Many Small Files Destroying Query Performance

**Problem:** Data lake contains thousands of 1 MB Parquet files instead of dozens of 64 MB files.

**Result:** Queries take 10x longer because serverless SQL incurs overhead per file (metadata read, connection, column scanning).

**Solution:** Implement periodic file compaction. Spark job or dedicated pool consolidates small files into optimal sizes (64-256 MB). Compaction cost is one-time; savings compound over hundreds of queries.

---

### Pitfall 2: Querying CSV Instead of Parquet

**Problem:** Raw data arrives as CSV. Exploratory queries read CSV directly.

**Result:** Queries cost 2-5x more because all columns are scanned. Compression ratio is worse.

**Solution:** One-time conversion: Read CSV with OPENROWSET, CETAS output as Parquet. All downstream queries read Parquet (amortized conversion cost over many queries).

---

### Pitfall 3: Not Partitioning Data Lake by Common Filter Dimensions

**Problem:** Data lake files are organized only by date of ingest, not by business dimension (region, product, customer).

**Result:** Queries filtering by region scan entire dataset; partition elimination cannot skip files.

**Solution:** Re-organize files by common filter dimensions. If queries always filter by region, files should live in `/region=US/`, `/region=EU/`, etc.

---

### Pitfall 4: Materializing Everything with CETAS

**Problem:** Every transform is materialized as a new external table, creating many intermediate layers.

**Result:** Each layer adds storage cost and increases complexity. A 10-layer pipeline means 10-layer lineage tracking.

**Solution:** Materialize strategically. Materialize expensive transformations (complex joins, aggregations). Leave cheap transformations as views. Trade-off: View cost (re-computation) vs CETAS cost (storage + scanning pre-computed result).

---

### Pitfall 5: Confusing Serverless Query Performance With Dedicated Pool Performance

**Problem:** Expect serverless SQL to provide sub-second response times like a dedicated pool.

**Result:** Queries take 5-10 seconds (cold start, compilation overhead). Dashboard feels sluggish.

**Solution:** Dedicated pools for dashboards (SLA response times). Serverless for exploratory queries and ad-hoc analysis (latency tolerance). Pre-materialize dashboard data to dedicated pool if using serverless source data.

---

### Pitfall 6: Not Monitoring Query Costs

**Problem:** Queries run without visibility into per-query cost. One expensive exploratory query costs more than expected.

**Result:** Bills increase unexpectedly. Cost optimization becomes urgent.

**Solution:** Enable Query Store. Monitor top 10 most expensive queries monthly. Identify candidates for optimization (partitioning, format conversion, CETAS materialization). Set up alerts for unusual query costs.

---

## Key Takeaways

1. **Serverless SQL pools are for queries that do not require predictable performance.** They are ideal for exploration, one-off analysis, and ad-hoc reporting where variable latency is acceptable.

2. **Cost scales with data scanned, not cluster size.** Serverless SQL pricing aligns perfectly with exploratory workloads where query patterns are unpredictable. Unlike dedicated pools (where you pay for capacity whether used or not), serverless charges only for actual data processed.

3. **File format is the most impactful optimization.** Converting CSV to Parquet reduces query costs 2-5x. This one-time conversion cost is recouped over dozens of queries. For data lakes with thousands of queries, file format dominance is overwhelming.

4. **Partition elimination enables massive cost savings.** If files are organized by commonly-filtered dimensions, serverless SQL skips entire folder structures. Proper partitioning can reduce query cost by 90%+.

5. **CETAS is the key transformation pattern in serverless SQL.** Instead of storing transformation logic in stored procedures, CETAS materializes results, enabling downstream queries to read pre-computed results. This amortizes transformation cost across many queries.

6. **The logical data warehouse pattern eliminates data movement.** Views over external tables provide a SQL interface to data lake files without loading them into a database. This pattern is perfect for medallion architectures where bronze, silver, and gold layers are all external tables.

7. **Delta Lake adds transactional semantics to data lake files.** With Delta Lake, multiple writers can safely update the same table, and readers see consistent snapshots. Serverless SQL supports full read access to Delta tables, enabling lakehouse architectures.

8. **Hybrid architectures combine serverless and dedicated pools for cost efficiency.** Exploratory queries use serverless (pay-per-query). High-frequency queries move to dedicated pools (amortized cost). Materialization (CETAS) bridges the gap.

9. **Many small files are a hidden cost multiplier.** A dataset with 10,000 small files costs more to query than the same data in 100 large files. Periodic compaction is essential for cost management.

10. **Result set caching provides instant query response for repeated queries.** Identical queries within the cache window return results instantly without scanning data. Caching is transparent and requires no configuration.
