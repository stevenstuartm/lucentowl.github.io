---
layout: guide
title: "Event-Driven Architecture"
category: Architecture
subcategory: Styles
description: "The distributed style built on asynchronous events: choreographed versus orchestrated workflows, what an event should carry, keeping events from being lost or processed twice, and when the style's responsiveness justifies its complexity."
tags: [practical, event-driven-architecture, choreography, orchestration, event-payloads, asynchronous-processing]
---

Event-driven architecture organizes a system around asynchronous events. Components publish events that describe something that happened, such as "order placed," "payment processed," or "inventory depleted." Other components listen for the events they care about and react. Publishers don't call subscribers and usually don't know who they are.

<blockquote class="pull-quote">
<p>Events announce what happened. Messages ask for something to happen. Mixing the two up hides dependencies behind what looks like loose coupling.</p>
</blockquote>

The style suits systems that need high responsiveness, workflows where one trigger sets off many independent reactions, and workloads that are unpredictable and spiky.

## How It Works

When something significant happens, such as a user action, a scheduled job finishing, or a change in domain state, the component where it happened publishes an event to a channel. Components that care about that kind of event subscribe to the channel, do their own work when one arrives, and often publish events of their own describing what they did. The channel can be a topic on a broker such as RabbitMQ or Amazon SNS, a queue such as Amazon SQS, or a partition of a stream such as Kafka, depending on the delivery the system needs.

An "order placed" event might set off inventory reservation, payment processing, and a customer notification at the same time. Inventory publishes "inventory reserved" and payment publishes "payment captured," and those events trigger further reactions of their own. Some systems also keep every event in a durable log, for auditing, replaying history, or rebuilding state from events.

Components that interact only through asynchronous events can be separate architecture quanta, each deployable and scalable on its own. That independence disappears when components share a database or call each other synchronously, at which point the components involved behave as one quantum.

Designing an event-driven system comes down to three decisions: whether anything coordinates a multi-step workflow, what each event carries, and how the system keeps events from being lost or processed twice.

## Who Coordinates a Workflow

In a **choreographed** workflow, nothing is in charge. Each component reacts to the events it cares about and publishes new ones, and the workflow is whatever those reactions add up to. In an **orchestrated** workflow, a coordinator receives the event that starts the workflow and directs each step in order, tracking progress as it goes. Integration frameworks and workflow engines such as AWS Step Functions or Temporal commonly play that role. Mark Richards calls these the broker and mediator topologies.

{% include figure.html id="arch-eda-topologies" %}

| | Choreographed | Orchestrated |
| --- | --- | --- |
| **Coupling** | Components know only the events, never each other | Components are coupled to the coordinator's workflow |
| **Adding a reaction** | Subscribe a new component; nothing else changes | Change the coordinator |
| **Workflow state** | Nowhere in particular, so it has to be reconstructed from events | Visible in one place |
| **Failures** | Hard to handle consistently, and a half-finished workflow is hard to restart | Retried and recovered centrally, and restartable |
| **Bottleneck risk** | None from coordination | The coordinator, unless it is made highly available |
| **Suits** | One event fanning out to many independent reactions | Ordered steps, conditional logic, or central error handling |

Many systems use both, orchestrating the few workflows that need control and letting everything else react to events.

## What an Event Carries

An event states a fact: something already happened, and the publisher doesn't know or care who reacts. A request that something happen, such as "replenish inventory," is a message aimed at a receiver that is expected to act. Publishing a request as if it were an event keeps the dependency on the receiver but hides it where no interface shows it, so the loose coupling is only apparent.

The next question is how much data a fact carries. An "OrderPlaced" event can include everything subscribers might need, such as the customer, items, prices, and shipping address, or just the order's identifier, leaving subscribers to fetch what they need.

{% include figure.html id="arch-eda-payloads" %}

| | Full state in the event | Identifier only |
| --- | --- | --- |
| **Subscriber work** | Acts immediately, with no query | Queries the source for the details it needs |
| **Source outage** | Subscribers keep working | Subscribers stall until the source is back |
| **Data seen** | The state when the event happened | The state when the subscriber asks, which may have changed since |
| **Contract change** | Changing the payload can break every subscriber | Identifiers rarely change, so the contract stays stable |
| **Size** | Large payloads, much of it unused by any one subscriber | Small payloads |
| **Suits** | Subscribers that need most of the data, must survive source outages, or are latency-sensitive | Data that changes often, very large records, and highly available sources |

## Keeping Events from Being Lost or Repeated

A broker can guarantee that an event is delivered at least once, but only if producers and consumers do their part, and at-least-once means a consumer will sometimes see the same event twice. The design goal is that no event disappears and that a repeated one does no harm.

**Publish durably.** Configure the channel to persist events, and have producers wait for the broker to confirm it has stored each one before treating it as sent.

**Publish in step with the state change.** Saving state and publishing the event that describes it are two separate writes, and a crash between them leaves them disagreeing. Recording the event in the same database transaction as the state change, then publishing it from there, keeps them together. The transactional outbox pattern does exactly this.

**Acknowledge after the work commits.** A consumer should acknowledge an event only after its own changes are saved. If it crashes first, the broker redelivers the event rather than losing it.

**Make consumers safe to repeat.** Redelivery means duplicates. A consumer that records which events it has processed, or whose effects are naturally idempotent, can take the same event twice without doing the work twice.

**Move failing events aside.** An event that can't be processed shouldn't block the ones behind it. Route it to a dead letter channel or a repair workflow, and alert on those failures, because a growing backlog of them usually points to a systemic problem rather than bad luck.

## When Event-Driven Architecture Fits

**High responsiveness.** Users get immediate confirmation while processing continues in the background.

**Many independent reactions to one trigger.** A user registration might set off a welcome email, analytics tracking, account provisioning, and a CRM record, none of which depends on the others. Each reaction runs in parallel, and one failing doesn't stop the rest.

**Unpredictable, spiky workloads.** Events queue up during peaks and processors work through the backlog, so the system stays responsive under load.

**Loose coupling as a priority.** New capabilities can be added by subscribing to existing events, without modifying the components that publish them. Changing an event that already has subscribers is the hard direction, since every subscriber depends on its shape.

**IoT and real-time data.** Sensors publish constantly, and storage, analytics, and alerting all need to react to the same stream.

## When to Avoid Event-Driven Architecture

**Deterministic workflows that need strict control.** Financial operations requiring strong consistency, and processes where each step must finish before the next begins, fit a synchronous or orchestrated design better.

**Workflows that must be easy to understand and audit.** In regulated environments, or wherever a workflow's exact path must be documented and debugged quickly, a web of asynchronous reactions works against that. End-to-end tests of such a web are also hard to make deterministic.

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

**Add orchestration for critical workflows.** If choreography becomes too hard to follow, put a coordinator in charge of the workflows that need control, and keep events for independent reactions.

**Combine with synchronous services.** Use events for asynchronous workflows and independent reactions, and synchronous calls for queries and transactional operations. Where a caller truly needs a response to an event-driven request, a request-reply exchange with a correlation ID and a reply channel can provide it.

**Make events the source of truth.** If reconstructing state becomes the main problem, event sourcing stores the events themselves as the system of record and builds read models from them, committing fully to the event-driven model.
