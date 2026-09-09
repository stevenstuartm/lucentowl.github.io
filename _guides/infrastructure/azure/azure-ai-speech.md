---
title: "Azure Speech in Foundry Tools"
layout: guide
category: Azure
subcategory: Machine Learning & AI
description: "A system architect's guide to Azure Speech in Foundry Tools, covering the three speech-to-text paths, text-to-speech and custom voice, speech translation, the Voice Live API for voice agents, and the capabilities that have been retired."
tags: [speech-to-text, text-to-speech, foundry-tools, voice-agents, speech-translation, practical]
---

## What Is Azure Speech

[Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/overview){:target="_blank" rel="noopener noreferrer"} is the speech processing service in **Foundry Tools**, the family formerly called Azure AI services and, before that, Azure Cognitive Services. It converts audio to text, synthesizes text into speech, translates spoken audio, and hosts end-to-end voice agents. The ARM resource provider is still `Microsoft.CognitiveServices`, so infrastructure code and role assignments written against the older names keep working even though the docs and portal now use the new ones.

Two resource shapes reach the same service. A **Microsoft Foundry resource** (`kind: AIServices`) exposes Speech alongside the rest of the Foundry Tools family behind one endpoint and one set of keys, and it is what the Foundry portal provisions. A **single-service Speech resource** exposes only Speech. Voice Live and features that call generative models need the Foundry resource; the rest work with either.

Scope matters more than it first appears, because most of what you customize is **region-scoped, not subscription-scoped**. Custom speech models, custom voices, and their deployed endpoints belong to one resource in one region. Training with audio data requires a region with dedicated training hardware, and moving a trained model elsewhere means an explicit copy through the [`Models_CopyTo`](https://learn.microsoft.com/en-us/rest/api/speechtotext/models/copy-to){:target="_blank" rel="noopener noreferrer"} API rather than a global rollout. A multi-region deployment therefore plans a resource, a quota, and a model copy per region.

### What Azure Speech Handles

- One service for transcription, synthesis, translation, and voice agents, reached through the Speech SDK, Speech CLI, or REST APIs
- Pre-trained models across a broad locale set, with per-feature language support published on the [language support page](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support){:target="_blank" rel="noopener noreferrer"}
- Custom speech models for domain vocabulary and difficult acoustics, and custom voices for a branded speaking identity
- SSML control over pitch, rate, volume, pronunciation, speaking style, and pacing
- Cloud, container, and on-device deployment from the same SDK surface
- Autoscaling behind a per-resource concurrency quota, with 429 retry handling expected of the caller

### Capabilities That Have Been Retired

Several features that older architecture write-ups still describe are gone. A design that depends on them will fail against the current service.

| Retired capability | Date | What to use instead |
|---|---|---|
| **Speaker recognition** (voice biometric verification and identification) | 30 September 2025 | No in-service successor. Speaker **diarization** is unaffected, but it separates who-spoke-when without identifying who they are |
| **Intent recognition** in the Speech SDK (`IntentRecognizer`, pattern-matching intents) | 30 September 2025 | Transcribe first, then classify with Conversational Language Understanding (CLU) or an Azure OpenAI model |
| **Custom Commands** | 30 April 2026 | Voice Live, or a Bot Framework bot driven by transcription plus CLU |
| **Long Audio API** | 1 April 2027 | The [batch synthesis API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-synthesis){:target="_blank" rel="noopener noreferrer"}, which supports every SSML element and output format the older API did not |

Speaker recognition is the one that reshapes designs. Voice-biometric authentication is no longer something Azure Speech offers, so a call center flow that verified callers by voiceprint needs a different authentication factor, and a meeting application that identified named participants now gets anonymous `Guest-1` and `Guest-2` labels it must map to identities by other means.

### How Azure Speech Compares to AWS Transcribe and Polly

AWS splits the same ground across separate services: Transcribe for recognition, Polly for synthesis, Translate for language conversion, and Nova Sonic or a Bedrock-orchestrated stack for voice agents.

| Aspect | AWS | Azure Speech |
|---|---|---|
| **Service boundary** | Transcribe (STT), Polly (TTS), Translate (text), each billed and configured separately | One service, one resource, one SDK for STT, TTS, and speech translation |
| **Real-time STT** | Transcribe streaming API | WebSocket streaming through the Speech SDK |
| **Pre-recorded STT** | Batch transcription jobs from S3 | Two paths: synchronous **fast transcription** (under 5 hours per file) and asynchronous **batch transcription** from Blob Storage |
| **Speech translation** | Not in Transcribe; chain Transcribe to Translate yourself | Native speech-to-text and speech-to-speech translation in a single API call |
| **Voice customization** | Polly Brand Voice (custom voice, engagement-based) | Custom voice, self-service but gated behind a limited-access review |
| **Voice engines** | Generative, long-form, neural, and standard engines with different voice coverage per engine | Standard (neural) voices, HD voices, and Azure OpenAI voices, with SSML support varying by voice type |
| **Speaker handling** | Transcribe speaker partitioning (diarization) | Diarization through `ConversationTranscriber`; voice biometrics retired |
| **Voice agents** | Assemble streaming STT, an LLM, and TTS yourself, or use Nova Sonic | **Voice Live API** bundles STT, model inference, TTS, barge-in, and echo cancellation behind one WebSocket |
| **Scaling control** | Per-account service quotas | Per-resource concurrency and TPS quotas, raised through a request form |

Neither vendor publishes a stable count of voices or supported languages, and the counts that do appear drift between doc pages. Check the language support page for the locale you actually need.

---

## Speech to Text

Three paths transcribe audio, and they differ in how results arrive rather than in recognition quality. Choosing between them early matters, because switching later means reworking how the caller handles results.

| | Real-time | Fast transcription | Batch transcription |
|---|---|---|---|
| **Input** | Streaming audio | One uploaded file | Blob Storage container or content URLs |
| **Results** | Partial results as audio arrives, final on end of speech | Synchronous, in the same HTTP response | Asynchronous, polled, written to storage |
| **Size limit** | Session-bound | Under 500 MB and under 5 hours per file | 1 GB per file, 1,000 files per request, 10,000 blobs per container |
| **Output form** | Lexical and display | Display form only (punctuated, capitalized) | Lexical and display |
| **Throughput** | 100 concurrent requests by default (S0) | 600 requests per minute (S0) | 600 requests per minute, queued and processed sequentially per region |
| **Use for** | Live captioning, voice commands, agent assist | A file you are waiting on: a voicemail, a meeting recording, one call | Archives, nightly call-center batches, bulk media libraries |

Batch transcription is queued, and the queue is the latency. Microsoft schedules jobs on a best-effort basis: a job can wait up to 30 minutes to start at peak, and 90th-percentile end-to-end latency is under 6 hours. Raising the quota does not speed it up, because each region processes batch jobs one at a time. Submitting 6,000 requests per minute transcribes no faster than 600. The documented approach is to send about 1,000 files per `Transcription_Create` call, spread submissions across hours, poll no more often than once a minute, and distribute across regions if the workload genuinely needs more throughput.

```
                  Is the audio arriving live?
                            |
              +-------------+-------------+
             yes                          no
              |                            |
      Real-time streaming        Do you need the result now?
      (WebSocket, partials)               |
                              +-----------+-----------+
                            yes                       no
                              |                        |
                  Under 500 MB / 5 hours?      Batch transcription
                              |                 (queued, up to 24h)
                    +---------+---------+
                  yes                   no
                    |                    |
            Fast transcription    Split, or use batch
```

**Diarization** attributes each segment to a speaker. The `ConversationTranscriber` class does this in real time, labeling participants `Guest-1`, `Guest-2`, and so on as it distinguishes them. Early intermediate results carry `Unknown` until a speaker is resolved, and intermediate speaker IDs require setting `SpeechServiceResponse_DiarizeIntermediateResults`. Real-time diarization caps at 240 minutes per session, and batch transcription with diarization enabled caps at 240 minutes per file. The labels are positional, not identities, and the REST API for short audio does not support diarization at all.

**Language identification** detects which language is being spoken, either standalone or attached to recognition or translation. Fast transcription can auto-detect without being given a candidate locale list.

**LLM speech** (preview) runs a language-model-enhanced speech model over pre-recorded audio for `transcribe` and `translate` tasks, at fast-transcription speed and with the same 500 MB / 5 hour / 600 RPM limits. It accepts prompt tuning, which the classic recognizers do not.

### Custom Speech

Custom speech adapts the base model when the audio contains domain jargon, unusual pronunciations, or difficult acoustics. Four dataset types feed it, and they are not interchangeable.

| Dataset type | Fixes | Documented quantity |
|---|---|---|
| Plain text | Substitution errors on domain words shown in context | 1-200 MB of related text |
| Structured text (preview) | Utterances that vary only by items from a list | Up to 10 classes, 4,000 items per class, 50,000 training sentences |
| Pronunciation | Made-up words, acronyms, product names | 1 KB to 1 MB (1 KB on the free tier) |
| Audio + human-labeled transcripts | Accents, speaking styles, background noise | 1-100 hours of audio |
| Display format | Capitalization, ITN patterns, profanity masking | 200 lines ITN, 1,000 lines rewrite, 1,000 lines profanity |

Start with text. Training on plain or structured text usually finishes in minutes, while training with audio can take days, and Microsoft's own guidance is that for heavily used locales such as US English the base model is already good enough that related text alone is often sufficient. Audio training earns its cost when the audio is hard for humans too.

Audio training data has strict format requirements: RIFF WAV, 8 kHz or 16 kHz, mono, 16-bit PCM, zipped, with the archive under 2 GB or 10,000 files. **Individual training files are capped at 40 seconds.** Longer files are not rejected outright, but only their transcript text is used, and if every file exceeds 40 seconds the training run fails. Half a second of silence before and after speech in each sample helps.

Custom speech does not fix everything. It captures word context to reduce substitution errors, not insertion or deletion errors, and unrelated sentences in the training set degrade the model rather than leaving it unchanged.

---

## Text to Speech

Text to speech synthesizes text into audio using neural voices. Standard voices are available out of the box across 100+ languages and locales, each model offered at 24 kHz and 48 kHz.

**Voice types** differ in quality and in how much SSML they honor:

- **Standard voices** (billed as *Neural*) are the default and support the full SSML surface
- **HD voices**, including the Dragon HD family, offer higher quality and a different, narrower set of supported SSML elements and speaking styles
- **Azure OpenAI voices** are available through the same synthesis surface
- **Custom voice** covers professional voice fine-tuning and personal voice, both under limited access
- **Embedded voices** run on device and drop a substantial part of the SSML surface

Anything beyond 10 minutes of audio per request goes through the [batch synthesis API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-synthesis){:target="_blank" rel="noopener noreferrer"} rather than real-time synthesis: submit asynchronously, poll, download. Real-time synthesis caps at 10 minutes of audio per request on every tier.

Billing counts **characters, not audio seconds**, and the count includes spaces, punctuation, and all SSML markup except the `<speak>` and `<voice>` tags themselves. Each Chinese character, including kanji in Japanese and hanja in Korean, counts as two. A verbose SSML wrapper is a real line item, not free formatting.

### Custom Voice

Custom voice is gated: access requires approval through Microsoft's [limited access intake form](https://aka.ms/customneural){:target="_blank" rel="noopener noreferrer"}, and a professional voice cannot be trained until a recorded consent statement from the voice talent has been submitted. Training needs **at least 300 utterances** with matching scripts, recorded with consistent volume, rate, pitch, and expressive manner. Microsoft measures training in compute hours: roughly 20-40 for a single-style voice, around 90 for a multi-style voice, billed with a cap of 96. Hosting is billed separately per hour for as long as the endpoint exists, so an idle custom-voice endpoint costs money.

**Personal voice** is the lighter path, creating a voice profile from a short sample rather than a studio session. It bills for profile storage per voice per day plus synthesis per character, and it supports a reduced SSML set.

### SSML

[Speech Synthesis Markup Language](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup){:target="_blank" rel="noopener noreferrer"} controls the output. The attribute value rules are where most SSML bugs live, because each `prosody` attribute accepts absolute, relative, and named values that mean different things:

| Attribute | Absolute | Relative | Named constants | Documented range |
|---|---|---|---|---|
| `pitch` | A frequency, `600Hz` | `+80Hz`, `-2st` (semitones), or a percentage such as `-50%` | `x-low` through `x-high` | 0.5 to 1.5 times the original |
| `rate` | None | A bare multiplier (`1` is unchanged, `0.5` halves, `2` doubles) or a percentage such as `+30%` | `x-slow` through `x-fast` | 0.5 to 2 times the original |
| `volume` | A number from `0.0` to `100.0`, default `100.0` | `+10`, `-5.5`, or a percentage | `silent` through `x-loud` | 0 to 100 |

A bare percentage is a **relative** change, not an absolute level, and the `+` is optional while the `-` is not. Values outside the supported range are limited or substituted rather than honored. Microsoft's own example of an unsupported value is a volume of 120.

Emotion is not a `prosody` attribute. Speaking styles come from `mstts:express-as`, which takes a `style`, an optional `styledegree` from `0.01` to `2`, and an optional `role` that makes a voice imitate a different age or gender. Style support varies by voice, and an unsupported `styledegree` is silently ignored.

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/Synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="en-US-AvaNeural">
    <mstts:express-as style="cheerful" styledegree="1.5">
      <prosody pitch="+20%" rate="+10%" volume="+20%">
        I'm excited to announce our new product!
      </prosody>
    </mstts:express-as>
  </voice>
</speak>
```

To layer voices, use multiple `<voice>` elements inside one `<speak>` document rather than trying to blend characteristics within a single element. Other elements cover recorded audio insertion, background audio, lexicons, visemes for facial animation, a target output duration, and voice conversion from a source recording.

### Text-to-Speech Avatar

The avatar feature renders synthesized speech as video of a photorealistic speaker, either batch-synthesized or driven in real time. Custom avatars are limited-access like custom voices and train in roughly 20-40 compute hours, capped at 96. The real-time avatar has tight quotas that shape any interactive design: **2 new connections per minute**, 30 minutes maximum per speaking connection, and 5 minutes idle before disconnect. Long sessions need explicit auto-reconnect logic. Real-time avatar billing runs per second of connection time whether or not the avatar is speaking, so idle connections are billable.

---

## Speech Translation

Speech translation converts audio in one language to text or synthesized speech in another, in a single API call rather than a transcribe-then-translate chain you assemble.

The **standard API** takes a specified source language and returns translated text, synthesized audio, or both. **Live Interpreter** is the conversational variant: it identifies the spoken language without being told, handles speakers switching languages mid-session without a restart, preserves speaker style and tone in the output voice, and can use a personal voice for the translated audio. Its current limitation is that transcription comes back in the target language only, with no source-language transcript yet.

The constraint that shapes cost and architecture is target-language count. **One call translates into at most two target languages.** Beyond that you need a Foundry (multi-service) resource, and each language past the second is billed as Translator text translation on top of the speech charge. Because translation runs on intermediate streaming results, the billed character count exceeds the character count of the final transcript, and Microsoft's own worked example applies a coefficient of 3 to account for that.

**Video translation** is the offline sibling: it extracts dialogue from an uploaded video, transcribes it, translates with LLM reformulation, generates synchronized voice-over in the target language using standard or personal voices, and produces subtitles. It runs as iterations against a stored translation, so subtitle files can be corrected by a human and fed into a second pass. Retention depends on entry point: REST API version `2026-03-01` and later keeps data 31 days from the last action, earlier versions 300 days, and portal-created projects are deleted after 360 days of inactivity starting 1 August 2026.

---

## Voice Live

The Voice Live API is Microsoft's managed answer to building a voice agent. Assembling one yourself means running streaming recognition, a generative model, and synthesis as separate hops, then solving barge-in, echo, and end-of-turn detection across them. Voice Live collapses that into one WebSocket connection.

```
  DIY orchestration                      Voice Live API
  -----------------                      --------------

  mic audio                              mic audio
     |                                      |
     v                                      v
  [ streaming STT ]  --+              +-----------------------+
     |                 |              |  one WebSocket        |
     v                 |              |                       |
  [ LLM inference ] <--+  you own:    |  STT + model + TTS    |
     |                    barge-in    |  barge-in, echo       |
     v                    echo        |  cancellation,        |
  [ TTS synthesis ]       turn-taking |  end-of-turn, avatar  |
     |                    latency     +-----------------------+
     v                                      |
  speaker                                   v
                                         speaker
```

Voice Live covers over 140 locales for recognition and offers over 600 standard voices across 150+ locales for output. The generative model is your choice, from `gpt-realtime` and its data-zone variants through the GPT-5 and GPT-4.1 families down to `gpt-5-nano` and `phi4-mm-realtime`, with none of them requiring you to deploy or provision capacity. Pricing tiers (Pro, Basic, Lite) follow from the model you pick rather than being selected directly. Function calling, phrase lists, custom speech models, custom voices, and avatars all plug in, with custom assets billed separately for training and hosting.

The API is deliberately compatible with the Azure OpenAI Realtime API event surface, so the Speech-specific additions (noise suppression, echo cancellation, advanced end-of-turn detection) are additive rather than a migration. Quotas are per resource: **30 new connections per minute**, 60 minutes maximum per session, and 120,000 tokens per minute. Token limits move with the connection limit at 4,000 tokens per connection per minute, so raising one raises the other.

---

## Pronunciation Assessment

Pronunciation assessment scores recorded speech against reference text and returns accuracy, fluency, completeness, and prosody scores down to the phoneme. It drives language-learning feedback, speech therapy tools, and speaking practice applications, and it is one of the few Speech features with its own responsible-AI transparency note, because scoring someone's pronunciation carries assessment risk that plain transcription does not.

---

## Keyword Recognition

Keyword recognition detects a wake word in a continuous audio stream. It functions as a privacy boundary as much as a feature: an always-listening device sends nothing to the cloud until the keyword gates it through.

The design is a multi-stage chain, and each stage only sees audio the previous stage accepted.

```
  continuous mic audio
          |
          v
  +----------------------+   on-device custom keyword model
  |  stage 1: on-device  |   (Basic or Advanced)
  |  keyword spotting    |
  +----------------------+
          | keyword suspected
          +-----------------------------+
          |                             |
          v                             v
  +------------------+        +--------------------+
  | keyword          |        | speech to text     |   run in parallel,
  | verification     |        | (keyword-prefixed) |   not in sequence
  | (cloud)          |        |                    |
  +------------------+        +--------------------+
          |                             |
      rejected ---------------------> STT processing terminated
          |
      accepted ---------------------> results returned to client
```

Custom keyword models are generated from the [Custom Keyword portal](https://speech.microsoft.com/customkeyword){:target="_blank" rel="noopener noreferrer"} by typing a word or phrase. **No training data upload is required.** The service generates and trains from the keyword itself. **Basic** models are ready in up to 15 minutes and suit prototyping; **Advanced** models adapt a base model with simulated training data, take up to 48 hours, and are the product-integration choice. Model generation is free, and running models on device costs nothing beyond whatever Speech features they gate.

The accuracy tuning knob is pronunciation selection. The portal proposes pronunciations for the keyword, and choosing too many raises false accepts while choosing too few lowers correct accepts.

Keyword verification runs in the cloud in parallel with speech to text, so it adds no latency to transcription: if verification rejects the keyword, STT processing is terminated instead of having been delayed. Verification processes at most two seconds of audio before timing out to a rejection, and rejected cases are slower than accepted ones because more audio gets examined. Because the keyword is known to be present, the service also allows a longer pause (up to five seconds) after it before declaring end of speech, which is what makes "*keyword, pause, command*" work as well as "*keyword command*".

---

## Deployment Options

### Cloud API

The managed service in an Azure region. No infrastructure, automatic scaling within quota, always-current models, and access to every feature including the ones that need generative models. This is the default, and the only option for Voice Live, avatars, and video translation.

### Containers

Containers move a subset of Speech to your own infrastructure for data residency or locality. The subset is genuinely a subset, and it shrinks the further you get from core transcription:

| Container | Status |
|---|---|
| Speech to text | GA |
| Custom speech to text | GA |
| Neural text to speech | GA |
| Fast transcription | Public preview |
| Speech language identification | Public preview, and **not available disconnected** |

Speech translation, pronunciation assessment, avatars, and Voice Live have no container. A design that assumes translation can run on-premises in a container is assuming a container that does not exist.

Containers are not free-standing. They are licensed to run only while connected to Azure for metering, billing through a Foundry resource on your account. Running genuinely disconnected requires submitting a [request form](https://aka.ms/csdisconnectedcontainers){:target="_blank" rel="noopener noreferrer"}, waiting up to 10 business days for a decision, purchasing a commitment plan, and creating the resource under the approved subscription ID. Disconnected pricing and commitment tiers differ from connected pricing.

### Embedded and Hybrid

Embedded speech runs recognition and synthesis entirely on device, and it is **limited access**: use requires approval through the [embedded speech review](https://aka.ms/csgate-embedded-speech){:target="_blank" rel="noopener noreferrer"}, and model downloads plus per-model license keys arrive only after approval.

The capability is fuller than "wake words only." Embedded speech does real transcription and neural synthesis, across a fixed list of about 21 recognition locales and most text-to-speech locales with one selected voice per gender. Constraints are the platform and the resource budget:

- **SDKs**: C#, C++, Java, Python, and Go only. Not the other SDKs, not the Speech CLI, not REST
- **Memory**: model size plus roughly 200 MB for recognition; 100-200 MB for synthesis
- **Audio**: recognition takes mono 16-bit 8 kHz or 16 kHz PCM WAV only
- **Platforms**: Windows 11+, macOS 10.14+, Linux, and Android 8.0+ on Arm64/Arm32, with gaps (no embedded TTS neural voices on Linux Arm32, no Android support from Python or Go)
- **SSML**: a reduced set, with no `voice`, `lang`, `emphasis`, `silence`, or background audio elements

**Hybrid speech** (`HybridSpeechConfig`) is the middle path and behaves differently per direction. For recognition, it uses the cloud and falls back to the embedded model after repeated connection failures, returning to the cloud if connectivity recovers. For synthesis, it runs both in parallel on every request and takes whichever responds first. Python and Go do not support hybrid; C#, C++, and Java do.

For a secure facility rather than a roaming device, Microsoft's guidance is to reach for disconnected containers before embedded speech.

---

## Real-Time Streaming and Audio Formats

Real-time recognition streams audio over a WebSocket and returns partial results as recognition confidence builds, with a final result when the service detects end of speech. Interactive latency is dominated by the fact that the service must receive and process enough audio to produce a hypothesis, so sub-100 ms round trips are not achievable through the cloud path regardless of network quality. Designs needing that responsiveness put an on-device keyword model or embedded recognition in front of the cloud call.

The **default input format is WAV: 16 kHz or 8 kHz, 16-bit, mono PCM.** Compressed formats are supported, but through [GStreamer](https://gstreamer.freedesktop.org){:target="_blank" rel="noopener noreferrer"}, which the SDK does not bundle for licensing reasons. The binaries have to be installed separately and present on the system path at runtime, matching the SDK's architecture. Once GStreamer is in place, the SDK accepts MP3, OPUS/OGG, FLAC, ALAW and MULAW in a WAV container, and `ANY` for MP4 or unknown containers.

This trips up teams in two ways. First, the same code that works on a developer's machine fails in a container image without the GStreamer plug-ins. Second, **the JavaScript, Objective-C, and Swift SDKs do not support compressed audio at all**, so those clients must decode to the default PCM format themselves before streaming. Server-side transcoding to 16 kHz mono PCM is the simpler design when clients are heterogeneous.

Fast transcription accepts a wider format list directly, including WAV, MP3, OPUS/OGG, FLAC, WMA, AAC, ALAW and MULAW in WAV containers, AMR, WebM, and SPEEX, because it takes a whole file rather than a live stream.

---

## Integration Patterns

**Voice agents.** Voice Live is the current path for a conversational voice application, and it removes the orchestration that older Bot Framework and Custom Commands designs required. A Bot Framework bot can still be reached over the Direct Line Speech channel through the SDK's `DialogServiceConnector`, which suits an existing bot with established dialog logic. Custom Commands, which used to be the low-code option here, is retired.

**Transcribe then classify.** With intent recognition removed from the Speech SDK, the supported pattern is two steps: `SpeechRecognizer` or `ConversationTranscriber` produces text, and CLU or an Azure OpenAI model produces intents and entities. CLU fits when you have labeled data and want stable, versioned intent schemas with evaluation metrics. An Azure OpenAI model fits when intents change quickly or the categories are not known upfront. The two combine: CLU for deterministic classification, a model for summarization or low-confidence fallback.

**Telephony and contact center.** Azure Communication Services carries the call; Speech transcribes it and synthesizes IVR responses. Diarization and channel separation matter here, and stereo call recordings with one party per channel transcribe more reliably than a mixed mono stream.

**Search over audio.** Transcribe with batch transcription, index the transcript in Azure AI Search alongside timestamps, and let users search text and seek to the matching audio position. Word-level timestamps come out of fast transcription and batch transcription directly.

**Power Platform.** The Batch Speech to text connector exposes batch transcription to Power Automate, Power Apps, and Logic Apps without code, which covers a surprising share of "transcribe these files nightly" requirements.

---

## Quotas and Throttling

Speech quotas are per resource and per feature, and they are concurrency and rate limits, not capacity you purchase. There is no throughput-unit or reserved-capacity concept to buy.

| Feature | Free (F0) | Standard (S0) | Adjustable |
|---|---|---|---|
| Real-time STT + speech translation, combined | 1 concurrent request | 100 concurrent requests | Yes |
| Custom endpoint STT | 1 concurrent request | 100 concurrent requests per endpoint | Yes, separately per endpoint |
| Fast transcription / LLM speech | Not available | 600 requests per minute | Yes (fast transcription) |
| Batch transcription | Not available | 100 requests per 10 seconds | No |
| Real-time TTS | 20 transactions per 60 seconds | 30 TPS | Yes, up to 1,000 TPS |
| Voice Live | Not available | 30 new connections per minute, 120,000 TPM | Yes |
| Real-time avatar | Not available | 2 new connections per minute | Yes |
| Custom model deployments | 1 | 50 | No |

Free-tier limits are not adjustable at all. Switching a resource from F0 to S0 can take several hours for the new quotas to take effect, so a tier change belongs well before a launch rather than during one.

Raising a quota goes through the [Foundry Tools quota increase form](https://aka.ms/foundry-tools-quota-increase){:target="_blank" rel="noopener noreferrer"} using a work email, naming the specific feature, the subscription and resource IDs, and a business justification. Custom endpoints need their endpoint ID. The current value of a concurrency limit is not visible in the portal, the CLI, or the API, so confirming what you have today also means opening a support request.

Raising a limit does not reduce cost or improve batch throughput, and it does not eliminate 429s. Speech autoscales on demand rather than holding idle capacity, so a workload that jumps from 5 TPS to 20 TPS in one second gets throttled while the service scales, even though 20 TPS is well within quota. Retry with backoff is required, and load should ramp: Microsoft's suggested pattern is starting at 20 concurrent connections, adding 20 every 90-120 seconds, and backing off on 429 with retry intervals of 1, 2, 4, and 4 minutes.

Two kinds of 429 are not quota problems at all. Text-to-speech 429s are usually backend capacity for a specific voice in a specific region, which more quota will not fix; using the voice in its native region or picking a more common voice will. And creating extra Speech resources in the *same* region does not add capacity, because one backend cluster serves them all. Spreading across regions does.

---

## Common Pitfalls

### Pitfall 1: Designing Around Voice Biometrics

**Problem:** Architecting caller authentication or named-speaker attribution on speaker verification and identification.

**Result:** The feature was retired on 30 September 2025. There is no in-service replacement.

**Solution:** Use a different authentication factor for identity. If the requirement is only "separate the speakers," diarization through `ConversationTranscriber` still works, but it returns positional `Guest-N` labels that your application must map to identities from call metadata, channel assignment, or an explicit enrollment step you build yourself.

---

### Pitfall 2: Assuming Overlapping Speech Is Handled

**Problem:** Feeding a mixed mono stream with people talking over each other into diarization.

**Result:** Overlapped segments are attributed unreliably or lost. Diarization is built for turn-taking conversation, not source separation.

**Solution:** Capture one speaker per channel where the medium allows it (telephony usually does), transcribe channels separately, and merge on timestamps. Where a single microphone is unavoidable, treat overlap as expected transcript loss rather than something configuration will fix.

---

### Pitfall 3: Sending Compressed Audio Without GStreamer

**Problem:** Streaming MP3 or OPUS from an SDK that needs GStreamer, without the binaries installed and on the path.

**Result:** Recognition fails at runtime in the deployed environment while working on a developer machine that happens to have GStreamer. In JavaScript, Objective-C, and Swift it never works, because those SDKs do not support compressed input at all.

**Solution:** Install the matching-architecture GStreamer plug-ins into the container image or host and verify they load. Where clients vary, transcode to the default 16 kHz mono 16-bit PCM before streaming and avoid the dependency entirely.

---

### Pitfall 4: Custom Speech Training Files Over 40 Seconds

**Problem:** Uploading whole call recordings as audio-plus-transcript training data.

**Result:** Only the transcript text of each over-length file is used, so the acoustic training you paid for silently does not happen. If every file exceeds 40 seconds, the training run fails.

**Solution:** Segment training audio to 40 seconds or less per file (30 for Whisper customization), keep the transcripts word-accurate, and start with plain text before investing in audio at all. Text training finishes in minutes rather than days and is often enough on well-supported locales.

---

### Pitfall 5: SSML Values Outside the Supported Range

**Problem:** Treating a bare percentage as an absolute level, or setting values the voice cannot honor, such as `volume="120"` when the absolute scale ends at 100.

**Result:** The value is limited or substituted rather than applied. The output sounds unchanged or distorted, with no error to debug.

**Solution:** Use relative values with an explicit sign (`pitch="+20%"`, `volume="+10%"`), keep pitch within 0.5-1.5x and rate within 0.5-2x of the original, and reach for `mstts:express-as` rather than `prosody` when the goal is emotion. Confirm the voice type supports the element: HD voices, personal voices, and embedded voices each drop part of the SSML surface.

---

### Pitfall 6: Expecting Quota Increases to Fix Throughput

**Problem:** Requesting a quota increase to make batch transcription finish sooner, or to stop 429s during a traffic spike.

**Result:** No improvement. Batch jobs queue and process sequentially per region regardless of quota, and spike 429s come from autoscaling lag rather than the limit.

**Solution:** For batch, submit about 1,000 files per request, spread submissions over hours, poll no more than once a minute, and distribute across regions. For spikes, ramp load gradually and implement backoff. Reserve quota requests for a genuinely higher sustained ceiling.

---

### Pitfall 7: Leaving Custom Endpoints and Avatar Connections Running

**Problem:** Treating a deployed custom voice, custom speech, or avatar endpoint as free when idle.

**Result:** Custom voice hosting bills per hour for as long as the endpoint exists, calculated daily at 00:00 UTC. Real-time avatar connections bill per second of connection time whether or not the avatar speaks.

**Solution:** Suspend or delete custom endpoints that are not serving traffic and redeploy on demand. For real-time avatars, play local idle video instead of holding an active connection through silence, and handle the 30-minute connection cap with auto-reconnect rather than a permanently open session.

---

### Pitfall 8: Building for More Than Two Translation Targets

**Problem:** Assuming one speech translation call fans out to any number of target languages.

**Result:** A single call covers at most two. Additional languages require a Foundry multi-service resource and bill as Translator text translation on top of the speech charge, at a character count inflated by intermediate streaming results.

**Solution:** Decide the target language count before designing the session, and budget beyond two as a separate translation line item. Where languages vary per listener rather than per session, translating the final transcript downstream may cost less than fanning out live.

---

## Key Takeaways

1. **The service is now Azure Speech in Foundry Tools, and several capabilities are gone.** Speaker recognition and SDK intent recognition retired on 30 September 2025, Custom Commands on 30 April 2026, and the Long Audio API retires 1 April 2027. Voice biometrics has no replacement; the others have documented migration targets.

2. **Three speech-to-text paths exist, and picking wrong costs latency or throughput.** Real-time streams, fast transcription returns synchronously for files under 500 MB and 5 hours, and batch transcription queues for volume. Batch latency comes from the queue, and more quota does not shorten it.

3. **Voice Live is the managed path for voice agents.** It bundles recognition, a generative model of your choice, synthesis, barge-in handling, and echo cancellation behind one WebSocket compatible with the Azure OpenAI Realtime event surface, replacing a hand-built three-hop pipeline.

4. **Customization is region-scoped and gated.** Custom speech models and custom voices live in one resource in one region and must be copied to others explicitly. Custom voice, custom avatar, and embedded speech all require approval through limited-access review before you can build on them.

5. **Start custom speech with text, not audio.** Plain and structured text train in minutes and often suffice on well-supported locales, while audio training takes days and silently ignores the acoustics of any file over 40 seconds.

6. **SSML value semantics cause more defects than SSML structure.** A bare percentage is relative, absolute volume stops at 100, emotion comes from `mstts:express-as` rather than `prosody`, and HD, personal, and embedded voices each support a narrower element set than standard voices.

7. **Containers cover less than the cloud service.** Speech to text, custom speech to text, and neural TTS are GA; fast transcription and language identification are preview; translation, avatars, and Voice Live have no container. Disconnected operation needs approval, a commitment plan, and up to 10 business days.

8. **Quotas are concurrency and rate limits, not purchasable capacity.** Defaults are 100 concurrent real-time requests and 30 TTS transactions per second on S0, raised through a request form. Autoscaling lag causes 429s inside quota, so ramping load and retrying with backoff matter more than the ceiling.

9. **Billing units differ per feature and reward attention.** Text to speech bills characters including SSML markup, with CJK characters counted double. Speech translation past two targets bills Translator characters inflated by intermediate results. Custom voice hosting and real-time avatars bill for time, not usage.

10. **The default audio format is narrower than it looks.** Real-time streaming expects 16 kHz or 8 kHz mono 16-bit PCM, and compressed input depends on separately installed GStreamer binaries that three SDKs cannot use at all.
