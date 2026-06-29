---
title: "Azure Monitor for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "A comprehensive guide to Azure Monitor covering metrics, logs, alerts, workbooks, Log Analytics workspaces, and architectural patterns for unified observability across Azure resources."
tags: [azure, observability, monitoring, infrastructure, cloud-computing, reliability, practical]
---

## What Is Azure Monitor

[Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/overview){:target="_blank" rel="noopener noreferrer"} is the central platform for collecting, analyzing, and alerting on observability data across your Azure estate. It captures three fundamental types of data: metrics (numerical measurements at specific points in time), logs (detailed events and traces), and application performance data.

Unlike point solutions that monitor individual services, Azure Monitor is deeply integrated into the Azure platform. Resource metrics flow automatically to Azure Monitor. Logs are centralized in Log Analytics workspaces. Alerts, dashboards, and analysis tools operate on this unified data.

### What Problems Azure Monitor Solves

**Without Azure Monitor:**
- Resource metrics exist in isolation; no central view of system health
- No structured place to store application and resource logs
- Alerting must be built separately for each service or resource
- Root cause analysis requires hopping between multiple tools
- No consistent way to visualize infrastructure and application state
- Long-term trend analysis and capacity planning become manual

**With Azure Monitor:**
- Centralized collection of metrics from all Azure resources
- Log Analytics workspace as the central destination for all logs and traces
- Unified alerting with action groups and notification routing
- Workbooks and dashboards for custom visualizations
- Structured querying with KQL (Kusto Query Language) for analysis
- Historical data retention for trend analysis and forecasting
- Integration with Azure Advisor for best practice recommendations
- Application Insights for deep application performance monitoring

### How Azure Monitor Differs from AWS CloudWatch

Architects moving from AWS to Azure should understand these key differences:

| Concept | AWS CloudWatch | Azure Monitor |
|---------|---|---|
| **Core data types** | Metrics + Logs (CloudWatch Logs) | Metrics + Logs (Log Analytics) + Application Insights |
| **Logs destination** | CloudWatch Logs (separate service) | Log Analytics workspace (integrated) |
| **Application monitoring** | X-Ray or CloudWatch Insights | Application Insights (built-in) |
| **Metrics query language** | CloudWatch Insights (limited) | KQL (Kusto Query Language, full SQL-like syntax) |
| **Alerts** | CloudWatch Alarms | Azure Monitor Alerts (metric, log, activity) + Smart Detection |
| **Dashboards** | CloudWatch Dashboards | Azure Dashboards or Workbooks (more flexible) |
| **Logs ingestion cost** | Per GB ingested | Per GB ingested and retained |
| **Resource metrics** | Auto-collected | Auto-collected |
| **Agent-based monitoring** | CloudWatch Agent | Azure Monitor Agent (AMA) with data collection rules |

---

## Core Azure Monitor Components

### Metrics

[Metrics](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/data-platform-metrics){:target="_blank" rel="noopener noreferrer"} are numerical measurements at specific points in time, collected at regular intervals (typically every 1-5 minutes for platform metrics). Every Azure resource automatically emits metrics to Azure Monitor.

**Metric characteristics:**
- **Time-series data:** Values associated with timestamps
- **Dimensional:** Metrics can be filtered by dimensions (e.g., VM metric filtered by VM name, storage account metric filtered by container)
- **Real-time:** Low latency between measurement and availability
- **Retention:** Platform metrics retained for 93 days
- **Cost:** No ingestion cost; you only pay for metric queries and alerts
- **Resolution:** 1-minute granularity for most platform metrics

**Common Azure resource metrics:**

| Resource | Key Metrics |
|----------|---|
| **Virtual Machine** | CPU Percentage, Network In/Out, Disk Read/Write Bytes, Available Memory |
| **App Service** | CPU Time, Memory Working Set, Request Count, Response Time |
| **Azure SQL Database** | CPU Percentage, Data Space Used, Active Connections, Deadlock Count |
| **Storage Account** | Transactions, Ingress/Egress, Availability |
| **Azure Cosmos DB** | Request Units, Latency, Replication Lag |
| **Load Balancer** | Data Path Availability, Health Probe Status, Backend Health |

**When to use metrics:**
- Detect resource state changes in real-time
- Trigger alerts on performance thresholds
- Identify trends over hours, days, or months
- Monitor resource capacity and utilization

### Logs and Log Analytics

[Log Analytics workspaces](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"} are the central repositories for all logs and traces. Resources, applications, and services send structured log data to workspaces where it can be queried, analyzed, and retained for long periods.

**Log Analytics characteristics:**
- **Centralized storage:** All logs from VMs, applications, and services in one place
- **Structured schema:** Logs stored as tables with columns (e.g., `AzureActivity`, `SecurityEvent`, `AppTraces`)
- **Long retention:** Configurable retention from 30 days to 2 years (configurable per table)
- **KQL querying:** SQL-like language for querying and aggregating log data
- **Cost model:** Per GB of data ingested and per GB retained (retention charges applied daily)
- **Ingestion rate:** Default 6 GB per minute per workspace (higher with support request)

**Common log sources:**

| Source | Log Table | Use Case |
|--------|---|---|
| **Azure Activity Log** | `AzureActivity` | Track Azure control plane operations (resource creation, deletions, RBAC changes) |
| **Resource Diagnostics** | Service-specific (e.g., `AzureDiagnostics`) | VM logs, app logs, database logs, firewall logs |
| **Application Insights** | `AppTraces`, `AppExceptions`, `AppRequests` | Application performance, errors, dependencies |
| **Security Events** | `SecurityEvent` | Windows event logs from VMs |
| **Syslog** | `Syslog` | Linux system logs |
| **Custom Logs** | User-defined tables | Application custom telemetry |

**When to use Log Analytics:**
- Store structured log data from applications and services
- Query logs with SQL-like syntax to find patterns
- Correlate events across systems
- Investigate incidents and debug failures
- Build long-term audits and compliance records

### Application Insights

[Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview){:target="_blank" rel="noopener noreferrer"} is a specialized monitoring service for application performance. It automatically collects request rates, response times, failure rates, dependency tracking, and exceptions from your application code.

**Application Insights characteristics:**
- **Automatic instrumentation:** SDKs collect data with minimal code changes
- **Request tracking:** Each request and its downstream calls are traced
- **Dependency tracking:** Automatic tracking of calls to databases, external APIs, and other services
- **Correlation IDs:** Requests and related operations are linked across services
- **Sampling:** Automatic adaptive sampling reduces cost at high volumes
- **Maps and live metrics:** Real-time view of application health and dependency relationships
- **Logs sink:** App Insights data flows to Log Analytics for long-term querying

**When to use Application Insights:**
- Monitor application request volume, response time, and failure rates
- Track performance regressions or anomalies
- Understand application dependencies and call chains
- Diagnose slow requests or exceptions in production

---

## Metrics vs Logs: When to Use Which

The choice between metrics and logs depends on the data pattern and analysis goal:

| Aspect | Use Metrics | Use Logs |
|--------|---|---|
| **Data type** | Numerical time-series | Structured events with many fields |
| **Query speed** | Seconds (optimized for time-series) | Seconds to minutes (depending on volume) |
| **Cost at scale** | Lower (no ingestion cost) | Higher (ingestion + retention cost) |
| **Retention** | 93 days (platform metrics) | Configurable (30 days to 2 years) |
| **What to track** | Resource utilization, performance (CPU, memory, requests) | Detailed events, errors, audit trails |
| **Real-time alerting** | Best choice for simple thresholds | For complex multi-condition alerts |
| **Time-series visualization** | Natural fit (dashboards, trending) | Possible but requires aggregation |
| **Drill-down investigation** | Limited (only metric dimensions) | Excellent (rich event context) |

**In practice:** Use metrics for alerting and dashboards. Use logs for investigation, troubleshooting, and building a historical audit trail.

---

## Azure Monitor Agent and Data Collection Rules

The [Azure Monitor Agent](https://learn.microsoft.com/en-us/azure/azure-monitor/agents/azure-monitor-agent-overview){:target="_blank" rel="noopener noreferrer"} (AMA) is the modern replacement for legacy agents (Diagnostic Extension, Log Analytics Agent). It collects performance data, logs, and traces from VMs and sends them to Log Analytics workspaces and/or metrics backend.

### How AMA Works

AMA is deployed to a VM and configured via [Data Collection Rules](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/data-collection-rule-overview){:target="_blank" rel="noopener noreferrer"} (DCRs). A DCR specifies which data to collect (performance counters, event logs, syslog) and where to send it (Log Analytics workspace, metrics).

**DCR advantages over legacy agents:**
- **Centralized configuration:** Rules apply to multiple VMs at once
- **Per-VM customization:** Override rules for specific VMs
- **Lower overhead:** More efficient data collection and filtering
- **Transformations:** Filter, parse, and enrich data before ingestion
- **Cost optimization:** Collect only the data you need

**Common DCR configurations:**

| Configuration | Collects | Sends To |
|---|---|---|
| **VMs Insights** | Performance counters (CPU, memory, disk, network) | Metrics + Log Analytics |
| **Windows Event Log** | Application, Security, System event logs | Log Analytics |
| **Syslog** | Linux system logs | Log Analytics |
| **Custom Logs** | Application-generated files with structured format | Log Analytics |

### Deployment Patterns

**Per-VM deployment:** Assign AMA and a DCR to each VM individually. Use when VMs have unique monitoring needs.

**At-scale deployment:** Use [VM extensions or Azure Policy](https://learn.microsoft.com/en-us/azure/azure-monitor/agents/agent-data-collection-rule-deployments){:target="_blank" rel="noopener noreferrer"} to deploy AMA and associate DCRs to groups of VMs based on tags or resource groups. This is the recommended production approach.

---

## Alert Types

Azure Monitor supports four types of alerts, each suited for different scenarios:

### Metric Alerts

Metric alerts trigger when a metric exceeds a threshold or crosses a boundary condition. They are low-latency (evaluated every 1-5 minutes) and ideal for resource utilization thresholds.

**Trigger conditions:**
- Static threshold (CPU > 80%)
- Dynamic threshold (anomaly detection based on historical patterns)
- Multiple conditions (all must be true to trigger)

**Characteristics:**
- Evaluated frequently (near real-time)
- Scoped to a single resource or dimension
- Lower cost (evaluated at the Azure platform level)

**When to use:** Alert on VM CPU, memory, disk space, network saturation, or application response time thresholds.

### Log Alerts

Log alerts execute KQL queries on data in Log Analytics workspaces. They can aggregate data across multiple resources and perform complex analysis before triggering.

**Example triggers:**
- Count of failed requests > 10 in the last 5 minutes
- Specific error pattern in application logs
- Security event that matches a detection rule

**Characteristics:**
- Evaluated less frequently (every 5-60 minutes, configurable)
- Can aggregate data across resources
- Higher latency than metric alerts
- Can include complex business logic

**When to use:** Detect specific error patterns, security events, or correlate data across multiple log sources.

### Activity Log Alerts

Activity log alerts trigger on Azure control plane events (resource creation, deletion, role assignments, policy changes). They monitor what happened to your Azure infrastructure itself.

**Common triggers:**
- Resource deleted
- RBAC role assigned to a user
- Virtual Machine stopped
- Azure Policy assignment changed

**When to use:** Track infrastructure changes, monitor for unauthorized operations, or notify when key resources are modified.

### Smart Detection

[Smart Detection](https://learn.microsoft.com/en-us/azure/azure-monitor/app/smart-detection){:target="_blank" rel="noopener noreferrer"} (part of Application Insights) automatically detects anomalies in application telemetry using machine learning.

**Detects:**
- Abnormal increase in failure rates
- Performance degradation compared to historical baselines
- Unusual patterns in exception counts or response times
- Abnormal memory usage patterns

**Characteristics:**
- No configuration required
- Runs in the background on Application Insights data
- Identifies anomalies that might not trigger threshold-based alerts

**When to use:** Catch unexpected application behavior changes that wouldn't trigger traditional threshold alerts.

---

## Action Groups and Notification Routing

[Action groups](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups){:target="_blank" rel="noopener noreferrer"} define how alerts are routed and who gets notified. A single action group can trigger multiple actions (email, SMS, webhook, runbook execution, incident creation).

**Notification types:**

| Action Type | Use Case |
|---|---|
| **Email** | Immediate notification to team members |
| **SMS** | Critical alerts requiring immediate action |
| **Push notification** | Mobile app notification |
| **Webhook** | Integrate with external systems (PagerDuty, Slack, custom tools) |
| **Azure Function/Runbook** | Automated remediation (restart service, scale resources) |
| **Logic App** | Complex workflows (approval, notification, escalation) |
| **ITSM Connector** | Create incidents in ServiceNow, Jira, or other ITSM tools |

**Action group design pattern:**

```
Alert triggered
    ↓
Action Group evaluates
    ↓
├─ Email: on-call team
├─ Slack: team-alerts channel
├─ Webhook: PagerDuty (page engineer if critical)
└─ Logic App: auto-restart service and notify
```

**Cost considerations:** Action groups themselves are free. Costs come from the underlying services (Logic Apps, Runbooks, ITSM connectors).

---

## Workbooks for Visualization and Dashboards

[Workbooks](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview){:target="_blank" rel="noopener noreferrer"} are interactive dashboards that combine charts, tables, KQL queries, and markdown text. They are more flexible than Azure Dashboards and are the modern way to visualize Azure Monitor data.

**Workbook capabilities:**
- **Interactive parameters:** Dropdown selectors for time range, resource, environment
- **Multiple visualizations:** Line charts, bar charts, tables, heatmaps, status indicators
- **KQL queries:** Custom analysis with full query power
- **Conditional formatting:** Highlight values based on thresholds
- **Sharing:** Share with teams, embed in documentation
- **Versioning:** Save versions and rollback if needed

**Common workbook patterns:**

| Workbook Type | Purpose |
|---|---|
| **Resource Health Dashboard** | Status of VM, databases, and services with key metrics |
| **Application Performance** | Request count, response time, failure rate, top slow requests |
| **Security Monitoring** | Failed authentication attempts, suspicious activity, compliance status |
| **Cost Analysis** | Resource costs over time, cost anomalies |
| **Incident Response** | Timeline of events, correlated logs, actions taken |

**When to use Workbooks:** Use them for visual monitoring, investigation, and sharing analysis with non-technical stakeholders. Use Azure Dashboards for simple pinned charts if you prefer simplicity.

---

## Azure Service Health and Resource Health

### Service Health

[Service Health](https://learn.microsoft.com/en-us/azure/service-health/service-health-overview){:target="_blank" rel="noopener noreferrer"} provides information about Azure service incidents and planned maintenance that may affect your environment.

**Service Health tracks:**
- Active incidents (service degradation affecting resources)
- Planned maintenance (scheduled downtime)
- Health advisories (informational updates)
- Upcoming changes to Azure services

**Use cases:**
- Understand why your resources are slow or unavailable
- Plan maintenance windows around Azure platform changes
- Receive notifications when your subscriptions are affected

### Resource Health

[Resource Health](https://learn.microsoft.com/en-us/azure/service-health/resource-health-overview){:target="_blank" rel="noopener noreferrer"} shows the health status of individual Azure resources. It indicates whether a resource is available, degraded, or unavailable and provides context for the issue.

**Resource Health status values:**
- **Available:** Resource is healthy and functioning
- **Degraded:** Resource is experiencing performance issues
- **Unavailable:** Resource is not responding
- **Unknown:** No data about resource status

**Integration:** Both Service Health and Resource Health integrate with Azure Monitor alerts. You can alert on resource health changes and receive notifications.

---

## Azure Advisor Integration

[Azure Advisor](https://learn.microsoft.com/en-us/azure/advisor/advisor-overview){:target="_blank" rel="noopener noreferrer"} analyzes your Azure resources and provides recommendations across reliability, security, performance, cost, and operational excellence.

**Advisor provides recommendations for:**
- Resizing oversized VMs
- Applying reserved instances for capacity planning
- Identifying unused resources
- Enabling backups and disaster recovery
- Configuring missing security baselines

**Integration with Azure Monitor:** Advisor insights can be surfaced in workbooks or queried via the Advisor API. Use Advisor recommendations to drive capacity planning and cost optimization initiatives.

---

## Diagnostic Settings and Resource Logs

[Diagnostic settings](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/diagnostic-settings){:target="_blank" rel="noopener noreferrer"} control where Azure resources send their logs and metrics. They route resource diagnostic logs (different from platform metrics) to Log Analytics, storage, or event hubs.

**What gets sent:**
- Resource-specific logs (e.g., firewall flow logs, web app logs, database query logs)
- Metrics (if enabled)
- Activity logs (if configured at subscription level)

**Configuration:**
- **Destination:** Log Analytics workspace, Azure Storage, Event Hubs
- **Log category:** Select which types of logs to collect
- **Retention:** How long to retain logs in the chosen destination

**Common diagnostic settings:**

| Resource Type | Key Log Categories |
|---|---|
| **Azure SQL Database** | SQLInsights (slow queries), Errors, Deadlocks |
| **Application Gateway** | ApplicationGatewayAccessLog, ApplicationGatewayPerformanceLog |
| **Azure Firewall** | AzureFirewallApplicationRule, AzureFirewallNetworkRule |
| **Key Vault** | AuditEvent, SecureScore |
| **Virtual Network** | NetworkSecurityGroupEvent, NetworkSecurityGroupRuleCounter |

**Cost consideration:** Sending diagnostic logs to Log Analytics incurs ingestion costs. Be selective about which log categories you enable.

---

## Multi-Workspace and Cross-Subscription Monitoring

Large organizations often need to monitor resources across multiple subscriptions and regions. Azure Monitor supports this through multi-workspace architectures.

### Workspace Design Patterns

**Centralized single workspace:** All logs from all subscriptions and regions flow to one workspace.

**Advantages:**
- Simpler queries (no need to union across workspaces)
- Easier to correlate events across teams
- Centralized access control and compliance audit trail

**Challenges:**
- Single large workspace can reach ingestion/performance limits
- Difficult to isolate sensitive workloads by team or compliance boundary
- Cost attribution across teams becomes complex

**Decentralized workspaces by team or application:** Each team has their own workspace.

**Advantages:**
- Teams own their monitoring and alerting
- Easier cost allocation per team
- Sensitive workloads (finance, healthcare) isolated from others

**Challenges:**
- Cross-team queries require union across multiple workspaces
- Correlation becomes more difficult
- More operational overhead

**Hybrid approach (recommended for enterprises):** Central workspace for infrastructure (VMs, networks, platform services) + application-specific workspaces for complex services.

**Example:**
```
Central Workspace (Operations team)
├── VM metrics and logs
├── Network flows and NSG logs
├── Azure service diagnostics
└── Activity logs

App-A Workspace (App Team A)
├── Application Insights
├── App-specific logs
└── Custom telemetry

App-B Workspace (App Team B)
├── Application Insights
├── App-specific logs
└── Custom telemetry
```

### Cross-Workspace Queries

KQL supports querying multiple workspaces with the `workspace()` function:

```kusto
(workspace("workspace1-id").AppTraces | where Timestamp > ago(7d))
union
(workspace("workspace2-id").AppTraces | where Timestamp > ago(7d))
| summarize FailureCount = count() by AppName
```

This requires appropriate RBAC permissions across workspaces.

---

## Network Monitoring

Azure provides specialized tools for network observability.

### Network Watcher

[Network Watcher](https://learn.microsoft.com/en-us/azure/network-watcher/network-watcher-overview){:target="_blank" rel="noopener noreferrer"} provides diagnostics for network connectivity and performance issues.

**Key features:**
- **NSG flow logs:** Track which traffic is allowed/denied by Network Security Groups
- **Connection Monitor:** Continuous monitoring of network connectivity between endpoints
- **Traffic Analytics:** Analyze NSG flow logs to identify traffic patterns and anomalies
- **Packet Capture:** Capture network packets for deep packet inspection (rare, advanced use)

### Network Insights

Network Insights provides pre-built workbooks for common networking scenarios:

| Insight | Purpose |
|---|---|
| **Virtual Networks** | Traffic flow, subnet utilization, peering health |
| **Network Interfaces** | NIC health, IP utilization, related resources |
| **Load Balancers** | Backend health, traffic distribution, performance |
| **Application Gateway** | Request distribution, response times, error rates |
| **ExpressRoute** | Circuit health, peering status, BGP status |
| **VPN Gateway** | Connection status, bandwidth utilization |

### Connection Monitor

[Connection Monitor](https://learn.microsoft.com/en-us/azure/network-watcher/connection-monitor-overview){:target="_blank" rel="noopener noreferrer"} continuously monitors connectivity from one endpoint to another (VM to VM, VM to external service, on-premises to cloud).

**Metrics tracked:**
- Probe success rate
- Round-trip latency
- Packet loss percentage
- Jitter (latency variance)

**When to use:** Ensure connectivity between application tiers, validate hybrid connectivity, monitor external API availability from Azure.

---

## VM Insights and Container Insights

### VM Insights

[VM Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/vm/vminsights-overview){:target="_blank" rel="noopener noreferrer"} provides deep monitoring of VM health and performance with automatic dependency mapping.

**What VM Insights includes:**
- Performance metrics (CPU, memory, disk, network from the VM's perspective)
- Guest OS metrics (Windows/Linux performance counters)
- Installed processes and port listening details
- Dependency map (visualization of what each VM connects to)
- Health state based on guest monitoring

**Enablement:** Install Azure Monitor Agent and associate the VM with a DCR configured for VM Insights.

**Use case:** Quickly understand which processes are consuming resources, see inter-VM connections, and diagnose performance issues.

### Container Insights

[Container Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/containers/container-insights-overview){:target="_blank" rel="noopener noreferrer"} monitors AKS clusters and provides pod-level metrics, logs, and performance insights.

**Metrics and views:**
- Cluster, node, and pod resource utilization
- Container logs from all pods
- Kubelet metrics and node health
- Deployment and pod status
- Custom Kubernetes metrics

**Integration:** Container Insights data flows to Log Analytics, enabling rich querying of Kubernetes events and metrics.

---

## Cost Considerations

Azure Monitor has two main cost drivers: data ingestion and data retention.

### Log Analytics Ingestion Cost

Costs are per GB of data ingested into Log Analytics workspaces. Different log types have different ingestion rates and retention policies.

**Cost-saving strategies:**
- **Filter at source:** Use DCRs to exclude unnecessary logs before ingestion
- **Sample data:** Use adaptive sampling for high-volume sources
- **Archive to Storage:** Move older logs to Azure Storage (cold path) for long-term archival at lower cost
- **Retention per table:** Reduce retention period for high-volume, low-value logs (e.g., verbose application logs)
- **Dedicated clusters:** For very high volumes (> 500 GB/day), dedicated Log Analytics clusters offer discounted rates

**Typical costs:**
- Logs ingested: ~$2.50 per GB
- Logs retained (per day after free tier): ~$0.10 per GB
- Long-term analysis and storage is more cost-effective than keeping all data hot

### Metric Ingestion Cost

Platform metrics from Azure resources are collected at no cost. Custom metrics from Application Insights or custom sources are charged per metric.

### Alert Evaluation Cost

Metric alerts are evaluated by the Azure platform at no cost. Log alert queries incur a small cost per query evaluation (typically $0.01-0.05 per query).

---

## Common Pitfalls

### Pitfall 1: Sending Too Much Data to Log Analytics

**Problem:** Enabling all diagnostic logs and collecting verbose application logs without filtering, resulting in high ingestion costs.

**Result:** Log Analytics bill becomes unexpectedly high; cost controls become reactive.

**Solution:** Use diagnostic settings and DCRs to filter at the source. Collect only logs you actually analyze. Use retention periods appropriate to your use case (e.g., 30 days for verbose application logs, 2 years for audit logs).

---

### Pitfall 2: Metric Alerts on Metrics Without Baseline

**Problem:** Setting arbitrary CPU or memory thresholds without understanding normal operating patterns.

**Result:** Alerts trigger frequently for non-critical conditions, or fail to detect real issues.

**Solution:** Use dynamic threshold alerts (anomaly detection) to learn patterns, or establish baselines by observing the resource for 1-2 weeks before enabling alerts.

---

### Pitfall 3: Multiple Workspaces Without Cross-Workspace Query Plan

**Problem:** Creating separate workspaces for different teams without designing how to correlate events across workspaces.

**Result:** Cannot investigate incidents that span multiple teams; queries become fragmented.

**Solution:** Use a hybrid model: central workspace for shared infrastructure, team workspaces for application-specific telemetry. Define a correlation strategy (e.g., correlation IDs, timestamps) for incident investigation.

---

### Pitfall 4: No Retention Strategy for Compliance

**Problem:** Keeping all logs forever, or deleting logs too quickly to meet audit requirements.

**Result:** Either unsustainable costs or regulatory non-compliance.

**Solution:** Align retention policies with compliance requirements. Use Log Analytics for hot data (recent queries), archive to Storage for cold data (compliance archival). Document retention policy per log type.

---

### Pitfall 5: Alerting on Symptoms Rather Than Root Causes

**Problem:** Creating alerts for high CPU without understanding what application component is consuming it, or alerting on increased error rate without ability to identify which requests failed.

**Result:** Alerts trigger but engineers cannot efficiently investigate.

**Solution:** Layer metrics (resource-level) with logs (application-level) and Application Insights (request-level). Ensure alerts include context (what to check) and link to workbooks or queries for faster investigation.

---

### Pitfall 6: Not Monitoring Monitoring

**Problem:** Not tracking the health of Azure Monitor itself (Log Analytics ingestion failures, alert evaluation delays).

**Result:** Silent failures in monitoring go unnoticed.

**Solution:** Monitor Log Analytics ingestion rate and health. Set up alerts for failed data ingestion. Periodically validate that key alerts are evaluating correctly.

---

## Key Takeaways

1. **Azure Monitor is the unified observability platform for Azure.** All three data types (metrics, logs, and application telemetry) should flow to Azure Monitor for centralized analysis and alerting.

2. **Metrics are for real-time dashboards and simple thresholds.** They are low-cost, low-latency, and ideal for resource utilization monitoring. Logs are for detailed investigation, complex analysis, and audit trails.

3. **Log Analytics workspaces are the central repository for all logs.** Send diagnostic logs, application logs, and event logs to a Log Analytics workspace where they can be queried, retained, and analyzed with KQL.

4. **Use Azure Monitor Agent and Data Collection Rules for consistent, scalable log collection.** They replace legacy agents and provide centralized configuration, filtering, and cost control.

5. **Layer different alert types for comprehensive coverage.** Metric alerts detect resource thresholds, log alerts detect patterns, activity log alerts track infrastructure changes, and smart detection finds anomalies.

6. **Action groups route alerts to the right people and systems.** Design action groups with escalation (email for non-critical, SMS/page for critical) and automation (webhook to remediate, Logic App to escalate).

7. **Workbooks are the modern way to visualize and share Azure Monitor data.** They are more flexible than dashboards and support interactive investigation.

8. **Cost management is critical for Log Analytics.** Filter data at source, use appropriate retention, and archive cold data to storage. Monitor your ingestion rate to catch surprises.

9. **Multi-workspace strategies require planning.** Centralized workspaces simplify queries; distributed workspaces allow team autonomy. Most enterprises use a hybrid approach.

10. **Network monitoring complements resource monitoring.** Use Network Watcher and Connection Monitor to understand inter-resource connectivity, verify hybrid connectivity, and diagnose network issues that affect applications.
