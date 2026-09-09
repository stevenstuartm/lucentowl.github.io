---
title: "Azure AI Vision Services"
layout: guide
category: Azure
subcategory: Machine Learning & AI
description: "A system architect's guide to Azure's vision and document services, covering which offerings are current, which are retiring, and how to choose between Image Analysis, Face, Document Intelligence, and Content Understanding."
tags: [machine-learning, computer-vision, document-intelligence, face-api, content-understanding, ocr, practical]
---

## What Are Azure AI Vision Services

Azure's vision offerings provide managed models for image analysis, optical character recognition (OCR), facial analysis, and document processing. These services abstract away model training and inference infrastructure, so an application can add visual intelligence with a REST call.

The product family has been renamed twice. It began as **Azure Cognitive Services**, became **Azure AI services**, and is now documented as **[Foundry Tools](https://learn.microsoft.com/en-us/azure/ai-services/what-are-ai-services){:target="_blank" rel="noopener noreferrer"}**. The general-purpose vision service is documented as **Azure Vision in Foundry Tools**, and older material calls the same thing Computer Vision or Azure AI Vision. The ARM resource provider stayed `Microsoft.CognitiveServices` through all of it, so infrastructure code written against the original name still deploys.

### The Portfolio Is Mid-Migration

Naming churn is cosmetic. The consequential change is that Microsoft has put two of the four classic vision services on a retirement path and is steering new work toward generative alternatives. Any architecture decision made here should start from service status, not from feature lists.

| Service | Status | Retirement | Where new work should go |
|---------|--------|------------|--------------------------|
| **Image Analysis** (`/imageanalysis`, v3.2 and v4.0) | Deprecated | 25 September 2028 | Document Intelligence (OCR), Face (faces), Content Understanding or Foundry models (everything else) |
| **Custom Vision** | Retirement announced | 25 September 2028 | Azure ML AutoML, Content Understanding classifiers, Foundry model catalog |
| **Face** | Current, Limited Access | None announced | Face |
| **Document Intelligence** | Current (v4.0 GA) | None announced for v4.0 | Document Intelligence |
| **Content Understanding** | Current (GA) | None announced | Content Understanding |

The [Image Analysis retirement](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/migration-options){:target="_blank" rel="noopener noreferrer"} covers every deployment type: cloud APIs, connected containers, and disconnected containers. An on-premises container deployment gets no reprieve.

Two features are already gone rather than merely deprecated. Spatial analysis retired on 30 March 2025, and the Image Analysis 4.0 Segment API (background removal) retired on 31 March 2025. Calls to either now fail.

### What These Services Solve

**Without a managed vision service:**
- Computer vision needs data scientists, labeled training data, and ML infrastructure
- Accurate OCR, document processing, or face matching is months of work to build
- Model accuracy decays as input distributions drift, so retraining is continuous
- Serving vision workloads means running and scaling GPU infrastructure

**With a managed vision service:**
- Image and document analysis reduces to a REST call or SDK method
- Prebuilt models cover common document types with no training data at all
- Microsoft maintains model quality and regional capacity
- Scaling is a pricing-tier decision rather than a cluster-sizing exercise

### How Azure Compares to AWS

| Aspect | AWS | Azure |
|--------|-----|-------|
| **General image analysis** | Rekognition (`DetectLabels`, `DetectText`, `DetectModerationLabels`) | Image Analysis, deprecated; Content Understanding or a Foundry vision model for new work |
| **Custom image models** | Rekognition Custom Labels | Custom Vision, retiring; Azure ML AutoML or Content Understanding classifiers for new work |
| **Face detection and matching** | Rekognition face operations | Face (detection open, identification and verification Limited Access) |
| **Document extraction** | Textract | Document Intelligence, with prebuilt and custom models |
| **Multimodal generative extraction** | Bedrock Data Automation | Content Understanding |
| **Pricing model** | Pay per API call | Pay per transaction, with F0 free and S0 standard tiers |
| **Search integration** | Kendra custom document enrichment | Azure AI Search skillsets with built-in vision and document skills |

The sharpest structural difference is gating. AWS lets any account call Rekognition's face operations. Azure requires an approved registration for Face identification and verification, which turns a feature decision into a procurement question.

---

## Choosing a Service

The comparisons throughout this guide all resolve into one decision, and input type settles most of it.

```
                    What is the input?
                            |
        +-------------------+--------------------+
        |                   |                    |
    Documents            Images               Faces
   (forms, PDFs,      (photos, scenes,     (identity,
    scans)             products)            liveness)
        |                   |                    |
        v                   v                    v
  Is there a          Do you need a         Detection only,
  prebuilt model      fixed schema or       or matching?
  for this type?      free-form insight?           |
        |                   |                 +---+---+
   +----+----+         +----+----+            |       |
   |         |         |         |       Detection  Matching
  Yes       No       Schema    Insight        |       |
   |         |         |         |            |       v
   v         v         v         v            |   Limited
Document  Do you     Content  Foundry         |   Access
Intel.    have 5+    Under-   vision          |   registration
prebuilt  labeled    standing  model          |   required
model     samples?   analyzer                 |       |
             |                                v       v
        +----+----+                        Face Detect / Identify,
        |         |                        Verify, Liveness
       Yes        No
        |         |
        v         v
   Document    Content
   Intelligence Understanding
   custom       (schema, no
   model        training data)
```

Three rules fall out of it:

- **Text-bearing documents go to Document Intelligence**, not to a general image API. Image Analysis OCR returns text without structure, so field-level extraction becomes your post-processing problem.
- **A fixed output schema favors Document Intelligence or a Content Understanding analyzer.** Open-ended description favors a generative model.
- **Anything touching identity goes through Face**, and the registration timeline belongs in the project plan rather than in the integration sprint.

---

## Image Analysis (Deprecated)

[Image Analysis](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview){:target="_blank" rel="noopener noreferrer"} extracts visual features from arbitrary images: objects, tags, captions, and text. It is the service most existing Azure vision code calls, and it is the one being retired.

**Capabilities that still work until retirement:**
- **Object detection:** bounding boxes and confidence scores for detected objects
- **Tagging:** semantic tags describing image content
- **Captioning:** generated natural-language descriptions of an image and of regions within it
- **OCR:** printed and handwritten text extraction
- **Smart crops:** suggested crop regions at a requested aspect ratio

**Capabilities already retired:** spatial analysis (30 March 2025) and background removal via the Segment API (31 March 2025). A guide, sample, or blog post describing either is describing something that no longer runs.

### Input Requirements

| Constraint | Value |
|------------|-------|
| Formats | JPEG, PNG, GIF, BMP |
| Maximum file size | 4 MB |
| Minimum dimensions | 50 x 50 pixels |
| Maximum dimensions (Read) | 10,000 x 10,000 pixels |

### Migration Paths

Microsoft splits the retirement into scenario-specific replacements rather than offering a single successor.

| What you use Image Analysis for | Replacement |
|---------------------------------|-------------|
| OCR on documents | Document Intelligence `prebuilt-read` |
| Face detection or attributes | Face service |
| Image embeddings for search | Cohere Embed in Microsoft Foundry, or SigLIP |
| Tagging, captioning, description | A Foundry vision model, or a Content Understanding analyzer |
| Zero-shot classification | SigLIP, or a Content Understanding classifier |

Microsoft's published guidance asks customers to have a transition plan by September 2026 even though calls keep working until September 2028. Treat the earlier date as the one that matters for planning.

### OCR: Which Read Engine to Use

OCR is confusing because three engines have carried the name **Read**.

| Input type | Use | Why |
|------------|-----|-----|
| In-the-wild images (signs, labels, posters) | Image Analysis 4.0 OCR | Synchronous API, tuned for non-document images, but retiring with Image Analysis |
| Documents (scans, PDFs, forms) | [Document Intelligence `prebuilt-read`](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read){:target="_blank" rel="noopener noreferrer"} | Asynchronous, tuned for text-heavy documents, and not on a retirement path |
| Anything | Legacy OCR v3.2 or RecognizeText v2.1 | Do not. Microsoft explicitly recommends against both, and no further updates are shipping |

Both current Read engines share a baseline: printed and handwritten extraction, pages and lines and words with location and confidence scores, mixed-language and mixed-mode support, and a distroless Docker container for on-premises deployment.

Read input limits differ from the Image Analysis limits above: up to 2,000 pages for PDF and TIFF (the first two pages only on the free tier), image files under 500 MB on the paid tier and 4 MB on free, and a minimum extractable text height of about 12 pixels on a 1024 x 768 image.

---

## Custom Vision (Retiring)

[Custom Vision](https://learn.microsoft.com/en-us/azure/ai-services/custom-vision-service/overview){:target="_blank" rel="noopener noreferrer"} trains image classification and object detection models on your own labeled images, with no ML expertise required. Microsoft supports existing customers until **25 September 2028** and recommends against starting new projects on it.

**Capabilities:**
- **Image classification:** single-label or multi-label categorization into classes you define
- **Object detection:** localization of your object types, returning bounding boxes
- **Domain selection:** algorithm variants tuned for subject matter such as landmarks or retail
- **Model export:** Docker, ONNX, or TensorFlow output for edge and on-premises inference

### Where Custom Vision Work Should Go Now

| Requirement | Replacement |
|-------------|-------------|
| Classification or detection with classic ML | Azure ML AutoML for images |
| Managed classification with no training pipeline | Content Understanding custom classifier |
| Custom visual reasoning with prompts instead of labels | A vision model from the Foundry model catalog |

The AutoML path is the closest functional match but a meaningfully different operational model: you own a workspace, compute, and an endpoint rather than calling a hosted prediction URL.

### Training Data Requirements

The commonly repeated "50 images minimum" is a recommendation, not the service limit, and the actual floor differs by project type.

| Factor | F0 (free) | S0 (standard) |
|--------|-----------|---------------|
| Projects | 2 | 100 |
| Training images per project | 5,000 | 100,000 |
| Predictions per month | 10,000 | Unlimited |
| Tags per project | 50 | 500 |
| Iterations retained | 20 | 20 |
| Minimum labeled images per tag, classification | 5 | 5 |
| Minimum labeled images per tag, object detection | 15 | 15 |
| Maximum training image size | 6 MB | 6 MB |
| Maximum prediction image size | 4 MB | 4 MB |

Microsoft recommends 50 or more images per tag regardless of tier, and notes that the service is tuned to separate major visual differences rather than subtle ones. Detecting hairline cracks or small dents in a quality-assurance workflow is the documented example of what it does poorly.

### Iterations and Deployment

Each training run produces an **iteration**. One published iteration serves the prediction endpoint at a time, and the 20-iteration ceiling is a hard limit on both tiers, so an active project needs a deletion policy rather than an archive of every run.

Custom Vision is also the one service here that needs **two resources**: a training resource billed per training hour and a prediction resource billed per prediction. Splitting them lets a production prediction endpoint scale independently of a training environment that may sit idle for weeks.

---

## Face

The [Face service](https://learn.microsoft.com/en-us/azure/ai-services/face/overview-identity){:target="_blank" rel="noopener noreferrer"} detects, analyzes, and matches human faces. It is current and actively developed, and it absorbed the face scenarios that Image Analysis is losing.

### Limited Access Gating Comes First

Face is the only service in this guide where the technical evaluation can be irrelevant, because access is gated by approval rather than by subscription.

| Operation | Access |
|-----------|--------|
| **Detect** (rectangles, landmarks, permitted attributes) | Available to any customer, no registration |
| **Identify** (1:N matching) | Limited Access, registration required |
| **Verify** (1:1 matching) | Limited Access, registration required |
| **Liveness SDKs** | Gated separately through the same intake form |

Registration constraints that shape a design:

- Limited Access features run only on **S0 and E0** pricing tiers. The **F0 free tier does not support them**, so there is no unapproved path to a proof of concept.
- Access is granted "only to customers managed by Microsoft," meaning organizations working directly with a Microsoft account team. An unaffiliated team cannot assume approval.
- You declare a use case on the form, and approval is scoped to it. Microsoft may require periodic reverification.
- Since 11 June 2020, use by or for U.S. police departments is prohibited outright. Creating a Face resource requires acknowledging this in the portal.

Build the registration lead time into the schedule. A design that assumes 1:N identification and discovers the gate during integration has no fallback inside Azure.

### Attributes: What Was Retired and What Is Restricted

Microsoft cut back facial attribute inference on responsible-AI grounds, and the older attribute lists that circulate are wrong in both directions.

| Attribute | Status |
|-----------|--------|
| Emotion | **Retired**, no longer returned |
| Gender | **Retired**, no longer returned |
| Age, smile, facial hair, hair, makeup | **Limited**, require a separate approved use case |
| Head pose, blur, exposure, noise, occlusion, glasses, landmarks | Available |

The available set is what remains useful anyway: it is mostly image-quality signals. Checking blur, occlusion, and glasses before enrolling a face is the difference between a recognition system that works and one that degrades quietly as bad enrollments accumulate.

### Liveness Detection

Liveness detection determines whether a face in a video stream is a live person rather than a printed photo, a replayed video, a screen, or a 3D mask. It runs as a client SDK (Android, iOS, and Web) coordinated with the service, and it is the piece that makes remote identity verification defensible.

Microsoft reports a 0% penetration rate in iBeta Level 1 and Level 2 Presentation Attack Detection testing, conducted by a NIST/NVLAP-accredited lab against ISO/IEC 30107-3. Any verification flow where the image comes from a user-controlled camera should include it. Verification without liveness only proves that someone submitted a matching image.

### Recognition Data Structures

Face matching needs somewhere to keep enrolled faces, and the choice of container sets the ceiling on the system.

| Structure | Holds | Use for |
|-----------|-------|---------|
| **FaceList / LargeFaceList** | Individual faces | Find Similar, which answers whether two faces look alike |
| **PersonGroup / LargePersonGroup** | Person objects, each with multiple faces | Identify, which answers who a face belongs to |

A person group holds up to **1 million person objects**, and each person object holds up to **248 registered faces**. Multiple enrollment images per person is the point of the structure: variation in lighting, angle, and appearance is what makes 1:N matching hold up over time.

Two more operations round it out. **Find Similar** runs in `matchPerson` mode (filtered through Verify, so results are the same person) or `matchFace` mode (raw visual similarity, same person or not). **Group** partitions a set of unknown faces into likely-same-person clusters and returns unmatched faces in a `messyGroup` array.

### Detection and Recognition Input Limits

| Constraint | Value |
|------------|-------|
| Formats | JPEG, PNG, GIF (first frame), BMP |
| Maximum file size | 6 MB |
| Minimum detectable face | 36 x 36 pixels in an image up to 1920 x 1080 |
| Maximum detectable face | 4096 x 4096 pixels |
| Recommended face size for verification | 200 x 200 pixels |

The minimum face size scales with image size, so faces in a 4K frame need to be proportionally larger than 36 pixels to register. A camera placement that puts subjects far from the lens fails detection before recognition ever runs.

---

## Document Intelligence

[Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview){:target="_blank" rel="noopener noreferrer"} (formerly Form Recognizer) extracts structured data from documents, combining OCR with layout and field understanding to return key-value pairs, tables, and typed fields. It is the service most vision workloads should be pointed at, and the recommended destination for OCR work leaving Image Analysis.

### Version Support

Version matters here more than in most Azure services, because the model catalog changed between versions.

| Version | Status | End of support |
|---------|--------|----------------|
| v4.0 (2024-11-30) | GA, current | None announced |
| v3.1 (2023-07-31) | GA, previous | None announced |
| v3.0 (2022-08-31) | GA, retiring | 30 March 2029 |
| v2.1 | GA, retiring | 15 September 2027 |

A custom model inherits the lifecycle of the API version that trained it. When that version is deprecated, the model stops being available for inference, so migrating an API version means retraining custom models rather than just changing an endpoint.

### Document Analysis Models

| Model | Extracts |
|-------|----------|
| `prebuilt-read` | Printed and handwritten text |
| `prebuilt-layout` | Text, tables, selection marks, and document structure |

The **general document** model (`prebuilt-document`, key-value pair extraction without a schema) was deprecated and **is not available in v4.0**. Code targeting it has to move to layout plus a custom or generative extraction step.

### Prebuilt Models

Prebuilt models are trained by Microsoft on specific document types and return field-level data with no training on your part. The v4.0 catalog is considerably wider than the invoice-receipt-business-card set that older material describes.

| Family | Models |
|--------|--------|
| **Financial and legal** | Bank statement, check, contract, credit card, invoice, pay stub, receipt |
| **US tax** | Unified US tax, W-2, 1098 variants, 1099 variants, 1040 variants |
| **US mortgage** | 1003 (loan application), 1004 (appraisal), 1005 (employment verification), 1008 (loan transmittal), closing disclosure |
| **Personal identification** | Health insurance card, identity documents, marriage certificate |

The **business card** model is **not in the v4.0 catalog**. It existed through v3.1 and did not carry forward, which is a common source of surprise when migrating.

Extracted fields come back strongly typed (`string`, `number`, `integer`, `date`, `time`, `phoneNumber`, `currency`, `address`), so an invoice date arrives as a date and a subtotal as a currency value without any parsing configuration.

### Custom Models

When no prebuilt model fits, you label your own documents. Five examples of the same document type is enough to start.

| Feature | Custom template | Custom neural |
|---------|-----------------|---------------|
| Document structure | Fixed template or form | Structured, semi-structured, and unstructured |
| Training time | 1 to 5 minutes | 30 minutes to 12 hours |
| Extracts | Key-value pairs, tables, selection marks, coordinates, signatures | Key-value pairs, selection marks, tables |
| Overlapping fields | Not supported | Supported |
| Document variations | One model per variation | One model across variations |
| Training data ceiling | 500 pages, 50 MB | 50,000 pages, 1 GB |

Start with neural. Template models only hold up when every document shares an identical visual layout, and the way to test that is to blank out all user-entered data and check whether the empty forms are indistinguishable. If they are not, template accuracy will drift and you will end up training one model per variation and composing them.

Neural training defaults to a 30-minute budget. Going beyond that requires enabling paid training.

**Custom classifiers** are the companion piece: they identify which type a document is, and split multi-document files into page ranges, so the right extraction model gets invoked per document. v4.0 classifiers also support Office file types and incremental training.

### Custom Model Input Constraints

| Constraint | Value |
|------------|-------|
| Formats | PDF, JPEG/JPG, PNG, BMP, TIFF, HEIF (Office formats for read, layout, and classification only) |
| Pages per document | 2,000 (first two pages on free tier) |
| File size | 500 MB paid (S0), 4 MB free (F0) |
| Image dimensions | 50 x 50 to 10,000 x 10,000 pixels |
| Password-protected PDFs | Must be unlocked before submission |

---

## Content Understanding

[Content Understanding](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview){:target="_blank" rel="noopener noreferrer"} is the generative successor that most retiring vision capabilities point toward. It processes documents, images, audio, and video into a user-defined output format, and it reached GA with API version `2025-11-01`.

The unit of configuration is an **analyzer**: content extraction settings, a field schema, and model deployments, applied consistently to everything sent through it. Fields can be produced three ways.

| Method | Behavior | Example |
|--------|----------|---------|
| **Extract** | Pull the value as it appears (documents only) | A date from a receipt |
| **Classify** | Assign from a predefined set of categories | Call sentiment, or document type for routing |
| **Generate** | Produce a value freely from the input | A summary of a call, or a scene description |

Two properties make it usable for straight-through processing rather than just for exploration. **Confidence scores** (0 to 1, per field) let you set a threshold above which no human reviews the result. **Grounding** identifies the region of the source content each value came from, so a reviewer can verify a field without rereading the document. Both are enabled by the `estimateFieldSourceAndConfidence` setting on document analyzers.

Content Understanding requires a Microsoft Foundry resource and your own deployments of supported generative and embedding models, which it uses for field extraction and figure analysis. That is a different cost and operations model from a per-transaction prebuilt API: you are paying for model inference plus contextualization tokens rather than a flat per-page rate.

### Content Understanding or Document Intelligence

Both extract structured data from documents, and their capabilities overlap substantially.

| Choose | When |
|--------|------|
| **Document Intelligence** | A prebuilt model matches your document type, or you need deterministic per-page pricing and a fixed field schema on a well-defined layout |
| **Content Understanding** | Your inputs span modalities, your schema is defined by prompt rather than by labels, you need generated or classified fields alongside extracted ones, or you want one pipeline over documents, images, audio, and video |

---

## Resource Organization and Pricing

### Resource Types

| Resource | Kind | Covers |
|----------|------|--------|
| **Microsoft Foundry** | `AIServices` | Multiple Foundry Tools behind one endpoint and key, plus model deployments, agents, and projects |
| **Single-service** | `ComputerVision`, `Face`, `FormRecognizer`, and so on | One service, one key |
| **Custom Vision** | `CustomVision.Training` and `CustomVision.Prediction` | Training and prediction, billed separately |

The Foundry resource is the current default and is listed under **Foundry > Foundry** in the portal. It provides one Azure-managed boundary for identity, networking, encryption, billing, and monitoring across the services inside it, which is why it earns its place even when you only call one service today.

Single-service resources are still valid, and they remain the better fit when you need per-service cost attribution across teams, or when a single service has to sit in a different region or under a different network policy than the rest.

### Pricing Shape

Pricing is per transaction, with the tier setting both the transactions-per-second ceiling and which features are enabled. `F0` is the free SKU on most services and `S0` the standard one. Free tiers are for development: they cap monthly volume, process only the first two pages of multi-page documents, and, on Face, exclude Limited Access operations entirely.

Cost drivers differ by service in ways that matter at design time. Prebuilt Document Intelligence models bill per page. Custom Vision splits training hours from prediction transactions. Content Understanding bills model inference and contextualization tokens rather than a flat page rate, so per-document cost varies with document complexity.

---

## Integration with Azure AI Search

[Azure AI Search](https://learn.microsoft.com/en-us/azure/search/cognitive-search-predefined-skills){:target="_blank" rel="noopener noreferrer"} skillsets call these services during indexing, so extracted content becomes searchable without a bespoke pipeline. The skill catalog is narrower than the service catalog, which is the detail most often gotten wrong: there is no skill that runs the `prebuilt-invoice` model.

```
  Blob Storage / SharePoint / ADLS
                |
                v
        +---------------+
        |    Indexer    |  scheduling, change detection,
        +---------------+  error handling
                |
                v
        +---------------------------------------+
        |              Skillset                 |
        |                                       |
        |  Document Layout ---> markdown /      |
        |  (DI layout model)    text chunks +   |
        |                       images +        |
        |                       location meta   |
        |                                       |
        |  OCR --------------> text from images |
        |                                       |
        |  Image Analysis ---> tags, captions   |
        |                                       |
        |  Content Underst. -> semantic chunks, |
        |                      field values     |
        |                                       |
        |  Vision embeddings-> image vectors    |
        +---------------------------------------+
                |
                v
        +---------------+
        |     Index     |  text fields + vector fields
        +---------------+
                |
                v
      Full-text, vector, and hybrid queries
```

| Skill | Backed by | Produces |
|-------|-----------|----------|
| **Document Layout** (`DocumentIntelligenceLayoutSkill`) | Document Intelligence layout model, v4.0 | Markdown or chunked text, plus extracted images with page and bounding-polygon metadata |
| **OCR** | Foundry Tools | Text from images |
| **Image Analysis** | Foundry Tools | Tags and generated descriptions |
| **Azure Content Understanding** | Your Content Understanding deployment | Advanced document analysis and semantic chunking |
| **Azure Vision multimodal embeddings** | Foundry Tools | Vectors over images and text together |

Two billing models are in play. Most built-in skills attach a Foundry resource **for billing only**, with Azure AI Search executing them on internal resources. The Content Understanding skill connects to **your** deployment for both billing and processing, which means its throughput and quota are yours to manage.

The Document Layout skill is the workhorse for retrieval-augmented generation. It emits markdown that preserves heading structure (`markdownHeaderDepth` controls the nesting depth captured) or fixed-size text chunks with configurable overlap, and its `extractionOptions` can pull images with the page number and bounding polygon showing where each one sat. That positional metadata is what lets a RAG answer cite a location rather than a document.

Two constraints apply. Documents needing more than five minutes in the layout model time out, and the attached Foundry resource is still charged for the failed attempt. Beyond 20 documents per indexer per day the skill requires a billable Foundry resource attached to the skillset.

---

## Common Pitfalls

### Pitfall 1: Building New Work on a Retiring Service

**Problem:** Selecting Image Analysis or Custom Vision because the tutorials, samples, and blog posts are plentiful and the API is easy.

**Result:** A system with a September 2028 expiry and no drop-in successor. Image Analysis fragments into four different replacements depending on what you used it for, and the Custom Vision replacement (AutoML) is a different operational model requiring a workspace, compute, and a managed endpoint. Neither is a configuration change.

**Solution:** Check service status before feature fit. For OCR, start at Document Intelligence. For custom classification, start at Content Understanding or AutoML. If an existing Image Analysis deployment has to keep running, map each feature you call to its specific replacement now, while the migration is a planning exercise rather than an outage.

---

### Pitfall 2: Discovering Face Limited Access During Integration

**Problem:** Designing an identity verification or 1:N matching flow around the Face service, then finding out that Identify and Verify require an approved registration, are unavailable on the free tier, and are granted only to customers with a Microsoft account team relationship.

**Result:** A blocked integration with no in-Azure fallback. Face detection alone cannot answer who someone is.

**Solution:** Submit the [registration](https://aka.ms/facerecognition){:target="_blank" rel="noopener noreferrer"} before the design depends on it, and state the actual use case, since approval is scoped to what you declare. Prototype the parts that work unregistered (detection, quality attributes, enrollment UX) while approval is pending. If approval is uncertain, evaluate a third-party identity verification provider in parallel rather than after.

---

### Pitfall 3: Using General OCR Where Structure Is Needed

**Problem:** Running invoices or receipts through a general OCR API and expecting field-level accuracy.

**Result:** Text comes back correct but unstructured. Nothing distinguishes an invoice number from a purchase order number or a line-item total from the grand total, so accuracy now depends on regular expressions over positional text.

**Solution:** Use a Document Intelligence prebuilt model. It understands document semantics and returns typed fields. When no prebuilt model matches, a custom neural model on five labeled samples still beats parsing raw OCR output.

---

### Pitfall 4: Undersized or Unvaried Training Data

**Problem:** Training a Custom Vision or custom Document Intelligence model on the documented minimum (5 images per tag, 5 documents) and treating that as sufficient.

**Result:** The model overfits. It scores well on held-back data drawn from the same batch and collapses on production inputs that differ in lighting, angle, scanner, or layout variant.

**Solution:** Treat the minimum as what the service accepts, not what it needs. Microsoft recommends 50 or more images per tag for Custom Vision, and a larger document set when scans are low quality. Vary the conditions deliberately, and evaluate against held-out data that reflects real production variation rather than a split of the original batch.

---

### Pitfall 5: Assuming Uniform Regional Availability

**Problem:** Choosing a region for reasons unrelated to AI, then assuming every model and skill is available there.

**Result:** A capability you depend on is missing. The Azure AI Search Document Layout skill is a concrete example: through the Import data wizard it requires the search service and multi-service account to be in East US, West Europe 2, or North Central US, and using a resource key for billing requires both resources in the same region. Entra ID authentication removes the same-region requirement, so the constraint depends on how you wired up billing.

**Solution:** Verify [regional availability](https://learn.microsoft.com/en-us/azure/ai-services/where-to-use-an-ai-service){:target="_blank" rel="noopener noreferrer"} for every model and skill in the design, not just for the service. Where a constraint is tied to an authentication or billing choice, check whether a different choice relaxes it.

---

### Pitfall 6: Ignoring Latency Shape in Interactive Flows

**Problem:** Putting an asynchronous document API behind a synchronous user interaction, such as a form that uploads a document and displays extracted fields immediately.

**Result:** The user waits through a submit-poll-retrieve cycle. Document Intelligence analysis is a long-running operation by design, and a large or complex document takes proportionally longer.

**Solution:** Match the API shape to the interaction. Synchronous OCR suits real-time image scenarios. For document extraction in a user-facing flow, accept the upload, return immediately, and notify on completion. Test end-to-end latency in the production region under realistic document sizes, since it varies with both.

---

## Key Takeaways

1. **Check service status before feature fit.** Image Analysis and Custom Vision both retire on 25 September 2028, and the Image Analysis retirement covers connected and disconnected containers as well as the cloud API. Spatial analysis and background removal are already gone.

2. **The retirement has no single successor.** Image Analysis fragments by scenario: Document Intelligence for OCR, Face for faces, Cohere Embed or SigLIP for embeddings, and Content Understanding or a Foundry model for tagging and description.

3. **Document Intelligence is the durable choice for anything text-bearing.** v4.0 is current, the prebuilt catalog now spans financial, tax, mortgage, and identification documents, and it is where Microsoft is routing OCR work leaving Image Analysis.

4. **Two Document Intelligence models that older material describes are gone from v4.0:** the business card model and the general document model. Both existed through v3.1 and did not carry forward.

5. **Face access is a procurement question, not a technical one.** Detection is open, but Identify and Verify need an approved registration, run only on S0 and E0 tiers, and are granted only to Microsoft-managed customers. Registration lead time belongs in the schedule.

6. **Face attribute lists in circulation are wrong.** Emotion and gender are retired outright. Age, smile, facial hair, hair, and makeup need a separately approved use case. What remains is largely image-quality signal, which is the useful part for keeping enrollment clean.

7. **Verification without liveness proves only that someone submitted a matching image.** The liveness SDKs are gated through the same intake form and tested to ISO/IEC 30107-3.

8. **Documented minimums are floors, not targets.** Custom Vision accepts 5 labeled images per tag for classification and 15 for object detection, but recommends 50 or more. Document Intelligence accepts 5 documents and wants more when scan quality is poor.

9. **Content Understanding is where the generative path leads.** It is GA, spans documents, images, audio, and video, and its confidence scores plus grounding are what make straight-through processing defensible. It bills model inference rather than a flat per-page rate.

10. **Azure AI Search integrates a narrower set than the service catalog suggests.** The Document Layout skill runs the layout model only. No skill runs `prebuilt-invoice`. Most skills attach a Foundry resource for billing while Search executes them, but the Content Understanding skill runs on your own deployment.
