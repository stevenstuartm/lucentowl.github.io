---
title: "Hash Tables"
category: Data Structures & Algorithms
description: "Master hash tables with O(1) average lookups, collision resolution strategies, hash function design, and practical applications from caching to frequency counting."
tags: [data-structures, algorithms, hash-tables, performance, practical, fundamentals]
---

## Why Hash Tables Exist

*Concept pioneered by Hans Peter Luhn at IBM (1953), formalized as "hash tables" in the 1960s*

Provides average O(1) lookups by trading space for time using mathematical hashing. This is the fundamental trade-off that powers most modern software, from database indexes to compiler symbol tables.

## When to Use Hash Tables

**✅ Use when:**
- Need fast lookups by key
- Counting frequencies of items
- Caching computed results
- Implementing sets (unique values)
- Building lookup tables or indexes

**❌ Don't use when:**
- Need to maintain ordering of elements
- Memory is extremely constrained
- Keys don't hash well (cause many collisions)
- Need to iterate in sorted order

**🏢 Modern reality:** Your go-to data structure. Use `Dictionary<K,V>` in C#. Hash tables power most modern software: databases, caches, compilers, and more.

## Time Complexity
- **Average case:** O(1) for all operations (lookup, insert, delete)
- **Worst case:** O(n) when many collisions occur
- **Space:** O(n) for storing key-value pairs

## How Hash Tables Work

1. **Hash Function:** Converts key to array index
2. **Compression:** Map hash code to array size using modulo
3. **Collision Handling:** Deal with multiple keys mapping to same index

## Collision Resolution Strategies

<div class="callout callout--note">
<p class="callout__title">The Collision Problem</p>
<p>Multiple keys may hash to the same index. With n items and m slots, by the pigeonhole principle, collisions are inevitable when n > m.</p>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Separate Chaining (Most Common)</h4>
<ul>
<li>Each array slot holds a linked list (or dynamic array) of key-value pairs</li>
<li><strong>Pros:</strong> Simple, never "full", handles high load factors (even > 1.0)</li>
<li><strong>Cons:</strong> Extra memory for pointers, poor cache locality</li>
<li><strong>Used by:</strong> Java's HashMap, Python's dict (historically)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Open Addressing (Linear Probing)</h4>
<ul>
<li>When collision occurs, probe next slot(s) until finding empty space</li>
<li><strong>Pros:</strong> Better cache performance, no pointer overhead, all data in one array</li>
<li><strong>Cons:</strong> Clustering issues, table can become full, deletions tricky</li>
<li><strong>Variants:</strong> Linear probing, Quadratic probing, Double hashing</li>
</ul>
</div>
</div>

### Modern Approach
Many modern implementations use hybrid strategies or sophisticated open addressing:
- **Robin Hood Hashing:** Minimizes variance in probe lengths
- **Cuckoo Hashing:** Uses multiple hash functions and tables for guaranteed O(1) worst-case lookup

## C# Implementation

```csharp
public class HashMap<TKey, TValue>
{
    private int arraySize;
    private (TKey key, TValue value)?[] array;
    
    public HashMap(int arraySize)
    {
        this.arraySize = arraySize;
        array = new (TKey key, TValue value)?[arraySize];
    }
    
    private int Hash(TKey key, int countCollisions = 0)
    {
        int hashCode = key.GetHashCode();
        return Math.Abs(hashCode + countCollisions);
    }
    
    private int Compressor(int hashCode)
    {
        return hashCode % arraySize;
    }
    
    public void Assign(TKey key, TValue value)
    {
        int arrayIndex = Compressor(Hash(key));
        var currentArrayValue = array[arrayIndex];
        
        // Empty slot - insert directly
        if (!currentArrayValue.HasValue)
        {
            array[arrayIndex] = (key, value);
            return;
        }
        
        // Key already exists - update value
        if (EqualityComparer<TKey>.Default.Equals(currentArrayValue.Value.key, key))
        {
            array[arrayIndex] = (key, value);
            return;
        }
        
        // Collision - use linear probing
        int numberCollisions = 1;
        while (!EqualityComparer<TKey>.Default.Equals(currentArrayValue.Value.key, key))
        {
            int newHashCode = Hash(key, numberCollisions);
            int newArrayIndex = Compressor(newHashCode);
            currentArrayValue = array[newArrayIndex];
            
            if (!currentArrayValue.HasValue)
            {
                array[newArrayIndex] = (key, value);
                return;
            }
            
            if (EqualityComparer<TKey>.Default.Equals(currentArrayValue.Value.key, key))
            {
                array[newArrayIndex] = (key, value);
                return;
            }
            
            numberCollisions++;
            
            // Prevent infinite loop if table is full
            if (numberCollisions >= arraySize)
            {
                throw new InvalidOperationException("HashMap is full");
            }
        }
    }
    
    public TValue Retrieve(TKey key)
    {
        int arrayIndex = Compressor(Hash(key));
        var possibleReturnValue = array[arrayIndex];
        
        if (!possibleReturnValue.HasValue)
        {
            return default(TValue);
        }
        
        if (EqualityComparer<TKey>.Default.Equals(possibleReturnValue.Value.key, key))
        {
            return possibleReturnValue.Value.value;
        }
        
        // Handle collision case
        int retrievalCollisions = 1;
        while (possibleReturnValue.HasValue && 
               !EqualityComparer<TKey>.Default.Equals(possibleReturnValue.Value.key, key))
        {
            int newHashCode = Hash(key, retrievalCollisions);
            int retrievingArrayIndex = Compressor(newHashCode);
            possibleReturnValue = array[retrievingArrayIndex];
            
            if (!possibleReturnValue.HasValue)
            {
                return default(TValue);
            }
            
            if (EqualityComparer<TKey>.Default.Equals(possibleReturnValue.Value.key, key))
            {
                return possibleReturnValue.Value.value;
            }
            
            retrievalCollisions++;
            
            // Prevent infinite loop
            if (retrievalCollisions >= arraySize)
            {
                break;
            }
        }
        
        return default(TValue);
    }
}

// Example usage
var hashMap = new HashMap<string, string>(16);
hashMap.Assign("name", "Alice");
hashMap.Assign("age", "25");
hashMap.Assign("city", "NYC");

Console.WriteLine(hashMap.Retrieve("name"));    // "Alice"
Console.WriteLine(hashMap.Retrieve("age"));     // "25"  
Console.WriteLine(hashMap.Retrieve("missing")); // null or default
```

## Common Hash Table Applications

### Frequency Counting

### Caching/Memoization

### Two-Sum Problem (Interview Classic)

## Performance Considerations

**Load Factor:** Ratio of filled slots to total slots
- Keep load factor < 0.7 for good performance
- Resize table when load factor gets too high

**Hash Function Quality:**
- Good distribution reduces collisions
- C# has optimized hash functions for built-in types via `GetHashCode()`

**Collision Strategy Impact:**
- Linear probing: Good cache performance but clustering issues
- Separate chaining: More memory overhead but handles high load factors better

## Interview Tips

**Common Questions:**
1. Implement basic hash table operations
2. Handle collisions gracefully  
3. Explain time complexity trade-offs
4. Solve problems using hash tables (two-sum, anagrams, etc.)

## Quick Reference

### Hash Table Operations
| Operation | Average | Worst Case | Notes |
|-----------|---------|------------|-------|
| Insert | O(1) | O(n) | Amortized with resizing |
| Search | O(1) | O(n) | Depends on collisions |
| Delete | O(1) | O(n) | Same as search |

### Collision Handling
- **Chaining:** Use linked lists at each bucket (flexible, handles any load)
- **Open Addressing:** Find next empty slot (better cache, fixed size)

### C# Built-ins
- `Dictionary<K,V>` - Standard hash table
- `HashSet<T>` - Set operations, unique values
- `ConcurrentDictionary<K,V>` - Thread-safe

**Key Trade-off:** Memory for speed: O(1) operations at cost of O(n) space

---