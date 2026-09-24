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

## Prebuilt AI Services

### Vision and Documents: Rekognition and Textract

#### AWS Rekognition

**What it is**: Managed computer vision service that analyzes images and videos to detect objects, faces, text, activities, and inappropriate content.

##### Core Capabilities

**1. Object and Scene Detection**

Identify objects, scenes, activities, and concepts in images.

**Example use cases**:
- E-commerce: Detect product types in user uploads ("this is a shoe, size 10, Nike brand")
- Content moderation: Flag images containing weapons, alcohol, or drugs
- Asset management: Automatically tag photos by content (beach, sunset, people, cars)

**API call**:
```python
import boto3

rekognition = boto3.client('rekognition')

response = rekognition.detect_labels(
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'product.jpg'}},
    MaxLabels=10,
    MinConfidence=90
)

for label in response['Labels']:
    print(f"{label['Name']}: {label['Confidence']:.2f}%")
    # Output: Shoe: 98.5%, Sneaker: 97.2%, Footwear: 99.1%, Nike: 95.3%
```

**Confidence scores**: Rekognition returns confidence percentage for each label. Use thresholds to filter low-confidence results (recommended: 90%+ for production use).

**2. Face Detection and Analysis**

Detect faces and analyze attributes (age range, gender, emotions, facial features).

**Example use cases**:
- Photo apps: Suggest photo tags based on detected faces
- Security: Count people entering building via camera feed
- Marketing: Analyze customer demographics at retail locations

**API call**:
```python
response = rekognition.detect_faces(
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'crowd.jpg'}},
    Attributes=['ALL']  # Include age, gender, emotions, quality
)

for face in response['FaceDetails']:
    print(f"Age: {face['AgeRange']['Low']}-{face['AgeRange']['High']}")
    print(f"Gender: {face['Gender']['Value']} ({face['Gender']['Confidence']:.1f}%)")
    print(f"Emotions: {face['Emotions'][0]['Type']} ({face['Emotions'][0]['Confidence']:.1f}%)")
    # Output: Age: 25-35, Gender: Male (98.2%), Emotions: HAPPY (95.7%)
```

**3. Face Comparison and Search**

Compare faces to verify identity or search for specific person across image collection.

**Example use cases**:
- Identity verification: Compare selfie to government ID photo
- Security: Search for person of interest across surveillance footage
- Social media: Find all photos containing specific person

**Face comparison**:
```python
response = rekognition.compare_faces(
    SourceImage={'S3Object': {'Bucket': 'my-bucket', 'Name': 'selfie.jpg'}},
    TargetImage={'S3Object': {'Bucket': 'my-bucket', 'Name': 'id-photo.jpg'}},
    SimilarityThreshold=90
)

if response['FaceMatches']:
    similarity = response['FaceMatches'][0]['Similarity']
    print(f"Faces match with {similarity:.2f}% confidence")
else:
    print("Faces do not match")
```

**Face collection** (index faces for search):
```python
# Create face collection
rekognition.create_collection(CollectionId='employees')

# Index face
rekognition.index_faces(
    CollectionId='employees',
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'employee-123.jpg'}},
    ExternalImageId='employee-123',
    MaxFaces=1
)

# Search for face in collection
response = rekognition.search_faces_by_image(
    CollectionId='employees',
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'camera-feed.jpg'}},
    MaxFaces=1,
    FaceMatchThreshold=90
)

if response['FaceMatches']:
    match = response['FaceMatches'][0]
    print(f"Match found: {match['Face']['ExternalImageId']} ({match['Similarity']:.2f}%)")
```

**4. Text Detection (OCR)**

Extract text from images (street signs, product labels, license plates).

**Example use cases**:
- Inventory management: Read product serial numbers from photos
- License plate recognition: Extract plate numbers from parking lot cameras
- Document digitization: Extract text from scanned forms

**API call**:
```python
response = rekognition.detect_text(
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'sign.jpg'}}
)

for text in response['TextDetections']:
    if text['Type'] == 'LINE':  # Get full lines, not individual words
        print(f"{text['DetectedText']} ({text['Confidence']:.2f}%)")
        # Output: STOP (99.8%), ONE WAY (98.5%)
```

**5. Content Moderation**

Detect inappropriate content (explicit, suggestive, violent, visually disturbing).

**Example use cases**:
- Social media: Auto-flag user uploads for review
- Marketplace: Block listings with inappropriate product images
- Dating apps: Filter profile photos containing nudity

**API call**:
```python
response = rekognition.detect_moderation_labels(
    Image={'S3Object': {'Bucket': 'my-bucket', 'Name': 'user-upload.jpg'}},
    MinConfidence=75
)

if response['ModerationLabels']:
    print("Image flagged for moderation:")
    for label in response['ModerationLabels']:
        print(f"- {label['Name']} ({label['Confidence']:.2f}%)")
        # Output: Explicit Nudity (92.5%), Graphic Violence (88.3%)
else:
    print("Image passed moderation")
```

**Moderation categories**: Explicit Nudity, Suggestive, Violence, Visually Disturbing, Rude Gestures, Drugs, Tobacco, Alcohol, Gambling, Hate Symbols.

**6. Video Analysis**

Analyze videos to detect objects, faces, text, activities, and moderation labels over time.

**Example use cases**:
- Security: Detect people entering restricted areas
- Sports analytics: Track ball movement and player positions
- Content moderation: Flag inappropriate segments in uploaded videos

**Start video analysis job**:
```python
response = rekognition.start_label_detection(
    Video={'S3Object': {'Bucket': 'my-bucket', 'Name': 'security-footage.mp4'}},
    MinConfidence=90
)

job_id = response['JobId']
```

**Poll for results**:
```python
import time

while True:
    response = rekognition.get_label_detection(JobId=job_id)
    status = response['JobStatus']

    if status == 'SUCCEEDED':
        for label in response['Labels']:
            timestamp = label['Timestamp']  # Milliseconds from video start
            print(f"At {timestamp}ms: {label['Label']['Name']} ({label['Label']['Confidence']:.2f}%)")
        break
    elif status == 'FAILED':
        print(f"Job failed: {response['StatusMessage']}")
        break

    time.sleep(5)  # Check every 5 seconds
```

**Video analysis is asynchronous**: Jobs can take minutes to hours depending on video length. Use SNS notifications instead of polling for production use.

#### AWS Textract

**What it is**: Managed OCR service that extracts text, forms, and tables from documents with understanding of layout and relationships.

##### Core Capabilities

**1. Text Detection**

Extract raw text from documents (similar to Rekognition OCR but optimized for documents).

**Example use cases**:
- Invoice processing: Extract invoice number, date, amount
- Contract analysis: Extract key terms and clauses
- Form digitization: Convert paper forms to digital text

**API call**:
```python
import boto3

textract = boto3.client('textract')

response = textract.detect_document_text(
    Document={'S3Object': {'Bucket': 'my-bucket', 'Name': 'invoice.pdf'}}
)

for block in response['Blocks']:
    if block['BlockType'] == 'LINE':
        print(block['Text'])
        # Output: Invoice #12345, Date: 2024-11-15, Amount: $1,234.56
```

**2. Forms Extraction (Key-Value Pairs)**

Extract form fields and their values (e.g., "Name: John Doe", "Date: 2024-11-15").

**Example use cases**:
- Government forms: Extract data from tax forms, applications, permits
- Medical records: Extract patient information from intake forms
- Loan applications: Extract applicant details from mortgage forms

**API call**:
```python
response = textract.analyze_document(
    Document={'S3Object': {'Bucket': 'my-bucket', 'Name': 'form.pdf'}},
    FeatureTypes=['FORMS']
)

# Extract key-value pairs
key_map = {}
value_map = {}
block_map = {}

for block in response['Blocks']:
    block_map[block['Id']] = block
    if block['BlockType'] == 'KEY_VALUE_SET':
        if 'KEY' in block['EntityTypes']:
            key_map[block['Id']] = block
        else:
            value_map[block['Id']] = block

# Get key-value relationships
for key_id, key_block in key_map.items():
    value_block = find_value(key_block, value_map, block_map)
    key_text = get_text(key_block, block_map)
    value_text = get_text(value_block, block_map) if value_block else ""
    print(f"{key_text}: {value_text}")
    # Output: Name: John Doe, SSN: ***-**-1234, Date of Birth: 01/15/1990
```

*Note: Helper functions `find_value()` and `get_text()` traverse Textract's relationship graph to extract text.*

**3. Tables Extraction**

Extract tables with rows, columns, and cell values preserved.

**Example use cases**:
- Financial statements: Extract line items from balance sheets
- Purchase orders: Extract product SKUs, quantities, prices
- Lab results: Extract test names and values from medical reports

**API call**:
```python
response = textract.analyze_document(
    Document={'S3Object': {'Bucket': 'my-bucket', 'Name': 'statement.pdf'}},
    FeatureTypes=['TABLES']
)

tables = []
for block in response['Blocks']:
    if block['BlockType'] == 'TABLE':
        table = extract_table(block, response['Blocks'])
        tables.append(table)

# Example extracted table:
# [
#   ['SKU', 'Product', 'Quantity', 'Price'],
#   ['ABC123', 'Widget', '10', '$25.00'],
#   ['DEF456', 'Gadget', '5', '$50.00']
# ]
```

**4. Queries (Textract Queries)**

Ask natural language questions about document content.

**Example use cases**:
- Invoices: "What is the total amount due?"
- Contracts: "What is the contract end date?"
- Receipts: "What is the vendor name?"

**API call**:
```python
response = textract.analyze_document(
    Document={'S3Object': {'Bucket': 'my-bucket', 'Name': 'invoice.pdf'}},
    FeatureTypes=['QUERIES'],
    QueriesConfig={
        'Queries': [
            {'Text': 'What is the invoice number?'},
            {'Text': 'What is the total amount?'},
            {'Text': 'What is the due date?'}
        ]
    }
)

for block in response['Blocks']:
    if block['BlockType'] == 'QUERY_RESULT':
        query_text = block['Query']['Text']
        answer_text = block['Text']
        confidence = block['Confidence']
        print(f"Q: {query_text}")
        print(f"A: {answer_text} ({confidence:.2f}%)")
        # Q: What is the invoice number?
        # A: INV-2024-11-15-001 (98.5%)
```

**5. Identity Documents (AnalyzeID)**

Extract data from government IDs (driver's licenses, passports).

**Example use cases**:
- KYC verification: Extract customer identity information
- Age verification: Confirm date of birth from ID
- Address verification: Extract residential address

**API call**:
```python
response = textract.analyze_id(
    DocumentPages=[{
        'S3Object': {'Bucket': 'my-bucket', 'Name': 'drivers-license.jpg'}
    }]
)

for doc in response['IdentityDocuments']:
    for field in doc['IdentityDocumentFields']:
        print(f"{field['Type']['Text']}: {field['ValueDetection']['Text']}")
        # Output: FIRST_NAME: John, LAST_NAME: Doe, DATE_OF_BIRTH: 01/15/1990,
        # DOCUMENT_NUMBER: D1234567, EXPIRATION_DATE: 01/15/2028
```

#### Pricing and Cost Optimization

##### Rekognition Pricing

**Image analysis**: $1.00 per 1,000 images (first 1 million/month), then $0.80 per 1,000

**Example costs**:
- 100,000 images/month: 100 × $1.00 = $100/month
- 5 million images/month: 1,000 × $1.00 + 4,000 × $0.80 = $1,000 + $3,200 = $4,200/month

**Video analysis**: $0.10 per minute of video processed

**Example**: 1,000 hours video/month = 60,000 minutes × $0.10 = $6,000/month

**Face collections**: $0.001 per face stored per month

**Example**: Store 1 million faces = 1,000,000 × $0.001 = $1,000/month

##### Textract Pricing

**Text detection**: $1.50 per 1,000 pages (first 1 million/month)

**Forms/tables extraction**: $50.00 per 1,000 pages (first 1 million/month)

**Queries**: $1.00 per 1,000 document pages + $1.00 per 1,000 query pages

**Example costs**:
- 10,000 pages text detection only: 10 × $1.50 = $15/month
- 10,000 pages forms extraction: 10 × $50.00 = $500/month
- 10,000 pages with 3 queries each: 10 × $50 + 30 × $1.00 = $500 + $30 = $530/month

##### Cost Optimization Strategies

**1. Batch processing instead of real-time**

Process documents/images in batches overnight instead of on-demand to reduce API call volume.

**2. Cache results**

Store extraction results in DynamoDB/S3 to avoid reprocessing same documents.

**3. Use appropriate feature detection**

Don't request FORMS and TABLES extraction if you only need text. Text detection costs $1.50 per 1,000 pages vs $50 for forms/tables.

**4. Implement confidence thresholds**

Filter low-confidence results client-side to avoid manual review costs.

**5. Pre-filter images**

Use image metadata (size, format, EXIF) to skip processing of irrelevant images.

#### Integration Patterns

##### Pattern 1: Serverless Document Processing Pipeline

**Use case**: Process uploaded documents asynchronously.

**Architecture**:
```
S3 Upload → S3 Event → Lambda (Textract) → DynamoDB (Results) → SNS (Notification)
```

**Lambda function**:
```python
import boto3
import json

s3 = boto3.client('s3')
textract = boto3.client('textract')
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

def lambda_handler(event, context):
    # Get S3 object from event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    # Process with Textract
    response = textract.analyze_document(
        Document={'S3Object': {'Bucket': bucket, 'Name': key}},
        FeatureTypes=['FORMS', 'TABLES']
    )

    # Extract data (simplified)
    extracted_data = parse_textract_response(response)

    # Store in DynamoDB
    table = dynamodb.Table('document-results')
    table.put_item(Item={
        'document_id': key,
        'extracted_data': extracted_data,
        'timestamp': int(time.time())
    })

    # Notify completion
    sns.publish(
        TopicArn='arn:aws:sns:us-east-1:123456789012:document-processed',
        Message=json.dumps({'document_id': key, 'status': 'complete'})
    )

    return {'statusCode': 200}
```

##### Pattern 2: Real-Time Image Moderation

**Use case**: Block inappropriate user uploads immediately.

**Architecture**:
```
Upload → API Gateway → Lambda (Rekognition) → S3 (if approved) / Reject
```

**Lambda function**:
```python
import boto3
import base64

rekognition = boto3.client('rekognition')
s3 = boto3.client('s3')

def lambda_handler(event, context):
    # Get image from API Gateway request
    image_data = base64.b64decode(event['body'])

    # Check content moderation
    response = rekognition.detect_moderation_labels(
        Image={'Bytes': image_data},
        MinConfidence=75
    )

    # Block if inappropriate content detected
    if response['ModerationLabels']:
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Image contains inappropriate content',
                'labels': [label['Name'] for label in response['ModerationLabels']]
            })
        }

    # Upload to S3 if approved
    image_id = str(uuid.uuid4())
    s3.put_object(
        Bucket='user-uploads',
        Key=f'images/{image_id}.jpg',
        Body=image_data
    )

    return {
        'statusCode': 200,
        'body': json.dumps({'image_id': image_id})
    }
```

##### Pattern 3: Identity Verification Workflow

**Use case**: Verify customer identity with government ID.

**Workflow**:
1. User uploads ID photo
2. Textract AnalyzeID extracts name, DOB, address
3. Compare extracted data to user-provided registration data
4. Flag mismatches for manual review

**Implementation**:
```python
def verify_identity(id_image_s3_key, user_data):
    textract = boto3.client('textract')

    # Extract ID data
    response = textract.analyze_id(
        DocumentPages=[{
            'S3Object': {'Bucket': 'id-uploads', 'Name': id_image_s3_key}
        }]
    )

    # Parse extracted data
    extracted = {}
    for doc in response['IdentityDocuments']:
        for field in doc['IdentityDocumentFields']:
            field_type = field['Type']['Text']
            field_value = field['ValueDetection']['Text']
            extracted[field_type] = field_value

    # Compare with user-provided data
    matches = {
        'name': extracted.get('FIRST_NAME') == user_data['first_name'],
        'dob': extracted.get('DATE_OF_BIRTH') == user_data['dob'],
        'address': extracted.get('ADDRESS') == user_data['address']
    }

    # Return verification result
    if all(matches.values()):
        return {'status': 'verified', 'confidence': 'high'}
    elif any(matches.values()):
        return {'status': 'partial', 'mismatches': [k for k, v in matches.items() if not v]}
    else:
        return {'status': 'failed', 'reason': 'no_matches'}
```

#### When to Use Rekognition & Textract

**Use Rekognition when**:
- ✅ Need pre-built computer vision (object detection, face recognition, moderation)
- ✅ Want to avoid custom ML model development (months of work, ML expertise required)
- ✅ Processing images/videos at scale (thousands to millions per day)
- ✅ Integration simplicity prioritized (REST API vs managing inference infrastructure)

**Use Textract when**:
- ✅ Extracting text from documents (PDFs, scans, photos of documents)
- ✅ Need structured extraction (forms, tables, key-value pairs)
- ✅ Processing government IDs, invoices, receipts, contracts
- ✅ Want higher accuracy than open-source OCR (Tesseract) without training

**Consider alternatives when**:
- ❌ **Need custom models for domain-specific objects** → SageMaker for training custom models
- ❌ **Extremely high volume, cost-sensitive** → Self-hosted open-source (Tesseract OCR, OpenCV) if you can manage infrastructure
- ❌ **Real-time video processing at edge** → AWS Panorama or edge ML (Greengrass + local models)
- ❌ **Simple text extraction from clean PDFs** → Open-source PDF libraries (PyPDF2, pdfplumber) much cheaper

#### Common Pitfalls

##### Processing High-Volume Images Without Caching

**Symptom**: Processing same product images repeatedly (e.g., thumbnail generation triggers Rekognition on every page load).

**Cost impact**: 1 million image loads/month × $1/1,000 = $1,000/month wasted.

**Solution**: Cache Rekognition results in DynamoDB or S3. Check cache before calling API.

##### Not Filtering by Confidence Score

**Symptom**: Low-confidence labels cause incorrect application logic (detecting "dog" at 45% confidence when image is actually a cat).

**Solution**: Set minimum confidence threshold (90%+ for production use).

```python
labels = [l for l in response['Labels'] if l['Confidence'] >= 90]
```

##### Using Textract Forms Extraction for Simple Text

**Symptom**: Paying $50/1,000 pages for forms extraction when only need plain text ($1.50/1,000 pages).

**Solution**: Use `detect_document_text()` instead of `analyze_document()` with FORMS feature if you don't need key-value extraction.

##### Synchronous Processing of Large Videos

**Symptom**: Lambda timeout (15 minutes) when processing hour-long videos synchronously.

**Solution**: Use asynchronous video analysis APIs with SNS notifications. Don't poll in Lambda.

### Language: Comprehend and Translate

#### AWS Comprehend

**What it is**: Managed NLP service that extracts insights from text (sentiment, entities, key phrases, language, topics, and personally identifiable information).

##### Core Capabilities

**1. Sentiment Analysis**

Determine overall sentiment (positive, negative, neutral, mixed) and confidence scores.

**Example use cases**:
- Customer support: Prioritize negative-sentiment tickets
- Social media monitoring: Track brand sentiment over time
- Product reviews: Identify features customers love or hate

**API call**:
```python
import boto3

comprehend = boto3.client('comprehend')

text = "I absolutely love this product! The customer service was exceptional."

response = comprehend.detect_sentiment(
    Text=text,
    LanguageCode='en'
)

print(f"Sentiment: {response['Sentiment']}")
print(f"Confidence: {response['SentimentScore']}")
# Output:
# Sentiment: POSITIVE
# Confidence: {'Positive': 0.98, 'Negative': 0.01, 'Neutral': 0.01, 'Mixed': 0.00}
```

**Sentiment categories**:
- **POSITIVE**: Clearly positive ("love", "excellent", "amazing")
- **NEGATIVE**: Clearly negative ("terrible", "disappointed", "worst")
- **NEUTRAL**: Factual, no emotion ("shipped on Tuesday", "product is blue")
- **MIXED**: Contains both positive and negative ("great product but shipping was slow")

**2. Entity Recognition**

Extract named entities (people, organizations, locations, dates, quantities, etc.).

**Example use cases**:
- Contract analysis: Extract party names, dates, monetary amounts
- News articles: Tag articles by mentioned companies, people, locations
- Medical records: Extract medications, dosages, conditions

**API call**:
```python
text = "Amazon Web Services was founded by Jeff Bezos in Seattle in 2006."

response = comprehend.detect_entities(
    Text=text,
    LanguageCode='en'
)

for entity in response['Entities']:
    print(f"{entity['Text']}: {entity['Type']} ({entity['Score']:.2f})")
# Output:
# Amazon Web Services: ORGANIZATION (0.99)
# Jeff Bezos: PERSON (0.99)
# Seattle: LOCATION (0.98)
# 2006: DATE (0.99)
```

**Entity types**: PERSON, LOCATION, ORGANIZATION, COMMERCIAL_ITEM, EVENT, DATE, QUANTITY, TITLE, OTHER.

**3. Key Phrase Extraction**

Identify main topics and important phrases in text.

**Example use cases**:
- Document summarization: Extract key points from long articles
- Search indexing: Tag documents by key phrases for better discovery
- Meeting notes: Extract action items and decisions

**API call**:
```python
text = "The quarterly earnings report shows revenue growth of 15% year-over-year, " \
       "driven primarily by cloud services expansion in Asia-Pacific markets."

response = comprehend.detect_key_phrases(
    Text=text,
    LanguageCode='en'
)

for phrase in response['KeyPhrases']:
    print(f"{phrase['Text']} ({phrase['Score']:.2f})")
# Output:
# quarterly earnings report (0.99)
# revenue growth (0.98)
# 15% year-over-year (0.97)
# cloud services expansion (0.99)
# Asia-Pacific markets (0.98)
```

**4. Language Detection**

Identify language of text (supports 100+ languages).

**Example use cases**:
- Content routing: Send documents to appropriate language-specific processors
- Translation triggering: Auto-translate non-English content
- Compliance: Flag documents in unexpected languages

**API call**:
```python
text = "Bonjour, comment allez-vous aujourd'hui?"

response = comprehend.detect_dominant_language(Text=text)

for lang in response['Languages']:
    print(f"{lang['LanguageCode']}: {lang['Score']:.2f}")
# Output:
# fr: 0.99
```

Returns ISO 639-1 language codes (en, es, fr, de, etc.).

**5. PII Detection and Redaction**

Detect and optionally redact personally identifiable information (names, addresses, credit cards, SSNs).

**Example use cases**:
- Data anonymization: Remove PII before sending to analytics
- Compliance: Ensure logs don't contain sensitive data
- Content moderation: Flag user-submitted content with PII

**API call**:
```python
text = "My name is John Doe, SSN 123-45-6789, email john.doe@example.com"

response = comprehend.detect_pii_entities(
    Text=text,
    LanguageCode='en'
)

for entity in response['Entities']:
    print(f"{entity['Type']}: {text[entity['BeginOffset']:entity['EndOffset']]}")
# Output:
# NAME: John Doe
# SSN: 123-45-6789
# EMAIL: john.doe@example.com
```

**Redact PII**:
```python
response = comprehend.contains_pii_entities(
    Text=text,
    LanguageCode='en'
)

if response['Labels']:
    # PII detected, redact it
    redacted_text = text
    for entity in sorted(response['Entities'], key=lambda x: x['BeginOffset'], reverse=True):
        start = entity['BeginOffset']
        end = entity['EndOffset']
        redacted_text = redacted_text[:start] + '[REDACTED]' + redacted_text[end:]
```

**PII types**: NAME, ADDRESS, EMAIL, SSN, CREDIT_CARD, PHONE, DATE_TIME, PASSPORT_NUMBER, BANK_ACCOUNT, DRIVER_ID, USERNAME, PASSWORD.

**6. Topic Modeling**

Discover topics across large document collections (batch operation).

**Example use cases**:
- Customer feedback analysis: Group 10,000 survey responses by topic
- Content categorization: Automatically tag articles by subject
- Trend analysis: Identify emerging topics in social media posts

**Start topic modeling job**:
```python
response = comprehend.start_topics_detection_job(
    InputDataConfig={
        'S3Uri': 's3://my-bucket/documents/',
        'InputFormat': 'ONE_DOC_PER_LINE'  # or 'ONE_DOC_PER_FILE'
    },
    OutputDataConfig={
        'S3Uri': 's3://my-bucket/output/'
    },
    DataAccessRoleArn='arn:aws:iam::123456789012:role/ComprehendRole',
    NumberOfTopics=10  # Number of topics to discover
)

job_id = response['JobId']
```

**Poll for results**:
```python
response = comprehend.describe_topics_detection_job(JobId=job_id)
status = response['TopicsDetectionJobProperties']['JobStatus']

if status == 'COMPLETED':
    # Download results from S3 output location
    # Results include: topic keywords, document-topic associations, topic prevalence
    pass
```

**7. Custom Classification**

Train custom classifiers for domain-specific categorization.

**Example use cases**:
- Ticket routing: Classify support tickets by department (billing, technical, sales)
- Content moderation: Classify user posts by content policy violation type
- Document organization: Classify contracts by type (NDA, MSA, SOW)

**Train custom classifier**:
```python
response = comprehend.create_document_classifier(
    DocumentClassifierName='support-ticket-classifier',
    DataAccessRoleArn='arn:aws:iam::123456789012:role/ComprehendRole',
    InputDataConfig={
        'S3Uri': 's3://my-bucket/training-data.csv'  # Format: label,text
    },
    LanguageCode='en'
)
```

**Training data format** (CSV):
```
BILLING,"I was charged twice for my subscription"
TECHNICAL,"The app crashes when I try to upload photos"
SALES,"Do you offer enterprise pricing?"
```

**Use custom classifier**:
```python
response = comprehend.classify_document(
    Text="My credit card was charged but I didn't receive confirmation",
    EndpointArn='arn:aws:comprehend:us-east-1:123456789012:document-classifier-endpoint/support-classifier'
)

for classification in response['Classes']:
    print(f"{classification['Name']}: {classification['Score']:.2f}")
# Output:
# BILLING: 0.95
# TECHNICAL: 0.03
# SALES: 0.02
```

#### AWS Translate

**What it is**: Managed neural machine translation service supporting 75+ languages with real-time and batch translation.

##### Core Capabilities

**1. Real-Time Text Translation**

Translate text between language pairs instantly.

**Example use cases**:
- Customer support: Translate user messages to agent's language
- E-commerce: Translate product descriptions for international customers
- Social media: Translate user posts for global audience

**API call**:
```python
import boto3

translate = boto3.client('translate')

response = translate.translate_text(
    Text='Hello, how can I help you today?',
    SourceLanguageCode='en',
    TargetLanguageCode='es'
)

print(response['TranslatedText'])
# Output: Hola, ¿cómo puedo ayudarte hoy?
```

**Supported languages**: 75+ including English, Spanish, French, German, Chinese, Japanese, Arabic, Hindi, Portuguese, Russian, Korean, Italian, Dutch, Polish, Turkish, Swedish, and many more.

**2. Auto-Detect Source Language**

Translate without knowing source language (Translate detects it automatically).

**API call**:
```python
response = translate.translate_text(
    Text='Bonjour',
    SourceLanguageCode='auto',  # Auto-detect
    TargetLanguageCode='en'
)

print(f"Detected language: {response['SourceLanguageCode']}")
print(f"Translation: {response['TranslatedText']}")
# Output:
# Detected language: fr
# Translation: Hello
```

**3. Batch Translation**

Translate large document collections asynchronously.

**Example use cases**:
- Knowledge base localization: Translate 10,000 help articles to 10 languages
- Legal document translation: Batch-translate contracts for international deals
- Content publishing: Translate blog posts to multiple languages

**Start batch translation job**:
```python
response = translate.start_text_translation_job(
    InputDataConfig={
        'S3Uri': 's3://my-bucket/documents/',
        'ContentType': 'text/plain'
    },
    OutputDataConfig={
        'S3Uri': 's3://my-bucket/translations/'
    },
    DataAccessRoleArn='arn:aws:iam::123456789012:role/TranslateRole',
    SourceLanguageCode='en',
    TargetLanguageCodes=['es', 'fr', 'de', 'ja']  # Translate to 4 languages
)

job_id = response['JobId']
```

**4. Custom Terminology**

Define custom translations for domain-specific terms (brand names, product names, technical jargon).

**Example use cases**:
- Brand consistency: Ensure company name never translated
- Technical documentation: Use standardized translations for technical terms
- Legal accuracy: Preserve exact wording for legal terms

**Create custom terminology**:
```python
terminology_data = """
en,es,fr
AWS,AWS,AWS
Amazon S3,Amazon S3,Amazon S3
EC2 instance,instancia EC2,instance EC2
"""

response = translate.import_terminology(
    Name='technical-terms',
    MergeStrategy='OVERWRITE',
    TerminologyData={
        'File': terminology_data.encode('utf-8'),
        'Format': 'CSV'
    }
)
```

**Use custom terminology**:
```python
response = translate.translate_text(
    Text='Launch an EC2 instance in AWS.',
    SourceLanguageCode='en',
    TargetLanguageCode='es',
    TerminologyNames=['technical-terms']
)

print(response['TranslatedText'])
# Output: Lanza una instancia EC2 en AWS.
# (EC2 and AWS not translated due to custom terminology)
```

**5. Formality Settings**

Control translation formality (formal vs informal).

**Example use cases**:
- Customer communication: Use formal tone for business customers
- Marketing: Use informal tone for younger demographics
- Localization: Match cultural norms (German formal/informal distinction)

**API call**:
```python
response = translate.translate_text(
    Text='How are you?',
    SourceLanguageCode='en',
    TargetLanguageCode='de',
    Settings={
        'Formality': 'FORMAL'  # or 'INFORMAL'
    }
)

print(response['TranslatedText'])
# FORMAL: Wie geht es Ihnen?
# INFORMAL: Wie geht es dir?
```

**Supported for**: French, German, Hindi, Italian, Japanese, Korean, Portuguese, Spanish.

#### Pricing and Cost Optimization

##### Comprehend Pricing

**Synchronous APIs** (sentiment, entities, key phrases, language, PII):
- $0.0001 per unit (100 characters)
- Example: 1 million characters = 10,000 units × $0.0001 = $1.00

**Asynchronous jobs** (topic modeling, custom classification):
- $0.00005 per unit (100 characters)
- 50% cheaper than synchronous for batch processing

**Custom models**:
- Training: $3.00 per hour
- Inference endpoint: $0.50 per hour

**Example costs**:
- Analyze 10 million customer reviews (500 chars each): 5 billion chars = 50M units × $0.0001 = $5,000
- Topic modeling on same data (async): 50M units × $0.00005 = $2,500 (50% savings)

##### Translate Pricing

**Real-time translation**: $15.00 per million characters

**Example costs**:
- Translate 100,000 support tickets (500 chars each): 50M chars × $15/million = $750
- Translate product catalog (10,000 products × 200 chars × 10 languages): 20M chars × $15/million = $300

##### Cost Optimization Strategies

**1. Use asynchronous processing for batch workloads**

Topic modeling costs 50% less than synchronous entity/sentiment detection. If processing large document collections, use async jobs.

**2. Cache translation results**

Store translated text in DynamoDB to avoid re-translating same content.

**3. Truncate long texts before analysis**

Comprehend/Translate charge per character. If analyzing user reviews for sentiment, first 500 characters often sufficient (reviews frontload important info).

**4. Use Translate batch jobs for large volumes**

Batch translation has same per-character cost but better throughput for large datasets.

**5. Pre-filter with language detection**

Only translate non-English content. Use Comprehend language detection (cheap) before calling Translate (expensive).

```python
# Detect language first
lang_response = comprehend.detect_dominant_language(Text=text)
source_lang = lang_response['Languages'][0]['LanguageCode']

# Only translate if not English
if source_lang != 'en':
    translation = translate.translate_text(
        Text=text,
        SourceLanguageCode=source_lang,
        TargetLanguageCode='en'
    )
```

#### Integration Patterns

##### Pattern 1: Multilingual Customer Support

**Use case**: Support agents speak English, customers submit tickets in 30 languages.

**Architecture**:
```
Customer Ticket (any language) → Comprehend (detect language) → Translate (to English) →
Agent Response (English) → Translate (to customer language) → Customer
```

**Implementation**:
```python
def process_support_ticket(ticket_text, ticket_id):
    comprehend = boto3.client('comprehend')
    translate = boto3.client('translate')

    # Detect language
    lang_response = comprehend.detect_dominant_language(Text=ticket_text)
    source_lang = lang_response['Languages'][0]['LanguageCode']

    # Translate to English if needed
    if source_lang != 'en':
        trans_response = translate.translate_text(
            Text=ticket_text,
            SourceLanguageCode=source_lang,
            TargetLanguageCode='en'
        )
        english_text = trans_response['TranslatedText']
    else:
        english_text = ticket_text

    # Analyze sentiment (in English)
    sentiment_response = comprehend.detect_sentiment(
        Text=english_text,
        LanguageCode='en'
    )

    # Extract entities
    entities_response = comprehend.detect_entities(
        Text=english_text,
        LanguageCode='en'
    )

    # Store ticket with metadata
    store_ticket({
        'ticket_id': ticket_id,
        'original_language': source_lang,
        'english_text': english_text,
        'sentiment': sentiment_response['Sentiment'],
        'entities': entities_response['Entities'],
        'priority': 'HIGH' if sentiment_response['Sentiment'] == 'NEGATIVE' else 'NORMAL'
    })
```

##### Pattern 2: Content Moderation Pipeline

**Use case**: Flag inappropriate user-generated content.

**Architecture**:
```
User Post → Comprehend (PII detection) → Comprehend (sentiment) → Comprehend (custom classifier) →
Moderation Decision (approve/flag/reject)
```

**Implementation**:
```python
def moderate_content(text):
    comprehend = boto3.client('comprehend')

    # Check for PII
    pii_response = comprehend.detect_pii_entities(
        Text=text,
        LanguageCode='en'
    )

    if pii_response['Entities']:
        return {'decision': 'REJECT', 'reason': 'Contains PII'}

    # Analyze sentiment
    sentiment_response = comprehend.detect_sentiment(
        Text=text,
        LanguageCode='en'
    )

    if sentiment_response['Sentiment'] == 'NEGATIVE':
        # Flag for manual review
        return {'decision': 'FLAG', 'reason': 'Negative sentiment', 'sentiment': sentiment_response}

    # Use custom classifier for policy violations
    classifier_response = comprehend.classify_document(
        Text=text,
        EndpointArn='arn:aws:comprehend:us-east-1:123456789012:document-classifier-endpoint/content-policy'
    )

    for classification in classifier_response['Classes']:
        if classification['Name'] == 'VIOLATION' and classification['Score'] > 0.8:
            return {'decision': 'REJECT', 'reason': f'Policy violation ({classification["Score"]:.2f})'}

    return {'decision': 'APPROVE'}
```

##### Pattern 3: Real-Time Translation API

**Use case**: Provide translation API for mobile app.

**Architecture**:
```
Mobile App → API Gateway → Lambda (Translate) → Response
```

**Lambda function**:
```python
import boto3
import json

translate = boto3.client('translate')

def lambda_handler(event, context):
    body = json.loads(event['body'])
    text = body['text']
    target_lang = body['target_language']

    response = translate.translate_text(
        Text=text,
        SourceLanguageCode='auto',
        TargetLanguageCode=target_lang
    )

    return {
        'statusCode': 200,
        'body': json.dumps({
            'translated_text': response['TranslatedText'],
            'source_language': response['SourceLanguageCode']
        })
    }
```

#### When to Use Comprehend & Translate

**Use Comprehend when**:
- ✅ Need sentiment analysis, entity extraction, or PII detection at scale
- ✅ Want to avoid building/training custom NLP models
- ✅ Processing text in supported languages (100+ for language detection, 12 for full NLP)
- ✅ Integration simplicity prioritized (REST API vs ML infrastructure)

**Use Translate when**:
- ✅ Need translation between 75+ language pairs
- ✅ Want neural translation quality without managing models
- ✅ Processing multilingual user content (support tickets, reviews, social media)
- ✅ Localizing applications for international markets

**Consider alternatives when**:
- ❌ **Need specialized NLP for niche domain** → SageMaker with custom models (medical NLP, legal NLP)
- ❌ **Extremely high volume, cost-sensitive** → Self-hosted open-source (spaCy, Stanford NLP, Hugging Face) if you can manage infrastructure
- ❌ **Need translation with human-level accuracy** → Professional human translators (Comprehend/Translate good for gist, not legal contracts)
- ❌ **Real-time conversation translation** → Consider specialized tools (Google Translate API has lower latency for live chat)

#### Common Pitfalls

##### Not Caching Translation Results

**Symptom**: Translating same product descriptions 1000× as users browse catalog in different languages.

**Cost impact**: 1,000 products × 200 chars × 1,000 views × 10 languages = 2B chars × $15/million = $30,000/month.

**Solution**: Cache translations in DynamoDB keyed by (text_hash, source_lang, target_lang).

##### Using Synchronous API for Batch Processing

**Symptom**: Processing 1 million documents takes 10 hours and costs 2× more than necessary.

**Solution**: Use asynchronous batch jobs (50% cheaper, better throughput).

##### Truncating Mid-Sentence

**Symptom**: Translation quality degrades when truncating long text.

**Bad truncation**:
```python
text[:500]  # Cuts mid-sentence
```

**Good truncation**:
```python
text[:500].rsplit('.', 1)[0] + '.'  # Cut at sentence boundary
```

##### Not Handling Mixed Languages

**Symptom**: Text contains multiple languages, Comprehend analyzes dominant language only.

**Example**: Email signature in different language than body.

**Solution**: Split text into segments, detect language per segment.

### Speech: Transcribe and Polly

#### AWS Transcribe: Speech-to-Text

##### Core Capabilities

**1. Standard Transcription (Batch Processing)**

Process pre-recorded audio files stored in S3:

```python
import boto3

transcribe = boto3.client('transcribe')

# Start transcription job
response = transcribe.start_transcription_job(
    TranscriptionJobName='customer-call-123',
    LanguageCode='en-US',
    MediaFormat='wav',
    Media={
        'MediaFileUri': 's3://my-bucket/customer-calls/call-123.wav'
    },
    OutputBucketName='my-transcription-output',
    Settings={
        'ShowSpeakerLabels': True,
        'MaxSpeakerLabels': 2,
        'ChannelIdentification': True
    }
)

# Check job status
job = transcribe.get_transcription_job(
    TranscriptionJobName='customer-call-123'
)

print(f"Status: {job['TranscriptionJob']['TranscriptionJobStatus']}")
# Output location: s3://my-transcription-output/customer-call-123.json
```

**Output format** (JSON):
```json
{
  "jobName": "customer-call-123",
  "results": {
    "transcripts": [{
      "transcript": "Hello, I need help with my account. Sure, I can help you with that."
    }],
    "speaker_labels": {
      "speakers": 2,
      "segments": [
        {
          "start_time": "0.0",
          "end_time": "3.5",
          "speaker_label": "spk_0",
          "items": [/* word-level timestamps */]
        }
      ]
    },
    "items": [
      {
        "start_time": "0.0",
        "end_time": "0.5",
        "alternatives": [{
          "confidence": "0.99",
          "content": "Hello"
        }],
        "type": "pronunciation"
      }
    ]
  }
}
```

**2. Real-Time Transcription (Streaming)**

Transcribe audio as it's spoken for live captioning or voice assistants:

```python
import asyncio
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        for result in results:
            if not result.is_partial:
                for alt in result.alternatives:
                    print(f"Final transcript: {alt.transcript}")

async def transcribe_stream(audio_stream):
    client = TranscribeStreamingClient(region="us-east-1")

    stream = await client.start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    async def write_chunks():
        async for chunk in audio_stream:
            await stream.input_stream.send_audio_event(audio_chunk=chunk)
        await stream.input_stream.end_stream()

    handler = MyEventHandler(stream.output_stream)
    await asyncio.gather(write_chunks(), handler.handle_events())

# Usage with microphone input
# asyncio.run(transcribe_stream(get_microphone_audio()))
```

**3. Custom Vocabulary**

Improve accuracy for domain-specific terms:

```python
# Create custom vocabulary for medical terminology
transcribe.create_vocabulary(
    VocabularyName='medical-terms',
    LanguageCode='en-US',
    Phrases=[
        'tachycardia',
        'myocardial infarction',
        'cerebrovascular accident',
        'electrocardiogram'
    ]
)

# Use in transcription job
transcribe.start_transcription_job(
    TranscriptionJobName='medical-consult-456',
    LanguageCode='en-US',
    Media={'MediaFileUri': 's3://my-bucket/consults/456.mp3'},
    Settings={
        'VocabularyName': 'medical-terms'
    }
)
```

**4. Speaker Diarization**

Identify and separate different speakers:

```python
transcribe.start_transcription_job(
    TranscriptionJobName='meeting-recording',
    LanguageCode='en-US',
    Media={'MediaFileUri': 's3://my-bucket/meetings/team-sync.mp3'},
    Settings={
        'ShowSpeakerLabels': True,
        'MaxSpeakerLabels': 5  # Up to 10 speakers supported
    }
)
```

**5. Channel Identification**

Separate audio channels (e.g., customer vs agent in call center):

```python
transcribe.start_transcription_job(
    TranscriptionJobName='support-call',
    LanguageCode='en-US',
    Media={'MediaFileUri': 's3://my-bucket/calls/stereo-call.wav'},
    Settings={
        'ChannelIdentification': True
    }
)
```

**6. Content Redaction (PII Removal)**

Automatically redact sensitive information:

```python
transcribe.start_transcription_job(
    TranscriptionJobName='compliant-transcription',
    LanguageCode='en-US',
    Media={'MediaFileUri': 's3://my-bucket/calls/sensitive.mp3'},
    ContentRedaction={
        'RedactionType': 'PII',
        'RedactionOutput': 'redacted',  # 'redacted' or 'redacted_and_unredacted'
        'PiiEntityTypes': [
            'CREDIT_DEBIT_NUMBER',
            'SSN',
            'EMAIL',
            'PHONE',
            'NAME',
            'ADDRESS'
        ]
    }
)
```

**Output**: "My credit card number is [PII] and my SSN is [PII]"

**7. Language Identification**

Automatically detect the spoken language:

```python
transcribe.start_transcription_job(
    TranscriptionJobName='multilingual-audio',
    IdentifyLanguage=True,
    LanguageOptions=['en-US', 'es-US', 'fr-FR', 'de-DE'],
    Media={'MediaFileUri': 's3://my-bucket/audio/unknown-language.mp3'}
)
```

**8. Medical and Call Analytics Specializations**

**Transcribe Medical** (HIPAA-eligible):
```python
transcribe_medical = boto3.client('transcribe')

transcribe_medical.start_medical_transcription_job(
    MedicalTranscriptionJobName='patient-visit-789',
    LanguageCode='en-US',
    MediaFormat='mp3',
    Media={'MediaFileUri': 's3://my-bucket/medical/visit-789.mp3'},
    OutputBucketName='my-medical-transcripts',
    Specialty='PRIMARYCARE',  # PRIMARYCARE, CARDIOLOGY, NEUROLOGY, ONCOLOGY, RADIOLOGY, UROLOGY
    Type='CONVERSATION'  # CONVERSATION or DICTATION
)
```

**Call Analytics** (sentiment, talk time, interruptions):
```python
transcribe.start_call_analytics_job(
    CallAnalyticsJobName='support-call-analytics',
    Media={'MediaFileUri': 's3://my-bucket/calls/support-123.mp3'},
    ChannelDefinitions=[
        {'ChannelId': 0, 'ParticipantRole': 'AGENT'},
        {'ChannelId': 1, 'ParticipantRole': 'CUSTOMER'}
    ]
)
```

**Output includes**:
- Sentiment analysis (positive, negative, neutral) per speaker
- Talk time percentage per speaker
- Interruptions and overtalk
- Non-talk time (silence)
- Loudness scores
- Issue detection and categorization

---

#### AWS Polly: Text-to-Speech

##### Core Capabilities

**1. Standard Text-to-Speech**

Convert text to natural-sounding audio:

```python
import boto3

polly = boto3.client('polly')

# Synthesize speech
response = polly.synthesize_speech(
    Text='Hello! Welcome to our customer support. How can I help you today?',
    OutputFormat='mp3',  # mp3, ogg_vorbis, pcm, json (for speech marks)
    VoiceId='Joanna',    # US English female voice
    Engine='neural'      # 'neural' or 'standard'
)

# Save audio to file
with open('greeting.mp3', 'wb') as f:
    f.write(response['AudioStream'].read())

print(f"Characters: {response['RequestCharacters']}")
print(f"Content-Type: {response['ContentType']}")
```

**2. Available Voices**

Polly offers multiple voices across languages and genders:

```python
# List available voices
voices = polly.describe_voices(LanguageCode='en-US')

for voice in voices['Voices']:
    print(f"{voice['Name']} ({voice['Gender']}) - {voice['LanguageCode']}")
    print(f"  Engine: {voice['SupportedEngines']}")
```

**Popular voices**:
- **US English**: Joanna (F, neural), Matthew (M, neural), Salli (F, neural)
- **British English**: Amy (F, neural), Brian (M, neural), Emma (F, neural)
- **Australian English**: Olivia (F, neural)
- **Spanish**: Lupe (F, neural, US), Lucia (F, neural, Spain)
- **French**: Léa (F, neural), Mathieu (M, neural)

**Neural voices** (higher quality, more natural):
- Supported for major languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Korean)
- More expensive but significantly better quality
- Support for newscaster speaking style

**3. Speech Synthesis Markup Language (SSML)**

Control pronunciation, pace, pitch, and pauses:

```python
ssml_text = """
<speak>
    <prosody rate="medium" pitch="medium">
        Welcome to <emphasis level="strong">Acme Corporation</emphasis>.
    </prosody>

    <break time="500ms"/>

    <prosody rate="slow">
        Please listen carefully to the following options.
    </prosody>

    <break time="300ms"/>

    <say-as interpret-as="telephone">1-800-555-1234</say-as>

    <break time="500ms"/>

    Your account balance is <say-as interpret-as="currency">$1,234.56</say-as>

    <break time="300ms"/>

    <phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme>
</speak>
"""

response = polly.synthesize_speech(
    Text=ssml_text,
    TextType='ssml',  # 'text' or 'ssml'
    OutputFormat='mp3',
    VoiceId='Joanna',
    Engine='neural'
)
```

**SSML features**:
- `<break>`: Insert pauses
- `<emphasis>`: Add emphasis (strong, moderate, reduced)
- `<prosody>`: Control rate, pitch, volume
- `<say-as>`: Interpret as date, time, phone, currency, etc.
- `<phoneme>`: Specify phonetic pronunciation
- `<sub>`: Substitute pronunciation (alias)
- `<amazon:domain>`: Use specialized voices (news, conversational)

**4. Neural Newscaster Style**

Use newscaster speaking style for announcements:

```python
ssml_news = """
<speak>
    <amazon:domain name="news">
        Breaking news: The company has announced record earnings for the quarter,
        exceeding analyst expectations by 15 percent.
    </amazon:domain>
</speak>
"""

response = polly.synthesize_speech(
    Text=ssml_news,
    TextType='ssml',
    OutputFormat='mp3',
    VoiceId='Matthew',  # Newscaster style only works with specific voices
    Engine='neural'
)
```

**5. Speech Marks (Metadata)**

Get timing information for lip-sync or highlighting:

```python
response = polly.synthesize_speech(
    Text='Hello, how are you?',
    OutputFormat='json',  # Returns speech marks, not audio
    VoiceId='Joanna',
    Engine='neural',
    SpeechMarkTypes=['word', 'sentence', 'ssml', 'viseme']
)

# Parse speech marks (newline-delimited JSON)
marks = response['AudioStream'].read().decode('utf-8')
for line in marks.strip().split('\n'):
    mark = json.loads(line)
    print(f"{mark['type']}: {mark['value']} at {mark['time']}ms")
```

**Output**:
```json
{"time":0,"type":"sentence","start":0,"end":18,"value":"Hello, how are you?"}
{"time":0,"type":"word","start":0,"end":5,"value":"Hello"}
{"time":417,"type":"word","start":7,"end":10,"value":"how"}
{"time":583,"type":"word","start":11,"end":14,"value":"are"}
{"time":750,"type":"word","start":15,"end":18,"value":"you"}
```

**Use cases**:
- Synchronized captions
- Animated avatars with lip-sync
- Highlighting text as it's spoken
- Visual feedback in learning applications

**6. Long-Form Content with StartSpeechSynthesisTask**

For content longer than 3,000 characters or asynchronous processing:

```python
# Start asynchronous synthesis task
response = polly.start_speech_synthesis_task(
    Text=long_article_text,  # Can be up to 200,000 characters
    OutputFormat='mp3',
    OutputS3BucketName='my-polly-output',
    OutputS3KeyPrefix='articles/',
    VoiceId='Joanna',
    Engine='neural'
)

task_id = response['SynthesisTask']['TaskId']

# Check task status
task = polly.get_speech_synthesis_task(TaskId=task_id)
print(f"Status: {task['SynthesisTask']['TaskStatus']}")
print(f"Output: {task['SynthesisTask']['OutputUri']}")
```

**7. Lexicons (Custom Pronunciations)**

Define custom pronunciations for acronyms, brand names, or technical terms:

```python
# Create pronunciation lexicon (PLS format)
lexicon_content = """<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0"
      xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon
        http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd"
      alphabet="ipa"
      xml:lang="en-US">
  <lexeme>
    <grapheme>AWS</grapheme>
    <alias>Amazon Web Services</alias>
  </lexeme>
  <lexeme>
    <grapheme>SQL</grapheme>
    <phoneme>ˈɛs kjuː ˈɛl</phoneme>
  </lexeme>
</lexicon>
"""

# Upload lexicon
polly.put_lexicon(
    Name='tech-terms',
    Content=lexicon_content
)

# Use lexicon in synthesis
response = polly.synthesize_speech(
    Text='AWS provides SQL database services.',
    OutputFormat='mp3',
    VoiceId='Joanna',
    Engine='neural',
    LexiconNames=['tech-terms']
)
```

---

#### Integration Patterns

##### Pattern 1: Serverless Call Transcription Pipeline

**Architecture**:
```
Phone Call → S3 (audio) → Lambda (trigger) → Transcribe Job
                ↓
Transcribe Complete → EventBridge → Lambda → DynamoDB (transcript)
                                           → Comprehend (sentiment)
                                           → SNS (alerts for negative sentiment)
```

**Implementation**:

```python
import boto3
import json

transcribe = boto3.client('transcribe')
comprehend = boto3.client('comprehend')
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

def lambda_start_transcription(event, context):
    """Triggered when audio file lands in S3"""
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    job_name = f"call-{key.replace('/', '-').replace('.', '-')}"

    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        LanguageCode='en-US',
        MediaFormat='wav',
        Media={'MediaFileUri': f's3://{bucket}/{key}'},
        OutputBucketName='my-transcription-output',
        Settings={
            'ShowSpeakerLabels': True,
            'MaxSpeakerLabels': 2,
            'ChannelIdentification': True
        }
    )

    return {'statusCode': 200, 'body': f'Started job: {job_name}'}

def lambda_process_transcript(event, context):
    """Triggered by EventBridge when transcription completes"""
    detail = event['detail']

    if detail['TranscriptionJobStatus'] != 'COMPLETED':
        return {'statusCode': 200, 'body': 'Job not completed'}

    # Fetch transcript from S3
    job_name = detail['TranscriptionJobName']
    transcript_uri = detail['TranscriptionJobResult']['TranscriptFileUri']

    # Download and parse transcript
    # (S3 download logic omitted for brevity)
    transcript_text = "..."  # Full transcript text

    # Analyze sentiment
    sentiment = comprehend.detect_sentiment(
        Text=transcript_text[:5000],  # First 5000 chars
        LanguageCode='en'
    )

    # Store in DynamoDB
    table = dynamodb.Table('call-transcripts')
    table.put_item(Item={
        'job_name': job_name,
        'transcript': transcript_text,
        'sentiment': sentiment['Sentiment'],
        'sentiment_score': sentiment['SentimentScore'],
        'timestamp': detail['CreationTime']
    })

    # Alert on negative sentiment
    if sentiment['Sentiment'] == 'NEGATIVE':
        sns.publish(
            TopicArn='arn:aws:sns:us-east-1:123456789012:negative-call-alerts',
            Subject=f'Negative sentiment detected: {job_name}',
            Message=f'Sentiment: {sentiment["Sentiment"]}\nScore: {sentiment["SentimentScore"]}'
        )

    return {'statusCode': 200, 'body': 'Processed transcript'}
```

**EventBridge rule** (capture Transcribe completion):
```json
{
  "source": ["aws.transcribe"],
  "detail-type": ["Transcribe Job State Change"],
  "detail": {
    "TranscriptionJobStatus": ["COMPLETED", "FAILED"]
  }
}
```

##### Pattern 2: Real-Time Voice Assistant with Polly

**Use case**: Convert chatbot text responses to speech for voice interfaces.

```python
import boto3
from flask import Flask, request, send_file
import io

app = Flask(__name__)
polly = boto3.client('polly')

@app.route('/speak', methods=['POST'])
def text_to_speech():
    """API endpoint: Convert text to speech"""
    data = request.json
    text = data.get('text', '')
    voice_id = data.get('voice', 'Joanna')

    # Synthesize speech
    response = polly.synthesize_speech(
        Text=text,
        OutputFormat='mp3',
        VoiceId=voice_id,
        Engine='neural'
    )

    # Stream audio back to client
    audio_stream = response['AudioStream'].read()
    return send_file(
        io.BytesIO(audio_stream),
        mimetype='audio/mpeg',
        as_attachment=True,
        download_name='response.mp3'
    )

@app.route('/chatbot', methods=['POST'])
def chatbot_with_voice():
    """Chatbot endpoint with text and voice response"""
    user_input = request.json.get('message', '')

    # Generate chatbot response (simplified)
    bot_response = generate_chatbot_response(user_input)

    # Convert to speech
    audio_response = polly.synthesize_speech(
        Text=bot_response,
        OutputFormat='mp3',
        VoiceId='Joanna',
        Engine='neural'
    )

    audio_bytes = audio_response['AudioStream'].read()

    return {
        'text': bot_response,
        'audio': base64.b64encode(audio_bytes).decode('utf-8'),
        'content_type': 'audio/mpeg'
    }
```

##### Pattern 3: Podcast/Video Auto-Captioning

**Architecture**:
```
Video Upload (S3) → Lambda → Extract Audio (FFmpeg)
                           → Transcribe Job
                           → Generate SRT/VTT captions
                           → Store in S3
                           → Trigger video processing pipeline
```

**Generate captions from Transcribe output**:

```python
import json

def generate_srt_from_transcript(transcript_json):
    """Convert Transcribe JSON to SRT subtitle format"""
    items = transcript_json['results']['items']

    captions = []
    current_caption = {'start': None, 'end': None, 'text': ''}

    for item in items:
        if item['type'] == 'pronunciation':
            word = item['alternatives'][0]['content']
            start_time = float(item['start_time'])
            end_time = float(item['end_time'])

            # Start new caption if needed
            if current_caption['start'] is None:
                current_caption['start'] = start_time

            current_caption['text'] += word + ' '
            current_caption['end'] = end_time

            # Create caption every 10 words or 5 seconds
            if len(current_caption['text'].split()) >= 10 or \
               (end_time - current_caption['start']) >= 5:
                captions.append({
                    'start': current_caption['start'],
                    'end': current_caption['end'],
                    'text': current_caption['text'].strip()
                })
                current_caption = {'start': None, 'end': None, 'text': ''}

    # Convert to SRT format
    srt_content = ""
    for i, caption in enumerate(captions, 1):
        start = format_timestamp(caption['start'])
        end = format_timestamp(caption['end'])
        srt_content += f"{i}\n{start} --> {end}\n{caption['text']}\n\n"

    return srt_content

def format_timestamp(seconds):
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# Usage
with open('transcript.json', 'r') as f:
    transcript = json.load(f)

srt_output = generate_srt_from_transcript(transcript)

with open('captions.srt', 'w') as f:
    f.write(srt_output)
```

##### Pattern 4: Accessible Content Generation

**Use case**: Generate audio versions of articles for accessibility.

```python
import boto3
from bs4 import BeautifulSoup

polly = boto3.client('polly')
s3 = boto3.client('s3')

def html_article_to_audio(article_html, article_id):
    """Convert HTML article to audio with SSML formatting"""

    soup = BeautifulSoup(article_html, 'html.parser')

    # Extract title and content
    title = soup.find('h1').get_text()
    paragraphs = [p.get_text() for p in soup.find_all('p')]

    # Build SSML
    ssml = '<speak>\n'
    ssml += f'<prosody rate="medium" pitch="medium">\n'
    ssml += f'<emphasis level="strong">{title}</emphasis>\n'
    ssml += '<break time="1s"/>\n'

    for para in paragraphs:
        ssml += f'{para}\n'
        ssml += '<break time="500ms"/>\n'

    ssml += '</prosody>\n</speak>'

    # Generate audio (async for long content)
    response = polly.start_speech_synthesis_task(
        Text=ssml,
        TextType='ssml',
        OutputFormat='mp3',
        VoiceId='Joanna',
        Engine='neural',
        OutputS3BucketName='my-article-audio',
        OutputS3KeyPrefix=f'articles/{article_id}/'
    )

    return response['SynthesisTask']['TaskId']

# Usage
with open('article.html', 'r') as f:
    html_content = f.read()

task_id = html_article_to_audio(html_content, 'article-123')
print(f"Audio generation task started: {task_id}")
```

---

#### Pricing

##### AWS Transcribe Pricing

**Standard Transcription** (batch):
- **First 250 million seconds/month**: $0.024 per minute ($1.44 per hour)
- **Over 250 million seconds**: $0.0144 per minute ($0.864 per hour)

**Streaming Transcription**:
- $0.0275 per minute ($1.65 per hour)

**Transcribe Medical**:
- **Batch**: $0.036 per minute ($2.16 per hour)
- **Streaming**: $0.045 per minute ($2.70 per hour)

**Call Analytics**:
- $0.04 per minute ($2.40 per hour)

**Example costs**:

| Use Case | Volume | Monthly Cost |
|----------|--------|--------------|
| Customer calls (1,000 calls × 5 min avg) | 5,000 minutes | $120 |
| Podcast transcription (100 episodes × 45 min) | 4,500 minutes | $108 |
| Live event streaming (100 hours) | 6,000 minutes | $165 |
| Medical dictation (500 visits × 10 min) | 5,000 minutes | $180 |

##### AWS Polly Pricing

**Standard Voices**:
- **First 1 million characters/month**: Free (12 months from first use)
- **After free tier**: $4.00 per 1 million characters

**Neural Voices**:
- $16.00 per 1 million characters

**Speech Marks**:
- $4.00 per 1 million characters (standard)
- $16.00 per 1 million characters (neural)

**Example costs**:

| Use Case | Characters/Month | Engine | Monthly Cost |
|----------|------------------|--------|--------------|
| Voice notifications (100K messages × 100 chars) | 10 million | Standard | $40 |
| Audiobook narration (50 books × 300 pages × 2,000 chars) | 30 million | Neural | $480 |
| IVR system (500K calls × 200 chars avg) | 100 million | Standard | $400 |
| Podcast intro/outro (1,000 episodes × 500 chars) | 500K | Neural | $8 |

**Cost comparison**:

For a customer support system handling 10,000 calls/month (5 min avg):
- **Transcribe**: 50,000 minutes = $1,200/month
- **Polly** (IVR responses, 200 chars avg): 2M characters = $8/month (standard) or $32/month (neural)
- **Total**: ~$1,240/month

---

#### When to Use Transcribe & Polly

##### Use Transcribe When You Need To:

**1. Make audio content searchable**
- Podcast libraries with full-text search
- Video platforms with searchable captions
- Legal/compliance recording archives
- Meeting transcripts for knowledge management

**2. Analyze conversations**
- Customer support quality monitoring
- Sales call analysis (objections, keywords, sentiment)
- Healthcare visit documentation
- Market research interview analysis

**3. Generate accessibility features**
- Real-time captions for live streams
- Subtitles for video content
- Text versions of audio content for deaf/hard-of-hearing users

**4. Extract insights from audio**
- Speaker identification in multi-party calls
- Sentiment analysis of customer interactions
- Topic extraction from podcasts or webinars
- PII detection and redaction for compliance

##### Use Polly When You Need To:

**1. Create voice interfaces**
- Voice responses for chatbots and virtual assistants
- IVR (Interactive Voice Response) systems
- Voice-enabled applications and devices
- Smart speaker skills (Alexa, Google Home)

**2. Generate content narration**
- Audiobook production from ebooks
- News article audio versions
- Blog post podcasts
- Educational content narration

**3. Improve accessibility**
- Screen reader enhancements with natural voices
- Audio descriptions for visual content
- Voice guidance in applications
- Multi-language audio content

**4. Scale voice production**
- Automated voice announcements (flight info, public transit)
- Dynamic voice notifications (order updates, alerts)
- Personalized voice messages at scale
- Voiceover for automated video generation

##### Transcribe + Polly Combined Use Cases

**1. Voice translation pipeline**
- Transcribe audio (detect language)
- Translate text (AWS Translate)
- Synthesize in target language (Polly)
- Example: Real-time multilingual customer support

**2. Content repurposing**
- Transcribe podcast to text
- Summarize with AI (Comprehend/Bedrock)
- Generate summary audio (Polly)
- Example: Podcast show notes with audio summaries

**3. Voice bot with conversation memory**
- User speaks (real-time Transcribe)
- Bot processes intent (Lex/Lambda)
- Generate response (chatbot logic)
- Speak response (Polly)
- Log full conversation (DynamoDB)

---

#### When NOT to Use Transcribe & Polly

##### Transcribe Alternatives:

**Use custom speech models** when:
- You need higher accuracy than 90-95% for specialized domains
- You have extensive training data and ML expertise
- You need low-latency on-device transcription (offline)
- Cost per hour is prohibitive for your volume (>1M hours/month)

**Use third-party services** (Google Speech-to-Text, Azure Speech) when:
- You need specific features (e.g., longer audio context windows)
- You're already locked into another cloud ecosystem
- Pricing is significantly better for your use case

**Don't use Transcribe for**:
- Real-time voice commands requiring <100ms latency (use local models)
- Offline transcription (no internet connectivity)
- Extremely high-volume batch processing where cost becomes prohibitive

##### Polly Alternatives:

**Use custom TTS models** when:
- You need a unique brand voice (custom voice cloning)
- You require ultra-low latency (<50ms)
- You need offline voice synthesis
- You want IP ownership of the voice

**Use third-party services** (Google Text-to-Speech, Azure Neural TTS) when:
- You need specific voice styles not available in Polly
- You require more advanced prosody control
- You're already using another cloud provider

**Don't use Polly for**:
- Real-time conversational AI requiring <100ms response (consider streaming)
- Extremely high-volume synthesis where cost is prohibitive (>1B chars/month)
- Creative voice work requiring human inflection and emotion (hire voice actors)

---

#### Common Pitfalls

##### Transcribe Pitfalls:

**1. Not using custom vocabularies for domain-specific terms**

**Problem**: Generic models misinterpret technical terms, brand names, acronyms.

**Solution**:
```python
# Always create custom vocabulary for your domain
polly.create_vocabulary(
    VocabularyName='company-terms',
    LanguageCode='en-US',
    Phrases=[
        'Kubernetes',
        'PostgreSQL',
        'OAuth2',
        'HIPAA',
        'Acme Corporation'
    ]
)
```

**2. Ignoring audio quality requirements**

**Problem**: Poor audio quality (background noise, low bitrate) results in terrible transcription.

**Best practices**:
- Use at least 16 kHz sample rate (8 kHz minimum)
- Mono or stereo (don't use 5.1 surround)
- MP3, WAV, FLAC, or MP4 formats
- Minimize background noise (use noise reduction preprocessing)

**3. Not handling job failures**

**Problem**: Transcription jobs fail silently; no retry logic.

**Solution**:
```python
# Poll for job completion with error handling
import time

def wait_for_transcription(job_name, max_wait=600):
    elapsed = 0
    while elapsed < max_wait:
        job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = job['TranscriptionJob']['TranscriptionJobStatus']

        if status == 'COMPLETED':
            return job['TranscriptionJob']['Transcript']['TranscriptFileUri']
        elif status == 'FAILED':
            reason = job['TranscriptionJob'].get('FailureReason', 'Unknown')
            raise Exception(f"Transcription failed: {reason}")

        time.sleep(10)
        elapsed += 10

    raise TimeoutError(f"Transcription exceeded {max_wait}s")
```

**4. Over-relying on speaker diarization accuracy**

**Problem**: Speaker labels are not 100% accurate, especially with similar voices or overlapping speech.

**Mitigation**:
- Use channel identification for structured conversations (phone calls)
- Limit to 5 or fewer speakers for best accuracy
- Don't rely on speaker labels for legally binding attribution
- Provide human review for critical applications

**5. Not redacting PII in compliance-sensitive contexts**

**Problem**: Storing unredacted transcripts with SSN, credit cards, or health data violates compliance.

**Solution**: Always enable content redaction for sensitive data:
```python
ContentRedaction={
    'RedactionType': 'PII',
    'RedactionOutput': 'redacted_and_unredacted',  # Keep both for compliance
    'PiiEntityTypes': ['SSN', 'CREDIT_DEBIT_NUMBER', 'EMAIL', 'PHONE', 'NAME']
}
```

##### Polly Pitfalls:

<div class="callout callout--warning">
<p class="callout__title">Common Pitfall: Using Standard Voices</p>
<p>Standard voices sound robotic and unnatural for customer-facing applications. Always use neural voices for production. The quality difference is significant despite being 4x more expensive.</p>
</div>

**1. Using standard voices when neural voices are needed**

**Problem**: Standard voices sound robotic and unnatural, especially for customer-facing applications.

**Solution**: Always use neural voices for production applications:
```python
response = polly.synthesize_speech(
    Text=text,
    VoiceId='Joanna',
    Engine='neural',  # Not 'standard'
    OutputFormat='mp3'
)
```

**Cost difference**: Neural is 4x more expensive, but quality difference is worth it.

**2. Not using SSML for natural-sounding speech**

**Problem**: Plain text synthesis lacks pauses, emphasis, and natural phrasing.

**Solution**: Use SSML for production-quality audio:
```python
ssml = """
<speak>
    <prosody rate="95%">
        Welcome to our service.
        <break time="300ms"/>
        How can I help you today?
    </prosody>
</speak>
"""
```

**3. Hitting the 3,000 character limit for synchronous synthesis**

**Problem**: Long-form content fails with character limit errors.

**Solution**: Use `start_speech_synthesis_task` for content >3,000 characters:
```python
polly.start_speech_synthesis_task(
    Text=long_text,  # Up to 200,000 characters
    OutputS3BucketName='my-bucket',
    VoiceId='Joanna',
    Engine='neural'
)
```

**4. Not caching frequently used audio**

**Problem**: Synthesizing the same text repeatedly wastes money and time.

**Solution**: Cache generated audio in S3 with content-based keys:
```python
import hashlib

def get_or_synthesize_speech(text, voice_id='Joanna'):
    # Generate cache key
    cache_key = hashlib.sha256(f"{text}-{voice_id}".encode()).hexdigest()
    s3_key = f"polly-cache/{cache_key}.mp3"

    # Check cache
    try:
        response = s3.get_object(Bucket='my-audio-cache', Key=s3_key)
        return response['Body'].read()
    except s3.exceptions.NoSuchKey:
        pass

    # Synthesize and cache
    response = polly.synthesize_speech(
        Text=text,
        VoiceId=voice_id,
        Engine='neural',
        OutputFormat='mp3'
    )
    audio = response['AudioStream'].read()

    s3.put_object(Bucket='my-audio-cache', Key=s3_key, Body=audio)
    return audio
```

**5. Not handling lexicon limits**

**Problem**: Lexicons have limits (5 per request, 4,000 characters total).

**Solution**: Organize lexicons by domain and select relevant ones per request:
```python
# Separate lexicons
polly.put_lexicon(Name='medical-terms', Content=medical_lexicon)
polly.put_lexicon(Name='tech-terms', Content=tech_lexicon)
polly.put_lexicon(Name='brand-names', Content=brand_lexicon)

# Use only relevant lexicons per synthesis
polly.synthesize_speech(
    Text=medical_text,
    LexiconNames=['medical-terms', 'brand-names'],  # Max 5
    VoiceId='Joanna',
    Engine='neural'
)
```

---

#### Security Best Practices

##### 1. IAM Permissions

**Principle of least privilege**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::my-audio-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-transcription-output/*"
    }
  ]
}
```

##### 2. Encrypt Sensitive Audio and Transcripts

**Server-side encryption for S3**:
```python
s3.put_object(
    Bucket='my-audio-bucket',
    Key='sensitive-call.wav',
    Body=audio_data,
    ServerSideEncryption='aws:kms',
    SSEKMSKeyId='arn:aws:kms:us-east-1:123456789012:key/abc123'
)
```

**Transcribe with KMS encryption**:
```python
transcribe.start_transcription_job(
    TranscriptionJobName='encrypted-job',
    Media={'MediaFileUri': 's3://my-bucket/call.wav'},
    OutputBucketName='my-output',
    OutputEncryptionKMSKeyId='arn:aws:kms:us-east-1:123456789012:key/abc123'
)
```

##### 3. Enable Content Redaction for PII

**Always redact PII in compliance-sensitive contexts**:
```python
ContentRedaction={
    'RedactionType': 'PII',
    'RedactionOutput': 'redacted',
    'PiiEntityTypes': ['SSN', 'CREDIT_DEBIT_NUMBER', 'NAME', 'ADDRESS', 'EMAIL', 'PHONE']
}
```

##### 4. Use VPC Endpoints

**Keep traffic private**:
```bash
# Create VPC endpoint for Transcribe
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-abc123 \
  --service-name com.amazonaws.us-east-1.transcribe \
  --route-table-ids rtb-123456
```

##### 5. Implement Data Retention Policies

**Auto-delete sensitive transcripts**:
```python
# S3 lifecycle policy for transcripts
s3.put_bucket_lifecycle_configuration(
    Bucket='my-transcription-output',
    LifecycleConfiguration={
        'Rules': [{
            'Id': 'delete-transcripts-after-90-days',
            'Status': 'Enabled',
            'Expiration': {'Days': 90},
            'Filter': {'Prefix': 'transcripts/'}
        }]
    }
)
```

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
