---
title: "C# Configuration and Options Pattern"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "How .NET configuration works: flattened keys, the provider stack the host builds by default and how added providers override it, secrets from vaults, refreshing centralized configuration, where the configuration schema should live, binding rules, validation at startup and on reload, and choosing between IOptions, IOptionsSnapshot, and IOptionsMonitor."
tags: [configuration, options-pattern, ioptionsmonitor, user-secrets, azure-app-configuration, key-vault, practical]
---

## How IConfiguration Sees Your Settings

.NET configuration loads settings from any number of **providers**, like JSON files, environment variables, command-line arguments, or a cloud vault, and merges them into one `IConfiguration`. Code that reads a value doesn't know which provider supplied it.

### Keys Are Flattened Paths

Every provider reduces its data to flat string keys with `:` separating levels, and string values. This JSON:

```json
{
  "Database": {
    "ConnectionString": "Server=db;Database=orders",
    "Replicas": [ "db-r1", "db-r2" ]
  },
  "ConnectionStrings": {
    "Reporting": "Server=reports;Database=warehouse"
  }
}
```

becomes these keys:

```
Database:ConnectionString   = Server=db;Database=orders
Database:Replicas:0         = db-r1
Database:Replicas:1         = db-r2
ConnectionStrings:Reporting = Server=reports;Database=warehouse
```

Arrays become numbered keys, and keys are case-insensitive. `configuration["Database:ConnectionString"]` reads one value, `configuration.GetSection("Database")` returns the subtree, and `configuration.GetConnectionString("Reporting")` is shorthand for `configuration["ConnectionStrings:Reporting"]`.

Providers whose source can't contain `:` use a substitute that they translate. An environment variable uses a double underscore, so `Database__ConnectionString` sets `Database:ConnectionString`. A Key Vault secret uses a double dash, so a secret named `Database--ConnectionString` sets the same key.

### The Last Provider Wins

When two providers supply the same key, the provider added later wins. `WebApplication.CreateBuilder` and `Host.CreateApplicationBuilder` register a default stack before your code runs, from lowest to highest precedence:

| Provider | Loaded when |
|---|---|
| Environment variables prefixed `DOTNET_` (and `ASPNETCORE_` for web apps) | Always |
| `appsettings.json` | If the file exists |
| `appsettings.{Environment}.json` | If the file exists |
| User secrets | Only in the `Development` environment, and only if the project has a `UserSecretsId` |
| Environment variables, unprefixed | Always |
| Command-line arguments | If any are passed |

Both JSON files are optional and reload when they change on disk. The environment name comes from `DOTNET_ENVIRONMENT` or `ASPNETCORE_ENVIRONMENT` and defaults to `Production`.

Anything you add through `builder.Configuration.Add...` goes on top of this stack, above the unprefixed environment variables and the command line. A vault added this way overrides an environment variable an operator set to fix an emergency. If operators need the last word, add `AddEnvironmentVariables()` again after your own providers.

## A Layered Configuration Stack

Consider an order service deployed to Kubernetes, with settings coming from four owners: the developers' defaults, the platform team's environment variables, a shared Azure App Configuration store, and Azure Key Vault for secrets:

```csharp
var builder = WebApplication.CreateBuilder(args);
// Already loaded: appsettings.json, appsettings.{Environment}.json,
// user secrets in Development, environment variables, command line

// Environment variables scoped to this service; the prefix is removed from the key
builder.Configuration.AddEnvironmentVariables("ORDERSERVICE_");

// Shared, centrally managed settings
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(new Uri(builder.Configuration["AppConfig:Endpoint"]!), new ManagedIdentityCredential())
        .Select(KeyFilter.Any, LabelFilter.Null)
        .Select(KeyFilter.Any, builder.Environment.EnvironmentName)
        .ConfigureRefresh(refresh => refresh.RegisterAll());
});

// Secrets, outside Development (user secrets cover Development)
if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(builder.Configuration["KeyVault:Uri"]!),
        new ManagedIdentityCredential());
}
```

The endpoints for App Configuration and Key Vault are read from configuration that is already loaded, which is why these providers come after the defaults. The two `Select` calls load unlabeled keys first and then keys labeled with the environment name, so an environment-specific value overrides the shared one.

### Environment Variables for Operational Control

Environment variables are how a platform team adjusts a deployed service without a new build. In Kubernetes they come from the pod spec, a ConfigMap, or a Helm chart:

```yaml
env:
  - name: ORDERSERVICE_Logging__LogLevel__Default
    value: "Warning"
  - name: ORDERSERVICE_Database__MaxConnections
    value: "50"
```

`AddEnvironmentVariables("ORDERSERVICE_")` loads only variables starting with the prefix and strips it, so the second variable sets `Database:MaxConnections`. The prefix keeps this service's settings separate from variables meant for other processes in the same environment. The default, unprefixed provider still loads every variable, including these ones under their full names, which is harmless because nothing reads a key starting with `ORDERSERVICE_`.

### Secrets Come from a Vault

Connection strings, API keys, and certificates belong in a secret store like Azure Key Vault or AWS Secrets Manager, not in `appsettings.json` or source control. The Key Vault provider (`Azure.Extensions.AspNetCore.Configuration.Secrets`) loads every secret the identity can read and maps `--` to `:`.

`DefaultAzureCredential` tries a chain of credentials in turn, including environment variables, managed identity, and developer tools, and uses the first that works. That chain suits local development. Microsoft recommends a specific credential such as `ManagedIdentityCredential` in deployed environments, because a chain is harder to debug when authentication fails and an unrelated environment variable on the host can change which credential it picks.

During development, **user secrets** keep values out of the repository:

```bash
dotnet user-secrets init
dotnet user-secrets set "Database:ConnectionString" "Server=localhost;Database=orders"
```

The values are stored in `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json` on Windows and `~/.microsoft/usersecrets/<id>/secrets.json` on Linux and macOS. The file is plain JSON and isn't encrypted. User secrets keep a password out of source control, but they don't protect it on the machine. The default host loads them only in `Development`, so calling `AddUserSecrets` yourself adds them a second time.

### Refreshing Centralized Configuration

A central store is useful partly because a value can change without a redeploy, but the new value has to reach the running process. With Azure App Configuration, `ConfigureRefresh` decides what to watch. `RegisterAll()` reloads everything when any selected key changes. The older pattern registers a single **sentinel** key and reloads everything when it changes, which lets an operator edit several keys and then bump the sentinel once.

Registering keys doesn't start any polling. In ASP.NET Core, `builder.Services.AddAzureAppConfiguration()` and `app.UseAzureAppConfiguration()` from the `Microsoft.Azure.AppConfiguration.AspNetCore` package add middleware that checks for changes as requests arrive, at most once per refresh interval (30 seconds by default). The check runs in the background, so the request that triggers it may still see old values. An app that receives no requests never refreshes, and a worker service has to trigger refresh itself through `IConfigurationRefresher`.

A refreshed value reaches code only through something that rereads configuration. `IOptions<T>` never does. See [Choosing an Options Interface](#choosing-an-options-interface).

## Where the Configuration Schema Lives

A small service can define its whole configuration in `appsettings.json`. The file doubles as documentation of every key the service reads:

```json
{
  "Database": { "MaxConnections": 10, "CommandTimeout": 30, "ConnectionString": "" },
  "Orders": { "MaxItemsPerOrder": 100, "DefaultCurrency": "USD" },
  "Email": { "SmtpServer": "", "Port": 587, "FromAddress": "" }
}
```

That stops working when the host composes libraries that each have their own settings. If every host has to redeclare every library's keys, every library change that adds a key needs a coordinated change to every host. Instead, a library can own its configuration contract. It defines an options class with defaults and validation, and binds its own section:

```csharp
public static class MarketingServiceCollectionExtensions
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

The host calls `AddMarketingClient` and supplies providers. Its own `appsettings.json` shrinks to what the host controls, like logging levels and the endpoints of its configuration stores. Defaults live on the options classes, and a reader learns what a library expects by reading its options class.

Taken further, a service can have no configuration files at all and read everything from one external store:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Configuration.Sources.Clear();
builder.Configuration.AddSystemsManager("/orderservice/");   // AWS Systems Manager Parameter Store

builder.Services.AddMarketingClient(builder.Configuration);
```

The Parameter Store provider (`Amazon.Extensions.Configuration.SystemsManager`) strips the path prefix and maps `/` to `:`, so `/orderservice/Database/ConnectionString` becomes `Database:ConnectionString`. With one source there is no precedence to reason about. `Sources.Clear()` removes the environment variables and command line too, so an operator can no longer override a value without changing the store.

Local development then needs somewhere to get values. Aspire's AppHost project can supply them. It starts the service's dependencies locally and passes their connection strings to the service as environment variables, so the service's own repository needs no local configuration files.

## The Options Pattern

Reading `configuration["Orders:MaxItemsPerOrder"]` throughout the code scatters string keys and parsing everywhere. The options pattern binds a section to a class once and injects the result:

```csharp
public class OrderOptions
{
    public const string SectionName = "Orders";

    [Range(1, 1000)]
    public int MaxItemsPerOrder { get; set; } = 100;

    [Required]
    public string DefaultCurrency { get; set; } = "USD";
}

builder.Services.AddOptions<OrderOptions>()
    .Bind(builder.Configuration.GetSection(OrderOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

public class OrderService(IOptions<OrderOptions> options)
{
    private readonly OrderOptions _options = options.Value;
}
```

### What Binding Does and Doesn't Check

The binder matches keys to public properties with setters, ignoring case, and converts each string to the property's type. Its rules are forgiving in ways that hide mistakes:

| Situation | Result |
|---|---|
| Key missing | The property keeps its default |
| Key present but misspelled (`MaxItemsPerOder`) | Ignored silently, and the property keeps its default |
| Value can't be converted (`"abc"` for an `int`) | `InvalidOperationException` when the options are first created |
| Collection property already initialized, like `= ["a"]` | Configured items are **added** to the default ones |

The misspelled key is the common production bug. Nothing fails, and the default quietly applies. Setting `BinderOptions.ErrorOnUnknownConfiguration` in the `Bind` call makes an unmatched key throw instead. The collection rule surprises in the other direction. A `List<string>` initialized with a default host and then bound to two configured hosts ends up with three, so leave collection properties empty and apply defaults after binding.

### Validation at Startup

Binding succeeds with any missing value, so validation is what turns a missing secret into an error. `ValidateDataAnnotations()` checks attributes like `[Required]` and `[Range]`. `[Required]` rejects an empty string as well as `null`, which catches a placeholder `""` left in a JSON file that no vault overrode.

Without `ValidateOnStart()`, validation runs only when something first reads the options, which might be the first request that needs them, long after deployment. With it, the host throws `OptionsValidationException` as it starts, and the deployment fails where it can be seen. `AddOptionsWithValidateOnStart<T>()` (.NET 8) combines the `AddOptions` and `ValidateOnStart` calls.

Data annotations check only the top-level properties. A `[Range]` on a property of a nested `RetryOptions` object inside `OrderOptions` is never evaluated. Rules that span properties, or that data annotations can't express, go in an `IValidateOptions<T>`:

```csharp
public class EmailOptionsValidator : IValidateOptions<EmailOptions>
{
    public ValidateOptionsResult Validate(string? name, EmailOptions options)
    {
        var failures = new List<string>();

        if (options.RequireAuthentication && string.IsNullOrEmpty(options.Username))
            failures.Add("Username is required when RequireAuthentication is true");

        if (options.Retry.MaxAttempts is < 1 or > 10)
            failures.Add("Retry:MaxAttempts must be between 1 and 10");

        return failures.Count > 0
            ? ValidateOptionsResult.Fail(failures)
            : ValidateOptionsResult.Success;
    }
}

builder.Services.AddSingleton<IValidateOptions<EmailOptions>, EmailOptionsValidator>();
```

For a single rule, `.Validate(o => ..., "message")` on the `AddOptions` builder does the same without a class. For trimmed or Native AOT apps, the `[OptionsValidator]` source generator (.NET 8) produces a reflection-free validator, and its `[ValidateObjectMembers]` attribute extends validation into nested objects.

### Configure, PostConfigure, Validate

An options instance is built in three passes, whatever order they're registered in:

1. Every `Configure` action, including `Bind`, in registration order.
2. Every `PostConfigure` action.
3. Every validator.

`PostConfigure` sees the fully bound object, which makes it the place for derived values and for defaults that depend on other settings. Validation runs last, so a value filled in by `PostConfigure` counts as present:

```csharp
builder.Services.PostConfigure<EmailOptions>(options =>
{
    if (string.IsNullOrEmpty(options.FromAddress))
        options.FromAddress = $"noreply@{options.Domain}";
});
```

### Choosing an Options Interface

| Interface | Registered as | Sees changed configuration |
|---|---|---|
| `IOptions<T>` | Singleton | Never. The value is created once, on first use |
| `IOptionsSnapshot<T>` | Scoped | Once per scope, so each request sees the values as of its start |
| `IOptionsMonitor<T>` | Singleton | Yes. `CurrentValue` reflects the latest reload, and `OnChange` notifies you |

`IOptions<T>` suits the large majority of settings, which don't change while a process runs. `IOptionsSnapshot<T>` gives a request a consistent view, but its scoped lifetime means a singleton can't take it. Resolving it from the root provider throws under scope validation. A singleton or a background service that needs current values uses `IOptionsMonitor<T>` and reads `CurrentValue` each time it needs a value rather than caching it:

```csharp
public class OrderProcessingWorker(IOptionsMonitor<OrderOptions> options) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            OrderOptions current = options.CurrentValue;
            await ProcessPendingOrdersAsync(current, stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}
```

`ValidateOnStart` protects startup only. When a reload produces values that fail validation, `IOptionsMonitor<T>.CurrentValue` and new `IOptionsSnapshot<T>` instances throw `OptionsValidationException` until the configuration is fixed, so a bad edit in a central store can break a running service. `IOptions<T>` keeps the value it started with.

### Named Options

Named options hold several configurations of the same shape, like the settings for each external API a service calls:

```csharp
public class ApiOptions
{
    public string BaseUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 30;
}

builder.Services.Configure<ApiOptions>("GitHub", builder.Configuration.GetSection("Apis:GitHub"));
builder.Services.Configure<ApiOptions>("Stripe", builder.Configuration.GetSection("Apis:Stripe"));

builder.Services.AddHttpClient("GitHub", (sp, client) =>
{
    ApiOptions options = sp.GetRequiredService<IOptionsMonitor<ApiOptions>>().Get("GitHub");
    client.BaseAddress = new Uri(options.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
});
```

`IOptionsMonitor<T>.Get(name)` and `IOptionsSnapshot<T>.Get(name)` return a named instance. `IOptions<T>` only exposes the unnamed default. `ConfigureAll` and `PostConfigureAll` apply to every name at once, and a validator's `name` parameter says which instance it's checking.

## Building a Custom Provider

A store with no existing provider can be plugged in by deriving from `ConfigurationProvider` and filling its `Data` dictionary:

```csharp
public class DatabaseConfigurationProvider(string connectionString) : ConfigurationProvider
{
    public override void Load()
    {
        using var connection = new SqlConnection(connectionString);
        connection.Open();

        using var command = new SqlCommand("SELECT [Key], [Value] FROM Configuration", connection);
        using var reader = command.ExecuteReader();

        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
            data[reader.GetString(0)] = reader.IsDBNull(1) ? null : reader.GetString(1);

        Data = data;
    }
}

public class DatabaseConfigurationSource(string connectionString) : IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder builder) =>
        new DatabaseConfigurationProvider(connectionString);
}

public static class DatabaseConfigurationExtensions
{
    public static IConfigurationBuilder AddDatabase(this IConfigurationBuilder builder, string connectionString) =>
        builder.Add(new DatabaseConfigurationSource(connectionString));
}
```

`Load` runs synchronously while configuration is built, so a slow or unreachable store delays or fails startup. A provider that supports changes reloads its data and calls `OnReload()`, which signals `IOptionsMonitor<T>` and anything else watching configuration.

## Configuration in Tests

A test can replace the whole provider stack with an in-memory dictionary, using the same flattened keys:

```csharp
IConfiguration configuration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Orders:MaxItemsPerOrder"] = "10",
        ["Database:ConnectionString"] = "Server=test-db;Database=orders_test"
    })
    .Build();
```

A class that takes `IOptions<T>` can skip configuration entirely:

```csharp
var service = new OrderService(Options.Create(new OrderOptions { MaxItemsPerOrder = 10 }));
```

## Key Takeaways

**Know the default stack before adding to it.** The host already loads JSON files, user secrets in Development, environment variables, and the command line, and whatever you add overrides all of them.

**Keep secrets in a vault, with a specific credential in production.** User secrets are a development convenience and aren't encrypted.

**Binding is forgiving, so validate.** A misspelled key is silently ignored, and only validation with `ValidateOnStart` turns a missing value into a startup failure.

**Choose the options interface by whether values change.** `IOptions<T>` never sees a reload. `IOptionsMonitor<T>` does, and a reload that fails validation makes it throw.

**Let libraries own their options classes,** so hosts supply values without redeclaring every library's schema.
