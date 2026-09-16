---
title: "Legacy Modernization Strategies"
layout: guide
category: Architecture
subcategory: Patterns
description: "Replacing a legacy system while the business keeps running on it: incremental versus rewrite, the strangler fig and its routing layer, anti-corruption layers, seams, branch by abstraction and parallel change, migrating data with change data capture, and verifying with parallel runs."
tags: [practical, legacy-modernization, strangler-fig, anti-corruption-layer, branch-by-abstraction, change-data-capture, parallel-run]
---

A legacy system is one the business depends on but can no longer change safely or cheaply. The stack may be out of support, the people who understood it may have left, or every change may break something unexpected. What makes modernizing it hard is not the new technology. The old system has to keep working, handling revenue, serving users, and feeding integrations nobody has fully mapped, for the entire time it is being replaced.

The patterns in this guide share one idea. Replace the system in pieces small enough that each piece can be verified and rolled back while the rest keeps running.

## Incremental Replacement or Rewrite

The first decision is whether to replace the system incrementally, with old and new running side by side, or to build a replacement separately and switch over.

| | Incremental replacement | Rewrite and switch |
|---|------------------------|--------------------|
| **When it fits** | Large systems, low tolerance for disruption, business logic that works but nobody fully understands | Small systems, a platform that genuinely can't host new code, or a business model the old system no longer matches |
| **Delivers value** | Continuously, as each piece moves | Only at cutover |
| **Risk shape** | Many small, reversible changes | One large change, discovered late |
| **Main cost** | Transitional code that exists only to let old and new coexist, and a long period of running both | Feature parity chasing a moving target, since the legacy system keeps changing while the rewrite catches up |

Rewrites tend to fail in a recognizable way. Years of business rules live in the legacy code's odd conditionals, and they surface one at a time as the rewrite meets production data. Meanwhile the old system keeps gaining features the new one has to match. Fred Brooks described a related trap in *The Mythical Man-Month* (1975) as the second-system effect. A team's second attempt at a system tends to be over-designed, packed with everything left out of the first.

Default to incremental replacement unless the system is small enough to rewrite in a period the business can wait through, or the platform can't be extended at all.

## Strangler Fig

*Named by Martin Fowler after strangler fig vines, which grow around a host tree until they replace it*

New code is built alongside the legacy system and takes over its behavior a piece at a time, with a routing layer deciding which system handles each request. The legacy system shrinks until nothing routes to it, and then it is switched off.

```
Stage 1                     Stage 2                                     Stage 3

Requests                    Requests                                    Requests
      │                                   │                                    │
      ▼                                   ▼                                    ▼
 ┌─────────┐                   ┌─────────────────────┐                    ┌─────────┐
 │  Router │                   │        Router       │                    │  Router │
 └────┬────┘                   └──┬───────────────┬──┘                    └────┬────┘
      │ all                       │ /orders       │ everything else            │ all
      ▼                           ▼               ▼                            ▼
┌────────────┐               ┌─────────┐   ┌─────────────┐              ┌──────────────┐
│   Legacy   │               │  Orders │   │    Legacy   │              │ New services │
│  monolith  │               │   (new) │   │   (shrunk)  │              └──────────────┘
└────────────┘               └─────────┘   └─────────────┘              legacy retired
```

**How it proceeds**:
1. Put a routing layer in front of the legacy system that initially sends everything to it, such as a reverse proxy, API gateway, or facade in code
2. Choose one capability, build it in the new system, and route its traffic there
3. Verify it under real traffic, with a way to route back
4. Remove that capability from the legacy system
5. Repeat until nothing routes to the legacy system

**Choosing what to move first**: Start with a capability that is valuable enough to prove the approach but not so central that a mistake is an outage, and whose boundary is clean enough to route. Slice by business capability, such as orders or pricing, not by technical layer. Moving the whole UI or the whole data layer first leaves both systems half-dependent on each other.

**The routing layer**: For HTTP traffic, routing by path or header at a proxy or gateway needs no change to the legacy code. Where callers invoke legacy code in-process, a facade in code makes the choice instead.

```csharp
public class OrderFacade(
    IFeatureFlags flags,
    NewOrderService newOrders,
    LegacyOrderService legacyOrders)
{
    public Task<Order> GetOrderAsync(OrderId id, CustomerId customer) =>
        flags.IsEnabled("orders-new-service", customer)
            ? newOrders.GetOrderAsync(id)
            : legacyOrders.GetOrderAsync(id);
}
```

Be careful about falling back to the legacy system automatically when the new one throws. For a read that is harmless. For a write, the new system may have partly completed the operation before failing, and retrying it in the legacy system can place the order twice unless both paths are idempotent.

**Trade-offs**: Fowler notes that teams often balk at the transitional architecture this requires, meaning the routing layer, data synchronization, and adapters that exist only so old and new can coexist and will be deleted at the end. That code is the price of incremental safety. The larger risk is stalling. Once the easy, well-bounded capabilities have moved, what remains is the tangled core, and a migration can sit indefinitely at a point where the organization pays to run and understand two systems.

---

## Anti-Corruption Layer

When new code has to talk to the legacy system, and during a strangler migration it constantly does, an anti-corruption layer translates between the two models so that legacy concepts don't leak into the new one. The new code works entirely in its own terms, and the layer is the only place that knows the legacy system's names, codes, and quirks.

```
New system                 Anti-corruption layer            Legacy system
┌────────────────┐        ┌─────────────────────┐         ┌──────────────────┐
│ Domain model   │ ─────▶ │ translate requests  │ ──────▶ │ Legacy API or DB │
│ in its own     │ ◀───── │ translate responses │ ◀────── │ CUST_ID, STAT='A'│
│ terms          │        │ map codes and ids   │         │                  │
└────────────────┘        └─────────────────────┘         └──────────────────┘
```

**Example**: The legacy customer service returns abbreviated fields and single-letter status codes. The new code only ever sees a `Customer`.

```csharp
public class LegacyCustomerTranslator(LegacyCustomerClient legacy)
{
    public async Task<Customer> GetCustomerAsync(CustomerId id)
    {
        LegacyCustomerRecord record = await legacy.GetCustomerAsync(id.Value);

        return new Customer(
            Id: new CustomerId(record.CustId),
            Name: PersonName.Parse(record.CustName),
            ShippingAddress: new Address(record.Addr1, record.Addr2, record.City, record.State, record.Zip),
            CreditLimit: new Money(record.CreditLmt, "USD"),   // legacy stores no currency
            Status: record.Status switch
            {
                "A" => CustomerStatus.Active,
                "I" => CustomerStatus.Inactive,
                "S" => CustomerStatus.Suspended,
                _ => throw new UnknownLegacyValueException(nameof(record.Status), record.Status)
            });
    }
}
```

Without the layer, those legacy details spread through the new code: a `StatusCode` string compared against `"A"` in a dozen places, amounts with no currency, and integer ids passed around as bare numbers. Each one is a piece of the legacy system the new system will have to unpick later.

**Trade-offs**: The layer is code to write, test, and keep in step with both sides, and it adds a translation step to every call. Translation can also fail on legacy data that doesn't fit the new model, so the layer needs a deliberate policy for values it doesn't recognize rather than guessing. In a strangler migration it is transitional, and it should shrink and disappear as the legacy side does.

---

## Changing Code Safely in Place

Not every modernization routes traffic between systems. Often the legacy codebase itself has to change, and the problem is making large changes without a long-lived branch or a broken build.

### Seams

*From Michael Feathers, Working Effectively with Legacy Code (2004)*

Feathers defines a seam as a place where you can alter behavior in a program without editing in that place. Legacy code is hard to change largely because it has so few of them. A class that constructs its own dependencies with `new` can't be tested without those dependencies, and can't have one replaced without editing the class.

```csharp
// No seam: the email dependency is fixed inside the method
public class OrderService
{
    public void PlaceOrder(Order order)
    {
        var email = new SmtpEmailSender();
        email.SendConfirmation(order);
    }
}

// Seam introduced: the dependency comes from outside
public class OrderService(IEmailSender email)
{
    public void PlaceOrder(Order order) => email.SendConfirmation(order);
}
```

The second version can receive a test double, a new implementation, or a router that picks between old and new, all without touching `OrderService` again. Introducing seams like this is usually the first step of any in-place change, because it is what makes the code testable enough to change the rest safely.

### Branch by Abstraction

*Named by Paul Hammant, crediting Stacy Curl with the technique*

Replaces a large component in place, on the main branch, while the system keeps building and shipping throughout.

1. Put an abstraction in front of the component being replaced
2. Move every caller onto the abstraction
3. Build the new implementation behind the same abstraction
4. Switch callers to the new implementation, all at once or progressively
5. Delete the old implementation, and the abstraction too if it no longer earns its place

```csharp
public interface IPaymentProcessor
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request);
}

public class LegacyPaymentProcessor(LegacyPaymentGateway gateway) : IPaymentProcessor { /* adapts the old API */ }
public class ModernPaymentProcessor(PaymentProviderClient client) : IPaymentProcessor { /* new implementation */ }

// Composition root chooses the implementation, so switching back is a configuration change
services.AddScoped<IPaymentProcessor>(sp =>
    sp.GetRequiredService<IOptions<PaymentOptions>>().Value.UseModernProcessor
        ? ActivatorUtilities.CreateInstance<ModernPaymentProcessor>(sp)
        : ActivatorUtilities.CreateInstance<LegacyPaymentProcessor>(sp));
```

Branch by abstraction is the in-process counterpart of the strangler fig. The strangler routes requests between systems, and branch by abstraction routes calls between implementations.

### Parallel Change

*Described by Danilo Sato, and also known as expand and contract*

Makes a backward-incompatible change to an interface in three safe steps, so that callers never break.

| Phase | What happens | Example: renaming a column from `cust_name` to `customer_name` |
|-------|--------------|----------------------------------------------------------------|
| **Expand** | Add the new form alongside the old | Add `customer_name`, and write to both columns |
| **Migrate** | Move every caller to the new form | Backfill existing rows, then switch every reader to `customer_name` |
| **Contract** | Remove the old form once nothing uses it | Stop writing `cust_name`, then drop it |

It works for method signatures, API fields, message schemas, and database columns alike. The cost is that the change spans several deployments, and the expanded state, where both forms exist, has to be supported for as long as the migration takes.

---

## Moving the Data

Code can run in two places at once. Data is harder, because at any moment exactly one store has to be the source of truth for a given record, and every other copy has to follow it. Most data migration failures come from losing track of which store that is.

### Keeping the New Store in Step with Change Data Capture

Change data capture reads the legacy database's own transaction log, such as the MySQL binlog or the PostgreSQL write-ahead log, and emits every insert, update, and delete as an event. The new system consumes those events to keep its store current. The legacy application needs no changes at all, which matters when it can't safely be changed.

```
Legacy application ──writes──▶ Legacy database (source of truth)
                                      │ transaction log
                                      ▼
                               CDC connector (e.g. Debezium)
                                      │ change events
                                      ▼
                               Event stream (e.g. Kafka)
                                      │
                                      ▼
                          Transform to the new model ──▶ New database (follower)
```

Debezium is the common open source choice, and managed services such as AWS Database Migration Service and Oracle GoldenGate fill the same role. Log-based capture is preferable to database triggers, which add work to every legacy transaction, and to polling on a timestamp column, which misses deletes.

The consumer has to be idempotent, since change events can be redelivered, and it needs monitoring for replication lag, because a lagging follower quietly becomes a stale one.

### The Migration Sequence

1. **Follow**: capture changes from the legacy store into the new store, which receives no direct writes
2. **Backfill**: copy existing history in batches, reconciling each batch against the source
3. **Read from the new store**, for one capability or a slice of users at a time, with legacy still the source of truth for writes
4. **Switch the source of truth**: writes go to the new store, and if the legacy system still has readers, a reverse sync keeps it current for as long as they exist
5. **Retire**: stop the reverse sync once no legacy reader remains, and archive the legacy data

Each step can be reversed before the next one starts, and step 4 is the only one where a reversal means moving writes back.

### Why Not Dual Writes

The tempting shortcut is to have application code write every change to both databases. Without a transaction spanning both, one write can succeed while the other fails, and the two stores drift apart in ways nobody notices until reconciliation or a customer does. Logging the failure and carrying on, which is what most dual-write code ends up doing, makes the drift silent. If the application must be the one to publish changes, write to one store and publish the change through a transactional outbox instead, so the second store follows reliably.

### Validating the Migration

Reconcile continuously, not once at cutover. Compare row counts and aggregate totals per table and per day, checksum critical fields, and sample individual records end to end. Keep a mapping from legacy ids to new ids whenever the new system generates its own, since every reconciliation, support query, and rollback will need it.

Legacy data rarely fits the new model cleanly. Expect nulls in required fields, values outside documented ranges, and codes nobody remembers adding. Decide per case whether to fix, default, or quarantine a record, and record which records were changed so the decision can be revisited.

---

## Verifying with a Parallel Run

A parallel run executes both the legacy and the new implementation for the same real input, returns the legacy result to the caller, and compares the two. It finds the behaviors nobody documented, because production traffic exercises cases no test suite anticipated.

GitHub's Scientist library popularized the technique, and Scientist.NET ports it to .NET. The control's result is always what gets returned, and mismatches are published for analysis.

```csharp
public Task<decimal> CalculateShippingAsync(Order order) =>
    Scientist.ScienceAsync<decimal>(
        "shipping-calculation",
        2,                                  // run control and candidate concurrently
        experiment =>
    {
        experiment.Use(() => _legacyShipping.CalculateAsync(order));   // returned to the caller
        experiment.Try(() => _newShipping.CalculateAsync(order));      // compared, never returned
    });
```

**Works best for**: calculations, pricing, eligibility rules, permission checks, and searches, where the result is a value that can be compared.

**Writes need care**: Scientist's own documentation warns that it is only safe for code that doesn't change data. Running a write twice charges twice or creates two records. To verify writes, point the new implementation at an isolated store and compare the resulting state, or verify at read time after writes have gone through the normal path.

**Trade-offs**: Every experimented call runs twice, so it costs extra capacity and, if run synchronously, extra latency. Expect some mismatches to be the legacy system being wrong, which turns each one into a question for the business about which behavior is correct.

---

## Releasing and Rolling Back

Each step of a migration should reach users gradually and be reversible. Feature flags scoped to a customer or percentage let a new path go to internal users, then a small share of traffic, then everyone, and route back instantly. Canary and blue-green deployment serve the same purpose at the deployment level.

The rollback that gets neglected is data. Switching routing back is a configuration change. Switching back after the new system has accepted writes means those writes have to reach the legacy store, which is only possible if the reverse sync from the migration sequence exists. Test the rollback path for each step before that step goes live, and decide in advance which measurements, such as error rate, latency, or reconciliation mismatches, trigger it.

---

## Sequencing a Modernization

A modernization that goes well usually moves through the same stages, though the time each takes depends entirely on the system.

1. **Assess**: inventory what the system does and what depends on it, including batch jobs, file exports, database links, and reports that no architecture diagram shows
2. **Prepare**: add monitoring to the legacy system, establish performance baselines, write characterization tests around critical behavior, and put the routing layer in place
3. **Pilot**: move one capability end to end, including its data, and adjust the approach from what that reveals
4. **Migrate**: move the remaining capabilities in priority order, deleting legacy code as each one goes
5. **Decommission**: archive the data, shut down the infrastructure, and remove the transitional code

Measure progress by what has actually left the legacy system: the share of traffic served by new code, the capabilities whose legacy implementation has been deleted, and the data whose source of truth has moved. Code written in the new system while the old one still handles everything is not progress on the migration.

### Common Failures

| Failure | What it looks like | What helps |
|---------|--------------------|------------|
| Big-bang cutover | A single switchover date carrying every risk at once | Strangler fig, one capability at a time |
| Feature parity trap | The new system can't launch until it does everything the old one did | Measure which legacy features are used, and retire the rest instead of rebuilding them |
| Data as an afterthought | Code migrated, data plan improvised at the end | Plan and rehearse the data sequence from the pilot onward |
| Rewriting without understanding | Odd legacy behavior removed, then rediscovered as a production bug | Characterization tests and parallel runs before replacing logic |
| Neglecting the legacy system | Security patches and critical fixes stop because it's "going away" | Keep it maintained until the day it is switched off |
| Hidden integrations | A report or partner feed breaks after cutover | Map every consumer of the legacy data before moving it |
| Stalled migration | Easy capabilities moved, core untouched, two systems indefinitely | Plan the hard core early, and track what has been removed rather than what has been built |

---

## Quick Reference

| Technique | Solves | Main cost |
|-----------|--------|-----------|
| **Strangler fig** | Replacing a system while it keeps serving traffic | Transitional routing and sync code, and the risk of stalling halfway |
| **Anti-corruption layer** | Legacy models leaking into new code | A translation layer to maintain on both sides |
| **Seams** | Legacy code too coupled to test or change | Refactoring before any visible progress |
| **Branch by abstraction** | Replacing a component in place without a long-lived branch | An abstraction that may exist only for the migration |
| **Parallel change** | Breaking interface or schema changes | Several deployments and a period supporting both forms |
| **Change data capture** | Keeping a new store in step without changing the legacy app | A pipeline to run, and replication lag to monitor |
| **Parallel run** | Undocumented behavior the new implementation gets wrong | Double execution, and careful isolation for writes |
