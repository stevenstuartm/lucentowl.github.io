---
title: "C# Delegates and Events"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Delegates, events, multicast delegates, built-in delegate types, and the event pattern in C#."
tags: [c-sharp, dotnet, fundamentals, delegates, events, functional-programming, practical]
---

## What are Delegates

Delegates are type-safe function pointers. They define a method signature and can hold references to methods matching that signature.

```csharp
// Declare a delegate type
public delegate int MathOperation(int x, int y);

// Methods matching the signature
public static int Add(int a, int b) => a + b;
public static int Multiply(int a, int b) => a * b;

// Use the delegate
MathOperation operation = Add;
int result = operation(5, 3);  // 8

operation = Multiply;
result = operation(5, 3);      // 15
```

## Built-in Delegate Types

.NET provides generic delegate types that cover most use cases.

### Func<T, TResult>

For methods that return a value.

```csharp
// Func<TResult> - no parameters, returns TResult
Func<int> getNumber = () => 42;
int number = getNumber();

// Func<T, TResult> - one parameter
Func<int, int> square = x => x * x;
int squared = square(5);  // 25

// Func<T1, T2, TResult> - two parameters
Func<int, int, int> add = (a, b) => a + b;
int sum = add(3, 4);  // 7

// Up to 16 parameters supported
Func<string, int, bool, string> format =
    (name, age, active) => $"{name}, {age}, {(active ? "active" : "inactive")}";
```

### Action<T>

For methods that return void.

```csharp
// Action - no parameters
Action greet = () => Console.WriteLine("Hello!");
greet();

// Action<T> - one parameter
Action<string> log = message => Console.WriteLine($"[LOG] {message}");
log("Application started");

// Action<T1, T2> - two parameters
Action<string, int> repeat = (text, count) =>
{
    for (int i = 0; i < count; i++)
        Console.WriteLine(text);
};
repeat("Hello", 3);

// Up to 16 parameters supported
```

### Predicate<T>

For methods that return bool (testing a condition).

```csharp
Predicate<int> isPositive = n => n > 0;
bool result = isPositive(5);   // true
bool result2 = isPositive(-3); // false

// Common with collection methods
var numbers = new List<int> { -2, -1, 0, 1, 2 };
var positives = numbers.FindAll(isPositive);  // [1, 2]
bool anyPositive = numbers.Exists(isPositive); // true
```

### Comparison<T>

For sorting comparisons.

```csharp
Comparison<string> byLength = (a, b) => a.Length.CompareTo(b.Length);

var words = new List<string> { "apple", "pie", "banana" };
words.Sort(byLength);  // ["pie", "apple", "banana"]

// Or inline
words.Sort((a, b) => b.Length.CompareTo(a.Length));  // Descending
```

## Lambda Expressions

Concise syntax for creating delegate instances inline.

### Expression Lambdas

Single expression, return inferred.

```csharp
Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;
Func<string, bool> isEmpty = s => string.IsNullOrEmpty(s);

// With explicit types when inference fails
Func<object, string> toString = (object o) => o.ToString() ?? "";
```

### Statement Lambdas

Multiple statements in a block.

```csharp
Func<int, int> factorial = n =>
{
    if (n <= 1) return 1;
    int result = 1;
    for (int i = 2; i <= n; i++)
        result *= i;
    return result;
};

Action<string> logWithTimestamp = message =>
{
    var timestamp = DateTime.Now.ToString("HH:mm:ss");
    Console.WriteLine($"[{timestamp}] {message}");
};
```

### Static Lambdas (C# 9.0)

Prevent accidental capture of variables.

```csharp
int multiplier = 10;

// Regular lambda - captures multiplier
Func<int, int> withCapture = x => x * multiplier;

// Static lambda - cannot capture, compile error if you try
Func<int, int> noCapture = static x => x * 2;
// Func<int, int> error = static x => x * multiplier; // Error!
```

### Discards in Lambdas

Ignore parameters you don't need.

```csharp
// Event handler that ignores sender
button.Click += (_, _) => HandleClick();

// Only need second parameter
Func<int, int, int> second = (_, b) => b;
```

### Natural Types and Attributes (C# 10)

Lambdas can be inferred without explicit delegate types.

```csharp
// Natural type inference - compiler infers Func/Action
var parse = (string s) => int.Parse(s);  // Func<string, int>
var action = () => Console.WriteLine("Hello");  // Action
var predicate = (int n) => n > 0;  // Func<int, bool>

// Explicit return type when needed
var choose = object (bool b) => b ? 1 : "one";

// Attributes on lambdas
var handler = [Authorize] (HttpContext ctx) => HandleRequest(ctx);
var validated = [return: NotNull] (string s) => s.Trim();

// Method group with natural type
var write = Console.WriteLine;  // Action<string>
```

### Default Parameters in Lambdas (C# 12)

```csharp
// Lambda with default parameter
var greet = (string name = "World") => $"Hello, {name}!";
Console.WriteLine(greet());        // "Hello, World!"
Console.WriteLine(greet("Alice")); // "Hello, Alice!"

// Multiple defaults
Func<int, int, int> add = (int a, int b = 10) => a + b;
Console.WriteLine(add(5));     // 15
Console.WriteLine(add(5, 3));  // 8

// params in lambdas
var sum = (params int[] numbers) => numbers.Sum();
Console.WriteLine(sum(1, 2, 3, 4, 5));  // 15
```

## Multicast Delegates

Delegates can hold references to multiple methods.

```csharp
Action<string> log = Console.WriteLine;
log += message => File.AppendAllText("log.txt", message + "\n");
log += message => Debug.WriteLine(message);

// Invokes all three methods
log("Application started");

// Remove a handler
log -= Console.WriteLine;

// Check if empty
if (log != null)
    log("Still logging");

// Get invocation list
foreach (var handler in log.GetInvocationList())
{
    Console.WriteLine(handler.Method.Name);
}
```

### Multicast with Return Values

Only the last method's return value is returned.

```csharp
Func<int> getValue = () => 1;
getValue += () => 2;
getValue += () => 3;

int result = getValue();  // 3 (last one)

// To get all results
var results = getValue.GetInvocationList()
    .Cast<Func<int>>()
    .Select(f => f())
    .ToList();  // [1, 2, 3]
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Use Delegates (Func/Action)</h4>
<ul>
<li>Pass behavior as a parameter (strategies, callbacks, LINQ queries)</li>
<li>The callback is one-to-one: one caller, one handler</li>
<li>The caller should be able to invoke the delegate directly</li>
<li>You're doing functional-style programming</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Use Events</h4>
<ul>
<li>Multiple subscribers may want to respond to something happening</li>
<li>The publisher shouldn't know who's listening (loose coupling)</li>
<li>Only the class that owns the event should be able to raise it</li>
<li>You're implementing the observer/pub-sub pattern</li>
</ul>
</div>
</div>

```csharp
// Delegate as parameter - caller controls when it runs
public void ProcessData(Func<string, bool> filter) { /* ... */ }

// Event - publisher controls when it fires, subscribers just react
public event EventHandler<DataEventArgs> DataReceived;
```

## Events

Events are a way to expose delegate functionality while restricting who can invoke them.

### Basic Event Pattern

```csharp
public class Button
{
    // Declare event using EventHandler
    public event EventHandler? Clicked;

    // Method to raise the event
    public void SimulateClick()
    {
        // Null-safe invocation
        Clicked?.Invoke(this, EventArgs.Empty);
    }
}

// Subscribe to event
var button = new Button();
button.Clicked += (sender, e) => Console.WriteLine("Button clicked!");
button.Clicked += OnButtonClicked;

void OnButtonClicked(object? sender, EventArgs e)
{
    Console.WriteLine("Handler method called");
}

// Unsubscribe
button.Clicked -= OnButtonClicked;

// Trigger event
button.SimulateClick();
```

### Custom Event Arguments

```csharp
// Custom event args
public class OrderEventArgs : EventArgs
{
    public int OrderId { get; }
    public decimal Total { get; }
    public DateTime Timestamp { get; }

    public OrderEventArgs(int orderId, decimal total)
    {
        OrderId = orderId;
        Total = total;
        Timestamp = DateTime.UtcNow;
    }
}

// Publisher
public class OrderService
{
    public event EventHandler<OrderEventArgs>? OrderPlaced;
    public event EventHandler<OrderEventArgs>? OrderShipped;

    public void PlaceOrder(int orderId, decimal total)
    {
        // Process order...
        OnOrderPlaced(new OrderEventArgs(orderId, total));
    }

    protected virtual void OnOrderPlaced(OrderEventArgs e)
    {
        OrderPlaced?.Invoke(this, e);
    }
}

// Subscriber
var service = new OrderService();
service.OrderPlaced += (sender, e) =>
{
    Console.WriteLine($"Order {e.OrderId} placed for ${e.Total}");
};
```

### Event Accessors

The default `event` keyword already generates thread-safe `add`/`remove` accessors using `Interlocked.CompareExchange` (since C# 4.0). Combined with the `?.Invoke()` pattern for raising, standard events handle concurrency correctly out of the box. Custom accessors are for when you need additional behavior beyond subscribe and unsubscribe.

```csharp
public class AuditedPublisher
{
    private readonly List<EventHandler<EventArgs>> handlers = new();
    private readonly int maxSubscribers;

    public AuditedPublisher(int maxSubscribers = 10)
    {
        this.maxSubscribers = maxSubscribers;
    }

    public event EventHandler<EventArgs> DataReceived
    {
        add
        {
            if (handlers.Count >= maxSubscribers)
                throw new InvalidOperationException(
                    $"Cannot exceed {maxSubscribers} subscribers");

            handlers.Add(value);
            Console.WriteLine($"Handler added (total: {handlers.Count})");
        }
        remove
        {
            handlers.Remove(value);
            Console.WriteLine($"Handler removed (total: {handlers.Count})");
        }
    }

    protected void OnDataReceived()
    {
        foreach (var handler in handlers)
            handler.Invoke(this, EventArgs.Empty);
    }
}
```

Custom accessors replace the compiler-generated implementation entirely, so the built-in `Interlocked.CompareExchange` thread safety no longer applies. If the event will be subscribed to or raised from multiple threads, you become responsible for synchronization yourself. In practice this rarely matters because events are typically subscribed during initialization and raised from a single context.

**When you need custom accessors**:

- Logging or auditing subscriptions and unsubscriptions
- Limiting the number of subscribers
- Validating handlers before accepting them
- Forwarding subscriptions to a different underlying event

**When you don't**:

- Thread safety alone is not a reason. The default accessors and `?.Invoke()` already handle that.

## Delegate Patterns

### Delegates as Behavior Parameters

Delegates are well-suited when a method needs the caller to supply a small piece of behavior rather than a result. LINQ is the most common example: `Where`, `Select`, and `OrderBy` all accept delegates that tell the algorithm how to evaluate each element without dictating what happens next.

```csharp
public class Inventory
{
    private readonly List<Product> products = new();

    public IEnumerable<Product> Search(Func<Product, bool> criteria)
    {
        return products.Where(criteria);
    }

    public decimal Aggregate(Func<Product, decimal> selector)
    {
        return products.Sum(selector);
    }
}

// The caller provides the evaluation logic, not the orchestration
var expensiveItems = inventory.Search(p => p.Price > 100m);
var totalWeight = inventory.Aggregate(p => p.Weight);
```

This is distinct from callback-style patterns like `LoadDataAsync(url, onSuccess, onError)`, which were common before `async/await`. In modern C#, `Task<T>` replaces that pattern: the caller awaits a result, exceptions propagate naturally, and orchestration lives in the calling layer where it belongs. If you find yourself passing `Action` or `Action<Exception>` callbacks for flow control, that's usually a sign that the method should return a `Task<T>` instead.

### Strategy Pattern with Delegates

```csharp
public class PriceCalculator
{
    private readonly Func<decimal, decimal> discountStrategy;

    public PriceCalculator(Func<decimal, decimal> discountStrategy)
    {
        this.discountStrategy = discountStrategy;
    }

    public decimal CalculatePrice(decimal basePrice)
    {
        return discountStrategy(basePrice);
    }
}

// Different strategies
Func<decimal, decimal> noDiscount = price => price;
Func<decimal, decimal> tenPercent = price => price * 0.9m;
Func<decimal, decimal> bulkDiscount = price => price > 100 ? price * 0.8m : price;

var calculator = new PriceCalculator(tenPercent);
decimal finalPrice = calculator.CalculatePrice(50m);  // 45
```

### Factory with Delegates

```csharp
public class ServiceFactory
{
    private readonly Dictionary<string, Func<IService>> factories = new();

    public void Register(string name, Func<IService> factory)
    {
        factories[name] = factory;
    }

    public IService Create(string name)
    {
        if (factories.TryGetValue(name, out var factory))
            return factory();
        throw new ArgumentException($"Unknown service: {name}");
    }
}

// Registration
factory.Register("email", () => new EmailService());
factory.Register("sms", () => new SmsService());

// Usage
var service = factory.Create("email");
```

### Lazy Evaluation

```csharp
public class LazyValue<T>
{
    private readonly Func<T> factory;
    private T? value;
    private bool hasValue;

    public LazyValue(Func<T> factory)
    {
        this.factory = factory;
    }

    public T Value
    {
        get
        {
            if (!hasValue)
            {
                value = factory();
                hasValue = true;
            }
            return value!;
        }
    }
}

// Usage - factory only called on first access
var lazy = new LazyValue<ExpensiveObject>(() => new ExpensiveObject());
var obj = lazy.Value;  // Created here
var obj2 = lazy.Value; // Same instance
```

## Event Best Practices

### Thread-Safe Event Raising

An event with no subscribers is `null`. Delegates are immutable reference types, so `+=` creates a new delegate and `-=` removing the last subscriber sets the field back to `null` rather than leaving an empty invocation list. This means any event can be null at the point of raising, either because nothing ever subscribed or because the last subscriber was removed.

The `?.Invoke()` pattern handles both cases. Assigning to a local variable first captures a snapshot of the delegate reference so that even if another thread unsubscribes between the read and the invoke, the local copy remains stable.

```csharp
public class Publisher
{
    public event EventHandler<EventArgs>? SomethingHappened;

    protected virtual void OnSomethingHappened()
    {
        var handler = SomethingHappened;
        handler?.Invoke(this, EventArgs.Empty);
    }
}
```

In practice, the local variable assignment and `?.Invoke()` are doing the same null-safe work. `SomethingHappened?.Invoke(this, EventArgs.Empty)` compiles to an equivalent local capture, so either form is safe. The explicit local variable makes the intent visible, which is why it remains the conventional pattern.

### Weak Event Pattern

A standard event subscription keeps the subscriber alive as long as the publisher exists, because the delegate holds a strong reference to the subscriber. If the publisher is long-lived (an application-level service, a static event, or a shared cache) and subscribers are short-lived (UI views, request-scoped handlers), those subscribers can never be garbage collected. This is the classic event-driven memory leak.

The weak event pattern wraps subscriptions in `WeakReference<T>` so the event does not prevent garbage collection of the subscriber. Dead references are cleaned up when the event is raised.

```csharp
public class WeakEventSource<TEventArgs> where TEventArgs : EventArgs
{
    private readonly List<WeakReference<EventHandler<TEventArgs>>> handlers = new();

    public void Subscribe(EventHandler<TEventArgs> handler)
    {
        handlers.Add(new WeakReference<EventHandler<TEventArgs>>(handler));
    }

    public void Raise(object sender, TEventArgs args)
    {
        handlers.RemoveAll(wr => !wr.TryGetTarget(out _));

        foreach (var weakRef in handlers.ToList())
        {
            if (weakRef.TryGetTarget(out var handler))
            {
                handler(sender, args);
            }
        }
    }
}
```

**Why not use this every time?** Weak references introduce real costs. The GC can collect the subscriber at any point, so handlers silently disappear without the publisher or subscriber knowing. This makes debugging harder because a handler that "should" fire simply doesn't, with no error or indication why. There is also overhead from `WeakReference<T>` allocation, the cleanup pass on every raise, and the `TryGetTarget` check per handler.

The better default is explicit unsubscription through `IDisposable` (shown below), which makes the subscription lifetime visible and deterministic. Weak events are appropriate when the publisher genuinely cannot know or control subscriber lifetimes, like static events, long-lived infrastructure services, or framework-level event aggregators where subscribers come and go unpredictably. In WPF, `WeakEventManager` exists for exactly this reason: views bind to long-lived data sources and the framework cannot guarantee that every view will cleanly unsubscribe.

### Unsubscribe Pattern

```csharp
public class Subscriber : IDisposable
{
    private readonly Publisher publisher;

    public Subscriber(Publisher publisher)
    {
        this.publisher = publisher;
        publisher.DataReceived += OnDataReceived;
    }

    private void OnDataReceived(object? sender, DataEventArgs e)
    {
        // Handle event
    }

    public void Dispose()
    {
        publisher.DataReceived -= OnDataReceived;
    }
}

// Use with using
using var subscriber = new Subscriber(publisher);
// Automatically unsubscribes when disposed
```

## Covariance and Contravariance

### Delegate Covariance (Return Types)

```csharp
public class Animal { }
public class Dog : Animal { }

// Covariance - can return more derived type
Func<Animal> animalFactory = () => new Dog();
Animal animal = animalFactory();
```

### Delegate Contravariance (Parameters)

```csharp
// Contravariance - can accept more general type
Action<Dog> dogAction = (Animal a) => Console.WriteLine(a.GetType());
dogAction(new Dog());
```

## Key Takeaways

**Use built-in delegates**: Prefer `Func<>`, `Action<>`, and `Predicate<>` over custom delegate types.

**Events for pub-sub**: Use events when multiple subscribers need to respond to something happening.

**Delegates for behavior, not orchestration**: Delegates are well-suited as behavior parameters (LINQ predicates, strategy injection, factories). If you're passing `Action` or `Action<Exception>` callbacks for flow control, that's a sign the method should return a `Task<T>` instead.

**Default events are already thread-safe**: Since C# 4.0, compiler-generated `add`/`remove` accessors use `Interlocked.CompareExchange`. Custom event accessors are for logging, validation, or subscriber limits, not for thread safety alone.

**Events with no subscribers are null**: Delegates are immutable; `-=` on the last subscriber sets the backing field to `null`, not an empty invocation list. The `?.Invoke()` pattern handles this, and the compiler generates an equivalent local capture whether you use an explicit local variable or not.

**Unsubscribe explicitly through `IDisposable`**: Deterministic unsubscription is the default approach for managing event lifetimes. Weak events are appropriate only when the publisher genuinely cannot control subscriber lifetimes, like static events or framework-level aggregators.

**Lambdas for inline logic**: Use lambda expressions for short, focused delegate implementations. Use the `static` keyword when you don't need to capture variables to avoid allocations.
