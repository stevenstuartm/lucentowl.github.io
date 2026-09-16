---
layout: guide
title: "Event-Driven Architecture"
category: Architecture
subcategory: Styles
description: "The distributed style built on asynchronous events: broker and mediator topologies, events versus messages, data-based versus key-based payloads, preventing data loss and handling errors, and when the style's responsiveness justifies its complexity."
tags: [practical, event-driven-architecture, broker-topology, mediator-topology, event-payloads, asynchronous-processing]
---

Event-driven architecture organizes a system around asynchronous events. Components publish events that describe something that happened, such as "order placed," "payment processed," or "inventory depleted." Other components listen for the events they care about and react. Publishers don't call subscribers and usually don't know who they are.

<blockquote class="pull-quote">
<p>Events announce what happened. Messages ask for something to happen. Mixing the two up hides dependencies behind what looks like loose coupling.</p>
</blockquote>

The style suits systems that need high responsiveness, workflows where one trigger sets off many independent reactions, and workloads that are unpredictable and spiky.

## How It Works

When something significant happens, a component publishes an event to an event channel. Interested components, called event processors, receive it, do their work independently, and may publish new events describing what they did.

An "order placed" event might set off inventory reservation, payment processing, and a customer notification at the same time. Inventory publishes "inventory reserved" and payment publishes "payment captured," and those events trigger further reactions of their own.

### Core Components

**Event producers** detect significant occurrences and publish events. The occurrence might be a user action, a scheduled job, or a change in domain state.

**Event channels** carry events from producers to processors. Depending on the delivery the system needs, a channel might be a topic on a message broker such as RabbitMQ or Amazon SNS, a queue such as Amazon SQS, or a partition of an event stream such as Kafka.

**Event processors** subscribe to event types, perform their piece of the work, and often publish derived events.

**An event store**, optionally, keeps a durable log of events for auditing, replay, or event sourcing.

### Quantum Boundaries

Processors that communicate only through asynchronous events can be separate architecture quanta, each deployable and scalable on its own. That independence disappears when processors share a database or call each other synchronously, at which point the processors involved behave as one quantum.

## Events vs Messages

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Events</h4>
<ul>
<li>Announce something that already happened</li>
<li>State a fact rather than make a request</li>
<li>The publisher doesn't know who reacts</li>
<li>Any number of subscribers react independently</li>
<li>Example: "Inventory depleted"</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Messages</h4>
<ul>
<li>Request that something happen</li>
<li>Are directed at a specific receiver</li>
<li>The sender expects a particular action</li>
<li>One sender, one receiver</li>
<li>Example: "Replenish inventory"</li>
</ul>
</div>
</div>

Events keep publishers independent of whoever reacts, which is the source of the style's flexibility. A message sent as if it were an event, such as publishing "replenish inventory" to a topic and assuming the warehouse service will act, keeps the dependency but hides it where no interface shows it.

## Broker and Mediator Topologies

Event-driven systems take one of two basic shapes, depending on whether anything coordinates the workflow.

```
Broker topology: no coordinator, processors react and publish

                          ┌─▶ Inventory ─── "inventory reserved" ─┐
Order ─ "order placed" ───┼─▶ Payment ───── "payment captured" ───┼─▶ further processors
                          └─▶ Notification

Mediator topology: a mediator directs the steps of the workflow

                                   ┌─ step 1 ─▶ Inventory
Order ─ "order placed" ─▶ Mediator ┼─ step 2 ─▶ Payment      (after step 1 succeeds)
                                   └─ step 3 ─▶ Notification (after step 2 succeeds)
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Broker Topology</h4>
<p><strong>How it works:</strong> There is no central coordinator. Processors receive events from channels, do their work, and broadcast new events.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>Processors are highly decoupled</li>
<li>New reactions can be added without changing existing processors</li>
<li>No coordinator to become a bottleneck or single point of failure</li>
<li>High scalability and responsiveness</li>
</ul>
<p><strong>Trade-offs:</strong></p>
<ul>
<li>No component knows the state of the overall workflow</li>
<li>Error handling and recovery are hard to coordinate</li>
<li>Restarting a failed workflow is difficult</li>
</ul>
<p><strong>Use when:</strong> One event sets off many independent reactions, and none needs to know whether the others succeeded.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Mediator Topology</h4>
<p><strong>How it works:</strong> An event mediator receives the initiating event and sends processing steps to processors in order, tracking the workflow as it goes. Integration frameworks and workflow or BPM engines are common mediators.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>The workflow's state and progress are visible in one place</li>
<li>Errors can be handled, retried, and recovered centrally</li>
<li>Complex conditional logic is easier to express</li>
</ul>
<p><strong>Trade-offs:</strong></p>
<ul>
<li>Processors are coupled to the mediator's workflow</li>
<li>The mediator can become a bottleneck</li>
<li>The mediator is a single point of failure unless made highly available</li>
<li>Adding a reaction means changing the mediator</li>
</ul>
<p><strong>Use when:</strong> The workflow has ordered steps, needs central error handling, or must be restartable.</p>
</div>
</div>

Many systems use both, with mediators for the few workflows that need control and broker-style events for everything else.

## Event Payload Strategies

### Data-Based Events

The event carries all the data subscribers need. An "OrderPlaced" event includes customer details, items, prices, and the shipping address.

**Advantages**:
- Subscribers can act immediately, without querying anything
- Subscribers keep working even when the publishing service is down
- No extra network calls, so processing is faster

**Trade-offs**:
- Changing the event's structure can break every subscriber
- Data is duplicated across events and subscribers
- Large payloads cost bandwidth and storage
- Most subscribers receive data they don't need

**When to use**: When subscribers must keep working if source systems are unavailable, when they need most of the data anyway, and when latency matters.

### Key-Based Events

The event carries only identifiers. An "OrderPlaced" event contains just the order ID, and subscribers fetch the details they need.

**Advantages**:
- Contracts stay stable, because identifiers rarely change
- Payloads stay small
- Each subscriber fetches only the data it needs

**Trade-offs**:
- Every subscriber adds a query, which adds latency
- Subscribers depend on the source service being available at runtime
- A subscriber sees the data as it is when it asks, which may differ from its state when the event occurred

**When to use**: When data changes frequently and subscribers need its latest state, when full payloads would be very large, and when source services are highly available.

## Preventing Data Loss and Handling Errors

Asynchronous processing opens gaps where an event can disappear. It can be lost between the producer and the channel, between the channel and a processor, or in the processor after it has taken the event but before its work is saved.

**Make channels durable.** Configure the broker to persist events, and have producers wait for the broker to confirm receipt.

**Acknowledge after the work is saved.** A processor should acknowledge an event only after its database changes commit. If it crashes first, the broker redelivers the event. Since that means an event can arrive more than once, processors need to handle duplicates safely.

**Publish reliably.** Saving state and publishing the resulting event are two separate writes. Recording the event in the same database transaction as the state change, and publishing it afterward, keeps the two from diverging.

**Don't block on a failing event.** When an event can't be processed, move it aside, for example to a dead letter channel or a separate repair workflow, so the events behind it keep flowing. Track and alert on those failures, because a backlog of them usually points to a systemic problem rather than bad luck.

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Scalability** | ⭐⭐⭐⭐⭐ | Processors scale horizontally and independently |
| **Performance** | ⭐⭐⭐⭐⭐ | Work runs in parallel and callers don't wait on it |
| **Fault tolerance** | ⭐⭐⭐⭐ | A failing processor doesn't stop the others |
| **Evolvability** | ⭐⭐⭐⭐ | New reactions are easy to add, while changing existing events is hard |
| **Deployability** | ⭐⭐⭐⭐ | Processors deploy independently |
| **Testability** | ⭐⭐ | End-to-end workflows are hard to test deterministically |
| **Simplicity** | ⭐⭐ | Asynchronous workflows are hard to reason about |

## When Event-Driven Architecture Fits

**High responsiveness.** Users get immediate confirmation while processing continues in the background.

**Many independent reactions to one trigger.** A user registration might set off a welcome email, analytics tracking, account provisioning, and a CRM record, none of which depends on the others.

**Unpredictable, spiky workloads.** Events queue up during peaks and processors work through the backlog, so the system stays responsive under load.

**Loose coupling as a priority.** New capabilities can be added by subscribing to existing events, without modifying the components that publish them.

**IoT and real-time data.** Sensors publish constantly, and storage, analytics, and alerting all need to react to the same stream.

## When to Avoid Event-Driven Architecture

**Deterministic workflows that need strict control.** Financial operations requiring strong consistency, and processes where each step must finish before the next begins, fit a synchronous or orchestrated design better.

**Workflows that must be easy to understand and audit.** In regulated environments, or wherever a workflow's exact path must be documented and debugged quickly, a web of asynchronous reactions works against that.

**Teams new to eventual consistency.** Different processors temporarily see different states. Teams unfamiliar with that tend to introduce consistency bugs.

**Simple, linear workflows.** A short sequence of steps is simpler as synchronous request-response.

## Common Pitfalls

**Unexpected reactions.** A published event triggers more reactions than anyone planned for, because any component can subscribe. Make processors safe against duplicates, document which reactions each event is expected to cause, and monitor what actually happens.

**Coupling through event contracts.** Changing an event's structure breaks its subscribers, so events are contracts even when no one calls them that. Version events, support more than one version during transitions, and prefer additive changes over removing fields.

**Synchronous calls between processors.** Processors that call each other directly defeat the asynchronous design and produce a distributed monolith with broker overhead. A processor that needs another's data can subscribe to its events and keep a local copy.

**Untraceable workflows.** No component knows the full state of a workflow, and debugging means tracing event chains across processors. Propagate a correlation ID on every event, use distributed tracing, and keep an event store where replay and auditing matter.

**Event storms.** One event triggers a cascade of derived events that overwhelms the system. Be selective about what deserves an event, watch event volumes, and throttle processors that feed runaway cascades.

## Evolution and Alternatives

When event-driven architecture stops fitting:

**Add orchestration for critical workflows.** If broker-style choreography becomes too hard to follow, introduce a mediator for the workflows that need control, and keep events for independent reactions.

**Combine with synchronous services.** Use events for asynchronous workflows and independent reactions, and synchronous calls for queries and transactional operations. Where a caller truly needs a response to an event-driven request, a request-reply exchange with a correlation ID and a reply channel can provide it.

**Make events the source of truth.** If reconstructing state becomes the main problem, event sourcing stores the events themselves as the system of record and builds read models from them, committing fully to the event-driven model.
