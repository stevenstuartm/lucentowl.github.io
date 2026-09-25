---
layout: guide
title: "Architecture Foundations"
category: Architecture
subcategory: Foundations
description: "What makes a decision architectural rather than design, why every architectural choice is a trade-off whose reasoning matters as much as its outcome, and how the top-level split of a system and Conway's Law shape its structure."
tags: [fundamentals, trade-offs, architecture-vs-design, conways-law, domain-partitioning, inverse-conway-maneuver]
---

Software architecture is the set of decisions about a system that are expensive to change later. They settle how the system is divided and deployed, which qualities it has to deliver, such as scalability, security, or availability, and the rules that keep later work consistent with those choices. Recognizing which decisions are architectural, and weighing them well, is most of the job.

## What Makes a Decision Architectural

A decision is architectural when reversing it would be expensive and its effects reach well beyond the code where it was made. A decision that one developer can change in an afternoon, affecting only their own component, is design.

Consider database selection. Choosing between a relational database and a document store is architectural. It affects how the entire system stores and retrieves data, shapes the skills the team needs, and is expensive to reverse. Choosing which indexes to add to a table is design, because it is localized, easy to change, and affects few people.

Most decisions fall between those two examples. Mark Richards and Neal Ford make this one of their laws of software architecture: architecture decisions rarely come as binary choices. A system is seldom simply "microservices or not." It is more or less distributed, more or less coupled, with a core that holds more or less of the functionality. Placing a decision on that spectrum still tells an architect where to spend attention, which is on the decisions with the longest reach and the highest cost of reversal.

## Every Choice Is a Trade

> "Rich Hickey once said programmers know the benefits of everything and the trade-offs of nothing. Architects need to understand both."
>
> -- Nathaniel Schutta, *Thinking Architecturally* (2018)

Richards and Ford's first law states it flatly: everything in software architecture is a trade-off. Choosing microservices over a monolith trades simplicity for independent scalability and deployment. Choosing eventual consistency over strong consistency trades immediate correctness for availability. An option that seems to have no downside usually has one nobody has found yet.

Because every option costs something, no option is correct in general. The right one depends on what the business needs and can afford: its goals, budget, delivery timelines, culture, and the skills of the team that will run the system. What works for Netflix may not work for a ten-person startup, and what works in finance may not work in e-commerce. A stakeholder's "the system must be reliable" becomes a specific set of qualities to deliver and pay for, and those qualities, rather than the functional requirements, tend to decide the architecture.

The same reasoning is why Richards and Ford's second law says that why is more important than how. A diagram shows how a system is built. The reasoning behind it, including the alternatives that were rejected and what each would have cost, is what lets someone change it safely later. That is the case for recording decisions, not only their outcomes.

## How the Top-Level Split Shapes a System

One of the earliest structural decisions is how to divide the system at its top level. The code can be organized by kind of work, with presentation in one place, business rules in another, and data access in a third, or by business capability, with everything checkout needs in one place and everything inventory needs in another. Richards and Ford call these technical and domain partitioning.

{% include figure.html id="arch-partitioning" %}

The difference shows up in where a change lands. Organized by kind of work, a change to checkout touches every layer, and the checkout concept is scattered across all of them. That arrangement suits specialists who work within one layer, and it makes a later move to separately deployed services hard, since no part of the code corresponds to one service. Organized by capability, the same change stays inside one partition, a cross-functional team can own it end to end, and each partition is already a candidate service boundary. The cost is that shared standards, such as how every partition handles errors or data access, need deliberate effort to stay consistent.

### Conway's Law

> "Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure."
>
> -- Melvin Conway, [*How Do Committees Invent?*](https://www.melconway.com/research/committees.html){:target="_blank" rel="noopener noreferrer"} (Datamation, 1968)

Team structure influences system architecture. Teams organized by technical specialty, such as a frontend team, a backend team, and a database team, tend to build a system divided by kind of work. Teams organized by business domain, such as checkout, inventory, and payments, tend to build one divided by capability.

This happens because people design systems that reflect how they communicate. Frontend and backend developers who rarely talk build rigid boundaries between presentation and business logic. Cross-functional teams that collaborate daily build integrated vertical slices.

<blockquote class="pull-quote">
<p>People design systems that reflect their communication patterns.</p>
</blockquote>

### The Inverse Conway Maneuver

If communication structure shapes architecture, the relationship can be used deliberately. Jonny LeRoy and Matt Simons named the idea the **Inverse Conway Maneuver** in a 2010 *Cutter IT Journal* article: structure the teams to encourage the architecture you want. To get a system divided by business capability, organize cross-functional teams around business domains first, and the architecture tends to follow.

The maneuver only works when the rest of the organization changes with the teams. Reorganizing teams around domains while keeping a shared database team, a central approval board, or a single release train preserves the old communication paths, and the architecture tends to follow those instead.
