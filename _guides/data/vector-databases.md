---
layout: guide
title: "Vector Databases"
category: Databases
subcategory: Database Types
description: "How vector databases find the nearest neighbors to an embedding with approximate indexes like HNSW and IVF, the recall and memory trade-offs, filtering and hybrid search, and when pgvector is enough."
tags: [vector-search, embeddings, ann, hnsw, semantic-search, practical]
---

## What They Are

Vector databases store and search high-dimensional vectors, which are arrays of numbers that represent data in embedding space. They find vectors "similar" to a query vector, enabling semantic search, recommendation, and AI-powered applications.

The rise of machine learning created vectors. When you pass text through a language model, an image through a vision model, or user behavior through a recommendation model, you get a vector, typically hundreds or thousands of dimensions. These vectors capture semantic meaning: similar items have similar vectors. "How do I reset my password?" and "I forgot my login credentials" have different words but similar meaning, producing vectors that are geometrically close.

Traditional databases can't efficiently search vectors. Finding the nearest neighbors to a query vector with a standard index would require comparing against every vector in the database. Vector databases use specialized index structures that make approximate nearest-neighbor search tractable at scale.

---

## Data Structure

```
┌────────────────────────────────────────────────────────────────────────────┐
│  VECTOR COLLECTION: documents                                              │
├──────────┬────────────────────────────────────────┬────────────────────────┤
│  ID      │  VECTOR (768 dimensions)               │  METADATA              │
├──────────┼────────────────────────────────────────┼────────────────────────┤
│  doc_1   │  [0.12, -0.34, 0.56, ..., 0.89]       │  {category: "support", │
│          │   ↑                                    │   date: "2024-01-15"}  │
│          │   Embedding from ML model              │                        │
├──────────┼────────────────────────────────────────┼────────────────────────┤
│  doc_2   │  [0.11, -0.33, 0.58, ..., 0.87]       │  {category: "support"} │
│          │   ↑ Similar vector = similar meaning   │                        │
├──────────┼────────────────────────────────────────┼────────────────────────┤
│  doc_3   │  [-0.45, 0.78, -0.12, ..., 0.23]      │  {category: "billing"} │
│          │   ↑ Different vector = different topic │                        │
└──────────┴────────────────────────────────────────┴────────────────────────┘

Query: Find vectors nearest to [0.13, -0.35, 0.55, ..., 0.88]
       with category = "support"

Results: doc_1 (similarity: 0.98)  ← Very similar
         doc_2 (similarity: 0.96)  ← Similar
         doc_3 not returned       ← Filtered by metadata
```

Each record stores a high-dimensional vector (the embedding) plus optional metadata. Queries find the K nearest neighbors to a query vector, optionally filtered by metadata.

---

## How They Work

### Vector Embeddings

Data enters as vectors produced by an embedding model outside the database. A text embedding model might turn a sentence into 768 or 1,536 numbers, and an image model such as CLIP turns a picture into a few hundred. The database stores each vector with an ID and metadata, and every vector in a collection must come from the same model, since vectors from different models aren't comparable.

### Distance Metrics

"Similarity" is measured geometrically:

- **Cosine similarity**: Measures the angle between vectors (common for text)
- **Euclidean distance**: Measures straight-line distance
- **Dot product**: Multiplies the vectors element by element and sums the result, so it reflects both direction and length

The right metric is the one the embedding model was trained for, which its documentation states. For vectors normalized to length 1, all three produce the same ranking.

### Approximate Nearest Neighbor (ANN) Indexes

The key innovation. Rather than comparing a query against every stored vector, ANN indexes organize vectors into structures that narrow the search space:

**HNSW (Hierarchical Navigable Small World)** builds a multi-layer graph where you can navigate from any point to similar points through short hops.

**IVF (Inverted File Index)** clusters vectors into buckets and only searches relevant buckets.

Both trade exactness for speed. An ANN search may miss some of the true nearest neighbors, and the fraction it finds is called **recall**. Each index has a knob that trades recall against latency, such as how many graph candidates HNSW explores or how many buckets IVF searches. HNSW generally gives high recall at low latency but keeps a large graph in memory. **Quantization** shrinks each vector, for example storing each number in one byte instead of four, which cuts memory at some cost in accuracy.

### Filtering

Most vector databases combine similarity with metadata filters, such as "documents similar to this query where category is support and the date is within the last week." How the filter is applied matters. Filtering after the ANN search can leave too few results when the filter is selective, while filtering inside the search keeps the result count but is harder to make fast, and engines differ in how well they handle it.

### Hybrid Search

Vector search matches meaning but can miss exact terms like product codes, names, or error messages that keyword search finds easily. **Hybrid search** runs both a vector search and a keyword search, typically BM25, and merges the two ranked lists. Many vector databases and search engines now support it directly.

---

## Why They Excel

### Semantic Understanding

Traditional search matches keywords. Vector search matches meaning. This enables "find similar" functionality that keyword search cannot achieve.

### ML Integration

Vector databases are the storage layer for ML-powered features. They're designed to work with the embeddings that modern models produce.

### Scale

ANN indexes keep query latency in the milliseconds as collections grow to millions of vectors, and distributed vector databases shard indexes to reach billions.

---

## Why They Struggle

### No Exact Match

Vector search returns the closest items by similarity, and an ANN index may miss some of them. If you need exact retrieval by a value, it's the wrong tool.

### Embedding Quality Dependency

The database is only as good as the embeddings. Garbage vectors in, garbage results out.

### Memory, Updates, and Maturity

High-recall indexes like HNSW are memory-hungry, and deleting or updating vectors can degrade them until they're rebuilt. Changing embedding models means re-embedding and reindexing the whole collection. Dedicated vector databases are also younger than other categories, so their tooling and operational practices are still settling.

---

## When to Use Them

Vector databases power:

- **Semantic search**: Find documents by meaning, not keywords
- **Retrieval-augmented generation (RAG)**: Retrieving relevant passages from your data to give a language model as context
- **Recommendation systems**: Find similar products, content, or users
- **Image/audio search**: Find visually or acoustically similar media
- **Anomaly detection**: Identify vectors far from normal clusters

---

## When to Look Elsewhere

If you don't have embeddings, vector databases don't apply, and for exact matching a traditional database is the right tool. For small collections, comparing the query against every vector is often fast enough and avoids approximation entirely. If you already run PostgreSQL, the pgvector extension, which supports HNSW and IVF indexes, is often enough until the collection or query load outgrows one database server.

---

## Examples

**Pinecone** is a fully managed, serverless vector database. **Weaviate**, **Milvus**, and **Qdrant** are open-source vector databases with managed offerings, and Milvus in particular targets very large collections with a choice of index types. **pgvector** adds vector columns and ANN indexes to PostgreSQL. **Chroma** is a lightweight option common in prototypes. Many general-purpose databases and search engines, including Elasticsearch, OpenSearch, MongoDB Atlas, and Redis, now include vector search as well.

---
