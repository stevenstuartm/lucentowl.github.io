---
title: "AWS EventBridge for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "Comprehensive guide to AWS EventBridge covering event buses, rules, targets, EventBridge Pipes and Scheduler, event-driven architecture patterns, SNS comparison, and cost optimization for building scalable serverless applications"
tags: [aws, eventbridge, event-driven, serverless, integration, messaging, architecture, cost-optimization, fundamentals]
---

## What Problems EventBridge Solves

### Without EventBridge

**Tight Coupling Issues:**
- Services directly poll or call each other to detect events
- Adding new event consumers requires changing producer code
- No standardized event format across organization
- Complex routing logic embedded in application code
- Difficult to integrate with SaaS providers (Auth0, Zendesk, Datadog)

**Real-World Impact:**
- New feature requires updating 5 different microservices to subscribe to events
- SaaS integration requires custom webhook handlers and retry logic
- Event schemas differ across teams; integration breaks frequently
- Scheduled jobs scattered across cron, CloudWatch Events, and application code

### With EventBridge

**Decoupled Event-Driven Architecture:**
- **Event bus**: Central routing layer; producers publish once, consumers subscribe independently
- **Content-based filtering**: Route events to specific targets based on event content (not just attributes)
- **Schema registry**: Discover and version event schemas across organization
- **SaaS integrations**: Native integrations with 35+ SaaS providers (no custom code)
- **Managed scheduling**: Unified scheduler for cron and one-time schedules
- **Transformation**: Modify events before delivery to targets (no Lambda required)

**Problem-Solution Mapping:**

| Problem | EventBridge Solution |
|---------|---------------------|
| Adding consumers changes producer code | Event bus decouples producers from consumers; add consumers without touching producer |
| Complex routing logic in code | Content-based filtering rules route events declaratively |
| Different event formats across teams | Schema Registry discovers and versions schemas organization-wide |
| Custom SaaS webhook handlers | Native SaaS integrations (Auth0, Zendesk, Datadog, Stripe, etc.) |
| Scattered scheduled jobs | EventBridge Scheduler consolidates all scheduled tasks |
| Lambda glue code for transformations | Built-in input transformation (no Lambda required) |

---

## EventBridge Fundamentals

### What is EventBridge?

**Amazon EventBridge** is a serverless event bus service that enables event-driven architectures by routing events from sources to targets based on rules.

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>Event sources publish events to an event bus; rules evaluate events and route matching events to targets.</p>
</div>

```
Event Source → [Event Bus] → Rules (filtering + routing) → Targets
```

### Three EventBridge Services

| Service | Purpose | Use When |
|---------|---------|----------|
| **EventBridge Event Bus** | Central event routing with rules and targets | Building event-driven architectures across AWS services, SaaS apps, custom applications |
| **EventBridge Pipes** | Point-to-point integration with filtering, transformation, enrichment | Connecting single source to single target with optional processing |
| **EventBridge Scheduler** | Managed scheduling for one-time and recurring tasks | Replacing cron jobs, scheduled Lambda invocations, time-based workflows |

**Relationship:**
- **Event Bus**: One-to-many (fan-out)
- **Pipes**: One-to-one (point-to-point)
- **Scheduler**: Time-based triggering

---

## Event Buses, Rules, and Targets

### Event Bus Types

**1. Default Event Bus**
- Automatically created in every AWS account
- Receives events from AWS services (EC2 state changes, S3 uploads, etc.)
- Free (AWS service events don't count toward custom event charges)

**2. Custom Event Bus**
- Created by you for your applications
- Logical separation by domain, team, or environment
- Best practice: Use custom event buses for modular design

**3. Partner Event Bus**
- Created automatically when configuring SaaS partner integration
- Receives events from SaaS providers (Auth0, Zendesk, Datadog, MongoDB Atlas, Stripe, etc.)

**4. Cross-Account Event Bus**
- Receive events from other AWS accounts
- Sender account publishes; receiver account processes
- Billed to sender as custom events

### Event Structure

Events are JSON documents with specific structure:

```json
{
  "version": "0",
  "id": "unique-id",
  "detail-type": "Order Placed",
  "source": "com.myapp.orders",
  "account": "123456789012",
  "time": "2025-01-14T12:00:00Z",
  "region": "us-east-1",
  "resources": [],
  "detail": {
    "orderId": "12345",
    "customerId": "67890",
    "amount": 99.99,
    "items": [
      {"sku": "ABC123", "quantity": 2}
    ]
  }
}
```

**Key Fields:**
- `source`: Origin of event (e.g., `aws.ec2`, `com.myapp.orders`)
- `detail-type`: Type of event (e.g., `EC2 Instance State-change Notification`, `Order Placed`)
- `detail`: Event-specific data (free-form JSON)

### Rules

**Rule:** Defines which events to match and where to route them.

**Components:**
1. **Event pattern**: Filter that matches specific events
2. **Targets**: Where to send matching events (up to 5 targets per rule)
3. **Input transformation** (optional): Modify event before sending to target

**Event Pattern Example:**

```json
{
  "source": ["com.myapp.orders"],
  "detail-type": ["Order Placed"],
  "detail": {
    "amount": [{"numeric": [">", 100]}]
  }
}
```

**Matches:** Events from `com.myapp.orders` with `detail-type=Order Placed` where `amount>100`.

### Targets

EventBridge supports 20+ target types:

| Category | Targets |
|----------|---------|
| **Compute** | Lambda, ECS task, Fargate, Batch job, EC2 RunCommand |
| **Integration** | SNS topic, SQS queue, Kinesis stream, Firehose, Step Functions |
| **API** | API Gateway, HTTP endpoint (API Destinations), AppSync |
| **Events** | Another event bus (cross-account, cross-region) |
| **Other** | CloudWatch Logs, Systems Manager Run Command, Redshift Data API |

<div class="callout callout--tip">
<p class="callout__title">Target Configuration</p>
<ul>
<li>Each rule can have up to 5 targets</li>
<li>Same event delivered to all targets in parallel</li>
<li>Each target configured independently (different IAM roles, input transformations, retry policies)</li>
</ul>
</div>

### Input Transformation

**Problem:** Event structure doesn't match target's expected input format.

**Solution:** Transform event before delivery using input transformer.

**Example: Lambda expects simplified payload**

**Original Event:**

```json
{
  "detail-type": "Order Placed",
  "detail": {
    "orderId": "12345",
    "customerId": "67890",
    "amount": 99.99
  }
}
```

**Desired Lambda Input:**

```json
{
  "order": "12345",
  "customer": "67890",
  "total": 99.99
}
```

**Input Transformer Configuration:**

```json
{
  "InputPathsMap": {
    "orderId": "$.detail.orderId",
    "customerId": "$.detail.customerId",
    "amount": "$.detail.amount"
  },
  "InputTemplate": "{\"order\": \"<orderId>\", \"customer\": \"<customerId>\", \"total\": <amount>}"
}
```

**Benefit:** No Lambda function required for simple transformations (saves cost, reduces latency).

---

## EventBridge Pipes

### What are Pipes?

**EventBridge Pipes** connect a single source to a single target with optional filtering, transformation, and enrichment.

**Architecture:**

```
Source → [Filtering] → [Enrichment] → [Target]
```

**When to Use Pipes vs Event Bus:**

| Use Case | Use Pipes | Use Event Bus |
|----------|-----------|---------------|
| Point-to-point integration (1 source, 1 target) | ✅ | ❌ |
| Fan-out (1 source, many targets) | ❌ | ✅ |
| Need filtering, transformation, enrichment | ✅ | ✅ (via rules + Lambda) |
| SaaS partner events | ❌ | ✅ |
| Scheduled events | ❌ | ✅ (use Scheduler) |

### Pipe Components

**1. Source (Required)**

Supported sources:
- DynamoDB Stream
- Kinesis Stream
- SQS Queue (Standard or FIFO)
- Amazon MQ
- Apache Kafka (MSK, self-managed)

**2. Filtering (Optional)**

Filter events before processing (reduces costs by processing only relevant events).

**Example Filter:**

```json
{
  "data": {
    "amount": [{"numeric": [">", 100]}]
  }
}
```

**3. Enrichment (Optional)**

Call external service to augment event before delivery.

**Enrichment options:**
- Lambda function (transform, call external API)
- Step Functions (complex logic, multiple steps)
- API Destinations (call HTTP endpoint)
- API Gateway (call REST API)

**4. Target (Required)**

Supported targets:
- Event bus
- Lambda
- SQS
- SNS
- Step Functions
- Kinesis Stream
- Firehose
- CloudWatch Logs
- Redshift
- S3

### Pipes Use Case: DynamoDB Stream Processing

**Scenario:** DynamoDB table tracks orders; send high-value orders to fulfillment queue.

**Without Pipes:**

```
DynamoDB Stream → Lambda (filter + transform) → SQS Queue

Costs:
- Lambda invocations: All DynamoDB changes (including low-value orders)
- Lambda duration: Processing time per invocation
```

**With Pipes:**

```
DynamoDB Stream → [Pipe with filter: amount>100] → SQS Queue

Costs:
- Pipe charges: Only for filtered events (events >$100)
- No Lambda required
```

**Savings:** Pipe filtering happens before processing; pay only for events that match filter.

### Pipes Pricing

- $0.40 per million events processed (after filtering)
- Batching supported (reduces per-event cost)
- Cheaper than Lambda for simple transformations

---

## EventBridge Scheduler

### What is EventBridge Scheduler?

**EventBridge Scheduler** is a managed scheduling service for one-time and recurring tasks.

**Replaces:**
- Cron jobs on EC2
- CloudWatch Events scheduled rules
- Custom scheduling logic in applications

### Schedule Types

**1. One-Time Schedules**
- Execute once at specific date/time
- Use case: Send reminder email on specific date

**Example:**

```
2025-12-25T09:00:00 (Christmas morning reminder)
```

**2. Recurring Schedules**

**Rate-based:**
- `rate(30 minutes)` - Every 30 minutes
- `rate(1 hour)` - Every hour
- `rate(5 days)` - Every 5 days

**Cron-based:**
- `cron(0 9 * * ? *)` - Every day at 9:00 AM UTC
- `cron(0 12 ? * MON-FRI *)` - Weekdays at noon
- `cron(0 0 1 * ? *)` - First day of every month at midnight

**3. Flexible Time Windows**
- Execute within time window (not at exact time)
- Use case: Batch job can run anytime between 2 AM - 4 AM

### Scheduler Targets

Same as EventBridge Event Bus targets (20+ options):
- Lambda, Step Functions, ECS task, SQS, SNS, Kinesis, etc.

### Scheduler Pricing

- 14 million free invocations per month
- $1.00 per million invocations after free tier
- One-time schedules billed same as recurring schedules

**Cost Comparison:**

| Approach | Cost (1M invocations/month) |
|----------|----------------------------|
| EventBridge Scheduler | $1.00 (after free tier) |
| CloudWatch Events | $1.00 |
| Lambda + custom scheduling | $0.20 (Lambda) + development cost |

**Benefit:** Unified, managed scheduling without custom code.

---

## EventBridge vs SNS

### Feature Comparison

| Feature | EventBridge | SNS |
|---------|-------------|-----|
| **Target Types** | 20+ (Lambda, SQS, Step Functions, ECS, API Gateway, HTTP, etc.) | 6 (SQS, Lambda, HTTP/S, Email, SMS, Firehose) |
| **Filtering** | Content-based (filter on any field in JSON) | Attribute-based (filter on message attributes only) |
| **Transformation** | Built-in input transformation | None (requires Lambda) |
| **Schema Registry** | Yes (discover and version schemas) | No |
| **SaaS Integration** | Yes (35+ partners: Auth0, Zendesk, Datadog, etc.) | No |
| **Archival & Replay** | Yes (archive events, replay later) | FIFO topics only (365 days max) |
| **Cross-Account** | Yes (bus-to-bus) | Yes (topic subscriptions) |
| **Latency** | ~500ms | <30ms |
| **Throughput** | 10,000 events/sec per region (custom events) | Unlimited |
| **Pricing** | $1.00 per million custom events | $0.50 per million publishes + delivery costs |

### When to Use EventBridge

✅ **Use EventBridge when:**
- Building event-driven architectures with complex routing
- Need content-based filtering (filter on any JSON field)
- Need message transformation (no Lambda required)
- Integrating with SaaS providers (Auth0, Datadog, Zendesk, etc.)
- Need schema discovery and versioning
- Need event archival and replay
- Latency <1 second acceptable
- Target types beyond Lambda/SQS/HTTP (Step Functions, ECS, API Gateway, etc.)

**Examples:**
- Microservices architecture with complex event routing
- Multi-account event distribution
- Integrating AWS services with SaaS tools
- Event sourcing with schema management
- Scheduled workflows (using Scheduler)

### When to Use SNS

✅ **Use SNS when:**
- Need very low latency (<30ms)
- Need very high throughput (>10,000 events/sec)
- Simple fanout (no complex filtering needed)
- Need mobile push notifications, SMS, or email delivery
- Cost optimization (SNS cheaper for simple fanout)

**Examples:**
- CloudWatch alarms → Email/SMS/PagerDuty
- Mobile push notifications
- High-throughput simple fanout
- Low-latency notifications

### Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| Low latency required (<100ms) | SNS |
| High throughput (>10,000/sec) | SNS |
| Complex content-based filtering | EventBridge |
| SaaS integration (Auth0, Datadog, etc.) | EventBridge |
| Need transformation without Lambda | EventBridge |
| Mobile push, SMS, email | SNS |
| Multi-step workflows (Step Functions target) | EventBridge |
| Simple fanout, cost-sensitive | SNS |

**Can Use Both:** EventBridge → SNS (EventBridge filters/transforms, SNS delivers to mobile/email).

---

## Event-Driven Architecture Patterns

### Pattern 1: Event Router (Decoupled Microservices)

**Problem:** Microservices need to react to events from other services without tight coupling.

**Architecture:**

```
Order Service → [EventBridge: OrderPlaced event]
                     ↓
         ┌───────────┼───────────┐
         ↓           ↓           ↓
  Fulfillment   Inventory    Analytics
   (Lambda)      (Lambda)     (Kinesis)
```

**How It Works:**
1. Order Service publishes `OrderPlaced` event to EventBridge
2. Rules route event to 3 targets based on content
3. Each service processes independently

**Benefits:**
- Add new consumers without changing Order Service
- Each consumer scales independently
- Failures isolated (one consumer failure doesn't affect others)

---

### Pattern 2: Cross-Account Event Distribution

**Problem:** Central account needs to distribute events to multiple child accounts.

**Architecture:**

```
Central Account Event Bus
         ↓
Rule: Forward all events to child accounts
         ↓
    ┌────┴────┐
    ↓         ↓
Account A  Account B
Event Bus  Event Bus
```

**How It Works:**
1. Central account publishes events
2. Rule forwards to child account event buses
3. Each child account has own rules/targets

**Benefits:**
- Centralized event publishing
- Decentralized event processing
- Each account manages own subscriptions

**Billing:** Sender (central account) pays for cross-account events.

---

### Pattern 3: SaaS Integration Hub

**Problem:** Integrate multiple SaaS providers (Auth0, Stripe, Datadog) with AWS services.

**Architecture:**

```
Auth0 → [Partner Event Bus] → Rule: User Signup → Lambda (create profile)
Stripe → [Partner Event Bus] → Rule: Payment Success → Step Functions (fulfillment)
Datadog → [Partner Event Bus] → Rule: Alert → SNS → PagerDuty
```

**How It Works:**
1. Configure SaaS partner integration (EventBridge console)
2. Partner events arrive on partner event bus
3. Rules route to AWS targets

**Benefits:**
- No custom webhook handlers
- No retry logic (EventBridge handles retries)
- Unified event processing across SaaS and AWS

---

### Pattern 4: Claim Check (Large Payloads)

**Problem:** Events >256 KB exceed EventBridge limit.

**Architecture:**

```
1. Producer uploads large payload to S3
2. Producer publishes event with S3 reference (claim check)
3. Consumer receives event, downloads payload from S3
```

**Event Structure:**

```json
{
  "detail": {
    "orderId": "12345",
    "payloadBucket": "my-bucket",
    "payloadKey": "orders/12345.json"
  }
}
```

**Benefits:**
- Bypass 256 KB limit
- Reduce EventBridge costs (smaller events)
- S3 provides durable storage

---

### Pattern 5: Choreography (No Central Orchestrator)

**Problem:** Multi-step workflow where each step triggers next step independently.

**Architecture:**

```
Order Service publishes: OrderPlaced
    ↓
Inventory Service processes, publishes: InventoryReserved
    ↓
Payment Service processes, publishes: PaymentProcessed
    ↓
Fulfillment Service processes, publishes: OrderShipped
```

**How It Works:**
- Each service listens for specific events
- Each service publishes events after completing work
- No central orchestrator

**Benefits:**
- Services completely decoupled
- Easy to add new steps
- Failure isolated to single service

**Trade-Off:** Harder to track overall workflow state (consider Step Functions for complex workflows).

---

## Schema Registry

### What is Schema Registry?

**Schema Registry** discovers, stores, and versions event schemas across your organization.

**Benefits:**
- Discover what events exist in organization
- Understand event structure without reading documentation
- Generate code bindings for strongly-typed languages
- Validate events against schema

### How It Works

**1. Enable Schema Discovery (on event bus)**

EventBridge samples events and auto-generates schemas.

**2. View Discovered Schemas**

All AWS service events have pre-defined schemas (CloudFormation, EC2, S3, etc.).

**3. Generate Code Bindings**

Download code bindings for Python, Java, TypeScript, etc.

**Example: Python code binding**

```python
from aws_schema import OrderPlaced

# Type-safe event handling
def handler(event, context):
    order = OrderPlaced(**event)
    print(f"Order ID: {order.detail.orderId}")
    print(f"Amount: {order.detail.amount}")
```

**4. Version Schemas**

Schema changes tracked as versions; consumers can handle multiple versions.

### Schema Registry Pricing

**Free:** Schema storage and discovery are free.

---

## Cost Optimization Strategies

### Pricing Overview (us-east-1, 2025)

- **Custom events**: $1.00 per million events
- **AWS service events**: Free (e.g., EC2 state changes, S3 uploads)
- **Cross-account events**: $1.00 per million (billed to sender)
- **EventBridge Pipes**: $0.40 per million events processed
- **EventBridge Scheduler**: 14M free invocations/month, then $1.00 per million
- **Each 64 KB chunk = 1 event** (256 KB event = 4 events)

### 1. Minimize Event Size

**Problem:** Large events cost more (each 64 KB = 1 event).

**Example:**
- 256 KB event = 4 events = $4.00 per million
- 32 KB event = 1 event = $1.00 per million
- **Savings: 75%**

**Solution:** Use claim check pattern (S3 reference instead of full payload).

---

### 2. Use Pipes Filtering

**Problem:** Processing all events from source (e.g., DynamoDB Stream) even if only subset relevant.

**Without Pipes:**

```
DynamoDB Stream → Lambda (all events) → Process + filter
Cost: $0.20 per million Lambda invocations + duration
```

**With Pipes:**

```
DynamoDB Stream → [Pipe filter: amount>100] → Lambda (filtered events)
Cost: $0.40 per million filtered events
```

**Savings:** If only 10% of events match filter, Pipes processes 100K events vs Lambda processing 1M events.

---

### 3. Leverage Free AWS Service Events

**Free Events:**
- EC2 state changes
- S3 object uploads
- CloudFormation stack updates
- All AWS service events on default event bus

**Paid Events:**
- Custom events published by your applications
- Cross-account events
- Partner events (SaaS)

**Optimization:** Use AWS service events where possible (e.g., S3 upload events trigger processing).

---

### 4. Batch Events When Possible

**Single Event Publishing:**

```
PutEvents × 1000 = 1000 API calls = 1000 events
```

**Batch Publishing:**

```
PutEvents (batch of 10) × 100 = 100 API calls = 1000 events

Same event count, fewer API calls (better throughput, lower risk of throttling)
```

**EventBridge supports up to 10 events per PutEvents call.**

---

### 5. Use Scheduler Free Tier

**EventBridge Scheduler:**
- 14 million free invocations per month
- Most workloads stay within free tier

**Example:**
- 1 cron job per minute = 43,200 invocations/month (well under free tier)
- 100 cron jobs per minute = 4.3M invocations/month (still free)

---

### Cost Example: Event-Driven Architecture

**Scenario:** 10 million custom events per month, 3 targets per event.

**Costs:**
- Events: 10M × $1.00/M = $10.00
- Targets: Free (no per-target charges; only pay for target execution like Lambda, SQS)
- **Total: $10.00/month**

**Compare to SNS + SQS Fanout:**
- SNS publish: 10M × $0.50/M = $5.00
- SNS delivery: 30M × $0.09/M = $2.70
- SQS receive: 30M × $0.40/M = $12.00
- **Total: $19.70/month**

**EventBridge cheaper** when content-based filtering, transformation, or SaaS integration needed.

---

## Performance and Scalability

### Throughput Limits

| Event Type | Throughput Limit |
|------------|------------------|
| **Custom events** | 10,000 events/sec per region |
| **AWS service events** | No limit (managed by AWS) |
| **Cross-account events** | 10,000 events/sec per region |

**Scaling:** Request limit increase via AWS Support if >10,000 events/sec required.

### Latency

**Typical Latency:** 500ms (event published → target invoked)

**Compare to:**
- SNS: <30ms
- SQS: <10ms (polling latency separate)

**When Latency Matters:** Use SNS for <100ms latency requirements; EventBridge for <1s acceptable.

### Target Invocation

- Targets invoked in parallel (not sequential)
- Each target retries independently
- Retry policy: Exponential backoff up to 24 hours (185 retries)

---

## Security Best Practices

### 1. Resource-Based Policies

Control who can publish events to event bus.

**Example: Allow specific accounts**

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::123456789012:root"
  },
  "Action": "events:PutEvents",
  "Resource": "arn:aws:events:us-east-1:111111111111:event-bus/my-bus"
}
```

### 2. IAM Roles for Targets

EventBridge assumes IAM role to invoke targets.

**Example: Invoke Lambda**

```json
{
  "Effect": "Allow",
  "Action": "lambda:InvokeFunction",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:my-function"
}
```

**Best Practice:** Separate IAM role per target for least privilege.

### 3. Encryption at Rest

EventBridge encrypts events at rest using AWS-managed keys (automatic, no configuration required).

**For additional security:** Use AWS KMS customer-managed key (CMK) to encrypt events.

### 4. Use Private API Destinations

For HTTP endpoint targets, use VPC endpoints or PrivateLink to keep traffic private (don't expose APIs to public internet).

---

## Observability and Monitoring

### Key CloudWatch Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `Invocations` | Events matching rules | Monitor for sudden drops (indicates event source issue) |
| `FailedInvocations` | Target invocation failures | >0 (investigate target errors) |
| `ThrottledRules` | Rules throttled due to rate limits | >0 (request limit increase) |
| `DeadLetterInvocations` | Events sent to DLQ after retries exhausted | >0 (indicates systemic target failures) |

### CloudWatch Alarms

**1. Failed Invocations**

```
Metric: FailedInvocations
Threshold: >10
Duration: 5 minutes
Action: Alert on-call (investigate target failures)
```

**2. Dead Letter Queue Depth**

```
Metric: ApproximateNumberOfMessagesVisible (on DLQ)
Threshold: >0
Duration: 1 minute
Action: Alert on-call (events failing after retries)
```

### AWS X-Ray Tracing

Enable X-Ray tracing to visualize event flow across services.

**Trace Example:**

```
EventBridge → Lambda (enrichment) → Step Functions → DynamoDB
```

**Benefit:** Identify latency bottlenecks and failures.

---

## Integration Patterns

### Pattern 1: EventBridge + SQS (Buffering)

**Use Case:** Protect consumer from traffic spikes.

```
EventBridge Rule → SQS Queue → Lambda Consumer
```

**Benefit:** SQS buffers events; Lambda processes at steady rate.

---

### Pattern 2: EventBridge + Step Functions (Orchestration)

**Use Case:** Multi-step workflow with error handling.

```
EventBridge Rule → Step Functions State Machine
```

**Benefit:** Visual workflow designer, built-in retries, error handling.

---

### Pattern 3: EventBridge + API Destinations (External APIs)

**Use Case:** Call external HTTP API.

```
EventBridge Rule → API Destination (HTTPS endpoint)
```

**Benefit:** Built-in retry, authentication (OAuth, API key).

---

## Common Pitfalls

### Pitfall 1: Not Using Dead Letter Queues

**Problem:** Failed target invocations lost after 24 hours of retries.

**Solution:** Configure DLQ for rules.

**Cost Impact:** Lost events = lost business (orders not processed, alerts not sent).

---

### Pitfall 2: Large Events Without Claim Check

**Problem:** 256 KB event = 4 charges.

**Solution:** Use S3 for large payloads; event contains reference.

**Cost Impact:** 1M events at 256 KB = $4.00; with claim check (32 KB) = $1.00 (75% savings).

---

### Pitfall 3: Not Monitoring Failed Invocations

**Problem:** Target failures go unnoticed; events not processed.

**Solution:** CloudWatch alarm on `FailedInvocations`.

**Cost Impact:** Business impact (lost orders, missed alerts).

---

### Pitfall 4: Using EventBridge When SNS Sufficient

**Problem:** EventBridge costs more than SNS for simple fanout.

**Solution:** Use SNS for simple fanout; EventBridge for complex routing.

**Cost Impact:** 10M events: EventBridge=$10, SNS+SQS=$7.70 (EventBridge 30% more expensive for simple fanout).

---

### Pitfall 5: Not Using Schema Registry

**Problem:** Teams don't know what events exist; integration breaks when schemas change.

**Solution:** Enable schema discovery; use versioned schemas.

**Cost Impact:** Development time wasted investigating event structures; production incidents from schema changes.

---

## Key Takeaways

1. **EventBridge enables event-driven architectures with decoupled services.** Event bus routes events from sources to targets; add consumers without changing producers.

2. **Three EventBridge services serve different purposes.** Event Bus for one-to-many routing, Pipes for point-to-point integration, Scheduler for time-based workflows.

3. **EventBridge provides content-based filtering and transformation.** Filter on any JSON field (not just attributes); transform events without Lambda.

4. **Use EventBridge for complex routing, SNS for simple fanout.** EventBridge: 20+ target types, SaaS integration, schema management. SNS: lower latency, higher throughput, lower cost for simple fanout.

5. **Schema Registry discovers and versions event schemas.** Enable schema discovery to understand event structures; generate type-safe code bindings.

6. **EventBridge Pipes reduce costs for filtered processing.** Filter events before processing; pay only for matching events (cheaper than Lambda for simple filtering).

7. **EventBridge Scheduler consolidates scheduled tasks.** 14M free invocations/month; replaces cron jobs, CloudWatch Events, custom scheduling.

8. **Event size impacts cost (each 64 KB = 1 event).** Use claim check pattern for large payloads; store in S3, event contains reference.

9. **AWS service events are free; custom events cost $1/million.** Leverage free AWS service events (EC2, S3, CloudFormation) where possible.

10. **Configure DLQs for rules to prevent event loss.** Failed invocations retry for 24 hours; without DLQ, events lost after retries exhausted.

11. **EventBridge supports 35+ SaaS integrations.** Native integrations with Auth0, Datadog, Zendesk, Stripe, and MongoDB Atlas eliminate custom webhook handlers.

12. **Monitor FailedInvocations metric to detect target issues.** Alert on failures; investigate target errors (permissions, timeouts, logic errors).

EventBridge is AWS's strategic event-driven architecture service, providing content-based routing, SaaS integrations, and schema management that SNS cannot. Choose EventBridge for complex event-driven architectures; choose SNS for simple, high-throughput fanout.
