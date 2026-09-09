---
title: "Azure Migrate & Database Migration Service"
layout: guide
category: Azure
subcategory: Migration & Hybrid Cloud
description: "The Azure Migrate appliance and its discovery limits, agentless and agent-based server replication, the Database Migration Service scenario matrix and its offline/online asymmetry, and how to validate a cutover before committing to it."
tags: [azure-migrate, database-migration-service, sql-migration, dependency-analysis, replication, app-service-migration, practical]
---

## What Azure Migrate Is

[Azure Migrate](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview){:target="_blank" rel="noopener noreferrer"} is the discovery, assessment, and migration hub for servers, databases, web apps, and virtual desktops. It centralizes migration activity in a single project so assessment data stays consistent across waves instead of scattering across spreadsheets and point tools.

The service itself is free. You pay for the Azure resources you migrate into, for storage and network consumed during replication, and for partner tools if you use them.

### What it replaces

**Without it:**
- Manual inventory of servers and applications takes months and is stale on arrival
- Discovery data scatters across disconnected tools
- Assessment criteria vary by team, producing inconsistent prioritization
- Server, database, and application planning happen in separate tools with no shared view
- Dependency mapping is manual and misses what nobody thought to look for
- Business case numbers are disconnected from measured utilization

**With it:**
- Automated discovery of servers, installed software, SQL instances, web apps, and dependencies
- One assessment workspace with consistent readiness and cost criteria
- Right-sizing driven by collected performance data rather than by on-premises hardware specs
- A business case computed from what the estate actually consumes

### Two experiences, and the docs pivot between them

The current **Azure Migrate** experience is application-aware and supports cross-workload views. **Azure Migrate Classic** is the older experience and does not. Learn documentation is pivoted between the two, so a procedure that does not match your portal is often a procedure written for the other one. Check which moniker a page is showing before following it.

### How Azure Migrate compares to AWS

| Capability | AWS | Azure |
|---|---|---|
| **Discovery and inventory** | Application Discovery Service, reporting into Migration Hub | Azure Migrate appliance, reporting into the Migrate project |
| **Dependency mapping** | Application Discovery Service agents | Agentless network-flow analysis or the Dependency Agent, both in the same project |
| **Server replication** | Application Migration Service (MGN), agent-based | Migration and modernization, agentless for VMware or agent-based for everything else |
| **Database migration** | AWS DMS, with DMS Schema Conversion (standalone SCT is now labeled legacy) | Azure DMS for data movement, with SSMA for schema conversion |
| **Web app migration** | App2Container | App Service Migration Assistant |
| **Cost modeling** | Migration Hub plus the pricing calculator | Business case built into the Migrate project, comparing against measured on-premises cost |
| **Unified workspace** | Migration Hub aggregates status; the tools stay separate services | Servers, databases, and web apps share one project |

The structural difference is workspace unification. Azure keeps discovery, assessment, business case, and replication in one project, which removes tool switching. AWS keeps them as separate services that report status into Migration Hub.

---

## The Azure Migrate Appliance

The [appliance](https://learn.microsoft.com/en-us/azure/migrate/migrate-appliance){:target="_blank" rel="noopener noreferrer"} is a lightweight server deployed in your environment. It discovers servers, collects configuration and performance metadata, inventories installed software, finds SQL instances and ASP.NET web apps, and performs agentless dependency analysis.

### Deployment and requirements

| Source environment | Deployment method |
|---|---|
| **VMware** | OVA template onto vCenter, or PowerShell installer onto an existing server |
| **Hyper-V** | VHD template onto a Hyper-V host, or PowerShell installer |
| **Physical, other clouds, Azure Government** | PowerShell installer script only |

The appliance runs on **Windows Server 2022 or Windows Server 2025**, needs 8 vCPUs, roughly 32 GB RAM and 80 GB of disk, and requires internet access directly or through a proxy. The onboarding script actively blocks deployment on Windows Server 2016 or earlier, so an older jump box will not work. VMware agentless migration additionally requires the **VMware vSphere VDDK** installed on the appliance.

Templates ship with a Windows Server evaluation license valid for 180 days. On a long assessment, either activate a real license or redeploy before it expires.

### Discovery limits, which shape appliance count

These caps decide how many appliances a data center needs, and they differ sharply by platform.

| Platform | Servers per appliance | Additional limit |
|---|---|---|
| **VMware** | 10,000 | Up to 10 vCenter Servers per appliance |
| **Hyper-V** | 5,000 | Up to 300 Hyper-V hosts per appliance |
| **Physical** | 1,000 | None |

**An appliance registers with exactly one project**, though a project can hold many appliances. A discovery estate spanning multiple projects therefore needs an appliance per project, which is a planning constraint rather than a scaling one.

### How discovery actually connects

The appliance reaches sources over specific protocols and ports, which matters because these are what firewall requests get written against.

```
   ON-PREMISES                                    AZURE
   +-------------------------------------+
   |  vCenter  --443 (vSphere API)--+     |
   |                                |     |
   |  Hyper-V  --5986 WinRM/HTTPS---+     |
   |   hosts     (falls back 5985)  |     |
   |                                v     |
   |  Windows  --5986 CIM------> [ APPLIANCE ]
   |  servers                       |     |          outbound 443 only
   |                                |     |     +--> Discovery + assessment
   |  Linux    --22 SSH-------------+     |     |
   |  servers                             |     |    (internet, or ExpressRoute
   +--------------------------------------+     |     private / Microsoft peering)
                    |                            |
                    +----------------------------+

   APPLIANCE SERVICES
   discovery agent -----> configuration metadata
   assessment agent ----> performance metadata
   SQL agent -----------> SQL instance config + perf
   web apps agent ------> ASP.NET web app config
   DRA agent + gateway -> agentless replication (VMware only)
```

Connectivity is outbound only. Azure never initiates a connection inward. The appliance can reach Azure over the internet, or over ExpressRoute private peering or Microsoft peering.

### Collection cadence

Assessment quality depends on how long you let this run, and the intervals differ by platform.

| Data | VMware | Hyper-V | Physical |
|---|---|---|---|
| Configuration metadata | Every 15 min | Every 30 min | Every 3 hours |
| Performance metadata | Every 50 min | Every 30 s, sent every 15 min | Every 5 min |
| Software inventory | Every 24 hours | Every 24 hours | Every 24 hours |
| Agentless dependency data | Collected every 5 min, sent every 6 hours | Same | Same |
| SQL configuration / performance | 24 hours / 30 s | 24 hours / 30 s | 24 hours / 30 s |

Right-sizing recommendations are only as good as the window they cover. Collecting across at least one full business cycle, including month-end or whatever your peak is, is what separates a useful assessment from one that sizes for a quiet Tuesday.

### Agentless against agent-based dependency analysis

**Agentless** analysis captures network connections and infers which servers communicate. No software goes on the source servers, and it works across operating systems. It shows network-level dependencies without application-level context.

**Agent-based** analysis uses the Dependency Agent on each server and resolves process-to-process communication, including between services on the same machine.

Most estates start agentless for breadth, then install agents on the servers where a wrong dependency call would be expensive.

---

## Server Replication and Cutover

Azure Migrate's **Migration and modernization** tool handles replication. There are two mechanisms, and which one you get is determined mostly by source platform rather than by preference.

### Agentless replication

Available for **VMware** environments. The same appliance used for discovery replicates disk data to Azure managed disks with nothing installed on the source VMs.

1. Enable replication for selected servers, using the appliance with VDDK installed
2. The appliance continuously syncs disk data to managed disks in Azure
3. Run a test migration into an isolated network and validate
4. On cutover, stop the source VM and let a final delta sync complete
5. Start the Azure VM and verify

**Characteristics:** no agent on sources, minimal source impact, source runs normally throughout, replication is resumable, and cutover takes minutes depending on final delta size. This is the path for large VMware estates.

### Agent-based replication

Used for **Hyper-V, physical servers, and servers in other public clouds**, and available for VMware where agentless does not fit. It uses a separate replication appliance plus a mobility service agent installed on each source server, sending block-level changes continuously.

**Characteristics:** requires agent installation on every source, which can be a compliance conversation, and requires a replication appliance distinct from the discovery appliance. In exchange it supports source platforms agentless cannot reach.

Do not install the replication appliance on the server hosting the Azure Migrate appliance. Microsoft documents these as separate machines.

### Site Recovery is not the migration tool

Older material presents Azure Site Recovery as a co-equal migration path. Microsoft's current position is explicit: **use Azure Migrate for migration, and Site Recovery for disaster recovery only.** New migration features are being built for the Migration and modernization tool and are not targeted at Site Recovery. Some, such as OS upgrade during migration, exist only in Azure Migrate.

| Use | Tool |
|---|---|
| Migrating on-premises servers to Azure | Azure Migrate, Migration and modernization |
| Disaster recovery of on-premises machines to Azure | Azure Site Recovery |
| Disaster recovery of Azure VMs between regions | Azure Site Recovery |

If you already replicate with Site Recovery and are mid-migration, Microsoft's guidance is to keep replicating with it rather than dropping protection, while still using Azure Migrate for business case and dependency analysis.

### The 180-day replication window

There are no tool usage charges for migration for **180 days from the time replication starts** for a given VM. During that window you pay only for the storage and network consumed by replication, plus compute during test migrations. Replication continuing past 180 days without migrating starts incurring per-instance charges, which makes a stalled wave quietly expensive.

---

## Database Migration Service

[Azure DMS](https://learn.microsoft.com/en-us/azure/dms/dms-overview){:target="_blank" rel="noopener noreferrer"} moves schema and data. Its scenario coverage is narrower and more asymmetric than most summaries suggest, and the asymmetry is the part that changes migration designs.

### The scenario matrix

Support differs by target **and** by whether the migration is offline or online. A scenario supported one way is frequently not supported the other.

| Target | Sources | Offline | Online |
|---|---|---|---|
| **Azure SQL Database** | SQL Server, Amazon RDS SQL Server | GA | **Not supported** |
| **Azure SQL Managed Instance** | SQL Server, Amazon RDS SQL Server | GA | GA |
| **SQL Server on Azure VMs** | SQL Server, Amazon RDS SQL Server | GA | GA |
| **Azure SQL targets (all three)** | Oracle, via SSMA | Preview | Not supported |
| **Azure Cosmos DB** | MongoDB | GA | GA |
| **Azure Database for MySQL flexible server** | MySQL, Amazon RDS MySQL, Amazon Aurora MySQL, Google Cloud SQL for MySQL, Percona, Azure Database for MySQL | GA | GA |
| **Azure Database for PostgreSQL flexible server** | PostgreSQL, Amazon RDS PostgreSQL | **Not supported** | GA |

Three consequences follow directly from this table:

- **Azure SQL Database has no online migration path through DMS.** A near-zero-downtime requirement on a SQL Server workload forces the target to Managed Instance or SQL on a VM, or forces a different tool. This is the single most common surprise in SQL migration planning, because Azure SQL Database is otherwise the default recommendation.
- **PostgreSQL is the inverse**, supporting online but not offline through DMS. Offline PostgreSQL migrations use the migration service built into Azure Database for PostgreSQL flexible server instead.
- **Cross-cloud sources are first-class.** Amazon RDS, Aurora, Google Cloud SQL, and Percona are supported sources, so DMS is a cloud-to-cloud tool and not only an on-premises one.

**Azure Database for MariaDB was retired on 19 September 2025**, with workloads deleted on that date. It is not a migration target, and MariaDB sources migrate to Azure Database for MySQL flexible server. Cassandra is not a DMS scenario at all.

### What DMS does not do

The portal DMS experience is data movement, not a migration suite. Per Microsoft's own feature comparison, it does **not** provide assessment, does **not** provide target SKU recommendation, does **not** migrate logins, and does **not** support databases encrypted with TDE. It does migrate schemas, supports private endpoints, and is driven from the portal, PowerShell, or Azure CLI.

Assessment and SKU recommendation come from elsewhere: Azure Migrate's SQL discovery and assessment for the estate view, and SSMA for schema compatibility. Planning a migration that assumes DMS will tell you whether the database is ready leaves that step undone.

DMS can create an optional free tracking resource for a SQL Server instance, which requires the subscription to be registered to the `Microsoft.AzureArcData` resource provider.

### Offline against online

**Offline** moves the database in one operation. Downtime starts when the migration starts. It is simpler, faster, and the right default. Microsoft's guidance is to test an offline migration first and only escalate if the measured downtime is unacceptable.

**Online** replicates changes continuously while the source stays live, limiting downtime to the cutover itself. It requires reading transaction logs from the source, a target accepting changes throughout, and careful sequencing to reach consistency before cutover. Each of those is a way the migration can stall or diverge mid-flight, which is why Microsoft's guidance is offline first.

### Schema compatibility

Data migration assumes the schema already fits the target. For SQL Server that means:

- Converting or removing T-SQL the target does not support
- Rewriting stored procedures depending on instance-level features absent from Azure SQL Database
- Moving from SQL Server logins to **Microsoft Entra ID** authentication, which DMS will not migrate for you
- Updating connection strings and application configuration

[SQL Server Migration Assistant (SSMA)](https://learn.microsoft.com/en-us/sql/ssma/sql-server-migration-assistant){:target="_blank" rel="noopener noreferrer"} generates the compatibility report and handles conversion for heterogeneous sources such as Oracle. Managed Instance has near-complete surface compatibility and needs the least schema work. Azure SQL Database needs the most.

---

## App Service Migration Assistant

The [App Service Migration Assistant](https://learn.microsoft.com/en-us/azure/app-service/app-service-asp-net-migration){:target="_blank" rel="noopener noreferrer"} assesses and migrates web applications to App Service. It supports **.NET and PHP applications hosted on Windows**, which is narrower than App Service's own runtime support. App Service runs Java, Python, and Node.js, but migrating those is a manual exercise rather than an Assistant scenario.

Azure Migrate separately discovers and assesses **ASP.NET web apps** through the appliance's web apps agent, and can migrate them to App Service or AKS. That discovery path covers estate-wide assessment; the Assistant covers migrating an individual application.

**Assessment flags** the compatibility problems that break an App Service migration:

- Direct file system access outside the app's own storage
- Registry access, which Windows App Service does not expose
- IIS modules and extensions not present in App Service
- Binary dependencies requiring installation on the host
- Authentication tied to the host machine or a local service account

Note that performance data is not collected for web apps, only configuration. Sizing an App Service plan therefore comes from load testing after migration rather than from assessment.

---

## Validation Before Cutover

### Test migration

Server replication supports starting the replicated VM in an isolated network without affecting the ongoing replication. Use it to verify boot and service startup, application function, database connectivity, DNS resolution, and whatever smoke tests you have. Test migrations consume compute charges while running, then clean up without disturbing the production migration.

Running one per wave, not once per program, is what catches the configuration difference that only appears on a particular server class.

### Data validation

For database migrations, compare source and target after the copy. Row counts and checksums on the largest and most business-critical tables catch truncation and encoding problems that a successful-looking migration status will not.

### Performance testing

Azure hardware, storage tiers, and network topology differ from the data center. An application that met its SLA on-premises can miss it in Azure on identically sized compute, usually because of storage IOPS or an added network hop. Run realistic load against the migrated workload before declaring the wave finished.

### Rollback

Keep source systems running until you have decided that rollback is no longer needed, and define what would trigger it before cutover rather than during an incident. For databases, retain a source backup and confirm the application can be pointed back. Rollback that has never been executed is an assumption.

---

## Post-Migration Optimization

### Right-sizing

Migration assessments size from on-premises specification, which is usually generous because on-premises capacity was bought for a three-year peak. Run the workload for two to four weeks in Azure, then resize against measured utilization. This is where most of the post-migration savings sit.

### Commitment discounts

Once workload patterns are stable, apply reservations or savings plans. Microsoft states savings of up to 72% for reservations against pay-as-you-go, and up to 65% for savings plans. Two constraints matter after a migration: reservations cover compute only, not licensing, storage, or networking, and **VM reservations have instance size flexibility but no region flexibility**, so a reservation bought before the final landing region is settled can strand.

Azure Hybrid Benefit applies separately to licensing and stacks with these, which is frequently the largest single line item for a Windows or SQL Server estate.

### Storage

- Right-size managed disk SKUs. Migration provisions disks to match source capacity, and performance tier often exceeds what the workload uses
- Apply blob lifecycle management to move infrequently accessed data to cool, cold, or archive tiers automatically
- Delete orphaned disks and snapshots. Unattached disks from failed or repeated migration attempts continue billing indefinitely and belong on a post-wave checklist

### Database tuning

Migrated databases usually need statistics updates and index review, because query plans built against different hardware may no longer be appropriate. Azure SQL Database and Managed Instance provide **automatic tuning**, which can create and drop indexes and force last-known-good plans, and **Query Store**, which shows regressed queries with the plans that caused it. Both replace the on-premises Database Engine Tuning Advisor workflow.

### Configuration management

Update CMDBs and infrastructure-as-code to describe the Azure environment rather than the one you left. Migration is where infrastructure documentation most often diverges permanently from reality.

---

## Migration Patterns

### Large-scale rehost

**Use case:** data center consolidation, thousands of servers, minimal appetite for application change.

1. Deploy the appliance, sizing appliance count against the per-platform discovery limits, and remember one appliance per project
2. Run agentless dependency analysis across the estate
3. Group servers into waves by dependency group, typically 50 to 100 servers per wave
4. Replicate each wave with Migration and modernization
5. Test-migrate each wave into an isolated network
6. Cut over on a rolling schedule

**Operational considerations:** establish a repeating cutover window rather than negotiating each one, keep the source data center available through the rollback period, batch DNS changes with the waves, and watch the 180-day replication clock on anything that slips.

### Mixed rehost and replatform

**Use case:** modernize databases and web tiers while rehosting the rest.

1. Assess and replicate servers with Migration and modernization
2. Assess databases separately, and pick targets knowing that Azure SQL Database has no online DMS path
3. Assess web applications for App Service compatibility
4. Migrate databases first, then applications, then remaining dependent servers

**Operational considerations:** databases commonly migrate weeks ahead of their applications, which means running the application against a migrated database across the seam. Test that combination in non-production before doing it in production, and plan the connection string and configuration changes as a deliverable rather than a cutover-day task.

### Minimal-downtime database migration

**Use case:** a business-critical SQL Server database that cannot take an outage.

1. Confirm the target supports online migration. **Managed Instance or SQL on an Azure VM**, because Azure SQL Database does not
2. Run SSMA first and remediate schema findings
3. Start online migration and let the initial seed complete
4. Validate continuously against the source during replication
5. Rehearse the cutover, including the application configuration change
6. Cut over in a low-traffic window, watching replication lag to confirm consistency

**Operational considerations:** online migration depends on stable connectivity between source and Azure for its whole duration. Replication lag grows during high-traffic periods, so the cutover window needs to follow a quiet period, not precede one.

---

## Common Pitfalls

### Assuming Azure SQL Database supports online migration

Planning a zero-downtime cutover to Azure SQL Database and discovering at implementation that DMS offers offline only for that target. The fix is a target change, which cascades into schema work, so it needs to happen during assessment. Managed Instance is the usual answer when downtime is the binding constraint.

### Incomplete dependency analysis

Migrating a database before its applications, or moving a server that others silently depend on for authentication or logging. The symptom appears after cutover, when the dependency is no longer reachable. Run agentless analysis for breadth first, then agents on the servers where being wrong is expensive, and group dependent workloads into the same wave.

### Treating DMS as an assessment tool

DMS does not assess compatibility or recommend a target SKU. A plan that assumes it will surface schema problems reaches migration day with those problems unfound. Run SSMA for schema and Azure Migrate's SQL assessment for the estate.

### Cutting over without a test migration

Skipping test migration because the wave "looks like the last one." Test migration is cheap, isolated, and does not disturb replication. Production cutover without it is the most common source of unrecoverable migration incidents.

### Underestimating network capacity

Planning to replicate a large estate over a link sized for normal office traffic. Replication saturates the link, waves queue behind each other, and the 180-day window starts burning. Measure available bandwidth before committing to a wave schedule, and use Data Box for bulk data that does not need to be live.

### Migrating hardcoded configuration

Servers carrying hardcoded IP addresses, hostnames, or references to on-premises services fail in Azure in ways that look like network problems. Capture configuration dependencies during assessment, and change them deliberately before cutover rather than debugging them afterward.

---

## Key Takeaways

1. **Azure Migrate is free and unified.** Discovery, assessment, business case, and replication live in one project. Costs come from the resources you migrate into, not from the service.

2. **Appliance discovery limits differ by platform and drive appliance count.** VMware 10,000 servers per appliance, Hyper-V 5,000, physical 1,000, and one appliance registers to exactly one project.

3. **Site Recovery is for disaster recovery, not migration.** Microsoft recommends Azure Migrate for migration, builds new migration features only for Migration and modernization, and ships some capabilities such as OS upgrade only there.

4. **Agentless replication is a VMware capability.** Hyper-V, physical servers, and other clouds use agent-based replication with a separate replication appliance and a mobility agent on each source.

5. **Azure SQL Database has no online DMS migration path.** A minimal-downtime requirement forces Managed Instance or SQL on a VM. PostgreSQL inverts this, supporting online but not offline through DMS.

6. **DMS moves data; it does not assess.** No compatibility assessment, no SKU recommendation, no login migration, no TDE support. SSMA covers schema, Azure Migrate covers estate assessment.

7. **DMS reaches other clouds.** Amazon RDS, Aurora, Google Cloud SQL, and Percona are supported sources, so it handles cloud-to-cloud as well as on-premises migration.

8. **The 180-day replication window is a clock, not a grace period.** Tool usage is free for 180 days from the start of replication for each VM, after which per-instance charges begin. A stalled wave gets expensive quietly.

9. **Test migration is not optional.** It runs in an isolated network without disturbing replication, and it is the step that catches the problem that would otherwise appear after the source is gone.

10. **Right-sizing after migration is where the savings are.** Assessments size from on-premises specifications bought for a multi-year peak. Measure for two to four weeks in Azure, then resize, and clean up the orphaned disks migration leaves behind.
