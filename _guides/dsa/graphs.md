---
title: "Graph Fundamentals & Traversal"
layout: guide
category: Data Structures & Algorithms
subcategory: Graphs
description: "What graphs are and the vocabulary for them, how to store one as an adjacency list or matrix, and how breadth-first and depth-first search work: shortest paths in unweighted graphs, connected components, cycle detection, and grid problems."
tags: [graphs, bfs, dfs, adjacency-list, connected-components, cycle-detection, fundamentals]
---
{% raw %}

## Why Graphs Exist

A graph models things and the connections between them, when those connections don't form a neat hierarchy. People and friendships, cities and roads, web pages and links, packages and their dependencies all have this shape. A tree allows each item one parent and no loops. A graph drops both limits, so any item can connect to any other, and following connections can lead back to where it started.

Once a problem is a graph, a small set of algorithms answers a large set of questions. Can this reach that? What is the fewest hops between them? Which items form separate groups? Is there a loop in these dependencies? This guide covers the representation and the two searches, breadth-first and depth-first, that most of those answers are built on.

---

## Graph Vocabulary

A graph is a set of **vertices** (also called nodes) and a set of **edges**, each connecting two vertices. The usual shorthand is V for the number of vertices and E for the number of edges.

| Term | Meaning |
| --- | --- |
| Adjacent, neighbor | Two vertices joined by an edge are adjacent. Each is the other's neighbor |
| Degree | The number of edges touching a vertex. In a directed graph, in-degree counts edges arriving and out-degree counts edges leaving |
| Path | A sequence of vertices where each consecutive pair is joined by an edge. Its length is the number of edges. A simple path never repeats a vertex |
| Cycle | A path that starts and ends at the same vertex without reusing an edge |
| Connected | An undirected graph is connected if a path joins every pair of vertices |
| Connected component | A group of vertices all joined to each other by paths, which can't be extended by adding another vertex. A disconnected graph has several |
| Self-loop | An edge from a vertex to itself |
| Sparse, dense | A sparse graph has far fewer edges than the V² maximum. A dense one has close to it |

Two independent choices describe a graph's edges:

| | Meaning | Examples |
| --- | --- | --- |
| **Undirected** | An edge joins two vertices both ways | Friendships, roads that carry traffic both ways, network cables |
| **Directed** | An edge points from one vertex to another | Follows on a social network, links between web pages, "must be built before" |
| **Unweighted** | Every edge counts the same | Friendships, links |
| **Weighted** | Each edge carries a number, such as a distance, cost, or latency | Road distances, network latency |

A directed graph with no cycles is a **directed acyclic graph** (DAG). Build dependencies and course prerequisites are DAGs when they're valid, and a cycle in such a graph is a bug. It means two tasks that each have to finish before the other can start.

A tree is a special graph: connected, undirected, and without cycles. Those rules force it to have exactly V − 1 edges and exactly one simple path between any two vertices.

---

## Storing a Graph

Besides a plain list of edges, which suits algorithms that process edges one at a time, there are two standard representations. An **adjacency list** keeps, for each vertex, a list of its neighbors. An **adjacency matrix** is a V × V grid where the cell at row u, column v says whether an edge runs from u to v.

{% endraw %}
{% include figure.html id="dsa-graph-representations" %}
{% raw %}

| Operation | Adjacency list | Adjacency matrix |
| --- | --- | --- |
| Memory | O(V + E) | O(V²) |
| Is there an edge from u to v? | O(degree of u), or O(1) on average if neighbors are kept in a `HashSet` | O(1) |
| List u's neighbors | O(degree of u) | O(V), scanning the whole row |
| Add an edge | O(1) | O(1) |
| Add a vertex | O(1) | O(V²), copying into a larger grid |
| Full BFS or DFS | O(V + E) | O(V²) |

The difference that decides most choices is in the last row. Searches spend their time listing neighbors, and a matrix makes every vertex pay for a full row whether it has 3 neighbors or 3,000. Many real graphs are sparse, such as road networks, where a junction joins a handful of roads, and social networks, where one person knows a tiny fraction of everyone. For those, an adjacency list is the default. A matrix earns its V² memory when the graph is small or dense, or when the main question is "is there an edge between these two vertices?"

For an undirected graph, each edge is stored twice, once in each endpoint's list, and the matrix is symmetric. A weighted graph stores the weight in the list entry or the matrix cell instead of a plain yes or no.

### An Adjacency List in C#

.NET has no graph type in its base library, but a dictionary of lists is all an adjacency list needs:

```csharp
public class Graph<T> where T : notnull
{
    private readonly Dictionary<T, List<T>> _adjacency = new();

    public Graph(bool directed = false) => IsDirected = directed;

    public bool IsDirected { get; }

    public IEnumerable<T> Vertices => _adjacency.Keys;

    public void AddVertex(T vertex) => _adjacency.TryAdd(vertex, new List<T>());

    public void AddEdge(T from, T to)
    {
        AddVertex(from);
        AddVertex(to);
        _adjacency[from].Add(to);
        if (!IsDirected)
            _adjacency[to].Add(from);            // An undirected edge is stored in both lists
    }

    public IReadOnlyList<T> Neighbors(T vertex) => _adjacency[vertex];
}
```

Keying by the vertex itself lets the graph hold strings, IDs, or any type with sensible equality, and `AddVertex` exists separately so a vertex with no edges still belongs to the graph. The rest of this guide uses this class.

### Weighted Edges

A weighted graph stores each neighbor together with the edge's weight. Otherwise it matches `Graph<T>`:

```csharp
public class WeightedGraph<T> where T : notnull
{
    private readonly Dictionary<T, List<(T To, int Weight)>> _adjacency = new();

    public WeightedGraph(bool directed = false) => IsDirected = directed;

    public bool IsDirected { get; }

    public IEnumerable<T> Vertices => _adjacency.Keys;

    public void AddVertex(T vertex) => _adjacency.TryAdd(vertex, new());

    public void AddEdge(T from, T to, int weight)
    {
        AddVertex(from);
        AddVertex(to);
        _adjacency[from].Add((to, weight));
        if (!IsDirected)
            _adjacency[to].Add((from, weight));  // Undirected: the same weight both ways
    }

    public IReadOnlyList<(T To, int Weight)> Neighbors(T vertex) => _adjacency[vertex];
}
```

The searches below ignore weights and count edges. That makes their notion of "shortest" wrong for a weighted graph. With edges A–B of weight 4, A–C of weight 1, and C–B of weight 2, breadth-first search reports A → B as the shortest route because it has one edge, though A → C → B costs 3 instead of 4. Weighted shortest paths need different algorithms, such as Dijkstra's.

---

## Breadth-First and Depth-First Search

Both searches start at one vertex, visit everything reachable from it exactly once, and keep a set of visited vertices so a cycle can't send them around forever. They differ in which vertex they take next. Both take each vertex's neighbors in the order its edges were added, which is why the figure below visits B before C.

**Breadth-first search (BFS)** keeps a queue. It visits the start, then all of its neighbors, then all of their unvisited neighbors, spreading out in rings of increasing distance.

**Depth-first search (DFS)** keeps a stack, usually the call stack of a recursive function. It follows one neighbor, then that neighbor's first unvisited neighbor, and so on until it reaches a dead end, then backs up to the most recent vertex with an unvisited neighbor and continues from there.

{% endraw %}
{% include figure.html id="dsa-bfs-dfs-order" %}
{% raw %}

The code in the rest of this guide is written as static methods on a `Traversal` class, all using the `Graph<T>` above. `Neighbors` throws for a vertex that was never added, so each search expects its start vertex to be in the graph. Both searches are O(V + E) on an adjacency list. Each vertex is visited once, and each edge is looked at once from each end in an undirected graph, or once in a directed one. Both use O(V) memory for the visited set.

### Breadth-First Search

```csharp
public static List<T> BreadthFirst<T>(Graph<T> graph, T start) where T : notnull
{
    var visited = new HashSet<T> { start };
    var order = new List<T>();
    var queue = new Queue<T>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        T vertex = queue.Dequeue();
        order.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
        {
            if (visited.Add(next))           // Mark when queued, so nothing is queued twice
                queue.Enqueue(next);
        }
    }

    return order;
}
```

A vertex is marked visited when it enters the queue, not when it leaves. Marking on the way out lets a vertex with several already-queued neighbors be queued several times, which wastes work and can make the queue grow far past V.

### Shortest Paths in an Unweighted Graph

Because BFS finishes every vertex at distance d before it starts on distance d + 1, the first time it reaches a vertex is along a path with the fewest possible edges. Recording which vertex each one was reached from turns that into a route:

```csharp
public static List<T>? ShortestPath<T>(Graph<T> graph, T start, T goal) where T : notnull
{
    var cameFrom = new Dictionary<T, T>();   // Each reached vertex -> the vertex it was reached from
    var visited = new HashSet<T> { start };
    var queue = new Queue<T>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        T vertex = queue.Dequeue();
        if (EqualityComparer<T>.Default.Equals(vertex, goal))
        {
            var path = new List<T> { vertex };
            while (cameFrom.TryGetValue(vertex, out T? previous))
            {
                path.Add(previous);
                vertex = previous;
            }
            path.Reverse();
            return path;
        }

        foreach (T next in graph.Neighbors(vertex))
        {
            if (visited.Add(next))
            {
                cameFrom[next] = vertex;
                queue.Enqueue(next);
            }
        }
    }

    return null;                             // goal can't be reached from start
}
```

For the graph in the visit-order figure, `ShortestPath(graph, "A", "F")` returns A, C, F. The walk back stops at the start because the start is the one reached vertex with no `cameFrom` entry. Using a placeholder value such as `default(T)` to mean "no previous vertex" is a common bug. For a `Graph<int>`, `default(int)` is 0, which may be a real vertex.

Degrees of separation in a social network, the fewest moves to solve a puzzle, and the fewest hops between two routers are all this search. The number of edges in the path, one less than its vertex count, is the distance.

### Depth-First Search

The recursive form is the shortest to write:

```csharp
public static List<T> DepthFirst<T>(Graph<T> graph, T start) where T : notnull
{
    var visited = new HashSet<T>();
    var order = new List<T>();
    Visit(start);
    return order;

    void Visit(T vertex)
    {
        visited.Add(vertex);
        order.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
        {
            if (!visited.Contains(next))
                Visit(next);
        }
    }
}
```

The recursion can go as deep as the longest path the search follows, up to V calls, and on a large graph that can overflow the stack. An explicit `Stack<T>` avoids the limit:

```csharp
public static List<T> DepthFirstIterative<T>(Graph<T> graph, T start) where T : notnull
{
    var visited = new HashSet<T>();
    var order = new List<T>();
    var stack = new Stack<T>();
    stack.Push(start);

    while (stack.Count > 0)
    {
        T vertex = stack.Pop();
        if (!visited.Add(vertex))
            continue;                        // Already visited through another path
        order.Add(vertex);

        // Push in reverse so the first neighbor is popped first, matching the recursive order
        var neighbors = graph.Neighbors(vertex);
        for (int i = neighbors.Count - 1; i >= 0; i--)
        {
            if (!visited.Contains(neighbors[i]))
                stack.Push(neighbors[i]);
        }
    }

    return order;
}
```

This version checks for a visit when a vertex is popped, not when it's pushed, because a vertex pushed early may be reached by a deeper route first. That means a vertex can sit on the stack more than once, so the stack can grow to O(E) entries rather than O(V).

DFS doesn't find shortest paths. In the figure it reaches C through A, B, E, F, though C is A's neighbor. What DFS offers instead is structure. It fully explores everything reachable from a vertex through vertices not yet visited before it finishes that vertex, and the cycle checks below depend on that.

### Choosing Between Them

| The question | Use | Why |
| --- | --- | --- |
| Fewest edges from A to B | BFS | It reaches each vertex first by a shortest route |
| Everything within k hops | BFS | It works outward in rings of distance |
| Can A reach B at all? | Either | Both visit everything reachable. DFS is often simpler to write |
| Connected components | Either | Each search from an unvisited vertex covers one component |
| Is there a cycle? | DFS | In a directed graph it tracks the current path, which is what a cycle closes back onto |
| Exploring every possibility, as in a maze or puzzle | DFS | It finishes one line before trying the next, and backs up to the most recent choice when a line fails |

---

## Connected Components

Running a search from each vertex that hasn't been visited yet splits an undirected graph into its connected components. Each search covers exactly one component, and everything it reaches is marked, so the next search starts in a component not seen yet.

```csharp
public static List<List<T>> Components<T>(Graph<T> graph) where T : notnull
{
    var visited = new HashSet<T>();
    var components = new List<List<T>>();

    foreach (T vertex in graph.Vertices)
    {
        if (visited.Contains(vertex))
            continue;

        var component = new List<T>();      // A new component starts at each unvisited vertex
        var stack = new Stack<T>();
        stack.Push(vertex);
        visited.Add(vertex);

        while (stack.Count > 0)
        {
            T current = stack.Pop();
            component.Add(current);
            foreach (T next in graph.Neighbors(current))
            {
                if (visited.Add(next))
                    stack.Push(next);
            }
        }

        components.Add(component);
    }

    return components;
}
```

The whole loop is still O(V + E), since every vertex and edge is handled once across all the searches. The inner search uses a stack here but could use a queue. It only needs to reach everything, not in any particular order. Questions like "how many separate friend groups are there" or "which machines can still reach each other after this link fails" are this computation.

In a directed graph, "connected" splits into two ideas. A vertex can reach another without being reachable back, so components of mutual reachability, called strongly connected components, need a more involved algorithm.

---

## Cycle Detection

### In an Undirected Graph

During a DFS of an undirected graph, every neighbor of the current vertex is either unvisited, the vertex the search just came from, or some other visited vertex. The third case means there's a second route to that vertex, and that closes a cycle.

```csharp
public static bool HasCycleUndirected<T>(Graph<T> graph) where T : notnull
{
    var visited = new HashSet<T>();

    foreach (T vertex in graph.Vertices)
    {
        if (!visited.Contains(vertex) && Visit(vertex, parent: vertex))
            return true;
    }
    return false;

    bool Visit(T vertex, T parent)
    {
        visited.Add(vertex);
        foreach (T next in graph.Neighbors(vertex))
        {
            if (!visited.Contains(next))
            {
                if (Visit(next, parent: vertex))
                    return true;
            }
            else if (!EqualityComparer<T>.Default.Equals(next, parent))
            {
                return true;                 // A visited vertex other than the one we came from
            }
        }
        return false;
    }
}
```

The parent check is needed because every undirected edge appears in both lists. Without it, the edge just followed would look like a route back. The outer loop matters too, because a cycle may sit in a component the first search never reaches. Each search starts by passing the vertex as its own parent. The one case that misses is a self-loop on that starting vertex, since the loop looks like the edge back to the parent. A self-loop anywhere else is caught.

### In a Directed Graph

The undirected check fails on directed graphs. With edges A → B, A → C, and C → B, a search from A visits B, then reaches B again from C, though there's no cycle. B was already done, not on the current path from A to C.

The fix is to track three states instead of two. A vertex is unvisited, in progress while the search is still exploring below it, or done. The in-progress vertices are exactly the chain of recursive calls that led to the current vertex. So an edge to an in-progress vertex leads back into that chain and closes a cycle, and an edge to a done vertex doesn't, however many times that vertex is reached.

{% endraw %}
{% include figure.html id="dsa-directed-cycle-check" %}
{% raw %}

```csharp
private enum State { Unvisited, InProgress, Done }

public static bool HasCycleDirected<T>(Graph<T> graph) where T : notnull
{
    var state = new Dictionary<T, State>();

    foreach (T vertex in graph.Vertices)
    {
        if (state.GetValueOrDefault(vertex) == State.Unvisited && Visit(vertex))
            return true;
    }
    return false;

    bool Visit(T vertex)
    {
        state[vertex] = State.InProgress;
        foreach (T next in graph.Neighbors(vertex))
        {
            State s = state.GetValueOrDefault(next);
            if (s == State.InProgress)
                return true;                 // An edge back to a vertex still on the current path
            if (s == State.Unvisited && Visit(next))
                return true;
        }
        state[vertex] = State.Done;
        return false;
    }
}
```

This is how a build tool or package manager can tell that a set of dependencies can't be satisfied. A graph that passes the check is a DAG, and a DAG can be put into an order where every vertex comes after everything it depends on, called a topological order.

---

## Worked Problems

### Course Schedule

Given n courses and a list of pairs `[a, b]` meaning "take b before a", can every course be completed? Each pair is a directed edge from b to a. The courses can all be taken exactly when that graph has no cycle, so the answer is the directed cycle check:

```csharp
public static bool CanFinish(int courseCount, int[][] prerequisites)
{
    var graph = new Graph<int>(directed: true);
    for (int c = 0; c < courseCount; c++)
        graph.AddVertex(c);
    foreach (int[] pair in prerequisites)
        graph.AddEdge(pair[1], pair[0]);     // Take pair[1] before pair[0]

    return !Traversal.HasCycleDirected(graph);
}
```

Adding every course as a vertex first keeps courses with no prerequisites in the graph, so the check covers all of them.

### Number of Islands

A grid of `'1'` (land) and `'0'` (water) is a graph without an adjacency list. Each cell is a vertex, and its neighbors are the cells up, down, left, and right. Counting the islands, the groups of land cells joined side to side, is counting connected components:

```csharp
public static int CountIslands(char[][] grid)
{
    int rows = grid.Length;
    int cols = rows == 0 ? 0 : grid[0].Length;
    var visited = new bool[rows, cols];
    int islands = 0;
    (int, int)[] steps = { (1, 0), (-1, 0), (0, 1), (0, -1) };

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            if (grid[r][c] != '1' || visited[r, c])
                continue;

            islands++;                       // An unvisited land cell starts a new island
            var queue = new Queue<(int Row, int Col)>();
            queue.Enqueue((r, c));
            visited[r, c] = true;

            while (queue.Count > 0)
            {
                var (row, col) = queue.Dequeue();
                foreach (var (dr, dc) in steps)
                {
                    int nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols
                        && grid[nr][nc] == '1' && !visited[nr, nc])
                    {
                        visited[nr, nc] = true;
                        queue.Enqueue((nr, nc));
                    }
                }
            }
        }
    }

    return islands;
}
```

The neighbors are computed from coordinates instead of stored, and a `bool[,]` replaces the `HashSet` because cells are already numbered. The search is BFS on purpose. A recursive DFS is shorter, but a single island covering a 2,000 × 2,000 grid would nest millions of calls deep. The queue version handles it with heap memory. It runs in O(rows × cols).

### Cloning a Graph

Copying a graph of linked nodes means making a new node for every original and wiring the copies together the same way:

```csharp
public class Node
{
    public int Value { get; }
    public List<Node> Neighbors { get; } = new();
    public Node(int value) => Value = value;
}

public static Node? Clone(Node? node)
{
    if (node == null) return null;
    var copies = new Dictionary<Node, Node>();
    return Copy(node);

    Node Copy(Node original)
    {
        if (copies.TryGetValue(original, out Node? existing))
            return existing;                 // Already copied: reuse it, which also stops cycles

        var copy = new Node(original.Value);
        copies[original] = copy;             // Record before recursing into neighbors
        foreach (Node neighbor in original.Neighbors)
            copy.Neighbors.Add(Copy(neighbor));
        return copy;
    }
}
```

The dictionary from original to copy does two jobs. It is the visited set, and it makes sure every edge to the same original points at the same copy. Recording the copy before visiting the neighbors is what makes cycles work. When the search comes back around to a node, its copy already exists and is reused instead of copied again.

---

## Graphs in .NET

The base class library has no graph type, so most code builds one from `Dictionary` and `List` as above. That covers traversal, components, and cycle checks in a few dozen lines. For a wider set of algorithms, the open-source [QuikGraph](https://github.com/KeRNeLith/QuikGraph){:target="_blank" rel="noopener noreferrer"} library provides graph types with search, shortest-path, and flow algorithms, though its most recent release, 2.5.0, dates from July 2022. When the data itself is a large, persistent graph that many queries walk, such as a social network or a fraud-detection network, a graph database like Neo4j or Amazon Neptune stores it and runs traversals close to the data.

{% endraw %}
