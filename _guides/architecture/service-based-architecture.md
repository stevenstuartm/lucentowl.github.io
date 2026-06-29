---
layout: guide
title: "Service-Based Architecture"
category: Architecture
subcategory: Styles
description: "Pragmatic distributed architecture with coarse-grained domain services balancing scalability and complexity."
tags: [architecture, distributed-systems, microservices, scalability, practical]
---

<blockquote class="pull-quote">
<p>Service-based architecture is the pragmatic middle ground between monoliths and microservices. You get distributed system benefits without microservices' operational complexity.</p>
</blockquote>

Service-based architecture organizes a system into a small number of coarse-grained domain services (typically 4-12) sitting between the user interface and data layer. Each service represents a significant chunk of business capability: think "catalog service," "checkout service," "inventory service," not fine-grained functions.

## How It Works

Each service follows an internal layered structure with an API facade, business logic, and persistence layer. Services own significant business capabilities and encapsulate everything needed to deliver that capability.

Services communicate via remote calls using REST, gRPC, or messaging. A UI layer or API gateway sits in front, routing requests to appropriate services based on the requested capability.

The coarse grain size is intentional. Having fewer, larger services reduces inter-service communication and simplifies deployment compared to microservices. Teams can work on entire business capabilities without coordinating across dozens of services.

### Service Topology

**UI Layer**: Web application, mobile app, or API gateway that presents a unified interface to users. The UI aggregates data from multiple services and handles cross-service workflows.

**Domain Services**: 4-12 coarse-grained services, each representing a significant business capability. Each service has:
- **API Facade**: Public interface exposing service capabilities
- **Business Logic Layer**: Domain rules and workflows
- **Persistence Layer**: Data access and caching
- **Database**: Service may have dedicated database or share with other services

**Service Granularity**: Services are coarser than microservices. An e-commerce system might have:
- Catalog Service (product browsing, search, details)
- Cart Service (shopping cart management)
- Checkout Service (order placement, payment)
- Inventory Service (stock management)
- Fulfillment Service (shipping, delivery tracking)

That's 5 services covering the entire domain. A microservices version might have 30-50 services with much finer-grained responsibilities.

## Data Topology Options

<div class="callout callout--tip">
<p class="callout__title">Critical Decision Point</p>
<p>Data architecture is one of the most critical decisions in service-based architecture. The database topology you choose (monolithic, domain-based, or service-specific) determines coupling, transaction complexity, and operational overhead.</p>
</div>

Data architecture is one of the most critical decisions in service-based architecture. Three primary approaches exist:

### Monolithic Database

All services share one database. Services access their own tables but everything lives in the same database instance.

**Advantages**:
- Transactions are simple (ACID within the database)
- Queries spanning multiple service domains are straightforward
- Familiar development patterns
- Lower operational complexity (one database to manage)
- Easier to enforce data integrity constraints

**Tradeoffs**:
- Services couple through the schema
- Database changes risk affecting multiple services
- Database becomes a potential bottleneck
- Harder to enforce service boundaries (temptation to directly query other services' tables)
- Shared database can become a deployment coupling point

**When to use**: Most service-based architectures start here. The simplicity advantage outweighs the coupling cost until the system reaches a scale where the database becomes a bottleneck or service independence becomes critical.

### Domain Databases

Each business domain gets its own database. Services within a domain share a database. Services across domains use separate databases.

For example: Catalog and Search services share a "catalog database." Cart and Checkout services share an "orders database." Inventory and Fulfillment services share a "logistics database."

**Advantages**:
- Domain autonomy (catalog domain can evolve its data independently)
- Related services can still leverage transactions within a domain
- Reduces database size and query complexity compared to monolithic database
- Clearer ownership and boundaries

**Tradeoffs**:
- Cross-domain queries require service-to-service calls or data synchronization
- Transactions spanning domains require distributed patterns (sagas)
- More databases to manage than monolithic approach
- Still couples services within a domain through shared schema

**When to use**: When you have clear domain boundaries and cross-domain transactions are rare. This provides a middle ground between monolithic and service-specific databases.

### Service-Specific Databases

Each service owns its own database. Maximum data isolation. This mirrors the microservices approach to data.

**Advantages**:
- Complete service independence
- Services evolve data models without affecting others
- Clear ownership and boundaries
- Can choose different database technologies per service (polyglot persistence)

**Tradeoffs**:
- Most complex option
- No distributed transactions (must use sagas or eventual consistency)
- Cross-service queries require aggregation at the application layer
- Data duplication across services
- Highest operational overhead

**When to use**: When service independence is critical, when preparing for eventual migration to microservices, or when services genuinely need different database technologies.

## Characteristics

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Simplicity** | ⭐⭐⭐ | More complex than monolith, simpler than microservices |
| **Scalability** | ⭐⭐⭐⭐ | Services scale independently |
| **Evolvability** | ⭐⭐⭐⭐ | Services evolve independently |
| **Deployability** | ⭐⭐⭐⭐ | Independent deployment of services |
| **Testability** | ⭐⭐⭐ | Services testable independently, integration testing harder |
| **Modularity** | ⭐⭐⭐⭐ | Clear service boundaries |
| **Cost** | ⭐⭐⭐ | Higher than monolith, lower than microservices |

## When Service-Based Architecture Fits

**Organizations wanting distributed system benefits without microservices complexity**: You need independent scaling, deployment flexibility, and technology diversity. But you can't justify microservices' operational overhead.

**Teams organized by business domains who need deployment independence**: Domain teams (Catalog team, Checkout team, Inventory team) want to deploy changes without coordinating. Service-based architecture enables this with fewer services than microservices.

**Systems with clear domain boundaries and moderate complexity**: When the domain naturally partitions into 4-12 major capabilities. Not so simple that a monolith suffices, not so complex that microservices' fine-grained modularity is required.

**Mid-size systems or organizations**: Microservices work well at large scale with mature operations. Monoliths work well for small systems. Service-based architecture fits the middle: systems too large for monoliths but not large enough to justify microservices complexity.

**Transitional architecture**: When evolving from a monolith but not ready for microservices. Extract major capabilities as coarse services. Learn distributed system patterns. Move to finer-grained services if needed.

## When to Avoid Service-Based Architecture

**Applications requiring distributed transactions across services**: If workflows constantly need atomic transactions spanning multiple services, the service boundaries are probably wrong. Either redesign boundaries or use a monolithic database.

**Very simple domains where a monolith would suffice**: If the system is simple enough that a modular monolith delivers sufficient modularity, don't add distributed system complexity unnecessarily.

**Organizations ready to commit fully to microservices**: If you have operational maturity, mature DevOps practices, and need microservices' benefits (extreme scalability, fine-grained deployment, technology polyglot), don't compromise with service-based architecture. Go fully to microservices.

**Systems with unclear boundaries**: If you can't identify 4-12 clear service boundaries, service-based architecture forces premature decisions. Start with a modular monolith, discover boundaries, then extract services.

## Common Pitfalls

**Too much inter-service communication**: Services constantly call each other for every operation. This creates chattiness, latency, and tight coupling. Solution: Redesign service boundaries. Services that talk constantly probably belong together. Or cache frequently accessed data locally.

**Too many services**: More than 12 services suggests you're building microservices without admitting it. At that scale, you need microservices' operational sophistication. Solution: Either consolidate services into coarser boundaries or commit to microservices.

**Excessive data sharing across services**: Services directly query each other's databases or share tables. This breaks service boundaries and creates tight coupling. Solution: Enforce boundaries. Services communicate through APIs, not direct database access.

**UI becomes a distributed monolith**: The UI layer contains business logic coordinating across services. Changes to workflows require UI changes and coordination across multiple services. Solution: Push coordination logic into services. The UI should be a thin presentation layer.

**Wrong service boundaries**: Services don't align with domain concepts. Boundaries feel arbitrary. Changes constantly require modifying multiple services. Solution: Use Domain-Driven Design to identify bounded contexts. Align services with contexts.

## Evolution and Alternatives

When service-based architecture stops fitting:

**Evolve to microservices**: If services are too coarse and you need finer-grained deployment, break services into smaller microservices. The transition is natural; your 8 services might become 40 microservices.

**Consolidate back to modular monolith**: If inter-service communication overhead outweighs benefits, or if you don't actually need independent deployment, consolidate services back into a modular monolith. Keep the domain boundaries as modules.

**Implement event-driven patterns**: If service coordination becomes complex, introduce event-driven patterns. Services publish domain events. Other services subscribe and react. This decouples services while maintaining service-based architecture.

For more architectural style options, see the [Architecture Styles](/study-guides/architecture/ArchitectureStyles.html) overview.
