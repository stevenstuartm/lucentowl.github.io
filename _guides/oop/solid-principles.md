---
title: "SOLID Principles"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "The five SOLID principles and how to recognize a violation of each: single responsibility as one actor per module, open-closed through abstractions chosen for the change you expect, Liskov substitution as a contract on preconditions, postconditions, and invariants, interface segregation, and dependency inversion as who owns the interface. Also covers where each came from and when applying them goes too far."
tags: [solid, single-responsibility, open-closed, liskov-substitution, interface-segregation, dependency-inversion, fundamentals]
---

## Where SOLID Came From

Robert C. Martin assembled these principles over the late 1980s and 1990s and wrote them up in a series of articles and in his 2000 paper "Design Principles and Design Patterns". Around 2004, Michael Feathers noticed that reordering them spelled SOLID. Open-closed and Liskov substitution came from other people.

| Principle | Origin |
|---|---|
| Single Responsibility | Martin, consolidating earlier work on modularity and cohesion by David Parnas, Edsger Dijkstra, Larry Constantine, Tom DeMarco, and Meilir Page-Jones |
| Open-Closed | Bertrand Meyer, *Object-Oriented Software Construction* (1988) |
| Liskov Substitution | Barbara Liskov, OOPSLA keynote "Data Abstraction and Hierarchy" (1987); formalized with Jeannette Wing in 1994 |
| Interface Segregation | Martin, from consulting work at Xerox, published 1996 |
| Dependency Inversion | Martin, published 1996 |

All five aim at the same outcome: a change to one part of a system should force as few other parts as possible to change, be recompiled, or be retested.

---

## S: Single Responsibility Principle

Martin's first wording was "a class should have only one reason to change." Readers took "one reason" to mean "one thing it does", which led to classes split down to a single method. His later wording in *Clean Architecture* (2017) names who the reasons come from: **a module should be responsible to one, and only one, actor.** An actor is a group of people who request changes for the same reason, such as the finance team, the HR team, or the database administrators.

### Two Actors Sharing One Class

Martin's own example is an `Employee` class that serves three actors at once:

```csharp
public class Employee
{
    public string Name { get; init; } = "";
    public List<TimeCard> TimeCards { get; } = new();

    // Finance defines how pay is calculated
    public decimal CalculatePay() => RegularHours() * HourlyRate + OvertimePay();

    // HR defines how hours are reported
    public string ReportHours() => $"{Name}: {RegularHours()} regular hours";

    // DBAs define how employees are stored
    public void Save() { /* SQL */ }

    // Shared by finance and HR
    private decimal RegularHours() => TimeCards.Sum(t => Math.Min(t.Hours, 8));

    // ...
}
```

Finance asks for a change to how regular hours are counted. A developer edits `RegularHours`, the pay tests pass, and HR's hour report is now wrong, because it silently shared the calculation. Nobody from HR asked for a change, yet their output changed. That coupling between actors is what the principle prevents, and it's why "does this class do one thing" is the wrong test. `CalculatePay` and `ReportHours` are each one thing. The problem is that two different groups own them.

### Separating by Actor

```csharp
public record EmployeeData(string Name, IReadOnlyList<TimeCard> TimeCards);

public class PayCalculator    // finance
{
    public decimal CalculatePay(EmployeeData employee) { /* ... */ }
}

public class HourReporter     // HR
{
    public string ReportHours(EmployeeData employee) { /* ... */ }
}

public class EmployeeRepository  // DBAs
{
    public void Save(EmployeeData employee) { /* ... */ }
}
```

Each class now changes only when its own actor asks. If finance and HR really do need the same definition of regular hours, that's a shared business rule, and it gets its own home that both depend on deliberately rather than by accident.

To find violations, ask who would request a change to each method. If the answers name more than one group, the class answers to more than one actor.

---

## O: Open-Closed Principle

Meyer's formulation was that a module should be **open for extension but closed for modification**: it should be possible to add behavior without editing code that already works. Meyer meant extension through inheritance. Martin's version, the one in common use, means extension through an abstraction that new implementations plug into.

### A Switch That Grows With Every Feature

```csharp
public enum CustomerType { Regular, Premium, Employee }

public class DiscountCalculator
{
    public decimal Discount(CustomerType type, decimal total) => type switch
    {
        CustomerType.Regular => 0m,
        CustomerType.Premium => total * 0.10m,
        CustomerType.Employee => total * 0.25m,
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };
}
```

Every new customer type means editing this method and every other `switch` on `CustomerType` elsewhere in the code, and retesting all of them.

### Extending Through an Abstraction

```csharp
public interface IDiscountPolicy
{
    decimal Discount(decimal total);
}

public class NoDiscount : IDiscountPolicy
{
    public decimal Discount(decimal total) => 0m;
}

public class PercentageDiscount : IDiscountPolicy
{
    private readonly decimal rate;

    public PercentageDiscount(decimal rate) => this.rate = rate;

    public decimal Discount(decimal total) => total * rate;
}

public class Checkout
{
    private readonly IDiscountPolicy discountPolicy;

    public Checkout(IDiscountPolicy discountPolicy) => this.discountPolicy = discountPolicy;

    public decimal Total(decimal subtotal) => subtotal - discountPolicy.Discount(subtotal);
}
```

A seasonal promotion is now a new `IDiscountPolicy` class, and `Checkout` is untouched.

### Closure Is Always Against a Particular Change

No design is closed against every change. `Checkout` is closed against new discount rules, but adding tax still means editing it. Martin calls picking the axis *strategic closure*: close the code against the kinds of change you have evidence to expect, usually because that kind of change has already happened once or twice. Abstractions added for changes that never come are cost without benefit.

---

## L: Liskov Substitution Principle

A subtype must be usable anywhere its base type is expected, without the caller noticing. Liskov and Wing's 1994 statement is precise: if a property can be proven about objects of type T, it must also hold for objects of any subtype S of T. In practice, that means a subtype must honor the whole contract of its base, not just its method signatures.

### The Contract Rules

The compiler checks that an override has the right signature. It can't check behavior, so these rules are the developer's job:

| A subtype may not | Meaning | Example violation |
|---|---|---|
| **Strengthen preconditions** | It must accept every input the base accepts | The base accepts any quantity. The override throws for quantities above 100. |
| **Weaken postconditions** | It must deliver everything the base promises | The base promises a non-null result. The override returns `null`. |
| **Break invariants** | Rules that always hold for the base still hold | See `Square` below. |
| **Throw new kinds of exceptions** | Only exceptions the base's contract allows, or subtypes of them | The override throws `NotSupportedException` where the base never did. |
| **Allow state changes the base forbids** | Liskov and Wing's history constraint | A mutable subtype of a type documented as immutable. |

Going the other way is allowed. A subtype may accept more inputs than its base, promise more in its results, and return a more specific type.

### Rectangle and Square

A square is a rectangle in geometry, so inheritance looks natural:

```csharp
public class Rectangle
{
    public virtual int Width { get; set; }
    public virtual int Height { get; set; }
    public int Area => Width * Height;
}

public class Square : Rectangle
{
    public override int Width
    {
        get => base.Width;
        set { base.Width = value; base.Height = value; }
    }

    public override int Height
    {
        get => base.Height;
        set { base.Width = value; base.Height = value; }
    }
}

void Stretch(Rectangle r)
{
    r.Width = 5;
    r.Height = 4;
    Debug.Assert(r.Area == 20); // fails for a Square: Area is 16
}
```

`Rectangle` carries an unstated invariant: setting the height leaves the width alone. `Square` breaks it, and `Stretch` fails even though it only uses members `Rectangle` declares. The fix is to stop claiming the subtype relationship. Make both implement a read-only `IShape` with an `Area`, or make them immutable so no caller can set one side at a time.

### .NET's Own Example

Arrays in .NET implement `IList<T>`, and `IList<T>` declares `Add`:

```csharp
IList<int> numbers = new int[3];
numbers.Add(4); // throws NotSupportedException: collection was of a fixed size
```

.NET keeps this within the letter of the rules by writing the exception into the base contract. `ICollection<T>.Add` is documented to throw `NotSupportedException` when the collection is read-only, and callers can check `IsReadOnly` first. That makes the substitution legal, but it pushes the check onto every caller of every `IList<T>`, which is the cost LSP exists to avoid. `IReadOnlyList<T>`, added later, is the segregated contract a fixed-size array can honor completely.

To find violations, look for overrides that throw `NotSupportedException` or `NotImplementedException`, overrides that do nothing, and callers that check an object's concrete type before using it.

---

## I: Interface Segregation Principle

**Clients should not be forced to depend on methods they don't use.** Martin arrived at it while consulting for Xerox, whose printer software routed nearly every task, from printing to stapling, through a single `Job` class. Any change to that class touched every task that used it.

### A Fat Interface

```csharp
public interface IMultiFunctionDevice
{
    void Print(Document document);
    void Scan(Document document);
    void Fax(Document document);
}

public class BasicPrinter : IMultiFunctionDevice
{
    public void Print(Document document) { /* ... */ }

    // Forced to implement operations it can't perform
    public void Scan(Document document) => throw new NotSupportedException();
    public void Fax(Document document) => throw new NotSupportedException();
}
```

`BasicPrinter` now violates Liskov substitution as well. And every client of `IMultiFunctionDevice` depends on `Fax`, so a change to the fax signature touches code that only ever prints.

### Interfaces Shaped by Their Clients

```csharp
public interface IPrinter { void Print(Document document); }
public interface IScanner { void Scan(Document document); }
public interface IFax     { void Fax(Document document); }

public class BasicPrinter : IPrinter
{
    public void Print(Document document) { /* ... */ }
}

public class OfficeMachine : IPrinter, IScanner, IFax
{
    public void Print(Document document) { /* ... */ }
    public void Scan(Document document) { /* ... */ }
    public void Fax(Document document) { /* ... */ }
}

public class ReportPrinter
{
    private readonly IPrinter printer;

    public ReportPrinter(IPrinter printer) => this.printer = printer;
}
```

Split interfaces along the lines of what callers use together, not one method per interface. `IPrinter` groups operations that printing clients need, and a client that needs to print and scan can depend on both.

The principle applies at the module level too. Referencing a large library for one helper makes the build depend on everything else in it.

---

## D: Dependency Inversion Principle

Martin's principle has two parts:

1. High-level modules should not depend on low-level modules. Both should depend on abstractions.
2. Abstractions should not depend on details. Details should depend on abstractions.

"High-level" means the policy, the business rules the system exists for. "Low-level" means the mechanisms that carry the policy out, such as email, databases, and file formats.

### The Default Direction

```csharp
// Infrastructure
public class SmtpEmailSender
{
    public void Send(string to, string body) { /* SMTP */ }
}

// Business logic
public class OrderService
{
    private readonly SmtpEmailSender emailSender = new();

    public void PlaceOrder(Order order)
    {
        // ... business rules ...
        emailSender.Send(order.CustomerEmail, "Order placed");
    }
}
```

The business rules can't be compiled, reused, or tested without the SMTP code, and replacing email with SMS means editing `OrderService`.

### Inverting It

```csharp
// Business module: owns the abstraction
public interface INotificationSender
{
    Task SendAsync(string recipient, string message);
}

public class OrderService
{
    private readonly INotificationSender notifications;

    public OrderService(INotificationSender notifications) => this.notifications = notifications;

    public async Task PlaceOrderAsync(Order order)
    {
        // ... business rules ...
        await notifications.SendAsync(order.CustomerEmail, "Order placed");
    }
}

// Infrastructure module: implements it
public class EmailNotificationSender : INotificationSender
{
    public Task SendAsync(string recipient, string message) { /* SMTP */ }
}

public class SmsNotificationSender : INotificationSender
{
    public Task SendAsync(string recipient, string message) { /* SMS gateway */ }
}
```

The inversion is in who owns the interface. `INotificationSender` lives with `OrderService` and is shaped by what the business rules need, so the only dependency crossing the module boundary points from infrastructure up to business logic. If the interface lived in the infrastructure module, the business module would still depend on infrastructure, and nothing would have been inverted.

{% include figure.html id="oop-dependency-inversion" %}

Passing the `INotificationSender` in through the constructor is dependency injection, which is one way to supply the implementation. A factory or a plugin loader would also satisfy the principle, which is about the direction of source dependencies, not about how objects get wired.

Apply DIP at boundaries where the low-level side is volatile or where you need to substitute it, such as external services, storage, and anything slow or nondeterministic in tests. Stable, low-level dependencies like `string`, `List<T>`, or `Math` don't need an abstraction in front of them.

---

## Recognizing Violations

| Principle | Warning sign | Usual fix |
|---|---|---|
| **SRP** | Different teams request changes to the same class; unrelated tests break together | Split by actor |
| **OCP** | A `switch` or `if` chain on a type code, repeated in several places | Replace the type code with an abstraction |
| **LSP** | Overrides that throw `NotSupportedException` or do nothing; callers checking concrete types | Remove the inheritance, or narrow the base contract |
| **ISP** | Implementations stubbing out interface members; clients rebuilt for changes they don't use | Split the interface by client |
| **DIP** | Business logic calling `new` on infrastructure classes; tests needing a real database or mail server | Define the interface in the business module and inject the implementation |

---

## When SOLID Goes Too Far

Each principle adds indirection, and indirection has a price: more types to read, more files to open, and call chains that no longer show what runs.

- **SRP taken to one method per class** produces many small classes whose interactions are harder to follow than the original. Split by actor, not by verb.
- **OCP applied speculatively** adds abstractions for variations that never arrive. Wait until a second or third variation exists.
- **ISP taken to one method per interface** makes every constructor take a long list of narrow dependencies. Group by what clients use together.
- **DIP applied everywhere** puts an interface with a single implementation in front of every class, including ones with no reason to be replaced.

The principles are heuristics for managing change, not rules to satisfy. Code that no one expects to change, like a small script or a stable utility, gains little from them.
