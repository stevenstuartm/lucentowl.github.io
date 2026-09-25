---
title: "Amazon SQS and SNS for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "How SQS queues and SNS topics carry messages between services: the message lifecycle and visibility timeout, standard versus FIFO queues and topics, dead-letter queues and redrive, fanout from SNS to SQS, subscription filtering, security, monitoring, and cost."
tags: [sqs, sns, fifo, dead-letter-queues, fanout, messaging, fundamentals]
---

## Queues and Topics

When one service calls another directly, both have to be up, fast, and sized for the same load at the same moment. Putting a message service between them removes that coupling. The sender hands over a message and moves on, and the receiver processes it when it can. If the receiver is down or slow, messages wait instead of failing, and a burst of traffic becomes a backlog that drains at the receiver's own pace.

AWS offers two basic building blocks for this, and they deliver messages in opposite ways:

| | SQS queue | SNS topic |
|---|---|---|
| **Who gets a message** | One consumer. Many consumers can read the same queue, but each message goes to only one of them. | Every subscription gets its own copy. |
| **How it's delivered** | Consumers pull. They ask the queue for messages when they're ready. | SNS pushes to each subscriber as soon as a message is published. |
| **Storage** | Messages wait in the queue until a consumer deletes them, for up to 14 days. | A standard topic keeps nothing for later. SNS retries a failed delivery, then drops the message unless a dead-letter queue catches it. |
| **Typical use** | A work queue, where workers share the load | Broadcasting one event to several independent consumers |

The two are often combined. SNS copies a message into several SQS queues, and each queue gives its consumer durable storage and its own pace (see Fanout below).

Both are Regional services. A queue or topic lives in one Region of one account, and its quotas are per account per Region. Senders and receivers reach them through a public HTTPS API, or privately through an interface VPC endpoint.

---

## How an SQS Queue Delivers a Message

A message's life in a queue follows a fixed cycle:

1. A producer calls `SendMessage`. The message is stored redundantly across several Availability Zones and becomes **visible**, unless a delay of up to 15 minutes holds it back first.
2. A consumer calls `ReceiveMessage`. SQS returns the message and hides it from every other consumer for the **visibility timeout**, 30 seconds by default and up to 12 hours. Each receive adds one to the message's **receive count**.
3. If the consumer finishes, it calls `DeleteMessage` and the message is gone. If the visibility timeout runs out first, because the consumer crashed, hung, or was simply slow, the message becomes visible again and another consumer receives it.

A consumer that needs more time can extend the timeout for a message it's working on with `ChangeMessageVisibility`.

{% include figure.html id="aws-sqs-message-lifecycle" %}

This cycle is how SQS guarantees that a message is eventually processed without knowing anything about the consumer. It also means a message can be processed twice. When a slow consumer runs past the timeout, a second consumer receives the same message while the first is still working on it. Set the visibility timeout longer than the work takes, and make consumers **idempotent**, so that processing a message twice has the same effect as processing it once. The usual technique is to record a unique ID from each message once it's handled, and skip any message whose ID is already recorded.

A few limits shape how queues are used:

- A message can be up to **1 MiB**. Larger payloads go in S3, with the message carrying a reference, which the SQS Extended Client Library for Java and Python does automatically.
- Messages are kept for **4 days** by default, and anywhere from 1 minute to 14 days. A message still in the queue when its retention period ends is deleted, processed or not.
- A queue can hold an unlimited number of messages, but only about **120,000 in flight**, meaning received and not yet deleted.
- Batch calls send, receive, or delete up to **10 messages** in one request.

**Long polling** is the other setting every queue should have. By default, `ReceiveMessage` returns immediately, even when the queue is empty, and each of those empty responses is a billed request. With long polling, the call waits up to 20 seconds for a message to arrive before returning. Set it on the queue (`ReceiveMessageWaitTimeSeconds` of 20) or on each receive call. It cuts the number of empty receives and the cost of an idle consumer, at no cost in latency, because the call returns as soon as a message arrives.

When Lambda consumes a queue, Lambda runs the receive loop itself through an event source mapping. It receives messages in batches, invokes the function, and deletes the messages the function handled. The queue settings above still apply. AWS recommends a visibility timeout of at least six times the function's timeout, so a batch that Lambda retries after throttling doesn't reappear while it's still being processed.

---

## Standard and FIFO Queues

A queue is one of two types, chosen when it's created and fixed after that.

| | Standard | FIFO |
|---|---|---|
| **Order** | Best effort. Messages can arrive out of order. | Strict order within each message group |
| **Duplicates** | At-least-once delivery. A message is occasionally delivered more than once. | Exactly-once processing. Duplicates sent within 5 minutes are dropped. |
| **Throughput** | Nearly unlimited | 300 calls per second per API action, or 3,000 messages with batches of 10. High throughput mode raises this (see below). |
| **Price per million requests** (us-east-1) | $0.40 | $0.50 |
| **Name** | Any | Must end in `.fifo` |

**Standard queues** fit most work, such as resizing images, sending emails, or processing independent jobs. The consumer has to be idempotent anyway, because of the visibility timeout, so an occasional duplicate costs nothing more.

**FIFO queues** fit work where order matters for each entity, such as applying updates to an account in the order they happened. Every message carries a **message group ID**, and order is kept only within a group. SQS won't hand out the next message in a group until the one before it is deleted, so each group is processed one message at a time, while different groups are processed in parallel. Choose the group ID so that the things that must stay ordered share it, such as an account ID. One group for the whole queue makes the queue strictly serial and caps it at one consumer's speed.

**High throughput mode**, a setting on a FIFO queue, spreads message groups across partitions so that throughput grows with the number of groups, up to 70,000 calls per second per API action (700,000 messages with batching) in the largest Regions and less elsewhere. It helps only when the traffic is spread over many message groups, since each group is still delivered in order, one message at a time.

FIFO queues remove duplicates using a **deduplication ID**. The producer can set one on each message, or turn on content-based deduplication so that SQS uses a hash of the message body. A second message with the same ID within 5 minutes is accepted and then discarded. That covers a producer retrying a send after a timeout. It doesn't cover a consumer that performs a side effect and then fails before deleting the message, so consumers still need to be idempotent.

### Fair Queues for Shared Queues

A standard queue shared by many tenants has a problem FIFO ordering doesn't address. One tenant that sends a flood of messages, or messages that are slow to process, fills the consumers' capacity, and every other tenant's messages wait behind it. **Fair queues** (since July 2025) fix this on standard queues. Producers set a message group ID naming the tenant, and when one tenant holds a disproportionate share of the in-flight messages, because it sends a flood or its messages are slow to process, SQS delivers the other tenants' messages first. On a standard queue the group ID doesn't impose any ordering, and consumers need no changes. Messages with a group ID on a standard queue are billed at a slightly higher fair-queue rate.

---

## Dead-Letter Queues

A message that fails every time it's processed, because it's malformed or triggers a bug, is called a **poison message**. Without a limit, it cycles through the queue until its retention period ends, using consumer capacity on each pass. A **dead-letter queue** (DLQ) is an ordinary queue that takes such messages out of circulation.

A **redrive policy** on the source queue names the DLQ and sets `maxReceiveCount`. Once a message has been received more times than `maxReceiveCount` allows, SQS moves it to the DLQ instead of delivering it again. Set it high enough that a message survives a brief outage in something it depends on. A value of 1 sends a message to the DLQ after one failed attempt. On a standard queue whose `maxReceiveCount` is above 3, SQS also moves a message that has been received three times without being deleted to the back of the queue, so it stops holding up newer messages.

The DLQ must be in the same account and Region as its source queue, and of the same type, so a FIFO queue's DLQ is a FIFO queue. A FIFO queue with a DLQ doesn't keep strict order, because the failed message leaves the sequence while the messages behind it continue. Where the order of every message matters, as with a sequence of edits, leave the DLQ off.

Retention needs care. On a standard queue, a message keeps its original enqueue time when it moves to the DLQ, so a message that spent 3 days in a source queue has only 1 day left in a DLQ with the default 4-day retention. Set the DLQ's retention longer than the source queue's, usually the 14-day maximum. FIFO queues reset the enqueue time on the move.

Once the cause is fixed, **DLQ redrive** moves messages back to their source queue, or to another queue of the same type, at a speed you can cap. Redriven messages arrive as new messages, with new IDs and a fresh retention period. Alarm on every DLQ's depth (see Monitoring a Queue below), since a DLQ that fills silently is where failures go to be forgotten.

---

## SNS Topics

A producer publishes a message to a **topic**, and SNS delivers a copy to every **subscription**. A subscription names an endpoint:

- SQS queues, Lambda functions, and Amazon Data Firehose streams inside AWS
- HTTP and HTTPS endpoints
- Email, SMS text messages, and mobile push notifications for people

A standard topic can have up to 12.5 million subscriptions. Like a standard queue, it delivers at least once and in best-effort order, so a subscriber can receive a message twice or out of order and needs to be idempotent too. SNS doesn't store a standard topic's messages for later reads, and a subscriber that's down when a message is published only gets it through retries. How long SNS retries depends on the endpoint:

| Endpoint | Retries |
|---|---|
| **SQS, Lambda, Firehose** | 100,015 attempts over 23 days |
| **Email, SMS, mobile push** | 50 attempts over 6 hours |
| **HTTP and HTTPS** | 3 retries 20 seconds apart by default, about a minute. A custom delivery policy sets the count, the backoff, and a delivery rate limit, with at most an hour of retrying in total. |

After the last attempt, the message is dropped unless the subscription has its own dead-letter queue, an SQS queue in the same account and Region that receives messages SNS couldn't deliver. A FIFO topic's subscriptions need FIFO DLQs. Errors that can't succeed on retry, like a deleted endpoint or missing permissions, skip the retries and go straight to that DLQ.

Messages can be up to 256 KiB by default. Since September 2026, a topic's `MaximumMessageSize` setting raises that to as much as 1 MiB, but a topic above 256 KiB can only deliver to SQS, Lambda, and Firehose, and can have at most 100 subscriptions.

By default, SNS wraps each message in a JSON envelope with metadata such as the topic ARN and a signature. **Raw message delivery** on an SQS, Firehose, or HTTP subscription sends the original body instead, which saves consumers from unwrapping it.

### FIFO Topics

A **FIFO topic** keeps messages in order within a message group and drops duplicates within 5 minutes, like a FIFO queue. It can deliver only to SQS queues, either FIFO or standard. A standard queue on a FIFO topic gets messages without the ordering guarantee, which suits a consumer like an audit log that doesn't need it. Lambda functions receive a FIFO topic's messages through a queue. A FIFO topic allows 100 subscriptions, 300 messages per second per message group, and by default 3,000 messages or 20 MB per second per topic. FIFO topics can also **archive** messages for up to a year and **replay** them to a subscription, which lets a new or repaired subscriber catch up on past messages.

---

## Fanout: SNS in Front of SQS

When one event has to reach several independent consumers, such as an order that fulfillment, inventory, and email each need to hear about, the robust pattern is a topic with one SQS queue subscribed per consumer. The producer publishes once and knows nothing about who's listening. Each consumer gets its own queue, so it keeps messages while it's down, processes at its own pace, retries its own failures, and has its own DLQ, and a failing email service doesn't hold up fulfillment. Adding a consumer means subscribing one more queue, without changing the producer.

Subscribing Lambda functions or HTTP endpoints directly to the topic is simpler but gives up that buffering. A subscriber that's down relies on SNS's retries, and one that's slow has no backlog to work through.

{% include figure.html id="aws-sns-sqs-fanout" %}

Two permissions make fanout work. The queue's access policy needs a statement that lets SNS send to it, scoped to the one topic:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "sns.amazonaws.com" },
  "Action": "sqs:SendMessage",
  "Resource": "arn:aws:sqs:us-east-1:111122223333:fulfillment",
  "Condition": {
    "ArnEquals": { "aws:SourceArn": "arn:aws:sns:us-east-1:111122223333:order-placed" }
  }
}
```

And if the queue is encrypted with a KMS key, the key's policy must let SNS use it. The **AWS managed key** for SQS (`alias/aws/sqs`), which AWS creates in each account, has a key policy nobody can edit, so SNS can't deliver to a queue encrypted with it. Use SQS-managed encryption or a **customer managed key**, one you create and whose policy you control.

---

## Filtering Messages per Subscription

Without filtering, every subscriber gets every message and discards the ones it doesn't want, paying for each one. A **filter policy** on a subscription tells SNS which messages to deliver there. SNS evaluates it before delivery, and messages that don't match are never sent.

A filter policy matches either the message's **attributes**, name-value pairs the publisher sets alongside the body, or its **body**, if the body is JSON. The subscription's `FilterPolicyScope` chooses which. This policy on the expedited-shipping queue delivers only expedited orders over $100:

```json
{
  "orderType": ["Expedited"],
  "amount": [{ "numeric": [">", 100] }]
}
```

Conditions on different keys must all match, and a list of values for one key matches any of them. Policies can also match on prefixes and suffixes, ignore case, check whether a key exists, exclude values with `anything-but`, and match IP address ranges. A topic can have 200 filter policies, and an account 10,000.

The two scopes cost differently. Attribute filtering is free, and body filtering costs $0.09 per GB of payload scanned. Body filtering saves the publisher from copying fields into attributes, but attribute filtering is cheaper at volume.

---

## Security

Access to queues and topics has two layers:

- **IAM policies** on the producers' and consumers' roles grant actions like `sqs:SendMessage`, `sqs:ReceiveMessage` and `sqs:DeleteMessage`, or `sns:Publish`, each on specific queue or topic ARNs.
- **Resource policies** on the queue or topic decide who else may use it, such as SNS sending to a queue, or another account publishing to a topic. Cross-account access needs the resource policy.

**Encryption at rest.** New SQS queues are encrypted by default with SQS-managed keys (SSE-SQS) since October 2022, at no charge. SSE-KMS uses a KMS key instead, for control over the key and an audit trail of its use in CloudTrail. It adds KMS request charges, which the data key reuse period controls. SQS caches each data key for 5 minutes by default and up to 24 hours, calling KMS again only when it expires. SNS stores messages with disk encryption by default. Server-side encryption with a KMS key encrypts each message itself and adds the same key control and audit trail. Either way, only the message body is encrypted, not message attributes, so keep sensitive values out of the attributes used for filtering.

**Encryption in transit.** Both services accept HTTPS. A resource policy that denies requests where `aws:SecureTransport` is false rules out plain HTTP.

**Private access.** Interface VPC endpoints let workloads in private subnets reach SQS and SNS without a NAT gateway, and an endpoint policy or an `aws:SourceVpce` condition in the resource policy can restrict a queue to callers inside the VPC. A policy that denies every action from outside the VPC also blocks DLQ redrive, which SQS performs from outside the VPC, so it needs an exception for requests made by AWS services (the `aws:ViaAWSService` or `aws:CalledViaLast` condition keys). Test SNS deliveries against the same policy before relying on it.

---

## Monitoring a Queue

A few CloudWatch metrics tell most of the story:

| Metric | What it shows |
|---|---|
| `ApproximateAgeOfOldestMessage` | How far behind the consumers are. The clearest single signal that processing is stuck or too slow |
| `ApproximateNumberOfMessagesVisible` | The backlog waiting to be received. Divided by the number of consumers, it's a good target for scaling them. |
| `ApproximateNumberOfMessagesNotVisible` | Messages in flight, near the 120,000 limit on a busy queue |
| `ApproximateNumberOfNoisyGroups` | On a fair queue, how many tenants SQS is currently treating as noisy |
| `NumberOfEmptyReceives` | Receives that found nothing. A high rate is a sign of short polling. |
| DLQ `ApproximateNumberOfMessagesVisible` | Messages that exhausted their retries. Alarm on anything above zero. |
| SNS `NumberOfNotificationsRedrivenToDlq` | Messages a subscription gave up on and moved to its DLQ. (`NumberOfNotificationsFailed` counts every failed attempt for HTTP endpoints, so it overstates their failures.) |

---

## Where the Money Goes

Both services bill per request, and SQS counts every API call as one, including sends, receives (even empty ones), deletes, and visibility changes. The first million SQS requests each month are free.

| Charge (us-east-1) | Price |
|---|---|
| SQS standard queue requests | $0.40 per million |
| SQS FIFO queue requests | $0.50 per million |
| SNS publishes | $0.50 per million |
| SNS deliveries to SQS and Lambda | No charge |
| SNS deliveries to HTTP and HTTPS | $0.60 per million |
| SNS body-based filtering | $0.09 per GB scanned |

Each 64 KB of a message's payload counts as a separate request, so a 1 MiB message is billed as 16. Three habits keep the SQS bill small. Batch sends, receives, and deletes, since a batch of up to ten messages is one request. Receiving and deleting a million messages one at a time takes 2 million requests ($0.80), and in batches of ten it takes 200,000 ($0.08). Turn on long polling, so idle consumers don't pay for empty receives. And keep messages small, putting large payloads in S3.

---

## Key Takeaways

- A queue gives each message to one consumer, who pulls it when ready. A topic pushes a copy to every subscriber, and a standard topic keeps nothing. SNS in front of SQS combines them, one queue per consumer.
- A received message is hidden for the visibility timeout and reappears unless the consumer deletes it. Set the timeout longer than the work, and make every consumer idempotent, because messages can be processed twice.
- Use standard queues unless order within a key matters. FIFO keeps order per message group and drops duplicates within 5 minutes, at lower throughput and a 25% higher price. Fair queues protect tenants sharing a standard queue.
- Give every queue a dead-letter queue with a longer retention period, unless it's a FIFO queue whose strict order must never break. Alarm on DLQ depth, and redrive once the cause is fixed.
- SNS retries SQS and Lambda for 23 days, email and SMS for 6 hours, and HTTP endpoints for about a minute by default, then drops the message unless the subscription has a DLQ.
- Filter policies deliver each subscriber only what it needs. Attribute filtering is free, and body filtering is billed per GB.
- Batch requests, turn on long polling, and keep payloads small, since every request and every 64 KB is billed.
