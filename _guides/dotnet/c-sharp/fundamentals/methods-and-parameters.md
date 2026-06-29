---
title: "C# Methods and Parameters"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Method declarations, parameter passing mechanisms, expression-bodied members, local functions, and modern method features."
tags: [c-sharp, dotnet, fundamentals, methods, functions, practical]
---

## Method Basics

Methods encapsulate reusable logic. Every method has an access modifier, return type, name, and parameter list.

```csharp
public class Calculator
{
    // Instance method
    public int Add(int a, int b)
    {
        return a + b;
    }

    // Static method - no instance required
    public static int Multiply(int a, int b)
    {
        return a * b;
    }

    // Void return type - no return value
    public void PrintResult(int value)
    {
        Console.WriteLine($"Result: {value}");
    }

    // Private helper method
    private bool IsValid(int value)
    {
        return value >= 0;
    }
}

// Usage
var calc = new Calculator();
int sum = calc.Add(5, 3);           // Instance method
int product = Calculator.Multiply(4, 2); // Static method
```

## Access Modifiers

| Modifier | Access |
|----------|--------|
| `public` | Accessible from anywhere |
| `private` | Only within the containing type |
| `protected` | Within type and derived types |
| `internal` | Within the same assembly |
| `protected internal` | Assembly OR derived types |
| `private protected` | Assembly AND derived types |

```csharp
public class BaseService
{
    public void PublicMethod() { }           // Anyone
    private void PrivateMethod() { }         // This class only
    protected void ProtectedMethod() { }     // This + derived
    internal void InternalMethod() { }       // Same assembly
    protected internal void Mixed1() { }     // Assembly OR derived
    private protected void Mixed2() { }      // Assembly AND derived
}
```

## Parameter Passing

### Value Parameters (Default)

A copy of the value is passed. Changes inside the method don't affect the original.

```csharp
public void Increment(int x)
{
    x++; // Modifies local copy
}

int value = 10;
Increment(value);
Console.WriteLine(value); // Still 10
```

### Reference Parameters (ref)

Pass by reference: the method operates on the original variable.

```csharp
public void Increment(ref int x)
{
    x++; // Modifies original
}

int value = 10;
Increment(ref value);
Console.WriteLine(value); // 11

// ref requires the variable to be initialized
int uninitialized;
// Increment(ref uninitialized); // Compile error
```

### Output Parameters (out)

Similar to ref, but the method must assign a value. The caller doesn't need to initialize.

```csharp
public bool TryParse(string input, out int result)
{
    if (int.TryParse(input, out result))
    {
        return true;
    }
    result = 0; // Must assign even on failure
    return false;
}

// out variables can be declared inline (C# 7.0)
if (TryParse("42", out int number))
{
    Console.WriteLine(number);
}

// Discard with _ when you don't need the value
if (int.TryParse(input, out _))
{
    Console.WriteLine("Valid number");
}
```

<div class="callout callout--tip">
<p class="callout__title">In Parameters for Large Structs</p>
<p>Use <code>in</code> parameters for large structs (> 16 bytes) to avoid copying overhead while preventing accidental modification. This is particularly valuable in performance-critical code.</p>
</div>

### In Parameters (C# 7.2)

Pass by reference but read-only. Useful for large structs to avoid copying without allowing modification.

```csharp
public double CalculateDistance(in Point p1, in Point p2)
{
    // Cannot modify p1 or p2
    // p1.X = 0; // Compile error
    double dx = p1.X - p2.X;
    double dy = p1.Y - p2.Y;
    return Math.Sqrt(dx * dx + dy * dy);
}

var origin = new Point(0, 0);
var target = new Point(3, 4);
double dist = CalculateDistance(in origin, in target);

// 'in' is optional at call site for readability
double dist2 = CalculateDistance(origin, target);
```

**When to use in**:
- Large structs (> 16 bytes) passed frequently
- Want to prevent accidental modification
- Performance-critical code

## Optional and Named Parameters

### Optional Parameters

Parameters with default values can be omitted.

```csharp
public void SendEmail(
    string to,
    string subject,
    string body = "",
    bool isHtml = false,
    int priority = 1)
{
    // Implementation
}

// Call with different combinations
SendEmail("user@example.com", "Hello");
SendEmail("user@example.com", "Hello", "Body text");
SendEmail("user@example.com", "Hello", isHtml: true);
SendEmail("user@example.com", "Hello", priority: 5);
```

### Named Parameters

Specify parameters by name for clarity or to skip optional ones.

```csharp
// Clarity for boolean parameters
SendEmail(
    to: "user@example.com",
    subject: "Hello",
    isHtml: true,
    priority: 2);

// Skip optional parameters
SendEmail("user@example.com", "Hello", priority: 5);

// Reorder parameters
SendEmail(
    subject: "Hello",
    to: "user@example.com",
    body: "Content");
```

## params Keyword

Accept a variable number of arguments as an array.

```csharp
public int Sum(params int[] numbers)
{
    return numbers.Sum();
}

// Call with any number of arguments
int total = Sum(1, 2, 3, 4, 5);  // 15
int total2 = Sum(10, 20);        // 30
int total3 = Sum();              // 0

// Or pass an array directly
int[] values = { 1, 2, 3 };
int total4 = Sum(values);

// params must be the last parameter
public void Log(string message, params object[] args)
{
    Console.WriteLine(message, args);
}

Log("User {0} logged in at {1}", userName, DateTime.Now);
```

## Expression-Bodied Methods

For single-expression methods, use the `=>` syntax. (C# 6.0)

```csharp
public class Circle
{
    private readonly double radius;

    public Circle(double radius) => this.radius = radius;

    // Expression-bodied method
    public double Area() => Math.PI * radius * radius;

    public double Circumference() => 2 * Math.PI * radius;

    public bool Contains(Point p) =>
        Math.Sqrt(p.X * p.X + p.Y * p.Y) <= radius;

    // Multi-line expressions using parentheses (still single expression)
    public string Describe() =>
        $"Circle with radius {radius:F2}, " +
        $"area {Area():F2}, " +
        $"circumference {Circumference():F2}";
}
```

Use expression bodies when:
- The method is a single expression
- Readability isn't compromised
- The logic is straightforward

## Local Functions

Define functions inside methods. They can access local variables and parameters. (C# 7.0)

```csharp
public IEnumerable<int> GenerateSequence(int count)
{
    if (count < 0)
        throw new ArgumentOutOfRangeException(nameof(count));

    // Local function - validation happens immediately
    return Generate();

    IEnumerable<int> Generate()
    {
        for (int i = 0; i < count; i++)
        {
            yield return i;
        }
    }
}

// Recursive local function
public int Factorial(int n)
{
    return Calculate(n);

    int Calculate(int x) =>
        x <= 1 ? 1 : x * Calculate(x - 1);
}

// Static local functions (C# 8.0) - cannot capture locals
public int Process(int[] data)
{
    int sum = 0;
    foreach (var item in data)
    {
        sum += Transform(item);
    }
    return sum;

    // Static prevents accidental capture of 'sum' or 'data'
    static int Transform(int value) => value * 2;
}
```

### Why Local Functions over Lambdas?

When a lambda captures variables from its enclosing scope, the compiler generates a class-based closure ("display class") on the heap, plus a delegate object, totaling roughly 88 bytes of GC pressure per invocation. Local functions avoid this. When a local function captures variables but is not converted to a delegate, the compiler creates a **struct-based closure** allocated on the stack instead, resulting in zero heap allocations. When it captures nothing, the compiler emits it as a plain static method with no closure at all.

### Modularity without Breaking Encapsulation

Extracting a helper into a `private` method exposes it to every other method in the class, adds noise to IntelliSense and the class outline, and requires passing all needed data as parameters. Local functions are **lexically scoped** to the containing method: they do not appear in IntelliSense, reflection, or the class method table, and non-static local functions can access the caller's locals directly. This makes them ideal for decomposing long methods without polluting the class surface with single-use helpers.

### Adoption and Microsoft's Guidance

Microsoft actively recommends local functions over lambdas. Their built-in analyzer rule [IDE0039](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/style-rules/ide0039){:target="_blank" rel="noopener noreferrer"} defaults to preferring local functions, and the .NET runtime repository configures `csharp_prefer_static_local_function = true` in its `.editorconfig`. Local functions are used extensively throughout the runtime source code, ASP.NET Core, and Entity Framework Core, and have become idiomatic C# since their introduction in 2017.

## Return Types

### Single Return Value

```csharp
public int Calculate(int input) => input * 2;
```

### Tuple Return (C# 7.0)

Return multiple values without defining a class.

```csharp
public (string Name, int Age, bool IsActive) GetUserInfo(int id)
{
    var user = repository.Find(id);
    return (user.Name, user.Age, user.IsActive);
}

// Caller can deconstruct
var (name, age, active) = GetUserInfo(42);

// Or access by name
var info = GetUserInfo(42);
Console.WriteLine(info.Name);
```

### ref Return (C# 7.0)

Return a reference to a variable, allowing the caller to modify the original.

```csharp
private int[] data = new int[100];

public ref int GetElement(int index)
{
    return ref data[index];
}

// Caller can modify the array element directly
ref int element = ref GetElement(5);
element = 42; // data[5] is now 42

// Or modify in-place
GetElement(10) = 100;
```

### ref readonly Return (C# 7.2)

Return a reference that cannot be modified.

```csharp
private readonly Point origin = new Point(0, 0);

public ref readonly Point GetOrigin()
{
    return ref origin;
}

// Caller gets reference but cannot modify
ref readonly Point o = ref GetOrigin();
// o.X = 5; // Compile error
```

## Async Methods

Methods that perform asynchronous operations.

```csharp
// Async method returning Task<T>
public async Task<string> FetchDataAsync(string url)
{
    using var client = new HttpClient();
    return await client.GetStringAsync(url);
}

// Async method returning Task (no value)
public async Task SaveDataAsync(string data)
{
    await File.WriteAllTextAsync("data.txt", data);
}

// Async method returning ValueTask (optimization for sync paths)
public async ValueTask<int> GetCachedValueAsync(string key)
{
    if (cache.TryGetValue(key, out int value))
    {
        return value; // Sync path - no allocation
    }

    value = await LoadFromDatabaseAsync(key);
    cache[key] = value;
    return value;
}

// Async void - only for event handlers
private async void Button_Click(object sender, EventArgs e)
{
    await ProcessAsync();
}
```

## Extension Methods

Add methods to existing types without modifying them.

```csharp
public static class StringExtensions
{
    // 'this' keyword makes it an extension method
    public static bool IsNullOrEmpty(this string value)
    {
        return string.IsNullOrEmpty(value);
    }

    public static string Truncate(this string value, int maxLength)
    {
        if (value == null || value.Length <= maxLength)
            return value;
        return value[..maxLength] + "...";
    }

    public static int WordCount(this string value)
    {
        return value?.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length ?? 0;
    }
}

// Usage - appears as instance method
string text = "Hello World";
bool empty = text.IsNullOrEmpty();       // false
string short = text.Truncate(5);         // "Hello..."
int words = text.WordCount();            // 2

// Works on null
string nullStr = null;
bool isNull = nullStr.IsNullOrEmpty();   // true
```

**Extension method rules**:
- Must be in a static class
- Method must be static
- First parameter must have `this` keyword
- Extension class should be in an appropriate namespace

## Method Overloading

Multiple methods with the same name but different parameters.

```csharp
public class Logger
{
    public void Log(string message)
    {
        Log(message, LogLevel.Info);
    }

    public void Log(string message, LogLevel level)
    {
        Console.WriteLine($"[{level}] {message}");
    }

    public void Log(Exception ex)
    {
        Log(ex.Message, LogLevel.Error);
    }

    public void Log(string format, params object[] args)
    {
        Log(string.Format(format, args), LogLevel.Info);
    }
}

// Compiler selects best match
logger.Log("Simple message");           // First overload
logger.Log("Error!", LogLevel.Error);   // Second overload
logger.Log(new Exception("Oops"));      // Third overload
logger.Log("User {0} count: {1}", name, count); // Fourth overload
```

## Operator Overloading

Define custom operators for your types.

```csharp
public readonly struct Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    // Binary operators
    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException("Currency mismatch");
        return new Money(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator -(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidOperationException("Currency mismatch");
        return new Money(a.Amount - b.Amount, a.Currency);
    }

    public static Money operator *(Money m, decimal factor)
    {
        return new Money(m.Amount * factor, m.Currency);
    }

    // Comparison operators (implement in pairs)
    public static bool operator ==(Money a, Money b) =>
        a.Amount == b.Amount && a.Currency == b.Currency;

    public static bool operator !=(Money a, Money b) => !(a == b);

    // Implicit conversion
    public static implicit operator decimal(Money m) => m.Amount;

    // Explicit conversion
    public static explicit operator Money(decimal amount) =>
        new Money(amount, "USD");
}

// Usage
var price = new Money(100, "USD");
var tax = new Money(8, "USD");
var total = price + tax;         // 108 USD
var discounted = total * 0.9m;   // 97.2 USD
```

## Key Takeaways

**Use ref/out sparingly**: Prefer returning values or tuples. Use ref when modifying large structs or when the pattern is well-established (like TryParse).

**Use in for large readonly structs**: Avoid copying cost while preventing modification.

**Named parameters improve readability**: Especially useful for boolean parameters or when skipping optional ones.

**Expression bodies for simple methods**: Use `=>` when the entire method is one expression, but don't sacrifice readability.

**Local functions over private helpers**: When a helper is only used by one method, local functions keep related code together.

**Extension methods for fluent APIs**: Add methods to types you don't own, but keep them discoverable through appropriate namespacing.
