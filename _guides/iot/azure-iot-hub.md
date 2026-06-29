---
title: "Azure IoT Hub"
layout: guide
category: IoT
subcategory: Azure IoT Services
description: "Azure IoT Hub for bidirectional device-cloud communication, covering telemetry ingestion, cloud-to-device messaging, device twins, message routing, file uploads, and the .NET device SDK."
tags: [iot, azure, mqtt, telemetry, scalability, dotnet, practical]
---

## What Azure IoT Hub Is

[Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/iot-concepts-and-iot-hub){:target="_blank" rel="noopener noreferrer"} is a managed PaaS message broker that enables bidirectional communication between cloud applications and IoT devices at scale. Microsoft manages the underlying infrastructure, including availability, patching, and scaling of the broker itself, while you own the device logic, business rules, and downstream processing.

IoT Hub supports millions of simultaneously connected devices across three natively supported protocols: MQTT, AMQP, and HTTPS. Devices that speak other protocols, such as CoAP or proprietary vendor protocols, can connect through a protocol gateway that translates to one of the supported protocols before reaching IoT Hub. MQTT and AMQP are the preferred choices for devices with persistent connections because they use fewer resources and maintain a session across multiple messages, while HTTPS works well for constrained devices that only send occasional telemetry.

IoT Hub is positioned above raw messaging infrastructure like Event Hubs or Service Bus. It adds device-specific concepts like identity management, device authentication, cloud-to-device messaging patterns, and device state synchronization on top of the underlying message transport.

---

## Device Identity and Registry

Every device that communicates with IoT Hub must have an entry in the identity registry. The registry stores device IDs, authentication credentials, and connection state, and it acts as the authoritative source for which devices are permitted to connect.

### Per-Device Authentication

IoT Hub supports two authentication mechanisms: SAS tokens and X.509 certificates.

SAS tokens are shared-access signatures derived from a symmetric key stored in the identity registry. The device uses the key to generate a time-limited token and presents it when connecting. SAS tokens are straightforward to implement and work well for development and small-scale deployments, but they carry operational risk because rotating keys requires coordinated updates across all devices using that key.

X.509 certificates provide stronger security by removing the shared secret entirely. Each device holds a private key and presents a certificate signed by a trusted certificate authority (CA) registered with IoT Hub. The device authenticates through the TLS handshake rather than presenting a token, and revocation happens at the CA level without touching IoT Hub configuration. X.509 is the recommended approach for production fleets.

### Connection State Tracking

IoT Hub tracks whether each device is currently connected. This state is exposed through the device twin (discussed in the Device Twins section) and through [Azure Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/event-schema-iot-hub){:target="_blank" rel="noopener noreferrer"} events for device connected and disconnected transitions. Applications can subscribe to those events to trigger workflows like alerting when a critical sensor goes offline.

### Bulk Import and Export

Managing individual registry entries through the portal or SDK works for small fleets but becomes impractical beyond a few hundred devices. IoT Hub supports bulk import and export operations against Azure Blob Storage: you prepare a file with device records, submit the import job, and IoT Hub processes it asynchronously. The same mechanism handles bulk deletion and bulk updates to device twin tags. This is the standard approach for provisioning large fleets during initial deployment.

---

## Device-to-Cloud Messaging (Telemetry)

Devices send telemetry by publishing messages to IoT Hub. Each message has a body containing the payload, which is typically JSON but can be any byte sequence, and a set of application properties that carry metadata as key-value string pairs. Properties are separate from the body and can be read by message routing rules without deserializing the payload, which avoids unnecessary compute for filtering.

### The Built-In Endpoint

IoT Hub exposes a built-in endpoint that is compatible with [Azure Event Hubs](https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-about){:target="_blank" rel="noopener noreferrer"}. Consumer applications can read telemetry from this endpoint using the Event Hubs SDK or through services like Azure Stream Analytics and Azure Functions with an Event Hub trigger. The built-in endpoint retains messages for one to seven days depending on configuration, and it partitions messages for parallel consumption.

### Sending Telemetry from a Device (C#)

The [Azure IoT Device SDK for .NET](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-sdks){:target="_blank" rel="noopener noreferrer"} wraps the protocol-level details and exposes a straightforward API for sending telemetry.

```csharp
using Microsoft.Azure.Devices.Client;
using System.Text;
using System.Text.Json;

// Connect using a connection string (for development)
// In production, prefer X.509 certificate auth or DPS provisioning
await using var deviceClient = DeviceClient.CreateFromConnectionString(
    connectionString,
    TransportType.Mqtt);

var telemetry = new
{
    deviceId = "sensor-001",
    temperature = 22.4,
    humidity = 58.1,
    timestamp = DateTimeOffset.UtcNow
};

string json = JsonSerializer.Serialize(telemetry);
using var message = new Message(Encoding.UTF8.GetBytes(json))
{
    ContentType = "application/json",
    ContentEncoding = "utf-8"
};

// Add application properties for routing rules to inspect
message.Properties["sensorType"] = "environmental";
message.Properties["alertLevel"] = "normal";

await deviceClient.SendEventAsync(message);
```

Setting `ContentType` and `ContentEncoding` on the message lets downstream services like Stream Analytics deserialize the body without guessing the format. Application properties like `sensorType` and `alertLevel` are inspectable by message routing rules without touching the body.

### Message Routing

Message routing lets you direct messages to different endpoints based on routing queries. A routing query is a SQL-like expression that can inspect the message body, application properties, and system properties like `$connectionDeviceId` or `$messageSource`. Messages that match a route are delivered to the configured endpoint; messages that match no route fall to the fallback route, which by default goes to the built-in endpoint.

Routing destinations include Event Hubs namespaces, Service Bus queues and topics, Azure Blob Storage, and Cosmos DB. A common pattern sends high-priority alert messages to a Service Bus queue for immediate processing while routing normal telemetry to Blob Storage for batch analytics.

```
# Example routing query: match messages with alertLevel = "critical"
# and a temperature above 80 degrees from environmental sensors
applicationProperties.sensorType = 'environmental'
AND applicationProperties.alertLevel = 'critical'
AND CAST(body.temperature AS DOUBLE) > 80.0
```

Routing queries that inspect the body require the message body to be valid UTF-8 JSON. Messages with binary payloads can only be filtered by properties and system properties.

### Message Enrichments

Message enrichments let you append metadata to outgoing messages before they reach an endpoint. You can attach values from device twin tags, IoT Hub system properties like the hub name or endpoint name, and static strings. Enrichments are useful when a downstream service needs context, like which region a device is deployed in, without requiring the device to include that information in every message.

---

## Cloud-to-Device Messaging

Sending information from the cloud to a device is more complex than telemetry because devices may be intermittently connected, on constrained networks, or unable to maintain persistent connections. IoT Hub provides three distinct patterns, each suited to different interaction styles.

### Comparison of Cloud-to-Device Patterns

| Pattern | Delivery | Device Online Required | Use Case |
|---|---|---|---|
| Cloud-to-device messages | Async, queued | No (delivered when next online) | Notifications, configuration pushes |
| Direct methods | Sync, request/response | Yes (must be online) | Commands, remote diagnostics, actuator control |
| Desired properties (twin) | Async, state-based | No (device reads on reconnect) | Long-lived configuration changes |

### Cloud-to-Device Messages

Cloud-to-device messages are queued at IoT Hub and delivered to the device the next time it connects. You configure a time-to-live (TTL) that determines how long the message waits before expiring. The device SDK acknowledges delivery, and the backend can request feedback indicating whether the message was received, rejected, or expired. This pattern works well for scenarios where the device does not need to respond immediately, such as sending a configuration file or a notification.

### Direct Methods

Direct methods are synchronous request/response calls from the cloud to a specific device. The backend invokes a named method with a JSON payload and waits for a response within a configurable timeout. The device must be online and have registered a handler for that method name; if the device is offline, the call fails immediately with a timeout error rather than queuing.

Direct methods are the right pattern when you need confirmation that something happened, such as commanding a valve to close or requesting a device to report its current sensor readings on demand. The synchronous nature makes error handling straightforward: success means the device executed the method and returned a result, while a timeout means the device was unreachable.

### Handling a Direct Method on the Device (C#)

```csharp
await using var deviceClient = DeviceClient.CreateFromConnectionString(
    connectionString,
    TransportType.Mqtt);

// Register a handler for a method named "SetTelemetryInterval"
await deviceClient.SetMethodHandlerAsync(
    "SetTelemetryInterval",
    HandleSetTelemetryInterval,
    userContext: null);

// Keep the device client alive
await Task.Delay(Timeout.Infinite);

static Task<MethodResponse> HandleSetTelemetryInterval(
    MethodRequest request,
    object userContext)
{
    string payload = request.DataAsJson;
    using var doc = JsonDocument.Parse(payload);
    int intervalSeconds = doc.RootElement.GetProperty("intervalSeconds").GetInt32();

    // Apply the new interval in your device logic
    Console.WriteLine($"Setting telemetry interval to {intervalSeconds}s");

    // Return HTTP 200 with a JSON response body
    string responseJson = JsonSerializer.Serialize(new { status = "ok", intervalSeconds });
    return Task.FromResult(new MethodResponse(
        Encoding.UTF8.GetBytes(responseJson),
        statusCode: 200));
}
```

The method handler returns a status code and response body that the backend receives as the method result. A 200 status code signals success; any other code signals failure, and the backend can inspect the response body for details.

### Desired Properties (Device Twin)

The third cloud-to-device pattern uses the device twin's desired properties section, which the backend writes and the device reads. Unlike direct methods, desired properties do not require the device to be online at the time of the update. The device reads the desired properties when it connects and applies any changes it has not yet applied. This is the natural fit for long-lived configuration like reporting intervals, threshold values, or feature flags that should survive device restarts.

---

## Device Twins

A device twin is a JSON document stored in IoT Hub that represents the state of a single device. Every registered device has exactly one twin. The twin has three top-level sections: `desired`, `reported`, and `tags`.

The `desired` section is written by the backend and read by the device. The backend uses it to express the intended configuration or state. The `reported` section is written by the device and read by the backend, and the device uses it to express its actual current state. The `tags` section is written by the backend and never visible to the device. It holds metadata like physical location, firmware version, customer ID, or any other label useful for fleet queries.

The typical twin lifecycle for a configuration change looks like this: the backend writes a desired property, the device reads it on the next connection, applies the change, and then writes back a reported property confirming the new state. The backend can compare desired and reported properties to identify devices that have not yet applied a configuration change.

### Reading and Updating Twin Properties (C#)

```csharp
await using var deviceClient = DeviceClient.CreateFromConnectionString(
    connectionString,
    TransportType.Mqtt);

// Read the full twin, including desired and reported sections
Twin twin = await deviceClient.GetTwinAsync();

// Read a desired property set by the backend
JsonElement desiredProps = JsonDocument.Parse(twin.Properties.Desired.ToJson()).RootElement;
int reportingIntervalSeconds = desiredProps.TryGetProperty("reportingIntervalSeconds", out JsonElement val)
    ? val.GetInt32()
    : 60; // default if not set

Console.WriteLine($"Applying reporting interval: {reportingIntervalSeconds}s");

// Report back the actual state after applying the change
var reportedProperties = new TwinCollection();
reportedProperties["reportingIntervalSeconds"] = reportingIntervalSeconds;
reportedProperties["firmwareVersion"] = "2.1.4";
reportedProperties["lastAppliedConfig"] = DateTimeOffset.UtcNow.ToString("o");

await deviceClient.UpdateReportedPropertiesAsync(reportedProperties);

// Register a callback to receive desired property updates in real time
await deviceClient.SetDesiredPropertyUpdateCallbackAsync(OnDesiredPropertiesUpdated, userContext: null);

static Task OnDesiredPropertiesUpdated(TwinCollection desiredProperties, object userContext)
{
    Console.WriteLine($"Received desired property update: {desiredProperties.ToJson()}");
    // Apply changes and update reported properties accordingly
    return Task.CompletedTask;
}
```

### Twin Queries

IoT Hub supports SQL-like queries across the entire fleet of device twins. This lets you ask questions like "which devices are running firmware older than 2.0.0" or "which devices in building-A have not reported in the last 24 hours" without pulling every twin individually.

```sql
-- Find all devices in building-A not yet updated to firmware 2.1.4
SELECT deviceId, tags.location, properties.reported.firmwareVersion
FROM devices
WHERE tags.location.building = 'building-A'
  AND properties.reported.firmwareVersion != '2.1.4'
```

Tags appear under the `tags` prefix in queries, desired properties appear under `properties.desired`, and reported properties appear under `properties.reported`. Twin queries are executed from the backend using the [service SDK](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-query-language){:target="_blank" rel="noopener noreferrer"}, not from the device, so they are appropriate for fleet dashboards and targeted update campaigns.

### Optimistic Concurrency

Twin updates use ETags to prevent conflicting writes. When you read a twin, IoT Hub returns an ETag that represents the current version. If you write back with that ETag and the twin has changed since your read, the write fails with a conflict error. This protects against two backend services simultaneously updating the same twin and silently overwriting each other's changes.

---

## File Upload

Some device scenarios involve sending large payloads that do not fit comfortably in a message, such as log files, diagnostic dumps, raw camera frames, or firmware update packages for peer distribution. IoT Hub coordinates file uploads to Azure Blob Storage through a flow that keeps credentials off the device.

The upload flow works as follows. The device requests a SAS URI from IoT Hub for a named blob. IoT Hub generates a time-limited SAS URI scoped to the configured storage account and returns it to the device. The device uploads the file directly to Blob Storage using that URI, bypassing IoT Hub for the data transfer. After the upload completes, the device notifies IoT Hub, which then fires a file upload notification that backend services can consume.

This design means IoT Hub never handles the file payload itself; it only brokers the credentials and notification. The storage account can have its own access policies, lifecycle management, and tiering separate from IoT Hub configuration.

### Uploading a File from a Device (C#)

```csharp
await using var deviceClient = DeviceClient.CreateFromConnectionString(
    connectionString,
    TransportType.Mqtt);

string localFilePath = "/tmp/diagnostics-2026-02-24.log";
string blobName = $"diagnostics/{DateTimeOffset.UtcNow:yyyy/MM/dd}/sensor-001-diagnostics.log";

using FileStream fileStream = File.OpenRead(localFilePath);

// Request a SAS URI, upload the file, and notify IoT Hub in one call
await deviceClient.UploadToBlobAsync(blobName, fileStream);

Console.WriteLine("File upload complete and IoT Hub notified.");
```

The [UploadToBlobAsync](https://learn.microsoft.com/en-us/dotnet/api/microsoft.azure.devices.client.deviceclient.uploadtoblobasync){:target="_blank" rel="noopener noreferrer"} method handles the full three-step flow internally: requesting the SAS URI, streaming the file to Blob Storage, and sending the completion notification. You configure the target storage account in the IoT Hub portal under the File Upload settings, and you can configure the notification TTL, delivery count, and lock duration for the notification queue.

---

## Scaling and Pricing

IoT Hub pricing is based on the tier selected and the number of units provisioned within that tier. Each unit provides a fixed number of messages per day and a fixed number of concurrent device connections.

### Tier Comparison

| Feature | Free | Basic | Standard |
|---|---|---|---|
| Messages per day | 8,000 | Varies by unit | Varies by unit |
| Device-to-cloud messages | Yes | Yes | Yes |
| Cloud-to-device messages | No | No | Yes |
| Direct methods | No | No | Yes |
| Device twins | No | Partial (tags + reported only) | Full |
| Message routing | No | Yes | Yes |
| File upload | No | No | Yes |
| Max units | 1 | 200 | 10 |

The Free tier is useful for learning and small-scale prototypes. Basic tier supports telemetry ingestion and message routing but does not support cloud-to-device patterns beyond simple messages. Standard tier unlocks the full feature set including direct methods, full device twin support, and file upload. Most production scenarios require Standard tier.

### Messages Per Day and Units

IoT Hub charges per message, where the size of each message determines how many "messages" it counts against the quota. Messages up to 4 KB count as one message; a 16 KB message counts as four messages. Each unit of S1 provides 400,000 messages per day, S2 provides 6 million, and S3 provides 300 million.

Scaling out is done by adding units to an existing hub rather than provisioning additional hubs, though large enterprise deployments sometimes shard devices across multiple hubs to isolate failure domains or separate business units. Partitions control the parallelism of the built-in endpoint: more partitions allow more consumers to read in parallel, which matters when telemetry volume is high and a single consumer cannot keep up with the ingest rate.

### When to Scale Up vs. Scale Out

If message volume is the constraint, add units within the same tier or move to a higher tier. If consumer throughput is the constraint, increase the partition count (adjustable only at hub creation time for the built-in endpoint). If isolation is the constraint, for example separating production and staging or separating customers with different SLA requirements, provision separate hubs rather than sharing a single hub with different consumer groups.

---

## Integration with Other Azure Services

IoT Hub is rarely the final destination for device data. It sits at the ingestion boundary and feeds into downstream services that store, process, or react to device events.

### Azure Functions

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-event-iot){:target="_blank" rel="noopener noreferrer"} can be triggered by messages arriving at the IoT Hub built-in endpoint using the Event Hub trigger, since the built-in endpoint is Event Hub-compatible. A Function that processes individual telemetry messages works well for light transformations, enrichment, or forwarding to other systems. For higher throughput scenarios, Functions with batch processing enabled can process arrays of messages per invocation rather than one at a time, which significantly reduces per-message overhead.

### Azure Stream Analytics

[Azure Stream Analytics](https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-introduction){:target="_blank" rel="noopener noreferrer"} connects directly to IoT Hub as an input source and applies continuous SQL-like queries over the stream of telemetry. It is designed for real-time analytics scenarios like computing rolling averages over a time window, detecting anomalies through threshold comparisons, and joining device telemetry with reference data from Blob Storage or a SQL database. Stream Analytics jobs run continuously and write results to outputs like Azure SQL Database, Cosmos DB, Power BI, or Event Hubs for further processing.

A typical pattern uses Stream Analytics to compute five-minute windowed averages for each device and write those averages to a time-series database, while simultaneously routing raw messages to Blob Storage for long-term retention. This separates the hot path, which needs low-latency aggregated results, from the cold path, which needs durable raw storage.

### Azure Event Grid

IoT Hub publishes operational events to [Azure Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/event-schema-iot-hub){:target="_blank" rel="noopener noreferrer"} for lifecycle changes that are separate from device telemetry. These events include device connected, device disconnected, device created, device deleted, and device twin changed. Event Grid delivers these events to subscribers like Azure Functions, Logic Apps, or webhook endpoints, enabling reactive workflows such as alerting when a critical device disconnects or triggering a provisioning workflow when a new device registers.

Event Grid events are distinct from telemetry messages. Telemetry flows through the built-in endpoint and message routing; Event Grid events flow through the Event Grid subscription system. The distinction matters for designing the downstream architecture correctly: do not try to consume device-connected events from the Event Hub endpoint, as they do not appear there.

### Azure Monitor and Diagnostics

IoT Hub emits metrics and diagnostic logs through [Azure Monitor](https://learn.microsoft.com/en-us/azure/iot-hub/monitor-iot-hub){:target="_blank" rel="noopener noreferrer"}. Metrics cover categories like total messages used, connected devices, routing deliveries, and throttling events. Diagnostic logs capture details about connections, device telemetry, direct method calls, and twin operations.

Routing these logs to a Log Analytics workspace allows you to write Kusto queries that investigate throttling patterns, track device connection rates over time, or identify devices generating routing failures. Setting up alerts based on metrics, such as triggering when the throttling rate exceeds a threshold, provides early warning before message loss occurs. Enabling diagnostic logs in production is recommended from the start; retroactively investigating an incident without log history is significantly harder.

---

## Message Routing and Enrichment

Message routing is configured through the IoT Hub portal or ARM templates and takes effect without any code changes to devices or downstream services. Routes consist of a name, a source (such as device messages, twin change events, or device lifecycle events), an optional routing query, and an endpoint.

### Routing Queries

A routing query is a SQL-like expression that evaluates to true or false for each message. Messages where the query evaluates to true are delivered to the route's endpoint. You can write queries against the message body, application properties, and system properties.

```sql
-- Route high-priority alerts from temperature sensors to a Service Bus queue
applicationProperties.sensorType = 'temperature'
AND applicationProperties.alertLevel = 'critical'

-- Route all messages from a specific device
$connectionDeviceId = 'sensor-001'

-- Route messages from devices with a specific twin tag (via message enrichment)
$twin.tags.location.building = 'building-B'
```

Body-based queries require the message body to be valid UTF-8 JSON. When body queries are enabled, IoT Hub deserializes the body to evaluate the expression, which adds a small amount of latency compared to property-only queries.

### Message Enrichments

Enrichments add properties to outgoing messages after routing evaluates but before delivery to the endpoint. You configure enrichments with a key, a value expression, and the endpoint or endpoints where they apply. Value expressions can reference twin tags, twin properties, and well-known IoT Hub variables like `$hubName` and `$endpointName`.

For example, you might enrich all messages routed to Blob Storage with the device's physical location from its twin tags, so the stored messages are self-describing without requiring a join against the twin store later. Enrichments operate at the IoT Hub level, so there is no device SDK code required.

### Fallback Route

The fallback route captures messages that no other route matches. By default it routes to the built-in endpoint. If you add custom routes without disabling the fallback, all messages still reach the built-in endpoint in addition to any matched custom routes, which can lead to confusion about where messages are going. Disable the fallback route when you want exclusive routing through custom routes, or leave it enabled when the built-in endpoint serves as the default consumer.

### Testing Routes Before Deployment

The IoT Hub portal provides a route testing tool where you can supply a sample message body, properties, and a device twin document, then evaluate which routes and enrichments would apply. Testing routes with representative sample messages before deploying to production reduces the risk of misconfigured queries silently dropping messages or sending them to the wrong endpoint.

---

## Common Patterns and Tradeoffs

Understanding the tradeoffs between patterns helps in designing a system that handles realistic device behavior rather than ideal-case behavior.

### Handling Intermittently Connected Devices

Devices on cellular networks, battery-powered sensors, and devices in areas with unreliable connectivity are intermittently connected by nature. Direct methods fail when the device is offline, so they are inappropriate for configuration changes that need to survive connectivity gaps. Desired properties in the device twin are the better choice because the device reads the current desired state whenever it connects, regardless of how many updates happened while it was offline. The device always converges to the latest desired state rather than needing to process a sequence of intermediate states.

### Choosing Between Message Routing and Event Grid

Message routing is for device-generated data that needs to reach storage or processing services. Event Grid is for IoT Hub operational events like device connection state changes. These are complementary, not competing. A well-designed architecture uses both: message routing for the telemetry data plane and Event Grid for the operational control plane.

### Fan-Out with Multiple Consumer Groups

The built-in endpoint supports multiple consumer groups, and each consumer group maintains its own position in the stream. This allows multiple independent services to read the same telemetry without interfering with each other. For example, a real-time Stream Analytics job and a batch processing Function can both read the same telemetry stream from different consumer groups. IoT Hub supports up to five consumer groups on the built-in endpoint by default, with additional groups available for higher tiers.

### Throttling and Quota Management

IoT Hub throttles operations per device and per hub to protect the shared infrastructure. Device-to-cloud message throttling applies per device, while bulk twin query throttling applies per hub. When a device hits its throttling limit, it receives a `ThrottlingException`, and the device SDK with retry policies built in will back off and retry automatically. Designing devices to send telemetry at a sustainable rate rather than bursting is preferable to relying on retry logic to smooth out spikes.
