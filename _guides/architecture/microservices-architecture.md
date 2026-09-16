---
layout: guide
title: "Microservices Architecture"
category: Architecture
subcategory: Styles
description: "The fine-grained distributed style where each service owns its data and deploys independently: core principles, how to size services by purpose, transactions, and choreography, how user interfaces and operational concerns fit, and the anti-patterns that turn microservices into a distributed monolith."
tags: [practical, microservices, service-granularity, database-per-service, bounded-context, grains-of-sand]
---

Microservices architecture, described by James Lewis and Martin Fowler in their 2014 article [Microservices](https://martinfowler.com/articles/microservices.html){:target="_blank" rel="noopener noreferrer"}, takes distribution further than any other common style. The system splits into many fine-grained services, each covering a small, focused business capability. Each service owns its data, deploys independently, and can use its own technology. The style maximizes evolvability and team autonomy, and it demands significant operational maturity in return.

<blockquote class="pull-quote">
<p>Microservices trade the simplicity of a shared codebase and database for the freedom to change, deploy, and scale each capability on its own.</p>
</blockquote>

## How It Works

Each service aligns with a bounded context from domain-driven design, a cohesive business capability with clear boundaries. Services favor duplication over sharing. They avoid shared databases and shared domain code, and they communicate only through well-defined interfaces such as REST or gRPC APIs and asynchronous messages.

Independent deployability is the point. A team can release a change to its service without coordinating with other teams or waiting for a shared release window. When services own their data and talk to each other asynchronously, each one is its own architecture quantum and can scale and fail on its own.

```
                     ┌──────────────────────────────┐
                     │ API gateway / user interface │
                     └──────┬──────────┬────────┬───┘
                            ▼          ▼        ▼
                     ┌─────────┐ ┌─────────┐ ┌─────────┐
                     │  Order  │ │ Payment │ │ Catalog │
                     │ service │ │ service │ │ service │
                     └────┬────┘ └────┬────┘ └────┬────┘
                          ▼           ▼           ▼
                       (orders)   (payments)  (catalog)    each service owns its data

                     Order ── "order placed" ──▶ event channel ──▶ Payment
```

### Core Principles

**Bounded context alignment**: Each service's boundary is a bounded context's boundary. Everything needed to fulfill that context's responsibility lives inside the service.

**Data isolation**: Each service owns its data, and no other service reads or writes it directly. That removes coupling through shared schemas, and it makes queries and transactions that span services harder.

**Independent deployability**: A change to one service doesn't require deploying another. That enables frequent, low-risk releases.

**Technology diversity**: Services can use different languages, frameworks, and databases where a capability genuinely benefits. In practice, many organizations limit the options to keep hiring, tooling, and operations manageable.

**Decentralized governance**: Teams make most decisions about their own services within organization-wide guardrails, such as security standards and observability requirements.

## Service Granularity

No formula decides how fine-grained a service should be. Three factors guide the decision, and each one pushes in a direction.

### Purpose

A service should represent a cohesive business capability that one team can understand and own. If it does too much, split it. A "Customer Service" that handles registration, authentication, preferences, orders, and invoicing is too broad, and it splits naturally into authentication, customer profile, and order history services.

The opposite mistake is just as common. Separate services for "calculate tax," "apply discount," and "update total" that must coordinate on every cart operation are too granular and belong together in one cart service.

### Transactions

Microservices avoid distributed transactions such as two-phase commit, because those couple services together and reduce availability. If two services constantly need to change data atomically together, that is strong evidence they belong in one service. A workflow that genuinely spans services has to accept eventual consistency, with compensating steps to undo work when a later step fails.

### Choreography

Every call between services adds latency and another way for a request to fail. If completing a single business operation takes a long chain of service-to-service calls, the services are probably too fine-grained or split along the wrong lines. Services should mostly work independently, not collaborate constantly.

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

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Scalability** | ⭐⭐⭐⭐⭐ | Each service scales independently |
| **Evolvability** | ⭐⭐⭐⭐⭐ | Services change independently |
| **Deployability** | ⭐⭐⭐⭐⭐ | Continuous, independent deployment |
| **Fault tolerance** | ⭐⭐⭐⭐ | Failures stay within a service when services are properly isolated |
| **Testability** | ⭐⭐ | Each service tests easily, while end-to-end testing is complex |
| **Simplicity** | ⭐ | Distributed complexity is high |
| **Cost** | ⭐ | High operational and infrastructure cost |

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When Microservices Fit</h4>
<ul>
<li><strong>Large systems</strong> where different parts need different operational characteristics</li>
<li><strong>Mature DevOps practices</strong> with automated pipelines, observability, and container orchestration in place</li>
<li><strong>Teams organized by business domain</strong> that need to release independently</li>
<li><strong>Evolvability that matters more than simplicity</strong></li>
<li><strong>High-scale applications</strong> whose capabilities have very different scaling needs</li>
</ul>
</div>
<div class="content-card content-card--accent-warning">
<h4>When to Avoid Microservices</h4>
<ul>
<li><strong>Simple domains</strong> where a modular monolith would do</li>
<li><strong>Limited operational maturity</strong>, without reliable CI/CD, observability, or incident response</li>
<li><strong>Small teams</strong> that would spend more time on infrastructure than on features</li>
<li><strong>Workflows that frequently need atomic changes</strong> across what would be separate services</li>
<li><strong>Tight deadlines</strong> that leave no room to build the operational foundation</li>
</ul>
</div>
</div>

## Common Anti-Patterns

<div class="card-group">
<div class="content-card content-card--accent-warning">
<h4>Grains of Sand</h4>
<p>Services become so fine-grained that the overhead of running and coordinating them drowns out their benefits.</p>
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
