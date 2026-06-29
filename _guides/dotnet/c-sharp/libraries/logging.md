---
title: "C# Logging with Microsoft.Extensions.Logging"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Structured logging with ILogger, log levels, scopes, providers, and high-performance logging patterns."
tags: [c-sharp, dotnet, logging, observability, debugging, practical]
---

## Logging Overview

Microsoft.Extensions.Logging provides a unified logging abstraction used across .NET applications. It supports structured logging, multiple output providers, and integrates with dependency injection.

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public OrderService(ILogger<OrderService> logger)
    {
        _logger = logger;
    }

    public void ProcessOrder(int orderId)
    {
        _logger.LogInformation("Processing order {OrderId}", orderId);

        try
        {
            // Process...
            _logger.LogInformation("Order {OrderId} completed successfully", orderId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
            throw;
        }
    }
}
```

## Log Levels

```csharp
// Levels from least to most severe
_logger.LogTrace("Detailed diagnostic info");      // 0 - Trace
_logger.LogDebug("Debugging information");         // 1 - Debug
_logger.LogInformation("General information");     // 2 - Information
_logger.LogWarning("Something unexpected");        // 3 - Warning
_logger.LogError(ex, "An error occurred");        // 4 - Error
_logger.LogCritical(ex, "System failure");        // 5 - Critical

// Check if level is enabled (avoid expensive operations)
if (_logger.IsEnabled(LogLevel.Debug))
{
    var expensiveData = ComputeDebugInfo();
    _logger.LogDebug("Debug info: {Data}", expensiveData);
}
```

### Log Level Guidelines

| Level | When to Use |
|-------|-------------|
| Trace | Detailed diagnostic info, method entry/exit |
| Debug | Information useful during development |
| Information | General operational events |
| Warning | Unexpected but handled situations |
| Error | Errors that prevent specific operations |
| Critical | Failures requiring immediate attention |

## Structured Logging

Log data as structured properties, not just text.

```csharp
// BAD: Interpolated strings lose structure
_logger.LogInformation($"User {userId} purchased product {productId}");

// GOOD: Structured with named parameters
_logger.LogInformation(
    "User {UserId} purchased product {ProductId}",
    userId, productId);

// Properties become searchable in log systems:
// { "UserId": 123, "ProductId": "SKU-456", "Message": "User 123 purchased..." }

// Complex objects
_logger.LogInformation("Order created: {@Order}", order);  // @ for destructuring
_logger.LogInformation("Order created: {$Order}", order);  // $ for ToString()
```

## Provider Strategies

A logging provider is the component that actually writes log entries somewhere. The `ILogger` abstraction your code depends on never decides where logs go; providers do. Multiple providers can run simultaneously, each receiving the same log entries and routing them to different destinations.

There are three categories of provider to understand.

### Built-in Providers

These ship with `Microsoft.Extensions.Logging` and cover basic scenarios.

| Provider | Destination | Typical Use |
|----------|-------------|-------------|
| Console | stdout/stderr | Container workloads where an orchestrator like Kubernetes captures stdout |
| Debug | `System.Diagnostics.Debug` | Local development only (visible in IDE output windows) |
| EventSource | ETW/EventPipe | .NET diagnostics tooling and performance profiling |
| EventLog | Windows Event Log | Windows services that need OS-level log integration |

Console is by far the most common in production. In containerized environments, writing structured JSON to stdout is the standard pattern because the cluster's log collector (Fluentd, Fluent Bit, the Datadog agent, or similar) picks it up and forwards it to whatever centralized system the platform team has configured. The application itself does not need to know the final destination.

### Third-Party Providers (Serilog, NLog)

When you need to write to multiple destinations simultaneously, apply enrichment, or route logs conditionally, third-party providers like Serilog and NLog replace the built-in pipeline entirely. They integrate through the same `ILogger` interface, so application code does not change.

Serilog is the most widely adopted. It uses a "sink" model where each destination (console, file, Seq, Application Insights, Elasticsearch) is a separate sink, and you can configure as many as you need. NLog uses a similar concept called "targets."

### Custom Providers

For niche requirements (proprietary internal systems, specialized queuing, compliance-specific formatting), you can implement `ILoggerProvider` directly. This is uncommon but the abstraction supports it cleanly.

## Configuration: Config-Driven vs. Code-Driven

In mature systems, logging configuration is almost entirely config-driven. The CI/CD pipeline controls which providers are active, what log levels apply, and where logs go, not the application code. This is the same principle covered in the [Configuration and Options guide](/study-guides/dotnet/c-sharp/libraries/configuration-and-options.html): local files define structural defaults, and environment-specific overrides come from the deployment pipeline.

### Why Config-Driven Matters

Code-driven configuration (calling `AddConsole()`, `SetMinimumLevel()` in C#) bakes decisions into the binary. Changing a log level or adding a provider requires a rebuild and redeploy. Config-driven configuration lets the platform team adjust logging behavior per environment without touching application code.

### Config-Driven with Built-in Providers

The built-in providers are configured entirely through `appsettings.json` and environment-specific overrides.

```json
// appsettings.json — structural defaults
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
```

```json
// appsettings.Development.json — local dev gets more detail
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "MyApp.Services": "Trace"
    },
    "Console": {
      "FormatterName": "simple"
    }
  }
}
```

```json
// appsettings.Production.json — structured JSON for container log collectors
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    },
    "Console": {
      "FormatterName": "json"
    }
  }
}
```

The pipeline sets `ASPNETCORE_ENVIRONMENT` (or `DOTNET_ENVIRONMENT`) and the correct file loads automatically. Environment variables can override individual values on top of that:

```bash
# CI/CD pipeline or Kubernetes manifest can override any value
LOGGING__LOGLEVEL__DEFAULT=Warning
LOGGING__CONSOLE__FORMATTERNAME=json
```

### Config-Driven with Serilog

Serilog's real power shows in config-driven setups. The entire provider pipeline, including sinks, enrichers, and filtering, can live in configuration.

```json
// appsettings.json — Serilog config-driven setup
{
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": { "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact" }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId"]
  }
}
```

```json
// appsettings.Production.json — production adds file and remote sinks
{
  "Serilog": {
    "WriteTo": [
      {
        "Name": "Console",
        "Args": { "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact" }
      },
      {
        "Name": "File",
        "Args": {
          "path": "/var/log/myapp/log-.json",
          "rollingInterval": "Day",
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact"
        }
      },
      {
        "Name": "Seq",
        "Args": { "serverUrl": "http://seq.internal:5341" }
      }
    ]
  }
}
```

The application code that wires this up is minimal and environment-agnostic:

```csharp
// Program.cs — the only code-driven part
builder.Host.UseSerilog((context, config) =>
{
    // Everything comes from configuration; no hardcoded sinks or levels
    config.ReadFrom.Configuration(context.Configuration);
});
```

### When Code-Driven Configuration Makes Sense

Code-driven setup is appropriate in two cases: early startup logging before the configuration system is available, and adding providers that have no config-based integration. Even then, keep it minimal.

```csharp
builder.Logging
    .ClearProviders()
    .AddConsole()
    .AddDebug()
    .SetMinimumLevel(LogLevel.Debug)
    .AddFilter("Microsoft", LogLevel.Warning)
    .AddFilter<ConsoleLoggerProvider>("MyApp", LogLevel.Debug);
```

## Multi-Destination Logging in Practice

Real applications typically need logs flowing to multiple destinations simultaneously. The pattern depends on which provider strategy you choose.

### Built-in Providers: Multiple Destinations

The built-in system supports running multiple providers at once, but each provider is limited to a single destination. You can combine Console (for stdout) with EventSource (for diagnostics tooling) through configuration alone.

```csharp
// Program.cs — register providers; configuration controls their behavior
builder.Logging
    .AddConsole()      // stdout for container log collectors
    .AddEventSourceLogger();  // ETW/EventPipe for diagnostics
    // Level filtering per-provider comes from appsettings.json
```

For anything beyond these built-in destinations (files, remote APIs, queues), you need a third-party provider.

### Serilog: The Multi-Sink Approach

Serilog handles multi-destination logging natively. Each sink operates independently with its own formatting, filtering, and batching.

```csharp
// Program.cs — all sink configuration comes from appsettings.json
builder.Host.UseSerilog((context, config) =>
{
    config.ReadFrom.Configuration(context.Configuration);
});

// That single line gives you access to any combination of sinks:
// - Console with JSON formatting (stdout for Kubernetes)
// - Rolling file sink (local persistence or compliance)
// - Seq, Elasticsearch, or Splunk (centralized log aggregation)
// - Application Insights (Azure-native monitoring)
// - Amazon CloudWatch, Datadog, etc.
//
// Adding or removing a destination is a config change, not a code change.
// The CI/CD pipeline controls which sinks are active per environment.
```

### Choosing the Right Approach

For container workloads where the platform handles log collection, Console with JSON formatting is often sufficient. The application writes to stdout and the infrastructure (Fluentd, Datadog agent, CloudWatch agent) routes logs to the final destination. This keeps the application simple and the platform team in control.

When the application itself needs to write directly to multiple destinations (local files for compliance, a remote API for alerting, stdout for the platform), Serilog's sink model is the standard choice. The entire sink pipeline is config-driven, so the same application binary can write to different destinations across environments without rebuilding.

## Log Scopes

<div class="callout callout--tip">
<p class="callout__title">Use Scopes for Correlation</p>
<p>Log scopes add context to all log entries within a block, such as request IDs, user IDs, or transaction IDs. This makes correlated events searchable across distributed systems.</p>
</div>

Add contextual information to a group of log entries.

```csharp
public async Task ProcessOrderAsync(Order order)
{
    using (_logger.BeginScope(new Dictionary<string, object>
    {
        ["OrderId"] = order.Id,
        ["CustomerId"] = order.CustomerId
    }))
    {
        _logger.LogInformation("Starting order processing");
        await ValidateOrderAsync(order);
        await ChargePaymentAsync(order);
        await FulfillOrderAsync(order);
        _logger.LogInformation("Order processing complete");
    }
    // All logs within scope include OrderId and CustomerId
}

// Simpler scope syntax
using (_logger.BeginScope("Processing order {OrderId}", orderId))
{
    // Logs include OrderId
}
```

### Enable Scope Logging

```json
{
  "Logging": {
    "Console": {
      "IncludeScopes": true
    }
  }
}
```


## High-Performance Logging

### Source-Generated Logging (C# 9+)

Eliminates boxing and parsing overhead at runtime.

```csharp
public static partial class LogMessages
{
    [LoggerMessage(
        EventId = 1000,
        Level = LogLevel.Information,
        Message = "Processing order {OrderId} for customer {CustomerId}")]
    public static partial void OrderProcessing(
        ILogger logger,
        int orderId,
        string customerId);

    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Warning,
        Message = "Order {OrderId} has {ItemCount} items exceeding limit")]
    public static partial void OrderItemsExceeded(
        ILogger logger,
        int orderId,
        int itemCount);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Error,
        Message = "Failed to process order {OrderId}")]
    public static partial void OrderFailed(
        ILogger logger,
        int orderId,
        Exception exception);
}

// Usage
LogMessages.OrderProcessing(_logger, order.Id, order.CustomerId);
LogMessages.OrderFailed(_logger, order.Id, ex);
```

Benefits:
- No boxing of value types
- No string parsing at runtime
- Compile-time validation of parameters
- Better performance when log level is disabled

### Avoid Expensive Operations

```csharp
// BAD: Always evaluates ToString() even if level disabled
_logger.LogDebug("Complex data: " + complexObject.ToString());

// GOOD: Only evaluated if Debug is enabled
_logger.LogDebug("Complex data: {Data}", complexObject);

// BEST: Check level for expensive operations
if (_logger.IsEnabled(LogLevel.Debug))
{
    var debugData = GenerateExpensiveDebugData();
    _logger.LogDebug("Debug data: {Data}", debugData);
}
```


## Correlation and Distributed Tracing

### Activity and Trace Context

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public async Task ProcessOrderAsync(Order order)
    {
        // Activity provides TraceId and SpanId automatically
        using var activity = new Activity("ProcessOrder").Start();

        _logger.LogInformation("Processing order {OrderId}", order.Id);
        // Log includes Activity.Current.TraceId

        await _paymentService.ChargeAsync(order);
        // Payment service logs will share the same TraceId
    }
}
```

### Manual Correlation

```csharp
public async Task HandleRequestAsync(HttpContext context)
{
    var correlationId = context.Request.Headers["X-Correlation-Id"]
        .FirstOrDefault() ?? Guid.NewGuid().ToString();

    using (_logger.BeginScope(new Dictionary<string, object>
    {
        ["CorrelationId"] = correlationId
    }))
    {
        _logger.LogInformation("Handling request");
        // Process request...
    }
}
```

## Logging in Different Contexts

### Static/Startup Logging

```csharp
// Before DI is available
var loggerFactory = LoggerFactory.Create(builder =>
{
    builder.AddConsole();
    builder.SetMinimumLevel(LogLevel.Debug);
});

var logger = loggerFactory.CreateLogger<Program>();
logger.LogInformation("Application starting");
```

### Background Services

```csharp
public class WorkerService : BackgroundService
{
    private readonly ILogger<WorkerService> _logger;

    public WorkerService(ILogger<WorkerService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Worker started");

        while (!ct.IsCancellationRequested)
        {
            using (_logger.BeginScope("Iteration at {Time}", DateTime.UtcNow))
            {
                try
                {
                    await DoWorkAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during work iteration");
                }
            }

            await Task.Delay(TimeSpan.FromMinutes(1), ct);
        }

        _logger.LogInformation("Worker stopped");
    }
}
```

### Testing with Logging

```csharp
public class OrderServiceTests
{
    [Fact]
    public void ProcessOrder_LogsInformation()
    {
        // Arrange
        var logger = new FakeLogger<OrderService>();
        var service = new OrderService(logger);

        // Act
        service.ProcessOrder(123);

        // Assert
        Assert.Contains(logger.LogEntries,
            e => e.LogLevel == LogLevel.Information
              && e.Message.Contains("123"));
    }
}

// Simple fake logger
public class FakeLogger<T> : ILogger<T>
{
    public List<LogEntry> LogEntries { get; } = new();

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
        Exception? exception, Func<TState, Exception?, string> formatter)
    {
        LogEntries.Add(new LogEntry
        {
            LogLevel = logLevel,
            Message = formatter(state, exception),
            Exception = exception
        });
    }

    public bool IsEnabled(LogLevel logLevel) => true;
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        => null;
}
```

## Best Practices

### Message Templates

```csharp
// Use consistent naming
_logger.LogInformation("User {UserId} logged in from {IpAddress}", userId, ip);

// PascalCase for property names
_logger.LogInformation("Processing {ItemCount} items", items.Count);

// Be specific
_logger.LogError(ex, "Failed to save user {UserId} to database {Database}",
    userId, databaseName);
```

### What to Log

```csharp
public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
{
    _logger.LogInformation("Creating order for customer {CustomerId}", request.CustomerId);

    // Log important business events
    var order = new Order(request);
    _logger.LogInformation("Order {OrderId} created with {ItemCount} items, total {Total}",
        order.Id, order.Items.Count, order.Total);

    // Log integration points
    _logger.LogDebug("Sending order {OrderId} to fulfillment service", order.Id);
    await _fulfillmentService.QueueOrderAsync(order);

    // Log completion
    _logger.LogInformation("Order {OrderId} queued for fulfillment", order.Id);

    return order;
}
```

### What NOT to Log

```csharp
// DON'T log sensitive data
_logger.LogInformation("User {Email} with password {Password}");  // NO!
_logger.LogInformation("Credit card {CardNumber}");  // NO!

// DON'T log at wrong levels
_logger.LogError("User not found");  // Should be Warning or Info
_logger.LogInformation("Exception: " + ex);  // Should be Error with exception

// DON'T log too much in hot paths
foreach (var item in millionsOfItems)
{
    _logger.LogDebug("Processing {Item}", item);  // Too much logging
}
```
## Key Takeaways

**Use structured logging**: Pass parameters separately, don't interpolate into message strings.

**Choose appropriate levels**: Information for business events, Warning for handled issues, Error for failures.

**Use source-generated logging**: For high-performance scenarios, eliminate runtime overhead.

**Add context with scopes**: Group related logs with correlation IDs and contextual data.

**Don't log sensitive data**: Never log passwords, tokens, credit cards, or PII.

**Consider log volume**: Trace and Debug levels can be extremely verbose. Use IsEnabled checks for expensive operations.

**Test your logging**: Verify critical events are logged correctly with fake loggers in tests.
