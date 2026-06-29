---
title: "Testing ASP.NET Core APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Quality"
description: "Comprehensive guide to testing ASP.NET Core APIs including integration testing with WebApplicationFactory, database testing strategies, authentication testing, snapshot testing, architecture testing, and performance testing approaches."
tags: [asp-net-core, testing, integration-testing, testcontainers, performance, architecture]
---

## Testing ASP.NET Core APIs

Testing ASP.NET Core APIs requires multiple strategies working together. Unit tests validate individual components in isolation, but integration tests prove that routing, model binding, business logic, data access, and serialization work together correctly. Architecture tests enforce structural rules. Performance tests validate behavior under load. Each layer catches different failure modes.

This guide covers the full spectrum of testing approaches for ASP.NET Core APIs, from basic integration testing through advanced techniques like snapshot testing and containerized database testing. The focus remains on practical patterns that catch real bugs without creating maintenance burden.

## Integration Testing Foundations

Integration testing in ASP.NET Core means running your API in-memory and sending real HTTP requests through the complete request pipeline. Unlike unit tests that isolate components, integration tests verify that middleware, routing, model binding, controllers or endpoints, services, and response formatting all cooperate correctly.

The in-memory test server executes your entire application without binding to network ports or deploying to IIS. Tests run quickly because there is no network overhead, but they still exercise production code paths. When an integration test fails, you know something broke in the interaction between components, not just in a single class.

### WebApplicationFactory Basics

WebApplicationFactory bootstraps your application for testing. It reads your application's startup configuration, builds the dependency injection container, and creates an in-memory test server. You get an HttpClient that sends requests to this test server.

```csharp
public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetProducts_ReturnsSuccessStatusCode()
    {
        var response = await _client.GetAsync("/api/products");
        response.EnsureSuccessStatusCode();
    }
}
```

The test class uses xUnit's IClassFixture to share the factory across all tests in the class. The factory starts once and gets reused, which improves test performance. Each test still gets a fresh HttpClient, but the underlying application instance is shared.

WebApplicationFactory requires a reference to your application's entry point. The generic parameter points to the Program class, which represents your application's startup. For minimal APIs in .NET 6 and later, you may need to make the Program class visible to test projects by adding a partial class declaration.

### Customizing the Test Host

Production configuration rarely works for tests. You need different connection strings, disabled authentication, or mock services. ConfigureWebHost and ConfigureTestServices let you override settings without modifying production code.

```csharp
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // Remove the production database context
            services.RemoveAll<DbContext>();

            // Add an in-memory database for testing
            services.AddDbContext<ApiDbContext>(options =>
            {
                options.UseInMemoryDatabase("TestDb");
            });

            // Replace external service dependencies
            services.RemoveAll<IExternalApiClient>();
            services.AddSingleton<IExternalApiClient, FakeExternalApiClient>();
        });

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string>
            {
                ["ConnectionStrings:Default"] = "InMemoryDatabase",
                ["ExternalApi:BaseUrl"] = "http://localhost:5000"
            });
        });
    }
}
```

ConfigureTestServices runs after the application's normal service registration. This timing matters because it lets you remove services registered during startup and replace them with test doubles. ConfigureAppConfiguration runs earlier and lets you inject test-specific configuration values.

Custom factories work best when you need consistent behavior across many tests. For one-off customization, WithWebHostBuilder provides inline configuration without creating a new factory class.

```csharp
var factory = new WebApplicationFactory<Program>()
    .WithWebHostBuilder(builder =>
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IEmailService, FakeEmailService>();
        });
    });

var client = factory.CreateClient();
```

## Testing Controller-Based APIs

Controller-based APIs expose endpoints through classes decorated with routing attributes. Integration tests verify that routing works, model binding succeeds, validation executes, and responses serialize correctly.

A complete integration test sends an HTTP request, examines the status code, and validates the response body. Testing just the status code catches routing failures but misses serialization bugs. Testing just the model catches logic errors but misses HTTP-level issues.

```csharp
[Fact]
public async Task CreateProduct_WithValidData_ReturnsCreatedProduct()
{
    var newProduct = new { Name = "Widget", Price = 29.99 };
    var content = new StringContent(
        JsonSerializer.Serialize(newProduct),
        Encoding.UTF8,
        "application/json");

    var response = await _client.PostAsync("/api/products", content);

    response.EnsureSuccessStatusCode();
    Assert.Equal(HttpStatusCode.Created, response.StatusCode);

    var responseBody = await response.Content.ReadAsStringAsync();
    var product = JsonSerializer.Deserialize<Product>(responseBody,
        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

    Assert.NotNull(product);
    Assert.Equal("Widget", product.Name);
    Assert.Equal(29.99, product.Price);
}
```

Model binding failures return 400 Bad Request. Validation failures also return 400 but include details in the response body. Testing these cases ensures your API communicates problems clearly.

```csharp
[Fact]
public async Task CreateProduct_WithInvalidData_ReturnsBadRequest()
{
    var invalidProduct = new { Name = "", Price = -10 };
    var content = new StringContent(
        JsonSerializer.Serialize(invalidProduct),
        Encoding.UTF8,
        "application/json");

    var response = await _client.PostAsync("/api/products", content);

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var problemDetails = await response.Content
        .ReadFromJsonAsync<ValidationProblemDetails>();
    Assert.NotNull(problemDetails);
    Assert.Contains("Name", problemDetails.Errors.Keys);
}
```

Testing error responses matters as much as testing success paths. Clients need consistent error formats to handle failures gracefully. Integration tests catch breaking changes to error responses before they reach production.

## Testing Minimal APIs

Minimal APIs define endpoints as lambda expressions or local functions rather than controller methods. The testing approach remains similar, but endpoint definition affects how you structure tests.

```csharp
[Fact]
public async Task GetWeatherForecast_ReturnsForecasts()
{
    var response = await _client.GetAsync("/weatherforecast");
    response.EnsureSuccessStatusCode();

    var forecasts = await response.Content
        .ReadFromJsonAsync<List<WeatherForecast>>();

    Assert.NotNull(forecasts);
    Assert.NotEmpty(forecasts);
}
```

Minimal APIs use route patterns directly in MapGet, MapPost, and related methods. Integration tests validate these route patterns work correctly, including route constraints and parameter binding.

Testing route parameters and query strings follows the same pattern as controller testing. Build the URL with the parameters, send the request, and validate the response.

```csharp
[Fact]
public async Task GetProductById_WithValidId_ReturnsProduct()
{
    var response = await _client.GetAsync("/api/products/123");
    response.EnsureSuccessStatusCode();

    var product = await response.Content.ReadFromJsonAsync<Product>();
    Assert.NotNull(product);
    Assert.Equal(123, product.Id);
}

[Fact]
public async Task SearchProducts_WithQueryString_ReturnsFilteredResults()
{
    var response = await _client.GetAsync("/api/products?category=electronics");
    response.EnsureSuccessStatusCode();

    var products = await response.Content.ReadFromJsonAsync<List<Product>>();
    Assert.NotNull(products);
    Assert.All(products, p => Assert.Equal("electronics", p.Category));
}
```

## Replacing Services for Testing

Production services often depend on external systems like databases, APIs, or message queues. Integration tests need predictable behavior, which means replacing these dependencies with test doubles.

Service replacement happens in ConfigureTestServices. Remove the production implementation and register a test implementation. The rest of the application uses dependency injection normally and receives the test implementation.

```csharp
public class FakeProductRepository : IProductRepository
{
    private readonly List<Product> _products = new()
    {
        new Product { Id = 1, Name = "Widget", Price = 29.99m },
        new Product { Id = 2, Name = "Gadget", Price = 49.99m }
    };

    public Task<List<Product>> GetAllAsync()
    {
        return Task.FromResult(_products);
    }

    public Task<Product?> GetByIdAsync(int id)
    {
        return Task.FromResult(_products.FirstOrDefault(p => p.Id == id));
    }

    public Task<Product> CreateAsync(Product product)
    {
        product.Id = _products.Max(p => p.Id) + 1;
        _products.Add(product);
        return Task.FromResult(product);
    }
}
```

Fake implementations contain just enough logic to support test scenarios. They maintain in-memory state that resets between test runs. Unlike mocks, fakes implement the full interface and support any interaction pattern.

Mocking frameworks work too but can make tests brittle. When you mock too many implementation details, tests break whenever you refactor. Fakes give you more flexibility to change how services interact while keeping tests focused on behavior.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IProductRepository>();
    services.AddSingleton<IProductRepository, FakeProductRepository>();
});
```

## Database Testing Strategies

APIs that interact with databases need different testing approaches depending on isolation requirements and performance constraints. Three main strategies exist: in-memory databases, containerized real databases, and shared database instances with cleanup between tests.

### In-Memory Databases

In-memory databases work well for simple scenarios. They start quickly and reset automatically when the application closes. The downside is that in-memory databases often behave differently from production databases. Features like triggers, stored procedures, and database-specific SQL won't work.

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<DbContext>();
    services.AddDbContext<ApiDbContext>(options =>
        options.UseInMemoryDatabase("TestDatabase"));
});
```

In-memory databases suit tests that focus on application logic rather than data access patterns. If your test validates business rules without complex queries, in-memory works fine. If your test depends on database-specific features or query optimization, you need a real database.

### TestContainers for Real Databases

TestContainers spins up Docker containers for integration tests. You get a real database instance that matches production behavior. Each test class can have its own container, or you can share containers across tests for better performance.

```csharp
public class DatabaseIntegrationTests : IAsyncLifetime
{
    private readonly MsSqlContainer _dbContainer = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureTestServices(services =>
                {
                    services.RemoveAll<DbContext>();
                    services.AddDbContext<ApiDbContext>(options =>
                        options.UseSqlServer(_dbContainer.GetConnectionString()));
                });
            });

        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
        await _factory.DisposeAsync();
    }
}
```

Container startup takes 15 to 30 seconds depending on your machine and the database engine. Sharing containers across test classes improves performance. xUnit's ICollectionFixture lets you start one container and reuse it for multiple test classes.

TestContainers supports multiple database engines including SQL Server, PostgreSQL, MySQL, and MongoDB. The API remains consistent across database types. Switch database engines by changing the container builder without rewriting test logic.

### Respawn for Database Cleanup

When tests share a database instance, each test needs a clean slate. Deleting all rows manually is tedious and error-prone. Respawn examines foreign key relationships and generates delete statements in the correct order.

```csharp
private static readonly Respawner _respawner = Respawner.CreateAsync(
    _dbContainer.GetConnectionString(),
    new RespawnerOptions
    {
        DbAdapter = DbAdapter.SqlServer,
        TablesToIgnore = new Respawn.Graph.Table[] { "__EFMigrationsHistory" }
    }).GetAwaiter().GetResult();

[Fact]
public async Task CreateProduct_PersistsToDatabase()
{
    await _respawner.ResetAsync(_dbContainer.GetConnectionString());

    var newProduct = new { Name = "Widget", Price = 29.99 };
    var response = await _client.PostAsync("/api/products",
        JsonContent.Create(newProduct));

    response.EnsureSuccessStatusCode();

    // Verify product exists in database
    var getResponse = await _client.GetAsync("/api/products/1");
    getResponse.EnsureSuccessStatusCode();
}
```

Respawn typically completes in under 50 milliseconds. This is much faster than restarting a container between tests. Combine TestContainers with Respawn to get real database behavior with fast test execution.

## Testing Authentication and Authorization

APIs protected by authentication need tests that verify both authorized and unauthorized access. Sending real credentials in tests creates coupling to authentication providers. Mock authentication handlers let you simulate different user contexts without external dependencies.

A custom authentication handler authenticates requests without validating credentials. The handler extracts test user information from request headers and creates a claims principal.

```csharp
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string AuthenticationScheme = "TestScheme";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.ContainsKey("X-Test-User"))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier,
                Request.Headers["X-Test-User"].ToString()),
            new Claim(ClaimTypes.Name,
                Request.Headers["X-Test-User"].ToString()),
            new Claim(ClaimTypes.Role,
                Request.Headers["X-Test-Role"].ToString())
        };

        var identity = new ClaimsIdentity(claims, AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, AuthenticationScheme);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

Register the test authentication handler in ConfigureTestServices and remove production authentication schemes. Tests set headers to control the authenticated user.

```csharp
builder.ConfigureTestServices(services =>
{
    services.AddAuthentication(TestAuthHandler.AuthenticationScheme)
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
            TestAuthHandler.AuthenticationScheme, options => { });
});

// In test
_client.DefaultRequestHeaders.Add("X-Test-User", "testuser");
_client.DefaultRequestHeaders.Add("X-Test-Role", "Admin");
var response = await _client.GetAsync("/api/admin/users");
```

Testing authorization policies requires creating users with different claims or roles. Change the headers between requests to simulate different user contexts.

```csharp
[Fact]
public async Task GetAdminResource_WithAdminRole_ReturnsSuccess()
{
    _client.DefaultRequestHeaders.Add("X-Test-Role", "Admin");
    var response = await _client.GetAsync("/api/admin/resource");
    response.EnsureSuccessStatusCode();
}

[Fact]
public async Task GetAdminResource_WithUserRole_ReturnsForbidden()
{
    _client.DefaultRequestHeaders.Add("X-Test-Role", "User");
    var response = await _client.GetAsync("/api/admin/resource");
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
}
```

## Snapshot Testing with Verify

Snapshot testing compares current output against previously approved output. Instead of writing assertions for every field in a response, you save a reference copy and compare future runs against it. This works well for complex responses where manual assertions become verbose.

Verify is a snapshot testing tool that serializes test output and stores it in files. The first run creates the snapshot. Subsequent runs compare new output to the stored snapshot. When output changes, Verify shows a diff and lets you approve or reject the change.

```csharp
[Fact]
public async Task GetProducts_ReturnsExpectedStructure()
{
    var response = await _client.GetAsync("/api/products");
    response.EnsureSuccessStatusCode();

    var content = await response.Content.ReadAsStringAsync();
    await Verify(content);
}
```

Verify stores snapshots in files next to your test class. The file name includes the test name and the output format. Verify supports JSON, XML, text, images, and binary formats.

Dynamic values like timestamps or generated IDs break snapshot comparisons. Verify includes scrubbers to normalize these values before comparison.

```csharp
[Fact]
public async Task GetProducts_ReturnsExpectedStructure()
{
    var response = await _client.GetAsync("/api/products");
    response.EnsureSuccessStatusCode();

    var content = await response.Content.ReadAsStringAsync();

    var settings = new VerifySettings();
    settings.ScrubInlineDateTimes();
    settings.ScrubMember("id");

    await Verify(content, settings);
}
```

Snapshot tests catch unexpected changes to API contracts. When a field gets renamed or a property changes type, the snapshot comparison fails. This makes snapshot testing valuable for detecting breaking changes.

The tradeoff is that snapshot tests require manual review when legitimate changes occur. If you change your API intentionally, you must review the diff and approve the new snapshot. This works well when changes are infrequent. When your API changes constantly, snapshot testing creates review overhead.

## Architecture Testing

Architecture tests enforce structural rules about your codebase. Instead of reviewing code manually to check whether developers followed conventions, you write tests that verify the rules automatically. These tests catch violations during development rather than in code review.

Two libraries provide architecture testing for .NET: NetArchTest and ArchUnitNET. Both let you query types in your assemblies and assert conditions about dependencies, naming conventions, and design patterns.

### NetArchTest Basics

NetArchTest provides a fluent API for selecting types and asserting rules. Load types from assemblies, filter by namespace or attributes, and check conditions.

```csharp
[Fact]
public void Controllers_ShouldNotDependOnInfrastructure()
{
    var result = Types.InAssembly(typeof(Program).Assembly)
        .That().ResideInNamespace("Api.Controllers")
        .ShouldNot().HaveDependencyOn("Api.Infrastructure")
        .GetResult();

    Assert.True(result.IsSuccessful);
}

[Fact]
public void Repositories_ShouldHaveRepositorySuffix()
{
    var result = Types.InAssembly(typeof(Program).Assembly)
        .That().ResideInNamespace("Api.Data.Repositories")
        .Should().HaveNameEndingWith("Repository")
        .GetResult();

    Assert.True(result.IsSuccessful);
}
```

Common architecture rules include layering constraints, naming conventions, and marker interface usage. Tests verify that controllers don't reference infrastructure directly, that repositories follow naming patterns, or that domain entities remain independent of frameworks.

### ArchUnitNET for Advanced Rules

ArchUnitNET offers more sophisticated rules including cycle detection and custom predicates. The API is similar to NetArchTest but provides deeper analysis capabilities.

```csharp
[Fact]
public void DomainLayer_ShouldNotDependOnApplicationLayer()
{
    var architecture = new ArchLoader()
        .LoadAssemblies(typeof(Program).Assembly)
        .Build();

    var rule = Types()
        .That().ResideInNamespace("Domain")
        .Should().NotDependOnAny(Types()
            .That().ResideInNamespace("Application"));

    rule.Check(architecture);
}
```

Architecture tests run fast because they analyze compiled assemblies without executing code. Include them in your continuous integration pipeline to catch violations immediately.

## Performance Testing

Integration tests prove correctness. Performance tests prove your API handles load. Performance testing measures throughput, latency, and resource usage under realistic traffic patterns.

### K6 for Load Testing

K6 is an open-source load testing tool that uses JavaScript to define test scenarios. You write scripts that simulate users making requests to your API and K6 measures response times and error rates.

A basic K6 test sends requests and validates responses. K6 provides virtual users that execute the test scenario concurrently.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
};

export default function () {
    const response = http.get('http://localhost:5000/api/products');

    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1);
}
```

K6 reports statistics including request rate, response times at different percentiles, and error rates. These metrics reveal how your API behaves under load. A test that passes with one user might fail with 100 users.

Ramping tests gradually increase load to find breaking points. Start with a few users and add more every few seconds until the API stops responding or error rates increase.

```javascript
export const options = {
    stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
    ],
};
```

Performance tests belong in a separate test suite from integration tests. They take longer to run and require a running application instance. Run performance tests periodically to catch performance regressions before they reach production.

### Bombardier for Quick Benchmarks

Bombardier is a command-line HTTP load testing tool that focuses on speed. It generates load quickly and reports basic metrics. Use Bombardier for quick spot checks during development.

```bash
bombardier -c 50 -d 30s http://localhost:5000/api/products
```

The command runs 50 concurrent connections for 30 seconds and reports requests per second, latency percentiles, and error rates. Bombardier runs faster than K6 but offers fewer features. It works well for simple throughput tests.

## Testing SignalR Hubs

SignalR enables real-time communication between servers and clients. Testing SignalR hubs requires sending messages to the server and verifying that clients receive the correct responses.

WebApplicationFactory works with SignalR, but you need to create a SignalR client connection instead of using HttpClient. The HubConnectionBuilder creates connections that communicate with your test server.

```csharp
public class SignalRIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SignalRIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SendMessage_BroadcastsToAllClients()
    {
        var hubConnection = new HubConnectionBuilder()
            .WithUrl($"{_factory.Server.BaseAddress}chathub",
                options => options.HttpMessageHandlerFactory = _ =>
                    _factory.Server.CreateHandler())
            .Build();

        var messageReceived = new TaskCompletionSource<string>();

        hubConnection.On<string, string>("ReceiveMessage",
            (user, message) => messageReceived.SetResult(message));

        await hubConnection.StartAsync();
        await hubConnection.InvokeAsync("SendMessage", "testuser", "Hello");

        var receivedMessage = await messageReceived.Task
            .WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal("Hello", receivedMessage);

        await hubConnection.StopAsync();
    }
}
```

The key difference from HTTP testing is using the test server's handler instead of creating a network connection. Setting the HttpMessageHandlerFactory routes SignalR traffic through the in-memory test server.

Testing hub methods that push messages to specific users or groups requires multiple client connections. Create several HubConnection instances, join them to groups, and verify that messages reach the correct clients.

```csharp
[Fact]
public async Task SendToGroup_OnlyGroupMembersReceiveMessage()
{
    var connection1 = await CreateHubConnection();
    var connection2 = await CreateHubConnection();

    var message1Received = new TaskCompletionSource<string>();
    var message2Received = new TaskCompletionSource<string>();

    connection1.On<string>("ReceiveMessage",
        msg => message1Received.SetResult(msg));
    connection2.On<string>("ReceiveMessage",
        msg => message2Received.SetResult(msg));

    await connection1.InvokeAsync("JoinGroup", "testgroup");
    await connection1.InvokeAsync("SendToGroup", "testgroup", "Hello Group");

    var received1 = await message1Received.Task
        .WaitAsync(TimeSpan.FromSeconds(5));
    Assert.Equal("Hello Group", received1);

    await Assert.ThrowsAsync<TimeoutException>(async () =>
        await message2Received.Task.WaitAsync(TimeSpan.FromSeconds(1)));
}
```

## Test Organization Strategies

Large API projects need consistent test organization. Tests should be easy to find, run quickly, and provide clear feedback when they fail.

Group tests by feature rather than by testing technique. All tests related to product management live together regardless of whether they are unit tests, integration tests, or database tests. This organization makes it easier to understand test coverage for a feature.

```
tests/
  ProductTests/
    ProductControllerTests.cs
    ProductIntegrationTests.cs
    ProductRepositoryTests.cs
  OrderTests/
    OrderWorkflowTests.cs
    OrderIntegrationTests.cs
```

Separate slow tests from fast tests using test categories or traits. Run fast unit tests on every build and slower integration tests less frequently. xUnit traits, NUnit categories, and MSTest TestCategory attributes all support this pattern.

```csharp
[Fact]
[Trait("Category", "Integration")]
public async Task CreateOrder_ProcessesPayment()
{
    // Integration test that calls external payment service
}

[Fact]
[Trait("Category", "Unit")]
public void CalculateOrderTotal_SumsLineItems()
{
    // Fast unit test with no external dependencies
}
```

Shared test fixtures reduce duplication but can couple tests together. Use class fixtures when tests need the same setup but don't interfere with each other. Use collection fixtures when multiple test classes need shared resources like databases or test servers.

## Common Testing Pitfalls

Several patterns make tests brittle or slow. Recognizing these patterns helps you write maintainable test suites.

Testing implementation details instead of behavior creates fragile tests. When you assert that a method gets called with specific arguments, you couple the test to internal implementation choices. Refactoring breaks tests even when behavior remains correct. Test observable behavior through public interfaces instead.

Shared mutable state between tests causes intermittent failures. If one test modifies global state or a shared database without cleaning up, subsequent tests might fail or pass depending on test execution order. Reset state between tests or use isolated test instances.

Overly comprehensive test doubles defeat the purpose of integration testing. If you mock every dependency, you are writing unit tests with integration test infrastructure. Integration tests should exercise real interactions between components. Replace only external dependencies that you cannot control.

Timeouts in async tests often indicate incorrect test structure. If you are waiting for background tasks to complete, your test depends on timing rather than behavior. Use synchronization primitives or task completion sources to wait for specific events instead of arbitrary delays.

Tests that depend on external services running locally create barriers for other developers. Use TestContainers to provide dependencies automatically or configure tests to skip when dependencies are unavailable. Tests should work on any developer machine without manual setup.

## Key Patterns for Effective Testing

Start with integration tests that validate end-to-end behavior through public HTTP endpoints. Add unit tests for complex business logic that benefits from isolated testing. Include architecture tests to enforce structural rules automatically. Run performance tests periodically to catch regressions.

Use WebApplicationFactory for all HTTP-based testing. Customize the test host to replace external dependencies while keeping the rest of your application intact. Let the framework handle test server lifecycle management.

When you need real databases, combine TestContainers with Respawn. Containers provide production-like behavior while Respawn keeps tests fast by cleaning up between runs instead of restarting containers.

Test authentication by replacing authentication handlers rather than using real credentials. This keeps tests fast and eliminates dependencies on external identity providers while still exercising authorization logic.

Apply snapshot testing selectively to complex responses where manual assertions become tedious. Use scrubbers to handle dynamic values and review diffs carefully when approving changes.

Write architecture tests for rules that matter to your project. Not every project needs the same architectural constraints. Focus on rules that prevent specific problems you have encountered or want to avoid.

The goal is a test suite that catches bugs quickly, runs fast enough to execute frequently, and remains maintainable as your API evolves. Balance different testing techniques to achieve coverage without creating excessive maintenance burden.
