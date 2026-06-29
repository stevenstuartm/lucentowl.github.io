---
title: "C4 Model"
layout: guide
category: Architecture
subcategory: Modeling
description: "A pragmatic approach to software architecture diagrams focused on clarity and context"
tags: [architecture, modeling, documentation, diagrams, practical, fundamentals]
---

## What is the C4 Model?

The C4 model is a hierarchical approach to software architecture diagramming created by [Simon Brown](https://simonbrown.je/){:target="_blank" rel="noopener noreferrer"}. It provides four levels of abstraction (Context, Containers, Components, and Code) that work like a map zoom function for software systems. Each level reveals appropriate detail for its audience without overwhelming them with implementation specifics that rapidly become outdated.

<blockquote class="pull-quote">
<p>C4 focuses on what matters when it matters, showing only the information relevant to each level of abstraction.</p>
</blockquote>

The model was created in response to the problems with traditional UML diagrams: they often show too much detail too early, use inconsistent notation across teams, and focus on implementation details that change frequently rather than architectural decisions that remain stable.

### The Four Levels

The C4 model defines four hierarchical diagram types, each serving a different purpose:

**Level 1: System Context**
Shows the system being built and its relationships with external systems and users. This is the big picture view that answers "What does this system interact with?" It's technology-agnostic and focuses on people (actors, roles, personas) and software systems (external dependencies, other systems).

**Level 2: Container**
Zooms into the system to show the high-level technology choices: web applications, mobile apps, databases, message brokers, file systems. A container is something that hosts code or data and executes as part of the system. This level answers "What are the major technology building blocks and how do they communicate?"

**Level 3: Component**
Zooms into an individual container to show the components inside it. A component is a grouping of related functionality encapsulated behind an interface. This level shows the major structural building blocks and their interactions within a single container. It answers "How is this container structured internally?"

**Level 4: Code**
Optional level showing how a specific component is implemented using classes, interfaces, or database schemas. This level is often skipped because it provides limited value. The code itself is typically more up-to-date than diagrams, and modern IDEs can generate these views automatically.

### Core Principles

**Abstraction over detail**: Each level hides the complexity of lower levels. A context diagram doesn't show containers; a container diagram doesn't show components. This prevents cognitive overload and keeps diagrams focused.

**Consistency in notation**: C4 uses simple shapes (boxes and lines) with consistent meaning across all diagrams. A person is always shown the same way. A container is always shown the same way. This reduces the learning curve and makes diagrams easier to scan.

**Technology labels matter**: C4 explicitly labels technology choices on diagrams (e.g., "React SPA", "PostgreSQL Database", "REST API"). This makes architecture decisions visible and helps readers understand constraints and integration points.

**Audience-appropriate detail**: Different stakeholders need different views. Product managers care about system context. Developers care about container and component structures. C4 provides exactly the right level of detail for each audience.

## Why C4 Over UML?

UML provides extensive notation for many purposes: class diagrams, sequence diagrams, activity diagrams, state diagrams, deployment diagrams. This flexibility becomes a problem when teams use different diagram types inconsistently, notation varies between tools and individuals, and diagrams often show implementation details that become stale as soon as code changes.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>C4 Model Advantages</h4>
<ul>
<li><strong>Focused scope</strong>: Specifically targets software architecture diagramming</li>
<li><strong>Simple notation</strong>: Boxes and lines with labels, no memorization required</li>
<li><strong>Stable abstractions</strong>: Documents architectural decisions that remain stable over time</li>
<li><strong>Technology visibility</strong>: Makes technology choices explicit at each level</li>
<li><strong>Hierarchy prevents chaos</strong>: Enforces discipline through levels (Context → Container → Component)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>UML Challenges</h4>
<ul>
<li><strong>General-purpose</strong>: Many diagram types with inconsistent usage across teams</li>
<li><strong>Complex notation</strong>: Requires memorizing arrow types, line styles, and symbols</li>
<li><strong>Implementation focus</strong>: Often shows details that change frequently and become stale</li>
<li><strong>Disconnected views</strong>: Deployment diagrams often separate from logical views</li>
<li><strong>Permissive</strong>: Teams can jump to detailed class diagrams prematurely</li>
</ul>
</div>
</div>

## When to Use C4

C4 works best for documenting and communicating software architecture:

**System understanding**: When new team members join, when stakeholders need visibility into technical decisions, or when multiple teams need to understand system boundaries and integration points.

**Architecture decision records**: C4 diagrams provide visual context for architectural decisions. A container diagram shows why you chose specific technologies. A component diagram shows the modular structure that enables testing or replacement.

**API and integration documentation**: Container diagrams clearly show external interfaces and communication patterns. They help teams understand what protocols, data formats, and authentication mechanisms are in use.

**Planning and design**: Before building, create context and container diagrams to explore system boundaries and technology choices. This surfaces questions early and aligns teams on the big picture.

**Refactoring and migration planning**: Existing systems benefit from retrospective C4 diagrams. Documenting the current state makes it easier to identify pain points and plan changes. C4's hierarchical approach helps teams see both the forest (system context) and the trees (component structure).

## When NOT to Use C4

C4 has specific boundaries where other approaches work better:

**Detailed behavior and workflows**: C4 shows structure, not behavior. If you need to document complex business processes, decision trees, or state transitions, use UML activity diagrams, state diagrams, or BPMN.

**Runtime interactions and message flows**: C4 container and component diagrams show static relationships, not runtime sequences. For showing how objects collaborate during a specific operation, use UML sequence diagrams or collaboration diagrams.

**Data modeling**: C4 shows databases as containers and relationships between components and databases, but it doesn't model entity relationships, schemas, or data flows. Use entity-relationship diagrams (ERDs) or data flow diagrams for data-centric views.

**Infrastructure and deployment details**: C4 containers show what needs to be deployed, but not how it's deployed. For showing servers, network zones, load balancers, and infrastructure topology, use deployment diagrams or infrastructure diagrams (often using tools like Cloudcraft or draw.io).

**Class-level design**: C4 deliberately avoids detailed class structures. If you need to show inheritance hierarchies, design patterns, or detailed object interactions, use UML class diagrams, but recognize that these diagrams become outdated quickly.

## Mixing C4 and UML

C4 and UML complement each other when used appropriately. The goal is to use each approach where it provides the most value.

**Use C4 for stable architecture views**:
- System Context (Level 1) → Shows system boundaries and external dependencies
- Container (Level 2) → Shows major technology choices and how they communicate
- Component (Level 3) → Shows internal structure of containers

**Use UML for behavior and interactions**:
- Sequence diagrams → Show runtime message flows for complex operations
- State diagrams → Show lifecycle and state transitions for stateful entities
- Activity diagrams → Show business process flows and decision logic

**Use ERDs for data modeling**:
- Entity-relationship diagrams → Show database schemas and relationships
- Data flow diagrams → Show how data moves through the system

**Practical example**: You might have a C4 Container diagram showing an API Gateway, Authentication Service, Order Service, and PostgreSQL database. Then supplement it with:
- A UML sequence diagram showing the authentication flow across containers
- An ERD showing the Order Service's database schema
- A state diagram showing order lifecycle states

**Key principle**: Don't duplicate information. If a C4 diagram already shows that the Order Service depends on PostgreSQL, don't create a UML deployment diagram that shows the same thing. Each diagram should add new information, not repeat what's already documented.

## Creating Effective C4 Diagrams

<div class="callout callout--tip">
<p class="callout__title">Best Practices for C4 Diagrams</p>
<p><strong>Start at the top</strong>: Always begin with a System Context diagram. This forces you to define system boundaries and identify external dependencies before diving into implementation details.</p>
<p><strong>Label everything</strong>: Every box should have a name and a type (Person, Software System, Container, Component). Every line should have a label describing the interaction (e.g., "Makes API calls to", "Reads from and writes to", "Sends events to").</p>
<p><strong>Show technology explicitly</strong>: On Container and Component diagrams, include technology choices in square brackets (e.g., "Web Application [React]", "Database [PostgreSQL]", "API [ASP.NET Core]"). This makes architecture decisions visible.</p>
<p><strong>Use color meaningfully</strong>: Differentiate internal vs. external systems, or highlight specific areas of concern (e.g., legacy vs. new systems). But don't overdo it; too many colors create visual noise.</p>
<p><strong>Keep it current</strong>: Unlike code-level diagrams, C4 diagrams should be maintained as the architecture evolves. When you add a new container or change how containers communicate, update the diagrams. This is feasible because C4 focuses on stable abstractions.</p>
<p><strong>Stop at the right level</strong>: Not every system needs all four levels. Many teams find that Context and Container diagrams provide 80% of the value. Only create Component diagrams for containers with significant complexity. Skip Code diagrams unless you need them for onboarding or teaching purposes.</p>
</div>

**Use diagramming-as-code tools**: Tools like [Structurizr](https://structurizr.com/){:target="_blank" rel="noopener noreferrer"}, [PlantUML](https://plantuml.com/){:target="_blank" rel="noopener noreferrer"} with C4 extensions, or [Diagrams](https://diagrams.mingrammer.com/){:target="_blank" rel="noopener noreferrer"} let you define diagrams in code. This makes them versionable, reviewable, and easier to keep in sync with architecture changes.

## Common Pitfalls

**Mixing abstraction levels**: Don't show components on a container diagram or containers on a context diagram. Each level should maintain its focus. If readers need more detail, create a separate diagram at the next level down.

**Too much detail too early**: Teams often jump to Component or Code diagrams before establishing context and container boundaries. This leads to confusion about what the system actually does and how it fits into the larger ecosystem.

**Stale diagrams**: C4 diagrams lose value when they drift from reality. If you add a new microservice but don't update the container diagram, the documentation becomes misleading. Treat C4 diagrams as living artifacts that evolve with the architecture.

**Using C4 for runtime behavior**: C4 shows static structure, not runtime behavior. If you find yourself trying to show sequence or order of operations on a C4 diagram, you need a UML sequence diagram instead.

**Inconsistent notation**: Teams sometimes create "hybrid" diagrams mixing C4 boxes with UML notation or custom shapes. This defeats the purpose of C4's simplicity. Stick to the standard notation or supplement with separate UML diagrams.

**Over-documenting stable components**: Not every component needs deep documentation. Focus C4 effort on areas of high complexity, frequent change, or cross-team integration. Stable, well-understood components often don't need detailed diagrams.

## Key Takeaways

C4 provides a pragmatic, hierarchical approach to software architecture diagramming that focuses on what matters: system boundaries, technology choices, and component organization. Unlike UML, which provides extensive notation for many purposes, C4 deliberately constrains scope to maintain simplicity and consistency.

Use C4 for documenting stable architectural decisions. Use UML for behavior, interactions, and data modeling. Use each approach where it provides the most value, and avoid duplicating information across diagrams.

The model's strength lies in its focus on abstraction over detail. By providing exactly the right level of information for each audience (context for stakeholders, containers for cross-team integration, components for within-team understanding), C4 makes architecture visible without overwhelming readers with implementation details that change constantly.

Start with context, zoom into containers, and only create component diagrams where complexity justifies the effort. Keep diagrams current by treating them as living artifacts that evolve with the architecture. And remember that the goal isn't comprehensive documentation; it's effective communication of architectural decisions.
