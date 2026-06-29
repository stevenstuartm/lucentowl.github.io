---
layout: guide
title: "Messaging Patterns"
category: Architecture
subcategory: Patterns
description: "Reliable messaging patterns including transactional outbox/inbox, saga pattern, event sourcing, and message versioning for distributed systems."
tags: [architecture, design-patterns, messaging, reliability, distributed-systems, transactions]
---

Messaging patterns ensure reliable, consistent, and efficient message handling in distributed systems.

## Transactional Outbox

*Pattern from Chris Richardson's Microservices Patterns (2018), solving the dual-write problem*

<blockquote class="pull-quote">
<p>The dual-write problem: Writing to a database AND message broker atomically isn't possible without distributed transactions.</p>
</blockquote>

Ensures reliable message publishing by storing messages in the same database transaction as business data, then publishing them separately. Guarantees atomicity between database updates and message publishing.

**Problem Solved**: The dual-write problem. Writing to a database AND message broker atomically isn't possible without distributed transactions.

**Use When**:
- Need to guarantee message publishing after data changes
- Cannot afford to lose messages
- Database and message broker are separate systems
- Want to avoid distributed transactions (2PC)

**How It Works**:

1. Store business data and message in same database transaction (atomicity guaranteed)
2. Separate process (Message Relay) reads outbox table and publishes messages
3. Mark messages as published after successful delivery
4. Optional: Delete or archive old published messages

**Example**: Order service saves new orders and outbox events in same transaction, ensuring order notifications are always sent.

```sql
BEGIN TRANSACTION
  INSERT INTO orders (id, customer_id, total) VALUES (...)
  INSERT INTO outbox (message_type, payload, created_at) VALUES ('OrderCreated', {...}, NOW())
COMMIT

-- Separate Message Relay process (polling or CDC)
SELECT * FROM outbox WHERE published = false ORDER BY created_at
PUBLISH to message broker
UPDATE outbox SET published = true, published_at = NOW() WHERE id = ...
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Polling</h4>
<p>Periodically query outbox table</p>
<ul>
<li><strong>Pros:</strong> Simple to implement</li>
<li><strong>Cons:</strong> Adds latency</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Change Data Capture (CDC)</h4>
<p>Stream database changes in near real-time</p>
<ul>
<li><strong>Pros:</strong> Lower latency</li>
<li><strong>Cons:</strong> More complex setup</li>
</ul>
</div>
</div>

**Tools**: Debezium (CDC), custom polling service

---

## Transactional Inbox

*Complementary pattern to Transactional Outbox, ensuring idempotent message consumption*

Ensures idempotent message processing by tracking processed messages in the database. Prevents duplicate message processing even when messages are delivered multiple times (at-least-once delivery guarantee).

**Problem Solved**: Message brokers typically provide at-least-once delivery, meaning duplicates are possible. Without deduplication, the same message could be processed multiple times.

**Use When**:
- Messages might be delivered multiple times (at-least-once delivery)
- Processing must be idempotent
- Cannot afford duplicate processing (e.g., charging customer twice)
- Message broker doesn't guarantee exactly-once processing

**How It Works**:

1. Check if message_id exists in inbox table
2. If exists, skip processing (duplicate)
3. If new, process message and record in inbox atomically
4. Use unique constraint to prevent race conditions

**Example**: Inventory service tracks processed order messages to prevent double inventory reduction if the same order message is delivered twice.

```sql
BEGIN TRANSACTION
  -- This INSERT fails if duplicate (UNIQUE constraint on message_id)
  INSERT INTO inbox (message_id, processed_at) VALUES ('msg-12345', NOW())

  -- Only executes if INSERT succeeded (no duplicate)
  UPDATE inventory SET quantity = quantity - order.quantity WHERE product_id = ...
COMMIT
```

**Best Practice**: Keep inbox records for some retention period (days/weeks), then archive/delete to manage table size

---

## Claim Check

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003)*

Stores large message payloads separately and sends only a reference (claim check) through the messaging system. Named after the claim check system at coat check counters: you hand over your coat, receive a ticket, and use the ticket to retrieve your coat later.

**How It Works**:

```
Producer                          Storage              Message Broker           Consumer
   │                                │                       │                      │
   │──1. Store payload ────────────→│                       │                      │
   │←───── claim-check-id ──────────│                       │                      │
   │                                │                       │                      │
   │──2. Send message with id ──────┼──────────────────────→│                      │
   │     (small: just the reference)│                       │                      │
   │                                │                       │──3. Deliver ────────→│
   │                                │                       │                      │
   │                                │←──4. Fetch payload ───┼──────────────────────│
   │                                │────── payload ────────┼─────────────────────→│
   │                                │                       │                      │
   │                                │←──5. Delete (optional)┼──────────────────────│
```

**Use When**:
- Message payloads are large (images, documents, videos)
- Messaging system has size limitations (Kafka default 1MB, SQS 256KB, RabbitMQ 128MB)
- Want to optimize message broker performance and reduce network traffic
- Large payloads would slow down message processing or cause memory pressure

**Example**: Document processing system stores uploaded files in S3 and sends processing messages containing only the S3 key.

```
Producer:
  1. doc = readFile("contract.pdf")  // 15MB PDF
  2. key = s3.put("documents", doc)  // Returns "doc-12345"
  3. queue.send({
       type: "ProcessDocument",
       claimCheck: { bucket: "documents", key: "doc-12345" },
       metadata: { filename: "contract.pdf", size: 15728640 }
     })

Consumer:
  1. msg = queue.receive()
  2. doc = s3.get(msg.claimCheck.bucket, msg.claimCheck.key)
  3. result = processDocument(doc)
  4. s3.delete(msg.claimCheck.bucket, msg.claimCheck.key)  // Cleanup
  5. queue.ack(msg)
```

**Consistency Challenges**:

The claim check pattern introduces a coordination problem: the message and payload are stored separately, so they can get out of sync.

| Failure Scenario | What Happens | Mitigation |
|------------------|--------------|------------|
| Payload stored, message send fails | Orphaned payload in storage | Use TTL on storage; periodic cleanup job |
| Message delivered, payload deleted early | Consumer can't retrieve payload | Don't delete until consumer confirms success |
| Consumer crashes after fetch, before ack | Payload deleted, message redelivered | Make payload deletion the last step, after ack |
| Storage unavailable when consumer fetches | Processing fails | Retry with backoff; move to DLQ if persistent |

```
Safe deletion order:

  ✗ Wrong: Delete payload → Ack message
    (If ack fails, message redelivered but payload gone)

  ✓ Right: Process → Ack message → Delete payload
    (If delete fails, orphaned payload is harmless)

  ✓ Better: Use storage TTL + don't delete
    (Payload auto-expires after retention period)
```

<div class="callout callout--tip">
<p class="callout__title">Orphan Cleanup</p>
<p>Set a TTL (time-to-live) on stored payloads longer than your max message processing time. Run a periodic job to delete payloads older than the TTL. This handles orphans from failed message sends without risking deletion of in-flight payloads.</p>
</div>

---

## Dead Letter Queue

A separate queue where messages are moved after failing processing multiple times. Instead of losing failed messages or blocking the main queue, the system preserves them for investigation and potential reprocessing.

**How It Works**:

```
Main Queue                         Dead Letter Queue
┌─────────┐                       ┌─────────────────┐
│ Message │──→ Process ──→ Fail   │                 │
│   A     │      ↓                │  Message A      │
│         │   Retry 1 ──→ Fail    │  (failed 3x)    │
│         │      ↓                │  reason: timeout│
│         │   Retry 2 ──→ Fail    │  timestamp: ... │
│         │      ↓                │                 │
│         │   Retry 3 ──→ Fail ───┼──→              │
└─────────┘      ↓                └─────────────────┘
              Move to DLQ              ↓
                                 Manual review or
                                 automated replay
```

**Use When**:
- Messages might fail due to transient issues (service down) or permanent issues (malformed data)
- Need to investigate why messages failed without losing them
- Cannot afford to block the main queue while troubleshooting

**Failure Types and Handling**:

| Failure Type | Example | DLQ Action |
|--------------|---------|------------|
| Transient | Downstream service timeout | Auto-replay after delay |
| Permanent | Invalid JSON, missing required field | Manual fix and replay |
| Poison message | Causes consumer crash | Quarantine and investigate |

**Reprocessing Strategies**:

1. **Manual replay**: Operator reviews, fixes data if needed, replays individual messages
2. **Scheduled retry**: Automatic replay after configured delay (for transient failures)
3. **Selective replay**: Filter by error type, replay only fixable messages

**Example**: Order processing where payment service is temporarily unavailable.

```
Order Queue:
  order-123 → Payment Service (503 error)
            → Retry after 1s (503 error)
            → Retry after 5s (503 error)
            → Retry after 30s (503 error)
            → Move to DLQ with metadata:
              {
                "original_queue": "orders",
                "failure_count": 4,
                "last_error": "PaymentService: 503 Service Unavailable",
                "first_failed": "2024-01-15T10:30:00Z"
              }

Later: Payment service recovers → Operator replays DLQ messages → Orders processed
```

<div class="callout callout--warning">
<p class="callout__title">DLQ Monitoring</p>
<p>Set up alerts when DLQ depth exceeds thresholds. A growing DLQ often indicates systemic issues (downstream service down, schema change broke consumers) rather than isolated failures.</p>
</div>

---

## Priority Queue

Routes messages to consumers based on priority level rather than arrival order. Higher-priority messages are processed before lower-priority ones, even if they arrived later.

**How It Works**:

```
Incoming Messages          Priority Queues              Consumer
                          ┌───────────────┐
  [Priority: HIGH] ──────→│ HIGH (P1)     │──┐
                          │ ○ ○ ○         │  │
                          ├───────────────┤  ├──→ Process HIGH first
  [Priority: MEDIUM] ────→│ MEDIUM (P2)   │  │     then MEDIUM
                          │ ○ ○           │──┘     then LOW
                          ├───────────────┤
  [Priority: LOW] ───────→│ LOW (P3)      │
                          │ ○ ○ ○ ○ ○     │──→ Only when P1, P2 empty
                          └───────────────┘
```

**Use When**:
- Different message types have different SLA requirements
- Some operations are time-sensitive (payment vs. analytics)
- Need to ensure critical work isn't blocked by bulk processing

**Implementation Approaches**:

| Approach | How It Works | Trade-off |
|----------|--------------|-----------|
| Separate queues | One queue per priority level | Simple but needs routing logic |
| Priority field | Single queue with priority sorting | Complex ordering, potential reordering |
| Weighted fair queuing | Process N high-priority for every 1 low-priority | Prevents starvation |

**Starvation Prevention**:

If high-priority messages arrive continuously, low-priority messages may never be processed. Solutions:

```
Without starvation prevention:
  HIGH: ○○○○○○○○○○... (continuous)
  LOW:  ○○○○○○○○○○○○○  (never processed)

With weighted fair queuing (3:1 ratio):
  Process: HIGH, HIGH, HIGH, LOW, HIGH, HIGH, HIGH, LOW...
  LOW messages guaranteed some throughput
```

**Example**: E-commerce order processing.

```
Priority Assignment:
  - P1 (Critical): Payment failures, fraud alerts
  - P2 (High): Order confirmations, shipping updates
  - P3 (Normal): Inventory sync, analytics events
  - P4 (Low): Marketing emails, recommendation updates

Consumer Logic:
  while true:
    if P1.hasMessages(): process(P1.next())
    else if P2.hasMessages(): process(P2.next())
    else if P3.hasMessages(): process(P3.next())
    else if P4.hasMessages(): process(P4.next())
    else: wait()
```

<div class="callout callout--tip">
<p class="callout__title">Priority Assignment</p>
<p>Assign priority based on business impact, not technical convenience. A background job that affects revenue (inventory sync) may need higher priority than a user-facing feature (recommendation refresh) that doesn't.</p>
</div>

---

## Quick Reference

### Pattern Comparison

| Pattern | Purpose | Trade-off |
|---------|---------|-----------|
| **Transactional Outbox** | Guarantee message delivery | Additional storage, eventual consistency |
| **Transactional Inbox** | Prevent duplicate processing | Additional storage, unique constraint checks |
| **Claim Check** | Handle large payloads | Extra retrieval step, storage costs |
| **Dead Letter Queue** | Handle failures gracefully | Manual intervention needed |
| **Priority Queue** | Process urgent messages first | Starvation of low-priority messages |

### Decision Tree

| Question | Pattern |
|----------|---------|
| Need guaranteed delivery? | Transactional Outbox |
| Need to prevent duplicates? | Transactional Inbox |
| Message too large? | Claim Check |
| Messages failing repeatedly? | Dead Letter Queue |
| Different urgency levels? | Priority Queue |

---
