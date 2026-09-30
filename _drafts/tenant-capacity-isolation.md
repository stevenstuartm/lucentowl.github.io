---
layout: post
title: "Tenant Isolation Is a Quota You Haven't Set"
description: "Every shared resource in a pooled multi-tenant system already divides its capacity among tenants, and without a per-tenant limit it divides it first come, first served, so the heaviest tenant decides what everyone else gets. Per-tenant rate, concurrency, and queue limits, plus tenant placement, are the capacity boundary, and they belong at every shared resource by design rather than at the front door during an incident."
tags: [architecture, multi-tenancy, noisy-neighbor, rate-limiting, saas]
author: steven-stuart
sources:
  - title: "David Yanacek: Fairness in Multi-Tenant Systems (Amazon Builders' Library)"
    url: "https://builder.aws.com/content/3Eupj3d2bo4fEvlzYbICMZNhQ3B/fairness-in-multi-tenant-systems"
  - title: "AWS Well-Architected Framework: SaaS Lens"
    url: "https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html"
  - title: "Multi-Tenant Architecture"
    url: "/study-guides/architecture/multi-tenant-architecture.html"
  - title: "David Yanacek: Avoiding Insurmountable Queue Backlogs (Amazon Builders' Library)"
    url: "https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs"
  - title: "Rate Limiting and Request Timeouts"
    url: "/study-guides/dotnet/asp/aspnet-rate-limiting-resilience.html"
  - title: "Colm MacCárthaigh: Workload Isolation Using Shuffle-Sharding (Amazon Builders' Library)"
    url: "https://builder.aws.com/content/3F06NpJ8YeoIGP8VHTw4n81pFn8/workload-isolation-using-shuffle-sharding"
  - title: "Performance and Scalability Patterns"
    url: "/study-guides/architecture/performance_scalability_patterns.html"
---

You isolated every tenant's data. Their traffic still shares one queue.

David Yanacek, an engineer at Amazon, opens his Builders' Library article "Fairness in Multi-Tenant Systems" with an on-call page. The deployment tool his team ran had slowed down, and he couldn't see why. The cause turned out to be a different tool, a fleet auditor, running its nightly synchronization job against the database the two tools shared. "The fleet auditor tool didn't mind that the database was slow," he writes, "but the deployment tool (and its users) sure did!"

Those were two internal tools owned by one team, but in a pooled SaaS product the same thing happens between customers. Teams building multi-tenant systems tend to spend their isolation effort on data, with tenant keys, query filters, and row-level security, because a cross-tenant leak is a security incident. Capacity gets less attention.

Every shared resource still has to decide how its capacity is divided when tenants want more than it has, and without a per-tenant limit it decides first come, first served. That hands the decision to whichever tenant asks fastest. Per-tenant limits and tenant placement are how the system takes that decision back, and they belong in the design at every shared resource, not only at the front door and not only after an incident.

## Every Shared Resource Already Has an Allocation Policy

A connection pool, a worker queue, a thread pool, and a third-party API quota each serve requests in roughly the order they arrive. That's an allocation policy even though nobody wrote it down. When demand fits within capacity, the order doesn't matter. When it doesn't, the tenant that sends the most work gets the most capacity, and every other tenant waits behind it.

Yanacek explains why a sudden surge usually comes from one tenant. Each customer has its own use case and request rate, so load from different tenants tends to be uncorrelated, and when a service's total load rises abruptly, "that increase is most likely driven by a single tenant." Load shedding, which rejects excess work cheaply to protect the service, doesn't fix this by itself, because it rejects requests from everyone. The tenant who caused the spike and the tenants who did nothing unusual all see the same errors. Amazon's answer is to enforce quotas "at a per-tenant or per-workload granularity," so that the unplanned part of one tenant's load is what gets rejected and the rest continue with predictable performance.

### The Incident Looks Like General Slowness

A capacity problem caused by one tenant shows up as latency for all of them. Dashboards aggregated across the service show the database working hard and response times rising, and nothing in them names a tenant. Yanacek could work out the cause because both tools belonged to his team. A system with hundreds of tenants needs data instead, which is why the AWS SaaS Lens asks for "tenant-aware" operational views, with consumption and health metrics published with tenant context. Without per-tenant usage, the responders can see the symptom, but they can't see who caused it or what limit would have stopped it.

> **AUTHOR** — the author's experience goes here: capacity contention between tenants on the banking platform serving 200+ institutions, or on the multi-vertical inventory platform, and how the incident first presented.

## The Front Door Limit Isn't the Boundary

The usual first step is a per-tenant rate limit at the API edge. The SaaS Lens shows it with API Gateway usage plans, one per tier, and the site's Multi-Tenant Architecture guide shows the same thing in ASP.NET Core with a limiter partitioned by tenant ID. It's the right first step. But a request limit bounds how often a tenant can knock, not how much work it can cause once it's inside, and the contention points in most pooled systems sit behind the edge.

### Rate Limits Count Requests, Not Cost

A query returning one row and a query returning a megabyte of rows each cost one request against a rate limit. Yanacek notes that some services give expensive operations lower quotas, and some charge a request as the cheapest kind up front, then debit the tenant's quota by its true cost after it completes, "possibly even pushing their quota negative." A tenant can stay well inside its request budget while running exports, reports, or unbounded searches that saturate the database for everyone. Maximum page sizes, query timeouts, and moving heavy operations to asynchronous jobs are the limits that bound cost, and a request counter doesn't provide them.

### A Shared Queue Loses Tenant Identity

Asynchronous work is where missing limits hurt most, because a queue turns a short spike into a long outage. In a companion article, "Avoiding Insurmountable Queue Backlogs," Yanacek works through an example. One customer's unthrottled spike creates a system-wide backlog. It takes about 30 minutes for an operator to engage, find the cause, and mitigate it. If the queued volume by then is ten times what the consumers are scaled to handle, working through it takes 300 minutes. "Even short load spikes can result in multi-hour recovery times," he writes, and every tenant whose messages sit behind the spike waits through all of it.

He puts the structural problem in one line: "a single queue and multitenancy are at odds with each other." Once one tenant's messages are interleaved with everyone else's in arrival order, the consumer can't serve anyone else first without dequeuing them. His article describes what Amazon's systems do instead. Some give each customer its own queue, which works for a handful of tenants and gets unwieldy past that. Lambda hashes each customer to a small number of queues from a fixed set and enqueues into whichever of those is shortest, so a surge backs up its own queues while other tenants are routed away from them. Some consumers track a per-customer rate and move messages from a tenant over its rate into a spillover queue that's processed when capacity frees up. Each of these puts a per-tenant boundary back into the queue, whether in where a message is enqueued or in what the consumer does with it.

### Concurrency Grows When a Dependency Slows

A rate limit also doesn't bound concurrency. Yanacek uses Little's Law to show why. The work in flight equals the arrival rate times the average latency. A consumer handling 100 messages a second at 100 ms each uses about 10 threads. If a downstream call slows to 10 seconds, the same arrival rate needs about 1,000. One tenant whose integration target becomes slow can hold every worker in the pool while staying under its rate limit the whole time. Amazon's systems cap the concurrency each workload can use at any instant, with a separate semaphore or thread pool per workload.

.NET has the pieces for this in `System.Threading.RateLimiting`, the same library behind ASP.NET Core's rate limiting middleware, and its partitioned limiter isn't tied to HTTP. A queue consumer can partition a concurrency limiter by tenant:

```csharp
public sealed class ImportConsumer(IImportQueue queue, IOrderImporter importer)
{
    // At most four imports per tenant in flight on this instance. A tenant with
    // ten thousand queued imports gets four workers, and the rest of the pool
    // stays free for everyone else.
    private readonly PartitionedRateLimiter<string> _perTenant =
        PartitionedRateLimiter.Create<string, string>(tenantId =>
            RateLimitPartition.GetConcurrencyLimiter(tenantId, _ =>
                new ConcurrencyLimiterOptions { PermitLimit = 4, QueueLimit = 0 }));

    public async Task HandleAsync(ImportMessage message, CancellationToken ct)
    {
        using var lease = await _perTenant.AcquireAsync(message.TenantId, 1, ct);
        if (!lease.IsAcquired)
        {
            // Over its share. Move the message to a spillover queue instead of
            // holding a worker while it waits.
            await queue.SidelineAsync(message, ct);
            return;
        }

        await importer.ImportAsync(message, ct);
    }
}
```

With `QueueLimit` at zero, a tenant at its limit gets an unacquired lease immediately rather than waiting, so its excess messages are dequeued and set aside cheaply, and the workers move on to other tenants' messages. The spillover queue drains when the main queue has room. The limiter is in memory, so each consumer instance enforces its own four, and a tenant's share of the fleet scales with the instance count. The site's Rate Limiting and Request Timeouts guide covers the limiter types, and how to enforce a limit across instances when it has to be exact.

## Placement Decides Who Shares the Damage

Limits bound how much capacity a tenant can use. They don't help when a single request is the problem, such as one that crashes a worker, triggers a pathological query plan, or breaks a node in some way no counter anticipates. What contains the damage then is how few other tenants share the resources that tenant's work lands on.

Colm MacCárthaigh's Builders' Library article on shuffle sharding answers it with an example of eight workers. Split them into four shards of two, and a customer whose requests break their shard takes down the other customers on it, a quarter of the service. Instead, give each customer its own pair of workers chosen from all eight. There are 28 possible pairs, so a problem customer affects about 1/28th of the service, and a customer who shares one worker with it still has the other. Route 53 applies the same idea with 2,048 virtual name servers and four per customer, for about 730 billion possible combinations. The technique has a condition. Clients have to tolerate one failed worker, typically by retrying against the other.

Most SaaS systems don't need combinatorial placement, but they do need placement to be a decision they can change. Deployment stamps, sharded databases, and tier-based pools all bound how many tenants share each failure. At the far end, a silo tenant with its own deployment needs no per-tenant limit on resources it doesn't share, and a system with a handful of tenants can give each one its own queue. The argument applies to whatever is pooled. The site's Performance and Scalability Patterns guide treats a heavy tenant as a hot spot, one key drawing a disproportionate share of traffic that an even hash can't spread. A tenant catalog that maps each tenant to its shard or stamp is what makes moving that tenant routine rather than a migration project.

## A Quota Doesn't Have to Waste Capacity

The usual objection is headroom. If the pool is sized well above normal load, a fixed per-tenant limit seems like it would only reject work the system could have done. Yanacek addresses this directly, and his answer changes what a quota means rather than whether to have one.

Hard-allocating capacity, a fixed third for each of three tenants, does waste whatever share a quiet tenant leaves unused. Amazon also runs quotas that stack. A tenant over its quota can burst into capacity other tenants aren't using, and when those tenants come back, their traffic takes priority over the burst. In his example, a client limited to 1,000 transactions per second spikes to 3,000 on a service scaled for 10,000 and currently serving 5,000. The service can let the excess through, begin dropping it only as other clients use more of their own quotas, and treat the burst as a signal for both sides. The tenant is at risk of errors, and the service may need to scale and raise that tenant's limit.

Headroom decides how generous the limits can be, not whether they're needed. More headroom raises the size of spike the system absorbs, but a runaway integration or a bulk import can outgrow any sizing, and a spike that outruns the consumers still becomes hours of recovery for every tenant behind it. Burst capacity only works when there's a quota to burst past. Without one, the heavy tenant's excess and everyone else's normal load have the same priority, which in a shared queue means arrival order.

### Every Quota Costs the Tenant It Limits

In Yanacek's phrasing, the use of quotas "paradoxically both increases and decreases the availability of a service." The tenant over its limit sees errors, perhaps while the service had spare capacity. That cost is why limits need to be visible to the tenants they constrain, as a documented number, a metric the tenant can alarm on as it approaches the limit, and a `429 Too Many Requests` response with a `Retry-After` header rather than a slowdown. A published limit is a contract that tenants can write code against, and a tenant can't plan around a slowdown it didn't know was a limit.

### Limits Set During an Incident Are Guesses

A limit chosen under pressure is a guess, made without per-tenant usage data, pushed through a configuration path that may not have been built for fast changes. Yanacek describes deploying quota changes first in an evaluation mode, which checks that a rule would hit the right traffic before it takes effect. That's hard to do during an outage. The SaaS Lens adds a business reason. Tiers are also a pricing decision, and a basic tier may be limited "even if your system could accommodate the load," so that what a tenant consumes matches what it pays.

## Checking Your Own System

Each shared resource runs out of something different, so each needs its own kind of limit:

| Shared resource | What one tenant can exhaust | Per-tenant control |
| --- | --- | --- |
| API edge | Request rate | Rate limit per tenant, sized by tier |
| Database | Query cost and connections | Page sizes, query timeouts, a cap on each tenant's concurrent queries, and asynchronous jobs for heavy operations |
| Worker queue | Everyone's place in arrival order | Queues per tenant or shuffle-sharded queues, and spillover for tenants over their rate |
| Worker or thread pool | Concurrency, which grows as a downstream call slows | Concurrency limit per tenant |
| Third-party API quota | The provider's limit, shared by every tenant | A share of that quota per tenant |
| Shard or stamp | Everything on it, when a request breaks it | Placement recorded in a tenant catalog, so a tenant can be moved |

For one pooled service this week:

- List every shared resource a tenant's work reaches, including the API edge, database connection pools, worker queues, thread pools, caches, and third-party quotas
- For each one, find the per-tenant limit on it. Where there isn't one, first come, first served is the policy
- Pick your largest tenant's heaviest operation, such as an import, export, or month-end report, and ask whether running it now would raise every other tenant's latency
- Check whether your latency and queue-age metrics can be broken down by tenant, and whether an on-call engineer could name the tenant behind a slowdown without guessing
- Check whether a tenant can see its own limits and usage before it hits them

If one tenant's batch job can raise everyone's latency, the system already has a capacity policy. It's just one nobody chose, and the tenant with the biggest workload is the one applying it.
