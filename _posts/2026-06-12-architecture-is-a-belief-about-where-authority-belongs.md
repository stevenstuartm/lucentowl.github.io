---
layout: post
title: "Architecture Is a Belief About Where Authority Belongs"
date: 2026-06-12
description: "SOLID, normalization, least privilege, and bounded contexts share a structural belief: that where authority lives determines what the system can absorb. This post develops that into two properties for judging an authority claim, contour and bond, and traces through an order workflow how authority gets misplaced at the outset and how, once correctly placed, it erodes through locally reasonable optimizations."
tags: [architecture, design-patterns, solid, software-design, system-design, ddd]
author: steven-stuart
sources:
  - title: "Robert C. Martin, The Single Responsibility Principle"
    url: "https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html"
  - title: "E. F. Codd, A Relational Model of Data for Large Shared Data Banks (1970)"
    url: "https://dl.acm.org/doi/10.1145/362384.362685"
  - title: "Jerome Saltzer and Michael Schroeder, The Protection of Information in Computer Systems (1975)"
    url: "https://www.cs.virginia.edu/~evans/cs551/saltzer/"
  - title: "Martin Fowler, BoundedContext"
    url: "https://martinfowler.com/bliki/BoundedContext.html"
  - title: "Mark Richards and Neal Ford, Fundamentals of Software Architecture"
    url: "https://www.oreilly.com/library/view/fundamentals-of-software/9781492043447/"
  - title: "Melvin Conway, How Do Committees Invent? (1968)"
    url: "https://www.melconway.com/Home/Committees_Paper.html"
---

When I encounter a system or data design decision I'm unsure about, I endeavor to ask the same thing: **where does authority live, and how bounded is it**?

## Where Authority Belongs

Authority in a software system is the assignment of decision-making power. Something is authoritative over data when it is the canonical source of truth, and authoritative over a behavior when it is the only thing that can legitimately enforce it. Every design encodes a belief about where authority belongs, and that belief shapes what the system can absorb when it changes.

The best practices across software engineering are each a response to a specific observed failure. Robert C. Martin's Single Responsibility Principle observed that a class holding authority over two concerns forces reasoning about both when either changes, producing behavioral drift at the class level. Database normalization, from E. F. Codd's relational model, observed that a fact stored in two places produces an inconsistency when one is updated, causing data drift.

Least privilege reaches the same confinement from containment rather than drift. As Jerome Saltzer and Michael Schroeder framed it, it limits the damage an accident or error can do by confining each process to the power its job needs, so it can't act on state it doesn't own. Bounded contexts come from Eric Evans's domain-driven design, summarized in Martin Fowler's BoundedContext entry. They observed that two teams sharing a term without shared authority over its meaning will diverge on that meaning, creating semantic drift at the domain level. So a bounded context lets a term diverge on purpose across a boundary, with one meaning and one authority inside each context.

These traditions emerged from different problems, in different decades, for different audiences, and converged on the same structural answer: confine decision-making power to the concern that needs it, because distributed decision-making produces drift. When a component or even an actor holds decision-making power beyond what its concern requires, it makes decisions that other components or actors are also making, and those decisions diverge. Copies of data fed from a single owner's contract don't diverge this way, because only the owner decides.

## Assessing Authority Strength

Two properties assess how well an authority claim holds: how well the authority is contoured, and how strongly its boundary is enforced.

### Contour

Contour is the precision of the authority claim, calibrated by two conditions:

- **Behavioral coherence**: the authority's decisions, facts, and behaviors change together for the same reasons
- **Operational coherence**: no behavior inside the boundary needs to scale or fail independently of the others, close to Mark Richards and Neal Ford's architecture quantum

CQRS, for example, can split read and write models for the same domain even when they are behaviorally coherent, because their operational envelopes are incompatible. Reads often run at far higher volume than writes. Behavioral coherence alone would keep them together.

A well-contoured authority can be named precisely: "OrderCheckoutService" tells you what it owns, while "OrderService" does not until its boundary states which order decisions belong to it. The test behind the name is the list of decisions only this component may make, and a list that needs exceptions or an "and also" signals that contour might be misaligned.

### Bond

Bond is the enforcement strength of the boundary. The strength a boundary needs is set by the consequence of bypass. That consequence has two parts: the damage a bypass can do to state when it is used, and the coupling it creates that someone pays for when the owner next changes.

A strongly bonded authority has no known bypass, so all interactions go through its contract. A weakly bonded authority has routes around it such as direct database access, internal calls that skip validation, or shared state that circumvents the service layer. A payment processing boundary that is bypassed can produce corrupted financial state, while a read model that serves slightly stale data can tolerate a weaker bond.

A read-only bypass does little damage to state but can still create heavy coupling, because every consumer of a table's shape is a party to its next migration. Weighing both parts flags the familiar shared-database anti-pattern when access is granted, not later when a migration stalls.

## Characteristics Should Drive Style and Team Topology

We can often be so focused on code and "architecture" that we forget that there is a much broader puzzle to solve, with each aspect affecting the others. The same authority judgment applies to the teams that own the code.

- **Architecture Characteristics**, the term Richards and Ford use in *Fundamentals of Software Architecture*, should be the primary driver of any system design decision. They are the business priority values the system must honor: cost, security, availability, scalability, deployability, and the rest. Style and team topology should be derived from them.
- **Architectural Style** is the structural arrangement of the system, chosen to honor the characteristics. Contour and bond assess whether authority in the code is correctly placed under the pressures the characteristics describe.
- **Team Topology** is how the organization structures ownership and decision-making. Melvin Conway's law shows the derivation often runs in reverse, as systems mirror their builders' communication structure. The inverse Conway maneuver, shaping teams to reach a target architecture, is that derivation done on purpose. We should assess authority here as well to see whether the teams have enough proximity to a domain to adapt: to draw and redraw the domain boundaries to sustain integrity and growth. A team owning two behaviorally incoherent domains has poor contour just as a class does.

## Poor Contour Schedules Drift

Poor contour doesn't create a risk of drift. Under sustained change to the concerns it conflates, it schedules it.

When two components hold partial authority over the same concern, they evolve independently. Different teams touch them under different pressures, and neither has complete visibility into what the other owns. The same drift happens when one component holds authority over two concerns. Once two stakeholder groups request its changes, each change is made and checked under one group's pressure.

### Early Optimization Locks In Miscontoured Authority

A persistent source of poor contour is early optimization. Before a domain's behavioral coherence is understood, structural decisions get made: services decomposed, schemas separated, and ownership assigned. These optimize for what is visible now, like team size and deployment topology, rather than for behavioral coherence, which might only become clear under change pressure. Once deployed, the cost of realignment is high enough to defer indefinitely. The structure that was supposed to be provisional becomes load-bearing.

### The Correlation Between Decision and Consequence Is Hidden

Architectural arguments often fail because the failure they predict arrives years later, and its cost is rarely expressed in terms legible to the people who make the final call.

Because of that lag, when a facade's validation rules and a domain service's rules diverge, people tend not to trace it back to the decision to put business logic in a routing layer. They trace it to human error. When a decomposed architecture becomes expensive to change, teams rarely trace it back to service boundaries drawn before behavioral coherence was understood. They trace it to team coordination.

By the time the drift is painful, the people who drew the boundary have often moved on, and the decision that caused it is no longer traceable to the people dealing with its consequences.

## Authority in Practice: An Order Workflow

An order workflow, built here as an illustration rather than a case history, is a useful thread because it touches most of the patterns where authority gets misplaced.

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

`InventoryUserMgr` mixes stock management with user account concerns. Neither manager is contoured to a single domain; neither controller is contoured to a single workflow.

**Contour**: undefined. Behavioral coherence was never applied. `OrderPaymentMgr` conflates order lifecycle with payment processing, behaviors that change for different reasons.

**Bond**: none. With no boundaries declared, the consequence of bypass is invisible. There is nothing to bypass and nothing to break until the system is large enough that the cost becomes unavoidable.

This is not inherently wrong for an early-stage system. The problem is not the monolith but that authority was never considered. When the system grows, there is nothing to grow from.

### Decomposition Without Authority

The team recognizes that `OrderPaymentMgr` and `InventoryUserMgr` are too broad and splits them into per-domain services. Each service deploys independently and owns its own code.

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

Contour has improved on paper: there are named services with named responsibilities. Bond has improved in structure but not in practice. Each service has its own schema, which declares a boundary. But PaymentService queries the orders schema directly, and that bypass exists for any service that knows the connection string. Each such query embeds the schema's shape into the consumer's code, so a data model change requires simultaneous updates across every service that queries it. Separate schemas or database instances don't determine authority. The data access patterns do.

**Contour**: named but not coherent. PaymentService queries order data because order state and payment decisions are tightly coupled in practice, and the boundary didn't account for that.

**Bond**: declared but bypassed. The consequence of cross-schema access was underestimated.

This is a common intermediate state: the full complexity of distributed services without the independence those services were supposed to deliver.

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

**Bond**: split across two enforcement points. The consequence is inconsistent behavior.

A facade holds clear authority over presentation concerns: routing, shaping, and aggregating results. Checks on shape and syntax fit there too, because they don't change when business rules do. The moment it acquires business logic, it becomes a second authority over the domain, and divergence is no longer a risk to manage but the mechanical consequence of the split.

Contract tests or a shared rule module narrow the gap, but layers that deploy separately can run different versions. Only delegating the check to the domain's own endpoint closes it. The fix is not to remove the facade but to clarify what it owns.

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

An order's state can only change through the Order aggregate root: `Order.Accept()`, `Order.Fulfill()`, `Order.Cancel()`. The aggregate root enforces the invariants that govern those transitions. PaymentService cannot read the orders table. If it needs order data, it calls the Order context's service boundary. OrderService requests payment through PaymentService's contract.

**Contour**: named and coherent. OrderService's decisions are the transitions above, with no "and also". Order lifecycle, payment processing, and inventory management each change for different reasons, and the boundaries reflect that behavioral coherence.

**Bond**: strong, proportional to the consequence of bypass. State transitions through aggregate roots carry high consequence if violated, so the aggregate root enforces accordingly.

### Reporting Access Breaks the Bond

The order system is performing well, but dashboard queries against order data are putting load on OrderService. The team grants the reporting service direct read access to the orders database: read-only, for dashboards only.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐        │
│  │  OrderService    │    │ ReportingService │        │
│  │                  │    │                  │        │
│  │  OrderAggRoot    │    │                  │        │
│  │                  │    │                  │        │
│  │  [orders DB]     │◄───│                  │        │
│  └──────────────────┘    └──────────────────┘        │
│   ReportingService reads orders DB directly;         │
│   schema now serves two unrelated access patterns    │
└──────────────────────────────────────────────────────┘
```

The contour is unchanged. OrderService still owns order lifecycle. The bond is weakened, and the team judges the consequence low because a read cannot modify order state. That judgment weighs only the first part of the consequence.

Later, the reporting team adds an `order_summary` materialized view over the `orders` table, then a nightly export job that selects from that view.

The `orders` table has grown large enough that query performance on the checkout flow degrades under load. The team designs a migration: split `orders` into `orders` (header: customer, status, timestamps) and `order_line_items` (per-item: SKU, quantity, price). The migration cannot proceed. The `order_summary` view joins across columns that would be split into two tables, and the export job runs in a pipeline the reporting team controls on a separate release schedule. Coordinating all three changes across two teams and two release schedules stalls the migration for two quarters.

The production schema cannot change freely because the reporting concern has an implicit claim on its shape. An expand-and-contract migration with a compatibility view could unblock it, but someone must own and retire that view, and owning it declares reporting as a consumer.

**Bond**: violated. The aggregate root can no longer change the schema it's supposed to own without coordinating with a consumer that was never declared an authority over it.

The bond wasn't broken in one decision; it eroded through a sequence of locally reasonable choices: a performance bypass, then a convenience view, then queries that took dependencies on both. The cost surfaced not at the point of access but at the point of change.

### Reporting Access Through Contract

The corrected version keeps the production schema exclusively in OrderService's authority.

```text
┌──────────────────────────────────────────────────────┐
│                   OrderApplication                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────┐        │
│  │  OrderService    │    │ ReportingService │        │
│  │                  │    │                  │        │
│  │  OrderAggRoot    │───►│  [reporting DB]  │        │
│  │                  │    │                  │        │
│  │  [orders DB]     │    │                  │        │
│  └──────────────────┘    └──────────────────┘        │
│   production schema belongs to OrderService alone;   │
│   reporting store shaped for reporting access only   │
└──────────────────────────────────────────────────────┘
```

OrderService publishes order data through a contract it controls, whether events, a scheduled export, or a dedicated read model, and ReportingService builds its own store from that contract. The `orders` split from the previous stage would change only OrderService's mapping into that contract, with no coordination across release schedules.

The price is a reporting feed OrderService's team must build and version, and changes to what an order means still need coordination, through a contract OrderService owns. Bond need only match the consequence, so where `orders` rarely changes, a read replica with a declared schema contract and a named owner for downstream breakage can be bond enough.

**Contour**: coherent. OrderService owns order behavior and the production schema. ReportingService owns its read model.

**Bond**: maintained. The `orders` schema has no bypass.

## Contour and Bond as a Standing Check

Contour and bond are critical not just at design time but as a check at every point the architecture evolves, through a few questions:

- **Can the decisions only this component makes be listed without exceptions or an "and also"?**
- **Does everything inside the boundary change for the same reasons, and can it scale and fail as one unit?**
- **What routes around the contract exist?**
- **What breaks if each route is used, now or at the owner's next change, and does enforcement match that consequence?**
- **When a change makes a bypass convenient, who would have to coordinate the next schema change?** If the answer includes a team that was never declared an authority, the bond is already eroding.

Not every architectural disagreement is about authority. A choice between synchronous and asynchronous calls inside settled ownership is a tradeoff among latency, cost, and availability. But many disagreements about service boundaries, data ownership, and pattern choice, traced far enough, are arguments about authority that the participants haven't recognized as such. Making the authority framing explicit doesn't resolve the argument automatically, but it changes what the argument is about. Aesthetic preference or pattern-matching becomes a structural position that can be examined, challenged, and shown to be wrong. Contour and bond give that examination tangible articulation.
