---
title: "ML on AWS - Service Selection"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "Decision framework for choosing between SageMaker, AI services, and custom ML solutions based on use case, expertise, and cost"
tags: [aws, machine-learning, decision-making, cost-analysis, architecture, practical]
---

## What Problem This Solves

**The ML Service Selection Challenge**:
Organizations face a critical decision when implementing machine learning on AWS: should they use pre-built AI services (Rekognition, Comprehend, Transcribe), build custom models with SageMaker, or develop entirely custom solutions? The wrong choice leads to unnecessary complexity, excessive costs, or models that don't meet business requirements.

**What This Guide Provides**:
A systematic decision framework for selecting the right ML approach based on:
- Use case requirements and constraints
- Team expertise and resources
- Cost and time-to-market considerations
- Customization needs and data availability
- Compliance and operational requirements

---

## The AWS ML Service Spectrum

AWS offers three tiers of ML services, each suited for different scenarios:

### Tier 1: AI Services (Pre-Built, Fully Managed)

**Services**: Rekognition, Comprehend, Transcribe, Polly, Translate, Textract, Forecast, Personalize

**What they are**:
- Pre-trained models ready to use via API calls
- No ML expertise required
- Pay-per-use pricing (per image, per character, per minute)
- Instant deployment (no model training)

**Example**:
```python
import boto3

# Computer vision with Rekognition - zero ML expertise needed
rekognition = boto3.client('rekognition')

response = rekognition.detect_labels(
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'product.jpg'}},
    MaxLabels=10
)

for label in response['Labels']:
    print(f"{label['Name']}: {label['Confidence']:.2f}%")
```

**When to use**: Common use cases with standard requirements (sentiment analysis, image classification, translation).

<div class="comparison">
<div class="content-card content-card--accent">
<h4>AI Services</h4>
<ul>
<li>Pre-trained models via API</li>
<li>No ML expertise required</li>
<li>Pay-per-use pricing</li>
<li>Instant deployment</li>
<li>Common use cases only</li>
<li>Cost: $100-5K/month typically</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>SageMaker</h4>
<ul>
<li>Custom models, managed infrastructure</li>
<li>ML expertise required</li>
<li>Infrastructure + usage pricing</li>
<li>Weeks to train and deploy</li>
<li>Custom use cases and data</li>
<li>Cost: $1K-10K/month + dev</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>DIY</h4>
<ul>
<li>Self-managed ML infrastructure</li>
<li>Full ML engineering team needed</li>
<li>EC2/ECS/EKS costs + ops</li>
<li>Months to build pipelines</li>
<li>Extreme specialization only</li>
<li>Cost: $10K+/month + team</li>
</ul>
</div>
</div>

### Tier 2: SageMaker (Custom Models, Managed Infrastructure)

**Services**: SageMaker Training, Inference, Built-in Algorithms, AutoML (Autopilot), Feature Store, Model Registry

**What it is**:
- Platform for building, training, and deploying custom ML models
- Managed infrastructure (compute, storage, orchestration)
- Bring your own model code or use built-in algorithms
- Requires ML expertise (data science, feature engineering)

**Example**:
```python
from sagemaker.pytorch import PyTorch

# Custom model training with SageMaker
estimator = PyTorch(
    entry_point='train.py',  # Your custom training code
    role='arn:aws:iam::123456789012:role/SageMakerRole',
    instance_type='ml.p3.2xlarge',
    instance_count=1,
    framework_version='1.12',
    py_version='py38'
)

estimator.fit({'training': 's3://my-bucket/training-data/'})
```

**When to use**: Custom use cases requiring domain-specific models, proprietary data, or performance tuning.

### Tier 3: DIY (Custom ML, Self-Managed)

**Services**: EC2, ECS/EKS, Lambda (for inference), S3, custom ML frameworks (TensorFlow, PyTorch)

**What it is**:
- Complete control over ML infrastructure and code
- You manage everything: training, deployment, scaling, monitoring
- Use open-source frameworks and custom pipelines
- Maximum flexibility, maximum operational burden

**Example**:
```python
# Train model on EC2 with custom infrastructure
import torch
import torch.nn as nn

# Custom model architecture
model = CustomNeuralNetwork()
optimizer = torch.optim.Adam(model.parameters())

# Manual training loop on EC2 instance
for epoch in range(num_epochs):
    for batch in dataloader:
        optimizer.zero_grad()
        loss = compute_loss(model(batch))
        loss.backward()
        optimizer.step()

# Manual deployment to ECS/EKS
# (You handle: containerization, load balancing, autoscaling, monitoring)
```

**When to use**: Extremely specialized requirements, existing ML infrastructure, or cost optimization at massive scale.

---

## Decision Framework: Choosing the Right Tier

<div class="callout callout--tip">
<p class="callout__title">Decision Framework Principle</p>
<p>Always start with the simplest solution that meets requirements. Test AI Services first, move to SageMaker only when accuracy, customization, or latency requires it, and consider DIY only for extreme edge cases.</p>
</div>

### Step 1: Use Case Mapping

**Start with AI Services if your use case matches these categories**:

| Category | AI Service | Use Cases |
|----------|------------|-----------|
| **Vision** | Rekognition | Object detection, face recognition, content moderation, celebrity recognition, unsafe content filtering |
| **Vision** | Textract | Document OCR, form extraction, table extraction, ID verification |
| **Language** | Comprehend | Sentiment analysis, entity extraction, PII detection, topic modeling, language detection |
| **Language** | Translate | Multi-language translation (75+ languages), real-time or batch |
| **Speech** | Transcribe | Speech-to-text, call analytics, medical transcription, PII redaction |
| **Speech** | Polly | Text-to-speech, voice synthesis, accessibility features |
| **Forecasting** | Forecast | Time-series forecasting (demand, inventory, revenue) |
| **Recommendations** | Personalize | Product recommendations, personalized content, user segmentation |

**If your use case appears above**: Start with AI Services. Only move to SageMaker if AI Services don't meet accuracy, latency, or customization requirements.

**If your use case is NOT above**: Proceed to Step 2.

### Step 2: Evaluate Customization Requirements

Ask these questions to determine if SageMaker is needed:

| Question | AI Services | SageMaker Required |
|----------|-------------|-------------------|
| Do you need custom model architectures? | ❌ Not supported | ✅ Yes |
| Do you have proprietary training data? | ⚠️ Limited (Comprehend custom classification) | ✅ Yes |
| Do you need domain-specific features? | ❌ Generic features only | ✅ Yes |
| Do you need <100ms inference latency? | ⚠️ Depends on service | ✅ Optimize with SageMaker |
| Do you need accuracy >95%? | ⚠️ Depends on use case | ✅ Tune with SageMaker |
| Do you have strict compliance requirements (data residency, model auditing)? | ⚠️ Limited control | ✅ Full control |

**Decision rule**: If you answered "SageMaker Required" for 2+ questions, use SageMaker.

### Step 3: Assess Team Expertise

**Required skills by tier**:

| Skill | AI Services | SageMaker | DIY |
|-------|-------------|-----------|-----|
| **ML Fundamentals** | Not required | Required | Required |
| **Data Science** (feature engineering, model selection) | Not required | Required | Required |
| **ML Frameworks** (PyTorch, TensorFlow) | Not required | Helpful | Required |
| **Distributed Training** | Not required | Helpful | Required |
| **MLOps** (CI/CD, monitoring, retraining) | Not required | Helpful | Required |
| **Infrastructure** (EC2, containers, networking) | Not required | Not required | Required |
| **Cost Optimization** | Minimal | Moderate | High |

**Decision rules**:
- **No ML expertise**: Use AI Services exclusively
- **Data science team, no MLOps**: Use SageMaker
- **Full ML engineering team**: Consider DIY for specialized use cases, otherwise SageMaker

### Step 4: Cost-Benefit Analysis

<div class="callout callout--warning">
<p class="callout__title">TCO vs Service Cost</p>
<p>Don't just compare service costs. Include development time, ongoing operations, retraining, and maintenance in your Total Cost of Ownership calculation. A $100/month AI Service can have lower TCO than a $500/month SageMaker solution when dev and ops costs are factored in.</p>
</div>

**Total Cost of Ownership (TCO) includes**:
- Service/infrastructure costs
- Development time (time-to-market)
- Ongoing maintenance and operations
- Retraining and model updates

**Example cost comparison for sentiment analysis use case**:

| Approach | Service Cost | Dev Cost | Ops Cost | Time-to-Market | Total 12-Month TCO |
|----------|--------------|----------|----------|----------------|-------------------|
| **Comprehend** | $100/month (1M texts) | $5K (2 weeks integration) | $0 (fully managed) | 2 weeks | **$6,200** |
| **SageMaker** | $500/month (training + inference) | $50K (3 months dev) | $10K/month (MLOps) | 3 months | **$176,000** |
| **DIY (EC2)** | $300/month (EC2 + storage) | $75K (4 months dev) | $20K/month (ops team) | 4 months | **$318,600** |

**Decision rule**: Use the simplest tier that meets requirements. Only move to higher tiers when business value justifies the cost increase.

---

## Detailed Service Selection Patterns

### Pattern 1: Start Simple, Upgrade When Needed

**Recommended approach**: Begin with AI Services, migrate to SageMaker only when required.

**Example progression**:

**Phase 1: Validate with AI Services** (Week 1)
```python
# Proof of concept with Comprehend
comprehend = boto3.client('comprehend')

sentiment = comprehend.detect_sentiment(
    Text=customer_review,
    LanguageCode='en'
)

# Validate: Does this meet business requirements?
# Metrics: Accuracy, latency, cost
```

**Phase 2: Evaluate Performance** (Weeks 2-4)
- Test with real data at production scale
- Measure accuracy against business requirements
- Calculate actual costs at expected volume

**Phase 3: Decide Migration** (Week 5)
- **If accuracy >90% and cost <$10K/month**: Stay with Comprehend
- **If accuracy <90% or need custom features**: Migrate to SageMaker

**Phase 4: Custom Model (if needed)** (Months 2-3)
```python
# Migrate to SageMaker with custom model
from sagemaker.huggingface import HuggingFace

estimator = HuggingFace(
    entry_point='train_sentiment.py',
    role=sagemaker_role,
    instance_type='ml.p3.2xlarge',
    transformers_version='4.17',
    pytorch_version='1.10',
    py_version='py38',
    hyperparameters={
        'epochs': 3,
        'train_batch_size': 32,
        'model_name': 'bert-base-uncased'
    }
)

estimator.fit({'train': 's3://my-bucket/sentiment-training-data/'})
```

**Outcome**: You invest in SageMaker only after validating that simpler solutions are insufficient.

### Pattern 2: Hybrid Approach (AI Services + SageMaker)

<div class="callout callout--note">
<p class="callout__title">Hybrid Approach</p>
<p>You don't need to choose one tier exclusively. Use AI Services for 80% of common tasks (transcription, translation, PII detection) and SageMaker for 20% specialized models (domain-specific classification). This maximizes simplicity while enabling customization where it matters.</p>
</div>

Use AI Services for common tasks, SageMaker for specialized models.

**Example architecture**:

```
Customer Support System:
├── Transcribe (speech-to-text) ← AI Service
├── Translate (multi-language) ← AI Service
├── Custom Intent Classifier ← SageMaker (domain-specific)
├── Comprehend (PII detection) ← AI Service
└── Polly (voice responses) ← AI Service
```

**Implementation**:
```python
def process_customer_call(audio_file, customer_language):
    # Step 1: Transcribe (AI Service)
    transcript = transcribe_audio(audio_file)

    # Step 2: Translate to English if needed (AI Service)
    if customer_language != 'en':
        transcript = translate_text(transcript, customer_language, 'en')

    # Step 3: Detect PII (AI Service)
    redacted_transcript = comprehend.detect_pii_entities(transcript)

    # Step 4: Classify intent (Custom SageMaker Model)
    intent = sagemaker_intent_classifier.predict(redacted_transcript)

    # Step 5: Route to appropriate team based on intent
    route_to_team(intent)
```

**Why this works**:
- **80% of tasks** (transcription, translation, PII) handled by AI Services (low cost, zero maintenance)
- **20% specialized task** (intent classification with company-specific intents) uses SageMaker
- Best of both worlds: simplicity + customization

### Pattern 3: SageMaker with Built-in Algorithms

Use SageMaker for custom data, but avoid custom model code with built-in algorithms.

**When to use**: You need custom training data, but standard algorithms (XGBoost, linear learner, k-means) suffice.

**Example - Fraud detection**:
```python
from sagemaker import image_uris
from sagemaker.estimator import Estimator

# Use SageMaker's built-in XGBoost (no custom code needed)
container = image_uris.retrieve('xgboost', region='us-east-1', version='1.5-1')

estimator = Estimator(
    image_uri=container,
    role=sagemaker_role,
    instance_count=1,
    instance_type='ml.m5.xlarge',
    volume_size=50,
    max_run=3600,
    output_path='s3://my-bucket/fraud-model/'
)

# Train with your proprietary fraud transaction data
estimator.set_hyperparameters(
    objective='binary:logistic',
    num_round=100,
    max_depth=5,
    eta=0.2
)

estimator.fit({'train': 's3://my-bucket/fraud-training-data/'})

# Deploy for real-time inference
predictor = estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.t2.medium'
)
```

**Benefits**:
- ✅ Custom data (your fraud patterns, not generic)
- ✅ No custom code (use battle-tested XGBoost)
- ✅ Managed infrastructure
- ✅ Lower dev cost than full custom models

### Pattern 4: SageMaker AutoML (Autopilot)

Let AWS automatically build and tune models for you.

**When to use**: You have labeled data but lack deep ML expertise.

**Example - Customer churn prediction**:
```python
from sagemaker.automl.automl import AutoML

automl = AutoML(
    role=sagemaker_role,
    target_attribute_name='churned',  # Column to predict
    output_path='s3://my-bucket/automl-output/',
    max_candidates=10,  # Try up to 10 different models
    job_objective={'MetricName': 'F1'}  # Optimize for F1 score
)

# Autopilot automatically:
# - Explores data
# - Engineers features
# - Tries multiple algorithms (XGBoost, Linear Learner, Deep Learning)
# - Tunes hyperparameters
# - Selects best model

automl.fit(
    inputs='s3://my-bucket/customer-churn-data.csv',
    wait=False,  # Run asynchronously
    logs=False
)

# Deploy best model
predictor = automl.deploy(
    initial_instance_count=1,
    instance_type='ml.m5.xlarge'
)
```

**Cost**: 2-5x more expensive than training a single model, but eliminates weeks of experimentation.

---

## Real-World Decision Scenarios

### Scenario 1: E-commerce Product Recommendation

**Requirements**:
- Recommend products to users based on browsing/purchase history
- 10M users, 100K products
- Real-time recommendations (<200ms latency)

**Decision process**:

| Option | Evaluation |
|--------|------------|
| **Amazon Personalize** | ✅ Pre-built for recommendations<br>✅ Handles 10M users easily<br>✅ Real-time inference<br>✅ No ML expertise needed<br>💰 Cost: ~$500/month for 10M users |
| **SageMaker (custom)** | ❌ Requires ML team<br>❌ 3-6 months to build<br>💰 Cost: ~$5K/month + dev time<br>⚠️ Only needed if Personalize accuracy insufficient |
| **DIY** | ❌ Massive infrastructure effort<br>❌ 6-12 months to build<br>💰 Cost: $10K+/month + full team<br>❌ Not justified unless extreme scale |

**Recommendation**: **Use Amazon Personalize**. Only consider SageMaker if accuracy testing shows Personalize doesn't meet business KPIs.

### Scenario 2: Medical Image Diagnosis (X-ray Analysis)

**Requirements**:
- Detect pneumonia from chest X-rays
- HIPAA compliance required
- High accuracy needed (>98%)
- Proprietary hospital dataset

**Decision process**:

| Option | Evaluation |
|--------|------------|
| **Rekognition Medical Imaging** | ❌ AWS doesn't offer medical imaging AI service<br>❌ Generic Rekognition not suitable for medical diagnosis |
| **SageMaker** | ✅ Train custom model on proprietary X-ray data<br>✅ HIPAA-eligible<br>✅ Achieve >98% accuracy with custom architecture<br>✅ Full control over model interpretability<br>💰 Cost: $2K/month training + inference |
| **DIY** | ⚠️ Possible, but SageMaker provides same control<br>❌ Higher ops burden<br>❌ Not cost-effective |

**Recommendation**: **Use SageMaker**. Medical diagnosis requires custom models trained on domain-specific data, but DIY offers no advantage over SageMaker's managed infrastructure.

### Scenario 3: Customer Support Call Sentiment Analysis

**Requirements**:
- Analyze sentiment from 10,000 support call transcripts/month
- Identify negative sentiment for manager escalation
- Budget: <$5K/month

**Decision process**:

| Option | Evaluation |
|--------|------------|
| **Comprehend** | ✅ Pre-built sentiment analysis<br>✅ Supports call transcripts<br>✅ Real-time analysis<br>💰 Cost: $100/month (10K calls × 5 min × 1,000 chars × $0.0001/100 chars)<br>⚠️ Test accuracy on your domain |
| **SageMaker** | ⚠️ Custom model achieves 92% vs Comprehend's 88%<br>💰 Cost: $2K/month + $30K dev<br>❌ Not justified unless 4% accuracy gain is critical |
| **DIY** | ❌ Massive overkill<br>❌ $50K+ dev + ongoing ops |

**Recommendation**: **Start with Comprehend**. If accuracy testing shows <85% accuracy, consider SageMaker with fine-tuned BERT model.

### Scenario 4: Real-Time Fraud Detection (Financial Transactions)

**Requirements**:
- Detect fraudulent transactions in real-time (<50ms latency)
- Proprietary fraud patterns (credit card, account takeover)
- 1M transactions/day
- Accuracy critical (false positives cost revenue)

**Decision process**:

| Option | Evaluation |
|--------|------------|
| **AI Services** | ❌ No pre-built fraud detection service on AWS<br>❌ Comprehend/Rekognition not applicable |
| **SageMaker** | ✅ Train custom model on proprietary fraud data<br>✅ Deploy low-latency endpoints (10-50ms)<br>✅ Use built-in XGBoost or custom deep learning<br>💰 Cost: $3K/month (real-time endpoints + retraining) |
| **DIY** | ⚠️ Possible if you have existing fraud ML infrastructure<br>❌ SageMaker provides same performance with lower ops burden |

**Recommendation**: **Use SageMaker**. Fraud detection requires custom models, but SageMaker's managed endpoints meet latency requirements without DIY complexity.

### Scenario 5: Document Processing Pipeline (Invoices, Receipts)

**Requirements**:
- Extract text, tables, and key-value pairs from invoices
- Process 50,000 documents/month
- Integrate with existing workflow automation

**Decision process**:

| Option | Evaluation |
|--------|------------|
| **Textract** | ✅ Pre-built for forms, tables, invoices<br>✅ Queries feature for custom extraction<br>✅ No ML expertise needed<br>💰 Cost: $1,500/month (50K pages × $0.03/page)<br>✅ API integration straightforward |
| **SageMaker** | ❌ Requires custom OCR + NLP pipeline<br>❌ 3+ months to build<br>💰 Cost: $40K dev + $2K/month<br>❌ Not justified unless Textract accuracy insufficient |
| **DIY** | ❌ Massive effort (Tesseract + custom NLP)<br>❌ Lower accuracy than Textract<br>❌ Not cost-effective |

**Recommendation**: **Use Textract**. Only consider SageMaker if you need extremely specialized document types not handled by Textract.

---

## Cost Optimization Strategies by Tier

### AI Services Cost Optimization

**1. Batch processing over real-time**:
```python
# Instead of real-time per-image processing
for image in images:
    rekognition.detect_labels(Image=image)  # 1 API call per image

# Use batch operations
rekognition.start_label_detection(
    Video={'S3Object': {'Bucket': 'my-bucket', 'Name': 'video.mp4'}}
)
# Process entire video in single job
```

**2. Cache results for frequently analyzed content**:
```python
import hashlib

def get_or_analyze_sentiment(text):
    cache_key = hashlib.sha256(text.encode()).hexdigest()

    # Check cache (DynamoDB, Redis, etc.)
    cached = dynamodb.get_item(Key={'text_hash': cache_key})
    if cached:
        return cached['sentiment']

    # Analyze and cache
    sentiment = comprehend.detect_sentiment(Text=text, LanguageCode='en')
    dynamodb.put_item(Item={'text_hash': cache_key, 'sentiment': sentiment})
    return sentiment
```

**3. Pre-filter before expensive operations**:
```python
# Don't send every image to Rekognition for moderation
# Use cheaper heuristics first (file size, metadata, content type)

if image_size < 10KB:
    return {'safe': True}  # Too small to contain inappropriate content

# Only analyze suspicious images
response = rekognition.detect_moderation_labels(Image=image)
```

### SageMaker Cost Optimization

**1. Use Spot Instances for training (70% savings)**:
```python
estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p3.2xlarge',
    instance_count=4,
    use_spot_instances=True,  # 70% savings
    max_wait=7200,  # Wait up to 2 hours for spot capacity
    checkpoint_s3_uri='s3://my-bucket/checkpoints/'  # Save progress
)
```

**2. Right-size inference endpoints**:
```python
# Start with smallest instance that meets latency requirements
predictor = estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.t2.medium'  # $0.065/hour vs ml.p2.xlarge at $1.26/hour
)

# Use autoscaling for variable load
from sagemaker.predictor import Predictor

predictor = Predictor(endpoint_name='my-endpoint')

predictor.update_endpoint(
    initial_instance_count=1,
    instance_type='ml.t2.medium',
    variant_name='AllTraffic',
    endpoint_config_name='my-config'
)

# Configure autoscaling
client = boto3.client('application-autoscaling')
client.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId=f'endpoint/{predictor.endpoint_name}/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=1,
    MaxCapacity=5
)
```

**3. Use Serverless Inference for intermittent traffic**:
```python
from sagemaker.serverless import ServerlessInferenceConfig

serverless_config = ServerlessInferenceConfig(
    memory_size_in_mb=2048,  # 1GB, 2GB, 4GB, or 6GB
    max_concurrency=10  # Max concurrent invocations
)

predictor = estimator.deploy(
    serverless_inference_config=serverless_config
)
# Pay only when invoked ($0.20 per 1M requests + $0.0000133 per second)
```

**4. Use Asynchronous Inference for batch jobs**:
```python
from sagemaker.async_inference import AsyncInferenceConfig

async_config = AsyncInferenceConfig(
    output_path='s3://my-bucket/async-output/',
    max_concurrent_invocations_per_instance=10
)

predictor = estimator.deploy(
    instance_type='ml.m5.xlarge',
    initial_instance_count=1,
    async_inference_config=async_config
)
# Scale to zero when idle, process large batches efficiently
```

**5. Shut down idle resources**:
```python
# Delete endpoints when not in use
sagemaker_client = boto3.client('sagemaker')

# List all endpoints
endpoints = sagemaker_client.list_endpoints()

for endpoint in endpoints['Endpoints']:
    # Check last invocation time (via CloudWatch metrics)
    metrics = cloudwatch.get_metric_statistics(
        Namespace='AWS/SageMaker',
        MetricName='ModelLatency',
        Dimensions=[{'Name': 'EndpointName', 'Value': endpoint['EndpointName']}],
        StartTime=datetime.now() - timedelta(days=7),
        EndTime=datetime.now(),
        Period=86400,
        Statistics=['SampleCount']
    )

    # Delete if no invocations in 7 days
    if not metrics['Datapoints']:
        sagemaker_client.delete_endpoint(EndpointName=endpoint['EndpointName'])
        print(f"Deleted idle endpoint: {endpoint['EndpointName']}")
```

### DIY Cost Optimization

**1. Use EC2 Spot for training**:
- 70-90% savings over on-demand
- Requires checkpointing and fault tolerance

**2. Use Lambda for low-volume inference**:
```python
import json
import boto3
import torch

# Load model in Lambda (store in /tmp or EFS)
def lambda_handler(event, context):
    model = torch.load('/tmp/model.pth')
    input_data = json.loads(event['body'])

    prediction = model(input_data)

    return {
        'statusCode': 200,
        'body': json.dumps({'prediction': prediction.tolist()})
    }

# Cost: $0.20 per 1M requests (vs $50+/month for always-on endpoint)
```

**3. Use ECS/Fargate with autoscaling**:
- Scale to zero during off-hours
- Right-size container resources (CPU/memory)

---

## When to Move Between Tiers

### Moving from AI Services → SageMaker

**Triggers**:
1. **Accuracy insufficient**: AI Service achieves <85% accuracy on your data
2. **Latency too high**: Need <100ms p99 latency (AI Services typically 200-500ms)
3. **Customization needed**: Require domain-specific features or model architecture
4. **Cost at scale**: AI Service pricing exceeds SageMaker at your volume (usually >10M requests/month)
5. **Compliance**: Need model interpretability, audit trails, or data residency control

**Migration example** (Comprehend → SageMaker):

```python
# Phase 1: AI Service baseline
comprehend = boto3.client('comprehend')
sentiment = comprehend.detect_sentiment(Text=text, LanguageCode='en')

# Accuracy test: 87% (need 92%)

# Phase 2: Migrate to SageMaker with fine-tuned BERT
from sagemaker.huggingface import HuggingFace

estimator = HuggingFace(
    entry_point='train_sentiment.py',
    role=sagemaker_role,
    instance_type='ml.p3.2xlarge',
    transformers_version='4.17',
    pytorch_version='1.10',
    hyperparameters={
        'epochs': 5,
        'model_name': 'bert-base-uncased',
        'learning_rate': 2e-5
    }
)

# Train on your labeled data
estimator.fit({'train': 's3://my-bucket/sentiment-training/'})

# Deploy
predictor = estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.t2.medium'
)

# Accuracy test: 93% ✅
```

### Moving from SageMaker → DIY

**Triggers** (rare):
1. **Extreme scale**: Processing >1B predictions/day where SageMaker costs exceed DIY + ops
2. **Specialized hardware**: Need custom GPUs, TPUs, or edge devices not supported by SageMaker
3. **Ultra-low latency**: Need <10ms latency with custom optimizations
4. **Existing ML platform**: Already invested in Kubeflow, MLflow, or custom infrastructure

**Warning**: DIY rarely makes financial sense unless you have:
- Dedicated ML infrastructure team (5+ engineers)
- Volume exceeding $50K/month in SageMaker costs
- Highly specialized requirements SageMaker cannot meet

### Staying in AI Services (When NOT to Move)

**Keep using AI Services when**:
- Accuracy is "good enough" (>85% for most business cases)
- Cost is <$10K/month
- Latency is acceptable (200-500ms for most applications)
- You lack ML expertise
- Time-to-market is critical (weeks, not months)

**Example**: Many companies stay on Comprehend sentiment analysis even at 87% accuracy because:
- 92% accuracy from custom models costs $100K+ to achieve
- Business impact of 5% accuracy gain is <$20K/year
- ROI is negative

---

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Avoid Premature Optimization</p>
<p>The most common pitfall is building custom SageMaker models before testing AI Services. Always validate that simpler solutions are insufficient before investing months in custom model development.</p>
</div>

### Pitfall 1: Premature Optimization (Building Custom Models Too Early)

**Problem**: Teams build custom SageMaker models before testing AI Services.

**Example**:
```python
# ❌ BAD: Jump straight to SageMaker
estimator = HuggingFace(entry_point='train.py', ...)  # 3 months of work

# ✅ GOOD: Test AI Service first
comprehend = boto3.client('comprehend')
sentiment = comprehend.detect_sentiment(Text=text, LanguageCode='en')

# Test accuracy with labeled data
# Only build custom model if AI Service accuracy insufficient
```

**Solution**: Always prototype with AI Services first. Migrate to SageMaker only after validating that simpler solutions fail.

### Pitfall 2: Over-Engineering (DIY When SageMaker Suffices)

**Problem**: Teams build custom ML infrastructure when SageMaker provides same capabilities.

**Example**:
```python
# ❌ BAD: Custom infrastructure
# - Set up Kubernetes cluster
# - Deploy MLflow
# - Build training pipelines
# - Manage model registry
# - Implement autoscaling
# - Monitor infrastructure
# (6+ months, 5 engineers)

# ✅ GOOD: Use SageMaker
estimator.fit(...)
predictor = estimator.deploy(...)
# (2 weeks, 1 data scientist)
```

**Solution**: Only build DIY infrastructure if you have requirements SageMaker cannot meet (which is rare).

### Pitfall 3: Not Testing AI Service Accuracy

**Problem**: Assuming AI Services won't work without testing on your data.

**Solution**:
```python
# Test AI Service accuracy systematically
import pandas as pd
from sklearn.metrics import accuracy_score

# Load labeled test data
test_data = pd.read_csv('labeled_reviews.csv')

# Get predictions from AI Service
predictions = []
for text in test_data['review_text']:
    response = comprehend.detect_sentiment(Text=text, LanguageCode='en')
    predictions.append(response['Sentiment'])

# Calculate accuracy
accuracy = accuracy_score(test_data['true_sentiment'], predictions)
print(f"Comprehend accuracy: {accuracy:.2%}")

# Decision: Use Comprehend if accuracy >85%, else SageMaker
```

### Pitfall 4: Ignoring Total Cost of Ownership

**Problem**: Comparing only service costs, ignoring dev and ops costs.

**Correct TCO calculation**:

```python
# AI Service TCO
ai_service_tco = (
    service_cost_per_month * 12 +  # $100 × 12 = $1,200
    integration_dev_cost +           # $5,000 (2 weeks)
    ops_cost_per_month * 12          # $0 × 12 = $0 (fully managed)
)
# Total: $6,200 for 12 months

# SageMaker TCO
sagemaker_tco = (
    sagemaker_cost_per_month * 12 +  # $2,000 × 12 = $24,000
    model_dev_cost +                  # $50,000 (3 months)
    ops_cost_per_month * 12           # $5,000 × 12 = $60,000 (retraining, monitoring)
)
# Total: $134,000 for 12 months

# Decision: Use AI Service unless business value gain exceeds $127,800/year
```

### Pitfall 5: Not Leveraging Hybrid Approaches

**Problem**: Thinking you must use one tier exclusively.

**Solution**: Mix AI Services and SageMaker based on task requirements.

```python
# ✅ GOOD: Hybrid approach
def process_support_ticket(ticket_text):
    # AI Service: PII detection
    pii_entities = comprehend.detect_pii_entities(Text=ticket_text, LanguageCode='en')
    redacted_text = redact_pii(ticket_text, pii_entities)

    # SageMaker: Custom intent classification (company-specific)
    intent = sagemaker_intent_predictor.predict(redacted_text)

    # AI Service: Sentiment analysis
    sentiment = comprehend.detect_sentiment(Text=redacted_text, LanguageCode='en')

    return {
        'intent': intent,
        'sentiment': sentiment['Sentiment'],
        'urgency': determine_urgency(intent, sentiment)
    }
```

---

## Quick Reference Decision Tree

```
START: Do you need machine learning?
  │
  ├─ Yes → Does your use case match an AI Service?
  │         (vision, language, speech, forecasting, recommendations)
  │         │
  │         ├─ Yes → Test AI Service accuracy on your data
  │         │         │
  │         │         ├─ Accuracy >85% → ✅ USE AI SERVICE
  │         │         │
  │         │         └─ Accuracy <85% → Need custom model
  │         │                            │
  │         │                            ├─ Have ML team? → ✅ USE SAGEMAKER
  │         │                            │
  │         │                            └─ No ML team → ⚠️ HIRE or USE SAGEMAKER AUTOPILOT
  │         │
  │         └─ No → Need custom model
  │                  │
  │                  ├─ Standard algorithm works?
  │                  │  (classification, regression, clustering)
  │                  │  │
  │                  │  ├─ Yes → ✅ USE SAGEMAKER BUILT-IN ALGORITHMS
  │                  │  │
  │                  │  └─ No → ✅ USE SAGEMAKER CUSTOM MODEL
  │                  │
  │                  └─ Extreme requirements?
  │                     (custom hardware, >1B predictions/day, <10ms latency)
  │                     │
  │                     ├─ Yes + have ML infra team → ⚠️ CONSIDER DIY
  │                     │
  │                     └─ No → ✅ USE SAGEMAKER
  │
  └─ No → Don't use ML (use rules/heuristics)
```

---

## Key Takeaways

**Decision Framework**:
1. **Always start with AI Services** for common use cases (vision, language, speech)
2. **Move to SageMaker** when you need custom models, domain-specific features, or accuracy >95%
3. **Consider DIY only** when SageMaker cannot meet specialized requirements (extremely rare)
4. **Use hybrid approaches** combining AI Services (80% of tasks) with SageMaker (20% specialized)

**Cost Optimization**:
5. **Calculate Total Cost of Ownership** (TCO), not just service costs (include dev and ops)
6. AI Services typically cost **$100-5K/month** with near-zero ops burden
7. SageMaker typically costs **$1K-10K/month** plus dev ($30K-100K) and ops ($5K-20K/month)
8. DIY rarely justified unless **ML infrastructure team exists** and scale exceeds $50K/month

**Testing & Validation**:
9. **Test AI Service accuracy** on your data before building custom models
10. Accuracy threshold: Use AI Services if >85%, consider SageMaker if <85%
11. **Validate business ROI** before migrating to higher tiers (does 5% accuracy gain justify $100K cost?)

**Team & Expertise**:
12. **No ML expertise**: Use AI Services exclusively
13. **Data science team**: Use SageMaker for custom use cases
14. **Full ML engineering team**: Use SageMaker (DIY offers minimal advantage)

**Service Selection**:
15. **Use AI Services** for: sentiment analysis, image classification, translation, transcription, OCR, forecasting, recommendations
16. **Use SageMaker** for: fraud detection, medical diagnosis, custom NLP, domain-specific vision, proprietary recommendation engines
17. **Use DIY** for: extremely specialized requirements SageMaker cannot meet (edge cases only)

**Migration Strategy**:
18. **Progressive migration**: Start with AI Services → validate → migrate to SageMaker only if needed
19. **Avoid premature optimization**: Don't build custom models before testing simpler solutions
20. **Monitor and iterate**: Continuously evaluate whether your tier choice still makes sense as requirements evolve

The simplest solution that meets requirements is always the best choice. Move to higher tiers only when business value clearly justifies the increased complexity and cost.
