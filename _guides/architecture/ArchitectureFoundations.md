---
layout: guide
title: "Architecture Foundations"
category: Architecture
subcategory: Foundations
description: "The laws of software architecture, what an architecture is made of, where architecture ends and design begins, how architects weigh trade-offs and translate business goals, and how partitioning and Conway's Law shape system structure."
tags: [fundamentals, trade-offs, architecture-vs-design, conways-law, domain-partitioning, inverse-conway-maneuver]
---

## The Laws of Software Architecture

Mark Richards and Neal Ford organize *Fundamentals of Software Architecture* around two laws. The second edition (2025) adds a third.

**1. Everything in software architecture is a trade-off.** Choosing one characteristic, like scalability, usually means giving up some of another, like simplicity. The book adds a corollary. If an architect thinks they have found something that isn't a trade-off, they more likely just haven't identified the trade-off yet.

**2. Why is more important than how.** A diagram shows how a system is built. The reasoning behind it, including the alternatives that were rejected, is what lets someone change it safely later.

**3. Architecture decisions rarely come as binary choices.** Most sit somewhere on a spectrum. A system is seldom simply "microservices or not." It is more or less distributed, more or less coupled, with a core that holds more or less of the functionality.

## What an Architecture Is Made Of

An architecture is more than the boxes and lines on a diagram. Several interconnected elements make it up.

**Structure** defines how the system is organized: the components and their relationships. Think of it as the blueprint showing what pieces exist and how they connect.

**Architecture characteristics** are the qualities the system must deliver, such as scalability, performance, security, and maintainability. They tend to drive architectural decisions more than functional requirements do.

**Logical components** are the behavioral building blocks of the system. Each has a defined responsibility and encapsulates related functionality.

**Style** is the overall topology, such as layered, microservices, or event-driven architecture. The style determines how components interact and deploy.

**Decisions** establish the rules and constraints that guide how the system is built, including technology choices, standards, and governance policies.

Each element constrains the others. A characteristic like elastic scalability narrows the viable styles, the chosen style shapes the components, and the decisions record why. Reasoning about one element while ignoring the rest tends to produce an architecture that looks coherent on paper and fights itself in practice.

<blockquote class="pull-quote">
<p>Characteristics tend to drive architectural decisions more than functional requirements do.</p>
</blockquote>

## Architectural Thinking

### Where Architecture Ends and Design Begins

Architecture deals with strategic, long-term decisions that are hard to change and involve significant trade-offs. Design deals with tactical, short-term decisions that are easier to change and involve fewer trade-offs.

Three questions help place a decision: how much planning it needs, how many people it affects, and whether it serves a long-term vision or an immediate problem.

Consider database selection. Choosing between a relational database and a document store is architectural. It affects how the entire system stores and retrieves data, shapes the skills the team needs, and is expensive to reverse. Choosing which indexes to add to a table is design, because it is localized, easy to change, and affects few people.

Most decisions fall between those two examples, which is the third law in action. Placing a decision on that spectrum still helps an architect spend their attention on the decisions with lasting impact.

### Analyzing Trade-Offs

> "Rich Hickey once said programmers know the benefits of everything and the trade-offs of nothing. Architects need to understand both."
>
> -- Nathaniel Schutta, *Thinking Architecturally* (2018)

Every architectural decision involves trade-offs. Choosing microservices over a monolith trades simplicity for independent scalability and deployment. Choosing eventual consistency over strong consistency trades immediate correctness for availability. No option is correct in general. The right choice depends on context.

That context includes the environment, business drivers, organizational culture, budget, delivery timelines, and team skills. What works for Netflix may not work for a ten-person startup, and what works in finance may not work in e-commerce.

### Translating Business Goals into Characteristics

Architects translate business requirements into architecture characteristics. When stakeholders say "the system must be reliable," that translates into decisions about redundancy, failover, monitoring, and recovery procedures. When they say "we need to scale rapidly," that informs decisions about horizontal scalability, stateless design, and distribution.

Common business concerns map to architectural priorities:

- **Cost** concerns drive decisions about cloud vs. on-premises, serverless vs. containers, and build vs. buy
- **Time to market** pressure favors simpler architectures, existing platforms, and less customization
- **User satisfaction** translates to performance, availability, and user experience characteristics
- **Strategic positioning** influences decisions about vendor lock-in, open standards, and long-term flexibility

## Partitioning Strategies

One of the first structural decisions is how to partition the system at its top level: by technical capability or by business domain. The choice affects team structure, communication patterns, and how hard the system is to change later.

{% include figure.html id="arch-partitioning" %}

<div class="comparison">
<div class="content-card">
<h4>Technical Partitioning</h4>
<p>Organizes the system by technical capability: presentation, business logic, and persistence. Each layer contains code for one technical concern, regardless of which business domain it serves.</p>
<p><strong>Advantages:</strong> Clear technical separation, a natural fit for layered architecture, and developers with specialized skills can focus on their layer.</p>
<p><strong>Trade-offs:</strong> High global coupling, a single business feature requires changes across all layers, domain concepts scatter across layers, and migrating to a distributed architecture is difficult.</p>
</div>
<div class="content-card">
<h4>Domain Partitioning</h4>
<p>Organizes the system by business domains or workflows. Each partition contains all the technical layers needed to deliver a capability within its domain.</p>
<p><strong>Advantages:</strong> Models the business more naturally, supports cross-functional teams owning vertical slices, and provides natural service boundaries if the system later distributes.</p>
<p><strong>Trade-offs:</strong> Customization code appears in multiple places, consistency across partitions requires discipline, and shared standards are needed across domains.</p>
</div>
</div>

### Conway's Law

> "Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure."
>
> -- Melvin Conway, [*How Do Committees Invent?*](https://www.melconway.com/research/committees.html){:target="_blank" rel="noopener noreferrer"} (Datamation, 1968)

Team structure influences system architecture. Teams organized by technical specialty, such as a frontend team, a backend team, and a database team, tend to build a technically partitioned, layered architecture. Teams organized by business domain, such as checkout, inventory, and payments, tend to build a domain-partitioned one.

This happens because people design systems that reflect how they communicate. Frontend and backend developers who rarely talk build rigid boundaries between presentation and business logic. Cross-functional teams that collaborate daily build integrated vertical slices.

<blockquote class="pull-quote">
<p>People design systems that reflect their communication patterns.</p>
</blockquote>

### The Inverse Conway Maneuver

If communication structure shapes architecture, the relationship can be used deliberately. The **Inverse Conway Maneuver** structures teams to encourage the architecture you want. To get a domain-partitioned architecture, organize cross-functional teams around business domains first, and the architecture tends to follow.

The maneuver only works when the rest of the organization changes with the teams. Reorganizing teams around domains while keeping a shared database team, a central approval board, or a single release train preserves the old communication paths, and the architecture tends to follow those instead.
