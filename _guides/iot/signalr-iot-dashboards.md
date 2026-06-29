---
title: "Real-Time IoT Dashboards with SignalR"
layout: guide
category: IoT
subcategory: Dashboards & Apps
description: "Building real-time IoT dashboards with ASP.NET Core SignalR and Azure SignalR Service, covering the telemetry pipeline from device to browser, Blazor integration, and scaling patterns."
tags: [iot, dotnet, real-time, telemetry, azure, practical, architecture]
---

## Why SignalR for IoT Dashboards

Traditional web dashboards request data by polling: the browser sends an HTTP request every few seconds and waits for a response. For IoT telemetry, this approach wastes bandwidth, adds latency, and makes the dashboard feel sluggish. A temperature sensor reporting every 500 milliseconds deserves a dashboard that responds just as quickly, not one that checks every 5 seconds and misses most readings.

[ASP.NET Core SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction){:target="_blank" rel="noopener noreferrer"} inverts this pattern. Instead of the browser asking "do you have new data?", the server pushes updates to the browser the moment new telemetry arrives. The transport layer is WebSocket when the browser and network support it, with Server-Sent Events and long polling as fallbacks. For most modern deployments, WebSocket is what runs.

The fit with IoT is natural. Devices generate continuous streams of readings, and dashboards exist to make those streams visible in real time. SignalR provides a managed abstraction over the persistent connection, handles reconnection, and lets server code send to individual clients or groups of clients without tracking raw WebSocket handles.

[Azure SignalR Service](https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-overview){:target="_blank" rel="noopener noreferrer"} extends this further by offloading connection management to a managed service. Instead of your ASP.NET Core server holding thousands of open WebSocket connections, Azure SignalR Service holds them and your server just sends messages. This matters at IoT scale, where a single deployment might serve hundreds of simultaneous dashboard viewers across many device streams.

---

## SignalR Fundamentals

### Hubs

A hub is the server-side class that acts as the communication endpoint for connected clients. When a browser connects to a SignalR hub, the server can call methods on that client, and the client can call methods on the server. The connection is bidirectional by default, though IoT dashboards primarily use the server-to-client direction.

Hubs are defined by inheriting from `Hub` or `Hub<T>`. The strongly-typed `Hub<T>` variant is preferable for IoT work because it makes the interface between server and client explicit at compile time.

```csharp
public interface ITelemetryClient
{
    Task ReceiveTelemetry(DeviceTelemetry telemetry);
    Task DeviceStatusChanged(string deviceId, bool isOnline);
    Task ThresholdAlert(string deviceId, string metric, double value);
}

public class TelemetryHub : Hub<ITelemetryClient>
{
    public async Task SubscribeToDevice(string deviceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"device:{deviceId}");
    }

    public async Task UnsubscribeFromDevice(string deviceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"device:{deviceId}");
    }

    public async Task SubscribeToLocation(string locationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"location:{locationId}");
    }
}
```

The client receives telemetry by registering handlers for the methods declared in the interface. The interface enforces that server and client agree on method names and parameter types.

### Groups

Groups organize connections so you can target messages without broadcasting to everyone. For IoT dashboards, groups map naturally to device IDs, physical locations, customer tenants, or any other dimension your UI navigates by.

A connection can belong to multiple groups simultaneously. A user viewing a floor-level map and a specific sensor detail panel at the same time can be in both `location:floor-3` and `device:sensor-42` groups. When the server sends to `location:floor-3`, that user receives the update; when a reading arrives for sensor-42, they also receive that targeted update.

Groups are ephemeral by design. Membership does not survive a disconnection. When a client reconnects, it must rejoin the groups it needs. Plan for this in your client-side reconnection logic.

### Hub Context Outside Hubs

To push telemetry from non-hub code, such as a background service processing IoT Hub events, you inject `IHubContext<THub, TClient>`. This gives you access to the same Groups and Clients APIs without requiring an active hub method call.

```csharp
public class TelemetryProcessor
{
    private readonly IHubContext<TelemetryHub, ITelemetryClient> _hubContext;

    public TelemetryProcessor(IHubContext<TelemetryHub, ITelemetryClient> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastAsync(DeviceTelemetry telemetry)
    {
        await _hubContext.Clients
            .Group($"device:{telemetry.DeviceId}")
            .ReceiveTelemetry(telemetry);
    }
}
```

This pattern is what connects the IoT event pipeline to the browser. The hub handles client subscriptions; a background service processes incoming telemetry and calls back into the hub context to push updates.

---

## The IoT Dashboard Pipeline

Two pipeline architectures are common in production, and the right choice depends on your scale and infrastructure preferences.

### ASP.NET Core Backend Pattern

An ASP.NET Core application hosts the SignalR hub and runs a background service that subscribes to IoT Hub events. This is the simpler option to reason about and easier to debug locally.

```
IoT Device → Azure IoT Hub → ASP.NET Core Background Service → SignalR Hub → Browser
```

The background service uses the Azure Event Hubs SDK to consume events from the IoT Hub's built-in event hub endpoint. As events arrive, the service deserializes the telemetry payload and calls the hub context to push the data to subscribed clients.

### Azure Functions Serverless Pattern

An Azure Function with an Event Hub trigger processes IoT Hub events, and a SignalR output binding delivers the message to connected clients. Your server holds no persistent state; Azure SignalR Service manages all connections.

```
IoT Device → Azure IoT Hub → Azure Function (Event Hub trigger) → Azure SignalR Service → Browser
```

The serverless pattern shines when traffic is spiky. Functions scale to zero when no telemetry arrives and scale out automatically under load. You pay per execution rather than for always-on compute. The tradeoff is that cold starts can introduce brief latency on the first messages after an idle period.

### Choosing Between the Patterns

| Factor | ASP.NET Core Backend | Azure Functions Serverless |
|--------|---------------------|---------------------------|
| **Local development** | Easy (no Azure dependency) | Requires Azure SignalR emulator or live service |
| **Traffic pattern** | Steady continuous telemetry | Spiky or intermittent telemetry |
| **Cold start sensitivity** | None | Milliseconds to seconds on cold start |
| **Stateful logic** | Easy (in-process caching, device registry) | Harder (requires external state store) |
| **Ops overhead** | App Service or AKS to manage | Near zero managed infrastructure |
| **Scale ceiling** | Limited by App Service tier | Effectively unlimited (Azure SignalR Service tiers) |

---

## Building the ASP.NET Core Server

### Project Setup

Start with a standard ASP.NET Core web API project and add the SignalR package.

```bash
dotnet add package Microsoft.AspNetCore.SignalR
```

Register the hub and configure CORS to allow browser connections. IoT dashboards are often served from a different origin than the API, so CORS requires explicit configuration.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("DashboardPolicy", policy =>
    {
        policy.WithOrigins("https://dashboard.example.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});

builder.Services.AddHostedService<IoTHubListenerService>();
builder.Services.AddSingleton<TelemetryProcessor>();

var app = builder.Build();

app.UseCors("DashboardPolicy");
app.MapHub<TelemetryHub>("/hubs/telemetry");

app.Run();
```

### The IoT Hub Listener Background Service

The background service opens a connection to the IoT Hub event endpoint and processes telemetry continuously. The [Azure.Messaging.EventHubs](https://www.nuget.org/packages/Azure.Messaging.EventHubs.Processor){:target="_blank" rel="noopener noreferrer"} package provides the `EventProcessorClient` that handles partition management, checkpointing, and reconnection.

```csharp
public class IoTHubListenerService : BackgroundService
{
    private readonly EventProcessorClient _processor;
    private readonly TelemetryProcessor _telemetryProcessor;
    private readonly ILogger<IoTHubListenerService> _logger;

    public IoTHubListenerService(
        TelemetryProcessor telemetryProcessor,
        IConfiguration config,
        ILogger<IoTHubListenerService> logger)
    {
        _telemetryProcessor = telemetryProcessor;
        _logger = logger;

        var storageClient = new BlobContainerClient(
            config["CheckpointStorage:ConnectionString"],
            config["CheckpointStorage:Container"]);

        _processor = new EventProcessorClient(
            storageClient,
            EventHubConsumerClient.DefaultConsumerGroupName,
            config["IoTHub:ConnectionString"],
            config["IoTHub:EventHubName"]);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _processor.ProcessEventAsync += HandleEventAsync;
        _processor.ProcessErrorAsync += HandleErrorAsync;

        await _processor.StartProcessingAsync(stoppingToken);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        finally
        {
            await _processor.StopProcessingAsync();
        }
    }

    private async Task HandleEventAsync(ProcessEventArgs args)
    {
        if (args.HasEvent)
        {
            var json = Encoding.UTF8.GetString(args.Data.Body.ToArray());
            var telemetry = JsonSerializer.Deserialize<DeviceTelemetry>(json);

            if (telemetry is not null)
            {
                await _telemetryProcessor.BroadcastAsync(telemetry);
            }

            await args.UpdateCheckpointAsync();
        }
    }

    private Task HandleErrorAsync(ProcessErrorEventArgs args)
    {
        _logger.LogError(args.Exception,
            "Error on partition {Partition}", args.PartitionId);
        return Task.CompletedTask;
    }
}
```

### Throttling High-Frequency Telemetry

Devices can report faster than browsers can render. A temperature sensor sending every 100 milliseconds generates 10 updates per second per device, and if the dashboard shows 50 devices simultaneously, the browser receives 500 DOM updates per second. That is too much.

The solution is to aggregate or sample in the background service before pushing to SignalR. A simple approach holds the latest value for each device and flushes on a timer.

```csharp
public class TelemetryAggregator : BackgroundService
{
    private readonly ConcurrentDictionary<string, DeviceTelemetry> _latestByDevice = new();
    private readonly IHubContext<TelemetryHub, ITelemetryClient> _hubContext;

    public TelemetryAggregator(IHubContext<TelemetryHub, ITelemetryClient> hubContext)
    {
        _hubContext = hubContext;
    }

    public void Update(DeviceTelemetry telemetry)
    {
        _latestByDevice[telemetry.DeviceId] = telemetry;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            foreach (var (deviceId, telemetry) in _latestByDevice)
            {
                await _hubContext.Clients
                    .Group($"device:{deviceId}")
                    .ReceiveTelemetry(telemetry);
            }
        }
    }
}
```

This sends at most 2 updates per second per device regardless of how frequently IoT Hub delivers events. Adjust the timer interval to match what your charts and gauges can meaningfully render.

---

## Azure Functions and Azure SignalR Service

### Setting Up the Negotiate Endpoint

Browsers cannot connect directly to Azure SignalR Service without first obtaining a connection token. A negotiate endpoint provides this token. You expose it through an Azure Function with an HTTP trigger and a SignalR connection info input binding.

```csharp
[Function("negotiate")]
public static SignalRConnectionInfo Negotiate(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequest req,
    [SignalRConnectionInfoInput(HubName = "telemetry")] SignalRConnectionInfo connectionInfo)
{
    return connectionInfo;
}
```

The JavaScript client calls this endpoint first, receives the service URL and access token, then connects directly to Azure SignalR Service. Your Functions app never holds WebSocket connections.

### Processing IoT Hub Events in a Function

The Event Hub trigger fires when IoT Hub delivers events, and the SignalR output binding sends messages to connected clients. The binding configuration specifies the hub name and target method.

```csharp
[Function("ProcessTelemetry")]
[SignalROutput(HubName = "telemetry")]
public static SignalRMessageAction[] ProcessTelemetry(
    [EventHubTrigger("messages/events",
        Connection = "IoTHubConnection",
        ConsumerGroup = "signalr-dashboard")]
    string[] messages,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessTelemetry");
    var actions = new List<SignalRMessageAction>();

    foreach (var message in messages)
    {
        var telemetry = JsonSerializer.Deserialize<DeviceTelemetry>(message);
        if (telemetry is null) continue;

        actions.Add(new SignalRMessageAction("ReceiveTelemetry")
        {
            GroupName = $"device:{telemetry.DeviceId}",
            Arguments = new object[] { telemetry }
        });
    }

    return actions.ToArray();
}
```

Using a dedicated consumer group for the SignalR Function (rather than `$Default`) means other consumers of IoT Hub events, such as stream analytics jobs or storage archiving, read independently without competing for the same checkpoint position.

### Group Management in the Serverless Pattern

In the ASP.NET Core pattern, hub methods handle group subscriptions. In the serverless pattern, group management goes through its own Functions.

```csharp
[Function("SubscribeToDevice")]
[SignalROutput(HubName = "telemetry")]
public static SignalRGroupAction Subscribe(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "subscribe/{deviceId}")] HttpRequest req,
    string deviceId)
{
    var connectionId = req.Headers["x-signalr-connection-id"];

    return new SignalRGroupAction(SignalRGroupActionType.Add)
    {
        GroupName = $"device:{deviceId}",
        ConnectionId = connectionId
    };
}
```

The client includes its connection ID in the request header after completing negotiation. This approach works but is more complex than the hub method approach; the ASP.NET Core pattern handles subscriptions more naturally when stateful group management is important.

---

## Building the Client Side

### JavaScript Client

Install the SignalR client package from npm or reference it via CDN.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js"></script>
```

Build the connection, register handlers for the server methods, and start.

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/telemetry")
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

connection.on("ReceiveTelemetry", (telemetry) => {
    updateGauge(telemetry.deviceId, telemetry.temperature);
    updateChart(telemetry.deviceId, telemetry.timestamp, telemetry.temperature);
});

connection.on("DeviceStatusChanged", (deviceId, isOnline) => {
    updateStatusIndicator(deviceId, isOnline);
});

connection.on("ThresholdAlert", (deviceId, metric, value) => {
    showAlert(deviceId, metric, value);
});

connection.onreconnecting(() => {
    showBanner("Connection lost. Reconnecting...");
});

connection.onreconnected(async () => {
    hideBanner();
    // Rejoin groups after reconnect because group membership does not persist
    for (const deviceId of subscribedDevices) {
        await connection.invoke("SubscribeToDevice", deviceId);
    }
});

async function start() {
    try {
        await connection.start();
        await connection.invoke("SubscribeToDevice", "sensor-42");
    } catch (err) {
        console.error(err);
        setTimeout(start, 5000);
    }
}

start();
```

`withAutomaticReconnect` accepts an array of retry delays in milliseconds. The example above retries immediately, then at 2, 5, 10, and 30 second intervals. After the last value, the client stops retrying automatically, which is why the `onreconnecting` / `onreconnected` handlers exist alongside a manual fallback in the catch block.

### Updating Charts in Real Time

[Chart.js](https://www.chartjs.org){:target="_blank" rel="noopener noreferrer"} and [Apache ECharts](https://echarts.apache.org){:target="_blank" rel="noopener noreferrer"} both support dynamic data updates without re-rendering the full chart. The pattern is to maintain a sliding window of data points and push new values onto the array while shifting old ones off.

```javascript
const MAX_POINTS = 60; // show the last 60 readings

function updateChart(deviceId, timestamp, value) {
    const chart = deviceCharts[deviceId];
    if (!chart) return;

    chart.data.labels.push(new Date(timestamp).toLocaleTimeString());
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update("none"); // "none" disables animation for smoother real-time feel
}
```

Disabling animation on each update keeps the chart responsive under frequent data arrival. Reserve animations for the initial chart render.

### Blazor Server Integration

Blazor Server already runs on SignalR, where every component render is a SignalR message. Injecting `IHubContext<TelemetryHub, ITelemetryClient>` from server code and calling into your Blazor circuits is not the standard pattern. Instead, use a state service that components subscribe to.

```csharp
public class TelemetryStateService
{
    public event Action<DeviceTelemetry>? TelemetryReceived;

    public void Publish(DeviceTelemetry telemetry)
    {
        TelemetryReceived?.Invoke(telemetry);
    }
}
```

Register it as a singleton, inject it into your background service (which calls `Publish` when telemetry arrives), and inject it into Blazor components. Components subscribe to `TelemetryReceived` in `OnInitializedAsync` and call `StateHasChanged` wrapped in `InvokeAsync` to marshal back to the component's render context.

```csharp
@implements IDisposable
@inject TelemetryStateService TelemetryState

<p>Temperature: @_temperature °C</p>

@code {
    [Parameter] public string DeviceId { get; set; } = "";
    private double _temperature;

    protected override void OnInitialized()
    {
        TelemetryState.TelemetryReceived += OnTelemetryReceived;
    }

    private void OnTelemetryReceived(DeviceTelemetry telemetry)
    {
        if (telemetry.DeviceId != DeviceId) return;

        _temperature = telemetry.Temperature;
        InvokeAsync(StateHasChanged);
    }

    public void Dispose()
    {
        TelemetryState.TelemetryReceived -= OnTelemetryReceived;
    }
}
```

Always unsubscribe in `Dispose`. Components are disposed when the user navigates away, and a dangling event subscription to a singleton service keeps the component in memory indefinitely.

### Blazor WebAssembly Integration

Blazor WebAssembly runs entirely in the browser, so it uses the JavaScript SignalR client under the covers through the [Microsoft.AspNetCore.SignalR.Client](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client){:target="_blank" rel="noopener noreferrer"} NuGet package.

```csharp
var connection = new HubConnectionBuilder()
    .WithUrl(Navigation.ToAbsoluteUri("/hubs/telemetry"))
    .WithAutomaticReconnect()
    .Build();

connection.On<DeviceTelemetry>("ReceiveTelemetry", telemetry =>
{
    _latestReadings[telemetry.DeviceId] = telemetry;
    StateHasChanged();
});

await connection.StartAsync();
await connection.InvokeAsync("SubscribeToDevice", DeviceId);
```

Blazor WebAssembly has the same reconnection considerations as the JavaScript client. The `HubConnection` object should be scoped to the component's lifetime and disposed with the component so the WebSocket closes cleanly when navigation occurs.

---

## Dashboard Design Patterns

### Live Gauges and Sliding Windows

The most common IoT dashboard element is a gauge or sparkline that updates continuously. The effective implementation separates data management from rendering. Maintain a device state dictionary keyed by device ID; SignalR updates overwrite the latest value and trigger a re-render. Charts maintain their own rolling window of history independently.

For gauges showing a single current value, the update is simple and cheap. For time-series charts, cap the number of displayed points to control memory. A 5-minute window at 1-second resolution is 300 points per chart, so rendering 50 charts puts 15,000 data points in the browser. That is manageable. Extending to 30-second resolution at 600 points per chart across 100 devices starts to matter.

### Historical Data and Live Stream Together

Most production dashboards show both historical data (loaded on page open from an API) and a live stream arriving via SignalR. Load the last N hours of data on component initialization, then append real-time readings as they arrive. This gives the user context without waiting for the live stream to accumulate enough data to see trends.

```javascript
async function initializeDashboard(deviceId) {
    // Load historical data from REST API
    const history = await fetch(`/api/telemetry/${deviceId}/history?hours=4`)
        .then(r => r.json());

    history.forEach(point => appendToChart(deviceId, point.timestamp, point.value));

    // Subscribe to live updates
    await connection.invoke("SubscribeToDevice", deviceId);
}
```

Avoid duplicating data points. If the historical query returns data up to "now" and SignalR starts delivering events from "now", there is a gap. If the historical query returns data up to a timestamp in the past, SignalR may deliver points that overlap with history. Design the historical endpoint to return data up to a specific cursor time and start the SignalR subscription before fetching history, so no events are missed during the fetch.

### Threshold Alerts

Threshold checking can live on the server or the client. Server-side checking is preferable because it fires regardless of whether any browser is open, and the server can write alert history to a database. Push alert events through SignalR using a dedicated method (`ThresholdAlert`) so clients can display notifications separately from the telemetry stream.

On the client, highlight gauges and charts when a threshold is exceeded. Use CSS classes toggled by the component state rather than inline styles for easier theming.

```javascript
connection.on("ThresholdAlert", (deviceId, metric, value) => {
    const element = document.getElementById(`gauge-${deviceId}`);
    element.classList.add("gauge--alert");
    showToast(`${deviceId}: ${metric} exceeded threshold (${value})`);
});
```

Clear the alert state when a subsequent reading returns within the normal range. Send a `ThresholdCleared` event from the server using the same pattern.

### Device Status Boards

Tracking online and offline status requires presence detection, which SignalR supports through hub connection events. Override `OnConnectedAsync` and `OnDisconnectedAsync` in the hub to track which devices have active management connections, or use a heartbeat pattern where devices periodically invoke a hub method.

For large deployments, device presence is better tracked in a persistent store like Redis rather than in-memory. An in-memory dictionary is lost on server restart, and with multiple server instances, each instance only sees its own connections.

```csharp
public override async Task OnConnectedAsync()
{
    var deviceId = Context.GetHttpContext()?.Request.Query["deviceId"];
    if (!string.IsNullOrEmpty(deviceId))
    {
        await _deviceRegistry.SetOnlineAsync(deviceId, true);
        await Clients.All.DeviceStatusChanged(deviceId, true);
    }

    await base.OnConnectedAsync();
}

public override async Task OnDisconnectedAsync(Exception? exception)
{
    var deviceId = Context.GetHttpContext()?.Request.Query["deviceId"];
    if (!string.IsNullOrEmpty(deviceId))
    {
        await _deviceRegistry.SetOnlineAsync(deviceId, false);
        await Clients.All.DeviceStatusChanged(deviceId, false);
    }

    await base.OnDisconnectedAsync(exception);
}
```

### Map-Based Dashboards

Displaying device locations on a map with live telemetry overlays combines static position data with real-time readings. Load device positions from a REST endpoint on page open, render them on a map using a library like [Leaflet](https://leafletjs.com){:target="_blank" rel="noopener noreferrer"}, and update the marker tooltips or colors as telemetry arrives through SignalR.

The device position is typically static or changes slowly (asset tracking being the exception). Separate the position data from the telemetry data to avoid sending coordinates with every reading. The SignalR message contains device ID and sensor values; the client looks up the position from its local cache.

---

## Scaling Considerations

### Self-Hosted Connection Limits

A single ASP.NET Core server running on a standard VM can maintain roughly 5,000 to 20,000 concurrent WebSocket connections, depending on memory and the payload size per message. IoT dashboards with many simultaneous viewers hit this ceiling faster than you might expect, especially if each viewer subscribes to many device streams.

The first scaling option is to add a Redis backplane using [Microsoft.AspNetCore.SignalR.StackExchangeRedis](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.StackExchangeRedis){:target="_blank" rel="noopener noreferrer"}. With a Redis backplane, messages sent on one server instance are relayed to all other instances, so connections are distributed across servers while group broadcasts still reach all relevant clients.

```csharp
builder.Services.AddSignalR()
    .AddStackExchangeRedis(config["Redis:ConnectionString"], options =>
    {
        options.Configuration.ChannelPrefix = RedisChannel.Literal("iot-dashboard");
    });
```

The Redis backplane adds latency (a round trip to Redis for every broadcast) and cost, and it requires a highly available Redis deployment. For most IoT dashboard workloads, the simpler alternative is Azure SignalR Service.

### Azure SignalR Service Tiers

Azure SignalR Service removes connection limits from your application servers entirely. Your server sends a message to the service, and the service delivers it to all relevant connections. The service handles the WebSocket state.

| Tier | Connections | Messages/day | Use case |
|------|-------------|-------------|----------|
| **Free** | 20 | 20,000 | Development and testing |
| **Standard (1 unit)** | 1,000 | 1,000,000 | Small production workloads |
| **Standard (N units)** | 1,000 x N | 1,000,000 x N | Scale by adding units |
| **Premium** | Same as Standard | Same + SLA guarantees | Production with SLA requirements |

Add the Azure SignalR Service SDK and change one line in startup.

```csharp
builder.Services.AddSignalR()
    .AddAzureSignalR(config["AzureSignalR:ConnectionString"]);
```

No other application code changes. The hub, groups, and hub context all behave identically. The managed service handles connections; your server handles business logic.

### Backpressure

When the server sends faster than a client can process, SignalR buffers messages in the client's send queue. If the queue fills, the connection is dropped. This is backpressure, and IoT workloads are particularly susceptible to it because telemetry can spike suddenly.

Configure per-client buffer limits in the hub options to control how aggressively this happens.

```csharp
builder.Services.AddSignalR(options =>
{
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
});
```

The more effective mitigation is rate limiting before the message reaches SignalR, using the aggregator pattern shown earlier. Clients should never receive more messages per second than they can render. A 60 Hz monitor can render at most 60 frames per second, and most dashboards need far fewer updates than that to feel real-time; 2 to 4 updates per second is usually sufficient.

### Sticky Sessions

Self-hosted SignalR without a backplane requires sticky sessions (session affinity) at the load balancer so each client always routes to the same server. Without sticky sessions, hub method calls may reach a different server than the one holding the connection, causing failures.

Azure SignalR Service and the Redis backplane both eliminate the need for sticky sessions because they decouple connection state from application server state.

---

## Security

### Authenticating SignalR Connections

SignalR connections authenticate the same way as standard HTTP endpoints: JWT bearer tokens. The SignalR JavaScript client sends the token as a query parameter during negotiation because browsers do not support custom headers on WebSocket upgrade requests.

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/telemetry", {
        accessTokenFactory: () => getAccessToken() // returns the JWT string
    })
    .build();
```

On the server, configure JWT authentication and apply the `[Authorize]` attribute to the hub.

```csharp
[Authorize]
public class TelemetryHub : Hub<ITelemetryClient>
{
    // Hub methods are now protected by authentication
}
```

The SignalR middleware reads the token from the `access_token` query parameter automatically when the `OnMessageReceived` event is wired up during JWT configuration.

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(token) &&
                    path.StartsWithSegments("/hubs/telemetry"))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });
```

### Authorizing Group Subscriptions

Authentication confirms who the user is; authorization controls which device groups they can subscribe to. A user should only receive telemetry for devices they have permission to view.

```csharp
public class TelemetryHub : Hub<ITelemetryClient>
{
    private readonly IDeviceAuthorizationService _authService;

    public TelemetryHub(IDeviceAuthorizationService authService)
    {
        _authService = authService;
    }

    public async Task SubscribeToDevice(string deviceId)
    {
        var userId = Context.UserIdentifier;

        if (!await _authService.CanViewDeviceAsync(userId, deviceId))
        {
            throw new HubException($"Access denied to device {deviceId}");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"device:{deviceId}");
    }
}
```

Throwing `HubException` sends the error message back to the client without revealing server internals. Other exception types result in a generic error response.

### CORS Configuration

SignalR connections from a browser require CORS to be configured correctly. The most common mistake is forgetting `AllowCredentials()`, which SignalR requires because it uses cookies or authentication headers. `AllowCredentials()` cannot be combined with wildcard origins (`AllowAnyOrigin()`); you must list origins explicitly.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("DashboardPolicy", policy =>
    {
        policy
            .WithOrigins(
                "https://dashboard.example.com",
                "https://staging-dashboard.example.com")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
```

For development, add `https://localhost:3000` (or whatever port your dashboard dev server uses) to the allowed origins. Avoid `AllowAnyOrigin()` in production; it prevents `AllowCredentials()` and opens the endpoint to cross-site request forgery.

---

## Putting It Together

A production IoT dashboard using SignalR combines several of the patterns above. Azure SignalR Service manages connections at scale, a dedicated consumer group on IoT Hub isolates the dashboard's event processing from other consumers, the aggregator pattern limits browser update rates to what charts can render, and JWT authentication restricts each user to their authorized device groups.

The complete data flow from device to browser: a device reports a temperature reading to IoT Hub, an Azure Function or background service picks it up from the event stream, deserializes the payload, optionally aggregates with recent readings, then pushes the value via `IHubContext` (or SignalR output binding) to the `device:{id}` group. Browsers subscribed to that group receive the update through their persistent WebSocket connection, update the chart's data array, and render the new point without any polling, page refresh, or user interaction.

The dashboard feels live because it is live. The connection stays open, updates arrive as they happen, and the browser renders them immediately. For IoT workloads where the value of a reading depends on its freshness, this pipeline is the difference between a useful monitoring tool and a slow report.
