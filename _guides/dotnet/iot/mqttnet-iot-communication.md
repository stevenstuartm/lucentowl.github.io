---
title: "MQTTnet for IoT Communication"
layout: guide
category: ".NET & C#"
subcategory: "IoT & Embedded"
description: "Building MQTT clients and an embedded broker in C# with MQTTnet 5: connecting over TLS, sessions under MQTT 5, publishing and subscribing, device status with last will and birth messages, request/response, keeping a connection alive in a hosted service, and buffering while offline."
tags: [practical, mqtt, mqttnet, iot, messaging, telemetry, tls]
---

## What Is MQTTnet

[MQTTnet](https://github.com/dotnet/MQTTnet){:target="_blank" rel="noopener noreferrer"} is an MQTT library for .NET, maintained under the dotnet GitHub organization. It provides both an MQTT client and an MQTT broker in C#, so either side of a connection can be .NET code.

MQTT is a publish/subscribe protocol: clients publish messages to topic strings on a broker, and the broker forwards each message to every client subscribed to a matching topic filter. Publishers and subscribers never address each other. This guide covers how MQTTnet exposes the protocol's features in C#. The protocol's own design choices, such as QoS levels, retained messages, last will, and topic design, are only summarized where the code needs them.

Version 5 is current, and its packages target .NET 8 and later. The client is in the `MQTTnet` package and the broker in a separate `MQTTnet.Server` package:

```bash
dotnet add package MQTTnet
dotnet add package MQTTnet.Server   # only if you host a broker
```

Version 5 changed the API in ways that break most older samples. The `MQTTnet.Client` namespace is gone and everything client-side lives in `MQTTnet`. `MqttFactory` became `MqttClientFactory` and `MqttServerFactory`. The managed client from `MQTTnet.Extensions.ManagedClient`, which reconnected and queued messages for you, was not carried forward, so reconnection and buffering are now your code. A sample that uses any of those names was written for version 4.

MQTTnet targets full .NET. On a microcontroller running .NET nanoFramework, MQTT comes from that platform's own `nanoFramework.M2Mqtt` package instead.

---

## Connecting a Client

`MqttClientFactory` creates clients, and `MqttClientOptionsBuilder` describes the connection:

```csharp
using MQTTnet;

var factory = new MqttClientFactory();
using var client = factory.CreateMqttClient();

var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithTlsOptions(tls => tls.UseTls())
    .WithClientId("device-sensor-42")
    .WithCredentials("my-username", "my-password")
    .Build();

MqttClientConnectResult result = await client.ConnectAsync(options);
Console.WriteLine($"Connected: {result.ResultCode}");
```

The client ID identifies the session on the broker and must be unique across every client connected to it. When a second client connects with the same ID, the broker disconnects the first, and two devices sharing an ID knock each other offline in a loop.

MQTTnet 5 connects with MQTT 5.0 unless you call `WithProtocolVersion`. The MQTT 5.0 features later in this guide (message expiry, content type, response topics, shared subscriptions) need it, and an old broker that only speaks MQTT 3.1.1 needs `WithProtocolVersion(MqttProtocolVersion.V311)` instead.

### TLS and Certificates

Port 8883 is the conventional port for MQTT over TLS, and 1883 for plain TCP. Use TLS for anything that leaves a lab network, because MQTT credentials otherwise cross the network in clear text.

`UseTls()` with no validation handler validates the broker's certificate against the operating system's trust store, which is what you want for a broker with a publicly trusted certificate. Supply `WithCertificateValidationHandler` only when the broker uses a private CA, and have the handler check the chain against that CA rather than returning `true`, which accepts any server.

For mutual TLS, where the device proves its identity with its own certificate rather than a password, add the client certificate:

```csharp
var clientCertificate = X509CertificateLoader.LoadPkcs12FromFile("device.pfx", "certificate-password");

var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithClientId("device-sensor-42")
    .WithTlsOptions(tls => tls
        .UseTls()
        .WithClientCertificates(new[] { clientCertificate }))
    .Build();
```

`X509CertificateLoader` (.NET 9) replaces the `X509Certificate2` constructors that take a file, which are obsolete from .NET 9.

### WebSockets

Some networks block port 8883 but allow HTTPS on 443. Brokers that support MQTT over WebSockets accept the same protocol wrapped in a WebSocket connection:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithWebSocketServer(o => o.WithUri("wss://broker.example.com/mqtt"))
    .WithClientId("device-sensor-42")
    .Build();
```

Only the options change. Publishing, subscribing, and message handling are identical over either transport.

### Sessions

A session is the broker's memory of a client between connections: its subscriptions, and the QoS 1 and 2 messages that arrived for it while it was offline. `WithCleanSession(true)`, the default, starts every connection with no session. A device that must receive commands sent while it was disconnected needs a persistent session. Under MQTT 5.0, that takes two settings:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithTlsOptions(tls => tls.UseTls())
    .WithClientId("device-sensor-42")
    .WithCleanSession(false)            // resume the existing session
    .WithSessionExpiryInterval(86400)   // keep it for 24 hours after disconnect
    .Build();
```

The expiry interval defaults to 0, which under MQTT 5.0 means the session ends the moment the connection closes. So `WithCleanSession(false)` alone looks correct and queues nothing. Only messages published at QoS 1 or 2 to a subscription made at QoS 1 or 2 are queued; QoS 0 messages sent while the client is away are dropped.

---

## Publishing Messages

A message is a topic, a payload, and a QoS level:

```csharp
var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/telemetry/temperature")
    .WithPayload("22.5")
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce)
    .Build();

MqttClientPublishResult result = await client.PublishAsync(message);
```

`PublishAsync` completes when the delivery step for the chosen QoS finishes: once the packet is written for QoS 0, and when the broker's acknowledgment arrives for QoS 1 and 2. `result.IsSuccess` is `false` when the broker rejects the message, for example because the client isn't authorized for the topic.

### Choosing a QoS

| QoS | Guarantee | Packets per message | Typical use |
|-----|-----------|---------------------|-------------|
| 0, `AtMostOnce` | May be lost | 1 | Frequent telemetry, where the next reading replaces a lost one |
| 1, `AtLeastOnce` | Arrives, possibly more than once | 2 | Commands, alerts, state changes |
| 2, `ExactlyOnce` | Arrives exactly once | 4 | Rare; when a duplicate would do harm and the receiver can't deduplicate |

QoS 2's four-packet handshake is two round trips per message, plus state held on both sides until it completes. Using it for all traffic multiplies broker load for no benefit on telemetry. Most systems use QoS 1 and make receivers idempotent, which costs half the packets and handles duplicates in one place.

The guarantee covers each hop separately. A message published at QoS 1 and delivered to a subscriber who subscribed at QoS 0 arrives at QoS 0, because delivery uses the lower of the two.

### JSON Payloads and Content Type

Payloads are bytes, and JSON is the common format for structured telemetry:

```csharp
var payload = JsonSerializer.SerializeToUtf8Bytes(new
{
    DeviceId = "sensor-42",
    Temperature = 22.5,
    Humidity = 58.3,
    Timestamp = DateTimeOffset.UtcNow
});

var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/telemetry")
    .WithPayload(payload)
    .WithContentType("application/json")  // MQTT 5.0
    .Build();

await client.PublishAsync(message);
```

`WithContentType` sets an MQTT 5.0 property that tells consumers how to decode the payload without inferring it from the topic. For Protocol Buffers or another binary format, serialize to a byte array the same way and set the matching content type.

### Retained Messages

A retained message is stored by the broker, one per topic, and delivered to each new subscriber as soon as it subscribes. That makes it the right tool for current state, such as a device's configuration or online status, which a dashboard needs the moment it connects rather than at the device's next publish:

```csharp
var stateMessage = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/config")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { SampleIntervalSeconds = 30, FirmwareVersion = "2.1.4" }))
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithRetainFlag(true)
    .Build();

await client.PublishAsync(stateMessage);
```

Each retained publish replaces the previous one on that topic. To delete it, publish an empty payload with the retain flag set.

### Message Expiry (MQTT 5.0)

An expiry interval, in seconds, tells the broker to discard a message it hasn't delivered within that window, whether it is queued for an offline subscriber or retained:

```csharp
var message = new MqttApplicationMessageBuilder()
    .WithTopic("devices/sensor-42/alerts/motion-detected")
    .WithPayload("true")
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithMessageExpiryInterval(30)
    .Build();
```

This keeps a subscriber that reconnects an hour later from acting on a motion alert that no longer means anything.

---

## Subscribing and Handling Messages

Register the message handler before subscribing, and before connecting when the session is persistent, because queued messages arrive as soon as the connection opens:

```csharp
client.ApplicationMessageReceivedAsync += async e =>
{
    string topic = e.ApplicationMessage.Topic;
    string payload = e.ApplicationMessage.ConvertPayloadToString();

    Console.WriteLine($"Received on {topic}: {payload}");
    await Task.CompletedTask;
};

var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter("devices/sensor-42/commands/#", MqttQualityOfServiceLevel.AtLeastOnce)
    .Build();

await client.SubscribeAsync(subscribeOptions);
```

In a topic filter, `+` matches exactly one level and `#` matches any number of remaining levels. So `devices/+/commands/#` matches `devices/sensor-42/commands/reboot` and `devices/gateway-1/commands/update-config/network`.

`e.ApplicationMessage.Payload` is a `ReadOnlySequence<byte>`. For JSON, deserialize from its bytes:

```csharp
var command = JsonSerializer.Deserialize<DeviceCommand>(e.ApplicationMessage.Payload.ToArray());
```

### How Handlers Run and When Messages Are Acknowledged

The client processes received messages one at a time, in arrival order. It awaits your handler, and only when the handler returns does it send the QoS 1 or 2 acknowledgment to the broker. Two consequences follow.

First, a slow handler delays every message behind it. A handler that writes to a database or calls an HTTP API on each message falls behind whenever messages arrive faster than it completes. Keep the handler short: copy what you need into a `Channel<T>` and process it elsewhere.

Second, an exception in the handler doesn't stop the client. The client logs it, skips the acknowledgment for that message, and moves on to the next one. The broker won't resend the unacknowledged message on the live connection. It redelivers only after a reconnect, and only if the session persisted, so under a clean session the message is simply lost. Catch exceptions inside the handler and decide per message. For explicit control, set `e.AutoAcknowledge = false` and call `await e.AcknowledgeAsync(cancellationToken)` yourself once processing succeeds.

`e.IsHandled` is a flag for your own code, useful when several handlers are attached to the event. It has no effect on acknowledgment.

### Shared Subscriptions (MQTT 5.0)

A shared subscription spreads one subscription's messages across a group of consumers, with each message going to exactly one member of the group. Every instance of a scaled-out back-end service subscribes with the same group name:

```csharp
var subscribeOptions = factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter("$share/telemetry-processors/devices/+/telemetry")
    .Build();

await client.SubscribeAsync(subscribeOptions);
```

The `$share/<group>/` prefix marks the subscription as shared. How the broker picks a member, whether round-robin, random, or least loaded, is up to the broker.

### Unsubscribing

```csharp
var unsubscribeOptions = factory.CreateUnsubscribeOptionsBuilder()
    .WithTopicFilter("devices/+/commands/#")
    .Build();

await client.UnsubscribeAsync(unsubscribeOptions);
```

---

## IoT Messaging Patterns

### Topic Layout

Put the device identity near the front of the topic and the kind of data after it:

```
devices/{deviceId}/telemetry/{measurement}
devices/{deviceId}/commands/{commandName}
devices/{deviceId}/status
```

With this shape, one wildcard subscription selects any slice a back end needs. `devices/+/telemetry/temperature` collects temperatures from every device, and `devices/sensor-42/#` follows one device. Validate the ID before building a topic string: a null or empty ID produces `devices//telemetry/temperature`, a valid topic that no subscriber is watching.

A device that publishes to its telemetry topics and subscribes to `devices/#` receives its own messages back. Subscribe to the narrowest filter the device needs, usually its own `commands/#` subtree.

### Command Handling

A device subscribes to its command subtree at QoS 1 and dispatches on the last topic level:

```csharp
await client.SubscribeAsync(factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter($"devices/{deviceId}/commands/#", MqttQualityOfServiceLevel.AtLeastOnce)
    .Build());

client.ApplicationMessageReceivedAsync += async e =>
{
    string[] segments = e.ApplicationMessage.Topic.Split('/');

    // devices/{deviceId}/commands/{commandName}
    if (segments.Length >= 4 && segments[2] == "commands")
    {
        await DispatchCommandAsync(segments[3], e.ApplicationMessage.ConvertPayloadToString());
    }
};
```

QoS 1 can deliver a command twice, so a command handler must be safe to run twice. "Set the sample interval to 30 seconds" is naturally idempotent; "increment the counter" is not, and needs an ID in the payload that the device remembers.

### Online Status: Last Will and Birth Messages

A **last will** is a message the client registers with the broker at connect time. The broker publishes it on the client's behalf if the connection ends without a clean DISCONNECT, which covers a crash, a power cut, or a network drop detected by the keep-alive timeout. A **birth message** is the opposite: a retained message the device publishes itself right after connecting.

Both write to the same retained status topic, so the topic always holds the latest state and a monitoring service that subscribes at any time learns it immediately:

```csharp
var options = new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithTlsOptions(tls => tls.UseTls())
    .WithClientId(deviceId)
    .WithWillTopic($"devices/{deviceId}/status")
    .WithWillPayload("""{"online":false}""")
    .WithWillQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithWillRetain(true)
    .Build();

await client.ConnectAsync(options);

// Birth message, published after every successful connect
await client.PublishAsync(new MqttApplicationMessageBuilder()
    .WithTopic($"devices/{deviceId}/status")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Online = true, FirmwareVersion = "2.1.4" }))
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .WithRetainFlag(true)
    .Build());
```

The will's payload is fixed at connect time, so it can't carry a "last seen" timestamp for the moment the device dropped. A consumer that needs that time records when the offline status arrived. A clean `DisconnectAsync` suppresses the will, so a device shutting down on purpose should publish its own offline status first.

### Request/Response (MQTT 5.0)

MQTT delivers messages in one direction. MQTT 5.0 adds two properties that let a requester ask for a reply without inventing a protocol: `ResponseTopic` names where the reply should go, and `CorrelationData` carries an ID the responder echoes back.

```csharp
string responseTopic = $"devices/{deviceId}/responses";
byte[] correlationId = Guid.NewGuid().ToByteArray();

// Subscribe to the response topic once, before sending any request
await client.SubscribeAsync(factory.CreateSubscribeOptionsBuilder()
    .WithTopicFilter(responseTopic)
    .Build());

var request = new MqttApplicationMessageBuilder()
    .WithTopic("services/config-service/requests")
    .WithPayload(JsonSerializer.SerializeToUtf8Bytes(new { Action = "get-config", DeviceId = deviceId }))
    .WithResponseTopic(responseTopic)
    .WithCorrelationData(correlationId)
    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
    .Build();

await client.PublishAsync(request);
```

The responder reads `ResponseTopic` and `CorrelationData` from the request and publishes its reply to that topic with the same correlation data. The requester keeps a dictionary of pending requests keyed by correlation ID, completes the matching `TaskCompletionSource` when a reply arrives, and times out requests that never get one. One response topic per client, subscribed once, is enough. A new topic per request costs a subscribe round trip each time.

---

## Hosting a Client in a Long-Running Service

### Reconnecting

A connection to a broker drops sooner or later, from a broker restart, a network change, or a missed keep-alive. MQTTnet 5 doesn't reconnect by itself.

MQTTnet's samples warn that reconnecting from inside the `DisconnectedAsync` event risks deadlocks, and recommend a separate loop that checks the connection with `TryPingAsync` and connects when it fails. The loop also performs the first connect, so there is one place where connecting, subscribing, and publishing the birth message happen:

```csharp
public sealed class MqttConnectionService(
    IMqttClient client,
    MqttClientOptions options,
    ILogger<MqttConnectionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(1);
        var maxDelay = TimeSpan.FromMinutes(2);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await client.TryPingAsync(stoppingToken))
                {
                    await client.ConnectAsync(options, stoppingToken);
                    await SubscribeAndAnnounceAsync(stoppingToken); // subscriptions, birth message
                    logger.LogInformation("MQTT connected");
                }

                delay = TimeSpan.FromSeconds(1);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "MQTT connect failed; retrying in {Delay}", delay);
                await Task.Delay(delay + TimeSpan.FromMilliseconds(Random.Shared.Next(1000)), stoppingToken);
                delay = delay * 2 < maxDelay ? delay * 2 : maxDelay;
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);

        if (client.IsConnected)
        {
            await client.DisconnectAsync(new MqttClientDisconnectOptionsBuilder()
                .WithReason(MqttClientDisconnectOptionsReason.NormalDisconnection)
                .Build(), cancellationToken);
        }
    }
}
```

The delay doubles after each failed attempt up to two minutes and resets after a success. The random jitter matters when a broker restarts under a fleet: without it, every device retries on the same schedule and the broker is hit by the whole fleet at once on every retry.

Subscriptions are re-sent after every connect because a clean session starts with none. With a persistent session the broker still has them, and re-subscribing is harmless.

### Sharing One Client

Register one `IMqttClient` and its options as singletons, and have the connection service and any publishing code share that instance. A client is one connection, and one connection per process is almost always what you want:

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton(_ => new MqttClientFactory().CreateMqttClient());
builder.Services.AddSingleton(_ => new MqttClientOptionsBuilder()
    .WithTcpServer("broker.example.com", 8883)
    .WithTlsOptions(tls => tls.UseTls())
    .WithClientId("telemetry-service")
    .Build());

builder.Services.AddSingleton<IMqttPublisher, MqttPublisher>();
builder.Services.AddHostedService<MqttConnectionService>();
```

Other code publishes through a small interface of your own, which keeps the rest of the application free of MQTTnet types and lets tests substitute a fake:

```csharp
public interface IMqttPublisher
{
    Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default);
}

public sealed class MqttPublisher(IMqttClient client) : IMqttPublisher
{
    public async Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(JsonSerializer.SerializeToUtf8Bytes(payload))
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();

        await client.PublishAsync(message, cancellationToken);
    }
}
```

Several threads can call `PublishAsync` on the same client at once. The client serializes packet writes to the connection internally, so concurrent publishes queue rather than interleave.

### Buffering While Disconnected

`PublishAsync` throws when the client isn't connected, so a device that keeps sampling through an outage needs somewhere to put readings. For telemetry, where recent readings matter more than old ones, a bounded channel that drops the oldest entry when full keeps memory fixed:

```csharp
var outbox = Channel.CreateBounded<MqttApplicationMessage>(new BoundedChannelOptions(1000)
{
    FullMode = BoundedChannelFullMode.DropOldest
});

// Producer: the sensor loop writes and never blocks
await outbox.Writer.WriteAsync(message, cancellationToken);

// Consumer: waits for a connection, then drains in order
await foreach (var msg in outbox.Reader.ReadAllAsync(cancellationToken))
{
    while (!client.IsConnected)
        await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);

    await client.PublishAsync(msg, cancellationToken);
}
```

A publish can still fail if the connection drops between the check and the send, and that message is lost. For telemetry that is usually fine. For messages that must survive a power cycle, write them to local storage such as SQLite, delete each one only after its QoS 1 publish succeeds, and replay the rest after reconnecting.

### Logging

MQTTnet has its own logging abstraction rather than `Microsoft.Extensions.Logging`. Pass an `MqttNetEventLogger` to the factory and forward its events to your `ILogger`:

```csharp
var mqttLogger = new MqttNetEventLogger();
mqttLogger.LogMessagePublished += (_, e) =>
    logger.LogDebug("MQTTnet {Source}: {Message}", e.LogMessage.Source, e.LogMessage.Message);

var factory = new MqttClientFactory(mqttLogger);
```

The library's internal messages are verbose, so route them at `Debug` and turn them on only while diagnosing connection problems. Log connects, disconnects with their reason, and failed publishes from your own code at `Information` or `Warning`.

---

## Hosting a Broker

The `MQTTnet.Server` package contains a complete MQTT broker, `MqttServer`, that runs inside a .NET process:

```csharp
using MQTTnet.Server;

var factory = new MqttServerFactory();

var serverOptions = new MqttServerOptionsBuilder()
    .WithDefaultEndpoint()           // plain TCP
    .WithDefaultEndpointPort(1883)
    .Build();

using var server = factory.CreateMqttServer(serverOptions);
await server.StartAsync();

Console.WriteLine("Broker running. Press Enter to stop.");
Console.ReadLine();

await server.StopAsync();
```

### Authenticating Clients

`ValidatingConnectionAsync` runs for each connection attempt. Setting a failure reason code rejects the client, and leaving it at the default accepts it:

```csharp
server.ValidatingConnectionAsync += e =>
{
    if (!credentialStore.IsValid(e.ClientId, e.UserName, e.Password))
    {
        e.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
    }

    return Task.CompletedTask;
};
```

This is the hook for checking clients against an existing .NET identity store rather than a broker's own password file.

### Intercepting Publishes

`InterceptingPublishAsync` sees every message before the broker routes it, which makes it the place for per-topic authorization, auditing, or forwarding messages to a database or event bus:

```csharp
server.InterceptingPublishAsync += e =>
{
    if (e.ApplicationMessage.Topic.StartsWith("admin/") && !IsAdminClient(e.ClientId))
    {
        e.ProcessPublish = false;  // don't route it
        e.Response.ReasonCode = MqttPubAckReasonCode.NotAuthorized;  // tell an MQTT 5.0 publisher why
    }

    return Task.CompletedTask;
};
```

`ProcessPublish = false` is what stops the message. The reason code only goes back to the publisher in its acknowledgment, and only MQTT 5.0 clients receive reason codes at all.

### When an Embedded Broker Fits

An in-process broker suits a gateway that aggregates local devices and forwards to the cloud, integration tests that need a real broker without external infrastructure, and small deployments where client authentication must use an existing .NET user store.

For a large fleet, a dedicated broker such as [Eclipse Mosquitto](https://mosquitto.org){:target="_blank" rel="noopener noreferrer"} or [EMQX](https://www.emqx.io){:target="_blank" rel="noopener noreferrer"} brings clustering, persistent session storage, and operational tooling that `MqttServer` leaves to you. Managed cloud services also expose MQTT endpoints and run the broker entirely. The client code in this guide works against any of them.
