---
title: "SignalR and Real-Time APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "Real-Time & RPC"
description: "Real-time communication in ASP.NET Core with SignalR hubs, groups, and IHubContext, connection lifetime and reconnection, hub authentication, scaling with sticky sessions, a Redis backplane, or Azure SignalR Service, Native AOT limits, Server-Sent Events, and raw WebSockets."
tags: [practical, signalr, websockets, server-sent-events, redis, real-time]
---

ASP.NET Core offers three ways to push data to clients without waiting for them to ask. SignalR is a messaging library with a protocol of its own, client libraries, transport fallback, groups, and scale-out support. Server-Sent Events (SSE) stream events from server to client over an ordinary HTTP response. Raw WebSockets hand the application a bidirectional socket and nothing else. Microsoft recommends SignalR over raw WebSockets for most applications. SSE fits one-way feeds, and the choice between all three is covered at the end.

## SignalR Hubs

A *hub* is a class whose public methods clients can call, and through which the server calls methods on clients. SignalR picks the best transport the client and server share, trying WebSockets first, then Server-Sent Events, then long polling (repeated HTTP requests that the server holds open until it has a message), and the hub code is the same on all three. Messages travel in a *hub protocol* on top of the transport, JSON by default, or binary MessagePack from the `Microsoft.AspNetCore.SignalR.Protocols.MessagePack` package, which produces smaller messages.

```csharp
builder.Services.AddSignalR();

app.MapHub<ChatHub>("/hubs/chat");
```

```csharp
public class ChatHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}
```

`Clients` selects who receives a message: `All`, `Caller`, `Others`, a specific connection with `Client(connectionId)`, a user with `User(userId)`, or a group with `Group(name)`. `SendAsync` names the client-side method as a string, and the arguments are serialized as JSON by default.

Hubs are transient. SignalR creates a new hub instance for every method call, so a field set in one call is gone in the next. Constructor injection works as usual. State that belongs to one connection goes in `Context.Items`, which lives as long as the connection, and anything shared goes in an injected service or external store.

A hub method that throws sends the client a generic "An unexpected error occurred" message, so exception details don't leak. Throwing `HubException` sends its message to the client deliberately, and `EnableDetailedErrors` in the `AddSignalR` options sends every exception's message, which is for development only. Incoming messages are limited to 32 KB by default (`MaximumReceiveMessageSize`). These hub options apply to every hub when set in `AddSignalR`, or to one hub through `AddHubOptions<THub>`. Options that belong to a hub's endpoint, such as stateful reconnect and token expiry below, go in the `MapHub` call instead.

### Strongly Typed Hubs

A string method name breaks silently when the client renames its handler. Deriving from `Hub<T>`, where `T` is an interface of client methods, turns those calls into compile-checked method calls:

```csharp
public interface IChatClient
{
    Task ReceiveMessage(string user, string message);
    Task UserJoined(string user);
}

public class ChatHub : Hub<IChatClient>
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.ReceiveMessage(user, message);
    }
}
```

`Hub<T>` removes `SendAsync`, so every client call must appear in the interface. The client still registers handlers by name, so the interface is a server-side contract rather than one the client compiles against.

Hub method parameters can be a base type annotated for polymorphic serialization (`[JsonPolymorphic]` and `[JsonDerivedType]`) since .NET 9, and the method receives the derived type the client sent.

### Streaming

A hub method can stream in either direction. A method that returns `IAsyncEnumerable<T>` or `ChannelReader<T>` streams items to the caller as they are produced, and a method that takes one as a parameter receives a stream the client uploads. A streaming call ends when the enumeration completes or the client cancels.

```csharp
public class PriceHub(IPriceFeed feed) : Hub
{
    public async IAsyncEnumerable<StockPrice> WatchPrices(
        string symbol, [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var price in feed.ReadAsync(symbol, ct))
        {
            yield return price;
        }
    }
}
```

## Connections, Users, and Groups

Each connection has an ID, `Context.ConnectionId`, that lasts until the connection closes. Targeting by connection ID is rarely what an application wants, and two higher-level targets cover most cases.

- **Users.** `Clients.User(userId)` reaches every connection belonging to one authenticated user, across tabs and devices. By default the user ID comes from the `ClaimTypes.NameIdentifier` claim, and a custom `IUserIdProvider` can choose another.
- **Groups.** A group is a named set of connections that the application manages. A connection can join any number of groups, and SignalR removes it from all of them when it disconnects.

```csharp
public class ChatHub : Hub<IChatClient>
{
    public async Task JoinRoom(string room)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, room);
        await Clients.Group(room).UserJoined(Context.User?.Identity?.Name ?? "anonymous");
    }
}
```

Group membership isn't persisted, so it doesn't survive a reconnect, as Connection Lifetime and Reconnection below explains. `OnConnectedAsync` and `OnDisconnectedAsync` are the hub's lifecycle hooks, and `OnDisconnectedAsync` runs whether the client closed cleanly or the connection timed out.

### Sending from Outside a Hub

Code that isn't a hub, such as a controller or a background service, sends messages through `IHubContext<THub>`, or `IHubContext<THub, TClient>` for a strongly typed hub:

```csharp
public class AnnouncementService(IHubContext<ChatHub, IChatClient> hub)
{
    public Task AnnounceAsync(string room, string text) =>
        hub.Clients.Group(room).ReceiveMessage("system", text);
}
```

A hub context has `Clients` and `Groups` but no `Caller` or `Context`, since there's no current connection to refer to.

The server can also call a client method and wait for its answer. `Clients.Client(connectionId).InvokeAsync<T>(...)`, or a `Task<T>`-returning method on a strongly typed hub's client interface, returns the value the client's handler produces. The `InvokeAsync` overloads require a `CancellationToken`, and passing one with a timeout matters, since the call waits on a client that may never answer.

## Connection Lifetime and Reconnection

The server sends a keep-alive ping every 15 seconds (`KeepAliveInterval`) and treats a client as gone after 30 seconds without hearing from it (`ClientTimeoutInterval`), both set in the hub options. The client applies the mirror-image settings to the server. Microsoft's guidance is to keep each timeout at least double the other side's keep-alive interval.

Clients don't reconnect by default. `withAutomaticReconnect()` in the JavaScript client, or `WithAutomaticReconnect()` in .NET, enables it. With no arguments it retries after 0, 2, 10, and 30 seconds and then gives up, and it never retries a connection whose initial `start()` failed, which the application has to handle itself.

A reconnected connection starts fresh, with a new connection ID, no groups, and any messages sent during the gap lost. The client rejoins its groups from its reconnected handler (`onreconnected` in JavaScript, `Reconnected` in .NET) by calling a hub method, or the server rejoins them in `OnConnectedAsync` from state it stores itself.

*Stateful reconnect*, added in .NET 8, closes that gap for brief disconnects. Both sides buffer and acknowledge messages, and after a reconnect the unacknowledged ones are replayed on the same logical connection. It is enabled on the server with `AllowStatefulReconnects = true` in the `MapHub` options, and on the client with `withStatefulReconnect()` or `WithStatefulReconnect()`.

## Authentication and Authorization

`[Authorize]` works on hub classes and hub methods as it does on controllers, and `Context.User` holds the connection's `ClaimsPrincipal`.

```csharp
[Authorize]
public class ChatHub : Hub<IChatClient>
{
    [Authorize(Policy = "Moderator")]
    public async Task RemoveMessage(string messageId) { /* ... */ }
}
```

How the credential arrives depends on the client.

- **Browser apps with cookie authentication** need no extra configuration. The signed-in user's cookie flows to the SignalR connection. A browser client served from a different origin also needs a CORS policy on the hub path that allows credentials.
- **Bearer tokens** come from the client's `accessTokenFactory`, which the JavaScript client calls when it negotiates a connection, and again after a `401`. Non-browser clients send the token in the `Authorization` header. Browsers can't set headers on WebSocket or EventSource requests, so the browser client sends the token as an `access_token` query string parameter on those transports, and the JWT handler has to be told to read it there:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
```

TLS protects the query string in transit, but many servers and proxies log query strings, which is a reason to keep these tokens short-lived.

SignalR authenticates the user when the connection is established and caches that principal for the connection's lifetime. It doesn't revalidate it. A role removed after the connection opens isn't seen on any transport, and the user keeps whatever access the connection started with. An expired token doesn't close a WebSocket connection. On long polling and SSE, which send new HTTP requests, the next request fails unless the client sends a fresh token. Setting `CloseOnAuthenticationExpiration` in the `MapHub` options closes a connection when its token expires, forcing the client to reconnect and authenticate again.

## Scaling Across Servers

Each SignalR server knows only its own connections. With two servers, a message sent to a group or to all clients from server A never reaches the clients connected to server B. Scaling out also raises two routing requirements.

**Sticky sessions.** Establishing a SignalR connection takes more than one HTTP request (a negotiate request, in which client and server agree on a transport, then the transport connection itself), and long polling keeps making requests afterward. All of them must reach the same server process. A server farm needs session affinity at the load balancer, with two exceptions. The first is Azure SignalR Service. The second is when every client uses WebSockets only and sets `SkipNegotiation`, so the connection is a single request.

**Cross-server delivery.** Messages need a way to reach connections on other servers. Microsoft offers two options, and third-party backplanes exist for other stores.

- **Azure SignalR Service** takes over the client connections. Clients negotiate with the app, then connect to the service, and each app server holds a small, fixed number of connections to the service. The app no longer needs sticky sessions, and it scales on message volume rather than connection count. Microsoft recommends it for any SignalR app hosted on Azure.
- **A Redis backplane**, from the `Microsoft.AspNetCore.SignalR.StackExchangeRedis` package, relays messages between servers through Redis publish/subscribe, in which a message published to a named channel goes to every subscriber of that channel. Each server subscribes to channels for its own connections, users, and groups, so a message published for a group reaches every server holding a member of that group. It is the recommended option on your own infrastructure. The app still needs sticky sessions, and each server still holds its share of the connections.

{% include figure.html id="asp-signalr-scaleout" %}

```csharp
builder.Services.AddSignalR()
    .AddStackExchangeRedis(connectionString, options =>
    {
        options.Configuration.ChannelPrefix = RedisChannel.Literal("ChatApp");
    });
```

The channel prefix keeps apps that share a Redis instance from receiving each other's messages. Redis latency adds directly to message latency, so Redis belongs close to the app servers. Group operations become network calls to Redis once a backplane is configured.

Persistent connections also hold server resources while idle. A SignalR server can run out of TCP connections under load and starve other apps on the same machine, which is why Microsoft advises running SignalR apps on servers of their own when traffic is high.

## SignalR with Native AOT

Since .NET 9, SignalR clients and servers can be trimmed and compiled with Native AOT. The .NET 9 release notes list the limits, which still leave SignalR "partial" in the AOT compatibility table.

- Only the JSON hub protocol works, not MessagePack, and it needs the System.Text.Json source generator, as minimal APIs do.
- Strongly typed hubs (`Hub<T>`) aren't supported under `PublishAot`. They produce build warnings and fail at runtime, so AOT hubs use `SendAsync`. They work with trimming alone.
- Hub methods can't take streaming parameters (`IAsyncEnumerable<T>` or `ChannelReader<T>`) where `T` is a value type. They fail at startup.
- Async hub methods must return `Task`, `Task<T>`, `ValueTask`, or `ValueTask<T>`.

## Server-Sent Events

Server-Sent Events stream text events over a normal HTTP response with the `text/event-stream` content type. There is no protocol upgrade, and the browser's `EventSource` API reconnects on its own when the connection drops. .NET 10 adds `TypedResults.ServerSentEvents`, which takes an `IAsyncEnumerable` of events:

```csharp
app.MapGet("/orders/events", (
    [FromHeader(Name = "Last-Event-ID")] string? lastEventId,
    IOrderFeed orderFeed,
    CancellationToken ct) =>
    TypedResults.ServerSentEvents(StreamOrderEvents(orderFeed, lastEventId, ct)));

static async IAsyncEnumerable<SseItem<OrderEvent>> StreamOrderEvents(
    IOrderFeed orderFeed, string? lastEventId, [EnumeratorCancellation] CancellationToken ct)
{
    await foreach (var evt in orderFeed.ReadSinceAsync(lastEventId, ct))
    {
        yield return new SseItem<OrderEvent>(evt, eventType: "order-updated")
        {
            EventId = evt.Sequence.ToString()
        };
    }
}
```

Each `SseItem<T>` carries a payload, an optional event type, an optional ID, and an optional `ReconnectionInterval`, which tells the browser how long to wait before reconnecting. Payloads other than strings and byte arrays are serialized as JSON. When a browser reconnects, it sends the last ID it received in the `Last-Event-ID` header. Resuming from that point is the server's job, which is why the sample reads the header and passes it to the feed. Events without IDs are simply lost across a reconnect.

Two deployment details catch SSE endpoints.

- **Proxy buffering.** A reverse proxy that buffers responses holds events back until its buffer fills. Nginx needs `proxy_buffering off` for SSE routes, for example.
- **Connection limits over HTTP/1.1.** Browsers allow about six HTTP/1.1 connections per origin, and every open `EventSource` holds one. Several tabs with streams open can exhaust them. HTTP/2 multiplexes streams over one connection and raises the limit to a negotiated stream count, 100 by default.

## Raw WebSockets

Raw WebSockets give the application the socket and leave everything else to it. There is no reconnection, no message protocol beyond WebSocket frames, and no groups. The WebSockets middleware must be added, and the endpoint accepts the upgrade:

```csharp
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(2),
    KeepAliveTimeout = TimeSpan.FromSeconds(15)
});

app.Map("/ws", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    await EchoAsync(socket, context.RequestAborted);
});

static async Task EchoAsync(WebSocket socket, CancellationToken ct)
{
    var buffer = new byte[4096];
    var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);

    while (!result.CloseStatus.HasValue)
    {
        await socket.SendAsync(buffer.AsMemory(0, result.Count), result.MessageType, result.EndOfMessage, ct);
        result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
    }

    await socket.CloseAsync(result.CloseStatus.Value, result.CloseStatusDescription, ct);
}
```

The endpoint uses `Map` rather than `MapGet` because WebSockets over HTTP/2, supported since .NET 7 and on by default in Chrome, Edge, and Firefox 128 and later, arrive as `CONNECT` requests rather than `GET`. A controller action has the same issue and needs `[Route]` instead of `[HttpGet]`.

A few behaviors differ from ordinary request handling.

- **The request must stay open.** The socket lives only as long as the middleware pipeline for that request. Returning from the handler ends the connection. A background service that writes to the socket needs the request to wait, for example on a `TaskCompletionSource` that the service completes when it's done.
- **Dead clients go unnoticed.** A client that loses its network never sends a close frame. The server sends a ping every `KeepAliveInterval` (two minutes by default), but it closes an unresponsive connection only if `KeepAliveTimeout` is set, and that timeout is disabled by default.
- **Messages can span frames.** `EndOfMessage` is `false` until the last frame of a message arrives, so code expecting large messages has to accumulate frames.
- **CORS doesn't apply.** Browsers don't enforce CORS on WebSocket connections, so any site can open a socket to the server and ride on the user's cookies. `AllowedOrigins` in `WebSocketOptions` restricts which `Origin` headers are accepted.

## Choosing an Approach

| | SignalR | Server-Sent Events | Raw WebSockets |
|---|---|---|---|
| Direction | Both ways | Server to client | Both ways |
| Reconnection | Opt-in on the client, with optional message replay | Automatic in browsers, which send the last event ID for the server to resume from | Application's job |
| Client requirement | SignalR client library | Any HTTP client, `EventSource` in browsers | Any WebSocket client |
| Built-in groups and scale-out | Yes | No | No |

SignalR fits interactive features where both sides talk, such as chat, collaboration, and live dashboards that also take user actions. Its groups, user targeting, reconnection, and backplanes are the parts that are expensive to rebuild.

Server-Sent Events fit one-way feeds, such as notifications, progress updates, and price tickers, especially for clients that shouldn't need a SignalR library. Client-to-server traffic goes through ordinary HTTP requests.

Raw WebSockets fit a protocol the application doesn't control, such as a device protocol or a proxy for another WebSocket service, or a custom binary format that neither of SignalR's hub protocols can carry. Choosing them means building connection tracking, heartbeats, reconnection, and scale-out yourself.

## Key Takeaways

- Hubs are transient. Per-connection state goes in `Context.Items` or external storage, never in hub fields.
- Target users and groups rather than connection IDs, and rejoin groups after a reconnect, since a reconnected client is a new connection unless stateful reconnect bridges the gap.
- Browser clients send bearer tokens in the query string for WebSockets and SSE, so the JWT handler must read `access_token`. SignalR caches the principal for the connection's life, and `CloseOnAuthenticationExpiration` bounds that.
- More than one server needs sticky sessions plus a Redis backplane, or Azure SignalR Service, which removes both needs.
- Native AOT supports SignalR with the JSON protocol only and without strongly typed hubs.
- .NET 10's `TypedResults.ServerSentEvents` streams `SseItem<T>` events. Resumption after reconnect depends on the server reading `Last-Event-ID`.
- Raw WebSockets need `UseWebSockets`, a request that stays open, `KeepAliveTimeout` to detect dead clients, and `AllowedOrigins` in place of CORS.
