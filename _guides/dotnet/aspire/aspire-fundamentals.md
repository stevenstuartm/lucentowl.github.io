---
title: ".NET Aspire Fundamentals"
layout: guide
category: "ASP.NET Core"
subcategory: ".NET Aspire"
description: "The .NET Aspire application model, project structure, service defaults, dashboard, and integrations for building cloud-native .NET applications."
tags: [aspire, cloud-native, orchestration, distributed-systems, observability, service-discovery, dotnet]
---

## What .NET Aspire Solves

Building a distributed .NET application locally means spinning up databases, caches, message brokers, and multiple service projects, then wiring them all together with the right connection strings, ports, and configuration. Developers often cobble this together with Docker Compose files, environment variables scattered across launch profiles, and manual steps documented in a wiki that nobody keeps current. The experience is fragile, time-consuming, and different on every developer's machine.

[.NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview){:target="_blank" rel="noopener noreferrer"} addresses this by providing an opinionated orchestration layer for .NET applications. It handles local service composition so that running a single project starts your APIs, workers, containers, and backing services together. It standardizes cross-cutting concerns like OpenTelemetry, health checks, and HTTP resilience through a shared configuration project. And it provides a local dashboard that aggregates logs, traces, and metrics from every service in one place, giving you production-grade observability during development without manual instrumentation.

Aspire is not a deployment platform or a runtime. It is a development-time orchestration and configuration framework that also produces deployment manifests for tools like the Azure Developer CLI or custom provisioning pipelines. Your services still deploy as normal .NET applications; Aspire just makes the path from local development to production more consistent and less manual.

## The Aspire Project Structure

Aspire applications follow a three-project pattern that separates orchestration, shared configuration, and your actual services.

### AppHost

The AppHost project is the orchestration entry point. You run this project during development, and it starts everything your application needs: your .NET projects, container dependencies like Redis or PostgreSQL, and the Aspire dashboard. The AppHost defines which resources compose your application and how they connect to each other. It does not deploy to production. Think of it as the conductor that knows what instruments are in the orchestra and ensures they all start playing together.

### ServiceDefaults

The ServiceDefaults project is a shared class library that every service in your application references. It configures cross-cutting concerns like OpenTelemetry for traces, metrics, and logs, along with health check endpoints, HTTP client resilience with retry and circuit breaker policies, and service discovery so that services can find each other by name rather than by hardcoded URLs. Unlike the AppHost, ServiceDefaults ships with your services to production. It represents your team's shared policy for how every service should behave regarding observability, resilience, and discovery.

### Service Projects

Your actual service projects, such as APIs, workers, and frontends, are standard .NET projects that reference ServiceDefaults. They contain your application logic and are the projects that deploy to production. The AppHost references these projects to include them in the orchestration graph, but the projects themselves have no compile-time dependency on the AppHost.

### Scaffolding a New Aspire Application

The `dotnet new aspire-starter` template generates this three-project structure automatically:

```
MyApp/
  MyApp.AppHost/          # Orchestration (startup project)
  MyApp.ServiceDefaults/  # Shared cross-cutting concerns
  MyApp.ApiService/       # Example API project
  MyApp.Web/              # Example Blazor frontend
```

The AppHost project is set as the startup project. Running it launches all referenced services, spins up any container dependencies, and opens the Aspire dashboard. You get a working distributed application with telemetry, health checks, and service discovery from the first `dotnet run`.

## The AppHost and the Application Model

The AppHost project's `Program.cs` is where you define your application's topology. This is the core concept in Aspire: a declarative model that describes what resources your application consists of and how they relate to each other.

### Building the Application Model

The entry point uses `DistributedApplication.CreateBuilder()` to create a builder, then adds resources to describe the application graph:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

// Add container-based infrastructure
var cache = builder.AddRedis("cache");
var db = builder.AddPostgres("postgres")
    .AddDatabase("catalogdb");

// Add .NET projects and wire up their dependencies
var catalogApi = builder.AddProject<Projects.CatalogApi>("catalog-api")
    .WithReference(db)
    .WithReference(cache);

var frontend = builder.AddProject<Projects.WebFrontend>("web-frontend")
    .WithReference(catalogApi)
    .WithExternalHttpEndpoints();

builder.Build().Run();
```

Each `Add` call registers a resource in the application model. `AddRedis("cache")` tells Aspire to run a Redis container with the logical name "cache." `AddPostgres("postgres").AddDatabase("catalogdb")` runs a PostgreSQL container and creates a database named "catalogdb" within it. `AddProject<T>("name")` registers a .NET project as a service in the graph.

The `AddProject<T>()` method uses a source-generated type reference that points to a specific project in the solution. The Aspire SDK generates a `Projects` class at build time containing type references for each project in the AppHost's dependency graph. This provides compile-time safety: if you rename or remove a project, the AppHost fails to build rather than failing at runtime.

### Wiring Resources with WithReference

The `WithReference()` method is how you express dependencies between resources. When the catalog API calls `.WithReference(db)`, Aspire automatically injects the correct connection string into the catalog API's configuration at startup. When the frontend calls `.WithReference(catalogApi)`, Aspire configures service discovery so the frontend can reach the catalog API by name.

This wiring replaces the manual process of copying connection strings into `appsettings.json` or environment variables. The AppHost knows the ports, hostnames, and credentials for every resource because it started them. It passes that information to dependent services through .NET's standard configuration system using the `ConnectionStrings` configuration section.

The dependency graph is also visible in the dashboard. If a container resource fails to start, the dashboard shows which services depend on it and are therefore unable to function. This makes startup failures in a multi-service application much easier to diagnose than tailing log files from several terminal windows.

### Configuring Resources

Resources support additional configuration through fluent methods. You can set environment variables, configure ports, mount volumes, and control resource behavior:

```csharp
var db = builder.AddPostgres("postgres")
    .WithDataVolume("postgres-data")
    .WithPgAdmin()
    .AddDatabase("catalogdb");

var cache = builder.AddRedis("cache")
    .WithRedisCommander();
```

The `WithDataVolume()` call creates a named Docker volume so that database data persists across restarts. `WithPgAdmin()` and `WithRedisCommander()` add companion management UI containers alongside the infrastructure resource. These management tools run only during development and give you browser-based access to inspect your data without installing additional local tools.

You can also pass configuration parameters to resources, set custom container images, and configure health check intervals. The fluent API is designed to handle common development scenarios without requiring you to drop down to raw Docker configuration.

### What Happens When You Run the AppHost

Running the AppHost project triggers a sequence of operations. Aspire pulls and starts the required container images for infrastructure dependencies like Redis and PostgreSQL. It launches each .NET project with the appropriate environment variables and configuration injected. It starts the Aspire dashboard, which connects to the telemetry streams from all running resources. The result is your entire distributed application running locally from a single `F5` or `dotnet run` command.

## Service Defaults

The ServiceDefaults project contains an extension method, typically named `AddServiceDefaults()`, that each service calls during startup. This single method call applies a consistent set of cross-cutting behaviors across every service in the application.

### What AddServiceDefaults Configures

A typical ServiceDefaults implementation configures four areas.

**OpenTelemetry** is set up with exporters for traces, metrics, and logs using the OTLP protocol. This means every HTTP request, database call, and custom span is captured and exported to whatever backend is listening. During local development, the Aspire dashboard acts as the collector. In production, the same telemetry flows to backends like Azure Monitor, Jaeger, or Grafana without changing your service code.

**Health check endpoints** are registered at `/health` for a full readiness check and `/alive` for a liveness probe. These endpoints follow the patterns that container orchestrators like Kubernetes expect for determining whether a service should receive traffic or needs a restart.

**HTTP client resilience** is configured through `Microsoft.Extensions.Http.Resilience`, which adds retry policies with exponential backoff and circuit breaker patterns to all `HttpClient` instances created through the `IHttpClientFactory`. This means service-to-service calls automatically retry on transient failures and stop hammering a failing downstream service. The standard resilience handler includes configurable retry counts, jitter to prevent thundering herd scenarios, and timeout policies. These defaults work well for most service-to-service communication and can be customized per-client when specific endpoints require different behavior.

**Service discovery** enables services to call each other by name. Instead of configuring `http://localhost:5123` as the address for the catalog API, the frontend simply uses `http://catalog-api` and the service discovery system resolves it at runtime. During local development, the AppHost provides the resolution by injecting endpoint information as configuration. In production, you can configure DNS-based discovery, Kubernetes service resolution, or other mechanisms. The service code stays the same regardless of the discovery backend because it always refers to services by their logical name.

### How Services Consume ServiceDefaults

Each service project calls `AddServiceDefaults()` early in its `Program.cs` and maps the health check endpoints after building:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Register your application services
builder.Services.AddScoped<ICatalogService, CatalogService>();

var app = builder.Build();

app.MapDefaultEndpoints(); // Maps /health and /alive
app.MapControllers();

app.Run();
```

The `MapDefaultEndpoints()` call registers the health check endpoints that `AddServiceDefaults()` configured. This two-step pattern (add defaults on the builder, map endpoints on the app) follows the same builder/app separation that ASP.NET Core uses for middleware registration.

### The Typical ServiceDefaults Pattern

The `Extensions.cs` file in the ServiceDefaults project follows this general structure:

```csharp
public static class Extensions
{
    public static IHostApplicationBuilder AddServiceDefaults(
        this IHostApplicationBuilder builder)
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

    private static IHostApplicationBuilder ConfigureOpenTelemetry(
        this IHostApplicationBuilder builder)
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation();
            });

        builder.AddOpenTelemetryExporters();

        return builder;
    }

    private static IHostApplicationBuilder AddDefaultHealthChecks(
        this IHostApplicationBuilder builder)
    {
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy());

        return builder;
    }
}
```

Teams can customize this file to add additional telemetry instrumentation, change resilience policies, or register custom health checks. If a team decides that all services should include database query instrumentation in their traces, they add the relevant instrumentation call to `ConfigureOpenTelemetry()` once, and every service picks it up. If the security team requires a specific health check pattern, it goes into `AddDefaultHealthChecks()`. The ServiceDefaults project acts as a policy layer that enforces consistency without requiring each service team to understand the details of OpenTelemetry configuration or resilience patterns.

## The Aspire Dashboard

When you run the AppHost, Aspire launches a local dashboard that provides a unified view of your entire distributed application. This dashboard is not a simple log viewer; it is a full observability tool built on the OpenTelemetry data that ServiceDefaults collects from every service.

### What the Dashboard Shows

The dashboard provides several views. The **Resources** view shows every project and container in your application model along with its current status, endpoint URLs, and environment variables. You can see at a glance which services are running, which containers have started, and whether anything has failed.

The **Structured Logs** view aggregates log output from all services into a single, searchable stream. Logs are structured rather than plain text, so you can filter by service, severity, or any property in the log entry. This replaces the experience of switching between multiple terminal windows to find the right log output.

The **Traces** view displays distributed traces that follow requests across service boundaries. If the frontend calls the catalog API, which queries PostgreSQL and checks the Redis cache, the trace shows the entire request flow with timing for each step. This makes it straightforward to identify where latency originates in a multi-service request.

The **Metrics** view surfaces runtime and application metrics from each service, including request rates, error rates, response times, and system-level metrics like CPU and memory usage.

The **Console** view provides raw stdout and stderr output from each resource, which is useful for debugging startup failures or container issues that happen before structured logging initializes.

### Navigating the Dashboard in Practice

The dashboard launches automatically when you run the AppHost and opens in your default browser. It binds to a random port by default, though you can configure a fixed port in the AppHost's launch settings. The URL is printed to the console output when the AppHost starts.

The most common workflow during development involves using the Resources view to confirm everything started correctly, then switching to Traces when debugging request flow between services. If a request from the frontend to the catalog API is slow, the trace view shows exactly which step introduced latency: was it the database query, the Redis cache miss, or network overhead between services? This kind of visibility is typically only available through production monitoring tools, but the dashboard brings it to the inner development loop.

The Structured Logs view supports filtering by resource name, severity level, and log properties. You can isolate logs from a specific service during a specific time window, which is far more efficient than scrolling through interleaved console output from multiple processes. Log entries that are part of a trace include links to the associated trace, making it straightforward to move from a log entry to a full request flow visualization.

### The Dashboard Beyond Local Development

The Aspire dashboard is primarily a local development tool, but the telemetry it consumes is standard OpenTelemetry. In production, the same traces, metrics, and logs flow to whatever backend your infrastructure uses, such as Azure Application Insights, Jaeger, Prometheus, or Grafana. Switching from local dashboard to production observability requires no code changes in your services because the ServiceDefaults project configures OTLP exporters that work with any compatible collector.

The dashboard is also available as a [standalone container image](https://learn.microsoft.com/en-us/dotnet/aspire/fundamentals/dashboard/standalone){:target="_blank" rel="noopener noreferrer"} that you can run without the full Aspire stack. Teams that want the dashboard's trace and log visualization for non-Aspire applications can point their OpenTelemetry exporters at the standalone dashboard container. This makes the dashboard useful even in organizations that adopt Aspire incrementally: you can start with the dashboard as a local observability tool before committing to the full AppHost orchestration model.

## Integrations

Aspire integrations are NuGet packages that handle the boilerplate of connecting your services to infrastructure dependencies. Each integration comes in two parts that work together across the AppHost and service projects.

### Hosting Integrations

Hosting integrations are used in the AppHost project to define infrastructure resources. These packages know how to run containers, configure ports, create databases, and manage resource lifecycle. When you call `builder.AddRedis("cache")` in the AppHost, the `Aspire.Hosting.Redis` package handles pulling the Redis container image, starting it, assigning a port, and exposing the connection information to dependent services.

Hosting integrations are available for a wide range of infrastructure including PostgreSQL, SQL Server, MySQL, MongoDB, Redis, RabbitMQ, Kafka, Elasticsearch, and Azure services like Azure Storage, Azure Service Bus, and Azure Cosmos DB. The [integration list](https://learn.microsoft.com/en-us/dotnet/aspire/fundamentals/integrations-overview){:target="_blank" rel="noopener noreferrer"} continues to grow as the ecosystem matures.

### Client Integrations

Client integrations are used in the service projects that consume infrastructure resources. These packages configure the client libraries with health checks, OpenTelemetry instrumentation, connection management, and the connection string that the AppHost provides. Instead of manually registering a Redis health check, adding Redis instrumentation to your OpenTelemetry setup, and parsing a connection string from configuration, the client integration does all of this in a single call.

### Hosting and Client Integrations Working Together

The two-part model becomes clear when you see both sides for the same resource. Here is how Redis and PostgreSQL look across the AppHost and a service project.

In the **AppHost** `Program.cs`:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");
var postgres = builder.AddPostgres("pg").AddDatabase("orders");

builder.AddProject<Projects.OrdersApi>("orders-api")
    .WithReference(cache)
    .WithReference(postgres);

builder.Build().Run();
```

In the **OrdersApi** `Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Client integration for Redis
builder.AddRedisDistributedCache("cache");

// Client integration for PostgreSQL via EF Core
builder.AddNpgsqlDbContext<OrdersDbContext>("orders");

var app = builder.Build();
app.MapDefaultEndpoints();
// ... map your API endpoints
app.Run();
```

The logical names matter. The `"cache"` string in `AddRedisDistributedCache("cache")` matches the `"cache"` name used in the AppHost's `AddRedis("cache")`. Aspire uses this name to inject the correct connection string into the service at runtime. The same applies to the `"orders"` database name. You never hardcode a connection string; the AppHost manages the mapping.

The `AddRedisDistributedCache` call from the `Aspire.StackExchange.Redis.DistributedCaching` package does more than register a cache. It also registers a health check that verifies Redis connectivity, adds OpenTelemetry instrumentation for Redis operations, and configures connection multiplexing. The `AddNpgsqlDbContext` call from `Aspire.Npgsql.EntityFrameworkCore.PostgreSQL` similarly registers the DbContext with the connection string from the AppHost, adds a PostgreSQL health check, configures OpenTelemetry instrumentation for database queries, and sets up connection pooling.

This pattern keeps infrastructure wiring consistent across services. Every team that uses Redis gets the same health checks, the same telemetry, and the same resilience configuration without duplicating setup code.

### Community and Third-Party Integrations

Beyond the Microsoft-published integrations, the Aspire ecosystem includes community-contributed integrations for infrastructure like Milvus, Qdrant, Seq, Grafana, and others. The integration model is extensible, so teams can create custom hosting integrations for internal infrastructure that follows the same `Add`/`WithReference` pattern. If your organization runs a custom message broker or an internal service that multiple teams depend on, you can package it as an Aspire hosting integration so that every team's AppHost can include it with a single method call.

## When Aspire Fits and When It Doesn't

Aspire is a strong fit for teams building distributed .NET applications with multiple services that share infrastructure dependencies. If your application consists of several APIs, a worker service or two, and backing services like databases and caches, Aspire eliminates the manual orchestration that typically slows down local development. It is also valuable for teams that want consistent observability across services without the overhead of manually configuring OpenTelemetry in every project. The ServiceDefaults project turns production-grade telemetry into a one-line setup call.

Aspire is less relevant for applications that do not involve distributed services or container dependencies. A single ASP.NET Core API with a database does not need orchestration across multiple projects. Static websites, desktop applications, and mobile backends with no container dependencies gain little from the Aspire model. If your application runs as a single process with no external dependencies to coordinate, the three-project structure adds complexity without corresponding benefit.

Aspire does not replace your production infrastructure tools. It is not a substitute for Docker Compose in scenarios where non-.NET services dominate the stack, although it can replace Docker Compose for .NET-centric applications. It does not replace Kubernetes for production orchestration, Terraform or Bicep for infrastructure provisioning, or your CI/CD pipeline. Aspire generates deployment manifests that these tools can consume, but it does not own your production environment.

The clearest signal that Aspire fits is when developers on your team spend meaningful time on "plumbing" rather than building features: starting containers manually, copying connection strings, debugging telemetry configuration, or troubleshooting why service A cannot reach service B locally. Aspire absorbs that plumbing into a declarative model that works the same way on every developer's machine.

### Deployment Manifests and the Path to Production

While Aspire is primarily a development-time tool, it bridges the gap to production through deployment manifest generation. The `azd` (Azure Developer CLI) can read an Aspire AppHost and generate the corresponding Azure infrastructure: container apps, databases, caches, and networking. This means the topology you define in `Program.cs` translates directly into deployment artifacts without maintaining a separate infrastructure definition.

For teams not using Azure, Aspire can generate Docker Compose files or Kubernetes manifests from the application model. The `dotnet run --publisher manifest` command produces a JSON manifest that deployment tools can consume. This approach ensures that the application topology defined in code remains the single source of truth, reducing the drift between what developers run locally and what gets deployed.

That said, most mature organizations already have established deployment pipelines and infrastructure-as-code practices. In those environments, Aspire's manifest generation is useful as a reference or starting point rather than a replacement for existing Terraform, Bicep, or Helm configurations. The development-time orchestration value stands on its own regardless of whether you adopt the deployment manifest features.

## Key Takeaways

The Aspire application model separates concerns cleanly: the AppHost handles orchestration, ServiceDefaults handles shared policy, and service projects handle business logic. This separation means that infrastructure wiring changes happen in one place rather than across every service.

The `WithReference()` model for connecting resources eliminates manual connection string management and makes the dependency graph between services explicit in code. Reading an AppHost's `Program.cs` tells you exactly what the application consists of and how its parts connect.

Integrations handle the tedious work of registering health checks, configuring telemetry instrumentation, and managing connections for each infrastructure dependency. The two-part hosting and client integration model keeps the AppHost focused on topology while service projects stay focused on consuming resources with best-practice configuration applied automatically.

The Aspire dashboard provides local observability that matches the fidelity of production monitoring tools. Because it is built on OpenTelemetry, the same telemetry data flows to production backends without code changes. This consistency between local development and production observability reduces the gap between "it works on my machine" and "it works in production."
