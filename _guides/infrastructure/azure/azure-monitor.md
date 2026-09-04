---
title: "Azure Monitor for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "The four stores Azure Monitor telemetry lands in and how data reaches each one, the table plans and retention tiers that drive Log Analytics cost, the six alert types and what they charge for, and the collection paths that decide whether you can see inside a VM at all."
tags: [observability, monitoring, log-analytics, kql, alerting, prometheus, practical]
---

## What Is Azure Monitor

[Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/overview){:target="_blank" rel="noopener noreferrer"} is the platform that collects, stores, queries, and alerts on telemetry from Azure resources, applications, and the machines they run on. Platform metrics arrive automatically. Everything else has to be routed somewhere deliberately, and where it lands determines what can query it, how long it survives, and what it costs.

### What Problems Azure Monitor Solves

**Without it:**
- Resource metrics exist per-resource with no correlation across a system
- No central destination for application, resource, and guest OS logs
- Alerting is built separately per service
- Investigation means hopping between consoles
- Nothing retains data long enough for trend analysis or audit

**With it:**
- Platform metrics collected automatically from every resource at no ingestion cost
- Log Analytics as a queryable store with KQL across all log sources
- One alerting model spanning metrics, logs, control plane events, and Prometheus
- Workbooks and Grafana for visualization and investigation
- Retention configurable from days to twelve years

### How Azure Monitor Differs from AWS CloudWatch

| Concept | AWS CloudWatch | Azure Monitor |
|---------|---|---|
| **Metrics store** | CloudWatch Metrics | Azure Monitor Metrics (platform, 93 days) |
| **Logs store** | CloudWatch Logs | Log Analytics workspace |
| **Prometheus** | Amazon Managed Service for Prometheus (separate service) | Azure Monitor workspace (managed Prometheus, built in) |
| **Application monitoring** | X-Ray plus CloudWatch | Application Insights, workspace-based |
| **Query language** | Logs Insights query syntax | KQL for logs, PromQL for Prometheus metrics |
| **Guest OS collection** | CloudWatch Agent | Azure Monitor Agent driven by data collection rules |
| **Alerts** | CloudWatch Alarms | Six alert types across metrics, logs, activity log, and Prometheus |
| **Dashboards** | CloudWatch Dashboards | Workbooks, Azure dashboards, and Azure Managed Grafana |

---

## Four Stores, Not Two

The single most useful thing to hold in your head is that Azure Monitor is not one database. Telemetry lands in one of four stores, and each has its own query language, retention model, and cost model.

```
   Store                        Holds                    Queried with        Retention
   ────────────────────────────────────────────────────────────────────────────────────
   Azure Monitor Metrics    platform + custom metrics    metrics explorer    93 days
                                                         (no KQL)            (fixed)

   Log Analytics workspace  resource logs, guest OS      KQL                 4 days to
                            logs, app telemetry,                             2 years hot,
                            custom logs                                      12 years total

   Azure Monitor workspace  Prometheus metrics           PromQL              18 months
   (separate resource)      from AKS and Arc                                 (fixed, free)

   Application Insights     requests, dependencies,      KQL (App* tables)   90 days free,
   (workspace-based, so     exceptions, traces                               then workspace
    physically in Log                                                        retention
    Analytics)
```

Application Insights is not a fifth store. A workspace-based Application Insights resource writes into a Log Analytics workspace, which is why its data is queryable in KQL alongside everything else, and why its cost shows up on the workspace bill.

The Azure Monitor workspace *is* a separate resource type, created specifically to hold Prometheus metrics, and confusing it with a Log Analytics workspace is a common early mistake.

### Choosing Where Telemetry Belongs

```
What are you collecting?

Numeric, regularly sampled, and you want cheap alerting on it?
├─ Emitted by an Azure resource automatically ──> Azure Monitor Metrics (free, 93 days)
├─ Scraped from Kubernetes or an exporter ──────> Azure Monitor workspace (Prometheus)
└─ Emitted by your own app code ────────────────> custom metrics, or App Insights metrics

Event-shaped, with fields you need to filter and correlate?
├─ You query it routinely, alert on it, or join it ──> Analytics table plan
├─ High-volume, occasionally searched, simple queries ─> Basic table plan
├─ Verbose, kept for audit, rarely read ─────────────> Auxiliary table plan
└─ Needed only for compliance retrieval ─────────────> long-term retention + search job
```

---

## Metrics

[Platform metrics](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/data-platform-metrics){:target="_blank" rel="noopener noreferrer"} are numeric time series emitted automatically by every Azure resource.

**Characteristics:**
- **Retention:** 93 days, fixed and not configurable
- **Cost:** no ingestion charge for platform metrics; custom metrics are charged
- **Resolution:** one-minute granularity for most platform metrics
- **Dimensional:** filterable and splittable by dimensions the resource publishes
- **Latency:** low, which is what makes them the right signal for threshold alerting

| Resource | Key metrics |
|----------|---|
| **Virtual Machine** | Percentage CPU, Network In/Out, Disk Read/Write Bytes, Available Memory |
| **App Service** | CPU Time, Memory Working Set, Requests, Response Time, Http5xx |
| **Azure SQL Database** | CPU percentage, Data space used, Sessions, Deadlocks |
| **Storage Account** | Transactions, Ingress/Egress, Availability, Success E2E Latency |
| **Cosmos DB** | Total Request Units, Server Side Latency, Replication Latency |
| **Load Balancer** | Data Path Availability, Health Probe Status, SNAT Connection Count |

Metrics answer "how much" and "how fast." They cannot answer "which request" or "which user," because a metric has dimensions, not fields.

---

## Logs, Table Plans, and Retention

A [Log Analytics workspace](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"} holds tables of structured events queried with KQL. What changed in recent years, and what most guidance still gets wrong, is that a table's *plan* and its *retention* are now two separate decisions.

### Table Plans

| Plan | Query behavior | Retention behavior | Fits |
|---|---|---|---|
| **Analytics** | Full KQL, joins, alerts, all features | Analytics retention 4 to 730 days, extendable to 12 years total | Data you query, alert on, and correlate |
| **Basic** | Limited KQL, queried for a fixed 30 days | Total retention configurable beyond that | High-volume logs searched occasionally |
| **Auxiliary** | Limited KQL, queryable for the whole total retention period | Long, cheap | Verbose audit and compliance logs |

Basic and Auxiliary trade query capability for a much lower ingestion price, and they are the main lever for a workspace bill dominated by one noisy table. Neither supports the full feature surface, so check that nothing alerts on the table before moving it.

### Analytics Retention and Long-Term Retention

Data in a workspace lives in one of two states. **Analytics retention** is the interactive period where data is available for queries, alerts, and features. **Long-term retention** is a cheaper state where the data is still stored but only reachable through a [search job](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/search-jobs){:target="_blank" rel="noopener noreferrer"}, which rehydrates matching records into a new searchable table.

The numbers that matter:

- Tables default to **30 days** of retention
- Analytics retention can be extended to **730 days** (two years) and reduced to as little as **4 days** via API or CLI
- **31 days of analytics retention are included in the ingestion price**, so cutting retention below 31 days saves nothing
- **Total retention extends to 12 years** (4,383 days), with everything past the analytics period sitting in long-term retention
- Shortening total retention leaves the data in place for **30 days** before deletion, so a mistake is recoverable

The old framing of "hot data in Log Analytics, archive to a storage account for cold data" is no longer how this works. Long-term retention lives in the same table, configured on the same table, and comes back through a search job. Exporting to a storage account is now a choice you make for a different reason, such as feeding an external SIEM, not the standard way to keep logs cheaply.

### Tables That Are Free for 90 Days

`Usage` and `AzureActivity` retain data for at least 90 days at no charge and are free from ingestion charges. So are the Application Insights tables: `AppRequests`, `AppDependencies`, `AppExceptions`, `AppTraces`, `AppEvents`, `AppMetrics`, `AppPageViews`, `AppBrowserTimings`, `AppAvailabilityResults`, `AppPerformanceCounters`, and `AppSystemEvents`. Raising the workspace default above 90 days extends these tables too, at which point they start costing retention.

One compliance detail: a workspace configured for 30-day retention may hold data for 31 days. If a privacy policy requires exactly 30, set `immediatePurgeDataOn30Days` to `true` through the Workspaces Update API.

### Common Log Sources

| Source | Table | What it gives you |
|--------|---|---|
| **Azure Activity Log** | `AzureActivity` | Control plane operations: creates, deletes, RBAC and policy changes |
| **Resource logs** | Resource-specific, or `AzureDiagnostics` | Per-service logs routed by diagnostic settings |
| **Application Insights** | `AppRequests`, `AppExceptions`, `AppDependencies` | Request, failure, and dependency telemetry |
| **Windows events** | `Event`, `SecurityEvent` | Guest OS event logs, collected by the agent |
| **Syslog** | `Syslog` | Linux system logs, collected by the agent |
| **Custom** | `<name>_CL` | Your own data via the Logs Ingestion API |

---

## Managed Prometheus and Azure Monitor Workspaces

[Azure Monitor managed service for Prometheus](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/prometheus-metrics-overview){:target="_blank" rel="noopener noreferrer"} runs Prometheus as a service, scraping AKS and Arc-enabled Kubernetes clusters without you operating a Prometheus server.

**What it gives you:**
- A managed, scaling metrics store with an SLA
- **18 months of retention at no additional storage cost**
- Full PromQL, including recording rules and Prometheus alert rules
- Native integration with Azure Managed Grafana, plus community dashboards
- `remote_write` support, so a self-managed Prometheus can ship metrics in during a migration

Data lands in an **Azure Monitor workspace**, a resource type distinct from a Log Analytics workspace and created solely for this purpose. There is no charge for the service or the workspace itself; you pay for ingestion and query.

For Kubernetes this splits monitoring cleanly in two. **Managed Prometheus collects the metrics.** **Container Insights collects logs and provides the drill-down views**, writing to a Log Analytics workspace. Both are enabled through the same onboarding, both use the Azure Monitor Agent in the cluster with a data collection rule, and a complete AKS monitoring setup uses both plus Grafana.

---

## How Data Actually Gets Collected

Four collection paths exist, they are not interchangeable, and mixing them up is the most common reason a team believes they are monitoring something they are not.

```
  Azure resource
       │
       ├── platform metrics ──────────────────> Azure Monitor Metrics   (automatic, free)
       │
       └── resource logs ─── diagnostic ──────> Log Analytics / Storage / Event Hub
                             setting                (opt-in, per resource, per category)

  Inside a VM (guest OS)
       │
       └── event logs, syslog, perf counters,
           IIS logs, custom text files
                     │
              Azure Monitor Agent
                     │
              data collection rule ───────────> Log Analytics workspace
                                                (agent required; nothing else sees inside)

  Application code
       │
       └── App Insights SDK / auto-instrumentation ─> Log Analytics (App* tables)

  Kubernetes
       │
       └── AMA in-cluster + DCR ──┬── metrics ─> Azure Monitor workspace (Prometheus)
                                  └── logs ────> Log Analytics (Container Insights)
```

**Diagnostic settings never collect guest OS data.** A diagnostic setting on a virtual machine routes the platform's view of that VM. It cannot see Windows event logs, syslog, application logs on disk, or in-guest performance counters, because those live inside an operating system Azure does not read. Collecting them requires the [Azure Monitor Agent](https://learn.microsoft.com/en-us/azure/azure-monitor/agents/azure-monitor-agent-overview){:target="_blank" rel="noopener noreferrer"} and a data collection rule. Teams that enable diagnostic settings on every VM and assume they have OS-level logging discover the gap during an incident.

### Data Collection Rules

A [DCR](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/data-collection-rule-overview){:target="_blank" rel="noopener noreferrer"} declares what the agent collects, how it is transformed, and where it goes. One DCR can be associated with many machines, and one machine can carry several DCRs.

| Capability | Why it matters |
|---|---|
| **Centralized definition** | Change collection for a fleet by editing one rule |
| **Multiple associations** | Layer a baseline DCR with a workload-specific one |
| **Transformations** | Filter, drop, and reshape records at ingestion, before you pay for them |
| **Multiple destinations** | Send the same source to different workspaces or table plans |

Transformations are the underused part. A KQL transformation in the DCR runs before ingestion, so dropping the 80% of syslog lines nobody reads removes them from the bill entirely rather than filtering them at query time.

Deploy at scale with Azure Policy rather than per-VM, so new machines are covered on creation instead of when someone notices.

### The Legacy Agent

The Log Analytics agent (also called MMA or OMS) is retired, and the Azure Monitor Agent is the supported agent for guest OS collection. Two related changes remove work people still plan for. **Microsoft Defender for Cloud no longer uses either agent** for its core capabilities, relying on the Defender for Endpoint agent, and **Azure Update Manager no longer uses agents at all**.

---

## Alerts

Azure Monitor has [six alert types](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-overview){:target="_blank" rel="noopener noreferrer"}, not the four that older guidance describes.

| Type | Evaluates | Notes |
|---|---|---|
| **Metric alerts** | Platform, custom, and Application Insights metrics | Static or dynamic thresholds, multiple conditions, multi-resource in one rule |
| **Log search alerts** | A KQL query over workspace data | Frequency from 1 minute to 1 day; can split by dimensions |
| **Simple log search alerts** | Each row individually | Lower latency, built for near real-time at scale |
| **Activity log alerts** | Control plane events | **Resource Health and Service Health alerts are activity log alerts** |
| **Smart detection alerts** | Application Insights telemetry | Anomaly detection with no configuration; migratable to standard alert rules |
| **Prometheus alerts** | PromQL over an Azure Monitor workspace | Rule groups stored in the workspace |

### Stateful vs Stateless

This distinction decides how noisy an alert is, and it is not configurable per rule.

**All activity log alerts are stateless.** They fire every time the condition matches, and the condition is always `fired`. There is no resolution.

**Metric and log search alerts are stateful.** They fire once and stay fired until resolved, then send a resolved notification. A metric alert resolves after the condition fails **three consecutive checks**. A log search alert resolves after a window that scales with its frequency: a 1-minute rule resolves after 10 minutes clear, a 5-to-15-minute rule after three periods, a 15-minute-to-11-hour rule after two.

For stateless metric alerts, notification cadence is roughly the configured frequency to double it, so a 15-minute rule notifies somewhere between every 15 and every 30 minutes while the condition holds.

Fired alert instances are **read-only and stored for 30 days**. Editing a rule affects future alerts only.

### Alerts Are Not Free

Metric alert rules are charged **per time series monitored**, so one rule watching 200 VMs is 200 time series, not one rule. Log search alerts that split by dimensions are likewise charged per resulting time series. This is the cost line that surprises people who assumed "metric alerts are evaluated by the platform at no cost."

### Alert Processing Rules

[Alert processing rules](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-processing-rules){:target="_blank" rel="noopener noreferrer"} modify alerts as they fire: add or suppress action groups, filter by resource or severity, and apply on a schedule. This is the correct answer to "suppress paging during the maintenance window," rather than disabling rules and forgetting to re-enable them.

### Action Groups

An action group defines who is notified and what runs. A single group can fan out to several destinations at once.

| Action | Typical use |
|---|---|
| Email, SMS, push, voice | Human notification, tiered by severity |
| Webhook / secure webhook | PagerDuty, Slack, custom endpoints |
| Azure Function, Automation runbook | Automated remediation |
| Logic App | Multi-step workflows with approval or escalation |
| ITSM connector | Incident creation in ServiceNow and similar |
| Event Hub | Streaming alerts into an external pipeline |

Action groups themselves cost nothing. The services they invoke do.

Azure also publishes **recommended alert rules** for VMs, AKS resources, and Log Analytics workspaces, and the **Azure Monitor Baseline Alerts** library deploys a curated alert set via Azure Policy, which is a faster start than authoring from zero.

---

## Visualization

**Workbooks** combine KQL queries, charts, parameters, and markdown into interactive documents. They handle investigation and reporting better than pinned charts because parameters let one workbook serve many resources and time ranges.

**Azure dashboards** are for simple pinned tiles where a workbook would be overkill.

**Grafana** is now a first-class option. Azure Managed Grafana combines Azure Monitor, Prometheus, and non-Azure data sources in one place, and Azure Monitor dashboards with Grafana provides a built-in experience for Prometheus data.

| Need | Reach for |
|---|---|
| Guided investigation with drill-down | Workbook |
| A few tiles on a team screen | Azure dashboard |
| Prometheus and PromQL dashboards | Grafana |
| Mixing Azure and non-Azure sources | Azure Managed Grafana |

---

## Service Health and Resource Health

**Service Health** reports Azure-side incidents, planned maintenance, health advisories, and upcoming service changes affecting your subscriptions. It answers "is it me or is it Azure."

**Resource Health** reports per-resource status: Available, Degraded, Unavailable, or Unknown.

Both surface as activity log events, which is how you alert on them. Because activity log alerts are stateless, a Resource Health alert fires on each qualifying event rather than opening and closing an incident.

---

## Network Monitoring

### Flow Logs Are Changing

**NSG flow logs retire on September 30, 2027, and new NSG flow logs can no longer be created.** After that date Azure stops supporting Traffic Analytics on them and deletes the NSG flow log resources from subscriptions, though records already written to Storage remain and follow their configured retention.

The replacement is [virtual network flow logs](https://learn.microsoft.com/en-us/azure/network-watcher/vnet-flow-logs-overview){:target="_blank" rel="noopener noreferrer"}, which log at the VNet level rather than per NSG and remove several NSG flow log limitations. Migration is not optional if you rely on flow data, and there are already VM sizes (the D, E, and F v6 families) where NSG flow logs are unsupported and VNet flow logs are the only option.

Two NSG flow log behaviors still matter while the feature exists. Flows are logged against the **last** NSG that allowed them, so with NSGs at both subnet and NIC level you must enable logging on both to see everything. And non-default inbound TCP rules are implemented statelessly, which distorts byte and packet counts unless you set `FlowTimeoutInMinutes` on the virtual network.

### The Rest of Network Watcher

| Tool | What it does |
|---|---|
| **Connection Monitor** | Continuous probing between endpoints, reporting success rate, latency, packet loss, and jitter |
| **Traffic Analytics** | Processes flow logs into topology, top talkers, and anomaly views. Charged per GB processed, with no free tier |
| **Packet capture** | On-demand capture for deep inspection |
| **Network Insights** | Prebuilt workbooks for VNets, load balancers, Application Gateway, ExpressRoute, and VPN gateways |

Connection Monitor is the one most environments underuse. It turns "the app can't reach the database sometimes" from a guess into a time series.

---

## VM Insights and Container Insights

**VM Insights** layers on top of AMA and a DCR to provide guest performance, running processes, listening ports, and an automatic dependency map showing what each machine talks to. The dependency map is what distinguishes it. The performance data alone is available from a plain DCR.

**Container Insights** provides the log collection and the cluster, node, pod, and container views for AKS, writing to a Log Analytics workspace. Pair it with managed Prometheus for metrics, as described above.

---

## Multi-Workspace Design

| Model | Strengths | Costs you |
|---|---|---|
| **Single central workspace** | Simple queries, easy correlation, one access boundary | Harder to attribute cost per team, and no isolation for sensitive workloads |
| **Workspace per team or app** | Clean cost attribution, team ownership, data isolation | Cross-team queries need unions, and correlation gets harder |
| **Hybrid** | Central workspace for platform and infrastructure, team workspaces for application telemetry | Requires an agreed correlation strategy |

Most enterprises land on hybrid. Whatever the split, decide the correlation mechanism up front, because retrofitting one during an incident does not work.

Cross-workspace queries use the `workspace()` function and require permissions on every workspace referenced:

```kusto
union
  (workspace("central-ws").AppRequests | where TimeGenerated > ago(7d)),
  (workspace("team-a-ws").AppRequests   | where TimeGenerated > ago(7d))
| summarize Failures = countif(Success == false) by AppRoleName
```

Workspaces are regional. Sending logs across regions incurs bandwidth charges and adds latency, which argues for at least one workspace per region in a geographically spread estate.

---

## Cost

Ingestion dominates almost every Azure Monitor bill.

**US East list prices**, from the [retail rate card](https://prices.azure.com/api/retail/prices){:target="_blank" rel="noopener noreferrer"}:

| Meter | Price |
|---|---|
| Analytics logs data ingestion | $2.30 per GB |
| Analytics logs data retention | $0.10 per GB per month |
| Platform metrics | No charge |
| Managed Prometheus storage (18 months) | No charge; ingestion and query are billed |

**The levers, roughly in order of impact:**

1. **Filter at ingestion.** DCR transformations and selective diagnostic setting categories remove data before it is billed. Query-time filtering saves nothing.
2. **Move noisy tables to Basic or Auxiliary.** A verbose table you rarely query does not need the Analytics plan.
3. **Commitment tiers.** Committing to a daily ingestion volume discounts the per-GB rate substantially, and the break-even is lower than most teams assume.
4. **Split analytics retention from total retention.** Keep 30 days interactive and push the rest to long-term retention rather than paying analytics retention for two years.
5. **Sampling** for Application Insights at high request volumes.

Remember that 31 days of retention are already in the ingestion price, so reducing retention below that is pure downside.

Watch the alert bill separately. Metric alert rules charge per monitored time series, so a multi-resource rule across a large fleet is not the free optimization it looks like.

---

## Common Pitfalls

### Pitfall 1: Assuming Diagnostic Settings Cover the Guest OS

**Problem:** diagnostic settings are enabled on every VM and treated as full coverage.

**Result:** none of the Windows event logs, syslog, application log files, or in-guest performance counters are collected. The gap is discovered during an incident, when the data that would explain it was never gathered.

**Solution:** guest OS data requires the Azure Monitor Agent plus a data collection rule. Deploy both with Azure Policy so new machines are covered automatically, and verify by querying `Event`, `Syslog`, or `Perf` for a machine you expect to see.

---

### Pitfall 2: Planning Retention Around "30 Days to 2 Years"

**Problem:** a retention design that assumes two years is the ceiling, and that anything longer means exporting to a storage account.

**Result:** either an expensive two-year analytics retention on tables that are never queried after week one, or a bespoke export pipeline built to solve a problem the platform already solves.

**Solution:** set analytics retention to what you actually query interactively, often 30 to 90 days, and set total retention up to 12 years for anything with an audit requirement. Retrieve long-term data with a search job when it is needed.

---

### Pitfall 3: Cutting Retention Below 31 Days to Save Money

**Problem:** workspace retention is reduced to 7 days as a cost measure.

**Result:** no saving, because 31 days of analytics retention are included in the ingestion price. The only outcome is less data during incidents.

**Solution:** reduce ingestion, not retention. If a table is expensive, filter it at the DCR or move it to a cheaper table plan.

---

### Pitfall 4: Treating Metric Alerts as Free

**Problem:** hundreds of metric alert rules are created across a fleet on the assumption that platform-evaluated alerts cost nothing.

**Result:** metric alert rules are billed per monitored time series. One rule covering 300 resources is 300 time series.

**Solution:** consolidate with multi-resource rules where the same threshold genuinely applies, prefer dynamic thresholds over many narrow static rules, and review the alerts line on the bill alongside ingestion.

---

### Pitfall 5: Building Maintenance Windows by Disabling Rules

**Problem:** alert rules are switched off before planned work and switched back on afterward.

**Result:** somebody forgets, and the gap is invisible until an unmonitored failure.

**Solution:** alert processing rules suppress action groups on a schedule without touching the rules themselves. The alerts still fire and are recorded; only the notifications are held.

---

### Pitfall 6: Thresholds Set Without a Baseline

**Problem:** CPU at 80% and memory at 90% are picked because they sound reasonable.

**Result:** either constant noise from workloads that normally run hot, or silence from workloads that fail well below the threshold.

**Solution:** use dynamic thresholds, which learn the pattern, or observe for a week or two before setting static ones. Remember that a metric alert only resolves after three consecutive clear checks, so a flapping signal produces long-lived alerts.

---

### Pitfall 7: Not Monitoring the Monitoring

**Problem:** nothing watches whether ingestion is still flowing.

**Result:** an agent stops reporting, a DCR association is removed, or a diagnostic setting is deleted, and the first symptom is an investigation with no data in it.

**Solution:** query the `Heartbeat` table for machines that have stopped reporting, alert on unexpected drops in the `Usage` table, and consider a `denyAction` policy on diagnostic settings so they cannot be deleted casually.

---

### Pitfall 8: Still Planning Around NSG Flow Logs

**Problem:** a network monitoring design specifies NSG flow logs and Traffic Analytics.

**Result:** new NSG flow logs cannot be created at all, and existing ones stop in September 2027 along with Traffic Analytics on them. Newer VM sizes do not support them regardless.

**Solution:** design on virtual network flow logs, and migrate existing NSG flow log configurations rather than waiting for the retirement date.

---

## Key Takeaways

1. **Azure Monitor is four stores, not one.** Metrics (93 days, fixed), Log Analytics (KQL, up to 12 years), Azure Monitor workspace for Prometheus (PromQL, 18 months), and Application Insights, which physically lives in Log Analytics.

2. **Diagnostic settings and the agent collect different things.** Diagnostic settings route the platform's view of a resource. Only the Azure Monitor Agent with a data collection rule can see inside the guest OS.

3. **Retention is two settings, not one.** Analytics retention (4 to 730 days) governs interactive querying. Total retention extends to 12 years, with the remainder reachable through search jobs.

4. **31 days of retention are included in the ingestion price.** Reducing retention below that saves nothing and costs you data.

5. **Table plans are the biggest cost lever after filtering.** Basic and Auxiliary cut ingestion cost substantially in exchange for reduced query capability.

6. **`Usage`, `AzureActivity`, and the Application Insights tables are free for 90 days.** Raising workspace retention above 90 days starts charging for them.

7. **There are six alert types, and Resource Health and Service Health alerts are activity log alerts.** All activity log alerts are stateless, so they fire repeatedly and never resolve.

8. **Metric alert rules are charged per monitored time series.** Multi-resource rules are not free consolidation.

9. **Alert processing rules are how you do maintenance windows.** Disabling rules manually is how monitoring gaps become permanent.

10. **Kubernetes monitoring is two services.** Managed Prometheus for metrics into an Azure Monitor workspace, Container Insights for logs into Log Analytics, usually with Grafana on top.

11. **NSG flow logs retire on September 30, 2027 and can no longer be created.** Virtual network flow logs are the replacement, and newer VM families support only those.

12. **Filter at ingestion, not at query time.** A DCR transformation that drops noise removes it from the bill; a `where` clause in a query does not.
