---
title: "AI and ML on AWS: Prebuilt Services, Bedrock, or SageMaker"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "How to choose where an AI or ML workload runs on AWS: prebuilt AI services for vision, documents, language, and speech, foundation models on Amazon Bedrock, custom models on SageMaker AI, or self-managed infrastructure, with how each is billed, how to evaluate them on your own data, and which services have closed to new customers."
tags: [ai-services, bedrock, sagemaker-ai, rekognition, textract, decision-making, practical]
---

## Four Ways to Put AI in an Application

AWS offers the same kind of capability at four levels of control, and most AI features can be built at more than one of them. Reading text from an invoice can be one call to a prebuilt document service, a prompt to a foundation model, a model you train yourself, or an open-source model you host on your own GPUs. The levels differ in how much you have to know, how much the result can be shaped to your data, and how the bill scales.

| Level | What you bring | What you get | How it's billed |
|---|---|---|---|
| **Prebuilt AI services** | Input data | A fixed task done by an AWS-trained model, such as detecting labels in an image or extracting tables from a PDF | Per unit: image, page, character, or second of audio. Custom models you train inside them add hourly training and hosting charges |
| **Foundation models on Amazon Bedrock** | Prompts, and optionally your documents or examples | General language and multimodal models that follow instructions, from AWS and other providers, behind one API | Per **token**, a chunk of text of roughly three-quarters of a word, in and out, or per image or second of video for media models. Batch jobs cost less, and provisioned throughput bills per hour |
| **Amazon SageMaker AI** | Labeled data and ML skills | Models trained, tuned, and hosted for your problem, with managed training jobs, endpoints, and pipelines | Per instance-hour for training and for **endpoints**, the always-on instances that serve a model, or per millisecond of compute for serverless inference |
| **Self-managed** | ML engineering and operations | Full control of frameworks, hardware, and serving, on EC2, EKS, or AWS Batch with GPU, Trainium, or Inferentia instances | Per instance-hour |

The rule of thumb is to start as far up this table as the task allows and move down only when a measurement says the higher level can't meet the requirement. Each step down trades cost of ownership for control. A prebuilt service has no model to maintain. A SageMaker model needs data, retraining, and monitoring for as long as it runs.

---

## Prebuilt AI Services

Prebuilt services each do a well-defined task with a model AWS trains and updates. They take data in and return structured results, usually with a confidence score per item, and most offer a way to adapt the model to your vocabulary or classes without doing ML.

### What each service does

| Service | Task | Ways to adapt it |
|---|---|---|
| **Amazon Rekognition** | Image and video analysis: objects and scenes, faces and face search against a collection, text in images, unsafe content, celebrity recognition | **Custom Labels** trains a detector for your own classes from labeled images |
| **Amazon Textract** | Documents: printed and handwritten text, forms as key-value pairs, tables, layout, answers to natural-language queries, and specialized analysis of invoices, receipts, identity documents, and mortgage packages | **Queries** ask for specific fields, and **adapters**, small models trained on your annotated samples, tune extraction to your document layouts |
| **Amazon Comprehend** | Text: entities, key phrases, sentiment, language, PII detection and redaction, toxicity | **Custom classification** and **custom entity recognition** trained on your labeled examples |
| **Amazon Translate** | Text translation between 75 languages, in real time or in batch | **Custom terminology** fixes how brand and technical terms translate, and **Active Custom Translation** adapts output to example sentence pairs in both languages that you supply |
| **Amazon Transcribe** | Speech to text, batch or streaming, with speaker labels, PII redaction, and a call analytics mode for contact centers | **Custom vocabularies** and **custom language models** for domain terms |
| **Amazon Polly** | Text to speech, with standard, neural, long-form, and generative voices | **Lexicons** control pronunciation, and SSML, a markup language for speech, controls pauses, emphasis, and speed |

Other services cover narrower jobs, such as **Amazon Personalize** for recommendations from interaction data and **Amazon Lex** for conversational bots.

Several have closed to new customers or entered retirement, so check a service's status before designing around it:

| Service or feature | Status |
|---|---|
| **Amazon Forecast** | Closed to new customers since July 29, 2024. AWS points to SageMaker Canvas |
| **Amazon Fraud Detector** | Closed to new customers since November 7, 2025. AWS points to SageMaker AI, AutoGluon, and AWS WAF |
| **Amazon Lookout for Equipment** | Closed to new customers October 7, 2025, and discontinued on October 7, 2026, after which its console and resources can't be accessed. AWS points to anomaly detection in AWS IoT SiteWise |
| **Rekognition streaming video and bulk image analysis** | Closed to new customers since April 30, 2026. The image APIs, called per video frame or per image in S3, replace them |
| **Comprehend topic modeling, event detection, prompt safety classification** | Closed to new customers since April 30, 2026 |
| **Amazon Kendra** | Closed to new customers since July 30, 2026 |
| **SageMaker AI features** A2I (human review of results), Ground Truth (labeling), Model Monitor, Clarify, Debugger, GeoSpatial, Role Manager, and Studio Lab | Closed to new customers since July 30, 2026. SageMaker Profiler is entering sunset |

Accounts that used a closed feature in the previous 12 months usually keep access, which is why a feature can work in one account and be missing in another. Features, languages, and models also vary by Region, so confirm both status and Regional availability before designing around a service.

### What they cost

Prices fall with volume, and in US East (N. Virginia) the first tier includes, for example:

| Task | Price |
|---|---|
| Rekognition image analysis, such as labels or faces | $0.001 per image for the first million each month |
| Textract plain text | $0.0015 per page |
| Textract tables / forms | $0.015 / $0.05 per page |
| Textract invoices and receipts | $0.01 per page |
| Comprehend sentiment, entities, key phrases | $0.0001 per unit of 100 characters, with a 3-unit minimum per request |
| Comprehend custom classification | $0.0005 per unit |
| Translate | $15 per million characters |
| Polly neural / generative voices | $16 / $30 per million characters |

Transcribe bills per second of audio, about $0.006 a minute for batch and $0.01 for streaming, with separate rates for call analytics and medical transcription. The unit prices make capacity planning straightforward. A million invoice pages a month through Textract's expense analysis costs about $10,000, against about $1,500 for plain text extraction, so the features requested per page drive the bill more than the page count.

Custom models inside these services change the billing shape. A Rekognition Custom Labels model costs $1 an hour to train and $4 for every hour it runs, whether or not images arrive, and a Comprehend custom classifier costs $3 an hour to train and, used in real time, needs an endpoint billed per second for as long as it's up. Weigh those charges against the next level, the same way you would SageMaker endpoints.

### Using them well

- **Choose synchronous or asynchronous APIs by input size.** Single images and short documents work synchronously. Multi-page documents, video, and long audio use asynchronous jobs that read from S3 and signal completion, through SNS for Textract and Rekognition or EventBridge for Transcribe, and large batches should run that way rather than as thousands of parallel synchronous calls.
- **Act on confidence scores.** Rekognition, Textract, Comprehend, and Transcribe return a confidence value with each result. Set thresholds per use case, and route low-confidence results to a human review queue that your application or a workflow such as Step Functions manages.
- **Respect the quotas.** Each API has a transactions-per-second quota per account and Region. High-volume pipelines queue work, retry with backoff, and request increases before launch.
- **Decide on data use.** Some AI services may store and use content to improve their models unless you opt out, and that content may be stored in a Region other than the one that processed it. An AI services opt-out policy in AWS Organizations, attached to the organization root, turns that off for every account and deletes stored copies, which regulated workloads usually need before choosing a service.

---

## Foundation Models on Bedrock

A foundation model on Amazon Bedrock is a general model that performs whatever task a prompt describes. One model can summarize a support ticket, classify it, extract its product names, translate it, and draft a reply, all from instructions. That flexibility is the reason to choose it: tasks no prebuilt service covers, tasks that need reasoning across a whole document or conversation, and tasks whose categories change too often to retrain a classifier.

Bedrock itself, meaning its models, knowledge bases, agents, guardrails, and customization, is its own subject. The selection question here is when a foundation model should replace a prebuilt service for a task both can do.

| Consideration | Prebuilt service | Foundation model |
|---|---|---|
| **Output** | Fixed schema, with confidence scores and, for text, character offsets | Whatever the prompt asks for, which needs validation |
| **Consistency** | Deterministic for a given model version, though AWS updates the models periodically | Output can vary between calls, and between model versions |
| **Cost at volume** | Predictable unit prices | Grows with input and output tokens, which vary by prompt and model. A small model can undercut a prebuilt service for the same task, and a large one can cost far more |
| **Latency** | Tuned for its task, with streaming APIs for speech | Depends on model size and output length |
| **Specialized capability** | Face search, PII offsets for redaction, real-time speech, voices | General reasoning and language |
| **Changing the task** | Retrain a custom model, or wait for AWS to add a feature | Edit the prompt |

A common split uses prebuilt services for the high-volume mechanical step, such as transcribing calls or extracting text from pages, and a foundation model for the step that needs judgment, such as summarizing the transcript or deciding what the document is asking for.

**Bedrock Data Automation** sits between the two for documents, images, audio, and video. It uses generative models behind a single API to extract structured fields into a schema you define, called a blueprint, with confidence scores and grounding back to where each value came from. It suits document and media processing that would otherwise chain several prebuilt services with custom parsing.

---

## Custom Models on SageMaker AI

Some problems have no general model, because the answer depends on patterns only in your data. Predicting which customers will cancel, scoring a transaction for fraud, forecasting demand for your products, and detecting defects on your production line all need a model trained on your history. That is **Amazon SageMaker AI**'s job: it runs training on managed instances, tunes hyperparameters, hosts models on endpoints, and tracks versions and pipelines.

SageMaker AI also lowers the entry point. **SageMaker Canvas** builds models from tabular, time-series, image, and text data with no code, using the automated model selection and tuning of **Autopilot**, which is also available as an API. **JumpStart** deploys and fine-tunes open-weight models, whose trained parameters are published for anyone to host, including foundation models you want to run yourself. Choose SageMaker AI when:

- the task is prediction from your own structured data, which neither prebuilt services nor prompts do well,
- a measured accuracy requirement isn't met by a prebuilt service or a foundation model on your evaluation data,
- or a high, steady inference volume would cost less on your own hosted model than per unit or per token.

The trade is ongoing ownership. Someone has to collect and label data, retrain as behavior shifts, monitor accuracy in production, and pay for endpoints between requests. Since July 30, 2026, SageMaker AI's own labeling and monitoring features, Ground Truth and Model Monitor among them, no longer accept new customers, so new teams plan those jobs with other tools.

---

## Self-Managed Infrastructure

Running training and inference yourself on EC2, EKS, or AWS Batch, with AWS Deep Learning AMIs and containers (machine images and container images with ML frameworks and drivers preinstalled), gives complete control of frameworks, versions, scheduling, and hardware, including AWS's own **Trainium** chips for training and inference and **Inferentia** chips for inference, which AWS designs to cost less per unit of work than GPUs for the models they support. It fits teams that already operate ML platforms, workloads SageMaker AI doesn't support well, and very large scale where engineering effort buys meaningful savings. For most teams, SageMaker AI's managed training and hosting on the same instance types is the better default.

---

## Choosing, Step by Step

```
1. Is it prediction from your own history (churn, fraud, demand, defects)?
   └── Yes → Custom model on SageMaker AI (go to 4).

2. Is it a standard task: labels, faces, text in images, document fields,
   sentiment, entities, PII, translation, transcription, speech?
   └── Yes → Test the prebuilt service on a labeled sample.
             Accurate enough → Use it. Adapt it (custom labels,
             vocabularies, queries) before leaving this level.
             Not accurate enough → go to 3.

3. Can a prompt describe the task, or does it need reasoning or
   flexible output?
   ├── Structured fields from documents, images, audio, or video
   │   → Bedrock Data Automation.
   └── Otherwise → Foundation model on Bedrock.
       Accurate enough and affordable per item → Use it.
       Not accurate enough, or too costly at your volume → go to 4.

4. Custom model on SageMaker AI.
   └── Need control SageMaker AI can't give, at large scale
       → Self-managed on EC2, EKS, or Batch.
```

Every branch starts with the same step, measuring on your own data. A few hundred labeled examples from production show whether a prebuilt service or a prompt is good enough, what it costs per item, and where it fails, which settles most of these choices before any custom modeling starts.

---

## Common Pitfalls

- **Estimating LLM cost from one prompt.** Token counts vary with input length, output length, and retries. Estimate from a realistic sample, and compare with the prebuilt service's unit price at the same volume.
- **Custom models left running.** A Rekognition Custom Labels model or a Comprehend real-time endpoint bills every hour it's up. Stop them outside business hours, or use asynchronous jobs where latency allows.
- **Adopting a feature that's closed to your account.** A feature that works in an older account may be closed to a new one. Check availability in the account and Region you'll deploy to.
- **Skipping the data-use decision.** Content can be retained to improve AWS models unless the organization opts out. Set the opt-out policy before production data flows.

---

## Key Takeaways

- AI capability on AWS comes at four levels: prebuilt services, foundation models on Bedrock, custom models on SageMaker AI, and self-managed infrastructure. Start at the highest level that meets a measured requirement.
- Prebuilt services cover vision (Rekognition), documents (Textract), language (Comprehend, Translate), and speech (Transcribe, Polly), priced per unit with confidence scores and customization short of ML.
- Foundation models handle tasks that need reasoning or change often, at per-token cost and with less predictable output. Bedrock Data Automation turns documents and media into structured fields with generative models.
- SageMaker AI is for prediction from your own data, or for when measured accuracy or volume rules out the higher levels, and it brings ongoing ownership.
- Forecast, Fraud Detector, Kendra, several SageMaker AI features, and some Rekognition and Comprehend features are closed to new customers, and Lookout for Equipment is discontinued on October 7, 2026.
