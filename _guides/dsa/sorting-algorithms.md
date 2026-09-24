---
title: "Sorting Algorithms"
layout: guide
category: Data Structures & Algorithms
subcategory: Algorithms
description: "How insertion sort, merge sort, quicksort, and heap sort work and what each costs, what stability and in-place mean, why no comparison sort beats O(n log n) in the worst case, how counting and radix sort avoid comparisons, and what .NET's Array.Sort, List<T>.Sort, and LINQ's OrderBy actually do."
tags: [sorting, merge-sort, quicksort, heap-sort, sort-stability, practical]
---
{% raw %}

## Why Sorting Matters

Sorted data makes other work cheap. Binary search finds a value in O(log n) in the worst case. Duplicates end up next to each other, so one pass finds them. Two sorted lists merge in one pass, and "every value between a and b" is a contiguous slice. Many algorithms start by sorting for exactly these reasons.

Production code nearly always calls a library sort, and it should. Knowing how the main algorithms work still matters, because their differences show up as real behavior: whether equal elements keep their order, how much memory a sort needs, and which inputs make it slow.

---

## Two Properties Besides Speed

**Stability.** A sort is stable when elements that compare as equal keep their original relative order. Stability matters when records are sorted by one field and already carry an order in another. Sort orders by date, then stable-sort them by customer, and each customer's orders stay in date order. An unstable sort may shuffle them.

**In place.** A sort is in place when it needs only O(1) or O(log n) memory beyond the array, instead of a second array of size n. In-place sorts matter when the data is large relative to available memory.

None of the three classic O(n log n) sorts is worst-case O(n log n), stable, and in place all at once. Merge sort gives up in-place, quicksort gives up the worst case and stability, and heap sort gives up stability. Stable in-place merge sorts do exist, but they are complex and seldom used in standard libraries. That trade-off is why all three classic algorithms survive.

---

## The Simple Sorts

### Insertion Sort

Insertion sort grows a sorted prefix one element at a time. It takes the next element and shifts larger elements in the prefix one slot right until the element's place opens up, the way many people sort a hand of cards.

```csharp
public static void InsertionSort(int[] values)
{
    for (int i = 1; i < values.Length; i++)
    {
        int current = values[i];
        int j = i - 1;

        while (j >= 0 && values[j] > current)  // Shift larger elements one slot right
        {
            values[j + 1] = values[j];
            j--;
        }

        values[j + 1] = current;
    }
}
```

Each shift fixes one inversion, a pair of elements that are out of order, so the total work is O(n + inversions). Sorted input has no inversions and takes O(n). Reversed input has about n²/2 and takes Θ(n²), which is the worst case. Insertion sort is stable, because the `>` comparison never moves an element past an equal one, and it is in place.

That profile makes it the right tool for small or nearly sorted inputs, where its low overhead beats the O(n log n) sorts. Production sorts use it for exactly that. .NET's `Array.Sort` hands any piece of 16 or fewer elements to insertion sort, as the .NET section below describes.

### Selection Sort and Bubble Sort

**Selection sort** finds the smallest remaining element and swaps it into the next position, n times. It always makes Θ(n²) comparisons, even on sorted input, and the long-distance swaps make it unstable. Its one distinction is making at most n − 1 swaps, which matters only when writing an element is far more expensive than comparing one.

**Bubble sort** walks the array swapping adjacent pairs that are out of order, and repeats until a pass makes no swaps. It is stable and O(n) on sorted input, but Θ(n²) in the worst case. It makes one swap per inversion, just as insertion sort makes one shift, but each swap costs three assignments where a shift costs one, and on typical input it makes at least twice as many comparisons. It appears in teaching and rarely anywhere else.

---

## Merge Sort

Merge sort splits the array in half, sorts each half recursively, and merges the two sorted halves. The merge does the sorting. Two sorted runs combine in one pass by repeatedly taking the smaller of their two front elements, so merging n elements costs O(n).

```csharp
public static void MergeSort(int[] values)
{
    var buffer = new int[values.Length];  // One scratch array, reused by every merge
    MergeSort(values, buffer, 0, values.Length);
}

private static void MergeSort(int[] values, int[] buffer, int start, int end)  // Sorts values[start..end)
{
    if (end - start < 2)
        return;

    int mid = start + (end - start) / 2;
    MergeSort(values, buffer, start, mid);
    MergeSort(values, buffer, mid, end);
    Merge(values, buffer, start, mid, end);
}

private static void Merge(int[] values, int[] buffer, int start, int mid, int end)
{
    int left = start, right = mid, write = start;

    while (left < mid && right < end)
        buffer[write++] = values[left] <= values[right] ? values[left++] : values[right++];  // <= keeps it stable

    while (left < mid) buffer[write++] = values[left++];
    while (right < end) buffer[write++] = values[right++];

    Array.Copy(buffer, start, values, start, end - start);
}

int[] data = { 38, 27, 43, 3, 9, 82, 10 };
MergeSort(data);
Console.WriteLine(string.Join(", ", data));  // 3, 9, 10, 27, 38, 43, 82
```

The halving gives about log₂ n levels of recursion, and the merges on each level handle n elements in total.

{% endraw %}
{% include figure.html id="dsa-merge-sort-recursion-tree" %}
{% raw %}

So merge sort is Θ(n log n) in every case, with no bad inputs. It is stable, because on a tie the merge takes from the left run first. Its cost is the O(n) buffer, and its recursion is only about log₂ n deep.

Merge sort is the natural choice in three places. It sorts linked lists without the extra buffer, because nodes can be relinked instead of copied. It suits external sorting, where data too large for memory is sorted in chunks and the sorted runs merged from disk. And it underlies the stable sorts in other languages: Java sorts object arrays with Timsort, a stable merge sort that takes advantage of runs already in order, and Python's `list.sort` is guaranteed stable and uses a merge sort of the same family.

---

## Quicksort

Tony Hoare published quicksort in 1961. Like merge sort, it splits the problem and recurses, but it does the work before the recursion instead of after. It picks a pivot element and partitions the array so everything smaller than the pivot comes before it and everything else after. The pivot is then in its final position, and the two sides are sorted recursively. No merge is needed.

```csharp
public static void QuickSort(int[] values) => QuickSort(values, 0, values.Length - 1);

private static void QuickSort(int[] values, int low, int high)
{
    while (low < high)
    {
        int p = Partition(values, low, high);

        // Recurse into the smaller side and loop on the larger one, so the stack stays O(log n)
        if (p - low < high - p)
        {
            QuickSort(values, low, p - 1);
            low = p + 1;
        }
        else
        {
            QuickSort(values, p + 1, high);
            high = p - 1;
        }
    }
}

private static int Partition(int[] values, int low, int high)
{
    int pivotIndex = Random.Shared.Next(low, high + 1);  // A random pivot defeats adversarial input
    (values[pivotIndex], values[high]) = (values[high], values[pivotIndex]);
    int pivot = values[high];

    int boundary = low;  // Everything in values[low..boundary) is smaller than the pivot
    for (int i = low; i < high; i++)
    {
        if (values[i] < pivot)
        {
            (values[i], values[boundary]) = (values[boundary], values[i]);
            boundary++;
        }
    }

    (values[boundary], values[high]) = (values[high], values[boundary]);  // The pivot lands in its final place
    return boundary;
}
```

This partition scheme is Lomuto's. Here it is on `{ 7, 2, 9, 4, 1, 8, 5 }`, with 5 as the pivot, already parked at the end:

| i | values[i] | Action | Array after | boundary |
| --- | --- | --- | --- | --- |
| 0 | 7 | Not smaller, leave it | 7, 2, 9, 4, 1, 8, 5 | 0 |
| 1 | 2 | Smaller: swap into slot 0 | 2, 7, 9, 4, 1, 8, 5 | 1 |
| 2 | 9 | Not smaller | 2, 7, 9, 4, 1, 8, 5 | 1 |
| 3 | 4 | Smaller: swap into slot 1 | 2, 4, 9, 7, 1, 8, 5 | 2 |
| 4 | 1 | Smaller: swap into slot 2 | 2, 4, 1, 7, 9, 8, 5 | 3 |
| 5 | 8 | Not smaller | 2, 4, 1, 7, 9, 8, 5 | 3 |
| End | | Swap the pivot into slot 3 | 2, 4, 1, 5, 9, 8, 7 | 3 |

The pivot 5 is now at index 3 for good, with 2, 4, 1 before it and 9, 8, 7 after. Each side is sorted on its own.

### What Quicksort Costs

When the pivot lands near the middle, the recursion has about log₂ n levels with O(n) partitioning work per level, so the sort is O(n log n). When the pivot is always the smallest or largest element, each partition peels off just one element and the sort degrades to Θ(n²). A fixed pivot choice, such as always the last element, hits that case on input that is already sorted. On any input of distinct keys, a random pivot makes that vanishingly unlikely, giving O(n log n) expected time.

Duplicates are a second trap. With many equal keys, this partition sends every copy of the pivot value to one side, and an array of identical values degrades to Θ(n²) even with a random pivot. A three-way partition, which groups elements into smaller, equal, and larger, fixes it. Dijkstra described it as the Dutch national flag problem.

Recursing only into the smaller side bounds the stack at O(log n), since each recursive call handles at most half of the current range. The larger side is handled by the loop. Without this, a string of bad pivots could recurse n levels deep, and in .NET that means a `StackOverflowException`, which can't be caught.

Quicksort is in place, since that stack is only O(log n), and it isn't stable, because partition swaps move elements long distances past their equals. It is usually the fastest general-purpose in-memory sort anyway. Its inner loop is a comparison and an occasional swap over memory it reads in order.

---

## Heap Sort

Heap sort uses a max-heap stored in the array itself. It first arranges the array into a heap, which takes O(n) with bottom-up construction. The largest element is then at index 0. Swapping it with the last element puts it in its final place, and sifting the new root down restores the heap over what remains. Repeating that n − 1 times sorts the array. The heap shrinks from the back as the sorted section grows into its place. Here it is on `{ 4, 10, 3, 5, 1 }`:

| Step | Heap part | Sorted part |
| --- | --- | --- |
| Build the max-heap | 10, 5, 3, 4, 1 | (empty) |
| Move 10 to the end, sift down | 5, 4, 3, 1 | 10 |
| Move 5 to the end, sift down | 4, 1, 3 | 5, 10 |
| Move 4 to the end, sift down | 3, 1 | 4, 5, 10 |
| Move 3 to the end | 1 | 3, 4, 5, 10 |

```csharp
public static void HeapSort(int[] values)
{
    int n = values.Length;

    for (int i = n / 2 - 1; i >= 0; i--)  // Build a max-heap in O(n)
        SiftDown(values, i, n);

    for (int end = n - 1; end > 0; end--)
    {
        (values[0], values[end]) = (values[end], values[0]);  // Largest remaining to its final place
        SiftDown(values, 0, end);                             // Restore the heap on values[0..end)
    }
}

private static void SiftDown(int[] values, int i, int size)
{
    while (true)
    {
        int left = 2 * i + 1, right = left + 1, largest = i;

        if (left < size && values[left] > values[largest]) largest = left;
        if (right < size && values[right] > values[largest]) largest = right;
        if (largest == i) return;

        (values[i], values[largest]) = (values[largest], values[i]);
        i = largest;
    }
}
```

Each of the n − 1 extractions sifts down at most log₂ n levels, so heap sort is O(n log n) in the worst case, and it needs only O(1) extra memory. It has both guarantees quicksort lacks. It is still usually slower than quicksort in practice, because sifting jumps between index i and 2i + 1, far apart in memory for most of the sort. The CPU cache loads memory in blocks, so reads that jump around miss it far more often than reads in order. It isn't stable either. Its main job in modern libraries is as a safety net, described in the .NET section below.

---

## Why Comparison Sorts Can't Beat O(n log n)

Every sort so far learns about the data only by comparing two elements. Any such sort can be drawn as a decision tree. Each internal node is a comparison, each branch is its outcome, and each leaf is one final ordering. A run of the sort follows one path from the root to a leaf, and the number of comparisons is the length of that path.

{% endraw %}
{% include figure.html id="dsa-sort-decision-tree" %}
{% raw %}

n distinct elements can arrive in any of n! orders, and the sort must produce a different rearrangement for each one, so the tree needs at least n! leaves. A binary tree of height h has at most 2ʰ leaves, so the height, the worst-case number of comparisons, is at least log₂(n!). That is Θ(n log n). For 10 elements, log₂(10!) is about 21.8, so any comparison sort needs at least 22 comparisons on some ordering of 10 elements.

Merge sort and heap sort meet this bound up to a constant factor, so they are asymptotically optimal among comparison sorts. Merge sort, for example, needs at most 25 comparisons on 10 elements, against the floor of 22. The only way to beat n log n is to stop comparing.

---

## Sorting Without Comparisons

When keys are small integers, a sort can use them as array indices instead of comparing them. Counting sort counts how many times each key appears, turns the counts into positions, and places each element directly.

```csharp
public static int[] CountingSort(int[] values, int maxValue)  // Every value must be in 0..maxValue
{
    var counts = new int[maxValue + 1];
    foreach (int value in values)
        counts[value]++;

    for (int k = 1; k <= maxValue; k++)
        counts[k] += counts[k - 1];  // counts[k] is now how many values are <= k

    var output = new int[values.Length];
    for (int i = values.Length - 1; i >= 0; i--)  // Walking backward keeps equal values in order
        output[--counts[values[i]]] = values[i];

    return output;
}

Console.WriteLine(string.Join(", ", CountingSort(new[] { 4, 1, 3, 4, 0, 2, 1 }, 4)));  // 0, 1, 1, 2, 3, 4, 4
```

It runs in Θ(n + k), where k is the size of the key range, and it is stable. That beats n log n when k is not much larger than n, such as ages, grades, or bytes. It is a poor fit when k is huge, since sorting ten values drawn from the full `int` range would need about four billion (2³²) counters.

Radix sort handles larger keys by sorting on one digit at a time, least significant first, with a stable counting sort for each pass. After the last pass the keys are fully sorted, because each stable pass preserves the order the earlier passes established among keys that tie on the current digit. Here are three passes over three-digit numbers:

| After sorting by | Order |
| --- | --- |
| (start) | 329, 457, 657, 839, 436, 720, 355 |
| Ones digit | 720, 355, 436, 457, 657, 329, 839 |
| Tens digit | 720, 329, 436, 839, 355, 457, 657 |
| Hundreds digit | 329, 355, 436, 457, 657, 720, 839 |

In the tens pass, 436 and 839 tie on 3, and they keep the order the ones pass gave them. The hundreds pass does the same for 436 and 457, and for 329 and 355.

Sorting unsigned 32-bit keys one byte at a time takes four passes over the data, each O(n + 256), so the whole sort is linear in n. Signed integers need one adjustment. In two's complement a negative number's top bit is 1, so plain byte passes put negatives after positives. Flipping the sign bit before sorting, or reading the top byte as signed, fixes the order.

Both depend on the shape of the keys. Neither can sort arbitrary objects under a comparison function, which is why general-purpose library sorts compare.

---

## Sorting in .NET

### Array.Sort and List&lt;T&gt;.Sort

`Array.Sort` and `List<T>.Sort` run introsort, a hybrid of quicksort, heap sort, and insertion sort, and `MemoryExtensions.Sort` for spans runs the same introsort in the `dotnet/runtime` source. Microsoft's documentation for `Array.Sort` describes its rules:

- A partition of 16 or fewer elements is sorted with insertion sort.
- Once the number of partitions exceeds about 2 log₂ n, it switches to heap sort.
- Otherwise it partitions as quicksort does, and the `dotnet/runtime` source picks the pivot as the median of the first, middle, and last elements.

Quicksort gives the speed, heap sort caps the worst case at O(n log n), and insertion sort finishes small pieces cheaply. The result is in place and O(n log n) in the worst case, but it is not stable. The documentation says so directly, and equal elements can come out in any order.

```csharp
int[] numbers = { 5, 3, 8, 1, 9, 2 };
Array.Sort(numbers);                                     // 1, 2, 3, 5, 8, 9

var names = new List<string> { "carol", "Alice", "bob" };
names.Sort(StringComparer.OrdinalIgnoreCase);            // Alice, bob, carol

Array.Sort(numbers, (a, b) => b.CompareTo(a));           // Descending: 9, 8, 5, 3, 2, 1
```

A custom comparison should use `CompareTo` rather than subtraction. `(a, b) => a - b` overflows when the values are far apart, such as `int.MaxValue` and a negative number, and then reports the wrong order. A comparison must also be consistent. It returns 0 for an element compared with itself, never says both a < b and b < a, and is transitive. That covers equality too. If a equals b and b equals c, then a must equal c. Comparing floating-point values with a tolerance breaks exactly that rule, because a can be close to b and b close to c while a and c are too far apart to count as equal. The documentation notes that an inconsistent comparer can make `Array.Sort` throw an `ArgumentException`.

### LINQ's OrderBy

`OrderBy`, `OrderByDescending`, and `ThenBy` are stable, as their documentation states. They don't change the source. They return a new sequence that is sorted each time it is enumerated, reflecting the source as it is at that moment, and they need O(n) extra memory to do it. Call `ToList` or `ToArray` to sort once and keep the result. `ThenBy` adds a tiebreaker key, which is the usual way to sort by several fields. .NET 7 added `Order()` and `OrderDescending()` for sorting elements by their own value.

```csharp
var orders = new[]
{
    (Customer: "Ben", Day: 1), (Customer: "Ana", Day: 2),
    (Customer: "Ben", Day: 3), (Customer: "Ana", Day: 4),
};

// Already in day order. A stable sort by customer keeps each customer's days in order.
foreach (var order in orders.OrderBy(o => o.Customer))
    Console.Write($"{order.Customer} {order.Day}, ");    // Ana 2, Ana 4, Ben 1, Ben 3,

// Or say both keys outright, which doesn't depend on the input's order
var byCustomerThenDay = orders.OrderBy(o => o.Customer).ThenBy(o => o.Day);
```

Use `Array.Sort` or `List<T>.Sort` when the data can be sorted in place and the order of equal elements doesn't matter. Use `OrderBy` when it does, or when the original order must survive.

---

## Choosing a Sort

| Algorithm | Worst case | Average or expected | Extra space | Stable | Where it fits |
| --- | --- | --- | --- | --- | --- |
| Insertion sort | Θ(n²) | Θ(n²) | O(1) | Yes | Small inputs, and nearly sorted ones, where it is O(n + inversions). Also small pieces inside hybrids |
| Selection sort | Θ(n²) | Θ(n²) | O(1) | No | When writes cost far more than comparisons |
| Bubble sort | Θ(n²) | Θ(n²) | O(1) | Yes | Teaching |
| Merge sort | Θ(n log n) | Θ(n log n) | O(n) | Yes | Stable sorting, linked lists, data too large for memory |
| Quicksort | Θ(n²) | O(n log n) expected, with a random pivot and distinct keys | O(log n) stack | No | Fast general-purpose sorting in memory |
| Heap sort | Θ(n log n) | Θ(n log n) | O(1) | No | A guaranteed bound with no extra memory, and introsort's fallback |
| Counting sort | Θ(n + k) | Θ(n + k) | O(n + k) | Yes | Small integer keys in a range of size k |
| Radix sort | Θ(d(n + k)) | Θ(d(n + k)) | O(n + k) | Yes | Fixed-width keys with d digits of k values each |

Writing a sort by hand is rarely worth it in .NET, except for counting or radix sort when the keys are small integers and the data is large.

{% endraw %}
