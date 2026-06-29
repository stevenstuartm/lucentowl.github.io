---
title: "C# Classes and Structs"
layout: guide
category: ".NET & C#"
subcategory: "Object-Oriented Programming"
description: "Understanding classes, structs, and records in C# including when to use each, initialization patterns, and best practices."
tags: [c-sharp, dotnet, oop, classes, structs, records, practical]
---

## Classes

Classes are reference types that encapsulate data and behavior. They support inheritance and can be allocated on the heap.

### Basic Class Structure

```csharp
public class Customer
{
    // Fields (private by default)
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

Constructors can be overloaded to support different ways of creating an instance. Use `: this()` to chain constructors and avoid duplicating initialization logic.

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
    }

    // Overload: accepts id and customer name, chains to parameterless
    public Order(int id, string customerName) : this()
    {
        Id = id;
        CustomerName = customerName;
    }

    // Overload: accepts only id, chains to the two-parameter overload
    public Order(int id) : this(id, "Unknown")
    {
    }

    // Static constructor - runs once per type, before any instance is created
    static Order()
    {
        Console.WriteLine("Order type initialized");
    }
}

// Each overload gives callers flexibility
var defaultOrder = new Order();
var namedOrder = new Order(1, "Alice");
var idOnlyOrder = new Order(2);
```

### Primary Constructors (C# 12)

Primary constructors capture parameters directly in the class declaration, reducing boilerplate. The parameters are available throughout the class body.

```csharp
// Traditional approach with overloaded constructors
public class Product
{
    private readonly string name;
    private readonly decimal price;
    private readonly string category;

    public Product(string name, decimal price)
    {
        this.name = name;
        this.price = price;
        this.category = "General";
    }

    // Overload that accepts a category
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

// Same type with a primary constructor (C# 12)
// The primary constructor replaces the main parameter list
public class Product(string name, decimal price, string category = "General")
{
    public string Name => name;
    public decimal Price => price;
    public string Category => category;

    public decimal CalculateDiscount(decimal percentage) =>
        price * (1 - percentage);
}

// Usage is identical for both approaches
var widget = new Product("Widget", 9.99m);
var bolt = new Product("Bolt", 1.50m, "Hardware");
```

Primary constructors are especially useful for dependency injection, where services typically accept dependencies through a single constructor.

```csharp
public class OrderProcessor(ILogger logger, IEmailService emailService)
{
    public async Task ProcessAsync(Order order)
    {
        logger.LogInformation("Processing order {Id}", order.Id);
        await emailService.SendConfirmationAsync(order);
    }
}
```

**Watch out for mutability.** Primary constructor parameters are captured as hidden mutable fields. There is no way to mark them `readonly`, so any method in the class can silently reassign them. For service classes with injected dependencies, assign parameters to `private readonly` fields to preserve the immutability guarantee that traditional constructors provided.

```csharp
// Unsafe: logger can be reassigned anywhere in the class
public class OrderProcessor(ILogger logger)
{
    public void DoWork()
    {
        logger.LogInformation("Working...");
        logger = null; // Compiles with no warning
    }
}

// Safer: assign to a readonly field to prevent reassignment
public class OrderProcessor(ILogger logger, IEmailService emailService)
{
    private readonly ILogger _logger = logger;
    private readonly IEmailService _emailService = emailService;

    public async Task ProcessAsync(Order order)
    {
        _logger.LogInformation("Processing order {Id}", order.Id);
        await _emailService.SendConfirmationAsync(order);
    }
}
```

Even with the readonly field approach, there is a risk that traditional constructors did not have. With a traditional constructor, the parameter `logger` was scoped to the constructor body and could not be referenced anywhere else. With a primary constructor, `logger` remains accessible throughout the entire class even after assigning it to `_logger`. Nothing prevents you from accidentally using the mutable `logger` instead of the readonly `_logger`, and the compiler will not warn you.

```csharp
public class OrderProcessor(ILogger logger, IEmailService emailService)
{
    private readonly ILogger _logger = logger;
    private readonly IEmailService _emailService = emailService;

    public void DoWork()
    {
        _logger.LogInformation("Safe");
        logger.LogInformation("Also compiles, but bypasses readonly");
    }
}
```

For these reasons, prefer traditional constructors for any class where immutability matters. A simple data-carrying class might seem safe today, but classes evolve. What starts as a thin wrapper with a few properties can gain methods, validation, and business logic over time. A primary constructor that felt harmless at creation becomes a mutability risk the moment the class grows, and nothing in the compiler will flag the transition. The brevity that primary constructors offer is not worth the safety that `readonly` fields guarantee.

### Properties

**Always use properties over public fields.** Changing a public field to a property is a binary-breaking change — any assembly compiled against the field must be recompiled. Properties provide a stable API contract from day one, allowing you to add validation or change notification later without breaking consumers. Auto-properties (`{ get; set; }`) since C# 3.0 eliminated the verbosity argument. The only acceptable public fields are `const` and `static readonly`.

```csharp
public class Product
{
    // Auto-implemented property
    public string Name { get; set; }

    // Read-only auto-property
    public int Id { get; }

    // Init-only setter (C# 9.0) - settable during initialization, readonly after
    public string Sku { get; init; }

    // Computed property
    public decimal Price { get; set; }
    public decimal Tax => Price * 0.08m;
    public decimal TotalPrice => Price + Tax;

    // Property with backing field
    private string description;
    public string Description
    {
        get => description ?? "";
        set => description = value?.Trim();
    }

    // Property with validation
    private int quantity;
    public int Quantity
    {
        get => quantity;
        set
        {
            if (value < 0)
                throw new ArgumentOutOfRangeException(nameof(value));
            quantity = value;
        }
    }

    // Required property (C# 11)
    public required string Category { get; set; }
}

// Using init-only and required
var product = new Product
{
    Id = 1,           // Error: read-only
    Sku = "ABC123",   // OK: init-only
    Name = "Widget",
    Category = "Hardware"  // Required: must be set
};
```

**Understanding `init`.** An `init` setter does two things: it allows the property to be set during object creation (via a constructor or object initializer), and it makes the property readonly after that point. This matters most for structs, where `{ get; }` properties can only be set inside a constructor. Using `{ get; init; }` on a struct lets you use object initializer syntax while still preventing mutation after creation. On a `readonly struct`, `init` is redundant because all members are already immutable.

```csharp
public struct Point
{
    public double X { get; init; }
    public double Y { get; init; }
}

var p = new Point { X = 3, Y = 4 }; // OK: init allows object initializer
p.X = 99;                            // Error: readonly after creation
```

### Object Initializers

```csharp
public class Address
{
    public string Street { get; set; }
    public string City { get; set; }
    public string PostalCode { get; set; }
    public string Country { get; set; } = "USA";
}

// Object initializer syntax
var address = new Address
{
    Street = "123 Main St",
    City = "Seattle",
    PostalCode = "98101"
    // Country uses default
};

// Nested object initializers
public class Customer
{
    public string Name { get; set; }
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

// Collection initializers
public class OrderList
{
    public List<string> Items { get; } = new();
}

var orderList = new OrderList
{
    Items = { "Item1", "Item2", "Item3" }
};
```

**Object initializers are practical, but use nullable types to keep the contract honest.** Serialization frameworks, ORMs, and test builders often require parameterless constructors, which means you cannot always protect instantiation through constructor parameters. That is fine — real-world code has many instantiation paths, and object initializers handle that flexibility well. The danger is not the initializer syntax itself but the failure to mark optional properties as nullable. If `Address` might not be set, declare it as `Address?` and address every compiler warning. This makes the absence visible at every call site rather than hiding it behind a silently empty default. Default `= new()` makes sense for collections, where an empty list genuinely means "zero items." For reference type properties, prefer nullable types so the compiler enforces what the constructor cannot.

## Structs

Structs are value types allocated on the stack (when local) or inline (when in arrays or as fields). They're copied on assignment.

### Basic Struct

```csharp
public struct Point
{
    public double X { get; }
    public double Y { get; }

    public Point(double x, double y)
    {
        X = x;
        Y = y;
    }

    public double DistanceFromOrigin() =>
        Math.Sqrt(X * X + Y * Y);

    public Point Translate(double dx, double dy) =>
        new Point(X + dx, Y + dy);
}

// Value semantics
var p1 = new Point(3, 4);
var p2 = p1;  // Copy
// Modifying p2 doesn't affect p1
```

### Readonly Structs (C# 7.2)

Enforce immutability at compile time.

```csharp
public readonly struct Vector3
{
    public double X { get; }
    public double Y { get; }
    public double Z { get; }

    public Vector3(double x, double y, double z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    // All methods must be readonly (implicit in readonly struct)
    public double Magnitude() =>
        Math.Sqrt(X * X + Y * Y + Z * Z);

    public Vector3 Normalize()
    {
        var mag = Magnitude();
        return new Vector3(X / mag, Y / mag, Z / mag);
    }

    // Operator overloading
    public static Vector3 operator +(Vector3 a, Vector3 b) =>
        new Vector3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
}
```

### Record Structs (C# 10)

Value types with record semantics.

```csharp
// Record struct - value type with value equality
public readonly record struct Coordinate(double Latitude, double Longitude);

var coord1 = new Coordinate(47.6062, -122.3321);
var coord2 = new Coordinate(47.6062, -122.3321);
Console.WriteLine(coord1 == coord2);  // true - value equality

// With expressions for non-destructive mutation
var coord3 = coord1 with { Longitude = -122.5 };
```

### Choosing Between Structs and Classes

**Use a struct when**:
- The type represents a single value (like a number or coordinate)
- Instances are small (16 bytes or less)
- The type is immutable (or should be)
- You're creating many short-lived instances in performance-critical code
- Identity doesn't matter—two instances with the same values should be considered equal

**Use a class when**:
- Identity matters—two objects with the same data are still distinct entities
- The type manages resources or has complex lifecycle
- Inheritance is needed
- The type has many fields or contains reference type fields
- Instances will be passed around extensively (avoiding copy overhead)

**Why 16 bytes matters**: Value types are copied on assignment and when passed to methods. A struct larger than 16 bytes often performs worse than a class because the copying overhead exceeds heap allocation cost. The runtime can also pass small structs in registers.

**Why identity matters**: A `Customer` with ID 42 is a specific entity. Even if you create another object with the same data, they represent different things conceptually. A `Point(3, 4)` is just a value, and any `Point(3, 4)` is interchangeable with any other.

| Factor | Struct | Class |
|--------|--------|-------|
| Size | Small (≤16 bytes ideal) | Any size |
| Semantics | Value (copy on assign) | Reference (share) |
| Mutability | Prefer immutable | Either |
| Inheritance | Cannot inherit | Can inherit |
| Allocation | Stack/inline | Heap |
| Nullability | Not null by default | Can be null |
| Use case | Coordinates, colors, small data | Entities, services, complex objects |

```csharp
// Good struct candidates
public readonly struct Color(byte R, byte G, byte B);
public readonly struct DateRange(DateTime Start, DateTime End);
public readonly struct Money(decimal Amount, string Currency);

// Should be classes
public class Customer { }     // Identity matters
public class OrderService { } // Has behavior/dependencies
public class FileStream { }   // Manages resources
```

## Records (C# 9.0+)

### The Problem Records Solve

Before C# 9, getting value-based equality on a class required overriding `Equals`, `GetHashCode`, and the `==`/`!=` operators by hand. This was tedious and fragile. Adding a new property meant updating every equality method, and forgetting to do so introduced subtle bugs where two objects that looked identical compared as unequal (or worse, two different objects compared as equal because the new property wasn't checked).

Records eliminate that entire class of bugs. The compiler generates correct equality members for every declared property, updates them automatically when properties change, and provides `with` expressions for creating modified copies. You get immutability by default, structural equality, built-in deconstruction, and a useful `ToString()` override, all from a single line of code.

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

// With records: one line, correct equality, immutable by default
public record Person(string FirstName, string LastName);
```

Both types above behave the same way under `==`, but the record version cannot fall out of sync with its own properties.

### Record Classes

A `record` (or `record class`) is a reference type. It lives on the heap and is passed by reference, just like a class. The difference is that equality compares property values instead of object references.

```csharp
public record Person(string FirstName, string LastName);

var person1 = new Person("John", "Doe");
var person2 = new Person("John", "Doe");

// Value equality: same data means equal
Console.WriteLine(person1 == person2);       // true
Console.WriteLine(ReferenceEquals(person1, person2)); // false - still different objects

// Deconstruction works with positional records
var (first, last) = person1;

// ToString() is auto-generated and useful for logging
Console.WriteLine(person1); // Person { FirstName = John, LastName = Doe }
```

**Non-destructive mutation with `with` expressions.** Records are immutable by default, so you cannot change their properties after creation. Instead, `with` creates a new instance that copies every property from the original and overrides only the ones you specify.

```csharp
var person3 = person1 with { LastName = "Smith" };
// person1 is still "John Doe" - unchanged
// person3 is "John Smith" - a new object
```

**Adding members beyond positional parameters.** Records can have additional properties, methods, and computed values. The positional parameters generate `init`-only properties and a deconstructor, but you can extend the type as needed.

```csharp
public record Employee(string Name, string Department)
{
    public DateTime HireDate { get; init; }

    public int YearsEmployed =>
        (DateTime.Now - HireDate).Days / 365;
}
```

**Inheritance.** Record classes support inheritance, but equality is type-aware. A `Manager` record is never equal to an `Employee` record even if all shared properties match, because the runtime type is part of the equality check.

```csharp
public record Employee(string Name, string Department);
public record Manager(string Name, string Department, int TeamSize)
    : Employee(Name, Department);

var emp = new Employee("Alice", "Engineering");
var mgr = new Manager("Alice", "Engineering", 5);

Console.WriteLine(emp == mgr); // false - different types
```

This is deliberate. Records represent data, and data from two different shapes is not the same data. If you need polymorphic equality that ignores type, records are the wrong tool.

### Record Structs (C# 10)

A `record struct` is a value type with record semantics. It copies on assignment (like any struct) and compares by value (like any record).

```csharp
// Mutable by default - unlike record classes
public record struct Point(double X, double Y);

// Readonly record struct enforces immutability
public readonly record struct Coordinate(double Latitude, double Longitude);

var coord1 = new Coordinate(47.6062, -122.3321);
var coord2 = new Coordinate(47.6062, -122.3321);
Console.WriteLine(coord1 == coord2); // true

var coord3 = coord1 with { Longitude = -122.5 };
```

There is an important asymmetry here: `record class` generates `init` setters (immutable by default), but `record struct` generates regular `set` setters (mutable by default). If you want an immutable value type, you need `readonly record struct` explicitly.

| Feature | Record Class | Record Struct |
|---------|--------------|---------------|
| Type | Reference | Value |
| Inheritance | Yes | No |
| Null | Can be null | Not null |
| Allocation | Heap | Stack/inline |
| Default mutability | Immutable (init) | Mutable |
| With expressions | Yes | Yes |

### When to Use Records

The textbook answer is "use records for data types where identity doesn't matter," but that advice is too broad. A `Person` with `FirstName`, `LastName`, and `Email` is pure data with no behavior, which sounds like a record candidate. But in a real workflow, you validate the first name, then the last name, then the email, updating the object as you go. With a mutable class, each validation step sets the property directly. With a record, you either chain `with` expressions that create and immediately discard intermediate copies, or you accumulate the validated values separately and construct the record at the end. Both approaches are more awkward and more bug-prone than just setting properties on a class.

```csharp
// With a mutable class: straightforward, validate and set as you go
var person = new Person();
person.FirstName = ValidateFirstName(input.FirstName);
person.LastName = ValidateLastName(input.LastName);
person.Email = ValidateEmail(input.Email);

// With a record: each step creates a throwaway copy
var person = new Person("", "", "");
person = person with { FirstName = ValidateFirstName(input.FirstName) };
person = person with { LastName = ValidateLastName(input.LastName) };
person = person with { Email = ValidateEmail(input.Email) };

// Or you accumulate validated values and construct once at the end,
// which means holding validated state outside the object
var firstName = ValidateFirstName(input.FirstName);
var lastName = ValidateLastName(input.LastName);
var email = ValidateEmail(input.Email);
var person = new Person(firstName, lastName, email);
```

None of the record approaches are terrible, but none are better than the class version either. The immutability that records enforce is not helping here; it is creating friction in a workflow that naturally involves incremental mutation.

There is a counterargument worth addressing. If you adopt a functional style where methods never mutate their inputs and instead return new instances, `with` expressions become genuinely convenient. A pipeline that transforms a record through several stages, each returning a modified copy, reads cleanly and avoids shared mutable state. But this argument works backwards as a justification for defaulting to records. Most C# codebases are not functional-first. Services mutate objects by reference, controllers bind mutable models, and Entity Framework tracks changes on mutable entities. Adopting records everywhere to enable a functional style that the rest of the codebase does not follow creates inconsistency without delivering the safety benefits that a truly functional architecture would provide. Use records when the data is naturally immutable, not to impose a programming paradigm that the surrounding code does not support.

Records earn their keep when the data genuinely should not change after creation. In practice, that means **computed results and decision outputs**: the return value of a calculation, the outcome of a business rule, or a snapshot of state at a specific moment. These are values that are produced once and then consumed, never edited.

**Where records fit naturally**:
- **Computed results**: `PricingResult`, `TaxCalculation`, `RouteDecision`. These represent the output of a process. Once computed, there is no reason to modify them.
- **Event payloads**: `OrderPlaced`, `PaymentProcessed`, `UserRegistered`. Events describe something that already happened, which by definition cannot change.
- **Query results and projections**: Data returned from a database query or API call that you read and pass along but never edit.
- **Snapshots**: `AuditEntry`, `ConfigurationSnapshot`, `BalanceAtDate`. These capture state at a point in time for later reference.
- **Dictionary and lookup keys**: Value equality makes records safe as keys without writing custom comparers or overriding `GetHashCode` by hand.

**Where records create unnecessary friction**:
- **Objects that are built up incrementally.** If you validate, enrich, or transform the data through multiple steps during a workflow, mutable properties on a class are simpler and less error-prone.
- **Entities with identity.** A `Customer` with ID 42 is a specific entity. Creating another object with the same data does not make it the same customer. Classes with reference equality or explicit ID-based equality are more appropriate.
- **Service classes.** `OrderProcessor` or `EmailService` types have dependencies, side effects, and no meaningful concept of equality.
- **Types where you need selective equality.** Records compare every property. If you need to exclude a timestamp or cache field from equality, you have to override the equality members yourself, which defeats the purpose.

### Pitfalls and Best Practices

**`with` creates shallow copies.** When a record property is a reference type like a `List<T>` or another class, the `with` expression copies the reference rather than cloning the object. Both the original and the copy point to the same list, so mutating it through one reference affects both.

```csharp
public record Order(int Id, List<string> Items);

var order1 = new Order(1, new List<string> { "Widget" });
var order2 = order1 with { Id = 2 };

order2.Items.Add("Gadget");
Console.WriteLine(order1.Items.Count); // 2 - the original was affected
```

If your record contains mutable reference types, treat the copy as sharing state rather than owning independent data. For truly independent copies, you need to clone the inner collections yourself.

**Positional parameters generate `init` properties, not fields.** This means the properties are publicly visible and settable during object initialization. If you need a property to be private or need to control access more tightly, use a standard property declaration inside the record body.

```csharp
// The parameter 'ssn' becomes a public init-only property
public record Person(string Name, string Ssn); // Ssn is publicly readable

// If you need to hide it, declare it explicitly
public record Person(string Name)
{
    internal string Ssn { get; init; }
}
```

**Keep records focused on data.** Records can have methods, but loading them with business logic blurs the line between data types and service types. A record with a `CalculateTax()` method is still a record, but a record with `SendEmail()` or `SaveToDatabase()` has crossed into behavior that belongs in a service class.

**Prefer `readonly record struct` over `record struct`.** The mutable default for record structs is a common source of confusion. If you are using a record struct because you want a small, stack-allocated value type with equality semantics, you almost certainly also want immutability. Make `readonly` the default choice and drop it only when you have a specific reason to allow mutation.

## Sealed Classes

The `sealed` keyword prevents a class from being inherited. The .NET runtime team seals aggressively, and some style guides recommend sealing everything by default. The practical value depends on whether you are writing library code or application code.

```csharp
public sealed class Configuration
{
    public string ConnectionString { get; init; }
    public int Timeout { get; init; }
}

// Cannot inherit from Configuration
// public class ExtendedConfig : Configuration { } // Compiler error
```

**The case for sealing: library and framework code.** When you publish a library, you cannot control what consumers do with your types. If someone inherits from your class and overrides a method in a way you did not anticipate, the derived class can violate invariants that your code depends on. Sealing protects against this by closing the type to extension. The .NET runtime seals `String`, `HttpClient`, and hundreds of other types for exactly this reason. Framework authors cannot predict every subclass, so sealing is a defensive necessity.

There is also a real performance benefit. The JIT compiler can devirtualize method calls on sealed types, turning virtual dispatch into direct calls and enabling inlining. On hot paths in high-throughput code, this can matter. The .NET team has measurable benchmarks showing the impact across the runtime.

**The case against sealing: application code.** In a typical application codebase, the team controls all the code. Nobody is going to accidentally inherit from your `OrderService` and break its invariants; a code review would catch that immediately. Sealing every class by default adds noise to the codebase without preventing a problem that realistically does not occur.

Sealing can also create friction with testing. Some mocking frameworks create test doubles by generating subclasses at runtime. Sealing a class means those frameworks cannot mock it directly, forcing you to either extract an interface (adding a file that exists only for testability) or use a framework that supports sealing like source-generated mocks. Neither is a major obstacle, but both are friction that exists because of a keyword that is not solving a real problem in application code.

**When sealing does make sense in application code.** Some classes genuinely should not be inherited because their correctness depends on controlling all behavior. A class that manages a resource like a database connection pool or a thread-safe cache may rely on specific method execution order or internal state transitions that a subclass could disrupt. Sealing these types is a genuine safety measure, not just a style preference.

```csharp
// Sealing makes sense here: the pool manages internal state
// that subclasses could corrupt
public sealed class ConnectionPool
{
    private readonly ConcurrentBag<DbConnection> _connections = new();

    public DbConnection Acquire() { /* ... */ }
    public void Release(DbConnection connection) { /* ... */ }
}

// Sealing adds nothing here: it's a plain data class
// that nobody would have a reason to inherit from anyway
public sealed class CustomerDto  // the 'sealed' is not wrong, just pointless
{
    public int Id { get; set; }
    public string Name { get; set; }
}
```

The honest answer is that `sealed` is rarely necessary in application code. Reserve it for types where inheritance would genuinely break correctness rather than applying it as a blanket policy.

## Abstract Classes

Cannot be instantiated; provide base for derived classes.

```csharp
public abstract class Shape
{
    public string Color { get; set; }

    // Abstract method - must be implemented
    public abstract double CalculateArea();

    // Virtual method - can be overridden
    public virtual void Draw()
    {
        Console.WriteLine($"Drawing {Color} shape");
    }

    // Regular method - inherited as-is
    public void Describe()
    {
        Console.WriteLine($"A {Color} shape with area {CalculateArea()}");
    }
}

public class Circle : Shape
{
    public double Radius { get; set; }

    public override double CalculateArea() =>
        Math.PI * Radius * Radius;

    public override void Draw()
    {
        base.Draw();  // Call base implementation
        Console.WriteLine($"Circle with radius {Radius}");
    }
}
```

## Partial Classes

The `partial` keyword lets you split a single class definition across multiple files. The compiler merges them into one type at build time, so the runtime sees no difference between a partial class and a regular one.

```csharp
// Customer.cs
public partial class Customer
{
    public int Id { get; set; }
    public string Name { get; set; }
}

// Customer.Generated.cs (tool-generated code)
public partial class Customer
{
    public bool IsValid() =>
        Id > 0 && !string.IsNullOrEmpty(Name);
}
```

**The legitimate use case: separating hand-written code from generated code.** Partial classes exist primarily to solve the code generation problem. Tools like Entity Framework, WinForms designers, source generators, and gRPC produce code that belongs to a class you also need to extend with your own logic. Without partial classes, you would have to either edit the generated file (which gets overwritten on the next generation) or resort to inheritance just to add members. Partial classes let the tool own one file and the developer own another, both contributing to the same type without conflict.

```csharp
// Customer.cs - your code, never touched by the generator
public partial class Customer
{
    public string FullName => $"{FirstName} {LastName}";
    public bool IsPreferred => TotalOrders > 100;
}

// Customer.Generated.cs - produced by EF scaffold, source generator, etc.
// Regenerated freely without overwriting your code
public partial class Customer
{
    public int Id { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public int TotalOrders { get; set; }
}
```

This is the scenario partial classes were designed for, and it works well.

**The problem: using partial classes to manage complexity.** When a class grows large enough that developers feel the need to split it across files for readability, the real issue is not file length. It is that the class has too many responsibilities. Splitting `Customer` into `Customer.cs`, `Customer.Validation.cs`, `Customer.Persistence.cs`, and `Customer.Formatting.cs` does not reduce complexity. It distributes it across files while keeping all the coupling intact. Every partial file still shares the same private fields, the same state, and the same implicit dependencies. The class is just as hard to reason about, but now you also have to check multiple files to understand it.

```csharp
// This looks organized, but it's a single class with four responsibilities
// Customer.cs           - properties and constructors
// Customer.Validation.cs - validation methods
// Customer.Persistence.cs - Save(), Load(), Delete()
// Customer.Formatting.cs  - ToString(), ToJson(), ToCsv()

// All four files share private fields and can mutate the same state.
// The "separation" is cosmetic. The coupling is identical to one big file.
```

If a class needs validation, persistence, and formatting, those are three separate concerns that should be three separate types. A `CustomerValidator`, a `CustomerRepository`, and a `CustomerFormatter` each have a single responsibility, can be tested independently, and make their dependencies explicit through their constructors. Partial classes hide the fact that the original `Customer` class was doing too much by making the file size feel manageable while leaving the design problem untouched.

**When partial classes are appropriate**:
- Separating hand-written code from tool-generated code (EF models, source generators, WinForms designers, gRPC stubs)
- Partial methods, where a generated file declares a method signature and the developer optionally provides the implementation

**When partial classes are masking a design problem**:
- Splitting a class across files because it is "too long." The length is a symptom; the multiple responsibilities are the disease.
- Organizing a class by concern (validation in one file, persistence in another). If you can name distinct concerns, they should be distinct types.
- Making a class feel smaller without actually reducing its coupling or complexity

## Static Classes

A static class cannot be instantiated, cannot be inherited, and can only contain static members. The compiler enforces all three constraints, making this a deliberate design choice rather than a convention.

```csharp
public static class MathHelper
{
    public const double Pi = 3.14159265358979;

    public static double Square(double x) => x * x;

    public static double Cube(double x) => x * x * x;

    public static bool IsEven(int n) => n % 2 == 0;
}

double area = MathHelper.Pi * MathHelper.Square(radius);
```

The intended purpose is to group pure functions and constants that have no meaningful instance state. `Math.Max`, `Path.Combine`, and `Convert.ToInt32` all take input, produce output, and depend on no object's state. There is no reason to create an instance of `Math` because none of its methods would benefit from one.

### When Static Classes Are Appropriate

**Pure utility functions.** Methods with no side effects where the same inputs always produce the same output. String formatting, math operations, validation predicates, and type conversions all qualify.

**Constants.** A static class can serve as a named container for related constants, replacing scattered magic numbers with readable names.

**Extension methods.** The compiler requires extension methods to live in a non-nested, non-generic static class, so there is no alternative. This is the most common use of static classes in application code.

```csharp
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= maxLength ? value : value[..maxLength] + "...";
    }
}

var preview = longDescription.Truncate(100);
```

### When Static Classes Become a Problem

**Hiding dependencies.** The most damaging misuse is using static classes to provide services that should be injected. When a class calls `DatabaseHelper.GetConnection()` directly, that dependency is invisible in the constructor, invisible in the type signature, and unreplaceable in tests.

```csharp
// Hidden dependency: where does the connection come from?
public class OrderService
{
    public Order GetOrder(int id)
    {
        var conn = DatabaseHelper.GetConnection();
        return conn.Query<Order>("SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
    }
}

// Explicit dependency: visible, testable, configurable
public class OrderService(IDbConnection connection)
{
    public Order GetOrder(int id) =>
        connection.Query<Order>("SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
}
```

**Accumulating global state.** Static fields live for the lifetime of the application domain. A static class that starts with helper methods can gradually acquire static fields for caching or configuration, creating global mutable state that every caller shares. This introduces concurrency bugs and order-of-operation dependencies that are difficult to diagnose. If a method needs cached data, the cache should be an injected dependency with explicit lifetime management.

**Growing into a dumping ground.** Utility classes attract unrelated methods over time. `StringHelper` starts with `Truncate` and `ToTitleCase`, then acquires `FormatCurrency`, `ParseCsvLine`, and eventually thirty methods spanning unrelated concerns. When this happens, split into focused classes like `CsvParser` and `CurrencyFormatter`.

### Static Classes vs. Singleton vs. Dependency Injection

When developers reach for a static class to hold service-like behavior, they are trying to solve "I need one of these, accessible everywhere." A static class makes the dependency invisible and untestable. A singleton makes it visible through `Instance` but hard-couples to the concrete type. Dependency injection makes it visible, replaceable, and testable.

```csharp
Logger.Log("Order processed");           // Static: invisible, untestable
Logger.Instance.Log("Order processed");  // Singleton: visible, hard-coupled

public class OrderProcessor(ILogger logger)  // DI: visible, replaceable
{
    public void Process(Order order) =>
        logger.LogInformation("Order processed");
}
```

For services with side effects like logging, email, or database access, dependency injection is the right answer. Static classes should be reserved for stateless operations that have no reason to vary between environments or tests.

## Nested Classes

A nested class is a class defined inside another class. The outer class acts as a namespace, and a `private` nested class is invisible to everything outside.

```csharp
public class LinkedList<T>
{
    private Node? head;

    public void Add(T value)
    {
        var newNode = new Node(value);
        newNode.Next = head;
        head = newNode;
    }

    private class Node
    {
        public T Value { get; }
        public Node? Next { get; set; }

        public Node(T value) => Value = value;
    }
}
```

The textbook justification is encapsulation: `Node` is an implementation detail of `LinkedList<T>`, so hiding it prevents external code from depending on it. This sounds reasonable in isolation, but it is worth questioning whether hiding a type actually serves the same purpose as hiding a function.

A local function inside a method is genuinely private to that method's execution. It cannot be tested independently, but it also does not need to be because it is a few lines of logic inlined into a single call site. A nested class is different. It is a full type with its own fields, properties, and methods. It can grow, accumulate behavior, and develop bugs. The moment you want to unit test `Node` independently, or reuse it in a second data structure, or reference it from a configuration or serialization context, the nesting becomes an obstacle you have to undo.

In practice, types that start as "pure implementation details" rarely stay that way. A `Node` might need to be exposed for custom iterators. An `Order.LineItem` that seemed tightly coupled to `Order` gets referenced by invoicing, reporting, and shipping code. A private `Builder` nested inside a complex object eventually needs to be shared with a test fixture. Each time this happens, you either make the nested class public (which raises the question of why it is nested at all) or extract it to its own file (a refactoring that touches every call site).

**Public nested classes have a weaker justification.** `Order.LineItem` reads nicely, but the namespacing benefit is cosmetic. A top-level `OrderLineItem` class conveys the same relationship without forcing consumers to navigate through `Order` to reach it. The nesting also means that `LineItem` cannot be used in a `using` import or referenced without qualification, which adds friction as usage spreads.

```csharp
// Nested: reads well initially, creates friction as usage grows
var item = new Order.LineItem { ProductName = "Widget" };

// Top-level: same clarity, no nesting dependency
var item = new OrderLineItem { ProductName = "Widget" };
```

**Where nesting survives scrutiny.** The .NET base class library uses nested types in a few specific patterns. `List<T>.Enumerator` is a `readonly struct` nested inside `List<T>` because it is a performance-critical implementation detail that consumers should never instantiate directly; they interact with it through `IEnumerator<T>`. Source generators and compiler-generated code use nested types because the generated code must coexist with user code without name collisions. These are infrastructure-level concerns, not typical application patterns.

For application code, default to top-level types. If you find yourself nesting a class, ask whether it will genuinely remain private to the outer type for the life of the codebase. If there is any chance it will be tested, shared, or referenced independently, save yourself the future refactoring and put it in its own file from the start.
## Key Takeaways

**Default to classes**: Use classes for most types. Use structs only for small, immutable value objects.

**Prefer immutability**: Use `init` setters, readonly structs, and records to create types that can't be accidentally modified.

**Use records for immutable outputs, not mutable data**: Records shine for computed results, event payloads, and snapshots that are produced once and never edited. For data that gets built up or modified during a workflow, a mutable class is simpler.

**Seal classes when inheritance would break correctness**: In library code, seal aggressively to protect invariants from unknown consumers. In application code, seal only types where subclassing would genuinely corrupt internal state, not as a blanket policy.

**Keep structs small**: The copy-on-assignment semantics of structs make large structs expensive to pass around.
