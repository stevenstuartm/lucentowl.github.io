---
title: "Multi-Region Architecture on Azure"
layout: guide
category: Azure
subcategory: Architecture Patterns (Advanced)
description: "What Azure region pairs actually guarantee, choosing between Front Door, Traffic Manager, and the Global load balancer, multi-region data with Cosmos DB, SQL failover groups, and geo-redundant storage, and where each of those failover paths loses data"
tags: [multi-region, front-door, failover, geo-replication, cosmos-db, reliability, advanced]
---

## What Is Multi-Region Architecture

Multi-region architecture spreads an application across two or more Azure regions so that losing one region degrades the service rather than ending it. That is the goal. Most of the work is in the parts that do not move: where writes go, what happens to data that had not replicated yet, and how clients learn that the address changed.

This guide covers the Azure mechanics behind those decisions.

### What Problems Multi-Region Solves

**Without it:**
- A regional outage takes the whole application down, and no amount of in-region redundancy helps
- Globally distributed users all pay the latency to one region
- Data residency requirements that span geographies cannot be met
- Planned regional maintenance is indistinguishable from an outage

**With it:**
- The application survives the loss of an entire region
- Users reach a nearby region rather than a distant one
- Data can be kept in the geography that regulation requires
- Failover can be rehearsed rather than discovered

### How Azure Differs from AWS

| Concept | AWS | Azure |
|---------|-----|-------|
| **Regional grouping** | Regions are independent; no formal pairing | Some regions have a *pair* used by a small number of services; many newer regions have none |
| **Global HTTP routing** | CloudFront and Global Accelerator | Azure Front Door, combining CDN, WAF, and global routing in one service |
| **DNS-based routing** | Route 53 with health checks | Azure Traffic Manager |
| **Global L4 routing** | Global Accelerator | Global tier (cross-region) Load Balancer |
| **Multi-region NoSQL** | DynamoDB global tables | Cosmos DB, with five consistency levels rather than eventual only |
| **Multi-region SQL** | Aurora Global Database | Active geo-replication with failover groups |

---

## Regions, Geographies, and Pairs

### What a Pair Actually Guarantees

This is the most over-read concept in Azure architecture, so start from what Microsoft's own [region pairs](https://learn.microsoft.com/en-us/azure/reliability/regions-paired){:target="_blank" rel="noopener noreferrer"} guidance says: **Azure regions are independent of each other**, and only *a small number* of Azure services use pairs at all. Many regions are not paired and use availability zones as their primary redundancy instead.

Where a pair does exist, it provides exactly three things:

- **Region recovery sequence.** In a geography-wide outage, one region in each pair is prioritized for recovery.
- **Sequential updating.** Azure staggers planned system updates across a pair, so a faulty update is unlikely to hit both at once.
- **Data residency.** *Almost all* regions sit in the same geography as their pair.

And one thing it explicitly does **not** provide, in Microsoft's words: deploying to a region in a pair does not automatically make resources more resilient, and gives no automatic high availability, disaster recovery, or failover. You build that yourself either way.

### Asymmetric and Nonpaired Regions

Pairing is not always reciprocal, and that breaks the assumption people build residency arguments on:

- **Brazil South is paired with South Central US**, which is outside the Brazil geography, and South Central US is not paired back to it
- **West India is paired with South India, but South India is paired with Central India**
- **West US 3 is paired one-way with East US**, while East US is bidirectionally paired with West US

So "data never leaves the geography during replication" is not a property of pairing. Verify it per region rather than assuming it.

A growing list of regions have no pair at all, including Chile Central, Mexico Central, Austria East, Belgium Central, Denmark East, Italy North, Poland Central, Spain Central, Israel Central, Qatar Central, Indonesia Central, Malaysia West, and New Zealand North. Many Azure services replicate between arbitrary regions and do not need a pair, so a nonpaired region is not a dead end.

### Some Familiar Pairs

| Region | Paired region |
|----------------|---------------|
| East US | West US |
| East US 2 | Central US |
| Central US | East US 2 |
| North Europe | West Europe |
| Southeast Asia | East Asia |
| UK South | UK West |
| Australia East | Australia Southeast |
| Canada Central | Canada East |
| North Central US | South Central US |
| Brazil South | South Central US (asymmetric, cross-geography) |

---

## Availability Zones Versus Regions

Zones and regions answer different failure questions, and the answer for most applications is both.

| Property | Availability zones | Multiple regions |
|---|---|---|
| **Protects against** | Datacenter-level failure | Whole-region failure |
| **Latency between** | Round trip under 2 ms | Tens to hundreds of ms, by distance |
| **Data transfer** | Within a region | Cross-region charges apply |
| **Consistency** | Synchronous replication is practical | Asynchronous in nearly every case |
| **Application changes** | Usually none | Significant, especially for writes |

Zones are cheap resilience: for most PaaS services, zone redundancy is a configuration flag with no application change and synchronous replication behind it. Regions are expensive resilience, because the latency forces asynchronous replication, and asynchronous replication is what puts a non-zero RPO into your design.

The order of operations is therefore: make everything zone-redundant first, then add a region for the failures zones cannot cover. A multi-region design built on single-zone resources in each region has more ways to break, not fewer.

| Failure | Zones only | Regions only | Both |
|------------------|------------|-------------------|----------------------|
| Single instance | Protected | Protected | Protected |
| Datacenter | Protected | Protected only by failing the whole region over | Protected |
| Whole region | Not protected | Protected | Protected |

---

## Global Traffic Routing

Azure has three global routing services, separated by the layer they work at.

### Choosing Between Them

```
Is the traffic HTTP or HTTPS?
├── no ──▶ Does it need failover faster than DNS TTL allows?
│          ├── yes ──▶ Global tier (cross-region) Load Balancer
│          └── no  ──▶ Traffic Manager
└── yes
    │
    Do you need any of: TLS termination at the edge, WAF,
    caching, path-based routing, or Private Link to origins?
    ├── yes ──▶ Azure Front Door
    └── no
        │
        Is DNS-cache failover delay acceptable?
        ├── yes ──▶ Traffic Manager (cheapest, protocol-agnostic)
        └── no  ──▶ Azure Front Door
```

Front Door and Traffic Manager also compose: Traffic Manager can front non-HTTP endpoints while Front Door handles the web tier, and nested Traffic Manager profiles let you do performance routing across regions with priority routing inside each one.

### Azure Traffic Manager

[Traffic Manager](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-overview){:target="_blank" rel="noopener noreferrer"} is a DNS-based load balancer. It answers a DNS query with the address of a healthy endpoint and then steps out of the path entirely, so the client connects to the endpoint directly.

| Routing method | Behavior |
|--------|----------|
| **Priority** | All traffic to the highest-priority healthy endpoint. Active-passive |
| **Weighted** | Distribute by assigned weight. Gradual rollout, capacity-based splits |
| **Performance** | Lowest network latency from the client's resolver |
| **Geographic** | By the geographic location the query came from. Data residency |
| **MultiValue** | Return several healthy endpoints and let the client choose |
| **Subnet** | By client IP range. Dedicated endpoints for named networks |

Because it works at DNS, it carries any protocol and costs very little. It also inherits DNS's central weakness: **failover is bounded by cache expiry, not by health-check speed**. You can set a low TTL, but resolvers and clients are free to ignore it, and some do. Traffic Manager also cannot see inside a request, so no path routing, no TLS termination, and no WAF.

One consequence shapes the certificate design. Because the client connects directly to the regional endpoint, **each region needs its own valid TLS certificate**, and a wildcard or SAN certificate covering all regional names is the usual answer.

### Azure Front Door

[Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview){:target="_blank" rel="noopener noreferrer"} is a Layer 7 global load balancer with CDN caching, WAF, and TLS termination at Microsoft's edge. It stays in the request path, which is what lets it fail over without waiting for anyone's DNS cache.

Note how a client reaches an edge POP, because this changed: **Front Door Standard and Premium select POPs by unicast, through an internal Traffic Manager profile.** Anycast addressing is a classic-tier behavior. The practical effect is that POP selection is a DNS-resolution-time decision on Standard and Premium, while failover *between origins* remains an in-path decision that DNS caching does not delay.

| Capability | What it gives you |
|---------|---------|
| **TLS termination at the edge** | One certificate, managed and auto-renewed by Azure, instead of one per region |
| **Path and header routing** | `/api/*` to one origin group, `/static/*` to another |
| **WAF** | Managed rule sets and custom rules applied before traffic reaches an origin |
| **Caching** | Static content served from the edge |
| **Private Link to origins** | Origins with no public IP at all, Premium tier only |
| **Session affinity** | Repeat requests from a client pinned to one origin |

Origin selection combines latency, priority, and weight, with health probes deciding which origins are eligible. Front Door handles HTTP and HTTPS only; anything else needs Traffic Manager or the Global tier load balancer.

### Front Door Versus Traffic Manager

| Aspect | Traffic Manager | Front Door |
|--------|----------------|------------|
| **Works at** | DNS | HTTP and HTTPS |
| **Failover bound by** | DNS cache expiry at every resolver and client | In-path origin health, so no cache delay |
| **Routing granularity** | Endpoint | URL path, headers, query strings |
| **TLS** | Client terminates at the origin | Terminated at the edge |
| **WAF and caching** | Neither | Both |
| **Protocols** | Any | HTTP and HTTPS only |
| **Certificates** | One per region, yours to manage | One, Azure-managed |
| **Cost model** | Per DNS query and health check | Per GB processed and per request |

### Global Tier Load Balancer

The [Global tier of Azure Load Balancer](https://learn.microsoft.com/en-us/azure/load-balancer/cross-region-overview){:target="_blank" rel="noopener noreferrer"}, also called the cross-region load balancer, distributes TCP and UDP traffic across regional Standard load balancers behind one global IP address. It is the Layer 4 answer to the same problem Front Door solves at Layer 7: in-path failover with no DNS delay, for protocols that are not HTTP.

Reach for it when the workload is a database client, a message protocol, a game server, or anything else where Front Door does not apply and DNS-speed failover is not good enough.

---

## Multi-Region Data

Every data decision below comes down to the same two questions: where can writes happen, and what is lost when the write region disappears.

### Cosmos DB

[Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/distribute-data-globally){:target="_blank" rel="noopener noreferrer"} is the only major Azure data service designed for multi-region writes from the start, and it exposes the consistency trade-off as a setting rather than burying it.

**Single write region with multi-region reads.** Writes go to one region and replicate asynchronously; reads come from the nearest region. Service-managed failover can promote a read region if the write region fails.

**Multi-region writes.** Any region accepts writes, and conflicts are resolved by policy: **Last Write Wins** on a timestamp or a chosen numeric property (the default), a **custom merge procedure**, or **manual** resolution through a conflicts feed your application drains.

| Consistency level | Guarantee |
|-------|----------|
| **Strong** | Linearizable reads. Not available with multi-region writes |
| **Bounded staleness** | Reads lag writes by at most a configured interval or number of operations |
| **Session** | A client sees its own writes, monotonically |
| **Consistent prefix** | Reads never see writes out of order |
| **Eventual** | No ordering guarantee, converges over time |

Two constraints shape the design. **Strong consistency is incompatible with multi-region writes**, so an application that needs linearizability is a single-write-region application with read replicas. And **the default consistency level is a per-account setting that individual requests can only weaken, not strengthen**, so pick the account default as the strongest level any workload needs.

On cost, provisioned throughput is billed in every region the account spans, and enabling multi-region writes raises the rate. Treat adding a region as adding a full copy of both throughput and storage.

### Azure SQL Database

[Active geo-replication](https://learn.microsoft.com/en-us/azure/azure-sql/database/active-geo-replication-overview){:target="_blank" rel="noopener noreferrer"} creates up to **four readable secondaries** in other regions, replicating the transaction log asynchronously. Writes always go to one primary.

[Failover groups](https://learn.microsoft.com/en-us/azure/azure-sql/database/failover-group-sql-db){:target="_blank" rel="noopener noreferrer"} wrap that in a declarative layer: a named set of databases on a logical server that moves as a unit, with two DNS listeners that survive the move.

- **Read-write listener:** `<fog-name>.database.windows.net`, always the current primary
- **Read-only listener:** `<fog-name>.secondary.database.windows.net`, the current secondary

Both listener records have a **30-second TTL**, so a client that caches DNS keeps talking to the old primary for up to that long after a failover.

**The two operations are not the same, and the difference is your RPO:**

| Operation | Requires | Data loss |
|---|---|---|
| **Failover** (planned) | The primary to be reachable; fully synchronizes first | **None** |
| **Forced failover** | Nothing; promotes the secondary immediately | **Possible** |

**The two failover policies are also not what their names suggest.** `manual` is the *customer-managed* policy and is the one Microsoft recommends. `automatic` is the *Microsoft-managed* policy, and it means Microsoft decides, for **every** failover group in the region set to that policy rather than for yours individually, and only after a grace period that **cannot be set below one hour**. The setting that controls that grace period is named `GracePeriodWithDataLossHours`, which is the clearest possible statement that the resulting failover is a forced one.

Five details that surprise people in production:

- **Secondaries created by a failover group do not inherit zone redundancy** on non-Hyperscale tiers. You enable it on them afterward. Hyperscale secondaries do inherit it.
- **Read-only listener failover is disabled by default**, so read-only sessions cannot connect until the secondary recovers.
- **The number of databases in a group drives failover duration**, because planned failover prepares them in batches. Smaller groups fail over faster and more predictably.
- **Initial seeding runs at up to about 500 GB per hour**, which is what makes adding a large database to a group a scheduled operation rather than a quick one.
- **Failover groups perform better between paired regions.** If your primary and secondary are not a pair, set different maintenance windows on each so Azure does not update them together.

### Geo-Redundant Storage

| Option | Primary | Secondary | Readable secondary |
|--------|-------|--------------------|---|
| **LRS** | Three copies in one datacenter | None | n/a |
| **ZRS** | Three copies across three zones | None | n/a |
| **GRS** | LRS | LRS in the secondary region | No |
| **GZRS** | ZRS | LRS in the secondary region | No |
| **RA-GRS / RA-GZRS** | As above | As above | Yes, at `<account>-secondary.<service>.core.windows.net` |

Replication to the secondary is asynchronous, so there is always a window of writes that exist only in the primary. **Last Sync Time** is the property that tells you how wide that window currently is, and designing your application to log writes and compare against it is what turns "we might lose some data" into a number.

### Storage Failover Has Three Modes, and They Are Not Interchangeable

| Type | Data loss | Original primary | Resulting redundancy |
|---|---|---|---|
| **Customer-managed planned** | None expected | Becomes the new secondary | Converted to GRS; geo-redundancy **retained** |
| **Customer-managed unplanned** | Expected | Its copy is **deleted** | Converted to **LRS**; geo-redundancy **lost** |
| **Microsoft-managed** | Expected | Whole region scope | Not customer-invocable |

The line that matters is the second row. An unplanned failover leaves you on a **locally redundant** account in the new primary, with the old region's data gone. Re-enabling geo-redundancy is a separate action that costs a full re-replication, and any archived blobs must be rehydrated to an online tier before you can even do it.

Planned failover exists precisely so you can rehearse this without those consequences, and it is the mechanism for a DR drill. Microsoft's own guidance is explicit that you should **not** rely on Microsoft-managed failover as your DR plan; it is region-wide, reserved for extreme circumstances, and cannot be triggered for your account.

Four more things that do not fail over with the data:

- **The storage resource provider.** Management operations still target the original primary region, and the account's `Location` property keeps returning it. If the original region is down, you cannot manage the account.
- **Virtual machines.** VMs must be recreated in the new region.
- **Several features are unsupported entirely**: Azure File Sync, premium block blobs, NFSv3, and either side of an object replication policy. Change feed, object replication, and point-in-time restore are unsupported for *planned* failover specifically.
- **Point-in-time restore resets.** After a failover you can only restore block blobs to a point no earlier than the failover completion time.

A customer-managed failover typically completes in under an hour, though that is not a guarantee.

---

## Active-Active and Active-Passive

The two patterns differ in exactly one structural place: where a write goes.

```
   ACTIVE-PASSIVE                          ACTIVE-ACTIVE

   ┌──────────────┐                        ┌──────────────┐
   │ Front Door   │  priority routing      │ Front Door   │  latency or
   └──┬────────┬──┘                        └──┬────────┬──┘  weighted routing
      │        ╎ (standby)                    │        │
      ▼        ╎                              ▼        ▼
  ┌────────┐  ┌────────┐                 ┌────────┐ ┌────────┐
  │ East US│  │ West US│                 │ East US│ │ West US│
  │  app   │  │  app   │                 │  app   │ │  app   │
  └───┬────┘  └───┬────┘                 └───┬────┘ └───┬────┘
      │           │ reads only               │          │
      ▼           ▼                          ▼          ▼
  ┌────────┐──▶┌────────┐              ┌──────────────────────┐
  │primary │   │geo-    │              │  Cosmos DB, multi-   │
  │  DB    │   │secondary│             │  region write, with  │
  └────────┘   └────────┘              │  conflict resolution │
                                        └──────────────────────┘
   ONE write region. Failover is a       EVERY region takes writes.
   promotion, with an RPO equal to       No promotion needed, but
   replication lag at that moment.       conflicts are now yours.
```

**Active-passive** is cheaper and simpler, and its RTO is however long it takes to scale up compute and promote the database. Its RPO is the replication lag at the moment of failure, which is why Last Sync Time and geo-replication lag are the metrics to alert on.

**Active-active** removes the promotion step but only if the data tier genuinely accepts writes everywhere. Putting a multi-region-write database behind two active app tiers works; putting a single-primary SQL database behind them means one region's writes cross the region boundary on every request, which is worse than active-passive on both latency and blast radius.

A common and honest middle position is **active-active for reads, single-region for writes**: both regions serve traffic, read queries go to the local replica, and writes route to whichever region currently holds the primary. It gets most of the latency benefit and keeps one authoritative write path.

Whatever you choose, the compute side is only half of it. Session state has to live somewhere both regions can reach, distributed transactions across regions are impractical at these latencies, and any background job that assumes it is a singleton needs a lease that works across regions.

---

## Stateful Service Strategies

| Service | Multi-region approach |
|---------|----------------------|
| **Azure SQL Database** | Active geo-replication with a failover group; one write region |
| **Cosmos DB** | Multi-region reads, or multi-region writes with a conflict policy |
| **PostgreSQL / MySQL flexible server** | Read replica in the secondary region, promoted manually |
| **Azure Managed Redis / Cache for Redis** | Active geo-replication linking caches; note that Azure Cache for Redis is superseded by Azure Managed Redis, so new designs should target the latter |
| **Event Hubs** | Geo-disaster recovery replicates metadata, not event data; failover is an alias switch |
| **Service Bus** | Geo-disaster recovery on Premium; again metadata, not messages in flight |
| **Azure Files** | GRS or GZRS, but note Azure File Sync does not support account failover |
| **Blob Storage** | GRS, GZRS, RA-GRS, or RA-GZRS depending on whether you need reads from the secondary |

The messaging row deserves emphasis because it is routinely misread. Event Hubs and Service Bus geo-disaster recovery replicate **entity metadata**, not the messages sitting in the queue. After failover you have the same topics, subscriptions, and rules in the secondary namespace, and none of the undelivered messages. If message durability across a regional loss is a requirement, the answer is producer-side retry against a second namespace, not the built-in geo-DR feature.

---

## DNS and Certificates

**Traffic Manager** takes a CNAME from your custom domain to `<profile>.trafficmanager.net`. Because clients connect to regional endpoints directly, every region needs a valid certificate for the name the client used, typically a wildcard or SAN certificate deployed and renewed by automation in each region.

**Front Door** takes a CNAME to `<profile>.azurefd.net`, and terminates TLS at the edge with an Azure-managed certificate it renews for you, or one you supply from Key Vault. This is the larger operational difference between the two services and it is usually understated: Front Door removes per-region certificate management entirely.

Azure DNS alias records can point at either service directly, which lets you use an apex domain without a CNAME.

On TTLs: set them low, and do not treat that as a failover mechanism. Some resolvers and clients cache past the TTL, and a design whose RTO depends on universal TTL compliance has an RTO nobody can state.

---

## Cross-Region Networking

**Global VNet peering** connects VNets in different regions over the Azure backbone with no gateway and no bandwidth cap beyond what the VM SKUs allow. It charges data transfer **in both directions**, which is unusual, because most Azure networking charges egress only.

**Front Door with Private Link** (Premium tier) lets origins have no public IP at all. Front Door reaches them through Private Link, so the only public surface is Front Door itself. Connections must be approved on the origin side, and this works across regions without any VNet peering.

**Virtual WAN** gives you a global mesh of regional hubs with automatic hub-to-hub routing, so you are not maintaining a matrix of peerings and route tables. Each hub can carry its own VPN gateway, ExpressRoute gateway, and Azure Firewall. This is the right shape once you have more than two regions and any branch or on-premises connectivity; below that it is more machinery than the problem needs.

For ExpressRoute in a multi-region design, note that Microsoft's current vocabulary for the highest-resilience configuration is **two circuits at two different peering locations**, and that no per-configuration availability percentage is published on Learn. State the topology, not a number.

---

## Data Residency and Compliance

Regulatory boundaries usually map to Azure **geographies** rather than regions, but two details break the simple version of that mapping:

- **Pairing does not guarantee same-geography replication.** Brazil South's pair is South Central US. Check the specific regions rather than trusting the concept.
- **Not every region carries every certification**, and not every service is available in every region. Both have to be true for your design to be compliant, so check the region list and the service-availability list together.

The enforceable control is Azure Policy denying resource creation outside approved regions, applied at management group scope. Reviewing the portal afterward is not a control.

---

## Cost

Multi-region roughly doubles the obvious costs and adds several that are less obvious.

| Category | Effect |
|---------|-------------|
| **Compute** | Full duplication for active-active; a scaled-down standby for active-passive |
| **Storage redundancy** | GRS and GZRS cost more than LRS because the data exists twice; RA variants add secondary read transactions |
| **Database replicas** | A geo-secondary is a full-price replica. Cosmos throughput is billed per region |
| **Cross-region transfer** | Egress charges on replication traffic and any cross-region call; global VNet peering charges both directions |
| **Telemetry** | Log volume scales with regions, and cross-region ingestion is itself transfer |

Two reduction levers do most of the work. **Keep the request path inside one region**, so cross-region traffic is replication and failover only, not normal operation. And **cache at Front Door**, which cuts both origin compute and origin egress at once.

On commitments: reservations and savings plans still apply, but a **VM reservation has instance size flexibility and no region flexibility**. A commitment bought for the primary region does not follow the workload when it fails over, so a multi-region design has to buy per region or accept paying on demand in the secondary. Spot VMs have a related trap: the default eviction policy is **Deallocate**, which keeps consuming quota and paying for disk storage on instances that are no longer running.

---

## Testing Failover

An untested failover plan is a hypothesis. The mechanisms Azure gives you to test one for real:

- **Storage customer-managed planned failover**, which swaps primary and secondary with no expected data loss and no loss of geo-redundancy. This is the designed-for-drills path.
- **SQL failover group planned failover**, which fully synchronizes before switching, so it is also non-destructive.
- **Front Door and Traffic Manager endpoint disabling**, which lets you take a region out of rotation without touching the region itself.

Run the drill end to end rather than per component. The failure people find is never the database promotion; it is a firewall rule, a private DNS zone, or a managed identity that only exists in the primary region and was never exercised.

**Health checks are part of the design, not an afterthought.** Point probes at an endpoint that actually exercises the region's dependencies, so a region whose database is unreachable is marked unhealthy rather than serving errors with a 200. If you build availability tests in Application Insights for this, they must be **standard tests**, because classic URL ping tests retire on **30 September 2026**.

**Failback needs a plan of its own.** After a Microsoft-managed SQL failover, failback is manual. After an unplanned storage failover, you are on an LRS account and re-enabling geo-redundancy is a paid re-replication. Neither is automatic, and both are easier to think about before the incident.

---

## Common Pitfalls

### Pitfall 1: Treating a Region Pair as a Resilience Feature

**Problem:** Deploying to two paired regions and assuming Azure provides failover between them.

**Result:** Nothing fails over. Pairing gives recovery ordering, staggered updates, and usually same-geography residency, and Microsoft states plainly that it provides no automatic HA, DR, or failover.

**Solution:** Build the failover yourself. Then choose the secondary region on latency, service availability, and residency grounds. A nonpaired region is a legitimate choice, and many services replicate between arbitrary regions.

---

### Pitfall 2: Assuming Automatic SQL Failover Means No Data Loss

**Problem:** Setting the failover policy to `automatic` and treating the result as a zero-RPO design.

**Result:** `automatic` is the *Microsoft-managed* policy. It triggers a **forced** failover, which is asynchronous and can lose data, for every group in the region on that policy, no sooner than a grace period that cannot go below an hour.

**Solution:** Use the customer-managed (`manual`) policy, which Microsoft recommends, and decide when to fail over yourself. Reserve planned Failover for drills and failback, because only it guarantees no data loss.

---

### Pitfall 3: Unplanned Storage Failover as a Routine Action

**Problem:** Using customer-managed unplanned failover to move an account, or as a first response.

**Result:** The account becomes LRS, geo-redundancy is lost, the original region's copy is deleted, point-in-time restore resets, and re-enabling GRS costs a full re-replication with archived blobs rehydrated first.

**Solution:** Use planned failover for drills and for non-storage outages. Reserve unplanned failover for a genuinely unavailable primary, check Last Sync Time first to size the loss, and never use either as a migration mechanism.

---

### Pitfall 4: Depending on DNS TTL for RTO

**Problem:** Setting a 30-second TTL on a Traffic Manager profile and quoting a 30-second RTO.

**Result:** Resolvers and clients cache past TTL, some connection pools never re-resolve at all, and observed failover runs far longer than the number in the design document.

**Solution:** If the RTO is tight, use an in-path service (Front Door for HTTP, the Global tier load balancer for everything else) so failover does not depend on anyone else's cache. If you must use DNS routing, state the RTO as a range and validate it with real clients.

---

### Pitfall 5: Active-Active Over a Single-Write Data Tier

**Problem:** Running both regions active in front of a single-primary SQL database.

**Result:** Half the traffic pays a cross-region round trip on every write, throughput is bounded by the link, and a primary-region failure still requires a promotion. It has the cost of active-active and the RTO of active-passive.

**Solution:** Either move to a data store that accepts writes in every region and own the conflict resolution, or keep writes in one region and make the secondary read-active. Do not describe the second as active-active.

---

### Pitfall 6: Expecting Messaging Geo-DR to Carry Messages

**Problem:** Enabling Service Bus or Event Hubs geo-disaster recovery and assuming queued messages survive a regional failover.

**Result:** Geo-DR replicates entity metadata. The secondary namespace comes up with the right topology and none of the undelivered messages.

**Solution:** If messages must survive, make producers durable by retrying against a second namespace, or by persisting to a geo-redundant store before enqueueing. Treat geo-DR as topology recovery, not message recovery.

---

### Pitfall 7: Private Endpoints and DNS That Only Exist in One Region

**Problem:** A secondary region built from the same templates, but with private DNS zone links, private endpoints, and firewall rules only ever configured and tested in the primary.

**Result:** Failover completes, the database is up, and the application cannot resolve or reach it. This is the single most common way a rehearsed failover fails on its first real use.

**Solution:** Deploy the network layer from the same infrastructure-as-code as the primary, link private DNS zones in both regions, and make the drill exercise the actual data path rather than just checking that the replica was promoted.

---

## Key Takeaways

1. **Region pairing is a much smaller guarantee than it looks.** It gives recovery ordering, staggered updates, and usually same-geography residency. It gives no automatic resilience, and many regions have no pair at all.

2. **Pairing is not always reciprocal or same-geography.** Brazil South pairs to South Central US. Verify residency per region rather than deriving it from the concept.

3. **Zones first, then regions.** Zone redundancy is synchronous, cheap, and usually a config flag. Cross-region replication is asynchronous, which is where your RPO comes from.

4. **Pick the routing service by layer and by failover mechanism.** Front Door for HTTP with edge TLS, WAF, and caching; the Global tier load balancer for TCP and UDP with in-path failover; Traffic Manager for anything else, accepting DNS-cache delay.

5. **Front Door Standard and Premium select POPs by unicast through an internal Traffic Manager profile.** Anycast is classic-tier behavior.

6. **SQL failover policy `automatic` means Microsoft-managed, region-wide, and forced.** The grace period cannot go below an hour and the setting is named `GracePeriodWithDataLossHours`. Customer-managed is the recommended policy.

7. **Failover-group secondaries do not inherit zone redundancy** outside Hyperscale, and the read-only listener does not fail over by default.

8. **Unplanned storage failover converts the account to LRS and deletes the original primary's copy.** Planned failover is the one built for drills and keeps geo-redundancy.

9. **Strong consistency and multi-region writes are mutually exclusive in Cosmos DB.** Choose the account's default consistency as the strongest any workload needs, because requests can only weaken it.

10. **Service Bus and Event Hubs geo-DR replicates metadata, not messages.** Message durability across regions is a producer-side design problem.
