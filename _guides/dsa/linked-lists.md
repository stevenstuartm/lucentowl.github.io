---
title: "Linked Lists"
layout: guide
category: Data Structures & Algorithms
subcategory: Core Data Structures
description: "How singly and doubly linked lists store elements as nodes joined by pointers, why insertion is O(1) only once you hold the node, what .NET's LinkedList<T> provides, where linked lists beat arrays, including the LRU cache, and the classic pointer techniques: reversal, cycle detection, and finding the middle."
tags: [linked-lists, pointers, doubly-linked-list, floyd-cycle-detection, lru-cache, fundamentals]
---
{% raw %}

## Why Linked Lists Exist

An array keeps its elements side by side, so inserting or removing anywhere but the end shifts every element after that point. A linked list gives up contiguity to avoid the shifting. Each element lives in its own node, and each node holds a pointer to the next one. In C#, a pointer here is an ordinary object reference, not an unsafe pointer. The order of the list lives in those pointers, not in memory addresses, so once the code is at the insertion point, inserting a node means changing a few pointers, however long the list is.

The cost is that nothing can be found by arithmetic anymore. There is no address formula for the 500th node. Reaching it means starting at the first node and following 499 pointers.

---

## How a Linked List Is Built

A **singly linked list** keeps a reference to its first node, the head. Each node holds a value and a `Next` pointer, and the last node's `Next` is `null`. A **doubly linked list** adds a `Previous` pointer to every node and usually keeps a reference to the last node, the tail, as well.

{% endraw %}
{% include figure.html id="dsa-linked-list-structure" %}
{% raw %}

The bottom row is the reason linked lists exist. Inserting X after A sets X's `Next` to the node A points to, then points A at X. Those two pointer writes are the whole insertion, and no other node moves or changes. The order matters. Changing A's pointer first would lose the only reference to B.

---

## Operation Costs

Most linked list costs depend on whether the code already holds a reference to the node where the work happens. Finding a node by position or value is O(n). Changing the list at a node already in hand is O(1).

| Operation | Singly linked | Doubly linked | Dynamic array |
| --- | --- | --- | --- |
| Access by index | O(n) | O(n) | O(1) |
| Search by value | O(n) | O(n) | O(n) |
| Insert or remove at the head | O(1) | O(1) | O(n) |
| Insert at the tail | O(1) with a tail reference | O(1) | O(1) amortized |
| Remove the tail | O(n) | O(1) | O(1) |
| Insert after a node you hold | O(1) | O(1) | O(n) |
| Remove a node you hold | O(n) | O(1) | O(n) |

Removing the tail, or any node you hold, is O(n) in a singly linked list because the node before it has to be updated, and the only way to reach that node is to walk from the head. The `Previous` pointer in a doubly linked list removes that walk.

"Insert in the middle is O(1)" is therefore only half true. Inserting at position 500 is O(n) in a linked list too, because reaching position 500 is O(n). Linked lists win when the code arrives at the node some other way, such as while already walking the list or through a stored reference.

---

## A Singly Linked List in C#

```csharp
var list = new SinglyLinkedList<string>();
list.AddLast("A");
list.AddLast("C");
list.AddAfter(list.Find("A")!, "B");
Console.WriteLine(list);  // A -> B -> C -> null
list.Remove("B");
Console.WriteLine(list);  // A -> C -> null

public class SinglyLinkedList<T>
{
    public class Node
    {
        public T Value { get; }
        public Node? Next { get; set; }

        public Node(T value) => Value = value;
    }

    private Node? _head;
    private Node? _tail;

    public int Count { get; private set; }

    public void AddFirst(T value)
    {
        var node = new Node(value) { Next = _head };
        _head = node;
        _tail ??= node;  // The first node is both head and tail
        Count++;
    }

    public void AddLast(T value)
    {
        var node = new Node(value);
        if (_tail == null)
            _head = node;
        else
            _tail.Next = node;

        _tail = node;
        Count++;
    }

    public void AddAfter(Node node, T value)
    {
        var inserted = new Node(value) { Next = node.Next };  // Step 1: point at the old successor
        node.Next = inserted;                                  // Step 2: point the node at the new one
        if (_tail == node)
            _tail = inserted;
        Count++;
    }

    public T RemoveFirst()
    {
        if (_head == null)
            throw new InvalidOperationException("The list is empty.");

        T value = _head.Value;
        _head = _head.Next;
        if (_head == null)
            _tail = null;
        Count--;
        return value;
    }

    public bool Remove(T value)
    {
        Node? previous = null;
        for (Node? current = _head; current != null; previous = current, current = current.Next)
        {
            if (!EqualityComparer<T>.Default.Equals(current.Value, value))
                continue;

            if (previous == null)
                _head = current.Next;       // Removing the head
            else
                previous.Next = current.Next;

            if (current == _tail)
                _tail = previous;

            Count--;
            return true;
        }

        return false;
    }

    public Node? Find(T value)
    {
        for (Node? current = _head; current != null; current = current.Next)
        {
            if (EqualityComparer<T>.Default.Equals(current.Value, value))
                return current;
        }
        return null;
    }

    public override string ToString()
    {
        var values = new List<string>();
        for (Node? current = _head; current != null; current = current.Next)
            values.Add(current.Value?.ToString() ?? "null");
        values.Add("null");  // The last node's Next
        return string.Join(" -> ", values);
    }
}
```

Most of the code handles edge cases rather than the main path. Every operation has to keep `_head` and `_tail` correct when the list is empty, has one node, or loses its first or last node. That bookkeeping is where hand-written linked lists usually go wrong, and it is the main reason to use the built-in type when one exists.

A common fix is a sentinel, a dummy node that sits before the first real node and holds no value. Every real node then has a node before it, so the branches for an empty list and for removing the head disappear. .NET's `LinkedList<T>` gets a similar effect by linking its ends into a circle internally.

---

## Doubly Linked Lists

The `Previous` pointer costs one more reference per node. In exchange, a node can unlink itself in O(1), because it can reach both neighbors directly:

```csharp
// Inside a doubly linked list whose nodes have Previous and Next
public void Remove(Node node)
{
    if (node.Previous != null) node.Previous.Next = node.Next;
    else _head = node.Next;           // Removing the head

    if (node.Next != null) node.Next.Previous = node.Previous;
    else _tail = node.Previous;       // Removing the tail

    Count--;
}
```

The doubly linked list also allows walking backward from the tail. General-purpose library lists, including .NET's own, tend to be doubly linked, because O(1) removal of a held node is often the reason for choosing a linked list at all.

---

## LinkedList&lt;T&gt; in .NET

`System.Collections.Generic.LinkedList<T>` is a doubly linked list. Internally it is circular, meaning the head's internal previous link points to the tail, although the public `Next` and `Previous` properties of `LinkedListNode<T>` return `null` at the ends. Its API is built around `LinkedListNode<T>` references:

| Member | Cost | Notes |
| --- | --- | --- |
| `AddFirst(value)`, `AddLast(value)` | O(1) | Return the new `LinkedListNode<T>` |
| `AddFirst(node)`, `AddLast(node)` | O(1) | Reinsert a node that belongs to no list, with no new allocation |
| `AddBefore(node, value)`, `AddAfter(node, value)` | O(1) | Require a node from this list |
| `Remove(LinkedListNode<T> node)` | O(1) | Unlinks the node directly |
| `Remove(T value)` | O(n) | Searches for the first match, then unlinks it |
| `RemoveFirst`, `RemoveLast` | O(1) | Throw on an empty list |
| `Find`, `FindLast`, `Contains` | O(n) | Linear search |
| `First`, `Last`, `Count` | O(1) | `Count` is stored, not computed |

There is no indexer. Code that needs `list[i]` should not be using a linked list.

Each `LinkedListNode<T>` is a separate object on the heap that holds references to its list, its next node, and its previous node, plus the value itself. With the header and type pointer that every .NET object carries, a node storing one `int` takes 48 bytes on a 64-bit runtime, where the same `int` in an array takes 4.

---

## Where Linked Lists Win and Lose

### Where They Lose

Linked lists often lose head-to-head comparisons with dynamic arrays in practice, even where their Big O is equal or better. An array scan reads memory sequentially, which the CPU cache serves efficiently. A linked list scan follows pointers to nodes scattered across the heap, and each hop can miss the cache. Every node is also a separate allocation for the garbage collector to track.

### The LRU Cache

Linked lists win when the code holds node references and needs O(1) changes at those nodes. The standard example is a least-recently-used (LRU) cache, which evicts whichever entry was used longest ago. It pairs a dictionary from key to `LinkedListNode<T>` with a doubly linked list kept in order of use. A lookup finds the node through the dictionary in O(1) on average, then moves it to the front of the list with an O(1) `Remove` and `AddFirst`. Eviction removes the node at the tail. No array can move an element from the middle to the front in O(1).

```csharp
var cache = new LruCache<string, int>(2);
cache.Put("a", 1);
cache.Put("b", 2);
cache.TryGet("a", out _);        // "a" is now the most recently used
cache.Put("c", 3);               // Full: evicts "b", the least recently used
Console.WriteLine(cache.TryGet("b", out _));  // False

public class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly Dictionary<TKey, LinkedListNode<(TKey Key, TValue Value)>> _nodes = new();
    private readonly LinkedList<(TKey Key, TValue Value)> _order = new();  // Most recently used first

    public LruCache(int capacity)
    {
        if (capacity < 1)
            throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    public bool TryGet(TKey key, out TValue value)
    {
        if (!_nodes.TryGetValue(key, out var node))
        {
            value = default!;
            return false;
        }

        _order.Remove(node);    // O(1): unlink the node already in hand
        _order.AddFirst(node);  // O(1): reuse the same node, no new allocation
        value = node.Value.Value;
        return true;
    }

    public void Put(TKey key, TValue value)
    {
        if (_nodes.TryGetValue(key, out var existing))
        {
            _order.Remove(existing);
            _nodes.Remove(key);
        }
        else if (_nodes.Count == _capacity)
        {
            var oldest = _order.Last!;
            _order.RemoveLast();
            _nodes.Remove(oldest.Value.Key);  // The node stores its key so eviction can find the dictionary entry
        }

        _nodes[key] = _order.AddFirst((key, value));
    }
}
```

Each node stores its key as well as its value. Without the key, evicting the tail node would leave its dictionary entry behind, pointing at a node that is no longer in the list.

### Stable References

Linked lists also fit when many insertions and removals happen at positions the code is already visiting, such as filtering a list during a single pass, and when node references must stay valid while other elements are added and removed. An element's index in an array changes every time something before it is inserted, but a node reference stays the same. A hand-written list can also splice a whole run of nodes into another list with a few pointer changes. `LinkedList<T>` has no splice operation, so moving nodes between two of its lists goes one node at a time.

---

## Classic Pointer Techniques

These three problems come up often because each one tests careful pointer handling in a few lines. They work on bare nodes rather than a list class:

```csharp
public class ListNode
{
    public int Value { get; }
    public ListNode? Next { get; set; }

    public ListNode(int value) => Value = value;
}
```

### Reversing a List

Reversal walks the list once and turns each `Next` pointer around. Three references track the work: `previous` (the already-reversed part), `current` (the node being flipped), and `next` (saved before flipping, because flipping destroys the only path to it).

{% endraw %}
{% include figure.html id="dsa-list-reversal" %}
{% raw %}

```csharp
public static ListNode? Reverse(ListNode? head)
{
    ListNode? previous = null;
    ListNode? current = head;

    while (current != null)
    {
        ListNode? next = current.Next;  // Save the rest of the list
        current.Next = previous;    // Flip this node's pointer
        previous = current;         // Advance both references
        current = next;
    }

    return previous;  // The old tail is the new head
}
```

This is O(n) time and O(1) extra space. A recursive version is shorter but uses O(n) stack space.

### Detecting a Cycle

A bug or a malicious input can make a list's last node point back into the list, so a loop that walks until `null` never ends. Floyd's cycle detection finds this with O(1) extra space. A slow reference moves one node per step and a fast reference moves two. Without a cycle, the fast one reaches `null`. With a cycle, both references end up inside it, and the fast one closes the gap by one node per step, so it catches the slow one within one lap.

{% endraw %}
{% include figure.html id="dsa-floyd-cycle-detection" %}
{% raw %}

```csharp
public static bool HasCycle(ListNode? head)
{
    ListNode? slow = head, fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;

        if (slow == fast)
            return true;
    }

    return false;
}
```

A second phase finds the node where the cycle starts. Move one reference back to the head, leave the other at the meeting point, and advance both one node per step. They meet at the start of the cycle, node 3 in the figure. Walking forward from the meeting point reaches the cycle's start in the same number of steps as walking from the head, give or take whole laps of the loop. In the figure, node 1 and node 7 are both two steps from node 3.

The alternative is to store every visited node in a `HashSet<ListNode>` and stop at the first repeat. That is also O(n) time, but it needs O(n) extra space.

### Finding the Middle

The same slow and fast pair finds the middle in one pass. When the fast reference reaches the end, the slow one has covered half the distance. For an even-length list, this version stops on the second of the two middle nodes.

```csharp
public static ListNode? FindMiddle(ListNode? head)
{
    ListNode? slow = head, fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;
    }

    return slow;
}
```

{% endraw %}
