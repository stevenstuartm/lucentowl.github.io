# Data Structures & Algorithms Study Guides Consolidation and Refinement Plan

Tracks the consolidation and review-and-refine pass over the "Data Structures & Algorithms" category of `assets/data/study_guides_config.json`: all 19 guides in `_guides/dsa/`, plus the one resource already attached to them (`_resources/big-o-complexity-quick-reference.md`). Phase 0 took the category from 19 guides to 13. `asymptotic-notation`, `trees-basics`, and `graphs-basics` merged into survivors. `complexity-cheatsheet` merged into the existing resource, and `decision-guide` became the new `data-structure-selection-guide` resource.

Guides are consumed sequentially in config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The checklist, the Phase 0 method, the process rules, and the cross-domain gotchas live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md) and [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

**Current position: Phase 1, row 8** (row 7 awaiting its review round).

**Pre-Phase-0 baseline: commit `f36b10e`.** Phase 0 moved only the sections each disposition named. Where a survivor already had its own version of a section, the duplicate was cut rather than appended, so the survivor's row compares against the baseline with `git show f36b10e:_guides/dsa/<file>.md` and keeps the better version. The pre-flags below name each comparison.

**Cadence.** Same as the .NET & C# pass. Refinement rows run inline: the content items, item 1 aimed at the load-bearing and falsifiable claims, then the presentation pass and `/refine-prose`. Merged survivors (rows 1, 7, 10) and the new resource (row 15) get one independent review round, because most of their prose will be recombined text. A claim that can't be confirmed cheaply gets softened and logged under *Unverified, left standing*.

---

## Sources

- **Primary, for algorithms and bounds:** Cormen, Leiserson, Rivest, Stein, *Introduction to Algorithms* (4th ed.), and Sedgewick & Wayne, *Algorithms* (4th ed.) with its companion site [algs4.cs.princeton.edu](https://algs4.cs.princeton.edu/){:target="_blank" rel="noopener noreferrer"}. Use these for complexity bounds, invariants, and correctness conditions (Dijkstra's non-negative weights, A*'s admissible heuristic, heap build in O(n)).
- **Primary, for .NET behavior:** the [.NET API browser](https://learn.microsoft.com/dotnet/api/){:target="_blank" rel="noopener noreferrer"} and its remarks sections, for `List<T>`, `Dictionary<TKey,TValue>`, `HashSet<T>`, `SortedDictionary`, `SortedSet`, `LinkedList<T>`, `Stack<T>`, `Queue<T>`, `PriorityQueue<TElement,TPriority>`, `Array.Sort`, and `Enumerable.OrderBy`. Where the docs are silent on an implementation detail (growth factor, collision strategy, sort algorithm), check the `dotnet/runtime` source and say which version it describes.
- **Code samples:** compile and run any non-trivial implementation in a scratch console app (`dotnet` is installed). Use the scratchpad, not the repo.
- **Off-limits as fact:** GeeksforGeeks, LeetCode discussions, blog posts, and AI-written summaries. They're useful for finding a lead, never for citing one.

---

## Domain notes

**Item 1 (factual correctness)** in this domain splits three ways:

1. **Code.** Nearly every guide carries hand-written implementations: heap sift, BST delete, quicksort partition, binary search variants, and Dijkstra. Off-by-one errors and wrong loop bounds are the default failure mode, and they read plausibly. Run the non-trivial ones against a few inputs, including an empty one, a single element, duplicates, and already-sorted input.
2. **Complexity claims.** Check every bound against its case. The traps are listed under Domain gotchas.
3. **.NET claims.** Version annotations ("(.NET 6+)"), what a built-in uses internally, and stability guarantees.

**Item 7 (hierarchy and scope clarity)** in this domain means three layers a claim can sit at, and a guide should say which one it means when a cost depends on it:

| Layer | Examples |
|---|---|
| Abstract data type (the contract) | stack, queue, priority queue, map, set |
| Data structure (an implementation of the contract) | array, linked list, binary heap, hash table with chaining, red-black tree |
| .NET collection type (a specific implementation) | `Stack<T>`, `PriorityQueue<TElement,TPriority>`, `Dictionary<TKey,TValue>`, `SortedDictionary<TKey,TValue>` |

The tell is a cost stated against an ADT ("a priority queue is O(log n) insert"), which is true only of particular implementations. A second axis applies to every cost: asymptotic bound (O/Ω/Θ) versus which case (worst, average, best, amortized). The guides conflate these today.

**Item 9 (tag audit)**, measured across the 19 guides before the pass:

| Tag | Count | Reading |
|---|---|---|
| `algorithms` | 19/19 | Category restatement. Drop. |
| `data-structures` | 12/19 | Category restatement. Drop. |
| `interview-prep` | 13/19 | Filler at this rate. Keep only on guides whose content is substantially interview problems. |
| `practical` / `fundamentals` / `advanced` | 10 / 9 / 3 | Skill level. Exactly one per guide. `hash-tables` carries two today. |
| `reference` | 2/19 | Leaves with the two guides moving to resources. |
| `complexity-analysis` | 5/19 | Real signal on the complexity guide and the resource. Filler on sorting and search, where it's incidental. |
| `trees`, `graphs`, `heaps`, `hash-tables`, `recursion`, `sorting`, `searching`, `priority-queues` | 1-3 each | Genuine topic signal. Keep. |

---

## Topic ownership map

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| Growth rates, O/Ω/Θ, best/worst/average cases | `big-o-basics` | A cost stated inline, with its case named |
| Amortized analysis (the technique) | `big-o-basics` | Named in a clause where a structure relies on it |
| Dynamic array doubling (the worked amortized example) | `arrays-lists` | `big-o-basics` may cite the result in a sentence |
| Call stack, base case, stack depth limits | `recursion` | Assumed |
| Memoization / dynamic programming | `algorithm-design` | `recursion` shows memoized Fibonacci as the fix for repeated calls, in one example, without teaching DP |
| Backtracking | `algorithm-design` | `recursion` names it in a sentence |
| Divide and conquer (the paradigm) | `algorithm-design` | Merge sort and binary search are taught in their own guides |
| Two pointers, sliding window | `arrays-lists` | Named in a clause |
| Priority queue (ADT and .NET type) | `heaps` | `stacks-queues` defines it in a clause; `graphs-advanced` uses it |
| Heap sort | `sorting-algorithms` | `heaps` names it in a clause |
| Binary search (algorithm and variants) | `search-algorithms` | `trees` relates BST search to it in a sentence |
| BFS / DFS | `graphs` | `trees` teaches tree traversals (pre/in/post/level order) only; `stacks-queues` names BFS as a queue use in a clause |
| Tries | `trees-advanced` | Omitted elsewhere |
| Tree balancing (AVL, red-black, rotations) | `trees-advanced` | `trees` shows why a skewed BST degrades, then stops |
| B-trees and on-disk indexes | `data/storage-engines-and-indexing.md` (out of scope) | `trees-advanced` names them in a sentence, no link |
| Dijkstra, A*, MST, topological sort, union-find, flow | `graphs-advanced` | `graphs` stops at unweighted traversal |
| Hashing, collisions, load factor | `hash-tables` | Assumed |
| Structure and algorithm selection tables | `data-structure-selection-guide` (resource) | Each guide keeps its own "when to use" prose |
| Complexity lookup tables | `big-o-complexity-quick-reference` (resource) | Each guide keeps one table for its own structure |

---

## Domain gotchas

- **Inline `{% raw %}` blocks.** `arrays-lists.md` has ten inline raw pairs, needed because C# initializers like `{{1, 2, 3}, {4, 5, 6}}` are valid Liquid openers. Replace them with a whole-document wrap, and wrap every other guide too, since the merges will move 2D-array and nested-initializer code between files.
- **Bound versus case.** `asymptotic-notation` titles Big O "(Worst Case)" and Omega "(Best Case)". That conflates an upper bound with a worst-case input, a standard error. Item 1 fixes it wherever it recurs.
- **Complexity traps to check on sight:** building a heap is O(n), not O(n log n); quicksort's worst case is O(n²); hash table operations are O(n) worst case; Dijkstra fails on negative weights; a BST is O(n) worst case unless balanced; `LinkedList<T>` removal is O(1) only given the node.
- **.NET sort stability.** `Array.Sort` and `List<T>.Sort` are unstable (introsort). `Enumerable.OrderBy` is stable. Guides that say "C# sorting" without naming which one are ambiguous.
- **C# and tail calls.** The C# compiler does not guarantee tail-call elimination. Any "tail recursion avoids stack overflow" claim needs qualifying for C#.

---

## Cross-guide facts in force

Verified during earlier rows. Applies to every remaining guide that touches the topic.

- **.NET introsort.** `Array.Sort` and `List<T>.Sort` run introsort (`ArraySortHelper` in `dotnet/runtime`). Partitions of `IntrosortSizeThreshold = 16` elements or fewer go to insertion sort (sizes 2 and 3 are swapped directly). Recursion deeper than `2 * (Log2(n) + 1)` falls back to heapsort. Source: `System.Private.CoreLib/src/System/Array.cs` and `ArraySortHelper.cs`.
- **Bound versus case vocabulary.** Row 1 now teaches O/Ω/Θ as bounds and best/worst/average as cases, with a table. Later guides state a cost with its case named ("Θ(n²) worst case"), and don't re-teach either axis.
- **Practical input limits.** Row 1 uses a one-second budget at about 10⁸ simple operations per second: O(n) 10⁸, O(n log n) 10⁶ to 10⁷, O(n²) 10⁴, O(n³) 500, O(2ⁿ) 25, O(n!) 11. The quick-reference resource (row 16) reconciles to these figures.
- **.NET stack and tail calls.** `StackOverflowException` cannot be caught, and the process is terminated (Microsoft Learn, `StackOverflowException` remarks). The documented default thread stack is 1 MB, set by the executable header (`Thread` constructor remarks). The C# compiler doesn't emit the IL `tail.` prefix, so tail-call elimination is JIT-opportunistic and can't be relied on. Row 2 owns these facts. Later guides with recursive code (trees, graphs, sorting) mention depth risk in a clause without re-teaching it.
- **Existing DSA figures.** `dsa-growth-rates`, `dsa-asymptotic-bounds`, `dsa-merge-sort-recursion-tree` (row 1), `dsa-call-stack` (row 2), `dsa-dynamic-array-appends` (row 3), `dsa-linked-list-structure` (row 4), `dsa-circular-buffer` (row 5), `dsa-hash-collisions` (row 6), `dsa-bst-shapes` (row 7). Row 13 (sorting) can embed the merge sort recursion tree rather than drawing its own.
- **`List<T>` growth.** Capacity starts at 0, the first `Add` allocates 4, and each growth doubles, capped at `Array.MaxLength` (`List.cs` in `dotnet/runtime`). It never shrinks on its own; `TrimExcess()` and `EnsureCapacity(int)` exist. Row 3 owns this; later guides cite it in a clause.
- **`LinkedList<T>`.** Doubly linked and circular internally (`LinkedList.cs`). Each `LinkedListNode<T>` holds its list, next, previous, and item. Node-based operations are O(1) and value-based ones O(n), with no indexer. Row 4 owns this, including the LRU-cache pattern. Row 5 (queues) and row 6 (hash tables) mention it in a clause.
- **`Stack<T>` and `Queue<T>`.** `Stack<T>` is array-backed, allocating 4 on the first push and then doubling. `Queue<T>` is a circular buffer that grows ×2, by at least 4 slots (`Queue.cs`). There is no public deque type in `System.Collections.Generic` as of .NET 10. The original `stacks-queues.md` was truncated in every historical version in the source repo, so row 5 is a rebuild, not a recovery.
- **`Dictionary<TKey,TValue>`.** Separate chaining stored in two arrays (bucket heads and entries with `next` indices), prime bucket counts, resize when the entries array is full (load factor 1) to the next prime at least double the count, and a switch to randomized string hashing after 100 collisions in one chain (`Dictionary.cs`, `HashHelpers.cs`). String hash codes can differ between runs (`String.GetHashCode` remarks). `SortedDictionary` is the ordered alternative. Row 6 owns this.
- **Sorted collections and tree conventions.** `SortedSet<T>` is a red-black tree with max height 2·log₂(n+1) (`SortedSet.cs` comment). `SortedDictionary` wraps `TreeSet<KeyValuePair>`, a `SortedSet` subclass. `SortedList` is sorted arrays with O(n) inserts. Row 7 counts height in edges (single node 0, empty −1) and uses a `TreeNode` with `int Value`, `Left`, `Right`. Row 9 keeps both conventions.
- **Figures.** DSA figures use the `dsa-` id prefix, `system: dsa`, and belong to the `_resources/dsa-diagrams.md` composite. Add each new figure's id there and the embedding guide to its `related_guides`.

---

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 8 heaps | Verify the "(.NET 6+)" claim for `PriorityQueue<TElement,TPriority>` and whether it supports priority updates. `graphs-advanced` (row 11) depends on the answer for Dijkstra. |
| 9 trees-advanced | Compare its trie against the one cut from baseline `trees.md` (Autocomplete Implementation is the likely keeper). The description promises red-black trees; the body has only AVL. Either add a short red-black section (it's what `SortedDictionary` uses; verify) or fix the description. |
| 10 graphs | Seeded with `graphs-basics`' Weighted Graph Implementation (under a new `## Weighted Graphs` heading) and Common Graph Patterns. Dijkstra and A* are gone, but Quick Reference (line ~790) still lists weighted shortest-path algorithms. Compare the baseline `graphs-basics.md` for terminology, traversal, the social-network example, and complexity tables that didn't move. |
| 11 graphs-advanced | Compare its Dijkstra and A* against the ones cut from baseline `graphs.md`. The new `## Topological Sort` section is a seed holding `graphs-basics`' Dependency Resolution (Kahn's algorithm); write the rest. Union-find is needed by Kruskal and is absent. |
| 12 search-algorithms | Compare against the recursive binary search cut from baseline `recursion.md`. |
| 13 sorting-algorithms | Compare against the recursive merge sort cut from baseline `recursion.md`. Verify "C# - Introsort" and the stability claims per Domain gotchas. |
| 14 algorithm-design | Compare its N-Queens and subset generation against the versions cut from baseline `recursion.md`. |
| 15 data-structure-selection-guide | Assembled unpolished from `decision-guide` plus the cheatsheet's decision trees. The interview-vs-production prose was dropped. Verify the "Performance Reality" claims (hash maps win most cases) against .NET collection behavior before they become reference material. |
| 16 big-o-complexity-quick-reference | Seeded with the cheatsheet's structure, sorting, search, graph, space, and .NET operation tables. The original "Common Algorithm Complexities" table now overlaps them. Tags `algorithms` and `data-structures` restate the category. |
---

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted. Revisit if a source turns up.

*(Empty at the start.)*

---

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Fundamentals | big-o-basics.md | Complete |
| 2 | Fundamentals | recursion.md | Complete |
| 3 | Core Data Structures | arrays-lists.md | Complete |
| 4 | Core Data Structures | linked-lists.md | Complete |
| 5 | Core Data Structures | stacks-queues.md | Complete |
| 6 | Core Data Structures | hash-tables.md | Complete |
| 7 | Trees & Heaps | trees.md | In progress |
| 8 | Trees & Heaps | heaps.md | Not started |
| 9 | Trees & Heaps | trees-advanced.md | Not started |
| 10 | Graphs | graphs.md | Not started |
| 11 | Graphs | graphs-advanced.md | Not started |
| 12 | Algorithms | search-algorithms.md | Not started |
| 13 | Algorithms | sorting-algorithms.md | Not started |
| 14 | Algorithms | algorithm-design.md | Not started |
| 15 | Resource | data-structure-selection-guide.md | Not started |
| 16 | Resource | big-o-complexity-quick-reference.md | Not started |

**Closing, after row 16:** re-run the sibling-link grep across `_guides/dsa/`, confirm no concept is re-taught against the ownership map, add one What's New entry for the pass, and decide whether the figures drawn during item 5 justify a `dsa-diagrams` composite resource like the other categories have. No DSA figures exist today. Likely candidates are heap array indexing, BST skew versus balance, hash collision chaining, and Dijkstra relaxation.
