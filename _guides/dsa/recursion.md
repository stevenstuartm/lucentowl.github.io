---
title: "Recursion"
layout: guide
category: Data Structures & Algorithms
subcategory: Fundamentals
description: "How recursive functions work: base and recursive cases, how the call stack runs them and why deep recursion overflows it, memoization for repeated subproblems, the common recursive shapes, and converting recursion to iteration in C#."
tags: [recursion, call-stack, memoization, tail-recursion, stack-overflow, fundamentals]
---
{% raw %}

## Why Recursion Exists

Some problems contain smaller copies of themselves. A tree is a node whose children are trees, a directory holds directories, and n! is n times (n − 1)!. A recursive function solves such a problem by solving a smaller copy of it and building on the answer. For self-similar problems, the code then mirrors the problem's own definition, which is usually shorter and easier to check than the equivalent loop.

---

## The Three Parts of a Recursive Function

Every correct recursive function has three parts:

- **A base case** that answers directly without calling itself. Without one, the function never stops calling itself.
- **A recursive case** that calls the function on a smaller input and combines the result.
- **Progress toward the base case.** Each call's input must be strictly closer to a base case, or the recursion never ends even though a base case exists.

Factorial shows all three:

```csharp
public static long Factorial(int n)
{
    if (n < 0)
        throw new ArgumentOutOfRangeException(nameof(n), "Factorial is undefined for negative n.");
    if (n <= 1)                   // Base case
        return 1;

    return n * Factorial(n - 1);  // Recursive case; n - 1 moves toward the base case
}

Console.WriteLine(Factorial(5));  // 120
Console.WriteLine(Factorial(0));  // 1
```

The return type is `long` because factorials outgrow `int` quickly. 13! is already beyond `int.MaxValue`. `long` holds up to 20!. 21! overflows it too, and silently, because C# integer arithmetic is unchecked by default. `Factorial(21)` returns a negative number rather than throwing.

---

## How the Call Stack Runs a Recursion

Each method call gets a stack frame, a block of memory on the thread's call stack that holds the call's parameters, local variables, and the point to return to. A recursive call is an ordinary call, so it pushes a new frame on top of the caller's frame. The caller's frame stays on the stack, paused mid-expression, until the call it made returns.

For `Factorial(4)`, the calls push four frames, each with its own `n` and each waiting to multiply. Only when `Factorial(1)` hits the base case does anything return. Then the frames pop in reverse order, each finishing its multiplication with the value it receives.

{% endraw %}
{% include figure.html id="dsa-call-stack" %}
{% raw %}

### Recursion Depth Is Memory

Because every frame waiting for a result stays on the stack, a recursion's memory use is proportional to its maximum depth, even when it allocates nothing else. `Factorial(n)` uses O(n) stack space. A recursion that halves its input each call, such as recursive binary search, is only O(log n) deep.

### Stack Overflow

The call stack has a fixed size. Microsoft's documentation gives the default for .NET apps as 1.5 MB on Windows and macOS and 8 MB on Linux. A host process can set its own, and from .NET 10 the `System.Threading.DefaultStackSize` runtime setting overrides it for threads the runtime creates. Frame sizes vary with the method's parameters and locals, so there is no fixed call limit, but a recursion whose depth grows with the input will exhaust the stack at some input size.

When it does, .NET throws a `StackOverflowException`, and it cannot be caught. A `try`/`catch` block does not intercept it, and the process is terminated. So a recursion whose depth depends on the input has to be bounded by design: either the depth is logarithmic, the input size is known to be small, or the recursion is converted to iteration.

---

## Repeated Work and Memoization

Naive recursive Fibonacci makes two calls per call, and the two branches recompute the same values over and over:

```csharp
public static long FibonacciNaive(int n)
{
    if (n <= 1)
        return n;

    return FibonacciNaive(n - 1) + FibonacciNaive(n - 2);
}
```

`FibonacciNaive(n)` makes 2 × F(n + 1) − 1 calls, where F(n + 1) is itself a Fibonacci number, so the call count grows exponentially. `FibonacciNaive(10)` makes 177 calls, `FibonacciNaive(30)` makes about 2.7 million, and `FibonacciNaive(40)` makes about 331 million.

There are only n + 1 distinct values to compute. Memoization stores each result the first time it is computed and returns the stored value on every later call. That makes the running time O(n), because each value is computed once, at the cost of O(n) extra memory for the stored results. This is the top-down form of dynamic programming.

{% endraw %}
{% include figure.html id="dsa-fibonacci-call-tree" %}
{% raw %}

```csharp
public static long FibonacciMemo(int n, Dictionary<int, long>? memo = null)
{
    memo ??= new Dictionary<int, long>();

    if (n <= 1)
        return n;

    if (memo.TryGetValue(n, out long cached))
        return cached;

    long result = FibonacciMemo(n - 1, memo) + FibonacciMemo(n - 2, memo);
    memo[n] = result;
    return result;
}

Console.WriteLine(FibonacciMemo(50));  // 12586269025
```

Memoization fixes the repeated work but not the depth. `FibonacciMemo(n)` still recurses n levels deep, so a large enough n still overflows the stack.

---

## Recursion on Recursive Data

Recursion fits data that is defined recursively. A binary tree node has two children, each of which is a binary tree or `null`, so a function over a tree handles the `null` case and then recurses into both children.

```csharp
public class TreeNode
{
    public int Value { get; set; }
    public TreeNode? Left { get; set; }
    public TreeNode? Right { get; set; }

    public TreeNode(int value) => Value = value;
}

public static int TreeHeight(TreeNode? node)
{
    if (node == null)
        return -1;                // Empty tree: height -1, so a single node has height 0

    return 1 + Math.Max(TreeHeight(node.Left), TreeHeight(node.Right));
}

public static int TreeSum(TreeNode? node)
{
    if (node == null)
        return 0;

    return node.Value + TreeSum(node.Left) + TreeSum(node.Right);
}
```

Height here counts edges, so a single node has height 0. The recursion depth grows with the tree's height, which is about log₂ n for a balanced tree but n − 1 for a tree that has degenerated into a chain. That chain is where recursive tree code overflows the stack.

---

## Common Recursive Shapes

| Shape | What it does | Example | Cost |
| --- | --- | --- | --- |
| Linear | One recursive call, on an input one step smaller | Factorial, summing an array | O(n) calls, O(n) depth |
| Halving | One call on half the input | Recursive binary search, fast exponentiation | O(log n) calls and depth |
| Divide and conquer | Two or more calls on separate parts of the input, then combine the results | Merge sort | O(n) calls, O(log n) depth when the parts are halves |
| Branching (tree) | Two or more calls per call, possibly on overlapping inputs | Naive Fibonacci, tree traversal | Up to exponential calls. Depth is the longest branch |
| Tail | The recursive call is the last thing the function does | Factorial with an accumulator, Euclid's GCD | Tail position doesn't change the shape: linear for factorial, O(log min(a, b)) calls for GCD |
| Mutual | Two or more functions call each other | `IsEven` and `IsOdd`, recursive-descent parsers | Depends on the functions |

Euclid's GCD finds the greatest common divisor with gcd(a, b) = gcd(b, a mod b), stopping when b is 0. A recursive-descent parser has one function per grammar rule, and the functions call each other the way the rules refer to each other.

Backtracking is branching recursion that explores choices one at a time and undoes each choice that leads nowhere, as in solving a maze or placing queens on a chessboard.

Branching recursion over a tree touches each node once and is O(n). Branching recursion over overlapping subproblems, like naive Fibonacci, is where exponential cost comes from.

Mutual recursion looks like this. For non-negative n, each function makes progress by passing a smaller n to the other:

```csharp
// Both assume n >= 0. A negative n never reaches 0 and recurses until the stack overflows.
public static bool IsEven(int n) => n == 0 || IsOdd(n - 1);
public static bool IsOdd(int n) => n != 0 && IsEven(n - 1);
```

---

## Converting Recursion to Iteration

### Tail Recursion Becomes a Loop

A function is tail recursive when the recursive call is the very last operation, with nothing left to do after it returns. Some languages guarantee that a tail call reuses the current frame instead of pushing a new one, which makes tail recursion run in constant stack space. C# makes no such guarantee. The C# compiler doesn't emit the tail-call instruction in the intermediate language (IL) it produces. The just-in-time (JIT) compiler, which turns IL into machine code, removes tail calls only in some builds and circumstances. So tail-recursive C# can still overflow on deep input, and code can't rely on it not to.

A tail-recursive function converts mechanically into a loop. The accumulator parameter, `acc` below, which carries the result built so far, becomes a local variable, and the recursive call becomes an update of the loop variables:

```csharp
// Tail recursive: the multiplication happens before the call, not after
public static long FactorialTail(int n, long acc = 1)
{
    if (n <= 1)
        return acc;

    return FactorialTail(n - 1, n * acc);
}

// The same computation as a loop
public static long FactorialIterative(int n)
{
    long acc = 1;
    while (n > 1)
    {
        acc *= n;
        n--;
    }
    return acc;
}
```

### Branching Recursion Needs an Explicit Stack

When a function makes more than one recursive call, a single loop variable can't hold the pending work. The fix is to keep the pending work on a `Stack<T>` that the code manages itself. That stack lives on the managed heap, the memory where .NET allocates objects, which is far larger than the call stack, so the depth limit goes away.

```csharp
public static int TreeSumIterative(TreeNode? root)
{
    int sum = 0;
    var pending = new Stack<TreeNode>();
    if (root != null)
        pending.Push(root);

    while (pending.Count > 0)
    {
        TreeNode node = pending.Pop();
        sum += node.Value;

        if (node.Left != null) pending.Push(node.Left);
        if (node.Right != null) pending.Push(node.Right);
    }

    return sum;
}
```

The iterative version is longer and less obviously correct than the three-line recursive one, which is the usual trade.

---

## Choosing Recursion or Iteration

| Prefer recursion when | Prefer iteration when |
| --- | --- |
| The data or problem is recursive, such as trees, nested structures, or divide and conquer | A simple loop expresses the problem as clearly |
| The depth is bounded, such as a balanced tree or a halving algorithm | The depth grows with the input and the input size is not controlled |
| The recursive version is clearly shorter and easier to verify | The code runs in a hot path, where per-call overhead adds up |

A `StackOverflowException` ends the process rather than failing one request, so input-controlled recursion depth is a reliability risk in server code, not only a performance concern.

---

## Worked Examples

### Fast Exponentiation

Computing baseⁿ by multiplying n times is O(n). Squaring the result for n/2 halves the problem at every call, which makes it O(log n):

```csharp
public static long Power(long baseNum, int exp)
{
    if (exp < 0)
        throw new ArgumentOutOfRangeException(nameof(exp), "A negative exponent needs a fractional result.");
    if (exp == 0)
        return 1;

    long half = Power(baseNum, exp / 2);
    return exp % 2 == 0 ? half * half : baseNum * half * half;
}

Console.WriteLine(Power(2, 10));  // 1024
```

Like `Factorial`, it overflows `long` silently once the result passes about 9.2 × 10¹⁸.

### Palindrome Check Without Copying

Recursion on strings can hide a cost. A version that recurses on `s.Substring(1, s.Length - 2)` allocates a new string at every level, which makes it O(n²) in time and memory. Passing indices instead keeps each call O(1):

```csharp
public static bool IsPalindrome(string s) => IsPalindrome(s, 0, s.Length - 1);

private static bool IsPalindrome(string s, int left, int right)
{
    if (left >= right)
        return true;

    if (s[left] != s[right])
        return false;

    return IsPalindrome(s, left + 1, right - 1);
}

Console.WriteLine(IsPalindrome("racecar"));  // True
Console.WriteLine(IsPalindrome("hello"));    // False
```

---

## Debugging Recursion

A debugger's Call Stack window shows every active frame and its parameter values, which is usually the fastest way to see where a recursion went wrong. Without a debugger, printing each call indented by its depth shows the same shape:

```csharp
public static long FactorialTrace(int n, int depth = 0)
{
    string indent = new string(' ', depth * 2);
    Console.WriteLine($"{indent}Factorial({n})");

    long result = n <= 1 ? 1 : n * FactorialTrace(n - 1, depth + 1);

    Console.WriteLine($"{indent}returns {result}");
    return result;
}
```

The most common bugs show up in that trace. A base case that is never reached, often an off-by-one or a missing negative-input check, produces a trace that keeps growing. A combine step that uses the wrong value produces correct calls with wrong returns.

{% endraw %}
