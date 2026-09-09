---
title: "Azure Migration Strategy"
layout: guide
category: Azure
subcategory: Migration & Hybrid Cloud
description: "The Cloud Adoption Framework's seven phases, the eight migration strategies and how to pick one per workload, business case construction with Azure Migrate, wave planning, and the governance that has to exist before the first workload moves."
tags: [caf, azure-migrate, landing-zones, workload-assessment, business-case, governance, practical]
---

## What Cloud Migration on Azure Involves

Cloud migration moves applications, data, and infrastructure from on-premises, another cloud, or legacy systems into Azure. The [Microsoft Cloud Adoption Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/){:target="_blank" rel="noopener noreferrer"} (CAF) is Microsoft's methodology for it, and its central argument is that rehosting servers is the easy part. Aligning migration with business outcomes, building organizational capability, and establishing governance before workloads land is where migrations succeed or fail.

### What a deliberate strategy prevents

**Without one:**
- Costs spiral as workloads move inefficiently, then run inefficiently
- Teams hold different definitions of what success means
- Security, compliance, and governance gaps surface mid-migration, when remediation is most expensive
- Skills gaps leave teams unable to operate what they migrated
- Individual teams make isolated decisions, producing duplicate infrastructure and inconsistent governance
- Business value stays unclear, so the program loses sponsorship

**With one:**
- A business case quantifies return and aligns stakeholders before spending begins
- Assessment discovers dependencies, licensing exposure, and which workloads should not move at all
- Landing zones, policies, and operational processes exist before the first cutover
- Cost discipline is a control, not a quarterly surprise
- Governance is designed in rather than retrofitted

### How Azure migration differs from AWS

| Aspect | AWS | Azure |
|---|---|---|
| **Framework** | AWS Cloud Adoption Framework, with the Migration Acceleration Program (MAP) funding execution | Cloud Adoption Framework, treating business alignment, skills, and governance as first-class alongside technical migration |
| **Landing zones** | Control Tower automates account structure and baseline guardrails | Azure landing zones ship an opinionated architecture with RBAC and Azure Policy enforcement from day one |
| **Assessment tooling** | Application Discovery Service and Migration Hub | Azure Migrate, which is free and includes a business case generator |
| **Cost management** | Cost Explorer and Trusted Advisor for visibility | Cost Management plus Azure Policy, which can block noncompliant spend rather than only report it |
| **Governance approach** | Service Control Policies at the organization level | Azure Policy assigned at management group scope, with deployment and modification effects, not just deny |
| **Managing what stays behind** | Outposts extends AWS hardware into the data center | Azure Arc projects on-premises and other-cloud resources into Azure's control plane for governance and monitoring |

The governance difference is the one that changes migration sequencing. Azure Policy can deploy and remediate, not just permit and deny, so a landing zone can correct drift rather than only reporting it. That makes landing-zone-first sequencing more valuable on Azure than the equivalent effort on AWS.

---

## The Cloud Adoption Framework

CAF organizes adoption into seven phases. The first four run in sequence. The last three are operational and run continuously once workloads are live, not as a final step.

```
   ADOPTION PHASES (sequential)

   1. Strategy  -->  2. Plan  -->  3. Ready  -->  4. Adopt
   why Azure?        how will      build the      migrate,
                     we prepare?   landing zone   modernize, build
                                                       |
                                                       v
   OPERATIONAL PHASES (continuous, all three from here on)

   +----------------+----------------+----------------+
   |   5. Govern    |   6. Secure    |   7. Manage    |
   |   control the  |   protect the  |   operate and  |
   |   environment  |   environment  |   optimize     |
   +----------------+----------------+----------------+
```

| Phase | The decision it answers |
|---|---|
| **1. Strategy** | What should our Azure adoption look like? |
| **2. Plan** | How will we prepare for Azure adoption? |
| **3. Ready** | How will we build our Azure landing zone? |
| **4. Adopt** | How will we migrate, modernize, and build workloads? |
| **5. Govern** | How will we control our Azure environment? |
| **6. Secure** | How will we protect our Azure environment? |
| **7. Manage** | How will we operate and optimize Azure over time? |

Older material describes CAF as six phases with Migrate and Innovate as separate stages and Govern and Manage combined. Migrate and Innovate are now both inside **Adopt**, Govern and Manage are separate phases, and **Secure** was promoted to a phase of its own. Anyone working from a six-phase plan is missing Secure entirely.

The phases are not strictly waterfall in practice. Organizations commonly run different workload cohorts through different phases concurrently, and a rehost-only program may do very little in Adopt beyond migration.

---

## Phase 1: Strategy

**Purpose:** Establish business outcomes, financial justification, and sponsorship before technical work begins.

### Defining outcomes

Outcomes drive every downstream decision about prioritization, target services, and how much modernization to attempt.

| Outcome | Example business goal |
|---|---|
| **Cost reduction** | Reduce infrastructure spend by a defined percentage by eliminating owned data center capacity |
| **Business agility** | Cut time-to-market for new features from six months to three by provisioning on demand |
| **Operational efficiency** | Shift management overhead to managed services, reallocating infrastructure staff to product work |
| **Risk reduction** | Meet SOC 2, HIPAA, or PCI-DSS obligations using Azure's compliance controls rather than building equivalents |
| **Performance and innovation** | Access analytics, AI, and geographically distributed infrastructure the data center cannot provide |

An outcome that survives contact with a steering committee has four properties: it is quantified, it names the stakeholder with P&L responsibility, it has a date, and it has a measured baseline. "Save money" fails all four.

### Building the business case

The business case quantifies return and justifies spending on migration execution, skills, and post-migration optimization.

| Component | What it captures |
|---|---|
| **Current state costs** | On-premises total cost of ownership: hardware, licenses, facilities, people, maintenance |
| **Azure costs** | Projected compute, storage, networking, licensing, and managed services |
| **Migration costs** | One-time: tooling, professional services, training, cutover downtime |
| **Productivity gains** | Operational hours saved at loaded cost, and revenue impact from faster delivery |
| **Risk reduction** | Cost to remediate compliance gaps against cost to comply, plus disaster recovery capability gained |
| **Break-even** | When cumulative savings exceed migration and run costs |

Build this in **Azure Migrate's business case feature** rather than by hand. It computes on-premises against Azure total cost of ownership from discovered inventory, produces year-over-year cash flow, applies Azure Hybrid Benefit and reservation discounts, flags end-of-support Windows and SQL Server versions as migration accelerators, and identifies quick wins. A business case built from actual discovered utilization survives scrutiny that a spreadsheet of list prices does not.

The standalone **Azure TCO Calculator has been superseded** by this feature. Older runbooks still point at it.

Two exposures belong in the business case explicitly, because they change the answer more than compute rates do:

- **Azure Hybrid Benefit** applies existing Windows Server and SQL Server licenses with active Software Assurance or qualifying subscriptions against Azure compute, cutting up to 80% for Windows Server and up to 85% for SQL Server. A business case priced without it substantially overstates Azure cost.
- **End-of-support versions.** Workloads on out-of-support Windows Server or SQL Server carry either extended security update costs on-premises or a free equivalent in Azure, which frequently makes them the strongest business case in the portfolio.

### Organizational alignment

| Role | Responsibility |
|---|---|
| **Executive sponsor** | Owns business outcomes, authorizes budget, resolves cross-functional conflict |
| **Cloud strategy leader** | Develops the business case, defines outcomes, drives organizational change |
| **Cloud architect** | Owns technical vision and landing zone design |
| **Workload owner** | Supplies business requirements and success criteria, decides the migration strategy for their workload |
| **Operations leader** | Plans operational readiness and the post-migration support model |

---

## Phase 2: Plan

**Purpose:** Assess workloads, choose a migration strategy for each, and build the migration inventory.

### Workload assessment

Assessment answers what you have, what it depends on, and what it will cost. [Azure Migrate](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview){:target="_blank" rel="noopener noreferrer"} automates discovery and dependency mapping.

Discovery runs three ways, and the choice depends on your network:

- **The Azure Migrate appliance** is the recommended path. A lightweight virtual appliance deployed in the data center collects configuration and performance data continuously and streams it to the service.
- **Azure Migrate Collector** takes a point-in-time snapshot without requiring continuous Azure connectivity, which is what air-gapped and restricted networks need.
- **Import** loads inventory data directly when you already have a CMDB or equivalent.

Assessment then produces:

- **Azure readiness**, flagging servers, SQL instances, and web apps that cannot migrate as-is
- **Right-sizing**, estimating VM sizes, Azure SQL configurations, and Azure VMware Solution node counts
- **Cost estimation** for running the discovered inventory in Azure
- **Dependency analysis**, mapping network connections between servers so migration groups are complete

Dependency analysis is the step teams skip and regret. A workload migrated without a dependency it did not know about fails at cutover, not in testing.

### The eight migration strategies

CAF names eight strategies, commonly called the "Rs." Older material lists five and omits Retire, Retain, and Replatform, which are three of the most useful.

| Strategy | Business driver | Effort | Risk |
|---|---|---|---|
| **Retire** | Decommission redundant or low-value workloads | None | Low |
| **Retain** | Workload is stable and compliant with no near-term driver to move | None | Low |
| **Rehost** | Minimal disruption, no modernization in the near future | Low | Low |
| **Replatform** | PaaS with minimal code changes, to offload maintenance and improve reliability | Low-medium | Medium |
| **Refactor** | Code changes to cut technical debt or optimize for cloud | Medium | Medium |
| **Rearchitect** | Architecture changes to unlock cloud-native capabilities | High | High |
| **Replace** | A SaaS product simplifies operations enough to drop the custom system | Medium | Low |
| **Rebuild** | A new cloud-native solution is the only way to meet requirements | Very high | Very high |

CAF publishes a business driver and key indicators for each strategy but no effort or risk scale, so treat those two columns as relative ordering to sequence against, not as ratings you can cite.

Two of these often get collapsed together, and CAF separates them deliberately. **Replatform** moves a workload to a modern hosting environment with minimal code changes, such as SQL Server on a VM becoming Azure SQL Database, or a VM-hosted app becoming an App Service. **Refactor** changes the code itself to reduce maintenance cost or adopt Azure SDKs and cloud design patterns, without changing the architecture. A guide that calls the first one "refactoring" is describing replatforming.

**Applying the strategies:**

- **Start with Retire.** Every workload decommissioned before migration is one you never pay to move, run, secure, or govern. This is the cheapest win available and it happens only if someone asks the question early.
- **Rehost when the workload will stay unchanged for at least two years.** That is CAF's explicit test. If modernization is likely sooner, replatform or rearchitect instead, because rehosting first means paying for the migration twice.
- **Do not rehost a problematic workload.** Rehosting carries performance, reliability, and architectural problems into Azure unchanged, and it makes them harder to diagnose. Modernize during migration or leave it where it is.
- **Use rehosting to build operational muscle.** Early rehosts give teams Azure operations, governance, and cost management experience before anything harder arrives.
- **Some workloads should be rebuilt rather than migrated.** Infrastructure services like DHCP servers and Active Directory domain controllers are cheaper and safer to stand up new in Azure than to replicate.
- **Retain what cannot move**, and manage it from Azure with Azure Arc rather than leaving it outside the governance perimeter.

Microsoft publishes no target percentage for how much of a portfolio should be rehosted. Set the mix from your own assessment rather than from a rule of thumb.

### Deciding whether to modernize during migration

Modernizing while migrating captures value earlier and avoids a second project. It also adds risk to a timeline that already has one. CAF's test is three questions:

1. **Does the team have the skills and the time?** Without both, modernization delays migration and produces something nobody can operate.
2. **Does the workload require compatibility changes anyway?** Unsupported SDKs, dead frameworks, or a SaaS transition force the work regardless, so doing it during migration costs less than doing it twice.
3. **Does migration unlock funding and attention that will not exist later?** Migration programs attract sponsorship and budget. Modernization deferred to "after migration" frequently never gets funded.

### Prioritization

| Criterion | The question |
|---|---|
| **Business value** | Does moving this unblock a strategic initiative or cut meaningful cost? |
| **Dependencies** | What must move with it, and what must move first? |
| **Licensing** | Does Azure Hybrid Benefit or a PaaS target change the licensing bill materially? |
| **Operational maturity** | Does the team running it have Azure skills, or does this workload also require training? |
| **Data residency** | Do regulatory constraints limit which regions it can land in? |
| **Complexity** | How many integration points, custom components, and undocumented behaviors are involved? |

CAF's prioritization matrix crosses business value against effort:

| Priority | Value | Effort | Treatment |
|---|---|---|---|
| **High** | High | Low | Quick wins, migrate first |
| **Medium-high** | High | High | Strategic investments, plan carefully with adequate resources |
| **Medium-low** | Low | Low | Easy candidates, use to fill gaps between major migrations |
| **Low** | Low | High | Defer or avoid, and reconsider whether Retire applies |

### Skills roadmap

**Common gaps:**
- Infrastructure-as-code and policy-as-code
- Containers and orchestration
- Cloud cost management and optimization
- Cloud-native security, least privilege, and zero trust
- Observability in a cloud environment

**Closing them:** Microsoft Learn provides free role-based paths, certifications validate the result, and designated cloud champions inside each team spread knowledge faster than centralized training does. Assess skills during Plan, not when a cutover stalls.

---

## Phase 3: Ready

**Purpose:** Build the landing zone, governance, and operational readiness before any workload arrives.

### Landing zone design

A [landing zone](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/){:target="_blank" rel="noopener noreferrer"} is a preconfigured Azure environment supplying security boundaries, governance, network topology, and an operational baseline, so workload teams do not each rebuild foundations differently.

**What it provides:**
- **Subscription strategy**, organizing by workload, environment, or business unit under a management group hierarchy
- **Network topology**, typically hub-and-spoke with centralized firewall and gateways
- **Identity and access**, with RBAC role assignments and Microsoft Entra ID integration
- **Governance**, through Azure Policy enforcing naming, allowed resources, and compliance controls
- **Cost management**, with budgets, alerts, and a chargeback model
- **Monitoring**, with Log Analytics, diagnostic settings, and centralized collection

Deploying this before migration is the single highest-leverage sequencing decision in the program. Retrofitting a management group hierarchy, network topology, or tagging standard onto workloads already running means touching every one of them again.

### Governance policies

| Policy | Purpose | Example |
|---|---|---|
| **Resource naming** | Consistent identification and automation | Production VMs follow `prod-{region}-{app}-{instance}` |
| **Allowed resources** | Restrict to approved services, SKUs, and regions | Deny resource types and regions outside the approved set |
| **Tagging** | Cost allocation and ownership | Require Environment, Owner, and CostCenter on all resources |
| **Network isolation** | Segmentation and exposure control | Subnets require NSGs, public IPs only where approved |
| **Encryption** | Protect data at rest and in transit | Storage encryption required, minimum TLS version enforced |
| **Backup and recovery** | Enforce protection and retention | Databases require backups meeting a defined retention |

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} enforces these, and it does more than permit and deny. Its effects include `deployIfNotExists` and `modify`, which deploy missing configuration or correct resource properties automatically, and `denyAction`, which blocks deletion. That is what makes landing-zone governance self-correcting rather than merely reported.

Assign policies at management group scope so they apply to subscriptions created later. Two mechanics matter during a migration:

- **`enforcementMode: DoNotEnforce`** is the dry run for a deny policy. It evaluates and reports what would have been blocked without blocking it, which is how you introduce a restrictive policy into a live migration without stopping it.
- **Layering is cumulative and most-restrictive**, with no priority ranking between assignments. A permissive assignment at a lower scope does not override a deny at a higher one.

### Operational readiness

Decide these before cutover, not after the first incident:

- **Monitoring and alerting.** Which metrics matter, what thresholds fire, who responds
- **Incident response.** Escalation path and triage ownership
- **Change management.** How configuration changes get approved and deployed
- **Cost review.** Who reviews spend, on what cadence, and what triggers investigation
- **Security operations.** How alerts get investigated and the response time commitment
- **Backup and recovery.** RTO and RPO targets defined, and recovery procedures actually tested

---

## Phase 4: Adopt

**Purpose:** Migrate, modernize, and build workloads in the prepared environment.

CAF breaks migration execution into five steps per wave.

| Step | What happens |
|---|---|
| **1. Plan migration** | Sequence workloads, choose data paths, define rollback criteria, get stakeholder approval |
| **2. Prepare workloads** | Remediate blockers found in assessment, size targets, stage replication |
| **3. Execute migration** | Replicate, test in a non-production failover, then cut over |
| **4. Optimize in cloud** | Right-size against actual post-migration utilization, apply reservations |
| **5. Decommission source** | Retire on-premises capacity, which is where the business case is finally realized |

Step 5 is the one that gets deferred indefinitely. Until source infrastructure is decommissioned, the organization pays for both environments and the projected savings do not exist.

### Choosing the data path

How data moves is constrained by the network you have. Decide this before wave planning, because it sets how long each wave takes.

| Path | When to use | Trade-off |
|---|---|---|
| **ExpressRoute** | Any workload, when you already have it | Fastest and most secure, but requires setup lead time and carries transfer cost |
| **VPN** | Secure transfer without ExpressRoute | Encrypted over the internet, slower, needs a VPN Gateway in place first |
| **Azure Data Box** | Large offline data sets | Bypasses the network entirely, but shipping time makes it the slowest path |
| **Public internet** | Non-sensitive data with no other option | Available everywhere, least secure, consumes your bandwidth |

### Migration waves

Waves distribute risk and let lessons from early migrations improve later ones.

| Wave | Composition | Purpose |
|---|---|---|
| **Wave 0** | One or two non-critical workloads | Prove the tooling, process, and team capability |
| **Wave 1** | Five to ten quick wins with minimal dependencies | Build momentum and refine the runbook |
| **Wave 2** | The bulk of the portfolio | Execute at scale using templates from Wave 1 |
| **Wave 3** | Complex, business-critical systems | Migrate with proven process and the most safeguards |

Three sequencing rules shape wave contents:

- **Move non-production before production.** Development, staging, and QA environments let teams rehearse the full process, validate performance, and train operations without user impact.
- **Group by dependency, not by convenience.** Direct dependencies requiring low latency move together. Indirect dependencies can split across waves if the connection tolerates latency. When you are unsure how critical a dependency is, keep the components together, since splitting later is easier than recovering from a broken cutover.
- **Put one or two representative complex workloads in early waves.** Waves composed entirely of easy workloads teach you nothing about the hard ones, and the program then discovers its hardest problems in Wave 3, when there is no schedule left to absorb them.

### Split-environment operation

Some components cannot move, whether for regulatory, technical, or contractual reasons. Document why, what they connect to, and what data they share, then minimize the time a workload runs across both environments. API gateways, message queues, and data synchronization are the integration mechanisms that make the split period survivable. Where a workload would run split for a long time, delaying its migration until more components can move together is usually cheaper than operating the seam.

### Choosing a cutover method

| Method | Fits | Trade-off |
|---|---|---|
| **Downtime migration** | Non-critical workloads, dev and test, anything with a maintenance window | Simpler and faster, requires a planned outage |
| **Near-zero downtime** | Customer-facing systems, real-time transactions, strict SLAs | Continuous replication and cutover, more setup and more testing |

### Rollback planning

Rollback is the antipattern most programs discover they have only in theory. A usable plan has five parts:

1. **A definition of failure agreed in advance.** Specific triggers such as error rate, response time, or failed health checks, decided with business stakeholders rather than argued about during an incident.
2. **Automated rollback in the deployment pipeline** where the workload supports it, so reverting does not depend on someone finding a runbook.
3. **Workload-specific procedures.** Reapplying prior infrastructure-as-code templates, redeploying a previous container image, and restoring data are different operations with different recovery times.
4. **Tested procedures.** Simulate the failure in staging and confirm the rollback restores a known-good state. An untested rollback plan is a document, not a capability.
5. **Defined rollback authority.** Who can call it, and through what communication channel, at three in the morning.

Keep source infrastructure operational until rollback criteria have expired, then decommission it deliberately.

### Modernization targets

Once workloads are running, modernization moves them off the patterns that make cloud expensive.

| Pattern | Before | After |
|---|---|---|
| **Managed databases** | SQL Server on a VM | Azure SQL Database or SQL Managed Instance, patched by the platform |
| **Containers** | Application on VMs | AKS or Container Apps |
| **Serverless** | Always-on VMs serving intermittent load | Azure Functions, billed per execution |
| **Messaging** | Polling a database table | Service Bus or Event Grid |
| **Caching** | Every query reaching the database | Azure Managed Redis |
| **Content delivery** | Files served from one region | Azure Front Door |
| **Analytics** | Ad-hoc queries against production | A dedicated analytics platform, with Power BI for presentation |

Note that **Azure Managed Redis supersedes Azure Cache for Redis**, so a modernization plan targeting the older service should target the newer one.

Modernize where business impact justifies it, the team can operate the result, and the technical complexity is understood. Modernizing everything is a different failure from modernizing nothing.

---

## Phases 5-7: Govern, Secure, and Manage

These run continuously once workloads are live, in parallel with each other and with ongoing adoption.

### Govern

| Activity | Cadence | Owner |
|---|---|---|
| **Cost review** | Weekly or monthly | Finance and cloud operations |
| **Compliance audit** | Quarterly | Compliance and security |
| **Access review** | Semi-annually | Identity and access management |
| **Policy effectiveness** | Quarterly | Cloud governance council |
| **Disaster recovery test** | Semi-annually | Operations |

**Cost control** needs mechanisms rather than intentions: budgets and alerts scoped per subscription or cost center, chargeback or showback that puts spend in front of the team generating it, monthly review of top spenders, and commitment discounts applied once usage patterns are stable.

Commitment discounts carry a constraint that matters for multi-region designs. **Reservations cover compute only**, not licensing, storage, or networking, and VM reservations have instance size flexibility but **no region flexibility**. A reservation bought for the wrong region strands.

### Secure

Security is a distinct CAF phase because it is not a subset of governance, and treating it as one is how migrations arrive in production with policy compliance and no threat detection.

- **Access reviews.** Audit who has access to what, and revoke what is no longer needed
- **Threat detection.** Monitor for suspicious activity and investigate alerts, with defined response commitments
- **Patch management.** Apply updates to infrastructure and applications on a schedule
- **Vulnerability scanning.** Scan for misconfiguration, missing patches, and exposed credentials
- **Compliance validation.** Continuously audit against regulatory obligations rather than at audit time

### Manage

- **Right-sizing.** Post-migration utilization rarely matches the pre-migration estimate. Review and resize on a schedule
- **Performance.** Baseline application performance in Azure, then find and fix bottlenecks against that baseline
- **Cost anomalies.** Investigate deviations rather than absorbing them into the run rate
- **Continuous optimization.** New services and pricing models appear regularly, and yesterday's optimal architecture drifts

---

## Migration Antipatterns

**Lift and shift everything.** Rehosting the whole portfolio without assessment carries technical debt into Azure, leaves self-managed databases and always-on compute generating avoidable cost, and skips Retire entirely. Assess first and assign a strategy per workload.

**Skipping the business case.** Without quantified return, stakeholders hold different expectations, cost overruns surprise budget owners, and the program gets questioned mid-flight with no evidence to defend it. Build it in Azure Migrate from discovered inventory and update it quarterly against actuals.

**Landing zone as an afterthought.** Letting teams create their own subscriptions and networks produces inconsistent security, impossible cost allocation, and compliance gaps that get found during an audit. Deploy the landing zone first and require migrations to use it.

**Underestimating skills gaps.** Teams without cloud skills keep everything in VM-shaped patterns, so neither the cost nor the security benefits materialize. Assess skills during Plan and fund the roadmap.

**Ignoring cost during migration.** Overprovisioning, orphaned resources, and unnecessarily expensive SKUs accumulate quickly when cost is treated as a post-migration concern. Establish reviews and budgets from the first wave.

**No tested rollback.** Assuming migration is one-directional leaves no option when post-cutover problems appear. Define failure criteria, keep the source running until they expire, and test the rollback before you need it.

**Manual migration.** Doing planning and execution by hand is slower, more error-prone, and discards the dependency and utilization data that assessment tooling produces for free. Azure Migrate costs nothing to use.

**Never decommissioning.** Running both environments indefinitely means paying twice and realizing none of the projected savings. Decommissioning is a planned step with an owner and a date, not something that happens on its own.

---

## Organizational Readiness

### The operating model changes

| Dimension | On-premises | Azure |
|---|---|---|
| **Provisioning** | Weeks, through procurement and racking | Minutes, through API or template |
| **Scaling** | Manual capacity planning against a purchase cycle | Automatic against demand |
| **Cost model** | CapEx, with cost fixed at purchase | OpEx, with cost following usage daily |
| **Responsibility** | The team owns the whole stack | Shared, with the platform owned by Azure and the workload owned by the team |
| **Recovery** | A DR site or backup media | Geo-replication and point-in-time restore |
| **Change control** | Change advisory boards on a weekly cadence | Policy-as-code enforcing guardrails continuously |

The cost model change is the one that catches organizations. On-premises, cost is decided once at purchase and is invisible afterward. In Azure, an architecture decision made on a Tuesday shows up on the bill, which is why cost governance has to be an engineering practice rather than a finance report.

### Change management

- **Executive communication.** Leadership explains why the migration matters and what it means for people's roles, repeatedly
- **Training before contact.** Teams get hands-on time before they are responsible for migrated systems
- **Pilots.** Early adopters build confidence and produce internal advocates
- **Feedback channels.** Somewhere for teams to raise concerns without it counting against them
- **Recognition.** Milestones acknowledged and contributing teams named

---

## Tooling and Programs

### Azure Migrate

[Azure Migrate](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview){:target="_blank" rel="noopener noreferrer"} is the primary tool, and it is free. Paid costs come from partner tools and from the Azure resources you migrate into, not from the service.

It runs a journey of **Decide, Plan, Execute**:

- **Decide:** discovery through the appliance, Collector, or import, then a business case
- **Plan:** readiness, right-sizing, cost estimation, and dependency analysis
- **Execute:** replication and cutover for servers, databases, web apps, and virtual desktops

**What it migrates:** VMware VMs (agentless or agent-based), Hyper-V VMs, physical servers, **VMs from other public clouds** treated as physical servers, SQL Server instances to Azure VMs or Azure SQL, ASP.NET web apps to App Service and AKS, and bulk offline data through Data Box.

Two things about the current product surprise people working from older documentation:

- **There are two experiences.** The current Azure Migrate is application-aware and supports cross-workload views. **Azure Migrate Classic** is the older experience and does not. Documentation is pivoted between them, so check which one a procedure applies to.
- **The Azure Copilot migration agent (preview)** provides a conversational interface over project data for exploring inventory, comparing strategies, reviewing business case insights, and generating landing zone templates. It is planning-only. Execution stays in the portal.

Several tools commonly described as parts of Azure Migrate are actually standalone and integrate with it: **Data Migration Assistant** for SQL assessment, **Azure Database Migration Service** for the migration itself, and the **Azure App Service Migration Assistant** for .NET and PHP web apps. **Movere is retired.**

### Frontier Accelerate for Azure

Microsoft's funding and delivery program provides partner funding, Azure credits, training, and zero-cost deployment assistance through the **Cloud Accelerate Factory**, where Microsoft engineers handle repeatable deployment tasks alongside a partner.

The name has changed twice recently. It consolidated **Azure Migrate and Modernize**, **Azure Innovate**, and **Cloud Accelerate Factory** into **Azure Accelerate**, which is now presented as **Frontier Accelerate for Azure**. Older material may also reference a "Migration Accelerator Program," which is not a Microsoft program name. MAP is AWS's Migration Acceleration Program. Confirm the current name and terms with your Microsoft account team rather than from documentation of any vintage.

---

## Governance and Compliance During Migration

### Data residency and sovereignty

- **Residency** requirements keep data inside a country or region, which constrains target region selection before anything else does
- **Sovereignty** requirements can go further, demanding operation by local entities, which may point at a sovereign cloud rather than a public region
- **Transfer** during migration is itself regulated in some jurisdictions, so the data path chosen above may need legal review, not just bandwidth math

CAF treats sovereignty as its own adoption scenario, which is a signal that these constraints shape architecture rather than sitting on top of it.

### Compliance

Azure holds certifications including SOC 2, ISO 27001, HIPAA, and PCI-DSS, but inheriting them requires using the platform's controls correctly. Network isolation, encryption configuration, and access control remain your responsibility, and a certified platform configured badly is not a compliant system. [Azure compliance offerings](https://learn.microsoft.com/en-us/azure/compliance/){:target="_blank" rel="noopener noreferrer"} document which standards apply where.

### Hybrid governance

During migration you operate both environments, often for longer than planned, and governance has to span both.

- **Identity.** On-premises Active Directory Domain Services and Microsoft Entra ID are separate directories with different protocols. Connecting them through Microsoft Entra Connect gives users one identity across both, and it is a prerequisite rather than a migration step
- **Governance reach.** Azure Arc projects on-premises and other-cloud servers, Kubernetes clusters, and SQL Server instances into Azure Resource Manager, which makes Azure Policy, Defender for Cloud, and Azure Monitor apply to them. This is also the mechanism for workloads assigned the **Retain** strategy, which otherwise sit permanently outside governance
- **Monitoring.** Collect from both environments into one workspace, so an incident spanning the seam can be investigated in one place
- **Cost.** Track by environment so the business case can be measured against actuals rather than asserted

---

## Key Takeaways

1. **CAF has seven phases, not six.** Strategy, Plan, and Ready run in sequence into Adopt, which absorbed the old Migrate and Innovate phases. Govern, Secure, and Manage run continuously alongside operations. Secure is now its own phase, and plans built on the six-phase model omit it.

2. **There are eight migration strategies.** Retire, Retain, Rehost, Replatform, Refactor, Rearchitect, Replace, Rebuild. The three the "5 Rs" leaves out are among the most valuable: Retire removes cost permanently, Retain plus Azure Arc handles what cannot move, and Replatform is what most people mean when they say refactor.

3. **Rehost only when the workload will stay unchanged for two years.** That is CAF's test. Rehosting something you will modernize next year means paying for the migration twice. Rehosting a workload that already has performance or reliability problems carries them into Azure.

4. **Build the business case in Azure Migrate.** It computes total cost of ownership from discovered utilization, applies Hybrid Benefit and reservation discounts, and flags end-of-support versions. The standalone TCO Calculator has been superseded.

5. **Assessment finds what should not move.** Dependency analysis prevents cutover failures, and the Retire and Retain decisions it enables reduce migration scope more cheaply than any optimization performed afterward.

6. **Landing zone first.** Management group hierarchy, network topology, RBAC, and Azure Policy applied before workloads arrive cost a fraction of retrofitting them afterward. Use `DoNotEnforce` to introduce restrictive policies without stopping a live migration.

7. **Waves need hard workloads early.** A first wave of only easy workloads teaches nothing about the hard ones. Include one or two representative complex systems so the program surfaces its hardest problems while there is still schedule left.

8. **A rollback plan is a tested capability, not a document.** Define failure criteria with business stakeholders in advance, automate reversion where possible, test in staging, and name who has authority to call it.

9. **Decommissioning is the step that realizes the business case.** Until source infrastructure is retired, the organization pays for both environments and the projected savings do not exist. Give it an owner and a date.

10. **Migration is organizational change with a technical component.** Skills, operating model, and change management determine whether migrated workloads get operated well or get frozen in the shape they arrived in.
