---
title: "Aspire Fundamentals"
layout: guide
category: "ASP.NET Core"
subcategory: "Aspire"
description: "How Aspire's AppHost models an application, injects each service's configuration, and pairs with ServiceDefaults, the dashboard, and hosting and client integrations."
tags: [aspire, apphost, orchestration, service-defaults, opentelemetry, fundamentals]
---

## What Aspire Solves

Running a distributed application locally means starting databases, caches, message brokers, and several service projects, then wiring them together with the right connection strings, ports, and configuration. Teams usually hold this together with Docker Compose files, environment variables scattered across launch profiles, and setup steps in a wiki that nobody keeps current. The result is fragile, slow to set up, and different on every developer's machine.

[Aspire](https://aspire.dev/){:target="_blank" rel="noopener noreferrer"} replaces that with an application model written in code. Running one project starts your APIs, workers, frontends, and backing containers together, and hands each service the addresses and credentials it needs. A shared ServiceDefaults project gives every .NET service the same OpenTelemetry, health check, resilience, and service discovery setup. A local dashboard collects logs, traces, and metrics from every service in one place.

The product was called .NET Aspire until version 13 (November 2025), which dropped the prefix. It now orchestrates Python and JavaScript apps as well as .NET projects, and the orchestrating project can be written in TypeScript as well as C# (generally available since Aspire 13.5). This guide uses C# throughout. A C# AppHost needs the .NET 10 SDK, although the services it runs can target .NET 8 or later. Running container resources locally needs a container runtime such as Docker Desktop or Podman.

Aspire is not a runtime and not a hosting platform. Your services still deploy as ordinary applications, and the application model's main job is the development loop.

## The Three Kinds of Project

An Aspire solution separates orchestration, shared service configuration, and the services themselves. Where each piece runs decides what it can do, so the split matters before any code does.

| Project | Runs where | Deployed? | Responsibility |
| --- | --- | --- | --- |
| **AppHost** | On the developer's machine, in integration tests, and when publishing deployment artifacts | Never | Declares every resource and how they connect; starts them all |
| **ServiceDefaults** | Inside every .NET service, as a referenced library | Yes, with each service | Telemetry, health checks, HTTP resilience, service discovery |
| **Service projects** | As their own processes | Yes | Application logic |

The **AppHost** is the orchestration entry point. You run it during development, and it starts your projects, their container dependencies, and the dashboard. It knows every resource because it declares them all, but nothing in production runs it.

The **ServiceDefaults** project is a shared class library that each service references and calls once at startup. Its project file sets `IsAspireSharedProject`. Unlike the AppHost, its code ships inside every service, so it is the place to put the team's policy for how each service reports telemetry, exposes health, and calls other services.

**Service projects** are ordinary .NET projects such as APIs, workers, and frontends. The AppHost references them to put them in the application model, but they have no compile-time dependency on the AppHost. They run without it as long as their connection strings and endpoints come from some other configuration source.

### Creating an Aspire Solution

The `aspire new` command in the Aspire CLI, or `dotnet new aspire-starter`, generates the three-project structure with sample services:

```
AspireSample/
  AspireSample.AppHost/          # Orchestration (the project you run)
  AspireSample.ServiceDefaults/  # Shared service configuration
  AspireSample.ApiService/       # Minimal API
  AspireSample.Web/              # Blazor frontend
```

The starter can also add a test project. Running the AppHost, from an IDE or with `aspire run`, starts both services and the dashboard, with telemetry, health checks, and service discovery already working.

## The AppHost and the Application Model

The AppHost's `Program.cs` defines the application's topology, in code that declares which resources the application consists of and how they relate. The dashboard's resource list and the deployment tooling both read from that model.

### Building the Application Model

`DistributedApplication.CreateBuilder()` creates a builder, and each `Add` call registers a resource:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

// Container-based infrastructure
var cache = builder.AddRedis("cache");
var db = builder.AddPostgres("postgres")
    .AddDatabase("catalogdb");

// .NET projects, wired to their dependencies
var catalogApi = builder.AddProject<Projects.CatalogApi>("catalog-api")
    .WithReference(db)
    .WithReference(cache);

var frontend = builder.AddProject<Projects.WebFrontend>("web-frontend")
    .WithReference(catalogApi)
    .WaitFor(catalogApi)
    .WithExternalHttpEndpoints();

builder.Build().Run();
```

`AddRedis("cache")` runs a Redis container under the resource name "cache." `AddPostgres("postgres").AddDatabase("catalogdb")` runs a PostgreSQL container and adds a database resource named "catalogdb," which Aspire creates in that server if it doesn't already exist. `AddProject<T>("name")` adds a .NET project. `WithExternalHttpEndpoints()` marks the frontend's endpoints as reachable from outside the application, which matters once it's deployed. Without it, a project's endpoints are meant only for other resources in the model.

The `T` in `AddProject<T>()` comes from a `Projects` class that the Aspire SDK generates at build time, with one type for each project the AppHost references. Renaming or removing a service project breaks the AppHost's build rather than failing at run time.

### Wiring Resources with WithReference

`WithReference()` declares that one resource depends on another, and at startup the AppHost turns each reference into environment variables on the dependent service. The shape of those variables depends on what is referenced:

| Referenced resource | What the dependent service receives | Read by |
| --- | --- | --- |
| A resource with a connection string (database, cache, broker) | `ConnectionStrings__catalogdb` | `IConfiguration.GetConnectionString("catalogdb")` and client integrations |
| A project's endpoints | `services__catalog-api__https__0` and similar | .NET service discovery |
| The same project's endpoints, for any language | `CATALOG_API_HTTPS` (name uppercased, hyphens become underscores) | Any code that reads environment variables |
| Some resources' individual properties (since Aspire 13) | `CATALOGDB_URI`, `CATALOGDB_HOST`, `CATALOGDB_PORT`, and so on | Non-.NET services, or code that wants one part |

.NET's configuration system maps the double underscore to its `:` separator, so `ConnectionStrings__catalogdb` arrives as the `ConnectionStrings:catalogdb` connection string with no code in the service. Nobody copies connection strings into `appsettings.json`. The AppHost started the container, so it already knows the port, host name, and generated password.

A reference passes configuration and records the dependency, which the dashboard's graph draws. It doesn't make the dependent wait for the dependency to be ready. That is `WaitFor()`, which the frontend in the sample uses to hold its start until the catalog API is running (and healthy, if the resource declares a health check).

{% include figure.html id="asp-aspire-run-model" %}

### Configuring Resources

Resources take further configuration through fluent methods: environment variables, endpoints, volumes, container image tags, and companion tools.

```csharp
var db = builder.AddPostgres("postgres")
    .WithDataVolume("postgres-data")
    .WithPgAdmin()
    .AddDatabase("catalogdb");

var cache = builder.AddRedis("cache")
    .WithRedisInsight();
```

`WithDataVolume()` mounts a named container volume, so the database's data survives an AppHost restart. Without it, every run starts from an empty database. `WithPgAdmin()` and `WithRedisInsight()` add a browser-based management UI as a separate container next to the resource. Aspire leaves those UI containers out when it publishes the application for deployment, so they exist only in the development loop.

### Parameters and Environment Variables

`WithReference()` covers configuration that comes from another resource. Values that come from outside the model, such as an API key or a feature flag, are declared as parameters and passed on with `WithEnvironment()`:

```csharp
var stripeKey = builder.AddParameter("stripe-key", secret: true);

builder.AddProject<Projects.CatalogApi>("catalog-api")
    .WithEnvironment("Stripe__ApiKey", stripeKey);
```

The AppHost reads a parameter's value from its own configuration under `Parameters:stripe-key`, so user secrets, `appsettings.json`, or an environment variable can supply it. When a value is missing in a local run, the dashboard or CLI prompts for it. Marking a parameter `secret` tells the tooling to treat the value as sensitive, including when you publish.

### Resources That Aren't .NET Projects

`AddProject<T>()` is one entry point among several. `AddContainer()` runs any container image and `AddExecutable()` runs any local executable. The Python and JavaScript hosting integrations add `AddPythonApp()`, `AddUvicornApp()`, `AddJavaScriptApp()`, and `AddViteApp()`, each pointed at an app directory:

```csharp
var api = builder.AddProject<Projects.CatalogApi>("catalog-api");

builder.AddViteApp("storefront", "../storefront")
    .WithReference(api);
```

These resources take part in `WithReference()` like any other. A non-.NET service doesn't use ServiceDefaults, though. It reads the injected environment variables itself, such as `CATALOG_API_HTTPS` for the API's address, and its telemetry reaches the dashboard only if it sets up its own OpenTelemetry SDK.

### What Happens When You Run the AppHost

Running the AppHost pulls and starts the container images, launches each project with its injected environment variables, and starts the dashboard. Your whole distributed application runs from one F5 in an IDE, which also opens the dashboard in a browser, or from `aspire run`, which prints the dashboard's link.

## Service Defaults

The ServiceDefaults project contains an extension method, `AddServiceDefaults()`, that each service calls during startup. That one call gives every service the same cross-cutting setup.

### What AddServiceDefaults Configures

The template's version configures four things.

**OpenTelemetry** for logs, traces, and metrics, with ASP.NET Core, `HttpClient`, and .NET runtime instrumentation. The exporter speaks OTLP, the OpenTelemetry Protocol, and it is switched on only when the `OTEL_EXPORTER_OTLP_ENDPOINT` setting is present. The AppHost sets it on every project to point at the dashboard. In production you set it to your own collector or backend, and the service code doesn't change.

**Health checks**, with a `self` check tagged `live`. `MapDefaultEndpoints()` exposes them as `/health`, which runs every registered check, and `/alive`, which runs only the checks tagged `live`. The template maps both endpoints **only in the Development environment**, because health endpoints expose information about the service. A production deployment whose orchestrator probes the service for liveness or readiness has to map its own endpoints and decide how to protect them.

**HTTP resilience** through `ConfigureHttpClientDefaults`, which adds the standard resilience handler from `Microsoft.Extensions.Http.Resilience` (built on Polly) to every client created by `IHttpClientFactory`. Calls to other services then get retries with backoff, timeouts, and a circuit breaker by default.

**Service discovery**, which lets one service call another by resource name instead of `localhost` and a port. It resolves names from the configuration the AppHost injected.

### How Services Consume ServiceDefaults

Each service calls `AddServiceDefaults()` on the builder and `MapDefaultEndpoints()` on the built app:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddScoped<ICatalogService, CatalogService>();

var app = builder.Build();

app.MapDefaultEndpoints(); // /health and /alive, in Development only
app.MapGet("/products", (ICatalogService catalog) => catalog.GetProductsAsync());

app.Run();
```

The split follows ASP.NET Core's own: services are registered on the builder, and endpoints are mapped on the built app.

### Inside the ServiceDefaults Project

The template generates an `Extensions.cs` that you own and edit. Its core, lightly trimmed:

```csharp
public static class Extensions
{
    private const string HealthEndpointPath = "/health";
    private const string AlivenessEndpointPath = "/alive";

    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.ConfigureOpenTelemetry();
        builder.AddDefaultHealthChecks();
        builder.Services.AddServiceDiscovery();

        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();
            http.AddServiceDiscovery();
        });

        return builder;
    }

    public static TBuilder ConfigureOpenTelemetry<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation())
            .WithTracing(tracing => tracing
                .AddSource(builder.Environment.ApplicationName)
                .AddAspNetCoreInstrumentation(options =>
                    // Keep health probes out of the traces
                    options.Filter = context =>
                        !context.Request.Path.StartsWithSegments(HealthEndpointPath)
                        && !context.Request.Path.StartsWithSegments(AlivenessEndpointPath))
                .AddHttpClientInstrumentation());

        if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
        {
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }

        return builder;
    }

    public static TBuilder AddDefaultHealthChecks<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);

        return builder;
    }

    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapHealthChecks(HealthEndpointPath);
            app.MapHealthChecks(AlivenessEndpointPath, new HealthCheckOptions
            {
                Predicate = r => r.Tags.Contains("live")
            });
        }

        return app;
    }
}
```

The methods are generic over `IHostApplicationBuilder`, so a worker service that uses `Host.CreateApplicationBuilder` gets the same defaults as a web API. Because the file belongs to the solution, it is where team policy goes. If every service should trace database queries, one instrumentation call in `ConfigureOpenTelemetry()` covers them all, and a health check every service must run goes in `AddDefaultHealthChecks()`. Service teams then get consistent telemetry and resilience without each one learning the OpenTelemetry and Polly configuration.

## The Aspire Dashboard

The AppHost starts a dashboard alongside your resources. It is a full OpenTelemetry viewer, fed by the OTLP exporter that ServiceDefaults configures in each service.

### What the Dashboard Shows

| View | Shows |
| --- | --- |
| **Resources** | Every project, container, and executable with its state, endpoints, environment variables, and actions such as restart. A graph view draws the resources and the references between them |
| **Console logs** | Raw standard output from each resource, including output from before logging starts and from containers that don't emit OpenTelemetry |
| **Structured logs** | Log entries from every service in one searchable stream, filterable by resource, level, and any property |
| **Traces** | Distributed traces across service boundaries, with the timing of each span |
| **Metrics** | Each service's metrics as charts or tables, such as request duration and .NET runtime counters |

### Working with the Dashboard

The dashboard's address comes from the AppHost's `launchSettings.json`. Because it shows environment variables and other sensitive data, it requires a browser token. Launching from Visual Studio or VS Code signs you in automatically. From the command line, the console prints a login link that carries the token.

A typical session starts in Resources to confirm everything started, then moves to Traces to follow a request. If a request from the frontend to the catalog API is slow, the trace shows whether the time went to the database query, a cache miss, or the call between services. Log entries written during a traced request link to that trace, so you can move from a suspicious log line to the whole request.

### The Dashboard Outside Development

The dashboard is a development tool, not production monitoring. It also runs [standalone](https://aspire.dev/dashboard/standalone/){:target="_blank" rel="noopener noreferrer"}, as the `mcr.microsoft.com/dotnet/aspire-dashboard` container image or with `aspire dashboard run`, and accepts OTLP from any application. A team can adopt it as a local telemetry viewer before adopting the AppHost at all.

## Integrations

Aspire integrations are NuGet packages that remove the boilerplate of connecting to infrastructure. Each comes in two halves, one for each side of the AppHost/service split.

### Hosting Integrations

Hosting integrations are used in the AppHost to model resources. They know how to run the container, which port to expose, and what connection information to hand to dependents. `builder.AddRedis("cache")` comes from `Aspire.Hosting.Redis`, which pulls the Redis image, starts it, assigns a port, and builds the connection string that `WithReference()` passes on.

First-party hosting integrations cover the usual databases, caches, brokers, and search engines (PostgreSQL, SQL Server, MongoDB, Redis, RabbitMQ, Kafka, Elasticsearch, Qdrant, and others) and Azure services such as Storage, Service Bus, and Cosmos DB, which can often run against a local emulator. Hosting integrations for Python and JavaScript apps are what put non-.NET services in the same model. The [integrations overview](https://aspire.dev/integrations/overview/){:target="_blank" rel="noopener noreferrer"} lists the current set.

### Client Integrations

Client integrations are used in the service projects. Each one registers the client library in dependency injection, reads its connection string from the configuration the AppHost injected, and adds a health check and OpenTelemetry instrumentation for that client. You make one call instead of registering the client, a health check, and telemetry separately.

Client integrations are .NET packages. A Python or JavaScript service reads the injected environment variables itself.

### Both Halves for the Same Resource

The two halves meet at the resource name. In the AppHost:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");
var orders = builder.AddPostgres("pg").AddDatabase("orders");

builder.AddProject<Projects.OrdersApi>("orders-api")
    .WithReference(cache)
    .WithReference(orders);

builder.Build().Run();
```

In the OrdersApi project:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.AddRedisDistributedCache("cache");            // Aspire.StackExchange.Redis.DistributedCaching
builder.AddNpgsqlDbContext<OrdersDbContext>("orders"); // Aspire.Npgsql.EntityFrameworkCore.PostgreSQL

var app = builder.Build();
app.MapDefaultEndpoints();
// ... map your API endpoints
app.Run();
```

`"cache"` in `AddRedisDistributedCache("cache")` matches `AddRedis("cache")` in the AppHost, because the client reads `ConnectionStrings:cache`. The same holds for `"orders"`. A mismatched name is the usual reason a client integration throws at startup for a missing connection string.

`AddRedisDistributedCache` registers `IDistributedCache` and the underlying `IConnectionMultiplexer`, with a Redis health check and tracing. `AddNpgsqlDbContext` registers the `DbContext` with context pooling on by default, a health check that calls EF Core's `CanConnectAsync`, and database telemetry. Every service that uses Redis or PostgreSQL gets the same checks and telemetry without repeating the setup.

### Community and Custom Integrations

The [Aspire Community Toolkit](https://github.com/CommunityToolkit/Aspire){:target="_blank" rel="noopener noreferrer"} publishes integrations outside the first-party set, such as Ollama, Dapr, and Go and Java apps. The integration model is open, so a team can write its own hosting integration for internal infrastructure. If several teams depend on an internal broker or service, packaging it as an integration lets each AppHost add it in one call with the same `Add`/`WithReference` pattern.

## When Aspire Fits and When It Doesn't

Aspire fits applications made of several services that share infrastructure: a few APIs, a worker or two, and the databases, caches, and brokers behind them. It removes the manual orchestration that slows local development, and ServiceDefaults gives every service the same telemetry and resilience with one call. Since Aspire 13 the services don't all have to be .NET, so a stack with a Python or JavaScript service is no longer a reason to stay on Docker Compose.

It adds little to an application that is one process. A single API with one database gains a second and third project and not much else, although the standalone dashboard can still be useful there.

It doesn't replace production tooling. Kubernetes or a managed container platform still runs the services, Terraform or Bicep still provisions infrastructure, and your pipeline still deploys. Aspire can generate deployment artifacts from the application model, but it doesn't own the production environment.

The clearest signal that Aspire fits is developers spending time on plumbing rather than features: starting containers by hand, copying connection strings, debugging telemetry setup, or working out why service A can't reach service B on one machine. Aspire moves that plumbing into code that runs the same way on every machine.

## Key Takeaways

- The AppHost declares the application and runs during development, testing, and publishing, but is never deployed. ServiceDefaults ships inside every service. Service projects hold the application logic and don't depend on the AppHost.
- `WithReference()` turns a dependency into environment variables: `ConnectionStrings__<name>` for resources with a connection string, `services__<name>__…` for .NET service discovery, and uppercase variables for any language. It doesn't wait for the dependency; `WaitFor()` does.
- ServiceDefaults is team policy in code. Its template enables OTLP export only when an endpoint is configured, and maps `/health` and `/alive` only in Development.
- The dashboard is a local OpenTelemetry viewer. Production uses the same telemetry pointed at a different endpoint.
- Hosting integrations model resources in the AppHost, and client integrations consume them in services. The resource name joins the two.
