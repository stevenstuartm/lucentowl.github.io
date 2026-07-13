---
title: "AAA Cycle: Phase 2 - Agree to the Plan"
layout: guide
category: Software Development Lifecycle
subcategory: AAA Cycle
description: "Design the solution and secure commitment to the approach."
author: steven-stuart
tags: [sdlc, aaa-cycle, planning, architecture, collaboration, practical]
---

## Phase Overview

### Purpose

**Transform aligned understanding into concrete, approved technical plans.** Design the solution, validate critical assumptions, and secure commitment on approach and resources.

### The Universal Pattern

Regardless of project size or methodology, agreement follows these steps:

1. **Design the solution**: How will we build this?
2. **Validate assumptions**: Will this approach work?
3. **Define quality standards**: How good is good enough?
4. **Set performance targets**: What's the bar for success?
5. **Analyze costs**: What's the total investment and return?
6. **Plan the work**: What's the sequence and effort?
7. **Get commitment**: Do we all agree to proceed?

### Entry & Exit

**You start with**: Approved project charter from Phase 1

**You deliver**: Approved architecture and implementation plan with resource commitment

---

## Core Activities

### 1. Architecture Design

**Define the system architecture that meets requirements within constraints.**

**Key Design Decisions**:

- **Architectural Characteristics**: What quality attributes matter most?
  - Identify 7 characteristics critical to success (performance, scalability, availability, security, maintainability, etc.)
  - Prioritize the top 3; these drive architecture style selection
  - See [Architecture Foundations](/study-guides/architecture/ArchitectureFoundations.html#architecture-characteristics){:target="_blank" rel="noopener noreferrer"}

- **Architectural Style**: Monolithic, microservices, serverless, event-driven?
  - Choose style based on top 3 architectural characteristics
  - See [Architecture Styles](/study-guides/architecture/ArchitectureStyles.html){:target="_blank" rel="noopener noreferrer"}

- **Component Boundaries**: How do you break the system into pieces?
  - Define responsibilities, interfaces, and data ownership
  - Align boundaries with domain partitioning when possible

- **Integration Patterns**: How do components and external systems communicate?
  - See [Communication Patterns](/study-guides/architecture/communication_patterns.html){:target="_blank" rel="noopener noreferrer"}, [Integration Patterns](/study-guides/architecture/integration_patterns.html){:target="_blank" rel="noopener noreferrer"}

- **Data Architecture**: How is data stored and managed?
  - See [Data Architecture](/study-guides/data-architecture.html){:target="_blank" rel="noopener noreferrer"}, [Data Management Patterns](/study-guides/architecture/data_management_patterns.html){:target="_blank" rel="noopener noreferrer"}

**Document Your Decisions**:
- Architecture Decision Records (ADRs): Context → Decision → Consequences
- Document WHY, not just WHAT
- Record alternatives considered and why they were rejected
- See [Architecture Decisions & Leadership](/study-guides/architecture/architecture-decision-making.html){:target="_blank" rel="noopener noreferrer"}

**How to Do This Well**:
- Evaluate multiple options before deciding
- Document trade-offs explicitly for future reference
- Design for 2x growth, not 100x (YAGNI)
- Involve senior engineers throughout design
- Consider operations from the start

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>Resume-driven architecture</strong>: Choosing trendy tech, not what fits</li>
<li><strong>Over-engineering</strong>: Building for scale you'll never need</li>
<li><strong>Designing in a vacuum</strong>: No team input or buy-in</li>
<li><strong>Not documenting decisions</strong>: Future teams won't know why</li>
</ul>
</div>

---

### 2. Architecture Risk Validation

**Confirm the candidate architecture actually earns the commitment you're about to ask for.**

Once a candidate architecture exists, validate it against the top-3 quality attributes prioritized during Align, before investing further in documentation, POCs, or planning. This borrows the SEI's [ATAM](https://en.wikipedia.org/wiki/Architecture_tradeoff_analysis_method){:target="_blank" rel="noopener noreferrer"} vocabulary without the full multi-day workshop.

**Catalog three things per quality attribute, not a single score**:
- **Risks**: Specific ways the architecture might fail to meet the target (e.g., "cross-region replication may not hit the 200ms p95 target under peak load")
- **Sensitivity points**: Decisions where a small change has an outsized effect on a quality attribute (e.g., choice of consistency model drives both availability and correctness)
- **Tradeoff points**: Decisions that pull two attributes in opposite directions (e.g., synchronous validation improves correctness but costs availability)

**Why not a single risk score**: A blended number is easy to argue upward once a team is invested in a design, but a catalog of specific, named risks isn't. Each one has to be individually resolved, deferred with a named owner, or accepted in writing.

**Resolve what you can now**:
- Risks with cheap validation → route to the POC (see [Technical Proof of Concept](#4-technical-proof-of-concept) below)
- Risks that are expensive to validate → accept explicitly, with an owner and a trigger for revisiting
- Risks with no mitigation and high impact → these are your disqualifiers

The catalog is what you bring to the room, not what replaces the room. A risk list stakeholders and the team haven't seen and challenged is paperwork, not validation.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>No named risks</strong>: If the architecture has zero risks against its top-3 characteristics, you haven't looked hard enough</li>
<li><strong>Risks without owners</strong>: An accepted risk with no one responsible for it isn't accepted, it's ignored</li>
<li><strong>Skipping straight to documentation</strong>: Producing C4 diagrams before the design has survived this check just documents an unvalidated architecture</li>
</ul>
</div>

---

### 3. Architecture Documentation

**Create the minimum documentation needed to achieve genuine agreement on high-risk decisions.**

During Agree, diagrams codify decisions and create shared commitment. Use documentation strategically to clarify what you're agreeing to, not to create comprehensive reference material.

**Match documentation to risk**:
- High-risk decisions (deployment model, technology selection, integration points) need more documentation
- Low-risk decisions can be described in prose or decided during Apply

**Use the [C4 Model](https://c4model.com){:target="_blank" rel="noopener noreferrer"} selectively**:
- **Level 1 (Context)**: When multiple systems/teams are involved or boundaries need clarification
- **Level 2 (Container)**: When agreeing on deployment architecture or operational concerns
- **Level 3 (Component)**: When maintainability is a top concern or parallel team development requires clear boundaries
- **Level 4 (Code)**: Almost never during Agree; code evolves too rapidly

**Alternatives to diagrams**:
- ADRs capture the "why" behind decisions
- API specifications (OpenAPI/Swagger) for integration contracts
- Trade-off tables for comparing alternatives

---

### 4. Technical Proof of Concept

**Validate critical technical assumptions before full commitment.**

Most POC candidates should already be named as risks with a cheap validation path in your Architecture Risk Validation catalog. If a trigger below isn't backed by a named risk there, name it first.

**When to Build a POC**:
- Using new or unfamiliar technology
- Complex integration with unclear feasibility
- Performance requirements that need validation
- High uncertainty in technical approach

**What to Validate**:
- **Integration**: Can we actually connect? Does their API work as documented?
- **Performance**: Can we meet response time targets?
- **Technology Feasibility**: Does this framework do what we need?

**POC Best Practices**:
- Define clear goals: What specific questions need answering?
- Time-box it (3-7 days typical)
- Take shortcuts: It's throwaway code
- Document findings and update estimates based on learnings
- Throw away the code (POC ≠ production)

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>POC becomes production code</strong>: Quality shortcuts in production</li>
<li><strong>Testing easy things</strong>: Not addressing real risks</li>
<li><strong>POC drags on indefinitely</strong>: No decisions being made</li>
</ul>
</div>

---

### 5. Quality & Testing Strategy

**Define how you'll ensure quality throughout development.**

**Testing Pyramid**:
- **Unit Tests** (70-80%): Test individual functions/methods
- **Integration Tests** (15-20%): Test component interactions
- **End-to-End Tests** (5-10%): Test complete workflows

**Security Testing**:
- SAST on every build, dependency scanning daily
- DAST in staging, penetration testing before launch
- See [Security Testing](/study-guides/security/security-testing.html){:target="_blank" rel="noopener noreferrer"}

**Quality Gates**:
- Code commit: Tests pass, linting passes, review approved
- Merge to main: All tests pass, coverage target met
- Release: E2E tests pass, security scan clean, UAT approved

---

### 6. SLA/SLO Definition

**Establish measurable performance and availability targets.**

**Key Concepts**:
- **SLI** (Service Level Indicator): Metric measuring service quality (latency, availability, error rate)
- **SLO** (Service Level Objective): Target value for an SLI ("95% of requests < 200ms")
- **SLA** (Service Level Agreement): Commitment to customers (usually less aggressive than SLO)
- **Error Budget**: Allowable downtime (99.9% = 43.8 minutes/month)

**Best Practices**:
- Use percentiles (95th, 99th), not averages
- Build in margin: SLO tighter than SLA
- Make targets visible in dashboards

---

### 7. Planning & Budget

#### Appetite vs. Estimation

Rather than asking "How long will this take?", set an appetite: leadership decides how much time the problem is worth. If you can't shape a viable solution within that constraint, either expand the appetite or don't proceed. This forces scope decisions during Agree, not during Apply.

See [Shaped Kanban](/blog/2025/11/17/shaped-kanban.html){:target="_blank" rel="noopener noreferrer"} for more on this approach.

#### Work Breakdown & Cost Analysis

- Break components into implementable stories/tasks
- Identify dependencies and sequence work
- Include time for testing, reviews, rework
- Add contingency buffer (20-30%)

For detailed TCO and ROI guidance, see [Total Cost of Ownership](/study-guides/architecture/total-cost-of-ownership.html){:target="_blank" rel="noopener noreferrer"} and [Return on Investment](/study-guides/architecture/return-on-investment.html){:target="_blank" rel="noopener noreferrer"}.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li><strong>No developer input</strong>: Architect or PM creates plan alone</li>
<li><strong>No buffer time</strong>: Surprises are inevitable</li>
<li><strong>Unrealistic dependencies</strong>: Assuming external teams deliver on time</li>
</ul>
</div>

---

## When Stakeholders Disagree

Genuine agreement requires stakeholders to agree with each other, not just with you. Conflicts that aren't resolved during Agree will surface during Apply.

### Surfacing Hidden Disagreements

**Before formal agreement, probe for alignment gaps**:
- Present trade-offs explicitly and watch for reactions
- Ask each stakeholder to prioritize requirements independently, then compare
- Ask "What would make this project fail from your perspective?"
- Ask "What would you cut if we had to reduce scope by 30%?"

**Warning signs of hidden disagreement**:
- Stakeholders nod in meetings but raise concerns in private
- Different stakeholders describe success criteria differently
- Silence when you ask for objections (silence ≠ agreement)

### Facilitating Consensus

When stakeholders disagree, your role is to facilitate resolution, not to pick a winner:

1. **Make trade-offs explicit**: "We can optimize for X or Y, but not both. Here's what each choice costs."

2. **Escalate when necessary**: Some conflicts require someone with authority over both parties to decide.

3. **Use structured decision frameworks**: Weighted scoring, time-boxed debate, or pilot-and-measure.

4. **Document dissent**: If genuine consensus isn't possible, document who disagreed and why.

### When Agreement Isn't Possible

**Options when genuine agreement fails**:
1. **Escalate to decision authority**: Present the conflict for resolution
2. **Document the disagreement and proceed**: Record that parties disagree, proceed with explicit risk acceptance
3. **Reduce scope to the agreed portion**: Find the subset where agreement exists
4. **Recommend no-go**: If the conflict is fundamental enough that success is unlikely

<div class="callout callout--warning">
<p class="callout__title">Red Flags: Pseudo-Agreement</p>
<ul>
<li><strong>Silence as consent</strong>: No objections doesn't mean agreement</li>
<li><strong>Rubber-stamp approval</strong>: Sign-off without real review</li>
<li><strong>Agreement with fingers crossed</strong>: Stakeholders who plan to revisit later</li>
</ul>
</div>

---

## Securing Team Buy-In

The team are stakeholders too. Their genuine commitment is as essential as any business stakeholder's.

### Building Team Ownership

**Involve the team in design, not just estimation**:
- Include senior engineers in architecture discussions
- Present options and trade-offs, don't just present conclusions
- Let them challenge assumptions

**Address dissent explicitly**:
- When team members disagree, understand why
- If you override team concerns, explain your reasoning
- Document unresolved concerns as risks

**Create shared ownership**:
- Team should be able to explain the architecture and why it was chosen
- Assign architecture areas to team members to own

<div class="callout callout--warning">
<p class="callout__title">Red Flags: Team Disengagement</p>
<ul>
<li>Team is silent during design discussions</li>
<li>Estimates are given without pushback</li>
<li>Technical concerns only surface during implementation</li>
<li>Team treats the plan as "your plan" rather than "our plan"</li>
</ul>
</div>

For detailed guidance on team dynamics, see [Dev Team Leadership](/study-guides/leadership/dev-team-leadership-foundations.html){:target="_blank" rel="noopener noreferrer"} and [Team Organization](/study-guides/sdlc/team-organization.html){:target="_blank" rel="noopener noreferrer"}.

---

## Readiness: Transitioning to Apply

### Behavioral Indicators of True Agreement

Sign-offs and approved documents don't guarantee genuine agreement. Before moving to Phase 3, verify that all parties truly understand and commit.

**Test agreement with these questions**:
- Can stakeholders explain the architecture approach and why it was chosen?
- Can the development team walk through the implementation plan and defend the estimates?
- When asked "What are the biggest risks?", do stakeholders and team give consistent answers?

**You're ready for Apply when**:
- [ ] Architecture design is documented and approved
- [ ] Key design decisions are captured in ADRs
- [ ] Architecture risks, sensitivity points, and tradeoff points are cataloged, with named owners for anything accepted rather than resolved
- [ ] Critical technical assumptions are validated (POC complete if needed)
- [ ] Quality and testing strategy is defined
- [ ] SLOs are established with stakeholder buy-in
- [ ] Implementation plan exists with realistic estimates (team-validated)
- [ ] Budget is formally committed
- [ ] Team genuinely believes in the approach
- [ ] Stakeholders agree with each other (conflicts resolved)
- [ ] Dependencies are identified with contingency plans

