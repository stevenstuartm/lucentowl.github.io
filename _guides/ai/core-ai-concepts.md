---
title: "Core AI Concepts"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Foundational concepts for understanding generative AI: how LLMs work, tokens, context windows, embeddings, parameters, skills vs tools, and model limitations."
tags: [ai, generative-ai, llm, fundamentals, embeddings, transformers, tools]
---

## How Large Language Models Work

Large Language Models (LLMs) are neural networks trained on massive text datasets to understand and generate human-like language. Understanding their architecture helps explain both their capabilities and limitations.

### The Transformer Architecture

Modern LLMs are built on the transformer architecture, introduced in the 2017 paper "Attention Is All You Need" by Vaswani et al. at Google. This architecture revolutionized natural language processing.

**Why transformers changed everything**:
- **Parallelization**: Unlike earlier architectures (RNNs), transformers process entire sequences simultaneously, enabling massive GPU acceleration
- **Long-range dependencies**: Captures relationships between distant words effectively
- **Scalability**: Performance improves with more data and compute, with no apparent ceiling yet
- **Transfer learning**: Pre-trained models can be adapted for specific tasks

### Core Components

| Component | Function |
|-----------|----------|
| **Self-attention layers** | Allow each position to attend to all other positions |
| **Feed-forward networks** | Process attention outputs |
| **Positional encoding** | Provides sequence order information |
| **Multi-head attention** | Multiple attention mechanisms working in parallel |

### How Generation Works

LLMs generate text one token at a time, predicting the most likely next token based on all previous tokens. The model doesn't "think" or "understand" in a human sense; it calculates probability distributions over possible continuations.

```
Input: "The capital of France is"
Model predicts: "Paris" (highest probability)
```

This autoregressive generation means the model can produce fluent text but can also confidently generate incorrect information.

---

## Tokens and Tokenization

Tokens are the fundamental units LLMs use to process text. Understanding tokenization helps explain model behavior, costs, and limitations.

### What Are Tokens?

Tokens can be words, parts of words, or individual characters, depending on the tokenization method. Most modern LLMs use subword tokenization like BPE (Byte Pair Encoding).

**Examples**:
```
"Hello world" → ["Hello", " world"] (2 tokens)
"tokenization" → ["token", "ization"] (2 tokens)
"🎉" → ["🎉"] (1 token, but may vary by model)
```

### Why Tokenization Matters

| Aspect | Impact |
|--------|--------|
| **Cost** | API pricing is per token; understanding token count helps predict costs |
| **Context limits** | Context windows are measured in tokens, not words or characters |
| **Performance** | Rare words may tokenize into many pieces, affecting model behavior |
| **Languages** | Non-English text often requires more tokens for the same content |

### Token Estimates

| Content | Approximate Ratio |
|---------|-------------------|
| **English text** | ~0.75 tokens per word |
| **Code** | ~1.5 tokens per line (varies by language) |
| **Non-Latin scripts** | 2-4x more tokens than English equivalent |

### Practical Implications

- Long prompts consume more of your context window
- Unusual words or technical terms may tokenize inefficiently
- Token counts for the same meaning vary across models

---

## Context Windows

The context window is the maximum amount of text (in tokens) a model can consider at once. Everything the model knows about your conversation must fit within this window.

### How Context Windows Work

```
┌─────────────────────────────────────────────┐
│              Context Window                  │
│  ┌───────────────────────────────────────┐  │
│  │ System prompt + conversation history   │  │
│  │ + current input + space for output     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Everything must fit: system instructions, previous messages, any context you provide, your current input, AND space for the model's response.

### Context Window Sizes (2025)

| Model | Context Window |
|-------|---------------|
| **GPT-4 Turbo** | 128K tokens |
| **Claude 3** | 200K tokens |
| **Gemini 1.5 Pro** | 1M+ tokens |
| **Llama 3** | 8K-128K tokens |

Larger isn't always better; cost increases with context size, and some models perform worse on very long contexts.

### Managing Context

| Strategy | When to Use |
|----------|-------------|
| **Summarization** | Compress old conversation history |
| **Retrieval (RAG)** | Pull in only relevant context dynamically |
| **Truncation** | Remove oldest messages when limit approached |
| **Chunking** | Process long documents in pieces |

### The "Lost in the Middle" Problem

Research shows models pay more attention to the beginning and end of context windows. Information in the middle may be partially ignored. Place critical information at the start or end of your prompts.

---

## Key Parameters

Understanding model parameters helps you tune outputs for specific use cases.

### Temperature

Controls randomness in output generation. Lower values make output more deterministic; higher values make it more creative and varied.

| Temperature | Effect | Use Case |
|-------------|--------|----------|
| **0** | Deterministic (same input → same output) | Factual tasks, code generation |
| **0.3-0.5** | Mostly consistent with slight variation | General tasks |
| **0.7-1.0** | Creative, varied outputs | Creative writing, brainstorming |
| **>1.0** | Highly random, may become incoherent | Experimental only |

### Top-p (Nucleus Sampling)

Alternative to temperature. Only considers tokens whose cumulative probability exceeds the threshold.

- **Top-p = 0.9**: Consider tokens until 90% probability mass is covered
- Lower values = more focused, higher values = more diverse

Most practitioners use either temperature OR top-p, not both.

### Max Tokens

Limits the response length. Useful for controlling costs and preventing runaway responses.

- Set based on expected response length
- Too low may cut off responses mid-thought
- Too high wastes potential cost on unused capacity

### System Prompt

Background instructions that shape the model's behavior throughout the conversation. Sets persona, constraints, and behavioral guidelines.

```
System: You are a helpful coding assistant. Always explain your reasoning.
        Use Python for examples unless asked otherwise. Be concise.
```

### Other Parameters

| Parameter | Purpose |
|-----------|---------|
| **Frequency penalty** | Reduces repetition of tokens already used |
| **Presence penalty** | Reduces repetition of topics already discussed |
| **Stop sequences** | Tokens that signal the model to stop generating |

---

## Embeddings

Embeddings are dense vector representations that capture semantic meaning. They're fundamental to many AI applications, especially retrieval and similarity search.

### What Are Embeddings?

The name comes from the mathematical concept of embedding one space into another. An embedding model takes text, which lives in the messy, ambiguous space of human language, and maps it into a structured geometric space where meaning becomes measurable. The text is literally embedded into a vector space, and its position in that space encodes what it means.

The result is a fixed-size vector (array of numbers), typically 384-1536 dimensions. Similar concepts end up with similar vectors, enabling semantic comparison.

```
"How do I reset my password?"  →  [0.12, -0.45, 0.78, ...]
"I forgot my login credentials" →  [0.11, -0.43, 0.76, ...]
                                    (similar vectors!)

"The weather is nice today"     →  [0.89, 0.23, -0.15, ...]
                                    (different vector)
```

### How Similarity Works

Vector similarity (usually cosine similarity) measures how close two embeddings are:
- **1.0**: Identical meaning
- **0.0**: Unrelated
- **-1.0**: Opposite meaning (rare in practice)

### Embedding Use Cases

| Use Case | How Embeddings Help |
|----------|---------------------|
| **Semantic search** | Find documents by meaning, not keywords |
| **RAG retrieval** | Match queries to relevant knowledge chunks |
| **Clustering** | Group similar content together |
| **Classification** | Categorize text by comparing to examples |
| **Deduplication** | Find near-duplicate content |

### Embedding Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| **OpenAI text-embedding-3-small** | 1536 | High quality, easy API |
| **OpenAI text-embedding-3-large** | 3072 | Highest quality |
| **Sentence Transformers** | 384-768 | Open source, runs locally |
| **Cohere embed-v3** | 1024 | Strong multilingual |

**Key principle**: Always use the same embedding model for indexing and querying. Vectors from different models are incompatible.

### Storing and Searching Embeddings

An embedding is just a computed representation. Once generated, it's an array of numbers that can live anywhere: held in memory for a real-time comparison, written to a flat file for batch processing, or stored in a database column. A small application comparing a handful of documents might keep vectors in a simple list and compute cosine similarity directly. There's no requirement to use specialized infrastructure at small scale.

The storage question becomes interesting when the number of vectors grows. A real application might generate millions of embeddings across a document corpus, product catalog, or conversation history. At that scale, brute-force comparison (checking every stored vector against the query) becomes impractical, and standard databases aren't optimized for high-dimensional similarity search.

**Vector databases** solve this scaling problem. They store embeddings alongside metadata and provide fast similarity search using approximate nearest neighbor (ANN) algorithms. Instead of comparing against every stored vector, ANN algorithms build index structures that narrow the search space dramatically, trading a small amount of accuracy for orders-of-magnitude speed improvement.

| Database | Type | Good Fit |
|----------|------|----------|
| **Pinecone** | Managed cloud service | Teams that want zero infrastructure overhead |
| **Weaviate** | Open source, self-hosted or cloud | Flexible deployment with built-in hybrid search |
| **Qdrant** | Open source, self-hosted or cloud | High-performance filtering alongside vector search |
| **Milvus** | Open source | Massive scale (billion+ vectors) |
| **pgvector** | PostgreSQL extension | Teams already running Postgres who want to avoid a new database |
| **ChromaDB** | Open source, lightweight | Prototyping and small-scale applications |

**How the search works conceptually**: when a user submits a query, it gets converted to a vector using the same embedding model that indexed the documents. The vector database then finds the stored vectors closest to this query vector using cosine similarity or dot product distance, returning the most semantically relevant results.

**Metadata filtering** adds precision beyond pure vector similarity. Most vector databases let you store metadata (source, date, category, access level) alongside each vector and filter on it during search. A query like "find documents similar to this question, but only from the engineering team's knowledge base created in the last 6 months" combines semantic search with structured filtering.

For production patterns around chunking, retrieval strategies, and building full pipelines with vector databases, see the [RAG guide](/study-guides/ai/rag-retrieval-augmented-generation.html).

---

## Model Capabilities and Limitations

Understanding what models can and cannot do helps set appropriate expectations.

### What LLMs Do Well

| Capability | Why |
|------------|-----|
| **Language fluency** | Trained on massive text corpora |
| **Pattern recognition** | Statistical patterns in training data |
| **Following instructions** | RLHF training on instruction-following |
| **Code generation** | Extensive code in training data |
| **Summarization** | Compressing information while preserving meaning |
| **Translation** | Multilingual training data |

### What LLMs Struggle With

| Limitation | Why |
|------------|-----|
| **Factual accuracy** | Generate plausible-sounding text, not verified facts |
| **Current events** | Knowledge frozen at training cutoff |
| **Math and logic** | Predict tokens, don't compute |
| **Counting and precise tasks** | Tokenization obscures character/word boundaries |
| **Consistent persona** | May drift across long conversations |
| **Saying "I don't know"** | Trained to be helpful, may fabricate |

### Hallucination

Hallucination occurs when models generate information that appears plausible but is false. This happens because:
- Models predict likely text, not verified facts
- Training data contains errors
- Models aim to be helpful, even when uncertain

**Mitigation strategies**:
- Ask for sources (models may still fabricate them)
- Use RAG to ground responses in real documents
- Verify critical information independently
- Lower temperature for factual tasks

### Knowledge Cutoff

Models only know information from their training data. They have no awareness of events after their training cutoff date.

**Implications**:
- Can't answer about recent events
- May have outdated information about evolving topics
- Use RAG or web search for current information

---

## Skills vs Tools

When building on top of LLMs, every capability you expose falls into one of two categories: a **skill** that the model performs natively through prompting, or a **tool** that the model invokes to interact with an external system. The distinction matters because it drives architecture decisions, cost profiles, latency characteristics, and failure modes.

### What Are Skills?

Skills are capabilities the model already has. They come from training data, and you access them entirely through prompt design. No external integration, no API calls, no infrastructure beyond the model itself.

| Skill | What the Model Does Natively |
|-------|------------------------------|
| **Summarization** | Compress long text into key points |
| **Translation** | Convert between languages |
| **Classification** | Sort inputs into categories |
| **Extraction** | Pull structured data from unstructured text |
| **Reasoning** | Draw conclusions, compare options, analyze tradeoffs |
| **Code generation** | Write, explain, or refactor code |
| **Creative writing** | Draft prose, marketing copy, or technical documentation |
| **Reformatting** | Convert between formats like JSON, CSV, XML, or markdown |

Skills require no external infrastructure, but they are not free. Every skill invocation runs through inference, which means every input token and output token costs money and takes time. Summarizing a 50-page document means sending the entire document through the model. Translating a large codebase means processing every file as tokens. For large inputs, skills can be the most expensive part of a pipeline because there is no shortcut around token consumption.

The other tradeoff is that skills are bounded by training data. A model can summarize a document you provide, but it cannot look up a document it hasn't seen. It can reason about data in context, but it cannot compute a precise financial projection across thousands of rows. It can generate code in languages it was trained on, but it cannot execute that code to verify it works.

### What Are Tools?

Tools are external functions the model can call to extend beyond what it learned during training. When the model encounters a task that requires current data, precise computation, or interaction with the outside world, it generates a structured request to invoke a tool, receives the result, and incorporates that result into its response.

Common tool categories include:

- **Information retrieval**: web search, database queries, file system access, API calls to external services
- **Computation**: code execution, calculators, data analysis engines
- **State modification**: creating files, sending messages, updating records, deploying code
- **Verification**: running tests, checking URLs, validating schemas

Tools require infrastructure. Someone has to define the tool's interface, host the execution environment, handle authentication, and manage failures. The model doesn't "use" the tool directly; it generates a request (typically a function name and arguments), the orchestration layer executes it, and the result flows back into the model's context for the next inference step.

For a deeper look at how tools work in agent architectures, see the [AI Agents guide](/study-guides/ai/ai-agents.html#tool-use). For the standard protocol that connects models to tools, see the [MCP guide](/study-guides/ai/model-context-protocol.html).

### When to Use Each

The choice between a skill and a tool depends on what the task actually requires. Some tasks are clearly one or the other, but many sit in a gray area where either approach could work.

| Dimension | Skill (Native) | Tool (External) |
|-----------|----------------|-----------------|
| **Latency** | Scales with input/output token count | Tool execution is often instant; round-trip adds overhead |
| **Cost** | All processing burns tokens (can be expensive for large inputs) | Tool execution itself is often free; results re-enter token stream |
| **Accuracy** | Probabilistic, may hallucinate | Deterministic for computation and data retrieval |
| **Current data** | Limited to training cutoff | Can access real-time information |
| **Computation** | Approximate reasoning | Precise execution |
| **Side effects** | None (read-only by nature) | Can modify state in external systems |
| **Failure modes** | Hallucination, reasoning errors | Network failures, auth errors, timeouts, malformed requests |
| **Infrastructure** | None beyond the model | Requires tool definitions, hosting, error handling |

**Use a skill when** the task is pattern recognition, language transformation, or reasoning over context that's already in the prompt. Summarizing a meeting transcript, classifying support tickets, extracting entities from an email, or drafting a response based on provided guidelines are all skill-native tasks.

**Use a tool when** the task requires something the model cannot do from memory: fetching live data, performing exact arithmetic, executing code, modifying external state, or verifying facts against an authoritative source.

### Tradeoffs in Practice

The tension between skills and tools plays out in real system design decisions.

**Over-relying on skills** leads to hallucination risk. A model asked to "look up the current price of AAPL stock" will generate a plausible-looking number from training data rather than admitting it doesn't know. Without a tool to fetch the actual price, the output looks confident but is wrong. Any task where accuracy depends on data the model hasn't seen requires a tool.

**Over-relying on tools** leads to unnecessary complexity. If a model has a web search tool available and a user asks "what is a binary search tree?", the model might invoke the search tool to answer a question it already knows well from training. The tool result then enters the context window, consuming additional tokens on the next inference call and introducing a failure point that didn't need to exist. When the model can handle a task accurately from training data, a tool call adds infrastructure burden without improving quality.

**The gray area** is where it gets interesting. Consider math: a model can reason through simple arithmetic and get it right most of the time, but it will occasionally make errors on multi-step calculations. A code execution tool will always get the math right and runs instantly, but requires infrastructure to define and host. The right choice depends on how much accuracy matters for the use case. A rough estimate in a brainstorming session favors the skill; a financial calculation in a production system demands the tool.

### Decision Framework

When deciding whether a capability should be a skill or a tool, work through these questions:

**Does the task require information the model hasn't seen?** If the answer depends on data after the training cutoff, data in a private database, or real-time state, you need a tool. No amount of prompt engineering gives a model access to information that isn't in its context window.

**Does the task require deterministic precision?** Mathematical calculations, date arithmetic, regex matching, and data aggregation across large datasets all benefit from tools. Models approximate these operations through pattern matching and will occasionally produce wrong results, especially as complexity increases.

**Does the task require action in the outside world?** Sending emails, creating files, updating databases, and deploying code are all side effects that require tools. Skills are inherently read-only: they transform input into output but cannot change state beyond the conversation.

**Is the model already good at this from training?** Summarization, classification, translation, code generation, and text analysis are tasks where models are strong out of the box. Adding a tool for these capabilities typically adds cost and latency without improving quality. Invest in better prompts before reaching for a tool.

**How much does an error cost?** For low-stakes tasks like drafting an email or generating test ideas, skill-level accuracy is usually sufficient. For high-stakes tasks like calculating dosages, generating legal documents, or making financial decisions, tool-backed verification is worth the added complexity.

---

## Model Types and Sizes

Different models serve different purposes. Understanding the landscape helps with selection.

### Model Size Impacts

| Size | Typical Params | Characteristics |
|------|----------------|-----------------|
| **Small** | 1-7B | Fast, cheap, basic tasks |
| **Medium** | 7-30B | Good balance, most tasks |
| **Large** | 30-70B | Complex reasoning, nuanced tasks |
| **Frontier** | 100B+ | State-of-the-art capabilities |

Larger models generally perform better but cost more and run slower.

### Model Types

| Type | Examples | Best For |
|------|----------|----------|
| **General purpose** | GPT-4, Claude, Gemini | Wide range of tasks |
| **Code-focused** | Codex, StarCoder, DeepSeek Coder | Programming tasks |
| **Instruction-tuned** | ChatGPT, Claude | Following directions |
| **Base models** | Llama base | Fine-tuning starting point |

### Open vs. Closed Models

| Aspect | Open Models | Closed Models |
|--------|-------------|---------------|
| **Access** | Download and run anywhere | API access only |
| **Cost** | Infrastructure costs | Per-token pricing |
| **Privacy** | Data stays local | Data sent to provider |
| **Customization** | Fine-tuning possible | Limited or none |
| **Examples** | Llama, Mistral | GPT-4, Claude |

---

## Quick Reference

### Key Metrics to Know

| Metric | What It Means |
|--------|---------------|
| **Tokens** | Processing units; ~0.75 per English word |
| **Context window** | Max input + output size |
| **Temperature** | Randomness control (0 = deterministic) |
| **Embedding dimensions** | Vector size for semantic representation |

### Common Token Estimates

| Content Type | Tokens |
|--------------|--------|
| 1 page of text | ~500-800 tokens |
| 1 paragraph | ~100-150 tokens |
| Average email | ~200-400 tokens |
| Code file (100 lines) | ~150-300 tokens |

### Parameter Cheat Sheet

| Task | Temperature | Other Settings |
|------|-------------|----------------|
| Code generation | 0-0.3 | Clear, consistent output |
| Factual Q&A | 0-0.3 | Accuracy matters |
| Creative writing | 0.7-1.0 | Variety desired |
| Brainstorming | 0.8-1.0 | Many ideas wanted |
| General chat | 0.5-0.7 | Balance |
