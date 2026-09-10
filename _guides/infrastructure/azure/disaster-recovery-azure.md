---
title: "Disaster Recovery on Azure"
layout: guide
category: Azure
subcategory: Architecture Patterns (Advanced)
description: "The RPO and RTO figures Azure actually publishes per service, Site Recovery replication and its defaults, the three storage failover types and what each one costs you, SQL failover groups and Cosmos DB consistency as a durability choice, and how to test any of it"
tags: [disaster-recovery, azure-site-recovery, rpo-rto, failover, geo-replication, advanced]
---

## What Is Disaster Recovery

Disaster recovery is the set of mechanisms that bring an application back after a failure large enough that in-place redundancy cannot absorb it: a region-wide outage, a destructive human error, a ransomware event.

The hard part is not the mechanism. It is being honest about two numbers, choosing services whose published guarantees match them, and testing the result before an incident tests it for you.

### What Problems It Solves

**Without a DR plan:**
- The recovery procedure is invented during the incident, by whoever is awake
- Nobody knows how much data will be lost, because nobody measured replication lag
- Backups exist but have never been restored
- Dependencies (DNS, identity, secrets, private endpoints) are discovered to exist only in the primary region

**With one:**
- RPO and RTO are stated numbers that the chosen services can actually meet
- Failover is a rehearsed runbook, not an improvisation
- Restores are tested on a schedule, so backup validity is known rather than assumed
- The whole dependency chain has been exercised in the secondary region

### How Azure DR Differs from AWS

| Concept | AWS | Azure |
|---------|-----|-------|
| **VM replication** | Elastic Disaster Recovery | Azure Site Recovery, orchestrating replication, failover, and failback |
| **Storage geo-redundancy** | S3 Cross-Region Replication, configured per bucket | GRS and GZRS as an account-level redundancy setting, with a fixed secondary region |
| **Managed SQL DR** | RDS cross-region read replicas, Aurora Global Database | Active geo-replication and failover groups, with listener endpoints that survive failover |
| **Global NoSQL** | DynamoDB global tables | Cosmos DB, where the consistency level *is* the RPO choice |
| **Backup** | AWS Backup | Azure Backup with Recovery Services and Backup vaults |

---

## RPO, RTO, and Recovery Tiers

### The Two Numbers

```
                        ◀── RPO ──▶│◀────────── RTO ──────────▶
                                   │
   ────●───────●───────●───────────╳──────────────────────────●──────▶ time
       write   write   last        │                          service
                       replicated  │                          restored
                       write       incident
       └──────── these are ────────┘
             at risk of loss

   RPO answers "how much data can we lose?"      → measured in data, backwards from the incident
   RTO answers "how long can we be down?"        → measured in time, forwards from the incident
```

They are independent. A design can have a five-second RPO and a four-hour RTO, if replication is continuous but nothing is standing by to run the workload. The opposite also happens: a warm standby that comes up in two minutes against a backup restored from last night.

Set them per workload, not per organization. A single company-wide "RTO of one hour" either overspends on the systems that do not need it or is quietly untrue for the ones that do.

### Choosing a Recovery Tier

```
What is the acceptable RTO?

  hours to a day
  └─▶ COLD: nothing running in the secondary region.
      Data replicated; infrastructure deployed from IaC at failover time.
      Cheapest. RTO is however long your pipeline takes, plus data restore.

  1 to 4 hours
  └─▶ PILOT LIGHT: the stateful core runs (database replica, replicated disks
      via Site Recovery); the stateless tier does not exist until failover.
      Site Recovery is the canonical fit: replication without running VMs.

  minutes
  └─▶ WARM: everything exists in the secondary region at reduced scale,
      and scales up at failover. Routing change plus a scale-out.

  seconds
  └─▶ HOT / active-active: full capacity already serving.
      No promotion step, and the highest cost.
```

Cold and pilot light look similar on a diagram and differ enormously in practice: with pilot light the data is already there and continuously current, so failover is a compute problem. With cold, failover is a compute problem *and* a restore, and the restore usually dominates the RTO.

### Backup Is Not Disaster Recovery

They protect against different things, and each one fails at the other's job.

| | Backup | Disaster recovery |
|---|---|---|
| **Protects against** | Deletion, corruption, ransomware, bad deploys | Infrastructure and regional failure |
| **Recovery target** | A point in the past | The most recent replicated state |
| **Typical RPO** | Hours to a day | Seconds to minutes |
| **Typical RTO** | Hours | Minutes |

Replication is not backup, because it faithfully replicates the deletion. Backup is not DR, because restoring a large database is measured in hours. Any workload that matters needs both, and the ransomware scenario is what makes that concrete: geo-replication propagates the encryption, and only an immutable, separately-credentialed backup gets you out.

---

## What Azure Actually Publishes

Most RPO and RTO numbers quoted for Azure services come from blog posts. These are the ones Microsoft states in its own documentation, and they are the only ones that belong in a design document.

| Capability | RTO | RPO |
|---|---|---|
| **SQL Database, zone redundancy** | Typically under 30 seconds | 0 |
| **SQL Database, failover groups (customer-managed) or active geo-replication** | Typically under 60 seconds | Greater than or equal to 0, depending on unreplicated changes |
| **SQL Database, geo-restore from backup** | Minutes to hours, by storage replication | Minutes to hours, by backup size |
| **Cosmos DB, single region, any consistency** | n/a | Under 240 minutes |
| **Cosmos DB, multi-region, single write region, Strong** | n/a | **0** |
| **Cosmos DB, multi-region, Bounded staleness** | n/a | The configured *K* versions and *T* interval |
| **Cosmos DB, multi-region, Session / Consistent prefix / Eventual** | n/a | Under 15 minutes |
| **Azure Storage, block blobs with Geo priority replication** | n/a | 15 minutes or less |
| **Azure Storage, GRS or GZRS generally** | Under an hour for a customer-managed failover | Measured by **Last Sync Time**, not a published bound |
| **Site Recovery, Azure-to-Azure** | Depends on the recovery plan | Crash-consistent recovery points every 5 minutes |

Two things stand out. **Cosmos DB is the only Azure data service with a documented RPO of zero across regions**, and it costs you the ability to write in more than one region. And **Azure Storage publishes no general geo-replication RPO**, because the 15-minute figure belongs specifically to Geo priority replication for block blobs. For everything else, Last Sync Time is the measurement, which means your RPO is whatever it happens to be at the moment of the incident.

---

## Storage

### Redundancy Options

| Option | Primary region | Secondary region | Durability per year | Read from secondary |
|--------|-------|-------|---|---|
| **LRS** | 3 copies, one datacenter | None | At least 11 nines | n/a |
| **ZRS** | Synchronous across 3+ zones | None | At least 12 nines | n/a |
| **GRS** | LRS | Async to secondary, LRS there | At least 16 nines | No |
| **GZRS** | ZRS | Async to secondary, LRS there | At least 16 nines | No |
| **RA-GRS / RA-GZRS** | As above | As above | At least 16 nines | Yes, at `<account>-secondary.<service>.core.windows.net` |

The secondary is **always LRS**, whichever geo option you pick. GRS and GZRS differ only in how the primary replicates, and GZRS additionally requires a region that has both availability zones and a paired region.

Read availability differs in a way that matters for a DR design: GRS and GZRS are documented at **at least 99.9%** for reads, while RA-GRS and RA-GZRS reach **at least 99.99%**, because the secondary is readable. Microsoft recommends **RA-GZRS** for maximum availability and durability.

Four constraints that change designs:

- **Azure Files does not support RA-GRS or RA-GZRS.** GRS and GZRS only, with no read access to the secondary.
- **Managed disks support only LRS and ZRS.** There is no geo-redundant managed disk; cross-region disk protection is Site Recovery or Azure Backup, not a redundancy setting.
- **The archive tier is unsupported on ZRS, GZRS, and RA-GZRS.** If you need archive and zone redundancy together, you need two accounts.
- **Redundancy is an account-level setting shared by every service in it.** Split resources with different redundancy requirements into different accounts.

### Failover Has Three Modes

This is where most storage DR plans go wrong, because two of the three are destructive and the non-destructive one is often assumed not to exist.

| Type | Data loss | Original primary | Resulting redundancy |
|---|---|---|---|
| **Customer-managed planned** | None expected | Becomes the new secondary | Converted to GRS; geo-redundancy **retained** |
| **Customer-managed unplanned** | Expected | Its copy is **deleted** | Converted to **LRS**; geo-redundancy **lost** |
| **Microsoft-managed** | Expected | Region-wide scope | Not invocable per account |

**Planned failover is the DR-drill mechanism.** It swaps primary and secondary, expects no data loss as long as both regions are available throughout, and keeps geo-redundancy so failback is symmetric. You do not need a separate test storage account to rehearse storage failover.

**Unplanned failover is the emergency one, and it is expensive after the fact.** The account lands on LRS in the new primary, the old primary's copy is deleted, point-in-time restore resets to the failover completion time, and re-enabling geo-redundancy costs a full re-replication with any archived blobs rehydrated first. Check **Last Sync Time** before initiating one, so you know what you are choosing to lose.

**Microsoft-managed failover is not a plan.** Microsoft's own guidance says explicitly not to rely on it: it is region-wide, reserved for extreme circumstances, and cannot be triggered for your account.

Several things do not fail over with the data: the **storage resource provider** (management operations and the `Location` property stay with the original region), **virtual machines**, and four features entirely: **Azure File Sync, premium block blobs, NFSv3, and either side of an object replication policy**. Change feed, object replication, and point-in-time restore are additionally unsupported for *planned* failover.

### Patterns

**Object Replication** copies specific containers between accounts in different regions and is the tool when GRS's fixed secondary region or account-level granularity does not fit. It is also the only way to replicate blobs to a region of your choosing. Note that an account in an object replication policy cannot use customer-managed failover, so the two mechanisms are alternatives rather than layers.

**Backup to a separate account** keeps the operational account on LRS or ZRS and pushes what must survive a region to a geo-redundant account, often in a different subscription with different credentials. That separation is what makes it a ransomware control rather than just a durability control.

**Application-level dual write** gives a zero RPO and no failover step at all, at the cost of owning consistency between the two accounts. Reach for it only when the published RPO genuinely is not enough.

---

## Azure Site Recovery

[Azure Site Recovery](https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-overview){:target="_blank" rel="noopener noreferrer"} (ASR) replicates VMs to another region and orchestrates failover and failback. For Azure-to-Azure it is the pilot-light mechanism: disks replicate continuously, and target VMs are only created when you fail over.

### The Replication Path

```
   SOURCE REGION                                TARGET REGION
  ┌──────────────────────┐
  │  Azure VM            │
  │  ┌────────────────┐  │
  │  │ Mobility svc   │  │  installed automatically
  │  │ extension      │  │  when replication is enabled
  │  └───────┬────────┘  │
  └──────────┼───────────┘
             │ every disk write, immediately
             ▼
  ┌──────────────────────┐   processed and          ┌───────────────────────┐
  │ Cache storage account│───sent asynchronously───▶│ Replica managed disks │
  │ (source region)      │                          │  <name>-ASRReplica    │
  └──────────────────────┘                          └───────────┬───────────┘
    absorbs the write burst                                     │
    so production is not                                        ▼
    waiting on cross-region                          ┌───────────────────────┐
    transfer                                         │ Recovery points       │
                                                     │ crash-consistent      │
                                                     │ every 5 min (fixed)   │
                                                     │ app-consistent only   │
                                                     │ if you enable it      │
                                                     └───────────────────────┘
```

Note that **Azure-to-Azure replication is not agentless**. The Mobility service extension is installed on the VM automatically when you enable replication, which is convenient but still means an in-guest component with its own upgrade lifecycle and outbound connectivity requirements. ASR never needs *inbound* connectivity to the VM.

### Replication Policy Defaults Are Not What You Want

Two defaults deserve to be changed deliberately rather than inherited:

| Setting | Default | What to know |
|---|---|---|
| **Recovery point retention** | **One day** | Longer retention costs more storage, but one day is short if you might discover corruption late |
| **App-consistent snapshot frequency** | **Zero hours, meaning disabled** | Crash consistency is the only consistency you get until you turn this on |
| **Crash-consistent frequency** | Every 5 minutes | **Cannot be modified** |

The app-consistent default is the one that surprises people. Most applications recover fine from a crash-consistent point, which is why the default is what it is, but a transactional database recovered from a crash-consistent snapshot is doing crash recovery, not clean startup. If that is not acceptable, enable app-consistent snapshots and set the frequency below the retention period.

App-consistent snapshots use VSS, and ASR uses **Copy Only backup (`VSS_BT_COPY`)**, so taking them does not disturb SQL Server's transaction log backup chain or sequence numbers. They do take longer than crash-consistent snapshots and they do affect application performance while they run.

### Multi-VM Consistency

If several VMs form one application and need recovery points that are consistent *across* machines, put them in a replication group. Two costs: it affects workload performance, so it is for applications that genuinely need cross-VM consistency, and the machines communicate over **port 20004**, which must not be blocked between them.

### Target Resources and What You Cannot Change Later

ASR creates target resources with an `asr` suffix by default: resource group, VNet, subnet, availability set. Replica disks get an `-ASRReplica` suffix. If the target region supports availability zones, the replica is assigned **the same zone number as the source**.

Most target settings, including the target VM SKU, can be changed while replication is running. **The availability type cannot.** Changing between single instance, availability set, and availability zone requires disabling replication, changing it, and re-enabling, which means a full initial replication again. Decide it up front.

### Recovery Plans

A recovery plan groups VMs into ordered groups with pre- and post-actions, which is what turns "the VMs are up" into "the application is up".

| Group | Contents | Pre-action | Post-action |
|-------|-----|------------|-------------|
| 1 | Database VMs | none | Verify the database is online and accepting connections |
| 2 | Application VMs | none | Verify application-to-database connectivity |
| 3 | Web VMs | Repoint Front Door or Traffic Manager | Smoke test, then notify |

The scripted pre- and post-actions are where a recovery plan earns its keep, because they are the steps people forget under pressure: DNS, connection strings, firewall rules, and the notification that tells everyone else what just happened.

### Failing Over and Back

**Test failover** builds isolated copies of the VMs in a separate network without touching production or interrupting replication. It is the only way to validate readiness without an outage, and it should run on a schedule and after any significant infrastructure change.

**Failover** starts the VMs in the target region from a recovery point you choose. If the source region is still reachable, shutting the source VMs down as part of the failover minimizes data loss by letting in-flight changes drain; if it is not, you take the latest available recovery point and accept the gap. A failover is not final until you **commit** it, which discards the other recovery points and fixes the choice.

**Reprotect and failback** is the return trip: reverse the replication direction back to the original region, wait for it to synchronize, then fail over again. It requires the original region to be healthy, costs another full transfer, and takes as much orchestration as the outbound trip. Plan it before you need it, because "we will figure out failback later" is how organizations end up running permanently in their DR region on infrastructure sized for a temporary stay.

---

## Databases

### Azure SQL Database

Three distinct capabilities, and the published numbers separate them cleanly:

**Zone redundancy** is in-region HA. RTO typically under 30 seconds, **RPO zero**, transparent to the application. Enable it first; it is the cheapest resilience available and it is a configuration flag.

**Failover groups and active geo-replication** are cross-region DR. RTO typically under 60 seconds, RPO greater than or equal to zero depending on what had not replicated. Failover groups add the listener endpoints that survive a failover, so connection strings do not change.

**Geo-restore** restores from geo-replicated backups into any region. RTO and RPO are both minutes to hours, by storage replication and database size respectively. It is the fallback when no replica exists, not a DR design.

| | Active geo-replication | Failover groups |
|---|---|---|
| Fail over several databases together | No | Yes |
| Connection string unchanged after failover | No | Yes |
| Multiple replicas | Yes, up to 4 | No (multiple secondaries is preview) |
| Secondary can be in the same region | Yes | No |
| Read-scale from the secondary | Yes | Yes, via the read-only listener |

**The failover policy names are inverted from their plain meaning**, and this is the single most consequential detail in SQL DR. `manual` is the **customer-managed** policy and is Microsoft's recommendation. `automatic` is the **Microsoft-managed** policy: it triggers a **forced** failover, which can lose data, for **every** failover group in the region set to that policy rather than for yours specifically, and no sooner than `GracePeriodWithDataLossHours`, which cannot be set below one hour.

Three more details belong in the design:

- **Failover** (planned) fully synchronizes before switching and guarantees **no data loss**, but requires a reachable primary. **Forced failover** does not synchronize and can lose data. Use planned failover for drills and for failback.
- **Listener DNS records have a 30-second TTL**, and the **read-only listener does not fail over by default**.
- **Backups** run continuously underneath all of this: full weekly, differential every 12 or 24 hours, and transaction log every 5 to 10 minutes, stored in geo-redundant backup storage for 7 days by default, with point-in-time restore configurable up to 35 days on every tier except Basic.

On cost, a secondary used **only** for DR, with no read or write workload, can be designated a **license-free standby replica**, which removes the licensing component of its cost. This is the most commonly missed lever in SQL DR budgeting.

### Azure SQL Managed Instance

Managed Instance supports failover groups too, with extra weight from its VNet integration: the primary and secondary VNets must be connected, address spaces must not overlap, instance provisioning is slow, and the whole instance fails over as a unit. Expect a longer RTO than SQL Database.

**Managed Instance link** replicates an on-premises or VM-hosted SQL Server to a Managed Instance, which makes Azure a DR target for a SQL Server estate that is not moving to Azure yet.

### Cosmos DB

Cosmos DB is unusual in that **the consistency level is the RPO decision**, and Microsoft publishes the mapping:

| Regions | Write mode | Consistency | RPO |
|---|---|---|---|
| 1 | Either | Any | Under 240 minutes |
| More than 1 | Single write region | **Strong** | **0** |
| More than 1 | Single write region | Bounded staleness | The configured *K* and *T* |
| More than 1 | Single write region | Session, Consistent prefix, Eventual | Under 15 minutes |
| More than 1 | Multiple write regions | Bounded staleness | The configured *K* and *T* |
| More than 1 | Multiple write regions | Session, Consistent prefix, Eventual | Under 15 minutes |

Read the table for what is missing: **strong consistency does not appear on any multi-write row**, because a distributed system cannot offer both a zero RPO and a zero RTO. Choosing multi-region writes is choosing a non-zero RPO.

Bounded staleness has floors: for a multi-region account, the minimum *K* and *T* are **100,000 write operations or 300 seconds**, so it cannot be tuned arbitrarily close to strong.

Strong consistency has costs beyond write latency. Writes must commit in **every** region, so write latency becomes twice the round-trip time between the two farthest regions plus 10 ms at p99. **Strong is blocked by default for accounts spanning more than 5,000 miles**, and enabling it requires contacting support. Strong and bounded staleness reads consult two replicas, so their **RU cost is double** that of the weaker levels and read throughput at a given provisioning is half.

For availability, accounts with three or more strong-consistency regions use **dynamic quorum**: unresponsive regions are dropped from the quorum set to preserve both strong consistency and write availability, and are added back once they catch up. Regions removed from the quorum cannot serve reads while they are out.

---

## Compute, Networking, and PaaS

### Compute

| Service | DR approach |
|---|---|
| **VMs and scale sets** | Site Recovery for replication, or redeploy from IaC into a pre-existing secondary VNet |
| **AKS** | Do not replicate clusters. Deploy an identical cluster from the same IaC and GitOps repository, and keep images in a geo-replicated ACR |
| **App Service** | Deploy the app to a plan in the second region and route with Front Door. App content is not replicated for you |
| **Functions** | Same as App Service, plus a plan for the trigger's state: a queue trigger in the failed region has messages nobody is reading |

The AKS row generalizes. For anything defined by IaC and deployed by a pipeline, **redeploying is a better DR strategy than replicating**, because the artifact you recover is the one you test on every deployment. Replication is for the things you cannot rebuild: data, and VMs whose configuration lives only inside the VM.

### Networking

Global routing is covered in depth in the multi-region material; the DR-specific points are these:

**Front Door** fails over in-path on origin health, so it does not wait on anyone's DNS cache, and it terminates TLS at the edge so the secondary region does not need its own certificate.

**Traffic Manager** with priority routing is the classic active-passive pattern and works for any protocol, but its failover speed is bounded by DNS cache expiry at every resolver and client, not by how fast its health probes notice. Do not state an RTO that assumes universal TTL compliance.

**Health probes decide when DR happens**, so point them at something that exercises the region's actual dependencies. A probe that returns 200 from a web tier whose database is unreachable keeps a dead region in rotation. If you build these as Application Insights availability tests, use **standard tests**, because classic URL ping tests retire on **30 September 2026**.

### Messaging

This is the most under-appreciated gap in Azure DR plans. **Service Bus and Event Hubs geo-disaster recovery replicates entity metadata, not messages.** After failover the secondary namespace has your queues, topics, subscriptions, consumer groups, and rules, and none of the undelivered messages. Service Bus geo-DR requires the Premium tier.

**Storage queues have no message-level geo-replication at all.** GRS replicates the account, but queue message durability across a regional failure is not something you can configure.

If messages must survive a region loss, the mechanisms are producer-side: write to a durable store before enqueueing, dual-write to a second namespace, or make producers retry against the secondary. For event streams specifically, **Event Hubs Capture** to a geo-redundant storage account gives you an offline record even though the live stream does not survive.

---

## Testing

An untested DR plan is a hypothesis with a budget. Azure gives you three non-destructive mechanisms to turn it into a fact:

- **Site Recovery test failover**, which builds the VMs in an isolated network without touching production or pausing replication
- **Storage customer-managed planned failover**, which swaps primary and secondary with no expected data loss and keeps geo-redundancy
- **SQL failover group planned Failover**, which synchronizes fully before switching and guarantees no data loss

Run them together, as one drill, on a schedule. Component-level tests pass routinely while the end-to-end drill fails, and it fails on the same things every time: a private DNS zone linked only in the primary VNet, a managed identity with no role assignment in the secondary subscription, a Key Vault firewall that does not know about the secondary region's subnets, a certificate that only exists on the primary region's gateway.

Test the restore path too, not just the failover path. Replication protects against infrastructure loss; only a restore protects against corruption, and a backup that has never been restored is an untested assumption with a monthly bill.

**Measure the drill.** The output of a DR test is two numbers, how long it took and how much data would have been lost, compared against the two numbers in your design. If you are not writing those down, you are rehearsing rather than testing.

---

## Cost

DR cost is dominated by what runs while nothing is wrong.

| Lever | Effect |
|---|---|
| **Site Recovery instead of standby VMs** | Pay per protected instance plus replication storage and transactions, rather than for running VMs |
| **License-free standby SQL replica** | Removes the licensing component from a secondary used only for DR |
| **Smaller SKUs in the secondary** | Trades RTO for cost, since failover now includes a scale-up |
| **Redundancy matched to the data** | LRS or ZRS for anything recreatable, GRS or GZRS only where a region loss is unacceptable |
| **Backup retention tuned to requirement** | Recovery point storage is a recurring cost; retain what compliance and operations need, not more |
| **Cheaper tiers for cold backups** | Cool and archive for what is not on the fast-recovery path |

Two traps. **A VM reservation has instance size flexibility but no region flexibility**, so a commitment bought for the primary region does not follow the workload into the secondary. A multi-region posture buys per region or pays on demand where it fails over. And **Spot VMs default to the Deallocate eviction policy**, which keeps consuming quota and paying for disk storage on instances that are no longer running, which is a quietly expensive way to hold DR capacity.

---

## Automating the Runbook

Manual DR is slow at exactly the moment slowness costs the most, and it is executed by people who have not done it in a year.

**What to automate first**, in order of value: the sequencing (databases before applications before web), the configuration changes that failover requires (connection strings, DNS, traffic routing), the health validation between steps, and the notifications.

**Where to put it.** Site Recovery recovery plans can call Azure Automation runbooks as pre- and post-actions, which keeps the orchestration next to the failover it orchestrates. Logic Apps suits the coordination layer above that: approvals, notifications, and calling out to systems that are not Azure. Either way, the automation is itself infrastructure: it lives in source control, it is deployed by a pipeline, and it is exercised by the drill.

**Automate the checks, keep humans on the decision.** The choice to fail over is a judgment call with a data-loss cost attached, especially for storage, where the unplanned path deletes the original primary. Automate everything after that decision, and leave the decision to a person with the Last Sync Time in front of them.

---

## Common Pitfalls

### Pitfall 1: Never Running the Drill

**Problem:** DR is configured, documented, and never exercised.

**Result:** The first real failover discovers the dependencies that were never deployed to the secondary region. Recovery takes far longer than the stated RTO, and the plan's numbers turn out to be aspirations.

**Solution:** Schedule a full drill: Site Recovery test failover, storage planned failover, and SQL planned Failover, run together and timed. Record the actual RTO and data-loss window and compare them to the design.

---

### Pitfall 2: Reading GRS as a Zero-RPO Guarantee

**Problem:** Treating geo-redundant storage as if data exists in both regions at all times.

**Result:** Replication to the secondary is asynchronous, and Azure publishes no general RPO for it. The 15-minute number applies only to Geo priority replication for block blobs. Recent writes are lost, and the amount is unknown because nobody was watching Last Sync Time.

**Solution:** Monitor Last Sync Time and check it before any failover decision. If the RPO must be bounded, use Geo priority replication for block blobs, object replication, or application-level dual write.

---

### Pitfall 3: Using Unplanned Storage Failover for a Drill

**Problem:** Testing storage DR with a customer-managed *unplanned* failover, or assuming no test mechanism exists and skipping the test entirely.

**Result:** The account converts to LRS, the original primary's copy is deleted, point-in-time restore resets, and restoring geo-redundancy costs a full re-replication with archived blobs rehydrated first.

**Solution:** Use customer-managed **planned** failover. It exists specifically for drills, expects no data loss, and retains geo-redundancy through failover and failback.

---

### Pitfall 4: Inheriting Site Recovery's Replication Policy Defaults

**Problem:** Enabling replication and accepting the default policy.

**Result:** Recovery point retention is one day, and **app-consistent snapshots are disabled**. A transactional workload recovered from a crash-consistent point is doing crash recovery, and a corruption noticed on day three has no recovery point old enough to help.

**Solution:** Set retention against how long corruption might go unnoticed, and enable app-consistent snapshots at a frequency below the retention period for anything transactional. Note that crash-consistent frequency is fixed at five minutes and cannot be changed.

---

### Pitfall 5: Configuration That Only Exists in the Primary Region

**Problem:** Data replicates, compute is ready, and the surrounding configuration was only ever built once: private DNS zone links, private endpoints, Key Vault network rules, managed identity role assignments, NSG rules, certificates.

**Result:** Failover completes, the database is up, and nothing can reach it. This is the most common way a rehearsed failover fails on its first real use.

**Solution:** Deploy both regions from the same infrastructure-as-code, and make the drill exercise the data path rather than checking that a replica was promoted.

---

### Pitfall 6: Expecting Messaging Geo-DR to Carry Messages

**Problem:** Enabling Service Bus or Event Hubs geo-DR and assuming queued work survives a regional failover.

**Result:** Metadata replicates; messages do not. The secondary namespace comes up with the right topology and an empty queue, and the work that was in flight is gone.

**Solution:** Make producers durable by persisting before enqueueing, dual-writing, or retrying against a second namespace. Use Event Hubs Capture to geo-redundant storage for event streams. Treat geo-DR as topology recovery.

---

### Pitfall 7: One Organization-Wide RTO

**Problem:** A single RTO and RPO applied to every workload.

**Result:** Either the number is set by the most critical system and every minor service is over-engineered, or it is set by what is affordable and the critical systems quietly cannot meet it.

**Solution:** Tier the workloads and set objectives per tier. Then check each tier's objectives against the numbers Azure actually publishes for the services involved, because a stated RTO no service can deliver is worse than no stated RTO at all.

---

## Key Takeaways

1. **RPO and RTO are independent and belong to workloads, not organizations.** One number for the whole estate either overspends on the unimportant or is untrue for the important.

2. **Use the figures Microsoft publishes.** SQL zone redundancy is under 30 seconds RTO with zero RPO; SQL geo-failover is under 60 seconds RTO; Cosmos DB RPO is defined by the consistency level; Azure Storage publishes no general geo-replication RPO at all.

3. **Cosmos DB's consistency level is its RPO setting.** Strong with a single write region gives RPO zero. Multi-region writes rule strong out entirely, and the weaker levels are under 15 minutes.

4. **Storage failover has a non-destructive mode, and it is the one for drills.** Planned failover keeps geo-redundancy and expects no data loss. Unplanned failover converts the account to LRS and deletes the original primary's copy.

5. **Last Sync Time is your storage RPO.** Monitor it, and read it before deciding to fail over.

6. **Site Recovery's app-consistent snapshots are off by default**, retention defaults to one day, and the five-minute crash-consistent interval cannot be changed. Set the first two deliberately.

7. **Azure-to-Azure Site Recovery installs an in-guest Mobility service extension.** It is automatic, not absent, and it needs outbound connectivity.

8. **SQL's `automatic` failover policy means Microsoft-managed, region-wide, and forced.** Customer-managed (`manual`) is the recommended policy, and planned Failover is the only operation that guarantees no data loss.

9. **Rebuild what you can rebuild; replicate only what you cannot.** IaC-defined infrastructure recovers better by redeployment than by replication, because the artifact is exercised on every deployment.

10. **Replication is not backup.** It faithfully replicates deletion and corruption. A separately-credentialed, immutable, periodically-restored backup is the only control that covers the case where the data itself is the problem.
