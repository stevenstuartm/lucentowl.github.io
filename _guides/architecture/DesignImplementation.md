---
layout: guide
title: "Component-Based Thinking"
category: Architecture
subcategory: Foundations
description: "How to identify logical components with the workflow and actor/action approaches, avoid the entity trap, separate logical from physical architecture, and refine component boundaries by assigning requirements and analyzing characteristics."
tags: [fundamentals, logical-components, logical-architecture, entity-trap, component-identification]
---

Architects think in **logical components** rather than classes. A logical component is a building block of the system's behavior with a clear responsibility, such as order placement, payment processing, or inventory tracking. In code, a component usually shows up as a namespace or directory that groups related classes. It is larger than a class, and it is not the same thing as a service. One deployable service can contain several components, and a small system can keep all its components in one deployment.

Working at this level lets an architect reason about responsibilities and dependencies without getting lost in class design, and without committing yet to how anything will be deployed.

## Logical vs Physical Architecture

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Logical Architecture</h4>
<ul>
<li>Shows components and how they interact</li>
<li>Maps to namespaces and directory structure</li>
<li>Independent of deployment</li>
<li><strong>Focus:</strong> What the system does</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Physical Architecture</h4>
<ul>
<li>Shows services, user interfaces, and databases</li>
<li>Describes the deployment topology</li>
<li>Reflects infrastructure decisions</li>
<li><strong>Focus:</strong> Where things run</li>
</ul>
</div>
</div>

Create the logical architecture first. It organizes the code and gives teams a shared map of responsibilities, and it stays valid across several possible physical designs. The same set of components could deploy as a single modular monolith or as a handful of services. Deciding that is a separate step, driven by the characteristics each group of components needs.

## Identifying Core Components

The first pass produces a set of initial core components. Two approaches help, and they work well together.

### The Workflow Approach

Model the major paths a user or process takes through the system, focusing on the happy path first. Each workflow breaks into steps, and related steps suggest components. An order workflow of "browse catalog, place order, pay, ship" suggests components for catalog browsing, order placement, payment, and fulfillment. This approach fits when the major journeys through the system are reasonably well understood.

### The Actor/Action Approach

Identify the actors who use the system, such as customers, warehouse staff, or an external payment provider, and list the major actions each one performs. Components emerge from grouping those actions. This approach fits when the system has several distinct kinds of users, because it keeps any one actor's needs from dominating the design.

### Avoid the Entity Trap

The tempting shortcut is to create a component for each major entity: a Customer Manager, an Order Manager, a Product Manager.

<div class="callout callout--warning">
<p class="callout__title">The Entity Trap</p>
<p>Entity-based components mirror the database rather than the system's behavior. The result is a component-relational mapping, not an architecture, because database relations are not workflows.</p>
<p><strong>Symptoms:</strong> Vague names like "Manager" that attract unrelated logic, components that grow into dumping grounds, and boundaries too coarse to scale, test, or deploy independently.</p>
<p><strong>If the system really is simple CRUD:</strong> Use a CRUD framework rather than designing a custom architecture around it.</p>
</div>

## Refining Components Iteratively

Initial components are a hypothesis. Refinement tests and reshapes them in a loop.

1. **Assign requirements.** Map user stories and requirements to components. A story that fits nowhere signals a missing component. A component that attracts stories from unrelated areas signals one that should split.
2. **Analyze roles and responsibilities.** Check that each component's operations belong together. A component whose responsibilities read like an unrelated list has low cohesion.
3. **Analyze architecture characteristics.** Check whether the operations inside a component need different characteristics. If order placement must scale elastically but order history does not, they may belong in separate components.
4. **Restructure.** Split, merge, or move responsibilities based on what the previous steps found, then repeat as understanding deepens.

The loop never fully ends. New requirements and a better understanding of the domain keep reshaping components throughout a system's life.

## Component Identification Checklist

- [ ] Model the major workflows
- [ ] Identify the actors and their major actions
- [ ] Avoid entity-based "manager" components
- [ ] Assign user stories to components
- [ ] Confirm each component's responsibilities are cohesive
- [ ] Check whether operations within a component need different characteristics
- [ ] Minimize coupling between components
- [ ] Iterate as requirements and understanding change
