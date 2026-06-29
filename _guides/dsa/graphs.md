---
title: "Graphs & Graph Algorithms"
category: Data Structures & Algorithms
description: "Complete guide to graphs covering representations, traversal algorithms (BFS/DFS), and applications from social networks to pathfinding problems."
tags: [data-structures, algorithms, graphs, practical, interview-prep]
---

## Why Graphs Exist
Model relationships and networks like social networks, maps, dependencies, state machines, and computer networks. Graphs are the most flexible data structure for representing complex relationships between entities.

## When to Use Graphs

**Use when:**
- Modeling relationships between entities
- Pathfinding and navigation problems
- Network analysis and flow problems
- Dependency resolution (build systems, package managers)
- State machines and game AI
- Social network analysis

**Don't use when:**
- Simple hierarchical data (use trees)
- No relationships between data points
- Linear or simple key-value relationships

**Modern reality:** Critical for many applications. Often use graph databases (Neo4j) or specialized libraries rather than implementing from scratch.

---

## Graph Types and Terminology

### Key Terms
- **Vertex (Node):** A point in the graph that holds data
- **Edge:** A connection between two vertices
- **Adjacent:** Two vertices connected by an edge
- **Path:** A sequence of edges connecting vertices
- **Cycle:** A path that begins and ends at the same vertex
- **Connected Graph:** Every vertex can reach every other vertex
- **Disconnected Graph:** Some vertices cannot reach others

### Graph Types

**Directed vs Undirected:**
- **Directed (Digraph):** Edges have direction (A → B ≠ B → A)
- **Undirected:** Edges are bidirectional (A ↔ B)

**Weighted vs Unweighted:**
- **Weighted:** Edges have associated costs/distances
- **Unweighted:** All edges have equal weight (or weight = 1)

**Examples:**
- **Social Network:** Undirected, unweighted (friendship is mutual)
- **Twitter Follows:** Directed, unweighted (following isn't mutual)
- **Road Map:** Undirected, weighted (roads have distances)
- **Web Pages:** Directed, unweighted (links point one way)

---

## Graph Representation

### Adjacency List vs Adjacency Matrix

| Aspect | Adjacency List | Adjacency Matrix |
|--------|----------------|------------------|
| **Space** | O(V + E) | O(V²) |
| **Add Vertex** | O(1) | O(V²) |
| **Add Edge** | O(1) | O(1) |
| **Check Edge** | O(degree) | O(1) |
| **Iterate Neighbors** | O(degree) | O(V) |
| **Best For** | Sparse graphs | Dense graphs |

**Use Adjacency List when:**
- Sparse graphs (few edges relative to vertices)
- Need to iterate through neighbors frequently
- Memory efficiency is important

**Use Adjacency Matrix when:**
- Dense graphs (many edges)
- Need fast edge existence checks
- Simple implementation is preferred

---

## Graph Implementation

### C# Implementation

#### Adjacency List Representation
```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class Vertex<T>
{
    public T Value { get; set; }
    public Dictionary<T, int> Edges { get; set; }

    public Vertex(T value)
    {
        Value = value;
        Edges = new Dictionary<T, int>();
    }

    public void AddEdge(T vertex, int weight = 1)
    {
        Edges[vertex] = weight;
    }

    public List<T> GetEdges()
    {
        return Edges.Keys.ToList();
    }
}

public class Graph<T>
{
    private Dictionary<T, Vertex<T>> graphDict;
    private bool directed;

    public Graph(bool directed = false)
    {
        graphDict = new Dictionary<T, Vertex<T>>();
        this.directed = directed;
    }

    public void AddVertex(Vertex<T> vertex)
    {
        graphDict[vertex.Value] = vertex;
    }

    public void AddEdge(Vertex<T> fromVertex, Vertex<T> toVertex, int weight = 1)
    {
        graphDict[fromVertex.Value].AddEdge(toVertex.Value, weight);

        // For undirected graphs, add edge in both directions
        if (!directed)
        {
            graphDict[toVertex.Value].AddEdge(fromVertex.Value, weight);
        }
    }

    public List<T> FindPathBFS(T startVertex, T endVertex)
    {
        var queue = new Queue<T>();
        var visited = new HashSet<T>();
        var parent = new Dictionary<T, T>();

        queue.Enqueue(startVertex);
        parent[startVertex] = default(T);

        while (queue.Count > 0)
        {
            T currentVertex = queue.Dequeue();

            if (visited.Contains(currentVertex))
                continue;

            visited.Add(currentVertex);
            Console.WriteLine($"Visiting {currentVertex}");

            if (currentVertex.Equals(endVertex))
            {
                // Reconstruct path
                var path = new List<T>();
                var current = currentVertex;

                while (!EqualityComparer<T>.Default.Equals(current, default(T)))
                {
                    path.Add(current);
                    current = parent[current];
                }

                path.Reverse();
                return path;
            }

            // Add unvisited neighbors to queue
            var neighbors = graphDict[currentVertex].Edges.Keys;
            foreach (var neighbor in neighbors)
            {
                if (!visited.Contains(neighbor) && !parent.ContainsKey(neighbor))
                {
                    parent[neighbor] = currentVertex;
                    queue.Enqueue(neighbor);
                }
            }
        }

        return null; // No path found
    }

    public List<T> FindPathDFS(T startVertex, T endVertex, HashSet<T> visited = null, List<T> path = null)
    {
        if (visited == null)
            visited = new HashSet<T>();
        if (path == null)
            path = new List<T>();

        visited.Add(startVertex);
        path.Add(startVertex);
        Console.WriteLine($"Visiting {startVertex}");

        if (startVertex.Equals(endVertex))
        {
            return new List<T>(path); // Return copy of path
        }

        var neighbors = graphDict[startVertex].Edges.Keys;
        foreach (var neighbor in neighbors)
        {
            if (!visited.Contains(neighbor))
            {
                var newVisited = new HashSet<T>(visited);
                var newPath = new List<T>(path);
                var result = FindPathDFS(neighbor, endVertex, newVisited, newPath);
                if (result != null)
                {
                    return result;
                }
            }
        }

        return null; // No path found
    }

    public void PrintGraph()
    {
        foreach (var kvp in graphDict)
        {
            var vertex = kvp.Value;
            Console.WriteLine($"{vertex.Value} connects to:");

            if (vertex.Edges.Count == 0)
            {
                Console.WriteLine("  No connections");
            }
            else
            {
                foreach (var edge in vertex.Edges)
                {
                    Console.WriteLine($"  -> {edge.Key} (weight: {edge.Value})");
                }
            }
        }
    }

    public IEnumerable<T> GetVertices()
    {
        return graphDict.Keys;
    }

    public IEnumerable<(T neighbor, int weight)> GetNeighbors(T vertex)
    {
        if (graphDict.ContainsKey(vertex))
        {
            return graphDict[vertex].Edges.Select(kvp => (kvp.Key, kvp.Value));
        }
        return Enumerable.Empty<(T, int)>();
    }
}

// Example usage
class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine("Creating a transportation network:");
        var graph = new Graph<string>(directed: false);

        // Create vertices (cities)
        string[] cities = {"New York", "Los Angeles", "Chicago", "Houston", "Phoenix"};
        var cityVertices = new Dictionary<string, Vertex<string>>();

        foreach (var city in cities)
        {
            var vertex = new Vertex<string>(city);
            cityVertices[city] = vertex;
            graph.AddVertex(vertex);
        }

        // Add edges (routes with distances)
        var routes = new[]
        {
            ("New York", "Chicago", 790),
            ("New York", "Houston", 1630),
            ("Los Angeles", "Phoenix", 370),
            ("Los Angeles", "Houston", 1550),
            ("Chicago", "Houston", 1080),
            ("Chicago", "Phoenix", 1440)
        };

        foreach (var (fromCity, toCity, distance) in routes)
        {
            graph.AddEdge(cityVertices[fromCity], cityVertices[toCity], distance);
        }

        graph.PrintGraph();

        // Find paths
        Console.WriteLine("\nBFS path from New York to Phoenix:");
        var bfsPath = graph.FindPathBFS("New York", "Phoenix");
        Console.WriteLine($"Path: {(bfsPath != null ? string.Join(" -> ", bfsPath) : "No path found")}");

        Console.WriteLine("\nDFS path from New York to Phoenix:");
        var dfsPath = graph.FindPathDFS("New York", "Phoenix");
        Console.WriteLine($"Path: {(dfsPath != null ? string.Join(" -> ", dfsPath) : "No path found")}");
    }
}
```

---

## Graph Search Algorithms

### Depth-First Search (DFS)

**When to use:**
- Finding connected components
- Cycle detection
- Topological sorting
- Maze solving
- Finding any path (not necessarily shortest)

**Time Complexity:** O(V + E)

#### DFS Applications

##### 1. Detect Cycle in Undirected Graph
```csharp
public static bool HasCycleUndirected<T>(Graph<T> graph, T startVertex)
{
    var visited = new HashSet<T>();

    bool DFS(T vertex, T parent)
    {
        visited.Add(vertex);

        foreach (var neighbor in graph.GetNeighbors(vertex).Select(n => n.neighbor))
        {
            if (!visited.Contains(neighbor))
            {
                if (DFS(neighbor, vertex))
                    return true;
            }
            else if (!neighbor.Equals(parent))
            {
                // Found back edge (cycle)
                return true;
            }
        }

        return false;
    }

    return DFS(startVertex, default(T));
}
```

##### 2. Topological Sort
```csharp
public static List<T> TopologicalSort<T>(Graph<T> graph)
{
    var visited = new HashSet<T>();
    var stack = new Stack<T>();

    void DFS(T vertex)
    {
        visited.Add(vertex);

        foreach (var neighbor in graph.GetNeighbors(vertex).Select(n => n.neighbor))
        {
            if (!visited.Contains(neighbor))
                DFS(neighbor);
        }

        stack.Push(vertex); // Add to stack after visiting all children
    }

    // Visit all vertices
    foreach (var vertex in graph.GetVertices())
    {
        if (!visited.Contains(vertex))
            DFS(vertex);
    }

    return stack.ToList(); // Already in topological order
}
```

### Breadth-First Search (BFS)

<div class="callout callout--tip">
<p class="callout__title">When to Use BFS</p>
<ul>
<li>Finding shortest path in unweighted graphs</li>
<li>Level-order traversal</li>
<li>Finding minimum steps/moves</li>
<li>Web crawling</li>
<li>Social network analysis (degrees of separation)</li>
</ul>
</div>

**Time Complexity:** O(V + E)

#### BFS Applications

##### 1. Shortest Path in Unweighted Graph
```csharp
public static List<T> ShortestPathBFS<T>(Graph<T> graph, T start, T end)
{
    var queue = new Queue<(T vertex, List<T> path)>();
    var visited = new HashSet<T> { start };

    queue.Enqueue((start, new List<T> { start }));

    while (queue.Count > 0)
    {
        var (vertex, path) = queue.Dequeue();

        if (vertex.Equals(end))
            return path;

        foreach (var neighbor in graph.GetNeighbors(vertex).Select(n => n.neighbor))
        {
            if (!visited.Contains(neighbor))
            {
                visited.Add(neighbor);
                var newPath = new List<T>(path) { neighbor };
                queue.Enqueue((neighbor, newPath));
            }
        }
    }

    return null; // No path found
}
```

##### 2. Count Connected Components
```csharp
public static int CountConnectedComponents<T>(Graph<T> graph)
{
    var visited = new HashSet<T>();
    int components = 0;

    void BFS(T startVertex)
    {
        var queue = new Queue<T>();
        queue.Enqueue(startVertex);
        visited.Add(startVertex);

        while (queue.Count > 0)
        {
            var vertex = queue.Dequeue();

            foreach (var neighbor in graph.GetNeighbors(vertex).Select(n => n.neighbor))
            {
                if (!visited.Contains(neighbor))
                {
                    visited.Add(neighbor);
                    queue.Enqueue(neighbor);
                }
            }
        }
    }

    foreach (var vertex in graph.GetVertices())
    {
        if (!visited.Contains(vertex))
        {
            BFS(vertex);
            components++;
        }
    }

    return components;
}
```

---

## Advanced Graph Algorithms

### Dijkstra's Algorithm (Shortest Path with Weights)

**When to use:**
- Finding shortest path in weighted graphs with non-negative weights
- GPS navigation systems
- Network routing protocols
- Cost optimization problems

**Time Complexity:** O((V + E) log V) with binary heap


#### C# Implementation
```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public static class Dijkstra
{
    public static (Dictionary<T, double> distances, Dictionary<T, T> previous)
        FindShortestPaths<T>(Graph<T> graph, T startVertex)
    {
        var distances = new Dictionary<T, double>();
        var previous = new Dictionary<T, T>();
        var priorityQueue = new SortedSet<(double distance, T vertex)>();
        var visited = new HashSet<T>();

        // Initialize distances
        foreach (var vertex in graph.GetVertices())
        {
            distances[vertex] = double.PositiveInfinity;
            previous[vertex] = default(T);
        }
        distances[startVertex] = 0;

        priorityQueue.Add((0, startVertex));

        while (priorityQueue.Count > 0)
        {
            var (currentDistance, currentVertex) = priorityQueue.Min;
            priorityQueue.Remove(priorityQueue.Min);

            if (visited.Contains(currentVertex))
                continue;

            visited.Add(currentVertex);

            // Check all neighbors
            var neighbors = graph.GetNeighbors(currentVertex);
            foreach (var (neighbor, weight) in neighbors)
            {
                double distance = currentDistance + weight;

                if (distance < distances[neighbor])
                {
                    distances[neighbor] = distance;
                    previous[neighbor] = currentVertex;
                    priorityQueue.Add((distance, neighbor));
                }
            }
        }

        return (distances, previous);
    }

    public static List<T> GetShortestPath<T>(Dictionary<T, T> previous, T start, T end)
    {
        var path = new List<T>();
        var current = end;

        while (!EqualityComparer<T>.Default.Equals(current, default(T)))
        {
            path.Add(current);
            current = previous[current];
        }

        if (!path[path.Count - 1].Equals(start))
            return null; // No path exists

        path.Reverse();
        return path;
    }
}

// Example usage with weighted graph
class DijkstraExample
{
    static void RunExample()
    {
        var weightedGraph = new Graph<string>(directed: false);
        string[] cities = {"A", "B", "C", "D", "E"};

        var cityVertices = new Dictionary<string, Vertex<string>>();
        foreach (var city in cities)
        {
            var vertex = new Vertex<string>(city);
            cityVertices[city] = vertex;
            weightedGraph.AddVertex(vertex);
        }

        // Add weighted edges
        var edges = new[]
        {
            ("A", "B", 4), ("A", "C", 2), ("B", "C", 1), ("B", "D", 5),
            ("C", "D", 8), ("C", "E", 10), ("D", "E", 2)
        };

        foreach (var (fromCity, toCity, weight) in edges)
        {
            weightedGraph.AddEdge(cityVertices[fromCity], cityVertices[toCity], weight);
        }

        var (distances, previous) = Dijkstra.FindShortestPaths(weightedGraph, "A");
        Console.WriteLine("Shortest distances from A:");

        foreach (var (vertex, distance) in distances)
        {
            var path = Dijkstra.GetShortestPath(previous, "A", vertex);
            Console.WriteLine($"  To {vertex}: {distance} via {(path != null ? string.Join(" -> ", path) : "No path")}");
        }
    }
}
```

### A* Algorithm (Heuristic Search)

**When to use:**
- Pathfinding with known goal location
- Game AI movement
- GPS navigation with traffic considerations
- Robotics path planning

A* uses a heuristic function to guide search toward the goal, making it more efficient than Dijkstra for single-target searches.

#### C# Implementation
```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public static class AStar
{
    public delegate double HeuristicFunction((int x, int y) pos1, (int x, int y) pos2);

    public static double ManhattanDistance((int x, int y) pos1, (int x, int y) pos2)
    {
        return Math.Abs(pos1.x - pos2.x) + Math.Abs(pos1.y - pos2.y);
    }

    public static double EuclideanDistance((int x, int y) pos1, (int x, int y) pos2)
    {
        return Math.Sqrt(Math.Pow(pos1.x - pos2.x, 2) + Math.Pow(pos1.y - pos2.y, 2));
    }

    public static List<T> FindPath<T>(Graph<T> graph, T start, T goal,
        Dictionary<T, (int x, int y)> positions, HeuristicFunction heuristic = null)
    {
        if (heuristic == null)
            heuristic = ManhattanDistance;

        var openSet = new SortedSet<(double f, T vertex)>();
        var cameFrom = new Dictionary<T, T>();

        var gScore = new Dictionary<T, double>();
        var fScore = new Dictionary<T, double>();

        foreach (var vertex in graph.GetVertices())
        {
            gScore[vertex] = double.PositiveInfinity;
            fScore[vertex] = double.PositiveInfinity;
        }

        gScore[start] = 0;
        fScore[start] = heuristic(positions[start], positions[goal]);
        openSet.Add((fScore[start], start));

        while (openSet.Count > 0)
        {
            var (_, current) = openSet.Min;
            openSet.Remove(openSet.Min);

            if (current.Equals(goal))
            {
                // Reconstruct path
                var path = new List<T>();
                while (cameFrom.ContainsKey(current))
                {
                    path.Add(current);
                    current = cameFrom[current];
                }
                path.Add(start);
                path.Reverse();
                return path;
            }

            foreach (var (neighbor, weight) in graph.GetNeighbors(current))
            {
                double tentativeGScore = gScore[current] + weight;

                if (tentativeGScore < gScore[neighbor])
                {
                    cameFrom[neighbor] = current;
                    gScore[neighbor] = tentativeGScore;
                    fScore[neighbor] = gScore[neighbor] + heuristic(positions[neighbor], positions[goal]);
                    openSet.Add((fScore[neighbor], neighbor));
                }
            }
        }

        return null; // No path found
    }
}

// Example usage for grid pathfinding
class AStarExample
{
    static void RunExample()
    {
        var gridGraph = new Graph<string>(directed: false);
        var positions = new Dictionary<string, (int x, int y)>
        {
            {"A", (0, 0)}, {"B", (1, 0)}, {"C", (2, 0)},
            {"D", (0, 1)}, {"E", (1, 1)}, {"F", (2, 1)},
            {"G", (0, 2)}, {"H", (1, 2)}, {"I", (2, 2)}
        };

        var vertices = new Dictionary<string, Vertex<string>>();
        foreach (var (pos, _) in positions)
        {
            var vertex = new Vertex<string>(pos);
            vertices[pos] = vertex;
            gridGraph.AddVertex(vertex);
        }

        // Add edges between adjacent cells
        var adjacencies = new[]
        {
            ("A", "B"), ("B", "C"), ("A", "D"), ("B", "E"), ("C", "F"),
            ("D", "E"), ("E", "F"), ("D", "G"), ("E", "H"), ("F", "I"),
            ("G", "H"), ("H", "I")
        };

        foreach (var (fromCell, toCell) in adjacencies)
        {
            gridGraph.AddEdge(vertices[fromCell], vertices[toCell], 1);
        }

        // Find path from A to I
        var path = AStar.FindPath(gridGraph, "A", "I", positions);
        Console.WriteLine($"A* path from A to I: {(path != null ? string.Join(" -> ", path) : "No path")}");
    }
}
```

## Common Interview Problems

### 1. Number of Islands (2D Grid)
```csharp
public static int NumIslands(char[][] grid)
{
    if (grid == null || grid.Length == 0 || grid[0].Length == 0)
        return 0;

    int rows = grid.Length;
    int cols = grid[0].Length;
    var visited = new HashSet<(int, int)>();
    int islands = 0;

    void DFS(int r, int c)
    {
        if (visited.Contains((r, c)) || r < 0 || r >= rows ||
            c < 0 || c >= cols || grid[r][c] == '0')
            return;

        visited.Add((r, c));
        // Visit all 4 directions
        DFS(r + 1, c);
        DFS(r - 1, c);
        DFS(r, c + 1);
        DFS(r, c - 1);
    }

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            if (grid[r][c] == '1' && !visited.Contains((r, c)))
            {
                DFS(r, c);
                islands++;
            }
        }
    }

    return islands;
}
```

### 2. Course Schedule (Cycle Detection)
```csharp
public static bool CanFinishCourses(int numCourses, int[][] prerequisites)
{
    // Build adjacency list
    var graph = new List<int>[numCourses];
    for (int i = 0; i < numCourses; i++)
        graph[i] = new List<int>();

    foreach (var prereq in prerequisites)
    {
        int course = prereq[0];
        int prerequisite = prereq[1];
        graph[prerequisite].Add(course);
    }

    // 0 = unvisited, 1 = visiting, 2 = visited
    var state = new int[numCourses];

    bool HasCycle(int course)
    {
        if (state[course] == 1) // Currently visiting - cycle detected
            return true;
        if (state[course] == 2) // Already processed
            return false;

        state[course] = 1; // Mark as visiting
        foreach (int nextCourse in graph[course])
        {
            if (HasCycle(nextCourse))
                return true;
        }

        state[course] = 2; // Mark as visited
        return false;
    }

    for (int course = 0; course < numCourses; course++)
    {
        if (state[course] == 0)
        {
            if (HasCycle(course))
                return false;
        }
    }

    return true;
}
```

### 3. Clone Graph
```csharp
public class Node
{
    public int val;
    public IList<Node> neighbors;

    public Node() {
        val = 0;
        neighbors = new List<Node>();
    }

    public Node(int _val) {
        val = _val;
        neighbors = new List<Node>();
    }

    public Node(int _val, List<Node> _neighbors) {
        val = _val;
        neighbors = _neighbors;
    }
}

public static Node CloneGraph(Node node)
{
    if (node == null)
        return null;

    var clones = new Dictionary<Node, Node>(); // original -> clone mapping

    Node DFS(Node original)
    {
        if (clones.ContainsKey(original))
            return clones[original];

        var clone = new Node(original.val);
        clones[original] = clone;

        foreach (var neighbor in original.neighbors)
        {
            clone.neighbors.Add(DFS(neighbor));
        }

        return clone;
    }

    return DFS(node);
}
```

## Graph Applications in Real World

**Social Networks:** Friend recommendations, influence analysis, community detection
**Maps & Navigation:** Shortest path, traffic routing, location services  
## Quick Reference

### Graph Representation
| Method | Space | Add Edge | Check Edge | Best For |
|--------|-------|----------|------------|----------|
| Adjacency List | O(V + E) | O(1) | O(degree) | Sparse graphs |
| Adjacency Matrix | O(V²) | O(1) | O(1) | Dense graphs, quick lookups |

### Search Algorithms
| Algorithm | Time | Space | Use Case |
|-----------|------|-------|----------|
| **DFS** | O(V + E) | O(V) | Cycle detection, topological sort, connected components |
| **BFS** | O(V + E) | O(V) | Shortest path (unweighted), level-order traversal |

### Key Patterns
- **Tree** = Connected acyclic graph with V-1 edges
- **Cycle detection:** DFS with visited tracking
- **Shortest path (unweighted):** BFS
- **Shortest path (weighted):** Dijkstra, Bellman-Ford
- **All pairs shortest path:** Floyd-Warshall

### C# Libraries
- Microsoft.Msagl for visualization
- Neo4j, Amazon Neptune for graph databases
- QuikGraph for advanced algorithms

---