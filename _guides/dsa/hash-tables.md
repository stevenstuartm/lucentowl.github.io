---
title: "Hash Tables"
layout: guide
category: Data Structures & Algorithms
subcategory: Core Data Structures
description: "How a hash table turns a key into an array index for O(1) average lookups, how chaining and open addressing handle collisions, why the load factor and resizing keep it fast, what a correct GetHashCode needs, and how Dictionary<TKey,TValue> and HashSet<T> work in .NET."
tags: [hash-tables, hashing, dictionary, hashset, collisions, load-factor, fundamentals]
---
{% raw %}

## Why Hash Tables Exist

An array finds an element in O(1) when it knows the element's index. A hash table extends that to keys that aren't small integers, such as strings, IDs, or composite values. It runs the key through a hash function that produces an integer, reduces the integer to an index in an internal array, and stores the entry there. Looking the key up later repeats the same calculation and goes straight to the same slot, so a lookup costs the same on average whether the table holds ten entries or ten million.

The idea goes back to Hans Peter Luhn, who described hashing with chaining in an internal IBM memo in 1953. It now sits under most keyed lookups in software, including language dictionaries and sets, caches, database hash indexes, and compiler symbol tables.

---

## From Key to Slot

A lookup takes three steps:

1. **Hash the key.** A hash function turns the key into an integer, its hash code. In .NET, every object provides one through `GetHashCode()`.
2. **Reduce the hash code to an index.** The table maps the hash code onto its array, commonly with a remainder (`hash % capacity`) or, when the capacity is a power of two, by keeping the low bits.
3. **Compare keys.** Different keys can land in the same slot, so the table checks the stored key with `Equals` before trusting the match.

The third step is not optional. A hash code is an integer drawn from a limited range, while the set of possible keys, such as all strings, is effectively unlimited. So different keys must sometimes share a hash code, and more often they share a slot after the reduction step. Two keys landing in the same slot is called a collision. The pigeonhole principle guarantees collisions once there are more keys than slots, and in practice they appear long before that.

---

## Resolving Collisions

The two main families of hash table differ in where a colliding key goes.

{% endraw %}
{% include figure.html id="dsa-hash-collisions" %}
{% raw %}

**Separate chaining** gives every slot, called a bucket, a list of the entries that landed there, called a chain. A collision adds the entry to the chain, and a lookup scans only the chain for its slot. Chaining never runs out of room and degrades gradually as chains lengthen. Its cost is the extra references and, when chains are linked nodes, scattered memory.

**Open addressing** stores every entry directly in the array. When a key's slot is taken, the table probes other slots in a fixed sequence until it finds a free one. Linear probing tries the next slot, then the one after that. Quadratic probing and double hashing space the probes out further. Keeping everything in one array is cache-friendly, because neighboring slots are loaded from memory together, but open addressing has two complications:

- **Clustering.** With linear probing, occupied slots form runs, and any new key hashing into a run has to probe to its end, which makes the run longer still.
- **Deletion.** Emptying a slot would break the probe sequence of every key that probed past it, so those keys could no longer be found. Tables handle this in one of two ways. Some mark the deleted slot with a tombstone that lookups skip over and inserts can reuse. Others, with linear probing, empty the slot and then reinsert or shift back the keys that follow it in the run.

Production implementations use both families. Java's `HashMap` and .NET's `Dictionary<TKey,TValue>` use chaining, and since Java 8, `HashMap` converts a chain longer than 8 entries into a small balanced tree once the table has at least 64 slots. CPython's `dict` and many high-performance C++ and Rust tables use open addressing, often with refinements. Robin Hood hashing reorders entries to even out probe lengths. Google's SwissTable design, which Rust's standard `HashMap` has used since Rust 1.36, probes groups of slots at once using a small array of metadata bytes.

---

## Load Factor and Resizing

The load factor is the number of entries divided by the number of slots. It sets the average chain length under chaining, and the average probe length under open addressing, so it is what keeps operations O(1) or lets them drift toward O(n).

A hash table keeps the load factor bounded by resizing. When it crosses a threshold, the table allocates a larger array, usually around double the size, and rehashes every entry into it. Every entry has to move, because each new index depends on the new capacity. Like a dynamic array's growth, one resize is O(n), but doubling makes resizes rare enough that inserts stay O(1) amortized.

Open addressing needs the lower thresholds, because probe lengths climb steeply as the table fills. Linear probing tables commonly resize by the time they are half to two-thirds full. Chaining tolerates load factors near 1 and still works, more slowly, above it.

Resizing also means iteration order in many hash tables has no meaning. When iteration follows slot order, it depends on hash codes and capacity, and it can change completely after a resize. Some tables keep entries in a separate array and iterate that instead. CPython's `dict` does this and guarantees insertion order. .NET's `Dictionary<TKey,TValue>` does something similar, as its section below shows, but its order is still not something code should rely on.

---

## Operation Costs

| Operation | Average case | Worst case |
| --- | --- | --- |
| Look up, insert, or remove by key | O(1) | O(n) |
| Insert including resizes | O(1) amortized | O(n) for the insert that resizes |
| Iterate over all entries | O(n + capacity) | O(n + capacity) |
| Find the smallest key, or keys in a range | O(n) | O(n) |

The average case assumes the hash function spreads keys evenly and the load factor stays bounded. The worst case is every key in one slot, which turns each lookup into a linear scan. That can come from a poor hash function or, when an attacker controls the keys, from a deliberate hash flooding attack. In .NET, a string's hash code can differ from one run of a program to the next, so an attacker can't precompute a set of strings that all collide. `Dictionary<TKey,TValue>` adds a further defense for string keys, described in its section below.

The last row is the main thing a hash table cannot do. It keeps no order, so finding a minimum, a successor, or every key between two values means scanning everything. That is the job of a balanced search tree, such as `SortedDictionary<TKey,TValue>`.

---

## A Chaining Hash Table in C#

This implementation keeps one list per bucket and doubles once the load factor passes 1.

```csharp
public class ChainedHashMap<TKey, TValue> where TKey : notnull
{
    private List<KeyValuePair<TKey, TValue>>?[] _buckets = new List<KeyValuePair<TKey, TValue>>?[8];
    private readonly IEqualityComparer<TKey> _comparer = EqualityComparer<TKey>.Default;

    public int Count { get; private set; }

    private int IndexFor(TKey key, int capacity)
    {
        int hash = _comparer.GetHashCode(key) & 0x7FFFFFFF;  // Clear the sign bit so the index is never negative
        return hash % capacity;
    }

    public void Set(TKey key, TValue value)
    {
        var bucket = _buckets[IndexFor(key, _buckets.Length)] ??= new();

        for (int i = 0; i < bucket.Count; i++)
        {
            if (_comparer.Equals(bucket[i].Key, key))
            {
                bucket[i] = new(key, value);  // Existing key: replace the value
                return;
            }
        }

        bucket.Add(new(key, value));
        Count++;

        if (Count > _buckets.Length)  // Load factor above 1
            Resize();
    }

    public bool TryGetValue(TKey key, out TValue value)
    {
        var bucket = _buckets[IndexFor(key, _buckets.Length)];
        if (bucket != null)
        {
            foreach (var entry in bucket)
            {
                if (_comparer.Equals(entry.Key, key))
                {
                    value = entry.Value;
                    return true;
                }
            }
        }

        value = default!;
        return false;
    }

    public bool Remove(TKey key)
    {
        var bucket = _buckets[IndexFor(key, _buckets.Length)];
        if (bucket == null)
            return false;

        int removed = bucket.RemoveAll(entry => _comparer.Equals(entry.Key, key));
        Count -= removed;
        return removed > 0;
    }

    private void Resize()
    {
        var larger = new List<KeyValuePair<TKey, TValue>>?[_buckets.Length * 2];

        foreach (var bucket in _buckets)
        {
            if (bucket == null) continue;
            foreach (var entry in bucket)
                (larger[IndexFor(entry.Key, larger.Length)] ??= new()).Add(entry);  // Every entry gets a new index
        }

        _buckets = larger;
    }
}

var ages = new ChainedHashMap<string, int>();
ages.Set("alice", 34);
ages.Set("bob", 29);
ages.Set("alice", 35);  // Replaces the earlier value

Console.WriteLine(ages.TryGetValue("alice", out int age) ? age : -1);  // 35
Console.WriteLine(ages.TryGetValue("carol", out _));                   // False
Console.WriteLine(ages.Count);                                         // 2
```

`TryGetValue` returns a `bool` rather than a default value, because a missing key and a key stored with the default value (`0`, `null`) would otherwise look the same. .NET's `Dictionary<TKey,TValue>` follows the same pattern, and its indexer throws `KeyNotFoundException` for a missing key instead. The index calculation masks off the sign bit instead of calling `Math.Abs`, which throws for `int.MinValue`, a hash code that can legitimately occur.

---

## Writing a Correct GetHashCode

Every hash table in .NET relies on two methods of the key type, and they have to agree:

- **Equal keys must produce equal hash codes.** If `a.Equals(b)` is true, then `a.GetHashCode()` must equal `b.GetHashCode()`. Otherwise the two keys usually land in different slots and the table never compares them, so a lookup with an equal key fails to find the entry.
- **Unequal keys should usually produce different hash codes.** This is a performance goal, not a rule. A `GetHashCode` that returns the same constant for every key is technically legal, and it makes every operation O(n).

Types that override `Equals` must override `GetHashCode` to match. Records and anonymous types generate both from their fields, and `HashCode.Combine` builds a well-mixed hash from several fields for hand-written types:

```csharp
public sealed class GridPoint : IEquatable<GridPoint>
{
    public int X { get; }
    public int Y { get; }

    public GridPoint(int x, int y) => (X, Y) = (x, y);

    public bool Equals(GridPoint? other) => other is not null && X == other.X && Y == other.Y;
    public override bool Equals(object? obj) => Equals(obj as GridPoint);
    public override int GetHashCode() => HashCode.Combine(X, Y);
}

// A record struct gets Equals and GetHashCode generated from its properties
public readonly record struct GridCell(int X, int Y);
```

Overriding the key type's methods is one way to define equality. The other is to pass an `IEqualityComparer<T>` to the collection's constructor, which leaves the key type alone. `new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)` treats "Alice" and "ALICE" as the same key, and a custom comparer can do the same for a type the code doesn't own.

A key must also not change while it is in a hash table. If a mutable key's fields change after insertion, its hash code changes, so lookups go to a different slot from the one the entry sits in. The entry is still stored but can no longer be found. Keys should be immutable, or at least never modified while in use as keys.

---

## Dictionary&lt;TKey,TValue&gt; and HashSet&lt;T&gt; in .NET

`Dictionary<TKey,TValue>` uses separate chaining, but it stores the chains inside two arrays instead of in linked nodes. One array holds the entries, each with its key, value, cached hash code, and the index of the next entry in its chain. The other array maps each bucket to the first entry in its chain. Entries stay in one contiguous block, which avoids per-entry allocations and keeps memory access tighter than a linked chain would.

{% endraw %}
{% include figure.html id="dsa-dictionary-layout" %}
{% raw %}

Its sizing policy is visible in the `dotnet/runtime` source. Bucket counts are prime numbers. When the entries array is full, meaning the load factor has reached 1, the dictionary resizes to the next prime at least double its current count. For string keys compared with the default comparer, `StringComparer.Ordinal`, or `StringComparer.OrdinalIgnoreCase`, it starts with a hash that is not randomized, because that one is faster, and switches to randomized hashing if any chain grows past 100 collisions, a sign that someone may be forcing collisions.

Enumeration walks the entries array in index order, and a resize copies that array without reordering it. So a dictionary that has only ever had keys added enumerates them in insertion order. A removal frees its entry slot, and the next add reuses that slot, so the new key appears wherever the removed one was. Microsoft's documentation calls the order undefined, and code should treat it that way.

A few practical points follow from the design:

- **Pre-size when the count is known.** The `new Dictionary<TKey,TValue>(capacity)` constructor and `EnsureCapacity(n)` allocate once instead of resizing and rehashing along the way. `TrimExcess()` shrinks the arrays after a large removal.
- **Keys can't be null.** Adding or looking up a `null` key throws `ArgumentNullException`. Values can be `null`.

`HashSet<T>` is the same design without values. It answers "have I seen this" in O(1) on average, and adds set operations such as `UnionWith`, `IntersectWith`, and `ExceptWith`. `ConcurrentDictionary<TKey,TValue>` is the thread-safe version. `SortedDictionary<TKey,TValue>` has a similar API but is a balanced tree, trading O(1) average operations for O(log n) operations that keep the keys in order.

---

## What Hash Tables Solve

Most uses come down to replacing a repeated O(n) search with an O(1) lookup.

### Counting Frequencies

One pass over the input counts every distinct value, where comparing every element with every other would be O(n²):

```csharp
public static Dictionary<string, int> CountWords(IEnumerable<string> words)
{
    var counts = new Dictionary<string, int>();
    foreach (string word in words)
        counts[word] = counts.GetValueOrDefault(word) + 1;
    return counts;
}

var counts = CountWords("the cat saw the dog chase the cat".Split(' '));
Console.WriteLine(counts["the"]);  // 3
Console.WriteLine(counts["cat"]);  // 2
```

### Finding a Pair with a Given Sum

Checking every pair of numbers for one that sums to a target is O(n²). Remembering each number's index as the scan goes turns the search for its partner into a lookup, which makes the whole scan O(n) on average:

```csharp
public static (int, int)? TwoSum(int[] numbers, int target)
{
    var seen = new Dictionary<int, int>();  // Value → index where it appeared

    for (int i = 0; i < numbers.Length; i++)
    {
        if (seen.TryGetValue(target - numbers[i], out int j))
            return (j, i);

        seen[numbers[i]] = i;
    }

    return null;
}

Console.WriteLine(TwoSum(new[] { 2, 7, 11, 15 }, 9));  // (0, 1)
```

Unlike the two-pointer approach for this problem, which needs sorted input, the hash table version works on unsorted input and returns the original indices.

### Grouping, Deduplication, and Caching

The same move covers other common patterns. Grouping records by a key builds a dictionary from key to list. Removing duplicates adds each item to a `HashSet<T>` and keeps the ones `Add` accepts. Caching or memoizing a function stores each argument's result so a repeated call is a lookup instead of a recomputation.

---

## When Not to Use a Hash Table

- **Ordered data.** Sorted iteration, minimum and maximum, range queries, and "next larger key" need a sorted structure, such as a balanced search tree or a sorted array.
- **Small collections.** For a handful of items, a linear scan of an array can beat hashing, because computing a hash and comparing keys has a fixed overhead that a short scan doesn't pay.
- **Tight memory.** Empty slots, cached hash codes, and bucket arrays make a hash table larger than an array of the same entries.
- **Predictable worst-case latency.** An individual operation can hit a long chain or trigger a resize. Code with hard per-operation deadlines may need a structure with guaranteed bounds.

{% endraw %}
