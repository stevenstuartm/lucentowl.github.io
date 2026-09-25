---
layout: guide
title: "Architecture Characteristics"
category: Architecture
subcategory: Foundations
description: "How to recognize, find, select, and measure the architecture characteristics that drive structural decisions, why they are scoped per architecture quantum, and how fitness functions keep a system from drifting away from them."
tags: [fundamentals, quality-attributes, fitness-functions, evolutionary-architecture, trade-offs, architecture-quantum]
---

Architecture characteristics define the qualities a system must exhibit to be successful. Functional requirements describe what the system does. Architecture characteristics describe how well it does it: how fast, how available, how easy to change.

<blockquote class="pull-quote">
<p>Every characteristic you add constrains the design, so a short, prioritized list beats a long wish list.</p>
</blockquote>

## Telling a Characteristic From a Requirement

Not every desirable quality belongs on the architecture's list. A quality earns a place when getting it wrong would force a change to the system's structure and would cost the business something it can't absorb.

Take order processing. "Process customer orders" is a functional requirement. It says what the system does, and almost any structure can do it. "Process 10,000 orders per second" is a characteristic, because meeting it might take caching, asynchronous processing, or read replicas, and those are structural decisions made before the first order flows through. It still earns its place only if falling short matters. If slow checkout makes customers abandon their carts, performance is architectural. If somewhat slower responses are acceptable, performance stays a design concern that individual features handle.

## Where to Look for Them

Runtime qualities come up unprompted: how fast the system responds, how available it stays, how far it scales, and how it recovers from failure. They usually demand structural responses such as redundancy, failover, caching, or horizontal scaling.

Two kinds are easier to miss. Qualities of change describe how easily the system can be deployed, tested, extended, and upgraded, and they shape how the code is divided and how its parts depend on each other. Qualities that span the whole system, such as security, privacy, legal compliance, accessibility, and supportability, belong to no single component, so nobody owns them unless someone puts them on the list. Running on a cloud platform adds a few of its own, such as elasticity and constraints on where data may be stored or replicated.

## Characteristics Are Scoped to an Architecture Quantum

Characteristics don't have to apply uniformly to a whole system. An architecture quantum, in the definition Neal Ford, Mark Richards, Pramod Sadalage, and Zhamak Dehghani give in *Software Architecture: The Hard Parts*, is an independently deployable part of a system with high functional cohesion, and each quantum can have its own set of characteristics. A checkout quantum might need high availability and elastic scalability, while a monthly reporting quantum needs neither.

This scope has structural consequences. If two parts of a system need genuinely different characteristics, they are hard to keep in a single deployable unit, because that unit has to meet the stricter set everywhere. Differing characteristics are one of the strongest signals that a system should be split into separate quanta. A single set that suffices for everything is a signal that it may not need to be.

{% include figure.html id="arch-quantum-characteristics" %}

## Selecting Architecture Characteristics

You cannot optimize for everything, so selection is about priority rather than completeness.

**Start with explicit requirements.** Stakeholders sometimes state characteristics directly. "The system must support 100,000 concurrent users" makes scalability explicit.

**Identify implicit needs.** Many characteristics go unstated. A customer-facing e-commerce site needs availability and responsive performance even if no one writes it down, and it takes domain knowledge to surface these.

**Weigh the trade-offs.** Every characteristic you add constrains architectural choices and adds complexity. A system optimized for extreme scalability tends to give up simplicity, and a system hardened for security tends to give up some performance.

**Keep the list short and ranked.** Richards and Ford's architecture characteristics worksheet asks for no more than seven candidate characteristics, then for the top three among them. The top three drive the architecture style. The rest get "good enough" treatment rather than equal investment.

### Common Pitfalls

**Over-engineering**: A startup rarely needs infrastructure built for Netflix-scale traffic. Optimizing for problems the system doesn't have spends the budget that the characteristics it does have need.

**Vague targets**: "Good performance" isn't actionable. "95th percentile response time under 200 ms for checkout" is.

**Ignoring trade-offs**: Treating every characteristic as top priority avoids the conversation about which ones lose. That conversation happens anyway, later and under pressure, when the architecture can't deliver all of them.

## Measuring Architecture Characteristics

Characteristics start vague and subjective, because "good performance" means different things to different people. Each critical characteristic needs at least one metric that turns it into a target a build or a review can pass or fail.

Runtime qualities map to measures such as percentile latency, uptime, and error rate. Percentiles matter more than averages, because an average hides the slow requests users actually notice. Qualities of change map to measures of the code, such as cyclomatic complexity and dependency depth, and of delivery, such as deployment frequency. Supportability maps to measures like the time it takes to diagnose an issue.

## Fitness Functions

*Concept from Neal Ford, Rebecca Parsons, and Patrick Kua, Building Evolutionary Architectures (2017)*

A fitness function is any mechanism that gives an objective assessment of whether the system still delivers an architecture characteristic. Unit tests protect functional behavior. Fitness functions protect architectural integrity, and they prevent drift, where a system gradually stops delivering the characteristics it was designed for.

Most fitness functions are automated checks that run in the build pipeline and fail the build on a violation, but they don't have to be. A production monitor that alerts when latency crosses a threshold is a fitness function, and so is a periodic manual review for a characteristic that resists automation, such as legal compliance.

### Examples of Fitness Functions

**Performance**: A load test in the pipeline fails the build if critical endpoints exceed their response time target, catching regressions before production.

**Modularity**: Static analysis fails the build if cyclomatic complexity exceeds an agreed limit or if dependency cycles appear.

**Layering**: An architecture test fails if a presentation-layer component accesses the database directly.

**Security**: Dependency scanning fails the build if a library has a known vulnerability.

**Quantum boundaries**: An architecture test fails if a service makes synchronous calls to a service outside its quantum.

### Implementing Fitness Functions

Start with the most critical characteristics:

1. Define a measurable success criterion for the characteristic
2. Write a check that evaluates it objectively
3. Run the check where it gives the fastest useful feedback, usually the CI/CD pipeline
4. Set a threshold that fails the build or raises an alert on violation
5. Review thresholds as the system evolves

Fitness functions only protect a characteristic if teams trust them. One that takes hours to run or produces false positives gets disabled, so keep each one fast, reliable, and focused on one characteristic.

## Balancing Competing Characteristics

Some characteristics conflict so often that the conflict is predictable.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Performance vs. Security</h4>
<ul>
<li>Encryption and security checks add latency</li>
<li>Fast systems often skimp on security controls</li>
<li>Balance: protect sensitive data and operations fully, and let less sensitive paths run leaner</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Scalability vs. Consistency</h4>
<ul>
<li>Strong consistency gives up availability during network partitions (the CAP theorem)</li>
<li>Eventually consistent systems scale more easily</li>
<li>Balance: choose the consistency model per workflow based on business requirements</li>
</ul>
</div>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Maintainability vs. Performance</h4>
<ul>
<li>Highly optimized code is harder to understand and modify</li>
<li>Most code isn't on a hot path</li>
<li>Balance: optimize where measurement shows it matters, and keep the rest clear</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Flexibility vs. Simplicity</h4>
<ul>
<li>Highly configurable systems are more complex</li>
<li>Purpose-built systems are simpler</li>
<li>Balance: add flexibility only where there is clear evidence it's needed</li>
</ul>
</div>
</div>

<blockquote class="pull-quote">
<p>Recognize these conflicts early and make the decision explicit, rather than letting an implicit trade-off emerge by accident.</p>
</blockquote>
