---
title: "Machine Learning at the Edge"
layout: guide
category: IoT
subcategory: Advanced IoT
description: "Running ML inference on IoT edge devices with ONNX Runtime and .NET, covering model optimization, deployment patterns, anomaly detection, computer vision, and the cloud-to-edge ML lifecycle."
tags: [iot, edge-computing, architecture, dotnet, practical, real-time, advanced]
---

## Why Run ML at the Edge

Most ML discussions assume unlimited compute and a stable internet connection. IoT devices live in a different world. A vibration sensor on a factory floor generates thousands of readings per second, and shipping all of that to the cloud for inference adds latency, consumes bandwidth, and costs money. When the machine is about to fail, waiting 200ms for a round-trip to Azure is too long.

Running ML inference directly on the edge device solves four distinct problems. Latency is the most obvious: a model running locally can respond in milliseconds rather than waiting for a network round-trip. Bandwidth becomes a constraint at scale, and a fleet of 10,000 sensors each streaming raw data would saturate network infrastructure that never needed to be that large. Privacy matters for scenarios involving camera feeds, biometric sensors, or medical devices where regulation or user trust requires that sensitive data never leaves the device. Offline operation is often a hard requirement in manufacturing plants, mining sites, and agricultural environments where reliable connectivity is not guaranteed.

These four drivers (latency, bandwidth, privacy, and offline capability) shape every architectural decision about edge ML. They explain why even organizations with ample cloud capacity choose to run inference locally.

Not all decisions are binary. A common hybrid pattern runs a lightweight anomaly detection model at the edge to catch clear-cut cases, while forwarding ambiguous readings to a larger cloud model for deeper analysis. The edge model handles the 95% of readings that are clearly normal or clearly anomalous with sub-millisecond latency. The cloud model handles the uncertain 5%, where the additional compute and model complexity are worth the network round-trip. This approach reduces cloud costs compared to streaming everything while maintaining higher accuracy on difficult cases than a small edge model alone can achieve.

| Approach | Latency | Bandwidth | Accuracy | Cost |
|---|---|---|---|---|
| Cloud inference only | High (100ms+) | High (full sensor data) | Highest (large models) | High compute + egress |
| Edge inference only | Low (sub-ms) | Low (results only) | Limited (small models) | Device hardware only |
| Hybrid (edge + cloud fallback) | Low for clear cases | Medium (uncertain samples only) | High overall | Moderate |

---

## The Standard ML Lifecycle for IoT

The phrase "ML at the edge" can create the impression that the edge device does everything. In practice, the work is divided between the cloud and the edge in a specific way: the cloud handles the computationally expensive parts, and the edge handles real-time inference.

Training a model requires large datasets, GPU compute, and iterative experimentation. These conditions exist in the cloud, not on a Raspberry Pi. A data scientist working in [Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/overview-what-is-azure-machine-learning){:target="_blank" rel="noopener noreferrer"} trains a model against historical sensor data, evaluates it, and refines it. Once the model meets quality thresholds, it gets exported to a portable format and packaged for deployment.

The edge device runs the trained model without further training. It receives sensor readings as input, passes them through the model, and acts on the output. The model itself is a static artifact on the device until a new version is deployed. This separation keeps the edge device simple and predictable while preserving the ability to improve the model over time.

The lifecycle looks like this:

1. **Collect data** from edge devices (raw sensor readings, images, operational data)
2. **Label and prepare** that data in the cloud
3. **Train** a model in Azure Machine Learning or similar
4. **Evaluate** the model against held-out test data
5. **Export** the model to ONNX or another edge-compatible format
6. **Package** the model as an Azure IoT Edge module or embedded file
7. **Deploy** to edge devices over the air
8. **Run inference** locally on the device
9. **Collect inference results and edge samples** to feed back into the next training cycle

Steps 1 through 7 happen in the cloud or a developer environment. Steps 8 and 9 happen on the device. The feedback loop in step 9 is what makes the system self-improving over time.

---

## ONNX Runtime

[ONNX](https://onnx.ai){:target="_blank" rel="noopener noreferrer"} (Open Neural Network Exchange) is an open format for representing ML models. A model trained in PyTorch, TensorFlow, or Azure Machine Learning can be exported to ONNX format and then run on any platform that supports the ONNX Runtime inference engine. For .NET developers, this is the primary path to running ML models without requiring Python or a framework-specific runtime.

[ONNX Runtime](https://onnxruntime.ai){:target="_blank" rel="noopener noreferrer"} is the cross-platform inference engine maintained by Microsoft. It is designed to be lightweight, fast, and hardware-agnostic. On a device with a neural accelerator or GPU, ONNX Runtime can target that hardware through execution providers. On constrained hardware without acceleration, it falls back to optimized CPU execution.

### .NET Integration

The `Microsoft.ML.OnnxRuntime` NuGet package provides managed bindings for ONNX Runtime. A device running .NET on Linux or Windows can load an ONNX model file and run inference entirely in managed code, with no Python runtime or native framework required. This makes it practical to embed ML inference directly in a .NET IoT application alongside the rest of the device logic.

The base package targets CPU inference. Additional packages enable hardware-accelerated execution providers:

| NuGet Package | Execution Provider | Target Hardware |
|---|---|---|
| `Microsoft.ML.OnnxRuntime` | CPU (default) | Any CPU |
| `Microsoft.ML.OnnxRuntime.Gpu` | CUDA | NVIDIA GPU |
| `Microsoft.ML.OnnxRuntime.DirectML` | DirectML | Windows GPU (any vendor) |

For most IoT edge devices running Linux (Raspberry Pi, Jetson, industrial PCs), the base CPU package is the correct starting point. NVIDIA Jetson devices can use the CUDA package through ONNX Runtime's Linux ARM64 CUDA builds, though this requires careful version alignment between the CUDA toolkit on the device and the package version.

`SessionOptions` lets you configure runtime behavior, including enabling hardware execution providers and controlling threading:

```csharp
var options = new SessionOptions();

// For NVIDIA Jetson or other CUDA devices
options.AppendExecutionProvider_CUDA(deviceId: 0);

// Limit CPU threads on a resource-constrained device
options.IntraOpNumThreads = 2;
options.InterOpNumThreads = 1;

// Enable graph optimization (recommended for production)
options.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;

var session = new InferenceSession("/models/anomaly-detector.onnx", options);
```

Graph optimization rewrites the computation graph to eliminate redundant operations and fuse adjacent operations into single kernel calls. On a constrained CPU, this can meaningfully reduce inference time with no changes to the model file itself.

```csharp
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

// Load the model once at startup; keep the session alive for the device lifetime
var session = new InferenceSession("/models/anomaly-detector.onnx");

// Inspect expected inputs
foreach (var input in session.InputMetadata)
{
    Console.WriteLine($"Input: {input.Key}, Shape: [{string.Join(", ", input.Value.Dimensions)}]");
}
```

The `InferenceSession` loads the model from disk and compiles it for the current hardware. Loading is expensive, so you create one session at startup and reuse it across every inference call.

### ONNX Model Format

An ONNX model file contains the computation graph (the sequence of operations the model performs) and the trained weights (the numerical parameters learned during training). The graph format is version-controlled through opset versions. Each opset version defines a specific set of supported operators. A model exported at opset 17 will run on any ONNX Runtime version that supports opset 17 or higher, which is the source of the format's portability guarantee.

Opset versioning matters in practice because newer training frameworks export to higher opset versions, and older edge devices may run an older ONNX Runtime package. If the model requires opset 18 but the device's ONNX Runtime only supports up to opset 16, the session will fail to load. The mitigation is to either export the model at a lower opset version (most frameworks allow specifying the target opset during export) or update the ONNX Runtime package on the device. Pinning both the training export opset and the device runtime version in your deployment configuration prevents this mismatch from appearing after a routine package update.

This portability is the primary advantage over framework-specific formats: a model does not need to be re-trained when you switch inference engines or target a new platform. A model validated in the cloud runs identically at the edge, assuming the same opset version is supported.

---

## Running Inference: A Practical Pattern

Inference in ONNX Runtime follows a consistent structure regardless of model type. You prepare input tensors, run the session, and extract output tensors.

### Anomaly Detection on Sensor Data

Consider a scenario where a device reads vibration data from an accelerometer and needs to classify each reading as normal or anomalous. The model expects a fixed-length window of sensor readings as input and returns a probability score.

```csharp
public class AnomalyDetector : IDisposable
{
    private readonly InferenceSession _session;
    private readonly string _inputName;
    private readonly string _outputName;
    private readonly int _windowSize;

    public AnomalyDetector(string modelPath, int windowSize = 50)
    {
        _session = new InferenceSession(modelPath);
        _inputName = _session.InputMetadata.Keys.First();
        _outputName = _session.OutputMetadata.Keys.First();
        _windowSize = windowSize;
    }

    public float ScoreWindow(float[] sensorWindow)
    {
        if (sensorWindow.Length != _windowSize)
            throw new ArgumentException($"Expected {_windowSize} readings, got {sensorWindow.Length}");

        // ONNX Runtime expects a batch dimension: [batch, features]
        var tensor = new DenseTensor<float>(sensorWindow, new[] { 1, _windowSize });

        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor(_inputName, tensor)
        };

        using var results = _session.Run(inputs);
        var outputTensor = results.First().AsEnumerable<float>().ToArray();

        // Return the anomaly probability (value between 0 and 1)
        return outputTensor[0];
    }

    public void Dispose() => _session?.Dispose();
}
```

The calling code maintains a sliding window over incoming sensor readings and calls `ScoreWindow` when the window is full:

```csharp
var detector = new AnomalyDetector("/models/vibration-anomaly.onnx", windowSize: 50);
var window = new Queue<float>();

await foreach (var reading in sensorStream)
{
    window.Enqueue(reading);
    if (window.Count < 50) continue;

    float score = detector.ScoreWindow(window.ToArray());
    if (score > 0.85f)
    {
        await alertService.SendAlertAsync($"Anomaly detected: score={score:F3}");
    }

    window.Dequeue(); // Slide the window forward
}
```

### Image Classification for Quality Inspection

Computer vision models follow the same pattern but require preprocessing the image into the tensor format the model expects. Most vision models expect pixel values normalized to the range [0, 1] or standardized using ImageNet mean and standard deviation values.

```csharp
public class QualityInspector : IDisposable
{
    private readonly InferenceSession _session;

    // ImageNet normalization constants
    private static readonly float[] Mean = { 0.485f, 0.456f, 0.406f };
    private static readonly float[] Std  = { 0.229f, 0.224f, 0.225f };

    public QualityInspector(string modelPath)
    {
        _session = new InferenceSession(modelPath);
    }

    public string Classify(byte[] rgbPixels, int width, int height)
    {
        // Build CHW tensor (channels, height, width) from interleaved RGB bytes
        int pixelCount = width * height;
        var tensorData = new float[3 * pixelCount];

        for (int i = 0; i < pixelCount; i++)
        {
            tensorData[i]                  = (rgbPixels[i * 3]     / 255f - Mean[0]) / Std[0]; // R
            tensorData[i + pixelCount]     = (rgbPixels[i * 3 + 1] / 255f - Mean[1]) / Std[1]; // G
            tensorData[i + 2 * pixelCount] = (rgbPixels[i * 3 + 2] / 255f - Mean[2]) / Std[2]; // B
        }

        var tensor = new DenseTensor<float>(tensorData, new[] { 1, 3, height, width });
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor("input", tensor)
        };

        using var results = _session.Run(inputs);
        var scores = results.First().AsEnumerable<float>().ToArray();

        int maxIndex = Array.IndexOf(scores, scores.Max());
        return maxIndex == 0 ? "PASS" : "FAIL";
    }

    public void Dispose() => _session?.Dispose();
}
```

---

## Model Types Suited for IoT

Not every ML problem makes sense at the edge, and not every model type fits on constrained hardware. The most common use cases in IoT fall into a few categories.

**Anomaly detection on sensor data** is the workhorse of industrial IoT. Models learn what "normal" looks like from historical sensor readings (temperature, vibration, pressure, current) and flag deviations. These models are typically small and fast because they operate on low-dimensional numeric data rather than images or text.

**Classification** assigns sensor readings or device states to predefined categories. A motor might be classified as running normally, running under load, idling, or in a fault state. Classification models can be trained on labeled historical data and updated as new failure modes are identified.

**Computer vision for quality inspection** uses cameras and image classification or object detection models to detect defects in manufactured parts, check fill levels in containers, or verify assembly completeness. These models are larger than sensor models but can run on devices with dedicated vision hardware.

**Predictive maintenance scoring** combines multiple sensor streams to estimate remaining useful life or the probability of failure within a given time horizon. These models output a score that maintenance systems use to schedule work before a failure occurs rather than after. A bearing on an industrial pump, for example, exhibits increasing vibration amplitude and temperature over the weeks before it fails. A model trained on historical failure data can assign a health score to the bearing in real time, allowing maintenance to be scheduled during a planned downtime window rather than after an unplanned breakdown that halts the production line.

The choice between these model types depends on what labeled data is available, what the device hardware can support, and what action the system will take on the output. Anomaly detection works well when you have abundant normal data but few labeled failures. Classification requires labeled examples of each category. Predictive maintenance requires historical records of failures with the sensor history leading up to each one, which can take months or years to accumulate.

---

## Edge Device Hardware Capabilities

The hardware available on an edge device determines which models can run and how quickly. There is a wide spectrum from simple microcontrollers to purpose-built inference accelerators.

| Device Class | Representative Hardware | ML Capability |
|---|---|---|
| General-purpose SBC | Raspberry Pi 4 (4GB RAM) | Small ONNX models, sensor anomaly detection, lightweight vision models |
| GPU-accelerated SBC | NVIDIA Jetson Nano / Orin | Full computer vision pipelines, real-time object detection at 30fps |
| Neural Processing Unit | Intel Movidius (in NCS2) | Optimized inference via OpenVINO, efficient power consumption |
| Google Coral | Coral Dev Board / USB Accelerator | TensorFlow Lite models compiled for Edge TPU, very fast on compatible models |
| Industrial PC | x86 fanless PC with GPU | Full ONNX Runtime with CUDA, capable of large model inference |

The [NVIDIA Jetson](https://developer.nvidia.com/embedded/jetson-modules){:target="_blank" rel="noopener noreferrer"} line targets computer vision and robotics applications where GPU acceleration is needed at the edge. The [Intel Neural Compute Stick 2](https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/overview.html){:target="_blank" rel="noopener noreferrer"} and [Google Coral](https://coral.ai){:target="_blank" rel="noopener noreferrer"} USB Accelerator can attach to devices like a Raspberry Pi to add hardware inference acceleration without replacing the host device.

ONNX Runtime supports execution providers that target specific hardware. The DirectML execution provider targets Windows devices with any GPU. The CUDA provider targets NVIDIA GPUs. The TensorRT provider targets NVIDIA hardware with additional optimization. On hardware without these accelerators, ONNX Runtime uses optimized CPU execution that still outperforms naive implementations.

---

## Model Optimization for Constrained Devices

A model that performs well in the cloud often cannot run directly on an edge device. The gap between cloud GPU compute and a Raspberry Pi CPU is enormous, so models intended for the edge must be optimized before deployment.

### Quantization

Quantization reduces the numerical precision of model weights and activations. Training typically uses 32-bit floating-point (FP32) values. Quantizing to 8-bit integers (INT8) reduces model size by roughly 4x and speeds up inference significantly on hardware with integer accelerators, with only a small accuracy penalty in most cases. ONNX Runtime supports INT8 inference natively, and Azure Machine Learning can export quantized ONNX models directly.

### Pruning

Pruning removes weights from the network that contribute little to the output. A dense neural network contains many parameters that are near-zero and can be removed without meaningful loss in accuracy. Structured pruning removes entire neurons or filters, which produces a smaller model that standard inference engines can run efficiently. Unstructured pruning creates a sparse weight matrix that requires specialized sparse inference support to benefit from.

### Knowledge Distillation

Knowledge distillation trains a small "student" model to mimic the behavior of a large "teacher" model. The student never sees the original training data directly; instead, it learns from the teacher's soft probability outputs, which carry more information than hard labels. The result is a compact model that approximates the performance of the larger model while fitting on constrained hardware.

### Model Compression

Architectural choices made during model design also affect edge suitability. MobileNet and EfficientNet architectures are designed for mobile and edge deployment, using techniques like depthwise separable convolutions to reduce computation. Choosing an architecture designed for efficiency from the start avoids the need for post-training compression.

| Technique | Size Reduction | Accuracy Impact | Implementation Effort |
|---|---|---|---|
| INT8 Quantization | ~4x | Minimal (< 1%) | Low: supported by AML export |
| Pruning (structured) | 2-10x | Low to moderate | Medium: requires training modification |
| Knowledge Distillation | 5-50x | Moderate | High: requires teacher-student training |
| Efficient architectures | Varies | Depends on choice | Low if designed in from the start |

---

## Azure IoT Edge ML Modules

[Azure IoT Edge](https://learn.microsoft.com/en-us/azure/iot-edge/about-iot-edge){:target="_blank" rel="noopener noreferrer"} packages edge workloads as Docker containers called modules. An ML model and its inference runtime can be packaged together as a module, giving it a consistent deployment unit, resource isolation, and lifecycle management through IoT Hub.

A typical edge ML deployment uses two modules: one that reads from sensors and passes data to the ML module, and one that receives inference results and acts on them (sending alerts, writing to local storage, or triggering actuators). The modules communicate through the IoT Edge message bus, keeping concerns separated.

The deployment manifest specifies which modules run on the device, their container images, environment variables, and resource limits. When Azure IoT Hub pushes a new deployment to the device, the IoT Edge agent pulls updated container images and restarts affected modules. This is how model updates reach the device without requiring SSH access or manual intervention.

```json
{
  "modulesContent": {
    "$edgeAgent": {
      "properties.desired": {
        "modules": {
          "VibrationSensor": {
            "version": "1.0",
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "myregistry.azurecr.io/vibration-sensor:1.2",
              "createOptions": {}
            }
          },
          "AnomalyDetector": {
            "version": "1.0",
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "myregistry.azurecr.io/anomaly-detector:2.1",
              "createOptions": {}
            },
            "env": {
              "MODEL_PATH": { "value": "/models/vibration-anomaly.onnx" },
              "THRESHOLD": { "value": "0.85" }
            }
          }
        }
      }
    }
  }
}
```

---

## Azure Machine Learning Integration

[Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/){:target="_blank" rel="noopener noreferrer"} (AML) serves as the training and model management hub. Data scientists use AML compute clusters to train models, AML experiments to track runs and compare results, and the AML model registry to version and store trained models.

Exporting a trained model to ONNX from AML is straightforward for most frameworks. A PyTorch model exports using `torch.onnx.export`, and a scikit-learn model exports using `skl2onnx`. The resulting `.onnx` file registers in the AML model registry, where it gets a version number and metadata tags.

When registering a model, metadata tags capture context that later becomes essential for traceability. Tags like the training dataset version, the ONNX opset version, the target device class, and the evaluation accuracy help the team understand what each version represents without having to re-run the experiment.

```python
# Register the exported ONNX model in AML (Python, run in training pipeline)
from azureml.core import Model, Workspace

ws = Workspace.from_config()
model = Model.register(
    workspace=ws,
    model_name="vibration-anomaly-detector",
    model_path="./outputs/anomaly_detector.onnx",
    model_framework=Model.Framework.ONNX,
    model_framework_version="1.14",
    tags={
        "onnx_opset": "17",
        "training_dataset_version": "2024-Q4",
        "target_device": "raspberry-pi-4",
        "f1_score": "0.94",
        "quantized": "true"
    },
    description="INT8 quantized anomaly detector for vibration sensor data"
)
print(f"Registered model version: {model.version}")
```

Deploying from the AML registry to an IoT Edge device involves building a container image that includes the model file and an inference server, pushing the image to Azure Container Registry, and updating the IoT Edge deployment manifest to reference the new image tag. The [Azure Machine Learning IoT Edge deployment integration](https://learn.microsoft.com/en-us/azure/machine-learning/){:target="_blank" rel="noopener noreferrer"} can automate portions of this pipeline through AML pipelines and Azure DevOps.

The model registry provides the audit trail needed for regulated industries: who trained the model, on what data, with what parameters, when it was deployed, and to which devices. When a model produces a spurious alert that causes unnecessary downtime, you can trace back to the exact training run, dataset version, and evaluation metrics that produced it.

---

## Alternative Inference Frameworks

ONNX Runtime is the primary choice for .NET-based IoT applications, but two alternatives are worth understanding at an awareness level.

[TensorFlow Lite](https://ai.google.dev/edge/lite){:target="_blank" rel="noopener noreferrer"} is Google's inference runtime designed for mobile and embedded devices. Models trained in TensorFlow are converted to the `.tflite` format using the TFLite converter. TFLite supports hardware delegation to neural accelerators including the Google Edge TPU (Coral) and various Android NPUs. It is widely used in Android and embedded Linux contexts. .NET interop exists but is less native than the ONNX Runtime NuGet experience.

[PyTorch Mobile](https://pytorch.org/mobile/home/){:target="_blank" rel="noopener noreferrer"} packages PyTorch models for deployment on iOS and Android. For IoT devices running Linux, PyTorch models can also run through the standard PyTorch runtime, but the resource footprint is larger than ONNX Runtime or TFLite. The primary use case for PyTorch Mobile is deploying research models directly without a conversion step.

For .NET IoT applications targeting Azure, ONNX Runtime is the right choice because it integrates cleanly with the Microsoft ecosystem, supports the widest range of hardware execution providers, and avoids a Python dependency.

---

## Real-Time Inference Patterns

### Sliding Window on Sensor Streams

Time-series models require a window of consecutive readings rather than individual data points. The window captures temporal patterns that a single reading cannot convey. Implementing a sliding window efficiently matters when sensor data arrives at hundreds of readings per second.

A `CircularBuffer<T>` avoids the allocation overhead of `Queue<T>.ToArray()` on every window:

```csharp
public class SlidingWindowInferenceService
{
    private readonly AnomalyDetector _detector;
    private readonly float[] _buffer;
    private int _head;
    private int _count;
    private readonly int _windowSize;
    private readonly float _threshold;

    public SlidingWindowInferenceService(string modelPath, int windowSize, float threshold)
    {
        _detector = new AnomalyDetector(modelPath, windowSize);
        _buffer = new float[windowSize];
        _windowSize = windowSize;
        _threshold = threshold;
    }

    public bool AddReading(float value)
    {
        _buffer[_head] = value;
        _head = (_head + 1) % _windowSize;
        if (_count < _windowSize) _count++;

        if (_count < _windowSize) return false; // Buffer not yet full

        // Reconstruct the window in chronological order
        var window = new float[_windowSize];
        int start = _head; // _head now points to the oldest entry
        for (int i = 0; i < _windowSize; i++)
        {
            window[i] = _buffer[(start + i) % _windowSize];
        }

        float score = _detector.ScoreWindow(window);
        return score > _threshold;
    }
}
```

### Image Classification Pipeline

A camera-based quality inspection pipeline runs on a dedicated thread to avoid blocking the sensor acquisition loop. Frames arrive from the camera, get preprocessed, pass through the model, and generate an inspection decision.

```csharp
public class InspectionPipeline : IHostedService
{
    private readonly QualityInspector _inspector;
    private readonly ICamera _camera;
    private readonly IAlertService _alerts;
    private CancellationTokenSource _cts = new();

    public InspectionPipeline(QualityInspector inspector, ICamera camera, IAlertService alerts)
    {
        _inspector = inspector;
        _camera = camera;
        _alerts = alerts;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        Task.Run(() => RunLoop(_cts.Token), _cts.Token);
        return Task.CompletedTask;
    }

    private async Task RunLoop(CancellationToken token)
    {
        await foreach (var frame in _camera.GetFramesAsync(token))
        {
            try
            {
                string result = _inspector.Classify(frame.RgbPixels, frame.Width, frame.Height);
                if (result == "FAIL")
                {
                    await _alerts.SendAlertAsync($"Quality FAIL at {DateTimeOffset.UtcNow:O}");
                }
            }
            catch (Exception ex)
            {
                // Log but do not stop the pipeline; continue inspecting
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _cts.Cancel();
        return Task.CompletedTask;
    }
}
```

---

## Model Versioning and OTA Updates

A deployed fleet of edge devices runs a specific version of each model. As new training data arrives and models improve, those updates need to reach devices without requiring physical access. Over-the-air (OTA) model deployment is the mechanism that keeps edge models current.

Through Azure IoT Edge, model updates arrive as new container image versions. The IoT Edge agent compares the running configuration against the desired configuration from IoT Hub and pulls updated images when they differ. This means a model update follows the same path as any other software update: build a new container image with the updated `.onnx` file, push it to Azure Container Registry, and update the deployment manifest in IoT Hub. The agent handles the rest.

For scenarios where the model file changes more frequently than the container image (such as rapid experimentation cycles), the model can be stored separately in Azure Blob Storage and downloaded to the device at startup. The device checks a version manifest on each boot and downloads the model only when the version changes.

### A/B Testing Models at the Edge

Before rolling out a new model version to an entire fleet, it is worth testing it against a subset of devices to verify performance in production conditions. IoT Hub device twins support this through tags: devices tagged as "canary" receive the new model version while the rest of the fleet continues with the current version.

The deployment manifest uses tag-based targeting to send different versions to different device groups. Inference metrics (accuracy, latency, alert rates) flow back to the cloud through IoT Hub telemetry, where they can be compared across groups before committing to a full rollout.

---

## The Data Feedback Loop

The edge ML system improves over time only if inference results and interesting edge samples flow back to the cloud for use in the next training cycle. A model deployed to a device without any feedback mechanism will degrade as the operating environment drifts from the conditions represented in the training data.

Two types of data are worth collecting from the edge. Inference decisions (especially alerts and anomaly flags) tell you what the model thought was happening. Raw sensor samples or images captured at the time of an inference decision let you verify whether the model was correct and add them to the labeled dataset.

Selective upload avoids the bandwidth problem. Rather than streaming all sensor data to the cloud, devices upload samples only when the model expresses uncertainty (scores near the decision boundary), when an alert fires, or when a human operator marks an incident on the device. This gives the data science team the most informative samples without saturating the network.

```csharp
public class FeedbackUploader
{
    private readonly BlobServiceClient _blobClient;
    private readonly string _deviceId;

    public FeedbackUploader(BlobServiceClient blobClient, string deviceId)
    {
        _blobClient = blobClient;
        _deviceId = deviceId;
    }

    public async Task UploadIfUncertain(float[] window, float score, CancellationToken token)
    {
        // Upload samples where the model is uncertain (score between 0.4 and 0.7)
        bool uncertain = score is > 0.4f and < 0.7f;
        bool alert = score >= 0.85f;

        if (!uncertain && !alert) return;

        string blobName = $"{_deviceId}/{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}.json";
        var containerClient = _blobClient.GetBlobContainerClient("feedback-samples");
        var payload = JsonSerializer.Serialize(new
        {
            DeviceId = _deviceId,
            Timestamp = DateTimeOffset.UtcNow,
            Score = score,
            IsAlert = alert,
            IsUncertain = uncertain,
            Window = window
        });

        await containerClient.UploadBlobAsync(blobName, BinaryData.FromString(payload), token);
    }
}
```

These uploaded samples feed directly into the next training cycle. Data scientists review the flagged samples, apply correct labels, merge them into the training dataset, and retrain the model. The improved model then deploys back to the fleet, completing the feedback loop.

---

## Common Failure Modes

Edge ML deployments fail in ways that differ from cloud ML deployments. Most of these failures are preventable with the right design choices.

**Model-hardware mismatch** occurs when a model is optimized for a GPU execution provider but deployed to a device with only CPU inference available. The symptom is unexpectedly slow inference or a runtime error on startup. The fix is to test the model on representative target hardware before rolling out to the fleet and to configure `SessionOptions` with a fallback strategy that degrades gracefully to CPU when the preferred provider is unavailable.

**Data drift** is the gradual divergence between the distribution of data the model was trained on and the distribution of data it encounters in production. A vibration anomaly model trained on data from summer months may underperform in winter when ambient temperature changes affect baseline sensor readings. Without a feedback loop and periodic retraining, model accuracy degrades silently. The detection mechanism is monitoring alert rates and uncertainty scores over time; sudden changes in these metrics often indicate drift rather than a genuine change in device behavior.

**Memory exhaustion on startup** catches teams that test inference throughput without testing startup overhead. Loading an ONNX session allocates memory for the computation graph, the weights, and working buffers. On a device with 512MB of RAM running a full Linux stack, loading a 50MB model can be tight. Quantizing the model before deployment reduces both the file size and the runtime memory footprint. Profiling startup memory on the actual target device during development avoids surprises in production.

**Tensor shape mismatches** appear at inference time when the input data does not match the shape the model expects. A model trained on 224x224 images will throw an exception when passed a 480x640 frame without resizing. These errors are easy to prevent by validating input shape against `session.InputMetadata` at startup, but they are common in early integrations where the preprocessing pipeline is written separately from the model export.

**OTA update failures mid-deployment** can leave a portion of the fleet on an inconsistent model version. The Azure IoT Edge agent reports module state back to IoT Hub, so you can query which devices successfully applied the new deployment. Building the deployment pipeline to treat version consistency as a health metric, and rolling back to the previous version when the success rate falls below a threshold, prevents fleet-wide incidents from partial deployments.

**Missing preprocessing steps** cause subtle accuracy problems rather than hard errors. A model trained on normalized sensor data will produce meaningless output if the inference code passes raw sensor readings without applying the same normalization. The preprocessing pipeline used during training must be preserved and applied identically at inference time. The ONNX format can embed simple preprocessing steps (mean subtraction, scaling) directly in the model graph using ONNX operators, which eliminates the risk of preprocessing drift between training and inference.

---

## Key Takeaways

Running ML at the edge is a practical pattern for scenarios where latency, bandwidth, or privacy constraints make cloud inference impractical. The approach requires discipline across several dimensions: model optimization to fit constrained hardware, a structured cloud-to-edge deployment pipeline, OTA update infrastructure to keep models current, and a feedback loop to prevent model degradation over time.

For .NET developers, ONNX Runtime via the `Microsoft.ML.OnnxRuntime` NuGet package is the direct path to edge inference without requiring Python or framework-specific runtimes. Training happens in Azure Machine Learning, models export to the portable ONNX format, and deployment follows the standard Azure IoT Edge module pattern. The result is a system where the cloud handles the computationally intensive work of training and the edge handles the time-sensitive work of inference.
