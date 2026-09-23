---
title: "Complexity Analysis"
layout: guide
category: Data Structures & Algorithms
subcategory: Fundamentals
description: "How to state and compare what an algorithm costs: the growth-rate ladder from O(1) to O(n!), what O, Ω, and Θ bound, why bounds are not best or worst cases, and how space and amortized costs are analyzed."
tags: [complexity-analysis, big-o, recursion-tree, amortized-analysis, space-complexity, fundamentals]
---
{% raw %}

## Why Complexity Analysis Matters

Complexity analysis predicts how an algorithm's running time and memory grow as its input grows, without running it on any particular machine. An app that works with 100 users and stalls with 100,000 usually contains an algorithm whose cost grows faster than its input, and the analysis finds it before production does.

The gap between growth rates widens quickly. On a million items, a linear algorithm does about a million steps and a quadratic one about a trillion. At a rough 10⁸ simple steps per second, that is 10 milliseconds against nearly three hours.

---

## What Big O Describes

Big O notation describes how a cost grows as the input size, n, grows. It ignores constant factors and the behavior of small inputs, so it compares algorithms rather than machines or implementations. Paul Bachmann introduced the notation in 1894, and Edmund Landau adopted and popularized it in 1909.

It describes a pattern, not a time. O(n) says that doubling the input roughly doubles the work, and says nothing about whether that work takes a microsecond or a minute.

| Growth rate | Doubling the input |
| --- | --- |
| O(1) | Leaves the work unchanged |
| O(log n) | Adds one step |
| O(n) | Doubles the work |
| O(n²) | Quadruples the work |
| O(2ⁿ) | Squares the work |

---

## The Growth-Rate Ladder

The common growth rates, from cheapest to most expensive, are O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!). The chart plots six of them. At n = 20, O(1) and O(log n) have barely left the axis and O(n) has reached only 20, while O(2ⁿ) passed 100 operations before n reached 7 and O(n²) reached 100 at n = 10.

{% endraw %}
{% include figure.html id="dsa-growth-rates" %}
{% raw %}

### O(1): Constant Time

The cost doesn't depend on the input size. Reading an array element by index takes the same time for a ten-element array as for a ten-million-element one.

```csharp
public static int GetFirst(int[] array)
{
    if (array.Length == 0)
        throw new ArgumentException("The array is empty.", nameof(array));
    return array[0];  // Same cost regardless of array size
}
```

### O(log n): Logarithmic Time

log₂ n counts how many times n can be halved before reaching 1. log₂ 8 is 3, because 8 → 4 → 2 → 1 takes three halvings. An algorithm is logarithmic when each step discards a constant fraction of what remains. Binary search discards half of the remaining range with every comparison, so a million sorted items need about 20 comparisons and a billion need about 30.

Big O leaves the base of the logarithm unwritten. Logarithms of different bases differ only by a constant factor (log₂ n = log₁₀ n / log₁₀ 2), and Big O drops constant factors.

```csharp
public static int BinarySearch(int[] sortedArray, int target)
{
    int left = 0, right = sortedArray.Length - 1;

    while (left <= right)
    {
        int mid = left + (right - left) / 2;

        if (sortedArray[mid] == target) return mid;
        if (sortedArray[mid] < target) left = mid + 1;
        else right = mid - 1;
    }

    return -1;
}
```

### O(n): Linear Time

The algorithm touches each element a bounded number of times. Finding the maximum of an unsorted array has to examine every element, since any element it skipped could be the largest.

```csharp
public static int FindMax(int[] array)
{
    if (array.Length == 0) throw new ArgumentException("Array is empty.");

    int max = array[0];

    foreach (int num in array)  // Visits each element once
    {
        if (num > max) max = num;
    }

    return max;
}
```

### O(n log n): Linearithmic Time

This is the typical cost of divide-and-conquer algorithms that split the input in half and do linear work to combine the halves. Merge sort is the standard example. It is also the floor for sorting by comparison. A comparison-based sort has to tell apart all n! possible orderings of its input, which takes at least log₂(n!) comparisons on its hardest input, and log₂(n!) grows like n log₂ n. So merge sort and heap sort are as good as comparison sorting gets, up to constant factors.

```csharp
// Merge sort's recursive structure (the Merge step is omitted)
public static void MergeSort(int[] array, int left, int right)
{
    if (left < right)
    {
        int mid = left + (right - left) / 2;

        MergeSort(array, left, mid);        // Sort left half
        MergeSort(array, mid + 1, right);   // Sort right half
        Merge(array, left, mid, right);     // Combine in linear time
    }
}
```

### O(n²): Quadratic Time

This is the typical cost of comparing every element with every other element. The loop below runs its body n(n − 1)/2 times, which is O(n²) once the constant ½ and the slower-growing −n/2 are dropped. 1,000 items take about half a million iterations, and 10,000 take about 50 million.

```csharp
public static List<(int, int)> FindAllPairs(int[] array)
{
    var pairs = new List<(int, int)>();

    for (int i = 0; i < array.Length; i++)          // n iterations
    {
        for (int j = i + 1; j < array.Length; j++)  // n - i - 1 iterations
        {
            pairs.Add((array[i], array[j]));        // n(n - 1)/2 in total
        }
    }

    return pairs;
}
```

### O(n³): Cubic Time

Three nested loops over the input produce cubic cost. Multiplying two n × n matrices the schoolbook way is the standard example, because each of the n² result cells is a sum of n products.

### O(2ⁿ): Exponential Time

Each additional element doubles the work. A set of n items has 2ⁿ subsets, so any algorithm that examines every subset is exponential. Naive recursive Fibonacci is exponential too. Its total number of calls grows by a factor of about 1.6 each time n increases by one, rather than doubling, so O(2ⁿ) is a correct upper bound for it but an overestimate.

```csharp
public static long FibonacciNaive(int n)
{
    if (n <= 1) return n;

    // Each call makes two more calls, recomputing the same values many times
    return FibonacciNaive(n - 1) + FibonacciNaive(n - 2);
}
```

### O(n!): Factorial Time

Trying every ordering of n items costs n!. A brute-force solution to the traveling salesman problem, which checks every possible route, is the standard example. 10! is already about 3.6 million and 20! is about 2.4 × 10¹⁸.

---

## Bounds: O, Ω, and Θ

Big O is one of three bounds. Each compares a cost function f(n), such as the number of comparisons an algorithm makes on inputs of size n, against a simpler function g(n), such as n or n².

| Notation | Bound | Formal definition | Reads as |
| --- | --- | --- | --- |
| f(n) = O(g(n)) | Upper | 0 ≤ f(n) ≤ c · g(n) for some constant c > 0 and every n ≥ some n₀ | f grows no faster than g |
| f(n) = Ω(g(n)) | Lower | 0 ≤ c · g(n) ≤ f(n) for some constant c > 0 and every n ≥ some n₀ | f grows at least as fast as g |
| f(n) = Θ(g(n)) | Tight | f(n) is both O(g(n)) and Ω(g(n)) | f grows at the same rate as g |

The constant c is why constant factors disappear, and n₀ is why small-input behavior disappears. Each definition only has to hold from some input size onward, with some multiplier, and f(n) is free to do anything before n₀.

{% endraw %}
{% include figure.html id="dsa-asymptotic-bounds" %}
{% raw %}

Because Big O is only an upper bound, it can be loose. Binary search makes O(log n) comparisons, and saying it makes O(n) comparisons is also true, just unhelpful. In everyday use, people often write O where Θ is meant. Donald Knuth set the Ω and Θ definitions that computer science uses in 1976.

---

## Bounds Are Not Cases

A bound (O, Ω, Θ) and a case (best, worst, average) are separate choices. A common error pairs them, treating Big O as "the worst case" and Ω as "the best case." Each case is its own function of n, and any of the three bounds can describe any case. "The worst-case running time of linear search is O(n)" is a complete statement. "Linear search is O(n)" leaves the reader to assume which case is meant.

- **Worst case** is the most work over all inputs of size n. It is the usual default, because it is a guarantee.
- **Best case** is the least work over all inputs of size n. It is rarely useful alone, since almost every algorithm has some easy input.
- **Average case** is the expected work over a stated distribution of inputs. It means nothing until the distribution is named.

A fourth measure applies to algorithms that make random choices of their own. Their **expected running time** averages over those choices for a fixed input, so it holds for every input, with no assumption about how inputs are distributed.

| Algorithm | Best case | Average case | Worst case |
| --- | --- | --- | --- |
| Linear search | Θ(1), target is first | Θ(n), target at a uniformly random position | Θ(n), target is last or absent |
| Insertion sort | Θ(n), input already sorted | Θ(n²), input in random order | Θ(n²), input reverse-sorted |
| Quicksort | Θ(n log n) | Θ(n log n), input in random order | Θ(n²), every split maximally uneven |
| Hash table lookup | Θ(1) | Θ(1), keys spread evenly and the table resized to keep it from filling | Θ(n), every key in the same slot |

Quicksort splits the input around one chosen element, the pivot, then sorts each side. It shows why the case has to be named. "Quicksort is O(n log n)" is true of its average case and false of its worst. Choosing the pivot at random changes the kind of guarantee rather than the worst case. The expected running time becomes Θ(n log n) on every input, though an unlucky run can still take Θ(n²).

---

## Analyzing Code

### Drop Constants and Lower-Order Terms

3n + 5 becomes O(n), n²/2 + n becomes O(n²), and n log n + n becomes O(n log n). The formal definitions already absorb constant multipliers, and for large n the highest-order term dominates everything else.

### Read the Loop Structure

These rules assume the loop body does a constant amount of work.

- A loop over n elements is O(n).
- Two nested loops, each over n elements, are O(n²).
- A loop whose counter halves or doubles each iteration is O(log n).
- Blocks that run one after another add, and the largest term wins. An O(n) loop followed by an O(n²) loop is O(n²).

```csharp
// O(n): one pass
for (int i = 0; i < n; i++) { /* constant work */ }

// O(n²): nested passes over the same input
for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++) { /* constant work */ }

// O(log n): the counter halves each iteration
for (int i = n; i > 1; i /= 2) { /* constant work */ }
```

The assumption breaks more often than it looks, because a library call can hide a loop. `List<T>.Contains`, `IndexOf`, and `Insert(0, item)` each scan or shift the whole list, so one inside a loop makes the loop O(n²). Building a string with `+=` in a loop does the same, since each concatenation copies everything built so far.

```csharp
// Looks like one loop, but Contains scans the list each time: O(n²)
var unique = new List<int>();
foreach (int x in items)
    if (!unique.Contains(x))
        unique.Add(x);

// The same result in O(n) on average: HashSet<T>.Add is O(1) on average
var seen = new HashSet<int>();
var uniqueFast = new List<int>();
foreach (int x in items)
    if (seen.Add(x))                         // Add returns false if x was already present
        uniqueFast.Add(x);
```

Most .NET collection methods state their cost in the documentation's Remarks section, so check it for anything called inside a loop.

### Give Different Inputs Different Variables

Two inputs of independent sizes need two variables. The loops below are O(a × b), not O(n²), and treating them as O(n²) hides the fact that a small `arrayA` keeps the cost low however large `arrayB` grows.

```csharp
for (int i = 0; i < arrayA.Length; i++)      // a iterations
{
    for (int j = 0; j < arrayB.Length; j++)  // b iterations
    {
        // constant work
    }
}
```

### Sum a Recursion Level by Level

A recursive function's calls form a recursion tree. The first call sits at the top, and below each call are the calls it makes. When every call does the same constant amount of work, the cost is just the number of calls. When the work per call varies, sum the work one level of the tree at a time instead.

Merge sort is the standard case. Each call splits its input in half and makes two calls, so the input size halves at each level and the tree has log₂ n levels of merging. The calls on one level split the whole input between them, so the merges on each level handle n elements in total. log₂ n levels of n work each give O(n log n). Multiplying the number of calls (about 2n) by the largest work per call (n) would give O(n²), a correct but badly loose bound.

{% endraw %}
{% include figure.html id="dsa-merge-sort-recursion-tree" %}
{% raw %}

Four recursive shapes cover most cases:

| Recursive shape | Cost | Example |
| --- | --- | --- |
| One call on n − 1, constant work per call | O(n) | Recursive factorial |
| Calls on n − 1 and n − 2, constant work per call | O(2ⁿ), a loose bound | Naive Fibonacci |
| One call on n/2, constant work per call | O(log n) | Recursive binary search |
| Two calls on n/2, linear work to combine | O(n log n) | Merge sort |

---

## Space Complexity

Space complexity uses the same notation for memory. Auxiliary space is the extra memory an algorithm allocates beyond its input, and total space includes the input. Most analyses quote auxiliary space, since the input exists either way.

Recursion uses space even when it allocates nothing. Each active call holds a stack frame, so the maximum recursion depth counts toward auxiliary space.

```csharp
// O(1) auxiliary space: a fixed number of variables
public static int Sum(int[] array)
{
    int total = 0;
    foreach (int num in array) total += num;
    return total;
}

// O(n) auxiliary space: a new array the size of the input
public static int[] CopyArray(int[] original)
{
    int[] copy = new int[original.Length];
    Array.Copy(original, copy, original.Length);
    return copy;
}

// O(n) auxiliary space: n stack frames active at the deepest point
public static long Factorial(int n)
{
    if (n <= 1) return 1;
    return n * Factorial(n - 1);
}
```

---

## Amortized Analysis

Some operations are usually cheap and occasionally expensive. Amortized analysis bounds the total cost of a worst-case sequence of operations and divides by the number of operations. It involves no probability. Unlike average-case analysis, it assumes nothing about how inputs are distributed, so an amortized bound is a guarantee.

A dynamic array that doubles its capacity when full is the standard example. An append that finds the array full copies every element first, so one append can cost O(n). But the copies across n appends add up to less than 2n, so n appends cost O(n) in total and O(1) amortized each.

There are three standard ways to reach an amortized bound:

| Method | How it assigns cost |
| --- | --- |
| Aggregate | Bound the total cost of n operations, then divide by n. The doubling argument above is an aggregate argument. |
| Accounting | Charge each cheap operation a little more than it costs and bank the surplus as credit that pays for later expensive operations. The bank must never go negative. For the doubling array, charging 3 per append works: 1 writes the element, and 2 are banked to pay for copying it and one older element at the next doubling. |
| Potential | Define a potential function Φ, a number computed from the structure's state that never falls below its starting value. The amortized cost of an operation is its actual cost plus the change in Φ. For a doubling array that starts empty and grows to capacities 1, 2, 4, and so on, Φ = 2 × count − capacity rises by 2 on each cheap append and drops to pay for each copy, so every append costs 3 amortized. |

---

## Practical Input Limits

Growth rate translates into a rough ceiling on input size. The table assumes a budget of about one second at roughly 10⁸ simple operations per second, a common rule of thumb. Constant factors and memory access patterns can move these limits by an order of magnitude in either direction, so treat them as estimates of scale, not thresholds.

| Growth rate | Largest n that fits, roughly |
| --- | --- |
| O(1), O(log n) | Effectively unlimited |
| O(n) | 10⁸ |
| O(n log n) | 10⁶ to 10⁷ |
| O(n²) | 10⁴ |
| O(n³) | 500 |
| O(2ⁿ) | 25 |
| O(n!) | 11 |

---

## Common Misconceptions

- **A better growth rate always wins.** For small n, a simple O(n²) algorithm can beat an O(n log n) one because its constant factor is smaller. `Array.Sort` and `List<T>.Sort` switch to insertion sort, which is O(n²) in the worst case, for subarrays of 16 elements or fewer for this reason.
- **O(n log n) is much slower than O(n).** log₂ n is about 20 at a million items, so the gap is a factor of about 20, and constant factors often matter as much.
- **Two algorithms with the same Big O are equally fast.** Big O drops constant factors, so two O(n) algorithms can differ in speed by a factor of 100.

{% endraw %}
