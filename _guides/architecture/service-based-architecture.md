---
layout: guide
title: "Service-Based Architecture"
category: Architecture
subcategory: Styles
description: "The pragmatic distributed style built from a handful of coarse-grained, separately deployed domain services: its topology, why services often share a database and keep ACID transactions, how much of the database services share, and when it beats both monoliths and microservices."
tags: [practical, service-based-architecture, domain-services, coarse-grained-services, shared-database, data-topology]
---

<blockquote class="pull-quote">
<p>Service-based architecture distributes a system into a few large services, and keeps enough in common that the system stays simple to run.</p>
</blockquote>

Service-based architecture organizes a system into a handful of coarse-grained domain services sitting between a user interface and a data layer. Each service covers a significant business capability, such as catalog, checkout, or inventory, rather than a single fine-grained function. Services deploy separately, and they often share a database.

## How It Works

Each domain service is a separately deployed unit containing everything its capability needs, from the API it exposes down to its data access code. A user interface, sometimes behind an API gateway or reverse proxy, routes requests to the service that owns the requested capability. Services communicate remotely, usually through REST or gRPC, and sometimes through messaging.

The coarse grain is deliberate. Fewer, larger services mean less communication between services and simpler deployment than microservices. A single service often handles a whole business workflow, such as placing an order, from start to finish.

{% include figure.html id="arch-service-based" %}

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

The user interface presents a unified experience and routes each request to the service that owns it. Business workflows belong inside the services. When the user interface starts coordinating steps across several services, it becomes the place where every workflow change lands, which erodes the independence of the services behind it.

## How Much of the Database Services Share

The data topology is one of the most consequential decisions in this style, because it sets how coupled the services are, how complex transactions become, and how much there is to operate. It also decides how many architecture quanta the system has. Services that share a database depend on it to run, so a system with one shared database usually remains a single quantum even though its services deploy separately.

The choice is a spectrum. At one end every service uses one database. At the other, every service owns its own. In between, services that belong to the same business domain share a database with each other and with no one else, so Cart and Checkout might share an orders database while Inventory and Fulfillment share a logistics one.

{% include figure.html id="arch-sba-data-topologies" %}

| | One shared database | A database per domain | A database per service |
| --- | --- | --- | --- |
| **Transactions** | ACID across everything | ACID within a domain, sagas or eventual consistency across domains | ACID within a service only, sagas or eventual consistency everywhere else |
| **Queries across domains** | Plain joins | Service calls or synchronized copies | Aggregation in application code |
| **Schema coupling** | A table change can break several services | Only services in the same domain are coupled | None |
| **Boundaries** | Easy to bypass, since any service can query any table | Enforced between domains | Enforced everywhere |
| **Operations** | One database, which is also a single point of failure and a likely bottleneck | A few databases | The most databases, and some duplicated data |
| **Suits** | Most systems at the start, until the database becomes the limit | Clear domains with rare cross-domain transactions | Critical independence, a likely move to microservices, or different database technologies per service |

Many service-based systems start with one shared database and move along the spectrum only where the coupling starts to cost something. Richards and Ford suggest a way to limit schema coupling before that point: split the data access code into a library per domain, such as a catalog entity library and an orders entity library, plus a small common library for tables everyone genuinely uses. A change to the orders tables then affects only the services that depend on the orders library.

## When Service-Based Architecture Fits

**Distributed benefits without microservices overhead.** The system needs independent deployment and some independent scaling, but the organization can't justify the operational cost of dozens of services.

**Domain teams that need to deploy independently.** Catalog, checkout, and inventory teams can each release their service without coordinating, with far fewer services to manage than microservices would need.

**Clear domain boundaries and moderate complexity.** The domain divides naturally into a handful of major capabilities. It is too complex for a monolith to stay comfortable, and not complex enough to need fine-grained services.

**Workflows that need transactional consistency.** When most business workflows fit inside one capability, coarse services keep ACID transactions that finer-grained services would lose.

**A step away from a monolith.** Extracting major capabilities as coarse services lets a team learn to run a distributed system before deciding whether finer-grained services are worth it.

## When to Avoid Service-Based Architecture

**Workflows that constantly span services transactionally.** If most workflows need atomic transactions across several services, the service boundaries are probably wrong. Redraw them, or keep the data in a monolithic topology.

**Scale or availability beyond what a shared database allows.** When services share one database, it caps how far they scale together and remains a single point of failure for all of them. If the system needs more than that, split the data or choose a style whose services own it.

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
