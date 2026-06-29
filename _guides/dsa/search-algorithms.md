---
title: "Search Algorithms"
category: Data Structures & Algorithms
description: "Compare linear and binary search algorithms with complexity analysis, when to use each approach, and implementing efficient search strategies."
tags: [algorithms, searching, complexity-analysis, practical, interview-prep]
---

## Why Searching Exists
Finding specific data efficiently is fundamental to most applications. The choice of search algorithm can mean the difference between instant response and waiting minutes for results.

---

## Linear Search

### When to Use Linear Search

**Use when:**
- Data is unsorted and can't be sorted
- Very small datasets (<20 items)
- Searching for multiple matches
- Simple one-time searches
- Need to find all occurrences of a value

**Don't use when:**
- Data can be sorted (use binary search instead)
- Searching repeatedly on same dataset
- Large datasets (>1000 items)
- Performance is critical

**Modern reality:** Built into language methods like C#'s `Contains()`, `IndexOf()`, and LINQ methods. Understand the concept but use built-ins in production.

### Time Complexity
- **Best case:** O(1) - element is first
- **Average case:** O(n/2) = O(n)  
- **Worst case:** O(n) - element is last or not found
- **Space complexity:** O(1)

### C# Implementation
```csharp
public static class LinearSearch
{
    public static int Search<T>(T[] searchList, T targetValue) where T : IEquatable<T>
    {
        for (int idx = 0; idx < searchList.Length; idx++)
        {
            Console.WriteLine($"Checking index {idx}: {searchList[idx]}");
            if (searchList[idx].Equals(targetValue))
            {
                Console.WriteLine($"Found {targetValue} at index {idx}");
                return idx;
            }
        }
        
        throw new ArgumentException($"{targetValue} not found in list");
    }
    
    public static List<int> SearchAll<T>(T[] searchList, T targetValue) where T : IEquatable<T>
    {
        var indices = new List<int>();
        for (int idx = 0; idx < searchList.Length; idx++)
        {
            if (searchList[idx].Equals(targetValue))
            {
                indices.Add(idx);
            }
        }
        return indices;
    }
}

// Example usage
string[] recipe = {"nori", "tuna", "soy sauce", "sushi rice", "tuna"};

try
{
    int index = LinearSearch.Search(recipe, "tuna");
    Console.WriteLine($"First occurrence of 'tuna' at index {index}");
}
catch (ArgumentException e)
{
    Console.WriteLine(e.Message);
}

// Find all occurrences
var allIndices = LinearSearch.SearchAll(recipe, "tuna");
Console.WriteLine($"All occurrences of 'tuna': [{string.Join(", ", allIndices)}]");
```

---

## Binary Search

### When to Use Binary Search

**Use when:**
- Data is sorted (or can be sorted once)
- Searching repeatedly on same dataset
- Large datasets where O(log n) vs O(n) matters
- Need guaranteed logarithmic performance

**Don't use when:**
- Data is unsorted and can't be sorted
- One-time searches on small data
- Frequent insertions/deletions (ruins sorted property)

**Modern reality:** Implement this yourself in interviews. Use built-ins like `Array.BinarySearch()` and `List<T>.BinarySearch()` in C# for production.

### Time Complexity
- **All cases:** O(log n)
- **Space complexity:** O(1) iterative, O(log n) recursive (call stack)

### Key Insight
Binary search works by repeatedly dividing the search space in half. Each comparison eliminates half of the remaining elements.

### C# Implementation
```csharp
public static class BinarySearch
{
    // Recursive version
    public static int SearchRecursive<T>(T[] sortedList, int leftPointer, int rightPointer, T target) 
        where T : IComparable<T>
    {
        // Base case: search space is empty
        if (leftPointer >= rightPointer)
            return -1;
        
        // Find middle point
        int midIdx = (leftPointer + rightPointer) / 2;
        T midVal = sortedList[midIdx];
        
        Console.WriteLine($"Range [{leftPointer}:{rightPointer}], mid={midIdx}, value={midVal}");
        
        int comparison = midVal.CompareTo(target);
        if (comparison == 0)
            return midIdx;
        else if (comparison > 0)
            // Target is in left half
            return SearchRecursive(sortedList, leftPointer, midIdx, target);
        else
            // Target is in right half
            return SearchRecursive(sortedList, midIdx + 1, rightPointer, target);
    }
    
    // Iterative version (preferred)
    public static int SearchIterative<T>(T[] sortedList, T target) where T : IComparable<T>
    {
        int leftPointer = 0;
        int rightPointer = sortedList.Length;
        
        while (leftPointer < rightPointer)
        {
            int midIdx = (leftPointer + rightPointer) / 2;
            T midVal = sortedList[midIdx];
            
            Console.WriteLine($"Range [{leftPointer}:{rightPointer}], mid={midIdx}, value={midVal}");
            
            int comparison = midVal.CompareTo(target);
            if (comparison == 0)
                return midIdx;
            else if (comparison > 0)
                rightPointer = midIdx;
            else
                leftPointer = midIdx + 1;
        }
        
        return -1; // Not found
    }
}

// Example usage
int[] values = {77, 80, 102, 123, 288, 300, 540};
int result = BinarySearch.SearchRecursive(values, 0, values.Length, 288);
Console.WriteLine($"Element 288 found at index: {result}");

// Test cases
int[] testArray = {5, 6, 7, 8, 9};
Console.WriteLine($"Search for 9: {BinarySearch.SearchIterative(testArray, 9)}");   // 4
Console.WriteLine($"Search for 10: {BinarySearch.SearchIterative(testArray, 10)}"); // -1
Console.WriteLine($"Search for 8: {BinarySearch.SearchIterative(testArray, 8)}");   // 3
```

## Binary Search Variations

### 1. Find First Occurrence

### 2. Find Last Occurrence

### 3. Search Insert Position

## Common Interview Problems

### 1. Search in Rotated Sorted Array

### 2. Find Peak Element

## Performance Comparison

### Search Performance on Large Dataset

## Modern Usage

**C#:**
- Use `Array.BinarySearch()` for arrays
- Use `List<T>.BinarySearch()` for lists
- Use `Contains()` for membership testing
- Use LINQ methods like `Where()`, `First()`, `Any()` for complex searches
- Use `IndexOf()` and `FindIndex()` for finding positions

<div class="callout callout--tip">
<p class="callout__title">Interview Tip</p>
<p>Always ask if data is sorted before choosing a search algorithm. This single question determines whether you should use O(n) linear search or O(log n) binary search.</p>
</div>

## Key Interview Points

1. **Always ask if data is sorted**: This determines algorithm choice
## Quick Reference

### Search Algorithm Comparison
| Algorithm | Time | Space | Prerequisites | Best For |
|-----------|------|-------|---------------|----------|
| Linear Search | O(n) | O(1) | None | Small/unsorted data |
| Binary Search | O(log n) | O(1) | Sorted array | Large sorted data |
| Hash Table | O(1) avg | O(n) | Good hash function | Key-value lookups |

### Decision Flow
```
Is data sorted?
├─ Yes → Binary Search O(log n)
└─ No → Multiple searches?
   ├─ Yes → Hash Table O(1) per search
   └─ No → Linear Search O(n)
```

### Binary Search Variants
- **Standard:** Find any occurrence
- **First/Last:** Find boundary of duplicates
- **Insert Position:** Where to insert to maintain sort
- **Rotated Array:** Find in sorted-rotated array

---