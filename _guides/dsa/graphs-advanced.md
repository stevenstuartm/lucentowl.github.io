---
title: "Advanced Graph Algorithms"
layout: guide
category: Data Structures & Algorithms
subcategory: Graphs
description: "Weighted shortest paths with Dijkstra, Bellman-Ford, Floyd-Warshall, and A*; topological sorting; minimum spanning trees with Kruskal, Prim, and union-find; strongly connected components; maximum flow; and greedy graph coloring."
tags: [dijkstra, shortest-paths, topological-sort, minimum-spanning-tree, union-find, network-flow, advanced]
---
{% raw %}

## Beyond Unweighted Traversal

Breadth-first and depth-first search answer questions about reachability and hop counts. Most practical graph questions carry more information than that. Roads have lengths, links have latency, tasks have prerequisites, and pipes have capacities. The algorithms in this guide use that extra information, and each one answers a question plain traversal can't, such as the cheapest route, a valid order for dependent work, the cheapest way to connect everything, the groups that can all reach each other, or the most that can flow through a network.

The code uses the `Graph<T>` and `WeightedGraph<T>` adjacency-list classes, each with a `directed` flag, `AddVertex`, `AddEdge`, `Vertices`, and `Neighbors`. A `WeightedGraph<T>` lists each neighbor as a `(To, Weight)` pair. Weights are `int` throughout. `Neighbors` throws for a vertex that was never added, so every method that takes a start vertex expects it to be in the graph.

---

## Shortest Paths in Weighted Graphs

Breadth-first search counts edges, so its idea of the shortest path is wrong once edges have different costs.

Every weighted shortest-path algorithm is built on one step, called **relaxation**. Keep a best-known distance for each vertex. For an edge from u to v with weight w, if reaching u and then taking the edge costs less than v's best-known distance, lower v's distance to that and remember that the route came through u. The algorithms differ only in which edges they relax and in what order.

### Dijkstra's Algorithm

Edsger Dijkstra designed this algorithm in 1956 and published it in 1959. It assumes every edge weight is zero or more, and it works outward from the start in order of distance.

It keeps a priority queue of vertices keyed by their best-known distance. Each step removes the closest vertex not yet settled and declares its distance final, then relaxes every edge leaving it. Declaring it final is safe because every other route to that vertex would have to pass through some vertex that is already at least as far away, and with no negative edges, the rest of that route can only add cost.

{% endraw %}
{% include figure.html id="dsa-dijkstra-run" %}
{% raw %}

```csharp
public static (Dictionary<T, int> Distance, Dictionary<T, T> CameFrom) Dijkstra<T>(WeightedGraph<T> graph, T start)
    where T : notnull
{
    var distance = new Dictionary<T, int> { [start] = 0 };
    var cameFrom = new Dictionary<T, T>();
    var settled = new HashSet<T>();
    var queue = new PriorityQueue<T, int>();
    queue.Enqueue(start, 0);

    while (queue.TryDequeue(out T? vertex, out int known))
    {
        if (!settled.Add(vertex))
            continue;                        // A stale copy: this vertex was settled at a shorter distance

        foreach (var (next, weight) in graph.Neighbors(vertex))
        {
            int candidate = known + weight;
            if (!distance.TryGetValue(next, out int current) || candidate < current)
            {
                distance[next] = candidate;  // Relax: a shorter route to next, through vertex
                cameFrom[next] = vertex;
                queue.Enqueue(next, candidate);
            }
        }
    }

    return (distance, cameFrom);             // Vertices that can't be reached are absent
}

public static List<T>? PathTo<T>(Dictionary<T, T> cameFrom, T start, T goal) where T : notnull
{
    if (!EqualityComparer<T>.Default.Equals(start, goal) && !cameFrom.ContainsKey(goal))
        return null;                         // goal was never reached

    var path = new List<T> { goal };
    while (cameFrom.TryGetValue(goal, out T? previous))
    {
        path.Add(previous);
        goal = previous;
    }
    path.Reverse();
    return path;
}
```

.NET's `PriorityQueue<TElement,TPriority>` has no decrease-key operation for lowering the priority of an element already in the queue. Its `Remove` method, added in .NET 9, scans the whole queue, which is too slow to call on every improvement. So when a vertex's distance drops, the code enqueues a second copy at the new distance. The older copy comes out later, and the `settled` check skips it. This is the standard way to run Dijkstra on a queue without a decrease-key operation. The queue can hold up to one entry per edge, so the running time is O((V + E) log V).

For the figure's graph, `Dijkstra(graph, "A")` gives A 0, C 2, B 3, D 8, and E 9, and `PathTo(cameFrom, "A", "D")` returns A, C, B, D. To find the route to one destination only, the loop can stop as soon as that vertex is settled.

### Why Negative Edges Break Dijkstra

Settling a vertex is a promise that no route found later will be shorter. A negative edge breaks the promise. Take a directed graph with edges A → B (2), A → C (3), C → B (−2), and B → D (1). Dijkstra settles B at 2 and relaxes B → D, giving D a distance of 3, before it settles C at 3. Only then does it find that A → C → B costs 1. B's entry in `distance` changes to 1, but B is already settled, so its edges are never relaxed again, and D stays at 3. The true distance to D is 2.

Negative weights do come up in practice. They appear when edges represent gains as well as costs, as in currency exchange, where a cycle whose weights add up to less than zero is an arbitrage opportunity.

### Bellman-Ford

Bellman-Ford drops the settling step and relaxes every edge, over and over. A shortest path without a cycle has at most V − 1 edges. After round k, every vertex whose shortest path uses at most k edges has its correct distance, so V − 1 rounds are enough.

```csharp
public static Dictionary<T, int>? BellmanFord<T>(int vertexCount, IReadOnlyList<(T From, T To, int Weight)> edges, T start)
    where T : notnull
{
    var distance = new Dictionary<T, int> { [start] = 0 };

    for (int round = 1; round < vertexCount; round++)
    {
        bool changed = false;
        foreach (var (from, to, weight) in edges)
        {
            if (distance.TryGetValue(from, out int d)
                && (!distance.TryGetValue(to, out int current) || d + weight < current))
            {
                distance[to] = d + weight;
                changed = true;
            }
        }
        if (!changed) break;                 // Nothing improved, so nothing will
    }

    foreach (var (from, to, weight) in edges)
    {
        if (distance.TryGetValue(from, out int d)
            && (!distance.TryGetValue(to, out int current) || d + weight < current))
            return null;                     // Still improving: a negative cycle is reachable
    }

    return distance;
}
```

It takes a plain list of directed edges, since it never needs a vertex's neighbors. On the graph above it returns D at 2. Its cost is O(V × E), slower than Dijkstra, and that is the price of allowing negative edges.

The final pass is the part Dijkstra can't do. If any edge can still be relaxed after V − 1 rounds, some cycle reachable from the start has a negative total, and going around it again always lowers the cost further. No shortest path exists then, so the method returns `null`. A negative cycle the start can't reach doesn't affect the answer. An undirected edge with a negative weight is a negative cycle by itself, since it can be crossed back and forth, so negative weights only make sense in directed graphs.

### Floyd-Warshall: Every Pair at Once

Some problems need the distance between every pair of vertices, such as a table of travel times between all cities. Floyd-Warshall computes it with three nested loops over a distance matrix. The outer loop allows one more vertex, k, to be used as a stopping point, and every pair checks whether going through k is shorter.

```csharp
public const int Infinity = int.MaxValue / 2;   // Half of MaxValue, so Infinity + Infinity doesn't overflow

// weight[i, j] is the edge weight from i to j, Infinity where there is no edge, and 0 where i == j
public static int[,] AllPairs(int[,] weight)
{
    int n = weight.GetLength(0);
    var dist = (int[,])weight.Clone();

    for (int k = 0; k < n; k++)              // Allow paths through vertices 0..k
        for (int i = 0; i < n; i++)
        {
            if (dist[i, k] == Infinity) continue;   // No route from i to k yet
            for (int j = 0; j < n; j++)
                if (dist[k, j] != Infinity && dist[i, k] + dist[k, j] < dist[i, j])
                    dist[i, j] = dist[i, k] + dist[k, j];
        }

    return dist;
}
```

The two `Infinity` checks matter once weights can be negative, since `Infinity` plus a negative weight is less than `Infinity` and would pass for a real distance. It runs in O(V³) time, needs O(V²) memory, and allows negative edges. A negative value on the diagonal afterward means the graph has a negative cycle that vertex can reach and return from. For a sparse graph with no negative weights, running Dijkstra from every vertex is usually faster, at O(V (V + E) log V). With negative weights, Johnson's algorithm gets the same speed. It runs Bellman-Ford once to compute a reweighting that makes every edge non-negative without changing which paths are shortest, then runs Dijkstra from every vertex. For a few hundred vertices, Floyd-Warshall's three loops are usually the simplest choice.

### A* Search

Dijkstra spreads out evenly in every direction, so on a map it explores the whole region around the start before it reaches a goal on one side. A* uses an estimate of the remaining distance to steer toward the goal. It was published by Peter Hart, Nils Nilsson, and Bertram Raphael in 1968.

The priority of a vertex becomes its cost so far plus the estimated cost from there to the goal. The estimate, called the heuristic, has to meet one of two conditions:

- **Admissible:** it never overestimates the true remaining cost. That's enough for A* to return a shortest path, as long as a vertex can be reopened when a cheaper route to it turns up.
- **Consistent:** for every edge from u to v, the estimate at u is at most the edge's weight plus the estimate at v. A consistent heuristic that estimates 0 at the goal is also admissible, and with a consistent one, a vertex taken from the queue is final, just as in Dijkstra. The code below relies on that.

On a grid where each move goes up, down, left, or right at cost 1, the Manhattan distance, |x₁ − x₂| + |y₁ − y₂|, is consistent. When moves can go in any direction and cost their straight-line length, the straight-line distance to the goal is consistent instead, though the costs are then no longer whole numbers.

```csharp
public static List<T>? AStar<T>(WeightedGraph<T> graph, T start, T goal, Func<T, int> estimate)
    where T : notnull
{
    var cost = new Dictionary<T, int> { [start] = 0 };
    var cameFrom = new Dictionary<T, T>();
    var closed = new HashSet<T>();
    var open = new PriorityQueue<T, int>();
    open.Enqueue(start, estimate(start));

    while (open.TryDequeue(out T? vertex, out _))
    {
        if (EqualityComparer<T>.Default.Equals(vertex, goal))
            return PathTo(cameFrom, start, goal);
        if (!closed.Add(vertex))
            continue;                        // A stale copy

        foreach (var (next, weight) in graph.Neighbors(vertex))
        {
            int candidate = cost[vertex] + weight;
            if (!cost.TryGetValue(next, out int current) || candidate < current)
            {
                cost[next] = candidate;
                cameFrom[next] = vertex;
                open.Enqueue(next, candidate + estimate(next));   // Priority: cost so far + estimate to go
            }
        }
    }

    return null;
}
```

For grid cells stored as `(int X, int Y)` tuples, the call passes the Manhattan distance to the goal:

```csharp
var goal = (X: 60, Y: 60);
var path = AStar<(int X, int Y)>(grid, (40, 40), goal,
    p => Math.Abs(p.X - goal.X) + Math.Abs(p.Y - goal.Y));
```

With this implementation, on an open 100 × 100 grid, searching from (40, 40) to (60, 60) expanded 150 cells. The same search with an estimate of 0, which turns A* back into Dijkstra, expanded 3,125. Both returned a path of 40 steps. The exact counts depend on how the queue breaks ties between equal priorities, which `PriorityQueue` doesn't specify. The saving also depends on the map. A wall between the start and the goal forces A* to explore around it.

{% endraw %}
{% include figure.html id="dsa-astar-region" %}
{% raw %}

### Choosing a Shortest-Path Algorithm

| The question | Use |
| --- | --- |
| Fewest edges, no weights | Breadth-first search |
| Shortest routes from one start, weights zero or more | Dijkstra |
| Shortest route to one known goal, with a good distance estimate | A* |
| Shortest routes from one start, some weights negative | Bellman-Ford |
| Shortest routes in a directed graph with no cycles, any weights | Relaxation in topological order, covered under Topological Sort |
| Distances between every pair of vertices | Floyd-Warshall. On a large sparse graph, Dijkstra from each vertex, or Johnson's algorithm if some weights are negative |

The cost of each is in the summary table at the end.

---

## Topological Sort

A topological order of a directed graph lists the vertices so that every edge points forward. If there's an edge from u to v, u comes before v. When edges mean "must happen before," it is an order in which to do the work. Build systems order compilation this way, package managers order installs, and spreadsheets order formula recalculation.

A topological order exists exactly when the graph has no cycles, since a cycle would need each of its vertices to come before the others. Most graphs have many valid orders.

### Kahn's Algorithm

Kahn's algorithm does the work the way a person would. It starts with everything that has no prerequisites, meaning an in-degree of zero. Each time it outputs a vertex, it removes that vertex's outgoing edges, and any vertex whose in-degree drops to zero becomes ready.

{% endraw %}
{% include figure.html id="dsa-topological-order" %}
{% raw %}

```csharp
public static List<T>? Kahn<T>(Graph<T> graph) where T : notnull
{
    var inDegree = graph.Vertices.ToDictionary(v => v, _ => 0);
    foreach (T vertex in graph.Vertices)
        foreach (T next in graph.Neighbors(vertex))
            inDegree[next]++;

    var ready = new Queue<T>(inDegree.Where(p => p.Value == 0).Select(p => p.Key));
    var order = new List<T>();

    while (ready.TryDequeue(out T? vertex))
    {
        order.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
        {
            if (--inDegree[next] == 0)       // Its last prerequisite is done
                ready.Enqueue(next);
        }
    }

    return order.Count == inDegree.Count ? order : null;   // null: a cycle blocked some vertices
}
```

If a cycle exists, its vertices never reach an in-degree of zero, and neither does anything that depends on them, so the output comes up short. That makes Kahn's algorithm a cycle check as well as a sort. It runs in O(V + E). The `ready` queue also shows which steps could run in parallel. Everything in it at the same moment is independent of everything else in it.

### Scheduling: Earliest Finish Times

A topological order also answers timing questions, because processing vertices in that order means every prerequisite is final before anything that depends on it. If each step has a duration, a step can start once its slowest prerequisite finishes:

```csharp
public static Dictionary<T, int> EarliestFinish<T>(Graph<T> dependencies, Dictionary<T, int> duration)
    where T : notnull
{
    List<T> order = Kahn(dependencies)
        ?? throw new InvalidOperationException("The dependencies contain a cycle.");

    var start = order.ToDictionary(task => task, _ => 0);   // Earliest each task can begin
    var finish = new Dictionary<T, int>();

    foreach (T task in order)                // Every prerequisite is final before its dependents
    {
        finish[task] = start[task] + duration[task];
        foreach (T next in dependencies.Neighbors(task))
            start[next] = Math.Max(start[next], finish[task]);   // Wait for the slowest prerequisite
    }

    return finish;
}
```

Give the figure's steps durations in minutes of restore 1, compile 5, test 8, docs 3, pack 1, and publish 2, and publish finishes at 17. That is the length of the longest path through the graph, restore, compile, test, pack, publish, called the critical path. Shortening docs changes nothing, and shortening test shortens the whole build, until test gets 5 minutes faster and docs becomes the slower branch. `duration` needs an entry for every step. Project scheduling tools compute exactly this.

The same single pass finds shortest paths too. Relax each vertex's outgoing edges in topological order, and every vertex's distance is final when its turn comes. That runs in O(V + E), faster than Dijkstra, and it allows negative weights, because a graph with no cycles can't have a negative cycle.

### Depth-First Order

A depth-first search finishes a vertex only after it has finished everything reachable from it. So in a graph without cycles, listing vertices in reverse order of finishing puts every vertex before everything it points to:

```csharp
public static List<T> DepthFirstOrder<T>(Graph<T> graph) where T : notnull
{
    var visited = new HashSet<T>();
    var finished = new List<T>();

    foreach (T vertex in graph.Vertices)
        if (!visited.Contains(vertex))
            Visit(vertex);

    finished.Reverse();                      // Reverse finishing order is a topological order
    return finished;

    void Visit(T vertex)
    {
        visited.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
            if (!visited.Contains(next))
                Visit(next);
        finished.Add(vertex);                // Everything after vertex is already finished
    }
}
```

For the figure's graph this gives restore, compile, docs, test, pack, publish, which is also valid. Unlike Kahn's algorithm, this version doesn't detect a cycle. On a graph with one, it returns an order that breaks at least one edge. Run a directed cycle check first, or track in-progress vertices during the same search. Deep dependency chains can also overflow the stack, as with any recursive DFS.

---

## Minimum Spanning Trees

A spanning tree of a connected, undirected graph is a set of edges that connects every vertex with no cycles, which always takes exactly V − 1 edges. A **minimum spanning tree** (MST) is one whose total weight is as small as possible. It answers questions like "what is the cheapest set of cables that connects every building," where any route between two buildings is acceptable as long as one exists.

Both classic algorithms are greedy, and both rest on the same fact, called the cut property. Split the vertices into any two groups, and the cheapest edge crossing between the groups belongs to some minimum spanning tree. Adding cheap edges that join separate pieces can therefore never go wrong.

### Union-Find

Kruskal's algorithm needs to ask "are these two vertices already connected?" thousands of times while connections are being added. A union-find structure, also called a disjoint-set structure, answers that almost instantly. It keeps each group as a tree of parent pointers, and the root of the tree names the group. `Find` follows parent pointers up to the root, and `Union` joins two groups by pointing one root at the other. Each root also keeps a rank, an upper bound on its tree's height.

```csharp
public class UnionFind
{
    private readonly int[] _parent;
    private readonly int[] _rank;

    public UnionFind(int size)
    {
        _parent = new int[size];
        _rank = new int[size];
        for (int i = 0; i < size; i++)
            _parent[i] = i;                      // Every element starts as its own set
    }

    public int Find(int x)
    {
        if (_parent[x] != x)
            _parent[x] = Find(_parent[x]);       // Path compression: point straight at the root
        return _parent[x];
    }

    public bool Union(int a, int b)
    {
        int rootA = Find(a), rootB = Find(b);
        if (rootA == rootB)
            return false;                        // Already in the same set

        if (_rank[rootA] < _rank[rootB])
            (rootA, rootB) = (rootB, rootA);
        _parent[rootB] = rootA;                  // Union by rank: hang the lower-ranked tree under the higher
        if (_rank[rootA] == _rank[rootB])
            _rank[rootA]++;
        return true;
    }
}
```

Two techniques keep the trees flat. Union by rank attaches the tree with the lower rank under the one with the higher, so trees grow slowly. Path compression makes every element on a `Find` path point directly at the root, so the next lookup is one step.

{% endraw %}
{% include figure.html id="dsa-union-find-compression" %}
{% raw %}

With both, a long sequence of operations costs O(α(n)) each, amortized over the sequence, where α is the inverse Ackermann function. It grows so slowly that it's at most 4 for any input that fits in memory, so each operation is effectively constant time.

Union-find is also the simplest way to track connected components in an undirected graph whose edges arrive one at a time. An edge whose `Union` returns `false` joins two vertices that were already connected, so it closes a cycle.

### Kruskal's Algorithm

Kruskal's algorithm sorts the edges by weight and walks through them, cheapest first. It keeps an edge if it joins two separate pieces and skips it if both ends are already connected, since that edge would close a cycle.

{% endraw %}
{% include figure.html id="dsa-kruskal-mst" %}
{% raw %}

```csharp
public static List<(int From, int To, int Weight)> Kruskal(int vertexCount, List<(int From, int To, int Weight)> edges)
{
    var tree = new List<(int From, int To, int Weight)>();
    var sets = new UnionFind(vertexCount);

    foreach (var edge in edges.OrderBy(e => e.Weight))
    {
        if (sets.Union(edge.From, edge.To))  // Joins two separate pieces, so it can't close a cycle
        {
            tree.Add(edge);
            if (tree.Count == vertexCount - 1)
                break;
        }
    }

    return tree;
}
```

Vertices are numbered 0 to `vertexCount − 1` so they can index the union-find arrays. The loop stops once it has V − 1 edges, so on the figure's graph the code never looks at C–E or C–D, though both would be skipped. Sorting dominates the cost, so Kruskal runs in O(E log E), which is the same as O(E log V). On a disconnected graph it returns a minimum spanning forest, one tree per component, with fewer than V − 1 edges.

### Prim's Algorithm

Prim's algorithm grows one tree from a starting vertex. At each step it adds the cheapest edge that leads from the tree to a vertex not yet in it. A priority queue holds the candidate edges:

```csharp
public static List<(T From, T To, int Weight)> Prim<T>(WeightedGraph<T> graph, T start) where T : notnull
{
    var tree = new List<(T From, T To, int Weight)>();
    var inTree = new HashSet<T> { start };
    var candidates = new PriorityQueue<(T From, T To, int Weight), int>();
    foreach (var (to, weight) in graph.Neighbors(start))
        candidates.Enqueue((start, to, weight), weight);

    while (candidates.TryDequeue(out var edge, out _))
    {
        if (!inTree.Add(edge.To))
            continue;                        // Both ends are already in the tree
        tree.Add(edge);
        foreach (var (to, weight) in graph.Neighbors(edge.To))
            if (!inTree.Contains(to))
                candidates.Enqueue((edge.To, to, weight), weight);
    }

    return tree;
}
```

This version runs in O(E log V). It works directly on the adjacency list and never sorts the whole edge list. On a dense graph, where E approaches V², a version that keeps each outside vertex's cheapest connecting edge in a plain array runs in O(V²), which beats both. Prim's algorithm spans only the start's component, so on a disconnected graph it returns fewer than V − 1 edges.

For the figure's graph, Prim from A picks A–C, C–B, B–D, and D–E, the same total of 10 that Kruskal found.

### A Minimum Spanning Tree Is Not a Shortest-Path Tree

The two figures use the same graph, and their trees differ. Dijkstra reaches E through C–E (weight 7), because A → C → E costs 9 and A → C → B → D → E would cost 10. The minimum spanning tree uses D–E (weight 2) instead, because it minimizes the total weight of the tree, not the distance from any one vertex. A network designed as a minimum spanning tree is the cheapest to build but can make some routes much longer than they need to be.

---

## Strongly Connected Components

In a directed graph, a strongly connected component is a group of vertices where every vertex can reach every other one. Groups of web pages that all link to each other, and groups of modules with circular dependencies between them, are examples. Collapsing each component into one vertex leaves a graph with no cycles, which is often the first step in analyzing the rest.

Kosaraju's algorithm finds them with two depth-first passes. The first pass records the order in which vertices finish. The second reverses every edge and searches again, starting each new search from the latest finisher not yet assigned. Reversing the edges keeps each component intact, since mutual reachability survives reversal. The finishing order is what stops a search from spilling into other components. The vertex that finishes last lies in a component that no other component has edges into. Reversed, that component has no edges out to other components, so a search started there covers exactly that component. Each later search starts in the next such component among those left.

```csharp
public static List<List<T>> StronglyConnected<T>(Graph<T> graph) where T : notnull
{
    // Pass 1: record the order in which vertices finish
    var visited = new HashSet<T>();
    var finished = new Stack<T>();
    foreach (T vertex in graph.Vertices)
        if (!visited.Contains(vertex))
            Finish(vertex);

    // Reverse every edge
    var reversed = new Graph<T>(directed: true);
    foreach (T vertex in graph.Vertices)
    {
        reversed.AddVertex(vertex);
        foreach (T next in graph.Neighbors(vertex))
            reversed.AddEdge(next, vertex);
    }

    // Pass 2: search the reversed graph, latest finisher first
    visited.Clear();
    var components = new List<List<T>>();
    foreach (T vertex in finished)           // A Stack enumerates from the top, latest first
    {
        if (visited.Contains(vertex)) continue;
        var component = new List<T>();
        Collect(vertex, component);
        components.Add(component);
    }
    return components;

    void Finish(T vertex)
    {
        visited.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
            if (!visited.Contains(next))
                Finish(next);
        finished.Push(vertex);
    }

    void Collect(T vertex, List<T> component)
    {
        visited.Add(vertex);
        component.Add(vertex);
        foreach (T next in reversed.Neighbors(vertex))
            if (!visited.Contains(next))
                Collect(next, component);
    }
}
```

With edges 1 → 2, 2 → 3, 3 → 1, 3 → 4, 4 → 5, and 5 → 4, it finds two components, {1, 2, 3} and {4, 5}. A vertex on no cycle is a component by itself. The algorithm runs in O(V + E). Tarjan's algorithm finds the same components in a single pass, at the cost of more bookkeeping.

---

## Maximum Flow

A flow network is a directed graph where each edge has a capacity, such as pipes with a maximum throughput or links with a maximum bandwidth. The maximum flow is the most that can move from a source vertex to a sink vertex. No edge may carry more than its capacity, and everything flowing into an intermediate vertex has to flow out.

The Ford-Fulkerson method repeats one step. Find a path from source to sink with spare capacity on every edge, called an augmenting path, push as much as its tightest edge allows, and update the spare capacities. The idea that makes this work is the reverse edge. Pushing flow along u → v adds the same amount of spare capacity on v → u, so a later path can send flow back and undo an earlier choice that turned out to block a better one. The figure shows it with a poorly chosen first path, the kind plain Ford-Fulkerson might pick. The spare capacities, including these reverse ones, are called the residual graph.

{% endraw %}
{% include figure.html id="dsa-max-flow-reverse-edge" %}
{% raw %}

Choosing each path with breadth-first search, so it has the fewest edges, is the Edmonds-Karp algorithm:

```csharp
public static int MaxFlow(int[,] capacity, int source, int sink)
{
    int n = capacity.GetLength(0);
    var residual = (int[,])capacity.Clone();  // Capacity still unused on each edge
    var cameFrom = new int[n];
    int total = 0;

    while (FindPath())
    {
        int bottleneck = int.MaxValue;         // The path can carry only what its tightest edge allows
        for (int v = sink; v != source; v = cameFrom[v])
            bottleneck = Math.Min(bottleneck, residual[cameFrom[v], v]);

        for (int v = sink; v != source; v = cameFrom[v])
        {
            residual[cameFrom[v], v] -= bottleneck;
            residual[v, cameFrom[v]] += bottleneck;   // Allow a later path to push this flow back
        }
        total += bottleneck;
    }

    return total;

    bool FindPath()                            // BFS for a path with spare capacity on every edge
    {
        var visited = new bool[n];
        var queue = new Queue<int>();
        queue.Enqueue(source);
        visited[source] = true;

        while (queue.TryDequeue(out int u))
        {
            for (int v = 0; v < n; v++)
            {
                if (visited[v] || residual[u, v] <= 0) continue;
                visited[v] = true;
                cameFrom[v] = u;
                if (v == sink) return true;
                queue.Enqueue(v);
            }
        }
        return false;
    }
}
```

The capacities are an adjacency matrix because the residual graph needs a slot for every reverse edge. Edmonds-Karp needs at most O(V × E) augmenting paths, so it runs in O(V × E²) with adjacency lists. This matrix version pays O(V²) per search instead. Choosing paths without breadth-first search can take far longer, since the number of augmenting paths is then bounded only by the size of the flow.

When no path with spare capacity remains, the flow is maximum. The vertices the last search reached and the ones it didn't split the network in two, and the edges crossing that split are all full. Their total capacity equals the maximum flow. This is the max-flow min-cut theorem. The maximum flow through a network equals the capacity of its narrowest cut, so the same algorithm finds the bottleneck.

Many problems that don't look like flow reduce to it. Matching workers to jobs they're qualified for is a flow problem on a bipartite graph, one whose vertices split into two groups with every edge running between the groups. Add a source linked to every worker and a sink linked from every job, give every edge capacity 1, and the maximum flow is the largest number of matches.

---

## Graph Coloring

Coloring a graph means giving each vertex a color so that no edge joins two vertices of the same color, using as few colors as possible. Conflicts become edges and resources become colors. Exams that share a student can't share a time slot, and variables that are in use at the same moment can't share a processor register.

Finding the minimum number of colors is NP-hard. Even deciding whether three colors are enough has no known efficient algorithm. The practical approach is greedy. Visit the vertices in some order and give each the smallest color none of its neighbors has.

```csharp
public static Dictionary<T, int> GreedyColoring<T>(Graph<T> graph) where T : notnull
{
    var color = new Dictionary<T, int>();

    foreach (T vertex in graph.Vertices)
    {
        var taken = new HashSet<int>();
        foreach (T next in graph.Neighbors(vertex))
            if (color.TryGetValue(next, out int c))
                taken.Add(c);

        int pick = 0;
        while (taken.Contains(pick))
            pick++;                            // The smallest color no neighbor uses
        color[vertex] = pick;
    }

    return color;
}
```

It runs in O(V + E) and never uses more than one color more than the largest degree in the graph. The result depends heavily on the visiting order. On a graph built from two groups of four vertices, where each vertex links to every vertex in the other group except its partner, one order used the optimal 2 colors and another used 4. Common orderings visit the highest-degree vertices first.

---

## Complexity Summary

| Algorithm | Solves | Time | Requirements and notes |
| --- | --- | --- | --- |
| Dijkstra | Shortest paths from one start | O((V + E) log V) | Weights zero or more |
| A* | Shortest path to one goal | O((V + E) log V) at worst, often far less | Weights zero or more, and a consistent distance estimate |
| Bellman-Ford | Shortest paths from one start | O(V × E) | Directed edges if any weight is negative. Reports a reachable negative cycle |
| Relaxation in topological order | Shortest or longest paths from one start | O(V + E) | A directed graph with no cycles |
| Floyd-Warshall | Shortest paths between all pairs | O(V³) | No negative cycles |
| Kahn's algorithm | Topological order | O(V + E) | A directed graph. Reports a cycle |
| Kruskal | Minimum spanning tree | O(E log E) | An undirected graph. Gives a forest if it is disconnected |
| Prim | Minimum spanning tree | O(E log V) with a heap, O(V²) with an array | An undirected graph. Spans the start's component only |
| Kosaraju | Strongly connected components | O(V + E) | A directed graph |
| Edmonds-Karp | Maximum flow | O(V × E²) | Directed edges with capacities |
| Greedy coloring | A valid coloring, not always the fewest colors | O(V + E) | An undirected graph |

{% endraw %}
