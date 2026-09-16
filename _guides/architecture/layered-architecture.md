---
layout: guide
title: "Layered Architecture"
category: Architecture
subcategory: Styles
description: "The technically partitioned monolithic style that organizes a system into presentation, business, persistence, and database layers: closed and open layers, layers of isolation, the architecture sinkhole anti-pattern, and when the style fits."
tags: [fundamentals, layered-architecture, n-tier, layers-of-isolation, architecture-sinkhole, technical-partitioning]
---

Layered architecture, also called n-tier architecture, organizes a system by technical capability rather than business function. The classic form has four layers: presentation, business logic, persistence, and database. Each layer has one kind of responsibility, and requests flow down through the layers and back up.

The layers are logical, and they don't dictate deployment. Many layered systems deploy the presentation, business, and persistence layers as one application with a separate database. Others split the presentation layer or the database onto their own servers. Whatever the physical arrangement, the style stays a monolith in the sense that matters, because a change to any layer ships as part of one application.

## How Requests Flow Through Layers

The presentation layer handles user interaction and hands business operations to the business layer. The business layer applies the domain rules and uses the persistence layer to read and write data. The persistence layer hides how data is stored, and the database stores it.

| Layer | Responsibilities | Must not |
|---|---|---|
| **Presentation** | User interaction, display logic, input validation, API endpoints | Contain business rules or access the database |
| **Business** | Domain logic, business rules, workflow coordination, business constraints | Know about UI concerns or contain SQL and data access code |
| **Persistence** | Data access behind interfaces, mapping between domain objects and schemas, queries and connections | Contain business rules or know about UI concerns |
| **Database** | Durable storage, integrity constraints, transactions | Hold business logic, since stored procedures that do tie business rules to the schema |

### Closed Layers and Layers of Isolation

A layer can be closed or open. A request can't skip a closed layer. It must pass through, so the presentation layer calls the business layer, which calls the persistence layer, and so on.

Closed layers create **layers of isolation**. Each layer knows only the interface of the layer beneath it, so a change inside one layer doesn't affect the others. If the persistence layer switches from raw SQL to an ORM, the business layer doesn't notice. Without closed layers, the presentation layer could end up coupled directly to database access code, and replacing the persistence approach would break it.

### Open Layers

An open layer can be bypassed. The common reason to open one is a shared services layer holding cross-cutting components such as logging, auditing, or date utilities. Placed below the business layer and marked open, it lets the business layer reach the persistence layer directly while still using the shared services when needed.

```
┌─────────────────────────────────────────┐
│ Presentation                   (closed) │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ Business                       (closed) │
└──────────┬───────────────────────┬──────┘
           ▼                       │ skips the open layer
┌──────────────────────────┐       │
│ Shared services   (open) │       │
└──────────┬───────────────┘       │
           ▼                       ▼
┌─────────────────────────────────────────┐
│ Persistence                    (closed) │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ Database                                │
└─────────────────────────────────────────┘
```

Open layers remove pass-through calls, but every open layer creates dependencies that cross layer boundaries and weakens isolation. Document which layers are open and why, because an undocumented open layer tends to become an excuse for bypassing every layer.

## The Architecture Sinkhole Anti-Pattern

<blockquote class="pull-quote">
<p>If most requests flow from presentation to persistence without meaningful business logic, the system pays the cost of layers without getting their benefits.</p>
</blockquote>

The architecture sinkhole happens when requests pass straight through layers with no processing, such as a read that the business layer forwards to persistence untouched. Some pass-through is normal. As a rule of thumb, if around 20 percent of requests are simple pass-throughs, that's acceptable overhead. If around 80 percent are, the layering isn't earning its cost.

<div class="callout callout--warning">
<p class="callout__title">What a Sinkhole Signals</p>
<p><strong>The layer boundaries are wrong.</strong> The technical concerns chosen for the layers don't match where the system's business logic actually runs.</p>
<p><strong>The system is mostly CRUD.</strong> With little business logic to host, the business layer adds ceremony without value. A simpler structure, or opening selected layers, fits better than forcing every request through all of them.</p>
</div>

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | Easy to understand and explain |
| **Cost** | ⭐⭐⭐⭐⭐ | Minimal infrastructure |
| **Scalability** | ⭐ | All layers scale together, with no independent scaling |
| **Fault tolerance** | ⭐ | A fault in one part of the application can take the whole application down |
| **Evolvability** | ⭐⭐ | A domain change usually touches every layer |
| **Deployability** | ⭐⭐ | One unit is simple to ship, but any change redeploys the whole application |
| **Testability** | ⭐⭐⭐ | Layers can be tested behind their interfaces with lower layers substituted |
| **Modularity** | ⭐⭐ | Technical partitioning scatters each domain concept across layers |

## When Layered Architecture Fits

**Small applications with straightforward business logic.** When the system is simple enough that organizing by technical concern makes sense, the layers cost little and keep responsibilities clear.

**Tight budgets and fast initial development.** The style is familiar, needs no distributed infrastructure, and lets teams build and deploy quickly.

**A starting point when requirements are unclear.** It provides a familiar structure while the team discovers what the system needs, and the system can move to another style later.

**MVPs and prototypes.** When speed to market matters more than long-term scalability or evolvability, the style gets something working quickly.

**Teams new to the domain.** When the team doesn't yet understand the business well enough to partition by domain, technical layers are a safe starting structure.

## When to Avoid Layered Architecture

**Scalability matters.** The presentation layer can't scale separately from business logic. Everything scales together, which wastes resources and limits maximum scale.

**Evolvability matters.** A change to a domain concept ripples through every layer. Adding a field to an order means touching presentation, business, persistence, and database code, which makes change slower and riskier.

**Parts need independent deployment.** The application deploys as one unit, so a small presentation change still ships the entire application. That limits deployment frequency and raises the risk of each release.

**Parts need different operational characteristics.** If one area needs high availability or a different scaling profile, the style can't give it one without giving it to everything.

**The codebase grows large.** With every domain concept spread across layers, finding where logic lives and understanding dependencies takes more and more context.

## Common Pitfalls

**Business logic leaking into the presentation layer.** UI code picks up business rules because it's convenient. The rules then get duplicated across clients, such as web and mobile, and become hard to test.

**Persistence logic leaking into the business layer.** Business code contains SQL or ORM-specific calls. That couples business rules to the database structure and defeats the layers of isolation.

**Too many layers.** Adding layers for "flexibility" without a clear purpose adds indirection and pass-through calls. Add a layer only when it isolates a concern that changes independently.

**Inconsistent layer rules.** Some components follow the layering strictly while others take shortcuts. Nobody can tell what the architecture's rules actually are, and the shortcuts multiply.

**An anemic domain model.** Business layer objects become data containers with no behavior, and all logic moves into service classes. This often signals that the domain would be better served by domain-driven design or a domain-partitioned style.

## Evolution and Alternatives

When layered architecture stops working:

**Evolve to a modular monolith.** Reorganize by business domain instead of technical layer, with each module containing its own presentation, business, and persistence code. Modularity improves while deployment stays simple.

**Evolve to service-based architecture.** Extract coarse-grained services for major business capabilities to gain independent scaling and deployment without the full complexity of microservices.

**Keep the layers but improve the business layer.** Applying domain-driven design's tactical patterns inside the business layer can improve maintainability without changing the style.
