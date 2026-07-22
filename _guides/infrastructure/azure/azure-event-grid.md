---
title: "Azure Event Grid for System Architects"
layout: guide
category: Azure
subcategory: Application Integration & Messaging
description: "Event-driven architecture on Azure with Event Grid basic and standard tiers, topics, CloudEvents, subscription filtering, push and pull delivery, retry policy, and dead-lettering."
tags: [event-grid, cloudevents, event-subscriptions, event-domains, dead-lettering, pull-delivery, practical]
---

## What Is Azure Event Grid

[Azure Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/overview){:target="_blank" rel="noopener noreferrer"} is a fully managed, serverless event broker that routes events from sources (like Blob Storage, resource groups, or custom applications) to destinations (like Functions, webhooks, Service Bus, and Event Hubs). Unlike message queues that require polling, Event Grid pushes events to subscribers as they occur, enabling reactive, event-driven system design.

Event Grid handles event delivery with automatic retries, configurable filtering, dead-letter storage for failed events, and support for both its own proprietary schema and the [CloudEvents](https://cloudevents.io/){:target="_blank" rel="noopener noreferrer"} standard.

### Two Tiers, Two Delivery Models

Event Grid ships as two tiers with different resource models, and choosing between them is the first architectural decision. The [tier comparison](https://learn.microsoft.com/en-us/azure/event-grid/choose-right-tier){:target="_blank" rel="noopener noreferrer"} covers the full matrix.

| Capability | Basic tier | Standard tier (namespaces) |
|---|---|---|
| **Resource model** | Custom topics, system topics, partner topics, domains | Namespaces containing namespace topics |
| **Delivery** | Push only | Pull (HTTP receive/acknowledge) plus push to Event Hubs |
| **Throughput** | Up to 5 MB/s ingress and egress | Up to 40 MB/s ingress, 80 MB/s egress |
| **Event retention** | 1 day, not increasable | 7 days |
| **MQTT broker** | No | Yes (MQTT v3.1.1 and v5.0) |
| **Azure system events** | Yes | No |
| **Partner events** | Yes | No |
| **Push to Functions, Service Bus, storage queues, Relay** | Yes | No |
| **Event format** | Event Grid schema, CloudEvents, or custom | CloudEvents JSON only |
| **Private endpoint on the consume path** | No | Yes (pull delivery only) |
| **Scaling** | Automatic | Throughput units, with optional autoscale |

Most of this guide describes the basic tier, which is where Azure service events, domains, and the familiar push-to-a-handler model live. The standard tier is covered under [pull delivery](#pull-delivery-with-namespaces) and matters when you need IoT-style MQTT messaging, consumer-paced consumption, private-link ingress, or retention beyond a day.

### What Problems Event Grid Solves

**Without event routing:**
- Event producers must know about all consumers and invoke them directly (tight coupling)
- Systems scale by adding more polling logic instead of reacting to events
- Failed consumers block event processing or lose events entirely
- No built-in retry, filtering, or dead-letter handling
- Event producers carry operational responsibility for delivery guarantees

**With Event Grid:**
- Event producers emit events to a single topic; subscribers listen for events they care about (decoupling)
- Systems react to events as they occur instead of polling for status changes
- Automatic retries with exponential backoff ensure delivery without polluting application logic
- Dead-letter storage captures failed events for analysis and recovery
- Built-in filtering (by event type, subject, advanced filters) reduces unnecessary event processing
- Event Grid manages delivery guarantees and retries as a platform concern, not application code

### How Event Grid Differs from AWS EventBridge

Architects familiar with AWS should note several similarities and important differences:

| Concept | AWS EventBridge | Azure Event Grid |
|---------|-----------------|------------------|
| **Core model** | Event bus + rules for event routing and transformation | Topics with subscriptions for event routing with filtering at subscription level |
| **Event sources** | AWS services, partner event sources, custom applications | Azure services (system topics), custom applications (custom topics), partner sources |
| **Event transformation** | Rules can transform events with input transformers | No payload transformation; you choose an output schema, not a shape |
| **Filtering** | Rules match on event pattern and detail | Subscriptions filter by event type, subject, and advanced filters (key-value matching) |
| **Event schema** | EventBridge detail format (JSON) | Event Grid schema or CloudEvents standard (both JSON-based) |
| **Routing** | One rule maps to multiple targets in one account/region | One subscription to one handler with multiple subscriptions for multiple handlers |
| **Fan-out** | Native fan-out by rule design | Multiple subscriptions for fan-out |
| **Delivery retry** | Automatic, configurable | Automatic and configurable with dead-lettering built-in |
| **Ordering** | Not guaranteed | Not guaranteed, and there is no ordered-delivery option |
| **Cost model** | Per million events published | Per million operations, counted in 64 KB units |

The billing difference is easy to under-budget. Event Grid charges per *operation*, and an ingress, each delivery attempt, each advanced-filter match, and each dead-letter write all count separately. Operations are metered in 64 KB units, so a 130 KB event bills as three. A single event fanned out to five subscriptions with one retry apiece therefore costs eleven operations, not one. The first 100,000 operations per month are free, and beyond that the basic tier runs about $0.60 per million in East US.

---

## Core Event Grid Concepts

### Event Grid Topics

A topic is an endpoint where event producers publish events. Every basic-tier topic is a **regional** resource, and its quotas are per region: 100 custom topics per Azure subscription per region, 500 event subscriptions per topic, and 5,000 events or 5 MB per second of ingress. None of those numbers can be raised, so a design that outgrows them has to shard across regions or move to domains rather than file a quota request.

#### Custom Topics

Custom topics are user-created endpoints where applications publish events. You create a custom topic when you want to emit domain-specific events from your application.

**Characteristics:**
- Created and managed by the user
- Accessed via the [Event Grid Data Plane API](https://learn.microsoft.com/en-us/rest/api/eventgrid/version2024-06-01-preview/topics/publish-events){:target="_blank" rel="noopener noreferrer"}
- Events are published using the Event Grid schema, CloudEvents, or a custom input schema
- Events must always be published as an array, even a batch of one
- Charged per operation, not per topic

Custom topics do not support custom domain names. Assigning your own FQDN is a standard-tier namespace feature, and it needs a certificate in Key Vault plus a TXT-record ownership proof. Teams that want a stable endpoint across environments should account for that before standardizing on basic-tier custom topics.

#### System Topics

System topics are automatically created by Azure for specific Azure services. When you enable Event Grid on an Azure resource (like Blob Storage or a resource group), a system topic is created automatically. Only Azure services can publish to a system topic, so unlike a custom topic it has no publishing endpoint or access keys.

**Common system topic sources:**
- **Blob Storage:** blob created, deleted, renamed, tier changed
- **Resource groups and Azure subscriptions:** resource write, delete, and action outcomes
- **Key Vault:** secret, key, and certificate near-expiry and expiry
- **Container Registry:** image pushed, image deleted, chart pushed
- **Azure Kubernetes Service:** cluster support-ended and node-pool events
- **Event Hubs:** Capture file created
- **Service Bus:** active messages available, deadletter messages available
- **IoT Hub, App Configuration, App Service, Communication Services, Azure Maps, Azure Policy, Machine Learning, SignalR, and API Management**

Several services people expect to find here are not Event Grid sources. **Azure Cosmos DB is not one**, and its change feed is the mechanism for reacting to document lifecycle events. Azure SQL Database, Azure Synapse Analytics, and Azure Web PubSub are likewise absent. Check the [current source list](https://learn.microsoft.com/en-us/azure/event-grid/system-topics){:target="_blank" rel="noopener noreferrer"} before designing around an assumed integration.

System topics are managed by Azure, but subscriptions are your responsibility. Their placement follows the source and is not something you choose: Event Grid creates the system topic in the same Azure subscription and the same region as the event source, and there is only one system topic per source. Global sources (Azure subscriptions, resource groups, Azure Maps) get a system topic in the **global** location, and event subscriptions at Azure-subscription scope land in a `Default-EventGrid` resource group in **West US 2**, which surprises people auditing resource inventories by region.

#### Event Domains

[Event Domains](https://learn.microsoft.com/en-us/azure/event-grid/event-domains){:target="_blank" rel="noopener noreferrer"} are a single publishing endpoint that fronts thousands of individual topics belonging to the same application. A domain contains child topics, each typically scoped to a tenant, and Azure RBAC on each child topic is what keeps one tenant from subscribing to another's events. Domains are covered in depth [below](#event-domains-for-multi-tenant-scenarios).

### Event Schemas

Event Grid supports two event formats: its own proprietary Event Grid schema and the CloudEvents standard. **CloudEvents is Microsoft's recommended format**, and it should be the default for new work. The Event Grid schema is not being retired and remains fully supported, but Microsoft has stated it will receive no further major improvements.

#### Event Grid Schema

The Event Grid schema is proprietary and non-extensible. It predates CloudEvents support and is still what many Azure system topics emit natively.

**Structure:**

```json
{
  "topic": "/subscriptions/123/resourceGroups/mygroup/providers/Microsoft.EventGrid/topics/mytopic",
  "eventType": "myapp.user.created",
  "id": "A234-1234-1234",
  "eventTime": "2025-02-10T14:30:00Z",
  "data": {
    "userId": 123,
    "email": "user@example.com"
  },
  "dataVersion": "1.0",
  "metadataVersion": "1",
  "subject": "/users/123"
}
```

**Metadata:**
- **topic:** Full resource path to the event source. Not writeable by the publisher. If you omit it, Event Grid stamps it; if you include it, it must match the topic's ARM ID exactly
- **eventType:** Categorizes the event (usually in format `publisher.category.action`)
- **id:** Unique identifier per event
- **eventTime:** When the event occurred
- **data:** The actual event payload (schema defined by the publisher)
- **dataVersion:** Version of the data payload schema (allows publisher to evolve schema)
- **metadataVersion:** Version of the envelope itself. Event Grid defines it, and the only current value is `1`
- **subject:** Hierarchical identifier within the event source (used for filtering)

`subject`, `eventType`, `eventTime`, `id`, and `data` are required. `topic`, `dataVersion`, and `metadataVersion` are stamped for you if omitted.

#### CloudEvents Schema

[CloudEvents](https://cloudevents.io/){:target="_blank" rel="noopener noreferrer"} is a CNCF standard for describing events. Event Grid supports CloudEvents v1.0 natively.

**Structure:**

```json
{
  "specversion": "1.0",
  "type": "myapp.user.created",
  "source": "/myapp/users",
  "id": "A234-1234-1234",
  "time": "2025-02-10T14:30:00Z",
  "datacontenttype": "application/json",
  "subject": "/users/123",
  "data": {
    "userId": 123,
    "email": "user@example.com"
  }
}
```

**Metadata:**
- **specversion:** CloudEvents specification version (always "1.0")
- **type:** Event type (similar to Event Grid's eventType)
- **source:** Origin of the event (URI reference)
- **id:** Unique identifier
- **time:** Timestamp
- **datacontenttype:** MIME type of the payload
- **subject:** Optional subject (same filtering purpose as Event Grid schema)
- **data:** Event payload

**Event Grid vs CloudEvents:**
- **CloudEvents** is the recommended format for new work, Azure-only systems included. It is extensible, cloud-agnostic, and where Microsoft is investing
- **Event Grid schema** is what you keep for existing publishers and consumers rather than what you choose
- Both are JSON-based and support the same filtering and subscription mechanisms
- Only the **structured JSON** CloudEvents content mode is supported for basic-tier push delivery. Binary content mode is not

The conversion between them is asymmetric, and that asymmetry constrains migration order. An Event Grid-format input can be delivered as either format, and a CloudEvents input can only be delivered as CloudEvents:

| Input schema | Available output schema |
|---|---|
| CloudEvents | CloudEvents only |
| Event Grid | CloudEvents or Event Grid |

CloudEvents supports extension attributes that the Event Grid schema cannot represent, which is why the downgrade path does not exist. Move publishers to CloudEvents only once every consumer on that topic can accept CloudEvents, because you cannot translate back for a straggler.

---

## Event Subscriptions and Filtering

An event subscription connects a topic to an event handler. Subscriptions define what events trigger handler invocation and which handlers process them.

Each subscription receives its own copy of every matching event, with its own filters, its own retry state, and its own dead-letter destination. A handler that fails does not block or delay the other subscriptions on the same topic.

```
                          Topic (one publish)
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  Subscription A           Subscription B           Subscription C
  filter: order.*          filter: order.paid       filter: order.*
        │                        │                   subject: /eu/
        ▼                        ▼                        ▼
   Function                 Service Bus queue         Webhook (failing)
   delivered                 delivered                 retrying, then
                                                       dead-lettered
        │                        │                        │
        └── own retry state ─────┴── own dead-letter ─────┘
              (independent per subscription)
```

Fan-out is therefore a subscription-count decision, not a routing-rule decision, and the cost scales with it: one publish delivered to three subscriptions is four operations before any retries.

### Subscription Lifecycle

1. **Create subscription:** Point to a topic and specify a handler (webhook URL, Function, Service Bus queue, and so on)
2. **Validate the endpoint:** For webhook endpoints, Event Grid performs an ownership handshake before delivering anything. Azure service handlers skip this step
3. **Activate subscription:** After validation, events begin flowing to the handler
4. **Event delivery:** Events matching the subscription's filters are delivered to the handler

Subscriptions can also carry an **expiration time**, after which they delete themselves. That is useful for a subscription created to test a scenario, where the cleanup is otherwise easy to forget.

### Filtering

Event Grid filters events at the subscription level. A subscription only receives events matching its filters, reducing unnecessary handler invocation. There are three filter types, and they compose as an AND.

#### Subject Filtering

Filter by the event's `subject` field with `subjectBeginsWith` (prefix) and `subjectEndsWith` (suffix). These are the only two subject operations. There is no contains, glob, or regex.

```
subjectBeginsWith: "/orders/"
Matches:           "/orders/123", "/orders/456/items"
Does not match:    "/payments/", "/users/orders"

subjectEndsWith:   ".pdf"
Matches:           "document.pdf", "files/report.pdf"
Does not match:    "document.txt"
```

Because prefix matching is all you get, the subject is a routing key you design rather than a field you happen to fill in. A three-segment subject like `/tenant/region/entity` lets one subscriber filter broadly on `/tenant` and another narrowly on `/tenant/region`. A subject that puts the volatile segment first gives subscribers nothing to filter on.

#### Event Type Filtering

Filter by the event's `eventType` field using `includedEventTypes`. Multiple event types create an OR relationship, and the default is every event type for the source.

```
Event types: ["order.created", "order.cancelled"]
Matches events with either type
```

#### Advanced Filters

Advanced filters do key-value matching on event data properties. The operator set covers numbers (`NumberIn`, `NumberNotIn`, `NumberLessThan`, `NumberGreaterThan`, the `OrEquals` variants, `NumberInRange`, `NumberNotInRange`), strings (`StringIn`, `StringNotIn`, `StringContains`, `StringNotContains`, `StringBeginsWith`, `StringNotBeginsWith`, `StringEndsWith`, `StringNotEndsWith`), booleans (`BoolEquals`), and existence (`IsNullOrUndefined`, `IsNotNull`).

```json
{
  "operatorType": "StringContains",
  "key": "data.productType",
  "values": ["electronics"]
}
```

Use advanced filters to match specific event payload properties (for example, only process orders over a certain amount, or events from specific regions).

**The constraints that bite in practice:**

- **25 advanced filters and 25 filter values total per subscription**, counted across all filters. A single `StringIn` with 25 values exhausts the budget on its own
- **512 characters per string value**
- Multiple values inside one filter are **OR**; multiple filters are **AND**
- **All string comparisons are case-insensitive**, so you cannot distinguish `Electronics` from `electronics`
- Filtering on arrays of scalars works after setting `enableAdvancedFilteringOnArrays`, but **arrays of objects cannot be filtered at all**
- **Keys containing a dot are unsupported**, and there is no escape syntax. A payload keyed by email address or by a namespaced claim URI is unfilterable
- A missing key evaluates as **not matched** for most operators, but as **matched** for `NumberNotIn` and `StringNotIn`. A negative filter therefore lets through events that omit the field entirely

---

## Event Handlers

Event Grid can deliver events to many handler types. The handler determines what action occurs when an event is received.

### Handler Types

| Handler | Use Case | Characteristics |
|---------|----------|-----------------|
| **Azure Functions** | Serverless event processing | Event Grid trigger binding, scales automatically, endpoint validation handled for you |
| **Webhooks (HTTPS)** | Custom applications, third-party services, Logic Apps, Automation runbooks | HTTPS only, and your endpoint participates in the validation handshake unless Azure does it for you |
| **Azure Service Bus** | Buffering, back-pressure, competing consumers | Queues and topics that your application drains at its own rate |
| **Azure Event Hubs** | High-throughput ingestion and replay | Retains the stream so consumers can re-read by offset |
| **Storage Queues** | Simple asynchronous processing | Low cost, 64 KB per message |
| **Relay hybrid connections** | Delivery to on-premises listeners | Reaches a handler with no inbound public endpoint |
| **Azure Monitor alerts** | Alerting on Key Vault events | Supported only when the event source is Azure Key Vault |
| **Event Grid namespace topic** | Bridge basic-tier events into pull delivery | Lets a push-only source feed consumers that pull |

Logic Apps and Azure Automation are reached through the webhook path rather than as distinct destination types, but Azure handles their validation handshake automatically. Two destinations people assume exist do not: **blob containers are not an event handler** (a storage account is only ever a dead-letter destination, never a delivery target), and **Power Automate is not a native destination** either. Power Automate consumes Event Grid events through its own connector, which registers a webhook subscription on your behalf.

### Push and Pull, Precisely

All of the handlers above are **push** destinations. Event Grid initiates the delivery in every case, including for Service Bus, Event Hubs, and storage queues. What those three give you is a buffer that your application drains on its own schedule, not a different delivery mechanism from Event Grid's side. A delivery attempt into a Service Bus queue is therefore a billed Event Grid operation that can fail and retry exactly like a webhook POST.

Genuine pull delivery, where the consumer connects to Event Grid and requests events, exists only on the standard tier with namespace topics.

```
PUSH (basic tier)                     PULL (standard tier, namespaces)

 Publisher                             Publisher
     │ publish                             │ publish (CloudEvents)
     ▼                                     ▼
 ┌─────────┐                          ┌──────────────┐
 │  Topic  │                          │ Namespace    │
 └────┬────┘                          │ topic        │
      │ Event Grid initiates          └──────┬───────┘
      │ the connection                       │  events wait, up to 7 days
      ▼                                      │
 ┌──────────┐   must be reachable            │  ◄── consumer initiates
 │ Handler  │   from Event Grid              │      receive()
 │ endpoint │                                │  ──► events + lock tokens
 └──────────┘                                │  ◄── acknowledge / release
      ▲                                      │      / reject / renew lock
      │ retries on Event Grid's              ▼
      │ schedule, not yours            ┌──────────┐
                                       │ Consumer │  behind a private
                                       │   app    │  endpoint if desired
                                       └──────────┘
```

### Handler Selection

**Use Functions when:**
- You need lightweight, serverless event processing
- Events arrive at a predictable rate
- You want the validation handshake handled for you

**Use Service Bus/Event Hubs when:**
- Events arrive in bursts and you need buffering to prevent handler overload
- You want application code to control consumption rate (back-pressure)
- You need event replay or audit trail

**Use Webhooks when:**
- Integrating with third-party services or custom applications
- You control the HTTPS endpoint and can implement the validation handshake

**Use namespace pull delivery when:**
- Your consumer cannot expose an inbound endpoint, or must consume over a private link
- Consumption is scheduled or intermittent rather than continuous
- You want the consumer to release an event back to the broker when a downstream dependency is unavailable

---

## Retry and Dead-Lettering

Event Grid provides at-least-once delivery with configurable retry policies and dead-letter storage for events that cannot be delivered after all retries are exhausted.

### What Counts as Success

Event Grid treats **only** HTTP 200, 201, 202, 203, and 204 as successful delivery. Everything else is a failure, and the response code decides whether the event is retried at all.

| Response | Behavior |
|---|---|
| 200-204 | Delivered, done |
| 400 Bad Request | **Never retried.** Dead-lettered immediately, or dropped |
| 403 Forbidden | **Never retried.** Dead-lettered immediately, or dropped |
| 413 Payload Too Large | **Never retried.** Dead-lettered immediately, or dropped |
| 401 Unauthorized | Retried after 5 minutes or more |
| 404 Not Found | Retried after 5 minutes or more |
| 408 Request Timeout | Retried after 2 minutes or more |
| 503 Service Unavailable | Retried after 30 seconds or more |
| Everything else | Standard exponential backoff |

The 400 row is the one that costs people events. A handler that validates its input and returns 400 on a payload it cannot parse has just told Event Grid to stop trying, permanently, on the first attempt. If dead-lettering is not configured, that event is gone. Return 400 only when you genuinely want the event abandoned, and return 5xx for anything you might be able to process after a fix.

### Automatic Retries

Event Grid waits **30 seconds** for a response after delivering an event. If the endpoint has not answered by then, the event is queued for retry.

**Default retry behavior:**
- **Max delivery attempts:** 30 (configurable from 1 to 30)
- **Event time-to-live:** 1440 minutes (24 hours) by default, configurable from 1 to 1440
- **Retry schedule:** 10 s, 30 s, 1 min, 5 min, 10 min, 30 min, 1 h, 3 h, 6 h, then every 12 h out to 24 hours, each with small randomization and delivered on a best-effort basis

The two limits are evaluated together and **whichever expires first ends delivery**. That interaction is easy to get backwards. In Microsoft's own worked example, a 30-minute TTL leaves room for only about six attempts on the retry schedule, so raising max attempts from 5 to 10 changes nothing at all. Configure the TTL to express how long the event stays useful, and treat max attempts as a secondary cap.

**Delayed delivery** is the behavior that surprises operators. When an endpoint accumulates failures, Event Grid begins delaying not just its retries but *new* deliveries to that endpoint, in some cases by hours. A subscription can also enter **probation**, during which events may be dead-lettered or dropped without a delivery attempt at all. Probation lasts 10 seconds for a busy endpoint and 5 minutes for `NotFound`, `Unauthorized`, `Forbidden`, `Disabled`, or `Full`. So a handler that has been down and then recovers will not immediately see its backlog, and the gap is not a sign that events were lost.

```
                  publish
                     │
                     ▼
              filter matches?
                     │
              no ────┴──── yes
               │             │
            dropped          ▼
                      deliver, wait 30 s
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
    200-204            400 / 403 / 413        other / timeout
        │                    │                    │
       done                  │                    ▼
                             │            retry ladder
                             │        10 s, 30 s, 1 m, 5 m,
                             │        10 m, 30 m, 1 h, 3 h,
                             │        6 h, then every 12 h
                             │                    │
                             │         ┌──────────┴──────────┐
                             │         ▼                     ▼
                             │   TTL expired          max attempts hit
                             │         └──────────┬──────────┘
                             └────────────────────┤
                                                  ▼
                                    dead-letter container configured?
                                                  │
                                    no ───────────┴─────────── yes
                                     │                          │
                                  dropped              blob written after
                                                       a ~5 min delay
```

### Dead-Lettering

Events that fail delivery are written to a **blob container in an Azure Storage account**. This is not a queue. You provide a container endpoint when creating the subscription, and Event Grid writes each undeliverable event there as a blob:

```
/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage
  /storageAccounts/<storage-name>/blobServices/default/containers/<container-name>
```

**When to configure dead-lettering:**
- You want to analyze failed events and potentially replay them
- You need an audit trail of undeliverable events
- You want to trigger alerts or manual remediation for persistently failing events

Dead-lettering is **off by default**, and the consequence of leaving it off is not a delay but silent loss.

**Behavior to account for before you rely on it:**
- Events are dead-lettered when the TTL expires **or** max attempts is exceeded, and immediately on 400, 403, or 413
- There is roughly a **five-minute delay** between the last delivery attempt and the blob appearing, which exists to reduce blob-storage operations. Do not treat a missing blob in the first few minutes as a lost event
- If the dead-letter location is **unavailable for four hours, the event is dropped**. An expired key, a deleted container, or a firewall change turns your safety net into the same silent loss it was meant to prevent
- If the destination cannot be found at all, dead-lettered events are dropped
- The dead-letter blob wraps the original event with `deadLetterReason`, `deliveryAttempts`, `lastDeliveryOutcome`, and `lastDeliveryAttemptTime`. `lastDeliveryOutcome` is the field that tells you whether the failure was `Unauthorized`, `ResolutionError`, `TimedOut`, `Probation`, or something else
- If you use a managed identity for dead-lettering, it needs a storage RBAC role on the account. Missing that role produces exactly the four-hour-then-dropped case above

**Handling dead-lettered events:**
- Subscribe an Event Grid system topic to the dead-letter storage account so a `BlobCreated` event notifies you the moment something is dead-lettered, rather than discovering it on a dashboard later
- Analyze `deadLetterReason` and `lastDeliveryOutcome` to separate handler bugs from configuration errors
- Fix the underlying issue in the handler or event producer
- Replay events by republishing them to the topic. There is no built-in replay

---

## Event Domains for Multi-Tenant Scenarios

Event Domains enable multi-tenant event publishing where publishers emit events to a single endpoint but subscribers only receive events for their tenant.

### How Domains Work

A publisher sends every tenant's events to one endpoint and names the destination topic on each event. In CloudEvents that is the `source` property; in the Event Grid schema it is `topic`. Event Grid routes each event to the named child topic, and Azure RBAC scoped to that topic is what stops one tenant from subscribing to another's.

```
   Publisher (one endpoint, one key)
        │
        │  batch: [ {source: "tenant-a", ...},
        │            {source: "tenant-b", ...} ]
        ▼
  ┌──────────────────────────────────────────────┐
  │ Event Domain          routes by source/topic │
  └───┬──────────────────┬──────────────────┬────┘
      ▼                  ▼                  ▼
  topic: tenant-a    topic: tenant-b    topic: tenant-c
      │                  │                  │
   RBAC: A only       RBAC: B only      RBAC: C only
      │                  │                  │
      ▼                  ▼                  ▼
  A's handlers       B's handlers       C's handlers

        ┌─────────────────────────────────────┐
        │ Domain-scope subscription (max 50)  │
        │ receives events for every topic     │
        │ for audit and management            │
        └─────────────────────────────────────┘
```

Domain topics are **auto-managed**. Create a subscription at domain scope and Event Grid creates the topic for you; delete the last subscription on a topic and the topic disappears, whether you created it explicitly or not. That is what makes onboarding a tenant an RBAC assignment rather than a resource deployment.

**Domains do not broadcast.** Every event names exactly one target topic. Sending the same payload to fifty tenants means publishing fifty copies, and billing fifty ingress operations plus the deliveries. People reach for a domain expecting a fan-out primitive and find a routing primitive.

### Domain vs Multiple Custom Topics

| Aspect | Event Domain | Multiple Custom Topics |
|--------|--------------|----------------------|
| **Publishing endpoint** | Single domain URL | Separate URL and key per topic |
| **Subscription isolation** | Azure RBAC per child topic | Azure RBAC per topic resource |
| **Management overhead** | Lower, topics are auto-managed | Higher, each topic is a deployed resource |
| **Cost** | Same per-operation pricing | Same per-operation pricing |
| **Scale ceiling** | 100,000 topics per domain | 100 custom topics per subscription per region |
| **Tenant onboarding** | Assign RBAC, topic is created on first subscription | Deploy a topic resource |
| **Ingress ceiling** | 5,000 events or 5 MB/s for the whole domain | 5,000 events or 5 MB/s per topic |

Neither option is cheaper. Event Grid has no per-topic charge, and domains bill exactly like custom topics: one operation per ingress, one per delivery attempt. Domains win on the topic ceiling, which is a three-orders-of-magnitude difference, and lose on ingress, because the whole domain shares one 5 MB/s budget where separate topics each get their own.

**When to use domains:**
- SaaS application with more tenants than the 100-custom-topic ceiling comfortably allows
- Each tenant subscribes to their own events and must not see anyone else's
- Tenant onboarding needs to be a permission grant, not a deployment

**When separate custom topics are the better fit:**
- A handful of long-lived, non-tenant partitions
- Per-partition ingress that would contend for a shared 5 MB/s domain budget

---

## Throughput, Latency, and Scaling

### Performance Characteristics

All limits below are **per region**.

| Aspect | Basic tier | Standard tier (namespaces) |
|--------|-----------|---------------------------|
| **Ingress** | 5,000 events or 5 MB/s per topic or domain | 1,000 events or 1 MB/s per throughput unit, up to 40 TUs |
| **Egress** | Included in the 5 MB/s budget | Up to 2,000 events or 2 MB/s per throughput unit |
| **Latency** | Sub-second from publish to handler invocation |  Governed by how often the consumer polls |
| **Event size** | 1 MB, not increasable | 1 MB |
| **Batch on publish** | 5,000 events per request, 1 MB total array size | 1,000 events per request, 1 MB batch |
| **Subscriptions per topic** | 500, not increasable (100 at Azure-subscription scope) | 500 |
| **Topics** | 100 custom topics per Azure subscription; 100,000 per domain | 100 namespace topics per throughput unit |
| **Retention** | 1 day, not increasable | 7 days |
| **Ordering** | Not guaranteed | Not guaranteed |

An event is counted as a **64 KB chunk** for both quota and billing, so a 128 KB event consumes two events' worth of your 5,000/second budget.

### Scaling Guarantees

Basic-tier Event Grid scales automatically without user configuration up to the published ingress ceiling, and publishes beyond it are throttled. Standard-tier namespaces scale by throughput unit, either adjusted manually or by enabling autoscale.

The delivery side is not uniformly parallel. A healthy endpoint receives events as fast as it can absorb them, but delayed delivery and probation deliberately slow delivery to endpoints that have been failing, and that slowdown applies to new events as well as retries.

### Ordering

**Event Grid does not guarantee ordering, and there is no setting that changes this.** Subscribers can and do receive events out of order, on both tiers. There is no per-subject ordering option, no ordered-delivery toggle, and no partition affinity to lean on.

Design around it rather than hoping for it:

- **Carry a sequence or version number in the payload.** Blob Storage events include a `sequencer` field for exactly this reason, and a lexicographic comparison of two `sequencer` values tells you which blob change happened first
- **Make handlers idempotent and commutative where possible**, so a late-arriving stale event is discarded rather than applied
- **Read current state instead of reconstructing it.** Treating the event as a notification that something changed, then fetching the authoritative record, sidesteps ordering entirely
- **If you genuinely need ordering, use a different service.** Service Bus sessions give FIFO within a session; Event Hubs gives ordering within a partition. Reaching for one of those is the answer when order is a correctness requirement rather than a convenience

---

## Integration with Azure Services

Event Grid has native integration with many Azure services, enabling event-driven workflows without custom event publishing code.

### System Topic Examples

#### Blob Storage Events

When files are uploaded to Blob Storage, a system topic automatically emits events. Subscriptions can trigger Functions to process new files.

**Example flow:**
```
1. File uploaded to Blob Storage
2. System topic emits "Microsoft.Storage.BlobCreated" event
3. Event Grid routes to Azure Function
4. Function downloads blob, processes data, stores result
```

**Common events:**
- `Microsoft.Storage.BlobCreated`
- `Microsoft.Storage.BlobDeleted`
- `Microsoft.Storage.BlobRenamed`

#### Resource Group Events

System topics for resource groups emit events when resources are created, updated, deleted, or certain actions occur. This enables tracking resource changes and triggering automation.

**Example events:**
- `Microsoft.Resources.ResourceWriteSuccess` (resource created or updated)
- `Microsoft.Resources.ResourceDeleteSuccess` (resource deleted)
- `Microsoft.Resources.ResourceActionSuccess` (action performed on resource)

**Example flow:**
```
1. New VM is created in resource group
2. System topic emits "ResourceWriteSuccess" event
3. Function receives event, triggers configuration management
4. VM is automatically configured (install agents, apply policy)
```

### Built-In Integrations

| Service | Events | Use Case |
|---------|--------|----------|
| **Blob Storage** | Blob created, deleted, renamed, tier changed | Trigger image processing, data pipelines |
| **Resource groups and subscriptions** | Resource write, delete, and action outcomes | Automation, compliance tracking, cost management |
| **Key Vault** | Secret, key, and certificate near-expiry and expiry | Rotate credentials before an outage, not after |
| **Container Registry** | Image pushed, image deleted, chart pushed | Kick off deployment or scanning on a new image |
| **Event Hubs** | Capture file created | Archive processing and replay |
| **Service Bus** | Active or dead-letter messages available | Wake a consumer for an otherwise idle queue |
| **Azure Policy** | Policy state change | Compliance drift alerting |
| **Azure Maps** | Geofence events | Location-based triggers |

---

## Pull Delivery with Namespaces

The standard tier replaces the topic-plus-handler model with a **namespace**, a regional resource that holds namespace topics and, optionally, an MQTT broker. Namespace topics accept CloudEvents JSON only, retain events for up to 7 days, and let consumers read on their own schedule.

### Queue Semantics Over HTTP

A queue-mode event subscription is drained by an application rather than pushed to an endpoint. The operations mirror a message broker more than a webhook:

- **receive** returns up to the requested number of events, each with a **lock token**. The broker holds the request open for up to 60 seconds waiting for events to arrive, so an idle consumer is not spinning
- **acknowledge** deletes the event so it is not redelivered
- **release** hands the event back for redelivery, optionally after a delay. This is the operation push delivery has no equivalent for: a consumer whose database is down can decline the event without failing and without burning retry attempts
- **reject** abandons the event immediately, dead-lettering it if a destination is configured. Use it for a payload that will never parse
- **renew lock** extends the lock while a long operation finishes

Each event subscription gets its own copy of the events with its own independent state, so acknowledging on one subscription does not affect another.

### What the Standard Tier Cannot Do

The tier split is not a superset relationship, and assuming it is leads to a rebuild:

- **No Azure system events.** You cannot subscribe a namespace topic to Blob Storage or Key Vault. System topics are basic-tier only
- **No partner events**, and no domain topics
- **Push destinations are limited to Event Hubs.** Functions, Service Bus, storage queues, and Relay are basic-tier destinations
- **CloudEvents JSON only.** The Event Grid schema is not accepted

The bridge for a mixed design is the `Event Grid namespace topic` handler on the basic tier, which lets a system topic push into a namespace topic that consumers then pull from.

### Choosing a Tier and Topic Type

```
Do you need MQTT pub/sub for devices?
  ├─ yes ──► Standard tier: namespace with MQTT broker
  └─ no
      │
      Must consumers pull, use a private endpoint on the
      consume path, exceed 5 MB/s, or retain beyond 1 day?
        ├─ yes ──► Standard tier: namespace topics (pull delivery)
        └─ no
            │
            Where do the events come from?
              ├─ an Azure service ─────────► Basic: system topic
              ├─ a SaaS partner ───────────► Basic: partner topic
              └─ your own application
                    │
                    More tenants or partitions than
                    100 topics per region allows,
                    each needing isolated access?
                      ├─ yes ──► Basic: event domain
                      └─ no ───► Basic: custom topic
```

---

## Common Pitfalls

### Pitfall 1: Tight Coupling Event Types

**Problem:** Publishing events with generic event types like "entity.changed" and trying to filter in subscribers.

**Result:** Subscribers receive many irrelevant events. Filtering becomes ineffective as event types proliferate. Adding new event types requires coordinator knowledge across multiple teams.

**Solution:** Define specific, granular event types. Use the format `publisher.category.action` (e.g., `orders.payment.completed`, `users.profile.updated`). This makes filtering explicit and enables subscribers to declare exact interest in specific events.

---

### Pitfall 2: Handler Timeouts and Retries Causing Duplicate Processing

**Problem:** Handler takes longer than Event Grid's **30-second** response window or fails intermittently. Event Grid queues the event for retry, and the handler processes the same event multiple times.

**Result:** Duplicate processing (charging the same order twice, sending the same notification multiple times).

**Solution:** Design handlers to be idempotent. Use an idempotency key (from event ID or data) to detect and skip duplicate processing. Store the idempotency key in a database or cache so repeated events are recognized as duplicates. Acknowledge fast and do the work asynchronously when processing might approach 30 seconds, because a slow handler produces both duplicates and delayed delivery. Event Grid makes a best-effort attempt to cancel a queued retry if the endpoint answers within three minutes, but that is not a guarantee, and its delivery contract is at-least-once regardless.

---

### Pitfall 3: Ignoring Dead-Lettering

**Problem:** Configuring subscriptions without dead-letter destinations. Dead-lettering is off by default, so failed events disappear silently.

**Result:** Data loss. No way to know which events failed or why. Silent failures go unnoticed, and a handler returning 400 loses events on the very first attempt without a single retry.

**Solution:** Configure a dead-letter storage container for every production subscription. Subscribe to `BlobCreated` on that container so a dead-letter write raises an alert rather than sitting until someone checks. Verify the identity or key Event Grid uses to write there, since a broken dead-letter destination drops events after four hours and looks identical to having configured nothing.

---

### Pitfall 4: Missing Validation Webhook Implementation

**Problem:** A webhook endpoint does not complete the ownership handshake that Event Grid requires before it delivers anything.

**Result:** Subscription creation fails or sits in `AwaitingManualAction` and then `Failed`. Events never flow to the handler.

**Solution:** Know which endpoints need the handshake. Azure handles it automatically for Logic Apps using the Event Grid connector, Azure Automation via webhook, and Azure Functions using the **Event Grid trigger**. An HTTP-triggered Function gets no such help and must implement the handshake itself, which is where most of these failures come from.

For endpoints you own, echo the `validationCode` from the `Microsoft.EventGrid.SubscriptionValidationEvent` back in a `validationResponse` property, returning **HTTP 200 within 30 seconds**. HTTP 202 is not accepted as a valid response. For a third-party endpoint that cannot respond programmatically, use the manual handshake: return 200, find the `validationUrl` in the event data, and issue a GET to it within **10 minutes**. That URL uses **port 553**, so an egress firewall rule that only allows 443 will block it. Endpoints must be HTTPS, and self-signed certificates are not supported.

If your subscription delivers in CloudEvents format, the handshake is different. CloudEvents uses its own abuse-protection exchange over **HTTP OPTIONS**, and your endpoint answers with a `WebHook-Allowed-Origin` header instead of a validation code. An endpoint built only for the Event Grid validation event will fail validation the moment someone switches the output schema.

---

### Pitfall 5: Over-Filtering Causing Loss of Needed Events

**Problem:** Creating overly strict filters that exclude edge cases or future event types.

**Result:** Subscribers miss important events. System behavior becomes surprising and hard to debug.

**Solution:** Start with minimal filtering. Add filters only when you have confirmed that irrelevant events waste resources. Document filter logic. Test filter behavior with sample events before deploying. Watch negative operators in particular: `StringNotIn` and `NumberNotIn` evaluate to *matched* when the key is absent, so a filter meant to exclude a category silently admits every event that omits the field.

---

### Pitfall 6: Treating the Dead-Letter Container Like a Queue

**Problem:** Assuming dead-lettered events land in a queue that something drains, and building operations around queue depth.

**Result:** Nothing drains the container, because it is a blob container with no consumer and no retention policy of its own. Failed events accumulate indefinitely and unnoticed, or a lifecycle rule tiers them to archive and the replay path breaks when someone finally needs it.

**Solution:** Treat dead-lettering as storage you own. Set an explicit lifecycle policy so the container does not grow without bound, but keep the retention long enough to cover your incident response window. Alert on the *rate* of new dead-letter blobs rather than on total count, since a rising rate is what indicates a systemic handler problem. Build and test the replay path (read the blob, extract the original event, republish it to the topic) before you need it, because Event Grid provides no replay of its own.

---

## Key Takeaways

1. **Event Grid enables reactive, event-driven architecture.** Instead of polling for changes, subscribe to events. Producers emit events; subscribers listen. This decouples systems and scales naturally.

2. **Topics are event sources; subscriptions are event flows.** Create a topic where events are published, then create subscriptions that route events to handlers. Multiple subscriptions to the same topic enable fan-out.

3. **Filtering happens at subscription level, not event level.** Subscriptions filter by event type, subject, and advanced key-value filters. This reduces handler invocation load and makes intent explicit.

4. **Retries follow a fixed schedule, and the response code decides whether they happen at all.** Event Grid waits 30 seconds, then retries at 10 s, 30 s, 1 min, and out to 24 hours. Only 200-204 count as success. A 400, 403, or 413 is never retried and dead-letters immediately, so returning 400 on an unparseable payload discards the event on the first attempt.

5. **Dead-lettering writes blobs to a storage container, not messages to a queue.** It is off by default, adds a five-minute delay, and drops events if the container is unreachable for four hours. Configure it on every production subscription and verify the write path.

6. **Pick the tier before anything else.** Basic gives you Azure system events, domains, and push to Azure services. Standard gives you MQTT, pull delivery, private-link consumption, 7-day retention, and 40 MB/s. Neither is a superset of the other, so getting this wrong means a rebuild rather than a setting change.

7. **Event Domains route, they do not broadcast.** Every event names one target topic, and topics are auto-managed so onboarding a tenant is an RBAC grant. Domains raise the topic ceiling from 100 per region to 100,000, and lower the ingress ceiling by making every tenant share one 5 MB/s budget.

8. **Design handlers to be idempotent, and expect events out of order.** Delivery is at-least-once with no ordering guarantee on either tier, and there is no setting that adds one. Carry a sequence or version field, or fetch current state instead of reconstructing it from event order.

9. **CloudEvents is the recommended format, including for Azure-only systems.** The Event Grid schema is supported indefinitely but is receiving no further major investment. Migrate publishers only when every consumer can accept CloudEvents, because CloudEvents input cannot be delivered as Event Grid output.

10. **Billing is per operation, not per event.** Ingress, each delivery attempt, each filter match, and each dead-letter write all count, metered in 64 KB units. Fan-out multiplies the bill by subscription count, and a retry storm multiplies it again.
