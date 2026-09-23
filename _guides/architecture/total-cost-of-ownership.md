---
layout: guide
title: "Total Cost of Ownership (TCO)"
category: Architecture
subcategory: Business & Economics
description: "Estimating what a technology choice really costs over its life: one-time, recurring, people, and indirect costs, the costs estimates usually miss, choosing a time horizon, building a comparable estimate, and applying TCO to build versus buy, cloud versus on-premises, and architecture style decisions, with a worked example where the staffing assumption decides the answer."
tags: [practical, total-cost-of-ownership, cost-analysis, build-vs-buy, cloud-costs, decision-making]
---

Total cost of ownership (TCO) is everything an organization spends to acquire, run, change, and eventually retire a technology choice over the period it owns it. The purchase price or the first month's cloud bill is usually a small part of that. The rest arrives later, as people's time to operate the system, upgrades forced by vendors, integration work, and the cost of leaving when the choice no longer fits.

TCO matters to architects because architecture decisions set most of those later costs. Choosing a self-managed message broker, a second cloud provider, or a split into twenty deployable services commits the organization to operating costs for years. A TCO estimate makes those commitments visible while the decision can still be changed.

In its simplest form:

```
TCO = one-time costs + recurring costs over the horizon + exit costs − residual value
```

TCO compares costs. Whether the benefits justify those costs is a return on investment question, and the two analyses work together. A cheaper option can deliver less, and a more expensive one can pay for itself.

## What Goes Into TCO

| Category | Examples |
|---|---|
| **One-time costs** | Hardware purchases, license fees paid up front, implementation and customization, data migration, integration with existing systems, initial training, consulting |
| **Recurring infrastructure and services** | Cloud compute, storage, and data transfer, SaaS subscriptions, support contracts, license renewals, third-party API usage |
| **People** | Engineering time to build and change the system, operations and on-call, security and compliance work, vendor management |
| **Change over the lifetime** | Version upgrades, migrations forced by end-of-support dates, security patching, rework as requirements change |
| **Indirect costs** | Downtime and degraded performance, coordination between teams, onboarding time, knowledge concentrated in a few people |
| **Exit costs** | Data export and migration to a replacement, contract termination fees, decommissioning, running old and new systems in parallel |

People costs deserve particular care, because they are often the largest line and the one most likely to be omitted. Engineering time should be priced at a fully loaded rate, meaning salary plus benefits, payroll taxes, equipment, and overhead, rather than salary alone. Finance teams usually maintain a standard loaded rate, which keeps estimates consistent across proposals.

## Costs That Estimates Usually Miss

Estimates tend to capture what appears on an invoice and miss what appears on a calendar.

**Operating effort.** A self-hosted database, broker, or cluster needs patching, upgrades, capacity management, backups that someone tests, and on-call coverage. A managed service moves much of that to the vendor's price. Comparisons that price the infrastructure and assume operations are free systematically favor self-hosting.

**Integration and data migration.** Connecting a new system to identity, monitoring, deployment pipelines, and the systems that feed and consume it often takes longer than implementing the system itself. Migrating data brings cleansing, reconciliation, and a period of running old and new systems together.

**Forced change.** Every dependency has a support lifecycle. A framework version reaching end of support, a vendor retiring an API, or a cloud service being discontinued creates work on someone else's schedule. Choices with many dependencies, or dependencies with short support windows, carry more of this.

**Complexity that scales with parts.** Each additional deployable service, datastore, language, or cloud provider adds pipelines, monitoring, security reviews, on-call knowledge, and upgrade work. These costs are small per part and large in total, and they grow with the number of parts rather than with traffic.

**Data transfer.** Cloud providers typically charge for data leaving a region or their network, and architectures that move data between regions, providers, or out to on-premises systems can accumulate transfer costs that no one included in the design.

**Exit.** Proprietary data formats, platform-specific services, and long contracts make leaving expensive. The cost of switching rarely appears in the initial estimate, but it determines how painful it will be if the choice turns out wrong.

**Opportunity cost.** Engineers operating infrastructure aren't building product. Time spent maintaining a custom-built capability that could have been bought is time not spent on what differentiates the business.

## Choosing the Time Horizon

The horizon should match how long the organization will live with the decision. A short horizon favors options with low up-front cost and high recurring cost, and a long one favors the reverse, so the same comparison can reach opposite conclusions depending on the horizon chosen.

A few guidelines keep the horizon honest. It should cover at least one major upgrade or renewal cycle, since those are where many costs land. It should reflect contract and commitment terms, such as a multi-year license or reserved capacity. For core infrastructure and data platforms that tend to stay in place for many years, a horizon of only one or two years understates what the choice commits the organization to. Stating the horizon explicitly in the estimate lets readers see how much the conclusion depends on it.

Over multi-year horizons, costs that occur later are usually discounted to their present value, using the discount rate the organization's finance team specifies, so that options whose spending falls in different years can be compared on equal terms.

## Building the Estimate

1. **Define the options.** Include the status quo, since continuing as-is has costs too, and describe each option at the same level of detail.
2. **List cost items per category** for each option, using the table above as a checklist. Ask people who operate similar systems what they spend time on.
3. **Quantify.** Use invoices, quotes, and pricing calculators for direct costs. Price people's time at the loaded rate. For uncertain items, estimate a range rather than a single number.
4. **Project over the horizon.** Model how costs change with growth in users, data, and traffic, and include known future events such as renewals and upgrades.
5. **Test the assumptions.** Vary the most uncertain inputs and see which ones change the ranking of options. Those are the assumptions to investigate further before deciding.
6. **Record the assumptions** alongside the result, so the estimate can be checked against actual costs later and revisited when assumptions change.

The goal is a comparison that is right about which option costs more and roughly by how much, not a precise forecast. Spending weeks refining an estimate whose conclusion doesn't change under any plausible assumption is effort better spent elsewhere.

## Common Comparisons

### Build Versus Buy

| Factor | Build | Buy |
|---|---|---|
| **Up-front cost** | Development effort | License or subscription, plus implementation |
| **Recurring cost** | A team to maintain, operate, and evolve it for its whole life | Subscription or support fees, plus integration upkeep |
| **Fit** | Exactly what's needed, if built well | What the product offers, with gaps worked around |
| **Time to value** | Longer | Usually shorter |
| **Change** | Controlled internally | Follows the vendor's roadmap and release schedule |
| **Risk** | Delivery risk and dependence on the people who built it | Vendor viability, price increases, and lock-in |

The most common error in build-versus-buy estimates is counting only the cost to build. A built system needs a team for as long as it exists, and over a multi-year horizon that maintenance can outweigh the initial development. Building tends to make economic sense where the capability differentiates the business or where no product fits. Buying tends to make sense for capabilities every organization needs and none competes on, such as identity, payroll, or observability tooling.

### Cloud Versus On-Premises

The two have different cost structures rather than a fixed cost ratio. On-premises infrastructure is mostly capital spent up front on hardware sized for peak load, then depreciated, with data center space, power, cooling, and hardware refresh cycles on top. Cloud infrastructure is mostly operating spend that scales with usage, with discounts available for committed usage, and with some of the operating labor built into managed services.

Workloads with large swings in demand, uncertain growth, or short lifespans tend to favor the cloud, because on-premises capacity has to be bought for the peak and paid for when idle. Large, steady, predictable workloads narrow the gap, and at sufficient scale some organizations find owned infrastructure cheaper. The comparison is only fair when both sides include staffing, the cloud side includes data transfer and the discounts actually available, and the on-premises side includes hardware refresh and the facilities cost.

### Architecture Style

Architecture styles shift costs between categories more than they raise or lower totals by a fixed amount. A monolith or modular monolith has one deployment pipeline, one runtime to monitor, and in-process calls, which keeps infrastructure and operations costs low, but teams increasingly coordinate releases as the organization grows. Microservices add per-service pipelines, service-to-service networking, distributed tracing, and more on-call knowledge, raising operations and infrastructure costs, in exchange for teams that can change and deploy independently. Whether that trade pays depends on how many teams there are and how much coordination costs them today, which is why the same style can be cost-effective for one organization and expensive for another.

## Worked Example

The figures below are illustrative, chosen to show the method, not benchmarks for any product.

A team needs an event streaming platform for three years and is comparing a self-managed cluster on cloud virtual machines with a managed streaming service. The loaded cost of one engineer is $180K per year.

| Cost item | Self-managed | Managed service |
|---|---|---|
| Initial setup and migration | $60K | $30K |
| Infrastructure or service fees | $90K per year | $170K per year |
| Operations effort | 1.0 engineer, $180K per year | 0.25 engineer, $45K per year |
| Major version upgrade in year 2 | $40K | Included |
| **Three-year total** | **$910K** | **$675K** |

The self-managed infrastructure bill is about half the managed service's fees, but the three-year total is higher, because operating the cluster takes an engineer's time that the managed service largely absorbs.

The staffing estimate is also the most uncertain input. If a team already experienced with the platform could run the cluster with half an engineer instead of a full one, the self-managed total drops to $640K, below the managed service. The infrastructure prices, which the team spent the most time researching, don't change the ranking across the ranges the team considered realistic. The staffing assumption does, which makes it the input to investigate before deciding, for example by asking teams who operate the same platform how much time it takes them.

{% include figure.html id="des-tco-staffing" %}

## Common Pitfalls

- **Pricing infrastructure and assuming people are free.** Operations, on-call, upgrades, and integration effort are often the largest costs, and leaving them out favors self-built and self-hosted options.
- **Salary instead of loaded cost.** Engineering time priced at salary alone understates people costs. Use the organization's loaded rate.
- **A horizon that ends before the costs arrive.** Upgrades, renewals, and hardware refreshes fall outside a one-year estimate.
- **Build estimates that stop at launch.** A built system needs a team for its whole life.
- **Ignoring exit costs.** Switching costs decide how expensive a wrong choice becomes.
- **Letting sunk costs count.** Money already spent on an existing system is gone whichever option is chosen. Compare only future costs of continuing against future costs of changing.
- **Single-number estimates.** One figure per item hides which assumptions the conclusion depends on. Estimate ranges and test the uncertain inputs.

## Quick Reference

| Step | Key question | Watch for |
|---|---|---|
| **Scope the options** | What are the real alternatives, including doing nothing? | Options described at different levels of detail |
| **List costs** | What will each option cost to acquire, run, change, and leave? | Missing people, integration, forced change, data transfer, and exit costs |
| **Choose a horizon** | How long will the organization live with this? | Horizons that end before upgrades and renewals |
| **Quantify** | What does each item cost, with what uncertainty? | Salary instead of loaded cost, single-point guesses |
| **Test assumptions** | Which inputs change the ranking of options? | Effort spent refining inputs that don't matter |
| **Record and revisit** | What was assumed, and did it hold? | Estimates never compared with actual spend |
