---
title: "Azure Language and Translator in Foundry Tools"
layout: guide
category: Azure
subcategory: Machine Learning & AI
description: "A system architect's guide to Azure Language and Azure Translator in Foundry Tools, covering the core and legacy capability split, the 2028-2029 retirements, training limits for custom models, and how to choose between prebuilt features, custom models, and Foundry models."
tags: [nlp, foundry-tools, named-entity-recognition, pii-detection, conversational-ai, translator, practical]
---

## What Is Azure Language

[Azure Language](https://learn.microsoft.com/en-us/azure/ai-services/language-service/overview){:target="_blank" rel="noopener noreferrer"} is the natural language processing service in **Foundry Tools**, the family formerly called Azure AI services and, before that, Azure Cognitive Services. The ARM resource provider is still `Microsoft.CognitiveServices`, so infrastructure code and role assignments written against the old names continue to work even though every doc page and portal blade now uses the new ones.

The service exposes prebuilt models that need no training, plus custom features that train on your labeled data inside the service itself. There is no ML infrastructure to provision either way.

Two things about the current shape of this service matter more than any individual feature.

### Most of the Service Is Documented as Legacy

Microsoft splits the Language features into two tiers, and the split does not follow the lines a reader coming from older material would expect. The features that most tutorials lead with are the ones on the way out.

| Tier | Features | Status |
|---|---|---|
| **Core** | PII detection, language detection, prebuilt NER, custom NER, text analytics for health | Actively invested in, recommended for new development |
| **Legacy** | Conversational language understanding (CLU), custom text classification, entity linking, key phrase extraction, orchestration workflow, custom question answering, sentiment analysis and opinion mining, summarization | Supported for existing implementations, all carrying retirement dates |

Every legacy feature retires from Azure Language on **31 March 2029**, except **entity linking, which retires on 1 September 2028**. Microsoft directs both existing workloads and all new projects to [Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/foundry-models-overview){:target="_blank" rel="noopener noreferrer"} models instead. Entity linking is the one case with a named in-service successor, and that successor is prebuilt NER.

That reframes any design decision made today. If you are choosing how to classify text, extract intent, summarize a call, or answer questions from a knowledge base, the Language service is not the strategic answer any more. A generative model deployed in Foundry is. The Language features remain the right answer when you need a bounded, deterministic, per-transaction API rather than a model deployment, and you are comfortable with a horizon of a few years.

This also closes a chapter that started in the guide's own history. LUIS and QnA Maker retired, and CLU and custom question answering were the successors readers were told to migrate to. Those successors now carry retirement dates of their own.

### Language and Translator Are Separate Services

Translation is not part of Azure Language. [Azure Translator](https://learn.microsoft.com/en-us/azure/ai-services/translator/translator-overview){:target="_blank" rel="noopener noreferrer"} is its own Foundry Tool with its own resource, endpoint, keys, API versions, and pricing. Material that describes a single unified service covering both text analytics and translation is describing something Azure does not offer.

What Azure does offer is a resource type that fronts both, which is where the confusion starts.

### The Two Resource Shapes

You reach these tools through either a single-service resource or a [Microsoft Foundry resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource){:target="_blank" rel="noopener noreferrer"}, and the choice determines how many endpoints and keys your application manages.

```
SINGLE-SERVICE RESOURCES                MICROSOFT FOUNDRY RESOURCE
                                        (kind: AIServices)

Application                             Application
  |                                       |
  |-- key A + Language endpoint            |  one key + one endpoint
  |     |                                  v
  |     v                                Foundry resource
  |   Language resource                    |-- Language
  |     |-- PII, NER, CLU, ...             |-- Speech
  |                                        |-- Translator
  |-- key B + Translator endpoint          |-- Vision
        |                                  |-- Content Safety
        v                                  |-- Document Intelligence
      Translator resource                  |-- Azure OpenAI
        |-- text + document translation
```

The Foundry resource is listed under **Foundry > Foundry** in the portal, and its ARM `kind` is `AIServices`. Creating it with any other kind gives you a single-service resource instead, which is the most common provisioning mistake in this area.

Single-service resources still have a place. They give you per-service billing lines, independent quota, and a key that grants access to one service rather than seven. The Foundry resource gives you one endpoint, one key, one bill, and access to model deployments and agents alongside the classic tools. Regulated environments that want a key blast radius of one service tend to keep single-service resources; everything else benefits from the consolidated resource.

### How Azure Language Compares to Amazon Comprehend

Both services provide text analysis with prebuilt and custom models, and both train custom models without a separate ML platform.

| Aspect | Amazon Comprehend | Azure Language |
|---|---|---|
| **Packaging** | One service; translation, conversational intent, and enterprise search are separate AWS services | One service; Translator, Speech, and Vision are separate tools in the same family, reachable through a shared Foundry resource |
| **Sentiment** | Document sentiment plus targeted sentiment attached to specific entities | Sentence- and document-level sentiment plus opinion mining, both legacy |
| **Entity recognition** | Prebuilt entities plus custom entity recognizers | Prebuilt NER across roughly 50 entity types, plus custom NER |
| **Custom classification** | Custom classifiers trained with AutoML | Custom text classification, single-label and multi-label, legacy |
| **Custom model training** | AutoML inside Comprehend, no SageMaker required | Trained inside the Language resource, no separate ML infrastructure |
| **Retraining lifecycle** | Flywheels orchestrate training and evaluation of new model versions | Up to 10 trained models and 10 deployments per project, swapped by deployment name |
| **Conversational intent** | Not a Comprehend feature | CLU, legacy |
| **Question answering** | Not a Comprehend feature | Custom question answering, legacy |
| **Topic modeling** | Document clustering built in | No equivalent |
| **Health text** | Not a Comprehend feature | Text analytics for health, a core capability |

The claim that Azure custom models require no ML infrastructure holds, but it is not a differentiator against Comprehend, which trains custom classifiers and entity recognizers the same way. The genuine Azure advantages are text analytics for health as a first-class core feature and the shared Foundry resource that puts language, speech, vision, and generative models behind one endpoint. The genuine Azure disadvantage is that most of the text analytics surface is dated while Comprehend's is not.

---

## Core Capabilities

These five features carry no retirement date and receive ongoing investment.

### PII Detection

[PII detection](https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/overview){:target="_blank" rel="noopener noreferrer"} identifies entities associated with individuals so you can redact or govern them. It runs over three input shapes, each handling a different stage of a document pipeline.

- **Text PII** over unstructured text
- **Conversation PII** over chat logs and call transcripts, where speaker turns carry identity information that flat text analysis misses
- **Document PII** over native files like PDF, DOCX, and TXT, which removes the text-extraction step from your pipeline

Anonymization by synthetic replacement, where detected values are swapped for plausible fake ones rather than masked, is in preview and governed by Azure preview terms. Plan around masking if you need a GA path.

### Language Detection

[Language detection](https://learn.microsoft.com/en-us/azure/ai-services/language-service/language-detection/overview){:target="_blank" rel="noopener noreferrer"} evaluates text and returns the detected language and variant dialect. In a multilingual pipeline it usually runs first, because most other features take a language hint that materially affects quality.

### Prebuilt Named Entity Recognition

[Prebuilt NER](https://learn.microsoft.com/en-us/azure/ai-services/language-service/named-entity-recognition/overview){:target="_blank" rel="noopener noreferrer"} identifies roughly 50 entity types spanning people, organizations, locations, quantities, dates and times, contact details, products, and skills, with no training required. Several types including `CulturalEvent`, `NaturalEvent`, `SportsEvent`, and the medical, sports, and stock-exchange organization subtypes are English-only.

One API change catches code written against older material. Beginning with the GA API released `2024-11-01`, the **`subcategory` field is no longer returned**. All entity classification now comes back in the `type` field. Parsers that read `subcategory` to distinguish, say, a city from a country will silently get nothing.

### Custom Named Entity Recognition

[Custom NER](https://learn.microsoft.com/en-us/azure/ai-services/language-service/custom-named-entity-recognition/overview){:target="_blank" rel="noopener noreferrer"} trains models that recognize entity types prebuilt NER does not cover, which is the normal situation in medical, legal, financial, and technical domains where the entities are drug names, contract clauses, instruments, or component versions.

Custom NER differs from every other Language feature in one structural way. It requires a connected Azure Storage account holding the training documents, and **that connection is irreversible**. Once a storage account is linked to a Language resource you cannot unlink it. Choose the account deliberately rather than pointing at whatever container was convenient during a proof of concept.

### Text Analytics for Health

[Text analytics for health](https://learn.microsoft.com/en-us/azure/ai-services/language-service/text-analytics-for-health/overview){:target="_blank" rel="noopener noreferrer"} extracts and labels clinical information from unstructured text without a custom model. It is the one domain-specialized extractor in the core tier, and it is a strong reason to reach for Azure Language over a general-purpose model when the input is clinical.

---

## Legacy Capabilities

These features work, are supported, and are appropriate for existing systems. They all end on 31 March 2029, except entity linking on 1 September 2028.

### Conversational Language Understanding

[CLU](https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/overview){:target="_blank" rel="noopener noreferrer"} predicts the intent behind an utterance and extracts entities from it. You define intents like `book_flight` and `check_price` alongside entities like `destination` and `travel_date`, then supply utterances that exercise each one. The model generalizes to paraphrases you never labeled.

CLU now offers two paths, and the newer one changes the economics considerably.

**LLM-powered quick deploy** skips labeling entirely. You define intents and write a detailed description of what each one means, deploy against the LLM-based training config, and start predicting. There is no training data to collect, so the cost of standing up a working classifier drops from days of labeling to an afternoon of schema design.

**The custom machine-learned model** is the original path. Define the schema, label utterances, train, evaluate, improve, deploy. It costs more to build but gives you evaluation metrics against a held-out test set, which the quick-deploy path does not.

Two mechanics change how you work the labeled path. **Standard training is free and faster than advanced training**, so use it while you iterate on schema and only switch to advanced once the schema settles. And what the portal now calls a **fine-tuning task** is what older documentation calls a CLU project. The terms are used interchangeably.

If a model comes back overconfident, predicting wrong intents at a confidence of 1.00 and making the confidence threshold useless, the fix is a training configuration version rather than more data. Config `2023-04-15` normalizes confidence scores into a bounded range, and `2024-08-01-preview` specifically targets poor quality on out-of-domain utterances. Both require a retrain and a republish to take effect.

### Custom Text Classification

[Custom text classification](https://learn.microsoft.com/en-us/azure/ai-services/language-service/custom-text-classification/overview){:target="_blank" rel="noopener noreferrer"} sorts documents into classes you define, in either of two project types. **Single-label** assigns exactly one class per document, so a script is Romance or Comedy. **Multi-label** allows several, so the same script can be both. The project type is fixed at creation, and picking single-label for genuinely overlapping categories is the mistake that produces a model with respectable metrics and useless predictions.

Like custom NER, it reads training documents from a connected storage account with the same irreversible link.

### Custom Question Answering

[Custom question answering](https://learn.microsoft.com/en-us/azure/ai-services/language-service/question-answering/overview){:target="_blank" rel="noopener noreferrer"} builds a knowledge base from FAQ pages, manuals, and documents, then answers natural-language questions against it with confidence scores. It extracts question-answer pairs automatically from structured and semi-structured sources, and you can edit or add pairs by hand.

Beyond the basic lookup it supports multi-turn conversations with follow-up prompts, metadata filtering so answers can be scoped by content type or freshness, and active learning that improves answers from real usage. Ranking is a multi-stage architecture that combines Azure AI Search with NLP reranking.

That architecture is why a retrieval-augmented generation design built directly on Azure AI Search and a Foundry model is the natural successor. It is the same retrieval substrate with a generative reader in place of the fixed answer store.

### Orchestration Workflow

[Orchestration workflow](https://learn.microsoft.com/en-us/azure/ai-services/language-service/orchestration-workflow/overview){:target="_blank" rel="noopener noreferrer"} routes an incoming utterance to the right child project, connecting CLU and custom question answering projects behind one endpoint. An enterprise bot uses it to send calendar requests to a CLU skill and policy questions to a knowledge base without the calling application knowing which is which.

It is a router over two features that both retire on the same date, so it inherits their timeline exactly.

### Sentiment Analysis and Opinion Mining

[Sentiment analysis](https://learn.microsoft.com/en-us/azure/ai-services/language-service/sentiment-opinion-mining/overview){:target="_blank" rel="noopener noreferrer"} assigns positive, neutral, or negative labels at both the sentence and document level, choosing the label with the highest confidence score and returning scores between 0 and 1 for all three. Opinion mining, also called aspect-based sentiment analysis, attaches those sentiments to specific aspects of the text rather than the text as a whole, so "the food was great but the service was slow" resolves to opposite sentiments on two named targets.

### Key Phrase Extraction and Entity Linking

[Key phrase extraction](https://learn.microsoft.com/en-us/azure/ai-services/language-service/key-phrase-extraction/overview){:target="_blank" rel="noopener noreferrer"} returns the main concepts in a block of text as a list, useful for search indexing and document triage. [Entity linking](https://learn.microsoft.com/en-us/azure/ai-services/language-service/entity-linking/overview){:target="_blank" rel="noopener noreferrer"} disambiguates entities and returns Wikipedia links, separating Apple the company from apple the fruit.

Entity linking is the one legacy feature with an earlier date and a named in-service successor. It retires **1 September 2028**, and Microsoft points existing workloads at prebuilt NER or a Foundry model.

### Summarization

[Summarization](https://learn.microsoft.com/en-us/azure/ai-services/language-service/summarization/overview){:target="_blank" rel="noopener noreferrer"} combines generative models with task-optimized encoder models across three input genres.

**Text summarization** works two ways. Extractive summarization selects salient sentences from the source and returns each with a rank score and its start position and length, so you can render the summary in original document order or in rank order. Abstractive summarization generates new sentences that do not appear verbatim in the source, returned alongside the contextual input range each summary was drawn from.

**Conversation summarization** handles chat and call transcripts with four distinct outputs: a `recap` paragraph, `issue` and `resolution` summaries aimed at call centers, `chapterTitle` segmentation, and `narrative` per-segment detail. Chapter titles and narrative are designed to be requested together.

**Native document summarization** is in preview and accepts `.txt`, `.pdf`, and `.docx` directly. Summarization job output is retrievable for 24 hours and then purged, so treat the API as a processing step whose result you persist rather than a store you can query later.

---

## Azure Translator

[Azure Translator](https://learn.microsoft.com/en-us/azure/ai-services/translator/translator-overview){:target="_blank" rel="noopener noreferrer"} is a separate Foundry Tool covering more than 100 languages and dialects. It carries no retirement notice and has been actively extended rather than wound down.

### Text Translation Has Two Current GA Versions

Version **`2026-06-06`** is the newest generally available API. It adds the ability to select a specific large language model for the translation, adaptive custom translation, and an expanded parameter set. Version **v3** remains generally available and is what the client SDKs, the Foundry portal, and the Translator container target. New work that wants LLM-backed translation goes to `2026-06-06`; work that needs the SDKs or container stays on v3 until they catch up.

### Document Translation Runs Synchronously or Asynchronously

The two modes differ in a way that changes your architecture, not just your call pattern.

```
ASYNCHRONOUS (batch)                    SYNCHRONOUS (single file)

Client                                  Client
  |  submit job                           |  POST document (+ optional glossary)
  v                                       v
Translator  <--->  Blob Storage         Translator
  |            source + target             |
  |            containers                  |  translated document
  |  poll for completion                   v
  v                                      Client
Translated blobs in target container
```

Asynchronous batch translation preserves structure and formatting across many complex files, and it **requires an Azure Blob Storage account** with source and target containers. Synchronous translation takes a single file, optionally with a glossary, and returns the translated document directly in the response with no storage account involved. A pipeline that needs storage-free translation of one document at a time was, until the synchronous mode existed, forced into the blob-container dance for no reason.

### Customization Has Two Tiers

**Custom Translator** trains a domain-specific model from parallel documents through its own portal, and supports phrase and sentence dictionaries for terms that must translate a fixed way.

**Adaptive custom translation** is the lighter-weight option and the newer one. You upload between 5 and 10,000 prealigned source-target segment pairs of up to 500 characters each. The service builds a bilingual index in minutes and uses it to adapt a supported LLM at translation time. There is no training run, so the iteration loop is minutes rather than hours.

Beyond translation itself, Translator provides transliteration between scripts (Arabic to Latin, Cyrillic to Latin, Simplified to Traditional Chinese), automatic source-language detection, and dictionary lookup with in-context examples. It also runs in a container for on-premises deployment, with narrower language coverage than the cloud.

---

## Choosing Between Prebuilt, Custom, and Foundry Models

Every extraction and classification decision in this service now has three answers rather than two, and the retirement dates push the default toward the third.

```
What do you need out of the text?
  |
  +-- PII, clinical facts, or the source language
  |     -> Core Language feature: PII detection, text analytics
  |        for health, language detection. No training, no
  |        retirement date, billed per transaction.
  |
  +-- Named entities
  |     |
  |     +-- Prebuilt types cover the domain -> Prebuilt NER (core)
  |     |
  |     +-- Domain-specific types needed
  |           |
  |           +-- Labeled examples available -> Custom NER (core)
  |           |
  |           +-- No labeled data -> Foundry model
  |
  +-- A class label per document
  |     |
  |     +-- System retires before 2029 -> Custom text classification (legacy)
  |     |
  |     +-- Longer horizon -> Foundry model
  |
  +-- Intent behind an utterance
        |
        +-- No labeled data -> CLU LLM-powered quick deploy (legacy)
        |
        +-- Evaluation metrics required -> CLU labeled model (legacy)
        |
        +-- Longer horizon than 2029 -> Foundry model
```

Custom NER sits in the core tier while custom text classification sits in the legacy tier, which is the one place the core/legacy line cuts between two features that feel like siblings. Extraction has a future in this service. Classification does not.

### Training Data Requirements

The published minimums are lower than the round numbers that circulate in older material, and the volumes that actually produce a usable model are higher.

| | Custom NER | Custom text classification | CLU |
|---|---|---|---|
| **Training items** | 10 to 100,000 documents | 10 to 100,000 documents | 1 to 50,000 utterances |
| **Schema ceiling** | 200 entity types | 200 classes | 500 intents, 350 entities |
| **Documented recommendation** | Balanced, diverse, real-world data | 50 tagged instances per class | 25 utterances per intent, for the out-of-domain training config |
| **Item length** | 128,000 characters | 128,000 characters | 500 authoring, 1,000 prediction |
| **File format** | `.txt` only | `.txt` only | Utterances, no files |
| **Models per project** | 10 | 10 | 10 |
| **Deployments per project** | 10 paid, 1 free | 10 paid, 1 free | 10 |

The gap between the 10-document minimum and the recommended 50 instances per class is where most disappointing models live. The service will accept 10 documents and train, and the result will not generalize.

Both custom NER and custom text classification accept `.txt` files only, and every file must sit at the root of the container with no empty files. Converting a corpus of PDFs into flat text at the root of a container is a preprocessing job in its own right, and project plans routinely omit it.

Free tier F0 allows one Language resource per subscription with one hour of training time and 5,000 prediction calls per month, which is enough to evaluate a schema and not enough to validate a model.

---

## Deployment Architecture

### Model Versioning Through Deployment Slots

Custom Language projects give you up to 10 trained models and up to 10 deployment slots, and the two are decoupled. A deployment is a named pointer at a trained model, and your application calls a deployment name rather than a model name.

That indirection is the whole versioning mechanism. Train a candidate model while the current one keeps serving, deploy it to a second slot, run validation traffic against that slot, then either point the production deployment name at the new model or leave it alone. Rollback is repointing the name. Nothing about it requires taking the endpoint down.

Applications that hardcode a model name instead of a deployment name lose all of this and need a redeploy for every model change.

### Containers for On-Premises Deployment

Six Language features ship as Docker containers for deployment next to your data: sentiment analysis, language detection, key phrase extraction, custom NER, text analytics for health, and summarization. Translator ships a container as well, with narrower language coverage than the cloud service.

Containers matter for compliance boundaries that forbid sending text to a public endpoint at all. The set is not the full feature list, so check membership before designing around it. Notably, custom text classification and custom question answering are not on it.

---

## Integration Patterns

### PII Redaction Before Downstream Processing

The pattern that has aged best is redaction ahead of anything else, because it is a core capability and because it makes every downstream step easier to justify to a compliance reviewer.

```
Incoming document (PDF / DOCX / TXT)
    |
    v
Document PII detection
    |-- Detected: names, addresses, financial IDs, health identifiers
    |-- Output: redacted copy + entity offsets
    |
    +--> Redacted copy -> summarization, classification, indexing
    |
    +--> Entity offsets -> audit log (restricted store)
```

Running Document PII first means the text extraction step disappears, since the feature reads native files directly. Keeping the offsets separate from the redacted copy preserves the ability to answer "what did we remove" without putting the values back into the processing path.

### Chatbot with Conversational Understanding

```
User: "I want to return my order placed last week"
    |
    v
CLU deployment
  |-- Intent: return_order (confidence 0.98)
  |-- Entity: order_date = "last week"
    |
    v
Application logic
  |-- Route by intent -> return handler
  |-- Resolve date entity -> look up recent orders
  |-- Respond with the matched order
```

The confidence score is the load-bearing part. Route high-confidence intents automatically, send everything below your threshold to a fallback or a human, and set the threshold from your own tolerance rather than a default. If out-of-domain utterances are coming back with high confidence, that is a training configuration problem rather than a threshold problem.

### Multilingual Content Pipeline

```
English source content
    |
    v
Azure Translator
  |-- Detect source language
  |-- Translate to target languages
  |-- Apply glossary or adaptive index for product terms
    |
    v
Human review (weighted toward marketing and legal copy)
    |
    v
Publish to regional sites
```

Terminology control is the difference between a usable pipeline and one that renames your product in five markets. A Custom Translator dictionary pins exact renderings, and adaptive custom translation adapts tone and phrasing from example pairs without a training run.

---

## Common Pitfalls

### Building New Systems on Legacy Features

Starting a greenfield project on CLU, custom text classification, or custom question answering because a tutorial covers them buys you a system with a known end date and a migration to a different architecture already scheduled. Retirement is not deprecation. The APIs stop.

Check the tier before you design. If the feature is legacy and the system is expected to outlive 2029, the design question is which Foundry model and which retrieval pattern, not which Language feature.

### Treating Translator as Part of the Language Service

Provisioning one Language resource and expecting a translation endpoint on it produces a confusing 404. Translator is a separate resource with a separate key, unless you provision a Foundry resource with `kind` `AIServices`, in which case one endpoint and key covers both. The provisioning decision has to happen before the code is written, because the authentication shape differs.

### Training on the Minimum and Expecting Production Quality

The service accepts 10 training documents. Microsoft's published recommendations are 50 tagged instances per class for classification, and a minimum of 25 utterances per intent before CLU's out-of-domain training config behaves, and both are floors rather than targets. A model trained at the accepted minimum tends to score well on its own test split and fail on live traffic, because the split inherits whatever narrowness the training set had.

Diversity matters as much as volume. Data drawn from one person, one department, or one time window teaches the model correlations that do not hold elsewhere. CLU has a specific version of this trap. If every training utterance for an intent is lowercase or starts with the same phrase, the model can learn the casing rather than the meaning. Enabling casing normalization and diacritic augmentation in advanced project settings addresses it directly.

### Accepting Predictions Without Checking Confidence

Every prediction API in this service returns a confidence score, and treating them all as equally reliable routes low-confidence guesses straight into business logic. Support tickets land on the wrong team and extracted fields carry wrong values, with nothing in the response distinguishing them from correct ones.

Set thresholds per decision rather than per application. A destructive or irreversible action deserves a much higher bar than something displayed to a human who can ignore it, and everything below the bar needs a defined path, whether that is a human queue or an explicit fallback response.

### Parsing the Retired `subcategory` Field

Code written against pre-`2024-11-01` NER material reads `subcategory` to tell a city from a country. That field is gone from the GA API, and everything now comes back in `type`. Failures are silent, since the field is simply absent rather than an error.

### Assuming Language Coverage Is Uniform

Coverage varies by feature and, within a feature, by entity type. Several NER entity types are English-only. Translator's container supports fewer languages than its cloud service, and the LLM translation and adaptive custom translation columns cover a fraction of the languages plain translation does. Check the feature's own language support page for the specific pair you need rather than assuming a service-wide number.

The same asymmetry breaks knowledge bases. A custom question answering project sourced from English documents cannot match questions asked in another language, and returns "no answer found" for content that is demonstrably there. Either translate the sources or route incoming queries through Translator first.

---

## Key Takeaways

1. **Azure Language sits in Foundry Tools, and its ARM provider is still `Microsoft.CognitiveServices`.** The naming changed twice while the resource provider stayed put, so old infrastructure code keeps working even though every doc and portal path reads differently.

2. **Only five features are core: PII detection, language detection, prebuilt NER, custom NER, and text analytics for health.** Everything else in the service is documented as legacy and carries a retirement date.

3. **The legacy features retire 31 March 2029, except entity linking on 1 September 2028.** CLU, custom text classification, custom question answering, orchestration workflow, sentiment analysis, key phrase extraction, and summarization all end on the same date, with Foundry models as the named successor.

4. **Translator is a separate service, not a Language feature.** It covers more than 100 languages, carries no retirement notice, and needs either its own resource or a shared Foundry resource with `kind` `AIServices`.

5. **A Foundry resource fronts Language, Speech, Translator, Vision, Content Safety, Document Intelligence, and Azure OpenAI behind one endpoint and key.** Single-service resources remain the choice when key blast radius or per-service billing outweighs the convenience.

6. **Custom projects accept 10 training documents but need far more.** Microsoft publishes 50 tagged instances per class for classification and a 25-utterance-per-intent minimum for CLU's out-of-domain training config, against ceilings of 200 classes, 200 entity types, and 500 intents.

7. **Custom NER and custom text classification bind a storage account irreversibly.** Once linked to a Language resource it cannot be unlinked, so the choice deserves more thought than a proof of concept usually gives it.

8. **Deployment slots are the versioning mechanism.** Ten models and ten deployment slots per project let a new model serve validation traffic while the old one serves production, with rollback as a repointing rather than a redeploy, provided applications call deployment names rather than model names.

9. **CLU's LLM-powered quick deploy removes labeling from the intent-classification path.** Define intents with detailed descriptions, deploy, and predict. You trade away the evaluation metrics that a labeled test set provides.

10. **Confidence scores are part of the contract, not diagnostics.** Set a threshold per decision based on how costly a wrong answer is, and give everything below it a defined path.
