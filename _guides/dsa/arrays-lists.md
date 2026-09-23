---
title: "Arrays & Dynamic Arrays"
layout: guide
category: Data Structures & Algorithms
subcategory: Core Data Structures
description: "Why array indexing is O(1), what a dynamic array like List<T> does when it grows and why appending is still O(1) amortized, and the two pointers and sliding window techniques that make array problems linear."
tags: [arrays, dynamic-arrays, list, amortized-analysis, two-pointers, sliding-window, fundamentals]
---
{% raw %}

## Why Array Indexing Is O(1)

An array stores its elements side by side in one contiguous block of memory, and every element has the same size. So the address of element i is a single calculation: the start of the block plus i times the element size. Reading `numbers[500_000]` costs the same arithmetic as reading `numbers[0]`, and nothing is searched or followed along the way.

Contiguity also makes arrays fast in practice, beyond their Big O. A CPU reads memory in fixed-size chunks called cache lines, commonly 64 bytes, and keeps recently read lines in a small, fast cache. When code walks an array in order, one memory read brings in the next several elements too, so a sequential scan rarely waits on main memory. Structures that scatter their elements across memory, like linked lists, lose this advantage even when their Big O is the same.

---

## Fixed-Size Arrays in C#

A C# array such as `int[]` has a length fixed when it is created. It lives on the managed heap, its elements start at their default value (0 for `int`, `null` for reference types), and every index is bounds-checked. An out-of-range index throws `IndexOutOfRangeException` instead of reading whatever memory lies past the end.

```csharp
int[] numbers = new int[5];        // [0, 0, 0, 0, 0]
int[] primes = { 2, 3, 5, 7, 11 };  // Length fixed at 5

numbers[0] = 100;
Console.WriteLine(numbers.Length);  // 5
Console.WriteLine(primes[4]);       // 11
```

"Growing" a fixed-size array means allocating a larger one and copying the elements across. `Array.Resize` does exactly that, and it costs O(n) every time.

---

## Operation Costs

| Operation | Fixed-size array | Dynamic array (`List<T>`) | Why |
| --- | --- | --- | --- |
| Read or write by index | O(1) | O(1) | Address arithmetic |
| Search an unsorted array | O(n) | O(n) | Every element may need checking |
| Append at the end | Not possible | O(1) amortized, O(n) worst case | A full array must be copied first |
| Insert at the front or middle | Not possible | O(n) | Every later element shifts right |
| Remove from the end | Not possible | O(1) | Nothing shifts |
| Remove from the front or middle | Not possible | O(n) | Every later element shifts left |

The O(n) cost of inserting or removing in the middle comes from shifting, not from finding the spot. Removing index 0 from a million-element `List<T>` moves 999,999 elements.

---

## Dynamic Arrays

A dynamic array keeps a fixed-size array internally, called its backing array, that is usually larger than the number of elements stored. The count is how many slots are in use, and the capacity is the backing array's length. Appending writes into the next free slot. When no slot is free, the dynamic array allocates a larger backing array, copies every element into it, and discards the old one.

```csharp
public class DynamicArray<T>
{
    private T[] _items = new T[4];
    private int _count;

    public int Count => _count;
    public int Capacity => _items.Length;

    public T this[int index]
    {
        get
        {
            if ((uint)index >= (uint)_count) throw new ArgumentOutOfRangeException(nameof(index));
            return _items[index];
        }
        set
        {
            if ((uint)index >= (uint)_count) throw new ArgumentOutOfRangeException(nameof(index));
            _items[index] = value;
        }
    }

    public void Add(T value)
    {
        if (_count == _items.Length)
            Grow();

        _items[_count++] = value;
    }

    public void Insert(int index, T value)
    {
        if ((uint)index > (uint)_count) throw new ArgumentOutOfRangeException(nameof(index));

        if (_count == _items.Length)
            Grow();

        Array.Copy(_items, index, _items, index + 1, _count - index);  // Shift right
        _items[index] = value;
        _count++;
    }

    public void RemoveAt(int index)
    {
        if ((uint)index >= (uint)_count) throw new ArgumentOutOfRangeException(nameof(index));

        _count--;
        Array.Copy(_items, index + 1, _items, index, _count - index);  // Shift left
        _items[_count] = default!;  // Release the reference so the GC can collect it
    }

    private void Grow()
    {
        var larger = new T[_items.Length * 2];
        Array.Copy(_items, larger, _count);
        _items = larger;
    }
}
```

The `(uint)` casts fold "index is negative" and "index is too large" into one comparison, because a negative `int` becomes a very large `uint`. `List<T>` uses the same trick.

### How List&lt;T&gt; Grows

`List<T>` is .NET's dynamic array, and its growth policy is visible in the `dotnet/runtime` source. A new `List<T>` starts with capacity 0 and no backing array to speak of. The first `Add` allocates capacity 4, and every growth after that doubles the capacity, up to the runtime's maximum array length.

Two members control the copying directly:

- **A starting capacity.** `new List<T>(capacity)` or `EnsureCapacity(n)` allocates once, up front, when the final size is known. Loading a million items into a list created with that capacity skips about 18 grow-and-copy steps.
- **`TrimExcess()`** shrinks the backing array to fit the count. After growth by doubling, up to about half the capacity can sit unused. `List<T>` never shrinks on its own, even when elements are removed.

---

## Why Appending Is O(1) Amortized

An append that finds the backing array full costs O(n), because it copies every element. Appending is still O(1) amortized, because doubling makes those copies rare and each copy pays for many cheap appends that follow it.

Follow a dynamic array that starts at capacity 4 through 33 appends. Appends 5, 9, 17, and 33 each find the array full and copy 4, 8, 16, and 32 elements first. Every other append writes one element. The copies total 4 + 8 + 16 + 32 = 60, so all 33 appends cost 33 writes plus 60 copies, which is 93, or about 2.8 per append.

{% endraw %}
{% include figure.html id="dsa-dynamic-array-appends" %}
{% raw %}

The pattern holds at any size. Each copy moves as many elements as the one before it combined, plus the initial capacity, so the copies over n appends always total less than 2n. That keeps the average cost per append below 3 no matter how many appends run, even though the single append that triggers a copy is O(n).

The growth factor is what makes this work. A dynamic array that grew by a fixed amount, say 10 slots at a time, would copy every 10 appends, and its copies would total about n²/20, which makes each append O(n) amortized. Any constant growth factor above 1 keeps appends O(1) amortized. Doubling is a common choice because it keeps the arithmetic simple and wastes at most half the capacity.

---

## Two Pointers

The two pointers technique walks an array with two indices instead of one, and uses what it knows about the array, usually that it is sorted, to move one index at a time. Many problems whose obvious solution checks every pair in O(n²) drop to O(n) this way.

### Moving Toward Each Other

To find two numbers in a sorted array that add up to a target, the brute-force approach checks every pair. With one index at each end, each comparison rules out a whole row of pairs instead. If the sum is too small, no pair using the left element can reach the target, because the right element is already the largest available, so the left index moves right. If the sum is too large, the right index moves left by the same argument.

```csharp
public static (int, int)? PairWithSum(int[] sorted, int target)
{
    int left = 0, right = sorted.Length - 1;

    while (left < right)
    {
        int sum = sorted[left] + sorted[right];

        if (sum == target) return (left, right);
        if (sum < target) left++;
        else right--;
    }

    return null;
}

int[] values = { 1, 3, 4, 6, 8, 11 };
Console.WriteLine(PairWithSum(values, 10));  // (2, 3): 4 + 6
```

Each iteration moves one index one step closer to the other, so the loop runs at most n − 1 times. The approach depends on the array being sorted.

### Moving in the Same Direction

A read index and a write index can move in the same direction to rewrite an array in place. Removing duplicates from a sorted array keeps a write index at the end of the unique prefix and copies each new value there as the read index finds it:

```csharp
public static int RemoveDuplicatesSorted(int[] sorted)
{
    if (sorted.Length == 0)
        return 0;

    int write = 1;

    for (int read = 1; read < sorted.Length; read++)
    {
        if (sorted[read] != sorted[read - 1])
            sorted[write++] = sorted[read];
    }

    return write;  // Length of the unique prefix
}

int[] data = { 1, 1, 2, 2, 2, 3, 4, 4, 5 };
int length = RemoveDuplicatesSorted(data);
Console.WriteLine(string.Join(", ", data.Take(length)));  // 1, 2, 3, 4, 5
```

This is O(n) time and O(1) extra space. Merging two sorted arrays works the same way, with one read index per input and a write index into the output.

---

## Sliding Window

A sliding window is a special case of two pointers where the two indices mark the start and end of a contiguous range. The window moves across the array while the code keeps a running summary of what is inside it, updating that summary as elements enter and leave instead of recomputing it from scratch.

### Fixed-Size Windows

The largest sum of k consecutive elements needs k additions for the first window. After that, each slide adds the element entering on the right and subtracts the one leaving on the left, which takes O(n) in total instead of O(n × k).

```csharp
public static int? MaxSumOfWindow(int[] values, int k)
{
    if (k <= 0 || values.Length < k)
        return null;

    int windowSum = 0;
    for (int i = 0; i < k; i++)
        windowSum += values[i];

    int maxSum = windowSum;

    for (int i = k; i < values.Length; i++)
    {
        windowSum += values[i] - values[i - k];  // Add the entering element, drop the leaving one
        maxSum = Math.Max(maxSum, windowSum);
    }

    return maxSum;
}

Console.WriteLine(MaxSumOfWindow(new[] { 2, 1, 5, 1, 3, 2 }, 3));  // 9, from 5 + 1 + 3
```

### Variable-Size Windows

When the window's size depends on its contents, the right edge grows the window and the left edge shrinks it whenever a condition breaks. Finding the shortest run of positive numbers whose sum reaches a target works this way. Neither edge ever moves backward, so each element enters and leaves the window at most once, and the whole scan is O(n).

```csharp
public static int ShortestWindowWithSum(int[] positives, int target)
{
    int best = int.MaxValue, windowSum = 0, left = 0;

    for (int right = 0; right < positives.Length; right++)
    {
        windowSum += positives[right];

        while (windowSum >= target)
        {
            best = Math.Min(best, right - left + 1);
            windowSum -= positives[left++];
        }
    }

    return best == int.MaxValue ? 0 : best;  // 0 means no window reaches the target
}

Console.WriteLine(ShortestWindowWithSum(new[] { 2, 3, 1, 2, 4, 3 }, 7));  // 2, from 4 + 3
```

Shrinking from the left is only safe because every value is positive. If values could be negative, removing an element could raise the sum, and the window's logic would no longer hold.

---

## Multi-Dimensional Arrays

C# has two kinds of multi-dimensional array, and they are laid out differently in memory.

| Kind | Declaration | Layout | Rows |
| --- | --- | --- | --- |
| Rectangular | `int[,] grid = new int[3, 4];` | One contiguous block, stored row by row | All the same length |
| Jagged | `int[][] rows = new int[3][];` | An array of references to separate one-dimensional arrays | Each row can have its own length |

```csharp
int[,] grid = { { 1, 2, 3 }, { 4, 5, 6 } };
Console.WriteLine(grid[1, 2]);           // 6
Console.WriteLine(grid.GetLength(0));    // 2 rows
Console.WriteLine(grid.GetLength(1));    // 3 columns

int[][] triangle = new int[3][];
for (int i = 0; i < triangle.Length; i++)
    triangle[i] = new int[i + 1];        // Rows of length 1, 2, and 3
```

A rectangular array's element address is still a single calculation, row × column count + column. A jagged array needs two lookups, one to find the row's array and one within it. Because rectangular arrays are stored row by row, a loop that walks each row in order reads memory sequentially, while a loop that walks down columns jumps a full row's width on every step.

---

## Worked Example: Rotate an Array in Place

Rotating an array right by k positions moves the last k elements to the front. The direct approach copies into a new array, which is O(n) extra space. Three reversals do it in place with O(1) extra space: reverse the whole array, then reverse the first k elements, then reverse the rest.

```csharp
public static void RotateRight(int[] values, int k)
{
    int n = values.Length;
    if (n == 0) return;

    k %= n;  // Rotating by n is a no-op
    Reverse(values, 0, n - 1);
    Reverse(values, 0, k - 1);
    Reverse(values, k, n - 1);
}

private static void Reverse(int[] values, int start, int end)
{
    while (start < end)
    {
        (values[start], values[end]) = (values[end], values[start]);
        start++;
        end--;
    }
}

int[] items = { 1, 2, 3, 4, 5, 6, 7 };
RotateRight(items, 3);
Console.WriteLine(string.Join(", ", items));  // 5, 6, 7, 1, 2, 3, 4
```

Reversing the whole array puts the last k elements at the front, but backward, and the first n − k at the back, also backward. The two smaller reversals put each group back in order. The `Reverse` helper is itself two pointers moving toward each other.

---

## Arrays in Practice

`List<T>` is the default collection in C# for good reason. It has O(1) indexing, amortized O(1) appends, sequential memory for cache-friendly scans, and a growth policy that is tuned and tested. Plain arrays fit when the size is fixed and known, as with lookup tables, buffers, and interop with native code, or when the extra indirection of `List<T>` measurably matters.

An array is the wrong choice when the workload inserts or removes near the front or middle of a large collection, because every such operation shifts the elements after it. It is also a poor fit for "is this value present" checks on a large collection, which cost O(n) per lookup in an array and O(1) on average in a hash-based set.

{% endraw %}
