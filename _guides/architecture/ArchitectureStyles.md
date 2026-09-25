---
layout: guide
title: "Architecture Styles Overview"
category: Architecture
subcategory: Styles
description: "What choosing an architecture style settles in advance, how the nine common styles compare, and how to choose one: what would justify distribution, whether the team can carry it, and where data lives and how components talk."
tags: [practical, architecture-styles, style-selection, technical-partitioning, domain-partitioning, modular-monolith]
---

Architecture styles are named patterns for organizing a system's components, data, and communication. Each style bundles a set of design decisions that shape the system's scalability, maintainability, performance, and resilience. Knowing the styles gives architects a shared vocabulary for comparing approaches and for making trade-offs based on what a system actually needs.

<blockquote class="pull-quote">
<p>Choosing a style selects defaults for how components communicate, where data lives, how the system deploys, and which characteristics come easily.</p>
</blockquote>

A layered monolith makes modularity easy but scalability hard. Microservices make independent deployment easy but operational complexity unavoidable. Event-driven architectures make responsiveness easy but debugging and state management hard. No style is best in general. The goal is to match a style's strengths to a system's priorities and to accept weaknesses the system can tolerate.

## What a Style Settles

Follow one feature, placing an order, through two systems. In a layered monolith, the order screen, the pricing and stock rules, and the SQL that saves the order sit in three layers of one application. Saving the order and reserving stock happen in one database transaction, and a change to the order flow ships as a new release of the whole application. In a microservices system, the same feature spans an order service, an inventory service, and a payment service. Each owns its own data, they coordinate through calls and events, a reservation that fails has to be undone by a compensating step, and each service ships on its own schedule.

Nobody decided those differences feature by feature. They came with the style. A style settles in advance how the code is divided, how the pieces reach each other, where data lives and who may change it, and what gets built and released together. Choosing a style means choosing those defaults for every feature at once, which is why it is hard to reverse.

## Comparing the Styles

The biggest difference between styles is whether the system ships as one deployable unit or many. Monolithic styles keep deployment, transactions, and operations simple, and limit how independently parts can scale and change. Distributed styles buy independent scaling, deployment, and fault isolation, and pay for them with network failures, eventual consistency, and operational complexity. If a system doesn't need the benefits of distribution, it shouldn't pay for them.

| Style | Deploys as | Organizes around |
|---|---|---|
| **Layered** | One unit | Layers such as presentation, business logic, persistence, and database |
| **Pipeline** | One unit | Single-purpose filters connected by pipes, with data flowing one way |
| **Microkernel** | One unit | A stable core extended by plug-ins at known points of variation |
| **Modular monolith** | One unit | Business domain modules with enforced boundaries inside one deployment |
| **Service-based** | A handful of units | Coarse-grained domain services, often sharing a database |
| **Event-driven** | Many units | Components reacting asynchronously to events |
| **Microservices** | Many units | Fine-grained services, each owning its data |
| **Service-oriented (SOA)** | Many units | Shared services composed into processes through a central bus |
| **Space-based** | Many units | Processing units serving requests from replicated in-memory data |

The second difference is whether the code is organized by kind of work or by business capability, often described as packaging by layer versus packaging by feature. Organizing by layer makes a single business change cut across every layer. Organizing by capability keeps that change inside one module or service, which is also why a monolith organized by capability is easier to split later.

{% include figure.html id="arch-partitioning" %}

## Choosing a Style

### Ask What Would Justify Distribution

Distribution is the expensive decision, so settle it first by asking whether the system has a concrete need that only separate deployment can meet:

- **Teams blocked on each other's releases.** Several teams need to ship their parts on their own schedules, and coordinated releases are already slowing them down.
- **Parts with different operational needs.** One part needs far more scale, availability, or elasticity than the rest, and giving it to everything would be wasteful.
- **Failures that must stay contained.** A fault in one area must not take down the others.
- **Load that arrives in bursts.** Work can be absorbed asynchronously rather than handled the moment it arrives.

If none of these applies, choose a monolithic style. If one does, it usually points to the distributed style that addresses it.

```
Does the system have a need only separate deployment can meet?
│
├─ No → monolithic style, chosen by the shape of the work
│   ├─ Data moves through a sequence of transformations ─────→ Pipeline
│   ├─ One product customized per customer or market ────────→ Microkernel
│   ├─ Domain boundaries matter, or distribution may come later → Modular monolith
│   └─ Small, simple system with a technically organized team ──→ Layered
│
└─ Yes → distributed style, chosen by the need
    ├─ A few domains needing independent releases, shared data acceptable → Service-based
    ├─ Many independent reactions, or bursts to absorb ──────→ Event-driven
    ├─ Extreme, unpredictable load on a hot path ─────────────→ Space-based
    ├─ Many independently evolving domains, mature operations ─→ Microservices
    └─ An existing enterprise service bus to integrate with ──→ SOA (rarely for new systems)
```

The tree gives a starting point, not a verdict. Styles also combine. A service-based system often uses events between some services, and a microkernel product might be layered inside its core.

### Check Whether the Team Can Carry It

**Budget and team size.** Small teams on tight budgets tend to do better with monolithic styles. Distributed styles require more infrastructure and more operational skill to run.

**Operational maturity.** Distributed styles depend on automated deployment, observability, and practiced incident response. Without them, a distributed architecture tends to overwhelm the team running it, however well it fits on paper.

**Domain complexity.** A simple domain rarely justifies the cost of microservices. A domain with many distinct bounded contexts that evolve at different speeds benefits more from a style organized by business capability.

**Existing systems and environment.** A system that must integrate with many legacy applications may need integration patterns regardless of greenfield preferences, and on-premises constraints can make container-orchestrated distribution impractical.

### Decide Data and Communication Deliberately

A distributed style still leaves two decisions open, and both are expensive to change later.

**Where data lives** sets how much a transaction can cover. Keeping data in one shared database preserves transactions and joins across the system at the price of a single schema that couples everything. Splitting data by domain or by service buys independence and gives up those transactions, so any workflow that spans the split needs sagas and eventual consistency. A workflow that keeps needing a transaction across a split is a sign the split is in the wrong place.

**How components talk** trades simplicity against isolation. Synchronous calls are easy to follow but tie each caller's availability to everything it calls, so one slow service can stall a chain. Asynchronous messaging decouples components and absorbs load spikes but makes a workflow harder to trace. Richards and Ford's rule of thumb is to use synchronous communication by default and asynchronous communication where responsiveness, scale, or failure isolation requires it.

## Common Evolution Paths

Most systems do well starting simpler and adding complexity only when the benefits justify the cost.

<div class="callout callout--tip">
<p class="callout__title">A Typical Evolution Path</p>
<ol>
<li><strong>Start</strong>: Layered or modular monolith</li>
<li><strong>Evolve</strong>: Extract coarse-grained domain services (service-based architecture)</li>
<li><strong>Evolve</strong>: Refine selected services into finer-grained microservices where needed</li>
<li><strong>Add</strong>: Event-driven communication for asynchronous workflows</li>
<li><strong>Add</strong>: Space-based techniques for elastic hot paths</li>
</ol>
</div>

The path tends to follow the system's lifecycle. An early-stage product usually benefits from a layered or modular monolith, where speed of learning matters more than scale. A growing product often moves toward service-based architecture or a stricter modular monolith to gain some team autonomy without full distribution. Large systems with many teams and extreme scale or evolvability needs are where microservices and event-driven architectures tend to justify their cost.

Premature distribution is expensive and hard to reverse. When in doubt, start with the simpler style and let real needs drive the move to a more complex one.
