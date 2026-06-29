---
title: "Azure SQL Database and Managed Instance"
layout: guide
category: Azure
subcategory: Database Services
description: "Architecture patterns, tier selection, and operational considerations for Azure SQL Database and SQL Managed Instance, including elastic pools, Hyperscale, and migration strategies."
tags: [azure, databases, cloud-computing, scalability, reliability, performance, fundamentals]
---

## What Is Azure SQL Database

[Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/sql-database-paas-overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's managed SQL Server offering for cloud applications. Unlike on-premises SQL Server where you manage the OS, storage, and patches, Azure SQL Database is a fully managed platform-as-a-service where Microsoft handles infrastructure, updates, backups, and high availability.

[Azure SQL Managed Instance](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview){:target="_blank" rel="noopener noreferrer"} is a hybrid option that provides near 100% SQL Server compatibility by running an entire SQL Server instance on managed infrastructure. It sits between Azure SQL Database (highest abstraction, lowest maintenance) and SQL Server on Azure VMs (lowest abstraction, highest control).

### What Problems Azure SQL Solves

**Without a managed database:**
- You manage OS patches, SQL Server patches, and compatibility testing
- Backup strategy, retention policies, and restore procedures are your responsibility
- High availability requires Always-On availability groups, failover clustering, or manual replication
- Scaling requires provisioning new hardware, managing storage growth, and dealing with capacity planning
- Security patches are reactive; you discover vulnerabilities and apply fixes
- Monitoring, alerting, and performance tuning are entirely manual

**With Azure SQL Database or Managed Instance:**
- Microsoft applies patches and security updates automatically with no downtime (or scheduled windows)
- Automated backups with point-in-time restore to any moment in the last 35 days
- Built-in high availability and geo-replication with transparent failover
- Compute scaling happens in seconds without downtime or connection interruption
- Vulnerability scanning and threat detection run continuously
- Performance monitoring and query optimization recommendations are built in
- Compliance certifications (SOC 2, ISO, HIPAA, PCI DSS) are maintained automatically

### How Azure SQL Differs from AWS RDS and Aurora

Architects familiar with AWS should note these differences:

| Aspect | AWS RDS for SQL Server | Azure SQL Database | Azure SQL Managed Instance |
|--------|------------------------|-------------------|---------------------------|
| **Compatibility** | SQL Server with some AWS limitations | SQL Server subset with PaaS optimizations | Nearly 100% SQL Server compatible |
| **Administration** | You manage OS and SQL Server settings | Azure manages everything (limited control) | More server-level control than Database |
| **High availability** | Multi-AZ failover within region | Geo-replication and zone-redundant options | Similar options to Database |
| **Scaling** | Scale compute and storage independently | No downtime scaling (vCore tier) | Limited downtime depending on tier |
| **Backups** | Automated with configurable retention | 35-day point-in-time restore included | Similar to Database |
| **Network isolation** | VPC-based with security groups | VNet integration via Private Endpoints | Requires VNet subnet delegation |
| **Cost model** | Per-instance plus storage | Per-vCore or per-DTU (serverless saves cost) | Higher cost than Database |
| **Best for** | Lift-and-shift from on-premises | Cloud-native applications | Full SQL Server compatibility needed |

---

## Service Tiers and Purchasing Models

Azure SQL Database offers two purchasing models and three service tiers, providing choices for cost, performance, and availability.

### Purchasing Models: DTU vs vCore

**DTU (Database Transaction Unit) Model:**

The DTU model is a bundled measure of compute, memory, and IO. You select a tier (Basic, Standard, Premium) and a specific DTU size (S0, S1, S3, P1, P4, P6, etc.). DTU sizes come in fixed increments; scaling options are limited to the defined SKU set.

| Tier | DTU Range | Use Case |
|------|-----------|----------|
| **Basic** | 5-100 DTUs | Development, testing, or very small applications |
| **Standard** | 100-3,000 DTUs | General production workloads with moderate performance needs |
| **Premium** | 1,250-4,000 DTUs | High-performance workloads; Hyperscale not available in DTU model |

**DTU advantages:**
- Simpler pricing model (all-in-one resource bundling)
- Predictable cost
- No need to understand vCore and storage separately

**DTU disadvantages:**
- Less flexibility (scale only to next DTU tier)
- Cannot access newer features like Hyperscale or SQL Managed Instance capabilities
- More expensive per vCore than vCore model

**vCore (Virtual Core) Model:**

The vCore model separates compute, memory, and storage as independent dimensions. You select the number of vCores, generation (Gen4, Gen5, Fsv2, etc.), and purchase reserved or on-demand. vCore model supports auto-scaling and more granular tier selection.

| Tier | vCore Options | Key Features |
|------|---------------|--------------|
| **General Purpose** | 2-80 vCores | Balanced compute and memory, zone-redundant option, best for most workloads |
| **Business Critical** | 2-80 vCores | Premium storage, in-memory OLTP, higher availability SLA |
| **Hyperscale** | 1-128 vCores | Log service architecture, rapid scaling, thousands of concurrent connections |

**vCore advantages:**
- Fine-grained control (1 vCore increments)
- Access to latest features (Hyperscale, serverless)
- Auto-scaling and serverless options reduce cost for variable workloads
- More cost-effective for large-scale deployments

**vCore disadvantages:**
- More complex (must choose tier, generation, and reserve/on-demand separately)
- Requires understanding of how vCores map to memory and storage

**Migration Path:** If you start with DTU and outgrow it, you must migrate to vCore tier manually (data copy with downtime). Plan for vCore from the start if you anticipate growth.

### Service Tiers (vCore Model)

#### General Purpose Tier

The General Purpose tier is the default choice for most workloads. It provides balanced compute-to-memory ratio (1 vCore = ~5.1 GB memory) suitable for OLTP applications.

**Characteristics:**
- Compute and storage separated (scale independently)
- Zone-redundant option available (replicate across zones)
- Auto-pause in serverless tier (pause when idle, no cost)
- Local SSD storage for data and transaction log (higher performance than Business Critical)

**When to use:**
- Standard OLTP applications
- Cost-sensitive workloads that don't require extreme performance
- Applications with variable load where serverless auto-pause saves cost
- Development and testing environments

**Availability SLA:** 99.9% (multi-zone redundancy available for 99.95% SLA)

#### Business Critical Tier

Business Critical tier prioritizes performance and availability over cost. It uses premium storage, in-memory OLTP, and provides higher read replicas.

**Characteristics:**
- Premium local NVMe SSD storage (very high IO performance)
- In-Memory OLTP (Hekaton) for certain workload optimizations
- Three readable replicas (you can offload read-only queries to secondary replicas)
- Zone-redundant by default
- Higher vCore-to-memory ratio than General Purpose

**When to use:**
- Latency-sensitive OLTP systems (financial, e-commerce, ticketing)
- Workloads requiring maximum availability (read-only replicas for scaling)
- Applications using In-Memory OLTP features
- Compliance workloads requiring maximum redundancy

**Availability SLA:** 99.95% with zone redundancy

#### Hyperscale Tier

Hyperscale is a cloud-native architecture separate from General Purpose and Business Critical. It uses a multi-tiered storage architecture where the log service and page servers are separated from compute.

**Characteristics:**
- Compute and storage completely decoupled
- Up to 128 TB of data per database (vs 4 TB in other tiers)
- Rapid scaling of compute without data movement
- Multiple secondary replicas for read scaling (up to 30 read replicas)
- Supports databases up to 100 GB without performance degradation
- Very high IO throughput (100,000+ IOPs)

**Hyperscale Architecture:**

```
Compute Nodes (query execution)
    ↓
Log Service (persistent redo log, separate from compute)
    ↓
Page Servers (data pages, cached for fast access)
    ↓
Azure Blob Storage (persistent long-term storage)
```

When you scale compute in Hyperscale, only the compute layer scales. Data remains on the page servers, eliminating the data movement overhead that other tiers require. This enables Hyperscale to scale from 1 to 128 vCores in seconds.

**When to use:**
- Very large databases (> 1 TB)
- Workloads with unpredictable scaling patterns
- Applications requiring rapid scaling
- Workloads with extreme IO demands
- Multi-tenant SaaS where per-tenant databases grow large

**Trade-off:** Hyperscale has slightly higher latency than Business Critical for some queries because reads go through the page server layer. For most applications, this is negligible.

### Serverless Compute Tier

Serverless is only available in General Purpose tier (vCore model). It automatically pauses compute when idle and resumes on the next connection.

**How serverless works:**
- Database pauses automatically after a configurable idle period (default 1 hour)
- Next connection triggers automatic resume (takes 10-30 seconds)
- You pay only for the seconds the compute is active
- Storage is always charged (serverless saves on compute only)

**Characteristics:**
- Auto-pause after idle period (configurable 1-4 hours)
- Auto-resume when activity detected
- Min 0.5 vCores (pause tier), max 16 vCores
- Billed per second of compute usage

**When to use:**
- Development and testing environments (pause at night/weekends)
- SaaS applications with many databases and variable usage
- Batch processing jobs that run periodically
- Applications with extended idle periods

**When NOT to use:**
- Workloads that cannot tolerate 10-30 second resume delay
- Always-on systems (continuous background jobs)
- Real-time analytics with frequent queries

---

## Elastic Pools

An Elastic Pool is a shared pool of compute and storage resources distributed across multiple databases. Instead of provisioning capacity for each database's peak load, pools allow multiple databases to share resources, reducing overall cost.

### How Elastic Pools Work

You provision a pool with a capacity (e.g., 200 eDTUs or 40 vCores). Multiple databases (up to 100) run within the pool. Each database has a minimum and maximum reservation, and the pool ensures total reserved capacity does not exceed pool capacity.

**Pool example:**

```
Elastic Pool (40 vCores)
├── Database 1 (min 2, max 8 vCores)
├── Database 2 (min 4, max 12 vCores)
├── Database 3 (min 2, max 10 vCores)
└── Database 4 (min 1, max 8 vCores)

Total Min Reserved: 9 vCores
Total Max Capacity: 38 vCores (within pool's 40)
```

If Database 1 is idle and Database 2 experiences a peak, Database 2 can scale to its maximum (12 vCores) while Database 1 scales down. As long as total reserved capacity (min) is < pool capacity, the pool accommodates variable load.

### Elastic Pool vs Single Databases

| Aspect | Single Database | Elastic Pool |
|--------|-----------------|--------------|
| **Cost efficiency** | Each database pays for peak capacity | Databases share, reducing wasted capacity |
| **Scaling** | Scale compute and storage per database | Scale entire pool; individual DB limits via min/max |
| **Monitoring** | Monitor individual database metrics | Aggregate pool metrics + per-database breakdown |
| **When to use** | Single large application database | Multi-tenant SaaS, multiple independent workloads |

**Cost impact:** Elastic pools reduce cost when you have 4+ databases with non-overlapping peak loads. If you have 2 databases, single databases may be cheaper.

### Pool Sizing Strategy

1. Identify the total peak vCores across all databases (if they peaked simultaneously)
2. Apply a diversity ratio (how often they actually peak together)
3. Size the pool at 60-80% of theoretical peak (leaves headroom for spikes)
4. Set per-database min/max limits based on baseline and peak needs

**Example:**
- 5 databases, each peaking at 10 vCores = 50 vCores theoretical peak
- But they never all peak together; historical data shows ~60% concurrent peak
- Size pool at: 50 × 0.6 × 1.2 (headroom) = 36 vCores
- Set each database: min 4 vCores, max 10 vCores

---

## SQL Managed Instance

SQL Managed Instance runs an entire SQL Server instance on Azure managed infrastructure. It provides near 100% SQL Server compatibility, making it ideal for lift-and-shift migrations from on-premises SQL Server.

### Managed Instance vs Azure SQL Database

| Aspect | Azure SQL Database | SQL Managed Instance |
|--------|-------------------|----------------------|
| **SQL Server Compatibility** | ~95% (subset of features) | ~99% (nearly full compatibility) |
| **Migration from on-premises** | Requires schema and code changes | Minimal changes (SSMS restore works) |
| **Server-level features** | Limited (no SQL Agent or logins) | Full support (SQL Agent, Windows auth) |
| **Cost** | Lower for simple workloads | Higher (full SQL Server instance cost) |
| **Management** | Minimal and fully managed | More control over instance settings |
| **Network requirement** | Private Endpoint only | Requires VNet subnet delegation |
| **Use case** | Cloud-native applications | On-premises SQL Server migration |

### Managed Instance Features

**Full SQL Server instance:**
- SQL Server Agent for jobs and alerts
- Windows authentication and domain integration
- Full T-SQL compatibility (linked servers, CLR code, etc.)
- Server-level principals and database roles
- Database mail
- Replication

**High availability:**
- Always-On Availability Groups within instance (readable secondaries)
- Automatic failover to secondary replica (no manual intervention)
- Managed backup to geo-secondary (cross-region)

**Networking:**
- Requires VNet subnet delegation (reserved subnet for the instance)
- Runs in customer-managed VNet (not shared infrastructure like Database)
- Direct on-premises connectivity possible via VPN/ExpressRoute
- Subnet delegation example: `10.0.0.0/27` for /27 minimum size

### When to Choose Managed Instance Over Azure SQL Database

1. **Extensive SQL Server features:** Your application uses SQL Agent jobs, Windows authentication, replication, or other instance-level features
2. **Minimal code changes:** You want to lift-and-shift an on-premises SQL Server database with SSMS restore
3. **Legacy feature requirements:** Your database relies on CLR code, full-text search, or uncommon SQL Server features
4. **Higher availability SLA:** Managed Instance provides automatic failover within the instance
5. **Multi-tenant consolidation:** You want multiple databases under one managed instance (cost-efficient for several databases)

If your application does not require these features, Azure SQL Database is simpler and cheaper.

---

## High Availability and Geo-Replication

### Built-In High Availability

Both Azure SQL Database and Managed Instance have high availability built in. By default, databases replicate synchronously to a secondary replica.

**How it works:**
1. Every write is committed to primary replica
2. Transaction log is synchronously replicated to secondary replica (no data loss)
3. If primary fails, secondary automatically promotes (transparent failover)
4. Failover typically takes 30-120 seconds (RPO = 0, RTO = seconds)

**Availability SLA:**
- General Purpose (single-zone): 99.9%
- General Purpose (zone-redundant): 99.95%
- Business Critical: 99.95%

Zone-redundant databases replicate across availability zones in the region, surviving entire zone failure.

### Geo-Replication

[Geo-replication](https://learn.microsoft.com/en-us/azure/azure-sql/database/active-geo-replication-overview){:target="_blank" rel="noopener noreferrer"} creates a readable secondary database in a different region. Unlike the built-in HA replica (which is hidden), geo-secondaries are accessible for read operations.

**Active Geo-Replication (legacy):**
- Manually create secondary replicas in other regions
- Asynchronous replication (potential data loss if primary fails)
- Readable secondaries (good for read scaling)
- Manual failover required (you initiate the switchover)

**Auto-failover Groups (preferred):**
- Automatically create and manage secondary replicas
- Automatic failover on primary region failure
- Readable secondaries available during normal operation
- Single connection string handles failover transparently (application does not need to know about secondary)

**Example setup:**
```
Primary: East US
├── Built-in HA replica (same region, hidden)
└── Auto-failover group
    └── Secondary: West US (readable, auto-failovers if East US region fails)
```

### When to Use Geo-Replication

**Use geo-replication when:**
- Your application must survive entire region failure
- Regulatory requirements mandate data residency in multiple regions
- You need read replicas in other regions for latency reduction
- RTO/RPO requirements exceed what built-in HA provides

**Cost impact:** Geo-replication charges for the secondary database compute and storage. Using auto-failover groups with readable secondaries means paying for a full secondary replica.

---

## Security Features

### Transparent Data Encryption (TDE)

[Transparent Data Encryption](https://learn.microsoft.com/en-us/azure/azure-sql/database/transparent-data-encryption-tde-overview){:target="_blank" rel="noopener noreferrer"} encrypts data at rest. The database encryption key is encrypted with a service-managed key (default) or a customer-managed key (in Azure Key Vault).

**Characteristics:**
- Transparent to applications (no code changes)
- Encrypts pages on disk and in backups
- Does NOT encrypt data in memory or in transit
- Enabled by default on all new databases
- Minimal performance overhead

**Service-managed key vs Customer-managed key:**
- **Service-managed:** Microsoft manages key rotation; simpler, lower cost
- **Customer-managed:** You control key rotation and access; required for some compliance frameworks

### Always Encrypted

[Always Encrypted](https://learn.microsoft.com/en-us/azure/azure-sql/database/always-encrypted-landing){:target="_blank" rel="noopener noreferrer"} encrypts sensitive data in the application before sending to the database. The database never sees unencrypted data; encryption happens entirely client-side.

**Characteristics:**
- Client-side encryption (application responsibility)
- Database stores only encrypted values (cannot search or filter encrypted columns)
- Encryption keys never exposed to database server
- Requires application changes (driver support for encryption)
- Good for healthcare (PHI), financial (PCI), or highly sensitive data

**Limitations:**
- Cannot filter queries on encrypted columns (WHERE conditions use encrypted values)
- Requires column encryption keys stored client-side
- More complex application integration than TDE

**When to use:** Only when data sensitivity and compliance requirements justify application complexity.

### Auditing and Threat Detection

[SQL Auditing](https://learn.microsoft.com/en-us/azure/azure-sql/database/auditing-overview){:target="_blank" rel="noopener noreferrer"} logs all database activity to an audit log (stored in Azure Storage or Event Hubs). Every login, query, and DDL operation is recorded.

[Advanced Threat Protection](https://learn.microsoft.com/en-us/azure/azure-sql/database/threat-detection-overview){:target="_blank" rel="noopener noreferrer"} detects suspicious activity (SQL injection attempts, anomalous access patterns, data exfiltration attempts) and sends alerts.

**Audit targets:**
- Azure Blob Storage (long-term retention)
- Event Hubs (real-time streaming to SIEM)
- Log Analytics (query and analyze audit data)

**Common audit findings:**
- Failed login attempts (potential attacks)
- Unusual query patterns (insider threats)
- Privilege escalations (unauthorized access)

### Dynamic Data Masking

[Dynamic Data Masking](https://learn.microsoft.com/en-us/azure/azure-sql/database/dynamic-data-masking-overview){:target="_blank" rel="noopener noreferrer"} masks sensitive data in query results without modifying underlying data. Users see masked values; only users with UNMASK permission see real data.

**Masking functions:**
- **Default:** First and last characters visible; middle masked (XXXX-XX-1234 for credit cards)
- **Email:** First character visible; domain masked (a@XXXX.com)
- **Number:** All zeros (0000000000)
- **Custom:** Define specific replacement pattern

**Use case:** Developers or support team query production data but see masked credit cards, SSNs, and passwords without exposing sensitive values.

---

## Migration from On-Premises SQL Server

Migrating an on-premises SQL Server database to Azure requires assessing compatibility, choosing a target (Database vs Managed Instance), and selecting a migration method.

### Assessment: Database vs Managed Instance

Use the [Azure SQL Migration extension](https://learn.microsoft.com/en-us/sql/dma/dma-overview){:target="_blank" rel="noopener noreferrer"} for Azure Data Studio or the [Data Migration Assistant](https://learn.microsoft.com/en-us/sql/dma/dma-overview){:target="_blank" rel="noopener noreferrer"} to assess compatibility.

**Compatibility check identifies:**
- Breaking changes (features not supported in target)
- Deprecated features
- Behavior changes (might require code adjustments)
- Performance considerations

**Decision tree:**

```
Does your database use:
- SQL Agent jobs?
- Windows authentication?
- Replication?
- Advanced CLR features?
- Linked servers to other instances?
→ If YES to any: Managed Instance
→ If NO: Azure SQL Database (simpler, cheaper)
```

### Migration Methods

**1. SSMS Backup and Restore (Managed Instance only)**
- Create backup of on-premises database
- Restore to Managed Instance using SSMS (simplest for full compatibility)
- Downtime = backup + restore time (typically 10 minutes to hours)

**2. Azure Database Migration Service**
- Supports online migration (minimal downtime)
- Handles schema, data, and logins
- Supports both Database and Managed Instance
- Good for large databases with downtime constraints

**3. BACPAC Export/Import**
- Export on-premises database as BACPAC file
- Import into Azure SQL Database
- Simpler than DMS; requires downtime for data consistency
- File size limits (~200 GB for public cloud)

**4. Native Replication**
- Use SQL Server replication or Always-On Availability Groups
- Set up continuous sync, then cutover
- Good for minimizing downtime
- More complex setup

### Common Migration Issues

**Issue: Unsupported T-SQL features**
- On-premises uses `xp_cmdshell` for system commands
- Azure SQL does not support extended stored procedures
- Solution: Refactor code to use supported features or migrate to Managed Instance

**Issue: Windows authentication required**
- On-premises uses Windows logins
- Azure SQL Database supports only SQL authentication
- Solution: Create SQL logins and update connection strings, or use Managed Instance with Windows auth via domain join

**Issue: Large database cannot import via BACPAC**
- BACPAC export limited to ~200 GB
- Solution: Use DMS for online migration or Managed Instance restore

---

## Architectural Patterns

### Pattern 1: Multi-Tenant SaaS with Elastic Pools

**Use case:** SaaS application with hundreds or thousands of customer databases, each with variable load.

```
Elastic Pool (40 vCores shared across tenants)
├── Customer 1 Database (min 2, max 8 vCores)
├── Customer 2 Database (min 2, max 8 vCores)
├── Customer 3 Database (min 1, max 4 vCores)
└── ... (up to 100 databases per pool)

Private Endpoint → Each customer accesses their database
```

**Design considerations:**
- Pool size based on observed diversity ratio (not all customers peak simultaneously)
- Per-database min/max reserves based on customer tier (gold tier gets higher max)
- Monitoring pool health; scale pool when utilization consistently > 80%
- Separate pools for different customer tiers if load patterns differ significantly

**Cost benefit:** Running 50 customer databases in one elastic pool can cost 50-70% less than 50 single databases, because customers do not all peak together.

---

### Pattern 2: Application + Analytics Tier Separation

**Use case:** OLTP application with near-real-time analytics; need to isolate analytics queries from application queries.

```
Primary: Azure SQL Database (Business Critical)
├── Application workload (OLTP queries)
├── Auto-failover group
│   └── Secondary: Readable replica in different region
└── Read replica (local): Offload analytics queries
```

Alternative: Use geo-replication with readable secondaries.

**Design considerations:**
- Primary handles all writes from application
- Readable secondary in same region offloads SELECT queries (reports, analytics)
- Secondary in different region provides disaster recovery (automatic failover)
- Application uses router/connection string that sends reads to secondary, writes to primary
- Index strategy: Create indexes optimized for analytics queries on secondary

---

### Pattern 3: Migration from On-Premises with Hybrid Connectivity

**Use case:** Gradual migration from SQL Server on-premises to Azure SQL Managed Instance.

```
On-Premises SQL Server (remains authoritative)
    ↓
Azure SQL Managed Instance (read replica initially)
    ↓
Cutover: Switch application to Managed Instance
    ↓
Decommission on-premises (after validation period)
```

**Steps:**
1. Set up VPN/ExpressRoute from on-premises to Azure VNet
2. Restore on-premises backup to Managed Instance
3. Configure transactional replication or Always-On availability group with on-premises as primary
4. Application continues reading from on-premises, validates data in Managed Instance
5. Cutover: Switch application connection string to Managed Instance
6. Monitor for issues, then decommission on-premises server

**Benefit:** Minimal downtime; can validate Managed Instance before full cutover.

---

## Common Pitfalls

### Pitfall 1: Choosing DTU Model When You Need Flexibility

**Problem:** You select DTU tier for a new application, later discover your workload needs Hyperscale's rapid scaling or serverless features.

**Result:** Must migrate database to vCore tier (involves data copy, potential downtime, connection string changes).

**Solution:** Start with vCore model even for small applications. The migration pain is not worth the initial savings. vCore provides a clear upgrade path and access to newer features.

---

### Pitfall 2: Not Planning Elastic Pool Diversity

**Problem:** You create an elastic pool assuming all databases will share load evenly, but they have completely non-overlapping peak loads (one peaks at 6am, another at 2pm).

**Result:** Pool utilization is poor; you pay for capacity that sits idle during off-peak hours. Single databases would have been cheaper.

**Solution:** Analyze historical load patterns before designing pools. Use Azure Advisor recommendations to right-size pools. Consolidate databases with complementary load patterns into same pool.

---

### Pitfall 3: Hyperscale Latency Surprise

**Problem:** You migrate a latency-sensitive OLTP workload to Hyperscale expecting identical performance, but see increased latency on certain query patterns.

**Result:** Queries that hit the page server layer have slightly higher latency than General Purpose or Business Critical.

**Solution:** Benchmark latency-critical queries before migration. Most queries see no difference. If you need absolute lowest latency and page server overhead is problematic, Business Critical tier is better choice (you sacrifice scale for latency).

---

### Pitfall 4: Forgetting Geo-Replication Cost

**Problem:** You enable geo-replication thinking it provides disaster recovery with minimal cost, but the secondary replica charges fully.

**Result:** Monthly bill doubles (you pay for primary + full secondary database).

**Solution:** Understand that active geo-replication with readable secondaries costs the same as running two databases. If cost is concern, use auto-failover group but make secondary not readable (reduces cost slightly), or evaluate cold standby patterns (restore from backup on failure).

---

### Pitfall 5: Serverless Auto-Pause Causing Production Incidents

**Problem:** You use serverless tier in production expecting it to pause at night, but application has background jobs that run every 30 minutes. Database pauses and causes 30-second delay on job execution.

**Result:** Background jobs fail, monitoring alerts trigger, on-call engineer investigates at night.

**Solution:** Use serverless only in true dev/test. Production workloads with any continuous background activity should use provisioned compute. If you want to save cost with unpredictable load, use General Purpose with auto-pause disabled but rely on serverless's pay-per-second model.

---

### Pitfall 6: Encryption Key Mismanagement

**Problem:** You enable Always Encrypted or customer-managed TDE with encryption keys in Azure Key Vault, but never document where keys are stored or who has access.

**Result:** When you need to recover a database, keys are inaccessible or access controls were accidentally revoked.

**Solution:** Document encryption key location and access policies. Use Azure Key Vault RBAC to manage access explicitly. For customer-managed keys, implement automated key rotation policies and test key recovery procedures.

---

## Key Takeaways

1. **Start with vCore model for new applications.** DTU model is legacy; vCore provides better pricing, flexibility, and access to modern features like Hyperscale and serverless.

2. **Azure SQL Database is the default choice for cloud-native applications.** It is simpler, cheaper, and fully managed. Use Managed Instance only when your workload requires near-100% SQL Server compatibility or extensive instance-level features.

3. **Elastic pools reduce cost for multi-tenant SaaS workloads with non-overlapping load patterns.** Calculate the diversity ratio (concurrent peak load as % of theoretical peak) and size pools at 60-80% of theoretical peak to save money.

4. **Zone-redundant deployment and geo-replication address different failure scenarios.** Zone redundancy survives entire AZ failure within a region (RTO seconds). Geo-replication survives entire region failure (RTO minutes, higher cost). Use both for critical applications.

5. **Hyperscale separates compute and storage, enabling rapid scaling without data movement.** For databases larger than 4 TB or workloads requiring seconds-scale compute changes, Hyperscale is worth the marginal cost.

6. **High availability with automatic failover is built in; you do not need to provision a secondary replica explicitly.** Default HA ensures RPO = 0 and RTO = 30-120 seconds within a region.

7. **Private Endpoints eliminate public internet exposure for database connections.** Always use Private Endpoints in production; service endpoints are acceptable only for non-critical workloads.

8. **TDE is enabled by default and transparent to applications.** For highly sensitive data, layer Always Encrypted on top of TDE to encrypt at the application level.

9. **Managed Instance is better for lift-and-shift migrations from on-premises SQL Server.** The backup-and-restore method minimizes migration downtime and avoids schema translation challenges.

10. **Assess compatibility early with the Data Migration Assistant.** It identifies breaking changes, unsupported features, and effort required for target platform (Database vs Managed Instance).
