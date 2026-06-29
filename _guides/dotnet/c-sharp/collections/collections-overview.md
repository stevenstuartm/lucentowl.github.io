---
title: "C# Collections Overview"
layout: guide
category: ".NET & C#"
subcategory: "Collections & Data"
description: "Arrays, lists, dictionaries, sets, spans, and choosing the right collection for your use case."
tags: [c-sharp, dotnet, collections, data-structures, performance, practical]
---

## Collection Types Overview

C# provides a rich set of collection types for different scenarios.

| Type | Use Case | Characteristics |
|------|----------|-----------------|
| `T[]` | Fixed-size, fast access | Contiguous memory, fastest indexing |
| `List<T>` | Dynamic size, general purpose | Resizable array, O(1) index, O(n) insert |
| `Dictionary<K,V>` | Key-value lookup | O(1) lookup by key |
| `HashSet<T>` | Unique items, membership test | O(1) contains, no duplicates |
| `Queue<T>` | FIFO processing | Enqueue/Dequeue O(1) |
| `Stack<T>` | LIFO processing | Push/Pop O(1) |
| `LinkedList<T>` | Frequent insert/remove | O(1) insert at known position |
| `Span<T>` | Memory slice, no allocation | Stack-only, contiguous memory |

## Arrays

Fixed-size, contiguous memory allocation.

```csharp
// Declaration and initialization
int[] numbers = new int[5];              // 5 zeros
int[] primes = { 2, 3, 5, 7, 11 };       // Inline initialization
int[] squares = new int[] { 1, 4, 9 };   // Explicit new

// Access
int first = primes[0];     // 2
int last = primes[^1];     // 11 (index from end)
primes[0] = 1;             // Modify

// Slicing (creates new array)
int[] slice = primes[1..4]; // { 3, 5, 7 }

// Multi-dimensional
int[,] matrix = new int[3, 3];
matrix[0, 0] = 1;

int[,] identity = { { 1, 0 }, { 0, 1 } };

// Jagged arrays (array of arrays)
int[][] jagged = new int[3][];
jagged[0] = new int[] { 1, 2 };
jagged[1] = new int[] { 3, 4, 5, 6 };
```

### Array Methods

```csharp
// Static methods
Array.Sort(numbers);
Array.Reverse(numbers);
Array.Fill(numbers, 0);
Array.Clear(numbers, 0, numbers.Length);

int index = Array.IndexOf(numbers, 5);
bool exists = Array.Exists(numbers, n => n > 10);
int[] filtered = Array.FindAll(numbers, n => n % 2 == 0);

// Copy
int[] copy = new int[numbers.Length];
Array.Copy(numbers, copy, numbers.Length);

// Resize (creates new array)
Array.Resize(ref numbers, 10);
```

## List<T>

Dynamic array that grows automatically.

```csharp
// Creation
var list = new List<int>();
var list2 = new List<int> { 1, 2, 3 };
var list3 = new List<int>(capacity: 100);  // Pre-allocate

// Add elements
list.Add(1);
list.AddRange(new[] { 2, 3, 4 });
list.Insert(0, 0);         // Insert at index
list.InsertRange(2, new[] { 10, 20 });

// Access
int first = list[0];
int last = list[^1];
list[0] = 100;

// Remove
list.Remove(3);            // First occurrence
list.RemoveAt(0);          // By index
list.RemoveRange(0, 2);    // Range
list.RemoveAll(n => n < 0); // All matching
list.Clear();              // All

// Search
bool contains = list.Contains(5);
int index = list.IndexOf(5);
int lastIndex = list.LastIndexOf(5);
int found = list.Find(n => n > 10);
List<int> allMatching = list.FindAll(n => n > 10);
bool any = list.Exists(n => n > 10);
bool all = list.TrueForAll(n => n > 0);

// Sort and search
list.Sort();
list.Sort((a, b) => b.CompareTo(a));  // Descending
list.Reverse();
int binaryIndex = list.BinarySearch(5);  // Must be sorted

// Convert
int[] array = list.ToArray();
IReadOnlyList<int> readOnly = list.AsReadOnly();
```

### List Performance

| Operation | Time Complexity |
|-----------|-----------------|
| Index access | O(1) |
| Add (end) | O(1) amortized |
| Insert (middle) | O(n) |
| Remove (middle) | O(n) |
| Contains | O(n) |
| Sort | O(n log n) |

## Dictionary<TKey, TValue>

Hash-based key-value store with O(1) lookups.

```csharp
// Creation
var dict = new Dictionary<string, int>();
var dict2 = new Dictionary<string, int>
{
    { "one", 1 },
    { "two", 2 },
    ["three"] = 3  // Index initializer
};

// Add and update
dict["key"] = 100;              // Add or update
dict.Add("key2", 200);          // Add only, throws if exists
dict.TryAdd("key3", 300);       // Add only, returns false if exists

// Access
int value = dict["key"];        // Throws if missing
bool found = dict.TryGetValue("key", out int val);
int valueOrDefault = dict.GetValueOrDefault("key");
int valueOrCustom = dict.GetValueOrDefault("key", -1);

// Remove
dict.Remove("key");
dict.Remove("key", out int removed);

// Check existence
bool hasKey = dict.ContainsKey("key");
bool hasValue = dict.ContainsValue(100);

// Iteration
foreach (var kvp in dict)
{
    Console.WriteLine($"{kvp.Key}: {kvp.Value}");
}

foreach (var (key, value) in dict)
{
    Console.WriteLine($"{key}: {value}");
}

// Keys and Values
ICollection<string> keys = dict.Keys;
ICollection<int> values = dict.Values;
```

### Dictionary Best Practices

```csharp
// Get or add pattern
if (!dict.TryGetValue(key, out var value))
{
    value = ComputeExpensiveValue(key);
    dict[key] = value;
}

// Use TryAdd for conditional add
if (dict.TryAdd(key, value))
{
    Console.WriteLine("Added");
}

// Custom key equality
var caseInsensitive = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
caseInsensitive["Key"] = 1;
bool found = caseInsensitive.ContainsKey("KEY");  // true
```

## HashSet<T>

Unordered collection of unique elements with O(1) operations.

```csharp
// Creation
var set = new HashSet<int>();
var set2 = new HashSet<int> { 1, 2, 3, 3, 3 };  // { 1, 2, 3 }

// Add and remove
bool added = set.Add(5);       // true if new
set.Remove(5);
set.Clear();

// Check membership
bool contains = set.Contains(5);  // O(1)

// Set operations
var set1 = new HashSet<int> { 1, 2, 3 };
var set2 = new HashSet<int> { 2, 3, 4 };

set1.UnionWith(set2);          // { 1, 2, 3, 4 }
set1.IntersectWith(set2);      // { 2, 3 }
set1.ExceptWith(set2);         // { 1 }
set1.SymmetricExceptWith(set2); // { 1, 4 }

// Set comparison
bool isSubset = set1.IsSubsetOf(set2);
bool isSuperset = set1.IsSupersetOf(set2);
bool overlaps = set1.Overlaps(set2);
bool equals = set1.SetEquals(set2);

// Case-insensitive strings
var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
names.Add("Alice");
bool hasAlice = names.Contains("ALICE");  // true
```

## Queue<T> and Stack<T>

### Queue - FIFO (First In, First Out)

```csharp
var queue = new Queue<string>();

// Add to back
queue.Enqueue("first");
queue.Enqueue("second");
queue.Enqueue("third");

// Remove from front
string first = queue.Dequeue();  // "first"

// Peek without removing
string next = queue.Peek();      // "second"

// Check before dequeue
if (queue.TryDequeue(out string item))
{
    Process(item);
}

// Common pattern: message processing
while (queue.TryDequeue(out var message))
{
    ProcessMessage(message);
}
```

### Stack - LIFO (Last In, First Out)

```csharp
var stack = new Stack<int>();

// Add to top
stack.Push(1);
stack.Push(2);
stack.Push(3);

// Remove from top
int top = stack.Pop();   // 3

// Peek without removing
int peek = stack.Peek(); // 2

// Check before pop
if (stack.TryPop(out int value))
{
    Process(value);
}

// Common pattern: undo operations
public class UndoStack<T>
{
    private readonly Stack<T> history = new();

    public void Execute(T action)
    {
        history.Push(action);
    }

    public T? Undo()
    {
        return history.TryPop(out var action) ? action : default;
    }
}
```

## LinkedList<T>

Doubly-linked list for efficient insert/remove at known positions.

```csharp
var list = new LinkedList<int>();

// Add
list.AddLast(3);
list.AddFirst(1);
var node = list.AddAfter(list.First!, 2);  // 1 -> 2 -> 3

// Navigate
LinkedListNode<int>? current = list.First;
while (current != null)
{
    Console.WriteLine(current.Value);
    current = current.Next;
}

// Remove by node (O(1))
list.Remove(node);

// Remove by value (O(n) to find)
list.Remove(2);

// Find
var found = list.Find(3);        // First occurrence
var foundLast = list.FindLast(3); // Last occurrence
```

**Use LinkedList when**:
- Frequent insert/remove at known positions
- No random access needed
- Traversing in both directions

## SortedDictionary and SortedSet

Maintained in sorted order using red-black trees.

```csharp
var sorted = new SortedDictionary<string, int>
{
    { "banana", 2 },
    { "apple", 1 },
    { "cherry", 3 }
};

// Iteration is in key order
foreach (var kvp in sorted)
{
    // apple, banana, cherry
}

// SortedSet - sorted unique elements
var sortedSet = new SortedSet<int> { 5, 1, 3, 2, 4 };
// Iterates: 1, 2, 3, 4, 5

// Range views
var range = sortedSet.GetViewBetween(2, 4);  // 2, 3, 4
```

| Operation | Dictionary | SortedDictionary |
|-----------|------------|------------------|
| Lookup | O(1) | O(log n) |
| Insert | O(1) | O(log n) |
| Iteration | Unordered | Sorted |
| Memory | Hash table | Tree |

## Span<T> and Memory<T>

Stack-allocated views into contiguous memory without allocation.

### Span<T>

```csharp
// From array
int[] array = { 1, 2, 3, 4, 5 };
Span<int> span = array;
Span<int> slice = array.AsSpan(1, 3);  // { 2, 3, 4 }

// Modify through span (modifies original)
span[0] = 100;  // array[0] is now 100

// Stack allocation
Span<int> stackSpan = stackalloc int[10];

// From string (read-only)
ReadOnlySpan<char> chars = "hello".AsSpan();
ReadOnlySpan<char> sub = chars.Slice(1, 3);  // "ell"

// Methods
span.Fill(0);
span.Clear();
span.CopyTo(destination);
bool found = span.Contains(3);
int index = span.IndexOf(3);
```

### Memory<T>

Like Span but can be stored on heap (in async methods, fields).

```csharp
Memory<int> memory = new int[] { 1, 2, 3 };
Memory<int> slice = memory.Slice(1, 2);

// Convert to span when processing
void Process(Memory<int> memory)
{
    Span<int> span = memory.Span;
    foreach (ref var item in span)
    {
        item *= 2;
    }
}

// Async compatible
async Task ProcessAsync(Memory<int> memory)
{
    await Task.Delay(100);
    Process(memory);
}
```

### String Processing with Span

```csharp
// No allocation string parsing
public static bool TryParseCoordinate(
    ReadOnlySpan<char> input,
    out double lat, out double lon)
{
    lat = lon = 0;

    int comma = input.IndexOf(',');
    if (comma < 0) return false;

    return double.TryParse(input[..comma], out lat)
        && double.TryParse(input[(comma + 1)..], out lon);
}

// Usage
ReadOnlySpan<char> coord = "47.6062,-122.3321";
if (TryParseCoordinate(coord, out var lat, out var lon))
{
    Console.WriteLine($"Lat: {lat}, Lon: {lon}");
}
```

## Choosing the Right Collection

### Decision Guide

```
Need key-value lookup?
├── Yes → Dictionary<K,V>
│         └── Need sorted keys? → SortedDictionary<K,V>
└── No → Need unique items only?
         ├── Yes → HashSet<T>
         │         └── Need sorted? → SortedSet<T>
         └── No → Need FIFO/LIFO?
                  ├── FIFO → Queue<T>
                  ├── LIFO → Stack<T>
                  └── Neither → Need random access?
                               ├── Yes → Fixed size? → Array
                               │         └── Dynamic? → List<T>
                               └── No → LinkedList<T>
```

### Common Scenarios

```csharp
// Caching with expiration
var cache = new Dictionary<string, (DateTime Expiry, Data Value)>();

// Frequency counting
var counts = new Dictionary<string, int>();
foreach (var item in items)
{
    counts[item] = counts.GetValueOrDefault(item) + 1;
}

// Recent items (bounded)
var recent = new Queue<Item>();
void AddRecent(Item item)
{
    if (recent.Count >= 100)
        recent.Dequeue();
    recent.Enqueue(item);
}

// Unique processing
var processed = new HashSet<int>();
foreach (var item in items)
{
    if (processed.Add(item.Id))
    {
        Process(item);  // Only process once
    }
}

// Fast lookup + ordered iteration
var orderedDict = new Dictionary<string, int>();
var orderedKeys = new List<string>();
// Maintain both for O(1) lookup and ordered iteration
```

## Collection Interfaces

```csharp
// Read-only views
IEnumerable<T>      // Iteration only
IReadOnlyCollection<T>  // + Count
IReadOnlyList<T>    // + Index access
IReadOnlyDictionary<K,V>
IReadOnlySet<T>

// Prefer these for parameters
public void Process(IReadOnlyList<Item> items)
{
    foreach (var item in items)
    {
        // Can iterate and access by index
        // Cannot modify
    }
}

// Return concrete types for method returns
public List<Item> GetItems()
{
    return new List<Item>();  // Caller knows the type
}
```

## Collection Expressions (C# 12)

Unified syntax for creating any collection type.

```csharp
// Arrays
int[] numbers = [1, 2, 3, 4, 5];
string[] names = ["Alice", "Bob", "Charlie"];

// Lists
List<int> list = [1, 2, 3];
List<string> empty = [];

// Spans
Span<int> span = [1, 2, 3];
ReadOnlySpan<char> chars = ['a', 'b', 'c'];

// Immutable collections
ImmutableArray<int> immutable = [1, 2, 3];
ImmutableList<string> immutableList = ["a", "b"];

// Spread operator for combining
int[] first = [1, 2, 3];
int[] second = [4, 5, 6];
int[] combined = [..first, ..second];  // [1, 2, 3, 4, 5, 6]

// Conditional spread
int[] extras = condition ? [4, 5] : [];
int[] result = [1, 2, 3, ..extras];

// In method calls
ProcessItems([1, 2, 3, 4, 5]);
```

Collection expressions work with any type that:
- Is an array, `Span<T>`, or `ReadOnlySpan<T>`
- Has a `CollectionBuilder` attribute
- Has an `Add` method and is constructible

## Key Takeaways

**Match collection to access pattern**: Dictionary for key lookup, HashSet for membership, List for indexed access.

**Prefer List<T> over arrays**: Unless size is truly fixed, List<T>'s flexibility usually outweighs the tiny overhead.

**Use HashSet for membership tests**: O(1) Contains beats List's O(n).

**Use Span<T> for performance**: When parsing or processing contiguous data, Span avoids allocations.

**Return concrete types, accept interfaces**: Methods should accept `IEnumerable<T>` or `IReadOnlyList<T>` but can return `List<T>`.

**Pre-allocate when size is known**: `new List<T>(capacity)` avoids resizing during population.
