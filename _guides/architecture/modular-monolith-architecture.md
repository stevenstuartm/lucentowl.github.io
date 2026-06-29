---
layout: guide
title: "Modular Monolith Architecture"
category: Architecture
subcategory: Styles
description: "Domain-driven monolithic architecture partitioning by business capabilities while deploying as a single unit for operational simplicity."
tags: [architecture, monolithic, domain-driven-design, modularity, practical]
---

Modular monolith combines monolithic deployment with domain-driven component organization. Instead of organizing by technical layers, the system partitions by business domains or bounded contexts. Each module encapsulates everything needed for its domain: UI components, business logic, data access, and often domain-specific data models. But the entire system still deploys as a single unit.

<blockquote class="pull-quote">
<p>Many benefits of microservices without the operational complexity of distributed systems.</p>
</blockquote>

This architecture provides domain autonomy, team independence, and clear boundaries while maintaining simple deployment and transactions.

## How It Works

The system partitions into modules representing business domains. An e-commerce system might have modules for Catalog, Cart, Checkout, Inventory, and Shipping. Each module owns its domain logic end-to-end.

Modules expose well-defined interfaces and hide implementation details. Other modules interact through these interfaces without knowing internal structure. This encapsulation enables modules to evolve independently.

Despite logical separation, all modules deploy together as a single application. They share the same process, memory space, and resources. Deployment remains simple: one artifact, one deployment.

### Module Structure

Each module typically contains:

**Domain model**: Entities, value objects, and aggregates representing core domain concepts. In the Inventory module, this includes Product, Stock, Warehouse, Reservation.

**Business logic**: Services implementing domain workflows and business rules. Inventory management, stock allocation, reorder triggering.

**Data access**: Repositories or data access objects abstracting persistence. How the module stores and retrieves its domain objects.

**API/Interface**: Public contracts exposed to other modules. Methods for checking stock availability, reserving inventory, releasing reservations.

**UI components** (if applicable): Module-specific views, forms, or API endpoints. Inventory management screens, stock level APIs.

## Communication Patterns

Modules must communicate. Two patterns dominate:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Peer-to-Peer Communication</h4>
<p>Modules call each other directly through interfaces. The Checkout module calls the Inventory module's <code>reserveStock()</code> method.</p>
<p><strong>How it works:</strong> Modules depend on interfaces, not implementations. The Checkout module depends on <code>IInventoryService</code> interface. At runtime, the actual Inventory module implementation fulfills the interface.</p>
<p><strong>Advantages:</strong> Simple, fast (in-process calls), easy to debug, low latency, straightforward to implement.</p>
<p><strong>Tradeoffs:</strong> Creates direct coupling between modules. If the Inventory interface changes, Checkout must update. Changes propagate through dependency chains. Circular dependencies become possible if not carefully managed.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Mediator Communication</h4>
<p>Modules communicate through a mediator abstraction layer that routes requests. Modules publish commands or events to the mediator. The mediator routes them to appropriate handlers in other modules.</p>
<p><strong>How it works:</strong> Checkout publishes a <code>ReserveStockCommand</code>. The mediator routes it to the Inventory module's command handler. The handler processes the command and publishes a <code>StockReservedEvent</code>. The mediator routes the event to interested modules.</p>
<p><strong>Advantages:</strong> Modules don't depend on each other directly. The Checkout module doesn't know the Inventory module exists. This decouples modules and reduces propagating changes.</p>
<p><strong>Tradeoffs:</strong> Adds indirection and complexity. Debugging is harder (control flow goes through the mediator). The mediator can become a bottleneck. Requires establishing patterns for commands, events, and handlers.</p>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">Hybrid Approach</p>
<p>Many systems use a hybrid approach: synchronous peer-to-peer calls for queries and mediator patterns for domain events and workflow coordination.</p>
</div>

## Data Topology Options

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Shared Database with Module Schemas</h4>
<p>All modules share one database but each module owns specific tables/schemas. The Inventory module owns inventory-related tables. The Catalog module owns product tables. Modules access only their own tables.</p>
<p><strong>Advantages:</strong> Simple transactions across modules (same database), familiar development patterns, easy queries when needed.</p>
<p><strong>Tradeoffs:</strong> Schema coupling (other modules might be tempted to query your tables directly), harder to enforce boundaries, database can become a shared dependency that couples modules.</p>
<p><strong>Enforcement:</strong> Use database schemas, security permissions, or code review processes to prevent modules from accessing each other's tables.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Module-Specific Databases</h4>
<p>Each module has its own database. Despite deploying as a monolith, modules use separate datastores. The Inventory module uses its own database. The Catalog module uses its own database.</p>
<p><strong>Advantages:</strong> True data isolation, enforces module boundaries, enables different database types per module (Inventory uses PostgreSQL, Catalog uses MongoDB).</p>
<p><strong>Tradeoffs:</strong> Cross-module queries become complex, transactions spanning modules require distributed transaction patterns (or workflow-based consistency), higher operational complexity.</p>
<p><strong>When to use:</strong> When you're preparing to eventually extract modules as microservices, or when data isolation is critical for security or compliance.</p>
</div>
</div>

## Characteristics

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Simplicity** | ⭐⭐⭐⭐ | Simpler than microservices, more structured than layered |
| **Scalability** | ⭐⭐ | Scales as a unit; can't scale modules independently |
| **Evolvability** | ⭐⭐⭐⭐ | Modules evolve independently within boundaries |
| **Deployability** | ⭐⭐⭐⭐ | Single deployment unit is simple |
| **Testability** | ⭐⭐⭐⭐ | Modules testable independently |
| **Modularity** | ⭐⭐⭐⭐⭐ | Excellent domain-based modularity |
| **Cost** | ⭐⭐⭐⭐⭐ | Low operational cost; no distributed system complexity |

## When Modular Monolith Fits

**New systems where requirements aren't fully understood**: Start with a modular monolith. Learn the domain. Discover the right boundaries. Refactor modules as understanding grows. If you eventually need microservices, well-defined modules make extraction easier.

**Organizations with tight budgets that can't support distributed system operations**: Distributed systems require sophisticated monitoring, orchestration, and operational expertise. Modular monoliths deliver many benefits (modularity, team autonomy, clear boundaries) without the operational cost.

**Teams organized by business domains who want independence**: Domain teams can own modules end-to-end. The Inventory team owns the Inventory module completely. They can refactor internals without coordinating with other teams. But they still benefit from simple deployment and transactions.

**Systems practicing Domain-Driven Design**: Modular monoliths align naturally with DDD bounded contexts. Each module represents a bounded context. Context boundaries become module boundaries. Strategic design patterns (context mapping, anti-corruption layers) apply directly.

**Transitional architecture toward microservices**: If you know you'll eventually need microservices but aren't ready for the operational complexity, start with a modular monolith. Establish good boundaries and module contracts. Extract modules to services when the benefits justify the costs.

## When to Avoid Modular Monolith

**Applications requiring different operational characteristics for different components**: If some modules need extreme availability (99.99%) while others can tolerate downtime, or some modules need different scaling characteristics, modular monoliths can't accommodate these differences.

**Systems where frequent independent deployment of features matters more than operational simplicity**: If deploying changes quickly without coordinating across the codebase is critical, microservices' independent deployment becomes more valuable than the monolith's operational simplicity.

**Organizations comfortable with distributed system complexity**: If your organization already operates distributed systems successfully, has mature DevOps practices, and sophisticated observability, microservices might fit better if you need their scaling or deployment benefits.

**Very simple applications**: If the system is simple enough that a basic layered architecture suffices, modular monoliths add unnecessary complexity. Don't organize by domain if there's minimal domain complexity.

## Common Pitfalls

**Modules grow too large**: Without discipline, modules accumulate functionality and become mini-monoliths themselves. Solution: Apply domain-driven design. Break large modules into subdomains. Enforce single responsibility.

**Excessive code reuse blurs boundaries**: Shared utility libraries become shared dependencies that couple modules together. When the library changes, all modules must update and redeploy. Solution: Duplicate code rather than share if the duplication maintains independence. Shared libraries are acceptable for truly cross-cutting concerns (logging, configuration) but not for domain logic.

**Excessive inter-module communication**: Modules constantly call each other for every operation. You've created distributed system complexity (chattiness, tight coupling) without distributed system benefits (independent scaling and deployment). Solution: Redesign module boundaries. Modules that constantly talk probably belong together.

**Shared database temptation**: Modules access each other's tables directly instead of going through interfaces. This breaks encapsulation and couples modules at the data level. Solution: Enforce boundaries through code review, security permissions, or separate databases.

**Circular dependencies**: Module A depends on Module B which depends on Module A. This creates tight coupling and makes understanding the system hard. Solution: Introduce a mediator, extract a shared domain concept, or reconsider boundaries.

## Evolution and Alternatives

When modular monolith stops fitting:

**Extract modules to microservices**: Well-defined modules with clear interfaces make extraction straightforward. Start with modules that have different operational characteristics, high change frequency, or need independent scaling. Leave stable, low-change modules as a monolith.

**Add event-driven patterns**: If inter-module coordination becomes complex, introduce event streaming. Modules publish domain events. Other modules subscribe and react. This decouples modules further while maintaining monolithic deployment.

**Implement CQRS within modules**: If some modules have very different read and write patterns, implement Command Query Responsibility Segregation within the module. Separate write models (optimized for updates) from read models (optimized for queries).

For more architectural style options, see the [Architecture Styles](/study-guides/architecture/ArchitectureStyles.html) overview.
