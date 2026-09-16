---
layout: guide
title: "Modular Monolith Architecture"
category: Architecture
subcategory: Styles
description: "The domain-partitioned monolithic style: modules that own their domain end to end behind public interfaces, direct versus mediated module communication, shared versus module-owned data, how to enforce boundaries, and when to extract modules into services."
tags: [practical, modular-monolith, module-boundaries, domain-partitioning, bounded-context, in-process-events]
---

A modular monolith combines monolithic deployment with domain-partitioned organization. Instead of splitting the system into technical layers, it splits it into modules that each represent a business domain or bounded context. Each module contains what its domain needs, including business logic, data access, and often its own user interface and data model. The whole system still deploys as a single unit.

<blockquote class="pull-quote">
<p>A modular monolith gets clear domain boundaries from its code structure rather than from the network.</p>
</blockquote>

That combination gives teams domain-aligned boundaries and module ownership while keeping deployment, transactions, and operations simple. It also leaves a clean path to distribution later, because the boundaries a future service would need already exist.

## How It Works

The system divides into modules that represent business domains. An e-commerce system might have Catalog, Cart, Checkout, Inventory, and Shipping modules, each owning its domain logic end to end.

Each module exposes a public interface and hides everything else. Other modules use that interface without knowing the module's internal structure, which lets each module change its internals independently.

All modules still deploy together as one application, sharing a process, memory, and resources. Because the whole system deploys and runs as one unit, it is a single architecture quantum, however cleanly the modules are separated.

```
┌──────────────────────────── one deployable application ────────────────────────────┐
│                                                                                    │
│  ┌──────────── Checkout ────────────┐          ┌──────────── Inventory ───────────┐ │
│  │ public: ICheckoutService         │  calls   │ public: IInventoryService        │ │
│  │ ──────────────────────────────── │ ───────▶ │ ──────────────────────────────── │ │
│  │ internal: domain model, logic,   │          │ internal: domain model, logic,   │ │
│  │           data access            │          │           data access            │ │
│  └───────────────┬──────────────────┘          └───────────────┬──────────────────┘ │
└──────────────────┼─────────────────────────────────────────────┼────────────────────┘
                   ▼                                             ▼
          ┌─────────────────┐                           ┌─────────────────┐
          │ checkout schema │                           │ inventory schema│
          └─────────────────┘                           └─────────────────┘

Modules reach each other only through public interfaces, and each owns its own data.
```

### What a Module Contains

**Domain model**: The entities, value objects, and aggregates for the module's domain. In an Inventory module, that includes Product, Stock, Warehouse, and Reservation.

**Business logic**: The workflows and rules for the domain, such as stock allocation and reorder triggering.

**Data access**: The repositories or data access code that persist the module's domain objects.

**Public interface**: The contract other modules use, such as checking stock availability, reserving inventory, and releasing reservations.

**User interface or endpoints**, when applicable: Inventory management screens or stock-level APIs that belong to the module.

## How Modules Communicate

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Direct Calls Through Interfaces</h4>
<p>Modules call each other through public interfaces. Checkout depends on <code>IInventoryService</code> and calls <code>ReserveStock()</code>, and the Inventory module supplies the implementation at runtime.</p>
<p><strong>Advantages:</strong> Simple, fast in-process calls that are easy to follow and debug.</p>
<p><strong>Trade-offs:</strong> Checkout depends directly on Inventory's interface, so interface changes propagate to callers. Without care, dependencies can become circular.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Mediated Commands and Events</h4>
<p>Modules send commands and publish events through an in-process mediator. Checkout sends a <code>ReserveStockCommand</code>, the mediator routes it to Inventory's handler, and Inventory publishes a <code>StockReservedEvent</code> that interested modules handle.</p>
<p><strong>Advantages:</strong> Modules don't reference each other directly, which reduces how far changes propagate and prevents circular dependencies.</p>
<p><strong>Trade-offs:</strong> Control flow is indirect and harder to trace, and the team has to establish conventions for commands, events, and handlers.</p>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">Hybrid Approach</p>
<p>Many systems combine the two, using direct calls for queries and mediated events for domain events and workflow coordination.</p>
</div>

## Data Topology Options

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Shared Database with Module-Owned Schemas</h4>
<p>All modules share one database, and each module owns specific schemas or tables. Inventory owns the inventory tables, Catalog owns the product tables, and each module reads and writes only its own.</p>
<p><strong>Advantages:</strong> Transactions can span modules in one database, development patterns stay familiar, and reporting queries are easy when needed.</p>
<p><strong>Trade-offs:</strong> Other modules are tempted to query tables directly, boundaries are harder to enforce, and the shared schema can couple modules at the data level.</p>
<p><strong>Enforcement:</strong> Separate schemas with database permissions per module, plus reviews or architecture tests that flag cross-module table access.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Module-Owned Databases</h4>
<p>Each module has its own database, even though the application deploys as one unit. Modules can even use different database types, such as a relational store for Inventory and a document store for Catalog.</p>
<p><strong>Advantages:</strong> Data isolation that enforces module boundaries, and freedom to choose a storage technology per module.</p>
<p><strong>Trade-offs:</strong> No single transaction can span modules, so cross-module workflows need eventual consistency. Cross-module queries get harder, and there are more databases to operate.</p>
<p><strong>When to use:</strong> When modules are likely to be extracted into services, or when isolating certain data is required for security or compliance.</p>
</div>
</div>

## Enforcing Module Boundaries

A modular monolith's boundaries exist only in code, so they erode unless something enforces them. The compiler and the build can do much of that work.

**Separate projects per module.** Placing each module in its own project or assembly makes its dependencies explicit, and a reference from one module's internals to another's becomes a visible change to the project file.

**Language visibility.** In C#, marking implementation types `internal` leaves only the public interface visible outside the module's assembly.

**Architecture tests.** Tests in the build can fail when one module references another module's internal namespaces or data access code, catching violations that visibility rules miss.

**Data ownership rules.** Per-module database schemas and permissions stop modules from reaching into each other's tables even when the code would allow it.

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Modularity** | ⭐⭐⭐⭐⭐ | Domain-based modules with explicit interfaces |
| **Cost** | ⭐⭐⭐⭐⭐ | One application to run, with no distributed infrastructure |
| **Simplicity** | ⭐⭐⭐⭐ | Simpler than microservices, more structured than layered |
| **Evolvability** | ⭐⭐⭐⭐ | Modules change internally without affecting each other |
| **Testability** | ⭐⭐⭐⭐ | Modules can be tested behind their interfaces |
| **Deployability** | ⭐⭐⭐ | One deployment is simple, but every change ships the whole application |
| **Scalability** | ⭐⭐ | The application scales as a unit, not per module |
| **Fault tolerance** | ⭐⭐ | A failing module can take down the shared process |

## When a Modular Monolith Fits

**New systems whose domain is still being learned.** Boundaries can be discovered and adjusted while refactoring stays cheap. If services become necessary later, well-defined modules make extraction easier.

**Budgets that can't support distributed operations.** Distributed systems need sophisticated monitoring, orchestration, and operational skill. A modular monolith delivers domain boundaries and module ownership without that cost.

**Domain-aligned teams.** Each team can own a module end to end and refactor its internals without coordinating, while still sharing simple deployment and transactions. Releases remain coordinated, because every module ships together.

**Systems designed with domain-driven design.** Bounded contexts map naturally to modules, and context mapping and anti-corruption layers apply directly at module boundaries.

**A transitional step toward services.** When services are likely but the organization isn't ready for their operational cost, a modular monolith establishes the boundaries and contracts first, and modules move out when the benefit justifies it.

## When to Avoid a Modular Monolith

**Modules need different operational characteristics.** If one module needs much higher availability than the rest, or a very different scaling profile, a single deployment can't provide it without providing it to everything.

**Independent deployment is critical.** If teams must release changes without coordinating with the rest of the codebase, separately deployed services earn their operational cost.

**The organization already runs distributed systems well.** With mature DevOps practices and observability in place, and a genuine need for independent scaling or deployment, microservices may fit better.

**The domain is simple.** If a basic layered architecture would do, organizing by domain adds structure the system doesn't need.

## Common Pitfalls

**Modules that grow too large.** Without discipline, a module accumulates functionality and becomes a small monolith of its own. Revisit its domain and split it along subdomains when it starts serving unrelated purposes.

**Shared libraries that blur boundaries.** A shared library containing domain logic couples every module that uses it. Shared libraries suit cross-cutting concerns like logging and configuration. For domain logic, some duplication is often cheaper than the coupling.

**Chatty modules.** Modules that call each other for every operation have the coupling of a distributed system without its benefits. Modules that constantly talk probably belong together, so redraw the boundary.

**Reaching into another module's tables.** Querying another module's data directly breaks encapsulation at the data level. Enforce ownership through schemas, permissions, or separate databases.

**Circular dependencies.** Module A depends on B, which depends on A. Break the cycle by moving communication to events, extracting a shared domain concept, or reconsidering the boundaries.

## Evolution and Alternatives

When a modular monolith stops fitting:

**Extract modules into services.** Start with modules that need different operational characteristics, change often, or need independent scaling, and leave stable, low-change modules in the monolith. Module-owned data and interface-only communication make extraction much easier.

**Decouple modules further with in-process events.** If coordination between modules becomes complex, modules can publish domain events that others handle, reducing direct dependencies while deployment stays monolithic. Those events can later move onto a message broker if modules are extracted.

**Separate reads and writes inside a module.** When one module has very different read and write patterns, splitting its read model from its write model can help that module without changing the overall style.
