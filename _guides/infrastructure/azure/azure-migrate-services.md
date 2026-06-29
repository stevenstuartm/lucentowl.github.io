---
title: "Azure Migrate & Database Migration Service"
layout: guide
category: Azure
subcategory: Migration & Hybrid Cloud
description: "Azure Migrate hub for server discovery and assessment, Database Migration Service for schema and data migration, and App Service Migration Assistant for web application moves"
tags: [azure, cloud-computing, infrastructure, databases, modernization, automation, practical]
---

## What Is Azure Migrate

[Azure Migrate](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview){:target="_blank" rel="noopener noreferrer"} provides a unified platform for assessing your on-premises environment and planning migration strategies. It combines discovery tools, assessment engines, and migration pathways to orchestrate the entire migration journey. The service handles servers, databases, web applications, and data boxes as part of a cohesive approach to cloud migration.

Unlike point solutions, Azure Migrate centralizes all migration activities in a single project. This eliminates duplicate effort, simplifies tracking, and provides consistent assessment data across migration waves.

### What Problems Azure Migrate Solves

**Without Azure Migrate:**
- Manual inventory of on-premises servers and applications takes months
- Discovery information is scattered across disconnected tools and spreadsheets
- Assessment criteria vary across teams, leading to inconsistent prioritization
- Migration planning requires separate tools for servers, databases, and applications
- Dependency mapping is manual and error-prone
- Business case and ROI calculations are disconnected from actual assessment data

**With Azure Migrate:**
- Automated discovery of servers, applications, and dependencies across the data center
- Unified assessment workspace with consistent cost and readiness criteria
- Dependency visualization showing what servers and applications depend on each other
- Multiple migration tools integrated in a single project (servers, databases, apps)
- Right-sizing recommendations based on actual performance data
- Business case with cost comparison (on-premises vs. Azure)

### How Azure Migrate Differs from AWS Migration Hub

Architects familiar with AWS should note the key differences:

| Aspect | AWS Migration Hub | Azure Migrate |
|--------|-------------------|----------------|
| **Discovery scope** | Servers and databases (limited) | Servers, databases, web apps, and dependencies |
| **Assessment models** | Database Schema Conversion Tool (SCT), Database Migration Service (DMS) | Multiple built-in tools (Server Assessment, Database Assessment, Web App Assessment) |
| **Dependency mapping** | Application Migration Service (MGN), Database Migration Accelerator | Dependency analysis agent built into Azure Migrate appliance |
| **Cost modeling** | AWS Cost Calculator integration | Azure cost modeling with on-premises comparison |
| **Unified project** | Migration tools are separate services | All tools share one Migrate project and workspace |
| **Agentless vs agent-based** | MGN supports both (agent-based emphasis) | Supports both; appliance provides unified gateway |
| **Application refactoring** | Separate service (Application Migration Service) | App Service Migration Assistant, containerization tools |

---

## Core Migration Path Selection

The first step in any migration is understanding what path each workload will take. Azure migration paths fall into three categories: **Rehost** (lift-and-shift), **Replatform** (lift, tinker, and shift), and **Refactor** (modernize).

### Server Migration Paths

**Rehost (IaaS VMs):** The workload runs on Azure VMs with minimal changes. This is the fastest path for applications that can run on Windows or Linux without modification.

**Replatform (managed services):** The workload moves to a managed service that provides the same functionality with less operational overhead. Examples include SQL Server → Azure SQL Database, on-premises web server → App Service, or custom app → Azure Container Instances.

**Refactor (cloud-native):** The application is rewritten to take advantage of cloud-native patterns. This is the slowest path but provides the most long-term benefit through better scalability, cost, and agility.

### Database Migration Paths

SQL Server migrations have multiple target options, each with different characteristics:

**Azure SQL Database:** Fully managed relational database service. Best for applications that need a managed SQL engine without operational overhead. Limitations include managed instance-specific features not available in the standard database.

**SQL Managed Instance:** Fully managed with near-complete SQL Server compatibility. Supports SQL Server Agent, cross-database transactions, and most advanced features. Higher cost than SQL Database but fewer migration changes.

**SQL Server on Azure VMs:** Self-managed SQL Server on virtual machines. Best when you need specific SQL Server versions, extensions, or full control over the database engine.

**Azure Cosmos DB:** For applications that need document or key-value NoSQL database capabilities. Requires application changes but provides global scale and serverless pricing options.

---

## Azure Migrate Appliance

The [Azure Migrate appliance](https://learn.microsoft.com/en-us/azure/migrate/migrate-appliance){:target="_blank" rel="noopener noreferrer"} is a lightweight virtual machine deployed in your on-premises environment. It discovers servers, collects performance data, and analyzes application dependencies.

### How the Appliance Works

The appliance is deployed as a Hyper-V VM, VMware VM, or physical server (for environments without virtualization). Once deployed:

1. **Discovers servers:** Uses WMI and SSH to enumerate installed servers and basic configuration
2. **Collects performance data:** Monitors CPU, memory, disk I/O, and network performance over 1-2 weeks
3. **Maps dependencies:** Uses lightweight agents or agentless analysis to understand which servers communicate with each other
4. **Sends data to Azure:** Uploads discovery and performance data to your Migrate project

The appliance communicates outbound to Azure over HTTPS. It does not require inbound connectivity from Azure.

### Agentless vs Agent-Based Dependency Mapping

**Agentless dependency analysis** uses network traffic analysis. The appliance captures network flows and infers which servers communicate. This requires no agent installation and works across operating systems. The downside is reduced accuracy; it shows network dependencies but not application-level logic.

**Agent-based dependency analysis** uses the Dependency Agent installed on each server. Agents provide deep visibility into process-to-process communication, including services on the same server. This is more accurate but requires installing software on every server you want to analyze. The agent is built by Microsoft but also available in other ecosystems (useful if you have multi-cloud migrations).

Most organizations start with agentless analysis for initial assessment, then install agents on key servers to understand dependencies in detail before migration.

---

## Server Migration: Replication and Cutover

Once a server is assessed and approved for migration, Azure provides two replication approaches.

### Agentless Replication (Server Migration Tool)

The [Azure Migrate: Server Migration tool](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview#azure-migrate-server-migration-tool){:target="_blank" rel="noopener noreferrer"} (also called Azure Migrate: Server Migration) uses a lightweight replication appliance to continuously copy disk data from the source server to Azure managed disks without installing an agent on the source.

**How agentless replication works:**

1. Deploy the replication appliance in the on-premises environment (similar network location as Migrate appliance)
2. Select servers to replicate
3. Appliance continuously syncs disk data to managed disks in Azure
4. On cutover day, stop the source VM and perform a final sync
5. Start the Azure VM
6. Verify functionality and complete the migration

**Characteristics:**
- No agent installation on source servers
- Minimal performance impact during replication
- Source VM runs normally during migration
- Replication can be paused and resumed without data loss
- Cutover is quick (minutes to tens of minutes depending on final sync size)
- Works for VMware, Hyper-V, and physical servers
- Best for large-scale migrations (hundreds of servers)

### Agent-Based Replication (Site Recovery)

[Azure Site Recovery](https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-overview){:target="_blank" rel="noopener noreferrer"} is an alternative that requires installing a mobility service agent on each source server. The agent sends block-level changes to Azure in real-time.

**How agent-based replication works:**

1. Install the mobility service agent on each source server (Windows and Linux supported)
2. Configure replication targets (managed disk size, resource group, subnet)
3. Agent continuously sends disk changes to Azure
4. Perform a test failover to validate Azure VM functionality
5. Execute final cutover with minimal downtime (seconds to minutes)
6. Verify and commit the migration

**Characteristics:**
- Requires agent installation (can complicate compliance)
- Real-time replication with recovery point objectives (RPOs) under 1 minute
- Works for VMware, Hyper-V, and physical servers (and other clouds like AWS)
- More granular control over replication timing
- Native integration with Site Recovery for on-premises disaster recovery use cases
- Better when existing Site Recovery infrastructure is in place

### Choosing Between Approaches

Use **agentless replication** for:
- Large-scale migrations with hundreds or thousands of servers
- When minimal source server impact is required
- First-time cloud migrations without existing disaster recovery setup

Use **agent-based replication** for:
- Small-scale migrations (dozens of servers)
- When you need sub-minute recovery point objectives
- Environments already using Site Recovery for disaster recovery

---

## Database Migration Service

The [Azure Database Migration Service](https://learn.microsoft.com/en-us/azure/dms/dms-overview){:target="_blank" rel="noopener noreferrer"} (DMS) handles schema and data migration for databases. It supports multiple source and target database types.

### DMS Replication Modes

DMS operates in two modes for different cutover scenarios.

**Offline migration** moves the entire database in one operation. The source database is taken offline, schema is migrated, data is copied, and then the application fails over to the target. This is straightforward but requires an outage window. Best for databases where downtime is acceptable or unavoidable.

**Online migration** continuously replicates source database changes to the target while keeping the source active. The application continues working with the source database while DMS replicates changes in the background. At cutover time, the application switches to the target with minimal downtime (seconds). Best for large databases where downtime is unacceptable.

Online mode is significantly more complex operationally. DMS must capture transaction logs or change data capture (CDC) streams from the source and continuously apply them to the target. This requires:
- Source database connectivity and permissions to read transaction logs
- Target database accepting changes during the replication phase
- Careful sequencing to ensure consistency before final cutover

### Supported Database Sources and Targets

DMS supports migrations between various database systems:

| Source | Targets |
|--------|---------|
| SQL Server | Azure SQL Database, SQL Managed Instance, SQL on VMs, Azure Cosmos DB (via API) |
| MySQL | Azure Database for MySQL, Amazon RDS MySQL |
| PostgreSQL | Azure Database for PostgreSQL, Amazon RDS PostgreSQL |
| MongoDB | Azure Cosmos DB, MongoDB on VMs |
| Oracle | Azure Database for PostgreSQL, Amazon RDS |
| Cassandra | Azure Cosmos DB Cassandra API |
| MariaDB | Azure Database for MariaDB |

Each source-target combination has specific requirements and limitations. For example, SQL Server to SQL Database requires schema compatibility (no cross-database queries, limited agent functionality), while SQL Server to SQL Managed Instance has near-complete compatibility.

### Pre-Migration Schema Validation

Before data migration, the schema must be compatible with the target. For SQL Server migrations, this means:

- Converting or removing unsupported T-SQL syntax
- Rewriting stored procedures that use on-premises-specific features
- Adjusting security models (SQL Server logins → Azure AD authentication)
- Updating connection strings and application configuration

The [SQL Server Migration Assistant (SSMA)](https://learn.microsoft.com/en-us/sql/ssma/sql-server-migration-assistant){:target="_blank" rel="noopener noreferrer"} helps identify schema incompatibilities and generates conversion reports. DMS provides data validation tools to compare source and target schemas after migration.

---

## App Service Migration Assistant

Web applications on-premises can migrate to Azure App Service. The [App Service Migration Assistant](https://learn.microsoft.com/en-us/azure/app-service/app-service-migration-assistant){:target="_blank" rel="noopener noreferrer"} assesses web application readiness and assists with migration.

### How App Service Migration Works

1. **Assessment:** The tool scans the on-premises web application for App Service compatibility issues (unsupported modules, runtime dependencies, configuration)
2. **Remediation:** Identifies what configuration changes are needed before migration
3. **Migration:** Packages the application (code, configuration, certificates) and deploys to App Service
4. **Validation:** Runs tests to verify the application works in App Service

### Application Readiness Criteria

App Service supports Windows and Linux runtime stacks. IIS-hosted .NET applications typically migrate to Windows App Service. Java, PHP, Python, and Node.js applications can use either platform.

Compatibility issues include:
- Direct file system access (App Service is multi-tenant; filesystem is isolated)
- Registry access (Windows App Service does not expose the registry)
- Specific IIS extensions or modules not available in App Service
- Binary dependencies or third-party libraries requiring installation
- Legacy .NET Framework versions (though .NET Framework 4.8 is supported)

### Modernization Opportunities

Beyond simple rehosting, App Service enables modernization patterns:

- **Containerization:** Package the application as a Docker image and run on App Service Linux or Container Instances
- **API-first architecture:** Split monolithic applications into microservices and host each as a separate App Service instance
- **Managed databases:** Replace custom-managed databases with Azure SQL Database or other managed services
- **CDN integration:** Serve static assets through Azure CDN for faster global distribution

---

## Dependency Analysis and Mapping

Understanding application dependencies is critical for safe migration. Azure Migrate provides two approaches.

### Server-to-Server Dependencies

The dependency agent captures network connections between servers. This shows which servers talk to which other servers, enabling you to group dependent servers for migration together. The visualization helps identify:

- Critical servers that many others depend on (should migrate early)
- Clusters of tightly coupled servers (should migrate together)
- External dependencies (connections to systems outside your scope)

### Application-to-Database Dependencies

Database migrations require understanding which applications depend on that database. A careless database migration can break applications that depend on specific schemas, stored procedures, or indexes.

Azure Migrate provides application discovery that maps applications to databases. Combined with server dependency analysis, this gives you the full picture of what needs to migrate together.

---

## Migration Validation and Testing

Before fully committing to a migrated workload, validation ensures the Azure version behaves identically to the on-premises version.

### Test Failover (for servers)

For server migrations, Azure provides a test failover capability. The migrated VM is started in a test network (isolated from production) so you can:

- Verify the VM boots and services start
- Test application functionality
- Validate database connectivity
- Check network configuration and DNS resolution
- Run automated smoke tests

After testing, the test failover is rolled back without affecting the production migration, and then the actual cutover can proceed with confidence.

### Data Validation (for databases)

DMS provides data validation tools that compare source and target databases row-by-row to ensure no data was lost or corrupted during migration. This verification can be automated and run continuously during online migration.

### Performance Testing

The application behavior under load may differ between on-premises and Azure due to different hardware, networking, or configuration. Run your standard performance tests against the migrated workload with realistic load profiles before declaring the migration complete.

### Rollback Planning

Every migration should have a rollback plan. For server migrations, keep the source VM running for at least 24-48 hours after cutover. For database migrations, maintain a backup of the source database and validate that the application can be reverted to point-in-time copies if needed.

---

## Post-Migration Optimization

After a successful migration, Azure provides tools to optimize cost and performance.

### VM Right-Sizing

Azure VMs are available in many sizes. Initial migration assessments recommend VM sizes based on on-premises hardware specifications, but post-migration monitoring often reveals opportunities for downsizing. Run workloads for 2-4 weeks and collect performance data, then resize to smaller SKUs if the workload is underutilizing the current size.

### Reserved Instances and Savings Plans

Azure Reserved Instances (RIs) provide discounts (up to 72%) for committed 1-year or 3-year capacity. After migrations stabilize and workload patterns are clear, purchase RIs for long-running production workloads. Azure Savings Plans provide similar discounts for flexible consumption across different VM families.

### Storage Optimization

On-premises storage is often provisioned with generous margins. Migrated storage can often be optimized:

- Convert hot storage tiers (frequently accessed) to cool or archive for infrequently accessed data
- Enable deduplication and compression on Azure Storage
- Use blob storage tiering to automatically move data between tiers based on access patterns

### Database Performance Tuning

Databases may require index rebuilds, statistics updates, or query plan changes after migration. Run the Database Tuning Advisor on Azure SQL databases to identify missing indexes. Review expensive queries in Query Store and optimize before declaring the migration complete.

### Dependency and Lifecycle Management

Post-migration, update configuration management databases (CMDBs) and infrastructure-as-code templates to reflect the Azure environment. Establish governance to prevent drift between intended and actual configurations.

---

## Comparison with AWS Migration Services

Architects evaluating Azure migration services alongside AWS should understand these key differences:

| Aspect | AWS | Azure |
|--------|-----|-------|
| **Unified project workspace** | Migration Hub (servers/DBs), Database Migration Service (separate), Application Migration Service (separate) | Azure Migrate (servers, DBs, apps unified) |
| **Server agentless replication** | Application Migration Service (MGN); most common path | Server Migration tool (newer, less mature than MGN) |
| **Server agent-based replication** | AWS DataSync (limited) | Azure Site Recovery (mature, widely used) |
| **Cost modeling** | AWS Migration Readiness Tool, Cost Calculator (separate) | Built into Migrate project with on-premises comparison |
| **Database conversion** | Database Schema Conversion Tool (SCT); free, standalone | DMS includes schema conversion and data migration |
| **Online database migration** | Supported (DMS) | Supported (DMS) with continuous validation |
| **Application containerization** | AWS App2Container | App Service Migration Assistant, Azure Container Registry |
| **Dependency mapping** | AWS Application Discovery Service | Built into Azure Migrate appliance |
| **Integrated compliance** | Limited (third-party tools) | Azure Policy, governance built into Migrate project |

Azure Migrate integrates more services into a single project, reducing tool switching and context changes. AWS Migration Hub requires combining separate services for a complete view.

---

## Architectural Patterns

### Pattern 1: Large-Scale Rehost Migration

**Use case:** Data center consolidation with thousands of servers, minimal budget for application changes.

**Approach:**
1. Deploy Azure Migrate appliance in data center
2. Discover all 2,000+ servers automatically
3. Run agentless dependency analysis
4. Group servers into migration waves (50-100 servers per wave)
5. Migrate each wave using Server Migration tool (agentless replication)
6. Run test failover for each wave before production cutover
7. Perform rolling production cutover to minimize downtime

**Timeline:** 4-6 months for discovery, assessment, and planning; 3-6 months for actual migration waves

**Operational considerations:**
- Establish a cutover window strategy (migrate one group per week/month)
- Maintain the source data center during cutover windows for rollback capability
- Update DNS records batch-wise as servers migrate
- Coordinate with networking team for VNet and peering configuration

---

### Pattern 2: Mixed Rehost and Replatform

**Use case:** Modernize strategically while minimizing risk by rehosting most servers but replatforming databases and web applications.

**Approach:**
1. Use Azure Migrate for server assessment; migrate via Server Migration tool
2. Assess databases separately for replatform opportunities:
   - Lift SQL Server to SQL Managed Instance with minimal schema changes
   - Migrate application databases before application servers for timing independence
3. Assess web applications for App Service compatibility
4. Migrate in order: databases → applications → dependent servers

**Timeline:** 6-9 months due to application testing and validation needs

**Operational considerations:**
- Database migration may happen weeks before application migration
- Plan connection string updates and environment variable configuration
- Test application against migrated database on non-production first
- Coordinate release schedules between platform teams and application teams

---

### Pattern 3: Online Database Migration with Zero Downtime

**Use case:** Business-critical database where downtime is unacceptable.

**Approach:**
1. Use DMS for online migration of SQL Server to SQL Managed Instance
2. Enable continuous replication with transaction log capture
3. Run nightly validation comparing source and target checksums
4. Perform test cutover (switch application to target, validate, switch back)
5. Execute final cutover during low-traffic window
6. Monitor replication lag during cutover to confirm consistency

**Timeline:** 2-4 weeks for setup and validation; 1-2 hours for actual cutover

**Operational considerations:**
- Requires near-perfect network connectivity between on-premises and Azure
- Plan for potential replication lag during high-traffic periods
- Have rollback procedure ready (revert connection strings, restore from backup)
- Test cutover procedures multiple times before production cutover

---

## Common Pitfalls

### Pitfall 1: Incomplete Dependency Analysis

**Problem:** Migrating a database before the applications that depend on it are ready, or migrating a critical server that other servers need for authentication/logging.

**Result:** Post-migration failures when dependencies are not available. Applications cannot connect to the database. Servers cannot authenticate against the on-premises domain controller still in the data center.

**Solution:** Complete dependency analysis before migration. Run agentless analysis first for quick results, then install agents on high-value servers for detailed analysis. Group dependent workloads into migration waves so dependencies migrate together.

---

### Pitfall 2: Schema Incompatibilities Not Caught During Assessment

**Problem:** Assessing a SQL Server database as compatible with Azure SQL Database, then discovering during migration that stored procedures use unsupported T-SQL syntax.

**Result:** Data migration fails or succeeds but application cannot call stored procedures. Requires emergency schema conversion and application testing.

**Solution:** Run the SQL Server Migration Assistant (SSMA) to generate a compatibility report before migration. Review the report for unsupported features. For SQL Database (not Managed Instance), plan schema changes in advance.

---

### Pitfall 3: Cutover Without Validation

**Problem:** Migrating a server or database, assuming it works, and only discovering issues after the on-premises version is shut down.

**Result:** Production outage. No way to roll back without manual data recovery from backups.

**Solution:** Always run test failover for servers and test cutover for databases before production cutover. Automate smoke tests (application startup, database connectivity, key business functions). Keep source systems online for at least 24-48 hours after cutover.

---

### Pitfall 4: Network Bandwidth Constraints During Migration

**Problem:** Planning to migrate a large database over a narrow network link (e.g., 100 Mbps internet connection to data center).

**Result:** Migration takes weeks. Replication appliance becomes a bottleneck. Each subsequent migration wave waits for the previous to complete.

**Solution:** Assess network capacity before migration. For large databases (>100 GB), consider Azure ExpressRoute or Azure Data Box for faster data transfer. For server migrations, prioritize migration waves by dependencies rather than size.

---

### Pitfall 5: Not Planning for Application Configuration Changes

**Problem:** Migrating servers with hardcoded on-premises IP addresses or hostnames, then discovering that applications fail when pointing to Azure VMs.

**Result:** Applications cannot resolve DNS, connect to wrong services, or fail to authenticate against Azure-based directory services.

**Solution:** Document all configuration dependencies during assessment. Update connection strings, environment variables, and DNS records before application cutover. Use infrastructure-as-code to manage configuration instead of manual changes.

---

## Key Takeaways

1. **Azure Migrate is the unified starting point for all workload migrations.** It combines discovery, assessment, and planning tools in a single project, eliminating the need to switch between disconnected services.

2. **Server migration can be agentless or agent-based.** Agentless replication via Server Migration tool scales to thousands of servers with minimal source impact. Agent-based replication via Site Recovery provides real-time synchronization for smaller migrations.

3. **Database migrations require path selection before cutover.** Choose between SQL Database (managed, limited compatibility), SQL Managed Instance (managed, near-complete compatibility), or SQL on VMs (self-managed, full compatibility) based on application requirements and operational preferences.

4. **Dependency analysis prevents post-migration failures.** Incomplete dependency understanding is the most common source of failed migrations. Use agentless analysis for initial view and agent-based analysis for detailed application dependencies.

5. **Online database migration eliminates downtime for critical databases.** DMS online mode continuously replicates changes, enabling zero-downtime cutover for applications that cannot tolerate outages.

6. **Test failover and validation are non-negotiable.** Every migrated workload should be validated in an isolated network before production cutover. Keep source systems available for 24-48 hours post-cutover for emergency rollback.

7. **Post-migration optimization reduces cloud costs significantly.** VM right-sizing, reserved instances, and storage optimization can reduce migration costs by 30-50% compared to initial assessments.

8. **App Service Migration Assistant modernizes as it migrates.** Web applications can rehost quickly or modernize through containerization and microservices patterns. The choice depends on application complexity and modernization appetite.

9. **Online vs. offline database migration trades speed for complexity.** Offline migration is simple but requires an outage window. Online migration is complex but enables zero-downtime cutover for critical databases.

10. **Migration planning is the most critical success factor.** Detailed dependency analysis, schema compatibility validation, and cutover procedure testing determine migration success. Rushing planning to accelerate migration execution typically results in extended timelines due to rework.
