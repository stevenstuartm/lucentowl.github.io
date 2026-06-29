---
title: "OOP Quick Reference"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "Quick reference guide to all design patterns organized by category with purpose, use cases, and practical guidance for pattern selection."
tags: [oop, reference, quick-reference, cheatsheet]
---

---

## Design Pattern Categories

### Creational Patterns (5 patterns)

Focus on object creation mechanisms, increasing flexibility and reuse.

| Pattern | Purpose | When to Use | When to Avoid |
|---------|---------|-------------|---------------|
| **Factory Method** | Define interface for creating objects, let subclasses decide which class to instantiate | Multiple creation paths, hide instantiation complexity | Single, simple constructor suffices |
| **Abstract Factory** | Create families of related objects without specifying concrete classes | Need consistent families of objects (UI themes, cross-platform) | Only one product family exists |
| **Builder** | Construct complex objects step-by-step | Objects with many optional parameters, immutable objects | Simple objects with few properties |
| **Prototype** | Create new objects by cloning existing ones | Expensive object creation, object state templates | Objects are cheap to create from scratch |
| **Singleton** | Ensure only one instance exists globally | Shared resources like logging and config (**Use DI instead**) | Almost always (prefer dependency injection) |

### Structural Patterns (7 patterns)

Deal with object composition and relationships.

| Pattern | Purpose | When to Use | When to Avoid |
|---------|---------|-------------|---------------|
| **Adapter** | Make incompatible interfaces work together | Integrating legacy code, third-party libraries | You control both interfaces (fix the design) |
| **Bridge** | Separate abstraction from implementation | Avoid Cartesian product explosion (N abstractions × M implementations) | Simple one-to-one relationship |
| **Composite** | Treat individual objects and compositions uniformly | Tree structures (files/folders, UI components) | Flat structure with no hierarchy |
| **Decorator** | Add behavior to objects dynamically | Flexible alternative to subclassing, runtime behavior modification | Compile-time behavior definition is sufficient |
| **Facade** | Provide simplified interface to complex subsystems | Hide complexity, reduce dependencies on subsystem | Subsystem is already simple |
| **Flyweight** | Share common state across many objects to reduce memory | Large number of similar objects, memory constraints | Few objects or unique state dominates |
| **Proxy** | Control access to objects (lazy loading, access control, caching) | Expensive object creation, access control, caching | Direct access is simpler and sufficient |

### Behavioral Patterns (11 patterns)

Focus on communication between objects and responsibility distribution.

| Pattern | Purpose | When to Use | When to Avoid |
|---------|---------|-------------|---------------|
| **Chain of Responsibility** | Pass requests along a chain of handlers | Multiple handlers, handler selection at runtime | Single handler or static handler selection |
| **Command** | Encapsulate requests as objects | Undo/redo, queuing operations, logging requests | Simple method calls suffice |
| **Interpreter** | Define grammar and interpreter for a language | Simple domain-specific languages | Complex grammars (use parser generator) |
| **Iterator** | Access collection elements sequentially without exposing structure | Custom traversal algorithms | Standard foreach loop works |
| **Mediator** | Centralize complex communications between objects | Many-to-many object relationships | Simple one-to-one relationships |
| **Memento** | Capture and restore object state | Undo/redo functionality, snapshots | State is simple enough to store directly |
| **Observer** | Notify dependents of state changes | Event-driven systems, publish-subscribe | Simple callbacks or direct calls work |
| **State** | Change behavior based on internal state | Complex state-dependent behavior | Simple if/switch statements suffice |
| **Strategy** | Define family of algorithms, make them interchangeable | Runtime algorithm selection, multiple implementations | Single algorithm, no variation needed |
| **Template Method** | Define algorithm skeleton, let subclasses override steps | Common algorithm structure with varying steps | No variation in algorithm steps |
| **Visitor** | Add operations to object hierarchies without modifying them | Operations on complex object structures | Simple structures (use pattern matching) |

## Pattern Selection Decision Tree

### "I need to create objects..."

```
Do you have multiple ways to create the object?
├─ YES: Complex construction process?
│   ├─ YES: Many optional parameters → Builder
│   └─ NO: Multiple factory methods → Factory Method
└─ NO: Need consistent families of objects?
    ├─ YES → Abstract Factory
    ├─ NO: Clone existing objects → Prototype
    └─ NO: Single instance needed → Singleton (prefer DI)
```

### "I need to structure relationships..."

```
Working with incompatible interfaces?
├─ YES: Wrapping legacy/third-party → Adapter
└─ NO: Need to hide complexity?
    ├─ YES → Facade
    └─ NO: Tree structure?
        ├─ YES → Composite
        └─ NO: Add behavior dynamically?
            ├─ YES → Decorator
            └─ NO: Control object access → Proxy
```

### "I need to manage behavior..."

```
Multiple handlers for a request?
├─ YES: Chain of handlers → Chain of Responsibility
└─ NO: Algorithm varies at runtime?
    ├─ YES → Strategy
    └─ NO: Need undo/redo?
        ├─ YES: For operations → Command
        └─ YES: For state → Memento
        └─ NO: Notify multiple objects?
            ├─ YES → Observer
            └─ NO: State-dependent behavior → State
```

## Common Anti-Patterns to Avoid

<div class="callout callout--warning">
<p class="callout__title">Warning: Common Anti-Patterns</p>
<p>These anti-patterns indicate design problems that violate SOLID principles and make code harder to maintain, test, and extend.</p>
</div>

### God Object
**Problem**: One class does everything.
```csharp
// BAD
public class Application
{
    public void ProcessUserLogin() { }
    public void GenerateReports() { }
    public void SendEmails() { }
    public void ManageDatabase() { }
    public void HandlePayments() { }
}

// GOOD: Single Responsibility Principle
public class AuthenticationService { }
public class ReportGenerator { }
public class EmailService { }
public class DataRepository { }
public class PaymentProcessor { }
```

### Spaghetti Code
**Problem**: Tangled dependencies, difficult to follow.
```csharp
// BAD: Tight coupling
public class OrderService
{
    public void Process(Order order)
    {
        var validator = new OrderValidator();
        var calculator = new PriceCalculator();
        var repository = new OrderRepository();
        // Direct dependencies everywhere
    }
}

// GOOD: Dependency Injection
public class OrderService
{
    private readonly IOrderValidator validator;
    private readonly IPriceCalculator calculator;
    private readonly IOrderRepository repository;

    public OrderService(IOrderValidator validator, IPriceCalculator calculator, IOrderRepository repository)
    {
        this.validator = validator;
        this.calculator = calculator;
        this.repository = repository;
    }
}
```

### Tight Coupling
**Problem**: Changes in one class force changes in many others.
```csharp
// BAD
public class EmailSender
{
    public void Send(string to, string message)
    {
        var smtp = new SmtpClient("smtp.gmail.com"); // Tight coupling
        smtp.Send(to, message);
    }
}

// GOOD: Program to interfaces
public interface IEmailSender
{
    void Send(string to, string message);
}

public class SmtpEmailSender : IEmailSender
{
    private readonly string smtpServer;

    public SmtpEmailSender(string smtpServer)
    {
        this.smtpServer = smtpServer;
    }

    public void Send(string to, string message)
    {
        var smtp = new SmtpClient(smtpServer);
        smtp.Send(to, message);
    }
}
```

### Premature Optimization
**Problem**: Complex patterns without justification.
```csharp
// BAD: Over-engineered for simple task
public interface INumberAdder { }
public class NumberAdderFactory { }
public class NumberAdderContext { }
public class NumberAdderStrategy { }

// GOOD: Keep it simple
public class Calculator
{
    public int Add(int a, int b) => a + b;
}
```

### Pattern Overuse
**Problem**: Using patterns where simple code suffices.
```csharp
// BAD: Unnecessary abstraction
public interface IGreeter { string Greet(); }
public class HelloGreeter : IGreeter { public string Greet() => "Hello"; }
public class GreeterFactory { public IGreeter Create() => new HelloGreeter(); }

// GOOD: Direct implementation
public string Greet() => "Hello";
```

## Modern Framework Integration

### ASP.NET Core Patterns

| Framework Feature | Design Pattern | Example |
|-------------------|----------------|---------|
| Dependency Injection | Service Locator, Factory | `services.AddScoped<IUserService, UserService>()` |
| Middleware Pipeline | Chain of Responsibility | `app.UseAuthentication().UseAuthorization()` |
| Options Pattern | Builder | `services.Configure<MyOptions>(config)` |
| Filters | Decorator | `[Authorize]`, `[ValidateModel]` |
| Tag Helpers | Decorator/Adapter | `<asp-validation-for>` |
| Model Binding | Adapter | Request → Model conversion |

### Entity Framework Core Patterns

| Framework Feature | Design Pattern | Example |
|-------------------|----------------|---------|
| DbContext | Unit of Work | Transaction management |
| DbSet | Repository | `context.Users.Where(...)` |
| Change Tracker | Observer | Track entity state changes |
| Lazy Loading | Proxy | Virtual navigation properties |
| Migration | Command | `Add-Migration`, `Update-Database` |
| Value Converters | Adapter | Custom type conversions |

### SignalR Patterns

| Framework Feature | Design Pattern | Example |
|-------------------|----------------|---------|
| Hub | Facade | Simple interface to complex messaging |
| Hub Clients | Observer | Broadcast to connected clients |
| Groups | Mediator | Manage client groups |

### MediatR (CQRS Library)

| Framework Feature | Design Pattern | Example |
|-------------------|----------------|---------|
| Request/Response | Command/Query | `Send(new GetUserQuery())` |
| Handlers | Chain of Responsibility | Pipeline behaviors |
| Notifications | Observer/Mediator | `Publish(new UserCreatedEvent())` |

## SOLID Principles Quick Reference

| Principle | Key Question | Red Flag | Solution |
|-----------|--------------|----------|----------|
| **Single Responsibility** | "Why would this class change?" | Class has multiple reasons to change | Extract classes for each responsibility |
| **Open-Closed** | "Can I extend without modifying?" | Long if/switch on type | Use polymorphism via interfaces |
| **Liskov Substitution** | "Can I substitute derived for base?" | Exceptions thrown in overrides | Redesign hierarchy or use interfaces |
| **Interface Segregation** | "Do I use all interface methods?" | NotImplementedException | Split into smaller interfaces |
| **Dependency Inversion** | "Do I depend on abstractions?" | `new` keyword everywhere | Inject dependencies via constructor |

## When to Use OOP vs Other Paradigms

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Object-Oriented Programming</h4>
<p><strong>Best For:</strong></p>
<ul>
<li>Business domain modeling</li>
<li>Complex state management</li>
<li>Clear entity relationships</li>
<li>Polymorphic behavior</li>
<li>Framework/library design</li>
</ul>
<p><strong>Example:</strong> E-commerce system with Products, Orders, Customers</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Functional Programming</h4>
<p><strong>Best For:</strong></p>
<ul>
<li>Data transformation pipelines</li>
<li>Stateless operations</li>
<li>Mathematical computations</li>
<li>Concurrent operations</li>
<li>Immutable data</li>
</ul>
<p><strong>Example:</strong> Data processing, LINQ queries</p>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">Procedural Programming</p>
<p><strong>Best For:</strong> Simple scripts, linear workflows, system utilities, one-off tasks</p>
<p><strong>Example:</strong> Build scripts, data migration</p>
</div>

### Hybrid Approach (Modern C#)
```csharp
// OOP for domain entities
public class Order
{
    public int Id { get; init; }
    public List<OrderItem> Items { get; init; }
    public decimal Total => Items.Sum(i => i.Price);
}

// Functional for transformations
public static class OrderExtensions
{
    public static IEnumerable<Order> FilterByDate(this IEnumerable<Order> orders, DateTime start, DateTime end) =>
        orders.Where(o => o.CreatedDate >= start && o.CreatedDate <= end);

    public static decimal CalculateTotalRevenue(this IEnumerable<Order> orders) =>
        orders.Sum(o => o.Total);
}

// Usage: Combines both approaches
var revenue = orders
    .FilterByDate(startDate, endDate)
    .CalculateTotalRevenue();
```

## Pattern Complexity Guide

### Beginner-Friendly Patterns
Start with these, as they are easy to understand and apply:
- **Factory Method**: Simple object creation
- **Singleton**: Single instance (use DI)
- **Strategy**: Interchangeable algorithms
- **Observer**: Event handling (use C# events)
- **Decorator**: Add behavior dynamically
- **Facade**: Simplify complex systems

### Intermediate Patterns
Learn after mastering basics:
- **Builder**: Complex object construction
- **Adapter**: Interface compatibility
- **Command**: Undo/redo operations
- **State**: State-dependent behavior
- **Template Method**: Algorithm skeleton
- **Proxy**: Control access

### Advanced Patterns
Require deeper understanding:
- **Abstract Factory**: Object family creation
- **Bridge**: Abstraction/implementation separation
- **Composite**: Tree structures
- **Chain of Responsibility**: Request handling chain
- **Visitor**: Operations on hierarchies
- **Flyweight**: Memory optimization
- **Interpreter**: Language processing
- **Mediator**: Complex object interactions
- **Memento**: State snapshots

---

> **Remember**: Patterns are tools, not goals. Use them to solve specific problems, not because they exist. Modern development emphasizes simplicity, testability, and maintainability over pattern implementation. **When in doubt, choose simple code over clever patterns.**

---
