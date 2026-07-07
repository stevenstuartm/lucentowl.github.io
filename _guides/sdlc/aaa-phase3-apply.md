---
title: "AAA Cycle: Phase 3 - Apply the Plan and Deliver"
layout: guide
category: Software Development Lifecycle
subcategory: AAA Cycle
description: "Execute with discipline while maintaining alignment."
author: steven-stuart
tags: [sdlc, aaa-cycle, implementation, delivery, governance, practical]
---

## Phase Overview

### Purpose

**Execute the agreed plan with discipline while maintaining continuous alignment.** This is sustained execution with governance, quality assurance, stakeholder communication, and value delivery.

### The Universal Pattern

Regardless of project size or methodology, application follows these steps:

1. **Implement incrementally**: Build in small batches
2. **Maintain quality**: Test continuously, don't compromise
3. **Govern architecture**: Ensure integrity through reviews
4. **Keep stakeholders aligned**: Regular communication and demos
5. **Deploy reliably**: Automate and practice
6. **Reflect and improve**: Learn from experience

### Entry & Exit

**You start with**: Approved architecture and implementation plan from Phase 2

**You deliver**: Working software in production that meets business objectives

---

## The Core Value: Honoring the Agreement While Learning

The discipline of Apply is knowing when to:
- **Continue**: Discovery confirms the approach; keep executing
- **Adapt**: Minor adjustments within the agreed scope and architecture
- **Pause and Realign**: Discovery invalidates core assumptions; cycle back to Align or Agree

### When to Pause vs. Adapt

| Pause and Realign | Adapt and Continue |
|-------------------|-------------------|
| Technical discovery: Assumed approach won't work | Minor technical adjustments within the architecture |
| Scope discovery: Original scope misunderstood | Small scope clarifications that don't change core agreement |
| Dependency discovery: Critical dependencies emerge | Implementation details that don't affect stakeholders |
| Value discovery: Better problem to solve revealed | Performance optimizations within agreed SLOs |

**How to handle discovery**:
1. Document what you learned (what assumption broke, what's now understood)
2. Assess impact (timeline, cost, scope, quality, risk)
3. Present options to stakeholders (continue as-is, adapt, or realign)
4. If realignment needed, cycle back to Align or Agree phases
5. Update the agreement and communicate changes

---

## Circuit Breakers

The guidance above describes *how* to handle discovery, but *when* to trigger reassessment can remain vague. Circuit breakers make the decision explicit by defining specific boundaries that, when crossed, force a pause and reassessment.

**Temporal circuit breakers** are feature-specific time limits set during Agree. A simple CRUD screen might have a 3-day limit while a complex integration might have a 6-week limit. When the time limit is reached, you stop and reassess rather than pushing through.

**Assumption circuit breakers** trigger when critical assumptions identified during Agree prove invalid. During shaping, you document assumptions like "the third-party API supports bulk operations" or "the existing database schema can handle this query pattern." If implementation proves an assumption wrong, the circuit breaker trips.

**When a circuit breaker trips**:
- **Extend with explicit agreement**: If work is close to done and stakeholders agree
- **Reduce scope**: Cut features to fit within the boundary
- **Reshape**: Return the work to Agree for reshaping
- **Drop**: If work proved unviable, stop rather than continuing to invest

For more on circuit breakers, see [Shaped Kanban](/blog/2025/11/17/shaped-kanban.html){:target="_blank" rel="noopener noreferrer"}.

---

## Managing External Dependencies

### When Dependencies Fail

External dependencies are a primary source of discovery during Apply. Other teams miss commitments, third-party services don't work as documented, and vendors encounter delays.

**Types of dependency failures**:
- **Delay**: External team pushes their delivery date
- **Capability gap**: Delivered dependency doesn't meet your needs
- **Quality issues**: Dependency works but has bugs or performance problems
- **Complete failure**: Dependency won't be delivered at all

### Dependency Management

**Track dependencies proactively**:
- Maintain a dependency register with: owner, expected delivery, confidence level, fallback plan
- Schedule regular check-ins with dependency owners
- Don't rely on status reports alone

**When a dependency fails**:
1. **Assess the impact**: How does this affect your timeline, scope, and quality?
2. **Identify options**: Wait, work around, de-scope, build it yourself, or escalate
3. **Present options to stakeholders**: Don't just report the problem; present choices with trade-offs
4. **Update the agreement**: If response changes scope, timeline, or cost, cycle back to Align or Agree

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>No fallback plans</strong>: Critical dependencies without contingencies</li>
<li><strong>Passive monitoring</strong>: Waiting for dependency owners to report problems</li>
<li><strong>Hope as strategy</strong>: "They'll probably make it" without evidence</li>
</ul>
</div>

---

## Scope Negotiation

### Scope Negotiation Framework

1. **Quantify the gap**: How much are we short? (days, story points, effort)
2. **Present options, not problems**: Reduce scope, extend timeline, add resources, or accept quality risk
3. **Recommend an option**: Don't just present choices; provide your recommendation with reasoning
4. **Make trade-offs explicit**: "If we cut feature X, we lose capability Y"
5. **Get explicit agreement**: Document the decision

### Negotiation Principles

**Lead with impact, not excuses**:
- ❌ "We underestimated the complexity"
- ✅ "The integration revealed requirements we didn't anticipate. Here are our options."

**Protect quality last**: Quality is the easiest thing to sacrifice and the hardest thing to recover. Quantify the risk when stakeholders push to "just get it done."

**Negotiate early**: A 10% scope reduction in week 2 is easier than a 30% scope reduction in week 8.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>Presenting problems without options</strong></li>
<li><strong>Silent scope creep</strong>: Accepting additions without negotiating</li>
<li><strong>Sacrificing quality first</strong>: "We'll skip testing to make the date"</li>
<li><strong>Late negotiation</strong>: Raising scope issues the week before delivery</li>
</ul>
</div>

---

## Core Activities

### 1. Implementation & Architecture Governance

**Build incrementally while maintaining architectural integrity.**

**Implementation Approach**:
- Work in small, releasable increments
- Continuously integrate and test changes
- Gather feedback early and often

**CI/CD as Agreement Verification**:

At the implementation level, CI/CD pipelines operationalize the AAA discipline. Every commit triggers verification that technical agreements are being honored:

- **Tests verify agreements**: Unit tests encode component behavior agreements. Integration tests encode contracts between components. When tests fail, an agreement was broken.
- **Code reviews verify alignment**: PR reviews confirm that the implementation matches shared understanding of intent.
- **Security and quality gates verify standards**: Pipeline gates enforce the quality and security agreements established during Phase 2.

See [CI/CD and Technical Agreement](/study-guides/sdlc/cicd.html#cicd-and-technical-agreement) for detailed guidance on how AAA operates at the code level.

**Architecture Governance**:
- **Architecture Decision Records (ADRs)**: Document significant decisions as they're made
- **Architecture Reviews**: Weekly or bi-weekly review of significant changes
- **Code Reviews**: Review for architectural conformance, not just correctness
- **Tech Stack Governance**: Evaluate new libraries/frameworks before adoption

See [Governance](/study-guides/architecture/governance.html){:target="_blank" rel="noopener noreferrer"} for detailed guidance.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>Architecture astronauts</strong>: Over-governing, creating bottlenecks</li>
<li><strong>No governance</strong>: Inconsistent implementation, architectural drift</li>
<li><strong>Ignoring technical debt</strong>: Until it's unmanageable</li>
</ul>
</div>

---

### 2. Continuous Stakeholder Alignment

**Maintain alignment throughout implementation as discovery happens.**

**Regular Touchpoints**:
- **Sprint/Iteration Reviews**: Demo working software, gather feedback
- **Stakeholder Updates**: Progress, blockers, risks, budget, timeline
- **Retrospectives**: Reflect on what went well, identify improvements

### Progress Tracking: Hill Charts Over Percent Complete

Traditional progress tracking ("we're 80% done") hides more than it reveals. Teams can be "80% done" for weeks because they're stuck on the hard part.

**Hill charts** provide more honest visibility by distinguishing two phases:

**Uphill (figuring it out)**: The team is still discovering unknowns, solving novel problems. Progress feels slow because you're learning, not just executing.

**Downhill (making it happen)**: The unknowns are resolved. The team knows what to build and is executing.

This distinction matters for stakeholder communication:
- "We're uphill on the integration" signals uncertainty
- "We're downhill on the UI" signals confidence

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>Communication vacuum</strong>: No updates until the end</li>
<li><strong>Hiding problems</strong>: Not escalating risks/issues early</li>
<li><strong>Stakeholders surprised at delivery</strong>: Lost alignment during execution</li>
</ul>
</div>

---

### 3. Quality Assurance

**Ensure quality through continuous testing and validation.**

**Testing Activities**:
- Test-driven development: Write tests with code
- Automated testing: Unit, integration, E2E tests in CI pipeline
- Security testing: SAST, DAST, dependency scanning, penetration testing
- Performance testing: Load testing, stress testing, SLO validation

See [Security Testing](/study-guides/security/security-testing.html){:target="_blank" rel="noopener noreferrer"} for detailed guidance.

**Quality Gates**:
- **Pre-merge**: Tests pass, review approved
- **Pre-release**: All acceptance criteria met, no critical bugs, security scan clean
- **Pre-production**: UAT passed, performance validated, rollback plan tested

<div class="callout callout--tip">
<p class="callout__title">Ready for Release</p>
<ul>
<li>All acceptance criteria met</li>
<li>Test coverage targets achieved</li>
<li>No critical/high-severity bugs</li>
<li>Security scan passed</li>
<li>Performance meets SLOs</li>
<li>UAT completed and approved</li>
</ul>
</div>

---

### 4. Deployment & Operations

**Deploy reliably and transition operations smoothly.**

For detailed deployment guidance, see:
- [CI/CD](/study-guides/sdlc/cicd.html){:target="_blank" rel="noopener noreferrer"}
- [Deployment Strategies](/study-guides/infrastructure/deployment-strategies.html){:target="_blank" rel="noopener noreferrer"}
- [Observability Fundamentals](/study-guides/observability-fundamentals.html){:target="_blank" rel="noopener noreferrer"}

**Key Principles**:
- Automate everything: deployments, rollbacks, monitoring
- Deploy frequently: small, frequent deployments reduce risk
- Use feature flags: decouple deployment from feature release
- Test rollback regularly: it should be routine, not exceptional

**Operations Handoff**:
- Train operations team
- Provide runbooks for common issues
- Establish on-call rotation and escalation paths

---

### 5. Delivery & Handoff

**Complete delivery and transition to ongoing operations.**

**Final Validation**:
- Complete User Acceptance Testing
- Validate all acceptance criteria met
- Confirm SLOs being achieved
- Get stakeholder sign-off on delivery

**Retrospective**:
- Reflect on entire project (not just last sprint)
- What went well? What didn't?
- Capture lessons learned
- Celebrate team accomplishments

**Project Closure**:
- Final project report to stakeholders
- Archive project artifacts
- Plan for ongoing enhancements

<div class="callout callout--tip">
<p class="callout__title">Delivery Acceptance</p>
<ul>
<li>All must-have requirements implemented</li>
<li>Acceptance criteria met and validated</li>
<li>SLOs being met in production</li>
<li>Documentation complete</li>
<li>Operations team trained and ready</li>
<li>Stakeholders satisfied with delivery</li>
</ul>
</div>

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>No clear acceptance criteria</strong>: Project drags on indefinitely</li>
<li><strong>No retrospective</strong>: Missing opportunity to learn</li>
<li><strong>Ghosting operations</strong>: Dev team disappears after launch</li>
</ul>
</div>
