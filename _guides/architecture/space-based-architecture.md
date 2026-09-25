---
layout: guide
title: "Space-Based Architecture"
category: Architecture
subcategory: Styles
description: "The distributed style that takes the database out of the request path by keeping active data in replicated in-memory grids: how a request is served from memory, how changes spread and reach the database, replicated versus distributed caching, collisions, and when extreme elasticity justifies the complexity."
tags: [advanced, space-based-architecture, in-memory-data-grid, processing-units, elasticity, replicated-caching]
---

<blockquote class="pull-quote">
<p>Space-based architecture removes the database from the request path, so adding capacity means adding processing units rather than waiting on a database that can't scale as fast.</p>
</blockquote>

Space-based architecture keeps a system's active data in replicated in-memory data grids instead of reading and writing a central database on every request. That removes the database as the bottleneck under load, and it lets the system scale out and back in quickly when load is extreme and unpredictable.

The name comes from the tuple space concept in distributed computing, a shared memory space that independent processes read from and write to without calling each other directly.

## Taking the Database Out of the Request Path

In a typical web application under rising load, adding web servers helps until the database saturates, and the database is the hardest part to scale quickly. Space-based architecture avoids that limit by never making a request wait on the database. Following one request and the data it changes shows how.

{% include figure.html id="arch-space-based" %}

### A Request Is Served from Memory

A request arrives at a router, which sends it to one of many **processing units**. Each unit bundles application code with an in-memory copy of the data that code needs, so it can answer without calling anything else. Many identical units run at once, and a system can have several kinds, each covering a different part of its functionality. Where a user's requests must keep landing on the same unit, the router maintains that session affinity.

A request that needs more than one kind of unit has to be coordinated across them. Designs try to keep that rare, since every cross-unit step gives back some of the speed that serving from memory bought.

### A Change Spreads to the Other Units

When a unit changes data, an in-memory data grid replicates the change to every other unit that holds the same data. Replication is asynchronous, so for a short window different units can see different values, and the system is eventually consistent.

If two units change the same data inside that window, the replicated changes collide. Resolving collisions takes a deliberate strategy. Last-write-wins is simple but silently discards one update. Version vectors detect conflicts correctly at the cost of complexity. Domain-specific resolution uses business rules to decide which change stands.

Whether that window is acceptable depends on what inconsistency costs the domain. During a university's course registration rush, a seat count that is a moment stale is tolerable, as long as the final enrollment resolves the collision and gives the last seat to exactly one student. Domains that need every read to reflect every write, such as account balances or audit trails that must be exact, fit poorly.

### The Database Catches Up Later

The database stays the durable record, but it is written behind the requests rather than during them. Changes go onto a queue, and a separate writer applies them to the database at its own pace. A surge fills the queue instead of stalling users.

The database also supplies data in the other direction. A unit that starts empty, such as the first unit of its kind after a restart, loads its working data from the database before it takes requests. That load is the slowest moment in a unit's life, and it matters more the more often units start.

### Capacity Follows the Load

Because no unit depends on the database to answer, capacity grows by starting more units and shrinks by stopping them. An autoscaler watches load and does both, which is where the style's elasticity comes from. The limits move to places that are cheaper to scale: memory in each unit, replication traffic between units, and the queue behind them.

## Where the Active Data Lives

Units can each hold a full copy of the data, or all of them can share a separate cache cluster. The choice shapes most of the style's trade-offs.

{% include figure.html id="arch-space-caching" %}

| | Replicated: a full copy in every unit | Distributed: one shared cache cluster |
| --- | --- | --- |
| **Reads** | Local and very fast | Cross the network on every access |
| **Losing a unit** | Loses no data, since every other unit has a copy | Loses no data, but the cluster itself must be made highly available |
| **Data size** | Capped by what one unit can hold | Grows with the cluster |
| **Frequent updates** | Multiply replication traffic between units | Handled without replication overhead |
| **Consistency** | Copies lag each other briefly | One authoritative copy |
| **Suits** | Small, read-heavy data with a modest update rate | Large data, high update rates, or data that must stay consistent |

Some data grids also offer a near cache, a small local copy of frequently used entries in front of a distributed cache. It brings the complexity of both approaches, plus the question of what goes where, so it earns its place only when measurements show neither pure approach works.

## Real-World Fits

**Product drops and flash sales.** Traffic can jump many times above normal for minutes when a limited item goes on sale, and the system absorbs the surge without provisioning for it the rest of the year.

**Course registration.** Load is light for months and then concentrates in the hours after registration opens, when thousands of students compete for the same seats.

**In-play sports betting.** Activity follows the match, with sharp spikes around goals and key moments, and odds and open positions change constantly while the spike lasts.

## When Space-Based Architecture Fits

**Extreme, unpredictable load.** Spikes are unpredictable in timing and size, and provisioning for the peak all the time would waste resources.

**A database that remains the bottleneck after optimization.** Queries are tuned, indexes and caching are in place, read replicas exist, and the database still saturates under peak load.

**A working set that fits in memory.** The data active requests touch is small enough to hold in memory, even if historical data is vast. A registration system cares about the current term's open seats, not a decade of past enrollments.

**High value per peak.** The revenue or importance of handling the spike justifies the infrastructure and operational complexity.

## When to Avoid Space-Based Architecture

**Predictable load.** If load is steady or grows predictably, conventional horizontal scaling with load balancers, stateless servers, and read replicas is simpler and cheaper.

**Strong consistency requirements.** Domains that need ACID transactions or exact audit trails on every operation fit poorly.

**Frequent cold starts.** Units that start empty must load data before serving requests, and systems that start units constantly lose much of the benefit.

**Queries dominated by historical data.** If most requests read data outside the in-memory working set, they hit the database anyway.

**A working set too large for memory.** When the active data won't fit across the units, distributed caching helps, at the cost of more complexity and latency.

**Limited operational expertise.** The style demands experience with in-memory grids, replication, and eventual consistency. Without it, teams tend to produce failures that are hard to diagnose, and the load extremes and consistency timing behind those failures are hard to reproduce in tests.

## Common Challenges

**Cold start time.** Loading data into a starting unit can take seconds to minutes for large data sets. Keeping a minimum number of units running, pre-warming units before expected spikes, and shifting load gradually all reduce the impact.

**Replication hotspots.** If every unit constantly updates the same data, replication traffic becomes the bottleneck. Identify the hot data, and either move it to distributed caching or restructure updates so fewer units contend for it.

**Operational complexity.** Running the data grid, monitoring replication lag, handling network partitions, and debugging consistency issues all require sophisticated operational capability.

**Testing.** Consistency bugs depend on timing and on specific interleavings of updates, which are hard to trigger outside production-scale load.

## Evolution and Alternatives

When space-based architecture doesn't fit, or stops fitting:

**Use a conventional distributed cache.** Keep a distributed cache in front of the database for hot data, giving up elastic processing units in exchange for much less complexity.

**Apply it only where the spikes are.** Use space-based techniques for the few high-load paths, such as checkout during a product drop or enrollment during registration, and conventional architectures for administrative and reporting functions.

**Absorb spikes with event streaming.** Put an event stream in front of the processing, and let services consume at their own pace. That buffers load spikes without the in-memory grid, at the cost of processing that isn't immediate.
