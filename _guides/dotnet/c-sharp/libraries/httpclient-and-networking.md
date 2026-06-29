---
title: "C# HttpClient and Networking"
layout: guide
category: ".NET & C#"
subcategory: "Libraries & Frameworks"
description: "HttpClient patterns, IHttpClientFactory, resilience, REST APIs, and modern networking best practices."
tags: [c-sharp, dotnet, networking, httpclient, rest-api, resilience, practical]
---

## HttpClient Basics

HttpClient is the primary class for making HTTP requests in .NET.

```csharp
using var client = new HttpClient();
client.BaseAddress = new Uri("https://api.example.com/");

// GET request
HttpResponseMessage response = await client.GetAsync("users/1");
response.EnsureSuccessStatusCode();  // Throws if not 2xx
string content = await response.Content.ReadAsStringAsync();

// GET with JSON deserialization
User? user = await client.GetFromJsonAsync<User>("users/1");

// POST with JSON
var newUser = new User { Name = "Alice", Email = "alice@example.com" };
response = await client.PostAsJsonAsync("users", newUser);

// PUT
await client.PutAsJsonAsync("users/1", updatedUser);

// DELETE
await client.DeleteAsync("users/1");
```

## The HttpClient Lifetime Problem

Creating HttpClient instances directly causes socket exhaustion.

```csharp
// WRONG - causes socket exhaustion
for (int i = 0; i < 1000; i++)
{
    using var client = new HttpClient();  // Bad: creates new connection each time
    await client.GetAsync("https://api.example.com/data");
}
// Sockets linger in TIME_WAIT state, eventually exhausting available ports

// ALSO WRONG - static client doesn't respect DNS changes
private static readonly HttpClient _client = new HttpClient();  // DNS cached forever
```

<div class="callout callout--warning">
<p class="callout__title">The HttpClient Dilemma</p>
<p>Creating HttpClient instances in a <code>using</code> block causes socket exhaustion. Creating a static instance caches DNS forever. .NET provides two ways to solve this: a static <code>HttpClient</code> with <code>SocketsHttpHandler</code> connection rotation for simple scenarios, and <code>IHttpClientFactory</code> for DI-based applications.</p>
</div>

## Choosing a Creation Strategy

Both approaches solve socket exhaustion and DNS caching, but they serve different application types.

| Approach | Best for | DNS handling | DI required |
|---|---|---|---|
| Static + SocketsHttpHandler | Console apps, libraries, Azure Functions | `PooledConnectionLifetime` rotates connections | No |
| IHttpClientFactory (basic) | DI-based apps with simple HTTP needs | Automatic handler rotation (default 2 min) | Yes |
| Named clients (via factory) | DI-based apps calling multiple external APIs | Via factory | Yes |
| Typed clients (via factory) | Complex API integrations needing encapsulation | Via factory | Yes |

## Static HttpClient with SocketsHttpHandler

For applications without dependency injection, or libraries that shouldn't impose DI requirements on consumers, a static `HttpClient` with `SocketsHttpHandler` solves both problems at once.

```csharp
private static readonly HttpClient _client = new HttpClient(new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(2),
    PooledConnectionIdleTimeout = TimeSpan.FromMinutes(1),
    MaxConnectionsPerServer = 10
});
```

`SocketsHttpHandler` (the default handler since .NET Core 2.1) manages its own connection pool internally. Setting `PooledConnectionLifetime` ensures connections are recycled after the specified duration, which triggers fresh DNS resolution on subsequent requests. This gives you the reuse benefits of a static client without the stale DNS problem.

When multiple static clients need to call different APIs, share a single handler to avoid duplicating connection pools.

```csharp
public static class HttpClients
{
    private static readonly SocketsHttpHandler SharedHandler = new()
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(2),
        PooledConnectionIdleTimeout = TimeSpan.FromMinutes(1),
        MaxConnectionsPerServer = 10
    };

    public static HttpClient GitHub { get; } = new(SharedHandler, disposeHandler: false)
    {
        BaseAddress = new Uri("https://api.github.com/"),
        DefaultRequestHeaders =
        {
            { "Accept", "application/vnd.github.v3+json" },
            { "User-Agent", "MyApp" }
        }
    };

    public static HttpClient Weather { get; } = new(SharedHandler, disposeHandler: false)
    {
        BaseAddress = new Uri("https://api.weather.com/"),
        Timeout = TimeSpan.FromSeconds(30)
    };
}
```

Setting `disposeHandler: false` is critical when sharing a handler across multiple clients. Without it, disposing one client closes connections used by others.

**When to use this approach**:
- Console applications and CLI tools
- Azure Functions (especially the isolated worker model)
- Libraries and NuGet packages that shouldn't force consumers into DI
- Simple services with one or two HTTP dependencies
- Unit tests and prototypes

## IHttpClientFactory

For ASP.NET Core applications and other DI-based services, `IHttpClientFactory` manages handler lifetime and connection pooling automatically. It creates `HttpMessageHandler` instances with a configurable lifetime (2 minutes by default), pooling and reusing them across `HttpClient` instances.

### Basic Factory Usage

```csharp
// Registration in DI
services.AddHttpClient();

// Injection and usage
public class MyService
{
    private readonly IHttpClientFactory _clientFactory;

    public MyService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }

    public async Task<string> GetDataAsync()
    {
        var client = _clientFactory.CreateClient();
        return await client.GetStringAsync("https://api.example.com/data");
    }
}
```

### Named Clients

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Named Clients</h4>
<ul>
<li>Configure per-API settings</li>
<li>Access via factory with name</li>
<li>Good for multiple external APIs</li>
<li>Simple configuration</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Typed Clients</h4>
<ul>
<li>Encapsulate HTTP logic in class</li>
<li>Inject client directly</li>
<li>Better for complex APIs</li>
<li>Type-safe and testable</li>
</ul>
</div>
</div>

Configure different settings for different APIs.

```csharp
// Registration
services.AddHttpClient("github", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
    client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
});

services.AddHttpClient("weather", client =>
{
    client.BaseAddress = new Uri("https://api.weather.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Usage
var githubClient = _clientFactory.CreateClient("github");
var weatherClient = _clientFactory.CreateClient("weather");
```

### Typed Clients

Encapsulate HTTP logic in dedicated service classes.

```csharp
// Typed client class
public class GitHubClient
{
    private readonly HttpClient _client;

    public GitHubClient(HttpClient client)
    {
        _client = client;
        _client.BaseAddress = new Uri("https://api.github.com/");
        _client.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3+json");
        _client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
    }

    public async Task<IEnumerable<Repository>> GetRepositoriesAsync(string user)
    {
        var repos = await _client.GetFromJsonAsync<List<Repository>>($"users/{user}/repos");
        return repos ?? Enumerable.Empty<Repository>();
    }

    public async Task<Repository?> GetRepositoryAsync(string owner, string repo)
    {
        return await _client.GetFromJsonAsync<Repository>($"repos/{owner}/{repo}");
    }
}

// Registration
services.AddHttpClient<GitHubClient>();

// Usage - inject typed client directly
public class MyService
{
    private readonly GitHubClient _github;

    public MyService(GitHubClient github)
    {
        _github = github;
    }

    public async Task DisplayReposAsync(string user)
    {
        var repos = await _github.GetRepositoriesAsync(user);
        foreach (var repo in repos)
        {
            Console.WriteLine(repo.Name);
        }
    }
}
```

## Request and Response Handling

### Setting Headers

```csharp
// Default headers (on HttpClient)
client.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token);

// Per-request headers
var request = new HttpRequestMessage(HttpMethod.Get, "users");
request.Headers.Add("X-Request-Id", Guid.NewGuid().ToString());

// Content headers
var content = new StringContent(json, Encoding.UTF8, "application/json");
content.Headers.ContentType = new MediaTypeHeaderValue("application/json")
{
    CharSet = "utf-8"
};
```

### Reading Responses

```csharp
HttpResponseMessage response = await client.GetAsync("users/1");

// Status checking
if (response.IsSuccessStatusCode)  // 200-299
{
    var user = await response.Content.ReadFromJsonAsync<User>();
}

// Get specific status
HttpStatusCode status = response.StatusCode;
switch (status)
{
    case HttpStatusCode.OK:
        break;
    case HttpStatusCode.NotFound:
        throw new UserNotFoundException();
    case HttpStatusCode.Unauthorized:
        throw new AuthenticationException();
}

// Read response headers
string? etag = response.Headers.ETag?.Tag;
DateTimeOffset? expires = response.Content.Headers.Expires;

// Read as different types
string text = await response.Content.ReadAsStringAsync();
byte[] bytes = await response.Content.ReadAsByteArrayAsync();
Stream stream = await response.Content.ReadAsStreamAsync();
```

### Sending Different Content Types

```csharp
// JSON
var json = JsonSerializer.Serialize(user);
var jsonContent = new StringContent(json, Encoding.UTF8, "application/json");
await client.PostAsync("users", jsonContent);

// Or using extension method
await client.PostAsJsonAsync("users", user);

// Form data
var formContent = new FormUrlEncodedContent(new Dictionary<string, string>
{
    ["username"] = "alice",
    ["password"] = "secret"
});
await client.PostAsync("login", formContent);

// Multipart (file upload)
using var multipart = new MultipartFormDataContent();
multipart.Add(new StringContent("Alice"), "name");

using var fileStream = File.OpenRead("photo.jpg");
var fileContent = new StreamContent(fileStream);
fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
multipart.Add(fileContent, "file", "photo.jpg");

await client.PostAsync("upload", multipart);
```

## Cancellation

<div class="callout callout--tip">
<p class="callout__title">Always Support Cancellation</p>
<p>Cancellation tokens enable request timeouts, user-initiated cancellation, and graceful shutdown. Pass them through to all async HTTP operations.</p>
</div>

```csharp
// With CancellationToken
public async Task<User?> GetUserAsync(int id, CancellationToken cancellationToken = default)
{
    try
    {
        return await _client.GetFromJsonAsync<User>(
            $"users/{id}",
            cancellationToken);
    }
    catch (OperationCanceledException)
    {
        // Request was cancelled
        return null;
    }
}

// Timeout via CancellationToken
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
try
{
    var result = await client.GetStringAsync(url, cts.Token);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Request timed out");
}

// Combined timeout
using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    requestCancellation,
    timeoutCts.Token);
```

## Error Handling

```csharp
public async Task<Result<User>> GetUserSafeAsync(int id)
{
    try
    {
        var response = await _client.GetAsync($"users/{id}");

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return Result<User>.NotFound($"User {id} not found");
        }

        response.EnsureSuccessStatusCode();

        var user = await response.Content.ReadFromJsonAsync<User>();
        return Result<User>.Success(user!);
    }
    catch (HttpRequestException ex)
    {
        _logger.LogError(ex, "HTTP error getting user {UserId}", id);
        return Result<User>.Error("Network error occurred");
    }
    catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
    {
        _logger.LogWarning("Timeout getting user {UserId}", id);
        return Result<User>.Error("Request timed out");
    }
    catch (JsonException ex)
    {
        _logger.LogError(ex, "Failed to parse user response");
        return Result<User>.Error("Invalid response format");
    }
}
```

## Resilience with Polly

Add retry, circuit breaker, and timeout policies.

```csharp
// Install: Microsoft.Extensions.Http.Polly

// Retry policy
services.AddHttpClient<WeatherClient>()
    .AddTransientHttpErrorPolicy(policy =>
        policy.WaitAndRetryAsync(3, retryAttempt =>
            TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))));

// Circuit breaker
services.AddHttpClient<PaymentClient>()
    .AddTransientHttpErrorPolicy(policy =>
        policy.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30)));

// Combined policies
services.AddHttpClient<ApiClient>()
    .AddTransientHttpErrorPolicy(policy =>
        policy.WaitAndRetryAsync(3, _ => TimeSpan.FromMilliseconds(300)))
    .AddTransientHttpErrorPolicy(policy =>
        policy.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30)));

// Custom policy
var retryPolicy = Policy
    .HandleResult<HttpResponseMessage>(r =>
        r.StatusCode == HttpStatusCode.TooManyRequests)
    .WaitAndRetryAsync(3, retryAttempt =>
    {
        // Respect Retry-After header
        return TimeSpan.FromSeconds(Math.Pow(2, retryAttempt));
    });

services.AddHttpClient<RateLimitedClient>()
    .AddPolicyHandler(retryPolicy);
```

## Delegating Handlers

Add cross-cutting concerns like logging, authentication, or metrics.

```csharp
// Logging handler
public class LoggingHandler : DelegatingHandler
{
    private readonly ILogger<LoggingHandler> _logger;

    public LoggingHandler(ILogger<LoggingHandler> logger)
    {
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();

        _logger.LogInformation("Sending {Method} {Uri}",
            request.Method, request.RequestUri);

        var response = await base.SendAsync(request, cancellationToken);

        _logger.LogInformation("Received {StatusCode} from {Uri} in {Elapsed}ms",
            response.StatusCode, request.RequestUri, sw.ElapsedMilliseconds);

        return response;
    }
}

// Auth token handler
public class AuthTokenHandler : DelegatingHandler
{
    private readonly ITokenService _tokenService;

    public AuthTokenHandler(ITokenService tokenService)
    {
        _tokenService = tokenService;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var token = await _tokenService.GetTokenAsync();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await base.SendAsync(request, cancellationToken);

        // Handle token expiration
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            token = await _tokenService.RefreshTokenAsync();
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            response = await base.SendAsync(request, cancellationToken);
        }

        return response;
    }
}

// Registration
services.AddTransient<LoggingHandler>();
services.AddTransient<AuthTokenHandler>();

services.AddHttpClient<ApiClient>()
    .AddHttpMessageHandler<AuthTokenHandler>()
    .AddHttpMessageHandler<LoggingHandler>();
```

## Streaming Large Responses

```csharp
// Stream response without loading into memory
public async Task DownloadFileAsync(string url, string destinationPath)
{
    using var response = await _client.GetAsync(url,
        HttpCompletionOption.ResponseHeadersRead);

    response.EnsureSuccessStatusCode();

    await using var contentStream = await response.Content.ReadAsStreamAsync();
    await using var fileStream = File.Create(destinationPath);

    await contentStream.CopyToAsync(fileStream);
}

// Process large JSON stream
public async IAsyncEnumerable<User> GetUsersStreamAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    using var response = await _client.GetAsync("users/all",
        HttpCompletionOption.ResponseHeadersRead,
        cancellationToken);

    response.EnsureSuccessStatusCode();

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);

    await foreach (var user in JsonSerializer.DeserializeAsyncEnumerable<User>(
        stream, cancellationToken: cancellationToken))
    {
        if (user != null)
            yield return user;
    }
}
```

## HTTP/2 and HTTP/3

```csharp
// HTTP/2 (default in .NET Core 3.0+)
var handler = new SocketsHttpHandler
{
    // Connection pooling
    PooledConnectionLifetime = TimeSpan.FromMinutes(2),
    PooledConnectionIdleTimeout = TimeSpan.FromMinutes(1),
    MaxConnectionsPerServer = 10,

    // HTTP/2 settings
    EnableMultipleHttp2Connections = true
};

var client = new HttpClient(handler);

// Force HTTP version
var request = new HttpRequestMessage(HttpMethod.Get, url)
{
    Version = HttpVersion.Version20,
    VersionPolicy = HttpVersionPolicy.RequestVersionExact
};

// HTTP/3 (.NET 7+)
var http3Handler = new SocketsHttpHandler
{
    // Enable HTTP/3
};
var request3 = new HttpRequestMessage(HttpMethod.Get, url)
{
    Version = HttpVersion.Version30,
    VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
};
```

## Configuration Best Practices

```csharp
// Configure via IHttpClientFactory
services.AddHttpClient("api", (serviceProvider, client) =>
{
    var config = serviceProvider.GetRequiredService<IConfiguration>();
    client.BaseAddress = new Uri(config["ApiBaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(30);
})
.ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
    PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
    MaxConnectionsPerServer = 20,
    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
});

// Named options per client
services.AddHttpClient("internal")
    .ConfigureHttpClient(client => client.Timeout = TimeSpan.FromSeconds(5));

services.AddHttpClient("external")
    .ConfigureHttpClient(client => client.Timeout = TimeSpan.FromSeconds(60));
```

## Testing HttpClient

```csharp
// Mock handler for unit tests
public class MockHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

    public MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
    {
        _handler = handler;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(_handler(request));
    }
}

// Usage in tests
[Fact]
public async Task GetUser_ReturnsUser()
{
    var mockHandler = new MockHttpMessageHandler(request =>
    {
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Contains("users/1", request.RequestUri!.ToString());

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new User { Id = 1, Name = "Alice" })
        };
    });

    var client = new HttpClient(mockHandler)
    {
        BaseAddress = new Uri("https://api.example.com/")
    };

    var userService = new UserService(client);
    var user = await userService.GetUserAsync(1);

    Assert.Equal("Alice", user.Name);
}

// With Moq and interface
public interface IApiClient
{
    Task<User?> GetUserAsync(int id);
}

var mockClient = new Mock<IApiClient>();
mockClient.Setup(c => c.GetUserAsync(1))
    .ReturnsAsync(new User { Id = 1, Name = "Alice" });
```

## REST API Client Pattern

```csharp
public interface IRestClient
{
    Task<T?> GetAsync<T>(string path, CancellationToken cancellationToken = default);
    Task<TResponse?> PostAsync<TRequest, TResponse>(string path, TRequest data, CancellationToken cancellationToken = default);
    Task PutAsync<T>(string path, T data, CancellationToken cancellationToken = default);
    Task DeleteAsync(string path, CancellationToken cancellationToken = default);
}

public class RestClient : IRestClient
{
    private readonly HttpClient _client;
    private readonly ILogger<RestClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public RestClient(HttpClient client, ILogger<RestClient> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<T?> GetAsync<T>(string path, CancellationToken cancellationToken = default)
    {
        var response = await _client.GetAsync(path, cancellationToken);
        await EnsureSuccessAsync(response, path);
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken);
    }

    public async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string path,
        TRequest data,
        CancellationToken cancellationToken = default)
    {
        var response = await _client.PostAsJsonAsync(path, data, JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, path);
        return await response.Content.ReadFromJsonAsync<TResponse>(JsonOptions, cancellationToken);
    }

    public async Task PutAsync<T>(string path, T data, CancellationToken cancellationToken = default)
    {
        var response = await _client.PutAsJsonAsync(path, data, JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, path);
    }

    public async Task DeleteAsync(string path, CancellationToken cancellationToken = default)
    {
        var response = await _client.DeleteAsync(path, cancellationToken);
        await EnsureSuccessAsync(response, path);
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage response, string path)
    {
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            _logger.LogError("HTTP {StatusCode} from {Path}: {Content}",
                response.StatusCode, path, content);
            throw new ApiException(response.StatusCode, content);
        }
    }
}
```

## Key Takeaways

**Manage HttpClient lifetime deliberately**: Use `IHttpClientFactory` in DI-based applications or a static `HttpClient` with `SocketsHttpHandler.PooledConnectionLifetime` in simpler scenarios. Never create and dispose `HttpClient` in a tight loop.

**Typed clients for clean APIs**: In DI-based apps, encapsulate HTTP logic in typed client classes for better organization and testability.

**Handle failures gracefully**: Use Polly for retries and circuit breakers. Handle timeouts and network errors explicitly.

**Use cancellation tokens**: Always pass cancellation tokens for timeout control and cooperative cancellation.

**Stream large responses**: Use HttpCompletionOption.ResponseHeadersRead and stream processing for large payloads.

**Add cross-cutting concerns via handlers**: Use DelegatingHandler for logging, authentication, and metrics.
