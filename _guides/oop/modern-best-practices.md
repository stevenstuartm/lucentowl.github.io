---
title: "Design Principles Beyond SOLID"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "The design heuristics that sit beside SOLID: composition over inheritance and the fragile base class problem, dependency injection by constructor, property, and method, immutability, KISS, YAGNI, and DRY as a rule about knowledge rather than code, the code smells that signal each has been ignored, and how the principles pull against each other."
tags: [composition-over-inheritance, dependency-injection, immutability, dry, yagni, kiss, practical]
---

## Composition Over Inheritance

The Gang of Four's *Design Patterns* (1994) put the advice in six words: "Favor object composition over class inheritance." Inheritance reuses code by making a new class a kind of an existing one. Composition reuses code by having one object hold a reference to another and call it. Both get the behavior reused, but they couple the two classes very differently.

### The Fragile Base Class Problem

A subclass depends on how its base class is implemented as well as on what it promises, and that dependency is invisible until the base changes. Suppose a subclass wants to count every item saved:

```csharp
public class Repository<T>
{
    public virtual void Save(T item) { /* write to storage */ }

    public virtual void SaveAll(IEnumerable<T> items)
    {
        foreach (var item in items)
            Save(item);
    }
}

public class CountingRepository<T> : Repository<T>
{
    public int Count { get; private set; }

    public override void Save(T item)
    {
        Count++;
        base.Save(item);
    }

    public override void SaveAll(IEnumerable<T> items)
    {
        Count += items.Count();
        base.SaveAll(items);
    }
}
```

Saving three items with `SaveAll` gives a count of six, because the base `SaveAll` calls `Save`, which counts again. The subclass author could fix that by removing the `SaveAll` override, and it would work until a later version of `Repository` writes batches directly without calling `Save`. Then the count silently drops to zero for batches. The base class changed an implementation detail it never promised, and a subclass it has never seen broke.

### The Same Behavior by Composition

```csharp
public interface IRepository<T>
{
    void Save(T item);
    void SaveAll(IEnumerable<T> items);
}

public class CountingRepository<T> : IRepository<T>
{
    private readonly IRepository<T> inner;

    public CountingRepository(IRepository<T> inner) => this.inner = inner;

    public int Count { get; private set; }

    public void Save(T item)
    {
        Count++;
        inner.Save(item);
    }

    public void SaveAll(IEnumerable<T> items)
    {
        var list = items.ToList();
        Count += list.Count;
        inner.SaveAll(list);
    }
}
```

`CountingRepository` now depends only on the `IRepository<T>` contract. Whether the inner repository's `SaveAll` calls its own `Save` doesn't matter, because those calls go to the inner object and never come back through the counter. The wrapper also works with any repository, and a caller can choose at runtime whether to count at all.

### Choosing Between Them

| Inheritance fits when | Composition fits when |
|---|---|
| The subtype really is a kind of the base and can stand in for it everywhere | The goal is to reuse behavior, not to claim a type relationship |
| The base class was designed for extension and documents what overrides may rely on | The reused class wasn't designed for subclassing, or belongs to someone else |
| The hierarchy is shallow and changes rarely | Behaviors need to be mixed, swapped, or chosen at runtime |

Composition costs some forwarding code, and a class that only forwards every call to one inner object gains little. It's the default because its failure is visible (a missing forwarding method is a compile error), while inheritance's failure is a behavior change nobody was told about.

---

## Dependency Injection

Dependency injection means a class receives the objects it depends on instead of creating them. It is the usual way to put dependency inversion into practice: the class names an abstraction, and something outside decides which implementation it gets.

### Three Ways to Inject

**Constructor injection** is for dependencies the class can't work without. The constructor makes them impossible to forget, and `readonly` fields keep them from changing afterward.

```csharp
public class OrderService
{
    private readonly IOrderRepository orders;
    private readonly IPaymentProcessor payments;

    public OrderService(IOrderRepository orders, IPaymentProcessor payments)
    {
        this.orders = orders ?? throw new ArgumentNullException(nameof(orders));
        this.payments = payments ?? throw new ArgumentNullException(nameof(payments));
    }
}
```

**Property injection** is for optional dependencies with a sensible default. The default is often a null object, an implementation that does nothing, so the class never has to check for `null`.

```csharp
public class ReportGenerator
{
    public ILogger Logger { get; set; } = NullLogger.Instance;

    public string Generate(ReportData data)
    {
        Logger.LogInformation("Generating report");
        return Render(data);
    }
}
```

**Method injection** is for a dependency that varies with each call rather than for the object's lifetime.

```csharp
public class DocumentProcessor
{
    public void Process(Document document, IFormatter formatter) =>
        Save(formatter.Format(document));
}
```

Constructor injection should be the default. Property injection hides a dependency from anyone reading the constructor, so it fits only when the class really does work without it.

### Wiring Happens in One Place

If classes receive their dependencies, something still has to create them. That place is the composition root, usually the application's entry point, where the whole object graph is built. In .NET a DI container does the building, but the principle holds with plain `new` calls too. Everything below the composition root stays unaware of which implementations it is using.

The opposite approach, a class asking a global registry for its dependencies from inside its own methods, is the service locator. It still decouples the class from concrete types, but the dependencies disappear from the constructor, so neither readers nor tests can see what the class needs.

### Hidden Dependencies Make Code Hard to Test

Services aren't the only dependencies to inject. Anything the class reaches out and grabs, such as the clock, a random number generator, or the file system, makes its behavior depend on something a test can't control.

```csharp
// Hard to test: the result depends on when the test runs
public class SubscriptionService
{
    public bool IsExpired(Subscription s) => DateTime.UtcNow > s.ExpiresAt;
}

// Testable: the clock is a dependency
public class SubscriptionService
{
    private readonly TimeProvider clock;

    public SubscriptionService(TimeProvider clock) => this.clock = clock;

    public bool IsExpired(Subscription s) => clock.GetUtcNow() > s.ExpiresAt;
}
```

.NET 8 added `TimeProvider` for exactly this. Production code passes `TimeProvider.System`, and a test passes a `FakeTimeProvider` from the `Microsoft.Extensions.TimeProvider.Testing` package, set to whatever moment the test needs.

---

## Immutability

An immutable object can't change after it's constructed. Any "change" produces a new object and leaves the original as it was.

That removes several problems at once. Invariants are checked once, in the constructor, and can never be broken later. An immutable object can be shared between threads with no locking, and handed to other code without a defensive copy, since nobody can modify it. It's also safe as a dictionary key, because its hash code can't drift.

```csharp
public record Money(decimal Amount, string Currency)
{
    public Money Add(Money other)
    {
        if (other.Currency != Currency)
            throw new InvalidOperationException("Currency mismatch");

        return this with { Amount = Amount + other.Amount };
    }
}

var price = new Money(10m, "USD");
var total = price.Add(new Money(5m, "USD")); // price is still 10 USD
```

The cost is an allocation for every change, which matters for large objects updated in a hot loop, and some awkwardness for things that really do change over time, like an order moving through its lifecycle. A practical default is to make small value-like types (money, dates, coordinates, settings) immutable and to let entities with identity change through methods that guard their invariants. `with` makes a shallow copy, so a record that holds a mutable list is still mutable through that list.

---

## Simplicity Principles

### KISS: Keep It Simple

The phrase is usually attributed to aircraft engineer Kelly Johnson. In software it means choosing the simplest design that meets the requirement, and treating each extra layer of abstraction as a cost that has to be paid for.

```csharp
// Over-engineered: three abstractions for one addition
public class Calculator
{
    private readonly IOperationFactory factory;
    private readonly ICalculationValidator validator;

    public int Add(int a, int b)
    {
        var operation = factory.Create(OperationType.Addition);
        validator.Validate(a, b);
        return operation.Execute(a, b);
    }
}

// Simple
public static class Calculator
{
    public static int Add(int a, int b) => a + b;
}
```

The first version isn't wrong for a system that really does need pluggable, validated operations. It's wrong when nothing requires them. Complexity earns its place when the problem has it: several real variations, rules that change independently, or a library whose callers you can't see.

### YAGNI: You Aren't Gonna Need It

YAGNI comes from Extreme Programming: don't build a capability until a current requirement needs it. Speculative code has to be written, tested, and maintained, and when the real requirement finally arrives, it often differs from the guess.

```csharp
// Speculative: lookups nobody has asked for
public class UserService
{
    public Task<User> GetById(int id) { /* ... */ }
    public Task<User> GetByEmail(string email) { /* ... */ }
    public Task<User> GetByPhone(string phone) { /* ... */ }
    public Task<User> GetByExternalId(string id) { /* ... */ }
}

// What the current feature needs
public class UserService
{
    public Task<User> GetById(int id) { /* ... */ }
}
```

YAGNI applies to features, not to the practices that keep code easy to change. Clear names, tests, and small classes aren't speculative, because they're what makes adding the email lookup cheap on the day someone asks for it.

### DRY: Don't Repeat Yourself

Andy Hunt and Dave Thomas define DRY in *The Pragmatic Programmer* (1999): "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system." The rule is about knowledge, not text. Two copies of the same business rule will drift apart, because someone will update one and not the other.

```csharp
// The rule "an order needs a customer and a positive total" lives in two places
public IActionResult CreateOrder(CreateOrderRequest request)
{
    if (string.IsNullOrEmpty(request.CustomerName) || request.Total <= 0)
        return BadRequest();
    // ...
}

public IActionResult UpdateOrder(UpdateOrderRequest request)
{
    if (string.IsNullOrEmpty(request.CustomerName) || request.Total <= 0)
        return BadRequest();
    // ...
}

// One authoritative representation
public class OrderValidator
{
    public IReadOnlyList<string> Validate(string customerName, decimal total)
    {
        var errors = new List<string>();
        if (string.IsNullOrEmpty(customerName)) errors.Add("Customer name is required");
        if (total <= 0) errors.Add("Total must be positive");
        return errors;
    }
}
```

The reverse also holds. Two blocks of code that look alike but encode different knowledge aren't duplication. If the shipping-cost and tax calculations happen to share a formula today, merging them couples two rules owned by different people, and the first change to either one forces the shared code to grow a flag. A common guard is the rule of three: tolerate a second copy, and extract on the third, when the shared shape has shown itself to be real.

---

## Code Smells

A code smell is a surface sign that one of these principles has been ignored. It's a prompt to look closer, not proof of a problem.

| Smell | What it looks like | Principle it points to |
|---|---|---|
| **God object** | One class that knows and does most of the system's work | Single responsibility |
| **Shotgun surgery** | One change requires small edits in many classes | DRY: the knowledge is scattered |
| **Speculative generality** | Hooks, parameters, and abstractions for cases that don't exist | YAGNI, KISS |
| **Pattern overuse** | A factory, a strategy, and an interface wrapped around a single implementation | KISS |
| **Refused bequest** | A subclass that overrides inherited members to do nothing or throw | Composition over inheritance, Liskov substitution |
| **Hidden dependencies** | `new`, static calls, or `DateTime.Now` buried inside business logic | Dependency injection |
| **Premature optimization** | Complex code justified by performance that was never measured | KISS |

Donald Knuth's line from 1974 is the usual reminder for the last row: "premature optimization is the root of all evil." The rest of the sentence matters as much. Knuth was arguing against optimizing the 97% of code where it makes no difference, not against optimizing the critical 3% once measurement finds it.

---

## When the Principles Pull Against Each Other

These heuristics don't form a consistent rulebook, and applying one hard tends to violate another.

- **DRY versus decoupling.** Extracting shared code makes every user of it depend on it. Across service or team boundaries, a little duplication is often cheaper than a shared library that forces everyone to upgrade together.
- **YAGNI versus open-closed.** Open-closed asks for extension points, and YAGNI asks you not to build what isn't needed. The resolution is to add the extension point when the second variation arrives, not before.
- **KISS versus dependency injection.** Injecting everything adds constructors, interfaces, and wiring. Inject what varies or what tests need to control, and let stable helpers be called directly.
- **Composition versus simplicity.** A deep stack of wrappers is as hard to follow as a deep hierarchy. Composition is the better default, not a reason to wrap everything.

Each principle names a cost to avoid, and applying them well means judging which cost is larger in the code in front of you.
