---
title: "AWS X-Ray for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "How AWS X-Ray traces a request across services: segments and the trace header, instrumenting with OpenTelemetry now that the X-Ray SDKs are in maintenance, how AWS services join a trace, head-based and adaptive sampling, the trace map and trace search, Transaction Search, and the two ways tracing is billed."
tags: [xray, distributed-tracing, opentelemetry, adot, sampling, transaction-search, practical]
---

## What X-Ray Does

A metric can say that checkout's p99 latency doubled, and a log can say that one request failed, but neither says where a slow request spent its time when it crossed five services. AWS X-Ray records that. Each traced request becomes a **trace**, a record of every service it passed through, how long each spent, which downstream calls each made, and where errors happened. X-Ray assembles traces into a **trace map**, a graph of the services that actually call each other, drawn from real traffic.

X-Ray is Regional, like CloudWatch, and its console pages, Traces and Trace Map, now sit inside the CloudWatch console. By default it keeps trace data and trace maps for 30 days. Transaction Search, covered later, changes where spans are stored.

---

## How a Trace Is Built

### Segments, subsegments, and inferred segments

Each instrumented service sends X-Ray a **segment** describing its part of a request: its name, the host, the incoming request and response, start and end times, and any errors. Inside a segment, **subsegments** time the work the service did, such as a call to DynamoDB, an HTTP request to another service, or a block of its own code.

A downstream service that sends its own segments appears in the trace twice: once as the caller's subsegment, measuring the round trip, and once as its own segment, measuring the work it did. The gap between the two is time spent in transit and queues. A downstream service that sends nothing, such as DynamoDB or an external API, still appears. X-Ray builds an **inferred segment** from the caller's subsegment, so the trace map shows every dependency even if it isn't instrumented.

{% include figure.html id="aws-xray-trace-waterfall" %}

X-Ray classifies problems in three kinds. An **error** is a client error, a 4xx response. A **fault** is a server error, a 5xx response. A **throttle** is a 429 Too Many Requests response. Exceptions in instrumented code are recorded with their stack traces. The trace map colors each node by these rates, so a dependency that throttles stands out from one that fails.

### The trace header

Segments from different services join into one trace because they share a **trace ID**, which travels with the request in a header. The first service that handles the request, such as API Gateway or the first instrumented application, creates it:

```
X-Amzn-Trace-Id: Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1
```

`Root` is the trace ID, `Parent` is the ID of the segment or subsegment that made this call, and `Sampled` carries the decision whether to record this request, explained under Sampling. A service that doesn't forward the header starts a new, disconnected trace, which is the most common reason a trace map shows two unconnected halves of one system.

OpenTelemetry, covered below, propagates context with the **W3C Trace Context** header (`traceparent`) by default. To keep traces connected through AWS services that read `X-Amzn-Trace-Id`, such as API Gateway, Lambda, and SQS, configure OpenTelemetry's X-Ray propagator alongside it.

A client can send its own trace header, including a sampling decision. An application that faces the internet can strip `X-Amzn-Trace-Id` from incoming requests so outsiders can't force requests to be recorded or join them to existing traces.

### Annotations and metadata

Instrumentation can attach two kinds of key-value data to a segment or subsegment:

| | Annotations | Metadata |
| --- | --- | --- |
| **Values** | Strings, numbers, Booleans | Any type, including objects and lists |
| **Indexed** | Yes, up to 50 per trace | No |
| **Used for** | Finding traces, such as every trace for premium customers | Context read once a trace is open, such as a request summary |

Annotations are what make traces searchable by business terms, such as customer tier, order type, or feature flag, so choose them for the questions an incident will ask. A segment document can be up to 64 KB, and a whole trace between 100 KB and 500 KB, so metadata is for summaries, not whole payloads.

---

## Instrumenting Applications

### OpenTelemetry replaces the X-Ray SDKs

The X-Ray SDKs and the X-Ray daemon, a local process that received segments from the SDKs over UDP and uploaded them in batches, entered **maintenance mode on February 25, 2026**. They get security fixes only, and they reach end of support on February 25, 2027. X-Ray keeps accepting their data, but AWS recommends OpenTelemetry for new and existing applications.

OpenTelemetry is the open standard for producing traces, metrics, and logs. It records work as **spans**, each a single timed operation with a name, a start and end, attributes, and a reference to its parent span. Its concepts map onto X-Ray's:

| X-Ray | OpenTelemetry |
| --- | --- |
| Segment | Server span, the span for an incoming request |
| Subsegment | Any other span, such as an outgoing call |
| Annotations and metadata | Span attributes. Attributes become metadata unless listed as annotations |
| X-Ray daemon | OpenTelemetry Collector, or the CloudWatch agent |
| X-Ray trace header | W3C Trace Context, with the X-Ray propagator for AWS services |

An application uses the OpenTelemetry SDK for its language, or the **AWS Distro for OpenTelemetry (ADOT)**, AWS's distribution of it, which comes preconfigured with the X-Ray propagator, AWS resource detection, and support for X-Ray's sampling rules. Both instrument common libraries, such as the AWS SDK, HTTP clients, and web frameworks, and offer zero-code auto-instrumentation for Java, .NET, Python, and Node.js.

Spans leave the application over OTLP, the OpenTelemetry protocol, by one of three paths:

| Path | What it needs | Notes |
| --- | --- | --- |
| **OpenTelemetry Collector**, a separate process that batches, processes, and exports spans | The X-Ray exporter, and its proxy extension for X-Ray sampling rules | Can also make tail-sampling decisions, described under Sampling |
| **CloudWatch agent**, version 1.300025.0 or later | Trace collection turned on in its configuration | One agent also collects the host's metrics and logs |
| **CloudWatch's OTLP endpoint**, with no local collector | Transaction Search turned on in the account | Without a collector, the SDK defaults to recording every trace unless a local sampler is set |

### How AWS services join a trace

AWS services take part in tracing at different depths:

| Service | What it does |
| --- | --- |
| **API Gateway** (REST APIs) | Samples incoming requests, adds the trace header, and records a segment for the stage |
| **Lambda** | With active tracing on, records segments for the Lambda service and the function. Functions instrument their code with the OpenTelemetry Lambda layer |
| **Step Functions, AppSync** | Sample and record segments for executions and requests |
| **SNS** | With active tracing on, records the topic between publisher and subscribers |
| **Application Load Balancer** | Adds a trace ID to requests it forwards, but records no segment |
| **SQS** | Carries the trace header from an instrumented sender to consumers, so the trace continues across the queue |
| **EventBridge** | Passes the trace header to targets for events that an instrumented publisher sent with `PutEvents`, though not inside the event itself. Events from AWS services, schedules, and partners aren't traced |

A queue breaks the simple request-response shape of a trace. SQS carries the header in a message system attribute, `AWSTraceHeader`. When Lambda consumes the queue, the consumer's trace is linked to the producer's automatically. Any other consumer, such as a container polling the queue, has to read the attribute and restore the trace context itself.

---

## Sampling

### Head-based rules

Recording every request is rarely worth the cost, so X-Ray samples. Its sampling is **head-based**, meaning the decision is made once, at the first service that handles a request, and every later service honors it through the header's `Sampled` flag. The default rule records the first request each second, called the **reservoir**, plus 5% of the rest, called the **rate**. The reservoir keeps quiet services visible, and the rate keeps busy ones affordable.

**Sampling rules**, defined centrally in X-Ray, change that per kind of request. Each has a priority from 1 to 9999, and the first matching rule in priority order applies. A rule matches on the service name and type, host, HTTP method, URL path, and resource ARN, and on API Gateway, request headers. Its reservoir is shared across every instance of the service, so adding instances doesn't multiply the traces recorded. An account can have 25 custom rules per Region by default.

| Example rule | Priority | Matches | Reservoir | Rate |
| --- | --- | --- | --- | --- |
| Investigate payments | 1 | `POST /payments/*` | 5 | 100% |
| Quiet health checks | 10 | `GET /health` | 0 | 1% |
| Default | Last | Everything else | 1 | 5% |

Rules apply only to code that reads them. AWS services, the X-Ray SDKs, and ADOT for Java, .NET, Python, and Node.js read them, as does the upstream OpenTelemetry SDK for Java, .NET, and Go once its X-Ray remote sampler is configured. An OpenTelemetry application without that sampler uses OpenTelemetry's own sampler instead, which often records every trace, so migrating off the X-Ray SDKs can multiply trace volume without anyone changing a rule.

A rule set on a downstream service has no effect on requests that arrive with a decision already made. Put rules on the services where traces start.

### Sampling by outcome

A head-based rule can't pick requests by how they end, because a request's status and latency don't exist yet when it starts. Three mechanisms get closer:

- **Sampling boost**, part of X-Ray's adaptive sampling, raises a rule's rate for up to a minute when services report anomalies, by default 5xx responses. You set the maximum rate and a cooldown between boosts. It works on any custom rule but not the default rule, and needs ADOT for Java or Python with the CloudWatch agent or a collector.
- **Anomaly span capture**, the other half of adaptive sampling, makes ADOT send the spans of an anomalous request, such as one that failed or ran past a latency threshold, even when the request wasn't sampled. The result is a partial trace, tagged `aws.trace.flag.sampled = 0`, best viewed with Transaction Search.
- **Tail sampling** in the OpenTelemetry Collector holds whole traces briefly and keeps those that match conditions such as an error or high latency. It can only choose among spans that reached it, so the applications have to head-sample at or near 100%.

---

## Finding Problems in Traces

The **trace map** draws each service as a node, with edges for the calls between them, colored by error, fault, and throttle rates and annotated with latency. Selecting a node or edge shows its latency distribution and links to the traces behind it.

**Trace search** finds individual traces with **filter expressions** over durations, status, services, URLs, and annotations. Response time is in seconds:

```
service("orders") AND responsetime > 2 AND annotation[tier] = "premium"
```

A **group** saves a filter expression. X-Ray gives each group its own trace map and publishes CloudWatch metrics for the traces that match it, so a group for checkout requests can have its own latency alarm. An account can have 25 groups per Region. **X-Ray Insights**, turned on per group, creates an insight when a group's fault rate leaves its expected range, names the service most likely at the root, estimates the impact, and can send notifications through EventBridge.

### Transaction Search

**Transaction Search**, turned on for the whole account in CloudWatch, changes where spans go and how they're billed. Every span that reaches X-Ray is stored as a structured log event in a CloudWatch Logs log group named `aws/spans`, billed per GB of spans ingested instead of per trace. A percentage of spans, 1% by default and at no extra charge, is also indexed as **trace summaries**, the records that X-Ray's trace search, analytics, and Insights work from.

With the spans in CloudWatch Logs, span attributes such as an order ID can be searched across every stored span, traces of up to 10,000 spans can be viewed, and the spans feed CloudWatch features such as metric filters, masking, and Application Signals, CloudWatch's application performance view. Transaction Search is also required before spans can be sent straight to CloudWatch's OTLP endpoint.

"Every stored span" still means every span the applications sent, and head sampling decides that. To search every request, set sampling to 100% at the root, and use the cheaper per-GB ingestion to pay for it. Trace search and Insights then run on the indexed share, so raise the indexing percentage if they need more than 1%.

---

## What Tracing Costs

Tracing is billed one of two ways, depending on whether Transaction Search is on. Prices are for US East (N. Virginia):

| | Without Transaction Search | With Transaction Search |
| --- | --- | --- |
| **Storing spans** | $5.00 per million traces recorded, after 100,000 free a month | $0.35 per GB for the first 10 TB a month, $0.20 per GB for the next 20 TB, $0.15 per GB from 30 TB |
| **Searching** | $0.50 per million traces retrieved or scanned, after 1 million free | Trace summaries for 1% of spans included, $0.75 per million beyond that |
| **Insights** | $1.00 per million traces processed | Same |

Without Transaction Search, a service handling 100 million requests a month records about 7.5 million traces at the default rule, since the one-a-second reservoir adds 2.6 million to the 5% of the rest. That costs around $37, and recording every request would cost about $500. With Transaction Search, the cost follows span volume in bytes, so it depends on how many spans each request produces and how large their attributes are. Groups are billed through the traces they retrieve, and a KMS key for encryption, described below, adds KMS charges.

---

## Protecting Trace Data

X-Ray encrypts all trace data at rest. It can instead use the AWS managed key `aws/xray`, to audit its use in CloudTrail, or a customer managed key, to control access and rotation. If X-Ray loses access to the key, it stops storing data. Traces carry what instrumentation puts in them, including URLs, headers, annotations, and metadata, so keep secrets and personal data out of attributes, and remember that annotations are indexed and searchable.

Whatever sends spans, whether the application or its collector or agent, needs `xray:PutTraceSegments` and `xray:PutTelemetryRecords`, plus `xray:GetSamplingRules` and `xray:GetSamplingTargets` to use central sampling rules. The managed policy `AWSXrayWriteOnlyAccess` covers these. Reading traces is a separate set of permissions for the people investigating, and CloudWatch cross-account observability can share one account's traces with a central monitoring account.

---

## Common Pitfalls

- **A broken trace header.** A service, proxy, or message consumer that doesn't forward trace context splits one request into several traces. Check each hop, especially queues with non-Lambda consumers and services using OpenTelemetry without the X-Ray propagator.
- **Rules on downstream services.** Only the service that starts a trace makes the sampling decision.
- **OpenTelemetry without the X-Ray sampler.** An OpenTelemetry SDK left on its default sampler, or exporting straight to the OTLP endpoint, records every trace. Configure the X-Ray remote sampler or a local ratio sampler.
- **Expecting a rule to catch errors.** Head-based rules can't select by outcome. Use sampling boost, anomaly span capture, or tail sampling.
- **Assuming Transaction Search captures unsampled requests.** It stores every span it receives, not every request. Full coverage takes 100% head sampling.
- **New instrumentation on the X-Ray SDKs.** They're in maintenance and reach end of support in February 2027. Instrument new code with OpenTelemetry, and plan migration for existing code and daemons.
- **No annotations.** Traces without annotations can be found only by service, time, and status. Add the few business fields an incident will ask about.
- **Sensitive data in metadata.** A request body copied into metadata stores whatever the user sent. Record summaries and identifiers, not payloads.

---

## Key Takeaways

- A trace follows one request across services. Segments record each service's work, subsegments its calls, and inferred segments stand in for dependencies that don't report.
- The trace header carries the trace ID, the caller, and the sampling decision. A hop that drops it splits the trace.
- The X-Ray SDKs and daemon are in maintenance until February 2027. Instrument with OpenTelemetry or ADOT, and send spans through a collector, the CloudWatch agent, or the OTLP endpoint.
- Sampling is head-based, decided where a trace starts by central rules with a shared reservoir and a rate, but only for code configured to read them. Adaptive sampling and tail sampling are how to keep traces by outcome.
- Annotations make traces searchable by business terms. Groups turn a filter expression into its own map, metrics, and Insights.
- Transaction Search stores every span sent in CloudWatch Logs, billed per GB, and indexes a share as trace summaries. It stores what head sampling sends, so complete coverage still means sampling at 100%.
