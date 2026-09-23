---
title: "Trees & Binary Search Trees"
layout: guide
category: Data Structures & Algorithms
subcategory: Trees & Heaps
description: "Tree vocabulary, general and binary trees, the four traversal orders and what each is for, and binary search trees: how search, insert, and delete work, why the tree's height decides their cost, and the .NET types that keep a tree balanced for you."
tags: [trees, binary-trees, binary-search-trees, tree-traversal, sorteddictionary, fundamentals]
---
{% raw %}

## Why Trees Exist

Many things are hierarchies: folders inside folders, an org chart, the nested structure of HTML or of a parsed expression. A tree models that shape directly, with each item holding the items beneath it. Trees also do a second job that has nothing to do with hierarchy. Arranged by a sorting rule, a tree can keep data in order while still allowing fast inserts and deletes, which neither a sorted array (slow inserts) nor a hash table (no order) manages on its own.

---

## Tree Vocabulary

A tree is a set of nodes connected by edges, where one node is the root, every other node has exactly one parent, and following parents upward from any node always leads back to the root. Those rules mean a tree is connected, has no cycles, and has exactly one path between any two nodes.

| Term | Meaning |
| --- | --- |
| Root | The one node with no parent |
| Parent, child | A node directly above or below another |
| Leaf | A node with no children |
| Internal node | A node with at least one child |
| Subtree | A node together with everything below it |
| Depth of a node | The number of edges from the root down to it. The root has depth 0 |
| Level | All the nodes at one depth |
| Height of a tree | The number of edges on the longest path from the root down to a leaf |
| Full level | A level holding every node it can: 1 at depth 0, 2 at depth 1, 4 at depth 2, and so on |
| Complete binary tree | A binary tree whose levels are all full except possibly the last, which fills from left to right. CLRS calls this shape nearly complete |

{% endraw %}
{% include figure.html id="dsa-tree-vocabulary" %}
{% raw %}

This guide counts height in edges, so a single node has height 0 and an empty tree height −1. Some sources count nodes instead, which gives one more. Either convention works if it is used consistently, and the difference never changes a Big O result.

Height follows directly from the definition. A node's height is one more than the taller of its two subtrees, and an empty subtree counts as −1, so a leaf comes out at 0. The `TreeNode` type is defined in the binary tree section below.

```csharp
public static int Height(TreeNode? node) =>
    node == null ? -1 : 1 + Math.Max(Height(node.Left), Height(node.Right));
```

---

## General Trees

In a general tree, a node can have any number of children, so each node keeps a list of them. A file system is the familiar example: a directory holds any number of files and directories.

```csharp
public class FileSystemNode
{
    public string Name { get; }
    public long Size { get; }                        // Files only
    public List<FileSystemNode> Children { get; } = new();
    public bool IsDirectory { get; }

    public FileSystemNode(string name, bool isDirectory, long size = 0) =>
        (Name, IsDirectory, Size) = (name, isDirectory, size);

    public long TotalSize()
    {
        if (!IsDirectory)
            return Size;

        long total = 0;
        foreach (var child in Children)
            total += child.TotalSize();              // Children first, then this directory
        return total;
    }
}

var root = new FileSystemNode("/", isDirectory: true);
var docs = new FileSystemNode("docs", isDirectory: true);
docs.Children.Add(new FileSystemNode("notes.txt", isDirectory: false, size: 1_200));
docs.Children.Add(new FileSystemNode("plan.pdf", isDirectory: false, size: 48_000));
root.Children.Add(docs);
root.Children.Add(new FileSystemNode("readme.md", isDirectory: false, size: 800));

Console.WriteLine(root.TotalSize());  // 50000
```

`TotalSize` has to finish every child before it can report a directory's size. That "children before parent" order is a post-order traversal, described next.

---

## Binary Trees and Traversal Orders

A binary tree limits every node to at most two children, called left and right. Many algorithmic trees are binary, including binary search trees and binary heaps. This guide's examples use a node with integer values:

```csharp
public class TreeNode
{
    public int Value { get; set; }
    public TreeNode? Left { get; set; }
    public TreeNode? Right { get; set; }

    public TreeNode(int value) => Value = value;
}
```

A traversal visits every node once. The four standard orders differ only in when a node is visited relative to its children:

| Order | Visit sequence | Typical use |
| --- | --- | --- |
| Pre-order | Node, then left subtree, then right subtree | Copying or serializing a tree (writing it out so it can be rebuilt), since a parent is written before its children |
| In-order | Left subtree, then node, then right subtree | Reading a binary search tree's keys in sorted order |
| Post-order | Left subtree, then right subtree, then node | Anything that needs the children's results first: directory sizes, deleting a tree, evaluating an expression tree |
| Level-order (breadth-first) | All of depth 0, then depth 1, and so on | Processing a tree level by level, or finding the shallowest node that meets a condition |

For the tree in the vocabulary figure, the four orders visit the nodes like this:

| Order | Visits |
| --- | --- |
| Pre-order | A, B, D, E, C, F |
| In-order | D, B, E, A, C, F |
| Post-order | D, E, B, F, C, A |
| Level-order | A, B, C, D, E, F |

The three depth-first orders are the same recursion with the visit placed differently:

```csharp
public static void PreOrder(TreeNode? node, List<int> output)
{
    if (node == null) return;
    output.Add(node.Value);
    PreOrder(node.Left, output);
    PreOrder(node.Right, output);
}

public static void InOrder(TreeNode? node, List<int> output)
{
    if (node == null) return;
    InOrder(node.Left, output);
    output.Add(node.Value);
    InOrder(node.Right, output);
}

public static void PostOrder(TreeNode? node, List<int> output)
{
    if (node == null) return;
    PostOrder(node.Left, output);
    PostOrder(node.Right, output);
    output.Add(node.Value);
}
```

Passing one output list down, instead of having each call return and concatenate its own list, keeps each traversal O(n). Concatenating lists at every level copies elements repeatedly, which costs up to O(n²) on a deep tree. The recursion depth grows with the tree's height, so on a very deep tree these can overflow the stack, and an explicit `Stack<T>` can replace the recursion.

Level-order traversal uses a queue instead of recursion. Counting the queue's length at the start of each level separates the levels:

```csharp
public static List<List<int>> LevelOrder(TreeNode? root)
{
    var levels = new List<List<int>>();
    if (root == null) return levels;

    var queue = new Queue<TreeNode>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        int levelSize = queue.Count;  // Everything queued now is on the current level
        var level = new List<int>(levelSize);

        for (int i = 0; i < levelSize; i++)
        {
            TreeNode node = queue.Dequeue();
            level.Add(node.Value);
            if (node.Left != null) queue.Enqueue(node.Left);
            if (node.Right != null) queue.Enqueue(node.Right);
        }

        levels.Add(level);
    }

    return levels;
}
```

All four traversals are O(n) time. The depth-first orders use O(h) extra space for the recursion, where h is the height. Level-order uses space proportional to the widest level, which is up to about n/2 for a complete tree.

---

## Binary Search Trees

A binary search tree (BST) is a binary tree whose node values act as keys, and it keeps one rule at every node: every key in the left subtree is smaller than the node's key, and every key in the right subtree is larger. The rule applies to the entire subtree, not just the immediate children. A tree whose root is 10 cannot have a 12 anywhere in its left subtree, even as a right child several levels down.

The rule makes searching work like binary search. At each node, one comparison says whether the target is here, to the left, or to the right, and the other side of the tree is never examined. It also means an in-order traversal returns the keys sorted.

### Search and Insert

Search walks down from the root, going left or right by comparison, until it finds the key or falls off the tree. Insert follows the same path and attaches the new node where the search fell off.

```csharp
public static TreeNode? Search(TreeNode? node, int key)
{
    while (node != null && node.Value != key)
        node = key < node.Value ? node.Left : node.Right;

    return node;
}

public static TreeNode Insert(TreeNode? node, int key)
{
    if (node == null)
        return new TreeNode(key);

    if (key < node.Value)
        node.Left = Insert(node.Left, key);
    else if (key > node.Value)
        node.Right = Insert(node.Right, key);
    // Equal keys are ignored: this tree stores each key once

    return node;
}
```

The smallest key is found by following left children from the root until there are none, and the largest by following right children.

### Delete

Deleting a node has three cases, depending on how many children it has:

1. **No children.** Remove it.
2. **One child.** Replace the node with its child. The child's whole subtree moves up one level, and the ordering rule still holds.
3. **Two children.** Find the node's in-order successor, the smallest key in its right subtree. Copy that key into the node, then delete the successor from the right subtree. The successor has no left child (otherwise that child would be smaller), so its own deletion is always case 1 or 2.

{% endraw %}
{% include figure.html id="dsa-bst-delete-successor" %}
{% raw %}

```csharp
public static TreeNode? Delete(TreeNode? node, int key)
{
    if (node == null)
        return null;

    if (key < node.Value)
        node.Left = Delete(node.Left, key);
    else if (key > node.Value)
        node.Right = Delete(node.Right, key);
    else if (node.Left == null)
        return node.Right;               // Cases 1 and 2: zero children or only a right child
    else if (node.Right == null)
        return node.Left;                // Case 2: only a left child
    else
    {
        TreeNode successor = node.Right; // Case 3: find the smallest key in the right subtree
        while (successor.Left != null)
            successor = successor.Left;

        node.Value = successor.Value;
        node.Right = Delete(node.Right, successor.Value);
    }

    return node;
}
```

The successor is the right choice because it is larger than everything in the left subtree and smaller than everything else in the right subtree, so it can take the deleted key's place without breaking the rule. The in-order predecessor, the largest key in the left subtree, works as well for correctness.

---

## Height Decides the Cost

Search, insert, and delete each follow one path from the root downward, so each costs O(h), where h is the tree's height. The height depends on the order the keys arrived in.

{% endraw %}
{% include figure.html id="dsa-bst-shapes" %}
{% raw %}

A tree whose levels are full has height about log₂ n, so a million keys fit in about 20 levels and every operation is O(log n). Keys inserted in random order produce a tree whose expected height is also O(log n). But keys inserted in sorted order, a common case with IDs, timestamps, and already-sorted files, make every new key the right child of the previous one. The tree becomes a chain of height n − 1, and every operation degrades to O(n), no better than a linked list.

| Operation | Balanced BST | Unbalanced BST, worst case |
| --- | --- | --- |
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| Minimum or maximum | O(log n) | O(n) |
| In-order traversal | O(n) | O(n) |

A plain BST makes no promise about its shape, so it cannot promise O(log n). Self-balancing trees, such as AVL trees and red-black trees, restructure themselves after inserts and deletes to keep their height O(log n) whatever order the keys arrive in. `SortedSet<T>` and `SortedDictionary<TKey,TValue>` in .NET are self-balancing trees for that reason, not the plain BST shown here.

---

## Worked Problems

### Validating a Binary Search Tree

The obvious check, comparing each node with its two children, is wrong. It accepts a tree where 12 sits as the right child of 5, which is the left child of 10. Every parent-child pair looks fine, but 12 is in 10's left subtree. The correct check passes down the range of values each subtree is allowed to hold:

```csharp
public static bool IsValidBst(TreeNode? node, long min = long.MinValue, long max = long.MaxValue)
{
    if (node == null)
        return true;

    if (node.Value <= min || node.Value >= max)
        return false;

    return IsValidBst(node.Left, min, node.Value)    // Left subtree: below this key
        && IsValidBst(node.Right, node.Value, max);  // Right subtree: above this key
}
```

The bounds are `long` so that nodes holding `int.MinValue` or `int.MaxValue` are still inside the starting range. An equivalent approach runs an in-order traversal and confirms each key is larger than the one before.

### Lowest Common Ancestor in a BST

The lowest common ancestor of two keys is the deepest node that has both in its subtree. In a BST, the ordering rule finds it directly. While both keys are smaller than the current node, the answer is in the left subtree, and while both are larger, it is in the right. The first node where they split, or where one of them matches, is the answer.

```csharp
public static TreeNode? LowestCommonAncestor(TreeNode? node, int a, int b)
{
    while (node != null)
    {
        if (a < node.Value && b < node.Value)
            node = node.Left;
        else if (a > node.Value && b > node.Value)
            node = node.Right;
        else
            return node;  // The keys split here, or one of them is this node
    }

    return null;
}
```

This assumes both keys are in the tree, and it runs in O(h).

### Building a Balanced BST from Sorted Data

A sorted array can be turned into a tree of minimum height by making the middle element the root and building each half the same way. This is a good way to load sorted data into a BST, since inserting it in order produces the chain shown earlier.

```csharp
public static TreeNode? FromSorted(int[] sorted, int start, int end)
{
    if (start > end)
        return null;

    int mid = start + (end - start) / 2;
    return new TreeNode(sorted[mid])
    {
        Left = FromSorted(sorted, start, mid - 1),
        Right = FromSorted(sorted, mid + 1, end)
    };
}

TreeNode? balanced = FromSorted(new[] { 1, 2, 3, 4, 5, 6, 7 }, 0, 6);  // Root 4, height 2
```

---

## Expression Trees

An arithmetic expression is a tree. (These are unrelated to .NET's LINQ expression trees in `System.Linq.Expressions`, although those are built on the same idea.) Each operator is an internal node with its operands as children, and each number is a leaf. `(3 + 4) * 2` has `*` at the root, with the subtree for `3 + 4` on the left and the leaf `2` on the right. Parentheses disappear, because the tree's shape already records what is grouped with what.

Evaluating the tree is a post-order traversal, because an operator needs both operand values first. An in-order traversal with parentheses added around each operator prints the familiar infix form, with each operator between its operands, and a post-order traversal prints postfix, with each operator after them.

```csharp
public record ExprNode(string Token, ExprNode? Left = null, ExprNode? Right = null);

public static double Evaluate(ExprNode node)
{
    if (node.Left == null || node.Right == null)
        return double.Parse(node.Token);  // A leaf holds a number

    double left = Evaluate(node.Left);    // Children first: post-order
    double right = Evaluate(node.Right);

    return node.Token switch
    {
        "+" => left + right,
        "-" => left - right,
        "*" => left * right,
        "/" => left / right,
        _ => throw new InvalidOperationException($"Unknown operator '{node.Token}'.")
    };
}

var expression = new ExprNode("*", new ExprNode("+", new("3"), new("4")), new("2"));
Console.WriteLine(Evaluate(expression));  // 14
```

Compilers and interpreters build trees like this, called abstract syntax trees, for whole programs.

---

## Trees in .NET

.NET has no general-purpose public binary tree type. The mutable `SortedSet<T>` and `SortedDictionary<TKey,TValue>` are balanced binary search trees, and `SortedList<TKey,TValue>` keeps sorted arrays instead:

| Type | Structure | Use it for |
| --- | --- | --- |
| `SortedSet<T>` | Red-black tree | A set kept in sorted order, with `Min`, `Max`, and range queries through `GetViewBetween` |
| `SortedDictionary<TKey,TValue>` | Red-black tree of key-value pairs | A dictionary whose keys stay sorted, with O(log n) inserts and removals |
| `SortedList<TKey,TValue>` | Two sorted arrays with binary search | Sorted data that is mostly read. Lookups are O(log n). Inserts shift elements and are O(n), except that adding a key larger than every existing key appends without shifting, in O(log n) unless the arrays have to grow |

A red-black tree keeps its height at most 2 log₂(n + 1), so `SortedSet<T>` and `SortedDictionary<TKey,TValue>` guarantee O(log n) operations regardless of insertion order. `SortedList<TKey,TValue>` makes no such promise for inserts. The immutable versions, `ImmutableSortedSet<T>` and `ImmutableSortedDictionary<TKey,TValue>`, are balanced trees too, AVL trees in the `dotnet/runtime` source.

The choice against a hash table comes down to order. `Dictionary<TKey,TValue>` is faster on average, O(1) against O(log n), but it keeps no order. When code needs sorted iteration, the smallest or largest key, or every key in a range, a sorted collection is the right structure.

{% endraw %}
