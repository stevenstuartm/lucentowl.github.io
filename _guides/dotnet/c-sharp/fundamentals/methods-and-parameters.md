---
title: "C# Methods and Parameters"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How C# methods take and return data: pass-by-value versus ref, out, in, and ref readonly; optional, named, and params parameters and their versioning traps; local functions; ref returns; extension methods and C# 14 extension members; overload resolution; and operator overloading."
tags: [methods, parameters, ref-out-in, extension-methods, local-functions, operator-overloading, fundamentals]
---

## Method Basics

A method has an access modifier, a return type (`void` when it returns nothing), a name, and a parameter list. An instance method runs against a particular object and can read its fields. A `static` method belongs to the type and has no object to work with.

```csharp
public class Calculator
{
    private int _calls;

    public int Add(int a, int b)                  // instance: can touch _calls
    {
        _calls++;
        return a + b;
    }

    public static int Multiply(int a, int b) => a * b;   // static: no instance

    private static bool IsValid(int value) => value >= 0;
}

var calc = new Calculator();
int sum = calc.Add(5, 3);
int product = Calculator.Multiply(4, 2);
```

A method whose body is a single expression can be written with `=>` instead of a block and a `return`, as `Multiply` is.

### Access Modifiers

A member with no modifier is `private`.

| Modifier | Accessible from |
|----------|-----------------|
| `public` | Anywhere |
| `private` | The containing type only |
| `protected` | The containing type and types derived from it |
| `internal` | Any code in the same assembly |
| `protected internal` | The same assembly **or** a derived type anywhere |
| `private protected` | A derived type **and** in the same assembly |

The last two read alike and are opposites. `protected internal` widens access to the union of the two rules, and `private protected` narrows it to the intersection.

## How Arguments Are Passed

### By Value, the Default

Without a modifier, a parameter receives a **copy of the argument's value**. What that copy contains depends on the type. For a struct, it is the whole struct, so changes inside the method touch only the copy. For a class, the value is the reference, so the method gets a second reference to the **same object**.

```csharp
void Rename(Customer c)
{
    c.Name = "Changed";        // visible to the caller: same object
    c = new Customer("Other"); // not visible: reassigns only the local copy
}

var customer = new Customer("Original");
Rename(customer);
Console.WriteLine(customer.Name);  // "Changed"
```

That is the rule to carry for every parameter. A method can change the state of an object you pass it, but it cannot make your variable point at a different object. The by-reference modifiers below change the second half of that rule.

### By Reference with ref, out, in, and ref readonly

The four modifiers pass a reference to the caller's **variable** rather than a copy of its value. They differ in who must initialize it and who may write to it.

| Modifier | Caller must initialize | Method may write | Method must write | Call site |
|----------|------------------------|------------------|-------------------|-----------|
| `ref` | Yes | Yes | No | `ref x` required |
| `out` | No | Yes | Yes, before returning | `out x` required |
| `in` | Yes | No | No | `in` optional |
| `ref readonly` (C# 12) | Yes | No | No | `ref` or `in` expected; warning if omitted |

```csharp
void Increment(ref int x) => x++;

int value = 10;
Increment(ref value);
Console.WriteLine(value);  // 11
```

`out` is the pattern behind every `TryParse`. The method reports success through its return value and hands back the result through the `out` parameter, which the caller can declare inline. A discard `_` ignores a result that isn't needed:

```csharp
if (int.TryParse(input, out int number))
{
    Console.WriteLine(number);
}

bool isNumber = int.TryParse(input, out _);
```

For a class argument, the only thing `ref` adds is that the method can now reassign the caller's variable. For a struct argument, `ref` also lets the method modify the caller's struct in place, and it avoids copying the struct.

By-reference parameters have limits that follow from what they are. An argument must be a variable, so a property can't be passed as `ref` or `out`, because a property is a pair of methods rather than a storage location. And `async` and iterator methods can't have `ref`, `out`, `in`, or `ref readonly` parameters, because those methods return to the caller before they finish, while the referenced variable may no longer exist.

### in and ref readonly for Large Structs

Copying a struct is cheap when it is small, around three machine words or less, and measurable when it is larger and passed in a hot loop. `in` passes the struct by reference and forbids the method from assigning to it, which saves the copy without giving the method write access.

```csharp
double Distance(in Matrix4x4 a, in Matrix4x4 b) { /* reads only */ }

Distance(in m1, in m2);   // explicit
Distance(m1, m2);         // also by reference; `in` is optional here
```

Two details decide whether `in` actually saves anything.

**The struct should be `readonly`.** The method sees the parameter as read-only, but it can't know whether a member it calls on that parameter modifies `this`. For a struct not declared `readonly`, the compiler protects the caller by **copying the struct before each such call**, which can cost more than passing by value would have. Declaring the struct `readonly`, or marking the members called `readonly`, removes those defensive copies.

**`in` accepts values that aren't variables.** Pass a literal, a property, or an argument needing a conversion, and the compiler silently creates a temporary and passes a reference to that. `ref readonly` (C# 12) is the stricter version for APIs that need a real variable, such as a method that returns the reference it was given, and it warns when the caller passes something that isn't one.

## Optional, Named, and params Parameters

### Optional Parameters

A parameter with a default value can be omitted at the call site. Defaults must be compile-time constants, `default(T)`, or `new T()` for a value type, and optional parameters come after all required ones.

```csharp
public void SendEmail(string to, string subject, string body = "", bool isHtml = false, int priority = 1)
{
    // ...
}

SendEmail("user@example.com", "Hello");
SendEmail("user@example.com", "Hello", isHtml: true);
```

**The default is compiled into the caller.** When a caller omits `priority`, the compiler writes the literal `1` into the caller's IL. If a library later changes the default to `2` and ships a new DLL, callers compiled against the old version keep passing `1` until they are recompiled. This is the same versioning trap as a `public const`, and it has the same remedy. For a public API whose default might change, use an overload that forwards to the full method, since the forwarding call lives inside the library and changes with it.

### Named Arguments

Naming an argument makes a call readable where positional values would be opaque, and lets a caller supply a later optional parameter while skipping earlier ones:

```csharp
SendEmail(to: "user@example.com", subject: "Hello", priority: 5);

// Compare: what do true and 2 mean?
SendEmail("user@example.com", "Hello", "", true, 2);
```

Named arguments may appear in any order once all positional arguments are given. Arguments are still evaluated left to right in the order written at the call site, not in parameter order. Naming also makes parameter names part of the public contract, since renaming a parameter breaks every caller that named it.

### params Collections

`params` lets a caller pass a variable number of arguments, which the compiler gathers into a collection. It must be the last parameter.

```csharp
public int Sum(params int[] numbers) => numbers.Sum();

Sum(1, 2, 3);        // compiler builds new[] { 1, 2, 3 }
Sum();               // an empty array
Sum(existingArray);  // passes the array through as-is
```

Until C# 13 the parameter had to be an array, so every call with loose arguments allocated one. C# 13 allows `params` on other collection types, including `ReadOnlySpan<T>`, `Span<T>`, `IEnumerable<T>`, `IReadOnlyList<T>`, and `List<T>`. A `params ReadOnlySpan<T>` overload lets the compiler store the arguments on the stack and pass a span over them, with no array allocated. .NET 9 added or marked `params` on more than 60 such methods, including `string.Join`, and the compiler prefers the span overload when both exist, so recompiling against .NET 9 removes those allocations without code changes.

```csharp
public int Sum(params ReadOnlySpan<int> numbers)
{
    int total = 0;
    foreach (var n in numbers) total += n;
    return total;
}
```

## Local Functions

A local function (C# 7) is a method declared inside another method. It is visible only within that method and can read the enclosing method's locals and parameters.

```csharp
public IEnumerable<int> Range(int start, int count)
{
    ArgumentOutOfRangeException.ThrowIfNegative(count);  // runs at the call
    return Iterate();

    IEnumerable<int> Iterate()
    {
        for (int i = 0; i < count; i++)
            yield return start + i;
    }
}
```

That example shows the most common reason to use one. An iterator method doesn't run any of its body until the caller starts enumerating, so argument validation written directly in an iterator would be delayed until the first `MoveNext`. Splitting the method into an eager wrapper and a local iterator makes the check run immediately. The same split applies to `async` methods whose argument checks should throw synchronously.

A `static` local function (C# 8) cannot capture the enclosing method's locals, which turns an accidental capture into a compile error.

### Local Functions Versus Lambdas

A lambda that captures variables is compiled into a heap-allocated closure class plus a delegate instance. A local function that is only called directly, never converted to a delegate, captures through a struct passed by reference instead, so calling it allocates nothing. A local function that captures nothing compiles to a plain static method. When a helper is used by one method and never passed around as a delegate, a local function is the cheaper choice, and the IDE0039 analyzer suggests converting such lambdas by default.

Local functions compile to private methods of the enclosing type with generated names, so other members can't call them even though they exist in the compiled type. That keeps single-use helpers out of the class's surface without hiding them from a profiler or a stack trace.

## Returning Values

### Tuples for Several Values

A tuple return (C# 7) gives back several named values without declaring a type for them:

```csharp
public (string Name, int Age) GetUserInfo(int id)
{
    var user = repository.Find(id);
    return (user.Name, user.Age);
}

var (name, age) = GetUserInfo(42);   // deconstruct
var info = GetUserInfo(42);
Console.WriteLine(info.Name);        // or access by name
```

A tuple suits a private or internal helper. For a public API, a record gives the result a name that documentation and callers can refer to.

### ref Returns

A method can return a **reference to a storage location** rather than a copy of its value. The caller can then read or write the original through it:

```csharp
private readonly int[] _data = new int[100];

public ref int ElementAt(int index) => ref _data[index];

ref int slot = ref ElementAt(5);
slot = 42;              // _data[5] is now 42
ElementAt(10) = 100;    // assign straight through the returned reference
```

`ref readonly` returns the reference without write access, which avoids copying a large struct while keeping it immutable to the caller. The compiler only allows returning a reference to something that outlives the method, such as a field, an array element, or a `ref` parameter. Returning a reference to a local is a compile error.

### Async Methods

An `async` method returns `Task`, `Task<T>`, `ValueTask`, or `ValueTask<T>`, and the caller awaits it. `async void` exists only so event handlers can await, because an exception thrown from an `async void` method can't be caught by its caller.

## Extension Methods

An extension method is a static method that the compiler lets you call as if it were an instance method of another type. The `this` modifier on the first parameter names the type being extended:

```csharp
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}

string title = "Hello World".Truncate(5);   // "Hello..."
// compiles to: StringExtensions.Truncate("Hello World", 5)
```

Three consequences follow from it being a static call underneath. The extension is visible only where its namespace is imported with `using`. It can be called on `null`, because nothing dereferences the receiver before the method runs, so an extension that shouldn't accept null must check. And **an instance method with a matching signature always wins**. If the extended type later adds its own `Truncate(int)`, every call silently switches to it.

### Extension Members (C# 14)

C# 14 adds an `extension` block that declares several kinds of extension member at once. Along with methods, it allows **extension properties** and **static extension members**, which callers reach through the type name rather than an instance:

```csharp
public static class SequenceExtensions
{
    extension<T>(IEnumerable<T> source)
    {
        public bool IsEmpty => !source.Any();                 // extension property
        public IEnumerable<T> WhereNotNull() => source.Where(x => x is not null);
    }

    extension<T>(IEnumerable<T>)
    {
        public static IEnumerable<T> Empty => [];             // static extension
    }
}

bool none = orders.IsEmpty;
var nothing = IEnumerable<int>.Empty;
```

Existing `this`-parameter extension methods keep working unchanged, and the two forms can live in the same static class.

## Method Overloading

Several methods can share a name if their parameter lists differ in number, type, or by-reference modifier. The return type doesn't count, and neither does the difference between `ref`, `out`, and `in` on the same parameter.

```csharp
public void Log(string message) => Log(message, LogLevel.Info);
public void Log(string message, LogLevel level) => Write($"[{level}] {message}");
public void Log(Exception ex) => Log(ex.Message, LogLevel.Error);
```

The compiler picks the overload whose parameters need the **least conversion** from the arguments given. An `int` argument prefers an `int` parameter over `long`, and `long` over `double`. When two overloads are equally good, a call without omitted optional parameters beats one that relies on defaults, and an overload that matches without expanding `params` beats one that needs it. When nothing separates them, the call is a compile error, and adding an overload to a published library can create that ambiguity in callers' code that compiled before.

## Operator Overloading

A type can define what the built-in operators mean for it. An operator is declared as a `public static` method named `operator` plus the symbol.

```csharp
public readonly record struct Money(decimal Amount, string Currency)
{
    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException("Currency mismatch");
        return new Money(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator *(Money m, decimal factor) => new(m.Amount * factor, m.Currency);

    // Explicit: converting drops the currency, so the caller should ask for it
    public static explicit operator decimal(Money m) => m.Amount;
}

var total = new Money(100, "USD") + new Money(8, "USD");   // 108 USD
var discounted = total * 0.9m;                             // 97.2 USD
decimal raw = (decimal)total;
```

The rules that trip people are about consistency rather than syntax.

- **Operators come in required pairs.** Defining `==` requires `!=`, `<` requires `>`, and `<=` requires `>=`. A type that defines `==` should also override `Equals` and `GetHashCode` to match, or collections and `==` will disagree about equality. A record, as above, generates all of these consistently.
- **Implicit conversions must not lose information or throw.** Callers never see an implicit conversion happen. Anything that can fail or drop data, like `Money` to `decimal` losing its currency, should be `explicit`.
- **Compound assignment follows from the binary operator.** Defining `+` makes `+=` work. C# 14 also allows a type to define `+=` itself as an instance operator that updates in place, which avoids allocating a new object for mutable types like large buffers. A type can also provide a `checked` version of an arithmetic operator, which a `checked` context calls instead of the normal one.

## Key Takeaways

**Every parameter is a copy unless a modifier says otherwise.** For a class, the copy is a reference, so the method can change the object but not the caller's variable.

**`in` saves a copy only for `readonly` structs.** On a mutable struct, calls to its members through an `in` parameter each copy the struct defensively.

**Optional defaults and `const` values are both baked into callers.** Changing either in a library has no effect until every caller recompiles, so public APIs that may change should forward through an overload instead.

**`params ReadOnlySpan<T>` removes the hidden array.** Since C# 13, a variable-argument method doesn't have to allocate on every call.

**Local functions are cheaper than capturing lambdas when they aren't converted to delegates,** and they are the standard way to make an iterator or async method validate its arguments immediately.

**An extension method is a static call in disguise.** It can receive `null`, it needs its namespace imported, and a matching instance method on the type always takes precedence.
