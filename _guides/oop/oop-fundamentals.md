---
title: "OOP Fundamentals"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "What objects are and what the four pillars of object-oriented programming buy you: encapsulation to protect invariants, abstraction to hide how behind what, inheritance to specialize, and polymorphism to treat many types through one interface. Covers the anemic domain model and when OOP fits better or worse than functional or procedural code, with C# examples."
tags: [encapsulation, abstraction, inheritance, polymorphism, anemic-domain-model, fundamentals]
---

## Objects Bundle State With Behavior

A class is a template, and an object is one instance of it with its own copy of the data the class declares. What makes this object-oriented rather than just a record with fields is that the class also declares the operations allowed on that data, and the object carries both around together. A bank account object holds a balance and knows how to accept a deposit. Code outside it asks the account to change rather than changing the balance itself.

That pairing is the whole idea. The four pillars below are four consequences of it: who may touch the state (encapsulation), what a caller needs to know (abstraction), how one class can specialize another (inheritance), and how one call can run different code depending on the object behind it (polymorphism).

---

## Encapsulation

Encapsulation keeps an object's state private and exposes only operations that keep that state valid. The rules that must always hold for an object, such as "the balance is never negative", are its **invariants**. If every change goes through a method that checks them, no caller can break them, and a bug that violates one can only live inside the class.

### Protecting Invariants

```csharp
public class BankAccount
{
    private decimal balance;
    private readonly List<Transaction> transactions = new();

    public string AccountNumber { get; }
    public decimal Balance => balance; // readable, not writable

    public BankAccount(string accountNumber, decimal initialBalance)
    {
        if (initialBalance < 0)
            throw new ArgumentException("Initial balance cannot be negative");

        AccountNumber = accountNumber;
        balance = initialBalance;
    }

    public void Deposit(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Deposit amount must be positive");

        balance += amount;
        transactions.Add(new Transaction(TransactionType.Deposit, amount));
    }

    public bool Withdraw(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Withdrawal amount must be positive");

        if (amount > balance)
            return false; // insufficient funds

        balance -= amount;
        transactions.Add(new Transaction(TransactionType.Withdrawal, amount));
        return true;
    }

    public IReadOnlyList<Transaction> GetRecentTransactions(int count) =>
        transactions.TakeLast(count).ToList();
}
```

Nothing outside `BankAccount` can set the balance directly, so the non-negative rule holds everywhere at once. The transaction history also stays consistent with the balance, because the only two methods that change one change the other.

### Handing Out a Collection Gives Away the Invariant

A public property that returns a mutable collection breaks encapsulation even when the property has no setter. The caller gets the list itself and can change it behind the owner's back.

```csharp
// Leaks: any caller can add, remove, or clear orders
public class Customer
{
    public List<Order> Orders { get; } = new();
}

public class OrderProcessor
{
    public void Process(Customer customer)
    {
        customer.Orders.RemoveAll(o => o.IsCancelled);
    }
}

// Encapsulated: the customer decides how its orders change
public class Customer
{
    private readonly List<Order> orders = new();

    public IReadOnlyList<Order> Orders => orders;

    public void RemoveCancelledOrders() => orders.RemoveAll(o => o.IsCancelled);
}
```

Returning the list as `IReadOnlyList<T>` stops callers from modifying it through that reference. A caller could still cast it back to `List<T>`, so when that matters, return a copy or wrap it with `AsReadOnly()`.

### The Anemic Domain Model

A class with only public getters and setters, whose rules live in some other service class, is encapsulated in name only. This is the anemic domain model. Every caller has to remember to call the right validation first, and nothing stops one that forgets.

```csharp
// Anemic: data with no behavior; any caller can set Total to anything
public class Order
{
    public int Id { get; set; }
    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; }
}

// Encapsulated: Total can't disagree with Items, because it is computed from them
public class Order
{
    private readonly List<OrderItem> items = new();

    public int Id { get; }
    public decimal Total => items.Sum(i => i.Subtotal);
    public IReadOnlyList<OrderItem> Items => items;

    public Order(int id) => Id = id;

    public void AddItem(OrderItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        items.Add(item);
    }
}
```

Plain data classes are the right choice when an object's job is to carry data across a boundary, such as a request body or a message. Those data transfer objects (DTOs) have no invariants of their own to protect. The anemic model is a problem only when the class represents something with rules.

---

## Abstraction

Abstraction exposes what an object does and hides how it does it. The caller works against a small contract and doesn't depend on the details behind it, so those details can change or be replaced without touching the caller.

### Interfaces Define What, Implementations Define How

In C#, an interface or an abstract class is the usual way to state the contract.

```csharp
public interface IPaymentProcessor
{
    Task<PaymentResult> ProcessPaymentAsync(decimal amount);
    Task<bool> RefundPaymentAsync(string transactionId);
}

public class StripePaymentProcessor : IPaymentProcessor
{
    private readonly string apiKey;

    public StripePaymentProcessor(string apiKey) => this.apiKey = apiKey;

    public async Task<PaymentResult> ProcessPaymentAsync(decimal amount)
    {
        // Provider-specific calls, retries, and error mapping stay in here
        var charge = await CreateChargeAsync(amount);
        return new PaymentResult(Success: true, TransactionId: charge.Id);
    }

    public async Task<bool> RefundPaymentAsync(string transactionId)
    {
        await IssueRefundAsync(transactionId);
        return true;
    }

    private Task<Charge> CreateChargeAsync(decimal amount) { /* ... */ }
    private Task IssueRefundAsync(string transactionId) { /* ... */ }
}

public class OrderService
{
    private readonly IPaymentProcessor paymentProcessor;

    public OrderService(IPaymentProcessor paymentProcessor) =>
        this.paymentProcessor = paymentProcessor;

    public async Task CompleteOrderAsync(Order order)
    {
        var result = await paymentProcessor.ProcessPaymentAsync(order.Total);
        if (result.Success)
            order.MarkAsPaid(result.TransactionId);
    }
}
```

`OrderService` knows nothing about Stripe. Switching providers means writing another `IPaymentProcessor`, and `OrderService` doesn't change.

### Abstraction and Encapsulation Answer Different Questions

The two pillars are easy to blur because both involve hiding something. Abstraction decides what a caller needs to see, and it is a design decision about the contract. Encapsulation enforces that the caller can't reach past the contract to the state, and it is a mechanism of access control. `IPaymentProcessor` is an abstraction. `BankAccount`'s private balance is encapsulation. A class can be well encapsulated behind a poor abstraction (a public method for every internal step), or offer a clean abstraction while leaking its state through a public mutable field.

---

## Inheritance

Inheritance creates a new class from an existing one. The derived class gets the base class's members and can add new ones or replace the behavior of those marked `virtual` or `abstract`. It models an "is-a" relationship: an hourly employee is an employee.

```csharp
public abstract class Employee
{
    public string Name { get; init; } = "";
    public string EmployeeId { get; init; } = "";
    public decimal AnnualSalary { get; init; }

    // Derived classes may replace this
    public virtual decimal CalculateMonthlyPay() => AnnualSalary / 12;

    // Derived classes must supply this
    public abstract string EmployeeType { get; }

    public string Describe() =>
        $"{EmployeeType}: {Name} ({EmployeeId}), monthly pay {CalculateMonthlyPay():C}";
}

public class SalariedEmployee : Employee
{
    public override string EmployeeType => "Salaried";
}

public class HourlyEmployee : Employee
{
    public decimal HourlyRate { get; init; }
    public int HoursWorked { get; init; }

    public override decimal CalculateMonthlyPay() => HourlyRate * HoursWorked;
    public override string EmployeeType => "Hourly";
}

public class CommissionEmployee : Employee
{
    public decimal CommissionRate { get; init; }
    public decimal Sales { get; init; }

    // Extends the base calculation instead of replacing it
    public override decimal CalculateMonthlyPay() =>
        base.CalculateMonthlyPay() + Sales * CommissionRate;

    public override string EmployeeType => "Commission";
}
```

`Describe` is written once in the base class and produces the right answer for every subclass, because it calls the overridden members.

Inheritance is one of the tightest forms of coupling a language offers. A derived class depends on the base class's internals as well as its public surface, so a change to the base can break subclasses that were never edited. Two tests keep it safe. The derived type must be usable anywhere the base type is expected without surprising the caller, which is the Liskov Substitution Principle. And the relationship must be about behavior, not just shared fields. When the goal is only to reuse code, holding a reference to another object and delegating to it (composition) usually costs less.

---

## Polymorphism

Polymorphism lets one piece of code work with objects of different types through a shared interface. The call is written once, and which implementation runs depends on the object it is made on.

### Subtype Polymorphism Chooses the Method at Runtime

```csharp
public interface IShape
{
    double Area();
    string Describe();
}

public record Circle(double Radius) : IShape
{
    public double Area() => Math.PI * Radius * Radius;
    public string Describe() => $"circle, radius {Radius}";
}

public record Rectangle(double Width, double Height) : IShape
{
    public double Area() => Width * Height;
    public string Describe() => $"rectangle {Width}x{Height}";
}

public record Triangle(double Base, double Height) : IShape
{
    public double Area() => 0.5 * Base * Height;
    public string Describe() => $"triangle, base {Base}, height {Height}";
}

IShape[] shapes = [new Circle(5), new Rectangle(10, 20), new Triangle(8, 6)];

foreach (var shape in shapes)
    Console.WriteLine($"{shape.Describe()}: {shape.Area():F2}");

Console.WriteLine($"Total: {shapes.Sum(s => s.Area()):F2}");
```

The loop never checks which kind of shape it holds. The runtime looks up the actual object's `Area` at the moment of the call, which is called dynamic dispatch. Adding a `Hexagon` means writing one new class, and the loop keeps working unchanged. Without polymorphism, the same loop would need a `switch` on the shape's type, and every new shape would mean finding and editing every such `switch`.

### Overloading and Generics Choose at Compile Time

Two other mechanisms are also called polymorphism, and the compiler resolves both rather than the runtime:

| Kind | Mechanism | Resolved | Example |
|---|---|---|---|
| **Subtype** | Virtual methods, interfaces | At runtime, by the object's actual type | `shape.Area()` |
| **Ad hoc** | Method overloading | At compile time, by the argument types | `Math.Abs(int)` vs `Math.Abs(double)` |
| **Parametric** | Generics | At compile time, one definition for any type argument | `List<T>` |

When object-oriented design talks about polymorphism without qualification, it means subtype polymorphism.

---

## When Each Pillar Earns Its Place

| Pillar | Use it when | Skip it when |
|---|---|---|
| **Encapsulation** | The object has rules its state must obey | The class only carries data across a boundary (a DTO) |
| **Abstraction** | Callers shouldn't depend on a detail that may change, or there are several implementations | There is one implementation and no reason to expect another |
| **Inheritance** | A true "is-a" relationship where the subtype can stand in for the base everywhere | The goal is only code reuse |
| **Polymorphism** | A family of types shares an operation that each performs differently | Only one concrete type exists |

---

## When OOP Fits and When It Doesn't

Object-oriented design pays off when a program is built around long-lived things that have identity, state, and rules, such as orders, accounts, devices, or UI controls, and when a family of variants shares one interface. It is a weaker fit for code that transforms data from one shape to another without keeping state, where a pipeline of functions says the same thing with less ceremony. It also fits short linear scripts poorly, where a sequence of procedure calls is easier to follow than a set of collaborating classes.

C# supports both styles, and most codebases mix them. Entities with rules are objects, and the queries over collections of them are functional:

```csharp
// Object: owns its rules
public class Order
{
    private readonly List<OrderItem> items = new();

    public DateTime CreatedAt { get; }
    public decimal Total => items.Sum(i => i.Subtotal);

    public Order(DateTime createdAt) => CreatedAt = createdAt;
    public void AddItem(OrderItem item) => items.Add(item);
}

// Functions: stateless transformations over many orders
public static class OrderQueries
{
    public static IEnumerable<Order> CreatedBetween(this IEnumerable<Order> orders, DateTime start, DateTime end) =>
        orders.Where(o => o.CreatedAt >= start && o.CreatedAt <= end);

    public static decimal Revenue(this IEnumerable<Order> orders) =>
        orders.Sum(o => o.Total);
}

var revenue = orders.CreatedBetween(startDate, endDate).Revenue();
```
