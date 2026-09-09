---
title: "Azure AI & ML Service Selection"
layout: guide
category: Azure
subcategory: Machine Learning & AI
description: "A decision framework for choosing between the four Azure AI building blocks: prebuilt Foundry Tools, generative Foundry Models, Azure AI Search retrieval, and custom models in Azure Machine Learning."
tags: [foundry-tools, foundry-models, ai-search, rag, build-vs-buy, decision-making, practical]
---

## The Azure AI & ML Landscape

Azure's AI offerings sit at four levels of abstraction, and picking the wrong level is the most expensive mistake available at design time.

| Building block | What it is | You supply |
|---|---|---|
| **Foundry Tools** | Task-specific prebuilt APIs for vision, language, speech, translation, and document extraction | An API call |
| **Foundry Models** | A catalog of generative models (OpenAI, Anthropic, Meta, Mistral, xAI, Microsoft, and others) behind a common deployment and inference surface | A prompt, and optionally fine-tuning data |
| **Azure AI Search** | Retrieval over your own content, from classic index queries to agentic multi-source retrieval | Your documents and a chunking strategy |
| **Azure Machine Learning** | Infrastructure and tooling to train, register, deploy, and monitor your own models | Labeled data, ML expertise, and compute |

The first three are managed services you call. The fourth is a platform you build on. Most applications combine several, and a design that reaches for Azure Machine Learning when a prebuilt API would do pays for ML talent and infrastructure to reach parity with something already available over REST.

### The naming has changed, and the old names are still in your code

Microsoft renamed most of this stack, and the docs, the portal, and the ARM layer are not all on the same vocabulary. Anyone reading older material or maintaining older infrastructure code hits this immediately.

| Previous name | Current name |
|---|---|
| Azure Cognitive Services, then Azure AI services | **Foundry Tools** |
| Azure AI Studio, then Azure AI Foundry | **Microsoft Foundry** |
| Azure OpenAI Service | **Azure OpenAI in Foundry Models** |
| Hub + Azure OpenAI resource + Azure AI Services resource | A single **Foundry resource**, with projects inside it |
| Azure Cognitive Search | **Azure AI Search** |
| Form Recognizer | **Azure AI Document Intelligence** |
| Assistants API (threads, messages, runs) | **Responses API** (conversations, items, responses) |

The ARM resource provider is still `Microsoft.CognitiveServices`, and the multi-service resource is `kind: AIServices`. Bicep, Terraform, and role assignments written against the older vocabulary keep working. Only the docs and portal labels moved.

### What these services replace

**Without managed AI services:**
- Building AI capabilities requires hiring specialized ML talent and provisioning training infrastructure
- Training models from scratch demands large labeled datasets and significant compute
- Deployment and scaling require container orchestration expertise
- Maintaining model quality needs monitoring pipelines and retraining workflows

**With managed AI services:**
- Prebuilt capabilities available over REST without ML expertise
- Managed scaling, availability, and model refresh
- SDKs that abstract the ML serving layer away
- Content filtering and abuse monitoring applied by default on generative models

### How Azure compares to AWS

Architects arriving from AWS should note several structural differences, and two services on the AWS side whose status recently changed.

| Concept | AWS | Azure |
|---|---|---|
| **Custom ML platform** | SageMaker AI | Azure Machine Learning |
| **Prebuilt AI APIs** | Individual services (Rekognition, Comprehend, Transcribe, Textract) | Foundry Tools (one multi-service Foundry resource, or single-service resources) |
| **Foundation model catalog** | Amazon Bedrock | Foundry Models |
| **Vision APIs** | Rekognition | Azure Vision, Face |
| **NLP APIs** | Comprehend | Azure Language |
| **Speech APIs** | Transcribe, Polly | Azure Speech |
| **Document extraction** | Textract | Azure AI Document Intelligence |
| **Retrieval for RAG** | Amazon Bedrock Knowledge Bases (Kendra entered maintenance mode on 30 June 2026 and closed to new customers on 30 July 2026) | Azure AI Search |
| **Content moderation** | Rekognition and Comprehend moderation APIs, Bedrock Guardrails | Azure AI Content Safety, standalone and integrated into Foundry Models |
| **Custom training inside prebuilt services** | Comprehend custom classification and custom entity recognition, Transcribe custom language models, Textract adapters, Rekognition Custom Labels | Custom NER and text classification, custom speech, custom voice, custom Document Intelligence models |

Both platforms let you train custom models inside the prebuilt services rather than dropping to the full ML platform. Neither one is a general escape hatch, and on both sides the custom paths are narrower than the prebuilt catalogs.

---

## Decision Framework

### Decision tree

**Does your task match a named, task-specific AI capability?**

**Yes:**
- Image analysis, OCR, or face detection → **Azure Vision** or **Face**
- Structured extraction from forms, invoices, receipts, or IDs → **Azure AI Document Intelligence**
- Sentiment, entity recognition, PII detection, or language detection → **Azure Language**
- Transcription, synthesis, or spoken translation → **Azure Speech**
- Text translation → **Azure Translator**

**No, the task is generative, conversational, or open-ended:**
- Content generation, summarization, reasoning, code → **Foundry Models**
- A conversational agent with tools and memory → **Foundry Agent Service**
- Answers grounded in your own documents → **Azure AI Search** plus a Foundry model (RAG)

**No, and the task is a specialized prediction problem:**
- You have labeled data and ML expertise → **Azure Machine Learning**
- You have labeled data but no ML expertise → **Azure Machine Learning AutoML**
- You have neither → start with a Foundry model and few-shot prompting, and reassess whether the problem needs a model at all

### When to use each, and when not to

| Service | When to use | When NOT to use |
|---|---|---|
| **Azure Vision / Face** | OCR on images, face detection and verification, image tagging | Specialized computer vision needing regulatory approval (medical imaging). Note that Image Analysis and Custom Vision both retire 25 September 2028 |
| **Azure Language** | PII detection, language detection, prebuilt and custom NER, text analytics for health | Domain reasoning that no amount of labeled data teaches. Most other Language features are on a 2029 retirement path toward Foundry models |
| **Azure Speech** | Real-time and batch transcription, synthesis, spoken translation, voice agents | Latency budgets that a cloud round trip cannot meet, which is what embedded speech exists for |
| **Azure AI Document Intelligence** | Invoices, receipts, IDs, tax forms, layout extraction, custom document types | Documents with layouts so variable that neither prebuilt nor custom models parse them reliably |
| **Foundry Models** | Generation, summarization, multi-step reasoning, embeddings, tasks with no labeled data | Deterministic outputs, legally required explainability, or auditing behavior at the training-data level |
| **Azure AI Search** | Full-text, vector, hybrid, and multimodal retrieval, RAG grounding, agentic retrieval | Keyword lookup over a small dataset that a database index already serves |
| **Azure Machine Learning** | Custom models, training at scale, MLOps pipelines, responsible AI tooling, on-premises or edge deployment | Anything a prebuilt service already covers adequately |

---

## Foundry Tools: The Prebuilt Capabilities

Foundry Tools are task-specific APIs that need no training data. They matter in a selection decision for what they cost and what they guarantee, not for their full feature lists.

### Azure Vision and Face

Azure Vision covers image analysis and OCR. Face covers detection, verification, and identification, with identification and celebrity recognition gated behind a limited-access review.

Two things reshape any new vision design:

- **Image Analysis (both v3.2 and v4.0) and Custom Vision retire 25 September 2028**, across cloud APIs and containers. Microsoft asks for a transition plan by September 2026.
- **Spatial analysis retired 30 March 2025**, as did the Image Analysis 4.0 background removal API. Neither has an in-service successor.

The successors fragment by scenario rather than replacing Image Analysis wholesale. Document OCR goes to Document Intelligence `prebuilt-read`. Faces stay with Face. Tagging and description go to Content Understanding or a Foundry model. Custom classification and object detection go to Azure Machine Learning AutoML or Content Understanding classifiers.

Custom Vision itself accepts as few as 5 images per label, but Microsoft's own guidance is to start around 50 per label, and the service is documented as poorly suited to detecting subtle differences such as hairline cracks or dents.

### Azure Language

Azure Language splits into a core tier and a legacy tier, and the legacy tier is most of the service.

| Tier | Features | Status |
|---|---|---|
| **Core** | PII detection, language detection, prebuilt NER, custom NER, text analytics for health | Recommended for new work, no retirement date |
| **Legacy** | Conversational Language Understanding, custom text classification, entity linking, key phrase extraction, orchestration workflow, custom question answering, sentiment analysis and opinion mining, summarization | Supported for existing implementations only |

Every legacy feature retires from Azure Language on **31 March 2029**, except entity linking on **1 September 2028**. The named migration target is Foundry models, and entity linking is the only one with an in-service successor (prebuilt NER). LUIS and QnA Maker are already retired, with Conversational Language Understanding and custom question answering as their successors, both of which are themselves in the legacy tier.

This changes the selection calculus. Sentiment analysis and summarization used to be the clearest examples of "use the cheap task-specific API instead of a language model." For a system being designed now, the task-specific API is the one with the end date.

Custom NER and custom text classification bind a storage account irreversibly, accept `.txt` files only, and cap at 200 entity types or classes. Custom text classification documentation recommends 50 tagged instances per class. Custom NER publishes no equivalent number and gives qualitative guidance instead: balanced, diverse, real-world, non-duplicate data.

### Azure Speech

Speech to text runs three paths, and choosing between them is the main design decision:

| Path | Shape | Limits |
|---|---|---|
| **Real-time** | Streaming, interim plus final results | Diarization caps at 240 minutes |
| **Fast transcription** | Synchronous, faster than real-time, display-form output only | Under 500 MB and under 5 hours per file, 600 requests per minute |
| **Batch** | Queued and asynchronous | 1 GB per file, 1,000 files per request. Each region processes batch jobs one at a time, so raising quota does not make batch finish sooner |

Four capabilities have been retired or dated. **Speaker recognition** (voice biometric verification and identification) retired **30 September 2025** with no in-service successor, so a design calling for voice authentication needs a third-party provider. **Intent recognition** in the Speech SDK retired the same day, migrating to transcribe-then-classify. **Custom Commands** retired **30 April 2026**, and the **Long Audio API** retires **1 April 2027** in favor of batch synthesis. Speaker diarization is unaffected by all of these.

For voice agents, **Voice Live** is the managed path. It bundles transcription, a generative model, synthesis, noise suppression, interruption handling, and optional avatar output behind an interface compatible with the Realtime event surface, and it needs a Foundry resource.

### Azure AI Document Intelligence

Document Intelligence extracts structured data from documents, combining OCR with layout understanding and document-type-specific models. **v4.0 (`2024-11-30`) is the current GA.** A custom model inherits the lifecycle of the API version that trained it, so the version you train on is a support commitment, not just a parameter.

Two prebuilt models that older material recommends are **absent from v4.0**: the **business card** model and the **general document** model (`prebuilt-document`, the key-value-pair extractor). Both exist only through v3.1. A v4.0 design that needs generic key-value extraction uses layout plus a Foundry model, or Content Understanding, rather than a prebuilt.

Custom models need a minimum of five labeled documents. Template models train in one to five minutes. Neural models train in 30 minutes to 12 hours, with 30 minutes as the default budget and longer runs requiring paid training.

### One resource or several

Foundry Tools can be provisioned as a single multi-service **Foundry resource** (`kind: AIServices`, listed under Foundry in the portal) or as individual single-service resources.

**Foundry resource:**
- One endpoint and one key across the tools, plus access to Foundry Models and the Agent Service
- Required by Content Understanding, Voice Live, and speech translation beyond two target languages
- Combined billing and unified monitoring
- Narrower regional availability than individual services

**Single-service resources:**
- Separate endpoint and key per service
- Per-service cost allocation, which chargeback to different business units needs
- Available in more regions
- Suited to compliance boundaries that require separating, say, OCR from speech

Start with a Foundry resource. Move to single-service resources when you hit a regional gap, need per-service cost attribution, or need to separate access by service.

---

## Foundry Models: Generative Capability

Foundry Models is the catalog and deployment surface for generative models. It carries over 10,000 models, with roughly 50 added a month, and splits into two categories that differ in who supports them and how they bill.

| Category | Examples | Support and billing |
|---|---|---|
| **Sold by Azure** | Azure OpenAI models, Grok, DeepSeek, Llama, Cohere, Mistral, Phi | Microsoft hosts, supports, and sells under Microsoft Product Terms, with enterprise SLAs. Billed through Azure meters |
| **From partners and community** | Anthropic Claude, Hugging Face models, Fireworks-hosted models | The provider defines license terms and sets pricing. Billed through Azure Marketplace |

### Do not design against a model name

Naming a specific model in an architecture document is the fastest way to make it stale. Models in this catalog move through **Preview → GA → Legacy → Deprecated → Retired**, and the whole GPT-4 and GPT-3.5 generation, DALL-E 2, `babbage-002`, and `davinci-002` are already retired. Retirement dates run roughly 12 to 24 months from a model's release.

Design against the lifecycle mechanism instead:

- The **model retirement schedule** on Microsoft Learn is the authoritative list of every model's stage, retirement date, and named replacement. Treat it as an input to your dependency review, not something you check when something breaks.
- **Deployment-level version pinning** means a model version is stable until its published retirement date. Auto-update is opt-in per deployment.
- **`model-router`** is a Microsoft model that routes each request to an appropriate model in the family, which decouples the application from any one model name.
- Embedding models are the stable end of the catalog. `text-embedding-3-small`, `text-embedding-3-large`, and `text-embedding-ada-002` all run to February 2028, which matters because changing an embedding model means reindexing every vector you have stored.

Model capability families are the durable abstraction. Reason about which you need, then pick a current member from the catalog:

| Family | What it does | Selection notes |
|---|---|---|
| **Frontier reasoning** | Multi-step reasoning, complex analysis, agentic planning | Highest cost per token and highest latency. Reserve for tasks where cheaper models measurably fail |
| **General chat** | Conversation, summarization, extraction, classification via prompt | The default. Mini and nano variants trade capability for cost and speed |
| **Coding** | Code generation, editing, and repository-scale reasoning | Separate family from general chat, tuned for agentic coding loops |
| **Embeddings** | Text to vectors for retrieval and clustering | Choice is locked in by your index. Changing it forces a reindex |
| **Audio and realtime** | Speech in and out, low-latency voice | Overlaps with Azure Speech. Speech gives you diarization, batch, and custom voice; realtime models give you one model handling audio end to end |
| **Image and video** | Generation and editing | Distinct billing and content-safety treatment |

### Deployment types decide latency, cost, and data residency

Deployment type is a more consequential choice than model choice, because it is where throughput guarantees and data residency actually live.

| Type | Capacity | Data processing |
|---|---|---|
| **Standard** | Pay per token, shared capacity | Regional, data zone, or global depending on the variant |
| **Provisioned** | Reserved throughput, predictable latency, billed on reserved capacity rather than tokens | Regional, data zone, or global |
| **Batch** | Asynchronous, large jobs at a discount | Global or data zone |
| **Developer** | Low-commitment evaluation | No production SLA |

Global variants route to whichever region has capacity, which gives the best availability and price and the least residency control. Data zone variants confine processing to a geographic boundary. Regional variants pin to one region. Some models sold by Azure offer fungible provisioned throughput, so reserved capacity moves between models rather than stranding on one.

### Foundry Models vs Azure Language

These overlap on classification, extraction, and summarization. With most of Azure Language's legacy tier retiring in 2029, the comparison now runs on cost and behavior rather than on which one has a future.

| Factor | Azure Language | Foundry Models |
|---|---|---|
| **Task fit** | Purpose-built for a fixed set of tasks | General-purpose, shaped by the prompt |
| **Customization** | Custom models require labeled training data | Prompting, then fine-tuning |
| **Latency** | Lower, from smaller single-purpose models | Higher, and it scales with model size and output length |
| **Cost** | Per transaction, and cheaper per unit for the tasks it covers | Per input and output token |
| **Output shape** | Fixed schema | Whatever the prompt asks for, which needs validation |
| **Determinism** | Repeatable for the same input | Non-deterministic by default. Temperature 0 reduces variance without eliminating it |
| **Longevity** | Core tier has no end date. Legacy tier retires 2029 | Individual models retire on a 12 to 24 month cycle, but the catalog persists |

Reach for Azure Language when the task is PII detection, language detection, NER, or text analytics for health, when per-transaction cost dominates at volume, and when you need a fixed output schema without validating generated JSON. Reach for a Foundry model when the task needs reasoning across steps, when output is generative, when you have no labeled data, or when one model can replace several task-specific calls.

### Fine-tuning vs prompt engineering

| Approach | Fits | Training data | Cost | Iteration |
|---|---|---|---|---|
| **Prompt engineering** | Exploration, diverse tasks, low volume | None beyond in-prompt examples | Per token, prompt plus completion | Instant |
| **Fine-tuning** | High-volume repetitive tasks, house style, domain vocabulary | Labeled examples, typically 50 or more | Training, plus hosting, plus per-token inference | A training job per iteration |

Start with prompting. Fine-tune when you find yourself repeating the same few-shot block across thousands of requests, or when prompt length has become the dominant cost. Fine-tuned models add their own lifecycle: training on a base model stops when that base model retires, and the fine-tuned deployment retires about six months after that.

### Guardrails and content filtering

Content filtering runs on both prompts and completions, and applies by default to models sold by Azure.

**Harm categories:** hate, sexual, violence, and self-harm, each classified at safe, low, medium, or high. The default configuration blocks medium and high on prompts and completions. Low and safe pass. Safe is annotated but not configurable.

**Additional filters, on by default and separately configurable:**
- **Prompt Shields**, which detects user-input attacks against the model
- **Protected material detection** for text and for code, which flags known content in completions

**Available separately through Azure AI Content Safety:** groundedness detection (preview), task adherence for agent tool use, custom categories in standard and rapid variants, and standalone text and image moderation for content the model never touches.

Each filter can annotate rather than block, which is how you audit filter behavior against production traffic before enforcing it. Filtering cannot be fully disabled on models sold by Azure without an approved exemption, and false positives on medical, legal, and creative content are common enough to test for before launch. For models deployed through managed compute, filtering is not automatic and you call Content Safety yourself.

### Foundry vs calling a provider directly

| Aspect | Foundry Models |
|---|---|
| **Model breadth** | One deployment and inference surface across OpenAI, Anthropic, Meta, Mistral, xAI, Cohere, and Microsoft models |
| **Version stability** | Versions pinned per deployment, with a published retirement date and auto-update opt-in |
| **Data residency** | Regional, data zone, and global processing selectable per deployment |
| **Networking and identity** | Private endpoints, VNet integration, Microsoft Entra authentication, and managed identity |
| **Capacity** | Provisioned throughput and reservations, alongside pay-per-token |
| **Guardrails** | Content filters, Prompt Shields, and protected material detection configurable per deployment |
| **Commercial** | One Azure bill, Azure compliance coverage, and Azure support |

Choose Foundry when data residency, network isolation, Entra-based identity, or reserved throughput are requirements, or when you want more than one model provider behind a single integration. Choose a provider's API directly when you want the shortest path to that provider's newest release and none of the above applies. Verify current data-handling and compliance terms against each provider's own documentation rather than against a comparison table, because those terms change more often than the technical surface does.

---

## Azure AI Search: Retrieval and RAG

Azure AI Search is the retrieval layer. It ingests from Blob Storage, Cosmos DB, SharePoint, OneLake, and other sources, enriches content during indexing, and serves full-text, vector, hybrid, and multimodal queries. It also underpins Foundry IQ, the managed knowledge layer that Foundry agents ground against.

### Two engines, two shapes

Every search service includes both a classic search engine and an agentic retrieval engine. They differ in shape, not just in features, and the difference drives cost and latency.

```
CLASSIC SEARCH                      AGENTIC RETRIEVAL
one index, one round trip           one knowledge base, many sources

  query                               query
    |                                   |
    v                                   v
 [ index ]                        [ query planner (LLM) ]
    |                                 /    |    \
    | BM25 + vector                  /     |     \
    v                          subquery subquery subquery
 ranked docs                        |      |      |
    |                               v      v      v
    v                          [index] [index] [remote source]
 application                        \      |      /
                                     \     |     /
                                      v    v    v
                                  [ semantic reranking ]
                                            |
                                            v
                                  [ merge + synthesize ]
                                            |
                                            v
                          answer + activity log + references
```

Classic search targets one predefined index and returns ranked documents in a single request. No planning, no iteration, no LLM in the retrieval path. It is predictable, low-latency, and the right default for a traditional search experience or a simple RAG loop where your application does the prompt assembly.

Agentic retrieval targets a **knowledge base**, which points at one or more **knowledge sources**. Each query is planned and decomposed into subqueries, run in parallel across those sources, semantically reranked, and merged. Sources can be indexed or remote, and remote sources are queried live rather than ingested. It returns an answer, an activity log, and references, which is a shape built for agent consumption rather than for a results page. It costs more per query, is region-restricted, and its reasoning effort is tunable.

Use classic search when queries hit one corpus and your application controls the prompt. Use agentic retrieval when a question spans several sources, when permission-aware access across systems matters, or when an agent rather than a page consumes the results.

### The RAG loop

Retrieval-Augmented Generation grounds a model's output in retrieved content, which keeps it current with data the model never trained on and produces citations a user can check.

1. **Index.** Documents are chunked, optionally enriched (OCR, entity extraction), vectorized, and indexed. Integrated vectorization generates embeddings during indexing and at query time so you do not run a separate embedding pipeline.
2. **Retrieve.** The query runs against the index or knowledge base. Hybrid (keyword plus vector) with semantic ranking generally beats either alone.
3. **Augment.** Retrieved chunks go into the prompt with instructions to answer only from them and to cite.
4. **Generate and cite.** The model answers, and the application renders the citations.

What RAG buys you: no fine-tuning cost, knowledge updated by reindexing rather than retraining, citations that make answers checkable, and answers over private data.

What it costs you: retrieval quality caps answer quality, retrieved content consumes prompt tokens, and chunking strategy becomes a tuning parameter that materially changes results. Chunks too large pull in irrelevant text; chunks too small lose the context that made a passage meaningful.

### Pricing model, before tier

Azure AI Search bills through two models, and choosing between them precedes choosing a tier.

- **Dedicated** provisions capacity at a fixed hourly rate per Search Unit, where a Search Unit is a replica times a partition. It suits steady, predictable, high-utilization workloads, and it is where you tune replicas for query throughput and partitions for index size.
- **Serverless** (preview) bills consumption by Compute Unit hours plus indexed storage per GB per month. It suits infrequent or bursty workloads, scales without replica and partition configuration, and does not support migration to or from other tiers.

Both models support classic search and agentic retrieval.

### What it adds over a conventional search index

| Feature | A conventional search index | Azure AI Search |
|---|---|---|
| **Query matching** | Keyword with stemming and fuzzy matching | Keyword, vector, hybrid, and multimodal |
| **Ranking** | TF-IDF or BM25 | BM25 plus semantic reranking plus scoring profiles |
| **Enrichment** | None, relies on preprocessed structured data | Skillsets that chunk, vectorize, OCR, and extract during indexing |
| **Unstructured content** | Requires an external extraction step | Built-in extraction from PDFs, images, and documents |
| **Multi-source retrieval** | One index per query | Knowledge bases spanning indexed and remote sources |

Skip it for keyword lookup over a small dataset that a database index already serves, and for content that changes faster than an indexing pipeline can keep up with.

---

## Azure Machine Learning: Custom Models

Azure Machine Learning is not an AI API. It is the platform ML engineers use to build custom models from scratch or through transfer learning, and it is where you land when the prebuilt services genuinely do not fit.

**What it provides:**
- **Compute management**: CPU and GPU clusters for training and inference, with autoscaling and spot support
- **Data management**: versioned datasets, data pipelines, lineage tracking
- **Experiment tracking**: metrics, hyperparameters, and artifacts per run, with native MLflow
- **Model registry**: versioning and lineage from training data to deployed endpoint
- **AutoML**: automated algorithm selection and hyperparameter tuning
- **Responsible AI**: interpretability, fairness analysis, error analysis, counterfactuals
- **MLOps**: CI/CD pipelines for training, testing, and deployment

**Deployment targets** are endpoints, in three shapes. **Online endpoints** serve synchronous low-latency inference on managed compute or Kubernetes. **Batch endpoints** run asynchronous inference over large volumes, scale to zero, and can deploy pipeline components rather than just models. **Standard deployments** serve supported foundation models without consuming subscription compute quota.

**Use Azure Machine Learning when:**
- Prebuilt services do not cover the task, or measurably underperform on your data
- You have labeled training data and ML expertise
- You need MLOps pipelines for versioning, testing, and deployment
- You must audit training data and model decisions for regulatory compliance
- Models must run at the edge or on-premises

**Do not use it when:**
- A prebuilt service covers the case adequately
- You have neither ML expertise nor labeled data
- You need a result this quarter and the model development budget does not exist

### AutoML

AutoML automates algorithm selection and hyperparameter tuning, which makes it the entry point when you have labeled data but not the expertise to choose and tune models by hand. It is also the named successor for Custom Vision.

| Task type | Input | Output |
|---|---|---|
| Classification | Tabular or image | Class label |
| Regression | Tabular | Numeric value |
| Time series forecasting | Time series | Future values |
| NLP text classification | Text | Class label |
| NLP named entity recognition | Text | Entity labels |
| Image classification | Images | Class label |
| Object detection | Images | Bounding boxes and labels |

It trades training time and architectural control for not needing algorithm expertise, and it produces a leaderboard you can use as a baseline before investing in a hand-built model.

### The Responsible AI dashboard

This dashboard is the capability Azure Machine Learning has that no prebuilt service does, and it is often the reason a regulated workload lands here rather than on an API.

- **Interpretability**: which features drive predictions, via SHAP and feature importance
- **Fairness analysis**: performance disparities across demographic groups
- **Error analysis**: cohorts where the model performs worst
- **Counterfactual what-if**: how changing inputs would change a prediction
- **Model cards**: generated documentation of purpose, performance, limitations

This matters for regulated industries requiring explainable decisions, models affecting individuals (credit, hiring, insurance), and audits requiring transparency into how a decision was reached.

---

## Cost Models

| Service | Billed on | Main drivers |
|---|---|---|
| **Foundry Tools (vision, language, document)** | Per transaction or per page | Call volume, and whether the model is prebuilt or custom |
| **Azure Speech** | Per hour of audio | Duration, and whether processing is real-time or batch |
| **Foundry Models** | Per input and output token, or reserved capacity | Model family, prompt and completion length, deployment type |
| **Azure AI Search** | Search Units per hour, or Compute Unit hours plus storage | Pricing model, tier, replicas and partitions, index size |
| **Azure Machine Learning** | Compute plus storage | VM SKU, training hours, endpoint hours, dataset and model storage |

Two things reshape a cost estimate more than per-unit rates. Reasoning models emit tokens you are billed for but never display, so output token counts can far exceed the visible answer. Provisioned throughput bills on reserved capacity regardless of traffic, which is cheaper than pay-per-token above a break-even utilization and more expensive below it.

**Optimizing Foundry Tools:** buy commitment tiers where the volume justifies pre-purchasing transaction blocks, batch instead of calling per item, and cache stable results such as translated strings or extracted entities.

**Optimizing Foundry Models:** pick the smallest model that passes your evaluation rather than the strongest available, keep prompts short, cache embeddings for unchanged documents, use batch deployments for anything not interactive, and move to provisioned throughput once steady traffic clears the break-even point. Streaming improves perceived latency without changing cost.

**Optimizing Azure AI Search:** match the pricing model to your traffic shape before tuning within it, since a bursty workload on Dedicated pays for idle capacity. Scale replicas to query volume and partitions to index size.

**Optimizing Azure Machine Learning:** use spot compute for interruptible training jobs, autoscale clusters to zero when idle, use batch endpoints for latency-tolerant inference, and reserve online endpoints for genuinely real-time paths. Spot discounts vary by SKU, region, and demand, so check the portal's pricing-history view or the Retail Prices API rather than budgeting against a headline percentage.

---

## Build vs Buy

| Factor | Buy (prebuilt services) | Build (Azure Machine Learning) |
|---|---|---|
| **Time to market** | Days, an API integration | Months, covering data collection, training, deployment |
| **Upfront investment** | Low, pay per call | High, covering ML talent, compute, labeled data |
| **Ongoing cost** | Per call or per token | Compute hosting, retraining, monitoring |
| **Accuracy** | Good on general tasks | Higher on specialized domains, given enough data |
| **Control** | Limited, the model is opaque | Full control of architecture and training |
| **Data handling** | Content is processed by the service | Data stays in your workspace |
| **Explainability** | Limited | Full, through Responsible AI tooling |
| **Portability** | Tied to the API contract | Models exportable to ONNX and other formats |
| **Longevity risk** | The service can be retired out from under you | You own the model, and the maintenance |

That last row has moved. Prebuilt AI services used to be the low-risk choice for a long-lived system. With Custom Vision, Image Analysis, most of Azure Language, and several Speech capabilities all carrying end dates, "buy" now carries a migration obligation you should price in at design time. That does not reverse the recommendation, because a custom model carries a permanent maintenance obligation instead. It does mean checking the retirement status of any prebuilt service before you build a decade-long system on it.

**Buy when** the task matches a prebuilt capability with no end date, time to market dominates, you lack ML expertise or labeled data, and prebuilt accuracy clears your bar.

**Build when** the task is specialized, you have the data and the expertise, prebuilt models underperform on your domain, you need explainability or auditable training data, models must run at the edge, or long-run API costs exceed the development investment.

**Hybrid**, in practice, is what most systems land on. Start prebuilt to validate the use case and set a performance baseline. Move the components that underperform to custom models. Use transfer learning rather than training from scratch where you can.

---

## Responsible AI

Microsoft applies [responsible AI principles](https://www.microsoft.com/en-us/ai/responsible-ai){:target="_blank" rel="noopener noreferrer"} across these services, but the split of responsibility is uneven, and the parts left to you are the parts that fail in production.

| Principle | What the platform does | What remains yours |
|---|---|---|
| **Fairness** | Fairness assessment tooling in Azure Machine Learning | Testing prebuilt and generative models on your own population |
| **Reliability and safety** | Content filters, Prompt Shields, protected material detection | Validating outputs before acting on them, and human review for high-stakes decisions |
| **Privacy and security** | Azure compliance coverage, encryption, private networking, customer-managed keys | Handling PII in what you send, and setting retention |
| **Inclusiveness** | Broad language coverage across Speech, Language, and Translator | Confirming your specific languages and locales are supported, and testing accessibility |
| **Transparency** | Interpretability tooling in Azure Machine Learning, model cards in the catalog | Telling users they are interacting with AI, and explaining decisions that affect them |
| **Accountability** | Abuse monitoring and audit logging | Testing, monitoring, and auditing what you deployed |

Prebuilt and generative models are opaque in a way custom models need not be. If a decision must be explained to a regulator or contested by the person it affects, that requirement points at Azure Machine Learning, whatever the accuracy comparison says.

**In the application:**
1. **Test for bias.** Evaluate across demographic groups, not just on aggregate accuracy.
2. **Monitor for drift.** Model quality degrades as input distributions shift. Retrain or re-evaluate on a schedule.
3. **Be transparent.** Tell users when they are interacting with AI, and explain decisions affecting them.
4. **Add safeguards.** Validate outputs before acting. Put a human in the loop for high-stakes decisions.
5. **Audit.** Log inputs, outputs, and decisions for compliance review.

---

## Integration Patterns

### Document processing

Blob Storage receives documents. Document Intelligence extracts structured fields. Azure Language runs PII detection over free-text fields. Azure AI Search indexes the enriched result, and the application queries it.

Azure Functions or Logic Apps orchestrate the pipeline. Intermediate results land in Cosmos DB or Blob Storage. An Azure AI Search indexer with a skillset can automate the enrichment leg, though the skill catalog is narrower than the service catalog. There is no built-in skill that runs `prebuilt-invoice` or any other Document Intelligence prebuilt model. The document skill is Document Layout, which runs the layout model only, so invoice-specific extraction happens outside the indexer.

### Conversational RAG

A user question is embedded, retrieved against Azure AI Search, and injected into a Foundry model prompt with instructions to cite. This is the RAG loop above, and the design decisions that matter are which retrieval engine to use, how to chunk, and whether hybrid search plus semantic ranking is enabled.

For an agent rather than a chat endpoint, Foundry Agent Service handles the orchestration, tool calling, and conversation state, with Azure AI Search attached as a knowledge source through Foundry IQ. The Assistants API that older material describes retired on 26 August 2026, and classic Agents retire 31 March 2027.

### Video analysis

**Azure AI Video Indexer is its own service, not part of Azure Vision.** It is built on Face, Translator, Azure Vision, and Speech, and it runs either as a cloud application or as an Azure Arc extension on Kubernetes for edge and data-residency scenarios. It produces transcription, translation, OCR, object and scene detection, and summarization in one pass, which is usually less work than assembling the same result from individual services.

Assemble from individual services instead when you need finer control over a specific model, such as a custom speech model for domain vocabulary. Note that face identification and celebrity recognition are limited-access features requiring an approved application.

### Custom model plus prebuilt services

Where a custom model handles the specialized part and prebuilt services handle the rest, the two calls are usually independent, so run them concurrently:

```
                    product image
                          |
             +------------+------------+
             |                         |
             v                         v
   Azure ML online endpoint     Azure Vision OCR
   (custom classification)      (packaging text)
             |                         |
             +------------+------------+
                          v
                application combines
              category + extracted text
```

Sequencing these calls doubles latency for no benefit. The application joins the results.

---

## Common Pitfalls

### Reaching for a generative model where a task-specific API fits

Using a frontier model for PII detection or language detection costs more per call, adds latency, and returns text you have to parse and validate. Check Azure Language, Vision, and Speech first, and check their retirement status while you are there. Generative models earn their cost on generation, reasoning, and tasks with no labeled data.

### Fine-tuning before exhausting prompting

Fine-tuning costs a training job, a hosting commitment, and a lifecycle tied to a base model that will retire. Iterate on prompts first: few-shot examples, explicit output format constraints, and instructions that state what not to do. Fine-tune when prompt length has become the dominant cost or when prompting has plateaued below your accuracy bar.

### Not measuring retrieval separately from generation

A RAG application that returns wrong answers with confident citations has almost always failed at retrieval, not generation, and tuning the prompt will not fix it. Measure retrieval on its own with precision@k, recall@k, and MRR against a labeled query set. Then tune chunking, hybrid search, and semantic ranking. Only then tune the generation prompt.

### Ignoring context and output limits

Context windows are large enough now that developers stop counting, which is when a RAG pipeline starts silently truncating retrieved content, or a reasoning model's hidden tokens blow the output budget. Check the context and output limits of the specific model version you deployed, cap how many chunks you inject, and monitor token usage per request rather than assuming headroom.

### Assuming prebuilt models are unbiased

Prebuilt models are trained on broad datasets that may not represent your users. Test on data that reflects your actual population, including edge cases, before deploying. Azure Machine Learning's fairness tooling works on prebuilt model outputs, not just on models you trained.

### Regenerating embeddings that have not changed

Embed documents once at indexing time and store the vectors in the index. Cache query embeddings for repeated queries. Re-embed only when a document changes, or when you deliberately change embedding models, which means reindexing everything.

### Building custom when prebuilt suffices

Establish a baseline with a prebuilt service first. Migrate to a custom model when the prebuilt one demonstrably underperforms on your data, or when volume makes per-transaction pricing worse than running your own. "The prebuilt model felt generic" is not a measurement.

---

## Key Takeaways

1. **Four building blocks, four levels of abstraction.** Foundry Tools for task-specific prebuilt capability, Foundry Models for generative work, Azure AI Search for retrieval over your content, Azure Machine Learning for custom models. Picking a level too high costs accuracy and control; picking too low costs months.

2. **The names changed, the ARM provider did not.** Azure AI services became Foundry Tools, Azure OpenAI Service became Azure OpenAI in Foundry Models, and hubs plus separate resources became one Foundry resource. `Microsoft.CognitiveServices` still backs all of it, so existing infrastructure code keeps working.

3. **Check retirement status before you select.** Custom Vision and Image Analysis retire in 2028. Most of Azure Language's feature set retires in 2029. Speaker recognition and Custom Commands are already gone. A selection made against older material will pick a retiring service.

4. **Design against the model lifecycle, not a model name.** The GPT-4 and GPT-3.5 generation is retired. Models run a 12 to 24 month cycle through preview, GA, legacy, deprecation, and retirement. Pin versions per deployment, watch the retirement schedule, and consider `model-router` to decouple from any one name.

5. **Deployment type decides more than model choice.** Standard vs provisioned sets your cost curve and latency profile. Global vs data zone vs regional sets your data residency. Both are per-deployment decisions.

6. **Retrieval quality caps RAG quality.** Measure retrieval separately with precision@k, recall@k, and MRR. Classic search suits one corpus and application-controlled prompts; agentic retrieval suits multi-source, permission-aware grounding for agents.

7. **Cost models differ by more than rate.** Foundry Tools bill per transaction, Foundry Models per token, Azure AI Search on capacity units, Azure Machine Learning on compute hours. Reasoning tokens you never display and provisioned capacity you do not saturate are the two line items that surprise people.

8. **Responsible AI splits unevenly.** The platform supplies content filters, Prompt Shields, protected material detection, and interpretability tooling. Bias testing, drift monitoring, output validation, and user transparency stay with the application. If a decision must be explained or contested, that requirement points at Azure Machine Learning.

9. **Buy still beats build, with a migration clause.** Prebuilt services win on time to market and operational simplicity, but several now carry end dates. Price the eventual migration into the decision instead of treating "buy" as maintenance-free.

10. **Start prebuilt, measure, then move.** Establish a baseline with the managed service. Move to a custom model when you can point at the measurement that justifies it.
