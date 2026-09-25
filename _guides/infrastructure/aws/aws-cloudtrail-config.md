---
title: "AWS CloudTrail & Config for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "How CloudTrail records who did what through AWS APIs and how Config records what resources look like and whether they comply: trails, event types, organization trails, log integrity, configuration recorders, rules, remediation, conformance packs, and aggregators, with their costs."
tags: [cloudtrail, aws-config, audit-logging, compliance, organization-trails, fundamentals]
---

## What CloudTrail and Config Do

The two services answer two different questions about an AWS account.

**AWS CloudTrail** answers "who did what, and when?" It records API calls made in the account, whether from the console, the CLI, an SDK, or an AWS service acting for you, with the caller's identity, time, source IP address, parameters, and result. It's the audit log for security investigations, compliance evidence, and tracing an unexpected change back to the person or role that made it.

**AWS Config** answers "what does this resource look like, what did it look like before, and does it meet our rules?" It records each resource's configuration and every change to it, keeps that history, and evaluates resources against rules such as "S3 buckets must block public access."

The two meet in the middle. A Config change record for a security group links to the CloudTrail event that caused it, so an investigation can go from "this rule became noncompliant" to "this role changed it at 14:02 from this address."

---

## CloudTrail

### Event types

CloudTrail records four kinds of events, and only the first is on by default:

| Type | What it records | Examples | Cost |
| --- | --- | --- | --- |
| **Management events** | Operations that create, change, or read the configuration of resources | `CreateBucket`, `RunInstances`, `AttachRolePolicy`, console sign-ins | First copy free, $2 per 100,000 for more |
| **Data events** | Operations on the data inside a resource, often very high volume | S3 `GetObject` and `PutObject`, Lambda `Invoke`, DynamoDB item operations | $0.10 per 100,000 |
| **Network activity events** | API calls made through a VPC endpoint, a private connection from a VPC to an AWS service, including calls the endpoint's policy denied | Calls to S3 or KMS from inside a VPC | $0.10 per 100,000 |
| **Insights events** | Unusual changes in the rate of API calls or errors, against the account's baseline | A spike in `AuthorizeSecurityGroupIngress` calls or in `AccessDenied` errors | Per insight type (call rate or error rate), $0.35 per 100,000 management events or $0.03 per 100,000 data events analyzed |

Data events are where costs grow. A busy S3 bucket can generate billions of data events a month, so log them selectively with **advanced event selectors**, which filter by resource type, specific bucket or function ARNs, read or write operations, and other fields. Log data events for the buckets, functions, and tables that hold sensitive data, not for everything.

### Event history and trails

Every account has **event history**, a free, searchable record of the last 90 days of management events in each Region, with no setup. It suits quick lookups, but it keeps only 90 days, covers one Region at a time, and holds no data, network activity, or Insights events.

For anything durable, create a **trail**, which delivers events as log files to an S3 bucket, usually within about five minutes of the API call, and optionally to CloudWatch Logs. A trail should cover every Region, since a single-Region trail misses activity elsewhere, which is exactly where an intruder would work unnoticed. Trails created in the console always cover all Regions, but the CLI, API, and infrastructure-as-code tools create single-Region trails unless the multi-Region setting is on, so set it explicitly.

### Organization trails

In an AWS Organizations organization, an **organization trail** logs every account in the organization, including accounts added later. It's created from the **management account**, the account that owns the organization, or from a **delegated administrator**, a member account given that responsibility. Member accounts can see the trail but can't change or delete it, so a compromised account can't turn off its own audit log. The usual layout sends it to a bucket in a dedicated **log archive account** that few people can access, as the figure in the Config section shows.

### Protecting the logs

An audit log is only as trustworthy as its protection:

- **Log file integrity validation** makes CloudTrail write an hourly **digest file**, signed by CloudTrail, containing hashes of the log files it delivered. Validating the digests later proves whether any log file was modified or deleted after delivery. Turn it on for every trail.
- **Encryption** with a customer managed KMS key, rather than the default S3-managed encryption, adds a second control, since reading the logs then also requires permission to decrypt with the key.
- **The bucket policy** should let CloudTrail write and allow almost no one to delete. **S3 Object Lock** in compliance mode, which makes objects undeletable by anyone until a retention date, or at least versioning with **MFA delete**, which requires a second factor to delete versions, keeps log files from disappearing.
- **Alarms on the trail itself.** An EventBridge rule, which matches events and triggers actions, or a CloudWatch alarm on `StopLogging`, `DeleteTrail`, and `UpdateTrail` catches attempts to blind the audit log.

### Querying the logs

Trail logs in S3 are compressed JSON files, one per delivery, so they're queried rather than read. **Amazon Athena** queries them in place with SQL. The CloudTrail console can create a basic, unpartitioned Athena table for a single-account trail, but not for an organization trail. For an organization trail, or for years of logs, create the table in Athena with **partition projection**, which computes each day's S3 location from a date range and path pattern you configure, so each query reads only the days it asks about without looking up partition metadata.

Sending the trail to **CloudWatch Logs** allows Logs Insights queries and **metric filters**, which turn matching events, such as console sign-ins without MFA or IAM policy changes, into metrics you can alarm on. CloudWatch Logs charges for ingestion and storage, so this suits management events more than high-volume data events.

**CloudTrail Lake**, a managed SQL store for events, closed to new customers on May 31, 2026. Existing customers keep using it, and AWS directs new customers to CloudWatch, which can ingest CloudTrail management and data events directly, though not network activity or Insights events, and needs enabling in each Region.

---

## AWS Config

### Recording configurations

Config's **configuration recorder** records each resource in scope as a **configuration item**, a snapshot of its settings, relationships to other resources, and the CloudTrail events behind the change. Each change adds a new item, building a **configuration timeline** you can view for any resource, such as every rule ever added to a security group. Config delivers configuration history and periodic snapshots to an S3 bucket.

Each account has one customer managed recorder per Region, and it must be turned on in every enabled Region. By default it records all supported resource types except the global IAM types, which should be recorded in one Region only so they aren't counted in every Region. It can record **continuously**, creating an item for every change, or **daily**, creating at most one item per resource per day, and only if the resource changed. Daily recording cuts cost for resources that change often but loses the intermediate changes.

Configuration items cost $0.003 each when recorded continuously, and $0.012 each when recorded daily. For most accounts the cost is modest, but resources that change constantly, such as auto-scaled EC2 instances, network interfaces in a busy cluster, or frequently rotated security group rules, can generate millions of items a month. Exclude such resource types, or record them daily, when their change history isn't needed.

Some AWS services, such as Security Hub, create their own **service-linked recorders** in addition, which record the resource types that service needs and are managed by that service rather than by you.

### Rules and remediation

A **Config rule** evaluates resources and marks each one compliant or noncompliant. Rules come in three forms:

- **AWS managed rules**, several hundred predefined checks, such as `s3-bucket-public-read-prohibited`, `encrypted-volumes`, or `iam-user-mfa-enabled`, some with parameters.
- **Custom Lambda rules**, a function you write that receives the configuration item and returns a result.
- **Custom policy rules**, written in **AWS CloudFormation Guard**, a declarative policy language, with no function to maintain.

A rule runs when a resource in its scope changes, on a schedule from every hour to every day, or both, and its scope can be narrowed by resource type or tag. Rules normally run in **detective** mode, evaluating resources that already exist. Some can also run in **proactive** mode, where a deployment pipeline step calls Config's API to ask whether a resource definition would comply before it's created. Config only reports the answer, and the pipeline decides whether to block. Few managed rules support proactive mode, while custom Guard rules can.

A noncompliant resource can be fixed by **remediation**, which runs a Systems Manager Automation runbook, such as one that turns on S3 Block Public Access or disables an unused access key. Remediation can run manually, when an operator approves it, or automatically, with retries. Automatic remediation fixes drift in minutes, but it fights anyone who changes the resource on purpose, and because it acts on the last compliance result, it can occasionally run against a resource that has since become compliant. Apply it to rules where the right state is never in doubt.

Rule evaluations cost $0.001 each for the first 100,000 a month. A rule scoped to a resource type that changes constantly evaluates constantly, so scope rules to the resources they're meant for.

### Conformance packs and aggregators

A **conformance pack** is a set of rules and remediation actions deployed and reported as one unit, written as a template. AWS provides sample packs mapped to frameworks such as the CIS AWS Foundations Benchmark, NIST 800-53, and PCI DSS, which make a starting point for compliance reporting, though mapping a framework's controls to rules is never complete. Rules in a pack are billed as conformance pack evaluations, $0.001 each for the first 100,000 a month, separately from other rule evaluations. Organization conformance packs and organization rules deploy the same set to every account, one Region per deployment.

An **aggregator** collects configuration and compliance data from many accounts and Regions into one Region of one account, usually the management account or a delegated administrator such as a security account, at no charge. With it, **advanced queries** answer inventory questions across the organization in SQL, such as every EC2 instance of a given type or every unencrypted volume, over current configuration data.

### Across an organization

Put together, organization-wide auditing looks like this:

{% include figure.html id="aws-org-audit-logging" %}

Unlike an organization trail, Config recorders aren't turned on for new accounts automatically. AWS Control Tower, CloudFormation StackSets, or Systems Manager Quick Setup deploy them to each new account and Region, and that step is easy to miss. An organization rule or conformance pack sent to a new account that has no recorder retries for only seven hours before giving up, and an account without a recorder reports no noncompliance at all, which looks the same as full compliance in an aggregator. Check recorder status across the organization, not just rule results.

---

## Common Pitfalls

- **Single-Region trails from code.** A trail defined in CloudFormation, Terraform, or the CLI without the multi-Region setting logs only its home Region. Set the flag in every template, and alarm on trails that lack it.
- **Unused Regions left unrecorded.** Resources created in a Region without a recorder never appear in Config, and attackers use unused Regions for that reason. Record in every enabled Region, or disable unused Regions with a service control policy (SCP), the organization-level permission guardrail.
- **Automatic remediation on rules with exceptions.** A rule that auto-remediates a resource some team changes on purpose reverts their change each time, often without anyone noticing. Use tag-based rule scopes to exempt those resources, or remediate manually.
- **Insights costs per insight type.** Turning on both call-rate and error-rate Insights, for management and data events, charges for each type on every event analyzed. Enable the types you'll act on.

---

## Key Takeaways

- CloudTrail records API activity, meaning who did what, when, and from where. Config records resource configuration over time and evaluates it against rules.
- Event history gives 90 days of management events for free. Durable audit logging needs a multi-Region trail, set explicitly when created from code, delivering to a protected S3 bucket.
- Management events are free for one copy. Data events can dominate cost, so select them with advanced event selectors.
- Use an organization trail and a log archive account, with integrity validation, KMS encryption, deletion protection, and alarms on changes to the trail.
- Query trail logs with Athena, using partition projection for organization trails, or CloudWatch. CloudTrail Lake is closed to new customers.
- Record Config in every enabled Region, record global IAM types once, and exclude or record daily the resource types that churn.
- Use managed rules, Guard rules, and conformance packs for compliance checks, remediate automatically only where the right state is unambiguous, and deploy recorders to new accounts deliberately.
