---
title: "Algorithm Design Paradigms"
category: Data Structures & Algorithms
description: "Master four fundamental algorithm design approaches: dynamic programming, greedy algorithms, divide-and-conquer, and backtracking with practical examples and complexity analysis."
tags: [algorithms, problem-solving, design-patterns, advanced, optimization]
---

## Overview

Four fundamental approaches to algorithm design, each suited for different problem patterns:

| Paradigm | Key Idea | When to Use | Complexity Impact |
|----------|----------|-------------|-------------------|
| **Dynamic Programming** | Store subproblem results | Overlapping subproblems | O(2ⁿ) → O(n²) |
| **Greedy** | Local optimal choices | Greedy choice property | Simple, O(n log n) often |
| **Divide & Conquer** | Break into independent parts | Recursive decomposition | Often O(n log n) |
| **Backtracking** | Try all possibilities | Constraint satisfaction | Exponential with pruning |

---

## Dynamic Programming

*Term coined by Richard Bellman in the 1950s. "Programming" refers to optimization, not coding. Bellman chose "dynamic" to sound impressive to government funders who might not fund "mathematical" research.*

**Core idea:** Solve each subproblem once, store result for reuse. Transform exponential brute-force into polynomial time by caching.

### When to Use
- **Overlapping subproblems**: Same calculation repeated many times (unlike divide-and-conquer where subproblems are independent)
- **Optimal substructure**: Optimal solution built from optimal subsolutions
- Need optimal value (min/max cost, count ways, longest/shortest)

<div class="callout callout--tip">
<p class="callout__title">Recognition Pattern</p>
<p>If you find yourself solving the same subproblem repeatedly in recursion, DP can help. Look for repeated function calls with identical parameters.</p>
</div>

### Two Approaches

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Memoization (Top-down)</h4>
<ul>
<li>Start with recursive solution</li>
<li>Add caching (hash map/array) to store results</li>
<li><strong>Pros</strong>: Only computes needed subproblems, easier to code from recursion</li>
<li><strong>Cons</strong>: Recursion overhead, stack space</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Tabulation (Bottom-up)</h4>
<ul>
<li>Build table iteratively from base cases</li>
<li><strong>Pros</strong>: No recursion overhead, often faster, predictable space</li>
<li><strong>Cons</strong>: Computes all subproblems, harder to visualize</li>
</ul>
</div>
</div>

**Complexity:** O(number of states × transitions per state)
- Example: 2D DP table = O(m × n) states, O(1) per transition = O(m × n) total

### Classic DP Patterns

#### 1. Longest Common Subsequence
```csharp
public static int LCS(string s1, string s2)
{
    int m = s1.Length, n = s2.Length;
    var dp = new int[m + 1, n + 1];

    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i, j] = s1[i-1] == s2[j-1]
                ? dp[i-1, j-1] + 1
                : Math.Max(dp[i-1, j], dp[i, j-1]);

    return dp[m, n];  // "abcde", "ace" → 3
}
```

#### 2. 0/1 Knapsack
```csharp
public static int Knapsack(int[] weights, int[] values, int capacity)
{
    int n = weights.Length;
    var dp = new int[n + 1, capacity + 1];

    for (int i = 1; i <= n; i++)
        for (int w = 1; w <= capacity; w++)
            dp[i, w] = weights[i-1] <= w
                ? Math.Max(dp[i-1, w], values[i-1] + dp[i-1, w-weights[i-1]])
                : dp[i-1, w];

    return dp[n, capacity];
}
```

#### 3. Edit Distance
```csharp
public static int EditDistance(string word1, string word2)
{
    int m = word1.Length, n = word2.Length;
    var dp = new int[m + 1, n + 1];

    for (int i = 0; i <= m; i++) dp[i, 0] = i;
    for (int j = 0; j <= n; j++) dp[0, j] = j;

    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i, j] = word1[i-1] == word2[j-1]
                ? dp[i-1, j-1]
                : 1 + Math.Min(Math.Min(dp[i-1,j], dp[i,j-1]), dp[i-1,j-1]);

    return dp[m, n];  // "horse", "ros" → 3
}
```

---

## Greedy Algorithms

**Core idea:** Make locally optimal choice at each step.

### When to Use
- Greedy choice property (local optimal → global optimal)
- Can prove correctness
- Need simple, efficient solution

### Classic Examples

#### Activity Selection
```csharp
// Sort by end time, pick non-overlapping
public static List<Activity> SelectActivities(List<Activity> activities)
{
    activities.Sort((a, b) => a.End.CompareTo(b.End));
    var selected = new List<Activity> { activities[0] };
    int lastEnd = activities[0].End;

    foreach (var a in activities.Skip(1))
        if (a.Start >= lastEnd)
        {
            selected.Add(a);
            lastEnd = a.End;
        }

    return selected;
}
```

#### Fractional Knapsack
```csharp
// Sort by value/weight ratio, take greedily
public static double MaxValue(List<Item> items, int capacity)
{
    items.Sort((a, b) => b.ValuePerWeight.CompareTo(a.ValuePerWeight));
    double total = 0;

    foreach (var item in items)
    {
        if (capacity >= item.Weight)
        {
            total += item.Value;
            capacity -= item.Weight;
        }
        else
        {
            total += (double)capacity / item.Weight * item.Value;
            break;
        }
    }
    return total;
}
```

---

## Divide & Conquer

**Core idea:** Break into independent subproblems, solve, combine results.

### When to Use
- Independent subproblems (no overlap)
- Subproblems have same structure
- Can efficiently combine solutions
- Often achieves O(n log n)

### Classic Examples

#### Merge Sort
```csharp
public static void MergeSort(int[] arr, int left, int right)
{
    if (left >= right) return;

    int mid = (left + right) / 2;
    MergeSort(arr, left, mid);
    MergeSort(arr, mid + 1, right);
    Merge(arr, left, mid, right);  // Combine
}
```

#### Quick Select (Kth Largest)
```csharp
public static int FindKthLargest(int[] nums, int k)
{
    int left = 0, right = nums.Length - 1;
    k = nums.Length - k;  // Convert to kth smallest

    while (left < right)
    {
        int pivot = Partition(nums, left, right);
        if (pivot == k) return nums[k];
        if (pivot < k) left = pivot + 1;
        else right = pivot - 1;
    }
    return nums[k];
}
```

---

## Backtracking

**Core idea:** Try all possibilities, abandon (backtrack) when invalid.

### When to Use
- Find ALL solutions
- Constraint satisfaction
- Combinatorial problems
- Decision trees with pruning

### Classic Examples

#### N-Queens
```csharp
public static void SolveNQueens(char[][] board, int row, List<List<string>> result)
{
    if (row == board.Length)
    {
        result.Add(BoardToList(board));
        return;
    }

    for (int col = 0; col < board.Length; col++)
    {
        if (IsValid(board, row, col))
        {
            board[row][col] = 'Q';
            SolveNQueens(board, row + 1, result);
            board[row][col] = '.';  // Backtrack
        }
    }
}
```

#### Generate Subsets
```csharp
public static void Subsets(int[] nums, int start, List<int> curr, List<List<int>> result)
{
    result.Add(new List<int>(curr));

    for (int i = start; i < nums.Length; i++)
    {
        curr.Add(nums[i]);
        Subsets(nums, i + 1, curr, result);
        curr.RemoveAt(curr.Count - 1);  // Backtrack
    }
}
```

---

## Quick Reference

| Paradigm | Complexity | Space | Best For |
|----------|------------|-------|----------|
| DP | O(states × transitions) | O(states) | Optimization with overlap |
| Greedy | O(n log n) typically | O(1) often | Local → Global optimal |
| Divide & Conquer | O(n log n) often | O(log n) | Independent subproblems |
| Backtracking | Exponential | O(depth) | All solutions, constraints |

**Key Pattern Recognition:**
- Repeated subproblems → DP
- Local choices work → Greedy
- Independent parts → Divide & Conquer
- Need all solutions → Backtracking

---