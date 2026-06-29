---
title: "C# Types and Variables"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Understanding C#'s type system including value types, reference types, type inference, and memory behavior."
tags: [c-sharp, dotnet, fundamentals, types, memory-management, practical]
---

## The Type System

C# is a statically-typed language where every variable and expression has a type known at compile time. The type system divides into two fundamental categories: value types (stored on the stack or inline) and reference types (stored on the heap with stack-based references).

Understanding this distinction matters because it affects performance, equality semantics, and how data flows through your application.

## Value Types

Value types hold their data directly. When you assign a value type to another variable or pass it to a method, you create a copy of the data.

### Built-in Value Types

| Type | .NET Type | Size | Range |
|------|-----------|------|-------|
| `bool` | Boolean | 1 byte | true/false |
| `byte` | Byte | 1 byte | 0 to 255 |
| `sbyte` | SByte | 1 byte | -128 to 127 |
| `short` | Int16 | 2 bytes | -32,768 to 32,767 |
| `ushort` | UInt16 | 2 bytes | 0 to 65,535 |
| `int` | Int32 | 4 bytes | -2.1B to 2.1B |
| `uint` | UInt32 | 4 bytes | 0 to 4.3B |
| `long` | Int64 | 8 bytes | ±9.2 quintillion |
| `ulong` | UInt64 | 8 bytes | 0 to 18.4 quintillion |
| `float` | Single | 4 bytes | ~6-9 digits precision |
| `double` | Double | 8 bytes | ~15-17 digits precision |
| `decimal` | Decimal | 16 bytes | 28-29 digits precision |
| `char` | Char | 2 bytes | Unicode character |

Both `float` and `double` are *binary floating-point* types, meaning they store numbers in base-2 scientific notation (a significand multiplied by a power of 2). A `float` uses 32 bits for this (23-bit significand, 8-bit exponent, 1 sign bit), giving roughly 6-7 digits of precision. A `double` is literally "double precision," using 64 bits (52-bit significand, 11-bit exponent, 1 sign bit) for roughly 15-16 digits. They follow the same IEEE 754 standard and share the same fundamental limitation: base-10 fractions like 0.1 become infinitely repeating patterns in binary, just as 1/3 does in decimal. The `decimal` type avoids this by storing numbers in base 10 internally, which is why it exists for financial calculations.

**When to use each numeric type**:

```csharp
// int: General-purpose integers (loop counters, counts, IDs)
int count = 42;
int userId = 12345;

// long: Large numbers, timestamps, file sizes
long fileSize = 1_073_741_824; // 1 GB in bytes
long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

// double: Scientific calculations, general floating-point math
double distance = 384_400.5; // km to the moon
double velocity = 299_792.458; // km/s speed of light

// decimal: Financial calculations where precision matters
decimal price = 19.99m;
decimal taxRate = 0.0825m;
decimal total = price * (1 + taxRate); // 21.6389175m - exact
```

<div class="callout callout--warning">
<p class="callout__title">Why decimal Matters for Money</p>
<p>The <code>decimal</code> type exists specifically because <code>float</code> and <code>double</code> use binary floating-point representation, which cannot precisely represent base-10 fractions. Financial applications require exact decimal arithmetic.</p>
</div>

```csharp
// Why decimal matters for money
double priceDouble = 0.1 + 0.2;  // 0.30000000000000004 (unexpected)
decimal priceDecimal = 0.1m + 0.2m;  // 0.3 (exact)
```

### Structs

Structs are custom value types. Use them for small, data-centric types that represent a single value or a small group of related values.

```csharp
public struct Point
{
    public double X { get; init; }
    public double Y { get; init; }

    public Point(double x, double y)
    {
        X = x;
        Y = y;
    }

    public double DistanceTo(Point other)
    {
        double dx = X - other.X;
        double dy = Y - other.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }
}

// Usage - value semantics mean copies are independent
var p1 = new Point(0, 0);
var p2 = p1; // Creates a copy
// Modifying p2 would not affect p1 (if Point were mutable)
```

**Classes are the default for data structures.** A common misconception is that structs should be preferred for performance whenever possible. In practice, the tradeoffs work against you for anything beyond small, single-value types. Structs are copied on every assignment and method call, so larger structs actually cost more than a single heap allocation. Serialization frameworks like `System.Text.Json` and Newtonsoft.Json have historically struggled with struct deserialization, making structs a poor fit for DTOs and API models. Data structures frequently need to represent absent values, and structs cannot be null without `Nullable<T>` wrapping. Any time a struct is cast to an interface (common in dependency injection and LINQ), it gets boxed onto the heap, erasing the allocation benefit entirely.

Use structs only when the type genuinely models a small, immutable value like a coordinate, a color, or a measurement, and use classes (or records) for everything else.

**Struct guidelines** (when a struct is the right choice):
- Keep structs small (16 bytes or less for best performance)
- Make structs immutable when possible (use `init` or `readonly`)
- Implement `Equals` and `GetHashCode` if used in collections
- Don't inherit from structs (they're implicitly sealed)

### Enums

Enums define a set of named constants. By default, the underlying type is `int`.

```csharp
public enum OrderStatus
{
    Pending,      // 0
    Processing,   // 1
    Shipped,      // 2
    Delivered,    // 3
    Cancelled     // 4
}

// Explicit values when persistence or interop matters
public enum HttpStatusCode : short
{
    OK = 200,
    Created = 201,
    BadRequest = 400,
    NotFound = 404,
    InternalServerError = 500
}

// Flags for combinable options
[Flags]
public enum FilePermissions
{
    None = 0,
    Read = 1,
    Write = 2,
    Execute = 4,
    ReadWrite = Read | Write,
    All = Read | Write | Execute
}

// Using flags
var permissions = FilePermissions.Read | FilePermissions.Write;
bool canWrite = permissions.HasFlag(FilePermissions.Write); // true
```

## Reference Types

Reference types store a reference (memory address) to their data. Multiple variables can reference the same object.

### Classes

Classes are the primary reference type for modeling complex entities and behaviors.

```csharp
public class Customer
{
    public int Id { get; init; }
    public string Name { get; set; }
    public string Email { get; set; }

    public Customer(int id, string name)
    {
        Id = id;
        Name = name;
    }
}

// Reference semantics - both variables point to the same object
var customer1 = new Customer(1, "Alice");
var customer2 = customer1;
customer2.Name = "Bob";
Console.WriteLine(customer1.Name); // "Bob" - same object
```

### Strings

Strings are reference types but behave like value types due to immutability.

```csharp
string greeting = "Hello";
string modified = greeting + " World"; // Creates a new string
// greeting is still "Hello"

// String interning - identical literals share memory
string a = "hello";
string b = "hello";
bool same = ReferenceEquals(a, b); // true - interned

// For building strings in loops, use StringBuilder
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++)
{
    sb.Append(i).Append(", ");
}
string result = sb.ToString();
```

### Arrays

Arrays are fixed-size collections of elements of the same type.

```csharp
// Array creation
int[] numbers = new int[5];           // 5 zeros
int[] primes = { 2, 3, 5, 7, 11 };    // Initialized
int[] squares = new int[] { 1, 4, 9 }; // Explicit type

// Multi-dimensional arrays
int[,] matrix = new int[3, 3];        // 3x3 grid
int[,] identity = { { 1, 0 }, { 0, 1 } };

// Jagged arrays (array of arrays)
int[][] jagged = new int[3][];
jagged[0] = new int[] { 1, 2 };
jagged[1] = new int[] { 3, 4, 5 };
```

## Type Inference with var

The `var` keyword lets the compiler infer the type from the right-hand side expression. The variable is still statically typed.

```csharp
var count = 42;                    // int
var name = "Alice";                // string
var prices = new List<decimal>();  // List<decimal>
var lookup = new Dictionary<string, int>(); // Dictionary<string, int>

// Required for anonymous types
var anon = new { Name = "Alice", Age = 30 };

// var makes complex generic types readable
var customersByCity = customers
    .GroupBy(c => c.City)
    .ToDictionary(g => g.Key, g => g.ToList());
// Type: Dictionary<string, List<Customer>>
```

**When to use var**:
- When the type is obvious from the right side (`var list = new List<string>()`)
- With LINQ queries that return complex types
- With anonymous types
- To reduce noise when the type is clear from context

**When to avoid var**:
- When the type isn't obvious (`var result = GetResult()` - what type?)
- For simple types where explicit naming aids readability

## Constants and Read-Only

### const

Compile-time constants. The value must be known at compile time and is embedded directly into the IL.

```csharp
public class MathConstants
{
    public const double Pi = 3.14159265358979;
    public const int BitsPerByte = 8;
    public const string DefaultScheme = "https";
}

// Usage - value is substituted at compile time
double area = MathConstants.Pi * radius * radius;
```

<div class="callout callout--note">
<p class="callout__title">const Limitations</p>
<ul>
<li>Only primitive types, string, and null</li>
<li>Value embedded in consuming assemblies (recompilation needed if changed)</li>
<li>Cannot be computed at runtime</li>
</ul>
</div>

### readonly

Runtime constants. Value set at declaration or in constructor.

```csharp
public class Configuration
{
    public readonly string ConnectionString;
    public readonly DateTime StartTime = DateTime.UtcNow;

    public Configuration(string connectionString)
    {
        ConnectionString = connectionString;
    }
}

// Static readonly for runtime-computed constants
public static class AppSettings
{
    public static readonly string MachineName = Environment.MachineName;
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);
}
```

**Choosing between const and static readonly.** The "embedded in IL" behavior of `const` is a common source of subtle bugs in multi-assembly projects. When Assembly A defines `public const int MaxRetries = 3`, the literal value `3` is copied into every consuming assembly's compiled IL. If Assembly A later changes it to `5` and only Assembly A is recompiled, every consumer silently keeps using `3` with no compile error or runtime warning.

This makes the choice straightforward: use `const` for values that are *logically permanent* and will never change across versions (mathematical constants, protocol-defined values, fixed enum-like labels). Use `static readonly` for any `public` value that another assembly might reference and that could conceivably change between releases. For `private` or `internal` constants, `const` is always safe because the value can't leak beyond the assembly boundary, so recompilation is guaranteed.

```csharp
// const is safe: these values are mathematically permanent
public const double Pi = 3.14159265358979;
public const int BitsPerByte = 8;

// const is safe: private scope, can't leak across assemblies
private const int BufferSize = 4096;

// static readonly is safer: this could change in a future version
public static readonly int MaxRetries = 3;
public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);
```

**readonly vs const**:

| Aspect | const | readonly |
|--------|-------|----------|
| Evaluation | Compile-time | Runtime |
| Types | Primitives, string, null | Any type |
| Storage | Embedded in IL | Field in memory |
| Change propagation | Requires recompilation | Automatic |
| Instance vs static | Always static | Either |

## Nullable Value Types

Value types cannot normally be null. The `?` suffix creates a nullable value type that can represent the absence of a value.

```csharp
int? maybeAge = null;
int? definitelyAge = 25;

// Checking for value
if (maybeAge.HasValue)
{
    int actualAge = maybeAge.Value;
}

// Null-coalescing operator
int displayAge = maybeAge ?? 0; // 0 if null

// Null-conditional with coalescing
int length = someString?.Length ?? 0;

// Pattern matching
if (maybeAge is int age)
{
    Console.WriteLine($"Age is {age}");
}
```

Nullable value types are implemented as `Nullable<T>`, a generic struct that wraps the underlying value type.

## Default Values

All types have a default value. For value types, it's typically zero or equivalent. For reference types, it's null.

```csharp
default(int)      // 0
default(bool)     // false
default(double)   // 0.0
default(string)   // null
default(DateTime) // DateTime.MinValue (0001-01-01)

// default literal (C# 7.1+)
int count = default;           // 0
string name = default;         // null
List<int> list = default;      // null

// Useful in generics
public T GetOrDefault<T>(string key) =>
    cache.TryGetValue(key, out T value) ? value : default;
```

## Type Conversions

### Implicit Conversions

Safe conversions that cannot lose data happen automatically.

```csharp
int i = 100;
long l = i;        // int to long - safe
double d = i;      // int to double - safe
decimal m = i;     // int to decimal - safe

// Base class assignment
object obj = "hello";  // string to object
IEnumerable<int> seq = new List<int>();  // List to interface
```

### Explicit Conversions (Casts)

Conversions that might lose data or fail require explicit casting.

```csharp
double d = 3.14;
int i = (int)d;    // 3 - truncates decimal

long l = 100;
int j = (int)l;    // Safe here, but could overflow

// Reference type casts can fail
object obj = "hello";
string s = (string)obj;  // Works
int n = (int)obj;        // InvalidCastException
```

### Safe Casting with as and is

```csharp
object obj = GetSomething();

// 'as' returns null if cast fails
string s = obj as string;
if (s != null)
{
    Console.WriteLine(s.Length);
}

// 'is' with pattern matching (preferred)
if (obj is string str)
{
    Console.WriteLine(str.Length);
}

// Negated pattern
if (obj is not string)
{
    Console.WriteLine("Not a string");
}
```

### Conversion Methods

```csharp
// Convert class - handles null and type conversions
string input = "42";
int value = Convert.ToInt32(input);
double d = Convert.ToDouble(input);

// Parse - for strings, throws on failure
int parsed = int.Parse("42");
DateTime date = DateTime.Parse("2024-01-15");

// TryParse - safe parsing, returns success bool
if (int.TryParse(userInput, out int result))
{
    Console.WriteLine($"Parsed: {result}");
}
else
{
    Console.WriteLine("Invalid input");
}

// Culture-aware parsing
decimal price = decimal.Parse("1,234.56", CultureInfo.InvariantCulture);
```

## Boxing and Unboxing

Boxing converts a value type to object (or interface it implements). Unboxing extracts the value type from the object. Both have performance costs.

```csharp
int value = 42;
object boxed = value;    // Boxing - allocates on heap
int unboxed = (int)boxed; // Unboxing - copies back to stack

// Common boxing scenarios to avoid
ArrayList oldList = new ArrayList();
oldList.Add(42);  // Boxing occurs
oldList.Add(99);  // Boxing again

// Use generic collections instead
List<int> newList = new List<int>();
newList.Add(42);  // No boxing
newList.Add(99);  // No boxing
```

## Namespaces and Using Directives

### File-Scoped Namespaces (C# 10)

Traditional namespace declarations require an extra level of indentation for all code within the file. File-scoped namespaces eliminate this nesting when a file contains only one namespace.

```csharp
// Traditional (still valid)
namespace MyApp.Services
{
    public class UserService
    {
        // Code indented inside namespace
    }
}

// File-scoped (C# 10+) - no extra indentation
namespace MyApp.Services;

public class UserService
{
    // Code at file root level
}

public class OrderService
{
    // Also in MyApp.Services namespace
}
```

File-scoped namespaces reduce visual noise and save horizontal space. Most modern C# projects use this style by default. You can enforce a project-wide preference through `.editorconfig`:

```ini
[*.cs]
csharp_style_namespace_declarations = file_scoped
```

### Global Using Directives (C# 10)

Instead of repeating common using statements in every file, global usings declare them once for the entire project.

```csharp
// In any file (commonly GlobalUsings.cs or at top of Program.cs)
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Threading.Tasks;

// Global using static for extension methods and static members
global using static System.Console;
global using static System.Math;

// After declaring these, all files in the project can use
// List<T>, LINQ methods, Task, and WriteLine() without imports
```

You can also declare global usings in the project file:

```xml
<ItemGroup>
  <Using Include="System.Collections.Generic" />
  <Using Include="System.Console" Static="true" />
  <Using Include="MyApp.Common" Alias="Common" />
</ItemGroup>
```

.NET 6+ projects enable **implicit usings** by default, which automatically includes common namespaces based on project type:

```xml
<PropertyGroup>
  <ImplicitUsings>enable</ImplicitUsings>
</PropertyGroup>
```

For console and class library projects, implicit usings include `System`, `System.Collections.Generic`, `System.IO`, `System.Linq`, `System.Threading.Tasks`, and others.

**Best practice**: Keep `<ImplicitUsings>enable</ImplicitUsings>` on (the default for .NET 6+ projects) and consolidate any additional global usings in a single `GlobalUsings.cs` file at the project root. Only globalize namespaces that genuinely appear across most files in the project, like shared domain models or common extensions. Avoid globalizing third-party library namespaces, as they are more likely to cause naming conflicts and make dependencies harder to trace when reading a file in isolation.

### Type Aliases (C# 12)

The most common and well-established use of `using` aliases is resolving namespace conflicts:

```csharp
// Resolving ambiguity between namespaces
using WinForms = System.Windows.Forms;
using WebUI = System.Web.UI;

WinForms.Button desktopButton = new();
WebUI.Button webButton = new();
```

C# 12 expanded `using` aliases to support any type, including tuples, arrays, and generics:

```csharp
using Point = (int X, int Y);
using IntList = System.Collections.Generic.List<int>;
using Matrix = int[][];
```

**Best practice**: Use type aliases primarily for resolving namespace conflicts. If a concept is meaningful enough to deserve a name, it is usually meaningful enough to be a proper type like a `record struct` or a class. Aliasing a tuple gives it a name without giving it behavior, validation, or discoverability across the project. Similarly, aliasing standard generics like `List<int>` hides a familiar type behind a non-standard name without adding real value. Prefer promoting meaningful concepts to proper types rather than giving them nicknames through aliases.

## Tuples

Tuples group multiple values without defining a formal type. C# 7.0 introduced value tuples with named elements.

```csharp
(string Name, int Age) person = ("Alice", 30);
var (name, age) = person;  // deconstruction

var t1 = (1, "hello");
var t2 = (1, "hello");
bool equal = t1 == t2; // true - structural comparison
```

### When Tuples Are the Wrong Choice

Most tuple usage in OOP is someone avoiding the small cost of a type definition. A `(bool Success, string Message, int Code)` is not a tuple; it is a `ValidationResult`. If you are naming the elements, you have already identified a concept that deserves a real type.

```csharp
// Tuple misuse: what does this return?
public (bool, string, int) ValidateUser(string input) { ... }
var result = ValidateUser("test");
if (result.Item1) // Item1 means... what?

// Give the concept a type instead
public record ValidationResult(bool Success, string Message, int Code);
```

Named element names are erased during compilation. Anything that consumes the tuple through reflection, serialization, or across assemblies sees `Item1`, `Item2`, `Item3`. The name is a courtesy, not a contract.

Two other warning signs: if the tuple has three or more elements, positional ordering becomes a silent bug risk. If it crosses a public API boundary, consumers lose all semantic context and you cannot evolve the return shape without breaking callers.

### When Tuples Belong

Tuples work when the grouping is *temporary, local, and obvious from context*.

```csharp
// Private helper returns within a class
private (int quotient, int remainder) DivideWithRemainder(int a, int b)
    => (a / b, a % b);

// Compound dictionary keys (structural Equals/GetHashCode)
var sales = new Dictionary<(string Region, int Year), decimal>();

// Intermediate LINQ groupings
var top = employees
    .Select(e => (Employee: e, Score: CalculateScore(e)))
    .Where(x => x.Score > 90)
    .OrderByDescending(x => x.Score)
    .Select(x => x.Employee);

// Pattern matching
string Classify(int temp, bool rain) => (temp, rain) switch
{
    ( > 30, false) => "Hot and dry",
    ( < 0, _)      => "Freezing",
    (_, true)       => "Rainy",
    _               => "Mild"
};
```

### When a Tuple Outgrows Its Scope

A `record struct` is the natural promotion path. You get named fields, value equality, deconstruction, and `ToString` for nearly the same amount of code.

```csharp
public readonly record struct Coordinate(double Latitude, double Longitude);

var a = new Coordinate(47.6, -122.3);
var (lat, lon) = a;  // deconstruction still works
```

## Key Takeaways

**Value vs Reference**: Value types copy data; reference types share data. This affects equality comparison, parameter passing, and memory behavior.

**Choose the right numeric type**: Use `int` for general integers, `decimal` for financial calculations, and `double` for scientific computing.

**Prefer type inference when types are obvious**: `var` reduces noise but shouldn't obscure what you're working with.

**Use nullable types intentionally**: Nullable value types (`int?`) explicitly model optional values. Combined with nullable reference types (C# 8+), you can eliminate most null reference exceptions.

**Avoid boxing**: Use generic collections and methods to prevent unnecessary heap allocations from value type boxing.

**Use tuples sparingly**: Tuples belong in private, local, obvious contexts like LINQ projections, dictionary keys, and pattern matching. If you are naming the elements, you have identified a concept that deserves a `record struct` or class.

**Embrace modern namespace features**: File-scoped namespaces reduce indentation noise, global usings eliminate repetitive imports, and type aliases provide semantic names for complex types like tuples.
