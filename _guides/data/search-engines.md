---
layout: guide
title: "Search Engines"
category: Databases
subcategory: Database Types
description: "Deep dive into search engines—how they index unstructured text, rank by relevance, and power full-text search applications."
tags: [databases, search, elasticsearch, full-text, relevance, indexing]
---

## What They Are

Search engines index unstructured text for full-text search, returning results ranked by relevance. They solve a different problem than databases: not "retrieve the record with ID 123" but "find the most relevant documents containing 'database performance tuning.'"

Full-text search requires specialized data structures. Traditional database indexes map exact values to records. Search engines build inverted indexes that map terms to documents, enable relevance scoring, and handle linguistic variations (stemming "running" to "run," expanding synonyms, handling misspellings).

---

## Data Structure

```
DOCUMENTS (what you store):
┌────────┬─────────────────────────────────────────────────────────────┐
│  id    │  content                                                    │
├────────┼─────────────────────────────────────────────────────────────┤
│  1     │  "The quick brown fox jumps over the lazy dog"              │
│  2     │  "Quick database queries improve performance"               │
│  3     │  "The database jumped to a new performance level"           │
└────────┴─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Analysis (tokenize, stem, lowercase)
INVERTED INDEX (what the search engine builds):
┌────────────────┬────────────────────────────────────────────────────┐
│  TERM          │  DOCUMENT IDs (with positions)                     │
├────────────────┼────────────────────────────────────────────────────┤
│  brown         │  [1]                                               │
│  databas*      │  [2, 3]              ← Stemmed form                │
│  dog           │  [1]                                               │
│  fox           │  [1]                                               │
│  jump*         │  [1, 3]              ← "jumps" and "jumped" match  │
│  lazi*         │  [1]                                               │
│  level         │  [3]                                               │
│  perform*      │  [2, 3]              ← Stemmed form                │
│  queri*        │  [2]                                               │
│  quick         │  [1, 2]                                            │
└────────────────┴────────────────────────────────────────────────────┘

Query: "database performance"
       → Look up "databas*" → [2, 3]
       → Look up "perform*" → [2, 3]
       → Intersection + relevance scoring → doc 2 (score: 0.89),
                                            doc 3 (score: 0.76)
```

The inverted index maps terms to documents, making lookups fast. Analysis pipelines normalize text so that variations like "jumping" and "jumped" match the same term.

---

## How They Work

### Inverted Indexes

The core data structure. For each term that appears in any document, the index stores which documents contain that term and where. Searching for "database" jumps directly to the list of documents containing that word.

### Analysis Pipeline

Before indexing, text passes through analyzers that:

- **Tokenize**: Split into terms
- **Normalize**: Lowercase, remove accents
- **Stem**: Reduce to root forms
- **Optionally expand synonyms**

The same pipeline processes search queries, ensuring "Databases" matches documents containing "database."

### Relevance Scoring

Not all matches are equal. TF-IDF (term frequency-inverse document frequency) scores documents higher when they contain rare terms. BM25 improves on TF-IDF with better handling of document length. Modern search engines allow custom scoring with boosts and decay functions.

### Faceting and Aggregation

Beyond finding documents, search engines can compute aggregations like counting documents by category, finding the price range across matching products, and bucketing by date. This powers the filtering UI on e-commerce sites.

### Near-Real-Time Indexing

Documents become searchable within seconds of indexing. The engine balances index freshness against query performance.

---

## Why They Excel

### Relevance-Ranked Results

Search engines return results sorted by relevance, not just matching everything that contains a keyword.

### Linguistic Intelligence

Stemming, synonyms, and language-specific analysis make search feel natural to users.

### Performance at Scale

Inverted indexes make searching millions of documents fast.

### Faceted Navigation

The aggregation capabilities power the filters and counts that users expect in search interfaces.

---

## Why They Struggle

### Not a System of Record

Search engines are designed for search, not primary storage. Data should live in a database of record with the search engine as a derived index.

### Eventual Consistency

Indexing isn't instantaneous. There's a delay between writing data and it becoming searchable.

### Operational Complexity

Elasticsearch clusters require capacity planning, shard management, and monitoring.

---

## When to Use Them

Search engines are appropriate for:

- **Product search**: E-commerce with filtering, sorting, relevance
- **Content discovery**: Documentation, knowledge bases, help centers
- **Log analysis**: Searching through millions of log lines
- **Any application where users type natural-language queries expecting ranked results**

---

## When to Look Elsewhere

Don't use a search engine as your primary database. Don't use it for simple key-based lookups. Don't use it where exact matching matters more than relevance.

---

## Examples

**Elasticsearch** dominates enterprise search with a rich feature set, distributed architecture, and the ELK stack (Elasticsearch, Logstash, Kibana) for log analysis.

**OpenSearch** is Amazon's fork of Elasticsearch, fully open source under Apache 2.0 license.

**Apache Solr** is mature and feature-rich but has a steeper learning curve than Elasticsearch.

**Typesense** and **Meilisearch** focus on developer experience and ease of use, often described as "search that just works" compared to Elasticsearch's complexity.

---
