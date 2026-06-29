---
title: "MQTTnet for IoT Communication"
layout: guide
category: IoT
subcategory: .NET IoT Development
description: "Building MQTT clients and brokers in C# with MQTTnet, covering publish/subscribe patterns, QoS levels, TLS security, topic hierarchies, and IoT-specific messaging patterns."
tags: [iot, dotnet, mqtt, real-time, practical, protocols, telemetry]
---

## What Is MQTTnet

[MQTTnet](https://github.com/dotnet/MQTTnet){:target="_blank" rel="noopener noreferrer"} is the leading MQTT library for .NET, now maintained under the official dotnet GitHub organization. It provides both MQTT client and broker (server) functionality in pure C#, so you can build either side of an MQTT connection without depending on external tools.

The library supports MQTT 3.1.1 and MQTT 5.0, runs on .NET 8+, .NET Framework, and .NET nanoFramework (for microcontrollers), and benchmarks at roughly 150,000 messages per second on modest hardware. That throughput makes it suitable for demanding IoT workloads where many devices are reporting sensor data at high frequency.

Install MQTTnet from NuGet:

```bash
dotnet add package MQTTnet
```

The [NuGet package page](https://www.nuget.org/packages/MQTTnet){:target="_blank" rel="noopener noreferrer"} lists the current stable version. For MQTT 5.0 features like message expiry, shared subscriptions, and request/response correlation, use version 4.x or later.

---

## MQTT Concepts Worth Knowing First

MQTT is a lightweight publish/subscribe protocol designed for constrained devices and unreliable networks. A broker sits in the middle: publishers send messages to the broker tagged with a topic string, and subscribers tell the broker which topics they care about. The broker routes messages between them without publishers and subscribers ever knowing about each other directly.

Three quality-of-service (QoS) levels control delivery guarantees:

| QoS | Name | Delivery Guarantee | Use Case |
|-----|------|--------------------|----------|
| 0 | At most once | Fire and forget; message may be lost | High-frequency telemetry where occasional loss is acceptable |
| 1 | At least once | Delivered at least once; duplicates possible | Commands and alerts where loss is unacceptable |
| 2 | Exactly once | Delivered exactly once | Financial transactions, critical state changes |

Topics are hierarchical strings like `devices/sensor-42/telemetry/temperature`. Wildcards let subscribers match patterns: `+` matches a single level (so `devices/+/telemetry/temperature` matches any device), and `#` matches zero or more levels (so `devices/#` matches everything under devices).

---

## Creating and Connecting an MQTT Client

The entry point for client usage is `MqttClientFactory`. You use it to create a client instance and then build connection options separately:

```csharp
using MQTTnet;
using MQTTnet.Client;

var factory = new MqttClientFactory();
using var client = factory.CreateMqttClient();

var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 1883)
    .WithClientId("device-sensor-42")
    .WithCleanSession(true)
    .Build();

var result = await client.ConnectAsync(options);
Console.WriteLine($"Connected: {result.ResultCode}");
```

`WithCleanSession(true)` means the broker discards any queued messages from a previous session when the client reconnects. Set it to `false` if the device needs to receive messages that arrived while it was offline, which requires QoS 1 or 2 subscriptions.

### Connecting with WebSockets

Some environments block raw TCP on port 1883 but allow WebSocket traffic on port 443. Switch transports by replacing `WithTcpServer` with `WithWebSocketServer`:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithWebSocketServer(o => o.WithUri("wss://broker.example.com/mqtt"))
    .WithClientId("device-sensor-42")
    .Build();
```

The same client code handles both transports; only the options differ.

### TLS and Secure Connections

For production deployments, always use TLS. Port 8883 is the standard MQTT-over-TLS port:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithClientId("device-sensor-42")
    .WithTlsOptions(tls => tls
        .UseTls()
        .WithCertificateValidationHandler(context =>
        {
            // Validate the server certificate here.
            // For production, use the default chain validation.
            return context.SslPolicyErrors == System.Net.Security.SslPolicyErrors.None;
        }))
    .Build();
```

For mutual TLS authentication using a client certificate (common in industrial IoT and Azure IoT Hub device authentication):

```csharp
var clientCertificate = new X509Certificate2("device.pfx", "certificate-password");

var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithClientId("device-sensor-42")
    .WithTlsOptions(tls => tls
        .UseTls()
        .WithClientCertificates(new[] { clientCertificate }))
    .Build();
```

### Authentication with Username and Password

Many brokers use username/password authentication as a simpler alternative to certificates:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 1883)
    .WithClientId("device-sensor-42")
    .WithCredentials("my-username", "my-password")
    .Build();
```

---

## Reconnection Strategies

Network connectivity is unreliable in IoT environments. Devices lose signal, brokers restart, and network partitions happen. MQTTnet handles disconnection events through callbacks:

```csharp
client.DisconnectedAsync += async e =>
{
    Console.WriteLine($"Disconnected: {e.Reason}");

    if (e.ClientWasConnected)
    {
        // Apply exponential backoff before reconnecting.
        await Task.Delay(TimeSpan.FromSeconds(5));
        await client.ReconnectAsync();
    }
};
```

For a more robust backoff strategy:

```csharp
client.DisconnectedAsync += async e =>
{
    if (!e.ClientWasConnected)
        return;

    var delay = TimeSpan.FromSeconds(1);
    var maxDelay = TimeSpan.FromMinutes(2);

    while (!client.IsConnected)
    {
        try
        {
            await Task.Delay(delay);
            await client.ReconnectAsync();
        }
        catch
        {
            delay = delay * 2 < maxDelay ? delay * 2 : maxDelay;
        }
    }
};
```

This doubles the wait time on each failed reconnection attempt, up to a ceiling of two minutes, which prevents the device from hammering a broker that is already under stress.

---

## Publishing Messages

Publishing requires a topic, a payload, and a QoS level. The simplest form:

```csharp
var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/telemetry/temperature")
    .WithPayload("22.5")
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce)
    .Build();

await client.PublishAsync(message);
```

### Choosing the Right QoS

QoS 0 is appropriate for high-frequency telemetry like temperature readings every 500ms. Losing one reading is acceptable because the next one arrives shortly. QoS 1 is appropriate for commands, alerts, or any message where the recipient must receive it. QoS 2 is appropriate for critical state changes where receiving the message twice would cause incorrect behavior.

Using QoS 2 for everything is a common mistake. Each QoS 2 message requires four network round-trips to complete the handshake, which adds latency and increases broker load considerably. Use it only when exactly-once semantics genuinely matter.

### Serializing Payloads

Raw strings work for simple values, but JSON is common for structured telemetry:

```csharp
var telemetry = new
{
    DeviceId = "sensor-42",
    Temperature = 22.5,
    Humidity = 58.3,
    Timestamp = DateTimeOffset.UtcNow
};

var payload = JsonSerializer.SerializeToUtf8Bytes(telemetry);

var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/telemetry")
    .WithPayload(payload)
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce)
    .WithContentType("application/json")  // MQTT 5.0 property
    .Build();

await client.PublishAsync(message);
```

`WithContentType` is an MQTT 5.0 property that helps consumers understand the payload format without inspecting the topic hierarchy. For binary protocols like Protocol Buffers, serialize the message to a byte array the same way and omit the content type hint or set it to `application/protobuf`.

### Retained Messages

A retained message is stored by the broker and delivered immediately to any new subscriber that matches the topic. This is useful for publishing the current state of a device so consumers get the latest value the moment they subscribe, without waiting for the next publish cycle:

```csharp
var stateMessage = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/state")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Online = true, FirmwareVersion = "2.1.4" }))
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithRetainFlag(true)
    .Build();

await client.PublishAsync(stateMessage);
```

To clear a retained message, publish an empty payload with the retain flag set to the same topic.

### Message Expiry (MQTT 5.0)

MQTT 5.0 allows setting an expiry interval in seconds. The broker discards the message if it has not been delivered to a subscriber within that window:

```csharp
var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/alerts/motion-detected")
    .WithPayload("true")
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithMessageExpiryInterval(30)  // 30 seconds
    .Build();

await client.PublishAsync(message);
```

This prevents stale alerts from being delivered to a subscriber that reconnects long after the event occurred.

---

## Subscribing to Topics

Subscribe after connecting by specifying one or more topic filters:

```csharp
var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter("devices/+/commands/#")
    .Build();

await client.SubscribeAsync(subscribeOptions);
```

The `+` wildcard matches a single topic level, so `devices/+/commands/#` matches topics like `devices/sensor-42/commands/reboot` or `devices/gateway-1/commands/update-config/section`.

### Handling Incoming Messages

Register a callback before connecting so you don't miss messages that arrive immediately after the subscription is acknowledged:

```csharp
client.ApplicationMessageReceivedAsync += async e =>
{
    var topic = e.ApplicationMessage.Topic;
    var payload = e.ApplicationMessage.ConvertPayloadToString();

    Console.WriteLine($"Received on {topic}: {payload}");

    // Acknowledge that processing is complete (important for QoS 2).
    e.IsHandled = true;

    await Task.CompletedTask;
};
```

For JSON payloads, deserialize inside the handler:

```csharp
client.ApplicationMessageReceivedAsync += async e =>
{
    if (e.ApplicationMessage.Topic.Contains("/commands/"))
    {
        var command = JsonSerializer.Deserialize<DeviceCommand>(
            e.ApplicationMessage.PayloadSegment);

        await ExecuteCommandAsync(command);
    }
};
```

### Shared Subscriptions (MQTT 5.0)

Shared subscriptions let multiple consumers share the load of a single subscription group. The broker delivers each message to exactly one consumer in the group, distributing messages round-robin or by its own load-balancing strategy. This is useful when a single consumer cannot keep up with message throughput.

The topic filter for a shared subscription uses a special prefix:

```csharp
// Each consumer in the "telemetry-processors" group receives a subset of messages.
var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter("$share/telemetry-processors/devices/+/telemetry")
    .Build();

await client.SubscribeAsync(subscribeOptions);
```

Deploy multiple instances of the consumer with the same shared subscription filter and the broker handles distribution automatically.

### Unsubscribing

```csharp
var unsubscribeOptions = factory.CreateUnsubscribeOptionsBuilder()
    .WithTopicFilter("devices/+/commands/#")
    .Build();

await client.UnsubscribeAsync(unsubscribeOptions);
```

---

## Building an MQTT Broker

MQTTnet includes a full MQTT broker implementation called `MqttServer`. A custom broker is worth considering when you need to authenticate clients against your own user store, apply routing logic, or run a broker embedded within a .NET application without deploying a separate Mosquitto or EMQX instance.

```csharp
using MQTTnet;
using MQTTnet.Server;

var factory = new MqttServerFactory();

var serverOptions = new MqttServerOptionsBuilder()
    .WithDefaultEndpoint()                    // Listens on port 1883
    .WithDefaultEndpointPort(1883)
    .Build();

using var server = factory.CreateMqttServer(serverOptions);
await server.StartAsync(serverOptions);

Console.WriteLine("Broker running. Press Enter to stop.");
Console.ReadLine();

await server.StopAsync();
```

### Client Authentication

Validate connecting clients by handling the `ValidatingConnectionAsync` event:

```csharp
server.ValidatingConnectionAsync += e =>
{
    if (e.UserName != "expected-user" || e.Password != "expected-password")
    {
        e.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
    }

    return Task.CompletedTask;
};
```

For certificate-based authentication, inspect `e.ClientCertificate` in the same handler. Returning without setting a reason code (or setting `MqttConnectReasonCode.Success`) allows the connection.

### Intercepting Published Messages

The broker can inspect or modify every message before routing it to subscribers:

```csharp
server.InterceptingPublishAsync += e =>
{
    var topic = e.ApplicationMessage.Topic;
    var clientId = e.ClientId;

    // Log all publishes for auditing.
    Console.WriteLine($"Client '{clientId}' published to '{topic}'");

    // Reject messages to topics the client is not authorized for.
    if (topic.StartsWith("admin/") && !IsAdminClient(clientId))
    {
        e.Response.ReasonCode = MqttPubAckReasonCode.NotAuthorized;
    }

    return Task.CompletedTask;
};
```

This interception point is also where you would bridge messages to another system, such as forwarding device telemetry to a database or event bus.

### When a Custom Broker Makes Sense

A custom `MqttServer` is a good fit for scenarios like embedding a broker inside a .NET gateway device, writing integration tests without depending on an external broker, or when client authentication must run against an existing .NET identity system.

For large-scale production deployments, purpose-built brokers like [Eclipse Mosquitto](https://mosquitto.org){:target="_blank" rel="noopener noreferrer"} or [EMQX](https://www.emqx.io){:target="_blank" rel="noopener noreferrer"} offer clustering, persistence, and operational tooling that `MqttServer` does not provide out of the box. Cloud services like Azure IoT Hub expose an MQTT endpoint and handle the broker concerns entirely.

---

## IoT-Specific Messaging Patterns

### Device Telemetry

Structure telemetry topics to reflect the physical hierarchy of your deployment. A common convention:

```
devices/{deviceId}/telemetry/{sensorType}
```

For example:
- `devices/building-a-floor-3-room-12/telemetry/temperature`
- `devices/building-a-floor-3-room-12/telemetry/co2`
- `devices/building-a-floor-3-room-12/telemetry/occupancy`

This hierarchy lets back-end services subscribe with wildcards at any level, so `devices/building-a/#` captures everything from that building while `devices/+/telemetry/temperature` captures temperature readings from all devices.

A device publishing periodic telemetry:

```csharp
public async Task PublishTelemetryAsync(
    IMqttClient client,
    string deviceId,
    double temperature,
    CancellationToken cancellationToken)
{
    var payload = JsonSerializer.SerializeToUtf8Bytes(new
    {
        Temperature = temperature,
        Unit = "celsius",
        Timestamp = DateTimeOffset.UtcNow
    });

    var message = new MqttApplicationMessageBuilder()
        .WithTopic($"devices/{deviceId}/telemetry/temperature")
        .WithPayload(payload)
        .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce)
        .Build();

    await client.PublishAsync(message, cancellationToken);
}
```

### Command Handling

A device subscribes to a command topic and executes actions when commands arrive:

```csharp
// Subscribe to commands for this device.
var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter($"devices/{deviceId}/commands/#",
        MqttQualityOfServiceLevel.AtLeastOnce)
    .Build();

await client.SubscribeAsync(subscribeOptions);

// Handle incoming commands.
client.ApplicationMessageReceivedAsync += async e =>
{
    var topic = e.ApplicationMessage.Topic;
    var segments = topic.Split('/');

    // Expecting: devices/{deviceId}/commands/{commandName}
    if (segments.Length >= 4 && segments[2] == "commands")
    {
        var commandName = segments[3];
        var payload = e.ApplicationMessage.ConvertPayloadToString();

        await DispatchCommandAsync(commandName, payload);
    }
};
```

Use QoS 1 for command subscriptions. Losing a command is usually worse than receiving a duplicate, and the device-side code should be idempotent where possible.

### Last Will and Testament

Last Will and Testament (LWT) is a message the broker sends automatically if the client disconnects unexpectedly without sending a proper DISCONNECT packet. This allows monitoring services to detect offline devices without polling:

```csharp
var willMessage = new MqttApplicationMessageBuilder()
    .WithTopic($"devices/{deviceId}/status")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Online = false, LastSeen = DateTimeOffset.UtcNow }))
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithRetainFlag(true)
    .Build();

var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 1883)
    .WithClientId(deviceId)
    .WithWillMessage(willMessage)
    .Build();
```

### Birth Messages

A birth message is a retained message the device publishes immediately after connecting to signal that it is online. Combined with LWT, this creates a reliable online/offline tracking system:

```csharp
client.ConnectedAsync += async e =>
{
    var birthMessage = new MqttApplicationMessageBuilder()
        .WithTopic($"devices/{deviceId}/status")
        .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new
        {
            Online = true,
            FirmwareVersion = "2.1.4",
            ConnectedAt = DateTimeOffset.UtcNow
        }))
        .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
        .WithRetainFlag(true)
        .Build();

    await client.PublishAsync(birthMessage);
};
```

Because both the birth message and the LWT message write to the same retained topic with the retain flag, monitoring services receive the current status immediately upon subscribing, regardless of when they connect.

### Request/Response with Correlation IDs (MQTT 5.0)

MQTT is inherently one-way, but MQTT 5.0 adds `ResponseTopic` and `CorrelationData` message properties to support request/response patterns without building your own correlation layer:

```csharp
var correlationId = Guid.NewGuid().ToByteArray();
var responseTopic = $"devices/{deviceId}/responses/{Guid.NewGuid()}";

// Subscribe to the response topic before sending the request.
await client.SubscribeAsync(factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter(responseTopic)
    .Build());

var request = new MqttApplicationMessageBuilder()
    .WithTopic($"services/config-service/requests")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Action = "get-config", DeviceId = deviceId }))
    .WithResponseTopic(responseTopic)
    .WithCorrelationData(correlationId)
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .Build();

await client.PublishAsync(request);

// The service responds to responseTopic with the same CorrelationData.
// Match the incoming message's CorrelationData to resolve the pending request.
```

The responder reads `ResponseTopic` and `CorrelationData` from the incoming request and echoes the correlation data back in the response. The requester matches the correlation data to identify which pending request the response belongs to.

---

## Running as a Hosted Service in ASP.NET Core

In a typical .NET application, you want the MQTT client running as a background service that starts with the application and shuts down gracefully. `IHostedService` is the right abstraction:

```csharp
public class MqttClientService : IHostedService, IDisposable
{
    private readonly IMqttClient _client;
    private readonly MqttClientOptions _options;
    private readonly ILogger<MqttClientService> _logger;

    public MqttClientService(ILogger<MqttClientService> logger)
    {
        _logger = logger;
        var factory = new MqttClientFactory();
        _client = factory.CreateMqttClient();

        _options = new MqttClientOptionsBuilder()
            .WithTcpServer("broker.example.com", 1883)
            .WithClientId("my-service")
            .WithCleanSession(false)
            .Build();

        _client.ApplicationMessageReceivedAsync += OnMessageReceived;
        _client.DisconnectedAsync += OnDisconnected;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await _client.ConnectAsync(_options, cancellationToken);

        await _client.SubscribeAsync(
            new MqttClientSubscribeOptionsBuilder()
                .WithTopicFilter("devices/+/telemetry/#")
                .Build(),
            cancellationToken);

        _logger.LogInformation("MQTT client connected and subscribed.");
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await _client.DisconnectAsync(
            new MqttClientDisconnectOptionsBuilder()
                .WithReason(MqttClientDisconnectOptionsReason.NormalDisconnection)
                .Build(),
            cancellationToken);
    }

    private Task OnMessageReceived(MqttApplicationMessageReceivedEventArgs e)
    {
        _logger.LogInformation("Received: {Topic}", e.ApplicationMessage.Topic);
        return Task.CompletedTask;
    }

    private async Task OnDisconnected(MqttClientDisconnectedEventArgs e)
    {
        _logger.LogWarning("Disconnected: {Reason}. Reconnecting...", e.Reason);
        await Task.Delay(TimeSpan.FromSeconds(5));
        await _client.ReconnectAsync();
    }

    public void Dispose() => _client.Dispose();
}
```

Register it in `Program.cs`:

```csharp
builder.Services.AddHostedService<MqttClientService>();
```

### Dependency Injection

If you need to publish messages from other parts of the application (controllers, other services), expose the client through a scoped or singleton interface:

```csharp
public interface IMqttPublisher
{
    Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default);
}

public class MqttPublisher : IMqttPublisher
{
    private readonly IMqttClient _client;

    public MqttPublisher(IMqttClient client) => _client = client;

    public async Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(JsonSerializer.SerializeToUtf8Bytes(payload))
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();

        await _client.PublishAsync(message, cancellationToken);
    }
}
```

Register both the client and publisher as singletons, since `IMqttClient` maintains a single persistent connection:

```csharp
builder.Services.AddSingleton<IMqttClient>(_ =>
{
    var factory = new MqttClientFactory();
    return factory.CreateMqttClient();
});

builder.Services.AddSingleton<IMqttPublisher, MqttPublisher>();
```

---

## Bridging to Azure IoT Hub

Azure IoT Hub exposes an MQTT endpoint that devices can connect to directly. IoT Hub acts as the broker, and you use a device connection string to derive the credentials:

```csharp
var deviceConnectionString = "HostName=my-hub.azure-devices.net;DeviceId=sensor-42;SharedAccessKey=...";
var builder = IotHubConnectionStringBuilder.Create(deviceConnectionString);

var sasToken = GenerateSasToken(
    resourceUri: $"{builder.HostName}/devices/{builder.DeviceId}",
    key: builder.SharedAccessKey,
    expiry: TimeSpan.FromHours(1));

var options = new MqttClientOptionsBuilder()
    .WithTcpServer(builder.HostName, 8883)
    .WithClientId(builder.DeviceId)
    .WithCredentials($"{builder.HostName}/{builder.DeviceId}/?api-version=2021-04-12", sasToken)
    .WithTlsOptions(tls => tls.UseTls())
    .Build();

await client.ConnectAsync(options);

// IoT Hub telemetry topic format.
await client.PublishAsync(new MqttApplicationMessageBuilder()
    .WithTopic($"devices/{builder.DeviceId}/messages/events/")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Temperature = 22.5 }))
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .Build());
```

IoT Hub uses specific topic conventions for device-to-cloud messages, cloud-to-device commands, and direct method invocations. The [Azure IoT Hub MQTT documentation](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support){:target="_blank" rel="noopener noreferrer"} covers the exact topic formats. In practice, the [Azure IoT SDK for .NET](https://github.com/Azure/azure-iot-sdk-csharp){:target="_blank" rel="noopener noreferrer"} wraps these conventions so you rarely need to construct them manually; using MQTTnet directly makes sense mainly for constrained devices where the full SDK is too heavy.

---

## Error Handling and Resilience

### Automatic Reconnection with Bounded Backoff

The reconnection handler shown earlier works for simple cases. For production services, wrap reconnection in a policy that respects the application's cancellation token:

```csharp
private async Task ReconnectWithBackoffAsync(CancellationToken cancellationToken)
{
    var delay = TimeSpan.FromSeconds(1);
    var maxDelay = TimeSpan.FromMinutes(5);

    while (!cancellationToken.IsCancellationRequested && !_client.IsConnected)
    {
        try
        {
            await Task.Delay(delay, cancellationToken);
            await _client.ReconnectAsync(cancellationToken);
            _logger.LogInformation("Reconnected successfully.");
            return;
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Reconnection failed. Retrying in {Delay}.", delay);
            delay = delay * 2 < maxDelay ? delay * 2 : maxDelay;
        }
    }
}
```

### Message Buffering During Disconnection

When publishing fails because the connection is down, you have several options. For telemetry where the latest reading is more valuable than older readings, a bounded channel that drops the oldest entry on overflow is appropriate:

```csharp
var channel = Channel.CreateBounded<MqttApplicationMessage>(new BoundedChannelOptions(1000)
{
    FullMode = BoundedChannelFullMode.DropOldest
});

// Producer: sensor reading loop.
await channel.Writer.WriteAsync(message);

// Consumer: send when connected.
await foreach (var msg in channel.Reader.ReadAllAsync(cancellationToken))
{
    if (_client.IsConnected)
        await _client.PublishAsync(msg, cancellationToken);
    // If disconnected, the message is simply dropped here,
    // which is acceptable for high-frequency telemetry.
}
```

For commands where loss is unacceptable, persist messages to a local store (SQLite, for example) and replay them after reconnection. This is more complex but guarantees delivery even across power cycles.

### Logging and Diagnostics

MQTTnet uses the standard `Microsoft.Extensions.Logging` abstractions when you configure them:

```csharp
var factory = new MqttClientFactory(new MqttNetEventLogger());
```

For structured logging in a hosted service, inject `ILogger<T>` and log inside event handlers. Log connection events, disconnections, and message receipt with appropriate log levels so you can trace issues in production without overwhelming the log stream with every message payload.

---

## Common Mistakes and How to Avoid Them

**Using QoS 2 for everything.** Each QoS 2 message completes a four-packet handshake, which is expensive when publishing thousands of telemetry readings per minute. Audit your QoS choices: telemetry generally belongs at QoS 0, commands at QoS 1, and QoS 2 only for cases where exactly-once semantics genuinely matter.

**Publishing to topics the client is also subscribed to.** If a device publishes to `devices/+/commands` and also subscribes with `devices/#`, it will receive its own messages back. Design topic hierarchies so publishers and subscribers use separate subtrees, or filter by client ID in the message handler.

**Forgetting the retain flag on status messages.** Without a retained status message, a monitoring service that connects after a device has already come online will not know the device is online until the device publishes again. Combine a retained birth message with LWT to give any subscriber an immediate view of device state.

**Not handling backpressure in message handlers.** If `ApplicationMessageReceivedAsync` performs slow I/O (database writes, HTTP calls), it can block the receive pipeline and cause the client to fall behind. Offload processing to a channel or background queue and return from the handler quickly.

**Sharing a single client across threads without synchronization.** `IMqttClient` is not thread-safe for publishing from multiple threads simultaneously. Use a dedicated publishing queue or wrap `PublishAsync` calls in a `SemaphoreSlim` if concurrent publishing is required.

**Missing articles in topic paths that include variables.** Topic strings like `devices//telemetry/temperature` (with an empty segment) occur when a device ID is null or empty. Validate input before constructing topic strings to avoid publishing to malformed topics that are difficult to debug.

---

## Key Takeaways

MQTTnet covers the full range of MQTT scenarios in .NET: lightweight device clients, back-end consumers, and custom embedded brokers, all within a single library. The patterns here follow the same structure regardless of scale.

For device code, the priority order is: connect with TLS and appropriate authentication, subscribe to command topics with QoS 1, publish telemetry with QoS 0, configure LWT before connecting, and publish a birth message immediately after connecting. That sequence gives you reliable state tracking and secure communication without over-engineering the messaging layer.

For back-end services consuming device data, the hosted service pattern with a reconnection loop and a bounded channel for buffering covers most production requirements. Shared subscriptions handle horizontal scaling when a single consumer instance cannot keep up with throughput.

The [MQTTnet documentation and samples](https://github.com/dotnet/MQTTnet/tree/master/Samples){:target="_blank" rel="noopener noreferrer"} on GitHub cover additional scenarios including managed clients with built-in reconnection logic and the full MQTT 5.0 feature set.
