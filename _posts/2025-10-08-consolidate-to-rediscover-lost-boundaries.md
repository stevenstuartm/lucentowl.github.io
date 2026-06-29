---
layout: post
title: "Consolidate Architecture to Rediscover Lost Agility"
date: 2025-10-08
tags: [architecture, distributed-systems, refactoring, system-design, technical-debt, microservices]
description: "When distributed systems lose their rationale through team churn, consolidation reveals true boundaries. Merge tightly-coupled services to discover what boundaries actually make sense, then split correctly when justified."
---

Most of us have lived this at least once: you arrive at a new organization, team, or project and find a distributed system that nobody recalls the reasoning for. Components were divided early based on assumptions that stopped being valid long ago, databases are fragmented across services with unclear ownership, and team churn has erased whatever rationale once justified the boundaries. Every deployment requires coordinating releases across multiple services and database migrations. You have only just arrived and you already have distributed complexity without distributed benefits.

<blockquote class="pull-quote">
<p>This is a distributed monolith: services that are technically separate but functionally coupled. The architecture diagram shows independence that doesn't exist in practice.</p>
</blockquote>

## Why Standard Approaches Fall Short

Aging systems suffer from architectural amnesia. Boundaries reflect organizational charts from three reorganizations ago. Components couple through shared databases, common libraries, and undocumented assumptions that only surface during incidents. The original designers moved on, and their decisions live only in production behavior.

Standard advice says to add abstraction layers or apply domain-driven design to clarify boundaries. Both approaches struggle when you don't understand the existing system.

Abstraction over poorly understood systems is expensive. You build scaffolding around structures you haven't examined, often abstracting over the wrong boundaries and encoding existing coupling into new interfaces. This creates the sinkhole anti-pattern where layers pass data without adding value, becoming maintenance burdens themselves. You can't abstract correctly when you don't know where the true boundaries are.

Domain-driven design requires visibility you may lack. The system predates your team's tenure. Databases are fragmented with unclear ownership. Domain knowledge lives only in production incidents and tribal knowledge. Architecture Decision Records don't exist. Team topologies shifted multiple times without corresponding architectural adjustment. You can't draw bounded contexts through fog.

## Consolidation as Discovery

Consolidate services and databases that have high cohesion and coupling. Bring tightly-related components back together into a unified codebase. This might sound like moving backward, but it creates the clarity needed to move forward correctly.

Consolidation reduces cognitive load by eliminating the overhead of tracking distributed interactions. Instead of following request chains across five services to understand one user flow, you read through a single codebase with clear control flow. The mental model simplifies dramatically.

Consolidated systems make boundaries visible. When services call through convoluted APIs or perform cross-database joins for simple queries, the boundaries are artificial. When merging code from two services into one codebase exposes no actual separation of concerns, the split was premature. When database consolidation eliminates dozens of network calls without losing any semantic isolation, the fragmentation was serving infrastructure, not the domain.

Unified codebases enable safe refactoring. Compilers check correctness across the entire system. Database migrations run transactionally. Commits are atomic. Compare this to coordinating changes across services, deployment pipelines, teams, and database schemas where a mistake in any one piece breaks the system.

Consolidation also reverses Conway's Law. When architecture matches obsolete team structures, you're trapped by history. Bringing components back together lets you reshape the architecture independent of how teams happened to be organized in the past.

## How to Consolidate

Identify consolidation candidates through temporal coupling. Services that change together in version control history are likely part of one logical component. Measure coupling through inter-service call frequency, cross-database queries, and shared libraries. Assess cohesion by examining whether related data and functions are split artificially. Review database relationships for shared tables, replication patterns, and foreign keys that span services.

Consolidate selectively. Merge components with high cohesion and coupling while keeping genuinely independent services separate. When consolidating databases, you eliminate network calls for joins and make relationships explicit through foreign keys instead of application logic.

Enforce internal boundaries within the consolidated codebase using modular monolith patterns with clear interfaces between modules. Document decisions in Architecture Decision Records: why you consolidated, what metrics drove the decision, what the intended module boundaries are, and what conditions would justify future extraction.

Align teams with the resulting topology. If three teams are working on what's now one service, you need either clear module boundaries for each team or a different team structure. Architecture and organization must support each other.

Extract services again only when justified by concrete needs: different scaling requirements, independent release cycles, genuine functional independence, or bounded contexts with minimal data sharing. Extraction should be driven by concrete problems, not abstract principles.

## Prevention Through Documentation

Systems with good Architecture Decision Records rarely need aggressive consolidation because the rationale for boundaries persists across team changes. When team topologies align with domain boundaries and evolve together with architecture, splits happen for good reasons and stay aligned with reality.

The consolidation pattern works because so many systems lack this discipline. Boundaries were drawn arbitrarily, teams reorganized without architectural adjustment, and knowledge eroded over time.

## When Consolidation Makes Sense

"Monolith first" is good advice for greenfield development. "Consolidate to rediscover boundaries" is the equivalent for inherited complexity. You're not building a monolith; you're removing premature distribution to discover what boundaries actually make sense.

This doesn't work for every system. Some genuinely benefit from their current distribution. Some teams can successfully refactor in place with strong domain knowledge. But for teams facing unclear boundaries and knowledge loss, consolidation provides a pragmatic path to appropriate boundaries informed by reality: measured coupling and cohesion, aligned topologies, and documented rationale.

<blockquote class="pull-quote">
<p>The goal isn't to stay consolidated forever. It's to gain enough understanding to split correctly when the time comes.</p>
</blockquote>
