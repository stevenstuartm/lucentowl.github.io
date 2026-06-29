---
title: "Azure Event Grid for System Architects"
layout: guide
category: Azure
subcategory: Application Integration & Messaging
description: "Event-driven architecture on Azure with Event Grid topics, event schemas, subscriptions, filtering, dead-lettering, and CloudEvents support for reactive system design."
tags: [azure, infrastructure, messaging, distributed-systems, scalability, architecture, practical]
---

## What Is Azure Event Grid

[Azure Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/overview){:target="_blank" rel="noopener noreferrer"} is a fully managed, serverless event broker that routes events from sources (like Blob Storage, resource groups, or custom applications) to destinations (like Functions, Logic Apps, webhooks, Service Bus, and Event Hubs). Unlike message queues that require polling, Event Grid pushes events to subscribers as they occur, enabling reactive, event-driven system design.

Event Grid handles event delivery with automatic retries, configurable filtering, dead-letter storage for failed events, and support for both custom event schemas and the [CloudEvents](https://cloudevents.io/){:target="_blank" rel="noopener noreferrer"} standard.

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
| **Event transformation** | Rules can transform events with input transformers | Limited transformation with schema mapping available at subscription level |
| **Filtering** | Rules match on event pattern and detail | Subscriptions filter by event type, subject, and advanced filters (key-value matching) |
| **Event schema** | EventBridge detail format (JSON) | Event Grid schema or CloudEvents standard (both JSON-based) |
| **Routing** | One rule maps to multiple targets in one account/region | One subscription to one handler with multiple subscriptions for multiple handlers |
| **Fan-out** | Native fan-out by rule design | Multiple subscriptions for fan-out |
| **Delivery retry** | Automatic, configurable | Automatic and configurable with dead-lettering built-in |
| **Ordering** | Not guaranteed | Can be guaranteed per subject with strict ordering |
| **Cost model** | Per million events ingested | Per million events delivered (subscription-based pricing) |

---

## Core Event Grid Concepts

### Event Grid Topics

A topic is an endpoint where event producers publish events. Event Grid provides two types of topics and related concepts:

#### Custom Topics

Custom topics are user-created endpoints where applications publish events. You create a custom topic when you want to emit domain-specific events from your application.

**Characteristics:**
- Created and managed by the user
- Accessed via the [Event Grid Data Plane API](https://learn.microsoft.com/en-us/rest/api/eventgrid/version2024-06-01-preview/topics/publish-events){:target="_blank" rel="noopener noreferrer"}
- Events are published using the Event Grid schema or CloudEvents format
- Can be created with custom domain names for FQDN stability across environment changes
- Charged per event published

#### System Topics

System topics are automatically created by Azure for specific Azure services. When you enable Event Grid on an Azure resource (like Blob Storage or a resource group), a system topic is created automatically.

**Common system topics:**
- **Blob Storage:** Events when blobs are created, deleted, or modified
- **Resource Groups:** Events when resources are created, updated, deleted, or actions occur
- **Azure Cosmos DB:** Document lifecycle events (create, update, delete)
- **Azure Synapse Analytics:** SQL pool lifecycle events
- **Azure Web PubSub:** Hub events
- **Azure SQL Database:** Schema change events

System topics are managed by Azure, but subscriptions are your responsibility.

#### Event Domains

[Event Domains](https://learn.microsoft.com/en-us/azure/event-grid/event-domains){:target="_blank" rel="noopener noreferrer"} are multi-tenant topics that enable publishers to emit events to a single endpoint and let subscribers filter by tenant or logical partition. A domain contains child topics, each scoped to a specific tenant or logical group.

**When to use domains:**
- SaaS applications serving multiple customers where each customer needs isolated event streams
- Multi-tenant platforms where subscribers only care about their own events
- Applications wanting to isolate publishing and subscription logic by tenant without creating separate topic resources

### Event Schemas

Event Grid supports two event formats: the native Event Grid schema and the CloudEvents standard.

#### Event Grid Schema

The native Event Grid schema is a superset of the CloudEvents specification that includes Event Grid-specific metadata.

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
  "subject": "/users/123"
}
```

**Metadata:**
- **topic:** The resource that published the event
- **eventType:** Categorizes the event (usually in format `publisher.category.action`)
- **id:** Unique identifier per event
- **eventTime:** When the event occurred
- **data:** The actual event payload (schema defined by the publisher)
- **dataVersion:** Version of the data payload schema (allows publisher to evolve schema)
- **subject:** Hierarchical identifier within the event source (used for filtering)

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
- **Event Grid schema:** Azure-native, includes topic URL; best for Azure-only systems
- **CloudEvents:** Cloud-agnostic standard; use when events flow across cloud providers or when interoperability is a priority
- Both are JSON-based and support the same filtering and subscription mechanisms
- Subscriptions can accept either format

---

## Event Subscriptions and Filtering

An event subscription connects a topic to an event handler. Subscriptions define what events trigger handler invocation and which handlers process them.

### Subscription Lifecycle

1. **Create subscription:** Point to a topic and specify a handler (webhook URL, Function, etc.)
2. **Subscribe handler endpoint:** Event Grid sends a validation event to confirm the handler exists
3. **Activate subscription:** After validation, events begin flowing to the handler
4. **Event delivery:** Events matching the subscription's filters are delivered to the handler

### Filtering

Event Grid filters events at the subscription level. A subscription only receives events matching its filters, reducing unnecessary handler invocation.

#### Subject Filtering

Filter by the event's `subject` field using prefix and suffix matching.

```
Subject filter: "/orders/"
Matches:       "/orders/123", "/orders/456/items"
Does not match: "/payments/", "/users/orders"

Subject filter: ".pdf"
Matches:       "document.pdf", "files/report.pdf"
Does not match: "document.txt"
```

Use subject filtering for hierarchical event filtering (by resource ID, user ID, or category).

#### Event Type Filtering

Filter by the event's `eventType` field. Multiple event types create an OR relationship.

```
Event types: ["order.created", "order.cancelled"]
Matches events with either type
```

#### Advanced Filters

Advanced filters provide key-value matching on event data properties using operators like `StringIn`, `StringContains`, `NumberGreaterThan`, and `BoolEquals`.

```json
{
  "operatorType": "StringContains",
  "key": "data.productType",
  "value": "electronics"
}
```

Use advanced filters to match specific event payload properties (e.g., only process orders over a certain amount, or events from specific regions).

---

## Event Handlers

Event Grid can deliver events to many handler types. The handler determines what action occurs when an event is received.

### Handler Types

| Handler | Use Case | Characteristics |
|---------|----------|-----------------|
| **Azure Functions** | Serverless event processing | Scales automatically, charged per invocation, sub-second latency |
| **Logic Apps** | Workflow automation | Visual workflow builder for complex multi-step processes |
| **Webhooks (HTTP/HTTPS)** | Custom applications, third-party services | Your application defines the HTTP endpoint with authentication support |
| **Azure Service Bus** | Message buffering for high-throughput scenarios | Queues and topics provide additional buffering that applications poll |
| **Azure Event Hubs** | High-throughput event ingestion | Designed for streaming large volumes with event replay capability |
| **Storage Queues** | Simple asynchronous processing | Low cost with applications polling for messages, limited to 64 KB per message |
| **Power Automate flows** | Low-code/no-code automation | Business process automation without coding |
| **Azure Storage Blob** | Event archival | Store events for long-term retention and analysis |

**Push vs Pull handlers:**
- **Push handlers** (Functions, Logic Apps, Webhooks): Event Grid invokes them immediately
- **Pull handlers** (Service Bus, Event Hubs, Storage Queues): Event Grid queues messages; applications consume them

### Handler Selection

**Use Functions when:**
- You need lightweight, serverless event processing
- Events arrive at a predictable rate
- You need sub-second response time

**Use Service Bus/Event Hubs when:**
- Events arrive in bursts and you need buffering to prevent handler overload
- You want application code to control consumption rate (back-pressure)
- You need event replay or audit trail

**Use Webhooks when:**
- Integrating with third-party services or custom applications
- You control the HTTP endpoint

---

## Retry and Dead-Lettering

Event Grid provides durable delivery with configurable retry policies and dead-letter storage for events that cannot be delivered after all retries are exhausted.

### Automatic Retries

When a handler returns an error or does not respond, Event Grid automatically retries according to the configured policy.

**Default retry behavior:**
- **Max delivery attempts:** 30 (configurable from 1 to 30)
- **Retry strategy:** Exponential backoff with random jitter
- **Max event age:** 1440 minutes (24 hours) by default
- **First retry:** Immediately (with small random delay)
- **Subsequent retries:** Exponential backoff (2^n seconds) with max 3600 second delay

**Retry logic:**
1. Event is delivered to handler
2. Handler returns 5xx error, timeout, or no response
3. Event Grid waits (exponential backoff) and retries
4. After max attempts or max age exceeded, event is dead-lettered or discarded

### Dead-Lettering

Events that fail delivery after all retries can be sent to a dead-letter destination (a Storage Queue or Service Bus Queue) instead of being discarded.

**When to configure dead-lettering:**
- You want to analyze failed events and potentially replay them
- You need audit trail of undeliverable events
- You want to trigger alerts or manual remediation for persistently failing events

**Configuration:**
```
Dead-letter destination: Storage Queue or Service Bus Queue
Events are dead-lettered after:
- Max delivery attempts exceeded, OR
- Event age exceeds max event age
```

**Handling dead-lettered events:**
- Monitor the dead-letter queue for failures
- Analyze event payload and error metadata to understand failure root cause
- Fix the underlying issue in the handler or event producer
- Manually replay events from the dead-letter queue if needed

---

## Event Domains for Multi-Tenant Scenarios

Event Domains enable multi-tenant event publishing where publishers emit events to a single endpoint but subscribers only receive events for their tenant.

### How Domains Work

```
Domain (single endpoint)
├── Child Topic 1: Tenant A
├── Child Topic 2: Tenant B
└── Child Topic 3: Tenant C
```

Publishers publish to `domain/topics/tenant-a`, and subscriptions to Tenant A's child topic only receive Tenant A's events. This provides logical isolation without requiring separate topic resources per tenant.

### Domain vs Multiple Custom Topics

| Aspect | Event Domain | Multiple Custom Topics |
|--------|--------------|----------------------|
| **Publishing endpoint** | Single domain URL | Separate URL per topic |
| **Subscription isolation** | Logical (child topics) | Resource-level |
| **Management overhead** | Lower (one domain) | Higher (many topics) |
| **Cost** | Lower (domain + child topics) | Higher (per-topic pricing) |
| **Scale** | Designed for hundreds of tenants | Better for <10 topics |
| **Tenant onboarding** | Create child topic (fast) | Create new custom topic (slower) |

**When to use domains:**
- SaaS application with 10+ tenants
- Each tenant publishes and subscribes to their own events
- You want simpler multi-tenant event architecture

---

## Throughput, Latency, and Scaling

### Performance Characteristics

| Aspect | Details |
|--------|---------|
| **Throughput** | 1 million events per second per region; scales automatically |
| **Latency** | Sub-second from publish to handler invocation (typically <1 second) |
| **Event size** | Up to 1 MB per event (includes all metadata and payload) |
| **Subscription limit** | 10,000 subscriptions per topic (soft limit; contact support for increase) |
| **Handler concurrency** | Event Grid pushes events in parallel; handler controls concurrency tolerance |
| **Ordering** | Not guaranteed by default; can enable strict ordering per subject |

### Scaling Guarantees

Event Grid scales automatically without user configuration. As event volume increases, Event Grid scales underlying infrastructure transparently. There is no throttling per subscription; all subscriptions receive events in their delivery window.

### Strict Ordering

By default, Event Grid does not guarantee event ordering. If ordering is critical (e.g., financial transactions, state changes), enable strict ordering per subject.

**Strict ordering characteristics:**
- Events for a specific subject are delivered in order
- Second handler waits for first handler to complete before receiving the next event
- Reduces throughput (good for critical sequences, poor for high-volume processing)
- Only available for certain handler types (Functions, Webhooks)

**Configure strict ordering:**
```
Subscription setting: "Ordered message delivery" = Enabled
Effect: Only one event per subject delivered at a time
```

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
| **Blob Storage** | Blob created, updated, deleted | Trigger image processing, data pipelines |
| **Resource Groups** | Resource lifecycle events | Automation, compliance tracking, cost management |
| **Cosmos DB** | Document lifecycle events | Sync to search index, trigger analytics |
| **Event Hubs** | Capture lifecycle events | Archive and replay |
| **Azure Data Share** | Share accepted, received | Data sharing workflows |
| **Azure Maps** | Geofence events | Location-based triggers |

---

## Common Pitfalls

### Pitfall 1: Tight Coupling Event Types

**Problem:** Publishing events with generic event types like "entity.changed" and trying to filter in subscribers.

**Result:** Subscribers receive many irrelevant events. Filtering becomes ineffective as event types proliferate. Adding new event types requires coordinator knowledge across multiple teams.

**Solution:** Define specific, granular event types. Use the format `publisher.category.action` (e.g., `orders.payment.completed`, `users.profile.updated`). This makes filtering explicit and enables subscribers to declare exact interest in specific events.

---

### Pitfall 2: Handler Timeouts and Retries Causing Duplicate Processing

**Problem:** Handler takes longer than the HTTP request timeout (default 60 seconds) or fails intermittently. Event Grid retries, and the handler processes the same event multiple times.

**Result:** Duplicate processing (charging the same order twice, sending the same notification multiple times).

**Solution:** Design handlers to be idempotent. Use an idempotency key (from event ID or data) to detect and skip duplicate processing. Store the idempotency key in a database or cache so repeated events are recognized as duplicates.

---

### Pitfall 3: Ignoring Dead-Lettering

**Problem:** Configuring subscriptions without dead-letter destinations. Failed events disappear silently.

**Result:** Data loss. No way to know which events failed or why. Silent failures go unnoticed.

**Solution:** Always configure dead-letter destinations for production subscriptions. Monitor the dead-letter queue actively. Set up alerts when events are dead-lettered. Implement dead-letter replay processes to recover from transient failures.

---

### Pitfall 4: Missing Validation Webhook Implementation

**Problem:** Handler endpoint is not reachable during the subscription creation validation handshake.

**Result:** Subscription creation fails or remains unvalidated. Events never flow to the handler.

**Solution:** Ensure your handler endpoint is publicly accessible and responds to [Event Grid validation events](https://learn.microsoft.com/en-us/azure/event-grid/webhook-event-delivery){:target="_blank" rel="noopener noreferrer"} during subscription creation. Return HTTP 200 and the validation code in the response. Test endpoint accessibility before creating subscriptions.

---

### Pitfall 5: Over-Filtering Causing Loss of Needed Events

**Problem:** Creating overly strict filters that exclude edge cases or future event types.

**Result:** Subscribers miss important events. System behavior becomes surprising and hard to debug.

**Solution:** Start with minimal filtering. Add filters only when you have confirmed that irrelevant events waste resources. Document filter logic. Use descriptive filter names. Test filter behavior with sample events before deploying.

---

### Pitfall 6: Underestimating Dead-Letter Queue Size

**Problem:** Dead-lettering failures but not sizing the dead-letter queue appropriately or setting retention policies.

**Result:** Queue fills up. Old failed events are discarded. No historical record of what failed.

**Solution:** Monitor dead-letter queue size. Set retention policies. Implement automated replay or purging of old dead-lettered events. Alert on growing dead-letter queue size (indicates a systemic handler issue).

---

## Key Takeaways

1. **Event Grid enables reactive, event-driven architecture.** Instead of polling for changes, subscribe to events. Producers emit events; subscribers listen. This decouples systems and scales naturally.

2. **Topics are event sources; subscriptions are event flows.** Create a topic where events are published, then create subscriptions that route events to handlers. Multiple subscriptions to the same topic enable fan-out.

3. **Filtering happens at subscription level, not event level.** Subscriptions filter by event type, subject, and advanced key-value filters. This reduces handler invocation load and makes intent explicit.

4. **Automatic retries with dead-lettering provide durability.** Failed events are retried automatically with exponential backoff. After max attempts, events are dead-lettered instead of discarded. Configure dead-letter destinations for all production subscriptions.

5. **Use custom topics for application events; system topics for Azure service events.** Create custom topics when your application needs to emit events. Leverage system topics for Blob Storage, resource groups, and other Azure service events without custom code.

6. **Choose handlers based on throughput and latency needs.** Functions and webhooks push events immediately (low latency, auto-scaling). Service Bus and Event Hubs queue events for consumer-controlled processing (higher throughput, buffering).

7. **Event Domains simplify multi-tenant event publishing.** Instead of one topic per tenant, create an Event Domain with child topics. Publishers emit to a single endpoint; child topics isolate events by tenant.

8. **Design handlers to be idempotent.** Retries and transient failures cause duplicate events. Detect duplicates using event ID or idempotency keys in your handler logic.

9. **CloudEvents provide interoperability across cloud providers.** Use CloudEvents schema when events flow to non-Azure systems. Event Grid schema is fine for Azure-only systems.

10. **Monitor and actively manage dead-letter queues.** Dead-lettered events indicate handler failures. Set up alerts on dead-letter queue growth. Implement replay logic to recover from transient failures and investigate persistent ones.
