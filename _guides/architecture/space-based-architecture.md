---
layout: guide
title: "Space-Based Architecture"
category: Architecture
subcategory: Styles
description: "The distributed style that takes the database out of the request path by keeping active data in replicated in-memory grids: processing units, virtualized middleware, data pumps, writers, and readers, replicated versus distributed caching, data collisions, and when extreme elasticity justifies the complexity."
tags: [advanced, space-based-architecture, in-memory-data-grid, processing-units, elasticity, replicated-caching]
---

<blockquote class="pull-quote">
<p>Space-based architecture removes the database from the request path, so adding capacity means adding processing units rather than waiting on a database that can't scale as fast.</p>
</blockquote>

Space-based architecture keeps a system's active data in replicated in-memory data grids instead of reading and writing a central database on every request. That removes the database as the bottleneck under load, and it lets the system scale out and back in quickly when load is extreme and unpredictable.

The name comes from the tuple space concept in distributed computing, a shared memory space that independent processes read from and write to without calling each other directly.

## How It Works

In a typical web application under rising load, adding web servers helps until the database saturates, and the database is the hardest part to scale quickly. Space-based architecture avoids that limit by taking synchronous database access out of the request path entirely.

Requests go to processing units, each of which holds application code and an in-memory copy of the data it needs. A unit handles a request from memory, and the data grid replicates any changes to the other units. Changes reach the database later and asynchronously, so the database stays as durable storage but no longer sits between a user and a response.

{% include figure.html id="arch-space-based" %}

### Processing Units

A processing unit contains the application logic for some part of the system along with an in-memory data grid holding the data that logic needs. Units handle requests entirely from memory, and many instances run at once. A system may have several kinds of units, each covering a different part of its functionality.

### Virtualized Middleware

The middleware handles the infrastructure concerns that keep the units working together.

**Messaging grid**: Receives incoming requests and routes each one to an available processing unit, keeping session affinity where the application needs it.

**Data grid**: Replicates data changes between processing units, so an update made in one unit reaches the others. That replication is asynchronous, so the system is eventually consistent.

**Processing grid**: Coordinates a request that needs more than one kind of processing unit, which the design tries to keep rare.

**Deployment manager**: Watches load and starts or stops processing unit instances to match it. This is where the style's elasticity comes from.

### Data Pumps, Writers, and Readers

**Data pumps** send changes from the in-memory grid toward the database asynchronously, usually through messaging, so no request waits on a database write.

**Data writers** receive those changes and apply them to the database.

**Data readers** load data from the database into processing units when units start cold, such as when every instance of a unit type has stopped or the system restarts.

## Replicated and Distributed Caching

How data is placed across processing units shapes most of the style's trade-offs.

{% include figure.html id="arch-space-caching" %}

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Replicated Caching</h4>
<p>Every processing unit holds a full copy of the cached data, and changes replicate between units.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>Very fast reads, because data is always local</li>
<li>High fault tolerance, since losing a unit loses no data</li>
<li>Simple request routing</li>
</ul>
<p><strong>Trade-offs:</strong></p>
<ul>
<li>Every unit must hold the whole cache in memory, which caps cache size</li>
<li>Updates take time to reach every copy</li>
<li>Frequent updates multiply replication traffic</li>
</ul>
<p><strong>When to use:</strong> Relatively small caches with read-heavy access and an update rate the replication can keep up with.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Distributed Caching</h4>
<p>Data lives in a separate cache cluster, and processing units read and write it remotely instead of holding their own copies.</p>
<p><strong>Advantages:</strong></p>
<ul>
<li>Scales to much larger data volumes</li>
<li>Better consistency, because there is one authoritative copy rather than many replicas</li>
<li>Handles high update rates without replication overhead</li>
</ul>
<p><strong>Trade-offs:</strong></p>
<ul>
<li>Every data access crosses the network, which adds latency</li>
<li>The cache cluster must itself be made highly available</li>
<li>More infrastructure to operate</li>
</ul>
<p><strong>When to use:</strong> Large caches, high update rates, or data that must stay consistent across units.</p>
</div>
</div>

A **near-cache** hybrid combines the two, keeping a small, frequently used subset in each unit in front of a distributed cache. It adds the complexity of both approaches and of deciding what goes where, so reserve it for cases with clear evidence that neither pure approach works.

## Consistency and Data Collisions

Space-based architecture is eventually consistent. A change made in one processing unit reaches the other units, and later the database, after a delay. During that window, different units can see different values.

When two units update the same data during that window, the replicated changes collide. Resolving collisions takes a deliberate strategy. Last-write-wins is simple but silently discards one update. Version vectors detect conflicts correctly at the cost of complexity. Domain-specific resolution uses business rules to decide which change stands.

Whether that is acceptable depends on what inconsistency costs the domain. Concert ticketing and online auctions are classic fits for the style. A briefly stale count of available seats or a current bid that takes a moment to propagate is tolerable, as long as the system resolves collisions on the final commitment, such as confirming a specific seat to exactly one buyer. Domains that need every read to reflect every write, such as account balances or regulatory audit trails that must be exact, fit poorly.

## Characteristics

Ratings are relative to other architecture styles, not measurements.

| Characteristic | Rating | Notes |
|----------------|--------|-------|
| **Elasticity** | ⭐⭐⭐⭐⭐ | Units start and stop quickly to match load |
| **Scalability** | ⭐⭐⭐⭐⭐ | Capacity grows by adding processing units |
| **Performance** | ⭐⭐⭐⭐⭐ | Requests are served from memory |
| **Evolvability** | ⭐⭐⭐ | Processing units change readily, but middleware changes are hard |
| **Cost** | ⭐⭐ | Large memory footprint and complex infrastructure |
| **Simplicity** | ⭐⭐ | Complex middleware and consistency behavior |
| **Testability** | ⭐⭐ | Load extremes and consistency timing are hard to reproduce |

## Real-World Fits

**Concert and event ticketing.** Load is modest most of the time and spikes sharply when popular events go on sale. The system adds processing units for the surge and removes them once sales settle.

**Online auctions.** Most auctions see little activity while a few draw intense concurrent bidding, and the load shifts as auctions open and close.

**Retail during major sales events.** Traffic can jump many times above normal for a short period, and space-based architecture absorbs the surge without provisioning for it the rest of the year.

## When Space-Based Architecture Fits

**Extreme, unpredictable load.** Spikes are unpredictable in timing and size, and provisioning for the peak all the time would waste resources.

**A database that remains the bottleneck after optimization.** Queries are tuned, indexes and caching are in place, read replicas exist, and the database still saturates under peak load.

**A working set that fits in memory.** The data active requests touch is small enough to hold in memory, even if historical data is vast. A ticketing system cares about current seat availability, not last year's sales.

**High value per peak.** The revenue or importance of handling the spike justifies the infrastructure and operational complexity.

## When to Avoid Space-Based Architecture

**Predictable load.** If load is steady or grows predictably, conventional horizontal scaling with load balancers, stateless servers, and read replicas is simpler and cheaper.

**Strong consistency requirements.** Domains that need ACID transactions or exact audit trails on every operation fit poorly.

**Frequent cold starts.** Units that start empty must load data before serving requests, and systems that start units constantly lose much of the benefit.

**Queries dominated by historical data.** If most requests read data outside the in-memory working set, they hit the database anyway.

**A working set too large for memory.** When the active data won't fit across the units, distributed caching helps, at the cost of more complexity and latency.

**Limited operational expertise.** The style demands experience with in-memory grids, replication, and eventual consistency. Without it, teams tend to produce failures that are hard to diagnose.

## Common Challenges

**Cold start time.** Loading data into a starting unit can take seconds to minutes for large data sets. Keeping a minimum number of units running, pre-warming units before expected spikes, and shifting load gradually all reduce the impact.

**Replication hotspots.** If every unit constantly updates the same data, replication traffic becomes the bottleneck. Identify the hot data, and either move it to distributed caching or restructure updates so fewer units contend for it.

**Operational complexity.** Running the data grid, monitoring replication lag, handling network partitions, and debugging consistency issues all require sophisticated operational capability.

**Testing.** Consistency bugs depend on timing and on specific interleavings of updates, which are hard to trigger outside production-scale load.

## Evolution and Alternatives

When space-based architecture doesn't fit, or stops fitting:

**Use a conventional distributed cache.** Keep a distributed cache in front of the database for hot data, giving up elastic processing units in exchange for much less complexity.

**Apply it only where the spikes are.** Use space-based techniques for the few high-load paths, such as ticket purchase or bidding, and conventional architectures for administrative and reporting functions.

**Absorb spikes with event streaming.** Put an event stream in front of the processing, and let services consume at their own pace. That buffers load spikes without the in-memory grid, at the cost of processing that isn't immediate.
