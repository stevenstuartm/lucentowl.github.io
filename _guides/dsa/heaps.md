---
title: "Heaps & Priority Queues"
category: Data Structures & Algorithms
description: "Learn heap data structure properties, heapify operations, priority queue implementations, and applications from task scheduling to finding top-K elements."
tags: [data-structures, algorithms, heaps, priority-queues, practical]
---

## Why Heaps Exist

*Binary heap data structure introduced by J.W.J. Williams in 1964 for heapsort. Robert W. Floyd later improved the heap construction algorithm in 1964.*

Efficiently maintain the minimum or maximum element while allowing dynamic insertions and deletions. Heaps solve the problem of quickly accessing the "most important" element in a changing dataset without maintaining full sorted order, achieving O(1) peek and O(log n) insert/delete.

## When to Use Heaps

**Use when:**
- Need to repeatedly find/remove min or max element
- Implementing priority queues (task scheduling, algorithms)
- Finding top-K elements in large datasets
- Merging multiple sorted sequences
- Graph algorithms (Dijkstra's, Prim's)
- Streaming data where you need extremes

**Don't use when:**
- Need to search for arbitrary elements (use hash table)
- Need sorted iteration through all elements (use balanced BST)
- Simple min/max of static data (just iterate once)
- Need to access elements by index (use array)

**Modern reality:** Use C#'s built-in `PriorityQueue<T,P>` (.NET 6+) or `SortedSet<T>` for older versions. Implement heaps in interviews to show understanding.

---

## Heap Properties

### Complete Binary Tree Structure
- All levels filled except possibly the last
- Last level filled left-to-right
- Height is always O(log n)
- Can be efficiently represented as an array

### Heap Order Property
**Min-Heap:** Parent ≤ children (root is minimum)
**Max-Heap:** Parent ≥ children (root is maximum)

### Array Representation
For element at index `i`:
- **Parent:** `(i - 1) / 2`
- **Left child:** `2 * i + 1`
- **Right child:** `2 * i + 2`

```
Array: [1, 3, 6, 5, 9, 8]
Tree:       1
          /   \
         3     6
        / \   /
       5   9 8
```

---

## Time Complexity

| Operation | Binary Heap | Notes |
|-----------|-------------|-------|
| **Insert** | O(log n) | Bubble up to maintain heap property |
| **Extract Min/Max** | O(log n) | Remove root, bubble down |
| **Peek Min/Max** | O(1) | Root element |
| **Delete arbitrary** | O(log n) | Find + bubble down |
| **Build from array** | O(n) | Bottom-up heapify |
| **Search** | O(n) | No ordering except parent-child |

---

## Min-Heap Implementation
```csharp
public class MinHeap<T> where T : IComparable<T>
{
    private List<T> heap;
    
    public MinHeap()
    {
        heap = new List<T>();
    }
    
    private int Parent(int i) => (i - 1) / 2;
    private int LeftChild(int i) => 2 * i + 1;
    private int RightChild(int i) => 2 * i + 2;
    
    private void Swap(int i, int j)
    {
        T temp = heap[i];
        heap[i] = heap[j];
        heap[j] = temp;
    }
    
    public void Insert(T value)
    {
        heap.Add(value);
        BubbleUp(heap.Count - 1);
        Console.WriteLine($"Inserted {value}: [{string.Join(", ", heap)}]");
    }
    
    private void BubbleUp(int index)
    {
        while (index > 0)
        {
            int parentIndex = Parent(index);
            
            // If heap property is satisfied, stop
            if (heap[parentIndex].CompareTo(heap[index]) <= 0)
                break;
            
            Console.WriteLine($"Bubbling up: swap {heap[index]} with parent {heap[parentIndex]}");
            Swap(index, parentIndex);
            index = parentIndex;
        }
    }
    
    public T ExtractMin()
    {
        if (heap.Count == 0)
            throw new InvalidOperationException("Heap is empty");
        
        if (heap.Count == 1)
            return heap[0];
        
        // Save min value
        T minVal = heap[0];
        
        // Move last element to root
        heap[0] = heap[heap.Count - 1];
        heap.RemoveAt(heap.Count - 1);
        Console.WriteLine($"After moving last to root: [{string.Join(", ", heap)}]");
        
        // Restore heap property
        if (heap.Count > 0)
            BubbleDown(0);
        
        Console.WriteLine($"Extracted {minVal}, heap is now: [{string.Join(", ", heap)}]");
        return minVal;
    }
    
    private void BubbleDown(int index)
    {
        while (true)
        {
            int minIndex = index;
            int left = LeftChild(index);
            int right = RightChild(index);
            
            // Find smallest among node and its children
            if (left < heap.Count && heap[left].CompareTo(heap[minIndex]) < 0)
                minIndex = left;
            
            if (right < heap.Count && heap[right].CompareTo(heap[minIndex]) < 0)
                minIndex = right;
            
            // If no swap needed, heap property is satisfied
            if (minIndex == index)
                break;
            
            Console.WriteLine($"Bubbling down: swap {heap[index]} with {heap[minIndex]}");
            Swap(index, minIndex);
            index = minIndex;
        }
    }
    
    public T Peek()
    {
        if (heap.Count == 0)
            throw new InvalidOperationException("Heap is empty");
        return heap[0];
    }
    
    public int Count => heap.Count;
    public bool IsEmpty => heap.Count == 0;
    
    public override string ToString()
    {
        return $"MinHeap([{string.Join(", ", heap)}])";
    }
}

// Example usage
Console.WriteLine("=== Min Heap Demo ===");
var heap = new MinHeap<int>();

// Insert elements
int[] values = {10, 5, 20, 3, 8, 15};
foreach (var val in values)
{
    heap.Insert(val);
}

Console.WriteLine($"\nFinal heap: {heap}");
Console.WriteLine($"Minimum element: {heap.Peek()}");

// Extract elements
Console.WriteLine("\nExtracting elements in sorted order:");
while (!heap.IsEmpty)
{
    Console.WriteLine($"Extracted: {heap.ExtractMin()}");
}
```

---

## Building Heap from Array (O(n) Algorithm)

### Bottom-Up Heapify
```csharp
public static int[] BuildMinHeap(int[] arr)
{
    // Build min heap from array in O(n) time
    int[] heap = new int[arr.Length];
    Array.Copy(arr, heap, arr.Length);
    int n = heap.Length;

    // Start from last non-leaf node and heapify down
    for (int i = (n - 2) / 2; i >= 0; i--)
    {
        HeapifyDown(heap, i, n);
        Console.WriteLine($"After heapifying index {i}: [{string.Join(", ", heap)}]");
    }

    return heap;
}

private static void HeapifyDown(int[] heap, int index, int heapSize)
{
    // Helper function for heapify down
    while (true)
    {
        int minIndex = index;
        int left = 2 * index + 1;
        int right = 2 * index + 2;

        if (left < heapSize && heap[left] < heap[minIndex])
            minIndex = left;

        if (right < heapSize && heap[right] < heap[minIndex])
            minIndex = right;

        if (minIndex == index)
            break;

        (heap[index], heap[minIndex]) = (heap[minIndex], heap[index]);
        index = minIndex;
    }
}

// Example usage
int[] array = {20, 15, 8, 10, 5, 7, 6, 2, 9, 1};
Console.WriteLine($"Original array: [{string.Join(", ", array)}]");
int[] heap = BuildMinHeap(array);
Console.WriteLine($"Min heap: [{string.Join(", ", heap)}]");
```

<div class="callout callout--tip">
<p class="callout__title">Why Building a Heap is O(n)</p>
<p>Most nodes are near the bottom (leaves need no work). Nodes at height h: at most ⌈n/2^(h+1)⌉. Work at height h: at most h operations. Total work: Σ(h × n/2^(h+1)) = O(n). This is faster than inserting n elements one by one, which would be O(n log n).</p>
</div>

---

## Priority Queue Implementation

### C# Priority Queue (.NET 6+)
```csharp
// Using built-in PriorityQueue (available in .NET 6+)
public static void DemonstratePriorityQueue()
{
    var pq = new PriorityQueue<string, int>();
    
    // Add items (lower number = higher priority)
    pq.Enqueue("Low priority task", 3);
    pq.Enqueue("High priority task", 1);
    pq.Enqueue("Medium priority task", 2);
    pq.Enqueue("Another high priority", 1);
    
    Console.WriteLine("Processing tasks by priority:");
    while (pq.Count > 0)
    {
        var task = pq.Dequeue();
        Console.WriteLine($"Processing: {task}");
    }
}

// Custom priority queue for older .NET versions
public class CustomPriorityQueue<T> where T : IComparable<T>
{
    private List<(T item, int priority)> heap;
    
    public CustomPriorityQueue()
    {
        heap = new List<(T, int)>();
    }
    
    public void Enqueue(T item, int priority)
    {
        heap.Add((item, priority));
        BubbleUp(heap.Count - 1);
    }
    
    public T Dequeue()
    {
        if (heap.Count == 0)
            throw new InvalidOperationException("Queue is empty");
        
        var result = heap[0].item;
        
        // Move last to first and bubble down
        heap[0] = heap[heap.Count - 1];
        heap.RemoveAt(heap.Count - 1);
        
        if (heap.Count > 0)
            BubbleDown(0);
        
        return result;
    }
    
    private void BubbleUp(int index)
    {
        while (index > 0)
        {
            int parentIndex = (index - 1) / 2;
            
            if (heap[parentIndex].priority <= heap[index].priority)
                break;
            
            (heap[index], heap[parentIndex]) = (heap[parentIndex], heap[index]);
            index = parentIndex;
        }
    }
    
    private void BubbleDown(int index)
    {
        while (true)
        {
            int minIndex = index;
            int left = 2 * index + 1;
            int right = 2 * index + 2;
            
            if (left < heap.Count && heap[left].priority < heap[minIndex].priority)
                minIndex = left;
            
            if (right < heap.Count && heap[right].priority < heap[minIndex].priority)
                minIndex = right;
            
            if (minIndex == index)
                break;
            
            (heap[index], heap[minIndex]) = (heap[minIndex], heap[index]);
            index = minIndex;
        }
    }
    
    public int Count => heap.Count;
    public bool IsEmpty => heap.Count == 0;
}
```

---

## Heap Applications

### 1. Top-K Elements
```csharp
public static List<int> FindKLargest(int[] nums, int k)
{
    // Find k largest elements using min-heap
    if (k >= nums.Length)
        return nums.OrderByDescending(x => x).ToList();

    // Use min-heap of size k
    var heap = new MinHeap<int>();

    foreach (int num in nums)
    {
        if (heap.Count < k)
        {
            heap.Insert(num);
        }
        else if (num > heap.Peek())
        {
            heap.ExtractMin();
            heap.Insert(num);
        }
    }

    var result = new List<int>();
    while (!heap.IsEmpty)
    {
        result.Add(heap.ExtractMin());
    }

    result.Reverse();
    return result;
}

public static List<int> FindKSmallest(int[] nums, int k)
{
    // Find k smallest elements using max-heap (negate values)
    var heap = new MinHeap<int>();

    foreach (int num in nums)
    {
        if (heap.Count < k)
        {
            heap.Insert(-num);  // Negate for max-heap behavior
        }
        else if (num < -heap.Peek())  // num < max element in heap
        {
            heap.ExtractMin();
            heap.Insert(-num);
        }
    }

    var result = new List<int>();
    while (!heap.IsEmpty)
    {
        result.Add(-heap.ExtractMin());
    }

    result.Sort();
    return result;
}

// Example usage
int[] numbers = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5};
Console.WriteLine($"Original: [{string.Join(", ", numbers)}]");
Console.WriteLine($"3 largest: [{string.Join(", ", FindKLargest(numbers, 3))}]");
Console.WriteLine($"3 smallest: [{string.Join(", ", FindKSmallest(numbers, 3))}]");
```

### 2. Merge K Sorted Arrays
```csharp
public static List<int> MergeKSortedArrays(List<List<int>> arrays)
{
    // Merge k sorted arrays using heap
    var heap = new PriorityQueue<(int value, int arrayIndex, int elementIndex), int>();
    var result = new List<int>();

    // Add first element from each array to heap
    for (int i = 0; i < arrays.Count; i++)
    {
        if (arrays[i].Count > 0)  // Skip empty arrays
        {
            heap.Enqueue((arrays[i][0], i, 0), arrays[i][0]);
        }
    }

    while (heap.Count > 0)
    {
        var (value, arrIdx, elemIdx) = heap.Dequeue();
        result.Add(value);

        // Add next element from the same array
        if (elemIdx + 1 < arrays[arrIdx].Count)
        {
            int nextValue = arrays[arrIdx][elemIdx + 1];
            heap.Enqueue((nextValue, arrIdx, elemIdx + 1), nextValue);
        }
    }

    return result;
}

// Example usage
var arrays = new List<List<int>>
{
    new List<int> {1, 4, 5},
    new List<int> {1, 3, 4},
    new List<int> {2, 6}
};
var merged = MergeKSortedArrays(arrays);
Console.WriteLine($"Merged: [{string.Join(", ", merged)}]");  // [1, 1, 2, 3, 4, 4, 5, 6]
```

### 3. Running Median
```csharp
public class MedianFinder
{
    // Find median from data stream using two heaps
    private PriorityQueue<int, int> maxHeap;  // Left half (negate priorities for max-heap)
    private PriorityQueue<int, int> minHeap;  // Right half

    public MedianFinder()
    {
        maxHeap = new PriorityQueue<int, int>(Comparer<int>.Create((a, b) => b.CompareTo(a)));
        minHeap = new PriorityQueue<int, int>();
    }

    public void AddNumber(int num)
    {
        // Add to max_heap first
        maxHeap.Enqueue(num, num);

        // Move largest from max_heap to min_heap
        minHeap.Enqueue(maxHeap.Peek(), maxHeap.Dequeue());

        // Balance heaps (max_heap can have at most one more element)
        if (minHeap.Count > maxHeap.Count)
        {
            maxHeap.Enqueue(minHeap.Peek(), minHeap.Dequeue());
        }
    }

    public double FindMedian()
    {
        if (maxHeap.Count > minHeap.Count)
        {
            return maxHeap.Peek();
        }
        else
        {
            return (maxHeap.Peek() + minHeap.Peek()) / 2.0;
        }
    }
}

// Example usage
var medianFinder = new MedianFinder();
int[] numbers = {1, 2, 3, 4, 5};

foreach (int num in numbers)
{
    medianFinder.AddNumber(num);
    Console.WriteLine($"Added {num}, median: {medianFinder.FindMedian()}");
}
```

---

## Interview Problems

### 1. Kth Largest Element
```csharp
public static int FindKthLargest(int[] nums, int k)
{
    // Find kth largest element using heap
    // Method 1: Use min-heap of size k
    var heap = new MinHeap<int>();

    foreach (int num in nums)
    {
        if (heap.Count < k)
        {
            heap.Insert(num);
        }
        else if (num > heap.Peek())
        {
            heap.ExtractMin();
            heap.Insert(num);
        }
    }

    return heap.Peek();
}

public static int FindKthLargestQuickSelect(int[] nums, int k)
{
    // Alternative: Quick select algorithm
    int Partition(int left, int right, int pivotIndex)
    {
        int pivotValue = nums[pivotIndex];
        (nums[pivotIndex], nums[right]) = (nums[right], nums[pivotIndex]);

        int storeIndex = left;
        for (int i = left; i < right; i++)
        {
            if (nums[i] > pivotValue)
            {
                (nums[storeIndex], nums[i]) = (nums[i], nums[storeIndex]);
                storeIndex++;
            }
        }

        (nums[right], nums[storeIndex]) = (nums[storeIndex], nums[right]);
        return storeIndex;
    }

    int Select(int left, int right, int kSmallest)
    {
        if (left == right)
            return nums[left];

        int pivotIndex = left + (right - left) / 2;
        pivotIndex = Partition(left, right, pivotIndex);

        if (kSmallest == pivotIndex)
            return nums[kSmallest];
        else if (kSmallest < pivotIndex)
            return Select(left, pivotIndex - 1, kSmallest);
        else
            return Select(pivotIndex + 1, right, kSmallest);
    }

    return Select(0, nums.Length - 1, k - 1);
}

// Example usage
int[] nums = {3, 2, 1, 5, 6, 4};
int k = 2;
Console.WriteLine($"Array: [{string.Join(", ", nums)}]");
Console.WriteLine($"{k}th largest (heap): {FindKthLargest(nums, k)}");
Console.WriteLine($"{k}th largest (quickselect): {FindKthLargestQuickSelect((int[])nums.Clone(), k)}");
```

### 2. Task Scheduler
```csharp
public static int LeastInterval(char[] tasks, int n)
{
    // Minimum intervals to execute all tasks with cooldown n
    if (n == 0)
        return tasks.Length;

    // Count frequency of each task
    var taskCounts = new Dictionary<char, int>();
    foreach (char task in tasks)
    {
        taskCounts[task] = taskCounts.GetValueOrDefault(task, 0) + 1;
    }

    // Max heap of frequencies (negate for max-heap behavior)
    var heap = new PriorityQueue<int, int>(Comparer<int>.Create((a, b) => b.CompareTo(a)));
    foreach (int count in taskCounts.Values)
    {
        heap.Enqueue(count, count);
    }

    // Queue to store (count, available_time)
    var queue = new Queue<(int count, int availableTime)>();
    int time = 0;

    while (heap.Count > 0 || queue.Count > 0)
    {
        time++;

        // Add back available tasks from queue
        if (queue.Count > 0 && queue.Peek().availableTime == time)
        {
            var (count, _) = queue.Dequeue();
            heap.Enqueue(count, count);
        }

        // Execute most frequent available task
        if (heap.Count > 0)
        {
            int count = heap.Dequeue();
            count--;  // Reduce frequency

            if (count > 0)  // Still has remaining executions
            {
                queue.Enqueue((count, time + n + 1));
            }
        }
    }

    return time;
}

// Example usage
char[] tasks = {'A', 'A', 'A', 'B', 'B', 'B'};
int n = 2;
int result = LeastInterval(tasks, n);
Console.WriteLine($"Tasks: [{string.Join(", ", tasks)}], cooldown: {n}");
Console.WriteLine($"Minimum intervals: {result}");
```

---

## Quick Reference

### Heap Operations
| Operation | Time | Notes |
|-----------|------|-------|
| Insert | O(log n) | Bubble up |
| Extract min/max | O(log n) | Bubble down |
| Peek min/max | O(1) | Root element |
| Build heap | O(n) | Heapify from array |
| Heapify | O(log n) | Restore heap property |

### Heap Types
- **Min Heap:** Root is minimum, children ≥ parent
- **Max Heap:** Root is maximum, children ≤ parent
- **Binary Heap:** Complete binary tree in array

### Common Use Cases
✓ Priority queues
✓ Heap sort (O(n log n))
✓ Top K elements
✓ Median in stream (two heaps)
✓ Dijkstra's algorithm

### C# Implementation
- `.NET 6+:` `PriorityQueue<TElement, TPriority>`
- `SortedSet<T>` for ordered operations
- Array-based for custom needs

**Key Insight:** Heaps excel when you need repeated access to extremes (min/max)

---