---
layout: guide
title: "Graph Databases"
category: Databases
subcategory: Database Types
description: "How graph databases store nodes and relationships so multi-hop traversals stay fast, property graphs versus RDF, Cypher and GQL, and why aggregation and sharding are hard for them."
tags: [graph, neo4j, cypher, traversal, relationships, knowledge-graphs, practical]
---

## What They Are

Graph databases store data as nodes, the entities, and edges, the relationships between them. A relational database reconstructs relationships at query time by joining tables on matching keys. A graph database stores each relationship as a first-class record attached to the nodes it connects, so following one is a direct step rather than a search.

They target highly connected data, where the questions are about paths. In a social network, finding friends of friends in a relational database means joining the friendship table to itself once per hop, and each join looks up matching rows through an index that grows with the table. The number of people reached grows quickly with each hop in both kinds of database, but a graph database only pays for the edges it actually follows, so a query that starts from one person costs roughly the same whether the whole graph holds a million people or a billion.

---

## Data Structure

```
                    ┌─────────────────┐
                    │  :Person        │
                    │  name: "Alice"  │
                    │  age: 32        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       [:FOLLOWS]      [:WORKS_AT]    [:PURCHASED]
       since: 2023                    date: 2024-01
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
    │  :Person        │  │  :Company   │  │  :Product       │
    │  name: "Bob"    │  │  name:      │  │  name: "Laptop" │
    │  age: 28        │  │  "Acme Inc" │  │  price: 999     │
    └────────┬────────┘  └─────────────┘  └─────────────────┘
             │
             ▼
       [:FOLLOWS]
             │
             ▼
    ┌─────────────────┐
    │  :Person        │
    │  name: "Carol"  │
    └─────────────────┘

Cypher Query: MATCH (a:Person)-[:FOLLOWS]->(b)-[:FOLLOWS]->(c)
              WHERE a.name = "Alice"
              RETURN c.name
              → Returns "Carol" (friend-of-friend)
```

Nodes have labels such as `:Person` and `:Product`, and properties. Edges have a type such as `FOLLOWS` or `PURCHASED`, a direction, and properties of their own. This is the **property graph** model, the one most graph databases use.

---

## How They Work

### Property Graphs and RDF

There are two graph data models. **Property graphs**, used by Neo4j and most graph databases, have nodes and edges that each carry labels and key-value properties, such as a `FOLLOWS` edge with a `since` date. **RDF** (Resource Description Framework), a W3C standard, represents everything as subject-predicate-object triples such as `Alice follows Bob`, and it's queried with SPARQL. RDF is common in knowledge graphs and linked data, where standard vocabularies let datasets from different sources be combined.

### Index-Free Adjacency

In native graph databases like Neo4j, each node's record points directly to its relationships, and each relationship points to the nodes at both ends. Moving from a node to its neighbors follows those pointers instead of looking anything up in an index, so the cost of a traversal depends on how many edges it follows, not on the total size of the graph. Not every graph database works this way. Some, such as JanusGraph, store the graph in a general-purpose backend like Cassandra and look adjacent edges up by key, which is still fast but adds an index-style lookup per step.

### Graph Query Languages

Graph query languages describe patterns rather than joins. **Cypher**, created for Neo4j and published as openCypher, writes a pattern the way you'd draw it: `(alice)-[:FOLLOWS]->(bob)-[:FOLLOWS]->(carol)` matches a person Alice follows and a person that person follows. **GQL**, published by ISO in 2024 as the first standard graph query language, draws heavily on Cypher. **Gremlin**, from Apache TinkerPop, takes a step-by-step traversal approach instead, and **SPARQL** queries RDF data.

### Graph Algorithms

Many graph databases ship libraries of graph algorithms, such as Neo4j's Graph Data Science library, covering:

- **Pathfinding**: Shortest path between nodes
- **Centrality**: Identifying influential nodes
- **Community detection**: Finding clusters
- **Similarity**: Finding similar nodes based on neighborhood structure

---

## Why They Excel

### Relationship-Heavy Queries

Any query that asks about connections is natural and fast: "who knows whom," "what's connected to what," or "how are these related."

### Variable-Length Paths

"Find all paths from A to B with up to 6 hops" is a simple query. In SQL, you'd need recursive CTEs or multiple self-joins.

### Schema Flexibility

New node labels and relationship types can be added without migrations, so the model grows with the domain.

### Whiteboard-Friendly Modeling

Domain experts tend to sketch their domain as boxes and arrows, and a property graph stores that sketch almost as drawn.

---

## Why They Struggle

### Aggregate Queries

"How many orders did we have last month?" requires touching every order node. Relational databases with proper indexes handle this better.

### High-Volume Writes and Supernodes

Writes maintain the relationship structure on both ends of every edge, so graph databases generally sustain lower write rates than key-value or wide-column stores. Nodes with enormous numbers of edges, called supernodes, such as a celebrity account with millions of followers, make this worse: writes to them contend for the same records, and traversals through them fan out across every edge.

### Global Operations

Anything that requires scanning the entire graph rather than traversing from a starting point will be slow.

### Horizontal Scaling

Splitting a graph across servers is hard, because any split cuts edges and a traversal that crosses the cut becomes a network hop. Most graph databases scale reads with replicas, and sharding a single graph is either unsupported or leaves the application to decide how to split it.

---

## When to Use Them

Graph databases shine for:

- **Social networks**: Friends, followers, connections
- **Fraud detection**: Identifying suspicious patterns across accounts, devices, and transactions
- **Recommendation engines**: Collaborative filtering based on user-item graphs
- **Knowledge graphs**: Representing complex domains with rich relationships
- **Network infrastructure**: Dependencies, impact analysis, topology

---

## When to Look Elsewhere

If your queries are primarily create, read, update, and delete by ID, if you need high-throughput writes, or if your main access pattern is aggregation rather than navigation, a graph database adds complexity without benefit. For occasional hierarchy or path queries, SQL's recursive common table expressions in a relational database are often enough.

---

## Examples

**Neo4j** is the most widely used native graph database, with Cypher, ACID transactions, and community and enterprise editions. **Amazon Neptune** is a managed service that supports property graphs through Gremlin and openCypher and RDF through SPARQL. **JanusGraph** is an open-source graph layer over storage backends such as Cassandra, HBase, and BerkeleyDB. **TigerGraph** targets large-scale graph analytics with its own query language, GSQL.

---
