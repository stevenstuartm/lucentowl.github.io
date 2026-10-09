---
layout: post
title: "Your Retry Policy Is a Load Amplifier"
description: "Retries spend a struggling dependency's capacity on each caller's behalf, and when every caller decides that alone, they become the feedback loop that holds a system down after the trigger is gone. How much a system may retry, and where, is an architecture decision, which for most business transactions means not retrying at all and, where retrying is the job, means one layer that retries, a budget measured against total traffic, and a way for the overloaded service to say stop."
tags: [architecture, distributed-systems, reliability, resilience, retries]
author: steven-stuart
sources:
  - title: "Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region"
    url: "https://aws.amazon.com/message/101925/"
  - title: "Bronson, Aghayev, Charapko, and Zhu: Metastable Failures in Distributed Systems (HotOS 2021)"
    url: "https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf"
  - title: "Huang et al.: Metastable Failures in the Wild (OSDI 2022)"
    url: "https://www.usenix.org/conference/osdi22/presentation/huang-lexiang"
  - title: "Aspire: C# Service Defaults"
    url: "https://aspire.dev/get-started/csharp-service-defaults/"
  - title: "Microsoft Learn: Build resilient HTTP apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience"
  - title: "AWS SDKs and Tools Reference Guide: Retry behavior"
    url: "https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html"
  - title: "Istio: Traffic Management"
    url: "https://istio.io/latest/docs/concepts/traffic-management/"
  - title: "Site Reliability Engineering: Addressing Cascading Failures"
    url: "https://sre.google/sre-book/addressing-cascading-failures/"
  - title: "Marc Brooker: Timeouts, retries, and backoff with jitter (Amazon Builders' Library)"
    url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
  - title: "Site Reliability Engineering: Handling Overload"
    url: "https://sre.google/sre-book/handling-overload/"
  - title: "gRPC Guides: Retry"
    url: "https://grpc.io/docs/guides/retry/"
  - title: "gRPC Proposal A6: gRPC Retry Design"
    url: "https://github.com/grpc/proposal/blob/master/A6-client-retries.md"
---

The outage ended an hour ago, and your retries didn't get the memo. On October 20, 2025, AWS restored DNS for DynamoDB's us-east-1 endpoint, and by 2:40 AM Pacific clients could connect again. EC2's DropletWorkflow Manager, the system that holds a lease on every physical server behind EC2, didn't recover with it. AWS's summary says so many leases needed re-establishing that the work "could not be completed before they timed out," so more work was queued to try again. The manager "entered a state of congestive collapse and was unable to make forward progress." It stayed there until 4:14 AM, when engineers throttled incoming work and began restarting hosts, and the last leases came back at 5:28 AM.

The trigger was fixed, and the manager's own retries kept it down anyway. What I find most unsettling about that shape is that the mechanism holding the system down was built on purpose. Every caller that retries, every timeout, and every cache exists because it made the system more reliable or more efficient for someone. My argument is that these mechanisms combine into a loop that nobody configured as a whole, because each caller configured its own piece.

Deciding how much a system may retry, and at which layer, is an architecture decision, but the libraries most teams use make it a client setting. The first part of that decision is whether a call should retry at all, and for the business transactions most teams write, the answer is often no.

## Some Outages Outlive Their Trigger

### A Trigger Starts It, and a Feedback Loop Keeps It Going

Nathan Bronson, Abutalib Aghayev, Aleksey Charapko, and Timothy Zhu described this pattern in "Metastable Failures in Distributed Systems" (HotOS 2021), drawing on a decade of hyperscale operations, much of it at Facebook. A metastable failure is a bad state "that persists even when the trigger is removed," held there by a sustaining effect, "often involving work amplification." Leaving it "requires a strong corrective push, such as rebooting the system or dramatically reducing the load," which is exactly what AWS's engineers did.

In their simplest example, a web application sends one query per user request to a database that answers in under 100 ms below 300 queries per second and slows sharply above it. The application retries any query that hasn't returned within a second. At 280 user requests per second the system is healthy.

Then a 10-second network blip drops traffic between the application and the database, and when it clears, the backlog of requests and retries lands at once. The database slows, every query starts taking longer than a second, and every query is now sent twice. Load settles at 560 queries per second against a database that can serve 300, so nearly every query times out and the application serves nothing. The network has been fine for minutes by then.

As the authors put it, "It is common for an outage that involves a metastable failure to be initially blamed on the trigger, but the true root cause is the sustaining effect."

### Retries Sustain Most of the Outages Studied

Lexiang Huang and colleagues tested whether the pattern shows up beyond one company in "Metastable Failures in the Wild" (OSDI 2022). From hundreds of public incident reports, they studied 22 metastable failures across 11 organizations, including AWS, Azure, Spotify, and Wikimedia. At least 4 of 15 major AWS outages in the previous decade were metastable, and the most common duration was 4 to 10 hours.

"By far, the most common sustaining effect is due to the retry policy, affecting more than 50% of the studied incidents."

### The Efficient System Is the Vulnerable One

Nothing in either paper requires hyperscale. The retry example runs at 280 requests per second. What matters is how close a system runs to the point where it can no longer heal itself, which Bronson and colleagues call its hidden capacity. Below it, a trigger causes errors that stop when the trigger does. Above it, the system is healthy but vulnerable, and it "can run for months or years in the vulnerable state" before a trigger arrives.

In their cache example, a look-aside cache with a 90% hit rate lets an application built on that same 300-query database serve 3,000 requests per second. Its hidden capacity is still 300, because if the cache empties, every request goes to the database. The authors point out that a better cache looks like a chance to reclaim database capacity. That change is "easy to measure and reward," and it's "a false economy if the system can no longer recover from cache loss." The more a team optimizes the common case, the further above its hidden capacity it runs.

## Every Caller's Reasonable Choice Multiplies

### Each Layer Retries by Default

In .NET, `AddStandardResilienceHandler()` gives an `HttpClient` a retry strategy, and Aspire's C# service defaults turn it on for every client. According to Microsoft's documentation on building resilient HTTP apps, it retries up to three times with exponential backoff and jitter, on any status of 500 or above, 408, or 429, for every HTTP method. The AWS SDKs reference guide sets the default at three attempts, and at four for DynamoDB under the updated retry behavior AWS is rolling out in 2026. Both are sensible defaults for one caller, and both are set per client.

A service mesh adds a layer the application can't see. Istio's traffic management documentation sets the default for HTTP requests at two retries, made by the sidecar before the application's client learns the call failed. None of these layers knows whether the business operation should run twice. Only the domain code that made the call does.

Put the standard handler on three hops in a row, and one user action that keeps failing can reach the bottom service four times per attempt at each hop. That's 4 × 4 × 4, or 64 attempts, which is the same figure Google's SRE book uses in its chapter on addressing cascading failures. Marc Brooker's Amazon Builders' Library article on timeouts and retries runs it on five layers of three tries each and gets 243 times the load on the database, "making it unlikely to ever recover."

The standard handler also includes a circuit breaker, which cuts that worst case short once enough calls fail. Its timeouts help only where each service passes cancellation down.

Brooker calls retries "selfish." When a client retries, "it spends more of the server's time to get a higher chance of success." When failures are rare, the trade works. When failures come from overload, retries "can even delay recovery by keeping the load high long after the original issue is resolved."

### Timeouts and Caches Feed the Same Loop

A retry starts when a timeout expires, so the timeout sets how fast the loop spins up. Huang and colleagues found that a short timeout is good for latency on small transient issues but "can hurt the system's ability to handle larger problems by quickly starting the workload amplification."

A timeout also abandons work without stopping it. When a caller gives up and retries, the server may still be running the first attempt, so the retry adds new work while the old work finishes for nobody. The server-side fix is passing the request's cancellation token to every query and outbound call, so abandoned work stops with its caller.

The look-aside cache fails the same way from the other direction. The application fills the cache, but when the database slows past its timeout, it gives up before it has a result to store. The hit rate stays low, the database stays overloaded, and in Bronson's words, "losing a cache with a 90% hit-rate causes a 10× query amplification."

### Local Fixes Can Strengthen the Loop

Teams that own their retry settings tend to fix the next incident locally, and Huang and colleagues document how that goes wrong. In the 2014 SimpleDB outage, storage servers timed out and retried against an overloaded lock service, then demoted themselves after several retries. Afterward, engineers decided the servers must keep retrying instead of giving up. The paper argues that unlimited retries make the sustaining effect worse. In a DynamoDB incident about a year later, storage nodes didn't back off from retrying for membership data and produced "a massive workload amplification."

Each of those changes looked right from inside one component. Bronson and colleagues identify the constraint. "A major challenge with adaptive policies is coordination, as retry and failover decisions are made by each client." A client can see its own failures. It can't see how many other clients are retrying the same dependency, or how close that dependency is to its hidden capacity.

## Who May Retry Is an Architecture Decision

Every retry fix in the sources above moves a decision from the caller acting alone to something that can see more of the system. The table's first row comes before all of those fixes. It asks whether a call should retry at all, a question the systems in those sources never faced because they had to retry.

| Decision | Who makes it by default | Who should make it | Mechanism |
| --- | --- | --- | --- |
| Whether a call retries at all | Every client and proxy on the path | The domain, by the kind of work | Fail or queue a business transaction, and retry infrastructure work with the controls below |
| Which layer retries | Every client on the path | One layer, set for the whole path | Retry only above the layer that rejects, and pass a "don't retry" signal up |
| How much retry traffic is acceptable | Each request, on its own | The client or process, against all its traffic | A retry budget, an SDK retry quota, or gRPC retry throttling |
| When callers should wait or stop | The caller's backoff schedule | The overloaded service | `Retry-After`, gRPC pushback, and a retry policy in the service config |
| Who fills the cache after a miss | The application, which times out first | The cache | A read-through cache with its own, longer timeout |

### Most Business Transactions Shouldn't Retry at All

Nearly every incident this post draws on comes from infrastructure: a lease manager, storage servers retrying a lock service, storage nodes fetching membership data. Work like that has no user to hand a failure to, so retrying is the job, and the open question is how to do it without holding the system down. Most teams build business transactions instead, where a person or a calling process is waiting on an answer. Google's 64 attempts start from one of those, a single user action.

For a synchronous business transaction, a retry rarely buys much. A dropped connection or one bad instance can clear in milliseconds, and a retry fixes it. But a timeout or a `503` looks the same when it comes from an overloaded database, a dependency that's down, or a bad deploy. Those tend to last longer than the transaction's own timeout. Against them, the retry meets the same failure and adds load while it does.

Retrying can also put the transaction itself at risk. When a call times out, the caller can't tell whether the first attempt committed, and the standard .NET handler retries a `POST` like any other call. Turning on its `DisableForUnsafeHttpMethods` option, or an idempotency key that every service on the path honors, makes that safe.

Failing cleanly and telling the user leaves the decision with the one party who knows whether trying again is worth it. A user who refreshes still retries, but with no retries below it, each refresh reaches the dependency once. The client app is part of that decision too, both its own retries and what its error tells the user to do.

Zero is a valid answer to which layer should retry, and for a synchronous business call it's often the right one. The two choices don't cost the same. Skipping the retry on a blip costs one error the user can repeat. Retrying safely costs everything that follows: a chosen layer, a budget, a no-retry signal, and idempotency on every write.

When the domain decides a business call is worth the cost of retrying safely, such as an idempotent read after a dropped connection, it gets the same controls as infrastructure work. In .NET, that means registering the resilience handler only on the clients that make those calls, not on every client by default.

Work that doesn't have to finish right now belongs in a queue, not a retry loop. A consumer pulls at its own pace, so its concurrency caps the load on the dependency, and an overload becomes a backlog instead of more traffic.

Queues bring their own problems. Work can go stale before it runs. AWS's lease manager collapsed that way, retrying lease work that had already timed out. Google's chapter on cascading failures gives the fixes: short queues, so a server rejects early, and a deadline check before each stage of work. Work that goes back on the queue needs a cap too, which is the retry budget below by another name.

The fixes that follow are for work that has to retry, like the replica syncs, webhook delivery, and integration jobs most teams also run.

### One Layer Retries

Google's SRE book states the rule for deep stacks in its chapter on handling overload. "Requests should only be retried at the layer immediately above the layer that is rejecting them." Brooker's version, for low-cost operations, is to "retry at a single point in the stack." Both make it a rule for the whole call path, not for whoever wrote each client.

A single layer only holds if the layers above it can tell spent retries from an ordinary failure. Google's services answer with an "overloaded; don't retry" error once the retrying layer gives up. HTTP has no status code that means that. Suppose a service's retries to its dependency run out and it answers with a `503`. The standard handler retries every 5xx, so every caller above it retries the whole chain. A team needs its own convention:

```csharp
// The layer directly above Inventory retries. When its retries are spent,
// it tells its own callers not to spend more.
app.MapGet("/orders/{id}/stock", async (string id, InventoryClient inventory,
    HttpContext http, CancellationToken ct) =>
{
    try
    {
        return Results.Ok(await inventory.GetStock(id, ct));
    }
    catch (Exception ex) when (ex is HttpRequestException
        or BrokenCircuitException or TimeoutRejectedException)
    {
        http.Response.Headers["X-No-Retry"] = "true";
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
});

// Every caller of Orders keeps the standard retry, but not for that answer.
builder.Services.AddHttpClient<OrdersClient>()
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.ShouldHandle = args => ValueTask.FromResult(
            HttpClientResiliencePredicates.IsTransient(args.Outcome, args.Context.CancellationToken)
            && args.Outcome.Result?.Headers.Contains("X-No-Retry") != true);
    });
```

Any header name works if every caller honors it, including a mesh's sidecar. Unless the sidecar's retries are off for that route, it can retry before the application ever sees the header.

### A Budget Caps Retries Against Total Traffic

A per-request limit like "three retries" caps how much one request can multiply, not how much the fleet does. Google's chapter on handling overload pairs its per-request limit of three attempts with a per-client budget, where each client retries only while retries are under 10% of its requests. In the chapter's worst case, where a datacenter rejects most of what it receives, the per-request limit alone lets load grow to just under three times, and the 10% budget holds it to 1.1 times.

Some client libraries carry a looser budget. The AWS SDKs' standard retry mode includes a retry quota, a token bucket that each retry draws down and each success refills. When it runs dry, the SDK "returns the error without retrying." Under the 2026 behavior, the quota drains only once about 22% of requests keep failing, a looser line than Google's 10%. gRPC's retry guide describes throttling that works the same way per server, pausing retries when the token count falls below half. The standard .NET handler has no such budget, so whether a dependency needs one is a decision to make, not a default to inherit.

A budget like this needs no view of the other clients. If every client of the one retrying layer caps retries at 10% of its own traffic, the dependency sees at most 1.1 times its load, however many clients there are. Huang and colleagues find that "the policy with no cap effectively leaves the system with no stable region."

A cap limits amplification, but it doesn't restore margin. In Bronson's example, 280 requests plus 10% is still 308 queries against 300, so recovery also needs first attempts cut below hidden capacity, through the load shedding Google's chapter on handling overload describes.

### The Overloaded Service Gets a Say

The service that's failing is the one component that knows it's overloaded, and a retry policy written into each client gives it little say. gRPC's retry design proposal, A6, opens with the other view, that the client library "will automatically retry failed RPCs according to a policy set by the service owner," published through the service config. A server can also push back on individual calls with `grpc-retry-pushback-ms` metadata. A delay tells the client when it may retry, and a negative value tells it not to retry at all.

HTTP's nearest equivalent is `Retry-After` on a `429` or `503`, and the standard .NET handler honors it by default in place of its own backoff. The same handler also retries a `429 Too Many Requests`, so an HTTP service can delay its callers' retries but can't refuse them without a no-retry header like the one above.

### Cache Fills Belong to the Cache

The look-aside cache leaves the fill to the caller that gives up first, the same authority problem as a retry. Bronson and colleagues observe that prioritizing cache fills over serving clients during overload "is unenforceable with a look-aside cache but trivial with a read-through cache." A read-through cache can wait longer on the database than the application does. Even after the application gives up, the result still lands in the cache, and the hit rate climbs until the system recovers. As they put it, "the software structure encodes implicit priorities."
