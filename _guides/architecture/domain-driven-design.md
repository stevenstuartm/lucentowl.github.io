---
title: "Domain-Driven Design (DDD)"
layout: guide
category: Architecture
subcategory: Design
description: "Comprehensive guide to Domain-Driven Design covering strategic design (bounded contexts, context mapping, ubiquitous language) and tactical design (entities, value objects, aggregates, repositories) for modeling complex business domains"
tags: [architecture, domain-driven-design, modeling, microservices, design-patterns, complexity-management, practical]
---

## What is Domain-Driven Design?

<blockquote class="pull-quote">
<p>The most important part of software is understanding and modeling the business domain correctly. Technology choices matter, but getting the domain model wrong makes the best technology irrelevant.</p>
</blockquote>

Domain-Driven Design (DDD) is an approach to software development that emphasizes collaboration between technical experts and domain experts to create models that reflect deep understanding of the business domain. DDD provides both strategic patterns for organizing large systems and tactical patterns for implementing domain logic.

DDD was introduced by Eric Evans in his 2003 book *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Vaughn Vernon's *Implementing Domain-Driven Design* (2013) provided practical implementation guidance, particularly for distributed systems.

## When to Use DDD

DDD is valuable when:
- **Domain complexity is high**: Business rules are intricate, nuanced, and central to the application's value
- **Domain experts exist**: People who understand the business deeply and can collaborate with developers
- **Long-term maintenance matters**: The system will evolve over years, not months
- **Multiple teams work on the system**: Bounded contexts provide clear ownership boundaries

<div class="callout callout--warning">
<p class="callout__title">When NOT to Use DDD</p>
<p>DDD is not needed when:</p>
<ul>
<li>Domain is simple CRUD with minimal business logic</li>
<li>Technical complexity dominates (data pipelines, infrastructure automation)</li>
<li>No domain experts are available</li>
<li>The project is short-lived or disposable</li>
</ul>
<p><strong>Common mistake:</strong> Applying tactical DDD patterns (aggregates, repositories) without strategic DDD (bounded contexts, ubiquitous language). The strategic patterns are where most of the value comes from.</p>
</div>

## Strategic Design: Modeling the Domain

Strategic design addresses how to organize large, complex domains into manageable parts. This is where DDD provides the most value.

### Ubiquitous Language

A shared language used by both developers and domain experts to describe the domain. This language appears in code, documentation, conversations, and tests.

**Why it matters**: Miscommunication between developers and domain experts causes most domain modeling failures. When a developer says "user" and a domain expert says "customer," they're already talking past each other.

**How to build it**:
- Listen to how domain experts describe their work
- Identify key nouns (entities, concepts) and verbs (operations, events)
- Reject technical jargon that domain experts don't use
- Reject vague terms ("process," "handle," "manage") in favor of specific domain terms
- Refine the language iteratively as understanding deepens

**Example**: In an insurance domain, don't say "request processing." Say "underwriting" or "claims adjudication" or "policy renewal," using the specific domain terms that experts use.

**In code**:
```csharp
// Bad: Generic technical terms
public class Request { }
public void ProcessRequest(Request req) { }

// Good: Ubiquitous language from the domain
public class PolicyApplication { }
public void UnderwriteApplication(PolicyApplication application) { }
```

**Red flag**: If domain experts can't understand a class name or method name, you're not using ubiquitous language.

### Bounded Contexts

A bounded context is an explicit boundary within which a particular domain model applies. Outside this boundary, different models may use the same terms with different meanings.

**Why bounded contexts matter**: The word "customer" means different things to sales (lead, prospect), order fulfillment (shipping address), billing (payment history), and support (ticket history). Trying to create one unified "Customer" entity across all these contexts creates a bloated, incoherent model.

**Bounded context characteristics**:
- Has its own ubiquitous language
- Has clear ownership (typically one team)
- Controls its own data (no shared databases across contexts)
- Defines explicit contracts with other contexts

**Identifying bounded contexts**:
- Look for language boundaries (same word, different meanings)
- Look for organizational boundaries (different teams, departments)
- Look for autonomy boundaries (parts of the system that change independently)
- Look for workflow boundaries (different business processes)

**Example bounded contexts in e-commerce**:
- **Sales Context**: Product catalog, pricing, promotions, shopping cart
- **Order Fulfillment Context**: Inventory, picking, packing, shipping
- **Billing Context**: Invoices, payments, refunds, accounts receivable
- **Customer Service Context**: Tickets, returns, complaints, resolutions

Each context has its own model. A "Product" in the Sales context (description, images, price) is different from a "Product" in Order Fulfillment (SKU, location, quantity on hand).

### Context Mapping

Context mapping defines relationships between bounded contexts. It makes integration strategies explicit.

**Common context relationships**:

| Pattern | Description | Use When |
|---------|-------------|----------|
| **Partnership** | Two contexts cooperate, teams coordinate closely | Contexts must succeed or fail together |
| **Shared Kernel** | Two contexts share a small common model | Teams trust each other, shared model is small and stable |
| **Customer-Supplier** | Upstream context provides services to downstream | Clear customer relationship, negotiated contracts |
| **Conformist** | Downstream conforms to upstream model | No leverage to influence upstream |
| **Anti-Corruption Layer (ACL)** | Downstream translates upstream model to its own | Protect domain model from external system's model |
| **Open Host Service** | Upstream provides protocol for any downstream to use | Multiple consumers, stable public API |
| **Published Language** | Well-documented shared language for integration | Industry standards, interoperability matters |
| **Separate Ways** | No integration; contexts are independent | Integration cost exceeds benefit |

**Example: E-commerce context map**:
```
Sales Context (Upstream) ---[Open Host Service]---> Order Fulfillment Context (Downstream)
Order Fulfillment Context ---[Anti-Corruption Layer]---> Legacy Warehouse System
Billing Context ---[Customer-Supplier]---> Payment Gateway (External)
```

**Anti-Corruption Layer in practice**:
```csharp
// Legacy warehouse system returns data in its own format
public class WarehouseAdapter
{
    private readonly LegacyWarehouseClient _client;

    public InventoryItem GetInventory(ProductId productId)
    {
        // Call legacy system
        var legacyData = _client.GetStock(productId.ToString());

        // Translate to our domain model
        return new InventoryItem(
            productId: new ProductId(legacyData.ItemCode),
            quantityOnHand: legacyData.QtyAvailable,
            location: new WarehouseLocation(legacyData.BinNumber)
        );
    }
}
```

The ACL isolates your domain model from the legacy system's structure and terminology.

### Subdomains

Subdomains are logical divisions of the business domain, not the software model. They represent different areas of business concern.

<blockquote class="pull-quote">
<p>Don't apply the same level of DDD rigor to every subdomain. Focus modeling effort on the core domain.</p>
</blockquote>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Core Domain</h4>
<ul>
<li>Provides competitive advantage</li>
<li>Differentiates your business from competitors</li>
<li>Justifies building custom software</li>
<li>Deserves the most investment and best developers</li>
<li><strong>Strategy:</strong> Custom development with full DDD</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Supporting & Generic Subdomains</h4>
<p><strong>Supporting:</strong></p>
<ul>
<li>Necessary but not differentiating</li>
<li>Could be built, bought, or outsourced</li>
<li><strong>Strategy:</strong> Custom or configure commercial software</li>
</ul>
<p><strong>Generic:</strong></p>
<ul>
<li>Solved problems (auth, payments, email)</li>
<li>Strong preference for off-the-shelf solutions</li>
<li><strong>Strategy:</strong> Buy, don't build</li>
</ul>
</div>
</div>

**Example subdomains for an insurance company**:

| Subdomain | Type | Strategy |
|-----------|------|----------|
| Underwriting (risk assessment) | **Core** | Custom development, best team, DDD modeling |
| Claims processing | **Core** | Custom development, optimize for business rules |
| Policy administration | **Supporting** | Custom development or configure commercial software |
| Authentication | **Generic** | Buy (Okta, Auth0, Azure AD) |
| Email delivery | **Generic** | Buy (SendGrid, AWS SES) |
| Payment processing | **Generic** | Integrate (Stripe, PayPal) |

## Tactical Design: Implementing the Domain Model

Tactical patterns address how to implement domain logic within a bounded context. These are the building blocks of the domain model.

### Entities

An entity is an object with a unique identity that persists over time, even as its attributes change.

**Entity characteristics**:
- Has a unique identifier (ID)
- Mutable (attributes can change)
- Identity remains constant across the lifecycle
- Equality based on ID, not attributes

**When to use entities**: Model concepts that have continuity and lifecycle. Examples: Customer, Order, Account, Product.

**Example**:
```csharp
public class Order
{
    public OrderId Id { get; private set; }
    public CustomerId CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public Money Total { get; private set; }
    private List<OrderLine> _lines;

    public Order(OrderId id, CustomerId customerId)
    {
        Id = id ?? throw new ArgumentNullException(nameof(id));
        CustomerId = customerId ?? throw new ArgumentNullException(nameof(customerId));
        Status = OrderStatus.Draft;
        _lines = new List<OrderLine>();
    }

    // Identity-based equality
    public override bool Equals(object obj)
    {
        if (obj is Order other)
            return Id.Equals(other.Id);
        return false;
    }

    public override int GetHashCode() => Id.GetHashCode();
}
```

**Key point**: The same order with different line items or a different total is still the *same order* because the ID hasn't changed.

### Value Objects

A value object is an immutable object defined entirely by its attributes. It has no unique identity.

**Value object characteristics**:
- No unique identifier
- Immutable (cannot change after creation)
- Equality based on all attributes
- Interchangeable with other instances having the same values

**When to use value objects**: Model concepts that describe characteristics or measurements. Examples: Address, Money, DateRange, EmailAddress.

**Why value objects matter**: They encapsulate validation, prevent primitive obsession, and make the domain model more expressive.

**Example**:
```csharp
public class Money : IEquatable<Money>
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Currency is required");

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    // Value-based equality
    public bool Equals(Money other)
    {
        if (other is null) return false;
        return Amount == other.Amount && Currency == other.Currency;
    }

    public override bool Equals(object obj) => Equals(obj as Money);
    public override int GetHashCode() => HashCode.Combine(Amount, Currency);

    // Domain operations
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot add different currencies");

        return new Money(Amount + other.Amount, Currency);
    }
}
```

**Key point**: Two `Money` instances with the same amount and currency are completely interchangeable. Unlike entities, identity doesn't matter.

**Primitive obsession vs value objects**:
```csharp
// Bad: Primitive obsession
public void UpdatePrice(decimal amount, string currency) { }

// Good: Value object
public void UpdatePrice(Money price) { }
```

The value object version is safer (Money validates currency), more expressive (intent is clear), and easier to extend (can add currency conversion logic to Money).

### Aggregates

An aggregate is a cluster of entities and value objects treated as a single unit for data consistency. One entity acts as the aggregate root, which is the only entry point for modifications.

**Aggregate rules**:
1. **One aggregate root**: External objects can only reference the root
2. **Consistency boundary**: Invariants are enforced within the aggregate
3. **Transactional boundary**: Changes to the aggregate are saved atomically
4. **Small aggregates**: Keep aggregates as small as possible to reduce contention

**Why aggregates matter**: They define consistency boundaries. In distributed systems, you can't maintain consistency across unbounded object graphs. Aggregates limit the scope of transactional consistency.

**Example: Order aggregate**:
```csharp
public class Order // Aggregate root
{
    public OrderId Id { get; private set; }
    public CustomerId CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }

    private readonly List<OrderLine> _lines;
    public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();

    // Invariant: Order total must equal sum of line totals
    // Invariant: Cannot modify confirmed orders
    // Invariant: Cannot have empty orders

    public void AddLine(ProductId productId, int quantity, Money unitPrice)
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException("Cannot modify confirmed order");

        if (quantity <= 0)
            throw new ArgumentException("Quantity must be positive");

        _lines.Add(new OrderLine(productId, quantity, unitPrice));
        RecalculateTotal();
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException("Order already confirmed");

        if (!_lines.Any())
            throw new InvalidOperationException("Cannot confirm empty order");

        Status = OrderStatus.Confirmed;
        // Raise domain event
        AddDomainEvent(new OrderConfirmedEvent(Id, CustomerId, Total));
    }

    private void RecalculateTotal() { /* ... */ }
}

public class OrderLine // Entity within the aggregate
{
    public ProductId ProductId { get; private set; }
    public int Quantity { get; private set; }
    public Money UnitPrice { get; private set; }
    public Money LineTotal => UnitPrice.Multiply(Quantity);

    internal OrderLine(ProductId productId, int quantity, Money unitPrice)
    {
        ProductId = productId;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }
}
```

**Key design decisions**:
- `OrderLine` is internal to the aggregate; external code cannot create it directly
- All modifications go through the `Order` root
- Invariants (cannot modify confirmed orders, cannot have empty orders) are enforced
- Changes are atomic (add line and recalculate total happen together)

**Aggregate size**: Keep aggregates small. If you need to load 1000 order lines to validate an order, the aggregate is too large. Consider splitting it.

**Cross-aggregate references**: Use IDs, not object references.
```csharp
public class Order
{
    public CustomerId CustomerId { get; private set; } // Reference by ID
    // NOT: public Customer Customer { get; private set; } // Don't hold object reference
}
```

This prevents loading entire object graphs and clarifies aggregate boundaries.

### Domain Services

A domain service encapsulates domain logic that doesn't naturally belong to an entity or value object. Domain services are stateless operations that work with domain objects.

**When to use domain services**:
- Operation involves multiple aggregates
- Operation doesn't conceptually belong to any single entity
- Operation represents a significant domain concept

**Example: Funds transfer service**:
```csharp
public class FundsTransferService
{
    public void Transfer(Account fromAccount, Account toAccount, Money amount)
    {
        // Validate
        if (fromAccount.Currency != toAccount.Currency)
            throw new InvalidOperationException("Cannot transfer between different currencies");

        if (amount.Amount <= 0)
            throw new ArgumentException("Transfer amount must be positive");

        // Execute transfer (coordinating two aggregates)
        fromAccount.Withdraw(amount);
        toAccount.Deposit(amount);

        // Both accounts must be saved in the same transaction
    }
}
```

**Why not put this on Account?**: Transfer is a concept involving *two* accounts. Putting it on one account (`fromAccount.TransferTo(toAccount, amount)`) is arbitrary; why should the source account own this operation? A domain service makes the concept explicit.

**Domain service vs application service**:
- **Domain service**: Contains domain logic, uses ubiquitous language, works with domain objects
- **Application service**: Orchestrates use cases, manages transactions, translates DTOs to domain objects

### Repositories

A repository provides an abstraction for accessing aggregates, hiding persistence details from the domain model.

**Repository responsibilities**:
- Load aggregates by ID
- Save aggregates atomically
- Query for aggregates based on domain criteria
- Hide database, ORM, and infrastructure details

**Repository interface belongs in the domain layer**:
```csharp
public interface IOrderRepository
{
    Task<Order> GetByIdAsync(OrderId orderId);
    Task<IEnumerable<Order>> GetOrdersByCustomerAsync(CustomerId customerId);
    Task SaveAsync(Order order);
    Task DeleteAsync(OrderId orderId);
}
```

**Implementation lives in infrastructure layer**:
```csharp
public class OrderRepository : IOrderRepository
{
    private readonly DbContext _context;

    public async Task<Order> GetByIdAsync(OrderId orderId)
    {
        var entity = await _context.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        return entity; // ORM maps to domain object
    }

    public async Task SaveAsync(Order order)
    {
        // Handle new vs existing
        if (_context.Orders.Any(o => o.Id == order.Id))
            _context.Orders.Update(order);
        else
            _context.Orders.Add(order);

        await _context.SaveChangesAsync();
    }
}
```

**Repository guidelines**:
- One repository per aggregate root
- Repositories work with aggregates, not individual entities within aggregates
- Query methods return domain objects, not DTOs or database entities
- Keep query methods focused on domain needs ("find overdue orders") not generic SQL ("find by date range")

### Domain Events

Domain events represent something significant that happened in the domain. They enable loose coupling between aggregates and bounded contexts.

**Domain event characteristics**:
- Named in past tense (OrderConfirmed, PaymentReceived, AccountClosed)
- Immutable
- Contain data relevant to the event
- Typically include timestamp and aggregate ID

**Example**:
```csharp
public class OrderConfirmedEvent : IDomainEvent
{
    public OrderId OrderId { get; }
    public CustomerId CustomerId { get; }
    public Money Total { get; }
    public DateTime OccurredAt { get; }

    public OrderConfirmedEvent(OrderId orderId, CustomerId customerId, Money total)
    {
        OrderId = orderId;
        CustomerId = customerId;
        Total = total;
        OccurredAt = DateTime.UtcNow;
    }
}
```

**Raising domain events**:
```csharp
public class Order
{
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(IDomainEvent eventItem)
    {
        _domainEvents.Add(eventItem);
    }

    public void Confirm()
    {
        // Business logic
        Status = OrderStatus.Confirmed;

        // Raise event
        AddDomainEvent(new OrderConfirmedEvent(Id, CustomerId, Total));
    }
}
```

**Dispatching events** (typically in the repository or unit of work):
```csharp
public async Task SaveAsync(Order order)
{
    _context.Orders.Update(order);
    await _context.SaveChangesAsync();

    // After successful save, dispatch events
    foreach (var domainEvent in order.DomainEvents)
    {
        await _eventDispatcher.DispatchAsync(domainEvent);
    }
}
```

**Use cases for domain events**:
- Trigger side effects in other aggregates (OrderConfirmed → UpdateInventory)
- Notify other bounded contexts (OrderConfirmed → Billing context creates invoice)
- Build event-sourced systems (store events as the source of truth)
- Audit trail (record what happened in the domain)

## Advanced Patterns

### Specification Pattern

Encapsulates business rules for querying or validation in reusable, composable objects.

**Example**:
```csharp
public interface ISpecification<T>
{
    bool IsSatisfiedBy(T candidate);
}

public class OverdueOrderSpecification : ISpecification<Order>
{
    private readonly DateTime _currentDate;

    public OverdueOrderSpecification(DateTime currentDate)
    {
        _currentDate = currentDate;
    }

    public bool IsSatisfiedBy(Order order)
    {
        return order.Status == OrderStatus.Confirmed
            && order.ExpectedDeliveryDate < _currentDate;
    }
}

// Usage
var overdueSpec = new OverdueOrderSpecification(DateTime.UtcNow);
var overdueOrders = orders.Where(o => overdueSpec.IsSatisfiedBy(o));
```

**Benefits**: Business rules are explicit, reusable, testable, and composable (can combine with AND/OR logic).

### Factory Pattern

Encapsulates complex aggregate creation logic.

**Example**:
```csharp
public class OrderFactory
{
    public Order CreateOrder(CustomerId customerId, IEnumerable<OrderLineRequest> lines)
    {
        var order = new Order(OrderId.NewId(), customerId);

        foreach (var line in lines)
        {
            var product = _productRepository.GetById(line.ProductId);
            var unitPrice = _pricingService.GetPrice(product, customerId);

            order.AddLine(line.ProductId, line.Quantity, unitPrice);
        }

        return order;
    }
}
```

**When to use factories**: Aggregate creation requires multiple steps, external dependencies, or complex validation.

### Domain Model Layers

DDD typically uses layered architecture:

| Layer | Responsibilities | Dependencies |
|-------|------------------|--------------|
| **Presentation** | UI, API controllers, DTOs | Application layer |
| **Application** | Use case orchestration, transactions, security | Domain layer |
| **Domain** | Business logic, entities, value objects, domain services | None (pure domain) |
| **Infrastructure** | Persistence, messaging, external services | Domain (implements interfaces) |

**Dependency direction**: Always point toward the domain. The domain layer has no dependencies on infrastructure or application layers.

## Event Storming: Discovering the Domain Model

Event storming is a collaborative workshop technique for exploring complex business domains and discovering bounded contexts, aggregates, and domain events.

**Participants**: Developers, domain experts, product owners, anyone with domain knowledge.

**Materials**: Large wall or whiteboard, colored sticky notes, markers.

**Process**:

1. **Domain events (orange)**: Brainstorm everything that happens in the domain (OrderPlaced, PaymentReceived, InventoryReserved). Write in past tense.

2. **Timeline**: Arrange events in approximate chronological order along the wall.

3. **Commands (blue)**: Identify actions that cause events (PlaceOrder → OrderPlaced).

4. **Aggregates (yellow)**: Identify entities that process commands and produce events.

5. **Bounded contexts**: Look for clusters of related events and aggregates. Draw boundaries.

6. **Policies (purple)**: Identify automation rules ("Whenever OrderPlaced, then ReserveInventory").

7. **External systems (pink)**: Identify integrations with other systems.

**Outcomes**:
- Shared understanding of the domain
- Identified bounded contexts
- Discovered aggregates and their responsibilities
- Found missing concepts and edge cases
- Surfaced disagreements and ambiguity early

**Event storming is particularly valuable** when starting a new project, entering a new domain, or dealing with complex, poorly understood processes.

## DDD and Microservices

DDD's bounded contexts naturally align with microservices architecture.

**Bounded context → Microservice mapping**:
- Each bounded context can be a separate microservice
- Each service owns its data (database per service pattern)
- Services communicate via well-defined contracts (APIs, events)
- Teams can be organized around bounded contexts

**However**: Not every bounded context needs to be a separate service. Some contexts can be modules within a monolith. Use organizational boundaries, team autonomy, and deployment independence to decide.

**DDD patterns in microservices**:
- **Anti-Corruption Layer**: Translate between your context and external services
- **Open Host Service**: Publish stable APIs for other contexts
- **Domain Events**: Communicate state changes between services
- **Saga Pattern**: Coordinate transactions across bounded contexts
- **CQRS**: Separate read models from write models across services

For detailed patterns, see [Data Management Patterns](data_management_patterns.html), [Messaging Patterns](messaging_patterns.html), and [Orchestration and Choreography](orchestration_choreography.html).

## Common DDD Pitfalls

### Anemic Domain Model

<div class="callout callout--warning">
<p class="callout__title">Anti-Pattern: Anemic Domain Model</p>
<p><strong>Problem:</strong> Entities have only getters/setters with no behavior. All logic lives in services.</p>

<p><strong>Why it's a problem:</strong> The domain model doesn't enforce invariants. Any code can violate business rules.</p>
<p><strong>Solution:</strong> Put behavior on the entities.</p>
</div>

```csharp
// ❌ Anemic - just data
public class Order
{
    public OrderId Id { get; set; }
    public List<OrderLine> Lines { get; set; }
    public OrderStatus Status { get; set; }
}

public class OrderService
{
    public void AddLine(Order order, OrderLine line)
    {
        order.Lines.Add(line);
    }
}

// ✅ Rich domain model
public class Order
{
    private readonly List<OrderLine> _lines;

    public void AddLine(ProductId productId, int quantity, Money unitPrice)
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException("Cannot modify confirmed order");

        _lines.Add(new OrderLine(productId, quantity, unitPrice));
    }
}
```

### Overusing Domain Services

**Problem**: Moving all logic to domain services, leaving entities as data containers.

**Solution**: Domain logic should live in entities and value objects by default. Use domain services only when logic doesn't naturally belong to a single aggregate.

### Aggregates That Are Too Large

**Problem**: Loading 10,000 order lines every time you access an order.

**Solution**: Keep aggregates small. Use eventual consistency between aggregates. Query for read-only data separately from aggregates.

### Ignoring Bounded Contexts

**Problem**: Trying to create one unified model for the entire enterprise.

**Solution**: Accept that different parts of the system need different models. Use bounded contexts and context maps to manage complexity.

### Applying DDD Everywhere

**Problem**: Using full DDD tactical patterns for simple CRUD screens or generic subdomains.

**Solution**: Focus DDD effort on the core domain. Use simpler patterns for supporting and generic subdomains.

## Practical Implementation Strategy

**Starting with DDD**:

1. **Discover bounded contexts**: Run event storming workshop, identify language boundaries
2. **Pick one core subdomain**: Don't try to model everything at once
3. **Build ubiquitous language**: Collaborate with domain experts to define key terms
4. **Model one aggregate**: Start small, validate with domain experts
5. **Implement walking skeleton**: Prove the architecture works end-to-end
6. **Iterate and refine**: Modeling is continuous; expect to refactor as understanding deepens
7. **Expand gradually**: Add aggregates, value objects, and domain services as needed

**Migration strategy for existing systems**:

1. **Identify core domain**: Where is the business value and complexity?
2. **Add Anti-Corruption Layer**: Isolate new domain model from legacy system
3. **Implement new features with DDD**: Don't rewrite everything; apply DDD to new work
4. **Refactor incrementally**: Gradually extract domain logic from legacy code
5. **Use Strangler Fig pattern**: Slowly replace legacy system with new bounded contexts

## Key Takeaways

**Strategic design is more valuable than tactical patterns**: Bounded contexts, ubiquitous language, and context mapping solve organizational and communication problems. Entities and aggregates solve code organization problems. Fix communication first.

**DDD is about modeling, not architecture**: DDD works with monoliths, microservices, or modular monoliths. The architecture should support the domain model, not dictate it.

**Ubiquitous language is non-negotiable**: If developers and domain experts aren't speaking the same language, everything else fails.

**Keep aggregates small**: Aggregates are consistency boundaries. Large aggregates create contention, performance problems, and coupling. Use eventual consistency between aggregates.

**Not all code is domain code**: Generic subdomains should use off-the-shelf solutions. Supporting subdomains can use simpler patterns. Reserve full DDD for the core domain.

**Event storming accelerates understanding**: Collaborative modeling workshops surface misunderstandings, missing concepts, and bounded context boundaries faster than writing code.

**DDD requires domain expert collaboration**: You cannot build a rich domain model by reading requirements documents. You need ongoing conversation with people who understand the business deeply.

**Domain modeling is iterative**: Your first model will be wrong. Expect to refactor as you learn. Resist the urge to get the model "perfect" before shipping.
