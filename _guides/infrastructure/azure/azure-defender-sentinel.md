---
title: "Microsoft Defender for Cloud and Sentinel"
layout: guide
category: Azure
subcategory: Security & Compliance
description: "A system architect's guide to Microsoft Defender for Cloud and Microsoft Sentinel covering cloud security posture management, Defender plan selection, SIEM and SOAR architecture, and the move to the unified Defender portal."
tags: [defender-for-cloud, microsoft-sentinel, siem, cspm, threat-detection, security-operations, practical]
---

## What Is Cloud Security Operations

Modern cloud environments require a different security approach than on-premises infrastructure. The attack surface expands continuously as resources scale, configurations drift, and cloud services introduce new capabilities. Two tools form the core of Azure's security operations platform: [Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction){:target="_blank" rel="noopener noreferrer"} and [Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/overview){:target="_blank" rel="noopener noreferrer"}.

Defender for Cloud is a cloud security posture management (CSPM) and cloud workload protection (CWP) platform. It discovers what you have, assesses it against security best practices, identifies misconfigurations and vulnerabilities, and recommends remediation. Think of it as continuous security auditing built into your infrastructure.

Sentinel is a cloud-native SIEM (Security Information and Event Management) and SOAR (Security Orchestration, Automation and Response) platform. It ingests logs and alerts from across your environment, correlates events to detect attacks, and automates incident response. Think of it as your security operations center in software.

Together, they create a complete security operations capability. Defender for Cloud identifies what could go wrong, Sentinel detects when something is actually going wrong, and both enable automated response.

### Where Each Service Lives

The two attach to Azure at different scopes, and that difference drives most of the architecture decisions in this guide.

Defender for Cloud is enabled **per subscription**. Its free posture capabilities turn on at the subscription level, and each paid Defender plan is enabled per subscription as well; a few plans also allow resource-level granularity. Findings roll up from there. Every subscription has its own Secure Score, and Defender for Cloud aggregates a weighted score across subscriptions and across management groups.

Sentinel is a **workspace** feature. You enable it on an Azure Monitor Log Analytics workspace, and that workspace lives in exactly one subscription and one region. Ingestion, retention, analytics rules, and incidents are all scoped to it. Feeding one Sentinel from twenty subscriptions means pointing twenty subscriptions' diagnostic settings and connectors at a workspace that sits inside one of them.

Both are also moving to the Microsoft Defender portal. Sentinel is generally available there today, and **after March 31, 2027** it is no longer supported in the Azure portal at all. That is not only a UI change. Incident creation, alert correlation, and which analytics rule types are available all shift once a workspace is onboarded to the Defender portal. Those differences are called out where they arise.

---

## Microsoft Defender for Cloud: Cloud Security Posture Management

### What Defender for Cloud Solves

**Without Defender for Cloud:**
- No visibility into misconfigurations across cloud resources
- Security best practices are checked manually or with external tools
- Vulnerability assessments require separate scanning solutions
- Compliance reporting requires manual evidence collection
- Security drift goes undetected until a breach or audit

**With Defender for Cloud:**
- Continuous assessment of all cloud resources against security baselines
- Automated discovery of security misconfigurations and vulnerabilities
- Secure Score provides a single metric for security posture improvement
- Built-in recommendations guide remediation prioritized by severity and impact
- Compliance mapping: the Microsoft cloud security benchmark applies at no charge; additional standards (CIS, PCI DSS, HIPAA, SOC 2) require the Defender CSPM plan
- Integration with other Azure services (Entra ID, Azure Policy, Update Management) for holistic security

### How Defender for Cloud Differs from AWS Security Hub CSPM

Both Azure and AWS provide unified security posture management, but they differ in scope and integration. Mind the naming first: in 2025 AWS renamed its posture service **Security Hub CSPM** and reused "AWS Security Hub" for a new unified security platform that correlates and prioritizes findings across services. The comparison below is against Security Hub CSPM, the posture-management service.

| Aspect | AWS Security Hub CSPM | Microsoft Defender for Cloud |
|--------|------------------|--------------------------|
| **Scope** | Read-only aggregator of security findings from other AWS services | Native cloud security posture service with own assessment engine |
| **Vulnerability scanning** | Requires integration with Amazon Inspector (separate service) | Built-in with optional Defender plans for servers, containers, databases |
| **Compliance frameworks** | Supports multiple frameworks (CIS, PCI-DSS, etc.) with evidence collection | Same frameworks, but better integrated with Azure Policy |
| **Threat detection** | Requires integration with Amazon GuardDuty (separate SIEM-like service) | Built-in threat protection with Defender plans |
| **Remediation automation** | Limited; mostly through AWS Config | Better integration with Azure automation and remediation runbooks |
| **Cost model** | Per-finding ingestion | Subscription-based Defender plans |
| **Hybrid support** | Limited to AWS | Strong hybrid/multi-cloud with on-premises servers support |

---

## Defender for Cloud Components

### Secure Score

Secure Score summarizes your posture as a single percentage. It is derived from the [Microsoft cloud security benchmark](https://learn.microsoft.com/en-us/security/benchmark/azure/introduction){:target="_blank" rel="noopener noreferrer"} (MCSB), which is applied by default the moment you enable Defender for Cloud on a subscription.

There are now two Secure Score models, and their numbers are not comparable:

| Model | Where it lives | How it scores |
|-------|----------------|---------------|
| **Classic Secure Score** | Azure portal | Control-based. Each MCSB security control carries a fixed maximum point value, and you earn a share of it proportional to how many of that control's in-scope resources are healthy. |
| **Cloud Secure Score (risk-based)** | Microsoft Defender portal | Asset-based, 0-100. Weights open recommendations by risk level, then factors in each asset's risk factors (internet exposure, data sensitivity) and its criticality to the organization. |

**How the classic score is computed:**
- A control's current score = (its maximum score ÷ its total in-scope resources) × its healthy resources
- A subscription's score is the sum of its control scores over the sum of the maximums, expressed as a percentage
- Only built-in MCSB recommendations count, and recommendations still in preview are excluded until they reach general availability
- Controls are recalculated every eight hours per subscription or cloud connector

**Important characteristics:**
- Each subscription has its own score, but scores do aggregate: Defender for Cloud computes a combined score across subscriptions and connectors weighted by resource count, and shows a score per management group. The combined figure is a weighted sum, not an average of the per-subscription percentages
- Maximum score depends on your environment. A control with no in-scope resources is excluded outright rather than counted as a zero
- A declining score means new risk, but it can also mean broader coverage. The June 2026 general availability of expanded multicloud coverage brought over 200 AWS and GCP recommendations into the score and moved many organizations' numbers without anything in their environment changing
- Score is used to prioritize which recommendations to implement first

Secure Score is strategic context, not an audit score. A high Secure Score means you have addressed most recommendations, but it does not guarantee your environment is secure. Security is multi-dimensional and requires ongoing assessment.

### Security Recommendations

Recommendations are specific actions to improve your security posture. Each recommendation includes:
- **Severity level** (Critical, High, Medium, Low) based on potential impact if exploited
- **Affected resources** with counts and specific identities
- **Remediation steps** with configuration guidance
- **Impact on Secure Score** when implemented
- **Related policies** that can automate enforcement

**Common recommendation categories:**
- **Access control:** Network isolation, least-privilege identities, MFA enforcement
- **Data protection:** Encryption, key vault usage, sensitive data discovery
- **Vulnerability management:** Patch levels, insecure protocol usage, weak configurations
- **Monitoring:** Logging enablement, alert configuration, audit trail retention
- **Compliance:** Standards alignment for regulated industries

Recommendations are not one-time fixes; they become continuous monitoring. Once implemented, Defender for Cloud re-assesses regularly to ensure compliance.

### Free Posture vs. Paid Plans

Defender for Cloud's free tier is called **Foundational CSPM**. It covers asset discovery, the MCSB security policy, security recommendations, Secure Score, multicloud connectors for AWS and GCP, and DevOps repository connections. Everything beyond that is a paid plan, and the paid plans divide into two kinds.

**Defender CSPM** is the advanced posture plan. It adds regulatory compliance standards beyond MCSB, attack path analysis, the cloud security explorer (a queryable graph of your environment), governance rules that assign recommendations to owners with due dates, data security posture management, and AI security posture management. It is a posture plan. It detects nothing at runtime.

**Workload protection plans** are the other kind. Each adds per-workload threat detection that produces security alerts, and these are the "Defender for X" plans.

Plans are enabled **per subscription**. Defender for Servers Plan 1 can additionally be enabled per resource; most other plans can only be *disabled* per resource, not enabled that way.

### Workload Protection Plans

**Defender for Servers** protects Windows and Linux machines on Azure, AWS, GCP, and on-premises. It comes in two plans, and the split matters because most of what people associate with the product sits in Plan 2:

| Capability | Plan 1 | Plan 2 |
|------------|--------|--------|
| Defender for Endpoint EDR, automatically onboarded | Yes | Yes |
| Software inventory and agent-based vulnerability scanning | Yes | Yes |
| Agentless vulnerability, malware, and secrets scanning | No | Yes |
| Just-in-time VM access | No | Yes |
| File integrity monitoring | No | Yes |
| OS baseline misconfiguration assessment | No | Yes |
| Defender for DNS alerts | No | Yes |
| 500 MB/day free data ingestion | No | Yes |

Defender for Servers no longer relies on the Log Analytics agent or the Azure Monitor Agent for most of these features. Agentless scanning and the Defender for Endpoint integration replaced them. AMA survives only as the collection method behind the 500 MB ingestion benefit.

**Defender for App Service** detects attacks against apps running on App Service by analyzing what Azure already sees: the requests and responses to your apps, the VM instance the app runs on and its management interface, the underlying sandboxes, and internal platform logs. It catches vulnerability scanners probing your app, known-malicious IPs hitting FTP endpoints, high-privilege and fileless command execution, crypto-mining tools, and dangling DNS entries left behind when a site is decommissioned. It is a detection plan, not a web application firewall. It raises alerts, it does not block requests. Blocking OWASP-class attacks is the job of Application Gateway WAF or Front Door WAF, a separate product.

**Defender for Azure SQL Databases** covers Azure SQL single databases and elastic pools, SQL Managed Instance, and Synapse dedicated SQL pools. A companion plan, Defender for SQL servers on machines, covers SQL Server on Azure VMs and Arc-enabled SQL Server. Both provide SQL vulnerability assessment plus Advanced Threat Protection alerts for SQL injection, brute-force sign-ins, and anomalous access. Enabling the plan protects every supported resource in the subscription, including resources created later. You do not pick databases individually.

**Defender for open-source relational databases** covers Azure Database for PostgreSQL Flexible Server and Azure Database for MySQL Flexible Server on all pricing tiers, plus Amazon RDS instances on AWS. Azure Database for MariaDB has been retired, so MariaDB survives only on the Amazon RDS side.

**Defender for Azure Cosmos DB** is its own plan, detecting SQL injection attempts, anomalous access patterns, and access from unusual locations or applications.

**Defender for Storage** analyzes control-plane and data-plane telemetry from Blob Storage, Azure Files, and Data Lake Storage without requiring you to enable diagnostic logs. Three capabilities: activity monitoring (unusual access, exfiltration patterns, abuse of leaked or overly permissive SAS tokens), sensitive data threat detection, and malware scanning powered by Microsoft Defender Antivirus. Pricing is per storage account, with malware scanning billed separately per GB scanned and capped by default at 10,000 GB per storage account per month. Past the cap, scanning stops rather than the bill growing, and an alert tells you it happened.

**Defender for Key Vault** detects unusual access patterns, mass key or secret retrieval, and suspicious authentication failures against vaults.

**Defender for Containers** covers registry image vulnerability assessment, runtime protection for Kubernetes nodes and clusters, and environment hardening recommendations, across AKS, Arc-enabled Kubernetes, and the AWS and GCP Kubernetes services.

**Defender for APIs** discovers APIs published through API Management, assesses their security posture, prioritizes vulnerability fixes, and detects active attacks against them.

**Defender for Resource Manager** watches the control plane itself rather than any single workload, alerting on suspicious deployments, permission changes, and known toolkit activity against Azure Resource Manager.

**AI threat protection** detects attacks against generative AI workloads, and pairs with the AI security posture management in Defender CSPM.

Defender for DNS is no longer sold standalone to new subscriptions. Its alerts arrive as part of Defender for Servers Plan 2, and subscriptions that already had the standalone plan keep it.

### Azure Policy Integration

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} enforces compliance by preventing resources from being created if they violate policy conditions. Defender for Cloud's recommendations can automatically generate or suggest policies.

**How it works:**
- Create a policy that reflects a Defender recommendation (e.g., "Storage accounts must use TLS 1.2")
- Assign the policy to subscriptions or resource groups
- New resources that violate the policy are denied or marked non-compliant
- Existing non-compliant resources are identified for remediation

**Why policies matter:** Recommendations are advisory; policies are enforced. Policies prevent non-compliant resources from being created in the first place, reducing remediation work.

---

## Microsoft Sentinel: Cloud-Native SIEM and SOAR

### What Sentinel Solves

**Without Sentinel:**
- Logs and alerts exist in multiple systems with no central view
- Security events must be correlated manually across tools
- Incident response is reactive and time-consuming
- Threat hunting requires querying multiple data sources
- Compliance audits struggle to demonstrate logging and monitoring

**With Sentinel:**
- All logs and alerts feed into a single platform
- Correlation rules automatically detect multi-step attacks
- Automated playbooks respond to incidents without manual intervention
- Advanced analytics and machine learning identify anomalies
- Compliance reporting shows comprehensive audit trails

### How Sentinel Differs from AWS

Both Sentinel and AWS services (GuardDuty for threat detection, Detective for analysis, Security Hub for aggregation) provide SIEM-like capabilities, but they differ significantly.

| Aspect | AWS (GuardDuty + Detective + Security Hub) | Microsoft Sentinel |
|--------|---------------------------------------------|----------------|
| **Data ingestion** | Limited to AWS sources natively; third-party via Security Hub | Ingests from any source via connectors or syslog |
| **SIEM scope** | Primarily AWS threats (GuardDuty); cross-service view through Security Hub | Enterprise SIEM covering cloud, on-premises, and multi-cloud |
| **Threat detection** | GuardDuty provides ML-based detection; Detective for analysis | Native correlation rules + machine learning analytics |
| **Automation** | Security Hub integrations with AWS Lambda and SNS; limited SOAR | Built-in playbooks for common incident response |
| **Cost model** | Per-finding/data ingestion | Per-GB ingested, pay-as-you-go or commitment tiers starting at 100 GB/day |
| **Data retention** | Varies by service | 90 days included; interactive retention on the Analytics tier, then a low-cost data lake tier billed per GB stored and per GB scanned |
| **Compliance reporting** | Security Hub connector to compliance frameworks | Native compliance workbooks with automated evidence |

---

## Sentinel Architecture and Components

### Data Connectors

Data connectors ingest logs and events from external sources into Sentinel. Without connectors, Sentinel has no data to analyze.

**Types of connectors:**

| Connector Type | Source | Integration |
|----------------|--------|-------------|
| **Azure native** | Azure services (VMs, App Service, Key Vault, etc.) | Direct APIs; one-click setup |
| **Microsoft security** | Microsoft Defender XDR, Defender for Cloud, Defender for Endpoint | Built-in integration; the alerts themselves ingest free |
| **Third-party cloud** | AWS CloudTrail, VPC Flow Logs, GuardDuty findings; Google Cloud logs | Pulled from an S3 bucket (AWS) or Pub/Sub subscription (GCP) |
| **On-premises** | Syslog servers, Windows event logs, third-party tools | Azure Monitor Agent, on the machine or on a Linux forwarder |
| **CEF (Common Event Format)** | Third-party security tools (Palo Alto, F5, Fortinet) | Syslog in a standardized format, landing in `CommonSecurityLog` |
| **Custom sources** | Custom applications or integrations | Logs Ingestion API, or a codeless connector definition |

**Connector selection matters:** Connectors determine what visibility you have. Missing a critical data source means attacks from that source go undetected.

### Analytics Rules

Analytics rules are the correlation logic that detects patterns across logs. Sentinel has several rule types and they are not interchangeable:

| Rule type | What it does |
|-----------|--------------|
| **Scheduled** | A KQL query that runs on an interval you set and raises an alert when results pass a threshold. The most common type, and the one you author freely. |
| **Near-real-time (NRT)** | A restricted subset of scheduled rules that runs once every minute. You trade query capability for latency. |
| **Anomaly** | Machine-learning rules that baseline a behavior, then record deviations in the `Anomalies` table. They raise no alerts of their own; you query them for context. |
| **Microsoft security** | Creates Sentinel incidents from alerts raised by other Microsoft security products. Automatically disabled once Defender XDR incident integration or the Defender portal is in play, because Defender XDR creates those incidents instead. |
| **Threat intelligence** | One non-customizable rule that matches CEF, Syslog, and Windows DNS events against Microsoft's domain, IP, and URL indicators. |
| **Fusion** | The multistage attack correlation engine. On by default, logic hidden, one instance only. Also unavailable once Defender XDR owns incident creation. |
| **ML behavior analytics** | Non-customizable rules detecting anomalous SSH and RDP sign-in behavior from IP, geolocation, and user history. |

**Built-in rule templates:**
- Microsoft and solution vendors publish templates through the Content hub, covering MITRE ATT&CK techniques, compliance checks, and known threat techniques
- A template declares the data sources it needs and refuses to create the rule if those connectors aren't ingesting
- Templates keep being maintained, so a rule created from one shows an `Update` tag when its template changes and can be reverted to the template version

**Scheduled rule mechanics that bite:**
- Query interval and lookback period both range from **5 minutes to 14 days**, and the interval must be shorter than or equal to the lookback, because a longer interval would leave gaps in coverage and rule validation rejects it
- Rules run on a deliberate **five-minute delay** from their scheduled time, to absorb the latency between an event happening and its arriving in the workspace
- The query must return `TimeGenerated`; it is the reference for the lookback window, and records outside that window are never evaluated
- A rule generates at most 150 alerts per run, and at most 150 alerts group into a single incident before a second incident opens

**Example rule logic:**
- "Alert if 5+ failed login attempts to Azure Key Vault from the same IP in 10 minutes"
- "Alert if a user accesses sensitive files outside normal business hours"
- "Alert if a storage account's public blob access is enabled after it was previously private"

Rules are the core of threat detection, and they are only as good as the logs they query, so comprehensive data ingestion is what sets the ceiling on detection coverage. In the unified Defender portal, Microsoft now steers new detection authoring toward **custom detections**, which run against Defender XDR data without an ingestion charge and map entities automatically.

### Incidents and Alerts

**Alerts** are individual events triggered by analytics rules. An alert may be a single suspicious action (failed login attempt, abnormal file access).

**Incidents** are groups of related alerts correlated into a single security event. An incident might be "Multiple failed logins followed by successful login followed by lateral movement," which comprises several alerts that Sentinel groups together.

**Incident management workflow:**
1. Alert fires from an analytics rule
2. Sentinel correlates related alerts into incidents
3. Analysts triage incidents (investigate, confirm, dismiss)
4. Confirmed incidents trigger automated playbooks for response
5. Evidence is collected and documented for audits or legal proceedings

**Which engine correlates depends on the portal.** In a workspace not onboarded to the Defender portal, Sentinel's own analytics rules create incidents and group alerts according to each rule's alert-grouping settings. Once the workspace is onboarded, the Defender XDR correlation engine takes over. It treats your grouping settings as an initial instruction but may correlate differently, and it names the incidents itself. The option to reopen a closed incident when a matching alert arrives is no longer available.

### Workbooks

[Workbooks](https://learn.microsoft.com/en-us/azure/sentinel/get-visibility){:target="_blank" rel="noopener noreferrer"} are interactive dashboards that visualize security data. Workbooks combine Azure Monitor queries with visualizations to provide operational context.

**Common workbook uses:**
- **Security overview:** Incident trends, alert volumes, top users, top attackers
- **Compliance reporting:** Audit trails, user activity, data access logs
- **Threat hunting:** Custom queries to investigate suspected compromise
- **Operational:** Connector health, rule execution status, data ingestion rates

Workbooks are not just dashboards; they are designed for investigation. Analysts click through visualizations to drill down into suspicious activity.

### Playbooks

[Playbooks](https://learn.microsoft.com/en-us/azure/sentinel/automate-responses-with-automation-rules){:target="_blank" rel="noopener noreferrer"} are automated incident response workflows. They execute actions without human intervention.

**Common playbook actions:**
- **Containment:** Disable user accounts, revoke tokens, block IP addresses
- **Notification:** Escalate to on-call engineers, notify executives, log to audit system
- **Investigation:** Collect additional logs, run additional queries, gather forensics
- **Remediation:** Apply security patches, update firewall rules, reset compromised credentials

**Execution triggers:**
- **Automation rules** are the supported mechanism. They define which incidents or alerts run which playbooks and in what order, alongside non-playbook actions like assignment, tagging, and closing
- **Manual trigger** lets an analyst run a playbook against an incident, alert, or entity during investigation
- A playbook is a Logic App, so it can also carry its own recurrence trigger for routine work, but that path runs outside Sentinel's incident automation and receives none of the incident context

The legacy "alert automation (classic)" path, which attached playbooks directly to an analytics rule, has been retired. Any survivors should be migrated to automation rules built on the alert-created trigger.

Playbooks reduce the time from detection to response. An automated response to isolate a compromised VM happens in seconds; a manual process takes minutes to hours.

---

## Defender for Cloud and Sentinel Integration

### How They Work Together

Defender for Cloud and Sentinel are complementary parts of a unified security operations platform.

**Defender for Cloud:**
- Identifies what could go wrong (vulnerabilities, misconfigurations, compliance gaps)
- Generates recommendations for fixing issues
- Provides threat detections for Defender plan resources

**Sentinel:**
- Ingests Defender for Cloud alerts through a data connector, and posture findings through continuous export
- Correlates Defender findings with other security data (network logs, authentication logs, etc.)
- Detects when attackers are exploiting vulnerabilities that Defender identified
- Automates response through playbooks that enforce Defender recommendations

**Example workflow:**
1. Defender for Cloud discovers that a storage account has public blob access enabled (misconfiguration)
2. Defender raises a recommendation to disable public access
3. Continuous export streams that recommendation into the Sentinel workspace, where a scheduled analytics rule triggers if it is still unhealthy after a set period: "Critical storage misconfiguration not remediated"
4. An automated playbook disables public access and notifies the storage account owner
5. Sentinel incident documents the remediation for compliance audits

### Connecting Defender for Cloud to Sentinel

Alerts and posture findings reach Sentinel by two different paths, and conflating them is the most common design error in this integration.

**Alerts** flow through a Defender for Cloud data connector and land in the `SecurityAlert` table, where `ProductName == "Azure Security Center"` identifies them. Two connectors exist: the subscription-based one, now legacy, which you toggle on per subscription, and the tenant-based one, in preview, which collects alerts across the whole tenant without enabling each subscription individually. Either way, the subscription needs at least one Defender plan enabled and the `SecurityInsights` resource provider registered. Defender for Cloud alerts are a free data source in Sentinel.

**Recommendations are not carried by that connector.** To query posture findings in Sentinel, configure Defender for Cloud's **continuous export** to send recommendations, secure score, and regulatory compliance data to the Log Analytics workspace Sentinel runs on. That data is billed as ordinary ingestion.

```
Microsoft Defender for Cloud
│
├── Security alerts ────────► data connector ─────────┐   (free ingestion)
│                            subscription-based       │
│                            or tenant-based          │
│                                                     ▼
└── Recommendations ────────► continuous export ──► Log Analytics workspace
    Secure Score                (billed ingestion)    (Microsoft Sentinel)
    Compliance data                                    │
                                                       ├──► SecurityAlert
                                                       └──► SecurityRecommendation
                                                            SecureScores
```

**Alert synchronization** runs one way by default. Closing an alert in Defender for Cloud closes it in Sentinel. Enable **bi-directional sync** and closing the Sentinel incident that contains the alert closes the original Defender for Cloud alert too. Alert status and incident status stay separate, so changing an alert in Defender for Cloud never moves the Sentinel incident that holds it.

**Value of integration:**
- Centralized view of all security issues (Defender findings + threat detections)
- Ability to correlate Defender findings with other data (e.g., a user accessing a misconfigured storage account shortly after it was flagged)
- Automated incident response that combines Defender recommendations with Sentinel playbooks

Once a workspace is onboarded to the Defender portal, this wiring changes shape. Defender for Cloud alerts already arrive in Defender XDR, and the tenant-based connector is not listed on the Defender portal's connector page at all. You still install the Defender for Cloud solution from the Content hub for its built-in rules, workbooks, and queries.

---

## Architectural Patterns

### Pattern 1: Basic Security Operations (Single Subscription)

**Use case:** Small organization with a single Azure subscription and no hybrid environment.

**Components:**
- Foundational CSPM for posture assessment
- Optional Defender plans for specific resource types (Servers, App Service, Azure SQL)
- Sentinel workspace collecting logs from Azure services and Office 365
- Automation rules routing high-severity incidents to a security team email

**Characteristics:**
- Simple to set up; minimal configuration
- Limited visibility (only Azure data)
- No on-premises or third-party data integration
- Manual incident response through email notifications

---

### Pattern 2: Enterprise Security Operations (Multi-Subscription Hub-and-Spoke)

**Use case:** Organization with multiple subscriptions and centralized security operations team.

```
Management Subscription (Hub)
├── Centralized Sentinel workspace
│   ├── Data connectors from all subscriptions
│   ├── Data connectors from firewalls and proxies
│   ├── Data connectors from identity systems (Entra ID)
│   ├── Analytics rules (detection engine)
│   ├── Playbooks (incident automation)
│   └── Workbooks (SOC dashboards)
│
└── Defender for Cloud
    ├── Cross-subscription view via management group policies
    ├── Defender plans enabled on production subscriptions
    └── Security recommendations aggregated to hub

Production Subscription 1
└── Resources (VMs, App Service, databases)
    └── Logs stream to hub Sentinel

Production Subscription 2
└── Resources
    └── Logs stream to hub Sentinel

On-Premises
├── Firewall (CEF logs to Sentinel)
├── Active Directory (via Microsoft Entra Connect, logs to Sentinel)
└── Servers (logs via syslog forwarding agent)
```

**Components:**
- Central Sentinel workspace in a dedicated "security" or "management" subscription
- All production subscriptions configured to send logs to the central workspace
- Defender for Cloud enabled across all subscriptions with threat detection plans
- Hybrid connectivity between on-premises and Azure (logs flow to central Sentinel)
- Custom analytics rules for organization-specific threats
- Playbooks for incident containment and escalation

**Characteristics:**
- Comprehensive visibility across cloud and on-premises
- Single security team manages all incidents
- Scalable as new subscriptions are added (they automatically feed logs to hub)
- Higher operational overhead to maintain analytics rules and playbooks
- Better threat correlation (all data in one place)

**This is the recommended architecture for enterprises**, aligned with the [Microsoft cloud security benchmark](https://learn.microsoft.com/en-us/security/benchmark/azure/introduction){:target="_blank" rel="noopener noreferrer"}.

---

### Pattern 3: Multi-Cloud and Hybrid

**Use case:** Organization with workloads on Azure, AWS, and on-premises.

```
Sentinel Workspace (in Azure)
├── Azure data connectors (native integration)
│
├── AWS data connectors
│   ├── CloudTrail for AWS API auditing
│   ├── VPC Flow Logs for network monitoring
│   └── GuardDuty findings for threat detection
│
├── On-Premises data connectors
│   ├── Windows Event Forwarding for servers
│   ├── Active Directory logs via syslog
│   └── Third-party firewall via CEF
│
├── SaaS data connectors
│   ├── Microsoft Defender XDR
│   ├── Office 365 audit logs
│   └── ServiceNow for ticketing
│
└── Analytics rules (detect attacks across all clouds)
```

**Components:**
- Central Sentinel workspace as the unified SIEM across all clouds
- AWS data connector forwarding CloudTrail and GuardDuty findings to Sentinel
- Custom analytics rules that correlate Azure, AWS, and on-premises data
- Playbooks that integrate with AWS APIs and on-premises systems for response

**Characteristics:**
- Highest complexity to configure and maintain
- Complete visibility across cloud and on-premises
- Single platform for incident response across environments
- Cross-cloud threat correlation (detecting attacks that move between Azure and AWS)
- Licensing: Sentinel charges per GB of data, regardless of source

---

## Common Pitfalls

### Pitfall 1: Defender for Cloud Recommendations Not Implemented

**Problem:** Defender for Cloud raises hundreds of recommendations, but teams prioritize feature development over security fixes.

**Result:** Secure Score remains low. Vulnerabilities accumulate. When a breach occurs, compliance audits show that known vulnerabilities existed without remediation.

**Solution:** Integrate Defender recommendations into your sprint planning. Use Secure Score targets (e.g., "maintain Secure Score above 70%") as a team metric. Automate remediation where possible through Azure Policy and Sentinel playbooks. Prioritize Critical and High severity recommendations; accept some Medium and Low items as operational risk.

---

### Pitfall 2: Sentinel Data Ingestion is Incomplete

**Problem:** You set up Sentinel with only basic Azure connectors, missing critical data sources like network logs, firewall events, and identity logs.

**Result:** Analytics rules fire on partial visibility. Attackers using on-premises infrastructure or third-party tools go undetected because logs never reach Sentinel.

**Solution:** Map all data sources that could reveal attacks: firewalls, proxies, DNS servers, identity systems, databases, cloud APIs, and on-premises servers. Prioritize data sources in order of risk (identity first, then network, then applications). Start with critical sources and expand gradually.

---

### Pitfall 3: Analytics Rules Too Noisy or Too Silent

**Problem:** Custom analytics rules either fire too many false alerts (creating alert fatigue) or miss real attacks (silent).

**Result:** Analysts ignore alerts ("boy who cried wolf"), or actual breaches go undetected.

**Solution:** Start with Microsoft's built-in rule templates. Customize based on your environment (adjust thresholds, add exclusions for known legitimate activity). Monitor rule effectiveness by reviewing incidents it detects. Tune noisy rules by adjusting sensitivity or adding false-positive filters. Silence rules that provide no actionable value.

---

### Pitfall 4: Playbooks Never Execute or Execute with Insufficient Permissions

**Problem:** You create playbooks to automate incident response, but they fail because the automation account lacks permissions, or they trigger unexpectedly.

**Result:** Response is not automated. Incidents pile up. Trust in playbooks erodes.

**Solution:** Test playbooks in a non-production environment first. Grant playbooks the minimum required permissions (least-privilege). Use conditional logic in automation rules to trigger only on specific incident types or severities. Monitor playbook execution logs to identify failures quickly.

---

### Pitfall 5: Sentinel Workspace Misconfigured or Inaccessible from Subscriptions

**Problem:** Sentinel workspace is in a different subscription or region, and network policies or RBAC prevent logs from reaching it.

**Result:** Data never reaches Sentinel. Incidents cannot be created. Platform sits dormant.

**Solution:** Place Sentinel in a centralized security or management subscription. For all other subscriptions, ensure diagnostic settings or data connectors explicitly route logs to the central workspace. Test data flow by querying Sentinel tables to confirm logs are arriving. For network isolation, put the workspace behind an Azure Monitor Private Link Scope so agents and connectors reach it over private endpoints while the network boundary holds.

---

### Pitfall 6: Cost Overruns from Data Ingestion

**Problem:** You enable all data connectors without understanding volume. Sentinel charges per GB, and verbose third-party logs generate unexpected costs.

**Result:** Monthly bill is higher than anticipated.

**Solution:** Estimate volume before enabling connectors, and know which sources are free. Azure Activity logs, Office 365 audit logs, and the alerts from Defender XDR and Defender for Cloud carry no Sentinel charge, though the raw logs behind those alerts do. Route the rest by security value rather than by volume. Keep high-value tables on the Analytics tier, and move high-volume, low-value logs like firewall, proxy, and NetFlow to Basic or Auxiliary logs, or to the data lake tier where storage is cheap and you pay per GB scanned when you query. Filter at the source where possible. Above 100 GB/day a commitment tier costs meaningfully less than pay-as-you-go, and you can raise it any time but lower it only every 31 days. The 31-day free trial covering the first 10 GB/day is the window to measure actual volume before committing.

---

## Key Takeaways

1. **Defender for Cloud is continuous security auditing.** It discovers resources, assesses them against security baselines, and identifies vulnerabilities and misconfigurations. Secure Score provides a single metric for posture improvement. Recommendations are persistent; they do not go away until you address them.

2. **Secure Score reflects configuration, not actual security.** A high score means you have implemented best practices, but it does not guarantee you are not under attack. Two models now exist, the classic control-based percentage in the Azure portal and the risk-based Cloud Secure Score in the Defender portal, and their numbers are not comparable, so pick one and track it.

3. **Free posture is Foundational CSPM; everything past it is a plan.** Foundational CSPM gives you discovery, MCSB recommendations, and Secure Score at no charge. Defender CSPM adds attack path analysis, the cloud security explorer, governance, and compliance standards beyond MCSB. The workload plans (Servers, App Service, Azure SQL, Storage, Key Vault, Containers, APIs, Resource Manager) add runtime threat detection. All are enabled per subscription.

4. **Azure Policy enforces Defender recommendations.** Recommendations are advisory. Use Azure Policy to enforce compliance and prevent non-compliant resources from being created. This shifts security left and reduces remediation overhead.

5. **Sentinel is your cloud SIEM, and it now runs in the Defender portal.** It ingests logs from all sources, correlates events to detect attacks, and automates response through playbooks. Its value depends entirely on data quality and comprehensiveness. After March 31, 2027 the Azure portal experience is gone, and in the Defender portal it is Defender XDR that creates and correlates incidents.

6. **Data connector selection determines threat visibility.** Missing data sources mean attacks from those sources go undetected. Prioritize data sources (identity first, then network, then applications) and expand coverage gradually.

7. **Analytics rules are the detection engine, and the type matters.** Scheduled rules are what you author, from a 5-minute to a 14-day interval; NRT rules run every minute with a restricted query surface; anomaly rules write to a table instead of alerting; Microsoft security and Fusion rules disappear once Defender XDR owns incident creation. Start with built-in templates, customize for your environment, and tune to minimize false positives while catching real attacks.

8. **Incidents are correlated alerts, not individual alerts.** Multiple related alerts are grouped into a single incident for investigation. Incident context matters; one alert may be noise, but a pattern of alerts indicates an attack.

9. **Playbooks automate incident response.** Playbooks eliminate manual work and reduce response time from minutes to seconds. Start with simple playbooks (notification, logging) and expand to complex containment (disable accounts, block IPs) as confidence grows.

10. **Defender for Cloud and Sentinel together create a complete security operations platform.** Defender identifies what could go wrong. Sentinel detects what is actually going wrong. Wire them deliberately: alerts arrive through the data connector for free, and posture findings arrive only if you configure continuous export.
