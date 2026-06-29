---
layout: guide
title: "Orchestration and Choreography Patterns"
category: Architecture
subcategory: Patterns
description: "Compare centralized orchestration vs distributed choreography for coordinating complex business processes across multiple services with trade-offs and implementation patterns."
tags: [architecture, design-patterns, distributed-systems, microservices, workflow, transactions]
---

These patterns define how multiple services coordinate to complete complex business processes, either through centralized control (orchestration) or distributed coordination (choreography).

## Orchestration Pattern

<blockquote class="pull-quote">
<p>Centralized orchestration provides visibility and control at the cost of creating a coordination bottleneck.</p>
</blockquote>

Centralized approach where a single orchestrator service controls and coordinates the execution of multiple services in a specific sequence.

**Use When**:
- Need centralized control over business processes
- Complex workflows with multiple steps
- Require transaction-like behavior across services
- Need detailed workflow monitoring and error handling

**Considerations**:

- Orchestrator can become a single point of failure
- Risk of creating a distributed monolith
- May introduce performance bottlenecks

**Example**: Order fulfillment process where an orchestrator coordinates payment processing, inventory reservation, shipping arrangement, and customer notification in sequence.

```
Order Orchestrator:
  1. Call Payment Service → Wait for response
  2. If success, call Inventory Service → Wait for response
  3. If success, call Shipping Service → Wait for response
  4. If success, call Notification Service
  5. If any fail, execute compensation logic
```

**Implementation**: AWS Step Functions | Temporal | Camunda | Custom orchestrator

---

## Choreography Pattern

Distributed approach where each service knows when to act and what to do without central coordination, typically through event-driven communication.

**Use When**:
- Services can operate independently
- Don't need strict workflow control
- Want maximum decoupling between services
- Building event-driven architectures

**Considerations**:

- Difficult to monitor and debug workflows
- Complex error handling and compensation
- No central view of the business process

**Example**: E-commerce system where placing an order triggers events that cause inventory, payment, and shipping services to act independently without central coordination.

```
Order Service → OrderCreated event → Event Bus
                                         ↓
          ┌──────────────┬──────────────┼──────────────┐
          ↓              ↓              ↓              ↓
    Inventory      Payment         Shipping      Notification
    Service        Service         Service        Service
```

**Implementation**: Event brokers (Kafka, RabbitMQ, AWS EventBridge)

---

## Saga Pattern

*Pattern introduced by Hector Garcia-Molina and Kenneth Salem (1987), popularized for microservices by Chris Richardson and others*

A saga breaks a distributed transaction into a sequence of local transactions. Each service performs its local transaction and publishes an event or calls the next step. If any step fails, the saga executes compensating transactions in reverse order to undo the changes already made.

**The Problem Sagas Solve**:

In a monolith, a single database transaction can span multiple operations atomically. In microservices with separate databases, you can't use a single transaction. Traditional distributed transactions (2PC/XA) are slow, don't scale, and many databases don't support them.

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

**How a Saga Works**:

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

**Compensating Transactions**:

A compensating transaction undoes the effect of a previous step. It's not always a simple rollback—it's a semantic undo that makes business sense.

| Original Transaction | Compensating Transaction | Why Not Simple Rollback? |
|---------------------|-------------------------|-------------------------|
| Create order | Cancel order | Order ID already assigned, must mark cancelled not delete |
| Reserve inventory | Release inventory | Other orders may have reserved same items since |
| Charge payment | Refund payment | Can't undo a charge; must issue separate refund |
| Send email | Send correction email | Can't unsend; must send follow-up |

```
Example: Order saga with compensation

T1: CreateOrder(items, customer)     → C1: CancelOrder(orderId)
T2: ReserveInventory(items)          → C2: ReleaseInventory(items)
T3: ChargePayment(customer, amount)  → C3: RefundPayment(customer, amount)
T4: ShipOrder(orderId)               → C4: ??? (can't unship!)

Note: Some actions can't be compensated (shipping). These are called
"pivot transactions" - once executed, the saga must complete forward.
```

**Use When**:
- Need consistency across multiple services with separate databases
- Cannot use distributed transactions (2PC/XA)
- Business processes span multiple services
- You can define compensating actions for each step

**Implementation Approaches**:

**Orchestration-based Saga**: A central orchestrator tells each service what to do and handles failures.

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

Orchestrator:
  1. Call OrderService.create() → OK, orderId=123
  2. Call InventoryService.reserve(123) → OK
  3. Call PaymentService.charge(123) → FAILED
  4. Call InventoryService.release(123) → OK (compensate)
  5. Call OrderService.cancel(123) → OK (compensate)
  6. Return failure to client
```

**Choreography-based Saga**: Services react to events and publish their own events. No central coordinator.

```
┌─────────┐  OrderCreated  ┌─────────┐ InventoryReserved ┌─────────┐
│ Order   │───────────────→│Inventory│──────────────────→│ Payment │
│ Service │                │ Service │                   │ Service │
└─────────┘                └─────────┘                   └─────────┘
     ↑                          ↑                             │
     │                          │                             │
     │    OrderCancelled        │    InventoryReleased        │ PaymentFailed
     └──────────────────────────┴─────────────────────────────┘

Each service:
  1. Listens for events it cares about
  2. Performs its local transaction
  3. Publishes result event
  4. If it receives a failure event, publishes compensation event
```

| Approach | Pros | Cons |
|----------|------|------|
| Orchestration | Easy to understand workflow, centralized error handling, clear saga state | Orchestrator is coupling point, can become bottleneck |
| Choreography | Loose coupling, no single point of failure, services are independent | Hard to understand full workflow, difficult to debug, no central view |

**Handling Failures in Compensations**:

What if a compensating transaction fails? You can't compensate a compensation.

```
Saga failure during compensation:

T1 ✓ → T2 ✓ → T3 ✗ → C2 ✗ (compensation failed!)

Options:
1. Retry C2 with backoff (compensations should be idempotent)
2. Log for manual intervention
3. Forward recovery: try to complete saga anyway if possible

Best practice: Make compensations idempotent and retriable
  ReleaseInventory(orderId) should succeed even if called twice
```

<div class="callout callout--warning">
<p class="callout__title">Saga Limitations</p>
<p><strong>No isolation</strong>: Other transactions can see intermediate states (order exists but payment pending). Use semantic locks or "pending" states to handle this.</p>
<p><strong>Complexity</strong>: N steps means N compensating transactions to implement and test.</p>
<p><strong>Eventual consistency</strong>: System is temporarily inconsistent during saga execution.</p>
</div>

---

<div class="callout callout--tip">
<p class="callout__title">Choosing Between Patterns</p>
<p>Use orchestration when you need visibility into complex workflows and centralized error handling. Use choreography when service independence and loose coupling are more important than workflow visibility.</p>
</div>

## Quick Reference

### Pattern Comparison

| Pattern | Control | Coupling | Monitoring | Use Case |
|---------|---------|----------|------------|----------|
| **Orchestration** | Centralized | Medium-High | Easy | Complex workflows, strict control |
| **Choreography** | Distributed | Low | Difficult | Independent services, loose coupling |
| **Saga** | Either | Varies | Medium | Distributed transactions |

### Decision Framework

| Question | Pattern |
|----------|---------|
| Need strict workflow control? | Orchestration |
| Want loose coupling? | Choreography |
| Need distributed transactions? | Saga (choose orchestration or choreography based on other needs) |

### Trade-offs

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Orchestration</h4>
<p><strong>Pros:</strong></p>
<ul>
<li>Easy to monitor workflows</li>
<li>Clear workflow visualization</li>
<li>Centralized error handling</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>Single point of failure</li>
<li>Potential bottleneck</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Choreography</h4>
<p><strong>Pros:</strong></p>
<ul>
<li>Loose coupling</li>
<li>No single point of failure</li>
<li>High scalability</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li>Hard to monitor</li>
<li>Complex debugging</li>
<li>No workflow visibility</li>
</ul>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">Saga Pattern</p>
<p><strong>Pros:</strong> Maintains consistency without distributed transactions</p>
<p><strong>Cons:</strong> Complexity of compensating actions, eventual consistency</p>
</div>

---
