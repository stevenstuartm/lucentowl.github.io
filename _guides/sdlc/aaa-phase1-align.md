---
title: "AAA Cycle: Phase 1 - Align with the Need"
layout: guide
category: Software Development Lifecycle
subcategory: AAA Cycle
description: "Understand the problem before committing to a solution."
author: steven-stuart
tags: [sdlc, aaa-cycle, requirements, stakeholder-management, collaboration, practical]
---

## Phase Overview

### Purpose

**Understand the problem space before making commitments.** Build trust with stakeholders, surface constraints, and establish shared understanding of success.

### The Universal Pattern

Regardless of project size or methodology, alignment follows these steps:

1. **Understand the need**: What problem? Why now?
2. **Identify stakeholders**: Who cares? Who decides?
3. **Surface constraints**: What limits our options?
4. **Assess risk**: What could go wrong?
5. **Estimate effort**: How much work?
6. **Get agreement**: Are we aligned to proceed?

The depth and formality scale with scope and risk, but these questions remain constant.

### Entry & Exit

**You start with**: A project concept or business need

**You deliver**: Approved project charter with stakeholder sign-off

---

## Core Activities

### 1. Initial Stakeholder Discovery

**Set expectations and understand the landscape.**

**Key Questions**:
- What problem are we solving? Why now?
- What does success look like?
- Who else needs to be involved?
- What are the hard constraints (timeline, budget, technology, compliance)?
- What keeps you up at night about this project?

**How to Do This Well**:
- Listen more than you talk, taking notes, asking clarifying questions, and observing dynamics
- Don't jump to solutions yet; stay neutral and build trust first
- Demonstrate genuine interest in stakeholder needs, not just their requirements
- In every meeting, ask "Who else should be involved?"

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Missing key stakeholders (operations, security, compliance, end users)</li>
<li>Vague success criteria ("make it faster")</li>
<li>Stakeholders who don't understand what alignment involves</li>
<li>Pressure to "start coding" without proper discovery</li>
</ul>
</div>

---

### 2. Requirements Discovery

**Translate business needs into clear, prioritized requirements.**

**Functional Requirements**:
- What tasks must users complete?
- What business rules govern the process?
- What data needs to be captured or integrated?

**Architectural Characteristics** (often missed):
- Performance: Response time, throughput expectations
- Scalability: Growth projections for users and data
- Availability: Uptime requirements
- Security: Authentication, authorization, data protection (see [Security Foundations](/study-guides/security/security-foundations.html){:target="_blank" rel="noopener noreferrer"})
- Compliance: Regulatory requirements (GDPR, HIPAA, etc.) (see [Compliance & Governance](/study-guides/security/compliance-governance.html){:target="_blank" rel="noopener noreferrer"})

**Prioritization**:
- Must have vs. should have vs. could have
- MVP scope vs. future enhancements
- Force-rank if everything is "critical"

**How to Do This Well**:
- Ask "why" repeatedly to get to root needs
- Probe for architectural characteristics explicitly, since stakeholders often forget them
- Push for measurable, testable criteria (not "it should be fast" but "page loads < 2 seconds")
- Document acceptance criteria clearly so there's no ambiguity later

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Gold plating (collecting every nice-to-have)</li>
<li>Vague, unmeasurable requirements ("fast," "scalable," "user-friendly")</li>
<li>No prioritization or everything is P0</li>
<li>Analysis paralysis (too long in discovery)</li>
<li>Accepting vague requirements without pushing for specifics</li>
</ul>
</div>

---

### 3. Constraint & Risk Assessment

**Surface limitations and potential blockers while they're cheap to address.**

**Constraints to Document**:
- Technical (platform mandates, technology restrictions, integration requirements)
- Resource (budget, team size/skills, timeline pressures)
- Compliance (industry standards, data residency, audit requirements)
- Organizational (governance policies, procurement processes, support requirements)

**Risk Categories**:
- Technical: New technologies, complex integrations, unknowns
- Schedule: Aggressive timelines, resource availability
- Business: Market timing, competitive pressure
- Organizational: Stakeholder alignment, political challenges
- Operational: Deployment complexity, support readiness

**How to Do This Well**:
- Extract implicit constraints, since stakeholders often assume you know their limitations
- Challenge "requirements" that are actually preferences
- Quantify risks with likelihood and impact scoring
- Map dependencies on other teams/systems explicitly
- Budget time for organizational overhead (approvals, procurement, access delays)
- Be honest about uncertainties; don't sugarcoat risks

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Treating preferences as constraints</li>
<li>Missing organizational/political risks</li>
<li>Risk lists without mitigation strategies</li>
<li>Assuming assumptions are validated without testing them</li>
<li>Underestimating non-technical delays (approvals, access provisioning)</li>
</ul>
</div>

---

### 4. Initial Sizing & Estimation

**Deliverable: one Go / Pivot / No-Go recommendation, built from an effort estimate and a risk tier.**

The two inputs answer different questions: how much work, and how likely the estimate is to be wrong. Neither alone is enough. A small, well-understood project still needs to fit the calendar, and a project that fits the calendar can still be too novel to trust the estimate. Both feed a single recommendation at the end of this section, not two separate go/no-go calls.

#### Effort Estimate

- Break the solution into major components or epics
- Estimate effort using analogous estimation, planning poker, or t-shirt sizing
- Include infrastructure, operational costs, testing, deployment, and documentation
- Add a contingency buffer (typically 20-30%)
- Involve the team; engineers doing the work should validate estimates
- Provide ranges, not point estimates: "4-6 months" is more honest than "5 months." Explain your methodology and assumptions clearly so stakeholders understand the reasoning, and flag high-uncertainty areas explicitly

<blockquote class="pull-quote">
<p>Be realistic, not optimistic. Frame alignment as risk mitigation.</p>
</blockquote>

#### Risk Tier

Rate two axes instead of trusting a gut call on feasibility.

**Scope size**: rate each domain the system touches using function-point-style complexity tiers, then sum across domains for an overall size of small, medium, or large:
- **Simple**: Thin integration, reading a few fields from an existing system
- **Average**: Moderate new logic layered on existing capabilities
- **Complex**: A new subsystem you fully own

**Novelty**: draw this rating from the Technical and Organizational risk categories you already surfaced above, rather than assessing novelty from scratch. Rate how well-understood the problem and technology are for *this team*, not in the abstract:
- **Well-understood**: You've built something like this before; known patterns apply
- **Unfamiliar**: Understood in principle, but new to this team or this combination of systems
- **Novel**: No clear precedent; the approach itself needs discovery before it can be estimated

| | Small scope | Medium scope | Large scope |
|---|---|---|---|
| **Well-understood** | Low | Low | Medium |
| **Unfamiliar** | Medium | Medium | High |
| **Novel** | High | High | Extreme |

Keep the two axes separate when scoring them. A single blended score lets a strong scope rating mask a disqualifying novelty rating, or the reverse.

#### The Recommendation

Check the effort estimate against your actual constraints (timeline, budget, staffing, dependencies), then combine that with the risk tier into one call:

- **Go**: The estimate fits your constraints and the risk tier is Low or Medium
- **Pivot**: The estimate doesn't fit, or the tier is High: cut scope, extend the timeline, add resources, or resolve the novelty with a targeted POC before re-estimating (see [Technical Proof of Concept](aaa-phase2-agree.html#4-technical-proof-of-concept){:target="_blank" rel="noopener noreferrer"})
- **No-Go**: The tier is Extreme, or no combination of scope, timeline, and resource adjustments brings the estimate inside your constraints: recommend cancellation, or fund a small discovery spike as its own project before chartering the real one

The recommendation is a starting position for the conversation with stakeholders, not a substitute for it. A Go they don't actually believe in is worse than an honest No-Go.

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>False precision ("4.3 months") or anchoring bias from stakeholder-suggested timelines</li>
<li>Ignoring non-development work (testing, deployment, documentation)</li>
<li>No contingency buffer</li>
<li>Estimating without team input</li>
<li>Rating novelty by the architect's own familiarity rather than the team's</li>
</ul>
</div>

---

## Visual Communication During Alignment

<blockquote class="pull-quote">
<p>Use diagrams to build shared understanding, not to create documentation.</p>
</blockquote>

During Align, visualization serves discovery. The goal is to ensure stakeholders share the same mental model of the problem space, system boundaries, and key relationships. These are working artifacts, not formal documentation.

### What Works at This Stage

**C4 Level 1 (Context Diagrams)**:
- Shows the system boundary and external dependencies
- Helps stakeholders understand what's in scope vs. out of scope
- Clarifies which external systems, teams, or users are involved

**Simple Box-and-Arrow Sketches**:
- Whiteboard-level clarity for exploring ideas
- No formal notation required; focus on communication
- Easy to change as understanding evolves

**Data Flow Diagrams**:
- Shows how information moves through the system
- Identifies sources, destinations, and transformations

<div class="callout callout--tip">
<p class="callout__title">How to Do This Well</p>
<ul>
<li><strong>Keep it simple</strong>: Use the minimum formality needed for clarity</li>
<li><strong>Make it collaborative</strong>: Sketch together with stakeholders, don't present finished diagrams</li>
<li><strong>Focus on boundaries</strong>: What's in scope? What's out? Who owns what?</li>
<li><strong>Iterate quickly</strong>: Diagrams should evolve as understanding evolves</li>
<li><strong>Don't over-invest</strong>: These are discovery tools, not deliverables, so skip them when everyone already shares the same mental model or you're still discovering the problem</li>
<li><strong>Test understanding</strong>: Ask stakeholders to explain the diagram back to you</li>
</ul>
</div>

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Creating UML class diagrams during Align (you don't know the solution yet)</li>
<li>Spending hours on polished diagrams before you've agreed on the problem</li>
<li>Using diagrams to avoid conversations ("here's the architecture, read it")</li>
<li>Formal notation that stakeholders don't understand</li>
<li>Diagrams that become stale immediately because they're not maintained</li>
<li>Diagramming the solution when you're supposed to be understanding the problem</li>
</ul>
</div>

---

## The Project Charter

### Purpose

**Formalize understanding and secure commitment.** The charter is the contract that authorizes the project to proceed.

### Essential Components

#### 1. Executive Summary (1-2 pages)
- Project name, sponsor, and key personnel
- High-level business problem and objectives
- Recommended approach
- Estimated timeline and budget
- Critical success factors

#### 2. Scope Definition
**In-Scope**: Clear deliverables and capabilities
**Out-of-Scope** (equally important): What you're explicitly NOT doing

Example:
```
IN SCOPE:
- Customer portal with login and profile management
- Integration with existing CRM
- Mobile-responsive web design

OUT OF SCOPE:
- Mobile native apps (web only)
- International language support (future phase)
- Integration with legacy billing system (separate project)
```

#### 3. Success Criteria (Measurable)
- Business metrics (revenue, cost savings, conversion rate)
- User metrics (adoption rate, satisfaction)
- Technical metrics (uptime, performance)
- Timeline metrics (launch date, milestones)

Example:
```
Success =
✓ Portal launched by Q3 2025
✓ 70% customer adoption within 3 months
✓ 99.9% uptime achieved
✓ Support calls reduced 30%
✓ Page load < 2 seconds (95th percentile)
```

#### 4. Authority & Decision Rights
- What can you decide autonomously?
- What requires stakeholder approval?
- Escalation path for issues
- Budget authority and spending limits

#### 5. Communication Plan
- Meeting schedules and cadence
- Status reporting approach
- Where artifacts will be stored
- How decisions will be documented

#### 6. Risk Register (Top 5-10)
Open with the Scope & Novelty tier as the headline entry, then list supporting risks beneath it.
- Risk description, likelihood, impact
- Mitigation strategy and owner

#### 7. Assumptions & Dependencies
- Key assumptions (and what invalidates them)
- Dependencies on other teams/systems
- Timeline impacts if dependencies delayed

### Minimum vs. Maximum

**Small Projects**: 3-5 pages, simple scope, basic risks
**Large Projects**: 15-20 pages, detailed scope, comprehensive risk register, governance structure

### Getting Real Approval

Present the charter in person; don't just email it. Walk through key sections together and ask stakeholders to explain the project back to you. Make the charter scannable with headings, bullets, and tables. Get formal written sign-off, not just verbal agreement.

---

## Readiness: Transitioning to Agree

Artifacts can be completed without genuine alignment. Before moving to Phase 2 (Agree), verify that alignment holds up under questioning, not just on paper.

**Test alignment with these questions**:
- Can each stakeholder explain the project's purpose and success criteria without referring to the charter?
- Do stakeholders describe the project consistently, or do they emphasize different goals?
- When you present a hypothetical trade-off ("What if we had to cut 20% of scope?"), do stakeholders agree on what to cut?
- Are stakeholders asking questions and engaging, or just signing off to move things along?

**You're ready for Agree when**:
- [ ] Project charter is signed by all key stakeholders
- [ ] Stakeholders can explain the project in their own words
- [ ] Success criteria are measurable and agreed (not vague or conflicting)
- [ ] Constraints are documented and acknowledged
- [ ] Key risks are identified with owners and mitigation strategies
- [ ] Budget and resources have real commitment (not "we'll figure it out")
- [ ] Decision rights are clear (who decides what)
- [ ] No stakeholder is withholding concerns or planning to revisit decisions later

<div class="callout callout--warning">
<p class="callout__title">Red Flags</p>
<ul>
<li>Stakeholders agreed in the meeting but raised concerns afterward</li>
<li>Key stakeholders weren't present for approval</li>
<li>Budget is "to be determined" or "flexible"</li>
<li>The approval was rushed or rubber-stamped without real review</li>
<li>Stakeholders say "just start and we'll figure out the details"</li>
</ul>
</div>
