---
title: "Big-O Complexity Quick Reference"
layout: resource
type: reference
category: "Data Structures & Algorithms"
description: "Time complexity growth rates, practical input limits, and complexity of common algorithms, for fast lookup during algorithm analysis."
last_updated: 2026-09-23
tags: [algorithms, complexity-analysis, data-structures, performance]
related_guides:
  - /study-guides/dsa/big-o-basics.html
---

<div class="callout callout--tip" markdown="1">
<p class="callout__title">Complexity hierarchy</p>

O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)

</div>

## Growth Rates and Practical Limits

| Notation | Name | Growth Rate | Max Practical n | Common Examples |
| --- | --- | --- | --- | --- |
| O(1) | Constant | No growth | Any size | Array access, hash table lookup |
| O(log n) | Logarithmic | Very slow growth | Billions | Binary search, balanced tree operations |
| O(n) | Linear | Proportional growth | ~10⁸ | Linear search, single loop |
| O(n log n) | Linearithmic | Moderate growth | ~10⁶ | Merge sort, heap sort |
| O(n²) | Quadratic | Rapid growth | ~10⁴ | Bubble sort, nested loops |
| O(n³) | Cubic | Very rapid growth | ~10³ | Naive matrix multiplication |
| O(2ⁿ) | Exponential | Explosive growth | ~20 | Naive recursive Fibonacci, subset generation |
| O(n!) | Factorial | Extremely explosive | ~10 | Brute-force permutations, traveling salesman |

## Common Algorithm Complexities

| Operation | Time | Space | Notes |
| --- | --- | --- | --- |
| Binary Search | O(log n) | O(1) | Sorted array required |
| Merge Sort | O(n log n) | O(n) | Stable, guaranteed |
| Hash Lookup | O(1) avg | O(n) | Worst case O(n) |
| DFS / BFS | O(V + E) | O(V) | Graph traversal |

## Data Structures Complexity

| Data Structure | Access | Search | Insertion | Deletion | Space |
|----------------|--------|--------|-----------|----------|-------|
| **Array** | O(1) | O(n) | O(n) | O(n) | O(n) |
| **Dynamic Array** | O(1) | O(n) | O(1) amortized | O(n) | O(n) |
| **Linked List** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Doubly Linked List** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Stack** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Queue** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Hash Table** | N/A | O(1)* | O(1)* | O(1)* | O(n) |
| **Binary Search Tree** | O(log n)* | O(log n)* | O(log n)* | O(log n)* | O(n) |
| **AVL Tree** | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| **Red-Black Tree** | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| **B-Tree** | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| **Heap (Binary)** | N/A | O(n) | O(log n) | O(log n) | O(n) |
| **Trie** | N/A | O(m) | O(m) | O(m) | O(ALPHABET_SIZE × N × M) |

*Average case. Worst case for hash table is O(n), for BST is O(n).

## Sorting Algorithms Complexity

| Algorithm | Best Case | Average Case | Worst Case | Space | Stable | Notes |
|-----------|-----------|--------------|------------|-------|--------|-------|
| **Bubble Sort** | O(n) | O(n²) | O(n²) | O(1) | Yes | Never use in production |
| **Selection Sort** | O(n²) | O(n²) | O(n²) | O(1) | No | Consistently slow |
| **Insertion Sort** | O(n) | O(n²) | O(n²) | O(1) | Yes | Good for small/nearly sorted |
| **Merge Sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | Guaranteed performance |
| **Quick Sort** | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Most practical |
| **Heap Sort** | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Guaranteed, in-place |
| **Counting Sort** | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes | When k is small |
| **Radix Sort** | O(d(n + k)) | O(d(n + k)) | O(d(n + k)) | O(n + k) | Yes | For integers |
| **Bucket Sort** | O(n + k) | O(n + k) | O(n²) | O(n) | Yes | Uniform distribution |
| **Tim Sort** | O(n) | O(n log n) | O(n log n) | O(n) | Yes | Hybrid stable sort |

## Search Algorithms Complexity

| Algorithm | Best Case | Average Case | Worst Case | Space | Prerequisites |
|-----------|-----------|--------------|------------|-------|---------------|
| **Linear Search** | O(1) | O(n) | O(n) | O(1) | None |
| **Binary Search** | O(1) | O(log n) | O(log n) | O(1) | Sorted array |
| **Hash Table Lookup** | O(1) | O(1) | O(n) | O(n) | Good hash function |
| **Binary Search Tree** | O(log n) | O(log n) | O(n) | O(n) | Balanced tree |
| **BFS** | O(V + E) | O(V + E) | O(V + E) | O(V) | Graph/tree |
| **DFS** | O(V + E) | O(V + E) | O(V + E) | O(V) | Graph/tree |
| **Dijkstra** | O((V + E) log V) | O((V + E) log V) | O((V + E) log V) | O(V) | Non-negative weights |
| **A*** | O(b^d) | O(b^d) | O(b^d) | O(b^d) | Good heuristic |

## Graph Algorithms Complexity

| Algorithm | Time Complexity | Space Complexity | Use Case |
|-----------|----------------|------------------|----------|
| **DFS** | O(V + E) | O(V) | Connected components, cycles |
| **BFS** | O(V + E) | O(V) | Shortest path (unweighted) |
| **Dijkstra** | O((V + E) log V) | O(V) | Shortest path (weighted, non-negative) |
| **Bellman-Ford** | O(VE) | O(V) | Shortest path (negative edges) |
| **Floyd-Warshall** | O(V³) | O(V²) | All pairs shortest paths |
| **Kruskal's MST** | O(E log E) | O(V) | Minimum spanning tree |
| **Prim's MST** | O((V + E) log V) | O(V) | Minimum spanning tree |
| **Topological Sort** | O(V + E) | O(V) | DAG ordering |
| **Strongly Connected Components** | O(V + E) | O(V) | Find SCCs |

## Space Complexity Patterns

### Auxiliary Space vs Total Space
- **Auxiliary Space:** Extra space used by algorithm
- **Total Space:** Auxiliary space + input space

### Common Space Complexities

| Pattern | Space | Example |
|---------|-------|---------|
| **Constant variables** | O(1) | Simple loops, iterative algorithms |
| **Single array/list** | O(n) | Hash tables, auxiliary arrays |
| **Recursive call stack** | O(h) | Tree recursion (h = height) |
| **2D matrix** | O(n²) | Dynamic programming tables |
| **All subsets** | O(2^n) | Powerset generation |

## .NET Collection Operation Costs
```csharp
// Array operations:
array[i]                    // O(1) - direct indexing
Array.Sort(array)           // O(n log n) - Introsort algorithm
Array.BinarySearch(array)   // O(log n) - requires sorted array
Array.IndexOf(array, item)  // O(n) - linear search
Array.Reverse(array)        // O(n) - reverses in place

// List<T> operations:
list.Add(item)              // O(1) amortized - may trigger resize
list.Insert(0, item)        // O(n) - shifts all elements right
list.Remove(item)           // O(n) - finds item then removes
list.RemoveAt(index)        // O(n) - shifts elements left
list.Contains(item)         // O(n) - linear search through list
list.IndexOf(item)          // O(n) - linear search for first occurrence
list.Sort()                 // O(n log n) - Introsort (hybrid algorithm)
list[index]                 // O(1) - direct indexing

// String operations:
string.Concat(strings)      // O(n) - n is total character count
string + string            // O(n) - creates new string each time
StringBuilder.Append()     // O(1) amortized - efficient for multiple concatenations
string.Substring()         // O(n) - creates new string
string.Contains()          // O(n) - linear search
string.IndexOf()           // O(n) - linear search for substring

// Dictionary<K,V> operations:
dict[key]                   // O(1) average, O(n) worst case
dict.ContainsKey(key)       // O(1) average, O(n) worst case
dict.Add(key, value)        // O(1) average, O(n) worst case
dict.Remove(key)            // O(1) average, O(n) worst case
dict.Keys/Values            // O(1) - returns collection views

// HashSet<T> operations:
set.Add(item)               // O(1) average, O(n) worst case
set.Contains(item)          // O(1) average, O(n) worst case
set.Remove(item)            // O(1) average, O(n) worst case
set.UnionWith(other)        // O(n) - n is size of other collection
set.IntersectWith(other)    // O(n) - n is size of smaller set

// LINQ operations (common ones):
collection.Where(predicate)     // O(n) - filters collection
collection.Select(selector)     // O(n) - transforms each element
collection.OrderBy(keySelector) // O(n log n) - sorts collection
collection.First(predicate)     // O(n) worst case - stops at first match
collection.Any(predicate)       // O(n) worst case - stops at first match
collection.Count(predicate)     // O(n) - counts matching elements
collection.GroupBy(keySelector) // O(n) - groups elements
```
