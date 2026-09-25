---
title: "Windows AI Integration"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Adding on-device AI to a WinUI 3 app, from choosing between the Windows AI APIs, Foundry Local, Windows ML, and the cloud, through packaging, token, and hardware requirements, readiness checks, the LanguageModel API, the move from Phi Silica to Aion Instruct, imaging and OCR, and falling back across tiers."
tags: [windows-ai-apis, phi-silica, aion-instruct, foundry-local, text-recognition, npu, advanced]
---

## Four Ways to Run a Model

A WinUI 3 app has four places to get AI inference, and they differ in who supplies the model and which hardware runs it. Microsoft groups the first three under the brand **Microsoft Foundry on Windows**, which replaced the earlier names Windows Copilot Runtime and Windows AI Foundry.

| Option | Who supplies the model | Hardware | Fits when |
| --- | --- | --- | --- |
| **Windows AI APIs** | Windows, which installs and updates it | Mostly Copilot+ PCs (NPU), with a few APIs also running on a GPU or CPU | You need a common task (text generation, summarizing, OCR, image description) with no model to manage |
| **Foundry Local** | You pick an open model from a catalog, downloaded at run time | x64 or Arm64 PCs on Windows 11 24H2 or later, using CPU, GPU, or NPU model variants | You need a local LLM on hardware that isn't a Copilot+ PC, or a model the Windows AI APIs don't offer |
| **Windows ML** | You bring your own model in ONNX, the portable format most training frameworks export to | Any x64 or Arm64 PC, through execution providers (hardware-specific back ends) that Windows installs, with the NPU and GPU ones needing Windows 11 24H2 | You have a custom model (a classifier, a detector) and want hardware acceleration |
| **Cloud** (Azure OpenAI in Microsoft Foundry) | Microsoft hosts frontier models | A network connection | The task needs a large model, a long context, or current knowledge |

A **Copilot+ PC** is a hardware category, not a software feature. It has an NPU (neural processing unit) rated at 40 or more TOPS (trillions of operations per second) and at least 16 GB of RAM. On a Copilot+ PC the Windows AI APIs always run on the NPU, and the GPU and CPU paths exist only for devices without one.

The local options keep data on the device, work offline, and cost nothing per request. The cloud option trades those away for capability. Microsoft's [comparison page](https://learn.microsoft.com/en-us/windows/ai/windows-ai-comparison){:target="_blank" rel="noopener noreferrer"} recommends combining them. Try the Windows AI APIs first, fall back to Foundry Local, and use the cloud last. The rest of this guide covers the Windows AI APIs in depth, because they carry the most platform-specific rules, and closes with that fallback chain.

---

## What an App Needs Before the APIs Answer

The Windows AI APIs ship in the Windows App SDK (`Microsoft.Windows.AI.Text`, `Microsoft.Windows.AI.Imaging`, and related namespaces), but referencing the package isn't enough. Three gates sit in front of the model. The hardware and token gates report themselves through status values, but the manifest gate tends to surface as an error that doesn't name the cause.

### Package Identity and the systemAIModels Capability

The APIs need package identity, which in practice means a packaged (MSIX) app, and a manifest that declares the `systemAIModels` capability. Without them, calls fail with an `UnauthorizedAccessException` or a COM error, and Microsoft's WinUI tutorial warns that the project's unpackaged launch profile makes `GetReadyState()` fail this way, so debug through the packaged profile. The device needs Windows 11 25H2 (build 26200.7309) or later, and the app needs Windows App SDK 1.8.0 or later from the stable channel. The manifest needs the `systemai` namespace declared on the `<Package>` element and the capability added:

```xml
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  xmlns:systemai="http://schemas.microsoft.com/appx/manifest/systemai/windows10"
  IgnorableNamespaces="uap rescap systemai">

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <systemai:Capability Name="systemAIModels" />
  </Capabilities>
</Package>
```

The manifest's `MaxVersionTested` must be at least `10.0.26226.0`, or loading a model can fail with "Not declared by app". Visual Studio rewrites these version attributes at build time, so the project file has to tell it not to:

```xml
<AppxOSMinVersionReplaceManifestVersion>false</AppxOSMinVersionReplaceManifestVersion>
<AppxOSMaxVersionTestedReplaceManifestVersion>false</AppxOSMaxVersionTestedReplaceManifestVersion>
```

Microsoft's pages disagree about `MinVersion`. The get-started and image-description pages leave it at `10.0.17763.0`, while the WinUI tutorial raises it to `10.0.26100.0` and says a lower value makes Windows ignore the capability. If "Not declared by app" persists with a correct `MaxVersionTested`, raise `MinVersion` too.

### The Limited Access Feature Token for Phi Silica

Phi Silica, the language model behind `LanguageModel`, is a [Limited Access Feature](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.limitedaccessfeatures){:target="_blank" rel="noopener noreferrer"}. Microsoft issues a token and an attestation string (a sentence stating that the app has registered its use of the feature) through a request form. Both are bound to the app's Package Family Name, the identity string Windows derives from the package name and publisher, so each app needs its own. The app unlocks the feature before its first call:

```csharp
using Windows.ApplicationModel;

LimitedAccessFeatureRequestResult access = LimitedAccessFeatures.TryUnlockFeature(
    "com.microsoft.windows.ai.languagemodel",
    token,          // from Microsoft's email
    attestation);   // the full attestation sentence from the same email

bool unlocked = access.Status is LimitedAccessFeatureStatus.Available
                              or LimitedAccessFeatureStatus.AvailableWithoutToken;
```

Without the unlock, calls fail with `E_ACCESSDENIED`. Keep the token out of public repositories. The imaging and OCR APIs need no token, and Aion Instruct, Phi Silica's replacement (covered below), won't need one either.

### Hardware and Region

| API | NPU (Copilot+ PC) | GPU | CPU |
| --- | --- | --- | --- |
| Phi Silica (`LanguageModel`) | Yes | NVIDIA RTX 30 series or AMD RX 9060 series and newer, 6 GB+ VRAM | No |
| Text recognition (OCR) | Yes | No | No |
| Image super resolution, description, segmentation, object erase | Yes | No | No |
| Image generation | Yes, downloaded on demand | No | No |
| Video super resolution, speech recognition | Yes | No | Yes, best with 4+ cores, a 3 GHz base clock, and 32 MB of L3 cache |

Treat the GPU path for Phi Silica as a preview. It currently needs Developer Mode, a Windows Insider Experimental Channel build, an experimental Windows App SDK release, and a GPU driver installed from the manufacturer rather than through Windows Update. Microsoft doesn't support experimental releases in production, and apps built on them can't be published to the Microsoft Store, so an app shipping to customers today can count on Phi Silica only on Copilot+ PCs. On a CPU, `GetReadyState` says only that video super resolution or speech recognition will run, not that it will run fast enough, so Microsoft pairs it with a check against the recommended CPU specification. Phi Silica and image description are also unavailable in China.

---

## Checking Readiness Before Every Feature

Each Windows AI API class exposes the same two static methods. `GetReadyState()` reports whether the model can run on this device right now, and `EnsureReadyAsync()` installs whatever is missing. Microsoft says to call `GetReadyState()` before any call to the model and to branch on its result before showing any UI that depends on the feature. An `ApiInformation.IsTypePresent` check can't substitute for it, because the class comes with the Windows App SDK rather than with the device's AI hardware.

| `AIFeatureReadyState` | Meaning | What the app does |
| --- | --- | --- |
| `Ready` | The model is installed and the device supports it | Call the API |
| `NotReady` | The device supports it, but the model needs downloading or preparing | Ask the user's consent, then call `EnsureReadyAsync` and show progress |
| `DisabledByUser` | The user turned off the AI component in Settings | Explain where to turn it back on, or hide the feature |
| `NotSupportedOnCurrentSystem` | The hardware, drivers, or policy can't run it | Hide the feature or fall back, without calling `EnsureReadyAsync` |

The consent step matters because some models are large. On a Copilot+ PC the Phi Silica model is preinstalled, but on a supported GPU it downloads on the first `EnsureReadyAsync` call. That download is several gigabytes, runs in the background through Windows Update, and can later be removed by the user under **Settings > System > AI Components**, which sends the app back to `NotReady`. Microsoft recommends calling it a "language model" or "optional AI model" in user-facing text rather than "Phi Silica".

```csharp
using Microsoft.Windows.AI;
using Microsoft.Windows.AI.Text;

private async Task<AIFeatureReadyState> PrepareLanguageModelAsync()
{
    AIFeatureReadyState state = LanguageModel.GetReadyState();
    if (state != AIFeatureReadyState.NotReady)
    {
        return state;   // Ready, DisabledByUser, or NotSupportedOnCurrentSystem
    }

    if (!await ConfirmModelDownloadAsync())   // the app's own ContentDialog
    {
        return state;
    }

    var result = await LanguageModel.EnsureReadyAsync();
    if (result.Status != AIFeatureReadyResultState.Success)
    {
        Log(result.ExtendedError);
        return AIFeatureReadyState.NotSupportedOnCurrentSystem;
    }

    return LanguageModel.GetReadyState();
}
```

Readiness is per device and per API class, so a device can be `Ready` for OCR and `NotSupportedOnCurrentSystem` for the language model. For a coarser decision, such as whether to offer an AI settings page at all, `AICapabilities.HasAICapability(AICapabilityCategory.CopilotPlusPC)` in `Microsoft.Windows.AI` reports whether the device is a Copilot+ PC. Run the per-class check before showing a feature's UI, so a device that can't run it never shows a button that can't work.

---

## Generating Text with LanguageModel

`LanguageModel` wraps the on-device language model. `CreateAsync()` loads it, and the object holds native resources that garbage collection alone doesn't reclaim, so Microsoft recommends creating one instance, reusing it across requests, and disposing it when the app is done with it. Output isn't deterministic. Each call uses a new random seed, and the default sampling settings on `LanguageModelOptions` (`Temperature` 0.9, `TopP` 0.9, `TopK` 40) favor variety, so code shouldn't compare response text for exact equality. Lowering `Temperature` and `TopK` narrows the variation when a feature needs consistent output.

### One Prompt, One Response

`GenerateResponseAsync` takes a prompt string and optional `LanguageModelOptions`. The result's `Text` holds the response, but check `Status` first, because a blocked or oversized prompt comes back as a status rather than an exception:

```csharp
using LanguageModel model = await LanguageModel.CreateAsync();

LanguageModelResponseResult result = await model.GenerateResponseAsync(
    "Summarize the following notes in two sentences:\n\n" + notes);

string summary = result.Status == LanguageModelResponseStatus.Complete
    ? result.Text
    : $"No summary ({result.Status})";
```

The status values an app should handle are:

- `PromptLargerThanContext`: the prompt doesn't fit the context window (see below).
- `PromptBlockedByContentModeration` and `ResponseBlockedByContentModeration`: the built-in content filter rejected the input or the output.
- `BlockedByPolicy`: system or user permissions block generative AI.
- `UnsupportedLanguage` and `LanguageMismatch`: the model doesn't handle the language, or the input and output languages differ.
- `IncompatibleLowRankAdapter`: a custom adapter (see LoRA below) doesn't match the installed model.
- `Error`: anything else, with the cause in `ExtendedError`.

Content moderation is on by default at `Medium` severity, and content classified as high severity is always blocked. A `ContentFilterOptions` object from `Microsoft.Windows.AI.ContentSafety`, passed through `LanguageModelOptions.ContentFilterOptions`, adjusts the maximum allowed severity per harm category (hate, sexual, violence, self-harm) for the prompt and the response separately, as described in Microsoft's [content moderation page](https://learn.microsoft.com/en-us/windows/ai/apis/content-moderation){:target="_blank" rel="noopener noreferrer"}.

### A System Prompt and the Context Window

A call without a context is stateless, so the model remembers nothing between calls. `CreateContext(systemPrompt)` returns a `LanguageModelContext`, the model's short-term memory for one conversation, seeded with standing instructions. Pass it to the `GenerateResponseAsync(context, prompt, options)` overload, and each call appends its prompt and response to the context in place. Dispose the context when the conversation ends, and create a new one after a moderation block, because Microsoft leaves the context's state unspecified after one. A small model follows one narrow, explicit instruction more reliably than a prompt that asks it to summarize, translate, and extract in one call, so give each task its own system prompt and chain calls when a feature needs several steps.

The window is small. Microsoft's platform card puts Phi Silica's at about 3.5K tokens, and the best-practices page says the limit can change over time. The system prompt, the accumulated history, and the new prompt all share it, and the API never truncates or summarizes history on its own. `GetUsablePromptLength(context, prompt)` returns the index in the prompt where the remaining window runs out. It's the tool for splitting a long document into pieces that each fit, summarizing each piece, and then summarizing the summaries, and for noticing when a conversation's context is full and needs replacing with a fresh one. On the NPU the model also compresses prompts to fit more into the window. The GPU path doesn't, so a prompt that fits on one device can overflow on another.

### Streaming Tokens into the UI

Every `GenerateResponseAsync` overload returns `IAsyncOperationWithProgress<LanguageModelResponseResult, string>`. Assign a handler to the operation's `Progress` property to receive text as it's generated, then await the operation for the final result. Microsoft's Aion Instruct sample describes each progress string as the newly generated tokens, not the accumulated response, so the handler appends.

```csharp
using LanguageModelContext context = _model.CreateContext(
    "You summarize meeting notes. Reply with at most five bullet points.");

var operation = _model.GenerateResponseAsync(context, transcript, new LanguageModelOptions());

operation.Progress = (_, delta) =>
    DispatcherQueue.TryEnqueue(() => SummaryText.Text += delta);

LanguageModelResponseResult result = await operation;
```

Microsoft's docs don't say which thread raises `Progress`, so the handler dispatches to the window's UI thread before touching the `TextBlock`. Microsoft's platform card notes that streaming runs content checks more often than a single call does, so it trades some throughput for showing text sooner.

### Higher-Level Text APIs

The Windows App SDK layers task-specific APIs over the same model, called Text Intelligence Skills. `TextSummarizer` takes a `LanguageModel` in its constructor and exposes `SummarizeAsync`. Companion skills rewrite text (optionally in a chosen tone) and format a response as a table. Windows App SDK 2.3 added `GenerateStructuredJsonResponseAsync`, which constrains the response to a JSON schema the caller supplies, so an app that parses the model's output no longer has to hope the model followed a format instruction. `GenerateEmbeddingVectors` returns embedding vectors for a string, for local semantic comparison.

---

## Phi Silica Is Being Replaced by Aion Instruct

Microsoft is replacing Phi Silica with a new on-device model, **Aion Instruct**, behind the same API. The published timeline is:

| When | What happens |
| --- | --- |
| Early October 2026 | A standalone sideloadable package for testing and LoRA retraining |
| October 2026 | Rollout to Windows Insider devices, with Phi Silica still present and a registry key for side-by-side testing |
| November 2026 | Rollout to retail devices, and Phi Silica is removed |

Microsoft's preview sample describes the Aion Instruct surface as mirroring `Microsoft.Windows.AI.Text`, so code written against `LanguageModel` should keep compiling, but four things change under it. The model's output changes, so any feature whose prompts were tuned against Phi Silica needs re-evaluating against the new model. The Limited Access Feature token is no longer required. LoRA adapters trained for Phi Silica have to be retrained, and an app should expect an old one to come back as `IncompatibleLowRankAdapter`. And because Windows swaps the model through a staged feature rollout, different users can run different models during the transition, which is one more reason to judge output by `Status` and not assume a particular model's behavior. The [Aion Instruct preview sample](https://github.com/microsoft/Aion-Instruct-Preview-Sample){:target="_blank" rel="noopener noreferrer"} lets a team test early, but for now it runs only on Arm64 Snapdragon Copilot+ PCs and needs a sideloaded framework package.

---

## Adapting the Model with LoRA

A LoRA (low-rank adaptation) adapter is a small add-on to the base model's weights, trained on your own examples, that shifts its output toward a domain or a response style without retraining the model. Training happens in the cloud, through a fine-tuning job that [Microsoft's LoRA workflow](https://learn.microsoft.com/en-us/windows/ai/apis/phi-silica-lora){:target="_blank" rel="noopener noreferrer"} runs from the Foundry Toolkit for Visual Studio Code against an Azure subscription. The result is a `.safetensors` file that the app ships and loads at inference time:

```csharp
LanguageModelLowRankAdapterResult adapterResult =
    LanguageModelLowRankAdapter.CreateFromPath(adapterPath);

if (adapterResult.LowRankAdapter is null)
{
    throw new InvalidOperationException($"Adapter failed to load: {adapterResult.ExtendedError}");
}

var options = new LanguageModelOptions { LowRankAdapter = adapterResult.LowRankAdapter };
LanguageModelResponseResult result = await _model.GenerateResponseAsync(prompt, options);

if (result.Status == LanguageModelResponseStatus.IncompatibleLowRankAdapter)
{
    // The installed model changed; fall back to prompting without the adapter.
}
```

Try better prompts first. An adapter adds a training pipeline, a cloud bill, and a file that has to be retrained whenever Windows changes the base model.

---

## Imaging and Text Recognition

The imaging APIs in `Microsoft.Windows.AI.Imaging` run purpose-built models, one per task, and all of them currently require a Copilot+ PC.

| Class | What it does |
| --- | --- |
| `TextRecognizer` | OCR: lines and words of printed or handwritten text, each word with a bounding quadrilateral and a `MatchConfidence` |
| `ImageDescriptionGenerator` | A natural-language description of an image, in brief, detailed, diagram, or accessibility-oriented form (`ImageDescriptionKind`) |
| `ImageScaler` | Super resolution: enlarges and sharpens an image, up to 8x, capped by `MaxSupportedScaleFactor` |
| `ImageObjectExtractor` | A mask for one object, identified from point or rectangle hints |
| `ImageForegroundExtractor` | A foreground mask for background removal or stickers (experimental channel only, so not yet for Store apps) |
| `ImageObjectRemover` | Erases an object and fills the area from the surrounding background |

`TextRecognizer` and `ImageDescriptionGenerator` accept only a `Microsoft.Graphics.Imaging.ImageBuffer`, so an app converts its `SoftwareBitmap` with `ImageBuffer.CreateForSoftwareBitmap`. The others also have `SoftwareBitmap` overloads. Each class follows the readiness pattern above before `CreateAsync`.

```csharp
using System.Text;
using System.Threading.Tasks;
using Microsoft.Graphics.Imaging;
using Microsoft.Windows.AI.Imaging;
using Windows.Graphics.Imaging;

public async Task<string> ReadTextAsync(SoftwareBitmap bitmap)
{
    using TextRecognizer recognizer = await TextRecognizer.CreateAsync();
    RecognizedText recognized = await recognizer.RecognizeTextFromImageAsync(
        ImageBuffer.CreateForSoftwareBitmap(bitmap));

    var text = new StringBuilder();
    foreach (RecognizedLine line in recognized.Lines)
    {
        text.AppendLine(line.Text);
    }
    return text.ToString();
}
```

Confidence lives on words, not lines, so an app that highlights uncertain text walks `line.Words` and checks each word's `MatchConfidence`. Microsoft positions `TextRecognizer` as faster and more accurate than the older `Windows.Media.Ocr.OcrEngine`. `OcrEngine` has no NPU requirement, which makes it the fallback for OCR on other hardware, but `OcrEngine.TryCreateFromUserProfileLanguages()` returns `null` when no OCR language pack is installed, so that path needs its own check.

Image descriptions come from a model and can be wrong. Microsoft advises against using them where an inaccurate description could be controversial (flags, maps, religious symbols) or where accuracy is critical (medical, legal, or financial documents). For generated or modified images, Microsoft recommends attaching Content Credentials, the provenance metadata defined by the C2PA standard, so viewers can see where an image came from and how it was changed.

---

## Falling Back Across Tiers

A feature that uses the Windows AI APIs has to decide what happens on PCs that can't run them. The usual answer is Microsoft's three-tier chain, with each tier behind one interface the rest of the app calls, so a view model asks for a summary and doesn't know which tier produced it:

```csharp
public async Task<string> SummarizeAsync(string text, CancellationToken ct)
{
    if (await PrepareLanguageModelAsync() == AIFeatureReadyState.Ready)
    {
        return await _windowsAi.SummarizeAsync(text, ct);      // on-device, built into Windows
    }

    if (await _foundryLocal.IsModelReadyAsync(ct))
    {
        return await _foundryLocal.SummarizeAsync(text, ct);   // on-device, app-chosen model
    }

    if (_settings.AllowCloudProcessing)
    {
        return await _cloud.SummarizeAsync(text, ct);          // leaves the device
    }

    throw new FeatureUnavailableException("Summaries need a supported PC or cloud processing.");
}
```

The chain moves to the next tier only when a tier can't run. A tier that runs and returns a moderation block or an oversized-prompt status reports that to the user instead, because another model given the same input isn't the fix.

[Foundry Local](https://learn.microsoft.com/en-us/windows/ai/foundry-local/get-started){:target="_blank" rel="noopener noreferrer"} runs in the app's process through the `Microsoft.AI.Foundry.Local.WinML` NuGet package, with no token and no separate server. The app looks a model up in the catalog by alias, downloads it on first use (with the same consent obligation as a Windows model download), loads it, and gets a chat client that supports streaming. The catalog picks the variant that matches the device, such as an NPU build on Snapdragon, a CUDA build on NVIDIA, or a CPU build elsewhere. Foundry Local needs Windows 11 24H2 and .NET 9 or later. For the cloud tier, [`Microsoft.Extensions.AI`](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai){:target="_blank" rel="noopener noreferrer"} defines `IChatClient`, a provider-neutral chat interface with implementations such as the `Microsoft.Extensions.AI.OpenAI` package, which keeps provider-specific code in one place.

Foundry Local's catalog holds language and speech models, so imaging has no Foundry Local tier. Outside a Copilot+ PC, the options are `OcrEngine` for text recognition, [Windows ML](https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/overview){:target="_blank" rel="noopener noreferrer"} running an ONNX model the app ships or downloads (a segmentation or super-resolution model, for example), or a cloud vision service. Windows ML is a Windows-maintained copy of ONNX Runtime, so existing ONNX Runtime code carries over, and Windows downloads the execution provider that matches the device's GPU or NPU instead of the app bundling one per vendor.

The cloud tier changes what the app can promise. On-device processing lets the app say that data stays on the machine. Once a request can reach the cloud, the app has to disclose that, and a setting that lets the user refuse it (the `AllowCloudProcessing` check above) turns that disclosure into a choice. Latency varies too. Microsoft describes the GPU path as slower and more power-hungry than the NPU, so measure response times on the hardware your users have, stream long responses, and give slow operations a timeout that leads to the next tier.
