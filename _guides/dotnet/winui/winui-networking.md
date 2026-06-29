---
title: "Networking and Remote Communication"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Making HTTP requests, calling gRPC services, and establishing WebSocket connections in WinUI 3 desktop applications using standard .NET networking libraries."
tags: [winui, winui-3, networking, http, grpc, websocket, desktop, practical]
---

## Networking in WinUI 3

WinUI 3 runs on full .NET, which means every networking library available to a console app or ASP.NET service is equally available to your desktop application. This is a significant departure from UWP, which imposed a capability model and sandbox restrictions that limited what networking operations were possible without explicit declarations in the app manifest. A WinUI 3 application can open raw sockets, use `HttpClient` freely, establish WebSocket connections, and connect to gRPC services without any special configuration beyond adding the relevant NuGet packages.

The practical implication is that patterns and libraries that .NET developers are already familiar with from server-side work translate directly. If you have written `HttpClient` code in ASP.NET Core, that code works in WinUI 3 without modification. The same applies to Polly for resilience, `Grpc.Net.Client` for remote procedure calls, and `ClientWebSocket` for persistent connections. Desktop-specific concerns, such as dispatching UI updates from network callbacks back to the UI thread, are real but manageable with `async/await` and `DispatcherQueue`.

---

## Making HTTP Requests with HttpClient

[HttpClient](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.httpclient){:target="_blank" rel="noopener noreferrer"} is the standard class for making HTTP requests in .NET. The most important thing to understand about `HttpClient` is its intended lifetime: it is designed to be long-lived and reused across many requests, not created and disposed per-request. Creating a new `HttpClient` for each request exhausts socket connections due to TIME_WAIT states and degrades performance under load.

The correct way to manage `HttpClient` lifetime in a WinUI 3 application is through `IHttpClientFactory`, which is part of [Microsoft.Extensions.Http](https://www.nuget.org/packages/Microsoft.Extensions.Http){:target="_blank" rel="noopener noreferrer"}. The factory manages a pool of `HttpMessageHandler` instances, handles their lifecycle to avoid socket exhaustion, and allows you to configure named or typed clients with base addresses and default headers.

```csharp
// Register in App.xaml.cs or with the generic host
services.AddHttpClient("WeatherApi", client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Or use a typed client
services.AddHttpClient<IWeatherService, WeatherService>(client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
});
```

A typed client wraps `HttpClient` and is registered as a transient service, though the underlying handler is pooled. This is the cleanest pattern for WinUI 3 because it integrates with the DI container and keeps networking logic out of ViewModels.

```csharp
public class WeatherService : IWeatherService
{
    private readonly HttpClient _client;

    public WeatherService(HttpClient client)
    {
        _client = client;
    }

    public async Task<WeatherForecast?> GetForecastAsync(string city, CancellationToken ct = default)
    {
        var response = await _client.GetAsync($"forecast?city={Uri.EscapeDataString(city)}", ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<WeatherForecast>(cancellationToken: ct);
    }
}
```

`ReadFromJsonAsync` is an extension method from [System.Net.Http.Json](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.json){:target="_blank" rel="noopener noreferrer"} that deserializes the response body using `System.Text.Json`. For POST requests with a JSON body, the equivalent is `PostAsJsonAsync`, which serializes the object and sets the `Content-Type` header automatically.

For authentication, the standard approach is to add an `Authorization` header. Bearer token authentication is common when calling APIs that use OAuth 2.0 or JWT tokens.

```csharp
public async Task<T?> GetAuthorizedAsync<T>(string path, string bearerToken, CancellationToken ct = default)
{
    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
    var response = await _client.SendAsync(request, ct);
    response.EnsureSuccessStatusCode();
    return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct);
}
```

For APIs that use API keys, you can either set a default header when configuring the client in the factory, or add the key as a query parameter per request depending on the API's requirements.

---

## Resilience and Retry Policies

Network calls fail. Servers return 503 responses under load, connections time out in flaky Wi-Fi environments, and transient faults resolve themselves if retried after a short delay. Building retry logic directly into service methods produces repetitive, inconsistent code that is hard to test and easy to get wrong.

[Polly](https://github.com/App-vNext/Polly){:target="_blank" rel="noopener noreferrer"} is the standard library for resilience in the .NET ecosystem. It provides composable policies for retries with exponential backoff, circuit breakers that stop calling a failing service, timeouts, and bulkheads that limit concurrency. Polly integrates cleanly with `IHttpClientFactory` through the `Microsoft.Extensions.Http.Polly` package.

```csharp
services.AddHttpClient<IWeatherService, WeatherService>(client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
})
.AddTransientHttpErrorPolicy(builder =>
    builder.WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (outcome, timeSpan, retryCount, context) =>
        {
            Debug.WriteLine($"Retry {retryCount} after {timeSpan.TotalSeconds}s");
        }))
.AddTransientHttpErrorPolicy(builder =>
    builder.CircuitBreakerAsync(
        handledEventsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30)));
```

`AddTransientHttpErrorPolicy` applies the policy to responses that represent transient failures: HTTP 5xx responses and network-level exceptions. The circuit breaker pattern is particularly useful in desktop applications because it prevents the UI from hanging on repeated calls to a service that is down; after five consecutive failures the circuit opens and subsequent calls fail fast without attempting the network operation.

Microsoft also ships [Microsoft.Extensions.Http.Resilience](https://www.nuget.org/packages/Microsoft.Extensions.Http.Resilience){:target="_blank" rel="noopener noreferrer"}, which provides a higher-level API built on top of Polly through the `AddStandardResilienceHandler()` extension. This applies a sensible default configuration including rate limiters, retries, and circuit breaking with a single method call, which is appropriate when you want consistent behavior without tuning each policy individually.

```csharp
services.AddHttpClient<IWeatherService, WeatherService>()
    .AddStandardResilienceHandler();
```

---

## gRPC Services

[gRPC](https://grpc.io){:target="_blank" rel="noopener noreferrer"} is a high-performance remote procedure call framework that uses Protocol Buffers for serialization and HTTP/2 for transport. Compared to REST, gRPC provides strongly-typed contracts defined in `.proto` files, efficient binary serialization, and built-in support for streaming scenarios. It is well suited for communication with backend microservices where performance matters and the schema is shared between client and server.

WinUI 3 applications use gRPC through [Grpc.Net.Client](https://www.nuget.org/packages/Grpc.Net.Client){:target="_blank" rel="noopener noreferrer"}, which is the .NET implementation of the gRPC client. You define the service contract in a `.proto` file, add the file to the project with a `<Protobuf>` build item, and the Grpc tooling generates C# client classes at build time.

```protobuf
// weather.proto
syntax = "proto3";
option csharp_namespace = "WeatherApp.Grpc";

service WeatherService {
  rpc GetForecast (ForecastRequest) returns (ForecastReply);
  rpc StreamForecasts (ForecastRequest) returns (stream ForecastReply);
}

message ForecastRequest {
  string city = 1;
}

message ForecastReply {
  string summary = 1;
  float temperature_c = 2;
}
```

```xml
<!-- In the .csproj file -->
<ItemGroup>
  <Protobuf Include="Protos\weather.proto" GrpcServices="Client" />
</ItemGroup>
```

After building, the generated `WeatherService.WeatherServiceClient` class is available. You create a channel to the server address and instantiate the client from that channel.

```csharp
using Grpc.Net.Client;
using WeatherApp.Grpc;

public class GrpcWeatherService : IWeatherService
{
    private readonly WeatherServiceClient _client;

    public GrpcWeatherService(GrpcChannel channel)
    {
        _client = new WeatherServiceClient(channel);
    }

    public async Task<ForecastReply> GetForecastAsync(string city, CancellationToken ct = default)
    {
        return await _client.GetForecastAsync(
            new ForecastRequest { City = city },
            cancellationToken: ct);
    }
}
```

Streaming scenarios are where gRPC demonstrates its advantage over request-response HTTP. A server-streaming RPC allows the server to push multiple messages to the client after a single request, which is useful for progressively loading large datasets or receiving live updates.

```csharp
public async IAsyncEnumerable<ForecastReply> StreamForecastsAsync(
    string city,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    using var call = _client.StreamForecasts(new ForecastRequest { City = city });
    await foreach (var reply in call.ResponseStream.ReadAllAsync(ct))
    {
        yield return reply;
    }
}
```

The `GrpcChannel` is expensive to create and should be registered as a singleton in the DI container. If the server address is known at startup, create the channel once during service registration and inject it into the client service.

```csharp
services.AddSingleton(GrpcChannel.ForAddress("https://api.example.com"));
services.AddSingleton<IWeatherService, GrpcWeatherService>();
```

---

## WebSocket Connections

WebSockets provide a persistent, full-duplex communication channel over a single TCP connection. Unlike HTTP, where each request-response pair is independent, a WebSocket connection stays open and allows either side to send messages at any time. This makes WebSockets appropriate for scenarios like chat, live dashboards displaying real-time metrics, multiplayer game state, and collaborative document editing.

The .NET standard library includes [ClientWebSocket](https://learn.microsoft.com/en-us/dotnet/api/system.net.websockets.clientwebsocket){:target="_blank" rel="noopener noreferrer"}, which handles connection lifecycle, message sending, and receiving.

```csharp
public class WebSocketClient : IAsyncDisposable
{
    private readonly ClientWebSocket _socket = new();

    public async Task ConnectAsync(Uri serverUri, CancellationToken ct = default)
    {
        await _socket.ConnectAsync(serverUri, ct);
    }

    public async Task SendAsync(string message, CancellationToken ct = default)
    {
        var buffer = Encoding.UTF8.GetBytes(message);
        await _socket.SendAsync(
            new ArraySegment<byte>(buffer),
            WebSocketMessageType.Text,
            endOfMessage: true,
            ct);
    }

    public async IAsyncEnumerable<string> ReceiveAsync(
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var buffer = new byte[4096];
        while (_socket.State == WebSocketState.Open)
        {
            var result = await _socket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, ct);
                yield break;
            }
            yield return Encoding.UTF8.GetString(buffer, 0, result.Count);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_socket.State == WebSocketState.Open)
        {
            await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
        }
        _socket.Dispose();
    }
}
```

The receive loop runs continuously until the connection closes or the cancellation token is triggered. In a WinUI 3 application, you typically start this loop as a background operation when the user opens a page that requires live data, and cancel it when they navigate away.

One practical consideration is reconnection. WebSocket connections drop due to network interruptions, server restarts, and timeouts from idle connections. Building reconnection logic into the client service, with exponential backoff similar to the HTTP retry pattern, prevents the application from silently losing its live data feed.

---

## SignalR Client

[SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction){:target="_blank" rel="noopener noreferrer"} is an ASP.NET Core library that abstracts real-time communication behind a Hub concept. From the client perspective, SignalR handles transport negotiation (preferring WebSockets but falling back to Server-Sent Events or long polling), connection management, and serialization. If your backend uses SignalR, the client library provides a more ergonomic API than working with raw WebSockets.

The client package is [Microsoft.AspNetCore.SignalR.Client](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client){:target="_blank" rel="noopener noreferrer"}. You build a connection with `HubConnectionBuilder`, specifying the hub URL and any authentication or retry configuration.

```csharp
var connection = new HubConnectionBuilder()
    .WithUrl("https://api.example.com/hubs/dashboard", options =>
    {
        options.AccessTokenProvider = () => Task.FromResult<string?>(GetAccessToken());
    })
    .WithAutomaticReconnect()
    .Build();
```

`WithAutomaticReconnect()` handles the reconnection loop transparently, retrying with delays of 0, 2, 10, and 30 seconds by default. You can supply a custom retry policy through an `IRetryPolicy` implementation if you need different intervals.

Subscribing to messages from the hub uses the `On` method, which registers a handler for a named method the server can invoke on connected clients.

```csharp
connection.On<DashboardUpdate>("ReceiveUpdate", update =>
{
    // This callback may run on a thread pool thread; dispatch to the UI thread before updating bindings
    _dispatcherQueue.TryEnqueue(() =>
    {
        MetricValue = update.Value;
        LastUpdated = update.Timestamp;
    });
});

await connection.StartAsync();
```

To invoke methods on the hub from the client, use `InvokeAsync` for calls that return a result or `SendAsync` for fire-and-forget operations.

```csharp
// Invoke and wait for a result
var history = await connection.InvokeAsync<List<DataPoint>>("GetHistory", "cpu");

// Send without waiting for a return value
await connection.SendAsync("Subscribe", "cpu", "memory");
```

The connection object should be held for the lifetime of the feature using it. Register it as a singleton if the hub connection spans the entire application, or manage it as a per-page resource that connects on `OnNavigatedTo` and disconnects on `OnNavigatedFrom`.

---

## UI Thread Dispatching for Network Callbacks

### Thread Affinity and the STA Model

WinUI 3 uses a single-threaded apartment (STA) model inherited from its COM and XAML foundations. Every UI element, including windows, controls, and data-bound properties, is owned by the thread that created it, which is the UI thread. This isn't an arbitrary restriction; the XAML rendering engine, visual tree, and layout system are all designed to run on a single thread because concurrent mutation of a visual tree creates intractable race conditions.

Networking calls in .NET are asynchronous and complete on thread pool threads. When a network response arrives, the continuation runs on whatever thread pool thread picks up the work. If that continuation directly modifies a UI-bound property or an `ObservableCollection`, WinUI 3 throws a `System.Runtime.InteropServices.COMException` with the message "The application called an interface that was marshalled for a different thread" (RPC_E_WRONG_THREAD, 0x8001010E). In some cases you will see an `InvalidOperationException` instead, depending on whether the access is through a binding or direct property set.

This exception typically crashes the application because it occurs inside a callback or event handler where there is no surrounding try/catch. Even when caught, the UI update is lost. Understanding where thread dispatching happens automatically and where you need to handle it manually is the difference between an application that works reliably and one that crashes intermittently under real-world network conditions.

### Dispatching vs. COM Marshaling

The .NET ecosystem often uses "marshaling" loosely to mean "getting back to the right thread," but true COM marshaling is a different mechanism. In COM's apartment model, when code on one thread calls a method on a COM object owned by a different apartment, COM intercepts the call through a proxy on the calling thread. The proxy serializes the method parameters into a message and posts it to the target apartment's message queue. A stub on the target thread deserializes the parameters, executes the method on the correct thread, serializes the result, and sends it back through the same channel. The caller blocks (or receives an async callback) while this round-trip happens transparently. From the caller's perspective, it looks like a normal method call even though execution actually crossed a thread boundary.

The `RPC_E_WRONG_THREAD` exception in WinUI 3 is what happens when COM marshaling **isn't available** for the object being accessed. XAML UI elements don't register proxy/stub pairs for cross-apartment access because cross-thread UI mutation is never safe, so COM rejects the call outright rather than transparently forwarding it.

What `DispatcherQueue.TryEnqueue` does is conceptually simpler: it enqueues a delegate onto the UI thread's dispatcher queue, and the UI thread's message pump picks it up on its next iteration. There is no proxy, no parameter serialization, and no transparent cross-thread call. You are explicitly moving execution to the correct thread by posting work to a queue, not relying on COM infrastructure to forward the call for you. The `SynchronizationContext` that `async/await` uses works the same way; it posts the continuation to the dispatcher queue rather than invoking any COM marshaling machinery.

Throughout this section, "dispatching" refers to this explicit queue-based pattern rather than COM marshaling.

### Automatic Dispatching with async/await

The `async/await` pattern handles the most common dispatching scenario transparently. When you `await` an async method on the UI thread, the compiler-generated state machine captures the current `SynchronizationContext` before yielding. WinUI 3 installs a `DispatcherQueueSynchronizationContext` on the UI thread, so when the awaited task completes, the continuation is posted back to the UI thread's dispatcher queue rather than running on the thread pool.

```csharp
// This method is called from the UI thread (e.g., a button click handler)
private async Task LoadDataAsync()
{
    IsLoading = true;                                                  // UI thread
    var results = await _weatherService.GetForecastAsync("Seattle");   // yields; resumes on UI thread
    Forecasts = new ObservableCollection<Forecast>(results);           // UI thread
    IsLoading = false;                                                 // UI thread
}
```

The automatic dispatching works because three conditions are met: the method starts on the UI thread, the `SynchronizationContext` is captured by `await`, and no code between `await` points explicitly abandons the context. If any of these conditions break, the continuation runs on a thread pool thread and UI updates will fail.

### The ConfigureAwait(false) Trap

`ConfigureAwait(false)` tells the `await` to not capture the synchronization context, allowing the continuation to run on any available thread pool thread. In library code and service layers this is a best practice because it avoids unnecessary thread transitions and prevents deadlocks in certain synchronous-over-async scenarios. In ViewModel and UI-layer code, it is a bug.

```csharp
// BROKEN: ConfigureAwait(false) abandons the UI synchronization context
private async Task LoadDataAsync()
{
    IsLoading = true;
    var results = await _weatherService.GetForecastAsync("Seattle").ConfigureAwait(false);
    // Continuation runs on a thread pool thread
    Forecasts = new ObservableCollection<Forecast>(results);  // COMException: wrong thread
    IsLoading = false;
}
```

The rule is straightforward: never use `ConfigureAwait(false)` in code that touches UI elements or data-bound properties after the `await`. Service classes, HTTP handlers, and data access layers should use `ConfigureAwait(false)` freely because they don't interact with the UI. ViewModels and code-behind should leave `ConfigureAwait` at its default (`true`) so that continuations dispatch back to the UI thread.

A subtler version of this problem occurs in nested async calls. If a ViewModel calls a helper method that internally uses `ConfigureAwait(false)`, the helper's continuation runs on a thread pool thread, but the ViewModel's `await` of that helper still captures its own context and resumes on the UI thread.

```csharp
// This is safe; the ViewModel's await still captures the UI context
private async Task LoadDataAsync()
{
    var results = await GetResultsInternalAsync();
    Forecasts = new ObservableCollection<Forecast>(results);  // UI thread
}

private async Task<List<Forecast>> GetResultsInternalAsync()
{
    var response = await _client.GetAsync("forecast").ConfigureAwait(false);
    // This line runs on a thread pool thread, which is fine because it's not touching UI
    return await response.Content.ReadFromJsonAsync<List<Forecast>>().ConfigureAwait(false);
}
```

The context capture happens at each `await` independently, so `ConfigureAwait(false)` in a lower layer doesn't poison the calling layer's context. Problems arise only when the code after `ConfigureAwait(false)` within the same method tries to access UI-bound state.

### Manual Dispatching with DispatcherQueue

Manual dispatching is necessary when code runs outside the `async/await` chain entirely. This includes event handlers registered on background services, SignalR hub callbacks, `System.Timers.Timer` callbacks, WebSocket receive loops running in `Task.Run`, and any delegate invoked by a library on its own thread.

`DispatcherQueue.TryEnqueue` schedules a delegate to run on the UI thread. It returns `true` if the work item was queued successfully, and `false` if the dispatcher queue has been shut down (which happens during application exit).

```csharp
public class DashboardViewModel
{
    private readonly DispatcherQueue _dispatcherQueue;

    public DashboardViewModel()
    {
        // CRITICAL: must be called from the UI thread to capture the correct queue
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();
    }

    public void SubscribeToUpdates(IRealtimeService service)
    {
        service.OnMetricReceived += (sender, metric) =>
        {
            // This callback fires on a thread pool thread
            _dispatcherQueue.TryEnqueue(() =>
            {
                // This runs on the UI thread
                CurrentMetric = metric.Value;
                LastUpdated = metric.Timestamp;
                MetricHistory.Add(metric);
            });
        };
    }
}
```

`DispatcherQueue.GetForCurrentThread()` must be called from the UI thread to capture the correct queue. Calling it from a background thread returns `null`. A common mistake is constructing a ViewModel from a background thread or from a DI container that resolves on a thread pool thread; in that case, the captured queue is either null or wrong. If your application uses dependency injection, ensure ViewModels are resolved on the UI thread, or accept `DispatcherQueue` as a constructor parameter injected from a UI-thread registration.

### Dispatch Priority

`TryEnqueue` accepts a `DispatcherQueuePriority` parameter that controls when the work item runs relative to other queued items. There are three priority levels.

| Priority | Use Case |
| --- | --- |
| `High` | Input processing, navigation responses, and operations where delays cause visible lag |
| `Normal` | Standard UI updates like refreshing data bindings from network responses (default) |
| `Low` | Background UI work like pre-rendering off-screen content, analytics updates, or non-urgent status indicators |

```csharp
// High priority: user requested this refresh, so it should preempt background updates
_dispatcherQueue.TryEnqueue(DispatcherQueuePriority.High, () =>
{
    SearchResults.Clear();
    foreach (var result in newResults)
        SearchResults.Add(result);
});

// Low priority: telemetry indicator the user isn't actively watching
_dispatcherQueue.TryEnqueue(DispatcherQueuePriority.Low, () =>
{
    ConnectionLatency = latencyMs;
});
```

Use `Normal` for most network-driven UI updates. Reserve `High` for updates that respond to explicit user actions like search results or navigation, and `Low` for ambient updates that don't affect the user's current task.

### ObservableCollection and Background Threads

`ObservableCollection<T>` fires `CollectionChanged` events synchronously when items are added, removed, or replaced. Those events propagate to the XAML binding engine, which attempts to update the visual tree immediately. If the modification happens on a background thread, the binding engine's UI update fails with the wrong-thread exception.

This affects streaming scenarios where data arrives continuously from a WebSocket, gRPC stream, or SignalR hub. You cannot simply `await` each item and add it to the collection because the receive loop itself may be running on a background thread.

The solution is to batch incoming items and dispatch the batch to the UI thread.

```csharp
public async Task StartStreamingAsync(CancellationToken ct)
{
    var batch = new List<DataPoint>();
    var batchTimer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));

    _ = Task.Run(async () =>
    {
        await foreach (var point in _service.StreamDataAsync(ct))
        {
            lock (batch)
            {
                batch.Add(point);
            }
        }
    }, ct);

    while (await batchTimer.WaitForNextTickAsync(ct))
    {
        List<DataPoint> snapshot;
        lock (batch)
        {
            if (batch.Count == 0) continue;
            snapshot = new List<DataPoint>(batch);
            batch.Clear();
        }

        _dispatcherQueue.TryEnqueue(() =>
        {
            foreach (var point in snapshot)
                DataPoints.Add(point);
        });
    }
}
```

Batching at a 100ms interval is generally imperceptible to the user while significantly reducing the number of UI thread transitions compared to dispatching each individual item. Adjust the interval based on the data rate; high-frequency streams benefit from larger batches while low-frequency streams can dispatch immediately.

### Progress Reporting with IProgress<T>

For long-running network operations where you want to report intermediate status to the UI, `IProgress<T>` provides a clean pattern that handles dispatching automatically. When you create a `Progress<T>` instance on the UI thread, its callback is invoked on the UI thread regardless of which thread calls `Report`.

```csharp
private async Task DownloadFileAsync(string url, string destinationPath)
{
    var progress = new Progress<double>(percent =>
    {
        // This runs on the UI thread automatically
        DownloadProgress = percent;
        ProgressText = $"{percent:F0}%";
    });

    await _downloadService.DownloadWithProgressAsync(url, destinationPath, progress);
}
```

The service layer accepts `IProgress<T>` and reports progress without any knowledge of threading or UI concerns.

```csharp
public async Task DownloadWithProgressAsync(
    string url, string path, IProgress<double>? progress = null, CancellationToken ct = default)
{
    using var response = await _client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
    var totalBytes = response.Content.Headers.ContentLength ?? -1;
    var bytesRead = 0L;

    await using var contentStream = await response.Content.ReadAsStreamAsync(ct);
    await using var fileStream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None);
    var buffer = new byte[8192];
    int read;

    while ((read = await contentStream.ReadAsync(buffer, ct)) > 0)
    {
        await fileStream.WriteAsync(buffer.AsMemory(0, read), ct);
        bytesRead += read;
        if (totalBytes > 0)
            progress?.Report((double)bytesRead / totalBytes * 100);
    }
}
```

`IProgress<T>` is preferable to manual `DispatcherQueue.TryEnqueue` calls for progress scenarios because it decouples the service from WinUI 3 entirely. The same service works in a console application, a test harness, or any other .NET host without modification. `Progress<T>` uses `SynchronizationContext` internally, so it dispatches to whichever thread created it, with no dependency on WinUI-specific APIs.

### Common Mistakes and Debugging

**Mistake: Capturing DispatcherQueue on a background thread.** If the ViewModel constructor runs on a thread pool thread (common with some DI container configurations), `DispatcherQueue.GetForCurrentThread()` returns `null`. The `NullReferenceException` when you later call `TryEnqueue` is misleading because it appears at the point of use, not at the point of capture. Validate the captured queue immediately.

```csharp
public DashboardViewModel()
{
    _dispatcherQueue = DispatcherQueue.GetForCurrentThread()
        ?? throw new InvalidOperationException(
            "ViewModel must be constructed on the UI thread to capture DispatcherQueue.");
}
```

**Mistake: Using async void for event handlers without error handling.** Event handlers like `OnMessage` or `Clicked` must be `async void` because the delegate signature requires it, but unhandled exceptions in `async void` methods crash the application. Wrap the body in a try/catch.

```csharp
connection.On<Update>("Notify", async (update) =>
{
    try
    {
        _dispatcherQueue.TryEnqueue(() => Notifications.Add(update));
    }
    catch (Exception ex)
    {
        Debug.WriteLine($"Failed to process notification: {ex}");
    }
});
```

**Mistake: Modifying a shared ObservableCollection from Task.Run.** Even if the ViewModel method is `async` and started on the UI thread, code inside `Task.Run` executes on the thread pool. Any collection modification inside that block needs explicit dispatching to the UI thread.

**Debugging tip:** When you see `COMException` with `RPC_E_WRONG_THREAD`, check `System.Threading.Thread.CurrentThread.ManagedThreadId` at the point of failure. Compare it to the UI thread ID (capture it once in `App.xaml.cs` during startup). If they differ, trace back through the call stack to find where the execution left the UI thread, which is either a missing `await`, a `ConfigureAwait(false)`, a `Task.Run`, or a callback from a library that fires on its own thread.

---

## Connectivity Detection and Offline Design

A desktop application running on a laptop faces intermittent connectivity as a normal operating condition, not an edge case. Users disconnect from Wi-Fi, switch between networks, and resume from sleep with the application still running. Designing for this requires both detecting connectivity changes and choosing how the application behaves when the network is unavailable.

[NetworkInformation](https://learn.microsoft.com/en-us/dotnet/api/windows.networking.connectivity.networkinformation){:target="_blank" rel="noopener noreferrer"} is a Windows Runtime API available to WinUI 3 applications that reports the current connectivity state and fires events when it changes.

```csharp
public class ConnectivityService : IConnectivityService
{
    public bool IsConnected => GetIsConnected();

    public ConnectivityService()
    {
        NetworkInformation.NetworkStatusChanged += OnNetworkStatusChanged;
    }

    private static bool GetIsConnected()
    {
        var profile = NetworkInformation.GetInternetConnectionProfile();
        return profile?.GetNetworkConnectivityLevel() == NetworkConnectivityLevel.InternetAccess;
    }

    private void OnNetworkStatusChanged(object sender)
    {
        var connected = GetIsConnected();
        ConnectivityChanged?.Invoke(this, connected);
    }

    public event EventHandler<bool>? ConnectivityChanged;
}
```

Note that `NetworkStatusChanged` fires on an arbitrary thread, so handlers that update the UI must dispatch to the UI thread through `DispatcherQueue`.

Beyond detection, the design question is what the application should do when connectivity is lost. For applications with local data, continuing to display cached content while showing a subtle offline indicator is preferable to blocking the UI entirely. Queue writes and sync operations for when connectivity is restored, rather than surfacing errors that the user cannot act on. If the application makes a network call during an offline period, catching `HttpRequestException` or `SocketException` and returning a cached or empty result allows the UI to remain functional.

Cancellation tokens connect the connectivity story to the request lifecycle. Passing a `CancellationToken` to every async network call and canceling that token when the application loses connectivity, or when the user navigates away, prevents background requests from continuing unnecessarily and avoids the complexity of racing callbacks that arrive after the relevant UI has been torn down.
