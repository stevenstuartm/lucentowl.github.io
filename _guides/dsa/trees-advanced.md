---
title: "Advanced Tree Structures"
layout: guide
category: Data Structures & Algorithms
subcategory: Trees & Heaps
description: "Tries for prefix search, AVL and red-black trees and the rotations that keep them balanced, segment and Fenwick trees for range queries over changing data, and three classic binary tree problems: lowest common ancestor, diameter, and serialization."
tags: [tries, avl-trees, red-black-trees, segment-trees, fenwick-trees, advanced]
---
{% raw %}

## What a Plain Search Tree Can't Do

A binary search tree keeps keys in order, but it has three gaps. Its height depends on the order keys arrive in, so sorted input turns it into an O(n) chain. It compares whole keys at every step, so a string lookup costs O(m × h) for strings of length m, O(m log n) even when the tree is balanced, and "every string that starts with ca" has to be phrased as a range of sorted keys. And it answers questions about single keys, not about a range of positions, such as the sum of elements 2 through 6 in an array that keeps changing. Each structure in this guide closes one of those gaps.

---

## Tries

A trie, or prefix tree, stores strings one character per level. Each node represents a prefix, and its children extend that prefix by one more character. Words that share a prefix share the path that spells it, so "car", "cart", and "cat" store "ca" once.

{% endraw %}
{% include figure.html id="dsa-trie" %}
{% raw %}

The root holds no character. A node needs a flag saying whether a word ends there, because a word can end partway down another word's path. "car" ends at a node that still has a child, the "t" of "cart". Without the flag, the trie couldn't tell that "car" is stored and "ca" is not.

### Implementing a Trie

Each node maps a character to the child for that character. A `Dictionary<char, TrieNode>` handles any alphabet and only allocates the children that exist.

```csharp
public class TrieNode
{
    public Dictionary<char, TrieNode> Children { get; } = new();
    public bool IsWord { get; set; }
}

public class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            if (!node.Children.TryGetValue(c, out TrieNode? child))
            {
                child = new TrieNode();
                node.Children[c] = child;
            }
            node = child;
        }
        node.IsWord = true;
    }

    public bool Contains(string word) => Find(word)?.IsWord == true;

    public bool StartsWith(string prefix) => Find(prefix) != null;

    private TrieNode? Find(string prefix)
    {
        TrieNode? node = _root;
        foreach (char c in prefix)
        {
            if (!node.Children.TryGetValue(c, out node))
                return null;
        }
        return node;
    }
}
```

`Contains` and `StartsWith` walk the same path. The only difference is whether the node they reach has to be marked as a word.

### Listing Words by Prefix

Autocomplete finds the node for the prefix, then walks everything below it. These are two more `Trie` methods, and they need `using System.Text`. The walk builds each word in a `StringBuilder` as it goes down and removes the last letter as it comes back up, so the nodes never need to store their own words. A limit stops the walk once enough results are found, instead of collecting every match and throwing most of them away.

```csharp
public List<string> WordsWithPrefix(string prefix, int limit = int.MaxValue)
{
    var results = new List<string>();
    TrieNode? start = Find(prefix);
    if (start != null)
        Collect(start, new StringBuilder(prefix), results, limit);
    return results;
}

private static void Collect(TrieNode node, StringBuilder path, List<string> results, int limit)
{
    if (results.Count == limit) return;
    if (node.IsWord) results.Add(path.ToString());

    foreach (var (c, child) in node.Children)
    {
        path.Append(c);
        Collect(child, path, results, limit);
        path.Length--;                       // Undo the letter before trying the next child
    }
}
```

For the trie in the figure, `WordsWithPrefix("ca")` returns car, cart, and cat. `Dictionary` doesn't promise any enumeration order, so sort the results if the order matters. A real autocomplete also ranks suggestions, usually by how often each word is used, which means storing a count or score on the word's node.

### Removing a Word

Removing a word clears its flag. That can leave nodes that no longer lead to any word, and those should be pruned from the bottom up. The walk stops at the first node that still has other children or marks another word.

```csharp
public bool Remove(string word)
{
    var path = new List<(TrieNode Parent, char Letter)>();
    TrieNode node = _root;
    foreach (char c in word)
    {
        if (!node.Children.TryGetValue(c, out TrieNode? child))
            return false;
        path.Add((node, c));
        node = child;
    }

    if (!node.IsWord) return false;
    node.IsWord = false;

    // Walk back up, pruning nodes that no longer lead to any word
    for (int i = path.Count - 1; i >= 0 && node.Children.Count == 0 && !node.IsWord; i--)
    {
        path[i].Parent.Children.Remove(path[i].Letter);
        node = path[i].Parent;
    }
    return true;
}
```

Removing "cart" from the figure's trie prunes only the final "t", because the "r" above it still marks "car".

### Cost and Memory

For a string of length m, insert, lookup, prefix check, and removal each follow one path of m nodes, so they cost O(m) however many words the trie holds. Listing the words under a prefix of length p costs O(p) to find the prefix node, plus time proportional to the part of the trie below it that the walk visits.

Memory is the trade-off. The trie needs at most one node per character stored, plus the root, and shared prefixes bring that down. Every node also carries a collection of children. A `Dictionary` per node has a fixed overhead even when it holds one entry. The common alternative for a small, known alphabet is an array per node, such as 26 slots for lowercase English. It finds a child with one index instead of a hash lookup, but every node pays for all 26 slots, most of them empty.

### When a Trie Beats the Built-In Collections

For exact lookup alone, a `HashSet<string>` is usually the better choice. Hashing a string also reads all m characters, so both are O(m), and the hash set does it in one contiguous pass instead of m separate node lookups. A trie earns its memory when the questions are about prefixes:

- Autocomplete and "every word starting with this"
- Checking whether any stored word starts with a prefix, such as stopping a word search early once no word can start with the letters found so far
- Longest-prefix matching, where the answer is the longest stored key that is a prefix of the input. Variants of the trie are a standard way to do this for IP routing tables.

A `SortedSet<string>` can also answer "every word starting with this" without a custom structure. Strings that share a prefix sort next to each other, starting with the prefix itself, so a view from the prefix onward holds all the matches in a row:

```csharp
static IEnumerable<string> WithPrefix(SortedSet<string> words, string prefix)
{
    if (words.Count == 0 || string.CompareOrdinal(prefix, words.Max) > 0)
        return [];                           // Nothing sorts at or after the prefix

    // Matches sort together, starting at the prefix itself; stop at the first string that doesn't match
    return words.GetViewBetween(prefix, words.Max!)
                .TakeWhile(w => w.StartsWith(prefix, StringComparison.Ordinal));
}
```

The set has to be created with `StringComparer.Ordinal` so its order matches the ordinal `StartsWith` check. The guard is needed because `GetViewBetween` throws when its lower bound is above its upper bound. Each comparison on the way down the red-black tree re-reads the shared prefix before it finds a difference, and every word is stored in full, with no sharing of prefixes. That's often fine. A trie is the better fit when memory matters because many words share long prefixes, when the answer needed is the longest stored prefix of an input, or when a search needs to stop the moment no word can continue.

A trie also gives the longest prefix shared by a set of words directly. Insert them all, then follow the root downward while there is exactly one child and no word ends:

```csharp
public static string LongestCommonPrefix(string[] words)
{
    if (words.Length == 0) return "";

    var trie = new Trie();
    foreach (string w in words) trie.Insert(w);

    var prefix = new StringBuilder();
    TrieNode node = trie._root;
    while (node.Children.Count == 1 && !node.IsWord)
    {
        var (c, child) = node.Children.First();
        prefix.Append(c);
        node = child;
    }
    return prefix.ToString();
}
```

This is a static method on `Trie`, so it can read `_root`, and it uses LINQ's `First`. For "flower", "flow", and "flight" it returns "fl". It stops at a word end because a word that ends there, like "flow" among "flow" and "flower", is itself the longest prefix.

.NET has no built-in trie, so one written like this, or a library, is the way to get one.

---

## Self-Balancing Search Trees

A binary search tree's operations each follow one path from the root, so they cost O(h), where h is the height. A self-balancing tree checks its shape after every insert and delete and repairs it, so its height stays O(log n) whatever order the keys arrive in.

This guide counts height in edges, so a leaf has height 0 and an empty subtree −1.

### Rotations

The repair tool shared by AVL and red-black trees is the rotation. A rotation changes which of two nodes is the parent without changing the tree's in-order sequence, so the search-tree ordering survives it.

{% endraw %}
{% include figure.html id="dsa-tree-rotation" %}
{% raw %}

A right rotation at y lifts y's left child x into y's place and moves y down to be x's right child. x's old right subtree, B, holds keys between x and y, so it moves across to become y's left subtree. The rotation changes three links: y's left child, x's right child, and the link from y's old parent, which now has to point at x. The code below handles that last one by returning x for the caller to store. Three link changes make a rotation O(1). What it does to height is the reason to use it. Subtree A moves up a level and C moves down one, so a rotation shortens the side that was too tall when the extra height sits on the outside, in A. When it sits in B, one rotation isn't enough, which is the case the double rotation below handles. A left rotation is the mirror image and undoes a right rotation.

### AVL Trees

The AVL tree is the oldest self-balancing search tree, published by Georgy Adelson-Velsky and Evgenii Landis in 1962 and named from their initials. Here every node stores its height, and the tree keeps one rule. At every node, the heights of the left and right subtrees differ by at most 1. The difference, left height minus right height, is the node's balance factor, so it has to stay −1, 0, or +1.

After an insert or delete, the nodes on the path back up to the root are the only ones whose heights can change. Each one recomputes its height and balance factor on the way up. A factor of +2 or −2 means that node is out of balance, and what fixes it depends on which grandchild made it too tall:

| Case | Where the extra height is | Fix |
| --- | --- | --- |
| Left-left | The left child's left subtree | Rotate right at the node |
| Left-right | The left child's right subtree | Rotate left at the left child, then right at the node |
| Right-right | The right child's right subtree | Rotate left at the node |
| Right-left | The right child's left subtree | Rotate right at the right child, then left at the node |

The two-step cases need two rotations because a single right rotation at the node would carry the left child's tall right subtree across to the other side, where it would be just as tall. Rotating the child first moves that height to the outside, where the second rotation can lift it.

{% endraw %}
{% include figure.html id="dsa-avl-double-rotation" %}
{% raw %}

```csharp
public class AvlNode
{
    public int Key { get; set; }
    public int Height { get; set; }            // A new node is a leaf: height 0
    public AvlNode? Left { get; set; }
    public AvlNode? Right { get; set; }

    public AvlNode(int key) => Key = key;
}

public class AvlTree
{
    private AvlNode? _root;

    private static int HeightOf(AvlNode? node) => node?.Height ?? -1;   // Empty tree: height -1

    private static int BalanceOf(AvlNode node) => HeightOf(node.Left) - HeightOf(node.Right);

    private static void UpdateHeight(AvlNode node) =>
        node.Height = 1 + Math.Max(HeightOf(node.Left), HeightOf(node.Right));

    private static AvlNode RotateRight(AvlNode y)
    {
        AvlNode x = y.Left!;
        y.Left = x.Right;       // x's right subtree moves across to become y's left
        x.Right = y;
        UpdateHeight(y);        // y is now below x, so update it first
        UpdateHeight(x);
        return x;               // x takes y's place
    }

    private static AvlNode RotateLeft(AvlNode x)
    {
        AvlNode y = x.Right!;
        x.Right = y.Left;
        y.Left = x;
        UpdateHeight(x);
        UpdateHeight(y);
        return y;
    }

    private static AvlNode Rebalance(AvlNode node)
    {
        UpdateHeight(node);
        int balance = BalanceOf(node);

        if (balance > 1)                               // Left side too tall
        {
            if (BalanceOf(node.Left!) < 0)             // Left-right case: straighten it first
                node.Left = RotateLeft(node.Left!);
            return RotateRight(node);
        }

        if (balance < -1)                              // Right side too tall
        {
            if (BalanceOf(node.Right!) > 0)            // Right-left case
                node.Right = RotateRight(node.Right!);
            return RotateLeft(node);
        }

        return node;
    }

    public void Insert(int key) => _root = Insert(_root, key);

    private static AvlNode Insert(AvlNode? node, int key)
    {
        if (node == null) return new AvlNode(key);

        if (key < node.Key) node.Left = Insert(node.Left, key);
        else if (key > node.Key) node.Right = Insert(node.Right, key);
        else return node;                              // Already present

        return Rebalance(node);
    }

    public void Remove(int key) => _root = Remove(_root, key);

    private static AvlNode? Remove(AvlNode? node, int key)
    {
        if (node == null) return null;

        if (key < node.Key) node.Left = Remove(node.Left, key);
        else if (key > node.Key) node.Right = Remove(node.Right, key);
        else if (node.Left == null) return node.Right;
        else if (node.Right == null) return node.Left;
        else
        {
            AvlNode successor = node.Right;
            while (successor.Left != null) successor = successor.Left;
            node.Key = successor.Key;
            node.Right = Remove(node.Right, successor.Key);
        }

        return Rebalance(node);
    }

    public bool Contains(int key)
    {
        AvlNode? node = _root;
        while (node != null && node.Key != key)
            node = key < node.Key ? node.Left : node.Right;
        return node != null;
    }
}
```

Insert and remove are an ordinary BST insert and delete, with `Rebalance` applied to every node on the way back up the recursion. Search is unchanged, because balancing only changes the shape. Rebalancing on the child's balance factor, rather than on which side the new key went, is what lets the same `Rebalance` serve both insert and delete.

Inserting the keys 1 to 1,000,000 in sorted order into this tree leaves it with height 19. A plain BST given the same input would be a chain of height 999,999. In general an AVL tree's height stays below about 1.44 log₂ n, so search, insert, and delete are all O(log n) in the worst case. An insert needs at most one single or double rotation to restore balance. A delete can need a rotation at several levels on the way up, still O(log n) in total.

### Red-Black Trees

A red-black tree reaches the same O(log n) guarantee with a looser rule. Each node is colored red or black, and the tree keeps these properties, counting the empty children below the leaves as black:

1. The root is black.
2. A red node has no red child.
3. Every path from a node down to an empty child passes through the same number of black nodes.

Property 3 makes every path equally long if red nodes are ignored. Property 2 means the red nodes can at most double a path, since reds can't sit next to each other. So the longest path from the root is at most twice the shortest. Turning that into a height bound takes one more fact. A subtree whose paths each pass through b black nodes, counting its own root but not the empty children, holds at least 2ᵇ − 1 nodes, so the root's black count is at most log₂(n + 1), and the height, at most twice that, is at most 2 log₂(n + 1).

Inserts and deletes restore the properties by recoloring nodes and rotating. The recoloring can travel up the tree, but an insert needs at most two rotations and a delete at most three. The fix-up has several cases for each operation, and it's rarely written by hand outside a textbook or a collections library.

### AVL or Red-Black

| | AVL tree | Red-black tree |
| --- | --- | --- |
| Balance rule | Subtree heights differ by at most 1 | No red node has a red child, and black counts match on every path |
| Height bound | About 1.44 log₂ n | 2 log₂(n + 1) |
| Search, insert, delete | O(log n) worst case | O(log n) worst case |
| Rotations per insert | At most 2 (one double rotation) | At most 2 |
| Rotations per delete | Up to O(log n) | At most 3 |
| Stored per node | A height in the code above. The classic form stores a balance factor in two bits | A color, which fits in one bit |

The tighter balance gives AVL trees shorter search paths, so they tend to suit lookup-heavy workloads. Red-black trees do at most three rotations per delete, where an AVL delete can rotate at every level on the way up. .NET's `SortedSet<T>` is a red-black tree, and `SortedDictionary<TKey,TValue>` is built on it. Java's `TreeMap` is one too.

In .NET, reach for `SortedSet<T>` or `SortedDictionary<TKey,TValue>` whenever keys need to stay sorted. The AVL tree above shows how balancing works, not something to ship instead of the built-in types.

---

## Range Queries

Some problems ask about a range of positions in an array rather than about single keys, such as the sum, minimum, or maximum of elements `left` through `right`. If the array never changes, a prefix-sum array answers a range sum in O(1). With `prefix[i]` holding the sum of the first i elements, the sum from `left` to `right` is `prefix[right + 1] − prefix[left]`. But changing one element means rebuilding every prefix after it, which is O(n). Segment trees and Fenwick trees make both the query and the update O(log n).

### Segment Trees

A segment tree is a binary tree over the array's positions. The root covers the whole array, each node's two children split its range in half, and each leaf covers a single position. Every node stores the answer for its range. For range sums, that's the sum of its elements.

A query for a range works down from the root, and each node falls into one of three cases. A node entirely inside the query returns its stored sum without looking further. A node entirely outside returns 0. A node that only partly overlaps asks both of its children and adds their answers.

{% endraw %}
{% include figure.html id="dsa-segment-tree" %}
{% raw %}

Only nodes containing one end of the query can partly overlap it, so at most two nodes per level split, and a query touches O(log n) nodes. Updating one element changes its leaf and the sums on the path above it, which is also O(log n).

The tree lives in an array with the same index arithmetic as a binary heap, with node i's children at 2i + 1 and 2i + 2. Unlike a heap, the tree isn't always complete, so some slots go unused, but an array of 4n slots is always large enough.

```csharp
public class SegmentTree
{
    private readonly int[] _tree;
    private readonly int _n;

    public SegmentTree(int[] values)
    {
        _n = values.Length;
        _tree = new int[4 * _n];                 // Always enough room for every node
        if (_n > 0) Build(values, 0, 0, _n - 1);
    }

    // Node `node` covers values[start..end]. Its children are 2*node+1 and 2*node+2.
    private void Build(int[] values, int node, int start, int end)
    {
        if (start == end)
        {
            _tree[node] = values[start];
            return;
        }

        int mid = (start + end) / 2;
        Build(values, 2 * node + 1, start, mid);
        Build(values, 2 * node + 2, mid + 1, end);
        _tree[node] = _tree[2 * node + 1] + _tree[2 * node + 2];
    }

    public int Sum(int left, int right) => Sum(0, 0, _n - 1, left, right);

    private int Sum(int node, int start, int end, int left, int right)
    {
        if (right < start || end < left)
            return 0;                            // No overlap
        if (left <= start && end <= right)
            return _tree[node];                  // Fully inside the query: use the stored sum

        int mid = (start + end) / 2;             // Partial overlap: ask both children
        return Sum(2 * node + 1, start, mid, left, right)
             + Sum(2 * node + 2, mid + 1, end, left, right);
    }

    public void Set(int index, int value) => Set(0, 0, _n - 1, index, value);

    private void Set(int node, int start, int end, int index, int value)
    {
        if (start == end)
        {
            _tree[node] = value;
            return;
        }

        int mid = (start + end) / 2;
        if (index <= mid) Set(2 * node + 1, start, mid, index, value);
        else Set(2 * node + 2, mid + 1, end, index, value);
        _tree[node] = _tree[2 * node + 1] + _tree[2 * node + 2];
    }
}
```

Building visits each node once, so it's O(n). Sum isn't special. The same tree answers range minimum or range maximum by storing that value instead and combining children with `Math.Min` or `Math.Max`, with the no-overlap case returning a value that can't win, such as `int.MaxValue` for a minimum. Any operation where the answer for a range can be combined from the answers for its two halves works.

This tree changes one element at a time. Adding 5 to every element from position 100 to 900 would take hundreds of point updates. Segment trees handle a range update in O(log n) with lazy propagation, where a node records a pending change for its whole range and passes it down to its children only when a later query or update needs to look inside. Fenwick trees have range-update variants too. Storing differences gives range updates with single-element reads, and a pair of Fenwick trees gives range updates with range sums.

### Fenwick Trees

A Fenwick tree, or binary indexed tree, was described by Peter Fenwick in 1994 for cumulative frequency tables. It answers prefix sums and single-element updates in O(log n) using one array of n + 1 integers and two short loops, with no recursion and no explicit tree.

Each slot i, counting from 1, stores the sum of a block of elements ending at position i. The block's length is the lowest set bit of i. Slot 6 (binary 110) covers two elements, slot 8 (1000) covers eight, and every odd slot covers one. `i & -i` isolates that lowest bit, because in two's complement `-i` flips every bit above it. A prefix sum adds blocks while stripping the lowest bit off i, moving left. An update adds to every block that contains the position, by adding the lowest bit to i, moving right. Each step of either loop moves the lowest set bit at least one place, so neither runs more than about log₂ n times, and both are O(log n).

{% endraw %}
{% include figure.html id="dsa-fenwick-tree" %}
{% raw %}

```csharp
public class FenwickTree
{
    private readonly int[] _tree;                // 1-based: _tree[0] is unused

    public FenwickTree(int[] values)
    {
        _tree = new int[values.Length + 1];
        for (int i = 0; i < values.Length; i++)
            Add(i, values[i]);
    }

    public void Add(int index, int delta)
    {
        for (int i = index + 1; i < _tree.Length; i += i & -i)
            _tree[i] += delta;
    }

    public int PrefixSum(int index)              // Sum of values[0..index]
    {
        int sum = 0;
        for (int i = index + 1; i > 0; i -= i & -i)
            sum += _tree[i];
        return sum;
    }

    public int Sum(int left, int right) =>
        PrefixSum(right) - (left > 0 ? PrefixSum(left - 1) : 0);
}
```

`Add` takes a change, not a new value. To set element i to v, call `Add(i, v - current)`, which means keeping the current values somewhere. Building by n calls to `Add` costs O(n log n). A linear-time build exists, where each slot passes its total to the next slot that contains it, but the simple loop is usually fast enough.

A range sum is two prefix sums subtracted. That subtraction is the Fenwick tree's limit, because it needs an operation that can be undone, like addition or XOR. A range minimum can't be recovered from two prefix minimums, so it usually goes to a segment tree, or to a sparse table if the data never changes.

### Segment Tree or Fenwick Tree

| | Segment tree | Fenwick tree |
| --- | --- | --- |
| Range query, point update | O(log n) | O(log n) |
| Build | O(n) | O(n log n) as written, O(n) with the linear build |
| Memory | Up to 4n slots | n + 1 slots |
| Operations | Anything that combines two halves: sum, min, max, gcd | Invertible ones: sum, XOR |
| Code | Recursive, around 50 lines | Two loops |

Use a Fenwick tree for sums and counts over data that changes, and a segment tree for a minimum, a maximum, or anything else a Fenwick tree can't subtract. When the data never changes, a plain prefix-sum array beats both.

---

## Worked Problems on Binary Trees

These use the usual binary tree node:

```csharp
public class TreeNode
{
    public int Value { get; set; }
    public TreeNode? Left { get; set; }
    public TreeNode? Right { get; set; }

    public TreeNode(int value) => Value = value;
}
```

Each one visits each node at most once, so each is O(n) time. All three recurse, so they use O(h) stack space, and on a very deep tree the recursion can overflow the stack.

### Lowest Common Ancestor in Any Binary Tree

The lowest common ancestor of two nodes is the deepest node that has both of them in its subtree. In a binary search tree the ordering finds it directly, but an arbitrary binary tree has no ordering to follow, so the search has to look everywhere.

Search each subtree for either node. If the left subtree finds one and the right subtree finds the other, the current node is where their paths split, so it's the answer. If only one side finds anything, that result is passed up unchanged.

```csharp
public static TreeNode? LowestCommonAncestor(TreeNode? node, TreeNode a, TreeNode b)
{
    if (node == null || node == a || node == b)
        return node;

    TreeNode? left = LowestCommonAncestor(node.Left, a, b);
    TreeNode? right = LowestCommonAncestor(node.Right, a, b);

    if (left != null && right != null)
        return node;                         // a and b are on different sides of this node
    return left ?? right;                    // Both are on one side, or neither is here
}
```

Returning as soon as the node matches `a` or `b` handles the case where one node is an ancestor of the other. The search never looks below the first one it finds, and that first one is the answer. The method assumes both nodes are in the tree. If only `a` is present, it returns `a` rather than null.

### Diameter

A tree's diameter is the number of edges on the longest path between any two nodes. That path doesn't have to pass through the root. It bends at some node, going down into its left subtree and down into its right, so its length there is the left subtree's height plus the right subtree's height plus the two edges into them. An empty side has height −1, which cancels the edge that isn't there.

One post-order pass computes every node's height and checks the bending path at each node along the way:

```csharp
public static int Diameter(TreeNode? root)
{
    int best = 0;
    Height(root);
    return best;

    int Height(TreeNode? node)
    {
        if (node == null) return -1;
        int left = Height(node.Left);
        int right = Height(node.Right);
        best = Math.Max(best, left + right + 2);   // Longest path that bends at this node
        return 1 + Math.Max(left, right);
    }
}
```

The local function keeps `best` inside the call. A static field would work once, then give wrong answers when two threads call it or when a caller forgets to reset it.

### Serializing a Tree

Saving a tree to a string and rebuilding it needs a format that records the shape, not just the values. A pre-order traversal alone is ambiguous, since "1,2" could be 2 as the left child or as the right child. Writing a marker for every empty child fixes that. With the markers, a pre-order listing describes exactly one tree.

```csharp
public static string Serialize(TreeNode? root)
{
    var tokens = new List<string>();
    Write(root);
    return string.Join(",", tokens);

    void Write(TreeNode? node)
    {
        if (node == null)
        {
            tokens.Add("#");
            return;
        }
        tokens.Add(node.Value.ToString());
        Write(node.Left);
        Write(node.Right);
    }
}

public static TreeNode? Deserialize(string data)
{
    var tokens = new Queue<string>(data.Split(','));
    return Read();

    TreeNode? Read()
    {
        string token = tokens.Dequeue();
        if (token == "#") return null;

        var node = new TreeNode(int.Parse(token));
        node.Left = Read();
        node.Right = Read();
        return node;
    }
}
```

The tree with root 1, left child 2, and right child 3 serializes to `1,2,#,#,3,#,#`. Reading it back consumes tokens in the same order they were written. A value creates a node and reads its left subtree and then its right, and a `#` ends a branch.

---

## Other Specialized Trees

A few more trees come up often enough to recognize by name:

- **B-trees and B+ trees** are the index structure behind most relational databases and many file systems.
- **k-d trees** split points in space along alternating coordinates, x then y then x again, and answer nearest-neighbor and region queries in low dimensions.
- **Quadtrees** split a 2D region into four quadrants, recursively, until each holds few enough points. Maps and collision detection use them to skip empty space.

---

## Choosing a Structure

| The problem | Use | Why |
| --- | --- | --- |
| Keys kept in sorted order, with inserts and deletes | `SortedSet<T>` or `SortedDictionary<TKey,TValue>` | A red-black tree, already written and tested |
| Every string with a given prefix, occasionally | `SortedSet<string>` with `GetViewBetween` | Built in. Matches sit next to each other in sorted order |
| Heavy prefix work, the longest matching prefix, or many shared prefixes | A trie | Cost depends on the string's length, not on how many strings are stored, and shared prefixes are stored once |
| Exact string lookup only | `HashSet<string>` or `Dictionary<string,TValue>` | Less memory and fewer lookups than a trie |
| Range sums over data that changes | A Fenwick tree | O(log n) query and update in two short loops |
| Range minimum or maximum over data that changes | A segment tree | Handles operations a Fenwick tree can't subtract |
| Range sums over data that never changes | A prefix-sum array | O(1) per query after an O(n) build |

Writing a balanced tree by hand is rarely the right call in production code, because the built-in sorted collections already guarantee O(log n). Tries, segment trees, and Fenwick trees have no built-in .NET equivalent, so those are the ones to know how to write.

{% endraw %}
