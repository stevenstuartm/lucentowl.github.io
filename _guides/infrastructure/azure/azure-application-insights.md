---
title: "Azure Application Insights for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "A comprehensive guide to Azure Application Insights covering APM, distributed tracing, availability tests, smart detection, and architectural patterns for application-level observability."
tags: [azure, observability, monitoring, performance, cloud-computing, reliability, practical]
---

## What Is Application Insights

[Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview){:target="_blank" rel="noopener noreferrer"} provides end-to-end visibility into application behavior, performance, and failures. It automatically collects telemetry from your applications, performs distributed tracing across microservices, detects performance anomalies, and integrates with Azure DevOps for work item creation when issues are found.

Application Insights is a specialized component within the broader [Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/overview){:target="_blank" rel="noopener noreferrer"} platform. Azure Monitor handles infrastructure metrics and logs at the OS and service level, while Application Insights focuses on application-level telemetry and behavior analysis.

### What Problems Application Insights Solves

**Without Application Insights:**
- You see that a service is "down" but have no visibility into which requests failed and why
- Errors are discovered through user reports or log grep sessions instead of automated detection
- Debugging production issues requires manual correlation of scattered logs across services
- Performance problems are diagnosed through guesswork instead of data
- You have no understanding of how users experience your application (real transaction timings)

**With Application Insights:**
- Automatic collection of request failures, exceptions, and performance metrics across all services
- Distributed tracing shows the complete path a request takes through your system
- Smart detection alerts you to anomalies and failing operations before users report them
- Dependency mapping reveals which services call which, and where bottlenecks occur
- You understand real-world application performance, not just infrastructure health

### How Application Insights Differs from AWS X-Ray

Architects familiar with AWS should note several important differences:

| Concept | AWS X-Ray | Application Insights |
|---------|-----------|---------------------|
| **Service type** | Distributed tracing focused | Full APM (tracing + monitoring + analytics) |
| **Trace sampling** | Fixed percentage or rules-based | Adaptive sampling built-in, controlled automatically |
| **Exception tracking** | Requires custom annotation | Automatic exception collection |
| **Availability monitoring** | Not included (use CloudWatch synthetic) | Built-in availability tests (ping, multi-step, custom) |
| **Anomaly detection** | Manual threshold alerts | Smart detection with machine learning |
| **Application Map** | Service map requires configuration | Automatic dependency visualization |
| **Integration** | CloudWatch, Lambda, ALB native | Azure DevOps native, work item creation |
| **Pricing model** | Per-trace ingestion + storage | Per-GB ingestion + retention tiers |
| **SDK support** | Languages vary in maturity | Comprehensive SDK and auto-instrumentation support |

---

## Application Insights Resources and Workspaces

### Workspace-Based vs Classic Resources

Application Insights resources come in two deployment models: workspace-based and classic. Microsoft recommends workspace-based resources for all new deployments.

**Workspace-based Application Insights:**
- Linked to a [Log Analytics workspace](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"} that aggregates logs and metrics from multiple sources
- Single pane of glass for application telemetry, infrastructure logs, and other Azure Monitor data
- Unified pricing and retention across all data types
- Required for Azure Managed Grafana dashboards and some advanced features
- Can be created simultaneously with the workspace or linked to an existing workspace

**Classic Application Insights:**
- Standalone resource with its own storage and retention
- Isolated from other Azure Monitor data
- Will be deprecated; Microsoft recommends migration to workspace-based resources
- No longer the recommended choice for new deployments

**Recommendation:** Always create workspace-based Application Insights resources. Create a single Log Analytics workspace per application or per environment (development, staging, production) and link all Application Insights and other monitoring resources to it.

---

## Instrumentation: Auto vs SDK

### Auto-Instrumentation

[Auto-instrumentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/codeless-overview){:target="_blank" rel="noopener noreferrer"} collects telemetry without code changes. Application Insights automatically instruments your application when it starts.

**How auto-instrumentation works:**
1. Deploy the Application Insights agent to your runtime environment (Java agent for Java apps, .NET runtime module for .NET apps, JavaScript SDK for web apps)
2. The agent intercepts method calls, HTTP requests, and exceptions at runtime
3. Telemetry is collected and sent to Application Insights automatically

**Supported runtimes:**
- .NET and .NET Framework (via Status Monitor or Application Insights agent)
- Java (via Application Insights Java agent)
- JavaScript/Node.js (via SDK only)
- Python (SDK, auto-instrumentation in preview)
- Go (SDK only)

**Benefits of auto-instrumentation:**
- Zero code changes
- Instant visibility into production applications
- Captures exceptions and failed requests automatically
- Works with legacy applications

**Limitations:**
- Less granular control over what is collected
- Some custom business events and metrics require code
- May not capture all framework-specific interactions

### SDK-Based Instrumentation

The [Application Insights SDK](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview#get-started){:target="_blank" rel="noopener noreferrer"} provides programmatic control over telemetry collection.

**How SDK-based instrumentation works:**
1. Add the Application Insights NuGet package (or equivalent) to your project
2. Initialize the SDK in your application startup
3. Use the SDK API to track custom events, metrics, and dependencies
4. Auto-instrumentation still happens, and you add custom tracking on top

**Benefits of SDK-based instrumentation:**
- Full control over what is collected
- Track custom business events (user signups, feature usage, revenue)
- Track custom metrics (queue depth, cache hit rate, business KPIs)
- Enrich telemetry with contextual information
- Sample-aware: custom tracking respects sampling settings

**When to use SDK-based instrumentation:**
- Need to track business events or custom metrics
- Want to correlate application behavior with business outcomes
- Need to filter sensitive data before sending
- Building libraries that other applications depend on

**Best practice:** Use auto-instrumentation as the baseline for all applications, then add SDK instrumentation for business-critical events and metrics.

---

## Telemetry Types

Application Insights collects multiple types of telemetry that form a complete picture of application behavior.

### Requests

A request is an HTTP call to your application. Application Insights tracks:
- Request URL and method
- Response status code
- Request duration
- Success or failure
- Client country (from IP)
- Custom dimensions (user ID, tenant ID, etc.)

Requests are automatically collected for web applications and web services. Failed requests (5xx status, exceptions) appear in the Failures view for quick investigation.

### Dependencies

A dependency is a call your application makes to an external service: databases, APIs, queues, caches, or other microservices. Application Insights automatically tracks:
- Dependency type (SQL, HTTP, Azure Service Bus, etc.)
- Target resource name
- Call duration
- Success or failure
- Exception details (if the call failed)

Dependency tracking helps identify which external services are slow or failing. The Application Map visualizes the dependency graph automatically.

### Exceptions

Exceptions are unhandled errors in your application code. Application Insights automatically collects:
- Exception type and message
- Stack trace with file and line numbers
- Request context (which request caused the exception)
- Browser information (for client-side exceptions)
- Custom dimensions

The Failures view groups exceptions by type and shows which operations are most affected.

### Traces

Traces are log messages from your application. Application Insights collects traces written to:
- `ILogger` (ASP.NET Core)
- `System.Diagnostics.Trace` (.NET Framework)
- `Console.WriteLine()` (captured from stdout)
- Application Insights SDK `TelemetryClient.TrackTrace()`

Traces have severity levels (Trace, Debug, Information, Warning, Error, Critical) and can include custom properties. They are useful for understanding application flow during debugging.

### Custom Events

Custom events are application-specific occurrences you define: user sign-ups, feature usage, business transactions, or any domain-specific event. Track custom events using the SDK:

```csharp
telemetryClient.TrackEvent("UserSignup",
  properties: new Dictionary<string, string> { { "Plan", "Premium" } },
  metrics: new Dictionary<string, double> { { "SignupTime", 2.5 } });
```

Custom events enable analysis of user behavior and correlation with application performance.

### Metrics

Metrics are numeric measurements: response times, error rates, custom business KPIs, or system measurements. Application Insights provides:
- **Pre-aggregated metrics:** Request duration, dependency duration, exception rate (collected automatically)
- **Custom metrics:** Business metrics you define and track with the SDK

Metrics are aggregated into 1-minute intervals and retained long-term, making them efficient for historical trend analysis.

---

## Distributed Tracing and End-to-End Diagnostics

Distributed tracing shows the complete journey of a request through your system, even as it crosses service boundaries.

### How Distributed Tracing Works

1. A request arrives at your frontend service
2. Application Insights generates a unique trace ID for the entire request journey
3. As the request flows to downstream services (API, database, queue, cache), the trace ID travels with it
4. Each service adds its own telemetry (requests, dependencies, exceptions) under the same trace ID
5. Application Insights correlates all telemetry with the same trace ID into a single end-to-end transaction

**Trace propagation mechanism:**
- For HTTP calls: trace ID is sent in the `traceparent` HTTP header (W3C Trace Context standard)
- For asynchronous messaging: trace context is embedded in message properties
- For custom async operations: use the SDK's operation context API

### Operation Context

Application Insights groups related telemetry under an operation context. Each operation has:
- **Operation ID:** The unique trace ID for the entire transaction
- **Operation Name:** The top-level request (e.g., "POST /api/orders")
- **Parent ID:** For nested operations (dependencies within dependencies)

This hierarchical structure allows you to follow a request from entry point through all downstream calls.

### End-to-End Transaction Diagnostics

The Transaction Details view shows:
- Timeline of all calls (requests, dependencies, exceptions) in order
- Duration of each call
- Which call failed (if any)
- Stack traces for exceptions
- Request/response details for HTTP calls

This makes debugging production issues significantly faster. Instead of correlating logs across five different services, you see the complete story in one view.

### Distributed Tracing Best Practices

- **Use libraries with built-in instrumentation:** Most major frameworks automatically propagate trace context. Verify your web framework and database driver support trace propagation.
- **For custom async operations:** Use `Activity` API (ASP.NET Core) or Application Insights SDK context to propagate operation context
- **For message queues:** Ensure trace context is embedded in message headers or body
- **Avoid generating new trace IDs at each hop:** Let Application Insights propagate the trace ID automatically
- **Set meaningful operation names:** Use the request path or operation type, not just "HTTP request"

---

## Application Map

The Application Map is an automatic dependency visualization built from your telemetry. It shows:
- Which services call which
- Call frequency and latency between services
- Where failures occur
- Relative load on each service

The map is built automatically with no configuration required. As your application makes HTTP calls and uses managed services (Azure Storage, SQL Database, Service Bus), the dependencies appear on the map.

### How to Interpret the Application Map

- **Circle nodes:** Services and external dependencies
- **Circle size:** Relative load (requests per second)
- **Arrow direction:** Direction of calls (source to target)
- **Arrow color:** Red indicates failures, blue indicates healthy calls
- **Numbers on arrows:** Average duration and requests per second

Right-click on a dependency to drill into details, see related alerts, or investigate performance characteristics.

### Limitations of Application Map

- Shows direct dependencies only (not transitive: if A calls B calls C, you see A→B and B→C, but not A→C)
- Requires instrumentation on both the calling and called service to appear as an edge (calls to un-instrumented services appear as external dependencies)
- May take a few minutes to populate after telemetry arrives
- Cannot be used to troubleshoot network connectivity issues; it reflects application-level calls only

---

## Live Metrics Stream

[Live Metrics](https://learn.microsoft.com/en-us/azure/azure-monitor/app/live-stream){:target="_blank" rel="noopener noreferrer"} provides real-time telemetry from your running application with near-zero latency.

**What Live Metrics shows:**
- Incoming requests per second
- Failed requests and exceptions in real-time
- Response times (min, max, average)
- Dependency calls and durations
- Server metrics (CPU, memory, GC)

Live Metrics is useful for:
- Monitoring application behavior during deployment
- Validating that a fix resolves an issue
- Observing real-time behavior during load testing
- Quick incident investigation

**Characteristics:**
- Data is sampled; not every telemetry item appears
- Data is not persisted (only real-time viewing)
- Minimal performance overhead on the application
- Available via Azure Portal or from within Visual Studio

---

## Availability Tests

Availability tests monitor your application's health from external locations, similar to synthetic monitoring or uptime checks.

### URL Ping Tests

[URL ping tests](https://learn.microsoft.com/en-us/azure/azure-monitor/app/monitor-web-app-availability){:target="_blank" rel="noopener noreferrer"} send HTTP requests to a URL from multiple global locations and measure response time and status code.

**Configuration:**
- Test URL
- Test frequency (every 1, 5, 10, or 15 minutes)
- Locations (choose from 50+ global locations)
- Alert on failure (if the test fails from multiple locations)
- Parse dependent requests (follow redirects, load CSS/JS and validate all complete)

**Use cases:**
- Monitor publicly accessible endpoints (homepages, health check endpoints)
- Track global latency from different regions
- Basic synthetic monitoring

**Limitations:**
- Cannot authenticate (no way to send credentials)
- No request body (GET only)
- Cannot interact with dynamic content
- Limited to HTTP status and response time checks

### Multi-Step Web Tests

Multi-step web tests record a sequence of HTTP requests and validate the entire flow.

**How to create:**
1. Record a user journey in Visual Studio or the web test recorder
2. Upload the recording to Application Insights
3. Test runs automatically from multiple locations

**Examples:**
- Login → Search → Add to Cart → Checkout
- View product page → click through to details → add review
- API authentication → list resources → update resource

**Advantages over URL ping:**
- Test end-to-end workflows, not just individual pages
- Can include form submissions and POST requests
- More realistic user interactions
- Captures performance across multiple requests

### Custom TrackAvailability

For complex scenarios, use the SDK to define custom availability tests:

```csharp
var availability = new AvailabilityTelemetry
{
    Name = "Payment Processing",
    RunLocation = "West US",
    Success = result.IsSuccess,
    Duration = stopwatch.Elapsed,
    Timestamp = DateTimeOffset.UtcNow
};

telemetryClient.TrackAvailability(availability);
```

Custom tests allow you to:
- Test non-HTTP scenarios (database connections, message queue health)
- Embed business logic in the availability check
- Avoid external dependencies for testing (test internal services)

### Availability Alerts

Configure alert rules to notify you when availability tests fail from multiple locations. Alert on:
- Failed tests from X or more locations
- Test failure rate exceeds Y%
- Average response time exceeds Z milliseconds

---

## Smart Detection and Anomaly Alerts

[Smart Detection](https://learn.microsoft.com/en-us/azure/azure-monitor/app/proactive-diagnostics){:target="_blank" rel="noopener noreferrer"} uses machine learning to identify abnormal behavior in your application automatically.

### Smart Detection Rules

Application Insights applies multiple ML rules continuously:

**Degradation in exception volume:** Detects when the exception rate suddenly increases above normal levels.

**Degradation in dependency duration:** Identifies when calls to external services become slower than baseline.

**Degradation in request duration:** Detects when requests take longer than normal, indicating performance regression.

**Degradation in trace severity:** Identifies sudden increases in warning or error-level log messages.

**Memory leak detection:** Detects patterns of increasing memory usage that suggest a leak.

**Potential security issue:** Alerts on suspicious patterns like rapid growth in 403 (Forbidden) responses.

### How Smart Detection Works

1. Application Insights collects baseline metrics over 7-14 days
2. System continuously monitors for anomalies
3. When anomaly is detected, an alert is created
4. Alert includes context: what changed, when, and potential root cause analysis

### Smart Detection Configuration

- Smart Detection is enabled by default
- Configure alert recipients (email, action groups, webhooks)
- Customize sensitivity (high, medium, low)
- Disable specific rules if they generate false positives in your environment
- Integrate with Azure DevOps to create work items automatically

**Best practice:** Start with default sensitivity and adjust based on signal-to-noise ratio. High sensitivity catches issues earlier but increases false positives.

---

## Sampling Strategies

Sampling reduces telemetry volume and costs while maintaining statistical accuracy. Different sampling strategies suit different needs.

### Adaptive Sampling

[Adaptive sampling](https://learn.microsoft.com/en-us/azure/azure-monitor/app/sampling){:target="_blank" rel="noopener noreferrer"} automatically adjusts the sampling rate based on application load.

**How it works:**
1. Application Insights monitors your telemetry volume
2. Sampling rate increases during peak load (send fewer telemetry items)
3. Sampling rate decreases during quiet periods (send more telemetry items)
4. Target: maintain consistent throughput at a configurable ceiling (default 5 items per second per role instance)

**Benefits:**
- Automatically controls costs
- Maintains detail during normal traffic
- Reduces volume during spikes
- Statistically unbiased (sampled metrics remain accurate)

**Limitations:**
- Latency in adjusting sampling rate during sudden spikes
- Less detailed trace data during high traffic
- Sampling decision applies to entire operation (if request is sampled, all its dependencies are too)

### Fixed-Rate Sampling

Fixed-rate sampling keeps a consistent percentage of telemetry (e.g., 10% of all requests).

**Use cases:**
- Predictable telemetry volume for cost control
- Same level of detail at all times
- Easier to understand and predict costs

**Trade-off:** Less data during normal traffic, same data volume during peaks (not cost-optimized).

### Ingestion Sampling

Ingestion sampling occurs at the Application Insights backend, after telemetry is received. You configure a sampling rate, and Application Insights keeps only a percentage of incoming telemetry.

**Use cases:**
- Post-facto cost control (reduce costs without code changes)
- Sampling at the service level (reduce costs for specific services)

**Trade-off:** Ingestion sampling is less efficient than SDK-side sampling because the full telemetry is sent to Azure then filtered.

### Sampling Best Practices

- **Use adaptive sampling by default:** It provides the best balance of cost control and detail
- **Disable sampling for critical paths:** For payment processing or security-sensitive operations, set `SamplingPercentage = 100` to ensure all telemetry is captured
- **Be aware of sampling in alerting:** If an alert rule depends on specific telemetry, sampling may cause the rule to miss events. Use alert rules that account for sampling (metrics are unaffected by sampling; traces may be)
- **Plan for sampling when designing dashboards:** Ensure analytics queries account for sampling bias

---

## Custom Metrics and Custom Events

Custom metrics and events enable correlation between application behavior and business outcomes.

### Tracking Custom Metrics

Custom metrics are numeric values you track:

```csharp
// Track a business metric
telemetryClient.GetMetric("OrderValue").TrackValue(order.Total);

// Track with multiple dimensions
telemetryClient.GetMetric("OrderValue", "Currency", "Country")
  .TrackValue(order.Total, order.Currency, order.Country);
```

**Examples of custom metrics:**
- Revenue per transaction
- Checkout completion time
- Search result count
- API quota usage
- Queue depth
- Cache hit rate

**Benefits of custom metrics:**
- Aggregated automatically (min, max, average, count)
- Retained long-term for trend analysis
- Efficient storage (pre-aggregated)
- Can include dimensions for slicing

### Tracking Custom Events

Custom events represent application-specific occurrences:

```csharp
// Track a business event
telemetryClient.TrackEvent("UserSignup",
  properties: new Dictionary<string, string>
  {
    { "Plan", "Premium" },
    { "Source", "Facebook" }
  },
  metrics: new Dictionary<string, double>
  {
    { "ConversionTime", conversionSeconds }
  });
```

**Examples of custom events:**
- User sign-up, login, logout
- Feature usage (report generation, export)
- Business transactions (order placed, payment processed)
- System events (backup completed, migration started)

**Structure:**
- Event name (e.g., "OrderPlaced")
- Properties: strings for categorical data
- Metrics: numbers for measurements

**Analysis:**
- View event counts and trends
- Segment by properties
- Correlate custom events with failures or performance issues
- Use in custom analytics queries

---

## Continuous Export and Data Access

Application Insights data can be exported continuously for long-term archival, advanced analysis, or integration with other systems.

### Continuous Export

[Continuous Export](https://learn.microsoft.com/en-us/azure/azure-monitor/app/export-telemetry){:target="_blank" rel="noopener noreferrer"} automatically sends all ingested telemetry to Azure Storage or Event Hubs.

**How it works:**
1. Configure export destinations (storage account, Event Hubs, Service Bus)
2. All new telemetry is sent to the destination automatically
3. Data is exported in near-real-time (within minutes)

**Use cases:**
- Archive raw telemetry for compliance (keep 10 years of data while Application Insights retains 90 days)
- Feed telemetry to a data lake for data science analysis
- Stream telemetry to Event Hubs for real-time processing
- Integrate with third-party analytics or SIEM platforms

**Cost consideration:** Continuous export adds charges for the destination (storage or Event Hubs), but avoids the cost of long-term Application Insights retention.

### Analytics API

The [Application Insights REST API](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/overview){:target="_blank" rel="noopener noreferrer"} allows programmatic queries of your telemetry.

**Examples:**
- Query request count by status code
- Retrieve exception details for a specific time range
- Aggregate custom metrics
- Integrate telemetry with external dashboards or reporting systems

**Query language:** Use Kusto Query Language (KQL) to retrieve telemetry:

```kusto
requests
| where timestamp > ago(24h)
| where success == false
| summarize count() by resultCode
```

---

## Integration with Azure DevOps

Application Insights integrates with Azure DevOps to create work items automatically when issues are detected.

### Work Item Creation from Alerts

When a Smart Detection alert fires, Application Insights can create an Azure DevOps work item automatically:
- Bug type (or configurable type)
- Title based on the detected issue
- Description with context and recommendations
- Link back to the Application Insights alert

**Configuration:**
1. Connect your Application Insights resource to an Azure DevOps project
2. Configure alert rules to create work items
3. Specify which team and area path receives items
4. Customize work item fields

### Creating Work Items from Failures

You can also create work items directly from the Failures view:
- Select a failed request or exception
- Click "Create work item"
- Populate the bug details
- Automatically links to the failure data

This keeps your incident response workflow within Azure DevOps.

---

## Performance Profiler and Snapshot Debugger

### Performance Profiler

The [Performance Profiler](https://learn.microsoft.com/en-us/azure/azure-monitor/app/profiler){:target="_blank" rel="noopener noreferrer"} periodically collects CPU and memory call stacks from your running application.

**How it works:**
1. Profiler runs for 2 minutes every hour on each role instance
2. Captures call stacks and CPU usage
3. Uploads the data to Application Insights

**Use cases:**
- Identify which functions consume the most CPU
- Find unexpected performance bottlenecks
- Discover inefficient algorithms or libraries

**Available for:**
- ASP.NET and ASP.NET Core on Windows
- Java applications
- Python (preview)

### Snapshot Debugger

The [Snapshot Debugger](https://learn.microsoft.com/en-us/azure/azure-monitor/app/snapshot-debugger){:target="_blank" rel="noopener noreferrer"} captures memory snapshots when exceptions occur.

**How it works:**
1. Exception is thrown in production
2. Application Insights captures a memory snapshot automatically
3. You download the snapshot and open it in Visual Studio
4. Inspect local variables, objects, and state at the time of the exception

**Benefits:**
- Reproduce the exact state that caused the exception without using debugger break points
- Understand what data led to the error
- No need to redeploy with debugging symbols

**Trade-offs:**
- Small performance overhead when exceptions occur
- Snapshots are large (upload time and storage)
- Only captures on exceptions (not on performance issues)

---

## Cost Management

Application Insights pricing is based on data ingestion (per GB of data sent to Azure), with separate charges for long-term retention.

### Controlling Ingestion Costs

**Sampling:** The most effective cost control. Adaptive sampling reduces telemetry during high traffic.

**Selective collection:** Track only what you need. Disable collection of specific telemetry types (e.g., all traces if you don't use them).

**Filtering:** Use SDK configuration to exclude low-value telemetry (e.g., requests to static assets, health check endpoints).

**Data retention tiers:**
- Default: 90 days at no additional charge
- Long-term storage: Archive data to your Log Analytics workspace with configurable retention (pay per GB stored)

### Cost Optimization Patterns

**Production-only collection:** Use sampling to collect less data from production (e.g., 10%) while collecting more from staging (100%). Adjust based on traffic patterns.

**Workload-specific sampling:** Sample high-volume workloads more aggressively, lower-volume workloads less aggressively.

**Metric retention:** Keep raw traces for 7 days but aggregate metrics for 90+ days. Metrics are more efficient for historical analysis.

**Right-size your workspace:** If you have multiple applications, consolidate into a single workspace rather than creating separate workspaces for each. Workspace storage is shared.

---

## Common Pitfalls

### Pitfall 1: No Instrumentation Plan

**Problem:** Deploying an application without deciding whether to use auto-instrumentation, SDK instrumentation, or both.

**Result:** Minimal observability in production. When issues occur, you lack the telemetry needed to diagnose them.

**Solution:** Plan instrumentation during architecture design. Use auto-instrumentation as the baseline for all applications, and add SDK instrumentation for custom business events and metrics. Document what each team is tracking and why.

---

### Pitfall 2: Forgetting to Propagate Trace Context in Async Code

**Problem:** Using `async/await` without propagating operation context, causing traces to lose connection to the original request.

**Result:** Related operations appear in Application Insights but are not correlated under the same trace ID. End-to-end diagnostics become impossible.

**Solution:** Use the `Activity` API (ASP.NET Core) or Application Insights SDK context methods to maintain operation context across async boundaries. Verify your async libraries (Entity Framework, HTTP client) propagate context automatically.

---

### Pitfall 3: Sampling Losses in Alerting

**Problem:** Configuring alerts based on exact telemetry counts when sampling is enabled.

**Result:** Alerts fire inconsistently because the alert rule expects full telemetry volume but receives only sampled data.

**Solution:** Use metric-based alerts instead of trace-based alerts. Metrics like request rate and error rate are automatically corrected for sampling and remain accurate. If trace-based alerts are necessary, account for sampling in the threshold calculation.

---

### Pitfall 4: Sensitive Data in Telemetry

**Problem:** Accidentally collecting passwords, API keys, credit card numbers, or personal information in traces, events, or exceptions.

**Result:** Sensitive data appears in Application Insights logs and violates data protection regulations.

**Solution:** Implement telemetry processors to filter or redact sensitive data before sending. Review your exception handling to avoid logging sensitive data in stack traces. Use custom dimensions only for business context, not secrets.

---

### Pitfall 5: Application Map Complexity

**Problem:** Applications with many services and dependencies result in an Application Map that is too complex to interpret.

**Result:** The map becomes a tangled web of lines that doesn't provide actionable insight.

**Solution:** Limit the application map to critical dependencies. Filter out external services (CDNs, logging endpoints) that clutter the view. Create separate maps for different functional areas (checkout flow, reporting pipeline). Use the Dependency Failures view to focus on broken dependencies.

---

### Pitfall 6: Not Setting Operation Names

**Problem:** All requests appear as generic "HTTP request" or "Default" in the Operation Name filter.

**Result:** Difficult to segment failures by endpoint or feature. Reports become ambiguous (which "HTTP request" failed?).

**Solution:** Set meaningful operation names in your request telemetry. Use the HTTP method and path (e.g., "POST /api/orders", "GET /api/users/:id"). Application Insights should do this automatically for web frameworks, but verify in your custom instrumentation.

---

## Key Takeaways

1. **Application Insights provides end-to-end observability for production applications.** It automatically collects telemetry, detects anomalies, and enables fast diagnosis of issues through distributed tracing.

2. **Always use workspace-based Application Insights.** Classic resources are being deprecated, and workspace-based resources provide better integration with other Azure Monitor data sources.

3. **Start with auto-instrumentation, add SDK instrumentation for custom business metrics.** Auto-instrumentation gives you visibility immediately; custom instrumentation correlates application behavior with business outcomes.

4. **Distributed tracing is essential for microservices architectures.** End-to-end transaction diagnostics across service boundaries dramatically reduce MTTR when issues occur.

5. **Smart Detection alerts you to problems automatically.** Machine learning-based anomaly detection catches degradations you might miss with static threshold alerts.

6. **Use adaptive sampling to control costs.** Automatic sampling adjusts to your traffic patterns and keeps telemetry volume predictable without sacrificing visibility during normal operations.

7. **Custom metrics and events bridge observability and business impact.** Track metrics that matter to your business (revenue, conversion rate, engagement) alongside technical metrics (latency, error rate) to correlate them.

8. **Availability tests provide synthetic monitoring.** URL ping tests and multi-step tests validate that your application works from the user perspective, independent of internal metrics.

9. **Integrate Application Insights with Azure DevOps for incident response.** Create work items directly from failures and alerts to keep incident tracking within your development workflow.

10. **Implement telemetry processors to protect sensitive data.** Application Insights can capture any data your application generates, including secrets. Filter and redact before sending.
