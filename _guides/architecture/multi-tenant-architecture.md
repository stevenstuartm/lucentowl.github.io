---
layout: guide
title: "Multi-Tenant Architecture"
category: Architecture
subcategory: Design
description: "Serving many customers from shared infrastructure: silo, pool, and bridge tenancy models, database-per-tenant versus shared-schema data isolation with row-level security, resolving and propagating tenant context, containing noisy neighbors, and operating a fleet of tenants across tiers."
tags: [practical, multi-tenancy, tenant-isolation, noisy-neighbor, row-level-security, deployment-stamps, saas]
---

A multi-tenant system serves many customers, or tenants, from shared infrastructure. The central design decision is how much each tenant shares with the others. Every step toward sharing lowers the cost per tenant and raises the chance that one tenant's load, data, or failure reaches another.

## Tenants, Users, and Deployments

A tenant is the unit of isolation and billing, not the unit of login. In a business-to-business product a tenant is usually a customer organization with many users, and a single user, such as a consultant or an accountant, can belong to several tenants. In a consumer product a tenant might be one person, or a household or club that shares data. Deciding what a tenant is comes first, because it decides what "another tenant's data" means.

Three scopes nest inside each other, and many design mistakes in this area come from blurring them:

| Scope | What it is | Isolation question it answers |
|---|---|---|
| **Deployment** | One set of running infrastructure, sometimes called a stamp or cell | Which tenants share a blast radius, a region, and a release |
| **Tenant** | One customer's logical slice of a deployment | Whose data and capacity this request may touch |
| **User** | One identity acting inside a tenant | What this person may do within that slice |

User authorization and tenant isolation are separate checks. A user with an admin role in tenant A holds no rights in tenant B, and code that checks only the role grants them anyway. The mapping between tenants and deployments can be one-to-one, when a tenant has dedicated infrastructure, or many-to-one, when tenants share it. A system that records that mapping in a catalog can move a tenant between deployments later without the tenant noticing.

Isolation is also not one decision for the whole system. Data, compute, and identity each get their own answer, and a single architecture often pools its web tier while giving each tenant its own database.

## Tenancy Models

The [AWS SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html){:target="_blank" rel="noopener noreferrer"} names three models, and the [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models){:target="_blank" rel="noopener noreferrer"} describes the same range with different names.

| Model | Azure term | What tenants share | Strength | Cost |
|---|---|---|---|---|
| **Silo** | Automated single-tenant deployments | Nothing below onboarding, identity, and operations | Strongest isolation, per-tenant configuration, no noisy neighbors | Infrastructure cost scales linearly with tenants, and every change is rolled out N times |
| **Pool** | Fully multitenant deployment | All compute, storage, and messaging | Lowest cost per tenant, one thing to deploy and monitor | Isolation lives in application code, one bad change or one heavy tenant affects everyone |
| **Bridge** | Horizontally or vertically partitioned deployments | Some layers or some tenants, not others | Isolation spent where it's needed | The codebase has to run correctly in both shapes |

A silo tenant still differs from a customer running their own copy of the product. In a silo model every tenant is onboarded, authenticated, deployed, and operated through the same shared pipeline and runs the same version. Once individual customers get their own release cadence or code branches, the system has become managed hosting, and the operational savings that justified multi-tenancy are gone.

### Bridge Along Layers or Along Tenants

The bridge model comes in two shapes, and they solve different problems.

**Along layers**, some components are pooled and others are siloed for every tenant. A shared application tier writing to one database per tenant is the common case. It fits when one layer carries most of the load or most of the compliance risk, since isolating that layer buys most of the benefit.

**Along tenants**, most tenants share a pooled deployment and a few get dedicated ones. This usually maps to pricing tiers, with a premium or enterprise tier buying a silo. Keep the silo a clone of the pooled deployment serving one tenant, running the same code and version, so the fleet stays operable as one product. The more tenants move into silos, the more the system inherits silo costs.

### Deployment Stamps

A pooled deployment eventually hits a limit, whether a database's throughput ceiling, a cloud quota, or a blast radius the business won't accept. The [Deployment Stamps pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp){:target="_blank" rel="noopener noreferrer"} answers this by running several identical copies of the deployment and assigning tenants across them. Each stamp is internally a pool, and the fleet as a whole scales out by adding stamps rather than by growing one deployment indefinitely.

Stamps turn tenant placement into a routing problem. A tenant catalog maps each tenant to its stamp, and something in front of the stamps reads that mapping on every request.

```
                     Request carrying a tenant identity
                                   │
                                   ▼
                       ┌─────────────────────┐        ┌──────────────────┐
                       │  Global router or   │◀──────▶│  Tenant catalog  │
                       │  gateway            │        │  tenant → stamp  │
                       └──────────┬──────────┘        └──────────────────┘
                 ┌─────────────────┼──────────────────────┐
                 ▼                 ▼                      ▼
        ┌────────────────┐ ┌────────────────┐    ┌────────────────┐
        │ Stamp 1 (pool) │ │ Stamp 2 (pool) │    │ Stamp 3 (silo) │
        │ Tenants A, B, C│ │ Tenants D, E   │    │ Tenant F only  │
        │ shared app, DB │ │ shared app, DB │    │ same code,     │
        └────────────────┘ └────────────────┘    │ dedicated infra│
                                                 └────────────────┘
```

Moving tenant E from stamp 2 to stamp 3 means copying its data and then changing one catalog row. Stamps also give releases a natural rollout order, with each stamp acting as a wave.

## Data Isolation

Data is where a tenancy mistake does the most damage, because a cross-tenant leak is a security incident rather than a performance problem. Relational systems offer three placements for tenant data, with a fourth that combines them.

| Placement | Isolation | Cost per tenant | Operations at scale | Per-tenant restore and deletion |
|---|---|---|---|---|
| **Database per tenant** | Strong, enforced by separate databases and credentials | Highest, though elastic pools that share capacity across databases reduce it | Every schema migration runs once per database, and the fleet can drift | Simple: restore or drop one database |
| **Schema per tenant** | Moderate, enforced by schema permissions in one database | Moderate | Migrations still run per schema, and the catalog grows with every tenant | Possible but manual |
| **Shared schema with a tenant key** | Depends on every query filtering on the key | Lowest | One migration, one set of indexes | Hard: point-in-time restore rolls back every tenant at once |
| **Sharded pool** | Same as shared schema, within each shard | Low | A handful of shared databases, with a catalog mapping tenants to shards | Same as shared schema, plus moving a tenant means moving its rows |

Per-tenant restore catches teams late. When one tenant deletes a year of records by mistake and asks for them back, a database-per-tenant system restores one database. A shared-schema system has to restore a copy elsewhere, extract that tenant's rows, and merge them back without disturbing anyone else.

Beyond relational tables, the same placement choice applies to everything that holds tenant data, including blob storage paths, search indexes, caches, message topics, and analytics exports. A shared cache keyed by `order:123` rather than `tenant-a:order:123` leaks data as surely as a missing `WHERE` clause.

### Enforcing the Tenant Key in the Application

In a shared schema, the risk is one query that forgets the tenant filter. The defense is to make the filter something developers can't forget, rather than something they have to remember. In EF Core, a global query filter adds the predicate to every query against an entity type, and named filters (EF Core 10 and later) let the tenant filter be disabled independently of others, such as a soft-delete filter.

```csharp
public interface ITenantOwned
{
    Guid TenantId { get; set; }
}

public class AppDbContext(DbContextOptions<AppDbContext> options, TenantContext tenant)
    : DbContext(options)
{
    // Referenced through the context instance, so EF Core reads the current
    // value on every query instead of baking one tenant into the cached model.
    public Guid CurrentTenantId => tenant.TenantId;

    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>()
            .HasQueryFilter("Tenant", o => o.TenantId == CurrentTenantId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            if (entry.State == EntityState.Added)
                entry.Entity.TenantId = CurrentTenantId;
            else if (entry.Entity.TenantId != CurrentTenantId)
                throw new InvalidOperationException("Write crosses a tenant boundary.");
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
```

Application filters cover the paths that go through the ORM, which isn't all of them. Raw SQL, stored procedures, reporting queries, and a second service with its own data access code all bypass the filter. `IgnoreQueryFilters()` is also one call away, which is useful for a cross-tenant admin job and dangerous anywhere else.

### Enforcing It in the Database

Row-level security moves the tenant predicate into the database, so it applies to every connection that uses the application's role, whatever code issued the query. In PostgreSQL, a policy compares each row's tenant key with a setting the application sets per transaction:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The application sets that value inside each transaction:

```csharp
await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

await db.Database.ExecuteSqlAsync(
    $"SELECT set_config('app.tenant_id', {tenantId.ToString()}, true)",
    cancellationToken);

var orders = await db.Orders.ToListAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

Several details decide whether this protects anything. The third argument to `set_config` makes the setting transaction-local. Setting it for the session instead leaves it on the connection, and the connection pool hands that connection, still carrying the previous tenant's ID, to the next request. When no tenant is set, the policy expression raises an error rather than returning rows, either because the setting doesn't exist or because its empty value fails the `uuid` cast, so a missing tenant context fails closed. A policy's `USING` clause also acts as its `WITH CHECK` clause when none is given, so it blocks inserts and updates that write another tenant's key too.

Superusers and roles with the `BYPASSRLS` attribute skip policies entirely, and table owners do too unless the table is set to `FORCE ROW LEVEL SECURITY`. The application should connect as a role that is neither, with migrations running under a separate owner role. Unique constraints and foreign key checks also ignore policies, so a unique index on `email` alone lets one tenant discover that an address exists in another tenant. Scope such constraints to `(tenant_id, email)`. SQL Server offers the same mechanism through security policies with predicate functions, typically reading the tenant from `SESSION_CONTEXT`.

Row-level security and application filters aren't alternatives. The ORM filter keeps queries correct and indexes usable, and the database policy catches the query that escaped the ORM.

## Tenant Context

Every isolation mechanism above depends on knowing which tenant a unit of work belongs to. That value, the tenant context, has to be resolved once from something trustworthy and then carried through every hop the work takes.

### Resolving the Tenant

A request can identify its tenant through a subdomain (`acme.example.com`), a path segment, a header, an API key looked up in a table, or a claim in an access token. The source matters less than whether the value is verified. A subdomain or header says which tenant the caller *wants*, and the system still has to confirm that the authenticated identity belongs to that tenant. A tenant claim issued by the system's own identity provider is the strongest source, since the caller can't alter it without invalidating the token's signature. When a user belongs to several tenants, the token either carries the active tenant, chosen at sign-in, or the request names one and the system checks membership.

```csharp
app.UseAuthentication();

app.Use(async (context, next) =>
{
    // Applies to tenant-scoped endpoints. Health checks and sign-in are mapped
    // separately so they don't require a tenant.
    if (!Guid.TryParse(context.User.FindFirst("tenant_id")?.Value, out var tenantId))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }

    var directory = context.RequestServices.GetRequiredService<ITenantDirectory>();
    var tenant = await directory.FindAsync(tenantId, context.RequestAborted);
    if (tenant is null || tenant.IsSuspended)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }

    context.RequestServices.GetRequiredService<TenantContext>().Set(tenant.Id, tenant.Tier);
    await next(context);
});

app.UseRateLimiter();
app.UseAuthorization();
```

`TenantContext` is registered as a scoped service, so each request gets its own instance. Resolution runs on every request, so the directory lookup is usually cached. Unknown or suspended tenants are rejected here, before any handler runs.

### Carrying It Through Every Hop

Within one HTTP request, a scoped service carries the context. Leaks tend to happen at the boundaries where that request scope ends and new work begins.

```
 HTTP request ──▶ API ──────────────▶ Queue ──────────────▶ Worker ──────────▶ Database
 token claim      TenantContext       message header        TenantContext      transaction-local
 tenant_id        (request scope)     tenant_id             set from header    app.tenant_id
                        │                                   before handler
                        ▼
                  Outbound call ──▶ Downstream service
                  header or token      resolves again
```

A background worker has no HTTP request, so nothing resolves its tenant unless the message carries one. The publisher writes the tenant ID into a message header, and the consumer sets its own scoped `TenantContext` from that header before the handler runs. A consumer that finds no tenant header should reject the message rather than run with an empty context. Scheduled jobs that sweep across tenants should loop over the catalog and open a fresh scope per tenant, so no work runs with one tenant's context while touching another tenant's data. Service-to-service calls carry the tenant in a token or header and resolve it again on arrival instead of trusting the caller's claim blindly.

Tenant context also belongs in telemetry. Adding the tenant ID to logs and traces is what makes a question like "why is tenant C slow" answerable at all.

## Noisy Neighbors

A noisy neighbor is a tenant whose load degrades service for others sharing its resources. It rarely comes from malice. A tenant runs a large import, a month-end report, or an integration with a retry bug, and the shared database or worker pool slows down for everyone. Many tenants whose peaks coincide can cause the same effect without any single one being unusual.

### Where Contention Hides

CPU and memory are the obvious shared resources, but contention also shows up in places that request-rate limits don't reach. Database connection pools and lock contention are one example. A single work queue processed in arrival order is another, since one tenant's burst of ten thousand messages delays every message enqueued after it. Caches with a shared size limit let one tenant's keys evict another's, and a third-party API quota shared across tenants runs out for all of them at once.

### Containing a Noisy Neighbor

Measuring usage per tenant comes before any control, because without it the only symptom is a system that is slow for everyone and a guess about who caused it. The controls below then work at different layers, and most systems combine several.

| Control | How it works | Limits it has |
|---|---|---|
| **Per-tenant rate limits** | Each tenant gets its own request budget, sized by tier | Caps request count, not the cost of each request |
| **Per-tenant concurrency limits** | Caps how many requests or jobs one tenant runs at once | Idle capacity when the tenant is quiet |
| **Fair queuing** | Workers pull from per-tenant queues or partitions in rotation instead of one queue in arrival order | More queues to manage and monitor |
| **Operation limits** | Maximum page sizes, query timeouts, export sizes, with heavy work moved to asynchronous jobs | Tenants with legitimate large workloads need a different path |
| **Pools per tier** | Separate worker pools or deployments for premium and standard tenants, a bulkhead drawn along tenant lines | Capacity partitioned by tier sits idle in one pool while another saturates |
| **Rebalancing** | Move a heavy tenant to a less loaded stamp or shard, or to a dedicated one | Requires tenant placement to be a catalog entry, not a hardcoded assumption |

A per-tenant rate limit in ASP.NET Core partitions the limiter by tenant ID, which also makes the partition count bounded by the number of tenants rather than by attacker-controlled input:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var tenant = httpContext.RequestServices.GetRequiredService<TenantContext>();
        var tokensPerSecond = tenant.Tier == TenantTier.Premium ? 200 : 20;

        // Each partition's options are created once, so the tier is part of the key.
        // A tenant that upgrades moves to a new bucket with its new limit.
        return RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: $"{tenant.TenantId}:{tenant.Tier}",
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = tokensPerSecond * 5,
                TokensPerPeriod = tokensPerSecond,
                ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                QueueLimit = 0
            });
    });
});
```

This limiter lives in one process, so with several instances each enforces its own budget, and a tenant's effective limit multiplies by the instance count. Limits that must hold across instances need a shared store or enforcement at a gateway. Whichever controls apply, tenants should be able to see them. A documented limit returning 429 with a `Retry-After` header is a contract a client can code against, and a silent slowdown is not.

## Operating a Fleet of Tenants

Multi-tenancy moves cost from infrastructure into operations. The work that makes it pay off is automation that treats every tenant, pooled or siloed, through the same path.

### Onboarding and Offboarding

Onboarding a tenant should be one automated workflow that creates the catalog entry, provisions or assigns data storage, seeds configuration, creates the identity mapping, and applies tier limits. A silo tenant runs the same workflow with an infrastructure-as-code step added, not a separate manual runbook. Offboarding is the same workflow in reverse and is easy to leave unbuilt. Contractual and regulatory deletion obligations make it a requirement, and in a shared schema it means deleting rows from every table, cache, index, and backup retention path that holds the tenant's data.

### Schema Changes Across the Fleet

A shared schema migrates once, which is its main operational advantage. With a database per tenant, a migration runs hundreds or thousands of times, and some of those runs fail. Rolling migrations out in waves, keeping schema changes backward compatible so old and new code run against either version, and tracking the schema version per tenant database in the catalog keep a partial rollout from becoming an outage.

### Metering and Cost Attribution

Silo costs attribute directly, since each tenant's resources carry its own bill. Pooled costs have to be apportioned by measuring what each tenant consumes, such as requests, storage, compute time, or database request units, and allocating the shared bill in proportion. The same per-tenant usage data drives tier limits, capacity planning, and pricing, and it shows when a tenant on a standard price is consuming premium-sized resources.

### Moving Tenants Between Tiers

A tenant upgrading from the pool to a dedicated deployment needs its data copied to new storage, kept in sync during the copy, and then cut over by changing its catalog entry. Systems that designed placement as data in the catalog can do this as a routine operation. Systems that assumed a tenant's location in configuration files, connection strings, or DNS need a migration project each time.

### Testing Isolation

Isolation is a property the test suite should prove, not one the design asserts. Automated tests that authenticate as tenant A and request tenant B's resources by ID, through every API, should get back the same response as for a resource that doesn't exist, usually 404, so the response doesn't confirm that the ID belongs to someone. Load tests that drive one tenant hard while measuring another tenant's latency show whether the noisy neighbor controls work before a customer finds out.

## When Not to Go Multi-Tenant

Multi-tenancy pays off when many customers use the same product in the same way. It stops paying off under a few conditions:

- **A handful of large customers**, each negotiating custom features, release timing, or infrastructure. The pooled economies never materialize, and per-customer divergence breaks the single-version model.
- **Isolation requirements no shared component can satisfy**, such as contracts or regulations that mandate dedicated infrastructure for every customer. Automated single-tenant deployments give that isolation while keeping one operational pipeline.
- **A single organization's internal system**, where there is only one tenant and the extra dimension adds cost with no customer to serve.

The opposite mistake is common too. A product that expects more than one customer but starts without a tenant key tends to find that adding one later touches every table, query, cache key, message, and test. Carrying a tenant ID from the first schema is cheap even while the system still deploys one tenant per environment.

## Common Pitfalls

- **Trusting a client-supplied tenant ID.** A header, path segment, or request body field naming the tenant is a claim to verify against the authenticated identity, not proof of membership.
- **Session-scoped tenant settings on pooled connections.** The next request on that connection inherits the previous tenant's context.
- **Cache keys, blob paths, and search indexes without the tenant.** The database is filtered and the cache in front of it isn't.
- **Background work with no tenant context.** Messages and scheduled jobs lose the context the HTTP request carried unless it travels with them explicitly.
- **Unique constraints that span tenants.** They block one tenant's valid data because another tenant already used the value, and reveal that the value exists.
- **Per-customer code branches.** Each fork turns a multi-tenant product back into a fleet of separately maintained installations.
- **No per-tenant metrics.** Noisy neighbor incidents become impossible to attribute, and costs can't be allocated.

## Quick Reference

| Decision | Options | Main trade-off |
|---|---|---|
| **Tenancy model** | Silo, pool, bridge along layers, bridge along tenants | Isolation and per-tenant flexibility against cost and operational load |
| **Scaling a pool** | Grow one deployment, or add deployment stamps | One larger blast radius against a routing layer and tenant catalog |
| **Data placement** | Database per tenant, schema per tenant, shared schema, sharded pool | Isolation and per-tenant restore against cost and migration effort |
| **Enforcing a shared schema** | ORM query filters, database row-level security, both | Filters miss paths outside the ORM, and RLS has bypass roles and pooling traps |
| **Tenant resolution** | Subdomain, path, header, API key, token claim | Convenience against how hard the value is to forge |
| **Noisy neighbor controls** | Rate and concurrency limits, fair queuing, operation limits, tier pools, rebalancing | Fairness against idle capacity and rejected work |
