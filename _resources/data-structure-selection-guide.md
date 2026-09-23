---
title: "Data Structure and Algorithm Selection Guide"
layout: resource
type: reference
category: "Data Structures & Algorithms"
description: "Selection tables and decision trees for picking a data structure or algorithm, and when to use a .NET built-in instead of writing your own."
last_updated: 2026-09-23
tags: [decision-making, data-structures, algorithm-selection, dotnet-collections]
related_guides:
  - /study-guides/dsa/big-o-basics.html
  - /study-guides/dsa/hash-tables.html
  - /study-guides/dsa/sorting-algorithms.html
  - /study-guides/dsa/graphs-advanced.html
---

## Quick Data Structure Selection

| Need | First Choice | Alternative | Avoid |
|------|-------------|-------------|-------|
| **Fast lookups by key** | Hash Map (Dictionary<K,V>) | Sorted array + binary search | Linear search in array |
| **Fast insertion/removal at ends** | Dynamic Array (List<T>) | Deque | Linked list (unless memory critical) |
| **Maintain sorted order during insertions** | Balanced BST or SortedDictionary<K,V> | Sorted list + binary insertion | Unbalanced BST |
| **Priority-based processing** | Heap (PriorityQueue<T,P>) | Sorted list | Unsorted array |
| **Function call management** | Stack | Array with index | Queue |
| **Task queue/scheduling** | Queue | Array with indices | Stack |
| **Undo/Redo operations** | Stack of states | Array | Queue |
| **Cache with size limit** | LRU Cache (dict + doubly linked) | Hash map only | Array |

## Algorithm Selection Guide

| Problem Type | First Try | If That Fails | Never Use |
|--------------|-----------|---------------|-----------|
| **Sorting small data** (<50 items) | Language built-in | Insertion sort | Bubble sort |
| **Sorting large data** | Language built-in | Merge sort | Selection sort |
| **Searching unsorted** | Linear search (built-in) | Hash set conversion | Binary search |
| **Searching sorted** | Binary search | Built-in search | Linear search |
| **Shortest path (unweighted)** | BFS | Library pathfinding | DFS |
| **Shortest path (weighted)** | Dijkstra's | A* with heuristic | BFS on weighted |
| **Finding any path** | DFS | BFS | Complex pathfinding |
| **Tree traversal** | Built-in iterator | Recursive DFS/BFS | Manual stack |

## Decision Tree for Algorithm Selection

### Sorting
```
Is data nearly sorted?
├─ Yes → Insertion Sort O(n) best case
└─ No → Is stability required?
   ├─ Yes → Merge Sort O(n log n) guaranteed stable
   └─ No → Is space limited?
      ├─ Yes → Heap Sort O(n log n), O(1) space
      └─ No → Quick Sort O(n log n) average, fast in practice
```

### Searching
```
Is data sorted?
├─ Yes → Binary Search O(log n)
└─ No → Multiple searches on same data?
   ├─ Yes → Build hash table O(n), then O(1) searches
   └─ No → Linear Search O(n)
```

### Graph Traversal
```
Need shortest path?
├─ Yes → Weights?
│  ├─ Positive → Dijkstra O((V+E) log V)
│  ├─ None → BFS O(V+E)
│  └─ Negative → Bellman-Ford O(VE)
└─ No → Any path?
   ├─ DFS O(V+E) - uses less memory
   └─ BFS O(V+E) - level-by-level
```

## Modern Reality Check

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Always Use Built-ins For</h4>
<ul>
<li><strong>Sorting:</strong> <code>Array.Sort()</code> and <code>List&lt;T&gt;.Sort()</code></li>
<li><strong>Basic searching:</strong> <code>Contains()</code>, <code>IndexOf()</code>, <code>Find()</code></li>
<li><strong>Standard collections:</strong> <code>List&lt;T&gt;</code>, <code>Dictionary&lt;K,V&gt;</code>, <code>HashSet&lt;T&gt;</code></li>
<li><strong>String operations:</strong> <code>Split()</code>, <code>string.Join()</code>, <code>Replace()</code>, Regex class</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Implement Yourself For</h4>
<ul>
<li><strong>Interview questions</strong> (they want to see you can think algorithmically)</li>
<li><strong>Highly specialized performance needs</strong> (after profiling proves bottleneck)</li>
<li><strong>Learning/educational purposes</strong></li>
<li><strong>Custom data structures</strong> for specific domain logic</li>
</ul>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">Study But Rarely Implement</p>
<ul>
<li>Advanced tree balancing (AVL, Red-Black trees)</li>
<li>Complex graph algorithms beyond DFS/BFS/Dijkstra</li>
<li>String matching beyond naive approach (use regex)</li>
<li>Advanced sorting algorithms (languages have hybrid algorithms)</li>
</ul>
</div>

## Language-Specific Advice

### C#
**Use:** `List<T>` for arrays, `Dictionary<K,V>` for maps, `HashSet<T>` for sets, `Queue<T>`/`Stack<T>`
**Built-in sorting:** `Array.Sort()` and `List<T>.Sort()` use introsort (quicksort + heapsort hybrid)
**Searching:** `Contains()`, `IndexOf()`, `Array.BinarySearch()` for sorted data
**Avoid implementing:** LINQ often provides what you need (`.Where()`, `.OrderBy()`, etc.)
**Collections:** Use `List<T>` instead of arrays for dynamic sizing, `Dictionary<K,V>` for O(1) lookups
**Performance:** Built-in collections are highly optimized with excellent cache performance

## Performance Reality

### Hash Maps Win Most Cases
- **Average O(1)** lookup, insertion, deletion
- **Powers most algorithms** - counting, caching, lookup tables
- **Default choice** unless you need ordering or have memory constraints

### Arrays/Lists Are Your Workhorse
- **O(1) access** by index
- **Great cache performance** due to memory locality
- **Built-in operations** are highly optimized
- **Use instead of linked lists** 99% of the time

### Trees Are Specialized
- **Use only when** you need sorted iteration with dynamic insertions
- **Most databases** use B-trees internally, not binary search trees
- **For interviews:** Know BST operations, but use `SortedDictionary` in production

### Graphs Are Domain-Specific  
- **Learn DFS/BFS deeply** - they apply to many problems beyond graphs
- **Use libraries** for complex graph algorithms (QuikGraph, Microsoft.Msagl for C#)
- **Common in:** Social networks, maps, dependency management, game AI

## Red Flags - When You're Probably Overthinking

- **Implementing your own hash table** (unless writing a database)
- **Writing custom sorting** (unless for embedded systems with constraints)
- **Building complex tree structures** (use language built-ins first)
- **Optimizing before measuring** (profile first, then optimize)
- **Choosing exotic algorithms** without clear performance requirements

## Green Lights - When Custom Implementation Makes Sense

- **Interview/educational context** (they want to see your thinking)
- **Profiled performance bottleneck** with clear improvement path
- **Domain-specific constraints** (memory, real-time, embedded systems)
- **Algorithm doesn't exist** in standard libraries for your use case
- **Learning exercise** to understand concepts deeply
