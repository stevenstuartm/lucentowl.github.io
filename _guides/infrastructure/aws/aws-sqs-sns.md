---
title: "AWS SQS & SNS for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "Comprehensive guide to AWS SQS and SNS covering queue types, pub/sub patterns, fanout architecture, dead letter queues, cost optimization, and messaging best practices for decoupled systems"
tags: [aws, sqs, sns, messaging, event-driven, distributed-systems, reliability, cost-optimization, fundamentals]
---

## What Problems SQS & SNS Solve

### Without Decoupled Messaging

**Synchronous Communication Problems:**
- **Tight coupling:** Services directly call each other; if one service is down, the entire system fails
- **Cascading failures:** Overloaded service causes timeout failures across all dependent services
- **No retry logic:** Failed requests are lost unless application implements retry mechanisms
- **Scaling challenges:** All services must scale together; can't scale individual components independently
- **Lost messages:** If consumer service is unavailable, messages are lost forever

**Real-World Impact:**
- A payment service failure takes down the entire e-commerce checkout flow
- Traffic spike overwhelms order processing service, causing lost orders
- Database maintenance window requires shutting down all dependent services

### With SQS & SNS

**Asynchronous Decoupling Benefits:**
- **Loose coupling:** Services communicate through queues/topics; failures are isolated
- **Resilience:** Messages are durably stored until successfully processed
- **Independent scaling:** Producer and consumer scale independently based on their own load
- **Built-in retry:** Automatic retry with exponential backoff
- **Buffer traffic spikes:** Queue absorbs bursts; consumers process at their own pace
- **Fan-out patterns:** Single message reaches multiple consumers simultaneously

**Problem-Solution Mapping:**

| Problem | SQS Solution | SNS Solution |
|---------|-------------|-------------|
| Service unavailable | Messages persist in queue until service recovers | Messages retry delivery; SNS DLQ captures failures |
| Traffic spike | Queue buffers messages while consumers process at steady rate | Publishes to multiple subscribers where each handles at own pace |
| Lost messages | Durable storage with 4-14 day retention | Retry up to 100,015 times over 23 days for SQS/Lambda endpoints |
| Tight coupling | Point-to-point decoupling | Pub/sub decoupling (one-to-many) |
| Scaling bottleneck | Scale consumers independently of producers | Scale subscribers independently of publishers |

---

## Amazon SQS Fundamentals

### What is Amazon SQS?

**Amazon Simple Queue Service (SQS)** is a fully managed message queuing service that enables you to decouple and scale microservices, distributed systems, and serverless applications.

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>Producers send messages to a queue; consumers poll the queue, process messages, and delete them when done.</p>
</div>

```
Producer → [SQS Queue] → Consumer
           (durable storage)
```

### How SQS Works

1. **Producer sends message:** Application calls `SendMessage` API; message stored in queue
2. **Message visibility:** Message becomes visible to consumers after optional delay
3. **Consumer polls:** Application calls `ReceiveMessage`; message returned and hidden (visibility timeout starts)
4. **Processing:** Consumer processes message
5. **Deletion:** Consumer calls `DeleteMessage` to remove message from queue
6. **Retry:** If message not deleted before visibility timeout expires, message becomes visible again for retry

### Key SQS Characteristics

| Characteristic | Details |
|---------------|---------|
| **Durability** | Messages stored redundantly across multiple Availability Zones |
| **Retention** | 1 minute to 14 days (default: 4 days) |
| **Message Size** | Up to 256 KB (use S3 for larger payloads with Extended Client Library) |
| **Visibility Timeout** | 0 seconds to 12 hours (default: 30 seconds) |
| **Delivery** | At-least-once delivery (Standard), Exactly-once delivery (FIFO) |
| **Ordering** | Best-effort ordering (Standard), Strict ordering (FIFO) |
| **Throughput** | Unlimited (Standard), 300 TPS without batching / 3,000 TPS with batching (FIFO) |

### Message Lifecycle

**1. Message Sent:**
- Producer sends message with optional attributes and delay
- Message stored durably across multiple AZs
- Message ID returned to producer

**2. Message Available:**
- After optional delay, message becomes visible to consumers
- Multiple consumers can poll, but only one receives each message

**3. Message Retrieved:**
- Consumer receives message via `ReceiveMessage`
- **Visibility timeout** starts (message hidden from other consumers)
- Consumer has limited time to process and delete message

**4. Processing Window:**
- If consumer deletes message before visibility timeout → Success
- If visibility timeout expires before deletion → Message becomes visible again (automatic retry)
- Consumer can extend visibility timeout if processing takes longer than expected

**5. Retry or Success:**
- **Success:** Message deleted, removed from queue
- **Retry:** Message reappears after visibility timeout; another consumer (or same consumer) can retry
- After max receive count exceeded → Message moves to Dead Letter Queue (if configured)

---

## Amazon SNS Fundamentals

### What is Amazon SNS?

**Amazon Simple Notification Service (SNS)** is a fully managed pub/sub messaging service for broadcasting messages to multiple subscribers simultaneously.

**Core Concept:** Publishers send messages to topics; all subscribers receive every message (unless filtered).

```
                    → Subscriber 1 (SQS)
Publisher → [SNS Topic] → Subscriber 2 (Lambda)
                    → Subscriber 3 (HTTP endpoint)
```

### How SNS Works

1. **Create topic:** Define SNS topic (Standard or FIFO)
2. **Subscribe:** Services/endpoints subscribe to topic (SQS, Lambda, HTTP/S, Email, SMS)
3. **Publish:** Publisher sends message to topic
4. **Fan-out:** SNS immediately delivers message to all subscribers
5. **Filtering:** Optional message filtering sends relevant messages to each subscriber
6. **Retry:** SNS retries failed deliveries based on subscription retry policy

### Key SNS Characteristics

| Characteristic | Details |
|---------------|---------|
| **Delivery Model** | Pub/sub (one-to-many) |
| **Subscribers** | SQS, Lambda, HTTP/S, Email, SMS, Mobile Push, Kinesis Data Firehose |
| **Message Size** | Up to 256 KB |
| **Topic Types** | Standard (high throughput, best-effort ordering), FIFO (ordered, exactly-once) |
| **Throughput** | Unlimited (Standard), 300 TPS without batching / 3,000 TPS with batching (FIFO) |
| **Retry Policy** | Up to 100,015 retries over 23 days for SQS/Lambda endpoints |
| **Message Filtering** | Attribute-based (free), Payload-based (charged per GB scanned) |

### Topic Types

**Standard Topics:**
- Unlimited throughput
- Best-effort ordering (messages may arrive out of order)
- At-least-once delivery (duplicates possible)
- **Use when:** High throughput, ordering not critical

**FIFO Topics:**
- Up to 3,000 messages per second with batching
- Strict message ordering
- Exactly-once message delivery
- **Use when:** Order matters, no duplicates allowed

<div class="callout callout--warning">
<p class="callout__title">FIFO Compatibility</p>
<p>FIFO SNS topics must use FIFO SQS queues; you cannot subscribe Standard SQS to FIFO SNS.</p>
</div>

---

## Standard vs FIFO Queues

### Comparison Matrix

| Feature | Standard Queue | FIFO Queue |
|---------|---------------|------------|
| **Throughput** | Unlimited transactions per second | 300 TPS (without batching), 3,000 TPS (with batching) |
| **Ordering** | Best-effort ordering | Strict FIFO ordering |
| **Delivery** | At-least-once (duplicates possible) | Exactly-once (no duplicates) |
| **Use Case** | High throughput, order not critical | Order matters, no duplicates |
| **Pricing** | $0.40 per million requests (us-east-1) | ~25% higher than Standard ($0.50 per million requests) |
| **Message Grouping** | N/A | Group ID for parallel processing within order |
| **Deduplication** | None | Content-based or deduplication ID (5-minute window) |
| **Latency** | Lower latency | Slightly higher latency due to ordering guarantees |

### When to Use Standard Queues

✅ **Use Standard Queues when:**
- High throughput (>3,000 TPS) required
- Message order doesn't matter
- Application handles duplicates (idempotent processing)
- Cost optimization is priority
- Lower latency required

**Examples:**
- Image processing pipeline (order doesn't matter)
- Log aggregation (duplicates can be filtered)
- Sending notifications (duplicate email acceptable)
- Video transcoding (each job independent)

### When to Use FIFO Queues

✅ **Use FIFO Queues when:**
- Message order is critical to business logic
- Exactly-once processing required (no duplicates)
- Lower throughput (<3,000 TPS with batching) acceptable
- Worth paying 25% premium for ordering guarantees

**Examples:**
- Financial transactions (order matters: deposit before withdrawal)
- Order fulfillment (must process steps sequentially)
- Price updates (latest price must override previous prices in order)
- Workflow orchestration (steps must execute in order)

### FIFO Message Grouping

**Message Group ID:** Enables parallel processing while maintaining order within each group.

**How It Works:**
- Messages with same Group ID are processed in order
- Messages with different Group IDs can be processed in parallel
- Provides higher throughput than single-threaded FIFO

**Example:**

```
Order Processing FIFO Queue:
├── Group ID: Customer123
│   ├── Message 1: Create Order
│   ├── Message 2: Process Payment
│   └── Message 3: Ship Order (waits for 1 & 2)
└── Group ID: Customer456
    ├── Message 1: Create Order (processed in parallel with Customer123)
    ├── Message 2: Process Payment
    └── Message 3: Ship Order
```

**Result:** Orders for Customer123 processed in strict order; Customer456 processed in parallel.

**Best Practice:** Use customer ID, order ID, or entity ID as Group ID to maximize parallelism while maintaining per-entity ordering.

### Content-Based Deduplication

**FIFO Deduplication Window:** 5 minutes

**Two Methods:**

1. **Content-based deduplication (automatic):**
   - SQS generates deduplication ID from SHA-256 hash of message body
   - If message body identical within 5 minutes, second message rejected
   - Enable with `ContentBasedDeduplication=true` on queue

2. **Explicit deduplication ID:**
   - Application provides `MessageDeduplicationId` with each message
   - More control (can deduplicate messages with different bodies but same intent)
   - Example: Use order ID as deduplication ID

**Trade-Off:** Content-based is automatic but limited to body; explicit requires application logic but more flexible.

---

## SNS + SQS Fanout Pattern

### What is the Fanout Pattern?

**Fanout Pattern:** A single message published to SNS is delivered to multiple SQS queues simultaneously, enabling parallel processing by independent consumers.

**Architecture:**

```
                        → [SQS Queue 1] → Consumer 1 (Order Processing)
Publisher → [SNS Topic] → [SQS Queue 2] → Consumer 2 (Inventory Update)
                        → [SQS Queue 3] → Consumer 3 (Email Notification)
```

**Why Not Just Multiple SQS Queues?**
- Without SNS: Producer must send message to each queue individually (tight coupling, multiple API calls)
- With SNS: Producer sends once to SNS; SNS handles fan-out (loose coupling, single API call)

### Benefits of SNS + SQS Fanout

1. **Durability:** Messages persisted in SQS even if consumer is down
2. **Buffering:** SQS absorbs traffic spikes; consumers process at their own pace
3. **Retry:** Each consumer retries independently (one consumer failure doesn't affect others)
4. **Scalability:** Scale each consumer independently based on queue depth
5. **Decoupling:** Add/remove consumers without changing publisher
6. **Filtering:** Use SNS message filtering to send relevant messages to each queue

### Fanout Pattern Example: E-Commerce Order

**Scenario:** When order placed, trigger 3 independent workflows.

**Without Fanout (Tightly Coupled):**

```
Order Service → Call Fulfillment API
             → Call Inventory API
             → Call Notification API

Problems:
- Order Service waits for all APIs to respond
- If any API fails, entire order processing fails
- Order Service must implement retry for each API
- Can't scale services independently
```

**With Fanout (Decoupled):**

```
Order Service → Publish to SNS Topic "OrderPlaced"
                         ↓
SNS Topic → [Fulfillment Queue] → Fulfillment Service
         → [Inventory Queue] → Inventory Service
         → [Notification Queue] → Notification Service

Benefits:
- Order Service doesn't wait; publishes once and continues
- Each service processes independently; failures isolated
- Each service retries via SQS; no custom retry logic
- Scale each consumer based on queue depth
```

### Implementing Fanout

**Step 1: Create SNS Topic**

```
Topic Name: order-placed
Type: Standard
```

**Step 2: Create SQS Queues**

```
Queue 1: fulfillment-queue (Standard)
Queue 2: inventory-queue (Standard)
Queue 3: notification-queue (Standard)
```

**Step 3: Subscribe Queues to Topic**

```
Subscription 1: SNS Topic → fulfillment-queue
Subscription 2: SNS Topic → inventory-queue
Subscription 3: SNS Topic → notification-queue
```

**Step 4: Configure Queue Policy**

Allow SNS to send messages to SQS (update SQS access policy):

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "sns.amazonaws.com"
  },
  "Action": "sqs:SendMessage",
  "Resource": "arn:aws:sqs:region:account-id:fulfillment-queue",
  "Condition": {
    "ArnEquals": {
      "aws:SourceArn": "arn:aws:sns:region:account-id:order-placed"
    }
  }
}
```

**Step 5: Publish Message**

Order Service publishes once:

```json
{
  "TopicArn": "arn:aws:sns:region:account-id:order-placed",
  "Message": "{\"orderId\": \"12345\", \"customerId\": \"67890\", \"amount\": 99.99}",
  "MessageAttributes": {
    "orderType": {
      "DataType": "String",
      "StringValue": "StandardShipping"
    }
  }
}
```

SNS delivers to all 3 queues; each consumer processes independently.

### Fanout with Message Filtering

**Problem:** All subscribers receive all messages, even if not relevant.

**Solution:** Use SNS message filtering to route messages selectively.

**Example:** Route high-priority orders to expedited fulfillment queue.

**Filter Policy (on Subscription):**

```json
{
  "orderType": ["ExpeditedShipping"]
}
```

**Result:** Only messages with `orderType=ExpeditedShipping` delivered to expedited-fulfillment-queue.

**Benefits:**
- Reduces unnecessary message processing
- Lowers SQS costs (fewer messages received)
- Enables routing logic without changing publisher

---

## Dead Letter Queues and Error Handling

### What is a Dead Letter Queue?

**Dead Letter Queue (DLQ):** A queue that receives messages that cannot be processed successfully after a specified number of retries.

**Purpose:**
- Isolate problematic messages for analysis
- Prevent poison messages from blocking queue
- Enable investigation and manual reprocessing

### DLQ Configuration Levels

**1. SQS Queue DLQ (Most Common)**

- Attach DLQ to source queue via redrive policy
- After message received `maxReceiveCount` times, move to DLQ
- **Use when:** Consumer fails to process message (application error, corrupt data, etc.)

**Configuration:**

```
Source Queue: orders-queue
DLQ: orders-dlq
maxReceiveCount: 3
```

**Behavior:**
1. Consumer receives message from `orders-queue`
2. Processing fails; message not deleted
3. After visibility timeout, message reappears (receive count = 1)
4. Repeat 2 more times (receive count = 2, 3)
5. After 3rd failure, message moves to `orders-dlq`

**2. SNS Subscription DLQ**

- Attach DLQ to SNS subscription
- If SNS cannot deliver message to subscriber (endpoint unavailable, permissions issue, etc.), move to DLQ
- **Use when:** Message delivery fails (not processing failure)

**Configuration:**

```
SNS Topic: order-placed
Subscription: SNS → fulfillment-queue
Subscription DLQ: sns-fulfillment-dlq
```

**Behavior:**
1. SNS attempts to deliver message to `fulfillment-queue`
2. Delivery fails (queue doesn't exist, permissions denied, etc.)
3. SNS retries based on subscription retry policy
4. After retries exhausted, message moves to `sns-fulfillment-dlq`

**3. Lambda Function DLQ**

- Attach DLQ to Lambda function
- If Lambda invocation fails (exception thrown, timeout, etc.), send message to DLQ
- **Use when:** Lambda function fails to execute successfully

**Configuration:**

```
Lambda Function: process-order
Lambda DLQ: lambda-failures-dlq
```

**Behavior:**
1. Lambda invoked with message
2. Function throws exception or times out
3. After retries exhausted (2 retries for async invocations), message sent to `lambda-failures-dlq`

### DLQ Best Practices

**1. Use DLQs at Multiple Levels**

Protect against different failure modes:
- **SQS DLQ:** Application logic failures (can't process message content)
- **SNS DLQ:** Delivery failures (subscriber unreachable)
- **Lambda DLQ:** Function execution failures (exception, timeout)

**2. Set Appropriate maxReceiveCount**

- Too low (1-2): Transient errors move messages to DLQ prematurely
- Too high (10+): Poison messages block queue for extended time
- **Recommended:** 3-5 retries for most use cases

**3. Monitor DLQ Depth**

Set CloudWatch alarms for DLQ message count:
- Alert when DLQ receives messages (indicates systemic issue)
- Investigate root cause (corrupt data, application bug, external dependency failure)

**4. Process DLQ Messages**

Options for handling DLQ messages:
- **Manual inspection:** Review message content, identify issue, fix application, redrive
- **Automated reprocessing:** Lambda function periodically redrives DLQ messages after fixing issue
- **Expiration:** Set retention period; messages expire if not processed

**5. Use Separate DLQs per Queue**

Don't share DLQ across multiple source queues (makes troubleshooting difficult). Use one DLQ per source queue for clear traceability.

**6. Set DLQ Retention Period Higher than Source Queue**

- Source queue: 4 days retention
- DLQ: 14 days retention
- Ensures messages aren't lost while investigating

### Retry Strategies

**Exponential Backoff with Jitter:**

Avoid thundering herd when retrying failed messages.

**Simple Retry (Bad):**

```
Retry 1: Immediate
Retry 2: Immediate
Retry 3: Immediate

Problem: All retries hit dependency simultaneously; still overloaded
```

**Exponential Backoff (Better):**

```
Retry 1: 1 second delay
Retry 2: 2 seconds delay
Retry 3: 4 seconds delay

Better: Delays increase; gives dependency time to recover
```

**Exponential Backoff with Jitter (Best):**

```
Retry 1: 0.5-1.5 seconds delay (random)
Retry 2: 1-3 seconds delay (random)
Retry 3: 2-6 seconds delay (random)

Best: Randomization spreads retries; avoids synchronized retries
```

**Implementation:**

Use SQS visibility timeout to implement exponential backoff. After failed processing, extend visibility timeout exponentially before allowing retry.

---

## Message Filtering

### Why Message Filtering?

**Problem:** All SNS subscribers receive all messages, even if not relevant.

**Example:** Order processing topic sends messages for all order types (standard, expedited, international). Each fulfillment queue only cares about specific order types.

**Without Filtering:**
- All queues receive all messages
- Consumers waste resources filtering messages
- Higher SQS costs (pay for unnecessary messages)

**With Filtering:**
- SNS filters messages before delivery
- Each queue receives only relevant messages
- Lower costs, less waste

### Attribute-Based Filtering (Free)

**How It Works:**

1. Publisher includes message attributes with each message
2. Each subscription defines filter policy (JSON)
3. SNS evaluates message attributes against filter policy
4. Message delivered only if attributes match filter

**Example: Order Type Filtering**

**Publisher sends:**

```json
{
  "Message": "{\"orderId\": \"12345\", \"amount\": 99.99}",
  "MessageAttributes": {
    "orderType": {
      "DataType": "String",
      "StringValue": "ExpeditedShipping"
    },
    "region": {
      "DataType": "String",
      "StringValue": "US"
    }
  }
}
```

**Subscription 1 Filter Policy (Standard Fulfillment Queue):**

```json
{
  "orderType": ["StandardShipping"]
}
```

**Subscription 2 Filter Policy (Expedited Fulfillment Queue):**

```json
{
  "orderType": ["ExpeditedShipping"]
}
```

**Subscription 3 Filter Policy (International Fulfillment Queue):**

```json
{
  "region": ["EU", "APAC"]
}
```

**Result:**
- Subscription 1: Receives only StandardShipping orders
- Subscription 2: Receives only ExpeditedShipping orders
- Subscription 3: Receives only EU and APAC orders

### Filter Policy Operators

| Operator | Description | Example |
|----------|-------------|---------|
| **Exact match** | Attribute equals one of specified values | `{"orderType": ["Standard", "Expedited"]}` |
| **Anything-but** | Attribute does NOT equal specified value | `{"orderType": [{"anything-but": "Cancelled"}]}` |
| **Numeric range** | Attribute within numeric range | `{"price": [{"numeric": [">=", 100, "<=", 500]}]}` |
| **Prefix match** | Attribute starts with specified prefix | `{"sku": [{"prefix": "ELEC-"}]}` |
| **Exists** | Attribute exists (any value) | `{"priority": [{"exists": true}]}` |

### Payload-Based Filtering (Charged)

**Attribute-based filtering limitations:**
- Only filters on message attributes (not message body)
- Must add attributes explicitly when publishing

**Payload-based filtering:**
- Filters on message body content (JSON)
- No need to add separate attributes
- **Cost:** Charged per GB of payload scanned ($0.10 per GB in most regions)

**Example: Filter on Message Body**

**Message Body:**

```json
{
  "orderId": "12345",
  "customerId": "67890",
  "orderType": "Expedited",
  "amount": 150.00
}
```

**Filter Policy:**

```json
{
  "orderType": ["Expedited"],
  "amount": [{"numeric": [">", 100]}]
}
```

**Result:** Subscription receives only messages where `orderType=Expedited` AND `amount>100`.

**When to Use:**
- Message attributes not practical (too many fields to filter on)
- Complex filtering logic (nested JSON, multiple conditions)
- Acceptable to pay per GB scanned

**Cost Example:**
- 1 million messages per month
- Average message size: 5 KB
- Total payload: 5 GB
- Cost: 5 GB × $0.10/GB = $0.50/month

**Recommendation:** Use attribute-based filtering when possible (free); use payload-based for complex scenarios.

---

## Cost Optimization Strategies

### SQS Cost Optimization

**Pricing Overview (us-east-1, 2025):**
- Standard Queue: $0.40 per million requests
- FIFO Queue: ~$0.50 per million requests (~25% higher)
- Each 64 KB chunk = 1 request (256 KB message = 4 requests)
- Free Tier: 1 million requests per month

#### 1. Use Long Polling (Critical)

**Short Polling (Default, Expensive):**
- `ReceiveMessage` returns immediately (even if queue empty)
- Application polls continuously
- 100% empty responses = 100% wasted API calls

**Example Cost:**
- Application polls every second: 86,400 requests/day = 2.6M requests/month
- Cost: 2.6M × $0.40/M = $1.04/month
- If only 10% of polls return messages, 90% of cost is waste

**Long Polling (Optimized, Cheap):**
- `ReceiveMessage` waits up to 20 seconds for message to arrive
- Returns immediately if message arrives
- Dramatically reduces empty responses

**Configuration:**

```
Queue Setting: ReceiveMessageWaitTimeSeconds = 20
```

**Cost Impact:**
- Reduces requests by 50-90% (depending on message frequency)
- Saves $0.50-$0.90/month per polling application
- At scale (100 consumers), saves $50-$90/month

**Recommendation:** Always enable long polling (20 seconds) for cost optimization.

#### 2. Use Batch Operations

**Single Message Processing (Expensive):**

```
SendMessage × 10 = 10 requests
ReceiveMessage × 10 = 10 requests
DeleteMessage × 10 = 10 requests
Total: 30 requests
```

**Batch Processing (Optimized):**

```
SendMessageBatch (10 messages) = 1 request
ReceiveMessage (up to 10 messages) = 1 request
DeleteMessageBatch (10 messages) = 1 request
Total: 3 requests (90% reduction)
```

**Cost Impact:**
- 1 million messages/month
- Without batching: 3M requests = $1.20
- With batching (10 per batch): 300K requests = $0.12
- **Savings: $1.08/month (90%)**

**Recommendation:** Use batch operations (`SendMessageBatch`, `DeleteMessageBatch`) for up to 10 messages per request.

#### 3. Message Compression

**Problem:** Large messages cost more (each 64 KB chunk = 1 request).

**Example:**
- Message size: 256 KB
- Billed as: 4 requests
- 1 million messages = 4 million requests = $1.60

**Solution:** Compress message before sending.

**After Compression:**
- Message size: 64 KB (compressed)
- Billed as: 1 request
- 1 million messages = 1 million requests = $0.40
- **Savings: $1.20/month (75%)**

**Trade-Off:** CPU overhead for compression/decompression vs. cost savings.

**Recommendation:** Compress messages >64 KB (gzip, zlib) to reduce request count.

#### 4. Use Extended Client Library for Large Payloads

**Problem:** Messages >256 KB not supported by SQS.

**Solution:** Use SQS Extended Client Library (automatically stores large payloads in S3).

**How It Works:**
1. Send message >256 KB
2. Library uploads payload to S3
3. SQS message contains S3 reference (small)
4. Consumer retrieves S3 reference, downloads payload from S3

**Cost Comparison:**

| Approach | SQS Cost | S3 Cost | Total |
|----------|----------|---------|-------|
| Multiple small messages (workaround) | $0.40/M requests | $0 | $0.40 |
| Extended Client (S3) | $0.40/M requests | $0.023/M requests (S3 PUT/GET) | $0.423 |

**When to Use:**
- Messages >256 KB (required)
- Very large payloads (MB range) where S3 storage is cheaper than SQS chunking

#### 5. Optimize Retention Period

**Default Retention:** 4 days

**Cost Impact:** Retention period doesn't affect per-request cost, but affects storage.

**Recommendation:**
- Set retention to actual requirement (e.g., 1 day if messages processed quickly)
- Reduces storage costs (negligible for most use cases)
- More important: Prevents old messages from accumulating if consumer fails

#### 6. Choose Right Queue Type

**Decision Matrix:**

| Use Case | Queue Type | Rationale |
|----------|-----------|-----------|
| High throughput (>3,000 TPS) | Standard | FIFO limited to 3,000 TPS |
| Order not critical | Standard | 25% cheaper than FIFO |
| Order critical | FIFO | Worth 25% premium for ordering |
| Duplicates acceptable | Standard | Cheaper; application handles deduplication |
| No duplicates allowed | FIFO | Exactly-once delivery required |

**Cost Example:**
- 10 million requests/month
- Standard: 10M × $0.40/M = $4.00
- FIFO: 10M × $0.50/M = $5.00
- **Difference: $1.00/month**

**Recommendation:** Use Standard unless ordering/deduplication required.

### SNS Cost Optimization

**Pricing Overview (us-east-1, 2025):**
- Standard Topic: $0.50 per million requests (publish)
- FIFO Topic: ~$0.50 per million requests
- Each 64 KB chunk = 1 request
- Deliveries: $0.09 per million (SQS), $0.20 per million (HTTP/S)
- Free Tier: 1 million publishes + 1 million deliveries per month

#### 1. Optimize Message Size

**Problem:** SNS charges per 64 KB chunk (same as SQS).

**Example:**
- Message size: 256 KB
- Billed as: 4 requests
- 1 million messages = 4 million publish requests = $2.00

**Solution:** Keep messages small; use S3 references for large payloads.

**After Optimization:**
- Message size: 5 KB (payload in S3, message contains S3 URL)
- Billed as: 1 request
- 1 million messages = 1 million requests = $0.50
- **Savings: $1.50/month (75%)**

**Recommendation:** Messages >64 KB should use S3 references instead of embedding full payload.

#### 2. Use Message Filtering (Attribute-Based)

**Problem:** All subscribers receive all messages; each delivery charged.

**Without Filtering:**
- 1 million messages published to topic
- 5 subscribers
- 5 million deliveries = 5M × $0.09/M (SQS) = $0.45

**With Filtering:**
- 1 million messages published
- Filter reduces deliveries by 60% (each subscriber receives only relevant messages)
- 2 million deliveries = 2M × $0.09/M = $0.18
- **Savings: $0.27/month (60%)**

**Additional Benefit:** Lower SQS costs (fewer messages received).

**Recommendation:** Use attribute-based filtering (free) to reduce unnecessary deliveries.

#### 3. Avoid Payload-Based Filtering Unless Necessary

**Cost:** $0.10 per GB scanned (applies to all messages, even if not delivered).

**Example:**
- 1 million messages/month
- Average size: 10 KB
- Total payload: 10 GB
- Payload-based filtering cost: 10 GB × $0.10/GB = $1.00/month

**Recommendation:** Use attribute-based filtering (free) when possible; only use payload-based for complex scenarios.

#### 4. Batch Message Publishing

**Single Message Publishing:**

```
Publish × 10 = 10 requests
```

**Batch Publishing:**

```
PublishBatch (10 messages) = 1 request (90% reduction)
```

**Cost Impact:**
- 10 million messages/month
- Without batching: 10M requests = $5.00
- With batching: 1M requests = $0.50
- **Savings: $4.50/month (90%)**

**Recommendation:** Use `PublishBatch` for up to 10 messages per request.

#### 5. Choose Appropriate Topic Type

**Standard vs FIFO:** Pricing similar, but FIFO has throughput limit (3,000 TPS with batching).

**Recommendation:** Use Standard for high throughput; FIFO only when ordering required.

### Combined SNS + SQS Cost Optimization

**Scenario:** 10 million messages/month, 5 subscribers.

**Unoptimized:**
- SNS publish: 10M × $0.50/M = $5.00
- SNS delivery (SQS): 50M × $0.09/M = $4.50
- SQS receive: 50M × $0.40/M = $20.00
- **Total: $29.50/month**

**Optimized (Long Polling + Batching + Filtering):**
- SNS publish (batching): 1M × $0.50/M = $0.50
- SNS delivery (filtering reduces to 30M): 30M × $0.09/M = $2.70
- SQS receive (long polling + batching): 3M × $0.40/M = $1.20
- **Total: $4.40/month**
- **Savings: $25.10/month (85%)**

**Key Takeaway:** Combining optimizations (long polling, batching, filtering) yields dramatic cost reductions.

---

## Performance Optimization

### SQS Performance Tuning

#### 1. Parallel Consumers

**Single Consumer (Slow):**
- Processes 10 messages/second
- Queue contains 10,000 messages
- Time to drain: 10,000 / 10 = 1,000 seconds (~17 minutes)

**Multiple Consumers (Fast):**
- 10 consumers, each processing 10 messages/second
- Total throughput: 100 messages/second
- Time to drain: 10,000 / 100 = 100 seconds (~2 minutes)

**Scaling Strategy:**
- Monitor `ApproximateNumberOfMessagesVisible` metric
- Scale consumers based on queue depth
- Auto Scaling policy: Add consumer when queue depth >1,000

**Recommendation:** Use multiple consumers (Lambda concurrency, ECS tasks, EC2 Auto Scaling) to increase throughput.

#### 2. Optimize Visibility Timeout

**Problem:** Visibility timeout too short → Messages reappear before processing complete → Duplicate processing.

**Problem:** Visibility timeout too long → Failed processing waits longer for retry → Increased latency.

**Optimal Setting:**
- Set visibility timeout slightly longer than average processing time
- Monitor `NumberOfMessagesSent` and `NumberOfMessagesDeleted` to detect duplicate processing
- Use `ChangeMessageVisibility` API to extend timeout if processing takes longer

**Example:**
- Average processing time: 30 seconds
- Set visibility timeout: 45 seconds (30s + 15s buffer)

**Recommendation:** Tune visibility timeout based on actual processing time; extend dynamically if needed.

#### 3. Batching for Throughput

**Receive Messages in Batches:**

```
ReceiveMessage (MaxNumberOfMessages=10)
```

**Benefits:**
- Single API call retrieves up to 10 messages
- Process multiple messages in parallel (within consumer)
- Higher throughput per consumer

**Trade-Off:** Must process all 10 messages within visibility timeout; if one message fails, all 10 reappear (unless deleted individually).

**Recommendation:** Use batch receive (up to 10 messages) and delete successfully processed messages immediately (use `DeleteMessageBatch`).

#### 4. Use ReceiveRequestAttemptId for Deduplication

**Problem:** Consumer crashes after receiving message but before processing; message reappears and processed again.

**Solution:** Use `ReceiveRequestAttemptId` to make `ReceiveMessage` idempotent (ensures same message not received twice within 5 minutes).

**Recommendation:** Generate unique `ReceiveRequestAttemptId` per consumer instance to prevent duplicate message processing during retries.

### SNS Performance Tuning

#### 1. Asynchronous Publishing

**Synchronous Publishing (Blocks Application):**

```
1. Publish message to SNS
2. Wait for confirmation
3. Continue application logic

Problem: Application waits for SNS response (increases latency)
```

**Asynchronous Publishing (Non-Blocking):**

```
1. Publish message to SNS (fire-and-forget)
2. Continue application logic immediately

Benefit: Application doesn't wait; lower latency
```

**Recommendation:** Use asynchronous publish for non-critical messages; synchronous for critical messages where confirmation required.

#### 2. Batch Publishing

**PublishBatch (up to 10 messages):**
- Single API call publishes 10 messages
- Higher throughput
- Lower cost (90% reduction in API requests)

**Recommendation:** Use `PublishBatch` for up to 10 messages per request.

#### 3. Connection Pooling

**Problem:** Creating new HTTPS connection for each SNS API call adds latency (TLS handshake).

**Solution:** Use connection pooling to reuse existing HTTPS connections.

**Recommendation:** Use AWS SDK connection pooling (enabled by default); tune `maxConnections` based on publish rate.

---

## Security Best Practices

### 1. Encrypt Messages at Rest

**SQS Encryption:**
- Enable Server-Side Encryption (SSE) using AWS KMS
- Messages encrypted at rest in queue
- Automatic decryption when consumer receives message
- **Cost:** KMS API calls ($0.03 per 10,000 requests) + KMS key ($1/month)

**SNS Encryption:**
- Enable encryption at rest using AWS KMS
- Messages encrypted when stored internally by SNS
- **Cost:** Same as SQS (KMS API calls + key)

**Recommendation:** Enable encryption for sensitive data (PII, financial information, healthcare data).

**Configuration:**

```
SQS Queue: Enable SSE-KMS
SNS Topic: Enable KMS encryption
KMS Key: Use customer-managed key or AWS-managed key
```

### 2. Encrypt Messages in Transit

**HTTPS:** All SNS and SQS API calls use HTTPS by default (TLS encryption in transit).

**Recommendation:** Always use AWS SDKs (HTTPS by default); never use HTTP endpoints.

### 3. Least Privilege IAM Policies

**Principle:** Grant only permissions required for specific operations.

**Example: Producer Policy (SQS):**

```json
{
  "Effect": "Allow",
  "Action": "sqs:SendMessage",
  "Resource": "arn:aws:sqs:region:account-id:orders-queue"
}
```

**Example: Consumer Policy (SQS):**

```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:ChangeMessageVisibility"
  ],
  "Resource": "arn:aws:sqs:region:account-id:orders-queue"
}
```

**Example: Publisher Policy (SNS):**

```json
{
  "Effect": "Allow",
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:region:account-id:order-placed"
}
```

**Recommendation:** Separate IAM roles for producers and consumers; grant minimum permissions.

### 4. VPC Endpoints for Private Access

**Problem:** SQS/SNS API calls over public internet (security risk, cost).

**Solution:** Use VPC endpoints (PrivateLink) to access SQS/SNS privately.

**Benefits:**
- Traffic stays within AWS network (never traverses internet)
- Lower latency
- No NAT gateway required (cost savings)

**Cost:** $0.01/hour per endpoint + $0.01/GB data processed.

**Recommendation:** Use VPC endpoints for applications in private subnets accessing SQS/SNS.

**For detailed VPC endpoint setup, see [AWS PrivateLink & Transit Gateway](aws-privatelink-transit-gateway.md){:target="_blank" rel="noopener noreferrer"}.**

### 5. Resource Policies

**SQS Queue Policy:** Control which services/accounts can send messages to queue.

**Example: Allow SNS to Send to SQS:**

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "sns.amazonaws.com"
  },
  "Action": "sqs:SendMessage",
  "Resource": "arn:aws:sqs:region:account-id:orders-queue",
  "Condition": {
    "ArnEquals": {
      "aws:SourceArn": "arn:aws:sns:region:account-id:order-placed"
    }
  }
}
```

**SNS Topic Policy:** Control who can publish to topic.

**Example: Allow Lambda to Publish:**

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "lambda.amazonaws.com"
  },
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:region:account-id:order-placed",
  "Condition": {
    "StringEquals": {
      "aws:SourceAccount": "123456789012"
    }
  }
}
```

**Recommendation:** Use resource policies to restrict access; combine with IAM policies for defense in depth.

### 6. Message-Level Security

**Option 1: Application-Level Encryption**
- Encrypt message payload before sending (using application key)
- Decrypt after receiving
- **Benefit:** End-to-end encryption (AWS never sees plaintext)
- **Drawback:** Can't use SNS message filtering on encrypted payload

**Option 2: AWS KMS Envelope Encryption**
- Generate data key using KMS
- Encrypt message with data key
- Include encrypted data key with message
- Consumer uses KMS to decrypt data key, then decrypt message

**Recommendation:** Use KMS encryption at rest + HTTPS in transit for most use cases; application-level encryption for highly sensitive data.

---

## Observability and Monitoring

### Key CloudWatch Metrics

#### SQS Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `ApproximateNumberOfMessagesVisible` | Messages available for retrieval | >1000 (queue backing up) |
| `ApproximateNumberOfMessagesNotVisible` | Messages in-flight (being processed) | High value indicates slow processing |
| `ApproximateAgeOfOldestMessage` | Age of oldest message in queue | >300 seconds (5 minutes) |
| `NumberOfMessagesSent` | Messages added to queue | Monitor for sudden drops (producer failure) |
| `NumberOfMessagesReceived` | Messages retrieved by consumers | Monitor for sudden drops (consumer failure) |
| `NumberOfMessagesDeleted` | Messages successfully processed | Low compared to received = processing failures |
| `NumberOfEmptyReceives` | ReceiveMessage calls that returned no messages | High value = short polling waste |

#### SNS Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `NumberOfMessagesPublished` | Messages published to topic | Monitor for sudden drops |
| `NumberOfNotificationsDelivered` | Messages delivered to subscribers | Low compared to published = delivery failures |
| `NumberOfNotificationsFailed` | Failed deliveries | >0 (investigate failures) |
| `NumberOfNotificationsFilteredOut` | Messages filtered (not delivered due to filter policy) | Monitor to verify filtering working as expected |

### Recommended CloudWatch Alarms

**1. Queue Depth Alarm (SQS)**

```
Metric: ApproximateNumberOfMessagesVisible
Threshold: >1000
Duration: 5 minutes
Action: Trigger Auto Scaling (add consumers) or alert on-call
```

**2. Old Message Alarm (SQS)**

```
Metric: ApproximateAgeOfOldestMessage
Threshold: >600 seconds (10 minutes)
Duration: 5 minutes
Action: Alert on-call (indicates processing stuck)
```

**3. DLQ Alarm (SQS)**

```
Metric: ApproximateNumberOfMessagesVisible (on DLQ)
Threshold: >0
Duration: 1 minute
Action: Alert on-call (indicates systemic processing failure)
```

**4. Failed Deliveries (SNS)**

```
Metric: NumberOfNotificationsFailed
Threshold: >100
Duration: 5 minutes
Action: Alert on-call (indicates subscriber unreachable or permissions issue)
```

### Tracing with AWS X-Ray

**Enable X-Ray:**
- Trace messages through SNS → SQS → Lambda/ECS
- Visualize message flow across services
- Identify bottlenecks and latency issues

**Example Trace:**

```
API Gateway → Lambda (Publish to SNS) → SNS Topic → SQS Queue → Lambda (Consumer)
```

**Benefit:** See end-to-end latency, identify slow consumers, detect failures.

**Recommendation:** Enable X-Ray for complex message flows (multiple hops).

### Logging Best Practices

**1. CloudTrail (API Calls)**
- Log all SQS/SNS API calls (SendMessage, ReceiveMessage, Publish, etc.)
- Audit who sent/received messages
- Detect unauthorized access

**2. Application Logs**
- Log message ID when processing starts
- Log success/failure when processing completes
- Include context (order ID, customer ID) for troubleshooting

**3. Structured Logging**
- Use JSON format for easy parsing
- Include timestamp, message ID, correlation ID, processing duration

**Example Log Entry:**

```json
{
  "timestamp": "2025-01-14T10:30:00Z",
  "level": "INFO",
  "messageId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "orderId": "12345",
  "action": "ProcessOrder",
  "duration": 250,
  "status": "success"
}
```

**Recommendation:** Use structured logging and CloudWatch Logs Insights for querying.

---

## When to Use SQS vs SNS

### SQS Use Cases

✅ **Use SQS when:**
- **Point-to-point communication:** One producer, one (or multiple identical) consumers
- **Buffering needed:** Absorb traffic spikes; consumers process at their own pace
- **Guaranteed processing:** Each message must be processed exactly once (FIFO) or at least once (Standard)
- **Decoupling producer and consumer:** Producer doesn't wait for consumer
- **Work queue pattern:** Distribute tasks across multiple workers

**Examples:**
- Image processing pipeline (producer uploads image; workers process)
- Order fulfillment (order service sends to queue; fulfillment service processes)
- Background job processing (user action triggers job; worker processes asynchronously)
- Email sending queue (application adds emails to queue; worker sends)

### SNS Use Cases

✅ **Use SNS when:**
- **Pub/sub (one-to-many):** One message reaches multiple subscribers simultaneously
- **Fan-out pattern:** Trigger multiple independent workflows
- **Event broadcasting:** Notify multiple services of events
- **Push notifications:** Send alerts to mobile devices, email, SMS
- **Webhooks:** Deliver events to external HTTP endpoints

**Examples:**
- Order placed event (notify fulfillment, inventory, and email services)
- User registration (send welcome email, create profile, trigger analytics)
- Alarm notifications (CloudWatch alarm triggers SNS → Email + SMS + PagerDuty)
- Real-time notifications (push to mobile app, browser, Slack)

### Decision Matrix

| Scenario | Use SQS | Use SNS | Use Both (SNS + SQS Fanout) |
|----------|---------|---------|---------------------------|
| One message, one consumer | ✅ | ❌ | ❌ |
| One message, multiple consumers | ❌ | ✅ | ✅ (recommended) |
| Buffer needed (handle bursts) | ✅ | ❌ | ✅ |
| Guaranteed processing | ✅ | ❌ | ✅ (SQS provides guarantee) |
| Message persistence | ✅ | ❌ (ephemeral) | ✅ (SQS provides persistence) |
| Real-time push | ❌ (poll-based) | ✅ | ✅ (SNS pushes to SQS) |
| Order matters | ✅ (FIFO) | ✅ (FIFO) | ✅ (FIFO SNS + FIFO SQS) |

### Why Use SNS + SQS Fanout?

**Best of both worlds:**
- **SNS:** Pub/sub (one-to-many), push-based delivery
- **SQS:** Buffering, durability, guaranteed processing, independent consumer scaling

**When to Use Fanout:**
- One event triggers multiple independent workflows
- Each consumer processes at its own pace
- Need durability (if consumer down, messages wait in queue)
- Need retry isolation (one consumer failure doesn't affect others)

**Example: Order Processing**

```
Order Placed Event (SNS Topic)
  → Fulfillment Queue (SQS) → Fulfillment Service
  → Inventory Queue (SQS) → Inventory Service
  → Analytics Queue (SQS) → Analytics Service
  → Email Queue (SQS) → Email Service

Benefits:
- Add/remove consumers without changing producer
- Each consumer processes independently
- Failures isolated per consumer
- Scale each consumer based on queue depth
```

---

## Integration Patterns

### Pattern 1: Simple Queue (SQS Only)

**Architecture:**

```
Producer → [SQS Queue] → Consumer
```

**Use When:**
- Point-to-point communication
- One consumer (or multiple identical consumers)
- Simple decoupling

**Example:** Image upload service sends messages to processing queue; worker processes images.

---

### Pattern 2: Pub/Sub (SNS Only)

**Architecture:**

```
Publisher → [SNS Topic] → Subscriber 1 (Lambda)
                       → Subscriber 2 (Email)
                       → Subscriber 3 (SMS)
```

**Use When:**
- Real-time notifications
- Multiple heterogeneous subscribers (Lambda, Email, SMS, HTTP)
- No buffering needed (consumers always available)

**Example:** CloudWatch alarm publishes to SNS; SNS delivers to email, SMS, and PagerDuty webhook.

---

### Pattern 3: Fanout (SNS + SQS)

**Architecture:**

```
Publisher → [SNS Topic] → [SQS Queue 1] → Consumer 1
                       → [SQS Queue 2] → Consumer 2
                       → [SQS Queue 3] → Consumer 3
```

**Use When:**
- One message triggers multiple workflows
- Need durability and buffering
- Consumers process at different rates

**Example:** Order placed event (SNS) → Fulfillment, Inventory, and Email queues (SQS) → Independent consumers.

---

### Pattern 4: Priority Queues

**Architecture:**

```
Publisher → [SNS Topic] → [High-Priority Queue (FIFO)] → Fast Consumer
                       → [Standard Queue] → Standard Consumer
                       → [Low-Priority Queue] → Slow Consumer
```

**Use When:**
- Different message priorities
- High-priority messages processed first
- Use SNS filtering to route by priority

**Example:** Order processing with expedited, standard, and economy shipping.

**SNS Filter Policies:**

```json
High-Priority Queue: {"priority": ["high"]}
Standard Queue: {"priority": ["standard"]}
Low-Priority Queue: {"priority": ["low"]}
```

---

### Pattern 5: Event Sourcing with SQS

**Architecture:**

```
Event Producer → [SQS Queue] → Event Consumer (writes to event store)
```

**Use When:**
- Capturing all events for audit trail
- Event replay needed
- Immutable event log

**Example:** Financial transactions sent to queue; consumer writes to event store (DynamoDB, S3).

---

### Pattern 6: Lambda Event Source with SQS

**Architecture:**

```
Producer → [SQS Queue] ← [Lambda polls queue] → Lambda Function
```

**How It Works:**
- Lambda service polls SQS queue automatically
- Lambda invokes function with batch of messages (up to 10)
- Function processes messages; Lambda deletes successfully processed messages

**Benefits:**
- No polling code needed (Lambda handles it)
- Auto-scaling (Lambda concurrency scales with queue depth)
- Built-in retry (failed messages return to queue)

**Use When:**
- Serverless processing
- Event-driven Lambda functions
- No need to manage consumers

**Configuration:**

```
SQS Queue: orders-queue
Lambda Event Source Mapping:
  - Batch Size: 10
  - Batch Window: 5 seconds
  - Concurrency: 100
```

---

### Pattern 7: Request-Response Pattern

**Architecture:**

```
Client → [Request Queue] → Worker → [Response Queue] → Client
```

**How It Works:**
1. Client sends message to request queue with reply-to queue ARN
2. Worker processes message, sends response to reply-to queue
3. Client polls response queue for result

**Use When:**
- Asynchronous request-response needed
- Client doesn't want to wait synchronously

**Example:** Long-running report generation.

---

### Pattern 8: Dead Letter Queue Pattern

**Architecture:**

```
Source Queue → Consumer (fails) → [DLQ] → Manual Inspection / Reprocessing
```

**Use When:**
- Need to isolate problematic messages
- Investigate processing failures
- Prevent poison messages from blocking queue

**Best Practice:** Set `maxReceiveCount=3` on source queue; messages move to DLQ after 3 failed attempts.

---

## Common Pitfalls

### Pitfall 1: Not Configuring Dead Letter Queues

**Problem:** Consumer fails to process message; message retries indefinitely, blocking queue.

**Impact:**
- Poison messages prevent other messages from being processed
- Queue grows without resolution
- No visibility into problematic messages

**Solution:** Configure DLQ with `maxReceiveCount=3`.

**Cost Impact:** Wasted processing costs retrying unprocessable messages; operational cost investigating without DLQ visibility.

---

### Pitfall 2: Visibility Timeout Too Short

**Problem:** Visibility timeout expires before consumer finishes processing; message reappears and processed again (duplicate).

**Impact:**
- Duplicate processing (order charged twice, email sent twice)
- Wasted compute resources

**Solution:** Set visibility timeout longer than average processing time; extend timeout dynamically if needed using `ChangeMessageVisibility`.

**Cost Impact:** Duplicate processing doubles compute costs; potential business impact (duplicate charges).

---

### Pitfall 3: Not Using Long Polling

**Problem:** Short polling (default) returns immediately even if queue empty; application polls continuously.

**Impact:**
- 90% empty responses = 90% wasted API calls
- Higher SQS costs

**Solution:** Enable long polling (`ReceiveMessageWaitTimeSeconds=20`).

**Cost Impact:** Without long polling, typical workload costs $1/month; with long polling, $0.10/month (90% savings).

---

### Pitfall 4: Not Using Batch Operations

**Problem:** Sending/receiving/deleting one message at a time.

**Impact:**
- 10× more API calls than necessary
- Higher costs

**Solution:** Use `SendMessageBatch`, `DeleteMessageBatch` for up to 10 messages per request.

**Cost Impact:** Without batching, 10 million messages = $12/month; with batching, $1.20/month (90% savings).

---

### Pitfall 5: Forgetting to Delete Messages

**Problem:** Consumer processes message but forgets to call `DeleteMessage`.

**Impact:**
- Message reappears after visibility timeout
- Duplicate processing
- Queue never drains

**Solution:** Always delete message after successful processing.

**Cost Impact:** Duplicate processing; queue grows indefinitely.

---

### Pitfall 6: Not Monitoring DLQ Depth

**Problem:** Messages move to DLQ but no alerts configured.

**Impact:**
- Messages lost (if DLQ retention expires)
- Systemic issues unnoticed

**Solution:** CloudWatch alarm on DLQ depth (`ApproximateNumberOfMessagesVisible>0`).

**Cost Impact:** Lost messages = lost business (orders not fulfilled, payments not processed).

---

### Pitfall 7: Using FIFO When Standard Sufficient

**Problem:** Choosing FIFO for use case where ordering doesn't matter.

**Impact:**
- 25% higher cost
- 100× lower throughput limit (3,000 TPS vs unlimited)

**Solution:** Use Standard unless ordering/deduplication required.

**Cost Impact:** 10 million messages: Standard=$4.00, FIFO=$5.00 ($1.00/month wasted). Throughput: Standard scales infinitely; FIFO limited to 3,000 TPS.

---

### Pitfall 8: Not Using SNS Filtering

**Problem:** All subscribers receive all messages, even if not relevant.

**Impact:**
- Unnecessary SQS deliveries (cost)
- Consumers waste resources filtering messages

**Solution:** Use SNS attribute-based filtering (free).

**Cost Impact:** Without filtering: 5 subscribers × 10M messages = 50M deliveries = $4.50 + $20 SQS = $24.50. With filtering (60% reduction): 30M deliveries = $2.70 + $12 SQS = $14.70 (40% savings).

---

### Pitfall 9: Large Messages Without Compression

**Problem:** Sending 256 KB messages (billed as 4 requests per message).

**Impact:**
- 4× higher costs

**Solution:** Compress messages >64 KB or use S3 Extended Client Library.

**Cost Impact:** 1M messages at 256 KB = 4M requests = $1.60. After compression to 64 KB = 1M requests = $0.40 (75% savings).

---

### Pitfall 10: Not Implementing Idempotency

**Problem:** Duplicate messages processed without idempotency checks.

**Impact:**
- Duplicate orders charged
- Duplicate emails sent
- Duplicate database writes

**Solution:**
- **Standard Queue:** Application implements idempotency (check if message already processed using unique ID)
- **FIFO Queue:** Exactly-once delivery (no duplicates)

**Cost Impact:** Business impact (customer charged twice, refunds required, reputation damage).

---

## Key Takeaways

1. **SQS decouples producers and consumers through durable message queuing.** Messages persist until successfully processed, enabling independent scaling and resilience to failures.

2. **SNS enables pub/sub broadcasting to multiple subscribers simultaneously.** One message reaches many consumers, ideal for event-driven architectures and fan-out patterns.

3. **SNS + SQS fanout pattern combines the best of both services.** SNS provides pub/sub; SQS provides buffering, durability, and guaranteed processing per consumer.

4. **Standard vs FIFO: choose based on throughput, ordering, and cost.** Standard offers unlimited throughput and lower cost; FIFO provides ordering and exactly-once delivery at 25% premium and 100× lower throughput.

5. **Dead Letter Queues are critical for production workloads.** Configure DLQ with maxReceiveCount=3 to isolate problematic messages; monitor DLQ depth with CloudWatch alarms.

6. **Long polling reduces SQS costs by 90%.** Always set ReceiveMessageWaitTimeSeconds=20 to eliminate empty polling waste.

7. **Batch operations reduce costs by 90%.** Use SendMessageBatch, DeleteMessageBatch for up to 10 messages per request.

8. **SNS message filtering reduces unnecessary deliveries and costs.** Use attribute-based filtering (free) to route messages selectively; avoid payload-based filtering unless necessary ($0.10/GB).

9. **Visibility timeout must exceed processing time.** If too short, messages reappear prematurely causing duplicates; extend dynamically using ChangeMessageVisibility if needed.

10. **Monitor queue depth and age of oldest message.** Alert on ApproximateNumberOfMessagesVisible>1000 and ApproximateAgeOfOldestMessage>600 seconds to detect consumer failures.

11. **Use VPC endpoints for private SQS/SNS access.** Eliminates NAT gateway costs, improves security, and reduces latency for applications in private subnets. See [AWS PrivateLink & Transit Gateway](aws-privatelink-transit-gateway.md){:target="_blank" rel="noopener noreferrer"} for details.

12. **Implement idempotency for Standard queues.** Standard queues may deliver duplicates, so applications must handle this with idempotency checks. FIFO queues guarantee exactly-once delivery but at lower throughput.

**SQS and SNS are foundational building blocks for decoupled, event-driven architectures. Master these services to build scalable, resilient, and cost-optimized distributed systems on AWS.**
