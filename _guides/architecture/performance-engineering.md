---
title: "Performance Engineering"
layout: guide
category: Architecture
subcategory: Quality & Risk
description: "Meeting performance targets on purpose: writing percentile-based requirements and latency budgets, why tail latency compounds across calls, finding bottlenecks with the RED and USE methods and profiling, choosing the right kind of optimization, load testing with open workload models, and capacity planning with utilization headroom and autoscaling."
tags: [practical, performance, latency, profiling, load-testing, capacity-planning, autoscaling]
---

Performance engineering is the practice of making a system meet explicit performance targets, and keep meeting them as load and code change. It has four parts that feed each other. Requirements say what fast enough means. Measurement finds where time and resources actually go. Optimization changes the parts that measurement points to. Capacity planning makes sure the system still meets its targets at next year's load.

The discipline guards against two opposite mistakes. One is ignoring performance until users complain, when the fix may require changing an architecture that's already built. The other is optimizing code by instinct, spending effort on paths that don't matter while the real bottleneck goes unmeasured. Donald Knuth's often-quoted warning that premature optimization is the root of all evil comes with a second half that usually gets dropped. Programmers shouldn't pass up the opportunities in the critical few percent of code where performance does matter. Performance engineering is how a team finds that few percent.

## Performance Requirements

### What to Specify

A performance requirement names an operation, a measure, a threshold, and the load under which the threshold must hold. "The API should be fast" is not testable. "Checkout completes within 400 ms at the 95th percentile and 1 s at the 99th, at 300 checkouts per second" is.

| Measure | What it describes | Example target |
|---|---|---|
| **Latency** | Time for one operation, from the caller's point of view | p95 under 300 ms for product search |
| **Throughput** | Operations completed per unit of time | 300 checkouts per second at peak |
| **Concurrency** | Simultaneous users, connections, or in-flight requests supported | 50,000 open WebSocket connections |
| **Resource cost** | CPU, memory, or money per unit of work | Under 20 ms of CPU per search request |
| **Startup and warm-up** | Time until a new instance serves traffic at full speed | Ready within 30 seconds of scheduling |

The examples are illustrations. Real targets come from what users and the business need, and they should be set per operation. Search, checkout, and a monthly report export have very different tolerances, and a single system-wide latency target either over-constrains the export or under-constrains search.

### Percentiles, Not Averages

Latency distributions have long tails, so an average hides what many users experience. A service with a 20 ms median can have an average of 50 ms and a 99th percentile of 800 ms, and the average describes almost nobody's actual request. Percentiles describe the distribution directly. The 95th percentile (p95) is the latency that 95% of requests beat.

The tail matters more than its percentage suggests, because one user action usually involves many requests. Jeffrey Dean and Luiz André Barroso's "The Tail at Scale" gives the canonical example. If a server's p99 latency is one second and a user request fans out to 100 such servers in parallel, waiting for all of them, 63% of user requests take more than a second, since the chance that all 100 calls beat their p99 is 0.99¹⁰⁰, about 37%.

{% include figure.html id="des-fanout-tail" %}

A page that makes 20 sequential backend calls faces the same arithmetic. So does a service whose p99 is acceptable in isolation but sits on a path called many times per user action.

Percentiles also can't be averaged or added. The average of five instances' p99 values is not the p99 of their combined traffic, and the sum of two services' p95 values is not the p95 of calling both. Aggregating correctly requires the underlying distribution, which is why metrics systems record latency as histograms and compute percentiles from the merged histogram.

### Latency Budgets

A latency budget divides an end-to-end target among the steps of a request, so each team owning a step knows its share. For a 300 ms p95 checkout target, a budget might allot 20 ms to the gateway and authentication, 60 ms to the order service's own logic, 120 ms to its database calls, and 100 ms to the payment provider. When a step exceeds its share, the owning team knows before the end-to-end target fails, and a proposal to add a synchronous call to the path has to find its budget from somewhere.

Budgets are a planning tool, not arithmetic that holds exactly, because per-step percentiles don't add up to an end-to-end percentile. The end-to-end latency is still the one to measure and alert on.

### Trade-offs With Other Characteristics

| Performance against | Tension | Usually favor performance when |
|---|---|---|
| **Maintainability** | Optimized code is often harder to read and change | The code is on a hot path that measurement has identified |
| **Consistency** | Caches, replicas, and async processing return data that may be stale | The operation tolerates stale reads |
| **Reliability** | Retries, redundancy, and synchronous replication add latency | Rarely, since a fast wrong or lost result is worse than a slow one |
| **Security** | Encryption, validation, and authorization checks cost time | Almost never, and the costs are usually small once measured |
| **Cost** | Faster usually means more or bigger infrastructure | Latency affects revenue or user retention measurably |

## Finding the Bottleneck

### Service and Resource Views

Two complementary methods structure the search. The **RED method**, from Tom Wilkie, looks at each service from the outside by its request **R**ate, **E**rrors, and **D**uration. It shows which service is slow or failing. Brendan Gregg's **USE method** looks at each resource inside a service, such as CPU, memory, disk, network, connection pools, and thread pools, and checks its **U**tilization (how busy it is), **S**aturation (how much work is queued waiting for it), and **E**rrors. It shows why the service is slow.

Saturation is the easiest of the three to miss. A connection pool at 100% utilization with requests queued behind it looks like database slowness from inside the application, while the database itself sits mostly idle. A thread pool starved by blocking calls makes every endpoint slow while CPU sits at 30%.

Distributed tracing connects the two views across services, showing for one slow request which service and which call inside it took the time.

### Profiling

A profiler shows where time and memory go inside one process. Each kind answers a different question:

- **CPU profiling** shows which methods consume processor time, and finds hot loops and inefficient algorithms.
- **Allocation and memory profiling** shows which code allocates the most, which in managed runtimes like .NET drives garbage collection pauses and throughput loss, and finds leaks.
- **Wall-clock and wait analysis** shows time spent blocked on I/O, locks, or thread pool starvation, which CPU profiles don't show at all.
- **Database query analysis** shows slow queries, missing indexes, and query plans, and finds chatty data access such as N+1 query patterns.

In .NET, `dotnet-counters` shows live runtime metrics such as GC activity, thread pool queue length, and exception rates, and `dotnet-trace` collects CPU and event traces for analysis. Profiles taken against realistic data volumes and load find different problems than profiles on a developer laptop with ten rows in each table, where an unindexed query or a quadratic loop looks instant.

## Optimizing

### Kinds of Fix

Once measurement locates the bottleneck, the fix usually falls into one of a few kinds. The earlier kinds tend to give more improvement for less added complexity.

| Kind | Examples | Adds |
|---|---|---|
| **Do less work** | A better algorithm or data structure, eliminating N+1 queries, fetching only needed columns, adding an index | Little, often simplifies |
| **Do it once** | Caching results, precomputing aggregates, denormalizing read models | Staleness and invalidation to manage |
| **Do it later** | Moving email, exports, and non-critical side effects to background processing | Eventual consistency, a queue to operate |
| **Do it in parallel** | Running independent calls concurrently instead of in sequence | Concurrency bugs, and the fan-out tail effect |
| **Do it closer** | CDNs for static and cacheable content, regional deployments | Distribution and invalidation across locations |
| **Do it cheaper** | Smaller payloads, compression, efficient serialization, fewer allocations | Code complexity for modest gains |

Amdahl's law bounds every optimization. If a step accounts for 20% of a request's time, making that step infinitely fast shortens the request by at most 20%. Speeding up anything other than the dominant step yields little, which is why measurement comes first.

### Chatty Data Access

The N+1 query pattern is among the most common database bottlenecks in applications using an ORM. One query loads a list, then one more query per item loads related data:

```csharp
// N+1: one query for the orders, then one query per order for its lines.
var orders = await db.Orders.Where(o => o.CustomerId == customerId).ToListAsync();
var slowTotals = new Dictionary<int, decimal>();
foreach (var order in orders)
{
    var lines = await db.OrderLines.Where(l => l.OrderId == order.Id).ToListAsync();
    slowTotals[order.Id] = lines.Sum(l => l.Quantity * l.UnitPrice);
}

// One query: the database computes each total.
var totals = await db.Orders
    .Where(o => o.CustomerId == customerId)
    .Select(o => new { o.Id, Total = o.Lines.Sum(l => l.Quantity * l.UnitPrice) })
    .ToDictionaryAsync(o => o.Id, o => o.Total);
```

With 200 orders the first version makes 201 round trips, each paying network latency, so it can be slow even when every individual query is fast. It also tends to pass unnoticed in development, where a customer has three orders.

### Micro-Benchmarks

For code-level changes on a hot path, a micro-benchmark measures the difference reliably. Timing a loop with a stopwatch doesn't, because JIT compilation, tiered compilation, garbage collection, and CPU frequency scaling all distort a naive measurement. [BenchmarkDotNet](https://benchmarkdotnet.org/){:target="_blank" rel="noopener noreferrer"} handles warm-up, repeated iterations, and statistical analysis, and reports allocations alongside time:

```csharp
[MemoryDiagnoser]
public class SkuParsingBenchmarks
{
    private const string Input = "WH-042|SKU-99812|QTY-3";

    [Benchmark(Baseline = true)]
    public string SplitAndIndex() => Input.Split('|')[1];

    [Benchmark]
    public string SpanSlice()
    {
        var span = Input.AsSpan();
        var start = span.IndexOf('|') + 1;
        var length = span[start..].IndexOf('|');
        return span.Slice(start, length).ToString();
    }
}

// In a Release build: BenchmarkRunner.Run<SkuParsingBenchmarks>();
```

A micro-benchmark proves one method got faster, not that the system did. The change matters only if that method sits on a path where profiling showed it accounts for a meaningful share of the time.

## Load Testing

### Test Types

Load tests differ by the question they answer. The names below follow Grafana k6's documentation, and other tools use similar terms.

| Type | Load shape | Answers |
|---|---|---|
| **Smoke** | Minimal load, briefly | Does the test script work, and does the system respond at all? |
| **Average load** | Expected normal load, sustained | Does the system meet its targets under typical conditions? |
| **Stress** | Load above the expected average, up to peak and beyond | How does performance degrade near and past the limit? |
| **Spike** | A sudden, short, large jump in load | Does the system survive and recover from a surge? |
| **Soak** | Normal load over a long period | Do leaks, growing queues, or fragmentation appear over time? |
| **Breakpoint** | Load increasing steadily until something fails | Where is the capacity limit, and which resource hits it first? |

### Open and Closed Workloads

How a load generator produces traffic determines whether the results can be trusted near capacity. In a **closed** model, a fixed number of virtual users each send a request, wait for the response, and send the next. When the system slows down, the virtual users wait longer, so they send fewer requests, and the load drops exactly when the system is struggling. The test then under-reports latency, a distortion known as coordinated omission. In an **open** model, requests arrive at a set rate regardless of how fast earlier ones complete, which matches how independent users arrive at a public service.

In k6, arrival-rate executors implement the open model:

```javascript
export const options = {
  scenarios: {
    checkout: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: [
        { target: 300, duration: '10m' },   // ramp to peak arrival rate
        { target: 300, duration: '30m' },   // hold at peak
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};
```

Closed models still fit systems where a known, fixed population of clients each waits for its previous response, such as a pool of batch workers.

### Environment and Data

Load test results transfer to production only as far as the test environment resembles it. The factors that change results most are instance sizes and counts, database size and data distribution, cache warmth, and configuration such as pool sizes and timeouts. A database with a thousand rows behaves nothing like one with fifty million, because queries that scan tables stay fast until the data outgrows memory.

Third-party dependencies need deliberate handling. Load testing a payment provider's sandbox may violate its terms and measures their sandbox rather than your system, so a stub that responds with realistic latency, including a realistic tail, is usually the better choice. A stub that responds instantly makes the system look faster and less concurrent than it will be in production.

### Reading the Results

Latency typically stays flat as load increases, then rises sharply past a point, the knee of the curve. The knee marks where some resource saturates. At that load, the USE method applied to each resource usually names it: a connection pool with requests queued, a CPU pinned on one node, a lock with growing wait times. Fixing that bottleneck moves the knee to the right until a different resource saturates, so load testing and optimization alternate until the targets hold at the required load with headroom to spare.

## Capacity Planning

### Utilization and Latency

Latency doesn't grow in proportion to utilization. Queueing theory shows why. In the simplest single-server queueing model, average response time equals service time divided by one minus utilization. At 50% utilization, requests take twice their service time on average. At 80%, five times. At 90%, ten times. Real systems differ in detail, but the shape holds. Latency degrades gently at moderate utilization and climbs steeply as a resource approaches full use.

{% include figure.html id="des-utilization-latency" %}

This is why capacity targets set utilization ceilings well below 100% for any resource on a latency-sensitive path. The right ceiling depends on how variable the load and service times are, and a load test that finds the knee gives a better number than a rule of thumb.

### Headroom and Growth

A capacity plan answers whether the system will meet its targets at the load it will see, including load it hasn't seen yet:

- **Peak, not average.** Size for the busiest period, such as the daily peak, month-end, or a seasonal event, not the daily mean.
- **Failure headroom.** With three availability zones, losing one moves its traffic onto the other two, which then need to absorb 50% more load each while still meeting targets.
- **Growth.** Business projections for users, transactions, and data volume, converted into requests and storage, with a margin for the projection being wrong.
- **Lead time.** Capacity that takes weeks to add, such as a database migration to a larger tier or a reserved hardware purchase, has to be planned that far ahead of the growth.
- **The first constraint.** Each tier has a limit, and the tier that reaches its limit first sets the capacity of the whole system. Adding web servers doesn't help when the database is the constraint.

### Why Scaling Out Isn't Linear

Adding instances rarely multiplies throughput by the number of instances. Neil Gunther's Universal Scalability Law describes two effects that erode it. **Contention** for shared resources, such as a database, a lock, or a queue, puts a ceiling on throughput no matter how many instances are added. **Coherency** costs, the work instances do to stay consistent with each other such as cache synchronization or distributed coordination, grow with instance count and can make throughput fall as instances are added. Measuring throughput at several instance counts shows which effect dominates, and whether more instances will help at all.

{% include figure.html id="des-usl-scaling" %}

### Autoscaling

Autoscaling adds and removes instances automatically in response to load. It handles variation within a day or a week, but it doesn't replace capacity planning, since a scaling policy can only scale tiers that scale horizontally and only up to the limits of the tiers they depend on.

Scaling on a **leading** signal responds before users feel the load. Queue depth, request concurrency, and arrival rate rise as load arrives. CPU utilization is a **lagging** signal that rises after requests are already slowing down, and for I/O-bound services it may barely rise at all. New instances also take time to start, and runtimes with JIT compilation and cold caches take longer still to reach full speed, so scale-out has to start before the existing instances saturate. Scheduled or predictive scaling covers load that arrives faster than instances can start, such as a daily opening bell or a marketing email. Scaling in more slowly than scaling out avoids oscillation, and a maximum instance count protects both the budget and downstream dependencies from a scale-out that would overwhelm them.

## Keeping Performance From Regressing

Performance degrades gradually, a few milliseconds per release, and no single change looks responsible. Catching regressions takes the same automation as catching functional defects:

- **Benchmarks in CI** for hot paths, compared against a stored baseline, with a failure when a change exceeds an agreed tolerance.
- **Load tests on a schedule** or before significant releases, against the same scenarios and thresholds each time so results are comparable.
- **Production latency tracked per deployment**, so a regression shows up tied to the release that caused it.
- **Performance questions in design and code review** for changes to hot paths, such as a new synchronous call, a query inside a loop, or an unbounded result set.

## Common Pitfalls

- **Averages as targets.** An average can look healthy while the tail users experience is not. Specify and alert on percentiles.
- **Optimizing without measuring.** Effort goes to code that feels slow instead of code that is. Profile first, and check the fix against the same measurement.
- **Averaging percentiles.** Combining instances' p99 values by averaging produces a number that means nothing. Aggregate histograms.
- **Closed-model load tests near capacity.** The generator backs off as the system slows, hiding the latency a real surge would cause. Use an arrival-rate model.
- **Tiny test datasets.** Queries that are fast against a thousand rows can be slow against fifty million. Test with production-scale data.
- **Scaling on CPU alone.** I/O-bound services saturate connection pools and queues while CPU stays low. Scale on queue depth, concurrency, or latency.
- **Sizing for average load.** Systems fail at peak and during partial outages. Size for peak with failure headroom.
- **Adding instances in front of a saturated shared resource.** More application instances put more load on a database that is already the constraint.

## Quick Reference

| Activity | Key technique | Watch for |
|---|---|---|
| **Specifying requirements** | Per-operation percentile targets at a stated load, latency budgets per step | Averages, system-wide targets, missing load conditions |
| **Locating a bottleneck** | RED for services, USE for resources, tracing across services | Saturation hidden behind low utilization |
| **Profiling** | CPU, allocation, wait analysis, query plans with realistic data | Laptop-scale data and load |
| **Optimizing** | Do less, do once, do later, do in parallel, do closer, do cheaper | Optimizing a step that isn't dominant (Amdahl) |
| **Load testing** | Open arrival-rate models, production-like data and dependencies | Coordinated omission, instant stubs |
| **Capacity planning** | Peak load, failure headroom, utilization ceilings, first constraint | Latency rising non-linearly with utilization |
| **Autoscaling** | Leading signals, warm-up allowance, slower scale-in, maximum bounds | Scaling a tier whose dependency is the bottleneck |
| **Preventing regressions** | CI benchmarks, scheduled load tests, per-deployment latency tracking | Gradual drift no single change explains |
