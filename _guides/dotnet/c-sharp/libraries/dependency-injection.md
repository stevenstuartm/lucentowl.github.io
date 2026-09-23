---
title: "C# Dependency Injection"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How the Microsoft.Extensions.DependencyInjection container builds object graphs: registration, the root provider and scopes, transient, scoped, and singleton lifetimes, captive dependencies and the validation that catches them, keyed services, runtime parameters, disposal, and decorators."
tags: [dependency-injection, service-lifetimes, captive-dependencies, keyed-services, iservicecollection, ioc, practical]
---

## What a Container Does

A class that creates its own dependencies is tied to them. `OrderService` below can only ever save to SQL, and a test of it hits a database:

```csharp
// Creates its own dependency
public class OrderService
{
    private readonly SqlOrderRepository _repository = new SqlOrderRepository();

    public void PlaceOrder(Order order) => _repository.Save(order);
}

// Receives its dependency
public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public void PlaceOrder(Order order) => _repository.Save(order);
}
```

The second version says what it needs and leaves the choice to whoever constructs it. That is dependency injection, and it works without any library. The trouble comes at the top of the application, where someone has to build the whole graph: `OrderService` needs a repository, the repository needs a `DbContext`, the context needs options, and so on for hundreds of types. A DI container does that construction. It has three jobs:

- **Registration.** You describe each service once: which type is requested, which type or factory provides it, and how long an instance should live.
- **Resolution.** When something asks for a service, the container reads the provider's constructor, resolves each parameter the same way, and builds the graph from the leaves up.
- **Lifetime and disposal.** The container decides when to reuse an instance and when to make a new one, and it disposes what it created when the owning scope ends.

The container is for services, the long-lived collaborators that do work. Entities, DTOs, and values like an order ID are data, and they travel through method parameters. A class that asks the container for an `Order` has confused the two.

### IServiceCollection and IServiceProvider

`Microsoft.Extensions.DependencyInjection` is the container built into .NET. Registration happens on an `IServiceCollection`, which is only a list of `ServiceDescriptor` entries. Building it produces an `IServiceProvider`, which does the resolving:

```csharp
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();

services.AddTransient<IEmailService, SmtpEmailService>();
services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddSingleton<IClock, SystemClock>();

using ServiceProvider provider = services.BuildServiceProvider();

var email = provider.GetRequiredService<IEmailService>();  // Throws if not registered
var clock = provider.GetService<IClock>();                 // Returns null if not registered
```

Building takes a snapshot. A registration added to the collection after `BuildServiceProvider` is never seen by that provider.

### Inside the Generic Host

Most applications never build a provider by hand. The generic host and ASP.NET Core own the collection, build the provider when the app starts, and resolve your types for you, whether controllers, endpoint handlers, or hosted services:

```csharp
// Worker service or console app
var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<OrderSyncWorker>();
builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Build().Run();

// ASP.NET Core
var webBuilder = WebApplication.CreateBuilder(args);
webBuilder.Services.AddScoped<IOrderService, OrderService>();
var app = webBuilder.Build();
```

After `Build()`, the host's service collection is read-only, and adding to it throws.

## Where Instances Live: The Root Provider and Scopes

Lifetimes only make sense once you know who holds each instance. The provider you build is the **root provider**. It can create **scopes**, each of which is a child provider with its own cache. ASP.NET Core creates one scope per HTTP request. Everywhere else, you create them.

{% include figure.html id="dn-di-scopes" %}

When a scope is disposed, it disposes every `IDisposable` or `IAsyncDisposable` instance it created, in reverse order of creation. When the root is disposed, it does the same for singletons and for anything resolved directly from it. Every lifetime rule and every lifetime bug in this guide follows from this picture.

## Service Lifetimes

### Transient

A new instance on every resolution:

```csharp
services.AddTransient<IPriceCalculator, PriceCalculator>();

var a = provider.GetRequiredService<IPriceCalculator>();
var b = provider.GetRequiredService<IPriceCalculator>();
// a != b
```

Transient suits lightweight, stateless services. Because each consumer gets its own instance, nothing is shared and thread safety rarely comes up. The cost is an allocation per resolution, which tends to matter only for services resolved at very high rates.

A transient that implements `IDisposable` is still tracked by whichever provider resolved it, so the container can dispose it later. Resolved from a scope, it's released when the scope ends. Resolved from the root provider, it's held until the application shuts down. Resolving one from the root in a loop keeps every instance alive, which is a memory leak that grows with each call:

```csharp
services.AddTransient<ReportExporter>();  // ReportExporter : IDisposable

for (int i = 0; i < 3; i++)
    provider.GetRequiredService<ReportExporter>();
// None of the three is disposed or collectable until the root provider is disposed
```

### Scoped

One instance per scope:

```csharp
services.AddScoped<IOrderRepository, SqlOrderRepository>();

using (var scope = provider.CreateScope())
{
    var r1 = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
    var r2 = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
    // r1 == r2
}

using (var scope = provider.CreateScope())
{
    var r3 = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
    // r3 is a different instance from r1
}
```

Scoped is for state that should be shared within one unit of work and isolated between units. A `DbContext` is the standard case. Every repository that handles one request should see the same change tracker so the request's changes save together, and no request should see another's unsaved changes. `AddDbContext` registers the context as scoped for this reason.

ASP.NET Core creates the scope for each request. A background service, a message handler, or a console app has no such scope, so it has to create one per unit of work (see [Scopes and Disposal](#scopes-and-disposal)).

A scoped service resolved from the root provider has no scope to belong to. With scope validation off, the root hands back the same instance every time, so the service silently behaves as a singleton. With validation on, the resolution throws `Cannot resolve scoped service ... from root provider`.

### Singleton

One instance for the lifetime of the root provider:

```csharp
services.AddSingleton<IClock, SystemClock>();

var c1 = provider.GetRequiredService<IClock>();
var c2 = scope.ServiceProvider.GetRequiredService<IClock>();
// c1 == c2, from the root or from any scope
```

Singletons suit services that are expensive to create or naturally shared, such as caches, clients that pool connections, and in-memory lookups loaded once. Every request uses the same instance concurrently, so a singleton must be thread-safe, and any mutable state it holds needs synchronization.

### Lifetime Summary

| Lifetime | New instance | Held and disposed by |
|---|---|---|
| Transient | Every resolution | The provider that resolved it, if it's disposable: the scope, or the root |
| Scoped | Once per scope | The scope |
| Singleton | Once per root provider | The root provider, unless you registered an existing instance |

## Captive Dependencies

A service can only depend safely on services that live at least as long as it does. When a longer-lived service holds a shorter-lived one, the shorter-lived instance is captured and lives as long as its holder:

```csharp
services.AddSingleton<PricingCache>();        // Lives for the whole app
services.AddScoped<IOrderRepository, SqlOrderRepository>();

public class PricingCache
{
    // Captured: this repository, and the DbContext inside it, now serve
    // every request for the life of the app, from multiple threads at once
    public PricingCache(IOrderRepository repository) { }
}
```

The first request's repository is the only one the cache ever sees. Its `DbContext` is not thread-safe, accumulates tracked entities indefinitely, and keeps a connection it was meant to release at the end of a request. The bug tends to surface only under concurrent load.

The container detects a singleton that depends on a scoped service when scope validation is on (see [Validation](#validation)). It does not detect a singleton that depends on a transient. That transient is created once, when the singleton is, and lives just as long, with no error or warning. A transient that holds per-operation state or a disposable resource becomes a captive dependency too.

A singleton that needs a scoped service must create a scope for each unit of work rather than holding the service:

```csharp
public class PricingCache
{
    private readonly IServiceScopeFactory _scopeFactory;

    public PricingCache(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task RefreshAsync()
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
        // Load prices; the repository and its DbContext are disposed with the scope
    }
}
```

Injecting `IServiceProvider` into a singleton doesn't help. A singleton receives the root provider, so resolving a scoped service from it hits the same root-provider problem described under [Scoped](#scoped).

Options have lifetimes too. `IOptionsSnapshot<T>` is scoped, so a singleton can't take it. Use `IOptions<T>` or `IOptionsMonitor<T>` there.

## Validation

Two `ServiceProviderOptions` settings catch lifetime and registration mistakes:

| Option | What it checks |
|---|---|
| `ValidateScopes` | A scoped service resolved from the root provider, and a singleton that depends on a scoped service |
| `ValidateOnBuild` | Every registration can be constructed, checked when the provider is built instead of at first use |

On their own, the scope checks run only when a service is resolved, so a captive dependency in a rarely used service surfaces late. With both enabled, the provider walks every constructor-based registration at build time and throws an `AggregateException` listing every service it can't construct, including captive scoped dependencies. `ValidateOnBuild` without `ValidateScopes` builds the captive example above without complaint.

The generic host and ASP.NET Core turn both on when the environment is `Development` and leave both off otherwise. A provider built by hand with `BuildServiceProvider()` has both off. Enable them explicitly for any hand-built provider, and in a test that builds the application's real registrations:

```csharp
var provider = services.BuildServiceProvider(new ServiceProviderOptions
{
    ValidateScopes = true,
    ValidateOnBuild = true
});
```

Validation is limited to what the container can see. It reads constructors, not the bodies of factory delegates, so a factory that calls `GetRequiredService` for something unregistered passes validation and throws on first resolution. It also can't flag the transient-in-singleton case, since that's legal.

## Registration

### Registration Forms

```csharp
// Interface to implementation
services.AddScoped<IOrderRepository, SqlOrderRepository>();

// Concrete type, resolved as itself
services.AddTransient<InvoiceRenderer>();

// Factory delegate, for construction logic the container can't infer
services.AddSingleton<IBlobStore>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<BlobSettings>>().Value;
    return new AzureBlobStore(settings.ConnectionString);
});

// Existing instance
services.AddSingleton<IClock>(new FixedClock(new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero)));
```

A factory receives the provider doing the resolving, which is the scope's provider for a scoped or transient service resolved in a scope, and the root for a singleton. An existing instance is always a singleton, and the container never disposes it, because the container didn't create it. The code that created the instance owns its disposal.

### Open Generics

A generic service can be registered once for every type argument:

```csharp
services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));

// Resolving IRepository<Order> constructs EfRepository<Order>
```

This is how `ILogger<T>` works. The logging registration maps `ILogger<>` to `Logger<>`, and every `ILogger<OrderService>` is closed on demand.

### Multiple Implementations

Registering the same service type more than once keeps every registration:

```csharp
services.AddTransient<INotifier, EmailNotifier>();
services.AddTransient<INotifier, SmsNotifier>();
services.AddTransient<INotifier, PushNotifier>();

public class NotificationService
{
    private readonly IEnumerable<INotifier> _notifiers;  // All three, in registration order

    public NotificationService(IEnumerable<INotifier> notifiers)
    {
        _notifiers = notifiers;
    }
}

var notifier = provider.GetRequiredService<INotifier>();  // PushNotifier: last registration wins
```

"Last wins" is what lets an application override a library's default. The library registers its implementation, the application registers its own afterward, and a single-service resolution returns the application's.

### Keyed Services

.NET 8 added keys, so one service type can have several implementations that consumers select by name:

```csharp
services.AddKeyedTransient<INotifier, EmailNotifier>("email");
services.AddKeyedTransient<INotifier, SmsNotifier>("sms");

public class AlertService
{
    private readonly INotifier _notifier;

    public AlertService([FromKeyedServices("sms")] INotifier notifier)
    {
        _notifier = notifier;
    }
}

var email = provider.GetRequiredKeyedService<INotifier>("email");
```

Keyed and unkeyed registrations are separate. With only the keyed registrations above, `GetService<INotifier>()` returns `null` and `IEnumerable<INotifier>` is empty. Keys replace the older workaround of a `Func<string, INotifier>` factory with a `switch` inside.

### TryAdd, Replace, and RemoveAll

These live in the `Microsoft.Extensions.DependencyInjection.Extensions` namespace, which a file has to import separately:

```csharp
using Microsoft.Extensions.DependencyInjection.Extensions;

// Registers only if nothing is registered for IClock yet
services.TryAddSingleton<IClock, SystemClock>();

// Registers only if this exact implementation type isn't already registered for INotifier
services.TryAddEnumerable(ServiceDescriptor.Transient<INotifier, EmailNotifier>());

// Removes the first INotifier registration and appends this one
services.Replace(ServiceDescriptor.Transient<INotifier, PushNotifier>());

// Removes every INotifier registration
services.RemoveAll<INotifier>();
```

`TryAdd` is the library author's tool. A library that registers defaults with `TryAdd` lets an application that registered its own implementation first keep it. `TryAddEnumerable` compares implementation types only, so adding `EmailNotifier` again as a singleton is still skipped. `Replace` removes only the first matching registration, so with three `INotifier` registrations it leaves two and adds one at the end. Use `RemoveAll` followed by an `Add` to replace all of them.

### Grouping Registrations

Extension methods on `IServiceCollection` keep `Program.cs` readable and give each feature or library one entry point:

```csharp
public static class OrderingServiceCollectionExtensions
{
    public static IServiceCollection AddOrdering(this IServiceCollection services)
    {
        services.AddScoped<IOrderRepository, SqlOrderRepository>();
        services.AddScoped<IOrderService, OrderService>();
        services.TryAddSingleton<IClock, SystemClock>();
        return services;
    }
}

builder.Services.AddOrdering().AddNotifications();
```

## Constructor Injection

Constructor parameters are the primary way a service receives its dependencies. The constructor then documents everything the class needs, the object can't exist half-built, and a test can construct it directly with fakes and no container:

```csharp
public class OrderService : IOrderService
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _email;
    private readonly ILogger<OrderService> _logger;

    public OrderService(IOrderRepository repository, IEmailService email, ILogger<OrderService> logger)
    {
        _repository = repository;
        _email = email;
        _logger = logger;
    }
}
```

A constructor that keeps growing is a design signal. A class with eight dependencies usually has more than one job.

### Primary Constructors

A C# 12 primary constructor removes the field boilerplate:

```csharp
public class OrderService(IOrderRepository repository, ILogger<OrderService> logger) : IOrderService
{
    public Task PlaceOrderAsync(Order order)
    {
        logger.LogInformation("Placing order {OrderId}", order.Id);
        return repository.SaveAsync(order);
    }
}
```

The parameters are captured into hidden mutable fields, not `readonly` ones, so nothing stops a method from reassigning `repository`. Teams that want the guarantee assign each parameter to an explicit `readonly` field instead.

### How the Container Picks a Constructor

When a type has more than one public constructor, the container chooses the one with the most parameters it can resolve. If two constructors tie, it throws `InvalidOperationException` saying the constructors are ambiguous. A type designed for the container should have one public constructor, which avoids the question.

## Runtime Parameters

Some services need a value known only at call time, like a report type or a tenant ID, alongside dependencies the container provides. The container can't supply the runtime value, so something has to combine the two.

`ActivatorUtilities.CreateInstance` does that. It fills constructor parameters from the arguments you pass and resolves the rest from a provider:

```csharp
public class ReportGenerator(string reportType, IReportDataSource dataSource) { }

public class ReportGeneratorFactory(IServiceProvider provider)
{
    public ReportGenerator Create(string reportType) =>
        ActivatorUtilities.CreateInstance<ReportGenerator>(provider, reportType);
}

services.AddScoped<IReportDataSource, SqlReportDataSource>();
services.AddScoped<ReportGeneratorFactory>();
```

Register the factory with the shortest lifetime of anything it resolves. As a singleton, this factory would receive the root provider, and resolving the scoped data source from it would hit the root-provider problem.

The built-in container doesn't synthesize `Func<T>` or `Lazy<T>` for registered services the way some third-party containers do. Asking for `Func<ReportGenerator>` without registering it fails to resolve. A delegate factory works only if you register the delegate yourself.

### The Service Locator Anti-Pattern

A class that takes `IServiceProvider` and resolves its dependencies inside methods hides what it needs:

```csharp
public class OrderService(IServiceProvider provider)
{
    public Task PlaceOrderAsync(Order order)
    {
        var repository = provider.GetRequiredService<IOrderRepository>();  // Hidden dependency
        return repository.SaveAsync(order);
    }
}
```

The constructor no longer tells a reader or a test what the class uses, and a missing registration surfaces at the call rather than at startup, because validation can't see inside methods. Resolving from a provider is legitimate in infrastructure code whose job is to create things, like the factory above or the scope-per-message loop in a background worker. In a business service, it's a missing constructor parameter.

## Scopes and Disposal

### Creating Scopes

Outside a web request, create a scope per unit of work, such as one message, one job, or one iteration of a polling loop:

```csharp
using (var scope = provider.CreateScope())
{
    var processor = scope.ServiceProvider.GetRequiredService<IOrderProcessor>();
    processor.Process(order);
}   // Disposes the scope's disposable instances, in reverse order of creation

await using (var scope = provider.CreateAsyncScope())
{
    var processor = scope.ServiceProvider.GetRequiredService<IOrderProcessor>();
    await processor.ProcessAsync(order);
}
```

Prefer `CreateAsyncScope` (.NET 6) whenever the calling code is async. A scope disposed synchronously that contains a service implementing only `IAsyncDisposable` throws `InvalidOperationException` ("type only implements IAsyncDisposable. Use DisposeAsync to dispose the container"). A service implementing both interfaces is disposed through whichever one the scope was disposed with.

### What the Container Disposes

The container disposes what it created and nothing else. Instances built by constructor or by factory delegate are disposed with their owning scope or the root. Instances passed in with `AddSingleton(instance)` are not.

Don't dispose a resolved service yourself. Another consumer in the same scope may hold the same scoped instance, and a singleton is shared by everything. Disposal belongs to the scope, so end the scope instead.

## Decorators

A decorator wraps an implementation to add behavior, like logging, caching, or retries, without changing it. The pattern itself belongs to design patterns. The DI question is how to register it, because the decorator and the inner service implement the same interface, and registering both as `IOrderService` would make the decorator depend on itself:

```csharp
public class LoggingOrderService(IOrderService inner, ILogger<LoggingOrderService> logger) : IOrderService
{
    public async Task PlaceOrderAsync(Order order)
    {
        logger.LogInformation("Placing order {OrderId}", order.Id);
        await inner.PlaceOrderAsync(order);
        logger.LogInformation("Order {OrderId} placed", order.Id);
    }
}

// Register the inner implementation as its concrete type,
// then register the interface as a factory that wraps it
services.AddScoped<OrderService>();
services.AddScoped<IOrderService>(sp =>
    ActivatorUtilities.CreateInstance<LoggingOrderService>(sp, sp.GetRequiredService<OrderService>()));
```

The built-in container has no decoration API, so each decorator needs a factory like this one. The [Scrutor](https://github.com/khellang/Scrutor){:target="_blank" rel="noopener noreferrer"} library adds a `Decorate` extension method that does the same wrapping, along with assembly scanning for registrations.

## Key Takeaways

**The root provider and its scopes decide everything.** Singletons live in the root, scoped instances live in a scope, and disposable transients live in whichever provider resolved them.

**Depend only on services that live at least as long as you do.** Validation catches a singleton holding a scoped service. Nothing catches a singleton holding a transient.

**Keep validation on wherever it's off by default.** The host enables it only in `Development`, and a hand-built provider never does.

**Create a scope per unit of work outside web requests,** and let disposing the scope dispose what's in it.

**Take dependencies through the constructor.** Resolving from `IServiceProvider` belongs in factories and infrastructure, not in business logic.

**Use `TryAdd` in libraries and keys for named variants,** so applications can override defaults and select implementations without a hand-written switch.
