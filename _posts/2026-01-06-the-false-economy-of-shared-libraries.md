---
layout: post
title: "How Shared Libraries Become Shared Shackles"
date: 2026-01-06
description: "Shared libraries promise reuse and consistency but more often bind team autonomy and development tempo through coupling and coordination overhead. The consistency they claim to provide is better achieved by sharing principles, tradeoffs, and values rather than sharing implementation."
tags: [architecture, distributed-systems, microservices, governance]
author: steven-stuart
sources:
  - title: "DORA: Loosely Coupled Teams"
    url: "https://dora.dev/capabilities/loosely-coupled-teams/"
  - title: "OpenTelemetry: Context Propagation"
    url: "https://opentelemetry.io/docs/concepts/context-propagation/"
  - title: "Software Engineering at Google, Chapter 16: Version Control and Branch Management (the One-Version Rule)"
    url: "https://abseil.io/resources/swe-book/html/ch16.html"
  - title: "Eric Evans, Domain-Driven Design Reference (Shared Kernel)"
    url: "https://www.domainlanguage.com/ddd/reference/"
  - title: "W3C Trace Context Recommendation"
    url: "https://www.w3.org/TR/trace-context/"
---

This is a highly opinionated take on shared libraries and the damage they do to team autonomy and development tempo. Teams deliver value faster and more consistently when they can make decisions, ship changes, and evolve their domains without coordinating across organizational boundaries. Shared libraries erode exactly that independence.

The principle applies anywhere domains and teams need independence, but this post focuses on distributed architectures because that's where the consequences are most severe.

After seeing costs explode for trivial tasks and critical production updates failing to deliver on time in nearly every organization I have witnessed, I am willing to take a rather "extreme" stance on the subject.

## Shared Libraries Violate Core Principles

Distributing components isn't just about distributing work. It's about the Single Responsibility Principle applied at the system level: clear ownership, implementation isolation, and infrastructural independence. The share-nothing principle makes this explicit. Services should be autonomous, independently deployable, and free from implementation coupling. When services share nothing, teams can deploy, scale, and evolve on their own terms, at their own tempo. DORA's research on loosely coupled teams links that independence to delivery performance, finding that teams who can change and deploy without depending on other teams deploy more often and recover faster. A library that forces upgrades, as the next section shows, takes that ability away.

Shared libraries violate these principles. They couple teams through shared implementation despite being distributed in name, creating little monoliths that bind development tempo across teams that were meant to operate independently.

Yet the pitch keeps coming: "We have this code in three places. Let's consolidate it into a shared library. We'll save time, ensure consistency, and make everyone's life easier." It sounds reasonable, it really does, yet the decision only calculates the cost of duplication while ignoring the cost of sharing across teams, domains, and technical boundaries.

## The Costs the Pitch Doesn't Count

When someone proposes a shared library, they calculate the savings: "This code exists in five services. If we consolidate, we only maintain it once."

### Version conflicts and upgrade pain

Five teams now depend on your library. They release on different cadences and at some point one or more teams require a breaking change. Now you're either maintaining multiple versions indefinitely or forcing upgrades on teams that have other priorities. Letting consumers pin an old version only delays the choice until a fix they need ships past the breaking change. The "one place to maintain" becomes "one place that blocks everyone."

### Teams blocked waiting for changes

A team needs functionality the library doesn't have. They can't just add it. They need to coordinate with the library owners, get the change approved, wait for a release, and then upgrade. An afternoon's change in a team's own code can stretch into weeks of waiting. Opening the library to outside contributions shortens the queue without removing it, since the change still needs the owners' review and a release.

### Debugging across boundaries

When something breaks, the investigation now spans your code and the library code. Your team doesn't own the library. Maybe they don't fully understand it. The abstraction that was supposed to simplify their lives has added a layer they have to dig through.

### Bloat or fragmentation, pick your poison

The library starts focused. Then another team needs something slightly different. Then another. The library accumulates features to serve multiple masters, becoming a grab-bag of loosely related functionality coupled together because they share a package, not because they belong together. The disciplined alternative is to split it into many small, focused packages, but that creates its own problem: an entourage of dependencies that each consuming team must track, version, and coordinate with. Instead of one bloated library blocking you, ten focused ones that keep changing collectively recreate the same burden.

### Obscured accountability

Shared libraries don't reduce your quality burden; they move it somewhere less visible. If the library has a bug, your service has a bug. Every service still needs its own load testing, chaos testing, penetration testing, and UAT regardless of whether the underlying code is shared or duplicated. The library just adds a dependency you don't own and can't fully verify, with a handful of internal users to find its bugs instead of a mature library's thousands.

### Polyglot stacks multiply the library

The shared library pitch assumes a homogeneous technology landscape that rarely exists. If your organization has services in C#, Java, Python, and Go, do you maintain and keep four versions of every shared library in sync? In polyglot environments, the "shared" library becomes a second-class citizen in every language except the one the authoring team actually uses. The promise of consistency becomes a guarantee of inconsistency across language boundaries.

## The Cohesion and Coupling Diagnosis

If two services genuinely need the same function, you have three possibilities:

**It's a cohesion problem.** That function belongs in one place and should be called, not duplicated. Extract it into a service with an API. Now there's a clear owner, a clear contract, and no shared implementation coupling consumers together. A service isn't free. It adds a network hop, an availability dependency, and an API to version. But the owner carries those versions, not every consumer. A fix ships in one deployment, and a bad release is one canary to catch and one rollback to undo. A library regression, by contrast, ships in every consumer's next release.

**It's a coupling problem.** You've drawn your boundaries wrong. The services that "need" the same code are actually more related than you thought. Reconsider where the boundary belongs rather than papering over the boundary violation with a shared dependency.

**It's genuinely independent.** The similarity is coincidental. Both services need to format dates or parse JSON or validate email addresses. Copy the code. Move on. The copies can drift, and a copied bug gets fixed once per copy, but for small code that rarely changes that's cheaper than the coordination, and each copy can evolve with its service. Copies don't show up in a dependency scanner, though, so what you copy should be the glue around the runtime or a mature library, not a hand-rolled parser or validator.

Copying has a limit. The test is whether two copies disagreeing would produce an inconsistency a user or the data could see. A rule that must produce the same answer everywhere, like a tax calculation, fails that test. It's the cohesion case, and it needs one owner.

The common rebuttal is "but if there's a bug, I fix it once and it propagates everywhere." The answer depends on where the bug lives. Bugs in third-party libraries get fixed upstream on the vendor's cycle, and you take the fix by upgrading. Concerns like logging and observability shouldn't be blindly shared implementations. A service **authors** them out of its own domain knowledge, aligned to shared values about how behavior gets classified and what context gets captured. A thin package that configures OpenTelemetry identically everywhere passes the stability test in the next section; a library that decides what a service logs doesn't. Security is the main exception, covered below.

What remains is business logic, and if your business logic is so coupled across services that a single bug requires simultaneous fixes everywhere, you don't have a sharing problem, you have a boundary problem.

A shared library is rarely the right answer because the problem it solves (duplicated code) seldom justifies the problems it creates (coupling, versioning, blocked teams). The default is no, and the burden of proof sits with the library to show it will stay narrow and stable.

## Don't Reinvent the Wheel vs. Don't Share Internal Types

Using mature, well-tested libraries for universal problems makes sense. Logging frameworks, HTTP clients, serialization libraries, and authentication middleware exist because these problems are universal and well-understood. Someone else solved them better than you would, and the cost of depending on their solution is low because the solution is stable.

Sharing your internal `CustomerDto` across services is different. Sharing your "standard" repository pattern is different. Sharing your domain models between bounded contexts is different. These aren't universal problems with stable solutions. They're your internal abstractions, and forcing them on other teams assumes those teams should think the same way you do.

The dividing line is stability, not who wrote the code. An internal library kept narrow, versioned, and slow to break behaves like an external one. Internal libraries tend not to stay that way, because they exist to carry abstractions that change whenever your domain does.

## SDKs Are Different

An SDK abstracts what you expose: the public contract of a service or platform. A good SDK earns its existence by encoding integration complexity that would be expensive and error-prone for every consumer to reimplement: orchestrating multi-step workflows, managing state across API calls, handling idempotency, and abstracting version differences.

An SDK also has a different lifecycle. The platform is built first, and the SDK comes afterward for a different audience.

A shared library abstracts how you think internally, like your domain models, patterns, and "standard way" of doing things. The shared library serves a governance impulse, not the consumer. And unlike an SDK, it tries to couple internal teams to the same release cycle and the same implementation decisions.

The SDK says: "Here's how to use our thing."
The shared library says: "Here's how you should build your thing."

One is a service to consumers. The other is an imposition on autonomous teams disguised as help.

## Your Runtime Already Solved This

The shared library pitch often targets "utility code" that your runtime already provides. If you're using .NET, the framework gives you HTTP clients, JSON serialization, logging abstractions, dependency injection, and configuration management. Why would you need an internal shared library wrapping `HttpClient` when `HttpClient` exists and is battle-tested by millions of applications?

The framework primitives are already shared, tested, and documented. Your wrapper just adds coordination overhead on top of something that didn't need wrapping.

## The Principle Is Broader Than Distribution

The same problem exists in a modular monolith wherever different teams own different domains. There, shared packages between domains still couple teams to the same change cycles. The difference is severity. In a monolith, the blast radius is contained: teams share a deployable, so version conflicts surface as build errors. In a distributed system, a change that would have been a merge conflict becomes a multi-team coordination effort with blocked releases and stale dependencies. Topology doesn't change this for domain code. If Domain A and Domain B share implementation code, they're a distributed monolith with extra steps.

Two practices that look like exceptions accept the cost rather than escape it. One is the monorepo that enforces a single version of every dependency, which Google's *Software Engineering at Google* calls the One-Version Rule. It gets the monolith's version of the cost. Version skew can't happen, but a breaking change to the library has to update every consumer before it lands, so the coordination moves to whoever changes the library. Google absorbs that cost with large-scale-change tooling most organizations lack. Domain-driven design's Shared Kernel is the other. Eric Evans conditions it on neither team changing it without consulting the other, which accepts the coordination cost on purpose.

## The API Client Library Obsession

The most common incarnation of shared library dysfunction is the API client package: a library of hand-written contracts, DTOs, and client code that consumers are expected to import when calling your service. I have never seen this pattern result in anything short of chaos.

The pitch sounds reasonable: "We'll publish a client library so consumers don't have to write their own HTTP calls or define their own contracts." But this solves a problem that doesn't exist while creating several that do.

**Every API should have documentation describing its contracts.** If your API is well-documented with clear schemas, consumers can generate or write their own clients trivially. The documentation is the contract. Publishing a machine-readable schema, such as an OpenAPI document or a `.proto` file, is that documentation in another form. The trouble starts when the package carries hand-written DTOs and runtime behavior, binding every consumer to the producer's model and policies. A stubs package generated from the schema, with no hand-written code, sits on the documentation side.

**Every consumer has different needs.** Service A might need three fields from one endpoint. Service B might need ten fields from a different endpoint. Service C might need to call the same endpoint but transform the response differently. When you force everyone to use your client library, you're imposing your view of how your API should be consumed.

**Client libraries impose one team's operational policy on every consumer.** Teams building client libraries inevitably add caching strategies, retry policies, circuit breakers, and connection pooling configurations. Those decisions belong to the calling service, which is the only one that knows its own latency budget, its failure tolerance, and how much damage a stale read does in its domain. The producer knows none of that. A client library freezes those choices upstream, where changing them requires a coordinated release across every consumer. The producer protects itself server-side with rate limits and publishes its backoff contract, which the caller honors through its own resilience library.

**The absurdity becomes obvious with frontend consumers.** The iOS app doesn't need a backend team's Swift package to call its API. The iOS team reads the documentation, or generates a client from the published schema itself, and maps responses to whatever structures suit the application. The consumer's requirements don't change based on what language they're written in.

This reflexive reach for client libraries has been conditioned by years of cargo-culting. Patterns that made sense in public cloud SDKs with complex auth flows got carried into internal services with straightforward REST endpoints, where they don't. When an internal API needs multi-step orchestration or idempotency handling to call correctly, that logic belongs behind the API, where the producer controls it, not in a package every consumer has to upgrade.

## The Governance Theater Problem

Shared libraries often emerge from a governance impulse: "Teams are doing things inconsistently. We need to standardize."

The instinct isn't wrong, and consistency matters. But shared libraries are governance theater.

If teams are building things inconsistently, ask why. Usually it's because they don't share the same understanding of what matters, what the tradeoffs are, and what "good" looks like. That's an alignment problem. It requires conversation, documentation, and shared values.

Forcing everyone to use the same library doesn't create alignment. It creates compliance.

Governance through values: "Here's why we authenticate this way, here are the tradeoffs, here's what we're optimizing for. Align your implementation to these principles."

Governance through code: "Use this library or you're non-compliant."

The first creates alignment while preserving autonomy. Teams understand the principles and can make good decisions in novel situations. The second creates coupling while providing the illusion of alignment. Teams comply without understanding, and the moment they hit a situation the library doesn't cover, they're lost.

Values still need enforcing. Conformance tests, linters, and reviews against the stated principles keep alignment from decaying. They gate builds rather than ship inside services, so updating one forces no release, and a new rule can start as a warning. An optional "paved road" library that teams can leave when their needs differ is closer to the first kind. The values come first, and the library is one documented way to follow them. It turns into theater when using the library becomes the compliance check.

## The Exception: Security Protocols

There's one domain where shared libraries routinely make sense: security protocols like ingress handling, service-to-service authentication, and encryption standards.

Why security is different:

- **The domain is stable and well-understood.** Authentication patterns don't change week to week.
- **The cost of getting it wrong is catastrophic.** Security isn't a place for teams to make independent decisions and learn from mistakes.
- **The surface area is thin and focused.** A good security library does one thing.
- **Autonomy isn't the goal.** You actually want teams to do security the same way. The coupling is a feature, not a bug.

Other code that must behave identically everywhere usually lands elsewhere. Trace-context propagation belongs in external libraries such as OpenTelemetry, which implement the W3C Trace Context standard, and a regulatory calculation belongs in a service. In-process code that meets the four conditions above, such as redacting personal data before logs leave a service, earns the same exception. Security is where that holds most often.

Even here, mature external libraries or a service mesh should do the protocol work, and the internal library should be the thinnest layer that applies your organization's policy. The moment it starts accumulating "helpful" utilities beyond its core purpose, it's sliding toward the problems that plague other shared libraries.

## What to Do Instead

When you feel the urge to create a shared library, pause and diagnose the actual problem:

- **If it's a capability multiple services need:** Build a service and expose an API, unless the logic is stable enough to version like an external library.

- **If the services need the same logic because they share a domain:** Redraw the boundary. The shared code is a symptom of a split in the wrong place.

- **If it's a pattern you want to standardize:** Write documentation. Explain the principles, the tradeoffs, and the reasoning. Let teams implement the pattern in their own codebases. They'll understand it better than if they'd just imported your abstraction.

- **If it's truly just duplicated code:** Let it be duplicated. For small code that rarely changes, the coordination cost of sharing exceeds the maintenance cost of duplication.

- **If it's a security primitive:** Fine. Build the library. Keep it minimal, stable, and focused. Recognize it's a necessary evil, not a model to emulate.

The shared library is a solution to a problem that rarely exists in the form people imagine. Duplicating small, stable code isn't what slows teams down. Coordination overhead is.

Share values, and the shared library more often becomes unnecessary.
