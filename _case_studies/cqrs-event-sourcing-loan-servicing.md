---
layout: case-study
title: "When Infrastructure Constraints Doom Sound Architecture"
subtitle: "How a SQL Server mandate undermined CQRS and Event Sourcing in a multi-tenant loan servicing platform"
description: "A loan servicing engine built with CQRS and Event Sourcing achieved every architectural benefit the patterns promise, until a business mandate to use only SQL Server created insurmountable performance problems at scale. This case study examines how infrastructure constraints can poison otherwise sound architectural decisions."
role: "Software Developer"
date: 2018-01-01
headline_metric: "$5M+ Abandoned"
headline_detail: "Right patterns, wrong infrastructure"
category: "failure"
category_label: "Failure Analysis"
technologies:
  - CQRS
  - Event Sourcing
  - SQL Server
  - Multi-Tenant
---

## Executive Summary

A financial services company built a loan servicing engine using CQRS and Event Sourcing. The architecture delivered remarkable benefits: complete audit trails, trivial bug reproduction through event replay, and clean separation of concerns. Testing became straightforward because all code was decoupled from server datetime and bound instead to event timestamps.

The problem began when business leadership refused to use any data storage other than SQL Server. At scale, event sourcing against a relational database became untenable. The team spent months attempting optimizations: table partitioning by tenant, query plan analysis, async command processing with background projection rebuilds. None of it was enough.

The project was eventually abandoned, having cost over $5 million to build. Both CQRS and Event Sourcing became poisoned in the minds of leadership and developers. The company replaced the system with a third-party solution that was measurably inferior by every metric, but by then confidence had been lost and no amount of evidence could restore it.

**Key lessons:**
- Infrastructure decisions can undermine sound architecture regardless of implementation quality
- Event Sourcing requires storage optimized for append-only writes and partition-based reads
- Once confidence is lost, technical proof becomes irrelevant
- Without documented decisions, blame settles on whoever is most visible when projects fail

## The Business Context

The company provided loan servicing capabilities to financial institutions. The platform needed to track every state change in a loan's lifecycle with complete audit trails, support hundreds of tenants with millions of end users, satisfy federal audit requirements, and enable bug reproduction without production access.

The existing third-party solution was expensive and inflexible. Leadership saw an opportunity to build a superior in-house platform.

### Previous Attempts

This wasn't the first attempt. Earlier iterations had failed: too slow, unable to replay state correctly, unable to satisfy audit needs. Each was rejected by the business.

The event sourcing approach was brought in specifically to fix these problems. It succeeded, and also solved future problems the business hadn't yet recognized. But this history meant the project was already operating under a cloud of previous failures.

## The Constraint: SQL Server Only

Whether the SQL Server mandate was communicated early is unclear. The organization wasn't in the habit of documenting constraints, requirements, or decisions. Most developers didn't learn about it until near the end, when performance problems forced the conversation.

There's no way to prove who knew what and when, which is perhaps the larger issue. No documented constraints, no shared understanding of requirements, no explicit agreement on technical boundaries before work began.

When the architect presented the storage strategy, they recommended alternatives for the event store: MongoDB, EventStore, or similar. The reasoning was straightforward: event stores are append-only with partition-scoped reads. Relational overhead adds no value. SQL Server's transaction model, locking, and page-based storage are optimized for workloads that event sourcing doesn't have.

### The Business Veto

Leadership refused. Federal auditors knew SQL, and NoSQL felt risky for regulatory scrutiny. Leadership believed they couldn't "have their cake and eat it too," that event sourcing was incompatible with queryable state for auditors.

The specific technology didn't matter. The architect could have suggested a mythical database written by a sparkling unicorn cat and the response would have been the same. The decision wasn't about evaluating alternatives; it was about not deviating from SQL Server under any circumstances.

### The Hybrid Approach (Rejected)

The architect proposed using a purpose-built event store for writes with SQL Server projections for audit queries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Command Side: Event Store (EventStore or MongoDB)                          │
│  • Partitioned by TenantId, optimized for append-only writes                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                         Event propagation
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Query Side: Projections (SQL Server)                                        │
│  • Auditor-friendly, full SQL capabilities, familiar tooling                │
└─────────────────────────────────────────────────────────────────────────────┘
```

This would have met all audit requirements while achieving performance targets. The architect addressed each concern directly: auditors would still have SQL access through projections, the causal chain would be preserved by design, and the regulatory requirement was data availability, not specific storage technology.

None of it mattered. The decision was made: SQL Server only.

## The Architecture: CQRS and Event Sourcing

Despite the storage constraint, the team chose CQRS and Event Sourcing because they aligned with business requirements.

### Why Event Sourcing

Event Sourcing stores every state change as an immutable event rather than overwriting current state. For loan servicing, this provided:

**Complete audit trails by design.** Every change to a loan's state was captured as an event with timestamp, causation, and context. Auditors could trace any current state back through the exact sequence of events that produced it.

**Temporal decoupling for testing.** All code was decoupled from server datetime and bound instead to event timestamps. Bug reproduction became trivial: replay events up to the problematic state, and the system is in the exact condition when the bug occurred.

**Debugging without production access.** When bugs were reported, the team could replay the event stream to recreate the exact conditions. No guessing about state, no "works on my machine" mysteries.

### Why CQRS

CQRS separates the write model (commands that produce events) from the read model (projections optimized for queries). For loan servicing:

**Optimized read models for different consumers.** Auditors needed different views than loan officers, who needed different views than batch processing systems. Each could have projections optimized for their access patterns.

**Independent scaling.** Command processing and query processing had different scaling characteristics. CQRS allowed each to scale independently.

### The Architecture in Practice

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌───────────────────────────────┐ ┌───────────────────────────────────────────┐
│        Command Side           │ │              Query Side                    │
│                               │ │                                           │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────────────────┐  │
│  │   Command Handlers      │  │ │  │      Read Model Projections         │  │
│  │                         │  │ │  │                                     │  │
│  │  • Validate business    │  │ │  │  • Auditor View                     │  │
│  │    rules                │  │ │  │  • Loan Officer View                │  │
│  │  • Generate events      │  │ │  │  • Batch Processing View            │  │
│  │  • Append to store      │  │ │  │  • Reporting View                   │  │
│  └───────────┬─────────────┘  │ │  └──────────────┬──────────────────────┘  │
│              │                │ │                 │                         │
│              ▼                │ │                 ▼                         │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────────────────┐  │
│  │      Event Store        │  │ │  │       Projection Storage            │  │
│  │      (SQL Server)       │──┼─┼──│       (SQL Server)                  │  │
│  │                         │  │ │  │                                     │  │
│  │  Append-only events     │  │ │  │  Denormalized for query patterns   │  │
│  │  Partitioned by tenant  │  │ │  │  Eventually consistent              │  │
│  └─────────────────────────┘  │ │  └─────────────────────────────────────┘  │
└───────────────────────────────┘ └───────────────────────────────────────────┘
```

The architecture was sound, the implementation was clean, and the patterns delivered their promised benefits. The problem was underneath all of it.

## The Descent

With SQL Server mandated, the team did their best to make it work.

### Initial Performance Issues

The initial implementation hit problems when higher-volume tenants onboarded:

- Write contention from page-level locking caused noticeable append latencies
- Read amplification when building projections, with some aggregates requiring scans across large event histories
- Transaction overhead on every event append added baseline latency that compounded at scale

### Partitioning Attempts

Table partitioning by tenant helped initially, reducing write contention for the largest tenants. But it created new problems:

- Partition management overhead meant constant maintenance windows
- Wildly uneven partition sizes, with a small number of tenants holding most events
- Query optimizer confusion requiring manual hints, which broke when statistics changed
- Cross-partition queries for reporting became prohibitively expensive

### Async Processing and Caching

The team moved projection rebuilds to background workers and added aggressive caching:

- Async command processing reduced perceived latency but increased eventual consistency windows
- Projection caching helped read performance but invalidation logic became complex
- Snapshot tables at regular intervals reduced event replay depth but added storage and maintenance overhead

### The Final Attempts

The team's optimization options were severely limited. This wasn't a cloud environment with elastic scaling; it was on-premises SQL Server with fixed infrastructure. Many optimizations that might have helped weren't available in the deployed version or required infrastructure changes the organization wouldn't approve.

Read replicas were considered but rejected due to licensing costs. The same cost sensitivity that drove the build-versus-buy decision now prevented the investment needed to make the build succeed.

Eventually, peak load caused projection lag significant enough to make the "real-time" audit trail unusable for its intended purpose.

### The Human Cost

Leadership blamed middle management for the failure and dropped them along with most of the development team. People were fired or left. This was deeply unfair: the developers didn't create the constraint that doomed the project, and they couldn't override it. They built exactly what they were asked to build, within constraints they didn't set and in many cases didn't know about until it was too late.

Without a paper trail showing who decided what and when, blame settled on whoever was most visible when the project collapsed.

## Key Lessons

### Infrastructure constrains architecture regardless of implementation quality

The team wrote excellent code, the architecture was sound, and the patterns were appropriate. None of it mattered because the storage layer couldn't support the access patterns. Patterns have storage requirements, and those requirements aren't negotiable through implementation heroics.

### Pattern failure attribution matters

"CQRS and Event Sourcing failed" became the organizational narrative. The accurate narrative was "SQL Server couldn't support Event Sourcing at scale." These are very different lessons. Mis-attribution leads to avoiding good patterns while repeating actual mistakes.

### Once confidence is lost, evidence becomes irrelevant

The in-house system was measurably superior by almost every metric. It didn't matter. Confidence had eroded past the point where evidence could restore it. Technical teams often focus on fixing problems while ignoring the confidence damage that accumulates during the fixing.

### Alignment requires documentation, not assumptions

No one could prove who knew about the SQL Server constraint and when. When the project failed, there was no paper trail showing where the real failure occurred. Without explicit alignment at the start, blame becomes arbitrary. Documentation isn't bureaucracy; it's protection for everyone involved.

## Conclusion

CQRS and Event Sourcing delivered everything they promise. The project's failure wasn't a failure of patterns; it was a failure of infrastructure alignment and organizational communication. The patterns became scapegoats for constraints that made them impossible to implement correctly.

For teams considering these patterns, the lesson isn't to avoid them. The lesson is to ensure infrastructure decisions support the patterns' requirements, and to engage business constraints as collaborative problems rather than obstacles to overcome through technical arguments alone.

The right storage for the right pattern isn't a nice-to-have. It's a prerequisite for success.
