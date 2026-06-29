---
title: "Modern Data Architecture on Azure"
layout: guide
category: Azure
subcategory: Analytics & Data Processing
description: "Data architecture patterns on Azure including lakehouse, medallion architecture, data mesh, and modern analytics platforms using Data Lake Storage, Synapse, Databricks, and Microsoft Fabric."
tags: [infrastructure, azure, analytics, architecture, scalability, governance, practical]
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
| **Data governance** | AWS Glue Data Catalog, Lake Formation | Microsoft Purview (data discovery, classification, lineage) |
| **Stream processing** | Kinesis, Lambda | Event Hubs, Stream Analytics, Kafka for Confluent |
| **BI and visualization** | QuickSight | Power BI (deeply integrated with data platform) |

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

The medallion architecture works because each layer is independent. You can rebuild silver without reprocessing bronze. You can create new gold tables without changing silver. Data flows left-to-right through quality gates, but consumers query gold directly.

---

## Azure Data Platform Components

### Azure Data Lake Storage Gen2 (Foundation)

Data Lake Storage Gen2 is the storage foundation for modern data architectures on Azure. It provides hierarchical namespaces (directories instead of flat object paths like S3), fine-grained access control through ACLs and RBAC, and massive scale at low cost.

**Key capabilities:**
- Hierarchical namespace enables Hadoop-compatible paths and improves performance for operations on large directories
- RBAC and POSIX ACLs provide granular access control (data governance at the file level)
- Data Lake Storage Firewall restricts access by IP, virtual network, or service principals
- Zone-redundant storage (ZRS) option for higher availability
- Immutable storage option for compliance and data retention

**When to use:**
- Foundation for any medallion architecture (all three layers can live here)
- Cost-effective storage for historical data at any volume
- Primary storage for data lakes and lakehouses

### Azure Data Factory (Orchestration)

Data Factory is Azure's managed ETL service, providing visual workflow design, scheduling, and error handling for data movement and transformation.

**Capabilities:**
- 90+ pre-built connectors to source systems and cloud services
- Visual pipeline designer for non-developers
- Scheduled triggers and event-based triggers (files arriving in storage)
- Copy activity for bulk data movement with automatic partitioning
- Lookup, filter, and conditional branching for dynamic pipelines
- Monitoring and alerting on pipeline execution

**When to use:**
- Bronze layer: Scheduled data ingestion from source systems
- Silver layer: Orchestrating Spark transformations in Synapse or Databricks
- Data movement between cloud services or hybrid environments

**Trade-offs:**
- Lower code overhead than writing Spark transformations
- But less flexible for complex transformation logic (push this to Spark)
- Pricing is activity-based (price per run + DIU hours)

### Azure Synapse Analytics (SQL + Spark)

Synapse Analytics combines dedicated SQL pools (similar to Redshift), serverless SQL pools (similar to Athena), and Spark pools all in one service with shared storage.

**Dedicated SQL Pools:**
- Provisioned compute for predictable performance (good for production gold layer)
- Built-in data warehouse features (materialized views, PolyBase for querying external data)
- Designed for large scans across historical data
- Cost: per-DW-hour (scale up/down as needed)

**Serverless SQL Pools:**
- Query data directly in Data Lake Storage without loading into a warehouse
- Pay per TB of data scanned
- Faster time-to-value; no capacity planning
- Good for exploratory queries and ad-hoc analysis
- Less expensive than dedicated pools for intermittent use

**Spark Pools:**
- Distributed Spark clusters for transformation and ML
- Integrated with Jupyter notebooks for interactive development
- Supports Python, Scala, SQL via Spark
- Pay per Spark node per hour (scales to zero)

**When to use Synapse:**
- SQL analytics: Dedicated pools for consistent gold-layer serving, serverless for ad-hoc queries
- Transformation: Spark pools for medallion silver layer processing
- Unified workspace: Query Spark and SQL data in the same environment

**Trade-offs:**
- More Azure-integrated than open-source alternatives
- Dedicated pools require capacity planning; serverless is more elastic
- Requires SQL knowledge for SQL pools (unlike open-source Spark-only alternatives)

### Azure Databricks (Spark + ML)

Databricks is a managed Spark platform built on top of Delta Lake, providing distributed computing for transformations, ML, and analytics. Databricks and Azure have a deep partnership; Databricks is the recommended Spark engine on Azure.

**Key capabilities:**
- Managed Spark clusters that scale automatically
- Delta Lake for ACID transactions and schema enforcement on data lake files
- Unity Catalog for centralized data governance and lineage across workspaces
- Notebooks for interactive development and documentation
- Jobs for scheduled transformations and ML training
- AutoML for rapid model development

**When to use Databricks:**
- Silver layer: Complex transformations and quality checks
- ML workloads: Feature engineering, model training, batch inference
- Multi-workspace governance: Unity Catalog provides cross-workspace data access
- Data science and AI: Integrated ML tools and environments

**Trade-offs:**
- More expensive than Synapse Spark for simple SQL queries
- But more powerful for ML and Python-heavy workloads
- Unity Catalog requires higher SKU; standard Databricks has workspace-level governance

### Microsoft Fabric (Unified Platform)

Microsoft Fabric is the newest addition to Azure's data platform, integrating Data Lake Storage (OneLake), Spark, SQL, and Power BI into a single unified platform with shared governance through Purview.

**Components:**
- **OneLake**: Cloud-native storage that works like OneDrive for data (shared across Fabric items)
- **Data Engineering**: Spark notebooks and jobs
- **Data Warehouse**: SQL analytics with traditional dimensional modeling
- **Real-Time Analytics**: For high-frequency event processing
- **Data Factory**: Pipelines for orchestration
- **Power BI**: Visualization fully integrated with data
- **Data Activator**: Automation based on data insights

**When to use Fabric:**
- Greenfield data platforms: Start here if choosing a new platform today
- Organizations invested in Microsoft (Office 365, SQL Server, Power BI)
- Simpler governance needs (single unified platform vs. multiple tools)
- Organizations that want BI tightly integrated with data engineering

**Trade-offs:**
- Newer than Synapse and Databricks; ecosystem still maturing
- Commitment to Microsoft stack (less option-picking than Synapse + Databricks)
- Potentially higher cost than best-of-breed combinations for specialized use cases

### Microsoft Purview (Governance)

Purview provides centralized data discovery, classification, and lineage tracking across your data estate. It integrates with Data Lake Storage, SQL databases, Synapse, Databricks, and third-party systems.

**Capabilities:**
- Automated data scanning and classification (PII, financial data, confidential)
- Data catalog showing what data exists and where it came from
- Lineage tracking from source systems through medallion layers to BI tools
- Data glossary for business term definitions
- Access management and data sharing through Purview
- Sensitivity labeling for row-level and column-level security

**When to use Purview:**
- Enterprises with regulatory requirements (GDPR, HIPAA, SOX)
- Organizations where many teams produce and consume data (data mesh)
- Need for centralized visibility into what data exists and how it's being used

**Trade-offs:**
- Adds complexity and cost
- Requires discipline to maintain accurate lineage
- Classification policies can be overly aggressive (flag too much data as sensitive)

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
- Purview provides centralized cataloging and lineage across domains
- Unity Catalog (Databricks) enables cross-workspace data sharing with governance
- Entra ID (Azure AD) controls access to data products

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

Domains share gold-layer data products through Purview discovery and Unity Catalog or Synapse's shared database features.

### Challenges of Data Mesh

- **Fragmentation**: Multiple isolated workspaces can lead to inconsistent schemas and duplicate effort
- **Governance drift**: Domains following different quality standards makes downstream integration harder
- **Operational burden**: Each domain responsible for their own infrastructure (clustering, scaling, monitoring)
- **Organizational readiness**: Requires domain teams to own data quality and understand governance responsibilities

**Mitigation:**
- Use Purview to enforce minimum governance standards
- Define shared patterns (medallion architecture, naming conventions, quality rules)
- Use platform teams to provide templates and automation
- Start small with 2-3 domains before scaling

---

## Real-Time and Streaming Architecture

Modern data architectures must support both historical batch analytics and real-time insights. Azure provides several options for streaming data ingestion and processing.

### Stream Ingestion

**Azure Event Hubs:**
- Managed Kafka-compatible service for high-throughput event ingestion
- Partitioned for parallelism (scale by adding partitions)
- Automatic retention (1-7 days default, up to 90 days with Kafka API)
- Real-time capture to Azure Blob Storage for archive
- Cheaper alternative to Kafka but fewer features

**Azure IoT Hub:**
- Purpose-built for IoT device connections
- Device authentication and management built-in
- Two-way communication with devices
- Routes data to Event Hubs or Service Bus for processing

**Apache Kafka on Confluent (for Azure):**
- Fully managed Kafka through Azure Marketplace
- Full Apache Kafka feature set (exactly-once semantics, transactions, schema registry)
- Higher cost but no operational overhead

### Real-Time Processing

**Azure Stream Analytics:**
- Managed streaming query engine (SQL-like syntax)
- Process events as they arrive with millisecond latency
- Output to databases, storage, or applications
- Good for: time-window aggregations, anomaly detection, threshold alerting
- Limited to simple streaming queries; complex logic is difficult

**Synapse Spark Structured Streaming:**
- Use Spark's streaming API for complex transformations
- Supports micro-batch and continuous processing
- Integrates with Delta Lake for reliable streaming writes
- Good for: complex logic, ML model scoring, updates to silver/gold layers

**Databricks Structured Streaming:**
- Similar to Synapse but with better integration
- Auto-scaling clusters, Unity Catalog for governance
- Good for: gold-layer updating, ML feature creation

### Lambda or Kappa Architecture

**Lambda:** Batch path (historical data) + streaming path (real-time data) separately, then merge results. Complex to maintain two pipelines but can optimize each independently.

**Kappa:** Single streaming pipeline that processes both historical (replay) and real-time data. Simpler architecture if streams support replay and you use append-only storage (Delta Lake, Kafka).

**On Azure, use kappa if possible:**
- Delta Lake provides reliable streaming writes and replay capability
- Single medallion architecture handles both real-time and batch
- Reduces code duplication and operational burden

---

## Data Governance and Security

### Data Discovery and Classification

Microsoft Purview scans Data Lake Storage, SQL databases, and Synapse to identify and classify sensitive data automatically. It applies sensitivity labels (confidential, restricted, public) and tracks lineage showing where data flows.

**Best practices:**
- Run scans periodically to catch new sensitive data
- Adjust classification rules to reduce false positives
- Create a data glossary so teams use consistent business term definitions
- Use lineage to audit how sensitive data is accessed and transformed

### Access Control

Azure provides multiple layers of access control:

**Storage level (RBAC):**
- Assign roles like Storage Blob Data Owner, Reader, Contributor
- Applies to all blobs within a storage account

**File level (ACLs):**
- POSIX-style ACLs on Data Lake Storage Gen2 enable fine-grained permissions
- Grant specific users or groups read/write on specific directories or files
- More flexible than RBAC but also more complex to manage

**Synapse SQL level:**
- Column-level security: Encrypt sensitive columns, decrypt only for authorized users
- Row-level security: Hide rows based on user properties
- Dynamic data masking: Show masked values to non-authorized users

**Example:** A sales analyst can see customer names and regions but not revenue; a manager can see all columns but only for their region.

### Row-Level Security (RLS)

Row-level security prevents users from seeing data outside their scope. Common patterns:

- **By region:** European users see only European data
- **By customer:** Users see only their customer accounts
- **By department:** Employees see only their department's projects

Implement RLS by adding a predicate to SQL queries that filters rows based on `USER_NAME()` or custom claims in Entra ID.

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

### When to Use Synapse vs Databricks vs Fabric

**Use Synapse SQL (dedicated pool) when:**
- Gold layer serving business intelligence
- Consistent, predictable query workloads
- Team familiar with traditional data warehousing
- Need low query latency with pre-built structures

**Use Synapse Spark or Databricks Spark when:**
- Silver layer transformations and quality checks
- Complex business logic beyond SQL
- Python or Scala is your team's primary language

**Use Databricks when:**
- Heavy machine learning and model management requirements
- Multi-workspace federation with Unity Catalog is critical
- Team wants the most advanced Spark features
- ML model serving and batch inference are important

**Use Fabric when:**
- New platform, greenfield deployment
- Want single platform covering engineering through BI
- Team is Microsoft-centric (SQL Server, Power BI, Office 365)
- Tight BI integration is important
- Simpler governance model preferred

**Use serverless Synapse SQL when:**
- Ad-hoc, exploratory queries on data lake files
- Intermittent analytics without dedicated compute
- Want to avoid capacity planning overhead
- Data volume and query frequency are unpredictable

### Serverless vs Provisioned Compute

**Provisioned (dedicated Synapse SQL pool, Databricks all-purpose cluster):**
- Pro: Predictable performance, lower latency, better cost for consistent workloads
- Con: Capacity planning, always running (even idle), minimum cost

**Serverless (Synapse serverless SQL, Synapse Spark on-demand, Databricks jobs cluster):**
- Pro: Elastic scaling, pay per use, no idle cost, works for burst workloads
- Con: Higher per-unit cost, less predictable, potential throttling on very large queries

**Decision:** Provisioned for gold layers serving BI tools and consistent reporting. Serverless for bronze/silver transformation and exploratory analysis.

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

### Build vs Buy

**Build (Synapse + Databricks + Data Factory):**
- Pro: Maximum flexibility, use open standards (Delta Lake, Parquet), not locked into one vendor
- Con: More operational overhead, integration work
- Cost: Generally lower for large organizations

**Buy (Fabric, Databricks, Competitors):**
- Pro: Simpler to get started, integrated features, less infrastructure management
- Con: Vendor lock-in, fewer customization options
- Cost: Higher initial cost, potentially more expensive at scale

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

**Solution:** Use Purview to track lineage automatically. Ensure Data Factory and Databricks jobs publish lineage information. Use this to identify impact of changes before making them.

---

### Pitfall 5: Governance Without Enforcement

**Problem:** Creating data governance policies and standards but not enforcing them. Databases, schemas, and access controls follow no consistent pattern.

**Result:** Teams reinvent patterns, governance standards are ignored, security policies are bypassed. Platform team cannot scale support to many teams.

**Solution:** Implement governance in infrastructure. Use Purview policies to enforce minimum standards. Provide templates and infrastructure-as-code for teams to follow. Make following patterns easier than deviating from them.

---

### Pitfall 6: Over-Aggregating Gold Layer

**Problem:** Pre-computing aggregations for every possible combination of dimensions. Massive gold layer of thousands of tables.

**Result:** Gold layer becomes harder to maintain than it is to query bronze/silver directly. Maintenance costs exceed value. Discoverability suffers because of too many options.

**Solution:** Pre-compute only aggregations that are actually used (track BI tool queries to confirm). For ad-hoc aggregations, let users query silver layer directly or build on-demand aggregations. Use semantic layers (Power BI datasets, Looker models) to define reusable calculations rather than pre-computed tables.

---

## Key Takeaways

1. **Modern data architecture separates storage from compute.** Data Lake Storage provides cheap, infinite capacity. Compute scales independently with serverless options. This drives down cost compared to traditional warehouses where storage and compute are bundled.

2. **Medallion architecture scales from startups to enterprises.** Bronze (raw), silver (cleaned), gold (aggregated) provides structure without premature optimization. You can add new data sources to bronze without affecting downstream layers.

3. **Microsoft Fabric represents the future of the Azure data platform.** If starting a new platform today, evaluate Fabric first. It integrates storage, Spark, SQL, and Power BI into a single unified system with shared governance through Purview.

4. **Data governance must be enforced in infrastructure, not just policy.** Purview provides automatic classification and lineage. ACLs control access at the file level. Entra ID manages authentication. Make governance decisions at deployment time, not trust time.

5. **Real-time and batch use the same medallion layers.** Kappa architecture with Delta Lake eliminates maintaining separate streaming and batch pipelines. Stream events into bronze, transform to silver, aggregate to gold using the same medallion pattern.

6. **Data mesh distributes ownership but requires strong platform foundations.** Domain teams own their data products, but the platform must provide standards, templates, and governance enforcement. Without platform discipline, federation leads to fragmentation.

7. **Gold layer should contain only business-critical aggregations.** Not every possible calculation needs a table. Use semantic layers (Power BI, looker) for ad-hoc calculations. This keeps gold layer maintainable and fast.

8. **Access control has multiple layers.** RBAC controls storage-level access. ACLs enable file-level granularity. SQL row-level security hides rows. Column-level security hides columns. Combine these to enforce data access policies at the right level.

9. **Serverless SQL and Spark reduce operational overhead for intermittent workloads.** If queries are bursty or exploratory, serverless is often cheaper than provisioning compute. Dedicated pools are for consistent, predictable workloads.

10. **Track lineage and data quality from the start.** Purview integration and quality metrics in silver layer compound in value as the platform grows. Early adoption prevents governance debt.
