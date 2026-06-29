---
title: "Structural Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "Structural design patterns including Adapter, Bridge, Composite, Decorator, Facade, Flyweight, and Proxy for flexible object composition."
tags: [oop, design-patterns, structural-patterns, adapter, decorator, practical]
---

---

*Structural patterns from the Gang of Four's "Design Patterns" (1994): Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides*

## Adapter Pattern

**Purpose**: Allow incompatible interfaces to work together by wrapping existing functionality.

```csharp
// Legacy class we cannot modify
public class LegacyRectangle
{
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }

    public void LegacyDraw()
    {
        Console.WriteLine($"Drawing rectangle at ({X},{Y}) with size {Width}x{Height}");
    }
}

// Modern interface we want to use
public interface IShape
{
    void Draw();
    void Move(int x, int y);
    void Resize(int width, int height);
}

// Adapter that makes LegacyRectangle work with IShape
public class RectangleAdapter : IShape
{
    private readonly LegacyRectangle legacyRectangle;

    public RectangleAdapter(LegacyRectangle legacyRectangle)
    {
        this.legacyRectangle = legacyRectangle;
    }

    public void Draw()
    {
        legacyRectangle.LegacyDraw();
    }

    public void Move(int x, int y)
    {
        legacyRectangle.X = x;
        legacyRectangle.Y = y;
    }

    public void Resize(int width, int height)
    {
        legacyRectangle.Width = width;
        legacyRectangle.Height = height;
    }
}

// Usage:
var legacyRect = new LegacyRectangle { X = 10, Y = 20, Width = 100, Height = 50 };
IShape shape = new RectangleAdapter(legacyRect);
shape.Draw();
shape.Move(30, 40);
```

## Bridge Pattern

<div class="callout callout--note">
<p class="callout__title">Purpose: Avoid Cartesian Product Explosion</p>
<p>Bridge pattern separates abstraction from implementation to avoid creating N × M classes when you have N abstractions and M implementations.</p>
</div>

**Purpose**: Separate abstraction from implementation to avoid Cartesian product complexity.

```csharp
// Implementation interface
public interface IRenderer
{
    void RenderCircle(float radius);
    void RenderRectangle(float width, float height);
}

// Concrete implementations
public class PixelRenderer : IRenderer
{
    public void RenderCircle(float radius)
    {
        Console.WriteLine($"Drawing pixels for circle with radius {radius}");
    }

    public void RenderRectangle(float width, float height)
    {
        Console.WriteLine($"Drawing pixels for rectangle {width}x{height}");
    }
}

public class VectorRenderer : IRenderer
{
    public void RenderCircle(float radius)
    {
        Console.WriteLine($"Drawing circle vector with radius {radius}");
    }

    public void RenderRectangle(float width, float height)
    {
        Console.WriteLine($"Drawing rectangle vector {width}x{height}");
    }
}

// Abstraction
public abstract class Shape
{
    protected IRenderer renderer;

    protected Shape(IRenderer renderer)
    {
        this.renderer = renderer;
    }

    public abstract void Draw();
}

// Refined abstractions
public class Circle : Shape
{
    private float radius;

    public Circle(IRenderer renderer, float radius) : base(renderer)
    {
        this.radius = radius;
    }

    public override void Draw()
    {
        renderer.RenderCircle(radius);
    }
}

public class Rectangle : Shape
{
    private float width, height;

    public Rectangle(IRenderer renderer, float width, float height) : base(renderer)
    {
        this.width = width;
        this.height = height;
    }

    public override void Draw()
    {
        renderer.RenderRectangle(width, height);
    }
}

// Usage:
IRenderer pixelRenderer = new PixelRenderer();
IRenderer vectorRenderer = new VectorRenderer();

var shapes = new Shape[]
{
    new Circle(pixelRenderer, 5),
    new Rectangle(vectorRenderer, 10, 15),
    new Circle(vectorRenderer, 3)
};

foreach (var shape in shapes)
{
    shape.Draw();
}
```

## Composite Pattern

**Purpose**: Treat individual objects and collections uniformly through a common interface.

```csharp
public abstract class GraphicObject
{
    public virtual string Name { get; set; } = "Group";
    public string Color { get; set; }

    private readonly Lazy<List<GraphicObject>> children = new(() => new List<GraphicObject>());
    public List<GraphicObject> Children => children.Value;

    public virtual void Draw()
    {
        Draw(0);
    }

    protected virtual void Draw(int depth)
    {
        Console.WriteLine($"{new string(' ', depth * 2)}{Name} (Color: {Color})");
        foreach (var child in Children)
        {
            child.Draw(depth + 1);
        }
    }
}

public class Circle : GraphicObject
{
    public override string Name { get; set; } = "Circle";
}

public class Square : GraphicObject
{
    public override string Name { get; set; } = "Square";
}

// Modern approach using IEnumerable for extension methods
public class GraphicGroup : IEnumerable<GraphicObject>
{
    private readonly List<GraphicObject> objects = new();
    public string Name { get; set; } = "Group";

    public void Add(GraphicObject obj) => objects.Add(obj);
    public void Remove(GraphicObject obj) => objects.Remove(obj);

    public IEnumerator<GraphicObject> GetEnumerator() => objects.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// Extension methods for operations on composites
public static class GraphicExtensions
{
    public static void DrawAll(this IEnumerable<GraphicObject> graphics)
    {
        foreach (var graphic in graphics)
        {
            graphic.Draw();
        }
    }

    public static void SetColor(this IEnumerable<GraphicObject> graphics, string color)
    {
        foreach (var graphic in graphics)
        {
            graphic.Color = color;
        }
    }
}

// Usage:
var drawing = new GraphicObject { Name = "My Drawing" };
drawing.Children.Add(new Square { Color = "Red" });
drawing.Children.Add(new Circle { Color = "Yellow" });

var group = new GraphicObject { Name = "Group 1" };
group.Children.Add(new Circle { Color = "Blue" });
group.Children.Add(new Square { Color = "Green" });

drawing.Children.Add(group);
drawing.Draw();
```

## Decorator Pattern

**Purpose**: Add behavior to objects dynamically without altering their structure.

```csharp
// Component interface
public interface ICoffee
{
    string GetDescription();
    decimal GetCost();
}

// Concrete component
public class SimpleCoffee : ICoffee
{
    public string GetDescription() => "Simple coffee";
    public decimal GetCost() => 2.00m;
}

// Base decorator
public abstract class CoffeeDecorator : ICoffee
{
    protected ICoffee coffee;

    protected CoffeeDecorator(ICoffee coffee)
    {
        this.coffee = coffee;
    }

    public virtual string GetDescription() => coffee.GetDescription();
    public virtual decimal GetCost() => coffee.GetCost();
}

// Concrete decorators
public class MilkDecorator : CoffeeDecorator
{
    public MilkDecorator(ICoffee coffee) : base(coffee) { }

    public override string GetDescription() => $"{coffee.GetDescription()}, milk";
    public override decimal GetCost() => coffee.GetCost() + 0.50m;
}

public class SugarDecorator : CoffeeDecorator
{
    public SugarDecorator(ICoffee coffee) : base(coffee) { }

    public override string GetDescription() => $"{coffee.GetDescription()}, sugar";
    public override decimal GetCost() => coffee.GetCost() + 0.25m;
}

public class WhipDecorator : CoffeeDecorator
{
    public WhipDecorator(ICoffee coffee) : base(coffee) { }

    public override string GetDescription() => $"{coffee.GetDescription()}, whip";
    public override decimal GetCost() => coffee.GetCost() + 0.75m;
}

// Usage:
ICoffee coffee = new SimpleCoffee();
coffee = new MilkDecorator(coffee);
coffee = new SugarDecorator(coffee);
coffee = new WhipDecorator(coffee);

Console.WriteLine($"{coffee.GetDescription()} costs ${coffee.GetCost()}");
// Output: Simple coffee, milk, sugar, whip costs $3.50
```

**Modern Functional Approach**
```csharp
public static class CoffeeExtensions
{
    public static ICoffee WithMilk(this ICoffee coffee) => new MilkDecorator(coffee);
    public static ICoffee WithSugar(this ICoffee coffee) => new SugarDecorator(coffee);
    public static ICoffee WithWhip(this ICoffee coffee) => new WhipDecorator(coffee);
}

// Fluent usage:
var coffee = new SimpleCoffee()
    .WithMilk()
    .WithSugar()
    .WithWhip();
```

## Facade Pattern

**Purpose**: Provide a simplified interface to complex subsystems.

```csharp
// Complex subsystem classes
public class CPU
{
    public void Freeze() => Console.WriteLine("CPU: Freezing processor");
    public void Jump(long position) => Console.WriteLine($"CPU: Jumping to position {position}");
    public void Execute() => Console.WriteLine("CPU: Executing instructions");
}

public class Memory
{
    public void Load(long position, byte[] data) =>
        Console.WriteLine($"Memory: Loading {data.Length} bytes at position {position}");
}

public class HardDrive
{
    public byte[] Read(long lba, int size)
    {
        Console.WriteLine($"HardDrive: Reading {size} bytes from sector {lba}");
        return new byte[size];
    }
}

// Facade
public class ComputerFacade
{
    private readonly CPU cpu;
    private readonly Memory memory;
    private readonly HardDrive hardDrive;

    public ComputerFacade()
    {
        cpu = new CPU();
        memory = new Memory();
        hardDrive = new HardDrive();
    }

    public void StartComputer()
    {
        Console.WriteLine("Starting computer...");
        cpu.Freeze();
        memory.Load(0, hardDrive.Read(0, 1024));
        cpu.Jump(0);
        cpu.Execute();
        Console.WriteLine("Computer started successfully!");
    }
}

// Usage:
var computer = new ComputerFacade();
computer.StartComputer(); // Simple interface hiding complex operations
```

## Flyweight Pattern

**Purpose**: Minimize memory usage by sharing efficiently common data among multiple objects.

```csharp
// Intrinsic state (shared)
public class CharacterFlyweight
{
    private readonly char character;
    private readonly string fontFamily;
    private readonly int fontSize;

    public CharacterFlyweight(char character, string fontFamily, int fontSize)
    {
        this.character = character;
        this.fontFamily = fontFamily;
        this.fontSize = fontSize;
    }

    // Operation that uses both intrinsic and extrinsic state
    public void Display(int x, int y, string color) // x, y, color are extrinsic
    {
        Console.WriteLine($"Character: {character}, Font: {fontFamily}, Size: {fontSize}, Position: ({x},{y}), Color: {color}");
    }
}

// Flyweight factory
public class CharacterFlyweightFactory
{
    private static readonly Dictionary<string, CharacterFlyweight> flyweights = new();

    public static CharacterFlyweight GetFlyweight(char character, string fontFamily, int fontSize)
    {
        string key = $"{character}_{fontFamily}_{fontSize}";

        if (!flyweights.ContainsKey(key))
        {
            flyweights[key] = new CharacterFlyweight(character, fontFamily, fontSize);
            Console.WriteLine($"Created new flyweight for: {key}");
        }

        return flyweights[key];
    }

    public static int GetFlyweightCount() => flyweights.Count;
}

// Context that uses flyweights
public class TextDocument
{
    private readonly List<(CharacterFlyweight flyweight, int x, int y, string color)> characters = new();

    public void AddCharacter(char c, string fontFamily, int fontSize, int x, int y, string color)
    {
        var flyweight = CharacterFlyweightFactory.GetFlyweight(c, fontFamily, fontSize);
        characters.Add((flyweight, x, y, color));
    }

    public void Display()
    {
        foreach (var (flyweight, x, y, color) in characters)
        {
            flyweight.Display(x, y, color);
        }
    }
}

// Usage:
var document = new TextDocument();

// Even though we're adding many characters, only unique combinations create flyweights
document.AddCharacter('H', "Arial", 12, 0, 0, "Black");
document.AddCharacter('e', "Arial", 12, 10, 0, "Black");
document.AddCharacter('l', "Arial", 12, 20, 0, "Black");
document.AddCharacter('l', "Arial", 12, 30, 0, "Black"); // Reuses existing flyweight
document.AddCharacter('o', "Arial", 12, 40, 0, "Black");

Console.WriteLine($"Total flyweights created: {CharacterFlyweightFactory.GetFlyweightCount()}");
document.Display();
```

## Proxy Pattern

**Purpose**: Control access to objects through a surrogate or placeholder.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Protection Proxy</h4>
<p>Controls access based on permissions or conditions. Validates access rights before delegating to real object.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Virtual Proxy</h4>
<p>Delays expensive object creation until actually needed. Creates real object only on first use (lazy loading).</p>
</div>
</div>

**Protection Proxy**
```csharp
public interface ICar
{
    void Drive();
}

public class Car : ICar
{
    public void Drive()
    {
        Console.WriteLine("Car is being driven");
    }
}

public class CarProxy : ICar
{
    private readonly Car car;
    private readonly Driver driver;

    public CarProxy(Car car, Driver driver)
    {
        this.car = car;
        this.driver = driver;
    }

    public void Drive()
    {
        if (driver.Age >= 16)
        {
            car.Drive();
        }
        else
        {
            Console.WriteLine("Driver too young to drive");
        }
    }
}

public class Driver
{
    public int Age { get; set; }
}

// Usage:
var car = new Car();
var youngDriver = new Driver { Age = 15 };
var carProxy = new CarProxy(car, youngDriver);
carProxy.Drive(); // "Driver too young to drive"
```

**Virtual Proxy (Lazy Loading)**
```csharp
public interface IExpensiveObject
{
    void Process();
}

public class ExpensiveObject : IExpensiveObject
{
    public ExpensiveObject()
    {
        // Simulate expensive initialization
        Console.WriteLine("ExpensiveObject created with heavy initialization");
        Thread.Sleep(1000);
    }

    public void Process()
    {
        Console.WriteLine("Processing with ExpensiveObject");
    }
}

public class ExpensiveObjectProxy : IExpensiveObject
{
    private ExpensiveObject expensiveObject;

    public void Process()
    {
        // Lazy initialization - object created only when needed
        if (expensiveObject == null)
        {
            Console.WriteLine("Creating ExpensiveObject on first use...");
            expensiveObject = new ExpensiveObject();
        }

        expensiveObject.Process();
    }
}

// Usage:
IExpensiveObject proxy = new ExpensiveObjectProxy();
// No expensive object created yet
Console.WriteLine("Proxy created");
// Object is created only when Process is called
proxy.Process();
```

**Caching Proxy**
```csharp
public interface IDataService
{
    Task<string> GetData(string key);
}

public class DatabaseService : IDataService
{
    public async Task<string> GetData(string key)
    {
        // Simulate database call
        Console.WriteLine($"Fetching data from database for key: {key}");
        await Task.Delay(1000);
        return $"Data for {key}";
    }
}

public class CachingProxy : IDataService
{
    private readonly IDataService dataService;
    private readonly Dictionary<string, string> cache = new();

    public CachingProxy(IDataService dataService)
    {
        this.dataService = dataService;
    }

    public async Task<string> GetData(string key)
    {
        if (cache.TryGetValue(key, out var cachedData))
        {
            Console.WriteLine($"Returning cached data for key: {key}");
            return cachedData;
        }

        var data = await dataService.GetData(key);
        cache[key] = data;
        return data;
    }
}

// Usage:
IDataService dataService = new DatabaseService();
IDataService proxy = new CachingProxy(dataService);

var data1 = await proxy.GetData("user123"); // Database call
var data2 = await proxy.GetData("user123"); // Cache hit
```

## Quick Reference

### Structural Pattern Comparison

| Pattern | Intent | Problem Solved | When to Use | When to Avoid |
|---------|--------|----------------|-------------|---------------|
| **Adapter** | Make incompatible interfaces compatible | Legacy code integration, third-party library mismatch | Wrapping existing classes with incompatible interfaces | You control both interfaces (fix design) |
| **Bridge** | Separate abstraction from implementation | Cartesian product explosion (N × M classes) | Multiple dimensions of variation | Single dimension of variation |
| **Composite** | Treat individual and composite objects uniformly | Tree structures, hierarchies | File systems, UI components, organizational charts | Flat structures |
| **Decorator** | Add behavior dynamically without subclassing | Static inheritance limitations | Runtime behavior modification, multiple combinations | Behavior known at compile time |
| **Facade** | Simplify complex subsystem interfaces | Too many dependencies, complex APIs | Hide complexity, reduce coupling | Subsystem is already simple |
| **Flyweight** | Share common state to reduce memory | Memory constraints with many similar objects | Large number of fine-grained objects | Few objects or mostly unique state |
| **Proxy** | Control access to objects | Expensive object creation, access control | Lazy loading, caching, access control, logging | Direct access is simpler |

### Pattern Selection Guide

**Choose Adapter when:**
- Integrating legacy code
- Working with third-party libraries with incompatible interfaces
- Example: Adapting legacy data access to modern repository pattern

**Choose Bridge when:**
- Abstraction and implementation vary independently
- Avoiding N × M class explosion
- Example: Shapes (Circle, Square) × Renderers (Vector, Raster)

**Choose Composite when:**
- Building tree structures
- Treating individual and groups uniformly
- Example: File system (files and folders), UI components (controls and panels)

**Choose Decorator when:**
- Need to add responsibilities dynamically
- Subclassing is impractical (too many combinations)
- Example: Stream decorators (BufferedStream, GZipStream), middleware pipeline

**Choose Facade when:**
- Simplifying a complex subsystem
- Decoupling clients from subsystem components
- Example: Library initialization, complex API simplification

**Choose Flyweight when:**
- Application uses many similar objects
- Memory is a concern
- Extrinsic state can be separated from intrinsic state
- Example: Text editors (character rendering), game objects (particles)

**Choose Proxy when:**
- Lazy initialization needed
- Access control required
- Caching results
- Example: ORM lazy loading, image loading, remote service calls

### Modern C# Examples

```csharp
// Adapter - Common with third-party libraries
public class LegacySystemAdapter : IModernInterface
{
    private readonly LegacySystem legacy = new();

    public void ModernMethod()
    {
        legacy.OldMethod();
    }
}

// Bridge - Separate concerns
public abstract class DataSource
{
    protected IDataRenderer renderer;
    protected DataSource(IDataRenderer renderer) => this.renderer = renderer;
}

// Composite - ASP.NET Core middleware
public class CompositeMiddleware
{
    private readonly List<RequestDelegate> middlewares = new();

    public void Add(RequestDelegate middleware) => middlewares.Add(middleware);

    public async Task Invoke(HttpContext context)
    {
        foreach (var middleware in middlewares)
        {
            await middleware(context);
        }
    }
}

// Decorator - Extension methods act as lightweight decorators
public static class StringExtensions
{
    public static string ToTitleCase(this string str) => /* ... */;
    public static string Truncate(this string str, int length) => /* ... */;
}

// Facade - Simplify complex operations
public class OrderProcessingFacade
{
    private readonly IInventoryService inventory;
    private readonly IPaymentService payment;
    private readonly IShippingService shipping;
    private readonly INotificationService notification;

    public async Task ProcessOrder(Order order)
    {
        await inventory.Reserve(order.Items);
        await payment.Process(order.Total);
        await shipping.Schedule(order);
        await notification.SendConfirmation(order.CustomerEmail);
    }
}

// Proxy - Entity Framework lazy loading
public class Order
{
    public virtual ICollection<OrderItem> Items { get; set; } // Proxy created on access
}
```

### Anti-Patterns to Avoid

**Over-Decoration**:
```csharp
// BAD: Too many decorators make code hard to understand
var stream = new BufferedStream(
    new GZipStream(
        new CryptoStream(
            new FileStream("data.txt", FileMode.Open),
            encryptor, CryptoStreamMode.Write),
        CompressionMode.Compress));

// BETTER: Create a facade or pipeline builder
var stream = new StreamBuilder()
    .WithFile("data.txt")
    .WithEncryption(encryptor)
    .WithCompression()
    .WithBuffering()
    .Build();
```

**Leaky Facade**:
```csharp
// BAD: Facade exposes internal complexity
public class PaymentFacade
{
    public CreditCardProcessor GetCreditCardProcessor() { } // Leaking internals
    public PayPalGateway GetPayPalGateway() { }
}

// GOOD: Hide implementation details
public class PaymentFacade
{
    public Task<PaymentResult> ProcessPayment(PaymentMethod method, decimal amount) { }
}
```

---