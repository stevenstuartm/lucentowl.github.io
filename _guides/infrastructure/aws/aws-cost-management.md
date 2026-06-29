---
title: "AWS Cost Management & Optimization for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "Comprehensive guide to AWS cost management covering Cost Explorer, Budgets, Compute Optimizer, Trusted Advisor, Savings Plans, Reserved Instances, and cost optimization strategies for achieving financial efficiency at scale"
tags: [aws, cost-optimization, budgets, cost-explorer, savings-plans, reserved-instances, finops, fundamentals]
---

## What Problems Cost Management Solves

AWS cost management tools address critical financial challenges in cloud infrastructure:

**Visibility into cloud spend**: Finance asks "Why did AWS cost $150,000 last month instead of $100,000?" Without cost visibility, you're guessing. Cost Explorer shows the $50,000 increase came from DynamoDB on-demand capacity in us-east-1, traced to a specific application team.

**Preventing budget overruns**: Development team spins up 50 r5.4xlarge instances for load testing and forgets to terminate them. Three weeks later, you discover $15,000 in unnecessary costs. AWS Budgets would have alerted you when spending exceeded $5,000, allowing immediate action.

**Right-sizing over-provisioned resources**: Your application runs on 20 m5.2xlarge instances (8 vCPU, 32 GB RAM). Compute Optimizer analyzes actual utilization and recommends m5.xlarge (4 vCPU, 16 GB RAM) instead. You cut compute costs by 50% without impacting performance.

**Eliminating waste**: Trusted Advisor identifies 200 unattached EBS volumes costing $2,000/month, 15 idle RDS instances costing $8,000/month, and S3 buckets with Intelligent-Tiering potential saving $5,000/month. Total waste: $15,000/month.

<div class="callout callout--tip">
<p class="callout__title">Commitment-Based Savings</p>
<p>Running steady-state workloads on On-Demand pricing costs $200,000/year. Savings Plans reduce the same workload to $120,000/year (40% savings) with no architectural changes.</p>
</div>

**Cost attribution across teams**: Organization has 30 development teams sharing AWS accounts. Without cost allocation, you can't tell which team drives costs. Cost allocation tags show Team A consumes 40% of budget, Team B consumes 25%, enabling accountability and chargeback.

**Detecting anomalies before they become expensive**: Misconfigured Lambda function triggers in infinite loop, invoking 10 million times per day. Cost Anomaly Detection alerts you within 24 hours when Lambda costs spike from $50 to $5,000/day, preventing a $150,000 monthly bill.

## Service Fundamentals

### AWS Cost Management Suite

AWS provides multiple integrated tools for cost management:

**Cost visibility**:
- **Cost Explorer**: Visualize and analyze costs and usage
- **Cost and Usage Report (CUR)**: Detailed billing data exported to S3

**Cost control**:
- **AWS Budgets**: Set cost and usage budgets with alerts
- **Cost Anomaly Detection**: Machine learning-based anomaly detection

**Optimization recommendations**:
- **Compute Optimizer**: Right-sizing recommendations for compute resources
- **Trusted Advisor**: Best practice checks including cost optimization

**Commitment instruments**:
- **Savings Plans**: Flexible pricing model with 1- or 3-year commitments
- **Reserved Instances**: Capacity reservation with discounted pricing

**Cost allocation**:
- **Cost Allocation Tags**: Tag resources for cost tracking
- **Cost Categories**: Organize costs into custom categories

### AWS Billing Dashboard

The billing dashboard provides high-level cost information:

**Month-to-date costs**: Current month spend vs forecast
**Last month costs**: Previous month final bill
**Cost breakdown by service**: Top services by cost
**Free tier usage**: Remaining free tier allowances
**Credits and discounts**: Applied promotional credits

**Forecasting**: AWS predicts end-of-month costs based on current usage trends.

## AWS Cost Explorer

Cost Explorer visualizes spending patterns and identifies cost drivers.

### Cost Explorer Interface

**Time range selection**: Last 6 months, last 12 months, custom date range, month-to-date, year-to-date

**Granularity**: Daily, monthly, or hourly (hourly requires Cost and Usage Report)

**Grouping dimensions**:
- Service (EC2, S3, RDS, etc.)
- Linked account (in AWS Organizations)
- Region
- Availability Zone
- Instance type
- Usage type
- Tag
- Cost category

**Filters**: Include/exclude specific services, accounts, regions, tags

### Cost Explorer Reports

**Built-in reports**:
- **Monthly costs by service**: See which services cost the most
- **Monthly costs by linked account**: Multi-account cost breakdown
- **Daily costs**: Granular daily spending trends
- **RI Utilization**: How much of Reserved Instance capacity is used
- **RI Coverage**: What percentage of usage is covered by RIs

**Custom reports**: Create reports with specific grouping, filtering, and time ranges. Save reports for reuse.

### Cost and Usage Reports

**Example**: Show EC2 costs by instance type for last month
1. Group by: Instance Type
2. Filter: Service = EC2
3. Time range: Last month

Result: Shows m5.large cost $5,000, t3.medium cost $3,000, c5.xlarge cost $8,000.

**Drill-down**: Click on c5.xlarge to see which accounts or tags drive that cost.

### Forecasting

Cost Explorer forecasts future costs based on historical usage:

**Forecast accuracy**: Becomes more accurate with more historical data (3-12 months recommended)

**Use cases**:
- Budget planning: "We'll spend approximately $120,000 next month"
- Trend analysis: "Costs increasing 10% month-over-month due to data transfer"
- What-if scenarios: "If we add 20 more instances, costs will increase by $15,000/month"

### Savings Opportunities

Cost Explorer identifies potential savings:

**RI recommendations**: Suggests Reserved Instance purchases based on usage patterns
**Savings Plans recommendations**: Suggests Savings Plans commitments
**Right-sizing recommendations**: Suggests smaller instance types for under-utilized resources

**Example**: Cost Explorer shows $50,000/month On-Demand EC2 spend with steady usage. RI recommendations suggest purchasing RIs for $30,000/month (saving $20,000/month or 40%).

## AWS Budgets

AWS Budgets monitors costs and usage against defined thresholds.

### Budget Types

**Cost budgets**: Track spending against a cost threshold
**Usage budgets**: Track service usage against a usage threshold (e.g., GB-months of S3 storage)
**RI utilization budgets**: Alert when RI utilization falls below threshold
**RI coverage budgets**: Alert when On-Demand usage exceeds desired percentage
**Savings Plans utilization budgets**: Track Savings Plans utilization
**Savings Plans coverage budgets**: Track On-Demand vs Savings Plans coverage

### Budget Configuration

**Example**: Monthly cost budget
```
Budget name: Production Environment Budget
Budget amount: $50,000 per month
Scope: Filter by tag Environment=Production

Alert thresholds:
  - 80% of budget ($40,000): Email to engineering lead
  - 100% of budget ($50,000): Email to engineering lead and CFO
  - 120% of budget ($60,000): SNS notification triggering Lambda to stop non-critical instances
```

**Forecast-based alerts**: Alert when forecasted costs will exceed budget, not just when actual costs exceed.

Example: Today is the 15th. Actual spend is $30,000 (60% of budget). Forecast predicts $65,000 by month-end (130% of budget). Forecast alert triggers now, allowing corrective action before month-end.

### Budget Actions

Budgets can automatically execute actions when thresholds are exceeded:

**IAM policy application**: Apply restrictive IAM policy to prevent new resource creation
**SCP application**: Apply Service Control Policy in AWS Organizations
**Stop EC2/RDS instances**: Automatically stop non-critical instances

**Example action**:
```
Threshold: 100% of budget
Action: Apply IAM policy that denies RunInstances except for critical production services
Effect: Development teams cannot launch new instances until next month
```

**Manual approval**: Require approval before executing action (recommended for production environments).

### Budget Notifications

**Notification recipients**:
- Email addresses
- SNS topics (can trigger Lambda, send to Slack, PagerDuty, etc.)

**Notification frequency**: Alert once per threshold crossing or every time budget is evaluated.

**Example notification workflow**:
1. Budget threshold exceeded
2. SNS notification sent
3. Lambda function triggered
4. Lambda posts to Slack channel and creates Jira ticket
5. Engineering team investigates and optimizes costs

## AWS Compute Optimizer

Compute Optimizer uses machine learning to recommend optimal AWS resources.

### Supported Resources

**EC2 instances**: Right-size instance types
**Auto Scaling groups**: Right-size ASG instance types
**EBS volumes**: Optimize volume type and size
**Lambda functions**: Optimize memory allocation
**ECS tasks on Fargate**: Optimize CPU and memory

### How Compute Optimizer Works

**Data collection**: CloudWatch metrics (CPU, memory, network, disk) collected for 14 days minimum (90 days recommended for better accuracy)

**Analysis**: Machine learning models analyze utilization patterns

**Recommendations**: Suggests instance types or configurations that match workload requirements

**Savings estimation**: Estimates monthly savings from implementing recommendations

### EC2 Instance Recommendations

**Recommendation types**:
- **Over-provisioned**: Current instance too large; recommend smaller instance
- **Under-provisioned**: Current instance too small; recommend larger instance (rare, but happens)
- **Optimized**: Current instance appropriately sized
- **None**: Insufficient data for recommendation

**Example**:
```
Current: m5.2xlarge (8 vCPU, 32 GB RAM) - $280/month
CPU utilization: 15% average, 30% p99
Memory utilization: 40% average, 60% p99

Recommendation: m5.large (2 vCPU, 8 GB RAM) - $70/month
Projected CPU utilization: 60% average
Projected memory utilization: 85% average

Monthly savings: $210 (75% reduction)
```

**Performance risk**: Compute Optimizer indicates risk level (Very Low, Low, Medium, High) when downsizing.

### Lambda Function Recommendations

Compute Optimizer recommends Lambda memory configuration:

**How it works**: Lambda memory determines CPU allocation. Over-provisioned memory wastes money; under-provisioned memory increases duration (also costly).

**Example**:
```
Current: 1,024 MB memory - 500ms average duration - $50/month
Memory utilization: 256 MB (25%)

Recommendation: 512 MB memory - 520ms average duration - $26/month
Monthly savings: $24 (48% reduction)
```

Memory halved, duration slightly increased, net cost reduction due to lower memory allocation cost.

### EBS Volume Recommendations

**Volume type optimization**: gp2 → gp3 (cheaper and faster)
**Volume size optimization**: 500 GB provisioned, 100 GB used → recommend 150 GB

**Example**:
```
Current: gp2 500 GB - $50/month
Actual usage: 100 GB

Recommendation: gp3 150 GB - $12/month
Monthly savings: $38 (76% reduction)
```

### Enabling Compute Optimizer

**Opt-in required**: Compute Optimizer is not enabled by default. Opt in via console or API.

**Permissions**: Compute Optimizer needs CloudWatch metrics access and EC2 describe permissions.

**Cost**: Compute Optimizer is free. Pay only for CloudWatch metrics and EBS snapshots if enhanced infrastructure metrics enabled.

## AWS Trusted Advisor

Trusted Advisor provides best practice checks across five categories.

### Five Pillars

**Cost Optimization**:
- Idle RDS instances
- Unattached EBS volumes
- Low utilization EC2 instances
- Unused Elastic IPs
- Underutilized EBS volumes

**Performance**:
- High utilization EC2 instances
- Large number of rules in security groups
- CloudFront content delivery optimization

**Security**:
- Security group rules allowing unrestricted access
- IAM password policy
- MFA on root account
- S3 bucket permissions

**Fault Tolerance**:
- EBS snapshots
- RDS backups
- Multi-AZ deployments
- Route 53 health checks

**Service Limits**:
- VPC limits
- EC2 instance limits
- RDS limits
- EBS limits

### Support Plan Requirements

**Basic/Developer support**:
- 7 core checks (limited security and service limit checks)

**Business/Enterprise support**:
- All checks (115+ checks)
- Weekly refresh
- CloudWatch integration (create alarms on Trusted Advisor check status)
- Programmatic access via API

### Cost Optimization Checks

**Low utilization EC2 instances**:
- CPU ≤ 10% for 14 days
- Network I/O ≤ 5 MB for 14 days
- Recommendation: Stop, downsize, or terminate

**Idle RDS instances**:
- No connections for 7 days
- Recommendation: Stop or delete

**Unattached EBS volumes**:
- Volume not attached to instance
- Recommendation: Delete (after creating snapshot if needed)

**Unused Elastic IPs**:
- Elastic IP not associated with running instance
- Cost: $0.005/hour = $3.60/month per unused EIP
- Recommendation: Release

**Underutilized EBS volumes**:
- gp2 volumes with low IOPS usage
- Recommendation: Convert to gp3 or downsize

### Trusted Advisor Notifications

**Weekly email digest**: Summary of check status changes

**CloudWatch Events/EventBridge integration**:
- Trigger Lambda when check status changes
- Create CloudWatch alarms on check metrics

**Example**: Trusted Advisor detects 50 unattached EBS volumes. EventBridge rule triggers Lambda function that:
1. Checks volume last attach time
2. Creates snapshot if volume is older than 30 days
3. Deletes volume
4. Sends Slack notification with cost savings

## Savings Plans

Savings Plans provide flexible pricing with 1- or 3-year commitments.

### Savings Plans Types

**Compute Savings Plans**:
- Applies to EC2, Fargate, Lambda
- Flexible across instance family, size, OS, tenancy, region
- Up to 66% savings over On-Demand

**EC2 Instance Savings Plans**:
- Applies to EC2 only
- Flexible across instance size, OS, tenancy within instance family and region
- Up to 72% savings over On-Demand

**SageMaker Savings Plans**:
- Applies to SageMaker usage
- Up to 64% savings

### How Savings Plans Work

**Commitment**: Agree to spend $X per hour for 1 or 3 years (e.g., $10/hour = $87,600/year)

**Application**: Savings Plans discount applies automatically to eligible usage up to commitment amount. Usage beyond commitment charged at On-Demand rates.

**Example**:
```
Commitment: $10/hour Compute Savings Plan (3-year, No Upfront)
Hourly usage: $15/hour

With Savings Plan:
  - First $10/hour: Covered by Savings Plan (66% discount)
  - Remaining $5/hour: On-Demand pricing
  - Effective cost: $10 (commitment) + $5 (On-Demand) = $15/hour

Annual cost: $131,400 vs $175,200 On-Demand (25% savings)
```

If usage is $8/hour (less than commitment):
- Only $8/hour covered by Savings Plan
- $2/hour commitment unused (no refund, but still pay for commitment)

### Payment Options

**No Upfront**: Pay nothing upfront, monthly charges for commitment
**Partial Upfront**: Pay 50% upfront, lower monthly charges
**All Upfront**: Pay entire commitment upfront, maximum discount

**Discount levels** (Compute Savings Plans, 3-year):
- No Upfront: 54% savings
- Partial Upfront: 60% savings
- All Upfront: 66% savings

**Cash flow considerations**: All Upfront maximizes savings but requires upfront capital. No Upfront spreads cost over time.

### Savings Plans Recommendations

Cost Explorer provides Savings Plans recommendations:

**Recommendation parameters**:
- Lookback period: 7, 30, or 60 days
- Savings Plans term: 1-year or 3-year
- Payment option: No Upfront, Partial Upfront, All Upfront

**Recommendation output**:
- Recommended hourly commitment
- Estimated savings
- Upfront payment (if applicable)
- Coverage percentage

**Example recommendation**:
```
Recommended: $50/hour Compute Savings Plan (3-year, All Upfront)
Upfront payment: $876,000
On-Demand equivalent: $1,576,800/year
Annual savings: $700,800 (44% savings)
Coverage: 95% of current EC2/Fargate/Lambda usage
```

### Savings Plans Best Practices

**Analyze steady-state workload**: Apply Savings Plans to consistent usage, not spiky workloads.

**Start conservative**: Purchase lower commitment, monitor utilization, buy additional Savings Plans if needed.

**Layer commitments**: Purchase multiple Savings Plans over time as usage grows.

**Monitor utilization**: Target 95%+ utilization. Below 90% means over-committed.

## Reserved Instances

Reserved Instances provide capacity reservation with discounted pricing.

### RI Types

**Standard Reserved Instances**:
- Up to 72% savings
- Cannot change instance family
- Can change instance size within family, Availability Zone, network type

**Convertible Reserved Instances**:
- Up to 54% savings
- Can exchange for different instance family, OS, tenancy
- More flexibility, less discount

**Scheduled Reserved Instances** (deprecated):
- Reserve capacity for specific time windows
- AWS no longer sells new Scheduled RIs

### RI Attributes

**Instance type**: m5.large, c5.xlarge, etc.
**Region or Availability Zone**: Regional (applies to any AZ in region) or zonal (specific AZ with capacity reservation)
**Tenancy**: Default (shared hardware) or Dedicated (single-tenant hardware)
**Operating system**: Linux, Windows, RHEL, SUSE, etc.
**Term**: 1-year or 3-year
**Payment option**: No Upfront, Partial Upfront, All Upfront

### RI Application

**Regional RIs**: Apply discount to any instance matching family/size/OS/tenancy in region, regardless of AZ. No capacity reservation.

**Zonal RIs**: Apply discount to instances in specific AZ. Includes capacity reservation (ensures capacity available when launching instances).

**Instance size flexibility** (Linux, regional RIs only):
- One m5.xlarge RI covers two m5.large instances or four m5.medium instances
- Normalization factor based on instance size

### RI Marketplace

**Sell unused RIs**: If needs change, sell Standard RIs on RI Marketplace
**Buy discounted RIs**: Purchase RIs from other AWS customers at potentially lower prices

**Restrictions**:
- Only Standard RIs (Convertible RIs cannot be sold)
- Minimum 30 days owned before selling
- Seller receives proceeds minus 12% AWS service fee

### RIs vs Savings Plans

**When to use RIs**:
- Need capacity reservation (zonal RIs)
- Predictable, steady workload on specific instance types
- Want maximum discount (Standard RIs up to 72%)

**When to use Savings Plans**:
- Workload uses multiple instance families
- Workload spans EC2, Fargate, and Lambda
- Want flexibility to change instance families
- Multi-region workloads

**Hybrid approach**: Use both RIs (for specific critical workloads requiring capacity reservation) and Savings Plans (for general compute spend).

## Cost Allocation Tags

Cost allocation tags enable granular cost tracking and attribution.

### Tag Types

**AWS-generated tags**:
- `aws:createdBy`: IAM user/role that created resource
- `aws:cloudformation:stack-name`: CloudFormation stack name
- Automatically applied by AWS

**User-defined tags**:
- Custom tags applied to resources
- Examples: `Environment`, `Team`, `Project`, `CostCenter`, `Application`

### Activating Cost Allocation Tags

**Steps**:
1. Tag resources with consistent tagging strategy
2. Activate tags in Billing console (tags won't appear in cost reports until activated)
3. Wait 24 hours for tags to appear in Cost Explorer and reports

**Tag propagation**: Tags propagate from CloudFormation stacks to resources, from ASGs to instances, etc.

### Tagging Strategies

**Hierarchy-based tagging**:
```
Organization: Acme Corp
  Business Unit: Engineering
    Team: Platform
      Application: API Gateway
        Environment: Production
```

Tags:
- `BusinessUnit: Engineering`
- `Team: Platform`
- `Application: API-Gateway`
- `Environment: Production`
- `CostCenter: 12345`

**Use case**: Finance wants Engineering cost breakdown by team. Cost Explorer groups by `Team` tag, showing Platform team costs $50,000/month, Frontend team costs $30,000/month, Data team costs $70,000/month.

### Tag Policies

**AWS Organizations Tag Policies** enforce tagging standards:

**Example policy**:
```json
{
  "tags": {
    "Environment": {
      "tag_key": {
        "@@assign": "Environment"
      },
      "tag_value": {
        "@@assign": ["Production", "Staging", "Development"]
      },
      "enforced_for": {
        "@@assign": ["ec2:instance", "s3:bucket", "rds:db"]
      }
    }
  }
}
```

Prevents creating EC2 instances, S3 buckets, or RDS databases without `Environment` tag with valid value.

## Cost Anomaly Detection

Cost Anomaly Detection uses machine learning to identify unusual spending patterns.

### How It Works

**Baseline learning**: Analyzes historical spending patterns for each service, account, and cost category

**Anomaly detection**: Continuously monitors costs, detects deviations from baseline

**Alerting**: Sends notifications when anomalies detected

**Impact threshold**: Only alert for anomalies exceeding specified dollar amount (e.g., $1,000)

### Anomaly Monitors

**Monitor types**:
- **AWS services**: Detect anomalies per service (EC2, S3, RDS, etc.)
- **Linked accounts**: Detect anomalies per account in AWS Organizations
- **Cost categories**: Detect anomalies per custom cost category
- **Cost allocation tags**: Detect anomalies per tag value

**Example monitor**: Monitor Development team spending
- Monitor type: Cost allocation tag
- Tag: `Team=Development`
- Threshold: $500

If Development team typically spends $10,000/month and spending spikes to $18,000, anomaly detected and alert sent.

### Anomaly Alerts

**Alert recipients**:
- Email
- SNS topic (integrate with Slack, PagerDuty, Lambda, etc.)

**Alert frequency**: Daily, weekly, or immediately when anomaly detected

**Alert content**:
- Anomaly start date
- Impacted service or account
- Estimated cost impact
- Root cause analysis (which service, usage type, or region drove anomaly)

**Example alert**:
```
Anomaly detected in Production account
Service: Amazon DynamoDB
Date: 2025-11-15
Estimated impact: $12,000
Root cause: Increased DynamoDB on-demand read/write requests in us-east-1
Previous 30-day average: $3,000
Current: $15,000
```

### Root Cause Analysis

Cost Anomaly Detection identifies the specific cost driver:

**Example**: Overall account cost increased $20,000
- Root cause: EC2 data transfer increased from 5 TB to 50 TB
- Specific region: us-west-2
- Specific usage type: DataTransfer-Out-Bytes

This pinpoints the exact issue (e.g., misconfigured application sending excessive data to clients).

## Cost Optimization Strategies

### Compute Optimization

**Right-size instances**: Use Compute Optimizer recommendations to downsize over-provisioned instances. Savings: 20-50% of compute costs.

**Use Spot Instances**: For fault-tolerant workloads (batch processing, CI/CD, data analysis), use Spot Instances at 70-90% discount. Combine with On-Demand and Savings Plans for reliability.

**Auto Scaling**: Scale in during low-traffic periods. Example: Scale from 20 instances during business hours to 5 instances overnight. Savings: 40% of compute costs.

**Graviton instances**: Migrate to Graviton2/Graviton3 instances (arm64). Performance equivalent to x86 with 20% cost reduction.

**Lambda instead of EC2**: For infrequent workloads (< 2 hours/day), Lambda is cheaper than smallest EC2 instance. Example: Nightly data processing runs 30 minutes/day = $3/month Lambda vs $25/month t3.small EC2.

### Storage Optimization

**S3 Intelligent-Tiering**: Automatically moves objects between access tiers. Objects not accessed for 30 days move to Infrequent Access (40% cheaper). After 90 days, Archive Instant Access (68% cheaper).

**S3 Lifecycle policies**: Transition objects to Glacier after 90 days (85% cheaper than Standard), delete after 1 year.

**Delete unattached EBS volumes**: Identify with Trusted Advisor, delete volumes not attached for 30+ days. Typical savings: $2,000-10,000/month.

**EBS gp2 → gp3 migration**: gp3 is 20% cheaper than gp2 with better performance. Migrate all gp2 volumes to gp3.

**Compress data**: Enable compression in databases (RDS, Redshift), S3, EBS. Reduces storage and transfer costs.

### Database Optimization

**RDS right-sizing**: Use CloudWatch metrics to identify over-provisioned RDS instances. Downsize or use burstable instances (db.t3/db.t4g).

**Aurora Serverless v2**: For variable workloads, Aurora Serverless v2 scales capacity automatically. Pay only for consumed capacity.

**DynamoDB on-demand vs provisioned**: For unpredictable traffic, on-demand is cost-effective. For steady traffic, provisioned with Auto Scaling is cheaper.

**Read replicas in same region**: Cross-region replicas incur data transfer costs ($0.09/GB). Same-region replicas have no transfer charges.

**Delete unused databases**: Automated snapshots don't count; full databases do. Identify idle databases with Trusted Advisor, delete non-production databases.

### Network Optimization

**Data transfer costs**: Most expensive AWS costs. Minimize data transfer:
- Use CloudFront for content delivery (cheaper than EC2 data transfer)
- Keep data in same region (inter-region transfer costs $0.02/GB)
- Use VPC endpoints for S3/DynamoDB (no NAT gateway data transfer costs)

**NAT Gateway optimization**: NAT Gateway costs $0.045/hour + $0.045/GB data processed = $32/month + data charges. Alternatives:
- VPC endpoints for S3, DynamoDB (eliminates NAT Gateway data processing)
- NAT instance on t3.micro ($7/month) for low-traffic environments

**CloudFront for S3**: S3 data transfer costs $0.09/GB. CloudFront data transfer costs $0.085/GB to internet, $0/GB from S3 to CloudFront. Net savings on high-traffic websites.

### Savings Commitments

**Savings Plans for steady workloads**: 40-66% savings on EC2, Fargate, Lambda. Purchase conservatively (80% of usage) to avoid over-commitment.

**Reserved Instances for predictable workloads**: 50-72% savings on EC2, RDS, ElastiCache, Redshift, OpenSearch. Use for production databases and steady compute.

**Reserved Capacity for DynamoDB**: 50-75% savings on DynamoDB. Commit to specific read/write capacity for 1-3 years.

## Integration Patterns

### CloudWatch Alarms → Budget Actions

**Scenario**: CloudWatch alarm detects high CPU → Auto Scaling adds instances → costs increase unexpectedly

**Mitigation**: AWS Budgets monitors cost, triggers action when budget exceeded:
1. Forecast predicts budget overrun
2. Budget action applies IAM policy restricting Auto Scaling actions
3. Auto Scaling cannot add instances beyond current capacity
4. Engineering team notified to optimize application or increase budget

### Cost Anomaly Detection → Lambda → Slack

**Workflow**:
1. Cost Anomaly Detection detects $5,000 anomaly in EC2 spend
2. SNS notification triggers Lambda
3. Lambda queries Cost Explorer API for detailed breakdown
4. Lambda posts to Slack with anomaly details and affected resources
5. Team investigates and remediates

**Lambda code** (Node.js):
```javascript
const AWS = require('aws-sdk');
const axios = require('axios');

exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);

  const slackMessage = {
    text: `💰 Cost Anomaly Detected`,
    attachments: [{
      color: 'danger',
      fields: [
        { title: 'Service', value: message.rootCause.service, short: true },
        { title: 'Impact', value: `$${message.impact}`, short: true },
        { title: 'Region', value: message.rootCause.region, short: true },
        { title: 'Account', value: message.accountId, short: true }
      ]
    }]
  };

  await axios.post(process.env.SLACK_WEBHOOK_URL, slackMessage);
};
```

### EventBridge → Systems Manager Automation

**Scenario**: Trusted Advisor detects 100 unattached EBS volumes

**Automation**:
1. EventBridge rule triggers on Trusted Advisor check status change
2. Systems Manager Automation executes document:
   - Describe unattached volumes
   - For each volume older than 30 days:
     - Create snapshot
     - Tag snapshot with original volume metadata
     - Delete volume
   - Send summary report to SNS topic

**Savings**: 100 volumes × 100 GB × $0.10/GB = $1,000/month

### Cost Explorer API → Custom Dashboard

**Use case**: Executive dashboard showing cost trends, top services, budget status

**Implementation**:
- Lambda function scheduled daily
- Queries Cost Explorer API for cost data
- Queries AWS Budgets API for budget status
- Stores data in DynamoDB
- Frontend (React, QuickSight, Grafana) displays dashboard

**Metrics displayed**:
- Month-to-date spend vs budget
- Cost breakdown by service
- Cost breakdown by team (using tags)
- Savings Plans/RI utilization
- Top 10 cost drivers

## FinOps Best Practices

### Establish Cost Accountability

**Tagging enforcement**: Require all resources have tags for `Team`, `Environment`, `CostCenter`, `Application`

**Chargeback/showback**: Provide teams with monthly cost reports showing their spend

**Cost reviews**: Monthly or quarterly cost review meetings with engineering teams

**Budget ownership**: Each team owns budget, receives alerts, responsible for optimizations

### Automate Cost Governance

**Budgets with actions**: Prevent runaway spend by automatically restricting actions when budgets exceeded

**Tag policies**: Enforce tagging standards via AWS Organizations

**Service Control Policies**: Restrict expensive services or regions (e.g., deny launching GPU instances in non-approved accounts)

**Auto-termination**: Tag development resources with `AutoShutdown=True`, Lambda terminates nightly

### Continuous Optimization

**Weekly optimization reviews**: Review Compute Optimizer, Trusted Advisor recommendations weekly

**Automate optimizations**: Lambda functions automate safe optimizations (snapshot and delete unattached volumes, convert gp2 to gp3)

**RI/Savings Plans reviews**: Quarterly review to adjust commitments based on usage changes

**Cost anomaly triage**: Investigate and remediate anomalies within 24 hours

### Reporting and Visibility

**Executive dashboards**: High-level spend, trends, budget status for leadership

**Team dashboards**: Granular cost breakdown for engineering teams

**Cost allocation reports**: Monthly reports showing cost by team, project, environment

**Anomaly reports**: Daily reports summarizing detected anomalies and remediation actions

## When to Use AWS Tools vs Third-Party

### AWS Cost Management Strengths

**Use AWS-native tools when**:
- AWS-only environment (no multi-cloud)
- Budget-conscious (AWS tools are free or low-cost)
- Basic cost visibility and budgeting sufficient
- Tight integration with AWS services desired (CloudWatch, Lambda, EventBridge)
- Small to medium scale (<100 AWS accounts)

### Third-Party FinOps Platforms

**Consider CloudHealth, Cloudability, Apptio, Spot.io when**:
- Multi-cloud environment (AWS + Azure + GCP)
- Advanced cost allocation and chargeback required
- Sophisticated forecasting and anomaly detection needed
- Advanced governance and policy enforcement
- Large-scale organizations (100+ AWS accounts)
- Dedicated FinOps team

**Cost comparison**:
- AWS tools: Free (Compute Optimizer, Trusted Advisor, Cost Explorer) or low-cost (AWS Budgets $0.02/budget/day)
- Third-party: $10,000-100,000+/year depending on cloud spend

**Hybrid approach**: Use AWS tools for core functionality, third-party for advanced analytics and multi-cloud support.

## Common Pitfalls

### Not Activating Cost Allocation Tags

**Problem**: Tagged all resources with `Team` and `Project`, but tags don't appear in Cost Explorer.

**Cause**: Cost allocation tags must be activated in Billing console before appearing in cost reports.

**Solution**: Activate tags immediately after establishing tagging strategy. Tags take 24 hours to appear after activation.

### Over-Committing to Savings Plans

**Problem**: Purchased $100/hour Savings Plan. Usage drops to $60/hour. Still paying for $100/hour commitment with $40/hour unused.

**Cause**: Over-committed based on temporary high usage or didn't account for planned capacity reduction.

**Solution**:
- Start conservatively (commit to 70-80% of usage)
- Analyze 3-6 months of usage trends before purchasing
- Buy multiple smaller commitments over time instead of one large commitment

### Ignoring Compute Optimizer Recommendations

**Problem**: Paying $50,000/month for over-provisioned EC2 instances. Compute Optimizer recommends downsizing to save $20,000/month. Recommendations ignored.

**Missed opportunity**: $240,000/year in savings unclaimed.

**Solution**: Weekly review of Compute Optimizer recommendations. Automate safe optimizations, prioritize high-impact recommendations.

### Not Monitoring Budget Forecast Alerts

**Problem**: Budget set at $50,000/month. Actual spend is $35,000 on day 20, but forecast predicts $70,000 by month-end. Forecast alert not configured, team unaware until bill arrives.

**Cause**: Only configured actual spend alerts (80%, 100%), not forecast alerts.

**Solution**: Enable forecast-based alerts at 100% of budget. Alerts trigger mid-month when forecast predicts overrun, allowing corrective action.

### Unattached Resources Accumulating

**Problem**: 500 unattached EBS volumes costing $5,000/month. Developers create volumes for testing, terminate instances, leave volumes.

**Cause**: No automated cleanup process.

**Solution**:
- Enable Trusted Advisor checks
- Automate cleanup: Lambda function runs weekly, identifies volumes unattached for 30+ days, creates snapshots, deletes volumes
- Tag volumes with `AutoDelete=False` if they should be preserved

### Mixing Savings Plans and RIs Without Strategy

**Problem**: Purchased $50/hour Compute Savings Plan. Later purchased 20 m5.large RIs for same workload. RI discount applies first, leaving Savings Plan under-utilized.

**Cause**: Lack of coordination between RI and Savings Plans purchases.

**Solution**: Choose one commitment type per workload. Use Savings Plans for flexibility, RIs only when capacity reservation required. Don't mix on same workload.

### Not Using Cost Categories

**Problem**: Organization has 50 applications across 20 teams in 10 AWS accounts. Cost Explorer grouping by tags shows 1,000+ line items, impossible to understand.

**Cause**: No cost categories to aggregate related costs.

**Solution**: Create cost categories that map tags to business units:
- Cost Category: `Business Unit`
  - Engineering: Resources tagged `Team=Platform OR Team=Frontend OR Team=Backend`
  - Data: Resources tagged `Team=Data OR Team=Analytics`
  - Infrastructure: Resources tagged `Team=DevOps OR Team=Security`

Cost Explorer can then group by `Business Unit` category for high-level view.

### Ignoring Data Transfer Costs

**Problem**: Application in us-east-1 queries RDS read replica in eu-west-1, transferring 10 TB/month. Cross-region transfer costs $900/month.

**Cause**: Didn't consider data transfer when deploying multi-region architecture.

**Solution**: Keep application and database in same region. If multi-region required, use DynamoDB Global Tables (built-in replication) or replicate via DMS.

## Key Takeaways

**Cost visibility is the foundation**: Without visibility into what drives costs, optimization is guessing. Cost Explorer and cost allocation tags provide granular cost attribution by service, account, and team.

**Budgets prevent runaway spend**: AWS Budgets with forecast-based alerts detect budget overruns before month-end, allowing corrective action. Budget actions automatically restrict spending when thresholds exceeded.

**Right-sizing is low-hanging fruit**: Compute Optimizer identifies over-provisioned resources and estimates savings. Implementing recommendations typically saves 20-50% of compute costs with no application changes.

**Commitment-based discounts require analysis**: Savings Plans and Reserved Instances offer 40-72% savings but require commitment. Over-commitment wastes money; under-commitment misses savings. Start conservative and layer commitments.

**Automate cost optimization**: Manual optimization doesn't scale. Automate cleanup (unattached volumes, unused snapshots), right-sizing (Lambda memory), and governance (tag enforcement, budget actions).

**Cost anomaly detection prevents expensive surprises**: Machine learning-based anomaly detection identifies unusual spending within 24 hours, preventing $5,000 anomalies from becoming $150,000 monthly bills.

**Trusted Advisor identifies waste**: Idle databases, unattached volumes, unused Elastic IPs, and underutilized resources represent 10-30% of cloud spend. Trusted Advisor identifies these automatically.

**Tag strategy enables accountability**: Consistent tagging with `Team`, `Environment`, `CostCenter`, and `Application` enables cost allocation, chargeback, and team accountability. Enforce with tag policies.

**Data transfer is a hidden cost driver**: Cross-region transfer, NAT gateway processing, and EC2 data transfer to internet can represent 20-40% of total costs. Use VPC endpoints, CloudFront, and same-region architectures to minimize transfer.

**FinOps is a continuous practice**: Cost optimization is not one-time. Weekly reviews of recommendations, monthly budget analysis, quarterly Savings Plans adjustments, and continuous automation build a culture of cost awareness.

**AWS tools are comprehensive and free**: Cost Explorer, Compute Optimizer, Trusted Advisor, AWS Budgets, and Cost Anomaly Detection cover most cost management needs without third-party tools. Third-party platforms add value for multi-cloud and advanced analytics.

**Cost optimization requires cross-functional collaboration**: Engineering makes architectural decisions, finance sets budgets, leadership prioritizes initiatives. Regular cost reviews with all stakeholders align optimization efforts with business goals.
