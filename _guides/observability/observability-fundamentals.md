---
title: "Observability Fundamentals"
layout: guide
category: Observability
subcategory: Monitoring & Observability
description: "What observability is and how it differs from monitoring, what logs, metrics, traces, and continuous profiles each record and miss, how trace IDs and exemplars join them into one investigation, and how OpenTelemetry instruments a service once for any backend."
tags: [fundamentals, logging, metrics, distributed-tracing, profiling, flame-graphs, opentelemetry]
---

## What Observability Means

A running service is a black box. You can't pause it and inspect its memory in production, so everything you learn about its state comes from what it emits. The term comes from control theory, where Rudolf Kálmán defined a system as observable when its internal state can be worked out from its outputs. Software borrowed the idea with a practical twist. A service is observable to the extent that you can answer a question about its behavior that nobody anticipated, using the telemetry it already produces, without shipping new code to ask it. Charity Majors, who popularized this framing, puts the test as asking [new questions of your data without shipping new code](https://charity.wtf/2022/08/15/live-your-best-life-with-structured-events/){:target="_blank" rel="noopener noreferrer"}.

### Monitoring Watches for Problems You Predicted

Google's [SRE book](https://sre.google/sre-book/monitoring-distributed-systems/){:target="_blank" rel="noopener noreferrer"} defines monitoring as collecting, processing, aggregating, and displaying quantitative data about a system. In practice that means dashboards and alerts built around conditions someone expected, such as an error rate above 1%, a disk above 90%, or a queue that keeps growing. Monitoring is excellent at the problems it was built for, and it tells you quickly that something is wrong.

It struggles with problems nobody predicted. A distributed system can fail through combinations no one planned for, like one tenant's unusual payload that only slows one code path when a cache is cold. No dashboard was built for that, and an investigation limited to predefined charts stalls there. Observability is the property that lets the investigation continue. The two aren't opposites. Monitoring is a practice that runs on the same telemetry an observable system produces.

| | Monitoring | Observability |
|---|---|---|
| **Question it answers** | Is something wrong? | Why is it wrong, including causes nobody anticipated? |
| **Built from** | Dashboards and alerts defined in advance | Telemetry detailed enough to slice by any attribute after the fact |
| **Handles well** | Known problems: a full disk, a crashed process, a spike in 5xx responses | New problems: a slowdown that affects one customer, one region, and one API version |
| **Where it runs out** | Anything nobody wrote a check for | Anything the telemetry never recorded |

### A Worked Example

The rest of this guide follows one request. A user presses "Pay Now" on a shopping site. The request reaches a **checkout** API, which reads the cart from its database, calls an **orders** service to create the order, and then calls a **payments** service, which charges the card through an external payment gateway. Today checkout is slow for some users, and the goal is to find out why.

## Telemetry Signals

Every signal starts from the same raw material, the events in a running system. A request arrives, a query runs, a call times out. The signals differ in what they keep from each of those events and what they throw away, and that choice sets both what each can tell you and what each costs.

Logs, metrics, and traces are often called the three pillars of observability. [OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/){:target="_blank" rel="noopener noreferrer"}, the vendor-neutral standard that graduated in the CNCF in May 2026, calls them signals, and adds baggage (key-value context carried along with a request) and profiles, which entered public alpha in March 2026.

| Signal | What it keeps from each event | What it discards | Cost grows with | Best at |
|---|---|---|---|---|
| **Logs** | A record of the individual event, with whatever detail the code wrote | Whatever the code didn't write, and records below the configured level | Traffic, and how much each request logs | Explaining what happened in one place at one moment |
| **Metrics** | Only a count, sum, or distribution, aggregated over a time window | The individual event and its context | The number of distinct label combinations (the dimensions a metric is split by), not traffic | Showing trends and triggering alerts cheaply |
| **Traces** | Each operation's timing and its parent, for one request across services | Requests not chosen for the sample (see [Sampling](#sampling-keeps-tracing-affordable)) | Traffic, operations recorded per request, and the share of requests kept | Showing where one request spent its time |
| **Profiles** | Periodic samples of which code was on the CPU or allocating memory | Which request the code was serving, in most tools | Number of hosts profiled and the sampling rate, not traffic | Showing which functions consume resources |

## Logs

A log is a timestamped record of one event, written by the code where the event happened. Logs can carry more detail than any other signal, because the developer chooses exactly what to write.

### Structured Logs Are Queryable

An unstructured log is a line of text:

```text
2026-09-24 14:47:03 WARN Payment attempt 1 for order 88213 timed out after 2000ms
```

Finding every timeout for one order means writing a text search that matches this exact wording, and it breaks when someone rewords the message. A structured log records the same event as named fields:

```json
{
  "timestamp": "2026-09-24T14:47:03.412Z",
  "severity": "WARN",
  "body": "Payment attempt {Attempt} for order {OrderId} timed out after {ElapsedMs}ms",
  "attributes": { "Attempt": 1, "OrderId": 88213, "ElapsedMs": 2000 },
  "resource": { "service.name": "payments", "service.version": "4.2.0" },
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7"
}
```

Now a query can ask for every record where `ElapsedMs` exceeds 1500, grouped by `service.version`, without parsing prose. The `resource` block describes the process that wrote the record rather than the event itself. The trace and span IDs tie the record to a trace, the record of one request's path through the system that [Traces](#traces) describes. The fields above map onto OpenTelemetry's [log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/){:target="_blank" rel="noopener noreferrer"}, which also defines where the trace and span IDs go (see [How the Signals Connect](#how-the-signals-connect)). Most logging libraries produce structured output from a message template with named placeholders. In .NET that is `ILogger`, covered in [C# Logging with Microsoft.Extensions.Logging](/study-guides/dotnet/c-sharp/libraries/logging.html).

### Severity Levels Control Volume

Each record carries a severity. OpenTelemetry's scale runs TRACE, DEBUG, INFO, WARN, ERROR, FATAL, and most libraries map their own names onto it. The level is how you decide, at run time and without redeploying, how much a service writes. Production services commonly keep INFO and above and turn on DEBUG only for a component under investigation, because DEBUG output can multiply log volume many times over.

### Kinds of Logs

The same mechanism serves readers with different needs, and those needs set how long each kind is kept and who may read it.

| Kind | Records | Typical reader |
|---|---|---|
| **Application** | Business events, errors, and state changes inside the service | Developers debugging behavior |
| **Access** | One line per HTTP request or API call: method, path, status, duration | Operators investigating traffic |
| **Audit** | Who did what to which resource, and when | Compliance and security reviewers, often under a mandated retention period |
| **Security** | Sign-ins, authorization failures, policy changes | Security operations |
| **System** | Operating system, container runtime, and hardware events | Platform operators |

### Where Logs Fall Short

- **Volume and cost.** Log volume grows with traffic, and storing and indexing it is often one of the largest costs of observability.
- **Isolation.** Each record describes one moment in one process. Without a shared ID, the log lines one request produced across several services can't be pulled together.
- **Lost with the container.** In Kubernetes, a container's standard output is kept in rotated files on its node and removed when the pod is evicted or deleted, so logs have to be shipped off the node while they still exist.
- **Only what someone wrote.** A code path with no log statement is invisible to logs, however long it takes.

## Metrics

A metric is a number measured over time. `http.server.request.duration` for the checkout service, sampled across every request, becomes a series of values you can chart, compare with last week, and alert on.

### A Series Per Label Combination

A metric carries labels (OpenTelemetry calls them attributes), such as `http.request.method`, `http.route`, and `http.response.status_code`. Attributes live at two levels. **Resource attributes**, such as `service.name` and `service.version`, describe the process producing the telemetry and are shared by everything it emits. The rest belong to one measurement, span, or log record. Each distinct combination of label values is its own time series. That is what makes metrics cheap. The checkout service can handle a million requests an hour and still produce only a few hundred series, because the metric stores aggregates per combination, not the requests themselves. It is also what makes metrics dangerous. A label whose values are unbounded, like a user ID, creates one series per user, and storage and query cost grow with it. The number of distinct values a label can take is its cardinality, and keeping it low is the main discipline metrics ask for.

High-cardinality attributes still have a home. A span (one timed operation within a trace) or a structured log record is stored once, so its storage cost barely changes whether its `customer.id` attribute has ten possible values or ten million. Customer, tenant, and order IDs belong there, and they are what make a question like "is this slowdown one customer?" answerable after the fact.

### Instrument Types

OpenTelemetry's [metric instruments](https://opentelemetry.io/docs/concepts/signals/metrics/){:target="_blank" rel="noopener noreferrer"} cover four shapes of measurement. Other systems, such as Prometheus, use similar types under similar names.

| Instrument | Records | Checkout example | How you usually read it |
|---|---|---|---|
| **Counter** | A total that only goes up | Payments attempted | As a rate: attempts per second over the last five minutes |
| **UpDownCounter** | A total that goes up and down | Requests currently in flight | As the current value |
| **Gauge** | A value read at a point in time, where adding values from several processes means nothing | Product cache hit ratio | As the current value, or its maximum over a window |
| **Histogram** | How many values fell into each range of sizes | Request duration | As percentiles, such as the p99 latency, which 99% of requests stay under |

Counter, UpDownCounter, and Gauge also have asynchronous forms. Instead of the code recording every change, a callback reads the current value each time metrics are collected for export, which suits values like CPU time that are cheaper to read than to track.

### Histograms Keep the Shape of Latency

Record latency as a histogram. Averages hide the slow requests users complain about, and percentiles from separate servers can't be combined, but histogram counts can be merged across every instance, as long as they share bucket boundaries, and percentiles computed from the result. [Performance Engineering](/study-guides/architecture/performance-engineering.html) covers why the tail of the distribution matters and how to set percentile targets.

### What to Measure First

Three widely used checklists give a starting set, so a new service doesn't begin with a blank dashboard.

| Checklist | Applies to | Measures |
|---|---|---|
| **Four golden signals** (Google SRE book) | Any user-facing service | Latency, traffic, errors, saturation (how full the most constrained resource is) |
| **RED method** (Tom Wilkie) | Each request-serving service | Rate, errors, duration |
| **USE method** (Brendan Gregg) | Each resource: CPU, memory, disks, connection and thread pools | Utilization, saturation (work queued waiting for the resource), errors |

The golden signals and RED look at a service from the outside, as its callers experience it. USE looks at the resources inside it. Business metrics like orders placed and payments declined belong alongside them, because a deploy can leave every technical metric green while orders quietly stop.

### Where Metrics Fall Short

A metric tells you that checkout's p99 latency tripled at 14:46 and that the rise came from the payments service. It can't tell you which requests were slow or why, because aggregation already discarded the individual requests. It also only covers what someone decided to measure in advance, with the labels they chose, so a question about an attribute that wasn't a label has no answer in metrics.

## Traces

A trace records one request's path through the system. It is how you see that checkout spent three seconds waiting on payments, and that payments spent those three seconds waiting on the gateway.

### Spans Form a Tree

A trace is a tree of **spans**. A span is one timed operation, such as handling an HTTP request, running a query, or calling another service. Every span in the tree carries the same trace ID, and each span except the first (the root) records the ID of the span that caused it, its parent. OpenTelemetry's [span model](https://opentelemetry.io/docs/concepts/signals/traces/){:target="_blank" rel="noopener noreferrer"} defines these fields:

| Field | Holds |
|---|---|
| **Name** | The operation, such as `POST /payments` |
| **Span context** | The trace ID, this span's ID, trace flags (including whether the trace is sampled), and trace state for vendor-specific values |
| **Parent span ID** | The span that caused this one. Empty on the root span |
| **Start and end timestamps** | When the operation began and finished |
| **Kind** | Server, client, internal, producer, or consumer, which tells the backend how spans across services fit together |
| **Attributes** | Key-value context, such as the HTTP method, status code, or database table |
| **Events** | Timestamped points within the span, such as an exception being thrown |
| **Links** | References to spans in other traces, used when one operation relates to several requests, as in batch processing |
| **Status** | Unset (the default), Ok, or Error |

A tracing backend draws the tree as a waterfall, with one bar per span positioned on a shared timeline and indented under its parent.

{% include figure.html id="obs-trace-waterfall" %}

Between the three services, the figure shows only the server side of each call, and a full trace also records a client span in the caller for each outgoing call. `SELECT cart` and the two `POST /charge` spans are client spans, because the database and the external gateway send no spans of their own. Reading the waterfall answers questions no metric could. The orders call finished in under 200 ms. Almost all of checkout's time sits under `POST /payments`, and inside it the first gateway call ran for two seconds, ended in Error, and was retried. The trace has found where the time went. It hasn't yet said why the first call timed out.

### Context Propagation Carries the Trace Across Services

A trace only spans services if each call carries the trace ID and the caller's span ID with it. This is context propagation. For HTTP the standard carrier is the W3C [Trace Context](https://www.w3.org/TR/trace-context/){:target="_blank" rel="noopener noreferrer"} `traceparent` header:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

The four fields are the format version, the 32-hex-character trace ID, the 16-hex-character ID of the calling span, and flags whose last bit marks the trace as sampled. The receiving service reads the header, starts its server span as a child of that calling span, and sends a new header on every call it makes in turn. Message queues carry the same context in message headers. When any hop drops the context, such as a proxy that strips unknown headers or a background job that starts work without it, the trace splits into two unrelated traces at that point.

{% include figure.html id="obs-context-propagation" %}

### Sampling Keeps Tracing Affordable

Trace volume grows with traffic and with the number of spans per request, as log volume does, so most systems keep only a sample of traces. With **head sampling**, the service that starts the trace decides whether to keep it and records the decision in the sampled flag, so downstream services that honor the flag make the same choice and the trace is kept or dropped whole. The decision is made before anyone knows whether the request will fail. **Tail sampling** waits until the trace is complete and keeps it by outcome, such as every error and every slow request, at the cost of buffering whole traces before deciding.

### Where Traces Fall Short

- **Every hop must be instrumented.** An uninstrumented service appears only as its caller's client span, like the payment gateway in the waterfall, with no detail about what happened inside it.
- **The request you want may not have been kept.** Sampling means a specific customer's failed request might not have a trace.
- **Timing, not explanation.** A trace shows that a call took two seconds and failed. The reason is usually in the logs that the code wrote during that span.

## Profiles

Traces stop at the span. A profile goes inside the process and shows which functions consumed CPU time or allocated memory. A profiler interrupts the process many times a second, records the call stack it finds, and aggregates the stacks. The usual way to read the result is a flame graph.

{% include figure.html id="obs-flame-graph" %}

Each box is a function, stacked on the function that called it, and its width is the share of samples in which it appeared. The x-axis is not time. Boxes are usually sorted alphabetically, and wide boxes are where the resource goes. This one is a CPU profile of the checkout service on an ordinary day, separate from the slow-payment investigation, and it shows that serializing the response takes more CPU than the business logic does.

### Continuous Profiling

Profiling has long been an ad hoc tool. You attach a profiler to one process, reproduce the problem, and detach. Continuous profiling samples production processes all the time, at a low enough rate to leave running, and stores the results, so you can look at what the code was doing at the moment an incident happened instead of trying to reproduce it later. Tools like [Grafana Pyroscope](https://grafana.com/oss/pyroscope/){:target="_blank" rel="noopener noreferrer"} and [Parca](https://www.parca.dev/){:target="_blank" rel="noopener noreferrer"} do this today. Profiles differ by what triggers a sample. CPU profiles sample running code, allocation profiles sample memory allocations, and lock profiles sample time spent waiting for contended locks. [Performance Engineering](/study-guides/architecture/performance-engineering.html) covers what each kind finds.

OpenTelemetry's [profiles signal entered public alpha](https://opentelemetry.io/blog/2026/profiles-alpha/){:target="_blank" rel="noopener noreferrer"} in March 2026. Its profiler runs as part of the OpenTelemetry Collector (a standalone telemetry agent, covered under Instrumentation) and uses eBPF, a Linux kernel feature for running observation code safely, to sample every process on a host without code changes. The project cautions against using it for critical production workloads while it is in alpha, and backend support is still arriving.

## How the Signals Connect

Each signal answers part of the question. The investigation moves fast only when you can jump from one signal to the matching data in the next without searching by timestamp and guessing.

### Trace IDs Join Logs to Traces

When code writes a log inside a span, the logging library can stamp the record with the current trace ID and span ID, as in the structured log above. From the failed gateway span in the waterfall, the backend can then show exactly the log lines written during that span, in every service, and nothing else.

### Exemplars Join Metrics to Traces

A metric data point, most usefully a latency histogram's, can carry an **exemplar**, which is the trace and span ID of one request it counted. The latency chart's spike then links directly to a trace of a request that was actually slow, instead of leaving you to search for one.

### Span IDs Join Profiles to Traces

Some profilers tag each stack sample with the trace and span that were active when it was taken, and OpenTelemetry's profile format has fields for them. A slow span can then open a flame graph of only the code that ran during it. Support varies by tool and runtime, so confirm it before counting on it.

### Resource Attributes Join Everything to Its Source

Every signal from a process carries the same resource attributes, such as `service.name`, `service.version`, and the deployment environment. They let you filter all four signals the same way, and they make questions like "did this start with version 4.2.0?" answerable in each one.

### One Investigation, Signal by Signal

Put together, the slow checkout investigation reads like this:

| Step | Signal | What it shows |
|---|---|---|
| 1 | Metric | An alert fires because checkout's p99 latency tripled at 14:46 |
| 2 | Metric, by resource attribute | The rise is in the payments service's latency, and only since `service.version` 4.2.0 deployed |
| 3 | Trace, through an exemplar | The first gateway call times out after 2 s and the retry succeeds |
| 4 | Logs, by trace ID | Logs from the failed span show version 4.2.0 opening a new gateway connection for every charge, and connection setup timing out |
| 5 | Metric, by resource attribute | Payments CPU utilization stays low while its open gateway connections climb, so the fix is in how it connects, not in how fast its code runs |

No single signal would have got there. The metric knew when and where but not why, the trace knew which call but not the cause, and the logs had the cause but no way to be found among millions of other lines without the trace ID.

## Instrumentation

Telemetry exists only where something produces it. Instrumentation is the code, written or generated, that records spans, metrics, and logs as a service runs.

### Automatic and Manual Instrumentation

**Automatic instrumentation**, also called zero-code instrumentation, hooks into frameworks and libraries a service already uses, such as its HTTP server and client, database driver, and message queue client. For the libraries it supports, it produces spans and metrics for every inbound request and outbound call, and propagates context between them, without changes to application code. It is the fastest way to get the waterfall above.

It can't know the business meaning of the work, though. **Manual instrumentation** adds what only the code knows, such as a span around the fraud check, a counter of payments declined by reason, an attribute recording the payment method. Most services use automatic instrumentation for the plumbing and add manual instrumentation for the operations that matter to the business.

### OpenTelemetry Separates Instrumenting From Where Data Goes

Observability vendors have long shipped their own agents and SDKs, so changing vendors meant re-instrumenting every service. OpenTracing and OpenCensus were earlier vendor-neutral attempts, and they merged in 2019 to form OpenTelemetry, which splits the job into parts:

- **The API** is what instrumentation code calls to create spans, record metrics, and emit logs. Libraries can depend on it safely, because with no SDK configured its calls do nothing.
- **The SDK** is configured once per service. It decides sampling, batching, and which exporters (the plugins that send telemetry out) deliver it where.
- **OTLP** is the wire protocol for sending all signals to a backend or to the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/){:target="_blank" rel="noopener noreferrer"}, an optional process that receives, filters, and forwards telemetry.
- **Semantic conventions** fix the attribute names, such as `http.request.method` and `db.system.name`, so that every backend recognizes an HTTP span or a database call regardless of which library produced it.

Switching backends then means changing exporter configuration, not code.

### Keep Secrets and Personal Data Out

Telemetry is copied to other systems, kept for weeks or months, and read by more people than the production database is. Passwords, tokens, full card numbers, and personal data don't belong in log messages, span attributes, or metric labels. Mask or drop them where the telemetry is produced, because removing them after they reach a backend usually means finding every copy.

## Key Takeaways

- **Observability is a property, monitoring is a practice.** Monitoring alerts on problems you predicted. Observability is whether your telemetry can explain the ones you didn't.
- **Each signal keeps something different from each event.** Logs keep detail, metrics keep aggregates, traces keep causality and timing, and profiles keep which code used the resources.
- **Structure logs from the start.** Named fields make logs queryable, and a trace ID in each record makes them findable.
- **Keep metric labels bounded.** Every distinct label combination is a separate series, and an unbounded label multiplies cost. Put customer and order IDs on spans and logs instead.
- **Record latency as a histogram.** Percentiles computed from merged histograms are correct across a fleet, and averages hide the slow requests.
- **Traces depend on propagation.** One hop that drops the `traceparent` context splits the trace in two.
- **The signals are most useful joined.** Trace IDs link logs to spans, exemplars link metric spikes to traces, and shared resource attributes let you slice everything the same way.
- **Instrument once with OpenTelemetry.** Automatic instrumentation covers the plumbing, manual instrumentation adds business meaning, and the backend becomes a configuration choice.
