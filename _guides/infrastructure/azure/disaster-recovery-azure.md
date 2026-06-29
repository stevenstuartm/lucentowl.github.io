---
title: "Disaster Recovery on Azure"
layout: guide
category: Azure
subcategory: Architecture Patterns (Advanced)
description: "Azure Site Recovery for VM replication, geo-redundant storage options, RPO and RTO planning frameworks, and disaster recovery patterns across compute, data, and networking services"
tags: [azure, cloud-computing, architecture, reliability, infrastructure, distributed-systems, practical, advanced]
---

## What Is Disaster Recovery

Disaster recovery (DR) on Azure encompasses strategies for recovering compute workloads, data, and networking infrastructure across Azure regions when the primary region becomes unavailable. Unlike high availability (which protects against zone-level failures within a region), disaster recovery protects against regional failures.

Azure provides built-in DR capabilities across compute, storage, and data services. Most Azure regions are paired with another region hundreds of miles away. These [region pairs](https://learn.microsoft.com/en-us/azure/reliability/cross-region-replication-azure){:target="_blank" rel="noopener noreferrer"} receive platform updates sequentially to minimize simultaneous outages and provide preferential recovery during widespread failures.

### What Problems Disaster Recovery Solves

**Without DR:**
- Regional outages result in extended downtime measured in hours or days
- No tested recovery path when primary systems fail
- Data loss from disasters exceeds acceptable business thresholds
- Recovery procedures exist only as untested documentation
- Compliance requirements for data durability and recovery are not met

**With DR:**
- Defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO) that align with business needs
- Automated replication and failover mechanisms that reduce manual intervention
- Tested recovery procedures that validate actual recovery capability
- Geographic redundancy that survives regional disasters
- Compliance with regulatory and audit requirements for business continuity

### How Azure DR Differs from AWS DR

Architects familiar with AWS should note several important differences:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Primary VM replication service** | CloudEndure Disaster Recovery / Elastic Disaster Recovery (agent-based) | Azure Site Recovery (agent-based for on-premises, agentless for Azure-to-Azure) |
| **Storage geo-replication** | S3 Cross-Region Replication (versioning-based, near real-time) | GRS/GZRS (async replication, 15-minute RPO) |
| **Database multi-region** | RDS read replicas + manual promotion | SQL Database auto-failover groups (automatic failover), Cosmos DB multi-region writes |
| **Region pairing** | No built-in concept; manually choose secondary regions | Paired regions with sequential updates and preferential recovery |
| **Backup service** | AWS Backup (central policy, cross-region backup) | Azure Backup (vault-based, GRS storage by default) |
| **DNS failover** | Route 53 health checks with failover routing | Traffic Manager health probes with priority/performance routing |
| **PaaS service geo-DR** | Service-specific (DynamoDB global tables, S3 CRR, etc.) | Service-specific (Service Bus geo-DR, Event Hubs geo-DR, etc.) |

---

## Disaster Recovery Fundamentals

### Recovery Objectives: RPO and RTO

Every DR plan begins with defining acceptable data loss and downtime for each workload. These define the recovery architecture and associated costs.

**Recovery Point Objective (RPO):**
- Maximum acceptable data loss measured in time
- Answers: "How much data can we afford to lose?"
- Example: RPO of 15 minutes means the business tolerates losing 15 minutes of data
- Directly drives replication frequency and technology choice
- Lower RPO requires more frequent replication and higher cost

**Recovery Time Objective (RTO):**
- Maximum acceptable downtime measured in time
- Answers: "How long can the business operate without this system?"
- Example: RTO of 4 hours means the system must be restored within 4 hours
- Directly drives standby infrastructure and automation requirements
- Lower RTO requires more automated failover and active standby resources

**Common RPO/RTO patterns by workload type:**

| Workload Type | Typical RPO | Typical RTO | Example |
|---------------|-------------|-------------|---------|
| **Mission-critical transactional** | Seconds to minutes | Minutes | Payment processing, trading systems |
| **Business-critical applications** | 15 minutes to 1 hour | 1-4 hours | ERP, CRM, core business applications |
| **Important production systems** | 1-6 hours | 4-12 hours | Internal tools, reporting systems |
| **Non-critical systems** | 24 hours | 12-24 hours | Development, testing, archival systems |

### Recovery Tiers

Azure categorizes workloads into recovery tiers that map to infrastructure patterns:

**Tier 0 - Mission Critical:**
- RPO: Near-zero (seconds)
- RTO: Minutes
- **Pattern:** Active-active multi-region with synchronous or near-synchronous replication
- **Azure services:** Cosmos DB multi-region writes, SQL Database active geo-replication
- **Cost:** Highest (full duplicate infrastructure always running)

**Tier 1 - Business Critical:**
- RPO: 15 minutes to 1 hour
- RTO: 1-4 hours
- **Pattern:** Warm standby with automated failover or hot standby with manual failover
- **Azure services:** Azure Site Recovery, SQL Database auto-failover groups
- **Cost:** Moderate (secondary region has scaled-down resources that scale up during failover)

**Tier 2 - Important:**
- RPO: 1-6 hours
- RTO: 4-12 hours
- **Pattern:** Cold standby with infrastructure-as-code deployment and data restore
- **Azure services:** Azure Backup with geo-redundant storage
- **Cost:** Lower (no running secondary resources; pay for storage only)

**Tier 3 - Non-Critical:**
- RPO: 24 hours
- RTO: 12-24 hours
- **Pattern:** Backup and restore with manual rebuild
- **Azure services:** Azure Backup
- **Cost:** Lowest (backup storage only)

### Backup vs Disaster Recovery

Azure Backup and Azure Site Recovery are complementary, not competing:

| Purpose | Azure Backup | Azure Site Recovery |
|---------|--------------|---------------------|
| **Primary use case** | Protect against data corruption, accidental deletion, ransomware | Protect against regional outages and enable workload migration |
| **Recovery granularity** | File-level, disk-level, VM-level | Full VM orchestration with network mapping |
| **Replication frequency** | Daily snapshots (VMs), streaming (databases) | Continuous replication (5-minute RPO for VMs) |
| **Failover automation** | Manual restore | Automated failover with recovery plans |
| **Cross-region** | Geo-redundant storage (async, 15-min RPO) | Real-time replication to secondary region |
| **Retention** | Long-term retention (years) | Short-term replication (days) |
| **Best for** | Operational recovery (user error, corruption) | Regional DR and planned migration |

**Use both together:** Backup for operational recovery and long-term retention, Site Recovery for cross-region DR with low RTO.

---

## Storage Disaster Recovery

### Storage Redundancy Options

Azure Storage provides multiple redundancy levels that balance cost and durability. Every storage account has a base redundancy option that determines how data is replicated.

**Locally Redundant Storage (LRS):**
- **What it does:** Three synchronous copies within a single data center
- **Durability:** 99.999999999% (11 nines)
- **RPO:** Zero within the data center
- **RTO:** Minutes (automatic failover to a replica within the same data center)
- **Cost:** Lowest
- **Use when:** Cost is primary concern and data can be recreated or tolerates data center failure

**Zone-Redundant Storage (ZRS):**
- **What it does:** Three synchronous copies across three Availability Zones in the same region
- **Durability:** 99.9999999999% (12 nines)
- **RPO:** Zero within the region
- **RTO:** Minutes (automatic failover to another zone)
- **Cost:** Moderate
- **Use when:** High availability within a region is required but regional failure is acceptable

**Geo-Redundant Storage (GRS):**
- **What it does:** LRS in primary region + asynchronous replication to paired region (secondary region also has LRS)
- **Durability:** 99.99999999999999% (16 nines)
- **RPO:** ~15 minutes (replication lag from primary to secondary)
- **RTO:** Hours (requires manual failover to secondary region)
- **Cost:** Higher
- **Use when:** Regional DR is required but secondary region access is not needed during normal operation

**Geo-Zone-Redundant Storage (GZRS):**
- **What it does:** ZRS in primary region + asynchronous replication to paired region (secondary region has LRS)
- **Durability:** 99.99999999999999% (16 nines)
- **RPO:** ~15 minutes
- **RTO:** Hours (requires manual failover)
- **Cost:** Highest
- **Use when:** Maximum durability with both zone and regional redundancy is required

**Read-Access Geo-Redundant Storage (RA-GRS) and RA-GZRS:**
- Same as GRS/GZRS but provides read-only access to data in the secondary region during normal operation
- Applications can read from secondary region to reduce latency for geographically distributed users
- Writes still go to primary region only
- **Use when:** Applications need low-latency reads from multiple regions or want to validate secondary data before failover

### Storage Failover

**Automatic failover (Microsoft-managed):**
- During a regional disaster, Microsoft may initiate failover for GRS/GZRS storage accounts
- This is rare and only triggered during prolonged regional outages
- No customer action required, but also no control over timing

**Customer-managed failover:**
- Manually initiate failover from primary to secondary region through the portal or API
- Secondary region becomes the new primary
- Data in the old primary is lost if the region recovers (failover is one-way)
- After failover, the storage account becomes LRS in the new primary region
- Re-enabling GRS requires manual configuration and triggers a full data copy to the new secondary

**Failover considerations:**
- Test failover capability regularly (Azure does not provide test failover for storage; consider using a separate test storage account)
- Understand that failover makes the secondary region the new primary
- Plan for DNS and endpoint updates if applications hard-code storage account endpoints
- Account for the ~15-minute RPO (data written in the last 15 minutes before an outage may be lost)

### Storage DR Patterns

**Pattern 1: Application-level replication:**
- Application writes to both primary and secondary storage accounts simultaneously
- Provides zero RPO and instant failover
- Increases complexity and application logic
- **Use when:** RPO requirements are stricter than the 15-minute GRS replication

**Pattern 2: GRS with RA-GRS validation:**
- Use GRS for automatic replication
- Enable RA-GRS and periodically validate secondary data integrity
- Fail over manually during regional disaster
- **Use when:** Standard DR requirements with validation before relying on secondary data

**Pattern 3: Backup to separate account:**
- Use LRS or ZRS in primary region for operational storage
- Use Azure Backup or AzCopy to replicate critical data to a GRS storage account
- Keeps operational costs low while ensuring regional durability for backups
- **Use when:** Primary workload does not justify GRS cost but backups need regional redundancy

---

## Azure Site Recovery for Virtual Machines

### How Azure Site Recovery Works

[Azure Site Recovery](https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-overview){:target="_blank" rel="noopener noreferrer"} (ASR) orchestrates VM replication, failover, and failback across regions. It provides continuous replication with recovery point generation every 5 minutes for Azure VMs.

**ASR components:**

| Component | Purpose |
|-----------|---------|
| **Recovery Services Vault** | Stores replication configuration, recovery points, and orchestration metadata |
| **Replication policy** | Defines RPO (recovery point retention), snapshot frequency, and crash-consistent vs app-consistent recovery points |
| **Network mapping** | Maps source VNet/subnets to target VNet/subnets for failover |
| **Recovery plan** | Orchestrates multi-VM failover with sequencing, scripts, and manual actions |
| **Cache storage account** | Temporary storage in source region for replication data before transfer to target region |
| **Target resources** | Managed disks, NICs, public IPs, load balancers created during failover |

### Replication Process

**Azure-to-Azure replication (agentless):**
1. Enable replication for a VM from source region to target region
2. ASR automatically installs the Mobility service extension on the VM
3. VM writes are intercepted and sent to a cache storage account in the source region
4. Replication data is transferred asynchronously to the target region and written to replica managed disks
5. Crash-consistent recovery points are generated every 5 minutes
6. App-consistent recovery points (with VSS snapshots on Windows or scripts on Linux) are generated based on policy (typically every 1-4 hours)

**On-premises-to-Azure replication (agent-based):**
- Requires deploying a Configuration Server (on-premises) and Process Server (can be on-premises or in Azure)
- Mobility service agent installed on each VM or physical server being replicated
- Initial replication transfers full disk data; subsequent replication sends only changed blocks
- Bandwidth throttling and compression reduce network impact

### Recovery Plans

A [recovery plan](https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-create-recovery-plans){:target="_blank" rel="noopener noreferrer"} groups VMs and defines the order in which they start during failover. This is critical for multi-tier applications where dependencies must start in a specific sequence.

**Recovery plan structure:**
- **Groups:** Define failover sequence (Group 1 starts before Group 2)
- **Pre-actions:** Scripts or manual steps executed before a group starts (e.g., update DNS, reconfigure load balancer)
- **Post-actions:** Scripts or manual steps executed after a group starts (e.g., validate application health, notify operations team)

**Example recovery plan for a three-tier web application:**

| Group | VMs | Pre-Action | Post-Action |
|-------|-----|------------|-------------|
| **Group 1: Data** | SQL VMs | None | Validate database online, run consistency check |
| **Group 2: App** | App server VMs | None | Validate app connects to database |
| **Group 3: Web** | Web server VMs | Update Traffic Manager to point to DR region | Smoke test application, notify stakeholders |

### Failover Types

**Test failover:**
- Creates isolated copies of VMs in a test VNet without affecting production or replication
- Validates that VMs start, applications function, and recovery plans execute correctly
- Does not interrupt ongoing replication
- Recommended to perform quarterly or after significant infrastructure changes
- **Critical:** The only way to validate DR readiness without impacting production

**Planned failover:**
- Used for scheduled maintenance or datacenter migration
- Shuts down source VMs gracefully, replicates final changes, and starts target VMs
- Zero data loss (RPO = 0)
- Requires source region to be accessible

**Unplanned failover:**
- Used during a disaster when source region is unavailable
- Starts target VMs from the latest available recovery point
- Accepts potential data loss based on last replicated recovery point (typically 5 minutes)
- Source VMs may still be running (if accessible), creating a split-brain scenario that must be resolved

### Failback After Recovery

**Failback process:**
1. After failing over to the secondary region, production runs in the DR region
2. When the original region recovers, reverse replication from DR region back to original region
3. Perform a planned failover back to the original region
4. VMs return to original region and replication resumes in the original direction

**Failback considerations:**
- Failback requires the original region to be fully operational
- Reverse replication incurs data transfer costs
- Failback is a manual process requiring the same orchestration as failover
- Some organizations choose to keep running in the DR region long-term if failover was successful

---

## Database Disaster Recovery

### Azure SQL Database

[Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/business-continuity-high-availability-disaster-recover-hadr-overview){:target="_blank" rel="noopener noreferrer"} provides built-in HA within a region and multiple DR options for cross-region protection.

**Auto-failover groups:**
- Replicates a group of databases from a primary server to a secondary server in another region
- Provides read-write listener endpoint and read-only listener endpoint
- Applications connect to the listener endpoint; DNS automatically redirects to the active primary
- **Automatic failover:** When enabled, failover happens automatically during a regional outage
- **Manual failover:** Trigger failover via portal, PowerShell, or REST API for testing or planned maintenance
- **RPO:** Typically 5 seconds (some recent transactions may be lost during unplanned failover)
- **RTO:** Typically 30 seconds to a few minutes

**Active geo-replication (without auto-failover group):**
- Replicates a single database to up to four secondary regions
- Secondary databases are readable (useful for read-scale and regional read proximity)
- Failover is manual (requires application to update connection string)
- More flexible than auto-failover groups but requires application changes during failover

**When to use which:**

| Use Case | Auto-Failover Groups | Active Geo-Replication |
|----------|---------------------|------------------------|
| Transparent failover without app changes | Yes (listener endpoint redirects) | No (app must update connection string) |
| Failover multiple related databases together | Yes | No (per-database failover) |
| Read-scale from secondary regions | Yes (read-only listener) | Yes (direct connection to secondary) |
| Automated failover during disaster | Yes (when configured) | No (always manual) |

### Azure SQL Managed Instance

[SQL Managed Instance](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/failover-group-sql-mi){:target="_blank" rel="noopener noreferrer"} supports auto-failover groups similar to SQL Database but with additional complexity due to VNet integration.

**Key differences from SQL Database:**
- Requires VNet peering or VPN between primary and secondary regions
- Longer initial setup time (due to instance provisioning)
- Supports full instance failover (all databases on the instance fail over together)
- RTO is typically longer than SQL Database (minutes to tens of minutes)

**Managed Instance Link:**
- Replicates on-premises SQL Server to Azure SQL Managed Instance
- Enables hybrid DR scenarios where on-premises is primary and Azure is secondary
- One-way replication (on-premises to Azure)

### Azure Cosmos DB

[Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/distribute-data-globally){:target="_blank" rel="noopener noreferrer"} provides turnkey global distribution with single-digit millisecond latency and transparent multi-region replication.

**Multi-region replication:**
- Add or remove regions dynamically without downtime
- All regions replicate asynchronously from the write region
- RPO typically under 60 seconds
- Applications can specify preferred read regions for proximity

**Automatic failover:**
- Cosmos DB automatically fails over to a secondary region if the write region becomes unavailable
- Priority list defines failover order
- RTO typically under 2 minutes

**Multi-region writes:**
- Applications write to any region and Cosmos DB handles conflict resolution
- Enables active-active scenarios with near-zero RPO and RTO
- Requires conflict resolution policies (last write wins, custom procedures)

**Consistency levels and DR trade-offs:**

| Consistency Level | RPO During Regional Failure | Use Case |
|-------------------|---------------------------|----------|
| **Strong** | Zero (synchronous replication; performance impact) | Financial transactions requiring absolute consistency |
| **Bounded staleness** | Configurable lag (e.g., 100 seconds or 100,000 operations) | Balance between strong consistency and performance |
| **Session** | Zero for the session, eventual for others | Web applications with user-specific consistency |
| **Consistent prefix** | Eventual but ordered | Social media feeds, time-series data |
| **Eventual** | Eventual (lowest latency, highest availability) | Non-critical data, analytics |

---

## Compute Disaster Recovery Patterns

### Virtual Machine Scale Sets

[VM Scale Sets](https://learn.microsoft.com/en-us/azure/virtual-machine-scale-sets/overview){:target="_blank" rel="noopener noreferrer"} (VMSS) support both zone redundancy within a region and cross-region deployment.

**Zone-redundant VMSS (HA, not DR):**
- Distributes VM instances across Availability Zones within a region
- Protects against zone failure but not regional failure
- Single VMSS resource that Azure automatically balances across zones

**Cross-region VMSS for DR:**
- Deploy identical VMSS in primary and secondary regions
- Use Azure Site Recovery to replicate stateful VMs (if needed)
- Use Traffic Manager or Front Door to route traffic to the active region
- Scale secondary region to zero instances during normal operation (cold standby) or run minimal instances (warm standby)

**Automated failover:**
- Use Traffic Manager health probes to detect primary region failure
- Traffic Manager automatically routes users to secondary region
- Use automation (Azure Automation, Logic Apps, Azure Functions) to scale up secondary VMSS when failover occurs

### Azure Kubernetes Service (AKS)

[AKS multi-region DR](https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region){:target="_blank" rel="noopener noreferrer"} requires deploying separate clusters in multiple regions and orchestrating failover at the application layer.

**AKS DR pattern:**
1. Deploy AKS clusters in primary and secondary regions
2. Use Azure Container Registry with geo-replication to ensure images are available in both regions
3. Deploy applications to both clusters (active-passive or active-active)
4. Use Traffic Manager or Front Door to route traffic based on health probes
5. Replicate stateful data (databases, storage) across regions using service-specific DR mechanisms

**State management:**
- Store application state in geo-replicated Azure SQL, Cosmos DB, or Storage
- Use persistent volumes backed by Azure Disks or Azure Files with appropriate redundancy
- Avoid storing critical state in pod ephemeral storage

**GitOps for DR:**
- Use GitOps (Flux, Argo CD) to deploy identical configurations to both clusters
- Ensures consistency and simplifies failover validation

### Azure App Service

[App Service](https://learn.microsoft.com/en-us/azure/app-service/manage-disaster-recovery){:target="_blank" rel="noopener noreferrer"} provides limited built-in DR; most DR patterns rely on infrastructure-as-code and traffic management.

**App Service DR pattern:**
- Deploy identical App Service plans and apps in primary and secondary regions
- Use deployment slots for blue-green deployments to validate changes before promoting to production
- Use Traffic Manager or Front Door with health probes to route traffic
- Replicate app configuration and secrets using Key Vault with geo-replication or Azure DevOps pipelines

**Backup and restore:**
- App Service provides backup for configuration and content to a storage account
- Backups can be restored to another App Service in a different region
- Suitable for cold standby scenarios but not low-RTO requirements

### Azure Functions

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-geo-disaster-recovery){:target="_blank" rel="noopener noreferrer"} DR depends on the hosting plan:

**Consumption and Premium plans:**
- Deploy identical function apps in multiple regions
- Use Traffic Manager or Front Door to distribute traffic
- Ensure triggers (Event Hubs, Service Bus, Storage Queues) support geo-replication or failover

**Dedicated (App Service) plan:**
- Same DR pattern as App Service (deploy to multiple regions, use traffic management)

**State considerations:**
- Functions are stateless by design; store state in geo-replicated storage or databases
- Durable Functions state is stored in Azure Storage; use GRS or GZRS for the backing storage account

---

## Networking Disaster Recovery

### Traffic Manager

[Azure Traffic Manager](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-overview){:target="_blank" rel="noopener noreferrer"} is a DNS-based load balancer that distributes traffic across regions. It is the primary mechanism for cross-region failover in Azure.

**Routing methods for DR:**

| Routing Method | DR Use Case |
|----------------|-------------|
| **Priority** | Active-passive DR (primary region priority 1, DR region priority 2; failover when primary health probe fails) |
| **Weighted** | Active-active DR with traffic distribution (e.g., 80% primary, 20% secondary during normal operation) |
| **Performance** | Route users to the closest healthy region for latency optimization |
| **Geographic** | Route based on user geography for compliance (failover within allowed regions) |

**Health probes:**
- Traffic Manager sends HTTP/HTTPS probes to each endpoint at a configured interval
- Endpoint is marked unhealthy after consecutive probe failures
- DNS responses exclude unhealthy endpoints, directing traffic to healthy regions
- DNS TTL (default 60 seconds) determines how quickly clients refresh DNS and discover failover

**Traffic Manager in DR architecture:**
- Create Traffic Manager profile with endpoints in primary and secondary regions
- Configure priority routing with primary region as priority 1
- Configure health probes against application health endpoints (not just VM availability)
- Clients resolve DNS to Traffic Manager, which returns the IP of the healthy region
- DNS TTL means failover propagation takes time (clients may continue using cached DNS)

### Azure Front Door

[Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview){:target="_blank" rel="noopener noreferrer"} is an application delivery network with built-in health probes, SSL offload, WAF, and intelligent routing. Unlike Traffic Manager (DNS-based), Front Door is an Anycast proxy that provides instant failover.

**Front Door vs Traffic Manager for DR:**

| Aspect | Traffic Manager | Front Door |
|--------|----------------|------------|
| **Failover speed** | DNS TTL dependent (seconds to minutes) | Instant (proxy detects failure immediately) |
| **Protocol** | DNS-based (works with any TCP/UDP protocol) | HTTP/HTTPS only |
| **Latency impact** | No additional latency after DNS resolution | Proxies all traffic (small latency increase) |
| **SSL offload** | No | Yes (terminates SSL at edge) |
| **WAF** | No | Yes (integrated Web Application Firewall) |
| **Caching** | No | Yes (static content caching at edge) |
| **Cost** | Lower | Higher |

**Use Traffic Manager when:**
- DR is needed for non-HTTP workloads
- Cost is a primary concern
- Additional latency from proxying is unacceptable

**Use Front Door when:**
- Instant failover is required (low RTO)
- WAF and DDoS protection are needed
- Global content delivery and edge caching provide value

### DNS Failover Patterns

**DNS failover considerations:**
- DNS caching means clients may not immediately detect failover
- Lower DNS TTL reduces failover propagation time but increases DNS query load
- Some recursive DNS resolvers ignore TTL and cache longer
- For mission-critical applications, combine DNS failover with application-level retries and circuit breakers

**Automatic DNS failover with Traffic Manager:**
1. Traffic Manager health probes detect primary region failure
2. Traffic Manager removes primary endpoint from DNS responses
3. New DNS queries return secondary region endpoint
4. Clients with cached DNS entries continue using primary until TTL expires
5. Clients refresh DNS and begin connecting to secondary region

**Manual DNS failover:**
- Update DNS records manually during disaster (slow, error-prone)
- Suitable only for non-critical workloads or as a fallback when automated failover fails

---

## PaaS Service Disaster Recovery

### Service Bus Geo-Disaster Recovery

[Service Bus geo-DR](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-geo-dr){:target="_blank" rel="noopener noreferrer"} replicates namespace metadata (queues, topics, subscriptions) but not messages. This is metadata failover, not data failover.

**How it works:**
- Pair a primary namespace with a secondary namespace in another region
- Metadata (entity definitions) replicates continuously
- Messages in the primary namespace are not replicated
- During failover, applications connect to the secondary namespace and messages flow to new queues
- Message loss occurs for in-flight messages in the primary namespace at failover time

**DR implications:**
- RPO depends on how quickly senders can switch to the secondary namespace
- Applications must handle message loss or use other mechanisms (database transactions, application-level idempotency)
- Service Bus Premium tier required for geo-DR

### Event Hubs Geo-Disaster Recovery

[Event Hubs geo-DR](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-geo-dr){:target="_blank" rel="noopener noreferrer"} mirrors Service Bus: metadata failover only, no event data replication.

**How it works:**
- Pair primary and secondary namespaces
- Event Hub definitions, consumer groups, and configuration replicate
- Events in the primary namespace are not replicated
- During failover, producers and consumers connect to the secondary namespace
- In-flight events are lost

**DR patterns for Event Hubs:**
- Use application-level dual-write (send events to both regions) for zero RPO
- Accept event loss during failover (suitable for telemetry, non-critical event streams)
- Use Event Hubs Capture to blob storage with GRS/GZRS for offline recovery

### Azure Storage Queues and Blob Event Replication

Azure Storage queues do not support built-in geo-replication of messages. GRS replicates the storage account metadata and blobs but not queue messages.

**DR patterns for Storage Queues:**
- Use application-level dual-write to queues in both regions
- Accept message loss and use GRS for eventual recovery of account structure
- Consider Service Bus for workloads requiring DR guarantees

**Blob event replication:**
- Use Object Replication for blobs to replicate specific containers between storage accounts in different regions
- Near real-time replication for append and block blobs
- RPO typically under 15 minutes
- Suitable for disaster recovery of critical blob data when GRS 15-minute RPO is insufficient

---

## DR Testing and Validation

### Why DR Testing Matters

An untested DR plan is not a DR plan. Testing validates assumptions, uncovers gaps, and builds team confidence for real disasters.

**Common failures discovered during testing:**
- Firewall rules or NSGs not configured in secondary region
- DNS records hard-coded to primary region IPs
- Secrets or certificates expired or missing in secondary region
- Database connection strings not updated after failover
- Automation scripts with hard-coded region names or resource IDs
- Application-level retries not handling failover latency

### Test Failover for Azure Site Recovery

**ASR test failover:**
- Spins up replicated VMs in an isolated VNet
- Validates that VMs boot, applications start, and data is intact
- Does not affect production or ongoing replication
- Cleanup removes test VMs and resources
- Frequency: Quarterly or after major infrastructure changes

**Test failover checklist:**
1. Plan a maintenance window (even though production is not affected, test consumes resources and time)
2. Execute test failover through ASR recovery plan
3. Validate that VMs start in the correct order
4. Validate that applications connect to dependencies (databases, storage, APIs)
5. Validate that data in secondary region is consistent and up-to-date
6. Document issues discovered and remediate before next test
7. Clean up test resources to avoid unnecessary costs

### DR Drills Beyond ASR

**Full DR drill (disruptive):**
- Simulate actual regional failure by failing over production workloads to secondary region
- Requires business buy-in and planned downtime
- Validates complete end-to-end failover including traffic routing, DNS, and application behavior
- Frequency: Annually or when DR requirements change significantly

**Tabletop exercise (non-disruptive):**
- Walk through DR procedures with the team without executing actual failover
- Identify gaps in documentation, unclear responsibilities, and missing automation
- Frequency: Quarterly

**Partial failover test:**
- Fail over a non-production environment (dev, test) to secondary region
- Less disruptive than full production failover but still validates infrastructure and procedures
- Frequency: Quarterly

---

## Cost Management for DR

### Standby Tiers

DR infrastructure cost varies significantly based on the standby model:

**Cold standby:**
- Secondary region has no running compute resources
- Infrastructure deployed via Terraform/Bicep during failover
- Data replicated to secondary region (storage, database replicas)
- **RTO:** Hours (time to deploy infrastructure and restore data)
- **Cost:** Lowest (storage replication costs only)
- **Use when:** RTO of 4+ hours is acceptable

**Warm standby:**
- Secondary region has minimal compute resources running (scaled down)
- Resources scale up during failover
- Data continuously replicated
- **RTO:** Minutes to 1 hour (time to scale up and complete failover)
- **Cost:** Moderate (minimal compute cost + storage replication)
- **Use when:** RTO of 1-4 hours is required

**Hot standby:**
- Secondary region has full duplicate infrastructure running
- Load balancer distributes traffic or standby is idle but ready
- Data continuously replicated with near-zero RPO
- **RTO:** Seconds to minutes (traffic routing change only)
- **Cost:** Highest (full duplicate infrastructure always running)
- **Use when:** RTO under 1 hour is required or active-active is needed

### Cost Optimization Strategies

**Use Azure Site Recovery instead of always-on VMs:**
- ASR replicates VMs without requiring running instances in secondary region
- Target VMs are created only during failover
- Saves compute cost while maintaining low RPO

**Scale down secondary region resources:**
- Run smaller VM SKUs or fewer instances in secondary region
- Scale up during failover (increases RTO but reduces cost)

**Leverage PaaS built-in DR:**
- Azure SQL Database auto-failover groups include secondary replica in the service cost
- Cosmos DB multi-region replication cost is based on provisioned throughput (scale down secondary region)
- App Service and Functions can be deployed to secondary region on-demand (cold standby)

**Use storage tiers appropriately:**
- Use GRS/GZRS only for data requiring regional redundancy
- Use LRS or ZRS for ephemeral or easily recreated data
- Use cool or archive tiers for backups not needed for fast recovery

**Right-size backup retention:**
- Azure Backup charges for storage consumed by recovery points
- Retain only the minimum recovery points required by compliance and operational needs
- Use shorter retention for non-critical workloads

---

## Runbook Automation for DR

### Why Automate DR Procedures

Manual DR procedures are slow, error-prone, and untested. Automation ensures consistency and reduces RTO.

**Automation goals:**
- Reduce human error during high-stress disaster scenarios
- Enforce correct failover sequence (start databases before app servers)
- Validate health checks after each step
- Provide rollback capability if failover fails

### Azure Automation for DR

[Azure Automation](https://learn.microsoft.com/en-us/azure/automation/automation-intro){:target="_blank" rel="noopener noreferrer"} provides runbook execution for DR procedures.

**DR runbook examples:**
- Trigger ASR recovery plan and monitor failover progress
- Scale up VMSS or App Service plans in secondary region
- Update Traffic Manager or Front Door endpoints to route traffic to secondary region
- Validate application health endpoints after failover
- Send notifications to operations team and stakeholders

**Runbook triggers:**
- Manual execution during disaster
- Automated execution via Azure Monitor alerts (e.g., region health alert triggers failover runbook)
- Scheduled execution for DR testing

**Runbook best practices:**
- Use modular runbooks (separate runbook for each major step like scale-up, traffic routing, validation)
- Include rollback logic for failed failover attempts
- Log all actions and results for post-incident review
- Store runbooks in source control (not just in Azure Automation)
- Test runbooks during DR drills

### DR Orchestration with Logic Apps

[Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview){:target="_blank" rel="noopener noreferrer"} provides visual workflow automation for DR orchestration.

**Logic App DR patterns:**
- Trigger from Azure Monitor alert when regional health degrades
- Call ASR REST API to initiate failover
- Wait for failover completion
- Execute post-failover steps (update DNS, scale resources, validate health)
- Send notifications via email, Teams, or SMS

**Advantages over Automation runbooks:**
- Visual design makes workflows easier to understand
- Built-in connectors for Azure services, Office 365, third-party APIs
- Easier for non-developers to maintain

**Disadvantages:**
- Less suitable for complex scripting or conditional logic
- Higher cost for high-frequency executions

---

## Common Pitfalls

### Pitfall 1: Not Testing Failover

**Problem:** DR plan exists on paper but has never been tested in practice.

**Result:** During an actual disaster, missing firewall rules, expired certificates, or incorrect DNS configuration cause extended downtime. Team is unfamiliar with failover procedures and makes mistakes under pressure.

**Solution:** Perform quarterly test failovers using ASR test failover or by failing over a non-production environment. Document every issue discovered and remediate before the next test. Conduct annual full DR drills for mission-critical workloads.

---

### Pitfall 2: Assuming GRS Means Zero RPO

**Problem:** Treating GRS storage as if it provides instant data replication and zero RPO.

**Result:** Up to 15 minutes of data lost during regional failover because GRS replication is asynchronous.

**Solution:** Understand the 15-minute RPO for GRS. For workloads requiring stricter RPO, use application-level replication, ZRS within a region, or Cosmos DB multi-region writes with strong consistency.

---

### Pitfall 3: Overlooking DNS TTL Impact

**Problem:** Configuring Traffic Manager with a long DNS TTL to reduce query load.

**Result:** Clients cache DNS for an extended period and continue attempting to connect to the failed primary region for minutes after failover.

**Solution:** Use a short DNS TTL (60 seconds or less) for Traffic Manager profiles used in DR. For even faster failover, use Azure Front Door which is not DNS-dependent.

---

### Pitfall 4: Failing to Update Application Configuration for DR

**Problem:** Application has hard-coded connection strings, API endpoints, or service URLs pointing to primary region resources.

**Result:** After failover, application cannot connect to secondary region resources even though infrastructure is running.

**Solution:** Use Traffic Manager or Front Door endpoints as application targets so DNS handles regional routing. Store configuration in Azure App Configuration or Key Vault with geo-replication. Validate configuration during DR testing.

---

### Pitfall 5: Ignoring Stateful Data in Compute Resources

**Problem:** Replicating VMs with Azure Site Recovery but not accounting for application state stored in local databases or file systems.

**Result:** VMs start in secondary region but application state is stale or missing, causing application failures.

**Solution:** Replicate stateful data using service-specific mechanisms (SQL auto-failover groups for databases, GRS/GZRS for storage accounts). Use ASR app-consistent snapshots to ensure application state is captured during replication.

---

### Pitfall 6: Not Considering Dependency Chains

**Problem:** Failing over a web application to secondary region without ensuring that dependent services (APIs, databases, authentication services) are also available in secondary region.

**Result:** Web tier starts successfully but cannot reach backend services, resulting in application failures.

**Solution:** Map all application dependencies before designing DR architecture. Ensure each dependency has its own DR plan. Use ASR recovery plans to orchestrate multi-tier failover with correct sequencing.

---

### Pitfall 7: Neglecting Cost of Always-On DR

**Problem:** Deploying full duplicate infrastructure in secondary region without considering ongoing cost.

**Result:** DR environment costs the same as production but sits idle, doubling cloud spend.

**Solution:** Use warm or cold standby patterns for workloads that tolerate longer RTO. Leverage PaaS services with built-in DR (SQL Database auto-failover groups, Cosmos DB multi-region) to avoid managing duplicate infrastructure. Scale down secondary region resources during normal operation.

---

## Key Takeaways

1. **Define RPO and RTO for every workload before designing DR architecture.** These objectives determine the appropriate DR pattern, technology choices, and cost. Mission-critical workloads justify hot standby or active-active patterns; non-critical workloads use cold standby and backup-restore.

2. **Azure region pairs are designed for DR.** Platform updates roll out sequentially to paired regions, and Microsoft prioritizes recovery of paired regions during widespread outages. Design DR architectures to leverage region pairs unless specific compliance or latency requirements dictate otherwise.

3. **Azure Site Recovery provides the lowest RTO for VM workloads.** ASR continuously replicates VMs with 5-minute RPO and orchestrates failover with recovery plans. For VM-based workloads requiring sub-hour RTO, ASR is the primary tool.

4. **Storage geo-redundancy has a 15-minute RPO.** GRS and GZRS replicate asynchronously with typical replication lag of 15 minutes. This is acceptable for most workloads but insufficient for mission-critical data requiring zero RPO. Use application-level replication or synchronous solutions for stricter requirements.

5. **PaaS services have built-in DR that reduces operational complexity.** Azure SQL Database auto-failover groups, Cosmos DB multi-region replication, and Service Bus geo-DR eliminate the need to manage DR infrastructure manually. Prefer PaaS DR over VM-based replication when possible.

6. **Test failover is the only way to validate DR readiness.** Untested DR plans fail during real disasters. Use ASR test failover quarterly, conduct tabletop exercises to walk through procedures, and perform full DR drills annually for critical workloads.

7. **DNS-based failover introduces latency due to TTL.** Traffic Manager relies on DNS clients refreshing cached records. For instant failover, use Azure Front Door which proxies traffic and detects failures without DNS propagation delay.

8. **Backup and disaster recovery serve different purposes.** Azure Backup protects against data corruption, accidental deletion, and operational errors with long-term retention. Azure Site Recovery protects against regional outages with continuous replication and fast failover. Use both together for complete protection.

9. **Automate DR procedures to reduce RTO and human error.** Manual failover is slow and error-prone, especially under the stress of a real disaster. Use Azure Automation runbooks or Logic Apps to orchestrate failover, validate health, and notify stakeholders.

10. **DR cost scales with RTO requirements.** Hot standby requires running duplicate infrastructure and doubles cost. Warm standby scales down secondary resources to reduce cost while maintaining moderate RTO. Cold standby costs the least but has the longest RTO. Choose the pattern that aligns with business requirements and budget constraints.
