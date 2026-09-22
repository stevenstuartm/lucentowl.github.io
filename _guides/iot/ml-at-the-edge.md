---
title: "Machine Learning at the Edge"
layout: guide
category: IoT
subcategory: Architecture & Data
description: "Running trained models on IoT devices: how the cloud and the edge split the ML lifecycle, portable formats and runtimes like ONNX, matching models to device classes, quantization, pruning, and distillation, inference practices, model delivery and canaries, and the feedback loop that keeps edge models current."
tags: [practical, edge-computing, onnx, quantization, knowledge-distillation, model-deployment, anomaly-detection]
---

## Why Run Inference on the Device

The general case for processing at the edge (latency, bandwidth, and operating through a lost connection) applies to ML inference unchanged. Two drivers are specific to models. The first is privacy. Camera feeds, audio, biometric readings, and medical signals often cannot leave the device under regulation or user expectation, so the model has to come to the data. The second is that inference is the part of the ML workload that fits. Training needs large datasets, accelerators, and repeated experiments, while running a trained model is a fixed, predictable computation that a small device can do once the model has been shrunk to its budget.

Edge inference does not have to be all or nothing. A common hybrid runs a small model on the device and acts on the readings it scores with confidence, then forwards only the ambiguous ones to a larger cloud model. Most readings in a healthy system are clearly normal, so the device handles the bulk of the traffic locally, and the cloud spends its compute and the network spends its bandwidth only where the small model is unsure.

| Approach | Latency | Bandwidth | Accuracy | Where the cost lands |
|---|---|---|---|---|
| Cloud inference only | A network round trip per decision | Full sensor data | Highest, since model size is unconstrained | Cloud compute and data transfer |
| Edge inference only | Local, no network in the decision path | Results only | Limited by what fits on the device | Device hardware |
| Hybrid | Local for confident cases | Uncertain samples only | Close to the cloud model on the hard cases | Split between both |

The hybrid depends on the edge model producing a usable confidence signal. A classifier that outputs a calibrated probability can route on a score band. A model that outputs a bare label cannot tell the device when to ask for help.

---

## How the Cloud and the Edge Split the Lifecycle

"ML at the edge" can suggest the device does everything. In practice the device does one step, and the cloud does the rest.

1. **Collect** raw readings, images, and operational data from devices.
2. **Label and prepare** that data in the cloud.
3. **Train** a model on a cloud ML platform or a workstation with accelerators.
4. **Evaluate** it against held-out data, including data from the devices it will run on.
5. **Optimize and export** it to a portable format sized for the target device class.
6. **Register** the exported file as a versioned artifact with the metadata needed to trace it later.
7. **Deliver** it to devices over the air, canary group first.
8. **Run inference** on the device, which never trains or updates the model itself.
9. **Upload selected samples** so the next training cycle sees the cases the model found hard.

Steps 1 through 7 happen off the device. The model on the device is a static artifact until the next version arrives, which keeps the device predictable and makes every decision traceable to one model version. Step 9 closes the loop, and without it the model can only get worse as the environment drifts from its training data.

{% include figure.html id="iot-edge-ml-loop" %}

---

## Model Types Suited for IoT

Not every ML problem belongs on a device. The ones that do tend to fall into three groups.

**Anomaly detection on sensor data** is the most common. A model learns what normal looks like from historical temperature, vibration, pressure, or current readings and flags departures from it. These models are small and fast because they work on low-dimensional numeric windows rather than images or text, and they need only normal data to train, which suits equipment that rarely fails.

**Classification** assigns a reading or a device state to one of several labeled categories, such as a motor that is idling, running under load, or in one of several fault states. It needs labeled examples of every category, and each new category means new labels and a retrained model.

**Computer vision** covers defect detection on manufactured parts, fill-level checks, and assembly verification through image classification or object detection. These models are an order of magnitude larger than sensor models and usually need a device with a GPU or a neural accelerator to keep up with a camera's frame rate.

Remaining-life and failure-probability scoring for equipment builds on the same model types, but it needs historical failures with the sensor history leading up to each one, which can take months or years to accumulate.

---

## Portable Model Formats and Runtimes

A model trained in one framework has to run on a device that will never install that framework. A portable model format decouples the two. The training side exports once, and the device runs the file through a small inference runtime.

### ONNX and ONNX Runtime

[ONNX](https://onnx.ai){:target="_blank" rel="noopener noreferrer"} (Open Neural Network Exchange) is an open format for ML models. An ONNX file holds the computation graph (the sequence of operations the model performs) and the trained weights. PyTorch, TensorFlow, and scikit-learn models can all be exported to it. [ONNX Runtime](https://onnxruntime.ai){:target="_blank" rel="noopener noreferrer"} is the cross-platform engine that runs those files, with bindings for C, C++, C#, Java, Python, and JavaScript, so the device application can be written in whatever language the rest of its code uses.

ONNX Runtime reaches hardware through **execution providers**. The CPU provider runs everywhere. Others target specific accelerators, such as CUDA and TensorRT for NVIDIA GPUs, OpenVINO for Intel hardware, and QNN for Qualcomm NPUs. When the session is created, the runtime partitions the graph and assigns each operation to the first listed provider that supports it. Any operation the preferred provider cannot run falls back to the CPU provider, which keeps the model correct but can quietly make it far slower than benchmarks promised.

Not every provider ships as a prebuilt package for every platform. The GPU packages on NuGet, for example, target x64 Linux and Windows, so running ONNX Runtime with CUDA on an ARM-based NVIDIA Jetson means using a build made for that board or [building from source](https://onnxruntime.ai/docs/build/eps.html){:target="_blank" rel="noopener noreferrer"} against the board's CUDA and TensorRT versions. Check the package for the exact device architecture before designing around an accelerator.

### Opset Versions

The ONNX operator set is versioned through **opsets**, and every exported model is stamped with the opset it targets. Per the ONNX Runtime [compatibility policy](https://onnxruntime.ai/docs/reference/compatibility.html){:target="_blank" rel="noopener noreferrer"}, a runtime release runs models stamped with any opset from 7 up to the newest one it implements. A model exported at a newer opset than the device's runtime implements fails to load.

This bites edge fleets because training environments upgrade freely and devices do not. A data scientist on the latest framework exports at the latest opset, and the model fails on devices still running last year's runtime. Two fixes work. Export at the opset the fleet supports, since exporters accept a target opset, or upgrade the runtime on the device first. Recording the opset alongside the model version, and treating the runtime version as part of the device's configuration, keeps the mismatch from surfacing after a routine update.

### Alternative Runtimes

ONNX is not the only path, and a device's accelerator often decides the runtime.

| Runtime | Model source | Where it fits |
|---|---|---|
| [ONNX Runtime](https://onnxruntime.ai){:target="_blank" rel="noopener noreferrer"} | ONNX files exported from most frameworks | Linux and Windows devices; broadest set of accelerator execution providers |
| [LiteRT](https://developers.google.com/edge/litert){:target="_blank" rel="noopener noreferrer"} (formerly TensorFlow Lite) | `.tflite` models converted from TensorFlow, JAX, or PyTorch | Android, embedded Linux, and microcontrollers; delegates to NPUs and GPUs |
| [ExecuTorch](https://docs.pytorch.org/executorch/){:target="_blank" rel="noopener noreferrer"} | PyTorch models exported ahead of time | PyTorch-native deployment to mobile, embedded, and microcontroller targets; successor to the deprecated PyTorch Mobile |
| Vendor toolchains such as NVIDIA TensorRT or Intel OpenVINO | ONNX or framework models, compiled for one vendor's hardware | Maximum throughput on that vendor's accelerator, at the cost of portability |

A vendor toolchain compiles the model for one family of hardware, which usually gives the best throughput on it and a file that runs nowhere else. The portable runtimes trade some of that speed for one artifact that runs across the fleet.

---

## Matching Models to Device Classes

The device class sets the ceiling on what model can run and how fast. Four classes cover most edge ML deployments.

| Device class | Examples | What runs well | The constraint that bites |
|---|---|---|---|
| CPU-only single-board computer | A Raspberry Pi-class ARM board | Sensor anomaly detection and classification, small quantized vision models at low frame rates | Memory and thermals; a vision model at camera frame rate usually does not fit |
| GPU module | NVIDIA Jetson Orin | Full computer vision pipelines, object detection at camera frame rate | Toolkit versions; the runtime build has to match the board's CUDA and TensorRT |
| NPU or add-on accelerator | An NPU built into the processor, or a USB or M.2 inference accelerator | Quantized vision and audio models at low power | Operator coverage; accelerators run a subset of operators, and models usually need to be fully quantized and compiled for them |
| Industrial PC | x86 fanless PC, optionally with a discrete GPU | Several models at once, larger models, mixed workloads | Cost, power, and physical size per site |

Microcontrollers sit below all four. They can run tiny models through microcontroller-targeted runtimes like LiteRT for Microcontrollers or ExecuTorch, typically keyword spotting or simple sensor classification in tens to hundreds of kilobytes, but they fall outside the ONNX Runtime path.

Accelerator operator coverage deserves a test before hardware is chosen, not after. A model with even one unsupported operator splits across the accelerator and the CPU, and the copies between them can cost more than the acceleration saves.

---

## Model Optimization for Constrained Devices

A model that performs well on a cloud GPU usually has to be made smaller before a device can run it. Four techniques do most of the work, and they combine.

### Quantization

Quantization lowers the numerical precision of weights and activations. Training uses 32-bit floating point, and converting to 8-bit integers cuts weight storage to a quarter and lets integer hardware do the arithmetic. Accuracy usually drops only slightly, but the drop is model-dependent and has to be measured on the evaluation set. **Dynamic quantization** converts weights ahead of time and activations as they are computed, and needs no data. **Static quantization** also fixes activation ranges ahead of time from a calibration dataset, which is faster at inference and is usually what NPUs and integer-only accelerators require. [ONNX Runtime's quantization guidance](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html){:target="_blank" rel="noopener noreferrer"} recommends dynamic quantization for recurrent and transformer models and static quantization for convolutional ones. When post-training quantization costs too much accuracy, quantization-aware training simulates the lower precision during training so the model learns to tolerate it.

### Pruning

Pruning removes weights that contribute little to the output. **Structured pruning** removes whole neurons, channels, or filters, producing a smaller dense model that any runtime runs faster. **Unstructured pruning** zeroes individual weights, which shrinks the model after compression but speeds inference only on runtimes and hardware with sparse-computation support. Pruned models usually need fine-tuning afterwards to recover accuracy.

### Knowledge Distillation

Knowledge distillation trains a small student model to reproduce a large teacher model's outputs. The student trains on the teacher's soft probability outputs, typically alongside the true labels, and those soft outputs carry information a hard label does not, such as which wrong classes the teacher found plausible. The result is a compact model that recovers much of the teacher's accuracy, at the cost of a second full training run.

### Efficient Architectures

Architecture choice sets the starting size. Families like MobileNet and EfficientNet were designed for mobile and edge hardware and use techniques like depthwise separable convolutions to cut computation. Starting from one of these usually beats compressing a large model after the fact.

| Technique | What shrinks | Accuracy risk | Effort |
|---|---|---|---|
| Quantization | Size and compute, and integer hardware becomes usable | Usually small, model-dependent | Low post-training; higher with quantization-aware training |
| Structured pruning | Size and compute | Low to moderate, recovered by fine-tuning | Medium: prune-and-retrain cycles |
| Knowledge distillation | Everything, since the student is a smaller model | Moderate; the student rarely matches the teacher | High: a second training pipeline |
| Efficient architecture | Everything, from the start | Depends on the architecture | Low when chosen before training |

---

## Running Inference on the Device

The inference code on the device is short, and most of its bugs come from three places.

**Create the session once and reuse it.** Loading a model parses the graph, applies graph optimizations, assigns operations to execution providers, and allocates buffers. That cost belongs at startup, not in the inference path. A long-lived session is also where the thread count gets capped, so the model does not starve the rest of the device's workload on a small CPU.

**Validate input shape against the model at startup.** A model declares the shape it expects, such as a batch of 50-reading windows or a 224 by 224 three-channel image. Reading that declaration when the session loads and checking it against what the acquisition code produces turns a mismatch into a startup error rather than an exception on the first frame, or worse, a silently resized input.

**Keep preprocessing identical to training.** The normalization, scaling, windowing, and channel order used during training have to be applied the same way on the device. A model trained on normalized readings produces confident garbage from raw ones, and nothing throws an error. Two approaches reduce the risk. Ship the preprocessing constants as part of the model artifact rather than as separate configuration, or move simple preprocessing like scaling and mean subtraction into the model graph itself so it cannot drift.

Time-series models add one more concern. They score a window of consecutive readings, so the device maintains a sliding buffer and scores it each time a new reading arrives or on a fixed stride. At hundreds of readings per second, a ring buffer that reuses one allocation matters on a small device.

---

## Delivering Models to the Fleet

Model updates are how an edge ML system improves, so the delivery path has to be as routine as a configuration change. Two designs cover most fleets.

**The model ships inside a container module.** Edge runtimes like [Azure IoT Edge](https://learn.microsoft.com/en-us/azure/iot-edge/about-iot-edge){:target="_blank" rel="noopener noreferrer"} and [AWS IoT Greengrass](https://docs.aws.amazon.com/greengrass/v2/developerguide/what-is-iot-greengrass.html){:target="_blank" rel="noopener noreferrer"} deploy workloads as modules or components, and a model can travel inside the inference module's image. A new model is then a new image version, deployed through the same pipeline as any other software change. This is simple and keeps the model and the code that runs it in lockstep, but every model update means rebuilding and redownloading the whole image.

**The model is a separately versioned artifact.** The inference module stays fixed, and the model file lives in object storage or a model registry. The device learns which version it should run from its configuration (the desired state in its device twin or shadow, for example), downloads the file when the version changes, verifies its hash or signature, and swaps the session. Model updates become small and frequent without touching the code, at the cost of versioning two things. The inference code has to declare which model versions and opsets it supports, and the device has to reject a model outside that range.

Either way, a new model reaches a canary group of devices before the fleet. Canary devices report inference metrics like score distributions, alert rates, the share of readings forwarded as uncertain, and inference latency, and the rollout proceeds only if those stay in line with the current model on comparable devices. A model can pass every offline evaluation and still alert constantly on one site's machines, and the canary is where that shows up. Model delivery and firmware updates are separate channels, so the device keeps the previous model file until the new one has loaded successfully and can roll back without a reflash.

---

## The Data Feedback Loop

A deployed model degrades as the environment drifts away from its training data. A vibration model trained on summer data can misfire in winter when colder ambient temperatures shift baseline readings. The fix is retraining on recent data, and the data that retraining needs most is the data the device already saw.

Two kinds of data go back to the cloud. **Decisions**, meaning the model's scores, alerts, and flags, show what the model thought was happening and let the cloud track alert rates and score distributions per model version. **Samples**, meaning the raw readings or images behind a decision, let a person confirm or correct the label so the case can join the training set.

Uploading everything defeats the point of edge inference, so devices upload samples selectively. They send them when the score falls in the uncertain band near the decision boundary, when an alert fires, and when an operator marks an incident. Devices should also send a small random sample of confident decisions. Without it the dataset only ever sees the cases the model found hard, and a model that has become confidently wrong never shows up in the uploads.

Samples go to storage in the cloud, where reviewers label them and they join the next training cycle. Tagging each sample with the device, the model version, and the preprocessing version makes it traceable when a later model behaves unexpectedly. The same metadata on the registered model (training dataset version, opset, target device class, and evaluation scores) lets a team trace a spurious shutdown back to the exact training run behind it.

---

## Where Edge ML Deployments Break

Edge ML deployments break in ways cloud deployments do not, and most of the breaks trace back to the device being a different environment from the one the model was built in.

**The model runs on the wrong hardware path.** A model tuned for a GPU or NPU lands on a device where the provider is missing, or where some of its operators are unsupported. Session creation fails when the provider library is missing entirely. Unsupported operators fall back to the CPU and run far slower without an error. Testing on representative hardware before rollout, and reporting which provider each device actually loaded, catches both.

**The model does not fit at startup.** Teams measure inference throughput and forget load-time memory. Creating a session allocates the graph, the weights, and working buffers, which can exceed the model file's size, and on a device with a few hundred megabytes of RAM shared with a full operating system, a model that runs fine on a development board can fail to load in production. Quantizing reduces both file size and memory, and profiling startup on the actual target device avoids the surprise.

**The input shape is wrong.** A model trained on 224 by 224 images rejects a 640 by 480 frame. These errors are easy to prevent with a startup check against the model's declared inputs, and common anyway when the acquisition code is written separately from the model export.

**Preprocessing drifts from training.** This is the quietest break, because nothing throws. A changed normalization constant or a swapped channel order produces plausible scores that are wrong. Embedding preprocessing in the model graph, or shipping it with the model artifact, removes the gap.

**The fleet ends up on mixed versions.** A rollout that stalls leaves some devices on the old model and some on the new one, and comparisons across the fleet become meaningless. Reporting the loaded model version as part of device state, treating version consistency as a health metric, and rolling back when the success rate falls below a threshold keeps a partial rollout from turning into a fleet-wide incident.

**The environment drifts and nobody notices.** Accuracy degrades gradually and silently. Watching alert rates, score distributions, and the uncertain-band share per model version over time is the early warning, and a change in those metrics without a matching change in the equipment usually means drift rather than a change in how the equipment behaves.

---

## Key Takeaways

Edge inference earns its place when latency, bandwidth, privacy, or offline operation rule out a round trip, and the hybrid pattern lets a small device model handle the confident majority while a cloud model takes the hard cases. The device only runs inference. Training, evaluation, optimization, and versioning stay in the cloud, and the model on the device is a static, traceable artifact.

A portable format like ONNX separates the training framework from the device, but the device's accelerator and runtime version still constrain the export. Check operator coverage, prebuilt package availability, and opset support before choosing hardware or upgrading a training environment. Quantization is the first optimization to reach for, then pruning, distillation, or an efficient architecture when it is not enough.

On the device, reuse the session, validate input shape at startup, and keep preprocessing identical to training. Ship models through a delivery path as routine as configuration, canary them against live metrics, and keep the previous version for rollback. Close the loop with selective sample upload, or the model degrades as the world it was trained on drifts away.
