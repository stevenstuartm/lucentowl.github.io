---
title: "Azure Cost Management & Optimization for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "How Microsoft Cost Management reports and forecasts spend, how reservations and savings plans stack against each other hour by hour, and which commitment and licensing decisions can be reversed after you make them."
tags: [cost-optimization, finops, reservations, savings-plans, budgets, azure-hybrid-benefit, practical]
---

## What Microsoft Cost Management Does

[Microsoft Cost Management](https://learn.microsoft.com/en-us/azure/cost-management-billing/cost-management-billing-overview){:target="_blank" rel="noopener noreferrer"} reports what you spent, forecasts what you will spend, alerts when either crosses a line you drew, and exports the underlying records for analysis elsewhere. It does not stop spending. Nothing in Cost Management throttles a resource or blocks a deployment, so every control it offers is a notification that something else has to act on.

Architecture drives most of the bill. Compute sizing, redundancy tier, data locality, and commitment strategy are design decisions that show up as line items months later, which is why treating cost as a finance concern rather than an architectural one produces surprises that are expensive to unwind.

### Which Scopes Each Feature Supports

Cost Management features do not all work at the same scopes, and assuming they do is a common source of half-built governance.

| Feature | Supported scopes |
|---|---|
| **Cost Analysis** | Management group, subscription, resource group, and billing scopes (EA enrollment/department/account, MCA billing account/profile/invoice section) |
| **Budgets** | Management group, subscription, resource group, plus EA and MCA billing scopes |
| **Budget action groups** | Subscription and resource group only |
| **Anomaly detection** | Subscription only |
| **Exports** | Subscription, resource group, management group, department, and enrollment, with significant management group limitations |
| **Reservations** | Single resource group, single subscription, shared across a billing context, or management group |

Two consequences follow. Anomaly detection cannot be configured once at the management group and inherited downward, so a tenant with 200 subscriptions needs 200 onboarded subscriptions rather than one assignment. And a budget at management group scope can email but cannot trigger automation, so any budget meant to drive a runbook has to live at subscription or resource group scope.

Budget evaluation also requires a **single currency** across the scope. A management group spanning subscriptions billed in different currencies does not evaluate, and the alerts silently never fire.

### How Azure Compares to AWS

| Concept | AWS | Azure |
|---------|-----|-------|
| **Cost visibility** | Cost Explorer, Budgets, and Cost Anomaly Detection as separate features | Cost Management as one surface covering analysis, budgets, alerts, and anomaly detection |
| **Anomaly detection** | Cost Anomaly Detection, configurable monitors by service, account, or tag | Built into Cost Analysis smart views at subscription scope, free, with a five-alert-rule limit per subscription |
| **Commitment discounts** | Reserved Instances and Savings Plans | Reservations (up to 72% off) and savings plans for compute or for databases (up to 65% off) |
| **Spot compute** | Spot Instances with a two-minute interruption notice | Spot VMs with a 30-second best-effort notice through Scheduled Events |
| **Cost allocation** | Cost allocation tags and cost categories | Azure tags plus native cost allocation rules for shared resources |
| **Recommendations** | Compute Optimizer for EC2 and Lambda, Trusted Advisor for the rest | Azure Advisor, free and built in, though reservation recommendations cover VMs only |
| **Data export** | Cost and Usage Report to S3 | Exports to Azure Storage in CSV or Parquet, including the FOCUS open format |

---

## Cost Analysis and Data Latency

### Actual Cost Versus Amortized Cost

[Cost Analysis](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis){:target="_blank" rel="noopener noreferrer"} reports the same spend two ways, and picking the wrong one distorts every conclusion drawn from it.

**Actual cost** is what appears on the invoice. A three-year reservation bought up front shows its entire cost in the month of purchase and then shows near-zero compute cost for 36 months.

**Amortized cost** spreads commitment purchases evenly across their term, so that same reservation shows a steady monthly charge. Amortized is the view for understanding recurring run rate and for charging teams back fairly, because it does not hand one team a six-figure spike and every other team a discount they did not pay for.

Budgets evaluate against **actual cost only**. They do not amortize. A large reservation purchase can therefore blow through a budget threshold in a single day even though nothing about ongoing consumption changed.

### Data Latency Differs by Feature

Every feature reads the same underlying data, but each waits a different amount of time before acting on it.

- Cost and usage data is typically available within **8 to 24 hours**.
- Budgets are evaluated **every 24 hours**, and threshold emails arrive within about an hour of the evaluation.
- Anomaly detection runs **36 hours** after the end of a UTC day, so it has a complete dataset to compare against.
- Export data is available within about **4 hours** of an export run beginning.
- A brand new subscription can take up to **48 hours** before Cost Management features work at all.

None of this is real-time. A runaway resource created at 9 AM is not going to trigger a budget alert that morning, which is the practical reason budget-driven automation limits damage rather than preventing it.

### Grouping Dimensions and What Each Answers

Group by **Service name** to see which services drive the bill. Group by **Resource group** to allocate to teams when resource groups map to teams. Group by **Resource** to find individual expensive items. Group by **Tag** to allocate along a dimension your organization actually uses, which requires the tagging discipline described later. Group by **Meter** to see the specific billable unit, which is how you separate a VM's compute charge from its disk, bandwidth, and license charges.

Service mix varies enormously between organizations, so treat any published "typical" split as noise. What matters is the trend in your own numbers and whether concentration in a single service represents a dependency risk or an optimization opportunity.

---

## Budgets and Cost Alerts

### What a Budget Does and Does Not Do

[Budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets){:target="_blank" rel="noopener noreferrer"} compare accrued or forecasted cost against an amount you set and send notifications when a threshold is crossed. Microsoft states the limitation plainly: resources aren't affected, and consumption isn't stopped.

Budgets reset at the end of each period and are automatically deleted when they expire. Quarterly and annual budgets divide their amount evenly across the months in the period rather than tracking a single running total, so a quarterly budget behaves like three monthly budgets of a third the size.

One behavior catches teams out after the fact. Budget evaluations now include reservation and other purchase charges, so a commitment purchase can trip a threshold that was sized for consumption alone. Filtering the budget to `Publisher Type: Azure` and `Charge Type: Usage` restricts it to first-party consumption if that is what you meant to track.

### Alert Configuration Limits

A budget requires at least one threshold and one email address, and supports up to **five thresholds and five email addresses**. Thresholds accept anything from **0.01% to 1000%** of the budget amount.

Two alert types exist. **Actual** alerts fire on cost already accrued. **Forecasted** alerts fire when the projection for the period crosses the threshold, which buys lead time that actual alerts cannot.

A workable pattern uses both. A forecasted alert at 100% warns that the trajectory is wrong while there is still time to change it, and actual alerts at 80% and 100% confirm what happened. For development and test scopes, fewer and higher thresholds reduce noise that nobody will act on.

### Triggering Automation with Action Groups

A budget at subscription or resource group scope can call an [action group](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups){:target="_blank" rel="noopener noreferrer"}, which is the native path from a threshold to an action. The action group can invoke a webhook, an Azure Function, a Logic App, an Automation runbook, an ITSM connector, or a mobile push notification.

Typical actions are stopping non-production VMs, scaling an App Service plan down, or opening a ticket against the owning team. Because of the 24-hour evaluation cycle, treat this as containment rather than prevention. If the requirement is genuinely to prevent spend, the control is Azure Policy denying the expensive SKU at deployment time, not a budget reacting a day later.

Budgets created with the PowerShell `New-AzConsumptionBudget` cmdlet do not send notifications, so portal, REST API, ARM, or Terraform are the paths that work for alerting.

### Cost Anomaly Detection

Azure detects cost anomalies without you configuring a threshold at all, which covers the spend you did not think to budget for.

Anomaly detection is available on every subscription monitored through Cost Analysis smart views and carries no charge. It compares each day's total normalized usage against a forecast built from the previous **60 days**, so recurring patterns like a Monday spike are learned rather than flagged. The model is a univariate time-series forecast using the WaveNet deep learning algorithm, and it is a different model from the Cost Management forecast shown in Cost Analysis.

To get notified rather than having to look, create an **anomaly alert** under Cost alerts. Creating one requires Cost Management Contributor or higher, and there is a limit of **five anomaly alert rules per subscription**. The alert email summarizes the change in resource group count and cost and lists the top resource group changes against the previous 60 days. An anomaly email is sent once at detection and is not repeated.

Two constraints shape how you use it. Anomaly alerts are not available in Azure Government or other sovereign clouds. And Azure checks the rule creator's permissions at send time, so an alert stops delivering if the creator loses access, which argues for creating production anomaly rules with a service principal through the Scheduled Actions API rather than under a named individual.

Automation is email-driven rather than action-group-driven. A Logic App monitoring the receiving mailbox is Microsoft's documented pattern for turning an anomaly alert into a Teams post, a ticket, or a Cost Management API query.

---

## Commitment Discounts

### Azure Reservations

[Azure Reservations](https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/save-compute-costs-reservations){:target="_blank" rel="noopener noreferrer"} are one-year or three-year commitments to a specific product, and Microsoft states savings of up to 72% against pay-as-you-go. Up-front and monthly payment cost the same total, with no financing premium for choosing monthly.

The discount matches on **SKU, region where applicable, and scope**. There is no cross-region flexibility option for VM reservations the way AWS offers regional Reserved Instances. You pick a region, and the discount applies there.

Scope is chosen at purchase and can be changed afterward. The options are a single resource group, a single subscription, shared across the billing context, or a management group. Shared scope wastes the least, because unused reservation hours find any matching resource in the billing account rather than sitting idle in one subscription.

**Instance size flexibility** lets a reservation float across sizes within the same family and series, so a reservation bought for `D2s_v5` can apply to a `D4s_v5` at proportional coverage. Size flexibility is what Azure offers here, and region flexibility is not part of it.

What a reservation covers is narrower than people expect. A Reserved VM Instance covers **only the virtual machine compute cost**. Windows and SQL Server licensing, networking, and storage are billed separately and are unaffected, which is why Azure Hybrid Benefit is a separate lever rather than a redundant one. The same pattern holds elsewhere: SQL Database and SQL Managed Instance reservations cover compute but not licensing, storage, or networking; Cosmos DB reservations cover provisioned throughput but not storage; Azure Disk reservations cover Premium SSDs of **P30 or larger** and nothing smaller.

All reservations except Azure Databricks apply on an hourly basis.

### Azure Savings Plans

[Savings plans](https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/savings-plan-overview){:target="_blank" rel="noopener noreferrer"} commit you to a fixed dollar amount per hour rather than to a product, and Microsoft states savings of up to 65% against pay-as-you-go. Discount rates vary by product and by term length, not by how large a commitment you make, so committing more does not buy a better rate.

There are two savings plans, and guidance written before the second one exists will only mention the first.

**Savings plan for compute** is available as a one-year or three-year commitment and covers Azure Virtual Machines, App Service, Azure Functions premium plan, Container Instances, Dedicated Host, Container Apps, and Azure Spring Apps for Enterprise. It covers infrastructure cost only, not software, networking, or storage.

**Savings plan for databases** is a one-year commitment and covers SQL Database including Hyperscale and serverless, SQL Managed Instance, Database for PostgreSQL, Database for MySQL, Cosmos DB, DocumentDB, Database Migration Service, and the hourly SQL Server licenses on Azure VMs and on SQL Server enabled by Azure Arc. Unlike the compute plan, it covers software IP cost as well as infrastructure.

Each hour's benefit is use-it-or-lose-it. Unused commitment in an hour does not roll forward.

Savings plans require an Enterprise Agreement, Microsoft Customer Agreement, or Microsoft Partner Agreement. Resources in subscriptions under other offer types get no discount at all, which makes the agreement type a prerequisite rather than a detail.

### How the Discounts Stack in a Given Hour

Reservations, savings plans, and licensing benefits are not alternatives that you choose between at billing time. They apply in a fixed order to the same hour of usage.

```
              One hour of eligible usage
                          |
                          v
        +----------------------------------------+
        | 1. Reservation                         |
        |    Matched on SKU + region + scope.    |
        |    Applied FIRST because it is the     |
        |    more restrictive benefit and        |
        |    usually the deeper discount.        |
        |    (up to 72% off)                     |
        +--------------------+-------------------+
                             | usage the reservation
                             | did not cover
                             v
        +----------------------------------------+
        | 2. Savings plan                        |
        |    Applied to the product with the     |
        |    LARGEST discount first, deducting   |
        |    from the hourly commitment until    |
        |    the commitment is exhausted.        |
        |    (up to 65% off, use-it-or-lose-it)  |
        +--------------------+-------------------+
                             | usage beyond the
                             | hourly commitment
                             v
        +----------------------------------------+
        | 3. Pay-as-you-go, or your negotiated   |
        |    Azure consumption discount rate,    |
        |    whichever of the two is lower       |
        +--------------------+-------------------+
                             |
                             v
        Billed separately, never covered by any
        commitment above:  Windows / SQL Server
        license cost, storage, networking.
        Azure Hybrid Benefit is what removes the
        license component.
```

Reservations going first is deliberate. Because a reservation is the more constrained benefit, spending it before the flexible one reduces the chance that either goes unused. A VM that a reservation can cover never draws down the savings plan commitment, leaving that commitment available for workloads nothing else covers.

Two ordering rules apply when you hold several plans. Among multiple savings plans, Azure applies the three-year plan before the one-year plan so the better rate is consumed first, and applies a more narrowly scoped plan before a broader one to reduce waste.

Utilization figures need reading with care. The billing system uses a **best-fit model over a sliding 48-hour window**, incorporating usage that arrives up to 48 hours after the hour being evaluated. Charges can shift during that window, and savings plan utilization can briefly show above 100%. Judge utilization on data older than two days.

### Choosing Between Them

| Aspect | Reservations | Savings plans |
|--------|-------------|---------------|
| **Commitment** | A specific product, size, and region | A dollar amount per hour |
| **Maximum discount** | Up to 72% | Up to 65% |
| **Flexibility** | Instance size flexibility within a family and series; region is fixed | Applies across eligible services, sizes, and regions automatically |
| **Coverage** | Compute, database, storage, and other services individually | Compute plan or database plan, each covering a defined service list |
| **Eligible agreements** | Broad, including pay-as-you-go | EA, MCA, or MPA only |
| **Application order** | Applied first | Applied to what reservations did not cover |
| **Reversible?** | Exchangeable for the same type; refundable up to $50,000 in a rolling 12 months | Not cancellable, not refundable |
| **Best for** | Stable workloads whose SKU and region you expect to keep | Changing workloads, migrations, and estates adopting new services |

Most organizations run both. Reservations cover the portion of the estate whose shape is settled, and a savings plan covers the remainder without requiring anyone to predict instance families.

### The Decisions You Cannot Undo

The reversibility row above deserves emphasis, because the two products differ sharply and the asymmetry is easy to miss until it matters.

A **reservation** can be exchanged for another reservation of the same type, and can be refunded up to **$50,000 USD in a rolling 12-month window**, with that limit applying across every reservation in your agreement. Buying the wrong reservation is recoverable.

A **savings plan cannot be cancelled or refunded**. Once purchased, you are committed to that hourly amount for the full one or three years. You can trade eligible reservations in for a savings plan, but not the reverse.

That asymmetry should change how you size the first purchase. Commit a savings plan to the floor of your compute spend, the amount you are confident about, and buy more later rather than committing optimistically and living with it for three years. Savings plans also do not renew automatically unless you enable renewal, so a plan silently expiring returns you to pay-as-you-go rates.

### Sizing the Commitment

Use Cost Analysis to find the level of consumption your estate sustains year-round rather than its peak. A workload peaking at 20 VMs but never dropping below 8 should commit at 8 and absorb the rest at pay-as-you-go or Spot rates. Committing at peak means paying for capacity that is idle most hours.

Recommendations are available in Azure Advisor, in the purchase experience in the portal, in the Cost Management Power BI app, and through the benefit recommendation APIs. Advisor's reservation recommendations cover **VMs only**, so other services need the portal purchase experience or the API. Reservation recommendations reflect the current snapshot and cannot be backfilled historically.

Match the term to your confidence rather than to the discount. Three years buys the deeper rate, but a one-year term on a workload mid-migration usually costs less than a three-year commitment to an architecture you replace in month eight.

---

## Azure Hybrid Benefit

[Azure Hybrid Benefit](https://learn.microsoft.com/en-us/azure/cost-management-billing/scope-level/overview-azure-hybrid-benefit-scope){:target="_blank" rel="noopener noreferrer"} applies on-premises Windows Server and SQL Server licenses to Azure resources, removing the license component of the hourly rate. Microsoft states savings of up to 80% for Windows Server and up to 85% for SQL Server against pay-as-you-go, with the SQL figure reflecting the benefit stacked with a reservation.

Eligibility requires core licenses with **active Software Assurance or qualifying subscription licenses**, covering Windows Server Datacenter and Standard and SQL Server Enterprise and Standard. Subscription licenses qualify on their own, so an organization without Software Assurance is not automatically excluded.

Because commitment discounts never cover licensing, Hybrid Benefit is additive rather than alternative. A reserved Windows VM still pays full license cost until Hybrid Benefit is applied to it.

### Resource-Level Versus Centrally Managed

The original model has a resource owner select the benefit on each VM or database. It remains the only option for Windows Server.

For SQL Server, **centrally managed Hybrid Benefit** lets a billing administrator assign a number of licenses to a subscription or billing account scope, and Azure applies them hourly to whichever resources are running. It is available to Enterprise Agreement customers and to Microsoft Customer Agreement customers buying directly, and is not available through a CSP partner. Once you manage the benefit at a scope, you can no longer set it per resource within that scope.

Central management solves a specific governance problem. Under the resource-level model, a developer can enable the benefit when no license is available, creating a compliance exposure, or leave it off when one is available, wasting money. Neither is visible to the people who know the license position.

### License Math

SQL Server licenses convert to Azure coverage at documented ratios, expressed in normalized cores. **One SQL Server Enterprise license covers as much as four Standard licenses.** General Purpose and Hyperscale tiers need 1 normalized core per vCore, and Business Critical needs 4. SQL Server on Azure VMs is subject to a minimum of four vCores per VM.

Two constraints matter when planning. Hybrid Benefit is **not available in the serverless compute tier of Azure SQL Database**. And licenses supporting a migrating workload can be counted against both on-premises and Azure use for up to **180 days**, which is what makes a migration window affordable.

---

## Spot VMs

[Spot Virtual Machines](https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms){:target="_blank" rel="noopener noreferrer"} run on Azure's unused capacity at variable prices well below pay-as-you-go. In exchange there is no SLA and no availability guarantee, and Azure evicts them whenever it needs the capacity back, giving **30 seconds of best-effort notice** through Azure Scheduled Events.

Pricing varies by size, region, and time, so quoting a fixed discount is misleading. Check the actual numbers instead. The portal shows pricing history and eviction rates per size and region during VM creation, and Azure Resource Graph exposes the `SpotResources` table for programmatic queries covering 90 days of pricing and 28 days of eviction rates. Eviction rates are quoted per hour, so a 10% rate means roughly a one-in-ten chance of eviction within the next hour.

### Eviction Policy Is a Cost Decision

At creation you choose **Deallocate** (the default) or **Delete** as the eviction policy, and the choice has a billing consequence people miss.

Deallocated VMs move to the stopped-deallocated state so they can be redeployed later, but they continue to **count against your quota and continue to incur storage charges for their underlying disks**. A fleet of evicted Spot VMs left on the deallocate policy accumulates disk cost indefinitely while producing nothing. The Delete policy removes the VM and its disks together, which is the right choice for genuinely stateless work.

You can also set a **maximum price** in USD to five decimal places, which adds price-based eviction on top of capacity-based eviction. Setting it to `-1` means the VM is never evicted for price and is charged at the lower of the current Spot price or the standard price. Changing the maximum price requires deallocating the VM first.

### Where Spot Fits and Where It Does Not

Spot suits batch processing, ML training, dev and test environments, large-scale load and regression testing, and horizontally scaled work where losing an instance is survivable. It does not suit production services needing availability, long-running processes that cannot checkpoint, or stateful services without automatic recovery. Long-running MPI jobs spanning multiple VMs are a poor fit specifically because one eviction can force the entire job to restart.

Several limits apply. B-series and promotional SKU sizes are not supported. Spot is unavailable in Azure operated by 21Vianet. Supported offer types are Enterprise Agreement, pay-as-you-go offer code 003P, Sponsored, and CSP. Spot has a separate quota pool from dedicated VMs. An existing VM cannot be converted to Spot, and a Spot VM cannot be converted back.

### Spot in Azure Batch

Azure Batch pools use Spot VMs, and Batch adds handling that raw Spot VMs lack. Interrupted tasks are automatically requeued onto another node, pools continually seek their target Spot node count after evictions, and Spot gets a higher vCPU quota than dedicated nodes. A preempted VM may be restored by the platform, but only within the first 48 hours and without guarantee.

Batch's older "low-priority" name survives in the API surface, in properties like `targetLowPriorityNodes` and metrics like Low-Priority Node Count, so scripts referring to low-priority nodes are addressing Spot capacity under an earlier name.

Batch differs from standalone Spot VMs in one way that affects design. **Batch Spot VMs do not support setting a maximum price and are never evicted for price**, only for capacity. Ephemeral OS disks are also unsupported on Batch Spot nodes because of the service-managed Stop-Deallocate eviction policy.

A pool can mix dedicated and Spot nodes, which is the pattern that keeps a job progressing. A fixed dedicated baseline guarantees forward motion, and Spot nodes accelerate the job whenever capacity is available.

---

## Right-Sizing and Idle Resources

### Azure Advisor as the Starting Point

[Azure Advisor](https://learn.microsoft.com/en-us/azure/advisor/advisor-overview){:target="_blank" rel="noopener noreferrer"} produces free recommendations across Cost, Security, Reliability, Operational Excellence, and Performance. Its cost recommendations surface idle virtual machines, unattached managed disks, underutilized and expiring reservations, underused SQL resources, and Azure Hybrid Benefit opportunities.

Verify before acting on any of them. An idle VM might be a disaster recovery standby, a quarterly batch host, or a license-bound appliance that costs more to rebuild than to leave running. Check ownership, backup history, and monitoring data before deleting anything Advisor flags, then confirm the projected saving actually appears in the next billing cycle.

### What to Measure Before Resizing

| Signal | Threshold that warrants investigation | Likely action |
|--------|------------------------------|---------------|
| **VM CPU** | Sustained under 10% across a full week | Smaller size, or deallocate if genuinely unused |
| **VM network in/out** | Near zero sustained alongside low CPU | Idle; candidate for deletion |
| **SQL Database CPU or DTU** | Consistently under 10% of the tier | Lower tier or serverless |
| **App Service instance count** | Instances persistently above observed demand | Autoscale with a lower minimum |
| **Storage account access** | No read or write for 30 days | Cool or archive tier, or delete |
| **Unattached managed disks** | Any, immediately | Snapshot then delete |

Analyze a representative week or month rather than a window. A VM at 5% CPU overnight may sit at 80% during business hours, and resizing on the overnight sample creates a performance incident that costs more than the savings.

Redundancy tier is the right-sizing dimension architects most often skip. Geo-redundant storage costs meaningfully more per GB than zone-redundant or locally redundant storage, and read-access geo-redundant more again. Paying for cross-region durability on data that is reproducible from a source system, or on a dev environment, is a recurring charge for a guarantee nobody needs.

Regional pricing varies by service and region. Rather than assuming a figure, query the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices){:target="_blank" rel="noopener noreferrer"}, which is public, unauthenticated, and returns the same rates the pricing pages show. Balance any regional saving against latency and data residency before moving anything.

---

## Tagging and Cost Allocation

### Tags That Earn Their Place

Cost allocation is only as good as the tags underneath it, and tags applied inconsistently produce reports that teams dispute rather than act on.

| Tag | Examples | What it enables |
|-----|----------|-----------------|
| **Environment** | `production`, `staging`, `development` | Different cost controls and patch windows per environment |
| **CostCenter** | `engineering`, `marketing`, `operations` | Chargeback and showback to departments |
| **Owner** | `team-web@company.com` | Someone to ask when a resource looks idle |
| **Application** | `crm`, `data-pipeline` | Cost per workload rather than per resource group |
| **Project** | `project-alpha` | Cost per initiative or customer |

Prefer a team or distribution list over an individual for `Owner`. Individual owners leave, and the tag becomes an unanswerable question.

Enforce with Azure Policy rather than convention. Start in `audit` mode to size the existing gap, use `modify` with a remediation task to backfill tags that can be inferred from the resource group, and move to `deny` once new deployments are consistently compliant. Remember that a `modify` policy acts through the assignment's own managed identity, so the assignment needs a role grant before remediation works.

Tags do not inherit automatically from a subscription or resource group to the resources inside them for cost reporting purposes. Inheritance is something you implement with policy, not something that happens by default.

### Cost Allocation Rules for Shared Resources

Shared infrastructure like a central Azure Firewall, an ExpressRoute circuit, a NAT Gateway, or a hub DNS zone belongs to every team and to none, and it sits in a shared resource group where it distorts that group's numbers while flattering everyone else's.

[Cost allocation rules](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/allocate-costs){:target="_blank" rel="noopener noreferrer"} redistribute those costs to destination subscriptions, resource groups, or tags. You define a source holding the shared cost and destinations receiving it, splitting evenly, by a fixed percentage, or in proportion to the destinations' own cost.

A central firewall costing $1,200 a month can be split 40/35/25 across three teams based on throughput analysis, so each team's cost view includes $480, $420, or $300 of firewall. The redistribution appears in cost analysis; it does not change the invoice.

Agree the split with the teams before deploying the rule and test it against historical data. A rule that surprises people at chargeback time produces arguments about the model instead of action on the costs.

---

## Exporting Cost Data

### What Exports Can Produce

[Exports](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-improved-exports){:target="_blank" rel="noopener noreferrer"} write Cost Management datasets to Azure Storage on a schedule, and they cover considerably more than a cost CSV.

Available datasets are cost and usage details in **actual**, **amortized**, or **FOCUS** form, plus **price sheet**, **reservation details**, **reservation recommendations**, and **reservation transactions**. The reservation transactions dataset records purchases, exchanges, and refunds, which is what you need to audit commitment decisions after the fact.

**FOCUS** is the [FinOps Open Cost and Usage Specification](https://focus.finops.org/){:target="_blank" rel="noopener noreferrer"}, an open format that combines actual and amortized cost in one dataset and reduces processing time and storage cost. For an organization reporting across more than one cloud, it is the format that makes the datasets comparable. Management group scope is not supported for FOCUS exports, and MOSP billing scopes cannot use FOCUS at all.

Schedules include one-time exports, daily exports of month-to-date cost, monthly exports of the previous month, and monthly exports of the previous billing month. Cost and usage exports run **twice daily during the first five days of each month**, with the second run rewriting the prior month's file, because invoice-affecting usage can arrive up to 72 hours after the month closes.

### Format and Delivery Mechanics

Cost, usage, FOCUS, and price sheet datasets support **CSV** with optional Gzip or **Parquet** with optional Snappy. Reservation details, recommendations, and transactions are CSV only, uncompressed.

**File partitioning is always on and cannot be disabled**, even for small exports. Each run writes multiple partition files plus a `manifest.json` listing every partition and its metadata. Read the manifest rather than guessing file names, and use a tool that ingests multiple files such as Power BI, Spark, or Fabric. Files are split by size, keeping each uncompressed partition under 1 GB.

**Overwrite** is on by default for daily exports, replacing the previous day's file so the month folder holds one run rather than thirty.

Exports to a firewalled storage account are supported. Creating one requires Owner or a custom role with `Microsoft.Authorization/roleAssignments/write` and `permissions/read`, because Cost Management creates a system-assigned managed identity for the export and grants it Storage Blob Data Contributor scoped to the container. After creation, routine runs do not need those elevated permissions. Trusted Azure service access must be enabled on the storage account, and firewalled storage is not supported for cross-tenant exports.

Historical backfill through the portal reaches **13 months**, one month at a time, using Export selected dates on an existing export. The REST API reaches **7 years** for cost, usage, and reservation transaction data.

Management group scope is the weak spot. Only the usage dataset is available there, in uncompressed CSV, for Enterprise Agreement only, with no purchases, no amortized data, no multiple currencies, and a ceiling of 3,000 subscriptions per management group.

### Reporting on the Data

The Cost Management connector for Power BI still works, but it is in maintenance mode and is no longer being updated. Microsoft has moved its Power BI guidance to exports, which support every agreement type and scale to datasets the connector cannot handle. Build new reporting on exported data in storage rather than on the connector, and treat the connector as something to migrate off rather than to adopt.

A useful dashboard usually carries total cost by service, a daily trend line for spotting anomalies visually, cost by resource group and by tag, a forecast, reservation and savings plan utilization, and a table of resources above a cost threshold. The value is that finance and leadership can answer their own questions without portal access.

Two data quality traps affect exported files. Power BI and Excel can silently truncate cost values to integers, so set cost columns to Decimal Number explicitly and choose Convert when Excel offers it. And CSV files use UTF-8, so importing with the wrong file origin garbles non-Latin characters.

---

## FinOps Practices

### What FinOps Changes

FinOps distributes cost accountability across engineering, finance, and the business instead of concentrating it in whoever receives the invoice. Engineers own architectural efficiency, finance owns budgets and reporting, and the business owns whether the spend produces value. It works when everyone can see the numbers and someone is answerable for each one.

### Chargeback, Showback, and a Central Team

**Chargeback** bills departments internally for what they consume. It creates genuine accountability because the cost lands in a budget somebody defends, and it drives cleanup faster than any dashboard. It also requires tag governance strict enough that the numbers survive scrutiny, and it can push teams away from shared platform services to avoid the charge, which costs more in aggregate than it saves.

**Showback** reports the same numbers without moving money. It raises awareness with far less friction and suits matrix organizations where cost ownership genuinely is unclear, but teams can ignore a report in a way they cannot ignore a charge. Showback often works best as the stage before chargeback, while tagging quality is still improving.

**A FinOps center of excellence** puts a small dedicated group, commonly a few engineers and someone from finance, in charge of commitment strategy, anomaly response, idle resource cleanup, and reporting to leadership. It earns its cost at the scale where commitment decisions are large enough that getting them wrong is expensive and specialized enough that no individual team will get them right.

### Metrics That Drive Behavior

| Metric | Calculation | What good looks like |
|--------|-------------|---------------------|
| **Commitment utilization** | Benefit consumed / benefit purchased | Above 90%, measured on data older than 48 hours |
| **Commitment coverage** | Spend covered by a commitment / total eligible spend | Rising toward your stable baseline, not toward 100% |
| **Waste ratio** | Cost of idle and unattached resources / total spend | Low single digits, trending down |
| **Untagged spend** | Cost of resources missing required tags / total spend | Approaching zero, or allocation is guesswork |
| **Unit cost** | Monthly cost / business transactions | Falling as the platform scales |

Utilization and coverage answer different questions and both are needed. High utilization on a tiny commitment means you bought too little, and broad coverage with poor utilization means you bought the wrong things.

---

## Common Pitfalls

### Pitfall 1: Treating a Budget as a Spending Limit

**Problem:** A budget is created and treated as a control, on the assumption that hitting it stops or throttles something.

**Result:** Spending continues past the threshold, because Microsoft's documented behavior is that resources aren't affected and consumption isn't stopped. The 24-hour evaluation cycle means even the notification arrives well after the spend.

**Solution:** Treat budgets as detection. For actual prevention, deny expensive SKUs, regions, or resource types with Azure Policy at deployment time. For containment, attach an action group at subscription or resource group scope to stop non-production compute. Set forecasted alerts alongside actual ones so you hear about the trajectory rather than the arrival.

---

### Pitfall 2: Buying a Savings Plan You Cannot Return

**Problem:** A savings plan is sized against expected or peak spend, on the assumption that a wrong commitment can be exchanged or refunded the way a reservation can.

**Result:** Savings plans cannot be cancelled or refunded. An over-sized three-year commitment is paid in full for three years, and the unused portion of each hour expires rather than rolling forward.

**Solution:** Size the savings plan to the floor of your compute spend and add more later. Where the SKU and region are genuinely settled, prefer a reservation, which is exchangeable and refundable up to $50,000 in a rolling 12 months. Reservations can be traded in for a savings plan later, so starting with reservations preserves optionality that starting with a savings plan does not.

---

### Pitfall 3: Assuming a Commitment Covers the Whole Bill

**Problem:** A Reserved VM Instance is purchased for a fleet of Windows Server VMs and the expected saving does not materialize.

**Result:** The reservation covered only the compute component. Windows licensing, managed disks, and bandwidth continued at full price, so the discount applied to a smaller share of the line item than expected.

**Solution:** Read the coverage boundary for each reservation type before modeling the saving. Apply Azure Hybrid Benefit separately to remove the license component, since no commitment discount ever covers licensing. Group by Meter in Cost Analysis to see how a resource's cost actually splits between compute, license, storage, and network before committing against it.

---

### Pitfall 4: Leaving Evicted Spot VMs on the Deallocate Policy

**Problem:** Spot VMs are deployed with the default Deallocate eviction policy for a stateless batch workload, and evicted instances are never cleaned up.

**Result:** Deallocated VMs keep counting against quota and keep incurring storage charges for their disks. A fleet that has cycled through many evictions accumulates disks that produce nothing, quietly eroding the Spot discount that motivated the design.

**Solution:** Set the eviction policy to Delete for genuinely stateless work so the VM and its disks go together. Where Deallocate is needed for redeployment, automate cleanup of long-deallocated instances. Consider Azure Batch instead of raw Spot VMs, since Batch requeues interrupted tasks and manages node lifecycle for you.

---

### Pitfall 5: Cost Allocation Built on Inconsistent Tags

**Problem:** Chargeback or showback reporting is built on tags applied by convention rather than enforced by policy.

**Result:** Costs land in the wrong cost center, teams dispute their numbers, and the reporting loses credibility faster than it can be corrected. Untagged resources accumulate in an unallocated bucket nobody owns.

**Solution:** Enforce required tags with Azure Policy before building reporting on them, backfilling with `modify` and a remediation task. Track untagged spend as its own metric so the gap is visible. Validate allocation rules against historical data before deploying them, and agree shared-cost splits with the receiving teams in advance.

---

### Pitfall 6: Ignoring Egress and Cross-Region Data Movement

**Problem:** A data pipeline is designed without accounting for per-GB charges on data leaving Azure or crossing regions.

**Result:** Transfer charges scale with volume rather than with compute, so a pipeline that looks cheap in the design review becomes one of the larger line items once it runs at production volume.

**Solution:** Design for data locality, keeping compute in the same region as the data it reads. Compress before transfer. Use ExpressRoute for sustained hybrid transfer rather than internet egress. Group by Meter in Cost Analysis to separate bandwidth meters from compute, since bandwidth is easy to miss when looking at resource-level totals.

---

### Pitfall 7: Snapshots and Backups Without Retention Policies

**Problem:** VM snapshots and backups are created manually or by scripts with no retention rules.

**Result:** Storage accumulates indefinitely. Years of daily snapshots across a sizeable fleet can exceed the cost of the VMs they protect, and nobody notices because each individual snapshot is cheap.

**Solution:** Define retention explicitly, keeping daily copies for days, weekly for weeks, and monthly for months as your recovery objectives require. Use Azure Backup policies rather than manual snapshots so retention is enforced centrally. Include storage growth in the monthly cost review, since it grows steadily rather than spiking and never triggers an anomaly alert.

---

### Pitfall 8: Optimizing Only the Large Line Items

**Problem:** Cost work focuses on the biggest resources and ignores the long tail of small ones.

**Result:** Unattached disks, orphaned public IP addresses, empty App Service plans, idle NAT Gateways, and duplicated shared infrastructure add up. Individually none justifies attention, and collectively they can be a material share of the bill.

**Solution:** Group by resource in Cost Analysis and read past the top rows. Automate cleanup of the categories that are unambiguous, particularly unattached disks and unassociated public IPs. Audit shared infrastructure for duplication, since finding several firewalls or gateways where one would do is common in estates that grew by team rather than by design.

---

## Key Takeaways

1. **Cost Management reports and alerts; it never stops spending.** Microsoft documents this plainly. Prevention is Azure Policy denying expensive resources at deployment, and a budget with an action group is containment that arrives up to a day late.

2. **Actual and amortized cost answer different questions.** Amortized spreads commitment purchases across their term and is the right view for run rate and chargeback. Budgets evaluate on actual cost only, so a reservation purchase can trip a threshold that consumption never would.

3. **Anomaly detection catches what budgets do not.** It is free, needs no threshold, compares each day against a 60-day forecast, and is limited to subscription scope with five alert rules per subscription.

4. **Reservations apply before savings plans, and neither covers licensing.** The more restrictive benefit is consumed first to reduce waste. Windows and SQL Server licensing, storage, and networking fall outside both, which is why Azure Hybrid Benefit stacks rather than competes.

5. **A savings plan cannot be cancelled or refunded; a reservation can.** Reservations are exchangeable and refundable up to $50,000 in a rolling 12 months. Size savings plans to the floor of your spend, because the commitment runs its full term regardless.

6. **There are two savings plans now.** The compute plan covers VMs, App Service, Functions Premium, Container Instances, Container Apps, Dedicated Host, and Spring Apps. A separate database plan, one-year only, covers SQL, PostgreSQL, MySQL, and Cosmos DB and includes software IP cost.

7. **Spot eviction policy is a billing decision.** Deallocated Spot VMs keep consuming quota and paying for their disks. Delete is the right policy for stateless work, and Batch manages requeuing and node replacement for workloads that need it.

8. **Azure Hybrid Benefit can be managed centrally for SQL Server.** A billing administrator assigns licenses at a subscription or billing account scope instead of relying on resource owners to tick a box, which closes both the compliance gap and the wasted-license gap. Windows Server remains resource-level only.

9. **Exports carry more than cost, and the Power BI connector is in maintenance mode.** FOCUS, price sheet, and reservation transaction datasets are all exportable in CSV or Parquet. Build new reporting on exports rather than on the connector Microsoft has stopped updating.

10. **Allocation is only as trustworthy as the tags beneath it.** Enforce required tags with policy before building chargeback on them, and track untagged spend as a metric, because disputed numbers produce arguments rather than savings.
