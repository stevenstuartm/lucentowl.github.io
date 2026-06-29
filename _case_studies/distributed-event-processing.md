---
layout: case-study
title: "When Architecture Patterns Don't Match the Problem"
subtitle: "Lessons from three attempts to build a distributed event processing platform"
description: "A fintech company built three successive solutions to process millions of financial events for real-time alerts. Each failed for different technical reasons, but the same organizational pattern persisted. This case study examines what went wrong and what should have been built instead."
role: "Software Developer → Senior Developer"
date: 2023-01-01
involvement: "Solutions 2 and 3"
headline_metric: "6 Years, 3 Failures"
headline_detail: "Same org problem, different tech"
category: "failure"
category_label: "Failure Analysis"
technologies:
  - AWS SQS
  - AWS EventBridge
  - AWS DynamoDB
  - Akka
  - Microservices
---

## Executive Summary

Over six years, a fintech company built three successive solutions to process millions of financial transaction events for real-time customer alerts. Each solution lasted approximately two years before stakeholders demanded change. Each failed for different technical reasons, but a common organizational pattern persisted throughout: development teams remained out of alignment with stakeholder needs, and that gap was never closed.

I joined during Solution 2 and remained through Solution 3.

## Solutions at a Glance

| Solution | Architecture | Why It Failed | Why It Was Abandoned |
|----------|--------------|---------------|----------------------|
| **1. Monolith** | Legacy scheduler, non-containerized | Opaque, no extension points, manual scaling | Couldn't support multi-team extensibility |
| **2. Coordinator** | Central coordinator + domain processors | Implementation bugs (deadlocks, scaling issues) | Deemed too expensive to refactor |
| **3. Pipes & Filters** | Distributed actors, SQS, Akka | Pattern mismatch, no observability, message bloat | SLA violations, customer payouts |

## The Business Context

The company operated as an intermediary layer between banks, credit unions, and end users. Rather than requiring smaller financial institutions to build their own user interfaces and complex integrations, the platform provided a rich UI experience backed by transaction processing infrastructure.

The primary feature under development was real-time transaction alerts: customers subscribe to events on their accounts, and they receive email or SMS notifications when transactions occur. The processing happened primarily after transactions had been accepted by the financial institutions.

**Scale and constraints:**
- Millions of financial transaction events to process
- 8+ development teams needing to plug processors and workflows into the platform
- Financial compliance requirements demanding audit trails and reliability
- Customer SLAs with real monetary penalties for failures

## Solution 1: The Monolith

The first attempt was a monolithic system built around a legacy scheduler. The architecture was poorly documented and poorly understood by the teams who inherited it.

**Why it failed:**
- Teams could not plug their processors and workflows into the existing infrastructure
- The system's behavior was opaque, making modifications risky
- No clear extension points existed for new functionality
- Scaling required manual configuration and human intervention rather than automated elasticity
- Non-containerized infrastructure made scaling expensive and slow

After approximately two years, stakeholders demanded change. The diagnosis was correct: the monolith couldn't support multi-team extensibility or cost-effective scaling. The prescription was a move to microservices.

## Solution 2: The Coordinator

The second solution introduced a microservices architecture with a central coordinator pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Central Coordinator                       │
│          (Queue management, event brokering)                 │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Domain Processor │ │ Domain Processor │ │ Domain Processor │
│    (Team A)      │ │    (Team B)      │ │    (Team C)      │
│                  │ │                  │ │                  │
│ Registers metadata│ │ Registers metadata│ │ Registers metadata│
│ for alert UI     │ │ for alert UI     │ │ for alert UI     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Each processor registered its metadata with the coordinator, which the alert management UI used to show customers what alerts were available.

**What worked:**
- Central location for audit and retry logic
- Each processor was a holistic domain processor owned by a single team
- Simple to understand: clear data flow, clear ownership
- Easy to reason about scaling at the coordinator level

**Why it was abandoned:**
- The implementation was poorly coded, leading to connection deadlocks
- The service wasn't designed to scale horizontally
- Queues were not used properly, creating resource exhaustion
- A refactor was deemed too expensive

The architecture's value was that it hadn't overextended itself. A simpler design leaves room to evolve: you can fix the implementation, add layers incrementally, or migrate components without wholesale replacement. Rather than investing in that path, the organization chose to start over with something more complex. That decision proved costly.

## Solution 3: Pipes & Filters

The third solution adopted a distributed pipes and filters architecture. Each actor had complete autonomy: its own authentication, its own AWS SQS access, and its own scaling behavior via Akka. A single central service handled subscriptions, metadata, and workflow registration, but communication between actors was distributed via SQS rather than synchronous API calls.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Central Registration Service                            │
│                                                                              │
│    Subscriptions    │    Metadata (UI)    │    Workflow (Parent/Child)      │
│                                                                              │
│                         All in-memory registration                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    Actors register on startup (concurrency bugs)
                                    │
                         ┌──────────┴──────────┐
                         │    Event Source     │
                         └──────────┬──────────┘
                                    │
                                   SQS
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │   Actor A   │──SQS──│   Actor B   │──SQS──│   Actor C   │
       │  (SQS+Auth) │       │  (SQS+Auth) │       │  (SQS+Auth) │
       │  DynamoDB   │       │  DynamoDB   │       │  DynamoDB   │
       │  Akka scale │       │  Akka scale │       │  Akka scale │
       └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
              │                     │                     │
             SQS                   SQS                   SQS
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │   Actor D   │       │   Actor E   │       │   Actor F   │
       │  (SQS+Auth) │       │  (SQS+Auth) │       │  (SQS+Auth) │
       │  DynamoDB   │       │  DynamoDB   │       │  DynamoDB   │
       └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
                                   SQS
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │    Notification Service    │
                    └───────────────────────────┘
```

Instead of using AWS EventBridge for fan-out, a custom solution was built to register parent/child processor relationships via the central registration service. Actors registered themselves with this single service on startup, which introduced concurrency bugs and created a single point of failure for subscriptions, metadata, and workflow routing.

**What worked:**
- Clean, well-structured code with good unit tests
- Queue-based communication throughout
- Testable locally using LocalStack
- DynamoDB for ephemeral workflow data

**What failed:**

| Problem | Impact |
|---------|--------|
| **Message bloat**: Actors added entire new context to payloads instead of transforming them | Enormous network costs, bandwidth exhaustion |
| **No centralized control**: Each actor operated independently with no coordination | Impossible to audit, conflicted with financial compliance needs |
| **Custom fan-out**: Built parent/child registration instead of using EventBridge | Concurrency bugs during startup, unnecessary complexity |
| **Shared infrastructure**: Actors ran on the same tier as UI APIs | Processing spikes caused UI unavailability |
| **DLQs unused**: Dead letter queues were added but never monitored or processed | Lost events in a financial system |
| **No observability**: No centralized monitoring or alerting | Weeks passed before critical problems were detected |
| **Noisy neighbors**: One tenant could consume most of an actor's processing capacity | Unfair resource allocation, SLA violations |
| **SQS visibility timeout games**: Constant tuning to account for processing latency | Fragile configuration, message reprocessing |
| **Coupled deployments**: Any change required updating every actor simultaneously | Massive deployment cost, developer burnout |
| **No rollback capability**: Pipes and filters provides no saga pattern | Failed workflows left partial state with no compensation |

After approximately two years, the accumulated failures led to SLA violations and significant customer payouts. Problems went undetected for weeks because there was no observability; by the time issues were discovered, the damage was done.

## Why Pipes & Filters Was Wrong

The pipes and filters pattern makes specific assumptions about how data flows through a system:

| Pattern Assumption | Reality in This System |
|--------------------|------------------------|
| Each filter performs a stateless transformation | Actors added unrelated context; they didn't transform |
| Filters are independent and composable | Actors required access to shared concepts and integrations |
| Scaling is per-filter based on throughput | Per-actor Akka scaling made bottlenecks invisible |
| Failure handling is per-filter | No saga support meant partial failures couldn't roll back |

The pattern was selected without formal trade-off analysis. Development teams weren't allowed to see the proposal, and no documentation explained why this architecture was chosen or what trade-offs were accepted.

Financial systems require audit trails; pipes and filters distributes control. The use case wasn't transformation but enrichment and routing. Multi-tenant systems need fair resource allocation; per-actor scaling can't provide it. Fan-out complexity pointed to EventBridge, not custom registration.

## The Organizational Pattern That Never Changed

Across all three solutions, the same dynamic persisted. Stakeholders demanded "change" every two years, but actual requirements were never crystallized in a way that could be validated. Each solution was a technical response to stakeholder frustration rather than a deliberate answer to clearly defined needs. Architecture decisions were made without documented rationale, and the teams building those systems weren't given visibility into the choices shaping their work.

No architecture can fix an alignment problem. The pattern persisted because the organizational issue was never addressed.

## What Should Have Been Built

### Separate Concerns Cleanly

```
┌───────────────────────────────────────┐
│           Alert Management UI          │
│      (Customer subscription mgmt)      │
└───────────────────┬───────────────────┘
                    │ reads
                    ▼
┌───────────────────────────────────────┐      ┌─────────────────────────┐
│       Alert Feature Metadata DB        │◀─────│   Versioned Migration   │
│         (Available alert types,        │      │        Tasks            │
│          subscription options)         │      │  (No code deployment)   │
└───────────────────────────────────────┘      └─────────────────────────┘

                    ║ No coupling - UI metadata is completely
                    ║ separate from event processing
                    ╨

┌───────────────────────────────────────┐
│           Transaction Events           │
│         (From financial systems)       │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                          AWS EventBridge                               │
│                (Fan-out routing, no custom registration)               │
└──────────┬────────────────────┬────────────────────┬──────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Domain Processor │  │ Domain Processor │  │ Domain Processor │
│    (Team A)      │  │    (Team B)      │  │    (Team C)      │
│                  │  │                  │  │                  │
│ Just processes.  │  │ Just processes.  │  │ Just processes.  │
│ No registration. │  │ No registration. │  │ No registration. │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Alert feature metadata and subscriptions live in a versioned database, updated via separate migration tasks rather than code deployments. The UI reads what alerts are available, customers subscribe through this service, and processors query it to determine which customers to notify. The subscription service is a stable API that processors consume, not something processors register with.

EventBridge handles fan-out routing through infrastructure-as-code rules, eliminating custom parent/child registration and the concurrency bugs that came with it. Processors don't self-register on startup. When workflows span domains, eventful choreography replaces orchestration: each domain publishes events to EventBridge when its work completes, and other domains subscribe to what they care about.

### Distribute Only What Needs It

Solution 2 got the team ownership model right: each domain team owns their processor. Distribution is an optimization, not a starting point, and there was never a proven need to distribute work beyond single domain processors. Start simple, measure actual bottlenecks, then optimize.

### Queuing Strategy Depends on Ordering Requirements

For domains where events can be processed in any order, [SQS Fair Queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fair-queues.html){:target="_blank" rel="noopener noreferrer"} provide automatic noisy-neighbor mitigation by setting `MessageGroupId` to the tenant ID. This would have solved the noisy-neighbor problem in Solution 3 with zero implementation effort.

For domains requiring strict ordering, SQS FIFO throughput constraints create back-pressure during spikes. The alternative is to persist events first (DynamoDB with TenantID as partition key and timestamp as sort key) and consume at a configurable rate per tenant. This gives FIFO semantics per tenant without FIFO queue constraints, makes backlogs visible for predictive scaling, and gives processors explicit control over tenant fairness rather than fighting queue configuration.

### Domain-Centric Configuration and Observability

Configuration should be tied to business domain concepts, not component deployments. When support teams work with domain concepts instead of topology, component architecture can change freely underneath without breaking their mental model or their tooling.

And observability cannot be optional in financial systems. Each domain processor should audit all activity asynchronously, feeding into centralized monitoring. Problems found weeks after they begin are problems that trigger SLA payouts first.

## Conclusion

The cycle could have been broken at Solution 2, not because Solution 2 was good, but because it hadn't painted itself into a corner. A flawed but flexible architecture can be iteratively improved; an overextended one requires starting over.

Technical excellence matters, and Solution 3 had clean code and good tests. But technical excellence in service of the wrong pattern still fails. The architectural answers were available from the start: simple domain processors, actual measurements before distributing anything, and observability built in from day one. What wasn't available was the organizational alignment to act on them, and no architecture could substitute for that.
