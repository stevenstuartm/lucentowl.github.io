---
title: "C# Collections Overview"
layout: guide
category: ".NET & C#"
subcategory: "Collections & Data"
description: "The .NET collection types and how to choose between them: arrays and List<T>, Dictionary and HashSet and what their keys require, queues, stacks, and PriorityQueue, sorted and ordered collections, frozen and immutable collections for read-heavy data, collection interfaces for parameters and returns, and collection expressions."
tags: [collections, list, dictionary, hashset, frozen-collections, collection-expressions, practical]
---

## The Collection Types at a Glance

Each collection type is built around one access pattern, and choosing a collection is mostly a matter of naming that pattern. The costs below are the typical case. Hash-based lookups are O(1) on average and degrade when many keys share a hash code.

| Type | Built for | Key costs |
| --- | --- | --- |
| `T[]` | Fixed-size sequences | O(1) index; size fixed at creation |
| `List<T>` | Growable sequences, the general default | O(1) index, O(1) amortized add at end, O(n) insert/remove in the middle, O(n) search |
| `Dictionary<TKey, TValue>` | Lookup by key | O(1) get, add, remove |
| `HashSet<T>` | Membership and uniqueness | O(1) add, remove, contains |
| `Queue<T>` / `Stack<T>` | FIFO / LIFO processing | O(1) at the ends |
| `PriorityQueue<TElement, TPriority>` | Always taking the smallest-priority item next | O(log n) enqueue and dequeue |
| `SortedDictionary` / `SortedSet` | Data kept in key order | O(log n) operations |
| `OrderedDictionary<TKey, TValue>` | Key lookup that also keeps insertion order | O(1) get by key, O(n) removal and insertion at an index |
| `FrozenDictionary` / `FrozenSet` | Lookups on data built once and never changed | Fastest reads; expensive to create |
| `LinkedList<T>` | Splicing at nodes you already hold | O(1) insert/remove at a known node, O(n) everything else |

None of these types is safe for a writer running concurrently with other threads. The `System.Collections.Concurrent` types exist for that.

## Arrays

An array has a fixed length, set when it's created, and stores its elements contiguously.

```csharp
int[] numbers = new int[5];            // five zeros
int[] primes = [2, 3, 5, 7, 11];       // collection expression (C# 12)

int first = primes[0];
int last = primes[^1];                 // 11: index from the end

int[] middle = primes[1..4];           // { 3, 5, 7 }: a range over an array is a new array
```

A range over an array copies the elements, so changing `middle` doesn't change `primes`. To refer to part of an array without copying, take a span of it instead: `primes.AsSpan(1, 3)`.

```csharp
// Multi-dimensional: one rectangular block
int[,] matrix = new int[3, 3];
matrix[0, 0] = 1;

// Jagged: an array of separate arrays, each with its own length
int[][] jagged = new int[3][];
jagged[0] = [1, 2];
jagged[1] = [3, 4, 5, 6];
```

The `Array` class has static helpers for sorting, searching, and filling:

```csharp
Array.Sort(numbers);
Array.Fill(numbers, 0);
int index = Array.IndexOf(numbers, 5);
int[] evens = Array.FindAll(numbers, n => n % 2 == 0);
Array.Resize(ref numbers, 10);         // allocates a new array and copies into it
```

Prefer `List<T>` unless the size is fixed by the problem, as with a buffer or a lookup table. Arrays matter mostly at API boundaries that require them and in performance-sensitive code.

## List&lt;T&gt;

`List<T>` wraps an array and replaces it with a larger one when it fills up, doubling the capacity each time. That makes adding at the end cheap on average, and it makes inserting or removing anywhere else cost a shift of every later element.

```csharp
var list = new List<int> { 1, 2, 3 };
var sized = new List<int>(capacity: 10_000);   // avoids repeated regrowth when the size is known

list.Add(4);
list.AddRange([5, 6]);
list.Insert(0, 0);             // O(n): shifts every element

int last = list[^1];

list.Remove(3);                // first occurrence; O(n)
list.RemoveAt(0);
list.RemoveAll(n => n < 0);

bool contains = list.Contains(5);          // O(n) linear scan
int found = list.Find(n => n > 10);        // default(T), here 0, when nothing matches

list.Sort();
int position = list.BinarySearch(5);       // O(log n), only valid on a sorted list
```

Two things surprise people. `Find` returns `default(T)` when nothing matches, which for `List<int>` is indistinguishable from finding a 0, so use `FindIndex` or `Exists` when that matters. And a list can't be modified while it's being enumerated: adding or removing inside a `foreach` over it throws `InvalidOperationException`. Use `RemoveAll`, or iterate backward by index, to remove while scanning.

## Dictionary&lt;TKey, TValue&gt;

A hash table: each key's hash code picks a bucket, so a lookup inspects a handful of entries instead of all of them.

```csharp
var stock = new Dictionary<string, int>
{
    ["apples"] = 10,
    ["pears"] = 4
};

stock["plums"] = 7;                    // add or overwrite
stock.Add("figs", 2);                  // throws if the key exists
bool added = stock.TryAdd("figs", 9);  // false, leaves the existing value

int apples = stock["apples"];          // throws KeyNotFoundException if missing
if (stock.TryGetValue("kiwis", out int kiwis)) { /* found */ }
int orZero = stock.GetValueOrDefault("kiwis");       // 0
int orCustom = stock.GetValueOrDefault("kiwis", -1);

stock.Remove("pears");

foreach (var (item, count) in stock)
    Console.WriteLine($"{item}: {count}");
```

Enumeration order is unspecified. It often looks like insertion order, until a removal and a later add reuse a freed slot. Code that needs an order should use `OrderedDictionary<TKey, TValue>` or `SortedDictionary<TKey, TValue>`. Since .NET Core 3.0, `Remove` and `Clear` are allowed while enumerating a dictionary, but adding a key during enumeration still throws.

Counting occurrences is the most common dictionary idiom:

```csharp
var counts = new Dictionary<string, int>();
foreach (var word in words)
    counts[word] = counts.GetValueOrDefault(word) + 1;
```

### What a Key Must Provide

A dictionary finds a key by calling `GetHashCode` and then confirming the match with `Equals`. That places three requirements on a key type:

- **Equal keys must produce equal hash codes.** A type that overrides `Equals` without a matching `GetHashCode` stores equal keys in different buckets, so lookups miss.
- **A key's hash must not change while it's in the dictionary.** Mutating a field that feeds `GetHashCode` strands the entry in a bucket its new hash doesn't point to. It is still in the dictionary and can no longer be found. Use immutable keys: strings, numbers, records, or readonly structs.
- **The comparison must mean what you intend.** Strings compare ordinally and case-sensitively by default. Pass a comparer to change that:

```csharp
var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
headers["Content-Type"] = "application/json";
bool found = headers.ContainsKey("content-type");   // true
```

The same requirements apply to `HashSet<T>` elements.

## HashSet&lt;T&gt;

A set of unique values with O(1) membership tests. Adding an existing value does nothing and returns `false`, which makes it the natural "have I seen this?" check:

```csharp
var seen = new HashSet<int>();
foreach (var order in orders)
{
    if (seen.Add(order.Id))   // true only the first time
        Process(order);
}
```

The set operations modify the set they're called on:

```csharp
var a = new HashSet<int> { 1, 2, 3 };
var b = new HashSet<int> { 2, 3, 4 };

// Each result below starts from a fresh copy of a
new HashSet<int>(a).UnionWith(b);           // { 1, 2, 3, 4 }
new HashSet<int>(a).IntersectWith(b);       // { 2, 3 }
new HashSet<int>(a).ExceptWith(b);          // { 1 }
new HashSet<int>(a).SymmetricExceptWith(b); // { 1, 4 }

bool subset = a.IsSubsetOf(b);    // false
bool overlaps = a.Overlaps(b);    // true
```

Called in sequence on the same set, each operation works on the previous one's result. Copy first when you need the original.

## Queue, Stack, and PriorityQueue

`Queue<T>` hands items out in the order they arrived, and `Stack<T>` hands out the most recent first:

```csharp
var queue = new Queue<string>();
queue.Enqueue("first");
queue.Enqueue("second");
string next = queue.Dequeue();            // "first"

while (queue.TryDequeue(out var message))
    Process(message);

var undo = new Stack<EditAction>();
undo.Push(action);
if (undo.TryPop(out var last))
    last.Revert();
```

`PriorityQueue<TElement, TPriority>` (.NET 6) hands out the item with the **smallest** priority value next, whatever order items arrived in. It is a heap, so each enqueue and dequeue costs O(log n):

```csharp
var jobs = new PriorityQueue<string, int>();
jobs.Enqueue("rebuild index", 5);
jobs.Enqueue("page on-call", 1);
jobs.Enqueue("send digest", 3);

string urgent = jobs.Dequeue();   // "page on-call"
```

Items with equal priority come out in no guaranteed order, and enumerating the queue doesn't yield priority order. For largest-first, pass a comparer that reverses the priority comparison.

## Sorted and Ordered Collections

"Sorted" and "ordered" mean different things. A sorted collection keeps items in key order, whatever order they were added. An ordered collection keeps the order you added them in.

| Type | Keeps | Structure | Notes |
| --- | --- | --- | --- |
| `SortedDictionary<TKey, TValue>` | Key order | Balanced tree | O(log n) insert and remove anywhere |
| `SortedList<TKey, TValue>` | Key order | Two sorted arrays | Less memory and index access, but O(n) inserts; suits data loaded once then read |
| `SortedSet<T>` | Value order | Balanced tree | Supports range views with `GetViewBetween` |
| `OrderedDictionary<TKey, TValue>` | Insertion order | Hash table plus list | .NET 9; also supports access and insertion by index |

```csharp
var byName = new SortedDictionary<string, int> { ["pear"] = 2, ["apple"] = 1 };
// enumerates apple, pear

var scores = new SortedSet<int> { 50, 10, 30, 20, 40 };
var middle = scores.GetViewBetween(20, 40);   // 20, 30, 40

var steps = new OrderedDictionary<string, Step> { ["build"] = build, ["test"] = test };
steps.Insert(0, "restore", restore);           // restore, build, test
```

Before .NET 9, keeping both key lookup and insertion order meant maintaining a `Dictionary` and a `List` side by side. `OrderedDictionary<TKey, TValue>` replaces that.

## LinkedList&lt;T&gt;

`LinkedList<T>` is a doubly linked list. Inserting or removing is O(1) only when you already hold the `LinkedListNode<T>` at that position. Finding the position is O(n), and there is no indexer.

```csharp
var list = new LinkedList<int>();
LinkedListNode<int> one = list.AddFirst(1);
list.AddLast(3);
list.AddAfter(one, 2);        // 1 -> 2 -> 3, O(1) because we hold `one`

LinkedListNode<int>? node = list.Find(3);   // O(n)
```

In practice, `List<T>` usually beats it even for middle insertions of moderate size. Each linked-list node is a separate heap object, so traversal chases pointers across memory, while a list's elements are contiguous and a shift is a fast block copy. `LinkedList<T>` earns its place when code keeps node references and splices at them repeatedly, as in an LRU cache that moves a node to the front on every access.

## Frozen and Immutable Collections

A lookup table built at startup and only read afterward, such as configuration, a routing table, or a set of allowed values, can trade creation time for faster reads. `FrozenDictionary` and `FrozenSet` (.NET 8) analyze their contents when created and choose a lookup strategy tuned to those specific keys:

```csharp
private static readonly FrozenSet<string> AllowedExtensions =
    new[] { ".jpg", ".png", ".gif" }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

bool ok = AllowedExtensions.Contains(Path.GetExtension(fileName));
```

Creating a frozen collection is much slower than creating a `Dictionary`, so it pays off only when the collection is read many times over its life.

The immutable collections in `System.Collections.Immutable`, such as `ImmutableArray<T>`, `ImmutableList<T>`, and `ImmutableDictionary<TKey, TValue>`, solve a different problem. They can be "changed," but every change returns a new collection and leaves the original untouched. That makes them safe to share between threads and to hold as snapshots without copying. `ImmutableArray<T>` reads as fast as an array but copies on every change. The others share structure between versions, so a change is cheap but reads are slower than in the mutable types.

| Need | Type |
| --- | --- |
| Build once, read constantly | `FrozenDictionary`, `FrozenSet` |
| Share a snapshot that no one can modify, rarely changed | `ImmutableArray<T>` |
| A value that changes often while readers keep old versions | `ImmutableList<T>`, `ImmutableDictionary<TKey, TValue>` |
| Expose your own mutable collection as read-only | `list.AsReadOnly()`, or return it as `IReadOnlyList<T>` |

A read-only view is not immutable. The owner can still change the underlying list, and the view reflects the change.

## Collection Interfaces

The interfaces describe what a caller can do with a collection, and choosing the narrowest one that works keeps a method's contract honest:

| Interface | Adds |
| --- | --- |
| `IEnumerable<T>` | Iteration only; may be lazy and may be expensive to enumerate twice |
| `IReadOnlyCollection<T>` | `Count` |
| `IReadOnlyList<T>` | Indexer |
| `IReadOnlyDictionary<TKey, TValue>` / `IReadOnlySet<T>` | Lookup / membership, read-only |
| `ICollection<T>`, `IList<T>`, `IDictionary<TKey, TValue>`, `ISet<T>` | The mutating members |

**For parameters, accept the least you need.** A method that only loops over its input should take `IEnumerable<T>`. One that needs a count or an index should say so with `IReadOnlyCollection<T>` or `IReadOnlyList<T>`, rather than taking `IEnumerable<T>` and calling `.Count()` or `.ToList()` on it, which may enumerate a lazy query twice.

**For return values, promise what callers may rely on.** Returning `List<T>` tells callers they may modify the result. Returning `IReadOnlyList<T>` gives them count and indexing without that permission. Avoid returning `IEnumerable<T>` for data that is already materialized, since callers can't tell whether enumerating it again repeats expensive work.

## Collection Expressions (C# 12)

Collection expressions give one syntax for creating arrays, lists, spans, and most other collections, with the target type deciding what gets built:

```csharp
int[] numbers = [1, 2, 3];
List<string> names = ["Alice", "Bob"];
Span<int> span = [1, 2, 3];
ImmutableArray<int> fixedSet = [1, 2, 3];
IReadOnlyList<int> readOnly = [1, 2, 3];   // the compiler picks a read-only implementation
List<int> empty = [];

// Spread combines collections
int[] first = [1, 2, 3];
int[] second = [4, 5, 6];
int[] combined = [.. first, .. second, 7];   // [1, 2, 3, 4, 5, 6, 7]

// The target type flows into a conditional
int[] extras = includeExtras ? [8, 9] : [];

ProcessItems([1, 2, 3]);                      // target-typed from the parameter
```

A collection expression can target an array, `Span<T>` or `ReadOnlySpan<T>`, one of the generic collection interfaces such as `IEnumerable<T>` or `IReadOnlyList<T>`, a type marked with `[CollectionBuilder]` (which is how the immutable collections support them), or a type that implements `IEnumerable` and has an accessible `Add` method and parameterless constructor.

## Choosing the Right Collection

```
Look items up by a key?
├── Yes → Keys fixed after startup, read constantly? ─ Yes → FrozenDictionary
│         ├── Need key order? ──────────────────────── Yes → SortedDictionary (or SortedList if loaded once)
│         ├── Need insertion order or index access? ── Yes → OrderedDictionary
│         └── Otherwise ─────────────────────────────────── Dictionary
└── No → Only need to know whether a value is present, or keep values unique?
         ├── Yes → Sorted? ─ Yes → SortedSet ─ No → HashSet (FrozenSet if fixed)
         └── No → Take items in a set order?
                  ├── Arrival order ─────── Queue
                  ├── Most recent first ─── Stack
                  ├── By priority ───────── PriorityQueue
                  └── No → List<T> (an array if the size is fixed)
```

## Key Takeaways

**Name the access pattern first.** Lookup by key, membership, order of arrival, or order of priority each point to one collection.

**`List<T>` and `Dictionary<TKey, TValue>` are the defaults.** Reach for `LinkedList<T>` only when you hold nodes and splice at them repeatedly.

**Hash keys must be immutable and consistent.** Equal keys need equal hash codes, a key's hash must not change while stored, and string keys usually need an explicit comparer.

**Don't depend on `Dictionary` order.** Use `OrderedDictionary` for insertion order and `SortedDictionary` for key order.

**Use frozen collections for read-mostly lookups.** They cost more to build and less to read, which is the right trade for data fixed at startup.

**Accept the narrowest interface, return the most honest one.** `IEnumerable<T>` in, `IReadOnlyList<T>` out, unless callers genuinely need more.
