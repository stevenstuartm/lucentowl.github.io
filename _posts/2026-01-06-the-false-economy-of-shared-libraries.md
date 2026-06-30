---
layout: post
title: "How Shared Libraries Become Shared Shackles"
date: 2026-01-06
description: "Shared libraries promise reuse and consistency but more often bind team autonomy and development tempo through coupling and coordination overhead. The consistency they claim to provide is better achieved by sharing principles, tradeoffs, and values rather than sharing implementation."
tags: [architecture, distributed-systems, microservices, governance]
---

This is a highly opinionated take on shared libraries and the damage they do to team autonomy and development tempo. Teams deliver value faster and more consistently when they can make decisions, ship changes, and evolve their domains without coordinating across organizational boundaries. Shared libraries erode exactly that independence.

The principle applies anywhere domains and teams need independence, but this post focuses on distributed architectures because that's where the consequences are most severe. When independently deployable components, owned and operated by different teams, get bound together by shared packages, those packages undermine the very independence the architecture was designed to provide.

After seeing costs explode for trivial tasks and critical production updates failing to deliver on time in nearly every organization I have witnessed, I am willing to take a rather "extreme" stance on the subject.

## Shared Libraries Violate Core Principles

Distributing components isn't just about distributing work. It's about the Single Responsibility Principle applied at the system level: clear ownership, implementation isolation, and infrastructural independence. These benefits are often implicit in the decision to distribute, but they're the whole point. The share-nothing principle makes this explicit. Services should be autonomous, independently deployable, and free from implementation coupling. When services share nothing, teams can deploy, scale, and evolve on their own terms, at their own tempo.

Shared libraries violate these principles. They couple teams through shared implementation despite being distributed in name, creating little monoliths that bind development tempo across teams that were meant to operate independently. What's at stake isn't code organization; it's each team's ability to make decisions, ship changes, and evolve their domain without waiting on teams that have different priorities and different timelines.

Yet the pitch keeps coming: "We have this code in three places. Let's consolidate it into a shared library. We'll save time, ensure consistency, and make everyone's life easier." It sounds reasonable, it really does, yet the decision only calculates the cost of duplication while ignoring the cost of sharing across teams, domains, and technical boundaries.

## The Costs

When someone proposes a shared library, they calculate the savings: "This code exists in five services. If we consolidate, we only maintain it once."

What they don't always sufficiently calculate:

### Version conflicts and upgrade pain

Five teams (at worst) now depend on your library. They release on different cadences and at some point one or more teams require a breaking change. Now you're either maintaining multiple versions indefinitely or forcing upgrades on teams that have other priorities. The "one place to maintain" becomes "one place that blocks everyone."

### Teams blocked waiting for changes

A team needs functionality the library doesn't have. They can't just add it. They need to coordinate with the library owners, get the change approved, wait for a release, and then upgrade. What would have been a two-hour change becomes a two-week dependency chain.

### Debugging across boundaries

When something breaks, the investigation now spans your code and the library code. Your team doesn't own the library. Maybe they don't fully understand it. The abstraction that was supposed to simplify their lives has added a layer they have to dig through.

### Bloat or fragmentation, pick your poison

The library starts focused. Then another team needs something slightly different. Then another. The library accumulates features to serve multiple masters, becoming a grab-bag of loosely related functionality coupled together because they share a package, not because they belong together. The disciplined alternative is to split it into many small, focused packages, but that creates its own problem: an entourage of dependencies that each consuming team must track, version, and coordinate with. Instead of one bloated library blocking you, ten focused ones collectively recreate the same burden.

### Obscured accountability

Shared libraries don't reduce your quality burden; they move it somewhere less visible. If the library has a bug, your service has a bug. Every service still needs its own load testing, chaos testing, penetration testing, and UAT regardless of whether the underlying code is shared or duplicated. The library doesn't absorb responsibility for your service's behavior. It just adds a dependency you don't own and can't fully verify.

## The Cohesion and Coupling Diagnosis

If two services genuinely need the same function, you have three possibilities:

**It's a cohesion problem.** That function belongs in one place and should be called, not duplicated. Extract it into a service with an API. Now there's a clear owner, a clear contract, and no shared implementation coupling consumers together.

**It's a coupling problem.** You've drawn your boundaries wrong. The services that "need" the same code are actually more related than you thought. Reconsider where the boundary belongs rather than papering over the boundary violation with a shared dependency.

**It's genuinely independent.** The similarity is coincidental. Both services need to format dates or parse JSON or validate email addresses. Copy the code. Move on. The duplication costs less than the coordination, and the implementations can evolve independently as each service's needs diverge.

A shared library is almost never the right answer because the problem it solves (duplicated code) rarely justifies the problems it creates (coupling, versioning, blocked teams).

The common rebuttal is "but if there's a bug, I fix it once and it propagates everywhere." Consider what code that would actually be in a well-architected distributed system. Cross-cutting concerns like logging, networking, and observability are handled by infrastructure through sidecars and service meshes. Security is already an acknowledged exception. Third-party libraries have their own maintenance cycles. What remains is business logic, and if your business logic is so coupled across services that a single bug requires simultaneous fixes everywhere, you don't have a sharing problem, you have a boundary problem, which brings you back to the diagnosis above.

## Don't Reinvent the Wheel vs. Don't Share Internal Types

Using mature, well-tested libraries for universal problems makes sense. Logging frameworks, HTTP clients, serialization libraries, and authentication middleware exist because these problems are universal and well-understood. Someone else solved them better than you would, and the cost of depending on their solution is low because the solution is stable.

Sharing your internal `CustomerDto` across services is different. Sharing your "standard" repository pattern is different. Sharing your domain models between bounded contexts is different. These aren't universal problems with stable solutions. They're your internal abstractions, and forcing them on other teams assumes those teams should think the same way you do.

External libraries abstract universal problems. Internal shared libraries impose your specific mental model on teams that might have legitimately different needs.

## SDKs Are Different

An SDK abstracts what you expose: the public contract of a service or platform. A good SDK earns its existence by encoding integration complexity that would be expensive and error-prone for every consumer to reimplement: orchestrating multi-step workflows, managing state across API calls, handling idempotency, and abstracting version differences. The value isn't hiding HTTP calls (documentation handles that); it's centralizing integration logic complex enough to justify the maintenance cost across supported runtimes.

An SDK also has a different lifecycle. The platform is built first; the SDK comes afterward for a different audience. Its development and release cycles are separate from the internal teams building features, because the dynamics with external customers differ from the dynamics between internal teams.

A shared library abstracts how you think internally: your domain models, your patterns, your "standard way" of doing things. It exists because someone decided other teams should think the same way. The shared library serves a governance impulse, not the consumer. And unlike an SDK, it tries to couple internal teams to the same release cycle and the same implementation decisions.

The SDK says: "Here's how to use our thing."
The shared library says: "Here's how you should build your thing."

One is a service to consumers. The other is an imposition on autonomous teams disguised as help.

## Your Runtime Already Solved This

The shared library pitch often targets "utility code" that your runtime already provides. If you're using .NET, the framework gives you HTTP clients, JSON serialization, logging abstractions, dependency injection, and configuration management. Why would you need an internal shared library wrapping `HttpClient` when `HttpClient` exists and is battle-tested by millions of applications?

The urge to share usually targets exactly this kind of code: wrappers, helpers, and utilities that add a thin layer over framework primitives. But the framework primitives are already shared. They're already tested. They're already documented. Your wrapper just adds coordination overhead on top of something that didn't need wrapping.

This varies by ecosystem. For example, Python's dependency management is notoriously painful, and shared internal libraries compound the problem. You're coordinating versions across teams in an ecosystem that already struggles with version conflicts. The runtime that makes sharing easiest is often the one where sharing is least necessary.

## The Principle Is Broader Than Distribution

An obvious question: if shared libraries are a problem in distributed systems, were they also a problem in the modular monolith that preceded them?

Wherever different teams own different domains, yes. In a modular monolith, shared packages between domains still couple teams to the same change cycles. The difference is severity. In a monolith, the blast radius is contained: teams share a deployable and version conflicts manifest as build errors rather than runtime failures. That pain is contained but manageable. In a distributed system, that same coupling spans deployment pipelines, release cadences, and versioning strategies. A change that would have been a merge conflict in a monolith becomes a multi-team coordination effort with blocked releases and stale dependencies.

Layered architectures sidestep this by design because layers already enforce separation; sharing across layers is a violation of the architecture itself, not a shared library problem. But in domain-oriented architectures, the discipline matters regardless of deployment topology. If Domain A and Domain B need to evolve independently, coupling them through shared implementation undermines that independence whether they're projects in the same solution or services in different repositories.

## No Architecture Style Wants This

The shared library pitch assumes that code reuse across boundaries is inherently valuable. But examine any coherent architectural paradigm and the opposite becomes clear.

### Layered architecture

Layered architecture separates concerns into distinct layers. If your presentation layer and your data layer share a library, you've coupled what you explicitly designed to be independent.

### Domain-driven architecture

Domain-driven architecture creates autonomous domains with clear boundaries. If Domain A and Domain B share implementation code, they're not really autonomous. They're a distributed monolith with extra steps.

### Functional/technical architecture

Functional/technical architecture defines components accessed through explicit interfaces. The behavior should live in a component that others call, not in a library that everyone imports.

### Polyglot architectures make it worse

The shared library pitch assumes a homogeneous technology landscape that rarely exists. If your organization has services in C#, Java, Python, and Go, do you maintain and keep four versions of every shared library in sync? In polyglot environments, the "shared" library becomes a second-class citizen in every language except the one the authoring team actually uses. The promise of consistency becomes a guarantee of inconsistency across language boundaries.

## The API Client Library Obsession

The most common incarnation of shared library dysfunction is the API client package: a library containing contracts, DTOs, and client code that consumers are expected to import when calling your service. I have never seen this pattern result in anything short of chaos.

The pitch sounds reasonable: "We'll publish a client library so consumers don't have to write their own HTTP calls or define their own contracts." But this solves a problem that doesn't exist while creating several that do.

**Every API should have documentation describing its contracts.** If your API is well-documented with clear schemas, consumers can generate or write their own clients trivially. The documentation is the contract. A client library doesn't replace documentation; it's a poor substitute for it.

**Every consumer has different needs.** Service A might need three fields from one endpoint. Service B might need ten fields from a different endpoint. Service C might need to call the same endpoint but transform the response differently. When you force everyone to use your client library, you're imposing your view of how your API should be consumed. But consumers know their own needs better than you do.

**Client libraries confuse application concerns with infrastructure concerns.** Teams building client libraries inevitably add caching strategies, retry policies, circuit breakers, and connection pooling configurations. These aren't client concerns. They're infrastructure concerns that belong in service meshes, sidecars, and API gateways where they can be configured, observed, and tuned without redeploying applications.

A client library buries these decisions in application code where they're invisible to operations and impossible to change without a coordinated release across every consumer. The library author predicts traffic patterns and failures as if every consumer will behave identically. They won't.

**The absurdity becomes obvious with frontend consumers.** Few teams would publish an npm package for their React app to import API contracts, or a Swift package for iOS. Frontend teams read documentation, call endpoints, and map responses to whatever structures suit their application. Backend services have the same needs. The consumer's requirements don't change based on what language they're written in.

This reflexive reach for client libraries has been conditioned by years of cargo-culting patterns from contexts where they made sense (public cloud SDKs with complex auth flows) into contexts where they don't (internal services with straightforward REST endpoints). It's a tax on every consumer and a maintenance burden on every producer, justified by an efficiency that never materializes.

## The Governance Theater Problem

Shared libraries often emerge from a governance impulse: "Teams are doing things inconsistently. We need to standardize."

The instinct isn't wrong, and consistency matters. But shared libraries are governance theater. They create the appearance of consistency without addressing the underlying problem.

If teams are building things inconsistently, ask why. Usually it's because they don't share the same understanding of what matters, what the tradeoffs are, and what "good" looks like. That's an alignment problem. It requires conversation, documentation, and shared values.

Forcing everyone to use the same library doesn't create alignment. It creates compliance. Teams will use your library and still build inconsistent systems because the library doesn't encode the thinking and testing.

Governance through values: "Here's why we authenticate this way, here are the tradeoffs, here's what we're optimizing for. Align your implementation to these principles."

Governance through code: "Use this library or you're non-compliant."

The first creates alignment while preserving autonomy. Teams understand the principles and can make good decisions in novel situations. The second creates coupling while providing the illusion of alignment. Teams comply without understanding, and the moment they hit a situation the library doesn't cover, they're lost.

## The Exception: Security Protocols

There's one domain where shared libraries make sense. Shared libraries can work for security protocols like ingress handling, service-to-service authentication, and encryption standards.

Why security is different:

- **The domain is stable and well-understood.** Authentication patterns don't change week to week. The library doesn't need constant evolution to serve its consumers.
- **The cost of getting it wrong is catastrophic.** Security isn't a place for teams to make independent decisions and learn from mistakes. The blast radius is too large.
- **The surface area is thin and focused.** A good security library does one thing. It's not a grab-bag of utilities that grows to serve multiple purposes.
- **Autonomy isn't the goal.** You actually want teams to do security the same way. The coupling is a feature, not a bug.

Even here, the library should be as minimal as possible. Provide the security primitive and get out of the way. The moment it starts accumulating "helpful" utilities beyond its core purpose, it's sliding toward the problems that plague other shared libraries.

## What to Do Instead

When you feel the urge to create a shared library, pause and diagnose the actual problem:

- **If it's a capability multiple services need:** Build a service, not a library. Expose an API. Now there's clear ownership, independent deployment, and consumers that can't get version-locked.

- **If it's a pattern you want to standardize:** Write documentation. Explain the principles, the tradeoffs, and the reasoning. Let teams implement the pattern in their own codebases. They'll understand it better than if they'd just imported your abstraction.

- **If it's truly just duplicated code:** Let it be duplicated. The coordination cost of sharing exceeds the maintenance cost of duplication. And the duplicates can evolve independently as needs diverge.

- **If it's a security primitive:** Fine. Build the library. Keep it minimal, stable, and focused. Recognize it's a necessary evil, not a model to emulate.

The shared library is a solution to a problem that rarely exists in the form people imagine. Code duplication isn't what slows teams down. Coordination overhead is. Obsessing over shared code compliance and version alignment diverts attention from what actually produces consistency: shared understanding of principles, tradeoffs, and what "good" looks like. Teams that understand the reasoning make good decisions without needing a library to make decisions for them.

Share values, and the shared library more often becomes unnecessary.
