---
title: "Hosting, Deployment, and Operational Patterns"
layout: guide
category: "ASP.NET Core"
subcategory: "Performance & Operations"
description: "Covers hosting models, server configuration, containerization strategies, Native AOT deployment, and operational patterns for production ASP.NET Core applications."
tags: [asp-net-core, hosting, deployment, docker, native-aot, kestrel, reverse-proxy, performance]
---

## Hosting and Deployment Fundamentals

ASP.NET Core applications can run in multiple hosting configurations depending on the platform, performance requirements, and operational constraints. The runtime environment determines which web server handles requests, how the application is deployed, and what operational patterns are available for managing traffic, configuration, and lifecycle events.

The choices you make about hosting models, server configuration, and deployment formats directly affect startup time, memory footprint, request throughput, and the ability to gracefully handle traffic shifts and configuration changes. These decisions are not one-size-fits-all. They depend on whether you're optimizing for Windows integration, Linux containerization, edge performance, or operational simplicity.

## Web Servers in ASP.NET Core

ASP.NET Core includes two primary web server implementations: Kestrel and HTTP.sys. Each serves different scenarios and provides distinct capabilities.

### Kestrel

Kestrel is a cross-platform web server built on libuv, designed for performance and flexibility. It runs on Windows, Linux, and macOS and serves as the default web server for ASP.NET Core applications. Kestrel provides excellent throughput and low memory overhead, making it suitable for containerized environments and cloud deployments.

Kestrel can run as an edge server directly exposed to the internet or behind a reverse proxy like Nginx, Apache, or IIS. When used behind a reverse proxy, Kestrel handles application logic while the proxy manages SSL termination, static file serving, load balancing, and additional security layers. When used as an edge server without a reverse proxy, Kestrel handles all HTTP responsibilities directly but requires careful configuration for HTTPS certificates, request limits, and timeouts.

Kestrel supports HTTP/1.1, HTTP/2, and HTTP/3. HTTP/2 is enabled by default starting with .NET Core 3.0 and supports features needed for gRPC, including response trailers and reset frames. HTTP/3 uses QUIC instead of TCP, offering improved performance on mobile and lossy networks with lower latency and better connection resilience. Since not all network infrastructure supports HTTP/3, production configurations typically enable HTTP/1.1, HTTP/2, and HTTP/3 together, allowing clients to negotiate the best available protocol.

### HTTP.sys

HTTP.sys is a Windows-only web server built on the HTTP.sys kernel driver and HTTP Server API. It provides mature, kernel-mode handling of HTTP requests with features unavailable in Kestrel, including port sharing, kernel-mode Windows authentication, fast proxying via queue transfers, direct file transmission, and response caching.

HTTP.sys operates as a shared kernel component, making it suitable for scenarios requiring advanced Windows integration or security features tied to the operating system. However, it lacks the cross-platform flexibility of Kestrel and typically shows lower performance compared to Kestrel in high-throughput scenarios.

When choosing between Kestrel and HTTP.sys, prefer Kestrel unless the application specifically requires Windows-only features like kernel-mode authentication or port sharing. HTTP.sys makes sense for Windows Server deployments where native Windows security integration is mandatory.

### When to Use a Reverse Proxy

Using a reverse proxy with Kestrel provides several operational advantages. The reverse proxy handles SSL certificate management, static file serving with efficient caching, request filtering and rate limiting, load balancing across multiple application instances, and unified logging and monitoring across services.

Running Kestrel behind a reverse proxy also isolates the application server from direct internet exposure, allowing the proxy to absorb malicious traffic before it reaches the application. The reverse proxy can enforce security headers, block known attack patterns, and provide DDoS mitigation.

In containerized environments, reverse proxies like Nginx or Traefik run as separate containers that route traffic to application containers, enabling independent scaling of the proxy layer and application layer. In cloud platforms, managed load balancers or API gateways serve the reverse proxy role while providing integration with cloud-native security, monitoring, and routing features.

## Kestrel Configuration

Kestrel exposes configuration options for endpoints, HTTPS certificates, connection limits, timeouts, and protocol settings. Understanding these options allows you to tune Kestrel for specific workloads and deployment scenarios.

### Endpoint Configuration

Kestrel listens on one or more endpoints, each defined by a protocol, address, and port. New projects are configured to bind to a random HTTP port between 5000 and 5300 and a random HTTPS port between 7000 and 7300 during development. Production configurations specify explicit ports based on deployment requirements.

Endpoints can be configured in code or through configuration files. Configuring in code provides compile-time safety and strong typing, while configuration files allow changing endpoints without recompiling. Both approaches support binding to specific IP addresses, enabling IPv4 or IPv6, and specifying different endpoints for different protocols.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5000); // HTTP on any IP
    options.ListenAnyIP(5001, listenOptions =>
    {
        listenOptions.UseHttps(); // HTTPS with default cert
    });
});
```

When running behind a reverse proxy, Kestrel typically listens on localhost or a private network interface rather than exposing ports directly to the internet. The reverse proxy forwards traffic to Kestrel on these internal endpoints.

### HTTPS Configuration

HTTPS in Kestrel requires a certificate for each HTTPS endpoint. Certificates can be loaded from a file, certificate store, or generated dynamically. Development environments use a self-signed development certificate, while production environments load certificates from secure storage or certificate authorities.

```csharp
options.ListenAnyIP(5001, listenOptions =>
{
    listenOptions.UseHttps(httpsOptions =>
    {
        httpsOptions.ServerCertificate = LoadCertificate();
    });
});
```

Production configurations often delegate HTTPS to the reverse proxy, allowing Kestrel to serve HTTP traffic on internal endpoints while the proxy terminates SSL and forwards decrypted traffic. This approach centralizes certificate management at the proxy layer and reduces the configuration surface area for the application.

### Request Limits and Timeouts

Kestrel enforces limits on request size, header size, connection counts, and timeouts to protect against resource exhaustion and slowloris attacks. Default limits are conservative but may require tuning for applications handling large uploads, high concurrency, or slow clients.

The maximum request body size defaults to 30 MB but can be increased for endpoints accepting large file uploads. Request header timeout defaults to 30 seconds, giving clients time to send headers over slow connections. Minimum data rate defaults to 240 bytes per second with a 5-second grace period, disconnecting clients that send data too slowly.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100 MB
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(60);
    options.Limits.MinRequestBodyDataRate = new MinDataRate(
        bytesPerSecond: 100,
        gracePeriod: TimeSpan.FromSeconds(10));
});
```

Connection limits control how many concurrent connections Kestrel accepts. The default is unlimited, but production deployments often set explicit limits to prevent a single application instance from exhausting system resources under load spikes.

## IIS Hosting Models

When hosting ASP.NET Core applications on Windows with IIS, two hosting models are available: in-process and out-of-process. The hosting model determines whether the application runs inside the IIS worker process or in a separate process.

### In-Process Hosting

In-process hosting runs the ASP.NET Core application in the same process as the IIS worker process. Instead of using Kestrel, the application uses IIS HTTP Server, a native IIS module that handles HTTP requests directly within the worker process. This eliminates the overhead of proxying requests between IIS and Kestrel, reducing latency and improving throughput.

In-process hosting provides the best performance on Windows because requests flow from the HTTP.sys kernel driver directly to the IIS worker process and then to application code without crossing process boundaries. The application benefits from IIS features like application pool isolation, process recycling, and integrated Windows authentication without configuration overhead.

Since ASP.NET Core 3.0, in-process hosting has been the default for applications deployed to IIS. Applications explicitly configure in-process hosting by setting the hosting model in the project file.

```xml
<PropertyGroup>
  <AspNetCoreHostingModel>InProcess</AspNetCoreHostingModel>
</PropertyGroup>
```

### Out-of-Process Hosting

Out-of-process hosting runs the ASP.NET Core application as a separate process, using Kestrel as the web server. IIS acts as a reverse proxy, receiving requests from the HTTP.sys kernel driver and forwarding them to Kestrel on a random port. The application runs independently of IIS, allowing it to restart without affecting the IIS worker process.

Out-of-process hosting provides better isolation between IIS and the application. If the application crashes, IIS can restart it without recycling the worker process. The application can also use cross-platform features and configurations identical to those used when running on Linux, making the deployment more portable.

```xml
<PropertyGroup>
  <AspNetCoreHostingModel>OutOfProcess</AspNetCoreHostingModel>
</PropertyGroup>
```

Choosing between in-process and out-of-process hosting depends on performance requirements and operational constraints. In-process hosting delivers better performance and tighter Windows integration, while out-of-process hosting provides better isolation and cross-platform consistency.

## Reverse Proxy Configuration

Reverse proxies sit between clients and ASP.NET Core applications, forwarding requests while providing additional functionality like SSL termination, load balancing, and request filtering. Common reverse proxies include Nginx, Apache, IIS (in out-of-process mode), and cloud-native load balancers.

### Forwarded Headers

When running behind a reverse proxy, the application receives forwarded requests rather than direct client requests. The reverse proxy includes headers indicating the original client IP address, protocol, and host, which the application must interpret to reconstruct the original request context.

ASP.NET Core provides Forwarded Headers Middleware to read these headers and populate HttpContext with the correct values. Without this middleware, the application sees the proxy's IP address instead of the client's IP address and may generate incorrect URLs when redirecting or constructing absolute URIs.

```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```

When using IIS, Forwarded Headers Middleware is automatically configured. For Nginx, Apache, or cloud load balancers, the application must explicitly enable the middleware by setting the `ASPNETCORE_FORWARDEDHEADERS_ENABLED` environment variable to true or configuring it in code.

The middleware must run early in the pipeline, before any middleware that relies on the original client IP address or protocol, such as HTTPS redirection or authentication middleware.

### Nginx Configuration

Nginx is a popular reverse proxy for ASP.NET Core applications on Linux. It handles SSL termination, serves static files, and forwards dynamic requests to Kestrel. A typical Nginx configuration specifies the upstream Kestrel server, proxy headers, and SSL settings.

Nginx forwards the original client IP address using the `X-Forwarded-For` header and the original protocol using the `X-Forwarded-Proto` header. The application reads these headers through Forwarded Headers Middleware to reconstruct the original request context.

Nginx also handles client connection timeouts, buffering, and load balancing across multiple application instances. When multiple Kestrel instances run behind Nginx, the upstream block defines the pool of application servers, and Nginx distributes requests among them.

### Apache Configuration

Apache can also serve as a reverse proxy using `mod_proxy` and `mod_proxy_http` modules. Apache forwards requests to Kestrel while handling SSL, static files, and URL rewriting. The configuration specifies proxy targets, forwarded headers, and SSL certificates.

Apache provides similar forwarding capabilities to Nginx but with different configuration syntax and performance characteristics. Apache's process-based or threaded model may show different resource usage patterns compared to Nginx's event-driven architecture, but both are capable of handling production traffic efficiently.

### Load Balancer Considerations

Cloud load balancers and API gateways provide managed reverse proxy functionality with built-in health checks, auto-scaling integration, and observability. These services forward the original client information using standard headers that Forwarded Headers Middleware interprets automatically.

Load balancers often terminate SSL at the edge, forwarding unencrypted traffic to application instances on private networks. This requires configuring the application to trust the forwarded protocol header and avoid forcing HTTPS when already behind SSL termination.

## Docker Containerization

Containerizing ASP.NET Core applications with Docker provides consistent deployment artifacts, simplified dependency management, and portable runtime environments. Multi-stage Dockerfiles optimize image size by separating build and runtime environments.

### Multi-Stage Dockerfiles

A multi-stage Dockerfile uses separate stages for building and running the application. The build stage uses the .NET SDK image to restore dependencies, compile code, and publish the application. The runtime stage uses the smaller ASP.NET runtime image and copies the published output from the build stage.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MyApi/MyApi.csproj", "MyApi/"]
RUN dotnet restore "MyApi/MyApi.csproj"
COPY . .
WORKDIR "/src/MyApi"
RUN dotnet publish "MyApi.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MyApi.dll"]
```

The runtime image contains only the ASP.NET runtime, shared libraries, and published application files. It excludes the SDK, build tools, and intermediate build artifacts, reducing the final image size and attack surface.

Multi-stage builds optimize layer caching. Copying the project file and running restore before copying source code allows Docker to cache restored dependencies, speeding up subsequent builds when only application code changes.

### Container Configuration

Containerized applications typically load configuration from environment variables rather than configuration files. Environment variables provide a consistent configuration mechanism across different orchestration platforms like Kubernetes, Docker Compose, and cloud container services.

ASP.NET Core configuration automatically binds environment variables using a double underscore separator to represent nested configuration sections. For example, the environment variable `ConnectionStrings__DefaultConnection` maps to the configuration key `ConnectionStrings:DefaultConnection`.

Health check endpoints help orchestration platforms determine when containers are ready to receive traffic and when they need replacement. ASP.NET Core provides built-in health check middleware that responds to health probe requests with status information.

```csharp
builder.Services.AddHealthChecks();
app.MapHealthChecks("/health");
```

Container orchestrators like Kubernetes use liveness and readiness probes to monitor container health. Liveness probes determine if the container should restart, while readiness probes determine if the container should receive traffic. Applications can implement separate health check endpoints for each probe type with different logic and dependencies.

### Image Optimization

.NET 8 introduced composite runtime images that combine multiple runtime components into a single layer, improving startup performance and reducing disk footprint. These optimized images are available as variants of the standard runtime images.

Minimizing layer count and optimizing layer order improve pull times and storage efficiency. Frequently changing layers should appear late in the Dockerfile, while stable dependencies should appear early to maximize cache reuse across builds.

Non-root user configuration improves container security by running the application process without elevated privileges. The runtime image includes a non-root user that applications can switch to before starting.

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
USER app
ENTRYPOINT ["dotnet", "MyApi.dll"]
```

## Native AOT Deployment

Native Ahead-of-Time compilation produces applications that compile directly to native machine code rather than intermediate language. Native AOT eliminates the JIT compiler, reducing startup time and memory footprint but imposing constraints on runtime behavior.

### Benefits and Constraints

Native AOT applications start faster because they skip JIT compilation during startup. They consume less memory because the runtime does not need to store IL code or JIT-compiled code. The published output is a self-contained native executable, simplifying deployment by eliminating the need to install the .NET runtime.

However, Native AOT imposes strict constraints. Applications cannot use unbounded reflection because the compiler cannot predict which types might be accessed reflectively at runtime. Features relying on dynamic code generation, like certain serialization libraries or dynamic proxies, are incompatible with Native AOT.

ASP.NET Core uses source generators to produce code that avoids reflection. The Request Delegate Generator creates RequestDelegate instances for Minimal API endpoints at compile time rather than using reflection to discover route handlers at runtime. This makes Minimal APIs compatible with Native AOT while MVC remains incompatible due to its reliance on runtime reflection.

### Compatible Features

Native AOT supports Minimal APIs, gRPC services, and worker services. Applications must use Minimal APIs exclusively and avoid features that depend on runtime code generation. Dependency injection works with Native AOT when registering services explicitly at compile time.

Configuration, logging, and middleware pipelines work with Native AOT because they use compile-time-known types and do not rely on reflection. JSON serialization works using System.Text.Json source generators that produce serialization code at compile time.

Applications must mark trimming-safe and AOT-compatible entry points to guide the compiler. Attributes on the Program class or endpoint handlers indicate which code paths the compiler should preserve.

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
var app = builder.Build();

app.MapGet("/hello", () => "Hello, Native AOT!");

app.Run();
```

The CreateSlimBuilder method configures a minimal set of services optimized for Native AOT, excluding features that rely on reflection or dynamic code generation.

### Publishing for Native AOT

Publishing a Native AOT application requires enabling AOT compilation in the project file and targeting a specific runtime identifier. The compiler produces a platform-specific native executable rather than portable IL assemblies.

```xml
<PropertyGroup>
  <PublishAot>true</PublishAot>
  <InvariantGlobalization>true</InvariantGlobalization>
</PropertyGroup>
```

Invariant globalization disables culture-specific behavior, reducing binary size by excluding culture data. Applications requiring localization cannot enable invariant globalization.

The published output includes a single native executable and any necessary native dependencies. The executable does not require the .NET runtime, making deployment straightforward for environments where installing runtimes is difficult or restricted.

## Trimming and Self-Contained Deployment

Trimming removes unused code from the published application, reducing deployment size. Self-contained deployment bundles the .NET runtime with the application, eliminating runtime installation as a deployment prerequisite.

### How Trimming Works

The trimmer analyzes the application's code paths starting from entry points, identifying which types and methods are reachable. Unreachable code is removed from the published output. Trimming works best with applications that use static dependencies and avoid reflection.

Reflection complicates trimming because the trimmer cannot statically determine which types might be accessed reflectively. Libraries that rely heavily on reflection may not trim correctly, leading to runtime errors when trimmed code attempts to access removed types.

ASP.NET Core libraries are annotated with trimming attributes that guide the trimmer, indicating which APIs are safe to trim and which require preserving dynamic dependencies. Applications can add similar annotations to custom code to improve trimming effectiveness.

```xml
<PropertyGroup>
  <PublishTrimmed>true</PublishTrimmed>
</PropertyGroup>
```

Trimming integrates with Native AOT but can also be used independently with JIT-compiled applications to reduce deployment size without requiring AOT compilation.

### Self-Contained Deployment

Self-contained deployments include the .NET runtime alongside the application, producing a deployment package that runs without requiring a pre-installed runtime. This simplifies deployment to environments with restricted access or strict version requirements.

The trade-off is larger deployment size because each application includes a full runtime copy. Framework-dependent deployments share a single runtime across multiple applications, reducing disk usage but requiring runtime installation and version management.

Self-contained deployments ensure consistent runtime behavior across environments because the application always uses the bundled runtime version. Framework-dependent deployments may encounter runtime version mismatches if the environment installs a different runtime version.

```xml
<PropertyGroup>
  <SelfContained>true</SelfContained>
  <RuntimeIdentifier>linux-x64</RuntimeIdentifier>
</PropertyGroup>
```

Combining self-contained deployment with trimming produces a smaller self-contained package by removing unused runtime components.

## Environment-Specific Configuration

ASP.NET Core supports environment-specific configuration files and behavior based on the ASPNETCORE_ENVIRONMENT variable. Environments typically include Development, Staging, and Production, though applications can define custom environments.

### Configuration Files

Configuration loads from a hierarchy of sources, including appsettings.json, environment-specific files like appsettings.Production.json, environment variables, and command-line arguments. Later sources override earlier sources, allowing environment-specific overrides.

```json
// appsettings.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}

// appsettings.Production.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning"
    }
  }
}
```

Environment variables provide the highest precedence, making them suitable for secrets and deployment-specific configuration. Containerized applications typically receive all configuration through environment variables, avoiding the need to build environment-specific images.

### Environment-Specific Behavior

Application code can conditionally enable features based on the environment. Development environments might enable detailed error pages and swagger documentation, while production environments disable these features to avoid leaking sensitive information.

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

The environment name is case-insensitive but conventionally capitalized. Custom environments like Staging or UAT allow separate configuration for pre-production environments that differ from both development and production.

## Graceful Shutdown and Drain Patterns

Graceful shutdown allows applications to complete in-flight requests before terminating, preventing abrupt disconnections and data loss. ASP.NET Core provides built-in support for handling shutdown signals and coordinating shutdown behavior.

### Shutdown Process

When the host receives a shutdown signal like SIGTERM, it notifies the application by triggering the ApplicationStopping event. The host then calls StopAsync on the web server, instructing it to stop accepting new connections and complete existing requests within the shutdown timeout.

Kestrel closes listening sockets and stops accepting new connections immediately. Existing connections continue processing requests until completion or timeout. The default shutdown timeout is 30 seconds, giving requests time to finish before forcibly terminating the process.

```csharp
builder.Host.ConfigureHostOptions(options =>
{
    options.ShutdownTimeout = TimeSpan.FromSeconds(30);
});
```

Hosted services and background tasks receive cancellation tokens that signal when shutdown begins. Long-running background work should monitor these tokens and exit gracefully when cancellation is requested.

### Traffic Draining

When deploying new versions behind a load balancer, draining traffic from old instances prevents dropped connections. The deployment process brings up new instances, waits for health checks to pass, updates the load balancer to route traffic to new instances, removes old instances from the load balancer, signals old instances to shut down, and waits for them to drain or timeout.

This pattern ensures clients experience no disruption during deployments. New connections go to new instances while old instances finish serving existing connections. The load balancer health check determines when new instances are ready, preventing traffic from reaching instances still initializing.

Kubernetes and similar orchestrators implement this pattern through readiness probes, termination grace periods, and pod lifecycle hooks. The orchestrator stops sending traffic when the pod enters the terminating state, allowing the application to drain existing requests before the container terminates.

### Handling Long-Running Requests

Requests that exceed the shutdown timeout are forcibly terminated. Applications processing long-running operations should persist state incrementally and design for resumability. If a request is interrupted, the client or another process should be able to resume the operation from the last persisted checkpoint.

Background jobs and asynchronous tasks should coordinate with the shutdown process by checking cancellation tokens and persisting intermediate progress. Shutdown timeout should be tuned based on the expected maximum request duration, balancing graceful shutdown against deployment speed.

## Operational Best Practices

Production deployments require careful attention to configuration, monitoring, and operational patterns that affect reliability and maintainability.

### Health Checks and Readiness

Health checks provide a mechanism for orchestration platforms and load balancers to determine application health. Applications should implement health checks that verify critical dependencies like database connectivity, message queue availability, and external API reachability.

Separate liveness and readiness checks allow orchestrators to distinguish between containers that should restart and containers that need more time to initialize. Liveness checks verify the application process is running and responsive, while readiness checks verify the application is ready to handle traffic.

Health checks should execute quickly and avoid expensive operations. Repeatedly checking database connectivity during high traffic can overload the database or introduce latency. Health check results can be cached for short periods to reduce overhead.

### Logging and Diagnostics

Structured logging provides consistent log output that monitoring systems can parse and query. ASP.NET Core integrates with logging frameworks like Serilog and NLog that support structured output formats.

Logging configuration should vary by environment, using detailed logging in development and structured, aggregated logging in production. Production logs should avoid including sensitive information like passwords or personal data.

Distributed tracing provides visibility into request flows across services. ASP.NET Core supports OpenTelemetry and Application Insights for capturing trace data and correlating requests across service boundaries.

### Configuration Management

Secrets should never be stored in configuration files or source control. Use environment variables, secret management systems like Azure Key Vault or AWS Secrets Manager, or configuration services that inject secrets at runtime.

Configuration changes should not require redeployment when possible. Externalizing configuration into environment variables or configuration stores allows updating configuration without rebuilding or restarting applications. However, some configuration changes, particularly those affecting middleware pipelines or endpoint routing, may require restart.

Configuration validation at startup catches misconfigurations early before they cause runtime errors. Applications can validate required configuration values during host startup and fail fast if critical configuration is missing or invalid.

### Resource Limits and Quotas

Production deployments should enforce resource limits to prevent individual instances from consuming excessive CPU, memory, or network bandwidth. Container orchestrators like Kubernetes allow specifying resource requests and limits per container.

Request rate limiting protects applications from overload by rejecting excess requests. Rate limiting can operate at the reverse proxy layer, application layer, or both. Proxy-level rate limiting prevents overload before requests reach the application, while application-level rate limiting provides finer-grained control based on user identity or request characteristics.

Connection limits prevent resource exhaustion from connection storms. Kestrel enforces connection limits when configured, but reverse proxies and load balancers often provide more sophisticated connection management with per-client limits and adaptive throttling.

## Summary

Hosting and deployment decisions shape the operational characteristics of ASP.NET Core applications. Choosing between Kestrel and HTTP.sys depends on platform requirements and feature needs. Configuring Kestrel for endpoints, HTTPS, and limits tunes the server for specific workloads. Deciding between in-process and out-of-process IIS hosting balances performance against isolation.

Reverse proxy configuration determines how the application integrates with load balancers, SSL termination, and network infrastructure. Docker containerization provides consistent deployment artifacts, while multi-stage Dockerfiles optimize image size and build caching. Native AOT compilation delivers fast startup and low memory footprint but imposes strict constraints on runtime behavior.

Trimming and self-contained deployment reduce deployment size and eliminate runtime dependencies, while environment-specific configuration adapts behavior across development, staging, and production. Graceful shutdown and drain patterns prevent disruption during deployments and ensure in-flight requests complete successfully.

Operational patterns like health checks, structured logging, secret management, and resource limits provide the foundation for reliable production deployments that maintain performance and availability under real-world conditions.
