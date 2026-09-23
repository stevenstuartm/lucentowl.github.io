---
title: "Heaps & Priority Queues"
layout: guide
category: Data Structures & Algorithms
subcategory: Trees & Heaps
description: "How a binary heap keeps the smallest or largest element on top with O(log n) inserts and removals, why it fits in a plain array, why building one from n elements is O(n), how .NET's PriorityQueue<TElement,TPriority> behaves, and the problems heaps solve: top-k, merging sorted streams, and running medians."
tags: [heaps, priority-queues, binary-heap, top-k, fundamentals]
---
{% raw %}

## Why Heaps Exist

Many programs repeatedly need the smallest or largest item from a collection that keeps changing: the next task by priority, the nearest unvisited node in a shortest-path search, the earliest timer to fire. A sorted list answers that in O(1) but pays O(n) to insert. An unsorted list inserts in O(1) but pays O(n) to find the minimum. A heap does both operations in O(log n) by keeping only as much order as the question needs.

That pair of operations, insert and remove the minimum (or the maximum), is the contract of a priority queue, an abstract data type in the same sense as a stack or a queue. The sorted list and the unsorted list above are two ways to implement it. A binary heap is a third, and the usual one, because neither of its operations is O(n).

J. W. J. Williams introduced the binary heap in 1964 as the core of heapsort, and Robert Floyd published the faster way to build one from existing data later that year.

---

## The Heap Rules

A binary heap is a binary tree that obeys two rules.

**The shape rule.** The tree is complete: every level is full except possibly the last, and the last level fills from left to right with no gaps. A complete tree with n nodes always has height ⌊log₂ n⌋, so no path from the root is longer than about log₂ n.

**The order rule.** In a min-heap, every node is less than or equal to its children, so the smallest element is always at the root. A max-heap reverses the rule and keeps the largest at the root.

The order rule relates parents to children and nothing else. Siblings and cousins can be in any order, so a heap is not sorted. That partial order is enough to find the extreme element instantly, and it is much cheaper to maintain than full sorted order.

---

## Storing a Heap in an Array

The shape rule means a heap needs no pointers at all. Numbering the nodes level by level, left to right, packs the tree into consecutive array slots with no gaps, and the parent and child positions become arithmetic:

- The children of index i are at 2i + 1 and 2i + 2.
- The parent of index i is at (i − 1) / 2, using integer division.

{% endraw %}
{% include figure.html id="dsa-heap-array" %}
{% raw %}

Moving between parent and child is one multiplication or division instead of following a reference, and the whole heap is one contiguous block of memory. Appending to the array always fills the next position in the last level, which is exactly what the shape rule requires.

---

## Insert and Remove

Both operations first put the tree back into the right shape, which may break the order rule along one path, and then repair that one path.

**Insert (sift up).** Append the new element at the end of the array, the next free spot in the bottom level. While it is smaller than its parent, swap it with the parent. It rises at most the height of the tree, so insert is O(log n).

**Remove the minimum (sift down).** Take the root, which is the answer. Move the last element of the array into the root's slot and shrink the array by one. While that element is larger than its smaller child, swap it with that child. It sinks at most the height of the tree, so removal is also O(log n). Swapping with the smaller child matters, because the smaller child is the only one that can become the parent of the other without breaking the order rule.

{% endraw %}
{% include figure.html id="dsa-heap-sift-down" %}
{% raw %}

```csharp
public class MinHeap<T>
{
    private readonly List<T> _items = new();
    private readonly IComparer<T> _comparer;

    public MinHeap(IComparer<T>? comparer = null) => _comparer = comparer ?? Comparer<T>.Default;

    public int Count => _items.Count;

    public T Peek() => _items.Count > 0 ? _items[0] : throw new InvalidOperationException("The heap is empty.");

    public void Push(T item)
    {
        _items.Add(item);
        SiftUp(_items.Count - 1);
    }

    public T Pop()
    {
        if (_items.Count == 0)
            throw new InvalidOperationException("The heap is empty.");

        T min = _items[0];
        int last = _items.Count - 1;
        _items[0] = _items[last];  // Move the last element to the root
        _items.RemoveAt(last);

        if (_items.Count > 0)
            SiftDown(0);

        return min;
    }

    private void SiftUp(int i)
    {
        while (i > 0)
        {
            int parent = (i - 1) / 2;
            if (_comparer.Compare(_items[i], _items[parent]) >= 0)
                break;  // The order rule holds

            (_items[i], _items[parent]) = (_items[parent], _items[i]);
            i = parent;
        }
    }

    private void SiftDown(int i)
    {
        while (true)
        {
            int left = 2 * i + 1, right = left + 1, smallest = i;

            if (left < _items.Count && _comparer.Compare(_items[left], _items[smallest]) < 0)
                smallest = left;
            if (right < _items.Count && _comparer.Compare(_items[right], _items[smallest]) < 0)
                smallest = right;

            if (smallest == i)
                return;  // Smaller than both children

            (_items[i], _items[smallest]) = (_items[smallest], _items[i]);
            i = smallest;
        }
    }
}

var heap = new MinHeap<int>();
foreach (int value in new[] { 10, 5, 20, 3, 8, 15 })
    heap.Push(value);

while (heap.Count > 0)
    Console.Write($"{heap.Pop()} ");  // 3 5 8 10 15 20
```

A max-heap needs no separate class. Passing a reversed comparer, such as `Comparer<int>.Create((a, b) => b.CompareTo(a))`, turns the same code into one.

---

## Building a Heap in O(n)

Pushing n elements one at a time costs O(n log n). Floyd's bottom-up construction does better. Treat the unsorted array as a complete tree as-is, then sift down every node that has children, starting from the last one and working back to the root. When a node is sifted down, both of its subtrees are already valid heaps, so one sift down fixes the whole subtree.

```csharp
public static void Heapify(int[] values)
{
    // The last node with a child is the parent of the last element
    for (int i = values.Length / 2 - 1; i >= 0; i--)
        SiftDown(values, i, values.Length);
}

private static void SiftDown(int[] values, int i, int size)
{
    while (true)
    {
        int left = 2 * i + 1, right = left + 1, smallest = i;
        if (left < size && values[left] < values[smallest]) smallest = left;
        if (right < size && values[right] < values[smallest]) smallest = right;
        if (smallest == i) return;

        (values[i], values[smallest]) = (values[smallest], values[i]);
        i = smallest;
    }
}

int[] data = { 10, 5, 20, 3, 8, 15 };
Heapify(data);
Console.WriteLine(string.Join(", ", data));  // 3, 5, 15, 10, 8, 20
```

This is O(n) because most nodes are near the bottom, where sifting down is cheap. Half the nodes are leaves and are skipped entirely. A quarter are one level above the leaves and move at most one step. An eighth move at most two steps, and so on. Only the root can move the full height. Adding it up, the total number of swaps is less than n. Heapsort, a sorting algorithm, starts from this same construction.

---

## Operation Costs

| Operation | Binary heap | Why |
| --- | --- | --- |
| Peek at the minimum | O(1) | It is always at index 0 |
| Insert | O(log n) | One sift up along one path |
| Remove the minimum | O(log n) | One sift down along one path |
| Build from n elements | O(n) | Floyd's bottom-up construction |
| Search for an arbitrary element | O(n) | The order rule doesn't say where to look |
| Remove or change an arbitrary element | O(n) to find it, then O(log n) | O(log n) alone only if its index is already known |

The last two rows are the heap's blind spot. Lowering the priority value of an element already in a min-heap, so that it moves toward the root, is called decrease-key. Algorithms that need it, such as Dijkstra's shortest paths, either track each element's index in a separate dictionary or insert a new copy with the better priority and skip stale copies when they come out.

---

## PriorityQueue in .NET

.NET 6 added `PriorityQueue<TElement, TPriority>`. The runtime source describes it as an array-backed quaternary min-heap. Each node has up to four children instead of two, which makes the tree shallower at the cost of comparing more children at each step of a sift down. The costs in Big O terms match the binary heap's.

```csharp
var tasks = new PriorityQueue<string, int>();
tasks.Enqueue("Write report", 3);
tasks.Enqueue("Fix outage", 1);
tasks.Enqueue("Review PR", 2);

while (tasks.TryDequeue(out string? task, out int priority))
    Console.WriteLine($"{priority}: {task}");  // 1: Fix outage, 2: Review PR, 3: Write report
```

Several behaviors matter before relying on it:

- **Lowest priority value first.** For a max-queue, pass a reversed `IComparer<TPriority>` to the constructor.
- **No order among equal priorities.** Microsoft's documentation states that it does not guarantee first-in-first-out order for elements of equal priority. To get first-in-first-out among ties, make the priority a tuple of the priority and an increasing sequence number.
- **No priority updates.** There is no decrease-key operation, and no way to change an element's priority in place. .NET 9 added `Remove`, which finds an element with a linear scan, so updating a priority means `Remove` and `Enqueue` at O(n), or the stale-copy approach above.
- **Unordered enumeration.** `UnorderedItems` returns the elements in heap-array order, not priority order.
- **Batch helpers.** The constructor that takes a collection builds the heap in O(n), and so does `EnqueueRange` when the queue is empty. `EnqueueDequeue` pushes and pops in one step, which suits keeping a fixed-size heap of the best k items.

---

## What Heaps Solve

### The k Largest Elements

To keep the k largest values from a large or unbounded stream, hold a min-heap of size k. Its root is the smallest of the current top k, so each new value only needs to beat the root to get in. That costs O(n log k) time and O(k) memory, where sorting everything costs O(n log n) time and O(n) memory.

```csharp
public static int[] LargestK(IEnumerable<int> values, int k)
{
    if (k <= 0)
        return Array.Empty<int>();

    var top = new PriorityQueue<int, int>();  // Min-heap: the root is the smallest of the top k

    foreach (int value in values)
    {
        if (top.Count < k)
            top.Enqueue(value, value);
        else if (value > top.Peek())
            top.EnqueueDequeue(value, value);  // Admit the new value, evict the old smallest
    }

    var result = new int[top.Count];
    for (int i = result.Length - 1; i >= 0; i--)
        result[i] = top.Dequeue();             // Fill from the back so the result is descending
    return result;
}

Console.WriteLine(string.Join(", ", LargestK(new[] { 3, 1, 4, 1, 5, 9, 2, 6, 5, 3 }, 3)));  // 9, 6, 5
```

When the whole input is already in memory and only the k-th largest value is needed, quickselect, a partitioning algorithm related to quicksort, finds it in O(n) on average without a heap.

### Merging k Sorted Sequences

To merge k sorted lists, put the first element of each list in a min-heap along with which list it came from. Repeatedly take the smallest, output it, and push the next element from the same list. The heap never holds more than k elements, so merging n total elements costs O(n log k). External sorts use this for data too large to sort in memory. They sort one memory-sized chunk at a time, write each sorted chunk to disk as a run, and then merge the runs, often in a single pass. Database engines use the same technique for large sorts.

```csharp
public static List<int> MergeSorted(IReadOnlyList<int[]> lists)
{
    var heads = new PriorityQueue<(int List, int Index), int>();
    for (int i = 0; i < lists.Count; i++)
    {
        if (lists[i].Length > 0)
            heads.Enqueue((i, 0), lists[i][0]);
    }

    var merged = new List<int>();
    while (heads.TryDequeue(out var head, out int value))
    {
        merged.Add(value);

        int next = head.Index + 1;
        if (next < lists[head.List].Length)
            heads.Enqueue((head.List, next), lists[head.List][next]);
    }

    return merged;
}

var lists = new[] { new[] { 1, 4, 5 }, new[] { 1, 3, 4 }, new[] { 2, 6 } };
Console.WriteLine(string.Join(", ", MergeSorted(lists)));  // 1, 1, 2, 3, 4, 4, 5, 6
```

### A Running Median

The median of a stream can be kept current with two heaps that split the values in half: a max-heap holding the lower half and a min-heap holding the upper half. Keeping their sizes within one of each other puts the median at one heap's root, or halfway between both roots.

```csharp
public class RunningMedian
{
    private readonly PriorityQueue<int, int> _lower =
        new(Comparer<int>.Create((a, b) => b.CompareTo(a)));  // Max-heap: largest of the lower half on top
    private readonly PriorityQueue<int, int> _upper = new();   // Min-heap: smallest of the upper half on top

    public void Add(int value)
    {
        _lower.Enqueue(value, value);

        int largestLower = _lower.Dequeue();          // Pass the lower half's largest up
        _upper.Enqueue(largestLower, largestLower);

        if (_upper.Count > _lower.Count)              // Keep the lower half the same size or one larger
        {
            int smallestUpper = _upper.Dequeue();
            _lower.Enqueue(smallestUpper, smallestUpper);
        }
    }

    public double Median =>
        _lower.Count == 0 ? throw new InvalidOperationException("No values added yet.")
        : _lower.Count > _upper.Count ? _lower.Peek()
        : (_lower.Peek() + (double)_upper.Peek()) / 2;
}

var median = new RunningMedian();
foreach (int value in new[] { 5, 15, 1, 3 })
{
    median.Add(value);
    Console.Write($"{median.Median} ");  // 5 10 5 4
}
```

Each insert is O(log n) and reading the median is O(1).

---

## When Not to Use a Heap

- **Searching or membership checks.** A heap finds only its root quickly. Use a hash set for "is this present".
- **Sorted iteration.** Draining a heap produces sorted output, but it destroys the heap and costs O(n log n). A balanced search tree such as `SortedSet<T>` keeps everything in order and supports ranges.
- **A one-time minimum.** For the smallest element of data that doesn't change, one O(n) scan beats building anything.
- **Frequent priority changes.** Without an index map, each change is O(n). If the workload is mostly updates, a balanced tree keyed by priority may fit better.

{% endraw %}
