---
title: "C# LINQ"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Language Integrated Query (LINQ) fundamentals, query operations, deferred execution, and practical patterns."
tags: [c-sharp, dotnet, linq, functional-programming, data-processing, practical]
---

## What is LINQ

LINQ (Language Integrated Query) brings query capabilities directly into C#. It provides a consistent way to query any data source: collections, databases, XML, and more.

```csharp
// Query syntax - declarative, SQL-like
var adults = from p in people
             where p.Age >= 18
             orderby p.Name
             select p;

// Method syntax - functional, chainable
var adults = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.Name);

// Both compile to the same thing
```

## Deferred vs Immediate Execution

Understanding when queries execute is crucial for performance and correctness.

### Deferred Execution

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Deferred Execution</h4>
<ul>
<li>Where, Select, OrderBy</li>
<li>Executes when enumerated</li>
<li>Re-executes on each enumeration</li>
<li>Sees data changes</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Immediate Execution</h4>
<ul>
<li>ToList, ToArray, Count, First</li>
<li>Executes right away</li>
<li>Materializes results</li>
<li>Snapshot of data</li>
</ul>
</div>
</div>

Most LINQ operations don't execute immediately. The query is built and executed only when results are enumerated.

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };

// Query is defined but not executed
var query = numbers.Where(n => n > 2);

// Add more data
numbers.Add(6);

// Query executes NOW, includes 6
foreach (var n in query)
{
    Console.WriteLine(n);  // 3, 4, 5, 6
}

// Each enumeration re-executes
var count1 = query.Count();  // Executes query
var count2 = query.Count();  // Executes again
```

### Immediate Execution

Methods that return a single value or materialize results execute immediately.

```csharp
// Immediate - single value
int count = numbers.Count();
int first = numbers.First();
bool any = numbers.Any(n => n > 10);
int sum = numbers.Sum();

// Immediate - materialization
List<int> list = numbers.Where(n => n > 2).ToList();
int[] array = numbers.Where(n => n > 2).ToArray();
Dictionary<int, string> dict = people.ToDictionary(p => p.Id, p => p.Name);

// After ToList(), changes to source don't affect result
numbers.Add(100);  // list doesn't change
```

## Common Patterns

### Null-Safe Enumeration

```csharp
// Coalesce null to empty
var items = GetItems() ?? Enumerable.Empty<Item>();

foreach (var item in items)
{
    Process(item);
}

// Or with null-conditional
foreach (var item in GetItems() ?? Array.Empty<Item>())
{
    Process(item);
}
```

### Batched Processing

```csharp
public static IEnumerable<IEnumerable<T>> Batch<T>(
    this IEnumerable<T> source, int size)
{
    var batch = new List<T>(size);
    foreach (var item in source)
    {
        batch.Add(item);
        if (batch.Count == size)
        {
            yield return batch;
            batch = new List<T>(size);
        }
    }
    if (batch.Count > 0)
        yield return batch;
}

// Or use Chunk in .NET 6+
foreach (var batch in items.Chunk(100))
{
    await ProcessBatchAsync(batch);
}
```

### Index with ForEach

```csharp
// LINQ doesn't have ForEach; use foreach or extension
foreach (var (item, index) in items.Select((x, i) => (x, i)))
{
    Console.WriteLine($"{index}: {item}");
}

// Or create extension
public static void ForEach<T>(this IEnumerable<T> source, Action<T, int> action)
{
    int index = 0;
    foreach (var item in source)
        action(item, index++);
}
```

### Conditional Query Building

```csharp
IQueryable<Product> query = dbContext.Products;

if (!string.IsNullOrEmpty(searchTerm))
    query = query.Where(p => p.Name.Contains(searchTerm));

if (categoryId.HasValue)
    query = query.Where(p => p.CategoryId == categoryId);

if (minPrice.HasValue)
    query = query.Where(p => p.Price >= minPrice);

var results = await query.OrderBy(p => p.Name).ToListAsync();
```

## Performance Tips

### Avoid Multiple Enumeration

<div class="callout callout--warning">
<p class="callout__title">Multiple Enumeration Performance Trap</p>
<p>Each enumeration of a deferred query re-executes the entire query. If you need the results more than once, materialize with <code>ToList()</code> or <code>ToArray()</code>.</p>
</div>

```csharp
// BAD - enumerates twice
var filtered = items.Where(i => i.IsActive);
if (filtered.Any())  // First enumeration
{
    foreach (var item in filtered)  // Second enumeration
    {
    }
}

// GOOD - materialize once
var filtered = items.Where(i => i.IsActive).ToList();
if (filtered.Count > 0)
{
    foreach (var item in filtered)
    {
    }
}
```

### Use Count Wisely

```csharp
// BAD - counts all elements
if (items.Count() > 0)

// GOOD - stops at first element
if (items.Any())

// BAD - counts all
if (items.Count() > 5)

// GOOD - stops after 6
if (items.Skip(5).Any())
// Or (C# 10 / .NET 6)
if (items.TryGetNonEnumeratedCount(out var count) ? count > 5 : items.Skip(5).Any())
```

### Prefer Method Syntax for Complex Queries

Query syntax shines for simple queries with joins. Method syntax is more flexible for complex transformations.

## Key Takeaways

**Understand deferred execution**: Queries don't run until enumerated. Materialize with ToList() when you need to reuse results.

**Use the right method**: Any() vs Count() > 0, FirstOrDefault() vs First(), etc. Choose based on intent and performance.

**Method syntax for flexibility**: Query syntax is readable for simple queries, but method syntax handles complex scenarios better.

**Avoid multiple enumeration**: Materializing results prevents re-executing expensive queries.

**Leverage new .NET 6+ methods**: Chunk(), DistinctBy(), MinBy(), MaxBy() solve common patterns elegantly.
