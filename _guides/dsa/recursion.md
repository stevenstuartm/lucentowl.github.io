---
title: "Recursion"
category: Data Structures & Algorithms
description: "Master recursive thinking with base cases, recursive cases, common patterns, memoization techniques, and converting between recursive and iterative solutions."
tags: [algorithms, recursion, fundamentals, problem-solving, interview-prep]
---

## Why Recursion Exists
Some problems are naturally self-similar, such as tree traversal, mathematical sequences, and divide-and-conquer algorithms. Recursion provides an elegant way to express solutions that work on progressively smaller versions of the same problem.

## When to Use Recursion

**Use when:**
- Problem has self-similar subproblems
- Working with recursive data structures (trees, graphs)
- Divide-and-conquer algorithms
- Backtracking problems (N-queens, sudoku)
- Mathematical sequences and calculations
- Parsing nested structures

**Don't use when:**
- Simple iteration suffices
- Stack space is limited (embedded systems)
- Performance is critical and iterative solution exists
- Deep recursion might cause stack overflow

**Modern reality:** Essential for interviews and certain algorithms, but iterative solutions are often preferred in production for performance and stack safety.

---

## Essential Recursion Components

<div class="callout callout--warning">
<p class="callout__title">Critical: The Base Case</p>
<p>The base case stops recursion. Without it, you get infinite recursion and stack overflow. Every recursive function must have at least one base case that doesn't call itself.</p>
</div>

### 1. Base Case
The condition that stops recursion. Without it, you get infinite recursion and stack overflow.

### 2. Recursive Case
The function calls itself with a modified (usually smaller) input that moves toward the base case.

### 3. Progress Toward Base Case
Each recursive call must get "closer" to the base case to ensure termination.

---

## Classic Examples

### Factorial
```csharp
public static int Factorial(int n)
{
    // Base case
    if (n <= 1)
        return 1;

    // Recursive case: n! = n * (n-1)!
    return n * Factorial(n - 1);
}

// Example usage
Console.WriteLine(Factorial(5)); // 120
Console.WriteLine(Factorial(0)); // 1
```

### Fibonacci Sequence
```csharp
// Naive recursive fibonacci - exponential time complexity
public static long FibonacciNaive(int n)
{
    if (n <= 1)
        return n;

    return FibonacciNaive(n - 1) + FibonacciNaive(n - 2);
}

// This is inefficient for large n due to repeated calculations
Console.WriteLine(FibonacciNaive(10)); // 55, but slow for n > 30
```

### Optimized Fibonacci with Memoization
```csharp
public static class Fibonacci
{
    private static Dictionary<int, long> memo = new Dictionary<int, long>();

    public static long FibonacciMemo(int n)
    {
        if (memo.ContainsKey(n))
            return memo[n];

        if (n <= 1)
            return n;

        memo[n] = FibonacciMemo(n - 1) + FibonacciMemo(n - 2);
        return memo[n];
    }

    // Alternative with explicit memo parameter
    public static long FibonacciMemoExplicit(int n, Dictionary<int, long> memo = null)
    {
        if (memo == null)
            memo = new Dictionary<int, long>();

        if (memo.ContainsKey(n))
            return memo[n];

        if (n <= 1)
            return n;

        memo[n] = FibonacciMemoExplicit(n - 1, memo) + FibonacciMemoExplicit(n - 2, memo);
        return memo[n];
    }
}

// Much faster for large n
Console.WriteLine(Fibonacci.FibonacciMemo(50)); // 12586269025
```

---

## Tree Recursion

### Tree Traversal
```csharp
public class TreeNode<T>
{
    public T Value { get; set; }
    public TreeNode<T> Left { get; set; }
    public TreeNode<T> Right { get; set; }

    public TreeNode(T value)
    {
        Value = value;
        Left = null;
        Right = null;
    }
}

public static class TreeRecursion
{
    // In-order: left -> root -> right
    public static List<T> InorderTraversal<T>(TreeNode<T> node)
    {
        if (node == null)
            return new List<T>();

        var result = new List<T>();
        result.AddRange(InorderTraversal(node.Left));  // Left subtree
        result.Add(node.Value);                        // Root
        result.AddRange(InorderTraversal(node.Right)); // Right subtree

        return result;
    }

    // Calculate height of tree
    public static int TreeHeight<T>(TreeNode<T> node)
    {
        if (node == null)
            return 0;

        int leftHeight = TreeHeight(node.Left);
        int rightHeight = TreeHeight(node.Right);

        return 1 + Math.Max(leftHeight, rightHeight);
    }

    // Sum all values in tree
    public static int TreeSum(TreeNode<int> node)
    {
        if (node == null)
            return 0;

        return node.Value + TreeSum(node.Left) + TreeSum(node.Right);
    }
}

// Example usage
var root = new TreeNode<int>(1);
root.Left = new TreeNode<int>(2);
root.Right = new TreeNode<int>(3);
root.Left.Left = new TreeNode<int>(4);
root.Left.Right = new TreeNode<int>(5);

var inorder = TreeRecursion.InorderTraversal(root);
Console.WriteLine($"Inorder: [{string.Join(", ", inorder)}]"); // [4, 2, 5, 1, 3]
Console.WriteLine($"Height: {TreeRecursion.TreeHeight(root)}"); // 3
Console.WriteLine($"Sum: {TreeRecursion.TreeSum(root)}");       // 15
```

---

## Backtracking with Recursion

### N-Queens Problem
```csharp
public static class NQueens
{
    public static List<List<int>> SolveNQueens(int n)
    {
        bool IsSafe(int[] board, int row, int col)
        {
            // Check column
            for (int i = 0; i < row; i++)
            {
                if (board[i] == col)
                    return false;
            }

            // Check diagonals
            for (int i = 0; i < row; i++)
            {
                if (Math.Abs(board[i] - col) == Math.Abs(i - row))
                    return false;
            }

            return true;
        }

        List<List<int>> Backtrack(int[] board, int row)
        {
            if (row == n)
            {
                return new List<List<int>> { new List<int>(board) }; // Found solution
            }

            var solutions = new List<List<int>>();
            for (int col = 0; col < n; col++)
            {
                if (IsSafe(board, row, col))
                {
                    board[row] = col;                     // Place queen
                    solutions.AddRange(Backtrack(board, row + 1)); // Recurse
                    // No need to remove queen - we overwrite board[row] in next iteration
                }
            }

            return solutions;
        }

        var board = new int[n]; // board[i] = column position of queen in row i
        for (int i = 0; i < n; i++)
            board[i] = -1;

        return Backtrack(board, 0);
    }
}

// Example usage
var solutions = NQueens.SolveNQueens(4);
Console.WriteLine($"Found {solutions.Count} solutions for 4-Queens");
for (int i = 0; i < solutions.Count; i++)
{
    Console.WriteLine($"Solution {i + 1}: [{string.Join(", ", solutions[i])}]");
}
```

### Generate All Subsets
```csharp
public static class Backtracking
{
    // Generate all possible subsets using recursion
    public static List<List<int>> GenerateSubsets(int[] nums)
    {
        var result = new List<List<int>>();

        void Backtrack(int start, List<int> currentSubset)
        {
            // Add current subset to results
            result.Add(new List<int>(currentSubset)); // Make a copy

            // Try adding each remaining element
            for (int i = start; i < nums.Length; i++)
            {
                currentSubset.Add(nums[i]);         // Choose
                Backtrack(i + 1, currentSubset);   // Explore
                currentSubset.RemoveAt(currentSubset.Count - 1); // Unchoose (backtrack)
            }
        }

        Backtrack(0, new List<int>());
        return result;
    }
}

// Example usage
int[] nums = {1, 2, 3};
var subsets = Backtracking.GenerateSubsets(nums);
Console.WriteLine("All subsets:");
foreach (var subset in subsets)
{
    Console.WriteLine($"[{string.Join(", ", subset)}]");
}
// Output: [], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]
```

---

## Divide and Conquer

### Merge Sort (Recursive)
```csharp
public static class MergeSort
{
    // Recursive merge sort implementation
    public static int[] MergeSortArray(int[] arr)
    {
        // Base case
        if (arr.Length <= 1)
            return arr;

        // Divide
        int mid = arr.Length / 2;
        int[] left = new int[mid];
        int[] right = new int[arr.Length - mid];

        Array.Copy(arr, 0, left, 0, mid);
        Array.Copy(arr, mid, right, 0, arr.Length - mid);

        left = MergeSortArray(left);
        right = MergeSortArray(right);

        // Conquer (merge)
        return Merge(left, right);
    }

    // Merge two sorted arrays
    private static int[] Merge(int[] left, int[] right)
    {
        var result = new List<int>();
        int i = 0, j = 0;

        while (i < left.Length && j < right.Length)
        {
            if (left[i] <= right[j])
            {
                result.Add(left[i]);
                i++;
            }
            else
            {
                result.Add(right[j]);
                j++;
            }
        }

        // Add remaining elements
        while (i < left.Length)
        {
            result.Add(left[i]);
            i++;
        }

        while (j < right.Length)
        {
            result.Add(right[j]);
            j++;
        }

        return result.ToArray();
    }
}

// Example usage
int[] arr = {64, 34, 25, 12, 22, 11, 90};
int[] sortedArr = MergeSort.MergeSortArray(arr);
Console.WriteLine($"Original: [{string.Join(", ", arr)}]");
Console.WriteLine($"Sorted: [{string.Join(", ", sortedArr)}]");
```

### Binary Search (Recursive)
```csharp
public static class BinarySearch
{
    // Recursive binary search
    public static int BinarySearchRecursive(int[] arr, int target, int left = 0, int right = -1)
    {
        if (right == -1)
            right = arr.Length - 1;

        // Base case: not found
        if (left > right)
            return -1;

        int mid = (left + right) / 2;

        if (arr[mid] == target)
            return mid;
        else if (arr[mid] > target)
            return BinarySearchRecursive(arr, target, left, mid - 1);
        else
            return BinarySearchRecursive(arr, target, mid + 1, right);
    }
}

// Example usage
int[] sortedArr = {1, 3, 5, 7, 9, 11, 13, 15};
int index = BinarySearch.BinarySearchRecursive(sortedArr, 7);
Console.WriteLine($"Found 7 at index: {index}"); // Found 7 at index: 3
```

---

## Recursion vs Iteration

### When to Choose Each

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Recursion is Better When</h4>
<ul>
<li>Problem naturally recursive (trees, fractals)</li>
<li>Code is much cleaner and easier to understand</li>
<li>Stack depth is reasonable</li>
<li>Performance is not critical</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Iteration is Better When</h4>
<ul>
<li>Simple loops suffice</li>
<li>Memory is limited</li>
<li>Performance is critical</li>
<li>Stack overflow is a concern</li>
</ul>
</div>
</div>

### Converting Recursion to Iteration

#### Tail Recursion → Loop
```csharp
// Tail recursive (easy to convert)
public static int FactorialTailRecursive(int n, int acc = 1)
{
    if (n <= 1)
        return acc;
    return FactorialTailRecursive(n - 1, n * acc);
}

// Iterative equivalent
public static int FactorialIterative(int n)
{
    int acc = 1;
    while (n > 1)
    {
        acc *= n;
        n--;
    }
    return acc;
}
```

#### General Recursion → Stack
```csharp
// Recursive tree traversal
public static List<T> InorderRecursive<T>(TreeNode<T> node)
{
    if (node == null)
        return new List<T>();

    var result = new List<T>();
    result.AddRange(InorderRecursive(node.Left));
    result.Add(node.Value);
    result.AddRange(InorderRecursive(node.Right));
    return result;
}

// Iterative using explicit stack
public static List<T> InorderIterative<T>(TreeNode<T> root)
{
    var stack = new Stack<TreeNode<T>>();
    var result = new List<T>();
    var current = root;

    while (stack.Count > 0 || current != null)
    {
        // Go to leftmost node
        while (current != null)
        {
            stack.Push(current);
            current = current.Left;
        }

        // Process current node
        current = stack.Pop();
        result.Add(current.Value);

        // Move to right subtree
        current = current.Right;
    }

    return result;
}
```

---

## Common Recursion Patterns

### 1. Linear Recursion
Each function calls itself at most once.
```csharp
public static int SumArray(int[] arr, int index = 0)
{
    if (index >= arr.Length)
        return 0;
    return arr[index] + SumArray(arr, index + 1);
}
```

### 2. Tree Recursion
Function calls itself multiple times.
```csharp
public static int Fibonacci(int n)
{
    if (n <= 1)
        return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2); // Two recursive calls
}
```

### 3. Tail Recursion
Recursive call is the last operation.
```csharp
public static int GCD(int a, int b)
{
    if (b == 0)
        return a;
    return GCD(b, a % b); // Last operation is recursive call
}
```

### 4. Mutual Recursion
Functions call each other.
```csharp
public static bool IsEven(int n)
{
    if (n == 0)
        return true;
    return IsOdd(n - 1);
}

public static bool IsOdd(int n)
{
    if (n == 0)
        return false;
    return IsEven(n - 1);
}
```

---

## Recursion Debugging Tips

### 1. Print Trace
```csharp
public static int FactorialDebug(int n, int depth = 0)
{
    string indent = new string(' ', depth * 2);
    Console.WriteLine($"{indent}factorial({n})");

    if (n <= 1)
    {
        Console.WriteLine($"{indent}-> returning 1");
        return 1;
    }

    int result = n * FactorialDebug(n - 1, depth + 1);
    Console.WriteLine($"{indent}-> returning {result}");
    return result;
}

FactorialDebug(4);
```

### 2. Visualize Call Stack
```csharp
public static int FibonacciTrace(int n, List<string> callStack = null)
{
    if (callStack == null)
        callStack = new List<string>();

    callStack.Add($"fib({n})");
    Console.WriteLine(string.Join(" -> ", callStack));

    int result;
    if (n <= 1)
    {
        result = n;
    }
    else
    {
        int left = FibonacciTrace(n - 1, new List<string>(callStack));
        int right = FibonacciTrace(n - 2, new List<string>(callStack));
        result = left + right;
    }

    callStack.RemoveAt(callStack.Count - 1);
    return result;
}
```

### 3. Count Function Calls
```csharp
public class CallCounter
{
    public int Calls { get; set; } = 0;
}

public static int FibonacciWithCounter(int n, CallCounter counter)
{
    counter.Calls++;

    if (n <= 1)
        return n;

    return FibonacciWithCounter(n - 1, counter) +
           FibonacciWithCounter(n - 2, counter);
}

// Usage
var counter = new CallCounter();
int result = FibonacciWithCounter(10, counter);
Console.WriteLine($"Result: {result}, Function calls: {counter.Calls}");
```

---

## Interview Problems

### 1. Power Calculation
```csharp
// Calculate base^exp using recursion
public static long Power(int baseNum, int exp)
{
    if (exp == 0)
        return 1;
    if (exp == 1)
        return baseNum;

    // Optimize by using exp/2
    long halfPower = Power(baseNum, exp / 2);
    if (exp % 2 == 0)
        return halfPower * halfPower;
    else
        return baseNum * halfPower * halfPower;
}

Console.WriteLine(Power(2, 10)); // 1024
```

### 2. Reverse String
```csharp
// Reverse string using recursion
public static string ReverseString(string s)
{
    if (s.Length <= 1)
        return s;

    return ReverseString(s.Substring(1)) + s[0];
}

Console.WriteLine(ReverseString("hello")); // "olleh"
```

### 3. Palindrome Check
```csharp
// Check if string is palindrome using recursion
public static bool IsPalindrome(string s, int left = 0, int right = -1)
{
    if (right == -1)
        right = s.Length - 1;

    if (left >= right)
        return true;

    if (s[left] != s[right])
        return false;

    return IsPalindrome(s, left + 1, right - 1);
}

Console.WriteLine(IsPalindrome("racecar")); // True
Console.WriteLine(IsPalindrome("hello"));   // False
```

## Performance Considerations

## Quick Reference

### Recursion Checklist
✓ **Base case**: When to stop
✓ **Progress**: Move toward base case
✓ **Recursive call**: Solve smaller problem
✓ **Combine**: Use subproblem results

### Time Complexity Patterns
| Pattern | Complexity | Example |
|---------|------------|---------|
| Single recursive call | O(n) | Factorial, sum |
| Two calls (binary) | O(2ⁿ) | Fibonacci (naive) |
| Divide & conquer | O(n log n) | Merge sort |
| With memoization | O(n) often | Fibonacci (cached) |

### Space Complexity
- **Recursion depth:** O(d) stack space
- **Each call:** Variables stored on stack
- **Risk:** Stack overflow with deep recursion

### When to Use Recursion
✓ Tree/graph traversals
✓ Divide and conquer
✓ Backtracking
✓ Mathematical sequences

### When to Avoid
✗ Simple loops suffice
✗ Deep recursion (use iteration)
✗ Performance critical (unless tail-optimized)

---