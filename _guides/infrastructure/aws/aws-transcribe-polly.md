---
title: "AWS Transcribe & Polly"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "Speech-to-text, text-to-speech, voice synthesis, real-time transcription, and audio processing use cases"
tags: [aws, machine-learning, speech-processing, accessibility, voice-ai, practical]
---

## What Problems AWS Transcribe & Polly Solve

**The Speech AI Challenge**:
Organizations need to convert speech to text for accessibility, searchability, and analytics. They also need to generate natural-sounding speech from text for voice assistants, content narration, and accessibility features. Building custom speech recognition and synthesis systems requires deep expertise in signal processing, linguistics, and machine learning.

**What AWS Provides**:
AWS offers two complementary services for speech AI:
- **AWS Transcribe**: Automatic speech recognition (ASR) that converts audio to text
- **AWS Polly**: Neural text-to-speech (TTS) that converts text to lifelike audio

Both services use deep learning models trained on massive datasets, eliminating the need to build and maintain custom speech models.

---

## AWS Transcribe: Speech-to-Text

### Core Capabilities

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

## AWS Polly: Text-to-Speech

### Core Capabilities

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

## Integration Patterns

### Pattern 1: Serverless Call Transcription Pipeline

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

### Pattern 2: Real-Time Voice Assistant with Polly

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

### Pattern 3: Podcast/Video Auto-Captioning

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

### Pattern 4: Accessible Content Generation

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

## Pricing

### AWS Transcribe Pricing

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

### AWS Polly Pricing

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

## When to Use Transcribe & Polly

### Use Transcribe When You Need To:

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

### Use Polly When You Need To:

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

### Transcribe + Polly Combined Use Cases

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

## When NOT to Use Transcribe & Polly

### Transcribe Alternatives:

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

### Polly Alternatives:

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

## Common Pitfalls

### Transcribe Pitfalls:

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

### Polly Pitfalls:

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

## Security Best Practices

### 1. IAM Permissions

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

### 2. Encrypt Sensitive Audio and Transcripts

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

### 3. Enable Content Redaction for PII

**Always redact PII in compliance-sensitive contexts**:
```python
ContentRedaction={
    'RedactionType': 'PII',
    'RedactionOutput': 'redacted',
    'PiiEntityTypes': ['SSN', 'CREDIT_DEBIT_NUMBER', 'NAME', 'ADDRESS', 'EMAIL', 'PHONE']
}
```

### 4. Use VPC Endpoints

**Keep traffic private**:
```bash
# Create VPC endpoint for Transcribe
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-abc123 \
  --service-name com.amazonaws.us-east-1.transcribe \
  --route-table-ids rtb-123456
```

### 5. Implement Data Retention Policies

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

## Key Takeaways

**AWS Transcribe**:
1. Use **custom vocabularies** for domain-specific terminology to improve accuracy
2. Enable **speaker diarization** for multi-party conversations, but verify accuracy
3. Use **Call Analytics** for customer support quality monitoring and sentiment analysis
4. Always enable **PII redaction** for compliance-sensitive applications
5. Use **streaming transcription** for real-time captions; batch for archived content

**AWS Polly**:
6. Always use **neural voices** for production applications (4x cost, 10x quality)
7. Use **SSML** for natural-sounding speech with pauses, emphasis, and pronunciation control
8. **Cache frequently synthesized audio** to reduce costs and latency
9. Use **speech marks** for lip-sync, highlighting, and synchronized captions
10. Use **lexicons** for consistent pronunciation of brand names, acronyms, and technical terms

**Integration & Cost**:
11. Combine Transcribe + Translate + Polly for **multilingual voice applications**
12. Use **asynchronous jobs** for long-form content (>3,000 chars for Polly, batch for Transcribe)
13. **Monitor costs carefully** for high-volume applications (especially neural Polly)
14. Implement **serverless pipelines** (S3 + Lambda + EventBridge) for automated processing

**Quality & Compliance**:
15. **Pre-process audio** for best transcription results (16+ kHz, noise reduction, clear channels)
16. Use **Transcribe Medical** for HIPAA-compliant healthcare transcription
17. Enable **encryption at rest and in transit** for sensitive audio and transcripts
18. Implement **data retention policies** to auto-delete transcripts after required period

AWS Transcribe and Polly eliminate the complexity of building custom speech AI systems while providing enterprise-grade accuracy, scalability, and compliance features for real-world voice applications.
