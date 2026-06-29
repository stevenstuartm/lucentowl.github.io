---
title: "Linked Lists"
category: Data Structures & Algorithms
description: "Learn singly and doubly linked lists with implementations, time complexity analysis, and common interview problems including cycle detection and reversal."
tags: [data-structures, algorithms, fundamentals, practical, interview-prep]
---

## Why Linked Lists Exist

Dynamic sizing without pre-allocating memory, efficient insertion/deletion anywhere. They solve the fixed-size problem of static arrays while allowing insertion/deletion at arbitrary positions.

## When to Use Linked Lists

**Use when:**
- Frequent insertions/deletions at arbitrary positions
- Unknown final size and memory efficiency matters
- Implementing other data structures (stacks, queues)
- Memory is fragmented and you can't allocate large contiguous blocks

**Don't use when:**
- Need random access by index
- Cache performance is critical (arrays have better locality)
- Memory overhead is a concern (extra pointers per node)
- Working with small, fixed-size datasets

**Modern reality:** Most languages have dynamic arrays (C# `List<T>`) that are usually better. Linked lists are primarily educational or for very specific use cases.

## Time Complexity

| Operation | Singly Linked | Doubly Linked | Array |
|-----------|---------------|---------------|-------|
| **Access by index** | O(n) | O(n) | O(1) |
| **Search** | O(n) | O(n) | O(n) |
| **Insert at beginning** | O(1) | O(1) | O(n) |
| **Insert at end** | O(n) or O(1)* | O(1) | O(1) amortized |
| **Insert at position** | O(n) | O(n) | O(n) |
| **Delete at beginning** | O(1) | O(1) | O(n) |
| **Delete at end** | O(n) | O(1) | O(1) |

*O(1) if you maintain a tail pointer

## Node Implementation

### Node Implementation
```csharp
public class Node<T>
{
    public T Value { get; set; }
    public Node<T> LinkNode { get; set; }
    
    public Node(T value, Node<T> linkNode = null)
    {
        Value = value;
        LinkNode = linkNode;
    }
    
    public void SetLinkNode(Node<T> linkNode) => LinkNode = linkNode;
    public Node<T> GetLinkNode() => LinkNode;
    public T GetValue() => Value;
}
```

## Singly Linked List

### C# Implementation
```csharp
public class LinkedList<T> where T : IEquatable<T>
{
    private Node<T> headNode;
    
    public LinkedList(T value = default(T))
    {
        if (!EqualityComparer<T>.Default.Equals(value, default(T)))
        {
            headNode = new Node<T>(value);
        }
    }
    
    public Node<T> GetHeadNode() => headNode;
    
    public void InsertBeginning(T newValue)
    {
        var newNode = new Node<T>(newValue);
        newNode.SetLinkNode(headNode);
        headNode = newNode;
    }
    
    public string StringifyList()
    {
        var result = new StringBuilder();
        var currentNode = headNode;
        
        while (currentNode != null)
        {
            result.Append($"{currentNode.GetValue()} -> ");
            currentNode = currentNode.GetLinkNode();
        }
        
        return result.Append("null").ToString();
    }
    
    public bool RemoveNode(T valueToRemove)
    {
        if (headNode == null) return false;
        
        // Removing head node
        if (headNode.GetValue().Equals(valueToRemove))
        {
            headNode = headNode.GetLinkNode();
            return true;
        }
        
        // Traverse to find node to remove
        var currentNode = headNode;
        while (currentNode.GetLinkNode() != null)
        {
            if (currentNode.GetLinkNode().GetValue().Equals(valueToRemove))
            {
                currentNode.SetLinkNode(currentNode.GetLinkNode().GetLinkNode());
                return true;
            }
            currentNode = currentNode.GetLinkNode();
        }
        
        return false; // Value not found
    }
    
    public Node<T> FindNode(T value)
    {
        var currentNode = headNode;
        while (currentNode != null)
        {
            if (currentNode.GetValue().Equals(value))
                return currentNode;
            currentNode = currentNode.GetLinkNode();
        }
        return null;
    }
}

// Example usage
var ll = new LinkedList<string>();
ll.InsertBeginning("C");
ll.InsertBeginning("B");
ll.InsertBeginning("A");
Console.WriteLine(ll.StringifyList()); // A -> B -> C -> null
ll.RemoveNode("B");
Console.WriteLine(ll.StringifyList()); // A -> C -> null
```

## Doubly Linked List

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When to Use Doubly Linked</h4>
<ul>
<li>Need bidirectional traversal</li>
<li>Implementing undo/redo functionality</li>
<li>Browser history navigation</li>
<li>Music playlist with previous/next</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>When to Avoid</h4>
<ul>
<li>Memory is constrained (50% more pointers)</li>
<li>Only need forward traversal</li>
<li>Working with simple, small datasets</li>
</ul>
</div>
</div>

### C# Implementation
```csharp
public class DoublyLinkedNode<T>
{
    public T Value { get; set; }
    public DoublyLinkedNode<T> NextNode { get; set; }
    public DoublyLinkedNode<T> PrevNode { get; set; }
    
    public DoublyLinkedNode(T value, DoublyLinkedNode<T> nextNode = null, DoublyLinkedNode<T> prevNode = null)
    {
        Value = value;
        NextNode = nextNode;
        PrevNode = prevNode;
    }
}

public class DoublyLinkedList<T> where T : IEquatable<T>
{
    private DoublyLinkedNode<T> headNode;
    private DoublyLinkedNode<T> tailNode;
    
    public void AddToHead(T newValue)
    {
        var newHead = new DoublyLinkedNode<T>(newValue);
        var currentHead = headNode;
        
        if (currentHead != null)
        {
            currentHead.PrevNode = newHead;
            newHead.NextNode = currentHead;
        }
        
        headNode = newHead;
        
        if (tailNode == null)
        {
            tailNode = newHead;
        }
    }
    
    public void AddToTail(T newValue)
    {
        var newTail = new DoublyLinkedNode<T>(newValue);
        var currentTail = tailNode;
        
        if (currentTail != null)
        {
            currentTail.NextNode = newTail;
            newTail.PrevNode = currentTail;
        }
        
        tailNode = newTail;
        
        if (headNode == null)
        {
            headNode = newTail;
        }
    }
    
    public T RemoveHead()
    {
        var removedHead = headNode;
        
        if (removedHead == null)
        {
            return default(T);
        }
        
        headNode = removedHead.NextNode;
        
        if (headNode != null)
        {
            headNode.PrevNode = null;
        }
        else
        {
            tailNode = null; // List is now empty
        }
        
        return removedHead.Value;
    }
    
    public T RemoveTail()
    {
        var removedTail = tailNode;
        
        if (removedTail == null)
        {
            return default(T);
        }
        
        tailNode = removedTail.PrevNode;
        
        if (tailNode != null)
        {
            tailNode.NextNode = null;
        }
        else
        {
            headNode = null; // List is now empty
        }
        
        return removedTail.Value;
    }
    
    public T RemoveByValue(T valueToRemove)
    {
        if (headNode == null)
            return default(T);
        
        // Check if it's the head or tail first
        if (headNode.Value.Equals(valueToRemove))
            return RemoveHead();
        
        if (tailNode.Value.Equals(valueToRemove))
            return RemoveTail();
        
        // Search in the middle
        var currentNode = headNode.NextNode;
        while (currentNode != null)
        {
            if (currentNode.Value.Equals(valueToRemove))
            {
                // Update surrounding nodes
                var prevNode = currentNode.PrevNode;
                var nextNode = currentNode.NextNode;
                
                prevNode.NextNode = nextNode;
                nextNode.PrevNode = prevNode;
                
                return currentNode.Value;
            }
            
            currentNode = currentNode.NextNode;
        }
        
        return default(T); // Value not found
    }
    
    public string StringifyList()
    {
        var result = new StringBuilder();
        var currentNode = headNode;
        
        while (currentNode != null)
        {
            result.Append($"{currentNode.Value} <-> ");
            currentNode = currentNode.NextNode;
        }
        
        return result.Append("null").ToString();
    }
}
```

## Common Interview Problems

### 1. Reverse a Linked List
```csharp
public static class LinkedListProblems
{
    public static Node<T> ReverseLinkedList<T>(Node<T> head) where T : IEquatable<T>
    {
        Node<T> prev = null;
        Node<T> current = head;

        while (current != null)
        {
            Node<T> nextNode = current.GetLinkNode();
            current.SetLinkNode(prev);
            prev = current;
            current = nextNode;
        }

        return prev; // prev is the new head
    }
}
```

### 2. Detect Cycle (Floyd's Cycle Detection)
```csharp
public static bool HasCycle<T>(Node<T> head) where T : IEquatable<T>
{
    if (head == null) return false;

    Node<T> slow = head;
    Node<T> fast = head;

    while (fast != null && fast.GetLinkNode() != null)
    {
        slow = slow.GetLinkNode();
        fast = fast.GetLinkNode().GetLinkNode();

        if (slow == fast)
            return true;
    }

    return false;
}
```

### 3. Find Middle Node
```csharp
public static Node<T> FindMiddle<T>(Node<T> head) where T : IEquatable<T>
{
    if (head == null) return null;

    Node<T> slow = head;
    Node<T> fast = head;

    // Move fast pointer 2 steps and slow pointer 1 step
    while (fast != null && fast.GetLinkNode() != null)
    {
        slow = slow.GetLinkNode();
        fast = fast.GetLinkNode().GetLinkNode();
    }

    return slow; // slow is at the middle
}
```

## Modern Usage Notes

**C#:** Use `LinkedList<T>` from System.Collections.Generic or `List<T>`

**Interview focus:** Understand pointer manipulation, edge cases (empty list, single node), and common algorithms like cycle detection and reversal.

**Production reality:** Arrays/dynamic arrays usually win due to cache locality and simpler memory management. Linked lists are primarily educational or for very specific use cases where insertion/deletion patterns heavily favor them.