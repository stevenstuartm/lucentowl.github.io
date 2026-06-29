---
title: "Sorting Algorithms"
category: Data Structures & Algorithms
description: "Comprehensive guide to sorting algorithms from bubble sort to quick sort, with complexity comparisons, stability analysis, and practical selection criteria."
tags: [algorithms, sorting, complexity-analysis, practical, interview-prep]
---

## Why Sorting Exists
Sorted data enables binary search (O(log n) vs O(n)) and makes many operations faster: searching, finding duplicates, merging datasets, and range queries. Sorting is often a preprocessing step that makes everything else efficient.

## Algorithm Selection Guide

| Algorithm | Best Case | Average | Worst Case | Space | When to Use |
|-----------|-----------|---------|------------|-------|-------------|
| **Bubble Sort** | O(n) | O(n²) | O(n²) | O(1) | Never (educational only) |
| **Insertion Sort** | O(n) | O(n²) | O(n²) | O(1) | Small arrays (<10), nearly sorted |
| **Selection Sort** | O(n²) | O(n²) | O(n²) | O(1) | Never (consistently slow) |
| **Merge Sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | Stable sort needed, linked lists |
| **Quick Sort** | O(n log n) | O(n log n) | O(n²) | O(log n) | General purpose, space-constrained |
| **Heap Sort** | O(n log n) | O(n log n) | O(n log n) | O(1) | Guaranteed performance |
| **Built-in Sort** | O(n) | O(n log n) | O(n log n) | O(n) | Production code (always use this) |

---

## Bubble Sort

### When to Use Bubble Sort

**Use when:**
- Teaching algorithms to beginners
- Very small datasets (<10 items)  
- Simplicity matters more than performance
- Educational/demonstration purposes

**Don't use when:**
- Performance matters at all
- Datasets larger than 50 items
- Production code (never)

**Modern reality:** Never use in production. Educational only.

### Time Complexity
- **Best case:** O(n) - already sorted
- **Average case:** O(n²)
- **Worst case:** O(n²)
- **Space complexity:** O(1)

### How It Works
Repeatedly steps through the list, compares adjacent elements and swaps them if they're in wrong order. "Bubbles" largest elements to the end.

### C# Implementation
```csharp
public static class BubbleSort
{
    public static T[] Sort<T>(T[] arr) where T : IComparable<T>
    {
        int n = arr.Length;
        T[] result = (T[])arr.Clone();
        
        for (int i = 0; i < n; i++)
        {
            bool swapped = false;
            
            // Last i elements are already in place
            for (int j = 0; j < n - i - 1; j++)
            {
                Console.WriteLine($"Comparing {result[j]} and {result[j + 1]}");
                
                if (result[j].CompareTo(result[j + 1]) > 0)
                {
                    // Swap elements
                    T temp = result[j];
                    result[j] = result[j + 1];
                    result[j + 1] = temp;
                    swapped = true;
                    Console.WriteLine($"Swapped! Array is now: [{string.Join(", ", result)}]");
                }
            }
            
            // If no swapping occurred, array is sorted
            if (!swapped)
            {
                Console.WriteLine($"No swaps in pass {i + 1}, array is sorted!");
                break;
            }
        }
        
        return result;
    }
}

// Example usage
int[] numbers = {64, 34, 25, 12, 22, 11, 90};
Console.WriteLine($"Original: [{string.Join(", ", numbers)}]");
int[] sortedNumbers = BubbleSort.Sort(numbers);
Console.WriteLine($"Sorted: [{string.Join(", ", sortedNumbers)}]");
```

---

## Merge Sort

*Invented by John von Neumann in 1945 for the EDVAC computer*

### When to Use Merge Sort

**Use when:**
- Need stable sort (maintains relative order of equal elements)
- Guaranteed O(n log n) performance required (no worst case degradation)
- Working with linked lists (natural fit, can be done in-place)
- External sorting (data doesn't fit in memory - can merge disk-based chunks)
- Parallel processing available (divide-and-conquer parallelizes well)

**Don't use when:**
- Memory is severely constrained (uses O(n) extra space for arrays)
- In-place sorting required
- Small datasets (overhead not worth it, use insertion sort for n < 10-20)

**Modern reality:** Often the algorithm behind language built-ins (Python's Timsort is derived from merge sort). Use `Array.Sort()` and `List<T>.Sort()` instead of implementing.

<div class="callout callout--tip">
<p class="callout__title">Merge Sort Advantage</p>
<p>Merge sort has consistent O(n log n) performance in all cases. Unlike quick sort, it never degrades to O(n²), making it ideal when worst-case guarantees matter.</p>
</div>

### Time Complexity
- **Best case:** O(n log n)
- **Average case:** O(n log n)
- **Worst case:** O(n log n) - **always consistent!**
- **Space complexity:** O(n) for arrays, O(log n) for linked lists

### How It Works
Classic divide-and-conquer algorithm:
1. **Divide:** Split array into two halves recursively until single elements
2. **Conquer:** Single elements are already sorted
3. **Combine:** Merge sorted halves back together in order

**Key insight:** Merging two sorted arrays into one sorted array is O(n) and simple.

### C# Implementation
```csharp
public static class MergeSort
{
    public static T[] Sort<T>(T[] items) where T : IComparable<T>
    {
        if (items.Length <= 1)
            return (T[])items.Clone();
        
        // Divide: split array in half
        int middleIndex = items.Length / 2;
        T[] leftSplit = new T[middleIndex];
        T[] rightSplit = new T[items.Length - middleIndex];
        
        Array.Copy(items, 0, leftSplit, 0, middleIndex);
        Array.Copy(items, middleIndex, rightSplit, 0, items.Length - middleIndex);
        
        Console.WriteLine($"Splitting: [{string.Join(", ", items)}]");
        Console.WriteLine($"Left: [{string.Join(", ", leftSplit)}] | Right: [{string.Join(", ", rightSplit)}]");
        
        // Conquer: recursively sort both halves
        T[] leftSorted = Sort(leftSplit);
        T[] rightSorted = Sort(rightSplit);
        
        // Combine: merge sorted halves
        T[] result = Merge(leftSorted, rightSorted);
        Console.WriteLine($"Merged result: [{string.Join(", ", result)}]");
        
        return result;
    }
    
    private static T[] Merge<T>(T[] left, T[] right) where T : IComparable<T>
    {
        var result = new List<T>();
        int leftIndex = 0;
        int rightIndex = 0;
        
        // Merge while both arrays have elements
        while (leftIndex < left.Length && rightIndex < right.Length)
        {
            if (left[leftIndex].CompareTo(right[rightIndex]) <= 0)
            {
                result.Add(left[leftIndex]);
                leftIndex++;
            }
            else
            {
                result.Add(right[rightIndex]);
                rightIndex++;
            }
        }
        
        // Add remaining elements
        while (leftIndex < left.Length)
        {
            result.Add(left[leftIndex]);
            leftIndex++;
        }
        
        while (rightIndex < right.Length)
        {
            result.Add(right[rightIndex]);
            rightIndex++;
        }
        
        return result.ToArray();
    }
}

// Example usage
int[] unorderedList = {356, 746, 264, 569, 949, 895, 125, 455};
Console.WriteLine($"Original: [{string.Join(", ", unorderedList)}]");
int[] orderedList = MergeSort.Sort(unorderedList);
Console.WriteLine($"Final sorted: [{string.Join(", ", orderedList)}]");
```

---

## Quick Sort

*Developed by Tony Hoare in 1959, published in 1961. One of the most important algorithms of the 20th century*

### When to Use Quick Sort

**Use when:**
- Average case performance is critical (fastest in practice despite O(n²) worst case)
- In-place sorting needed (minimal memory usage)
- General-purpose sorting
- Memory is constrained (only O(log n) stack space)
- Cache efficiency matters (excellent locality of reference)

**Don't use when:**
- Worst-case guarantees needed (can degrade to O(n²))
- Stability required (doesn't maintain relative order of equal elements)
- Data is already sorted or reverse sorted without random pivot selection

**Modern reality:** Default sort in many languages, but production implementations use hybrid approaches:
- **Introsort** (C++ std::sort): QuickSort + HeapSort fallback when recursion depth exceeds threshold
- **Tim Sort** (Python, Java): Merge sort variant optimized for real-world data
- Modern QuickSort uses **median-of-three** or **random pivot** to avoid worst case

### Time Complexity
- **Best case:** O(n log n) - pivot always splits array evenly
- **Average case:** O(n log n) - with random pivot, highly likely
- **Worst case:** O(n²) - pivot is always smallest/largest (sorted input with poor pivot selection)
- **Space complexity:** O(log n) for recursion stack (average), O(n) worst case

### How It Works
Divide-and-conquer with in-place partitioning:
1. **Choose pivot:** Select element (random, median-of-three, or last element)
2. **Partition:** Rearrange so elements < pivot are left, > pivot are right
3. **Recursively sort:** Apply QuickSort to left and right partitions
4. **Base case:** Arrays of size 0 or 1 are already sorted

**Key insight:** After each partition, the pivot is in its final sorted position.

### C# Implementation
```csharp
public static class QuickSort
{
    private static Random random = new Random();
    
    public static void Sort<T>(T[] arr, int start = 0, int? end = null) where T : IComparable<T>
    {
        if (end == null)
            end = arr.Length - 1;
        
        // Base case: single element or empty
        if (start >= end)
            return;
        
        Console.WriteLine($"Sorting range [{start}:{end}] = [{string.Join(", ", arr[start..(end.Value + 1)])}]");
        
        // Select random pivot and move to end
        int pivotIdx = random.Next(start, end.Value + 1);
        Swap(arr, end.Value, pivotIdx);
        T pivotElement = arr[end.Value];
        
        Console.WriteLine($"Selected pivot: {pivotElement}");
        
        // Partition: move elements smaller than pivot to left
        int lessThanPointer = start;
        
        for (int i = start; i < end; i++)
        {
            if (arr[i].CompareTo(pivotElement) < 0)
            {
                Swap(arr, i, lessThanPointer);
                lessThanPointer++;
            }
        }
        
        // Move pivot to its correct position
        Swap(arr, end.Value, lessThanPointer);
        
        Console.WriteLine($"After partition: [{string.Join(", ", arr)}] (pivot at index {lessThanPointer})");
        
        // Recursively sort left and right subarrays
        Sort(arr, start, lessThanPointer - 1);
        Sort(arr, lessThanPointer + 1, end);
    }
    
    private static void Swap<T>(T[] arr, int i, int j)
    {
        T temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}

// Example usage
int[] testList = {5, 3, 1, 7, 4, 6, 2, 8};
Console.WriteLine($"Before sorting: [{string.Join(", ", testList)}]");
QuickSort.Sort(testList);
Console.WriteLine($"After sorting: [{string.Join(", ", testList)}]");
```

---

## Heap Sort

### When to Use Heap Sort

**Use when:**
- Guaranteed O(n log n) performance required
- In-place sorting needed (O(1) space)
- Consistent performance more important than average-case speed
- Memory usage must be predictable

**Don't use when:**
- Stability required
- Cache performance is critical
- Average case performance is more important than worst case

**Modern reality:** Rarely implemented manually. Used in hybrid algorithms like introsort.

### Time Complexity
- **All cases:** O(n log n)
- **Space complexity:** O(1)

### How It Works
1. Build a max-heap from the array
2. Repeatedly extract the maximum (root) and place at end
3. Restore heap property and repeat

### C# Implementation
```csharp
public static class HeapSort
{
    public static void Sort<T>(T[] arr) where T : IComparable<T>
    {
        int n = arr.Length;
        
        // Build max heap
        Console.WriteLine("Building max heap...");
        for (int i = n / 2 - 1; i >= 0; i--)
        {
            Heapify(arr, n, i);
        }
        
        Console.WriteLine($"Max heap built: [{string.Join(", ", arr)}]");
        
        // Extract elements from heap one by one
        for (int i = n - 1; i > 0; i--)
        {
            // Move current root (maximum) to end
            Swap(arr, 0, i);
            Console.WriteLine($"Moved {arr[i]} to position {i}: [{string.Join(", ", arr)}]");
            
            // Heapify reduced heap
            Heapify(arr, i, 0);
        }
    }
    
    private static void Heapify<T>(T[] arr, int n, int i) where T : IComparable<T>
    {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;
        
        // Compare with left child
        if (left < n && arr[left].CompareTo(arr[largest]) > 0)
        {
            largest = left;
        }
        
        // Compare with right child
        if (right < n && arr[right].CompareTo(arr[largest]) > 0)
        {
            largest = right;
        }
        
        // If largest is not root, swap and continue heapifying
        if (largest != i)
        {
            Swap(arr, i, largest);
            Console.WriteLine($"Heapify swap: [{string.Join(", ", arr)}]");
            Heapify(arr, n, largest);
        }
    }
    
    private static void Swap<T>(T[] arr, int i, int j)
    {
        T temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}

// Example usage
int[] testList = {99, 22, 61, 10, 21, 13, 23};
Console.WriteLine($"Original: [{string.Join(", ", testList)}]");
HeapSort.Sort(testList);
Console.WriteLine($"Sorted: [{string.Join(", ", testList)}]");
```

## Sorting Algorithm Comparison

### Performance Characteristics

### Stability Comparison

## Modern Built-in Sorting

### C# - Introsort
```csharp
// C#'s Array.Sort() and List<T>.Sort() use introsort
// - Hybrid of quicksort, heapsort, and insertion sort
// - Switches algorithms based on partition size and recursion depth
// - Not stable by default, but performs well

int[] numbers = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3};

// In-place sorting
Array.Sort(numbers);

// Or with List<T>
var list = new List<int>(numbers);
list.Sort();

// Custom comparison
Array.Sort(numbers, (x, y) => y.CompareTo(x)); // Reverse sort

// Stable sort available
var stableArray = numbers.OrderBy(x => x).ToArray(); // LINQ - stable
```

## Quick Reference

### Sorting Algorithm Comparison
| Algorithm | Best | Average | Worst | Space | Stable |
|-----------|------|---------|-------|-------|--------|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) | No |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |

### Selection Guide
- **Small data (<50):** Built-in or Insertion Sort
- **Need stability:** Merge Sort
- **Memory limited:** Quick Sort or Heap Sort
- **Worst-case guarantee:** Merge Sort or Heap Sort
- **Production:** Use `Array.Sort()` or `List<T>.Sort()` (optimized hybrids)

### Key Concepts
- **Stable:** Preserves relative order of equal elements
- **In-place:** Uses O(1) extra space
- **Divide & Conquer:** Merge/Quick sort pattern

---