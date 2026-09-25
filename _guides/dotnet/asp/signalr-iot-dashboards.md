---
title: "Real-Time IoT Dashboards with SignalR"
layout: guide
category: "ASP.NET Core"
subcategory: "Real-Time & RPC"
description: "Building live IoT dashboards on SignalR: the telemetry pipeline from IoT Hub to the browser through an ASP.NET Core backend or Azure Functions, throttling high-frequency readings, per-device subscriptions and their authorization, Blazor and JavaScript clients, dashboard patterns, and what drives Azure SignalR Service cost."
tags: [practical, iot, telemetry, signalr, azure-functions, event-hubs]
---

A dashboard that polls asks the server for new readings every few seconds and shows data that is up to one polling interval old. For a sensor that reports every 500 milliseconds, most of what it reports never appears. Pushing readings to the browser as they arrive fixes that, and SignalR is the ASP.NET Core way to push. This guide assumes SignalR's hubs, groups, `IHubContext`, and scale-out options, and covers what an IoT dashboard adds on top of them: a telemetry pipeline, throttling, per-device subscriptions, and the cost of fan-out. A dashboard that only needs to refresh every 30 seconds or so doesn't need any of it, and a timer that calls an API is simpler.

## The Telemetry Pipeline

Devices send telemetry to Azure IoT Hub. IoT Hub exposes the stream on a built-in endpoint that speaks the Event Hubs protocol: a durable, ordered log split into *partitions*, which readers pull from at their own pace. Something has to read that endpoint and push each reading to the browsers watching that device.

Azure SignalR Service, the managed option for holding client connections, runs in one of two modes that decide which design is possible. In *Default* mode, an ASP.NET Core app still hosts the hubs, and the service proxies the client connections to it. In *Serverless* mode, no hub server exists, and the application talks to the service through its REST API or Azure Functions bindings.

- **An ASP.NET Core backend.** A background service in the same app as the SignalR hub reads IoT Hub's endpoint, throttles the readings, and sends them to device groups through `IHubContext`. The app holds the client connections itself, or hands them to Azure SignalR Service in Default mode.
- **Azure Functions.** A function receives batches of IoT Hub events, and sends them through Azure SignalR Service in Serverless mode. No application server holds connections or runs continuously.

{% include figure.html id="asp-iot-dashboard-pipeline" %}

| Factor | ASP.NET Core backend | Azure Functions |
|--------|---------------------|---------------------------|
| **Azure SignalR Service mode** | Default, or none when self-hosted | Serverless |
| **Local development** | Runs locally with no Azure dependency for SignalR | Needs the Azure SignalR local emulator, which supports Serverless mode, or a live service |
| **Traffic pattern** | Steady, continuous telemetry | Spiky or intermittent telemetry |
| **Cold starts** | None, since the app is always running | Possible on the Consumption plan, which runs instances only while there is work |
| **Throttling and in-memory state** | In process, such as the latest reading per device | Needs an external store, since function instances don't share memory |
| **Subscriptions** | Hub methods over the SignalR connection | Separate HTTP functions |

The backend design keeps throttling, subscription checks, and device state in one process, which is why it is the easier one to reason about. The serverless design suits bursty fleets and teams that don't want to run a server, and pays for that with more moving parts per feature.

One IoT Hub setting silently breaks both designs. Once any message route is added to an IoT Hub, telemetry stops flowing to the built-in endpoint unless a route to that endpoint is also added. A dashboard that suddenly receives nothing after someone configured routing to storage has usually hit this.

## The ASP.NET Core Backend

### The Telemetry Hub

The hub's job in a dashboard is subscriptions. Each device, location, or tenant the UI can show becomes a group, and a browser joins the groups for what it is displaying. A viewer watching a floor map and one sensor's detail panel is in `location:floor-3` and `device:sensor-42` at once.

Subscription is also where authorization belongs. `[Authorize]` on the hub proves who the user is, but a signed-in user still shouldn't be able to join the group for a device they aren't allowed to see, so the hub checks before adding the connection:

```csharp
public record DeviceTelemetry(string DeviceId, long Sequence, DateTimeOffset Timestamp, double Temperature);

public interface ITelemetryClient
{
    Task ReceiveTelemetry(DeviceTelemetry telemetry);
    Task ThresholdAlert(string deviceId, string metric, double value);
    Task ThresholdCleared(string deviceId, string metric);
}

[Authorize]
public class TelemetryHub(IDeviceAuthorizationService deviceAuth) : Hub<ITelemetryClient>
{
    public async Task SubscribeToDevice(string deviceId)
    {
        if (!await deviceAuth.CanViewDeviceAsync(Context.UserIdentifier, deviceId))
        {
            throw new HubException($"Access denied to device {deviceId}");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"device:{deviceId}");
    }

    public Task UnsubscribeFromDevice(string deviceId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, $"device:{deviceId}");
}
```

`HubException` sends its message to the client, while any other exception reaches the client only as a generic error. Because group membership doesn't survive a reconnect, the client repeats its subscriptions after reconnecting, and each one passes through the same check. A dashboard served from another origin also needs the usual SignalR CORS policy on the hub, with credentials allowed.

### Reading from IoT Hub

The background service reads IoT Hub's built-in endpoint with `EventProcessorClient`, from the `Azure.Messaging.EventHubs.Processor` package. Readers belong to a *consumer group*, a named, independent read position on the stream. Within one consumer group, the processors on all of the app's instances share the partitions between them, each partition read by exactly one instance at a time. Each processor records how far it has read in each partition, a *checkpoint*, in blob storage, so a restarted instance resumes where it left off.

```csharp
public class IoTHubListenerService(
    TelemetryThrottle throttle,
    IConfiguration config,
    ILogger<IoTHubListenerService> logger) : BackgroundService
{
    private readonly ConcurrentDictionary<string, int> _eventsSinceCheckpoint = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var checkpoints = new BlobContainerClient(
            config["CheckpointStorage:ConnectionString"],
            config["CheckpointStorage:Container"]);

        var processor = new EventProcessorClient(
            checkpoints,
            "dashboard",                             // a consumer group of its own
            config["IoTHub:EventHubsCompatibleConnectionString"]);

        processor.ProcessEventAsync += HandleEventAsync;
        processor.ProcessErrorAsync += args =>
        {
            logger.LogError(args.Exception, "Error on partition {Partition}", args.PartitionId);
            return Task.CompletedTask;
        };

        await processor.StartProcessingAsync(stoppingToken);
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { }
        finally
        {
            await processor.StopProcessingAsync();
        }
    }

    private async Task HandleEventAsync(ProcessEventArgs args)
    {
        if (!args.HasEvent) return;

        // IoT Hub stamps the authenticated sender; don't trust an ID in the payload
        var deviceId = (string)args.Data.SystemProperties["iothub-connection-device-id"];
        var reading = args.Data.EventBody.ToObjectFromJson<DeviceTelemetry>(JsonSerializerOptions.Web);
        throttle.Update(reading with { DeviceId = deviceId });

        // Checkpoint every 100 events per partition rather than every event
        var count = _eventsSinceCheckpoint.AddOrUpdate(args.Partition.PartitionId, 1, (_, n) => n + 1);
        if (count >= 100)
        {
            await args.UpdateCheckpointAsync();
            _eventsSinceCheckpoint[args.Partition.PartitionId] = 0;
        }
    }
}
```

Three choices in that code matter in production.

- **The device ID comes from IoT Hub, not the payload.** IoT Hub adds the authenticated sender's ID to every message as the `iothub-connection-device-id` system property. A device that writes another device's ID into its payload could otherwise publish readings under that ID.
- **A consumer group of its own.** A dashboard that shares the default consumer group with storage archiving or analytics competes with them for the same partitions.
- **Checkpoint periodically.** Each checkpoint is a blob storage write, and writing one per event limits throughput. A dashboard can tolerate re-sending a few readings after a restart, so checkpointing every hundred events, or every few seconds, is a reasonable trade.

### Throttling High-Frequency Telemetry

Devices can report faster than a browser can render or a person can read. A sensor sending every 100 milliseconds is 10 updates per second, and a dashboard showing 50 such devices would receive 500 messages per second. A few updates per second per device is a reasonable starting point, tuned to what the charts can draw.

The throttle keeps only the latest reading per device and flushes on a timer, sending each device's reading at most once per interval, and only if a new one arrived:

```csharp
public class TelemetryThrottle(IHubContext<TelemetryHub, ITelemetryClient> hub) : BackgroundService
{
    private readonly ConcurrentDictionary<string, DeviceTelemetry> _pending = new();

    public void Update(DeviceTelemetry telemetry) => _pending[telemetry.DeviceId] = telemetry;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var sends = new List<Task>();
            foreach (var deviceId in _pending.Keys)
            {
                if (_pending.TryRemove(deviceId, out var latest))
                {
                    sends.Add(hub.Clients.Group($"device:{deviceId}").ReceiveTelemetry(latest));
                }
            }
            await Task.WhenAll(sends);   // one slow group doesn't hold up the others
        }
    }
}
```

The listener and the throttle must share one instance, so the throttle is registered as a singleton and the hosted service resolves that same instance:

```csharp
builder.Services.AddSignalR();
builder.Services.AddSingleton<TelemetryThrottle>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TelemetryThrottle>());
builder.Services.AddHostedService<IoTHubListenerService>();

app.MapHub<TelemetryHub>("/hubs/telemetry");
```

Throttling also protects the server from slow viewers. SignalR buffers outgoing data per connection, and once a client falls behind, a send to a group waits until every member's write completes. Sending the groups concurrently, as the flush loop does, stops one slow viewer from delaying other devices' updates. Keeping the message rate at what a dashboard can render keeps those buffers small.

On several instances, each instance's listener reads only the partitions it owns, so each throttle sees only some devices. The hub design still reaches every viewer, because `IHubContext` sends travel through the backplane or Azure SignalR Service to whichever instance holds each connection.

## The Azure Functions Pipeline

The serverless design runs on the Functions *isolated worker model*, in which functions are a separate .NET process, with the `Microsoft.Azure.Functions.Worker.Extensions.SignalRService` and `Microsoft.Azure.Functions.Worker.Extensions.EventHubs` packages. A function starts from a *trigger*, such as an HTTP request or a batch of events, and *bindings* connect it to other services declaratively, as inputs it receives or outputs it returns. The service runs in Serverless mode, so no hub class exists. Client calls can reach functions through the service's upstream endpoints and SignalR triggers, but plain HTTP functions are the simpler route, and the three below cover the basics.

A browser can't connect to the service without connection details, so the first function is a negotiate endpoint. Its input binding produces the service URL and an access token. The `UserId` expression ties the connection to the signed-in user from App Service authentication, the platform's built-in sign-in, which puts the user's ID in the `x-ms-client-principal-id` header. That header is trustworthy only when App Service authentication is enabled and requires sign-in, since otherwise a caller can set it.

```csharp
[Function("negotiate")]
public static string Negotiate(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req,
    [SignalRConnectionInfoInput(HubName = "telemetry", UserId = "{headers.x-ms-client-principal-id}")]
    string connectionInfo) => connectionInfo;
```

The second receives IoT Hub events in batches and produces one message per reading, each addressed to its device's group. Binding to `EventData` rather than strings keeps the system properties, so the device ID again comes from IoT Hub. Several messages go out through an output property on a return type:

```csharp
public class TelemetryMessages
{
    [SignalROutput(HubName = "telemetry")]
    public List<SignalRMessageAction> Messages { get; } = [];
}

[Function("ProcessTelemetry")]
public static TelemetryMessages ProcessTelemetry(
    [EventHubTrigger("messages/events", Connection = "IoTHubConnection", ConsumerGroup = "dashboard")]
    EventData[] events)
{
    var output = new TelemetryMessages();
    foreach (var evt in events)
    {
        var deviceId = (string)evt.SystemProperties["iothub-connection-device-id"];
        var reading = evt.EventBody.ToObjectFromJson<DeviceTelemetry>(JsonSerializerOptions.Web)
            with { DeviceId = deviceId };

        output.Messages.Add(new SignalRMessageAction("ReceiveTelemetry")
        {
            GroupName = $"device:{deviceId}",
            Arguments = [reading]
        });
    }
    return output;
}
```

Function instances share no memory, so the in-process throttle from the backend design doesn't carry over. Throttling here means reducing the rate before events reach the function, for example by having devices report less often, or keeping the latest reading per device in an external store and sending from a timer trigger.

The third handles subscriptions. It performs the same authorization check as the hub method, then adds the caller's connection to the device's group. It adds the connection rather than the user on purpose. A user added to a group stays in it, across page loads and devices, until removed or until the membership expires after as long as a year, so viewers would keep receiving, and the app keep paying for, devices no longer on screen. Connection membership ends when the connection does, like the hub design's. The function returns both an HTTP response and the group action:

```csharp
public class SubscribeResult
{
    [SignalROutput(HubName = "telemetry")]
    public SignalRGroupAction? GroupAction { get; set; }

    public required HttpResponseData Response { get; set; }
}

// In a functions class that receives IDeviceAuthorizationService as _deviceAuth
[Function("SubscribeToDevice")]
public async Task<SubscribeResult> Subscribe(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "subscribe/{deviceId}/{connectionId}")]
    HttpRequestData req,
    string deviceId,
    string connectionId)
{
    var userId = req.Headers.TryGetValues("x-ms-client-principal-id", out var ids) ? ids.Single() : null;
    if (userId is null || !await _deviceAuth.CanViewDeviceAsync(userId, deviceId))
    {
        return new SubscribeResult { Response = req.CreateResponse(HttpStatusCode.Forbidden) };
    }

    return new SubscribeResult
    {
        Response = req.CreateResponse(HttpStatusCode.OK),
        GroupAction = new SignalRGroupAction(SignalRGroupActionType.Add)
        {
            GroupName = $"device:{deviceId}",
            ConnectionId = connectionId
        }
    };
}
```

On the denial path `GroupAction` stays unset. Functions output bindings treat an unset output property as nothing to send, so no group action reaches the service. Test that behavior with the SignalR extension version in use, since the denial path is the security boundary.

The function trusts the connection ID the client sends, which is safe here because the authorization check is about the device, not the connection. A caller who passes someone else's connection ID can only send that connection telemetry the caller is already allowed to see.

## Building the Client

### JavaScript

The JavaScript client comes from the `@microsoft/signalr` npm package. Against the ASP.NET Core backend, the dashboard registers a handler per client method, reconnects automatically, and rejoins its device groups after every reconnect:

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/telemetry")
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .build();

connection.on("ReceiveTelemetry", telemetry => {
    if (loadingDevices.has(telemetry.deviceId)) return;   // see History and the Live Stream
    updateGauge(telemetry.deviceId, telemetry.temperature);
    updateChart(telemetry.deviceId, telemetry.timestamp, telemetry.temperature);
});

connection.on("ThresholdAlert", (deviceId, metric, value) => showAlert(deviceId, metric, value));

connection.onreconnecting(() => showBanner("Connection lost. Reconnecting..."));

connection.onreconnected(async () => {
    hideBanner();
    for (const deviceId of subscribedDevices) {
        await connection.invoke("SubscribeToDevice", deviceId);
    }
});

connection.onclose(() => setTimeout(start, 5000));   // start over once retries run out

async function start() {
    try {
        await connection.start();
        for (const deviceId of subscribedDevices) {
            await connection.invoke("SubscribeToDevice", deviceId);
        }
    } catch (err) {
        setTimeout(start, 5000);
    }
}

start();
```

The `onclose` handler matters for dashboards left open on a wall display, which otherwise go silently stale after an outage longer than the last retry delay. Browsers also put inactive tabs to sleep, which closes their SignalR connections. Microsoft's JavaScript client docs suggest holding a Web Lock while connected to keep a background tab awake.

Against the serverless design, `withUrl` points at the Function app's base URL, such as `https://telemetry-func.azurewebsites.net/api`, and the client appends `/negotiate` itself. Subscribing is an HTTP call to the subscribe function with the connection's ID, and the Function app needs a CORS policy for the dashboard's origin with credentials allowed:

```javascript
await fetch(`${apiBase}/subscribe/${deviceId}/${connection.connectionId}`,
    { method: "POST", credentials: "include" });
```

Chart libraries such as [Chart.js](https://www.chartjs.org){:target="_blank" rel="noopener noreferrer"} and [Apache ECharts](https://echarts.apache.org){:target="_blank" rel="noopener noreferrer"} update in place. The dashboard keeps a sliding window of points and redraws without animation, which keeps frequent updates smooth:

```javascript
const MAX_POINTS = 60;

function updateChart(deviceId, timestamp, value) {
    const chart = deviceCharts[deviceId];
    if (!chart) return;

    chart.data.labels.push(new Date(timestamp).toLocaleTimeString());
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update("none");   // skip the animation on each update
}
```

### Blazor Server

A Blazor Server app already keeps each user's UI state on the server, in a *circuit*, and sends UI updates over its own SignalR connection, so its components don't need a telemetry hub. The background service publishes readings to a singleton state service, and components subscribe to it:

```csharp
public class TelemetryState
{
    public event Action<DeviceTelemetry>? TelemetryReceived;

    public void Publish(DeviceTelemetry telemetry) => TelemetryReceived?.Invoke(telemetry);
}
```

```razor
@implements IDisposable
@inject TelemetryState Telemetry

<p>Temperature: @_temperature °C</p>

@code {
    [Parameter] public string DeviceId { get; set; } = "";
    private double _temperature;

    protected override void OnInitialized() => Telemetry.TelemetryReceived += OnTelemetry;

    private void OnTelemetry(DeviceTelemetry reading)
    {
        if (reading.DeviceId != DeviceId) return;
        _temperature = reading.Temperature;
        InvokeAsync(StateHasChanged);   // the event fires on a background thread
    }

    public void Dispose() => Telemetry.TelemetryReceived -= OnTelemetry;
}
```

`InvokeAsync` moves the re-render onto the component's synchronization context, since the event fires on the background service's thread. Unsubscribing in `Dispose` matters because the singleton's event would otherwise hold every component that ever subscribed, and keep it in memory.

This design has a scale-out trap the hub design doesn't. The state service is in-process, and on several instances each listener reads only its own partitions, so a user's circuit on one instance never sees devices whose partitions another instance owns. Giving each instance its own consumer group, so every instance reads the whole stream, fixes it for a few instances, since IoT Hub allows only 20 consumer groups per hub on the Standard tier. Beyond that, readings have to be relayed between instances, for example through a backplane.

### Blazor WebAssembly

Blazor WebAssembly runs .NET in the browser and uses the .NET SignalR client, from the `Microsoft.AspNetCore.SignalR.Client` package, compiled to WebAssembly. The component owns its connection and disposes it when the user navigates away:

```razor
@implements IAsyncDisposable
@inject NavigationManager Navigation

@code {
    [Parameter] public string DeviceId { get; set; } = "";
    private HubConnection? _connection;
    private DeviceTelemetry? _latest;

    protected override async Task OnInitializedAsync()
    {
        _connection = new HubConnectionBuilder()
            .WithUrl(Navigation.ToAbsoluteUri("/hubs/telemetry"))
            .WithAutomaticReconnect()
            .Build();

        _connection.On<DeviceTelemetry>("ReceiveTelemetry", reading =>
        {
            _latest = reading;
            InvokeAsync(StateHasChanged);
        });

        _connection.Reconnected += _ => _connection.InvokeAsync("SubscribeToDevice", DeviceId);

        await _connection.StartAsync();
        await _connection.InvokeAsync("SubscribeToDevice", DeviceId);
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null) await _connection.DisposeAsync();
    }
}
```

## Dashboard Patterns

### Sliding Windows and Point Budgets

A gauge showing one current value is cheap to update. A time-series chart grows with its window and its resolution, so the budget to watch is total points on screen. A 5-minute window at one point per second is 300 points per chart, 15,000 across 50 charts, and 60,000 for 100 devices over 10 minutes. Where redraw cost starts to show depends on the chart library and whether it draws to a canvas or to SVG, so the threshold has to be measured with the dashboard's real chart count. Keeping the latest value per device separate from each chart's window lets gauges and charts update independently.

### History and the Live Stream Together

A dashboard that opens with an empty chart and waits for readings shows no trend for minutes. Production dashboards load recent history from an API, then append live readings. The two sources have to meet without a gap or duplicates, and the order of operations decides that:

1. Mark the device as loading, so the main handler ignores it, and subscribe to the live stream, buffering what arrives.
2. Fetch history up to a cursor, the sequence number of the last reading it includes.
3. Draw the history, then apply the buffered readings after the cursor, drop the ones at or before it, and clear the loading mark.

Subscribing first means nothing that arrives during the history fetch is lost, and the cursor removes the overlap.

```javascript
async function openDevice(deviceId) {
    const buffered = [];
    const onReading = t => { if (t.deviceId === deviceId) buffered.push(t); };

    loadingDevices.add(deviceId);
    connection.on("ReceiveTelemetry", onReading);
    await connection.invoke("SubscribeToDevice", deviceId);

    const { points, cursor } = await fetch(`/api/telemetry/${deviceId}/history?hours=4`).then(r => r.json());
    points.forEach(p => appendToChart(deviceId, p.timestamp, p.temperature));

    connection.off("ReceiveTelemetry", onReading);
    buffered.filter(t => t.sequence > cursor)
            .forEach(t => appendToChart(deviceId, t.timestamp, t.temperature));
    loadingDevices.delete(deviceId);
}
```

### Threshold Alerts

Threshold checks belong on the server. They run whether or not anyone has a dashboard open, the server can record alert history, and every viewer sees the same alert at the same time. The server sends a dedicated `ThresholdAlert` message, separate from the telemetry stream, and a `ThresholdCleared` message when a later reading returns to the normal range. The client toggles a CSS class on the affected gauge rather than restyling it inline, which keeps theming in the stylesheet.

### Device Online Status

A dashboard's SignalR connections belong to viewers, not devices, so they say nothing about whether a device is online. IoT Hub knows, and publishes `Microsoft.Devices.DeviceConnected` and `Microsoft.Devices.DeviceDisconnected` events through Event Grid, Azure's service for delivering events to subscribers such as a function or webhook, which can forward them to the dashboard's groups. Two limits apply. The events cover only devices that connect over MQTT or AMQP, not devices that only make HTTPS requests. IoT Hub also reports state changes at least 60 seconds apart and can miss some, so a quick disconnect and reconnect may show up as two connect events in a row.

A second signal covers what those events miss. The server records each device's last telemetry time, and the dashboard marks a device stale when it has been silent for a few reporting intervals. That catches a device that is connected but not reporting, which connection events can't. Last-seen state belongs in a shared store such as Redis when the backend runs on more than one instance, since each instance's listener sees only its own partitions.

### Maps

A map view loads device positions once from an API, renders them with a library such as [Leaflet](https://leafletjs.com){:target="_blank" rel="noopener noreferrer"}, and updates marker colors or tooltips as readings arrive. Positions rarely change, asset tracking aside, so telemetry messages carry the device ID and readings, and the client looks the position up in its local cache rather than receiving coordinates with every reading.

## What Drives Azure SignalR Service Cost

Azure SignalR Service is sold in units, and connections decide how many are needed. A Standard or Premium unit holds 1,000 concurrent connections and includes 1,000,000 messages per day. Messages beyond that are billed per million rather than refused, while the Free tier allows 20 connections and 20,000 messages with no overage. For IoT dashboards, message volume usually drives the bill well past the unit price, because of how messages are counted.

- **Only outbound messages count.** A message the app sends to the service is free, and each copy the service delivers to a client is billed. A broadcast to a group of 100 viewers is 100 messages.
- **Large messages count several times.** Each 2 KB of a message counts as one message.

A single device group with 100 viewers, updated twice a second, is 200 billed messages per second, about 17 million a day. The 100 connections fit in one unit, whose included million messages leave about 16 million a day billed as overage. Throttling, keeping payloads under 2 KB, and sending viewers only the devices on their screen all reduce that directly.

Self-hosting avoids the per-message charge, and scaling out then needs sticky sessions plus a backplane such as Redis, with each server holding its share of the viewers' persistent connections.

## Key Takeaways

- Read IoT Hub's built-in endpoint with `EventProcessorClient` in a consumer group of its own, take the device ID from the `iothub-connection-device-id` system property, and checkpoint periodically rather than per event.
- Adding any IoT Hub message route stops the built-in endpoint's feed unless a route to it is added too.
- Throttle per device before sending to SignalR, keeping only the latest reading and flushing on a timer, and send groups concurrently so one slow viewer doesn't delay the rest.
- Authorize every device subscription, in the hub method or the subscribe function. In Serverless mode, add connections to groups rather than users, whose membership outlives the page.
- Rejoin device groups after every reconnect, and restart a connection that gave up, especially on unattended displays.
- Subscribe before fetching history, and merge the two on a cursor so the chart has no gap and no duplicates.
- Device online status comes from IoT Hub's connection events plus a last-seen timeout, not from SignalR connections.
- On Azure SignalR Service, units follow connections, and fan-out drives the message bill.
