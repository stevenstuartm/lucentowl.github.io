---
title: "Azure Activity Log and Diagnostic Settings"
layout: guide
category: Azure
subcategory: Security & Compliance
description: "A system architect's guide to Azure Activity Log, diagnostic settings, and data collection rules covering the three telemetry paths, log routing destinations, Log Analytics table plans and retention, and compliance archival."
tags: [activity-log, diagnostic-settings, data-collection-rules, log-analytics, azure-monitor, log-retention, practical]
---

## What Is Azure Activity Log and Diagnostic Settings

Azure provides two complementary logging systems for different purposes. [Azure Activity Log](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/activity-log){:target="_blank" rel="noopener noreferrer"} records administrative changes across your subscription (who deployed a resource, when it was modified, and who deleted it). [Diagnostic Settings](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/diagnostic-settings){:target="_blank" rel="noopener noreferrer"} enable individual resources to emit their own logs and metrics, which are then routed to destinations like Log Analytics, Storage accounts, or Event Hubs.

These systems are foundational to observability, compliance auditing, and incident investigation on Azure. Together they answer two distinct questions: "What administrative changes happened in my subscription?" and "What is happening inside this specific resource?"

### Three Collection Paths, Three Mechanisms

Azure telemetry splits by *where the activity happens*, and each layer is collected by a different mechanism with different defaults. Activity Log and diagnostic settings cover two of the three layers, and guest OS telemetry needs a third mechanism that neither of them provides. Confusing the three is the most common reason a team believes it is logging something it is not.

```
Control plane (ARM operations: create, update, delete)
  └─► Activity log ────────────────► collected automatically, kept 90 days
                                     diagnostic setting (subscription scope)
                                     routes it onward

Data plane (operations inside a resource: read a secret, run a query)
  └─► Resource logs ───────────────► NOT collected by default
                                     diagnostic setting (resource scope)
                                     turns them on and routes them

Guest OS (Windows events, Syslog, perf counters, text and IIS logs)
  └─► Azure Monitor Agent ─────────► NOT collected by default
        + data collection rule       DCR defines what to collect and where
                                     it goes; diagnostic settings do not
                                     reach inside a VM

                    all three converge on ─► Log Analytics workspace
                                             Storage account
                                             Event Hubs
```

The scope each mechanism attaches to differs too. A diagnostic setting for **resource logs** is created on the resource itself. A diagnostic setting for the **activity log** is created at subscription scope, and a separate one can be created at **management group** scope. A **data collection rule** is a standalone resource in a subscription, associated with one or many machines, and one machine can carry several.

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
- Integration with security monitoring tools like Microsoft Defender for Cloud and Microsoft Sentinel
- Evidence of configuration changes and access patterns for incident investigation
- Automated alerts when suspicious activity occurs (via Azure Monitor)

### How Activity Log and Diagnostic Settings Differ from AWS

Architects familiar with AWS should understand how Azure's logging maps to AWS services:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Subscription-level audit trail** | CloudTrail (tracks all API calls) | Activity Log (tracks administrative actions + service health) |
| **Resource-level logs** | CloudWatch Logs (application/service logs) | Diagnostic Settings for resource logs; Azure Monitor Agent and data collection rules for guest OS logs |
| **Log storage and analysis** | CloudWatch Logs + S3 archival | Log Analytics workspace + Storage account archival |
| **Central logging configuration** | CloudTrail + CloudWatch Log Groups | Activity Log + Diagnostic Settings (per resource) |
| **Security monitoring** | GuardDuty + CloudTrail analysis | Defender for Cloud + Sentinel |
| **Configuration change tracking** | AWS Config | Azure Policy + Activity Log |
| **Event stream ingestion** | Kinesis Data Streams | Event Hubs |
| **Log retention** | CloudTrail event history: 90 days free; longer needs a trail to S3 | Activity Log: 90 days free; beyond requires a diagnostic setting |
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

**Extended retention:** create a diagnostic setting at subscription scope
- Send to a Log Analytics workspace: lands in the `AzureActivity` table and can be kept up to 12 years
- Send to a Storage account: retain indefinitely at minimal cost, with blobs written hourly as `PT1H.json`
- Send to Event Hubs: stream events to a third-party SIEM or other external system

**Activity log ingestion into Log Analytics is free.** `AzureActivity` is one of a handful of tables Microsoft exempts from ingestion charges, and it keeps 90 days at no cost even inside a workspace. Retention charges start only past that 90-day mark. That makes exporting the activity log to a workspace close to free at the volumes most subscriptions generate, which is a different economic picture from resource logs.

**Practical implication:** For compliance audits requiring 2+ years of historical data, you must configure a diagnostic setting. The 90-day free retention is insufficient for most regulatory frameworks. The activity log is also the only place Azure records who *created* a resource, so if that matters to you, export it before the 90 days elapse.

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
| **Virtual Machines** | Host platform metrics only. Guest OS event logs, Syslog, and performance counters come from Azure Monitor Agent and a data collection rule, not from a diagnostic setting |
| **App Service** | HTTP requests, failed requests, detailed error logs, performance metrics |
| **Azure SQL Database** | Query execution, deadlocks, long-running queries, audit logs |
| **Azure Firewall** | Network traffic rules, denied connections, rule execution logs |
| **Azure Kubernetes Service (AKS)** | API server logs, audit logs, controller-manager logs, kubelet logs |
| **Key Vault** | Access audit (who accessed secrets), failed operations |
| **API Management** | API request/response logs, performance metrics |
| **Storage Account** | Read/write/delete operations, access patterns, performance metrics |
| **Azure Bastion** | Session logs, failed connection attempts |

**Metrics emitted by resources:**

Azure resources emit platform metrics automatically, with no diagnostic setting required, and Azure Monitor Metrics keeps them for 93 days. What is available depends on the resource type: a VM's host metrics cover CPU, disk, and network, but *not* memory, because memory is a guest OS counter that requires the Azure Monitor Agent. Use a diagnostic setting for metrics only when you need them in a workspace for KQL analysis alongside logs. Not every metric is exportable that way, and multidimensional metrics arrive flattened and aggregated across their dimensions.

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
   - Azure Monitor partner solutions (Datadog, Elastic, Dynatrace, and others)

Rather than pick categories one by one, most resources also offer **category groups**: `allLogs` for every category the resource emits, and `audit` for the categories recording customer interaction with data or settings. Category groups track the service, so a category added later is collected automatically. The trade-off is that you can't mix a category group with individually selected categories in the same setting.

**Constraints that shape the design:**

| Constraint | Consequence |
|------------|-------------|
| Five diagnostic settings per resource | A hard ceiling. Exceeding it fails, so plan settings per destination rather than per team |
| One destination of each type per setting | Sending to two workspaces takes two settings, not one setting with two workspaces |
| Storage and Event Hubs must be in the resource's region | Rules out a single global archive account for a multi-region estate |
| Firewalled Storage or Event Hubs | Requires "Allow trusted Microsoft services" or the setting silently delivers nothing |
| Premium and DNS-zone-endpoint Storage accounts are unsupported | Archive to a Standard account |
| Settings outlive the resource | Delete the setting when you delete, rename, or move a resource, or a later resource with the same ID can inherit it |

Data starts flowing within about 90 minutes of creating a setting, and the destination table in Log Analytics is created only when the first record lands. An empty table is not necessarily a broken setting.

**Common destination patterns:**

| Destination | Use Case | Cost | Retention |
|------------|----------|------|-----------|
| **Log Analytics** | Real-time analysis, KQL queries, alerts | Pay-as-you-go per GB ingested, or a commitment tier | Configurable per table, 30 days by default, up to 12 years |
| **Storage account** | Long-term archival, compliance, cost-effectiveness | Minimal (per GB/month) | Indefinite (configure lifecycle) |
| **Event Hub** | Stream real-time events to on-premises, third-party tools | Pay per throughput unit | A transit buffer, not a store. Events expire after the namespace's configured retention, typically 1-7 days |

**Architectural decision:** Send logs to Log Analytics for operational analysis and keep them there for the long haul as well. In-workspace long-term retention now reaches 12 years, which removes most of the old reason to copy logs out to a Storage account. Keep the Storage path for the cases it still wins: immutable blobs for regulators who require write-once storage, and estates already built around blob lifecycle policies.

### Log Analytics Workspace

A [Log Analytics workspace](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"} is a central repository where logs from all Diagnostic Settings are aggregated and indexed. Once in Log Analytics, logs can be queried, analyzed, and retained.

**Workspace characteristics:**
- **Regional resource** - A workspace exists in a single Azure region
- **Shared by multiple resources** - Multiple resources send logs to the same workspace
- **Queryable with KQL** - Use Kusto Query Language to search logs and create alerts
- **Retention configured per table** - The workspace sets a default, and any table can override it
- **Priced per GB ingested** - Ingestion is the primary cost driver, with retention beyond the included period billed separately

**Multi-workspace patterns:**

| Pattern | When to Use |
|---------|-----------|
| **Single workspace** | Small environments, single team, simple compliance requirements |
| **Per-environment** | Dev, staging, production have separate workspaces (easier RBAC) |
| **Per-region** | Data residency compliance requires logs stay in region, so separate workspace per region |
| **Per-customer** | Multi-tenant SaaS where each customer's logs must be isolated |

**Common mistake:** Creating too many workspaces. Each workspace has overhead (separate retention, separate costs, separate RBAC). Start with a single workspace; only split when you have a specific requirement (data residency, compliance boundary, cost allocation).

### Table Plans

Cost control in a workspace starts one level above retention, at the **table plan**. Every table carries one, and it decides what the data costs to ingest and what you are allowed to do with it.

| | Analytics | Basic | Auxiliary (Lake) |
|---|---|---|---|
| **Best for** | High-value data driving monitoring, detection, and alerts | Troubleshooting and incident response | Verbose, low-touch logs kept for audit and compliance |
| **Ingestion cost** | Standard | Reduced | Minimal |
| **Query cost** | Included | Per query | Per query |
| **Query capability** | Full KQL, cross-table and resource-scoped | Full KQL on one table, extendable via `lookup` | Full KQL on one table, and slow |
| **Alerts** | Yes | Simple log alerts only | No |
| **Analytics retention** | 30 days by default, extendable to 2 years | Not applicable | Not applicable |
| **Total retention** | Up to 12 years | Up to 12 years | Up to 12 years |

Basic and Auxiliary are unavailable on workspaces still in legacy pricing tiers. Firewall, proxy, and NetFlow logs are the canonical Auxiliary candidates: enormous, rarely queried, and required by an auditor rather than an on-call engineer.

### Log Retention and Archival

Retention inside a workspace has two states, and the old "archive tier" vocabulary has been retired in favor of them:

| State | Duration | What you can do with the data |
|-------|----------|-------------------------------|
| **Analytics retention** | 30 days by default (90 for `AzureActivity`, `Usage`, Application Insights, and Sentinel workspaces), configurable from 4 to 730 days | Interactive KQL queries, alerts, workbooks, insights |
| **Long-term retention** | The remainder of a total retention period set up to 12 years (4,383 days) | Not queryable directly. Run a **search job** to pull the records you need into a searchable results table |

The two are configured as one pair. You set analytics retention and a **total** retention, and the gap between them is the long-term period. Lowering analytics retention while leaving total retention alone converts the difference to low-cost long-term storage rather than deleting anything.

Two numbers change the intuition here. The first 31 days of analytics retention are included in the ingestion price, so dropping a table below 31 days saves nothing. And shortening total retention doesn't delete immediately. Azure Monitor waits 30 days before removing the data, so a misconfiguration is recoverable.

**Choosing where data should live:**

```
Is the data needed for alerts, dashboards, or interactive investigation?
├── Yes ──► Analytics plan
│           └── How far back do you investigate interactively?
│               ├── Weeks      ──► 30-90 days analytics retention
│               └── Months     ──► extend analytics retention (max 730 days)
│
└── No ───► Is it queried occasionally during incidents?
            ├── Yes ──► Basic plan (single-table KQL, reduced ingestion)
            └── No ───► Auxiliary plan (audit and compliance only)

Then, for anything an auditor may ask for later:
  set TOTAL retention out to the required horizon (up to 12 years)
  └── retrieve with a search job, not an interactive query
```

**When a Storage account still earns its place:**
- Regulators requiring immutable, write-once storage (set an immutability policy on the container)
- Estates with existing blob lifecycle tooling for cool and archive tiers
- Feeding an external system that reads blobs rather than querying a workspace

---

## Azure Policy Auditing and Compliance

### How Azure Policy Relates to Logging

[Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview){:target="_blank" rel="noopener noreferrer"} evaluates resources against compliance rules and can trigger remediation actions. The audit trail is split across two places, which trips people up: the **Activity Log** records policy *actions* (a denied deployment, a remediation task that ran, an assignment that changed), while ongoing **compliance state** lives in Azure Policy and is queryable through Azure Resource Graph's `PolicyResources`. A resource that has been quietly non-compliant for six months generates compliance state continuously but produces no fresh Activity Log entries, so an alert built only on the Activity Log will never fire for it.

**Policy effects relevant to logging:**

| Effect | Behavior | Where the trail appears |
|--------|----------|-------------------------|
| **Audit** | Resource is allowed; non-compliance is recorded | Compliance state; a warning event on the create or update |
| **AuditIfNotExists** | Flags a resource whose related child or extension resource is missing, which is how "diagnostic settings not enabled" is detected | Compliance state |
| **Deny** | Non-compliant creation or modification is blocked | Activity Log shows the denied action and reason |
| **DenyAction** | Blocks a specific operation, most usefully `delete`, so logging config can't be removed | Activity Log shows the blocked operation |
| **Append / Modify** | Adds or changes properties and tags on the request | Activity Log shows the resulting write |
| **DeployIfNotExists** | Deploys the missing related resource, which is how diagnostic settings get applied at scale | Activity Log shows the remediation deployment |

Effects are evaluated in a fixed order rather than all at once: `disabled` first, then `append` and `modify`, then `deny`, then `audit`, `manual`, and `auditIfNotExists`, with `denyAction` last. `deployIfNotExists` and `auditIfNotExists` run only after the resource provider returns success, because they inspect something that has to exist first.

**Example policy evaluation:**

```
Policy: "All VMs must have backup enabled"
├─ Effect: AuditIfNotExists  (backup is a related resource, not a VM property)
├─ Evaluation: does a recovery services protected item exist for this VM?
├─ Result: none found, so the VM is marked non-compliant
├─ Compliance state: queryable in Azure Policy and Resource Graph
└─ Pair with DeployIfNotExists to remediate; Modify cannot do this,
   because it edits properties on the resource, not adjacent resources
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

Activity Log (subscription-wide) ──→ one diagnostic setting per destination workspace
```

**Configuration:**
- Separate workspace per region where resources are deployed
- Resources send Diagnostic Settings only to workspace in their region
- The activity log does **not** replicate itself to every workspace. It goes only where a diagnostic setting sends it, and because one setting can name only a single workspace, landing it in two regional workspaces takes two separate subscription-scope settings

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
- A diagnostic setting on a management group captures the activity log for that group and everything beneath it, so one setting on the top management group replaces per-subscription settings. Keeping both produces duplicate events, and Microsoft's guidance is to accept duplicates rather than risk gaps, then deduplicate at query time with `summarize arg_max(TimeGenerated, *) by hash(dynamic_to_json(pack_all()))`

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
- **Activity log alerts** fire directly off the log with no workspace involved. They match on category, operation, resource type, and status, which covers "alert when any VM is deleted" but not much more
- **Log search alerts** run KQL against the `AzureActivity` table and handle the logic activity log alerts can't, like thresholds, joins, and time-window correlation. They require the diagnostic setting to a workspace to exist first
- Either kind can trigger automated remediation through an action group calling a Logic App, Automation runbook, or webhook

---

### Microsoft Sentinel

[Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/overview){:target="_blank" rel="noopener noreferrer"} is Azure's cloud-native SIEM, designed to ingest and analyze logs from all sources. It runs on a Log Analytics workspace, so everything about table plans and retention above applies to it directly, with one difference: enabling Sentinel raises the workspace's included retention from 30 days to 90. Note also that Sentinel's own experience is moving out of the Azure portal into the Microsoft Defender portal, and **after March 31, 2027** the Azure portal version is gone.

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

### Microsoft Defender for Cloud

[Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction){:target="_blank" rel="noopener noreferrer"} monitors your Azure resources for security vulnerabilities and compliance violations.

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
- Send the Activity Log to a Log Analytics workspace and extend `AzureActivity`'s analytics retention to cover the window you actually investigate
- Ingestion is free and the first 90 days of retention are free, so the marginal cost is only the period past 90 days
- Supports most regulatory compliance requirements

**Compliance archival (3-12 years):**
- Set `AzureActivity`'s **total** retention out to the required horizon, up to 12 years, and leave analytics retention short
- Retrieve older records with a search job when an auditor asks
- Meets HIPAA, PCI-DSS, SOX, GDPR retention requirements without a second copy in Storage

**Configuration for extended retention:**

1. Create a subscription-scope diagnostic setting sending the Activity Log to a Log Analytics workspace
2. On the `AzureActivity` table, set analytics retention to your investigation window and total retention to your compliance horizon
3. Add a Storage destination only if a regulator requires immutable, write-once copies
4. Document retention duration in your compliance playbook

---

### Diagnostic Settings Retention Strategy

Resource logs are where volume and cost actually accumulate, so tier them by table rather than treating the workspace as one bucket.

**Analytics retention (30-730 days):**
- Recent logs stay interactively queryable for troubleshooting, alerting, and dashboards
- The first 31 days are already paid for in the ingestion price, so shortening below that saves nothing
- Extend past 90 days only for tables you genuinely query that far back

**Long-term retention (out to 12 years total):**
- The same table holds the data at a fraction of the price once analytics retention lapses
- Retrieval is a search job, which materializes matching records into a results table you can then query normally
- This is the replacement for the old archive tier, and it removes the need to copy logs into Storage for most compliance cases

**Cutting volume before it lands:**
- Enable only the log categories you need per resource. Diagnostic settings can't filter within a category
- For anything arriving through a data collection rule, add a **transformation** to drop rows or columns at ingestion
- Skip `AllMetrics` unless you specifically need metrics in KQL. Platform metrics are already collected for free and available in metrics explorer
- Move high-volume, rarely-queried tables to the Basic or Auxiliary plan rather than paying Analytics ingestion for them

**Example tiered retention strategy:**

```
Security and audit tables   Analytics 90 days  → total 7 years
Application resource logs   Analytics 30 days  → total 1 year
Firewall / proxy / NetFlow  Auxiliary plan     → total 7 years
Platform metrics            no workspace copy; metrics explorer keeps 93 days
```

---

## Common Pitfalls

### Pitfall 1: Relying on 90-Day Activity Log Retention for Compliance

**Problem:** Creating Activity Log exports but not configuring extended retention, assuming 90 days is enough for audit purposes.

**Result:** Compliance audit requires logs from 6+ months ago. Only 90 days exist. Audit fails or shows incomplete evidence.

**Solution:** Create a subscription-scope diagnostic setting sending the Activity Log to a Log Analytics workspace, then set the `AzureActivity` table's total retention to your compliance horizon, up to 12 years. Ingestion is free and the first 90 days of retention are free, so this is one of the cheapest compliance controls available. Document the setting as part of that control.

---

### Pitfall 2: Not Enabling Diagnostic Settings on Critical Resources

**Problem:** Deploying Diagnostic Settings only on some resources (e.g., SQL Database) but not others (e.g., App Service, Key Vault), creating blind spots.

**Result:** Troubleshooting failures is incomplete. You cannot see what happened inside App Service. You cannot audit who accessed secrets in Key Vault.

**Solution:** Use Azure Policy to find the gaps and close them. Because a diagnostic setting is a child resource rather than a property, the effect that detects a missing one is `auditIfNotExists`, and the one that creates it is `deployIfNotExists`. Azure ships built-in initiatives that deploy diagnostic settings to a named workspace across whole resource types. Remember the five-settings-per-resource ceiling when a policy-deployed setting lands on resources that already have their own.

---

### Pitfall 3: Creating Too Many Log Analytics Workspaces

**Problem:** Creating separate workspaces for each resource type or each team without clear boundaries, resulting in dozens of workspaces.

**Result:** Operational overhead (manage retention policies in each workspace), fragmented search (cannot search across workspaces easily), cost inefficiency (separate ingestion overhead per workspace).

**Solution:** Start with a single workspace. Only split if you have a concrete requirement: data residency, RBAC isolation, or cost allocation. Most organizations operate effectively with 1-3 workspaces (central + per-environment).

---

### Pitfall 4: No Alerts for Suspicious Activity Log Events

**Problem:** Logs are being exported to Log Analytics, but no alerts are configured. The logs exist but are not actively monitored.

**Result:** Compromise or misconfiguration goes undetected for days/weeks. Compliance team finds evidence during audit that could have been caught in real-time.

**Solution:** Use activity log alerts for the simple category-and-operation matches, and log search alerts on `AzureActivity` where the logic needs a threshold or a correlation. Cover at least:
- Deletion of resources (VMs, databases, storage accounts)
- Policy modifications or deletions
- Role assignment or removal (especially to external principals)
- Diagnostic Settings or Activity Log exports disabled
- Storage account access key regeneration

For the logging configuration itself, an alert is the second line of defense. The first is a `denyAction` policy on `delete` for diagnostic settings, which blocks the removal rather than telling you about it afterward.

---

### Pitfall 5: Not Testing Log Archival and Retrieval

**Problem:** Configuring long-term archival to Storage account but never testing whether logs can actually be retrieved when needed.

**Result:** During compliance audit or incident investigation, discover that archival is corrupt, permissions are wrong, or the process was never fully configured.

**Solution:** Annually test:
- Run a search job against a table in long-term retention and confirm records come back for the period you claim to cover
- Verify the analytics and total retention actually set on each table, rather than assuming the workspace default applied. A table with its own override ignores changes to the workspace default
- Export from Storage archive and verify the blobs are readable, if you keep a Storage copy
- Document the retrieval procedure, including search job latency, in your incident response playbook

---

### Pitfall 6: Ignoring Diagnostic Settings Across Subscriptions

**Problem:** Configuring Diagnostic Settings in one subscription but not others, resulting in partial observability across your Azure estate.

**Result:** Cannot correlate events across subscriptions. Security analysis is incomplete. Compliance audit shows inconsistent logging.

**Solution:** Use Azure Policy to enforce Diagnostic Settings deployment across subscriptions. Create a policy with `deployIfNotExists` effect that automatically adds Diagnostic Settings to all new resources (Storage account, SQL Database, etc.) and routes logs to a central Log Analytics workspace.

---

## Key Takeaways

1. **Activity Log is subscription-level audit, not resource-level logging.** It records who made administrative changes and when, but not what happened inside resources. Both are needed for complete observability.

2. **Activity Log retention is only 90 days by default.** For compliance requirements (HIPAA, PCI-DSS, SOX), create a subscription-scope diagnostic setting to a Log Analytics workspace and extend the `AzureActivity` table's total retention, up to 12 years. Ingestion is free and the first 90 days of retention are free, so the cost is small. The activity log is also the only record of who created a resource.

3. **Diagnostic Settings are per-resource, not automatic, and they don't reach inside a VM.** Each resource needs its own setting, capped at five, to emit resource logs. Guest OS events, Syslog, and performance counters are a separate path entirely: Azure Monitor Agent driven by a data collection rule. Use Azure Policy (`auditIfNotExists` to detect, `deployIfNotExists` to fix) to enforce diagnostic settings at scale.

4. **Log Analytics workspace is where logs become queryable.** Once logs are in a workspace, use Kusto Query Language (KQL) to analyze, create alerts, and build dashboards. Start with a single workspace; only split for data residency or RBAC isolation.

5. **Table plan first, then retention.** The plan (Analytics, Basic, or Auxiliary) sets what ingestion costs and what you can do with the data. Retention then splits into analytics retention up to 730 days and a total retention up to 12 years, with long-term data retrieved by search job. In-workspace long-term retention has largely replaced copying logs to a Storage account, which is now for immutability requirements rather than for cost.

6. **Sentinel and Defender for Cloud require logs to be present.** These security tools analyze Activity Log, Diagnostic Logs, and network logs to detect threats. Logging is foundational to modern security operations.

7. **Activity Log records actions; Azure Policy records compliance state.** Activity log alerts and log search alerts on `AzureActivity` catch the moment something is denied, deployed, or deleted, and can drive automated response through action groups. Ongoing non-compliance produces no new Activity Log entries, so query policy compliance through Azure Resource Graph instead of expecting an alert to fire.

8. **Central monitoring across subscriptions requires hub-and-spoke architecture.** Send logs from all subscriptions to a central Log Analytics workspace in a management subscription. This simplifies security analysis and compliance reporting.

9. **Never delete Diagnostic Settings or disable Activity Log exports without a documented reason.** These are often compliance controls. Changes should be tracked and authorized through change management.

10. **Test your archival and retrieval process annually.** Verify that logs archived to Storage can be retrieved, that retention policies are working, and that you can satisfy compliance queries within your documented RTO/RPO.
