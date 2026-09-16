---
layout: guide
title: "Messaging Patterns"
category: Architecture
subcategory: Patterns
description: "Patterns for reliable, correct message-based integration: transactional outbox and inbox, claim check, dead letter and priority queues, and content-based routing and message translation."
tags: [practical, outbox, inbox, claim-check, dead-letter-queue, priority-queue, message-routing]
---

Once services talk through a broker instead of calling each other directly, a set of problems appears that a direct call never had. A message has to be published exactly when the data it describes commits. A payload can be too large for the broker to carry. A message that keeps failing has to go somewhere other than the front of the queue. And a message has to reach the right consumer in a shape that consumer understands.

These patterns are independent rather than alternatives. One order pipeline might use the outbox to publish, the inbox to deduplicate, a dead letter queue to catch what fails, and a router to fan work out by type.

## Transactional Outbox

*Catalogued by Chris Richardson on microservices.io and in Microservices Patterns (2018)*

A service that updates its database and publishes a message about that update has two systems to write to and no way to commit both together. Without a distributed transaction, one write can succeed while the other fails, leaving the database updated with no message sent, or a message sent about a change that rolled back.

The outbox pattern takes the second write off the critical path. The message is inserted into an outbox table in the same transaction as the business data, so the two commit or roll back together. A separate relay process reads the outbox afterwards and publishes to the broker.

```
         ┌──────────── single database transaction ────────────┐
         │                                                     │
Service ─┤─▶ INSERT order ──▶ [ business tables ]              │
         │─▶ INSERT event ──▶ [ outbox table ]                 │
         └──────────────────────────────┬──────────────────────┘
                                        │
                                        ▼
                               Message Relay ──▶ Broker ──▶ Consumer
                               (polling publisher, or
                                transaction log tailing)
```

**Use when**:
- A message must not be lost when the data it describes was committed
- The database and the message broker are separate systems
- Two-phase commit across them is unavailable or unwanted

**Example**: An order service writes the order row and an `OrderCreated` event in one transaction, so a committed order always has an event waiting to be published.

```sql
BEGIN TRANSACTION;

INSERT INTO orders (id, customer_id, total)
VALUES ('ord-1001', 'cust-42', 149.99);

INSERT INTO outbox (id, message_type, payload, created_at, published)
VALUES ('evt-8801', 'OrderCreated', '{"orderId":"ord-1001","total":149.99}', NOW(), false);

COMMIT;
```

The relay runs outside that transaction, on its own schedule.

```sql
SELECT id, message_type, payload FROM outbox
WHERE published = false
ORDER BY created_at
LIMIT 100;

-- after the broker acknowledges the publish
UPDATE outbox SET published = true, published_at = NOW() WHERE id = 'evt-8801';
```

Richardson names the two ways to build that relay. A **polling publisher** queries the outbox table on an interval, which is simple to build and adds whatever latency the interval costs. **Transaction log tailing** reads the database's own write-ahead log through a tool like Debezium, which gets the message out sooner at the cost of a change data capture pipeline to run.

**Trade-offs**: Publishing is no longer simultaneous with the commit, so consumers see the event some time after the data changed, and how long depends on the relay. The relay can also publish the same message twice, because it can crash between publishing and marking the row published. That is why the outbox is normally paired with deduplication on the consumer. The outbox table grows with every message sent and needs an archive or delete job.

---

## Transactional Inbox

Brokers typically guarantee at-least-once delivery, so a consumer has to assume it will occasionally see the same message more than once. The inbox pattern makes that harmless by recording every message id the consumer has handled, in the same transaction as the work that message triggered.

**Use when**:
- Reprocessing a message would do visible damage, such as charging a customer twice
- The broker offers at-least-once delivery rather than exactly-once processing
- The work a message triggers is not naturally idempotent on its own

**How it works**: A unique constraint on `message_id` does the deduplication. Inserting the id and doing the work in one transaction means a duplicate fails the insert and rolls the work back with it, so there is no window where one succeeds without the other.

**Example**: An inventory service records each order message it processes, so a redelivered message can't decrement stock a second time.

```sql
BEGIN TRANSACTION;

-- Fails on the UNIQUE constraint if this message was already processed
INSERT INTO inbox (message_id, processed_at) VALUES ('msg-12345', NOW());

UPDATE inventory SET quantity = quantity - 3 WHERE product_id = 'sku-77';

COMMIT;
```

**Trade-offs**: Every message now costs an extra write and a uniqueness check. The inbox table grows as fast as messages arrive, so it needs a retention window long enough to outlast any redelivery the broker might attempt, then an archive or delete job behind it.

---

## Claim Check

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003)*

Stores a large message payload separately and sends only a reference through the messaging system. Named after the claim check at a coat check counter, where you hand over your coat, receive a ticket, and use the ticket to retrieve it later.

**How it works**:

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

**Use when**:
- Payloads are large, such as images, documents, or video
- The payload approaches the broker's message size limit. Kafka's broker default `message.max.bytes` is roughly 1 MB, Amazon SQS caps a message at 1 MiB, and RabbitMQ's default `max_message_size` is 16 MiB from version 4.0 onward
- Large payloads would otherwise slow message processing or put memory pressure on consumers

**Example**: A document processing system writes uploaded files to S3 and sends a message carrying only the bucket and key.

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
  4. queue.ack(msg)
  5. s3.delete(msg.claimCheck.bucket, msg.claimCheck.key)  // Cleanup, last
```

**Consistency challenges**: Splitting the message from its payload creates a coordination problem, because the two can now get out of sync.

| Failure scenario | What happens | Mitigation |
|------------------|--------------|------------|
| Payload stored, message send fails | Orphaned payload in storage | Use a TTL on storage, and run a periodic cleanup job |
| Message delivered, payload deleted early | Consumer can't retrieve the payload | Don't delete until the consumer confirms success |
| Consumer crashes after fetch, before ack | Payload deleted, message redelivered | Delete the payload last, after the ack |
| Storage unavailable when consumer fetches | Processing fails | Retry with backoff, then dead letter if it persists |

The ordering in that third row is the one that catches people. Deleting the payload before acknowledging the message means a failed ack redelivers a message whose payload is already gone.

<div class="callout callout--tip">
<p class="callout__title">Orphan Cleanup</p>
<p>Set a TTL on stored payloads longer than your maximum message processing time, and run a periodic job that deletes payloads older than the TTL. This clears orphans left by failed message sends without risking deletion of a payload still in flight.</p>
</div>

**Trade-offs**: Every consumer pays an extra round trip to storage before it can do any work, and the storage bill and its lifecycle rules become part of the messaging system's operational surface.

---

## Dead Letter Queue

A separate queue holding messages that failed processing repeatedly. Rather than dropping a failed message or letting it block the queue behind it, the broker moves it aside for investigation and possible replay.

**How it works**:

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

**Use when**:
- Messages can fail for transient reasons, permanent reasons, or both
- Losing a failed message is unacceptable, but blocking the queue behind it is worse
- Failures need investigating after the fact rather than in the moment

Why a message failed determines what should happen to it, so the queue is only useful if something reads it.

| Failure type | Example | What to do with it |
|--------------|---------|--------------------|
| Transient | Downstream service timeout | Replay automatically after a delay |
| Permanent | Invalid JSON, missing required field | Fix the data and replay by hand |
| Poison message | Crashes the consumer that reads it | Quarantine and investigate before any replay |

Replay comes in three shapes. An operator can review and replay messages individually, which suits permanent failures that need a data fix. A scheduled retry replays everything after a delay, which suits an outage that has since ended. Selective replay filters by error type and replays only what is now fixable.

**Example**: A payment service is briefly unavailable, so order messages exhaust their retries and land in the dead letter queue carrying enough context to replay them later.

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
                "first_failed": "2026-01-15T10:30:00Z"
              }
```

**Trade-offs**: A dead letter queue converts a lost message into an operational task, which only helps if someone owns that task. Replay also has to be safe to run twice, since a message usually arrives there after several delivery attempts that may each have done partial work.

<div class="callout callout--warning">
<p class="callout__title">DLQ Monitoring</p>
<p>Alert on dead letter queue depth, not just on individual failures. A queue that grows steadily usually means something systemic, such as a downstream service that is down or a schema change that broke every consumer at once.</p>
</div>

---

## Priority Queue

Serves messages by priority rather than arrival order, so a message that matters more is processed before one that arrived earlier and matters less.

**How it works**:

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

**Use when**:
- Message types carry genuinely different urgency, such as a payment failure against an analytics event
- Critical work would otherwise queue behind bulk processing
- Different message types are held to different service level targets

| Approach | How it works | Trade-off |
|----------|--------------|-----------|
| Separate queues | One queue per priority level | Simple, but the producer or a router has to decide which queue |
| Priority field | One queue, ordered by a priority attribute | Broker support varies, and ordering within a priority can shift |
| Weighted fair queuing | Serve N high-priority messages for every low-priority one | More to configure, but low priority can't starve |

**Starvation**: Strict priority ordering serves low-priority messages only when every higher queue is empty, so if high-priority traffic never stops they are never served at all. Weighted fair queuing reserves a share of throughput for the lower levels, so a 3:1 ratio serves `HIGH, HIGH, HIGH, LOW, HIGH, HIGH, HIGH, LOW` and keeps the low queue moving regardless of the load above it.

**Example**: An e-commerce pipeline sorting work by business impact rather than by which system produced it.

```
P1 (Critical): Payment failures, fraud alerts
P2 (High):     Order confirmations, shipping updates
P3 (Normal):   Inventory sync, analytics events
P4 (Low):      Marketing emails, recommendation updates
```

**Trade-offs**: Priority levels are a taxonomy someone has to maintain, and they drift upward, because every producer believes its own messages are urgent. Without a fairness rule, strict priority is also a denial of service the system inflicts on itself under sustained load.

<div class="callout callout--tip">
<p class="callout__title">Priority Assignment</p>
<p>Assign priority by business impact, not by technical convenience. A background job that affects revenue, such as inventory sync, may deserve higher priority than a user-facing feature like a recommendation refresh that nobody is waiting on.</p>
</div>

---

## Content-Based Router

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003)*

Examines a message and sends it to a destination chosen from its content, rather than along a path fixed when the message was produced.

**Use when**:
- The destination depends on what is in the message rather than on who sent it
- Routing rules change more often than the producers or consumers do
- Different message types need different processing paths through the same pipeline

**Example**: An order pipeline that sends high-value orders for manual review, international orders through compliance, and everything else straight to standard processing.

```
Order → Content Router → {
  if order.value > 10000   → Manual Review Queue
  if order.country != "US" → Compliance Queue
  else                     → Standard Processing Queue
}
```

**Trade-offs**: The router has to understand the message schema to route on it, which couples it to every producer whose format it reads, and a schema change upstream can silently misroute. Rules also need a default destination, because a message matching nothing disappears unless something catches it.

---

## Message Translator

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003)*

Converts a message from the format one system produces into the format another expects, so neither has to know about the other's representation.

**Use when**:
- Two systems that must communicate model the same data differently
- A legacy system's format can't change but the systems around it have moved on
- A format change needs absorbing in one place rather than across every consumer

**Example**: Bridging a modern REST client to a legacy SOAP service by translating JSON to XML on the way in and back on the way out.

```
Client → JSON Request → Translator → XML Request → SOAP Service
SOAP Service → XML Response → Translator → JSON Response → Client
```

**Trade-offs**: A translator hides format differences from both sides, which is the point, but it also becomes the single place every schema change on either side lands. Translation that drops information is one-way, so a field with no counterpart in the target format is gone and a round trip doesn't return the message you started with.

---

## Quick Reference

| Pattern | Reach for it when | Trade-off |
|---------|-------------------|-----------|
| **Transactional Outbox** | A message must be published exactly when the data it describes commits | Extra table to maintain, and consumers see the event after a relay delay |
| **Transactional Inbox** | The broker delivers at least once and reprocessing would do damage | Extra table and a uniqueness check on every message |
| **Claim Check** | The payload is too large for the broker, or slows it down | An extra round trip, storage costs, and orphans to clean up |
| **Dead Letter Queue** | Failed messages must survive without blocking the queue behind them | Someone has to own reviewing and replaying what lands there |
| **Priority Queue** | Message types carry genuinely different urgency | Low-priority work starves without a fairness rule |
| **Content-Based Router** | The destination depends on what is in the message | Routing rules to maintain, coupled to producer schemas |
| **Message Translator** | Two systems that must talk use different formats | Mapping logic to maintain, and lossy translation is one-way |
