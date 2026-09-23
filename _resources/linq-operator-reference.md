---
title: "LINQ Operator Reference"
layout: resource
type: cheatsheet
category: ".NET & C#"
description: "Every standard LINQ operator by job — filtering, projection, ordering, grouping, joining, aggregation, element access, quantifiers, set operations, partitioning, generation, and conversion — with its signature shape, what it returns, and whether it defers."
last_updated: 2026-09-23
tags: [linq, ienumerable, deferred-execution, query-operators, functional-programming]
related_guides:
  - /study-guides/dotnet/c-sharp/libraries/linq.html
  - /study-guides/dotnet/c-sharp/libraries/entity-framework-core.html
---

**Deferred** operators build a query and run it when enumerated. **Immediate** operators run on the spot and materialize a result. Getting this wrong is the source of most LINQ performance surprises, so it is the first column.

## Filtering

| Operator | Execution | What it does |
|---|---|---|
| `Where(predicate)` | Deferred | Keeps elements matching the predicate. An overload takes `(item, index)` |
| `OfType<T>()` | Deferred | Keeps only elements assignable to `T`, skipping the rest |
| `Distinct()` | Deferred | Removes duplicates using the default or a supplied `IEqualityComparer<T>` |
| `DistinctBy(keySelector)` | Deferred | Removes duplicates by a projected key (.NET 6) |

## Projection

| Operator | Execution | What it does |
|---|---|---|
| `Select(selector)` | Deferred | Transforms each element. An overload takes `(item, index)` |
| `SelectMany(selector)` | Deferred | Flattens a sequence of sequences into one. An overload adds a result selector receiving both the outer element and the inner one |

In query syntax, a second `from` clause compiles to `SelectMany`.

## Ordering

| Operator | Execution | What it does |
|---|---|---|
| `OrderBy(keySelector)` | Deferred | Ascending sort by key |
| `OrderByDescending(keySelector)` | Deferred | Descending sort by key |
| `ThenBy` / `ThenByDescending` | Deferred | Secondary and subsequent sort keys. Valid only on an already-ordered sequence |
| `Order()` / `OrderDescending()` | Deferred | Sorts by the elements themselves, no key selector (.NET 7) |
| `Reverse()` | Deferred | Reverses sequence order |

Sorting buffers the whole sequence, so an `OrderBy` in the middle of a pipeline is where a lazy query stops being lazy.

## Grouping

| Operator | Execution | What it does |
|---|---|---|
| `GroupBy(keySelector)` | Deferred | Produces `IGrouping<TKey, TElement>` items, each a key plus its members. Overloads add an element selector, a result selector, or both |
| `ToLookup(keySelector)` | **Immediate** | Like `GroupBy` but materialized and repeatedly indexable. A missing key returns an empty sequence rather than throwing or returning null |

## Joining

| Operator | Execution | What it does |
|---|---|---|
| `Join(inner, outerKey, innerKey, result)` | Deferred | Inner join on matching keys |
| `GroupJoin(inner, outerKey, innerKey, result)` | Deferred | Left outer join shape: each outer element paired with its group of matches, empty when there are none |
| `Zip(second)` | Deferred | Pairs elements by position, stopping at the shorter sequence. Returns tuples, or takes a result selector. A three-sequence overload exists (.NET 6) |

## Aggregation

| Operator | Execution | What it does |
|---|---|---|
| `Count()` / `LongCount()` | **Immediate** | Element count, optionally filtered by a predicate |
| `TryGetNonEnumeratedCount(out count)` | **Immediate** | Gets the count only when the source can supply it without enumerating (.NET 6) |
| `Sum()` / `Average()` | **Immediate** | Numeric total and mean, optionally over a projected value |
| `Min()` / `Max()` | **Immediate** | Smallest and largest value |
| `MinBy(keySelector)` / `MaxBy(keySelector)` | **Immediate** | The *element* with the smallest or largest key, rather than the key itself (.NET 6) |
| `Aggregate(func)` | **Immediate** | Folds the sequence with a custom accumulator. Overloads take a seed, and a seed plus a final result selector |

## Element Access

| Operator | Execution | Empty or no match |
|---|---|---|
| `First()` / `First(predicate)` | **Immediate** | Throws |
| `FirstOrDefault()` | **Immediate** | Returns `default(T)`; an overload takes an explicit fallback value (.NET 6) |
| `Last()` / `LastOrDefault()` | **Immediate** | Throws / returns default |
| `Single()` / `SingleOrDefault()` | **Immediate** | Throws on *zero or more than one* / returns default on zero, still throws on more than one |
| `ElementAt(index)` / `ElementAtOrDefault(index)` | **Immediate** | Throws / returns default. Both accept an `Index`, so `^1` is the last element (.NET 6) |

`Single` is an assertion that exactly one match exists. Reach for it when a second match means the data is wrong, and `First` when you just want one.

## Quantifiers

| Operator | Execution | What it does |
|---|---|---|
| `Any()` | **Immediate** | Whether the sequence has any element; with a predicate, whether any matches. Stops at the first hit |
| `All(predicate)` | **Immediate** | Whether every element matches. Vacuously true on an empty sequence |
| `Contains(value)` | **Immediate** | Whether a specific value is present, by default or supplied comparer |

## Set Operations

| Operator | Execution | What it does |
|---|---|---|
| `Union(second)` | Deferred | All distinct elements from both |
| `Intersect(second)` | Deferred | Distinct elements present in both |
| `Except(second)` | Deferred | Distinct elements in the first but not the second |
| `UnionBy` / `IntersectBy` / `ExceptBy` | Deferred | The same three, matched on a projected key (.NET 6) |

All four deduplicate, which is what makes them set operations rather than concatenation.

## Partitioning

| Operator | Execution | What it does |
|---|---|---|
| `Take(count)` / `Skip(count)` | Deferred | First *n* / everything after the first *n*. `Skip(20).Take(10)` is the pagination idiom |
| `TakeLast(count)` / `SkipLast(count)` | Deferred | The tail / everything but the tail (.NET 6) |
| `Take(range)` | Deferred | A range slice, including from-the-end forms such as `^5..` (.NET 6) |
| `TakeWhile(predicate)` / `SkipWhile(predicate)` | Deferred | Stops or starts at the first element that fails the predicate, not at every failure |
| `Chunk(size)` | Deferred | Splits into arrays of at most `size`; the final chunk may be short (.NET 6) |

## Generation

| Operator | Execution | What it does |
|---|---|---|
| `Enumerable.Range(start, count)` | Deferred | Consecutive integers |
| `Enumerable.Repeat(value, count)` | Deferred | One value, repeated |
| `Enumerable.Empty<T>()` | Deferred | A cached empty sequence, useful as a null-coalescing fallback |

## Conversion

| Operator | Execution | What it does |
|---|---|---|
| `ToList()` / `ToArray()` / `ToHashSet()` | **Immediate** | Materializes into that collection |
| `ToDictionary(keySelector)` | **Immediate** | Materializes into a dictionary. Throws on a duplicate key — use `ToLookup` when keys repeat |
| `ToLookup(keySelector)` | **Immediate** | Materializes into a multi-valued lookup |
| `Cast<T>()` | Deferred | Casts every element, throwing on the first that does not fit |
| `OfType<T>()` | Deferred | Skips elements that do not fit instead of throwing |
| `AsEnumerable()` | Deferred | Forces the rest of the chain to LINQ to Objects, so later operators run in memory rather than being translated by a provider |

## Query Syntax Equivalents

| Query syntax | Method |
|---|---|
| `from x in xs` | the source |
| `where` | `Where` |
| `select` | `Select` |
| `orderby` / `orderby … descending` | `OrderBy` / `OrderByDescending`, then `ThenBy` |
| a second `from` | `SelectMany` |
| `group x by key into g` | `GroupBy` |
| `join … on … equals …` | `Join` |
| `join … into g` | `GroupJoin` |
| `let` | a `Select` into an anonymous holder type |

Query syntax has no form for most operators, so any query using them has to end in method calls regardless.
