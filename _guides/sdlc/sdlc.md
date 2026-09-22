---
title: "Software Development Lifecycle (SDLC)"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Fundamentals
description: "The six activities every software project performs, what each one is actually for, how they are traversed differently under sequential, iterative and continuous delivery, and where each phase most often fails."
tags: [fundamentals, requirements, software-design, testing, deployment, maintenance]
---

## What the SDLC Is

The **Software Development Lifecycle (SDLC)** names the activities software passes through between someone wanting it and someone retiring it. Planning, design, development, testing, deployment, and maintenance appear in every project that ships, whether or not anyone writes them on a wall.

Most descriptions get the next part wrong. The SDLC is a list of activities, not a schedule. The six phases below are things a team does, not a sequence of calendar blocks it passes through once. A team running two-week iterations performs all six every two weeks. A team deploying forty times a day performs all six several times before lunch. A team building avionics might perform them once over three years. The activities are the same and the traversal is what differs.

### Why Naming the Phases Helps

An activity nobody has named is an activity nobody owns. Teams that have never articulated a design phase still design, but they do it in the first hour of writing code, individually, without anyone comparing notes. Teams with no maintenance phase still maintain, but they fund it out of whatever slack the feature roadmap leaves, which is none.

Naming the six phases gives a team three things. It gives a shared vocabulary, so "we haven't finished design" means something specific to everyone in the room. It gives a place to attach quality work, so testing and threat modelling have an owner rather than being whatever survives the deadline. And it makes omissions visible, because a phase a team never performs is much easier to notice once it has a name.

### Methodology Is the Traversal, Not the Phases

Methodologies do not change what the activities are. They change the order, the batch size, and how often a team revisits each one.

| Traversal | What it looks like | Consequence |
| --- | --- | --- |
| **Sequential** | Each phase completes once, for the whole system, before the next begins | Learning arrives late, and correcting an early mistake means unwinding everything built on it |
| **Iterative** | All six phases run inside each iteration, over a slice of the system | Learning arrives every iteration, and the cost of a wrong decision is capped at one slice |
| **Continuous** | Phases collapse into a pipeline that individual changes flow through independently | Learning arrives per change, at the cost of needing the automation to make that safe |

The choice between them is mostly a bet about where learning is cheapest. Sequential traversal is defensible when changing your mind late is catastrophic and expensive, as with hardware you have already manufactured or a regulatory submission you have already filed. Iterative traversal is defensible when the requirements are genuinely uncertain and feedback is the only way to resolve them.

---

## Phase 1: Planning and Requirements

The planning phase answers two questions before anyone spends money answering them the expensive way. Should this be built at all, and does the team understand it well enough to build it?

**Requirements work** is the bulk of it. Functional requirements describe what the system must do. **Architectural characteristics**, the qualities the system must exhibit such as performance, scalability, availability and security, constrain how it can be built and matter more to the architecture than most functional requirements do. Requirements gathering fails less often from asking too few questions than from accepting the first answer. Stakeholders describe solutions they have imagined rather than the problems they have, and the requirement that reaches the backlog is a design decision in disguise.

**Feasibility** is the part teams skip. It asks five separate questions, and a project can pass four and still be a bad idea: whether the technology can do it, whether the budget covers it, whether the team has the skills, whether the organization can operate it once built, and whether the schedule is achievable. Operational feasibility is the one most often ignored, because the team that builds a system is frequently not the team that will carry the pager for it.

**Authorization** turns the analysis into a commitment. A project charter names the scope, the success criteria, the budget and the sponsor. Its value is less in the document than in forcing someone with authority to state, in writing, what success would look like, which is much harder to do vaguely than to say vaguely.

<div class="callout callout--warning">
<p class="callout__title">Where planning goes wrong</p>
<ul>
<li>Requirements captured from a proxy rather than from the people who will use the system</li>
<li>Architectural characteristics left unstated, so the architecture optimizes for whatever the first developer assumed</li>
<li>Feasibility treated as a formality after the decision has already been made</li>
<li>A schedule committed before the scope is understood, which fixes the one variable that should have stayed free</li>
</ul>
</div>

---

## Phase 2: Design and Architecture

Design turns requirements into a structure that can be built. It operates at two altitudes, and conflating them is a common source of confusion.

**Architecture** decides the things that are expensive to change later. Which components exist, how they communicate, where state lives, which architectural style fits the characteristics the planning phase identified. These decisions constrain everything downstream, and they are the ones to spend the argument on.

**Detailed design** decides the things that are cheap to change. Module boundaries inside a component, class structures, schema details, error handling. These can and usually should be settled by the people writing the code, close to the point of writing it.

**Security design** belongs here rather than later because the controls that matter most are structural. Trust boundaries, authentication and authorization flows, and what gets encrypted where are architecture decisions, and threat modelling is how you find them before they are load-bearing. Bolting security onto a finished design means accepting whatever attack surface the design already committed to.

The failure specific to this phase is designing for a system nobody asked for. Over-engineering is usually not vanity. It is a rational response to uncertainty, where an architect who does not know which way requirements will move builds for every direction at once. The cure is resolving the uncertainty rather than absorbing it into the design.

<div class="callout callout--warning">
<p class="callout__title">Where design goes wrong</p>
<ul>
<li>Architecture decided without the developers who will implement it, producing a design that is correct and unbuildable</li>
<li>Detailed design specified centrally, which wastes the architect's time and removes the implementer's judgment</li>
<li>Architectural characteristics acknowledged in the requirements and then not traceable to any decision in the design</li>
<li>Designs validated only against stakeholders' approval rather than against the requirements they claim to satisfy</li>
</ul>
</div>

---

## Phase 3: Development and Implementation

Implementation is the phase teams think of as the work, and it is the phase where the surrounding practices matter more than the typing.

**Integration discipline** decides how much pain the team absorbs later. Work that sits unmerged diverges from the shared codebase at a rate proportional to how long it sits, and the merge cost grows faster than linearly. Branching strategy and integration frequency are the levers, and teams that integrate frequently trade a small constant cost for the elimination of an unbounded one.

**Code review** is doing three jobs at once, which is why teams disagree about it. It catches defects, it spreads knowledge about unfamiliar parts of the system, and it enforces consistency. Teams that value only the first job review superficially and conclude review is not worth it. The knowledge-spreading effect is usually the larger of the three, particularly on teams where one person owns each area.

**Automated verification** runs continuously against every change rather than waiting for a testing phase, which is what makes the other two practices affordable.

<div class="callout callout--warning">
<p class="callout__title">Where implementation goes wrong</p>
<ul>
<li>Long-lived branches that make integration an event rather than a habit</li>
<li>Review treated as approval rather than as reading, where the reviewer checks that tests passed</li>
<li>Technical debt taken deliberately and then never recorded, so the loan exists but nobody knows the balance</li>
<li>Documentation written for the code rather than for the decisions, which leaves the reasoning unrecoverable</li>
</ul>
</div>

---

## Phase 4: Testing and Quality Assurance

Testing asks two different questions that are easy to conflate. Verification asks whether the system was built correctly against its specification. Validation asks whether the right system was built at all. A system can pass every test and fail validation completely, which is what happens when the requirements were wrong.

Different test types answer different parts of the first question. **Unit tests** check individual components against their expected behavior and run fast enough to gate every commit. **Integration tests** check that components agree about their contracts, which is where assumptions diverge. **System tests** exercise complete workflows end to end. **Performance tests** check behavior under load, under sustained load, and past the point of expected capacity, which are three different questions with three different failure signatures. **Security testing** applies static analysis, dynamic analysis and dependency scanning, each of which catches a class the others miss.

**User acceptance testing** is the one that answers the validation question, and it only works when real users perform real tasks. UAT run by a business analyst following a script validates the script.

A coverage number tells you which code has never been executed by a test, which is genuinely useful. It does not tell you whether the tests are any good. Martin Fowler's position on [test coverage](https://martinfowler.com/bliki/TestCoverage.html){:target="_blank" rel="noopener noreferrer"} is the sound one, that coverage is a tool for finding untested areas rather than a number to hit. A team that tests thoughtfully tends to end up with high coverage as a side effect, and a team given a coverage target tends to end up with tests that execute code without asserting anything about it.

<div class="callout callout--warning">
<p class="callout__title">Where testing goes wrong</p>
<ul>
<li>Only the paths the developer imagined get tested, so the system is robust against expected input and fragile against everything else</li>
<li>Test data that shares none of production's shape, volume or messiness</li>
<li>Coverage adopted as a target, which reliably produces tests that run code without checking it</li>
<li>UAT performed by people who already know how the system is supposed to behave</li>
</ul>
</div>

---

## Phase 5: Deployment and Release

Deployment is the phase where the gap between "it works" and "it works in production" gets paid for. Two things distinguish teams that deploy calmly from teams that deploy on weekends.

The first is that **deployment is rehearsed rather than performed**. A staging environment that resembles production, a deployment path exercised often enough to be boring, and a rollback tested before it is needed. A rollback procedure that has never been run is a hypothesis.

The second is that **release is separated from deployment**. Shipping code to production and exposing a feature to users are different acts, and feature flags let a team do the first without the second. Once they are separate, the deployment stops being the risky moment, and a release becomes reversible without redeploying anything.

How traffic moves to the new version is a choice between several strategies with different risk and cost profiles, from deploying to everyone at once through to routing a small percentage and watching before proceeding. Which one fits depends on how much a failure costs and how quickly it would be visible.

**Post-deployment validation** is part of the deployment, not a separate activity. A deployment is not finished when the process exits successfully. It is finished when someone has confirmed the system is behaving, which means error rates, latency and the business metric the change was supposed to move.

<div class="callout callout--warning">
<p class="callout__title">Where deployment goes wrong</p>
<ul>
<li>Manual steps in the deployment path, which fail differently every time and cannot be rehearsed</li>
<li>A rollback plan that exists on paper and has never been executed</li>
<li>Release coupled to deployment, so the only way to withdraw a feature is to redeploy</li>
<li>Success measured by the deployment completing rather than by the system behaving afterwards</li>
</ul>
</div>

---

## Phase 6: Maintenance and Operations

Most of a system's life is spent here, and most of its total cost is incurred here. Treating maintenance as the phase after the project is what produces systems that become unmaintainable within a few years.

**Operations** is the continuous part. Monitoring that answers whether the system is healthy, alerting that fires on conditions a human should act on, and incident response that restores service first and explains second. The organizational half matters as much as the tooling, because a team that cannot investigate an incident without assigning blame will not learn from it.

**Evolution** is the discretionary part, and it competes for the same capacity. Bug fixes, enhancements, performance work and dependency upgrades all draw on the team that is also being asked for new features. The competition is usually resolved implicitly in favor of features, which is how maintenance backlogs form.

**Technical debt** is the part that compounds. Debt taken knowingly, recorded, and repaid is a financing decision. Debt taken unknowingly is just decay. The practical difference is whether anyone can name what the system's current shape is costing.

**Dependency currency** deserves separate mention because it degrades without anyone touching the system. A dependency that was current at launch accumulates known vulnerabilities on a schedule set by other people, and the cost of upgrading grows with the number of versions skipped. Teams that upgrade continuously pay a small recurring cost. Teams that upgrade when forced pay a migration.

**End of life** is a phase in its own right that most teams never plan. Systems are retired, data has to go somewhere, users need notice, and infrastructure keeps billing until someone turns it off.

<div class="callout callout--warning">
<p class="callout__title">Where maintenance goes wrong</p>
<ul>
<li>Maintenance funded from whatever slack the feature roadmap leaves, which is structurally zero</li>
<li>Monitoring that reports whether servers are up rather than whether users are being served</li>
<li>Incidents resolved without anyone asking what made the failure possible</li>
<li>Dependencies left until a vulnerability forces an upgrade across many skipped versions at once</li>
</ul>
</div>

---

## What Holds Across All Six Phases

A few principles apply regardless of which phase a team is in and which methodology it uses to get there.

**Understand before building.** The cost of correcting a misunderstanding grows with the amount of work built on top of it. This is an argument for resolving uncertainty early, not for resolving all uncertainty before starting, which is a different and usually unaffordable claim.

**Build quality in rather than inspecting it in.** Quality that depends on a phase at the end is quality that gets cut when the schedule slips. Quality built into how the work is done survives the schedule.

**Automate the repeated work.** Anything performed identically more than a few times is a candidate, and the argument is consistency rather than speed. An automated process fails the same way every time, which makes it debuggable.

**Close the loop.** Each phase should produce information that improves the next pass through it. A team that never compares its estimates to its actuals, or its incidents to its designs, performs the six phases without ever getting better at them.
