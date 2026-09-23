---
title: "Database Selection Matrix"
layout: resource
type: reference
category: "Databases"
description: "Access-pattern-to-database-type matrix and common polyglot persistence combinations."
last_updated: 2026-09-23
tags: [database-selection, decision-making, polyglot-persistence]
related_guides:
  - /study-guides/data/database-fundamentals.html
---

## Access Pattern to Database Type

| Primary Access Pattern | Database Category |
|------------------------|-------------------|
| Transactions across related entities | Relational |
| Transactions across related entities, beyond one server or across regions | Distributed SQL (NewSQL) |
| Simple key-based lookups at massive scale | Key-Value |
| Flexible documents with varied schemas | Document |
| Time-range queries on metrics/events | Time-Series |
| Relationship traversal (friends-of-friends) | Graph |
| Semantic similarity search | Vector |
| Full-text search with relevance ranking | Search Engine |
| Sub-millisecond caching | Key-Value (in-memory) |
| Very high write volume, read by partition key | Wide-Column |
| Aggregations over large history | Columnar warehouse or lakehouse |

## Common Polyglot Combinations

**Web application**: PostgreSQL (primary data) + Redis (sessions, caching) + Elasticsearch (search)

**IoT platform**: TimescaleDB (metrics) + PostgreSQL (device metadata) + Redis (real-time state)

**E-commerce**: PostgreSQL (orders, customers) + Elasticsearch (product search) + Redis (cart, sessions)

**AI application**: PostgreSQL (application data) + Pinecone or pgvector (embeddings) + Redis (caching)

**Social platform**: PostgreSQL (user data) + Neo4j (social graph) + Redis (feeds, caching)
