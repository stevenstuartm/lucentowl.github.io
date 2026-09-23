---
title: "C# Strings and Text Processing"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How .NET strings work and where they bite: immutability and interning, literal forms, what Length actually counts, ordinal versus culture-sensitive comparison and which overloads default to which, culture in formatting and parsing, building strings efficiently, and allocation-free text processing with spans."
tags: [strings, string-comparison, stringbuilder, culture, unicode, interpolation, fundamentals]
---
{% raw %}

## Strings Are Immutable

A `string` is a reference type whose contents can never change after it is created. Every method that appears to modify one, such as `Replace`, `ToUpper`, `Trim`, or `+`, returns a **new** string and leaves the original untouched.

```csharp
string greeting = "Hello";
string modified = greeting + " World";   // new string
string upper = greeting.ToUpper();       // another new string
// greeting is still "Hello"

greeting.Trim();                         // does nothing useful: the result is discarded
greeting = greeting.Trim();              // correct: keep the returned string
```

Immutability is what makes strings safe to share. Any number of variables, threads, and dictionary keys can hold the same string without one of them changing it under the others. The cost is that building a string piece by piece creates a new object at every step, which is the problem the later sections on building strings solve.

## Writing String Literals

```csharp
// Regular: backslash escapes are processed
string path = "C:\\Users\\Name\\Documents";
string lines = "Line 1\nLine 2";

// Verbatim (@): backslashes are literal, "" is a quote, newlines are kept
string verbatimPath = @"C:\Users\Name\Documents";
string quoted = @"She said ""Hello""";
```

### Raw String Literals (C# 11)

A raw string starts and ends with three or more double quotes. Nothing inside is escaped, so JSON, SQL, XML, and regex patterns can be pasted as they are. The closing delimiter's indentation is removed from every line, which lets the literal be indented with the surrounding code.

```csharp
string json = """
    {
        "name": "Alice",
        "age": 30
    }
    """;

// Content containing """ needs a longer delimiter
string withQuotes = """"
    He said """Hello"""
    """";
```

With interpolation, the number of `$` signs sets how many braces open a hole. `$$"""` makes `{{name}}` an interpolation and leaves single braces as literal text, which is what JSON needs:

```csharp
string payload = $$"""
    {
        "name": "{{name}}",
        "age": {{age}}
    }
    """;
```

### UTF-8 Literals (C# 11)

.NET strings are UTF-16, but most network protocols and file formats use UTF-8. Converting at run time with `Encoding.UTF8.GetBytes(...)` encodes the text and allocates a byte array on every call. The `u8` suffix makes the compiler do the encoding once and embed the bytes in the assembly. The result is a `ReadOnlySpan<byte>` with no run-time encoding and no allocation.

```csharp
ReadOnlySpan<byte> header = "Content-Type: application/json\r\n"u8;
stream.Write(header);

byte[] asArray = """{"name":"test"}"""u8.ToArray();   // allocate only when an array is required
```

## String Interpolation

An interpolated string `$"..."` embeds expressions in braces, with an optional alignment after a comma and a format after a colon:

```csharp
string message = $"Hello, {name}! You are {age} years old.";
string price = $"Price: {amount:C2}";
string row = $"|{name,-10}|{age,5}|";           // |Alice     |   30|
string status = $"Status: {(age >= 18 ? "Adult" : "Minor")}";
```

Since .NET 6 the compiler lowers interpolation to a builder that writes directly into a pooled buffer, so `$"..."` avoids the intermediate strings and value-type boxing that `string.Format` incurs. The same mechanism lets `StringBuilder.Append($"...")` append without creating an intermediate string. The format specifiers themselves (`C2`, `N0`, `yyyy-MM-dd`, and the rest) are a lookup subject rather than a concept, and they behave the same in interpolation, `string.Format`, and `ToString(format)`.

**Every interpolation hole is formatted with the current culture.** On a machine set to German, `$"{1234.5}"` produces `1234,5`, which is correct for a person reading it and wrong for a CSV file, a URL, a log parser, or a SQL literal. For text a machine will read, format with the invariant culture:

```csharp
string forHumans = $"{total}";                                          // "1234,5" on de-DE
string forMachines = string.Create(CultureInfo.InvariantCulture, $"{total}");   // "1234.5"
string alsoFine = total.ToString(CultureInfo.InvariantCulture);
```

## What Length Counts

A `char` is one UTF-16 **code unit**, and `Length` counts code units. That matches what a reader sees for most European text and stops matching elsewhere:

```csharp
"héllo".Length        // 5, when é is a single precomposed character
"he\u0301llo".Length  // 6: e followed by a combining accent, displayed identically
"👍".Length            // 2: one emoji outside the Basic Multilingual Plane needs a surrogate pair
"👍🏽".Length           // 4: thumbs up plus a skin-tone modifier, each a surrogate pair
```

Three units of text are in play. A **code unit** is a `char`. A **Unicode scalar value** is a code point, represented in .NET by `Rune`, which is one or two `char`s. A **text element** (grapheme cluster) is what a reader perceives as one character, which can be several scalars. `"👍🏽"` is 4 chars, 2 runes, and 1 text element.

```csharp
int chars = text.Length;
int runes = text.EnumerateRunes().Count();
int visible = new StringInfo(text).LengthInTextElements;
```

This matters wherever code cuts or counts text for a person. Truncating to `Length` or `Substring` can split a surrogate pair into two invalid halves or strip an accent from its letter. A "maximum 20 characters" rule enforced on `Length` rejects a 12-emoji name. Byte limits are a fourth unit again, since `Encoding.UTF8.GetByteCount` of the same text differs from all three.

## Comparing Strings

Every comparison is either **ordinal** or **linguistic**. An ordinal comparison compares the UTF-16 code units numerically, with no knowledge of language. It is exact, fast, and gives the same answer on every machine. A linguistic comparison applies a culture's rules, so accented and unaccented forms, or characters a culture treats as equivalent, can compare as equal or sort next to each other. Its answer depends on the culture and on the Unicode library underneath, which since .NET 5 is ICU on Linux, macOS, and current Windows versions.

```csharp
string.Equals(a, b, StringComparison.Ordinal);            // exact code units
string.Equals(a, b, StringComparison.OrdinalIgnoreCase);  // exact, case folded
string.Compare(a, b, StringComparison.CurrentCulture);    // user's language rules
```

### Which Overloads Default to Which

The trap is that methods called without a `StringComparison` don't agree on a default:

| Called without `StringComparison` | Default |
|-----------------------------------|---------|
| `==`, `Equals`, `Contains(string)`, `Replace`, `Split` | Ordinal |
| `IndexOf(char)`, `LastIndexOf(char)`, `StartsWith(char)` | Ordinal |
| `IndexOf(string)`, `LastIndexOf(string)`, `StartsWith(string)`, `EndsWith(string)` | Current culture |
| `Compare`, `CompareTo`, `List<string>.Sort()`, `OrderBy(s => s)` | Current culture |

So `path.StartsWith("C:")` runs a culture-sensitive comparison while `path.Contains("C:")` runs an ordinal one. A linguistic search can also treat some characters, such as control characters, differently from an ordinal one, so a culture-sensitive `IndexOf` can return a different position, or none, across platforms and runtime versions.

The rule that removes the ambiguity is to **always pass a `StringComparison`** (or a `StringComparer`), even when you want the default. The analyzers CA1307, CA1309, and CA1310 flag calls that omit it, and can be raised to errors.

### Choosing the Comparison

| Data | Use |
|------|-----|
| Identifiers, keys, file paths, URLs, protocol tokens, config names, anything a program matches | `Ordinal` or `OrdinalIgnoreCase` |
| Text shown to a person and sorted or searched for them | `CurrentCulture` or `CurrentCultureIgnoreCase` |
| Linguistically meaningful data that must sort the same everywhere | `InvariantCulture`, which is rarely the right answer |

Ordinal is the safe default for anything that isn't prose for a person. `InvariantCulture` is often reached for as the "culture-neutral" choice, but it is still a linguistic comparison, just with a fixed culture. For symbolic data, Microsoft's guidance is to use ordinal instead.

Collections need the same decision. A `Dictionary<string, T>` or `HashSet<string>` compares keys ordinally and case-sensitively by default. Pass a comparer to change that:

```csharp
var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
headers["Content-Type"] = "application/json";
bool found = headers.ContainsKey("content-type");   // true
```

### Case Conversion Is Cultural Too

`ToUpper()` and `ToLower()` without arguments use the current culture. In Turkish, the uppercase of `i` is `İ` (dotted capital I) and the lowercase of `I` is `ı` (dotless), so on a Turkish machine `"file".ToUpper()` is `"FİLE"` and `"FILE".ToLower() == "file"` is false. Code that normalizes case in order to compare breaks for those users. Compare with `OrdinalIgnoreCase` instead of converting case at all, and when normalized text must be stored, use `ToUpperInvariant()`.

## Culture in Parsing

Parsing uses the current culture by default in the same way formatting does, and the failure is quieter. On a German machine the decimal separator is `,` and `.` is the thousands separator, so:

```csharp
// CurrentCulture = de-DE
double.TryParse("1234.5", out var value);   // true, and value is 12345
```

The parse succeeds, so no error reaches anyone. The value is wrong by a factor of ten. Any text that came from a file, an API, configuration, or another program should be parsed with an explicit culture, which is almost always `CultureInfo.InvariantCulture`:

```csharp
double price = double.Parse("1234.5", CultureInfo.InvariantCulture);

if (decimal.TryParse(input, NumberStyles.Number, CultureInfo.CurrentCulture, out var entered))
{
    // user-typed input: current culture is correct here
}
```

`Parse` throws on bad input, and `TryParse` returns `false` instead. Use `TryParse` when bad input is an expected case, such as anything a user typed, and `Parse` when bad input means a bug upstream.

## Common Operations

```csharp
string text = "  Hello, World!  ";

string trimmed = text.Trim();                      // "Hello, World!"
string noHashes = "###Hi###".Trim('#');            // "Hi"
string padded = "42".PadLeft(5, '0');              // "00042"
string world = "Hello, World!".Substring(7, 5);    // "World"
string tail = "Hello, World!"[7..];                // "World!"
string swapped = text.Replace("World", "Universe");

bool blank = string.IsNullOrWhiteSpace(input);     // null, "", or only whitespace

string[] parts = "apple,banana,cherry".Split(',');
string[] words = "a  b   c".Split(' ', StringSplitOptions.RemoveEmptyEntries);  // ["a","b","c"]
string[] firstThree = "a,b,c,d,e".Split(',', 3);   // ["a", "b", "c,d,e"]

string joined = string.Join(", ", parts);          // "apple, banana, cherry"

int at = text.IndexOf("World", StringComparison.Ordinal);
bool has = text.Contains("world", StringComparison.OrdinalIgnoreCase);
```

## Building Strings Efficiently

Because each concatenation creates a new string, how a string is assembled decides how much it costs.

| Situation | Use | Why |
|-----------|-----|-----|
| A fixed number of pieces in one expression | `+` or interpolation | The compiler turns `a + b + c` into one `string.Concat` call with one allocation |
| Joining a collection with a separator | `string.Join` | Sizes the result once |
| Appending in a loop, or across many statements | `StringBuilder` | Grows an internal buffer, and allocates the final string once |
| Known final length, performance-critical | `string.Create` | Writes directly into the new string's memory |

The loop case is the one that matters. Each `+=` copies everything built so far into a new string, so building a string of `n` pieces this way does work proportional to `n²`:

```csharp
// Quadratic: every iteration copies the whole string built so far
string result = "";
for (int i = 0; i < 1000; i++)
    result += i;

// Linear
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++)
    sb.Append(i);
string built = sb.ToString();
```

`StringBuilder` supports `Append`, `AppendLine`, `Insert`, `Replace`, and `Remove`, and each returns the builder so calls can chain. Passing an expected size to its constructor avoids regrowing the buffer when the approximate length is known.

`string.Create` hands a callback a `Span<char>` over the new string's uninitialized memory. It is the lowest-allocation option, and the callback must fill every character, since anything left unwritten stays as `'\0'` in the result:

```csharp
string padded = string.Create(10, 42, (chars, value) =>
{
    value.TryFormat(chars, out int written);
    chars[written..].Fill('0');                    // "4200000000"
});
```

## Allocation-Free Text Processing

`Substring`, `Split`, and `Trim` each allocate a new string. For code that scans or parses large volumes of text, those allocations dominate. `ReadOnlySpan<char>` is a read-only view over part of an existing string (a reference to the start plus a length), so slicing it copies nothing:

```csharp
string line = "Value: 42 units";
ReadOnlySpan<char> span = line.AsSpan();

ReadOnlySpan<char> number = span.Slice(7, 2);          // "42", no new string
int value = int.Parse(number);                         // parse straight from the slice

ReadOnlySpan<char> label = span[..5];                  // "Value"
bool isValue = label.Equals("Value", StringComparison.Ordinal);
ReadOnlySpan<char> trimmed = "  hi  ".AsSpan().Trim(); // "hi", no allocation
```

Most string methods have span equivalents, including `IndexOf`, `StartsWith`, `Trim`, `Split` into a `Span<Range>`, and the numeric `Parse` and `TryParse` overloads. Spans can't be stored in fields of ordinary classes or used across an `await`, which limits them to synchronous processing within a method.

### Precomputed Searches and Formats (.NET 8)

Two .NET 8 types move repeated setup work out of the hot path.

`SearchValues<T>` precomputes a set of characters (or, from .NET 9, strings) to search for. The runtime picks a search strategy for that particular set once, where `IndexOfAny(char[])` gets a raw array on every call:

```csharp
private static readonly SearchValues<char> Delimiters = SearchValues.Create(",;|\t");

int next = span.IndexOfAny(Delimiters);
```

`CompositeFormat` parses a format string's placeholders once, where `string.Format` re-parses the format on every call:

```csharp
private static readonly CompositeFormat LogLine = CompositeFormat.Parse("[{0:HH:mm:ss}] {1}: {2}");

string formatted = string.Format(CultureInfo.InvariantCulture, LogLine, DateTime.Now, level, message);
```

Both pay off only where the same search or format runs very often. Elsewhere, the ordinary methods are clearer.

Regular expressions are the heavier tool for pattern matching over text, with their own performance model and pitfalls.

## String Interning

The runtime keeps an **intern pool**, a table holding one shared instance of each string placed in it. Every string literal in the program is interned automatically, so two identical literals are the same object. Constant expressions like `"status_" + "active"` are folded at compile time and interned too. Strings built at run time from input, files, or concatenation are not.

```csharp
string a = "hello";
string b = "hel" + "lo";                  // folded by the compiler
bool same = ReferenceEquals(a, b);        // true

string c = new string(new[] { 'h', 'e', 'l', 'l', 'o' });
bool alsoSame = ReferenceEquals(a, c);    // false: built at run time

string pooled = string.Intern(c);         // returns the pooled "hello"
bool nowSame = ReferenceEquals(a, pooled);  // true
```

`string.Intern` is a memory optimization for programs holding very many copies of a small set of values read at run time, such as status codes or category names. Interned strings are never collected, so interning an open-ended set of values (user IDs, timestamps) grows memory for the life of the process. Interning never affects correctness, because `==` on strings compares content regardless.

## Key Takeaways

**Every string operation returns a new string.** Keep the result, and use `StringBuilder` when appending in a loop.

**Always pass a `StringComparison`.** The defaults disagree: `Contains` and `Equals` are ordinal, while `StartsWith(string)`, `IndexOf(string)`, and sorting are culture-sensitive. Use ordinal for anything a program matches.

**Interpolation, formatting, and parsing use the current culture.** Text for machines needs `CultureInfo.InvariantCulture`, or a German machine will parse `"1234.5"` as 12345 without an error.

**`Length` counts UTF-16 code units, not visible characters.** Use `StringInfo` when counting or truncating text a person sees.

**`ReadOnlySpan<char>` slices without allocating.** Reach for it in parsing and scanning code where `Substring` and `Split` show up in allocation profiles.

**Raw literals and `u8` remove escaping and encoding work.** Use `"""` for embedded JSON or SQL, and `u8` for constant protocol bytes.
{% endraw %}
