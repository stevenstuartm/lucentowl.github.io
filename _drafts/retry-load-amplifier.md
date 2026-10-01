---
layout: post
title: "Your Retry Policy Is a Load Amplifier"
description: "Retries spend a struggling dependency's capacity on each caller's behalf, and when every caller decides that alone, they become the feedback loop that holds a system down after the trigger is gone. How much a system may retry, and where, is an architecture decision: one layer that retries, a budget measured against total traffic, and a way for the overloaded service to say stop."
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

The outage ended an hour ago, and your retries didn't get the memo. On October 20, 2025, AWS restored DNS for DynamoDB's us-east-1 endpoint by 2:25 AM Pacific, and by 2:40 AM clients could connect again. EC2's DropletWorkflow Manager, the system that holds a lease on every physical server behind EC2, didn't recover with it, and AWS's summary describes a retry loop. Re-establishing all those leases took long enough that the work "could not be completed before they timed out," more work was queued to try again, and the manager "entered a state of congestive collapse and was unable to make forward progress." It stayed there until 4:14 AM, when engineers throttled incoming work and restarted hosts to clear the queues, and it didn't hold leases on every server again until 5:28 AM.

The trigger was fixed, and the system stayed down anyway. What I find most unsettling about that shape is that the mechanism holding the system down was built on purpose. Every caller that retries, every timeout, and every cache exists because it made the system more reliable or more efficient for someone. My argument is that these mechanisms combine into a loop that nobody configured as a whole, because each caller configured its own piece. Deciding how much a system may retry, and at which layer, is an architecture decision. Most systems leave it as a client setting.

## Some Outages Outlive Their Trigger

### A Trigger Starts It, and a Feedback Loop Keeps It Going

Nathan Bronson, Abutalib Aghayev, Aleksey Charapko, and Timothy Zhu named this pattern in "Metastable Failures in Distributed Systems" (HotOS 2021), drawing on a decade of operating hyperscale systems, much of it at Facebook. A metastable failure is a bad state "that persists even when the trigger is removed," held there by a sustaining effect, "often involving work amplification." Leaving it "requires a strong corrective push, such as rebooting the system or dramatically reducing the load," which is exactly what AWS's engineers did.

Their simplest example needs nothing exotic. A web application sends one query per user request to a database that answers in under 100 ms below 300 queries per second and slows sharply above it. The application retries any query that hasn't returned within a second. At 280 user requests per second the system is healthy. Then a 10-second network blip drops traffic between the application and the database, and when it clears, the backlog of requests and retries lands at once. The database slows, every query starts taking longer than a second, and every query is now sent twice. Load settles at 560 queries per second against a database that can serve 300, so nearly every query times out and the application serves nothing. The network has been fine for minutes by then. By the paper's arithmetic, the system recovers only if user load falls below 150 requests per second or retries fall below 20 per second.

The authors are explicit about where to look afterward. "It is common for an outage that involves a metastable failure to be initially blamed on the trigger, but the true root cause is the sustaining effect." A bad deploy, a network blip, or a traffic spike can each be the trigger. The loop is what turns any of them into an outage.

### Retries Sustain Most of the Outages Studied

Lexiang Huang and colleagues tested whether the pattern shows up beyond one company in "Metastable Failures in the Wild" (OSDI 2022). They sifted hundreds of public incident reports and studied 22 metastable failures across 11 organizations, including AWS, Google Cloud, Azure, IBM, Spotify, Elasticsearch, and Wikimedia. At least 4 of 15 major AWS outages in the previous decade were metastable. Most of the incidents lasted hours, not minutes. The most common duration was 4 to 10 hours, and IBM's lasted more than three days.

The sustaining effects varied, but one dominated. "By far, the most common sustaining effect is due to the retry policy, affecting more than 50% of the studied incidents."

They also reproduced the pattern in a lab, on a three-replica MongoDB cluster with clients that retried up to four times after a 3-second timeout. Cutting the primary's CPU by 78% for 10 seconds produced a dip, and the system recovered. Cutting it by 80% for the same 10 seconds produced a system that never recovered. Attempted requests climbed to about three times the baseline, and useful throughput fell by about 90%. Two percentage points of CPU separated a blip from an outage, and "the client retry mechanism provides the feedback loop."

### The Efficient System Is the Vulnerable One

Nothing in either paper requires hyperscale. The retry example runs at 280 requests per second, and the incident list includes much smaller organizations than AWS. What matters is how close a system runs to the point where it can no longer heal itself, which Bronson and colleagues call its hidden capacity. Below it, a trigger causes errors that stop when the trigger does. Above it, the system is healthy but vulnerable, and it "can run for months or years in the vulnerable state" before a trigger arrives.

Their cache example shows how teams end up there. A look-aside cache with a 90% hit rate lets an application built on that same 300-query database serve 3,000 requests per second. Its hidden capacity is still 300, because if the cache empties, every request goes to the database. The authors point out that a better cache looks like a chance to reclaim database capacity, a change "easy to measure and reward," and "a false economy if the system can no longer recover from cache loss." The more a team optimizes the common case, the further above its hidden capacity it runs. Bronson and colleagues note that many of these loops grow stronger with scale, so a hyperscaler feels them hardest. But the retry arithmetic works the same at 280 requests per second, and a small system tuned for efficiency is still exposed.

## Every Caller's Reasonable Choice Multiplies

### Each Layer Retries by Default

In .NET, `AddStandardResilienceHandler()` gives an `HttpClient` a retry strategy that, according to Microsoft's documentation on building resilient HTTP apps, retries up to three times with exponential backoff and jitter, on any status of 500 or above, 408, or 429, for every HTTP method. The AWS SDKs reference guide sets the default at three attempts for most services, and four for DynamoDB. Both are sensible defaults for one caller, and both are set per client.

Put the standard handler on three hops in a row, and one user action that keeps failing can reach the bottom service four times per attempt at each hop. That's 4 × 4 × 4, or 64 attempts, which is the same figure Google's SRE book uses in its chapter on addressing cascading failures, with retries at the JavaScript, frontend, and backend layers. Marc Brooker's Amazon Builders' Library article on timeouts and retries runs the same arithmetic on a five-deep stack with three tries at each layer and gets 243 times the load on the database, "making it unlikely to ever recover." The standard handler also includes a circuit breaker that opens when 10% of at least 100 calls in 30 seconds fail, which cuts that worst case short. But each breaker judges only its own instance's traffic, and it lets a trial call through five seconds after it opens.

Brooker gives the underlying trade its plainest name. "Retries are 'selfish.' In other words, when a client retries, it spends more of the server's time to get a higher chance of success." When failures are rare, the trade works. When failures come from overload, retries "can even delay recovery by keeping the load high long after the original issue is resolved."

### Timeouts and Caches Feed the Same Loop

A retry starts when a timeout expires, so the timeout sets how fast the loop spins up. Huang and colleagues found that a short timeout is good for latency on small transient issues but "can hurt the system's ability to handle larger problems by quickly starting the workload amplification." AWS's 2014 SimpleDB outage listed a short handshake timeout as a contributing factor to starting and sustaining the overload. In Huang's cache experiment, raising the request timeout from one second to two made the system less vulnerable at every load level tested.

A timeout also abandons work without stopping it. When a caller gives up and retries, the server may still be running the first attempt, so the retry adds new work while the old work finishes for nobody. The fix on the server side is passing the request's cancellation token through to every query and outbound call, so abandoned work stops with its caller.

The look-aside cache fails the same way from the other direction. The application is responsible for filling the cache, but when the database slows past the application's timeout, the application gives up before it gets a result to store. The hit rate stays low, the database stays overloaded, and in Bronson's words, "losing a cache with a 90% hit-rate causes a 10× query amplification."

### Local Fixes Can Strengthen the Loop

A team that treats retries as its own setting will tend to fix the next incident locally, and Huang and colleagues document how that goes wrong. In the 2014 SimpleDB outage, storage servers timed out and retried against an overloaded lock service, then demoted themselves after several retries. Afterward, according to the paper, engineers decided the servers must keep retrying the lock service instead of giving up, since giving up looked like the reason recovery went badly. The paper argues that unlimited retries make the sustaining effect more severe, and it points to a similar incident at DynamoDB about a year later, where storage nodes didn't back off from retrying for membership data and produced "a massive workload amplification." Spotify's version was logging. After one incident, engineers added detailed logging to the error path to understand it, and in the next incident that logging made every retry more expensive.

Each of those changes looked right from inside one component. Bronson and colleagues name the constraint. "A major challenge with adaptive policies is coordination, as retry and failover decisions are made by each client." A client can see its own failures. It can't see how many other clients are retrying the same dependency, or how close that dependency is to its hidden capacity.

## Who May Retry Is an Architecture Decision

Every source above reaches the same fix from a different direction. Each one takes a decision away from the caller acting alone and gives it to something that can see more of the system.

| Decision | Who makes it by default | Who should make it | Mechanism |
| --- | --- | --- | --- |
| Whether to retry a call | Every client on the path | One layer per call path | Retry only above the layer that rejects, and pass a "don't retry" signal up |
| How much retry traffic is acceptable | Each request, on its own | The client or process, against all its traffic | A retry budget, an SDK retry quota, or gRPC retry throttling |
| When callers should wait or stop | The caller's backoff schedule | The overloaded service | `Retry-After`, gRPC pushback, and a retry policy in the service config |
| Who fills the cache after a miss | The application, which times out first | The cache | A read-through cache with its own, longer timeout |

### One Layer Retries

Google's SRE book states the rule for deep stacks in its chapter on handling overload. "Requests should only be retried at the layer immediately above the layer that is rejecting them." Brooker's version, Amazon's practice for low-cost operations, is to "retry at a single point in the stack." The two place that point differently. Brooker notes that retrying high in the stack can waste the work the lower calls already did. Both agree it should be one layer, chosen for the whole call path rather than by whoever wrote each client.

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

The header name doesn't matter. What matters is that one layer owns the retry and every other layer can see that it already happened.

### A Budget Caps Retries Against Total Traffic

A per-request limit like "three retries" caps how much one request can multiply, not how much the fleet does. When most requests are failing, three retries each still means nearly three times the load. Google's chapter on handling overload pairs its per-request limit of three attempts with a per-client budget, where each client retries only while retries are under 10% of its requests. In the chapter's worst case, where a datacenter rejects most of what it receives, the per-request limit alone lets load grow to just under three times, and the 10% budget holds it to 1.1 times. The cascading failures chapter suggests a server-wide version too, such as 60 retries per minute per process, after which requests fail instead of retrying.

Some client libraries already carry a budget like this. The AWS SDKs' standard retry mode includes a retry quota, a token bucket that each retry draws down and each success refills, so that when it runs dry the SDK "returns the error without retrying." gRPC's retry guide describes throttling that works the same way per server, pausing retries when the token count falls below half. Brooker notes that AWS added this behavior to its SDK in 2016 as an alternative to circuit breakers, which "introduce modal behavior into systems that can be difficult to test." Huang and colleagues show why a cap matters at all. A policy of at most two retries can't amplify work more than three times, "while the policy with no cap effectively leaves the system with no stable region."

The standard .NET handler's defaults cap retries per request, with a concurrency limit and a circuit breaker, but no budget measured against total traffic. Whether a dependency needs one is a decision to make for that dependency, not a default to inherit.

### The Overloaded Service Gets a Say

The service that's failing is the one component that knows it's overloaded, and a retry policy written into each client gives it little say. gRPC's retry design takes the other view. The first sentence of its design proposal, A6, is that the client library "will automatically retry failed RPCs according to a policy set by the service owner," published through the service config, not written into each client. A server can also push back on individual calls with `grpc-retry-pushback-ms` metadata. A delay tells the client when it may retry, and a negative value tells it not to retry at all.

HTTP's nearest equivalent is `Retry-After` on a `429` or `503`, and the standard .NET handler honors it by default in place of its own backoff. It's a weaker signal, since it asks the caller to wait rather than to stop. The same handler retries a `429 Too Many Requests`, the server's own statement that it has too much work, so an HTTP service can delay its callers' retries but can't refuse them without a convention like the one above. Bronson and colleagues suggest one more lever the service owns, which is to handle retried requests at lower priority, so that fresh user requests succeed and the retries stop being needed.

### Cache Fills Belong to the Cache

The look-aside cache has an authority problem of its own. The component responsible for filling the cache, the application, is the one that gives up first. Bronson and colleagues observe that prioritizing cache fills over serving clients during overload "is unenforceable with a look-aside cache but trivial with a read-through cache." A read-through cache can wait longer on the database than the application does, so even after the application gives up, the result still lands in the cache and the hit rate climbs until the system recovers. The fix moves responsibility for the fill to the component that keeps running. As they put it, "the software structure encodes implicit priorities."

## Checking Your Own Call Path

For one user request that crosses several services this week:

- Count every layer that retries the same call, including SDK defaults, HTTP handlers, gateways, service meshes, and the browser, and multiply their attempts
- Find the one layer that should own the retry, and check what the layers above it do with its failure
- Look for a retry budget measured against total traffic, not just a per-request limit, and check whether your SDK's quota is on or off
- Check whether an overloaded dependency can tell callers to stop, and whether your clients listen
- Check whether abandoned requests keep running after the caller times out
- Find the timeout that starts each retry, and ask how quickly the loop would spin up under a two-minute blip

If the multiplied number surprises you, that's the load your system will send its weakest dependency on its worst day. Each retry was added for a reason, and each one makes sense on its own. The loop they form only exists at the level of the whole path, so that's where someone has to own it.
