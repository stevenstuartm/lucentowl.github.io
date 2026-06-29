---
layout: guide
title: "Architecture Characteristics"
category: Architecture
subcategory: Foundations
description: "How to identify, select, measure, and govern the quality attributes that drive architectural decisions and determine system success."
tags: [architecture, fundamentals, decision-making, performance, scalability, reliability, maintainability]
---

Architecture characteristics define the qualities a system must exhibit to be successful. While functional requirements describe what the system does, architecture characteristics describe how well it does it.

<blockquote class="pull-quote">
<p>Architecture characteristics drive architectural decisions more than functional requirements do.</p>
</blockquote>

## What Qualifies as an Architecture Characteristic?

Not every desirable quality is an architecture characteristic. To qualify, a property must meet three criteria:

**1. Specifies a non-domain consideration**: The characteristic addresses technical or operational concerns rather than business functionality. "Process customer orders" is a functional requirement. "Process 10,000 orders per second" is an architecture characteristic.

**2. Influences structural design**: The characteristic affects how the system is built, not just how features are implemented. Performance requirements might demand caching layers, asynchronous processing, or read replicas. These structural changes distinguish architecture characteristics from simple implementation details.

**3. Critical to success**: The system cannot succeed without this characteristic. "Nice to have" qualities aren't architecture characteristics. If poor performance means users abandon the product, performance is an architecture characteristic. If slightly slower performance is acceptable, it's not critical.

## Categories of Architecture Characteristics

### Operational Characteristics

Operational characteristics describe runtime behaviors:

**Availability** measures the percentage of time the system is accessible and functional. High availability systems require redundancy, failover mechanisms, and careful deployment strategies.

**Continuity** ensures business operations continue during disasters. This relates to disaster recovery planning and backup strategies.

**Performance** addresses response times, throughput, and resource efficiency. Performance-critical systems need careful attention to algorithms, caching, database design, and network usage.

**Recoverability** defines how quickly the system can recover from failures. Recovery time objectives (RTO) and recovery point objectives (RPO) quantify recoverability requirements.

**Reliability** measures the system's ability to function correctly over time. Reliable systems handle errors gracefully, validate inputs, and avoid data corruption.

**Robustness** describes the system's ability to handle unexpected inputs or conditions without crashing.

**Scalability** determines how well the system handles increased load. Vertical scalability means adding more resources to existing machines. Horizontal scalability means adding more machines.

### Structural Characteristics

Structural characteristics describe how easy the system is to change and maintain:

**Configurability** allows behavior changes through configuration rather than code changes. Highly configurable systems adapt to different environments and customer needs without redeployment.

**Extensibility** measures how easily new functionality can be added. Extensible systems have clear extension points and minimize the impact of changes.

**Maintainability** determines how easily developers can understand, debug, and modify the code. Clean architecture, clear documentation, and consistent patterns improve maintainability.

**Portability** describes how easily the system can move between environments, platforms, or cloud providers. Portable systems minimize vendor lock-in.

**Upgradeability** measures how easily the system can adopt new versions of dependencies, frameworks, or infrastructure.

### Cloud-Specific Characteristics

Cloud environments introduce unique considerations:

**On-demand scalability** leverages cloud elasticity to scale resources based on actual load rather than predicted peak capacity.

**On-demand elasticity** allows the system to automatically scale both up and down, minimizing costs during low-demand periods.

**Zone-based availability** distributes the system across availability zones to survive zone-level failures.

**Region-based privacy** ensures data residency requirements are met by restricting data to specific geographic regions.

### Cross-Cutting Characteristics

Cross-cutting characteristics affect multiple aspects of the system:

**Accessibility** ensures the system is usable by people with disabilities.

**Authentication** verifies user identity.

**Authorization** controls what authenticated users can do.

**Legal** compliance ensures the system meets regulatory requirements.

**Privacy** protects user data from unauthorized access and use.

**Security** protects the system from malicious actors and vulnerabilities.

**Supportability** determines how easily support teams can diagnose and resolve issues.

## Selecting Architecture Characteristics

Every characteristic involves trade-offs. You cannot optimize for everything. The key is identifying which characteristics matter most for your specific context.

### The Selection Process

<div class="callout callout--tip">
<p class="callout__title">The Selection Process</p>
<p><strong>1. Start with explicit requirements</strong>: Stakeholders sometimes specify characteristics directly. "The system must support 100,000 concurrent users" makes scalability an explicit requirement.</p>
<p><strong>2. Identify implicit needs</strong>: Often, characteristics remain unstated. A customer-facing e-commerce site implicitly needs high availability and good performance, even if stakeholders don't say so. Domain knowledge reveals these implicit needs.</p>
<p><strong>3. Focus on trade-offs and priorities</strong>: Every characteristic you add constrains architectural choices and increases complexity. A system optimized for extreme scalability might sacrifice simplicity. A system prioritizing security might sacrifice performance.</p>
<p><strong>4. Limit to 3-7 characteristics</strong>: More than seven critical characteristics means you're trying to optimize for too much. Identify the characteristics that truly drive success and accept "good enough" for the rest.</p>
</div>

Think of architecture characteristics as a budget. You have limited resources to allocate. Spending heavily on scalability means less investment in other areas. Choose wisely based on what actually matters for your system.

### Common Pitfalls

**Over-engineering**: Startups don't need Netflix-scale infrastructure. Don't optimize for problems you don't have.

**Under-prioritizing**: Vague goals like "good performance" aren't actionable. Specify measurable targets: "95th percentile response time under 200ms."

**Ignoring trade-offs**: Fast, reliable, cheap: pick two. Acknowledging trade-offs forces honest conversations about priorities.

## Measuring Architecture Characteristics

Measuring characteristics is challenging because they're often vague and subjective. "Good performance" means different things to different people. Converting characteristics into objective, measurable criteria is essential.

### Operational Metrics

**Performance**: Response time, throughput, latency (percentiles matter more than averages)

**Availability**: Uptime percentage, mean time between failures (MTBF), mean time to recovery (MTTR)

**Scalability**: Maximum throughput, concurrent users supported, resource utilization under load

**Reliability**: Error rates, successful transaction percentage, data integrity metrics

### Structural Metrics

**Maintainability**: Cyclomatic complexity (target: <5, acceptable: <10), lines per method, dependency depth

**Extensibility**: Number of extension points, plugin API coverage, customization without core changes

**Testability**: Test coverage percentage, test execution time, ease of creating test fixtures

### Process Metrics

**Deployability**: Deployment frequency, deployment duration, rollback success rate

**Supportability**: Mean time to diagnose issues, resolution time, number of escalations

## Fitness Functions: Automated Governance

*Concept from evolutionary architecture by Neal Ford, Rebecca Parsons, and Patrick Kua*

Fitness functions are automated tests that verify architecture characteristics. Like unit tests verify functional behavior, fitness functions verify architectural integrity.

Fitness functions run as part of the build pipeline, failing builds when architectural constraints are violated. This prevents architectural drift where the system gradually violates its intended characteristics.

### Examples of Fitness Functions

**Performance fitness function**: Automated tests fail if response time exceeds 200ms for critical endpoints. Load testing as part of continuous integration catches performance regressions before they reach production.

**Modularity fitness function**: Tests fail if cyclomatic complexity exceeds 10 or if dependency cycles are detected. Static analysis tools can enforce these constraints automatically.

**Dependency fitness function**: Tests fail if a service calls forbidden dependencies. For example, a presentation layer component should never directly access the database. A fitness function verifies this constraint.

**Security fitness function**: Tests fail if dependencies contain known vulnerabilities. Automated security scanning prevents vulnerable libraries from being deployed.

**Architecture fitness function**: Tests fail if a service violates its architectural quantum boundaries by making synchronous calls to services it shouldn't depend on.

### Implementing Fitness Functions

Start with the most critical characteristics and automate verification where possible:

1. Identify measurable success criteria
2. Write automated tests that verify those criteria
3. Integrate tests into the CI/CD pipeline
4. Set appropriate thresholds that fail builds on violations
5. Review and adjust thresholds as the system evolves

Fitness functions work best when they're fast, reliable, and clear. A fitness function that takes hours to run or produces false positives won't get used. Keep them focused and actionable.

## Balancing Competing Characteristics

Architecture is the art of balancing trade-offs. Understanding common conflicts helps make informed decisions:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Performance vs. Security</h4>
<ul>
<li>Encryption and security checks add latency</li>
<li>Fast systems often sacrifice security controls</li>
<li>Balance: encrypt sensitive data, allow less sensitive operations to run faster</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Scalability vs. Consistency</h4>
<ul>
<li>Strong consistency sacrifices availability during partitions (CAP theorem)</li>
<li>Eventually consistent systems scale better</li>
<li>Balance: choose consistency model based on business requirements</li>
</ul>
</div>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Maintainability vs. Performance</h4>
<ul>
<li>Highly optimized code is harder to understand and modify</li>
<li>Decide where optimization matters</li>
<li>Balance: accept cleaner, slower code elsewhere</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Flexibility vs. Simplicity</h4>
<ul>
<li>Highly configurable systems are more complex</li>
<li>Purpose-built systems are simpler</li>
<li>Balance: add flexibility only where you have clear evidence it's needed</li>
</ul>
</div>
</div>

<blockquote class="pull-quote">
<p>The best architects recognize these conflicts early and facilitate explicit decisions rather than letting implicit trade-offs emerge by accident.</p>
</blockquote>

---

