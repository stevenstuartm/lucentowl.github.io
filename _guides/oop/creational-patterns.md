---
title: "Creational Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "Creational design patterns including Builder, Factory Method, Abstract Factory, Singleton, and Prototype with modern C# implementations and best practices."
tags: [oop, design-patterns, creational-patterns, factory, singleton, practical]
---

---

*Design patterns from "Design Patterns: Elements of Reusable Object-Oriented Software" by the Gang of Four (Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides), published 1994*

**Historical note**: While the Gang of Four catalog formalized these patterns, many existed in practice before 1994. The patterns book itself was inspired by Christopher Alexander's "A Pattern Language" (1977) for architecture.

## Builder Pattern

**Purpose**: Construct complex objects step by step, separating construction from representation.

**Modern Variations**:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Fluent Builder</h4>
<p>Method chaining with return of builder instance. Flexible and readable, allowing optional parameters in any order.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Stepwise Builder</h4>
<p>Enforces construction order through interfaces. Compile-time safety ensuring all required parameters are set.</p>
</div>
</div>

**Fluent Builder**
```csharp
public class HtmlElement
{
    public string TagName { get; set; }
    public string Content { get; set; }
    public Dictionary<string, string> Attributes { get; set; } = new();
    public List<HtmlElement> Children { get; set; } = new();
}

public class HtmlBuilder
{
    private readonly HtmlElement element = new();

    public HtmlBuilder SetTag(string tagName)
    {
        element.TagName = tagName;
        return this;
    }

    public HtmlBuilder AddClass(string className)
    {
        element.Attributes["class"] = element.Attributes.ContainsKey("class")
            ? $"{element.Attributes["class"]} {className}"
            : className;
        return this;
    }

    public HtmlBuilder AddContent(string content)
    {
        element.Content = content;
        return this;
    }

    public HtmlElement Build() => element;
}

// Usage:
var html = new HtmlBuilder()
    .SetTag("div")
    .AddClass("container")
    .AddContent("Hello World")
    .Build();
```

**Stepwise Builder**
```csharp
public interface ICarType
{
    IWheelSize OfType(string carType);
}

public interface IWheelSize
{
    IBuildable WithWheels(int wheelSize);
}

public interface IBuildable
{
    Car Build();
}

public class CarBuilder : ICarType, IWheelSize, IBuildable
{
    private readonly Car car = new();

    public static ICarType Create() => new CarBuilder();

    public IWheelSize OfType(string carType)
    {
        car.Type = carType;
        return this;
    }

    public IBuildable WithWheels(int wheelSize)
    {
        car.WheelSize = wheelSize;
        return this;
    }

    public Car Build() => car;
}

// Usage: CarBuilder.Create().OfType("SUV").WithWheels(18).Build()
```

**Functional Builder**
```csharp
public class PersonBuilder
{
    private readonly List<Action<Person>> actions = new();

    public PersonBuilder Called(string name)
    {
        actions.Add(p => p.Name = name);
        return this;
    }

    public PersonBuilder WorksAs(string position)
    {
        actions.Add(p => p.Position = position);
        return this;
    }

    public PersonBuilder Earning(decimal salary)
    {
        actions.Add(p => p.Salary = salary);
        return this;
    }

    public Person Build()
    {
        var person = new Person();
        actions.ForEach(a => a(person));
        return person;
    }
}

// Usage:
var person = new PersonBuilder()
    .Called("John")
    .WorksAs("Developer")
    .Earning(75000)
    .Build();
```

## Factory Patterns

**Factory Method**
```csharp
public class Person
{
    public string Name { get; set; }
    public string Role { get; set; }
    public decimal Salary { get; set; }

    private Person() { } // Private constructor

    public static Person NewCustomer(string name)
    {
        return new Person { Name = name, Role = "Customer", Salary = 0 };
    }

    public static Person NewEmployee(string name, decimal salary)
    {
        return new Person { Name = name, Role = "Employee", Salary = salary };
    }
}

// Usage:
var customer = Person.NewCustomer("Alice");
var employee = Person.NewEmployee("Bob", 50000);
```

**Abstract Factory**
```csharp
// Abstract products
public interface IButton
{
    void Render();
}

public interface ICheckbox
{
    void Render();
}

// Concrete products for Windows
public class WindowsButton : IButton
{
    public void Render() => Console.WriteLine("Rendering Windows button");
}

public class WindowsCheckbox : ICheckbox
{
    public void Render() => Console.WriteLine("Rendering Windows checkbox");
}

// Concrete products for Mac
public class MacButton : IButton
{
    public void Render() => Console.WriteLine("Rendering Mac button");
}

public class MacCheckbox : ICheckbox
{
    public void Render() => Console.WriteLine("Rendering Mac checkbox");
}

// Abstract factory
public interface IUIFactory
{
    IButton CreateButton();
    ICheckbox CreateCheckbox();
}

// Concrete factories
public class WindowsUIFactory : IUIFactory
{
    public IButton CreateButton() => new WindowsButton();
    public ICheckbox CreateCheckbox() => new WindowsCheckbox();
}

public class MacUIFactory : IUIFactory
{
    public IButton CreateButton() => new MacButton();
    public ICheckbox CreateCheckbox() => new MacCheckbox();
}

// Usage:
IUIFactory factory = Environment.OSVersion.Platform == PlatformID.Win32NT
    ? new WindowsUIFactory()
    : new MacUIFactory();

var button = factory.CreateButton();
var checkbox = factory.CreateCheckbox();
```

**Async Factory**
```csharp
public class DatabaseConnection
{
    private string connectionString;

    private DatabaseConnection(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public static async Task<DatabaseConnection> CreateAsync(string server, string database)
    {
        // Simulate async connection validation
        await Task.Delay(100);

        var connectionString = $"Server={server};Database={database}";
        var connection = new DatabaseConnection(connectionString);

        // Additional async initialization
        await connection.InitializeAsync();
        return connection;
    }

    private async Task InitializeAsync()
    {
        // Async initialization logic
        await Task.Delay(50);
    }
}

// Usage:
var connection = await DatabaseConnection.CreateAsync("localhost", "MyDB");
```

## Singleton Pattern

*One of the original Gang of Four patterns (1994), but now controversial in modern software development*

<div class="callout callout--warning">
<p class="callout__title">Modern Warning</p>
<p>Traditional singleton implementations are difficult to test and violate dependency inversion. Many consider Singleton an anti-pattern in modern development due to:</p>
<ul>
<li>Global state (hidden dependencies)</li>
<li>Testing difficulties (can't mock easily)</li>
<li>Violates Single Responsibility (manages own lifecycle + business logic)</li>
<li>Thread-safety complexity in some languages</li>
</ul>
<p><strong>Modern consensus</strong>: Use dependency injection with singleton lifetime instead of static Singleton pattern.</p>
</div>

**Traditional Singleton (Avoid)**
```csharp
public sealed class Database
{
    private static readonly Lazy<Database> instance = new(() => new Database());
    public static Database Instance => instance.Value;

    private Database() { }

    public void Query(string sql) { /* implementation */ }
}

// Problem: Hard to test, violates DI
```

**Recommended Approaches**:

**Dependency Injection (Preferred)**
```csharp
public interface IDatabase
{
    void Query(string sql);
}

public class Database : IDatabase
{
    public void Query(string sql) { /* implementation */ }
}

// In Startup.cs or Program.cs
services.AddSingleton<IDatabase, Database>();

// In consuming class
public class UserService
{
    private readonly IDatabase database;

    public UserService(IDatabase database)
    {
        this.database = database;
    }
}
```

**Thread-Safe Lazy Initialization**
```csharp
public class ConfigurationManager
{
    private static readonly Lazy<ConfigurationManager> instance =
        new(() => new ConfigurationManager());

    public static ConfigurationManager Instance => instance.Value;

    private readonly Dictionary<string, string> settings = new();

    private ConfigurationManager()
    {
        LoadConfiguration();
    }

    private void LoadConfiguration()
    {
        // Load from file, database, etc.
    }

    public string GetSetting(string key) => settings.TryGetValue(key, out var value) ? value : "";
}
```

**Alternative Patterns**:

**Per-Thread Singleton**
```csharp
public class ThreadLocalSingleton
{
    private static readonly ThreadLocal<ThreadLocalSingleton> instance =
        new(() => new ThreadLocalSingleton());

    public static ThreadLocalSingleton Instance => instance.Value;

    private ThreadLocalSingleton() { }
}
```

**Ambient Context**
```csharp
public class DatabaseContext : IDisposable
{
    private static readonly Stack<DatabaseContext> contexts = new();

    public static DatabaseContext Current => contexts.Count > 0 ? contexts.Peek() : null;

    public DatabaseContext()
    {
        contexts.Push(this);
    }

    public void Dispose()
    {
        if (contexts.Count > 0 && contexts.Peek() == this)
            contexts.Pop();
    }
}

// Usage:
using (new DatabaseContext())
{
    var current = DatabaseContext.Current; // Gets the current context
    // Nested contexts work automatically
    using (new DatabaseContext())
    {
        var nested = DatabaseContext.Current; // Gets the nested context
    }
    // Back to original context
}
```

## Prototype Pattern

**Purpose**: Create new objects by copying existing instances rather than creating from scratch.

```csharp
public interface IPrototype<T>
{
    T Clone();
}

public class Person : IPrototype<Person>
{
    public string Name { get; set; }
    public int Age { get; set; }
    public Address Address { get; set; }

    // Deep clone implementation
    public Person Clone()
    {
        return new Person
        {
            Name = this.Name,
            Age = this.Age,
            Address = this.Address?.Clone() // Assuming Address also implements IPrototype
        };
    }
}

public class Address : IPrototype<Address>
{
    public string Street { get; set; }
    public string City { get; set; }

    public Address Clone()
    {
        return new Address
        {
            Street = this.Street,
            City = this.City
        };
    }
}

// Modern JSON-based approach (simpler but requires serializable types)
public static class PrototypeHelper
{
    public static T DeepClone<T>(this T source) where T : class
    {
        var serialized = JsonSerializer.Serialize(source);
        return JsonSerializer.Deserialize<T>(serialized);
    }
}

// Usage:
var original = new Person { Name = "John", Age = 30, Address = new Address { Street = "123 Main St", City = "NYC" } };
var clone1 = original.Clone(); // Using interface
var clone2 = original.DeepClone(); // Using JSON serialization
```

## Quick Reference

### Creational Pattern Comparison

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
|---------|--------|----------------|-------------|---------------|
| **Factory Method** | Define object creation interface | Multiple ways to create objects | Subclasses determine which class to instantiate | Simple constructor is sufficient |
| **Abstract Factory** | Create families of related objects | Need consistent object families | Cross-platform UIs, themed components | Only one product family |
| **Builder** | Construct complex objects step-by-step | Objects with many optional parameters | Immutable objects, fluent APIs, complex construction | Simple objects with few properties |
| **Prototype** | Clone existing objects | Expensive object creation | Object templates, reducing initialization cost | Objects are cheap to create |
| **Singleton** | Single instance globally | Shared resource access | Config, logging (**prefer DI instead**) | Almost always (use DI) |

### Pattern Selection Guide

**Choose Factory Method when:**
- You have multiple construction approaches
- Subclasses should decide what to instantiate
- Example: `Person.NewCustomer()`, `Person.NewEmployee()`

**Choose Abstract Factory when:**
- You need families of related objects
- Products must be used together
- Example: UI controls for Windows vs Mac

**Choose Builder when:**
- Object has many optional parameters (>3)
- Object construction is complex
- Creating immutable objects
- Example: Building complex queries, HTML elements

**Choose Prototype when:**
- Object creation is expensive (database loads, complex initialization)
- You need independent copies with similar state
- Example: Cloning configuration templates

**Avoid Singleton when:**
- Testing is important (hard to mock)
- You need multiple instances later
- **Use dependency injection instead**

### Modern C# Alternatives

```csharp
// Instead of Singleton - use DI
services.AddSingleton<IConfigurationManager, ConfigurationManager>();

// Instead of Factory Method - use static factory methods
public static User CreateCustomer(string name) => new User { Name = name, Role = "Customer" };

// Instead of Builder - use object initializers for simple cases
var user = new User
{
    Name = "John",
    Email = "john@example.com",
    Age = 30
};

// Instead of Prototype - use with expressions for records
var clone = original with { Name = "NewName" };
```

---