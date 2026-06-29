---
title: "Tree Fundamentals"
category: Data Structures & Algorithms
description: "Learn tree fundamentals including terminology, types, traversal methods, and why trees enable logarithmic time operations for hierarchical data structures."
tags: [data-structures, algorithms, trees, fundamentals, interview-prep]
---

## Why Trees Exist

Trees organize data hierarchically, making search, insertion, and deletion efficient while maintaining order. They model natural hierarchies (file systems, organizational charts, decision trees) and enable logarithmic time operations through balanced structures. Trees are the backbone of databases, compilers, and many system designs.

**Real impact:** Understanding trees enables you to work with hierarchical data efficiently, build decision systems, and optimize search operations from linear to logarithmic time.

---

## What Are Trees?

A tree is a hierarchical data structure with a root node and child nodes, forming a parent-child relationship. Unlike graphs, trees have no cycles and exactly one path between any two nodes.

**Key insight:** Trees are about hierarchy and efficient access patterns, not just storage.

### Tree Terminology

- **Root:** The top node with no parent
- **Parent:** Node with children
- **Child:** Node with a parent
- **Leaf:** Node with no children
- **Subtree:** Tree rooted at any node
- **Height:** Longest path from root to leaf
- **Depth:** Distance from root to a node
- **Level:** All nodes at the same depth

---

## Basic Tree Implementation

### Generic Tree Node
```csharp
public class TreeNode<T>
{
    public T Value { get; set; }
    public List<TreeNode<T>> Children { get; set; }
    public TreeNode<T> Parent { get; set; }

    public TreeNode(T value)
    {
        Value = value;
        Children = new List<TreeNode<T>>();
        Parent = null;
    }

    public void AddChild(TreeNode<T> child)
    {
        Children.Add(child);
        child.Parent = this;
    }

    public void RemoveChild(TreeNode<T> child)
    {
        Children.Remove(child);
        child.Parent = null;
    }

    public bool IsLeaf => Children.Count == 0;
    public bool IsRoot => Parent == null;
}
```

### Binary Tree Node
```csharp
public class BinaryTreeNode<T>
{
    public T Value { get; set; }
    public BinaryTreeNode<T> Left { get; set; }
    public BinaryTreeNode<T> Right { get; set; }

    public BinaryTreeNode(T value)
    {
        Value = value;
        Left = null;
        Right = null;
    }

    public bool IsLeaf => Left == null && Right == null;
}
```

---

## Tree Traversal Algorithms

### Depth-First Traversals

#### Pre-order Traversal (Root → Left → Right)
```csharp
public static class TreeTraversal
{
    public static List<T> PreOrderTraversal<T>(BinaryTreeNode<T> root)
    {
        var result = new List<T>();
        PreOrderHelper(root, result);
        return result;
    }

    private static void PreOrderHelper<T>(BinaryTreeNode<T> node, List<T> result)
    {
        if (node == null) return;

        result.Add(node.Value);                    // Visit root
        PreOrderHelper(node.Left, result);         // Traverse left
        PreOrderHelper(node.Right, result);        // Traverse right
    }

    // Iterative version
    public static List<T> PreOrderIterative<T>(BinaryTreeNode<T> root)
    {
        var result = new List<T>();
        if (root == null) return result;

        var stack = new Stack<BinaryTreeNode<T>>();
        stack.Push(root);

        while (stack.Count > 0)
        {
            var current = stack.Pop();
            result.Add(current.Value);

            // Push right first, then left (so left is processed first)
            if (current.Right != null) stack.Push(current.Right);
            if (current.Left != null) stack.Push(current.Left);
        }

        return result;
    }
}
```

#### In-order Traversal (Left → Root → Right)
```csharp
public static List<T> InOrderTraversal<T>(BinaryTreeNode<T> root)
{
    var result = new List<T>();
    InOrderHelper(root, result);
    return result;
}

private static void InOrderHelper<T>(BinaryTreeNode<T> node, List<T> result)
{
    if (node == null) return;

    InOrderHelper(node.Left, result);     // Traverse left
    result.Add(node.Value);               // Visit root
    InOrderHelper(node.Right, result);    // Traverse right
}

// Iterative version
public static List<T> InOrderIterative<T>(BinaryTreeNode<T> root)
{
    var result = new List<T>();
    var stack = new Stack<BinaryTreeNode<T>>();
    var current = root;

    while (current != null || stack.Count > 0)
    {
        // Go to leftmost node
        while (current != null)
        {
            stack.Push(current);
            current = current.Left;
        }

        // Current is null, pop from stack
        current = stack.Pop();
        result.Add(current.Value);

        // Go to right subtree
        current = current.Right;
    }

    return result;
}
```

#### Post-order Traversal (Left → Right → Root)
```csharp
public static List<T> PostOrderTraversal<T>(BinaryTreeNode<T> root)
{
    var result = new List<T>();
    PostOrderHelper(root, result);
    return result;
}

private static void PostOrderHelper<T>(BinaryTreeNode<T> node, List<T> result)
{
    if (node == null) return;

    PostOrderHelper(node.Left, result);   // Traverse left
    PostOrderHelper(node.Right, result);  // Traverse right
    result.Add(node.Value);               // Visit root
}
```

### Breadth-First Traversal (Level Order)
```csharp
public static List<T> LevelOrderTraversal<T>(BinaryTreeNode<T> root)
{
    var result = new List<T>();
    if (root == null) return result;

    var queue = new Queue<BinaryTreeNode<T>>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        var current = queue.Dequeue();
        result.Add(current.Value);

        if (current.Left != null) queue.Enqueue(current.Left);
        if (current.Right != null) queue.Enqueue(current.Right);
    }

    return result;
}

// Level order with level separation
public static List<List<T>> LevelOrderByLevels<T>(BinaryTreeNode<T> root)
{
    var result = new List<List<T>>();
    if (root == null) return result;

    var queue = new Queue<BinaryTreeNode<T>>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        int levelSize = queue.Count;
        var currentLevel = new List<T>();

        for (int i = 0; i < levelSize; i++)
        {
            var current = queue.Dequeue();
            currentLevel.Add(current.Value);

            if (current.Left != null) queue.Enqueue(current.Left);
            if (current.Right != null) queue.Enqueue(current.Right);
        }

        result.Add(currentLevel);
    }

    return result;
}
```

---

## Binary Search Trees (BST)

### BST Implementation
```csharp
public class BinarySearchTree<T> where T : IComparable<T>
{
    private BinaryTreeNode<T> root;

    public void Insert(T value)
    {
        root = InsertHelper(root, value);
    }

    private BinaryTreeNode<T> InsertHelper(BinaryTreeNode<T> node, T value)
    {
        if (node == null)
        {
            return new BinaryTreeNode<T>(value);
        }

        int comparison = value.CompareTo(node.Value);
        if (comparison < 0)
        {
            node.Left = InsertHelper(node.Left, value);
        }
        else if (comparison > 0)
        {
            node.Right = InsertHelper(node.Right, value);
        }
        // If equal, don't insert (no duplicates)

        return node;
    }

    public bool Search(T value)
    {
        return SearchHelper(root, value);
    }

    private bool SearchHelper(BinaryTreeNode<T> node, T value)
    {
        if (node == null) return false;

        int comparison = value.CompareTo(node.Value);
        if (comparison == 0) return true;
        else if (comparison < 0) return SearchHelper(node.Left, value);
        else return SearchHelper(node.Right, value);
    }

    public void Delete(T value)
    {
        root = DeleteHelper(root, value);
    }

    private BinaryTreeNode<T> DeleteHelper(BinaryTreeNode<T> node, T value)
    {
        if (node == null) return null;

        int comparison = value.CompareTo(node.Value);
        if (comparison < 0)
        {
            node.Left = DeleteHelper(node.Left, value);
        }
        else if (comparison > 0)
        {
            node.Right = DeleteHelper(node.Right, value);
        }
        else
        {
            // Node to delete found
            if (node.Left == null) return node.Right;
            if (node.Right == null) return node.Left;

            // Node has two children - find inorder successor
            node.Value = FindMin(node.Right);
            node.Right = DeleteHelper(node.Right, node.Value);
        }

        return node;
    }

    private T FindMin(BinaryTreeNode<T> node)
    {
        while (node.Left != null)
        {
            node = node.Left;
        }
        return node.Value;
    }

    public List<T> GetSortedValues()
    {
        return TreeTraversal.InOrderTraversal(root);
    }
}
```

---

## Common Tree Algorithms

### Tree Properties
```csharp
public static class TreeAlgorithms
{
    public static int GetHeight<T>(BinaryTreeNode<T> root)
    {
        if (root == null) return -1;

        return 1 + Math.Max(GetHeight(root.Left), GetHeight(root.Right));
    }

    public static int CountNodes<T>(BinaryTreeNode<T> root)
    {
        if (root == null) return 0;

        return 1 + CountNodes(root.Left) + CountNodes(root.Right);
    }

    public static bool IsBalanced<T>(BinaryTreeNode<T> root)
    {
        return CheckBalance(root) != -1;
    }

    private static int CheckBalance<T>(BinaryTreeNode<T> node)
    {
        if (node == null) return 0;

        int leftHeight = CheckBalance(node.Left);
        if (leftHeight == -1) return -1;

        int rightHeight = CheckBalance(node.Right);
        if (rightHeight == -1) return -1;

        if (Math.Abs(leftHeight - rightHeight) > 1) return -1;

        return Math.Max(leftHeight, rightHeight) + 1;
    }

    public static bool IsValidBST<T>(BinaryTreeNode<T> root) where T : IComparable<T>
    {
        return ValidateBST(root, default(T), default(T), false, false);
    }

    private static bool ValidateBST<T>(BinaryTreeNode<T> node, T min, T max,
                                      bool hasMin, bool hasMax) where T : IComparable<T>
    {
        if (node == null) return true;

        if ((hasMin && node.Value.CompareTo(min) <= 0) ||
            (hasMax && node.Value.CompareTo(max) >= 0))
        {
            return false;
        }

        return ValidateBST(node.Left, min, node.Value, hasMin, true) &&
               ValidateBST(node.Right, node.Value, max, true, hasMax);
    }
}
```

### Finding Paths
```csharp
public static bool HasPath<T>(BinaryTreeNode<T> root, T target) where T : IEquatable<T>
{
    if (root == null) return false;
    if (root.Value.Equals(target)) return true;

    return HasPath(root.Left, target) || HasPath(root.Right, target);
}

public static List<T> FindPath<T>(BinaryTreeNode<T> root, T target) where T : IEquatable<T>
{
    var path = new List<T>();
    if (FindPathHelper(root, target, path))
    {
        return path;
    }
    return new List<T>(); // No path found
}

private static bool FindPathHelper<T>(BinaryTreeNode<T> node, T target, List<T> path) where T : IEquatable<T>
{
    if (node == null) return false;

    path.Add(node.Value);

    if (node.Value.Equals(target)) return true;

    if (FindPathHelper(node.Left, target, path) || FindPathHelper(node.Right, target, path))
    {
        return true;
    }

    // Backtrack
    path.RemoveAt(path.Count - 1);
    return false;
}
```

---

## Tree Applications

### Expression Trees
```csharp
public class ExpressionTree
{
    public class ExpressionNode
    {
        public string Value { get; set; }
        public ExpressionNode Left { get; set; }
        public ExpressionNode Right { get; set; }
        public bool IsOperator => "+-*/".Contains(Value);

        public ExpressionNode(string value)
        {
            Value = value;
        }
    }

    public static double EvaluateExpression(ExpressionNode root)
    {
        if (root == null) return 0;

        if (!root.IsOperator)
        {
            return double.Parse(root.Value);
        }

        double leftValue = EvaluateExpression(root.Left);
        double rightValue = EvaluateExpression(root.Right);

        return root.Value switch
        {
            "+" => leftValue + rightValue,
            "-" => leftValue - rightValue,
            "*" => leftValue * rightValue,
            "/" => leftValue / rightValue,
            _ => throw new InvalidOperationException($"Unknown operator: {root.Value}")
        };
    }

    // Convert expression tree to infix notation
    public static string ToInfixNotation(ExpressionNode root)
    {
        if (root == null) return "";

        if (!root.IsOperator)
        {
            return root.Value;
        }

        string left = ToInfixNotation(root.Left);
        string right = ToInfixNotation(root.Right);

        return $"({left} {root.Value} {right})";
    }
}
```

### File System Tree
```csharp
public class FileSystemNode
{
    public string Name { get; set; }
    public bool IsDirectory { get; set; }
    public List<FileSystemNode> Children { get; set; }
    public long Size { get; set; }

    public FileSystemNode(string name, bool isDirectory = false)
    {
        Name = name;
        IsDirectory = isDirectory;
        Children = isDirectory ? new List<FileSystemNode>() : null;
        Size = 0;
    }

    public void AddChild(FileSystemNode child)
    {
        if (IsDirectory)
        {
            Children.Add(child);
        }
    }

    public long GetTotalSize()
    {
        if (!IsDirectory) return Size;

        long totalSize = 0;
        foreach (var child in Children)
        {
            totalSize += child.GetTotalSize();
        }
        return totalSize;
    }

    public void PrintStructure(int depth = 0)
    {
        string indent = new string(' ', depth * 2);
        string type = IsDirectory ? "[DIR]" : "[FILE]";
        Console.WriteLine($"{indent}{type} {Name}");

        if (IsDirectory)
        {
            foreach (var child in Children)
            {
                child.PrintStructure(depth + 1);
            }
        }
    }
}
```

---

## Time Complexity Summary

| Operation | BST Average | BST Worst | Balanced Tree |
|-----------|-------------|-----------|---------------|
| **Search** | O(log n) | O(n) | O(log n) |
| **Insert** | O(log n) | O(n) | O(log n) |
| **Delete** | O(log n) | O(n) | O(log n) |
| **Traversal** | O(n) | O(n) | O(n) |

**Space Complexity:** O(n) for all tree operations

---

## When to Use Trees

**Use trees when:**
- Data has natural hierarchy
- Need efficient search in sorted data
- Building decision systems
- Parsing expressions or syntax
- Managing hierarchical relationships

**Common applications:**
- File systems
- Database indexing
- Compiler design (syntax trees)
- Decision trees in AI
- Organizational structures
- Game trees for AI

**Avoid trees when:**
- Data doesn't have hierarchy
- Simple array/list operations suffice
- Need constant time operations
- Working with fixed-size collections

---

## Quick Reference

### Traversal Summary
| Traversal | Order | Use Case |
|-----------|-------|----------|
| **Pre-order** | Root → Left → Right | Copy tree, prefix notation |
| **In-order** | Left → Root → Right | BST sorted output |
| **Post-order** | Left → Right → Root | Delete tree, postfix notation |
| **Level-order** | Level by level | Find shortest path, serialize |

### Time Complexity
| Operation | Binary Tree | BST (balanced) |
|-----------|-------------|----------------|
| Search | O(n) | O(log n) |
| Insert | O(n) | O(log n) |
| Delete | O(n) | O(log n) |
| Traversal | O(n) | O(n) |

---