---
title: "Observability Architecture"
layout: guide
category: Observability
subcategory: Monitoring & Observability
description: "Designing the pipeline between instrumented services and observability backends: OpenTelemetry Collector deployment patterns, protecting, monitoring, and scaling the pipeline, head and tail sampling at scale, metric cardinality limits, what drives telemetry cost and how to control it, migrating to OpenTelemetry, and designing services to be observable."
tags: [advanced, opentelemetry, opentelemetry-collector, telemetry-pipelines, tail-sampling, cardinality, cost-analysis]
---

## What the Pipeline Has to Do

Instrumentation produces telemetry inside each process. Something has to get it from there to the backends where people query it, and at scale that path becomes a system of its own. It has to collect from every process and host, protect itself when volume spikes, enrich and clean the data, decide what to keep, route it to one or more backends, and do all of it at a cost the organization will keep paying.

Each of those decisions can be made at one of four places, and where a decision is made determines what it can see.

| Where | Sees | Suited to | Limit |
|---|---|---|---|
| **SDK, in the process** | Each span, metric, and log as it's created, with full context | Head sampling, dropping metric attributes, batching exports | Can't see spans from other services, or change without redeploying the service |
| **Agent Collector, on the host** | Everything from the processes on one host or pod | Adding host and Kubernetes metadata, reading log files and host metrics | Can't see a whole trace when its spans came from several hosts |
| **Gateway Collector, a central pool** | Everything routed to it from many hosts | Tail sampling, redaction policy, holding backend credentials, sending to several backends | One more tier that can fail and add latency |
| **Backend** | Everything it stores | Querying, retention tiers, downsampling old data | Has usually already charged for everything it ingested |

The rest of this guide is about placing each decision at the right one of these.

## Collector Deployment Patterns

The [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/){:target="_blank" rel="noopener noreferrer"} is a standalone process built from five kinds of component. Receivers take telemetry in, processors transform or filter it, exporters send it on, and connectors join one pipeline to another, such as turning spans in a traces pipeline into metrics in a metrics pipeline. Extensions add capabilities outside the data path, such as health checks and on-disk storage. The same binary can play either of two roles, and the [deployment docs](https://opentelemetry.io/docs/collector/deploy/){:target="_blank" rel="noopener noreferrer"} describe the patterns built from them.

### No Collector

Each service's SDK exports straight to the backend. It is the simplest setup and a reasonable place to start. Its costs show up as the fleet grows. Every service holds backend credentials and endpoints, so changing either means redeploying everything. Retries during a backend outage buffer in the application's own memory. And no decision can see more than one process.

### Agent

An agent Collector runs beside the application, either as a sidecar in each pod or as one Collector per node. A sidecar isolates each application and costs one Collector per pod. A per-node agent is cheaper and can read the node's own metrics and log files, but it's shared by every pod on the node. Either way, applications send to a local endpoint, which is fast and rarely unavailable, and the agent adds host and Kubernetes metadata, scrapes host metrics, and tails log files that applications write to disk. OpenTelemetry's docs note that the pattern is straightforward to start with but scales poorly for teams and infrastructure, and is inflexible as deployments grow.

### Gateway

A gateway is a pool of Collectors behind one endpoint that many services send to. It centralizes what shouldn't be repeated in every service, such as backend credentials, redaction and filtering policy, sampling, and fan-out to several backends. The docs list its costs plainly. It is one more thing to maintain and one more thing that can fail, it adds latency when Collectors are cascaded, and it uses more resources overall.

### Agent to Gateway

Large deployments often combine the two. Agents handle what is local, and gateways handle what needs a wider view. Tail sampling is the decision that forces the design. A gateway can only judge a trace by its outcome if it has every span of that trace, but the spans come from different services on different hosts, and an ordinary load balancer spreads them across the pool without regard to trace ID.

The fix is to route by trace ID. Each agent runs a **load-balancing exporter** that hashes the trace ID of every span to pick a gateway, so all spans of one trace land on the same gateway no matter which host produced them.

{% include figure.html id="obs-collector-topology" %}

Routing by trace ID has consequences of its own. When the gateway pool scales up or down, the hash assigns some traces to different gateways, and traces in flight at that moment can be split. Each gateway also holds every trace it is waiting to judge in memory, which [Tail Sampling Needs the Whole Trace](#tail-sampling-needs-the-whole-trace) returns to.

### Protecting the Pipeline

A telemetry pipeline is most likely to be overwhelmed exactly when the system it watches is failing, because failures produce errors, retries, and logs. Four rules keep the pipeline from making an incident worse.

- **The Collector sheds load before it runs out of memory.** The [memory limiter processor](https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/memorylimiterprocessor/README.md){:target="_blank" rel="noopener noreferrer"} goes first in each pipeline. When memory crosses its soft limit, it refuses new data, which pushes back on the senders so they retry later, instead of letting the Collector crash and lose everything it holds. Past a higher hard limit it also forces garbage collection.
- **Batching comes after the memory limiter and after any sampling**, so batches are built only from data that will be kept. The batch processor does this today, and exporters can optionally batch within their own queues.
- **Telemetry shouldn't block the application.** The SDKs' standard batching processors export on a background thread from a bounded queue, and when the queue is full they drop telemetry rather than slow the request that produced it. Losing some spans during an overload is acceptable. Adding latency to checkout because the tracing backend is slow is not.
- **Exporters ride out backend outages.** Most exporters have a [sending queue and retry settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md){:target="_blank" rel="noopener noreferrer"}. Failed sends retry with exponential backoff for up to five minutes by default, and data waits in the queue meanwhile. The default queue lives in memory, so a restarted Collector loses it, and when it fills, new data is dropped. Pointing the queue at a storage extension persists it to disk, so it survives a restart. That matters most on gateways, which hold data from many services at once. The load-balancing exporter that agents use for trace-ID routing is an exception. Its own queue and retry are off by default, so unless they're enabled it won't re-route data to a healthy gateway when a send fails, and its per-gateway queues can't be persisted.

### Watching the Pipeline Itself

Every rule above loses data on purpose when it has to, and none of that shows up in the backends, which simply receive less. The Collector reports on itself through its [internal telemetry](https://opentelemetry.io/docs/collector/internal-telemetry/){:target="_blank" rel="noopener noreferrer"}, including counts of data its receivers refused, data its exporters failed to queue or send, and each sending queue's size against its capacity. OpenTelemetry's docs treat sustained refusals and send failures as signs of data loss, and compare each queue's size with its capacity to tell whether it fits the workload. Those are the numbers to alert on. Without those alerts, a pipeline can drop a large share of telemetry for weeks, and the first sign is an investigation that finds the trace it needs was never stored.

### Scaling the Collector Tiers

The same numbers say when to add Collectors. OpenTelemetry's [scaling guide](https://opentelemetry.io/docs/collector/scaling/){:target="_blank" rel="noopener noreferrer"} suggests scaling up when exporter queues reach 60 to 70% of capacity, or when the memory limiter keeps refusing data. Most components scale by adding replicas behind a load balancer, but a few hold state and don't.

- **Tail sampling and span metrics** keep per-trace or per-service state in memory. Replicas behind an ordinary load balancer each see a fragment and reach inconsistent results, so they need a load-balancing exporter tier in front, routing by trace ID for tail sampling and by service for span metrics. An agent can export the same spans twice, once to each kind of gateway.
- **Prometheus scraping** duplicates when every replica has the same scrape configuration, because each one scrapes every target. Targets have to be split across replicas, by hand or with the OpenTelemetry Operator's Target Allocator, before adding replicas.

## Sampling at Scale

### Head Sampling Is Cheap and Blind

Head sampling decides when a trace starts. The usual setup is a ratio sampler at the root of the trace, which keeps a fixed share of new traces, and a parent-based sampler in every other service, which follows the decision already recorded in the incoming `traceparent` flag. Only the root decides because ratio samplers in different SDKs aren't guaranteed to reach the same answer for the same trace ID. OpenTelemetry's newer probability sampler, still at development status in the specification, is designed to decide consistently everywhere and to record its sampling threshold in the trace's `tracestate`. Unsampled spans are never exported, so head sampling saves cost at the source, in the application, on the network, and in every tier after it.

Its limit is that the decision comes before the outcome. At a 1% ratio, 99% of the requests that fail are discarded along with 99% of those that succeed.

### Tail Sampling Needs the Whole Trace

Tail sampling decides once the trace has had time to complete, so it can keep traces by what happened in them. A typical set of policies keeps every trace containing an error, every trace slower than the latency SLO, every trace touching a feature under investigation, and a small random share of everything else so the ordinary case stays visible.

[OpenTelemetry's sampling docs](https://opentelemetry.io/docs/concepts/sampling/){:target="_blank" rel="noopener noreferrer"} are direct about the price. Tail sampling is hard to implement and hard to operate. The Collector's [tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/tailsamplingprocessor/README.md){:target="_blank" rel="noopener noreferrer"} holds each trace's spans for a decision wait, 30 seconds by default from the first span it receives, and keeps a bounded number of traces in memory while it waits. Its memory grows with traffic multiplied by that wait, and it needs the trace-ID routing described above. When more traces arrive than the processor can hold, the oldest are evicted before their decision and dropped unsampled, so a traffic spike can lose exactly the traces an incident produces. The wait also only approximates completeness. A trace that runs longer, or a span that arrives late, reaches the processor after its decision was already made, and the processor has to be configured to remember past decisions to handle it consistently. It also saves nothing upstream. Every span is still created, exported, and shipped to the gateway before most are thrown away.

### Combining Them

High-volume systems often use both. Head sampling at a generous rate caps what reaches the gateways, and tail sampling then chooses among what's left by outcome. The two multiply. A trace survives only if the head sampler kept it, so an error in a request the head sampler dropped is never seen by the tail sampler.

### Sampling Skews What You Count

Counts taken from sampled traces undercount unless each span carries the probability it was sampled with. If only 1% of traces are kept and nothing records that rate, a dashboard counting error spans in the trace backend shows 1% of the actual errors, and a tail sampler that keeps every error makes the error rate look far worse than it is. Request rates, error rates, and latency distributions should come from data that sampling hasn't distorted.

- **SDK instruments** record every request, whatever the sampler decides, so they are the only exact source.
- **The Collector's [span metrics connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/connector/spanmetricsconnector/README.md){:target="_blank" rel="noopener noreferrer"}** derives request, error, and duration metrics from the spans it receives. Spans dropped by head sampling never leave the SDK, so its counts fall short unless the head sampler records its sampling threshold, the probability each span was kept with, in the span's `tracestate`, as the newer probability sampler is designed to. The connector then scales each span back up into an estimate and can tag the resulting series as extrapolated rather than counted. It has to run before any tail sampling. It's simplest on gateways that receive spans routed by service, so each service's counts come together on one writer, and recent versions can instead tag each replica's series with its own instance ID so several replicas can write without conflict. It is still at alpha stability.

## Managing Cardinality

### Where High Cardinality Comes From

Every distinct combination of metric attribute values is a separate time series, and the common sources of runaway series are easy to add by accident:

- **Identifiers as attributes.** User, session, order, and request IDs.
- **Raw values instead of templates.** A URL path like `/orders/88213` instead of the route template `/orders/{id}`. Semantic conventions provide `http.route` for exactly this.
- **Free text.** Error messages and exception strings, which vary with every input.
- **Short-lived infrastructure identifiers.** Pod names and container IDs change on every deploy, so each deploy starts a fresh set of series while the old ones linger until they expire.

### SDK Limits and Overflow

SDKs that implement OpenTelemetry's cardinality limit cap how many attribute combinations one metric stream can track, [2,000 by default](https://opentelemetry.io/blog/2026/cardinality-limits-in-opentelemetry/){:target="_blank" rel="noopener noreferrer"}. Past the cap, new combinations aren't dropped. Their measurements are folded into a single data point tagged `otel.metric.overflow=true`, so totals stay correct while the attributes are lost for everything beyond the limit. OpenTelemetry's guidance is to alert when overflow happens and treat it as a signal to inspect the metric, not as an automatic reason to raise the limit. The first fix is removing an unbounded or accidental attribute. Only if the dimension is legitimate and bounded should the limit go up.

### Reduce at the Source

The cheapest place to fix cardinality is where the metric is recorded, before any memory or network is spent on it.

- **Drop the attribute from the metric.** An SDK **view** can remove attributes from a metric stream without changing the instrumentation code.
- **Record the template, not the value.** Route templates, status code classes, and value buckets instead of raw paths, exact codes, and exact values.
- **Keep identifiers on spans and logs**, where they cost one attribute on one record, and let an exemplar on the metric point to an example trace.

Collector processors can also drop or rewrite attributes in the pipeline. That protects the backend, but the SDK has already paid the memory to track the series, so it's a backstop rather than the fix.

## Controlling Cost

### What Drives the Bill

Observability vendors price in different ways, such as per gigabyte ingested, per active series, per host, or per query, and the same telemetry can cost very differently under each. What drives volume is consistent, though:

| Signal | Volume grows with | Main levers |
|---|---|---|
| **Logs** | Traffic, log statements per request, and fields indexed | Levels, filtering at the source, indexing fewer fields, shorter retention |
| **Traces** | Traffic, spans per request, and the sampling rate | Head and tail sampling, fewer low-value spans |
| **Metrics** | Active series, and how often each is recorded | Cardinality control, longer collection intervals for slow-moving values |
| **Profiles** | Hosts profiled and the sampling frequency | Profiling fewer hosts, lower frequency |

### Filter Before It Leaves

Telemetry that nobody will query is cheapest if it's never sent. Health-check and readiness-probe requests can make up a large share of access logs and spans while telling almost nobody anything. DEBUG logs belong in development, or turned on for one component during an investigation. Both can be dropped before they cost network or ingestion, through instrumentation settings that exclude health-check paths, log level configuration, or a filter at the agent.

### Tier Retention by Age

Recent telemetry is queried constantly during incidents. Month-old telemetry is queried rarely, mostly for trends and audits. A tiered policy matches storage to that pattern, for example full detail for a week or two on fast storage, then sampled traces and downsampled metrics for a few months, then archived logs for as long as audit or compliance requires. The exact periods depend on how far back incidents are usually investigated and what regulations apply.

### Make Cost Visible Per Team

When one shared bill covers every service, teams rarely see what their own telemetry costs. Resource attributes like `service.name` and a team or cost-center attribute let a backend attribute volume to its source, so the team whose service logs every request body can see that it does.

## Adopting OpenTelemetry

Most organizations already have instrumentation, whether a vendor's agent, Prometheus client libraries, or an older tracing library. Replacing it all at once is risky and rarely necessary.

1. **Put the Collector in front of what exists.** The Collector has receivers for many existing formats, including Prometheus, Jaeger, and Zipkin, so current instrumentation can flow through it unchanged while the Collector takes over routing and export.
2. **Instrument new and changing services with OpenTelemetry.** Start with automatic instrumentation, then add manual spans and metrics for business operations.
3. **Keep context propagation compatible during the migration.** Services still using an older header format, such as Zipkin's B3, and services using W3C `traceparent` break traces at every boundary between them. SDKs can be configured to read and write several propagation formats at once until the old ones are gone.
4. **Run old and new side by side, then remove the old.** Compare the data from both on the same services before switching dashboards and alerts over.

## Designing Services to Be Observable

A pipeline can only carry what services emit, so observability is also a design concern.

- **Ask during design how you'll know it works.** For each new feature, name the SLI that would show it's failing, the span that would show where time goes, and the log fields that would explain a failure. If none exist, the feature ships unobservable.
- **Distinguish failure kinds in responses.** Client errors and server errors need different status codes, because an SLI can't exclude client mistakes it can't tell apart. Returning the trace ID in an error response lets a support ticket lead straight to the trace.
- **Carry context across every asynchronous boundary.** Messages, scheduled jobs, and callbacks need the trace context in their headers or payload, or the trace ends where the request went async.
- **Test the telemetry.** Integration tests can assert that a request produces the expected spans and attributes, so a refactor that silently removes instrumentation fails the build instead of the next investigation.
- **Treat gateway redaction as a safety net.** Redaction processors on the gateway catch personal data that slipped into telemetry by mistake, but they aren't a license to send everything and clean it up later.

## Key Takeaways

- **Place each decision where it can see what it needs.** The SDK for cheap head sampling and attribute dropping, agents for host context, gateways for tail sampling, policy, and credentials.
- **Route by trace ID before tail sampling.** A tail sampler can only judge a trace whose spans all reached it.
- **Protect the pipeline and the application, and watch it.** Put the memory limiter first, give gateway exporters persistent queues, let SDKs drop telemetry rather than slow requests, and alert on the Collector's own refusal and send-failure counts.
- **Combine head and tail sampling, and count before either.** Rates and error ratios come from SDK metrics, or from span metrics computed before tail sampling, not from the traces the sampler kept.
- **Fix cardinality at the source.** Route templates and views beat processors downstream, and overflow is a signal to investigate before raising any limit.
- **Cut cost where volume starts.** Filter health checks and debug output before they're sent, and tier retention by how often old data is actually used.
- **Migrate incrementally.** Put the Collector in front of existing instrumentation, keep propagation formats compatible, and switch service by service.
