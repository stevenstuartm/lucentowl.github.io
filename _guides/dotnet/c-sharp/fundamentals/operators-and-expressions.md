---
title: "C# Operators and Expressions"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Complete guide to C# operators from arithmetic basics to modern pattern matching, null handling, and expression-bodied members."
tags: [c-sharp, dotnet, fundamentals, operators, pattern-matching, practical]
---

## Arithmetic Operators

Standard mathematical operations with predictable precedence matching mathematical convention.

```csharp
int a = 10, b = 3;

int sum = a + b;        // 13
int diff = a - b;       // 7
int product = a * b;    // 30
int quotient = a / b;   // 3 (integer division truncates)
int remainder = a % b;  // 1 (modulo)

// Floating-point division
double precise = 10.0 / 3.0;  // 3.333...

// Increment/decrement
int x = 5;
int preIncrement = ++x;   // x becomes 6, returns 6
int postIncrement = x++;  // returns 6, then x becomes 7

// Compound assignment
int count = 10;
count += 5;   // count = count + 5 → 15
count -= 3;   // count = count - 3 → 12
count *= 2;   // count = count * 2 → 24
count /= 4;   // count = count / 4 → 6
```

<div class="callout callout--warning">
<p class="callout__title">Checked and Unchecked Arithmetic</p>
<p>By default, integer overflow wraps silently. Use <code>checked</code> for explicit overflow detection in critical calculations. Use <code>unchecked</code> when intentional wrapping is needed, like in hash code implementations.</p>
</div>

### Checked and Unchecked Arithmetic

By default, integer overflow wraps silently. Use `checked` for explicit overflow detection.

```csharp
int max = int.MaxValue;

// Default - wraps silently
int wrapped = max + 1;  // -2147483648 (wrapped to MinValue)

// Checked - throws OverflowException
try
{
    int overflow = checked(max + 1);
}
catch (OverflowException)
{
    Console.WriteLine("Overflow detected");
}

// Checked block for multiple operations
checked
{
    int result = max + 1; // Throws
}

// Unchecked - explicitly allow wrapping
unchecked
{
    int hash = someValue * 397; // Intentional wrapping for hash codes
}
```

## Comparison Operators

Return boolean values for conditional logic.

```csharp
int x = 5, y = 10;

bool equal = x == y;          // false
bool notEqual = x != y;       // true
bool lessThan = x < y;        // true
bool greaterThan = x > y;     // false
bool lessOrEqual = x <= y;    // true
bool greaterOrEqual = x >= y; // false

// Reference equality vs value equality
string a = "hello";
string b = "hello";
bool valueEqual = a == b;           // true (string overloads ==)
bool refEqual = ReferenceEquals(a, b); // true (interned strings)

var list1 = new List<int> { 1, 2, 3 };
var list2 = new List<int> { 1, 2, 3 };
bool listsEqual = list1 == list2;   // false (reference comparison)
bool seqEqual = list1.SequenceEqual(list2); // true (value comparison)
```

## Logical Operators

Boolean logic with short-circuit evaluation.

```csharp
bool a = true, b = false;

// Logical AND - both must be true
bool and = a && b;    // false

// Logical OR - at least one must be true
bool or = a || b;     // true

// Logical NOT
bool not = !a;        // false

// Short-circuit evaluation
string text = null;
// Safe - Length never accessed if text is null
if (text != null && text.Length > 0)
{
    Console.WriteLine(text);
}

// Non-short-circuit (bitwise on bools) - rarely needed
bool both = a & b;    // Evaluates both sides always
bool either = a | b;

// XOR - exactly one must be true
bool xor = a ^ b;     // true
```

## Null Handling Operators

Modern C# provides elegant operators for null-safe code.

### Null-Coalescing Operator (??)

Returns left operand if not null; otherwise returns right operand.

```csharp
string name = userInput ?? "Anonymous";
int count = nullableCount ?? 0;

// Chain multiple fallbacks
string display = firstName ?? lastName ?? "Unknown";

// With method calls
var result = GetCachedValue() ?? ComputeExpensiveValue();
```

### Null-Coalescing Assignment (??=)

Assigns only if the variable is null. (C# 8.0)

```csharp
string name = null;
name ??= "Default";  // name is now "Default"

name ??= "Other";    // name stays "Default" (not null)

// Common pattern for lazy initialization
private List<string> _cache;
public List<string> Cache => _cache ??= new List<string>();
```

### Null-Conditional Operator (?.)

Accesses members only if the object is not null; otherwise returns null.

```csharp
string name = customer?.Name;  // null if customer is null
int? length = text?.Length;    // null if text is null

// Chain multiple accesses
string city = order?.Customer?.Address?.City;

// With method calls
customer?.SendNotification();

// With indexers
var first = list?[0];
var value = dictionary?["key"];

// Combine with null-coalescing
string displayName = customer?.Name ?? "Guest";
int nameLength = text?.Length ?? 0;
```

### Null-Forgiving Operator (!)

Tells the compiler you know a value isn't null. (C# 8.0 with nullable reference types)

```csharp
#nullable enable

string? nullable = GetPossiblyNullString();

// You've validated it's not null
if (nullable != null)
{
    // Compiler still warns here without !
    string definitelyNotNull = nullable!;
}

// Common after validation
var item = dictionary.TryGetValue(key, out var value)
    ? value!
    : throw new KeyNotFoundException();
```

## Bitwise Operators

Operate on individual bits of integer types.

```csharp
int a = 0b_1010;  // 10 in binary
int b = 0b_1100;  // 12 in binary

int and = a & b;   // 0b_1000 = 8  (bits set in both)
int or = a | b;    // 0b_1110 = 14 (bits set in either)
int xor = a ^ b;   // 0b_0110 = 6  (bits set in one but not both)
int not = ~a;      // Inverts all bits

// Bit shifts
int left = a << 2;  // 0b_101000 = 40 (multiply by 4)
int right = a >> 1; // 0b_0101 = 5   (divide by 2)

// Practical use: flags
[Flags]
enum Permissions { Read = 1, Write = 2, Execute = 4 }

var perms = Permissions.Read | Permissions.Write;
bool canWrite = (perms & Permissions.Write) != 0; // true

// Set a flag
perms |= Permissions.Execute;

// Clear a flag
perms &= ~Permissions.Write;

// Toggle a flag
perms ^= Permissions.Read;
```

## Type Testing and Conversion

### is Operator

Tests if an expression is of a given type.

```csharp
object obj = "hello";

// Simple type check
if (obj is string)
{
    Console.WriteLine("It's a string");
}

// Pattern matching with variable (C# 7.0)
if (obj is string text)
{
    Console.WriteLine(text.ToUpper()); // text is string type
}

// Negated pattern (C# 9.0)
if (obj is not null)
{
    Console.WriteLine(obj.ToString());
}

// Constant patterns
if (count is 0)
{
    Console.WriteLine("Empty");
}

// Relational patterns (C# 9.0)
if (age is >= 18 and < 65)
{
    Console.WriteLine("Working age");
}
```

### as Operator

Attempts cast, returns null on failure instead of throwing.

```csharp
object obj = GetSomething();

// as returns null if cast fails
string text = obj as string;
if (text != null)
{
    Console.WriteLine(text.Length);
}

// Prefer 'is' with pattern matching
if (obj is string str)
{
    Console.WriteLine(str.Length);
}
```

### typeof and nameof

```csharp
// typeof - gets Type object at compile time
Type stringType = typeof(string);
Type listType = typeof(List<>);  // Open generic
Type closedType = typeof(List<int>);  // Closed generic

// GetType() - gets runtime type
object obj = "hello";
Type runtimeType = obj.GetType();  // System.String

// nameof - gets name as string at compile time (C# 6.0)
string propName = nameof(Customer.Name);  // "Name"
string varName = nameof(count);           // "count"

// Useful for exceptions and logging
throw new ArgumentNullException(nameof(customer));
logger.LogDebug("Processing {Variable}", nameof(order));
```

## Conditional Operator (Ternary)

Inline conditional expression returning one of two values.

```csharp
int max = a > b ? a : b;
string status = isActive ? "Active" : "Inactive";

// Nested (use sparingly)
string grade = score >= 90 ? "A"
             : score >= 80 ? "B"
             : score >= 70 ? "C"
             : "F";

// With null types
int? nullable = condition ? 42 : null;

// Can throw
string value = input ?? throw new ArgumentNullException(nameof(input));
```

## Range and Index Operators

Access sequences from either end and extract slices. (C# 8.0)

### Index Operator (^)

```csharp
int[] numbers = { 0, 1, 2, 3, 4, 5 };

int last = numbers[^1];     // 5 (last element)
int secondLast = numbers[^2]; // 4
int first = numbers[0];     // 0

// Equivalent to
int lastOld = numbers[numbers.Length - 1];
```

### Range Operator (..)

```csharp
int[] numbers = { 0, 1, 2, 3, 4, 5 };

int[] slice = numbers[1..4];    // { 1, 2, 3 } (end exclusive)
int[] fromStart = numbers[..3]; // { 0, 1, 2 }
int[] toEnd = numbers[3..];     // { 3, 4, 5 }
int[] lastThree = numbers[^3..]; // { 3, 4, 5 }
int[] copy = numbers[..];       // Full copy

// Works with strings
string text = "Hello, World!";
string hello = text[..5];       // "Hello"
string world = text[7..^1];     // "World"

// Works with Span<T>
Span<int> span = numbers.AsSpan()[1..4];
```

## Pattern Matching Expressions

Modern C# supports sophisticated pattern matching beyond simple type checks.

### Switch Expressions (C# 8.0)

Concise pattern-based branching that returns a value.

```csharp
string GetDayType(DayOfWeek day) => day switch
{
    DayOfWeek.Saturday or DayOfWeek.Sunday => "Weekend",
    _ => "Weekday"
};

string Classify(int number) => number switch
{
    < 0 => "Negative",
    0 => "Zero",
    > 0 and < 10 => "Single digit",
    >= 10 and < 100 => "Double digit",
    _ => "Large"
};

// Property patterns
string GetDiscount(Customer c) => c switch
{
    { IsPremium: true, YearsActive: > 5 } => "25%",
    { IsPremium: true } => "15%",
    { YearsActive: > 10 } => "10%",
    _ => "0%"
};

// Tuple patterns for multiple inputs
string GetQuadrant(int x, int y) => (x, y) switch
{
    (0, 0) => "Origin",
    (> 0, > 0) => "Q1",
    (< 0, > 0) => "Q2",
    (< 0, < 0) => "Q3",
    (> 0, < 0) => "Q4",
    _ => "On axis"
};
```

### Pattern Types

```csharp
object value = GetValue();

// Type pattern
if (value is int number) { }

// Declaration pattern with when clause
if (value is string { Length: > 0 } text) { }

// Var pattern (always matches, captures value)
if (value is var v && ProcessValue(v)) { }

// Discard pattern
if (value is not null and not "") { }

// List patterns (C# 11)
int[] arr = { 1, 2, 3 };
if (arr is [1, 2, 3]) { }                    // Exact match
if (arr is [1, ..]) { }                      // Starts with 1
if (arr is [_, var second, _]) { }           // Capture middle
if (arr is [var first, .. var rest]) { }     // Slice pattern
```

## Expression-Bodied Members

Concise syntax for single-expression members. (C# 6.0+)

```csharp
public class Circle
{
    private double radius;

    // Constructor (C# 7.0)
    public Circle(double radius) => this.radius = radius;

    // Finalizer (C# 7.0)
    ~Circle() => Console.WriteLine("Disposed");

    // Property getter
    public double Diameter => radius * 2;

    // Property with getter and setter (C# 7.0)
    public double Radius
    {
        get => radius;
        set => radius = value > 0 ? value : throw new ArgumentException();
    }

    // Read-only property
    public double Area => Math.PI * radius * radius;

    // Method
    public double Circumference() => 2 * Math.PI * radius;

    // Indexer
    public char this[int index] => name[index];

    // Operator
    public static Circle operator +(Circle a, Circle b)
        => new Circle(a.radius + b.radius);
}
```

## Lambda Expressions

Anonymous functions for inline delegate definitions.

```csharp
// Expression lambda
Func<int, int> square = x => x * x;
Func<int, int, int> add = (a, b) => a + b;

// Statement lambda (for multiple statements)
Func<int, int> factorial = n =>
{
    int result = 1;
    for (int i = 2; i <= n; i++)
        result *= i;
    return result;
};

// With explicit types
Func<string, int> parse = (string s) => int.Parse(s);

// Discards for unused parameters
button.Click += (_, _) => HandleClick();

// Static lambdas - cannot capture variables (C# 9.0)
Func<int, int> staticLambda = static x => x * 2;

// Natural delegate type inference (C# 10)
var greet = (string name) => $"Hello, {name}";
var action = () => Console.WriteLine("Done");

// Common LINQ usage
var adults = people.Where(p => p.Age >= 18);
var names = people.Select(p => p.Name);
var sorted = people.OrderBy(p => p.LastName)
                   .ThenBy(p => p.FirstName);
```

## Operator Precedence

From highest to lowest precedence:

| Category | Operators |
|----------|-----------|
| Primary | `x.y` `x?.y` `f(x)` `a[i]` `a?[i]` `x++` `x--` `new` `typeof` `checked` `unchecked` `default` `nameof` |
| Unary | `+` `-` `!` `~` `++x` `--x` `(T)x` `await` `^x` |
| Range | `x..y` |
| Switch/with | `switch` `with` |
| Multiplicative | `*` `/` `%` |
| Additive | `+` `-` |
| Shift | `<<` `>>` `>>>` |
| Relational | `<` `>` `<=` `>=` `is` `as` |
| Equality | `==` `!=` |
| Bitwise AND | `&` |
| Bitwise XOR | `^` |
| Bitwise OR | `\|` |
| Logical AND | `&&` |
| Logical OR | `\|\|` |
| Null-coalescing | `??` |
| Conditional | `?:` |
| Assignment | `=` `+=` `-=` `*=` `/=` `%=` `&=` `^=` `\|=` `<<=` `>>=` `??=` |
| Lambda | `=>` |

When in doubt, use parentheses to make intent explicit.

## Key Takeaways

**Use null operators liberally**: The `?.`, `??`, and `??=` operators eliminate defensive null checking boilerplate and make intent clear.

**Prefer pattern matching over type checks**: `if (obj is string text)` is cleaner than checking type then casting.

**Switch expressions for mapping**: When you need to map input to output based on patterns, switch expressions are more readable than if-else chains.

**Expression bodies for simple members**: Use `=>` for properties, methods, and constructors that are single expressions, but don't force complex logic into this form.

**Range operators for slicing**: Use `[1..^1]` syntax instead of Substring or array copying when working with sequences.
