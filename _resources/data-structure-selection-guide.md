---
title: "Data Structure and Algorithm Selection Guide"
layout: resource
type: reference
category: "Data Structures & Algorithms"
description: "Which .NET collection or algorithm to reach for, by the need it serves: selection tables with costs and catches, decision trees for sorting, searching, and graphs, and when writing your own beats the built-in."
last_updated: 2026-09-23
tags: [decision-making, collections, dotnet, sorting, graphs, priority-queues, practical]
related_guides:
  - /study-guides/dsa/big-o-basics.html
  - /study-guides/dsa/recursion.html
  - /study-guides/dsa/arrays-lists.html
  - /study-guides/dsa/linked-lists.html
  - /study-guides/dsa/stacks-queues.html
  - /study-guides/dsa/hash-tables.html
  - /study-guides/dsa/trees.html
  - /study-guides/dsa/heaps.html
  - /study-guides/dsa/trees-advanced.html
  - /study-guides/dsa/graphs.html
  - /study-guides/dsa/graphs-advanced.html
  - /study-guides/dsa/search-algorithms.html
  - /study-guides/dsa/sorting-algorithms.html
  - /study-guides/dsa/algorithm-design.html
---

## Choosing a Data Structure

Costs name their case. "Amortized" means an occasional resize is spread across the operations that filled the space.

| Need | .NET type | Structure underneath | Cost | Watch out for |
| --- | --- | --- | --- | --- |
| Look up a value by key | `Dictionary<TKey,TValue>` | Hash table, separate chaining | O(1) average, O(n) worst case | No defined enumeration order |
| Look up by key and keep insertion order | `OrderedDictionary<TKey,TValue>` (.NET 9+) | Hash table plus an ordered entry array | O(1) average lookup and append, O(n) remove | Removing shifts later entries |
| Test membership, remove duplicates | `HashSet<T>` | Hash table | O(1) average `Add` and `Contains` | `List<T>.Contains` is O(n) per call |
| Keep keys sorted while inserting and removing | `SortedDictionary<TKey,TValue>`, `SortedSet<T>` | Red-black tree | O(log n) insert, lookup, remove | Only `SortedSet<T>` has range queries (`GetViewBetween`, `Min`, `Max`); `SortedDictionary` has no floor, ceiling, or range lookup |
| Sorted keys, built once, read often | `SortedList<TKey,TValue>`, or a sorted array with `Array.BinarySearch` | Sorted arrays | O(log n) lookup, O(n) insert | Frequent inserts shift elements every time |
| Index into a growable sequence | `List<T>` | Dynamic array | O(1) index, O(1) amortized append | Inserting or removing near the front is O(n) |
| First in, first out | `Queue<T>` | Circular buffer | O(1) dequeue, O(1) amortized enqueue | `List<T>.RemoveAt(0)` shifts every element |
| Last in, first out, such as undo | `Stack<T>` | Dynamic array | O(1) amortized push, O(1) pop | Never shrinks on its own; call `TrimExcess` after a spike |
| Add and remove at both ends | `LinkedList<T>`, or your own circular buffer | Doubly linked list | O(1) at either end | No public deque type exists |
| Take the smallest item next | `PriorityQueue<TElement,TPriority>` (.NET 6+) | Array-backed 4-ary min-heap | O(log n) enqueue and dequeue, O(1) peek | No FIFO order among equal priorities, no decrease-key |
| Size-limited cache | `MemoryCache` (`Microsoft.Extensions.Caching.Memory`) with `SizeLimit` | Hash table with background compaction | O(1) average get and set | Every entry must set `Size` or `Set` throws. An entry that would exceed the limit is rejected, not cached, and compaction then runs in the background. It evicts expired entries, then low priority, then least recently used, so it is not a strict LRU, and `NeverRemove` entries stay |
| Strict least-recently-used eviction | `Dictionary` plus `LinkedList<T>` | Hash table indexing list nodes | O(1) get and put | No built-in generic LRU collection |
| Lookups against data fixed at startup | `FrozenDictionary<TKey,TValue>`, `FrozenSet<T>` (.NET 8+) | An implementation picked from the keys at creation | O(1) average lookup | Slower to create, and read-only |
| Several threads reading and writing | `ConcurrentDictionary`, `ConcurrentQueue`, or `Channel<T>` for producer and consumer | Hash table with striped locks; linked array segments; a queue, bounded or unbounded | O(1) average or amortized per operation | None of the `System.Collections.Generic` types above are safe for concurrent writes |

## Choosing an Algorithm

| Problem | Use | Cost | Instead of |
| --- | --- | --- | --- |
| Sort, equal keys may reorder | `Array.Sort`, `List<T>.Sort` (introsort) | O(n log n) worst case, in place | Writing your own sort |
| Sort, equal keys keep input order | `Enumerable.OrderBy` then `ThenBy` (stable) | O(n log n), allocates a new sequence | `Array.Sort`, which is unstable |
| The smallest or largest item | `Min`, `Max` | O(n) | Sorting to take the first item |
| The k smallest of n items | `OrderBy(...).Take(k)`, which runs a partial quicksort, or a max-heap holding k items | O(n + k log k) average and O(n²) worst case, or O(n log k) for the heap | A full sort, O(n log n) |
| The k-th smallest, once | `OrderBy(...).ElementAt(k - 1)`, which runs quickselect (the index is zero-based) | O(n) average, O(n²) worst case | A full sort |
| Search unsorted data once | `Contains`, `IndexOf`, `Find` | O(n) | Sorting first, O(n log n) |
| Search unsorted data many times | Build a `HashSet` or `Dictionary` once | O(n) to build, then O(1) average | Repeated linear scans |
| Search sorted data | `Array.BinarySearch`, `List<T>.BinarySearch` | O(log n) | A linear scan |
| Shortest path, unweighted edges | BFS | O(V + E) | DFS, which finds a path, not the shortest |
| Shortest path, non-negative weights | Dijkstra with a binary heap | O((V + E) log V) | BFS, which ignores weights |
| Shortest path to one target, with a distance estimate | A* with a consistent heuristic | O((V + E) log V) at worst, often far less | Dijkstra, which searches in every direction |
| Shortest path in a directed acyclic graph | Relax edges in topological order | O(V + E), negative weights allowed | Bellman-Ford |
| Shortest path, some negative weights, directed graph | Bellman-Ford, which also detects negative cycles | O(V × E) | Dijkstra, which gives wrong answers |
| Shortest paths between every pair, small graph | Floyd-Warshall | O(V³) time, O(V²) space | Dijkstra from every vertex, on dense graphs |
| Order tasks by their dependencies | Topological sort (Kahn) | O(V + E) | |
| Connect every vertex at the least total weight | Kruskal or Prim | O(E log E) or O(E log V) | |
| Are two items in the same group, as groups merge | Union-find with rank and path compression | O(α(n)) amortized, effectively constant | Re-running BFS after every merge |

`Array.BinarySearch` returns a negative number when the value is missing. Its bitwise complement, `~result`, is the index where the value would be inserted. With duplicates, it returns any one match, not necessarily the first.

`PriorityQueue` is a min-heap, so keeping the k smallest in a bounded heap needs a reversed `IComparer<TPriority>`, which puts the largest of the k on top to be evicted. With no decrease-key, Dijkstra on `PriorityQueue` enqueues a vertex again when its distance improves and skips the stale copies as they come out, which keeps O((V + E) log V).

## Decision Trees

### Sorting

```
Do you need only the k smallest, or the k-th smallest?
├─ Yes → OrderBy(...).Take(k) or ElementAt(k - 1): partial sort or quickselect
└─ No → Must items with equal keys keep their input order?
   ├─ Yes → Enumerable.OrderBy / ThenBy: stable, O(n log n), new sequence
   └─ No → Array.Sort / List<T>.Sort: introsort, in place, O(n log n) worst case
```

### Searching

```
Is the data sorted?
├─ Yes → Binary search, O(log n)
└─ No → Will you search the same data many times?
   ├─ Yes → Build a HashSet or Dictionary, O(n) once, then O(1) average
   └─ No → Linear scan, O(n)
```

### Graphs

```
Do you need a shortest path?
├─ Yes → Between every pair of vertices?
│  ├─ Yes, small graph → Floyd-Warshall, O(V³), negative weights only if directed
│  └─ No, from one source → Is the graph directed and acyclic?
│     ├─ Yes → Relax in topological order, O(V + E), any weights
│     └─ No → What are the edge weights?
│        ├─ None, or all equal → BFS, O(V + E)
│        ├─ Non-negative → Dijkstra, O((V + E) log V), or A* for one target
│        └─ Some negative, directed → Bellman-Ford, O(V × E)
└─ No → What do you need?
   ├─ Any path, or reachability → DFS or BFS, O(V + E)
   ├─ An order that respects dependencies → Topological sort, O(V + E)
   ├─ Which items are connected, as edges arrive → Union-find, O(α(n)) amortized
   └─ The cheapest set of edges connecting everything → Kruskal or Prim
```

Both DFS and BFS keep a visited set of size V. A recursive DFS also keeps one call per level of depth, and a deep graph such as a long chain can overflow the thread stack. .NET can't catch `StackOverflowException`, so for deep graphs use an explicit `Stack<T>`. To match the recursive visit order, push neighbors in reverse and mark a vertex visited when you pop it, not when you push it. That lets a vertex sit on the stack more than once, up to O(E) entries.

In an undirected graph, one negative edge is already a negative cycle, since it can be crossed back and forth. Bellman-Ford and Floyd-Warshall only handle negative weights on directed graphs.

## Built-In or Your Own

| Situation | Choice | Why |
| --- | --- | --- |
| Sorting, searching, lists, maps, sets, queues, stacks | Built-in | Introsort's heapsort fallback guarantees O(n log n), and the built-ins already handle the edge cases a hand-written version tends to miss |
| A balanced search tree | `SortedDictionary`, `SortedSet` | Both are already red-black trees |
| Substring search | `string.IndexOf` with `StringComparison.Ordinal`, or `Contains` | `IndexOf(string)` is culture-sensitive by default, while `Contains(string)` is already ordinal. `SearchValues` (.NET 9+) finds any of many substrings at once, with ordinal comparisons only. Use `Regex` only for a pattern |
| A structure the base library lacks: deque, trie, segment tree, union-find, interval tree | Your own | None has a public type in `System.Collections.Generic` |
| Graph algorithms beyond traversal and Dijkstra, which are short to write | A library, or your own | QuikGraph's latest release is 2.5.0 from 2022, so check it supports your target framework |
| A built-in that profiling shows is the bottleneck | Your own, specialized to the data | Measure first, since the replacement has to beat an already tuned implementation |

## Rules of Thumb

| Default | Leave it when |
| --- | --- |
| A hash table for keyed lookup | You need sorted order, range queries, or a worst-case bound on every operation |
| An array or `List<T>` for sequences | You hold references to nodes and splice or remove in the middle, as an LRU cache does |
| A sorted tree for data that must stay ordered | The data is fixed after loading. Sort it once and binary search it |
| BFS and DFS before anything fancier | The problem has weights, dependencies, or a cost to minimize |
