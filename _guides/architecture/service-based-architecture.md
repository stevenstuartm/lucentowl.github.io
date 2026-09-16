---
layout: guide
title: "Service-Based Architecture"
category: Architecture
subcategory: Styles
description: "The pragmatic distributed style built from a handful of coarse-grained, separately deployed domain services: its topology, why services often share a database and keep ACID transactions, the three data topology options, and when it beats both monoliths and microservices."
tags: [practical, service-based-architecture, domain-services, coarse-grained-services, shared-database, data-topology]
---

<blockquote class="pull-quote">
<p>Service-based architecture distributes a system into a few large services, and keeps enough in common that the system stays simple to run.</p>
</blockquote>

Service-based architecture organizes a system into a small number of coarse-grained domain services, typically somewhere between four and twelve, sitting between a user interface and a data layer. Each service covers a significant business capability, such as catalog, checkout, or inventory, rather than a single fine-grained function. Services deploy separately, and they often share a database.

## How It Works

Each domain service is a separately deployed unit with its own internal layers: an API facade, business logic, and persistence. A user interface, sometimes behind an API gateway or reverse proxy, routes requests to the service that owns the requested capability. Services communicate remotely, usually through REST or gRPC, and sometimes through messaging.

The coarse grain is deliberate. Fewer, larger services mean less communication between services and simpler deployment than microservices. A single service often handles a whole business workflow, such as placing an order, from start to finish.

```
┌───────────────────────── User interface ─────────────────────────┐
└───────┬──────────────┬───────────────┬───────────────┬───────────┘
        ▼              ▼               ▼               ▼
  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────┐
  │  Catalog  │  │ Checkout  │  │ Inventory  │  │ Fulfillment │
  │  service  │  │  service  │  │  service   │  │   service   │
  │ facade    │  │ facade    │  │ facade     │  │ facade      │
  │ logic     │  │ logic     │  │ logic      │  │ logic       │
  │ data      │  │ data      │  │ data       │  │ data        │
  └─────┬─────┘  └─────┬─────┘  └─────┬──────┘  └──────┬──────┘
        └──────────────┴──────┬───────┴────────────────┘
                              ▼
          ┌───────────────────────────────────────────┐
          │ Shared database, with tables grouped by   │
          │ domain: catalog | orders | stock | ship   │
          └───────────────────────────────────────────┘
```

### Service Granularity

An e-commerce system built this way might have five services covering its entire domain:

- **Catalog** for product browsing, search, and details
- **Cart** for shopping cart management
- **Checkout** for order placement and payment
- **Inventory** for stock management
- **Fulfillment** for shipping and delivery tracking

A microservices version of the same system would split those capabilities much further, often into several dozen services with narrow responsibilities.

### ACID Transactions Within a Service

Because each service covers a whole business capability, most workflows start and finish inside one service. That lets the service use ordinary database transactions for the workflow, so an order and its payment record commit or roll back together. Microservices, by contrast, often split a single workflow across services and have to coordinate it with sagas and eventual consistency. Keeping ACID transactions is one of the main practical reasons to choose service-based architecture over microservices.

### The User Interface Routes, Services Coordinate

The user interface presents a unified experience and routes each request to the right service. It can take several forms: a single user interface for the whole system, one per domain, or one per service. Business workflows belong inside the services. When the user interface starts coordinating steps across several services, it becomes the place where every workflow change lands, which erodes the independence of the services behind it.

## Data Topology Options

The data topology is one of the most consequential decisions in this style, because it sets how coupled the services are, how complex transactions become, and how much there is to operate.

It also decides how many architecture quanta the system has. Services that share a database depend on it to run, so a system with one shared database usually remains a single quantum even though its services deploy separately. Separate databases are what give services separate quanta.

### Shared Database

All services share one database, and each service works with the tables for its own domain.

**Advantages**:
- Transactions stay simple, with ACID guarantees inside the database
- Queries that span domains are straightforward
- Development patterns stay familiar
- There is one database to operate
- Data integrity constraints are easy to enforce

**Trade-offs**:
- Services are coupled through the schema, so a table change can break several services
- The database can become a performance bottleneck and a single point of failure
- Service boundaries are harder to enforce, since querying another domain's tables is always possible

**Reducing schema coupling:** Split the data access code into libraries per domain, such as a catalog entity library and an orders entity library, plus a small common library for tables that genuinely everyone uses. A change to the orders tables then only affects the services that depend on the orders library, rather than every service that shares the database.

**When to use:** Many service-based systems start here. The simplicity outweighs the coupling until the database becomes a bottleneck or service independence becomes critical.

### Domain Databases

Each business domain gets its own database. Services within a domain share it, and services in different domains don't. Catalog and Search might share a catalog database, Cart and Checkout an orders database, and Inventory and Fulfillment a logistics database.

**Advantages**:
- Each domain can evolve its data independently
- Related services can still share transactions within their domain
- Each database is smaller and simpler than one shared database
- Ownership and boundaries are clearer

**Trade-offs**:
- Cross-domain queries need service calls or data synchronization
- Transactions that span domains need sagas or eventual consistency
- There are more databases to operate
- Services within a domain remain coupled through their shared schema

**When to use:** When domain boundaries are clear and cross-domain transactions are rare.

### Service-Owned Databases

Each service owns its own database, which mirrors the microservices approach to data.

**Advantages**:
- Services are fully independent at the data level
- Each service evolves its data model without affecting others
- Ownership is unambiguous
- Each service can choose the database technology that suits it

**Trade-offs**:
- It is the most complex option
- No transaction can span services, so cross-service consistency needs sagas or eventual consistency
- Cross-service queries need aggregation in application code
- Some data gets duplicated across services
- Operational overhead is highest

**When to use:** When service independence is critical, when a later move to microservices is likely, or when services genuinely need different database technologies.

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Deployability** | ⭐⭐⭐⭐ | Services deploy independently |
| **Evolvability** | ⭐⭐⭐⭐ | Services change independently within their domains |
| **Modularity** | ⭐⭐⭐⭐ | Clear, domain-aligned service boundaries |
| **Fault tolerance** | ⭐⭐⭐⭐ | A failing service doesn't take down the others, unless the shared database fails |
| **Scalability** | ⭐⭐⭐ | Services scale independently, but a shared database limits how far |
| **Simplicity** | ⭐⭐⭐ | More complex than a monolith, simpler than microservices |
| **Testability** | ⭐⭐⭐ | Services test independently, and integration testing gets harder |
| **Cost** | ⭐⭐⭐ | Higher than a monolith, lower than microservices |

## When Service-Based Architecture Fits

**Distributed benefits without microservices overhead.** The system needs independent deployment and some independent scaling, but the organization can't justify the operational cost of dozens of services.

**Domain teams that need to deploy independently.** Catalog, checkout, and inventory teams can each release their service without coordinating, with far fewer services to manage than microservices would need.

**Clear domain boundaries and moderate complexity.** The domain divides naturally into a handful of major capabilities. It is too complex for a monolith to stay comfortable, and not complex enough to need fine-grained services.

**Workflows that need transactional consistency.** When most business workflows fit inside one capability, coarse services keep ACID transactions that finer-grained services would lose.

**A step away from a monolith.** Extracting major capabilities as coarse services lets a team learn to run a distributed system before deciding whether finer-grained services are worth it.

## When to Avoid Service-Based Architecture

**Workflows that constantly span services transactionally.** If most workflows need atomic transactions across several services, the service boundaries are probably wrong. Redraw them, or keep the data in a monolithic topology.

**Simple domains.** If a modular monolith delivers enough modularity, adding distribution adds cost without benefit.

**A genuine need for fine-grained services.** If the organization has mature operations and needs extreme scalability, fine-grained deployment, or technology diversity per capability, microservices fit better than a compromise.

**Unclear boundaries.** If the domain's major capabilities can't be identified yet, splitting into services forces premature decisions. Start with a modular monolith, discover the boundaries, then extract services.

## Common Pitfalls

**Chatty services.** Services call each other for nearly every operation, adding latency and tight coupling. Services that talk constantly probably belong together, so redraw the boundary, or cache data a service reads often.

**Too many services.** Once the count climbs well past a dozen, the system is turning into microservices and needs microservices' operational practices. Either consolidate into coarser services or commit to microservices deliberately.

**Reaching into other domains' data.** Services query tables that belong to another domain, which couples them in ways no interface shows. Route cross-domain data access through service APIs, or split the data access code into domain libraries.

**A user interface that coordinates workflows.** Business logic that orchestrates several services ends up in the user interface, so every workflow change needs coordinated user interface and service changes. Move the coordination into a service.

**Boundaries that don't match the domain.** Services feel arbitrary, and most changes require modifying several of them. Use domain-driven design to identify bounded contexts and align services with them.

## Evolution and Alternatives

When service-based architecture stops fitting:

**Split services into microservices.** If some services are too coarse and need finer-grained scaling or deployment, break them into smaller services. It doesn't have to happen everywhere at once. Services that don't need it can stay coarse.

**Consolidate into a modular monolith.** If communication overhead outweighs the benefits, or independent deployment turns out not to matter, fold the services back into a modular monolith and keep the domain boundaries as modules.

**Add event-driven communication.** If coordination between services grows complex, services can publish domain events that others react to. That reduces direct dependencies while the overall style stays the same.
