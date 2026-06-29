---
title: "Azure Database Service Selection"
layout: guide
category: Azure
subcategory: Database Services
description: "A decision framework for selecting the right Azure database service, comparing Azure SQL Database, Cosmos DB, Cache for Redis, Synapse Analytics, and other data services across workload types, consistency requirements, and cost models."
tags: [azure, databases, decision-making, architecture, cloud-computing, scalability, practical]
---

## What Is Azure Database Service Selection

Azure provides a broad portfolio of managed database services, each optimized for specific workload patterns. [Azure database services](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/data-store-overview){:target="_blank" rel="noopener noreferrer"} range from traditional relational databases like Azure SQL Database to globally distributed multi-model stores like Cosmos DB, in-memory caches like Azure Cache for Redis, and analytical data warehouses like Azure Synapse Analytics.

The decision of which database service to use is one of the most impactful architectural choices. The wrong service leads to performance bottlenecks, high costs, complex workarounds, or costly migrations. The right service aligns workload characteristics with service strengths, delivering predictable performance and cost.

### What Problems Database Service Selection Solves

**Without systematic selection:**
- Teams default to familiar technologies regardless of fit
- Performance problems emerge under load when the database cannot handle the access pattern
- Cost spirals as teams over-provision resources to compensate for poor service fit
- Migrations become necessary when initial choices cannot scale

**With systematic selection:**
- Workload characteristics drive service choice
- Performance is predictable and tunable
- Cost aligns with actual resource consumption
- The database service scales naturally with the application

### How Azure Database Services Differ from AWS

Architects familiar with AWS will find conceptual overlaps, but implementation differences matter:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Relational database** | RDS (PostgreSQL, MySQL, SQL Server, Oracle) | Azure SQL Database, Azure Database for PostgreSQL, MySQL |
| **NoSQL document store** | DocumentDB (deprecated) or DynamoDB with document support | Cosmos DB (multiple APIs: SQL, MongoDB, Cassandra, Gremlin, Table) |
| **NoSQL key-value** | DynamoDB | Cosmos DB (Table API), Azure Table Storage |
| **Graph database** | Neptune | Cosmos DB (Gremlin API) |
| **In-memory cache** | ElastiCache (Redis, Memcached) | Azure Cache for Redis |
| **Data warehouse** | Redshift | Azure Synapse Analytics (dedicated SQL pools) |
| **Time-series database** | Timestream | Azure Data Explorer (Kusto) |
| **Consistency models** | Eventually consistent (DynamoDB default) | Configurable (Cosmos DB offers 5 consistency levels) |
| **Serverless relational** | Aurora Serverless | Azure SQL Database serverless tier |
| **Pricing model (relational)** | Instance hours + storage + IOPS | vCore (compute + storage) or DTU (bundled) or serverless |
| **Pricing model (NoSQL)** | Request units + storage | Request Units (RU/s) + storage (Cosmos DB) |

---

## Decision Framework

### Workload-to-Service Mapping

The first question is: what does the application need the database to do? Different workload types require different capabilities.

| Workload Type | Characteristics | Primary Azure Services | Secondary Options |
|---------------|----------------|------------------------|-------------------|
| **OLTP (transactional)** | High transaction rate, ACID requirements, relational schema | Azure SQL Database, Azure Database for PostgreSQL/MySQL | SQL Managed Instance, Cosmos DB (SQL API with strong consistency) |
| **OLAP (analytical)** | Large scans, aggregations, historical reporting | Azure Synapse Analytics (dedicated SQL pool), Azure Data Explorer | Cosmos DB Analytical Store, Azure Database for PostgreSQL (Hyperscale/Citus) |
| **Document store** | JSON documents, flexible schema, nested structures | Cosmos DB (SQL API or MongoDB API) | Azure Database for PostgreSQL (JSONB support) |
| **Key-value cache** | Sub-millisecond reads, session state, ephemeral data | Azure Cache for Redis | Cosmos DB (Table API) |
| **Graph relationships** | Complex relationships, traversals, social networks | Cosmos DB (Gremlin API) | Azure Database for PostgreSQL (with pg_graphql) |
| **Time-series** | High ingestion rate, time-ordered queries, telemetry | Azure Data Explorer (Kusto) | Cosmos DB (with partitioning on timestamp) |
| **Full-text search** | Text search, faceted search, relevance ranking | Azure Cognitive Search | Cosmos DB (with integrated search), Azure Database for PostgreSQL (full-text search) |
| **Geospatial** | Location-based queries, distance calculations | Cosmos DB (geospatial indexing), Azure Database for PostgreSQL (PostGIS) | Azure SQL Database (spatial types) |

**Key principle:** Start with workload type, not with a preferred database technology. The workload defines requirements, and requirements drive service selection.

---

## Azure SQL Database

### What Azure SQL Database Is

[Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/sql-database-paas-overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's fully managed relational database service based on the latest stable SQL Server engine. It provides high availability, automated backups, intelligent performance optimization, and security features without managing the underlying infrastructure.

Azure SQL Database is the default choice for transactional workloads requiring ACID guarantees, relational schemas, and SQL query capabilities.

### When to Use Azure SQL Database

**Use Azure SQL Database when:**
- The application requires ACID transactions and strong consistency
- The data model is relational with foreign keys, joins, and normalized schemas
- Queries involve complex joins, aggregations, and WHERE clauses on indexed columns
- Developers have SQL expertise and want to use T-SQL, stored procedures, and views
- Compliance requires point-in-time restore, automated backups, and audit logging

**Azure SQL Database fits transactional workloads where consistency and relational integrity matter more than extreme horizontal scale.**

### Deployment Options

Azure SQL Database offers three deployment models:

| Deployment Model | What It Is | When to Use |
|------------------|-----------|-------------|
| **Single database** | One database with dedicated or shared compute | Most applications, microservices, isolated workloads |
| **Elastic pool** | Shared compute across multiple databases | SaaS applications with many small databases (one per tenant) |
| **Hyperscale** | Distributed architecture supporting up to 100 TB | Very large databases requiring fast scaling and read replicas |

### Pricing Models: DTU vs vCore vs Serverless

Azure SQL Database has three pricing models, each suited to different workload patterns:

| Pricing Model | What It Is | Cost Structure | When to Use |
|---------------|-----------|----------------|-------------|
| **DTU (Database Transaction Units)** | Bundled compute, memory, and I/O in fixed tiers (Basic, Standard, Premium) | Pay for DTU tier (e.g., S3 = 100 DTUs) | Simple workloads, predictable resource consumption, want simplicity |
| **vCore (virtual cores)** | Separate compute (vCores) and storage. Choose memory, CPU, and I/O independently | Pay for vCores + storage + IOPS | Performance tuning, need specific CPU/memory ratios, production workloads |
| **Serverless** | Auto-scales compute between min and max vCore limits. Auto-pauses during inactivity | Pay for vCore-seconds used + storage. No charge when paused | Intermittent workloads, dev/test, unpredictable usage |

**DTU is simpler but less flexible. vCore provides control and better price-performance for production. Serverless is cost-effective for intermittent workloads but adds cold-start latency.**

### High Availability and Disaster Recovery

Azure SQL Database provides built-in high availability through redundant replicas within the region:

| Service Tier | High Availability Model | RTO | RPO |
|--------------|------------------------|-----|-----|
| **Basic** | Single replica, zone-local storage | Minutes | Potential data loss on failure |
| **Standard** | Single replica with remote storage backup | Minutes | Potential data loss on failure |
| **Premium** | Multiple replicas (Always On availability groups) | Seconds | Near-zero data loss |
| **Hyperscale** | Multiple replicas across zones | Seconds | Near-zero data loss |

For disaster recovery across regions, use [active geo-replication](https://learn.microsoft.com/en-us/azure/azure-sql/database/active-geo-replication-overview){:target="_blank" rel="noopener noreferrer"} (up to 4 readable secondary regions) or [failover groups](https://learn.microsoft.com/en-us/azure/azure-sql/database/auto-failover-group-overview){:target="_blank" rel="noopener noreferrer"} (automatic failover to secondary region).

---

## Azure Database for PostgreSQL and MySQL

### What They Are

[Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/){:target="_blank" rel="noopener noreferrer"} and [Azure Database for MySQL](https://learn.microsoft.com/en-us/azure/mysql/){:target="_blank" rel="noopener noreferrer"} are fully managed versions of the popular open-source relational databases. They provide compatibility with existing PostgreSQL and MySQL applications while offering Azure's managed service benefits like automated backups, patching, and high availability.

### When to Use PostgreSQL or MySQL Instead of Azure SQL

**Use Azure Database for PostgreSQL when:**
- Application code or tools require PostgreSQL-specific features (JSONB, full-text search, PostGIS for geospatial, advanced indexing)
- Migrating from on-premises PostgreSQL with minimal changes
- Developers prefer PostgreSQL's open-source ecosystem and extensions
- Need advanced data types like arrays, hstore, or custom types

**Use Azure Database for MySQL when:**
- Application code is written for MySQL (e.g., WordPress, Drupal, many PHP applications)
- Migrating from on-premises MySQL with minimal changes
- Workload patterns align with MySQL's strengths (read-heavy, simple transactions)

**Use Azure SQL Database when:**
- Developers have SQL Server expertise and want to use T-SQL features
- Application uses SQL Server-specific features (CLR integration, Service Broker, etc.)
- Tight integration with Microsoft ecosystem (Power BI, SSRS, Azure Data Factory)

### PostgreSQL and MySQL Deployment Options

Both services offer two deployment tiers:

| Tier | What It Is | When to Use |
|------|-----------|-------------|
| **Flexible Server** | Latest deployment model with zone-redundant HA, more control, broader feature set | All new workloads (recommended) |
| **Single Server** | Legacy deployment model (deprecated for PostgreSQL, limited feature set for MySQL) | Existing workloads only; migrate to Flexible Server |

**Flexible Server is the recommended option for all new deployments.** It supports availability zones, read replicas, and better performance tuning.

---

## Cosmos DB

### What Cosmos DB Is

[Azure Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/introduction){:target="_blank" rel="noopener noreferrer"} is Microsoft's globally distributed, multi-model NoSQL database. It provides turnkey global distribution, horizontal scaling, and multiple consistency levels. Cosmos DB supports multiple APIs, allowing applications to interact with it as a document store (SQL API), MongoDB, Cassandra, Gremlin graph database, or Azure Table Storage.

Cosmos DB is designed for applications requiring global scale, low latency, and flexible schema.

### When to Use Cosmos DB

**Use Cosmos DB when:**
- Application requires global distribution across multiple regions with automatic replication
- Workload needs single-digit millisecond read and write latency at scale
- Data model is semi-structured or schema-flexible (JSON documents, key-value pairs, graph relationships)
- Application needs tunable consistency (from strong to eventual)
- Unpredictable or spiky traffic patterns require elastic horizontal scaling

**Cosmos DB fits globally distributed applications, IoT workloads, gaming leaderboards, real-time personalization, and any scenario where horizontal scale and low latency matter more than relational constraints.**

### Cosmos DB APIs

Cosmos DB supports multiple APIs, each providing a different data model and query interface:

| API | Data Model | When to Use | AWS Equivalent |
|-----|-----------|-------------|----------------|
| **SQL (Core API)** | JSON documents with SQL-like queries | Default choice for document store, new applications | DocumentDB (deprecated), DynamoDB document mode |
| **MongoDB** | MongoDB wire protocol and query language | Migrating from MongoDB with minimal code changes | DocumentDB (deprecated) |
| **Cassandra** | Wide-column store with CQL queries | Migrating from Cassandra or need wide-column model | Keyspaces (managed Cassandra) |
| **Gremlin** | Graph database with Gremlin traversals | Social networks, recommendation engines, complex relationships | Neptune |
| **Table** | Key-value store with Azure Table Storage API | Migrating from Azure Table Storage or simple key-value needs | DynamoDB |

**The SQL (Core API) is the most feature-rich and recommended for new applications.** Other APIs provide compatibility for migrations but may lag in feature support.

### Consistency Levels

Cosmos DB provides five consistency levels, allowing applications to trade consistency for latency and availability:

| Consistency Level | Guarantees | Latency | Use Case |
|------------------|-----------|---------|----------|
| **Strong** | Linearizability (reads always return most recent write) | Highest | Financial transactions, inventory management |
| **Bounded staleness** | Reads lag writes by at most K versions or T seconds | High | Collaborative editing, stock quotes with acceptable lag |
| **Session** | Reads within a session see writes from that session | Medium | User sessions, shopping carts, read-your-writes |
| **Consistent prefix** | Reads never see out-of-order writes | Low | Social feeds, comment threads (order matters) |
| **Eventual** | Reads may see stale data, but converge over time | Lowest | Analytics, non-critical telemetry, caching |

**Session consistency is the default and fits most applications.** It provides read-your-writes within a user session while allowing lower latency than strong consistency.

### Cosmos DB Pricing Model

Cosmos DB charges based on provisioned throughput (Request Units per second, RU/s) and storage:

| Pricing Component | What It Is | Cost Driver |
|-------------------|-----------|-------------|
| **Request Units (RU/s)** | Normalized throughput (1 RU = 1 KB document read) | Provisioned RU/s (manual or autoscale) or consumed RU/s (serverless) |
| **Storage** | Data stored (transactional and analytical) | Per GB per month |
| **Multi-region writes** | Write to multiple regions simultaneously | Additional RU/s cost per region |
| **Backup** | Continuous backup or periodic backup | Per GB per month (periodic is free up to 2 copies) |

**Provisioned throughput** reserves RU/s capacity at the container or database level. **Autoscale** automatically adjusts RU/s between configured min and max. **Serverless** charges per-operation (pay-as-you-go), suitable for intermittent workloads but lacks SLA and performance guarantees of provisioned mode.

**Cosmos DB can be expensive if RU/s provisioning is not tuned.** Monitor RU consumption, optimize queries, and use autoscale for variable workloads.

---

## Azure Cache for Redis

### What Azure Cache for Redis Is

[Azure Cache for Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview){:target="_blank" rel="noopener noreferrer"} is a fully managed in-memory cache based on Redis. It provides sub-millisecond latency for frequently accessed data, reducing load on backend databases and improving application responsiveness.

### When to Use Azure Cache for Redis

**Use Azure Cache for Redis when:**
- Application needs to cache database query results to reduce latency
- Session state must be stored outside application servers for stateless scalability
- Rate limiting, leaderboards, or real-time analytics require fast counters and sorted sets
- Distributed locking or pub/sub messaging is needed
- Frequently accessed reference data (configuration, feature flags) should be cached

**Azure Cache for Redis is not a primary database.** It is a cache layer that sits between the application and the database, storing ephemeral or derived data.

### Pricing Tiers

| Tier | What It Is | Use Case |
|------|-----------|----------|
| **Basic** | Single node, no SLA, no replication | Development, testing (not production) |
| **Standard** | Two nodes (primary + replica), 99.9% SLA | Production workloads requiring high availability |
| **Premium** | Standard + clustering, persistence, VNet integration, geo-replication | Mission-critical workloads, large datasets, multi-region replication |
| **Enterprise** | Redis Enterprise with advanced features (RedisJSON, RediSearch, RedisBloom) | Advanced use cases requiring Redis Enterprise modules |

**Standard tier is the baseline for production. Premium adds clustering for scale beyond a single node and persistence for durability.**

---

## Azure Synapse Analytics

### What Azure Synapse Analytics Is

[Azure Synapse Analytics](https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is){:target="_blank" rel="noopener noreferrer"} is Microsoft's analytics platform combining data warehousing, big data, and data integration. The core component is the dedicated SQL pool (formerly SQL Data Warehouse), a massively parallel processing (MPP) data warehouse optimized for analytical queries over large datasets.

### When to Use Azure Synapse Analytics

**Use Azure Synapse dedicated SQL pools when:**
- Analytical workloads require scanning terabytes or petabytes of historical data
- Queries involve complex aggregations, joins across large fact and dimension tables
- Business intelligence tools (Power BI, Tableau) need a data warehouse backend
- ETL pipelines load batch data nightly or periodically

**Do not use Azure Synapse for transactional workloads.** It is optimized for read-heavy analytical queries, not high-frequency inserts, updates, or ACID transactions.

### Synapse vs Azure SQL Database for Analytics

| Aspect | Azure SQL Database | Azure Synapse Dedicated SQL Pool |
|--------|-------------------|----------------------------------|
| **Architecture** | Symmetric multiprocessing (SMP) | Massively parallel processing (MPP) |
| **Optimal query pattern** | OLTP (transactional queries, row-level operations) | OLAP (large scans, aggregations, star schemas) |
| **Max database size** | Up to 100 TB (Hyperscale) | Petabyte scale |
| **Pricing model** | vCore or DTU (always running unless serverless) | Data Warehouse Units (DWU), can pause when not querying |
| **Use case** | Transactional applications, small to medium analytical workloads | Large-scale analytics, data warehousing |

**For analytical workloads under a few terabytes, Azure SQL Database Hyperscale with columnstore indexes often performs well and costs less than Synapse.** Synapse's MPP architecture becomes cost-effective at larger scale.

---

## Other Azure Database Services

### Azure Data Explorer (Kusto)

[Azure Data Explorer](https://learn.microsoft.com/en-us/azure/data-explorer/data-explorer-overview){:target="_blank" rel="noopener noreferrer"} is a fast, scalable data analytics service optimized for time-series and log data. It excels at ingesting high volumes of streaming data and running ad-hoc queries over it.

**When to use Azure Data Explorer:**
- Ingesting telemetry, logs, IoT sensor data at high throughput
- Time-series queries (e.g., "show me all requests with latency > 500ms in the last hour")
- Real-time analytics dashboards
- Application Performance Monitoring (APM) or security analytics

**Azure Monitor, Application Insights, and Microsoft Defender all use Azure Data Explorer under the hood.**

### Azure Table Storage

[Azure Table Storage](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview){:target="_blank" rel="noopener noreferrer"} is a NoSQL key-value store with a simple schema (partition key, row key, properties). It provides low-cost storage for structured non-relational data.

**When to use Azure Table Storage:**
- Cost-sensitive key-value storage (significantly cheaper than Cosmos DB Table API)
- Simple lookups by partition key and row key with no complex queries
- Large datasets that do not require global distribution or SLAs

**For new applications, Cosmos DB Table API is usually a better choice** unless cost is the primary constraint. Table Storage lacks the performance guarantees, global distribution, and rich query capabilities of Cosmos DB.

### SQL Managed Instance

[Azure SQL Managed Instance](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview){:target="_blank" rel="noopener noreferrer"} provides near-100% SQL Server compatibility with features like cross-database queries, SQL Agent, CLR, and Service Broker that Azure SQL Database does not support.

**When to use SQL Managed Instance:**
- Migrating from on-premises SQL Server with minimal changes (lift-and-shift)
- Application requires SQL Server features unavailable in Azure SQL Database
- Need VNet integration with private IP and no public endpoint

**SQL Managed Instance is more expensive than Azure SQL Database.** Use it when compatibility requirements outweigh cost considerations.

---

## Polyglot Persistence

Polyglot persistence is the practice of using multiple database technologies within a single application, each chosen for its strengths.

**Example architecture:**
- **Azure SQL Database** stores transactional order data (ACID guarantees, relational integrity)
- **Cosmos DB** stores user profiles and session data (global distribution, low latency)
- **Azure Cache for Redis** caches product catalog and pricing (sub-millisecond reads)
- **Azure Synapse Analytics** aggregates historical sales data for reporting (large scans, analytics)
- **Azure Cognitive Search** indexes product descriptions for full-text search (relevance ranking, facets)

**Trade-offs of polyglot persistence:**
- **Benefit:** Each workload uses the best-fit database, optimizing performance and cost
- **Complexity:** Multiple services to manage, monitor, and secure
- **Data synchronization:** Changes in one database may need to propagate to others (eventual consistency challenges)
- **Operational burden:** Teams need expertise across multiple database technologies

**Polyglot persistence is common in mature architectures.** Start with one or two services and add others as specific workload needs emerge.

---

## Migration Path Considerations

### SQL Server to Azure SQL Database

**Migration tools:**
- [Azure Database Migration Service](https://learn.microsoft.com/en-us/azure/dms/dms-overview){:target="_blank" rel="noopener noreferrer"} (online migration with minimal downtime)
- [Data Migration Assistant](https://learn.microsoft.com/en-us/sql/dma/dma-overview){:target="_blank" rel="noopener noreferrer"} (assess compatibility, identify blockers)
- Backup/restore (for offline migration)

**Compatibility considerations:**
- Azure SQL Database does not support cross-database queries, SQL Agent, or CLR (use SQL Managed Instance if these are required)
- Assess feature usage with Data Migration Assistant before migrating

### MongoDB to Cosmos DB

**Migration tools:**
- [Azure Database Migration Service](https://learn.microsoft.com/en-us/azure/dms/tutorial-mongodb-cosmos-db){:target="_blank" rel="noopener noreferrer"} (online migration)
- Native MongoDB tools (mongodump/mongorestore, mongoexport/mongoimport)

**Compatibility considerations:**
- Cosmos DB MongoDB API supports most MongoDB features but not all (check [compatibility matrix](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/feature-support){:target="_blank" rel="noopener noreferrer"})
- Query performance may differ due to RU model; monitor and tune RU/s provisioning

### On-Premises PostgreSQL/MySQL to Azure

**Migration tools:**
- [Azure Database Migration Service](https://learn.microsoft.com/en-us/azure/dms/){:target="_blank" rel="noopener noreferrer"} (online migration with minimal downtime)
- Native tools (pg_dump/pg_restore for PostgreSQL, mysqldump for MySQL)

**Compatibility considerations:**
- Flexible Server supports most PostgreSQL and MySQL features
- Extensions availability varies (check supported extensions list)
- Assess replication lag tolerance for online migrations

---

## Comparison Table: Azure Database Services

| Service | Workload Type | Consistency | Max Scale | Pricing Model | Multi-Region |
|---------|--------------|-------------|-----------|---------------|-------------|
| **Azure SQL Database** | OLTP (relational) | Strong (ACID) | 100 TB (Hyperscale) | vCore, DTU, serverless | Geo-replication (4 secondaries) |
| **Azure SQL Managed Instance** | OLTP (SQL Server compatible) | Strong (ACID) | 16 TB | vCore | Failover groups (1 secondary) |
| **Azure Database for PostgreSQL** | OLTP (relational) | Strong (ACID) | 16 TB (Flexible Server) | vCore + storage | Read replicas |
| **Azure Database for MySQL** | OLTP (relational) | Strong (ACID) | 16 TB (Flexible Server) | vCore + storage | Read replicas |
| **Cosmos DB** | NoSQL (document, key-value, graph) | Configurable (5 levels) | Unlimited (horizontal scale) | RU/s + storage | Native multi-region writes |
| **Azure Cache for Redis** | In-memory cache | Eventual | 1.2 TB (P5 Premium) | Per GB memory per hour | Geo-replication (Premium+) |
| **Azure Synapse Analytics** | OLAP (data warehouse) | Strong | Petabyte scale | DWU (can pause) | Geo-redundant backups |
| **Azure Data Explorer** | Time-series, logs | Eventual | Petabyte scale | Per cluster size + storage | Follower clusters (read replicas) |
| **Azure Table Storage** | Key-value (simple) | Strong (within partition) | 500 TB per account | Per GB storage + transactions | LRS, GRS, RA-GRS replication |

---

## Side-by-Side with AWS Database Services

| Azure Service | AWS Equivalent | Key Differences |
|--------------|----------------|-----------------|
| **Azure SQL Database** | RDS for SQL Server | Azure SQL Database has intelligent performance features (automatic tuning, query store) and Hyperscale for 100 TB; RDS requires manual performance tuning |
| **Azure Database for PostgreSQL/MySQL** | RDS for PostgreSQL/MySQL | Similar managed service; AWS Aurora (PostgreSQL/MySQL compatible) offers proprietary optimizations not available in Azure |
| **SQL Managed Instance** | RDS for SQL Server (with feature parity closer to on-premises) | Managed Instance is VNet-integrated by default; RDS requires manual VPC configuration |
| **Cosmos DB (SQL API)** | DynamoDB | Cosmos DB offers 5 consistency levels vs DynamoDB's eventual/strong; Cosmos DB supports SQL-like queries natively |
| **Cosmos DB (MongoDB API)** | DocumentDB (deprecated) | AWS DocumentDB is MongoDB-compatible but proprietary; Cosmos DB uses actual MongoDB wire protocol |
| **Cosmos DB (Cassandra API)** | Amazon Keyspaces | Keyspaces is serverless-only; Cosmos DB supports provisioned and serverless |
| **Cosmos DB (Gremlin API)** | Amazon Neptune | Both support Gremlin. Neptune also supports RDF/SPARQL. Cosmos DB supports more APIs in one service |
| **Azure Cache for Redis** | ElastiCache for Redis | Feature parity; Azure offers Enterprise tier with Redis Enterprise modules |
| **Azure Synapse Analytics** | Amazon Redshift | Synapse integrates data warehousing, Spark, and data integration in one service; Redshift is focused on data warehousing only |
| **Azure Data Explorer** | Amazon Timestream | Data Explorer is more general-purpose (logs, telemetry, time-series); Timestream is purpose-built for time-series only |
| **Azure Table Storage** | DynamoDB (basic mode) | Table Storage is cheaper but less feature-rich; DynamoDB has better query capabilities and global tables |

---

## Common Pitfalls

### Pitfall 1: Defaulting to Familiar Technology Without Evaluating Alternatives

**Problem:** Teams choose Azure SQL Database for every workload because of SQL Server familiarity, even when Cosmos DB or Cache for Redis would fit better.

**Result:** Performance suffers under load because the database cannot handle the access pattern. Cost increases as teams over-provision to compensate.

**Solution:** Start with workload characteristics (transaction rate, consistency needs, query patterns, scale requirements). Map characteristics to service strengths. Choose the service that aligns with the workload, not the one the team knows best.

---

### Pitfall 2: Under-Provisioning Cosmos DB RU/s

**Problem:** Provisioning too few Request Units per second (RU/s) for Cosmos DB based on average load without accounting for spikes.

**Result:** Requests get throttled (429 errors) during traffic spikes, causing application errors and poor user experience.

**Solution:** Use autoscale mode to handle variable traffic patterns. Monitor RU consumption with Azure Monitor metrics. Load test the application to determine actual RU/s needs under peak load, then provision accordingly.

---

### Pitfall 3: Using Azure Cache for Redis as a Primary Database

**Problem:** Storing critical data only in Redis without a durable backend, assuming Redis is durable.

**Result:** Data loss when the Redis instance restarts (Standard tier has no persistence) or when cache eviction occurs.

**Solution:** Treat Redis as a cache, not a primary database. Store authoritative data in a durable database like Azure SQL or Cosmos DB and use Redis to cache frequently accessed data. Enable persistence (Premium tier) only when Redis stores state that is expensive to regenerate but not authoritative.

---

### Pitfall 4: Choosing Strong Consistency in Cosmos DB Without Understanding Latency Impact

**Problem:** Selecting strong consistency for Cosmos DB globally distributed across multiple regions, expecting low latency everywhere.

**Result:** Write latency increases because strong consistency requires synchronous replication to a quorum of replicas across regions. Reads also incur higher latency.

**Solution:** Use session consistency (default) for most applications. Reserve strong consistency for workloads where linearizability is a hard requirement (financial transactions, inventory management). Understand that strong consistency in multi-region deployments trades latency for correctness.

---

### Pitfall 5: Not Planning for Database Size Growth

**Problem:** Choosing a database service tier or pricing model based on current size without forecasting growth.

**Result:** Hitting size limits (e.g., Azure SQL Database non-Hyperscale maxes out at 4 TB) and requiring migration to a different tier or service mid-project.

**Solution:** Forecast data growth over 12-24 months. Choose a service tier that supports expected scale. For unpredictable growth, choose services with elastic scaling (Cosmos DB, Azure SQL Database Hyperscale, Synapse Analytics). Avoid services with hard size limits unless growth is predictable and bounded.

---

### Pitfall 6: Ignoring Multi-Region Write Costs in Cosmos DB

**Problem:** Enabling multi-region writes in Cosmos DB for all containers without understanding the cost implications.

**Result:** RU/s costs multiply by the number of write regions. A container provisioned with 10,000 RU/s in 3 write regions costs the same as 30,000 RU/s in a single region.

**Solution:** Enable multi-region writes only for workloads requiring write availability during regional outages or geographically distributed write patterns. For read-heavy workloads, use single-region writes with multi-region reads (much cheaper).

---

### Pitfall 7: Using Serverless Mode for Steady-State Workloads

**Problem:** Choosing Cosmos DB serverless mode for an application with consistent, predictable traffic.

**Result:** Higher costs than provisioned mode because serverless charges per-operation. Serverless also has lower throughput limits and no SLA.

**Solution:** Use serverless mode for intermittent workloads (dev/test, proof-of-concepts, infrequent batch jobs). Use provisioned mode with autoscale for production workloads with variable but consistent traffic patterns.

---

### Pitfall 8: Not Testing Migration at Scale

**Problem:** Testing database migration with a small dataset and assuming the process will work the same at production scale.

**Result:** Migration takes far longer than expected, hits throttling limits, or fails due to incompatibilities only visible with real data volume.

**Solution:** Use Azure Database Migration Service for online migrations with minimal downtime. Test migration end-to-end with a production-sized dataset in a staging environment. Monitor for throttling (especially with Cosmos DB RU/s limits). Validate application performance after migration before cutting over.

---

## Key Takeaways

1. **Workload type drives database selection.** OLTP workloads need strong consistency and relational schemas (Azure SQL, PostgreSQL, MySQL). OLAP workloads need scan performance (Synapse Analytics). NoSQL workloads need flexible schemas and horizontal scale (Cosmos DB). Caching workloads need sub-millisecond latency (Azure Cache for Redis).

2. **Azure SQL Database is the default for transactional workloads.** It provides ACID guarantees, familiar SQL syntax, and strong performance for relational data. Choose PostgreSQL or MySQL for open-source compatibility or specific feature requirements.

3. **Cosmos DB is the default for NoSQL workloads requiring global distribution.** Its five consistency levels, multiple APIs, and elastic horizontal scaling make it suitable for modern distributed applications. Understand the RU/s pricing model and monitor consumption to control costs.

4. **Consistency and latency are trade-offs in Cosmos DB.** Strong consistency provides linearizability but increases latency in multi-region deployments. Session consistency (default) balances latency and correctness for most applications.

5. **Azure Cache for Redis is a cache, not a primary database.** Use it to accelerate read-heavy workloads by caching database query results, session state, or reference data. Always have a durable backend for authoritative data.

6. **Azure Synapse Analytics is purpose-built for large-scale analytics.** Do not use it for transactional workloads. For analytics under a few terabytes, consider Azure SQL Database Hyperscale with columnstore indexes as a simpler and cheaper alternative.

7. **Polyglot persistence is common in mature architectures.** Using the right database for each workload optimizes performance and cost but increases operational complexity. Start with one or two services and expand as needs emerge.

8. **Migration requires planning and testing at scale.** Use Azure Database Migration Service for online migrations with minimal downtime. Test with production-sized datasets to uncover throttling, compatibility issues, or performance regressions.

9. **Pricing models vary significantly across services.** Azure SQL Database uses vCore or DTU. Cosmos DB uses RU/s plus storage. Synapse uses DWU and can be paused. Understand the cost drivers for each service and monitor consumption to avoid surprises.

10. **Multi-region capabilities differ across services.** Cosmos DB supports native multi-region writes. Azure SQL Database uses geo-replication with manual or automatic failover. PostgreSQL and MySQL use read replicas. Choose the service that aligns with your availability and latency requirements across regions.
