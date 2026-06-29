---
title: "C# Regular Expressions"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Pattern matching with System.Text.RegularExpressions including common patterns, groups, replacements, and source generation."
tags: [c-sharp, dotnet, regex, text-processing, validation, practical]
---

## Regex Basics

Regular expressions match patterns in text. Use them for validation, searching, and text transformation.

```csharp
using System.Text.RegularExpressions;

// Simple match check
bool isMatch = Regex.IsMatch("hello@example.com", @"@.*\.");  // true

// Find match
Match match = Regex.Match("Order #12345", @"#(\d+)");
if (match.Success)
{
    Console.WriteLine(match.Value);      // #12345
    Console.WriteLine(match.Groups[1].Value);  // 12345
}

// Find all matches
MatchCollection matches = Regex.Matches("a1 b2 c3", @"\w\d");
foreach (Match m in matches)
{
    Console.WriteLine(m.Value);  // a1, b2, c3
}
```

## Common Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `\d` | Digit | `0-9` |
| `\w` | Word character | `a-z`, `A-Z`, `0-9`, `_` |
| `\s` | Whitespace | space, tab, newline |
| `.` | Any character (except newline) | |
| `^` | Start of string | |
| `$` | End of string | |
| `+` | One or more | `\d+` matches `123` |
| `*` | Zero or more | `\d*` matches `` or `123` |
| `?` | Zero or one | `\d?` matches `` or `1` |
| `{n}` | Exactly n | `\d{3}` matches `123` |
| `{n,m}` | Between n and m | `\d{2,4}` matches `12` to `1234` |
| `[abc]` | Character class | matches `a`, `b`, or `c` |
| `[^abc]` | Negated class | matches anything except `a`, `b`, `c` |
| `(...)` | Capture group | captures matched text |
| `(?:...)` | Non-capturing group | groups without capturing |
| `\|` | Alternation | `cat\|dog` matches either |

## Practical Examples

### Validation

```csharp
public static class Validators
{
    // Email (simplified)
    private static readonly Regex EmailRegex = new(
        @"^[\w\.-]+@[\w\.-]+\.\w+$",
        RegexOptions.Compiled);

    // Phone (US format)
    private static readonly Regex PhoneRegex = new(
        @"^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$",
        RegexOptions.Compiled);

    // URL
    private static readonly Regex UrlRegex = new(
        @"^https?://[\w\.-]+(?:/[\w\.-]*)*/?$",
        RegexOptions.Compiled);

    public static bool IsValidEmail(string email) => EmailRegex.IsMatch(email);
    public static bool IsValidPhone(string phone) => PhoneRegex.IsMatch(phone);
    public static bool IsValidUrl(string url) => UrlRegex.IsMatch(url);
}
```

### Extraction

```csharp
// Extract all URLs from text
var urlPattern = new Regex(@"https?://[^\s]+");
var urls = urlPattern.Matches(htmlContent)
    .Select(m => m.Value)
    .ToList();

// Extract named groups
var logPattern = new Regex(
    @"(?<date>\d{4}-\d{2}-\d{2}) (?<level>\w+): (?<message>.+)");

var match = logPattern.Match("2024-01-15 ERROR: Connection failed");
if (match.Success)
{
    string date = match.Groups["date"].Value;     // 2024-01-15
    string level = match.Groups["level"].Value;   // ERROR
    string message = match.Groups["message"].Value; // Connection failed
}
```

### Replacement

```csharp
// Simple replacement
string result = Regex.Replace("Hello World", @"\s+", "-");
// "Hello-World"

// Using captured groups
string masked = Regex.Replace(
    "Card: 1234-5678-9012-3456",
    @"(\d{4})-(\d{4})-(\d{4})-(\d{4})",
    "****-****-****-$4");
// "Card: ****-****-****-3456"

// Using MatchEvaluator
string result = Regex.Replace("prices: $10, $25, $100",
    @"\$(\d+)",
    m => $"${int.Parse(m.Groups[1].Value) * 2}");
// "prices: $20, $50, $200"
```

### Splitting

```csharp
// Split on multiple delimiters
string[] parts = Regex.Split("one,two;three four", @"[,;\s]+");
// ["one", "two", "three", "four"]

// Split keeping delimiters
string[] tokens = Regex.Split("a+b-c*d", @"([+\-*])");
// ["a", "+", "b", "-", "c", "*", "d"]
```

## Regex Options

```csharp
var options = RegexOptions.IgnoreCase      // Case-insensitive
            | RegexOptions.Multiline       // ^ and $ match line boundaries
            | RegexOptions.Singleline      // . matches newlines
            | RegexOptions.Compiled;       // Compile for performance

var regex = new Regex(@"pattern", options);

// Inline options
var pattern = @"(?i)case insensitive";  // (?i) enables ignore case
var pattern2 = @"(?m)^line start";      // (?m) enables multiline
```

## Source-Generated Regex (.NET 7+)

<div class="callout callout--tip">
<p class="callout__title">Source Generation for Regex</p>
<p>Generated regex compiles the pattern to IL at build time, eliminating runtime compilation overhead and enabling AOT deployment. Use it for frequently-used patterns.</p>
</div>

Compile-time generation for better performance and AOT support.

```csharp
public partial class Patterns
{
    [GeneratedRegex(@"^\d{3}-\d{2}-\d{4}$")]
    private static partial Regex SsnRegex();

    [GeneratedRegex(@"[\w\.-]+@[\w\.-]+\.\w+", RegexOptions.IgnoreCase)]
    private static partial Regex EmailRegex();

    public static bool IsValidSsn(string ssn) => SsnRegex().IsMatch(ssn);
    public static bool IsValidEmail(string email) => EmailRegex().IsMatch(email);
}
```

Benefits:
- No runtime compilation overhead
- Compile-time pattern validation
- Better performance
- AOT compatible

## Performance Considerations

### Compile for Reuse

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Static Regex Methods (Slow)</h4>
<ul>
<li>Regex.IsMatch(input, pattern)</li>
<li>Compiles pattern every call</li>
<li>Internal cache helps but not guaranteed</li>
<li>Avoid in hot paths</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Compiled/Generated (Fast)</h4>
<ul>
<li>Static readonly Regex instance</li>
<li>Compiles once, reuse forever</li>
<li>Or use [GeneratedRegex]</li>
<li>Optimal for repeated use</li>
</ul>
</div>
</div>

```csharp
// BAD: Creates new Regex each call
public bool Validate(string input)
{
    return Regex.IsMatch(input, @"\d+");  // Compiles pattern each time
}

// GOOD: Reuse compiled Regex
private static readonly Regex NumberRegex = new(@"\d+", RegexOptions.Compiled);

public bool Validate(string input)
{
    return NumberRegex.IsMatch(input);
}

// BEST: Source-generated (.NET 7+)
[GeneratedRegex(@"\d+")]
private static partial Regex NumberRegex();
```

### Set Timeout

<div class="callout callout--warning">
<p class="callout__title">Catastrophic Backtracking</p>
<p>Certain regex patterns can cause exponential time complexity when matching fails. Always set timeouts for untrusted input or complex patterns to prevent denial-of-service.</p>
</div>

```csharp
// Prevent catastrophic backtracking
var regex = new Regex(
    @"(a+)+$",  // Potentially dangerous pattern
    RegexOptions.None,
    TimeSpan.FromSeconds(1));

try
{
    regex.Match("aaaaaaaaaaaaaaaaaaaaaaaaaab");
}
catch (RegexMatchTimeoutException)
{
    // Handle timeout
}
```

### Avoid Catastrophic Backtracking

```csharp
// BAD: Nested quantifiers can cause exponential time
var bad = new Regex(@"(a+)+b");

// GOOD: Use atomic groups or possessive quantifiers
var good = new Regex(@"(?>a+)+b");  // Atomic group

// Or restructure the pattern
var better = new Regex(@"a+b");
```

## Common Tasks

### Parse Key-Value Pairs

```csharp
var pattern = new Regex(@"(?<key>\w+)=(?<value>[^;]+)");
var input = "name=John;age=30;city=NYC";

var dict = pattern.Matches(input)
    .ToDictionary(
        m => m.Groups["key"].Value,
        m => m.Groups["value"].Value);
```

### Clean/Normalize Text

```csharp
// Remove extra whitespace
string cleaned = Regex.Replace(text, @"\s+", " ").Trim();

// Remove non-alphanumeric
string alphaOnly = Regex.Replace(text, @"[^a-zA-Z0-9]", "");

// Normalize line endings
string normalized = Regex.Replace(text, @"\r\n?|\n", Environment.NewLine);
```

### Extract Numbers

```csharp
var numbers = Regex.Matches("Price: $19.99, Qty: 5", @"\d+\.?\d*")
    .Select(m => decimal.Parse(m.Value))
    .ToList();  // [19.99, 5]
```
## Key Takeaways

**Use source-generated regex**: In .NET 7+, prefer `[GeneratedRegex]` for compile-time validation and performance.

**Always compile for reuse**: Create static `Regex` instances with `RegexOptions.Compiled` instead of calling static methods.

**Set timeouts for untrusted input**: Protect against catastrophic backtracking with `TimeSpan` parameter.

**Use named groups**: `(?<name>...)` makes patterns more readable than numbered groups.

**Keep patterns simple**: Complex patterns are hard to maintain. Consider multiple simple patterns or alternative parsing approaches for complex grammars.

**Test edge cases**: Empty strings, very long strings, and malformed input can cause unexpected behavior.
