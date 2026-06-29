---
title: "Trees & Binary Search Trees"
category: Data Structures & Algorithms
description: "Comprehensive guide to binary search trees covering implementation, traversal algorithms, search operations, and understanding when to use tree structures."
tags: [data-structures, algorithms, trees, practical, interview-prep]
---

## Why Trees Exist
Hierarchical relationships are everywhere: file systems, decision making, organizing data for fast searches, and representing mathematical expressions. Trees provide a natural way to model and efficiently traverse these relationships.

---

## General Trees

### When to Use Trees

**Use when:**
- Data has natural hierarchy (organizational charts, file systems)
- Need efficient searching with dynamic insertions/deletions
- Representing decision trees or game states
- Parsing expressions or syntax trees

**Don't use when:**
- Data is flat with no relationships
- Simple sequential access is all that's needed
- Memory fragmentation is a major concern

**Modern reality:** Most databases use B-trees internally. You'll implement binary trees in interviews but rarely build custom tree structures in production.

### Basic Tree Implementation
```csharp
public class TreeNode<T>
{
    public T Value { get; set; }
    public List<TreeNode<T>> Children { get; set; }
    
    public TreeNode(T value)
    {
        Value = value;
        Children = new List<TreeNode<T>>();
    }
    
    public void AddChild(TreeNode<T> childNode)
    {
        Console.WriteLine($"Adding {childNode.Value} as child of {Value}");
        Children.Add(childNode);
    }
    
    public void RemoveChild(TreeNode<T> childNode)
    {
        Console.WriteLine($"Removing {childNode.Value} from {Value}");
        Children.RemoveAll(child => ReferenceEquals(child, childNode));
    }
    
    public void TraverseDepthFirst()
    {
        Console.WriteLine(Value);
        foreach (var child in Children)
        {
            child.TraverseDepthFirst();
        }
    }
    
    public void TraverseBreadthFirst()
    {
        var queue = new Queue<TreeNode<T>>();
        queue.Enqueue(this);
        
        while (queue.Count > 0)
        {
            var currentNode = queue.Dequeue();
            Console.WriteLine(currentNode.Value);
            
            foreach (var child in currentNode.Children)
            {
                queue.Enqueue(child);
            }
        }
    }
    
    public TreeNode<T> FindNode(T targetValue)
    {
        if (EqualityComparer<T>.Default.Equals(Value, targetValue))
        {
            return this;
        }
        
        foreach (var child in Children)
        {
            var result = child.FindNode(targetValue);
            if (result != null)
            {
                return result;
            }
        }
        
        return null;
    }
}

// Example usage
var root = new TreeNode<string>("CEO");
var vpEngineering = new TreeNode<string>("VP Engineering");
var vpMarketing = new TreeNode<string>("VP Marketing");

root.AddChild(vpEngineering);
root.AddChild(vpMarketing);

var engineer1 = new TreeNode<string>("Senior Engineer");
var engineer2 = new TreeNode<string>("Junior Engineer");
vpEngineering.AddChild(engineer1);
vpEngineering.AddChild(engineer2);

Console.WriteLine("Depth-first traversal:");
root.TraverseDepthFirst();

Console.WriteLine("\nBreadth-first traversal:");
root.TraverseBreadthFirst();
```

---

## Binary Search Trees (BST)

### When to Use Binary Search Trees

**Use when:**
- Need sorted data with fast insertion/deletion/search
- Want to iterate through data in sorted order
- Building other data structures (heaps, balanced trees)
- Educational purposes or interviews

**Don't use when:**
- Data doesn't have a natural ordering
- Need guaranteed balanced performance (use AVL or Red-Black trees)
- Simple array operations are sufficient

**Modern reality:** Use balanced variants (AVL, Red-Black) or language built-ins like C#'s `SortedDictionary`. Implement BSTs in interviews to show understanding.

### Time Complexity
- **Average case:** O(log n) for all operations
- **Worst case:** O(n) when tree becomes skewed (effectively a linked list)
- **Space complexity:** O(n)

### Binary Search Tree Properties
1. Left subtree contains only nodes with values less than parent
2. Right subtree contains only nodes with values greater than parent
3. Both left and right subtrees are also BSTs
4. No duplicate values (typically)

### C# Implementation
```csharp
public class BinarySearchTree<T> where T : IComparable<T>
{
    public T Value { get; set; }
    public int Depth { get; set; }
    public BinarySearchTree<T> Left { get; set; }
    public BinarySearchTree<T> Right { get; set; }
    
    public BinarySearchTree(T value, int depth = 1)
    {
        Value = value;
        Depth = depth;
        Left = null;
        Right = null;
    }
    
    public void Insert(T value)
    {
        int comparison = value.CompareTo(Value);
        
        if (comparison < 0)
        {
            if (Left == null)
            {
                Left = new BinarySearchTree<T>(value, Depth + 1);
                Console.WriteLine($"Inserted {value} to the left of {Value} at depth {Depth + 1}");
            }
            else
            {
                Left.Insert(value);
            }
        }
        else if (comparison > 0)
        {
            if (Right == null)
            {
                Right = new BinarySearchTree<T>(value, Depth + 1);
                Console.WriteLine($"Inserted {value} to the right of {Value} at depth {Depth + 1}");
            }
            else
            {
                Right.Insert(value);
            }
        }
        else
        {
            Console.WriteLine($"Value {value} already exists in the tree");
        }
    }
    
    public BinarySearchTree<T> Search(T value)
    {
        int comparison = value.CompareTo(Value);
        
        if (comparison == 0)
        {
            return this;
        }
        else if (comparison < 0 && Left != null)
        {
            return Left.Search(value);
        }
        else if (comparison > 0 && Right != null)
        {
            return Right.Search(value);
        }
        else
        {
            return null;
        }
    }
    
    public List<T> InorderTraversal()
    {
        var result = new List<T>();
        
        if (Left != null)
            result.AddRange(Left.InorderTraversal());
        
        result.Add(Value);
        
        if (Right != null)
            result.AddRange(Right.InorderTraversal());
        
        return result;
    }
    
    public List<T> PreorderTraversal()
    {
        var result = new List<T> { Value };
        
        if (Left != null)
            result.AddRange(Left.PreorderTraversal());
        
        if (Right != null)
            result.AddRange(Right.PreorderTraversal());
        
        return result;
    }
    
    public List<T> PostorderTraversal()
    {
        var result = new List<T>();
        
        if (Left != null)
            result.AddRange(Left.PostorderTraversal());
        
        if (Right != null)
            result.AddRange(Right.PostorderTraversal());
        
        result.Add(Value);
        
        return result;
    }
    
    public T FindMin()
    {
        if (Left == null)
            return Value;
        return Left.FindMin();
    }
    
    public T FindMax()
    {
        if (Right == null)
            return Value;
        return Right.FindMax();
    }
    
    public BinarySearchTree<T> Delete(T value)
    {
        int comparison = value.CompareTo(Value);
        
        if (comparison < 0)
        {
            if (Left != null)
                Left = Left.Delete(value);
        }
        else if (comparison > 0)
        {
            if (Right != null)
                Right = Right.Delete(value);
        }
        else  // Found the node to delete
        {
            // Case 1: No children (leaf node)
            if (Left == null && Right == null)
                return null;
            
            // Case 2: One child
            if (Left == null)
                return Right;
            if (Right == null)
                return Left;
            
            // Case 3: Two children
            // Replace with inorder successor
            T minRight = Right.FindMin();
            Value = minRight;
            Right = Right.Delete(minRight);
        }
        
        return this;
    }
}

// Example usage
Console.WriteLine("Creating BST with root value 15:");
var bst = new BinarySearchTree<int>(15);

// Insert values
int[] values = {10, 20, 8, 12, 25, 6, 11, 13, 27};
foreach (var value in values)
{
    bst.Insert(value);
}

Console.WriteLine($"\nIn-order traversal (sorted): [{string.Join(", ", bst.InorderTraversal())}]");
Console.WriteLine($"Pre-order traversal: [{string.Join(", ", bst.PreorderTraversal())}]");
Console.WriteLine($"Post-order traversal: [{string.Join(", ", bst.PostorderTraversal())}]");

Console.WriteLine($"\nMin value: {bst.FindMin()}");
Console.WriteLine($"Max value: {bst.FindMax()}");

// Search for values
int[] searchValues = {12, 99, 25};
foreach (var value in searchValues)
{
    var result = bst.Search(value);
    Console.WriteLine($"Search for {value}: {(result != null ? "Found" : "Not found")}");
}
```

## Tree Traversal Methods

### When to Use Each Traversal

**In-order (Left → Root → Right):**
- **Use for:** Getting sorted output from BST, expression evaluation
- **BST property:** Always produces sorted sequence

**Pre-order (Root → Left → Right):**
- **Use for:** Copying tree structure, prefix notation, serialization
- **Pattern:** Process node before children

**Post-order (Left → Right → Root):**
- **Use for:** Deleting tree, calculating directory sizes, postfix notation
- **Pattern:** Process children before node

**Level-order (Breadth-first):**
- **Use for:** Level-by-level processing, finding shortest path in tree
- **Implementation:** Uses queue for traversal

### Level-Order Traversal Implementation
```csharp
public static List<List<T>> LevelOrderTraversal<T>(BinarySearchTree<T> root) where T : IComparable<T>
{
    if (root == null)
        return new List<List<T>>();
    
    var result = new List<List<T>>();
    var queue = new Queue<BinarySearchTree<T>>();
    queue.Enqueue(root);
    
    while (queue.Count > 0)
    {
        int levelSize = queue.Count;
        var currentLevel = new List<T>();
        
        for (int i = 0; i < levelSize; i++)
        {
            var node = queue.Dequeue();
            currentLevel.Add(node.Value);
            
            if (node.Left != null)
                queue.Enqueue(node.Left);
            if (node.Right != null)
                queue.Enqueue(node.Right);
        }
        
        result.Add(currentLevel);
    }
    
    return result;
}

// Example with BST
var bst = new BinarySearchTree<int>(15);
int[] values = {10, 20, 8, 12, 25, 6};
foreach (var val in values)
{
    bst.Insert(val);
}

var levels = LevelOrderTraversal(bst);
Console.WriteLine("Level-order traversal:");
for (int i = 0; i < levels.Count; i++)
{
    Console.WriteLine($"Level {i}: [{string.Join(", ", levels[i])}]");
}
```

## Common Interview Problems

### 1. Validate Binary Search Tree
```csharp
public static bool IsValidBST<T>(BinarySearchTree<T> node, T minVal = default(T), T maxVal = default(T))
    where T : IComparable<T>
{
    if (node == null)
        return true;

    // Handle default values for min/max
    bool hasMinConstraint = !EqualityComparer<T>.Default.Equals(minVal, default(T));
    bool hasMaxConstraint = !EqualityComparer<T>.Default.Equals(maxVal, default(T));

    if (hasMinConstraint && node.Value.CompareTo(minVal) <= 0)
        return false;

    if (hasMaxConstraint && node.Value.CompareTo(maxVal) >= 0)
        return false;

    return IsValidBST(node.Left, minVal, node.Value) &&
           IsValidBST(node.Right, node.Value, maxVal);
}

// Alternative implementation using nullable for numeric types
public static bool IsValidBST(BinarySearchTree<int> node, int? minVal = null, int? maxVal = null)
{
    if (node == null)
        return true;

    if (minVal.HasValue && node.Value <= minVal.Value)
        return false;

    if (maxVal.HasValue && node.Value >= maxVal.Value)
        return false;

    return IsValidBST(node.Left, minVal, node.Value) &&
           IsValidBST(node.Right, node.Value, maxVal);
}
```

### 2. Find Lowest Common Ancestor
```csharp
public static BinarySearchTree<T> FindLCA<T>(BinarySearchTree<T> root, T p, T q)
    where T : IComparable<T>
{
    if (root == null)
        return null;

    // Both nodes are in left subtree
    if (p.CompareTo(root.Value) < 0 && q.CompareTo(root.Value) < 0)
        return FindLCA(root.Left, p, q);

    // Both nodes are in right subtree
    if (p.CompareTo(root.Value) > 0 && q.CompareTo(root.Value) > 0)
        return FindLCA(root.Right, p, q);

    // Nodes are on different sides (or one is root)
    return root;
}
```

### 3. Convert Sorted Array to BST
```csharp
public static BinarySearchTree<T> SortedArrayToBST<T>(T[] nums) where T : IComparable<T>
{
    return SortedArrayToBSTHelper(nums, 0, nums.Length - 1);
}

private static BinarySearchTree<T> SortedArrayToBSTHelper<T>(T[] nums, int start, int end)
    where T : IComparable<T>
{
    if (start > end)
        return null;

    int mid = start + (end - start) / 2;
    var root = new BinarySearchTree<T>(nums[mid]);

    root.Left = SortedArrayToBSTHelper(nums, start, mid - 1);
    root.Right = SortedArrayToBSTHelper(nums, mid + 1, end);

    return root;
}
```

## Balanced Tree Concepts

### Why Balancing Matters
Unbalanced BSTs can degrade to O(n) operations. Balanced trees guarantee O(log n).

**Self-balancing tree types:**
- **AVL Trees:** Strictly balanced, height difference ≤ 1
- **Red-Black Trees:** Looser balance constraints, used in many libraries
- **B-Trees:** Multi-way trees, used in databases

### When Tree Becomes Skewed
```csharp
// This creates a skewed tree (effectively a linked list)
var skewedBST = new BinarySearchTree<int>(1);
for (int i = 2; i < 8; i++)
{
    skewedBST.Insert(i);  // Always goes right
}

// Height = n, operations become O(n)
var result = skewedBST.InorderTraversal();
Console.WriteLine($"[{string.Join(", ", result)}]");  // [1, 2, 3, 4, 5, 6, 7]
```

## Tries (Prefix Trees)

### Why Tries Exist
Efficiently store and search strings with shared prefixes. Tries provide fast prefix-based operations and are essential for autocomplete, spell checkers, and IP routing tables where prefix matching is crucial.

### When to Use Tries

**Use when:**
- Need fast prefix-based searches
- Implementing autocomplete or spell check
- Storing dictionaries with prefix queries
- IP routing or URL routing systems
- Need to find all words with a given prefix

**Don't use when:**
- Only need exact string matching (use hash table)
- Memory usage is critical (tries can be space-intensive)
- Working with non-string data
- Simple substring search is sufficient

### Time Complexity
- **Insert:** O(m) where m is key length
- **Search:** O(m) where m is key length
- **Delete:** O(m) where m is key length
- **Prefix search:** O(p + k) where p is prefix length, k is number of results
- **Space:** O(ALPHABET_SIZE × N × M) in worst case

### Trie Implementation

```csharp
public class TrieNode
{
    public Dictionary<char, TrieNode> Children { get; set; }
    public bool IsEndOfWord { get; set; }
    public string Word { get; set; }  // Optional: store the actual word

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

        foreach (char c in word)
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
        TrieNode node = SearchNode(word);
        return node != null && node.IsEndOfWord;
    }

    public bool StartsWith(string prefix)
    {
        return SearchNode(prefix) != null;
    }

    private TrieNode SearchNode(string prefix)
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

    public List<string> GetWordsWithPrefix(string prefix)
    {
        var result = new List<string>();
        TrieNode prefixNode = SearchNode(prefix);

        if (prefixNode != null)
        {
            DfsCollectWords(prefixNode, result);
        }

        return result;
    }

    private void DfsCollectWords(TrieNode node, List<string> result)
    {
        if (node.IsEndOfWord)
        {
            result.Add(node.Word);
        }

        foreach (var child in node.Children.Values)
        {
            DfsCollectWords(child, result);
        }
    }

    public bool Delete(string word)
    {
        return DeleteHelper(root, word, 0);
    }

    private bool DeleteHelper(TrieNode current, string word, int index)
    {
        if (index == word.Length)
        {
            // We've reached the end of the word
            if (!current.IsEndOfWord)
            {
                return false; // Word doesn't exist
            }

            current.IsEndOfWord = false;
            current.Word = null;

            // If current has no children, it can be deleted
            return current.Children.Count == 0;
        }

        char c = word[index];
        if (!current.Children.ContainsKey(c))
        {
            return false; // Word doesn't exist
        }

        TrieNode node = current.Children[c];
        bool shouldDeleteChild = DeleteHelper(node, word, index + 1);

        if (shouldDeleteChild)
        {
            current.Children.Remove(c);
            // Return true if current has no children and is not end of another word
            return current.Children.Count == 0 && !current.IsEndOfWord;
        }

        return false;
    }
}

// Example usage
var trie = new Trie();

// Insert words
string[] words = {"cat", "cats", "dog", "doggy", "dogs", "dodge", "car", "card"};
foreach (string word in words)
{
    trie.Insert(word);
}

// Search operations
Console.WriteLine(trie.Search("cat"));      // True
Console.WriteLine(trie.Search("car"));      // True
Console.WriteLine(trie.Search("care"));     // False

// Prefix operations
Console.WriteLine(trie.StartsWith("do"));   // True
Console.WriteLine(trie.StartsWith("bat"));  // False

// Get all words with prefix
var wordsWithDog = trie.GetWordsWithPrefix("dog");
Console.WriteLine($"Words starting with 'dog': [{string.Join(", ", wordsWithDog)}]");
// Output: [dog, doggy, dogs]
```

### Autocomplete Implementation

```csharp
public class AutoComplete
{
    private Trie trie;

    public AutoComplete()
    {
        trie = new Trie();
    }

    public void AddWord(string word)
    {
        trie.Insert(word.ToLower());
    }

    public List<string> GetSuggestions(string prefix, int maxSuggestions = 10)
    {
        var suggestions = trie.GetWordsWithPrefix(prefix.ToLower());
        return suggestions.Take(maxSuggestions).ToList();
    }

    // Example usage for building autocomplete
    public static void DemonstrateAutocomplete()
    {
        var autocomplete = new AutoComplete();

        // Add vocabulary
        string[] dictionary = {
            "apple", "application", "apply", "approach", "appropriate",
            "banana", "band", "bandana", "bank", "banner",
            "car", "card", "care", "career", "careful"
        };

        foreach (string word in dictionary)
        {
            autocomplete.AddWord(word);
        }

        // Get suggestions
        Console.WriteLine("Autocomplete for 'app':");
        var suggestions = autocomplete.GetSuggestions("app", 5);
        foreach (string suggestion in suggestions)
        {
            Console.WriteLine($"  {suggestion}");
        }
        // Output: apple, application, apply, approach, appropriate
    }
}
```

---

## Quick Reference

### BST Operations Complexity
| Operation | Average | Worst Case | Balanced |
|-----------|---------|------------|----------|
| Search | O(log n) | O(n) | O(log n) |
| Insert | O(log n) | O(n) | O(log n) |
| Delete | O(log n) | O(n) | O(log n) |
| Min/Max | O(log n) | O(n) | O(log n) |

### Key Properties
- **In-order traversal** of BST gives sorted order
- **Worst case** O(n) occurs when tree becomes skewed (like a linked list)
- **Balanced BST** (AVL, Red-Black) guarantees O(log n)

### C# Built-ins
- `SortedDictionary<K,V>` - Red-Black tree implementation
- `SortedSet<T>` - Balanced tree set
- Use these in production unless specific requirements demand custom implementation

---