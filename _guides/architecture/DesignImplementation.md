---
layout: guide
title: "Design & Implementation"
category: Architecture
subcategory: Design
description: "Learn component design principles, bounded contexts, coupling types, logical vs physical architecture, and practical implementation strategies for distributed systems."
tags: [architecture, design-patterns, component-design, risk-analysis, practical, modeling]
---

## Component Design

<blockquote class="pull-quote">
<p>Bounded contexts prevent the anti-pattern of unified models. Instead of one bloated Customer entity, each context creates its own model optimized for its needs.</p>
</blockquote>

### Bounded Contexts (DDD)

*Core concept from Eric Evans' Domain-Driven Design (2003)*

A bounded context is an explicit boundary within which a domain model is defined and applicable. Everything related to a domain portion is visible internally but opaque to other contexts.

Instead of unified entities across the organization (causing tight coupling), each context creates its own entities and reconciles differences at communication points through translation.

**Example**: Each domain has its own Customer class rather than shared organization-wide
- Sales context: Customer (name, credit limit, account manager)
- Support context: Customer (name, support tier, open tickets)
- Shipping context: Customer (name, shipping addresses, delivery preferences)

Each context's Customer model serves its specific needs without forcing a bloated shared model.

### Coupling Types

**Semantic**: Natural domain coupling (inventory, catalogs, customers, sales)

**Implementation**: How you implement dependencies (database choices, service boundaries)

**Static**: Architecture "wiring," meaning how services depend on each other

**Dynamic**: Runtime communication between quanta forming workflows

**Key Principle**: Low external implementation static coupling between quanta

### Communication Considerations

Synchronous communication is unforgiving in distributed architectures, especially when parts have different characteristics.

Asynchronous has less impact on architecture quanta boundaries.

---

## Component-Based Thinking

Think in **logical components** (not classes) interacting to perform business functions.

### Logical vs Physical Architecture

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Logical Architecture</h4>
<ul>
<li>Shows components and interactions</li>
<li>Matches directory structures and namespaces</li>
<li>Independent of deployment</li>
<li><strong>Focus:</strong> What the system does</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Physical Architecture</h4>
<ul>
<li>Services, UIs, databases</li>
<li>Deployment topology</li>
<li>Infrastructure decisions</li>
<li><strong>Focus:</strong> Where things run</li>
</ul>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">Best Practice</p>
<p>Create logical architecture first, then physical. Logical guides code organization and team guidance.</p>
</div>

### Identifying Core Components

**1. Workflow Approach**: Model major happy-path workflows; identify components from steps.

**2. Actor/Action Approach**: Identify actors and major actions; derive components from actions.

**3. Avoid The Entity Trap**:

<div class="callout callout--warning">
<p class="callout__title">The Entity Trap</p>
<p>Don't create components based on entities (Customer Manager, Order Manager).</p>
<p><strong>Problems:</strong> Ambiguous names | Dumping grounds | Too coarse-grained | Hard to maintain/test/deploy</p>
<p><strong>If truly CRUD-based:</strong> Use a CRUD framework instead of custom architecture.</p>
</div>

### Iterative Refinement

1. **Assign User Stories**: Map requirements to components
2. **Analyze Roles**: Ensure cohesion (operations interrelate)
3. **Analyze Characteristics**: Consider scalability, reliability, availability
4. **Iterate**: Refine boundaries and responsibilities

### Component Coupling

**Afferent (Incoming/Fan-in)**: Degree other components depend on this one

**Efferent (Outgoing/Fan-out)**: Degree this component depends on others

**Temporal**: Nonstatic dependencies (timing/transactions). Hard to detect; found via design docs or error conditions

### Law of Demeter

*Principle from Ian Holland (1987), also called "Principle of Least Knowledge"*

A component should only interact with its immediate dependencies, not their dependencies.

**Rule**: An object's method should only call methods on:
- Itself
- Its parameters
- Objects it creates
- Its direct dependencies

**Example**:
- Bad: `customer.getWallet().getMoney()` (reaching through wallet)
- Good: `customer.getMoney()` (wallet encapsulated)

*Note: Doesn't reduce system-wide coupling; redistributes it to more appropriate locations*

---

## Risk Analysis

### Risk Matrix

**Dimensions**:

1. Impact (Low=1, Medium=2, High=3)
2. Likelihood (Low=1, Medium=2, High=3)

**Score = Impact × Likelihood**

**Risk Levels**:

- 1-2: Low (green)
- 3-4: Medium (yellow)
- 6-9: High (red)

### Risk Assessments

Use architecture characteristics as criteria. Create matrix of characteristics vs context (services, domains, areas).

**Benefits**: Considers criteria and context | Prioritizes effort | Filters noise | Tracks risk direction (△ ▽ ○)

### Risk Storming

Collaborative exercise to determine risk within specific dimension.

**Participants**: Architects + senior developers + tech leads

**Phase 1: Identification (Individual)**:

1. Facilitator sends diagram, criteria, logistics
2. Participants analyze independently using risk matrix
3. Write risk on colored sticky notes (green/yellow/red)

**Best Practice**: Single criterion or context per session

**Phase 2: Consensus (Collaborative)**:

1. Post large architecture diagram
2. Place sticky notes on diagram
3. Analyze and reach consensus
4. Consolidate notes
5. **Unproven/unknown tech = highest risk (9)**

**Phase 3: Mitigation (Collaborative)**:

1. Identify ways to reduce/eliminate risks
2. Involve business stakeholders (cost vs risk authority)
3. Present options with cost implications
4. Make trade-off decisions

**Bonus**: Apply to user-story risk in iterations

---

## Diagramming Architecture

<blockquote class="pull-quote">
<p>No matter how brilliant your ideas, if you can't convince managers to fund and developers to build them, they won't happen.</p>
</blockquote>

### Importance

### Representational Consistency

Show relationships before changing views. Show context before details.

**Avoid Irrational Artifact Attachment**: Time spent ∝ attachment. Use low-fidelity early to enable iteration.

### Standards

**UML (Unified Modeling Language)**:
- Still used: Class diagrams, sequence diagrams
- Most types fallen into disuse

**C4 (Context, Container, Component, Class)**:

Modern alternative by Simon Brown.

**Levels**:

1. **Context**: Entire system, users, external dependencies
2. **Container**: Physical deployment boundaries
3. **Component**: Component view (architect perspective)
4. **Class**: UML-style class diagrams

**Benefits**: Active community, templates, keeps up with ecosystem

**ArchiMate**:

Open source from The Open Group. "As small as possible" for enterprise ecosystems.

---

## Quick Reference

### Component Identification Checklist

- [ ] Model major workflows
- [ ] Identify actors and actions
- [ ] Avoid entity trap (no Customer Manager, Order Manager)
- [ ] Assign user stories to components
- [ ] Ensure high cohesion within components
- [ ] Minimize coupling between components
- [ ] Iterate and refine boundaries

### Risk Matrix Reference

| Impact/Likelihood | Low (1) | Medium (2) | High (3) |
|-------------------|---------|------------|----------|
| **Low (1)** | 1 (green) | 2 (green) | 3 (yellow) |
| **Medium (2)** | 2 (green) | 4 (yellow) | 6 (red) |
| **High (3)** | 3 (yellow) | 6 (red) | 9 (red) |

### C4 Diagram Levels

1. **Context**: System in environment
2. **Container**: Deployment units
3. **Component**: Logical components
4. **Class**: Implementation details

### Coupling Metrics

**Afferent**: Incoming dependencies (fan-in)
**Efferent**: Outgoing dependencies (fan-out)
**Temporal**: Timing/transaction dependencies

**Goal**: High afferent + low efferent = stable, reusable components

---
