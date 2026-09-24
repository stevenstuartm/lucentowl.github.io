---
title: "ASP.NET Core Fundamentals"
layout: guide
category: "ASP.NET Core"
subcategory: "Fundamentals"
description: "How an ASP.NET Core app is put together and how it starts: the build-then-run split in Program.cs, what CreateBuilder and WebApplication set up by default, what happens when the app runs and stops, environments, configuration sources and their priority, and how dependency injection scopes map to requests."
tags: [fundamentals, webapplicationbuilder, generic-host, configuration, dependency-injection, environments]
---

## The Parts of an ASP.NET Core App

An ASP.NET Core app is a .NET console program that builds a *host* and runs it. The host is the .NET Generic Host, the same one worker services use, and it owns the pieces every app needs:

- **A dependency injection container** that creates and disposes the app's services.
- **Configuration** read from files, environment variables, and the command line.
- **Logging** with a set of providers already attached.
- **A web server** that accepts HTTP connections and turns each request into an `HttpContext` object. The default server is Kestrel, a cross-platform HTTP server that runs inside the app's own process.
- **A request pipeline**, a chain of middleware components that every request passes through on its way to an *endpoint*: the minimal API handler, controller action, gRPC method, or SignalR hub that produces the response. The response then passes back out through the same middleware in reverse order.

{% include figure.html id="asp-host-request-path" %}

All of this is set up in `Program.cs`. Since .NET 6, the templates use top-level statements and two types, `WebApplicationBuilder` and `WebApplication`, in place of the separate `Startup` class older apps used.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Phase 1: register services and adjust configuration
builder.Services.AddControllers();
builder.Services.AddScoped<IOrderService, OrderService>();

var app = builder.Build();

// Phase 2: arrange the request pipeline and map endpoints
app.UseHttpsRedirection();
app.MapControllers();

app.Run();
```

## Two Phases: Build, Then Run

`Program.cs` reads top to bottom, but it does two different jobs, and the call to `Build()` divides them.

### The Builder Registers Services and Reads Configuration

Before `Build()`, the code works on `WebApplicationBuilder`. Its properties expose everything that has to be settled before the app starts:

| Property | What it configures |
| --- | --- |
| `builder.Services` | Service registrations for the DI container |
| `builder.Configuration` | Configuration sources, including any provider the app adds to read from somewhere new |
| `builder.Environment` | Read access to the environment name, the *content root* (the folder the app reads files like `appsettings.json` from), and the *web root* (`wwwroot` by default, where static files live). These are fixed when `CreateBuilder` runs, so to change them, pass `WebApplicationOptions` to `CreateBuilder` |
| `builder.Logging` | Logging providers and filters |
| `builder.WebHost` | Web server settings, such as `ConfigureKestrel` |
| `builder.Host` | Generic host settings, such as the shutdown timeout |

### Build() Freezes the Service Collection

`Build()` creates the DI container from the registrations made so far and returns a `WebApplication`. From that point the service collection is read-only, and a registration attempted after `Build()` throws an `InvalidOperationException`. That is why every `builder.Services.Add...` call has to come before it.

### WebApplication Arranges the Pipeline and Runs It

After `Build()`, the code works on `WebApplication`, which plays two roles. It is the application builder, so `app.Use...` calls add middleware in the order they appear and `app.Map...` calls register endpoints. It is also the host, so `app.Run()` starts the app and blocks until it shuts down. `app.Services` gives access to the finished container, and `app.Environment` and `app.Configuration` expose the same values the builder read.

### What Run() Starts and How the App Stops

`app.Run()` starts every *hosted service* registered in the container. A hosted service is a class the host starts with the app and stops with it, and the web server is one of them, so starting the host is what makes Kestrel begin listening. With no URL configured anywhere, Kestrel listens on `http://localhost:5000`. Development runs usually pick up a different port from `launchSettings.json`, and the official .NET container images set port 8080, so the port an app actually uses depends on where it runs.

The host stops when it receives Ctrl+C or SIGTERM, which is the signal container orchestrators send, or when code calls `IHostApplicationLifetime.StopApplication()`. A graceful shutdown then runs in order:

1. The `ApplicationStopping` event fires, so the app can react before anything closes.
2. The server stops accepting new connections and waits for in-flight requests to finish, and hosted services are asked to stop.
3. The wait is bounded by the shutdown timeout, 30 seconds by default. Anything still running when it expires is stopped anyway.
4. The `ApplicationStopped` event fires.

Code that needs to act at these moments injects `IHostApplicationLifetime` and registers callbacks on its `ApplicationStarted`, `ApplicationStopping`, and `ApplicationStopped` tokens.

## What CreateBuilder Sets Up for You

`WebApplication.CreateBuilder(args)` does a good deal of work before the first line of app code runs. That is why a new project can read `appsettings.json`, log to the console, and serve requests without any setup.

| Area | Default |
| --- | --- |
| Configuration | `appsettings.json`, `appsettings.{Environment}.json`, *user secrets* (a JSON file kept in the user profile, outside the project folder), environment variables, and command-line arguments |
| Logging | Console, Debug, and EventSource providers, plus EventLog on Windows |
| Server | Kestrel, with endpoints read from configuration |
| Dependency injection | The built-in container |
| Hosting integration | Host filtering middleware, which rejects requests whose `Host` header isn't in the `AllowedHosts` list (the template sets it to `*`, allowing any host); IIS integration when running behind IIS; forwarded headers middleware, which restores the client's IP address and scheme behind a proxy, when `ASPNETCORE_FORWARDEDHEADERS_ENABLED` is `true` |

Several of these defaults change with the environment. Those differences are collected under [What Changes by Environment](#what-changes-by-environment).

### Middleware WebApplication Adds on Its Own

`WebApplication` also inserts some middleware without being asked, which surprises people reading a pipeline that seems to skip steps:

- The developer exception page goes first when the environment is Development.
- Routing middleware (`UseRouting`) goes second if any endpoints are mapped and the app didn't call `UseRouting` itself.
- Authentication middleware goes right after routing if authentication services are registered (`AddAuthentication`) and the app didn't call `UseAuthentication`.
- Authorization middleware goes next if authorization services are registered and the app didn't call `UseAuthorization`.
- Endpoint middleware (`UseEndpoints`) goes at the end if any endpoints are mapped.

Everything the app adds with `app.Use...` lands between routing and endpoints. That default order suits many apps, but two cases need explicit calls. Middleware that must run before route matching needs an explicit `UseRouting` placed after it. Middleware that must run between routing and authentication, CORS being the usual example, needs explicit `UseAuthentication` and `UseAuthorization` calls placed after it.

### Slim and Empty Builders

.NET 8 added two lighter builders for apps that care about startup time and binary size, typically ones published with [Native AOT](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/native-aot){:target="_blank" rel="noopener noreferrer"}, which compiles the app ahead of time to a native executable.

`WebApplication.CreateSlimBuilder(args)` keeps what a developer needs day to day: `appsettings.json` and `appsettings.{Environment}.json`, user secrets, console logging, and logging configuration. It drops these:

- Hosting startup assemblies and `UseStartup`
- The EventLog, Debug, and EventSource logging providers
- IIS integration and static web assets
- HTTPS endpoints and HTTP/3 in Kestrel (restore them with `builder.WebHost.UseKestrelHttpsConfiguration()` and `builder.WebHost.UseQuic()`)
- The `regex` route constraint

The missing HTTPS support rarely matters for an app behind a proxy that terminates TLS. The missing constraint does matter to an app whose routes use it, since the route throws an `InvalidOperationException` when routing first builds its matcher, until the constraint is registered again with `RouteOptions.SetParameterPolicy`.

`WebApplication.CreateEmptyBuilder(new WebApplicationOptions { Args = args })` goes further. It starts with no built-in behavior at all, not even a server, so the app has to call `builder.WebHost.UseKestrelCore()` and add each configuration source and logging provider it wants.

## Environments

The *environment* is a name the app reads once at startup and uses to switch behavior between a developer machine and a server. The framework defines three names, `Development`, `Staging`, and `Production`, but any string works, so teams can add names like `Testing` or `UAT`.

### Where the Name Comes From

The host reads the name from the `DOTNET_ENVIRONMENT` and `ASPNETCORE_ENVIRONMENT` environment variables. When an app built with `WebApplication` sets both, `DOTNET_ENVIRONMENT` wins. When neither is set, the environment is `Production`.

That default is deliberate. A deployed app that forgets to set the variable runs with production behavior, not with detailed error pages. Local runs get `Development` from `Properties/launchSettings.json`, which sets `ASPNETCORE_ENVIRONMENT` in its launch profiles. That file is used only on the developer's machine and isn't published with the app. Because command-line arguments outrank environment variables, `dotnet run -- --environment Staging` overrides the launch profile for a single run.

Code can also set the name, along with the content root and web root, by passing `WebApplicationOptions` to `CreateBuilder`:

```csharp
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    EnvironmentName = Environments.Staging,
    ContentRootPath = AppContext.BaseDirectory
});
```

This suits a host that must always run under one environment. Most apps leave the name to the deployment.

### What Changes by Environment

Several defaults follow the environment name without any app code:

| Behavior | Development | Other environments |
| --- | --- | --- |
| `appsettings.{Environment}.json` | `appsettings.Development.json` loads | The file for that name loads, if it exists |
| User secrets | Loaded | Not loaded |
| Developer exception page | Added automatically | Not added |
| DI validation (scope validation and validation on build, both covered below) | On by default | Off by default |

App code checks the environment with `app.Environment.IsDevelopment()`, `IsStaging()`, `IsProduction()`, or `IsEnvironment("Testing")` to go further, such as mapping an interactive API explorer only in Development or adding a production error handler:

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

When the check is needed while registering services, use `builder.Environment` instead, since `app` doesn't exist yet.

## Configuration in a Web App

Configuration in ASP.NET Core is the general .NET configuration system: a set of providers, each contributing key-value pairs, merged so that a later provider overrides an earlier one. What the web host adds is a default set of providers in a fixed order.

### Default Sources and Their Priority

From highest to lowest priority, `CreateBuilder` reads:

1. Command-line arguments
2. Environment variables without the `ASPNETCORE_` or `DOTNET_` prefix
3. User secrets, in Development only
4. `appsettings.{Environment}.json`
5. `appsettings.json`
6. Host configuration, as a fallback

The practical reading is that files hold defaults and the deployment environment overrides them. A value in `appsettings.json` loses to the same key in `appsettings.Production.json`, which loses to an environment variable, which loses to a command-line argument. That order is why containers are usually configured through environment variables. The same image runs everywhere, and each deployment supplies its own values.

Hierarchical keys use colons, as in `ConnectionStrings:Orders`, but colons don't work in environment variable names on every platform. A double underscore works everywhere, so `ConnectionStrings__Orders` is read as `ConnectionStrings:Orders`.

### Host Configuration Is Only a Fallback

Variables prefixed with `ASPNETCORE_` or `DOTNET_` feed *host* configuration, which settles what the host needs before the app's own configuration exists: the environment name, the content root, and the application name.

Other settings that look like host settings are read later, from app configuration, with host configuration only as the fallback beneath it. The URLs the server listens on are the common trap. `ASPNETCORE_URLS` sets the `urls` key in host configuration, but a `urls` value in `appsettings.json` is app configuration and overrides it, which surprises teams that expect the environment variable to win. Kestrel's own endpoint settings in the `Kestrel:Endpoints` section, and endpoints set in code, take priority over `urls` altogether.

### Binding to Options

Reading raw string keys throughout the code scatters configuration knowledge everywhere. The options pattern binds a section to a class once and injects it where needed:

```csharp
builder.Services.Configure<OrderSettings>(
    builder.Configuration.GetSection("Orders"));

public class OrderService(IOptions<OrderSettings> options)
{
    private readonly OrderSettings _settings = options.Value;
}
```

The choice between `IOptions`, `IOptionsSnapshot`, and `IOptionsMonitor`, validation at startup, and named options are general .NET topics covered in the [C# Configuration and Options Pattern guide](/study-guides/dotnet/c-sharp/libraries/configuration-and-options.html). User secrets keep development secrets out of source control, but they are a plain, unencrypted file. Production secrets come from the deployment environment or a secret store.

## Dependency Injection per Request

ASP.NET Core uses the standard .NET container. What the web host adds is a scope for every request, and that scope explains how the three lifetimes behave in a web app.

### The Root Provider and a Scope per Request

The container has one *root provider* that lives as long as the app and holds every singleton. When a request arrives, the framework creates a child *scope* from it, exposes that scope as `HttpContext.RequestServices`, and disposes it when the response completes, disposing the scoped services with it. Lifetimes map onto those two levels:

| Lifetime | In a web app |
| --- | --- |
| Singleton | One instance held by the root provider, shared by every concurrent request, so it must be thread-safe |
| Scoped | One instance per request scope, shared by everything that request resolves |
| Transient | A new instance every time the container resolves it |

The container also disposes what it creates. A disposable transient resolved during a request is disposed with the request scope, in reverse order of creation along with the scoped services. One resolved from the root provider is held until the app shuts down.

{% include figure.html id="dn-di-scopes" %}

Scoped is what makes per-request state safe. Entity Framework Core registers `DbContext` as scoped by default for this reason. Every class handling one request shares one context and one unit of work, and no two requests share a context. A service with no mutable state can be a singleton and avoid the per-request allocation.

Services arrive through constructor parameters in controllers, hubs, and services, and as handler parameters in minimal APIs. `RequestServices` exists for code the container doesn't create, but constructor injection keeps dependencies visible and testable.

A singleton that takes a scoped service in its constructor is a common DI bug in web apps. A singleton is created by the root provider, so a scoped service it receives in its constructor is created there too and lives as long as the app, effectively becoming a singleton itself. A captured `DbContext` ends up shared across concurrent requests, which it doesn't support. In Development, the container looks for this mistake. Scope validation throws when a scoped service is injected into a singleton or resolved from the root provider, and validation on build checks every registration when `Build()` runs, so most cases fail at startup. Both are off by default in other environments, so the same mistake goes unreported there unless the app turns them on with `builder.Host.UseDefaultServiceProvider(o => { o.ValidateScopes = true; o.ValidateOnBuild = true; })`. Lifetimes, captive dependencies, and keyed services in depth are covered in the [C# Dependency Injection guide](/study-guides/dotnet/c-sharp/libraries/dependency-injection.html).

### Resolving Scoped Services Outside a Request

Code that runs outside any request, such as seeding reference data at startup, has no request scope to borrow. It creates one and disposes it when done:

```csharp
var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<ReferenceDataSeeder>();
    await seeder.SeedAsync();
}
```

`CreateAsyncScope` is the form to prefer when scoped services hold asynchronously disposable resources, as a `DbContext` does.

## Organizing Program.cs as It Grows

A real app registers dozens of services and several middleware components, and a single `Program.cs` becomes hard to scan. The framework's own convention answers this. Each feature exposes one `Add{Feature}` extension method on `IServiceCollection`, like `AddControllers` or `AddAuthentication`, and apps can follow the same pattern for their own groups of registrations:

```csharp
namespace Microsoft.Extensions.DependencyInjection;

public static class OrderingServiceCollectionExtensions
{
    public static IServiceCollection AddOrdering(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<OrderSettings>(config.GetSection("Orders"));
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IPaymentService, PaymentService>();
        return services;
    }
}

// Program.cs
builder.Services.AddOrdering(builder.Configuration);
```

Placing the class in the `Microsoft.Extensions.DependencyInjection` namespace makes the method show up on `builder.Services` without an extra `using`. `Program.cs` then reads as a table of contents, with one line per feature followed by the pipeline.

Apps migrating from a `Startup` class map it directly. `ConfigureServices` becomes the registrations before `Build()`, and `Configure` becomes the pipeline after it. The old `Startup` model still works, but new code gains nothing from it.

## Key Takeaways

- `Program.cs` has two phases. Services and configuration are settled on the builder, `Build()` freezes the service collection, and the pipeline is arranged on `WebApplication`.
- `app.Run()` starts the hosted services, including the server, and a stop signal drains in-flight requests for up to 30 seconds before the process exits.
- `CreateBuilder` supplies configuration sources, logging providers, Kestrel, and host filtering, and `WebApplication` adds routing, authentication, authorization, and endpoint middleware when the app doesn't place them itself.
- The environment defaults to `Production` when nothing sets it, and it controls which settings file loads, whether user secrets load, and whether DI validation runs.
- Configuration layers files under environment variables under command-line arguments, and host configuration such as `ASPNETCORE_URLS` sits beneath all of them as a fallback.
- Every request gets a DI scope beneath the root provider. Scoped services live for one request, singletons are shared by all of them, and a singleton that captures a scoped service is caught by default only in Development.
