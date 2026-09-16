---
title: "Domain-Driven Design (DDD)"
layout: guide
category: Architecture
subcategory: Design
description: "Modeling a complex business domain in code: subdomains, ubiquitous language, bounded contexts and context mapping, EventStorming, and the tactical building blocks of entities, value objects, aggregates, domain events, services, and repositories."
tags: [practical, domain-driven-design, bounded-context, ubiquitous-language, context-mapping, aggregates, event-storming]
---

Domain-Driven Design is an approach to building software for complicated businesses, where the hard part is not the technology but understanding what the business actually does. It puts developers and domain experts in continuous conversation, and it treats the model that emerges from that conversation, expressed directly in code, as the heart of the system.

Eric Evans introduced it in *Domain-Driven Design: Tackling Complexity in the Heart of Software* (2003). Vaughn Vernon's *Implementing Domain-Driven Design* (2013) added much of the practical guidance teams now use, particularly on aggregates and on integrating bounded contexts.

DDD has two halves. **Strategic design** decides how a large domain divides into parts, what each part's model means, and how the parts relate. **Tactical design** gives building blocks for implementing the model inside one of those parts. Teams often adopt the tactical patterns alone, because they look like code. The strategic half is where most of the value is.

## When DDD Pays Off

| DDD tends to pay off when | DDD tends to cost more than it returns when |
|---------------------------|---------------------------------------------|
| Business rules are intricate and are the reason the software exists | The application is mostly forms over data, with little logic between them |
| Domain experts are available and willing to work with the team | Nobody with real domain knowledge can take part |
| The system will evolve for years as the business changes | The system is short-lived or throwaway |
| Several teams work in one domain and need clear boundaries between them | The complexity is technical, as in data pipelines or infrastructure tooling |

Within one system, both can be true. DDD's own answer is to spend modeling effort unevenly, which is what subdomains are for.

## Strategic Design

### The Scope Ladder

DDD's terms nest, and much confusion comes from mixing levels. Subdomains describe the business, the problem space. Bounded contexts describe the software, the solution space. Ideally one bounded context serves one subdomain, but legacy systems often have one context spanning several subdomains, or one subdomain split across contexts.

| Level | Describes | Example in insurance |
|-------|-----------|----------------------|
| **Domain** | The whole business the software serves | Insurance |
| **Subdomain** | One area of the business | Underwriting |
| **Bounded context** | A software boundary within which one model and one language apply | The underwriting service and its model |
| **Aggregate** | A cluster of objects inside a context that changes together under one set of rules | A policy application with its risk factors |
| **Entity or value object** | An individual object inside an aggregate | The applicant, a coverage amount |

### Subdomains

Not every part of a business deserves the same investment. Evans distinguishes three kinds of subdomain, and the distinction decides where the careful modeling goes.

| Type | What it is | Strategy |
|------|------------|----------|
| **Core** | What makes this business different from its competitors | Build it, with the strongest team and full DDD modeling |
| **Supporting** | Necessary and specific to the business, but not a differentiator | Build it simply, or configure a commercial product |
| **Generic** | A problem every business has, already solved well elsewhere | Buy or integrate, don't build |

| Subdomain in an insurer | Type | Strategy |
|-------------------------|------|----------|
| Underwriting and risk pricing | Core | Custom, heavily modeled |
| Claims adjudication | Core | Custom, heavily modeled |
| Policy administration | Supporting | Custom but simple, or a configured product |
| Identity and sign-in | Generic | A product such as Microsoft Entra ID, Okta, or Auth0 |
| Email delivery | Generic | A service such as Amazon SES or SendGrid |
| Card payments | Generic | A provider such as Stripe or Adyen |

The classification is specific to the business. Payments are generic for an insurer and core for a payments company.

### Ubiquitous Language

A ubiquitous language is the vocabulary developers and domain experts share for one bounded context, and it is used everywhere: in conversation, in documentation, in tests, and in the code itself. When the two groups use different words, every requirement passes through a translation, and meaning gets lost in each one.

Build it by listening to how experts describe their work, and by rejecting two kinds of word: technical terms the experts wouldn't use, and vague verbs like "process", "handle", and "manage" that hide what actually happens. An insurance expert doesn't process requests. They underwrite applications, adjudicate claims, and renew policies.

```csharp
// Generic technical vocabulary: tells a domain expert nothing
public class Request { }
public void ProcessRequest(Request request) { }

// The ubiquitous language: an underwriter can read this
public class PolicyApplication { }
public void Underwrite(PolicyApplication application) { }
```

The language changes as understanding improves, and the code changes with it. A term the team has stopped using in conversation but still uses in code is a sign the model has drifted.

### Bounded Contexts

A bounded context is an explicit boundary inside which one model applies and every term has one meaning. Outside it, the same word can mean something else, and that is expected.

"Customer" is the standard example. To sales it is a lead with a pipeline stage. To fulfillment it is a delivery address. To billing it is a payment history and a credit limit. To support it is a ticket history. A single `Customer` class serving all four either becomes a bloated compromise that serves none of them well, or couples four teams to every change in it. Four bounded contexts with four models, each small and coherent, is the DDD answer.

**Signals that a boundary belongs somewhere**:
- The same word means different things to different groups
- Different teams or departments own the work
- Parts of the system change for different reasons and at different rates
- A business process hands off from one group to another

Each bounded context has its own ubiquitous language, a clear owning team, and control of its own data, and it interacts with other contexts only through explicit contracts.

### Context Mapping

A context map records how bounded contexts relate. The relationships are as much about teams as about code: who depends on whom, and who can influence whom. In an **upstream/downstream** relationship, changes upstream affect downstream but not the reverse.

| Pattern | Relationship | Use when |
|---------|--------------|----------|
| **Partnership** | Two teams plan together and evolve their interface jointly | The contexts succeed or fail together |
| **Shared Kernel** | Two contexts share a small, explicitly designated piece of model | The shared part is small and stable, and changes are agreed by both teams |
| **Customer/Supplier** | Upstream plans with downstream's needs in mind | Downstream has enough influence to negotiate |
| **Conformist** | Downstream adopts upstream's model as it is | Downstream has no influence, and upstream's model is good enough to use |
| **Anticorruption Layer** | Downstream translates upstream's model into its own at the boundary | Upstream's model would distort downstream's, as with legacy or third-party systems |
| **Open Host Service** | Upstream offers a protocol designed for any consumer | Many downstream contexts need the same access |
| **Published Language** | A documented shared format for exchanging information | Contexts or organizations exchange data through a standard |
| **Separate Ways** | No integration at all | Integrating costs more than duplicating |
| **Big Ball of Mud** | A part of the system with no clear model | Draw a boundary around it and keep it from spreading |

```
                        ┌───────────────────┐
                        │   Sales context   │
                        │  (Open Host       │
                        │   Service)        │
                        └─────────┬─────────┘
                               U  │
                                  │ product and order API
                               D  ▼
┌───────────────────┐   ┌───────────────────────┐   ┌────────────────────────┐
│  Legacy warehouse │ U │  Fulfillment context  │ U │ Payment provider       │
│  (Big Ball of Mud)│──▶│  ACL toward warehouse │◀──│ (external)             │
└───────────────────┘ D │  Conformist toward    │ D └────────────────────────┘
                        │  payment provider     │
                        └───────────────────────┘

U = upstream, D = downstream
```

The map above says three things a class diagram can't. Fulfillment consumes Sales through an API Sales designed for general use. Fulfillment protects its model from the warehouse system's with a translation layer. And fulfillment simply adopts the payment provider's model, because a single customer of a large provider has no leverage to negotiate a different one.

### EventStorming

*Created by Alberto Brandolini*

EventStorming is a workshop for discovering a domain collaboratively. Developers and domain experts map out a business process on a long wall of sticky notes, starting from what happens rather than from data or screens. Disagreements about how the business works surface as competing sticky notes, which is much cheaper than surfacing as production bugs.

It runs at three levels of detail. **Big Picture** explores an entire business line with a large group and reveals candidate bounded contexts. **Process Modelling** works through one process in detail. **Software Design** models one bounded context closely enough to implement.

| Sticky note | Conventional color | What it captures |
|-------------|--------------------|------------------|
| Domain event | Orange | Something that happened, in past tense, such as `ClaimSubmitted` |
| Command | Blue | An intention that causes an event, such as `SubmitClaim` |
| Actor | Small yellow | Who issues the command |
| Policy | Lilac | A reaction rule, as in "whenever a claim is submitted, assign an adjuster" |
| Constraint, formerly aggregate | Large yellow | What accepts or rejects a command |
| System | Wide pink | An external system involved |
| Read model | Green | Information someone needs to make a decision |
| Hotspot | Neon pink | A question, conflict, or pain point to come back to |

A session usually starts with everyone writing domain events and placing them on a timeline, then enforces the timeline, then adds commands, actors, policies, and systems, marking hotspots throughout. Clusters of events that share language and ownership become candidates for bounded contexts.

## Tactical Design

The tactical patterns implement the model inside a single bounded context.

### Entities and Value Objects

| | Entity | Value object |
|---|--------|--------------|
| **Identity** | Has one that persists as its attributes change | Has none, and is defined entirely by its attributes |
| **Equality** | Two entities are equal when their ids match | Two value objects are equal when all their attributes match |
| **Mutability** | Changes over its lifecycle | Immutable, so a change produces a new value |
| **Examples** | Customer, order, policy, account | Money, address, date range, email address |

The question that decides between them is whether it matters *which one* this is. An order placed yesterday is the same order after its lines change, so it is an entity. A $20 amount is interchangeable with any other $20 amount, so it is a value object.

Value objects are where much of a model's rule enforcement can live, and they replace primitive obsession, meaning bare `decimal` and `string` values that carry no rules. A C# `record` gives value-based equality for free.

```csharp
public sealed record Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            throw new ArgumentException("Currency must be a three-letter ISO code.", nameof(currency));

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    public Money Add(Money other)
    {
        if (other.Currency != Currency)
            throw new InvalidOperationException($"Cannot add {other.Currency} to {Currency}.");
        return new Money(Amount + other.Amount, Currency);
    }

    public Money Multiply(int factor) => new(Amount * factor, Currency);
}

// UpdatePrice(decimal amount, string currency) lets any caller pass an invalid currency.
// UpdatePrice(Money price) makes an invalid price impossible to construct.
```

### Aggregates

An aggregate is a cluster of entities and value objects that must stay consistent with each other, treated as one unit for changes. One entity is the **aggregate root**, and all changes go through it, so the root can enforce the rules, called invariants, that span the cluster. The aggregate is also the unit of persistence: it is loaded and saved whole, in one transaction.

```
┌───────────────── Order aggregate ─────────────────┐
│                                                   │
│   Order (root)  ── enforces: total = sum of lines │
│     │               no changes once confirmed     │
│     ├── OrderLine     no confirming an empty order│
│     ├── OrderLine                                 │
│     └── OrderLine                                 │
│                                                   │
└───────────────────────────────────────────────────┘
         │ references by id only
         ▼
   CustomerId ─ ─ ─ ▶ Customer aggregate (separate)
```

Vernon's rules of thumb for designing them:

- **Model true invariants in consistency boundaries.** An aggregate's boundary should enclose exactly the objects that a business rule requires to be consistent at the moment of a change, and no more.
- **Design small aggregates.** Large aggregates are slow to load, and they cause concurrent users to conflict on changes that don't actually interact.
- **Reference other aggregates by identity.** An order holds a `CustomerId`, not a `Customer`, which keeps each aggregate independently loadable and makes the boundary visible in code.
- **Use eventual consistency outside the boundary.** Modify one aggregate instance per transaction, and let changes to others follow through domain events.

```csharp
public sealed class Order : AggregateRoot
{
    private readonly List<OrderLine> _lines = [];

    public OrderId Id { get; }
    public CustomerId CustomerId { get; }
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public Money Total { get; private set; }
    public IReadOnlyList<OrderLine> Lines => _lines;

    public Order(OrderId id, CustomerId customerId, string currency)
    {
        Id = id;
        CustomerId = customerId;
        Total = new Money(0, currency);
    }

    public void AddLine(ProductId productId, int quantity, Money unitPrice)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("A confirmed order can't be changed.");
        if (quantity <= 0)
            throw new DomainException("Quantity must be positive.");

        var line = new OrderLine(productId, quantity, unitPrice);
        _lines.Add(line);
        Total = Total.Add(line.LineTotal);
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("The order is already confirmed.");
        if (_lines.Count == 0)
            throw new DomainException("An empty order can't be confirmed.");

        Status = OrderStatus.Confirmed;
        Raise(new OrderConfirmed(Id, CustomerId, Total, DateTimeOffset.UtcNow));
    }
}

public sealed record OrderLine(ProductId ProductId, int Quantity, Money UnitPrice)
{
    public Money LineTotal => UnitPrice.Multiply(Quantity);
}
```

Nothing outside the aggregate can add a line to a confirmed order or leave `Total` out of step with the lines, because the only way to change either is through the root.

### Domain Events

A domain event records something that happened in the domain that other parts of the system care about. It is named in the past tense in the ubiquitous language, such as `OrderConfirmed` or `ClaimRejected`, and it is immutable. Domain events are how one aggregate's change reaches another under Vernon's eventual consistency rule, and how one bounded context learns what happened in another.

```csharp
public abstract class AggregateRoot
{
    private readonly List<IDomainEvent> _events = [];
    public IReadOnlyList<IDomainEvent> DomainEvents => _events;

    protected void Raise(IDomainEvent domainEvent) => _events.Add(domainEvent);
    public void ClearDomainEvents() => _events.Clear();
}

public sealed record OrderConfirmed(
    OrderId OrderId, CustomerId CustomerId, Money Total, DateTimeOffset OccurredAt) : IDomainEvent;
```

Dispatching them reliably is the part that goes wrong. Saving the aggregate and then publishing its events as a second step loses the events whenever the process stops between the two. The usual fix is to write the events to an outbox table in the same transaction as the aggregate and publish them from there, then clear them from the aggregate so a later save doesn't publish them again.

### Domain Services and Application Services

Some domain logic doesn't belong to any one entity or value object. A funds transfer involves two accounts, and putting `TransferTo` on the source account arbitrarily makes one account own an operation that is about both. A **domain service** holds that logic. It is stateless, uses the ubiquitous language, and works with domain objects.

```csharp
public sealed class FundsTransferService
{
    public void Transfer(Account source, Account destination, Money amount)
    {
        if (amount.Amount <= 0)
            throw new DomainException("A transfer amount must be positive.");

        source.Withdraw(amount);       // enforces the source account's own rules
        destination.Deposit(amount);
    }
}
```

This example modifies two aggregates, which breaks the one-aggregate-per-transaction rule. That is sometimes the right call, where the business genuinely requires both changes to happen atomically and both aggregates live in one database. Where they don't, the transfer becomes a withdrawal that raises an event, followed by a deposit that reacts to it, with compensation if the deposit fails.

An **application service** is different. It implements a use case: it loads aggregates from repositories, calls domain objects or domain services, saves the results, and manages the transaction. It contains no business rules itself.

### Repositories

A repository gives the domain collection-like access to aggregates while hiding how they are stored. There is one per aggregate root, it loads and saves whole aggregates, and its interface lives with the domain model while its implementation lives in infrastructure.

```csharp
public interface IOrderRepository
{
    Task<Order?> FindAsync(OrderId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Order>> FindAwaitingShipmentAsync(CancellationToken cancellationToken = default);
    void Add(Order order);
}
```

Query methods should speak the domain's language, such as orders awaiting shipment, rather than generic filters. Queries that exist only to feed screens and reports usually belong to a separate read model rather than the repository.

### Factories and Specifications

A **factory** encapsulates creating an aggregate when construction needs more than a constructor can reasonably do, such as looking up prices or applying defaults from several sources. A **specification** is a named, reusable predicate, such as `OverdueOrderSpecification`, that expresses a business rule for validation or selection in one place instead of repeating it as inline conditions.

## Bounded Contexts and Services

Bounded contexts are the most reliable starting point for service boundaries, because a context already has one model, one language, one owning team, and its own data. But the mapping is not one-to-one by necessity.

- One bounded context commonly becomes one service, which gives each team an independently deployable unit aligned with its model.
- Several bounded contexts can live as modules inside one deployable monolith, with the boundaries enforced in code, which keeps DDD's modeling benefits without the operational cost of distribution.
- One bounded context split into several services is usually a warning sign, since a single model and a single language shouldn't need network calls between their parts.

The context map then describes the service integrations. Customer/supplier and conformist relationships become API dependencies, open host services become published APIs, and domain events carry changes between contexts asynchronously.

## Common Pitfalls

| Pitfall | What it looks like | What helps |
|---------|--------------------|------------|
| Tactical patterns without strategic design | Repositories and aggregates everywhere, but one sprawling model for the whole enterprise | Find the bounded contexts first |
| Anemic domain model | Entities are getters and setters, and all rules live in service classes that any caller can bypass | Move behavior and invariants onto the entities and aggregate roots |
| Oversized aggregates | Loading an order loads its customer, product catalog, and shipment history | Reference other aggregates by id, and enclose only what a true invariant needs |
| One model for everything | A `Customer` class that sales, billing, and support all fight over | Separate bounded contexts with their own models |
| DDD applied uniformly | Full tactical modeling on a generic subdomain or a CRUD admin screen | Spend modeling effort on the core domain, and keep the rest simple |
| Modeling without experts | A model built from requirements documents, which encodes the document's misunderstandings | Continuous conversation with people who do the work |

## Quick Reference

| Concept | What it is | Why it matters |
|---------|------------|----------------|
| **Subdomain** | An area of the business, classified as core, supporting, or generic | Decides where modeling effort goes |
| **Ubiquitous language** | The shared vocabulary for one bounded context, used in speech and code | Removes the translation between experts and developers |
| **Bounded context** | A boundary within which one model and one language apply | Lets different parts of the business have different, coherent models |
| **Context map** | The relationships between bounded contexts and their teams | Makes integration and dependency choices explicit |
| **EventStorming** | A collaborative workshop mapping a domain through its events | Surfaces misunderstandings and candidate boundaries early |
| **Entity / value object** | An object with persistent identity, or an immutable one defined by its attributes | Puts rules where the data is |
| **Aggregate** | A consistency boundary changed through one root and saved in one transaction | Makes invariants enforceable and concurrency manageable |
| **Domain event** | An immutable record of something that happened in the domain | Carries changes between aggregates and contexts |
| **Domain service** | Stateless domain logic that spans objects | Keeps logic in the domain without forcing it onto the wrong entity |
| **Repository** | Collection-like access to whole aggregates | Hides persistence from the model |
