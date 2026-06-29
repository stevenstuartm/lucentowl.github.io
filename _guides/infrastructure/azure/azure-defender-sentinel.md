---
title: "Microsoft Defender for Cloud and Sentinel"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "A system architect's guide to Microsoft Defender for Cloud and Microsoft Sentinel covering cloud security posture management, threat detection, SIEM and SOAR capabilities, and security operations architecture."
tags: [azure, security, cloud-computing, observability, infrastructure, governance, reliability, practical]
---

## What Is Cloud Security Operations

Modern cloud environments require a different security approach than on-premises infrastructure. The attack surface expands continuously as resources scale, configurations drift, and cloud services introduce new capabilities. Two tools form the core of Azure's security operations platform: [Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction){:target="_blank" rel="noopener noreferrer"} and [Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/overview){:target="_blank" rel="noopener noreferrer"}.

Defender for Cloud is a cloud security posture management (CSPM) and cloud workload protection (CWP) platform. It discovers what you have, assesses it against security best practices, identifies misconfigurations and vulnerabilities, and recommends remediation. Think of it as continuous security auditing built into your infrastructure.

Sentinel is a cloud-native SIEM (Security Information and Event Management) and SOAR (Security Orchestration, Automation and Response) platform. It ingests logs and alerts from across your environment, correlates events to detect attacks, and automates incident response. Think of it as your security operations center in software.

Together, they create a complete security operations capability. Defender for Cloud identifies what could go wrong, Sentinel detects when something is actually going wrong, and both enable automated response.

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
- Compliance mapping to major frameworks (CIS, PCI-DSS, HIPAA, SOC 2) with automated evidence collection
- Integration with other Azure services (Entra ID, Azure Policy, Update Management) for holistic security

### How Defender for Cloud Differs from AWS Security Hub

Both Azure and AWS provide unified security posture management, but they differ in scope and integration.

| Aspect | AWS Security Hub | Azure Defender for Cloud |
|--------|------------------|--------------------------|
| **Scope** | Reads-only aggregator of security findings from other AWS services | Native cloud security posture service with own assessment engine |
| **Vulnerability scanning** | Requires integration with Amazon Inspector (separate service) | Built-in with optional Defender plans for servers, containers, databases |
| **Compliance frameworks** | Supports multiple frameworks (CIS, PCI-DSS, etc.) with evidence collection | Same frameworks, but better integrated with Azure Policy |
| **Threat detection** | Requires integration with Amazon GuardDuty (separate SIEM-like service) | Built-in threat protection with Defender plans |
| **Remediation automation** | Limited; mostly through AWS Config | Better integration with Azure automation and remediation runbooks |
| **Cost model** | Per-finding ingestion | Subscription-based Defender plans |
| **Hybrid support** | Limited to AWS | Strong hybrid/multi-cloud with on-premises servers support |

---

## Defender for Cloud Components

### Secure Score

Secure Score is a single number (0-100) representing your security posture. It aggregates assessment results across your subscriptions, resource groups, and individual resources.

**How Secure Score works:**
- Each resource type has a set of security recommendations with point values
- When you implement a recommendation, you earn points
- Secure Score = (current points / maximum possible points) × 100
- Trends show improvement or degradation over time

**Important characteristics:**
- Scores are not shared between subscriptions; each subscription has its own score
- Maximum score depends on your environment (not all recommendations apply to all resources)
- Score changes should be reviewed regularly; a declining score indicates new risks or misconfigurations
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

### Defender Plans

Beyond the free Defender for Cloud experience (which provides basic asset discovery and some recommendations), optional Defender plans add threat detection and advanced vulnerability assessment for specific resource types.

**Defender for Servers:**
- Monitors virtual machines for malware, vulnerable software, and suspicious behavior
- Provides Just-In-Time VM access to reduce attack surface
- File integrity monitoring detects tampering
- Integrates with vulnerability assessment solutions
- Applies to Windows and Linux VMs

**Defender for App Service:**
- Monitors App Service applications for web-based attacks (SQL injection, cross-site scripting)
- Detects suspicious activity patterns
- Includes OWASP Top 10 protections

**Defender for SQL:**
- Monitors Azure SQL Database and SQL Managed Instance
- Detects SQL injection attempts and abnormal database activity
- Provides vulnerability assessment and remediation guidance
- Applies per-database; you choose which databases to protect

**Defender for Storage:**
- Monitors Azure Storage accounts for unusual access patterns
- Detects potential data exfiltration attempts
- Monitors malware upload attempts

**Defender for Key Vault:**
- Monitors Key Vault for unauthorized access attempts
- Detects mass key or secret retrieval patterns
- Alerts on suspicious authentication failures

**Defender for Containers:**
- Image scanning during build and runtime scanning for running containers
- Detects vulnerable container images in registries (ACR)
- Monitors AKS cluster for suspicious pod behavior
- Enforces container security policies

**Defender for Databases:**
- Beyond Defender for SQL; extends to open-source databases
- Covers Azure MySQL, PostgreSQL, MariaDB, and Cosmos DB
- Detects anomalous database access patterns

Defender plans are licensed per resource (except some bundle options). Cost varies significantly based on resource type and consumption.

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

| Aspect | AWS (GuardDuty + Detective + Security Hub) | Azure Sentinel |
|--------|---------------------------------------------|----------------|
| **Data ingestion** | Limited to AWS sources natively; third-party via Security Hub | Ingests from any source via connectors or syslog |
| **SIEM scope** | Primarily AWS threats (GuardDuty); cross-service view through Security Hub | Enterprise SIEM covering cloud, on-premises, and multi-cloud |
| **Threat detection** | GuardDuty provides ML-based detection; Detective for analysis | Native correlation rules + machine learning analytics |
| **Automation** | Security Hub integrations with AWS Lambda and SNS; limited SOAR | Built-in playbooks for common incident response |
| **Cost model** | Per-finding/data ingestion | Per-GB ingested data with 30-day retention default |
| **Data retention** | Varies by service | Configurable; can separate hot (30-day) and cold (1-year+) storage |
| **Compliance reporting** | Security Hub connector to compliance frameworks | Native compliance workbooks with automated evidence |

---

## Sentinel Architecture and Components

### Data Connectors

Data connectors ingest logs and events from external sources into Sentinel. Without connectors, Sentinel has no data to analyze.

**Types of connectors:**

| Connector Type | Source | Integration |
|----------------|--------|-------------|
| **Azure native** | Azure services (VMs, App Service, Key Vault, etc.) | Direct APIs; one-click setup |
| **Microsoft Security** | Microsoft 365 Defender, Defender for Cloud, Defender for Endpoint | Built-in integration |
| **Third-party cloud** | AWS CloudTrail, Google Cloud logging | REST APIs |
| **On-premises** | Syslog servers, Windows Event Collector, Splunk | Log forwarding agents or direct syslog |
| **CEF (Common Event Format)** | Third-party security tools (Palo Alto, F5, Fortinet) | Syslog with standardized format |
| **Webhooks** | Custom applications or integrations | HTTP POST to Sentinel's API |

**Connector selection matters:** Connectors determine what visibility you have. Missing a critical data source means attacks from that source go undetected.

### Analytics Rules

Analytics rules are correlation logic that detects patterns across logs. Rules can be:

**Built-in rule templates:**
- Microsoft provides hundreds of pre-built templates for common attacks and compliance checks
- Templates cover frameworks like MITRE ATT&CK, compliance standards, and known threat techniques
- You customize and enable templates rather than building rules from scratch

**Custom rules you author:**
- KQL (Kusto Query Language) queries that scan logs for suspicious patterns
- Rules evaluate on a schedule (every 5 minutes, hourly, etc.) or on data ingestion
- When a pattern matches, the rule triggers an incident

**Example rule logic:**
- "Alert if 5+ failed login attempts to Azure Key Vault from the same IP in 10 minutes"
- "Alert if a user accesses sensitive files outside normal business hours"
- "Alert if a storage account's public blob access is enabled after it was previously private"

Rules are the core of threat detection. Rules are only as good as the logs they query, so comprehensive data ingestion is critical.

### Incidents and Alerts

**Alerts** are individual events triggered by analytics rules. An alert may be a single suspicious action (failed login attempt, abnormal file access).

**Incidents** are groups of related alerts correlated into a single security event. An incident might be "Multiple failed logins followed by successful login followed by lateral movement," which comprises several alerts that Sentinel groups together.

**Incident management workflow:**
1. Alert fires from an analytics rule
2. Sentinel correlates related alerts into incidents
3. Analysts triage incidents (investigate, confirm, dismiss)
4. Confirmed incidents trigger automated playbooks for response
5. Evidence is collected and documented for audits or legal proceedings

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
- **Automation rules** define when playbooks execute (e.g., when an incident of Severity=High is created)
- **Manual trigger** allows analysts to execute playbooks during investigation
- **Scheduled** playbooks run on a schedule for routine tasks

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
- Ingests Defender for Cloud alerts and recommendations as data
- Correlates Defender findings with other security data (network logs, authentication logs, etc.)
- Detects when attackers are exploiting vulnerabilities that Defender identified
- Automates response through playbooks that enforce Defender recommendations

**Example workflow:**
1. Defender for Cloud discovers that a storage account has public blob access enabled (misconfiguration)
2. Defender raises a recommendation to disable public access
3. If not fixed within a timeframe, Sentinel's analytics rule triggers: "Critical storage misconfiguration not remediated"
4. An automated playbook disables public access and notifies the storage account owner
5. Sentinel incident documents the remediation for compliance audits

### Connecting Defender for Cloud to Sentinel

Defender for Cloud alerts and recommendations can be ingested into Sentinel as a data source.

**Configuration:**
- Add the "Microsoft Defender for Cloud" data connector in Sentinel
- Select which subscriptions and resource groups to monitor
- Alerts and recommendations flow into Sentinel's `SecurityAlert` and `SecurityRecommendation` tables

**Value of integration:**
- Centralized view of all security issues (Defender findings + threat detections)
- Ability to correlate Defender findings with other data (e.g., a user accessing a misconfigured storage account shortly after it was flagged)
- Automated incident response that combines Defender recommendations with Sentinel playbooks

---

## Architectural Patterns

### Pattern 1: Basic Security Operations (Single Subscription)

**Use case:** Small organization with a single Azure subscription and no hybrid environment.

```
Subscription
├── Defender for Cloud (free tier or Defender plans)
│   ├── Asset discovery
│   ├── Vulnerability assessment
│   └── Secure Score tracking
│
└── Sentinel
    ├── Data connectors: Azure services + Office 365
    ├── Analytics rules: Common attack detection
    └── Incidents: Investigation and response
```

**Components:**
- Defender for Cloud free tier for posture assessment
- Optional Defender plans for specific resource types (Servers, App Service, SQL)
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
├── Active Directory (via Azure AD Connect, logs to Sentinel)
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

**This is the recommended architecture for enterprises**, aligned with the [Azure Security Benchmark](https://learn.microsoft.com/en-us/security/benchmark/azure/){:target="_blank" rel="noopener noreferrer"}.

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
│   ├── Microsoft 365 Defender
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

**Solution:** Place Sentinel in a centralized security or management subscription. For all other subscriptions, ensure diagnostic settings or data connectors explicitly route logs to the central workspace. Test data flow by querying Sentinel tables to confirm logs are arriving. For network isolation, use service endpoints or private endpoints to allow data flow while maintaining network boundaries.

---

### Pitfall 6: Cost Overruns from Data Ingestion

**Problem:** You enable all data connectors without understanding volume. Sentinel charges per GB, and verbose third-party logs generate unexpected costs.

**Result:** Monthly bill is higher than anticipated.

**Solution:** Estimate data volume before enabling connectors (most connectors show sample costs). Prioritize data sources by security value. Filter logs at the source where possible (e.g., syslog filters on Windows Event Forwarder) to ingest only relevant events. Use data retention policies to archive less-critical logs to cold storage.

---

## Key Takeaways

1. **Defender for Cloud is continuous security auditing.** It discovers resources, assesses them against security baselines, and identifies vulnerabilities and misconfigurations. Secure Score provides a single metric for posture improvement. Recommendations are persistent; they do not go away until you address them.

2. **Secure Score reflects configuration, not actual security.** A high score means you have implemented best practices, but it does not guarantee you are not under attack. Use Secure Score as a baseline, not as a guarantee of safety.

3. **Defender plans add threat detection to assets.** The free Defender for Cloud provides assessment only. Defender plans (Servers, App Service, SQL, Storage, Key Vault, Containers) add runtime threat detection. Cost varies by resource type.

4. **Azure Policy enforces Defender recommendations.** Recommendations are advisory. Use Azure Policy to enforce compliance and prevent non-compliant resources from being created. This shifts security left and reduces remediation overhead.

5. **Sentinel is your cloud SIEM.** It ingests logs from all sources, correlates events to detect attacks, and automates response through playbooks. Sentinel's value depends entirely on data quality and comprehensiveness.

6. **Data connector selection determines threat visibility.** Missing data sources mean attacks from those sources go undetected. Prioritize data sources (identity first, then network, then applications) and expand coverage gradually.

7. **Analytics rules are the detection engine.** Start with Microsoft's built-in templates. Customize based on your environment. Tune to minimize false positives while catching real attacks. Regular review of rule effectiveness is essential.

8. **Incidents are correlated alerts, not individual alerts.** Multiple related alerts are grouped into a single incident for investigation. Incident context matters; one alert may be noise, but a pattern of alerts indicates an attack.

9. **Playbooks automate incident response.** Playbooks eliminate manual work and reduce response time from minutes to seconds. Start with simple playbooks (notification, logging) and expand to complex containment (disable accounts, block IPs) as confidence grows.

10. **Defender for Cloud and Sentinel together create a complete security operations platform.** Defender identifies what could go wrong. Sentinel detects what is actually going wrong. Both drive automated response. Without either, your security operations are incomplete.
