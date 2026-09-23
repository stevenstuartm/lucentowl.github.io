---
layout: guide
title: "Architecture Styles Overview"
category: Architecture
subcategory: Styles
description: "What an architecture style decides, how the nine common styles divide by deployment and partitioning, and a decision tree plus constraint and data topology checks for choosing a style that fits a system's priorities."
tags: [practical, architecture-styles, style-selection, technical-partitioning, domain-partitioning, modular-monolith]
---

Architecture styles are named patterns for organizing a system's components, data, and communication. Each style bundles a set of design decisions that shape the system's scalability, maintainability, performance, and resilience. Knowing the styles gives architects a shared vocabulary for comparing approaches and for making trade-offs based on what a system actually needs.

<blockquote class="pull-quote">
<p>Choosing a style selects defaults for how components communicate, where data lives, how the system deploys, and which characteristics come easily.</p>
</blockquote>

A layered monolith makes modularity easy but scalability hard. Microservices make independent deployment easy but operational complexity unavoidable. Event-driven architectures make responsiveness easy but debugging and state management hard. No style is best in general. The goal is to match a style's strengths to a system's priorities and to accept weaknesses the system can tolerate.

## What an Architecture Style Decides

Every style makes explicit or implicit decisions about five things.

**Component topology** is how the logical components are organized and related. Layered architectures organize by technical role, such as presentation, business logic, and persistence. Microservices organize by business capability, such as checkout, inventory, and shipping.

**Deployment** is whether the system ships as a single unit or as multiple independently deployed units. That choice affects deployment complexity, operational cost, and how failures propagate.

**Communication** is how components interact: synchronous request-response, asynchronous messaging, event broadcasts, or a mix. Each option trades performance, reliability, and complexity differently.

**Data topology** is where data lives and who owns it. A single shared database, domain-specific databases, and per-service databases each constrain consistency, transactions, and coupling differently.

**Packaging** is how the system is built and delivered: a single artifact, multiple services, containers, or serverless functions, each with different operational implications.

## How the Styles Divide

Two properties separate the common styles more cleanly than any list of strengths. The first is whether the style deploys as one unit or many. The second is whether its top-level components are partitioned by technical capability or by business domain.

| Style | Deployment | Top-level partitioning | Organizes around |
|---|---|---|---|
| **Layered** | Monolithic | Technical | Layers such as presentation, business logic, persistence, and database |
| **Pipeline** | Monolithic | Technical | Filters that transform data, connected by pipes |
| **Microkernel** | Monolithic | Technical or domain | A minimal core system extended by plug-ins, which may each cover a technical capability or a business area |
| **Modular monolith** | Monolithic | Domain | Business domain modules inside one deployment |
| **Service-based** | Distributed | Domain | A small number of coarse-grained domain services, usually sharing a database |
| **Event-driven** | Distributed | Technical | Event processors reacting asynchronously to events |
| **Microservices** | Distributed | Domain | Many fine-grained services, each owning its data |
| **Service-oriented (SOA)** | Distributed | Technical | Enterprise services by technical tier, integrated through a service bus |
| **Space-based** | Distributed | Technical or domain | Processing units backed by replicated in-memory data grids, often organized around the workload each unit handles |

Monolithic styles keep deployment, transactions, and operations simple, and limit how independently parts can scale and change. Distributed styles buy independent scaling, deployment, and fault isolation, and pay for them with network failures, eventual consistency, and operational complexity. If a system doesn't need the benefits of distribution, it shouldn't pay for them.

Partitioning matters as much as deployment. A technically partitioned style makes a single business change cut across every layer or tier. A domain-partitioned style keeps that change inside one module or service, which is why domain-partitioned monoliths tend to be easier to split later.

{% include figure.html id="arch-partitioning" %}

## Choosing a Style

Style selection starts from the architecture characteristics that matter most, then narrows by constraints and data topology.

### Start from the Driving Characteristics

The first question is whether a single set of architecture characteristics fits the whole system. If it does, a monolithic style can meet it. If different parts need genuinely different characteristics, those parts need to be separate quanta, and the system is distributed.

```
Does one set of architecture characteristics fit the whole system?
│
├─ Yes → monolithic style
│   ├─ Work is a sequence of data transformations ─────────────→ Pipeline
│   ├─ One core product customized per customer or market ────→ Microkernel
│   ├─ Domain boundaries matter, or distribution may come later → Modular monolith
│   └─ Small, simple system with a technically organized team ──→ Layered
│
└─ No → distributed style
    ├─ A few coarse domains, shared data acceptable ───────────→ Service-based
    ├─ Highly reactive, asynchronous workflows ────────────────→ Event-driven
    ├─ Extreme, unpredictable load on a hot path ──────────────→ Space-based
    ├─ Many independently evolving domains, mature operations ─→ Microservices
    └─ Existing enterprise service bus to integrate with ──────→ SOA (rarely for new systems)
```

The tree gives a starting point, not a verdict. Styles also combine. A service-based system often uses event-driven communication between some services, and a microkernel product might be layered inside its core.

### Then Apply the Constraints

**Budget and team size.** Small teams on tight budgets tend to do better with monolithic styles. Distributed styles require more infrastructure and more operational skill to run.

**Operational maturity.** Distributed styles depend on automated deployment, observability, and practiced incident response. Without them, a distributed architecture tends to overwhelm the team running it, however well it fits on paper.

**Domain complexity.** A simple domain rarely justifies the cost of microservices. A domain with many distinct bounded contexts that evolve at different speeds benefits more from domain-partitioned distributed styles.

**Existing systems and environment.** A system that must integrate with many legacy applications may need integration patterns regardless of greenfield preferences, and on-premises constraints can make container-orchestrated distribution impractical.

### Finally, Check Data Topology and Communication

**Where data lives** drives many downstream decisions. A single shared database keeps transactions simple but couples every component to one schema and one scaling point. Domain databases balance autonomy against complexity and keep transactions within a domain. Per-service databases maximize independence but force eventual consistency and sagas wherever a workflow spans services. A cross-service transaction requirement often signals that service boundaries are in the wrong place, or that the data topology should stay monolithic.

**How components communicate** has its own trade-off. Synchronous calls are simpler to reason about but couple availability and can cascade failures. Asynchronous messaging decouples components and absorbs load spikes but makes workflows harder to trace and debug. Synchronous is a sensible default unless responsiveness, scale, or failure isolation calls for asynchronous communication.

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
