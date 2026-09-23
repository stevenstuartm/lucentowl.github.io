---
title: "Stacks & Queues"
layout: guide
category: Data Structures & Algorithms
subcategory: Core Data Structures
description: "Stacks (last in, first out) and queues (first in, first out) as contracts, how each is built on an array, why a queue needs a circular buffer, what .NET's Stack<T> and Queue<T> do, and the problems each order solves: matching brackets, evaluating expressions, and processing work in arrival order."
tags: [stacks, queues, lifo, fifo, circular-buffer, deque, fundamentals]
---
{% raw %}

## Stacks and Queues Are Contracts

A stack and a queue are abstract data types: each is defined by the operations it allows, not by how it stores anything. Both hold a sequence of elements, and both restrict where elements come in and go out.

| | Stack | Queue |
| --- | --- | --- |
| Order | Last in, first out (LIFO) | First in, first out (FIFO) |
| Add | `Push` onto the top | `Enqueue` at the back |
| Remove | `Pop` from the top | `Dequeue` from the front |
| Look without removing | `Peek` at the top | `Peek` at the front |
| Everyday picture | A stack of plates | A line at a checkout |

The restriction is the point. Code that uses a stack cannot reach into the middle, so it cannot get the order wrong, and the implementation is free to make every allowed operation fast.

Because they are contracts, costs belong to an implementation, not to the idea. A stack or queue built on a linked list (with a tail reference, for a queue), or on an array used the right way, makes all four operations O(1), amortized when an array has to grow. A queue built naively on an array does not, as the queue section shows.

---

## Stacks

### How a Stack Works

A stack only ever touches one end, the top. `Push` places an element on top, `Pop` removes and returns the top element, and `Peek` returns it without removing it. The element popped is always the one pushed most recently, so a stack reverses the order it receives: push A, B, C and pop them back as C, B, A.

### Building a Stack on an Array

An array whose end serves as the top gives O(1) push and pop, because adding or removing at the end of an array never shifts anything. The array grows by doubling when it fills, so push is O(1) amortized.

```csharp
public class ArrayStack<T>
{
    private T[] _items = new T[4];
    private int _count;

    public int Count => _count;

    public void Push(T item)
    {
        if (_count == _items.Length)
            Array.Resize(ref _items, _items.Length * 2);

        _items[_count++] = item;
    }

    public T Pop()
    {
        if (_count == 0)
            throw new InvalidOperationException("The stack is empty.");

        T item = _items[--_count];
        _items[_count] = default!;  // Release the reference for the garbage collector
        return item;
    }

    public T Peek()
    {
        if (_count == 0)
            throw new InvalidOperationException("The stack is empty.");

        return _items[_count - 1];
    }
}
```

A linked list whose head serves as the top also works, since adding and removing at the head is O(1). The array version is usually faster in practice, because it allocates only when it grows and keeps its elements contiguous.

### `Stack<T>` in .NET

.NET's `Stack<T>` is the array version. It allocates capacity 4 on the first push and doubles from there. `Pop` and `Peek` throw `InvalidOperationException` on an empty stack, and `TryPop` and `TryPeek` return `false` instead.

### Where Stacks Appear

A stack fits any problem where the most recent unfinished thing must be finished first:

- **Method calls.** The runtime's call stack holds one frame per active call, and a return always resumes the most recent caller.
- **Undo.** Each action is pushed as it happens, and undo pops the most recent one.
- **Nesting.** Brackets, HTML or XML tags, and nested expressions all close in the reverse of the order they opened.
- **Backtracking and depth-first search.** The stack holds the path taken so far, and backing up means popping.

### Worked Example: Matching Brackets

In a valid string of brackets, every closer matches the most recent opener that hasn't been closed yet. That is exactly what a stack's top holds. Push each opener, and when a closer arrives, pop and check that it matches.

```csharp
public static bool BracketsBalanced(string text)
{
    var open = new Stack<char>();

    foreach (char c in text)
    {
        switch (c)
        {
            case '(' or '[' or '{':
                open.Push(c);
                break;
            case ')' or ']' or '}':
                if (!open.TryPop(out char opener))
                    return false;  // A closer with nothing open
                if ((opener, c) is not (('(', ')') or ('[', ']') or ('{', '}')))
                    return false;  // Closer doesn't match the most recent opener
                break;
        }
    }

    return open.Count == 0;  // Anything left open is unbalanced
}

Console.WriteLine(BracketsBalanced("{[()()]}"));  // True
Console.WriteLine(BracketsBalanced("([)]"));      // False: ) closes [
Console.WriteLine(BracketsBalanced("(("));        // False: never closed
```

Each character is pushed or popped at most once, so the check is O(n).

### Worked Example: Evaluating Postfix Expressions

Postfix notation writes each operator after its two operands, so `3 4 + 2 *` means (3 + 4) × 2. It needs no parentheses and no precedence rules, which makes it convenient for stack-based calculators and for evaluating expressions inside interpreters. A stack evaluates it in one pass: push numbers, and on each operator pop two operands, apply it, and push the result.

```csharp
public static double EvaluatePostfix(string expression)
{
    var operands = new Stack<double>();

    foreach (string token in expression.Split(' ', StringSplitOptions.RemoveEmptyEntries))
    {
        if (double.TryParse(token, out double number))
        {
            operands.Push(number);
            continue;
        }

        double right = operands.Pop();  // The second operand is on top
        double left = operands.Pop();

        operands.Push(token switch
        {
            "+" => left + right,
            "-" => left - right,
            "*" => left * right,
            "/" => left / right,
            _ => throw new ArgumentException($"Unknown operator '{token}'.")
        });
    }

    return operands.Pop();
}

Console.WriteLine(EvaluatePostfix("3 4 + 2 *"));  // 14
Console.WriteLine(EvaluatePostfix("10 2 8 * + 3 -"));  // 23
```

The order of the two pops matters for subtraction and division. The right-hand operand was pushed last, so it comes off first.

---

## Queues

### How a Queue Works

A queue adds at one end, the back, and removes from the other, the front. The element dequeued is always the one that has waited longest, so a queue preserves the order it receives: enqueue A, B, C and dequeue them as A, B, C.

### Why a Plain Array Makes a Poor Queue

Enqueueing at the end of an array is O(1) amortized, but dequeueing from the front is not. Removing index 0 of a `List<T>` shifts every remaining element left, so each dequeue is O(n), and draining a queue of n elements this way costs O(n²).

Leaving the front slot empty and moving a start index forward avoids the shift. But then the used region crawls steadily toward the end of the array, leaving dead space behind it, and the array eventually fills even though it holds only a few live elements.

### The Circular Buffer

A circular buffer, also called a ring buffer, treats the array as if its end joined its beginning. The queue keeps two indices, a head where the next dequeue reads and a tail where the next enqueue writes. Both only ever move forward, and when either passes the last slot it wraps to slot 0. The freed slots at the start get reused, so no element ever moves and both operations are O(1).

{% endraw %}
{% include figure.html id="dsa-circular-buffer" %}
{% raw %}

```csharp
public class CircularQueue<T>
{
    private T[] _items;
    private int _head;   // Index of the front element
    private int _tail;   // Index where the next element goes
    private int _count;

    public CircularQueue(int capacity = 4) => _items = new T[capacity];

    public int Count => _count;

    public void Enqueue(T item)
    {
        if (_count == _items.Length)
            Grow();

        _items[_tail] = item;
        _tail = (_tail + 1) % _items.Length;  // Wrap past the end
        _count++;
    }

    public T Dequeue()
    {
        if (_count == 0)
            throw new InvalidOperationException("The queue is empty.");

        T item = _items[_head];
        _items[_head] = default!;
        _head = (_head + 1) % _items.Length;
        _count--;
        return item;
    }

    private void Grow()
    {
        // Copy in queue order, front first, so the wrapped part lands after the rest
        var larger = new T[Math.Max(_items.Length * 2, 4)];  // A zero-capacity queue still grows
        for (int i = 0; i < _count; i++)
            larger[i] = _items[(_head + i) % _items.Length];

        _items = larger;
        _head = 0;
        _tail = _count;
    }
}
```

Growing is the one subtle step. When the buffer is full and wrapped, the front of the queue sits in the middle of the array. Copying the array as-is would keep the elements in slot order, not queue order, so `Grow` copies them front to back and resets the head to 0.

A fixed-capacity circular buffer that never grows is common in its own right. It either rejects new items when full or overwrites the oldest one, which suits logs of recent events, audio and network buffers, and anything that should keep the last N values in bounded memory.

### `Queue<T>` in .NET

.NET's `Queue<T>` is a circular buffer, and its source says so. `Enqueue` and `Dequeue` are O(1), with `Enqueue` O(1) amortized because a full buffer grows. It grows by a factor of 2, by at least 4 slots. Like `Stack<T>`, it offers `TryDequeue` and `TryPeek` alongside the throwing versions.

`Queue<T>` is not safe for concurrent use. When one thread produces work and another consumes it, `ConcurrentQueue<T>` is safe for concurrent enqueues and dequeues, and `System.Threading.Channels` adds waiting for items to arrive and limits on queue length.

### Where Queues Appear

A queue fits any problem where work should be handled in the order it arrived, or where a producer and a consumer run at different speeds:

- **Work and message queues.** Requests, jobs, and messages wait their turn, and the queue absorbs bursts the consumer can't handle immediately.
- **Buffers.** Keystrokes, network packets, and audio samples are consumed in the order they were produced.
- **Breadth-first search.** A queue makes a search visit everything one step away before anything two steps away, which is how it finds shortest paths in unweighted graphs.

---

## Deques and Priority Queues

### Deques

A deque (a double-ended queue, pronounced "deck") allows adding and removing at both ends in O(1), so it can act as a stack, a queue, or both at once. A capped history list is a simple example. New entries are added at the back and undone from the back, like a stack, but when the history reaches its limit, the oldest entry drops off the front, like a queue.

The .NET base class library has no dedicated deque type. `LinkedList<T>` provides O(1) `AddFirst`, `AddLast`, `RemoveFirst`, and `RemoveLast`, at the cost of one heap allocation per element. A circular buffer extended to move its head backward as well as its tail forward gives the same operations on an array.

### Priority Queues

A priority queue serves elements by priority instead of arrival order. `Dequeue` always returns the highest-priority element, whenever it arrived. Despite the name, it is a different contract from a queue, and it is usually implemented with a heap rather than an array or a list. .NET provides it as `PriorityQueue<TElement, TPriority>`, which treats the smallest priority value as the highest priority.

---

## Building a Queue from Two Stacks

A queue can be built from two stacks, which is a common exercise and a clean example of amortized cost. Enqueue pushes onto an inbox stack. Dequeue pops from an outbox stack, and only when the outbox is empty does it move everything from the inbox to the outbox. Moving reverses the order, which turns the inbox's LIFO order into FIFO.

```csharp
public class TwoStackQueue<T>
{
    private readonly Stack<T> _inbox = new();
    private readonly Stack<T> _outbox = new();

    public void Enqueue(T item) => _inbox.Push(item);

    public T Dequeue()
    {
        if (_outbox.Count == 0)
        {
            while (_inbox.Count > 0)
                _outbox.Push(_inbox.Pop());  // Reversal puts the oldest on top
        }

        return _outbox.Pop();  // Throws if both stacks are empty
    }
}
```

A single dequeue can move n elements, but each element is pushed and popped at most twice over its whole life: once into the inbox, once across to the outbox. So n operations cost O(n) in total, and each dequeue is O(1) amortized.

---

## Choosing Between Them

| Situation | Structure | .NET type |
| --- | --- | --- |
| The most recent item must be handled first | Stack | `Stack<T>` |
| Items must be handled in arrival order | Queue | `Queue<T>`, or `ConcurrentQueue<T>` and channels across threads |
| Items are added or removed at both ends | Deque | `LinkedList<T>`, or a custom circular buffer |
| The most important item must be handled first | Priority queue | `PriorityQueue<TElement, TPriority>` |
| Only the last N items matter | Fixed-size circular buffer | A custom circular buffer |

None of these structures supports efficient search or access by position. If the code needs either, the problem is not really a stack or a queue.

{% endraw %}
