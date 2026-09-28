---
title: "AWS Cost Management & Optimization for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "How to see, control, and reduce AWS spend: Cost Explorer, cost allocation tags and cost categories, Data Exports, Budgets and budget actions, Cost Anomaly Detection, Compute Optimizer, Cost Optimization Hub, Trusted Advisor, and sizing Savings Plans and Reserved Instances commitments."
tags: [cost-analysis, savings-plans, reserved-instances, cost-explorer, compute-optimizer, cost-allocation-tags, fundamentals]
---

## Three Jobs

Cost management on AWS is three jobs, each with its own tools:

| Job | Question | Tools |
| --- | --- | --- |
| **See the spend** | Where is the money going, and who is spending it? | Cost Explorer, cost allocation tags, cost categories, Data Exports |
| **Catch surprises** | Is anything costing more than it should, right now? | Budgets, Cost Anomaly Detection |
| **Pay less** | What can be switched off, shrunk, or bought cheaper? | Compute Optimizer, Cost Optimization Hub, Trusted Advisor, Savings Plans, Reserved Instances |

The tools live in the AWS Billing and Cost Management console. In an AWS Organizations organization, the bill is consolidated in the **management account**, the account that owns the organization, and that account sees every member account's costs and activates tags for everyone. Any account can buy commitments, and by default their discounts are shared across the organization.

Cost data isn't live. It arrives in these tools up to about a day after the usage that caused it, which shapes what each tool can and can't catch.

---

## Seeing the Spend

### Cost Explorer

**Cost Explorer** charts cost and usage over time, filtered and grouped by service, account, Region, instance type, tag, cost category, or **usage type**, the kind of charge on a bill line, such as data transferred out or NAT gateway hours. It keeps daily and monthly data by default, and forecasts where the month or year is heading from the trend so far. Two things cost extra: its API, at $0.01 per request, and **hourly and resource-level data**, which show costs per hour or per individual resource for the last 14 days, billed at $0.01 per 1,000 usage records a month.

A typical investigation starts wide and narrows. The month's bill rose, so group by service, then filter to the service that grew and group by account, then by usage type, and the rise turns out to be data transfer in one account's NAT gateway. Cost Explorer can only show the breakdowns the data allows, which is why allocation matters.

### Cost allocation tags and cost categories

A **cost allocation tag** is a resource tag that billing data can be grouped by, such as `team`, `application`, or `environment`. Tags don't reach billing on their own. The management account activates each tag key, which can take up to 24 hours to appear for activation and another 24 to take effect. Costs are grouped by a tag only from activation onward, unless the management account requests a **backfill** of up to 12 months, and even then only for months when the resource already carried the tag. AWS also generates some tags itself, such as `aws:createdBy`, which records the identity that created a resource once it's activated.

Resource tags have two blind spots. Some costs can't be tagged at all, such as support and other subscription fees, upfront commitment payments, refunds, and credits, and untagged resources land in an unallocated bucket. **Account tags**, tags on the accounts themselves in AWS Organizations, can be activated for cost allocation too, and they attach to every cost in the account, including the untaggable ones. **Cost categories** map accounts, tags, services, and charge types into business groupings such as product lines or cost centers. Their split charge rules can divide shared costs among groups, though the split results appear only on the cost category's own page, not in Cost Explorer or the exports. For many organizations, one account per team or workload, with account tags, does most of the allocation work, and resource tags and cost categories divide what's shared.

### Data Exports

For analysis beyond Cost Explorer, **Data Exports** writes billing data to S3 on a schedule, with the columns and rows you choose. **Cost and Usage Report 2.0 (CUR 2.0)** is the recommended detailed export, down to individual resources and hours. Other exports provide the same data in the open **FOCUS** schema, used across cloud providers, and Cost Optimization Hub's recommendations. Athena, AWS's SQL query service for S3, can query the exports in place, and a prebuilt QuickSight dashboard can be deployed over them. The older Cost and Usage Report is still available as a legacy export.

---

## Catching Surprises

### Budgets

**AWS Budgets** tracks cost, usage, or commitment metrics against a threshold for a period, usually a month, and notifies people by email or through an SNS topic, which can fan out to chat or other systems. A budget can alert on **actual** spend passing a percentage of the budget, or on **forecasted** spend, which fires earlier. On the 10th, a forecast of 130% of budget is more useful than an actual alert on the 25th. Budgets can also track Savings Plans and Reserved Instance utilization and coverage, described under Paying Less.

A **budget action** does something when a threshold is crossed: apply an IAM policy or a service control policy (SCP), the organization-level permission guardrail, such as one that denies launching new instances, or stop chosen EC2 or RDS instances. Actions run automatically or after approval. An SCP can target another account, but instance actions only reach instances in the budget's own account.

Monitoring budgets is free. The first two budgets with actions are free, and each further one costs $0.10 a day. Because cost data lags by up to a day, a budget action is a brake, not a circuit breaker, and a runaway resource keeps running until the data catches up.

### Cost Anomaly Detection

**Cost Anomaly Detection** learns each monitored cost stream's normal pattern, including weekly and monthly seasonality and growth, and flags spend that departs from it, without anyone setting thresholds. It evaluates about three times a day, so an anomaly can take up to a day to surface, and a newly used service needs 10 days of history before it's monitored. Monitors can watch every AWS service separately, or specific accounts, cost allocation tags, or cost categories.

Alerts go by email in daily or weekly summaries, or individually, as each anomaly is found, to an SNS topic, which can reach Slack through Amazon Q Developer in chat applications. Each anomaly comes with its likely root causes ranked by dollar impact across service, account, Region, and usage type. A Lambda function stuck in a retry loop shows up as an anomaly in one account's Lambda duration and invocation costs. Cost Anomaly Detection doesn't watch most AWS Marketplace charges, which need a budget instead.

---

## Paying Less by Using Less

### Compute Optimizer

**AWS Compute Optimizer** reads a resource's utilization metrics from CloudWatch, AWS's monitoring service, and recommends a better-sized configuration, or flags it as idle:

- **Rightsizing** for EC2 instances, Auto Scaling groups, EBS volumes, Lambda memory, ECS services on Fargate, and Aurora and RDS for MySQL and PostgreSQL instances and storage, plus SQL Server licensing on EC2.
- **Idle** recommendations for many of those and for NAT gateways, provisioned DynamoDB tables, ElastiCache and MemoryDB clusters, DocumentDB clusters, SageMaker endpoints, and WorkSpaces.

By default it looks at the last 14 days. **Enhanced infrastructure metrics**, a paid option for EC2, Auto Scaling groups, and RDS, extends that to 93 days, which catches monthly peaks a two-week window misses. EC2 doesn't report memory use on its own. Without memory data, Compute Optimizer avoids recommending less memory, so an instance with memory to spare looks right-sized and the saving is missed. Memory data comes from the CloudWatch agent on the instance, or from Datadog, Dynatrace, Instana, or New Relic. Each recommendation carries a performance risk rating, and it's a starting point for a test, not a change to apply blindly. Compute Optimizer doesn't rightsize Spot Instances.

### Cost Optimization Hub

**Cost Optimization Hub** gathers recommendations from across accounts and Regions into one list: rightsizing and idle findings from Compute Optimizer, plus Savings Plans and Reserved Instance purchases. It estimates each saving using your actual prices, after existing discounts, and removes double counting between related recommendations. An idle instance can be deleted or rightsized but not both, so the hub counts only the larger saving. It also reduces a Savings Plan's estimated savings by the cost of idle instances that could be stopped, since stopping them shrinks the usage the plan would cover. Turned on in the management account, it covers the whole organization, and it's the natural starting list for a cost review.

### Trusted Advisor

**AWS Trusted Advisor** runs checks in six categories: cost optimization, performance, security, fault tolerance, service limits, and operational excellence. Its cost checks find things such as idle load balancers, unassociated Elastic IP addresses, and underused instances. Every account gets the service limit checks and a handful of security checks. The full set, and API access, come with Business Support+, Enterprise Support, or Unified Operations. The older Developer and Business Support plans end on January 1, 2027.

---

## Paying Less for the Same Usage

### How commitments work

**On-Demand** is AWS's default pricing, paid by the second or hour with no commitment. A **Savings Plan** is a commitment to spend a fixed amount per hour, such as $10, on eligible usage for one or three years, in exchange for lower rates. Each hour, AWS applies the commitment to eligible usage at the discounted rates, and anything beyond it is charged at On-Demand prices. If usage falls short, the unused part of the commitment is still billed. **Reserved Instances (RIs)** work similarly, but commit to specific instance attributes rather than a dollar amount. Most come with three payment options, no upfront, partial upfront, or all upfront, and paying more upfront earns a deeper discount. Database Savings Plans are the exception, one-year and no upfront only.

{% include figure.html id="aws-savings-plan-coverage" %}

The chart shows how the commitment level trades coverage against waste. Suppose a fleet uses between $12 and $27 an hour at On-Demand prices over a day, and a Savings Plan discounts it by 30%. A commitment of $8.40 an hour pays for $12 of On-Demand usage, the day's floor, so it's never idle and saves $3.60 every hour, $86.40 a day. The chart's line sits higher, at $15 of usage, a $10.50 commitment. It discounts more of the daytime usage, and in the six hours when usage dips below $15 it pays for some capacity nobody used, but it still saves $96 a day.

Raising a commitment pays off as long as the extra dollar is used in enough hours. At a 30% discount, each extra dollar of commitment has to be used in more than 70% of hours to save money. Here usage is at least $15 in 18 of 24 hours, so $15 wins, but it reaches $16 in only 16, so going higher would lose. The floor is the level that wastes nothing. The level that saves the most sits above it, and the deeper the discount, the higher it sits. Cost Explorer's purchase recommendations calculate that level from past usage.

### Choosing a commitment

| Commitment | Applies to | Maximum discount |
| --- | --- | --- |
| **Compute Savings Plans** | EC2 in any instance family, size, Region, OS, or tenancy (shared or dedicated hardware), plus Fargate and Lambda | Up to 66% on EC2, less on Fargate and Lambda |
| **EC2 Instance Savings Plans** | One EC2 instance family in one Region, any size, OS, or tenancy | Up to 72% |
| **Database Savings Plans** | Aurora, Aurora DSQL, RDS, DynamoDB, ElastiCache for Valkey, DocumentDB, Neptune, Keyspaces, Timestream, OpenSearch Service, and DMS, across engines and Regions. One-year term, no upfront | Up to 35% on serverless, 20% on provisioned instances |
| **SageMaker Savings Plans** | SageMaker AI instance usage | Varies by instance |
| **Standard Reserved Instances** | A specific instance family, platform, and tenancy, in a Region or one Availability Zone | Up to 72% |
| **Convertible Reserved Instances** | The same, but exchangeable for different attributes | Up to 66% |

Compute Savings Plans trade a few points of discount for freedom to change instance families, Regions, or move to containers and serverless, and suit most compute. EC2 Instance Savings Plans suit a family you're sure you'll keep in one Region. Database Savings Plans, launched in December 2025, bring the same idea to managed databases. Some services still use their own reservations, such as Redshift and MemoryDB reserved nodes.

Reserved Instances mainly matter for two things Savings Plans don't do. A zonal RI, scoped to one Availability Zone, also reserves capacity there, though **On-Demand Capacity Reservations** can reserve capacity without a term, and Savings Plans discount them. And Standard RIs can be resold on the Reserved Instance Marketplace if needs change. A Savings Plan can't be resold, but one with a commitment of $100 an hour or less can be returned within seven days of purchase, in the same calendar month, to undo a purchasing mistake. Spot Instances aren't covered by either, since they're already discounted.

### Sizing and managing commitments

Rightsize and remove idle resources before committing. A commitment sized to today's oversized fleet locks in paying for capacity that rightsizing would have removed, which is why Cost Optimization Hub discounts its Savings Plans estimates for idle instances it expects you to stop.

Cost Explorer recommends purchases from the last 7, 30, or 60 days of usage, and Cost Optimization Hub folds those recommendations in. A recommendation is a calculation on past usage, so weigh it against what's coming, such as a planned move to Graviton, AWS's Arm-based processors, or to containers or another Region, which a Compute Savings Plan survives and an EC2 Instance Savings Plan might not.

Commitments are usually bought in layers rather than all at once. Cover the steady floor first, then add smaller plans every few months as usage settles, so plans expire on staggered dates and each renewal can be resized. Track two numbers with Budgets or Cost Explorer. **Utilization** is how much of the commitment was used, and below 100% means money paid for nothing. **Coverage** is how much eligible usage ran under a commitment, and low coverage means On-Demand prices for usage that's steady enough to commit.

---

## Common Pitfalls

- **Tags created but never activated.** Resources are tagged, but no one activated the keys in the management account, so every report shows the spend as untagged. Activate keys when the tagging standard is adopted, and backfill if needed.
- **Committing before rightsizing.** A commitment sized to an oversized fleet keeps paying for capacity that rightsizing would remove. Rightsize first, then commit.
- **Committing to the average or the peak.** A commitment sized to average or peak usage sits unused for many hours, and you pay for them anyway. Commit to a level usage stays above in most hours, from the floor up to where the discount stops paying for the idle hours, and layer upward.
- **Treating a budget action as a kill switch.** It acts on day-old data. Pair budgets with anomaly detection and with quotas or SCPs that prevent runaway resources in the first place.
- **Rightsizing without memory data.** Without memory metrics, Compute Optimizer won't recommend less memory, so instances with memory to spare look right-sized. Install the CloudWatch agent or connect an observability tool before relying on EC2 recommendations.
- **Buying EC2 Instance Savings Plans before a migration.** A plan tied to one instance family and Region keeps charging when the workload moves to another family, to containers, or to Lambda. Compute Savings Plans follow the workload.
- **Ignoring data transfer.** Transfer between Availability Zones, through NAT gateways, and out to the internet is easy to miss in a service-level view. Group by usage type in Cost Explorer to find it.

---

## Key Takeaways

- Cost Explorer shows where spend goes. Allocation by account, activated resource and account tags, and cost categories decides whether it can show who spent it.
- CUR 2.0 through Data Exports is the detailed record for analysis in Athena or QuickSight.
- Budgets catch overruns against a plan, preferably on forecasts. Cost Anomaly Detection catches spend that departs from its own pattern. Both run on data up to a day old.
- Compute Optimizer and Cost Optimization Hub list rightsizing, idle, and commitment opportunities across the organization, priced after your discounts. Give Compute Optimizer memory data, or it won't recommend shrinking memory.
- Savings Plans commit dollars per hour, and Reserved Instances commit to instance attributes. Rightsize first, commit to a level used in most hours, layer commitments over time, and watch utilization and coverage.
- Compute Savings Plans suit most compute because they follow workloads across families, Regions, and services. Database Savings Plans cover managed databases. Zonal RIs are for reserving capacity.
