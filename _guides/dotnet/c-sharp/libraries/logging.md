---
title: "C# Logging with Microsoft.Extensions.Logging"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How ILogger works: categories, levels and the filter rules that pick them, message templates and structured properties, providers and the console queue, configuration-driven logging with the built-in providers or Serilog, scopes and trace IDs, source-generated LoggerMessage methods, and what not to log."
tags: [logging, ilogger, structured-logging, loggermessage, serilog, observability, practical]
---

## How ILogger Works

`Microsoft.Extensions.Logging` separates the code that writes a log entry from the code that decides where it goes. Application code depends on `ILogger<T>`. **Providers**, registered once at startup, receive every entry and write it somewhere, like the console, the debugger output, or a log service:

{% include figure.html id="dn-logging-fanout" %}

```csharp
public class OrderService(ILogger<OrderService> logger)
{
    public async Task ProcessOrderAsync(Order order, CancellationToken cancellationToken)
    {
        logger.LogInformation("Processing order {OrderId}", order.Id);

        try
        {
            await _payments.ChargeAsync(order, cancellationToken);
            logger.LogInformation("Order {OrderId} completed", order.Id);
        }
        catch (PaymentDeclinedException ex)
        {
            logger.LogWarning(ex, "Payment declined for order {OrderId}", order.Id);
            throw;
        }
    }
}
```

The type argument sets the logger's **category**, the full type name `MyApp.Orders.OrderService`. Categories are how configuration targets a namespace or class, so injecting `ILogger<T>` with the consuming class as `T` is the convention. `ILoggerFactory.CreateLogger("name")` creates a logger with an arbitrary category.

## Log Levels

| Level | Value | Use for |
|---|---|---|
| `Trace` | 0 | Step-by-step detail, like method entry and exit. May contain sensitive values, so never enable it in production by default |
| `Debug` | 1 | Detail useful while developing or diagnosing a specific problem |
| `Information` | 2 | Normal events worth a record, like a request handled or an order placed |
| `Warning` | 3 | Something unexpected that the code handled, like a retry or a fallback |
| `Error` | 4 | An operation failed, and the application carries on |
| `Critical` | 5 | The application or a whole subsystem can't continue |
| `None` | 6 | Used only in configuration, to turn a category off |

A level describes the event, not how much the developer cares about it. A user not found is `Information` or `Warning` depending on whether it's expected, not `Error`. Alerting is usually driven by `Error` and above, so events logged there that nobody needs to act on train people to ignore alerts.

### How the Minimum Level Is Chosen

With no configuration, the minimum level is `Information`, so `LogDebug` and `LogTrace` calls do nothing. The `Logging` section changes that per category:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "MyApp.Orders": "Debug"
    },
    "Console": {
      "LogLevel": {
        "MyApp.Orders": "Information"
      }
    }
  }
}
```

For each entry, the logger picks the single most specific matching rule. A rule under a provider's own section (`Console` here) beats a general one, and among the rest, the longest category prefix wins. So `MyApp.Orders.OrderService` logs at `Debug` to every provider except the console, which gets `Information` and above. Everything else logs at `Information`, except ASP.NET Core's own categories, which log at `Warning`.

Because these are ordinary configuration keys, an environment variable like `Logging__LogLevel__MyApp.Orders=Debug` changes a level for one deployment without a rebuild. JSON files loaded by the default host reload on change, so editing one changes levels in a running process.

## Message Templates

The first argument to a logging method is a **message template**, not a formatted string. Each `{Name}` placeholder is filled from the arguments that follow, and the provider receives the template, the names, and the values separately:

```csharp
logger.LogInformation("User {UserId} purchased {ProductId}", userId, productId);
// Message:    User 123 purchased SKU-456
// Properties: UserId = 123, ProductId = SKU-456, {OriginalFormat} = User {UserId} purchased {ProductId}
```

A provider that writes structured output, like the JSON console formatter or a log service, stores `UserId` and `ProductId` as fields, so a query can find every purchase by one user without parsing text. The template itself also stays constant, which lets a log service group every occurrence of the same event.

### Interpolation Throws the Structure Away

```csharp
logger.LogInformation($"User {userId} purchased {productId}");
```

This produces the same message and no properties. Every call also has a different template, so events can't be grouped, and the string is built even when `Information` is disabled. Analyzer CA2254 flags a template that isn't constant.

### Placeholders Bind by Position

Placeholder names don't have to match the argument names, and they aren't matched by name:

```csharp
logger.LogInformation("Moved {From} to {To}", destination, source);   // From = destination, To = source
```

Arguments fill placeholders in order. A template edited to reorder its placeholders, with the arguments left alone, logs wrong values under the right names. Use PascalCase placeholder names and keep each one consistent across the codebase, since `UserId` in one event and `userID` in another are different fields to a log service.

### Serilog Syntax Is Serilog's

Serilog extends templates with `{@Order}`, which destructures an object into its properties, and `{$Order}`, which forces `ToString()`. The built-in providers don't understand either. They store the value under the key `@Order` and format it with `ToString()`. Code written for Serilog's operators only behaves that way while Serilog is the provider.

## Providers

`Host.CreateApplicationBuilder` and `WebApplication.CreateBuilder` register four providers:

| Provider | Writes to | Notes |
|---|---|---|
| Console | stdout | The one that matters in containers, where the platform collects stdout |
| Debug | The debugger's output window | Only while a debugger is attached |
| EventSource | The `Microsoft-Extensions-Logging` event source | Read on demand by `dotnet-trace` and other diagnostics tools |
| EventLog | The Windows Event Log | Windows only, and `Warning` and above by default |

`builder.Logging.ClearProviders()` removes them all, and `AddConsole()`, `AddDebug()`, and the others add them back individually.

### The Console Provider Is Queued

Writing to a console is slow compared with everything else a request does, so the console provider doesn't write on the calling thread. It puts each entry on a queue that a background thread drains. The queue holds 2,500 entries by default, and when it's full, logging calls **block** until there's room (`QueueFullMode.Wait`). An application that logs faster than stdout can absorb, such as one logging every item in a hot loop, therefore slows down to the speed of its console. `ConsoleLoggerOptions.QueueFullMode = DropWrite` trades that for dropped entries.

In containers, write JSON so the log collector receives fields rather than text:

```json
{
  "Logging": {
    "Console": {
      "FormatterName": "json",
      "FormatterOptions": { "IncludeScopes": true }
    }
  }
}
```

### Serilog and Other Replacement Pipelines

The built-in providers write to one destination each and can't write to files, send to a log service, or enrich entries. Serilog and NLog fill that gap. Both plug in behind `ILogger`, so application code doesn't change.

Serilog routes every entry through its own pipeline of **sinks**, one per destination, and reads that pipeline from configuration:

```csharp
builder.Services.AddSerilog((services, configuration) => configuration
    .ReadFrom.Configuration(builder.Configuration)
    .ReadFrom.Services(services));
```

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": { "Microsoft.AspNetCore": "Warning" }
    },
    "WriteTo": [
      { "Name": "Console", "Args": { "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact" } }
    ],
    "Enrich": [ "FromLogContext" ]
  }
}
```

Each sink and enricher is its own NuGet package, and Serilog's levels and filters live in its own `Serilog` section, not in `Logging`. Serilog replaces the built-in providers rather than running alongside them, so the `Logging:LogLevel` settings stop applying.

`WriteTo` is an array, so an environment-specific file overrides it element by element. `appsettings.Production.json` with a `File` sink at index 0 doesn't add a sink. It merges the file sink's settings into the base file's console entry. Repeat the full array in the override file, or give each sink a named key under `WriteTo` instead of using an array.

### Keep Logging Decisions in Configuration

Levels, formatters, and destinations change more often than the code does, and different environments need different values. Keep them in configuration so the platform can change them per environment without a rebuild. Code needs to register providers, since that decides which assemblies load, but calls like `SetMinimumLevel` or `AddFilter` in `Program.cs` bake a decision into the binary that configuration can then only partly override.

In containers, the simplest arrangement is often enough. The application writes JSON to stdout, and the platform's collector ships it wherever the organization's logs go. The application needs to know about a destination only when the platform can't collect it.

## Scopes and Correlation

A **scope** attaches properties to every entry logged inside it:

```csharp
using (logger.BeginScope(new Dictionary<string, object>
{
    ["OrderId"] = order.Id,
    ["CustomerId"] = order.CustomerId
}))
{
    logger.LogInformation("Validating order");
    await _payments.ChargeAsync(order, cancellationToken);   // Its logs carry OrderId and CustomerId too
    logger.LogInformation("Order charged");
}
```

A scope flows through `await` and into every method called inside it, including other classes' loggers, because it's stored per asynchronous flow rather than per thread. Pass a dictionary for named properties. `BeginScope("Order {OrderId}", id)` works too, with the same template rules as a log call.

Scopes are recorded only by providers that support them and only when enabled. For the console, that's `IncludeScopes`, as in the JSON configuration above.

### Trace and Span IDs

The generic host configures logging to add the current `Activity`'s trace ID, span ID, and parent ID to every entry as a scope. ASP.NET Core starts an `Activity` for each request and continues the caller's trace from the incoming `traceparent` header, and `HttpClient` passes it on to the services it calls. Every entry logged while handling a request, in this service and in the services it calls, carries the same `TraceId`, which is what a log search joins on. Tracing itself, including creating spans with `ActivitySource` and exporting them, belongs to OpenTelemetry and the observability tooling.

A hand-built correlation ID in a scope is only needed where no `Activity` exists, such as a message consumer whose broker doesn't carry trace context.

## Logging Without Wasted Work

A disabled log call still costs something. The call evaluates its arguments, boxes value types into the `params object[]` array, and allocates that array, before the logger discovers the level is off. In most code this doesn't matter. In a hot path it does.

### Source-Generated LoggerMessage Methods

The `[LoggerMessage]` source generator (.NET 6) turns a partial method declaration into a logging method that checks the level first and passes values without boxing:

```csharp
public static partial class OrderLog
{
    [LoggerMessage(EventId = 1000, Level = LogLevel.Information,
        Message = "Processing order {OrderId} for customer {CustomerId}")]
    public static partial void OrderProcessing(ILogger logger, int orderId, string customerId);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Error,
        Message = "Failed to process order {OrderId}")]
    public static partial void OrderFailed(ILogger logger, int orderId, Exception exception);
}

OrderLog.OrderProcessing(logger, order.Id, order.CustomerId);
OrderLog.OrderFailed(logger, order.Id, ex);
```

The generator matches placeholders to parameters by name, ignoring case, and reports a compile error when one has no match. An `Exception` parameter becomes the entry's exception rather than a placeholder. Each method also gets a stable event ID and event name (`OrderProcessing`), which log services can filter on more reliably than message text. Analyzer CA1848 suggests this pattern wherever the `LogInformation`-style extension methods are used.

Arguments are still evaluated at the call site. A generated method avoids the boxing and formatting, but not the cost of computing an expensive argument.

### Guarding Expensive Arguments

When building an argument is itself expensive, check the level first:

```csharp
if (logger.IsEnabled(LogLevel.Debug))
{
    string snapshot = BuildDiagnosticSnapshot(order);
    logger.LogDebug("Order state: {Snapshot}", snapshot);
}
```

Without the guard, `BuildDiagnosticSnapshot` runs on every call, even with `Debug` off.

## Logging in Specific Places

### Before the Host Exists

Code that runs before the host is built has no injected logger. `LoggerFactory.Create` builds a standalone one:

```csharp
using ILoggerFactory loggerFactory = LoggerFactory.Create(b => b.AddConsole());
ILogger logger = loggerFactory.CreateLogger("Startup");
logger.LogInformation("Validating environment");
```

Dispose the factory. The console provider writes from a background queue, and entries still queued when the process exits are lost unless disposing flushes them.

### Background Loops

```csharp
public class OrderSyncWorker(ILogger<OrderSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Order sync failed");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

The exception filter keeps shutdown from being logged as an error. Without it, the cancellation that stops the worker is caught and reported as a sync failure on every shutdown.

### In Tests

`Microsoft.Extensions.Diagnostics.Testing` provides `FakeLogger<T>`, which records every entry with its level, message, exception, and structured properties:

```csharp
var logger = new FakeLogger<OrderService>();
var service = new OrderService(logger);

await service.ProcessOrderAsync(order, CancellationToken.None);

FakeLogRecord last = logger.LatestRecord;
// last.Level, last.Message, last.StructuredState, last.Exception
```

Asserting on the structured properties rather than the message text keeps a test from breaking when someone rewords a message. Code that doesn't need its logs checked can take `NullLogger<T>.Instance`.

## What Not to Log

**Secrets and personal data.** Passwords, tokens, connection strings, card numbers, and personal details end up in a system that more people can read, that keeps data longer, and that is rarely covered by the same controls as the database. Logging a whole request or entity object tends to include such fields by accident, so log the specific fields that are safe. `Microsoft.Extensions.Compliance.Redaction` adds classification-based redaction for teams that need it enforced.

**Every iteration of a hot loop.** A log call per item in a million-item batch can dominate the run time, and with the console queue full it blocks. Log the batch, a count, and any failures.

**An exception as text.** `logger.LogError("Failed: " + ex)` flattens the exception into the message. Pass it as the first argument, `logger.LogError(ex, "Failed to save order {OrderId}", id)`, so providers record the type and stack trace as fields.

**The same failure at every layer.** An exception logged where it's caught, then again by each caller that rethrows it, appears several times per failure. Log it once, where it's handled.

## Key Takeaways

**Use message templates, never interpolation.** Constant templates with named placeholders are what make logs searchable and groupable, and the placeholders bind by position.

**Set levels per category in configuration.** The most specific rule wins, and the default minimum is `Information`.

**Write JSON to stdout in containers,** and remember the console provider blocks when its queue fills.

**Rely on the trace ID the host already adds,** and use scopes for the business identifiers of a unit of work.

**Use `[LoggerMessage]` methods on hot paths,** and guard arguments that are expensive to build.

**Keep secrets and personal data out of logs,** and log each failure once.
