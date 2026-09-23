---
title: "LINQ Operator Reference"
layout: resource
type: cheatsheet
category: ".NET & C#"
description: "The standard LINQ operators through .NET 10, grouped by job (filtering, projection, ordering, grouping, joining, combining, aggregation, element access, quantifiers, set operations, partitioning, generation, and conversion), with what each returns, whether it defers, and which .NET version added it."
last_updated: 2026-09-23
tags: [linq, ienumerable, deferred-execution, query-operators, functional-programming]
related_guides:
  - /study-guides/dotnet/c-sharp/libraries/linq.html
  - /study-guides/dotnet/c-sharp/libraries/entity-framework-core.html
---

**Deferred** operators build a query and run it when enumerated. **Immediate** operators run on the spot and return a value or a materialized collection. Confusing the two causes queries that run later than expected, or more than once, so it gets the column right after the operator. Version labels mark operators added in .NET 6 or later; unlabeled ones predate that.

## Filtering

| Operator | Execution | What it does |
|---|---|---|
| `Where(predicate)` | Deferred | Keeps elements matching the predicate. An overload takes `(item, index)` |
| `OfType<T>()` | Deferred | Keeps only elements that are a `T`, skipping the rest, including nulls |
| `Distinct()` | Deferred | Removes duplicates using the default or a supplied `IEqualityComparer<T>` |
| `DistinctBy(keySelector)` | Deferred | Removes duplicates by a projected key (.NET 6) |

## Projection

| Operator | Execution | What it does |
|---|---|---|
| `Select(selector)` | Deferred | Transforms each element. An overload takes `(item, index)` |
| `SelectMany(selector)` | Deferred | Flattens a sequence of sequences into one. An overload adds a result selector receiving both the outer element and the inner one |
| `Index()` | Deferred | Pairs each element with its position as `(Index, Item)` tuples, so `foreach (var (i, x) in xs.Index())` works (.NET 9) |

In query syntax, a second `from` clause compiles to `SelectMany`.

## Ordering

| Operator | Execution | What it does |
|---|---|---|
| `OrderBy(keySelector)` | Deferred | Ascending sort by key |
| `OrderByDescending(keySelector)` | Deferred | Descending sort by key |
| `ThenBy` / `ThenByDescending` | Deferred | Secondary and subsequent sort keys. Valid only on an already-ordered sequence |
| `Order()` / `OrderDescending()` | Deferred | Sorts by the elements themselves, with no key selector (.NET 7) |
| `Reverse()` | Deferred | Reverses sequence order |
| `Shuffle()` | Deferred | Returns the elements in random order (.NET 10) |

Sorting, `Reverse`, `Shuffle`, and `GroupBy` read the whole source before they yield the first element. An `OrderBy` in the middle of a pipeline is still deferred, but it stops the pipeline from streaming.

## Grouping

| Operator | Execution | What it does |
|---|---|---|
| `GroupBy(keySelector)` | Deferred | Produces `IGrouping<TKey, TElement>` items, each a key plus its members. Overloads add an element selector, a result selector, or both |
| `CountBy(keySelector)` | Deferred | Key and count pairs as `KeyValuePair<TKey, int>`, without building the groups (.NET 9) |
| `AggregateBy(keySelector, seed, func)` | Deferred | Folds each key's elements into one accumulated value, returned as key-value pairs (.NET 9) |
| `ToLookup(keySelector)` | **Immediate** | Like `GroupBy` but materialized and repeatedly indexable. A missing key returns an empty sequence rather than throwing or returning null |

## Joining

| Operator | Execution | What it does |
|---|---|---|
| `Join(inner, outerKey, innerKey, result)` | Deferred | Inner join on matching keys |
| `GroupJoin(inner, outerKey, innerKey, result)` | Deferred | Each outer element paired with its group of matches, empty when there are none. Before .NET 10, `GroupJoin` plus `SelectMany` and `DefaultIfEmpty` was the left outer join idiom |
| `LeftJoin` / `RightJoin` | Deferred | Outer joins with the same parameters as `Join`. The unmatched side arrives as `default` (.NET 10) |
| `Zip(second)` | Deferred | Pairs elements by position, stopping at the shorter sequence. Returns tuples, or takes a result selector. A three-sequence overload exists (.NET 6) |

## Combining

| Operator | Execution | What it does |
|---|---|---|
| `Concat(second)` | Deferred | One sequence followed by another, keeping duplicates |
| `Append(item)` / `Prepend(item)` | Deferred | Adds one element at the end or the start |
| `DefaultIfEmpty()` | Deferred | Yields a single `default(T)`, or a supplied value, when the source is empty. Otherwise it yields the source unchanged |

## Aggregation

| Operator | Execution | What it does |
|---|---|---|
| `Count()` / `LongCount()` | **Immediate** | Element count, optionally filtered by a predicate. Without a predicate, `Count()` on an `ICollection<T>` reads the count instead of enumerating |
| `TryGetNonEnumeratedCount(out count)` | **Immediate** | Gets the count only when the source can supply it without enumerating (.NET 6) |
| `Sum()` / `Average()` | **Immediate** | Numeric total and mean, optionally over a projected value. `Sum` over integers is checked and throws `OverflowException`. `Average` of an empty non-nullable sequence throws |
| `Min()` / `Max()` | **Immediate** | Smallest and largest value. An empty sequence throws for a non-nullable value type and returns `null` for a reference or nullable type |
| `MinBy(keySelector)` / `MaxBy(keySelector)` | **Immediate** | The *element* with the smallest or largest key, rather than the key itself (.NET 6) |
| `Aggregate(func)` | **Immediate** | Folds the sequence with a custom accumulator. Overloads take a seed, and a seed plus a final result selector |

## Element Access

| Operator | Execution | Empty or no match |
|---|---|---|
| `First()` / `First(predicate)` | **Immediate** | Throws |
| `FirstOrDefault()` | **Immediate** | Returns `default(T)`. An overload takes an explicit fallback value (.NET 6) |
| `Last()` / `LastOrDefault()` | **Immediate** | Throws / returns default, or a supplied fallback (.NET 6) |
| `Single()` / `SingleOrDefault()` | **Immediate** | Throws on *zero or more than one* / returns default or a supplied fallback (.NET 6) on zero, and still throws on more than one |
| `ElementAt(index)` / `ElementAtOrDefault(index)` | **Immediate** | Throws / returns default. Both accept an `Index`, so `^1` is the last element (.NET 6) |

`Single` is an assertion that exactly one match exists. Reach for it when a second match means the data is wrong, and `First` when you just want one.

## Quantifiers

| Operator | Execution | What it does |
|---|---|---|
| `Any()` | **Immediate** | Whether the sequence has any element, or with a predicate, whether any matches. Stops at the first hit |
| `All(predicate)` | **Immediate** | Whether every element matches. Vacuously true on an empty sequence |
| `Contains(value)` | **Immediate** | Whether a specific value is present, by the default or a supplied comparer |
| `SequenceEqual(second)` | **Immediate** | Whether both sequences have equal elements in the same order |

## Set Operations

| Operator | Execution | What it does |
|---|---|---|
| `Union(second)` | Deferred | All distinct elements from both |
| `Intersect(second)` | Deferred | Distinct elements present in both |
| `Except(second)` | Deferred | Distinct elements in the first but not the second |
| `UnionBy` / `IntersectBy` / `ExceptBy` | Deferred | The same three, matched on a projected key (.NET 6) |

Every set operation deduplicates, which is what separates `Union` from `Concat`.

## Partitioning

| Operator | Execution | What it does |
|---|---|---|
| `Take(count)` / `Skip(count)` | Deferred | First *n* / everything after the first *n*. `Skip(20).Take(10)` is the pagination idiom |
| `TakeLast(count)` / `SkipLast(count)` | Deferred | The tail / everything but the tail. Available since .NET Core 2.0, but not in .NET Standard 2.0 |
| `Take(range)` | Deferred | A range slice, including from-the-end forms such as `^5..` (.NET 6) |
| `TakeWhile(predicate)` / `SkipWhile(predicate)` | Deferred | Stops or starts at the first element that fails the predicate, not at every failure |
| `Chunk(size)` | Deferred | Splits into arrays of at most `size`. The final chunk may be short (.NET 6) |

## Generation

| Operator | Execution | What it does |
|---|---|---|
| `Enumerable.Range(start, count)` | Deferred | `count` consecutive integers from `start` |
| `Enumerable.Sequence(start, endInclusive, step)` | Deferred | A stepped numeric sequence, so `Sequence(0, 10, 2)` is 0, 2, 4, 6, 8, 10 (.NET 10) |
| `Enumerable.InfiniteSequence(start, step)` | Deferred | An unbounded stepped sequence, to be cut off with `Take` or `TakeWhile` (.NET 10) |
| `Enumerable.Repeat(value, count)` | Deferred | One value, repeated |
| `Enumerable.Empty<T>()` | **Immediate** | A cached empty sequence, useful as a null-coalescing fallback |

## Conversion

| Operator | Execution | What it does |
|---|---|---|
| `ToList()` / `ToArray()` / `ToHashSet()` | **Immediate** | Materializes into that collection |
| `ToDictionary(keySelector)` | **Immediate** | Materializes into a dictionary and throws on a duplicate key, so use `ToLookup` when keys repeat. A parameterless overload converts a sequence of `KeyValuePair` or key-value tuples (.NET 8) |
| `ToLookup(keySelector)` | **Immediate** | Materializes into a multi-valued lookup |
| `Cast<T>()` | Deferred | Casts every element, throwing on the first that does not fit |
| `OfType<T>()` | Deferred | Skips elements that do not fit instead of throwing |
| `AsEnumerable()` | Deferred | Forces the rest of the chain to LINQ to Objects, so later operators run in memory rather than being translated by a provider |

## Query Syntax Equivalents

| Query syntax | Method |
|---|---|
| `from x in xs` | the source |
| `from int x in xs` (typed range variable) | `Cast<int>` |
| `where` | `Where` |
| `select` | `Select` |
| `orderby a, b` / `orderby a descending, b descending` | `OrderBy` then `ThenBy` / `OrderByDescending` then `ThenByDescending` |
| a second `from` | `SelectMany` |
| `group x by key` | `GroupBy` |
| `join … on … equals …` | `Join` |
| `join … into g` | `GroupJoin` |
| `let` | a `Select` into an anonymous holder type |

Query syntax has no form for most operators, so a query that needs them mixes in method calls.
