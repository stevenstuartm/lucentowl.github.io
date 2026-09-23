---
title: "C# Control Flow"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How C# statements direct execution: if and guard clauses, the switch statement's no-fall-through rules, choosing between for, foreach, while, and do, what foreach compiles to, loop-variable capture, and how break, continue, return, and goto interact with finally."
tags: [control-flow, switch-statement, loops, foreach, closures, fundamentals]
---

## Statements Direct Execution

Control flow is the set of **statements** that decide which code runs next. Branches choose a path, loops repeat one, and jump statements leave a block early. None of them produce a value. When the goal of a branch is to compute a value, expression forms like the conditional operator `?:` and the switch expression usually fit better, because the result can be assigned once and the compiler can check that every case is handled. This guide covers the statement forms, which remain the right tool when each path *does* something rather than *produces* something.

## Branching with if

```csharp
if (score >= 90)
{
    grade = "A";
}
else if (score >= 80)
{
    grade = "B";
}
else
{
    grade = "C";
}
```

The braces are optional around a single statement, and leaving them out is how a second line added later ends up running unconditionally. Most teams enforce braces through an EditorConfig rule rather than code review.

The condition can be any `bool` expression, including a pattern test that binds a variable for use inside the branch:

```csharp
if (value is string text)
{
    Console.WriteLine(text.Length);  // text is in scope and non-null here
}
```

### Guard Clauses Flatten Nesting

Each nested `if` adds a level of indentation and a condition the reader has to hold in mind until its closing brace. A method that checks three preconditions before doing its work reads as a pyramid:

```csharp
if (order != null)
{
    if (order.Items.Count > 0)
    {
        if (order.Status == OrderStatus.Pending)
        {
            Process(order);
        }
    }
}
```

Inverting each condition and leaving early puts the preconditions at the top, one per line, and leaves the main logic unindented:

```csharp
ArgumentNullException.ThrowIfNull(order);
if (order.Items.Count == 0) return;
if (order.Status != OrderStatus.Pending)
    throw new InvalidOperationException("Order already processed");

Process(order);
```

The two versions behave the same. The difference is that in the second, a reader who reaches `Process(order)` knows every condition that led there without scanning back through the braces.

## The switch Statement

A `switch` statement compares one value against a list of `case` labels and runs the statements in the first section that matches.

```csharp
switch (day)
{
    case DayOfWeek.Saturday:
    case DayOfWeek.Sunday:
        ScheduleMaintenance();
        break;
    case DayOfWeek.Monday:
        SendWeeklyReport();
        goto default;          // run the default section as well
    default:
        ProcessQueue();
        break;
}
```

### No Fall-Through Between Sections

In C and Java, a `case` without a `break` falls through into the next one. C# makes that a compile error. Every section must end with a statement that leaves it: `break`, `return`, `throw`, `continue` inside a loop, or `goto`. Stacking several labels on one section, as `Saturday` and `Sunday` do above, is allowed because the first label has no statements of its own. When one section genuinely should continue into another, `goto case X` or `goto default` says so explicitly, and the reader can't mistake it for a forgotten `break`.

### Pattern Cases and Their Order

Since C# 7, a `case` label can be any pattern, optionally followed by a `when` guard for conditions a pattern can't express. Cases are then checked **top to bottom**, so a specific case must come before a general one that would also match. The compiler rejects a case that an earlier one already covers, since it could never run.

```csharp
switch (shape)
{
    case Circle { Radius: > 10 } c:
        Console.WriteLine($"Large circle, radius {c.Radius}");
        break;
    case Circle c:
        Console.WriteLine($"Circle, radius {c.Radius}");
        break;
    case Rectangle r when r.Width == r.Height:
        Console.WriteLine($"Square, side {r.Width}");
        break;
    case null:
        Console.WriteLine("No shape");
        break;
    default:
        Console.WriteLine("Other shape");
        break;
}
```

`default` can appear anywhere in the list and still runs only when no other case matches. If nothing matches and there is no `default`, the statement does nothing and execution continues after it. That silence is the main practical difference from a switch expression, which warns at compile time about unhandled inputs and throws at run time if one arrives.

Use the statement when each case performs actions, needs several statements, or has nothing to return. When every case produces a value for the same variable, the switch expression is shorter and the compiler checks it more thoroughly.

## Choosing a Loop

| Loop | Tests its condition | Use when |
|------|---------------------|----------|
| `foreach` | Before each element | Visiting every element of a collection, which is most loops |
| `for` | Before each iteration | The index itself matters: stepping by more than one, iterating backwards, or reading neighbouring elements |
| `while` | Before each iteration, so the body may run zero times | The end depends on something other than a count, like input or a queue draining |
| `do`/`while` | After each iteration, so the body runs at least once | The first pass produces the value the condition tests, as with prompting until the input is valid |

```csharp
for (int i = array.Length - 1; i >= 0; i--)     // backwards by index
{
    Console.WriteLine(array[i]);
}

foreach (var name in names)                      // every element
{
    Console.WriteLine(name);
}

string? line;
while ((line = reader.ReadLine()) is not null)   // until the input ends
{
    Process(line);
}

int choice;
do                                               // at least once
{
    Console.Write("Enter 1-10: ");
}
while (!int.TryParse(Console.ReadLine(), out choice) || choice is < 1 or > 10);
```

The `while` loop tests for `null`, not only for a sentinel string. `ReadLine` returns `null` at the end of input, and a loop written as `while ((line = Console.ReadLine()) != "quit")` never ends when input is redirected from a file that lacks the sentinel.

Every section of a `for` header is optional, so `for (;;)` is an infinite loop, as is `while (true)`. Both need a `break` or `return` inside to stop.

## How foreach Works

`foreach` does not require `IEnumerable<T>`. It works on any type with a public `GetEnumerator()` method (an extension method counts) that returns something with a `bool MoveNext()` method and a `Current` property. The compiler rewrites the loop into roughly this:

```csharp
var e = collection.GetEnumerator();
try
{
    while (e.MoveNext())
    {
        var item = e.Current;
        // loop body
    }
}
finally
{
    (e as IDisposable)?.Dispose();
}
```

That shape explains several behaviours. The enumerator is disposed even when the body throws or `break`s, which is what lets an iterator method's `finally` blocks and `using` statements run. Applying `foreach` to `null` throws `NullReferenceException` at the `GetEnumerator()` call. For arrays and `Span<T>`, the compiler skips the enumerator and emits an indexed loop, so `foreach` over an array costs no more than `for`.

### Modifying the Collection Ends the Loop

The standard collections track a version number that every `Add`, `Remove`, or `Clear` increments. The enumerator checks it on each `MoveNext`, so changing the collection mid-loop throws `InvalidOperationException` on the next iteration:

```csharp
foreach (var item in list)
{
    if (item.IsExpired)
        list.Remove(item);   // InvalidOperationException on the next MoveNext
}

// Removing in place: iterate backwards by index so removals don't shift unvisited items
for (int i = list.Count - 1; i >= 0; i--)
{
    if (list[i].IsExpired)
        list.RemoveAt(i);
}

// Or let the collection do it
list.RemoveAll(item => item.IsExpired);
```

### Getting the Index and Writing Elements

`foreach` gives the element, not its position. When the position is also needed, `Index()` (.NET 9) pairs each element with its index, and on earlier versions `Select((item, i) => (i, item))` does the same:

```csharp
foreach (var (index, name) in names.Index())
{
    Console.WriteLine($"{index}: {name}");
}
```

The iteration variable is a read-only copy of the element, so assigning to it doesn't compile. When the enumerator's `Current` returns by reference, as `Span<T>`'s does, declaring the variable `ref` makes it an alias for the element itself, and writes go straight into the underlying memory:

```csharp
Span<int> numbers = stackalloc int[] { 1, 2, 3 };
foreach (ref int n in numbers)
{
    n *= 2;   // numbers is now { 2, 4, 6 }
}
```

For an `IAsyncEnumerable<T>`, `await foreach` follows the same pattern with `GetAsyncEnumerator` and an awaited `MoveNextAsync`.

## Loop Variables and Closures

A lambda created inside a loop **captures the variable, not its current value**. Whether that is a bug depends on which loop declared the variable.

```csharp
var actions = new List<Func<int>>();

for (int i = 0; i < 3; i++)
    actions.Add(() => i);
// Every lambda returns 3

foreach (var x in new[] { 0, 1, 2 })
    actions.Add(() => x);
// These return 0, 1, 2
```

A `for` loop declares **one** `i` for the whole loop, and every lambda shares it. By the time they run, the loop has finished and `i` is 3. `foreach` declares a **fresh** variable for each iteration (a change made in C# 5), so each lambda has its own. The fix for `for` is to copy the value into a variable declared inside the body:

```csharp
for (int i = 0; i < 3; i++)
{
    int copy = i;
    actions.Add(() => copy);  // 0, 1, 2
}
```

The same trap applies to any delayed use of a loop variable, including tasks started in the loop and event handlers subscribed in it.

## Jump Statements

Four statements move execution somewhere other than the next line. `break` leaves the innermost loop or `switch`. `continue` skips to the next iteration of the innermost loop. `return` leaves the method. `goto` jumps to a label in the same method, or to another `case` within a `switch`.

```csharp
foreach (var file in files)
{
    if (file.IsHidden)
        continue;        // next file

    if (file.Name == target)
    {
        found = file;
        break;           // stop searching
    }
}
```

### Leaving Nested Loops

`break` only leaves the innermost loop, so finding a value in a grid needs something more. A `goto` to a label after the outer loop works and is one of the few uses of `goto` that reads clearly. Extracting the search into a method and using `return` usually reads better still, because the method's name documents what the loops are for:

```csharp
static (int Row, int Col)? Find(int[,] grid, int target)
{
    for (int r = 0; r < grid.GetLength(0); r++)
        for (int c = 0; c < grid.GetLength(1); c++)
            if (grid[r, c] == target)
                return (r, c);

    return null;
}
```

A flag variable checked in the outer loop's condition also works, at the cost of an extra variable whose only job is to carry the result out.

### Jumps Still Run finally

A `return`, `break`, `continue`, or `goto` that leaves a `try` block runs the `finally` block on the way out. The jump is not skipped, it is delayed:

```csharp
static int Read()
{
    try
    {
        return 1;
    }
    finally
    {
        Console.WriteLine("cleanup");  // prints before the caller receives 1
    }
}
```

The same guarantee covers `using` statements, which compile to `try`/`finally`, and the `foreach` enumerator disposal shown above. It's why an early `return` from inside a `using` block, or a `break` out of a `foreach` over a file-reading iterator, still releases the resource. A `finally` block itself cannot contain a `return`, and a jump out of `finally` is a compile error.

## Loops Versus LINQ

Much of what a loop does (filtering, projecting, summing, finding the first match) LINQ expresses as a single query:

```csharp
var names = items
    .Where(i => i.IsActive && i.Value > 10)
    .Select(i => i.Name)
    .ToList();
```

The query states *what* is computed. The loop states *how*, which is what makes the loop the better choice when the body has side effects beyond building a result, when one pass needs to update several results at once, or when it has to stop early on a condition that isn't simply "found the first match". In hot paths, a loop also avoids the delegate calls and enumerator allocations a LINQ chain can introduce, though that is a reason to measure, not a default.

## Key Takeaways

**Leave early instead of nesting.** Guard clauses put the preconditions at the top and keep the main logic unindented.

**A switch section can't fall through.** Stack labels to share a section and use `goto case` when one section should continue into another. Pattern cases are checked in order, and a `switch` statement with no match silently does nothing.

**`foreach` is a pattern, not an interface.** It disposes its enumerator on every exit and throws if the collection changes underneath it.

**`for` shares its loop variable, `foreach` doesn't.** A lambda created in a `for` loop sees the variable's final value unless the body copies it first.

**Every jump out of a `try` runs `finally`.** That includes `return`, `break`, and `continue`, which is why `using` and `foreach` still clean up on an early exit.
