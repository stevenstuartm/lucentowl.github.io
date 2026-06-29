---
title: "Advanced Tree Structures"
category: Data Structures & Algorithms
description: "Master advanced tree structures including tries for prefix matching, segment trees, balanced trees like AVL and Red-Black, and specialized applications."
tags: [data-structures, algorithms, trees, advanced, interview-prep]
---

## Tries (Prefix Trees)

### Why Tries Exist

Tries excel at string operations like autocomplete, spell checking, and prefix matching. They provide O(m) search time where m is the string length, regardless of how many strings are stored. Essential for text processing, search engines, and any application dealing with string prefixes.

**Real impact:** Tries power autocomplete features, spell checkers, IP routing tables, and efficient string search in large datasets.

### Trie Implementation
```csharp
public class TrieNode
{
    public Dictionary<char, TrieNode> Children { get; set; }
    public bool IsEndOfWord { get; set; }
    public string Word { get; set; } // Optional: store the complete word

    public TrieNode()
    {
        Children = new Dictionary<char, TrieNode>();
        IsEndOfWord = false;
        Word = null;
    }
}

public class Trie
{
    private TrieNode root;

    public Trie()
    {
        root = new TrieNode();
    }

    public void Insert(string word)
    {
        TrieNode current = root;

        foreach (char c in word.ToLower())
        {
            if (!current.Children.ContainsKey(c))
            {
                current.Children[c] = new TrieNode();
            }
            current = current.Children[c];
        }

        current.IsEndOfWord = true;
        current.Word = word;
    }

    public bool Search(string word)
    {
        TrieNode node = FindNode(word.ToLower());
        return node != null && node.IsEndOfWord;
    }

    public bool StartsWith(string prefix)
    {
        return FindNode(prefix.ToLower()) != null;
    }

    private TrieNode FindNode(string prefix)
    {
        TrieNode current = root;

        foreach (char c in prefix)
        {
            if (!current.Children.ContainsKey(c))
            {
                return null;
            }
            current = current.Children[c];
        }

        return current;
    }

    // Get all words with given prefix (autocomplete)
    public List<string> GetWordsWithPrefix(string prefix)
    {
        var result = new List<string>();
        TrieNode prefixNode = FindNode(prefix.ToLower());

        if (prefixNode != null)
        {
            CollectWords(prefixNode, prefix.ToLower(), result);
        }

        return result;
    }

    private void CollectWords(TrieNode node, string prefix, List<string> result)
    {
        if (node.IsEndOfWord)
        {
            result.Add(node.Word ?? prefix);
        }

        foreach (var kvp in node.Children)
        {
            CollectWords(kvp.Value, prefix + kvp.Key, result);
        }
    }

    // Delete a word from trie
    public void Delete(string word)
    {
        DeleteHelper(root, word.ToLower(), 0);
    }

    private bool DeleteHelper(TrieNode node, string word, int index)
    {
        if (index == word.Length)
        {
            if (!node.IsEndOfWord) return false;

            node.IsEndOfWord = false;
            node.Word = null;

            // If node has no children, it can be deleted
            return node.Children.Count == 0;
        }

        char c = word[index];
        if (!node.Children.ContainsKey(c)) return false;

        bool shouldDeleteChild = DeleteHelper(node.Children[c], word, index + 1);

        if (shouldDeleteChild)
        {
            node.Children.Remove(c);
            // Return true if current node has no children and is not end of word
            return node.Children.Count == 0 && !node.IsEndOfWord;
        }

        return false;
    }
}
```

### Advanced Trie Applications
```csharp
public static class TrieApplications
{
    // Word suggestion with maximum count
    public static List<string> GetTopSuggestions(Trie trie, string prefix, int maxSuggestions)
    {
        var suggestions = trie.GetWordsWithPrefix(prefix);
        return suggestions.Take(maxSuggestions).ToList();
    }

    // Find longest common prefix of all strings
    public static string LongestCommonPrefix(string[] words)
    {
        if (words.Length == 0) return "";

        var trie = new Trie();
        foreach (string word in words)
        {
            trie.Insert(word);
        }

        var current = trie.root;
        var prefix = new StringBuilder();

        while (current.Children.Count == 1 && !current.IsEndOfWord)
        {
            var kvp = current.Children.First();
            prefix.Append(kvp.Key);
            current = kvp.Value;
        }

        return prefix.ToString();
    }

    // Count words with given prefix
    public static int CountWordsWithPrefix(Trie trie, string prefix)
    {
        return trie.GetWordsWithPrefix(prefix).Count;
    }
}
```

---

## Balanced Binary Search Trees

### AVL Trees (Self-Balancing BST)

*Invented by Soviet mathematicians Georgy Adelson-Velsky and Evgenii Landis in 1962. Named from their initials: AVL*

**Key properties:**
- Strictly balanced: height difference between left and right subtrees ≤ 1
- Guarantees O(log n) for search, insert, delete
- More strictly balanced than Red-Black trees (faster lookups, slower insertions)
- Uses rotations (single and double) to maintain balance
- **Trade-off:** Faster reads, slower writes compared to Red-Black trees
```csharp
public class AVLNode<T> where T : IComparable<T>
{
    public T Value { get; set; }
    public AVLNode<T> Left { get; set; }
    public AVLNode<T> Right { get; set; }
    public int Height { get; set; }

    public AVLNode(T value)
    {
        Value = value;
        Height = 1;
    }
}

public class AVLTree<T> where T : IComparable<T>
{
    private AVLNode<T> root;

    private int GetHeight(AVLNode<T> node)
    {
        return node?.Height ?? 0;
    }

    private int GetBalance(AVLNode<T> node)
    {
        return node == null ? 0 : GetHeight(node.Left) - GetHeight(node.Right);
    }

    private void UpdateHeight(AVLNode<T> node)
    {
        if (node != null)
        {
            node.Height = 1 + Math.Max(GetHeight(node.Left), GetHeight(node.Right));
        }
    }

    private AVLNode<T> RotateRight(AVLNode<T> y)
    {
        AVLNode<T> x = y.Left;
        AVLNode<T> T2 = x.Right;

        // Perform rotation
        x.Right = y;
        y.Left = T2;

        // Update heights
        UpdateHeight(y);
        UpdateHeight(x);

        return x;
    }

    private AVLNode<T> RotateLeft(AVLNode<T> x)
    {
        AVLNode<T> y = x.Right;
        AVLNode<T> T2 = y.Left;

        // Perform rotation
        y.Left = x;
        x.Right = T2;

        // Update heights
        UpdateHeight(x);
        UpdateHeight(y);

        return y;
    }

    public void Insert(T value)
    {
        root = InsertHelper(root, value);
    }

    private AVLNode<T> InsertHelper(AVLNode<T> node, T value)
    {
        // 1. Perform normal BST insertion
        if (node == null)
        {
            return new AVLNode<T>(value);
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
        else
        {
            return node; // Duplicate values not allowed
        }

        // 2. Update height of current node
        UpdateHeight(node);

        // 3. Get the balance factor
        int balance = GetBalance(node);

        // 4. If unbalanced, there are 4 cases

        // Left Left Case
        if (balance > 1 && value.CompareTo(node.Left.Value) < 0)
        {
            return RotateRight(node);
        }

        // Right Right Case
        if (balance < -1 && value.CompareTo(node.Right.Value) > 0)
        {
            return RotateLeft(node);
        }

        // Left Right Case
        if (balance > 1 && value.CompareTo(node.Left.Value) > 0)
        {
            node.Left = RotateLeft(node.Left);
            return RotateRight(node);
        }

        // Right Left Case
        if (balance < -1 && value.CompareTo(node.Right.Value) < 0)
        {
            node.Right = RotateRight(node.Right);
            return RotateLeft(node);
        }

        return node;
    }

    public bool Search(T value)
    {
        return SearchHelper(root, value);
    }

    private bool SearchHelper(AVLNode<T> node, T value)
    {
        if (node == null) return false;

        int comparison = value.CompareTo(node.Value);
        if (comparison == 0) return true;
        else if (comparison < 0) return SearchHelper(node.Left, value);
        else return SearchHelper(node.Right, value);
    }
}
```

---

## Segment Trees

### Basic Segment Tree (Range Sum Queries)
```csharp
public class SegmentTree
{
    private int[] tree;
    private int n;

    public SegmentTree(int[] arr)
    {
        n = arr.Length;
        tree = new int[4 * n];
        Build(arr, 0, 0, n - 1);
    }

    private void Build(int[] arr, int node, int start, int end)
    {
        if (start == end)
        {
            tree[node] = arr[start];
        }
        else
        {
            int mid = (start + end) / 2;
            Build(arr, 2 * node + 1, start, mid);
            Build(arr, 2 * node + 2, mid + 1, end);
            tree[node] = tree[2 * node + 1] + tree[2 * node + 2];
        }
    }

    public void Update(int index, int value)
    {
        UpdateHelper(0, 0, n - 1, index, value);
    }

    private void UpdateHelper(int node, int start, int end, int index, int value)
    {
        if (start == end)
        {
            tree[node] = value;
        }
        else
        {
            int mid = (start + end) / 2;
            if (index <= mid)
            {
                UpdateHelper(2 * node + 1, start, mid, index, value);
            }
            else
            {
                UpdateHelper(2 * node + 2, mid + 1, end, index, value);
            }
            tree[node] = tree[2 * node + 1] + tree[2 * node + 2];
        }
    }

    public int Query(int left, int right)
    {
        return QueryHelper(0, 0, n - 1, left, right);
    }

    private int QueryHelper(int node, int start, int end, int left, int right)
    {
        if (right < start || end < left)
        {
            return 0; // Out of range
        }

        if (left <= start && end <= right)
        {
            return tree[node]; // Segment completely inside range
        }

        int mid = (start + end) / 2;
        int leftSum = QueryHelper(2 * node + 1, start, mid, left, right);
        int rightSum = QueryHelper(2 * node + 2, mid + 1, end, left, right);

        return leftSum + rightSum;
    }
}
```

---

## Binary Indexed Tree (Fenwick Tree)

### BIT Implementation
```csharp
public class BinaryIndexedTree
{
    private int[] tree;
    private int n;

    public BinaryIndexedTree(int size)
    {
        n = size;
        tree = new int[n + 1];
    }

    public BinaryIndexedTree(int[] arr) : this(arr.Length)
    {
        for (int i = 0; i < arr.Length; i++)
        {
            Update(i, arr[i]);
        }
    }

    public void Update(int index, int delta)
    {
        index++; // BIT is 1-indexed
        while (index <= n)
        {
            tree[index] += delta;
            index += index & (-index); // Add last set bit
        }
    }

    public int Query(int index)
    {
        index++; // BIT is 1-indexed
        int sum = 0;
        while (index > 0)
        {
            sum += tree[index];
            index -= index & (-index); // Remove last set bit
        }
        return sum;
    }

    public int RangeQuery(int left, int right)
    {
        return Query(right) - (left > 0 ? Query(left - 1) : 0);
    }
}
```

---

## Tree Problems and Patterns

### Lowest Common Ancestor (LCA)
```csharp
public static class TreeLCA
{
    public static BinaryTreeNode<T> FindLCA<T>(BinaryTreeNode<T> root,
                                               BinaryTreeNode<T> p,
                                               BinaryTreeNode<T> q) where T : IEquatable<T>
    {
        if (root == null || root == p || root == q)
        {
            return root;
        }

        var left = FindLCA(root.Left, p, q);
        var right = FindLCA(root.Right, p, q);

        if (left != null && right != null)
        {
            return root; // Current node is LCA
        }

        return left ?? right;
    }

    // LCA in BST (more efficient)
    public static BinaryTreeNode<T> FindLCAInBST<T>(BinaryTreeNode<T> root,
                                                     T p, T q) where T : IComparable<T>
    {
        if (root == null) return null;

        // Both p and q are in left subtree
        if (p.CompareTo(root.Value) < 0 && q.CompareTo(root.Value) < 0)
        {
            return FindLCAInBST(root.Left, p, q);
        }

        // Both p and q are in right subtree
        if (p.CompareTo(root.Value) > 0 && q.CompareTo(root.Value) > 0)
        {
            return FindLCAInBST(root.Right, p, q);
        }

        // p and q are on different sides or one is the root
        return root;
    }
}
```

### Tree Diameter
```csharp
public static class TreeDiameter
{
    private static int maxDiameter = 0;

    public static int GetDiameter<T>(BinaryTreeNode<T> root)
    {
        maxDiameter = 0;
        GetHeight(root);
        return maxDiameter;
    }

    private static int GetHeight<T>(BinaryTreeNode<T> node)
    {
        if (node == null) return 0;

        int leftHeight = GetHeight(node.Left);
        int rightHeight = GetHeight(node.Right);

        // Update diameter if current path is longer
        maxDiameter = Math.Max(maxDiameter, leftHeight + rightHeight);

        return 1 + Math.Max(leftHeight, rightHeight);
    }
}
```

### Serialize and Deserialize Binary Tree
```csharp
public static class TreeSerialization
{
    public static string Serialize<T>(BinaryTreeNode<T> root)
    {
        var result = new List<string>();
        SerializeHelper(root, result);
        return string.Join(",", result);
    }

    private static void SerializeHelper<T>(BinaryTreeNode<T> node, List<string> result)
    {
        if (node == null)
        {
            result.Add("null");
            return;
        }

        result.Add(node.Value.ToString());
        SerializeHelper(node.Left, result);
        SerializeHelper(node.Right, result);
    }

    public static BinaryTreeNode<int> Deserialize(string data)
    {
        var queue = new Queue<string>(data.Split(','));
        return DeserializeHelper(queue);
    }

    private static BinaryTreeNode<int> DeserializeHelper(Queue<string> queue)
    {
        if (queue.Count == 0) return null;

        string val = queue.Dequeue();
        if (val == "null") return null;

        var node = new BinaryTreeNode<int>(int.Parse(val));
        node.Left = DeserializeHelper(queue);
        node.Right = DeserializeHelper(queue);

        return node;
    }
}
```

---

## Performance Comparison

| Structure | Search | Insert | Delete | Space | Best Use Case |
|-----------|--------|--------|--------|-------|---------------|
| **BST** | O(log n) avg, O(n) worst | O(log n) avg, O(n) worst | O(log n) avg, O(n) worst | O(n) | Simple ordered data |
| **AVL Tree** | O(log n) | O(log n) | O(log n) | O(n) | Frequent searches |
| **Trie** | O(m) | O(m) | O(m) | O(ALPHABET_SIZE × N × M) | String operations |
| **Segment Tree** | O(log n) range | O(log n) | O(log n) | O(4n) | Range queries |
| **BIT** | O(log n) | O(log n) | O(log n) | O(n) | Prefix sums, updates |

*m = string length, n = number of elements, N = number of strings, M = average string length*

---

## Advanced Applications

### Database Indexing
- **B-Trees:** Used in databases for efficient disk-based storage
- **B+ Trees:** Optimized for range queries and sequential access
- **Hash indices:** O(1) average lookup time

### Computational Geometry
- **KD-Trees:** Multi-dimensional search and nearest neighbor queries
- **Range Trees:** Multi-dimensional range queries
- **Quad Trees:** 2D spatial partitioning

### Game Development
- **Decision Trees:** AI behavior trees
- **Scene Graphs:** 3D rendering hierarchies
- **Spatial Trees:** Collision detection and culling

---

## When to Use Advanced Trees

**Tries:** String processing, autocomplete, IP routing, pattern matching

**Balanced Trees:** When you need guaranteed O(log n) operations and can't afford worst-case O(n)

**Segment Trees:** Range queries with updates (sum, min, max over ranges)

**Binary Indexed Trees:** Prefix sum queries with frequent updates

**Avoid advanced trees when:**
- Built-in collections (`SortedDictionary`, `List`) meet performance needs
- Implementation complexity outweighs benefits
- Memory usage is a critical constraint

---

## Quick Reference

### Advanced Tree Comparison
| Structure | Best For | Time (Insert/Search) | Space |
|-----------|----------|---------------------|-------|
| **Trie** | String prefix operations | O(m) where m = key length | O(ALPHABET_SIZE × n × m) |
| **Segment Tree** | Range queries, updates | O(log n) | O(4n) |
| **Fenwick Tree** | Range sum queries | O(log n) | O(n) |

### When to Use
- **Trie:** Autocomplete, spell check, IP routing, dictionary operations
- **Segment Tree:** Range min/max/sum with updates
- **Fenwick (BIT):** Simple range sums, frequency queries

### C# Patterns
```csharp
// Trie for autocomplete
var trie = new Trie();
trie.Insert("apple");
trie.GetWordsWithPrefix("app");  // ["apple", "application", ...]

// Use SortedDictionary for most needs
var sorted = new SortedDictionary<string, int>();
```

---