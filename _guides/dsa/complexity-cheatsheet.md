---
title: "Complexity Cheat Sheet"
category: Data Structures & Algorithms
description: "Quick reference for time and space complexity of common data structures, algorithms, and operations with practical guidelines for algorithm selection and performance optimization."
tags: [algorithms, complexity-analysis, reference, interview-prep]
---

## Why Complexity Analysis Matters

Understanding algorithm efficiency isn't just academic; it's the difference between a system that scales gracefully and one that crashes under load. Complexity analysis helps you predict how your code will behave with real-world data sizes, choose the right approach for your constraints, and avoid the trap of premature optimization.

**Real impact:** A O(n²) algorithm might work fine with 100 items but become unusably slow with 10,000. This cheat sheet gives you the tools to make informed decisions about algorithm choice and performance trade-offs.

## Quick Reference for Time & Space Complexity

---

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

---

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

---

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

---

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

---

## Common Complexity Growth Rates

### For input size n = 1,000,000:

| Complexity | Operations | Performance |
|------------|------------|-------------|
| **O(1)** | 1 | Excellent |
| **O(log n)** | ~20 | Excellent |
| **O(n)** | 1,000,000 | Good |
| **O(n log n)** | ~20,000,000 | Acceptable |
| **O(n²)** | 1,000,000,000,000 | Poor |
| **O(2^n)** | 2^1000000 | Impossible |
| **O(n!)** | 1000000! | Impossible |

### Growth Rate Visualization

```
n=10      n=100     n=1000    n=10000
O(1)        1         1         1         1
O(log n)    3        ~7        10        13
O(n)       10       100      1000     10000
O(n log n) 33       664      9966    132877
O(n²)     100     10000   1000000  100000000
O(2^n)   1024      2^100    2^1000   2^10000
O(n!)   ~3.6M       !        !        !
```

---

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

---

## Amortized Analysis Examples

### Dynamic Array (ArrayList/Vector)
- **Individual insertion:** O(1) amortized, O(n) worst case
- **n insertions total:** O(n) total time
- **Why:** Occasional expensive resize operations spread over many cheap ones

### Hash Table with Chaining
- **Individual operations:** O(1) amortized, O(n) worst case  
- **Why:** Good hash function distributes elements evenly

### Union-Find with Path Compression
- **Individual operation:** O(α(n)) amortized (practically constant)
- **m operations:** O(m α(n)) total
- **Why:** Path compression flattens trees over time

---

## Practical Guidelines

### When Complexity Doesn't Matter
- **Very small inputs:** n < 100, any reasonable algorithm works
- **One-time operations:** Setup costs, preprocessing
- **Different order of magnitude:** O(n) vs O(n log n) when n < 1000

### When Complexity Matters Most
- **Large inputs:** n > 100,000
- **Repeated operations:** Inside loops, frequently called functions
- **Real-time systems:** Consistent performance requirements
- **Scalable systems:** Growing user base or data size

### Optimization Priority
1. **Correctness first:** Working solution beats fast broken solution
2. **Algorithmic complexity:** O(n²) → O(n log n) gives biggest gains
3. **Constant factors:** Optimize inner loops, reduce cache misses
4. **Language/library optimizations:** Use built-in functions

### Memory vs Time Trade-offs

| Approach | Time | Space | Example |
|----------|------|-------|---------|
| **Precompute** | Faster | More | Lookup tables |
| **Recompute** | Slower | Less | Calculate on demand |
| **Memoization** | Faster after first | More | Dynamic programming |
| **Streaming** | Same | Less | Process data in chunks |

---

## Interview Quick Checks

### Red Flags (Usually Suboptimal)
- **O(n³) or higher:** Often can be improved
- **O(2^n) for n > 20:** Usually needs dynamic programming
- **O(n²) sorting:** Use O(n log n) algorithms
- **O(n) search in sorted data:** Use binary search O(log n)

### Good Signs
- **O(n) or O(n log n):** Often optimal for most problems
- **O(1) space:** In-place algorithms are memory efficient
- **O(log n) depth:** Balanced tree operations
- **Matching lower bounds:** Optimal algorithms

### Common Optimizations
- **Hash tables:** O(n) → O(1) for lookups
- **Sorting first:** Enables binary search O(log n)
- **Two pointers:** O(n²) → O(n) for many array problems
- **Sliding window:** O(n²) → O(n) for substring problems
- **Dynamic programming:** O(2^n) → O(n²) for overlapping subproblems

---

## Language-Specific Complexity Notes

### C#
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

---

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

---

## Big O Misconceptions

### Myth: "O(1) is always faster than O(n)"
**Reality:** Big O describes growth rate, not absolute speed
```csharp
// This O(1) operation might be slower than O(n) for small n
public static int SlowConstantOperation()
{
    Thread.Sleep(1000); // O(1) but takes 1 second
    return 42;
}

public static int FastLinearOperation(int n)
{
    return Enumerable.Range(0, n).Sum(); // O(n) but very fast for small n
}
```

### Myth: "O(n log n) is much slower than O(n)"
**Reality:** log n grows very slowly
- For n = 1,000,000: log n ≈ 20
- O(n log n) is only ~20x slower than O(n)

### Myth: "Space complexity doesn't matter"
**Reality:** Memory is finite and cache misses are expensive
- Large memory usage can cause swapping
- Poor cache locality slows down algorithms significantly

---

## Advanced Complexity Concepts

### Amortized Analysis Techniques

**1. Aggregate Method**
- Total cost of n operations / n
- Example: n insertions into dynamic array = O(n) total

**2. Accounting Method**  
- Assign "credits" to operations
- Expensive operations use credits from cheap ones

**3. Potential Method**
- Define potential function Φ
- Amortized cost = actual cost + ΔΦ

### Complexity Classes (Theory)
| Class | Description | Example |
|-------|-------------|---------|
| **P** | Polynomial time | Most practical algorithms |
| **NP** | Nondeterministic polynomial | Traveling salesman |
| **NP-Complete** | Hardest problems in NP | SAT, Graph coloring |
| **NP-Hard** | At least as hard as NP | Halting problem |
| **PSPACE** | Polynomial space | Some game problems |

---

## Interview Strategy by Complexity

### O(n²) Solutions
- Often the first solution you think of
- Good starting point to show understanding
- Always mention you can optimize further

### O(n log n) Solutions
- Usually involving sorting or divide-and-conquer
- Sweet spot for many algorithms
- Often the optimal solution for comparison-based problems

### O(n) Solutions
- Linear time is often optimal
- Look for single-pass algorithms
- Hash tables frequently enable O(n) solutions

### O(1) Solutions
- Usually involving mathematical insight
- Not always possible, but impressive when found
- Often requires preprocessing or extra space

---

## Complexity Red Flags in Interviews

### Immediately Suspicious
- **O(n³) or higher:** Almost always can be optimized
- **O(2^n) for n > 25:** Usually needs dynamic programming
- **Nested loops with same variable:** Often O(n²) when O(n) possible
- **Sorting inside loops:** Often can be done once outside

### Code Smells
```csharp
// Red flag: O(n²) when O(n) is possible
public static bool HasDuplicatesBad(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n; i++)
    {
        for (int j = 0; j < n; j++) // Same range as outer loop
        {
            if (i != j && arr[i] == arr[j]) // Can use HashSet instead
                return true;
        }
    }
    return false;
}

// Better: O(n)
public static bool HasDuplicatesGood(int[] arr)
{
    var seen = new HashSet<int>();
    foreach (int item in arr)
    {
        if (seen.Contains(item))
            return true;
        seen.Add(item);
    }
    return false;
}
```

### Good Signs
```csharp
// Good: Two pointers technique O(n)
public static void TwoPointersExample(int[] arr)
{
    int left = 0;
    int right = arr.Length - 1;

    while (left < right)
    {
        // Process arr[left] and arr[right]
        left++;
        right--;
    }
}

// Good: Sliding window O(n)
public static int MaxSumSubarray(int[] arr, int k)
{
    int windowSum = arr.Take(k).Sum();
    int maxSum = windowSum;

    for (int i = k; i < arr.Length; i++)
    {
        windowSum = windowSum - arr[i - k] + arr[i];
        maxSum = Math.Max(maxSum, windowSum);
    }

    return maxSum;
}
```

---

## Quick Complexity Estimation

### Rule of Thumb for Coding Interviews
- **n ≤ 12:** O(n!) or O(2^n) might be acceptable
- **n ≤ 25:** O(2^n) algorithms might work
- **n ≤ 100:** O(n³) algorithms might work  
- **n ≤ 1,000:** O(n²) algorithms should work
- **n ≤ 100,000:** O(n log n) algorithms should work
- **n ≤ 1,000,000:** O(n) algorithms required
- **n > 1,000,000:** Need better than O(n) or special techniques

### Time Limits (Rough Guidelines)
- **1 second:** ~10⁸ operations
- **2 seconds:** ~2×10⁸ operations  
- **5 seconds:** ~5×10⁸ operations

Remember: These are rough estimates. Actual performance depends on:
- Constant factors
- Cache behavior  
- Language efficiency
- Hardware specifications
- Input characteristics