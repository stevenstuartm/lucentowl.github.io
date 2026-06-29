---
layout: case-study
title: "When Nobody Owns the Cloud Bill"
subtitle: "How strategic consolidation and right-sizing reduced IT monthly costs from $10,250 to $2,146"
description: "An infrastructure audit revealed unjustified costs from unused services, over-provisioned databases, and misconfigured storage. Strategic consolidation and right-sizing reduced monthly IT costs by 80% while funding critical security improvements."
role: "System Architect"
date: 2024-06-01
headline_metric: "80% Cost Reduction"
headline_detail: "$10,250 → $2,146/month"
category: "success"
category_label: "Optimization Win"
technologies:
  - AWS Aurora
  - Snowflake
  - DataDog
  - AWS ECS
  - AWS QuickSight
---

## The Problem

This is not a story of genius system analysis or innovative architectural decisions. This is about establishing the bare minimum standards for cloud infrastructure management.

When I joined, I began the long journey of exploring a system that had no documentation from the previous consulting team. From experience, I knew this was common and understood what I was getting into. After completing my initial macro-level assessment, I was puzzled: while there were numerous technical issues, I couldn't identify where the monthly cost of $10,250 was being spent.

The organization had a single small development team, a few products, approximately 120,000 users, and minimal third-party integrations. Why were the monthly software and IT operational costs so high? Or was my assumption of "high costs" incorrect and did I need more context?

As I gained deeper context, I became increasingly certain that the costs were unjustified.

## The Discovery Process

The audit took approximately six weeks from initial investigation to final implementation. I started where most cost investigations should start: the billing dashboard.

AWS Cost Explorer revealed the largest line items, but the real insights came from cross-referencing billing data with actual usage. Services that showed high costs but low utilization became immediate targets. I worked through the infrastructure in priority order based on monthly spend:

1. **External services first** (DataDog, Snowflake) — highest per-unit cost, easiest to evaluate
2. **Database layer** (Aurora clusters) — largest AWS expense, required architectural understanding
3. **Compute and caching** (EC2, ECS, ElastiCache) — right-sizing based on CloudWatch metrics
4. **Everything else** — systematic review of remaining services

For each service, I asked three questions: Is this being used? If yes, is it sized correctly? If yes, is it configured efficiently? Most waste came from the first two questions having unfavorable answers.

## The Solution

Most of the system components were hosted within AWS and were native AWS services or otherwise leveraged those services. The following sections detail each optimization in the order they were implemented, starting with the highest-impact changes.

### DataDog (Week 1)
DataDog was provisioned with nearly every feature available, yet not a single log or metric was being routed to it. No monitoring or observability use cases had been implemented. Since all organizational components were hosted in AWS and transaction volume was moderate, the decision was straightforward: eliminate it entirely. No one could explain why this service was ever provisioned.

While DataDog is valuable for large organizations with diverse data sources, it was inappropriate for a system entirely contained within AWS. Proper use of native AWS services provides comparable observability at a fraction of the cost.

### Snowflake (Weeks 1-2)
Snowflake presented a more complex challenge with multiple optimization opportunities. The platform was used for ETL processes from multiple sources and to normalize data for reporting via AWS QuickSight.

The issues were systemic: poorly written SQL queries, suboptimal table design, and redundant processes and storage. The most egregious problem involved Snowflake's Fail Safe feature, which is enabled by default for new tables. This feature retains deleted or updated data for 7 days. Numerous ETL jobs and reporting views would truncate tables and then repopulate them multiple times per day. Consequently, the majority of Snowflake costs were attributed to Fail Safe storage that served no actual business need.

Next: the AWS services and components.

### AWS Aurora (Weeks 2-4)
Four separate clusters existed, each intended to isolate data and scaling requirements for different domains and applications. While the concept was sound, the implementation was flawed in two critical ways:

1. Provisioning did not match actual usage requirements
2. The overhead of multiple databases was unjustified given the current service architecture and security/scaling needs. The system had low to moderate complexity, and the supposedly "distributed" components were often so tightly coupled that distribution provided no real benefit.

Fortunately, all reporting was handled by Snowflake using data primarily derived from third-party systems. This provided significantly more flexibility than typical for database restructuring.

The solution was consolidation into a single database. Security concerns were addressed by removing sensitive data from Aurora entirely, storing it instead in a dedicated third-party service that reduced our risk profile. Analysis revealed that data was replicated across multiple databases, further confirming tight coupling between applications and services. Post-consolidation, we gained a clearer view of the system architecture, positioning us to properly distribute data into optimal storage solutions when appropriate opportunities emerged.

### AWS QuickSight (Week 3)
QuickSight was being used for all reporting, as mentioned in the Snowflake section. Team members were surprisingly protective of this service, insisting that everything was properly configured and that changes would be too risky. While QuickSight does have design limitations that can create fragility, the cost issues were straightforward to resolve.

Two premium user packages had been purchased to increase the number of admin users and expand monthly session limits. Analysis revealed we only needed three admins and no user sessions beyond the free tier allocation.

SPICE storage was being used to cache Snowflake query results. While some queries were slow, they were only executed once daily. Eliminating SPICE caching was a simple change with no operational impact. Subsequently, we addressed the root cause by improving Snowflake query performance.

### AWS Support (Week 5)
AWS offers several support tiers to match organizational needs. The original team had limited AWS expertise, and the internal staff who inherited the system from consultants had even less. The high support costs appeared to be a rational response to managing an unstable system on an unfamiliar platform.

After implementing critical network and security improvements, we eliminated AWS Support costs entirely. The support plan could be re-enabled if needed, and given the improved system stability and our increased AWS competency, the risk of requiring it was minimal.

### Additional Optimizations (Weeks 4-6)
Additional savings came from numerous incremental improvements, tackled opportunistically as I worked through the larger changes:
- Right-sizing resource provisioning across ECS containers
- Removing obsolete EBS snapshots and RDS backups
- Eliminating unused CloudWatch metrics
- Migrating from Redis to Memcached for appropriate use cases
- Leveraging DynamoDB for ephemeral data and quick lookups
- Implementing intelligent tiering for S3 storage
- Shutting down abandoned EC2 instances (a classic)

Importantly, costs were strategically increased in several areas:
- CloudWatch logs to add API logging (previously non-existent)
- AWS VPN for secure database access
- WAF rules to enforce proper application security

This effort was not about indiscriminate cost reduction. It was about eliminating waste to fund investments in actual operational needs.

### Monthly Costs Before/After

**Total Monthly Cost Reduction: $10,250 → $2,146 (80% savings)**

| Service | Sub-Service | Before | After | Savings |
|:--------|:------------|---------------:|--------------:|----------------:|
| **DataDog** | | **$500** | **$0** | **$500** |
| | | | | |
| **Snowflake** | | **$800** | **$400** | **$400** |
| | | | | |
| **AWS Aurora** | | **$3,600** | **$490** | **$3,110** |
| | • Snapshots/Backups | $100 | $0 | $100 |
| | • I/O | $300 | $40 | $260 |
| | • Marketing Cluster | $400 | $0 | $400 |
| | • Ops Cluster | $400 | $0 | $400 |
| | • Data Cluster | $700 | $0 | $700 |
| | • App Cluster | $1,700 | $450 | $1,250 |
| | | | | |
| **AWS QuickSight** | | **$1,800** | **$90** | **$1,710** |
| | • User Packages | $1,100 | $90 | $1,010 |
| | • SPICE Storage | $700 | $0 | $700 |
| | | | | |
| **AWS Support** | | **$800** | **$0** | **$800** |
| | | | | |
| **AWS EC2** | | **$1,030** | **$391** | **$639** |
| | • Instances | $600 | $180 | $420 |
| | • NAT Gateway | $250 | $171 | $79 |
| | • EBS Volumes | $180 | $40 | $140 |
| | | | | |
| **AWS CloudWatch** | | **$360** | **$137** | **$223** |
| | • Logs | $60 | $137 | -$77 |
| | • Metrics | $300 | $0 | $300 |
| | | | | |
| **AWS VPN** | | **$0** | **$150** | **-$150** |
| | | | | |
| **AWS ECS** | | **$280** | **$110** | **$170** |
| | | | | |
| **AWS ElastiCache** | | **$280** | **$50** | **$230** |
| | | | | |
| **AWS Load Balancers** | | **$180** | **$55** | **$125** |
| | | | | |
| **AWS Data Transfer** | | **$170** | **$55** | **$115** |
| | | | | |
| **AWS Route53** | | **$170** | **$16** | **$154** |
| | | | | |
| **AWS S3** | | **$80** | **$22** | **$58** |
| | | | | |
| **AWS WAF** | | **$40** | **$100** | **-$60** |
| | | | | |
| **AWS Other** | | **$160** | **$80** | **$80** |

## Conclusion

Numerous additional technical issues were addressed during this cost optimization effort that are beyond the scope of this case study. Some of these more complex solutions may be covered in future case studies.

The root causes of this cost inefficiency were:
- Absence of business value assessment before technology decisions
- Lack of technical leadership and accountability
- Missing rationale documentation for architectural decisions
- No post-deployment review or optimization cycle

This initiative demonstrated that effective cost management is not about minimizing expenses. It's about eliminating waste to fund genuine operational requirements and security improvements.
