---
title: "Azure Application Insights for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "How OpenTelemetry-based instrumentation reaches Application Insights, where the telemetry physically lands and what it costs to keep, how the sampler decides what survives, and which classic APM features have already been retired out from under existing guidance."
tags: [application-insights, opentelemetry, distributed-tracing, observability, apm, practical]
---

## What Is Application Insights

[Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview){:target="_blank" rel="noopener noreferrer"} is the application performance monitoring feature of Azure Monitor. It collects request, dependency, exception, and log telemetry from your applications, correlates it into end-to-end traces, detects performance anomalies, and surfaces it through views like the application map, the failures view, and live metrics.

The product changed shape between 2024 and 2026, and most older material describes a version that no longer exists. Three changes matter before anything else:

- **The recommended instrumentation is OpenTelemetry.** The [Azure Monitor OpenTelemetry Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable){:target="_blank" rel="noopener noreferrer"} is the supported code-based path for new applications. The classic `TelemetryClient` SDKs still work, but their 3.x versions are themselves OpenTelemetry implementations behind a compatibility layer.
- **Classic Application Insights resources retired on 29 February 2024.** Every resource is workspace-based now, which means the telemetry physically lives in a Log Analytics workspace.
- **Several signature features are gone.** Continuous export retired with classic resources, multi-step web tests retired on 31 August 2024, and URL ping tests retire on 30 September 2026.

### What Problems Application Insights Solves

**Without application-level telemetry:**
- You see that a service is unhealthy but not which requests failed or why
- Errors surface through user reports or log searches rather than automated detection
- Debugging a production issue means manually correlating logs across services
- Performance problems get diagnosed by guesswork
- You have no measurement of how the application actually behaves for users

**With Application Insights:**
- Requests, dependencies, and exceptions are collected across every instrumented service
- Distributed tracing reconstructs the path a single request took through the system
- Smart detection flags anomalies against a learned baseline rather than a static threshold
- The application map builds a dependency graph from the telemetry itself
- Standard availability tests measure the application from outside, independent of internal metrics

### How Application Insights Differs from AWS X-Ray

Architects familiar with AWS should note several differences:

| Concept | AWS X-Ray | Application Insights |
|---|---|---|
| **Service type** | Distributed tracing focused | Full APM (tracing, monitoring, and analytics) |
| **Instrumentation standard** | X-Ray SDK or ADOT (OpenTelemetry) | OpenTelemetry, through the Azure Monitor Distro |
| **Trace sampling** | Fixed percentage or rules-based | One rate across all telemetry types, applied at the end of span generation |
| **Exception tracking** | Requires custom annotation | Collected automatically by the instrumentation libraries |
| **Availability monitoring** | Not included (use CloudWatch Synthetics) | Built-in standard tests |
| **Anomaly detection** | Manual threshold alarms | Smart detection with machine learning |
| **Dependency visualization** | Service map requires configuration | Application map, built from telemetry with no configuration |
| **Storage** | X-Ray's own trace store | A Log Analytics workspace, queryable in KQL alongside other Azure telemetry |
| **Pricing model** | Per-trace ingestion plus storage | Per-GB ingestion plus retention beyond 90 days |

---

## Where the Data Actually Lives

An Application Insights resource is a set of portal experiences over tables that physically sit in a [Log Analytics workspace](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview){:target="_blank" rel="noopener noreferrer"}. That one fact explains its retention model, its cost model, and why its data joins cleanly against infrastructure logs.

```
   your app
      |  connection string
      v
   ingestion endpoint ---> Application Insights resource
                                    |  (workspace-based: no storage of its own)
                                    v
                          Log Analytics workspace
                          |- requests, dependencies, exceptions,
                          |  traces, customEvents, customMetrics,
                          |  availabilityResults, pageViews
                          |- AzureDiagnostics, Perf, Heartbeat, ...
                                    |
                                    |--> KQL queries, workbooks, log alerts
                                    |--> diagnostic settings --> Storage / Event Hubs
```

The consequences to plan around:

- **The workspace owns retention and billing.** Ingestion and retention charges land on the workspace bill, not on a separate Application Insights meter.
- **A workspace can hold many applications.** One workspace per environment with several Application Insights resources pointed at it is a normal shape, and it lets a single KQL query span services.
- **Application Insights tables sit alongside everything else.** A query can join `requests` against `Perf` or `AzureDiagnostics` in one statement.

### What the Classic Retirement Changed

Classic (non-workspace) resources retired on 29 February 2024, and Microsoft began automatically migrating the remainder from May 2024. Existing classic components kept ingesting telemetry, but no new ones can be created and the model receives no further work.

Two things break rather than migrate:

- **Continuous export is not compatible with workspace-based resources.** It had to be disabled or converted to diagnostic settings before migration.
- **API keys survive migration but the integrations that used them do not.** Release annotations and the live metrics secure control channel need new keys and reconfiguration.

### Retention

| Setting | Value |
|---|---|
| Raw telemetry retention | Configurable: 30, 60, 90, 120, 180, 270, 365, 550, or 730 days |
| Included at no extra charge | 90 days |
| Aggregated metrics | 1-minute granularity, 90 days |
| Debug snapshots | 15 days |
| .NET Profiler traces | 15 days, no storage charge |

Retention past 730 days is a workspace-level concern rather than an Application Insights one. The workspace's total retention setting reaches 12 years, and data past the analytics retention window comes back through a search job rather than an interactive query.

---

## Instrumentation

Telemetry reaches Application Insights three ways, and they differ sharply in how much control they give you.

### Autoinstrumentation

[Autoinstrumentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/codeless-overview){:target="_blank" rel="noopener noreferrer"} attaches an agent at the hosting platform, with no code change and often no configuration beyond a portal toggle. Support depends on both host and language:

| Environment | .NET Framework | .NET | Java | Node.js | Python |
|---|---|---|---|---|---|
| App Service on Windows (code) | Yes | Yes | Yes | Yes | No |
| App Service on Linux (code) | No | Yes | Yes | Yes | Yes |
| App Service (container) | Preview | Preview | Preview | Preview | No |
| Azure Functions | Yes | Yes | Yes | Yes | Yes |
| Azure Spring Apps | No | No | Yes | No | No |
| Azure Kubernetes Service | No | Preview | Yes | Yes | Preview |

Container support covers single-container applications only. Multi-container and sidecar deployments need code-based instrumentation.

**Where autoinstrumentation stops:** it collects the standard signals well and gives you almost no control. Custom business events, custom metrics, redaction of sensitive fields, and per-dependency filtering all require code.

### The Azure Monitor OpenTelemetry Distro

The [Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable){:target="_blank" rel="noopener noreferrer"} wraps the OpenTelemetry SDK plus the Azure Monitor exporter, and it is the recommended path for ASP.NET Core, Java, Node.js, and Python. Over plain OpenTelemetry with a community exporter, it adds sampling compatible with the classic SDKs, Microsoft Entra authentication, offline storage with automatic retries, standard metrics, cloud role name detection, and live metrics support.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenTelemetry().UseAzureMonitor();
var app = builder.Build();
```

The connection string comes from the `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable. Instrumentation keys on their own are no longer a supported ingestion path, and technical support for instrumentation-key-based ingestion ended on 31 March 2025.

For classic ASP.NET, console applications, and Windows Forms, use the standalone `Azure.Monitor.OpenTelemetry.Exporter` package rather than the Distro.

**Browser telemetry is the exception.** The Application Insights JavaScript SDK does not use OpenTelemetry, and Microsoft neither recommends nor supports OpenTelemetry JavaScript in a browser. Page views, user flows, and funnels come from the JavaScript SDK.

### Classic SDKs and the 3.x Upgrade

Applications on the 2.x `TelemetryClient` SDKs have an intermediate step. The [.NET SDK 3.x](https://learn.microsoft.com/en-us/azure/azure-monitor/app/migrate-to-opentelemetry){:target="_blank" rel="noopener noreferrer"} keeps most of the `TelemetryClient` and `TelemetryConfiguration` surface but routes every `Track*` call through a mapping layer that emits OpenTelemetry signals. Node.js has the same arrangement.

That path preserves ingestion compatibility while deferring the code rewrite, but it is not a drop-in upgrade:

- The collector and channel packages (`DependencyCollector`, `PerfCounterCollector`, `WindowsServer.TelemetryChannel`, the logging appenders) have no 3.x versions and must be removed
- `TrackPageView` is gone from the .NET 3.x SDK
- The `IDictionary<string, double> metrics` overloads of `TrackEvent`, `TrackException`, and `TrackAvailability` are gone, so metrics have to be tracked separately
- `TelemetryProcessor`, `TelemetryInitializer`, and `ITelemetryChannel` are replaced by OpenTelemetry processors and exporters
- A connection string is required, and startup can fail without one
- `EnableAdaptiveSampling` is replaced by `SamplingRatio` or `TracesPerSecond`

Never mix 2.x and 3.x packages, and never run the 3.x SDK and the Distro in the same application.

### Choosing an Instrumentation Path

```
Where does the code run?

Browser / client-side JavaScript -----------> Application Insights JavaScript SDK
                                              (OpenTelemetry is not an option here)

Server-side, new application ---------------> Azure Monitor OpenTelemetry Distro
                                              |- classic ASP.NET, console, WinForms
                                              |  --> Azure.Monitor.OpenTelemetry.Exporter
                                              |- everything else --> UseAzureMonitor()

Server-side, existing app on 2.x SDKs
|- Can absorb a code rewrite now -----------> Distro (clean install)
|- Needs a compatible interim step ---------> Application Insights SDK 3.x

Supported PaaS host, no custom telemetry
needed, no code change wanted --------------> autoinstrumentation
```

Autoinstrumentation and the Distro are not mutually exclusive in principle, but running both against one application produces duplicate telemetry. Pick one per application and disable the other.

---

## Telemetry Types

Application Insights predates OpenTelemetry, and its table names and portal labels still use the older vocabulary. Reading either set of documentation requires the mapping:

| Application Insights | OpenTelemetry |
|---|---|
| Requests | Server spans |
| Dependencies | Client, internal, and other span types |
| Traces | Logs |
| Custom events | Log records carrying a custom event name |
| Operation ID | Trace ID |
| Operation parent ID | Span ID |
| Autocollectors | Instrumentation libraries |
| Telemetry channel | Exporter |
| Codeless / agent-based | Autoinstrumentation |

"Traces" is the trap. In Application Insights a trace is a single log line; in OpenTelemetry a trace is the whole distributed operation. A Grafana trace visualizer pointed at the `traces` table returns nothing useful, because the waterfall is built from `requests` and `dependencies`.

### Requests

An HTTP call into your application, recorded with URL and method, status code, duration, success or failure, client geography derived from IP, and any custom dimensions you attach. Failed requests surface in the failures view grouped by operation.

### Dependencies

A call your application makes outward: SQL, HTTP, Service Bus, Cosmos DB, cache. Recorded with dependency type, target, duration, success, and exception detail on failure. The application map is built from these.

### Exceptions

Unhandled errors, collected with type, message, stack trace, the request context that produced them, and custom dimensions. Client-side exceptions from the JavaScript SDK also carry browser detail.

### Traces (Logs)

Log messages from the application. With the Distro, anything written through `ILogger` is exported. The classic SDK also picked up `System.Diagnostics.Trace` and stdout. Severity levels run from Trace to Critical.

### Custom Events

Application-specific occurrences you define: sign-ups, feature usage, business transactions. Under OpenTelemetry there is no `TrackEvent`. A custom event is a log record carrying the `microsoft.custom_event.name` attribute:

```csharp
logger.LogInformation(
    "{microsoft.custom_event.name} {plan}",
    "UserSignup",
    "Premium");
```

The value bound to `microsoft.custom_event.name` becomes the event name in the `customEvents` table, and the other structured properties become custom dimensions.

### Metrics

Numeric measurements, either the pre-aggregated standard metrics the Distro emits automatically (request duration, dependency duration, exception rate) or custom metrics you define. Metrics are aggregated to 1-minute granularity and retained for 90 days.

Metrics are never sampled. That is the reason to prefer them for alerting, and the reason a metric-based dashboard stays accurate while a log-based one drifts as the sampling rate rises.

---

## Distributed Tracing and End-to-End Diagnostics

### How Trace Context Propagates

Correlation depends on one identifier surviving every hop, carried in the W3C `traceparent` header:

```
  Frontend                  Orders API                Payments API
  --------                  ----------                ------------
  request span              request span              request span
  trace=abc                 trace=abc                 trace=abc
  span=01                   span=03                   span=05
  parent=-                  parent=02                 parent=04
     |                         |                         |
     |- dependency span        |- dependency span        |- dependency span
     |  trace=abc              |  trace=abc              |  trace=abc
     |  span=02                |  span=04                |  span=06
     |  parent=01              |  parent=03              |  parent=05
     |                         |                         |
     |  traceparent:           |  traceparent:           v
     +--00-abc-02-01---------->+--00-abc-04-01--------> Cosmos DB
                                                        (not instrumented:
                                                         appears only as the
                                                         caller's dependency)

  Async messaging: the same header travels in the message's
  application properties, not in an HTTP header.

  Every span sharing trace=abc reconstructs as one transaction.
```

Two properties of this shape drive most correlation bugs. A service that generates a fresh trace ID instead of continuing the incoming one splits the transaction in two. An uninstrumented service appears only as the caller's dependency, so the map shows the edge into it but nothing beyond.

### Operation Context

Each span carries the trace ID (`operation_Id` in the tables), an operation name, and a parent span ID. The parent relationship is what lets the transaction view render a hierarchy rather than a flat list.

### End-to-End Transaction Details

The transaction details view assembles every span sharing a trace ID into a timeline: each call in order, its duration, which one failed, stack traces for exceptions, and request detail for HTTP calls. It is reachable from the failures view, the performance view, the availability view, and the application map.

### Distributed Tracing Practices

- **Prefer instrumented libraries.** The instrumentation libraries bundled in the Distro propagate context for you. Verify coverage for your web framework, HTTP client, and database driver before writing manual propagation.
- **Use the `Activity` API for custom async work.** In .NET, `Activity` is the OpenTelemetry span, and creating one from the ambient context preserves the parent relationship across an await boundary.
- **Carry context through queues explicitly.** Message brokers do not propagate headers by default. Embed `traceparent` in the message's application properties and extract it on the consumer side.
- **Never mint a new trace ID mid-transaction.** Continue the incoming one.
- **Set operation names that aggregate.** `POST /api/orders/{id}` groups, and `POST /api/orders/8f21c` does not.

---

## Application Map

The application map is a dependency graph built from `requests` and `dependencies` with no configuration. Node size reflects relative load, arrow direction reflects call direction, arrow color flags failures, and the labels carry average duration and call rate.

**Limitations:**
- Direct edges only. If A calls B and B calls C, the map shows A to B and B to C, never A to C.
- Both ends need instrumentation to appear as a service. Calls to uninstrumented targets show as external dependencies.
- It reflects application-level calls, so it diagnoses nothing about network connectivity.
- It takes a few minutes to populate after telemetry starts arriving.

---

## Live Metrics Stream

[Live metrics](https://learn.microsoft.com/en-us/azure/azure-monitor/app/live-stream){:target="_blank" rel="noopener noreferrer"} streams telemetry from running instances at near-real-time latency: request and dependency rates, failures and exceptions as they happen, response times, and process-level CPU, memory, and GC counters.

It earns its place during a deployment, while validating a fix, under a load test, and in the first minutes of an incident.

**Characteristics:**
- Nothing is persisted. Closing the pane discards the data.
- The stream is a live sample of activity, not the complete telemetry stream.
- Live metrics compatibility is one reason the Azure Monitor sampler makes its decision at the end of span generation rather than before.
- The control channel, which drives filtering and sample capture from the pane, can be secured, and that path is one of the integrations that depends on API keys.
- EventCounters do not appear in live metrics. Use metrics explorer or KQL for those.

---

## Availability Tests

Availability tests call your endpoints from Azure locations around the world on a schedule. They need no change to the application, they work against any public HTTP or HTTPS endpoint including third-party APIs your service depends on, and you can create up to 100 per Application Insights resource.

This area has changed more than any other in the product, and older guidance describes three test types where only one remains.

| Test type | Status |
|---|---|
| Standard test | The current and only supported type |
| URL ping test | Deprecated. Retires 30 September 2026, and existing tests are removed from resources |
| Multi-step web test | Retired 31 August 2024 |
| `TrackAvailability()` custom tests | Archived classic API guidance. Still functional, no longer the recommended path |

Multi-step tests died with the Visual Studio `.webtest` format that defined them. A multi-request user journey today means either a sequence of standard tests against individual endpoints, or a custom test that runs your own code on your own compute and reports the result.

### Standard Tests

A standard test sends a single configurable request and validates the response. Beyond what a ping test could do, it covers HTTP verb selection, a request body, custom headers, TLS certificate validity, and proactive certificate lifetime checks.

| Setting | Behavior |
|---|---|
| **URL** | Any publicly resolvable endpoint. Redirects are followed up to 10 hops |
| **Test frequency** | Default 5 minutes, per location |
| **Test locations** | Up to 16, with a recommended minimum of 5 |
| **Parse dependent requests** | Loads images, scripts, and stylesheets, up to 15 dependent requests, and fails if any cannot be retrieved within the timeout |
| **Enable retries** | Retries after a short interval, reporting failure only after three consecutive failures at that location. Roughly 80% of failures clear on retry |
| **SSL certificate validity** | Validates the certificate on the final redirected URL |
| **Proactive lifetime check** | Fails the test a configurable period before the certificate expires |
| **Content match** | Case-sensitive plain-string match against the response body. No wildcards, English characters only |
| **Test timeout** | Includes dependent requests when parsing is enabled |

Standard tests are billed. URL ping tests were not, which makes the September 2026 retirement a cost change as well as a configuration change.

**Testing endpoints behind a firewall:** the test agents come from shared IP addresses, so IP allow-listing alone does not authenticate them. Add a custom header such as `X-Customer-InstanceId` with a value your service checks, and use the `ApplicationInsightsAvailability` service tag rather than a hand-maintained IP list. Endpoints with no public route cannot be reached by a standard test at all, so monitor an internal signal and alert on that instead.

### Availability Alerts

Alerts are created with the test and enabled by default, but a new test only produces in-portal notifications until you attach an action group.

- **Alert on X of Y locations failing.** Microsoft's rule of thumb is a threshold of (number of locations minus 2), with at least 5 locations. Three of five is the common configuration.
- **Alerts are state-based.** One notification when the endpoint goes down and one when it recovers, rather than a repeat at every evaluation.
- **Custom metric alerts raise the ceilings.** The default rule caps the aggregation period at 6 hours and frequency at 15 minutes, while a custom rule reaches 24 hours and 1 hour.
- **Disable tests during maintenance,** or the alerts will fire against planned downtime.

The Downtime and Outages workbook, reachable from the availability pane, calculates an SLA figure across tests and subscriptions with a configurable maintenance window excluded.

---

## Smart Detection

[Smart detection](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/proactive-diagnostics){:target="_blank" rel="noopener noreferrer"} analyzes incoming telemetry against a learned baseline and notifies you when the application deviates from it. It needs no configuration and starts working once the application sends enough telemetry.

**What it detects:**

| Rule | Signal |
|---|---|
| Failure anomalies | Failed request rate outside the expected envelope, correlated against load |
| Performance anomalies | Operation response time or dependency duration slowing against the historical baseline, plus anomalous response-time patterns |
| Trace degradation | A rise in warning and error-level log volume |
| Memory leak | A pattern of growing memory consumption |
| Abnormal rise in exception volume | Exception rate climbing above normal |
| Security anti-patterns | Suspicious patterns such as rapid growth in 403 responses |

**Migrate smart detection to alert rules.** The original implementation emailed subscription owners and lived outside the alerting system. Migrating it creates real Azure Monitor alert rules, one per detection module, which you then manage, configure, and route to action groups like any other rule. Without the migration, notifications arrive by email only and cannot trigger an action group.

Rules that are not in preview send email notifications by default. Configure them per rule from the smart detection settings pane, or through ARM templates for consistency across environments.

---

## Sampling

Sampling reduces telemetry volume and cost while keeping related items together, so a sampled-in request still has its dependencies, exceptions, and logs attached. The portal renormalizes counts by the sampling rate, which is why request rate in metrics explorer stays approximately correct even when most items were dropped.

### Where Sampling Happens

```
  application process                         Azure
  -------------------                         -----

  spans / logs generated
        |
        |- metrics, performance counters ---------------------+
        |  (never sampled at any stage)                       |
        |                                                     |
        v                                                     |
  SDK sampler                                                 |
  |- Distro: Azure Monitor custom sampler                     |
  |  (decides at end of span, hashes trace ID)                |
  |- .NET SDK 3.x: SamplingRatio or TracesPerSecond           |
  |- .NET SDK 2.x: adaptive sampling, 5 items/sec/host        |
  |- Java agent 3.4+: rate-limited by default                 |
        |                                                     |
        v                                                     |
  ingestion endpoint                                          |
        |                                                     |
        v                                                     |
  ingestion sampling (portal setting)                         |
  |- classic SDK: skipped entirely if the SDK already sampled |
  |- Distro: applied on top, so the rates multiply            |
        |                                                     |
        v                                                     v
  Log Analytics workspace  <-------------------------  metrics store
```

That last branch is the part most likely to surprise you. Under the classic SDKs, ingestion sampling switched itself off when it saw SDK-sampled telemetry arrive. With the OpenTelemetry sampler the two stages compound, so a 20% SDK rate and a 50% ingestion rate retain roughly 10% of the data.

### The Azure Monitor Custom Sampler

The sampler the Distro installs is neither head-based nor tail-based. It decides after a span completes but before export, and it uses a hash of the trace ID rather than buffering the trace, which keeps traces whole without paying for tail-based buffering.

Its behavior has consequences you cannot configure away:

- **One rate applies to every telemetry type in a trace.** Requests and dependencies cannot be sampled at different rates. Per-type rates need OpenTelemetry span processors or ingestion-time transformations.
- **Upstream sampling decisions are ignored.** Each service decides independently. Because the decision is made after the downstream call has already been issued, the sampled flag it propagates is incomplete and downstream services cannot rely on it. Trace completeness comes from every service hashing the same trace ID, so configure the same sampler and the same rate everywhere.
- **Mixed sampling approaches produce broken traces.** One service on head-based sampling and another on the Azure Monitor sampler will disagree, and spans go missing from the middle of transactions.
- **Full tail-based sampling is not supported.** Deciding based on whether any span in a trace failed requires a downstream collector, which Azure Monitor does not offer.

### Classic SDK Sampling

Adaptive sampling belongs to the 2.x SDKs and Azure Functions, not to OpenTelemetry. It adjusts the rate to hold throughput at a target, defaulting to 5 telemetry items per second **per host**, which is why a scaled-out application sends considerably more than 5 per second in total. In ASP.NET and ASP.NET Core it is on by default, with events sampled separately from everything else.

The .NET 3.x SDK drops adaptive sampling. `SamplingRatio` sets a percentage, `TracesPerSecond` sets a rate limit defaulting to 5, and both apply equally to requests and dependencies. Logs inherit their parent trace's decision unless `EnableTraceBasedLogsSampler` is set to false.

Java has never supported adaptive sampling. The 3.4 agent and later apply rate-limited sampling by default, and sampling overrides let you set different rates for specific requests and dependencies, which is the finest-grained control available in any of these SDKs.

### Sampling Practices

- **Sample at the source.** Ingestion sampling reduces the bill but not the network traffic, and under OpenTelemetry it compounds with SDK sampling rather than deferring to it. Treat it as the option for when you cannot redeploy.
- **Alert on metrics, not on log counts.** Standard metrics are pre-aggregated before the sampler runs, so their thresholds hold while log-based ones drift with the rate.
- **Account for sampling in queries.** Use `summarize sum(itemCount)` rather than `count()`, or the numbers will understate reality by the sampling factor.
- **Expect query accuracy to degrade at high rates.** Past roughly 60% dropped, log-based query results become noticeably inflated and unstable.
- **Keep rates uniform across services.** Divergent rates within one distributed system break traces more often than any single rate does.

---

## Custom Metrics and Custom Events

Custom telemetry is where the correlation between application behavior and business outcome gets made. Under OpenTelemetry both come from standard APIs rather than Application Insights ones.

### Custom Metrics

Metrics come from a `Meter`, registered once at startup and used anywhere:

```csharp
// Startup: register the meter name with the provider
builder.Services.ConfigureOpenTelemetryMeterProvider((sp, b) =>
    b.AddMeter("Contoso.Orders"));
builder.Services.AddOpenTelemetry().UseAzureMonitor();

// Anywhere in the application
var meter = new Meter("Contoso.Orders");
var orderValue = meter.CreateHistogram<double>("order.value");
var ordersPlaced = meter.CreateCounter<long>("orders.placed");

orderValue.Record(order.Total,
    new("currency", order.Currency),
    new("country", order.Country));
ordersPlaced.Add(1, new("plan", customer.Plan));
```

The instrument type determines the aggregation:

| Instrument | Aggregation in Application Insights |
|---|---|
| `Counter` | Sum |
| `UpDownCounter` | Sum |
| `Histogram` | Min, max, average, sum, count |
| `ObservableGauge` | Average |

Metric names and namespaces must start with a letter and contain only letters, digits, `_`, `.`, `-`, or `/`. Spaces are rejected, which breaks names carried over from the classic SDK.

### Custom Events

Events carry categorical and numeric properties for behavioral analysis: sign-ups, feature usage, business transactions.

```csharp
logger.LogInformation(
    "{microsoft.custom_event.name} {plan} {source} {conversionSeconds}",
    "OrderPlaced", "Premium", "Referral", conversionSeconds);
```

Structured properties become custom dimensions, and numeric ones can be aggregated in KQL. Custom events feed the users, sessions, funnels, flows, and cohorts experiences.

### Enriching and Filtering Telemetry

The classic `ITelemetryInitializer` and `ITelemetryProcessor` have no equivalent in the Distro. Their replacement is an OpenTelemetry processor registered before the Azure Monitor exporter:

```csharp
public class RedactingProcessor : BaseProcessor<Activity>
{
    public override void OnEnd(Activity activity)
    {
        if (activity.GetTagItem("url.full") is string url)
        {
            activity.SetTag("url.full", StripQueryString(url));
        }
        activity.SetTag("deployment.ring", "canary");
    }
}

builder.Services.ConfigureOpenTelemetryTracerProvider((sp, b) =>
    b.AddProcessor(new RedactingProcessor()));
builder.Services.AddOpenTelemetry().UseAzureMonitor();
```

Attributes set on a span land in `customDimensions`. Values that describe the process rather than the operation (role name, environment, version) belong on the OpenTelemetry resource instead, where they are attached once rather than copied onto every item.

---

## Exporting and Querying Data

### Exporting Telemetry

Continuous export was the classic mechanism, and it retired with classic resources on 29 February 2024. It is incompatible with workspace-based resources.

The replacement is [diagnostic settings](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/diagnostic-settings){:target="_blank" rel="noopener noreferrer"} on the Application Insights resource, which stream to a storage account, an Event Hubs namespace, or a partner destination. Use them to archive for compliance beyond the workspace retention window, feed a data lake, stream to a real-time pipeline, or forward to a SIEM.

Data export from the Log Analytics workspace itself is the other option, and it operates per table across everything the workspace holds rather than per Application Insights resource.

### Querying Data

Application Insights telemetry is queried in KQL, either in the portal or through the [Logs query API](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/overview){:target="_blank" rel="noopener noreferrer"} at `api.loganalytics.azure.com`, which requires Microsoft Entra authentication. Client libraries exist for .NET, Java, JavaScript, Python, and Go, and `az monitor log-analytics query` covers the command line.

```kusto
requests
| where timestamp > ago(24h)
| where success == false
| summarize failed = sum(itemCount) by resultCode, operation_Name
| order by failed desc
```

The `sum(itemCount)` rather than `count()` is the sampling correction. Every log-based query over sampled telemetry needs it.

The legacy Application Insights data-plane endpoint (`api.applicationinsights.io`) accepted API keys. That authentication path was retired on 31 March 2026, so integrations still pointed at it need a managed identity or a service principal.

---

## Work Item Integration

Work item integration creates issues, bugs, or tasks in Azure DevOps or GitHub from Application Insights, prepopulated with the telemetry that prompted them.

**How it actually works, which is not automatically:**

1. A work item template is an Azure Monitor workbook (resource type `Microsoft.Insights/workbooks`) holding KQL queries and layout. Creating one requires `Microsoft.Insights/workbooks/write`, such as the Workbook Contributor role.
2. From the end-to-end transaction details view, reachable from the performance, failures, and availability tabs, you select an event and choose **Create work item**.
3. Application Insights fills in the exception detail, operation name, and a link back to the transaction.
4. A browser tab opens in the target system where the item is actually created, so you need permission there too.

Because templates are workbooks, they deploy through ARM templates like any other resource, and one Application Insights resource can carry several templates targeting different repositories.

Smart detection alerts do not create work items on their own. Routing a detection into a tracking system means migrating smart detection to alert rules and wiring an action group to whatever automation you use.

---

## Profiler, Code Optimizations, and Snapshot Debugger

### .NET Profiler

The [.NET Profiler](https://learn.microsoft.com/en-us/azure/azure-monitor/profiler/profiler-overview){:target="_blank" rel="noopener noreferrer"} captures call stacks from a running application and identifies the hot code path for a given request, alongside median, fastest, and slowest response times per operation.

Three triggers start it, and each is separately configurable:

| Trigger | Fires when |
|---|---|
| Sampling | Randomly, roughly once per hour |
| CPU | CPU usage exceeds 80% |
| Memory | Memory usage exceeds 80% |

**Cost and overhead:** while actively collecting, the profiler adds roughly 5% to 15% CPU and memory overhead. Traces are retained 15 days at no storage charge. Web apps need at least the Basic App Service tier, and only one profiler can attach to a web app.

Enablement is a portal toggle on App Service and on Functions running an App Service plan, an ARM template setting on VMs and Service Fabric, and a package for containers and other hosts. The Azure Monitor OpenTelemetry Profiler for .NET is the Distro-compatible package and is in preview, as is the Java profiler.

### Code Optimizations

[Code Optimizations](https://learn.microsoft.com/en-us/azure/azure-monitor/optimization-insights/code-optimizations-profiler-overview){:target="_blank" rel="noopener noreferrer"} analyzes profiler traces and snapshot debugger snapshots and produces code-level recommendations hourly, tied to specific methods. The default view is a rolling 24-hour window with 30 days of history. It works only with default profiler storage, not with bring-your-own-storage.

### Snapshot Debugger

The [Snapshot Debugger](https://learn.microsoft.com/en-us/azure/azure-monitor/snapshot-debugger/snapshot-debugger){:target="_blank" rel="noopener noreferrer"} captures a memory snapshot when an exception is thrown in a .NET application, which you then open in Visual Studio to inspect locals and object state at the moment of failure.

**Trade-offs:**
- Snapshots are retained 15 days
- Collection adds overhead at exception time, and snapshots are large to upload
- It triggers on exceptions only, so it diagnoses nothing about a slow but successful request

---

## Cost Management

Application Insights bills for data ingested and for retention beyond the included window, on the workspace that holds it.

### Controlling Ingestion

**Sampling** is the largest lever, and the only one that reduces volume before the data leaves the process.

**Filtering** through span processors drops what you never query: health-check endpoints, static asset requests, chatty internal dependencies. A processor that filters before export costs less than an ingestion-time transformation, which costs less than storing and querying the data.

**Selective collection** turns off telemetry types the team does not use. Disabling log collection entirely is a common early win in applications that never query the `traces` table.

**A daily cap** stops ingestion when the workspace hits a threshold. Treat it as a safety net against a runaway logging bug rather than a cost strategy, because it drops everything once tripped, including the telemetry you need to diagnose the runaway.

### Retention Choices

Retention past the included 90 days is billed per GB per month, so a 730-day setting on a high-volume application becomes a large recurring line item. Aggregated metrics hold their 90 days at 1-minute granularity no matter what raw telemetry is set to, which makes them the cheap place to keep a long-term trend. Where the requirement is compliance rather than analysis, workspace total retention plus a search job costs considerably less than keeping everything interactively queryable.

### Patterns That Work

**Sample by environment, not uniformly.** Production at a low rate with staging at 100% gives you full detail where you are actively debugging and volume control where the traffic is.

**Sample by workload.** A high-volume health-check path and a low-volume payment path do not need the same rate, though under the Azure Monitor sampler this takes span processors rather than a configuration setting.

**Consolidate workspaces.** Several applications in one workspace share the ingestion tier's volume discounts and let one query span services. Separate workspaces per application forfeit both.

**Keep metrics, drop logs.** Raw traces for a short window plus metrics for the long trend cost a fraction of full-fidelity retention and answer most historical questions.

---

## Common Pitfalls

### Pitfall 1: Following Guidance Written for the Classic Product

**Problem:** Building against `TelemetryClient`, adaptive sampling, telemetry processors, continuous export, and multi-step web tests because most published material still describes them.

**Result:** Code that has to be migrated before it ships, or a design that depends on a feature already removed from the product.

**Solution:** Check the date and the API surface on anything you read. Classic resources retired February 2024, continuous export went with them, multi-step tests retired August 2024, and URL ping tests retire September 2026. New applications start with the OpenTelemetry Distro.

---

### Pitfall 2: Losing Trace Context Across Async and Messaging Boundaries

**Problem:** Custom async work or a queue hop that does not carry the trace context forward.

**Result:** Telemetry arrives but under a new trace ID, so the transaction view shows two unrelated halves and end-to-end diagnostics stops working at the boundary.

**Solution:** Use the `Activity` API for custom async operations, embed `traceparent` in message properties for queue hops, and verify that your instrumentation libraries cover the client you actually use.

---

### Pitfall 3: Alerting on Sampled Telemetry

**Problem:** An alert rule that counts log records or exception rows while sampling is active.

**Result:** The rule fires inconsistently, because the count it sees is the sampled count and the sampling rate moves with load.

**Solution:** Alert on metrics, which are never sampled and are pre-aggregated before the sampler runs. Where a log-based rule is unavoidable, use `sum(itemCount)` and set the threshold with the sampling factor in mind.

---

### Pitfall 4: Sensitive Data in Telemetry

**Problem:** Query strings, request bodies, exception messages, or custom dimensions carrying credentials, tokens, or personal data.

**Result:** Regulated data sitting in a Log Analytics workspace, readable by anyone with workspace read access, and immutable after ingestion. Telemetry cannot be edited, so removing it means a purge operation.

**Solution:** Redact in a span processor before export. Review exception handling for anything that formats user input into a message. Application Insights does not log POST bodies by default, so keep it that way unless you have a specific need and a redaction path.

---

### Pitfall 5: Running Two Instrumentation Paths at Once

**Problem:** Autoinstrumentation left enabled on App Service while the application also initializes the Distro, or 2.x and 3.x SDK packages mixed in one project.

**Result:** Duplicated telemetry, doubled ingestion cost, and startup failures from conflicting package versions.

**Solution:** One path per application. If you add the Distro, turn off the portal toggle. If you upgrade to the 3.x SDK, upgrade every Application Insights package together and remove the collector packages that have no 3.x version.

---

### Pitfall 6: Unbounded Operation Names

**Problem:** Operation names that embed identifiers, so `GET /api/users/8f21c` and `GET /api/users/3b04e` count as different operations.

**Result:** The performance view fragments into thousands of one-request operations, aggregation stops meaning anything, and the application map turns into noise.

**Solution:** Parameterize the route in the operation name. The Java 3.x agent does this by default, and most instrumentation libraries do the same. Verify it holds for custom instrumentation, and use a span processor to rewrite names the libraries get wrong.

---

## Key Takeaways

1. **OpenTelemetry is the instrumentation path.** The Azure Monitor OpenTelemetry Distro is the recommended setup for new server-side applications, the classic 3.x SDKs are themselves OpenTelemetry behind a compatibility layer, and browsers remain the one place where the JavaScript SDK is still the answer.

2. **Every Application Insights resource is workspace-based.** Classic resources retired in February 2024. The telemetry lives in a Log Analytics workspace, which is what determines retention, cost, and the other data you can join against.

3. **Check the retirement dates before designing around a feature.** Continuous export, multi-step web tests, and URL ping tests have all been retired or dated. Diagnostic settings, standard tests, and custom tests on your own compute are the replacements.

4. **Sampling behaves differently than the classic documentation says.** One rate covers all telemetry types, upstream decisions are ignored, and ingestion sampling now multiplies with SDK sampling instead of standing down.

5. **Metrics survive sampling and logs do not.** That asymmetry should drive which signals your alerts and long-lived dashboards are built on.

6. **Distributed tracing is what makes the rest of it useful.** A trace ID that survives every hop, including queues and custom async work, separates one transaction view from five disconnected log searches.

7. **Custom events and metrics connect the application to the business.** Revenue, conversion, and engagement tracked next to latency and error rate let you tell a performance regression from a demand shift.

8. **Availability testing measures what users experience.** Standard tests from at least five locations, alerting at three, with certificate lifetime checks, catch failures that internal metrics never see.

9. **Work item integration is manual and template-driven.** Templates are workbooks, items are created from the transaction view, and smart detection does not file them for you.

10. **Redact before export.** Telemetry is immutable once ingested, so a span processor that strips sensitive fields is the only place the problem is cheap to fix.
