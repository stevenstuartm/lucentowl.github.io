---
layout: guide
title: "Orchestration and Choreography Patterns"
category: Architecture
subcategory: Patterns
description: "Coordinating a business process across services: centralized orchestration against event-driven choreography, and the saga pattern that keeps a multi-service transaction consistent through compensation."
tags: [practical, saga, orchestration, choreography, compensating-transaction, workflow]
---

A business process that touches four services has to be driven by something. Orchestration and choreography are the two answers to where that something lives: in one service that calls the others in order, or in the services themselves, each reacting to what the previous one announced.

The saga pattern is a different question layered on top. Orchestration and choreography decide who drives the process. A saga decides what happens when the process gets halfway through and fails, which matters whenever the steps have already changed data in databases no single transaction can reach. A saga can be built either way, so these are two choices, not three.

## Orchestration

One service holds the workflow. It calls each participant in turn, holds the state of the process between calls, and decides what happens when a call fails. Participants expose operations and know nothing about the process they are part of.

```
Order Orchestrator:
  1. Call Payment Service     → wait for response
  2. Call Inventory Service   → wait for response
  3. Call Shipping Service    → wait for response
  4. Call Notification Service
  5. On any failure, run the compensation for every completed step
```

**Use when**:
- The process has enough steps, branches, and retries that nobody can hold the whole thing in their head
- Someone needs to answer "where is order 4471 right now" without correlating logs
- Failure handling differs step by step rather than being uniform
- The sequence itself is a business rule that changes on its own schedule

**Example**: An order fulfillment process where the orchestrator takes payment, reserves inventory, arranges shipping, and notifies the customer, in that order, and unwinds what it has done if a step fails.

**Trade-offs**: The orchestrator knows every participant, so it accumulates the coupling the participants shed, and a workflow change usually means changing and redeploying it. It also sits on the path of every process it runs, which makes it both a bottleneck under load and a component whose failure stops work that the participants themselves could have done. Pushed far enough, an orchestrator that holds all the logic and calls services that hold none is a monolith with network calls in the middle.

Dedicated workflow engines exist because the state handling is the hard part rather than the calling. AWS Step Functions, Temporal, and Camunda all persist workflow state, resume after a crash, and handle retries and timeouts, which is most of what a hand-written orchestrator gets wrong.

---

## Choreography

No service owns the process. Each one does its work, publishes an event saying what it did, and other services react to the events they care about. The workflow exists only as the sum of those reactions.

```
Order Service → OrderCreated event → Event Bus
                                         ↓
          ┌──────────────┬──────────────┼──────────────┐
          ↓              ↓              ↓              ↓
    Inventory      Payment         Shipping      Notification
    Service        Service         Service        Service
```

**Use when**:
- Steps are genuinely independent and don't need to happen in a fixed order
- New participants should be able to join by subscribing, without a change anywhere else
- Services are owned by teams that shouldn't have to coordinate a release to add a reaction
- The process is short enough that no one needs a central view of it

**Example**: Placing an order publishes `OrderCreated`, and the inventory, payment, shipping, and notification services each pick it up and act without anything telling them to.

**Trade-offs**: The process exists but is written down nowhere, so understanding it means reading every subscriber, and answering what happened to one order means correlating events across services. Adding a subscriber is easy in exactly the way that makes cycles easy to create, where service A's event triggers B, whose event triggers A. Failure handling is also distributed, so each participant has to decide for itself what to do about a step it didn't perform and can't see.

---

## Choosing Between Them

|  | Orchestration | Choreography |
|---|---------------|--------------|
| Where the workflow is written | In one place, as explicit steps | Nowhere, so it emerges from what each service subscribes to |
| Adding a step | Change and redeploy the orchestrator | Deploy a new subscriber, often touching nothing else |
| Finding out what happened | Read the orchestrator's state for that instance | Correlate events across services, which needs tracing to be bearable |
| Who knows about whom | The orchestrator knows every participant; participants know nobody | Nobody knows anybody, but everybody knows the event shapes |
| How it fails badly | Becomes a bottleneck, or a monolith with the services as libraries | Becomes an undocumented workflow with cycles nobody designed |

The split is not usually all-or-nothing. A common arrangement orchestrates the part of a process that has a required order and real compensation, and lets everything downstream of it, such as notifications, analytics, and search indexing, happen by choreography.

---

## Saga

*Introduced by Hector Garcia-Molina and Kenneth Salem (1987), and adapted for microservices by Chris Richardson among others*

A saga is a sequence of local transactions, each committed in one service's own database, with a compensating action defined for each one. If a later step fails, the saga runs the compensations for the steps that already committed, in reverse order.

**The problem it solves**: In a single database, one transaction covers every write and either all of it happens or none does. Across services with separate databases, there is no such transaction. Two-phase commit exists, but it holds locks across every participant for the whole duration and stalls if the coordinator dies mid-commit, and the datastores services actually use, including document stores, message brokers, and many managed cloud services, frequently don't offer it at all.

```
Monolith (single transaction):          Microservices (no shared transaction):
┌─────────────────────────────────┐     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ BEGIN TRANSACTION               │     │ Order       │  │ Payment     │  │ Inventory   │
│   INSERT order                  │     │ Service     │  │ Service     │  │ Service     │
│   UPDATE inventory              │     │ (own DB)    │  │ (own DB)    │  │ (own DB)    │
│   INSERT payment                │     └─────────────┘  └─────────────┘  └─────────────┘
│ COMMIT (all or nothing)         │           │               │               │
└─────────────────────────────────┘           └───────────────┴───────────────┘
                                              How do we make these consistent?
```

**How a saga runs**:

```
Happy Path (all steps succeed):

Step 1              Step 2              Step 3              Result
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│ Create   │──────→│ Reserve  │──────→│ Charge   │──────→│ Complete │
│ Order    │       │ Inventory│       │ Payment  │       │ Order    │
│ (pending)│       │          │       │          │       │ (confirm)│
└──────────┘       └──────────┘       └──────────┘       └──────────┘
    T1                 T2                 T3

Failure Path (step 3 fails, compensate in reverse):

Step 1              Step 2              Step 3 FAILS
┌──────────┐       ┌──────────┐       ┌──────────┐
│ Create   │──────→│ Reserve  │──────→│ Charge   │ ✗ Payment declined
│ Order    │       │ Inventory│       │ Payment  │
└──────────┘       └──────────┘       └──────────┘
                        │                   │
                        │    Compensate     │
                        │←──────────────────┘
                        ↓
                   ┌──────────┐       ┌──────────┐
                   │ Release  │←──────│ Cancel   │
                   │ Inventory│       │ Order    │
                   │ (C2)     │       │ (C1)     │
                   └──────────┘       └──────────┘
```

### Compensating Transactions

A compensation is not a rollback. The original transaction has committed and other work has happened since, so the compensation is a new transaction that makes business sense of the reversal rather than pretending the first one never ran.

| Original transaction | Compensation | Why it isn't a rollback |
|---------------------|--------------|-------------------------|
| Create order | Cancel order | The order id is already issued and may have been shown to the customer, so it is marked cancelled, not deleted |
| Reserve inventory | Release inventory | Other orders have reserved and released stock since, so the compensation returns quantity rather than restoring a prior state |
| Charge payment | Refund payment | A settled charge can't be withdrawn, so a refund is a separate movement of money that both parties can see |
| Send email | Send correction | Nothing can unsend it |

### Compensatable, Pivot, and Retriable

Not every step can be undone, which means a saga has a point of no return. Richardson's taxonomy names the three kinds of step, and identifying the pivot is the part of saga design that is easy to skip and expensive to get wrong.

- **Compensatable transactions** run before the point of no return and each have a compensation that can undo them.
- **The pivot transaction** is the go/no-go point. Once it commits, the saga is committed to finishing, so there is exactly one of these. It may be the last compensatable step, the first retriable one, or a step that is neither.
- **Retriable transactions** come after the pivot. They cannot be undone, so the saga has to keep retrying each one until it succeeds, which means they must be designed so that succeeding is always eventually possible.

```
T1: CreateOrder(items, customer)     → C1: CancelOrder(orderId)        compensatable
T2: ReserveInventory(items)          → C2: ReleaseInventory(items)     compensatable
T3: ChargePayment(customer, amount)  → C3: RefundPayment(...)          pivot
T4: ShipOrder(orderId)               → no compensation exists          retriable
T5: SendConfirmation(orderId)        → no compensation exists          retriable
```

Placing the pivot is a business decision rather than a technical one. Charging before shipping makes the charge the last reversible step, and everything after it has to be something the business is willing to retry until it works.

### Orchestrated and Choreographed Sagas

Both coordination styles from earlier in this guide apply to sagas, and the comparison table above holds here too. Compensation raises what is at stake, because failure handling is exactly what the two styles place differently.

**Orchestrated**: the orchestrator holds the saga state and calls compensations itself when a step fails.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Saga Orchestrator                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Saga State: { orderId: 123, step: "PAYMENT", status: OK }│   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Order   │   │Inventory│   │ Payment │   │Shipping │
    │ Service │   │ Service │   │ Service │   │ Service │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘

  1. OrderService.create()      → OK, orderId=123
  2. InventoryService.reserve() → OK
  3. PaymentService.charge()    → FAILED
  4. InventoryService.release() → OK   (compensating T2)
  5. OrderService.cancel()      → OK   (compensating T1)
```

**Choreographed**: each service reacts to events, and a failure event is what triggers the compensations upstream of it.

```
┌─────────┐  OrderCreated  ┌─────────┐ InventoryReserved ┌─────────┐
│ Order   │───────────────→│Inventory│──────────────────→│ Payment │
│ Service │                │ Service │                   │ Service │
└─────────┘                └─────────┘                   └─────────┘
     ↑                          ↑                             │
     │                          │                             │
     │    OrderCancelled        │    InventoryReleased        │ PaymentFailed
     └──────────────────────────┴─────────────────────────────┘

Each service listens for the events it cares about, commits its local
transaction, and publishes the result. A failure event tells every
upstream participant to run its own compensation.
```

The saga state in the choreographed version is implied by which events have been published and which have not, so there is no single place to query how far a given order has progressed. That is the cost people underestimate.

### When a Compensation Fails

Nothing compensates a compensation, so a failed compensation leaves the system in a state the saga cannot resolve on its own.

```
T1 ✓ → T2 ✓ → T3 ✗ → C2 ✗   (compensation itself failed)
```

Compensations therefore have to be retriable, which means they have to be idempotent, because a retry can't tell whether the previous attempt partly succeeded. `ReleaseInventory(orderId)` called twice must release the stock once. Where retries are exhausted, the remaining options are to escalate to a human with enough context to resolve it by hand, or to complete the saga forward if finishing is less damaging than staying half-done.

<div class="callout callout--warning">
<p class="callout__title">Saga Limitations</p>
<p><strong>No isolation.</strong> A saga's intermediate states are visible to everyone else, so another reader can see an order that exists with a payment that hasn't happened. Semantic locks, such as an explicit pending status that other operations check, are the usual answer.</p>
<p><strong>Every step doubles.</strong> N steps means N compensations to write, test, and keep correct as the business logic they reverse changes.</p>
<p><strong>The window is visible to everyone.</strong> The system is inconsistent for as long as the saga runs, which can be seconds or, where a step waits on a human or an external provider, considerably longer.</p>
</div>

---

## Quick Reference

| | What it decides | Reach for it when | Main cost |
|---|---|---|---|
| **Orchestration** | Where the workflow logic lives | The sequence is complex, or someone must be able to see process state | A component every process runs through, holding all the coupling |
| **Choreography** | Where the workflow logic lives | Participants are independent and should be addable without coordination | A workflow that exists nowhere and can only be reconstructed |
| **Saga** | What happens when a multi-service process fails partway | Steps commit to separate databases and a partial result is unacceptable | A compensation per step, no isolation, and a visible inconsistency window |
