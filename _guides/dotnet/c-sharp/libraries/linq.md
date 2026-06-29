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

## Filtering

### Where

Filter elements based on a predicate.

```csharp
var adults = people.Where(p => p.Age >= 18);

var activeAdmins = users
    .Where(u => u.IsActive)
    .Where(u => u.Role == "Admin");

// With index
var evenIndexed = items.Where((item, index) => index % 2 == 0);
```

### OfType

Filter by type.

```csharp
object[] mixed = { 1, "hello", 2, "world", 3 };

var strings = mixed.OfType<string>();  // "hello", "world"
var ints = mixed.OfType<int>();        // 1, 2, 3
```

### Distinct and DistinctBy

Remove duplicates.

```csharp
var unique = numbers.Distinct();

// DistinctBy specific property (C# 10 / .NET 6)
var uniqueByName = people.DistinctBy(p => p.Name);

// Custom equality comparer
var uniqueEmails = people.Distinct(new EmailComparer());
```

## Projection

### Select

Transform each element.

```csharp
var names = people.Select(p => p.Name);

var dtos = orders.Select(o => new OrderDto
{
    Id = o.Id,
    CustomerName = o.Customer.Name,
    Total = o.Items.Sum(i => i.Price)
});

// With index
var indexed = items.Select((item, i) => new { Index = i, Item = item });

// Anonymous types
var summaries = people.Select(p => new { p.Name, p.Age });
```

### SelectMany

Flatten nested collections.

```csharp
var allOrders = customers.SelectMany(c => c.Orders);

// With result selector
var orderDetails = customers.SelectMany(
    c => c.Orders,
    (customer, order) => new { customer.Name, order.Total });

// Flatten then filter
var expensiveItems = orders
    .SelectMany(o => o.Items)
    .Where(i => i.Price > 100);

// Query syntax
var items = from order in orders
            from item in order.Items
            where item.Price > 100
            select item;
```

## Ordering

### OrderBy and OrderByDescending

```csharp
var byName = people.OrderBy(p => p.Name);
var byAgeDesc = people.OrderByDescending(p => p.Age);

// Multiple sort criteria
var sorted = people
    .OrderBy(p => p.LastName)
    .ThenBy(p => p.FirstName)
    .ThenByDescending(p => p.Age);

// Query syntax
var sorted = from p in people
             orderby p.LastName, p.FirstName, p.Age descending
             select p;
```

### Reverse

```csharp
var reversed = numbers.Reverse();
```

## Grouping

### GroupBy

Group elements by a key.

```csharp
var byDepartment = employees.GroupBy(e => e.Department);

foreach (var group in byDepartment)
{
    Console.WriteLine($"{group.Key}: {group.Count()} employees");
    foreach (var employee in group)
    {
        Console.WriteLine($"  - {employee.Name}");
    }
}

// With element selector
var namesByDept = employees.GroupBy(
    e => e.Department,
    e => e.Name);

// With result selector
var deptSummaries = employees.GroupBy(
    e => e.Department,
    (dept, emps) => new
    {
        Department = dept,
        Count = emps.Count(),
        AverageSalary = emps.Average(e => e.Salary)
    });

// Query syntax
var byDepartment = from e in employees
                   group e by e.Department into g
                   select new { Department = g.Key, Count = g.Count() };
```

### ToLookup

Like GroupBy but executes immediately and supports repeated lookups.

```csharp
var lookup = employees.ToLookup(e => e.Department);

var engineering = lookup["Engineering"];
var hr = lookup["HR"];
var missing = lookup["NonExistent"];  // Empty, not null
```

## Joining

### Join

Inner join two sequences.

```csharp
var joined = orders.Join(
    customers,
    order => order.CustomerId,
    customer => customer.Id,
    (order, customer) => new
    {
        OrderId = order.Id,
        CustomerName = customer.Name
    });

// Query syntax
var joined = from o in orders
             join c in customers on o.CustomerId equals c.Id
             select new { o.Id, c.Name };
```

### GroupJoin

Left outer join with grouping.

```csharp
var customerOrders = customers.GroupJoin(
    orders,
    c => c.Id,
    o => o.CustomerId,
    (customer, orderGroup) => new
    {
        Customer = customer.Name,
        OrderCount = orderGroup.Count(),
        TotalSpent = orderGroup.Sum(o => o.Total)
    });

// Query syntax
var customerOrders = from c in customers
                     join o in orders on c.Id equals o.CustomerId into orderGroup
                     select new { c.Name, Orders = orderGroup };
```

### Zip

Combine elements by position.

```csharp
var names = new[] { "Alice", "Bob", "Charlie" };
var ages = new[] { 25, 30, 35 };

var people = names.Zip(ages, (name, age) => new { name, age });
// { Alice, 25 }, { Bob, 30 }, { Charlie, 35 }

// Tuple result (C# 10 / .NET 6)
var pairs = names.Zip(ages);
// ("Alice", 25), ("Bob", 30), ("Charlie", 35)

// Three sequences (C# 10 / .NET 6)
var scores = new[] { 100, 95, 88 };
var combined = names.Zip(ages, scores);
// ("Alice", 25, 100), ...
```

## Aggregation

### Count, Sum, Average, Min, Max

```csharp
int count = numbers.Count();
int countFiltered = numbers.Count(n => n > 5);
long longCount = numbers.LongCount();

int sum = numbers.Sum();
decimal totalPrice = orders.Sum(o => o.Price);

double average = numbers.Average();
double avgAge = people.Average(p => p.Age);

int min = numbers.Min();
int maxAge = people.Max(p => p.Age);

// MinBy/MaxBy (C# 10 / .NET 6)
var youngest = people.MinBy(p => p.Age);
var oldest = people.MaxBy(p => p.Age);
```

### Aggregate

Custom aggregation.

```csharp
// Product of all numbers
int product = numbers.Aggregate((a, b) => a * b);

// With seed
int sumPlusTen = numbers.Aggregate(10, (acc, n) => acc + n);

// With result selector
string sentence = words.Aggregate(
    new StringBuilder(),
    (sb, word) => sb.Append(word).Append(" "),
    sb => sb.ToString().Trim());

// Running total
var runningTotal = numbers.Aggregate(
    new List<int>(),
    (list, n) =>
    {
        list.Add(list.LastOrDefault() + n);
        return list;
    });
```

## Element Operations

### First, FirstOrDefault

```csharp
var first = numbers.First();                    // Throws if empty
var firstEven = numbers.First(n => n % 2 == 0); // First matching

var firstOrNull = numbers.FirstOrDefault();     // 0 if empty
var firstOrDefault = numbers.FirstOrDefault(n => n > 100); // 0 if none

// With explicit default (C# 10 / .NET 6)
var firstOrMinus1 = numbers.FirstOrDefault(n => n > 100, -1);
```

### Last, LastOrDefault

```csharp
var last = numbers.Last();
var lastOrDefault = numbers.LastOrDefault();
```

### Single, SingleOrDefault

Returns exactly one element; throws if zero or multiple.

```csharp
var onlyAdmin = users.Single(u => u.Role == "SuperAdmin");
var maybeAdmin = users.SingleOrDefault(u => u.Role == "SuperAdmin");
```

### ElementAt, ElementAtOrDefault

Access by index.

```csharp
var third = numbers.ElementAt(2);        // Throws if out of range
var thirdOrDefault = numbers.ElementAtOrDefault(2);

// With Index (C# 10 / .NET 6)
var last = numbers.ElementAt(^1);
```

## Quantifiers

### Any, All, Contains

```csharp
bool hasAny = numbers.Any();
bool hasEven = numbers.Any(n => n % 2 == 0);

bool allPositive = numbers.All(n => n > 0);

bool containsFive = numbers.Contains(5);
bool containsPerson = people.Contains(person, new PersonComparer());
```

## Set Operations

```csharp
var set1 = new[] { 1, 2, 3, 4 };
var set2 = new[] { 3, 4, 5, 6 };

var union = set1.Union(set2);         // 1, 2, 3, 4, 5, 6
var intersect = set1.Intersect(set2); // 3, 4
var except = set1.Except(set2);       // 1, 2

// UnionBy, IntersectBy, ExceptBy (C# 10 / .NET 6)
var allPeopleByName = people1.UnionBy(people2, p => p.Name);
```

## Partitioning

### Take and Skip

```csharp
var firstFive = numbers.Take(5);
var skipFive = numbers.Skip(5);
var page = numbers.Skip(20).Take(10);  // Pagination

// TakeLast and SkipLast (C# 10 / .NET 6)
var lastThree = numbers.TakeLast(3);
var allButLastThree = numbers.SkipLast(3);

// Range-based (C# 10 / .NET 6)
var slice = numbers.Take(3..7);
var fromEnd = numbers.Take(^5..);
```

### TakeWhile and SkipWhile

```csharp
var ascending = new[] { 1, 2, 3, 5, 4, 2 };

var takeWhileAsc = ascending.TakeWhile(n => n < 5);  // 1, 2, 3
var skipWhileAsc = ascending.SkipWhile(n => n < 5);  // 5, 4, 2
```

### Chunk (C# 10 / .NET 6)

Split into fixed-size chunks.

```csharp
var numbers = Enumerable.Range(1, 10);
var chunks = numbers.Chunk(3);
// [1, 2, 3], [4, 5, 6], [7, 8, 9], [10]
```

## Generation

```csharp
// Range
var oneToTen = Enumerable.Range(1, 10);

// Repeat
var fiveZeros = Enumerable.Repeat(0, 5);

// Empty
var empty = Enumerable.Empty<int>();
```

## Conversion

```csharp
// To collections
var list = query.ToList();
var array = query.ToArray();
var hashSet = query.ToHashSet();

// To dictionary
var dict = people.ToDictionary(p => p.Id);
var dictWithValue = people.ToDictionary(p => p.Id, p => p.Name);

// To lookup (allows duplicate keys)
var lookup = people.ToLookup(p => p.Department);

// Cast and OfType
IEnumerable nonGeneric = GetItems();
var typed = nonGeneric.Cast<string>();     // Throws if wrong type
var filtered = nonGeneric.OfType<string>(); // Skips wrong types

// AsEnumerable (forces LINQ to Objects)
var result = dbContext.People
    .Where(p => p.Age > 18)        // Runs in database
    .AsEnumerable()
    .Where(p => ComplexLogic(p));  // Runs in memory
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
