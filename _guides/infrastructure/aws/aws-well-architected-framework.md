---
title: "AWS Well-Architected Framework"
layout: guide
category: AWS
subcategory: Foundations
description: "The six pillars of the AWS Well-Architected Framework, their design principles and best-practice areas, how a Well-Architected review runs, and how to trade one pillar against another deliberately."
tags: [well-architected-framework, well-architected-tool, design-principles, architecture-review, decision-making, fundamentals]
---

## What the Well-Architected Framework Is

The **AWS Well-Architected Framework** is AWS's set of design principles, best practices, and review questions for evaluating cloud architectures. It gives a team a consistent way to ask whether a design is secure, reliable, efficient, and affordable, and to record which of those it chose to favor.

### The Unit of Review Is a Workload

The framework reviews a **workload**, not an account or a single service. AWS defines the terms it uses at three sizes:

| Term | Meaning | Example |
|---|---|---|
| **Component** | The code, configuration, and AWS resources that together deliver against one requirement. Often the unit of technical ownership. | The order-processing service and its queue |
| **Workload** | A set of components that together deliver business value. The level business and technology leaders talk about. | An ecommerce website, a mobile app backend, an analytics platform |
| **Technology portfolio** | The collection of workloads the business needs to operate. | Every workload the company runs |

A review answers questions about one workload at a time, so decide the workload's boundary before starting. A shared platform, such as a central network or logging account, can be reviewed as a workload of its own.

### Guidance, Not a Checklist

The framework describes practices, not mandatory requirements. Every design decision trades something away, and the framework's job is to make that trade visible: what the workload is optimizing for and what it is accepting in return.

---

## How the Framework Is Organized

Each pillar has the same four layers, from general to specific:

- **Design principles.** A handful of principles that set the pillar's direction.
- **Best-practice areas.** The topics the pillar's questions are grouped into.
- **Questions.** Numbered per pillar, such as `SEC 2. How do you manage authentication for people and machines?`
- **Best practices.** The specific practices each question checks, numbered under it, such as `SEC02-BP01 Use strong sign-in mechanisms` and `SEC02-BP02 Use temporary credentials`.

The questions are what a review works through. The design principles and best-practice areas below are the map for reading them.

---

## The Six Pillars

### 1. Operational Excellence

AWS defines operational excellence as the ability to support development and run workloads effectively, gain insight into their operations, and continuously improve supporting processes and procedures to deliver business value.

**Design principles:**
- Organize teams around business outcomes
- Implement observability for actionable insights
- Safely automate where possible
- Make frequent, small, reversible changes
- Refine operations procedures frequently
- Anticipate failure
- Learn from all operational events and metrics
- Use managed services

**Best-practice areas:** organization, prepare, operate, evolve.

In practice, the pillar treats operations like software. Infrastructure and runbooks are defined as code and version controlled, deployments are small and reversible, and the team measures the workload through key performance indicators (KPIs) tied to business outcomes. Automation carries guardrails such as rate limits, error thresholds, and approvals, so an automated change can't do more damage than a manual one.

**Example decisions:**
- Defining infrastructure in CloudFormation or Terraform instead of creating it in the console
- Running CI/CD pipelines with automated tests
- Releasing with blue-green or canary deployments instead of all at once
- Building CloudWatch dashboards and alarms around business KPIs
- Using Step Functions for workflows that need a visible, auditable execution history
- Holding blameless post-incident reviews and sharing what was learned

---

### 2. Security

AWS describes the security pillar as how to take advantage of cloud technologies to protect data, systems, and assets in a way that can improve your security posture.

**Design principles:**
- Implement a strong identity foundation
- Maintain traceability
- Apply security at all layers
- Automate security best practices
- Protect data in transit and at rest
- Keep people away from data
- Prepare for security events

**Best-practice areas:** security foundations, identity and access management, detection, infrastructure protection, data protection, incident response, application security.

In practice, every authenticated request to an AWS API is evaluated against IAM policies, so identity is the first control. People and workloads use temporary credentials instead of long-lived keys. Data is encrypted at rest and in transit. CloudTrail records API activity, and detection services alert on suspicious behavior. Secrets stay out of code and logs.

**Example decisions:**
- Using IAM Identity Center for workforce access instead of IAM users with access keys
- Giving workloads (EC2, Lambda, ECS) IAM roles instead of long-lived access keys
- Requiring MFA for human users. AWS now enforces MFA for root users across all account types.
- Encrypting S3 buckets with KMS keys
- Storing database credentials in Secrets Manager
- Layering security groups, network ACLs, and PrivateLink
- Enabling GuardDuty for threat detection
- Putting WAF rules in front of CloudFront distributions and Application Load Balancers

---

### 3. Reliability

AWS defines reliability as the ability of a workload to perform its intended function correctly and consistently when it's expected to, including the ability to operate and test the workload through its total lifecycle.

**Design principles:**
- Automatically recover from failure
- Test recovery procedures
- Scale horizontally to increase aggregate workload availability
- Stop guessing capacity
- Manage change through automation

**Best-practice areas:** foundations, workload architecture, change management, failure management.

In practice, the workload is designed to survive the failure of individual components. An AWS **Region** is a geographic area, and each Region contains several isolated groups of data centers called **Availability Zones**. Deploying across multiple Availability Zones means losing one zone doesn't take the workload down. Auto Scaling absorbs demand spikes. Automated backups allow point-in-time recovery, and health checks replace failed instances without a person in the loop. The foundations area also covers limits that are easy to forget, such as service quotas and network topology (`REL 1` and `REL 2`).

**Example decisions:**
- Enabling Multi-AZ on RDS
- Running Auto Scaling groups across several Availability Zones
- Using load balancer health checks to route around failed targets
- Taking automated backups with a retention policy
- Using Route 53 health checks with failover routing
- Accepting eventual consistency where the business can tolerate it
- Injecting failures deliberately to test recovery

---

### 4. Performance Efficiency

AWS defines performance efficiency as the ability to use computing resources efficiently to meet system requirements, and to maintain that efficiency as demand changes and technologies evolve.

**Design principles:**
- Democratize advanced technologies
- Go global in minutes
- Use serverless architectures
- Experiment more often
- Consider mechanical sympathy

**Best-practice areas:** architecture selection, compute and hardware, data management, networking and content delivery, process and culture.

In practice, the pillar asks the team to match each resource to how the workload uses it. Mechanical sympathy means understanding how a service behaves, for example choosing a database by its access patterns. Caches and CDNs cut latency, and decisions rest on measured performance rather than assumptions. Consuming a capability as a managed service, such as a NoSQL database or media transcoding, lets the team skip learning to host it.

**Example decisions:**
- Running event-driven work on Lambda instead of always-on EC2 instances
- Choosing a compute-optimized or memory-optimized EC2 family to match the workload
- Serving global users through CloudFront
- Caching with ElastiCache or DynamoDB Accelerator (DAX)
- Picking RDS or DynamoDB based on access patterns
- Using S3 Transfer Acceleration for long-distance uploads
- Letting Aurora Auto Scaling add read replicas under load

---

### 5. Cost Optimization

AWS defines cost optimization as the ability to run systems to deliver business value at the lowest price point.

**Design principles:**
- Implement Cloud Financial Management
- Adopt a consumption model
- Measure overall efficiency
- Stop spending money on undifferentiated heavy lifting
- Analyze and attribute expenditure

**Best-practice areas:** practice Cloud Financial Management, expenditure and usage awareness, cost-effective resources, manage demand and supply resources, optimize over time.

In practice, the team pays for what it uses and can see who is spending what. AWS's own illustration of the consumption model is a development environment used 40 hours a week. Stopping it outside those hours cuts its running time from 168 hours to 40, a saving of about 75%. Right-sizing follows from the same principle, as do Savings Plans and Reserved Instances (discounts in exchange for committing to a level of usage) for steady work and Spot Instances (spare EC2 capacity at a discount, which AWS can reclaim at short notice) for interruptible work.

**Example decisions:**
- Buying Savings Plans for steady-state usage
- Using Lambda instead of always-on EC2 for infrequent tasks
- Scaling in during low traffic
- Moving infrequently accessed data to S3 Glacier storage classes
- Running fault-tolerant batch work on Spot Instances
- Right-sizing EC2 instances from CloudWatch utilization data
- Enabling S3 Intelligent-Tiering where access patterns are unknown
- Deleting unused EBS volumes and snapshots

---

### 6. Sustainability

AWS defines sustainability as the ability to continually improve sustainability impacts by reducing energy consumption and increasing efficiency across all components of a workload, by getting the most out of provisioned resources and minimizing the total resources required.

**Design principles:**
- Understand your impact
- Establish sustainability goals
- Maximize utilization
- Anticipate and adopt new, more efficient hardware and software offerings
- Use managed services
- Reduce the downstream impact of your cloud workloads

**Best-practice areas:** Region selection, alignment to demand, software and architecture, data, hardware and services, process and culture.

In practice, the pillar favors high utilization over idle headroom. AWS's example is that two hosts running at 30% utilization are less efficient than one host at 60%, because each host draws baseline power. Managed services help because AWS runs shared infrastructure at high utilization. Region choice counts too. The framework asks teams to choose a Region on both business requirements and sustainability goals.

**Example decisions:**
- Using Lambda or Fargate instead of over-provisioned EC2 instances
- Adding S3 Lifecycle rules that move data to colder storage classes
- Choosing instances on Graviton, AWS's Arm-based processors
- Weighing sustainability goals alongside business requirements when choosing a Region
- Caching results to avoid repeated computation
- Archiving or deleting data and resources nobody uses
- Storing analytical data in efficient formats such as Parquet instead of CSV

---

## Running a Well-Architected Review

### How AWS Recommends Running a Review

AWS describes a review as a lightweight process, taking hours rather than days, and as a blame-free conversation rather than an audit. AWS recommends that the team building the workload review it continually as the architecture changes, rather than waiting for a formal review meeting. Reviews matter most at key milestones:

- **Early in design**, before the team commits to decisions that are hard or impossible to reverse (AWS calls these one-way doors).
- **Before go-live.**
- **After significant architecture changes**, so the workload's qualities don't erode as features are added.

### The Well-Architected Tool

The **AWS Well-Architected Tool** is the console service for running reviews. There is no additional charge for it. You pay only for the AWS resources you run. A review in the tool works like this:

1. **Define the workload.** Give it a name, a description, and a review owner, and record its environment and Regions. Account IDs are optional.
2. **Choose the lenses.** A **lens** is a set of questions to measure the workload against. The Well-Architected Framework lens is applied automatically when you define a workload. The lens catalog adds AWS-official lenses for specific workload types, such as serverless applications, SaaS, and generative AI. Teams can also write **custom lenses** with their own questions, for example to encode internal governance rules.
3. **Answer the questions.** For each question, mark which best practices the workload follows. For two answers, AWS recommends recording the reason in the question's notes, which appear in the workload report. **Question does not apply to this workload** means it is irrelevant to this workload. **None of these** means it applies but the workload follows none of its practices.
4. **Read the risks.** Best practices the workload doesn't follow surface as **high-risk issues (HRIs)**, which AWS has found might significantly harm the business, and **medium-risk issues (MRIs)**, which might harm it to a lesser extent.
5. **Save a milestone.** A **milestone** records the state of the review at a point in the workload's life, such as design, go-live, or production, so later reviews can show what improved.

The tool then produces an improvement plan listing the open risks and the best practices that would close them.

### Acting on What the Review Finds

AWS calls its risk ratings guidelines only. A best practice might not suit the workload for a specific technical or business reason, and then the real risk can be lower than the tool shows. AWS suggests recording those reasons in the workload notes. When the team decides not to implement a best practice, it should record the business-level approval and the reasons too. The notes are where a deliberate trade-off gets written down. Once every remaining risk is either fixed or accepted this way, the team can set the workload's overall improvement status to **Risk Acknowledged**.

For the risks the team will fix, AWS suggests prioritizing by business context and by the impact each issue has on the team's day-to-day work. An issue that causes recurring operational work frees up time once it is fixed. Update the review as fixes land so it shows the architecture improving, and save a new milestone at each significant change.

---

## Trade-Offs Between Pillars

Improving one pillar often costs another. AWS's framework notes that security and operational excellence are generally not traded off against the other pillars. The trade-offs happen among reliability, performance efficiency, cost optimization, and sustainability, and they depend on business context. AWS's own examples:

- In a development environment, a team might favor sustainability and cost at the expense of reliability.
- In a mission-critical workload, a team might favor reliability and accept higher cost and sustainability impact.
- In ecommerce, performance can affect revenue directly, which justifies spending on it.

### Common Trade-Offs

| Choice | Gains | Costs |
|--------------|------|-----------|
| Managed services (RDS, AWS's managed relational database, instead of a self-managed database on EC2) | **Operational excellence:** automated backups, patching, and failover<br>**Reliability:** Multi-AZ deployment built in | **Cost:** a higher price than the EC2 capacity alone<br>**Performance:** less control over tuning |
| Multi-AZ deployments | **Reliability:** survives the loss of an Availability Zone | **Cost:** resources in more than one zone<br>**Performance:** added write latency, because each write is copied to the other zone before it is confirmed (synchronous replication) |
| Lambda instead of always-on EC2 | **Cost:** pay only for execution time<br>**Operational excellence:** no servers to manage<br>**Sustainability:** no idle capacity | **Performance:** cold starts, the delay while Lambda initializes a new execution environment, and a 15-minute limit per invocation on standard functions |
| Caching (CloudFront, ElastiCache) | **Performance:** lower latency<br>**Cost:** less load on the origin | **Operational excellence:** more components to run and monitor, and an invalidation strategy to get right |
| Savings Plans or Reserved Instances | **Cost:** up to 72% off On-Demand prices (EC2 Instance Savings Plans and Reserved Instances). Compute Savings Plans trade some of that discount (up to 66%) for flexibility across instance families and services. | **Cost:** a one- or three-year commitment that may not match changing needs |
| Multiple Regions | **Reliability:** survives a Regional outage<br>**Performance:** lower latency for distant users | **Cost:** resources in every Region<br>**Operational excellence:** more complex deployments and data synchronization |

### Making Trade-Offs Deliberately

The framework doesn't prescribe the answer. It asks the team to make the trade explicitly:

1. **Identify requirements.** What does the business need, in SLAs, compliance obligations, and budget?
2. **Evaluate options.** How does each service or pattern score against each pillar?
3. **Record the trade.** Write down what the design optimizes for and what it accepts as a cost, in the workload notes if you use the Well-Architected Tool.
4. **Revisit it.** Re-evaluate as requirements change or new services launch.

Consider a startup that favors cost and operational simplicity at launch, running in one Region with little redundancy. As its SLAs start to matter, it moves toward reliability and accepts the higher cost. Neither choice is wrong. The failure is making either one without writing it down.

---

## Key Takeaways

1. **The framework is a lens for decisions, not a compliance checklist.** It makes the trade in each design choice visible and asks you to own it.
2. **Review a workload, not an account.** The workload is the unit every question is asked about, so draw its boundary first.
3. **Security and operational excellence are generally not traded off.** The trade-offs happen among reliability, performance, cost, and sustainability.
4. **Favor pillars according to business context.** A development environment and a mission-critical production system should make opposite trades, and both can be well-architected.
5. **Review early and continually.** A review is a short, blame-free conversation, best held before one-way-door decisions, before go-live, and after major changes. The [AWS Well-Architected Tool](https://aws.amazon.com/well-architected-tool/){:target="_blank" rel="noopener noreferrer"} adds lenses for the workload type and milestones to measure progress.
6. **Record every trade-off in the workload notes.** A future team that finds Lambda where it expected EC2, or DynamoDB where it expected RDS, needs the reason. Without it, they tend to assume a mistake rather than a decision.
7. **Revisit decisions as the workload grows.** What made sense at launch may not at scale.
