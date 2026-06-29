---
layout: guide
title: "Event-Driven Architecture"
category: Architecture
subcategory: Styles
description: "Asynchronous event-based architecture enabling responsiveness, decoupling, and scalability through event brokers and reactive processors."
tags: [architecture, distributed-systems, messaging, scalability, async, practical]
---

Event-driven architecture organizes a system around asynchronous event broadcasts. Components publish events representing things that happened ("order placed," "payment processed," "inventory depleted"). Other components listen for events they care about and react accordingly. There's no direct coupling between event publishers and subscribers.

<blockquote class="pull-quote">
<p>Events announce what happened. Messages command what should happen. This distinction determines whether you have loose coupling or hidden dependencies.</p>
</blockquote>

This architecture enables high responsiveness, complex workflows with many independent reactions, and systems that must handle unpredictable, variable workloads.

## How It Works

An event broker sits at the center, receiving events from publishers and routing them to subscribers. When something significant happens in one part of the system, it publishes an event. The broker broadcasts the event to all interested subscribers. Each subscriber processes the event independently and may publish new derived events in response.

For example, an "order placed" event might trigger inventory reservation, payment processing, and shipping notification, all happening asynchronously and independently. Each processor does its work and publishes new events ("inventory reserved," "payment captured") that other processors might react to.

### Core Components

**Event Producers**: Components that detect significant occurrences and publish events. These can be user actions (button clicks), system events (scheduled tasks), or domain events (state changes).

**Event Broker**: Infrastructure that receives events and routes them to subscribers. Can be a message queue (RabbitMQ, AWS SQS), event stream (Kafka, AWS Kinesis), or pub/sub service (Google Pub/Sub, AWS SNS).

**Event Consumers/Processors**: Components that subscribe to specific event types and react. Each processor runs independently, processes the event, performs its logic, and potentially publishes new events.

**Event Store** (optional): Persistent log of all events for auditing, replay, or event sourcing patterns.

## Events vs Messages

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Events (Informational)</h4>
<ul>
<li>Announce what happened</li>
<li>State facts, not commands</li>
<li>Publisher doesn't know who reacts</li>
<li>Multiple subscribers react independently</li>
<li>Example: "Inventory depleted"</li>
<li><strong>Result:</strong> Maximum decoupling</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Messages (Prescriptive)</h4>
<ul>
<li>Command what should happen</li>
<li>Directed at specific receiver</li>
<li>Sender expects specific action</li>
<li>One-to-one communication</li>
<li>Example: "Replenish inventory"</li>
<li><strong>Result:</strong> Tighter coupling</li>
</ul>
</div>
</div>

Event-driven architectures use events. Publishers broadcast facts. Subscribers independently decide how to react. This maximizes decoupling.

## Architectural Patterns

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Choreographed Event-Driven</h4>
<p><strong>How it works:</strong> No central coordinator. Events broadcast freely, processors react independently.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>Maximum decoupling</li>
<li>Easy to add new reactions</li>
<li>No single point of failure</li>
<li>Highly scalable</li>
</ul>
<p><strong>Tradeoffs:</strong></p>
<ul>
<li>Workflows hard to trace</li>
<li>Complex error handling</li>
<li>Distributed state management</li>
</ul>
<p><strong>Use when:</strong> Complex workflows with many independent reactions</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Mediated Event-Driven</h4>
<p><strong>How it works:</strong> Orchestrator controls workflow, coordinates processors.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>Central workflow visibility</li>
<li>Easy to understand and debug</li>
<li>Explicit error handling</li>
<li>Complex logic support</li>
</ul>
<p><strong>Tradeoffs:</strong></p>
<ul>
<li>Reintroduces coupling</li>
<li>Potential bottleneck</li>
<li>Single point of failure</li>
<li>Reduced flexibility</li>
</ul>
<p><strong>Use when:</strong> Workflows need central control and visibility</p>
</div>
</div>

## Event Payload Strategies

### Data-Based Events

Events include all relevant data in the payload. An "OrderPlaced" event contains customer details, order items, prices, and addresses: everything needed to process the order.

**Advantages**:
- Subscribers process events immediately without additional queries
- Resilient (subscribers don't depend on other services being available)
- Fast (no network calls to fetch data)
- Works well offline or with eventual connectivity

**Tradeoffs**:
- Brittle (changing data structures breaks subscribers)
- Data duplication across events and subscribers
- Large event payloads consume bandwidth and storage
- Events contain data that not all subscribers need

**When to use**: High availability requirements, subscribers need complete data, network latency matters, subscribers should work even if source systems are down.

### Key-Based Events

Events include only identifiers. An "OrderPlaced" event contains the order ID. Subscribers query for full data when needed.

**Advantages**:
- Stable contracts (IDs rarely change)
- Small event payloads
- Data consistency (subscribers always fetch current data)
- Subscribers get only data they need

**Tradeoffs**:
- Slower (requires additional queries)
- Creates runtime dependencies on source services
- Higher latency
- Subscribers fail if source services are unavailable

**When to use**: Data changes frequently, consistency matters more than speed, event payloads would be very large, source services are highly available.

## Characteristics

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Simplicity** | ⭐⭐ | Asynchronous workflows are harder to reason about |
| **Scalability** | ⭐⭐⭐⭐⭐ | Excellent horizontal scaling, decoupled components |
| **Evolvability** | ⭐⭐⭐⭐ | Easy to add new reactions, harder to change events |
| **Deployability** | ⭐⭐⭐⭐ | Independent deployment of processors |
| **Testability** | ⭐⭐ | Difficult to test complete workflows |
| **Performance** | ⭐⭐⭐⭐⭐ | High responsiveness, asynchronous processing |
| **Fault Tolerance** | ⭐⭐⭐⭐ | Failures isolated to individual processors |

## When Event-Driven Architecture Fits

**Systems requiring high responsiveness**: Actions must happen quickly without waiting for synchronous processing. Users submit requests and get immediate confirmation. Processing happens asynchronously in the background.

**Complex workflows with many independent reactions to the same trigger**: When one event triggers multiple unrelated actions. User registration triggers: welcome email, analytics tracking, account provisioning, onboarding workflow, CRM record creation. These can all happen independently.

**Domains with unpredictable, variable workloads**: Asynchronous processing smooths demand spikes. Events queue up during high load. Processors work through the backlog at sustainable pace. The system remains responsive even under load.

**Systems where loose coupling is critical**: When parts of the system change frequently or when you need to add new capabilities without modifying existing components. Event-driven architecture enables this through the subscribe/publish pattern.

**IoT and real-time data processing**: Sensors publish events constantly. Multiple systems need to react (storage, analytics, alerting). Event-driven architecture handles high-volume streaming data naturally.

## When to Avoid Event-Driven Architecture

**Applications with deterministic workflows where certainty and control matter more than flexibility**: Financial transactions requiring strong consistency. Workflows where each step must complete before the next begins. Processes where audit trails must show exact ordering.

**Systems where understanding and debugging workflows is critical**: Regulated environments requiring clear workflow documentation. Domains where workflow changes require regulatory approval. Systems where debugging production issues must be straightforward.

**Teams without experience managing eventual consistency and distributed state**: Event-driven systems are eventually consistent. Different processors might temporarily see different state. If the team doesn't understand these challenges, they'll create data consistency bugs.

**Simple workflows that don't benefit from asynchronous processing**: If the workflow is linear with few steps, synchronous request/response is simpler. Don't add event-driven complexity unless you need its benefits.

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Watch Out For</p>
<p><strong>Nondeterministic side effects:</strong> Events trigger unpredictable numbers of reactions. You publish an event expecting three reactions but ten occur. <em>Solution: Make processors idempotent. Document expected reactions. Monitor actual behavior.</em></p>

**Static coupling via contracts**: Changing event structure breaks subscribers. Event evolution requires coordinating all subscribers. Solution: Version events. Support multiple event versions during transitions. Use flexible schemas (add fields, don't remove).

**Too much synchronous communication between processors**: Processors make synchronous calls to each other, defeating the asynchronous purpose. You've built a distributed monolith with event broker overhead. Solution: Processors should be fully independent. If they need data from others, subscribe to those events and maintain local copies.

**Difficult state management**: No single component knows the full system state. Debugging why something happened requires tracing event chains across multiple processors. Solution: Implement distributed tracing. Use correlation IDs on events. Maintain event stores for replay and auditing.

<p><strong>Event storms:</strong> A single event triggers cascades of derived events. The system bogs down processing events. <em>Solution: Be selective about what warrants an event. Implement circuit breakers. Monitor event volumes.</em></p>
</div>

## Evolution and Alternatives

When event-driven architecture stops fitting:

**Add workflow orchestration**: If choreography becomes too complex to understand and debug, introduce orchestrators for critical workflows while keeping event-driven patterns for independent reactions.

**Hybrid with synchronous services**: Use event-driven architecture for asynchronous workflows and independent reactions. Use synchronous services for queries and transactional operations. Many systems combine both.

**Implement CQRS and Event Sourcing**: If state management becomes problematic, fully commit to event sourcing. Store events as the source of truth. Build read models from events. This embraces the event-driven model completely.

For more architectural style options, see the [Architecture Styles](/study-guides/architecture/ArchitectureStyles.html) overview.
