---
title: "AWS Comprehend & Translate: Language AI Services"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "Natural language processing with Comprehend, real-time translation with Translate, sentiment analysis, entity extraction, and multilingual applications"
tags: [aws, machine-learning, automation, integration, practical, cost-analysis]
---

## What Problems AWS Comprehend & Translate Solve

AWS Comprehend and Translate eliminate the complexity of building custom NLP and translation models by providing pre-trained APIs for common language tasks: sentiment analysis, entity extraction, language detection, and translation across 75+ languages.

**Traditional NLP challenges**:
- Building custom sentiment analysis models requires labeled datasets of 10,000+ examples and NLP expertise
- Translation quality depends on maintaining parallel corpora (aligned text in multiple languages) and retraining models as language evolves
- Scaling NLP inference to process millions of documents requires managing compute infrastructure
- Supporting 75 languages would require separate models for each language pair (75 × 74 = 5,550 translation models)

**Concrete scenario**: Your global SaaS product receives 50,000 customer support tickets monthly in 30 languages. You need to detect sentiment (urgent/negative tickets escalated to senior support), extract entities (product names, account IDs), classify tickets by topic (billing, technical, feature request), and provide multilingual support (agents respond in customer's language). Building custom models would cost $800,000 first year (NLP team + infrastructure + training data). Supporting 30 languages would require 30 × 29 = 870 translation model pairs.

**What Comprehend & Translate provide**: Pre-trained APIs that analyze text sentiment, extract entities, detect language, and translate between 75+ languages with one API call. No ML expertise required. Pay per character processed.

**Real-world impact**: After adopting Comprehend and Translate, ticket routing became automated (negative sentiment tickets flagged for priority). Entity extraction identified product names and account IDs automatically (98% accuracy). Auto-translation enabled agents speaking 5 languages to support customers in 30 languages. Total cost: $1,200/month (processing 50,000 tickets averaging 500 characters each). Time to production: 3 weeks of integration work.

## AWS Comprehend

**What it is**: Managed NLP service that extracts insights from text (sentiment, entities, key phrases, language, topics, and personally identifiable information).

### Core Capabilities

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

## AWS Translate

**What it is**: Managed neural machine translation service supporting 75+ languages with real-time and batch translation.

### Core Capabilities

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

## Pricing and Cost Optimization

### Comprehend Pricing

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

### Translate Pricing

**Real-time translation**: $15.00 per million characters

**Example costs**:
- Translate 100,000 support tickets (500 chars each): 50M chars × $15/million = $750
- Translate product catalog (10,000 products × 200 chars × 10 languages): 20M chars × $15/million = $300

### Cost Optimization Strategies

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

## Integration Patterns

### Pattern 1: Multilingual Customer Support

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

### Pattern 2: Content Moderation Pipeline

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

### Pattern 3: Real-Time Translation API

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

## When to Use Comprehend & Translate

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

## Common Pitfalls

### Not Caching Translation Results

**Symptom**: Translating same product descriptions 1000× as users browse catalog in different languages.

**Cost impact**: 1,000 products × 200 chars × 1,000 views × 10 languages = 2B chars × $15/million = $30,000/month.

**Solution**: Cache translations in DynamoDB keyed by (text_hash, source_lang, target_lang).

### Using Synchronous API for Batch Processing

**Symptom**: Processing 1 million documents takes 10 hours and costs 2× more than necessary.

**Solution**: Use asynchronous batch jobs (50% cheaper, better throughput).

### Truncating Mid-Sentence

**Symptom**: Translation quality degrades when truncating long text.

**Bad truncation**:
```python
text[:500]  # Cuts mid-sentence
```

**Good truncation**:
```python
text[:500].rsplit('.', 1)[0] + '.'  # Cut at sentence boundary
```

### Not Handling Mixed Languages

**Symptom**: Text contains multiple languages, Comprehend analyzes dominant language only.

**Example**: Email signature in different language than body.

**Solution**: Split text into segments, detect language per segment.

## Key Takeaways

**Comprehend and Translate provide pre-trained NLP and translation** without custom model development. Analyze sentiment, extract entities, detect PII, and translate between 75+ languages with API calls.

**Cost scales with character count**. Comprehend costs $0.0001 per 100 characters (synchronous), Translate costs $15 per million characters. Cache results, truncate long texts, and use asynchronous processing for batch workloads to reduce costs 50%.

**Use Comprehend for text analysis** (sentiment, entities, language detection, PII). Use Translate for converting text between languages. Both integrate seamlessly: detect language with Comprehend, translate with Translate.

**Custom models extend capabilities**. Train custom classifiers for domain-specific categorization (support ticket routing, content moderation). Define custom terminologies to preserve brand names and technical terms in translations.

**Asynchronous processing is 50% cheaper** for batch workloads. Use topic modeling jobs for document collections, batch translation jobs for large-scale localization.

**Integration patterns are serverless-first**. Lambda functions call Comprehend/Translate APIs, store results in DynamoDB, trigger downstream workflows via SNS/SQS. For real-time use cases (chat translation), call APIs synchronously from API Gateway + Lambda.

**Translation quality is gist-level**, suitable for user-generated content, support tickets, and product descriptions. For legal contracts, medical records, or marketing copy requiring perfect accuracy, use professional human translators.

**Language support varies by service**. Translate supports 75+ languages for translation. Comprehend supports 100+ for language detection but only 12 for full NLP (sentiment, entities). Check language support before implementation.
