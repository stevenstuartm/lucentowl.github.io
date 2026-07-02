---
title: "Big-O Complexity Quick Reference"
layout: resource
type: reference
category: "DSA"
description: "Time complexity growth rates, practical input limits, and complexity of common algorithms, for fast lookup during algorithm analysis."
last_updated: 2026-07-02
tags: [algorithms, complexity-analysis, data-structures, performance]
related_guides:
  - /study-guides/dsa/big-o-basics.html
  - /study-guides/dsa/asymptotic-notation.html
---

**Complexity hierarchy:** O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)

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
