---
title: "Azure Activity Log and Diagnostic Settings"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "A system architect's guide to Azure Activity Log and Diagnostic Settings covering audit logging, resource-level diagnostics, log routing, and compliance monitoring architecture."
tags: [azure, security, observability, cloud-computing, infrastructure, governance, automation, practical]
---

## What Is Azure Activity Log and Diagnostic Settings

Azure provides two complementary logging systems for different purposes. [Azure Activity Log](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/activity-log){:target="_blank" rel="noopener noreferrer"} records administrative changes across your subscription (who deployed a resource, when it was modified, and who deleted it). [Diagnostic Settings](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/diagnostic-settings){:target="_blank" rel="noopener noreferrer"} enable individual resources to emit their own logs and metrics, which are then routed to destinations like Log Analytics, Storage accounts, or Event Hubs.

These systems are foundational to observability, compliance auditing, and incident investigation on Azure. Together they answer two distinct questions: "What administrative changes happened in my subscription?" and "What is happening inside this specific resource?"

### What Problems Activity Log and Diagnostic Settings Solve

**Without Activity Log and Diagnostic Settings:**
- No record of who made administrative changes or when
- Compliance audits have no evidence of access controls or configuration changes
- Troubleshooting resource issues requires guessing at internal state
- No centralized location to search for events across your subscription
- Regulatory requirements (HIPAA, PCI-DSS, SOC 2) cannot be satisfied
- Incident response teams have no forensic trail to investigate compromises

**With Activity Log and Diagnostic Settings:**
- Complete audit trail of administrative actions across the subscription
- Resource-level logs and metrics for real-time monitoring and forensic analysis
- Centralized log storage enabling compliance audits and search across resources
- Integration with security monitoring tools like Azure Defender for Cloud and Sentinel
- Evidence of configuration changes and access patterns for incident investigation
- Automated alerts when suspicious activity occurs (via Azure Monitor)

### How Activity Log and Diagnostic Settings Differ from AWS

Architects familiar with AWS should understand how Azure's logging maps to AWS services:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Subscription-level audit trail** | CloudTrail (tracks all API calls) | Activity Log (tracks administrative actions + service health) |
| **Resource-level logs** | CloudWatch Logs (application/service logs) | Diagnostic Settings (logs and metrics per resource type) |
| **Log storage and analysis** | CloudWatch Logs + S3 archival | Log Analytics workspace + Storage account archival |
| **Central logging configuration** | CloudTrail + CloudWatch Log Groups | Activity Log + Diagnostic Settings (per resource) |
| **Security monitoring** | GuardDuty + CloudTrail analysis | Defender for Cloud + Sentinel |
| **Configuration change tracking** | AWS Config | Azure Policy + Activity Log |
| **Event stream ingestion** | Kinesis Data Streams | Event Hubs |
| **Log retention** | Indefinite (charged for storage) | Activity Log: 90 days free; beyond requires export |
| **Cost model** | Per log ingested + storage | Per GB ingested + per GB stored |

---

## Azure Activity Log

### What Activity Log Records

Activity Log captures administrative actions and service health events at the subscription level. It is a system-wide audit trail, not resource-specific.

**Event categories in Activity Log:**

| Category | Examples |
|----------|----------|
| **Administrative** | Create VM, modify NSG rule, deploy function app, delete storage account |
| **Service Health** | Azure service outages, maintenance notifications, health advisories |
| **Alert** | Alert fired, alert resolved, alert action triggered |
| **Resource Health** | VM stopped (user action), resource degraded, availability issue |
| **Recommendation** | Cost optimization recommendations, security recommendations from Advisor |

**Information captured for each event:**

- **Caller identity** - User (UPN), service principal, or managed identity that triggered the action
- **Action taken** - The specific operation (e.g., `Microsoft.Compute/virtualMachines/write`)
- **Target resource** - The resource that was modified
- **Timestamp** - When the action occurred (UTC)
- **Status** - Success, Failed, Accepted (for long-running operations)
- **Event source** - Admin Portal, PowerShell, Azure CLI, REST API, or Azure SDKs
- **Correlation ID** - Links related events together (useful for distributed tracing)
- **Subscription ID** - Which subscription the event occurred in

### Activity Log Retention

**Free retention:** 90 days
- Activity Log is automatically retained in Azure for 90 days at no cost
- Older events are automatically deleted
- Search and filtering are available in the Azure Portal

**Extended retention:** Export to other destinations
- Export to Log Analytics workspace: Retain for 1-2 years (configurable)
- Export to Storage account: Retain indefinitely at minimal cost (pennies per TB/month)
- Export to Event Hubs: Stream real-time events to external systems

**Practical implication:** For compliance audits requiring 2+ years of historical data, you must configure exports. The 90-day free retention is insufficient for most regulatory frameworks.

### Accessing Activity Log

**In the Azure Portal:**
- Navigate to Activity Log under any resource or at the subscription level
- Filter by time range, operation, resource type, or status
- View detailed event information including caller identity and timestamp

**Programmatically:**
- Use [Azure Monitor REST API](https://learn.microsoft.com/en-us/rest/api/monitor/activity-logs){:target="_blank" rel="noopener noreferrer"} to query Activity Log events
- Use Azure SDKs (PowerShell, CLI, Python) to automate log retrieval
- Azure Policy can use Activity Log events as triggers for remediation

**At scale:**
- Export to Log Analytics and query with KQL (Kusto Query Language)
- Create dashboards and alerts based on Activity Log events
- Analyze patterns (who is making changes, what is changing, when)

---

## Diagnostic Settings

### What Diagnostic Settings Provide

Diagnostic Settings enable individual Azure resources to emit logs and metrics to destinations. Each resource type emits logs and metrics specific to its function.

**Resource types and their logs:**

| Resource Type | Example Logs |
|--------------|--------------|
| **Virtual Machines** | Guest diagnostics, boot diagnostics, event logs from Windows or Linux |
| **App Service** | HTTP requests, failed requests, detailed error logs, performance metrics |
| **Azure SQL Database** | Query execution, deadlocks, long-running queries, audit logs |
| **Azure Firewall** | Network traffic rules, denied connections, rule execution logs |
| **Azure Kubernetes Service (AKS)** | API server logs, audit logs, controller-manager logs, kubelet logs |
| **Key Vault** | Access audit (who accessed secrets), failed operations |
| **API Management** | API request/response logs, performance metrics |
| **Storage Account** | Read/write/delete operations, access patterns, performance metrics |
| **Azure Bastion** | Session logs, failed connection attempts |

**Metrics emitted by resources:**

All resources emit metrics like CPU usage, memory consumption, disk I/O, network throughput, and request latency. These are available in Azure Monitor and queryable via the metrics API.

### Diagnostic Settings Configuration

To enable Diagnostic Settings for a resource:

1. **Select the resource** in the Azure Portal
2. **Navigate to Diagnostic settings** (usually under Monitoring)
3. **Click "Add diagnostic setting"**
4. **Name the setting** (for your reference)
5. **Choose log categories** to enable (varies by resource type)
6. **Choose metric categories** to enable
7. **Select destination(s):**
   - Log Analytics workspace
   - Storage account
   - Event Hub
   - Partner solutions (Datadog, Splunk, etc.)

**Common destination patterns:**

| Destination | Use Case | Cost | Retention |
|------------|----------|------|-----------|
| **Log Analytics** | Real-time analysis, KQL queries, alerts | Pay-as-you-go (per GB ingested) | Configurable (default 30 days) |
| **Storage account** | Long-term archival, compliance, cost-effectiveness | Minimal (per GB/month) | Indefinite (configure lifecycle) |
| **Event Hub** | Stream real-time events to on-premises, third-party tools | Pay per throughput unit | Not persistent (temp buffer only) |

**Architectural decision:** Send logs to Log Analytics for operational analysis, and configure Log Analytics to export older data to Storage for archival. This balances query performance with compliance cost.

### Log Analytics Workspace

A [Log Analytics workspace](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"} is a central repository where logs from all Diagnostic Settings are aggregated and indexed. Once in Log Analytics, logs can be queried, analyzed, and retained.

**Workspace characteristics:**
- **Regional resource** - A workspace exists in a single Azure region
- **Shared by multiple resources** - Multiple resources send logs to the same workspace
- **Queryable with KQL** - Use Kusto Query Language to search logs and create alerts
- **Retention configurable** - From 1 day to 2 years
- **Priced per GB ingested** - Data ingestion is the primary cost driver

**Multi-workspace patterns:**

| Pattern | When to Use |
|---------|-----------|
| **Single workspace** | Small environments, single team, simple compliance requirements |
| **Per-environment** | Dev, staging, production have separate workspaces (easier RBAC) |
| **Per-region** | Data residency compliance requires logs stay in region, so separate workspace per region |
| **Per-customer** | Multi-tenant SaaS where each customer's logs must be isolated |

**Common mistake:** Creating too many workspaces. Each workspace has overhead (separate retention, separate costs, separate RBAC). Start with a single workspace; only split when you have a specific requirement (data residency, compliance boundary, cost allocation).

### Log Retention and Archival

**Log Analytics retention tiers:**

| Tier | Duration | Cost | Use Case |
|------|----------|------|----------|
| **Interactive retention** | 1-30 days (configurable) | Full ingestion cost | Active troubleshooting, real-time analysis |
| **Archive retention** | 31 days to 2 years | Significantly reduced (~10% of ingestion cost) | Compliance records, cold data for occasional queries |

**Archival strategy:** Retain hot logs in Log Analytics for 30 days (active troubleshooting), then archive older logs to Storage account. Archive queries are slower but dramatically cheaper than keeping everything hot.

**Storage account archival:**
- Configure Diagnostic Settings to export logs to a Storage account blob container
- Use Storage lifecycle policies to move old blobs to cool/archive tiers
- Retention cost drops significantly as data ages (from hot tier to archive tier)
- Practical for 2-7 year retention required by many compliance frameworks

---

## Azure Policy Auditing and Compliance

### How Azure Policy Relates to Logging

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} evaluates resources against compliance rules and can trigger remediation actions. All policy evaluations are recorded in Activity Log, creating an audit trail of compliance assessment.

**Policy effect types:**

| Effect | Behavior | Audit Trail |
|--------|----------|-------------|
| **Audit** | Resource is allowed; non-compliance recorded | Activity Log shows evaluation + non-compliance |
| **Deny** | Non-compliant resource creation/modification blocked | Activity Log shows denied action + reason |
| **Append** | Non-compliant resource is automatically modified | Activity Log shows append operation |
| **Modify** | Non-compliant resource fields automatically changed | Activity Log shows modification + new values |
| **DeployIfNotExists** | Compliance resource deployed automatically | Activity Log shows deployment |

**Example policy evaluation:**

```
Policy: "All VMs must have backup enabled"
├─ Evaluation: Check if VM has backup configured
├─ Result: Non-compliant (no backup)
├─ Effect: Deny (or Modify to add backup)
└─ Activity Log records: Who created the VM, what was blocked/modified, timestamp
```

### Remediation Tasks

When a resource is found non-compliant by a policy with a remediation effect (Append, Modify, DeployIfNotExists), Azure can automatically fix the issue or log it for manual remediation.

**Automatic remediation example:**

```
Policy: "All Storage accounts must have encryption enabled"
├─ Non-compliant resource detected
├─ Remediation task: Enable encryption on the storage account
├─ Activity Log records: Remediation action, success/failure, timestamp
└─ Result: Storage account is now compliant
```

**Remediation audit trail:**
- Activity Log shows who deployed the policy and when
- Activity Log shows each remediation action (if policy has auto-remediation)
- Log Analytics can show compliance trend over time

---

## Log Routing Architecture Patterns

### Pattern 1: Centralized Logging (Single Workspace)

**Use case:** Single team, single environment, or small organization.

```
Subscription
├── Activity Log ──┐
├── VM Diagnostics ──┐
├── App Service Logs ──┐
├── SQL Diagnostics ──┐
├── Firewall Logs ──┐
└── Key Vault Audit ──→ Log Analytics Workspace
                          ├── KQL queries
                          ├── Alerts
                          └── Dashboards
```

**Configuration:**
- Single Log Analytics workspace for the entire subscription
- All resources send Diagnostic Settings to this workspace
- Activity Log exported to the same workspace

**Trade-offs:**
- **Simple:** Single pane of glass, all logs in one place
- **Cost:** One shared ingestion bill (no cost per resource)
- **Query performance:** Single workspace to search
- **Limitation:** RBAC is workspace-level; harder to isolate access by team or environment

---

### Pattern 2: Multi-Workspace by Environment

**Use case:** Separate dev, staging, and production with different teams/access controls.

```
Subscription
├── Dev resources ──→ Dev Log Analytics Workspace
├── Staging resources ──→ Staging Log Analytics Workspace
└── Production resources ──→ Production Log Analytics Workspace

Activity Log ──→ Central Export Storage Account (all environments)
```

**Configuration:**
- Separate workspace per environment
- Each environment's resources send Diagnostic Settings to their workspace
- Activity Log exported to central Storage account for compliance (captures all environments)

**Trade-offs:**
- **Isolation:** Production logs are not visible to dev team
- **Access control:** RBAC per workspace matches organizational structure
- **Cost:** Three separate ingestion bills (minor overhead for workspace management)
- **Compliance:** Activity Log in central storage still captures all administrative actions

---

### Pattern 3: Multi-Workspace by Region (Data Residency)

**Use case:** Compliance requires logs stay in specific regions (GDPR, HIPAA, etc.).

```
East US Region
└── East US resources ──→ East US Log Analytics
                          └── Archive to East US Storage

Europe West Region
└── Europe West resources ──→ Europe Log Analytics
                              └── Archive to Europe Storage

Activity Log (subscription-wide) ──→ Always available in each region workspace
```

**Configuration:**
- Separate workspace per region where resources are deployed
- Resources send Diagnostic Settings only to workspace in their region
- Understand that Activity Log automatically replicates across all workspace regions

**Trade-offs:**
- **Data residency:** Logs never leave the region
- **Query complexity:** Queries across regions require cross-workspace queries
- **Cost:** Separate ingestion bill per region
- **Compliance:** Simplifies GDPR/HIPAA audit (prove data stayed in region)

---

### Pattern 4: Hub-and-Spoke with Central Monitoring

**Use case:** Enterprise with multiple subscriptions, centralized security team.

```
Central Subscription (Hub)
└── Central Log Analytics Workspace
    ├── Receives Activity Logs from all subscriptions
    ├── Receives Diagnostic Settings from all subscriptions
    └── Serves as central search + alerting

Production Subscription 1
├── App Service ──→ Central Log Analytics (via Diagnostic Settings)
├── SQL Database ──→ Central Log Analytics
└── Activity Log ──→ Central Storage + Central Log Analytics

Production Subscription 2
├── AKS ──→ Central Log Analytics
├── Azure Firewall ──→ Central Log Analytics
└── Activity Log ──→ Central Storage + Central Log Analytics
```

**Configuration:**
- Central Log Analytics in a "management" subscription
- All subscriptions send Diagnostic Settings to the central workspace
- All subscriptions export Activity Log to central Storage + Log Analytics
- Requires appropriate RBAC in each subscription (Monitoring Contributor on central workspace)

**Trade-offs:**
- **Centralized visibility:** Single workspace for all subscriptions
- **Operational:** Fewer workspaces to manage
- **Cost:** Potential for very large ingestion bill if not monitored
- **Data transfer:** Logs cross subscription boundaries (no cost, but audit trail is clear)
- **Security:** Central team can audit all activity across multiple subscriptions

---

## Integration with Azure Monitor, Sentinel, and Defender for Cloud

### Azure Monitor

[Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/overview){:target="_blank" rel="noopener noreferrer"} is the central platform for monitoring and alerting. Activity Log and Diagnostic Settings feed into Azure Monitor.

**Azure Monitor components:**
- **Metrics** - Numeric data (CPU %, requests/sec, latency)
- **Logs** - Structured text data (Activity Log, Diagnostic Logs)
- **Alerts** - Notifications when metrics or logs match conditions
- **Dashboards** - Visualizations of metrics and log queries
- **Application Insights** - Deep monitoring for web apps and APIs

**How Activity Log feeds Azure Monitor:**
- Activity Log events are available as metric alerts (e.g., alert when X resource type is deleted)
- Activity Log events are queryable in Log Analytics
- Activity Log can trigger automated remediation via Azure Logic Apps or Automation Accounts

---

### Azure Sentinel

[Azure Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/overview){:target="_blank" rel="noopener noreferrer"} is Azure's cloud-native SIEM, designed to ingest and analyze logs from all sources.

**Sentinel + Activity Log:**
- Ingest Activity Log into Sentinel for security analysis
- Detect suspicious patterns (e.g., bulk deletion of resources, authentication failures)
- Create incident cases when threats are detected
- Correlate Activity Log with network logs (from firewalls) and application logs

**Sentinel + Diagnostic Settings:**
- Ingest resource-level logs (firewall logs, SQL audit, etc.)
- Create playbooks that automatically respond to security events
- Dashboard showing all administrative actions and security events in one view

**Common Sentinel rules with Activity Log:**
- "Multiple failed authentication attempts from same IP"
- "Deletion of audit logs or diagnostic settings"
- "Privilege elevation (Contributor role assignment to external principal)"
- "Creation of new user or service principal outside normal change windows"

---

### Defender for Cloud

[Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction){:target="_blank" rel="noopener noreferrer"} monitors your Azure resources for security vulnerabilities and compliance violations.

**Defender for Cloud + Activity Log:**
- Activity Log is used to detect suspicious administrative actions
- Defender alerts on unusual patterns (resource deletion, role assignment, policy changes)
- Compliance dashboard shows whether resources comply with standards (CIS, PCI-DSS, etc.)

**Defender for Cloud + Diagnostic Settings:**
- Requires diagnostic logs enabled for resources to perform deep security analysis
- For example, SQL Audit logs allow Defender to detect SQL injection attempts
- Firewall logs allow Defender to correlate with threat intelligence

**Security posture assessment:**
```
Defender scans all resources in subscriptions
├─ Checks configuration against benchmarks
├─ Correlates with Activity Log for recent changes
├─ Analyzes Diagnostic Logs for evidence of attacks
└─ Generates recommendations + severity scores
```

---

## Retention Policies and Archive Strategies

### Activity Log Retention Strategy

**Free (90 days):**
- Acceptable for small organizations with frequent operational reviews
- Sufficient for most incident response (investigation within 90 days)
- No setup required

**Recommended (1-2 years):**
- Export Activity Log to Log Analytics workspace (hot storage for 1-2 years)
- Export Activity Log to Storage account for archival beyond 2 years
- Supports most regulatory compliance requirements

**Compliance archival (3-7 years):**
- Export to Storage account, transition to cool/archive tiers after 1-2 years
- Minimal cost at archive tier (significantly cheaper than hot storage)
- Meets HIPAA, PCI-DSS, SOX, GDPR retention requirements

**Configuration for extended retention:**

1. Enable export from Activity Log to Log Analytics workspace (configurable retention)
2. Configure Log Analytics to export logs to Storage account (via diagnostic settings on the workspace)
3. Set Storage lifecycle policy to move to archive tier after 1-2 years
4. Document retention duration in compliance playbook

---

### Diagnostic Settings Retention Strategy

**Hot retention (30-90 days):**
- Keep recent logs in Log Analytics for active troubleshooting
- Query performance is fast
- Cost is higher compared to archive tiers

**Warm retention (31 days to 2 years):**
- Archive to Log Analytics archive tier (queries slower, cost ~10% of hot)
- Balance between query performance and cost
- Suitable for most operational analysis

**Cold retention (1-7 years):**
- Archive to Storage account blob (minimal cost)
- Queries require exporting from Storage first (manual process)
- For compliance records, not operational use

**Example tiered retention strategy:**

```
Day 1-30:    Store in Log Analytics hot (for active troubleshooting)
Day 31-90:   Archive to Log Analytics archive tier (warm queries)
Day 91-730:  Move to Storage cool tier (compliance records)
Day 731+:    Move to Storage archive tier (long-term archival)
```

**Implementation:**
- Diagnostic Settings → Send to Log Analytics + Storage account
- Log Analytics retention policy → 30 days (or 90 days if budget allows)
- Storage lifecycle policy → Move to cool after 90 days, archive after 2 years

---

## Common Pitfalls

### Pitfall 1: Relying on 90-Day Activity Log Retention for Compliance

**Problem:** Creating Activity Log exports but not configuring extended retention, assuming 90 days is enough for audit purposes.

**Result:** Compliance audit requires logs from 6+ months ago. Only 90 days exist. Audit fails or shows incomplete evidence.

**Solution:** Configure Activity Log export to Log Analytics workspace (1-2 year retention) and Storage account (archival). Document the export configuration as part of your compliance control.

---

### Pitfall 2: Not Enabling Diagnostic Settings on Critical Resources

**Problem:** Deploying Diagnostic Settings only on some resources (e.g., SQL Database) but not others (e.g., App Service, Key Vault), creating blind spots.

**Result:** Troubleshooting failures is incomplete. You cannot see what happened inside App Service. You cannot audit who accessed secrets in Key Vault.

**Solution:** Use Azure Policy to audit whether Diagnostic Settings are enabled on all resources. Create a policy with `audit` effect to identify non-compliant resources, then enforce with `deny` or auto-remediate with `deployIfNotExists`.

---

### Pitfall 3: Creating Too Many Log Analytics Workspaces

**Problem:** Creating separate workspaces for each resource type or each team without clear boundaries, resulting in dozens of workspaces.

**Result:** Operational overhead (manage retention policies in each workspace), fragmented search (cannot search across workspaces easily), cost inefficiency (separate ingestion overhead per workspace).

**Solution:** Start with a single workspace. Only split if you have a concrete requirement: data residency, RBAC isolation, or cost allocation. Most organizations operate effectively with 1-3 workspaces (central + per-environment).

---

### Pitfall 4: No Alerts for Suspicious Activity Log Events

**Problem:** Logs are being exported to Log Analytics, but no alerts are configured. The logs exist but are not actively monitored.

**Result:** Compromise or misconfiguration goes undetected for days/weeks. Compliance team finds evidence during audit that could have been caught in real-time.

**Solution:** Create metric alerts for suspicious Activity Log events:
- Deletion of resources (VMs, databases, storage accounts)
- Policy modifications or deletions
- Role assignment or removal (especially to external principals)
- Diagnostic Settings or Activity Log exports disabled
- Storage account access key regeneration

---

### Pitfall 5: Not Testing Log Archival and Retrieval

**Problem:** Configuring long-term archival to Storage account but never testing whether logs can actually be retrieved when needed.

**Result:** During compliance audit or incident investigation, discover that archival is corrupt, permissions are wrong, or the process was never fully configured.

**Solution:** Annually test:
- Export Activity Log from Storage archive and verify content is readable
- Query Log Analytics to ensure retention policy is working
- Simulate compliance audit by retrieving logs from 1 year ago
- Document the retrieval procedure in your incident response playbook

---

### Pitfall 6: Ignoring Diagnostic Settings Across Subscriptions

**Problem:** Configuring Diagnostic Settings in one subscription but not others, resulting in partial observability across your Azure estate.

**Result:** Cannot correlate events across subscriptions. Security analysis is incomplete. Compliance audit shows inconsistent logging.

**Solution:** Use Azure Policy to enforce Diagnostic Settings deployment across subscriptions. Create a policy with `deployIfNotExists` effect that automatically adds Diagnostic Settings to all new resources (Storage account, SQL Database, etc.) and routes logs to a central Log Analytics workspace.

---

## Key Takeaways

1. **Activity Log is subscription-level audit, not resource-level logging.** It records who made administrative changes and when, but not what happened inside resources. Both are needed for complete observability.

2. **Activity Log retention is only 90 days by default.** For compliance requirements (HIPAA, PCI-DSS, SOX), configure exports to Log Analytics and Storage account. The free retention is insufficient for most regulatory frameworks.

3. **Diagnostic Settings are per-resource, not automatic.** Each resource must be individually configured to send logs and metrics. Use Azure Policy to enforce Diagnostic Settings deployment at scale.

4. **Log Analytics workspace is where logs become queryable.** Once logs are in a workspace, use Kusto Query Language (KQL) to analyze, create alerts, and build dashboards. Start with a single workspace; only split for data residency or RBAC isolation.

5. **Tiered retention balances cost and compliance.** Keep recent logs hot in Log Analytics (expensive but fast queries), archive older logs to Storage cool/archive tiers (cheap, slow queries). This pattern supports both operational analysis and long-term compliance.

6. **Sentinel and Defender for Cloud require logs to be present.** These security tools analyze Activity Log, Diagnostic Logs, and network logs to detect threats. Logging is foundational to modern security operations.

7. **Activity Log can trigger automated remediation.** Combined with Azure Policy, Activity Log events can drive automatic response (disable non-compliant resources, create tickets, notify teams).

8. **Central monitoring across subscriptions requires hub-and-spoke architecture.** Send logs from all subscriptions to a central Log Analytics workspace in a management subscription. This simplifies security analysis and compliance reporting.

9. **Never delete Diagnostic Settings or disable Activity Log exports without a documented reason.** These are often compliance controls. Changes should be tracked and authorized through change management.

10. **Test your archival and retrieval process annually.** Verify that logs archived to Storage can be retrieved, that retention policies are working, and that you can satisfy compliance queries within your documented RTO/RPO.
