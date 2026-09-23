---
layout: guide
title: "Reliability Patterns"
category: Architecture
subcategory: Patterns
description: "Keeping one failing dependency from taking down the system: timeouts, retries with backoff and jitter, idempotency, circuit breakers, bulkheads, health checks, and graceful degradation, and how they layer together."
tags: [practical, circuit-breaker, retry, bulkhead, idempotency, health-checks, graceful-degradation]
---

In a distributed system, a dependency failing outright is the easy case. The call throws, the caller handles it, and work moves on. The hard case is a dependency that is slow, or failing some of the time. Callers wait on it, their threads pile up, their own callers start waiting on them, and a problem in one service becomes an outage in five.

Each pattern here stops a different step in that chain. Timeouts cap how long anyone waits. Retries recover from failures that go away on their own, and idempotency makes those retries safe. Circuit breakers stop callers hammering something that isn't coming back soon. Bulkheads keep one dependency's problem from consuming resources everything else needs. Health checks and graceful degradation decide what the system does while part of it is down.

## Timeout

A timeout is the maximum time a caller will wait for an operation before giving up. Every other pattern in this guide assumes one exists, because a call with no timeout can hold a thread, a connection, and the caller's own caller indefinitely.

**Use when**:
- Making any call across a network, including to databases and caches
- A dependency could hang rather than fail, which is nearly always
- A request has an end-to-end deadline that downstream calls have to fit inside

**Example**: An API gateway gives each backend call two seconds. A backend that hasn't answered by then gets abandoned, and the gateway returns `504 Gateway Timeout` instead of holding the connection open.

Setting the value is the hard part. Derive it from the dependency's observed latency at a high percentile such as p99, not from its average, since the average says nothing about the slow tail you are guarding against. Timeouts also have to nest. A request with a ten-second overall budget can't give three sequential downstream calls ten seconds each.

**Trade-offs**: Too long, and the timeout doesn't protect anything. Too short, and it abandons calls that would have succeeded, which under load turns slowness into failures and invites retries that add more load. A timeout also doesn't tell the caller whether the operation happened. The server may have completed the work after the caller stopped waiting.

---

## Retry

Repeats a failed operation on the assumption that the failure was transient, such as a dropped connection, a momentary overload, or a leader election in progress.

**Use when**:
- The failure is plausibly transient: a timeout, a connection reset, `503 Service Unavailable`, or `429 Too Many Requests`
- The operation is idempotent, or has been made safe to repeat
- A short delay is acceptable to the caller

Don't retry failures that will fail identically next time. A `400 Bad Request`, `401 Unauthorized`, or `403 Forbidden` is a statement about the request, and repeating it just repeats the answer. When a server sends a `Retry-After` header with a `429` or `503`, honor it over your own backoff schedule.

### Backoff and Jitter

Retrying immediately gives a struggling service no time to recover. Exponential backoff doubles the wait after each attempt, so the delays run 1s, 2s, 4s, 8s up to a cap.

Backoff alone still has a problem. If a hundred clients all failed at the same moment, they all back off by the same amounts and retry in synchronized waves, each hitting the service at once. Jitter randomizes the delay to spread those waves out. Marc Brooker's [analysis on the AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/){:target="_blank" rel="noopener noreferrer"} compares several forms, and the simplest effective one, full jitter, picks a random delay anywhere up to the exponential value.

{% include figure.html id="pat-retry-jitter" %}

```
Full jitter:  sleep = random(0, min(cap, base * 2^attempt))

Attempt 1: wait random(0, 1s)  → fail (503)
Attempt 2: wait random(0, 2s)  → fail (503)
Attempt 3: wait random(0, 4s)  → success
```

**Trade-offs**: Every retry is extra load arriving at a service that is already failing, so retries at several layers multiply. Three retries at each of three layers means up to 64 calls to the bottom service for one user request. Retry at one layer, cap the attempts, and let a circuit breaker stop retries altogether when a failure is clearly not transient. Retries also add latency on the path that already failed, so they have to fit inside the caller's own timeout.

---

## Idempotency

An operation is idempotent when performing it twice has the same effect as performing it once. It is what makes retries safe, and since a timeout leaves the caller not knowing whether the operation happened, it is also what makes timeouts safe to recover from.

Some operations are idempotent by nature. Setting a value, deleting a record by id, and HTTP `PUT` of a full resource all land in the same state however often they repeat. Others are not, and "charge this card" or "append this line item" do harm the second time. Those need to be made idempotent.

**Use when**:
- A caller might retry, which includes any caller with a timeout
- A message broker delivers at least once
- Repeating the operation would move money, send something, or create a duplicate record

### Idempotency Keys

The caller generates a unique key for the logical operation and sends it with every attempt. The server records each key it has processed along with the result, and a repeat returns the stored result without redoing the work.

```csharp
public async Task<PaymentResult> ChargeAsync(ChargeRequest request, string idempotencyKey)
{
    var previous = await _idempotencyStore.GetAsync(idempotencyKey);
    if (previous is not null)
    {
        return previous.Result;
    }

    var result = await _paymentGateway.ChargeAsync(request);

    // A concurrent duplicate that passed the check above charges twice
    await _idempotencyStore.SaveAsync(idempotencyKey, result);
    return result;
}
```

The check-then-act above still has a gap where two concurrent attempts both pass the check. Closing it needs the key recorded atomically with the work, such as inserting the key under a unique constraint in the same database transaction as the business change, or reserving the key before doing the work and recording the outcome afterwards. When the work is a call to an external system that can't join your transaction, pass the key through to that system if it accepts one, as most payment providers do.

**Trade-offs**: The key store grows with every operation and needs a retention window at least as long as any client or broker might retry. Keys have to identify the logical operation, not the attempt. A client that generates a fresh key per retry has defeated the mechanism while appearing to use it.

---

## Circuit Breaker

*Pattern described by Michael Nygard in Release It! (2007)*

A circuit breaker sits in front of a dependency and watches its failures. When failures cross a threshold, it opens and fails calls immediately without making them, which protects the caller from waiting on something broken and gives the dependency room to recover.

{% include figure.html id="pat-circuit-breaker" %}

**Use when**:
- A dependency can fail for long enough that waiting on each call would exhaust the caller's resources
- A fast failure with a fallback is more useful to the user than a slow failure
- Retries against a failing dependency would add load it can't handle

**Example**: A checkout service calls an external payment gateway. When most recent calls fail, the breaker opens, and checkout immediately records the order as payment pending and tells the customer so, instead of making each customer wait through a timeout.

**Trade-offs**: The thresholds are a guess about the dependency's behavior that has to be tuned against real traffic. A breaker that opens too easily turns a brief blip into a minute of refused calls, and one that opens too reluctantly protects nothing. The breaker needs enough calls to judge a failure ratio, so a low-traffic dependency can stay broken for a long time before the breaker notices. And the fallback it enables is a product decision that someone has to design, not something the breaker supplies.

Resilience4j is the standard library in the JVM world. Polly fills the same role in .NET. Netflix's Hystrix, which popularized the pattern in libraries, has been in maintenance mode since 2018.

---

## Bulkhead

Named after the watertight compartments in a ship's hull, a bulkhead gives each dependency or class of work its own limited pool of resources, so one of them exhausting its pool can't sink the others.

{% include figure.html id="pat-bulkhead" %}

**Use when**:
- Some work matters more than other work sharing the same process
- One dependency is noticeably less reliable than the rest
- A spike in one kind of traffic shouldn't starve another

**How it's applied**:
- Separate connection pools per downstream dependency
- A concurrency limit per dependency in the client library
- Separate thread pools or queues per class of work
- At a coarser grain, separate instances or deployments for critical and non-critical workloads

**Trade-offs**: Partitioned pools waste capacity, since one can sit idle while another rejects work it could have absorbed. Sizing each partition is a capacity-planning exercise that has to be redone as traffic shifts. Rejected work also needs somewhere to go, whether a fast error, a queue, or a fallback.

---

## Health Checks

A health check is an endpoint or probe that reports whether an instance can do its job, so that a load balancer or orchestrator can stop sending it traffic or replace it. What a check tests determines what happens when it fails, and Kubernetes makes that explicit by separating three questions.

| Probe | Question it answers | What failing it does | What it should check |
|-------|---------------------|----------------------|----------------------|
| **Liveness** | Is this process stuck beyond recovery? | The container is restarted | Only the process itself, such as whether it can still respond at all |
| **Readiness** | Should this instance receive traffic right now? | The instance is removed from the load balancer until it passes again | Whether it can serve, including dependencies it can't work without |
| **Startup** | Has this instance finished starting? | Liveness and readiness wait until it passes | Initialization such as cache warming or migrations |

The costly mistake is checking a shared dependency from a liveness probe. When the database goes down, every instance fails liveness, the orchestrator restarts all of them, and a database outage becomes an application outage that continues after the database recovers, while instances cycle through restarts.

In ASP.NET Core, health checks are registered as services and mapped to endpoints, with tags separating what each probe runs.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddCheck<OrdersDatabaseHealthCheck>("orders-db", tags: ["ready"]);

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

**Trade-offs**: A deep check that tests dependencies is more truthful and more dangerous, because a shared dependency failing makes every instance unhealthy at once. A shallow check is safe and can report healthy while the instance fails every real request. Checks also run constantly, so an expensive one becomes load of its own.

---

## Graceful Degradation

When part of the system fails, graceful degradation keeps the rest of it useful by serving a reduced version of the feature instead of an error. It is the answer to what a circuit breaker's fallback should actually do.

**Use when**:
- A feature has parts of differing importance, and the core can work without the rest
- A stale or approximate answer is more useful to the user than none
- Load can exceed capacity, and some work can be dropped to protect the rest

| Technique | What it looks like |
|-----------|--------------------|
| Serve stale data | Show the last cached product price or stock level, marked as possibly out of date |
| Drop the optional part | A product page renders without personalized recommendations when that service is down |
| Default response | Show generic bestsellers when personalization is unavailable |
| Defer the work | Accept the order and queue confirmation email for later |
| Shed load | Under overload, reject low-priority requests early so high-priority ones still complete |
| Reduce fidelity | Serve lower-resolution images or a simpler search when capacity is short |

**Example**: A streaming service's home page draws on a dozen backend services. When recommendations fail, the page shows a static popular-titles row. When the continue-watching service fails, that row is hidden. The user can still browse and play video, which is the thing that matters.

**Trade-offs**: Every degraded mode is a second version of the feature that has to be designed, built, and tested, and degraded paths are the least exercised code in the system until the day they are needed. Degradation can also hide failures. A page that quietly omits a broken section generates no complaints, so the outage needs monitoring rather than user reports to be noticed.

---

## Combining the Patterns

These patterns are layers, and their order matters. The outermost layer sees one logical request, and the innermost sees one attempt.

{% include figure.html id="pat-resilience-layers" %}

The circuit breaker sits inside the retry so that each attempt counts toward its failure ratio, and so that an open breaker fails every remaining retry immediately rather than waiting. The attempt timeout sits innermost so that a hung call counts as a failure. The total timeout sits outermost so retries can't stretch a request past its deadline.

In .NET, `Microsoft.Extensions.Http.Resilience` builds this stack on top of Polly. `AddStandardResilienceHandler()` applies a rate limiter, a total timeout, retry, a circuit breaker, and an attempt timeout in that order with sensible defaults. A custom pipeline states each layer explicitly, added outermost first.

```csharp
builder.Services.AddHttpClient<PaymentClient>()
    .AddResilienceHandler("payments", pipeline =>
    {
        pipeline.AddTimeout(TimeSpan.FromSeconds(10));    // total

        pipeline.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            BackoffType = DelayBackoffType.Exponential,
            UseJitter = true,
            Delay = TimeSpan.FromMilliseconds(500)
        });

        pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
        {
            FailureRatio = 0.5,
            SamplingDuration = TimeSpan.FromSeconds(30),
            MinimumThroughput = 20,
            BreakDuration = TimeSpan.FromSeconds(15)
        });

        pipeline.AddTimeout(TimeSpan.FromSeconds(2));     // per attempt
    });
```

Polly's HTTP retry options retry every HTTP method by default, including `POST`. For a non-idempotent call like a payment, either send an idempotency key or disable retries for unsafe methods with `options.Retry.DisableForUnsafeHttpMethods()` on the standard handler.

---

## Quick Reference

| Pattern | Stops | Main cost |
|---------|-------|-----------|
| **Timeout** | A slow dependency holding the caller's resources indefinitely | Abandoned calls that might have succeeded, with unknown outcome |
| **Retry** | A transient failure becoming a user-visible error | Extra load on a struggling dependency, multiplied across layers |
| **Idempotency** | A retry or redelivery doing the work twice | A key store and its retention |
| **Circuit breaker** | Callers queuing up behind a dependency that isn't recovering | Thresholds to tune, and a fallback to design |
| **Bulkhead** | One dependency's failure consuming resources others need | Idle capacity in partitioned pools |
| **Health checks** | Traffic going to instances that can't serve it | Deep checks can fail every instance at once |
| **Graceful degradation** | A partial failure becoming a total one | A second version of each feature to build and test |
