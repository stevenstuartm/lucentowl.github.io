---
title: "Retrieval-Augmented Generation (RAG)"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Building AI systems that ground responses in external knowledge: embeddings, vector databases, chunking strategies, retrieval methods, and production patterns."
tags: [ai, generative-ai, llm, rag, embeddings, vector-databases, practical]
---

## What Is RAG?

Retrieval-Augmented Generation (RAG) combines the generative capabilities of large language models with external knowledge retrieval. Instead of relying solely on what the model learned during training, RAG systems fetch relevant information from a knowledge base and include it in the prompt.

**The core insight**: LLMs are good at reasoning and generating text, but their knowledge is frozen at training time and they can hallucinate. RAG addresses both limitations by grounding responses in retrieved documents.

### Why RAG Matters

| Challenge | How RAG Helps |
|-----------|---------------|
| **Knowledge cutoff** | Retrieves current information from updated sources |
| **Hallucination** | Grounds responses in actual documents |
| **Domain expertise** | Accesses specialized knowledge without fine-tuning |
| **Source attribution** | Can cite specific documents for transparency |
| **Cost** | Cheaper than fine-tuning for adding knowledge |

### RAG vs. Fine-tuning vs. Prompting

| Approach | Best For | Limitations |
|----------|----------|-------------|
| **Prompting** | General tasks, small context | Limited by context window |
| **RAG** | Large knowledge bases, current information | Retrieval quality affects output |
| **Fine-tuning** | Changing model behavior/style | Expensive, knowledge still static |

Choose RAG when you need access to large or frequently updated knowledge. Choose fine-tuning when you need to change how the model behaves, not just what it knows.

---

## RAG Architecture

A typical RAG system has two phases: indexing (offline) and retrieval + generation (online).

### Indexing Phase

```
Documents → Chunking → Embedding → Vector Database
```

1. **Document Loading**: Ingest source documents (PDFs, web pages, databases, APIs)
2. **Chunking**: Split documents into smaller pieces
3. **Embedding**: Convert chunks into vector representations
4. **Storage**: Store vectors and metadata in a vector database

### Query Phase

```
Query → Embedding → Retrieval → Context Assembly → LLM → Response
```

1. **Query Embedding**: Convert user query to vector
2. **Retrieval**: Find similar chunks via vector similarity
3. **Reranking** (optional): Reorder results by relevance
4. **Context Assembly**: Combine retrieved chunks into prompt
5. **Generation**: LLM generates response using retrieved context

---

## Embeddings

Embeddings are dense vector representations that capture semantic meaning. Similar concepts have similar vectors, enabling semantic search rather than keyword matching.

### How Embeddings Work

Text is converted into a fixed-size vector (typically 384-1536 dimensions). The embedding model learns to place semantically similar text close together in vector space.

**Example**: "How do I reset my password?" and "I forgot my login credentials" would have similar vectors despite sharing few words.

### Embedding Model Selection

| Model | Dimensions | Strengths | Use Case |
|-------|------------|-----------|----------|
| **OpenAI text-embedding-3-small** | 1536 | High quality, easy API | General purpose |
| **OpenAI text-embedding-3-large** | 3072 | Highest quality | When accuracy is critical |
| **Sentence Transformers (all-MiniLM)** | 384 | Fast, runs locally | Privacy-sensitive, high volume |
| **Cohere embed-v3** | 1024 | Multilingual | International applications |
| **BGE (BAAI)** | 768-1024 | Strong open-source option | Self-hosted deployments |

**Key considerations**:
- Query and document embeddings must use the same model
- Larger dimensions generally mean better quality but more storage/compute
- Some models are optimized for specific domains (code, legal, medical)

### Embedding Best Practices

- **Consistency**: Always use the same model for indexing and querying
- **Preprocessing**: Clean and normalize text before embedding
- **Batching**: Embed documents in batches for efficiency
- **Caching**: Cache embeddings for frequently accessed content

---

## Vector Databases

Vector databases store embeddings and enable fast similarity search across millions or billions of vectors.

### How Vector Search Works

Vector databases use approximate nearest neighbor (ANN) algorithms to find similar vectors quickly. Instead of comparing against every vector (O(n)), they use indexing structures to narrow the search space.

**Common algorithms**:
- **HNSW** (Hierarchical Navigable Small World): Graph-based, high accuracy
- **IVF** (Inverted File Index): Clustering-based, good for large datasets
- **PQ** (Product Quantization): Compression technique for memory efficiency

### Vector Database Options

| Database | Type | Strengths | Best For |
|----------|------|-----------|----------|
| **Pinecone** | Managed cloud | Easy setup, auto-scaling | Quick start, production |
| **Weaviate** | Open source | Hybrid search, GraphQL | Flexible deployments |
| **Chroma** | Open source | Simple API, lightweight | Prototyping, small projects |
| **Qdrant** | Open source | High performance, filtering | Self-hosted production |
| **Milvus** | Open source | Massive scale | Enterprise, billion+ vectors |
| **pgvector** | PostgreSQL extension | Existing Postgres infrastructure | Teams already on Postgres |

### Metadata and Filtering

Vector databases typically support storing metadata alongside vectors, enabling filtered searches:

```
Find chunks similar to "deployment strategies"
WHERE source = "infrastructure-docs"
AND updated_after = "2024-01-01"
```

This combines semantic similarity with structured filtering for more precise retrieval.

---

## Chunking Strategies

Chunking determines how documents are split before embedding. Poor chunking leads to poor retrieval.

### Why Chunking Matters

- **Too large**: Chunks contain irrelevant information, dilute the embedding
- **Too small**: Chunks lack context, retrieval misses important information
- **Wrong boundaries**: Chunks split mid-sentence or mid-concept

### Chunking Methods

#### Fixed-Size Chunking

Split by character or token count with overlap.

```
Chunk size: 500 tokens
Overlap: 50 tokens
```

**Pros**: Simple, predictable
**Cons**: Ignores document structure, may split mid-sentence

#### Recursive Character Splitting

Split by hierarchy of separators (paragraphs → sentences → words).

**Pros**: Respects some structure
**Cons**: Still may split awkwardly

#### Semantic Chunking

Split based on topic shifts detected by embedding similarity.

**Pros**: Keeps related content together
**Cons**: More complex, computationally expensive

#### Document-Structure Chunking

Split based on document structure (headers, sections, paragraphs).

**Pros**: Preserves natural organization
**Cons**: Requires structured input (markdown, HTML)

### Chunking Guidelines

| Content Type | Recommended Approach |
|--------------|---------------------|
| **Technical docs** | Section-based, 500-1000 tokens |
| **Conversations** | Message or turn-based |
| **Code** | Function or class-based |
| **Legal/contracts** | Clause or section-based |
| **General text** | Paragraph-based with overlap |

### Chunk Size Trade-offs

| Smaller Chunks (100-300 tokens) | Larger Chunks (500-1500 tokens) |
|--------------------------------|--------------------------------|
| More precise retrieval | More context per chunk |
| Less context in each chunk | May include irrelevant content |
| More chunks to search | Fewer chunks to search |
| Higher storage costs | Lower storage costs |

**Starting point**: 500 tokens with 50-100 token overlap, then adjust based on retrieval quality.

---

## Retrieval Strategies

How you retrieve chunks significantly impacts RAG quality.

### Dense Retrieval

Uses embedding similarity (cosine similarity or dot product) to find semantically similar chunks.

**Strengths**: Captures meaning, handles synonyms
**Weaknesses**: Can miss exact keyword matches

### Sparse Retrieval (BM25)

Traditional keyword-based search using term frequency.

**Strengths**: Exact matches, handles rare terms well
**Weaknesses**: Misses semantic similarity

### Hybrid Retrieval

Combines dense and sparse retrieval, then merges results.

```
Dense results (semantic) + Sparse results (keyword) → Reciprocal Rank Fusion → Final ranking
```

**Why hybrid works**: Captures both semantic meaning and exact keyword matches. Often outperforms either approach alone.

### Multi-Query Retrieval

Generate multiple query variations, retrieve for each, then combine results.

```
Original: "How do I deploy to production?"
Variations:
- "Production deployment process"
- "Steps for releasing to production"
- "How to push code to production environment"
```

This increases recall by capturing different phrasings of the same intent.

### Retrieval Parameters

| Parameter | Effect | Guidance |
|-----------|--------|----------|
| **Top-K** | Number of chunks retrieved | Start with 3-5, increase if missing relevant content |
| **Similarity threshold** | Minimum relevance score | Use to filter out weak matches |
| **Diversity** | Variety in results | Maximal marginal relevance (MMR) reduces redundancy |

---

## Reranking

Reranking uses a more sophisticated model to reorder retrieved chunks by relevance to the query.

### Why Rerank?

Embedding similarity is fast but imperfect. A reranker examines query-chunk pairs more carefully, improving precision.

**Typical flow**:
1. Retrieve top 20-50 chunks (fast, approximate)
2. Rerank to find top 5 (slower, more accurate)
3. Use top 5 for generation

### Reranking Options

| Reranker | Type | Strengths |
|----------|------|-----------|
| **Cohere Rerank** | API | High quality, easy integration |
| **BGE Reranker** | Open source | Self-hosted, good performance |
| **Cross-encoder models** | Open source | Fine-tunable |
| **LLM-based reranking** | Any LLM | Flexible, expensive |

### When to Rerank

- When retrieval precision matters more than latency
- When you retrieve many candidates and need the best few
- When embedding similarity alone produces mixed-quality results

---

## Context Assembly

How you combine retrieved chunks into the prompt affects generation quality.

### Basic Assembly

Concatenate chunks with source attribution:

```
Based on the following information:

[Source: deployment-guide.md]
Deployments require approval from the security team...

[Source: release-process.md]
Production releases happen on Tuesdays and Thursdays...

Answer the user's question: {query}
```

### Advanced Assembly Patterns

**Summarization**: Summarize chunks before including (reduces token count)

**Hierarchical**: Include document summaries plus relevant chunks

**Citation-focused**: Structure for easy source citation in response

### Context Window Management

| Challenge | Solution |
|-----------|----------|
| **Too many chunks** | Rerank and take top K; summarize |
| **Chunks too long** | Smaller chunk size; extract relevant sentences |
| **Redundant content** | Deduplicate; use MMR for diversity |
| **Missing context** | Include parent/sibling chunks; expand retrieval |

---

## Evaluation

Measuring RAG quality requires evaluating both retrieval and generation.

### Retrieval Metrics

| Metric | What It Measures |
|--------|-----------------|
| **Recall@K** | Fraction of relevant documents in top K |
| **Precision@K** | Fraction of top K that are relevant |
| **MRR** (Mean Reciprocal Rank) | Position of first relevant result |
| **NDCG** | Ranking quality (position-weighted) |

### Generation Metrics

| Metric | What It Measures |
|--------|-----------------|
| **Faithfulness** | Does the response accurately reflect retrieved content? |
| **Relevance** | Does the response answer the question? |
| **Groundedness** | Is every claim supported by retrieved documents? |

### Evaluation Approaches

**Automated**: Use LLMs to judge response quality (faster, scalable)
**Human evaluation**: Manual review (slower, more reliable)
**A/B testing**: Compare RAG variants with real users

### Common Evaluation Tools

- **Ragas**: Open-source RAG evaluation framework
- **LangSmith**: Tracing and evaluation from LangChain
- **TruLens**: Evaluation and observability
- **Custom LLM judges**: Prompt an LLM to score responses

---

## Production Considerations

### Performance Optimization

| Bottleneck | Solutions |
|------------|-----------|
| **Embedding latency** | Batch processing, caching, smaller models |
| **Vector search latency** | Index optimization, approximate search, filtering |
| **LLM generation** | Streaming, caching common queries |

### Monitoring

Track these metrics in production:
- Retrieval latency and hit rates
- Generation latency and token usage
- User feedback (thumbs up/down, edits)
- Failure rates and error types

### Keeping Knowledge Current

| Update Frequency | Strategy |
|------------------|----------|
| **Real-time** | Streaming updates to vector DB |
| **Daily/weekly** | Scheduled re-indexing |
| **On-demand** | Webhook-triggered updates |

### Cost Management

| Cost Driver | Optimization |
|-------------|--------------|
| **Embedding API calls** | Cache embeddings, batch requests |
| **Vector database** | Right-size instance, use filtering |
| **LLM tokens** | Chunk size optimization, caching |

---

## Common Patterns

### Conversational RAG

Maintain conversation history and reformulate queries:

```
History: [previous Q&A exchanges]
Current question: "What about the second option?"

→ Reformulate: "What are the details of [second option from previous answer]?"
→ Retrieve with reformulated query
```

### Multi-Index RAG

Different indexes for different content types:

```
Query → Route to appropriate index:
  - Code questions → Code index
  - Policy questions → Policy index
  - General questions → General index
```

### Self-RAG

Model decides when to retrieve vs. use internal knowledge:

```
Query → Should I retrieve?
  → Yes: Retrieve and generate
  → No: Generate directly
```

### Agentic RAG

Agent decides retrieval strategy dynamically:

```
Query → Plan retrieval approach
  → Execute multiple retrievals if needed
  → Synthesize results
  → Verify sufficiency
  → Generate or retrieve more
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Retrieve everything** | Noise drowns signal | Tune top-K, use reranking |
| **Ignore metadata** | Miss filtering opportunities | Filter by source, date, type |
| **One-size-fits-all chunks** | Poor retrieval for diverse content | Content-specific chunking |
| **No evaluation** | Don't know if it's working | Implement metrics early |
| **Stale indexes** | Outdated information | Scheduled or triggered updates |

---

## Quick Reference

### RAG Pipeline Checklist

1. [ ] Documents loaded and preprocessed
2. [ ] Chunking strategy matches content type
3. [ ] Embedding model selected and consistent
4. [ ] Vector database provisioned and indexed
5. [ ] Retrieval tested with sample queries
6. [ ] Reranking added if precision matters
7. [ ] Context assembly handles edge cases
8. [ ] Evaluation metrics implemented
9. [ ] Monitoring in place

### When RAG Struggles

| Situation | Why | Mitigation |
|-----------|-----|------------|
| **Complex reasoning** | Retrieved context insufficient | Multi-step retrieval, agentic approach |
| **Highly ambiguous queries** | Multiple valid interpretations | Query clarification, multi-query |
| **Cross-document synthesis** | Information scattered | Graph-based RAG, summarization |
| **Rapidly changing data** | Index staleness | Real-time updates, freshness signals |
