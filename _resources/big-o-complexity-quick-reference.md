---
title: "Big-O Complexity Quick Reference"
layout: resource
type: reference
category: "Data Structures & Algorithms"
description: "Growth rates and practical input limits, then the time and space cost of common data structures, sorting, searching, and graph algorithms, and .NET collection, string, and LINQ operations, with worst case as the default and other cases labeled."
last_updated: 2026-09-23
tags: [complexity-analysis, performance, sorting, graphs, dotnet, practical]
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

<div class="callout callout--tip" markdown="1">
<p class="callout__title">Complexity hierarchy</p>

O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)

</div>

A cost with no case named is the worst case. "Average" is the expected cost over a stated input distribution, such as random input or a hash that spreads keys evenly. "Expected" averages over an algorithm's own random choices, so it holds for every input. "Amortized" bounds the total cost of a worst-case sequence of operations, divided by their number, so it is a guarantee with no probability involved.

## Growth Rates and Practical Limits

The limits assume a budget of about one second at roughly 10⁸ simple operations per second. Constant factors and memory access can move them by an order of magnitude either way, so read them as scale, not thresholds.

| Growth | Name | Largest n in about a second | Examples |
| --- | --- | --- | --- |
| O(1) | Constant | Any | Array index, hash lookup on average |
| O(log n) | Logarithmic | Any that fits in memory | Binary search, balanced tree lookup |
| O(n) | Linear | 10⁸ | One pass over the input |
| O(n log n) | Linearithmic | 10⁶ to 10⁷ | Merge sort, heap sort, introsort |
| O(n²) | Quadratic | 10⁴ | Comparing every pair, insertion sort |
| O(n³) | Cubic | 500 | Floyd-Warshall, naive matrix multiplication |
| O(2ⁿ) | Exponential | 25 | Every subset |
| O(n!) | Factorial | 11 | Every ordering, brute-force traveling salesman |

## Data Structures

n is the number of elements, and m is the length of a string key.

| Structure | Access by index | Search by value | Insert | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Array | O(1) | O(n) | O(n) | O(n) | Fixed size. Insert and delete shift later elements |
| Dynamic array | O(1) | O(n) | O(1) amortized at the end, O(n) elsewhere | O(1) at the end, O(n) elsewhere | Growth copies every element, spread across appends |
| Sorted array | O(1) | O(log n) | O(n) | O(n) | Binary search finds the slot, shifting fills it |
| Singly linked list | O(n) | O(n) | O(1) at the head, or after a known node | O(1) at the head, O(n) otherwise | Deleting a node needs its predecessor |
| Doubly linked list | O(n) | O(n) | O(1) at either end, or beside a known node | O(1) given the node | Finding the node by value is O(n) |
| Stack | Top only, O(1) | O(n) | O(1) push, amortized if array-backed | O(1) pop | |
| Queue | Front only, O(1) | O(n) | O(1) enqueue, amortized if array-backed | O(1) dequeue | A circular buffer avoids shifting |
| Hash table | None | O(1) average, O(n) worst case | O(1) average, O(n) worst case or on resize | O(1) average, O(n) worst case | No order. Worst case needs many keys in one bucket |
| Binary search tree, unbalanced | None | O(log n) average for random inserts, O(n) worst case | Same as search | Same as search | Sorted input builds a chain |
| Balanced tree (AVL, red-black) | None | O(log n) worst case | O(log n) worst case | O(log n) worst case | Keeps keys ordered, with min, max, and range queries |
| Binary heap | Min or max only, O(1) | O(n) | O(log n), amortized if the array grows | O(log n) to remove the top | Build from n items in O(n) |
| Trie | None | O(m) | O(m) | O(m) | Independent of how many strings are stored. Worst case with an array of children per node. With a hash table of children per node, each step is O(1) average, so the bounds are average |

Every structure above uses O(n) space, except the trie. A trie uses one node per distinct prefix, at most the total length of all its strings, and each node also holds its children. An array per node costs the alphabet size in every node. A `Dictionary` per node costs a fixed overhead even with one child.

Hashing or comparing a string key reads all m characters, so a hash table with string keys is O(m) average per operation, not O(1), just as a trie is.

## Sorting

| Algorithm | Best case | Average or expected | Worst case | Extra space | Stable |
| --- | --- | --- | --- | --- | --- |
| Insertion sort | Θ(n), already sorted | Θ(n²) | Θ(n²) | O(1) | Yes |
| Selection sort | Θ(n²) | Θ(n²) | Θ(n²) | O(1) | No |
| Bubble sort, stopping when a pass makes no swaps | Θ(n), already sorted | Θ(n²) | Θ(n²) | O(1) | Yes |
| Merge sort | Θ(n log n) | Θ(n log n) | Θ(n log n) | O(n) | Yes |
| Quicksort, random pivot | Θ(n log n) | O(n log n) expected, distinct keys | Θ(n²) | O(log n) stack, recursing into the smaller side first | No |
| Heap sort | O(n log n) | Θ(n log n) | Θ(n log n) | O(1) | No |
| Introsort (`Array.Sort`, `List<T>.Sort`) | O(n log n) | O(n log n) | O(n log n) | O(log n) | No |
| Counting sort, keys in a range of size k | Θ(n + k) | Θ(n + k) | Θ(n + k) | O(n + k) | Yes |
| Radix sort, d digits of k values | Θ(d(n + k)) | Θ(d(n + k)) | Θ(d(n + k)) | O(n + k) | Yes |

Insertion sort's cost is O(n + inversions), which is why it stays fast on nearly sorted input. Any sort that only compares elements needs Ω(n log n) comparisons in the worst case. Counting and radix sort escape that bound by reading the keys as numbers.

## Searching

| Algorithm | Best case | Average | Worst case | Extra space | Needs |
| --- | --- | --- | --- | --- | --- |
| Linear search | O(1) | O(n) | O(n) | O(1) | Nothing |
| Binary search | O(1) | O(log n) | O(log n) | O(1) iterative | Sorted, random access |
| Hash table lookup | O(1) | O(1) | O(n) | O(n) for the table | A good hash function |
| Balanced tree lookup | O(1) | O(log n) | O(log n) | O(n) for the tree | Ordered keys |
| Trie lookup, key of length m | O(1) on an early miss | O(m) | O(m) with array children | O(total characters) for the trie | String keys |
| Quickselect, the k-th smallest | O(n) | O(n) expected | O(n²) | O(1) iterative | Nothing |

## Graph Algorithms

V is the number of vertices and E the number of edges, with an adjacency list unless the row says otherwise.

| Algorithm | Solves | Time | Space | Requires |
| --- | --- | --- | --- | --- |
| BFS | Reachability, shortest path by edge count | O(V + E) | O(V) | |
| DFS | Reachability, cycles, components | O(V + E) | O(V) | Recursion depth up to V |
| Dijkstra, binary heap with lazy deletion | Shortest paths from one source | O((V + E) log V) | O(V + E) | Non-negative weights |
| A*, consistent heuristic | Shortest path to one goal | O((V + E) log V) at worst, often far less | O(V + E) | Non-negative weights and a distance estimate |
| Bellman-Ford | Shortest paths from one source, detects negative cycles | O(V × E) | O(V) | Directed edges if any weight is negative |
| Floyd-Warshall | Shortest paths between every pair | O(V³) | O(V²) | No negative cycles |
| Topological sort (Kahn, or DFS) | An order that respects every edge | O(V + E) | O(V) | A directed acyclic graph |
| Kosaraju | Strongly connected components | O(V + E) | O(V + E) for the reversed graph | Directed graph |
| Kruskal | Minimum spanning tree | O(E log E) | O(V + E) | Undirected graph, a forest if disconnected |
| Prim, binary heap | Minimum spanning tree | O(E log V) | O(V + E) | Undirected, connected graph |
| Prim, plain array | Minimum spanning tree | O(V²) | O(V) | Undirected, connected graph. Beats the heap version on dense graphs |
| Union-find, rank and path compression | Merge groups, test whether two items share one | O(α(n)) amortized per operation | O(n) | |
| Edmonds-Karp | Maximum flow | O(V × E²) | O(V + E) | Directed graph with capacities |

An adjacency matrix makes BFS and DFS O(V²), since finding each vertex's neighbors scans a whole row.

## Space Patterns

| Pattern | Extra space | Example |
| --- | --- | --- |
| A fixed set of variables | O(1) | An in-place loop, iterative binary search |
| One copy of the input | O(n) | A hash set of seen values, merge sort's buffer |
| Recursion on a tree of height h | O(h) | Tree traversal. O(log n) when balanced, O(n) when skewed |
| A table indexed by two inputs | O(m × n) | Edit distance, reduced to O(n) by keeping two rows |
| Every subset or ordering, stored | O(n × 2ⁿ) or O(n × n!) | Generating a power set |

Extra space, also called auxiliary space, excludes the input itself. Total space includes it.

## .NET Collection Costs

Costs follow the method remarks on Microsoft Learn, or the `dotnet/runtime` source where Learn states none or leaves out a detail, such as `PriorityQueue` or the cost of growth.

| Operation | Cost |
| --- | --- |
| `array[i]`, `list[i]` | O(1) |
| `list.Add(item)` | O(1) amortized, O(n) when it grows |
| `list.Insert(index, item)` | O(n) |
| `list.RemoveAt(index)` | O(n − index), so O(1) at the end |
| `list.Remove(item)`, `Contains`, `IndexOf` | O(n) |
| `list.RemoveAll(predicate)` | O(n), where calling `Remove` in a loop is O(n²) |
| `Array.Sort`, `list.Sort` | O(n log n), introsort, unstable |
| `Array.BinarySearch`, `list.BinarySearch` | O(log n), sorted input only |
| `Array.Reverse` | O(n) |
| `dict[key]` get, `ContainsKey`, `TryGetValue`, `Remove` | O(1) average |
| `dict[key] = value` | O(1) average, O(n) when adding a key makes it grow |
| `dict.ContainsValue(value)` | O(n) |
| `dict.Add(key, value)` | O(1) average, O(n) when it grows |
| `dict.Keys`, `dict.Values` | O(1) to get the view, O(n) to enumerate it |
| `set.Contains`, `Remove` | O(1) average |
| `set.Add` | O(1) average, O(n) when it grows |
| `set.UnionWith(other)` | O(m) average, for m items in `other`, and O(n + m) when it grows |
| `set.IntersectWith(other)` | O(n) average if `other` is a `HashSet<T>` with the same comparer, O(n + m) average otherwise |
| `SortedDictionary` and `SortedSet` add, lookup, remove | O(log n) |
| `SortedList` lookup by key | O(log n) |
| `SortedList.Add` | O(log n) amortized when the key goes at the end, O(n) otherwise |
| `SortedList` `Keys[i]`, `Values[i]` | O(1) |
| `SortedList.Remove` | O(n) |
| `queue.Enqueue`, `stack.Push` | O(1) amortized, O(n) when it grows |
| `queue.Dequeue`, `stack.Pop`, `queue.Peek`, `stack.Peek` | O(1) |
| `LinkedList<T>` `AddFirst`, `AddLast`, `AddAfter`, `Remove(node)` | O(1) |
| `LinkedList<T>` `Find`, `Remove(value)` | O(n) |
| `PriorityQueue` `Enqueue` | O(log n), O(n) when it grows |
| `PriorityQueue` `Dequeue` | O(log n) |
| `PriorityQueue` `Remove` (.NET 9+) | O(n), a linear scan |
| `PriorityQueue` `Peek`, and building from a collection | O(1), and O(n) |

## Strings and LINQ

| Operation | Cost |
| --- | --- |
| `a + b` | O(len a + len b), since strings are immutable and every concatenation copies |
| `+=` in a loop building a string of length n | O(n²) in total |
| `StringBuilder.Append` | O(length appended), amortized |
| `Substring` | O(length of the result) |
| `Contains`, or `IndexOf` with `StringComparison.Ordinal`, for a substring of length m in a string of length n | O(n × m) worst case |
| `IndexOf(string)` with no comparison | Culture-sensitive, and slower than ordinal. Learn states no bound |
| `Where`, `Select` | Deferred. O(n) when enumerated |
| `OrderBy`, `ThenBy` | Deferred. O(n log n) when enumerated, stable |
| `OrderBy(...).Take(k)` | O(n + k log k) average, O(n²) worst case, through a partial quicksort |
| `First`, `Any` with a predicate | O(n) worst case, stopping at the first match |
| `Min`, `Max`, and `OrderBy(...).First()` | O(n), one pass with no sort, unless LINQ is built size-optimized (`IsSizeOptimized`) |
| `Contains(item)` | The collection's own `Contains` when it has one: O(1) average on a `HashSet<T>`, O(n) on a `List<T>` |
| `Last()` | O(1) on an `IList<T>`, O(n) otherwise |
| `Count()` | O(1) on an `ICollection<T>`, O(n) otherwise |
| `Count(predicate)`, `ToList`, `ToArray` | O(n) |
| `GroupBy`, `Distinct`, `ToDictionary`, `ToHashSet` | O(n) average, since each uses a hash table |
| `GroupJoin`, `Except`, `Intersect`, `Union` on sequences of n and m | O(n + m) average, through a hash table |
| `Join` on sequences of n and m | O(n + m + p) average for p matched pairs, where a nested `Where` is O(n × m) |
| `ElementAt(i)` | O(1) on an `IList<T>`, O(i) otherwise |
