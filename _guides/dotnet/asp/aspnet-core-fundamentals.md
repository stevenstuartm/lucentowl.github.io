---
title: "ASP.NET Core Fundamentals"
layout: guide
category: "ASP.NET Core"
subcategory: "ASP.NET Fundamentals"
description: "Core concepts for ASP.NET Core web applications including host configuration, HTTP pipeline, servers, environments, and dependency injection in web contexts."
tags: [asp-net-core, web-hosting, middleware, kestrel, dependency-injection, configuration, background-services]
---

## The Foundation of ASP.NET Core Applications

ASP.NET Core applications begin with a host that manages configuration, dependency injection, logging, and the HTTP server. Modern applications consolidate this setup into Program.cs using WebApplication and WebApplicationBuilder, eliminating the separate Startup.cs file that existed in earlier versions. Understanding how these components work together provides the foundation for building robust web APIs and applications.

## WebApplication and WebApplicationBuilder

The WebApplication class represents the configured application and server, while WebApplicationBuilder configures services and settings before building the application. Together, they form the entry point for all ASP.NET Core applications.

### The Builder Pattern

WebApplicationBuilder follows the builder pattern to configure services and settings before the application starts. Calling WebApplication.CreateBuilder(args) initializes default configurations including logging, dependency injection containers, configuration providers, and the web server.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Configure services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Build the application
var app = builder.Build();
```

The builder exposes several properties for configuration, including Services, which provides access to the dependency injection container, Configuration, which accesses configuration providers, Environment, which exposes environment information like Development or Production, and Logging, which configures logging providers.

### Slim and Empty Builders

ASP.NET Core 8 introduced CreateSlimBuilder() for applications that need minimal overhead. This builder includes only essential services, omitting features like JSON configuration file support, User Secrets, and some logging providers. Use this when building small, performance-sensitive applications where you explicitly add only the features you need.

CreateEmptyBuilder() goes further by starting with an empty configuration. You must explicitly add every feature, including configuration providers and logging. This provides maximum control for specialized scenarios like embedding ASP.NET Core in larger applications.

### WebApplication as Both Builder Result and Pipeline

After calling builder.Build(), the WebApplication instance serves two roles. It implements IApplicationBuilder, allowing middleware configuration through Use methods. It also implements IHost, managing the application lifecycle through methods like Run() and Start().

```csharp
// Configure middleware pipeline
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// Start the application
app.Run();
```

The order of middleware registration defines the order of request processing. Requests flow through middleware in registration order, while responses flow back in reverse order.

## Kestrel: The Cross-Platform Web Server

Kestrel serves as the default, cross-platform web server for ASP.NET Core. Built for performance and efficiency, it handles HTTP requests directly and runs on Windows, Linux, and macOS.

### Kestrel Architecture

Kestrel uses a layered architecture with distinct responsibilities. The transport layer manages network connections and sockets, handling TCP listeners and connection establishment. The connection management layer sits above transport, managing connection lifecycles, pooling, keep-alive mechanisms, and protocol-specific handling. The middleware pipeline receives requests from connection management and processes them through your application's middleware stack.

This separation allows Kestrel to optimize for different workloads. The transport layer can be swapped for different implementations, including specialized transports for Unix domain sockets or named pipes. Connection management applies pooling and keep-alive strategies that reduce overhead for high-frequency requests.

### Performance Characteristics

Kestrel optimizes for throughput and concurrent connections. It uses asynchronous I/O throughout, minimizing thread pool usage. Connection pooling reduces allocation overhead. Keep-alive support reuses connections across multiple requests, avoiding TCP handshake costs.

These optimizations make Kestrel effective for microservices, containerized workloads, and resource-constrained environments. Running in containers with limited memory, Kestrel manages resources efficiently without sacrificing request throughput.

### Configuration Patterns

Kestrel configuration happens through KestrelServerOptions, accessible via builder.WebHost.ConfigureKestrel(). Common configuration includes URL bindings for HTTP and HTTPS endpoints, connection limits to prevent resource exhaustion under load, timeouts for keep-alive pings and request processing, and HTTPS certificate configuration for TLS termination.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxConcurrentConnections = 100;
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
});
```

### When Kestrel Is Sufficient

Kestrel works well as a standalone server for many scenarios. Internal microservices behind API gateways, containerized applications in orchestrated environments like Kubernetes, and applications behind cloud load balancers that handle SSL termination and traffic distribution all benefit from Kestrel's lightweight design.

You can expose Kestrel directly to the internet when paired with proper security hardening. However, production deployments typically place Kestrel behind a reverse proxy for additional features Kestrel intentionally omits.

## HTTP.sys: Windows-Only Alternative

HTTP.sys provides a Windows-specific web server option that differs from Kestrel in architecture and capabilities. It operates as a kernel-mode component within Windows, sharing infrastructure with IIS.

### Kernel-Mode Operation

Unlike Kestrel, which runs in user mode, HTTP.sys operates in kernel mode. This provides performance advantages for certain workloads by reducing context switches between kernel and user space. It also provides mature security features built into Windows, including kernel-mode Windows Authentication without user-mode code.

### When to Choose HTTP.sys

Use HTTP.sys when you need features unavailable in Kestrel and cannot use a reverse proxy to provide them. Windows Authentication without a reverse proxy, port sharing where multiple applications listen on the same port differentiated by host headers or paths, and direct internet exposure on Windows without a reverse proxy all favor HTTP.sys.

HTTP.sys requires Windows Server or Windows 10/11. It cannot run on Linux or macOS, limiting portability compared to Kestrel-based applications.

### Incompatibility with ASP.NET Core Module

HTTP.sys cannot work with the ASP.NET Core Module for IIS hosting. If deploying to IIS or IIS Express, you must use Kestrel. HTTP.sys serves as an alternative for standalone Windows deployments, not as an IIS hosting model.

## Reverse Proxy Patterns

Production deployments commonly place ASP.NET Core applications behind reverse proxies that provide features beyond basic HTTP handling. Reverse proxies offload concerns like SSL termination, static file serving, request caching, and load balancing from the application server.

### Common Reverse Proxy Options

IIS serves as a reverse proxy for ASP.NET Core on Windows through the ASP.NET Core Module. This module manages application lifecycle, forwards requests to Kestrel, and provides process management. Nginx provides a lightweight, high-performance reverse proxy commonly used on Linux for SSL termination, load balancing, and static file serving. Apache serves similar purposes with mod_proxy, offering mature configuration options and integration with existing Apache-based infrastructure.

Cloud load balancers like AWS Application Load Balancer, Azure Application Gateway, and Google Cloud Load Balancing provide reverse proxy capabilities at the infrastructure layer, handling SSL termination, health checks, and traffic distribution across multiple application instances.

### Forwarded Headers

When running behind a reverse proxy, the application sees requests originating from the proxy's IP address rather than the original client. The proxy forwards the original request information through headers like X-Forwarded-For, X-Forwarded-Proto, and X-Forwarded-Host.

ASP.NET Core provides Forwarded Headers Middleware to process these headers and update the request properties accordingly. Enable this middleware by setting the ASPNETCORE_FORWARDEDHEADERS_ENABLED environment variable to true, or configure it explicitly in code.

```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```

Without forwarded headers middleware, URL generation, redirects, and authentication schemes may fail because they generate URLs using the proxy's address rather than the original request address.

### Security Considerations

Configure forwarded headers middleware carefully to prevent spoofing. Limit the proxy IP addresses that the application trusts using KnownProxies or KnownNetworks properties. Without these restrictions, malicious clients can send forged forwarded headers that the application might trust, potentially bypassing IP-based security controls.

## HTTP Request Pipeline

Every HTTP request flows through a well-defined pipeline composed of middleware components. Understanding this pipeline clarifies how requests transform as they move toward endpoints and how responses transform as they return to clients.

### Middleware Execution Model

Middleware components form a nested stack similar to Russian dolls. Each middleware receives an HttpContext containing request and response information and decides whether to pass control to the next component or short-circuit the pipeline.

```csharp
app.Use(async (context, next) =>
{
    // Logic before next middleware
    await next();
    // Logic after next middleware
});
```

The order of middleware registration matters critically. Middleware executes in registration order for requests and reverse order for responses. Security middleware like authentication must execute before authorization, which must execute before endpoint routing and execution.

### Common Middleware Components

ExceptionHandler middleware catches unhandled exceptions and generates error responses. It should register first to catch exceptions from all subsequent middleware. HTTPS Redirection middleware redirects HTTP requests to HTTPS, protecting against protocol downgrade attacks. Static Files middleware serves files directly from disk, short-circuiting the pipeline for file requests.

Routing middleware matches incoming requests to endpoints based on URL patterns. Authentication middleware identifies the user based on credentials or tokens. Authorization middleware enforces access policies based on the authenticated user's roles or claims. CORS middleware handles cross-origin requests according to configured policies. Endpoint middleware executes the matched endpoint, whether that's a controller action, minimal API handler, or other endpoint type.

### Custom Middleware

You can create custom middleware as inline delegates using Use, as dedicated classes implementing middleware patterns, or as strongly-typed middleware registered with UseMiddleware.

```csharp
public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;

    public RequestTimingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        await _next(context);
        stopwatch.Stop();

        context.Response.Headers["X-Response-Time"] = stopwatch.ElapsedMilliseconds.ToString();
    }
}

app.UseMiddleware<RequestTimingMiddleware>();
```

Middleware classes receive RequestDelegate in their constructor and implement InvokeAsync or Invoke methods. They can accept additional dependencies through constructor injection, resolved from the dependency injection container.

### Pipeline Short-Circuiting

Middleware can short-circuit the pipeline by not calling the next delegate. Authentication middleware might return 401 Unauthorized without calling subsequent middleware. Static file middleware returns files directly without invoking routing or endpoint middleware. This pattern improves performance by avoiding unnecessary processing for requests that can complete early.

## Program.cs Patterns in Modern .NET

ASP.NET Core 6 and later consolidate host configuration into a single Program.cs file using top-level statements. This eliminates the separate Startup.cs file that earlier versions required.

### Consolidated Configuration

The modern pattern combines service registration, middleware configuration, and application startup in one file. This improves discoverability by keeping related configuration together and simplifies understanding of the application's startup sequence.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Service configuration
builder.Services.AddControllers();
builder.Services.AddDbContext<MyDbContext>();
builder.Services.AddScoped<IMyService, MyService>();

var app = builder.Build();

// Middleware pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

This pattern makes the application flow explicit. Services register first through the builder, then the application builds, then middleware configures the pipeline, and finally the application starts.

### Organizing Large Applications

As applications grow, keeping all configuration in Program.cs becomes unwieldy. Extract related configuration into extension methods that encapsulate related services or middleware.

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IPaymentService, PaymentService>();
        return services;
    }
}

builder.Services.AddApplicationServices();
```

This approach maintains the clarity of Program.cs while organizing related configuration into cohesive units. Each extension method handles a specific concern like database configuration, authentication setup, or API documentation.

### Migrating from Startup.cs

When migrating older applications that use Startup.cs, move ConfigureServices content to builder.Services calls before building the application, and move Configure content to middleware registration after building the application.

You can maintain the Startup class pattern by creating a separate class with methods that accept appropriate parameters, then calling those methods from Program.cs. This preserves organization without requiring the old hosting model.

## Environments: Development, Staging, Production

ASP.NET Core uses the ASPNETCORE_ENVIRONMENT environment variable to distinguish runtime environments. This affects configuration loading, error handling, and feature availability.

### Standard Environment Names

Three standard environment names carry special meaning. Development enables detailed error pages showing exception details and stack traces, development-specific database error pages, and features like hot reload. Staging provides a production-like environment for final testing with production configurations but potentially different data or scaled-down resources. Production optimizes for performance and security with minimal logging, strict error handling, and hardened security settings.

If ASPNETCORE_ENVIRONMENT is not set, the application defaults to Production. This ensures that deployed applications run with production hardening even if configuration is missing.

### Environment-Specific Configuration

Configuration files can target specific environments using naming conventions. The file appsettings.json contains base configuration that applies to all environments. Files like appsettings.Development.json or appsettings.Production.json override or supplement base configuration for specific environments. The configuration system loads base settings first, then overlays environment-specific settings, allowing environment values to override base values.

```json
// appsettings.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}

// appsettings.Development.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  }
}
```

### Conditional Middleware

Use environment checks to configure middleware differently per environment. Development environments might enable detailed exception pages while production environments use generic error handlers that avoid leaking implementation details.

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

Environment checks can also gate features like Swagger documentation, which often runs only in development and staging but not production.

## Configuration in ASP.NET Core

ASP.NET Core uses a layered configuration system that combines multiple sources with defined precedence. This allows environment-specific overrides while maintaining base configuration.

### Configuration Providers

The default configuration loads from multiple providers in order. General application settings load from appsettings.json using the JSON Configuration Provider. Environment-specific settings load from appsettings.{ENVIRONMENT}.json, overlaying values onto base configuration. User secrets provide local development secrets without committing them to source control. Environment variables override file-based settings, useful for containerized deployments. Command-line arguments provide the highest precedence, allowing runtime overrides of any setting.

Later providers override earlier ones. A command-line argument overrides an environment variable, which overrides an environment-specific JSON file, which overrides base JSON configuration.

### Strongly-Typed Configuration

Rather than accessing configuration through string keys, bind configuration sections to strongly-typed classes. This provides compile-time safety and IntelliSense support.

```csharp
public class DatabaseOptions
{
    public string ConnectionString { get; set; }
    public int MaxPoolSize { get; set; }
}

builder.Services.Configure<DatabaseOptions>(
    builder.Configuration.GetSection("Database"));
```

Services can then inject IOptions<DatabaseOptions> to access configuration values. This separates configuration shape from its sources, making it easier to refactor configuration without changing consuming code.

### Host vs. Application Configuration

Host configuration establishes settings that affect the hosting environment itself, like URLs the server listens on, content root path, and environment name. Application configuration provides settings your application code uses, like connection strings, API keys, and feature flags.

Host configuration sources execute first and serve as defaults. Application configuration can override host configuration, but host configuration provides fallback values when application sources don't specify them.

### Secrets Management

Never commit sensitive values like API keys or connection strings to source control. Development environments can use User Secrets, which store values outside the project directory in a user profile location, while production environments should use options like environment variables, Azure Key Vault, AWS Secrets Manager, or similar external secret stores that provide access control and audit logging.

## Dependency Injection in ASP.NET Core

ASP.NET Core includes a built-in dependency injection container that manages service lifecycles and resolves dependencies. Understanding service lifetimes prevents subtle bugs related to service lifetime mismatches.

### Service Lifetimes

Singleton services create one instance for the application lifetime. The container creates the instance on first request and reuses it for all subsequent requests. **Singleton is the right default for stateless, thread-safe services.** If a service has no mutable state and its methods are safe to call concurrently, there is no reason to create additional instances. Services like caching layers, configuration managers, formatters, and utility services should be singletons.

Scoped services create one instance per HTTP request. The same instance serves all dependencies within a request, but different requests get different instances. This lifetime suits services that maintain per-request state like database contexts, unit-of-work implementations, or services that track request-specific context. Most services that hold mutable state in a web application belong at scoped lifetime.

Transient services create a new instance every time the container resolves them. This means that if ServiceA and ServiceB both depend on `IValidator<Order>` and are resolved within the same request, they each get their own instance. With scoped lifetime, they would share the same instance. Transient lifetime matters when a service accumulates internal state during use (like a validator collecting errors) and multiple consumers within the same request need isolation from each other. Outside that narrow case, transient adds allocation overhead without benefit. If the service is stateless, singleton is better; if it needs per-request state, scoped is better.

```csharp
builder.Services.AddSingleton<IMemoryCache, MemoryCache>();
builder.Services.AddScoped<IDbContext, MyDbContext>();
builder.Services.AddTransient<IValidator<Order>, OrderValidator>();
```

### Lifetime Mismatches

A common pitfall involves injecting shorter-lived services into longer-lived services. If a singleton service depends on a scoped service, the singleton captures the first scoped instance and reuses it across requests, violating the scoped lifetime guarantee.

The container validates service lifetimes in development mode, throwing exceptions when it detects problematic dependencies. Production builds omit this validation for performance, so test thoroughly in development to catch lifetime issues.

### Constructor Injection

Services declare dependencies through constructor parameters. The container automatically resolves and injects those dependencies when creating instances.

```csharp
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrderController> _logger;

    public OrderController(IOrderService orderService, ILogger<OrderController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }
}
```

This pattern makes dependencies explicit and testable. Unit tests can provide mock implementations of dependencies without involving the container.

### Keyed Services

ASP.NET Core 8 introduced keyed services, allowing multiple registrations of the same service type distinguished by keys. This eliminates the need for factory patterns or custom service resolution logic when different implementations serve different purposes.

```csharp
builder.Services.AddKeyedScoped<IPaymentProcessor, CreditCardProcessor>("creditcard");
builder.Services.AddKeyedScoped<IPaymentProcessor, PayPalProcessor>("paypal");

// Resolve by key
public class CheckoutService
{
    private readonly IPaymentProcessor _creditCardProcessor;

    public CheckoutService([FromKeyedServices("creditcard")] IPaymentProcessor processor)
    {
        _creditCardProcessor = processor;
    }
}
```

Use keyed services when the same interface has multiple implementations that serve different purposes, and you need to inject specific implementations rather than all implementations.

## Background Services with IHostedService

ASP.NET Core applications can run background tasks alongside HTTP request processing using hosted services. These tasks start when the application starts and stop when it shuts down.

### IHostedService Interface

IHostedService defines two methods. StartAsync executes when the application starts, receiving a cancellation token that signals application shutdown. StopAsync executes when the application stops, performing cleanup before the process terminates.

```csharp
public class MetricsCollectorService : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Initialize and start background work
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        // Cleanup resources
        return Task.CompletedTask;
    }
}

builder.Services.AddHostedService<MetricsCollectorService>();
```

StartAsync should complete quickly. Long-running work should happen asynchronously after StartAsync returns, often using a background thread or timer.

### BackgroundService Base Class

BackgroundService provides a simpler pattern for long-running tasks. It implements IHostedService and exposes a single ExecuteAsync method where you place background logic.

```csharp
public class QueueProcessorService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Process queue items
            await ProcessQueueAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

ExecuteAsync runs asynchronously and continues until the cancellation token signals shutdown. Use this pattern for tasks that process queues, poll external systems, or perform periodic maintenance.

### Hosted Services and Dependency Lifetimes

Hosted services register as singletons, and as established earlier, singleton should be your default for stateless, thread-safe services. If you find a hosted service needing scoped dependencies, that is almost always a sign that something has gone wrong in your service design. The dependencies themselves should probably be singletons too.

The canonical example is database access. `DbContext` is registered as scoped by default, but the correct solution is not to pull scoped services into your singleton through `IServiceScopeFactory`. Instead, use `IDbContextFactory<T>`, which registers as a singleton and creates short-lived `DbContext` instances on demand.

```csharp
builder.Services.AddDbContextFactory<MyDbContext>(options =>
    options.UseSqlServer(connectionString));
```

```csharp
public class DataSyncService : BackgroundService
{
    private readonly IDbContextFactory<MyDbContext> _contextFactory;

    public DataSyncService(IDbContextFactory<MyDbContext> contextFactory)
    {
        _contextFactory = contextFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var dbContext = _contextFactory.CreateDbContext();

            await SyncDataAsync(dbContext);
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
```

This pattern keeps the entire dependency chain singleton-compatible. The factory is a singleton, the hosted service is a singleton, and each `DbContext` instance is created, used, and disposed within a single operation. If you find yourself reaching for `IServiceScopeFactory` in a hosted service, step back and ask why your dependencies are not singletons. The answer is almost always that they should be.

### Shutdown Considerations

When deploying to environments that can recycle or terminate processes, hosted services might not complete gracefully. IIS and Azure App Service can recycle app pools, interrupting background work. If deploying to these environments, ensure background tasks can resume from interruption or consider external services like Azure Functions, AWS Lambda, or Kubernetes Jobs for critical background processing.

Containerized deployments in orchestrators like Kubernetes provide more control over instance lifecycles, making hosted services more reliable for background work.

## Key Takeaways

ASP.NET Core unifies host configuration, HTTP processing, and service management into a cohesive application model centered on WebApplication and WebApplicationBuilder. Understanding Kestrel's architecture and when to use HTTP.sys or reverse proxies informs deployment decisions. The HTTP request pipeline's middleware ordering determines how requests flow through security, routing, and endpoint execution.

Modern Program.cs patterns consolidate configuration into a single file while extension methods organize large applications. Environments separate development, staging, and production concerns through configuration overlays and conditional middleware. The configuration system layers multiple sources with clear precedence, supporting both file-based and external configuration providers.

Dependency injection manages service lifecycles through singleton, scoped, and transient lifetimes (with singleton as the right default for stateless services), while keyed services enable multiple implementations of the same interface. Background services run alongside HTTP processing through IHostedService and BackgroundService patterns, and needing scoped dependencies in a singleton hosted service is almost always a design smell rather than a routine pattern.
