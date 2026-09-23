---
title: "C# Regular Expressions"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "System.Text.RegularExpressions in practice: .NET's Unicode-aware pattern syntax, groups, replacements, and options, then how a pattern runs (interpreted, Compiled, [GeneratedRegex], NonBacktracking), catastrophic backtracking and timeouts, and when not to use a regex at all."
tags: [regex, generatedregex, regexoptions, backtracking, text-processing, validation, practical]
---

## Matching Text

`System.Text.RegularExpressions.Regex` finds patterns in strings. Each method answers a different question:

```csharp
using System.Text.RegularExpressions;

// Does the input contain a match?
bool hasOrder = Regex.IsMatch("Order #12345", @"#\d+");            // true

// The first match, with its groups
Match match = Regex.Match("Order #12345", @"#(\d+)");
if (match.Success)
{
    Console.WriteLine(match.Value);            // #12345
    Console.WriteLine(match.Groups[1].Value);  // 12345
}

// Every match
foreach (Match m in Regex.Matches("a1 b2 c3", @"\w\d"))
    Console.WriteLine(m.Value);                // a1, b2, c3

// How many matches, without creating Match objects (.NET 7)
int count = Regex.Count("a1 b2 c3", @"\w\d");   // 3
```

Write patterns as verbatim strings (`@"..."`) so a backslash reaches the regex engine instead of being read as a C# escape. `MatchCollection` implements `IEnumerable<Match>`, so LINQ works on it directly.

For hot paths, `Regex.EnumerateMatches` (.NET 7) accepts a `ReadOnlySpan<char>` and yields `ValueMatch` structs holding only an index and length. It allocates nothing per match, and you slice the input yourself to read each value.

## Pattern Syntax

| Pattern | Matches |
|---|---|
| `\d` | Any Unicode decimal digit, not only `0-9` |
| `\w` | Any Unicode letter, combining mark, digit, or connector punctuation such as `_` |
| `\s` | Whitespace: space, tab, `\r`, `\n`, and Unicode spaces |
| `.` | Any character except `\n` (it does match `\r`) |
| `^` / `$` | Start of input / end of input, **or just before a final `\n`** |
| `\A` / `\z` | Start of input / the absolute end of input |
| `\b` | A boundary between a word character and a non-word character |
| `[abc]` / `[^abc]` | One character from the set / one character not in it |
| `+` `*` `?` | One or more, zero or more, zero or one |
| `{n}` `{n,}` `{n,m}` | Exactly n, at least n, between n and m |
| `+?` `*?` `??` | Lazy versions: match as few as possible |
| `(...)` | Capturing group, numbered from 1 |
| `(?<name>...)` | Named capturing group |
| `(?:...)` | Group without capturing |
| `\1`, `\k<name>` | Backreference: the text a group already matched |
| `(?=...)` `(?!...)` | Lookahead: what follows does or doesn't match, without consuming it |
| `(?<=...)` `(?<!...)` | Lookbehind: what precedes does or doesn't match |
| `a\|b` | Either alternative |

Quantifiers are greedy by default and take as much as they can. `<b>.*</b>` applied to `<b>x</b><b>y</b>` matches the whole string, while the lazy `<b>.*?</b>` stops at the first `</b>`.

### Unicode Classes Are Wider Than They Look

In .NET, `\d` and `\w` are Unicode categories. `\d` matches the Arabic-Indic digit `٣` as readily as `3`, and `\w` matches `é` and `日`. That is correct for searching human text and wrong for validating machine input: a pattern like `^\d+$` accepts digits that `int.Parse` rejects.

When a pattern should accept only ASCII, spell the class out as `[0-9]` or `[A-Za-z0-9_]`. `RegexOptions.ECMAScript` also restricts `\d`, `\w`, and `\s` to ASCII, but it can be combined with only a few other options and changes how some other constructs behave, so an explicit class is usually the clearer fix.

### `$` Is Not the End of the Input

`$` matches at the end of the input and also just before a trailing `\n`. So `^\d+$` accepts `"123\n"`, and the newline passes validation into whatever consumes the value next. Use `\z` to require the absolute end:

```csharp
Regex.IsMatch("123\n", @"^\d+$");    // true
Regex.IsMatch("123\n", @"^\d+\z");   // false
```

The mirror problem appears with `RegexOptions.Multiline` on Windows text. There, `$` matches before each `\n`, but a `\r` still sits in front of it, so `^\w+$` finds nothing in `"a\r\nb\r\n"`. Allow for it with `\r?$`, or normalize line endings first.

## Groups and Extraction

Named groups keep extraction readable and survive edits to the pattern, where group numbers shift:

```csharp
var logLine = new Regex(@"^(?<date>\d{4}-\d{2}-\d{2}) (?<level>\w+): (?<message>.+)$");

Match m = logLine.Match("2024-01-15 ERROR: Connection failed");
if (m.Success)
{
    string date = m.Groups["date"].Value;       // 2024-01-15
    string level = m.Groups["level"].Value;     // ERROR
    string message = m.Groups["message"].Value; // Connection failed
}
```

A group that didn't participate in the match has `Success == false` and an empty `Value`, so check `Success` when a group is optional and an empty string is also a legitimate value.

Every capturing group costs work and memory. `RegexOptions.ExplicitCapture` makes plain `(...)` groups non-capturing, so only named groups capture, which saves writing `(?:...)` everywhere.

## Replacing

`Regex.Replace` substitutes each match. In the replacement string, `$1` and `${name}` insert a group's text, and `$$` inserts a literal `$`:

```csharp
string hyphenated = Regex.Replace("Hello   World", @"\s+", "-");
// "Hello-World"

string reordered = Regex.Replace("2024-01-15",
    @"(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})", "${d}/${m}/${y}");
// "15/01/2024"

string masked = Regex.Replace("Card: 1234-5678-9012-3456",
    @"\d{4}-\d{4}-\d{4}-(\d{4})", "****-****-****-$1");
// "Card: ****-****-****-3456"
```

When the replacement depends on the matched text, pass a `MatchEvaluator`, which is called once per match:

```csharp
string doubled = Regex.Replace("prices: $10, $25, $100", @"\$(\d+)",
    m => "$" + (int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) * 2));
// "prices: $20, $50, $200"
```

### Untrusted Text in Patterns and Replacements

A pattern built from user input is regex injection. `Regex.IsMatch(text, userInput)` lets the user supply metacharacters, including a pattern designed to backtrack for minutes. `Regex.Escape` turns every metacharacter into a literal:

```csharp
string pattern = @"\b" + Regex.Escape(searchTerm) + @"\b";
// "1+1 (a.b)" becomes 1\+1\ \(a\.b\)
```

Replacement strings have their own metacharacters. A user-supplied replacement containing `$0` inserts the match instead of the text `$0`. Double every `$` (`replacement.Replace("$", "$$")`), or use a `MatchEvaluator`, whose return value is inserted literally.

## Splitting

`Regex.Split` splits on a pattern rather than a fixed separator. Capturing groups in the pattern put the delimiters into the result:

```csharp
string[] parts = Regex.Split("one,two;three four", @"[,;\s]+");
// ["one", "two", "three", "four"]

string[] tokens = Regex.Split("a+b-c*d", @"([+\-*])");
// ["a", "+", "b", "-", "c", "*", "d"]
```

For a single fixed separator, `string.Split` is simpler and faster.

## Options

| Option | Effect | Inline form |
|---|---|---|
| `IgnoreCase` | Case-insensitive matching | `(?i)` |
| `CultureInvariant` | Case rules from the invariant culture instead of the current one | none |
| `Multiline` | `^` and `$` match at every line, not only the input's ends | `(?m)` |
| `Singleline` | `.` also matches `\n` | `(?s)` |
| `ExplicitCapture` | Only named groups capture | `(?n)` |
| `IgnorePatternWhitespace` | Whitespace in the pattern is ignored and `#` starts a comment | `(?x)` |

Combine flags with `|`. An inline option can also apply to part of a pattern, as in `(?i:abc)def`.

`IgnoreCase` uses the current culture's casing rules unless `CultureInvariant` is also set. Under `tr-TR`, the pattern `I` with `IgnoreCase` doesn't match `i`, because Turkish pairs `I` with dotless `ı`. Patterns that match identifiers, keywords, or protocol text should add `CultureInvariant`.

`IgnorePatternWhitespace` makes a long pattern reviewable:

```csharp
var isoDate = new Regex(@"
    ^(?<year>\d{4})     # four-digit year
    -(?<month>\d{2})    # month
    -(?<day>\d{2})\z    # day, then the true end of input
    ", RegexOptions.IgnorePatternWhitespace);
```

## How a Pattern Runs

A `Regex` parses its pattern once, when it's constructed, and then executes it with one of four engines. The choice affects startup cost, throughput, Native AOT support, and whether a hostile input can make a match run for minutes.

| Engine | How you get it | Construction | Matching | Native AOT |
|---|---|---|---|---|
| Interpreter | Default | Cheap | Slowest | Works |
| `RegexOptions.Compiled` | Option on the constructor | Emits IL at run time, so milliseconds per pattern | Fast | Option ignored, runs interpreted |
| Source generator | `[GeneratedRegex]` (.NET 7) | None at run time; C# is generated at build | Fast | Works |
| `RegexOptions.NonBacktracking` | Option (.NET 7) | Builds an automaton | Linear in input length | Works |

The first three are backtracking engines and accept the same patterns. `NonBacktracking` guarantees time proportional to the input's length, and pays for that with a smaller feature set, described under backtracking below.

### Construct Once, Reuse

Constructing a `Regex` parses the pattern, and with `Compiled` it also generates and JIT-compiles code. So the instance belongs in a static field, not a local:

```csharp
// Parses the pattern on every call
public bool IsNumber(string input) => new Regex(@"^[0-9]+\z").IsMatch(input);

// Parses once
private static readonly Regex Number = new(@"^[0-9]+\z");
public bool IsNumber(string input) => Number.IsMatch(input);
```

The static methods such as `Regex.IsMatch(input, pattern)` sit in between. They keep a cache of recently constructed instances, 15 by default (`Regex.CacheSize`), so a few patterns called repeatedly aren't re-parsed. An application that cycles through more distinct patterns than the cache holds evicts them and parses again, which is why a field is the dependable choice.

### Compiled

`RegexOptions.Compiled` uses `Reflection.Emit` to turn the pattern into IL, which the JIT then compiles to machine code. Matching gets substantially faster, and construction goes from a fraction of a millisecond to a few milliseconds per pattern. That trade suits a long-running process that matches the same pattern many times, and it hurts startup when an application constructs dozens of compiled patterns it rarely uses. Where run-time code generation isn't available, as under Native AOT, the option is ignored and the pattern is interpreted.

### Source-Generated Regex

`[GeneratedRegex]` on a `partial` method has a Roslyn source generator write the matching code as ordinary C# at build time:

```csharp
public static partial class Patterns
{
    [GeneratedRegex(@"^[A-Z]{3}-[0-9]{4}\z")]
    private static partial Regex OrderCode();

    [GeneratedRegex(@"\b(?<word>\w+)\s+\k<word>\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    public static partial Regex RepeatedWord { get; }   // Partial property form: .NET 9, C# 13

    public static bool IsOrderCode(string value) => OrderCode().IsMatch(value);
}
```

It has the throughput of `Compiled` without the run-time cost, and three further advantages:

- **An invalid pattern fails the build**, with error `SYSLIB1042`, instead of throwing `RegexParseException` the first time the code runs.
- **It works under Native AOT and trimming**, since nothing is generated at run time.
- **The generated code is readable.** Go to the definition in the IDE to step through the matching logic, with comments describing what each part of the pattern does.

The method returns the same cached instance on every call, so there's nothing to store in a field. Built-in analyzer `SYSLIB1045` flags `Regex` constructions with constant patterns that could use the generator. Prefer it for any pattern known at compile time. `Compiled` remains for patterns that only arrive at run time, such as ones loaded from configuration.

## Catastrophic Backtracking and Timeouts

The three backtracking engines try one way of matching, and on failure step back and try the next. Most patterns have few alternatives to try. A quantifier nested inside another, where both can match the same characters, has exponentially many.

Take `(a+)+$` against `aaaa` followed by `b`. The inner `a+` and the outer `+` can divide the four `a`s between them in 8 ways (`aaaa`, `aaa|a`, `aa|aa`, `a|a|a|a`, and so on), and the engine tries every division before concluding that `$` can't match before `b`. Each extra `a` doubles the count. Measured on .NET 10, thirty `a`s and a `b` ran past a two-second timeout, and the same pattern with `NonBacktracking` finished in a few milliseconds. No optimization rescues it automatically.

The shapes to look for are a quantified group whose contents are themselves quantified, like `(a+)+` or `(\w+\s?)*`, and alternatives that overlap, like `(a|aa)*`. Each is harmless on input that matches and explodes on a long near-miss, which is exactly what an attacker sends. An attack built on this is called ReDoS, regular expression denial of service.

### Fixes, in Order of Preference

**Rewrite the pattern** so each character can be consumed only one way. `(a+)+$` means the same as `a+$`. `(\w+\s?)*` becomes `\w+(\s\w+)*`, which requires a separator between words so a run of letters can't be split two ways.

**Use an atomic group.** `(?>...)` keeps whatever its contents matched and never gives characters back, so `(?>a+)+b` fails at once. .NET has no possessive quantifiers: `a++` is a parse error ("Nested quantifier"), and the atomic group is the equivalent.

**Use `NonBacktracking`** when patterns come from users or input is hostile. Matching time is linear in the input for any pattern. It rejects the constructs that require backtracking with `NotSupportedException`: atomic groups, backreferences, lookarounds, conditionals, and `\G`. It can't be combined with `RightToLeft` or `ECMAScript`. Captures and named groups do work.

**Set a timeout** as the backstop. By default a match has no time limit. A timeout makes a runaway match throw `RegexMatchTimeoutException` instead of holding the thread:

```csharp
private static readonly Regex Tag = new(
    @"<(?<name>[a-z]+)[^>]*>",
    RegexOptions.CultureInvariant,
    TimeSpan.FromMilliseconds(250));

[GeneratedRegex(@"^(?<key>[a-z]+)=(?<value>.*)\z", RegexOptions.None, matchTimeoutMilliseconds: 250)]
private static partial Regex Setting();

try
{
    Match m = Tag.Match(untrustedHtml);
}
catch (RegexMatchTimeoutException ex)
{
    logger.LogWarning("Regex {Pattern} timed out after {Timeout}", ex.Pattern, ex.MatchTimeout);
}
```

A process-wide default applies to every instance constructed without an explicit timeout, including those the static methods create. Set it at startup, before any `Regex` is built:

```csharp
AppContext.SetData("REGEX_DEFAULT_MATCH_TIMEOUT", TimeSpan.FromSeconds(1));
```

A timeout bounds the damage but still spends the full timeout on every hostile request, so it doesn't replace a pattern that can't explode.

## When Not to Use a Regex

A regex is the right tool for a flat, regular shape: an order code, a log line, a token in text. Several common uses are better served by a parser that knows the format:

| Task | Better choice | Why |
|---|---|---|
| Validating a URL | `Uri.TryCreate(value, UriKind.Absolute, out var uri)`, then check `uri.Scheme` | URL grammar has too many valid forms for a pattern to track |
| Validating an email address | `MailAddress.TryCreate`, then a confirmation email | Only delivery proves the address works, and strict patterns reject valid addresses |
| Parsing numbers or dates | `int.TryParse`, `DateOnly.TryParseExact` with `CultureInfo.InvariantCulture` | They check range and calendar validity, which a pattern can't |
| JSON, XML, HTML | `System.Text.Json`, `XDocument`, an HTML parser | Nested structures aren't regular, so every pattern for them fails on some valid input |
| Fixed substrings | `string.Contains`, `IndexOf`, `Split` with `StringComparison.Ordinal` | Faster and clearer, with no metacharacters to escape |

A regex that only pre-filters input for one of these parsers is fine. A regex standing in for the parser is where the bugs live.

## Common Tasks

### Parse Key-Value Pairs

```csharp
[GeneratedRegex(@"(?<key>\w+)=(?<value>[^;]*)")]
private static partial Regex KeyValue();

Dictionary<string, string> settings = KeyValue()
    .Matches("name=Alice;age=30;city=Oslo")
    .ToDictionary(m => m.Groups["key"].Value, m => m.Groups["value"].Value);
```

`ToDictionary` throws on a repeated key, so decide whether a duplicate means bad input or last-one-wins before relying on it.

### Normalize Text

```csharp
// Collapse runs of whitespace
string collapsed = Regex.Replace(text, @"\s+", " ").Trim();

// Keep only ASCII letters and digits
string alphanumeric = Regex.Replace(text, @"[^A-Za-z0-9]", "");

// Normalize line endings to \n
string unixEndings = Regex.Replace(text, @"\r\n?", "\n");
```

### Extract Numbers

```csharp
List<decimal> numbers = Regex.Matches("Price: $19.99, Qty: 5", @"[0-9]+(?:\.[0-9]+)?")
    .Select(m => decimal.Parse(m.Value, CultureInfo.InvariantCulture))
    .ToList();   // [19.99, 5]
```

The pattern matches a `.` decimal separator, so the parse must use the invariant culture too. With the current culture set to `de-DE`, `decimal.Parse("19.99")` returns 1999.

## Key Takeaways

**`\d` and `\w` are Unicode.** Use `[0-9]` and explicit classes when validating machine input.

**Anchor validation with `\z`, not `$`.** `$` accepts a trailing newline.

**Prefer `[GeneratedRegex]` for patterns known at compile time.** It's fast, validates the pattern at build, and works under Native AOT. Keep `Compiled` for patterns that arrive at run time.

**Construct a `Regex` once.** Store instances in static fields rather than constructing them per call.

**Treat nested quantifiers as a vulnerability.** Rewrite them, use atomic groups, or use `NonBacktracking` for untrusted patterns and input, and set a timeout as the backstop.

**Escape untrusted text** with `Regex.Escape` in patterns, and double its `$` characters in replacements.

**Use a real parser for URLs, emails, numbers, dates, and nested formats.**
