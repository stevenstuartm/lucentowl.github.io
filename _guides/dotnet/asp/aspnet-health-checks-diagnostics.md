---
title: "Health Checks and Diagnostics"
layout: guide
category: "ASP.NET Core"
subcategory: "Performance & Operations"
description: "Health checks, observability, and distributed tracing in ASP.NET Core APIs using IHealthCheck, OpenTelemetry, and Activity-based diagnostics."
tags: [asp-net-core, health-checks, observability, opentelemetry, distributed-tracing, monitoring, diagnostics, kubernetes]
---

## Health Checks and Diagnostics

Health checks provide a structured way for services to report their operational status. Orchestrators like Kubernetes use these signals to decide whether to route traffic to an instance or restart it entirely. Beyond simple liveness signals, modern ASP.NET Core applications can expose rich telemetry through OpenTelemetry integration, distributed tracing with Activity, and diagnostic endpoints that help operators understand what's happening inside running services.

This guide covers the health check infrastructure in ASP.NET Core, how to integrate with container orchestrators, and how to instrument services with observability signals that make production troubleshooting tractable.

## Health Check Infrastructure

ASP.NET Core provides a built-in health check system through the `IHealthCheck` interface and corresponding middleware. Health checks are registered as services and exposed through HTTP endpoints that orchestrators or monitoring systems can poll.

### The IHealthCheck Interface

Health checks implement a single method that returns a result indicating the current state of a component or dependency.

```csharp
public interface IHealthCheck
{
    Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default);
}
```

The `HealthCheckResult` indicates one of three states: Healthy, Degraded, or Unhealthy. Degraded means the service is functional but experiencing issues that should be investigated. Unhealthy means the service cannot fulfill its responsibilities and should be considered unavailable.

### Custom Health Checks

Custom health checks allow you to validate that specific dependencies or conditions are met. A database health check might verify connectivity and query responsiveness. A disk space health check might report degraded status when free space falls below a threshold.

```csharp
public class DatabaseHealthCheck : IHealthCheck
{
    private readonly IDbConnection _connection;

    public DatabaseHealthCheck(IDbConnection connection)
    {
        _connection = connection;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            await _connection.OpenAsync(cancellationToken);
            var command = _connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);

            return HealthCheckResult.Healthy("Database is reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy(
                "Database connection failed", ex);
        }
    }
}
```

Health checks can include arbitrary data in their results, which appears in health check responses when detailed output is enabled. This data might include metrics like query latency, connection pool size, or resource utilization.

### Registering Health Checks

Health checks are registered during service configuration and typically run as singletons since they're invoked frequently and should not carry per-request state.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database")
    .AddCheck("self", () => HealthCheckResult.Healthy())
    .AddCheck("external-api", async () =>
    {
        var client = new HttpClient();
        var response = await client.GetAsync("https://api.example.com/status");
        return response.IsSuccessStatusCode
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("API unreachable");
    });
```

The inline lambda syntax works for simple checks that don't require dependency injection. For checks with dependencies, implement `IHealthCheck` and register the type.

## Health Check Endpoints

The `MapHealthChecks` method exposes health check results through HTTP endpoints. These endpoints return status codes that orchestrators interpret as signals about whether the service should receive traffic.

```csharp
app.MapHealthChecks("/health");
```

A successful health check returns HTTP 200. If any check reports Unhealthy, the endpoint returns HTTP 503 (Service Unavailable). This allows load balancers and orchestrators to make routing decisions based on simple HTTP status codes.

### Filtering Health Checks with Tags

Tags allow different endpoints to expose different subsets of health checks. This distinction matters in container environments where readiness and liveness probes serve different purposes.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })
    .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready" })
    .AddCheck<CacheHealthCheck>("cache", tags: new[] { "ready" });

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

The liveness endpoint verifies that the application process is running and hasn't deadlocked or crashed. It typically includes only basic checks that confirm the runtime is responsive. The readiness endpoint includes checks for external dependencies like databases, caches, and downstream APIs. A service might be alive but not ready if a database is unreachable.

### Liveness vs Readiness in Kubernetes

Kubernetes uses liveness probes to determine whether to restart a container. If a liveness probe fails repeatedly, Kubernetes kills the container and starts a new one. This handles cases where the application deadlocks or enters an unrecoverable state.

Readiness probes determine whether to route traffic to a container. If a readiness probe fails, Kubernetes removes the pod from the service's load balancer pool but doesn't restart it. This handles temporary issues like database connection pool exhaustion or downstream service outages.

Using separate endpoints with different health checks prevents Kubernetes from restarting containers when external dependencies fail. The container might recover once the database comes back online, so restarting it doesn't help.

| Probe Type | Failure Response | Use Case |
|------------|------------------|----------|
| Liveness | Restart container | Deadlocks, crashes, unrecoverable state |
| Readiness | Remove from load balancer | Dependency failures, initialization, warm-up |
| Startup | Delay liveness checks | Slow application startup |

Startup probes protect slow-starting applications from premature liveness failures. During startup, only the startup probe runs. Once it succeeds, liveness and readiness probes take over.

## Health Check Publishers

The `IHealthCheckPublisher` interface allows health check results to be pushed to external systems rather than only exposed through HTTP endpoints. Publishers receive health check results whenever checks run and can forward them to monitoring systems, logging infrastructure, or alerting platforms.

```csharp
public class LoggingHealthCheckPublisher : IHealthCheckPublisher
{
    private readonly ILogger<LoggingHealthCheckPublisher> _logger;

    public LoggingHealthCheckPublisher(
        ILogger<LoggingHealthCheckPublisher> logger)
    {
        _logger = logger;
    }

    public Task PublishAsync(
        HealthReport report,
        CancellationToken cancellationToken)
    {
        foreach (var entry in report.Entries)
        {
            _logger.LogInformation(
                "Health check {Name} status: {Status}, duration: {Duration}",
                entry.Key,
                entry.Value.Status,
                entry.Value.Duration);
        }

        return Task.CompletedTask;
    }
}
```

Publishers are registered through the health check configuration and run according to a configured schedule.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database");

builder.Services.Configure<HealthCheckPublisherOptions>(options =>
{
    options.Delay = TimeSpan.FromSeconds(10);
    options.Period = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<IHealthCheckPublisher, LoggingHealthCheckPublisher>();
```

The delay specifies how long to wait before the first health check run. The period specifies how often checks run after that. Publishers receive a `HealthReport` containing results from all registered health checks.

## Third-Party Health Check Packages

The AspNetCore.Diagnostics.HealthChecks library provides health check implementations for common dependencies like SQL Server, Redis, Elasticsearch, RabbitMQ, and cloud services. These checks handle connection management, query execution, and result interpretation.

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "sql")
    .AddRedis(redisConnection, name: "redis")
    .AddRabbitMQ(rabbitConnection, name: "rabbitmq")
    .AddUrlGroup(new Uri("https://api.example.com"), name: "external-api");
```

Each check includes configuration options for timeouts, custom queries, and failure thresholds. The library also provides UI middleware that renders health check results as HTML or JSON, making it easier to inspect health status during development.

Health check libraries reduce the boilerplate required to verify common dependencies and provide consistent behavior across services. However, custom health checks remain necessary for application-specific logic like checking message queue depth, validating circuit breaker state, or verifying background job health.

## Request Logging and Correlation

Request logging captures information about each HTTP request processed by the application. ASP.NET Core logs requests automatically when the appropriate log level is configured, but structured logging with correlation IDs makes logs more useful when troubleshooting distributed systems.

### ILogger Scopes for Correlation

Logger scopes add contextual information to all log messages within a specific execution context. Scopes work particularly well for attaching correlation IDs that link log messages from a single request.

```csharp
public class CorrelationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationMiddleware> _logger;

    public CorrelationMiddleware(
        RequestDelegate next,
        ILogger<CorrelationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers["X-Correlation-ID"]
            .FirstOrDefault() ?? Guid.NewGuid().ToString();

        using (_logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = correlationId
        }))
        {
            context.Response.Headers["X-Correlation-ID"] = correlationId;
            await _next(context);
        }
    }
}
```

The scope ensures that the correlation ID appears in every log message written during request processing. Log aggregation systems can group messages by correlation ID, making it straightforward to trace a request through the application.

Scopes stack, so middleware can add user IDs, tenant identifiers, or operation names to provide increasingly specific context as the request moves through the pipeline.

## OpenTelemetry Integration

OpenTelemetry provides a vendor-neutral standard for instrumenting applications to generate telemetry data. ASP.NET Core integrates with OpenTelemetry to emit traces, metrics, and logs that can be exported to various observability backends like Jaeger, Prometheus, or Azure Application Insights.

### Telemetry Pillars

Telemetry data divides into three categories, sometimes called the three pillars of observability. Traces represent the flow of requests through distributed systems and show timing and relationships between services. Metrics are numerical measurements of system behavior over time, like request counts, error rates, or memory usage. Logs are textual records of events with rich contextual information.

OpenTelemetry provides APIs and libraries that instrument applications to generate all three types of telemetry without coupling the application to specific backends. The same instrumentation code works whether telemetry is sent to Jaeger, Zipkin, Application Insights, or any other OpenTelemetry-compatible system.

### Configuring OpenTelemetry

OpenTelemetry configuration specifies which signals to capture and where to send them. Instrumentation libraries automatically capture telemetry from ASP.NET Core, HTTP clients, and other components without requiring changes to application code.

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource("MyApplication")
        .AddOtlpExporter())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter());
```

The ASP.NET Core instrumentation captures incoming HTTP requests automatically, creating spans for each request with details like HTTP method, path, status code, and duration. HTTP client instrumentation does the same for outgoing requests. Runtime instrumentation captures metrics about memory usage, garbage collection, and thread pool behavior.

The OTLP exporter sends telemetry to any backend that supports the OpenTelemetry Protocol. The exporter endpoint is typically configured through environment variables so different environments can send telemetry to different backends without code changes.

## Activity and Distributed Tracing

Distributed tracing tracks requests as they flow through multiple services. Each service adds spans to a trace, building a complete picture of how long each operation took and where time was spent. In .NET, the `Activity` class represents a span, and `ActivitySource` represents a tracer.

### Creating Custom Spans

Custom spans instrument specific operations that don't correspond to HTTP requests or database queries. A span might represent a cache lookup, a message queue operation, or a complex business logic step.

```csharp
public class OrderProcessor
{
    private static readonly ActivitySource ActivitySource =
        new ActivitySource("MyApplication.OrderProcessor");

    public async Task<Order> ProcessOrderAsync(int orderId)
    {
        using var activity = ActivitySource.StartActivity("ProcessOrder");
        activity?.SetTag("order.id", orderId);

        var order = await FetchOrderAsync(orderId);
        activity?.SetTag("order.total", order.Total);

        await ValidateInventoryAsync(order);
        await ChargePaymentAsync(order);
        await ShipOrderAsync(order);

        return order;
    }

    private async Task<Order> FetchOrderAsync(int orderId)
    {
        using var activity = ActivitySource.StartActivity("FetchOrder");
        activity?.SetTag("order.id", orderId);

        // Fetch order from database
        return await Task.FromResult(new Order { Id = orderId });
    }
}
```

Each span includes tags that provide context about the operation. Tags can include identifiers, measurements, or any other relevant data. Tracing backends display tags alongside spans, making it easier to understand what happened during a specific operation.

Activities propagate across asynchronous boundaries automatically, so child operations inherit the trace context from their parent. This propagation ensures that all spans created during request processing belong to the same trace.

### ActivitySource Registration

Activity sources must be registered with OpenTelemetry to ensure their spans are captured and exported.

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("MyApplication.OrderProcessor")
        .AddSource("MyApplication.*") // Wildcard supported
        .AddAspNetCoreInstrumentation()
        .AddOtlpExporter());
```

The source name passed to `ActivitySource` must match the source name registered with OpenTelemetry. Wildcard patterns can capture multiple sources with a shared prefix.

### Trace Context Propagation

When an application makes an HTTP request to another service, trace context must propagate so the receiving service can add spans to the same trace. ASP.NET Core and HttpClient handle this automatically through headers like `traceparent` and `tracestate`.

The calling service includes trace context in outgoing request headers. The receiving service extracts trace context from incoming request headers and uses it as the parent for new spans. This propagation links spans across service boundaries, creating a complete distributed trace.

## Diagnostic Endpoints

Diagnostic endpoints expose runtime information and metrics without requiring external tracing infrastructure. These endpoints help during development and provide quick access to service internals when troubleshooting production issues.

### Exposing Metrics

ASP.NET Core can expose metrics through HTTP endpoints using the Prometheus exposition format or JSON. This allows monitoring systems to scrape metrics directly without requiring an OpenTelemetry collector.

```csharp
app.MapPrometheusScrapingEndpoint();
```

Metrics include request counts, request duration histograms, active requests, and failure rates. Custom metrics can be added through the `Meter` API.

```csharp
public class OrderMetrics
{
    private static readonly Meter Meter = new Meter("MyApplication.Orders");
    private static readonly Counter<int> OrdersProcessed =
        Meter.CreateCounter<int>("orders.processed");
    private static readonly Histogram<double> OrderValue =
        Meter.CreateHistogram<double>("orders.value");

    public void RecordOrder(Order order)
    {
        OrdersProcessed.Add(1, new KeyValuePair<string, object>("region", order.Region));
        OrderValue.Record(order.Total, new KeyValuePair<string, object>("region", order.Region));
    }
}
```

Meters must be registered with OpenTelemetry to ensure metrics are exported.

```csharp
builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => metrics
        .AddMeter("MyApplication.Orders")
        .AddOtlpExporter());
```

## Health Check Response Formats

Health check endpoints return JSON or plain text depending on configuration. JSON responses include detailed information about each health check, while plain text responses simply return the overall status.

```csharp
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.TotalMilliseconds,
                exception = e.Value.Exception?.Message,
                data = e.Value.Data
            })
        });
        await context.Response.WriteAsync(result);
    }
});
```

Custom response writers allow health check endpoints to return whatever format is required by monitoring systems or load balancers. Some systems expect specific JSON schemas, while others parse text responses.

## Common Health Check Patterns

### Caching Health Check Results

Health checks that query external systems can introduce latency and load. Caching results for a short period reduces the impact of frequent health check polls.

```csharp
public class CachedHealthCheck : IHealthCheck
{
    private readonly IHealthCheck _inner;
    private HealthCheckResult? _cached;
    private DateTime _cacheExpiry;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromSeconds(10);

    public CachedHealthCheck(IHealthCheck inner)
    {
        _inner = inner;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken)
    {
        if (_cached.HasValue && DateTime.UtcNow < _cacheExpiry)
        {
            return _cached.Value;
        }

        var result = await _inner.CheckHealthAsync(context, cancellationToken);
        _cached = result;
        _cacheExpiry = DateTime.UtcNow.Add(_cacheDuration);
        return result;
    }
}
```

Kubernetes probes run frequently, often every few seconds. Caching prevents each probe from triggering database queries or HTTP requests.

### Degraded Status for Non-Critical Dependencies

Not all dependencies are equally critical. A service might function with degraded performance when a cache is unavailable but cannot function at all when a database is unreachable. Health checks can return Degraded for non-critical dependencies, allowing the service to remain in rotation while signaling that something needs attention.

```csharp
public class CacheHealthCheck : IHealthCheck
{
    private readonly IDistributedCache _cache;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            await _cache.GetAsync("health-check-key", cancellationToken);
            return HealthCheckResult.Healthy("Cache is available");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded(
                "Cache unavailable, falling back to database", ex);
        }
    }
}
```

Orchestrators can be configured to treat Degraded as either healthy or unhealthy depending on whether the application can tolerate degraded operation.

### Startup Health Checks

Services that perform initialization work on startup might not be ready to handle requests immediately. Startup health checks remain unhealthy until initialization completes.

```csharp
public class StartupHealthCheck : IHealthCheck
{
    private volatile bool _isReady;

    public void MarkReady() => _isReady = true;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(_isReady
            ? HealthCheckResult.Healthy("Service is ready")
            : HealthCheckResult.Unhealthy("Service is starting"));
    }
}
```

The startup logic calls `MarkReady` once initialization completes. Until then, readiness probes fail and the service doesn't receive traffic.

## Red Flags

Health checks that always return Healthy provide no signal and waste resources. Every health check should validate something meaningful about application state or dependencies.

Health checks that query heavyweight operations like table scans or full-text searches introduce latency and load that scales with request volume. Health checks should use lightweight queries designed to verify basic connectivity and responsiveness.

Liveness health checks that include external dependency checks cause unnecessary restarts when those dependencies fail. Liveness checks should verify only that the application process is responsive, not that external systems are available.

Health check endpoints without authentication expose internal service state to potential attackers. While health checks typically don't reveal sensitive data, they do indicate which dependencies a service uses and when those dependencies are failing.

Missing correlation IDs make it difficult to trace requests through logs when troubleshooting production issues. Every request should carry a correlation ID from the moment it enters the system until it completes.

OpenTelemetry instrumentation without sampling configuration in high-traffic services generates overwhelming amounts of trace data and impacts performance. Sampling reduces the volume of traces while preserving enough signal to identify issues.

Spans without tags or with generic tags like "operation" and "result" provide limited context when analyzing traces. Tags should include identifiers, measurements, and other context that helps operators understand what happened during a specific operation.
