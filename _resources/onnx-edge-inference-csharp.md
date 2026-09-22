---
title: "ONNX Runtime Edge Inference in C#"
layout: resource
type: code
category: "IoT"
description: "C# building blocks for running ONNX models on edge devices with the OrtValue API: session setup, input-shape validation, sensor-window anomaly scoring with a ring buffer, image preprocessing, a background inspection loop, and selective feedback upload."
last_updated: 2026-09-22
tags: [onnx, onnx-runtime, edge-inference, csharp, anomaly-detection]
related_guides:
  - /study-guides/iot/ml-at-the-edge.html
---

Written against the `Microsoft.ML.OnnxRuntime` package (1.30). The samples use the `OrtValue` API rather than the older `NamedOnnxValue` overloads, because an `OrtValue` wraps a managed array without copying it and can reuse the same buffer across calls. Model paths, input names, and thresholds are placeholders.

## Packages

| Package | Execution provider | Native binaries shipped for |
|---|---|---|
| `Microsoft.ML.OnnxRuntime` | CPU | Windows and Linux on x64 and ARM64, macOS on ARM64, Android, and iOS |
| `Microsoft.ML.OnnxRuntime.Gpu` | CUDA and TensorRT | Windows x64 and Linux x64 only |
| `Microsoft.ML.OnnxRuntime.DirectML` | DirectML | Windows; DirectML is in sustained engineering, with new work moving to Windows ML |

The GPU package has no ARM64 build, so it does not run on an NVIDIA Jetson. On Jetson, build ONNX Runtime from source with CUDA and TensorRT against the board's JetPack versions (see the ONNX Runtime [build instructions](https://onnxruntime.ai/docs/build/eps.html){:target="_blank" rel="noopener noreferrer"}) and reference the managed `Microsoft.ML.OnnxRuntime.Managed` package with the native library you built.

## Session setup

Create one session at startup and reuse it for every inference call. Appending the CUDA provider throws if its native library cannot be loaded, so guard it rather than letting a CPU-only device crash on startup.

```csharp
using Microsoft.ML.OnnxRuntime;

public static class OnnxSessionFactory
{
    public static InferenceSession Create(string modelPath, bool preferCuda)
    {
        using var options = new SessionOptions
        {
            // Rewrite and fuse graph operations once, at load time
            GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,

            // Leave CPU for the rest of the device's workload
            IntraOpNumThreads = 2,
            InterOpNumThreads = 1
        };

        if (preferCuda)
        {
            try
            {
                options.AppendExecutionProvider_CUDA(deviceId: 0);
            }
            catch (OnnxRuntimeException)
            {
                // CUDA provider not available on this device; fall back to CPU
            }
        }

        return new InferenceSession(modelPath, options);
    }
}
```

Operators the CUDA provider does not support still run, on the CPU provider, without an error. Profile on the target device to see where the time goes.

## Inspecting a model's inputs

Dynamic dimensions (usually the batch) report as `-1`. Log this once when a new model version loads, so a shape change shows up in device logs before it shows up as an inference exception.

```csharp
foreach (var (name, meta) in session.InputMetadata)
{
    Console.WriteLine(
        $"Input {name}: {meta.ElementDataType} [{string.Join(", ", meta.Dimensions)}]");
}

foreach (var (name, meta) in session.OutputMetadata)
{
    Console.WriteLine(
        $"Output {name}: {meta.ElementDataType} [{string.Join(", ", meta.Dimensions)}]");
}
```

## Anomaly detector

Scores one fixed-length window of sensor readings. The window size comes from the model's declared input shape, and the constructor rejects a model whose shape does not match what the detector feeds it. The detector takes ownership of the session. `CreateTensorValueFromMemory` pins the managed array for the lifetime of the `OrtValue` instead of copying it.

```csharp
using Microsoft.ML.OnnxRuntime;

public sealed class AnomalyDetector : IDisposable
{
    private readonly InferenceSession _session;
    private readonly RunOptions _runOptions = new();
    private readonly string[] _inputNames;
    private readonly string[] _outputNames;

    public int WindowSize { get; }

    public AnomalyDetector(InferenceSession session)
    {
        _session = session;

        var (inputName, input) = session.InputMetadata.Single();
        int[] dims = input.Dimensions; // expected [batch, window], batch usually -1

        if (dims.Length != 2 || dims[1] <= 0)
        {
            throw new InvalidOperationException(
                $"Expected input shape [batch, window], got [{string.Join(", ", dims)}]");
        }

        WindowSize = dims[1];
        _inputNames = new[] { inputName };
        _outputNames = new[] { session.OutputMetadata.Keys.First() };
    }

    // Returns the model's anomaly probability for the window, between 0 and 1
    public float Score(float[] window)
    {
        if (window.Length != WindowSize)
        {
            throw new ArgumentException(
                $"Expected {WindowSize} readings, got {window.Length}", nameof(window));
        }

        using var input = OrtValue.CreateTensorValueFromMemory(window, new long[] { 1, WindowSize });
        using var outputs = _session.Run(_runOptions, _inputNames, new[] { input }, _outputNames);

        return outputs.First().GetTensorDataAsSpan<float>()[0];
    }

    public void Dispose()
    {
        _runOptions.Dispose();
        _session.Dispose();
    }
}
```

## Sliding window over a sensor stream

A ring buffer holds the most recent readings, and one reusable array receives them in chronological order for each score. No allocation happens per reading, which matters at hundreds of readings per second on a small device. The `stride` sets how many new readings arrive between scores.

```csharp
public sealed class SlidingWindowScorer
{
    private readonly AnomalyDetector _detector;
    private readonly float[] _ring;
    private readonly float[] _window;
    private readonly int _stride;
    private int _head;
    private int _count;
    private int _sinceLastScore;

    public SlidingWindowScorer(AnomalyDetector detector, int stride = 1)
    {
        _detector = detector;
        _ring = new float[detector.WindowSize];
        _window = new float[detector.WindowSize];
        _stride = stride;
        _sinceLastScore = stride - 1; // score as soon as the first window fills
    }

    // Returns a score when a full window is due, otherwise null
    public float? Add(float reading)
    {
        _ring[_head] = reading;
        _head = (_head + 1) % _ring.Length;
        if (_count < _ring.Length) _count++;

        if (_count < _ring.Length || ++_sinceLastScore < _stride) return null;
        _sinceLastScore = 0;

        // _head now points at the oldest reading; copy in two contiguous spans
        int tail = _ring.Length - _head;
        Array.Copy(_ring, _head, _window, 0, tail);
        Array.Copy(_ring, 0, _window, tail, _head);

        return _detector.Score(_window);
    }
}
```

Calling it from an async sensor stream:

```csharp
// The detector owns the session and disposes it
var session = OnnxSessionFactory.Create("/models/vibration-anomaly.onnx", preferCuda: false);
using var detector = new AnomalyDetector(session);
var scorer = new SlidingWindowScorer(detector, stride: 10);

await foreach (var reading in sensorStream.WithCancellation(stoppingToken))
{
    if (scorer.Add(reading) is float score && score > 0.85f)
    {
        await alertService.SendAlertAsync($"Anomaly detected: score={score:F3}", stoppingToken);
    }
}
```

## Image preprocessing for a vision model

Converts interleaved 8-bit RGB pixels to the planar, normalized float layout (`[1, 3, height, width]`) most ImageNet-trained vision models expect. The mean and standard deviation constants must be the ones used in training. If the model was trained with different normalization, or expects BGR channel order, the output is wrong with no error, so treat these constants as part of the model version.

```csharp
using Microsoft.ML.OnnxRuntime;

public sealed class QualityInspector : IDisposable
{
    // ImageNet normalization; replace with the values the model was trained with
    private static readonly float[] Mean = { 0.485f, 0.456f, 0.406f };
    private static readonly float[] Std = { 0.229f, 0.224f, 0.225f };

    private readonly InferenceSession _session;
    private readonly RunOptions _runOptions = new();
    private readonly string[] _inputNames;
    private readonly string[] _outputNames;
    private readonly string[] _labels;
    private readonly int _height;
    private readonly int _width;
    private readonly float[] _tensorData;

    public QualityInspector(InferenceSession session, string[] labels)
    {
        _session = session;
        _labels = labels;

        var (inputName, input) = session.InputMetadata.Single();
        int[] dims = input.Dimensions; // expected [batch, 3, height, width]

        if (dims.Length != 4 || dims[1] != 3 || dims[2] <= 0 || dims[3] <= 0)
        {
            throw new InvalidOperationException(
                $"Expected input shape [batch, 3, height, width], got [{string.Join(", ", dims)}]");
        }

        _height = dims[2];
        _width = dims[3];
        _tensorData = new float[3 * _height * _width];
        _inputNames = new[] { inputName };
        _outputNames = new[] { session.OutputMetadata.Keys.First() };
    }

    // rgbPixels must already be resized to the model's input size
    public string Classify(ReadOnlySpan<byte> rgbPixels, int width, int height)
    {
        if (width != _width || height != _height || rgbPixels.Length != 3 * width * height)
        {
            throw new ArgumentException(
                $"Expected a {_width}x{_height} RGB frame, got {width}x{height} with {rgbPixels.Length} bytes");
        }

        int pixelCount = width * height;
        for (int i = 0; i < pixelCount; i++)
        {
            _tensorData[i]                  = (rgbPixels[i * 3]     / 255f - Mean[0]) / Std[0]; // R plane
            _tensorData[i + pixelCount]     = (rgbPixels[i * 3 + 1] / 255f - Mean[1]) / Std[1]; // G plane
            _tensorData[i + 2 * pixelCount] = (rgbPixels[i * 3 + 2] / 255f - Mean[2]) / Std[2]; // B plane
        }

        using var input = OrtValue.CreateTensorValueFromMemory(
            _tensorData, new long[] { 1, 3, _height, _width });
        using var outputs = _session.Run(_runOptions, _inputNames, new[] { input }, _outputNames);

        ReadOnlySpan<float> scores = outputs.First().GetTensorDataAsSpan<float>();

        int best = 0;
        for (int i = 1; i < scores.Length; i++)
        {
            if (scores[i] > scores[best]) best = i;
        }

        return _labels[best];
    }

    public void Dispose()
    {
        _runOptions.Dispose();
        _session.Dispose();
    }
}
```

The reused `_tensorData` buffer makes an instance unsafe to call from more than one thread at a time. Run one inspector per camera loop.

## Inspection loop as a background service

Runs the camera loop on the .NET generic host so it starts and stops with the application. A failed frame is logged and skipped rather than ending the loop. `ICamera` and `IAlertService` stand in for the device's own acquisition and alerting code.

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public interface ICamera
{
    IAsyncEnumerable<CameraFrame> GetFramesAsync(CancellationToken cancellationToken);
}

public sealed record CameraFrame(byte[] RgbPixels, int Width, int Height, DateTimeOffset CapturedAt);

public interface IAlertService
{
    Task SendAlertAsync(string message, CancellationToken cancellationToken);
}

public sealed class InspectionService : BackgroundService
{
    private readonly QualityInspector _inspector;
    private readonly ICamera _camera;
    private readonly IAlertService _alerts;
    private readonly ILogger<InspectionService> _logger;

    public InspectionService(
        QualityInspector inspector,
        ICamera camera,
        IAlertService alerts,
        ILogger<InspectionService> logger)
    {
        _inspector = inspector;
        _camera = camera;
        _alerts = alerts;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var frame in _camera.GetFramesAsync(stoppingToken))
        {
            try
            {
                string label = _inspector.Classify(frame.RgbPixels, frame.Width, frame.Height);
                if (label == "FAIL")
                {
                    await _alerts.SendAlertAsync(
                        $"Quality FAIL on frame captured {frame.CapturedAt:O}", stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Inspection failed for frame captured {CapturedAt}", frame.CapturedAt);
            }
        }
    }
}
```

## Selective feedback upload

Uploads the window behind a decision only when the model was uncertain, when it raised an alert, or for a small random share of confident decisions, so the training set is not limited to cases the model already found hard. Each sample carries the device and model version so it can be traced later. The example writes to Azure Blob Storage through `Azure.Storage.Blobs`; any object store with an equivalent client works the same way.

```csharp
using System.Text.Json;
using Azure.Storage.Blobs;

public sealed class FeedbackUploader
{
    private const float UncertainLow = 0.4f;
    private const float UncertainHigh = 0.7f;
    private const float AlertThreshold = 0.85f;
    private const double ConfidentSampleRate = 0.001;

    private readonly BlobContainerClient _container;
    private readonly string _deviceId;
    private readonly string _modelVersion;

    public FeedbackUploader(BlobContainerClient container, string deviceId, string modelVersion)
    {
        _container = container;
        _deviceId = deviceId;
        _modelVersion = modelVersion;
    }

    public async Task UploadIfSelectedAsync(float[] window, float score, CancellationToken cancellationToken)
    {
        bool uncertain = score is > UncertainLow and < UncertainHigh;
        bool alert = score >= AlertThreshold;
        bool randomSample = Random.Shared.NextDouble() < ConfidentSampleRate;

        if (!uncertain && !alert && !randomSample) return;

        var capturedAt = DateTimeOffset.UtcNow;
        string blobName = $"{_deviceId}/{capturedAt:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.json";

        var payload = JsonSerializer.Serialize(new
        {
            DeviceId = _deviceId,
            ModelVersion = _modelVersion,
            CapturedAt = capturedAt,
            Score = score,
            Reason = alert ? "alert" : uncertain ? "uncertain" : "random",
            Window = window
        });

        await _container.UploadBlobAsync(blobName, BinaryData.FromString(payload), cancellationToken);
    }
}
```

On an intermittently connected device, write selected samples to local storage first and upload them from a separate loop, so an outage delays the upload instead of losing the sample or blocking inference.
