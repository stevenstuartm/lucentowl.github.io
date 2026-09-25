---
layout: guide
title: "Microservices Architecture"
category: Architecture
subcategory: Styles
description: "The fine-grained distributed style where each service owns its data and deploys independently: core principles, the signs that services are too coarse or too fine, how user interfaces and operational concerns fit, and the anti-patterns that turn microservices into a distributed monolith."
tags: [practical, microservices, service-granularity, database-per-service, bounded-context, grains-of-sand]
---

Microservices architecture, described by James Lewis and Martin Fowler in their 2014 article [Microservices](https://martinfowler.com/articles/microservices.html){:target="_blank" rel="noopener noreferrer"}, takes distribution further than any other common style. The system splits into many fine-grained services, each covering a small, focused business capability. Each service owns its data, deploys independently, and can use its own technology. The style maximizes evolvability and team autonomy, and it demands significant operational maturity in return.

<blockquote class="pull-quote">
<p>Microservices trade the simplicity of a shared codebase and database for the freedom to change, deploy, and scale each capability on its own.</p>
</blockquote>

## How It Works

Each service aligns with a bounded context from domain-driven design, a cohesive business capability with clear boundaries. Services favor duplication over sharing. They avoid shared databases and shared domain code, and they communicate only through well-defined interfaces such as REST or gRPC APIs and asynchronous messages.

Independent deployability is the point. A team can release a change to its service without coordinating with other teams or waiting for a shared release window. When services own their data and talk to each other asynchronously, each one is its own architecture quantum and can scale and fail on its own.

{% include figure.html id="arch-microservices" %}

### Core Principles

**Bounded context alignment**: Each service's boundary is a bounded context's boundary. Everything needed to fulfill that context's responsibility lives inside the service.

**Data isolation**: Each service owns its data, and no other service reads or writes it directly. That removes coupling through shared schemas, and it makes queries and transactions that span services harder.

**Independent deployability**: A change to one service doesn't require deploying another. That enables frequent, low-risk releases.

**Technology diversity**: Services can use different languages, frameworks, and databases where a capability genuinely benefits. In practice, many organizations limit the options to keep hiring, tooling, and operations manageable.

**Decentralized governance**: Teams make most decisions about their own services within organization-wide guardrails, such as security standards and observability requirements.

## Service Granularity

No formula decides how fine-grained a service should be. What works in practice is watching for the signs that a boundary is in the wrong place, and those signs point one of two ways.

### Signs a Service Is Too Coarse

**One team can't hold it.** A "Customer Service" that handles registration, authentication, preferences, orders, and invoicing covers more than one team can understand and own, and it splits naturally into authentication, customer profile, and order history services.

**Its parts change for unrelated reasons.** When a change to invoicing has to wait for a release that also carries unrelated preference changes, the service is bundling work that would move faster apart.

**Its parts need different operational treatment.** A service can only be scaled, deployed, and made available as a whole, so a part with heavy load or strict availability needs forces those costs onto everything else in it.

### Signs Services Are Too Fine

**They keep changing data together.** Microservices avoid distributed transactions such as two-phase commit, because those couple services together and reduce availability. If two services constantly need to change data atomically, that is strong evidence they belong in one service. A workflow that genuinely spans services has to accept eventual consistency, with compensating steps to undo work when a later step fails.

**One operation needs a long chain of calls.** Every call between services adds latency and another way for a request to fail. If completing a single business operation takes a chain of service-to-service calls, the services are probably split too finely or along the wrong lines.

**None of them makes sense alone.** Separate services for "calculate tax," "apply discount," and "update total" that must coordinate on every cart operation can't be understood or changed independently, and they belong together in one cart service.

<blockquote class="pull-quote">
<p>If two services keep needing to change data together, they are one service.</p>
</blockquote>

## Working Across Service Boundaries

### Data Owned per Service

Each service's data must be private to it. Separate database instances give the strongest isolation. Separate schemas on a shared database server, with access controls that stop services from reading each other's schemas, are a pragmatic middle ground. Sharing tables between services, even with naming conventions, is a shared database and gives up the style's main benefit.

When a query needs data owned by several services, the options are to call each service and combine the results, to maintain a read model built from the services' events, or to let a service keep a local copy of the data it needs from others. Each option trades freshness, performance, and complexity differently.

### User Interfaces

A single user interface can sit in front of all the services, calling them through an API gateway. That keeps the front end simple but makes it a shared component every team changes. Micro-frontends split the user interface along the same lines as the services, so each team owns its capability from screen to database, at the cost of more complex front-end integration.

### Operational Concerns

Every service needs logging, monitoring, service discovery, retries, and timeouts, and implementing them separately in each service invites drift. Moving those concerns into a sidecar proxy deployed beside each service keeps them consistent across services written in different languages. A service mesh manages those sidecars centrally once the number of services makes managing them individually impractical.

## When Microservices Fit

**Large systems whose parts need different operational characteristics.** One capability might need far higher availability than the rest, or a different release cadence. Separate services give it that without imposing it on everything else, and a failure in a well-isolated service stays within it.

**High-scale applications with uneven load.** When capabilities have very different scaling needs, each service scales on its own instead of the whole system scaling for its busiest part.

**Mature DevOps practices.** Automated pipelines, observability, and container orchestration are already in place, so running many services is routine rather than a new burden.

**Teams organized by business domain that need to release independently.** Each team owns its services and deploys continuously without coordinating releases with the others.

**Evolvability that matters more than simplicity.** The system is expected to change for years, and the organization accepts distributed complexity as the price of changing each part on its own.

## When to Avoid Microservices

**Simple domains.** A modular monolith delivers enough modularity without the network, the operational tooling, or the cost of running many services.

**Limited operational maturity.** Without reliable CI/CD, observability, and incident response, every service is another thing to deploy and watch by hand. A failure that crosses several services also takes far longer to trace than one inside a single process, and end-to-end tests across services are slow to build and brittle to run.

**Small teams.** A few people running many services spend more time on infrastructure than on features.

**Workflows that frequently need atomic changes across services.** Each service owns its data, so those workflows fall back on sagas and eventual consistency. If that describes most workflows, the boundaries are drawn in the wrong place.

**Tight deadlines.** Building the operational foundation takes time that a deadline leaves no room for.

## Common Anti-Patterns

<div class="card-group">
<div class="content-card content-card--accent-warning">
<h4>Grains of Sand</h4>
<p>Services become so fine-grained that the overhead of running and coordinating them drowns out their benefits. Mark Richards named this pitfall in <em>Microservices AntiPatterns and Pitfalls</em> (2016).</p>
<p><em>Example: separate services for "calculate tax," "validate address," and "format phone number."</em></p>
<p><strong>Fix:</strong> Size services around cohesive business capabilities, not individual functions.</p>
</div>
<div class="content-card content-card--accent-warning">
<h4>Shared Domain Libraries</h4>
<p>Teams create shared libraries of domain code for reuse. When a library changes, every service that depends on it has to update and redeploy.</p>
<p><strong>Fix:</strong> Prefer duplicating domain code when that preserves independence, and reserve shared libraries for stable cross-cutting concerns.</p>
</div>
<div class="content-card content-card--accent-warning">
<h4>Distributed Monolith</h4>
<p>Services depend on each other so tightly that none can change on its own, and every change requires coordinated deployments.</p>
<p><strong>Fix:</strong> Redraw service boundaries, prefer asynchronous communication, and accept eventual consistency where the business allows it.</p>
</div>
<div class="content-card content-card--accent-warning">
<h4>Chatty Communication</h4>
<p>Services make many fine-grained calls to each other, and network latency dominates response times.</p>
<p><strong>Fix:</strong> Design coarser interfaces that minimize round trips, and keep local copies of data that is read often.</p>
</div>
</div>

## Evolution and Alternatives

When microservices stop fitting:

**Consolidate related services.** If there are too many services, or the boundaries are wrong, merge related services into larger ones. Taken far enough, that becomes service-based architecture.

**Return to a modular monolith.** If operational complexity outweighs the benefits and independent deployment turns out not to matter, consolidate into a modular monolith and keep the domain boundaries as modules.

**Add orchestration for complex workflows.** If choreography between services becomes unmanageable, introduce an orchestrator for the critical workflows while services keep ownership of their individual capabilities.
