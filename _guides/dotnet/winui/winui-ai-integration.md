---
title: "Windows AI Integration"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Integrating on-device AI capabilities into WinUI 3 applications using Phi Silica, Windows AI APIs for image and text processing, and local model inference on Copilot+ PCs."
tags: [winui, winui-3, ai, machine-learning, phi-silica, windows-ai, desktop, advanced]
---

## The Windows AI Landscape

The AI integration story for WinUI 3 applications has two distinct tracks: on-device inference running directly on the local machine, and cloud-based inference through services like Azure OpenAI. These are not mutually exclusive. Most production applications will eventually use both, routing requests to whichever option is more appropriate given the constraints of a particular operation.

On-device AI became a serious option with the introduction of Copilot+ PCs in 2024. These machines include a dedicated Neural Processing Unit (NPU) with at least 40 TOPS of compute, which enables running small language models and computer vision tasks at low latency without a network round-trip. Microsoft has built a set of Windows AI APIs on top of this hardware, shipping models and inference engines as part of the OS rather than requiring applications to bundle them independently.

The practical advantages of on-device inference are meaningful. Requests never leave the device, which matters for applications processing sensitive documents, financial data, or personal communications. Latency is bounded and predictable: there is no network jitter, no cold-start delay from spinning up a cloud VM, and no dependency on whether the user has a reliable internet connection. For features like real-time text summarization, image description, or intelligent autocomplete, sub-second local responses create a qualitatively different user experience compared to waiting 2-4 seconds for a cloud round-trip.

The trade-off is capability. On-device models are smaller than their cloud counterparts by necessity, and they handle complex multi-step reasoning or domain-specific knowledge less reliably. A strategy that uses on-device AI for fast, local tasks and cloud AI for tasks requiring deeper understanding gives you the best of both.

---

## Phi Silica and the LanguageModel API

[Phi Silica](https://learn.microsoft.com/en-us/windows/ai/apis/phi-silica){:target="_blank" rel="noopener noreferrer"} is Microsoft's on-device Small Language Model (SLM) optimized for the NPU found in Copilot+ PCs. It ships as part of Windows and is accessible through the `Microsoft.Windows.AI.Generative` namespace. Because the model is bundled with the OS, your application does not need to download or manage model weights. You reference the Windows App SDK, call the API, and Windows handles the rest.

Before using Phi Silica, you must check whether the current device supports it. The `LanguageModel` class exposes an `IsAvailable()` method for this purpose, and you can call `MakeAvailableAsync()` to trigger a download if the model is not yet present on the machine.

```csharp
using Microsoft.Windows.AI.Generative;

// Check availability before attempting to use
if (!LanguageModel.IsAvailable())
{
    var operation = await LanguageModel.MakeAvailableAsync();
    if (operation.Status != PackageDeploymentStatus.CompletedSuccess)
    {
        // Handle unavailability gracefully
        return;
    }
}

await using var model = await LanguageModel.CreateAsync();
```

Once you have a `LanguageModel` instance, generating text is straightforward. The API supports both prompt-only generation and structured context-based generation with a system prompt.

```csharp
// Simple text generation
var result = await model.GenerateResponseAsync("Summarize the following in two sentences: " + documentText);
string summary = result.Response;

// Generation with a system prompt for more controlled output
var context = model.CreateContext("You are a helpful assistant that summarizes meeting notes concisely.");
var response = await model.GenerateResponseAsync(context, meetingTranscript);
```

For longer documents or real-time feedback, streaming generation is preferable. Rather than waiting for the entire response, you receive tokens as they are generated and update the UI incrementally.

```csharp
var contentBuilder = new StringBuilder();

await foreach (var partialResult in model.GenerateResponseWithProgressAsync(context, inputText))
{
    contentBuilder.Append(partialResult.Response);

    // Marshal to the UI thread for each chunk
    DispatcherQueue.TryEnqueue(() =>
    {
        SummaryTextBlock.Text = contentBuilder.ToString();
    });
}
```

---

## Prompt Engineering for Local Models

Phi Silica is a capable model, but it is smaller than GPT-4 or Claude, which means prompts need to be more explicit about format and scope. A few practices improve output quality substantially.

Be specific about the output format you want. Rather than asking the model to "summarize this," ask it to "write a two-sentence summary in plain language, suitable for someone unfamiliar with the topic." The model will follow format instructions more reliably when they are concrete.

Keep prompts focused. Local models degrade more noticeably than large cloud models when asked to juggle multiple tasks in one prompt. Asking the model to simultaneously summarize, translate, and extract action items in a single call will produce less reliable results than chaining three separate, focused prompts.

Use the system prompt to establish consistent behavior across calls. A system prompt like "You are an assistant that extracts action items from meeting notes. Respond only with a numbered list of action items. Do not include any other text." creates a reliable contract that the model will generally honor across multiple invocations.

---

## Windows AI APIs for Image and Text Processing

Beyond Phi Silica, Windows ships a set of specialized AI APIs for computer vision and text extraction tasks. These are faster and more reliable than general-purpose language model inference for their specific domains, because they run purpose-built models optimized for each task.

[ImageDescriptionGenerator](https://learn.microsoft.com/en-us/windows/ai/apis/image-description){:target="_blank" rel="noopener noreferrer"} generates natural language descriptions of images, which is useful for accessibility features, image cataloging, and search indexing.

```csharp
using Microsoft.Windows.Vision;

var generator = await ImageDescriptionGenerator.CreateAsync();
var imageFile = await StorageFile.GetFileFromPathAsync(imagePath);

using var stream = await imageFile.OpenReadAsync();
var softwareBitmap = await BitmapDecoder.CreateAsync(stream)
    .ContinueWith(async t => await t.Result.GetSoftwareBitmapAsync())
    .Unwrap();

var description = await generator.DescribeAsync(softwareBitmap, ImageDescriptionScenario.Caption);
Console.WriteLine(description.Description);
```

[TextRecognizer](https://learn.microsoft.com/en-us/windows/ai/apis/ocr){:target="_blank" rel="noopener noreferrer"} performs OCR on images, extracting text with bounding box information. This replaces the older `Windows.Media.Ocr` API with a model-based approach that handles more document layouts and handwriting styles.

```csharp
using Microsoft.Windows.Vision;

var recognizer = await TextRecognizer.CreateAsync();
var result = await recognizer.RecognizeTextFromSoftwareBitmapAsync(softwareBitmap);

foreach (var line in result.Lines)
{
    Debug.WriteLine($"Text: {line.Text}, Confidence: {line.Confidence}");
}
```

[ImageScaler](https://learn.microsoft.com/en-us/windows/ai/apis/super-resolution){:target="_blank" rel="noopener noreferrer"} provides AI-based image upscaling (super resolution), producing sharper results than bicubic interpolation when enlarging images. This is useful for thumbnail expansion, low-resolution image enhancement, or preparing images for printing.

[ImageObjectExtractor](https://learn.microsoft.com/en-us/windows/ai/apis/image-segmentation){:target="_blank" rel="noopener noreferrer"} performs image segmentation, isolating objects from backgrounds. Applications can use this for background removal tools, object-focused cropping, or building image editing features without writing any computer vision code.

---

## Hardware Requirements and Availability Checks

All Windows AI APIs that run on the NPU require a Copilot+ PC. For applications that need to run on a broader range of hardware, checking availability at runtime and providing appropriate fallback behavior is not optional.

The `ApiInformation` class from the Windows SDK lets you check whether a type is available before attempting to use it. This prevents crashes on machines where the required APIs do not exist.

```csharp
using Windows.Foundation.Metadata;

bool isLanguageModelAvailable = ApiInformation.IsTypePresent(
    "Microsoft.Windows.AI.Generative.LanguageModel");

if (isLanguageModelAvailable && LanguageModel.IsAvailable())
{
    // Use on-device Phi Silica
    await RunLocalSummaryAsync(text);
}
else
{
    // Fall back to cloud-based inference
    await RunCloudSummaryAsync(text);
}
```

A well-designed AI feature degrades gracefully. If the hardware does not support local inference, the feature either routes to the cloud or disables itself cleanly with a user-facing explanation. Crashing or silently returning empty results is not acceptable. Building the fallback path from the beginning rather than treating it as a future concern saves considerable rework later.

---

## LoRA Fine-Tuning for Domain-Specific Use Cases

The Windows AI platform includes experimental support for LoRA (Low-Rank Adaptation) fine-tuning, which allows you to customize the behavior of the base Phi Silica model for a specific domain without retraining the entire model. LoRA adapters are small files (typically a few megabytes) that modify the model's weights for a particular task or vocabulary domain.

This is an experimental feature and the API surface is subject to change, but the general approach involves loading a LoRA adapter alongside the base model. The primary use case is improving model accuracy for domain-specific terminology, such as legal documents, medical records, or technical specifications, where the base model's general training may produce imprecise outputs.

Check the [Windows App SDK release notes](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes-archive){:target="_blank" rel="noopener noreferrer"} for the current stability status of LoRA APIs before depending on them in production applications.

---

## Integrating Cloud AI Services

On-device AI and cloud AI complement each other. The right pattern is to use on-device inference for tasks where privacy, latency, or offline capability matter, and cloud inference for tasks that require deeper reasoning, larger context windows, or more up-to-date knowledge.

[Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/overview/){:target="_blank" rel="noopener noreferrer"} is Microsoft's orchestration library for AI applications, and it supports both local and cloud-based model backends through a common abstraction. This makes it straightforward to write AI-enabled features without hard-coding a dependency on a specific provider.

{% raw %}
```csharp
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;

// Configure the kernel with Azure OpenAI
var kernel = Kernel.CreateBuilder()
    .AddAzureOpenAIChatCompletion(
        deploymentName: "gpt-4o",
        endpoint: configuration["AzureOpenAI:Endpoint"],
        apiKey: configuration["AzureOpenAI:ApiKey"])
    .Build();

// Define a prompt function
var summarizeFunction = kernel.CreateFunctionFromPrompt(
    "Summarize the following document in three bullet points:\n\n{{$input}}");

var result = await kernel.InvokeAsync(summarizeFunction,
    new KernelArguments { ["input"] = documentText });

string summary = result.GetValue<string>();
```
{% endraw %}

Semantic Kernel also supports plugging in local model connectors, so the same kernel configuration can route requests to Phi Silica for light tasks and Azure OpenAI for heavy ones, based on the requirements of each prompt.

For applications that need to process large volumes of documents or perform complex multi-step reasoning chains, [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/overview){:target="_blank" rel="noopener noreferrer"} provides GPT-4o and o-series models with higher capability ceilings than any local model. The cloud path requires network access and introduces latency, but for batch processing or infrequent deep-analysis tasks, the trade-off is acceptable.

---

## Practical Considerations

**Model size and cold-start behavior**: Phi Silica loads from disk the first time it is used in a session. On fast NVMe storage this is typically under a second, but on slower drives or constrained systems it can take 2-3 seconds. Warming the model during application startup rather than on the user's first AI request avoids a visible delay.

**Context window limits**: Phi Silica has a limited context window compared to cloud models. For very long documents, you need a chunking strategy that breaks input into segments, summarizes each segment independently, and then combines the summaries. This "map-reduce" pattern is a common workaround for local model context limits.

**Latency expectations**: On a Copilot+ PC with a current-generation NPU, Phi Silica generates text at roughly 15-30 tokens per second. A two-sentence summary of a 500-word document typically completes in under two seconds. Tasks requiring longer outputs benefit from streaming to avoid the user perceiving a blank wait period.

**Thread safety**: `LanguageModel` instances are not thread-safe for concurrent requests. For applications that might issue multiple AI requests simultaneously, maintain a queue or use a semaphore to serialize access.

**Fallback strategies**: Define clear criteria for when your application falls back from on-device to cloud inference. Reasonable triggers include the device not meeting hardware requirements, the Windows AI model not being installed, and a user preference setting in the application's options. Document these criteria in the application so support teams understand the routing logic.

```csharp
public async Task<string> SummarizeAsync(string text)
{
    if (_localModelAvailable)
    {
        try
        {
            return await SummarizeLocallyAsync(text);
        }
        catch (Exception ex) when (IsTransientLocalError(ex))
        {
            // Log and fall through to cloud
        }
    }

    return await SummarizeWithCloudAsync(text);
}
```

**Privacy disclosure**: When using cloud AI services, inform users that their data is leaving the device. When using on-device AI exclusively, you can make a privacy-forward claim that data never leaves the machine. Many users actively value this distinction, and surfacing it in the application's UI can be a competitive differentiator.
