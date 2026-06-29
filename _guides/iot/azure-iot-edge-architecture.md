---
title: "Azure IoT Edge: Architecture and Development"
layout: guide
category: IoT
subcategory: Azure IoT Services
description: "Azure IoT Edge runtime architecture, module communication patterns, building custom .NET modules, and deployment manifests for edge computing workloads."
tags: [iot, azure, edge-computing, dotnet, architecture, distributed-systems, practical]
---

## What Azure IoT Edge Is

[Azure IoT Edge](https://learn.microsoft.com/en-us/azure/iot-edge/about-iot-edge){:target="_blank" rel="noopener noreferrer"} is a runtime that runs on physical edge devices such as industrial gateways, factory PCs, or single-board computers like a Raspberry Pi. Instead of routing all data to the cloud for processing, IoT Edge brings cloud workloads down to the device itself. Those workloads are packaged as Docker containers, which Azure IoT Edge calls modules.

From the cloud's perspective, an IoT Edge device looks like a special kind of IoT Hub device with additional capabilities. You provision it through IoT Hub, manage its configuration from Azure, and receive its telemetry in the same way. From the device's perspective, it receives a deployment manifest from the cloud, pulls the specified container images, and runs them locally without a permanent connection to Azure.

This design solves two recurring problems in industrial and remote IoT deployments. First, sending raw sensor data from hundreds of devices to the cloud is expensive both in bandwidth and in data processing costs; filtering and aggregating at the edge reduces that volume dramatically. Second, many industrial environments have unreliable or even intentionally air-gapped connectivity, and workloads cannot simply stop when the internet link drops. IoT Edge handles both by processing locally and buffering messages until the connection returns.

### How IoT Edge Fits in the Azure IoT Stack

IoT Edge sits between leaf devices and [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/iot-concepts-and-iot-hub){:target="_blank" rel="noopener noreferrer"}, and it depends on IoT Hub for device provisioning, configuration delivery, and cloud-side telemetry ingestion. It is not a standalone service; an IoT Hub instance is always required.

The broader Azure IoT stack includes several related services that work alongside IoT Edge. [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/){:target="_blank" rel="noopener noreferrer"} handles device identity, message routing to cloud backends, and delivery of deployment manifests. [Azure Device Provisioning Service](https://learn.microsoft.com/en-us/azure/iot-dps/about-iot-dps){:target="_blank" rel="noopener noreferrer"} automates zero-touch provisioning so devices self-register with IoT Hub on first boot without per-device manual configuration. [Azure Digital Twins](https://learn.microsoft.com/en-us/azure/digital-twins/overview){:target="_blank" rel="noopener noreferrer"} can model relationships between IoT Edge devices and the physical systems they monitor.

IoT Edge modules receive messages from IoT Hub through the Edge Hub in the form of cloud-to-device messages and direct method invocations, and they send messages upstream to IoT Hub as device-to-cloud telemetry. This bidirectional relationship is what makes IoT Edge feel like a natural extension of the cloud rather than a separate on-premises system.

---

## IoT Edge Runtime Architecture

The IoT Edge runtime consists of three components that cooperate to manage module lifecycle, local messaging, and device security. Understanding how they divide responsibility makes it much easier to troubleshoot deployments and design custom modules correctly.

### Edge Agent

The Edge Agent is itself a container, and it is always the first module that starts when IoT Edge initializes. Its job is to read the deployment manifest that was applied to this device and ensure the correct containers are running. When a new manifest arrives from IoT Hub, the Edge Agent compares the desired state to the current state, pulls any new container images, starts or stops modules accordingly, and reports the current status back to IoT Hub through the agent module twin.

The Edge Agent also monitors module health. If a module crashes, the Edge Agent can restart it according to a configured restart policy. This is why you almost never need to write custom watchdog logic inside a module; the runtime handles restarts for you.

### Edge Hub

The Edge Hub acts as a local message broker. Modules do not communicate with each other directly or connect individually to IoT Hub. Instead, they publish messages to Edge Hub, which routes those messages based on a routing table defined in the deployment manifest. Messages destined for the cloud are queued and sent to IoT Hub; messages destined for other modules are delivered locally over MQTT or AMQP without ever leaving the device.

This design means modules are decoupled from each other. A filtering module does not need to know the address or connection details of a forwarding module; it just sends a message to a named output, and the routing table determines what happens next.

Edge Hub also handles store-and-forward when the cloud connection is unavailable, which is covered in more detail in the Offline Capabilities section below.

### Security Daemon (IoT Edge Security Manager)

The Security Daemon manages device identity and trust. It interacts with the hardware security module (HSM) or software-simulated TPM to generate and protect the device's identity certificates. Every module receives credentials from the Security Daemon at startup through a well-known socket, so modules can authenticate to Edge Hub without storing credentials in their container images.

This architecture means that rotating credentials or re-provisioning a device does not require rebuilding module images. The Security Daemon handles the credential lifecycle independently of the application code.

In production deployments, the Security Daemon relies on either a hardware TPM 2.0 chip or an HSM such as those from Infineon or NXP. These hardware components store private keys in tamper-resistant silicon so that even an attacker with physical access to the device cannot extract the key material. Development environments typically use a software simulation of the TPM, which is convenient but offers no hardware-level protection. Planning for HSM-capable hardware during the device selection phase avoids a costly redesign when security requirements are evaluated closer to production deployment.

---

## Module Architecture and Communication

### What Modules Are

A module is a Docker container that contains business logic, an Azure service (such as Azure Stream Analytics or Azure Functions), or a third-party component. Each module has its own container image, network namespace, and lifecycle. Modules can be written in any language that runs in a Linux or Windows container, though C# and Python are the most commonly used languages with the official SDKs.

Every module, including Edge Agent and Edge Hub, runs as a container. This uniformity means you can test modules locally using Docker before deploying them to real hardware, which dramatically shortens the development cycle.

### Input and Output Routes

Modules communicate through named inputs and outputs. A module declares in its code that it listens on an input named "input1" and sends results to an output named "output1". The routing table in the deployment manifest then wires these endpoints together.

A route looks like this in the deployment manifest:

```json
"routes": {
  "SensorToFilter": "FROM /messages/modules/TemperatureSensor/outputs/temperatureOutput INTO BrokeredEndpoint(\"/modules/FilterModule/inputs/input1\")",
  "FilterToHub": "FROM /messages/modules/FilterModule/outputs/output1 INTO $upstream"
}
```

The special destination `$upstream` means IoT Hub. This route wires the TemperatureSensor module's output into the FilterModule's input, and then routes the FilterModule's output to the cloud. The FilterModule itself never needs to know anything about TemperatureSensor or IoT Hub; it only handles its own inputs and outputs.

### Module Twins

Each module has a module twin, which is a JSON document stored in IoT Hub that contains desired properties (set by the cloud) and reported properties (set by the module). Module twins follow the same pattern as device twins but are scoped to a specific module rather than the device as a whole.

Module twins are the standard way to configure running modules without redeploying them. For example, a filtering module might have a desired property called `TemperatureThreshold`. When you update this value in IoT Hub, the change is pushed to the running module, which receives a callback and updates its internal threshold without restarting.

### Direct Methods

Direct methods let the cloud invoke a function on a running module synchronously and receive a response. Unlike telemetry and twin updates, which are asynchronous, a direct method call waits for a result within a configurable timeout. This makes direct methods appropriate for operations where you need confirmation, such as triggering a diagnostic routine, flushing a local buffer, or requesting a module to report its current internal state.

A module registers a direct method handler by name, similar to how it registers input message handlers. The handler receives a `MethodRequest` containing a JSON payload and must return a `MethodResponse` with a status code and optional JSON body.

```csharp
await moduleClient.SetMethodHandlerAsync(
    "FlushBuffer",
    async (request, context) =>
    {
        // Parse any parameters from the request payload
        var payload = request.DataAsJson;

        // Perform the requested operation
        var flushedCount = await BufferManager.FlushAsync();

        var responsePayload = JsonSerializer.Serialize(new
        {
            Success = true,
            MessagesFlushed = flushedCount
        });

        return new MethodResponse(
            Encoding.UTF8.GetBytes(responsePayload),
            statusCode: 200);
    },
    null);
```

Direct methods time out if the module does not respond within the configured window (default is 30 seconds). If the module is not connected to Edge Hub when the call arrives, the call fails immediately rather than queuing. This behavior distinguishes direct methods from desired property updates, which queue and deliver when the module reconnects.

---

## Building Custom .NET Modules

### Project Structure

A custom IoT Edge module written in C# is a .NET console application that references the [Microsoft.Azure.Devices.Client](https://www.nuget.org/packages/Microsoft.Azure.Devices.Client){:target="_blank" rel="noopener noreferrer"} NuGet package. The module initializes a `ModuleClient`, registers callbacks for inputs and module twin updates, and then keeps the process running. The IoT Edge runtime handles starting and stopping the container.

The `ModuleClient.CreateFromEnvironmentAsync()` factory method reads connection information that the Security Daemon injects into the container's environment, so modules do not need to store connection strings in their images or configuration files.

```csharp
class Program
{
    static async Task Main(string[] args)
    {
        var moduleClient = await ModuleClient.CreateFromEnvironmentAsync(TransportType.Amqp);
        await moduleClient.OpenAsync();

        // Register input message handler
        await moduleClient.SetInputMessageHandlerAsync("input1", ProcessMessageAsync, moduleClient);

        // Register module twin desired property callback
        await moduleClient.SetDesiredPropertyUpdateCallbackAsync(OnDesiredPropertyChangedAsync, moduleClient);

        // Block until cancelled
        var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        await Task.Delay(Timeout.Infinite, cts.Token).ContinueWith(_ => { });

        await moduleClient.CloseAsync();
    }
}
```

### Processing Messages

The input message handler receives messages routed to the module's named input, processes them, and can forward a new message to a named output. The handler must return a `MessageResponse` to tell Edge Hub whether the message was processed successfully.

```csharp
static async Task<MessageResponse> ProcessMessageAsync(
    Message message,
    object userContext)
{
    var moduleClient = userContext as ModuleClient;

    // Read the message body
    var messageBytes = message.GetBytes();
    var messageString = Encoding.UTF8.GetString(messageBytes);

    var telemetry = JsonSerializer.Deserialize<SensorTelemetry>(messageString);

    if (telemetry is null)
        return MessageResponse.Completed;

    // Apply filtering logic - only forward anomalies
    if (telemetry.Temperature > TemperatureThreshold)
    {
        var alert = new AnomalyAlert
        {
            DeviceId = telemetry.DeviceId,
            Temperature = telemetry.Temperature,
            Timestamp = telemetry.Timestamp,
            Severity = telemetry.Temperature > CriticalThreshold ? "Critical" : "Warning"
        };

        var alertBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(alert));
        using var outputMessage = new Message(alertBytes);
        outputMessage.ContentType = "application/json";
        outputMessage.ContentEncoding = "utf-8";

        // Forward to the "output1" output, which routes map to the next module or $upstream
        await moduleClient.SendEventAsync("output1", outputMessage);
    }

    return MessageResponse.Completed;
}
```

This pattern keeps filtering logic simple and testable. The module does not know or care whether "output1" routes to another module or directly to IoT Hub; the routing table in the deployment manifest determines that.

### Handling Module Twin Updates

When a desired property changes in IoT Hub, the running module receives a callback with the updated properties. The typical pattern is to read the relevant properties and update in-memory configuration, so subsequent message processing uses the new values immediately.

```csharp
// In-memory state - update atomically when twin changes
private static double TemperatureThreshold = 70.0;
private static double CriticalThreshold = 85.0;

static async Task OnDesiredPropertyChangedAsync(
    TwinCollection desiredProperties,
    object userContext)
{
    var moduleClient = userContext as ModuleClient;

    if (desiredProperties.Contains("TemperatureThreshold"))
        TemperatureThreshold = desiredProperties["TemperatureThreshold"];

    if (desiredProperties.Contains("CriticalThreshold"))
        CriticalThreshold = desiredProperties["CriticalThreshold"];

    // Report back what we applied
    var reportedProperties = new TwinCollection
    {
        ["TemperatureThreshold"] = TemperatureThreshold,
        ["CriticalThreshold"] = CriticalThreshold,
        ["LastConfigurationUpdate"] = DateTime.UtcNow
    };

    await moduleClient.UpdateReportedPropertiesAsync(reportedProperties);
}
```

Reporting applied values back through reported properties is good practice because it creates an observable record in IoT Hub showing exactly what configuration is active on each device. Operations teams can query this across a fleet of thousands of devices to verify configuration consistency.

### Module Initialization and Twin Reconciliation

Modules should read the current desired properties at startup to pick up any configuration that was set while the module was not running. This is a common omission that causes modules to ignore configuration changes made during downtime.

```csharp
static async Task InitializeFromTwinAsync(ModuleClient moduleClient)
{
    var twin = await moduleClient.GetTwinAsync();
    var desiredProperties = twin.Properties.Desired;

    if (desiredProperties.Contains("TemperatureThreshold"))
        TemperatureThreshold = desiredProperties["TemperatureThreshold"];

    if (desiredProperties.Contains("CriticalThreshold"))
        CriticalThreshold = desiredProperties["CriticalThreshold"];
}
```

Call `InitializeFromTwinAsync` before registering the desired property update callback. This ensures the module applies any pending configuration changes before it starts processing messages.

---

## Deployment Manifests

### What a Deployment Manifest Is

A deployment manifest is a JSON document that tells the IoT Edge runtime which modules to run, how to configure them, and how messages flow between them. You create manifests in the Azure portal or using [Azure IoT Edge for VS Code](https://marketplace.visualstudio.com/items?itemName=vsciot-vscode.azure-iot-edge){:target="_blank" rel="noopener noreferrer"}, and they are stored in IoT Hub and pushed to devices automatically.

The manifest has three major sections: system modules (Edge Agent and Edge Hub configuration), custom module definitions, and routes.

```json
{
  "modulesContent": {
    "$edgeAgent": {
      "properties.desired": {
        "schemaVersion": "1.1",
        "runtime": {
          "type": "docker",
          "settings": {
            "minDockerVersion": "v1.25"
          }
        },
        "systemModules": {
          "edgeAgent": {
            "type": "docker",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-agent:1.5",
              "createOptions": {}
            }
          },
          "edgeHub": {
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-hub:1.5",
              "createOptions": {
                "HostConfig": {
                  "PortBindings": {
                    "5671/tcp": [{"HostPort": "5671"}],
                    "8883/tcp": [{"HostPort": "8883"}],
                    "443/tcp": [{"HostPort": "443"}]
                  }
                }
              }
            },
            "env": {
              "OptimizeForPerformance": {"value": "false"}
            }
          }
        },
        "modules": {
          "TemperatureFilter": {
            "version": "1.0",
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "myregistry.azurecr.io/temperaturefilter:1.2.0",
              "createOptions": {
                "HostConfig": {
                  "Binds": ["/host/data:/app/data"]
                }
              }
            },
            "env": {
              "LOG_LEVEL": {"value": "Information"}
            }
          }
        }
      }
    },
    "$edgeHub": {
      "properties.desired": {
        "schemaVersion": "1.1",
        "routes": {
          "SensorToFilter": "FROM /messages/modules/TemperatureSensor/outputs/temperatureOutput INTO BrokeredEndpoint(\"/modules/TemperatureFilter/inputs/input1\")",
          "FilterToCloud": "FROM /messages/modules/TemperatureFilter/outputs/output1 INTO $upstream"
        },
        "storeAndForwardConfiguration": {
          "timeToLiveSecs": 7200
        }
      }
    },
    "TemperatureFilter": {
      "properties.desired": {
        "TemperatureThreshold": 70,
        "CriticalThreshold": 85
      }
    }
  }
}
```

### Module Create Options

The `createOptions` field maps directly to Docker's container create API. Common uses include binding host ports so downstream devices can connect to a module over a fixed port, mounting host directories into the container for persistent storage or access to local files, and setting resource limits to prevent one module from starving others on constrained hardware.

Resource limits are worth setting explicitly on memory-constrained hardware. A module that allocates unbounded memory during a processing spike can trigger the Linux OOM killer, which terminates whichever process the kernel selects rather than the one causing the problem. Setting a `Memory` limit in the create options ensures the container itself is OOM-killed and restarted by the Edge Agent rather than taking down Edge Hub or the Security Daemon.

### Restart Policies

Each module has a restart policy that tells Edge Agent what to do when the module exits. The options are `always` (restart regardless of exit code, appropriate for long-running workloads), `on-failure` (restart only if the exit code is non-zero, appropriate for tasks that should succeed and stop), `on-unhealthy` (restart only when the health check fails), and `never` (do not restart automatically).

Most custom IoT Edge modules should use `always` because they are intended to run indefinitely and process messages continuously.

### Layered Deployments

A base deployment applies to all devices matching a given tag. Layered deployments stack on top of the base to add or override modules for specific device groups without replacing the entire manifest. This is the standard pattern for managing a heterogeneous fleet where some devices need specialized modules.

For example, a base deployment might run the core telemetry filtering module on every device, while a layered deployment targeting devices tagged with `type=assembly-line` adds a computer vision inference module that is only needed in manufacturing cells.

When multiple deployments target the same device, priority values determine which deployment wins for any property that appears in more than one manifest. A layered deployment with priority 20 overrides settings from a base deployment with priority 10. Properties that appear only in the lower-priority deployment are still applied; layered deployments merge rather than replace.

### Route Query Syntax

Routes support a SQL-like `WHERE` clause for content-based routing, which lets a single output route to different destinations depending on message properties or body content.

```
FROM /messages/modules/TemperatureSensor/outputs/temperatureOutput
WHERE $body.temperature > 90
INTO BrokeredEndpoint("/modules/AlertModule/inputs/input1")
```

Message properties set on the outgoing message (like custom application properties or the system `$contentType` property) can also be used in route conditions. This avoids building routing logic into module code, keeping each module focused on its own processing while the manifest controls dispatch.

---

