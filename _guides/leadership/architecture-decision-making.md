---
layout: guide
title: "Architecture Decision-Making"
category: Leadership & Team Management
subcategory: Engineering Leadership
description: "How an architect decides which decisions are architecturally significant, when to make, defer, or delegate them, how to avoid the Covering Your Assets, Groundhog Day, and Email-Driven Architecture antipatterns, and how to record decisions in ADRs so they hold."
tags: [practical, decision-making, adrs, architectural-significance, last-responsible-moment, reversibility]
---

Making architecture decisions heads the list of what's expected of an architect, and most of the other expectations, such as analysis, keeping current, and ensuring compliance, exist to make those decisions better or make them stick. Good decisions aren't enough on their own. An architect also has to know which decisions are theirs, when to make each one, and how to record it so it stays in force after the meeting ends.

## Decision-Making Antipatterns

Richards and Ford's *Fundamentals of Software Architecture* names three antipatterns that follow one another. Overcoming the first tends to lead into the second, and overcoming the second into the third.

### Covering Your Assets

The architect avoids or defers decisions out of fear of being wrong, analyzing endlessly and gathering more data to put off accountability. Meanwhile teams can't move, developers make inconsistent local decisions to fill the gap, and opportunities close.

Two habits overcome it. First, **decide at the last responsible moment**, which is the point where the cost of waiting starts to exceed the value of the information you'd gain by waiting. If the decision blocks work and waiting won't improve it, decide now. Second, **collaborate with the developers** who will implement the decision. They spot problems you missed, and a decision that turns out to be unworkable in implementation gets revised early instead of discovered late.

The signs are teams repeatedly asking whether you've decided yet, gathering the same kind of information more than once, and new factors to analyze that bring no new understanding.

### Groundhog Day

Decisions get discussed again and again because nobody knows why they were made. Six months later someone proposes the approach that was already rejected, and the same conversation happens again. People start to see decisions as arbitrary, and eventually they get quietly ignored.

The cause is usually a decision justified only in technical terms, or not justified at all. Give both the technical reason and the business value. "We'll use asynchronous messaging between the order and payment services" invites relitigation. Adding that it cuts order-submission response time from seconds to milliseconds and lets payments continue when the order service is down gives stakeholders a reason to stay with it. Record the alternatives you considered and why you rejected them, because the rejected option is exactly what someone will propose next.

The signs are proposals resurfacing every few months, new team members unaware a decision exists, and you explaining the same reasoning to different people.

### Email-Driven Architecture

Decisions are made and communicated in email threads, chat, or hallway conversations, and months later nobody can find them. A decision nobody can find doesn't exist in practice. Teams either repeat the work or violate a decision they never saw, and compliance can't be checked.

Keep every decision in a single system of record. When you announce a decision by email or chat, give the nature of the decision and a link to the record, not the full decision. A copy in someone's inbox won't be updated when the decision changes.

The signs are "I think we decided that, but I can't find it," decisions reconstructed by asking who was in the room, and teams interpreting the same decision differently.

## What Makes a Decision Architecturally Significant

Developers make many decisions a day that aren't the architect's concern, such as naming, loop constructs, and local refactorings. Michael Nygard's definition, as used in *Fundamentals of Software Architecture*, treats a decision as architecturally significant when it affects one of five things.

| Affects | Example |
| --- | --- |
| **Structure**: the architecture style or patterns | "We'll use a modular monolith rather than microservices" |
| **Architectural characteristics**: performance, scalability, security, availability | "Checkout must support 100,000 concurrent users with under 100 ms latency" |
| **Dependencies**: coupling points between components, services, or teams | "Services communicate through asynchronous messaging, not direct calls" |
| **Interfaces**: how components are accessed and orchestrated | "All external API traffic goes through the API gateway" |
| **Construction techniques**: platforms, frameworks, tools, and processes that span teams | "All services deploy to the shared Kubernetes platform" |

When in doubt, treat a decision as significant if it affects more than one team, has long-term cost implications, or would be expensive to reverse. Scope also decides who makes the call. A decision local to one team belongs with that team, while one that spans a domain or the enterprise usually sits with architects at that level under the organization's governance model.

## Deciding When and How

### Decide, Defer, or Delegate

| | When it applies |
| --- | --- |
| **Decide now** | Work is blocked without it, it's easy to reverse, waiting brings no new information, or being wrong is cheap |
| **Defer to the last responsible moment** | Information is coming soon (a proof of concept, a vendor evaluation), the decision is expensive to reverse, or requirements are still moving |
| **Delegate** | The decision is local to one team or component, the team has the expertise, it doesn't affect system-wide characteristics, and the constraints it must respect are already clear |

Deferring is a decision with a deadline, not a way to avoid deciding. Name the moment the decision becomes responsible to make and what information you're waiting for, or deferral turns into Covering Your Assets.

### Reversibility Sets the Effort

The effort a decision deserves depends on how hard it is to undo. Choosing a database, a cloud provider, or an architecture style is hard to reverse. A library behind a well-designed abstraction, or a pattern that can evolve incrementally, is easy.

Spend analysis on the hard-to-reverse decisions and move quickly on the rest. For a high-stakes decision that's hard to reverse, build a proof of concept before committing. It shows whether the option solves the problem, what it costs in practice, and whether the team has or can get the skills to run it.

### Make the Trade-Offs Explicit

Every option trades one set of benefits for another. Before committing, be able to say what you gain, what you give up, what it costs in money, time, and complexity, what risks it introduces, and which future options it opens or closes. If you can't state what an option gives up, you haven't finished analyzing it.

## Architecture Decision Records

An architecture decision record (ADR) is a short document that captures one architecturally significant decision with its context and consequences. Michael Nygard introduced the format in [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions){:target="_blank" rel="noopener noreferrer"} (2011) with five sections: title, context, decision, status, and consequences. *Fundamentals of Software Architecture* extends it with compliance and notes sections, which is the structure below.

### ADR Sections

**Title.** A sequential number and a short phrase, such as "42. Use Asynchronous Messaging Between Order and Payment Services." The number gives a chronological record, and the phrase makes the list scannable.

**Status.** Where the decision stands.

| Status | Meaning |
| --- | --- |
| **Proposed** | Awaiting approval |
| **RFC** | Open for comments until a stated deadline |
| **Accepted** | Approved and in effect |
| **Superseded** | Replaced by a later ADR, which it links to |
| **Deprecated** | No longer in effect, with no replacement (from Nygard's original set) |

Superseded ADRs are kept, not deleted, so the record shows what was decided, when, and what replaced it. Define in advance which decisions an architect can accept alone and which need approval from a senior architect or review board. Common triggers are cost above a threshold, impact on other teams, and security implications.

**Context.** The forces that make the decision necessary: the problem, the constraints, the part of the system affected, and the alternatives considered.

**Decision.** The choice, in affirmative, commanding voice ("We will use asynchronous messaging between the order and payment services"), followed by the justification. The why matters more than the how, since the how usually lives in the code.

**Consequences.** The impact, good and bad. For the messaging example, faster response and isolation from payment-service outages come at the cost of more complex error handling, a message broker to operate, and eventual rather than immediate consistency. Writing the costs down is what lets someone later judge whether the trade-off still holds.

**Compliance.** How adherence will be checked, whether by manual review or by automated fitness functions, such as tests written with [ArchUnit](https://www.archunit.org/){:target="_blank" rel="noopener noreferrer"} for the JVM or [NetArchTest](https://github.com/BenMorris/NetArchTest){:target="_blank" rel="noopener noreferrer"} for .NET that fail the build when code breaks a dependency rule. A decision with no compliance check is closer to a suggestion.

**Notes.** Metadata: author, approval date and approver, last modified date, and links to related, superseding, or superseded ADRs.

### Storing and Using ADRs

Keep ADRs in one system of record that everyone affected can read and search, with history and links between related decisions. Many teams keep them as Markdown files in the repository they govern, which puts them under version control and next to the code. A wiki or documentation site works too if it keeps history and search.

Number them sequentially, tag them by area (infrastructure, security, data, frontend), and make it easy to list the accepted ones. Then use them. Have new team members read the accepted ADRs during onboarding, cite the relevant ADRs in design reviews, and link compliance checks back to the decisions they enforce.

## Common Pitfalls

- **An ADR for every decision.** A decision that's local, reversible, and affects no other team doesn't need one.
- **Implementation detail in the ADR.** Keep the record to the decision and its justification. Design details belong in code and design documents.
- **No compliance section.** A decision nobody checks drifts out of the codebase unnoticed.
- **No owner.** Each ADR needs someone who answers questions about it and keeps it current.
- **Editing accepted ADRs in place.** When a decision stops making sense, write a new ADR that supersedes it and explains why, so the history survives.

## Key Takeaways

- **Watch for the antipattern sequence.** Fear leads to Covering Your Assets, missing justification leads to Groundhog Day, and missing records lead to Email-Driven Architecture.
- **Know which decisions are yours.** Structure, characteristics, dependencies, interfaces, and cross-team construction techniques are architecturally significant, and most other decisions aren't.
- **Match timing and effort to reversibility.** Decide easy-to-reverse decisions quickly, defer hard ones to a named last responsible moment, and delegate local ones.
- **Record decisions as ADRs.** Include context, business and technical justification, honest consequences, and a way to check compliance, and supersede rather than edit.

Good decision-making isn't about being right every time. It's about deciding at the right moment, recording the reasoning, and replacing decisions openly when the system or the business moves on.
