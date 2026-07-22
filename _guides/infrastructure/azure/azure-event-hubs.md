---
title: "Azure Event Hubs for System Architects"
layout: guide
category: Azure
subcategory: Application Integration & Messaging
description: "High-throughput event streaming on Azure with Event Hubs, covering partitions, consumer groups, capture, Kafka compatibility, and patterns for real-time data ingestion at scale."
tags: [event-hubs, event-streaming, partitions, consumer-groups, kafka, event-hubs-capture, practical]
---

## What Is Azure Event Hubs

[Azure Event Hubs](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-about){:target="_blank" rel="noopener noreferrer"} is a fully managed event streaming service built to handle millions of events per second from distributed sources. Unlike traditional message queues that process individual messages, Event Hubs treats events as a continuous stream and allows multiple independent consumers to read the same events at their own pace.

Event Hubs operates on the principle of partitioning. Events are written to a specific partition based on a partition key, and each partition maintains its own ordered sequence of events. This partitioning design enables both scale (multiple partitions distributed across servers) and ordering guarantees (events within a partition are delivered in order).

### What Problems Event Hubs Solves

**Without Event Hubs:**
- No centralized ingestion point for high-volume telemetry from distributed sources
- Applications must handle direct connections to multiple backend systems
- No ordering guarantees across high-throughput scenarios
- No way for multiple independent consumers to process the same event stream
- Complex custom code to manage event buffering, batching, and retry logic

**With Event Hubs:**
- Centralized event ingestion at massive scale (millions of events per second per namespace)
- Multiple independent consumer groups can process the same events without interfering with each other
- Ordered delivery of events within a partition
- Automatic event retention and replay capabilities
- Integration with Azure Stream Analytics, Functions, and other services
- Built-in support for both Apache Kafka and AMQP protocols

---

## How Event Hubs Differs from AWS Kinesis

Architects familiar with AWS should note key differences between Event Hubs and Kinesis Data Streams:

| Aspect | AWS Kinesis Data Streams | Azure Event Hubs |
|--------|--------------------------|------------------|
| **Throughput units** | Shards (specify per shard) | Throughput units or processing units (allocated at namespace level) |
| **Consumer model** | Shard iterator, lease-based coordination | Consumer groups with automatic offset management |
| **Partition key** | Explicit partition key used for sharding | Partition key optional; round-robin if not specified |
| **Retention** | Default 24 hours, extendable to 365 days | Default 1 day; Standard up to 7 days, Premium/Dedicated up to 90 days |
| **Event size** | Up to 1 MB per record | 1 MB (Standard/Premium); 256 KB on Basic, 20 MB on Dedicated |
| **Kafka compatibility** | Not supported | Supported natively via Event Hubs protocol (Standard tier and above) |
| **Schema management** | Use third-party or Schema Registry | [Azure Schema Registry](https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview){:target="_blank" rel="noopener noreferrer"} integrated |
| **Auto-scaling** | Manual shard management | Auto-inflate (Standard tier); dynamic PU/CU changes (Premium/Dedicated) |
| **Archive/capture** | Amazon S3 via Kinesis Firehose | Blob Storage or Data Lake Storage built-in |
| **Pricing model** | Per-shard-hour | Per-throughput-unit-hour or capacity unit-hour |

---

## Core Event Hubs Concepts

### Partitions and Ordering

An Event Hub is subdivided into partitions, with each partition maintaining an independent, ordered sequence of events. Events are assigned to partitions based on a partition key specified by the sender.

**How partitioning works:**
- When you send an event with a partition key (e.g., device ID, user ID), Event Hubs hashes the key to determine the target partition
- All events with the same partition key go to the same partition, preserving order
- If no partition key is specified, Event Hubs distributes events round-robin across partitions
- Consumers read from specific partitions and see events in the order they were written

**Ordering guarantees:**
- Events within a single partition are guaranteed to be delivered in order
- Events across multiple partitions have no ordering guarantee (partition 0 event 5 may be consumed before partition 1 event 2)
- If ordering across all events is critical, use a single partition (limiting throughput scalability)

**Partition count trade-offs:**
- **More partitions (e.g., 32):** Better throughput and write parallelism, enables independent consumer scaling, but higher complexity and potential for consumer lag monitoring overhead
- **Fewer partitions (e.g., 1-4):** Simpler consumer coordination, easier to reason about ordering, but throughput bottleneck if writers send faster than consumers process

Most production scenarios use 4-16 partitions as a balance between scale and manageability.

### Consumer Groups

A [consumer group](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-features#consumer-groups){:target="_blank" rel="noopener noreferrer"} is a logical grouping of consumers that read from an Event Hub independently. Multiple consumer groups can consume the same events without interfering with each other. This is the structural difference from a queue. The events stay in the partition log, and each consumer group holds its own offset (read position) into every partition.

```
                  ┌── Partition 0: [e0 e1 e2 e3 e4 e5 e6 ...]
Producers ──hash──┼── Partition 1: [e0 e1 e2 e3 e4 ...]
                  └── Partition 2: [e0 e1 e2 e3 e4 e5 ...]
                            ▲              ▲
   consumer group "analytics" offset ─────┘              (reading behind, at e2)
   consumer group "alerts"    offset ────────────────────┘   (caught up, at e5)
```

Consumers don't remove events. They advance their group's offset instead. The same event at partition 1 / position 3 can be unread by "analytics", already processed by "alerts", and captured to storage by a third group, all at once. Retention (not consumption) is what eventually drops an event from the log.

The Basic tier supports only the single default consumer group, so independent multi-consumer fan-out requires Standard or above (Standard allows 20 groups per event hub, Premium 100, Dedicated 1,000).

**How consumer groups work:**
- Create a consumer group for each independent consumer or consumer application
- Each consumer in the group is assigned one or more partitions to read from
- Event Hubs tracks the offset (position) for each consumer group in each partition
- When a consumer restarts, it resumes from its last committed offset, not from the beginning

**Competing consumer pattern:**
- Multiple consumer instances in the same consumer group process events from a single Event Hub
- Event Hubs distributes partitions among active instances (rebalancing when instances join or leave)
- Only one consumer instance reads from a given partition at a time
- This pattern scales processing by adding more consumer instances up to the number of partitions

**Example consumer group scenarios:**
- Consumer group "analytics" reads all events into a data warehouse
- Consumer group "alerts" reads the same events and triggers notifications when thresholds are exceeded
- Consumer group "archive" captures events to long-term storage
- All three groups consume independently at different rates without blocking each other

### Throughput Units and Capacity

Event Hubs pricing and scaling depend on throughput allocation. Azure offers three tiers with different scaling models:

**Standard Tier (throughput units):**
- Throughput Unit (TU) = 1 MB/sec inbound, 2 MB/sec outbound
- Allocate TUs at the namespace level
- Base allocation: 1-40 TUs
- Auto-inflate: Optionally scale up to a maximum TU count automatically
- Cost: Fixed hourly charge per TU

**Premium Tier (processing units):**
- Capacity is allocated in Processing Units (PUs): 1, 2, 4, 6, 8, 10, 12, or 16 per namespace
- Unlike a TU, a PU is not a fixed throughput throttle. It reserves isolated CPU, memory, and storage, and effective throughput depends on payload size, partition count, and consumer count (a namespace scales into the ~160 MB/sec range)
- PUs can be adjusted dynamically without downtime, but Premium has no automatic auto-inflate (that is a Standard-tier feature)
- Cost: Hourly charge per PU

**Dedicated Tier (capacity units):**
- Capacity Units (CUs) provide a single-tenant cluster with the most isolation
- Throughput is capacity-based rather than a fixed per-CU rate; Dedicated targets workloads beyond Premium's practical namespace range, scaled by adding CUs
- Suitable for massive scale (terabytes per day) and strict compliance isolation
- Availability-zone support requires a minimum of 8 CUs
- Cost: Monthly charge per CU; highest cost but maximum performance and isolation

**When to use each tier:**
- **Standard:** Development, testing, small-to-medium production workloads
- **Premium:** Production workloads requiring performance isolation and auto-scaling
- **Dedicated:** Large-scale ingestion (terabytes per day), strict compliance isolation, or when other tiers are cost-inefficient at your volume

### Event Hubs Capture

[Event Hubs Capture](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-capture-overview){:target="_blank" rel="noopener noreferrer"} automatically archives all events to Azure Blob Storage or Azure Data Lake Storage Gen 2 for long-term retention and batch processing.

**How Capture works:**
1. Enable Capture on the Event Hub
2. Specify a storage account and container (or Data Lake Storage path)
3. All events are automatically written to storage in Avro format
4. Events are organized by partition and flushed on whichever comes first: a time window (1-15 minutes) or a size window (10-500 MB)
5. A separate consumer group captures events without affecting application consumers

**Capture file structure:**
```
/mycontainer/ns/eh1/
├── 2025/02/10/12/
│   ├── 000000_0.avro
│   ├── 000001_1.avro
│   ├── 000002_2.avro
│   └── 000003_3.avro
└── 2025/02/10/13/
```

**Capture use cases:**
- Compliance auditing (retain all events for regulatory periods)
- Long-term analytics (query archived events with tools like Apache Spark)
- Disaster recovery (replay events from archive if application state is lost)
- Data science (process historical events without live stream consumption)
- Building data lakes from high-velocity sources

**Trade-offs:**
- Adds storage cost but enables historical replay
- Capture runs asynchronously; events reach storage with slight delay (typically <5 minutes)
- Decouples hot path (real-time consumers) from cold path (analytics and archive)

---

## Kafka Compatibility

Event Hubs supports the Apache Kafka protocol natively, allowing Kafka producers and consumers to connect to Event Hubs without code changes.

Kafka protocol requires the Standard tier or above; Basic does not support it.

**How it works:**
- Enable Kafka protocol on your Event Hub
- Kafka clients connect to the Event Hubs broker endpoint (e.g., `myns.servicebus.windows.net:9093`)
- Kafka topics map to Event Hubs entities; topic name = Event Hub name
- Kafka consumer groups map to Event Hubs consumer groups
- Kafka offsets are stored in Event Hubs offset storage

**Why Kafka compatibility matters:**
- Existing Kafka infrastructure (producers, consumers, Kafka Connect) works with Event Hubs
- No vendor lock-in if you use Kafka-compatible clients
- Hybrid scenarios where Kafka clusters feed events into Event Hubs for distribution
- Organizations with Kafka expertise can work with Event Hubs without learning new APIs

**Limitations:**
- Not all Kafka features are supported. Kafka transactions are unavailable, though log compaction is now supported on Standard and above
- Performance may differ from native Kafka clusters due to Azure infrastructure
- Schema formats differ slightly from Kafka (Event Hubs uses its own schema handling)

---

## Schema Registry

[Azure Schema Registry](https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview){:target="_blank" rel="noopener noreferrer"} provides central governance for event schemas used across producers and consumers.

**What Schema Registry solves:**
- Producers and consumers agree on event structure without hardcoding schema in code
- Schema evolution: define how schema can change while maintaining compatibility
- Centralized schema versioning: all producers use the same version unless explicitly overridden
- Serialization: built-in support for Avro and JSON schemas

**How to use Schema Registry:**
1. Define an event schema (Avro, JSON Schema, or Protocol Buffers)
2. Register the schema in Schema Registry, receiving a schema ID
3. Producers include the schema ID in events
4. Consumers look up the schema by ID to deserialize events
5. Evolve schemas by registering new versions with backward/forward compatibility rules

**Schema compatibility modes:**
- **Backward compatible:** New schema can be read by consumers expecting the old schema
- **Forward compatible:** Old schema can be read by consumers expecting the new schema
- **None:** No compatibility checking (breaking changes allowed)

---

## Integration Patterns

### Pattern 1: Stream Processing with Azure Stream Analytics

[Azure Stream Analytics](https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-introduction){:target="_blank" rel="noopener noreferrer"} consumes events from Event Hubs in real time, applies transformations and aggregations, and outputs results to storage or other services.

**Typical architecture:**
```
Devices → Event Hub → Stream Analytics → Data Lake / SQL Database
                         ↓
                      Power BI
```

**Use cases:**
- Real-time aggregations (count events per minute by type)
- Anomaly detection (alert when metric exceeds threshold)
- Data enrichment (join event stream with reference data)
- Windowed analytics (compute moving averages, percentiles)

### Pattern 2: Function-Based Processing

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-event-hubs){:target="_blank" rel="noopener noreferrer"} can trigger on Event Hubs events and perform lightweight, stateless processing.

**Typical architecture:**
```
Mobile App → Event Hub → Azure Function → Database / Queue
                              ↓
                        Third-party API
```

**Use cases:**
- Simple event transformations
- API calls triggered by specific event types
- Routing events to different destinations based on content
- Serverless consumer for variable-load scenarios

**Trade-offs vs Stream Analytics:**
- **Functions:** Simpler, cheaper for simple logic, less tooling overhead
- **Stream Analytics:** Better for complex streaming logic, stateful operations, windowing

### Pattern 3: Spark and Batch Analytics

[Azure Databricks](https://learn.microsoft.com/en-us/azure/databricks/){:target="_blank" rel="noopener noreferrer"} and [Apache Spark](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-kafka-spark-tutorial){:target="_blank" rel="noopener noreferrer"} can consume from Event Hubs using the Kafka connector for distributed processing of streaming data.

**Typical architecture:**
```
IoT Devices → Event Hub ← Spark Cluster (Databricks)
                             ↓
                        ML Models / Data Lake
```

**Use cases:**
- Machine learning model training on streaming data
- Complex transformations using Spark SQL
- Integration with data science workflows
- Batch window processing (e.g., process hourly batches of events)

---

## Event Hubs Tiers Comparison

| Feature | Basic | Standard | Premium | Dedicated |
|---------|-------|----------|---------|-----------|
| **Throughput** | 1 TU | Configurable (up to 40 TU) | Configurable (up to 16 PU) | Capacity-based (up to 20 CU) |
| **Max partitions per event hub** | 32 | 32 | 100 | 1,024 |
| **Consumer groups per event hub** | 1 (default only) | 20 | 100 | 1,000 |
| **Max retention** | 1 day | 7 days | 90 days | 90 days |
| **Max event size** | 256 KB | 1 MB | 1 MB | 20 MB |
| **Capture** | Not available | Priced separately | Included | Included |
| **Schema Registry** | Not available | Available | Available | Available |
| **Kafka protocol** | Not available | Available | Available | Available |
| **Scaling** | Fixed | Optional auto-inflate | Dynamic PU changes | Manual CU changes |
| **Cost** | Per message | Per TU-hour | Per PU-hour | Per CU-month |
| **Best for** | Dev/test | Production | High-isolation production | Massive scale |

**Tier selection:**

```
Need Capture, Kafka, more than one consumer group, or retention beyond 1 day?
├─ No — POC, learning, tiny throughput ─────────────────────────▶ Basic
└─ Yes
   ├─ Terabytes/day, single-tenant cluster, or sustained load
   │  beyond Premium's namespace range? ────────────────────────▶ Dedicated
   ├─ Need resource isolation, predictable low latency, CMK,
   │  90-day retention, or dynamic partition scale-out? ────────▶ Premium
   └─ Most production workloads (retention ≤ 7 days) ───────────▶ Standard
```

---

## Common Pitfalls

### Pitfall 1: Single Partition for Ordering, Hitting Throughput Limits

**Problem:** Using a single partition to guarantee global ordering, then finding that producers exceed the 1 MB/sec throughput limit of that partition.

**Result:** Write failures and application backpressure as producers wait for capacity. The ordering requirement prevents adding more partitions.

**Solution:** Accept partition-level ordering instead of global ordering. Use partition keys to ensure related events go to the same partition while distributing unrelated events across partitions. Most real-world scenarios benefit from this flexibility. If strict global ordering is truly required, use a queue (like Service Bus) instead.

---

### Pitfall 2: Consumer Lag Caused by Slow Consumers

**Problem:** Consumer applications process events slower than they arrive. The consumer group falls further behind, and events may expire before processing.

**Result:** Events are lost (or skipped in processing). Monitoring doesn't alert because the Event Hub itself is healthy; only the consumer is lagging.

**Solution:** Monitor consumer lag continuously (offset position vs latest event offset). Scale consumer instances horizontally up to the number of partitions. Optimize consumer processing logic. Consider moving heavy processing to a separate system (e.g., store minimal event in Event Hub, process in batch job).

---

### Pitfall 3: Partition Key Hot Spotting

**Problem:** Partition keys are not distributed evenly. Most events use the same key (e.g., a frequently active user ID or a single device), causing all traffic to route to one partition.

**Result:** One partition becomes a bottleneck while others sit idle. Total throughput is limited by the single hot partition.

**Solution:** Design partition keys to distribute evenly across expected cardinality. If a key has uneven distribution (e.g., one device sends 10x more events than others), consider not using a partition key and accepting round-robin distribution. Monitor partition-level metrics to detect hot spotting.

---

### Pitfall 4: Forgetting Event Retention Limits

**Problem:** Expecting consumers to restart and replay events from weeks ago, but retention is set to the default 1 day.

**Result:** Consumer restart causes data loss. Events older than retention are discarded and cannot be replayed.

**Solution:** Explicitly set retention to what your use case requires, but know the ceiling depends on tier. Standard caps at 7 days, while Premium and Dedicated reach 90. For anything longer (or full history), enable Capture to archive events to storage rather than relying on the retention window. Communicate retention limits to teams that depend on replay capability.

---

### Pitfall 5: Not Configuring Throughput Units Correctly

**Problem:** Allocating static TUs that match peak expected load during development, then running production at that peak continuously.

**Result:** Over-provisioned and expensive. Conversely, allocating too few TUs causes throttling.

**Solution:** Use Standard tier's auto-inflate feature (scale up to a max automatically) or Premium tier's auto-scaling. Monitor actual throughput and adjust over time. Start conservative and scale based on real usage patterns. Use consumption patterns to identify whether Standard or Premium better fits your cost model.

---

### Pitfall 6: Mixing Kafka and AMQP Clients Without Understanding Protocol Overhead

**Problem:** Using both Kafka clients and Event Hubs SDK clients in the same namespace, not realizing each protocol has different performance and connection characteristics.

**Result:** Unexpected performance issues or connection limit exhaustion (each protocol type has its own connection limits).

**Solution:** Choose one protocol and stick with it unless there's a compelling reason (e.g., legacy Kafka infrastructure alongside new Event Hubs consumers). Kafka protocol works well; the default Event Hubs AMQP protocol is tuned for the platform. Don't switch mid-stream.

---

## Key Takeaways

1. **Event Hubs is a streaming platform, not a message queue.** It retains events for replay and supports multiple independent consumers. Use it for high-volume telemetry, logs, and event streams; use Service Bus for transactional messaging patterns.

2. **Partitions are the fundamental scaling unit.** Each partition provides ordered delivery and throughput isolation. Design partition keys to distribute events evenly while keeping related events together for ordering.

3. **Consumer groups enable independent processing.** Multiple consumer groups can consume the same event stream at different rates without interference. This is a key architectural advantage over traditional queues.

4. **Capture decouples real-time and batch processing.** Enable Capture to automatically archive events to storage. This separates hot-path consumers from cold-path analytics and enables event replay for disaster recovery.

5. **Kafka compatibility provides protocol flexibility.** If you have existing Kafka infrastructure, Event Hubs Kafka protocol works natively. Otherwise, use the Event Hubs AMQP SDK for better performance and integration.

6. **Schema Registry provides governance without brittleness.** Use it to centralize schema definitions and manage evolution. Avoid hardcoding schemas in producer/consumer code.

7. **Throughput allocation must match your scale model.** Standard tier with auto-inflate suits most production workloads. Premium provides resource isolation and lets you adjust PUs dynamically (no automatic auto-inflate). Dedicated tier is for massive scale and compliance isolation.

8. **Consumer lag is a real-time operational metric.** Monitor it continuously. Lag indicates whether consumers are keeping up with incoming events. Act on growing lag immediately.

9. **Ordering within a partition is guaranteed; across partitions is not.** If you need strict ordering, you can have one partition, but this limits throughput. Most scenarios trade partition-level ordering for horizontal scalability.

10. **Event Hubs integrates naturally with Azure analytics services.** Stream Analytics, Functions, and Spark/Databricks all consume Event Hubs seamlessly for real-time processing, event-triggered actions, and batch analytics respectively.
