---
title: "Retrieval-Augmented Generation (RAG)"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "Grounding LLM answers in your own documents: when retrieval beats putting everything in the prompt, chunking and contextual retrieval, hybrid search and rank fusion, query rewriting, reranking, permission filtering, evaluating retrieval, and GraphRAG and agentic variants."
tags: [rag, hybrid-search, chunking, reranking, embeddings, retrieval-evaluation, practical]
---

**Retrieval-augmented generation (RAG)** answers a question by first searching a collection of documents for relevant passages, then giving those passages to a language model along with the question. The model's knowledge stays frozen at its training cutoff and never included your private data, but the retrieved passages can be current, proprietary, and cited.

The term comes from [Lewis et al. (2020)](https://arxiv.org/abs/2005.11401){:target="_blank" rel="noopener noreferrer"}, which combined a model's parametric memory, the knowledge stored in its weights, with a non-parametric memory in the form of a searchable document index. It pointed to two advantages that still motivate RAG: answers can show their provenance, and knowledge can be updated by changing the index instead of retraining the model.

## When RAG Is the Right Tool

### What Retrieval Fixes and What It Doesn't

RAG gives a model access to information it wasn't trained on, like internal documentation, a product catalog, contracts, or last week's incident reports. It reduces fabrication on questions those documents answer, and it lets answers cite the passages they came from so a reader can check them.

It doesn't teach a model new skills, change its tone or output format, or make it reason better. It also adds a new way to be wrong. If retrieval returns the wrong passages, the model confidently answers from the wrong material. Most RAG quality work is retrieval work.

### Sometimes the Whole Corpus Fits in the Prompt

Retrieval exists because relevant material doesn't fit in the context window, or would be expensive to send on every request. When it does fit, skipping retrieval removes a whole class of failures. Anthropic's [contextual retrieval write-up](https://www.anthropic.com/news/contextual-retrieval){:target="_blank" rel="noopener noreferrer"} suggests that a knowledge base smaller than about 200,000 tokens (roughly 500 pages) can simply be included in the prompt, with prompt caching reducing the cost of resending it. Retrieval earns its complexity once the corpus is too large, changes too often to cache, or has to respect per-user access rules.

Retrieval also isn't the tool for changing how a model behaves. RAG changes what the model knows at answer time. Fine-tuning changes how it responds.

---

## How a RAG System Works

A RAG system is two pipelines that share an index.

{% include figure.html id="llm-rag-pipelines" %}

Each stage can lose the answer. Poor parsing drops a table, a chunk boundary splits a fact from its subject, the query uses different words from the document, or the right passage ranks just below the cutoff. Debugging a RAG system means working out which stage failed, which is covered at the end of this guide.

### Parsing and Cleaning Source Documents

Quality starts before chunking. PDFs lose their reading order and table structure when converted to plain text, HTML pages carry navigation menus and footers that pollute every chunk, and scanned documents need text recognition. Preserve structure where you can, such as headings, lists, and tables converted to Markdown, strip repeated boilerplate, and record metadata like title, source URL, author, date, and access permissions alongside the text. That metadata powers filtering and citations later.

---

## Chunking

### Why Chunk Boundaries Matter

Documents are split into **chunks** that are embedded and retrieved individually. Chunking is necessary when documents exceed the embedding model's input limit, and beneficial even when they don't, because a single vector for a long, multi-topic document represents none of its topics well. Microsoft's [chunking guidance for Azure AI Search](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents){:target="_blank" rel="noopener noreferrer"} notes, for example, that `text-embedding-3-small` accepts at most 8,191 tokens of input.

The trade-off is precision against context. A small chunk matches a query precisely but may lack the surrounding information needed to answer. A large chunk carries context but dilutes its embedding with unrelated content and consumes more of the prompt.

| Smaller chunks | Larger chunks |
|---|---|
| More precise matches | More surrounding context per chunk |
| Can separate a fact from what it refers to | Embeddings blur across several topics |
| More chunks to store and search | Fewer chunks, but more tokens per retrieved result |

### Chunking Methods

| Method | How it works | Suits |
|---|---|---|
| **Fixed size with overlap** | Split every N tokens, repeating some text across boundaries | A baseline for uniform prose |
| **Recursive or structure-aware** | Split on the largest natural boundary that fits (sections, then paragraphs, then sentences) | Most documents with headings and paragraphs |
| **By document element** | One chunk per section, function, clause, message, or FAQ entry | Code, contracts, conversations, structured docs |
| **Semantic** | Split where the topic shifts, detected by comparing embeddings of neighboring sentences | Long unstructured text, at higher indexing cost |

Microsoft's guidance suggests starting with chunks of 512 tokens and an overlap of 25%, then adjusting based on content and measured retrieval quality. Treat any starting size as a hypothesis to test, not a setting to trust.

### Adding Context to Chunks

A chunk that reads "Revenue grew 3% over the previous quarter" is nearly unfindable, because it doesn't say which company or quarter. Two remedies help:

- **Prepend fixed context** such as the document title and section heading to each chunk before embedding.
- **Generate chunk-specific context** with a model. Anthropic's **contextual retrieval** has a model write a short explanation situating each chunk within its whole document, prepended before both embedding and keyword indexing. In Anthropic's tests, this reduced the rate of failing to retrieve a relevant chunk in the top 20 by 35% with contextual embeddings alone, by 49% when keyword search also used the added context, and by 67% when reranking was added. Generating context costs a model call per chunk at indexing time, which prompt caching of the source document makes affordable.

---

## Embedding for Retrieval

Embedding models map text to vectors so that similar meanings land close together. For retrieval, the choice of model matters more than almost any other setting, and the best model depends on the data. The [MTEB benchmark](https://arxiv.org/abs/2210.07316){:target="_blank" rel="noopener noreferrer"} found that no single embedding method dominated across all its tasks, so leaderboard rankings are a starting shortlist, not an answer. Evaluate two or three candidates on a sample of your own queries and documents.

Practical constraints narrow the choice as well: the model's maximum input length, its supported languages, whether it can run in your environment, and its cost per token. Because documents and queries must be embedded with the same model, switching models later means re-embedding the entire corpus. Store vectors alongside the chunk text and metadata. At large scale, a [vector database](/study-guides/data/vector-databases.html) or a search engine with vector support provides the approximate nearest-neighbor indexes that keep search fast.

---

## Retrieval

### Dense, Sparse, and Hybrid Search

**Dense retrieval** compares the query's embedding with chunk embeddings. It handles paraphrase and synonyms well, but can miss exact identifiers like error codes, product SKUs, or unusual names, since their meaning isn't well represented in the vector.

**Sparse retrieval**, typically BM25, scores documents by the query's words, weighting rare terms more. It excels at exact terms and fails when the query and document use different words for the same thing.

**Hybrid retrieval** runs both and merges the ranked lists, and it commonly outperforms either alone. The scores from the two methods aren't on comparable scales, so fusion usually works from ranks. **Reciprocal rank fusion** ([Cormack, Clarke, and Büttcher, 2009](https://dl.acm.org/doi/10.1145/1571941.1572114){:target="_blank" rel="noopener noreferrer"}) gives each document a score of 1/(k + rank) from each list and sums them, with k conventionally set to 60. A document ranked highly by both methods rises to the top, and no score normalization is needed.

### Filtering by Metadata and Permissions

Structured filters narrow retrieval before or during similarity search, for example to documents from a given product, region, or date range, or to the current version of a policy. Filters often fix wrong answers that no amount of embedding tuning would, such as an outdated policy outranking the current one.

**Permissions belong in the retrieval query.** If a user can't open a document, retrieval must not return its chunks, because anything placed in the prompt can appear in the answer. Store access-control information with each chunk, filter on the requesting user's identity at query time, and keep those permissions in sync with the source system. Checking permissions after generation is too late.

### Rewriting the Query

Users write short, ambiguous, or conversational questions that don't resemble the documents that answer them. Query transformation closes that gap:

- **Conversational reformulation.** In a chat, "What about the second option?" means nothing on its own. A model rewrites it into a standalone query using the conversation history before retrieval.
- **Multi-query expansion.** A model generates several phrasings of the question, each is retrieved, and the results are fused. This raises recall at the cost of more searches.
- **Hypothetical document embeddings (HyDE).** [Gao et al. (2022)](https://arxiv.org/abs/2212.10496){:target="_blank" rel="noopener noreferrer"} have a model write a plausible answer passage and embed that instead of the question, since an answer resembles the target documents more closely than a question does. It needs no relevance labels, though a hallucinated passage can steer retrieval wrong.
- **Decomposition.** A question with several parts is split into sub-questions, each retrieved separately.

### How Many Chunks to Retrieve

Retrieving too few chunks misses answers that rank just below the cutoff, while retrieving too many adds noise, cost, and conflicting passages. The right number depends on chunk size, the context window, and whether a reranker narrows the candidates. In Anthropic's contextual retrieval experiments, passing the top 20 chunks to the model worked better than the top 10 or top 5. When many retrieved chunks are near-duplicates, **maximal marginal relevance** selects results that are both relevant and different from those already chosen.

---

## Reranking

Retrieval models are built for speed across millions of chunks. The [Sentence Transformers documentation](https://sbert.net/examples/cross_encoder/applications/README.html){:target="_blank" rel="noopener noreferrer"} explains the underlying trade-off. A **bi-encoder**, the kind of model used for embeddings, encodes the query and each document separately, so document vectors can be computed once and searched quickly. A **cross-encoder** reads the query and a document together and outputs a relevance score. That's more accurate, but it produces no reusable embedding and has to run once per query-document pair, which is far too slow to apply to a whole collection.

{% include figure.html id="llm-bi-vs-cross-encoder" %}

So the two are combined. Retrieve a broad candidate set cheaply (say, the top 100), rerank those candidates with a cross-encoder, and pass the best few to the model. A general-purpose LLM can also act as the reranker, which is flexible but slower and more expensive. Reranking adds latency to every query, so apply it where precision matters more than response time.

---

## Assembling the Prompt

- **Label each passage with its source**, so the model can cite it and a reader can verify it.
- **Instruct the model to answer from the provided passages** and to say when they don't contain the answer, rather than filling gaps from its own knowledge.
- **Put the passages before the question**, which tends to improve answers on long, multi-document inputs.
- **Resolve conflicts explicitly.** When passages disagree, tell the model how to handle it, for example to prefer the most recent document and to mention the discrepancy.

```
<documents>
<document source="expense-policy-2026.md" updated="2026-03-01">
Meals during business travel are reimbursed up to $75 per day...
</document>
<document source="expense-policy-2024.md" updated="2024-02-15">
Meals during business travel are reimbursed up to $60 per day...
</document>
</documents>

Answer the question using only the documents above. Cite the source of each
fact. If documents conflict, use the most recently updated one and note the
conflict. If the documents don't answer the question, say so.

Question: [the user's question]
```

Retrieved text is untrusted input. A document in the index can contain instructions aimed at the model, and retrieval will faithfully place them in the prompt. Treat retrieved content as data, and don't let it grant the model capabilities or permissions.

---

## Evaluating Retrieval

Evaluate retrieval separately from answer quality. If the right passage isn't retrieved, no prompt can fix the answer, and measuring only the final output hides where the problem is. Build a set of realistic questions, each labeled with the chunks or documents that answer it, and measure:

| Metric | Measures | Use to catch |
|---|---|---|
| **Recall@k** | Share of questions whose relevant passage appears in the top k | Answers that never reach the model |
| **Precision@k** | Share of the top k that is relevant | Noise that crowds the prompt |
| **Mean reciprocal rank (MRR)** | How high the first relevant result ranks, averaged across questions | Relevant results ranked too low to survive the cutoff |
| **nDCG** | Ranking quality that rewards relevant results appearing earlier, with graded relevance | Overall ranking regressions |

Re-run the set whenever chunking, the embedding model, filters, or reranking changes. Then evaluate the generated answers too, including whether each claim is supported by the retrieved passages and whether the answer addresses the question.

---

## Keeping the Index Current

An index drifts out of date as sources change. Design ingestion to handle **updates**, re-chunking and re-embedding changed documents, and **deletions**, removing a deleted or access-revoked document's chunks promptly, since stale chunks keep appearing in answers. Change detection can be scheduled, triggered by events in the source system, or both. Record the source version and indexing time with each chunk so answers can state how current their sources are, and version the index when changing chunking or embedding models so you can compare the old and new configurations before switching.

---

## Beyond Basic RAG

### Self-RAG

[Self-RAG (Asai et al., 2023)](https://arxiv.org/abs/2310.11511){:target="_blank" rel="noopener noreferrer"} trains a language model to decide for itself when retrieval is needed and to emit special reflection tokens that critique both the retrieved passages and its own output. It retrieves on demand rather than for every query. It requires training a model to produce those tokens, so it's a technique for model builders rather than a prompt pattern for an existing model.

### Agentic Retrieval

Instead of a fixed pipeline, retrieval can be exposed to the model as a tool. The model decides whether to search, what to search for, and whether the results are sufficient, and it can search again with a refined query or query several indexes in turn. This handles multi-step questions that a single retrieval pass can't, at the price of more model calls, higher latency, and less predictable behavior.

### GraphRAG

Some questions aren't about any particular passage, such as "What are the main themes across these 10,000 support tickets?" Retrieving the top 20 chunks samples the corpus and can't answer them. [GraphRAG (Edge et al., 2024)](https://arxiv.org/abs/2404.16130){:target="_blank" rel="noopener noreferrer"} uses a model to extract an entity knowledge graph from the documents and to pre-generate summaries of communities of related entities, then answers these global sensemaking questions from those summaries. Indexing is far more expensive than standard RAG, so it suits corpora where corpus-wide questions matter.

---

## Diagnosing Wrong Answers

```
Is the answer wrong or incomplete?
└── Look at the retrieved passages. Is the needed information among them?
    ├── No ─► Retrieval problem
    │   ├── It isn't in the index at all ─► Fix ingestion, parsing, or freshness
    │   ├── It was filtered out ─► Check metadata filters and permissions
    │   ├── Exact terms (codes, names, IDs) missed ─► Add keyword search (hybrid)
    │   ├── Question wording differs from the documents ─► Rewrite or expand the query
    │   ├── It ranks just below the cutoff ─► Retrieve more candidates, then rerank
    │   └── The chunk lacks the context to match ─► Change chunking; add chunk context
    └── Yes ─► Generation problem
        ├── Too many, redundant, or conflicting passages ─► Rerank, deduplicate, narrow
        ├── The model answered from its own knowledge ─► Strengthen grounding instructions
        └── The answer needs the whole corpus ─► Corpus-level summaries (GraphRAG)
```

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Building RAG for a corpus that fits in the prompt** | Retrieval misses add errors for no benefit | Include the whole corpus, with prompt caching |
| **Vector search only** | Exact identifiers and rare terms are missed | Use hybrid retrieval with rank fusion |
| **Measuring only final answers** | Retrieval failures look like model failures | Evaluate retrieval with labeled questions |
| **Chunks stripped of their context** | Relevant chunks can't be matched to queries | Prepend titles and headings, or generate chunk context |
| **Filtering permissions after generation** | Restricted content leaks into answers | Filter by user permissions at retrieval time |
| **Never removing deleted or superseded documents** | Outdated or revoked content keeps appearing | Handle deletions and versions in ingestion |
| **Choosing an embedding model from a leaderboard alone** | Poor performance on your domain | Test candidates on your own queries |
| **Treating retrieved text as trusted** | Instructions inside documents steer the model | Treat retrieved content as data |
