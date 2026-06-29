---
title: "Advanced Graph Algorithms"
category: Data Structures & Algorithms
description: "Advanced graph algorithms including Dijkstra's shortest path, topological sorting, minimum spanning trees, and network flow problems with practical implementations."
tags: [data-structures, algorithms, graphs, advanced, optimization]
---

## Shortest Path Algorithms

### Dijkstra's Algorithm

*Conceived by Edsger W. Dijkstra in 1956, published in 1959. Dijkstra reportedly designed it in 20 minutes while shopping with his fiancée.*

**When to use:** Finding shortest path in weighted graphs with non-negative weights

**Key properties:**
- Greedy algorithm that always selects nearest unvisited vertex
- Guarantees shortest path when all edge weights are non-negative
- Time: O((V + E) log V) with priority queue, O(V²) with array
- Cannot handle negative edge weights (use Bellman-Ford instead)

```csharp
public static class ShortestPath
{
    public static Dictionary<int, int> Dijkstra(WeightedGraph graph, int startVertex, List<int> allVertices)
    {
        var distances = new Dictionary<int, int>();
        var visited = new HashSet<int>();
        var priorityQueue = new PriorityQueue<int, int>();

        // Initialize distances
        foreach (int vertex in allVertices)
        {
            distances[vertex] = int.MaxValue;
        }
        distances[startVertex] = 0;

        priorityQueue.Enqueue(startVertex, 0);

        while (priorityQueue.Count > 0)
        {
            int current = priorityQueue.Dequeue();

            if (visited.Contains(current)) continue;
            visited.Add(current);

            foreach (var edge in graph.GetNeighbors(current))
            {
                int neighbor = edge.Destination;
                int newDistance = distances[current] + edge.Weight;

                if (newDistance < distances[neighbor])
                {
                    distances[neighbor] = newDistance;
                    priorityQueue.Enqueue(neighbor, newDistance);
                }
            }
        }

        return distances;
    }

    // Get actual path, not just distances
    public static List<int> DijkstraPath(WeightedGraph graph, int start, int end, List<int> allVertices)
    {
        var distances = new Dictionary<int, int>();
        var previous = new Dictionary<int, int>();
        var visited = new HashSet<int>();
        var priorityQueue = new PriorityQueue<int, int>();

        foreach (int vertex in allVertices)
        {
            distances[vertex] = int.MaxValue;
        }
        distances[start] = 0;

        priorityQueue.Enqueue(start, 0);

        while (priorityQueue.Count > 0)
        {
            int current = priorityQueue.Dequeue();

            if (current == end) break;
            if (visited.Contains(current)) continue;
            visited.Add(current);

            foreach (var edge in graph.GetNeighbors(current))
            {
                int neighbor = edge.Destination;
                int newDistance = distances[current] + edge.Weight;

                if (newDistance < distances[neighbor])
                {
                    distances[neighbor] = newDistance;
                    previous[neighbor] = current;
                    priorityQueue.Enqueue(neighbor, newDistance);
                }
            }
        }

        // Reconstruct path
        var path = new List<int>();
        int currentNode = end;

        while (previous.ContainsKey(currentNode))
        {
            path.Add(currentNode);
            currentNode = previous[currentNode];
        }
        path.Add(start);
        path.Reverse();

        return path;
    }
}
```

### A* Search Algorithm

*Developed by Peter Hart, Nils Nilsson, and Bertram Raphael at Stanford Research Institute in 1968*

**When to use:** Pathfinding with heuristic knowledge (games, GPS navigation, robotics)

**Key properties:**
- Extension of Dijkstra that uses heuristic to guide search toward goal
- f(n) = g(n) + h(n), where g = actual cost from start, h = estimated cost to goal
- Optimal if heuristic is admissible (never overestimates) and consistent
- Much faster than Dijkstra when good heuristic available
- Common heuristics: Manhattan distance (grid), Euclidean distance (2D/3D space)

```csharp
public static class AStar
{
    public class Node
    {
        public int Vertex { get; set; }
        public int GScore { get; set; }  // Distance from start
        public int FScore { get; set; }  // GScore + heuristic
        public Node Parent { get; set; }

        public Node(int vertex)
        {
            Vertex = vertex;
            GScore = int.MaxValue;
            FScore = int.MaxValue;
        }
    }

    public static List<int> AStarSearch(WeightedGraph graph, int start, int goal,
                                       Func<int, int, int> heuristic, List<int> allVertices)
    {
        var openSet = new PriorityQueue<Node, int>();
        var allNodes = new Dictionary<int, Node>();
        var openSetHash = new HashSet<int>();

        // Initialize nodes
        foreach (int vertex in allVertices)
        {
            allNodes[vertex] = new Node(vertex);
        }

        allNodes[start].GScore = 0;
        allNodes[start].FScore = heuristic(start, goal);

        openSet.Enqueue(allNodes[start], allNodes[start].FScore);
        openSetHash.Add(start);

        while (openSet.Count > 0)
        {
            var current = openSet.Dequeue();
            openSetHash.Remove(current.Vertex);

            if (current.Vertex == goal)
            {
                return ReconstructPath(current);
            }

            foreach (var edge in graph.GetNeighbors(current.Vertex))
            {
                var neighbor = allNodes[edge.Destination];
                int tentativeGScore = current.GScore + edge.Weight;

                if (tentativeGScore < neighbor.GScore)
                {
                    neighbor.Parent = current;
                    neighbor.GScore = tentativeGScore;
                    neighbor.FScore = neighbor.GScore + heuristic(neighbor.Vertex, goal);

                    if (!openSetHash.Contains(neighbor.Vertex))
                    {
                        openSet.Enqueue(neighbor, neighbor.FScore);
                        openSetHash.Add(neighbor.Vertex);
                    }
                }
            }
        }

        return new List<int>(); // No path found
    }

    private static List<int> ReconstructPath(Node node)
    {
        var path = new List<int>();
        var current = node;

        while (current != null)
        {
            path.Add(current.Vertex);
            current = current.Parent;
        }

        path.Reverse();
        return path;
    }

    // Example heuristic for grid-based pathfinding (Manhattan distance)
    public static int ManhattanDistance(int vertex1, int vertex2, int gridWidth)
    {
        int x1 = vertex1 % gridWidth, y1 = vertex1 / gridWidth;
        int x2 = vertex2 % gridWidth, y2 = vertex2 / gridWidth;
        return Math.Abs(x1 - x2) + Math.Abs(y1 - y2);
    }
}
```

---

## Minimum Spanning Trees

### Kruskal's Algorithm
**When to use:** Finding minimum spanning tree for connecting all vertices with minimum total edge weight

```csharp
public static class MinimumSpanningTree
{
    public class Edge : IComparable<Edge>
    {
        public int Source { get; set; }
        public int Destination { get; set; }
        public int Weight { get; set; }

        public Edge(int source, int destination, int weight)
        {
            Source = source;
            Destination = destination;
            Weight = weight;
        }

        public int CompareTo(Edge other)
        {
            return Weight.CompareTo(other.Weight);
        }
    }

    public static List<Edge> KruskalMST(List<Edge> edges, int vertexCount)
    {
        var result = new List<Edge>();
        var unionFind = new UnionFind(vertexCount);

        // Sort edges by weight
        edges.Sort();

        foreach (var edge in edges)
        {
            if (unionFind.Find(edge.Source) != unionFind.Find(edge.Destination))
            {
                result.Add(edge);
                unionFind.Union(edge.Source, edge.Destination);

                // MST has exactly V-1 edges
                if (result.Count == vertexCount - 1)
                    break;
            }
        }

        return result;
    }
}

// Union-Find data structure for Kruskal's algorithm
public class UnionFind
{
    private int[] parent;
    private int[] rank;

    public UnionFind(int size)
    {
        parent = new int[size];
        rank = new int[size];

        for (int i = 0; i < size; i++)
        {
            parent[i] = i;
            rank[i] = 0;
        }
    }

    public int Find(int x)
    {
        if (parent[x] != x)
        {
            parent[x] = Find(parent[x]); // Path compression
        }
        return parent[x];
    }

    public void Union(int x, int y)
    {
        int rootX = Find(x);
        int rootY = Find(y);

        if (rootX != rootY)
        {
            // Union by rank
            if (rank[rootX] < rank[rootY])
            {
                parent[rootX] = rootY;
            }
            else if (rank[rootX] > rank[rootY])
            {
                parent[rootY] = rootX;
            }
            else
            {
                parent[rootY] = rootX;
                rank[rootX]++;
            }
        }
    }
}
```

### Prim's Algorithm
**When to use:** Alternative MST algorithm, especially when graph is dense

```csharp
public static List<MinimumSpanningTree.Edge> PrimMST(WeightedGraph graph, List<int> allVertices)
{
    if (allVertices.Count == 0) return new List<MinimumSpanningTree.Edge>();

    var result = new List<MinimumSpanningTree.Edge>();
    var visited = new HashSet<int>();
    var priorityQueue = new PriorityQueue<MinimumSpanningTree.Edge, int>();

    // Start from first vertex
    int startVertex = allVertices[0];
    visited.Add(startVertex);

    // Add all edges from start vertex to priority queue
    foreach (var edge in graph.GetNeighbors(startVertex))
    {
        priorityQueue.Enqueue(
            new MinimumSpanningTree.Edge(startVertex, edge.Destination, edge.Weight),
            edge.Weight
        );
    }

    while (priorityQueue.Count > 0 && visited.Count < allVertices.Count)
    {
        var minEdge = priorityQueue.Dequeue();

        if (visited.Contains(minEdge.Destination))
            continue;

        // Add edge to MST
        result.Add(minEdge);
        visited.Add(minEdge.Destination);

        // Add all edges from new vertex
        foreach (var edge in graph.GetNeighbors(minEdge.Destination))
        {
            if (!visited.Contains(edge.Destination))
            {
                priorityQueue.Enqueue(
                    new MinimumSpanningTree.Edge(minEdge.Destination, edge.Destination, edge.Weight),
                    edge.Weight
                );
            }
        }
    }

    return result;
}
```

---

## Advanced Graph Problems

### Strongly Connected Components (Kosaraju's Algorithm)
**When to use:** Finding strongly connected components in directed graphs

```csharp
public static class StronglyConnectedComponents
{
    public static List<List<int>> FindSCC(Graph directedGraph, List<int> allVertices)
    {
        var visited = new HashSet<int>();
        var finishStack = new Stack<int>();

        // Step 1: Fill vertices in stack according to their finishing times
        foreach (int vertex in allVertices)
        {
            if (!visited.Contains(vertex))
            {
                DFSFillOrder(directedGraph, vertex, visited, finishStack);
            }
        }

        // Step 2: Create transpose graph
        var transposeGraph = GetTranspose(directedGraph, allVertices);

        // Step 3: Do DFS according to order defined in stack
        visited.Clear();
        var sccs = new List<List<int>>();

        while (finishStack.Count > 0)
        {
            int vertex = finishStack.Pop();
            if (!visited.Contains(vertex))
            {
                var scc = new List<int>();
                DFSUtil(transposeGraph, vertex, visited, scc);
                sccs.Add(scc);
            }
        }

        return sccs;
    }

    private static void DFSFillOrder(Graph graph, int vertex, HashSet<int> visited, Stack<int> stack)
    {
        visited.Add(vertex);

        foreach (int neighbor in graph.GetNeighbors(vertex))
        {
            if (!visited.Contains(neighbor))
            {
                DFSFillOrder(graph, neighbor, visited, stack);
            }
        }

        stack.Push(vertex);
    }

    private static Graph GetTranspose(Graph graph, List<int> allVertices)
    {
        var transpose = new Graph();

        foreach (int vertex in allVertices)
        {
            transpose.AddVertex(vertex);
        }

        foreach (int vertex in allVertices)
        {
            foreach (int neighbor in graph.GetNeighbors(vertex))
            {
                transpose.AddEdge(neighbor, vertex, false); // Reverse the edge
            }
        }

        return transpose;
    }

    private static void DFSUtil(Graph graph, int vertex, HashSet<int> visited, List<int> component)
    {
        visited.Add(vertex);
        component.Add(vertex);

        foreach (int neighbor in graph.GetNeighbors(vertex))
        {
            if (!visited.Contains(neighbor))
            {
                DFSUtil(graph, neighbor, visited, component);
            }
        }
    }
}
```

### Network Flow (Ford-Fulkerson Algorithm)
**When to use:** Maximum flow problems, bipartite matching, capacity constraints

```csharp
public static class NetworkFlow
{
    public static int MaxFlow(int[,] capacity, int source, int sink)
    {
        int vertices = capacity.GetLength(0);
        int[,] residualGraph = new int[vertices, vertices];

        // Create residual graph
        for (int i = 0; i < vertices; i++)
        {
            for (int j = 0; j < vertices; j++)
            {
                residualGraph[i, j] = capacity[i, j];
            }
        }

        int[] parent = new int[vertices];
        int maxFlowValue = 0;

        // While there exists an augmenting path
        while (BFS(residualGraph, source, sink, parent))
        {
            // Find minimum residual capacity along the path
            int pathFlow = int.MaxValue;
            for (int v = sink; v != source; v = parent[v])
            {
                int u = parent[v];
                pathFlow = Math.Min(pathFlow, residualGraph[u, v]);
            }

            // Add path flow to overall flow
            maxFlowValue += pathFlow;

            // Update residual capacities
            for (int v = sink; v != source; v = parent[v])
            {
                int u = parent[v];
                residualGraph[u, v] -= pathFlow;
                residualGraph[v, u] += pathFlow;
            }
        }

        return maxFlowValue;
    }

    private static bool BFS(int[,] residualGraph, int source, int sink, int[] parent)
    {
        int vertices = residualGraph.GetLength(0);
        bool[] visited = new bool[vertices];
        var queue = new Queue<int>();

        queue.Enqueue(source);
        visited[source] = true;
        parent[source] = -1;

        while (queue.Count > 0)
        {
            int u = queue.Dequeue();

            for (int v = 0; v < vertices; v++)
            {
                if (!visited[v] && residualGraph[u, v] > 0)
                {
                    if (v == sink)
                    {
                        parent[v] = u;
                        return true;
                    }

                    queue.Enqueue(v);
                    visited[v] = true;
                    parent[v] = u;
                }
            }
        }

        return false;
    }
}
```

---

## Graph Coloring

### Basic Graph Coloring (Greedy Approach)
**When to use:** Scheduling problems, register allocation, map coloring

```csharp
public static class GraphColoring
{
    public static Dictionary<int, int> GreedyColoring(Graph graph, List<int> allVertices)
    {
        var coloring = new Dictionary<int, int>();
        var availableColors = new bool[allVertices.Count];

        // Assign first color to first vertex
        if (allVertices.Count > 0)
        {
            coloring[allVertices[0]] = 0;
        }

        // Assign colors to remaining vertices
        for (int i = 1; i < allVertices.Count; i++)
        {
            int vertex = allVertices[i];

            // Mark colors of adjacent vertices as unavailable
            Array.Fill(availableColors, true);
            foreach (int neighbor in graph.GetNeighbors(vertex))
            {
                if (coloring.ContainsKey(neighbor))
                {
                    int neighborColor = coloring[neighbor];
                    if (neighborColor < availableColors.Length)
                    {
                        availableColors[neighborColor] = false;
                    }
                }
            }

            // Find first available color
            for (int color = 0; color < availableColors.Length; color++)
            {
                if (availableColors[color])
                {
                    coloring[vertex] = color;
                    break;
                }
            }
        }

        return coloring;
    }

    public static bool IsValidColoring(Graph graph, Dictionary<int, int> coloring)
    {
        foreach (var vertex in coloring.Keys)
        {
            foreach (int neighbor in graph.GetNeighbors(vertex))
            {
                if (coloring.ContainsKey(neighbor) && coloring[vertex] == coloring[neighbor])
                {
                    return false;
                }
            }
        }
        return true;
    }
}
```

---

## Time Complexity Summary

| Algorithm | Time Complexity | Space Complexity | Use Case |
|-----------|----------------|------------------|----------|
| **Dijkstra** | O((V + E) log V) | O(V) | Shortest path, non-negative weights |
| **A*** | O((V + E) log V) | O(V) | Pathfinding with heuristic |
| **Kruskal's MST** | O(E log E) | O(V) | Minimum spanning tree |
| **Prim's MST** | O((V + E) log V) | O(V) | Minimum spanning tree (dense graphs) |
| **Kosaraju SCC** | O(V + E) | O(V) | Strongly connected components |
| **Ford-Fulkerson** | O(E × max_flow) | O(V²) | Maximum flow |
| **Graph Coloring** | O(V²) | O(V) | Vertex coloring |

---

## Real-World Applications

### GPS Navigation Systems
- **Dijkstra/A*:** Find shortest/fastest route
- **Dynamic programming:** Handle real-time traffic updates
- **Preprocessing:** Precompute common routes for faster queries

### Social Network Analysis
- **BFS:** Find degrees of separation
- **Connected components:** Identify communities
- **PageRank algorithm:** Rank user influence

### Network Infrastructure
- **MST algorithms:** Design efficient network topology
- **Maximum flow:** Optimize data transmission capacity
- **Graph coloring:** Assign frequencies to avoid interference

### Compiler Design
- **Topological sort:** Resolve dependencies
- **Graph coloring:** Register allocation
- **DFS:** Detect circular dependencies

---

## Quick Reference

### Advanced Algorithm Comparison
| Algorithm | Time | Space | Use Case |
|-----------|------|-------|----------|
| **Dijkstra** | O((V+E) log V) | O(V) | Shortest path, non-negative weights |
| **Bellman-Ford** | O(VE) | O(V) | Shortest path, negative edges allowed |
| **Floyd-Warshall** | O(V³) | O(V²) | All-pairs shortest paths |
| **Kruskal's MST** | O(E log E) | O(V) | Minimum spanning tree |
| **Prim's MST** | O((V+E) log V) | O(V) | Minimum spanning tree (dense) |
| **Ford-Fulkerson** | O(E × max_flow) | O(V) | Maximum flow |

### Algorithm Selection Guide
- **Single-source shortest path, no negative edges:** Dijkstra
- **Single-source, negative edges:** Bellman-Ford
- **All-pairs shortest path:** Floyd-Warshall
- **Minimum spanning tree (sparse):** Kruskal's
- **Minimum spanning tree (dense):** Prim's
- **Maximum flow:** Ford-Fulkerson or Edmonds-Karp

---