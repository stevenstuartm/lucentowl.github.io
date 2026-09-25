---
title: "Testing ASP.NET Core APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Operations"
description: "Integration testing an ASP.NET Core API in memory with WebApplicationFactory: replacing services and configuration, asserting on responses, testing against a real database in a container with Respawn resets, a test authentication handler for 401 and 403 cases, snapshot testing with Verify, and SignalR hub tests."
tags: [practical, testing, integration-testing, webapplicationfactory, testcontainers, snapshot-testing]
---

A unit test of an endpoint handler proves the handler's logic, but most API bugs live between the pieces: a route that doesn't match, a body that doesn't bind, middleware in the wrong order, an authorization policy that lets the wrong user through, JSON that serializes differently from what clients expect. An integration test catches those by running the whole application and sending it real HTTP requests. ASP.NET Core makes that cheap enough to do for every endpoint, because the application can run inside the test process with no network in between.

## How WebApplicationFactory Hosts the App

`WebApplicationFactory<TEntryPoint>`, in the `Microsoft.AspNetCore.Mvc.Testing` package, starts the application from its own `Program` and replaces Kestrel with `TestServer`, an in-memory server. `CreateClient()` returns an `HttpClient` whose handler passes each request straight to that server. Nothing listens on a port and no socket is opened, yet the request goes through the same middleware, routing, model binding, authorization, and serialization as it would in production.

{% include figure.html id="asp-test-host" %}

The test project references the package and uses the Web SDK (`<Project Sdk="Microsoft.NET.Sdk.Web">`). The type argument is the app's entry point, which in a top-level-statements app is the compiler-generated `Program` class. That class is internal by default, so apps before .NET 10 added `public partial class Program { }` to make it visible to the test project. Since .NET 10 a source generator makes it public, and the declaration is no longer needed.

```csharp
public class ProductsApiTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task GetProducts_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

As an xUnit class fixture, the factory is created once per test class. It builds and starts the application on first use and disposes it after the class's last test, while each test gets its own `HttpClient` because xUnit constructs the test class once per test. One application instance serves every test in the class, so singletons and anything they hold, such as an in-memory cache or a fake's list of records, carry over from one test to the next. Fixture lifetimes and sharing across classes are ordinary xUnit mechanics, and the same ones apply here.

A few defaults shape what the tests see:

- **The environment is Development** unless the factory sets another with `builder.UseEnvironment(...)`. Code that branches on the environment, such as the developer exception page, behaves as it does on a developer's machine.
- **The client follows redirects and keeps cookies.** `CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false })` lets a test assert on a redirect instead of silently following it to a login page. The client's base address is `http://localhost`. `TestServer` has no HTTPS port, so an app that calls `UseHttpsRedirection` doesn't redirect but logs a warning on every request, which setting `BaseAddress` to `https://localhost` avoids.
- **Hosted services start with the app.** A `BackgroundService` that polls a queue or sends email runs during the tests unless the test host removes its registration.
- **The content root is found automatically**, from an attribute the package adds to the test assembly or, failing that, the solution directory. That is how the app finds its `appsettings.json`.

## Replacing Services and Configuration

Tests need predictable behavior from the app's dependencies: a payment gateway that doesn't charge anyone, an email sender that doesn't send, a database that starts empty. A subclass of the factory overrides `ConfigureWebHost` to swap them.

```csharp
public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IExternalApiClient>();
            services.AddSingleton<IExternalApiClient, FakeExternalApiClient>();

            // No queue polling during tests
            services.Remove(services.Single(d => d.ImplementationType == typeof(QueueWorker)));

            services.AddSingleton<TimeProvider>(
                new FakeTimeProvider(new DateTimeOffset(2026, 1, 31, 0, 0, 0, TimeSpan.Zero)));
        });
    }
}
```

`ConfigureTestServices` runs after the app's own registrations in `Program`, so its registrations are the last word. `RemoveAll<T>` removes every registration of that exact service type, and the replacement then resolves wherever the app injects the interface. A hosted service is removed by its implementation type instead, because `RemoveAll<IHostedService>()` would also remove hosted services that the framework and libraries registered, such as health check publishers and telemetry exporters. The rule for what to replace is to swap only what the test can't control or shouldn't touch, such as third-party APIs, email, and payment, and keep everything else real. A test that replaces most of the app's services is a unit test with extra setup.

An app that reads the time through `TimeProvider` can be given a `FakeTimeProvider`, from `Microsoft.Extensions.TimeProvider.Testing`, whose clock stands still until the test advances it. Tests of expiry, scheduling, or month-end logic then control the date instead of depending on when they run.

Third-party APIs are often called through a typed `HttpClient` from `IHttpClientFactory` rather than behind an interface the test can swap. The test host then keeps the typed client and replaces only its innermost handler, so the app's own client code, including serialization and error handling, still runs against a canned response:

```csharp
services.AddHttpClient<IPricingClient, PricingClient>()   // same registration as the app's
    .ConfigurePrimaryHttpMessageHandler(() => new StubHttpHandler(
        HttpStatusCode.OK, """{"price": 29.99}"""));
```

`StubHttpHandler` is a few lines of test code: an `HttpMessageHandler` whose `SendAsync` returns the given status and body. The last primary handler configured for a client wins, so the test's handler replaces the app's.

For one test that needs a different setup, `WithWebHostBuilder` creates a new factory with further customization, and a new application instance with it:

```csharp
var client = factory
    .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        services.AddSingleton<IExternalApiClient>(new FailingExternalApiClient())))
    .CreateClient();
```

### Configuration Arrives When the App Is Built

Overriding configuration has a timing trap. Under the minimal hosting model, the factory applies `ConfigureAppConfiguration` sources when `WebApplicationBuilder.Build()` runs. Code in `Program` that reads `builder.Configuration` before `Build()` sees the original values, so a connection string read on the line before `AddDbContext` ignores the test's override. Values read later, inside an options lambda or from `IOptions<T>` at run time, pick it up.

Configuration the app reads before `Build()` needs to arrive earlier. Overriding the factory's `CreateHost` and calling `builder.ConfigureHostConfiguration(...)` enumerates the values before the entry point runs and passes them to it as command-line arguments, which works only if `Program` passes `args` to `WebApplication.CreateBuilder(args)`.

## Asserting on Responses

A useful integration test checks the status code, the headers that matter, and the body. The `System.Net.Http.Json` extensions, `PostAsJsonAsync` and `ReadFromJsonAsync`, serialize with the web defaults of camelCase names and case-insensitive reads, which match what ASP.NET Core sends unless the app changed its JSON options. The tests are identical whether the endpoints are minimal APIs or controllers, since the test sees only HTTP.

```csharp
[Fact]
public async Task CreateProduct_ReturnsCreatedWithLocation()
{
    var response = await _client.PostAsJsonAsync("/api/products",
        new { Name = "Widget", Price = 29.99m });

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    Assert.NotNull(response.Headers.Location);

    var created = await response.Content.ReadFromJsonAsync<ProductDto>();
    Assert.Equal("Widget", created!.Name);

    var fetched = await _client.GetFromJsonAsync<ProductDto>(response.Headers.Location);
    Assert.Equal(created.Id, fetched!.Id);
}

[Fact]
public async Task CreateProduct_WithInvalidData_ReturnsValidationProblem()
{
    var response = await _client.PostAsJsonAsync("/api/products",
        new { Name = "", Price = -10m });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

    var problem = await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
    Assert.Contains("Name", problem!.Errors.Keys);
}
```

The second test pins down the error contract, which clients depend on as much as the success path. Following the `Location` header rather than assuming an ID keeps the first test independent of what other tests created before it. Check the error keys against a real response once, since their casing depends on the app's JSON naming policy and on whether the error came from a controller or from minimal API validation.

## Testing Against a Database

An API that uses EF Core has three common database choices for its tests, and Microsoft's EF Core testing guidance recommends the first.

| Approach | What it catches | Why it falls short |
|---|---|---|
| **The real engine, in a container** | Everything: SQL translation, constraints, transactions, collation | Needs Docker, and tests must isolate their data |
| **SQLite in memory** | Most relational behavior | A different engine: case sensitivity, SQL support, and provider-specific functions differ from SQL Server or PostgreSQL |
| **The EF Core in-memory provider** | Little beyond basic CRUD | No transactions, no raw SQL, not relational. [EF Core's docs](https://learn.microsoft.com/ef/core/testing/choosing-a-testing-strategy){:target="_blank" rel="noopener noreferrer"} highly discourage it for testing |

The EF Core docs also point out that tests against a local database are usually fast enough to run constantly, and that speed is rarely a good reason to reach for a fake. When a test genuinely can't use the database, they recommend stubbing a repository layer above EF Core over either fake engine. Testing against the production engine is the default here.

### Replacing the DbContext Registration

Pointing the app at a test database means replacing how its `DbContext` is configured, and the obvious code does nothing:

```csharp
services.RemoveAll<DbContext>();   // removes nothing: the app registered ApiDbContext, not DbContext
```

Since EF Core 9, `AddDbContext<T>` also registers an `IDbContextOptionsConfiguration<T>` holding the options lambda, and a second `AddDbContext<T>` call adds a second one rather than replacing the first. Both providers then apply, and EF Core throws when the context is first used, reporting that services for two database providers are registered. The test host removes the existing configuration before adding its own:

```csharp
services.RemoveAll<IDbContextOptionsConfiguration<ApiDbContext>>();   // Microsoft.EntityFrameworkCore.Infrastructure
services.AddDbContext<ApiDbContext>(options => options.UseSqlServer(connectionString));
```

On EF Core 8 and earlier, the service to remove is `DbContextOptions<ApiDbContext>`.

### A Real Database in a Container

[Testcontainers for .NET](https://dotnet.testcontainers.org){:target="_blank" rel="noopener noreferrer"} starts a Docker container from a test fixture and removes it afterward. The version of `ApiFactory` below adds a container to the replacements shown earlier. It starts SQL Server, points the app at it, and applies the migrations once. It uses xUnit v3, where `IAsyncLifetime` methods return `ValueTask`:

```csharp
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _db =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04").Build();

    public string ConnectionString => _db.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // ...plus the replacements shown earlier
            services.RemoveAll<IDbContextOptionsConfiguration<ApiDbContext>>();
            services.AddDbContext<ApiDbContext>(options => options.UseSqlServer(ConnectionString));
        });
    }

    public async ValueTask InitializeAsync()
    {
        await _db.StartAsync();

        using var scope = Services.CreateScope();   // first access to Services builds and starts the app
        await scope.ServiceProvider.GetRequiredService<ApiDbContext>().Database.MigrateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _db.DisposeAsync();
    }
}
```

The container has to be running before the app is built. Its connection string includes a port Docker assigns at start, and the migration, like any startup code that touches the database, connects straight away. Starting a container takes seconds, not milliseconds, so one container usually serves many test classes through an xUnit collection fixture rather than starting per class:

```csharp
[CollectionDefinition("Api")]
public class ApiCollection : ICollectionFixture<ApiFactory>;
```
 The same builders exist for PostgreSQL, MySQL, Redis, and other engines, with the same lifecycle.

### Resetting Data Between Tests

Tests that share one database need it back in a known state before each test. [Respawn](https://github.com/jbogard/Respawn){:target="_blank" rel="noopener noreferrer"} reads the schema's foreign keys and deletes every table's rows in dependency order, which is far faster than recreating the database or restarting the container. Since Respawn 7 it takes an open `DbConnection` and infers the database type from it:

```csharp
[Collection("Api")]
public class ProductPersistenceTests(ApiFactory factory) : IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient();

    public async ValueTask InitializeAsync()
    {
        await using var connection = new SqlConnection(factory.ConnectionString);
        await connection.OpenAsync();

        var respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            TablesToIgnore = ["__EFMigrationsHistory"]
        });
        await respawner.ResetAsync(connection);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task CreatedProduct_IsReturnedByList()
    {
        await _client.PostAsJsonAsync("/api/products", new { Name = "Widget", Price = 29.99m });

        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/products");

        Assert.Single(products!);
    }
}
```

Creating the respawner reads the schema, so a suite with many classes builds it once in the shared fixture and calls only `ResetAsync` per test. Resetting at the start of each test rather than the end means a failed test leaves its data behind for inspection. Resetting a shared database also means those tests can't run in parallel with each other, which a shared collection already guarantees in xUnit's default mode.

## Testing Authentication and Authorization

Real tokens make tests depend on an identity provider, and a test can't easily mint tokens for every role and claim combination it needs. A test authentication handler replaces the real scheme and builds a principal from request headers, so each test states who it is:

```csharp
public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-User", out var user))
        {
            return Task.FromResult(AuthenticateResult.NoResult());   // anonymous
        }

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, user.ToString()) };
        claims.AddRange(Request.Headers["X-Test-Roles"].ToString()
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(role => new Claim(ClaimTypes.Role, role)));

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
```

The test host registers it and makes it the default for authenticating and challenging:

```csharp
services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
})
.AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
```

Everything after authentication stays real: the authorization middleware, the policies, and any resource-based checks run exactly as in production. The tests cover each outcome, because 401 and 403 mean different things. Authorization challenges an anonymous request, and this handler's challenge is the default 401. It forbids an authenticated user who fails the policy with 403.

```csharp
[Theory]
[InlineData(null, null, HttpStatusCode.Unauthorized)]
[InlineData("alice", "User", HttpStatusCode.Forbidden)]
[InlineData("alice", "Admin", HttpStatusCode.OK)]
public async Task AdminReport_RequiresAdminRole(string? user, string? roles, HttpStatusCode expected)
{
    using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/report");
    if (user is not null) request.Headers.Add("X-Test-User", user);
    if (roles is not null) request.Headers.Add("X-Test-Roles", roles);

    var response = await _client.SendAsync(request);

    Assert.Equal(expected, response.StatusCode);
}
```

Setting the headers per request rather than on `DefaultRequestHeaders` keeps one test's identity from leaking into another that shares the client.

A policy or `[Authorize(AuthenticationSchemes = ...)]` that names a scheme, such as `JwtBearerDefaults.AuthenticationScheme`, bypasses the defaults. It authenticates and challenges with that named scheme, so the test handler never runs. Registering the test handler under the same name doesn't work, because adding a scheme whose name already exists throws. The test host instead points the existing scheme at the test handler:

```csharp
services.Configure<AuthenticationOptions>(options =>
    options.SchemeMap[JwtBearerDefaults.AuthenticationScheme].HandlerType = typeof(TestAuthHandler));
```

## Snapshot Testing Responses

A response with dozens of fields makes a poor target for field-by-field assertions, and those assertions miss the field nobody thought to check. A snapshot test serializes the whole output, stores it as an approved file, and fails when a later run differs. [Verify](https://github.com/VerifyTests/Verify){:target="_blank" rel="noopener noreferrer"} is the common .NET library for it, with a package per test framework, such as `Verify.XunitV3`.

```csharp
[Fact]
public async Task GetProduct_MatchesSnapshot()
{
    var json = await _client.GetStringAsync("/api/products/1");

    await VerifyJson(json)
        .IgnoreMember("etag");
}
```

The first run writes a `.received` file and fails, since nothing is approved yet. Approving it means renaming it to `.verified`, by hand or through Verify's diff tooling, and committing that file, which sits next to the test source file. Later runs compare against it and fail when they differ, opening a diff tool on a developer machine. `VerifyJson` parses the string rather than comparing raw text, so member-level settings apply to its keys. By default Verify replaces GUIDs and dates in the data with stable placeholders such as `Guid_1`. Other volatile values need handling, by key with `IgnoreMember` or inside strings with `ScrubInlineGuids` and `ScrubInlineDateTimes("yyyy-MM-dd")`.

A snapshot catches a renamed property, a changed type, or a field that appears or disappears, all of which break clients. The cost is review: every intentional change to the response fails the test until someone approves the new snapshot. That suits stable contracts, where an unreviewed change is exactly what should fail, and wears thin on an API still changing daily.

## Testing SignalR Hubs

A hub test connects a real SignalR client to the in-memory server. The client first sends an HTTP negotiate request, and the server's answer lists the transports it supports: WebSockets, Server-Sent Events, and long polling. The client tries them in that order, falling back to the next when one fails. So it makes two kinds of connections, and both have to be redirected. `HttpMessageHandlerFactory` routes the negotiate request and the HTTP-based transports through `TestServer`, and `WebSocketFactory` opens the WebSocket through `TestServer`'s WebSocket client instead of the network:

```csharp
private HubConnection CreateConnection() =>
    new HubConnectionBuilder()
        .WithUrl(new Uri(factory.Server.BaseAddress, "/hubs/chat"), options =>
        {
            options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            options.WebSocketFactory = (context, ct) => new ValueTask<WebSocket>(
                factory.Server.CreateWebSocketClient().ConnectAsync(context.Uri, ct));
        })
        .Build();
```

Without the WebSocket factory, the client's WebSocket attempt goes to a real `localhost` address where nothing is listening, and the client falls back to Server-Sent Events, so the test passes while exercising a different transport from production.

Messages arrive on a callback, so the test waits on a `TaskCompletionSource` with a timeout rather than a fixed delay:

```csharp
[Fact]
public async Task GroupMessage_ReachesOnlyMembers()
{
    await using var member = CreateConnection();
    await using var outsider = CreateConnection();

    var memberGot = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
    var outsiderGot = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
    member.On<string>("ReceiveMessage", msg => memberGot.TrySetResult(msg));
    outsider.On<string>("ReceiveMessage", msg => outsiderGot.TrySetResult(msg));

    await member.StartAsync();
    await outsider.StartAsync();
    await member.InvokeAsync("JoinGroup", "ops");
    await member.InvokeAsync("SendToGroup", "ops", "deploy started");

    Assert.Equal("deploy started", await memberGot.Task.WaitAsync(TimeSpan.FromSeconds(5)));
    await Assert.ThrowsAsync<TimeoutException>(() => outsiderGot.Task.WaitAsync(TimeSpan.FromSeconds(1)));
}
```

`RunContinuationsAsynchronously` keeps the test's continuation off the SignalR client's receive loop. The negative check can only wait for a while and conclude nothing arrived, so it uses a short timeout and costs that second on every run.

## What the In-Memory Host Doesn't Cover

`TestServer` skips the network, and some tests need it.

- **Browser tests** need a real address the browser can reach. Since .NET 10, `UseKestrel()` on the factory makes it host the app on Kestrel instead of `TestServer`, and `StartServer()` starts it without creating a client, so a tool like Playwright can drive the app while the test still controls its services.
- **Load tests** measure the deployed system, including the network, the server, and the real database under concurrency. They run against a running environment on a schedule, separately from the integration suite.
- **Server and proxy behavior**, such as Kestrel limits, HTTP/2 negotiation, TLS, and forwarded headers from a real proxy, isn't exercised in memory at all.

Integration tests are slower than unit tests, mostly because of the database. A trait on the database-backed classes lets a fast local run filter them out, while CI runs everything.

## Key Takeaways

- `WebApplicationFactory` runs the real app in memory through `TestServer`, so integration tests exercise routing, binding, middleware, authorization, and serialization without a network. Since .NET 10 the `Program` class is public without a partial declaration.
- One factory, and one app instance, serves every test in a class. Singletons and hosted services carry state across tests unless the test host replaces them.
- `ConfigureTestServices` runs after the app's registrations. Replace only the dependencies the test can't control, and keep the rest real.
- Configuration from `ConfigureAppConfiguration` arrives at `Build()`, so values `Program` reads before `Build()` need `ConfigureHostConfiguration` instead.
- Test against the production database engine in a container, reset data with Respawn, and avoid the EF Core in-memory provider. On EF Core 9 and later, replacing a `DbContext` means removing its `IDbContextOptionsConfiguration<T>`.
- A test authentication handler keeps authorization real. Test anonymous (401), unauthorized (403), and authorized cases for each protected endpoint. An endpoint that names its scheme needs that scheme's handler type swapped, since adding a second scheme with the same name throws.
- Fake a third-party HTTP API at the primary handler of its typed client, so the app's client code still runs.
- Snapshot tests with Verify guard response contracts, at the cost of reviewing every intentional change.
- SignalR hub tests need both `HttpMessageHandlerFactory` and `WebSocketFactory` pointed at `TestServer`, or they silently test a fallback transport.
