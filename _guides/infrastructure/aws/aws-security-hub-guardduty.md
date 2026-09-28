---
title: "AWS Security Hub & GuardDuty for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "How GuardDuty detects active threats in API, network, DNS, and runtime activity, how Security Hub CSPM checks resources against security standards, and how Security Hub correlates their findings into prioritized exposures: protection plans, finding tuning, organization setup, automated response, and pricing."
tags: [guardduty, security-hub, threat-detection, cspm, extended-threat-detection, incident-response, practical]
---

## What Each Service Does

Three services share this ground, and each answers a different question.

**Amazon GuardDuty** answers "is something malicious happening?" It watches activity, such as API calls, network flows, DNS queries, and optionally what processes do inside instances and containers, and reports behavior that matches known threats or departs from the account's normal pattern. Stolen credentials used from an unfamiliar network, an instance talking to a cryptomining pool, and a bucket being read far faster than usual are GuardDuty findings.

**AWS Security Hub CSPM** answers "is anything configured against the rules?" It runs **controls**, individual automated checks such as "EC2 instances should require IMDSv2", against your resources, groups them into **standards** such as the CIS AWS Foundations Benchmark, and collects findings from other security services into one format. A bucket that allows public reads is a Security Hub CSPM finding even if nobody has touched it yet. CSPM stands for cloud security posture management. Until 2025 this service was simply called Security Hub.

**AWS Security Hub**, relaunched under that name in 2025 and generally available since December 2, 2025, answers "which of these problems matter most?" It correlates signals from Security Hub CSPM, GuardDuty, Amazon Inspector (software vulnerability scanning), and Amazon Macie (sensitive data discovery in S3) with what it knows about each resource, and reports the combinations that make a resource exploitable.

GuardDuty sees behavior and Security Hub CSPM sees configuration, so neither replaces the other. A well-configured account can still have its credentials stolen, and a badly configured one can go untouched for months. Security Hub sits above both.

---

## GuardDuty

### Foundational detection

When GuardDuty is turned on in a Region, it starts reading three **foundational data sources** from that Region: CloudTrail management events, VPC flow logs from EC2 instances, and DNS query logs from the Route 53 Resolver. It reads them through its own independent copies of those streams, so you don't need a trail, flow logs, or resolver query logging configured, and turning GuardDuty on doesn't change any of them. It also discards the data after extracting what it needs, so GuardDuty is no substitute for keeping your own logs. DNS coverage depends on instances using the AWS-provided resolver. Instances that send queries to a resolver you run, or to a public one, are invisible to this source.

GuardDuty compares the activity against threat intelligence, which includes lists of malicious IP addresses, domains, and file hashes, and against machine learning models of each account's normal behavior. Everything happens per Region. A Region where GuardDuty is off has no detection at all, and unused Regions are where an intruder with stolen credentials would launch resources unnoticed, so AWS recommends enabling it in every Region the account can use. GuardDuty replicates security-relevant events from global services such as IAM and STS into each enabled Region, so those Regions still build their own profiles of users and roles.

On top of individual findings, **Extended Threat Detection** looks for multi-stage attacks within an account over a rolling 24-hour window. It correlates weak signals, which mean little alone, with existing findings, and reports a whole sequence as one **attack sequence** finding, such as `AttackSequence:IAM/CompromisedCredentials` or `AttackSequence:EKS/CompromisedCluster`. It's on by default at no extra charge. The foundational sources cover some sequences, and others need the protection plans that supply their signals.

### Protection plans

Optional **protection plans** extend GuardDuty to other data sources:

| Plan | What it analyzes |
| --- | --- |
| **S3 Protection** | CloudTrail data events for S3, the object-level reads, writes, and deletes, to spot exfiltration and destruction |
| **EKS Protection** | Kubernetes audit logs from EKS clusters |
| **Runtime Monitoring** | Operating system events, such as processes, file access, and network connections, from a GuardDuty security agent on EKS, EC2, and ECS, including Fargate |
| **Malware Protection for EC2** | EBS volumes attached to an instance, scanned when a finding suggests malware or on demand |
| **Malware Protection for S3** | Newly uploaded objects in the buckets you choose, and usable without the rest of GuardDuty |
| **Malware Protection for AWS Backup** | EBS snapshots, AMIs, and AWS Backup recovery points |
| **RDS Protection** | Login activity on supported Aurora and RDS databases |
| **Lambda Protection** | Network activity of Lambda functions, starting with their flow logs |
| **AI Protection** | CloudTrail data events from Amazon Bedrock, Bedrock AgentCore, and SageMaker AI, such as anomalous model invocations |

When an account turns GuardDuty on for the first time, every plan except Runtime Monitoring starts enabled, inside a 30-day free trial. An account that enabled GuardDuty earlier doesn't get later plans automatically, so check the plan list when a new one launches rather than assuming coverage. Runtime Monitoring needs its agent on each workload, and GuardDuty can deploy and manage that agent for EKS, ECS on Fargate, and EC2.

### Findings

A finding's type name says what GuardDuty thinks happened, in the form `ThreatPurpose:ResourceTypeAffected/ThreatFamilyName.DetectionMechanism!Artifact`. `CryptoCurrency:EC2/BitcoinTool.B!DNS` means an EC2 instance queried a domain associated with Bitcoin activity. `Recon:EC2/Portscan` means an instance is scanning ports on other hosts. A detection mechanism of `.Custom` means the finding came from a threat list you supplied.

Each finding carries a severity from 1.0 to 10.0 in four bands:

| Severity | Range | Meaning |
| --- | --- | --- |
| **Critical** | 9.0–10.0 | An attack sequence may be in progress or recently happened |
| **High** | 7.0–8.9 | A resource is compromised and being used for unauthorized purposes |
| **Medium** | 4.0–6.9 | Activity departs from normal and may indicate a compromise |
| **Low** | 1.0–3.9 | An attempt that didn't succeed, such as a port scan |

Every attack sequence finding is Critical. When the same activity recurs, GuardDuty updates the existing finding and its occurrence count rather than creating new ones. A finding is either active or archived, and archiving, whether by hand or by a suppression rule, marks it as needing no further attention. GuardDuty keeps findings for 90 days. To keep them longer, export them to an S3 bucket in the same Region, encrypted with a KMS key, or send them onward through **EventBridge**, the AWS event bus, which routes each finding to targets such as Lambda functions or SNS topics.

### Tuning what GuardDuty reports

Three mechanisms shape the findings, and they work at different points.

**Custom Detection Rules** add detections. Most GuardDuty findings describe activity that is suspicious anywhere, but some actions, such as sharing an AMI outside the organization, deleting VPC flow logs, or signing in without MFA, are routine in one account and a sign of compromise in another. GuardDuty maintains a library of prebuilt rules for such actions, each evaluating CloudTrail management events, and you associate a rule with the accounts where the action shouldn't happen. A rule can run in **dry run** mode first, which emits CloudWatch metrics instead of findings and expires after 14 days, so you can measure how often it would fire before turning it live.

**Lists** change what GuardDuty detects. A **trusted list** names public IP addresses, CIDR ranges, and domains that GuardDuty should never report activity with, such as a partner's scanner. A **threat list** names ones it should always report, usually from your own threat intelligence or a third-party feed. Entity lists, the recommended form, accept IPv4 addresses, CIDR ranges, domains, and, in threat lists only, SHA-256 file hashes. The older IP address lists accept only addresses. Each account and Region can have one trusted entity list, one trusted IP list, and up to six threat lists, and a trusted entry wins when an address appears in both kinds.

**Suppression rules** change what happens to findings after detection. A rule matches findings by type and attributes and archives them automatically. The findings are still generated and kept for 90 days, but they aren't sent to Security Hub CSPM, to the S3 export, to Amazon Detective (the investigation service covered under Responding to Findings), or to EventBridge, and they don't start malware scans. Extended Threat Detection also ignores archived findings, so a broad rule, such as one that suppresses every EKS finding, can hide the steps of an attack sequence and prevent the sequence finding. Keep each rule narrow, pairing a finding type with the specific resource that explains it, such as `Recon:EC2/Portscan` limited to instances launched from your vulnerability scanner's AMI. AWS recommends creating them only for findings you have repeatedly confirmed as false positives.

---

## Security Hub CSPM

### Controls and standards

A **control** checks one configuration, such as whether S3 Block Public Access is on or whether an RDS instance is encrypted. A **standard** is a set of controls mapped to a framework. Security Hub CSPM offers AWS Foundational Security Best Practices, AI Security Best Practices, AWS Resource Tagging, the CIS AWS Foundations Benchmark, NIST SP 800-53 Revision 5, NIST SP 800-171 Revision 2, and PCI DSS, plus a service-managed standard that AWS Control Tower uses for its detective controls. With a multicloud connector it also checks Azure resources against the CIS Microsoft Azure Foundations Benchmark and an Azure best-practices standard. Passing a standard's controls is evidence toward an audit, not proof of compliance, since no automated check covers a whole framework.

Many controls belong to several standards. With **consolidated control findings** turned on, each control produces one finding per resource however many enabled standards include it. Without it, enabling three overlapping standards triples the findings for the shared controls. Turn it on whenever more than one standard is enabled.

### How the checks run

Most controls for AWS resources are evaluated by **service-linked Config rules**. "Service-linked" means Security Hub CSPM creates and manages them in your account, and you can see but not change them. They're named with a `securityhub-` prefix and don't count against your Config rule quotas. They depend on Config recording the resource types they check. If Security Hub is enabled alongside Security Hub CSPM, a service-linked configuration recorder takes care of this. If not, you must turn on Config recording in every account and Region where Security Hub CSPM runs, and AWS recommends recording global resource types, such as IAM, in one Region only to save cost. When a control's resource type isn't recorded, the control reports `WARNING` instead of evaluating anything, and the `Config.1` control fails. The Azure standards don't use Config.

Checks start within two hours of enabling a standard, most within 25 minutes. After that, each control runs either **change-triggered**, when Config records a change to the resource, or **periodic**, every 12 or 24 hours on a schedule you can't change.

Each enabled standard gets a **security score**, the percentage of its enabled controls that passed. Controls with no data yet are left out, and scores refresh every 24 hours. Security Hub CSPM ignores archived and suppressed findings when working out a control's status, so suppressing every failed finding for a control makes it pass and raises the score. A rising score shows improvement only if nobody is suppressing failures to get there.

### Findings and workflow

Security Hub CSPM findings use the **AWS Security Finding Format (ASFF)**, a JSON schema shared by its own control findings, by findings from integrated AWS services such as GuardDuty, Inspector, Macie, IAM Access Analyzer, and Firewall Manager, and by partner products that send findings in.

Each finding has a **workflow status** tracking the investigation:

| Status | Meaning |
| --- | --- |
| `NEW` | Not yet reviewed |
| `NOTIFIED` | The resource owner has been told, and action is theirs |
| `SUPPRESSED` | Reviewed, and no action is needed |
| `RESOLVED` | Fixed |

Control findings move to `RESOLVED` on their own when the check passes, and a `NOTIFIED` or `RESOLVED` finding returns to `NEW` if the check fails again. Separately, a finding's record state is `ACTIVE` or `ARCHIVED`, which its provider sets when the underlying issue no longer applies.

**Automation rules** change findings as they arrive. A rule matches on ASFF fields, such as account, resource tag, or control, and sets fields such as severity, workflow status, or a note. Typical rules raise the severity of anything tagged as business-critical, or suppress informational findings from sandbox accounts. They're created in the organization's administrator account, described under Across an Organization, up to 100 per Region, and apply to member accounts too. When findings from several Regions are aggregated into one home Region, also described there, rules are created only in that Region. To stop a control that doesn't apply to you, disable the control instead of suppressing its findings. Disabling stops the check and its charges, while suppression hides the result and still pays for it.

---

## Security Hub

### Exposure findings

Security Hub reads findings from Security Hub CSPM, GuardDuty, Inspector, Macie, and IAM Access Analyzer, along with an inventory of the resources they describe, and looks for combinations that make a resource exploitable. It sorts each contributing signal into **traits**: reachability, vulnerability, misconfiguration, sensitive data, and assumability, meaning whether an identity can take over a role. When a resource has enough traits, Security Hub creates an **exposure finding** for it. An EC2 instance reachable from the internet that also runs software with a vulnerability likely to be exploited is an exposure. Either signal alone might sit in a queue of thousands of findings. Together they're one prioritized problem, and the console's **attack path graph** shows how an attacker could get from the internet to that resource and what they could reach from it.

Security Hub also reports **unused access**, meaning IAM roles, users, access keys, and permissions not used in 90 days, through an IAM Access Analyzer it creates and manages. That analyzer runs in US East (N. Virginia), since IAM is global, and its findings are copied to every Region where Security Hub is enabled.

Security Hub's findings use the **Open Cybersecurity Schema Framework (OCSF)**, an open schema that many security vendors share, rather than ASFF. Integrations and automation that read ASFF from Security Hub CSPM keep working, but anything consuming the new findings has to read OCSF. It can open tickets in Jira Cloud or ServiceNow ITSM directly from findings or from automation rules. It can also cover Azure virtual machines, container images, function apps, and identities in the same views, priced like their AWS equivalents.

### Plans and what enabling it changes

Security Hub is sold as plans rather than per service. Prices below are for US East (N. Virginia):

| Plan | What it covers | Price |
| --- | --- | --- |
| **Essentials** | Security Hub CSPM's checks, Inspector vulnerability scanning of EC2 instances, container images, and Lambda functions, exposure and unused access findings, and the service-linked Config recorder | $3.75 a month per **resource unit**. One EC2 instance or Azure virtual machine is one unit, and so are 12 Lambda functions, 18 container images, or 125 IAM users and roles |
| **Threat analytics** add-on | GuardDuty's foundational detection, S3 Protection, and EKS Protection | $4.00 per million CloudTrail management events, and $0.55 per GB for the first tier of other data |
| **Lambda code scanning** add-on | Inspector's scanning of Lambda function code | Per resource |
| **Extended** | Curated partner products, such as endpoint and identity security, billed through AWS | Each partner product's own rates |

Enabling Security Hub is therefore a billing decision as well as a feature one. The Essentials capabilities can't be deselected, so turning it on starts CSPM checks and Inspector scanning on every covered resource, and the charges for included capabilities move from the individual services to Security Hub. GuardDuty plans outside the threat analytics add-on's listed coverage, such as Runtime Monitoring and Malware Protection, still need budgeting at GuardDuty's own rates.

Without Security Hub, each service bills on its own terms:

| Service alone | Main charges |
| --- | --- |
| **GuardDuty** | $4.00 per million CloudTrail management events, and $1.00 per GB of flow and DNS log data for the first 500 GB a month, with lower per-GB rates at higher volumes, plus each protection plan at its own rate |
| **Security Hub CSPM** | $0.0010 per check for the first 100,000 checks a month, and finding ingestion free for the first 10,000 events, then $0.00003 each, plus the Config configuration items, Config's per-change resource records, that its recorder generates |

Each service has a 30-day free trial per account and Region, so compare the estimates the trials produce against the per-resource price before choosing.

---

## Across an Organization

All three services run per account and per Region, and each is managed centrally through a **delegated administrator**, a member account that the organization's management account designates to run the service for everyone. Use a dedicated security account, not the management account, and use the same one for all three. Security Hub requires it to match Security Hub CSPM's administrator when that one is already a member account.

**GuardDuty** is Regional even in its administration. The management account designates the administrator in each Region, and it must be the same account in every Region. That account manages up to 50,000 members and sets **auto-enable**, either `ALL`, covering existing and new accounts, or `NEW`, covering only accounts that join afterward. `NEW` leaves existing accounts off, and it can also miss accounts that opt in to a Region after joining the organization, so `ALL` is the safer choice. The administrator's trusted and threat lists, suppression rules, and notification frequency apply to every member, and members can't change them.

**Security Hub CSPM** is managed with **central configuration**. From its **home Region**, the one Region where the administrator manages every Region's settings and data, the administrator writes configuration policies, stating which standards and controls are on, and applies them to the organization root, to organizational units (OUs), or to individual accounts. **Security Hub** is enabled and configured through AWS Organizations policies instead. Its organization setup can also turn on GuardDuty and Security Hub CSPM for members, but only as one-time deployments that don't reach accounts enabled later, so keep GuardDuty's own auto-enable in place.

Both hubs support **cross-Region aggregation**. Findings from **linked Regions** are replicated to the home Region, which some Security Hub CSPM APIs still call the aggregation Region. There the dashboards show everything, and automation rules and ticketing integrations are defined. Aggregation copies data but enables nothing. Each service must still be enabled, and is still billed, in every Region it monitors.

{% include figure.html id="aws-security-findings-flow" %}

---

## Responding to Findings

GuardDuty sends every active finding to EventBridge in the Region where it was generated. In the administrator account, EventBridge also receives findings from member accounts. New findings arrive within minutes. Later occurrences of an existing finding are batched every six hours by default, and the administrator can shorten that to one hour or 15 minutes. A rule that sends High and Critical findings to a response workflow matches on severity:

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "severity": [{ "numeric": [">=", 7] }]
  }
}
```

Both hubs publish to EventBridge under the source `aws.securityhub`. Security Hub CSPM emits a `Security Hub Findings - Imported` event for every new or updated ASFF finding, and Security Hub emits `Findings Imported V2`, one OCSF finding per event. In the home Region, both feeds include findings from linked Regions, which makes the home Region the single place to route findings from every integrated service. Match on the detail-type as well as the source, or a rule receives duplicate notifications. Security Hub CSPM also offers **custom actions**, console buttons that send selected findings to EventBridge as `Security Hub Findings - Custom Action` events, which suit responses a person should choose to run.

The usual automated responses are notification, ticketing, and containment. Containment for a compromised EC2 instance typically means tagging it, snapshotting its EBS volumes for investigation, detaching it from its Auto Scaling group and load balancer, and moving it to an isolation security group with no rules. A security group change doesn't cut connections the security group is already tracking, which continue until they time out. A network ACL rule that denies the instance's traffic ends them at once, but it applies to the whole subnet. Automate containment only where a false positive costs little. Disabling an access key named in a High credential finding is quick to undo if the finding was wrong, but isolating a healthy production instance is an outage. For deciding what happened, Amazon Detective builds a graph of the activity around a finding from the same logs.

---

## Common Pitfalls

- **GuardDuty on in some Regions only.** A Region without GuardDuty has no detection, and an attacker who notices will work there. Enable it in every Region, and prefer auto-enable `ALL` over `NEW`.
- **Broad suppression rules.** A suppressed finding never reaches Security Hub CSPM, EventBridge, or Extended Threat Detection. Suppress a finding type only for the specific resource that explains it.
- **Security Hub CSPM without Config recording.** Controls for unrecorded resource types report `WARNING` rather than failing, which is easy to read as "nothing wrong". Watch `Config.1`, or enable Security Hub so a service-linked recorder handles it.
- **Suppressing failures to raise the score.** Suppressed findings count as passing, so the score climbs while the resources stay misconfigured. Disable controls that don't apply, and fix or formally accept the rest.
- **Overlapping standards without consolidated findings.** Several standards share controls, and without consolidation each one produces its own copy of every shared finding.
- **Custom DNS resolvers.** Instances that don't use the AWS-provided resolver are invisible to GuardDuty's DNS analysis. Account for that gap, or run Runtime Monitoring, which sees DNS activity from inside the workload.

---

## Key Takeaways

- GuardDuty detects malicious activity from behavior. Security Hub CSPM checks configuration against standards. Security Hub correlates both, with Inspector and Macie, into exposure findings.
- GuardDuty reads CloudTrail management events, VPC flow logs, and DNS logs on its own, with nothing to configure and nothing retained for you. Enable it in every Region, and add protection plans for the data and workloads you run.
- Extended Threat Detection turns related signals into one Critical attack sequence finding at no extra cost, and it can't see findings that suppression rules archive.
- Use Custom Detection Rules for actions that are suspicious only in some accounts, trusted and threat lists to change what GuardDuty detects, and narrow suppression rules only for confirmed false positives.
- Security Hub CSPM depends on Config recording, runs controls change-triggered or every 12 to 24 hours, and scores each standard by the share of its controls passing. Turn on consolidated control findings and disable controls you don't need.
- Security Hub findings are OCSF, while Security Hub CSPM's are ASFF. Enabling Security Hub moves billing for the included capabilities to its per-resource Essentials plan, with GuardDuty's foundational, S3, and EKS detection as the threat analytics add-on.
- Run all three from one delegated administrator security account, aggregate findings into one home Region, and route them through EventBridge to notification, tickets, and containment where a false positive is cheap.
