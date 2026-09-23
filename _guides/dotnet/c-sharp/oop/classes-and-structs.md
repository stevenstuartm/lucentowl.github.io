---
title: "C# Classes and Structs"
layout: guide
category: ".NET & C#"
subcategory: "Object-Oriented Programming"
description: "Declaring classes, structs, and records in C#: constructors and primary constructors, struct initialization and copy pitfalls, readonly and ref structs, choosing between a struct and a class, where records fit and where they add friction, and when sealed, abstract, partial, static, and nested types earn their place."
tags: [classes, structs, records, primary-constructors, ref-struct, oop, practical]
---

## Classes

A class is a reference type. Creating one allocates an object on the managed heap, and every variable of the class type holds a reference to that object, so assigning or passing it shares the same instance rather than copying it.

### Basic Class Structure

```csharp
public class Customer
{
    // Fields (members are private by default)
    private readonly int id;
    private string name;

    // Constructor
    public Customer(int id, string name)
    {
        this.id = id;
        this.name = name ?? throw new ArgumentNullException(nameof(name));
    }

    // Properties
    public int Id => id;

    public string Name
    {
        get => name;
        set => name = value ?? throw new ArgumentNullException(nameof(value));
    }

    // Methods
    public void DisplayInfo()
    {
        Console.WriteLine($"Customer {Id}: {Name}");
    }
}
```

### Constructors and Overloading

Constructors can be overloaded to support different ways of creating an instance. Use `: this(...)` to chain one constructor to another and keep the initialization logic in one place.

```csharp
public class Order
{
    public int Id { get; }
    public DateTime CreatedAt { get; }
    public string CustomerName { get; set; }
    public OrderStatus Status { get; private set; }

    // Parameterless constructor - sets defaults
    public Order()
    {
        CreatedAt = DateTime.UtcNow;
        Status = OrderStatus.Pending;
        CustomerName = "Unknown";
    }

    // Accepts id and customer name, chains to the parameterless constructor
    public Order(int id, string customerName) : this()
    {
        Id = id;
        CustomerName = customerName;
    }

    // Accepts only id, chains to the two-parameter constructor
    public Order(int id) : this(id, "Unknown")
    {
    }

    // Static constructor - runs once per type, before the first instance
    // is created or any static member is accessed
    static Order()
    {
        Console.WriteLine("Order type initialized");
    }
}

var defaultOrder = new Order();
var namedOrder = new Order(1, "Alice");
var idOnlyOrder = new Order(2);
```

### Primary Constructors (C# 12)

A primary constructor declares its parameters on the type itself, and those parameters are in scope throughout the class body.

```csharp
// Traditional approach with overloaded constructors
public class Product
{
    private readonly string name;
    private readonly decimal price;
    private readonly string category;

    public Product(string name, decimal price) : this(name, price, "General") { }

    public Product(string name, decimal price, string category)
    {
        this.name = name;
        this.price = price;
        this.category = category;
    }

    public string Name => name;
    public decimal Price => price;
    public string Category => category;
}

// The same type with a primary constructor
public class Product(string name, decimal price, string category = "General")
{
    public string Name => name;
    public decimal Price => price;
    public string Category => category;

    public decimal CalculateDiscount(decimal percentage) =>
        price * (1 - percentage);
}

// Usage is identical for both
var widget = new Product("Widget", 9.99m);
var bolt = new Product("Bolt", 1.50m, "Hardware");
```

Primary constructors are especially common for dependency injection, where a service accepts its dependencies through a single constructor.

```csharp
public class OrderProcessor(ILogger<OrderProcessor> logger, IEmailService emailService)
{
    public async Task ProcessAsync(Order order)
    {
        logger.LogInformation("Processing order {Id}", order.Id);
        await emailService.SendConfirmationAsync(order);
    }
}
```

**Watch out for mutability.** A parameter used only to initialize a field or property is not stored. A parameter referenced from a method or property body is captured into a hidden field so it survives past construction, and that hidden field is mutable. There is no way to mark a primary constructor parameter `readonly`, so any member of the class can reassign it:

```csharp
public class OrderProcessor(ILogger<OrderProcessor> logger)
{
    public void DoWork(ILogger<OrderProcessor> other)
    {
        logger.LogInformation("Working...");
        logger = other;   // compiles with no warning
    }
}
```

For a service where the dependencies must not change, assign the parameters to `private readonly` fields:

```csharp
public class OrderProcessor(ILogger<OrderProcessor> logger, IEmailService emailService)
{
    private readonly ILogger<OrderProcessor> _logger = logger;
    private readonly IEmailService _emailService = emailService;

    public async Task ProcessAsync(Order order)
    {
        _logger.LogInformation("Processing order {Id}", order.Id);
        await _emailService.SendConfirmationAsync(order);
    }
}
```

The parameter stays in scope for the whole class even after you copy it, so a method can still reach for `logger` instead of `_logger`. The compiler catches that case: using a parameter in a member body when it also initializes a field produces warning CS9124, because the parameter is now captured twice. Promote CS9124 to an error and the readonly-field pattern is enforced.

Even so, primary constructors trade the scoping of a traditional constructor for brevity. A traditional constructor's parameters vanish when the constructor returns, and its `readonly` fields can't be reassigned by anything. What starts as a thin wrapper can gain methods, validation, and business logic over time, and a captured parameter that was harmless at creation becomes reassignable state as the class grows. For classes where immutability matters, prefer a traditional constructor, or use a primary constructor only with the readonly-field pattern and CS9124 as an error.

### Object Initializers

An object initializer sets accessible properties after the constructor runs. The examples below use properties rather than public fields throughout, since turning a public field into a property later is a binary-breaking change.

```csharp
public class Address
{
    public string? Street { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string Country { get; set; } = "USA";
}

var address = new Address
{
    Street = "123 Main St",
    City = "Seattle",
    PostalCode = "98101"
    // Country keeps its default
};

// Nested initializer: sets properties on the existing Address instance
public class Customer
{
    public string Name { get; set; } = "";
    public Address Address { get; set; } = new();
}

var customer = new Customer
{
    Name = "Alice",
    Address =
    {
        Street = "456 Oak Ave",
        City = "Portland"
    }
};

// Collection initializer on a get-only collection property
public class OrderList
{
    public List<string> Items { get; } = new();
}

var orderList = new OrderList
{
    Items = { "Item1", "Item2", "Item3" }
};
```

**Object initializers are practical, but use nullable types to keep the contract honest.** Serialization frameworks, ORMs, and test builders often require a parameterless constructor, so you can't always protect instantiation through constructor parameters. Object initializers handle those many instantiation paths well. The danger is failing to mark optional properties as nullable. If `Address` might not be set, declare it `Address?` and address every compiler warning, which makes the absence visible at each call site instead of hiding it behind an empty default. A default of `= new()` makes sense for collections, where an empty list means "zero items." For other reference-type properties, prefer a nullable type so the compiler enforces what the constructor can't. Marking a property `required` is the other option when every caller must set it.

## Structs

A struct is a value type. A variable of a struct type holds the struct's data directly, and assignment or passing copies all of it. Where that data lives depends on where the variable lives: a local sits in the method's stack frame or a register, a struct field of a class sits inside that object on the heap, and a struct element of an array sits inline in the array.

### Basic Struct

```csharp
public readonly struct Point
{
    public double X { get; }
    public double Y { get; }

    public Point(double x, double y)
    {
        X = x;
        Y = y;
    }

    public double DistanceFromOrigin() => Math.Sqrt(X * X + Y * Y);

    public Point Translate(double dx, double dy) => new Point(X + dx, Y + dy);
}

var p1 = new Point(3, 4);
var p2 = p1;   // a full copy; p1 and p2 are independent
```

### Constructors Don't Always Run

Since C# 10 a struct can declare a parameterless constructor, and `new Point()` runs it. `default(Point)`, a freshly allocated array, and an uninitialized struct field do not. Each of those produces the zeroed value, with every field at its default, and no constructor is involved:

```csharp
public struct Counter
{
    public int Start;
    public Counter() { Start = 42; }
}

var a = new Counter();            // Start == 42
var b = default(Counter);         // Start == 0
var c = new Counter[1];           // c[0].Start == 0
```

Design every struct so that its all-zero state is valid, because code will create it whether or not you declare a constructor.

### Mutable Structs Copy Silently

Because a struct is copied whenever it's read out of something, mutating a struct usually mutates a copy. The compiler rejects the obvious cases and misses the subtle ones:

```csharp
public struct MutablePoint { public int X; }

var list = new List<MutablePoint> { new() };
list[0].X = 5;              // CS1612: the indexer returns a copy

var point = list[0];        // a copy
point.X = 5;                // changes the copy, not the list element
list[0] = point;            // the write-back you need
```

The same happens through a property that returns a struct and through a `readonly` field, where calling a mutating method silently operates on a copy. Making structs immutable removes this whole class of bug, which is why the guidance for structs is to make them `readonly` unless you have a specific reason not to.

### Readonly Structs (C# 7.2)

`readonly struct` makes immutability a compile-time guarantee. Every instance field must be `readonly` and every property get-only or `init`, and every member is implicitly `readonly`, meaning it promises not to modify the struct.

```csharp
public readonly struct Vector3
{
    public double X { get; }
    public double Y { get; }
    public double Z { get; }

    public Vector3(double x, double y, double z) => (X, Y, Z) = (x, y, z);

    public double Magnitude() => Math.Sqrt(X * X + Y * Y + Z * Z);

    public static Vector3 operator +(Vector3 a, Vector3 b) =>
        new Vector3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
}
```

A struct that has to stay mutable can still mark individual members `readonly` (C# 8). The promise matters when the struct is accessed through a `readonly` field or an `in` parameter: the compiler can call a `readonly` member directly, but for any other member it first makes a defensive copy.

### Ref Structs

A `ref struct` is a struct the compiler confines so that it can never end up on the heap. `Span<T>` is the best-known one. The confinement is a set of declaration rules:

| A `ref struct` can't | Because |
| --- | --- |
| Be a field of a class or of a non-ref struct | The containing object could live on the heap |
| Be boxed, or converted to an interface it implements | Boxing copies it to the heap |
| Be captured by a lambda or local function | Captures are stored in a heap object |
| Be alive across an `await` or `yield return` | The state machine that spans them may be on the heap |
| Be an array element | Arrays are heap objects |

Later versions loosened what a `ref struct` can take part in without relaxing those rules. C# 11 lets a `ref struct` declare `ref` fields. C# 13 lets it implement interfaces, although it still can't be converted to one. C# 13 also lets it be a generic type argument when the type parameter declares `allows ref struct`, and it lets a `ref struct` local appear in an async method or iterator as long as its use doesn't span an `await` or `yield return`.

```csharp
public ref struct Tokenizer(ReadOnlySpan<char> text)
{
    private ReadOnlySpan<char> remaining = text;   // a span field is allowed here

    public bool TryNext(out ReadOnlySpan<char> token)
    {
        remaining = remaining.TrimStart(' ');
        if (remaining.IsEmpty) { token = default; return false; }

        int end = remaining.IndexOf(' ');
        if (end < 0) end = remaining.Length;
        token = remaining[..end];
        remaining = remaining[end..];
        return true;
    }
}
```

Declare a `ref struct` when the type has to hold a `Span<T>` or a `ref` field. Anything else is better as an ordinary struct, which can go everywhere a `ref struct` can't.

### Choosing Between Structs and Classes

Classes are the default. A struct pays off when the type is a small, immutable, single value with no identity, and many instances are created, so avoiding a heap allocation per instance adds up.

| Factor | Struct | Class |
| --- | --- | --- |
| Semantics | Value (copied on assign and pass) | Reference (shared) |
| Size | Small; Microsoft's design guidelines suggest under 16 bytes | Any |
| Mutability | Should be immutable | Either |
| Inheritance | None (can implement interfaces) | Single inheritance |
| Storage | Inline in its variable, field, or array | A separate heap object |
| Null | Only as `Nullable<T>` | Any reference can be null |
| Typical use | Coordinates, colors, measurements, small keys | Entities, services, anything with identity |

The size guideline is about copying. Every assignment and every by-value argument copies the whole struct, so the cost grows with its size, while a class reference stays one pointer wide. Past a few dozen bytes, a struct that is passed around a lot can easily cost more than the allocation it saved. Converting a struct to an interface or to `object` boxes it onto the heap, which erases the saving entirely.

**Identity decides the rest.** A `Customer` with ID 42 is a specific entity, and another object with the same data is still a different thing. A `Point(3, 4)` is just a value, and any `Point(3, 4)` is interchangeable with any other.

```csharp
// Good struct candidates: small, immutable values with value equality
public readonly record struct Rgb(byte R, byte G, byte B);
public readonly record struct DateRange(DateOnly Start, DateOnly End);

// Should be classes
public class Customer { }       // identity matters
public class OrderService { }   // behavior and dependencies
```

## Records (C# 9.0+)

### The Problem Records Solve

Before C# 9, getting value-based equality on a class meant overriding `Equals`, `GetHashCode`, and the `==` and `!=` operators by hand. This was tedious and fragile. Adding a new property meant updating every equality method, and forgetting one produced subtle bugs where two objects that looked identical compared as unequal, or two different objects compared as equal because the new property wasn't checked.

Records remove that class of bug. The compiler generates equality members over every instance field, including the backing fields of auto-properties, regenerates them when fields change, and provides `with` expressions for creating modified copies. A positional record also gets `init`-only properties, deconstruction, and a readable `ToString()` from a single line.

```csharp
// Without records: tedious, error-prone, and easy to break when adding properties
public class PersonClass
{
    public string FirstName { get; }
    public string LastName { get; }

    public PersonClass(string firstName, string lastName)
    {
        FirstName = firstName;
        LastName = lastName;
    }

    public override bool Equals(object? obj) =>
        obj is PersonClass other &&
        FirstName == other.FirstName &&
        LastName == other.LastName;

    public override int GetHashCode() =>
        HashCode.Combine(FirstName, LastName);

    public static bool operator ==(PersonClass? left, PersonClass? right) =>
        Equals(left, right);

    public static bool operator !=(PersonClass? left, PersonClass? right) =>
        !Equals(left, right);
}

// With records: one line, equality that can't fall out of sync
public record Person(string FirstName, string LastName);
```

### Record Classes

A `record` (or `record class`) is a reference type, allocated and passed like any class. The difference is that equality compares field values instead of references.

```csharp
public record Person(string FirstName, string LastName);

var person1 = new Person("John", "Doe");
var person2 = new Person("John", "Doe");

Console.WriteLine(person1 == person2);                 // true: same data
Console.WriteLine(ReferenceEquals(person1, person2));  // false: different objects

var (first, last) = person1;                           // positional records deconstruct

Console.WriteLine(person1);   // Person { FirstName = John, LastName = Doe }
```

**Non-destructive mutation with `with` expressions.** A positional record's properties are `init`-only, so they can't change after creation. `with` creates a new instance that copies every field from the original and overrides only the ones you name.

```csharp
var person3 = person1 with { LastName = "Smith" };
// person1 is still "John Doe"; person3 is a new "John Smith"
```

**Adding members beyond positional parameters.** Records can have extra properties, methods, and computed values alongside the positional ones.

```csharp
public record Employee(string Name, string Department)
{
    public DateOnly HireDate { get; init; }

    public int YearsEmployed(DateOnly today) =>
        today.Year - HireDate.Year - (today.DayOfYear < HireDate.DayOfYear ? 1 : 0);
}
```

**Inheritance.** Record classes support inheritance, and equality is type-aware. A `Manager` record is never equal to an `Employee` record even when every shared property matches, because the runtime type is part of the comparison.

```csharp
public record Employee(string Name, string Department);
public record Manager(string Name, string Department, int TeamSize)
    : Employee(Name, Department);

var emp = new Employee("Alice", "Engineering");
var mgr = new Manager("Alice", "Engineering", 5);

Console.WriteLine(emp == mgr); // false: different types
```

This is deliberate. Records represent data, and data of two different shapes is not the same data. If you need polymorphic equality that ignores the type, records are the wrong tool.

### Record Structs (C# 10)

A `record struct` is a value type with record semantics. It copies on assignment like any struct and compares by value like any record.

```csharp
// Mutable by default, unlike record classes
public record struct Point(double X, double Y);

// readonly record struct makes the positional properties init-only
public readonly record struct Coordinate(double Latitude, double Longitude);

var coord1 = new Coordinate(47.6062, -122.3321);
var coord2 = new Coordinate(47.6062, -122.3321);
Console.WriteLine(coord1 == coord2); // true

var coord3 = coord1 with { Longitude = -122.5 };
```

There is an asymmetry here. A positional `record class` generates `init` properties, so it's immutable by default. A positional `record struct` generates ordinary `set` properties, so it's mutable by default. For an immutable value type, write `readonly record struct` explicitly.

| Feature | Record Class | Record Struct |
| --- | --- | --- |
| Type | Reference | Value |
| Inheritance | Yes | No |
| Null | Can be null | Only as `Nullable<T>` |
| Storage | A separate heap object | Inline in its variable, field, or array |
| Positional properties | `init` (immutable) | `set` (mutable) unless `readonly` |
| `with` expressions | Yes | Yes |

### When to Use Records

The textbook answer is "use records for data types where identity doesn't matter," but that advice is too broad. A `Person` with `FirstName`, `LastName`, and `Email` is pure data with no behavior, which sounds like a record candidate. In practice, though, you validate the first name, then the last name, then the email, updating the object as you go. With a mutable class, each validation step sets a property. With a record, you either chain `with` expressions that create and discard intermediate copies, or you accumulate the validated values separately and construct the record at the end. Both are more awkward than setting properties on a class.

```csharp
// With a mutable class: validate and set as you go
var person = new Person();
person.FirstName = ValidateFirstName(input.FirstName);
person.LastName = ValidateLastName(input.LastName);
person.Email = ValidateEmail(input.Email);

// With a record: each step creates a throwaway copy
var person = new Person("", "", "");
person = person with { FirstName = ValidateFirstName(input.FirstName) };
person = person with { LastName = ValidateLastName(input.LastName) };
person = person with { Email = ValidateEmail(input.Email) };

// Or accumulate validated values and construct once at the end,
// which means holding validated state outside the object
var firstName = ValidateFirstName(input.FirstName);
var lastName = ValidateLastName(input.LastName);
var email = ValidateEmail(input.Email);
var person = new Person(firstName, lastName, email);
```

None of the record approaches are terrible, but none are better than the class version either. The immutability records enforce isn't helping here. It creates friction in a workflow that naturally involves incremental mutation.

There is a counterargument. In a functional style, where methods never mutate their inputs and instead return new instances, `with` expressions are convenient. A pipeline that transforms a record through several stages, each returning a modified copy, reads cleanly and avoids shared mutable state. But that works backwards as a justification for defaulting to records. Most C# codebases are not functional-first. Services mutate objects by reference, controllers bind mutable models, and Entity Framework tracks changes on mutable entities. Adopting records everywhere to enable a style the rest of the codebase doesn't follow creates inconsistency without the safety a functional architecture would provide. Use records when the data is naturally immutable, not to impose a paradigm the surrounding code doesn't support.

Records earn their keep when the data should not change after creation. In practice, that means **computed results and decision outputs**: the return value of a calculation, the outcome of a business rule, or a snapshot of state at a specific moment. These are produced once and then consumed, never edited.

**Where records fit naturally**:
- **Computed results**: `PricingResult`, `TaxCalculation`, `RouteDecision`. These represent the output of a process, with no reason to modify them once computed.
- **Event payloads**: `OrderPlaced`, `PaymentProcessed`, `UserRegistered`. Events describe something that already happened, which by definition can't change.
- **Query results and projections**: data returned from a database query or API call that you read and pass along but never edit.
- **Snapshots**: `AuditEntry`, `ConfigurationSnapshot`, `BalanceAtDate`. These capture state at a point in time.
- **Dictionary and lookup keys**: value equality makes records usable as keys without custom comparers or a hand-written `GetHashCode`.

**Where records create unnecessary friction**:
- **Objects that are built up incrementally.** If you validate, enrich, or transform the data through multiple steps, mutable properties on a class are simpler.
- **Entities with identity.** A `Customer` with ID 42 is a specific entity. Another object with the same data isn't the same customer, so reference equality or explicit ID-based equality fits better.
- **Service classes.** `OrderProcessor` or `EmailService` types have dependencies, side effects, and no meaningful concept of equality.
- **Types that need selective equality.** Records compare every field. Excluding a timestamp or cache field means overriding the equality members yourself, which defeats the purpose.

### Pitfalls

**`with` creates shallow copies.** When a record property is a reference type such as a `List<T>`, the `with` expression copies the reference, not the list. The original and the copy share it, so mutating it through one affects both.

```csharp
public record Order(int Id, List<string> Items);

var order1 = new Order(1, new List<string> { "Widget" });
var order2 = order1 with { Id = 2 };

order2.Items.Add("Gadget");
Console.WriteLine(order1.Items.Count); // 2: the original was affected
```

If a record contains mutable reference types, treat a copy as sharing state. For independent copies, clone the inner collections yourself, or use immutable collections so there's nothing to share.

**Positional parameters generate public properties.** Every positional parameter becomes a public `init` property. To keep one less visible, declare it as an ordinary property in the record body.

```csharp
public record Person(string Name, string Ssn);   // Ssn is publicly readable

public record Person(string Name)
{
    internal string Ssn { get; init; } = "";
}
```

**Keep records focused on data.** Records can have methods, but loading them with business logic blurs the line between data types and service types. A record with a `CalculateTax()` method is still a record. One with `SendEmail()` or `SaveToDatabase()` has crossed into behavior that belongs in a service class.

**Prefer `readonly record struct` over `record struct`.** The mutable default for record structs is a common source of confusion. If you chose a record struct to get a small value type with equality, you almost certainly want immutability too, along with the protection from copy bugs that comes with it.

## Sealed Classes

`sealed` prevents a class from being inherited. Some style guides recommend sealing everything by default. The practical value depends on whether you're writing library code or application code.

```csharp
public sealed class Configuration
{
    public string ConnectionString { get; init; } = "";
    public int Timeout { get; init; }
}

// public class ExtendedConfig : Configuration { }   // compile error
```

**The case for sealing: library and framework code.** When you publish a library, you can't control what consumers do with your types. A derived class that overrides a method in a way you didn't anticipate can violate invariants your code depends on. Sealing closes the type to extension. It is also a one-way door in the other direction: unsealing later is compatible, but sealing a type that has shipped unsealed breaks every consumer that derived from it, so the decision is best made at the first release. In the BCL, `String` is sealed while `HttpClient` is not, because `HttpClient` was designed for extension.

Sealing also helps performance. The JIT can devirtualize calls on a sealed type, turning virtual dispatch into direct calls that can be inlined, and type checks and casts against a sealed type are cheaper. On hot paths in high-throughput code, this can matter. The CA1852 analyzer flags internal types that nothing in the assembly derives from, since those can be sealed with no compatibility cost.

**The case against sealing: application code.** In a typical application, the team controls all the code. Nobody is going to inherit from `OrderService` by accident and break its invariants, and a code review would catch it if they did. Sealing every class by default adds noise without preventing a problem that realistically occurs.

Sealing also affects testing. Mocking frameworks built on runtime proxies, such as Moq and NSubstitute, create test doubles by generating subclasses, so they can't mock a sealed class. They can't intercept a non-virtual member of an unsealed class either, so in practice these frameworks mock through interfaces regardless, and sealing mostly matters for code that mocks concrete classes with virtual members.

**When sealing does make sense in application code.** Some classes should not be inherited because their correctness depends on controlling all behavior. A class that manages a resource like a connection pool or a thread-safe cache may rely on a specific method execution order or internal state transitions that a subclass could disrupt.

```csharp
// Sealing makes sense here: the pool manages internal state
// that subclasses could corrupt
public sealed class ConnectionPool
{
    private readonly ConcurrentBag<DbConnection> _connections = new();

    public DbConnection Acquire() { /* ... */ }
    public void Release(DbConnection connection) { /* ... */ }
}

// Sealing adds little here: a plain data class
// that nobody has a reason to inherit from
public sealed class CustomerDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
```

In application code, `sealed` is rarely necessary for correctness. Reserve it for types where inheritance would break correctness, or apply it where CA1852 shows it costs nothing, rather than as a blanket policy.

## Abstract Classes

An abstract class can't be instantiated. It exists to be derived from, and it can mix members every derived class must implement (`abstract`), members they may override (`virtual`), and members they inherit unchanged.

```csharp
public abstract class Shape
{
    public string Color { get; set; } = "black";

    public abstract double CalculateArea();          // must be implemented

    public virtual void Draw() =>                     // may be overridden
        Console.WriteLine($"Drawing {Color} shape");

    public void Describe() =>                         // inherited as-is
        Console.WriteLine($"A {Color} shape with area {CalculateArea()}");
}

public class Circle : Shape
{
    public double Radius { get; set; }

    public override double CalculateArea() => Math.PI * Radius * Radius;

    public override void Draw()
    {
        base.Draw();
        Console.WriteLine($"Circle with radius {Radius}");
    }
}
```

## Partial Types

The `partial` keyword splits one type's declaration across several files. The compiler merges them into a single type, so at run time a partial class is indistinguishable from one written in a single file.

```csharp
// Customer.cs - your code, never touched by the generator
public partial class Customer
{
    public string FullName => $"{FirstName} {LastName}";
    public bool IsPreferred => TotalOrders > 100;
}

// Customer.Generated.cs - produced by EF scaffolding, a source generator, etc.
// Regenerated freely without overwriting your code
public partial class Customer
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public int TotalOrders { get; set; }
}
```

**The legitimate use: separating hand-written code from generated code.** Tools like Entity Framework scaffolding, WinForms designers, source generators, and gRPC produce code for a class you also need to extend. Without partial types you would have to edit the generated file, which the next generation overwrites, or resort to inheritance just to add members. Partial types let the tool own one file and the developer own another.

Individual members can be partial too, which is how a generator and a developer split a single member. One part declares it and the other implements it. Partial methods have been around longest. A `void` partial method with no access modifier may be left unimplemented, in which case the compiler removes the calls to it. Any other partial method must be implemented. C# 13 added partial properties and indexers, and C# 14 added partial constructors and events, which lets a source generator supply the implementation of a member you declare.

**The problem: using partial classes to manage complexity.** When a class grows large enough that developers split it across files for readability, the issue isn't file length. It's that the class has too many responsibilities. Splitting `Customer` into `Customer.cs`, `Customer.Validation.cs`, `Customer.Persistence.cs`, and `Customer.Formatting.cs` doesn't reduce complexity. It spreads it across files while keeping all the coupling, since every part shares the same private fields and state. The class is just as hard to reason about, and now you have to open four files to do it.

```csharp
// This looks organized, but it's a single class with four responsibilities
// Customer.cs             - properties and constructors
// Customer.Validation.cs  - validation methods
// Customer.Persistence.cs - Save(), Load(), Delete()
// Customer.Formatting.cs  - ToString(), ToJson(), ToCsv()

// All four files share private fields and can mutate the same state.
// The "separation" is cosmetic. The coupling is identical to one big file.
```

If a class needs validation, persistence, and formatting, those are three concerns that should be three types. A `CustomerValidator`, a `CustomerRepository`, and a `CustomerFormatter` each have one responsibility, can be tested independently, and make their dependencies explicit through their constructors.

**When partial types are appropriate**:
- Separating hand-written code from tool-generated code (EF models, source generators, WinForms designers, gRPC stubs)
- Partial members, where one part declares a member and a generator or the developer implements it

**When partial types are masking a design problem**:
- Splitting a class across files because it is "too long." The length is a symptom, and the multiple responsibilities are the cause.
- Organizing a class by concern, with validation in one file and persistence in another. If you can name distinct concerns, they should be distinct types.

## Static Classes

A static class can't be instantiated, can't be inherited, and can contain only static members. The compiler enforces all three, which makes it a deliberate design choice rather than a convention.

```csharp
public static class Geometry
{
    public static double Square(double x) => x * x;

    public static double CircleArea(double radius) => Math.PI * Square(radius);
}
```

The intended purpose is to group functions and constants that have no meaningful instance state. `Math.Max`, `Path.Combine`, and `Convert.ToInt32` take input, produce output, and depend on no object's state, so there's nothing an instance would add.

### When Static Classes Are Appropriate

**Pure utility functions.** Methods with no side effects, where the same inputs always produce the same output: string formatting, math, validation predicates, and type conversions.

**Constants.** A static class can serve as a named container for related constants, replacing scattered magic numbers with readable names.

**Extension methods.** The compiler requires extension methods, and C# 14's `extension` blocks, to live in a non-nested, non-generic static class. This is the most common use of static classes in application code.

```csharp
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}

var preview = longDescription.Truncate(100);
```

### When Static Classes Become a Problem

**Hiding dependencies.** The most damaging misuse is a static class that provides a service that should be injected. When a class calls `DatabaseHelper.GetConnection()` directly, the dependency is invisible in the constructor and the type signature, and it can't be replaced in tests.

```csharp
// Hidden dependency: where does the connection come from?
public class OrderService
{
    public Order GetOrder(int id)
    {
        using var conn = DatabaseHelper.GetConnection();
        return conn.QuerySingle<Order>("SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
    }
}

// Explicit dependency: visible, testable, configurable
public class OrderService(IDbConnection connection)
{
    public Order GetOrder(int id) =>
        connection.QuerySingle<Order>("SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
}
```

**Accumulating global state.** A static field lives as long as the process, or until its `AssemblyLoadContext` unloads. A static class that starts with helper methods can gradually acquire static fields for caching or configuration, which is global mutable state every caller shares. That brings concurrency bugs and order-of-initialization dependencies that are hard to diagnose. If a method needs cached data, make the cache an injected dependency with an explicit lifetime.

**Growing into a dumping ground.** Utility classes attract unrelated methods. `StringHelper` starts with `Truncate` and `ToTitleCase`, then gains `FormatCurrency`, `ParseCsvLine`, and eventually thirty methods spanning unrelated concerns. When that happens, split it into focused classes like `CsvParser` and `CurrencyFormatter`.

### Static Class, Singleton, or Injected Dependency

Reaching for a static class to hold service-like behavior is an attempt to solve "I need one of these, accessible everywhere." The three common answers differ in what they expose:

```csharp
Logger.Log("Order processed");            // static: invisible, can't be replaced
Logger.Instance.Log("Order processed");   // singleton: visible, but tied to one concrete type

public class OrderProcessor(ILogger<OrderProcessor> logger)   // injected: visible and replaceable
{
    public void Process(Order order) => logger.LogInformation("Order processed");
}
```

For services with side effects, like logging, email, or database access, inject them. Keep static classes for stateless operations that have no reason to vary between environments or tests.

## Nested Types

A nested type is declared inside another type. It has one capability a top-level type lacks: it can access the enclosing type's `private` members. Its own accessibility can also be `private`, which hides it from everything outside the enclosing type.

```csharp
public class LinkedList<T>
{
    private Node? head;

    public void Add(T value) => head = new Node(value) { Next = head };

    private class Node(T value)
    {
        public T Value { get; } = value;
        public Node? Next { get; set; }
    }
}
```

The textbook justification is encapsulation: `Node` is an implementation detail of `LinkedList<T>`, so hiding it prevents outside code from depending on it. That sounds reasonable in isolation, but hiding a type doesn't serve the same purpose as hiding a function.

A local function inside a method is private to that method's execution. It can't be tested independently, and it rarely needs to be, because it's a few lines of logic serving one call site. A nested class is a full type with its own fields, properties, and methods. It can grow, accumulate behavior, and develop bugs. The moment you want to unit test `Node` on its own, reuse it in a second data structure, or reference it from a serialization context, the nesting becomes an obstacle to undo.

Types that start as "pure implementation details" rarely stay that way. A `Node` might need to be exposed for custom iterators. An `Order.LineItem` that seemed tightly coupled to `Order` gets referenced by invoicing, reporting, and shipping code. A private `Builder` nested inside a complex object eventually needs to be shared with a test fixture. Each time, you either make the nested class public, which raises the question of why it's nested at all, or extract it to its own file, a refactoring that touches every reference.

**Public nested classes have a weaker justification.** `Order.LineItem` reads nicely, but the namespacing benefit is cosmetic. A top-level `OrderLineItem` conveys the same relationship without making every consumer qualify the name through `Order`, or add `using static Order;` to bring its nested types into scope.

```csharp
// Nested: reads well initially, creates friction as usage grows
var item = new Order.LineItem { ProductName = "Widget" };

// Top-level: same clarity, no nesting dependency
var item = new OrderLineItem { ProductName = "Widget" };
```

**Where nesting survives scrutiny.** The BCL uses nested types in a few specific patterns. `List<T>.Enumerator` is a public struct nested in `List<T>`. `List<T>.GetEnumerator()` returns that struct directly, so a `foreach` over a `List<T>` uses it without boxing or allocating. It is also bound to the list's internal state, reading the list's version counter to detect modification during enumeration, and the nesting says so. Compiler-generated code, such as the state machines behind `async` methods and iterators, is emitted as nested types so it can call the enclosing type's private members. These are infrastructure concerns rather than typical application patterns.

For application code, default to top-level types. Nest a type when it needs the enclosing type's private members, or when it will genuinely stay private to that type for the life of the codebase. If it is likely to be tested, shared, or referenced independently, put it in its own file from the start.

## Key Takeaways

**Default to classes.** Use a struct only for a small, immutable value with no identity.

**A struct lives wherever its container lives.** It is copied on every assignment and by-value argument, and `default` and arrays create it without running a constructor.

**Make structs readonly.** Mutable structs are mutated through copies, silently.

**Use `ref struct` only to hold a span or a ref field.** Its restrictions exist to keep it off the heap, and they apply everywhere it goes.

**Primary constructor parameters are mutable captured state.** Copy them to `readonly` fields and treat CS9124 as an error when immutability matters.

**Use records for immutable outputs, not mutable data.** Records shine for computed results, event payloads, and snapshots that are produced once and never edited. For data built up or modified during a workflow, a mutable class is simpler.

**Seal classes when inheritance would break correctness.** In library code, sealing protects invariants from unknown consumers and is hard to add later. In application code, seal where subclassing would corrupt internal state or where CA1852 shows it's free.
