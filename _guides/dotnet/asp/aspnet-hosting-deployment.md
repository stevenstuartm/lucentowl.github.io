---
title: "Hosting and Deployment"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Operations"
description: "Running an ASP.NET Core app in production: choosing between Kestrel, HTTP.sys, and IIS in-process or out-of-process hosting, Kestrel endpoints and limits, forwarded headers behind a proxy, container images, Native AOT, and draining cleanly on shutdown in Kubernetes."
tags: [practical, kestrel, iis, reverse-proxy, containers, native-aot, kubernetes]
---

An ASP.NET Core app is a console program that contains its own web server. Deploying it means deciding what sits between the network and that server, how the server is configured, what the app is packaged as, and how it stops when the platform replaces it. Each decision has defaults that work on a developer's machine and fail in specific, recognizable ways in production: a redirect loop behind a load balancer, a container that answers on the wrong port, or requests dropped on every deployment.

## Choosing a Server and Hosting Model

Every request reaches the app through an `IServer` implementation, which accepts connections and turns each request into an `HttpContext`. Three servers ship with ASP.NET Core, and IIS adds a fourth arrangement by proxying to one of them:

| Model | Server | Platform | Choose it when |
|---|---|---|---|
| **Kestrel** | Kestrel, inside the app's process | Windows, Linux, macOS | The default for everything else, including containers and apps behind a proxy or load balancer |
| **HTTP.sys** | The Windows kernel HTTP driver | Windows only | The app needs a feature only HTTP.sys has, such as port sharing between processes or kernel-mode response caching, without IIS |
| **IIS in-process** | IIS HTTP Server, inside the IIS worker process | Windows with IIS | The app is deployed to IIS, which is the default model there |
| **IIS out-of-process** | Kestrel, behind IIS | Windows with IIS | The app needs its own process under IIS, such as sharing an app pool or a single-file deployment |

{% include figure.html id="asp-hosting-topologies" %}

### Kestrel

Kestrel is a cross-platform server built on .NET's socket APIs. It runs inside the app's process, so the app and server start, fail, and stop together. It serves HTTP/1.1 and HTTP/2 on every endpoint by default. HTTP/2 over a plain-text connection needs care, because clients choose HTTP/2 during the TLS handshake, and a plain-text endpoint that also allows HTTP/1.1 falls back to HTTP/1.1. A gRPC service without TLS therefore needs an endpoint restricted to HTTP/2. HTTP/3 is off until an endpoint sets `HttpProtocols.Http1AndHttp2AndHttp3` over HTTPS, and it needs the MsQuic library on the host. Clients discover HTTP/3 through the `alt-svc` header Kestrel adds, so the first request always arrives over HTTP/1.1 or HTTP/2.

Kestrel can face the internet directly. It often sits behind a reverse proxy or load balancer anyway, because the proxy terminates TLS for many services, balances across instances, and lets the app listen only on a private network.

### HTTP.sys

HTTP.sys is the Windows kernel driver that IIS itself runs on, used directly as the app's server. It supports Windows authentication (Kerberos, NTLM, Negotiate), port sharing between several processes, kernel-mode response caching, direct file transmission, HTTP/2, and HTTP/3 on Windows 11 and Windows Server 2022. Microsoft's docs recommend it for Windows apps exposed to the internet without IIS, and for internal apps that need one of those features. Kestrel covers Windows authentication too, through the Negotiate handler, so authentication alone rarely decides the choice. HTTP.sys can't be combined with IIS or the ASP.NET Core Module.

### IIS: In-Process and Out-of-Process

On IIS, the ASP.NET Core Module (ANCM), installed by the .NET Hosting Bundle, connects IIS to the app. It hosts the app in one of two ways, set by `AspNetCoreHostingModel` in the project file.

**In-process** has been the default since ASP.NET Core 3.0. ANCM loads the .NET runtime into the IIS worker process (`w3wp.exe`), and IIS HTTP Server hands each request to the app in memory. Kestrel isn't used. With no hop over the loopback network, Microsoft reports significantly higher throughput than out-of-process. The costs are constraints on the deployment: one app per application pool, the app's bitness must match the pool's, and a single-file published app can't be loaded.

**Out-of-process** starts the app as its own `dotnet` process running Kestrel on a port ANCM chooses, and proxies each request to it over loopback. IIS integration then enables forwarded headers middleware automatically, restricted to that single local proxy, so the app sees the real client address and scheme without further configuration.

In both models IIS request filtering runs first, and its `maxAllowedContentLength` rejects oversized uploads before the app's own body size limit is consulted.

### As a Windows Service or systemd Unit

Outside containers and IIS, a Kestrel app on a server usually runs under the operating system's service manager. `builder.Services.AddWindowsService()` (from `Microsoft.Extensions.Hosting.WindowsServices`) lets the app run as a Windows Service, reporting its state to the Service Control Manager and using the app's own folder as the content root rather than the service's `system32` working directory. `builder.Services.AddSystemd()` (from `Microsoft.Extensions.Hosting.Systemd`) does the equivalent under systemd on Linux, typically behind Nginx or Apache. Both calls do nothing when the app isn't running under that service manager, so the same build still runs from a console. The service manager's own stop timeout then plays the role the grace period plays in Kubernetes, described under graceful shutdown below.

## Configuring Kestrel

Kestrel reads its endpoints and limits from configuration and from `builder.WebHost.ConfigureKestrel`. With no endpoint configured anywhere, it listens only on `http://localhost:5000`, which is unreachable from outside the machine or container. The official container images set `ASPNETCORE_HTTP_PORTS=8080`, so a containerized app listens on port 8080 on all interfaces unless told otherwise.

### Endpoints and Certificates

Endpoints in configuration can change per environment without a rebuild:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://*:8080"
      },
      "Https": {
        "Url": "https://*:8443",
        "Certificate": {
          "Path": "/certs/api.pfx",
          "Password": "set-from-a-secret-store"
        }
      }
    }
  }
}
```

The same endpoints in code look like this:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(8080);
    options.ListenAnyIP(8443, listen => listen.UseHttps("/certs/api.pfx", certPassword));
});
```

Code-defined endpoints and the `Kestrel:Endpoints` section both take priority over `ASPNETCORE_URLS` and the `urls` setting. An HTTPS endpoint without a certificate of its own uses `Certificates:Default` or, in development, the SDK's development certificate. The development certificate doesn't exist on a production host, so an HTTPS endpoint there needs a certificate from configuration or code. Apps behind a TLS-terminating proxy often skip HTTPS in Kestrel entirely and listen on plain HTTP on a private network. `CreateSlimBuilder` leaves Kestrel's HTTPS support out altogether, and it comes back with `builder.WebHost.UseKestrelHttpsConfiguration()`.

### Limits

Kestrel's limits protect the process from clients that send too much or too slowly. The defaults suit most APIs:

| Limit | Default | What it stops |
|---|---|---|
| `MaxRequestBodySize` | 30,000,000 bytes (about 28.6 MB) | Oversized uploads |
| `RequestHeadersTimeout` | 30 seconds | Clients that open a connection and send headers slowly (slowloris) |
| `MinRequestBodyDataRate` | 240 bytes per second after a 5-second grace period | Clients that trickle a request body |
| `KeepAliveTimeout` | 130 seconds | Idle connections held open indefinitely |
| `MaxRequestHeadersTotalSize` | 32 KB | Oversized headers |
| `MaxConcurrentConnections` | Unlimited | Connection floods, when set |
| `Http2.MaxStreamsPerConnection` | 100 | One HTTP/2 connection monopolizing the server |

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxConcurrentConnections = 10_000;
    // Above the load balancer's 5-minute idle timeout (see below).
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(6);
});
```

The body size limit is usually better raised per endpoint than globally, with `[RequestSizeLimit]` or the `IHttpMaxRequestBodySizeFeature`, so that only the upload endpoint accepts large bodies. The keep-alive timeout matters behind a load balancer. If the balancer keeps idle connections open longer than Kestrel does, Kestrel closes connections the balancer still considers usable, and the next request sent on one of them fails. The 130-second default already exceeds many balancers' idle timeouts, so the problem tends to appear when someone raises the balancer's timeout, for long polling or slow clients, without raising Kestrel's to stay above it. The timeouts and data rates aren't enforced while a debugger is attached, so a slow-client problem can't be reproduced under one.

## Behind a Reverse Proxy

A proxy or load balancer ends the client's connection and opens its own to the app. From the app's side, every request now comes from the proxy's address, over the proxy's scheme, often plain HTTP, and possibly with a different host and path. The proxy passes the originals along in headers:

| Header | Carries | Restores |
|---|---|---|
| `X-Forwarded-For` | The client's address, plus any earlier proxies | `HttpContext.Connection.RemoteIpAddress` |
| `X-Forwarded-Proto` | The original scheme | `HttpContext.Request.Scheme` |
| `X-Forwarded-Host` | The original `Host` header | `HttpContext.Request.Host` |
| `X-Forwarded-Prefix` | A path prefix the proxy removed | `HttpContext.Request.PathBase` |

Until something reads those headers, the app gets the proxy's view. HTTPS redirection sees every request as HTTP and redirects forever, OpenID Connect sends `http://` redirect URIs that the identity provider rejects, and rate limiting and audit logs record every request as coming from the proxy.

### Forwarded Headers Middleware

`UseForwardedHeaders` applies the headers to the request, but only from proxies it trusts:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("10.0.0.0/8"));
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseHsts();
app.UseHttpsRedirection();
```

The defaults are strict, and they explain most "the headers are ignored" reports:

- **No headers are processed** until `ForwardedHeaders` names them. The default is `None`.
- **Only loopback proxies are trusted.** `KnownProxies` holds `::1` and `KnownIPNetworks` holds `127.0.0.0/8`. A proxy on another machine or in another container is ignored, and the middleware logs its address only at Debug level, so the log level for `Microsoft.AspNetCore.HttpOverrides` has to be lowered to see why. Add the proxy's address or network. In .NET 10, `KnownIPNetworks` (using `System.Net.IPNetwork`) replaces the now-obsolete `KnownNetworks`.
- **Only the rightmost value is used.** `ForwardLimit` is 1, so behind two proxies it takes the address the nearest proxy recorded, which is the outer proxy rather than the client. Raise it only together with trusted proxies or networks.

Consider a client behind two proxies:

```text
client 203.0.113.7  ->  outer proxy 10.0.1.5  ->  inner proxy 10.0.2.9  ->  app

The app sees:   RemoteIpAddress = 10.0.2.9
                X-Forwarded-For: 203.0.113.7, 10.0.1.5
```

The middleware reads the header from right to left, and it applies each entry only if the address it currently holds is trusted. With `ForwardLimit` at 1 and `10.0.0.0/8` trusted, it checks 10.0.2.9, applies 10.0.1.5, and stops, so the app records the outer proxy as the client. With `ForwardLimit` at 2, it then checks 10.0.1.5, which is also trusted, and applies 203.0.113.7.

The middleware must run before anything that reads the scheme, host, or client address, such as HSTS (the header telling browsers to use HTTPS only), HTTPS redirection, authentication, and rate limiting. Trusting `X-Forwarded-Host` also means setting `ForwardedHeadersOptions.AllowedHosts`, because an unrestricted forwarded host lets a client choose the host the app puts in the links it generates.

Setting the environment variable `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` turns the middleware on without code, processing `X-Forwarded-For` and `X-Forwarded-Proto`. It also clears both trusted lists, so the app accepts the headers from any sender. That suits a platform where the app can be reached only through the platform's own load balancer, and it lets any client that can reach the app directly forge its address and scheme. Microsoft's docs warn about it for that reason. Behind IIS out-of-process, none of this is needed, because IIS integration configures the middleware itself.

## Containers

Three of the official image repositories matter for a web app. `mcr.microsoft.com/dotnet/sdk` builds the app. `dotnet/aspnet` runs a framework-dependent app, one that relies on the .NET runtime already installed in the image. `dotnet/runtime-deps` holds only the operating system libraries .NET needs, for a self-contained app that carries its own runtime or a Native AOT app, which needs none. Since .NET 10 the default tags are Ubuntu 24.04 based, and Debian variants are no longer published. Other variants are selected by tag suffix. Alpine is smaller. The `chiseled` images strip out the shell and package manager and are set up to run as a non-root user, which shrinks both the image and what an attacker can do inside it. Like Alpine, they leave out the ICU globalization and time zone data, so an app on them has to run in invariant globalization mode or use an `-extra` variant.

Every image since .NET 8 includes a non-root `app` user, whose ID is in the `APP_UID` environment variable. The move to port 8080 described earlier came with it, because a non-root process can't bind ports below 1024 in some environments.

### A Multi-Stage Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Orders.Api/Orders.Api.csproj", "Orders.Api/"]
RUN dotnet restore "Orders.Api/Orders.Api.csproj"
COPY . .
RUN dotnet publish "Orders.Api/Orders.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "Orders.Api.dll"]
```

The build stage has the SDK and the runtime stage doesn't, so the final image carries only the published output. Copying the project file and restoring before copying the source lets Docker reuse the restore layer when only code changes. `USER $APP_UID` runs the app as the non-root user. Configuration then arrives through environment variables, where `__` separates sections, so `ConnectionStrings__Orders` sets `ConnectionStrings:Orders`.

One piece of state commonly breaks here. ASP.NET Core's Data Protection keys, which encrypt authentication cookies and antiforgery tokens, are stored on the local file system by default. In a container they vanish on every restart and differ between replicas, so users are signed out on each deployment and a cookie issued by one replica fails on another. The keys need persistent storage shared by all instances, such as a mounted volume, a database, or blob storage.

### Publishing Without a Dockerfile

The .NET SDK can build the image itself, with no Dockerfile:

```bash
dotnet publish --os linux --arch x64 /t:PublishContainer
```

By default the image is loaded into the local Docker or Podman, so one of them has to be running. Setting `ContainerRegistry` pushes it straight to a registry instead, and `ContainerArchiveOutputPath` writes it to a tarball, and neither needs a local container runtime. The SDK picks the base image from the project: `aspnet` for a web app, and `runtime-deps` for a self-contained or AOT app. For .NET 8 and later images it runs the app as the non-root `app` user, and it infers the exposed port from `ASPNETCORE_HTTP_PORTS`. MSBuild properties such as `ContainerFamily` (for example `noble-chiseled`), `ContainerRepository`, and `ContainerRegistry` choose the variant, the image name, and where to push. The SDK can't run commands inside the image, so an image that needs extra OS packages still needs a Dockerfile or a custom base image.

## Native AOT

Native AOT compiles the app to machine code at publish time. The result is a single executable that needs no .NET runtime, starts faster, and uses less memory, which matters most when many instances start and stop often, such as containers that scale with load. The price is that nothing can be generated or discovered at run time. Reflection over arbitrary types, `System.Reflection.Emit`, and loading assemblies dynamically don't work, and publishing trims every piece of code the compiler can't see being used.

That rules out parts of ASP.NET Core:

| Support | Features |
|---|---|
| **Supported** | gRPC, CORS, health checks, HTTP logging, JWT bearer authentication, localization, output caching, rate limiting, request decompression, response caching and compression, URL rewriting, static files, WebSockets |
| **Partial** | Minimal APIs, SignalR |
| **Not supported** | MVC controllers, Blazor Server, OData, authentication handlers other than JWT bearer, session, SPA middleware |

The `webapiaot` template shows the working shape. It uses minimal APIs, the smaller `WebApplication.CreateSlimBuilder`, and a source-generated JSON context, because `System.Text.Json` would otherwise fall back to reflection:

```csharp
var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

var app = builder.Build();
app.MapGet("/orders/{id}", (int id) => new Order(id, "Pending"));
app.Run();

public record Order(int Id, string Status);

[JsonSerializable(typeof(Order))]
internal partial class AppJsonContext : JsonSerializerContext;
```

`<PublishAot>true</PublishAot>` in the project file enables the compiler at publish and the AOT analyzers during every build. The app still runs with the JIT during development, so an incompatibility shows up as a warning in the build and only as a failure in the published app. Treat those warnings as errors. Microsoft's docs say that an app publishing with no AOT warnings can be expected to behave like its JIT-compiled version. Publishing needs the platform's native toolchain, which is Visual Studio's C++ workload on Windows and clang on Linux, and the executable targets one runtime identifier, such as `linux-x64`. Building in a container is the usual way to produce a Linux binary from any machine, using the SDK images tagged `-aot`, which add the native toolchain the regular SDK images lack, or installing clang in the build stage.

AOT has costs beyond the feature list. Publishing takes noticeably longer, and each binary runs on only the one runtime identifier it was built for. Without a JIT, the app also loses the run-time optimizations, such as dynamic profile-guided optimization, that let a long-running JIT-compiled app speed up as it runs, so peak throughput can be lower. AOT pays off when instances start often or memory is tight, and less for a few long-lived instances.

Trimming and self-contained deployment are also available without AOT. They shrink a self-contained app and remove the need for an installed runtime, while keeping the JIT and reflection.

## Graceful Shutdown

When the platform stops an instance, it sends SIGTERM, or the Windows equivalent. The host raises `ApplicationStopping`, and Kestrel stops accepting connections and lets in-flight requests finish. Hosted services then stop in reverse registration order, and the whole sequence has `HostOptions.ShutdownTimeout`, 30 seconds by default, before remaining work is abandoned. The timeout is set on the builder:

```csharp
builder.Services.Configure<HostOptions>(options =>
    options.ShutdownTimeout = TimeSpan.FromSeconds(45));
```

### Shutting Down in Kubernetes

Kubernetes stops a pod along two paths at once. The kubelet runs the container's `preStop` hook and then sends SIGTERM. Meanwhile, the control plane removes the pod from the Service's endpoints, and every node's proxy and any external load balancer have to catch up. Those updates take time, so a pod can receive new requests for a few seconds after SIGTERM. If the app has already stopped accepting connections, those requests fail.

A short `preStop` sleep closes that gap by keeping the app serving normally until routing has moved on:

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
    - name: orders-api
      lifecycle:
        preStop:
          sleep:
            seconds: 10
```

The `sleep` hook action has been on by default since Kubernetes 1.30 and stable since 1.34. On older clusters, an `exec` hook running `sleep` does the same, except in chiseled images, which have no `sleep` binary to run.

{% include figure.html id="asp-k8s-pod-shutdown" %}

The timings have to fit inside one budget. The grace period starts before the `preStop` hook runs, and when it expires the kubelet kills the container. The default grace period of 30 seconds equals the default `ShutdownTimeout`, so any `preStop` delay leaves the app less time to drain than it expects. In the manifest above, 10 seconds of sleep plus the 45-second `ShutdownTimeout` set earlier fits inside 60 seconds with a margin.

Requests that take longer than the timeout are cut off regardless. Work that can't finish in that window, such as a long import or a report, belongs in a queue that a worker picks up and can resume, rather than in the request.

## Key Takeaways

- Kestrel is the default server everywhere. HTTP.sys is for Windows features Kestrel lacks, and IIS in-process is the fastest arrangement on IIS, at the cost of one app per pool.
- Kestrel listens on `localhost:5000` when nothing is configured, and the container images move it to port 8080 on all interfaces.
- The development certificate doesn't exist in production. HTTPS in Kestrel needs a real certificate, or TLS terminates at the proxy.
- Behind a proxy, forwarded headers are ignored until the middleware names them and trusts the proxy's address. The environment-variable shortcut trusts every sender.
- The .NET 10 images are Ubuntu based, listen on 8080, and include a non-root `app` user. Chiseled variants have no shell.
- Native AOT trades run-time flexibility for startup time and memory. MVC and most authentication handlers are out, and AOT warnings in the build are the only early warning.
- In Kubernetes, the grace period must cover the `preStop` sleep and the app's `ShutdownTimeout`, or the drain is cut short.
