---
title: "Health Checks and Diagnostics"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Operations"
description: "Making an ASP.NET Core service observable in production: health checks and their endpoints, liveness, readiness, and startup probes, health for background services, HTTP logging, and OpenTelemetry tracing and metrics with ActivitySource and IMeterFactory."
tags: [practical, health-checks, kubernetes, opentelemetry, distributed-tracing, http-logging, observability]
---

A running service has to answer two kinds of question from outside the process. An orchestrator, the platform that starts, restarts, and routes traffic to instances (Kubernetes is the usual one), or a load balancer asks a yes-or-no question many times a minute, such as whether this instance should get traffic or be restarted. An operator investigating a slow request asks an open one, such as what happened, where, and how often. ASP.NET Core answers the first with health checks and the second with HTTP logging and OpenTelemetry, which exports the traces and metrics the framework already records.

## Health Checks

A health check is a class that tests one thing, such as a database connection, a queue's depth, or whether a background loop is still making progress, and reports the result. The health check service runs every registered check, combines the results into one report, and an endpoint turns that report into an HTTP status code.

### A Check Reports One of Three States

Every check implements `IHealthCheck`:

```csharp
public interface IHealthCheck
{
    Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default);
}
```

The result is `Healthy`, `Degraded`, or `Unhealthy`. Degraded means the component works but needs attention, such as a cache that is down while the app falls back to the database. Unhealthy means the component can't do its job. The overall report takes the worst status among the checks it ran.

A check doesn't have to catch its own exceptions. If `CheckHealthAsync` throws, the service records the registration's *failure status*, which defaults to Unhealthy, with the exception attached. Catching the exception yourself is how a check chooses a different status, such as Degraded for a dependency the app can live without.

### Writing a Custom Check

This check opens a connection and runs a trivial query, which proves that the database accepts connections and answers without loading it:

```csharp
public class DatabaseHealthCheck(DbDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1";
        await command.ExecuteScalarAsync(cancellationToken);

        return HealthCheckResult.Healthy("Database is reachable");
    }
}
```

`DbDataSource` is the ADO.NET abstraction that providers like Npgsql register in dependency injection. Each result can also carry a `data` dictionary of values such as the last query's latency or a queue's depth, which appears in the report for any response writer that includes it.

### Registering Checks

Checks are registered on the builder and chained from `AddHealthChecks()`:

```csharp
builder.Services.AddHttpClient<ExternalApiHealthCheck>();

builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddCheck<DatabaseHealthCheck>("database",
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(2))
    .AddCheck<ExternalApiHealthCheck>("external-api",
        failureStatus: HealthStatus.Degraded,
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(2));
```

How a check instance is created decides what state it can keep. On each run the health check service creates a new dependency injection scope for each check, so scoped services resolved during that check live only for that run, and asks the registration's factory for an instance. For `AddCheck<T>`, the factory resolves `T` from the container if it is registered there, so a check registered as a singleton keeps its fields between runs. Otherwise the factory constructs a fresh `T` every time, which can take scoped services like a `DbContext` but can't remember anything. A check that calls an HTTP API should get its `HttpClient` from `IHttpClientFactory` rather than creating one per run. `AddHttpClient<ExternalApiHealthCheck>()` above does that by registering the check as a typed client, which receives a factory-managed `HttpClient` through its constructor.

The service runs all checks concurrently, so the slowest check sets the response time. A registration has no timeout unless you pass one, and without it a hung dependency holds the whole report until the caller gives up. When a timeout expires, the check reports its failure status with the description "A timeout occurred while running check."

### Library Checks

For Entity Framework Core, Microsoft ships `AddDbContextCheck<TContext>()` in `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, which calls the context's `CanConnectAsync()`. For other dependencies, the community [AspNetCore.Diagnostics.HealthChecks](https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks){:target="_blank" rel="noopener noreferrer"} project publishes one package per dependency, such as `AspNetCore.HealthChecks.SqlServer`, `AspNetCore.HealthChecks.Redis`, and `AspNetCore.HealthChecks.Uris`. Microsoft doesn't maintain or support it.

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<OrdersDbContext>(tags: ["ready"])
    .AddRedis(redisConnectionString, name: "redis", tags: ["ready"])
    .AddUrlGroup(new Uri("https://api.example.com/status"), name: "external-api");
```

Library checks cover connectivity. Checks that encode what "working" means for this particular app, such as a queue's depth staying under a threshold or a background job having run recently, remain custom.

## Health Endpoints

`MapHealthChecks` runs the checks and writes the report as a response:

```csharp
app.MapHealthChecks("/health");
```

### Status Codes and the Default Response

The endpoint maps the overall status to an HTTP status code. By default Healthy and Degraded both return 200 and Unhealthy returns 503, and the status code is all a probe reads. Kubernetes counts any 2xx or 3xx as a pass, and cloud load balancers commonly expect 200 by default, so the default mapping satisfies both. Returning 200 for Degraded is deliberate. A degraded instance still serves traffic, so it stays in rotation. `HealthCheckOptions.ResultStatusCodes` changes the mapping when a caller should see Degraded as a failure.

The default body is plain text naming the overall status (`Healthy`, `Degraded`, or `Unhealthy`), and the middleware sets headers that stop the response from being cached, unless `AllowCachingResponses` is set.

### The Endpoint Runs Through the Pipeline

`MapHealthChecks` creates an ordinary endpoint, so everything that applies to endpoints applies to it:

- **A fallback authorization policy applies to it.** If the app sets `FallbackPolicy` to require authenticated users, probes get 401 until the endpoint calls `.AllowAnonymous()`.
- **Exposure is a real concern.** Even the plain-text status tells an outsider when a dependency is failing, and a detailed response names every dependency. `.RequireAuthorization()` protects a detailed endpoint, but probes rarely carry credentials. The usual arrangement is an anonymous endpoint with the plain-text body for probes, reachable only inside the cluster or on a port that isn't published, plus an authorized endpoint with detail for people.
- **`RequireHost` doesn't restrict by port.** The Learn page's `RequireHost("*:5001")` example matches the `Host` header, which the client controls. To accept probes only on an internal port, listen on a second port and check `HttpContext.Connection.LocalPort`, or don't publish that port outside the cluster.
- **Health requests land in the app's telemetry.** Probes every few seconds from every instance swamp the request metrics and traces. `.DisableHttpMetrics()` (.NET 9 and later) excludes the endpoint from the built-in HTTP metrics, and the OpenTelemetry tracing filter shown later excludes it from traces.

`UseHealthChecks("/health")` is the older middleware form. It answers wherever it sits in the pipeline, ends the request there, and takes no part in endpoint routing, so endpoint metadata like authorization policies and CORS policies doesn't apply to it. The endpoint form gets the same early exit from `.ShortCircuit()`, which skips the rest of the middleware once routing has matched the endpoint. It can't be combined with authorization or CORS metadata, though, and a short-circuited endpoint carrying either fails every request with an `InvalidOperationException`, so it suits the anonymous probe endpoint rather than the authorized detail endpoint.

### Detailed Responses

A custom response writer serializes whatever the report holds:

```csharp
app.MapHealthChecks("/health/detail", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.TotalMilliseconds,
                data = e.Value.Data
            })
        });
    }
}).RequireAuthorization("Operators");
```

The writer above leaves out exception messages, which can carry connection strings or server names. The community `AspNetCore.HealthChecks.UI.Client` package supplies `UIResponseWriter.WriteHealthCheckUIResponse`, a ready-made JSON writer in the format its dashboard reads.

## Liveness, Readiness, and Startup Probes

Kubernetes probes each container in three ways, through the kubelet, the agent on each node that runs the containers. A Service is the stable address that spreads traffic across the ready pods behind it, and a pod counts as ready only when all of its containers pass readiness. Each probe's failure has a different consequence:

| Probe | What a failure causes | What it should check |
|---|---|---|
| **Liveness** | The kubelet restarts the container after `failureThreshold` consecutive failures | Only that the process can still respond |
| **Readiness** | The pod leaves the Service's endpoints and gets no traffic. The probe keeps running for the container's whole life | That the instance can serve requests, including required dependencies |
| **Startup** | The container is restarted if startup doesn't finish in time. Liveness and readiness don't run until it succeeds | That one-time initialization has finished |

The split between liveness and readiness exists because of dependencies. When the database goes down, every instance fails a check that queries it. On a readiness probe, the instances drop out of rotation and return once the database recovers. On a liveness probe, Kubernetes restarts every instance at once, which fixes nothing and adds a restart storm to the outage. The Kubernetes docs warn in general that a badly implemented liveness probe can cause cascading failures, and a dependency check on liveness is one way to build one.

Readiness has its own cost when a dependency is shared. If every pod fails readiness at once, the Service has no endpoints left, and clients get connection failures instead of the app's own error responses. A readiness check earns its place for a dependency this instance can't serve without while other instances can, such as a local cache that is still loading. For a dependency every instance shares, staying in rotation and returning fast 503s is sometimes the better outcome.

Tags route checks to endpoints. Each endpoint's `Predicate` selects the checks it runs:

```csharp
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

The `live` check here is the `self` lambda registered earlier, which always returns Healthy. That is intended. A liveness endpoint answers "can the process still handle an HTTP request," and a response of any kind proves it. `Predicate = _ => false` gives the same result with no checks at all.

{% include figure.html id="asp-health-probe-routing" %}

The probes themselves are declared on the container in the pod spec, each pointing at one of the endpoints:

```yaml
containers:
  - name: orders-api
    image: example.azurecr.io/orders-api:1.4.2
    ports:
      - containerPort: 8080
    livenessProbe:
      httpGet: { path: /health/live, port: 8080 }
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet: { path: /health/ready, port: 8080 }
      periodSeconds: 10
      timeoutSeconds: 3
    startupProbe:
      httpGet: { path: /health/live, port: 8080 }
      periodSeconds: 5
      failureThreshold: 24
```

The readiness probe's `timeoutSeconds` is raised to 3 because the checks behind it have 2-second timeouts. The startup probe gives the process up to two minutes (24 failures, 5 seconds apart) to start answering HTTP at all before liveness takes over.

### Keep Probes Cheap

Kubernetes probes every 10 seconds by default and waits 1 second for an answer. A readiness check slower than the probe's `timeoutSeconds` fails the probe even when the dependency is fine, so per-check timeouts should sit below the probe timeout, or the probe timeout should be raised to fit, as the manifest above does. Every instance also probes every dependency, so fifty pods probing every ten seconds send five queries a second to the database for health alone. A `SELECT 1` costs nothing at that rate. A check that scans a table doesn't.

When a check is genuinely expensive, cache its result in a singleton so that probes between refreshes don't repeat the work:

```csharp
public class CachedQueueDepthCheck(IServiceScopeFactory scopeFactory) : IHealthCheck
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(15);
    private volatile Snapshot? _snapshot;

    private sealed record Snapshot(HealthCheckResult Result, DateTime Expires);

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var snapshot = _snapshot;
        if (snapshot is not null && DateTime.UtcNow < snapshot.Expires)
        {
            return snapshot.Result;
        }

        await using var scope = scopeFactory.CreateAsyncScope();
        var queue = scope.ServiceProvider.GetRequiredService<IOrderQueue>();
        var depth = await queue.GetDepthAsync(cancellationToken);

        var result = depth < 10_000
            ? HealthCheckResult.Healthy(data: new Dictionary<string, object> { ["depth"] = depth })
            : HealthCheckResult.Degraded($"Queue depth {depth}");
        _snapshot = new Snapshot(result, DateTime.UtcNow + CacheFor);
        return result;
    }
}

builder.Services.AddSingleton<CachedQueueDepthCheck>();
builder.Services.AddHealthChecks()
    .AddCheck<CachedQueueDepthCheck>("queue-depth", tags: ["ready"]);
```

The singleton registration is what makes the cache work. Without it, `AddCheck<T>` builds a new instance on every run and the cache is always empty. Because the singleton can't hold scoped services, it creates a scope for each refresh. The result and its expiry live in one immutable snapshot, swapped in a single reference assignment, so a probe on another thread never reads a result paired with the wrong expiry. Two probes arriving together may both refresh, which costs one extra query.

## Health for Background Services

A hosted service has no endpoint of its own, so its health has to reach the health check through shared state. Since .NET 6, an unhandled exception in `ExecuteAsync` stops the whole host, and the platform notices a stopped process without help. The case a health check exists for is quieter, such as a loop that catches its errors and keeps going, failing every iteration, while the process looks fine.

### Report the Last Successful Run

The service and the check share a singleton that records progress:

```csharp
public class OrderProcessingStatus
{
    private long _lastSuccessTicks = DateTime.UtcNow.Ticks;

    public DateTime LastSuccess => new(Interlocked.Read(ref _lastSuccessTicks), DateTimeKind.Utc);
    public void MarkSuccess() => Interlocked.Exchange(ref _lastSuccessTicks, DateTime.UtcNow.Ticks);
}

public class OrderProcessingHealthCheck(OrderProcessingStatus status) : IHealthCheck
{
    private static readonly TimeSpan MaxSilence = TimeSpan.FromMinutes(5);

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var silence = DateTime.UtcNow - status.LastSuccess;
        var data = new Dictionary<string, object> { ["lastSuccess"] = status.LastSuccess };

        return Task.FromResult(silence < MaxSilence
            ? HealthCheckResult.Healthy(data: data)
            : HealthCheckResult.Unhealthy($"No successful batch for {silence.TotalMinutes:F0} minutes", data: data));
    }
}

builder.Services.AddSingleton<OrderProcessingStatus>();
builder.Services.AddHostedService<OrderProcessingService>(); // calls status.MarkSuccess() after each batch
builder.Services.AddHealthChecks()
    .AddCheck<OrderProcessingHealthCheck>("order-processing", tags: ["ready"]);
```

Injecting the hosted service itself into the check doesn't work. `AddHostedService<T>` registers the service only as `IHostedService`, not as `T`, so the check's constructor can't be satisfied, and every run reports Unhealthy with an "Unable to resolve service" exception. Registering it a second time with `AddSingleton<T>()` makes the check resolve, but against a second, idle instance that the host never starts. The shared status object avoids both.

Which probe the check belongs on is a judgment call. On readiness, a stalled worker takes the instance out of rotation, which helps only if the instance also serves traffic that depends on the worker. On liveness, a stall triggers a restart, which helps when the loop is stuck in a state it can't leave on its own. Often the better signal is an alert on the detailed endpoint or on a metric, with neither probe involved.

### Signal When Startup Finishes

Work that must finish before the instance takes traffic, such as warming a cache or loading reference data, can report through a check that stays Unhealthy until the work completes. This is the pattern from the Learn docs, where the check itself is the shared singleton:

```csharp
public class StartupHealthCheck : IHealthCheck
{
    private volatile bool _completed;

    public bool StartupCompleted
    {
        get => _completed;
        set => _completed = value;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(StartupCompleted
            ? HealthCheckResult.Healthy("Startup work has completed.")
            : HealthCheckResult.Unhealthy("Startup work is still running."));
}

public class WarmupService(StartupHealthCheck startup, ReferenceDataCache cache) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await cache.LoadAsync(stoppingToken);
        startup.StartupCompleted = true;
    }
}

builder.Services.AddSingleton<StartupHealthCheck>();
builder.Services.AddHostedService<WarmupService>();
builder.Services.AddHealthChecks()
    .AddCheck<StartupHealthCheck>("startup", tags: ["ready"]);
```

Tagging it `ready` keeps traffic away until the warmup finishes. The warmup runs in `ExecuteAsync` after the server has started, so the liveness endpoint answers throughout and liveness never trips on a slow warmup. A startup probe matters when the process is slow to answer HTTP at all, such as when blocking work runs before `app.Run()` or inside a hosted service's `StartAsync`, which the host awaits before starting the server.

## Publishing Health Results

Endpoints answer when asked. A health check publisher pushes results on a schedule instead, for monitoring systems that don't poll or for a log of health over time. `AddHealthChecks()` registers a hosted service that runs the checks periodically and hands each `HealthReport` to every registered `IHealthCheckPublisher`:

```csharp
public class LoggingHealthCheckPublisher(ILogger<LoggingHealthCheckPublisher> logger)
    : IHealthCheckPublisher
{
    public Task PublishAsync(HealthReport report, CancellationToken cancellationToken)
    {
        foreach (var (name, entry) in report.Entries)
        {
            logger.LogInformation("Health check {Check} is {Status} after {Duration}",
                name, entry.Status, entry.Duration);
        }

        return Task.CompletedTask;
    }
}

builder.Services.Configure<HealthCheckPublisherOptions>(options =>
{
    options.Delay = TimeSpan.FromSeconds(10);
    options.Period = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<IHealthCheckPublisher, LoggingHealthCheckPublisher>();
```

`Delay` is the wait after startup before the first run and defaults to 5 seconds. `Period` is the interval between runs and defaults to 30 seconds. `Timeout` bounds each run and also defaults to 30 seconds, and `Predicate` selects which checks the publisher runs. A registration can set its own `Delay` and `Period` to run on a different schedule from the rest. The publisher's runs are separate from the endpoint's, so a probe still runs the checks itself. Where the service already exports OpenTelemetry metrics, a publisher that records each check's status as a gauge puts health on the same dashboards and alerts as everything else, and a logging publisher like this one mostly suits services without that pipeline.

## HTTP Logging

The HTTP logging middleware writes a log entry for each request and response, with properties, headers, and optionally bodies:

```csharp
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPropertiesAndHeaders
        | HttpLoggingFields.ResponsePropertiesAndHeaders
        | HttpLoggingFields.Duration;
    options.RequestHeaders.Add("X-Tenant-Id");
    options.CombineLogs = true;
});

var app = builder.Build();

app.UseHttpLogging();
```

Enabling it doesn't make anything appear by default. The middleware logs at Information under the category `Microsoft.AspNetCore.HttpLogging.HttpLoggingMiddleware`, and the template's `appsettings.json` sets `Microsoft.AspNetCore` to Warning, so its output is filtered until that category is raised:

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.AspNetCore.HttpLogging.HttpLoggingMiddleware": "Information"
    }
  }
}
```

The defaults protect more than they appear to. `LoggingFields` defaults to request and response properties and headers, without bodies. Header values are logged only for names in the `RequestHeaders` and `ResponseHeaders` allowlists, and every other header, including `Authorization`, appears as `[Redacted]`. `CombineLogs` (.NET 8 and later) writes one entry per request instead of separate request and response entries.

Beyond the global options there are three levers:

- **Per endpoint:** `.WithHttpLogging(fields)` on a minimal API endpoint, or the `[HttpLogging]` attribute on a controller or action, overrides the global fields.
- **Per request:** an `IHttpLoggingInterceptor` registered with `AddHttpLoggingInterceptor<T>()` sees each request and response and can turn fields on or off, trim the body, or add custom values.
- **Redaction by classification:** `AddHttpLoggingRedaction()` from `Microsoft.AspNetCore.Diagnostics.Middleware`, registered alongside `AddRedaction()`, redacts route parameters and headers by data classification, and its `ExcludePathStartsWith` drops paths like `/health` entirely.

Bodies are where HTTP logging gets expensive and risky. `RequestBody` and `ResponseBody` buffer up to `RequestBodyLogLimit` and `ResponseBodyLogLimit` bytes of each body, and only for the text media types in `MediaTypeOptions`. Microsoft's docs warn that HTTP logging can reduce performance, especially with bodies, and can log personal data. Body logging tends to belong on a few endpoints during an investigation, not on the whole app.

Pipeline position decides coverage. Middleware that answers before `UseHttpLogging` runs, such as static files, isn't logged.

Correlating these entries needs no extra middleware. Entries written during a request can carry the request's trace and span IDs, which join them to the trace described below, as long as the log provider includes scopes or is the OpenTelemetry provider.

## OpenTelemetry

Logs record discrete events. Traces show where a request spent its time across services, as a tree of *spans*, each one a timed operation such as handling the request or calling another service. Metrics show rates and distributions over time. .NET provides the APIs that produce all three: `ILogger` for logs, `ActivitySource` and `Activity` for traces (an `Activity` is .NET's span), and `Meter` for metrics. OpenTelemetry's .NET SDK subscribes to those APIs by name and exports what it collects over OTLP, the OpenTelemetry Protocol, so the app's instrumentation code doesn't reference any vendor.

### Wiring the SDK

The SDK is configured on the builder. This is the shape used by Aspire's ServiceDefaults template, the shared project Aspire adds to every service to configure telemetry and health checks, and it is a reasonable starting point with or without Aspire:

```csharp
builder.Logging.AddOpenTelemetry(logging =>
{
    logging.IncludeFormattedMessage = true;
    logging.IncludeScopes = true;
});

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("orders-api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation(options =>
            options.Filter = context =>
                !context.Request.Path.StartsWithSegments("/health"))
        .AddHttpClientInstrumentation()
        .AddSource("Orders.*"))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("Orders.Api"))
    .UseOtlpExporter();
```

The packages are `OpenTelemetry.Extensions.Hosting`, the three `OpenTelemetry.Instrumentation.*` packages (AspNetCore, Http, Runtime), and `OpenTelemetry.Exporter.OpenTelemetryProtocol`. Each call does one job:

- **`AddService`** names the service, which is how a backend tells this app's telemetry from every other app's. The `OTEL_SERVICE_NAME` environment variable supplies the name when code doesn't call `AddService`.
- **The ASP.NET Core instrumentation** records a span for each incoming request and, on .NET 8 and later, turns on the framework's built-in meters, such as `Microsoft.AspNetCore.Hosting` with its `http.server.request.duration` histogram. On .NET 9 and later, the runtime instrumentation likewise subscribes to the built-in `System.Runtime` meter, which reports garbage collection, thread pool, and memory metrics.
- **`AddSource` and `AddMeter`** subscribe to the app's own spans and metrics by name. Both accept a trailing wildcard, so `Orders.*` covers every source whose name starts with `Orders.`.
- **`UseOtlpExporter`** sends all three signals to one OTLP endpoint. It defaults to gRPC on `localhost:4317`, and the `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL` environment variables point it elsewhere without a code change. It can't be combined with the per-signal `AddOtlpExporter()` calls.

That one endpoint is usually an OpenTelemetry Collector, a separate process (often a sidecar or a per-node agent) that receives OTLP and forwards each signal to the backend that stores it, such as a trace store, Prometheus, and a log store, or to a vendor. Individual backends tend to accept only some signals, so pointing the app straight at one of them usually drops the others. The Aspire template calls `UseOtlpExporter` only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so a machine without a collector doesn't try to export.

Inside the SDK, each signal has its own provider (a `LoggerProvider`, a `TracerProvider`, and a `MeterProvider`) holding the subscriptions for that signal. The figure follows one app's telemetry through them: the framework's request spans and request-duration meter, a custom `Orders.Processing` source that the `Orders.*` wildcard matches, the `Orders.Api` meter, and a `Billing.Sync` source that no `AddSource` call registered.

{% include figure.html id="asp-otel-pipeline" %}

### Custom Spans with ActivitySource

The framework's spans cover requests and outgoing HTTP calls. Work inside a request, such as a pricing calculation or a batch of database writes, gets its own spans from an `ActivitySource`:

```csharp
public class OrderProcessor(IOrderRepository orders, IPaymentGateway payments)
{
    private static readonly ActivitySource Source = new("Orders.Processing");

    public async Task ProcessAsync(int orderId, CancellationToken cancellationToken)
    {
        using var activity = Source.StartActivity("ProcessOrder");
        activity?.SetTag("order.id", orderId);

        var order = await orders.GetAsync(orderId, cancellationToken);
        activity?.SetTag("order.line_count", order.Lines.Count);

        await payments.ChargeAsync(order, cancellationToken);
    }
}
```

`StartActivity` returns `null` when nothing is listening to the source, which is what happens when its name isn't registered with `AddSource`. Inside a request whose trace the sampler (see below) chose not to record, it returns `null` as well. The `?.` calls make an unobserved span cost almost nothing. The new activity becomes a child of `Activity.Current`, which flows through `await`, so a span started inside a request nests under that request's span without any code passing it along. Unregistered sources are the usual reason custom spans never appear. `Orders.Processing` shows up only because the `Orders.*` wildcard above matches it, and `Billing.Sync` in the figure never does.

Tags carry the context a trace viewer shows next to each span. Identifiers and counts that someone would search or filter on belong there. Personal data and secrets don't, because trace backends are rarely access-controlled like a database.

### Custom Metrics with IMeterFactory

ASP.NET Core registers `IMeterFactory` in dependency injection, and Microsoft recommends it over static `Meter` instances in ASP.NET Core apps. Meters from the factory belong to the app's container, which lets integration tests running side by side each collect only their own measurements:

```csharp
public class OrderMetrics
{
    private readonly Counter<int> _ordersPlaced;
    private readonly Histogram<double> _orderValue;

    public OrderMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("Orders.Api");
        _ordersPlaced = meter.CreateCounter<int>("orders.placed");
        _orderValue = meter.CreateHistogram<double>("orders.value", unit: "USD");
    }

    public void OrderPlaced(string region, decimal total)
    {
        var tag = new KeyValuePair<string, object?>("order.region", region);
        _ordersPlaced.Add(1, tag);
        _orderValue.Record((double)total, tag);
    }
}

builder.Services.AddSingleton<OrderMetrics>();
```

The meter name `Orders.Api` must match an `AddMeter` call, just as a source must match `AddSource`. Each distinct combination of tag values becomes a separate time series in the backend. A tag with a few known values, like a region, is cheap, and a tag holding an order ID or a user ID creates a series per value until the backend starts dropping data.

### Sampling Controls Trace Volume

The SDK's default sampler is `ParentBased(AlwaysOn)`. It follows the caller's sampling decision when a request arrives with trace context and records every trace that starts in this service. That default suits development and low traffic. At high request rates, a ratio sampler records a fixed fraction of new traces:

```csharp
.WithTracing(tracing => tracing
    .SetSampler(new ParentBasedSampler(new TraceIdRatioBasedSampler(0.1)))
    // ...
```

The parent-based wrapper keeps this service's decision in line with its caller's, so a trace that crosses several services is either recorded in all of them or in none. The `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` environment variables set the same thing without a rebuild. Metrics are recorded separately from traces, so request rates and latency histograms are unaffected by the fraction of traces kept.

### Prometheus Scraping

Prometheus traditionally pulls metrics from an HTTP endpoint on each instance. `OpenTelemetry.Exporter.Prometheus.AspNetCore` provides that endpoint through `app.MapPrometheusScrapingEndpoint()`, but the package has only ever shipped prerelease versions, and its README directs production use to the OTLP exporter. Prometheus can also receive OTLP itself once started with `--web.enable-otlp-receiver`, but only metrics and only over `http/protobuf`, so the all-signals gRPC setup above reaches it through a collector rather than directly.

## Key Takeaways

- A health check reports Healthy, Degraded, or Unhealthy. A thrown exception reports the registration's failure status, and by default only Unhealthy turns into a 503.
- `AddCheck<T>` builds a new instance per run unless `T` is registered in DI, so a check that keeps state across runs, like a cache, has to be a singleton.
- Checks run concurrently and have no timeout unless one is set. Keep them below the probe's timeout, which defaults to 1 second in Kubernetes.
- Liveness checks only the process. Dependencies belong on readiness, where a failure removes the instance from rotation instead of restarting it, and a dependency every instance shares can empty the Service if all of them fail at once.
- A health endpoint is an ordinary endpoint. It sees the fallback authorization policy, it can leak dependency names, and it floods telemetry unless excluded from metrics and traces.
- A background service reports health through a singleton it shares with a check, typically the time of its last successful unit of work.
- HTTP logging needs its log category raised to Information. It redacts headers not on the allowlist, and body logging is for targeted investigation.
- OpenTelemetry collects from .NET's own logging, `ActivitySource`, and `Meter` APIs. A custom source or meter appears only when its name is registered with `AddSource` or `AddMeter`, and metric tags with unbounded values or unsampled traces are what make telemetry expensive.
