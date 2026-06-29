---
title: "SignalR and Real-Time APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "API Programming Models"
description: "Real-time communication patterns in ASP.NET Core using SignalR, Server-Sent Events, and raw WebSockets, including authentication, scaling, and Native AOT support."
tags: [asp-net-core, signalr, real-time, websockets, server-sent-events, distributed-systems, performance]
---

## Real-Time Communication in ASP.NET Core

ASP.NET Core provides three distinct approaches for real-time communication between servers and clients. SignalR offers high-level abstractions for bidirectional messaging with automatic transport fallback and built-in scaling patterns. Server-Sent Events provide native unidirectional streaming from server to client with automatic browser reconnection. Raw WebSockets give complete control over the connection for custom protocols or performance-critical scenarios. Understanding when each approach fits determines whether you build maintainable real-time features or fight against your chosen abstraction.

## SignalR Hubs

SignalR organizes real-time communication around hubs, which are classes that serve as high-level pipelines between clients and servers. Clients invoke methods on the hub, and hubs invoke methods on clients. This bidirectional communication model abstracts away the transport layer, allowing SignalR to fall back from WebSockets to Server-Sent Events or long polling based on client and server capabilities.

A hub inherits from the Hub base class and defines methods that clients can invoke. These methods can accept parameters and return values, which SignalR serializes and deserializes automatically.

```csharp
public class ChatHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}
```

The Hub class exposes a Clients property that provides access to all connected clients, specific clients, groups, and the calling client. This property returns an IHubCallerClients instance with methods for targeting different subsets of connections.

Hubs are transient. You cannot store state in a property on the hub class. Each hub method invocation executes on a new hub instance. This means constructor injection works as expected, but storing per-connection state requires external storage or using connection-scoped services.

## Managing Connections and Groups

SignalR assigns each connection a unique connection ID accessible via Context.ConnectionId. This identifier remains stable for the lifetime of the connection and allows targeting specific clients.

Groups provide a way to broadcast messages to arbitrary subsets of connected clients without manually tracking connection IDs. A connection can be a member of multiple groups, and groups are not persisted. When a connection reconnects, it must rejoin its groups.

```csharp
public class ChatHub : Hub
{
    public async Task JoinRoom(string roomName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
        await Clients.Group(roomName).SendAsync("UserJoined", Context.User.Identity.Name);
    }

    public async Task SendToRoom(string roomName, string message)
    {
        await Clients.Group(roomName).SendAsync("ReceiveMessage", message);
    }
}
```

Groups are managed through the Groups property on the Hub base class. Adding and removing connections from groups are asynchronous operations that complete immediately in memory. SignalR does not persist group membership, so applications must rejoin groups after reconnection.

The OnConnectedAsync and OnDisconnectedAsync methods provide lifecycle hooks for managing connection state. OnConnectedAsync executes when a client connects, allowing the hub to perform initialization like joining default groups. OnDisconnectedAsync executes when a client disconnects, whether gracefully or due to network failure, allowing cleanup of any per-connection resources.

## Strongly-Typed Hub Contracts

Defining client methods as strings creates brittle coupling between server and client code. Changes to method names or parameter types at runtime produce errors that only surface during testing or in production. Strongly-typed hubs eliminate this fragility by defining client methods in an interface that both server and client can reference.

Instead of inheriting from Hub, inherit from Hub<T> where T is an interface defining all methods that clients implement. This provides compile-time checking of client method calls and enables IDE features like refactoring and IntelliSense.

```csharp
public interface IChatClient
{
    Task ReceiveMessage(string user, string message);
    Task UserJoined(string user);
    Task UserLeft(string user);
}

public class ChatHub : Hub<IChatClient>
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.ReceiveMessage(user, message);
    }
}
```

The strongly-typed approach replaces the stringly-typed SendAsync method with direct method calls on the Clients property. The return type of client methods must be Task or ValueTask to represent the asynchronous nature of network communication.

When using strongly-typed hubs, the client implementation must match the server interface exactly. SignalR serializes method parameters and deserializes them on the client side, which means parameter types must be serializable and match between server and client.

Using Hub<T> disables the SendAsync method entirely. This trade-off ensures that all client invocations are type-safe and discoverable through the interface definition. Applications that need to invoke methods not known at compile time cannot use strongly-typed hubs.

## Authentication and Authorization

SignalR integrates with ASP.NET Core authentication and authorization mechanisms. The Authorize attribute works on hub classes and hub methods just as it does on controllers, allowing role-based, policy-based, and claim-based authorization.

```csharp
[Authorize]
public class ChatHub : Hub<IChatClient>
{
    [Authorize(Policy = "AdminOnly")]
    public async Task BanUser(string userId)
    {
        // Only admins can ban users
    }
}
```

The authenticated user's identity is available through Context.User within hub methods. This ClaimsPrincipal instance contains the same claims available in HTTP requests, allowing hubs to make authorization decisions based on user identity.

SignalR authentication differs from standard HTTP API authentication because persistent connections require passing credentials during the initial handshake rather than on each message. Browser clients using WebSockets or Server-Sent Events cannot set custom headers, so SignalR accepts access tokens via query string parameters during connection establishment.

Bearer token authentication is the recommended approach when using clients other than browsers. The server configures JWT bearer token authentication to read access tokens from the query string by hooking the OnMessageReceived event. This allows the JWT authentication handler to extract the token from the query string when a WebSocket or Server-Sent Events request arrives.

```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
```

When using HTTPS, query string values are secured by the TLS connection. However, tokens in query strings may appear in server logs or browser history, so applications should use short-lived tokens and implement token refresh patterns.

Non-browser clients can set custom headers and should prefer the standard Authorization header over query string parameters. The SignalR JavaScript client supports setting headers through the accessTokenFactory option, which allows dynamically generating tokens when connections are established or reconnected.

## Scaling SignalR Across Multiple Servers

A single SignalR server maintains all connection state in memory. When a client connects to server A and another client connects to server B, messages sent to a group or all clients only reach connections on the server that sent the message. Scaling horizontally requires a backplane that coordinates message distribution across all servers.

The Redis backplane uses Redis pub/sub to forward messages between servers. When a client makes a connection, the connection information is passed to the backplane. When a server wants to send a message to all clients, it publishes to Redis. Redis knows all connected clients and which servers they are on, then forwards the message to the appropriate servers.

```csharp
services.AddSignalR()
    .AddStackExchangeRedis(connectionString, options =>
    {
        options.Configuration.ChannelPrefix = "MyApp";
    });
```

Redis backplanes work well when the Redis instance runs in the same datacenter as the SignalR application. Network latency between the application and Redis directly impacts message delivery latency. For production deployments, running Redis close to the application servers minimizes this impact.

Sticky sessions are required with a Redis backplane unless all clients are configured to use only WebSockets. Once a connection is initiated on a server, subsequent requests for that connection must route to the same server. Load balancers typically implement sticky sessions through cookies or consistent hashing based on connection identifiers.

Azure SignalR Service provides an alternative scaling approach that eliminates the need for a backplane. Instead of coordinating messages through Redis, Azure SignalR Service manages all connections and message routing. Client connections are redirected to Azure SignalR Service during the initial handshake, while the application server only handles hub method invocations.

Azure SignalR Service has significant advantages over Redis backplanes when hosting on Azure. Sticky sessions are not required because clients connect directly to the service rather than to application servers. The application can scale independently of connection count since Azure SignalR Service manages the connections. This separation allows applications to scale based on CPU or memory usage rather than connection count.

The service handles connection management, protocol negotiation, and message routing, which simplifies application architecture and reduces operational complexity. However, it introduces a dependency on an external service and requires network communication between application servers and Azure SignalR Service for hub method invocations.

## SignalR with Native AOT

Starting with .NET 9, SignalR supports Native AOT compilation for both client and server scenarios. This enables applications to use SignalR while benefiting from the startup time and memory footprint improvements of Native AOT.

Applications using SignalR with Native AOT must use the System.Text.Json source generator for JSON serialization. The source generator produces ahead-of-time serialization code, which eliminates the reflection-based serialization that is incompatible with Native AOT.

Several SignalR features are not compatible with Native AOT. Strongly-typed hubs using Hub<T> are not supported and will produce build warnings and runtime exceptions. Hub methods cannot accept IAsyncEnumerable<T> or ChannelReader<T> parameters where T is a value type, as these types require reflection-based serialization code generation.

Hub method return types are limited to Task, Task<T>, ValueTask, or ValueTask<T>. The generic parameter T must be a reference type or a value type annotated for polymorphic serialization if derived types are involved.

```csharp
[JsonPolymorphic]
[JsonDerivedType(typeof(DerivedMessage), "derived")]
public abstract class BaseMessage
{
    public string Content { get; set; }
}

public class DerivedMessage : BaseMessage
{
    public DateTime Timestamp { get; set; }
}
```

Hub methods can now accept base classes and return derived types when the base type is annotated with JsonPolymorphicAttribute. This enables polymorphic scenarios while maintaining Native AOT compatibility. The System.Text.Json serializer uses the type discriminator defined in the JsonDerivedType attribute to determine which concrete type to instantiate during deserialization.

Native AOT imposes these restrictions because it cannot generate serialization code at runtime. Applications must provide serialization metadata at compile time through source generators and attributes. This trade-off delivers significantly faster startup times and smaller deployment sizes at the cost of some dynamic features.

## Server-Sent Events

Server-Sent Events provide native unidirectional streaming from server to client over standard HTTP connections. Unlike WebSockets, SSE works over HTTP/1.1 and HTTP/2 without requiring a protocol upgrade, which simplifies firewall and proxy configuration. Browsers automatically handle reconnection through the EventSource API when connections drop.

Starting with .NET 10, ASP.NET Core provides built-in support for Server-Sent Events through the TypedResults.ServerSentEvents API. This method accepts an IAsyncEnumerable<SseItem<T>> representing the stream of events to send to the client.

```csharp
app.MapGet("/events", async (CancellationToken token) =>
{
    var events = GetEventStream(token);
    return TypedResults.ServerSentEvents(events, eventType: "notification");
});

async IAsyncEnumerable<SseItem<string>> GetEventStream(
    [EnumeratorCancellation] CancellationToken token)
{
    while (!token.IsCancellationRequested)
    {
        await Task.Delay(1000, token);
        yield return new SseItem<string>
        {
            Data = $"Event at {DateTime.UtcNow}",
            Id = Guid.NewGuid().ToString()
        };
    }
}
```

The SseItem<T> type represents a single event message with optional fields for event type, ID, and data payload. The framework handles Content-Type headers, keeps connections alive, and formats messages according to the HTML specification.

Server-Sent Events support automatic reconnection with resumption. When a connection drops, browsers automatically attempt to reconnect and send the Last-Event-ID header containing the ID of the last successfully received event. Servers can use this ID to resume the stream from where the client left off rather than restarting from the beginning.

This reconnection behavior happens automatically in browsers without application code. The EventSource API manages the connection lifecycle, including exponential backoff for failed reconnection attempts. Applications only need to provide event IDs in their SseItem instances to enable resumption.

Server-Sent Events are text-based and typically use JSON for structured data. This makes them heavier than binary protocols for high-throughput scenarios but simpler to debug and monitor. The text/event-stream content type is well understood by proxies and CDNs, which generally handle SSE connections correctly without special configuration.

## Raw WebSocket Connections

Raw WebSocket connections provide full control over the protocol for applications that need custom message formats, binary protocols, or maximum performance. Unlike SignalR, raw WebSockets do not include automatic reconnection, protocol negotiation, or message framing beyond the WebSocket specification.

The WebSocket middleware in ASP.NET Core handles the protocol upgrade handshake and provides access to the WebSocket instance. Applications must explicitly check whether a request is a WebSocket request before accepting the connection.

```csharp
app.Use(async (context, next) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        await HandleWebSocketConnection(webSocket);
    }
    else
    {
        await next();
    }
});

async Task HandleWebSocketConnection(WebSocket webSocket)
{
    var buffer = new byte[4096];
    var result = await webSocket.ReceiveAsync(
        new ArraySegment<byte>(buffer),
        CancellationToken.None);

    while (!result.CloseStatus.HasValue)
    {
        await webSocket.SendAsync(
            new ArraySegment<byte>(buffer, 0, result.Count),
            result.MessageType,
            result.EndOfMessage,
            CancellationToken.None);

        result = await webSocket.ReceiveAsync(
            new ArraySegment<byte>(buffer),
            CancellationToken.None);
    }

    await webSocket.CloseAsync(
        result.CloseStatus.Value,
        result.CloseStatusDescription,
        CancellationToken.None);
}
```

When using raw WebSockets, the middleware pipeline must remain running for the duration of the connection. Returning from the request handler closes the connection. This differs from standard request processing where the pipeline completes and the framework closes the connection automatically.

The server is not automatically informed when clients disconnect due to network failures. The server receives a close message only if the client sends it explicitly, which cannot happen if internet connectivity is lost. Applications must implement heartbeat mechanisms or timeouts to detect failed connections.

WebSocket messages can be text or binary and can span multiple frames. The EndOfMessage property on WebSocketReceiveResult indicates whether the current frame is the final frame of a message. Applications that expect large messages must buffer frames until a complete message is received.

Chrome, Edge, and Firefox (version 128 and later) support HTTP/2 WebSockets by default, which allows multiplexing multiple WebSocket connections over a single TCP connection. This reduces connection overhead when establishing many concurrent WebSocket connections to the same server.

## Choosing Between SignalR, SSE, and WebSockets

The choice between SignalR, Server-Sent Events, and raw WebSockets depends on communication patterns, client capabilities, and operational requirements. Each approach makes different trade-offs between abstraction, control, and complexity.

SignalR is appropriate when you need bidirectional communication with automatic transport fallback and connection management. Applications like chat systems, collaborative editing, and real-time dashboards that push updates to clients and receive user actions benefit from SignalR's high-level abstractions. The built-in support for groups, automatic reconnection, and scaling patterns reduces development time compared to implementing these features with raw WebSockets.

However, SignalR introduces overhead from its protocol layer and requires clients to use the SignalR client library. Applications that need custom message formats or integration with existing WebSocket clients may find SignalR's abstractions limiting.

Server-Sent Events fit scenarios where the server pushes updates to clients without requiring bidirectional communication. Stock tickers, live sports scores, and notification streams are natural fits for SSE. The browser's EventSource API handles reconnection automatically, and the protocol works over standard HTTP without requiring WebSocket support from proxies or firewalls.

The unidirectional nature of SSE means clients must use standard HTTP requests for sending data to the server. This separation between push and pull can simplify architecture by using established REST or RPC patterns for client-to-server communication while using SSE for server-to-client updates.

Raw WebSockets are appropriate when you need full control over the protocol or maximum performance. Applications implementing custom binary protocols, proxying other WebSocket protocols, or optimizing for minimal latency benefit from direct WebSocket access. However, this control comes at the cost of implementing connection management, heartbeats, and reconnection logic manually.

| Approach | Direction | Reconnection | Browser Support | Proxy Friendly | Overhead |
|----------|-----------|--------------|-----------------|----------------|----------|
| SignalR | Bidirectional | Automatic | Universal (fallback) | High | Medium |
| Server-Sent Events | Server to Client | Automatic | Modern browsers | High | Low |
| Raw WebSockets | Bidirectional | Manual | Modern browsers | Medium | Minimal |

The distinction between these approaches is not always clear-cut. Applications can combine multiple patterns, using SSE for server-to-client updates while handling client-to-server communication through standard HTTP requests. This hybrid approach can be simpler than implementing bidirectional WebSocket communication when the bidirectional requirement is not frequent.

For applications already using SignalR, Server-Sent Events or raw WebSockets may not provide sufficient benefit to justify replacing working code. For new applications, starting with the highest-level abstraction that meets requirements reduces complexity. Begin with SignalR or SSE unless specific constraints require raw WebSocket control.

## Red Flags

Watch for these patterns that indicate potential issues with real-time communication implementations.

**Storing connection state in hub instances**. Hubs are transient, and storing state in hub properties leads to lost state between method invocations. Use external storage, connection-scoped services, or groups for managing per-connection state.

**Not handling reconnection in clients**. Network failures are common, and clients that do not implement reconnection logic leave users with broken experiences. SignalR clients provide automatic reconnection, but applications must handle reconnection for raw WebSockets.

**Scaling without a backplane**. Deploying multiple SignalR servers without a backplane or Azure SignalR Service breaks group messaging and client targeting. Messages sent to groups only reach clients connected to the same server.

**Using strongly-typed hubs with Native AOT**. Strongly-typed hubs are not supported in Native AOT and will produce runtime exceptions. Use standard Hub base class and SendAsync when targeting Native AOT.

**Exposing access tokens in query strings without considering logging**. While query string authentication is necessary for browser WebSocket connections, tokens may appear in server logs. Use short-lived tokens and implement token refresh patterns to limit exposure.

**Not implementing heartbeats with raw WebSockets**. The server does not automatically detect client disconnection due to network failure. Applications using raw WebSockets must implement heartbeat mechanisms to detect and clean up dead connections.

**Choosing raw WebSockets without understanding the cost**. Raw WebSockets provide control at the cost of implementing connection management, message framing, reconnection, and heartbeats. SignalR or SSE may provide sufficient control while eliminating this complexity.

**Using Server-Sent Events for bidirectional communication**. SSE only supports server-to-client messages. Applications that attempt to use SSE for bidirectional communication must implement client-to-server communication separately, which may indicate SignalR is a better fit.
