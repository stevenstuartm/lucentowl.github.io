---
title: "OOP Fundamentals"
layout: guide
category: Programming Patterns
subcategory: OOP Foundations
description: "Master the four pillars of object-oriented programming: abstraction, encapsulation, inheritance, and polymorphism with practical C# examples and modern best practices."
tags: [oop, fundamentals, encapsulation, inheritance, polymorphism, practical]
---

---

## Core OOP Pillars

### Abstraction

**Definition**: Hide complex implementation details while exposing a simple, clear interface.

<div class="callout callout--note">
<p class="callout__title">Key Principles of Abstraction</p>
<ul>
<li>Focus on what an object does rather than how it does it</li>
<li>Define contracts through interfaces and abstract classes</li>
<li>Reduce complexity by hiding unnecessary details</li>
</ul>
</div>

**Example**:
```csharp
// Abstract interface - defines what, not how
public interface IPaymentProcessor
{
    Task<PaymentResult> ProcessPayment(decimal amount);
    Task<bool> RefundPayment(string transactionId);
}

// Concrete implementation - defines how
public class StripePaymentProcessor : IPaymentProcessor
{
    private readonly string apiKey;

    public StripePaymentProcessor(string apiKey)
    {
        this.apiKey = apiKey;
    }

    public async Task<PaymentResult> ProcessPayment(decimal amount)
    {
        // Complex Stripe API logic hidden from caller
        var charge = await CreateStripeCharge(amount, apiKey);
        return new PaymentResult { Success = true, TransactionId = charge.Id };
    }

    public async Task<bool> RefundPayment(string transactionId)
    {
        // Complex refund logic abstracted away
        await ProcessStripeRefund(transactionId);
        return true;
    }

    private async Task<StripeCharge> CreateStripeCharge(decimal amount, string key) { /* ... */ }
    private async Task ProcessStripeRefund(string id) { /* ... */ }
}

// Consumer doesn't need to know implementation details
public class OrderService
{
    private readonly IPaymentProcessor paymentProcessor;

    public OrderService(IPaymentProcessor paymentProcessor)
    {
        this.paymentProcessor = paymentProcessor;
    }

    public async Task CompleteOrder(Order order)
    {
        // Simple interface - complexity is abstracted
        var result = await paymentProcessor.ProcessPayment(order.Total);
        if (result.Success)
        {
            order.MarkAsPaid(result.TransactionId);
        }
    }
}
```

### Encapsulation

**Definition**: Bundle data and methods that operate on that data within a single unit, controlling access through visibility modifiers.

<div class="callout callout--note">
<p class="callout__title">Key Principles of Encapsulation</p>
<ul>
<li>Keep internal state private</li>
<li>Expose behavior through public methods</li>
<li>Use properties for controlled access to data</li>
<li>Protect object invariants</li>
</ul>
</div>

**Example**:
```csharp
public class BankAccount
{
    // Private fields - internal state is hidden
    private decimal balance;
    private readonly List<Transaction> transactions = new();

    // Public property with controlled access
    public string AccountNumber { get; }
    public decimal Balance => balance; // Read-only access

    public BankAccount(string accountNumber, decimal initialBalance)
    {
        if (initialBalance < 0)
            throw new ArgumentException("Initial balance cannot be negative");

        AccountNumber = accountNumber;
        balance = initialBalance;
    }

    // Public methods control how state can be modified
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
            return false; // Insufficient funds

        balance -= amount;
        transactions.Add(new Transaction(TransactionType.Withdrawal, amount));
        return true;
    }

    // Encapsulated business logic
    public IReadOnlyList<Transaction> GetRecentTransactions(int count)
    {
        return transactions.TakeLast(count).ToList().AsReadOnly();
    }
}
```

### Inheritance

**Definition**: Create new classes based on existing classes, establishing "is-a" relationships and enabling code reuse.

<div class="callout callout--warning">
<p class="callout__title">Key Principles of Inheritance</p>
<ul>
<li>Use inheritance for true "is-a" relationships</li>
<li>Prefer composition over inheritance when possible</li>
<li>Follow the Liskov Substitution Principle</li>
<li>Avoid deep inheritance hierarchies (3+ levels)</li>
</ul>
</div>

**Example**:
```csharp
// Base class with common functionality
public abstract class Employee
{
    public string Name { get; set; }
    public string EmployeeId { get; set; }
    public decimal BaseSalary { get; set; }

    // Virtual method can be overridden
    public virtual decimal CalculateMonthlyPay()
    {
        return BaseSalary / 12;
    }

    // Abstract method must be implemented
    public abstract string GetEmployeeType();

    public void DisplayInfo()
    {
        Console.WriteLine($"{GetEmployeeType()}: {Name} ({EmployeeId})");
        Console.WriteLine($"Monthly Pay: ${CalculateMonthlyPay():F2}");
    }
}

// Derived class - SalariedEmployee "is-an" Employee
public class SalariedEmployee : Employee
{
    public override string GetEmployeeType() => "Salaried Employee";
}

// Derived class with additional behavior
public class HourlyEmployee : Employee
{
    public decimal HourlyRate { get; set; }
    public int HoursWorked { get; set; }

    // Override to change behavior
    public override decimal CalculateMonthlyPay()
    {
        return HourlyRate * HoursWorked;
    }

    public override string GetEmployeeType() => "Hourly Employee";
}

// Derived class with bonus structure
public class CommissionEmployee : Employee
{
    public decimal CommissionRate { get; set; }
    public decimal Sales { get; set; }

    public override decimal CalculateMonthlyPay()
    {
        return base.CalculateMonthlyPay() + (Sales * CommissionRate);
    }

    public override string GetEmployeeType() => "Commission Employee";
}
```

**Modern Alternative: Composition Over Inheritance**
```csharp
// Interface defines capability
public interface IPayCalculator
{
    decimal CalculatePay();
}

// Different calculation strategies
public class SalaryCalculator : IPayCalculator
{
    private readonly decimal annualSalary;

    public SalaryCalculator(decimal annualSalary)
    {
        this.annualSalary = annualSalary;
    }

    public decimal CalculatePay() => annualSalary / 12;
}

public class HourlyCalculator : IPayCalculator
{
    private readonly decimal hourlyRate;
    private readonly int hoursWorked;

    public HourlyCalculator(decimal hourlyRate, int hoursWorked)
    {
        this.hourlyRate = hourlyRate;
        this.hoursWorked = hoursWorked;
    }

    public decimal CalculatePay() => hourlyRate * hoursWorked;
}

// Employee uses composition instead of inheritance
public class ModernEmployee
{
    public string Name { get; set; }
    public string EmployeeId { get; set; }

    // Composition - has-a relationship
    private readonly IPayCalculator payCalculator;

    public ModernEmployee(string name, string employeeId, IPayCalculator payCalculator)
    {
        Name = name;
        EmployeeId = employeeId;
        this.payCalculator = payCalculator;
    }

    public decimal GetMonthlyPay() => payCalculator.CalculatePay();
}
```

### Polymorphism

**Definition**: Objects of different types can be treated as instances of the same type, with behavior determined at runtime.

<div class="callout callout--note">
<p class="callout__title">Key Principles of Polymorphism</p>
<ul>
<li>Enable flexible, extensible code</li>
<li>Support method overriding (runtime polymorphism)</li>
<li>Support method overloading (compile-time polymorphism)</li>
<li>Work with abstractions, not concrete types</li>
</ul>
</div>

**Runtime Polymorphism Example**:
```csharp
public interface IShape
{
    double CalculateArea();
    void Draw();
}

public class Circle : IShape
{
    public double Radius { get; set; }

    public double CalculateArea() => Math.PI * Radius * Radius;

    public void Draw() => Console.WriteLine($"Drawing circle with radius {Radius}");
}

public class Rectangle : IShape
{
    public double Width { get; set; }
    public double Height { get; set; }

    public double CalculateArea() => Width * Height;

    public void Draw() => Console.WriteLine($"Drawing rectangle {Width}x{Height}");
}

public class Triangle : IShape
{
    public double Base { get; set; }
    public double Height { get; set; }

    public double CalculateArea() => 0.5 * Base * Height;

    public void Draw() => Console.WriteLine($"Drawing triangle with base {Base} and height {Height}");
}

// Polymorphic usage - treat all shapes uniformly
public class ShapeProcessor
{
    public void ProcessShapes(IEnumerable<IShape> shapes)
    {
        foreach (var shape in shapes)
        {
            // Polymorphism - actual method called depends on runtime type
            shape.Draw();
            Console.WriteLine($"Area: {shape.CalculateArea():F2}\n");
        }
    }

    public double CalculateTotalArea(IEnumerable<IShape> shapes)
    {
        return shapes.Sum(s => s.CalculateArea());
    }
}

// Usage
var shapes = new List<IShape>
{
    new Circle { Radius = 5 },
    new Rectangle { Width = 10, Height = 20 },
    new Triangle { Base = 8, Height = 6 }
};

var processor = new ShapeProcessor();
processor.ProcessShapes(shapes);
Console.WriteLine($"Total area: {processor.CalculateTotalArea(shapes):F2}");
```

## Advanced OOP Concepts

### Covariance

**Definition**: Use a more derived type than originally specified (out parameters, return types).

```csharp
// Covariance with IEnumerable<out T>
IEnumerable<string> strings = new List<string> { "hello", "world" };
IEnumerable<object> objects = strings; // Valid - string is derived from object

// Covariance with delegates
Func<string> funcString = () => "Hello";
Func<object> funcObject = funcString; // Valid - returns more specific type
```

### Contravariance

**Definition**: Use a more generic type than originally specified (in parameters).

```csharp
// Contravariance with Action<in T>
Action<object> actionObject = (obj) => Console.WriteLine(obj);
Action<string> actionString = actionObject; // Valid - can accept more general parameter

// Contravariance with comparison
IComparer<object> objectComparer = Comparer<object>.Default;
IComparer<string> stringComparer = objectComparer; // Valid with contravariant interface
```

### Invariance

**Definition**: Use only the originally specified type (mutable collections).

```csharp
// Invariance with List<T>
List<string> strings = new List<string>();
// List<object> objects = strings; // ERROR - List is invariant

// Why? Because we could add any object to the list, breaking type safety
// objects.Add(new Employee()); // Would add Employee to List<string>!
```

## Quick Reference

### When to Use Each Pillar

| Pillar | Use When | Avoid When |
|--------|----------|------------|
| **Abstraction** | Hiding complex implementation, defining contracts | Simple, straightforward code |
| **Encapsulation** | Protecting internal state, enforcing invariants | Data transfer objects (DTOs) |
| **Inheritance** | True "is-a" relationships, minimal hierarchy | Code reuse alone (use composition) |
| **Polymorphism** | Working with families of related types | Single concrete implementation |

### Common Anti-Patterns

**Anemic Domain Model**:
```csharp
// BAD - Data without behavior
public class Order
{
    public int Id { get; set; }
    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; }
}

// GOOD - Encapsulated behavior
public class Order
{
    private readonly List<OrderItem> items = new();
    public int Id { get; }
    public decimal Total => items.Sum(i => i.Subtotal);
    public IReadOnlyList<OrderItem> Items => items.AsReadOnly();

    public void AddItem(OrderItem item)
    {
        if (item == null)
            throw new ArgumentNullException(nameof(item));
        items.Add(item);
    }
}
```

**Inappropriate Intimacy**:
```csharp
// BAD - Classes too tightly coupled
public class Customer
{
    public List<Order> Orders { get; set; }
}

public class OrderProcessor
{
    public void Process(Customer customer)
    {
        // Direct manipulation of internal collections
        customer.Orders.RemoveAll(o => o.IsCancelled);
    }
}

// GOOD - Proper encapsulation
public class Customer
{
    private readonly List<Order> orders = new();

    public void RemoveCancelledOrders()
    {
        orders.RemoveAll(o => o.IsCancelled);
    }
}
```

---
