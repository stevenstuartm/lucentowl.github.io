---
title: "C# Dependency Injection"
layout: guide
category: ".NET & C#"
subcategory: "Libraries & Frameworks"
description: "Microsoft.Extensions.DependencyInjection, service lifetimes, registration patterns, and DI best practices."
tags: [c-sharp, dotnet, dependency-injection, ioc, design-patterns, architecture, practical]
---

## What is Dependency Injection

```csharp
// Without DI - tightly coupled
public class OrderService
{
    private readonly SqlOrderRepository _repository = new SqlOrderRepository();

    public void PlaceOrder(Order order)
    {
        _repository.Save(order);
    }
}

// With DI - loosely coupled
public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;  // Injected dependency
    }

    public void PlaceOrder(Order order)
    {
        _repository.Save(order);
    }
}
```

## Microsoft.Extensions.DependencyInjection

The built-in DI container for .NET applications.

### Basic Setup

```csharp
using Microsoft.Extensions.DependencyInjection;

// Create container
var services = new ServiceCollection();

// Register services
services.AddTransient<IEmailService, EmailService>();
services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddSingleton<IConfiguration, AppConfiguration>();

// Build provider
IServiceProvider provider = services.BuildServiceProvider();

// Resolve services
var emailService = provider.GetRequiredService<IEmailService>();
var orderRepo = provider.GetService<IOrderRepository>();  // Returns null if not found
```

### In ASP.NET Core / .NET Generic Host

```csharp
// Program.cs (minimal API)
var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

var app = builder.Build();

// Services are injected automatically into controllers, handlers, etc.

// Worker service
Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddHostedService<BackgroundWorker>();
        services.AddScoped<IDataProcessor, DataProcessor>();
    });
```

## Service Lifetimes

<div class="callout callout--warning">
<p class="callout__title">Lifetime Choice Matters</p>
<p>Choosing the wrong lifetime causes subtle bugs that surface under load or in production. Understanding why each lifetime exists helps you make the right choice.</p>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Transient</h4>
<p>New instance created every time requested.</p>
<ul>
<li><strong>Use for:</strong> Lightweight, stateless services</li>
<li><strong>Why:</strong> Avoids thread-safety concerns entirely</li>
<li><strong>Trade-off:</strong> More allocations and GC pressure</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Scoped</h4>
<p>One instance per scope (e.g., per HTTP request).</p>
<ul>
<li><strong>Use for:</strong> Database contexts, unit of work</li>
<li><strong>Why:</strong> Share state within request, isolate across requests</li>
<li><strong>Trade-off:</strong> Requires explicit scope creation in console apps</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>Singleton</h4>
<p>Single instance for application lifetime.</p>
<ul>
<li><strong>Use for:</strong> Caches, configuration, connection pools</li>
<li><strong>Why:</strong> Expensive to create or naturally shared</li>
<li><strong>Trade-off:</strong> Must be thread-safe; watch for captive dependencies</li>
</ul>
</div>
</div>

### Transient

New instance created every time the service is requested.

```csharp
services.AddTransient<IService, Service>();

// Every GetService call returns new instance
var service1 = provider.GetRequiredService<IService>();
var service2 = provider.GetRequiredService<IService>();
// service1 != service2
```

**Use for**: Lightweight, stateless services. Operations that shouldn't share state.

**Why transient**: When a service has no shared state, creating new instances avoids thread-safety concerns entirely. Each consumer gets its own instance, so there's no risk of one component's usage affecting another.

**Trade-off**: More allocations and GC pressure compared to longer-lived services. For services used thousands of times per second, this overhead matters.

### Scoped

One instance per scope (e.g., per HTTP request in web apps).

```csharp
services.AddScoped<IDbContext, AppDbContext>();

// Same instance within a scope
using var scope = provider.CreateScope();
var ctx1 = scope.ServiceProvider.GetRequiredService<IDbContext>();
var ctx2 = scope.ServiceProvider.GetRequiredService<IDbContext>();
// ctx1 == ctx2

// New scope = new instance
using var scope2 = provider.CreateScope();
var ctx3 = scope2.ServiceProvider.GetRequiredService<IDbContext>();
// ctx3 != ctx1
```

**Use for**: Services that should share state within a request/operation but not across them. Database contexts, unit of work patterns.

**Why scoped**: Database contexts track entities and accumulate changes. You want all repository calls within a request to share the same context so they participate in the same unit of work and can be committed together. But you don't want one user's request to see another user's uncommitted changes, so each request gets its own instance.

**Trade-off**: Scoped services require explicit scope creation in background services and console apps. In web apps, the framework creates a scope per request automatically.

### Singleton

Single instance for the application lifetime.

```csharp
services.AddSingleton<IConfigService, ConfigService>();

// Always returns same instance
var config1 = provider.GetRequiredService<IConfigService>();
var config2 = provider.GetRequiredService<IConfigService>();
// config1 == config2
```

**Use for**: Stateless services, caches, configuration, connection pools. Must be thread-safe.

**Why singleton**: Some resources are expensive to create (HTTP clients, database connection pools) or naturally shared (configuration). Creating one instance and reusing it avoids repeated initialization costs.

**Trade-off**: Singletons must be thread-safe since they're shared across all requests concurrently. Any mutable state needs synchronization. The most common mistake is injecting a scoped service into a singleton. The scoped service becomes a "captive dependency" that lives forever instead of being disposed per request.

### Lifetime Comparison

| Lifetime | Instance Created | Disposed |
|----------|-----------------|----------|
| Transient | Every request | When scope ends |
| Scoped | Once per scope | When scope ends |
| Singleton | Once ever | When container disposed |

## Registration Patterns

### Basic Registration

```csharp
// Interface to implementation
services.AddTransient<IService, ServiceImplementation>();

// Concrete type (no interface)
services.AddTransient<ConcreteService>();

// Factory delegate
services.AddTransient<IService>(provider =>
{
    var config = provider.GetRequiredService<IConfiguration>();
    return new ServiceImplementation(config["Setting"]);
});

// Existing instance (always singleton behavior)
var instance = new ConfigService();
services.AddSingleton<IConfigService>(instance);
```

### Multiple Implementations

```csharp
// Register multiple implementations
services.AddTransient<INotifier, EmailNotifier>();
services.AddTransient<INotifier, SmsNotifier>();
services.AddTransient<INotifier, PushNotifier>();

// Inject all implementations
public class NotificationService
{
    private readonly IEnumerable<INotifier> _notifiers;

    public NotificationService(IEnumerable<INotifier> notifiers)
    {
        _notifiers = notifiers;  // All three implementations
    }

    public async Task NotifyAll(string message)
    {
        foreach (var notifier in _notifiers)
        {
            await notifier.SendAsync(message);
        }
    }
}

// GetRequiredService returns LAST registered
var notifier = provider.GetRequiredService<INotifier>();  // PushNotifier
```

### Keyed Services (.NET 8)

```csharp
// Register with keys
services.AddKeyedTransient<INotifier, EmailNotifier>("email");
services.AddKeyedTransient<INotifier, SmsNotifier>("sms");

// Inject by key
public class NotificationService
{
    private readonly INotifier _emailNotifier;
    private readonly INotifier _smsNotifier;

    public NotificationService(
        [FromKeyedServices("email")] INotifier emailNotifier,
        [FromKeyedServices("sms")] INotifier smsNotifier)
    {
        _emailNotifier = emailNotifier;
        _smsNotifier = smsNotifier;
    }
}

// Resolve by key
var email = provider.GetRequiredKeyedService<INotifier>("email");
```

### TryAdd Methods

Only register if not already registered.

```csharp
// Only adds if IService not registered
services.TryAddTransient<IService, DefaultService>();
services.TryAddScoped<IService, DefaultService>();
services.TryAddSingleton<IService, DefaultService>();

// Only adds specific implementation if not registered
services.TryAddEnumerable(ServiceDescriptor.Transient<INotifier, EmailNotifier>());
```

### Replace and Remove

```csharp
// Replace existing registration
services.Replace(ServiceDescriptor.Transient<IService, NewService>());

// Remove all registrations for a type
services.RemoveAll<IService>();
```

## Constructor Injection

The primary and recommended injection pattern.

```csharp
public class OrderService : IOrderService
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository repository,
        IEmailService emailService,
        ILogger<OrderService> logger)
    {
        _repository = repository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task PlaceOrderAsync(Order order)
    {
        _logger.LogInformation("Placing order {OrderId}", order.Id);
        await _repository.SaveAsync(order);
        await _emailService.SendConfirmationAsync(order.CustomerEmail);
    }
}

// Registration
services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddTransient<IEmailService, SmtpEmailService>();
services.AddScoped<IOrderService, OrderService>();
```

## Options Pattern

Inject configuration sections as strongly-typed objects.

```csharp
// Configuration class
public class EmailSettings
{
    public string SmtpServer { get; set; } = "";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

// appsettings.json
{
    "EmailSettings": {
        "SmtpServer": "smtp.example.com",
        "Port": 587,
        "Username": "user@example.com",
        "Password": "secret"
    }
}

// Registration
services.Configure<EmailSettings>(configuration.GetSection("EmailSettings"));

// Injection
public class EmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }
}

// IOptionsSnapshot - reloads on change (scoped)
public EmailService(IOptionsSnapshot<EmailSettings> options)
{
    _settings = options.Value;  // Fresh on each request
}

// IOptionsMonitor - reloads on change with notification (singleton-safe)
public class EmailService
{
    private EmailSettings _settings;

    public EmailService(IOptionsMonitor<EmailSettings> optionsMonitor)
    {
        _settings = optionsMonitor.CurrentValue;
        optionsMonitor.OnChange(newSettings => _settings = newSettings);
    }
}
```

## Factory Patterns

### Typed Factories

```csharp
// Service that needs runtime parameters
public class ReportGenerator
{
    private readonly string _reportType;
    private readonly IDataSource _dataSource;

    public ReportGenerator(string reportType, IDataSource dataSource)
    {
        _reportType = reportType;
        _dataSource = dataSource;
    }
}

// Factory interface
public interface IReportGeneratorFactory
{
    ReportGenerator Create(string reportType);
}

// Factory implementation
public class ReportGeneratorFactory : IReportGeneratorFactory
{
    private readonly IServiceProvider _serviceProvider;

    public ReportGeneratorFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public ReportGenerator Create(string reportType)
    {
        var dataSource = _serviceProvider.GetRequiredService<IDataSource>();
        return new ReportGenerator(reportType, dataSource);
    }
}

// Registration
services.AddTransient<IDataSource, SqlDataSource>();
services.AddSingleton<IReportGeneratorFactory, ReportGeneratorFactory>();
```

### Func<T> Factories

```csharp
// Register factory delegate
services.AddTransient<Func<string, IPaymentProcessor>>(provider => key =>
{
    return key switch
    {
        "stripe" => provider.GetRequiredService<StripeProcessor>(),
        "paypal" => provider.GetRequiredService<PayPalProcessor>(),
        _ => throw new ArgumentException($"Unknown payment processor: {key}")
    };
});

// Inject and use
public class CheckoutService
{
    private readonly Func<string, IPaymentProcessor> _processorFactory;

    public CheckoutService(Func<string, IPaymentProcessor> processorFactory)
    {
        _processorFactory = processorFactory;
    }

    public async Task ProcessPayment(string method, Payment payment)
    {
        var processor = _processorFactory(method);
        await processor.ProcessAsync(payment);
    }
}
```

## Scopes and Disposal

### Creating Scopes

```csharp
// Manual scope creation
using (var scope = provider.CreateScope())
{
    var service = scope.ServiceProvider.GetRequiredService<IScopedService>();
    await service.DoWorkAsync();
}  // scope.Dispose() called - disposes scoped services

// Async scope
await using (var scope = provider.CreateAsyncScope())
{
    var service = scope.ServiceProvider.GetRequiredService<IScopedService>();
    await service.DoWorkAsync();
}
```

### IDisposable Services

The container automatically disposes services that implement IDisposable.

```csharp
public class DatabaseConnection : IDisposable
{
    public void Dispose()
    {
        // Cleanup connection
    }
}

// Transient/Scoped - disposed when scope ends
// Singleton - disposed when container disposed
services.AddScoped<DatabaseConnection>();
```

### IAsyncDisposable

```csharp
public class AsyncResource : IAsyncDisposable
{
    public async ValueTask DisposeAsync()
    {
        await CleanupAsync();
    }
}

// Proper async disposal
await using var scope = provider.CreateAsyncScope();
```

## Validation

### Validate on Build

```csharp
var services = new ServiceCollection();
services.AddScoped<IService, Service>();

// Validate registrations
var options = new ServiceProviderOptions
{
    ValidateScopes = true,          // Catch scope issues
    ValidateOnBuild = true          // Validate all registrations
};

var provider = services.BuildServiceProvider(options);

// In ASP.NET Core (development)
builder.Host.UseDefaultServiceProvider((context, options) =>
{
    options.ValidateScopes = context.HostingEnvironment.IsDevelopment();
    options.ValidateOnBuild = context.HostingEnvironment.IsDevelopment();
});
```

### Common Validation Errors

```csharp
// Error: Scoped service from singleton
services.AddSingleton<SingletonService>();
services.AddScoped<ScopedService>();

public class SingletonService
{
    // WRONG: Captive dependency - scoped in singleton
    public SingletonService(ScopedService scoped) { }
}

// Fix: Use factory or IServiceScopeFactory
public class SingletonService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public SingletonService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public void DoWork()
    {
        using var scope = _scopeFactory.CreateScope();
        var scoped = scope.ServiceProvider.GetRequiredService<ScopedService>();
        scoped.Process();
    }
}
```

## Extension Methods for Clean Registration

```csharp
// Group related registrations
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddOrderingServices(this IServiceCollection services)
    {
        services.AddScoped<IOrderRepository, SqlOrderRepository>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddTransient<IOrderValidator, OrderValidator>();
        return services;
    }

    public static IServiceCollection AddNotificationServices(this IServiceCollection services)
    {
        services.AddTransient<IEmailService, SmtpEmailService>();
        services.AddTransient<ISmsService, TwilioSmsService>();
        services.AddTransient<INotificationService, NotificationService>();
        return services;
    }
}

// Usage
services.AddOrderingServices()
        .AddNotificationServices();
```

## Decorator Pattern

```csharp
// Original service
public class OrderService : IOrderService
{
    public Task PlaceOrderAsync(Order order) { }
}

// Decorator adds behavior
public class LoggingOrderService : IOrderService
{
    private readonly IOrderService _inner;
    private readonly ILogger<LoggingOrderService> _logger;

    public LoggingOrderService(IOrderService inner, ILogger<LoggingOrderService> logger)
    {
        _inner = inner;
        _logger = logger;
    }

    public async Task PlaceOrderAsync(Order order)
    {
        _logger.LogInformation("Placing order {OrderId}", order.Id);
        await _inner.PlaceOrderAsync(order);
        _logger.LogInformation("Order {OrderId} placed", order.Id);
    }
}

// Register with decoration
services.AddScoped<OrderService>();
services.AddScoped<IOrderService>(provider =>
{
    var inner = provider.GetRequiredService<OrderService>();
    var logger = provider.GetRequiredService<ILogger<LoggingOrderService>>();
    return new LoggingOrderService(inner, logger);
});
```

## Testing with DI

```csharp
public class OrderServiceTests
{
    [Fact]
    public async Task PlaceOrder_SavesOrder()
    {
        // Arrange
        var mockRepo = new Mock<IOrderRepository>();
        var mockEmail = new Mock<IEmailService>();
        var logger = NullLogger<OrderService>.Instance;

        var service = new OrderService(
            mockRepo.Object,
            mockEmail.Object,
            logger);

        var order = new Order { Id = 1 };

        // Act
        await service.PlaceOrderAsync(order);

        // Assert
        mockRepo.Verify(r => r.SaveAsync(order), Times.Once);
    }
}

// Integration tests with real container
public class IntegrationTests
{
    [Fact]
    public async Task FullWorkflow()
    {
        var services = new ServiceCollection();
        services.AddScoped<IOrderRepository, InMemoryOrderRepository>();
        services.AddTransient<IEmailService, FakeEmailService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddLogging();

        var provider = services.BuildServiceProvider();

        using var scope = provider.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IOrderService>();

        await service.PlaceOrderAsync(new Order { Id = 1 });
    }
}
```

## Best Practices

### Do

```csharp
// Use constructor injection
public class Service
{
    private readonly IDependency _dependency;
    public Service(IDependency dependency) => _dependency = dependency;
}

// Register interfaces, not implementations in consuming code
services.AddScoped<IOrderService, OrderService>();

// Use the shortest appropriate lifetime
// Transient for stateless, Scoped for per-request, Singleton for shared

// Group registrations in extension methods
services.AddApplicationServices();

// Validate in development
options.ValidateOnBuild = environment.IsDevelopment();
```

### Don't

```csharp
// Don't use service locator pattern
public class BadService
{
    public void DoWork()
    {
        // Anti-pattern: resolving inside method
        var dep = ServiceLocator.Get<IDependency>();
    }
}

// Don't capture scoped in singleton
services.AddSingleton<SingletonWithScoped>();  // Captive dependency!

// Don't create the container inside services
public class BadFactory
{
    public IService Create()
    {
        var services = new ServiceCollection();  // Wrong!
        // ...
    }
}

// Don't dispose services manually
var service = provider.GetRequiredService<IDisposable>();
service.Dispose();  // Let the container manage disposal
```
## Key Takeaways

**Constructor injection is primary**: Inject dependencies through constructors for explicit, testable dependencies.

**Choose appropriate lifetimes**: Transient for stateless, Scoped for per-request/operation, Singleton for thread-safe shared state.

**Avoid captive dependencies**: Never inject shorter-lived services into longer-lived ones.

**Use interfaces**: Register and inject interfaces, not concrete types, for flexibility and testability.

**Group registrations**: Use extension methods to organize related service registrations.

**Validate during development**: Enable ValidateOnBuild and ValidateScopes to catch issues early.
