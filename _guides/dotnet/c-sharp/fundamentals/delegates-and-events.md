---
title: "C# Delegates and Events"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Delegates as typed method references, Func and Action, lambdas and what they capture, multicast invocation and its edge cases, what the event keyword adds, raising and unsubscribing safely, and why events leak subscribers."
tags: [delegates, events, lambdas, closures, multicast-delegates, functional-programming, fundamentals]
---

## What a Delegate Is

A **delegate** is an object that holds a reference to a method, together with the object to call it on when the method is an instance method. Its type fixes the method's signature, so the compiler checks every assignment and every call. Holding a method in a variable is what lets code pass behaviour around, such as a sort order, a filter, or a callback, the same way it passes data.

```csharp
public delegate int MathOperation(int x, int y);

static int Add(int a, int b) => a + b;
static int Multiply(int a, int b) => a * b;

MathOperation operation = Add;     // method group converted to a delegate
int result = operation(5, 3);      // 8

operation = Multiply;
result = operation(5, 3);          // 15
```

## Func, Action, and the Built-in Types

Declaring a delegate type for every signature would be tedious, so the BCL provides generic ones that cover almost every case. `Func<..., TResult>` returns a value and `Action<...>` returns nothing. Both come in versions taking from zero to sixteen parameters, with the return type always last in `Func`.

```csharp
Func<int> getNumber = () => 42;
Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;

Action greet = () => Console.WriteLine("Hello!");
Action<string, int> repeat = (text, count) =>
{
    for (int i = 0; i < count; i++)
        Console.WriteLine(text);
};
```

Two older single-purpose types still appear throughout the BCL. `Predicate<T>` is a `T -> bool` test used by `List<T>.FindAll` and `Exists`, and `Comparison<T>` is the `(T, T) -> int` ordering used by `List<T>.Sort`:

```csharp
var numbers = new List<int> { -2, -1, 0, 1, 2 };
var positives = numbers.FindAll(n => n > 0);                        // [1, 2]

var words = new List<string> { "apple", "pie", "banana" };
words.Sort((a, b) => a.Length.CompareTo(b.Length));                 // pie, apple, banana
```

`Predicate<int>` and `Func<int, bool>` describe the same signature but are different types, and neither converts to the other. Prefer `Func` and `Action` in new APIs, and declare a custom delegate type only when the name documents intent better than a generic signature would, or when the signature needs `ref`, `out`, or `in` parameters, which `Func` and `Action` can't express.

Delegate types are variant in their generic parameters. A `Func<Dog>` can be assigned to a `Func<Animal>` because it returns something at least as specific, and an `Action<Animal>` can be assigned to an `Action<Dog>` because it accepts something at least as general. That applies to converting one delegate to another, not to lambda parameters. A lambda's parameter types must match the target exactly, so `Action<Dog> a = (Animal x) => ...` does not compile.

## Lambda Expressions

A lambda is an inline anonymous method, written as parameters, `=>`, and a body. The compiler converts it to whatever delegate type the context expects.

```csharp
Func<int, int> square = x => x * x;              // expression lambda
Func<int, int, int> add = (a, b) => a + b;

Func<int, int> factorial = n =>                  // statement lambda
{
    int result = 1;
    for (int i = 2; i <= n; i++)
        result *= i;
    return result;
};

button.Click += (_, _) => Refresh();             // discards for unused parameters
```

### Natural Types and Lambda Features by Version

Since C# 10, a lambda can be assigned to `var` when the compiler can work out a delegate type from it, which it can when every parameter is typed. A method group gets a natural type the same way, but only when the method has exactly one overload.

```csharp
var parse = (string s) => int.Parse(s);           // Func<string, int>
var read = Console.ReadLine;                      // Func<string?>: one overload
// var write = Console.WriteLine;                 // error: many overloads, no single type

var choose = object (bool b) => b ? 1 : "one";    // explicit return type (C# 10)

var greet = (string name = "World") => $"Hello, {name}!";   // default value (C# 12)
greet();                                                    // "Hello, World!"

var sum = (params int[] values) => values.Sum();            // params (C# 12)
```

A default value only works through the lambda's own natural type. Assign the same lambda to `Func<string, string>` and the default is lost, since `Func` has no optional parameters, and calling it with no argument is a compile error.

C# 14 lets a lambda put `ref`, `out`, `in`, `ref readonly`, or `scoped` on its parameters without spelling out their types, which previously required a fully typed parameter list:

```csharp
delegate bool TryParse<T>(string text, out T result);

TryParse<int> parse = (text, out result) => int.TryParse(text, out result);
```

### What a Lambda Captures

A lambda can use local variables and parameters of the method that contains it. It captures **the variable itself, not its value at the moment the lambda was created**:

```csharp
int threshold = 10;
Func<int, bool> isLarge = x => x > threshold;

threshold = 100;
Console.WriteLine(isLarge(50));   // false: the lambda sees the current threshold
```

To make that work, the compiler moves every captured variable out of the method's locals and into a hidden **closure** object on the heap, shared by the method and every lambda that captured it. That has two consequences. A capturing lambda allocates, both the closure and a new delegate each time the enclosing code runs, while a lambda that captures nothing is cached and reused. And a captured variable lives as long as the longest-lived delegate that references it, which can keep large objects alive well past the method that created them.

`static` on a lambda (C# 9) forbids capture, so an accidental reference to a local or to `this` becomes a compile error rather than a silent allocation:

```csharp
int multiplier = 10;
Func<int, int> scaled = x => x * multiplier;           // captures multiplier
Func<int, int> doubled = static x => x * 2;            // cannot capture
// Func<int, int> bad = static x => x * multiplier;    // compile error
```

A lambda can also be converted to an `Expression<Func<...>>` instead of a delegate. The compiler then builds a data structure describing the code rather than compiled code, which is how LINQ providers translate a lambda into SQL.

## Multicast Delegates

Every delegate can hold a list of methods rather than one. `+` or `+=` combines delegates into a new one whose **invocation list** holds all of them, and calling it calls each in order.

```csharp
Action<string> log = Console.WriteLine;
log += message => File.AppendAllText("log.txt", message + "\n");
log += message => Debug.WriteLine(message);

log("Application started");   // three calls, in the order added
```

Delegates are immutable. `+=` doesn't add to the existing delegate. It builds a new delegate with a longer list and assigns it back, which is what makes it safe to read a delegate field on one thread while another thread subscribes.

Three edges of multicast invocation matter in practice:

- **Only the last return value survives.** A multicast `Func<int>` returns the result of the last method called. To collect every result, call each entry of `GetInvocationList()` yourself.
- **An exception stops the rest.** If the second method throws, the third never runs and the exception propagates to the caller. Code that must reach every handler has to iterate `GetInvocationList()` with its own `try`/`catch`.
- **Removal matches by method and target, so a lambda can't be removed by rewriting it.** `-=` removes the last entry that refers to the same method on the same object. Two lambdas with identical text are two different methods, so `log -= m => Debug.WriteLine(m)` removes nothing. To unsubscribe a lambda later, store it in a variable and pass that variable to both `+=` and `-=`.

```csharp
Func<int> getValue = () => 1;
getValue += () => 2;
getValue += () => 3;

int last = getValue();                                    // 3
var all = getValue.GetInvocationList()
    .Cast<Func<int>>()
    .Select(f => f())
    .ToList();                                            // [1, 2, 3]
```

Removing the last method doesn't leave an empty delegate. It leaves `null`, which is why every call site that might see no subscribers has to check.

## Events

A public delegate field would let any outside code do three things: subscribe or unsubscribe, invoke the delegate, and overwrite it with `=`, discarding everyone else's subscriptions. The `event` keyword keeps only the first. Outside the declaring class, an event supports `+=` and `-=` and nothing else, so only the owner can raise it or reset it.

```csharp
public class OrderService
{
    public event EventHandler<OrderPlacedEventArgs>? OrderPlaced;

    public void PlaceOrder(int orderId, decimal total)
    {
        // ... process the order
        OnOrderPlaced(new OrderPlacedEventArgs(orderId, total));
    }

    protected virtual void OnOrderPlaced(OrderPlacedEventArgs e) =>
        OrderPlaced?.Invoke(this, e);
}

public class OrderPlacedEventArgs(int orderId, decimal total) : EventArgs
{
    public int OrderId { get; } = orderId;
    public decimal Total { get; } = total;
}

// Subscriber
service.OrderPlaced += (sender, e) => Console.WriteLine($"Order {e.OrderId}: {e.Total:C}");
service.OrderPlaced = null;   // compile error outside OrderService
```

The .NET convention is `EventHandler` or `EventHandler<TEventArgs>`, a `void` method taking the sender and an arguments object, raised from a `protected virtual On<EventName>` method so derived classes can intercept it. Following it lets any tool or framework that understands .NET events work with yours.

### Choosing Between a Delegate Parameter and an Event

A delegate **parameter** is behaviour the caller hands in and the method calls as part of its work, such as the predicate passed to `Where`. There is one caller, it decides what runs, and the method may call it many times or not at all. An **event** is a notification the publisher sends out when something happens, to however many subscribers exist, with the publisher neither knowing nor caring who they are.

If the method needs the caller's logic to finish its job, take a `Func` or `Action`. If other parts of the system may want to react to something that happened, expose an event. One case sits in between. A callback used only to report completion or failure, like `Load(url, onSuccess, onError)`, predates `async`/`await`, and in modern C# the method should return a `Task<T>` instead, so the caller awaits the result and exceptions propagate normally.

### Raising an Event Safely

An event with no subscribers is `null`, either because no one ever subscribed or because the last subscriber left. Raising it with `?.Invoke` handles both:

```csharp
OrderPlaced?.Invoke(this, e);
```

`?.` reads the field once into a temporary, then null-checks and invokes that temporary. If another thread unsubscribes the last handler between the check and the call, the invocation still uses the delegate that was read, so it can't throw `NullReferenceException`. The older idiom of copying the event into a local variable before testing it does the same thing explicitly.

Subscribing and unsubscribing are thread-safe for the compiler-generated event. Since C# 4, its `add` and `remove` accessors use a lock-free compare-and-swap loop, so concurrent `+=` calls never lose a subscription.

### Custom Accessors

An event can declare its own `add` and `remove` blocks, which run instead of the generated ones:

```csharp
private readonly List<EventHandler> _handlers = new();

public event EventHandler DataReceived
{
    add
    {
        if (_handlers.Count >= 10)
            throw new InvalidOperationException("Too many subscribers");
        _handlers.Add(value);
    }
    remove => _handlers.Remove(value);
}
```

Custom accessors suit auditing subscriptions, capping them, validating handlers, or forwarding them to another object's event. They replace the generated implementation entirely, including its thread safety, so an event with custom accessors that can be touched from several threads needs its own locking. Thread safety alone is never a reason to write custom accessors, because the default ones already provide it.

## Events Keep Their Subscribers Alive

Subscribing an instance method stores a delegate in the publisher, and that delegate holds a strong reference to the subscriber. As long as the publisher is reachable, so is every subscriber that hasn't unsubscribed. When the publisher is long-lived (a static event, an application-wide service, a shared cache) and the subscribers are short-lived (views, per-request objects), the subscribers can never be collected. This is the most common managed memory leak.

### Unsubscribe Deterministically

The default fix is to make the subscription's lifetime explicit and end it:

```csharp
public sealed class OrderNotifier : IDisposable
{
    private readonly OrderService _service;

    public OrderNotifier(OrderService service)
    {
        _service = service;
        _service.OrderPlaced += OnOrderPlaced;
    }

    private void OnOrderPlaced(object? sender, OrderPlacedEventArgs e) { /* ... */ }

    public void Dispose() => _service.OrderPlaced -= OnOrderPlaced;
}
```

Subscribing a named method rather than a lambda is what makes `-=` possible here. If the handler must be a lambda, keep it in a field and unsubscribe that field.

### Weak Events, and a Common Broken Version

A **weak event** holds its subscribers through weak references, so subscribing doesn't keep them alive. It is the right tool only when the publisher can't know when subscribers go away, which is why WPF ships `WeakEventManager` for data binding.

The obvious implementation, keeping a `WeakReference<EventHandler>` to each handler, doesn't work. The publisher's weak reference is then the only reference to the delegate object, so the next garbage collection removes the handler while its subscriber is still alive and in use. Handlers disappear at random, with no error. A working weak event holds a weak reference to the delegate's **target** (the subscriber object) together with the method to call on it, and rebuilds the call when raising. Most codebases should use an existing implementation rather than write one, and should reach for it only after explicit unsubscription has been ruled out, since a handler that silently stops firing is harder to debug than a leak.

## Key Takeaways

**A lambda captures variables, not values.** It sees later changes to them, capturing allocates a closure, and a captured variable lives as long as the delegate does. `static` lambdas turn accidental capture into a compile error.

**Multicast invocation has three edges.** Only the last return value survives, one throwing handler stops the rest, and an identical-looking lambda can't be used to unsubscribe.

**`event` restricts outsiders to `+=` and `-=`.** Only the owning class can raise the event or replace its subscribers.

**Raise with `?.Invoke`.** It reads the delegate once, so it's safe against the last subscriber leaving on another thread.

**Events hold subscribers alive.** Unsubscribe explicitly, usually from `Dispose`. A weak reference to the handler delegate itself is a bug, not a weak event.

**Take a delegate for behaviour, expose an event for notification, return a `Task` for completion.**
