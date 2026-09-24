---
title: "Algorithm Design Paradigms"
layout: guide
category: Data Structures & Algorithms
subcategory: Algorithms
description: "How to recognize which of four design strategies fits a new problem, and how to build a solution with each: divide and conquer and the recurrences that price it, dynamic programming with memoized or tabulated subproblems, greedy algorithms and the exchange argument that proves them, and backtracking with pruning."
tags: [divide-and-conquer, dynamic-programming, greedy-algorithms, backtracking, master-theorem, advanced]
---
{% raw %}

## Four Ways to Break a Problem Down

Many algorithms that aren't a direct loop solve a problem by expressing it in terms of smaller versions of itself. The four classic design paradigms differ in how those smaller problems relate to each other, and that relationship is what to look for in a new problem.

| Paradigm | How the subproblems relate | What it does with them | Typical result |
| --- | --- | --- | --- |
| Divide and conquer | Independent, with no shared work | Solves each once and combines the answers | Polynomial, often O(n log n) |
| Dynamic programming | Overlapping, the same subproblem reached many ways | Solves each distinct subproblem once and stores the answer | States × work per state, polynomial when both are |
| Greedy | One choice at a time, never revisited | Commits to the best-looking choice and moves on | Fast, often O(n log n) for an initial sort |
| Backtracking | A tree of partial solutions | Extends one partial solution at a time and abandons it at the first broken constraint | Exponential in the worst case, cut down by pruning |

The sections below take each one in turn, then come back to choosing between them.

---

## Divide and Conquer

Divide and conquer splits a problem into smaller independent pieces of the same kind, solves each piece recursively, and combines the results. Merge sort splits an array in half, sorts each half, and merges them. Quicksort partitions around a pivot and sorts each side. Binary search is the degenerate case with one piece. It discards half and recurses into the other.

Because the pieces don't overlap, no work is repeated, and the cost comes from three numbers: how many pieces, how big each is, and how much the split and combine steps cost. Writing that as a recurrence prices the algorithm.

| Recurrence | Meaning | Solves to | Example |
| --- | --- | --- | --- |
| T(n) = T(n/2) + O(1) | One half, constant extra work | O(log n) | Binary search |
| T(n) = 2T(n/2) + O(1) | Both halves, constant extra work | O(n) | Maximum of an array, by halving |
| T(n) = T(n/2) + O(n) | One half, linear extra work | O(n) | Quickselect, when each pivot splits evenly |
| T(n) = 2T(n/2) + O(n) | Both halves, linear extra work | O(n log n) | Merge sort |

The master theorem generalizes this table to T(n) = aT(n/b) + f(n). It compares f(n) with n^(log_b a), the total work at the leaves of the recursion. When one is larger by a polynomial factor, such as n^0.5, the larger one sets the cost. If f(n) is the larger, the theorem also needs a·f(n/b) ≤ c·f(n) for some c < 1 and all large enough n, so the work shrinks level by level and the top call dominates. Ordinary polynomials satisfy it. When they match, the cost gains a log n factor. Merge sort is the tie case. n^(log_2 2) = n matches the O(n) merge, giving O(n log n). Between those cases, when the two differ by less than a polynomial factor, as with f(n) = n / log n, the basic theorem gives no answer.

### Worked Example: The Largest Sum of a Run

Given an array of numbers, some negative, which contiguous run has the largest sum? Split the array in half. The best run lies entirely in the left half, entirely in the right half, or across the middle. The first two are the same problem on half the input. The third is the combine step, and it is where the design work is. A run that crosses the middle is some suffix of the left half joined to some prefix of the right half, so the best one pairs the best suffix with the best prefix, found by walking outward from the middle.

```csharp
public static long MaxRunSum(int[] values)
{
    if (values.Length == 0)
        throw new ArgumentException("There must be at least one value.", nameof(values));

    return MaxRunSum(values, 0, values.Length - 1);
}

private static long MaxRunSum(int[] values, int low, int high)
{
    if (low == high)
        return values[low];

    int mid = low + (high - low) / 2;
    long left = MaxRunSum(values, low, mid);        // Entirely in the left half
    long right = MaxRunSum(values, mid + 1, high);  // Entirely in the right half

    // Combine: the best run across the middle is the best suffix of the left plus the best prefix of the right
    long sum = 0, bestSuffix = long.MinValue;
    for (int i = mid; i >= low; i--)
    {
        sum += values[i];
        bestSuffix = Math.Max(bestSuffix, sum);
    }

    sum = 0;
    long bestPrefix = long.MinValue;
    for (int i = mid + 1; i <= high; i++)
    {
        sum += values[i];
        bestPrefix = Math.Max(bestPrefix, sum);
    }

    return Math.Max(Math.Max(left, right), bestSuffix + bestPrefix);
}

Console.WriteLine(MaxRunSum(new[] { -2, 1, -3, 4, -1, 2, 1, -5, 4 }));  // 6, from 4, -1, 2, 1
```

The combine step walks the whole range once, so this is T(n) = 2T(n/2) + O(n), which is O(n log n), the same shape as merge sort. It is a good divide-and-conquer exercise, but not the fastest answer. Kadane's algorithm solves the same problem in O(n) by treating it as dynamic programming. The best run ending at index i is either `values[i]` alone or `values[i]` added to the best run ending at i − 1. The same problem can fit more than one paradigm, and the one that exposes the most reuse usually wins.

### Worked Example: Quickselect

Finding the k-th smallest value doesn't need a full sort. Quickselect partitions around a random pivot, exactly as quicksort does, which puts the pivot at its final sorted index p. If p is k, that's the answer. Otherwise only the side containing k matters, and the other side is dropped.

```csharp
public static int KthSmallest(int[] values, int k)  // k is 0-based, and values gets reordered
{
    if ((uint)k >= (uint)values.Length)
        throw new ArgumentOutOfRangeException(nameof(k));

    int low = 0, high = values.Length - 1;
    while (true)
    {
        int p = Partition(values, low, high);
        if (p == k) return values[k];
        if (p < k) low = p + 1;   // The answer is right of the pivot
        else high = p - 1;        // The answer is left of the pivot
    }
}

// Lomuto partition with a random pivot: smaller values end up left of the returned index
private static int Partition(int[] values, int low, int high)
{
    int pivotIndex = Random.Shared.Next(low, high + 1);
    (values[pivotIndex], values[high]) = (values[high], values[pivotIndex]);
    int pivot = values[high], boundary = low;

    for (int i = low; i < high; i++)
    {
        if (values[i] < pivot)
        {
            (values[i], values[boundary]) = (values[boundary], values[i]);
            boundary++;
        }
    }

    (values[boundary], values[high]) = (values[high], values[boundary]);
    return boundary;
}

Console.WriteLine(KthSmallest(new[] { 7, 2, 9, 4, 1, 8, 5 }, 3));  // 5, the fourth smallest
```

Each round keeps one side. If every pivot split its range evenly, the work would be n + n/2 + n/4 + … < 2n. Random pivots don't split evenly, but they split well often enough that the expected cost is still linear, about 3.4n comparisons when k is the median. That beats sorting's O(n log n). A run of bad pivots can still make it Θ(n²), and many equal values can do the same, as they do for quicksort. The median-of-medians algorithm picks its pivot carefully enough to guarantee O(n) in the worst case, at the price of a larger constant.

---

## Dynamic Programming

Divide and conquer relies on its pieces being independent. When the same subproblem comes up again and again, recursing into each occurrence repeats the work, and the cost can grow exponentially. Dynamic programming solves each distinct subproblem once and stores the answer, so later occurrences become lookups. Memoized Fibonacci is the smallest example. It computes n + 1 values instead of an exponential number of calls.

Richard Bellman named the technique in the 1950s. "Programming" meant planning, as in a schedule, not writing code.

Two properties make a problem a fit:

- **Optimal substructure.** An optimal answer to the problem is built from optimal answers to its subproblems.
- **Overlapping subproblems.** The recursion reaches the same subproblems many times.

Designing a solution usually follows these steps:

1. **Define the state.** Say in one sentence what a subproblem is, such as "the fewest coins that make amount a".
2. **Write the recurrence.** Express one state's answer in terms of smaller states.
3. **Set the base cases.** The smallest states answer themselves.
4. **Choose an order.** Compute each state after the states it depends on, either by memoized recursion or by filling a table.

The cost is the number of states times the work per state.

### Top-Down or Bottom-Up

| | Memoization (top-down) | Tabulation (bottom-up) |
| --- | --- | --- |
| How it works | The natural recursion, with a cache checked before each computation | A loop fills a table from the base cases up |
| Which states it computes | Only the ones the answer actually reaches | Every state in the table |
| Recursion depth | As deep as the longest chain of states, which can overflow the stack | None |
| Space savings | Hard, since the cache holds everything | Often easy, by keeping only the rows the next step needs |

Memoization is quicker to write from a recursive definition. Tabulation is usually faster and avoids deep recursion, which matters in C# because a `StackOverflowException` ends the process.

### Worked Example: Making Change

Given coin values and an amount, what is the fewest coins that add up to it? The state is "the fewest coins that make amount a". The last coin used is one of the coin values c, so the answer for a is one more than the best answer for a − c, over every coin that fits. Amount 0 needs no coins.

```csharp
public static int MinCoins(int[] coins, int amount)
{
    var best = new int[amount + 1];  // best[a] is the fewest coins that make a
    Array.Fill(best, int.MaxValue);
    best[0] = 0;

    for (int a = 1; a <= amount; a++)
    {
        foreach (int coin in coins)
        {
            if (coin <= a && best[a - coin] != int.MaxValue)
                best[a] = Math.Min(best[a], best[a - coin] + 1);
        }
    }

    return best[amount] == int.MaxValue ? -1 : best[amount];  // -1: the amount can't be made
}

Console.WriteLine(MinCoins(new[] { 1, 3, 4 }, 6));  // 2, from 3 + 3
```

There are amount + 1 states and each checks every coin, so the cost is O(amount × coins). That is pseudo-polynomial. The cost is polynomial in the numeric value of the amount, not in the number of digits it takes to write it, so it slows down as amounts grow large.

### Worked Example: Edit Distance

The edit distance between two strings is the fewest single-character insertions, deletions, and substitutions that turn one into the other. Spell checkers use it, and diff tools use a close variant without substitutions. The state is "the distance between the first i characters of one string and the first j of the other", so the states form a grid.

If the i-th and j-th characters match, they cost nothing, and the answer is the one for i − 1 and j − 1. Otherwise the last step was one of three edits, and the answer is one more than the cheapest of the three neighboring cells: a substitution from the diagonal, a deletion from above, or an insertion from the left. The first row and column are the base cases. Turning a prefix into the empty string, or back, takes one edit per character.

```csharp
public static int EditDistance(string from, string to)
{
    var d = new int[from.Length + 1, to.Length + 1];

    for (int i = 0; i <= from.Length; i++) d[i, 0] = i;  // Delete every character
    for (int j = 0; j <= to.Length; j++) d[0, j] = j;    // Insert every character

    for (int i = 1; i <= from.Length; i++)
    {
        for (int j = 1; j <= to.Length; j++)
        {
            d[i, j] = from[i - 1] == to[j - 1]
                ? d[i - 1, j - 1]
                : 1 + Math.Min(d[i - 1, j - 1], Math.Min(d[i - 1, j], d[i, j - 1]));
        }
    }

    return d[from.Length, to.Length];
}

Console.WriteLine(EditDistance("horse", "ros"));  // 3
```

{% endraw %}
{% include figure.html id="dsa-edit-distance-table" %}
{% raw %}

For strings of lengths m and n, the table has (m + 1) × (n + 1) cells, each filled in O(1), so the cost is O(m × n) time and space. Each row reads only the row above, so keeping two rows cuts the space to O(n). The table gives the distance. With the full table kept, walking back from the bottom-right corner along the cells each value came from recovers the edits themselves.

### Worked Example: The 0/1 Knapsack

A knapsack holds a limited weight, and each item has a weight and a value. Taking each item whole or not at all, what is the most value that fits? The state is "the best value using the first i items with capacity w". Item i is either left out, giving the answer for i − 1 items at capacity w, or taken, giving its value plus the answer for i − 1 items at capacity w minus its weight.

```csharp
public static int Knapsack(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];  // best[w] after item i: the best value with capacity w

    for (int i = 0; i < weights.Length; i++)
    {
        for (int w = capacity; w >= weights[i]; w--)  // Downward, so each item is used at most once
            best[w] = Math.Max(best[w], values[i] + best[w - weights[i]]);
    }

    return best[capacity];
}

Console.WriteLine(Knapsack(new[] { 1, 3, 4, 5 }, new[] { 1, 4, 5, 7 }, 7));  // 9, from weights 3 and 4
```

The full table is items × capacity, but each row reads only the previous one, so a single array can hold it. Walking the capacities downward is what makes that safe. Going upward would let an item's own update feed into itself, which allows taking it more than once. The cost is O(items × capacity), pseudo-polynomial again.

---

## Greedy Algorithms

A greedy algorithm builds its answer one choice at a time, always taking the option that looks best right now and never revisiting it. That makes greedy algorithms simple and fast. The catch is that looking best right now doesn't always lead to the best overall answer, so a greedy algorithm is only correct when a proof says it is.

The coin problem above shows the failure. With coins 1, 3, and 4, making 6 greedily takes the largest coin that fits each time: 4, then 1, then 1, which is three coins. The dynamic program found two, 3 + 3. For coin systems like 1, 5, 10, and 25, greedy happens to be optimal, but that is a property of those coin values, not of the method.

### Worked Example: Scheduling the Most Meetings

One room, many meeting requests, each with a start and end time. What is the largest set that doesn't overlap? The greedy rule is to take the meeting that ends earliest, drop everything that overlaps it, and repeat.

```csharp
public record Meeting(string Name, int Start, int End);

public static List<Meeting> MostMeetings(IEnumerable<Meeting> requests)
{
    var chosen = new List<Meeting>();
    int roomFreeAt = int.MinValue;

    foreach (var meeting in requests.OrderBy(m => m.End))  // Earliest finish first
    {
        if (meeting.Start >= roomFreeAt)
        {
            chosen.Add(meeting);
            roomFreeAt = meeting.End;
        }
    }

    return chosen;
}

var requests = new[]
{
    new Meeting("A", 1, 4), new Meeting("B", 3, 5), new Meeting("C", 0, 6),
    new Meeting("D", 5, 7), new Meeting("E", 3, 9), new Meeting("F", 8, 11),
};
Console.WriteLine(string.Join(", ", MostMeetings(requests).Select(m => m.Name)));  // A, D, F
```

{% endraw %}
{% include figure.html id="dsa-meeting-schedule" %}
{% raw %}

The check `Start >= roomFreeAt` lets a meeting begin the moment the previous one ends, so back-to-back meetings both fit. The sort dominates, so it runs in O(n log n).

### Proving a Greedy Choice: the Exchange Argument

Why is "earliest finish" safe? Take any optimal schedule and look at its first meeting. The greedy first choice ends no later than it, by definition. Swapping the optimal schedule's first meeting for the greedy one leaves the rest of that schedule untouched, since the room frees up at least as early, and the schedule is just as large. So some optimal schedule starts with the greedy choice. The same argument then applies to what remains, one meeting at a time.

That pattern, showing that any optimal solution can be exchanged for one that agrees with the greedy choice without getting worse, is called an exchange argument. It is one standard way to prove a greedy algorithm correct. Another shows that the greedy solution stays at least as far ahead as any other after every step. Without one of these two proofs, a greedy rule is a guess. Both establish the greedy-choice property, which says the greedy choice itself is always safe, so some optimal solution begins with it. Other greedy rules for the same problem are wrong. Taking the shortest meeting first, or the one that starts earliest, both have counterexamples.

The knapsack shows how thin the line is. Taking items in order of value per unit of weight is optimal when items can be split, the fractional knapsack, but not when each item is all or nothing, which needed the dynamic program above. Several of the best-known graph algorithms are greedy, each with its own proof of correctness: Dijkstra's shortest paths, and Prim's and Kruskal's minimum spanning trees. Huffman coding, which builds optimal prefix codes for compression, is another.

---

## Backtracking

Some problems ask for every solution, or for any solution that satisfies a set of constraints, and have no structure that avoids searching. Backtracking searches them systematically. It builds a solution one piece at a time, checks the constraints after each piece, and abandons a partial solution as soon as it breaks one, undoing the last choice and trying the next. Abandoning early is called pruning, and it is what separates backtracking from trying every complete combination.

Most backtracking routines have the same three steps inside their loop. They choose, explore, and un-choose.

### Worked Example: N-Queens

Place n queens on an n × n chessboard so that no two share a row, a column, or a diagonal. Putting one queen per row handles rows. For columns and diagonals, three arrays record which are taken, so each check is O(1). Along one diagonal direction row + col is constant, and along the other row − col is constant.

```csharp
public static List<int[]> SolveNQueens(int n)  // n must be at least 1
{
    var solutions = new List<int[]>();
    var queenColumn = new int[n];            // queenColumn[row] is the column of that row's queen
    var columnTaken = new bool[n];
    var sumTaken = new bool[2 * n - 1];         // One per diagonal where row + col is constant
    var differenceTaken = new bool[2 * n - 1];  // One per diagonal where row - col is constant, shifted by n - 1

    Place(0);
    return solutions;

    void Place(int row)
    {
        if (row == n)
        {
            solutions.Add((int[])queenColumn.Clone());
            return;
        }

        for (int col = 0; col < n; col++)
        {
            if (columnTaken[col] || sumTaken[row + col] || differenceTaken[row - col + n - 1])
                continue;  // Prune: this square is attacked

            queenColumn[row] = col;  // Choose
            columnTaken[col] = sumTaken[row + col] = differenceTaken[row - col + n - 1] = true;

            Place(row + 1);          // Explore

            columnTaken[col] = sumTaken[row + col] = differenceTaken[row - col + n - 1] = false;  // Un-choose
        }
    }
}

foreach (int[] solution in SolveNQueens(4))
    Console.WriteLine(string.Join(", ", solution));  // 1, 3, 0, 2 and then 2, 0, 3, 1
Console.WriteLine(SolveNQueens(8).Count);            // 92
```

{% endraw %}
{% include figure.html id="dsa-nqueens-search" %}
{% raw %}

For four queens, trying every placement of one queen per row means 4⁴ = 256 complete boards. Pruning cuts the search to 16 partial boards past the empty one, and only two of them are solutions. The worst case is still exponential, so backtracking suits problems where the constraints bite early and the inputs stay small.

### Worked Example: Every Subset

Listing every subset of a set has no constraints to prune, but it shows the choose, explore, un-choose shape clearly. Each call records the current subset, then extends it with each later element in turn.

```csharp
public static List<List<int>> Subsets(int[] items)
{
    var result = new List<List<int>>();
    var current = new List<int>();

    Build(0);
    return result;

    void Build(int start)
    {
        result.Add(new List<int>(current));  // Copy, because current keeps changing

        for (int i = start; i < items.Length; i++)
        {
            current.Add(items[i]);           // Choose
            Build(i + 1);                    // Explore
            current.RemoveAt(current.Count - 1);  // Un-choose
        }
    }
}

Console.WriteLine(Subsets(new[] { 1, 2, 3 }).Count);  // 8
```

A set of n items has 2ⁿ subsets, and copying each one costs up to n, so the output alone is O(n × 2ⁿ). The `start` parameter does the real bookkeeping. Each call only adds elements after the last one added, so every element is used at most once and always in index order, and each subset comes out exactly once.

---

## Choosing a Paradigm

The questions below usually lead to the right one:

```
Does the problem need every solution, or any solution meeting constraints,
with no structure to exploit?
├─ Yes → Backtracking, pruning as early as the constraints allow
└─ No → Does the answer build from answers to smaller subproblems?
        ├─ No → Look for a direct algorithm, or a different formulation
        └─ Yes → Is it an optimization problem, and can you prove that one
                 locally best choice is always safe?
                 ├─ Yes → Greedy
                 └─ No → Do the subproblems overlap?
                          ├─ No → Divide and conquer
                          └─ Yes → Dynamic programming
```

Greedy and dynamic programming both need optimal substructure. Greedy needs more, a proof that one choice can be made without looking back. When that proof is missing, dynamic programming, which weighs every choice, is the safe option.

The paradigms also combine. Memoizing a backtracking search turns it into dynamic programming when its partial states repeat. Branch and bound is backtracking that also prunes branches whose best possible result can't beat the best answer found so far. Many problems, like the traveling salesman, have no known polynomial algorithm at all. For those, backtracking with good pruning, dynamic programming over subsets (Held–Karp, O(n² × 2ⁿ)), or a greedy approximation with no guarantee of optimality are the practical choices.

{% endraw %}
