---
title: ".NET Aspire Distributed Applications"
layout: guide
category: "ASP.NET Core"
subcategory: ".NET Aspire"
description: "Multi-project orchestration, service discovery, backing services, testing, and deployment patterns for distributed .NET applications using Aspire."
tags: [aspire, distributed-systems, service-discovery, microservices, cloud-native, testing, deployment, orchestration]
---

## Orchestrating Distributed .NET Applications

Once an application grows beyond a single API project, you need to coordinate service-to-service communication, shared infrastructure like databases and caches, consistent configuration across projects, and startup ordering. Without a central orchestration point, each developer ends up managing connection strings, ports, and container configurations independently, leading to environment drift and onboarding friction.

.NET Aspire's AppHost project serves as that central orchestration point. It defines the entire application topology in a single C# file: which service projects participate, what infrastructure they depend on, and how they discover each other. During local development, the AppHost starts everything together, wires up service discovery, and provides a dashboard for monitoring health and logs. For deployment, it generates a manifest that describes the topology for cloud provisioning tools.

This guide covers the core patterns for building distributed .NET applications with Aspire: multi-project orchestration, service discovery, backing services, communication patterns, testing, and deployment. Each section explains the concepts before showing the Aspire-specific APIs that implement them.

## Multi-Project Orchestration

The AppHost project is the entry point for an Aspire application. It references all the service projects and infrastructure resources that make up the distributed system, declaring the relationships between them. The result is a dependency graph that Aspire uses for startup ordering, service discovery, and manifest generation.

### Adding Projects

Each service project is added to the AppHost using `AddProject<T>()`, where `T` is a marker type from the project reference. The string argument becomes the resource name, which also serves as the service discovery hostname.

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var apiGateway = builder.AddProject<Projects.ApiGateway>("api-gateway");
var orderService = builder.AddProject<Projects.OrderService>("order-service");
var worker = builder.AddProject<Projects.BackgroundWorker>("background-worker");
```

The resource name you choose matters because it becomes the hostname that other services use to communicate. A service named `"order-service"` is reachable at `http://order-service` from any project that references it.

### Declaring Dependencies with WithReference

The `WithReference()` method declares that one project depends on another. This creates two things: a startup ordering constraint ensuring the dependency is healthy before the dependent starts, and a service discovery entry so the dependent can locate the dependency by name.

```csharp
var redis = builder.AddRedis("cache");
var postgres = builder.AddPostgres("postgres")
    .AddDatabase("orders-db");
var rabbit = builder.AddRabbitMQ("messaging");

var orderService = builder.AddProject<Projects.OrderService>("order-service")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(rabbit);

var apiGateway = builder.AddProject<Projects.ApiGateway>("api-gateway")
    .WithReference(orderService)
    .WithReference(redis);

var worker = builder.AddProject<Projects.BackgroundWorker>("background-worker")
    .WithReference(rabbit)
    .WithReference(postgres);
```

This AppHost orchestrates a public-facing API gateway that calls the order service and uses Redis for caching, an internal order service backed by PostgreSQL, Redis, and RabbitMQ, and a background worker that consumes messages from RabbitMQ and writes to PostgreSQL.

### External Endpoints and Configuration

By default, Aspire projects are only reachable within the application's internal network. For services that need to accept traffic from outside, such as a public API or a frontend, use `WithExternalHttpEndpoints()`.

```csharp
var apiGateway = builder.AddProject<Projects.ApiGateway>("api-gateway")
    .WithExternalHttpEndpoints()
    .WithReference(orderService);
```

You can pass environment variables to projects using `WithEnvironment()`, which is useful for configuration values that differ between services or that come from parameters.

```csharp
var featureFlag = builder.AddParameter("enable-new-checkout");

var apiGateway = builder.AddProject<Projects.ApiGateway>("api-gateway")
    .WithEnvironment("FEATURE_NEW_CHECKOUT", featureFlag);
```

### Conditional Resource Configuration

The `builder.ExecutionContext.IsPublishMode` property distinguishes between local development and deployment. This lets you use container-based resources locally while targeting managed cloud services in production.

```csharp
var cache = builder.ExecutionContext.IsPublishMode
    ? builder.AddAzureRedis("cache")
    : builder.AddRedis("cache");
```

This pattern keeps the local development experience fast and self-contained while producing the correct deployment manifest for cloud infrastructure.

## Service Discovery

Aspire's service discovery eliminates the need for hardcoded URLs and manual port management. When a project references another project via `WithReference()`, the consuming service receives configuration entries that map the resource name to a concrete endpoint. Services then use the resource name as the hostname in their HTTP calls.

### How Discovery Works

Under the hood, Aspire generates configuration entries in the format that `Microsoft.Extensions.ServiceDiscovery` understands. The ServiceDefaults project, which every Aspire service project references, calls `AddServiceDiscovery()` during startup to register the discovery infrastructure.

When service A has a reference to service B named `"order-service"`, Aspire injects configuration that tells the service discovery middleware where `order-service` is running. Service A can then make HTTP requests to `http://order-service` and the middleware resolves the actual address.

### Using Typed HttpClients with Service Discovery

The standard pattern for service-to-service HTTP calls uses `IHttpClientFactory` with named or typed clients. The `AddHttpClient` extension accepts the resource name as the base address, and service discovery resolves it at runtime.

```csharp
// In the consuming project's Program.cs
builder.Services.AddHttpClient<OrderServiceClient>(client =>
{
    client.BaseAddress = new Uri("https+http://order-service");
});
```

The `https+http://` scheme prefix tells service discovery to prefer HTTPS but fall back to HTTP. You can also use `http://` or `https://` explicitly.

The typed client class then makes calls without worrying about actual addresses or ports.

```csharp
public class OrderServiceClient
{
    private readonly HttpClient _httpClient;

    public OrderServiceClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<Order?> GetOrderAsync(int orderId)
    {
        return await _httpClient.GetFromJsonAsync<Order>($"/orders/{orderId}");
    }
}
```

### Connection Strings vs. Service Endpoints

Service discovery works differently depending on the resource type. When you reference a project, Aspire provides a service endpoint that supports HTTP-based discovery. When you reference infrastructure resources like databases or message brokers, Aspire provides a connection string instead.

```csharp
// Project reference: provides a service endpoint for HTTP discovery
apiGateway.WithReference(orderService);

// Database reference: provides a connection string
orderService.WithReference(ordersDb);
```

On the consuming side, a project reference means you use `HttpClient` with the resource name as hostname. A database reference means you read the connection string from configuration using the resource name as the key, typically handled by the corresponding client integration like `AddNpgsqlDataSource("orders-db")`.

## Adding Backing Services

Aspire provides first-class integrations for common infrastructure services. Each integration has two sides: the hosting integration used in the AppHost to define and configure the resource, and the client integration used in the consuming project to get a pre-configured client with health checks and telemetry.

### Databases

Aspire supports several database engines. Each uses a similar pattern: add the server resource in the AppHost, optionally create a named database within it, and reference the database from consuming projects.

**AppHost side (hosting integration):**

```csharp
var postgres = builder.AddPostgres("pg-server")
    .AddDatabase("orders-db");

var sqlServer = builder.AddSqlServer("sql-server")
    .AddDatabase("inventory-db");
```

The `AddPostgres()` call creates a PostgreSQL server container. `AddDatabase()` creates a logical database within that server. The database resource is what you pass to `WithReference()`.

**Consuming project side (client integration):**

```csharp
// In Program.cs of the consuming project
builder.AddNpgsqlDataSource("orders-db");
// or for Entity Framework:
builder.AddNpgsqlDbContext<OrdersDbContext>("orders-db");
```

The client integration reads the connection string that Aspire injected via `WithReference()`, configures health checks that appear in the Aspire dashboard, and adds OpenTelemetry tracing for database operations.

### Caching

Redis is the primary caching integration. The hosting side creates a Redis container, and the client side provides either a distributed cache or a raw connection multiplexer.

**AppHost side:**

```csharp
var redis = builder.AddRedis("cache");
```

**Consuming project side:**

```csharp
// For IDistributedCache:
builder.AddRedisDistributedCache("cache");

// For direct IConnectionMultiplexer access:
builder.AddRedisClient("cache");
```

Both options include health checks and telemetry automatically. The `IDistributedCache` option integrates with ASP.NET Core's output caching and session state without any additional configuration.

### Messaging

RabbitMQ is the most common messaging integration. The hosting side creates a RabbitMQ container with the management plugin enabled, and the client side provides a configured `IConnection`.

**AppHost side:**

```csharp
var rabbit = builder.AddRabbitMQ("messaging");
```

**Consuming project side:**

```csharp
builder.AddRabbitMQClient("messaging");
```

This registers an `IConnection` in the DI container with health checks and telemetry. Your application code uses the connection to create channels and publish or consume messages as usual.

### Cloud Storage

Azure Storage integrations follow the same hosting-plus-client pattern. The hosting side configures the storage account and specific services, while the client side provides typed SDK clients.

**AppHost side:**

```csharp
var storage = builder.AddAzureStorage("storage");
var blobs = storage.AddBlobs("blob-storage");
var queues = storage.AddQueues("queue-storage");
var tables = storage.AddTables("table-storage");
```

**Consuming project side:**

```csharp
builder.AddAzureBlobClient("blob-storage");
builder.AddAzureQueueClient("queue-storage");
builder.AddAzureTableClient("table-storage");
```

During local development, Aspire uses the Azurite storage emulator. In publish mode, it targets real Azure Storage accounts.

## Working with Existing Infrastructure

Not every piece of infrastructure lives inside the Aspire application. Production databases, shared services, and third-party APIs often exist outside of Aspire's control. The `AddConnectionString()` method lets you incorporate these external resources into the Aspire model.

### Using AddConnectionString for External Resources

When infrastructure already exists and Aspire should not create or manage it, `AddConnectionString()` reads a connection string from the application's configuration sources such as appsettings.json, environment variables, or user secrets.

```csharp
var existingSql = builder.AddConnectionString("legacy-database");

var apiService = builder.AddProject<Projects.ApiService>("api-service")
    .WithReference(existingSql);
```

The consuming project still uses `WithReference()` identically to how it references Aspire-managed resources. This consistency means the consuming project does not need to know whether the resource is a local container or an existing external service. The connection string named `"legacy-database"` must exist in the configuration of the AppHost.

You can mix managed and external resources freely. An AppHost might spin up Redis locally for caching while pointing to an existing SQL Server that contains production data.

```csharp
var redis = builder.AddRedis("cache");
var existingSql = builder.AddConnectionString("production-db");

var apiService = builder.AddProject<Projects.ApiService>("api-service")
    .WithReference(redis)
    .WithReference(existingSql);
```

### Custom Containers

For services that lack a first-class Aspire integration, `AddContainer()` lets you run any Docker image as part of the application.

```csharp
var seq = builder.AddContainer("seq", "datalust/seq")
    .WithEnvironment("ACCEPT_EULA", "Y")
    .WithHttpEndpoint(port: 5341, targetPort: 80);
```

Custom containers participate in the Aspire dashboard and lifecycle management. You can reference their endpoints from other projects using `GetEndpoint()`.

## Communication Patterns

Distributed applications need services to communicate with each other. Aspire supports several communication patterns, each suited to different requirements around latency, coupling, and reliability.

### HTTP Service-to-Service

HTTP is the default communication pattern in Aspire. You reference one project from another, register a typed HttpClient with service discovery, and make standard HTTP calls using the resource name as the hostname.

```csharp
// In the API Gateway project
builder.Services.AddHttpClient<OrderServiceClient>(client =>
{
    client.BaseAddress = new Uri("https+http://order-service");
});
```

This pattern works well for synchronous request-response interactions where the caller needs an immediate result. Combining this with resilience policies from `Microsoft.Extensions.Http.Resilience` adds retry logic and circuit breaking.

```csharp
builder.Services.AddHttpClient<OrderServiceClient>(client =>
{
    client.BaseAddress = new Uri("https+http://order-service");
})
.AddStandardResilienceHandler();
```

### gRPC

gRPC uses the same service discovery mechanism as HTTP. You reference the target project and configure the gRPC channel to use the resource name as the address. Since gRPC runs over HTTP/2, no additional port configuration is needed.

```csharp
builder.Services.AddGrpcClient<OrderService.OrderServiceClient>(options =>
{
    options.Address = new Uri("https+http://order-service");
});
```

The gRPC client resolves the address through service discovery just like an HttpClient does. This works because Aspire's service discovery operates at the transport level, not the application protocol level.

### Messaging Through Backing Services

For asynchronous communication, services publish and consume messages through a shared messaging resource. The AppHost wires both the publisher and the consumer to the same resource, and each service uses the client integration to get a configured connection.

```csharp
// In the AppHost
var rabbit = builder.AddRabbitMQ("messaging");

var orderService = builder.AddProject<Projects.OrderService>("order-service")
    .WithReference(rabbit);

var worker = builder.AddProject<Projects.BackgroundWorker>("background-worker")
    .WithReference(rabbit);
```

Both projects call `builder.AddRabbitMQClient("messaging")` in their respective Program.cs files. The order service publishes messages when orders are created, and the background worker consumes them for processing. Neither service knows about the other directly, which reduces coupling and allows independent scaling.

This pattern is particularly valuable when the publisher does not need to wait for the result of the processing. Order creation returns immediately to the user while fulfillment, notifications, and analytics happen asynchronously.

## Testing Aspire Applications

Aspire provides a testing framework that lets you spin up the full application model, or a subset of it, for integration testing. The `Aspire.Hosting.Testing` package includes `DistributedApplicationTestingBuilder`, which creates a test host from your AppHost project.

### Setting Up Integration Tests

The test project references both the AppHost project and the `Aspire.Hosting.Testing` NuGet package. The testing builder creates an application instance that starts the same resources your AppHost defines, including containers for databases and caches.

```csharp
[Fact]
public async Task GetOrderReturnsSuccess()
{
    var appHost = await DistributedApplicationTestingBuilder
        .CreateAsync<Projects.AspireAppHost>();

    await using var app = await appHost.BuildAsync();
    await app.StartAsync();

    var httpClient = app.CreateHttpClient("api-gateway");

    var response = await httpClient.GetAsync("/health");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}
```

The `CreateAsync<T>()` method takes the AppHost project as a type parameter and builds the full application model. After calling `BuildAsync()` and `StartAsync()`, the test has a running instance of the entire distributed application with real containers.

`CreateHttpClient("api-gateway")` returns an `HttpClient` configured with the actual endpoint of the named resource. You use it to make real HTTP requests against the running service.

### Customizing the Test Environment

Tests often need to override resources or configuration. The testing builder provides access to the AppHost's builder, allowing you to modify resources before building the application.

```csharp
var appHost = await DistributedApplicationTestingBuilder
    .CreateAsync<Projects.AspireAppHost>();

appHost.Services.ConfigureHttpClientDefaults(http =>
{
    http.AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 0;
    });
});
```

Since the tests start real containers for databases and message brokers, they serve as true integration tests that verify the full request path from HTTP endpoint through to data persistence. This catches configuration errors, serialization issues, and infrastructure problems that unit tests miss.

The trade-off is that these tests are slower and require Docker to be running. Structure your test suite to run fast unit tests frequently and reserve Aspire integration tests for CI pipelines or pre-merge validation.

## Deployment

Aspire's deployment story bridges the gap between the local development topology defined in the AppHost and the cloud infrastructure needed to run the application in production. The AppHost generates a deployment manifest that describes the application's structure, and external tools consume that manifest to provision infrastructure and deploy services.

### Manifest Generation

The AppHost can generate a JSON manifest that describes every resource, its dependencies, and its configuration. This manifest serves as the contract between Aspire and deployment tooling.

The manifest includes project resources with their Dockerfile references, container images with their configuration, connection strings and environment variables, and dependency relationships between resources. Deployment tools read this manifest to understand what infrastructure to create and how to wire services together.

### Azure Container Apps

Azure Container Apps is the primary supported deployment target for Aspire applications. The [Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview){:target="_blank" rel="noopener noreferrer"} (`azd`) reads the Aspire manifest and maps resources to Azure services automatically.

The mapping follows predictable patterns: project resources become Container App instances, Redis resources map to Azure Cache for Redis, PostgreSQL resources map to Azure Database for PostgreSQL, and RabbitMQ resources can map to container-based deployments. Service discovery configuration translates to the Container Apps environment's built-in service discovery.

The workflow is straightforward. You initialize the deployment configuration, and then a single command provisions all the Azure infrastructure and deploys the container images. The Azure Developer CLI handles building Docker images, pushing them to a container registry, and configuring the Container Apps environment with the correct service bindings.

### Kubernetes

For teams deploying to Kubernetes, the [Aspirate](https://github.com/prom3theu5/aspirern){:target="_blank" rel="noopener noreferrer"} (`aspirate`) community tool generates Kubernetes manifests or Helm charts from the Aspire manifest. This produces deployments, services, config maps, and secrets that reflect the application topology.

The generated Kubernetes resources include Deployment and Service definitions for each project, ConfigMaps for environment variables and configuration, and PersistentVolumeClaims for stateful resources. You can customize the generated manifests before applying them to your cluster.

### Publish Mode vs. Run Mode

The `builder.ExecutionContext.IsPublishMode` property is the key mechanism for varying behavior between local development and deployment. In run mode, Aspire starts local containers for infrastructure. In publish mode, it generates the manifest with references to managed cloud services.

```csharp
var db = builder.ExecutionContext.IsPublishMode
    ? builder.AddAzurePostgresFlexibleServer("pg").AddDatabase("orders")
    : builder.AddPostgres("pg").AddDatabase("orders");
```

This lets you develop against lightweight local containers while producing deployment manifests that reference fully managed cloud databases. The consuming projects remain identical in both cases because the connection string injection works the same way regardless of the backing implementation.

## Practical Patterns and Common Pitfalls

### Waiting for Dependencies

By default, Aspire starts resources in dependency order but does not wait for them to become fully healthy. A database container might be running at the OS level before it is ready to accept connections. Use `WaitFor()` to ensure a resource reports healthy before starting dependent services.

```csharp
var postgres = builder.AddPostgres("pg").AddDatabase("orders");

var orderService = builder.AddProject<Projects.OrderService>("order-service")
    .WithReference(postgres)
    .WaitFor(postgres);
```

Without `WaitFor()`, the order service might start before PostgreSQL is ready, causing connection failures during startup. While services should handle transient connection failures gracefully, `WaitFor()` avoids the noise of retry logs during normal startup.

### Persistent Volumes for Development

Container-based databases lose their data when the container restarts. During development, this means losing test data every time you restart the AppHost. `WithDataVolume()` attaches a named Docker volume to persist data between restarts.

```csharp
var postgres = builder.AddPostgres("pg")
    .WithDataVolume("pg-data")
    .AddDatabase("orders");
```

This is a development convenience, not a production pattern. In deployment, managed database services handle their own persistence.

### Custom Container Configuration

When working with custom containers or configuring built-in resources beyond the defaults, Aspire provides several methods for fine-tuning. `WithImageTag()` pins a specific image version. `WithBindMount()` maps a host directory into the container for configuration files. Port mappings can be customized with `WithHttpEndpoint()` or `WithEndpoint()`.

```csharp
var seq = builder.AddContainer("seq", "datalust/seq")
    .WithImageTag("latest")
    .WithEnvironment("ACCEPT_EULA", "Y")
    .WithHttpEndpoint(port: 5341, targetPort: 80);
```

Be deliberate about image tags in your AppHost. Using `latest` can cause unexpected behavior when images update. Pinning to specific versions provides reproducible environments.

### Resource Health and the Dashboard

The Aspire dashboard shows the health status of every resource in the application. Container resources report health based on their Docker health checks. Project resources report health through the ASP.NET Core health check endpoints configured in ServiceDefaults.

When a resource shows unhealthy in the dashboard, check its logs directly from the dashboard UI. The centralized logging view often reveals the root cause faster than searching individual log files. Health check failures during startup typically point to connection string misconfiguration or port conflicts.

### Startup Ordering and Transient Failures

Even with `WaitFor()`, services should handle transient connection failures during startup. Network timing, DNS resolution delays, and resource initialization can cause brief windows where connections fail. The client integrations provided by Aspire configure sensible retry policies by default, but custom infrastructure connections should include explicit retry logic.

The combination of `WaitFor()` for ordering and retry policies for resilience provides a robust startup experience. Relying on only one of these approaches leaves gaps that manifest as intermittent startup failures.

### Configuration Parity Between Environments

Aspire provides connection strings and service endpoints automatically during local development. In production, these values must come from the deployment environment. Every `WithReference()` call in the AppHost has a corresponding configuration key that needs a value in production, whether through environment variables, Azure App Configuration, Kubernetes secrets, or another source.

Audit your AppHost references and verify that each one has an equivalent configuration source in your deployment environment. Missing a connection string is one of the most common deployment failures, and it only surfaces at runtime when the service tries to connect.
