---
title: "Database Selection Decision Matrix"
layout: resource
type: reference
category: "Databases"
description: "Decision matrix mapping access patterns to database categories, plus guidance on defaulting to PostgreSQL when the right category isn't obvious."
last_updated: 2026-07-02
tags: [databases, decision-making, data-modeling, architecture]
related_guides:
  - /study-guides/data/database-fundamentals.html
---

## Database Selection Decision Matrix

| Primary Access Pattern | Database Category |
| --- | --- |
| Transactions across related entities | Relational or NewSQL |
| Simple key-based lookups at massive scale | Key-Value |
| Flexible documents with varied schemas | Document |
| Time-range queries on metrics/events | Time-Series |
| Relationship traversal (friends-of-friends) | Graph |
| Semantic similarity search | Vector |
| Full-text search with relevance ranking | Search Engine |
| Sub-millisecond caching | In-Memory |
| Massive write throughput, sparse columns | Wide-Column |

## The PostgreSQL Default

Start with relational unless there's a specific reason not to. PostgreSQL covers more use cases than most teams realize:

- JSON columns provide document flexibility
- The pgvector extension enables vector search
- Full-text search is built in
- Extensions like TimescaleDB add time-series capabilities

If the right category isn't obvious, PostgreSQL is the safe default. Specialized databases can be added later when specific needs emerge.
