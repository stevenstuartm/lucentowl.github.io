---
layout: post
title: "Your Retry Policy Is a Load Amplifier"
description: "Retries spend a struggling dependency's capacity on each caller's behalf, and when every caller decides that alone, they become the feedback loop that holds a system down after the trigger is gone. How much a system may retry, and where, is an architecture decision. For most business transactions the answer is not at all, and where retrying is the job, it needs one layer that retries, a budget measured against total traffic, and a way for the overloaded service to say stop."
tags: [architecture, distributed-systems, reliability, resilience, retries]
author: steven-stuart
sources:
  - title: "Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region"
    url: "https://aws.amazon.com/message/101925/"
  - title: "Bronson, Aghayev, Charapko, and Zhu: Metastable Failures in Distributed Systems (HotOS 2021)"
    url: "https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf"
  - title: "Huang et al.: Metastable Failures in the Wild (OSDI 2022)"
    url: "https://www.usenix.org/conference/osdi22/presentation/huang-lexiang"
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

The outage ended an hour ago, and your retries didn't get the memo. On October 20, 2025, AWS restored DNS for DynamoDB's us-east-1 endpoint, and by 2:40 AM Pacific clients could connect again. EC2's DropletWorkflow Manager, the system that holds a lease on every physical server behind EC2, didn't recover with it, and AWS's summary describes a retry loop. Re-establishing all those leases took long enough that the work "could not be completed before they timed out," more work was queued to try again, and the manager "entered a state of congestive collapse and was unable to make forward progress." It stayed there until 4:14 AM, when engineers throttled incoming work and restarted hosts to clear the queues.

The trigger was fixed, and the system stayed down anyway. What I find most unsettling about that shape is that the mechanism holding the system down was built on purpose. Every caller that retries, every timeout, and every cache exists because it made the system more reliable or more efficient for someone. My argument is that these mechanisms combine into a loop that nobody configured as a whole, because each caller configured its own piece. Deciding how much a system may retry, and at which layer, is an architecture decision. Most systems leave it as a client setting. The first part of that decision is whether a call should retry at all, and for the business transactions most teams write, the answer is often no.

## Some Outages Outlive Their Trigger

### A Trigger Starts It, and a Feedback Loop Keeps It Going

Nathan Bronson, Abutalib Aghayev, Aleksey Charapko, and Timothy Zhu described this pattern in "Metastable Failures in Distributed Systems" (HotOS 2021), drawing on a decade of operating hyperscale systems, much of it at Facebook. A metastable failure is a bad state "that persists even when the trigger is removed," held there by a sustaining effect, "often involving work amplification." Leaving it "requires a strong corrective push, such as rebooting the system or dramatically reducing the load," which is exactly what AWS's engineers did.

In their simplest example, a web application sends one query per user request to a database that answers in under 100 ms below 300 queries per second and slows sharply above it. The application retries any query that hasn't returned within a second. At 280 user requests per second the system is healthy. Then a 10-second network blip drops traffic between the application and the database, and when it clears, the backlog of requests and retries lands at once. The database slows, every query starts taking longer than a second, and every query is now sent twice. Load settles at 560 queries per second against a database that can serve 300, so nearly every query times out and the application serves nothing. The network has been fine for minutes by then.

The authors are explicit about where to look afterward. "It is common for an outage that involves a metastable failure to be initially blamed on the trigger, but the true root cause is the sustaining effect."

### Retries Sustain Most of the Outages Studied

Lexiang Huang and colleagues tested whether the pattern shows up beyond one company in "Metastable Failures in the Wild" (OSDI 2022). From hundreds of public incident reports, they studied 22 metastable failures across 11 organizations, including AWS, Google Cloud, Azure, IBM, Spotify, Elasticsearch, and Wikimedia. At least 4 of 15 major AWS outages in the previous decade were metastable, and the most common duration was 4 to 10 hours.

"By far, the most common sustaining effect is due to the retry policy, affecting more than 50% of the studied incidents."

### The Efficient System Is the Vulnerable One

Nothing in either paper requires hyperscale. The retry example runs at 280 requests per second, and the incident list includes much smaller organizations than AWS. What matters is how close a system runs to the point where it can no longer heal itself, which Bronson and colleagues call its hidden capacity. Below it, a trigger causes errors that stop when the trigger does. Above it, the system is healthy but vulnerable, and it "can run for months or years in the vulnerable state" before a trigger arrives.

Their cache example shows how teams end up there. A look-aside cache with a 90% hit rate lets an application built on that same 300-query database serve 3,000 requests per second. Its hidden capacity is still 300, because if the cache empties, every request goes to the database. The authors point out that a better cache looks like a chance to reclaim database capacity, a change "easy to measure and reward," and "a false economy if the system can no longer recover from cache loss." The more a team optimizes the common case, the further above its hidden capacity it runs.

## Every Caller's Reasonable Choice Multiplies

### Each Layer Retries by Default

In .NET, `AddStandardResilienceHandler()` gives an `HttpClient` a retry strategy that, according to Microsoft's documentation on building resilient HTTP apps, retries up to three times with exponential backoff and jitter, on any status of 500 or above, 408, or 429, for every HTTP method. The AWS SDKs reference guide sets the default at three attempts for most services, and four for DynamoDB. Both are sensible defaults for one caller, and both are set per client. A service mesh adds a layer the application can't see. Istio's traffic management documentation sets the default for HTTP requests at two retries, made by the sidecar proxy before the application's own client learns the call failed. None of these layers knows whether the call is safe to repeat or whether the business operation should run twice. Only the domain code that made the call does.

Put the standard handler on three hops in a row, and one user action that keeps failing can reach the bottom service four times per attempt at each hop. That's 4 × 4 × 4, or 64 attempts, which is the same figure Google's SRE book uses in its chapter on addressing cascading failures. Marc Brooker's Amazon Builders' Library article on timeouts and retries runs the same arithmetic on a five-deep stack with three tries at each layer and gets 243 times the load on the database, "making it unlikely to ever recover." The standard handler's circuit breaker cuts that worst case short, but each breaker judges only its own instance's traffic.

Brooker gives the underlying trade its plainest name. "Retries are 'selfish.' In other words, when a client retries, it spends more of the server's time to get a higher chance of success." When failures are rare, the trade works. When failures come from overload, retries "can even delay recovery by keeping the load high long after the original issue is resolved."

### Timeouts and Caches Feed the Same Loop

A retry starts when a timeout expires, so the timeout sets how fast the loop spins up. Huang and colleagues found that a short timeout is good for latency on small transient issues but "can hurt the system's ability to handle larger problems by quickly starting the workload amplification."

A timeout also abandons work without stopping it. When a caller gives up and retries, the server may still be running the first attempt, so the retry adds new work while the old work finishes for nobody. The fix on the server side is passing the request's cancellation token through to every query and outbound call, so abandoned work stops with its caller.

The look-aside cache fails the same way from the other direction. The application is responsible for filling the cache, but when the database slows past the application's timeout, the application gives up before it gets a result to store. The hit rate stays low, the database stays overloaded, and in Bronson's words, "losing a cache with a 90% hit-rate causes a 10× query amplification."

### Local Fixes Can Strengthen the Loop

A team that treats retries as its own setting will tend to fix the next incident locally, and Huang and colleagues document how that goes wrong. In the 2014 SimpleDB outage, storage servers timed out and retried against an overloaded lock service, then demoted themselves after several retries. Afterward, according to the paper, engineers decided the servers must keep retrying instead of giving up. The paper argues that unlimited retries make the sustaining effect more severe, and it points to a DynamoDB incident about a year later, where storage nodes didn't back off from retrying for membership data and produced "a massive workload amplification."

Each of those changes looked right from inside one component. Bronson and colleagues identify the constraint. "A major challenge with adaptive policies is coordination, as retry and failover decisions are made by each client." A client can see its own failures. It can't see how many other clients are retrying the same dependency, or how close that dependency is to its hidden capacity.

## Who May Retry Is an Architecture Decision

Every source above reaches the same fix from a different direction. Each one takes a decision away from the caller acting alone and gives it to something that can see more of the system. The first row comes before them all, since the systems studied had no choice about it.

| Decision | Who makes it by default | Who should make it | Mechanism |
| --- | --- | --- | --- |
| Whether a call retries at all | Every client and proxy on the path | The domain, by the kind of work | Fail or queue a business transaction, and retry infrastructure work with the controls below |
| Which layer retries | Every client on the path | One layer per call path | Retry only above the layer that rejects, and pass a "don't retry" signal up |
| How much retry traffic is acceptable | Each request, on its own | The client or process, against all its traffic | A retry budget, an SDK retry quota, or gRPC retry throttling |
| When callers should wait or stop | The caller's backoff schedule | The overloaded service | `Retry-After`, gRPC pushback, and a retry policy in the service config |
| Who fills the cache after a miss | The application, which times out first | The cache | A read-through cache with its own, longer timeout |

### Most Business Transactions Shouldn't Retry at All

Nearly every incident this post draws on comes from infrastructure: a lease manager renewing leases, storage servers retrying a lock service, storage nodes fetching membership data, a replica set under load. Work like that has no user to hand a failure to. A lease has to be renewed and a replica has to catch up, so retrying is the job, and the open question is how to do it without holding the system down. Most teams mostly build business transactions instead, where a person or a calling process is waiting on an answer.

For a synchronous business transaction, a retry rarely buys much. The causes that make a call fail, like an overloaded database, a dependency that's down, or a bad deploy, tend to last longer than the transaction's own timeout. The retry meets the same failure and adds load while it does. Retrying can also put the transaction itself at risk. When a call times out, the caller can't tell whether the first attempt committed, and the standard .NET handler retries a `POST` like any other call. Failing cleanly and telling the user leaves the decision with the one party who knows whether trying again is worth it, and a person retrying by hand tends to wait minutes, not milliseconds.

Work that doesn't have to finish right now has a better home than a retry loop, which is a queue. A consumer pulls at its own pace, so the load on the dependency is capped by the consumer's concurrency rather than by how many requests arrive, and an overload turns into a backlog instead of more traffic. A thousand synchronous callers retrying have no such cap. Queues bring their own problems, like wait times and work that goes stale before it runs, which is how AWS's lease manager collapsed, and they need their own fixes.

Zero is a valid answer to which layer should retry, and for a synchronous business call it's often the right one. The fixes that follow are for work that has to retry, including the replica syncs, webhook delivery, and integration jobs most teams also run.

### One Layer Retries

Google's SRE book states the rule for deep stacks in its chapter on handling overload. "Requests should only be retried at the layer immediately above the layer that is rejecting them." Brooker's version, Amazon's practice for low-cost operations, is to "retry at a single point in the stack." Both agree it should be one layer, chosen for the whole call path rather than by whoever wrote each client.

A single layer only holds if the layers above it can tell spent retries from an ordinary failure. Google's services answer with an "overloaded; don't retry" error once the retrying layer gives up. HTTP has no status code that means that. The standard handler retries every 5xx, so a service that turns its dependency's exhausted retries into a `503` invites every caller above it to retry the whole chain. A team needs its own convention, and the callers have to honor it:

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

The header name doesn't matter, as long as every caller honors it.

### A Budget Caps Retries Against Total Traffic

A per-request limit like "three retries" caps how much one request can multiply, not how much the fleet does. Google's chapter on handling overload pairs its per-request limit of three attempts with a per-client budget, where each client retries only while retries are under 10% of its requests. In the chapter's worst case, where a datacenter rejects most of what it receives, the per-request limit alone lets load grow to just under three times, and the 10% budget holds it to 1.1 times.

Some client libraries already carry a budget like this. The AWS SDKs' standard retry mode includes a retry quota, a token bucket that each retry draws down and each success refills, so that when it runs dry the SDK "returns the error without retrying." gRPC's retry guide describes throttling that works the same way per server, pausing retries when the token count falls below half. Huang and colleagues show why a cap matters at all. A policy of at most two retries can't amplify work more than three times, "while the policy with no cap effectively leaves the system with no stable region."

The standard .NET handler's defaults cap retries per request, but no budget measured against total traffic. Whether a dependency needs one is a decision to make for that dependency, not a default to inherit.

### The Overloaded Service Gets a Say

The service that's failing is the one component that knows it's overloaded, and a retry policy written into each client gives it little say. gRPC's retry design takes the other view. The first sentence of its design proposal, A6, is that the client library "will automatically retry failed RPCs according to a policy set by the service owner," published through the service config. A server can also push back on individual calls with `grpc-retry-pushback-ms` metadata. A delay tells the client when it may retry, and a negative value tells it not to retry at all.

HTTP's nearest equivalent is `Retry-After` on a `429` or `503`, and the standard .NET handler honors it by default in place of its own backoff. The same handler retries a `429 Too Many Requests`, so an HTTP service can delay its callers' retries but can't refuse them without a convention like the one above. Bronson and colleagues also suggest handling retried requests at lower priority, so that fresh user requests succeed and the retries stop being needed.

### Cache Fills Belong to the Cache

The look-aside cache has an authority problem of its own. Bronson and colleagues observe that prioritizing cache fills over serving clients during overload "is unenforceable with a look-aside cache but trivial with a read-through cache." A read-through cache can wait longer on the database than the application does, so even after the application gives up, the result still lands in the cache and the hit rate climbs until the system recovers. As they put it, "the software structure encodes implicit priorities."
