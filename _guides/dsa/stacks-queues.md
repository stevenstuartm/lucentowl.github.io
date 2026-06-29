---
title: "Stacks & Queues"
category: Data Structures & Algorithms
description: "Master stack (LIFO) and queue (FIFO) data structures with implementations, common applications like BFS, and variations including priority queues and circular queues."
tags: [data-structures, algorithms, fundamentals, practical, interview-prep]
---

## Overview
Two fundamental abstract data types that restrict how elements are added and removed, creating specific behavioral patterns useful for many algorithms and system designs.

---

## Stacks (LIFO - Last In, First Out)

### Why Stacks Exist
LIFO behavior mirrors natural problem patterns like function calls, undo operations, parsing nested structures, and backtracking algorithms.

### When to Use Stacks

**Use when:**
- Expression evaluation (parentheses matching, postfix notation)
- Function call management (call stack)
- Undo functionality in applications
- Backtracking algorithms (maze solving, N-queens)
- Parsing nested structures (JSON, XML, code)
- Depth-first search implementations

**Don't use when:**
- Need to access middle elements
- FIFO behavior is required
- Need to process elements in insertion order

**Modern reality:** Most languages provide built-in stacks. In interviews, often implement with arrays or linked lists to show understanding.

### Time Complexity
- **Push:** O(1)
- **Pop:** O(1)  
- **Peek/Top:** O(1)
- **Search:** O(n)

### C# Implementation
```csharp
// Node class for linked implementation
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

public class Stack<T>
{
    private Node<T> topItem;
    private int size;
    private int limit;
    
    public Stack(int limit = 1000)
    {
        this.limit = limit;
        size = 0;
        topItem = null;
    }
    
    public void Push(T value)
    {
        if (HasSpace())
        {
            var item = new Node<T>(value);
            item.SetLinkNode(topItem);
            topItem = item;
            size++;
            Console.WriteLine($"Pushed {value} onto stack");
        }
        else
        {
            Console.WriteLine($"Stack overflow! No room for {value}");
        }
    }
    
    public T Pop()
    {
        if (!IsEmpty())
        {
            var itemToRemove = topItem;
            topItem = itemToRemove.GetLinkNode();
            size--;
            var value = itemToRemove.GetValue();
            Console.WriteLine($"Popped {value} from stack");
            return value;
        }
        else
        {
            Console.WriteLine("Stack underflow! Stack is empty");
            return default(T);
        }
    }
    
    public T Peek()
    {
        if (!IsEmpty())
        {
            return topItem.GetValue();
        }
        else
        {
            Console.WriteLine("Nothing to peek at!");
            return default(T);
        }
    }
    
    public bool HasSpace() => limit > size;
    public bool IsEmpty() => size == 0;
    public int Size => size;
}

// Example usage
var stack = new Stack<string>(5);
stack.Push("First");
stack.Push("Second");
stack.Push("Third");
Console.WriteLine($"Top item: {stack.Peek()}");  // Third
Console.WriteLine($"Popped: {stack.Pop()}");     // Third
Console.WriteLine($"Popped: {stack.Pop()}");     // Second
Console.WriteLine($"Size: {stack.Size}");        // 1
```

### Common Queue Applications

#### 1. Breadth-First Search
```csharp
public static bool BFS(Dictionary<int, List<int>> graph, int startNode, int target)
{
    var queue = new Queue<int>();
    var visited = new HashSet<int>();

    queue.Enqueue(startNode);
    visited.Add(startNode);

    while (queue.Count > 0)
    {
        int currentNode = queue.Dequeue();

        if (currentNode == target)
            return true;

        foreach (int neighbor in graph[currentNode])
        {
            if (!visited.Contains(neighbor))
            {
                visited.Add(neighbor);
                queue.Enqueue(neighbor);
            }
        }
    }

    return false;
}
```

#### 2. Level-Order Tree Traversal
```csharp
public static List<T> LevelOrderTraversal<T>(TreeNode<T> root)
{
    if (root == null)
        return new List<T>();

    var queue = new Queue<TreeNode<T>>();
    var result = new List<T>();

    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        var node = queue.Dequeue();
        result.Add(node.Value);

        if (node.Left != null)
            queue.Enqueue(node.Left);
        if (node.Right != null)
            queue.Enqueue(node.Right);
    }

    return result;
}
```

#### 3. Producer-Consumer with Queue
```csharp
using System.Collections.Concurrent;
using System.Threading.Tasks;

public static class ProducerConsumer
{
    public static async Task RunProducerConsumer()
    {
        var queue = new ConcurrentQueue<string>();
        var items = new[] { "task1", "task2", "task3", "task4" };

        var producerTask = Task.Run(() => Producer(queue, items));
        var consumerTask = Task.Run(() => Consumer(queue));

        await Task.WhenAll(producerTask, consumerTask);
    }

    private static void Producer(ConcurrentQueue<string> queue, string[] items)
    {
        foreach (var item in items)
        {
            Console.WriteLine($"Producing {item}");
            queue.Enqueue(item);
            Thread.Sleep(100);
        }
    }

    private static void Consumer(ConcurrentQueue<string> queue)
    {
        while (true)
        {
            if (queue.TryDequeue(out string item))
            {
                Console.WriteLine($"Consuming {item}");
            }
            else
            {
                Thread.Sleep(10); // Brief pause if queue is empty
                if (queue.IsEmpty)
                    break;
            }
        }
    }
}
```

## Advanced Variations

### Deque (Double-Ended Queue)
Supports insertion and deletion at both ends.

```csharp
// Using C#'s LinkedList for deque-like behavior
var deque = new LinkedList<int>(new[] { 1, 2, 3 });
deque.AddFirst(0);    // Add to front: [0, 1, 2, 3]
deque.AddLast(4);     // Add to back: [0, 1, 2, 3, 4]
deque.RemoveFirst();  // Remove from front: [1, 2, 3, 4]
deque.RemoveLast();   // Remove from back: [1, 2, 3]
```

### Priority Queue
Elements are served based on priority rather than insertion order.

```csharp
// Using .NET 6+ PriorityQueue
public static class PriorityQueueExample
{
    public static void DemonstratePriorityQueue()
    {
        var pq = new PriorityQueue<string, int>();

        pq.Enqueue("Low priority task", 3);
        pq.Enqueue("High priority task", 1);
        pq.Enqueue("Medium priority task", 2);

        while (pq.Count > 0)
        {
            Console.WriteLine(pq.Dequeue());
        }
        // Output: High priority task, Medium priority task, Low priority task
    }
}
```

### Circular Queue (Ring Buffer)
Fixed-size queue that wraps around when full.

```csharp
public class CircularQueue<T>
{
    private T[] queue;
    private int head;
    private int tail;
    private int count;
    private int size;

    public CircularQueue(int size)
    {
        this.size = size;
        queue = new T[size];
        head = 0;
        tail = 0;
        count = 0;
    }

    public bool Enqueue(T item)
    {
        if (count < size)
        {
            queue[tail] = item;
            tail = (tail + 1) % size;
            count++;
            return true;
        }
        return false; // Queue is full
    }

    public T Dequeue()
    {
        if (count > 0)
        {
            T item = queue[head];
            queue[head] = default(T);
            head = (head + 1) % size;
            count--;
            return item;
        }
        return default(T); // Queue is empty
    }

    public bool IsFull() => count == size;
    public bool IsEmpty() => count == 0;
}

// Usage
var cq = new CircularQueue<string>(3);
cq.Enqueue("A");
cq.Enqueue("B");
cq.Enqueue("C");
Console.WriteLine(cq.Enqueue("D")); // False - queue is full
Console.WriteLine(cq.Dequeue());   // "A"
cq.Enqueue("D");                   // Now succeeds
```

## Interview Problems

### 1. Implement Queue Using Stacks
```csharp
public class QueueUsingStacks<T>
{
    private Stack<T> stack1; // For enqueue
    private Stack<T> stack2; // For dequeue

    public QueueUsingStacks()
    {
        stack1 = new Stack<T>();
        stack2 = new Stack<T>();
    }

    public void Enqueue(T item)
    {
        stack1.Push(item);
    }

    public T Dequeue()
    {
        if (stack2.Count == 0)
        {
            // Move all elements from stack1 to stack2
            while (stack1.Count > 0)
            {
                stack2.Push(stack1.Pop());
            }
        }

        if (stack2.Count > 0)
            return stack2.Pop();

        return default(T);
    }
}
```

### 2. Implement Stack Using Queues
```csharp
public class StackUsingQueues<T>
{
    private Queue<T> queue1;
    private Queue<T> queue2;

    public StackUsingQueues()
    {
        queue1 = new Queue<T>();
        queue2 = new Queue<T>();
    }

    public void Push(T item)
    {
        // Add to queue2, move all from queue1 to queue2, then swap
        queue2.Enqueue(item);
        while (queue1.Count > 0)
        {
            queue2.Enqueue(queue1.Dequeue());
        }

        // Swap queues
        var temp = queue1;
        queue1 = queue2;
        queue2 = temp;
    }

    public T Pop()
    {
        if (queue1.Count > 0)
            return queue1.Dequeue();

        return default(T);
    }
}
```

### 3. Valid Parentheses (Stack Application)
```csharp
public static bool IsValidParentheses(string s)
{
    var stack = new Stack<char>();
    var mapping = new Dictionary<char, char>
    {
        {')', '('},
        {'}', '{'},
        {']', '['}
    };

    foreach (char c in s)
    {
        if (mapping.ContainsKey(c))
        {
            if (stack.Count == 0 || stack.Pop() != mapping[c])
                return false;
        }
        else
        {
            stack.Push(c);
        }
    }

    return stack.Count == 0;
}

// Test cases
Console.WriteLine(IsValidParentheses("()"));       // True
Console.WriteLine(IsValidParentheses("()[]{}"));   // True
Console.WriteLine(IsValidParentheses("(]"));       // False
```

## Modern Usage

**C#:**
- Use `Stack<T>` for stack operations
- Use `Queue<T>` for queue operations
- Use `PriorityQueue<TElement, TPriority>` (.NET 6+)
- Use `ConcurrentQueue<T>` for thread-safety

## Key Takeaways

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Stacks are Perfect For</h4>
<ul>
<li>Reversing things</li>
<li>Keeping track of state/history</li>
<li>Parsing nested structures</li>
<li>Recursive algorithm implementations</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Queues are Perfect For</h4>
<ul>
<li>Processing in order</li>
<li>Buffering between producers and consumers</li>
<li>Breadth-first algorithms</li>
<li>Scheduling and task management</li>
</ul>
</div>
</div>

**Interview focus:** Understand when to use each, how to implement with arrays or linked lists, and common applications like expression evaluation and tree traversal. Stack Applications

#### 1. Parentheses Matching
```csharp
public static bool IsBalanced(string expression)
{
    var stack = new Stack<char>();
    var pairs = new Dictionary<char, char>
    {
        {'(', ')'},
        {'[', ']'},
        {'{', '}'}
    };

    foreach (char c in expression)
    {
        if (pairs.ContainsKey(c)) // Opening bracket
        {
            stack.Push(c);
        }
        else if (pairs.ContainsValue(c)) // Closing bracket
        {
            if (stack.Count == 0)
                return false;
            if (pairs[stack.Pop()] != c)
                return false;
        }
    }

    return stack.Count == 0;
}

// Test cases
Console.WriteLine(IsBalanced("()[]{}"));   // True
Console.WriteLine(IsBalanced("([{}])"));   // True
Console.WriteLine(IsBalanced("([)]"));     // False
```

#### 2. Postfix Expression Evaluation
```csharp
public static double EvaluatePostfix(string expression)
{
    var stack = new Stack<double>();
    var operators = new HashSet<string> {"+", "-", "*", "/"};

    foreach (string token in expression.Split(' '))
    {
        if (operators.Contains(token))
        {
            double b = stack.Pop();
            double a = stack.Pop();

            double result = token switch
            {
                "+" => a + b,
                "-" => a - b,
                "*" => a * b,
                "/" => a / b,
                _ => throw new InvalidOperationException($"Unknown operator: {token}")
            };

            stack.Push(result);
        }
        else
        {
            stack.Push(double.Parse(token));
        }
    }

    return stack.Peek();
}

// Example: "3 4 + 2 *" = (3 + 4) * 2 = 14
Console.WriteLine(EvaluatePostfix("3 4 + 2 *")); // 14.0
```

---

## Queues (FIFO - First In, First Out)

### Why Queues Exist
FIFO behavior matches real-world scenarios like waiting lines, task scheduling, breadth-first processing, and producer-consumer systems.

### When to Use Queues

**Use when:**
- Task scheduling and job processing
- Breadth-first search algorithms
- Handling requests in order (web servers, print queues)
- Producer-consumer scenarios
- Buffer for streaming data
- Level-order tree traversal

**Don't use when:**
- Need random access to elements
- LIFO behavior is required
- Priority matters more than insertion order (use priority queue)

**Modern reality:** Built into most languages. Use `Queue<T>` in C#.

### Time Complexity
- **Enqueue (add):** O(1)
- **Dequeue (remove):** O(1)
- **Front/Peek:** O(1)
- **Search:** O(n)

### C# Implementation  
```csharp
public class Queue<T>
{
    private Node<T> head;
    private Node<T> tail;
    private int? maxSize;
    private int size;
    
    public Queue(int? maxSize = null)
    {
        this.maxSize = maxSize;
        size = 0;
        head = null;
        tail = null;
    }
    
    public void Enqueue(T value)
    {
        if (HasSpace())
        {
            var itemToAdd = new Node<T>(value);
            Console.WriteLine($"Adding {value} to the queue");
            
            if (IsEmpty())
            {
                head = itemToAdd;
                tail = itemToAdd;
            }
            else
            {
                tail.SetLinkNode(itemToAdd);
                tail = itemToAdd;
            }
            
            size++;
        }
        else
        {
            Console.WriteLine("Queue is full! Cannot add more items");
        }
    }
    
    public T Dequeue()
    {
        if (GetSize() > 0)
        {
            var itemToRemove = head;
            Console.WriteLine($"{itemToRemove.GetValue()} is being served!");
            
            if (GetSize() == 1)
            {
                head = null;
                tail = null;
            }
            else
            {
                head = head.GetLinkNode();
            }
            
            size--;
            return itemToRemove.GetValue();
        }
        else
        {
            Console.WriteLine("The queue is empty!");
            return default(T);
        }
    }
    
    public T Peek()
    {
        if (size > 0)
        {
            return head.GetValue();
        }
        else
        {
            Console.WriteLine("No items in queue!");
            return default(T);
        }
    }
    
    public int GetSize() => size;
    
    public bool HasSpace()
    {
        if (maxSize == null)
            return true;
        else
            return maxSize > GetSize();
    }
    
    public bool IsEmpty() => size == 0;
}

// Example usage
Console.WriteLine("Creating a deli queue with max 5 orders...");
var deliLine = new Queue<string>(5);

// Add orders
string[] orders = {"Sandwich", "Soup", "Salad", "Pizza", "Burger"};
foreach (var order in orders)
{
    deliLine.Enqueue(order);
}

Console.WriteLine($"\nNext order up: {deliLine.Peek()}");

// Serve orders
while (!deliLine.IsEmpty())
{
    deliLine.Dequeue();
}
```

### Common