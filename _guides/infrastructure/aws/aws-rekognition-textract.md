---
title: "AWS Rekognition & Textract: Vision AI Services"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "Image and video analysis with Rekognition, document intelligence with Textract, use cases, and cost optimization"
tags: [aws, machine-learning, automation, cost-analysis, integration, practical]
---

## What Problems AWS Rekognition & Textract Solve

AWS Rekognition and Textract eliminate the complexity of building custom computer vision models by providing pre-trained APIs for common vision tasks: image analysis, video analysis, and document extraction.

**Traditional computer vision challenges**:
- Building custom ML models for face detection, object recognition, or text extraction requires months of data labeling and model training
- Maintaining accuracy as new object types or document formats appear requires continuous retraining
- Scaling inference infrastructure to handle millions of images/videos requires managing GPU clusters
- Integrating vision capabilities into applications requires ML expertise that most development teams lack

**Concrete scenario**: Your e-commerce platform needs to moderate user-uploaded product images (detect inappropriate content), extract product attributes from photos (brand logos, colors, text), and verify seller identity documents (driver's licenses, passports). Building custom models would require hiring ML engineers, labeling 100,000+ images, training models on GPU infrastructure, and maintaining inference servers. Estimated cost: $500,000 first year (team + infrastructure). Estimated timeline: 6-12 months to production.

**What Rekognition & Textract provide**: Pre-trained APIs you call with one line of code. Rekognition detects objects, faces, text, moderation labels, and celebrities in images/videos. Textract extracts text, forms, and tables from documents with understanding of layout and relationships. No ML expertise required. Pay per image/document processed.

**Real-world impact**: After adopting Rekognition and Textract, image moderation became automated (block images flagged as explicit/suggestive). Product attributes extracted automatically (brand logos detected at 95% accuracy). Identity verification reduced from 2-day manual review to 5-minute automated extraction + human verification of extracted data. Total cost: $800/month (processing 100,000 images + 5,000 documents). Time to production: 2 weeks of integration work.

## AWS Rekognition

**What it is**: Managed computer vision service that analyzes images and videos to detect objects, faces, text, activities, and inappropriate content.

### Core Capabilities

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

## AWS Textract

**What it is**: Managed OCR service that extracts text, forms, and tables from documents with understanding of layout and relationships.

### Core Capabilities

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

## Pricing and Cost Optimization

### Rekognition Pricing

**Image analysis**: $1.00 per 1,000 images (first 1 million/month), then $0.80 per 1,000

**Example costs**:
- 100,000 images/month: 100 × $1.00 = $100/month
- 5 million images/month: 1,000 × $1.00 + 4,000 × $0.80 = $1,000 + $3,200 = $4,200/month

**Video analysis**: $0.10 per minute of video processed

**Example**: 1,000 hours video/month = 60,000 minutes × $0.10 = $6,000/month

**Face collections**: $0.001 per face stored per month

**Example**: Store 1 million faces = 1,000,000 × $0.001 = $1,000/month

### Textract Pricing

**Text detection**: $1.50 per 1,000 pages (first 1 million/month)

**Forms/tables extraction**: $50.00 per 1,000 pages (first 1 million/month)

**Queries**: $1.00 per 1,000 document pages + $1.00 per 1,000 query pages

**Example costs**:
- 10,000 pages text detection only: 10 × $1.50 = $15/month
- 10,000 pages forms extraction: 10 × $50.00 = $500/month
- 10,000 pages with 3 queries each: 10 × $50 + 30 × $1.00 = $500 + $30 = $530/month

### Cost Optimization Strategies

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

## Integration Patterns

### Pattern 1: Serverless Document Processing Pipeline

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

### Pattern 2: Real-Time Image Moderation

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

### Pattern 3: Identity Verification Workflow

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

## When to Use Rekognition & Textract

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

## Common Pitfalls

### Processing High-Volume Images Without Caching

**Symptom**: Processing same product images repeatedly (e.g., thumbnail generation triggers Rekognition on every page load).

**Cost impact**: 1 million image loads/month × $1/1,000 = $1,000/month wasted.

**Solution**: Cache Rekognition results in DynamoDB or S3. Check cache before calling API.

### Not Filtering by Confidence Score

**Symptom**: Low-confidence labels cause incorrect application logic (detecting "dog" at 45% confidence when image is actually a cat).

**Solution**: Set minimum confidence threshold (90%+ for production use).

```python
labels = [l for l in response['Labels'] if l['Confidence'] >= 90]
```

### Using Textract Forms Extraction for Simple Text

**Symptom**: Paying $50/1,000 pages for forms extraction when only need plain text ($1.50/1,000 pages).

**Solution**: Use `detect_document_text()` instead of `analyze_document()` with FORMS feature if you don't need key-value extraction.

### Synchronous Processing of Large Videos

**Symptom**: Lambda timeout (15 minutes) when processing hour-long videos synchronously.

**Solution**: Use asynchronous video analysis APIs with SNS notifications. Don't poll in Lambda.

## Key Takeaways

**Rekognition and Textract eliminate months of custom ML development** by providing pre-trained APIs for common computer vision tasks. Call the API with an image or document, get structured results in seconds without managing ML infrastructure.

**Cost scales with usage volume**. Rekognition costs $1 per 1,000 images, Textract costs $1.50-$50 per 1,000 pages depending on features. Cache results to avoid reprocessing, filter by confidence scores to reduce downstream manual review costs.

**Use Rekognition for images/videos** (object detection, face recognition, moderation, text in images). Use Textract for documents (PDFs, scans, forms, tables, IDs). Don't use Rekognition for document OCR. Textract is optimized for documents and provides structured extraction.

**Integration patterns are serverless-first**. S3 triggers Lambda on upload, Lambda calls Rekognition/Textract, stores results in DynamoDB, notifies via SNS. For real-time use cases (image moderation), call APIs synchronously from API Gateway + Lambda.

**Set confidence thresholds** (90%+) to filter low-quality results. Don't assume 100% accuracy. Use confidence scores to route uncertain cases to human review.

**Choose between Rekognition/Textract vs SageMaker** based on customization needs. Use Rekognition/Textract for standard use cases (face detection works out-of-box). Use SageMaker when you need custom models (detect specific product defects unique to your manufacturing process).

**Video analysis is asynchronous** and can take minutes to hours. Don't poll synchronously. Use SNS notifications to trigger downstream processing when video analysis completes.

**Textract Queries provide natural language interface** to document extraction. Instead of parsing complex JSON responses to find specific fields, ask "What is the invoice total?" and get the answer directly with confidence score.
