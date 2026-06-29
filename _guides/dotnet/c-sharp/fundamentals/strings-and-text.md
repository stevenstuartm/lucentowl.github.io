---
title: "C# Strings and Text Processing"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "String manipulation, StringBuilder, string interpolation, formatting, parsing, and high-performance text processing."
tags: [c-sharp, dotnet, fundamentals, strings, text-processing, performance, practical]
---

## String Fundamentals

Strings in C# are immutable reference types. Every modification creates a new string object.

```csharp
string greeting = "Hello";
string modified = greeting + " World";  // Creates new string
// greeting is still "Hello"

// String interning - identical literals share memory
string a = "hello";
string b = "hello";
bool same = ReferenceEquals(a, b);  // true - same object

// Runtime strings not interned by default
string c = new string(new[] { 'h', 'e', 'l', 'l', 'o' });
bool notSame = ReferenceEquals(a, c);  // false
```

## String Creation

### Literals and Verbatim Strings

```csharp
// Regular string - escape sequences processed
string path = "C:\\Users\\Name\\Documents";
string newline = "Line 1\nLine 2";
string tab = "Col1\tCol2";

// Verbatim string @ - escape sequences not processed
string verbatimPath = @"C:\Users\Name\Documents";
string multiLine = @"First line
Second line
Third line";

// Double quotes in verbatim
string quoted = @"She said ""Hello""";
```

### Raw String Literals (C# 11)

```csharp
// Raw strings - preserve whitespace and quotes
string json = """
    {
        "name": "Alice",
        "age": 30
    }
    """;

// Number of quotes determines delimiter
string withQuotes = """"
    He said """Hello"""
    """";

// With interpolation
int age = 30;
string interpolated = $"""
    {
        "name": "Alice",
        "age": {age}
    }
    """;
```

### UTF-8 String Literals (C# 11)

C# strings are internally encoded as UTF-16, where each character uses two or more bytes. Most I/O operations like HTTP, file streams, and network protocols use UTF-8 instead. Without the `u8` suffix, converting a string to UTF-8 requires a runtime call like `Encoding.UTF8.GetBytes()`, which encodes the characters on every invocation and allocates a new byte array each time.

```csharp
// Without u8: runtime encoding + heap allocation on every call
byte[] headerBytes = Encoding.UTF8.GetBytes("Content-Type: application/json\r\n");
```

The `u8` suffix tells the compiler to encode the string as UTF-8 bytes at compile time and embed them directly in the assembly. The result is a `ReadOnlySpan<byte>` (a lightweight view over contiguous memory, covered in detail in [High-Performance String Operations](#high-performance-string-operations)) with zero runtime encoding cost and zero heap allocation.

```csharp
// With u8: bytes are baked into the compiled assembly, nothing happens at runtime
ReadOnlySpan<byte> utf8 = "Hello"u8;

// Useful for HTTP headers, protocols, and APIs expecting UTF-8
stream.Write("Content-Type: application/json\r\n"u8);

// Convert to byte array when needed
byte[] jsonBytes = """{"name":"test"}"""u8.ToArray();

// Combine with raw strings for multi-line UTF-8
ReadOnlySpan<byte> httpResponse = """
    HTTP/1.1 200 OK
    Content-Type: text/plain

    Hello, World!
    """u8;
```

This is most valuable in performance-sensitive paths like web servers, serialization, and protocol handling where the same constant strings are written as UTF-8 bytes repeatedly.

### String Interpolation

```csharp
string name = "Alice";
int age = 30;

// Basic interpolation
string message = $"Hello, {name}! You are {age} years old.";

// With formatting
decimal price = 19.99m;
string formatted = $"Price: {price:C2}";  // Price: $19.99

DateTime date = DateTime.Now;
string dateStr = $"Date: {date:yyyy-MM-dd}";

// Alignment
string aligned = $"|{name,-10}|{age,5}|";  // |Alice     |   30|

// Expressions
string expr = $"Next year: {age + 1}";
string conditional = $"Status: {(age >= 18 ? "Adult" : "Minor")}";

// Raw interpolation for JSON (C# 11)
string jsonTemplate = $$"""
    {
        "name": "{{name}}",
        "age": {{age}}
    }
    """;
```

## String Comparison

<div class="callout callout--tip">
<p class="callout__title">Choosing the Right String Comparison</p>
<ul>
<li><strong>For identifiers, paths, keys</strong>: Use <code>Ordinal</code> or <code>OrdinalIgnoreCase</code> (fastest)</li>
<li><strong>For user-facing text</strong>: Use <code>CurrentCulture</code></li>
<li><strong>For persisted data</strong>: Use <code>InvariantCulture</code></li>
</ul>
</div>

### Comparison Types

```csharp
string a = "hello";
string b = "Hello";

// Ordinal (byte-by-byte) - fastest, case-sensitive
bool ordinal = string.Equals(a, b, StringComparison.Ordinal);  // false

// OrdinalIgnoreCase - fast, case-insensitive
bool ordinalIgnore = string.Equals(a, b, StringComparison.OrdinalIgnoreCase);  // true

// CurrentCulture - culture-aware
bool culture = string.Equals(a, b, StringComparison.CurrentCulture);

// InvariantCulture - consistent across cultures
bool invariant = string.Equals(a, b, StringComparison.InvariantCultureIgnoreCase);
```

### Comparison Methods

```csharp
// Equality
bool equal = string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
bool opEqual = a == b;  // Uses Ordinal

// Comparison (for sorting)
int result = string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
// < 0: a before b, = 0: equal, > 0: a after b

// Contains, StartsWith, EndsWith
bool contains = a.Contains("ell", StringComparison.OrdinalIgnoreCase);
bool starts = a.StartsWith("he", StringComparison.OrdinalIgnoreCase);
bool ends = a.EndsWith("lo", StringComparison.OrdinalIgnoreCase);
```

## String Manipulation

### Basic Operations

```csharp
string text = "  Hello, World!  ";

// Case conversion
string upper = text.ToUpper();           // "  HELLO, WORLD!  "
string lower = text.ToLower();           // "  hello, world!  "
string upperInvariant = text.ToUpperInvariant();  // Culture-independent

// Trimming
string trimmed = text.Trim();            // "Hello, World!"
string trimStart = text.TrimStart();     // "Hello, World!  "
string trimEnd = text.TrimEnd();         // "  Hello, World!"
string trimChars = "###Hello###".Trim('#');  // "Hello"

// Padding
string padLeft = "42".PadLeft(5, '0');   // "00042"
string padRight = "Hi".PadRight(5);      // "Hi   "

// Substring
string sub = "Hello, World!".Substring(7, 5);  // "World"
string fromIndex = "Hello, World!"[7..];       // "World!" (range)

// Replace
string replaced = text.Replace("World", "Universe");
string charReplace = text.Replace(',', ';');
```

### Splitting and Joining

```csharp
// Split
string csv = "apple,banana,cherry";
string[] parts = csv.Split(',');  // ["apple", "banana", "cherry"]

// Split with options
string spaced = "a  b   c";
string[] noEmpty = spaced.Split(' ', StringSplitOptions.RemoveEmptyEntries);
// ["a", "b", "c"]

// Split with multiple separators
string mixed = "a,b;c|d";
string[] mixedParts = mixed.Split(new[] { ',', ';', '|' });

// Split with limit
string limited = "a,b,c,d,e".Split(',', 3);  // ["a", "b", "c,d,e"]

// Join
string joined = string.Join(", ", parts);  // "apple, banana, cherry"
string joinedArray = string.Join("-", new[] { 1, 2, 3 });  // "1-2-3"

// Concat
string concat = string.Concat("Hello", " ", "World");
string concatArray = string.Concat(new[] { "a", "b", "c" });  // "abc"
```

### Searching

```csharp
string text = "Hello, World! Hello again!";

// Index of
int index = text.IndexOf("Hello");           // 0
int lastIndex = text.LastIndexOf("Hello");   // 14
int indexIgnoreCase = text.IndexOf("hello", StringComparison.OrdinalIgnoreCase);

// Index of any
int anyIndex = text.IndexOfAny(new[] { 'o', 'e' });  // 1

// Contains
bool contains = text.Contains("World");
bool containsIgnoreCase = text.Contains("world", StringComparison.OrdinalIgnoreCase);
```

## StringBuilder

For building strings incrementally, especially in loops.

```csharp
var sb = new StringBuilder();

// Append
sb.Append("Hello");
sb.Append(' ');
sb.Append("World");
sb.AppendLine("!");
sb.AppendLine("Second line");

// Append formatted
sb.AppendFormat("Price: {0:C2}", 19.99);
sb.Append($"Date: {DateTime.Now:d}");

// Insert
sb.Insert(0, "Greeting: ");

// Replace
sb.Replace("World", "Universe");

// Remove
sb.Remove(0, 10);  // Remove first 10 characters

// Clear
sb.Clear();

// Get result
string result = sb.ToString();

// Capacity management
var sbCapacity = new StringBuilder(initialCapacity: 1000);
sbCapacity.EnsureCapacity(2000);

// Chaining
var chained = new StringBuilder()
    .Append("Hello")
    .Append(' ')
    .Append("World")
    .ToString();
```

### When to Use StringBuilder

```csharp
// BAD - creates many intermediate strings
string result = "";
for (int i = 0; i < 1000; i++)
{
    result += i.ToString();  // O(n²) - each += creates new string
}

// GOOD - efficient
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++)
{
    sb.Append(i);  // O(n)
}
string result = sb.ToString();

// Single concatenation is fine
string simple = a + b + c;  // Compiler optimizes this

// Use string.Join for collections
string joined = string.Join(",", items);  // Better than loop
```

## Formatting

### Composite Formatting

```csharp
// Format with placeholders
string formatted = string.Format("Hello, {0}! You are {1} years old.", name, age);

// With format specifiers
string currency = string.Format("{0:C}", 1234.56);      // $1,234.56
string number = string.Format("{0:N2}", 1234.5678);     // 1,234.57
string percent = string.Format("{0:P1}", 0.1234);       // 12.3%
string hex = string.Format("{0:X}", 255);               // FF
string date = string.Format("{0:yyyy-MM-dd}", DateTime.Now);

// Alignment
string left = string.Format("{0,-10}", "Hi");    // "Hi        "
string right = string.Format("{0,10}", "Hi");    // "        Hi"
```

### Custom Format Strings

```csharp
// Numeric
double value = 1234.5678;
value.ToString("F2");        // "1234.57" - fixed point
value.ToString("N2");        // "1,234.57" - number with separators
value.ToString("E2");        // "1.23E+003" - scientific
value.ToString("0.00");      // "1234.57" - custom
value.ToString("#,##0.00");  // "1,234.57" - custom with grouping

// Date/Time
DateTime dt = DateTime.Now;
dt.ToString("yyyy-MM-dd");           // "2024-01-15"
dt.ToString("HH:mm:ss");             // "14:30:45"
dt.ToString("MMMM dd, yyyy");        // "January 15, 2024"
dt.ToString("dddd");                 // "Monday"
dt.ToString("o");                    // ISO 8601

// TimeSpan
TimeSpan ts = TimeSpan.FromHours(2.5);
ts.ToString(@"hh\:mm\:ss");          // "02:30:00"
```

### IFormattable

```csharp
public class Temperature : IFormattable
{
    public double Celsius { get; }

    public Temperature(double celsius) => Celsius = celsius;

    public string ToString(string? format, IFormatProvider? formatProvider)
    {
        return format?.ToUpperInvariant() switch
        {
            "C" => $"{Celsius:F1}°C",
            "F" => $"{Celsius * 9 / 5 + 32:F1}°F",
            "K" => $"{Celsius + 273.15:F1}K",
            _ => $"{Celsius:F1}°C"
        };
    }
}

var temp = new Temperature(25);
Console.WriteLine($"{temp:C}");  // "25.0°C"
Console.WriteLine($"{temp:F}");  // "77.0°F"
```

## Parsing

### Basic Parsing

```csharp
// Parse - throws on failure
int number = int.Parse("42");
double d = double.Parse("3.14");
DateTime date = DateTime.Parse("2024-01-15");

// TryParse - safe, returns bool
if (int.TryParse(input, out int result))
{
    Console.WriteLine($"Parsed: {result}");
}
else
{
    Console.WriteLine("Invalid input");
}

// With format provider
decimal price = decimal.Parse("1,234.56", CultureInfo.InvariantCulture);

// Exact date parsing
DateTime exact = DateTime.ParseExact(
    "15/01/2024",
    "dd/MM/yyyy",
    CultureInfo.InvariantCulture);
```

### Span-Based Parsing (High Performance)

```csharp
ReadOnlySpan<char> input = "42".AsSpan();

// No allocation parsing
if (int.TryParse(input, out int value))
{
    Console.WriteLine(value);
}

// Parse from middle of string without substring
string text = "Value: 42 units";
ReadOnlySpan<char> numberSpan = text.AsSpan(7, 2);
int parsed = int.Parse(numberSpan);
```

## High-Performance String Operations

### What Is a Span?

`Span<T>` and `ReadOnlySpan<T>` are stack-allocated types that represent a contiguous region of memory without owning it. Think of a span as a window into existing data: it holds a pointer and a length, but it does not copy or allocate anything on the heap.

For string work, `ReadOnlySpan<char>` lets you slice, search, and compare portions of a string without calling `Substring()`, which would allocate an entirely new string object each time. The `.AsSpan()` method creates this window over the string's existing character buffer.

```csharp
string text = "Hello, World!";

// Substring allocates a new string on the heap
string sub = text.Substring(0, 5);  // "Hello" — new object, new memory

// AsSpan creates a view into the original string's memory — no allocation
ReadOnlySpan<char> span = text.AsSpan(0, 5);  // "Hello" — same memory, just a pointer + length
```

Spans come in two forms. `Span<T>` allows reading and writing, while `ReadOnlySpan<T>` is read-only. Since strings are immutable, string spans are always `ReadOnlySpan<char>`. Both types are `ref struct`s, which means they can only live on the stack and cannot be stored in fields, captured in lambdas, or used across `await` boundaries. This constraint is what makes them safe: the runtime guarantees the memory they point to stays valid for as long as the span exists.

### Span-Based String Manipulation

```csharp
string text = "Hello, World!";
ReadOnlySpan<char> span = text.AsSpan();

// Slice without allocation
ReadOnlySpan<char> hello = span[..5];       // "Hello"
ReadOnlySpan<char> world = span[7..12];     // "World"

// Searching
int index = span.IndexOf(',');
int lastIndex = span.LastIndexOf('o');

// Comparison
bool equals = span.SequenceEqual("Hello, World!");
bool startsWith = span.StartsWith("Hello");

// Trimming (returns span, no allocation)
ReadOnlySpan<char> trimmed = "  hello  ".AsSpan().Trim();
```

### string.Create

Create strings efficiently with a buffer.

```csharp
// Create string with exact length, populate via span
string result = string.Create(10, 42, (chars, state) =>
{
    state.TryFormat(chars, out int written);
    chars[written..].Fill('0');
});

// More complex example
string formatted = string.Create(20, (name: "Alice", age: 30), (chars, state) =>
{
    int pos = 0;
    state.name.AsSpan().CopyTo(chars);
    pos += state.name.Length;
    chars[pos++] = ':';
    state.age.TryFormat(chars[pos..], out int written);
});
```

### SearchValues (.NET 8)

Methods like `IndexOfAny(char[])` accept a set of characters to search for, but they receive a fresh array on each call and have no opportunity to precompute an efficient lookup structure. For small sets this is fine, but when searching for many values across large or frequently scanned text, the per-call overhead adds up.

`SearchValues<T>` solves this by letting you create the set once at startup. Internally, the runtime picks the best algorithm for the set size and contents, which might be a vectorized bitfield, a hash set, or a simple lookup table. Subsequent calls to `IndexOfAny` pass this precomputed structure instead of a raw array, so the hot path does no setup work at all.

```csharp
// Create once at startup — runtime chooses the optimal search strategy
private static readonly SearchValues<char> Vowels =
    SearchValues.Create("aeiouAEIOU");

public int CountVowels(ReadOnlySpan<char> text)
{
    int count = 0;
    int index;
    while ((index = text.IndexOfAny(Vowels)) >= 0)
    {
        count++;
        text = text[(index + 1)..];
    }
    return count;
}
```

### CompositeFormat (.NET 8)

When you call `string.Format("[{0:HH:mm:ss}] {1}: {2}", ...)`, the runtime parses the format string every time to find the `{0}`, `{1}`, `{2}` placeholders and their format specifiers. For a format string used once this is negligible, but in hot paths like logging or serialization where the same pattern runs thousands of times per second, that repeated parsing becomes measurable overhead.

`CompositeFormat` lets you parse the format string once at startup and reuse the result. The `Parse` call analyzes the placeholders and format specifiers up front, so subsequent `string.Format` calls skip the parsing step entirely and go straight to substitution.

```csharp
// Parse once at startup — placeholders and format specifiers are pre-analyzed
private static readonly CompositeFormat LogFormat =
    CompositeFormat.Parse("[{0:HH:mm:ss}] {1}: {2}");

public void Log(string level, string message)
{
    // Formatting still happens at runtime, but the format string is not re-parsed
    string formatted = string.Format(null, LogFormat, DateTime.Now, level, message);
    Console.WriteLine(formatted);
}
```

## Regular Expressions

### Basic Patterns

```csharp
using System.Text.RegularExpressions;

string text = "Contact: john@example.com or jane@test.org";

// Simple match
bool hasEmail = Regex.IsMatch(text, @"\w+@\w+\.\w+");

// Find match
Match match = Regex.Match(text, @"\w+@\w+\.\w+");
if (match.Success)
{
    Console.WriteLine(match.Value);  // john@example.com
}

// Find all matches
MatchCollection matches = Regex.Matches(text, @"\w+@\w+\.\w+");
foreach (Match m in matches)
{
    Console.WriteLine(m.Value);
}

// Replace
string replaced = Regex.Replace(text, @"\w+@\w+\.\w+", "[EMAIL]");
```

### Compiled and Source-Generated Regex

The regex engine has three performance tiers, each shifting more work out of the runtime hot path.

**Interpreted (default).** When you call `Regex.IsMatch(text, pattern)` or `new Regex(pattern)`, the runtime parses the pattern into an internal representation and walks it step-by-step against the input each time. This is fine for one-off or infrequent use, but the interpretation overhead is noticeable if the same pattern runs in a tight loop.

**Compiled.** Adding `RegexOptions.Compiled` tells the runtime to emit IL (intermediate language) bytecode for the pattern the first time it runs. Subsequent matches execute that generated IL directly instead of interpreting the pattern tree, which is significantly faster for repeated use. The tradeoff is a one-time startup cost to JIT-compile the generated IL and a small increase in memory for the compiled code.

```csharp
// Compiled: IL is generated at runtime on first use, then JIT-compiled
private static readonly Regex EmailRegex = new(
    @"\w+@\w+\.\w+",
    RegexOptions.Compiled);
```

**Source-generated (.NET 7+).** The `[GeneratedRegex]` attribute moves compilation from runtime to build time. The C# source generator analyzes the pattern during compilation and emits an optimized C# implementation directly into your assembly. This eliminates the runtime startup cost of `Compiled`, produces code that the JIT compiler can optimize further since it is now regular C# rather than dynamically emitted IL, and makes the generated matching logic visible and debuggable in your project. The method must be `static partial` so the source generator can provide the implementation.

```csharp
// Source-generated: the compiler writes an optimized C# implementation at build time
[GeneratedRegex(@"\w+@\w+\.\w+", RegexOptions.IgnoreCase)]
private static partial Regex EmailRegexGenerated();

// Usage is identical to any other Regex instance
bool hasEmail = EmailRegexGenerated().IsMatch(text);
```

For patterns known at compile time that run frequently, source-generated regex gives the best performance with no runtime compilation cost. Use `Compiled` when patterns are only known at runtime but will be reused. Use interpreted for patterns that run rarely or are constructed dynamically and discarded.

### Groups and Captures

```csharp
string input = "John Doe (john@example.com)";
var pattern = @"(?<name>\w+ \w+) \((?<email>\w+@\w+\.\w+)\)";

Match match = Regex.Match(input, pattern);
if (match.Success)
{
    string name = match.Groups["name"].Value;   // "John Doe"
    string email = match.Groups["email"].Value; // "john@example.com"
}
```

## String Interning

The CLR maintains an internal hash table called the intern pool that stores a single copy of each unique string value. When two variables hold the same interned string, they both reference the exact same object in memory rather than two separate objects with identical contents. This matters because strings are immutable, so sharing one instance is safe and eliminates duplicate memory usage.

The compiler automatically interns all string literals. That is why `ReferenceEquals("hello", "hello")` returns `true` in the [String Fundamentals](#string-fundamentals) example at the top of this guide: both literals resolve to the same pooled object at compile time. Strings created at runtime through concatenation, user input, file reads, or deserialization are not interned by default, so two runtime strings with identical contents are separate heap objects.

`string.Intern()` manually adds a runtime string to the pool and returns the pooled reference. If an equal string is already in the pool, it returns the existing reference and the runtime copy becomes eligible for garbage collection. `string.IsInterned()` checks whether a matching string exists in the pool without adding one.

```csharp
// Runtime strings are separate objects by default
string a = "status_active";                         // literal, auto-interned
string b = "status_" + "active";                    // compiler folds this, also interned
string c = "status_" + Console.ReadLine();          // runtime concatenation, NOT interned

// Manual interning for frequently used runtime strings
string interned = string.Intern(computedString);

// Check if a matching string is already in the pool
string? existing = string.IsInterned(someString);   // null if not pooled
```

Manual interning is useful when your application processes a large number of duplicate strings at runtime, such as repeated status codes, category names, or dictionary keys read from an external source. By interning them, you keep one copy instead of thousands of identical objects.

The tradeoff is that interned strings live for the entire lifetime of the application and cannot be garbage collected. Interning a large or unbounded set of unique values (like user IDs or timestamps) will cause steady memory growth with no way to reclaim it. Only intern strings from a small, known set of values that repeat frequently.

## Key Takeaways

**Strings are immutable**: Every modification creates a new string. Use StringBuilder for building strings in loops.

**Use the right comparison**: Ordinal for identifiers and paths, CurrentCulture for user-facing text.

**Prefer Span for parsing**: Use `ReadOnlySpan<char>` to avoid allocations when processing substrings.

**string.Join over concatenation loops**: More efficient and readable.

**Compiled regex for hot paths**: Use `RegexOptions.Compiled` or source-generated regex for performance.

**Raw strings for embedded content**: Use `"""` for JSON, SQL, or other content with quotes.
