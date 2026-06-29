---
layout: post
title: "Architecture Is a Belief About Where Authority Belongs"
date: 2026-06-12
description: "SOLID, normalization, least privilege, and bounded contexts share a structural belief: that where authority lives determines what the system can absorb. This post develops that into two measurable properties, contour and bond, and traces through an order workflow how authority correctly placed is quietly eroded by optimization."
tags: [architecture, design-patterns, solid, software-design, system-design, ddd]
---

When I encounter a system or data design decision I'm unsure about, I endeavor to ask the same thing: **where does authority live, and how bounded is it**?

## Where Authority Belongs

Authority in a software system is the assignment of decision-making power. Something is authoritative over data when it is the canonical source of truth, and authoritative over a behavior when it is the only thing that can legitimately enforce it. The belief of where authority belongs shapes what the system can absorb when it changes and what it cannot.

The best practices across software engineering are each a response to a specific observed failure. The Single Responsibility Principle observed that a class holding authority over two concerns forces reasoning about both when either changes, producing behavioral drift at the class level. Database normalization observed that a fact stored in two places produces an inconsistency when one is updated, causing data drift. Least privilege observed that a process able to affect state beyond its concern eventually does, introducing state drift at the execution level. Bounded contexts observed that two teams sharing a term without shared authority over its meaning will diverge on that meaning, creating semantic drift at the domain level.

These traditions emerged from different problems, in different decades, for different audiences, and converged on the same structural answer: distributed decision-making produces drift. When a component or even an actor holds decision-making power beyond what its concern requires, it makes decisions that other components or actors are also making, and those decisions diverge.

## Measuring Authority Strength

Two properties measure how well an authority claim holds: how well the authority is contoured, and how strongly its boundary is enforced.

### Contour

Contour is the precision of the authority claim, calibrated by two conditions:

- **Behavioral coherence**: the authority's decisions, facts, and behaviors change together for the same reasons
- **Operational coherence**: no behavior inside the boundary needs to scale or fail independently of the others

CQRS, for example, splits read and write models for the same domain not because they are behaviorally incoherent, but because their operational envelopes are incompatible; reads run at far higher volume than writes.

A well-contoured authority can be named precisely: "OrderCheckoutService" tells you what it owns, while "OrderService" does not. Needing a follow-up explanation is the signal that contour might be misaligned.

### Bond

Bond is the enforcement strength of the boundary, measured by the consequence of bypass: what breaks when the boundary fails.

A strongly bonded authority has no known bypass; all interactions must go through its contract. A weakly bonded authority has routes around it such as direct database access, internal calls that skip validation, or shared state that circumvents the service layer. Bond strength is proportional to consequence. A payment processing boundary that is bypassed can produce corrupted financial state, while a read model that serves slightly stale data can tolerate a weaker bond.

## Style, Characteristics, and Team Topology

We can often be so focused on code and "architecture" that we forget that there is a much broader puzzle to solve, with each aspect affecting the others.

- **Architectural Characteristics** are the primary authority in any system design decision. They are the business priority values the system must honor: cost, security, availability, scalability, deployability, and the rest. Style and team topology are derived from them.
- **Architectural Style** is the structural arrangement of the system, chosen to honor the characteristics. Contour and bond measure whether authority in the code is correctly placed: whether the right components own the right decisions, and whether those boundaries hold under the pressures the characteristics describe.
- **Team Topology** is how the organization structures ownership and decision-making. We should measure authority here as well to see whether the teams have enough proximity to a domain to adapt: to draw and redraw the domain boundaries to sustain integrity and growth.

## Poor Contour Schedules Drift

Poor contour doesn't create a risk of drift. Under any sustained change activity, it schedules it.

When two components hold partial authority over the same concern, they evolve independently. Different teams touch them under different pressures, and neither has complete visibility into what the other owns.

### Early Optimization Locks In Miscontoured Authority

The most persistent variation arrives through early optimization. Before a domain's behavioral coherence is understood, structural decisions get made. Such as, services decomposed, schemas separated, and ownership assigned. These optimize for what is visible right now, like team size and deployment topology, rather than for behavioral coherence, which might only become clear under change pressure. Once deployed, the cost of realignment is high enough to defer indefinitely. The structure that was supposed to be provisional becomes load-bearing.

### The Correlation Between Decision and Consequence Is Hidden

Architectural arguments often fail because the failure they predict for the current system, and examined from previous systems, arrives years after, and the cost is rarely expressed in terms legible to the people who make the final call.

When a facade's validation rules and a domain service's rules diverge, people tend not to trace it back to the decision to put business logic in a routing layer (for example); they trace it to human error. When a decomposed architecture becomes expensive to change, no one traces it back to service boundaries drawn before behavioral coherence was understood; they trace it to team coordination.

The lag is measured in years, and by the time the drift is painful, the decision that caused it is no longer traceable to the people dealing with its consequences.

## Authority in Practice: An Order Workflow

An order workflow is a useful thread to follow; it touches most of the patterns where authority gets misplaced.

### No Authority Declared

The system starts as a single application. Order management, payment processing, inventory tracking, and user accounts share a codebase and a database.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│   CheckoutController       AdminController           │
│           │                       │                  │
│           └───────────┬───────────┘                  │
│                       │                              │
│           ┌───────────┴───────────────────┐          │
│           ▼                               ▼          │
│    OrderPaymentMgr ◄──────────► InventoryUserMgr     │
│           │                               │          │
│           └───────────┬───────────────────┘          │
│                       │                              │
│                   Shared DB                          │
└──────────────────────────────────────────────────────┘
```

Both controllers reach into the entire manager layer. `CheckoutController` calls `OrderPaymentMgr` to initiate a purchase and `InventoryUserMgr` to check stock. `AdminController` calls the same managers to modify orders, adjust inventory, and update accounts. The managers cross-call each other when they need data the other holds.

`OrderPaymentMgr` mixes order lifecycle logic with payment processing. `InventoryUserMgr` mixes stock management with user account concerns. Neither manager is contoured to a single domain; neither controller is contoured to a single workflow. And underneath all of it, a single database holds everything.

**Contour**: undefined. Behavioral coherence was never applied; `OrderPaymentMgr` conflates order lifecycle with payment processing, behaviors that change for entirely different reasons.
**Bond**: none. With no boundaries declared, the consequence of bypass is invisible; there is nothing to bypass and nothing to break until the system is large enough that the cost becomes unavoidable.

This is not inherently wrong for an early-stage system; the problem is not the monolith but that authority was never considered. When the system grows, there is nothing to grow from.

### Decomposition Without Authority

The team recognizes that `OrderPaymentMgr` and `InventoryUserMgr` are too broad and splits them into per-domain services. Each service deploys independently and owns its own code. They may even have separate schemas on the same database instance, or fully separate database instances. The infrastructure topology doesn't determine the authority structure; the data access patterns do.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│   CheckoutController       AdminController           │
│                                                      │
│    OrderService    PaymentService    InventorySvc    │
│         │               │                │           │
│    [orders DB]    [payments DB]    [inventory DB]    │
│         ▲               │                            │
│         └───────────────┘                            │
│          PaymentService reads orders data            │
│          directly across domain boundary             │
└──────────────────────────────────────────────────────┘
```

Contour has improved on paper: there are named services with named responsibilities. Bond has improved in structure but not in practice. Each service has its own schema, which declares a boundary. But PaymentService queries the orders schema directly, and that bypass exists for any service that knows the connection string. Each such query embeds the schema's shape into the consumer's code, so a data model change requires simultaneous updates across every service that queries it, which turns out to be all of them. The consequence surfaces not at the point of access but at the point of change.

**Contour**: named but not coherent. The names exist, but the boundaries weren't drawn along behavioral coherence lines; PaymentService queries order data because order state and payment decisions are tightly coupled in practice, and the boundary didn't account for that.
**Bond**: declared but bypassed. The consequence of cross-schema access was underestimated; it materializes the first time the order data model changes and every dependent service breaks with it.

This is the most common intermediate state: the full complexity of distributed services without the independence those services were supposed to deliver.

### Shared Authority Through a Facade

With services now decomposed but `CheckoutController` and `AdminController` still reaching across all of them, the team consolidates the entry point into a facade: a consumer-facing API that shapes responses and hides internal service structure.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│                      OrderFacade                     │
│               [validates order here]                 │
│                  │                │                  │
│                  ▼                ▼                  │
│            OrderService      PaymentService          │
│         [also validates]          │                  │
│                  │                │                  │
│            [orders DB]       [payments DB]           │
└──────────────────────────────────────────────────────┘
```

The facade validates order requests before passing them to OrderService. But OrderService also validates orders at the domain level, as it must. The same business rules now live in two places. When a rule changes (say, orders above a certain value require a manual approval step), both the facade and the domain service need to update. One gets updated; the other doesn't. Now clients going through the facade see one behavior and any direct caller of OrderService sees another.

Neither layer is clearly the authority. Both claim to be.

**Contour**: split across two behavioral concerns. Validation rules change when business requirements change; response shaping changes when clients change. Behavioral coherence says these belong to different authorities, but the facade holds both.
**Bond**: split across two enforcement points. The consequence is inconsistent behavior; the rule a caller sees depends on which enforcement point their request path reaches first.

A facade holds clear authority over presentation concerns: routing, shaping, and aggregating results. The moment it acquires business logic, it becomes a second authority over the domain; divergence is not a risk to manage but the mechanical consequence of the split. The fix is not to remove the facade but to clarify what it owns.

### Domain-Driven Decomposition

When the migration completes, each domain exclusively owns its data and has modeled its own aggregate root: the object that controls all access to entities within its boundary.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐        │
│  │  OrderService    │    │  PaymentService  │        │
│  │                  │    │                  │        │
│  │  OrderAggRoot    │───►│  PaymentAggRoot  │        │
│  │                  │    │                  │        │
│  │  [orders DB]     │    │  [payments DB]   │        │
│  └──────────────────┘    └──────────────────┘        │
└──────────────────────────────────────────────────────┘
```

An order's state can only change through the Order aggregate root: `Order.Accept()`, `Order.Fulfill()`, `Order.Cancel()`. The aggregate root enforces the invariants that govern those transitions. PaymentService cannot read the orders table; if it needs order data, it calls the Order context's service boundary.

**Contour**: named and coherent. Order lifecycle, payment processing, and inventory management each change for different reasons; the boundaries reflect that behavioral coherence.
**Bond**: strong, proportional to the consequence of bypass. State transitions through aggregate roots carry high consequence if violated; the aggregate root enforces accordingly.

### Reporting Access Breaks the Bond

The order system is performing well, but dashboard queries against order data are putting load on OrderService. The team grants the reporting service direct read access to the orders database: read-only, for dashboards only. Order state can still only change through the aggregate root.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐        │
│  │  OrderService    │    │ ReportingService  │        │
│  │                  │    │                  │        │
│  │  OrderAggRoot    │    │                  │        │
│  │                  │    │                  │        │
│  │  [orders DB]     │◄───│                  │        │
│  └──────────────────┘    └──────────────────┘        │
│   ReportingService reads orders DB directly;         │
│   schema now serves two unrelated access patterns    │
└──────────────────────────────────────────────────────┘
```

The contour is unchanged; OrderService still owns order lifecycle. The bond is weakened but the consequence of the bypass is low: a read cannot modify order state.

The `orders` table has grown large enough that query performance on the checkout flow degrades under load. The team designs a migration: split `orders` into `orders` (header: customer, status, timestamps) and `order_line_items` (per-item: SKU, quantity, price). The migration cannot proceed. The `order_summary` materialized view joins across columns that would be split into two tables, and the nightly export job selects from it in a pipeline the reporting team controls on a separate release schedule. Coordinating the schema change, the view update, and the export job across two teams and two release schedules stalls the migration for two quarters. The production schema cannot change freely because the reporting concern has an implicit claim on its shape.

**Bond**: violated. The aggregate root can no longer change the schema it's supposed to own without coordinating with a consumer that was never declared an authority over it. The `orders` table now serves two unrelated access patterns, and neither can evolve without the other.

The bond wasn't broken in one decision; it eroded through a sequence of locally reasonable choices: a performance bypass, then a convenience view, then queries that took dependencies on both. The cost surfaced not at the point of access but at the point of change.

### Reporting Access Through Contract

The corrected version keeps the production schema exclusively in OrderService's authority. Reporting access comes through the service's contract, not through the schema.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐        │
│  │  OrderService    │    │ ReportingService  │        │
│  │                  │    │                  │        │
│  │  OrderAggRoot    │───►│  [reporting DB]  │        │
│  │                  │    │                  │        │
│  │  [orders DB]     │    │                  │        │
│  └──────────────────┘    └──────────────────┘        │
│   production schema belongs to OrderService alone;   │
│   reporting store shaped for reporting access only   │
└──────────────────────────────────────────────────────┘
```

OrderService publishes order data to a reporting store it controls, whether through events, a scheduled export, or a dedicated read model.

**Contour**: coherent. OrderService owns order behavior and the production schema. ReportingService owns its read model.
**Bond**: maintained. The `orders` schema has no bypass; the reporting store is a separate authority over reporting-shaped data.

## Conclusion

The first four stages of that workflow represent authority misplaced at the outset. The reporting bypass is a different class of failure. It eroded through a sequence of locally reasonable decisions: a read bypass for performance, a convenience view, and queries that took dependencies on both. The cost surfaced not when those decisions were made but when the schema needed to change.

The vocabulary of contour and bond are critical not just at design time but as a check at every point the architecture evolves.

Architectural disagreements about service boundaries, consistency models, and pattern choice, traced far enough, are arguments about authority that the participants haven't recognized as such. Making the authority framing explicit doesn't resolve the argument automatically, but it changes what the argument is about: from aesthetic preference or pattern-matching to a structural position that can be examined, challenged, and shown to be wrong. Contour and bond give that examination tangible articulation.