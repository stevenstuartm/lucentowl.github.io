---
title: "Core AI Concepts"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "How large language models work: transformers and token-by-token generation, tokenization, context windows and why every request resends the conversation, sampling parameters, embeddings, kinds of models, and the memory math for running models yourself."
tags: [transformers, tokenization, context-window, sampling, embeddings, quantization, fundamentals]
---

**Generative AI** describes models that produce new content, such as text, code, images, and audio, rather than only classifying or scoring existing data. **Large language models (LLMs)** are the generative models behind chat assistants, coding tools, and most AI features in software today. They're neural networks trained on very large amounts of text to predict what comes next, and nearly everything about how they behave, including what they cost, what they forget, and why they sometimes invent facts, follows from how that prediction works.

## How Large Language Models Work

### The Transformer Architecture

Modern LLMs are built on the transformer, introduced in the 2017 paper ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762){:target="_blank" rel="noopener noreferrer"} (Vaswani et al.). Earlier language models, based on recurrent neural networks, read text one word at a time and struggled to carry information across long passages. The transformer's **self-attention** mechanism lets every position in a sequence draw directly on every other position, so a pronoun can attend to the noun it refers to fifty words back. Because attention is computed across the whole sequence at once rather than step by step, training parallelizes well on GPUs, which is what made training on internet-scale text practical.

{% include figure.html id="ai-self-attention" %}

| Component | Role |
|---|---|
| **Self-attention** | Lets each token weigh the relevance of every other token in the context |
| **Multi-head attention** | Runs several attention computations in parallel, each free to track a different kind of relationship |
| **Feed-forward layers** | Transform each position's representation after attention, and hold much of the model's learned knowledge |
| **Positional information** | Tells the model the order of tokens, since attention on its own ignores order |

A model stacks many of these layers. Most current LLMs use a decoder-only variant of the transformer, which predicts each token from the tokens before it.

### Generation Is One Token at a Time

An LLM doesn't compose a whole answer and then output it. It predicts a probability for every possible next token, picks one, appends it to the input, and repeats.

{% include figure.html id="ai-generation-loop" %}

Three consequences follow directly. Output streams token by token, which is why responses appear progressively. Generating is slower and more expensive per token than reading input, since each output token takes its own pass through the model. And the model has no separate step where it checks facts before committing to them. It produces the continuation that its training makes likely, which is usually right and occasionally fluent nonsense.

### From Text Predictor to Assistant

A model becomes a useful assistant in stages:

1. **Pretraining** teaches next-token prediction on a huge corpus of text and code. This is self-supervised, since the text supplies its own labels. The result, a base model, continues text but doesn't reliably follow instructions.
2. **Instruction tuning** trains on examples of requests paired with good responses, so the model learns to answer rather than merely continue.
3. **Preference training**, such as reinforcement learning from human feedback (RLHF), trains the model toward responses people rate as more helpful, honest, and safe.

The later stages shape behavior far more than they add knowledge. What a model knows comes overwhelmingly from pretraining.

---

## Tokens

### What a Token Is

Models don't read characters or words. They read **tokens**, which are chunks of text from a fixed vocabulary that usually holds tens of thousands to a few hundred thousand entries. Most tokenizers use subword schemes such as byte-pair encoding, so common words are often a single token, while rare words, names, and unusual strings split into several pieces. The same text tokenizes differently under different models.

{% include figure.html id="ai-tokenization" %}

### Token Counts Depend on the Tokenizer

For English prose, a common rule of thumb is that one token is about four characters, or roughly three-quarters of a word, so 100 tokens is around 75 words. Treat it as a rough estimate, not a constant. Anthropic's [model overview](https://platform.claude.com/docs/en/about-claude/models/overview){:target="_blank" rel="noopener noreferrer"}, for example, notes that 1M tokens holds about 750,000 words on its earlier tokenizer but about 555,000 on the newer one, so the same document costs more tokens on the newer models.

The gap between languages is larger still. [Petrov et al. (NeurIPS 2023)](https://arxiv.org/abs/2305.15425){:target="_blank" rel="noopener noreferrer"} found the same text translated into different languages could differ in tokenized length by up to 15 times, because tokenizers trained mostly on English break other scripts into more pieces. Code, JSON, and text with lots of whitespace or symbols also tend to use more tokens than prose of the same length. When the count matters, measure it with the provider's tokenizer or token-counting endpoint.

### Why Token Counts Matter

| Aspect | Effect |
|---|---|
| **Cost** | Hosted APIs price per token, usually with output tokens costing several times more than input tokens |
| **Limits** | Context windows and output limits are measured in tokens, not words or characters |
| **Latency** | More output tokens take proportionally longer to generate |
| **Character-level tasks** | Models see tokens, not letters, which is why counting the letters in a word or reversing a string can go wrong |

---

## Context Windows

### Everything Shares One Window

The **context window** is the maximum number of tokens a model can work with in a single request. It isn't only the prompt. The system prompt, the conversation so far, any documents or tool results included, the new message, and the tokens the model generates in response (including any reasoning tokens) all have to fit. A request that fills the window with input leaves no room for the answer.

{% include figure.html id="ai-context-budget" %}

Current frontier models offer context windows from roughly 200,000 tokens to around a million, and smaller or older models often much less. These figures change with every model generation, so check the provider's current model documentation rather than relying on a remembered number.

### Every Request Resends the Conversation

A model has no memory between requests. Chat feels continuous because the application sends the entire conversation again with each new message.

{% include figure.html id="ai-conversation-resend" %}

Each request is larger than the last, so a long conversation costs more per message as it goes, and eventually it hits the context limit. Some APIs offer to hold conversation state on the server, but that changes who stores the history, not whether the model processes it. OpenAI's [conversation state guide](https://developers.openai.com/api/docs/guides/conversation-state){:target="_blank" rel="noopener noreferrer"}, for instance, states that when chaining responses by ID, all previous input tokens in the chain are still billed. Prompt caching can make the repeated portion cheaper and faster, but the tokens still count against the window.

This is also why anything placed in a conversation, like a pasted log file or a tool's output, keeps getting sent on every later request until the history is trimmed.

### Longer Isn't Automatically Better

A large window doesn't mean the model uses all of it equally well. [Liu et al., "Lost in the Middle"](https://arxiv.org/abs/2307.03172){:target="_blank" rel="noopener noreferrer"} found that performance was highest when relevant information sat at the beginning or end of the input and degraded significantly when it sat in the middle, even for models built for long contexts. Newer models handle long inputs better than the ones in that study, but filling the window still costs money and latency and can dilute attention. Including the right material generally beats including all of it.

### Managing a Full Context

| Strategy | How it works | Trade-off |
|---|---|---|
| **Truncation** | Drop the oldest messages | Simple, but early instructions or facts silently disappear |
| **Summarization** | Replace older history with a model-written summary | Keeps the gist, loses detail, and adds a model call |
| **Retrieval** | Store material outside the context and insert only the relevant pieces per request | Scales to large knowledge bases, but depends on retrieval quality |
| **Chunking** | Process a long document in pieces, then combine the results | Works for documents larger than the window, but loses cross-chunk connections |

---

## Sampling Parameters

The model produces a probability distribution over the next token. Sampling parameters decide how a token gets picked from it.

### Temperature

Temperature rescales the distribution before sampling. Low temperature sharpens it toward the most likely tokens, so output becomes more focused and repeatable. High temperature flattens it, so less likely tokens get picked more often and output becomes more varied, then eventually incoherent.

{% include figure.html id="ai-temperature" %}

| Setting | Behavior | Typical use |
|---|---|---|
| **Low (near 0)** | Strongly favors the most likely tokens | Extraction, classification, code, factual answers |
| **Moderate** | Some variety, still coherent | General conversation and writing |
| **High** | Diverse, less predictable | Brainstorming, generating varied options |

The valid range and the default differ between providers, so the same number isn't comparable across APIs. **Temperature 0 doesn't guarantee identical output.** Both Anthropic and OpenAI document that results aren't fully deterministic even at temperature 0, because floating-point arithmetic, batching, and hardware can shift nearly tied token scores. OpenAI's `seed` parameter improves reproducibility on a best-effort basis only. Build systems that tolerate small variations rather than depending on byte-identical responses.

Low temperature also doesn't prevent hallucination. It makes the model more consistently pick what it considers likely, which is just as wrong when its most likely answer is wrong.

### Top-p

Top-p (nucleus sampling) limits sampling to the smallest set of tokens whose probabilities add up to p. At 0.9, the model samples only from the tokens covering the top 90% of probability mass, cutting off the long tail of unlikely choices. Temperature and top-p both control randomness, and providers generally recommend adjusting one and leaving the other at its default. Some reasoning-capable models restrict or ignore these parameters, so check what a specific model accepts.

{% include figure.html id="ai-top-p" %}

### Output Limits and Stop Sequences

**Max output tokens** caps the length of a response. A response cut off at the limit ends mid-sentence, and APIs report that the limit was the reason it stopped, so check the stop reason instead of assuming the output is complete. **Stop sequences** end generation when the model produces a specified string, which is useful for structured formats. Some APIs also offer **frequency** and **presence penalties**, which discourage repeating tokens that have already appeared.

---

## Embeddings

### Text as Points in Vector Space

An **embedding model** converts text into a fixed-length list of numbers, a vector, positioned so that texts with similar meanings land near each other. "How do I reset my password?" and "I forgot my login credentials" share almost no words, but their embeddings are close, while "The weather is nice today" lands far away. Embedding models are separate from the models that generate text, and they output vectors, not words.

This is what makes search by meaning possible. Embed a collection of documents once, embed each incoming query the same way, and the nearest document vectors are the most semantically related documents.

{% include figure.html id="ai-embedding-space" %}

### Measuring Similarity

Closeness is usually measured with **cosine similarity**, the cosine of the angle between two vectors, which ranges from −1 to 1 and in practice is used to rank candidates rather than read as an absolute score. Many embedding models output vectors normalized to length 1, in which case cosine similarity equals the dot product. OpenAI's [embeddings guide](https://developers.openai.com/api/docs/guides/embeddings){:target="_blank" rel="noopener noreferrer"} notes that for its normalized embeddings, cosine similarity and Euclidean distance produce identical rankings.

Vectors from different embedding models aren't comparable. A collection embedded with one model has to be queried with the same model, and switching models means re-embedding everything.

### Dimensions

Embeddings typically have hundreds to a few thousand dimensions. More dimensions can capture finer distinctions but cost more to store and search. Some models are trained so their vectors can be shortened with modest quality loss. OpenAI's `text-embedding-3-small` and `text-embedding-3-large` default to 1,536 and 3,072 dimensions and accept a `dimensions` parameter to return shorter vectors.

### Where Embeddings Are Used

| Use | How embeddings help |
|---|---|
| **Semantic search** | Match queries to documents by meaning instead of shared keywords |
| **Retrieval for LLMs** | Find the passages to insert into a model's context |
| **Clustering** | Group similar support tickets, reviews, or documents |
| **Classification** | Label text by comparing it with labeled examples |
| **Deduplication** | Detect near-duplicate content phrased differently |
| **Recommendations** | Suggest items similar to ones a user engaged with |

### Storing Embeddings at Scale

For a few thousand vectors, computing similarity against every stored vector in memory is fast enough. At millions of vectors, that brute-force comparison becomes too slow, which is the problem [vector databases](/study-guides/data/vector-databases.html) solve with approximate nearest-neighbor indexes. Many general-purpose databases now offer vector search as well, so a dedicated vector database isn't the only option.

---

## What Models Do Well and Poorly

### Strengths

LLMs are strong at transforming and generating language, including summarizing, rewriting for a different audience, translating, extracting structured fields from messy text, classifying, drafting, and writing and explaining code. They're also capable at reasoning over information supplied in the context, such as comparing options in a document or tracing logic in a code file.

### Hallucination

A **hallucination** is fluent, confident output that's false, such as an invented citation, a nonexistent API method, or a wrong date. It follows from how generation works. The model produces likely-sounding continuations, and a plausible fabrication can be likely-sounding. Training on imperfect data and training toward helpfulness can both make it more willing to answer than to say it doesn't know.

Mitigations reduce the rate without eliminating it:

- **Ground answers in supplied material.** Put the relevant documents in the context and instruct the model to answer only from them.
- **Give the model tools** for facts it can't know, like search, database lookups, or code execution for calculations.
- **Verify what matters.** Check citations, run generated code, and have consequential claims reviewed.
- **Ask for sources**, knowing models can fabricate those too unless the sources were supplied.

### Knowledge Cutoff

A model knows only what was in its training data, which ends at a cutoff date. It has no awareness of later events, new library versions, or recent changes to APIs, and it may not realize its information is outdated. Providers sometimes distinguish the training data cutoff from a reliable knowledge cutoff, since coverage of the last months before the cutoff tends to be thin. For anything current, supply the information in the context or give the model a search tool.

### Arithmetic and Precise Operations

Models predict tokens rather than executing arithmetic. They often get simple calculations right and become unreliable as numbers grow or steps multiply. Character-level operations are similarly shaky because of tokenization. When exactness matters, have the model write and run code or call a tool rather than compute in its head.

---

## Kinds of Models

### Base, Instruction-Tuned, and Reasoning Models

A **base model** is the output of pretraining alone and continues text rather than following instructions. It's mainly a starting point for further training. An **instruction-tuned** (or chat) model has gone through the later training stages and is what applications normally use.

**Reasoning models** are trained to generate intermediate reasoning, often called thinking, before their final answer, which improves results on multi-step problems like math, planning, and complex code. That thinking consists of tokens. Anthropic's [extended thinking documentation](https://platform.claude.com/docs/en/build-with-claude/extended-thinking){:target="_blank" rel="noopener noreferrer"}, for example, reports thinking tokens as part of billed output tokens and counts them toward the output limit, and many providers let you control how much the model thinks. Reasoning improves quality on hard problems at the price of latency and cost, and it adds little on simple ones.

### Model Size, Dense and Mixture-of-Experts

A model's **parameter count** is the number of learned weights. Within a model family, larger models are generally more capable and more expensive and slower to run. Closed-model providers usually don't publish parameter counts, so size comparisons are mostly possible among open-weight models, which commonly range from about one billion to hundreds of billions of parameters.

**Mixture-of-experts (MoE)** models complicate the comparison. Instead of running every parameter for every token, a router activates a few specialized sub-networks per token. [DeepSeek-V3](https://arxiv.org/abs/2412.19437){:target="_blank" rel="noopener noreferrer"}, for example, has 671 billion total parameters but activates 37 billion per token. An MoE model runs with roughly the compute of its active parameters, but all of its parameters still have to be loaded into memory.

{% include figure.html id="ai-mixture-of-experts" %}

### Multimodal Models

Many current models accept images, and some accept audio or video, alongside text. Most general-purpose LLMs still output text, while separate model types generate images, audio, or video. Inputs in other modalities are also converted into tokens and count against the context window.

### Model Identity: Families, Snapshots, and Aliases

A model name like "the latest Claude" or "GPT-something" refers to a family. What an API call actually runs is a specific **snapshot**, a fixed set of weights with its own identifier. Providers differ in whether their short names are pinned snapshots or **aliases** that can point to a newer snapshot over time. An alias that moves can change an application's behavior without any code change. Production systems generally pin a snapshot identifier and upgrade deliberately, after re-running their evaluations, and track each snapshot's announced retirement date.

---

## Hosted APIs and Self-Hosted Models

### Open-Weight and Closed Models

| Aspect | Open-weight models | Closed models |
|---|---|---|
| **Access** | Weights downloadable, run on your own or rented hardware (license terms vary) | Available only through the provider's API or cloud partners |
| **Cost structure** | Hardware and operations, whether or not requests are coming in | Per token, scaling with use |
| **Data handling** | Can stay entirely inside your infrastructure | Sent to the provider under its data terms |
| **Customization** | Full fine-tuning and modification possible | Limited to what the provider offers |
| **Capability** | Strong and improving, typically trailing the frontier | Usually where the most capable models appear first |
| **Change control** | You decide when the model changes | The provider retires snapshots on its schedule |

"Open-weight" is more precise than "open source". Many downloadable models come with licenses that restrict use, and few release their training data.

### Estimating Memory for a Local Model

The memory needed to load a model's weights is its parameter count times the storage per parameter:

```
weight memory (GB) ≈ parameters (billions) × bits per weight ÷ 8
```

Full 16-bit precision uses 16 bits per weight. **Quantization** stores weights at lower precision to shrink the model, at some cost in quality that grows as the bit width drops. In llama.cpp's widely used GGUF formats, `Q8_0` works out to about 8.5 bits per weight and `Q4_K_M` to roughly 4.8, since the formats also store scaling factors.

| Parameters | 16-bit | 8-bit (~8.5 bpw) | 4-bit Q4_K_M (~4.8 bpw) |
|---|---|---|---|
| **7B** | ~14 GB | ~7.4 GB | ~4.2 GB |
| **13B** | ~26 GB | ~13.8 GB | ~7.8 GB |
| **70B** | ~140 GB | ~74 GB | ~42 GB |

These figures cover the weights only. Inference also needs memory for the **KV cache**, which stores attention state for every token in the context and grows with context length and the number of concurrent requests, plus runtime overhead. A 70B model at 4-bit therefore doesn't fit in a single 24 GB consumer GPU. It needs more GPU memory, splitting across devices, or offloading layers to system RAM, which makes generation much slower.

### Choosing Between Hosted and Self-Hosted

```
Must the data stay on infrastructure you control (regulation, contract, air gap)?
├── Yes ─► Self-host an open-weight model, or use a provider deployment
│          inside your own cloud boundary if that meets the requirement
└── No
    ├── Do you need the most capable models available? ─► Hosted API
    ├── Do you need to modify weights or keep a model unchanged indefinitely?
    │     └── Yes ─► Open-weight model (self-hosted or on a hosting service)
    ├── Is request volume high and steady enough to keep GPUs busy?
    │     └── Yes ─► Compare self-hosting cost against API pricing,
    │                including batch and caching discounts
    └── Otherwise ─► Hosted API
```

Self-hosting shifts costs rather than removing them. The GPUs cost money whether or not requests arrive, and serving at scale takes engineering effort for batching, scaling, and upgrades. A hosted API tends to win on total cost at low or bursty volume, while steady, high-volume workloads that a smaller open-weight model handles well are where self-hosting can pay off.
