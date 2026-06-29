---
title: "C# Control Flow"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Conditionals, loops, and branching in C# including modern switch expressions and pattern-based control flow."
tags: [c-sharp, dotnet, fundamentals, control-flow, pattern-matching, practical]
---

## Conditional Statements

### if, else if, else

The fundamental branching construct.

```csharp
int score = 85;

if (score >= 90)
{
    Console.WriteLine("A");
}
else if (score >= 80)
{
    Console.WriteLine("B");
}
else if (score >= 70)
{
    Console.WriteLine("C");
}
else
{
    Console.WriteLine("F");
}

// Single statements don't require braces, but using them is safer
if (isValid)
    ProcessItem(); // Works but easy to introduce bugs when adding lines

// Nested conditions - consider refactoring if deeply nested
if (user != null)
{
    if (user.IsActive)
    {
        if (user.HasPermission("admin"))
        {
            // Deep nesting is a code smell
        }
    }
}

// Better: guard clauses
if (user == null) return;
if (!user.IsActive) return;
if (!user.HasPermission("admin")) return;
// Main logic here, not nested
```

### Conditional with Pattern Matching

Combine `if` with pattern matching for type-safe branching.

```csharp
object value = GetValue();

// Type pattern with variable
if (value is string text)
{
    Console.WriteLine($"String of length {text.Length}");
}
else if (value is int number)
{
    Console.WriteLine($"Number: {number}");
}
else if (value is null)
{
    Console.WriteLine("Null value");
}

// Property pattern
if (customer is { IsPremium: true, Balance: > 1000 })
{
    ApplyDiscount(customer);
}

// Negated pattern
if (input is not null and not "")
{
    Process(input);
}

// Relational patterns
if (age is >= 18 and < 65)
{
    Console.WriteLine("Working age");
}
```

## Switch Statement

Multi-way branching based on a value.

### Classic Switch

```csharp
DayOfWeek day = DateTime.Now.DayOfWeek;

switch (day)
{
    case DayOfWeek.Monday:
    case DayOfWeek.Tuesday:
    case DayOfWeek.Wednesday:
    case DayOfWeek.Thursday:
    case DayOfWeek.Friday:
        Console.WriteLine("Weekday");
        break;
    case DayOfWeek.Saturday:
    case DayOfWeek.Sunday:
        Console.WriteLine("Weekend");
        break;
    default:
        Console.WriteLine("Unknown");
        break;
}
```

### Pattern-Based Switch Statement (C# 7.0)

```csharp
object shape = GetShape();

switch (shape)
{
    case Circle c when c.Radius > 10:
        Console.WriteLine($"Large circle with radius {c.Radius}");
        break;
    case Circle c:
        Console.WriteLine($"Circle with radius {c.Radius}");
        break;
    case Rectangle { Width: var w, Height: var h } when w == h:
        Console.WriteLine($"Square with side {w}");
        break;
    case Rectangle r:
        Console.WriteLine($"Rectangle {r.Width}x{r.Height}");
        break;
    case null:
        Console.WriteLine("No shape");
        break;
    default:
        Console.WriteLine("Unknown shape");
        break;
}
```

### Switch Expression (C# 8.0)

When you need to return a value based on patterns, switch expressions are more concise.

```csharp
// Basic switch expression
string dayType = day switch
{
    DayOfWeek.Saturday or DayOfWeek.Sunday => "Weekend",
    _ => "Weekday"
};

// With relational patterns
string grade = score switch
{
    >= 90 => "A",
    >= 80 => "B",
    >= 70 => "C",
    >= 60 => "D",
    _ => "F"
};

// Property patterns
decimal discount = customer switch
{
    { IsPremium: true, YearsActive: > 5 } => 0.25m,
    { IsPremium: true } => 0.15m,
    { YearsActive: > 10 } => 0.10m,
    _ => 0m
};

// Tuple patterns
string direction = (x, y) switch
{
    (0, 0) => "Origin",
    (> 0, 0) => "Right",
    (< 0, 0) => "Left",
    (0, > 0) => "Up",
    (0, < 0) => "Down",
    (> 0, > 0) => "Upper-right",
    (< 0, > 0) => "Upper-left",
    (< 0, < 0) => "Lower-left",
    (> 0, < 0) => "Lower-right",
    _ => throw new InvalidOperationException()
};

// Type patterns
double area = shape switch
{
    Circle c => Math.PI * c.Radius * c.Radius,
    Rectangle r => r.Width * r.Height,
    Triangle t => 0.5 * t.Base * t.Height,
    null => 0,
    _ => throw new ArgumentException($"Unknown shape: {shape.GetType()}")
};
```

<div class="callout callout--tip">
<p class="callout__title">When to Use Statement vs Expression</p>
<p>Use <strong>switch expressions</strong> when you need to return or assign a value based on patterns. They're concise and readable for mapping scenarios.</p>
<p>Use <strong>switch statements</strong> when each case needs multiple statements, side effects, or complex logic that doesn't fit neatly into a single expression.</p>
</div>

## Loops

### for Loop

Use when you need a counter or known iteration count.

```csharp
// Standard for loop
for (int i = 0; i < 10; i++)
{
    Console.WriteLine(i);
}

// Reverse iteration
for (int i = array.Length - 1; i >= 0; i--)
{
    Console.WriteLine(array[i]);
}

// Step by 2
for (int i = 0; i < 100; i += 2)
{
    Console.WriteLine(i); // Even numbers
}

// Multiple variables
for (int i = 0, j = 10; i < j; i++, j--)
{
    Console.WriteLine($"i={i}, j={j}");
}

// Infinite loop (use break to exit)
for (;;)
{
    if (ShouldStop()) break;
    DoWork();
}
```

### foreach Loop

Iterate over any `IEnumerable<T>` or `IEnumerable`.

```csharp
var names = new List<string> { "Alice", "Bob", "Charlie" };

foreach (var name in names)
{
    Console.WriteLine(name);
}

// With index using LINQ
foreach (var (name, index) in names.Select((n, i) => (n, i)))
{
    Console.WriteLine($"{index}: {name}");
}

// Dictionary iteration
var scores = new Dictionary<string, int>
{
    ["Alice"] = 95,
    ["Bob"] = 87
};

foreach (var kvp in scores)
{
    Console.WriteLine($"{kvp.Key}: {kvp.Value}");
}

// Deconstruct KeyValuePair
foreach (var (name, score) in scores)
{
    Console.WriteLine($"{name}: {score}");
}

// Ref foreach for modifying structs in place (C# 7.3)
Span<int> numbers = stackalloc int[] { 1, 2, 3, 4, 5 };
foreach (ref int n in numbers)
{
    n *= 2; // Modifies in place
}
```

### while and do-while

```csharp
// while - check condition first
int count = 0;
while (count < 10)
{
    Console.WriteLine(count);
    count++;
}

// Reading until condition met
string input;
while ((input = Console.ReadLine()) != "quit")
{
    ProcessInput(input);
}

// do-while - execute at least once
do
{
    Console.Write("Enter a number (1-10): ");
    input = Console.ReadLine();
} while (!int.TryParse(input, out int n) || n < 1 || n > 10);
```

## Loop Control

### break

Exit the innermost loop immediately.

```csharp
foreach (var item in items)
{
    if (item.IsTarget)
    {
        foundItem = item;
        break; // Exit loop
    }
}

// Breaking from nested loops requires a flag or goto
bool found = false;
for (int i = 0; i < rows && !found; i++)
{
    for (int j = 0; j < cols; j++)
    {
        if (matrix[i, j] == target)
        {
            found = true;
            break; // Only exits inner loop
        }
    }
}
```

### continue

Skip to the next iteration.

```csharp
foreach (var file in files)
{
    if (file.IsHidden)
        continue; // Skip hidden files

    ProcessFile(file);
}

// Filtering in loops
for (int i = 0; i < 100; i++)
{
    if (i % 2 != 0)
        continue; // Skip odd numbers

    ProcessEvenNumber(i);
}
```

<div class="callout callout--warning">
<p class="callout__title">goto (Use Sparingly)</p>
<p>Jump to a labeled statement. Rarely appropriate, but valid for breaking nested loops. In most cases, extracting to a method with an early return is clearer.</p>
</div>

### goto (Use Sparingly)

Jump to a labeled statement. Rarely appropriate, but valid for breaking nested loops.

```csharp
for (int i = 0; i < rows; i++)
{
    for (int j = 0; j < cols; j++)
    {
        if (matrix[i, j] == target)
        {
            goto Found;
        }
    }
}
Console.WriteLine("Not found");
goto End;

Found:
Console.WriteLine("Found!");

End:
// Continue with rest of code
```

Better alternative: extract to a method.

```csharp
var (row, col) = FindInMatrix(matrix, target);
if (row >= 0)
{
    Console.WriteLine($"Found at ({row}, {col})");
}

(int Row, int Col) FindInMatrix(int[,] matrix, int target)
{
    for (int i = 0; i < matrix.GetLength(0); i++)
    {
        for (int j = 0; j < matrix.GetLength(1); j++)
        {
            if (matrix[i, j] == target)
                return (i, j);
        }
    }
    return (-1, -1);
}
```

## Exception Handling

### try-catch-finally

```csharp
try
{
    var content = File.ReadAllText(path);
    ProcessContent(content);
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"File not found: {ex.FileName}");
}
catch (IOException ex)
{
    Console.WriteLine($"IO error: {ex.Message}");
}
catch (Exception ex)
{
    // Catch-all should be last
    Console.WriteLine($"Unexpected error: {ex.Message}");
    throw; // Re-throw to preserve stack trace
}
finally
{
    // Always executes, even if exception thrown
    CleanupResources();
}
```

### Exception Filters (C# 6.0)

Filter which exceptions to catch based on conditions.

```csharp
try
{
    await httpClient.GetAsync(url);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    return null; // Handle 404 specifically
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
{
    throw new AuthenticationException("Invalid credentials", ex);
}
catch (HttpRequestException ex)
{
    throw new ServiceException($"HTTP error: {ex.StatusCode}", ex);
}

// Logging without catching
catch (Exception ex) when (LogException(ex))
{
    // Never executes if LogException returns false
}

bool LogException(Exception ex)
{
    logger.LogError(ex, "Error occurred");
    return false; // Don't catch, just log
}
```

### throw and throw Expressions

```csharp
// Throwing exceptions
throw new ArgumentNullException(nameof(customer));
throw new InvalidOperationException("Cannot process in current state");

// throw expressions (C# 7.0)
string name = input ?? throw new ArgumentNullException(nameof(input));

var customer = GetCustomer(id) ?? throw new KeyNotFoundException($"Customer {id} not found");

// In expression-bodied members
public string Name
{
    get => name ?? throw new InvalidOperationException("Name not set");
    set => name = value ?? throw new ArgumentNullException(nameof(value));
}

// In conditional expressions
int result = isValid
    ? ProcessValue(value)
    : throw new InvalidOperationException("Invalid state");
```

### using Statement

Ensures `IDisposable` resources are properly cleaned up.

```csharp
// Classic using statement
using (var reader = new StreamReader(path))
{
    string content = reader.ReadToEnd();
    return content;
}
// reader.Dispose() called automatically

// Using declaration (C# 8.0) - disposes at end of scope
using var connection = new SqlConnection(connectionString);
connection.Open();
// Use connection...
// Disposed when method exits

// Multiple using declarations
using var reader = new StreamReader(inputPath);
using var writer = new StreamWriter(outputPath);
string line;
while ((line = reader.ReadLine()) != null)
{
    writer.WriteLine(line.ToUpper());
}
// Both disposed at end of method

// Pattern-based using (C# 8.0)
// Works with any type that has a public Dispose method
ref struct ResourceWrapper
{
    public void Dispose() { /* cleanup */ }
}

using var wrapper = new ResourceWrapper();
```

### await using for Async Dispose (C# 8.0)

```csharp
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();

await using var command = connection.CreateCommand();
command.CommandText = "SELECT * FROM Users";

await using var reader = await command.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    // Process rows
}
// All resources disposed asynchronously
```

## Iteration Patterns

### Early Exit with Guard Clauses

```csharp
public void ProcessOrder(Order order)
{
    // Guard clauses reduce nesting
    if (order == null)
        throw new ArgumentNullException(nameof(order));

    if (order.Items.Count == 0)
        return; // Nothing to process

    if (order.Status != OrderStatus.Pending)
        throw new InvalidOperationException("Order already processed");

    // Main logic, not nested
    foreach (var item in order.Items)
    {
        ProcessItem(item);
    }
}
```

### Collection Filtering in Loops vs LINQ

```csharp
// Loop with filtering
var results = new List<string>();
foreach (var item in items)
{
    if (item.IsActive && item.Value > 10)
    {
        results.Add(item.Name);
    }
}

// LINQ equivalent (often clearer for simple transformations)
var results = items
    .Where(i => i.IsActive && i.Value > 10)
    .Select(i => i.Name)
    .ToList();

// Use loops when:
// - You need to break early
// - You have complex side effects
// - Performance is critical (avoid allocations)
```

### Parallel Iteration

```csharp
// Parallel.ForEach for CPU-bound work
Parallel.ForEach(items, item =>
{
    ProcessItem(item); // Runs on multiple threads
});

// With degree of parallelism
Parallel.ForEach(items,
    new ParallelOptions { MaxDegreeOfParallelism = 4 },
    item => ProcessItem(item));

// For async I/O-bound work, use Task.WhenAll
var tasks = items.Select(item => ProcessItemAsync(item));
await Task.WhenAll(tasks);
```

## Key Takeaways

**Prefer switch expressions for mapping**: When transforming a value based on patterns, switch expressions are clearer than if-else chains.

**Use guard clauses to reduce nesting**: Return early for invalid cases instead of deeply nesting the happy path.

**Use using declarations**: The C# 8.0 `using var` syntax reduces nesting while maintaining deterministic disposal.

**Pattern matching makes intent clear**: Combining `is` patterns and switch expressions often produces more readable code than traditional type checks and casts.

**Choose the right loop**: Use `for` when you need an index, `foreach` for general iteration, and `while` when the termination condition isn't iteration-based.
