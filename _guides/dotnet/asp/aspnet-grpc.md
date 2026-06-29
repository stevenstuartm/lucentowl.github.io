---
title: "gRPC Services in ASP.NET Core"
layout: guide
category: "ASP.NET Core"
subcategory: "API Programming Models"
description: "Building and consuming gRPC services in ASP.NET Core including client factory patterns, interceptors, streaming, testing strategies, gRPC-Web for Blazor, and JSON transcoding."
tags: [asp-net-core, grpc, distributed-systems, performance, microservices, testing, real-time, practical]
---

ASP.NET Core treats gRPC as a first-class API programming model alongside controllers, minimal APIs, and SignalR. A gRPC service plugs into the same hosting infrastructure, middleware pipeline, dependency injection container, and endpoint routing system that every other ASP.NET Core endpoint uses. This means you get the same logging, authentication, authorization, and health check capabilities without adopting a separate server runtime. The [Grpc.AspNetCore](https://www.nuget.org/packages/Grpc.AspNetCore){:target="_blank" rel="noopener noreferrer"} metapackage brings everything together, and from .NET 8 onward, gRPC services support Native AOT compilation for fast cold starts in container and serverless environments.

gRPC in ASP.NET Core is not a separate server bolted on. It is another endpoint in the same pipeline, shaped by the same middleware, secured by the same policies, and tested with the same WebApplicationFactory.

## Project Setup and Code Generation

The .NET gRPC toolchain uses [Grpc.Tools](https://www.nuget.org/packages/Grpc.Tools){:target="_blank" rel="noopener noreferrer"} to generate C# code from `.proto` files at build time. You reference proto files through the `<Protobuf>` item group in your project file, specifying whether to generate server stubs, client stubs, or both.

```xml
<ItemGroup>
  <Protobuf Include="Protos\greeter.proto" GrpcServices="Server" />
  <Protobuf Include="Protos\orders.proto" GrpcServices="Both" />
</ItemGroup>
```

During the build, Grpc.Tools invokes the protocol buffer compiler (`protoc`) along with the gRPC C# plugin. The generated files land in the `obj/` directory and are automatically included in compilation. You never edit these files directly; changes go in the `.proto` source, and the next build regenerates the C# code.

### Contract-First vs Code-First

The .NET ecosystem offers two distinct approaches to defining gRPC contracts.

| Aspect | Google.Protobuf (Grpc.Tools) | protobuf-net.Grpc |
|---|---|---|
| Contract definition | `.proto` files | C# interfaces and data contracts |
| Code generation | Build-time from proto | Runtime or source generator |
| Cross-platform sharing | Proto files shared across any language | C# types shared across .NET projects |
| Idiomatic feel | Protocol Buffers conventions | Native C# conventions |
| Ecosystem compatibility | Full gRPC ecosystem tooling | .NET-only consumers |

Google.Protobuf with Grpc.Tools is the standard approach and the one that ASP.NET Core's built-in templates use. It produces cross-platform contracts that any language with a protobuf compiler can consume. [protobuf-net.Grpc](https://github.com/protobuf-net/protobuf-net.Grpc){:target="_blank" rel="noopener noreferrer"} appeals to teams that prefer defining contracts in C# and sharing them as NuGet packages between .NET services, trading cross-platform compatibility for a more idiomatic .NET experience.

## Implementing Services

A gRPC service in ASP.NET Core inherits from a generated base class and overrides the methods defined in the proto file. The service class is a regular C# class that participates fully in dependency injection, so you can inject repositories, loggers, and any other registered service through the constructor.

```csharp
public class OrderService : Orders.OrdersBase
{
    private readonly IOrderRepository _repo;

    public OrderService(IOrderRepository repo) => _repo = repo;

    public override async Task<OrderResponse> GetOrder(
        OrderRequest request, ServerCallContext context)
    {
        var order = await _repo.FindByIdAsync(request.OrderId);
        return order is null
            ? throw new RpcException(new Status(StatusCode.NotFound, "Order not found"))
            : MapToResponse(order);
    }
}
```

Services register through endpoint routing using `MapGrpcService<T>()`, following the same pattern as controllers and minimal API endpoints.

```csharp
app.MapGrpcService<OrderService>();
```

The DI lifetime for gRPC services is scoped per request, matching the behavior of controller instances. Each incoming RPC creates a new service instance with its own scoped service provider.

### Server Streaming

Server streaming methods return data progressively through an `IServerStreamWriter<T>`. The method remains active until it finishes writing or the client cancels.

```csharp
public override async Task StreamOrders(
    StreamRequest request,
    IServerStreamWriter<OrderResponse> responseStream,
    ServerCallContext context)
{
    await foreach (var order in _repo.GetRecentOrdersAsync(context.CancellationToken))
    {
        await responseStream.WriteAsync(MapToResponse(order));
    }
}
```

<div class="callout callout--warning"><p class="callout__title">Threading Constraint</p><p>Stream readers and writers in gRPC are not thread-safe. You must write to a response stream from a single thread at a time. Concurrent writes require explicit synchronization. Use a Channel&lt;T&gt; to funnel messages to a single writer loop.</p></div>

## Client Factory and Dependency Injection

The `AddGrpcClient<T>()` extension method registers a typed gRPC client in the DI container, mirroring the `IHttpClientFactory` pattern that .NET developers already use for HTTP clients. This approach manages the underlying `GrpcChannel` lifecycle, reuses connections, and provides a clean injection point.

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

Inject the typed client directly into consuming classes, just like you would with a typed HTTP client. The factory handles channel creation, pooling, and disposal.

Named clients work the same way as named HTTP clients when you need multiple configurations for the same client type. The factory ensures that each named registration maintains its own channel configuration, interceptors, and credentials independently.

Channel reuse matters because creating a `GrpcChannel` establishes an HTTP/2 connection. Creating one per call wastes resources and defeats gRPC's connection multiplexing advantage. The client factory solves this by managing channel lifetime centrally.

## Interceptors

Interceptors are the gRPC equivalent of ASP.NET Core middleware, but they operate at the gRPC call level rather than the HTTP level. They wrap individual RPC calls and can inspect, modify, or short-circuit both requests and responses. Common uses include logging, metrics collection, authentication enforcement, exception mapping, and distributed tracing context propagation.

A server interceptor that maps domain exceptions to gRPC status codes keeps error-handling logic centralized rather than duplicated across every service method.

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

Register interceptors globally through the `AddGrpc` options, which applies them to every gRPC service, or per-service through the service configuration on `MapGrpcService<T>()`. Global registration works well for cross-cutting concerns like logging and tracing, while per-service registration suits concerns specific to certain services.

```csharp
builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<ExceptionInterceptor>();
    options.Interceptors.Add<MetricsInterceptor>();
});
```

Client interceptors follow the same pattern and register through `AddInterceptor<T>()` on the client builder, as shown in the client factory section.

## Deadlines, Cancellation, and Retries

Deadlines represent absolute timestamps that define when an RPC must complete. Unlike timeouts, which are relative durations, deadlines propagate through call chains. If Service A calls Service B with a 5-second deadline and 2 seconds elapse before the call reaches Service B, Service B sees 3 seconds remaining. This prevents cascading delays in distributed systems where a single slow downstream service would otherwise consume time from every upstream caller.

In .NET, you set deadlines on the call options when invoking a client method.

```csharp
var response = await client.GetOrderAsync(
    request,
    deadline: DateTime.UtcNow.AddSeconds(5));
```

On the server side, `ServerCallContext.CancellationToken` fires when the deadline expires or the client cancels the call. Passing this token to async operations like database queries ensures prompt cleanup when a call is no longer relevant.

### Propagating Context

When one gRPC service calls another, deadlines and cancellation should propagate automatically. The `EnableCallContextPropagation()` extension on the client factory configures this behavior so that downstream calls inherit the remaining deadline from the current server call context.

```csharp
builder.Services.AddGrpcClient<Inventory.InventoryClient>(options =>
{
    options.Address = new Uri("https://inventory-service:5001");
})
.EnableCallContextPropagation();
```

### Retry Policies

gRPC supports two retry strategies configured through `MethodConfig`. A `RetryPolicy` retries failed calls with exponential backoff, suitable for transient failures. A `HedgingPolicy` sends multiple concurrent attempts and uses the first successful response, suitable for latency-sensitive operations where you can tolerate duplicate processing.

Status codes like `Unavailable`, `DeadlineExceeded`, and `Aborted` are generally safe to retry. Status codes like `InvalidArgument`, `NotFound`, and `AlreadyExists` should never be retried because the result will not change. `Internal` requires judgment; retry only if you know the failure is transient.

## gRPC-Web and Blazor WebAssembly

Browsers cannot make native gRPC calls because they lack direct access to HTTP/2 framing. The [Grpc.AspNetCore.Web](https://www.nuget.org/packages/Grpc.AspNetCore.Web){:target="_blank" rel="noopener noreferrer"} middleware acts as a translator, accepting gRPC-Web requests over HTTP/1.1 and forwarding them to the standard gRPC infrastructure running on HTTP/2.

```csharp
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });
app.MapGrpcService<OrderService>().EnableGrpcWeb();
```

For Blazor WebAssembly applications, this enables sharing proto-generated contracts between the server and the browser client. Both sides reference the same `.proto` files and get strongly-typed client and server code from a single source of truth.

The Blazor WASM client configures gRPC-Web through the client factory with a `GrpcWebHandler`.

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("https://localhost:5001");
})
.ConfigurePrimaryHttpMessageHandler(() => new GrpcWebHandler(new HttpClientHandler()));
```

gRPC-Web has limitations compared to native gRPC. Client streaming and bidirectional streaming are not supported; only unary and server streaming calls work. CORS configuration is required when the Blazor app and gRPC service are hosted on different origins.

## JSON Transcoding

[Microsoft.AspNetCore.Grpc.JsonTranscoding](https://www.nuget.org/packages/Microsoft.AspNetCore.Grpc.JsonTranscoding){:target="_blank" rel="noopener noreferrer"} allows a single gRPC service implementation to serve both native gRPC clients over HTTP/2 and REST clients over HTTP/1.1 with JSON payloads. The transcoding layer reads HTTP annotations from your proto files and maps them to REST conventions automatically.

```protobuf
service Orders {
  rpc GetOrder(OrderRequest) returns (OrderResponse) {
    option (google.api.http) = {
      get: "/v1/orders/{order_id}"
    };
  }
}
```

This is useful when you need to support both internal gRPC consumers that benefit from binary serialization and external consumers that expect a conventional REST API. Rather than maintaining two separate implementations, you write the gRPC service once and the transcoding layer handles the translation.

JSON transcoding supports unary and server streaming calls only. Performance is lower than native gRPC because the transcoding layer adds JSON serialization overhead. For high-throughput internal communication, native gRPC clients remain the better choice.

```csharp
builder.Services.AddGrpc().AddJsonTranscoding();
```

## Testing gRPC Services

### Unit Testing

gRPC services are regular C# classes, so unit testing follows familiar patterns. The main consideration is providing a `ServerCallContext`, which you can create using `TestServerCallContext.Create()` from the [Grpc.Core.Testing](https://www.nuget.org/packages/Grpc.Core.Testing){:target="_blank" rel="noopener noreferrer"} package.

```csharp
[Fact]
public async Task GetOrder_ReturnsOrder_WhenExists()
{
    var repo = new FakeOrderRepository(existingOrder);
    var service = new OrderService(repo);
    var context = TestServerCallContext.Create(
        method: nameof(OrderService.GetOrder),
        host: "localhost",
        deadline: DateTime.MaxValue,
        requestHeaders: new Metadata(),
        cancellationToken: CancellationToken.None,
        peer: "127.0.0.1",
        authContext: null,
        contextPropagationToken: null,
        writeHeadersFunc: _ => Task.CompletedTask,
        writeOptionsGetter: () => new WriteOptions(),
        writeOptionsSetter: _ => { });

    var response = await service.GetOrder(new OrderRequest { OrderId = 1 }, context);

    Assert.Equal(existingOrder.Id, response.OrderId);
}
```

### Integration Testing

Integration testing with `WebApplicationFactory` validates the full gRPC pipeline including middleware, interceptors, serialization, and DI wiring. Create a `GrpcChannel` from the test server's handler to make real gRPC calls against the in-memory server.

```csharp
[Fact]
public async Task GetOrder_IntegrationTest()
{
    await using var factory = new WebApplicationFactory<Program>();
    using var channel = GrpcChannel.ForAddress(
        factory.Server.BaseAddress,
        new GrpcChannelOptions
        {
            HttpHandler = factory.Server.CreateHandler()
        });

    var client = new Orders.OrdersClient(channel);
    var response = await client.GetOrderAsync(new OrderRequest { OrderId = 1 });

    Assert.Equal(1, response.OrderId);
}
```

For consumer-side tests where you need to mock the gRPC client itself, mock the generated client interface. The code-generated clients are not sealed, so you can substitute them using any mocking library.

## Health Checks and Reflection

### Health Checking Protocol

The gRPC health checking protocol is a standardized mechanism defined in the [gRPC specification](https://github.com/grpc/grpc/blob/master/doc/health-checking.md){:target="_blank" rel="noopener noreferrer"} that allows clients and load balancers to query service health. The [Grpc.AspNetCore.HealthChecks](https://www.nuget.org/packages/Grpc.AspNetCore.HealthChecks){:target="_blank" rel="noopener noreferrer"} package integrates this protocol with ASP.NET Core's built-in health check system, so your existing `IHealthCheck` registrations automatically feed into gRPC health responses.

```csharp
builder.Services.AddGrpcHealthChecks()
    .AddCheck("database", new DatabaseHealthCheck());

app.MapGrpcHealthChecksService();
```

This allows gRPC-aware load balancers like Envoy and Kubernetes gRPC probes to check service health using the native protocol rather than requiring a separate HTTP health endpoint.

### Reflection

gRPC reflection enables runtime service discovery, allowing tools like [grpcurl](https://github.com/fullstorydev/grpcurl){:target="_blank" rel="noopener noreferrer"} and [grpcui](https://github.com/fullstorydev/grpcui){:target="_blank" rel="noopener noreferrer"} to explore available services and invoke methods without having the proto files locally. This is valuable during development and debugging but should generally be disabled in production to avoid exposing service metadata.

```csharp
builder.Services.AddGrpcReflection();

if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}
```

## Performance Configuration

### Channel and Connection Management

The most common gRPC performance mistake is creating channels per call instead of reusing them. A `GrpcChannel` establishes an HTTP/2 connection that multiplexes many concurrent RPCs over a single TCP connection. Creating one per call incurs connection setup overhead and defeats the multiplexing benefit.

For high-throughput scenarios where a single HTTP/2 connection becomes a bottleneck, configure connection pooling through `SocketsHttpHandler`. This creates multiple connections to a single endpoint and balances RPCs across them.

```csharp
var handler = new SocketsHttpHandler
{
    PooledConnectionIdleTimeout = Timeout.InfiniteTimeSpan,
    KeepAlivePingDelay = TimeSpan.FromSeconds(60),
    KeepAlivePingTimeout = TimeSpan.FromSeconds(30),
    EnableMultipleHttp2Connections = true
};
```

### Message Size and Compression

The default maximum message size is 4 MB for both sending and receiving. Adjust `MaxReceiveMessageSize` and `MaxSendMessageSize` when services exchange larger payloads like file transfers or batch operations. Message compression using gzip reduces bandwidth at the cost of CPU. Enable it through the `ResponseCompressionAlgorithm` and `ResponseCompressionLevel` options on `AddGrpc`.

### Native AOT

Starting with .NET 8, gRPC services support [Native AOT compilation](https://learn.microsoft.com/en-us/aspnet/core/grpc/native-aot){:target="_blank" rel="noopener noreferrer"}. This produces a self-contained binary with significantly faster cold starts and lower memory usage, making it attractive for container-based deployments and serverless scenarios where startup latency matters. AOT-compiled gRPC services avoid the JIT compilation overhead entirely, which can reduce startup time from seconds to milliseconds for small services.

## IPC Transports

gRPC in .NET is not limited to TCP connections. For communication between processes on the same machine, Unix domain sockets and named pipes eliminate network stack overhead and provide lower latency than TCP loopback.

### Unix Domain Sockets

Unix domain sockets work on Linux, macOS, and Windows (from Windows 10 onward). They are well-suited for sidecar patterns where a gRPC service runs alongside the main application process and communicates over a local socket file.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenUnixSocket("/tmp/orders.sock", listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
});
```

### Named Pipes

Named pipes are a Windows-native IPC mechanism with built-in support for Windows access control lists. This makes them suitable for scenarios where you need fine-grained control over which Windows users or service accounts can connect to the gRPC endpoint.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenNamedPipe("orders-pipe", listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
});
```

### Choosing an IPC Transport

IPC transports make sense when both the client and server run on the same host and you want to avoid the overhead of TCP, TLS handshakes, and network serialization that comes with loopback connections. The performance difference is most noticeable in high-frequency, low-latency communication patterns like sidecar proxies or local service meshes. For services that might eventually run on separate hosts, starting with TCP keeps the deployment model flexible even if it costs a small amount of latency locally.
