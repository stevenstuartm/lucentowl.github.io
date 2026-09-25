---
title: "gRPC Services in ASP.NET Core"
layout: guide
category: "ASP.NET Core"
subcategory: "Real-Time & RPC"
description: "Building and consuming gRPC services in ASP.NET Core: HTTP/2 hosting, service lifetime, errors and authorization, interceptors, the gRPC client factory, deadline propagation and retries, gRPC-Web and JSON transcoding for browsers, testing, client-side load balancing, and connection performance."
tags: [practical, grpc, protobuf, grpc-interceptors, grpc-web, json-transcoding]
---

ASP.NET Core hosts gRPC services as endpoints in the same app as controllers and minimal APIs. A gRPC service is routed by endpoint routing, runs behind the same middleware, resolves dependencies from the same container, and is protected by the same authentication and authorization policies. The [Grpc.AspNetCore](https://www.nuget.org/packages/Grpc.AspNetCore){:target="_blank" rel="noopener noreferrer"} package brings in the server, the code generator, and the Protobuf runtime.

## Project Setup and Code Generation

The .NET gRPC toolchain uses [Grpc.Tools](https://www.nuget.org/packages/Grpc.Tools){:target="_blank" rel="noopener noreferrer"} to generate C# code from `.proto` files at build time. A `<Protobuf>` item in the project file names each proto file and whether to generate server base classes, client classes, or both.

```xml
<ItemGroup>
  <Protobuf Include="Protos\greeter.proto" GrpcServices="Server" />
  <Protobuf Include="Protos\orders.proto" GrpcServices="Both" />
</ItemGroup>
```

During the build, Grpc.Tools runs the Protocol Buffers compiler (`protoc`) with the gRPC C# plugin. The generated files land in `obj/` and are compiled automatically. Nobody edits them. Changes go in the `.proto` source, and the next build regenerates the C#.

### Contract-First vs Code-First

The .NET ecosystem offers two ways to define gRPC contracts.

| Aspect | Google.Protobuf (Grpc.Tools) | protobuf-net.Grpc |
|---|---|---|
| Contract definition | `.proto` files | C# interfaces and data contracts |
| Code generation | Build-time from proto | No `.proto` step, since the library works from the C# types |
| Cross-platform sharing | Proto files shared across any language | C# types shared across .NET projects |
| Idiomatic feel | Protocol Buffers conventions | Native C# conventions |
| Other languages | Consume the same `.proto` files | Need a hand-written `.proto` that matches the C# contracts |

Google.Protobuf with Grpc.Tools is the standard approach and the one the ASP.NET Core templates use. It produces contracts that any language with a protobuf compiler can consume. [protobuf-net.Grpc](https://github.com/protobuf-net/protobuf-net.Grpc){:target="_blank" rel="noopener noreferrer"} suits teams that prefer to define contracts in C# and share them as NuGet packages between .NET services, giving up cross-language contracts for a more idiomatic .NET experience.

## Hosting Requirements

gRPC requires HTTP/2, and the server rejects a gRPC request that arrives over any other protocol. Kestrel endpoints accept HTTP/1.1 and HTTP/2 by default, but they choose between them during the TLS handshake, through Application-Layer Protocol Negotiation (ALPN). Without TLS there is no negotiation, so an endpoint that allows both protocols treats every connection as HTTP/1.1, and every gRPC call on it fails.

| Endpoint | gRPC | gRPC-Web and JSON transcoding over HTTP/1.1 |
| --- | --- | --- |
| TLS, `Http1AndHttp2` (the default) | Works | Works |
| Plaintext, `Http2` | Works | Fails |
| Plaintext, `Http1AndHttp2` | Fails | Works |

Development gets TLS for free through the ASP.NET Core development certificate. In production, an app behind a proxy that terminates TLS usually listens in plaintext, and so has to set its gRPC endpoint to HTTP/2 only:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Grpc": {
        "Url": "http://*:8080",
        "Protocols": "Http2"
      }
    }
  }
}
```

An app that also serves HTTP/1.1 clients in plaintext needs a second endpoint for them.

IIS and HTTP.sys can also host gRPC, on Windows 11 or Windows Server 2022 and later, with TLS and HTTP/2 enabled.

## Implementing Services

A gRPC service inherits from a generated base class and overrides the methods defined in the proto file. Each generated method fails with an `Unimplemented` error until overridden.

```csharp
public class OrderService(IOrderRepository repo) : Orders.OrdersBase
{
    public override async Task<OrderResponse> GetOrder(
        OrderRequest request, ServerCallContext context)
    {
        var order = await repo.FindByIdAsync(request.OrderId, context.CancellationToken);
        return order is null
            ? throw new RpcException(new Status(StatusCode.NotFound, "Order not found"))
            : MapToResponse(order);
    }
}
```

```csharp
builder.Services.AddGrpc();

app.MapGrpcService<OrderService>();
```

Unless the service type is registered in the container explicitly, the framework creates a new instance for every call from the request's service provider and disposes it afterward. That makes a service safe to take scoped dependencies such as a `DbContext`. Registering the service type yourself, for example as a singleton, replaces that behavior with whatever lifetime the registration gives.

`ServerCallContext` carries the call's request headers, deadline, and cancellation token. `context.GetHttpContext()` returns the underlying `HttpContext`, which is where the authenticated user lives, as `GetHttpContext().User`.

### Authorization

A gRPC service uses ASP.NET Core authentication and authorization like any other endpoint. By default every method accepts unauthenticated callers. `[Authorize]` on the service class protects every method, and `[Authorize("Policy")]` on a method adds a policy for that method alone, so a caller must satisfy the policies on both. `MapGrpcService<T>().RequireAuthorization(...)` applies a policy at mapping time, as it does for any endpoint.

Bearer tokens, client certificates, and OpenID Connect all work with gRPC. Windows authentication (NTLM, Kerberos, Negotiate) doesn't, because HTTP/2 doesn't support it.

### Errors and Status Codes

A gRPC call ends with a status code rather than an HTTP status. Throwing `RpcException` sends its status code and message to the client, as `GetOrder` does above. Any other exception also fails the call, but with `Unknown` and the generic message "Exception was thrown by handler", so internal details don't leak to clients. `EnableDetailedErrors` in the `AddGrpc` options sends the real exception message, which helps in development and leaks information in production.

A status and a string can't carry structure such as a list of invalid fields. The [`Grpc.StatusProto`](https://www.nuget.org/packages/Grpc.StatusProto){:target="_blank" rel="noopener noreferrer"} package adds Google's rich error model. The server throws a `Google.Rpc.Status` holding payloads such as `BadRequest` through `ToRpcException()`, and the client reads them back with `GetRpcStatus()`. The details travel in response headers, which servers and proxies often cap at 8 KB in total, so a rich error has to stay small.

### Streaming

Server streaming methods write messages progressively through an `IServerStreamWriter<T>`. The call stays open until the method returns or the client cancels.

```csharp
public override async Task StreamOrders(
    StreamRequest request,
    IServerStreamWriter<OrderResponse> responseStream,
    ServerCallContext context)
{
    await foreach (var order in repo.GetRecentOrdersAsync(context.CancellationToken))
    {
        await responseStream.WriteAsync(MapToResponse(order));
    }
}
```

Client streaming and bidirectional streaming methods read from an `IAsyncStreamReader<T>` the same way, usually with `await foreach (var message in requestStream.ReadAllAsync())`.

<div class="callout callout--warning"><p class="callout__title">One Thread per Stream</p><p>A stream reader and a stream writer can each be used by only one thread at a time. A bidirectional method may read on one thread and write on another, but two threads can't write to the same response stream. To produce messages from several threads, funnel them through a Channel&lt;T&gt;, the in-memory queue from System.Threading.Channels (unrelated to GrpcChannel), to a single writer loop. None of the call's objects (the context, the reader, or the writer) may be used after the service method returns, so background work that writes to the stream must finish before the method exits.</p></div>

## Interceptors

Interceptors wrap individual gRPC calls and can inspect, modify, or short-circuit requests and responses. They look like middleware but sit at a different level. Middleware sees the HTTP/2 request and runs for every endpoint in the app. An interceptor sees the deserialized request message and the `ServerCallContext`, knows which gRPC method is being called, and runs only for gRPC calls. That makes interceptors the place for concerns that need the message or the method, such as validation, per-method metrics, or mapping domain exceptions to status codes:

```csharp
public class ExceptionInterceptor : Interceptor
{
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(request, context);
        }
        catch (NotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
    }
}
```

Streaming calls go through separate overrides (`ServerStreamingServerHandler`, `ClientStreamingServerHandler`, `DuplexStreamingServerHandler`), so an interceptor that should cover every call type overrides all four.

Interceptors registered in `AddGrpc` apply to every service. `AddServiceOptions<T>` configures a single service. Its scalar options, such as message size limits, override the global values, but its interceptors are added to the global list rather than replacing it. Global interceptors run first, then per-service ones, each in registration order. By default an interceptor is created per call, and registering its type in the container changes that lifetime.

```csharp
builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<ExceptionInterceptor>();
})
.AddServiceOptions<OrderService>(options =>
{
    options.Interceptors.Add<AuditInterceptor>();
});
```

## Calling Services with the Client Factory

A client sends calls over a `GrpcChannel`, and a new channel has to open a new connection (a socket, TCP, TLS, and HTTP/2) before its first call. A channel is safe to share across threads and reuse for any number of concurrent calls. Creating one per call pays that setup cost every time.

The [Grpc.Net.ClientFactory](https://www.nuget.org/packages/Grpc.Net.ClientFactory){:target="_blank" rel="noopener noreferrer"} package handles reuse through `IHttpClientFactory`. `AddGrpcClient<T>()` registers the generated client as a transient service. Each injected client is a lightweight wrapper, and the factory reuses the underlying handler and connections.

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("https://orders-service:5001");
})
.AddInterceptor<LoggingInterceptor>()
.ConfigureChannel(channel =>
{
    channel.MaxReceiveMessageSize = 16 * 1024 * 1024;
});
```

A client interceptor added this way is created once and shared by every client instance. `AddInterceptor<T>(InterceptorScope.Client)` creates one per client instead, which an interceptor needs when it depends on scoped services. `AddCallCredentials` attaches an `Authorization` header to each call, for example from a token provider. Call credentials are sent only over a TLS channel. A client calling a plaintext `http://` address silently sends no token, unless the channel sets `UnsafeUseInsecureChannelCallCredentials`, which is only acceptable when the network path is protected some other way.

Named clients register the same client type more than once with different settings, such as with and without credentials. The factory's `CreateClient<T>(name)` resolves one by name.

## Deadlines, Cancellation, and Retries

A deadline is the absolute time by which a call must finish. The client sets it per call, and the server sees it as `context.Deadline` and as `context.CancellationToken`, which fires when the deadline passes or the client cancels. Passing that token into database queries and outgoing calls stops work nobody is waiting for.

```csharp
var response = await client.GetOrderAsync(
    request,
    deadline: DateTime.UtcNow.AddSeconds(5));
```

A call with no deadline has none, and can wait forever on an unresponsive server.

### Propagating Context

When a service calls another service while handling a call, the downstream call should inherit the remaining deadline and the cancellation. `EnableCallContextPropagation()`, from the `Grpc.AspNetCore.Server.ClientFactory` package, does this for a factory client.

```csharp
builder.Services.AddGrpcClient<Inventory.InventoryClient>(options =>
{
    options.Address = new Uri("https://inventory-service:5001");
})
.EnableCallContextPropagation();
```

A client configured this way throws when used outside a gRPC call, such as from a background service, because there's no call context to propagate. `EnableCallContextPropagation(o => o.SuppressContextNotFoundErrors = true)` allows both uses.

### Retry and Hedging Policies

The .NET gRPC client retries failed calls itself, configured once per channel through a service config. A retry policy retries calls that fail with a listed status code, with randomized exponential backoff between attempts:

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("https://orders-service:5001");
})
.ConfigureChannel(channel =>
{
    channel.ServiceConfig = new ServiceConfig
    {
        MethodConfigs =
        {
            new MethodConfig
            {
                Names = { MethodName.Default },   // every method on the channel
                RetryPolicy = new RetryPolicy
                {
                    MaxAttempts = 4,
                    InitialBackoff = TimeSpan.FromSeconds(1),
                    MaxBackoff = TimeSpan.FromSeconds(5),
                    BackoffMultiplier = 1.5,
                    RetryableStatusCodes = { StatusCode.Unavailable }
                }
            }
        }
    };
});
```

A call stops being retryable once it is *committed*, meaning the client has received response headers or its sent messages have outgrown the retry buffer. A server streaming call therefore never retries after its first message arrives, and it never retries past the call's deadline. `Unavailable` is the standard retryable code, since it usually signals a transient condition such as a server restarting. It doesn't prove the server never ran the call, so a retry policy belongs on idempotent methods. Codes such as `InvalidArgument` or `NotFound` return the same answer on every attempt.

A hedging policy sends several copies of a call, optionally staggered by a delay, and keeps the first success. It trades extra load for lower tail latency, and it runs the call on the server more than once, so it only suits methods that are safe to repeat. A method config takes either a retry policy or a hedging policy, not both.

These policies cover gRPC calls only. Outbound HTTP resilience with Polly is a separate topic, covered with `HttpClient`.

## Reaching Browsers

A browser can't make an HTTP/2 gRPC call. gRPC sends each call's status in HTTP/2 trailers, the headers that follow the body, and browser fetch APIs give no access to them. ASP.NET Core offers two ways around that, and both cover unary and server streaming calls only.

| | gRPC-Web | JSON transcoding |
|---|---|---|
| Client | A generated gRPC-Web client (JavaScript, or .NET in Blazor WebAssembly) | Any HTTP client, with no gRPC knowledge |
| Payload | Protobuf | JSON |
| Contract change | None | HTTP annotations in the `.proto` file |

Both work over HTTP/1.1 as well as HTTP/2. Since some clients can only use HTTP/1.1, the endpoint serving them usually needs `Http1AndHttp2` and therefore, per the hosting table above, TLS.

### gRPC-Web

The [Grpc.AspNetCore.Web](https://www.nuget.org/packages/Grpc.AspNetCore.Web){:target="_blank" rel="noopener noreferrer"} middleware translates gRPC-Web requests and hands them to the normal gRPC pipeline. It goes after routing and before the endpoints, and `DefaultEnabled` turns it on for every service instead of per service with `EnableGrpcWeb()`.

```csharp
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });
app.MapGrpcService<OrderService>();
```

A browser app on a different origin needs a CORS policy that exposes the gRPC headers (`Grpc-Status`, `Grpc-Message`, `Grpc-Encoding`, `Grpc-Accept-Encoding`, `Grpc-Status-Details-Bin`), or the client can't read the call's status.

A Blazor WebAssembly app calls gRPC-Web through the same client factory, with `GrpcWebHandler` from `Grpc.Net.Client.Web` as the primary handler (the innermost handler, the one that sends the request), and shares the `.proto` files with the server. Server streaming in a browser needs `GrpcWebMode.GrpcWebText`, which base64-encodes the messages, and only the async client methods work, since a blocking call freezes the app.

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("https://api.example.com");
})
.ConfigurePrimaryHttpMessageHandler(() =>
    new GrpcWebHandler(GrpcWebMode.GrpcWebText, new HttpClientHandler()));
```

### JSON Transcoding

[Microsoft.AspNetCore.Grpc.JsonTranscoding](https://www.nuget.org/packages/Microsoft.AspNetCore.Grpc.JsonTranscoding){:target="_blank" rel="noopener noreferrer"} exposes annotated gRPC methods as JSON HTTP endpoints, so one service implementation serves gRPC clients and plain HTTP clients. Each method declares its HTTP binding in the proto file:

```protobuf
import "google/api/annotations.proto";

service Orders {
  rpc GetOrder(OrderRequest) returns (OrderResponse) {
    option (google.api.http) = {
      get: "/v1/orders/{order_id}"
    };
  }
}
```

```csharp
builder.Services.AddGrpc().AddJsonTranscoding();
```

The project also sets `<IncludeHttpRuleProtos>true</IncludeHttpRuleProtos>` so the build can find `google/api/annotations.proto`. A `GET /v1/orders/42` request then binds `42` to `order_id`, calls `GetOrder`, and returns the response as JSON. Server streaming methods return line-delimited JSON, one object per message.

Transcoding suits an API that has internal gRPC consumers and external consumers who expect ordinary HTTP and JSON, without maintaining two implementations. Unannotated methods stay gRPC-only. External HTTP consumers usually expect an OpenAPI document, and transcoding has no supported way to produce one. The experimental `Microsoft.AspNetCore.Grpc.Swagger` package that did so is deprecated with no direct replacement, so a transcoded API that needs a published contract has to build its document separately.

## Testing gRPC Services

### Unit Testing

A service is a class, so a unit test constructs it with fake dependencies and calls its methods. Every method takes a `ServerCallContext`, which is abstract. The test sample in Microsoft's gRPC testing docs includes a small `TestServerCallContext` class that implements it, and copying that helper is simpler than the older `Grpc.Core.Testing` package, which depends on the retired native `Grpc.Core` library.

```csharp
[Fact]
public async Task GetOrder_ReturnsOrder_WhenExists()
{
    var service = new OrderService(new FakeOrderRepository(existingOrder));

    var response = await service.GetOrder(
        new OrderRequest { OrderId = 1 }, TestServerCallContext.Create());

    Assert.Equal(existingOrder.Id, response.OrderId);
}
```

Code that consumes a gRPC client mocks the client itself. Generated client classes are concrete, but their call methods are virtual, so a mocking library can override them. The mock returns an `AsyncUnaryCall<T>` built around the response:

```csharp
var call = new AsyncUnaryCall<OrderResponse>(
    Task.FromResult(new OrderResponse { OrderId = 1 }),
    Task.FromResult(new Metadata()),
    () => Status.DefaultSuccess,
    () => new Metadata(),
    () => { });

var client = new Mock<Orders.OrdersClient>();
client.Setup(c => c.GetOrderAsync(It.IsAny<OrderRequest>(), null, null, CancellationToken.None))
      .Returns(call);
```

### Integration Testing

An integration test hosts the app in `WebApplicationFactory` and calls it through a real gRPC client, which exercises routing, interceptors, serialization, authentication, and dependency injection together. The channel sends its calls through the in-memory test server's handler:

```csharp
[Fact]
public async Task GetOrder_IntegrationTest()
{
    await using var factory = new WebApplicationFactory<Program>();
    using var channel = GrpcChannel.ForAddress(
        factory.Server.BaseAddress,
        new GrpcChannelOptions { HttpHandler = factory.Server.CreateHandler() });

    var client = new Orders.OrdersClient(channel);
    var response = await client.GetOrderAsync(new OrderRequest { OrderId = 1 });

    Assert.Equal(1, response.OrderId);
}
```

## Health Checks and Reflection

The [Grpc.AspNetCore.HealthChecks](https://www.nuget.org/packages/Grpc.AspNetCore.HealthChecks){:target="_blank" rel="noopener noreferrer"} package implements the standard [gRPC health checking protocol](https://github.com/grpc/grpc/blob/master/doc/health-checking.md){:target="_blank" rel="noopener noreferrer"} on top of ASP.NET Core's health checks, so the checks an app already registers answer gRPC health requests too. Kubernetes gRPC probes and gRPC-aware proxies such as Envoy can then use the native protocol instead of a separate HTTP endpoint.

```csharp
builder.Services.AddGrpcHealthChecks()
    .AddCheck("database", new DatabaseHealthCheck());

app.MapGrpcHealthChecksService();
```

gRPC reflection, from `Grpc.AspNetCore.Server.Reflection`, lets tools such as [grpcurl](https://github.com/fullstorydev/grpcurl){:target="_blank" rel="noopener noreferrer"} and [grpcui](https://github.com/fullstorydev/grpcui){:target="_blank" rel="noopener noreferrer"} list services and call methods without the proto files. It publishes the service's full contract, so it usually stays in development:

```csharp
builder.Services.AddGrpcReflection();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

## Connections and Performance

### Concurrent Streams

A channel multiplexes calls over one HTTP/2 connection, and most servers cap a connection at 100 concurrent streams. When a channel reaches that limit, further calls queue on the client until a stream frees up, which shows up as latency under load or with many long-running streaming calls. A `GrpcChannel` configures its own internal handler to open additional connections when the limit is reached. An app that supplies its own `SocketsHttpHandler` has to set `EnableMultipleHttp2Connections` itself:

```csharp
var handler = new SocketsHttpHandler
{
    EnableMultipleHttp2Connections = true,
    PooledConnectionIdleTimeout = Timeout.InfiniteTimeSpan,
    KeepAlivePingDelay = TimeSpan.FromSeconds(60),
    KeepAlivePingTimeout = TimeSpan.FromSeconds(30)
};
```

The keep-alive settings send an HTTP/2 ping every 60 seconds on an idle connection so that proxies don't close it. They need the server's cooperation. A server that doesn't expect pings may answer with `GOAWAY`, the HTTP/2 frame that shuts a connection down, and close it.

### Load Balancing

Because a channel keeps one long-lived connection, a connection-level load balancer sends all of a client's calls to one backend. Spreading calls needs either an HTTP/2-aware proxy or client-side load balancing, which the .NET client supports from `Grpc.Net.Client` 2.45. The address scheme picks a resolver instead of the transport, so `dns:///` resolves the host name to every backend address. Because the scheme no longer says `http` or `https`, the channel must set its credentials explicitly:

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("dns:///orders-service:8080");
})
.ConfigureChannel(channel =>
{
    channel.Credentials = ChannelCredentials.Insecure;   // or ChannelCredentials.SecureSsl
    channel.ServiceConfig = new ServiceConfig { LoadBalancingConfigs = { new RoundRobinConfig() } };
});

// Re-resolve every 30 seconds, not only when a connection drops
builder.Services.AddSingleton<ResolverFactory>(
    _ => new DnsResolverFactory(refreshInterval: TimeSpan.FromSeconds(30)));
```

Without a load-balancing config the channel uses `pick_first`, which sends every call to the first address it connects to. By default the resolver refreshes only when a connection drops, so without a refresh interval a client doesn't notice new instances until something fails. In Kubernetes, DNS returns each pod's address only for a headless service, which has no virtual IP of its own. A normal service returns one virtual IP, which leaves nothing to balance. Once a streaming call starts, all of its messages go to one backend.

### Message Size and Compression

A server or client accepts incoming messages up to 4 MB by default, and outgoing messages are unlimited. `MaxReceiveMessageSize` and `MaxSendMessageSize` change them. gRPC loads each whole message into memory, so large binary payloads are better split across a streaming call, or served by an ordinary HTTP endpoint that streams the body, than raised limits.

The server compresses responses with gzip when `ResponseCompressionAlgorithm` is set in the `AddGrpc` options and the client lists the algorithm in its `grpc-accept-encoding` header.

### Native AOT

gRPC services support Native AOT since .NET 8, alongside minimal APIs and worker services. A native build starts faster and uses less memory than a JIT build, which matters most for containers that scale out often. Microsoft's docs suggest switching the host to `CreateSlimBuilder` to shrink a native gRPC service further. The slim builder leaves HTTPS out of Kestrel, so a service that makes the switch either runs as a plaintext HTTP/2 endpoint behind a TLS-terminating proxy or adds HTTPS back explicitly.

## Same-Machine Transports

When the client and server run on the same machine, as with a sidecar (a helper process deployed next to the main app), gRPC can run over Unix domain sockets or named pipes instead of TCP. Both skip the network stack. Access is controlled by operating system permissions, socket file permissions or pipe access control lists, rather than by TLS. The client should still verify it reached the real server, through pipe ownership or TLS with certificate validation, since a malicious process could otherwise stop the server and listen in its place.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenUnixSocket("/tmp/orders.sock", listen => listen.Protocols = HttpProtocols.Http2);
});
```

Unix domain sockets work on Linux, macOS, and Windows 10 or Windows Server 2019 and later. Named pipes, served with `ListenNamedPipe` since .NET 8, are Windows-native and can restrict which Windows accounts may connect through access control lists. The client connects to either through a `SocketsHttpHandler` whose `ConnectCallback` opens the socket or pipe. A channel configured that way can't use client-side load balancing, and throws if asked to. For services that might later move to separate hosts, starting with TCP keeps that move a configuration change.
