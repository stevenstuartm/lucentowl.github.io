---
title: "Amazon EventBridge for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "How EventBridge routes events by their content: events and patterns, Classic event buses with rules and targets, the Custom Event Bus with subscribers, retention, and ordering, cross-account routing, choosing EventBridge or SNS, Pipes, Scheduler, schemas, security, and cost."
tags: [eventbridge, event-bus, eventbridge-pipes, eventbridge-scheduler, event-driven, schema-registry, fundamentals]
---

## What EventBridge Does

**Amazon EventBridge** routes **events**, JSON records saying that something happened, from the services that produce them to the services that care. A producer publishes "order placed" without knowing who's listening. Consumers declare which events they want by describing their content, and EventBridge delivers each matching event to them. Adding a consumer changes nothing in the producer.

EventBridge is several related services under one name:

| Service | What it does |
|---|---|
| **Event buses** | Receive events and route each one to every consumer whose filter matches it. There are two kinds, covered below. |
| **Pipes** | Connect one source, such as a queue or stream, to one target, with filtering and enrichment between them |
| **Scheduler** | Invokes a target at a time, on a rate, or on a cron schedule |
| **Schema registry** | Records the structure of the events on a bus, and generates code for them |

Everything in EventBridge is Regional. A bus, pipe, or schedule lives in one Region of one account, and quotas are per account per Region.

---

## Events and Patterns

Every event on a bus has the same envelope. The producer sets `source`, `detail-type`, and `detail`, and EventBridge fills in the rest.

```json
{
  "version": "0",
  "id": "6a7e8feb-b491-4cf7-a9f1-bf3703467718",
  "source": "com.example.orders",
  "detail-type": "Order Placed",
  "account": "111122223333",
  "time": "2026-09-25T12:00:00Z",
  "region": "us-east-1",
  "resources": [],
  "detail": {
    "orderId": "12345",
    "amount": 150.00,
    "shipping": "Expedited"
  }
}
```

AWS services publish their own events in this format, such as an EC2 instance changing state, an object arriving in S3, or a CloudFormation stack finishing. An event can be up to 1 MB, raised from 256 KB in January 2026.

Consumers select events with an **event pattern**, a JSON document with the same shape as the events it matches. This pattern matches expedited orders over $100:

```json
{
  "source": ["com.example.orders"],
  "detail-type": ["Order Placed"],
  "detail": {
    "shipping": ["Expedited"],
    "amount": [{ "numeric": [">", 100] }]
  }
}
```

Every field in the pattern must match, and a list of values matches any one of them. Patterns can also match prefixes, suffixes, and wildcards, ignore case, test whether a field exists, exclude values with `anything-but`, match IP ranges, and combine alternatives with `$or`. Because patterns can test any field in `detail`, routing depends on what an event says rather than on labels the producer had to attach.

---

## Classic Event Buses: Rules and Targets

Until September 2026, every EventBridge bus worked this way. The console now calls a custom bus of this kind a **Custom Event Bus - Classic**. Three kinds exist:

- The **default bus**, one per account per Region, receives events from AWS services. Ingesting them costs nothing.
- **Custom buses** receive your applications' events, published with the `PutEvents` API in batches of up to 10.
- **Partner buses** receive events from SaaS partners such as Zendesk, Datadog, or Auth0, set up from the partner's side.

On any of them, a **rule** pairs one event pattern with up to **five targets**. A bus can have 300 rules by default. When an event matches a rule, EventBridge sends it to every target of that rule in parallel.

**Targets** span most of AWS: Lambda functions, SQS queues, SNS topics, Kinesis and Firehose streams, Step Functions state machines, ECS tasks, API Gateway, CloudWatch Logs, another event bus, and more. EventBridge calls a target with a resource policy on the target (Lambda, SQS, SNS) or with an IAM role you give the rule. An **input transformer** on a target can reshape the event first, pulling out fields and placing them into a template, so a target that expects its own format doesn't need a Lambda function in between.

**API destinations** make any HTTPS endpoint a target. A **connection** holds the endpoint's credentials (an API key, basic authentication, or OAuth client credentials), and EventBridge stores them in AWS Secrets Manager. Each destination has a rate limit, 300 calls per second by default, and EventBridge queues calls above it rather than overwhelming the endpoint. A private connection reaches an endpoint inside a VPC or on premises.

### Delivery and Failures

Classic buses deliver **at least once**, so a target can occasionally receive an event twice, and they don't preserve order. Targets need to be **idempotent**, meaning that handling the same event twice has the same effect as handling it once, for example by recording each event's `id` and skipping ones already seen. When a delivery fails with an error that might succeed later, EventBridge retries with growing, randomized delays between attempts, for 24 hours and up to 185 attempts by default. A shorter retry policy can be set per target. After the last attempt, the event is dropped unless the target has a **dead-letter queue**, an SQS queue that receives the event along with the error. Give every important target one, and alarm on it.

Two quotas govern throughput. `PutEvents` accepts 10,000 requests per second in us-east-1, us-west-2, and eu-west-1, and as few as 400 in smaller Regions. Deliveries to targets are limited to 18,750 per second in the largest Regions, and deliveries above that are delayed, not dropped. Both can be raised. Latency from publishing to the first delivery attempt was about 130 milliseconds at p99 in August 2024.

### Archives and Replay

A Classic bus doesn't keep events after delivering them. An **archive** on the bus stores the events that match a pattern, for a set period or indefinitely, and a **replay** sends archived events from a time range back through the bus's rules. Replay is how a fixed consumer reprocesses the events it mishandled.

### Across Accounts and Regions

Organizations with many accounts usually send events across them. A Classic bus supports three ways to do this:

- A **bus policy** lets other accounts, or a whole AWS Organization, publish to the bus.
- A rule can target a **bus in another account or Region**, forwarding events to rules that the other account owns.
- Since January 2025, a rule can deliver **directly to a target in another account**, such as an SQS queue, Lambda function, SNS topic, Kinesis stream, or API Gateway API, as long as the target's resource policy allows the rule's IAM role.

In each case, someone writes a rule for every consumer, either in the central account or in each account a central bus forwards to. **Global endpoints** add Regional failover for Classic custom buses, sending published events to a bus in a second Region when a health check fails.

---

## The Custom Event Bus

In September 2026, EventBridge launched a second kind of custom bus, called the **Custom Event Bus**, built around a different idea. The bus keeps every event for a retention period of 1 to 365 days (1 day if you don't set one), and each consumer attaches its own **subscriber**. A subscriber holds its filters, one target, a retry policy (5 attempts within 300 seconds by default), and an SQS dead-letter queue. Sending events to three targets takes three subscribers. Targets include SQS, Lambda, SNS, Kinesis, Firehose, Step Functions, HTTP endpoints, other buses, and universal targets that call any state-changing AWS API action directly. At launch the bus is available in 14 Regions, and Classic buses keep working unchanged alongside it.

AWS service and SaaS partner events reach a Custom Event Bus through an **event source**, a resource that names the origin and the destination bus, so the new bus isn't limited to your own applications' events.

Retention changes what consumers can do:

- A new subscriber can **start from a point in the past**, reading retained events before catching up to live ones. A new analytics service can read the last month of orders on its first day.
- A subscriber can **pause and resume** without losing events, which is also how a consumer replays events after fixing a bug.

It adds ordering and deduplication, which Classic buses don't have. A producer can tag events with an **event group ID**, such as an account number, and a subscriber of type `FIFO` delivers each group's events in the order they were published, while other groups continue in parallel. An event that can't be delivered holds up the later events in its group, so a FIFO subscriber needs an alarm on its backlog (see Monitoring). A producer can also ask the bus to drop duplicates published within 5 minutes, matched on a key the producer supplies or on a hash of the content. With both, each accepted event reaches a FIFO subscriber once and in order. Beyond the 5-minute window, a repeated publish is a new event, so consumers still need to be idempotent. Groups and deduplication are both scoped to the publishing account, so two accounts publishing to a shared bus with the same group ID create two separate groups, with no order between them.

The bus is built to be shared. The owning account shares it through **AWS Resource Access Manager**, granting other accounts permission to publish, to subscribe, to attach event sources, or all three. Each consuming account then creates and owns its subscribers on the shared bus, and the bus owner writes no routing for them.

{% include figure.html id="aws-eventbridge-bus-ownership" %}

Other differences matter at scale. A Custom Event Bus accepts up to 500,000 events per second, and `PutRawEvents` publishes Avro and Protobuf (compact binary formats defined by a schema) or raw bytes as well as JSON. Its billing is by volume rather than by event count (see Where the Money Goes). Each account can create 5 buses per Region by default.

**Which bus to use.** AWS recommends the Custom Event Bus for new applications, and it fits best for an event backbone shared across teams and accounts, or any consumer that needs ordering, deduplication, or replay. Classic buses remain the choice in Regions the new bus doesn't reach yet, for rules on the default bus that react to AWS service events within one account, and for existing applications, which have no reason to move until they need one of those capabilities. AWS publishes a migration guide from rules to subscribers.

---

## EventBridge or SNS

Both route one message to many consumers, and each fits a different kind of work:

| | EventBridge | SNS |
|---|---|---|
| **Built for** | Routing events between services, by content | Fast, high-volume fanout, including to people |
| **Sources** | Your applications, a structured stream of events from AWS services, and SaaS partners | Your applications, and notifications from AWS services such as CloudWatch alarms and S3 |
| **Targets** | Most AWS services, any HTTPS API, other buses | SQS, Lambda, Firehose, HTTPS, email, SMS, and mobile push |
| **Filtering** | Patterns on any field of the event | Filter policies on attributes or on the body |
| **Transformation** | Built in, per target | None |
| **Replay** | Archives on Classic buses; retention on the Custom Event Bus | FIFO topics only |
| **Ordering** | FIFO subscribers on the Custom Event Bus | FIFO topics |
| **Throughput** | 10,000 `PutEvents` requests per second in the largest Regions (Classic), 500,000 events per second per Custom Event Bus | 30,000 publishes per second in us-east-1 |
| **Price for 1 million 1 KB events delivered to one consumer** | $1.00 on a Classic bus. About $0.23 on a Custom Event Bus ($0.18 in, $0.05 out) | $0.50, with no charge to deliver to SQS or Lambda |

Choose **EventBridge** when consumers react to AWS service events or SaaS partner events, when consumers need to select events by their content, when targets are services other than queues and functions, or when events need replaying. Choose **SNS** for plain fanout at the lowest cost and highest rate, and for notifications to people by email, SMS, or mobile push. The two combine well. A rule can target an SNS topic to reach people, and either one can deliver to SQS queues that give each consumer a buffer.

Services reacting to each other's events with no coordinator is called choreography. A process that needs a defined sequence of steps, with compensation when one fails, usually belongs in a workflow engine such as Step Functions instead.

---

## Pipes

A **pipe** connects one source to one target, with optional steps between them:

1. The **source** is something that has to be polled, such as an SQS queue, a Kinesis or DynamoDB stream, an Amazon MSK or self-managed Kafka topic, or an Amazon MQ broker.
2. A **filter** drops records that don't match a pattern. Filtered-out records aren't charged.
3. An **enrichment** step calls a Lambda function, Step Functions Express workflow, API Gateway API, or API destination to add data, such as looking up a customer's details for an order.
4. The **target** receives the result, with the same range of targets as a bus.

Pipes replace the small Lambda functions that used to sit between a queue or stream and a service, reading records, filtering them, and passing them on. A pipe needs no code for that, preserves the order of records within a batch through enrichment, and costs $0.40 per million records that pass the filter. A pipe is point to point. Use a bus when one source has many consumers, and a pipe can feed a bus when both are needed.

---

## Scheduler

**EventBridge Scheduler** invokes a target on a schedule:

- **One-time** schedules run once at a date and time, such as a reminder 30 days after sign-up.
- **Rate** schedules run at a fixed interval, such as every 15 minutes.
- **Cron** schedules run at calendar times, such as 9:00 every weekday, in any time zone, with daylight saving time handled.

A **flexible time window** lets Scheduler run a schedule at any point within a window, which spreads load when many schedules would otherwise fire at the same moment. Beyond templated targets like Lambda, SQS, SNS, and Step Functions, a **universal target** calls one of more than 6,000 API operations across more than 270 AWS services directly, such as stopping an EC2 instance at night. Delivery is at least once, with a retry policy and a dead-letter queue per schedule.

Scheduler is built for millions of schedules, which suits per-user or per-order timers. Classic rules can also run on a schedule instead of an event pattern, but AWS now treats these **scheduled rules** as legacy and recommends Scheduler in their place. The first 14 million invocations each month are free, then $1.00 per million.

---

## Schema Registry

A **schema registry** stores the structure of events. Every AWS service event has a schema in the built-in registry. **Schema discovery**, turned on for a bus, samples the events passing through and records a schema for each event type, adding a new version when the structure changes. From a schema, the registry generates **code bindings** in languages such as Java, Python, and TypeScript, so consumers work with typed objects instead of raw JSON. Discovery is free for the first 5 million events a month, then billed per event ingested.

A registry describes events. It doesn't reject events that don't match, so a producer that changes a field's type still breaks its consumers. Treat event structures as a published contract. Add fields freely, and version the `detail-type` or publish a new event type for changes that remove or retype fields.

---

## Security

- **Who can publish.** IAM policies grant `events:PutEvents` on specific buses. A Classic bus's resource policy lets other accounts publish, and a Custom Event Bus uses its RAM share.
- **Who EventBridge acts as.** A rule, subscriber, pipe, or schedule invokes its target either through the target's resource policy or through an IAM role that EventBridge assumes. Give each its own role, scoped to its one target.
- **Encryption.** Events are encrypted at rest with an AWS owned key by default. Since May 2024, a bus can use a customer managed KMS key instead, for control over the key and an audit trail in CloudTrail. On a Classic bus, events from AWS services are still encrypted with an AWS owned key, even when the bus has a customer managed key.
- **Credentials for HTTP targets** live in Secrets Manager through connections, never in rules or code.

---

## Monitoring

On a Classic bus, a few CloudWatch metrics per rule cover most problems:

| Metric | What it shows |
|---|---|
| `FailedInvocations` | Deliveries that failed permanently |
| `DeadLetterInvocations` | Events sent to a dead-letter queue. Alarm on anything above zero. |
| `ThrottledRules` | Rules delayed by the invocation quota |
| `IngestionToInvocationStartLatency` | How long events take to reach their first delivery attempt |

A Custom Event Bus reports per-subscriber metrics in the `AWS/EventsV2` namespace. Alarm on `EventsDropped` (events that exhausted retries with no dead-letter queue) and `OnFailureDestinationDelivered` (events sent to the dead-letter queue), and on `ApproximateBacklogAge`, the age of the oldest event the subscriber hasn't delivered, which is how a stuck FIFO group shows up. Subscribers can also log every delivery attempt, off by default.

A rule or filter that matches nothing produces no errors at all, so a pattern with a typo fails silently. Test patterns against sample events before deploying them, with the `TestEventPattern` API or the console's sandbox.

---

## Where the Money Goes

| Charge (us-east-1) | Price |
|---|---|
| Custom and partner events published to a Classic bus | $1.00 per million |
| AWS service events on the default bus | No charge |
| Classic deliveries to targets in the same account | No charge |
| Classic deliveries to another account | $1.00 per million |
| Custom Event Bus ingress | $0.18 per GB for the first 5,000 GB a month, then $0.12 |
| Custom Event Bus delivery to subscribers | $0.05 per GB |
| Custom Event Bus retention beyond the included period | $0.08 per GB-month |
| Pipes | $0.40 per million records after filtering |
| API destinations | $0.20 per million calls |
| Scheduler | First 14 million invocations a month free, then $1.00 per million |
| Archiving (Classic) | $0.10 per GB processed, plus $0.023 per GB-month stored |
| Replay (Classic) | $1.00 per million events replayed |

Each 64 KB of an event counts as one event on a Classic bus, in Pipes, and for API destinations. The Custom Event Bus bills by volume instead, so small events cost less there than on a Classic bus, and a large volume of small events is where the new bus saves the most. Optional event evaluation on it, meaning content-based deduplication, transformations, and schema validation, adds $0.15 per million events when configured. Cross-Region delivery adds standard data transfer charges.

---

## Key Takeaways

- EventBridge routes events by their content, so consumers subscribe without the producer knowing about them, and AWS services and SaaS partners publish to it too.
- On a Classic bus, rules pair a pattern with up to five targets. Delivery is at least once and unordered, with 24 hours of retries by default. Put a dead-letter queue on every important target.
- The Custom Event Bus (September 2026) retains events for up to a year, lets each consumer own a subscriber on a shared bus, and adds per-group ordering and 5-minute deduplication. AWS recommends it for new applications, and it fits cross-account backbones and consumers that need replay or order.
- Choose EventBridge for content-based routing, AWS and SaaS sources, and varied targets. Choose SNS for the cheapest, fastest plain fanout and for notifications to people.
- Pipes replace glue functions between a queue or stream and a target, and Scheduler replaces cron hosts and scheduled rules, at up to millions of schedules.
- A schema registry documents events but doesn't enforce them, so treat event structures as a contract and version breaking changes.
