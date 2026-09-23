---
layout: guide
title: "Search Engines"
category: Databases
subcategory: Database Types
description: "How search engines like Elasticsearch and OpenSearch build inverted indexes, analyze text, rank results with BM25, and power faceted search, and why they sit beside a database rather than replacing it."
tags: [full-text-search, inverted-index, relevance, bm25, elasticsearch, practical]
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
       → Score each matching document     → doc 2 (score: 0.89),
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

Not all matches are equal. The classic scoring idea, TF-IDF (term frequency times inverse document frequency), ranks a document higher when a query term appears in it often and when that term is rare across the whole collection, so "performance" counts for more than "the." **BM25**, the default in Elasticsearch, OpenSearch, and Solr, refines this so repeated terms add less and less, and a match in a short document counts for more than the same match in a long one. On top of the text score, engines let you boost fields, such as weighting a title match above a body match, and blend in signals like recency or popularity.

### Faceting and Aggregation

Beyond finding documents, search engines can compute aggregations like counting documents by category, finding the price range across matching products, and bucketing by date. This powers the filtering UI on e-commerce sites.

### Near-Real-Time Indexing

New documents aren't searchable the instant they're written. The engine buffers them and periodically makes the buffer searchable, which Elasticsearch calls a refresh and does about once a second by default. Refreshing less often speeds up bulk indexing at the cost of freshness.

---

## Why They Excel

### Relevance-Ranked Results

Search engines return results sorted by relevance, not just matching everything that contains a keyword.

### Linguistic Intelligence

Stemming, synonyms, and language-specific analysis make search feel natural to users.

### Performance at Scale

Inverted indexes make searching millions of documents fast, and an index is split into shards spread across nodes, so the collection and the query load can both grow.

### Faceted Navigation

The aggregation capabilities power the filters and counts that users expect in search interfaces.

---

## Why They Struggle

### Not a System of Record

Search engines are designed for search, not primary storage. Data should live in a database of record with the search engine as a derived index.

### Eventual Consistency

There's a delay between writing a document and being able to find it, and the index lags the database of record by however long the sync pipeline takes. Search engines also don't offer multi-document transactions.

### Operational Complexity

Clusters need capacity planning, shard sizing, and monitoring. The number of primary shards is set when an index is created, so growth beyond the original plan usually means creating a new index and reindexing into it.

---

## When to Use Them

Search engines are appropriate for:

- **Product search**: E-commerce with filtering, sorting, relevance
- **Content discovery**: Documentation, knowledge bases, help centers
- **Log analysis**: Searching through millions of log lines
- **Any application where users type natural-language queries expecting ranked results**

---

## When to Look Elsewhere

Don't use a search engine as your primary database, for simple key-based lookups, or where exact matching matters more than relevance. For modest full-text needs, the built-in full-text search in PostgreSQL or another relational database avoids running and syncing a second system.

---

## Examples

**Elasticsearch** is the most widely used search engine, and together with Logstash and Kibana forms the Elastic Stack, which is common for log analysis. Elastic moved it off the Apache 2.0 license in 2021 and added the open-source AGPL as an option in 2024. **OpenSearch** is the Apache 2.0 fork that AWS started in 2021, now governed by the OpenSearch Software Foundation under the Linux Foundation. **Apache Solr** is the older Lucene-based engine, still common in enterprise and site search. **Typesense** and **Meilisearch** are lighter engines aimed at fast setup and typo-tolerant search for applications.

---
