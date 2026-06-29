---
layout: guide
title: "Multi-Model Databases"
category: Databases
subcategory: Database Types
description: "Deep dive into multi-model databases—how they support document, graph, and key-value access patterns in a single system."
tags: [databases, multi-model, polyglot, flexibility, data-modeling, architecture]
---

## What They Are

Multi-model databases support multiple data models in a single system, including document, graph, key-value, and sometimes relational access to the same underlying data. Instead of deploying separate databases for different models, you use one system.

The appeal is operational simplicity. Managing one database is easier than managing four. But the trade-off is that specialized databases typically outperform multi-model databases for their specific use case.

---

## Data Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MULTI-MODEL DATABASE                                                   │
│  Same data, multiple access patterns                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  AS DOCUMENTS:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ {"_key": "alice", "name": "Alice", "follows": ["bob", "carol"]} │   │
│  │ {"_key": "bob", "name": "Bob", "follows": ["carol"]}            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         │  Same underlying data                                         │
│         ▼                                                               │
│  AS GRAPH:                                                              │
│       ┌───────┐     FOLLOWS     ┌───────┐                              │
│       │ Alice │ ───────────────▶│  Bob  │                              │
│       └───────┘                 └───────┘                              │
│           │                         │                                   │
│           │ FOLLOWS                 │ FOLLOWS                           │
│           ▼                         ▼                                   │
│       ┌───────┐◀────────────────────┘                                  │
│       │ Carol │                                                         │
│       └───────┘                                                         │
│         │                                                               │
│         │  Same underlying data                                         │
│         ▼                                                               │
│  AS KEY-VALUE:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  "alice" → <document>    "bob" → <document>                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Query the same data as documents, traverse it as a graph, or look it up
by key—all without ETL or data duplication.
```

One storage engine supports multiple query paradigms. You choose the model that fits each query.

---

## How They Work

### Unified Storage Engine

Data stores in a format that supports multiple access patterns. A document might also be traversable as a graph node, queryable by key, and searchable with full-text indexes.

### Multiple Query Interfaces

Different query languages or APIs access the same data through different lenses. ArangoDB offers AQL for documents, graph traversal syntax, and key-value operations all in one language.

### Polyglot Queries

Some multi-model databases allow combining models in a single query, such as joining a document collection with a graph traversal.

---

## Why They Excel

### Reduced Operational Overhead

One system to deploy, monitor, backup, and maintain.

### No ETL Between Systems

Data doesn't need to move between specialized databases.

### Flexible Modeling

As requirements evolve, you can access data through different models without migration.

---

## Why They Struggle

### Jack of All Trades

A database optimizing for multiple models can't optimize as aggressively for any single one. Neo4j will outperform ArangoDB for graph workloads; MongoDB will often outperform it for documents.

### Complexity

Supporting multiple models means more code paths, more features to understand, and more potential for bugs.

### Limited Ecosystem

Specialized databases often have richer tooling and community support.

---

## When to Use Them

Multi-model databases make sense when:

- Your data genuinely needs multiple access patterns (queried as documents AND traversed as a graph)
- Operational simplicity outweighs raw performance requirements
- Avoiding ETL between systems provides significant value

---

## When to Look Elsewhere

For performance-critical workloads with clear access patterns, specialized databases are typically better. If you're only using one model, multi-model adds unnecessary complexity.

---

## Examples

**ArangoDB** supports documents, graphs, and key-value access with the AQL query language.

**Azure Cosmos DB** offers multiple API options (SQL, MongoDB, Gremlin, Table) backed by the same globally-distributed storage.

**Couchbase** combines document storage with key-value performance, full-text search, and SQL-like queries.

---
