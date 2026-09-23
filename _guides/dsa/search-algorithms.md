---
title: "Search Algorithms"
layout: guide
category: Data Structures & Algorithms
subcategory: Algorithms
description: "When a linear scan is the right search, how binary search finds a value in sorted data in O(log n) and how to keep its boundaries correct, the lower-bound and upper-bound variants, what Array.BinarySearch returns, binary search over an answer instead of an array, rotated sorted arrays, and how to choose between scanning, sorting, and hashing."
tags: [searching, binary-search, linear-search, lower-bound, practical]
---
{% raw %}

## Why Sorted Data Changes Search

Finding a value in a collection that has no order means looking at elements until one matches. Nothing about one element says anything about where the others are, so in the worst case every element gets checked. Sorted order changes that. One comparison against the middle element says which half the target must be in, and the other half never needs to be looked at. That difference, n comparisons against about log₂ n, is 1,000,000 against 20 for a million elements.

Sorting isn't free, though, and a hash table can beat both approaches for plain membership checks. Choosing a search starts with how the data is stored and how many times it will be searched.

---

## Linear Search

Linear search checks each element in turn and stops at the first match. It needs nothing from the data: no order, no hash codes, no preparation.

```csharp
public static int IndexOf<T>(T[] values, T target)
{
    var comparer = EqualityComparer<T>.Default;

    for (int i = 0; i < values.Length; i++)
    {
        if (comparer.Equals(values[i], target))
            return i;
    }

    return -1;  // Not found
}
```

| Case | Comparisons | When it happens |
| --- | --- | --- |
| Best | 1 | The target is the first element |
| Worst | n | The target is last or absent |
| Average, target present | About n / 2 | The target is equally likely to be anywhere |

The average is still Θ(n), because halving n is a constant factor. Linear search uses O(1) extra space.

It is the right tool more often than its cost suggests. It is the cheapest option for unsorted data searched once, since sorting first costs more than one scan. It handles conditions that aren't equality, such as the first order over $500, and it finds every match rather than one. On small arrays it can match or beat binary search in practice, so measure before assuming otherwise.

.NET's linear searches are `Array.IndexOf`, `List<T>.IndexOf`, `List<T>.Contains`, `FindIndex`, and LINQ's `First`, `Any`, and `Where`. [Microsoft's documentation for `List<T>.Contains`](https://learn.microsoft.com/dotnet/api/system.collections.generic.list-1.contains){:target="_blank" rel="noopener noreferrer"} states that it performs a linear search, making it O(n). A loop that calls `Contains` on a large list for every element of another list is O(n × m), which is the usual reason to switch to a `HashSet<T>`.

---

## Binary Search

Binary search finds a value in a sorted array by comparing it with the middle of the range that could still hold it. If the middle element is smaller than the target, the target can only be to its right, so the left half is ruled out. If it is larger, the right half is ruled out. Each comparison halves the range, and the search ends when the middle element matches or the range is empty.

{% endraw %}
{% include figure.html id="dsa-binary-search-steps" %}
{% raw %}

```csharp
public static int BinarySearch(int[] sorted, int target)
{
    int left = 0, right = sorted.Length - 1;  // The target, if present, is in sorted[left..right]

    while (left <= right)
    {
        int mid = left + (right - left) / 2;  // Not (left + right) / 2, which can overflow

        if (sorted[mid] == target)
            return mid;
        if (sorted[mid] < target)
            left = mid + 1;                   // Everything up to mid is too small
        else
            right = mid - 1;                  // Everything from mid on is too large
    }

    return -1;  // The range is empty
}

int[] values = { 3, 8, 12, 17, 21, 25, 30, 34, 41, 47, 52, 58, 63, 70, 77 };
Console.WriteLine(BinarySearch(values, 63));  // 12
Console.WriteLine(BinarySearch(values, 60));  // -1
```

### The Invariant That Keeps It Correct

Binary search is short, and it is easy to get wrong by one position. The reliable way to write it is to state what the two indices mean and keep that statement true. Here, it is "if the target is in the array at all, it is somewhere in `sorted[left..right]`, both ends included."

Every line follows from that sentence. The range starts as the whole array, so `right` is `Length - 1`. The loop runs while the range holds at least one element, so the condition is `left <= right`. After checking `mid`, the target can't be at `mid`, so the new bound is `mid + 1` or `mid - 1`, never `mid` itself. Setting `left = mid` instead can leave the range unchanged and loop forever.

The midpoint is computed as `left + (right - left) / 2`, because `left + right` can exceed `int.MaxValue` on arrays with more than about a billion elements and wrap to a negative index. [Joshua Bloch reported in 2006](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/){:target="_blank" rel="noopener noreferrer"} that the JDK's own binary search carried this bug for years before anyone hit an array large enough to trigger it.

### Why It Is O(log n)

Here a comparison means one pass of the loop, one probe at a middle element. A range of n elements halves on every probe that misses, so after k probes at most n / 2ᵏ elements remain. The range empties once 2ᵏ exceeds n, which takes at most ⌊log₂ n⌋ + 1 comparisons. That is 4 for the 15 values in the figure, 20 for a million, and 31 for two billion. The best case is 1, when the first middle element matches. The iterative version uses O(1) extra space.

### A Recursive Version

The same logic reads naturally as recursion, with the range passed as parameters:

```csharp
public static int BinarySearchRecursive(int[] sorted, int target, int left, int right)
{
    if (left > right)
        return -1;

    int mid = left + (right - left) / 2;

    if (sorted[mid] == target) return mid;
    return sorted[mid] < target
        ? BinarySearchRecursive(sorted, target, mid + 1, right)
        : BinarySearchRecursive(sorted, target, left, mid - 1);
}

Console.WriteLine(BinarySearchRecursive(values, 63, 0, values.Length - 1));  // 12
```

Its depth is at most about log₂ n, so stack space is no concern. The loop is still the usual form in C#, since it avoids a call per step, and C# doesn't guarantee that the recursion becomes a loop.

---

## Finding Boundaries: Lower and Upper Bound

The version above returns some index holding the target. With duplicates, that could be any one of them, and when the target is absent it returns only -1. Many real questions need more: the first occurrence, the last one, how many there are, or where a missing value would be inserted to keep the array sorted. Two variants answer all of them.

- **Lower bound** is the first index whose value is at least the target.
- **Upper bound** is the first index whose value is greater than the target.

Both return `Length` when no element qualifies, which is exactly the insertion point at the end.

```csharp
public static int LowerBound(int[] sorted, int target)
{
    int left = 0, right = sorted.Length;  // The answer is in [left, right], and right may be Length

    while (left < right)
    {
        int mid = left + (right - left) / 2;

        if (sorted[mid] < target)
            left = mid + 1;               // mid is too small to be the answer
        else
            right = mid;                  // mid might be the answer, so keep it in range
    }

    return left;  // left == right: the one remaining candidate
}

// Upper bound is the same loop with one comparison changed
public static int UpperBound(int[] sorted, int target)
{
    int left = 0, right = sorted.Length;

    while (left < right)
    {
        int mid = left + (right - left) / 2;

        if (sorted[mid] <= target)
            left = mid + 1;
        else
            right = mid;
    }

    return left;
}
```

The invariant differs from the exact-match version. The answer is always one of the indices from `left` to `right`, and `right` starts at `Length` because "no element qualifies" is a valid answer. When `mid` might be the answer, `right = mid` keeps it in range rather than skipping past it. The loop stops when one candidate is left, so there is no separate "found" case.

Here is `LowerBound` finding the first 2 in `{ 1, 2, 2, 2, 3, 5 }`:

| left | right | mid | sorted[mid] | Step |
| --- | --- | --- | --- | --- |
| 0 | 6 | 3 | 2 | Not less than 2, so it might be the answer: `right = 3` |
| 0 | 3 | 1 | 2 | Not less than 2 again: `right = 1` |
| 0 | 1 | 0 | 1 | Less than 2, so it can't be the answer: `left = 1` |
| 1 | 1 | | | One candidate left: index 1 |

Each time `mid` holds a 2, the range shrinks toward it without dropping it, which is why the loop lands on the first 2 rather than any 2.

For the same array:

| Target | Lower bound | Upper bound | What it means |
| --- | --- | --- | --- |
| 2 | 1 | 4 | First 2 at index 1, last at 3, three of them |
| 4 | 5 | 5 | Absent, and inserting it at index 5 keeps the order |
| 0 | 0 | 0 | Smaller than everything, so it would go first |
| 9 | 6 | 6 | Larger than everything, so it would go at the end |

The first occurrence is the lower bound, provided it is less than `Length` and the value there equals the target. The last occurrence is the upper bound minus one, under the same check. The count is the upper bound minus the lower bound, and for a ≤ b the number of values in the range [a, b] is `UpperBound(b) - LowerBound(a)`. Each costs O(log n) whatever the number of duplicates.

---

## Binary Search in .NET

`Array.BinarySearch`, `List<T>.BinarySearch`, and `MemoryExtensions.BinarySearch` for spans implement binary search, each with overloads that take an `IComparer<T>`. The collection must already be sorted by the same comparison. [Microsoft's documentation](https://learn.microsoft.com/dotnet/api/system.array.binarysearch){:target="_blank" rel="noopener noreferrer"} warns that on unsorted data the result can be wrong, including a negative return for a value that is present, and nothing checks for it.

The return value packs two answers into one `int`:

- **Found.** The index of a matching element. With duplicates, the documentation says it is one of them, not necessarily the first. .NET has no built-in first-occurrence search, so code that needs the first match uses a lower bound like the one above.
- **Not found.** A negative number. Its bitwise complement, `~result`, is the index of the first element larger than the target, or `Length` if there is none, which is the lower bound.

The complement is used instead of negation because a miss at index 0 would negate to 0, indistinguishable from a hit at index 0, while `~i` equals `-(i + 1)` and is always negative.

```csharp
int[] prices = { 10, 20, 30, 40 };

int hit = Array.BinarySearch(prices, 30);
Console.WriteLine(hit);    // 2

int miss = Array.BinarySearch(prices, 25);
Console.WriteLine(miss);   // -3
Console.WriteLine(~miss);  // 2: 25 belongs before 30

var sortedList = new List<int>(prices);
int at = sortedList.BinarySearch(35);
if (at < 0)
    sortedList.Insert(~at, 35);  // Keeps the list sorted
```

Inserting this way finds the position in O(log n), but `List<T>.Insert` still shifts every later element, so each insert is O(n). A collection that takes many inserts and stays sorted is better served by a balanced tree such as `SortedSet<T>`, provided the values are distinct, since a set keeps only one of each.

---

## Binary Search on an Answer

Binary search doesn't need an array. It needs a yes-or-no question whose answer switches exactly once as a number grows, from no to yes or from yes to no. Any question with that shape can be binary searched over the range of possible numbers, with the question standing in for the array lookup.

Consider packages with given weights that must ship in their listed order within a set number of days, and each day's load can't exceed the ship's capacity. What is the smallest capacity that works? Checking one capacity is easy. Load each day as full as possible and count the days. Filling a day fully never forces an extra day later, so this greedy count is the true minimum for that capacity. If a capacity works, every larger capacity also works, so the answers run no, no, ..., no, yes, yes, ..., yes, and the goal is the first yes. That is a lower bound over capacities.

```csharp
public static int MinShipCapacity(int[] weights, int days)
{
    if (days <= 0)
        throw new ArgumentOutOfRangeException(nameof(days));
    if (weights.Length == 0)
        return 0;

    int low = weights.Max();   // Too small below this: the heaviest package wouldn't fit
    int high = weights.Sum();  // Always works: everything ships on day one

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (DaysNeeded(weights, mid) <= days)
            high = mid;        // mid works, so the answer is mid or smaller
        else
            low = mid + 1;     // mid fails, so the answer is larger
    }

    return low;
}

private static int DaysNeeded(int[] weights, int capacity)
{
    int days = 1, load = 0;

    foreach (int weight in weights)
    {
        if (load + weight > capacity)
        {
            days++;            // Start a new day with this package
            load = 0;
        }
        load += weight;
    }

    return days;
}

Console.WriteLine(MinShipCapacity(new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 }, 5));  // 15
```

The code assumes non-negative weights whose total fits in an `int`, and LINQ's `Sum` throws on overflow. Each check is O(n), and the search makes O(log S) checks, where S is the total weight, so the whole search is O(n log S). Trying every capacity from the heaviest package upward would be O(n × S).

### When the Goal Is the Last Yes

Some questions switch the other way, yes, yes, ..., yes, no, no, and the goal is the largest number that still works. The integer square root of n, the largest x with x² ≤ n, is one. The loop mirrors the first-yes version, with one change that matters:

```csharp
public static int IntegerSqrt(int n)
{
    if (n < 0)
        throw new ArgumentOutOfRangeException(nameof(n));

    int low = 0, high = Math.Min(n, 46_340);  // 46,340² is the largest square that fits in an int

    while (low < high)
    {
        int mid = low + (high - low + 1) / 2;  // Round up
        if (mid * mid <= n)
            low = mid;                         // mid works, so the answer is mid or larger
        else
            high = mid - 1;                    // mid fails, so the answer is smaller
    }

    return low;
}

Console.WriteLine(IntegerSqrt(26));  // 5
```

The midpoint rounds up. With `high = low + 1`, rounding down would pick `mid = low`, and when it works, `low = mid` changes nothing and the loop never ends. Rounding up always moves one bound. The same first-yes or last-yes pattern finds the smallest time by which a set of jobs can finish, or the largest minimum gap when placing items along a line. The work is in spotting that the question has a single switch point and which side of it the answer is on.

---

## Searching a Rotated Sorted Array

A sorted array that has been rotated, such as `{ 40, 50, 60, 10, 20, 30 }`, is no longer sorted as a whole, yet binary search still works on it in O(log n). It is two ascending runs with one drop between them, so cutting it at any midpoint leaves at least one half sorted. In the example, the code's first midpoint is index 2, holding 60. The left half, `40, 50, 60`, is sorted, and the right half, `60, 10, 20, 30`, holds the drop. Both halves include the midpoint. Comparing the ends of the sorted half says whether the target is inside it. That is enough to rule out one half per step, which is all binary search ever needed.

{% endraw %}
{% include figure.html id="dsa-rotated-array" %}
{% raw %}

```csharp
public static int SearchRotated(int[] values, int target)
{
    int left = 0, right = values.Length - 1;

    while (left <= right)
    {
        int mid = left + (right - left) / 2;
        if (values[mid] == target)
            return mid;

        if (values[left] <= values[mid])                         // Left half is sorted
        {
            if (values[left] <= target && target < values[mid])
                right = mid - 1;                                 // Target is inside the sorted left half
            else
                left = mid + 1;
        }
        else                                                     // Right half is sorted
        {
            if (values[mid] < target && target <= values[right])
                left = mid + 1;                                  // Target is inside the sorted right half
            else
                right = mid - 1;
        }
    }

    return -1;
}

Console.WriteLine(SearchRotated(new[] { 40, 50, 60, 10, 20, 30 }, 20));  // 4
```

This version assumes distinct values. With duplicates, `values[left] == values[mid]` can't say which half is sorted, and this code can miss a value that is present. The usual fix shrinks the range by one element whenever `values[left] == values[mid]`, and that version is O(n) in the worst case. An array of identical values with one different element hidden somewhere shows why: every probe looks the same, so nothing rules out either half.

---

## Choosing a Search Strategy

| Approach | Preparation | Each lookup | What it can answer |
| --- | --- | --- | --- |
| Linear search | None | O(n) worst case | Equality or any condition, all matches, unsorted data |
| Sort, then binary search | O(n log n), once | O(log n) worst case | Exact match, first and last occurrence, nearest value, counts in a range |
| `HashSet<T>` or `Dictionary<TKey,TValue>` | O(n) on average | O(1) on average | Exact match only |
| Balanced tree, such as `SortedSet<T>` | O(n log n) | O(log n) worst case | Exact match, nearest value, and enumerating a range, on distinct keys. Unlike a sorted array, it also inserts and removes in O(log n) |

The number of searches decides between the first two rows. k linear searches cost about k × n comparisons, while sorting and then binary searching cost about n log₂ n + k log₂ n. Sorting pays for itself after roughly log₂ n searches, which is about 20 for a million elements. For a one-off lookup, scan. For repeated lookups on data that rarely changes, sort once.

A hash set beats binary search for plain "is it there" questions, but it keeps no order. Finding the nearest value, counting the values between two bounds, or locating where a new value belongs all need order, which sorted data and binary search provide and a hash set can't.

{% endraw %}
