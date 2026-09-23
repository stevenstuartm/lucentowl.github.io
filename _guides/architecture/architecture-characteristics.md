---
layout: guide
title: "Architecture Characteristics"
category: Architecture
subcategory: Foundations
description: "How to recognize, categorize, select, and measure the architecture characteristics that drive structural decisions, why they are scoped per architecture quantum, and how fitness functions keep a system from drifting away from them."
tags: [fundamentals, quality-attributes, fitness-functions, evolutionary-architecture, trade-offs, architecture-quantum]
---

Architecture characteristics define the qualities a system must exhibit to be successful. Functional requirements describe what the system does. Architecture characteristics describe how well it does it: how fast, how available, how easy to change.

<blockquote class="pull-quote">
<p>Every characteristic you add constrains the design, so a short, prioritized list beats a long wish list.</p>
</blockquote>

## What Qualifies as an Architecture Characteristic

Not every desirable quality is an architecture characteristic. To qualify, a property must meet three criteria.

**1. It specifies a non-domain consideration.** It addresses how the system operates rather than what the business does. "Process customer orders" is a functional requirement. "Process 10,000 orders per second" is an architecture characteristic.

**2. It influences structural design.** It changes how the system is built, not just how a feature is implemented. A demanding performance target might require caching layers, asynchronous processing, or read replicas, and that structural consequence is what separates a characteristic from an implementation detail.

**3. It is critical or important to success.** If poor performance means users abandon the product, performance is an architecture characteristic. If somewhat slower responses are acceptable, performance stays a design concern rather than an architectural one.

## Categories of Architecture Characteristics

Characteristics fall into four broad categories. The category matters less than the reminder it gives to look past the runtime qualities everyone thinks of first.

**Operational characteristics** describe runtime behavior: availability, continuity, performance, recoverability, reliability, robustness, and scalability. They usually demand structural responses such as redundancy, failover, caching, or horizontal scaling.

**Structural characteristics** describe how easy the system is to change and maintain: configurability, deployability, extensibility, maintainability, portability, testability, and upgradeability. They shape how code is partitioned and how components depend on each other.

**Cloud-specific characteristics** arise when the platform can change shape at runtime: on-demand scalability and elasticity, zone-based availability, and region-based privacy.

**Cross-cutting characteristics** span the whole system rather than one part of it: accessibility, authentication, authorization, legal compliance, privacy, security, and supportability.

## Characteristics Are Scoped to an Architecture Quantum

Characteristics don't have to apply uniformly to a whole system. An architecture quantum is an independently deployable part of a system with high functional cohesion, and each quantum can have its own set of characteristics. A checkout quantum might need high availability and elastic scalability, while a monthly reporting quantum needs neither.

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

Operational characteristics map to runtime measures such as percentile latency, uptime, and error rate. Percentiles matter more than averages, because an average hides the slow requests users actually notice. Structural characteristics map to code measures such as cyclomatic complexity and dependency depth. Characteristics tied to delivery and support, such as deployability and supportability, map to measures like deployment frequency and time to diagnose an issue.

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
