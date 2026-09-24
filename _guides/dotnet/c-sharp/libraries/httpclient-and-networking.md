---
title: "C# HttpClient and Networking"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How HttpClient manages connections and why its lifetime matters: long-lived clients with SocketsHttpHandler versus IHttpClientFactory, named and typed clients, per-request headers and content, timeouts versus cancellation, HttpRequestException, delegating handlers, resilience with Microsoft.Extensions.Http.Resilience, streaming, HTTP/2 and HTTP/3, and WebSocket clients with ClientWebSocket."
tags: [httpclient, ihttpclientfactory, socketshttphandler, resilience, clientwebsocket, networking, practical]
---

## What an HttpClient Owns

`HttpClient` is a thin object. It holds settings that apply to every request it sends, like `BaseAddress`, `Timeout`, and `DefaultRequestHeaders`, and it passes each request to a handler. The handler does the network work. Since .NET Core 2.1 the bottom of that chain is `SocketsHttpHandler`, which owns a connection pool:

{% include figure.html id="dn-httpclient-anatomy" %}

Every lifetime rule for `HttpClient` comes from two facts about that pool. A connection is expensive to open and should be reused. And DNS is resolved only when a connection opens, so a connection that never closes never sees a DNS change.

### A Client per Request Exhausts Ports

Creating and disposing a client for each request throws the pool away each time:

```csharp
// Wrong: every iteration opens a new connection and then closes it
for (int i = 0; i < 1000; i++)
{
    using var client = new HttpClient();
    await client.GetAsync("https://api.example.com/data");
}
```

A client created with `new HttpClient()` owns its handler, so disposing the client disposes the pool and closes its connections. A closed TCP connection holds its local port in the `TIME_WAIT` state for a while before the operating system releases it. At a high request rate, the ports run out faster than they come back, and new requests fail with socket errors. Each request also pays for a fresh TCP and TLS handshake.

### A Client That Lives Forever Misses DNS Changes

The obvious fix is one shared client:

```csharp
// Reuses connections, but keeps each one open indefinitely
private static readonly HttpClient Client = new HttpClient();
```

This solves port exhaustion, but `SocketsHttpHandler.PooledConnectionLifetime` defaults to infinite. A connection that stays busy is never closed, so the client keeps talking to the IP address it resolved when the connection opened. If the service behind that name moves, as it does during a blue-green deployment or a failover, the client keeps sending traffic to the old address.

## Two Correct Lifetime Strategies

Microsoft's guidance offers two answers, and both keep the pool alive while letting connections turn over:

| Strategy | How connections turn over | Fits |
|---|---|---|
| Long-lived client with `PooledConnectionLifetime` set | The handler closes each connection after the configured interval, and the next one resolves DNS again | Console apps, libraries, and anything without a DI container |
| Short-lived clients from `IHttpClientFactory` | The factory pools handlers and replaces each one after its `HandlerLifetime` (2 minutes by default) | Apps that use `Microsoft.Extensions.DependencyInjection`, including ASP.NET Core and worker services |

### Long-Lived Client with PooledConnectionLifetime

```csharp
private static readonly HttpClient Client = new HttpClient(new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(2)
});
```

After two minutes, each connection finishes its current request and closes, and the replacement resolves DNS again. Choose the interval from how quickly DNS changes need to take effect. Shorter means more handshakes.

A few clients that call different APIs can share one handler, and therefore one pool. Pass `disposeHandler: false` so that disposing one client doesn't close connections the others are using:

```csharp
public static class HttpClients
{
    private static readonly SocketsHttpHandler SharedHandler = new()
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(2)
    };

    public static HttpClient GitHub { get; } = new(SharedHandler, disposeHandler: false)
    {
        BaseAddress = new Uri("https://api.github.com/"),
        DefaultRequestHeaders =
        {
            { "Accept", "application/vnd.github+json" },
            { "User-Agent", "MyApp" }
        }
    };

    public static HttpClient Weather { get; } = new(SharedHandler, disposeHandler: false)
    {
        BaseAddress = new Uri("https://api.weather.example/"),
        Timeout = TimeSpan.FromSeconds(30)
    };
}
```

This strategy suits code that has no container, and libraries that shouldn't force one on their consumers. A small fixed number of clients is fine too. What matters is that none of them is created per request.

### IHttpClientFactory

`IHttpClientFactory`, from the `Microsoft.Extensions.Http` package, turns the lifetime problem around. The clients it creates are cheap and meant to be short-lived, and the expensive part, the handler chain with its pool, lives in the factory:

```csharp
services.AddHttpClient();

public class ReportService(IHttpClientFactory clientFactory)
{
    public async Task<string> GetReportAsync(CancellationToken cancellationToken)
    {
        HttpClient client = clientFactory.CreateClient();
        return await client.GetStringAsync("https://api.example.com/report", cancellationToken);
    }
}
```

Each `CreateClient` call returns a new `HttpClient` wrapped around a pooled handler. Disposing that client doesn't dispose the handler, so it causes no port exhaustion. The factory replaces a handler once its `HandlerLifetime` has passed, and it disposes the old one after no client is using it. Clients created afterward get the new handler and new connections.

That rotation only helps clients that are created again. A factory-created client kept for the life of the application stays on the handler it started with, which brings back the DNS problem.

The factory's default primary handler is an implementation detail that Microsoft says not to depend on. When you want `SocketsHttpHandler` settings, configure the handler explicitly. With `PooledConnectionLifetime` set, the handler turns connections over itself, so factory-level rotation can be turned off:

```csharp
services.AddHttpClient("inventory")
    .UseSocketsHttpHandler((handler, _) =>
        handler.PooledConnectionLifetime = TimeSpan.FromMinutes(2))
    .SetHandlerLifetime(Timeout.InfiniteTimeSpan);
```

The factory shares a pooled handler, including its `CookieContainer`, across every client created from it. An app that relies on cookies can leak them between unrelated callers, and it loses them whenever the handler rotates. Microsoft recommends a long-lived client instead of the factory when cookies matter.

### Named Clients

A named client attaches configuration to a name, and `CreateClient(name)` applies it:

```csharp
services.AddHttpClient("github", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github+json");
    client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
});

HttpClient github = clientFactory.CreateClient("github");
```

Each name gets its own handler chain and pool. Keep the set of names fixed. Deriving names from input creates a new pool per distinct value.

### Typed Clients

A typed client is a class that takes an `HttpClient` in its constructor and exposes methods named after what the remote API does:

```csharp
public class GitHubClient(HttpClient client)
{
    public async Task<IReadOnlyList<Repository>> GetRepositoriesAsync(
        string user, CancellationToken cancellationToken)
    {
        var repos = await client.GetFromJsonAsync<List<Repository>>(
            $"users/{user}/repos", cancellationToken);
        return repos ?? [];
    }
}

services.AddHttpClient<GitHubClient>(client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github+json");
    client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
});
```

Consumers inject `GitHubClient` directly and never see a string key. Putting the configuration in the registration rather than the constructor keeps it next to the rest of the client's pipeline settings.

`AddHttpClient<GitHubClient>` registers the typed client as **transient**, and it's short-lived for the same reason a factory-created `HttpClient` is. Injected into a singleton, the typed client and the `HttpClient` inside it live as long as the singleton does, which is a captive dependency that dependency-injection validation doesn't catch. The singleton never picks up a rotated handler. A singleton that needs HTTP should take `IHttpClientFactory` and create a client per operation, or use a typed client whose primary handler sets `PooledConnectionLifetime`, as shown above.

Don't also register the typed client class with `AddTransient` or `AddScoped`. The later registration replaces the factory's, and the class then receives an unconfigured `HttpClient`.

## Sending Requests

### Convenience Methods and HttpRequestMessage

The `GetAsync`, `PostAsync`, `PutAsync`, and `DeleteAsync` methods cover most calls. The JSON extension methods in `System.Net.Http.Json` serialize and deserialize in the same step:

```csharp
User? user = await client.GetFromJsonAsync<User>("users/1", cancellationToken);

using HttpResponseMessage created = await client.PostAsJsonAsync("users", newUser, cancellationToken);
created.EnsureSuccessStatusCode();

using HttpResponseMessage deleted = await client.DeleteAsync("users/1", cancellationToken);
```

Anything the convenience methods don't expose, like a per-request header or a specific HTTP version, goes through an `HttpRequestMessage` and `SendAsync`:

```csharp
using var request = new HttpRequestMessage(HttpMethod.Get, "users/1");
request.Headers.Add("X-Request-Id", Guid.NewGuid().ToString());

using HttpResponseMessage response = await client.SendAsync(request, cancellationToken);
```

An `HttpRequestMessage` can be sent once. Passing the same instance to `SendAsync` again throws `InvalidOperationException`, so any code that repeats a request builds a new message each time.

Dispose every response. By default the body has already been buffered by the time the call returns, so the connection is back in the pool, but a response read as a stream (see [Streaming Large Responses](#streaming-large-responses)) keeps its connection until it's disposed. Disposing everything means the code stays correct when someone switches it to streaming. `GetFromJsonAsync` and `GetStringAsync` dispose the response for you.

### Client Headers and Request Headers

`DefaultRequestHeaders` is shared by every request the client sends, from every thread. It suits values that are the same for every call, like `Accept` and `User-Agent`. Anything that varies per caller, like a user's bearer token or a correlation ID, belongs on the request:

```csharp
using var request = new HttpRequestMessage(HttpMethod.Get, "orders");
request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", userToken);
```

Setting a per-user token on `DefaultRequestHeaders` of a shared client sends one user's token with another user's request whenever two calls overlap. `HttpClient` doesn't prevent this. It throws `InvalidOperationException` if you change `BaseAddress` or `Timeout` after the first request, but `DefaultRequestHeaders` stays mutable, and it isn't safe to change while requests are in flight. The send methods themselves are thread-safe, which is what makes a shared client work at all.

### Request Content

```csharp
// JSON: serialized with the web defaults (camelCase names)
await client.PostAsJsonAsync("users", user, cancellationToken);

// A string you already have
var json = new StringContent(payload, Encoding.UTF8, "application/json");

// Form data
var form = new FormUrlEncodedContent(new Dictionary<string, string>
{
    ["grant_type"] = "client_credentials",
    ["scope"] = "orders.read"
});

// Multipart, for file uploads
using var multipart = new MultipartFormDataContent();
multipart.Add(new StringContent("Alice"), "name");

await using var fileStream = File.OpenRead("photo.jpg");
var fileContent = new StreamContent(fileStream);
fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
multipart.Add(fileContent, "file", "photo.jpg");

using HttpResponseMessage response = await client.PostAsync("upload", multipart, cancellationToken);
```

`StringContent` without a media type is sent as `text/plain; charset=utf-8`, which many JSON APIs reject. Name the media type, or use the JSON extension methods. Those use `JsonSerializerDefaults.Web`, which writes camelCase property names, and which reads names case-insensitively and accepts numbers written as quoted strings. They differ from a bare `JsonSerializer` call, which is case-sensitive and PascalCase by default.

### Reading Responses

```csharp
using HttpResponseMessage response = await client.GetAsync("users/1", cancellationToken);

if (response.StatusCode == HttpStatusCode.NotFound)
    return null;

response.EnsureSuccessStatusCode();   // Throws HttpRequestException for any non-2xx status

string? etag = response.Headers.ETag?.Tag;
DateTimeOffset? expires = response.Content.Headers.Expires;

User? user = await response.Content.ReadFromJsonAsync<User>(cancellationToken);
```

Headers are split by what they describe. `response.Headers` holds headers about the response, like `ETag` and `Retry-After`, and `response.Content.Headers` holds headers about the body, like `Content-Type`, `Content-Length`, and `Expires`. A header that seems missing is usually in the other collection.

## Timeouts and Cancellation

Two limits bound every request. One is the client's `Timeout`, which defaults to 100 seconds and applies to every request the client sends. The other is the cancellation token passed to the call. Both surface as `TaskCanceledException`, and code that handles them has to tell them apart:

```csharp
public async Task<User?> GetUserAsync(int id, CancellationToken cancellationToken)
{
    try
    {
        return await _client.GetFromJsonAsync<User>($"users/{id}", cancellationToken);
    }
    catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
    {
        _logger.LogWarning("Timed out getting user {UserId}", id);
        throw;
    }
}
```

Since .NET 5, a request that hits `HttpClient.Timeout` throws a `TaskCanceledException` whose `InnerException` is a `TimeoutException`. A request canceled through the caller's token has no such inner exception. Let the caller's cancellation propagate. Catching it and returning `null` makes a canceled operation look like a missing user, and the method's task completes successfully instead of showing as canceled.

`Timeout` is one setting for the whole client. A tighter limit for one call links a timer to the caller's token:

```csharp
using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
cts.CancelAfter(TimeSpan.FromSeconds(5));

string result = await client.GetStringAsync(url, cts.Token);
```

The request now stops at five seconds or when the caller cancels, whichever comes first. When it stops at five seconds, the exception is an `OperationCanceledException` from your own token, and `cancellationToken.IsCancellationRequested` being false tells you it was the timer rather than the caller.

## Handling Errors

`HttpClient` throws for transport failures and leaves HTTP status codes to you, except where a method has nowhere else to put one:

| What went wrong | What you see |
|---|---|
| DNS failure, refused connection, TLS failure, connection dropped | `HttpRequestException`, with `HttpRequestError` (.NET 8) naming the category, such as `NameResolutionError` or `ConnectionError` |
| Server returned 4xx or 5xx from `GetAsync`, `SendAsync`, or `PostAsync` | No exception. The status is on the response |
| Server returned 4xx or 5xx from `GetFromJsonAsync` or `GetStringAsync`, or you called `EnsureSuccessStatusCode` | `HttpRequestException`, with `StatusCode` (.NET 5) set |
| Body isn't valid JSON for the target type | `JsonException` |
| `HttpClient.Timeout` elapsed | `TaskCanceledException` wrapping `TimeoutException` |

`EnsureSuccessStatusCode` discards the response body, which is where most APIs explain what went wrong. When the body matters, read it before throwing:

```csharp
public async Task<Order> CreateOrderAsync(NewOrder order, CancellationToken cancellationToken)
{
    using HttpResponseMessage response =
        await _client.PostAsJsonAsync("orders", order, cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
        string problem = await response.Content.ReadAsStringAsync(cancellationToken);
        _logger.LogError("Order API returned {StatusCode}: {Problem}", response.StatusCode, problem);
        throw new HttpRequestException(
            $"Order API returned {(int)response.StatusCode}", null, response.StatusCode);
    }

    return (await response.Content.ReadFromJsonAsync<Order>(cancellationToken))!;
}
```

Keeping the exception an `HttpRequestException` with `StatusCode` set means a caller, or a resilience handler, can still decide from the status whether to retry.

## Delegating Handlers

A `DelegatingHandler` sits in the handler chain and sees every request on the way out and every response on the way back. It's the place for concerns that apply to every call a client makes, like logging, adding credentials, or recording metrics:

```csharp
public class TimingHandler(ILogger<TimingHandler> logger) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        long start = Stopwatch.GetTimestamp();
        HttpResponseMessage response = await base.SendAsync(request, cancellationToken);

        logger.LogInformation("{Method} {Uri} returned {StatusCode} in {Elapsed} ms",
            request.Method, request.RequestUri, (int)response.StatusCode,
            Stopwatch.GetElapsedTime(start).TotalMilliseconds);

        return response;
    }
}

services.AddTransient<AuthTokenHandler>();
services.AddTransient<TimingHandler>();

services.AddHttpClient<OrdersClient>()
    .AddHttpMessageHandler<AuthTokenHandler>()
    .AddHttpMessageHandler<TimingHandler>();
```

Handlers run in the order they're added, with the first one outermost:

{% include figure.html id="dn-delegating-handlers" %}

Order changes what each handler observes. `TimingHandler` sits inside `AuthTokenHandler`, so if the auth handler sends a request twice, the timing handler logs both attempts.

### Handler Lifetime and Scopes

A handler is created with the handler chain, not per request, so it lives as long as the factory keeps that chain, two minutes by default. The factory resolves handlers from a DI scope of its own, separate from the ASP.NET Core request scope. A scoped service injected into a handler is therefore not the request's instance, and the same instance can serve several requests from different users. Don't inject request-specific state into a handler, or cache any in one. Pass per-request values on the `HttpRequestMessage` itself, through a header or `request.Options`.

### Sending a Request Twice

A handler can call `base.SendAsync` more than once with the same message. The single-send rule is enforced by `HttpClient`, not by the chain. Retrying on a 401 after refreshing a token looks like this:

```csharp
public class AuthTokenHandler(ITokenService tokens) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", await tokens.GetTokenAsync(cancellationToken));

        HttpResponseMessage response = await base.SendAsync(request, cancellationToken);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            response.Dispose();
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", await tokens.RefreshTokenAsync(cancellationToken));
            response = await base.SendAsync(request, cancellationToken);
        }

        return response;
    }
}
```

Dispose the first response before sending again, or its connection stays tied up. A resend only works when the request body can be read twice. `StringContent`, `ByteArrayContent`, and JSON content can, but a `StreamContent` over a file or network stream has already been consumed.

## Resilience

Transient failures, like a dropped connection, a 503 during a deployment, or a 429 from a rate limiter, often succeed on a second try. The `Microsoft.Extensions.Http.Resilience` package adds retries, timeouts, and circuit breaking to a client's handler chain, built on Polly v8. The older `Microsoft.Extensions.Http.Polly` package and its `AddTransientHttpErrorPolicy` and `AddPolicyHandler` methods are deprecated, and NuGet names the resilience packages as their replacement.

### The Standard Pipeline

One call adds a pipeline with defaults chosen for typical HTTP traffic:

```csharp
services.AddHttpClient<OrdersClient>()
    .AddStandardResilienceHandler();
```

It stacks five strategies, outermost first:

| Strategy | Default |
|---|---|
| Rate limiter | 1,000 concurrent requests, no queue |
| Total request timeout | 30 seconds across every attempt |
| Retry | 3 retries, exponential backoff from 2 seconds with jitter, honoring `Retry-After` |
| Circuit breaker | Opens for 5 seconds when at least 10% of at least 100 requests in a 30-second window fail |
| Attempt timeout | 10 seconds per attempt |

The retry and circuit breaker treat 5xx responses, 408, 429, `HttpRequestException`, and attempt timeouts as transient. Because the attempt timeout sits inside the retry, one slow attempt is cut off and retried rather than consuming the whole budget. The total timeout still caps the sum.

Every value is adjustable:

```csharp
services.AddHttpClient<OrdersClient>()
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 5;
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(60);
    });
```

The pipeline's total timeout and the client's own `Timeout` (100 seconds) both apply. Whichever is shorter ends the request, so raising the pipeline's total above 100 seconds also means raising `HttpClient.Timeout`.

### Retrying Unsafe Methods

The standard retry doesn't look at the HTTP method, so it retries a `POST` the same way it retries a `GET`. If the first attempt reached the server and only the response was lost, a retried `POST` creates a second order. Retry non-idempotent requests only when the API supports an idempotency key, or turn retries off for them. `options.Retry.DisableForUnsafeHttpMethods()` does that for `POST`, `PATCH`, `PUT`, `DELETE`, and `CONNECT`, and `DisableFor(...)` takes a list of methods. In the 10.x package both are marked experimental, so using them means suppressing diagnostic `EXTEXP0001`.

Add one resilience handler per client. Microsoft advises against stacking several, and `AddResilienceHandler` covers the cases where the standard one doesn't fit.

### A Custom Pipeline

When the standard stack is the wrong shape, `AddResilienceHandler` builds one from individual strategies:

```csharp
services.AddHttpClient<PaymentsClient>()
    .AddResilienceHandler("payments", pipeline =>
    {
        pipeline.AddTimeout(TimeSpan.FromSeconds(10));
        pipeline.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 2,
            BackoffType = DelayBackoffType.Exponential,
            UseJitter = true
        });
    });
```

Strategies wrap in the order they're added, so the timeout above bounds both attempts together. Adding it after the retry would bound each attempt instead.

A static client without a container can use the same strategies. Build a `ResiliencePipeline<HttpResponseMessage>`, wrap it in a `ResilienceHandler`, and set a `SocketsHttpHandler` with `PooledConnectionLifetime` as its `InnerHandler`.

## Streaming Large Responses

By default, `GetAsync` and `SendAsync` read the entire body into memory before returning. `HttpCompletionOption.ResponseHeadersRead` returns as soon as the headers arrive and leaves the body on the connection to be read as a stream:

```csharp
public async Task DownloadAsync(string url, string path, CancellationToken cancellationToken)
{
    using HttpResponseMessage response = await _client.GetAsync(
        url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    response.EnsureSuccessStatusCode();

    await using Stream body = await response.Content.ReadAsStreamAsync(cancellationToken);
    await using FileStream file = File.Create(path);
    await body.CopyToAsync(file, cancellationToken);
}
```

The connection belongs to that response until it's disposed, so the `using` on the response matters more here than anywhere else.

A large JSON array can be consumed one element at a time. `GetFromJsonAsAsyncEnumerable` (.NET 8) streams the response and yields each element as it's parsed:

```csharp
await foreach (User? user in _client.GetFromJsonAsAsyncEnumerable<User>("users/all", cancellationToken))
{
    if (user is not null)
        await ProcessAsync(user, cancellationToken);
}
```

Memory stays flat regardless of how many elements the array holds.

## HTTP/2 and HTTP/3

`HttpClient` sends HTTP/1.1 unless told otherwise. `DefaultRequestVersion` is 1.1 and `DefaultVersionPolicy` is `RequestVersionOrLower`, so HTTP/2 is used only when a request asks for it:

```csharp
var client = new HttpClient(new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(2),
    EnableMultipleHttp2Connections = true
})
{
    DefaultRequestVersion = HttpVersion.Version20,
    DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrLower
};
```

`RequestVersionOrLower` falls back to HTTP/1.1 against a server that doesn't negotiate HTTP/2. `RequestVersionExact` fails instead. HTTP/2 multiplexes requests over one connection, and the server caps how many streams that connection can carry at once. `EnableMultipleHttp2Connections` lets the handler open a second connection when the first is full rather than queueing requests behind it.

HTTP/3 runs over QUIC instead of TCP and has been supported since .NET 7. It depends on the MsQuic library, which ships with Windows 11 and Windows Server 2022 and has to be installed as `libmsquic` on Linux. It also requires TLS 1.3. Where those requirements aren't met, HTTP/3 is unavailable. Because some networks block QUIC, Microsoft recommends asking for a lower version with `RequestVersionOrHigher`, which lets the client move up to HTTP/3 when the server advertises it and fall back otherwise.

## WebSockets with ClientWebSocket

HTTP is request and response. A WebSocket upgrades one HTTP connection into a long-lived, two-way channel where either side can send a message at any time, which suits chat, live dashboards, and collaborative editing. `ClientWebSocket` in `System.Net.WebSockets` is the client. It is a different type from `HttpClient` and has its own options, set through `Options` before `ConnectAsync`.

A WebSocket carries messages, but `ReceiveAsync` returns frames. A message larger than the buffer, or one the sender split, arrives across several receives, and `EndOfMessage` marks the last one. A receive loop has to accumulate until it sees that flag:

```csharp
public static async IAsyncEnumerable<string> ReadMessagesAsync(
    ClientWebSocket socket,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    var buffer = new byte[4096];
    using var message = new MemoryStream();

    while (socket.State == WebSocketState.Open)
    {
        ValueWebSocketReceiveResult result = await socket.ReceiveAsync(buffer.AsMemory(), ct);

        if (result.MessageType == WebSocketMessageType.Close)
        {
            // Acknowledge the server's close without waiting for a reply
            await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, ct);
            yield break;
        }

        message.Write(buffer, 0, result.Count);

        if (result.EndOfMessage)
        {
            yield return Encoding.UTF8.GetString(message.GetBuffer(), 0, (int)message.Length);
            message.SetLength(0);
        }
    }
}
```

A `ClientWebSocket` supports exactly one outstanding send and one outstanding receive at a time. Two sends issued concurrently, say from two UI events, produce undefined behavior, so serialize sends with a `SemaphoreSlim` or a single sending loop fed by a `Channel<T>`. The one receive is usually the loop above running for the life of the connection.

Closing has two forms. `CloseAsync` sends a close frame and waits for the server's close in return. `CloseOutputAsync` sends the close frame and returns without waiting, which is the right reply when the server closed first.

### Keep-Alive and Dead Connections

By default a `ClientWebSocket` sends an unsolicited PONG frame every `KeepAliveInterval`, which is `WebSocket.DefaultKeepAliveInterval`, typically 30 seconds. That stops idle connections from being dropped by proxies, but it never expects an answer, so a server that crashed goes unnoticed until the TCP connection times out.

.NET 9 added `KeepAliveTimeout`. When it is set to a finite value, the client sends a PING after `KeepAliveInterval` of silence from the server and aborts the connection if no PONG arrives within the timeout. The pending `ReceiveAsync` then throws an `OperationCanceledException`. Incoming frames, PONGs included, are only processed while a receive is pending, so a connection with a keep-alive timeout needs a receive outstanding at all times or it can abort a healthy connection.

```csharp
using var socket = new ClientWebSocket();
socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(15);
socket.Options.KeepAliveTimeout = TimeSpan.FromSeconds(10);
await socket.ConnectAsync(new Uri("wss://example.com/live"), ct);
```

Nothing reconnects a dropped WebSocket automatically. The owning service has to notice the loop ending or throwing, wait with backoff, and connect a new `ClientWebSocket`, since a closed instance can't be reopened. Libraries that sit on top of WebSockets, such as the SignalR client, add reconnection and message framing for you.

### Sharing Connections Over HTTP/2

A WebSocket normally takes over its own HTTP/1.1 connection. Since .NET 7, `ClientWebSocket` can also run over HTTP/2, where each WebSocket is one stream on a shared connection. Set `Options.HttpVersion` and `Options.HttpVersionPolicy`, and pass a handler through the `ConnectAsync(Uri, HttpMessageInvoker, CancellationToken)` overload so the socket uses that handler's connection pool:

```csharp
var handler = new SocketsHttpHandler();
using var socket = new ClientWebSocket();
socket.Options.HttpVersion = HttpVersion.Version20;
socket.Options.HttpVersionPolicy = HttpVersionPolicy.RequestVersionOrHigher;
await socket.ConnectAsync(uri, new HttpMessageInvoker(handler), ct);
```

When an invoker is passed, settings such as credentials, proxy, and certificate validation belong on the handler. Changing the equivalent `ClientWebSocketOptions` as well makes `ConnectAsync` throw an `ArgumentException`.

`Options.DangerousDeflateOptions` enables per-message compression when the server agrees to it. The name is a warning: compressing secrets alongside attacker-influenced data exposes them to CRIME and BREACH style attacks, so send such messages with the `WebSocketMessageFlags.DisableCompression` flag.

## Testing Code That Uses HttpClient

`HttpClient` has no interface to mock, and it doesn't need one. The seam is the handler. A stub handler returns canned responses without touching the network, and the code under test receives an ordinary `HttpClient` built around it:

```csharp
public class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken) =>
        Task.FromResult(respond(request));
}

var client = new HttpClient(new StubHandler(_ =>
    new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = JsonContent.Create(new User { Id = 1, Name = "Alice" })
    }))
{
    BaseAddress = new Uri("https://api.example.com/")
};

var github = new GitHubClient(client);
```

This works because a typed client takes `HttpClient` through its constructor. A class that calls `new HttpClient()` internally or reaches a static instance can't be given a stub, which is one more reason to receive the client rather than create it.

## Key Takeaways

**Reuse the connection pool, and let connections turn over.** Use a long-lived client with `PooledConnectionLifetime` set, or short-lived clients from `IHttpClientFactory`. Never create and dispose a client per request.

**Treat factory clients and typed clients as short-lived.** Don't hold either in a singleton. Create a client per operation, or give the handler its own `PooledConnectionLifetime`.

**Keep per-caller data off the shared client.** Tokens and correlation IDs go on the `HttpRequestMessage`, not in `DefaultRequestHeaders`.

**Tell a timeout from a cancellation.** A client timeout wraps `TimeoutException`. Let the caller's cancellation propagate instead of turning it into a result.

**Use `Microsoft.Extensions.Http.Resilience`, not the deprecated Polly integration,** and decide explicitly whether a `POST` may be retried.

**Put cross-cutting behavior in delegating handlers,** and keep request-scoped state out of them, since they outlive any one request.

**Read WebSocket messages until `EndOfMessage`,** send from one place at a time, and set `KeepAliveTimeout` when a dead server has to be noticed quickly.
