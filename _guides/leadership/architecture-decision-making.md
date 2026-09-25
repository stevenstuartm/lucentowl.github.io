---
layout: guide
title: "Architecture Decision-Making"
category: Leadership & Team Management
subcategory: Engineering Leadership
description: "The life of an architecture decision: recognizing which decisions are architecturally significant, when to make, defer, or delegate them, justifying them so they aren't relitigated, and recording them as ADRs in one place so they hold."
tags: [practical, decision-making, adrs, architectural-significance, last-responsible-moment, reversibility]
---

An architecture decision has a life. Someone has to recognize that it is architectural, choose when to make it, make it in a way people accept, and keep it where people will find it next year. Each stage can fail on its own, and a decision that was right on the day it was made can still end up ignored, relitigated, or lost.

## Is This Decision Yours?

Developers make many decisions a day that aren't the architect's concern, such as naming, loop constructs, and local refactorings. Michael Nygard, in the 2011 post that introduced architecture decision records, calls a decision architecturally significant when it affects the structure, nonfunctional characteristics, dependencies, interfaces, or construction techniques of a system.

| Affects | Example |
| --- | --- |
| **Structure**: the architecture style or patterns | "We'll use a modular monolith rather than microservices" |
| **Nonfunctional characteristics**: performance, scalability, security, availability | "Checkout must support 100,000 concurrent users with under 100 ms latency" |
| **Dependencies**: coupling points between components, services, or teams | "Services communicate through asynchronous messaging, not direct calls" |
| **Interfaces**: how components are accessed and orchestrated | "All external API traffic goes through the API gateway" |
| **Construction techniques**: platforms, frameworks, tools, and processes that span teams | "All services deploy to the shared Kubernetes platform" |

When in doubt, treat a decision as significant if it affects more than one team, has long-term cost implications, or would be expensive to reverse. Scope also decides who makes the call. A decision local to one team belongs with that team, while one that spans a domain or the enterprise usually sits with architects at that level under the organization's governance model.

## When to Decide

### Decide, Defer, or Delegate

| | When it applies |
| --- | --- |
| **Decide now** | Work is blocked without it, it's easy to reverse, waiting brings no new information, or being wrong is cheap |
| **Defer to the last responsible moment** | Information is coming soon (a proof of concept, a vendor evaluation), the decision is expensive to reverse, or requirements are still moving |
| **Delegate** | The decision is local to one team or component, the team has the expertise, it doesn't affect system-wide characteristics, and the constraints it must respect are already clear |

Mary and Tom Poppendieck, in *Lean Software Development* (2003), define the last responsible moment as the point at which failing to decide eliminates an important alternative. Deferring to it is a decision with a deadline, not a way to avoid deciding. Name that moment and the information you're waiting for.

Without a named deadline, deferral turns into fear. The architect keeps analyzing and gathering data to avoid being accountable for a wrong call, while teams can't move and developers fill the gap with inconsistent local decisions. Mark Richards and Neal Ford call this the Covering Your Assets antipattern. Its signs are teams repeatedly asking whether you've decided yet, the same kind of information gathered more than once, and new factors to analyze that bring no new understanding. Deciding with the developers who will implement the decision helps as much as the deadline does, because they spot problems early, and an unworkable decision gets revised before it is built rather than after.

### Reversibility Sets the Effort

The effort a decision deserves depends on how hard it is to undo. Choosing a database, a cloud provider, or an architecture style is hard to reverse. A library behind a well-designed abstraction, or a pattern that can evolve incrementally, is easy.

Spend analysis on the hard-to-reverse decisions and move quickly on the rest. For a high-stakes decision that's hard to reverse, build a proof of concept before committing. It shows whether the option solves the problem, what it costs in practice, and whether the team has or can get the skills to run it.

### Make the Trade-Offs Explicit

Every option trades one set of benefits for another. Before committing, be able to say what you gain, what you give up, what it costs in money, time, and complexity, what risks it introduces, and which future options it opens or closes. If you can't state what an option gives up, you haven't finished analyzing it.

## Making a Decision Stick

A decision justified only in technical terms, or not justified at all, gets discussed again and again, because nobody remembers why it was made. Six months later someone proposes the approach that was already rejected, the same conversation happens again, and people start to treat decisions as arbitrary and quietly ignore them. Richards and Ford name this the Groundhog Day antipattern.

Give both the technical reason and the business value. "We'll use asynchronous messaging between the order and payment services" invites relitigation. Adding that it cuts order-submission response time from seconds to milliseconds and lets payments continue when the order service is down gives stakeholders a reason to stay with it. Record the alternatives you considered and why you rejected them, because the rejected option is exactly what someone will propose next.

### Architecture Decision Records

An architecture decision record (ADR) is a short document that captures one architecturally significant decision with its context and consequences. Michael Nygard introduced the format in [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions){:target="_blank" rel="noopener noreferrer"} (2011) with five sections.

**Title.** A sequential number and a short phrase, such as "42. Use Asynchronous Messaging Between Order and Payment Services." The number gives a chronological record, and the phrase makes the list scannable.

**Context.** The forces that make the decision necessary: the problem, the constraints, the part of the system affected, and the alternatives considered.

**Decision.** The choice, stated plainly as what the team will do ("We will use asynchronous messaging between the order and payment services"), followed by the justification, technical and business. The why matters more than the how, since the how usually lives in the code.

**Status.** Proposed, accepted, deprecated, or superseded. A superseded ADR links to the one that replaced it, and it is kept rather than deleted, so the record shows what was decided, when, and what came after. Define in advance which decisions an architect can accept alone and which need approval from a senior architect or review board. Common triggers are cost above a threshold, impact on other teams, and security implications.

**Consequences.** The impact, good and bad. For the messaging example, faster response and isolation from payment-service outages come at the cost of more complex error handling, a message broker to operate, and eventual rather than immediate consistency. Writing the costs down is what lets someone later judge whether the trade-off still holds.

Richards and Ford add two sections to Nygard's five. **Compliance** says how adherence will be checked, whether by manual review or by automated fitness functions, such as tests written with [ArchUnit](https://www.archunit.org/){:target="_blank" rel="noopener noreferrer"} for the JVM or [NetArchTest](https://github.com/BenMorris/NetArchTest){:target="_blank" rel="noopener noreferrer"} for .NET that fail the build when code breaks a dependency rule. A decision with no compliance check is closer to a suggestion. **Notes** carries the metadata: author, approver and approval date, last modified date, and links to related, superseding, or superseded ADRs.

## Where Decisions Live

A decision that lives in an email thread, a chat message, or a hallway conversation doesn't exist in practice a few months later. Teams either repeat the work or violate a decision they never saw, and nobody can check compliance. Richards and Ford call this Email-Driven Architecture. Its signs are "I think we decided that, but I can't find it," decisions reconstructed by asking who was in the room, and teams interpreting the same decision differently.

Keep every ADR in one system of record that everyone affected can read and search, with history and links between related decisions. Many teams keep them as Markdown files in the repository they govern, which puts them under version control and next to the code. A wiki or documentation site works too if it keeps history and search. When you announce a decision by email or chat, send a summary and a link to the record rather than the full decision, since a copy in someone's inbox won't change when the decision does.

Number ADRs sequentially, tag them by area (infrastructure, security, data, frontend), and make it easy to list the accepted ones. Then use them. Have new team members read the accepted ADRs during onboarding, cite the relevant ADRs in design reviews, and link compliance checks back to the decisions they enforce.

## Common Pitfalls

- **An ADR for every decision.** A decision that's local, reversible, and affects no other team doesn't need one.
- **Implementation detail in the ADR.** Keep the record to the decision and its justification. Design details belong in code and design documents.
- **No compliance check.** A decision nobody checks drifts out of the codebase unnoticed.
- **No owner.** Each ADR needs someone who answers questions about it and keeps it current.
- **Editing accepted ADRs in place.** When a decision stops making sense, write a new ADR that supersedes it and explains why, so the history survives.

## Key Takeaways

- **Know which decisions are yours.** Structure, nonfunctional characteristics, dependencies, interfaces, and cross-team construction techniques are architecturally significant, and most other decisions aren't.
- **Match timing and effort to reversibility.** Decide easy-to-reverse decisions quickly, defer hard ones to a named last responsible moment, and delegate local ones.
- **Justify decisions in business terms as well as technical ones,** and record the alternatives you rejected.
- **Keep decisions as ADRs in one findable place,** with honest consequences and a way to check compliance, and supersede rather than edit.

Good decision-making isn't about being right every time. It's about deciding at the right moment, recording the reasoning, and replacing decisions openly when the system or the business moves on.
