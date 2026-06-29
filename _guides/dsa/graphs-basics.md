---
title: "Graph Fundamentals"
category: Data Structures & Algorithms
description: "Foundation of graph theory covering terminology, representations, graph types, and basic traversal concepts for modeling complex relationships and networks."
tags: [data-structures, algorithms, graphs, fundamentals, interview-prep]
---

## Why Graphs Exist

Graphs model relationships between entities, making them essential for solving connectivity problems. From social networks to GPS navigation to dependency management, graphs help us understand and navigate complex interconnected systems. They're the backbone of many modern algorithms that power search engines, recommendation systems, and network protocols.

**Real impact:** Understanding graphs enables you to solve problems involving any kind of relationship or connection, whether it's finding the shortest route, detecting cycles in dependencies, or analyzing network structures.

---

## What Are Graphs?

A graph is a collection of vertices (nodes) connected by edges. Unlike trees, graphs can have cycles and multiple paths between nodes. They're incredibly versatile for modeling real-world relationships.

**Key insight:** Graphs are about relationships and connections, not hierarchical structures.

### Graph Terminology

- **Vertex/Node:** Individual points in the graph
- **Edge:** Connection between two vertices
- **Adjacent:** Two vertices connected by an edge
- **Degree:** Number of edges connected to a vertex
- **Path:** Sequence of vertices connected by edges
- **Cycle:** Path that starts and ends at the same vertex

---

## Types of Graphs

### Directed vs Undirected

**Directed Graph (Digraph):**
- Edges have direction (one-way connections)
- Used for: Web pages (links), dependencies, workflows

**Undirected Graph:**
- Edges are bidirectional
- Used for: Social networks (friendship), road networks

### Weighted vs Unweighted

**Weighted Graph:**
- Edges have associated costs/weights
- Used for: Distance maps, network latency, cost optimization

**Unweighted Graph:**
- All edges are equal
- Used for: Simple connectivity, social relationships

---

## Graph Representation in C#

### Adjacency List (Most Common)
```csharp
public class Graph
{
    private Dictionary<int, List<int>> adjacencyList;

    public Graph()
    {
        adjacencyList = new Dictionary<int, List<int>>();
    }

    public void AddVertex(int vertex)
    {
        if (!adjacencyList.ContainsKey(vertex))
        {
            adjacencyList[vertex] = new List<int>();
        }
    }

    public void AddEdge(int source, int destination, bool bidirectional = true)
    {
        AddVertex(source);
        AddVertex(destination);

        adjacencyList[source].Add(destination);

        if (bidirectional)
        {
            adjacencyList[destination].Add(source);
        }
    }

    public List<int> GetNeighbors(int vertex)
    {
        return adjacencyList.ContainsKey(vertex) ? adjacencyList[vertex] : new List<int>();
    }

    public void PrintGraph()
    {
        foreach (var vertex in adjacencyList.Keys)
        {
            Console.WriteLine($"{vertex}: [{string.Join(", ", adjacencyList[vertex])}]");
        }
    }
}
```

### Weighted Graph Implementation
```csharp
public class WeightedGraph
{
    public class Edge
    {
        public int Destination { get; set; }
        public int Weight { get; set; }

        public Edge(int destination, int weight)
        {
            Destination = destination;
            Weight = weight;
        }
    }

    private Dictionary<int, List<Edge>> adjacencyList;

    public WeightedGraph()
    {
        adjacencyList = new Dictionary<int, List<Edge>>();
    }

    public void AddVertex(int vertex)
    {
        if (!adjacencyList.ContainsKey(vertex))
        {
            adjacencyList[vertex] = new List<Edge>();
        }
    }

    public void AddEdge(int source, int destination, int weight, bool bidirectional = true)
    {
        AddVertex(source);
        AddVertex(destination);

        adjacencyList[source].Add(new Edge(destination, weight));

        if (bidirectional)
        {
            adjacencyList[destination].Add(new Edge(source, weight));
        }
    }

    public List<Edge> GetNeighbors(int vertex)
    {
        return adjacencyList.ContainsKey(vertex) ? adjacencyList[vertex] : new List<Edge>();
    }
}
```

---

## Basic Graph Traversal

### Depth-First Search (DFS)
**When to use:** Exploring all paths, detecting cycles, topological sorting

```csharp
public static class GraphTraversal
{
    public static List<int> DFS(Graph graph, int startVertex)
    {
        var visited = new HashSet<int>();
        var result = new List<int>();
        var stack = new Stack<int>();

        stack.Push(startVertex);

        while (stack.Count > 0)
        {
            int current = stack.Pop();

            if (!visited.Contains(current))
            {
                visited.Add(current);
                result.Add(current);

                // Add neighbors in reverse order to maintain left-to-right traversal
                var neighbors = graph.GetNeighbors(current);
                for (int i = neighbors.Count - 1; i >= 0; i--)
                {
                    if (!visited.Contains(neighbors[i]))
                    {
                        stack.Push(neighbors[i]);
                    }
                }
            }
        }

        return result;
    }

    // Recursive DFS
    public static List<int> DFSRecursive(Graph graph, int startVertex)
    {
        var visited = new HashSet<int>();
        var result = new List<int>();

        DFSHelper(graph, startVertex, visited, result);
        return result;
    }

    private static void DFSHelper(Graph graph, int vertex, HashSet<int> visited, List<int> result)
    {
        visited.Add(vertex);
        result.Add(vertex);

        foreach (int neighbor in graph.GetNeighbors(vertex))
        {
            if (!visited.Contains(neighbor))
            {
                DFSHelper(graph, neighbor, visited, result);
            }
        }
    }
}
```

### Breadth-First Search (BFS)
**When to use:** Finding shortest path in unweighted graphs, level-order exploration

```csharp
public static List<int> BFS(Graph graph, int startVertex)
{
    var visited = new HashSet<int>();
    var result = new List<int>();
    var queue = new Queue<int>();

    queue.Enqueue(startVertex);
    visited.Add(startVertex);

    while (queue.Count > 0)
    {
        int current = queue.Dequeue();
        result.Add(current);

        foreach (int neighbor in graph.GetNeighbors(current))
        {
            if (!visited.Contains(neighbor))
            {
                visited.Add(neighbor);
                queue.Enqueue(neighbor);
            }
        }
    }

    return result;
}
```

---

## Common Graph Patterns

### Finding Connected Components
```csharp
public static class GraphAnalysis
{
    public static List<List<int>> FindConnectedComponents(Graph graph, List<int> allVertices)
    {
        var visited = new HashSet<int>();
        var components = new List<List<int>>();

        foreach (int vertex in allVertices)
        {
            if (!visited.Contains(vertex))
            {
                var component = new List<int>();
                DFSComponent(graph, vertex, visited, component);
                components.Add(component);
            }
        }

        return components;
    }

    private static void DFSComponent(Graph graph, int vertex, HashSet<int> visited, List<int> component)
    {
        visited.Add(vertex);
        component.Add(vertex);

        foreach (int neighbor in graph.GetNeighbors(vertex))
        {
            if (!visited.Contains(neighbor))
            {
                DFSComponent(graph, neighbor, visited, component);
            }
        }
    }
}
```

### Cycle Detection in Undirected Graph
```csharp
public static bool HasCycleUndirected(Graph graph, List<int> allVertices)
{
    var visited = new HashSet<int>();

    foreach (int vertex in allVertices)
    {
        if (!visited.Contains(vertex))
        {
            if (DFSCycleCheck(graph, vertex, -1, visited))
            {
                return true;
            }
        }
    }

    return false;
}

private static bool DFSCycleCheck(Graph graph, int vertex, int parent, HashSet<int> visited)
{
    visited.Add(vertex);

    foreach (int neighbor in graph.GetNeighbors(vertex))
    {
        if (!visited.Contains(neighbor))
        {
            if (DFSCycleCheck(graph, neighbor, vertex, visited))
            {
                return true;
            }
        }
        else if (neighbor != parent)
        {
            return true; // Found cycle
        }
    }

    return false;
}
```

---

## Practical Usage Examples

### Social Network Analysis
```csharp
public static class SocialNetwork
{
    public static List<int> FindMutualFriends(Graph friendGraph, int person1, int person2)
    {
        var friends1 = new HashSet<int>(friendGraph.GetNeighbors(person1));
        var friends2 = new HashSet<int>(friendGraph.GetNeighbors(person2));

        return friends1.Intersect(friends2).ToList();
    }

    public static int DegreesOfSeparation(Graph friendGraph, int start, int target)
    {
        var queue = new Queue<(int person, int distance)>();
        var visited = new HashSet<int>();

        queue.Enqueue((start, 0));
        visited.Add(start);

        while (queue.Count > 0)
        {
            var (current, distance) = queue.Dequeue();

            if (current == target)
            {
                return distance;
            }

            foreach (int friend in friendGraph.GetNeighbors(current))
            {
                if (!visited.Contains(friend))
                {
                    visited.Add(friend);
                    queue.Enqueue((friend, distance + 1));
                }
            }
        }

        return -1; // Not connected
    }
}
```

### Dependency Resolution
```csharp
public static class DependencyResolver
{
    public static List<int> TopologicalSort(Graph dependencyGraph, List<int> allTasks)
    {
        var inDegree = new Dictionary<int, int>();
        var result = new List<int>();
        var queue = new Queue<int>();

        // Initialize in-degree count
        foreach (int task in allTasks)
        {
            inDegree[task] = 0;
        }

        // Calculate in-degrees
        foreach (int task in allTasks)
        {
            foreach (int dependent in dependencyGraph.GetNeighbors(task))
            {
                inDegree[dependent]++;
            }
        }

        // Find tasks with no dependencies
        foreach (var kvp in inDegree)
        {
            if (kvp.Value == 0)
            {
                queue.Enqueue(kvp.Key);
            }
        }

        // Process tasks
        while (queue.Count > 0)
        {
            int current = queue.Dequeue();
            result.Add(current);

            foreach (int dependent in dependencyGraph.GetNeighbors(current))
            {
                inDegree[dependent]--;
                if (inDegree[dependent] == 0)
                {
                    queue.Enqueue(dependent);
                }
            }
        }

        // Check for cycles
        if (result.Count != allTasks.Count)
        {
            throw new InvalidOperationException("Circular dependency detected!");
        }

        return result;
    }
}
```

---

## Time and Space Complexity

### Representation Complexities
- **Adjacency List:**
  - Space: O(V + E)
  - Add vertex: O(1)
  - Add edge: O(1)
  - Check if edge exists: O(degree of vertex)

- **Adjacency Matrix:**
  - Space: O(V²)
  - Add vertex: O(V²) (need to resize matrix)
  - Add edge: O(1)
  - Check if edge exists: O(1)

### Traversal Complexities
- **DFS/BFS:** O(V + E) time, O(V) space
- **Connected Components:** O(V + E) time
- **Cycle Detection:** O(V + E) time

---

## When to Use Graphs

**Use graphs when:**
- Modeling relationships between entities
- Finding paths or connections
- Analyzing network structures
- Solving dependency problems
- Working with hierarchical data that can have multiple parents

**Common applications:**
- Social networks
- Computer networks
- Transportation systems
- Dependency graphs
- Game AI pathfinding
- Recommendation systems

---

## Quick Reference

### Graph Basics Summary
| Concept | Definition | Example |
|---------|------------|---------|
| **Vertex** | Node in graph | Person in social network |
| **Edge** | Connection between vertices | Friendship link |
| **Directed** | One-way connection | Twitter follow |
| **Undirected** | Two-way connection | Facebook friend |
| **Weighted** | Edge has cost/distance | Road with distance |

### Traversal Comparison
| Algorithm | Order | Use Case | Implementation |
|-----------|-------|----------|----------------|
| **DFS** | Depth-first | Pathfinding, cycle detection | Stack (or recursion) |
| **BFS** | Level-by-level | Shortest path, nearest neighbor | Queue |

<div class="callout callout--tip">
<p class="callout__title">DFS vs BFS</p>
<p>DFS explores as far as possible before backtracking (like maze solving). BFS explores all neighbors before going deeper (like ripples in water).</p>
</div>

---