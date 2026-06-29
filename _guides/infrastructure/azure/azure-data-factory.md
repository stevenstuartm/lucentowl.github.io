---
title: "Azure Data Factory: ETL & Data Integration"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Data integration and ETL/ELT orchestration with Azure Data Factory including pipelines, data flows, linked services, integration runtimes, and patterns for building scalable data movement architectures."
tags: [infrastructure, azure, analytics, integration, automation, scalability, practical]
---

## What Is Azure Data Factory

[Azure Data Factory](https://learn.microsoft.com/en-us/azure/data-factory/introduction){:target="_blank" rel="noopener noreferrer"} is the orchestration engine for data integration in Azure. It provides visual pipeline authoring, 90+ connectors to diverse data sources, serverless scaling, and integration with Azure's analytics platform (Synapse, Databricks, SQL Database, Cosmos DB). Unlike self-managed ETL infrastructure, Data Factory handles scheduling, retries, error handling, and scaling automatically.

Think of Data Factory as an orchestration platform, not a transformation engine. It connects data sources, triggers transformations in specialized services, and ensures data flows through your architecture reliably. The actual transformations can happen in Data Factory's built-in mapping data flows or offloaded to Synapse, Databricks, SQL Server Integration Services (SSIS), and custom applications.

### What Problems Data Factory Solves

**Without Data Factory:**
- Data movement requires custom scripts or point-to-point connections
- Scheduling and retries must be handled manually
- Error handling and alerting need custom implementation
- Each data source requires a different integration approach
- Monitoring and troubleshooting lacks centralized visibility
- Scaling from one data movement job to hundreds requires rearchitecting
- Dependencies between jobs must be managed manually in external schedulers

**With Data Factory:**
- Visual pipeline authoring (no code required for many common patterns)
- Connectors to 90+ data sources and targets (no custom scripts for basic movement)
- Built-in scheduling, retries, and error handling
- Unified data integration across hybrid environments (on-premises, cloud, multi-cloud)
- Centralized monitoring, alerting, and troubleshooting via Azure Monitor
- Automatic scaling from small jobs to petabyte-scale data movement
- Dependency management and pipeline orchestration with built-in capabilities
- Integration with Azure services (Synapse, Databricks, Key Vault) for end-to-end data solutions

### How Data Factory Differs from AWS Glue

For architects moving from AWS to Azure, understanding the differences helps inform design decisions:

| Concept | AWS Glue | Azure Data Factory |
|---------|---|---|
| **Orchestration model** | Visual job creation; limited multi-step orchestration | Rich pipelines with activities, control flow, dependencies |
| **Transformations** | Spark jobs (PySpark/Scala); custom scripts | Mapping data flows (visual), notebooks, custom activities, SSIS |
| **Connectors** | 70+ connectors via built-in or custom | 90+ pre-built connectors; extensible via custom activities |
| **Scheduling** | Time-based triggers; limited event triggers | Multiple trigger types: schedule, tumbling window, event, manual |
| **Data movement** | Spark-based; good for transformation | Copy activity optimized for data movement; separate from transformation |
| **Integration runtimes** | None (implicit in Glue jobs) | Azure IR, self-hosted IR, Azure-SSIS IR for flexibility |
| **Visual authoring** | GUI for job creation | Full visual designer for pipelines and data flows |
| **Monitoring** | CloudWatch integration | Azure Monitor, built-in metrics, workbooks |
| **Pricing** | Per DPU-hour (dynamic provisioning) | Per pipeline run + data flow execution hours + copy activity units |
| **Hybrid support** | Limited (Glue Studio for ETL) | Native via self-hosted integration runtime |

---

## Core Azure Data Factory Components

### Pipelines and Activities

[Pipelines](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipelines-activities){:target="_blank" rel="noopener noreferrer"} are the orchestration unit in Data Factory. A pipeline contains activities (operations) that execute in sequence or parallel, with dependencies between them.

**Pipeline characteristics:**
- **Ordered execution:** Activities run sequentially or in parallel based on dependencies
- **Control flow:** Conditionals (If, For, Until), loops, and sequential execution
- **Variables and parameters:** Dynamic pipeline behavior based on inputs
- **Timeout and retry:** Built-in error handling with configurable retries and timeouts
- **Monitoring:** Each pipeline run is tracked with status, duration, and activity-level logs

**Common activity types:**

| Activity | Purpose |
|----------|---------|
| **Copy** | Move data from source to sink (90+ connector combinations) |
| **Data Flow** | Visually designed transformations (mapping data flows) |
| **Lookup** | Query a source to retrieve a single value or dataset (parameterization) |
| **Filter** | Evaluate conditions to gate downstream activities |
| **ForEach** | Iterate over a collection of items executing activities in each iteration |
| **If Condition** | Branch logic based on an expression |
| **Wait** | Pause pipeline for a specified duration |
| **Notebook** | Execute Databricks or Azure ML notebooks |
| **Spark Job** | Submit Spark jobs to HDInsight or Databricks clusters |
| **Stored Procedure** | Execute SQL stored procedures |
| **Custom Activity** | Run custom .NET or Docker code |
| **Webhook** | Call external endpoints (API callbacks, custom triggers) |

**Pipeline design pattern:**

```
Trigger → Lookup (get parameters)
  ↓
  ├─ Copy Activity 1 (source A to staging)
  ├─ Copy Activity 2 (source B to staging)
  ↓
  Data Flow (transform staging data)
  ↓
  ├─ If (validation passed?)
  ├─ Yes → Copy to final destination
  ├─ No → Send notification, log error
```

### Datasets and Linked Services

[Datasets](https://learn.microsoft.com/en-us/azure/data-factory/concepts-datasets-linked-services){:target="_blank" rel="noopener noreferrer"} describe the structure and location of data, while linked services define how to connect to data sources. Together, they abstract connection details from pipeline logic.

**Linked Services** authenticate and connect to data sources. They store connection strings, credentials (via Key Vault), and other connection metadata centrally.

**Common linked service types:**

| Service | Use Case |
|---------|----------|
| **Azure Storage** | Blob, Data Lake, File Share |
| **Azure SQL Database** | Transactional databases |
| **Azure Cosmos DB** | NoSQL document stores |
| **Synapse Analytics** | Dedicated and serverless SQL pools |
| **Azure Databricks** | Spark cluster execution |
| **On-premises SQL Server** | Hybrid via self-hosted integration runtime |
| **Salesforce, SAP, Dynamics** | SaaS applications |
| **HTTP, FTP** | File transfer protocols |
| **Snowflake** | Data warehouse (third-party) |

**Datasets** reference linked services and specify schema, file format, and table structure.

**Example dataset patterns:**
- Blob storage CSV with column definitions and delimiter
- Azure SQL table with schema and primary key
- Cosmos DB collection with partitioning key
- Parquet files with inferred schema

**Benefits of this abstraction:**
- Change connection details without modifying pipelines
- Reuse connections across multiple pipelines
- Centralize credential management via Key Vault
- Version datasets and track schema changes

### Integration Runtimes

[Integration runtimes](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime){:target="_blank" rel="noopener noreferrer"} are the compute infrastructure where Data Factory executes activities. Choosing the right integration runtime affects performance, cost, and connectivity.

#### Azure Integration Runtime

Azure IR is the default, serverless integration runtime hosted in Azure data centers.

**Characteristics:**
- Automatically provisioned and managed by Data Factory
- Scales automatically based on workload
- No compute management required
- Best for cloud-to-cloud integrations

**When to use:**
- Connecting Azure services to each other (Blob Storage → Synapse)
- Moving data between cloud services
- Running mapping data flows (transformed data in Azure)
- No on-premises connectivity needed

**Limitations:**
- Cannot access on-premises resources without self-hosted gateway
- Data movement over public internet (unless using managed virtual network)

#### Self-Hosted Integration Runtime

A self-hosted IR runs on your own infrastructure (VM, on-premises server, or container) and acts as a gateway for hybrid connectivity.

**Characteristics:**
- Runs on your hardware (VM, bare metal, Kubernetes)
- Enables access to on-premises data sources
- Supports large file transfers with local bandwidth
- More control over network and security (no cloud traversal)

**When to use:**
- Moving data from on-premises SQL Server, file shares, or legacy systems
- Sensitive data that cannot traverse public internet
- High-volume transfers where local bandwidth is more efficient
- Hybrid architectures spanning cloud and on-premises

**Deployment considerations:**
- Requires machine with .NET Framework 4.6.2 or higher
- Maintains persistent connectivity to Azure
- Can be clustered for high availability
- Logs execution within Azure Monitor

#### Azure-SSIS Integration Runtime

Azure-SSIS IR is a managed Spark cluster that runs SQL Server Integration Services (SSIS) packages.

**Characteristics:**
- Executes existing SSIS packages without rewriting
- Lift-and-shift migration path from on-premises SSIS
- Supports legacy ETL code and packages
- Can be paused to reduce costs

**When to use:**
- Migrating existing on-premises SSIS packages to cloud
- Complex ETL logic already written in SSIS
- Team expertise in SSIS development
- Integration with existing SSIS ecosystems

**Cost consideration:** Azure-SSIS charges per hour of cluster runtime. Pause clusters when not in use.

### Triggers and Scheduling

[Triggers](https://learn.microsoft.com/en-us/azure/data-factory/concepts-pipeline-execution-triggers){:target="_blank" rel="noopener noreferrer"} define when pipelines execute. Data Factory supports four trigger types.

**Schedule Trigger** (time-based execution):
- Executes pipelines at fixed intervals (hourly, daily, weekly)
- Suitable for recurring data loads

**Tumbling Window Trigger** (windowed, non-overlapping execution):
- Executes pipelines for fixed time windows (hourly, daily, monthly)
- Useful for batch processing where each window processes non-overlapping data
- Supports dependency (previous window must complete before next starts)

**Event-Based Trigger:**
- Executes when a file is created/deleted in Blob Storage or Data Lake
- Monitors specific folders for new files triggering ingestion
- Integrates with Azure Event Grid

**Manual Trigger:**
- Pipeline executes on-demand via API, portal, or PowerShell
- Useful for ad-hoc data loads or testing

**Multi-trigger pattern:**
Many data pipelines combine multiple triggers. For example, a primary schedule trigger with a fallback event-based trigger if files arrive outside the normal schedule.

### Data Flows and Transformations

[Mapping Data Flows](https://learn.microsoft.com/en-us/azure/data-factory/data-flow-create){:target="_blank" rel="noopener noreferrer"} are visually designed, serverless transformations that execute on Spark clusters within Data Factory.

**Mapping Data Flow capabilities:**
- **Source transformations:** Read from multiple sources with lineage tracking
- **Data transformation:** Filter, select, join, aggregate, pivot, derived columns
- **Schema mapping:** Define column mappings, type conversions, and renames
- **Multiple sinks:** Write transformed data to multiple destinations
- **Lineage:** Visual representation of data flow from source to sink

**When to use Mapping Data Flows:**
- Visual transformation design (no code required)
- Medium-complexity ETL (joins, filters, aggregations)
- Data validation and cleansing
- Schema transformation and column mapping

**When NOT to use Mapping Data Flows:**
- Heavy machine learning or statistical processing (use Databricks)
- Complex custom logic (use Synapse or Databricks notebooks)
- Very large-scale processing (Synapse is more cost-effective at petabyte scale)

**Alternative transformation options:**
- **Synapse SQL:** For SQL-based transformations on dedicated or serverless pools
- **Databricks notebooks:** For Spark-based Python or Scala transformations with ML libraries
- **Custom activities:** Call .NET applications, Docker containers, or REST APIs

---

## ETL vs ELT Patterns

Data Factory supports both ETL (extract, transform, load) and ELT (extract, load, transform) patterns depending on where transformation happens.

### ETL: Transform Before Loading

**Pattern:** Extract → Transform (in Data Factory or intermediate service) → Load to final destination

**Characteristics:**
- Data is transformed as it moves
- Only clean, transformed data lands in the data warehouse
- Mapping Data Flows handle transformations visually
- Suitable for smaller datasets or simple transformations

**Example pipeline:**
```
Extract from OLTP Database
  ↓
Mapping Data Flow (cleanse, validate, join with reference data)
  ↓
Load to Data Warehouse
```

**Advantages:**
- Final destination contains only valid, transformed data
- Reduces storage cost (no raw data copy)
- Simpler downstream reporting (data already clean)

**Disadvantages:**
- Transformation logic tied to load process
- Difficult to debug if transformation fails
- Cannot re-run transformation on loaded data without reloading source

### ELT: Load Then Transform

**Pattern:** Extract → Load to staging (as-is) → Transform (in warehouse/lake)

**Characteristics:**
- Raw data lands in a data lake or warehouse as-is
- Transformation happens in Synapse, Databricks, or the warehouse
- Data Factory moves data; the warehouse transforms
- Suitable for large-scale data or complex transformations

**Example pipeline:**
```
Extract from Data Source
  ↓
Copy Activity (move raw data to Data Lake)
  ↓
Synapse/Databricks (transform from raw to curated zone)
  ↓
Final Analytics Table
```

**Advantages:**
- Separation of concerns (movement vs. transformation)
- Raw data preserved for re-processing
- Transformation logic isolated in warehouse/analytics engine
- Easier debugging (raw data available for investigation)

**Disadvantages:**
- Requires storage for raw data (additional cost)
- Transformation latency (two-step process)
- More complex pipeline orchestration

### Hybrid Approach

Many architectures combine ETL and ELT:

```
Data Source
  ↓
Data Lake (landing zone)
  ↓
┌─ Mapping Data Flow (basic validation, schema normalization)
└─ Synapse/Databricks (complex transformations)
  ↓
Curated Data Lake
  ↓
Analytics/Reporting
```

**Rationale:**
- Quick validation and schema standardization in Data Factory
- Complex analysis and feature engineering in warehouse/lake
- Raw data preserved for audit and reprocessing

---

## Architecture Patterns

### Data Lake Ingestion Pipelines

A common pattern separates data into zones as it flows through the architecture.

**Landing Zone (raw):**
- Raw data copied as-is from source
- No transformation, no schema enforcement
- Used for audit and reprocessing if needed

**Raw/Bronze Zone:**
- Data validated and schema standardized
- Duplicates removed, nulls handled
- Metadata added (ingestion timestamp, source system)

**Curated/Silver Zone:**
- Business rules applied (filtering, enrichment, joining with reference data)
- Optimized for analytics
- Accessible to analysts and BI tools

**Analytics/Gold Zone:**
- Aggregated, summarized data for reporting
- Pre-computed metrics and dimensions
- Optimized for specific use cases

**Pipeline orchestration:**

```
Data Source A ──→ Copy to Landing A
Data Source B ──→ Copy to Landing B
Data Source C ──→ Copy to Landing C
     ↓
All Landing Zones ──→ Data Flow (validation, standardization) ──→ Raw Zone
     ↓
Raw Zone ──→ Synapse/Databricks (business logic) ──→ Curated Zone
     ↓
Curated Zone ──→ Aggregations (SQL, Data Flow) ──→ Analytics Zone
```

**Governance considerations:**
- Landing zone is immutable (write-once)
- Raw zone is incremental append-only
- Curated zone is updated daily or per schedule
- Retention policies differ by zone (landing: 30 days; raw: 1 year; curated: ongoing)

### Incremental Loading with Watermarks

Watermark patterns enable efficient incremental data movement without processing the entire dataset each run.

**High-water mark approach:**
- Track the last modified timestamp from the source
- Store the marker in Data Factory (variable, metadata table, or external store)
- Next run loads only data modified since the marker
- Reduces volume transferred and speeds up load

**Example:** Loading new records from a transactional database:
- Lookup activity queries metadata table for `LastLoadTime`
- Copy activity filters source: `WHERE ModifiedDate > @LastLoadTime`
- After successful load, update metadata table with new `LastLoadTime`

**Change Data Capture (CDC) approach:**
- Some sources (SQL Server, Oracle) provide CDC logs
- Capture only inserted, updated, and deleted records
- More accurate than timestamp-based (handles deletes)
- Requires source system support

**Advantages:**
- Reduces data movement volume
- Faster incremental loads
- Lower cloud egress costs
- Scaling from daily to hourly loads becomes feasible

### Hybrid Data Integration

Self-hosted integration runtimes enable pipelines that span on-premises and cloud.

**Architecture pattern:**

```
On-Premises SQL Server
     ↓ (Self-Hosted IR as gateway)
Azure Data Factory
     ↓
Azure Data Lake
     ↓
Synapse Analytics
```

**Considerations:**
- Self-hosted IR must have network access to on-premises sources
- Data traverses corporate network (no internet egress)
- Ideal for regulated data (healthcare, finance)
- Supports heterogeneous environments (legacy systems + cloud)

### Parameterized Pipelines and Metadata-Driven Frameworks

Metadata-driven design enables one pipeline to handle many data sources by reading source definitions from a configuration table.

**Metadata table structure:**
| SourceName | SourcePath | TargetPath | Delimiter | KeyColumn | Schedule |
|------------|-----------|-----------|-----------|-----------|----------|
| CustomerData | /raw/customers/ | /curated/customers/ | comma | CustomerId | daily |
| OrderData | /raw/orders/ | /curated/orders/ | comma | OrderId | hourly |
| ProductCatalog | /raw/products/ | /curated/products/ | pipe | ProductId | weekly |

**Pipeline logic:**
1. Lookup activity reads metadata table
2. ForEach loop iterates over each source configuration
3. Within loop, dynamic Copy activity uses parameters: `@item().SourcePath`, `@item().Delimiter`
4. Single pipeline code handles all sources; scaling means adding rows to metadata table

**Advantages:**
- Scales to hundreds of data sources without adding pipeline code
- Adding new sources requires metadata entry, not pipeline modification
- Consistent error handling and retry logic across all sources
- Easier to modify source behavior globally

### Parent-Child Pipeline Patterns

For complex orchestration, parent pipelines invoke child pipelines as activities.

**Use cases:**
- Sharing common logic (validation, error handling) across multiple pipelines
- Sequential execution of interdependent jobs
- Monitoring and troubleshooting at logical boundaries

**Example:**

```
Parent Pipeline (Master Orchestrator)
  ├─ Execute Child: Ingest Customer Data
  ├─ Execute Child: Ingest Order Data
  ├─ Execute Child: Ingest Product Data
  └─ Execute Child: Run Analytics Job (depends on above)
```

**Benefits:**
- Reusable child pipelines reduce code duplication
- Clear dependencies between logical phases
- Easier troubleshooting (which child pipeline failed?)

---

## Integration with Azure Services

### Synapse Analytics

Data Factory integrates deeply with [Synapse Analytics](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is){:target="_blank" rel="noopener noreferrer"}.

**Data Factory role:**
- Pipelines orchestrate data movement into Synapse
- Copy activities load data into dedicated or serverless SQL pools
- Lookup activities query Synapse to retrieve metadata
- Synapse SQL executes complex transformations and analytics

**Example pipeline:**

```
Data Lake ──Copy──→ Synapse Dedicated Pool
                          ↓
                    Stored Procedure
                          ↓
                    Analytic Query
```

**Synapse linked service configuration:**
- Connection to Synapse endpoint
- Authentication (SQL auth or managed identity)
- Staging settings for PolyBase (optimizes bulk load)

### Azure Databricks

Data Factory triggers and orchestrates Databricks jobs.

**Integration patterns:**
- Notebook activity: Execute Databricks Python or SQL notebooks
- Spark Job activity: Submit Spark jobs to Databricks clusters
- Databricks linked service: Authenticate to Databricks workspaces

**Example pipeline:**

```
Data Lake (staging)
     ↓
Execute Databricks Notebook
(PySpark: feature engineering, ML transformations)
     ↓
Data Lake (curated)
```

**When to use Databricks with Data Factory:**
- ML pipeline orchestration (feature engineering, model scoring)
- Complex transformations beyond SQL
- Existing Databricks investments
- Heterogeneous compute (CPUs, GPUs for different workloads)

### Azure SQL Database and Cosmos DB

Data Factory pipelines load transformed data into transactional and NoSQL stores.

**Common patterns:**
- **Azure SQL:** Operational databases, application stores
- **Cosmos DB:** Global distribution, multi-model support, high throughput

**Integration considerations:**
- Linked services store connection strings and credentials
- Copy activity uses batch inserts for SQL (PolyBase not available)
- Cosmos DB throughput provisioning affects cost (monitor RU consumption)

### Blob Storage and Data Lake Storage Gen2

Data Factory orchestrates data movement into lake storage.

**Storage linked service patterns:**
- Connection string (legacy, not recommended)
- Managed identity (recommended for security)
- Storage account key (shared key; use with Key Vault)

**Data Lake zone structure:**
- `/landing/` for raw data
- `/raw/` for validated data
- `/curated/` for business-ready data
- `/archive/` for historical data

### Key Vault Integration

Data Factory integrates with [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"} to securely store and retrieve credentials.

**Security pattern:**
- Connection strings and passwords stored in Key Vault
- Data Factory linked services reference Key Vault secrets
- No credentials visible in pipeline code or logs
- Audit trail of secret access via Key Vault activity logs

**Configuration:**
- Create linked service to Key Vault
- In other linked services, reference Key Vault secrets: `@linkedService('AzureKeyVault').getSecret('sql-password')`

### Azure Monitor Integration

Data Factory pipelines integrate with Azure Monitor for observability.

**Metrics and logs:**
- Pipeline run status, duration, and activity counts
- Activity-level metrics (rows read/written, duration)
- Error details and failure reasons
- Custom metrics via webhook activity

**Monitoring patterns:**
- Workbook: Custom dashboard of pipeline health
- Alerts: Metric alerts on pipeline failure rate
- Log queries: Investigate specific pipeline runs via KQL

---

## Cost Considerations

Data Factory pricing has multiple dimensions. Understanding the cost drivers enables optimization.

### Pricing Components

**Pipeline orchestration:** Per pipeline run (low cost; typically $0.001-0.01 per run)

**Data movement (Copy activity):** Per Data Integration Unit (DIU)-hour; scaling with data volume and complexity

**Data flow execution:** Per virtual core-hour (more expensive than copy activity)

**Integration runtime hours:**
- Azure IR: Included (no separate charge)
- Self-hosted IR: VM costs (you provision the VM)
- Azure-SSIS IR: Per cluster hour (pause when not needed)

### Cost Optimization Strategies

**Right-size integration runtimes:**
- Use Azure IR for cloud-to-cloud
- Use self-hosted IR only for on-premises requirements
- Azure-SSIS: Pause between scheduled runs to reduce hours

**Optimize copy activities:**
- Use PolyBase in Synapse for large loads (lower DIU consumption)
- Compress data in transit to reduce egress
- Parallelize multiple copies via ForEach

**Limit data flow usage:**
- Use Synapse or Databricks for complex transformations (more cost-effective at scale)
- Use mapping data flows for simple validation and schema mapping only

**Incremental loading:**
- Watermark patterns reduce volume moved per run
- Incremental copy reduces data scanned at source

**Schedule optimization:**
- Consolidate small pipelines into fewer, larger runs
- Avoid excessive polling (event-based triggers cheaper than frequent schedules)

### Relative Cost Positioning

In relative terms:
- Copy activity (data movement): Baseline cost
- Mapping data flow: 3-5x copy activity cost
- Self-hosted IR: VM compute cost (varies by size)
- Synapse transformation: More cost-effective than data flow for large volumes
- Azure-SSIS: Highest cost for equivalent functionality; avoid unless legacy SSIS packages require it

---

## AWS Glue Comparison Table

Architects familiar with AWS Glue should understand these differences:

| Dimension | AWS Glue | Azure Data Factory |
|-----------|----------|---|
| **Orchestration** | Job-centric; limited multi-job workflows | Pipeline-centric; rich control flow and dependencies |
| **Transformation options** | Spark jobs (PySpark, Scala); limited built-in | Mapping Data Flow, Synapse SQL, Databricks, custom |
| **Data sources** | 70+ connectors; custom scripts | 90+ pre-built connectors; broader coverage |
| **Scheduling** | Time-based rules; event integration via EventBridge | Schedule, tumbling window, event, manual triggers |
| **Data movement** | Spark-based; good for ETL | Optimized Copy activity for movement |
| **Visual authoring** | Studio for job creation | Full visual pipeline and data flow designer |
| **Hybrid connectivity** | Limited (requires VPN or ExpressRoute) | Native via self-hosted integration runtime |
| **Pricing model** | Per DPU-hour (dynamic provisioning) | Per pipeline run + DIU-hours + data flow hours |
| **Cost at scale** | Transparent; scales with Spark cluster | Can be opaque without monitoring DIU consumption |
| **Monitoring** | CloudWatch Logs; limited native visibility | Azure Monitor; rich workbooks and KQL queries |
| **Infrastructure as Code** | CloudFormation, Terraform | Azure Resource Manager, Terraform, Bicep |
| **Lift-and-shift from on-prem** | Requires rewriting | Azure-SSIS IR enables SSIS package migration |

---

## Common Pitfalls

### Pitfall 1: Using Data Flows for Large-Scale Transformations

**Problem:** Building complex transformations entirely in mapping data flows, expecting them to scale like Spark.

**Result:** High costs and slow performance compared to dedicated analytics engines.

**Solution:** Use mapping data flows for schema mapping and validation. Offload complex transformations and heavy processing to Synapse SQL pools or Databricks where costs scale better and execution is faster.

---

### Pitfall 2: Not Implementing Incremental Loading

**Problem:** Copying entire datasets on every run without watermarks or incremental logic.

**Result:** Unnecessary data movement, higher costs, slower pipelines as volumes grow.

**Solution:** Implement watermark patterns or change data capture to load only new or modified data. Store watermarks in a metadata table or Data Factory variables.

---

### Pitfall 3: Ignoring Integration Runtime Placement

**Problem:** Running on-premises connectivity through Azure IR, or provisioning expensive self-hosted IR unnecessarily.

**Result:** Data crosses internet unnecessarily; compliance issues; excessive costs.

**Solution:** Use self-hosted IR for on-premises sources (data stays on corporate network). Use Azure IR for cloud-to-cloud movement only. Cluster self-hosted IR for high availability.

---

### Pitfall 4: Over-Engineering with Metadata-Driven Frameworks

**Problem:** Building complex metadata-driven architecture for five data sources, adding operational overhead.

**Result:** Added complexity without proportional benefit; difficult to troubleshoot.

**Solution:** Start with explicit pipelines. Migrate to metadata-driven architecture when source count exceeds 10-15 and benefits justify the added complexity.

---

### Pitfall 5: No Monitoring or Cost Control

**Problem:** Creating pipelines without tracking costs or monitoring performance.

**Result:** Cost surprises; pipeline failures go unnoticed; inefficient execution.

**Solution:** Set up Azure Monitor alerts on pipeline failures. Create workbooks tracking DIU consumption and pipeline duration. Set budget alerts on Data Factory resource.

---

### Pitfall 6: Storing Credentials in Pipelines

**Problem:** Embedding connection strings or passwords in pipeline definitions or variables.

**Result:** Security risk; audit trail compromised; secrets in version control.

**Solution:** Store all secrets in Key Vault. Reference via Key Vault linked service in pipeline code. Audit Key Vault access via Azure Monitor.

---

## Key Takeaways

1. **Data Factory is an orchestration platform, not a transformation engine.** It connects sources, triggers transformations, and ensures reliable data flow. Offload complex transformations to Synapse or Databricks.

2. **Choose the right integration runtime.** Azure IR for cloud-to-cloud, self-hosted IR for on-premises access, Azure-SSIS only for legacy SSIS packages.

3. **Pipelines orchestrate activities with dependencies and control flow.** Use Lookup for parameterization, ForEach for iteration, If for branching, and Execute Pipeline for multi-level orchestration.

4. **Datasets and linked services abstract connection details.** Store credentials in Key Vault, define schemas once, and reuse across pipelines.

5. **Support both ETL and ELT patterns as architecture demands.** ETL for smaller data or simple transformations; ELT for larger volumes where raw data preservation and warehouse-native transformation make sense.

6. **Implement incremental loading with watermarks or CDC.** Don't re-copy entire datasets; scale efficiently by moving only new or changed data.

7. **Data lake zone architecture provides governance and auditability.** Landing (raw), raw (validated), curated (business-ready), and analytics (aggregated) zones serve different purposes.

8. **Cost optimization requires monitoring DIU consumption, data flow usage, and integration runtime hours.** Synapse and Databricks are more cost-effective for large-scale transformations than mapping data flows.

9. **Metadata-driven frameworks scale to many sources but add operational overhead.** Start with explicit pipelines; migrate when volume justifies the complexity.

10. **Monitor everything via Azure Monitor.** Track pipeline failures, DIU consumption, integration runtime health, and cost trends. Integrate with Key Vault for secure credential management and audit trails.
