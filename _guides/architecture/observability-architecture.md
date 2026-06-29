---
title: "Observability Architecture & Strategy"
layout: guide
category: Architecture
subcategory: Design
description: "Advanced observability patterns including distributed tracing strategies, SLO/SLI frameworks, sampling techniques, cardinality management, OpenTelemetry adoption, and observability-driven development for production systems"
tags: [architecture, observability, monitoring, distributed-systems, reliability, slo, sli, opentelemetry, practical]
---

## What is Observability Architecture?

Observability architecture addresses how to design systems to be observable, how to collect and correlate telemetry data efficiently, and how to use observability to drive reliability and decision-making. This goes beyond implementing the three pillars (logs, metrics, traces) to strategic questions about sampling, cardinality, cost management, and using observability data to improve systems.

<blockquote class="pull-quote">
<p>Observability is not something you bolt on after building a system. It must be architected from the start.</p>
</blockquote>

**Core principle**: Observability requires intentional decisions about what to measure, how to correlate data, and how to make telemetry actionable.

For observability fundamentals (three pillars, basic concepts), see [Observability Fundamentals](../observability-fundamentals.html).

## Beyond the Three Pillars: Correlation is Key

The three pillars (logs, metrics, traces) are useful individually, but their real power emerges when correlated.

**The correlation problem**:
```
User reports: "Checkout failed 5 minutes ago"

Logs show:        Error at 14:47 UTC in payment-service
Metrics show:     95th percentile latency spike at 14:46 UTC
Traces show:      Request timeout to payment gateway at 14:47 UTC

Without correlation:  Three separate investigations
With correlation:     Single root cause analysis
```

**Correlation strategies**:
- **Trace IDs**: Propagate unique identifier across all services in a request
- **Resource attributes**: Tag all telemetry with service name, version, environment
- **Temporal correlation**: Align time windows across logs, metrics, and traces
- **Exemplars**: Link metrics spikes to specific trace samples that caused them

**Why correlation matters**: Distributed systems fail in complex ways. A metric spike tells you something is wrong. A trace shows which request failed. Logs explain why it failed. Only by correlating all three can you understand the complete picture.

## Service Level Objectives (SLOs) and Indicators (SLIs)

SLOs are the foundation of reliability engineering. They define what "good enough" means and guide observability strategy.

### SLI: Service Level Indicator

A carefully defined quantitative measure of service behavior. The metric you actually measure.

**Good SLIs have these properties**:
- **Measurable**: You can actually collect this data
- **Meaningful**: Reflects user experience or business impact
- **Simple**: Easy to understand and explain
- **Actionable**: Can be improved through engineering work

**Common SLI patterns**:

| SLI Type | What it Measures | Example |
|----------|------------------|---------|
| **Request-driven** | Request success rate | 99.9% of API requests return 2xx/3xx status |
| **Latency-based** | Response time percentiles | 95% of requests complete in < 500ms |
| **Availability** | System uptime | Service responds to health checks 99.95% of time |
| **Throughput** | Processing capacity | System handles 10,000 requests/second |
| **Durability** | Data loss prevention | Zero data loss in storage system |
| **Correctness** | Data accuracy | 99.99% of calculations produce correct results |

**SLI selection framework**:
1. Identify user-facing interactions (API calls, page loads, data queries)
2. Define success criteria (status codes, latency thresholds, error types)
3. Choose percentiles carefully (p50, p95, p99, p99.9)
4. Consider both availability and latency
5. Avoid vanity metrics (100% uptime is impossible and wasteful)

### SLO: Service Level Objective

Target value or range for an SLI. The threshold for "good enough."

**Example SLOs**:
- Availability: 99.9% of requests succeed (allows 43 minutes downtime/month)
- Latency: 95% of requests complete in < 500ms
- Durability: 99.999999999% (11 nines) of data retained annually

**SLO structure**:
```
SLO = SLI + Target + Time Window

Example: 99.9% of API requests return 2xx in the last 30 days
         ↑     ↑                    ↑          ↑
       Target  SLI             Success def  Time window
```

**Setting realistic SLOs**:
- **Measure current performance**: Establish baseline before setting targets
- **Align with user expectations**: Ask "what would users tolerate?"
- **Consider dependencies**: Your SLO cannot exceed upstream dependencies
- **Leave error budget**: Don't promise 100%, leave room for planned maintenance
- **Iterate**: Start conservative, tighten over time as system matures

### Error Budgets

The acceptable amount of unreliability. If your SLO is 99.9%, your error budget is 0.1%.

**Error budget calculation**:
```
Error budget = 100% - SLO

If SLO = 99.9% availability
Error budget = 0.1% = 43 minutes/month

Spent error budget: 12 minutes so far this month
Remaining budget: 31 minutes
```

**Error budget policy**:
- **Budget available**: Focus on new features, take calculated risks
- **Budget exhausted**: Freeze feature releases, focus on reliability improvements
- **Trend toward exhaustion**: Shift some engineering to reliability work

**Why error budgets matter**: They balance innovation velocity with reliability. Without them, teams either ship recklessly or become paralyzed by fear of breaking things.

### Implementing SLOs

**Step 1: Choose SLIs**

Pick 2-4 SLIs that matter most to users. Don't try to measure everything.

**Step 2: Instrument measurement**

Collect data for chosen SLIs. This often requires:
- Structured logging of request outcomes
- Metrics tracking latency percentiles
- Synthetic transactions measuring user journeys

**Step 3: Establish baselines**

Measure current performance over 30-90 days. Understand normal behavior and failure modes.

**Step 4: Set SLOs**

Choose targets slightly better than current baseline. Align with user expectations and business needs.

**Step 5: Alert on burn rate**

Don't alert on SLO violations directly. Alert when error budget is being consumed too fast.

**Burn rate alerts**:
```
1 hour window, fast burn:   Consuming 5% of monthly budget/hour
6 hour window, medium burn: Consuming 1% of monthly budget/hour
24 hour window, slow burn:  Consuming 0.5% of monthly budget/hour
```

**Step 6: Review and iterate**

SLOs are not set-in-stone. Review quarterly, adjust based on user feedback and business evolution.

## Distributed Tracing at Scale

Distributed tracing is powerful but expensive. Tracing every request in a high-traffic system is cost-prohibitive and generates overwhelming data.

### Sampling Strategies

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Head-based Sampling</h4>
<p>Decide whether to trace a request at the beginning (when it enters the system).</p>
<p><strong>Pros:</strong></p>
<ul>
<li>Simple to implement</li>
<li>Consistent trace coverage</li>
<li>Predictable resource usage</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>May miss rare but important failures</li>
<li>Cannot sample based on outcome (don't know if request will fail)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Tail-based Sampling</h4>
<p>Decide whether to keep a trace after the request completes, based on its characteristics.</p>
<p><strong>Pros:</strong></p>
<ul>
<li>Keep all errors and slow requests</li>
<li>Discard successful, fast requests</li>
<li>Capture rare failures</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>Complex to implement (requires buffering traces)</li>
<li>Higher resource overhead</li>
<li>Inconsistent trace coverage</li>
</ul>
</div>
</div>

**Adaptive sampling**: Adjust sampling rate based on current traffic volume and error rates.

**Example adaptive strategy**:
```
Normal traffic:  Sample 1% of requests
Traffic spike:   Sample 0.1% of requests
Error spike:     Sample 100% of errors, 1% of successes
Low traffic:     Sample 10% of requests
```

**Sampling best practices**:
- Always trace errors and slow requests (above latency SLO)
- Sample successes at lower rate
- Increase sampling temporarily when debugging issues
- Sample different endpoints at different rates (critical paths higher)
- Include sampling decision in trace context (propagate to downstream services)

### Trace Propagation

Traces only work if trace context propagates across service boundaries.

**W3C Trace Context standard**:
- `traceparent`: Trace ID, parent span ID, sampling decision
- `tracestate`: Vendor-specific context (optional)

**Propagation challenges**:
- **Asynchronous processing**: Queue messages, background jobs
- **Multiple protocols**: HTTP, gRPC, messaging systems
- **Third-party services**: External APIs may not support trace context
- **Legacy systems**: Cannot instrument old code

**Solutions**:
- Use automatic instrumentation libraries (OpenTelemetry)
- Propagate trace context in message headers/metadata
- Generate new trace IDs for third-party boundaries, link them to parent trace
- Synthetic spans to represent uninstrumented systems

### Span Design

Spans represent operations within a trace. Good span design is critical for trace usability.

**Span naming conventions**:
- Use verb + resource pattern: `GET /orders`, `ProcessPayment`, `InsertDatabase`
- Include operation type in name, not as attribute
- Keep names stable across versions
- Avoid high cardinality (user IDs, timestamps in names)

**Span attributes**:
- Tag spans with resource-level attributes (service name, version, environment)
- Include operation-level attributes (HTTP method, status code, database table)
- Add business context (customer type, transaction amount ranges)
- Avoid sensitive data (passwords, tokens, PII)

**Span relationships**:
- **ChildOf**: Parent waits for child to complete (synchronous)
- **FollowsFrom**: Parent does not wait for child (asynchronous)

**Common span antipatterns**:
- Spans too granular (every function call becomes a span)
- Spans too coarse (entire service is one span)
- Missing critical spans (database queries, external API calls)
- High cardinality attributes (user IDs, unique identifiers)

## Cardinality Management

<blockquote class="pull-quote">
<p>High cardinality causes exponential cost and performance problems.</p>
</blockquote>

Cardinality is the number of unique values for a metric dimension or label.

### The Cardinality Explosion

**Example**:
```
Metric: http_requests_total

Labels:
- service: 10 services
- endpoint: 50 endpoints/service
- status_code: 6 codes
- user_id: 1,000,000 users  ← High cardinality!

Total time series: 10 × 50 × 6 × 1,000,000 = 3 billion time series
```

**Why cardinality matters**:
- **Storage costs**: Each unique label combination creates a new time series
- **Query performance**: Aggregating billions of time series is slow
- **Memory overhead**: Metrics systems cache metadata for all time series

### Managing Cardinality

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Low Cardinality Labels (Safe to Use)</h4>
<ul>
<li>Service name (tens of services)</li>
<li>Environment (dev, staging, production)</li>
<li>Region (handful of AWS regions)</li>
<li>HTTP method (GET, POST, PUT, DELETE, PATCH)</li>
<li>Status code ranges (2xx, 3xx, 4xx, 5xx)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>High Cardinality Labels (Avoid)</h4>
<ul>
<li>User IDs</li>
<li>Session IDs</li>
<li>Request IDs</li>
<li>IP addresses</li>
<li>Unique identifiers</li>
<li>Timestamps</li>
</ul>
</div>
</div>

**Strategies to reduce cardinality**:

**Bucketing**: Group high cardinality values into ranges.
```
Bad:  response_time{milliseconds="347"}
Good: response_time_bucket{le="500"}
```

**Sampling**: Only record a percentage of events.
```
Record 1% of user interactions, not all 1 million users
```

**Aggregation**: Pre-aggregate before storing metrics.
```
Bad:  user_purchases{user_id="12345"}
Good: purchases_total{user_type="premium"}
```

**Exemplars**: Link metrics to trace samples instead of exploding cardinality.
```
http_requests_total{service="api", code="500"} = 127
exemplar: trace_id="abc123" (sample of a 500 error)
```

**Separate hot and cold paths**:
- Hot path: Low cardinality, real-time metrics for dashboards
- Cold path: High cardinality, raw logs for investigation

## OpenTelemetry: The Standard

OpenTelemetry (OTel) is the CNCF standard for observability instrumentation. It provides vendor-neutral APIs and SDKs for generating logs, metrics, and traces.

### Why OpenTelemetry Matters

**Before OpenTelemetry**:
```
Use Datadog?  → Instrument with Datadog SDK
Switch to New Relic?  → Re-instrument everything
Add second vendor?  → Duplicate instrumentation
```

**With OpenTelemetry**:
```
Instrument once with OTel SDK
Export to any backend (Datadog, New Relic, Prometheus, Jaeger)
Switch backends without changing code
```

### OpenTelemetry Architecture

**Components**:
- **API**: Stable interface for instrumentation (logs, metrics, traces)
- **SDK**: Implementation of API with configuration
- **Instrumentation Libraries**: Auto-instrument common frameworks (HTTP, gRPC, databases)
- **Collector**: Receive, process, and export telemetry data
- **Exporters**: Send data to backends (Prometheus, Jaeger, CloudWatch, etc.)

**Deployment patterns**:

**Direct export**: Application sends telemetry directly to backend.
```
App → SDK → Exporter → Backend (Prometheus, Jaeger)
```

**Collector sidecar**: Collector runs alongside application.
```
App → SDK → Collector (sidecar) → Backend
```

**Collector gateway**: Centralized collector for multiple applications.
```
App → SDK → Collector (gateway) → Backend
```

**Collector benefits**:
- **Buffering**: Handle backend outages gracefully
- **Sampling**: Centralized tail-based sampling
- **Processing**: Enrich, filter, transform telemetry
- **Multi-backend**: Send same data to multiple backends
- **Security**: Centralize credentials and backend connections

### OpenTelemetry Adoption Strategy

**Phase 1: Auto-instrumentation**

Start with zero-code instrumentation for common frameworks (HTTP servers, database clients, message queues).

**Phase 2: Custom spans for business logic**

Add manual spans for business-critical operations (payment processing, order fulfillment).

**Phase 3: Custom metrics**

Emit business metrics (orders/minute, revenue, cart abandonment rate).

**Phase 4: Structured logging integration**

Correlate logs with traces using trace IDs in log entries.

**Phase 5: Collector deployment**

Deploy OpenTelemetry Collector for centralized processing and multi-backend support.

**Migration from existing instrumentation**:
- Run OTel and legacy instrumentation in parallel
- Compare data quality and coverage
- Gradually switch traffic to OTel exporters
- Remove legacy instrumentation after validation

## Observability-Driven Development

Observability is not just for production debugging. It guides development, testing, and architecture decisions.

### Design for Observability

**Questions to ask during design**:
- How will we know if this feature is working in production?
- What metrics indicate success or failure?
- What trace spans will show bottlenecks?
- What logs help debug failures?
- What are the SLIs and SLOs for this feature?

**Observable API design**:
- Return error codes that distinguish client errors from server errors
- Include request IDs in all responses
- Emit metrics for request rate, latency, error rate
- Log structured data (not just error messages)

**Observable database design**:
- Track query performance metrics per query type
- Log slow queries with execution plans
- Trace database calls with query text (parameterized)
- Monitor connection pool utilization

**Observable integration design**:
- Propagate trace context to external services
- Set appropriate timeouts and retry policies
- Distinguish between retriable and non-retriable errors
- Emit metrics for third-party API health

### Testing with Observability

**Use observability to validate tests**:
- Verify metrics emitted during integration tests
- Assert traces contain expected spans
- Check log output for expected structured fields

**Chaos testing with observability**:
- Inject failures (network latency, service errors)
- Verify SLOs are maintained
- Ensure observability data accurately reflects failures

**Load testing with observability**:
- Monitor metrics during load tests
- Identify bottlenecks through distributed tracing
- Validate SLOs under expected production load

### Production Debugging Workflow

**Standard debugging process with observability**:

1. **Alert fires**: Error budget burn rate exceeds threshold
2. **Check metrics**: Identify which SLI is degraded (latency, error rate, availability)
3. **Correlate logs**: Filter logs by time window and affected service
4. **Find traces**: Look for failed or slow traces in the same window
5. **Analyze trace**: Identify slow span or failing service
6. **Read logs**: Examine logs from failing service with trace ID filter
7. **Reproduce**: Use trace details to reproduce issue locally
8. **Fix and deploy**: Implement fix, monitor metrics to confirm resolution

**Observability accelerates debugging**: Without observability, steps 2-6 require manual correlation, SSH into servers, and guesswork. With observability, the path from alert to root cause is direct.

## Cost Management

Observability can become expensive at scale. Manage costs intentionally.

### Cost Drivers

**Storage**:
- Logs: Highest volume, expensive to index and store
- Traces: High volume if not sampled aggressively
- Metrics: Lower volume but high cardinality increases cost

**Ingestion**:
- Some vendors charge per GB ingested
- High traffic systems generate terabytes/month

**Queries**:
- Scanning large log volumes is expensive
- Complex queries across billions of time series

### Cost Optimization Strategies

**Tiered retention**:
- Hot tier (7 days): Full detail, fast queries, expensive storage
- Warm tier (30 days): Sampled data, slower queries, cheaper storage
- Cold tier (1 year): Aggregated data, archive storage, rare access

**Sampling**:
- Aggressively sample successful requests
- Keep all errors and slow requests
- Use tail-based sampling to retain interesting traces

**Log filtering at source**:
- Don't send debug logs to centralized logging
- Filter noisy logs (health checks, static assets)
- Use local logging for non-critical information

**Metric aggregation**:
- Pre-aggregate before sending to backend
- Use histograms instead of individual samples
- Drop low-value metrics

**Query optimization**:
- Use indexed fields for filtering
- Limit time ranges
- Pre-aggregate data for dashboards
- Cache frequently-run queries

**Right-size infrastructure**:
- Adjust retention policies based on actual usage
- Archive old data to cheaper storage
- Use compression and columnar formats

## Observability Maturity Model

**Level 1: Reactive Monitoring**
- Basic metrics and logs
- Manual correlation
- Alerting on simple thresholds
- Debugging is slow and manual

**Level 2: Proactive Observability**
- Distributed tracing implemented
- Centralized logging and metrics
- Automated correlation between signals
- SLOs defined but not enforced

**Level 3: Reliability Engineering**
- SLOs drive development priorities
- Error budgets guide release decisions
- Automated anomaly detection
- Observability integrated into CI/CD

**Level 4: Continuous Optimization**
- Observability-driven architecture decisions
- Predictive analytics and capacity planning
- Automated remediation based on telemetry
- Business metrics tied to technical metrics

**Goal**: Progress from Level 1 to Level 3. Level 4 is aspirational for most organizations.

## Common Observability Antipatterns

### Log Everything Syndrome

**Problem**: Excessive logging drowns signal in noise and drives up costs.

**Solution**: Use log levels appropriately. DEBUG stays in development. INFO for significant events only. ERROR for actual failures.

### Alert Fatigue

**Problem**: Too many alerts, most are false positives, team ignores them all.

**Solution**: Alert on symptoms (SLO violations), not causes (disk space, CPU). Reduce alert noise until every alert is actionable.

### Metric Explosion

**Problem**: Creating metrics for everything, including high cardinality dimensions.

**Solution**: Focus on metrics that tie to SLOs. Use exemplars and traces for high cardinality debugging.

### Siloed Telemetry

**Problem**: Logs in one system, metrics in another, traces in a third. No correlation.

**Solution**: Use OpenTelemetry for unified instrumentation. Ensure trace IDs appear in logs and metrics.

### Missing Context

**Problem**: Logs and traces lack essential context (user type, request origin, feature flags).

**Solution**: Include structured context in all telemetry. Tag resources consistently (service name, version, environment).

### Optimizing for Known Failures

**Problem**: Only monitoring known failure modes. Surprised by unexpected issues.

**Solution**: Observability is about discovering unknown unknowns. Use tracing and logging to investigate novel failures.

## Key Takeaways

**SLOs drive observability strategy**: Define what "good enough" means, measure it, and alert when error budget burns too fast.

**Correlation is more valuable than individual signals**: Logs, metrics, and traces are useful alone but powerful when correlated through trace IDs and resource attributes.

**Sampling is essential at scale**: You cannot trace every request. Sample intelligently by keeping errors and slow requests while discarding routine successes.

**Manage cardinality intentionally**: High cardinality dimensions (user IDs, unique identifiers) explode storage costs and query performance. Use bucketing, aggregation, and exemplars.

**OpenTelemetry provides vendor neutrality**: Instrument once with OTel, export to any backend. Switch vendors without re-instrumenting code.

**Design systems to be observable**: Observability is not bolted on afterward. Ask during design: "How will we know if this works in production?"

**Observability enables reliability**: Error budgets balance innovation and stability. SLOs make reliability measurable and actionable.

**Cost management is critical**: Observability can become expensive. Use tiered retention, aggressive sampling, and query optimization to control costs.

**Progress through maturity levels**: Start with basic monitoring (Level 1), add distributed tracing and SLOs (Level 2), integrate observability into development and release processes (Level 3).

**Avoid common antipatterns**: Don't log everything, don't create too many alerts, don't ignore cardinality, don't silo telemetry.
