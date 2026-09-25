---
title: "Aspire Distributed Applications"
layout: guide
category: "ASP.NET Core"
subcategory: "Aspire"
description: "Building a multi-service application with Aspire: service discovery, backing services in development and production, existing infrastructure, service-to-service communication, integration testing, and publishing to Docker Compose, Kubernetes, or Azure."
tags: [aspire, service-discovery, deployment, integration-testing, microservices, practical]
---

## One AppHost for the Whole System

Once an application grows past a single API, the hard parts move between services: which service calls which, where each one's database lives, what starts first, and how the same topology gets from a laptop to a cluster. Aspire puts all of that in one AppHost, which declares every project and backing service with `Add` calls and connects them with `WithReference()`.

A realistic system has a public gateway, an internal order service, and a background worker, sharing PostgreSQL, Redis, and RabbitMQ, plus a one-shot service that applies database migrations:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var redis = builder.AddRedis("cache");
var ordersDb = builder.AddPostgres("postgres").AddDatabase("orders-db");
var rabbit = builder.AddRabbitMQ("messaging");

var migrations = builder.AddProject<Projects.MigrationService>("migrations")
    .WithReference(ordersDb).WaitFor(ordersDb);

var orderService = builder.AddProject<Projects.OrderService>("order-service")
    .WithReference(ordersDb).WaitForCompletion(migrations)
    .WithReference(redis)
    .WithReference(rabbit).WaitFor(rabbit)
    .WithHttpHealthCheck("/health");

builder.AddProject<Projects.ApiGateway>("api-gateway")
    .WithExternalHttpEndpoints()
    .WithReference(orderService).WaitFor(orderService)
    .WithReference(redis)
    .WithHttpHealthCheck("/health");

builder.AddProject<Projects.BackgroundWorker>("background-worker")
    .WithReference(rabbit).WaitFor(rabbit)
    .WithReference(ordersDb).WaitForCompletion(migrations);

builder.Build().Run();
```

Only the gateway has external endpoints, because only the gateway takes traffic from outside the system. The order service and the worker never reference each other. They share the `messaging` resource, and that shared broker is the only coupling between them.

{% include figure.html id="asp-aspire-topology" %}

Without `WaitFor()`, the AppHost starts resources in parallel, so a service can start before its database accepts connections. Waiting only means something when the dependency has a health check. The hosting integrations for PostgreSQL, Redis, and RabbitMQ register those checks in the AppHost, so waiting on them means waiting until they accept connections. A project has no check until you add one, so without it the dashboard and `WaitFor()` treat the project as healthy the moment its process runs. `WithHttpHealthCheck("/health")` points the AppHost at the order service's and the gateway's health endpoints instead. The template's ServiceDefaults maps `/health` only in the Development environment, which a project's default launch profile sets, so this works locally as generated.

`WaitForCompletion()` waits for a resource to exit successfully rather than to become healthy. The migration service runs once, applies the schema, and exits, and neither the order service nor the worker starts until it has. If it exits with an error, they don't start at all, which is easier to diagnose than two services failing on a missing table.

## Service Discovery

Service discovery lets the gateway call `order-service` by name. The resource name in the AppHost becomes the host name every caller uses, locally and after deployment.

### How Discovery Works

`WithReference(orderService)` puts the order service's endpoints into the gateway's configuration under `services__order-service__…` keys. ServiceDefaults registers `Microsoft.Extensions.ServiceDiscovery` and adds its handler to every `HttpClient` from `IHttpClientFactory`. When the gateway sends a request to `order-service`, the handler looks the name up in that configuration and rewrites the request to the real address.

```csharp
// In the gateway's Program.cs
builder.Services.AddHttpClient<OrderServiceClient>(client =>
{
    client.BaseAddress = new Uri("https+http://order-service");
});
```

The `https+http://` scheme means "prefer HTTPS, fall back to HTTP," which lets the same code work whether the order service exposes one scheme or both. `https://` or `http://` pins one. A typed client, a class that receives the configured `HttpClient` through its constructor, then contains no addresses at all:

```csharp
public class OrderServiceClient(HttpClient httpClient)
{
    public Task<Order?> GetOrderAsync(int orderId) =>
        httpClient.GetFromJsonAsync<Order>($"/orders/{orderId}");
}
```

Resolution only works for clients that have the discovery handler. A client from `IHttpClientFactory` gets it through ServiceDefaults. A `new HttpClient()` doesn't, and sends `order-service` to DNS as a literal host name.

### Discovery After Deployment

Configuration is one source among several. When no configuration entry exists for a name, the default pass-through provider leaves `order-service` unchanged and lets the platform's own DNS resolve it. That is what happens on Kubernetes and Azure Container Apps, where a service's name is already a resolvable host name. For Kubernetes named ports, the separate `Microsoft.Extensions.ServiceDiscovery.Dns` package adds an opt-in provider that reads DNS SRV records, which carry a port as well as a host. Because the caller only ever names `order-service`, moving from the AppHost's configuration to the platform's resolution changes nothing in the calling code.

### External HTTP Services

A third-party API or another team's service can join the model too. `AddExternalService()` declares it by URL, or by a parameter that holds the URL, and references to it feed service discovery like a project's endpoints do:

```csharp
var payments = builder.AddExternalService("payments", "https://api.payments.example.com/");

builder.AddProject<Projects.OrderService>("order-service")
    .WithReference(payments);
```

The order service calls `https://payments` through its `HttpClient`, and the URL lives in one place in the AppHost instead of in every consumer's configuration. The external service shows up in the dashboard, and `WithHttpHealthCheck()` on it reports whether it's reachable.

## Backing Services

Each backing service is a hosting integration in the AppHost and a client integration in each consumer. RabbitMQ shows the two calls:

```csharp
// AppHost (Aspire.Hosting.RabbitMQ)
var rabbit = builder.AddRabbitMQ("messaging")
    .WithManagementPlugin();

// Each consuming project (Aspire.RabbitMQ.Client)
builder.AddRabbitMQClient("messaging");
```

The hosting side runs the RabbitMQ container, and `WithManagementPlugin()` switches to the image with the management UI. The client side registers an `IConnection` in dependency injection, with a health check and tracing. Your code creates channels from that connection and publishes or consumes as usual. PostgreSQL, SQL Server, Redis, Kafka, MongoDB, and the rest follow the same two calls with their own names, and the [integrations overview](https://aspire.dev/integrations/overview/){:target="_blank" rel="noopener noreferrer"} lists them.

### Local Containers, Managed Services in Production

The service you run in a container locally is rarely the one you run in production. Aspire's cloud hosting integrations model the managed service and let you swap in a container for local runs:

```csharp
var ordersDb = builder.AddAzurePostgresFlexibleServer("postgres")
    .RunAsContainer()
    .AddDatabase("orders-db");

var storage = builder.AddAzureStorage("storage")
    .RunAsEmulator();
var blobs = storage.AddBlobs("blobs");
```

In a local run, `RunAsContainer()` starts a PostgreSQL container and `RunAsEmulator()` starts the Azurite storage emulator. When you publish, the same resources become Azure Database for PostgreSQL and an Azure Storage account. The resource name, and so the connection string's name, is the same in both modes.

The client side can still differ. The Azure PostgreSQL server uses Microsoft Entra ID authentication by default, so its connection string carries no password. Consumers use the Azure client integration, `AddAzureNpgsqlDataSource` from `Aspire.Azure.Npgsql`, which attaches an Entra token provider, rather than plain `AddNpgsqlDataSource`. Check each Azure integration's client page for the package it expects.

Leave out `RunAsContainer()` or `RunAsEmulator()` and a local run provisions the real Azure resource in your subscription, which needs Azure credentials and costs money. For differences that go beyond one resource, `builder.ExecutionContext.IsPublishMode` tells the AppHost which mode it's running in, so it can branch on it directly.

## Working with Existing Infrastructure

Not everything belongs to the AppHost. A shared database, another team's service, or a third-party API already exists, and Aspire shouldn't create or manage it.

### AddConnectionString

`AddConnectionString()` adds a resource whose value the AppHost reads from its own configuration under `ConnectionStrings:<name>`, from user secrets, `appsettings.json`, or environment variables:

```csharp
var redis = builder.AddRedis("cache");
var legacyDb = builder.AddConnectionString("legacy-db");

builder.AddProject<Projects.ApiService>("api-service")
    .WithReference(redis)
    .WithReference(legacyDb);
```

The consuming project references it exactly as it references a managed resource, so it can't tell a local container from an external server. An AppHost can run Redis in a container while pointing at a shared SQL Server that already exists.

### Custom Containers

For software without an integration, `AddContainer()` runs any image as a resource, with the same lifecycle, dashboard entry, and references as the rest:

```csharp
var mail = builder.AddContainer("mail", "axllent/mailpit", "v1.20")
    .WithHttpEndpoint(targetPort: 8025, name: "ui")
    .WithEndpoint(targetPort: 1025, name: "smtp");

builder.AddProject<Projects.ApiService>("api-service")
    .WithEnvironment("Smtp__Endpoint", mail.GetEndpoint("smtp"));
```

`GetEndpoint()` returns a reference that the AppHost resolves to the real address at startup, so the project never sees a hard-coded port. An endpoint declared with `WithEndpoint()` defaults to the `tcp` scheme, so the project receives a `tcp://host:port` URL and parses the host and port out of it. Pin image tags. A container defined with `latest` changes under you the next time the image is pulled, and a reproducible development environment is much of the point of an AppHost.

## Communication Patterns

### HTTP Between Services

HTTP is the default. The caller references the target project, registers a client with the resource name as the base address, and makes ordinary requests. The standard resilience handler is already on every factory client through ServiceDefaults, so don't add `AddStandardResilienceHandler()` to individual clients again. Stacking a second handler nests a second set of retries and timeouts inside the first. A client that needs different limits calls `RemoveAllResilienceHandlers()` and then adds its own.

HTTP suits request-response work where the caller needs the answer now, and it couples the caller's availability to the callee's.

### gRPC

gRPC clients built with `AddGrpcClient` come from `IHttpClientFactory`, so they get the same discovery handler and resolve `order-service` by name. They need a plain scheme, though:

```csharp
builder.Services.AddGrpcClient<Orders.OrdersClient>(options =>
{
    options.Address = new Uri("https://order-service");
});
```

`GrpcChannel` chooses its credentials and resolver from the address's scheme and recognizes only `https` and `http`, so the `https+http` form that works for plain HTTP clients breaks a gRPC client. Pick the scheme the service actually serves.

### Messaging Through a Shared Broker

For work the caller doesn't wait on, services communicate through a broker that both reference. In the opening AppHost, the order service and the background worker both reference `messaging`, and both call `AddRabbitMQClient("messaging")`. The order service publishes an event when an order is created and returns to the user. The worker consumes the event to run fulfillment and notifications.

Neither service knows the other exists, so the worker can scale, restart, or fall behind without the order service noticing. The price is eventual consistency. The order exists before its fulfillment starts, and the design has to tolerate that gap.

## Integration Testing with the AppHost

`Aspire.Hosting.Testing` runs your real AppHost inside a test. The test project references the AppHost project, which is where the `Projects.AppHost` type comes from, and `DistributedApplicationTestingBuilder` builds the application model from it. The AppHost then runs inside the test process, while each project and container it starts runs as its own process, exactly as in a local run.

```csharp
[Fact]
public async Task GetOrdersReturnsOk()
{
    var timeout = TimeSpan.FromSeconds(60);
    var ct = CancellationToken.None;

    var appHost = await DistributedApplicationTestingBuilder
        .CreateAsync<Projects.AppHost>(ct);

    await using var app = await appHost.BuildAsync(ct).WaitAsync(timeout, ct);
    await app.StartAsync(ct).WaitAsync(timeout, ct);

    await app.ResourceNotifications
        .WaitForResourceHealthyAsync("api-gateway", ct)
        .WaitAsync(timeout, ct);

    using var httpClient = app.CreateHttpClient("api-gateway");
    using var response = await httpClient.GetAsync("/orders", ct);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}
```

`StartAsync()` returns once the resources are launched, not once they are ready, so the test waits for the gateway's health check, the `WithHttpHealthCheck` from the opening AppHost, before calling it. `CreateHttpClient("api-gateway")` returns a client aimed at that resource's real endpoint. The `WaitAsync` timeouts keep a container that never becomes healthy from hanging the test run.

Between `CreateAsync` and `BuildAsync`, the test can change the builder's configuration and services. `appHost.Services` is the service collection of the AppHost process running inside the test, so it affects the clients that process creates, such as the one `CreateHttpClient` returns and the ones behind `WithHttpHealthCheck`. It doesn't reach into the services under test, which run in their own processes and get their configuration from the AppHost as usual.

These tests start real containers, so they catch what unit tests can't: wrong connection strings, serialization mismatches between services, and missing migrations. They are also slow and need a container runtime on the build agent. Keep them few, cover the paths that cross service boundaries, and leave the logic inside one service to that service's own tests.

## Deployment

The AppHost's model describes the whole system, so Aspire can generate deployment artifacts from it instead of having you describe the topology a second time in Compose files, Helm charts, or Bicep.

### Publish and Deploy

The Aspire CLI has two commands for this, and both run the AppHost in publish mode:

| Command | What it does | Use it when |
| --- | --- | --- |
| `aspire publish` | Writes target-specific artifacts and leaves parameter values unresolved | Another tool, such as your pipeline or GitOps controller, applies them later |
| `aspire deploy` | Generates the artifacts, resolves parameters, and applies them to the target | Aspire itself should carry the deployment through |

Where each resource goes is decided by a compute environment you add to the AppHost:

```csharp
builder.AddDockerComposeEnvironment("compose");
```

The targets include Docker Compose (`AddDockerComposeEnvironment`), Kubernetes (`AddKubernetesEnvironment`, which publishes a Helm chart), Azure Container Apps, Azure App Service, and AKS. The [deployment docs](https://aspire.dev/deployment/deploy-with-aspire/){:target="_blank" rel="noopener noreferrer"} list which targets support publish, deploy, or both. In the generated output, projects become container images, `RunAsContainer()` resources become their managed services, `WithExternalHttpEndpoints()` decides what is exposed publicly, and development-only companions such as pgAdmin are left out. Plain container resources like the opening AppHost's `AddPostgres`, `AddRedis`, and `AddRabbitMQ` stay containers in the Compose file or Helm chart, which makes you responsible for their storage, backups, and upgrades in production. That is the usual reason to model production data stores with the managed-service integrations and `RunAsContainer()` instead.

### The Azure Developer CLI and the Manifest

Before these commands existed, deployment ran through a JSON manifest that the AppHost wrote and the [Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview){:target="_blank" rel="noopener noreferrer"} (`azd`) consumed to provision Azure Container Apps. That path still works for existing `azd` workflows, which generate the manifest themselves. The manifest format is deprecated and no longer evolving, though, and Aspire's docs recommend `aspire deploy` for new Azure deployments. Community tools built on the manifest, such as Aspirate for Kubernetes, haven't been updated since April 2025, and the built-in Kubernetes environment covers the same ground.

### Where Generation Stops

Most organizations that have run services for a while already have infrastructure as code, pipelines, and cluster conventions. There, the generated Helm chart or Compose file is a starting point to review and fold into the existing setup, not a replacement for it. The development loop pays for itself even if you never generate a deployment artifact.

Whichever path you take, every reference in the AppHost is a configuration value that production has to supply. A connection string that the AppHost injected locally has to come from somewhere after deployment: the generated artifacts, a secret store, or your own configuration system. A missing one surfaces only at run time, when the service first tries to connect. Walk the AppHost's references and parameters before the first deployment and check that each one has a production source.

## Pitfalls

### Waiting Doesn't Replace Retries

`WaitFor()` orders startup. It doesn't protect a service when its database restarts an hour later, or when a network hiccup drops a connection during startup. Services still need to handle transient failures. The standard resilience handler covers HTTP calls, and database clients need their own retry settings. Using only one of the two leaves either startup or steady state exposed.

### The Local Topology Can Drift from Production

`RunAsContainer()` makes local runs fast, but a PostgreSQL container isn't a managed flexible server with its own extensions, network rules, and version. Pin the container image to the version production runs, and test against the managed service in a shared environment before relying on anything version-specific.
