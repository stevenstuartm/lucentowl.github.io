---
layout: post
title: "Adaptability Over Cleverness: What Makes Code Actually Good"
date: 2025-08-05
tags: [software-design, best-practices, architecture]
description: "Once code is correct and fast enough, what makes it good over time is how cheaply it absorbs change. Cleverness and premature optimization raise that cost, and flexibility pays only where change is likely."
author: steven-stuart
sources:
  - title: "The Elements of Programming Style (Kernighan and Plauger)"
    url: "https://en.wikipedia.org/wiki/The_Elements_of_Programming_Style"
  - title: "Donald Knuth, Structured Programming with go to Statements (ACM Computing Surveys, 1974)"
    url: "https://doi.org/10.1145/356635.356640"
  - title: "Robert C. Martin, The Single Responsibility Principle"
    url: "https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html"
  - title: "David Parnas, On the Criteria To Be Used in Decomposing Systems into Modules (Communications of the ACM, 1972)"
    url: "https://doi.org/10.1145/361598.361623"
---

Systems that stay cheap to change for years aren't the ones built to fit today's requirements perfectly. They're the ones that bend without breaking when requirements shift, technologies evolve, and teams discover what they didn't know upfront. Building for change beats chasing premature perfection.

You will rarely get it right the first time. That's not a failure; it's how software development works. Requirements clarify through building, edge cases emerge through usage, and performance issues surface under real load. Teams that treat first attempts as gospel can spend months polishing solutions to the wrong problem.

Instead, build systems that can evolve. Give yourself room to deliver, learn, and adapt as reality proves what matters and what doesn't. Adaptable code is code where a likely change touches few places, can be made safely by someone other than its author, and shows quickly when it breaks something. Readability and simplicity matter for the same reason, since a change starts with someone understanding the code. Security, operability, and run cost sit with correctness and speed as requirements the code has to meet. Adaptability decides how much it costs to keep meeting all of them as the system changes. Reading code to diagnose an incident or pass an audit is part of that cost too. Code that will never change or be read again, like a one-off migration script, only has to be correct.

## Cleverness and Speed Make Change Expensive

Brian Kernighan and P. J. Plauger's *The Elements of Programming Style* put this in two maxims: "Write clearly – don't be too clever" and "Write clearly – don't sacrifice clarity for efficiency." Both describe the same cost. Clever code packs several decisions into one construct, like one cached value that quietly serves two different policies, such as a pricing rule and a fraud check. To change one of those policies, the next developer has to unpack both and work out which behavior the author intended and which is incidental.

Optimized code carries the same cost in a different form. An optimization usually rests on an assumption about today's workload, such as the data fitting in memory, records arriving sorted, or one query pattern dominating. The code around it comes to depend on that assumption too, so when the workload changes, the change has to reach every place that relied on it. Donald Knuth's 1974 paper "Structured Programming with go to Statements" argued that programmers' attempts at efficiency in noncritical code "have a strong negative impact when debugging and maintenance are considered." It's the same paper that calls premature optimization the root of all evil.

None of this argues against performance. When speed is a requirement, measure where it's needed and put the optimization behind a boundary, so the rest of the system doesn't depend on how it works. The fast path then becomes one more thing that can change in one place. Some optimizations can't hide, because they shape the contract itself, like a bulk API in place of per-item calls, a streaming response in place of a full list, or a denormalized table every report reads. Those belong with the external contracts discussed below and are decided deliberately up front.

## Adaptability Comes From Keeping Change Local

Adaptable code isn't magic. It follows principles that reduce coupling, isolate change, and make breakage obvious.

### Boundaries Keep Each Change in One Place

**Single Responsibility Principle** is about change, not tasks. Robert C. Martin states it as "Each software module should have one and only one reason to change." Whether that module is a microservice owning a bounded context or a class handling a single concern, a shifted requirement lands in the piece responsible for it without cascading edits across the system. At service scale, a wrongly drawn boundary turns into a contract change between teams, which is why service boundaries get the up-front care described below for external contracts.

**Clean interfaces and separation of concerns** apply at both macro and micro levels. Services communicate through contracts, not implementation details. Business logic doesn't know about HTTP; database layers don't make authorization decisions. Abstractions placed where implementations are likely to change let you pivot as understanding evolves without rewriting everything upstream.

**Externalize what changes** by making variable behavior configurable. Environment-specific settings keep the same code deployable to dev, staging, and production. Tunable timeouts, batch sizes, and retry policies let operations adjust the system's behavior without a code change. Each setting is still flexibility with a carrying cost, since it adds combinations to test and can drift between environments, so the questions at the end of this post apply to configuration too. A bad value can also take a system down, so configuration deserves the same validation at startup as any other input.

### Fast Failures and Tests Make Breakage Visible

**Fail fast and loud** surfaces problems immediately. Silent failures cascade into confusing bugs far from their source. Explicit validation at system boundaries, defensive assertions in critical paths, and structured logging create clear signals when something breaks.

**Tests that give you confidence** let you refactor without guessing what you broke. Unit tests verify component behavior. Integration tests catch interface mismatches. End-to-end tests confirm critical workflows still work. Tests only help if they check behavior through a component's public boundary, because a test coupled to internal details becomes one more place every change has to touch.

### Consistency Shows Where a Change Belongs

**Consistent naming and structure** reduce cognitive load. Developers understand the codebase faster when patterns repeat. Services follow the same lifecycle. Features share the same folder layout and the same error-handling convention. When the structure is predictable, a developer can tell where a change belongs and what else it touches before opening a file, which is what lets someone other than the original author make it safely.

Trace one requirement through these habits. Suppose refunds above a threshold now need a manager's approval. If one module owns refunds, the rule lands there and nowhere else. If the same approval rule also governs discounts and credits, it has a reason to change of its own and belongs in an approvals module that refunds call, by the same test. A developer who didn't write that module finds it because every feature follows the same layout, and a test that issues a refund through the module's public interface fails if the approval check is missing. If refund logic were instead copied into three controllers, the same rule means three edits, and a fourth copy nobody remembered keeps approving refunds without a word.

## Flexibility Belongs Where Change Is Likely

The goal isn't maximum flexibility; it's appropriate flexibility. That doesn't contradict the claim that you rarely get it right the first time. You can't predict what a requirement will become, but you can often predict where requirements will move. David Parnas made this the criterion for drawing module boundaries in his 1972 paper "On the Criteria To Be Used in Decomposing Systems into Modules." The designer starts from the design decisions that are difficult or likely to change and gives each module one of them to hide from the others.

### Domain Knowledge and Change History Locate the Seams

Domain knowledge tells you where those decisions are, and version control history checks the guess. Files with high commit churn, or files that keep changing together, show where change has actually landed so far. Read churn carefully. Files that change for many different tickets mark where requirements move, while files that always change together for one ticket mark a boundary drawn in the wrong place. Before the first release there is no history, and domain knowledge alone decides.

A payments system will need to support new payment providers, so the provider belongs behind an interface from the first release. Shape that interface around the domain's operations, like authorize, capture, and refund, rather than around the first vendor's API. Expect that interface to change when the second provider arrives with redirects, asynchronous confirmations, or a single charge step. It still pays for itself, because callers already depend on payment operations the domain owns rather than on one vendor's types, so the reshape is one contract change instead of a hunt for vendor types across the codebase.

An internal admin tool probably won't need a plugin architecture. Decisions that leave the codebase deserve the same up-front care even without a change history. A published API contract, a persisted data format, or an event schema can't be fixed with a refactor later, because changing it means migrating data and coordinating every consumer.

### Contain a Dependency Until Its Shape Is Clear

Inside the codebase, when a guess is wrong and change arrives somewhere you kept simple, the habits above are the fallback. Tests and consistent structure let you add the boundary when the second case actually shows up, for the price of one refactor, instead of maintaining an abstraction for years that nothing used. That price stays low only if the concrete dependency is used from one place. Containing it takes no abstraction layer, just a rule that every call goes through one module or wrapper you own, and that callers never see vendor types or vendor error codes. Make the rule mechanical, such as keeping the vendor package a dependency of that one project, so a hurried direct call fails the build.

What separates this wrapper from a seam isn't the interface keyword. The wrapper offers only the operations today's callers use, while a seam commits to the operations the domain needs from every implementation, and that commitment is the part that goes wrong when you guess. Either way, the later change replaces one file rather than forty call sites. The tiebreaker follows from this. Add the seam up front when change is likely and you know the operations it must support, the way authorize, capture, and refund are known for payments even when each provider's mechanics differ. When change is likely but its shape isn't clear yet, contain the dependency and wait for the second case to show the shape. Before adding a layer of flexibility, check:

- Has this part of the system changed before, or does the domain make change routine, the way new providers are routine for payments?
- If you wait, what would the change cost? When tests cover the code and the change would stay inside one module, adding the boundary later is cheap.
- Who pays for the abstraction in the meantime? Every developer who reads the code pays for each layer of indirection, whether or not the change ever comes.

Perfect code written for yesterday's requirements fails when reality shifts. Over-engineered code taxes every change with layers nobody needed. Adaptable code finds the balance: flexible where change is likely, simple where it isn't.
