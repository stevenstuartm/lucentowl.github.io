---
title: "C# LINQ"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How LINQ queries actually run: query syntax as method calls, deferred and immediate execution, the pull pipeline and which operators buffer, IEnumerable versus IQueryable and the static-type trap that moves filtering into memory, composing queries and reusable operators, and the performance mistakes that come from all of it."
tags: [linq, ienumerable, iqueryable, deferred-execution, functional-programming, practical]
---

## What LINQ Is

LINQ (Language Integrated Query) is a set of query operators, such as `Where`, `Select`, `OrderBy`, and `GroupBy`, that work on any sequence. The operators are ordinary extension methods. `System.Linq.Enumerable` defines them for `IEnumerable<T>`, which covers every in-memory collection, and `System.Linq.Queryable` defines a parallel set for `IQueryable<T>`, which a provider such as Entity Framework Core translates into another query language. The same query shape works over a `List<T>` and over a database table, but the two run in completely different places, and most of this guide is about telling them apart.

### Query Syntax Is Method Calls

C# offers two ways to write a query:

```csharp
// Query syntax
var adults = from p in people
             where p.Age >= 18
             orderby p.Name
             select p;

// Method syntax
var adults = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.Name);
```

These produce the same code. The compiler rewrites query syntax into method calls before it type-checks anything, so `where` becomes a call to whatever `Where` method is in scope for the source's type. Query syntax has no keyword for most operators (`Count`, `First`, `Distinct`, `Take`, `ToList` and many more), so real queries tend to end in method calls either way. Its advantage is readability for joins, multiple `from` clauses, and `let`, where method syntax would need nested lambdas and anonymous types to carry intermediate values. The choice is style, not behavior.

## Deferred and Immediate Execution

Calling `Where` does not filter anything. It returns an object that remembers the source and the predicate, and the filtering happens later, when something enumerates that object. Operators that return a sequence work this way and are called **deferred**. Operators that return a single value or a materialized collection, such as `Count`, `First`, `Sum`, `ToList`, and `ToDictionary`, run the query on the spot and are called **immediate**.

| | Deferred | Immediate |
|---|---|---|
| Examples | `Where`, `Select`, `OrderBy`, `GroupBy`, `Take`, `Skip` | `ToList`, `ToArray`, `ToDictionary`, `Count`, `First`, `Any`, `Sum` |
| Returns | Another sequence | A value or a new collection |
| Runs | Each time the result is enumerated | Once, at the call |
| Sees later changes to the source | Yes | No, the result is a copy |

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };

var query = numbers.Where(n => n > 2);   // nothing runs yet
numbers.Add(6);

foreach (var n in query)
    Console.WriteLine(n);                // 3, 4, 5, 6: the query runs now, and sees the 6

var snapshot = numbers.Where(n => n > 2).ToList();   // runs now
numbers.Add(100);                                     // snapshot still has four items
```

A materialized list copies the elements, not the objects they refer to. A `List<Customer>` from `ToList()` still points at the same `Customer` instances, so a change to a customer's properties shows up through both.

### How a Deferred Query Runs

A chain of deferred operators is a stack of wrappers, each holding the one before it. Enumerating the outermost wrapper pulls one element at a time up through the chain:

{% include figure.html id="dn-linq-pull-pipeline" %}

Each element travels the whole chain before the next one is read. Run on .NET 10 with logging in every stage, the order is: read 1, test 1, project 1, deliver 10, read 2, test 2 (rejected), read 3, test 3, project 3, deliver 30. No intermediate list is built between `Where` and `Select`, which is why a deferred pipeline over a large or endless source uses almost no memory, and why `Take(10)` over an endless source finishes.

Some operators can't work one element at a time. `OrderBy` can't yield the smallest element until it has seen all of them, so on the first request it reads the entire source into a buffer, sorts it, and only then starts yielding. `GroupBy` and `Reverse` behave the same way. A buffering operator in the middle of a chain is where a lazy query stops being lazy. Everything upstream runs to completion the first time anything downstream asks for an element.

### What a Deferred Query Captures

Because the query runs later, it sees the state of the world at enumeration time, not at definition time. That applies to the variables its lambdas capture as well as to the source:

```csharp
int minimum = 2;
var large = numbers.Where(n => n > minimum);
minimum = 4;

Console.WriteLine(string.Join(",", large));   // 5,6,100: uses minimum = 4
```

The lambda captured the variable `minimum`, not its value, so the query reads whatever `minimum` holds when it runs. Changing the source *while* a query enumerates it is a different case. Adding to a `List<T>` inside a `foreach` over `list.Where(...)` throws `InvalidOperationException`, because the query is enumerating that same list underneath.

Errors are split the same way. Argument checks run at the call, so `Where` on a `null` source throws `ArgumentNullException` immediately. An exception thrown *inside* a lambda surfaces only when the query runs, which can be far from the line that defined it. A stack trace pointing at a `foreach` or a `ToList()` is often a predicate failing that was written somewhere else.

### Multiple Enumeration Runs the Query Again

Every enumeration of a deferred query repeats the whole query:

```csharp
// Runs the filter twice
var active = items.Where(i => i.IsActive);
if (active.Any())
{
    foreach (var item in active) { /* ... */ }
}

// Runs it once
var active = items.Where(i => i.IsActive).ToList();
if (active.Count > 0)
{
    foreach (var item in active) { /* ... */ }
}
```

Over an in-memory list the cost is repeated CPU work. Over a database query each enumeration is another round trip, and over an iterator that reads a file or a network stream, the second pass may not see the same data or may not be possible at all. When a result will be used more than once, materialize it once with `ToList()` or `ToArray()`. The same applies to a method that accepts `IEnumerable<T>` and walks it twice. It can't know whether its argument is a list or an expensive query, so it should materialize first or accept a collection type instead.

## IEnumerable&lt;T&gt; Versus IQueryable&lt;T&gt;

The two interfaces carry the same operators with different parameter types, and that difference decides where the query runs:

| | `IEnumerable<T>` (LINQ to Objects) | `IQueryable<T>` (a provider) |
|---|---|---|
| Operators come from | `System.Linq.Enumerable` | `System.Linq.Queryable` |
| A `Where` predicate is a | `Func<T, bool>` delegate: compiled code | `Expression<Func<T, bool>>`: a data structure describing the code |
| The query runs | In your process, by calling the delegates | Wherever the provider sends it, usually a database, after translating the expression tree |
| A lambda may call | Any C# method | Only what the provider knows how to translate |
| An untranslatable call fails | Never, it's just code | At run time, when the query executes |

When a lambda is passed where an `Expression<Func<...>>` is expected, the compiler builds an expression tree describing the lambda instead of compiling it. Each `Queryable` operator adds its call to a growing tree, and nothing leaves the process until enumeration, when the provider translates the whole tree at once. With EF Core, that means one `Where`, one `OrderBy`, and a `Take` become a single SQL statement with a `WHERE`, an `ORDER BY`, and a row limit, and only the matching rows cross the network.

{% include figure.html id="dn-iqueryable-vs-ienumerable" %}

Both paths produce the same ten rows. The difference is how much data moved and where the filtering work happened.

### The Static-Type Trap

Extension methods bind at compile time, by the variable's static type, not by the object it holds at run time. `IQueryable<T>` inherits from `IEnumerable<T>`, so an `IQueryable<T>` stored in an `IEnumerable<T>` variable is still a valid `IEnumerable<T>`, and `Where` on that variable binds to `Enumerable.Where`:

```csharp
IQueryable<Product> products = db.Products;
var cheap = products.Where(p => p.Price < 10);   // Queryable.Where: filtered in SQL

IEnumerable<Product> all = db.Products;
var cheapAgain = all.Where(p => p.Price < 10);   // Enumerable.Where: every product is
                                                 // loaded, then filtered in memory
```

Both lines compile, both return the right products, and the second one reads the whole table. The same thing happens through a method that returns `IEnumerable<Product>` while building an `IQueryable` internally, and through a predicate stored as a delegate:

```csharp
Func<Product, bool> isCheap = p => p.Price < 10;
var viaDelegate = db.Products.Where(isCheap);    // no Queryable.Where takes a Func,
                                                 // so this binds to Enumerable.Where

Expression<Func<Product, bool>> isCheapExpr = p => p.Price < 10;
var viaExpression = db.Products.Where(isCheapExpr);   // stays in SQL
```

The tell in each case is the result type. `viaDelegate` and `cheapAgain` are `IEnumerable<Product>`, and once a query is `IEnumerable`, every operator after it runs in memory too.

### Switching to Memory on Purpose

Sometimes part of a query can't be translated, such as a call into your own C# method, a regex, or a formatting routine. `AsEnumerable()` is the deliberate switch. Everything before it goes to the provider, and everything after it runs in memory:

```csharp
var report = db.Orders
    .Where(o => o.PlacedAt >= since)          // translated to SQL
    .Select(o => new { o.Id, o.Total, o.Notes })
    .AsEnumerable()                           // switch to LINQ to Objects here
    .Where(o => NotesLookSuspicious(o.Notes)); // runs in memory, on the filtered rows
```

Put the switch as late as possible, after every filter and projection the provider can do, so the smallest possible set of rows crosses over. EF Core refuses to silently do this for you. A lambda it can't translate throws when the query executes, except in the final `Select`, where it evaluates the untranslatable part in memory.

`AsQueryable()` goes the other way only in name. Called on an in-memory collection, it wraps the collection in an `IQueryable` whose provider compiles the expression tree and runs it in memory. It lets code that expects `IQueryable<T>` accept a list, often in tests, but no database is involved, so a test passing against it says nothing about whether a real provider can translate the query.

## Composing Queries

Because deferred operators only build up a query, a query can be assembled in pieces and run once at the end.

### Building a Query Conditionally

Each `Where` narrows the query further, and with `IQueryable<T>` all of them land in the same `WHERE` clause:

```csharp
IQueryable<Product> query = db.Products;

if (!string.IsNullOrEmpty(searchTerm))
    query = query.Where(p => p.Name.Contains(searchTerm));

if (categoryId.HasValue)
    query = query.Where(p => p.CategoryId == categoryId);

if (minPrice.HasValue)
    query = query.Where(p => p.Price >= minPrice);

var results = await query.OrderBy(p => p.Name).ToListAsync();
```

Declare the variable as `IQueryable<Product>` explicitly. With `var` it would be inferred as `DbSet<Product>`, and assigning the result of `Where` back to it wouldn't compile. Declared as `IEnumerable<Product>`, it would compile and fall into the static-type trap above.

### Writing Reusable Operators

A query fragment used in several places can become an extension method. For an in-memory sequence it extends `IEnumerable<T>`, usually as an iterator with `yield return` so it stays deferred like the built-in operators. For a provider query it has to extend `IQueryable<T>` and pass expressions, not delegates, or it silently drops into memory:

```csharp
public static class ProductQueries
{
    // The lambda is converted to an expression because Queryable.Where expects one
    public static IQueryable<Product> InStock(this IQueryable<Product> products) =>
        products.Where(p => p.Stock > 0);

    public static IQueryable<Product> PricedBetween(
        this IQueryable<Product> products, decimal min, decimal max) =>
        products.Where(p => p.Price >= min && p.Price <= max);
}

var page = await db.Products
    .InStock()
    .PricedBetween(10m, 50m)
    .OrderBy(p => p.Name)
    .Skip(20).Take(10)
    .ToListAsync();
```

The fragment itself can't call a C# helper method inside its lambda for the same reason any provider query can't. The provider sees a method call it has no translation for.

### Batching and Indexing

`Chunk(size)` (.NET 6) splits a sequence into arrays of at most `size` elements, with a shorter final chunk. It is the standard way to send work in batches without writing a batching iterator by hand:

```csharp
foreach (var batch in orderIds.Chunk(100))
    await SubmitAsync(batch);   // batch is an int[]
```

`Index()` (.NET 9) pairs each element with its position. Before .NET 9, the `Select((item, i) => ...)` overload did the same job:

```csharp
foreach (var (index, name) in names.Index())
    Console.WriteLine($"{index}: {name}");
```

LINQ has no `ForEach` operator. Its operators are meant to compute results without side effects, and a `foreach` loop is the clearer way to act on each element. (`List<T>.ForEach` exists, but it is a method on the list, not a LINQ operator.)

### Newer Operators That Replace Old Workarounds

.NET 6 onward added operators for patterns that used to need a `GroupBy` or a hand-written loop. They are all deferred or immediate by the same rules as the older operators.

| Operator | Since | Replaces |
|---|---|---|
| `DistinctBy`, `UnionBy`, `IntersectBy`, `ExceptBy` | .NET 6 | A `GroupBy` and `First`, or a custom comparer, to deduplicate by a key |
| `MinBy`, `MaxBy` | .NET 6 | `OrderBy(...).First()` to get the element with the smallest or largest key |
| `Order`, `OrderDescending` | .NET 7 | `OrderBy(x => x)` |
| `CountBy`, `AggregateBy` | .NET 9 | `GroupBy(...).Select(g => (g.Key, g.Count()))` and similar, without building each group |
| `LeftJoin`, `RightJoin` | .NET 10 | The `GroupJoin` plus `SelectMany` plus `DefaultIfEmpty` pattern for an outer join |

## Where LINQ Performance Goes Wrong

LINQ's overhead over a hand-written loop is usually small next to what the query does. The costly mistakes are structural: running a query more often than intended (covered above), reading more than needed, or doing work in the wrong complexity class.

### Counting When You Only Need to Know Whether

`Count()` on a `List<T>`, an array, or any other `ICollection<T>` reads the collection's stored count without enumerating it. On a deferred query it has no stored count, so it walks every element. `Any()` stops at the first one:

```csharp
if (query.Count() > 0)     // walks the whole query
if (query.Any())           // stops at the first match

if (query.Count() > 5)     // walks the whole query
if (query.Skip(5).Any())   // stops after the sixth element
```

On a type that already exposes `Count` or `Length`, use the property and skip LINQ altogether. The CA1829 and CA1860 code-analysis rules flag `Count()` and `Any()` calls on such types. `TryGetNonEnumeratedCount` (.NET 6) returns a count only when the source can supply one without enumerating, which lets a method taking `IEnumerable<T>` size a buffer when that's cheap and skip it when it isn't.

### Lookups Inside a Query

A `Contains` on a list inside a `Where` scans the list once per element, so the query's cost is the product of the two sizes:

```csharp
List<int> vipIds = GetVipIds();                              // 10,000 ids
var vipOrders = orders.Where(o => vipIds.Contains(o.CustomerId));   // up to 10,000 comparisons per order

var vipSet = GetVipIds().ToHashSet();
var vipOrders = orders.Where(o => vipSet.Contains(o.CustomerId));   // one hash lookup per order
```

The same shape appears as a `FirstOrDefault` inside a `Select` to find a matching record in another list. Build a `HashSet<T>` or `Dictionary<TKey, TValue>` once, or use `Join`, which builds a hash lookup of the inner sequence internally. Against a database this doesn't apply. EF Core translates `Contains` on a local list inside an `IQueryable` query into a membership test that the database runs.

### Reading More Than You Need

With `IQueryable`, a `Select` that projects only the needed columns is a smaller query, and a filter placed after `ToList()` or `AsEnumerable()` is a filter the database never saw. With `IEnumerable`, a buffering operator early in a chain forces every upstream element through, even when a later `Take` wants only a few. Put filters first and buffering operators as late as the logic allows.

### Hot Paths

Each operator in a chain allocates an iterator object, and each lambda call is a delegate invocation. Recent .NET releases have removed much of this cost for common chains over arrays and lists, but in a loop that runs millions of times, a plain `for` or `foreach` can still be measurably faster. Measure before rewriting. Outside hot paths, the readability of a query is worth far more than the difference.

## Key Takeaways

**A query is a description until something enumerates it.** Deferred operators run each time the result is enumerated, see changes to the source and to captured variables, and throw from inside their lambdas at that point, not where they were written.

**Buffering operators end the laziness.** `OrderBy`, `GroupBy`, and `Reverse` read their whole source before yielding anything.

**Materialize anything you use twice.** Each enumeration of a database query is another round trip.

**The static type decides where a query runs.** `IQueryable<T>` hands the expression tree to a provider to translate. The same query through an `IEnumerable<T>` variable, a method returning `IEnumerable<T>`, or a `Func` predicate runs in memory after loading everything.

**Cross into memory deliberately.** Use `AsEnumerable()` after every filter the provider can apply, and write reusable provider fragments as `IQueryable<T>` extensions that take expressions.

**Fix the structure before the syntax.** `Any()` over `Count() > 0`, a `HashSet` instead of `List.Contains` inside a query, and projecting before materializing matter far more than query versus method syntax.
