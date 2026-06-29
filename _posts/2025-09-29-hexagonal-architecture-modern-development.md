---
layout: post
title: "Are You Using Hexagonal Architecture, or Just Dependency Injection?"
date: 2025-09-29
tags: [architecture, design-patterns, software-design]
description: "Most developers achieve hexagonal architecture's goals without implementing its structure. Modern frameworks offer testability and decoupling through different means, and understanding this distinction clarifies what you're actually building."
---

I've noticed something curious after having read certain posts or having talked with certain teams about their architecture. Some describe themselves as "using hexagonal architecture" because they have repository interfaces and dependency injection. But when the conversation turns to symmetric treatment of UI and database as external actors, or how they swap adapters in production, the pattern doesn't quite match. They've achieved testability and decoupling (which were Cockburn's original goals) but through standard layered architecture and modern framework patterns rather than hexagonal structure.

Knowing what you're actually building matters, not as pedantry about pattern purity, but because it helps when learning patterns, discussing architecture decisions, or interviewing for roles that mention specific architectural styles.

## Cockburn's Vision vs. Modern Reality

In 2005, Alistair Cockburn described hexagonal architecture with a clear goal: "Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."

This sounds exactly like what modern frameworks encourage through dependency injection, interface-based design, and built-in testing support. The goals resonate because they address concrete challenges like tight coupling to infrastructure, difficulty testing business logic, and fragile dependencies on external systems.

But Cockburn's implementation was specific. Hexagonal architecture treats the UI and database identically as external actors. It positions multiple driving mechanisms (REST endpoints, CLI tools, automated tests, batch scripts) as first-class equals, not as primary interface with secondary test harnesses. It defines ports as distinct boundaries with swappable adapters that can change at runtime or between deployments.

<blockquote class="pull-quote">
<p>The gap emerges when developers use framework DI to achieve testability and call it "hexagonal architecture" while still organizing code in standard layers.</p>
</blockquote>

They've met the goals but haven't implemented the structure.

## What Most Teams Are Actually Building

If you look at modern codebases that claim hexagonal architecture, you'll find three common patterns:

**True hexagonal architecture** is rare. It requires explicit symmetry where UI and database adapters are interchangeable external actors, multiple driving mechanisms treated as equals, and actual runtime adapter swapping. Most systems don't need this level of abstraction.

**Layered architecture with dependency injection** is what most teams build. They use framework DI with repository interfaces, achieve testability and decoupling through standard framework patterns, and organize code in traditional layers. They might call interfaces "ports" but the mental model is still layered, not symmetric.

**Terminological confusion** is widespread. Teams use "hexagonal" as shorthand for "clean architecture" or any codebase with interfaces and dependency injection. The term loses its specific structural meaning and becomes synonymous with "well-designed."

## The Infrastructure Shift That Changed Everything

Modern deployment practices have changed the context in which hexagonal architecture operates. We deploy immutable containers with dependencies baked in at build time. You don't swap adapters at runtime; you deploy new container images through CI/CD pipelines. The entire notion of runtime adapter flexibility contradicts immutable infrastructure principles.

More importantly, cross-cutting concerns that hexagonal architecture addressed through adapters (monitoring, observability, authentication, rate limiting) are now handled by service meshes and API gateways external to your application code. These infrastructure patterns externalize what hexagonal architecture internalized.

The "swappable adapters" benefit that justified hexagonal structure in 2005 doesn't materialize when you're deploying immutable infrastructure with externalized concerns. Modern frameworks achieve Cockburn's original goals (testability, decoupling, isolation from runtime dependencies) through dependency injection and interface-based design without requiring symmetric structural patterns.

## When Precision Matters

Hexagonal architecture appears in courses, certifications, and job requirements. Goals and structure diverge in concrete situations:

**Learning accurately**: If you're studying architectural patterns, understanding that you're implementing layered architecture with DI rather than true hexagonal structure helps you learn what the patterns actually are, not just what they aim to achieve.

**Technical interviews**: When asked about hexagonal architecture, articulating the difference between Cockburn's structural pattern and modern framework approaches demonstrates deeper understanding than just saying "we use ports and adapters."

**Team alignment**: Avoiding confusion when discussing patterns prevents miscommunication. If one developer thinks "hexagonal" means symmetric actors and another thinks it means "has repository interfaces," you're not actually aligned on design decisions.

<blockquote class="pull-quote">
<p>Modern frameworks achieve hexagonal architecture's original goals through different structural means. Unless you're explicitly implementing symmetric drivers and swappable adapters, you're likely using layered architecture with dependency injection.</p>
</blockquote>

That's perfectly valid for most systems, and there's no need to retrofit the hexagonal label onto standard practices.