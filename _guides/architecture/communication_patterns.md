---
layout: guide
title: "Communication Patterns"
category: Architecture
subcategory: Patterns
description: "How distributed services interact: synchronous request-response, parallel scatter-gather, asynchronous publish-subscribe with competing consumers, and durable event streaming with replay, compared by coupling, timing, and delivery."
tags: [practical, request-response, publish-subscribe, event-streaming, scatter-gather, synchronous-vs-asynchronous]
---

Communication patterns define how services and components interact in a distributed system. The choice decides whether a caller waits, how many parties receive a message, and whether a message can be read again later.

```
Request-response: the caller waits for one answer

Client ── request ──▶ Service
       ◀─ response ──

Scatter-gather: one request fans out in parallel, one combined answer

                       ┌──▶ Service A ──┐
Client ─▶ Aggregator ──┼──▶ Service B ──┼─▶ combined result ─▶ Client
                       └──▶ Service C ──┘

Publish-subscribe: one message, a copy for every subscriber

Publisher ─▶ topic ─┬─▶ Subscriber A
                    ├─▶ Subscriber B
                    └─▶ Subscriber C

Event streaming: an ordered, retained log that each consumer reads at its own position

Producer ─▶ [ e1 | e2 | e3 | e4 | e5 | e6 ]
                        ▲              ▲
             Consumer A offset   Consumer B offset
```

## Request-Response

A client sends a request and waits for the response before continuing.

**Use when**:
- The caller needs an immediate answer to proceed
- The operation requires confirmation before the next step
- The interaction is a read or a simple create, update, or delete
- A user interface needs real-time feedback

**Example**: An authentication service where a login request must return success or failure immediately, because the user can't proceed without it.

**Trade-offs**: Simple to implement and reason about, but the caller is coupled to the callee's availability and speed. Every synchronous call needs a timeout, and a chain of synchronous calls can turn one slow or failed service into a cascade.

## Scatter-Gather

*Pattern from Enterprise Integration Patterns by Gregor Hohpe and Bobby Woolf (2003)*

A request fans out to several services in parallel, and their responses are aggregated into a single result.

**Use when**:
- One answer needs data held by several services
- The services can be queried independently and in parallel
- A partial result is acceptable when some services don't respond

<div class="callout callout--tip">
<p class="callout__title">Key Considerations</p>
<ul>
<li>Overall response time is set by the slowest service, unless the aggregator stops waiting at a deadline</li>
<li>Partial failures need a deliberate policy, such as returning what arrived or failing the whole request</li>
<li>Results may need merging, ranking, or deduplication</li>
</ul>
</div>

**Example**: A travel search that queries several airline, hotel, and car rental providers at once and combines what comes back into one set of results.

## Publish-Subscribe

A publisher sends a message to a topic without knowing who will receive it, and each subscriber receives its own copy without knowing who sent it.

**Use when**:
- Several services need to react to the same occurrence
- Publishers shouldn't depend on who reacts
- Reactions can happen asynchronously
- Each consumer should scale independently

**Fan-out and competing consumers**: A topic delivers a copy of each message to every subscription, so inventory, payment, and notification services each receive the "order placed" message. Within a single subscription, several instances of the same service can share the work as competing consumers, where each message goes to only one instance. Fan-out decides which services hear about a message. Competing consumers decide how one service scales its processing.

**Example**: Placing an order publishes an "order placed" message, and the inventory, payment, shipping, and notification services each receive it and react independently.

**Trade-offs**: The publisher is decoupled from its subscribers, which is the point, but it also gets no confirmation that anything acted on the message. A failure surfaces in a subscriber rather than in the caller, so tracing one business operation means following it across several services. Brokers generally deliver at least once, so subscribers have to tolerate the same message arriving twice.

## Event Streaming

A stream is a durable, ordered log of events. Consumers read from it at their own position, and events stay in the log after they are read, so consumers can read them again.

**Use when**:
- Events must be processed continuously and in near real-time
- History matters, and consumers may need to replay past events
- Several consumers read the same events at different rates
- The system uses event sourcing or builds analytics from events

<div class="callout callout--note">
<p class="callout__title">What Makes a Stream Different</p>
<p><strong>Ordering</strong>: Events keep their order within a partition, though not necessarily across partitions</p>
<p><strong>Replay</strong>: A consumer can reprocess events from an earlier position</p>
<p><strong>Independent consumers</strong>: Each consumer tracks its own position in the log</p>
<p><strong>Retention</strong>: Events are kept for a configured period, or indefinitely</p>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Publish-Subscribe Messaging</h4>
<ul>
<li>A message is typically removed once each subscriber has received it</li>
<li>Consumers that join later usually don't see earlier messages</li>
<li>Replay generally isn't available</li>
<li>Simpler to operate</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Event Streaming</h4>
<ul>
<li>Events are retained for a configured period</li>
<li>New consumers can start from the beginning of retained history</li>
<li>Consumers can replay from an earlier position</li>
<li>More capable, and more to operate</li>
</ul>
</div>
</div>

**Example**: A trading platform streams price changes continuously, and a display service, a trading engine, and an analytics service each read the same stream at their own position.

**Common implementations**: Apache Kafka, Amazon Kinesis Data Streams, Apache Pulsar, Azure Event Hubs

## Quick Reference

| Pattern | Timing | Coupling | Receivers | Use case |
|---------|--------|----------|-----------|----------|
| **Request-Response** | Synchronous | High | One | Immediate answer required |
| **Scatter-Gather** | Synchronous, parallel | Medium | Several, results combined | One answer assembled from several services |
| **Publish-Subscribe** | Asynchronous | Low | Every subscriber gets a copy | Several services react to the same occurrence |
| **Event Streaming** | Asynchronous | Low | Every consumer, at its own position | Continuous processing, history, and replay |
