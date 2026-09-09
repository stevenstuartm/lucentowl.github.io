---
title: "Modern Data Architecture on Azure"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Data architecture patterns on Azure: the lakehouse, medallion layering, and data mesh, built on Data Lake Storage, Synapse, Databricks, Microsoft Fabric, and Purview."
tags: [lakehouse, medallion-architecture, data-mesh, microsoft-fabric, delta-lake, governance, practical]
---

## What Is Modern Data Architecture

[Modern data architecture on Azure](https://learn.microsoft.com/en-us/azure/architecture/data-guide/){:target="_blank" rel="noopener noreferrer"} represents a fundamental shift from traditional monolithic data warehouses to distributed, cloud-native patterns. The evolution reflects how organizations now capture vast volumes of data across many sources, require real-time insights alongside historical analysis, and need flexible, self-service access to data across teams.

Azure's data platform provides a complete ecosystem: storage layers like Data Lake Storage Gen2, compute engines ranging from SQL-based Synapse to Spark-based Databricks, unified platforms like Microsoft Fabric, and governance tools like Purview. These components work together to solve problems that traditional data warehouses could not address: scale, flexibility, governance, and cost efficiency.

### What Problems Modern Data Architecture Solves

**Without modern data architecture:**
- Data warehouses become bottlenecks as raw data volume grows
- Rigid schema requirements delay new data sources and analytics use cases
- Data quality issues propagate downstream without clear ownership
- Teams duplicate data movement and transformation effort
- Cost scales linearly with data volume because storage and compute are tightly coupled
- Regulatory compliance becomes fragmented across disconnected systems
- Real-time and batch processing require separate infrastructure

**With modern data architecture:**
- Separate storage (cheap, infinite capacity) from compute (pay per use)
- Support both structured warehouse queries and unstructured exploration in the same platform
- Clear data quality gates and ownership through layered architecture
- Reusable, governed data products shared across teams
- Cost-effective at any scale with ability to pause or scale compute independently
- Unified governance, quality, and lineage tracking across all data
- Lambda or kappa architecture enables both real-time and batch in a single platform

### How Azure Compares to AWS

| Concept | AWS | Azure |
|---------|-----|-------|
| **Data lake storage** | S3 + Glue for metadata | Data Lake Storage Gen2 (hierarchical namespace, fine-grained ACLs) |
| **ETL orchestration** | Glue, Step Functions | Data Factory, Synapse Pipelines |
| **SQL analytics** | Redshift, Athena | Synapse Analytics (dedicated and serverless) |
| **Spark processing** | EMR, Glue | Databricks (first-party partnership), Synapse Spark |
| **Unified platform** | Separate services | Microsoft Fabric (integrates OneLake, Spark, SQL, Power BI) |
| **Data governance** | AWS Glue Data Catalog, Lake Formation | Microsoft Purview (Data Map scanning and classification, Unified Catalog for discovery and lineage) |
| **Stream processing** | Kinesis, Lambda | Event Hubs, Stream Analytics, Apache Kafka and Apache Flink on Confluent Cloud |
| **BI and visualization** | Amazon Quick Sight (part of Amazon Quick Suite) | Power BI (deeply integrated with the data platform) |

---

## Evolution of Data Architecture

### Traditional Data Warehouse (1990s-2010s)

The traditional data warehouse centered around SQL Server, Teradata, or Oracle. Data was extracted from source systems, transformed into normalized schemas, and loaded into the warehouse using scheduled ETL processes. All analysis happened through SQL queries against these structured tables.

**Characteristics:**
- Schema-on-write: Structure defined before data arrives
- Upfront modeling cost: Data analysts had to agree on dimensions and facts before loading
- Strong ACID guarantees and referential integrity
- Expensive storage limited data retention to 2-3 years
- Batch processing only; real-time analytics required separate systems
- Tight coupling of storage and compute; scaling one forced scaling the other

**Problems this caused:**
- New data sources or use cases required schema changes
- Raw or exploratory data had nowhere to live
- As data volume exploded, costs became prohibitive
- Data quality issues discovered in the warehouse required tracing back to extract logic

### Data Lake (2010s-2015)

Hadoop and cloud storage (S3, HDFS) enabled a new pattern. Organizations could store unlimited raw data cheaply, then apply processing and structure on demand.

**Characteristics:**
- Schema-on-read: Data stored as-is; structure applied during query
- Cheap, unlimited storage for any data type (raw files, logs, unstructured content)
- Flexible compute with Spark, MapReduce, and other frameworks
- No upfront commitment to structure or schema
- But: data quality issues, duplicate work, governance became harder

**Trade-offs:**
- Powerful for exploration and handling diverse data sources
- But created "data swamps" where nobody knew what data meant or where it came from
- Harder to enforce quality gates and track data lineage
- Organizations still needed separate warehouses for reliable analytics

### Data Lakehouse (2015-Present)

The lakehouse pattern combines the economics of data lakes with the structure and governance of warehouses. Instead of forcing data into rigid schemas, the lakehouse uses metadata layers, quality gates, and storage formats that support both fast SQL queries and Spark processing.

**How it works:**
- Raw data lands in a "bronze" layer with minimal transformation
- A "silver" layer applies business rules, quality checks, and conformation
- A "gold" layer provides business-ready data for consumption
- Tools like Delta Lake add ACID transactions and schema enforcement to Parquet files
- Metadata systems (like Hive Metastore or Unity Catalog) track schema, lineage, and governance

**Why it matters:**
- Data can be stored once in cost-effective cloud storage
- Multiple tools (SQL, Spark, Python) can access the same data
- Quality gates are applied consistently across all data
- Historical data is retained without prohibitive cost
- Real-time streaming and batch processing happen on the same data foundation

---

## Medallion Architecture

The medallion architecture organizes data into three layers, each with increasing structure and business value. This pattern scales from simple organizations to enterprise data platforms.

### Bronze Layer: Raw Ingestion

The bronze layer is the landing zone for all incoming data. Data arrives with minimal transformation, preserving the original structure exactly as it came from the source system.

**Characteristics:**
- Raw data files (JSON, Parquet, CSV) or streamed events land here
- No transformation beyond what's required to land the data (schema validation, format conversion)
- Maintains a full audit trail: original file name, ingestion timestamp, source system
- Cheap to store; no need to delete data once it lands
- Tools: Azure Data Lake Storage Gen2 with Data Factory or Synapse copy activities

**Why this layer matters:**
- Preserves original data for debugging and compliance
- Allows consumers to replay data if transformation logic changes
- Eliminates tight coupling between source systems and downstream analysis
- Enables new use cases without re-extracting from sources

### Silver Layer: Cleansed and Conformed

The silver layer applies business rules, quality checks, and data standardization. Data is cleaned, duplicates removed, and conformed to consistent formats.

**Characteristics:**
- Removes duplicates and handles late-arriving data
- Standardizes date formats, naming conventions, and measurement units
- Joins related data to provide more complete records
- Applies data quality rules and flags suspicious values
- Adds or updates slowly-changing dimensions (SCD) for time-based tracking
- Tools: Synapse Spark pools, Databricks, Data Factory with transformation logic

**Example transformations:**
- Raw JSON events with timestamp as milliseconds → standardized UTC datetime
- Customer data from multiple source systems → deduplicated golden record
- Sales transactions → cleaned and validated with quality checks
- Inventory updates → slowly-changing dimension tracking historical values

**Why this layer matters:**
- Centralizes quality logic so it applies consistently to all downstream use cases
- Enables self-service analytics by ensuring data consumers work with clean, governed data
- Simplifies downstream logic because edge cases are handled here
- Creates reusable, high-quality data products

### Gold Layer: Business-Ready Data

The gold layer serves aggregated, business-ready data optimized for specific use cases. Data is structured for consumption by dashboards, reports, and analytical queries.

**Characteristics:**
- Pre-computed aggregations for common queries (daily sales by region, monthly churn by cohort)
- Dimensional models designed for BI consumption (star schema, snowflake schema)
- Optimized for read performance and query cost
- Tools: Synapse SQL pools, Power BI datasets, Databricks SQL
- Often follows dimensional modeling (facts and dimensions) or subject-area organization

**Example gold tables:**
- `dim_customer`: Customer master data with effective dates and business keys
- `fact_sales`: Grain at transaction level with foreign keys to dimensions
- `agg_monthly_revenue`: Pre-computed monthly revenue by region, product, customer segment
- `mart_churn_analysis`: Customer cohort data with churn indicators

**Why this layer matters:**
- BI and analytics tools query smaller, pre-computed tables instead of scanning raw data
- Significantly reduces query cost and improves query latency
- Different teams can have gold layers optimized for their specific needs
- Clear handoff point between data engineers (maintaining silver and gold) and analysts (consuming gold)

### Medallion Architecture in Azure Services

| Layer | Primary Storage | Processing | Result |
|-------|-----------------|------------|--------|
| **Bronze** | Data Lake Storage Gen2 | Data Factory copy, Stream Analytics | Raw files, unchanged |
| **Silver** | Data Lake Storage Gen2 | Synapse Spark, Databricks | Parquet files with quality gates |
| **Gold** | Data Lake Storage Gen2 + Synapse SQL | Synapse SQL, Spark aggregations | Star schema, optimized for BI |

Batch and streaming sources converge on the same three layers, and each layer serves a different set of consumers:

```
  Batch sources                Stream sources
  (databases, SaaS,            (Event Hubs, IoT Hub,
   flat files, APIs)            CDC feeds)
        │                             │
        │  Data Factory copy          │  Stream Analytics,
        │  activities, scheduled      │  Structured Streaming,
        │  or event-triggered         │  Eventstream
        └──────────────┬──────────────┘
                       ▼
                    BRONZE ──────────────▶ replay, audit, compliance
                 raw, append-only,         (re-run silver logic against
                 source structure           the original bytes)
                 preserved
                       │  dedupe, conform, quality rules
                       ▼
                    SILVER ──────────────▶ data science, exploratory
                 cleansed, conformed,      Spark and SQL
                 one row per entity
                       │  aggregate, dimensional model
                       ▼
                     GOLD ──────────────▶ Power BI semantic models,
                 star schemas,             reports, downstream apps
                 pre-computed marts
```

The medallion architecture works because each layer is independent. You can rebuild silver without reprocessing bronze. You can create new gold tables without changing silver. Data flows top-to-bottom through quality gates, but consumers query the layer that matches their tolerance for raw data.

---

## Azure Data Platform Components

### Azure Data Lake Storage Gen2 (Foundation)

Data Lake Storage Gen2 is not a separate service or account type. It is a set of capabilities you unlock on a normal Azure Storage account by enabling the **hierarchical namespace** setting, so everything Blob Storage offers (access tiers, lifecycle management, immutability policies, the full redundancy matrix) still applies.

**Key capabilities:**
- The hierarchical namespace gives you real directories instead of flat object paths, so renaming or deleting a directory is a single atomic metadata operation rather than an enumeration of every blob sharing a prefix
- The ABFS driver exposes the account over the `dfs.core.windows.net` endpoint, which makes it Hadoop-compatible and directly readable by Spark, Presto, and similar engines
- Azure RBAC covers coarse-grained access at the account and container level; POSIX ACLs cover individual directories and files
- The storage firewall restricts the public endpoint through four rule types: virtual network rules on subnets with a storage service endpoint, IP ranges, resource instance rules for Azure resources that cannot be isolated by network, and trusted-service exceptions
- Data at rest is always encrypted, with Microsoft-managed or customer-managed keys

**The ACL limit that shapes your design:** each file and directory holds a maximum of **32 ACL entries** (four are reserved, leaving roughly 28 usable), and access ACLs and default ACLs each get their own 32-entry budget. Assigning individual users or service principals burns through that budget quickly and forces a recursive re-apply every time someone joins or leaves. Always put a Microsoft Entra security group in the ACL entry and manage membership in Entra instead.

ACL inheritance is also not what most readers expect. A *default* ACL on a directory is a template applied to children created **after** it is set. Existing children keep whatever they had, so changing permissions on a populated tree means a recursive update, not a single write at the top.

**When to use:**
- Foundation for any medallion architecture (all three layers can live in one account, separated by container or directory)
- Cost-effective storage for historical data at any volume
- Primary storage for data lakes and lakehouses, including as the physical store behind Fabric OneLake

### Azure Data Factory (Orchestration)

Data Factory is Azure's managed ETL service, providing visual workflow design, scheduling, and error handling for data movement and transformation.

Every current Data Factory documentation page carries a successor notice naming **Data Factory in Microsoft Fabric** as "the next generation of Azure Data Factory" and directing new work there, while offering existing estates an upgrade path. Azure Data Factory is not retired and has no announced end date, so read this as a signal about where new build should start rather than as a migration deadline.

**Capabilities:**
- A broad connector library spanning on-premises databases, SaaS applications, other clouds, and Azure services (Microsoft publishes no stable count, so verify the specific connector you need against the connector overview)
- Visual pipeline designer for non-developers
- Exactly three trigger types: schedule, tumbling window, and event-based (storage events plus Event Grid custom events). Running a pipeline by hand is not a trigger type
- Copy activity for bulk data movement with automatic partitioning
- Lookup, filter, and conditional branching for dynamic pipelines
- Monitoring and alerting on pipeline execution

**Tumbling window is the trigger a data platform usually needs.** It is the only one that supports backfill, retry policies, concurrency limits, and window start/end variables, and the only one that waits for the pipeline run to finish rather than reporting success the moment it starts. A schedule trigger firing hourly gives you neither historical replay nor a guarantee that yesterday's run completed before today's began.

**When to use:**
- Bronze layer: scheduled or event-driven ingestion from source systems
- Silver layer: orchestrating Spark transformations in Synapse or Databricks
- Data movement between cloud services or hybrid environments

**Trade-offs:**
- Lower code overhead than writing Spark transformations
- Less flexible for complex transformation logic, which belongs in Spark
- Billing is per **activity** run, not per pipeline run, plus DIU-hours for copy activities on an Azure integration runtime and vCore-hours for data flows. Data flow **debugging** bills at the same vCore rate as execution, which is the line item that tends to surprise teams during development

### Azure Synapse Analytics (SQL + Spark)

Synapse Analytics combines dedicated SQL pools (comparable to Redshift), serverless SQL pools (comparable to Athena), and Spark pools in one service over shared storage.

Every Synapse SQL documentation page carries a successor notice naming **Microsoft Fabric Data Warehouse** as the destination for new warehousing work, with a documented upgrade path and a migration assistant for dedicated pools. Synapse is not retired and has no announced end date, but a greenfield warehouse started on a dedicated pool today is being started on the older of two supported products.

**Dedicated SQL pools:**
- Provisioned compute for predictable performance, which suits a production gold layer
- Materialized views are maintained automatically and synchronously, and the optimizer uses them without the query referencing them
- Every table is spread across exactly **60 distributions** (hash, round-robin, or replicated), fixed at creation. Scaling changes the number of compute nodes, roughly DWU divided by 500, never the distribution count
- Concurrent query execution caps at **128** and stops rising above DW6000c, so adding DWUs to a concurrency problem eventually does nothing
- Result set caching is dedicated-pool only, **off by default**, capped at 1 TB per database, and cache hits consume no concurrency slot
- Cost: per DWU-hour, and the pool can be paused

**Serverless SQL pools:**
- Query files in Data Lake Storage without loading them into a warehouse
- Read-only apart from CETAS. No DML, no tables, no materialized views, no triggers, and DDL limited to views and security objects
- Reads Delta but cannot write it or time travel, and has a **30-minute query timeout that cannot be raised**
- Billing is *data processed*, meaning storage reads plus **uncompressed** intermediate transfer plus CETAS writes, rounded up per megabyte with a 10 MB minimum per query. A `SELECT *` against a 1 TB Parquet table compressed 5:1 can process around 6 TB
- There is no result set caching, so a repeated query is billed again every time
- Cost budgets, set in TB per day, week, or month, reject the **next** query. They never terminate a query already running

**Spark pools:**
- Distributed Spark clusters for transformation and ML
- Notebook-based interactive development in Python, Scala, SQL, and .NET
- Billed per node-hour, with auto-pause after a configurable idle period

**When to use Synapse:**
- SQL analytics: dedicated pools for consistent gold-layer serving, serverless for ad-hoc exploration of lake files
- Transformation: Spark pools for silver-layer processing
- Unified workspace: query Spark and SQL data in the same environment

**Trade-offs:**
- More Azure-integrated than open-source alternatives
- Dedicated pools require capacity planning. Serverless is elastic but harder to budget, because cost tracks bytes processed rather than time
- The Fabric successor notice means new product investment is going elsewhere

### Azure Databricks (Spark + ML)

Azure Databricks is a first-party managed Spark platform, sold and supported through Azure rather than through the Marketplace, providing distributed computing for transformations, ML, and analytics.

**Key capabilities:**
- Managed Spark clusters that scale automatically, plus serverless SQL warehouses
- Delta Lake for ACID transactions and schema enforcement over files in the lake
- Unity Catalog as the governance layer for data and AI assets across workspaces
- Notebooks for interactive development and documentation
- Jobs for scheduled transformations and ML training
- MLflow-backed experiment tracking, model registry, and model serving

**Unity Catalog is no longer an add-on decision.** It is enabled automatically for every Azure Databricks workspace created after **9 November 2023**, and older workspaces have a documented upgrade path. Objects follow a three-level `catalog.schema.object` namespace, tables and volumes are either *managed* (Unity Catalog owns governance and the file lifecycle) or *external* (governance only), and managed tables use Delta or Iceberg. Access control, lineage, audit logging, data classification, and quality monitoring all hang off that one layer, so a design that treats governance as a later phase is designing against the product.

**The pricing tier decision has an expiry date.** Azure Databricks announced end of life for **Standard tier** workspaces. Existing workspaces have until **1 October 2026** to move to Premium, and anything left is upgraded automatically on that date. Any guidance that still weighs Standard against Premium is planning around a tier that is going away.

**When to use Databricks:**
- Silver layer: complex transformations and quality checks
- ML workloads: feature engineering, model training, batch inference
- Multi-workspace governance: Unity Catalog spans workspaces and regions in a way per-workspace metastores cannot
- Data science and AI: integrated ML tooling and environments

**Trade-offs:**
- More expensive than Synapse Spark for straightforward SQL work
- More capable for ML and Python-heavy workloads
- A second platform to staff, secure, and network alongside whatever else you run

### Microsoft Fabric (Unified Platform)

Microsoft Fabric is a SaaS analytics platform that puts storage, Spark, SQL, real-time processing, and Power BI on one shared compute and storage model. It is billed through Azure capacity (F SKUs) rather than as a set of separately provisioned services.

**Workloads:**
- **Data Factory**: pipelines and dataflows for ingestion and orchestration
- **Data Engineering**: Spark notebooks, jobs, and lakehouses
- **Data Warehouse**: SQL analytics with dimensional modeling, storing natively in Delta
- **Data Science**: model development with built-in experiment tracking and model registry
- **Real-Time Intelligence**: eventstreams, eventhouses, and KQL for data in motion. **Activator** (formerly Data Activator) is the event-detection and rules engine inside this workload, not a separate one
- **Databases**: operational SQL and mirrored databases, replicating sources such as Azure SQL, Cosmos DB, Databricks, and Snowflake into OneLake
- **Power BI**: reporting and semantic models over the same data
- **Industry Solutions** and **Fabric IQ** (preview) round out the current list

**OneLake** is the storage layer beneath all of them, built on ADLS Gen2 and provisioned automatically with the tenant. Two features do most of the architectural work:

- **Shortcuts** give zero-copy access to data that stays where it is, including ADLS Gen2, Amazon S3, Google Cloud Storage, and other OneLake locations. A lakehouse can present external data as its own tables without an ingestion pipeline
- **Metadata virtualization** converts between Delta Lake and Apache Iceberg automatically, so an Iceberg table written by another engine reads as Delta inside Fabric, and Fabric's Delta tables read as Iceberg from outside. The feature currently targets Iceberg V2, requires source tables under 5,000 commits, and takes seconds to a couple of minutes to reflect a change

Governance is not a separate purchase. Permissions, sensitivity labels, and auditing are powered by Microsoft Purview, and the **OneLake Catalog** is the tenant-wide surface for discovering and governing Fabric items.

**When to use Fabric:**
- Greenfield data platforms, particularly where the Synapse and ADF successor notices point
- Organizations already invested in Microsoft 365, SQL Server, and Power BI
- Teams that want BI tightly coupled to data engineering rather than integrated after the fact
- Workloads that benefit from Direct Lake, where Power BI reads Delta files in OneLake directly instead of importing or querying through DirectQuery

**Trade-offs:**
- Capacity sizing constrains the design, not just the invoice. Semantic model size limits scale with the F SKU, and F64 is the threshold below which every viewer still needs a Pro or PPU license
- A commitment to the Microsoft stack, with less component-level choice than Synapse plus Databricks
- Newer than Synapse and Databricks, and still moving quickly enough that feature availability should be verified against the docs rather than assumed

### Microsoft Purview (Governance)

Purview provides data discovery, classification, and lineage across the estate, covering Data Lake Storage, SQL databases, Synapse, Databricks, Power BI, and third-party systems.

**Purview has two generations, and the older one is closed to new customers.** Microsoft Purview **Data Catalog (classic)**, **Data Health Insights (classic)**, and **Purview Workflow (classic)**, the products previously branded Azure Purview, are no longer taking on new customers and sit in customer support mode. Their documentation now lives under a `/purview/legacy/` path, which is the reliable tell. The current experience is **Unified Catalog** in the Microsoft Purview portal. Any design that names the classic governance portal at `web.purview.azure.com` is naming the previous product.

**Data Map is the layer that survived.** It is still the PaaS scanning and classification engine that keeps an inventory of assets, their metadata, and their lineage, and it is what Unified Catalog runs on top of. Scanning, classification rules, and automated lineage capture are Data Map concerns.

**Unified Catalog** adds the governance model on top:

| Concept | What it does |
|---------|--------------|
| **Governance domains** | A boundary that aligns the catalog to the business (Finance, Marketing), effectively a mini-catalog per domain |
| **Data products** | A named bundle of related assets (tables, files, reports) so consumers request one thing instead of fifteen tables |
| **Critical data elements** | A logical grouping of the same concept across systems, mapping `CustID` and `CID` to one "Customer ID", with quality rules and access policies attached |
| **Glossary terms** | Business vocabulary that carries policy, so terms applied to a data product propagate to its assets |
| **Access policies** | Self-service access requests against data products, rather than hand-provisioned permissions at each source |
| **Health controls and actions** | A governance score plus the concrete steps that improve it |
| **Data quality** | Rules and scores at asset, data product, and governance domain level |

Governance domains and data products map onto a data mesh almost one-to-one, which is why Unified Catalog is the piece that makes federated ownership tractable rather than just distributed.

**Two things Purview does not do.** It does not enforce row-level or column-level security. Those are engine features in SQL and Spark, and a sensitivity label classifies rather than blocks. Purview's own in-place **data sharing** for Blob and ADLS Gen2 was retired, with support ending September 2025 and Fabric external data sharing as the replacement.

**When to use Purview:**
- Enterprises with regulatory requirements (GDPR, HIPAA, SOX)
- Organizations where many teams produce and consume data, particularly a data mesh
- Any estate where "what data do we have, and where did it come from" is not answerable from memory

**Trade-offs:**
- Adds cost and an ongoing curation obligation
- Lineage stays accurate only if the pipelines that produce it keep publishing it
- Classification rules tend to over-flag before they are tuned, which trains people to ignore the labels

---

## Data Mesh on Azure

Data mesh is an organizational pattern where multiple teams own their data as products and share them through a self-serve platform. Unlike traditional centralized data platforms, data mesh distributes responsibility and ownership across domain teams.

### Data Mesh Principles

**Domain Ownership:**
Each team owns their data domain end-to-end. Sales team owns sales data, marketing owns campaign data, product owns feature usage data. Each team is responsible for data quality, schemas, and documentation.

**Data as a Product:**
Teams treat their data outputs (not their databases) as products. A data product includes the data itself plus metadata, documentation, SLAs, and contracts about what the data means and how it should be used.

**Self-Serve Platform:**
Rather than a central data team managing everything, teams use self-serve tools to produce and consume data. The platform handles infrastructure concerns (storage, compute, governance) so teams focus on domain logic.

**Federated Governance:**
Instead of centralized rules enforced top-down, governance is federated. Global policies like encryption and data retention are enforced platform-wide, but domain teams define their own schemas and quality standards within those constraints.

### Data Mesh on Azure

Implementing data mesh on Azure requires several layers:

**Infrastructure layer:**
- Data Lake Storage Gen2 provides the storage foundation
- Virtual networks and RBAC/ACLs separate domain access
- Each domain team gets their own Synapse workspace or Databricks workspace

**Governance layer:**
- Purview Data Map scans across domains, and Unified Catalog governance domains give each team its own slice of the catalog without fragmenting it
- Data products are the unit domains publish, and self-service access policies replace per-source permission requests
- Unity Catalog (Databricks) enables cross-workspace data sharing with governance
- Microsoft Entra ID controls the identities behind every access decision

**Platform layer:**
- Self-serve tools (notebooks, SQL editors) let domains produce and transform data
- Standardized patterns (medallion architecture) across domains improve consistency
- Shared libraries and infrastructure reduce duplication

**Example structure:**
```
Sales Domain (Synapse workspace)
├── Bronze: Raw from CRM system
├── Silver: Cleaned transactions
└── Gold: Customer lifetime value, cohort analysis

Marketing Domain (Synapse workspace)
├── Bronze: Raw from campaign platform
├── Silver: Cleaned campaign interactions
└── Gold: Campaign ROI by channel, audience segments

Product Domain (Databricks workspace)
├── Bronze: Raw feature events
├── Silver: Deduplicated user sessions
└── Gold: Feature adoption, user cohorts
```

Domains publish gold-layer tables as Purview data products, which is what makes them discoverable and requestable outside the owning team. Unity Catalog and Fabric OneLake shortcuts handle the physical sharing so consumers read the data in place rather than receiving a copy.

### Challenges of Data Mesh

- **Fragmentation**: Multiple isolated workspaces can lead to inconsistent schemas and duplicate effort
- **Governance drift**: Domains following different quality standards makes downstream integration harder
- **Operational burden**: Each domain responsible for their own infrastructure (clustering, scaling, monitoring)
- **Organizational readiness**: Requires domain teams to own data quality and understand governance responsibilities

**Mitigation:**
- Use Unified Catalog health controls and data quality rules to set a floor every domain has to clear
- Define shared patterns (medallion layering, naming conventions, quality rules)
- Have a platform team supply templates and automation rather than review requests
- Start with two or three domains before scaling

---

## Real-Time and Streaming Architecture

Modern data architectures must support both historical batch analytics and real-time insights. Azure provides several options for streaming data ingestion and processing.

### Stream Ingestion

**Azure Event Hubs:**
- Managed Kafka-compatible service for high-throughput event ingestion
- Partitioned for parallelism, but the partition count is fixed at creation on Basic and Standard (32 maximum). **Dynamic partition scale-out is a Premium and Dedicated feature**, so a Standard namespace that outgrows its partitioning needs a new event hub and a consumer cutover
- Retention is tier-bound, not configuration-bound: **Basic 1 day, Standard 7 days, Premium and Dedicated 90 days.** A design that assumes 90-day replay has assumed a Premium namespace
- Capture writes the stream to Blob Storage or ADLS Gen2 for archive, priced separately on Standard and included on Premium and Dedicated
- Log compaction is available from Standard upward, capped at 1 GB per partition on Standard and 250 GB on Premium and Dedicated

**Azure IoT Hub:**
- Purpose-built for IoT device connections
- Device authentication and management built-in
- Two-way communication with devices
- Routes data to Event Hubs or Service Bus for processing

**Apache Kafka and Apache Flink on Confluent Cloud:**
- An Azure Native Integration, provisioned through the `Microsoft.Confluent` resource provider and managed from the Azure portal, CLI, or SDKs rather than only from the Marketplace
- Full Apache Kafka feature set (exactly-once semantics, transactions, schema registry) plus managed Flink for stream processing
- Higher cost, no cluster operations, and a billing and support relationship that runs through Azure

### Real-Time Processing

**Azure Stream Analytics:**
- Managed streaming query engine using SQL augmented with temporal operators, running on the Trill in-memory engine
- Submillisecond latencies, with exactly-once processing and at-least-once delivery
- Inputs from Event Hubs and IoT Hub, plus reference data from Blob Storage or SQL Database for lookups. Outputs to storage, SQL, Cosmos DB, Event Hubs, Synapse, and Power BI
- The query language covers complex event processing: pattern matching, geospatial functions, anomaly detection, and windowed aggregation
- Extensible with JavaScript or C# user-defined functions and aggregates, and with Azure Machine Learning function calls, so "SQL-only" understates what it can express
- Runs on IoT Edge and Azure Stack with the same query language, which is the usual reason to pick it over Spark streaming

**Synapse Spark Structured Streaming:**
- Use Spark's streaming API for complex transformations
- Supports micro-batch and continuous processing
- Integrates with Delta Lake for reliable streaming writes
- Good for: complex logic, ML model scoring, updates to silver/gold layers

**Databricks Structured Streaming:**
- The same Spark streaming API, with auto-scaling clusters and Unity Catalog governing the streaming sources and sinks alongside everything else
- Good for: gold-layer updates, ML feature creation, streaming writes that need lineage and access control applied automatically

**Fabric Real-Time Intelligence:**
- Eventstreams ingest from Event Hubs, IoT Hub, Kafka, CDC feeds, and REST sources with no-code routing into an eventhouse or a lakehouse
- KQL over an eventhouse for exploratory analysis of data in motion, and Activator for rules that fire when a condition is met
- Good for: teams already on Fabric capacity, where routing a stream into the same OneLake the batch layers use avoids a second platform

### Lambda or Kappa Architecture

The two patterns differ in the shape of the data path, not in the tooling they use:

```
  LAMBDA                                 KAPPA

  source                                 source
    │                                      │
    ├──────────────┐                       ▼
    ▼              ▼                     append-only log
  batch path    speed path               (Event Hubs, Delta)
  (hours)       (seconds)                  │
    │              │                       ▼
    ▼              ▼                     one streaming job
  batch view    real-time view             │
    │              │                       ▼
    └──────┬───────┘                     serving table
           ▼                             (replay the log to
     serving layer merges                 recompute history)
     the two, and the two
     code paths must agree
```

**Lambda** runs a batch path over historical data and a streaming path over recent data, then merges the results at serving time. Each path can be tuned independently, and the price is two implementations of the same business logic that have to produce identical answers.

**Kappa** keeps one streaming pipeline. History is not a separate path, it is a replay of the same log through the same code.

**On Azure, kappa is usually the better default:**
- Delta Lake gives reliable streaming writes plus the versioned history that makes replay possible
- One set of medallion layers serves both real-time and batch consumers
- One implementation of the business logic, so real-time and historical answers cannot drift apart

Lambda still earns its place when the batch path needs an algorithm the streaming path cannot run, such as a full-history model retrain or a join against a dataset too large to hold in streaming state.

---

## Data Governance and Security

### Data Discovery and Classification

Purview Data Map scans Data Lake Storage, SQL databases, Synapse, and Databricks to identify and classify sensitive data automatically. It applies sensitivity labels (confidential, restricted, public) and captures lineage showing where data flows.

A label classifies. It does not by itself block an export or a query, and enforcement comes from a protection policy or from the engine's own access controls. Treating a label as a control is one of the more common governance mistakes.

**Best practices:**
- Run scans on a schedule so newly landed data gets classified without anyone remembering to ask
- Tune classification rules early, because over-flagging trains people to ignore the labels
- Define glossary terms once and attach them to data products, so the business vocabulary propagates to assets instead of being re-entered
- Use lineage to answer impact questions before a change, not just forensic questions after one

### Access Control

Azure provides multiple layers of access control:

**Storage level (Azure RBAC):**
- Roles such as Storage Blob Data Owner, Contributor, and Reader
- Assigned at the subscription, resource group, storage account, or container scope, and inherited downward
- Evaluated **before** ACLs. If a role assignment already grants the requested permission, ACLs are never consulted, which is why a broad Storage Blob Data Contributor assignment silently defeats a carefully built ACL tree

**File level (POSIX ACLs):**
- Read, write, and execute on individual directories and files, where execute means traverse
- Granting read on a nested file with ACLs alone requires execute on the container root and every directory along the path
- More precise than RBAC, and bounded by the 32-entry limit, which is why the entries should hold Entra groups rather than people

**Synapse and SQL level:**
- **Column-level security**: `GRANT SELECT ON table(col1, col2) TO principal`. It restricts which columns a principal may read and returns an error on the rest. It does not encrypt anything, and it removes the need for view-per-audience workarounds
- **Row-level security**: an inline table-valued predicate function bound to the table by a security policy, so the filter applies to every query from every tier
- **Dynamic data masking**: obscures values in the result set for unprivileged users while leaving the underlying data unchanged
- **Always Encrypted** is the feature that actually encrypts column values, with keys the database engine never holds. Reach for it when the threat model includes the database administrator

**Example:** a sales analyst reads customer names and regions but is denied the revenue column, while a regional manager reads every column and sees only their own region's rows.

### Row-Level Security (RLS)

Row-level security prevents users from seeing data outside their scope. Common patterns:

- **By region:** European users see only European data
- **By customer:** Users see only their customer accounts
- **By department:** Employees see only their department's projects

Implement RLS with an inline table-valued function that evaluates the caller (through `USER_NAME()`, `SESSION_CONTEXT()`, or Entra group membership) and a security policy that binds that function to the table as a filter predicate. Because the binding lives on the table, the filter applies to every query path, including ad-hoc SQL and BI tools, rather than depending on each query remembering to add a `WHERE` clause.

### Encryption

**At rest:**
- Data Lake Storage and SQL databases encrypt automatically with Microsoft-managed keys
- Bring your own key (BYOK) for higher security (encryption keys in customer-managed Key Vault)

**In transit:**
- HTTPS/TLS for all data in flight
- VNet service endpoints or Private Endpoints for restricting access to specific networks

**Data residency and sovereignty:**
- Data Lake Storage can be configured for specific regions (e.g., Europe, US, UK)
- Azure Government and Azure operated by 21Vianet for sovereign cloud requirements
- SQL Database geo-replication for disaster recovery across regions

---

## Architecture Decision Framework

### Choosing an Engine

Engine choice is driven by two questions in order: whether this is a greenfield platform, and what the workload actually is.

```
Is this a new platform, with no Synapse or Databricks estate to extend?
│
├─ Yes ─▶ Start with Microsoft Fabric.
│         The Synapse and ADF successor notices both point here, and
│         one capacity covers engineering, warehousing, real-time,
│         and BI. Size the F SKU against semantic model limits and
│         the F64 free-viewer threshold, not against compute alone.
│         Add Databricks alongside it only for heavy ML.
│
└─ No ──▶ What is the workload?
          │
          ├─ Serving a gold layer to BI, predictable query shapes
          │  ──▶ Synapse dedicated SQL pool.
          │      Provisioned, pausable, and result set caching
          │      is off by default, so turn it on deliberately.
          │
          ├─ Ad-hoc exploration of files already in the lake
          │  ──▶ Synapse serverless SQL pool.
          │      No capacity planning, but budget by bytes processed:
          │      the 10 MB per-query floor and lack of result caching
          │      make a chatty dashboard expensive.
          │
          ├─ Silver-layer transformation, Python or Scala logic
          │  ──▶ Either Spark engine. Pick Synapse Spark to stay in
          │      one workspace, Databricks for the richer runtime.
          │
          └─ Machine learning, model registry, model serving,
             governance spanning many workspaces
             ──▶ Databricks with Unity Catalog.
                 Move off Standard tier before 1 October 2026.
```

**Provisioned or serverless** is a separate axis that applies within whichever engine you picked. Provisioned compute (dedicated SQL pool, an all-purpose Databricks cluster) gives predictable latency and a better rate for steady load, at the cost of capacity planning and a floor you pay whether or not anyone queries. Serverless compute (serverless SQL, on-demand Spark, a Databricks jobs cluster) has no idle cost and absorbs bursts, at a higher per-unit rate and with less predictable performance under very large queries. Provisioned suits gold layers serving dashboards on a schedule. Serverless suits bronze and silver transformation and exploratory work.

### Centralized vs Federated Data Platform

**Centralized (traditional enterprise data warehouse):**
- Single team owns all data
- Strong governance and quality control
- Slower time-to-value (queue for changes)
- Scaling bottlenecks when platform team resources are limited

**Federated (data mesh):**
- Domain teams own their data
- Faster time-to-value
- Organizational alignment (teams responsible for what they know)
- More complex governance if not handled carefully
- Requires platform team to provide templates and standards

**Hybrid approach (recommended for most):**
- Shared infrastructure and governance (Purview, network, encryption)
- Domain teams own their medallion layers (bronze/silver/gold)
- Shared gold layer for common use cases (customer dimension)
- Platform team enforces standards, not workflows

### Assembled Platform vs Integrated Platform

Neither option is a build in the sense of writing your own engine. The choice is whether you assemble the platform from separately provisioned services or take one integrated SaaS product.

**Assembled (Data Factory plus Synapse plus Databricks, over ADLS Gen2):**
- Each component is chosen and sized on its own merits, and the storage layer stays open Delta and Parquet
- Networking, identity, monitoring, and cost allocation are yours to wire up across every component
- Component-level billing makes it easier to attribute cost, and easier to leave one meter running

**Integrated (Microsoft Fabric):**
- One capacity, one governance surface, one storage layer, and far less integration work to reach a first result
- Capacity sizing becomes the main lever, and a single F SKU absorbs workloads that would otherwise be billed and tuned separately
- Less component-level choice, and the platform's roadmap becomes your roadmap

Open storage formats are the hedge that makes this reversible. Data written as Delta in ADLS Gen2 is readable by both paths, and OneLake's Delta-to-Iceberg virtualization widens that further, so the lock-in sits in the pipelines and semantic models rather than in the data.

---

## Common Pitfalls

### Pitfall 1: Building a Data Warehouse Instead of a Data Lake

**Problem:** Designing a star schema up front and requiring all data to fit that schema before storing it. This forces upfront modeling and prevents capturing raw data.

**Result:** New data sources are rejected because they don't fit the schema. Exploratory analysis is blocked waiting for schema updates. Debugging transformation issues requires tracing through multiple transformation layers.

**Solution:** Start with medallion architecture. Land raw data in bronze layer unchanged. Apply transformation and structure in silver and gold. This preserves flexibility and enables exploration.

---

### Pitfall 2: No Data Quality Gates in Silver Layer

**Problem:** Raw data flows directly from bronze to gold with minimal quality checks. Bad data propagates downstream to dashboards and decisions.

**Result:** Data quality issues discovered by business users (wrong numbers in reports) rather than caught by data engineers. Time wasted debugging incorrect output instead of fixing the source.

**Solution:** Implement explicit quality checks in silver layer. Flag suspicious values, reject duplicates, handle schema changes. Document what "good data" means for each domain. Monitor quality metrics continuously.

---

### Pitfall 3: Separate Real-Time and Batch Infrastructure

**Problem:** Building separate streaming pipelines for real-time analytics and separate batch ETL for historical data. Maintaining two code paths for the same logic.

**Result:** Inconsistencies between real-time and batch results. Duplicate business logic. More infrastructure to operate and troubleshoot.

**Solution:** Use kappa architecture with Delta Lake. Single streaming pipeline processes both historical (replay) and real-time data. Store in append-only format. This simplifies architecture and ensures consistency.

---

### Pitfall 4: Forgetting Data Lineage

**Problem:** Not tracking where data comes from or where it flows. Complex transformations with unclear dependencies.

**Result:** When upstream data changes, downstream impacts are unknown. Root cause analysis of bad data becomes impossible. Compliance audits cannot show where sensitive data flows.

**Solution:** Let Purview Data Map capture lineage automatically, and make sure Data Factory pipelines and Databricks jobs publish it. Query lineage to size the blast radius of a change before you make it, not after something breaks.

---

### Pitfall 5: Governance Without Enforcement

**Problem:** Creating data governance policies and standards but not enforcing them. Databases, schemas, and access controls follow no consistent pattern.

**Result:** Teams reinvent patterns, governance standards are ignored, security policies are bypassed. Platform team cannot scale support to many teams.

**Solution:** Put governance in the infrastructure. Unified Catalog health controls and data quality rules give every domain a measurable floor, and templates plus infrastructure as code give teams a compliant starting point. Make following the pattern easier than deviating from it.

---

### Pitfall 6: Over-Aggregating Gold Layer

**Problem:** Pre-computing aggregations for every possible combination of dimensions. Massive gold layer of thousands of tables.

**Result:** Gold layer becomes harder to maintain than it is to query bronze/silver directly. Maintenance costs exceed value. Discoverability suffers because of too many options.

**Solution:** Pre-compute only the aggregations something actually queries, and check usage rather than guessing. Let ad-hoc aggregation happen against silver. Define reusable calculations in a semantic layer, such as Power BI semantic models (the current name for what used to be called datasets), rather than materializing a table per combination.

---

## Key Takeaways

1. **Modern data architecture separates storage from compute.** Data Lake Storage provides cheap, infinite capacity. Compute scales independently with serverless options. This drives down cost compared to traditional warehouses where storage and compute are bundled.

2. **Medallion architecture scales from startups to enterprises.** Bronze (raw), silver (cleaned), gold (aggregated) provides structure without premature optimization. You can add new data sources to bronze without affecting downstream layers.

3. **Microsoft is pointing new work at Fabric.** Synapse SQL and Azure Data Factory documentation both carry successor notices naming Fabric Data Warehouse and Fabric Data Factory, with upgrade paths and a migration assistant. Neither product is retired or dated, so this shapes greenfield choices rather than forcing a migration.

4. **Governance has to be enforced by infrastructure, not by policy documents.** Purview Data Map classifies and traces lineage, Unified Catalog carries the access policies and quality rules, ACLs and RBAC gate the storage, and Entra ID backs every identity. A sensitivity label on its own classifies without blocking anything.

5. **Real-time and batch use the same medallion layers.** Kappa architecture with Delta Lake eliminates maintaining separate streaming and batch pipelines. Stream events into bronze, transform to silver, aggregate to gold using the same medallion pattern.

6. **Data mesh distributes ownership but requires strong platform foundations.** Domain teams own their data products, but the platform must provide standards, templates, and governance enforcement. Without platform discipline, federation leads to fragmentation.

7. **The gold layer should hold only business-critical aggregations.** Not every calculation needs a table. Push ad-hoc calculation into a semantic layer such as a Power BI semantic model, which keeps gold small enough to maintain and fast enough to query.

8. **Access control stacks, and the order matters.** Azure RBAC covers accounts and containers and is evaluated first, so a broad role assignment makes the ACL tree beneath it irrelevant. ACLs handle directories and files within a 32-entry budget that only holds up if the entries are Entra groups. In SQL, row-level security filters rows through a security policy and column-level security restricts columns through `GRANT`, while Always Encrypted is the only one of the four that encrypts anything.

9. **Serverless SQL and Spark reduce operational overhead for intermittent workloads.** If queries are bursty or exploratory, serverless is often cheaper than provisioning compute. Dedicated pools are for consistent, predictable workloads.

10. **Track lineage and data quality from the start.** Purview integration and quality metrics in silver layer compound in value as the platform grows. Early adoption prevents governance debt.
