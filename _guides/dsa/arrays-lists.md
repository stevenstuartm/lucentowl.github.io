---
title: "Arrays & Dynamic Arrays"
category: Data Structures & Algorithms
description: "Master static and dynamic arrays with O(1) access, amortized analysis, common techniques like two pointers and sliding window, and essential interview problems."
tags: [data-structures, algorithms, fundamentals, practical, interview-prep]
---

## Why Arrays Exist

Direct memory access enables O(1) lookups by index. Arrays store elements in contiguous memory locations, providing the fastest possible access to data when you know the position. Dynamic arrays solve the fixed-size limitation while maintaining the performance benefits.

## When to Use Arrays

**Use when:**
- Need random access by index
- Cache performance matters (sequential memory access)
- Simple sequential processing
- Memory usage predictability is important
- Working with numerical computations

**Don't use when:**
- Frequent insertions/deletions in middle (use linked structures)
- Unknown maximum size with strict memory constraints
- Need complex relationships between elements (use graphs)

**Modern reality:** Your default choice for most problems. Use `List<T>` in C#. These are dynamic arrays optimized by language developers.

---

## Static Arrays vs Dynamic Arrays

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Static Arrays</h4>
<ul>
<li><strong>Fixed size</strong> at creation time</li>
<li><strong>Contiguous memory</strong> allocation</li>
<li><strong>No resizing</strong> capability</li>
<li><strong>Lower overhead</strong> (no extra capacity)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Dynamic Arrays</h4>
<ul>
<li><strong>Resizable</strong> during runtime</li>
<li><strong>Contiguous memory</strong> with growth capability</li>
<li><strong>Amortized O(1)</strong> insertion at end</li>
<li><strong>Slight overhead</strong> for growth management</li>
</ul>
</div>
</div>

---

## Time Complexity

| Operation | Static Array | Dynamic Array | Notes |
|-----------|-------------|---------------|-------|
| **Access by index** | O(1) | O(1) | Direct memory calculation |
| **Search** | O(n) | O(n) | Must check each element |
| **Insert at end** | N/A | O(1) amortized | Occasionally O(n) for resize |
| **Insert at beginning** | N/A | O(n) | Shifts all elements |
| **Insert at position** | N/A | O(n) | Shifts elements after position |
| **Delete at end** | N/A | O(1) | No shifting required |
| **Delete at beginning** | N/A | O(n) | Shifts all elements |
| **Delete at position** | N/A | O(n) | Shifts elements after position |

---

## Static Arrays

### C# Implementation
```csharp
{% raw %}// C# has true static arrays
public class StaticArrayExample
{
    public static void DemonstrateStaticArrays()
    {
        // Static array declaration and initialization
        int[] numbers = new int[5];  // Fixed size of 5
        
        // Initialize with values
        int[] initialized = {1, 2, 3, 4, 5};
        
        // Or using array initializer syntax
        int[] another = new int[] {10, 20, 30};
        
        // Access and modify
        numbers[0] = 100;
        numbers[4] = 500;
        
        Console.WriteLine($"Length: {numbers.Length}");  // 5
        Console.WriteLine($"First: {numbers[0]}");       // 100
        Console.WriteLine($"Last: {numbers[4]}");        // 500
        
        // Iterate through array
        for (int i = 0; i < numbers.Length; i++)
        {
            Console.WriteLine($"numbers[{i}] = {numbers[i]}");
        }
        
        // Enhanced for loop
        foreach (int num in initialized)
        {
            Console.WriteLine(num);
        }
    }
}

// Custom static array class
public class StaticArray<T>
{
    private T[] data;
    private int size;
    
    public StaticArray(int size)
    {
        this.size = size;
        this.data = new T[size];
    }
    
    public T Get(int index)
    {
        if (index >= 0 && index < size)
            return data[index];
        throw new IndexOutOfRangeException("Index out of bounds");
    }
    
    public void Set(int index, T value)
    {
        if (index >= 0 && index < size)
            data[index] = value;
        else
            throw new IndexOutOfRangeException("Index out of bounds");
    }
    
    public int Length => size;
    
    public override string ToString()
    {
        return $"StaticArray[{string.Join(", ", data)}]";
    }
}
{% endraw %}
```

---

## Dynamic Arrays

### C# Implementation
```csharp
{% raw %}public class DynamicArray<T>
{
    private T[] data;
    private int size;
    private int capacity;
    
    public DynamicArray(int initialCapacity = 4)
    {
        capacity = initialCapacity;
        size = 0;
        data = new T[capacity];
    }
    
    public int Count => size;
    public int Capacity => capacity;
    
    public T this[int index]
    {
        get
        {
            if (index >= 0 && index < size)
                return data[index];
            throw new IndexOutOfRangeException("Index out of bounds");
        }
        set
        {
            if (index >= 0 && index < size)
                data[index] = value;
            else
                throw new IndexOutOfRangeException("Index out of bounds");
        }
    }
    
    public void Add(T value)
    {
        if (size >= capacity)
            Resize();
        
        data[size] = value;
        size++;
    }
    
    public void Insert(int index, T value)
    {
        if (index < 0 || index > size)
            throw new IndexOutOfRangeException("Index out of bounds");
        
        if (size >= capacity)
            Resize();
        
        // Shift elements to the right
        for (int i = size; i > index; i--)
        {
            data[i] = data[i - 1];
        }
        
        data[index] = value;
        size++;
    }
    
    public T RemoveAt(int index)
    {
        if (index < 0 || index >= size)
            throw new IndexOutOfRangeException("Index out of bounds");
        
        T removedValue = data[index];
        
        // Shift elements to the left
        for (int i = index; i < size - 1; i++)
        {
            data[i] = data[i + 1];
        }
        
        size--;
        data[size] = default(T); // Clear reference
        
        return removedValue;
    }
    
    public bool Remove(T value)
    {
        for (int i = 0; i < size; i++)
        {
            if (EqualityComparer<T>.Default.Equals(data[i], value))
            {
                RemoveAt(i);
                return true;
            }
        }
        return false;
    }
    
    private void Resize()
    {
        int oldCapacity = capacity;
        capacity *= 2;
        T[] newData = new T[capacity];
        
        Array.Copy(data, newData, size);
        data = newData;
        
        Console.WriteLine($"Resized from {oldCapacity} to {capacity}");
    }
    
    public override string ToString()
    {
        var elements = new string[size];
        for (int i = 0; i < size; i++)
        {
            elements[i] = data[i]?.ToString() ?? "null";
        }
        return $"DynamicArray([{string.Join(", ", elements)}])";
    }
}

// Example usage
var arr = new DynamicArray<string>();
Console.WriteLine($"Initial: {arr}, capacity: {arr.Capacity}");

// Add elements
for (int i = 0; i < 10; i++)
{
    arr.Add($"item_{i}");
    if (i == 3 || i == 7) // Show resize points
        Console.WriteLine($"After adding {i+1} items: {arr}");
}

Console.WriteLine($"Final: {arr}");

// Insert and remove
arr.Insert(0, "first");
arr.Insert(5, "middle");
Console.WriteLine($"After insertions: {arr}");

arr.Remove("item_3");
arr.RemoveAt(0);
Console.WriteLine($"After removals: {arr}");
{% endraw %}
```

---

## Amortized Analysis of Dynamic Arrays

### Why O(1) Amortized?

<div class="callout callout--note">
<p class="callout__title">Amortized Analysis Explained</p>
<p>When a dynamic array needs to resize:</p>
<ol>
<li><strong>Allocate</strong> new array (usually 2x size)</li>
<li><strong>Copy</strong> all existing elements</li>
<li><strong>Update</strong> pointer to new array</li>
</ol>
<p>Individual operations: Most appends are O(1), resize append is O(n). But resizing happens infrequently enough that the average cost per operation is O(1).</p>
</div>

Individual operations:
- Most appends: O(1)
- Resize append: O(n)

But resizing happens infrequently:
- Resize at sizes: 4, 8, 16, 32, 64, ...
- Between size n/2 and n, we do n/2 O(1) operations
- Total cost for n operations: O(n)
- Average cost per operation: O(1)

### Visual Example
```
{% raw %}Capacity: 4 -> 8 -> 16 -> 32
Operations to get to 32 elements:
- 32 individual O(1) appends
- 3 resize operations: O(4) + O(8) + O(16) = O(28)
- Total: O(32 + 28) = O(60) = O(n)
- Average per operation: O(60/32) ≈ O(1)
{% endraw %}
```

---

## Common Array Operations

### Searching
```csharp
{% raw %}public static class ArraySearching
{
    public static int LinearSearch<T>(T[] arr, T target) where T : IEquatable<T>
    {
        for (int i = 0; i < arr.Length; i++)
        {
            if (arr[i].Equals(target))
                return i;
        }
        return -1;
    }

    public static List<int> FindAllOccurrences<T>(T[] arr, T target) where T : IEquatable<T>
    {
        var indices = new List<int>();
        for (int i = 0; i < arr.Length; i++)
        {
            if (arr[i].Equals(target))
                indices.Add(i);
        }
        return indices;
    }

    // Example usage
    public static void DemonstrateSearching()
    {
        int[] arr = {1, 3, 7, 3, 9, 3};

        Console.WriteLine(LinearSearch(arr, 3));           // 1 (first occurrence)
        Console.WriteLine(FindAllOccurrences(arr, 3).Count); // 3 (total occurrences)
        Console.WriteLine(Array.IndexOf(arr, 3));          // 1 (built-in method)
        Console.WriteLine(arr.Contains(3));                // True (membership test)
    }
}
{% endraw %}
```

### Two Pointers Technique
```csharp
{% raw %}public static class TwoPointers
{
    public static void ReverseArray<T>(T[] arr)
    {
        int left = 0, right = arr.Length - 1;

        while (left < right)
        {
            // Swap elements
            T temp = arr[left];
            arr[left] = arr[right];
            arr[right] = temp;

            left++;
            right--;
        }
    }

    public static int RemoveDuplicatesSorted<T>(T[] arr) where T : IEquatable<T>
    {
        if (arr.Length == 0)
            return 0;

        int writeIndex = 1;

        for (int readIndex = 1; readIndex < arr.Length; readIndex++)
        {
            if (!arr[readIndex].Equals(arr[readIndex - 1]))
            {
                arr[writeIndex] = arr[readIndex];
                writeIndex++;
            }
        }

        return writeIndex; // New length
    }

    // Example usage
    public static void DemonstrateTwoPointers()
    {
        int[] numbers = {1, 2, 3, 4, 5};
        ReverseArray(numbers);
        Console.WriteLine(string.Join(", ", numbers)); // [5, 4, 3, 2, 1]

        int[] sortedWithDups = {1, 1, 2, 2, 2, 3, 4, 4, 5};
        int newLength = RemoveDuplicatesSorted(sortedWithDups);
        Console.WriteLine(string.Join(", ", sortedWithDups.Take(newLength))); // [1, 2, 3, 4, 5]
    }
}
{% endraw %}
```

### Sliding Window Technique
```csharp
{% raw %}public static class SlidingWindow
{
    public static int? MaxSumSubarray(int[] arr, int k)
    {
        if (arr.Length < k)
            return null;

        // Calculate sum of first window
        int windowSum = 0;
        for (int i = 0; i < k; i++)
        {
            windowSum += arr[i];
        }

        int maxSum = windowSum;

        // Slide the window
        for (int i = k; i < arr.Length; i++)
        {
            windowSum = windowSum - arr[i - k] + arr[i];
            maxSum = Math.Max(maxSum, windowSum);
        }

        return maxSum;
    }

    // Example usage
    public static void DemonstrateSlidingWindow()
    {
        int[] arr = {2, 1, 5, 1, 3, 2};
        Console.WriteLine(MaxSumSubarray(arr, 3)); // 9 (subarray [5, 1, 3])
    }
}
{% endraw %}
```

---

## Multi-dimensional Arrays

```csharp
{% raw %}// 2D arrays in C#
public static class Matrix2D
{
    public static void Demonstrate2DArrays()
    {
        // Rectangular array (true 2D array)
        int[,] matrix1 = new int[3, 4];
        int[,] matrix2 = {{1, 2, 3}, {4, 5, 6}};
        
        // Jagged array (array of arrays)
        int[][] jaggedArray = new int[3][];
        jaggedArray[0] = new int[4];
        jaggedArray[1] = new int[3];
        jaggedArray[2] = new int[2];
        
        // Initialize and access
        matrix1[0, 0] = 1;
        matrix1[1, 2] = 5;
        
        Console.WriteLine($"Rows: {matrix1.GetLength(0)}");
        Console.WriteLine($"Cols: {matrix1.GetLength(1)}");
        
        // Iterate through 2D array
        for (int i = 0; i < matrix1.GetLength(0); i++)
        {
            for (int j = 0; j < matrix1.GetLength(1); j++)
            {
                Console.Write($"{matrix1[i, j]} ");
            }
            Console.WriteLine();
        }
    }
    
    public static int[,] MatrixAdd(int[,] a, int[,] b)
    {
        int rows = a.GetLength(0);
        int cols = a.GetLength(1);
        int[,] result = new int[rows, cols];
        
        for (int i = 0; i < rows; i++)
        {
            for (int j = 0; j < cols; j++)
            {
                result[i, j] = a[i, j] + b[i, j];
            }
        }
        
        return result;
    }
}
{% endraw %}
```

---

## Interview Problems

### 1. Rotate Array
```csharp
{% raw %}public static class ArrayRotation
{
    public static int[] RotateArrayRight(int[] arr, int k)
    {
        if (arr.Length == 0)
            return arr;

        int n = arr.Length;
        k = k % n; // Handle k > n

        // Method 1: Using extra space
        int[] result = new int[n];
        for (int i = 0; i < n; i++)
        {
            result[(i + k) % n] = arr[i];
        }

        return result;
    }

    public static void RotateArrayInPlace(int[] arr, int k)
    {
        if (arr.Length == 0)
            return;

        int n = arr.Length;
        k = k % n;

        // Reverse entire array
        Reverse(arr, 0, n - 1);
        // Reverse first k elements
        Reverse(arr, 0, k - 1);
        // Reverse remaining elements
        Reverse(arr, k, n - 1);
    }

    private static void Reverse(int[] arr, int start, int end)
    {
        while (start < end)
        {
            int temp = arr[start];
            arr[start] = arr[end];
            arr[end] = temp;
            start++;
            end--;
        }
    }

    // Example usage
    public static void DemonstrateRotation()
    {
        int[] arr1 = {1, 2, 3, 4, 5, 6, 7};
        int[] rotated = RotateArrayRight(arr1, 3);
        Console.WriteLine(string.Join(", ", rotated)); // [5, 6, 7, 1, 2, 3, 4]

        int[] arr2 = {1, 2, 3, 4, 5, 6, 7};
        RotateArrayInPlace(arr2, 3);
        Console.WriteLine(string.Join(", ", arr2)); // [5, 6, 7, 1, 2, 3, 4]
    }
}
{% endraw %}
```

### 2. Merge Sorted Arrays
```csharp
{% raw %}public static class ArrayMerging
{
    public static int[] MergeSortedArrays(int[] arr1, int[] arr2)
    {
        var result = new List<int>();
        int i = 0, j = 0;

        while (i < arr1.Length && j < arr2.Length)
        {
            if (arr1[i] <= arr2[j])
            {
                result.Add(arr1[i]);
                i++;
            }
            else
            {
                result.Add(arr2[j]);
                j++;
            }
        }

        // Add remaining elements
        while (i < arr1.Length)
        {
            result.Add(arr1[i]);
            i++;
        }

        while (j < arr2.Length)
        {
            result.Add(arr2[j]);
            j++;
        }

        return result.ToArray();
    }

    // Example usage
    public static void DemonstrateMerging()
    {
        int[] arr1 = {1, 3, 5, 7};
        int[] arr2 = {2, 4, 6, 8, 9};
        int[] merged = MergeSortedArrays(arr1, arr2);
        Console.WriteLine(string.Join(", ", merged)); // [1, 2, 3, 4, 5, 6, 7, 8, 9]
    }
}
{% endraw %}
```

### 3. Find Peak Element
```csharp
{% raw %}public static class PeakFinding
{
    public static int FindPeakElement(int[] arr)
    {
        int n = arr.Length;
        if (n == 1)
            return 0;

        // Check first element
        if (arr[0] > arr[1])
            return 0;

        // Check last element
        if (arr[n - 1] > arr[n - 2])
            return n - 1;

        // Check middle elements
        for (int i = 1; i < n - 1; i++)
        {
            if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1])
                return i;
        }

        return -1; // No peak found
    }

    // Binary search approach for better performance
    public static int FindPeakBinary(int[] arr)
    {
        int left = 0, right = arr.Length - 1;

        while (left < right)
        {
            int mid = left + (right - left) / 2;

            if (arr[mid] > arr[mid + 1])
                right = mid;
            else
                left = mid + 1;
        }

        return left;
    }

    // Example usage
    public static void DemonstratePeakFinding()
    {
        int[] peaks = {1, 2, 3, 1};
        Console.WriteLine(FindPeakElement(peaks)); // 2 (element 3 is peak)
        Console.WriteLine(FindPeakBinary(peaks));  // 2
    }
}
{% endraw %}
```

## Modern Usage

**C#:** Use `List<T>` for dynamic behavior, arrays for fixed-size scenarios
**Performance:** Built-in implementations are heavily optimized with native code

**Key Takeaways:**
- Arrays are the foundation of most data structures
- Understand the difference between static and dynamic arrays
- Know when O(1) amortized means and why it matters
- Master common patterns: two pointers, sliding window, array manipulation
- Use language built-ins in production, implement from scratch in interviews