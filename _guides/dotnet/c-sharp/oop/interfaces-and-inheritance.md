---
title: "C# Interfaces and Inheritance"
layout: guide
category: ".NET & C#"
subcategory: "Object-Oriented Programming"
description: "Interfaces, inheritance, polymorphism, and practical guidance on when to use inheritance vs composition, aggregation, and delegation in modern C#."
tags: [c-sharp, dotnet, oop, interfaces, inheritance, polymorphism, design-patterns, practical]
---

## Interfaces

### Why Use Interfaces

Interfaces define contracts that specify what a type can do without dictating how it does it. The primary reason to use an interface is to decouple components from specific implementations so they can depend on behavior rather than concrete types.

Consider a `NotificationService` that needs to send messages. Without an interface, the service must depend directly on a concrete class like `EmailSender`, which means every consumer of that service is locked into email as the delivery mechanism. With an interface like `INotificationSender`, the service depends only on the ability to send a notification. The actual delivery mechanism, whether email, SMS, or push notification, becomes a detail that can change independently.

This decoupling produces several practical benefits:

- **Testability**: Tests can substitute a fake or mock implementation instead of hitting real infrastructure. A test for order processing doesn't need a live SMTP server; it needs to verify that a notification was requested.
- **Swappability**: Switching from one implementation to another (migrating from SendGrid to AWS SES, for example) requires changing only the registered implementation, not every class that sends notifications.
- **Dependency injection**: DI containers wire up applications by mapping interfaces to implementations at startup. Code that depends on `IRepository<Customer>` receives the correct concrete repository without knowing or caring which one.
- **Multiple implementations**: Different contexts can use different implementations of the same contract. A `CachingRepository` and a `SqlRepository` can both satisfy `IRepository<T>`, chosen based on performance requirements or environment.

Interfaces also enable the Dependency Inversion Principle: high-level modules define the abstractions they need, and low-level modules implement them. The interface belongs to the consumer, not the provider. A domain layer defines `IOrderRepository` based on what it needs, and the data access layer provides the implementation.

### The Single-Implementation Argument

A common criticism is that an interface with only one implementation is pointless abstraction. If `IOrderService` exists solely for `OrderService`, the argument goes, you've just created a mirror of your class and called it a contract. The interface name, its methods, and its scope are all coupled to the one class you happen to have right now. A truly well-designed interface would represent a more specific, more reusable slice of behavior rather than a 1:1 shadow of a concrete type.

The Interface Segregation Principle makes this obviously true in theory. An `IOrderService` with ten methods probably bundles unrelated responsibilities, and consumers forced to depend on the full surface area are coupled to behavior they don't need. A caller that only checks order status shouldn't depend on an interface that also exposes fulfillment, cancellation, and refund operations.

In practice, though, you rarely know the right granularity upfront. The first consumer of a service often does need most of its behavior, and splitting the interface into three smaller contracts before a second consumer exists is speculative design. You discover better abstractions as more consumers emerge with different needs. The second caller that only needs read access reveals the `IOrderQuery` interface hiding inside `IOrderService`. The third caller that only needs status checks reveals something even more granular.

Starting with a 1:1 interface still provides concrete value even before that discovery happens. The service remains testable through fakes and mocks, the DI container can manage its lifetime, and consumers are decoupled from the implementation's constructor dependencies and internal details. These benefits exist regardless of whether a second implementation ever materializes.

The pragmatic approach is to start with the interface that represents your current understanding, refine as you learn, and split when real consumers demonstrate different needs. This is especially true for internal code where you control all the callers and can refactor freely. For public APIs and library boundaries, investing more thought upfront in interface granularity is worthwhile because the cost of changing a published contract is much higher.

### Basic Interface Definition

```csharp
public interface IRepository<T> where T : class
{
    T? GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(int id);
}

public interface IEmailService
{
    Task SendAsync(string to, string subject, string body);
    Task SendBulkAsync(IEnumerable<string> recipients, string subject, string body);
}
```

### Implementing Interfaces

```csharp
public class CustomerRepository : IRepository<Customer>
{
    private readonly DbContext context;

    public CustomerRepository(DbContext context)
    {
        this.context = context;
    }

    public Customer? GetById(int id) =>
        context.Customers.Find(id);

    public IEnumerable<Customer> GetAll() =>
        context.Customers.ToList();

    public void Add(Customer entity) =>
        context.Customers.Add(entity);

    public void Update(Customer entity) =>
        context.Customers.Update(entity);

    public void Delete(int id)
    {
        var entity = GetById(id);
        if (entity != null)
            context.Customers.Remove(entity);
    }
}
```

### Multiple Interface Implementation

```csharp
public interface IComparable<T>
{
    int CompareTo(T other);
}

public interface IEquatable<T>
{
    bool Equals(T other);
}

public interface IFormattable
{
    string ToString(string format, IFormatProvider formatProvider);
}

public class Money : IComparable<Money>, IEquatable<Money>, IFormattable
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public int CompareTo(Money? other)
    {
        if (other is null) return 1;
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot compare different currencies");
        return Amount.CompareTo(other.Amount);
    }

    public bool Equals(Money? other) =>
        other is not null &&
        Amount == other.Amount &&
        Currency == other.Currency;

    public string ToString(string? format, IFormatProvider? formatProvider)
    {
        return format switch
        {
            "C" => $"{Currency} {Amount:N2}",
            "S" => $"{Amount:N2}",
            _ => $"{Amount} {Currency}"
        };
    }
}
```

### Explicit Interface Implementation

When two interfaces have conflicting members, or you want to hide interface members from the class's public API.

```csharp
public interface IDrawable
{
    void Draw();
}

public interface IPrintable
{
    void Draw(); // Same name, different meaning
}

public class Document : IDrawable, IPrintable
{
    // Explicit implementation - only accessible through interface
    void IDrawable.Draw()
    {
        Console.WriteLine("Drawing to screen");
    }

    void IPrintable.Draw()
    {
        Console.WriteLine("Drawing to printer");
    }

    // Public method available on the class itself
    public void Display()
    {
        Console.WriteLine("Displaying document");
    }
}

// Usage
var doc = new Document();
doc.Display();           // OK
// doc.Draw();           // Error - not accessible directly

IDrawable drawable = doc;
drawable.Draw();         // "Drawing to screen"

IPrintable printable = doc;
printable.Draw();        // "Drawing to printer"
```

### Default Interface Methods (C# 8.0)

Default interface methods allow you to add method bodies directly to an interface. Existing implementers continue to compile without changes, and the default logic runs unless an implementer explicitly overrides it.

```csharp
public interface ILogger
{
    void Log(string message);

    // Default implementations - implementers don't need to provide these
    void LogWarning(string message) =>
        Log($"WARNING: {message}");

    void LogError(string message) =>
        Log($"ERROR: {message}");

    void LogError(Exception ex) =>
        LogError($"{ex.GetType().Name}: {ex.Message}");
}

public class ConsoleLogger : ILogger
{
    public void Log(string message) =>
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {message}");

    // Can override default implementations when the default isn't sufficient
    public void LogError(string message)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Log($"ERROR: {message}");
        Console.ResetColor();
    }
}
```

Default methods are only accessible through the interface reference, not through the concrete type. The implementing class never declared these methods as part of its own API, so they don't appear on the class.

```csharp
var logger = new ConsoleLogger();
// logger.LogWarning("Careful"); // Compile error - not on ConsoleLogger

ILogger iLogger = logger;
iLogger.LogWarning("Careful");   // Works - accessed through interface
iLogger.LogError("Oops");        // Works - uses ConsoleLogger's override
```

**Be skeptical of this feature.** The stated justification is interface evolution: a library author can add `LogWarning` to `ILogger` without breaking every consumer's build. But that compile error is arguably the better outcome. It forces the implementer to acknowledge the new method and make a conscious decision about how to handle it. A silent default means the new capability exists but nobody opted into it intentionally. Developers don't read release notes thoroughly (or at all), so the default behavior just runs without anyone realizing it's there.

C# already has `[Obsolete]` for deprecation and versioned interfaces for evolution. A compile error on upgrade is a feature, not a problem; it surfaces the change at the exact moment the developer needs to see it. Default interface methods trade that visibility for silent compatibility, which is a questionable tradeoff for most codebases.

The feature exists primarily because the .NET runtime team needed it. When Microsoft adds a method to an interface like `IAsyncDisposable` that millions of classes across the ecosystem implement, a compile break at that scale is genuinely disruptive. That's a real problem, but it's a framework-author problem. For application code, adding a method to an interface and updating the five classes that implement it is straightforward, transparent, and leaves no hidden behavior.

### Static Abstract Members (C# 11)

Regular interface members define what an instance of a type can do: call `repository.GetById(5)` on any `IRepository<T>`. Static abstract members solve a different problem: they define what a type itself must provide, independent of any instance.

The motivating case is generic math. Before C# 11, there was no way to write a generic `Sum<T>` method because there was no way to express "T must have a `+` operator and a zero value" as a constraint. You couldn't call `T.Zero` or use `left + right` inside a generic method because operators and static members aren't part of any interface contract. The only option was to pass in the operations as delegates or helper objects, which made the API awkward.

Static abstract members close this gap by letting an interface require that implementing types provide specific static members, including operators, factory methods, and static properties. The constraint `where T : IAddable<T>` then guarantees that `T.Zero` and `T + T` are available at compile time.

```csharp
public interface IAddable<T> where T : IAddable<T>
{
    static abstract T operator +(T left, T right);
    static abstract T Zero { get; }
}

public readonly struct Fraction : IAddable<Fraction>
{
    public int Numerator { get; }
    public int Denominator { get; }

    public Fraction(int numerator, int denominator)
    {
        Numerator = numerator;
        Denominator = denominator;
    }

    public static Fraction Zero => new(0, 1);

    public static Fraction operator +(Fraction left, Fraction right) =>
        new(
            left.Numerator * right.Denominator + right.Numerator * left.Denominator,
            left.Denominator * right.Denominator);
}

// Now possible: a generic Sum that works with any type that defines + and Zero
public static T Sum<T>(IEnumerable<T> values) where T : IAddable<T>
{
    T result = T.Zero;
    foreach (var value in values)
    {
        result = result + value;
    }
    return result;
}

// Works with Fraction, int, double, or any custom type that implements IAddable<T>
var fractions = new[] { new Fraction(1, 2), new Fraction(1, 3) };
Fraction total = Sum(fractions);
```

The .NET 7+ `System.Numerics` namespace uses this pattern extensively. Interfaces like `INumber<T>`, `IAdditionOperators<TSelf, TOther, TResult>`, and `IParsable<T>` let you write generic algorithms that work across `int`, `double`, `decimal`, and custom numeric types without boxing or runtime type checks.

Beyond math, the same pattern works for factory methods and parsing. An `IParsable<T>` interface with `static abstract T Parse(string s)` lets a generic method create instances of `T` from strings without reflection or activator hacks. The constraint tells the compiler that `T` knows how to construct itself.

```csharp
public interface IFactory<T> where T : IFactory<T>
{
    static abstract T Create();
    static abstract T CreateFrom(string input);
}

// Generic method that creates instances without reflection
public static T BuildAndValidate<T>(string input) where T : IFactory<T>
{
    T instance = T.CreateFrom(input);
    return instance;
}
```

The self-referencing constraint `where T : IInterface<T>` is called the curiously recurring template pattern. It looks unusual, but it's what makes the whole mechanism work: it lets the interface refer to the implementing type in its own member signatures, so `operator +` can return `T` rather than some base type.

## Inheritance

### Basic Inheritance

```csharp
public class Animal
{
    public string Name { get; set; }

    public virtual void Speak()
    {
        Console.WriteLine("Some sound");
    }

    public void Eat()
    {
        Console.WriteLine($"{Name} is eating");
    }
}

public class Dog : Animal
{
    public string Breed { get; set; }

    public override void Speak()
    {
        Console.WriteLine("Woof!");
    }

    public void Fetch()
    {
        Console.WriteLine($"{Name} is fetching");
    }
}

public class Cat : Animal
{
    public override void Speak()
    {
        Console.WriteLine("Meow!");
    }
}
```

### Virtual, Override, and New

```csharp
public class BaseClass
{
    public virtual void VirtualMethod()
    {
        Console.WriteLine("Base virtual");
    }

    public void NonVirtualMethod()
    {
        Console.WriteLine("Base non-virtual");
    }
}

public class DerivedClass : BaseClass
{
    // Override - replaces base implementation polymorphically
    public override void VirtualMethod()
    {
        Console.WriteLine("Derived override");
    }

    // New - hides base member (not polymorphic)
    public new void NonVirtualMethod()
    {
        Console.WriteLine("Derived new");
    }
}

// Demonstration
BaseClass b = new DerivedClass();
b.VirtualMethod();    // "Derived override" (polymorphic)
b.NonVirtualMethod(); // "Base non-virtual" (hidden, not replaced)

DerivedClass d = new DerivedClass();
d.VirtualMethod();    // "Derived override"
d.NonVirtualMethod(); // "Derived new"
```

### Abstract Classes and Methods

```csharp
public abstract class Shape
{
    public string Color { get; set; }

    // Abstract - must be implemented by derived class
    public abstract double Area { get; }
    public abstract double Perimeter { get; }

    // Virtual - can be overridden
    public virtual void Draw()
    {
        Console.WriteLine($"Drawing {Color} shape");
    }

    // Regular - inherited as-is
    public void Describe()
    {
        Console.WriteLine($"{Color} shape: Area={Area:F2}, Perimeter={Perimeter:F2}");
    }
}

public class Rectangle : Shape
{
    public double Width { get; set; }
    public double Height { get; set; }

    public override double Area => Width * Height;
    public override double Perimeter => 2 * (Width + Height);
}

public class Circle : Shape
{
    public double Radius { get; set; }

    public override double Area => Math.PI * Radius * Radius;
    public override double Perimeter => 2 * Math.PI * Radius;

    public override void Draw()
    {
        base.Draw(); // Call base implementation
        Console.WriteLine($"Circle with radius {Radius}");
    }
}
```


## Polymorphism

### Runtime Polymorphism

```csharp
public abstract class PaymentProcessor
{
    public abstract Task<bool> ProcessAsync(decimal amount);
    public abstract decimal CalculateFee(decimal amount);
}

public class CreditCardProcessor : PaymentProcessor
{
    public override async Task<bool> ProcessAsync(decimal amount)
    {
        // Credit card processing logic
        await Task.Delay(100);
        return true;
    }

    public override decimal CalculateFee(decimal amount) =>
        amount * 0.029m + 0.30m; // 2.9% + $0.30
}

public class BankTransferProcessor : PaymentProcessor
{
    public override async Task<bool> ProcessAsync(decimal amount)
    {
        // Bank transfer processing logic
        await Task.Delay(200);
        return true;
    }

    public override decimal CalculateFee(decimal amount) =>
        Math.Min(amount * 0.01m, 5.00m); // 1% max $5
}

// Polymorphic usage
public class PaymentService
{
    public async Task<bool> ProcessPayment(
        PaymentProcessor processor,
        decimal amount)
    {
        decimal fee = processor.CalculateFee(amount);
        decimal total = amount + fee;
        return await processor.ProcessAsync(total);
    }
}
```

### Interface-Based Polymorphism

Prefer interfaces over inheritance for polymorphism.

```csharp
public interface INotificationSender
{
    Task SendAsync(string recipient, string message);
}

public class EmailSender : INotificationSender
{
    public async Task SendAsync(string recipient, string message)
    {
        // Send email
        await Task.CompletedTask;
    }
}

public class SmsSender : INotificationSender
{
    public async Task SendAsync(string recipient, string message)
    {
        // Send SMS
        await Task.CompletedTask;
    }
}

public class PushNotificationSender : INotificationSender
{
    public async Task SendAsync(string recipient, string message)
    {
        // Send push notification
        await Task.CompletedTask;
    }
}

// Polymorphic usage
public class NotificationService
{
    private readonly IEnumerable<INotificationSender> senders;

    public NotificationService(IEnumerable<INotificationSender> senders)
    {
        this.senders = senders;
    }

    public async Task NotifyAllAsync(string recipient, string message)
    {
        var tasks = senders.Select(s => s.SendAsync(recipient, message));
        await Task.WhenAll(tasks);
    }
}
```

## Choosing Between Interfaces and Abstract Classes

Both define contracts, but they serve different purposes.

**Use an interface when**:
- Multiple unrelated types need to share a capability (like `IDisposable`, `IComparable`)
- You want a type to support multiple contracts (a class can implement many interfaces)
- The contract is purely about behavior, not about shared implementation
- You want to enable dependency injection and testability

**Use an abstract class when**:
- Types share both behavior AND implementation
- You need to define state (fields) that derived classes inherit
- You want to provide a partial implementation as a starting point
- The relationship is truly "is-a" (a Dog IS an Animal)

**Why this matters**: Inheritance creates tight coupling. When you inherit from a class, you take on its implementation details and any changes to the base class can break derived classes. Interfaces are pure contracts; implementing `IComparable` doesn't tie you to any specific implementation.

**Common pattern**: Use an interface for the public contract and an abstract class for shared implementation among related types.

```csharp
// Interface for the contract
public interface IPaymentProcessor
{
    Task<PaymentResult> ProcessAsync(Payment payment);
}

// Abstract class for shared implementation among similar processors
public abstract class BasePaymentProcessor : IPaymentProcessor
{
    protected abstract string ProviderName { get; }

    public async Task<PaymentResult> ProcessAsync(Payment payment)
    {
        ValidatePayment(payment); // Shared logic
        return await ProcessWithProviderAsync(payment); // Provider-specific
    }

    protected abstract Task<PaymentResult> ProcessWithProviderAsync(Payment payment);

    protected virtual void ValidatePayment(Payment payment)
    {
        // Shared validation logic
    }
}
```

## Inheritance in Practice

### When Inheritance Works

Inheritance works when the relationship is genuinely hierarchical and behavioral. A `CreditCardProcessor` is a `PaymentProcessor` not just because they share fields, but because they share an operational contract: validate, authorize, capture. The derived class specializes that contract while preserving the behavioral guarantees of the base. Code that processes payments through the base type works correctly regardless of which specific processor it receives.

The Template Method pattern is where inheritance earns its keep. A base class defines the skeleton of an algorithm, and derived classes fill in the steps.

```csharp
public abstract class DataImporter
{
    private readonly IDataStore defaultStore;

    protected DataImporter(IDataStore defaultStore)
    {
        this.defaultStore = defaultStore;
    }

    public async Task ImportAsync(Stream source)
    {
        var raw = await ReadAsync(source);
        var validated = Validate(raw);
        await PersistAsync(validated);
    }

    protected abstract Task<RawData> ReadAsync(Stream source);
    protected abstract ValidatedData Validate(RawData raw);
    protected virtual Task PersistAsync(ValidatedData data) => defaultStore.SaveAsync(data);
}
```

A `CsvImporter` and `JsonImporter` override `ReadAsync` and `Validate` while reusing the orchestration logic. The base class captures the invariant (the order of operations) while derived classes capture the variant (format-specific parsing). This is difficult to replicate cleanly with composition because the relationship between the steps is tightly coupled, and the variation is about how each step executes rather than which collaborator to use.

### When Inheritance Becomes a Liability

**Using inheritance for code reuse alone.** Two types sharing the same three properties doesn't justify an inheritance relationship. A `Customer` and an `Employee` both have `Name`, `Email`, and `Phone`, but a customer is not an employee. Forcing them into a hierarchy like `Person -> Customer` and `Person -> Employee` creates coupling for the sake of avoiding duplicated fields. The moment `Person` needs a change that applies to employees but not customers, the hierarchy fights back.

**Failing the Liskov Substitution test.** Before establishing an inheritance relationship, ask whether the derived type can substitute for the base type in every context without breaking expectations. A `Square` that inherits from `Rectangle` fails this test: code that sets width and height independently on a `Rectangle` produces unexpected results when the object is actually a `Square` that enforces equal sides. The type system says it's valid, but the behavior violates the contract.

```csharp
public class Rectangle
{
    public virtual double Width { get; set; }
    public virtual double Height { get; set; }
    public double Area => Width * Height;
}

public class Square : Rectangle
{
    public override double Width
    {
        get => base.Width;
        set { base.Width = value; base.Height = value; }
    }

    public override double Height
    {
        get => base.Height;
        set { base.Height = value; base.Width = value; }
    }
}

// This method expects Rectangle behavior and breaks with Square
void Resize(Rectangle rect)
{
    rect.Width = 10;
    rect.Height = 5;
    // Expects Area == 50, but Square gives Area == 25
}
```

The Liskov test is practical, not academic. If substitution breaks behavior, the hierarchy is wrong regardless of how natural the "is-a" relationship sounds in English.

**The fragile base class problem.** Deep hierarchies create a specific maintenance burden. Changes to a base class ripple through every descendant in ways that are hard to predict. Consider a base `Collection` with `Add` and `AddRange` methods where `AddRange` calls `Add` in a loop. A derived `CountingCollection` overrides `Add` to increment a counter. This works until someone optimizes the base `AddRange` to batch-insert without calling `Add`, and suddenly the counter is wrong for bulk operations. The derived class was relying on an implementation detail, not a documented guarantee.

Keep hierarchies shallow, typically no more than two or three levels. Each level should represent a meaningful specialization, not just an incremental tweak. If you find yourself creating a chain like `Entity -> NamedEntity -> TimestampedEntity -> AuditableEntity`, you're modeling data reuse as a hierarchy when composition would serve better.

### Data Reuse vs Behavioral Reuse

The distinction between inheriting data and inheriting behavior clarifies many design decisions.

**Data reuse is the shared-fields trap.** Consider `FullTimeEmployee`, `Contractor`, and `Intern` types that all need `Name`, `Email`, `Department`, and `StartDate`. The tempting design is a base `Employee` class with these shared properties. But contractors don't have departments in the same way employees do, interns have end dates but not salary bands, and full-time employees have benefits that the others don't. The base class becomes a dumping ground for "probably shared" fields, and derived classes end up with properties that don't apply or need constant null-checking.

When the shared structure is purely data, records or value objects handle reuse without creating a hierarchy:

```csharp
public record ContactInfo(string Name, string Email, string Phone);

public class Employee
{
    public ContactInfo Contact { get; init; }
    public Department Department { get; init; }
    public BenefitsPackage Benefits { get; init; }
}

public class Contractor
{
    public ContactInfo Contact { get; init; }
    public decimal HourlyRate { get; init; }
    public DateOnly ContractEnd { get; init; }
}
```

Each type includes exactly the data it needs. Shared structure is composed in, not inherited.

**Behavioral reuse is where inheritance provides genuine value.** When derived types need to specialize _how_ something is done rather than just _what data_ is stored, inheritance captures that variation cleanly. The `DataImporter` example above illustrates this: the base class defines the workflow, and derived classes override the format-specific steps. You can't decompose this into separate data objects because the value isn't in shared fields; it's in shared orchestration with specialized steps.

**The heuristic**: if your base class is mostly properties with a few utility methods, composition or records are probably better. If your base class defines an algorithm or workflow that derived classes customize through method overrides, inheritance is working as designed.

## Composition, Aggregation, and Delegation

The advice to "favor composition over inheritance" is useful, but composition itself has different forms with different implications for ownership, lifetime, and coupling.

### Composition: Owned Dependencies

Composition implies ownership. The container creates the dependency and controls its lifetime. When the container is destroyed, so is the part.

```csharp
public class OrderProcessor
{
    private readonly OrderValidator validator = new();
    private readonly PricingCalculator calculator = new();

    public OrderResult Process(Order order)
    {
        validator.Validate(order);
        var total = calculator.CalculateTotal(order);
        return new OrderResult(total);
    }
}
```

The `OrderProcessor` owns its validator and calculator. Nothing else references them, and they exist solely to serve this class. This is appropriate when the collaborator's behavior is an implementation detail that consumers of `OrderProcessor` shouldn't know about or control.

The tradeoff is reduced flexibility. You can't substitute a different validator for testing without changing the class, and the concrete types are hardwired. Use composition when the dependency is a genuine implementation detail and the specific behavior shouldn't vary.

### Aggregation: Injected Dependencies

Aggregation implies usage without ownership. The container receives a dependency but doesn't control its lifetime. The dependency exists independently and may be shared across multiple consumers.

```csharp
public class OrderProcessor
{
    private readonly IOrderValidator validator;
    private readonly IPricingCalculator calculator;

    public OrderProcessor(IOrderValidator validator, IPricingCalculator calculator)
    {
        this.validator = validator;
        this.calculator = calculator;
    }

    public OrderResult Process(Order order)
    {
        validator.Validate(order);
        var total = calculator.CalculateTotal(order);
        return new OrderResult(total);
    }
}
```

This is the pattern you see with dependency injection. The DI container manages lifetimes, and classes receive references to collaborators they don't own. The `OrderProcessor` uses a validator and a calculator, but it doesn't create them, configure them, or dispose of them.

Aggregation enables testability (substitute a mock), swappability (register a different implementation), and separation of concerns (each collaborator is independently configurable). Most service-layer classes in a well-structured application use aggregation through constructor injection.

### Delegation and the Decorator Pattern

Delegation bridges the gap between inheritance and composition. When you need to present the same interface as another type without inheriting from it, a wrapper forwards calls to an inner object and adds behavior before or after each call.

```csharp
public class CachingRepository<T> : IRepository<T> where T : class
{
    private readonly IRepository<T> inner;
    private readonly IMemoryCache cache;

    public CachingRepository(IRepository<T> inner, IMemoryCache cache)
    {
        this.inner = inner;
        this.cache = cache;
    }

    public T? GetById(int id)
    {
        var key = $"{typeof(T).Name}:{id}";
        return cache.GetOrCreate(key, _ => inner.GetById(id));
    }

    public void Add(T entity)
    {
        inner.Add(entity);
        // Invalidate relevant cache entries
    }

    // Forward remaining IRepository<T> methods to inner...
}
```

The `CachingRepository` satisfies `IRepository<T>` by wrapping another implementation and adding caching. Contrast this with a `CachingRepository : Repository<T>` that overrides methods: the inheritance version is coupled to the base class's internal behavior and can break when the base changes. The delegation version depends only on the interface contract.

Delegation costs more code than inheritance because you manually forward each method. The benefit is isolation: changes to the inner repository's implementation can't silently break the wrapper's behavior.

### Choosing Between the Approaches

| Concern | Inheritance | Composition | Aggregation |
|---|---|---|---|
| Code reuse | High (automatic) | Low (manual forwarding) | Low (manual forwarding) |
| Coupling | Tight (to base class internals) | Medium (to concrete types) | Low (to interfaces) |
| Flexibility | Low (single base class) | Medium (can swap internal parts) | High (swap at runtime/config) |
| Testability | Hard (base class behavior included) | Medium (internal dependencies hidden) | Easy (inject mocks) |
| When to use | Behavioral specialization with shared workflow | Implementation details that shouldn't vary | Collaborators that should be configurable |

## Extending Types Without Creating Dependencies

Sometimes the question isn't whether to inherit or compose, but how to add capability to an existing type without creating a dependency between types that don't need to know about each other.

### Extension Methods

Extension methods add behavior without modifying the type. When an operation logically applies to a type but doesn't need access to private state, an extension method keeps the type clean while making the operation discoverable.

```csharp
public static class EnumerableExtensions
{
    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> source) where T : class =>
        source.Where(item => item is not null)!;

    public static IEnumerable<IEnumerable<T>> Batch<T>(this IEnumerable<T> source, int size) =>
        source.Select((item, index) => new { item, index })
              .GroupBy(x => x.index / size)
              .Select(g => g.Select(x => x.item));
}
```

Extension methods can't access private members, can't be overridden polymorphically, and can create confusion about where behavior lives when overused. They work best for utility operations that genuinely extend a type's surface area without changing its identity.

### Interface Composition

Rather than building a deep hierarchy to share capabilities across types, you can define fine-grained interfaces and let types opt into the ones they need.

```csharp
public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    string CreatedBy { get; set; }
    DateTime? ModifiedAt { get; set; }
    string? ModifiedBy { get; set; }
}

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}

public class Order : IAuditable, ISoftDeletable
{
    public int Id { get; set; }
    public decimal Total { get; set; }

    // IAuditable
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; }
    public DateTime? ModifiedAt { get; set; }
    public string? ModifiedBy { get; set; }

    // ISoftDeletable
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
```

The alternative inheritance approach would require `Order` to extend `AuditableEntity` and somehow also include soft-delete behavior, likely through a chain like `AuditableEntity -> SoftDeletableEntity -> Order`. That hierarchy forces every auditable entity to also be soft-deletable (or vice versa), and it locks the order into a specific inheritance chain that can't accommodate future cross-cutting concerns.

With interfaces, each type opts into exactly the capabilities it needs. Generic infrastructure code like an EF Core `SaveChangesInterceptor` can operate on any `IAuditable` entity regardless of its concrete type or inheritance chain. The tradeoff is boilerplate: each implementing class declares the interface properties rather than inheriting them from a base. But the flexibility gain is significant because a type can implement any combination of interfaces without being locked into a specific hierarchy.

## Key Takeaways

**Program to interfaces, not implementations**: Define behavior through interfaces and inject dependencies. This decouples consumers from concrete types and enables testing, swappability, and independent evolution.

**Distinguish data reuse from behavioral reuse**: Shared fields don't justify inheritance. Use composition or records for shared data structures, and reserve inheritance for shared workflows with specialized steps.

**Apply the Liskov Substitution test**: Before creating an inheritance relationship, verify that the derived type can replace the base type in every context without violating expectations. If substitution breaks behavior, the hierarchy is wrong.

**Choose the right form of composition**: Use composition (owned dependencies) for implementation details, aggregation (injected dependencies) for configurable collaborators, and delegation for adding behavior to existing contracts without inheritance.

**Keep hierarchies shallow**: Deep inheritance chains create fragile coupling to base class internals. Two or three levels of meaningful specialization beats long chains of incremental additions.

**Extend through interfaces, not inheritance chains**: Fine-grained interfaces let types opt into capabilities independently. This avoids the rigidity of single-inheritance hierarchies for cross-cutting concerns like auditing or soft deletion.
