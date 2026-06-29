---
title: "C# Configuration and Options Pattern"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How .NET configuration actually works in modern cloud-native applications: layered providers, the Options Pattern, and a holistic example showing secrets from vaults, operational defaults from DevOps, and feature settings from centralized services."
tags: [c-sharp, dotnet, configuration, options-pattern, dependency-injection, practical]
---

## The Real Shape of Modern Configuration

Configuration in a modern .NET application does not live in one place. Secrets come from a cloud vault. Logging and observability defaults come from platform or DevOps-controlled infrastructure. Feature behavior comes from centralized configuration services or feature flag systems. In many cloud-native systems, local JSON files play no role at all; every value comes from an external source, and the options classes themselves serve as the schema.

.NET's configuration system is built for exactly this reality. It loads settings from multiple providers into a single `IConfiguration` interface, where later sources override earlier ones. The application code never knows or cares where a value came from. It just reads `configuration["Database:ConnectionString"]` and gets the right answer, whether that value was set by AWS Parameter Store, injected by Kubernetes, or pulled from Azure Key Vault.

This guide walks through the full picture: how configuration providers compose, how different architectural maturity levels change the role of local files (from full schema to bootstrapping to nothing at all), and how the Options Pattern gives your code a clean, validated interface regardless of where values originate.

## A Real Application's Configuration Stack

Consider an order processing service running in Azure Kubernetes Service. Here is what its configuration stack actually looks like, from bottom to top.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Layer 1: Structural defaults (what the app expects)
// Already loaded by default: appsettings.json, appsettings.{Environment}.json

// Layer 2: Platform/infrastructure overrides (DevOps-controlled)
builder.Configuration.AddEnvironmentVariables("ORDERSERVICE_");

// Layer 3: Centralized configuration (shared across services)
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(builder.Configuration["AppConfig:Endpoint"])
        .Select(KeyFilter.Any, LabelFilter.Null)
        .Select(KeyFilter.Any, builder.Environment.EnvironmentName)
        .ConfigureRefresh(refresh =>
            refresh.Register("Sentinel", refreshAll: true));
});

// Layer 4: Secrets (always from a vault in non-dev environments)
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>();
}
else
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(builder.Configuration["KeyVault:Uri"]!),
        new DefaultAzureCredential());
}
```

Each layer has a distinct owner and a distinct purpose.

### Layer 1: Local Files Bootstrap the Host, Not the Domains

In small applications where all the code lives in a single project, a local JSON file can reasonably define the full configuration shape. But in any system with distributed domain logic, libraries, or shared NuGet packages, that model falls apart quickly.

Each package already owns its configuration contract. A marketing client library defines `MarketingApiOptions`. A database package defines `DatabaseOptions`. An observability package defines `TelemetryOptions`. These packages declare their own options classes, their own defaults, and their own validation. The host has no business redeclaring all of that in a monolithic JSON file.

In practice, `appsettings.json` should contain only what the host itself controls: hosting configuration, provider bootstrapping endpoints (like a vault URI or App Configuration connection string), and logging defaults. Everything else belongs to the packages that actually own those domains.

#### When the Host Owns Everything

In a single-project application or a small service with no shared packages, a flat JSON file can define the full configuration surface. This is simple and readable.

```json
// appsettings.json - small service, all config in one place
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Database": {
    "MaxConnections": 10,
    "CommandTimeout": 30,
    "ConnectionString": ""
  },
  "Orders": {
    "MaxItemsPerOrder": 100,
    "DefaultCurrency": "USD"
  },
  "Email": {
    "SmtpServer": "",
    "Port": 587,
    "UseSsl": true,
    "FromAddress": ""
  }
}
```

This works when the host is the application. It breaks when the host composes independent packages that each bring their own configuration needs.

#### When Packages Own Their Domains

In a package-oriented architecture, each library registers its own options and binds its own configuration section. The host provides the configuration sources; the packages pull what they need.

```csharp
// Inside a NuGet package: TMI.Clients.Marketing
public static class MarketingServiceExtensions
{
    public static IServiceCollection AddMarketingClient(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<MarketingApiOptions>()
            .Bind(configuration.GetSection(MarketingApiOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddHttpClient<IMarketingClient, MarketingClient>();
        return services;
    }
}
```

The package owns `MarketingApiOptions`, its defaults, its validation, and its binding. The host just calls `AddMarketingClient` and provides the configuration sources. Whether the `Marketing:ApiKey` value comes from Key Vault, App Configuration, or an environment variable is determined by the provider stack, not by the package or the host's JSON file.

The host's `appsettings.json` shrinks to what the host actually controls.

```json
// appsettings.json - host-level concerns only
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AppConfig": {
    "Endpoint": ""
  },
  "KeyVault": {
    "Uri": ""
  }
}
```

Domain-level defaults live inside the packages themselves, as default values on options properties or through `PostConfigure` registrations. If a package needs `MaxConnections` to default to 10, that default is on the `DatabaseOptions` class, not in a JSON file the host maintains.

#### Why This Matters at Scale

A distributed system with hundreds of features and dozens of packages cannot maintain a single schema per host. The combinatorics alone make it unsustainable: every package update that adds or changes a configuration key would require coordinated changes to every host that consumes it. Packages owning their own configuration contracts means the host stays thin, packages evolve independently, and configuration changes are localized to the domain that owns them.

#### When Configuration Is Fully Externalized

The most streamlined approach eliminates local config files entirely. Every value comes from an external configuration service like AWS Parameter Store, Azure App Configuration, or a similar centralized source. The service has no `appsettings.json` at all.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Clear the default file-based providers
builder.Configuration.Sources.Clear();

// Single external source for all configuration
builder.Configuration.AddSystemsManager("/orderservice/");

// Packages register their own options against IConfiguration as usual
builder.Services.AddMarketingClient(builder.Configuration);
builder.Services.AddOrderProcessing(builder.Configuration);
builder.Services.AddObservability(builder.Configuration);
```

The provider stack collapses to a single source. There is no override chain to reason about, no question of "which layer won?" for a given key. Your chosen configuration service is the single source of truth. The path hierarchy in Parameter Store like `/orderservice/Database/ConnectionString` maps directly to `configuration["Database:ConnectionString"]`, and the options classes bind to it the same way they would bind to a JSON file.

The schema still exists; it just lives in code rather than in a file. Each package's options class declares the expected keys, their types, their defaults, and their validation rules. A new developer reads `DatabaseOptions` to understand what database configuration the system expects. They read Parameter Store to see the actual values. There is no JSON file that might be stale, incomplete, or misleading.

The common concern with this approach is local development: if all configuration comes from a cloud service, how does a developer run the application locally? .NET Aspire solves this cleanly. The Aspire `AppHost` project defines the local development topology, wires up resource connection strings, configures service discovery, and provides local defaults, all outside the service's own repository. The service itself stays zero-config, and Aspire handles the local equivalent of what Parameter Store does in production.

```csharp
// In the Aspire AppHost project (separate from the service)
var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("orderdb")
    .AddDatabase("orders");

var orderService = builder.AddProject<Projects.OrderService>("orderservice")
    .WithReference(database);
```

The service receives its connection string through Aspire's service discovery and configuration injection, so it never needs a local JSON file, environment variable, or User Secrets setup. When the same service runs in production, Parameter Store provides the values instead.

This approach works well when:

- The team has invested in a centralized configuration service as part of its platform
- All environments (including local dev via Aspire) can provide configuration through the same `IConfiguration` abstraction
- The organization values a single source of truth over layered overrides
- Dozens of packages each own their own configuration contracts, making a host-level schema file impractical

### Layer 2: Platform Overrides for Operational Control

Environment variables are how platform teams and DevOps control operational behavior without touching application code or configuration files. In Kubernetes, these come from ConfigMaps, pod specs, or Helm charts. In Azure App Service, they come from Application Settings.

```csharp
builder.Configuration.AddEnvironmentVariables("ORDERSERVICE_");
```

A prefix like `ORDERSERVICE_` scopes the variables to this service and prevents collisions. Double underscores represent hierarchy.

```yaml
# Kubernetes deployment (controlled by DevOps, not developers)
env:
  - name: ORDERSERVICE_Logging__LogLevel__Default
    value: "Warning"
  - name: ORDERSERVICE_Database__MaxConnections
    value: "50"
  - name: ORDERSERVICE_Metrics__Enabled
    value: "true"
```

This is how DevOps teams control logging verbosity, connection pool sizes, feature flags, and retry behavior across environments without redeploying the application. The platform team sets `Logging:LogLevel:Default` to `Warning` in production and `Debug` in staging, and developers never need to think about it.

### Layer 3: Centralized Configuration for Shared Settings

When multiple services need the same settings, or when settings need to change without redeployment, a centralized configuration service becomes the source of truth. Azure App Configuration, AWS AppConfig, or a custom database-backed provider all serve this role.

```csharp
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(builder.Configuration["AppConfig:Endpoint"])
        .Select(KeyFilter.Any, LabelFilter.Null)
        .Select(KeyFilter.Any, builder.Environment.EnvironmentName)
        .ConfigureRefresh(refresh =>
            refresh.Register("Sentinel", refreshAll: true));
});
```

This is where settings like SMTP server addresses, third-party API base URLs, feature flags, and shared business rules typically live. The `Sentinel` pattern means a single key change triggers a refresh of all configuration, so you can update multiple related values atomically.

Settings that commonly live in centralized configuration include:

- **Shared service endpoints**: API base URLs that all services call
- **Feature flags**: controlled by product teams, not developers
- **Business rules**: order limits, rate limits, retry policies
- **Third-party integration settings**: email servers, payment gateway URLs, notification service endpoints

### Layer 4: Secrets Always Come from a Vault

In any non-development environment, secrets belong in a dedicated secret management service. Connection strings, API keys, certificates, and credentials should never exist in files, environment variables, or source control.

```csharp
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>();
}
else
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(builder.Configuration["KeyVault:Uri"]!),
        new DefaultAzureCredential());
}
```

Key Vault secrets use `--` as hierarchy separators. A secret named `Database--ConnectionString` maps to `configuration["Database:ConnectionString"]`, which overrides the empty placeholder from `appsettings.json`. Authentication uses `DefaultAzureCredential`, which resolves to managed identity in Azure and developer credentials locally.

**User Secrets** serve the same role during local development. They store sensitive values on the developer's machine outside the project directory so they never end up in source control.

```bash
dotnet user-secrets init
dotnet user-secrets set "Database:ConnectionString" "Server=localhost;..."
dotnet user-secrets set "Email:ApiKey" "dev-key-abc123"
```

The values are stored in `%APPDATA%\Microsoft\UserSecrets\{guid}\secrets.json` on Windows and `~/.microsoft/usersecrets/{guid}/secrets.json` on Linux/macOS.

### How the Layers Compose

Provider ordering determines which layer wins when the same key exists in multiple sources. Later providers override earlier ones. For the order processing service above, the resolution order is:

1. `appsettings.json` provides structural defaults
2. `appsettings.{Environment}.json` overrides for the current environment
3. Environment variables override anything from files (DevOps control)
4. Azure App Configuration overrides with centralized settings
5. Key Vault (or User Secrets in dev) overrides with secrets

When the application reads `configuration["Database:ConnectionString"]`, it gets the Key Vault value in production, the User Secrets value in development, and falls back to the empty string from `appsettings.json` if nothing else is configured. The application code never makes this decision; the provider stack handles it.

## The Options Pattern: How Application Code Consumes Configuration

With configuration coming from four different layers, the application code needs a clean way to consume it. The Options Pattern binds configuration sections to strongly-typed classes and integrates with dependency injection, so services never deal with string keys or raw `IConfiguration`.

### Defining Options Classes

Each options class maps to a configuration section and provides compile-time safety.

```csharp
public class DatabaseOptions
{
    public const string SectionName = "Database";

    [Required]
    public string ConnectionString { get; set; } = "";

    [Range(1, 200)]
    public int MaxConnections { get; set; } = 10;

    [Range(1, 300)]
    public int CommandTimeout { get; set; } = 30;
}

public class OrderOptions
{
    public const string SectionName = "Orders";

    [Range(1, 1000)]
    public int MaxItemsPerOrder { get; set; } = 100;

    public string DefaultCurrency { get; set; } = "USD";
}

public class EmailOptions
{
    public const string SectionName = "Email";

    [Required]
    public string SmtpServer { get; set; } = "";

    public int Port { get; set; } = 587;

    [Required]
    public string FromAddress { get; set; } = "";

    public bool UseSsl { get; set; } = true;
}
```

### Registering Options with Validation

Registration binds each options class to its configuration section and adds validation that runs at startup. `ValidateOnStart()` ensures the application fails immediately if required secrets are missing or values are out of range, rather than failing unpredictably at runtime.

```csharp
builder.Services.AddOptions<DatabaseOptions>()
    .Bind(builder.Configuration.GetSection(DatabaseOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<OrderOptions>()
    .Bind(builder.Configuration.GetSection(OrderOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

If Key Vault is unreachable and `Database:ConnectionString` remains empty, the `[Required]` annotation on `DatabaseOptions.ConnectionString` causes the application to fail on startup with a clear error message rather than throwing a cryptic `SqlException` later when the first query runs.

### Choosing the Right Options Interface

Services receive their configuration through one of three interfaces, depending on whether the values might change at runtime.

| Interface | Lifetime | Picks Up Changes | Best For |
|-----------|----------|------------------|----------|
| `IOptions<T>` | Singleton | No | Configuration that is fixed at startup |
| `IOptionsSnapshot<T>` | Scoped | Per request | Web request handlers where config might change between requests |
| `IOptionsMonitor<T>` | Singleton | Yes, with callback | Background services and long-running processes |

Most services should use `IOptions<T>` because most configuration is effectively static once the application starts. `IOptionsSnapshot<T>` is useful when centralized configuration changes (like feature flags from Azure App Configuration) need to take effect without restarting. `IOptionsMonitor<T>` is for background services that run continuously and need to react to changes.

```csharp
// Standard service - configuration is fixed at startup
public class OrderService
{
    private readonly OrderOptions _options;
    private readonly DatabaseOptions _dbOptions;

    public OrderService(
        IOptions<OrderOptions> options,
        IOptions<DatabaseOptions> dbOptions)
    {
        _options = options.Value;
        _dbOptions = dbOptions.Value;
    }

    public async Task<Order> CreateOrderAsync(OrderRequest request)
    {
        if (request.Items.Count > _options.MaxItemsPerOrder)
            throw new ValidationException(
                $"Orders cannot exceed {_options.MaxItemsPerOrder} items");

        // _dbOptions.ConnectionString came from Key Vault
        // _options.MaxItemsPerOrder came from App Configuration or appsettings.json
        // The service doesn't know or care about the source
        return await PersistOrderAsync(request);
    }
}

// Background service - needs to react to configuration changes
public class OrderProcessingWorker : BackgroundService
{
    private readonly IOptionsMonitor<OrderOptions> _optionsMonitor;

    public OrderProcessingWorker(IOptionsMonitor<OrderOptions> optionsMonitor)
    {
        _optionsMonitor = optionsMonitor;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var options = _optionsMonitor.CurrentValue;
            await ProcessPendingOrdersAsync(options);
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }
}
```

### Named Options

When you need multiple configurations of the same shape, named options let you register and retrieve them by name. This is common for HTTP clients calling different APIs.

```csharp
public class HttpClientOptions
{
    public string BaseUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 30;
}

// Registration - each name maps to a different configuration section
builder.Services.Configure<HttpClientOptions>("GitHub",
    builder.Configuration.GetSection("HttpClients:GitHub"));
builder.Services.Configure<HttpClientOptions>("Stripe",
    builder.Configuration.GetSection("HttpClients:Stripe"));

// Consumption - resolve by name
public class ApiClientFactory
{
    private readonly IOptionsSnapshot<HttpClientOptions> _options;

    public ApiClientFactory(IOptionsSnapshot<HttpClientOptions> options)
    {
        _options = options;
    }

    public HttpClient CreateClient(string name)
    {
        var options = _options.Get(name);
        return new HttpClient
        {
            BaseAddress = new Uri(options.BaseUrl),
            Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds)
        };
    }
}
```

## Custom Validation

Data annotations handle most validation needs, but complex rules require `IValidateOptions<T>`. This is useful when validation depends on relationships between properties or external conditions.

```csharp
public class EmailOptionsValidator : IValidateOptions<EmailOptions>
{
    public ValidateOptionsResult Validate(string? name, EmailOptions options)
    {
        var failures = new List<string>();

        if (string.IsNullOrEmpty(options.SmtpServer))
            failures.Add("SmtpServer is required");

        if (!string.IsNullOrEmpty(options.SmtpServer)
            && !Uri.TryCreate($"smtp://{options.SmtpServer}", UriKind.Absolute, out _))
            failures.Add("SmtpServer must be a valid hostname");

        if (options.UseSsl && options.Port == 25)
            failures.Add("Port 25 does not support SSL; use 587 or 465");

        return failures.Count > 0
            ? ValidateOptionsResult.Fail(failures)
            : ValidateOptionsResult.Success;
    }
}

builder.Services.AddSingleton<
    IValidateOptions<EmailOptions>, EmailOptionsValidator>();
```

## Post-Configuration

Post-configuration runs after all providers have been applied and all binding is complete. Use it to enforce defaults, normalize values, or compute derived properties.

```csharp
builder.Services.PostConfigure<EmailOptions>(options =>
{
    if (string.IsNullOrEmpty(options.FromAddress))
    {
        options.FromAddress = "noreply@example.com";
    }
});

// PostConfigureAll applies to all named instances
builder.Services.PostConfigureAll<HttpClientOptions>(options =>
{
    if (options.TimeoutSeconds == default)
    {
        options.TimeoutSeconds = 30;
    }
});
```

## Building a Custom Configuration Provider

When your configuration source is not covered by an existing NuGet package, you can build a provider that plugs into the standard pipeline. The application code never knows the difference; it just sees values in `IConfiguration`.

```csharp
public class DatabaseConfigurationProvider : ConfigurationProvider
{
    private readonly string _connectionString;

    public DatabaseConfigurationProvider(string connectionString)
    {
        _connectionString = connectionString;
    }

    public override void Load()
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = new SqlCommand(
            "SELECT [Key], [Value] FROM Configuration", connection);
        using var reader = command.ExecuteReader();

        var data = new Dictionary<string, string?>(
            StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            data[reader.GetString(0)] = reader.GetString(1);
        }

        Data = data;
    }
}

public class DatabaseConfigurationSource : IConfigurationSource
{
    public string ConnectionString { get; set; } = "";

    public IConfigurationProvider Build(IConfigurationBuilder builder)
        => new DatabaseConfigurationProvider(ConnectionString);
}

public static class ConfigurationExtensions
{
    public static IConfigurationBuilder AddDatabase(
        this IConfigurationBuilder builder, string connectionString)
        => builder.Add(new DatabaseConfigurationSource
        {
            ConnectionString = connectionString
        });
}
```

## Cloud Provider Differences

The level of .NET integration varies significantly across cloud providers. This matters when choosing where to store secrets and configuration.

**Azure Key Vault** has the smoothest experience because Microsoft provides a first-party NuGet package (`Azure.Extensions.AspNetCore.Configuration.Secrets`) that plugs directly into the configuration pipeline. Authentication through `DefaultAzureCredential` works identically in local development and production.

**AWS Systems Manager Parameter Store** has an official AWS-maintained package (`Amazon.Extensions.Configuration.SystemsManager`) that works as an `IConfiguration` provider. Parameter Store organizes secrets by path, so `/myapp/production/Database/ConnectionString` maps to `configuration["Database:ConnectionString"]`. It supports both plain strings and SecureString parameters encrypted with KMS.

```csharp
// AWS Parameter Store as an IConfiguration provider
builder.Configuration.AddSystemsManager("/myapp/production/");
```

**AWS Secrets Manager** does not have a first-party `IConfiguration` provider. You can use the community NuGet package `Kralizek.Extensions.Configuration.AWSSecretsManager`, build a custom provider using the pattern above, or load secrets directly via the SDK. The trade-off between Parameter Store and Secrets Manager on AWS is worth understanding: Parameter Store is simpler, cheaper (free tier for standard parameters), and has native `IConfiguration` support, while Secrets Manager adds automatic rotation, cross-account access, and replication at a per-secret cost.

**HashiCorp Vault** also requires a community package or custom provider since there is no first-party integration.

## In-Memory Configuration for Testing

For unit and integration tests, in-memory configuration replaces the entire provider stack so tests have no dependencies on files, environment variables, or cloud services.

```csharp
var testConfig = new Dictionary<string, string?>
{
    ["Database:ConnectionString"] = "Server=test-db;Database=orders_test",
    ["Database:MaxConnections"] = "5",
    ["Orders:MaxItemsPerOrder"] = "10",
    ["Email:SmtpServer"] = "localhost",
    ["Email:FromAddress"] = "test@example.com"
};

var configuration = new ConfigurationBuilder()
    .AddInMemoryCollection(testConfig)
    .Build();
```

This also works with the Options Pattern for testing services in isolation.

```csharp
var options = Options.Create(new OrderOptions
{
    MaxItemsPerOrder = 10,
    DefaultCurrency = "EUR"
});

var service = new OrderService(options, dbOptions);
```

## Choosing the Right Strategy

The right approach depends on how your system is structured. In a small single-project service, local JSON files can reasonably define the full configuration surface. In a package-oriented architecture, each package owns its config contract and the host file shrinks to bootstrapping. In a fully cloud-native system, there may be no local config files at all.

| What You're Configuring | Who Owns It | Where It Lives | Example |
|------------------------|-------------|----------------|---------|
| Application structure and safe defaults | Developers | Options classes (code), optionally `appsettings.json` | Page sizes, timeouts, default ports |
| Environment-specific operational behavior | DevOps / Platform team | Environment variables, ConfigMaps, or centralized config | Log levels, connection pool sizes, feature toggles |
| Shared settings across services | Product / Platform team | Centralized config service (Parameter Store, App Configuration) | API endpoints, feature flags, business rules |
| Secrets and credentials | Security / Platform team | Cloud vault (Key Vault, Parameter Store, Secrets Manager) | Connection strings, API keys, certificates |
| Local development configuration | Individual developer | Aspire AppHost, User Secrets, or `appsettings.Development.json` | Local database connections, dev API keys |
| Test configuration | Developers | In-memory collections | Test connection strings, reduced limits |

In a layered approach, provider ordering determines which source wins: later providers override earlier ones. In a fully externalized approach, there is only one source and no override chain to reason about. Both approaches use the same `IConfiguration` interface and Options Pattern, so application code is identical regardless of which strategy you choose. The difference is entirely in how the host wires up its providers.
