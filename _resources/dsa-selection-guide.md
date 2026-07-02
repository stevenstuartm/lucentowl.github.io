---
title: "Data Structure and Algorithm Selection Guide"
layout: resource
type: reference
description: "Quick lookup for choosing the right data structure or algorithm by need — first choice, alternative, and what to avoid."
last_updated: 2026-07-02
tags: [algorithms, data-structures, decision-making]
related_guides:
  - /study-guides/dsa/decision-guide.html
---

## Data Structure Selection

| Need | First Choice | Alternative | Avoid |
| --- | --- | --- | --- |
| Fast lookups by key | Hash Map (`Dictionary<K,V>`) | Sorted array + binary search | Linear search in array |
| Fast insertion/removal at ends | Dynamic Array (`List<T>`) | Deque | Linked list (unless memory critical) |
| Maintain sorted order during insertions | Balanced BST or `SortedDictionary<K,V>` | Sorted list + binary insertion | Unbalanced BST |
| Priority-based processing | Heap (`PriorityQueue<T,P>`) | Sorted list | Unsorted array |
| Function call management | Stack | Array with index | Queue |
| Task queue/scheduling | Queue | Array with indices | Stack |
| Undo/Redo operations | Stack of states | Array | Queue |
| Cache with size limit | LRU Cache (dict + doubly linked) | Hash map only | Array |

## Algorithm Selection

| Problem Type | First Try | If That Fails | Never Use |
| --- | --- | --- | --- |
| Sorting small data (<50 items) | Language built-in | Insertion sort | Bubble sort |
| Sorting large data | Language built-in | Merge sort | Selection sort |
| Searching unsorted | Linear search (built-in) | Hash set conversion | Binary search |
| Searching sorted | Binary search | Built-in search | Linear search |
| Shortest path (unweighted) | BFS | Library pathfinding | DFS |
| Shortest path (weighted) | Dijkstra's | A* with heuristic | BFS on weighted |
| Finding any path | DFS | BFS | Complex pathfinding |
| Tree traversal | Built-in iterator | Recursive DFS/BFS | Manual stack |
