---
title: "Rate Limiting and Resilience"
layout: guide
category: "ASP.NET Core"
subcategory: "API Security & Resilience"
description: "Rate limiting middleware, algorithms, and resilience patterns for protecting and stabilizing ASP.NET Core APIs under load and failure scenarios."
tags: [asp-net-core, rate-limiting, resilience, polly, circuit-breaker, cors, security, performance]
---

## Protecting APIs Under Load

APIs face two distinct challenges. First, they must protect themselves from excessive requests that could overwhelm resources or signal abuse. Second, they must remain functional when downstream dependencies experience transient failures. ASP.NET Core addresses the first challenge with built-in rate limiting middleware and CORS policies, and the second with resilience patterns provided through Polly and Microsoft.Extensions.Http.Resilience.

This guide covers rate limiting algorithms, per-endpoint policy configuration, CORS middleware, and resilience strategies including retry, circuit breaker, timeout, and bulkhead patterns.

## Built-In Rate Limiting

ASP.NET Core 7 introduced Microsoft.AspNetCore.RateLimiting middleware as a first-class feature. This middleware evaluates incoming requests against configured policies and rejects requests that exceed defined limits with HTTP 429 Too Many Requests responses.

Rate limiting prevents several problems. It protects resources from being overwhelmed by excessive requests, ensures fair usage across multiple consumers, and mitigates abuse scenarios where attackers attempt to exhaust resources or perform reconnaissance.

The middleware works by registering rate limiting services, defining policies that specify limits and algorithms, and then attaching those policies to endpoints. When a request arrives, the middleware checks whether the endpoint has an associated policy and evaluates the request against that policy's limits.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context => RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

app.UseRateLimiter();
```

The middleware requires explicit registration with AddRateLimiter before calling UseRateLimiter in the pipeline. Without AddRateLimiter, the middleware throws an exception at runtime. This ensures developers consciously opt into rate limiting rather than accidentally enabling it.

## Rate Limiting Algorithms

ASP.NET Core provides four rate limiting algorithms: fixed window, sliding window, token bucket, and concurrency. Each algorithm addresses different use cases and offers distinct trade-offs between simplicity, fairness, and resource control.

### Fixed Window

The fixed window limiter divides time into discrete intervals. Each window allows a fixed number of requests. When the window expires, the counter resets regardless of when requests arrived within that window.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", config =>
    {
        config.PermitLimit = 10;
        config.Window = TimeSpan.FromSeconds(30);
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 5;
    });
});
```

This algorithm works well when you need simple, predictable limits and can accept that clients might spike requests at window boundaries. A client could send 10 requests at the end of one window and 10 more immediately when the next window starts, effectively doubling the rate briefly.

### Sliding Window

The sliding window limiter improves on fixed windows by dividing each window into segments. The window slides forward one segment at a time. Expired segments release their permits, which become available in the current window.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddSlidingWindowLimiter("sliding", config =>
    {
        config.PermitLimit = 10;
        config.Window = TimeSpan.FromSeconds(30);
        config.SegmentsPerWindow = 3;
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 5;
    });
});
```

With three segments per 30-second window, each segment represents 10 seconds. As time advances, the oldest segment expires and its permits return to the pool. This creates smoother rate enforcement compared to fixed windows, since the boundary reset effect is distributed across segments rather than happening all at once.

Use sliding windows when you need more accurate rate enforcement and can accept the slight increase in memory and computation compared to fixed windows.

### Token Bucket

The token bucket algorithm models rate limiting as a bucket containing tokens. Each request consumes a token. The bucket refills at a steady rate up to its capacity. When the bucket is empty, requests are rejected or queued.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddTokenBucketLimiter("token", config =>
    {
        config.TokenLimit = 10;
        config.TokensPerPeriod = 2;
        config.ReplenishmentPeriod = TimeSpan.FromSeconds(5);
        config.AutoReplenishment = true;
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 5;
    });
});
```

This configuration starts with 10 tokens and adds 2 tokens every 5 seconds. Token buckets allow brief bursts of traffic up to the token limit while enforcing a steady average rate determined by the replenishment period. A client could consume all 10 tokens immediately, then wait 25 seconds for 10 more tokens to accumulate.

Token buckets shine when you want to allow occasional bursts while maintaining strict average throughput. They model scenarios where resources can handle short spikes but would fail under sustained high rates.

### Concurrency

The concurrency limiter controls how many requests can execute simultaneously rather than limiting requests per time period. When a request completes, a permit becomes available for the next queued request.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddConcurrencyLimiter("concurrency", config =>
    {
        config.PermitLimit = 5;
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 10;
    });
});
```

If the limit is 5, then 5 requests execute concurrently. The 6th request waits in the queue. Once any of the 5 completes, the 6th begins processing. This algorithm differs from the time-based limiters because it measures resource occupancy rather than request frequency.

Concurrency limiters protect resources with limited capacity such as database connections, worker threads, or external API quotas that count simultaneous requests rather than total requests.

### Algorithm Comparison

| Algorithm | Controls | Best For | Allows Bursts | Retry-After Header |
|-----------|----------|----------|---------------|-------------------|
| Fixed Window | Requests per time window | Simple rate limits | At window boundaries | Yes |
| Sliding Window | Requests per sliding window | Smooth rate enforcement | Minimal | Yes |
| Token Bucket | Average rate with burst capacity | Burst tolerance with steady average | Up to token limit | Yes |
| Concurrency | Simultaneous requests | Resource capacity control | No | No |

The Retry-After header informs clients when permits will become available. Fixed window, sliding window, and token bucket limiters can calculate this value because they know when windows reset or tokens replenish. Concurrency limiters cannot predict when permits become available since that depends on when in-flight requests complete.

## Rate Limiting Policies

Policies define rate limiting behavior and associate it with endpoints. ASP.NET Core supports global policies that apply to all endpoints and named policies that apply selectively.

### Global Limiters

A global limiter applies to every request unless an endpoint explicitly disables rate limiting. This provides baseline protection across the entire API.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context => RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User?.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: partition => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));
});
```

The partitionKey determines how requests are grouped for rate limiting. Partitioning by authenticated user identity ensures each user gets their own permit pool. Partitioning by IP address provides coarse protection against unauthenticated abuse. Partitioning by API key works when clients authenticate with keys rather than user credentials.

Global limiters serve as a safety net. Even if specific endpoints forget to apply their own policies, the global limiter prevents runaway request rates.

### Named Policies

Named policies allow different endpoints to enforce different limits based on their resource costs and sensitivity.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("strict", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User?.Identity?.Name ?? "anonymous",
            factory: partition => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddPolicy("relaxed", context =>
        RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: context.User?.Identity?.Name ?? "anonymous",
            factory: partition => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 50,
                TokensPerPeriod = 10,
                ReplenishmentPeriod = TimeSpan.FromSeconds(10)
            }));
});
```

Expensive operations like report generation or search might use strict policies, while lightweight operations like health checks or metadata queries use relaxed policies. This differentiation protects expensive resources without unnecessarily constraining cheap operations.

### Per-Endpoint Configuration

Apply named policies to endpoints using the RequireRateLimiting extension method on minimal APIs or the EnableRateLimiting attribute on controllers.

```csharp
app.MapGet("/expensive-operation", async () =>
{
    await Task.Delay(100);
    return Results.Ok("Operation complete");
})
.RequireRateLimiting("strict");

app.MapGet("/lightweight-operation", () => Results.Ok("Fast"))
    .RequireRateLimiting("relaxed");
```

For controllers, apply the attribute at the controller or action level.

```csharp
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("relaxed")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok(products);

    [HttpPost]
    [EnableRateLimiting("strict")]
    public IActionResult Create(Product product) => Created("", product);
}
```

The controller-level attribute provides a default policy for all actions. Individual actions override the controller policy when they specify their own EnableRateLimiting attribute. This allows most operations to share a common policy while expensive operations enforce stricter limits.

Endpoints can disable rate limiting entirely using the DisableRateLimiting attribute or DisableRateLimiting extension method. This suits public endpoints like health checks that should never be throttled.

## Custom Rate Limit Policies

Custom policies provide control over partition keys and dynamic policy selection based on request context. Implement IRateLimiterPolicy<TPartitionKey> to define custom logic.

```csharp
public class ApiKeyRateLimitPolicy : IRateLimiterPolicy<string>
{
    public Func<OnRejectedContext, CancellationToken, ValueTask>? OnRejected { get; } =
        (context, token) =>
        {
            context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return ValueTask.CompletedTask;
        };

    public RateLimitPartition<string> GetPartition(HttpContext httpContext)
    {
        var apiKey = httpContext.Request.Headers["X-API-Key"].FirstOrDefault() ?? "anonymous";

        var tierLimits = apiKey switch
        {
            "premium-key" => (PermitLimit: 1000, Window: TimeSpan.FromMinutes(1)),
            "standard-key" => (PermitLimit: 100, Window: TimeSpan.FromMinutes(1)),
            _ => (PermitLimit: 10, Window: TimeSpan.FromMinutes(1))
        };

        return RateLimitPartition.GetFixedWindowLimiter(apiKey, _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = tierLimits.PermitLimit,
                Window = tierLimits.Window
            });
    }
}

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy<string, ApiKeyRateLimitPolicy>("api-key-policy");
});
```

This policy extracts an API key from headers and selects permit limits based on the key's tier. Premium keys get higher limits than standard keys, which get higher limits than anonymous requests. The partition key is the API key itself, ensuring each key has its own permit pool.

Custom policies enable sophisticated scenarios like tiered service levels, dynamic limits based on user roles or subscriptions, or composite partition keys that combine multiple request attributes.

## Handling 429 Responses

When rate limits are exceeded, the middleware returns HTTP 429 Too Many Requests. Clients should respect this status and implement backoff strategies rather than retrying immediately.

The middleware can include a Retry-After header that tells clients when to retry. The value depends on the algorithm. Fixed window limiters return when the current window expires. Token bucket limiters return when enough tokens will be available for the request.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = retryAfter.TotalSeconds.ToString();
        }

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error = "Rate limit exceeded",
            retryAfter = retryAfter?.TotalSeconds
        }, cancellationToken: token);
    };
});
```

The OnRejected callback provides an opportunity to customize the response. You might log rate limit violations, include additional context in the response body, or adjust retry hints based on request context.

Clients should implement exponential backoff when receiving 429 responses. Rather than retrying immediately or even respecting Retry-After exactly, clients should add jitter to avoid thundering herd problems where many clients retry simultaneously when the limit resets.

## CORS Middleware

Cross-Origin Resource Sharing controls which browser-based applications can call your API. Without CORS policies, browsers block JavaScript from making requests to APIs hosted on different domains than the page that loaded the script.

CORS addresses a security model enforced by web browsers. When a page at https://example.com attempts to fetch data from https://api.example.com, the browser performs a CORS check. If the API does not explicitly allow requests from example.com, the browser blocks the request before it reaches your API.

ASP.NET Core's CORS middleware adds appropriate headers to responses, allowing browsers to permit cross-origin requests according to your policies.

### Configuring CORS Policies

CORS policies define which origins can access your API, which HTTP methods are allowed, which headers can be included, and whether credentials like cookies can be sent.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", builder =>
    {
        builder.WithOrigins("https://example.com", "https://app.example.com")
               .WithMethods("GET", "POST")
               .WithHeaders("Authorization", "Content-Type")
               .AllowCredentials();
    });

    options.AddPolicy("AllowAnyOrigin", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors();
```

The WithOrigins method specifies exact origin URLs. Origins include the scheme, host, and port. https://example.com and http://example.com are different origins. The AllowAnyOrigin method permits requests from any origin, which suits public APIs but sacrifices security for convenience.

WithMethods restricts which HTTP verbs are allowed. AllowAnyMethod permits all verbs including GET, POST, PUT, DELETE, and others. WithHeaders specifies which request headers are allowed beyond simple headers. AllowAnyHeader permits any header.

AllowCredentials indicates that requests can include credentials like cookies or authorization headers. This method cannot be combined with AllowAnyOrigin because allowing credentials from any origin creates security risks. If you need credentials, you must specify explicit origins.

### CORS with Preflight Requests

Complex requests trigger preflight checks where the browser sends an OPTIONS request before the actual request. The preflight asks the server whether the actual request is allowed. The server responds with CORS headers indicating which origins, methods, and headers are permitted.

Requests that include custom headers, use methods other than GET or POST, or send Content-Type headers other than application/x-www-form-urlencoded, multipart/form-data, or text/plain require preflight.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("PreflightPolicy", builder =>
    {
        builder.WithOrigins("https://example.com")
               .WithMethods("GET", "POST", "PUT", "DELETE")
               .WithHeaders("Authorization", "Content-Type", "X-Custom-Header")
               .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});
```

SetPreflightMaxAge tells browsers how long they can cache preflight results. Within that duration, browsers skip the preflight for subsequent matching requests. This reduces latency and server load for repeated requests from the same origin.

### Applying CORS to Endpoints

Apply CORS policies globally to all endpoints or selectively per endpoint. Global application uses middleware without parameters, and endpoint-specific application uses RequireCors on minimal APIs or EnableCors attribute on controllers.

```csharp
app.UseCors("AllowSpecificOrigin");

app.MapGet("/public-data", () => Results.Ok("Available to all"))
    .RequireCors("AllowAnyOrigin");

app.MapPost("/sensitive-operation", () => Results.Ok("Restricted"))
    .RequireCors("AllowSpecificOrigin");
```

Global CORS policies apply unless an endpoint overrides them. Endpoints that specify RequireCors use that policy instead of the global policy. This allows public endpoints to relax restrictions while sensitive endpoints enforce strict origin checks.

For controllers, apply EnableCors at the controller or action level.

```csharp
[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowSpecificOrigin")]
public class SecureController : ControllerBase
{
    [HttpGet("public")]
    [EnableCors("AllowAnyOrigin")]
    public IActionResult GetPublicData() => Ok("Public");

    [HttpPost("protected")]
    public IActionResult PostProtectedData() => Ok("Protected");
}
```

The controller-level attribute provides a default, and action-level attributes override it. This mirrors how rate limiting attributes work.

### CORS and Credentials

When allowing credentials, the origin must be explicit. Browsers reject responses that set Access-Control-Allow-Origin to * while also setting Access-Control-Allow-Credentials to true.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("CredentialPolicy", builder =>
    {
        builder.WithOrigins("https://app.example.com")
               .AllowCredentials()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});
```

Requests that include credentials send cookies, HTTP authentication, or client-side SSL certificates. APIs that rely on cookie-based authentication or require authorization headers must allow credentials and specify exact origins.

## Resilience with Polly

Transient failures are inevitable when calling external services. Network issues, temporary service outages, and rate limits on downstream APIs all cause requests to fail intermittently. Resilience patterns handle these failures gracefully without propagating errors to clients.

Polly is a .NET library that provides resilience and transient fault handling through policies like retry, circuit breaker, timeout, and bulkhead. ASP.NET Core integrates Polly through Microsoft.Extensions.Http.Resilience, which adds resilience pipelines to HttpClient instances.

### Retry Pattern

Retry policies attempt failed requests again after a delay. This handles transient failures that resolve quickly, such as momentary network blips or services recovering from brief overload.

```csharp
builder.Services.AddHttpClient("RetryClient")
    .AddResilienceHandler("retry-pipeline", builder =>
    {
        builder.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            Delay = TimeSpan.FromSeconds(1),
            BackoffType = DelayBackoffType.Exponential,
            UseJitter = true
        });
    });
```

This configuration retries up to 3 times with exponential backoff starting at 1 second. Exponential backoff means each retry waits longer than the previous one, typically doubling the delay. Jitter adds randomness to delays, preventing many clients from retrying simultaneously after a failure.

Retries work well for idempotent operations that can be safely repeated without side effects. GET requests are naturally idempotent. POST, PUT, and DELETE requests require careful design to ensure retries don't create duplicate resources or apply changes multiple times.

### Circuit Breaker Pattern

Circuit breakers prevent cascading failures by stopping requests to failing services. When a service fails repeatedly, the circuit breaker opens, rejecting requests immediately without attempting the call. After a timeout, the circuit breaker allows a test request through. If it succeeds, the circuit closes and normal operation resumes.

```csharp
builder.Services.AddHttpClient("CircuitBreakerClient")
    .AddResilienceHandler("circuit-breaker-pipeline", builder =>
    {
        builder.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
        {
            FailureRatio = 0.5,
            SamplingDuration = TimeSpan.FromSeconds(30),
            MinimumThroughput = 10,
            BreakDuration = TimeSpan.FromSeconds(30)
        });
    });
```

The circuit breaker opens when the failure ratio exceeds 0.5 during the sampling duration. At least 10 requests must occur within the sampling window before the circuit can open, which prevents opening due to a single failure. Once open, the circuit remains open for the break duration before transitioning to half-open and allowing test requests.

Circuit breakers protect downstream services from being overwhelmed with requests when they're already struggling. They also protect your API from wasting resources on requests that will likely fail. Clients receive fast failures rather than waiting for timeouts.

### Timeout Pattern

Timeout policies limit how long a request can take before being cancelled. This prevents resources from being tied up indefinitely waiting for slow or unresponsive services.

```csharp
builder.Services.AddHttpClient("TimeoutClient")
    .AddResilienceHandler("timeout-pipeline", builder =>
    {
        builder.AddTimeout(TimeSpan.FromSeconds(5));
    });
```

When a request exceeds the timeout, Polly cancels it and throws a TimeoutRejectedException. The application can catch this exception and return an appropriate error response to the client.

Timeouts complement retries by ensuring each retry attempt doesn't wait indefinitely. Without timeouts, a retry policy might wait for the full request timeout on each attempt, leading to extremely long delays before giving up.

### Bulkhead Pattern

Bulkhead policies limit the number of concurrent requests to a resource. This isolates failures by preventing one slow or failing dependency from consuming all available connections or threads.

```csharp
builder.Services.AddHttpClient("BulkheadClient")
    .AddResilienceHandler("bulkhead-pipeline", builder =>
    {
        builder.AddConcurrencyLimiter(new HttpConcurrencyLimiterStrategyOptions
        {
            PermitLimit = 10,
            QueueLimit = 5
        });
    });
```

This configuration allows 10 concurrent requests. Additional requests queue up to a limit of 5. When both the active and queue limits are reached, new requests are rejected immediately.

Bulkheads prevent resource exhaustion. If a downstream service becomes slow, the bulkhead prevents all connections from being tied up waiting for that service, leaving capacity for other operations.

### Combining Resilience Strategies

Real-world scenarios often require multiple strategies working together. A comprehensive resilience pipeline might include timeout, retry, and circuit breaker policies.

```csharp
builder.Services.AddHttpClient("ResilientClient")
    .AddResilienceHandler("comprehensive-pipeline", builder =>
    {
        builder
            .AddTimeout(TimeSpan.FromSeconds(5))
            .AddRetry(new HttpRetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromSeconds(1),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true
            })
            .AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
            {
                FailureRatio = 0.5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                MinimumThroughput = 10,
                BreakDuration = TimeSpan.FromSeconds(30)
            });
    });
```

The order matters. Timeout applies to each individual request attempt. Retry wraps the timeout, so each retry attempt gets the full timeout duration. Circuit breaker wraps the retry policy, tracking failures across all retry attempts. If retries continue failing, the circuit breaker eventually opens and short-circuits future requests.

## Standard Resilience Pipeline

Microsoft.Extensions.Http.Resilience provides a standard resilience pipeline that combines multiple strategies with sensible defaults. This pipeline suits most scenarios without requiring detailed configuration.

```csharp
builder.Services.AddHttpClient("StandardResilientClient")
    .AddStandardResilienceHandler();
```

The standard pipeline includes rate limiting to prevent overwhelming dependencies, total request timeout covering all retry attempts, retry with exponential backoff, circuit breaker to prevent cascading failures, and attempt timeout for individual requests.

You can customize the standard pipeline by providing options.

```csharp
builder.Services.AddHttpClient("CustomStandardClient")
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 5;
        options.Retry.Delay = TimeSpan.FromMilliseconds(500);
        options.CircuitBreaker.FailureRatio = 0.3;
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(60);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(30);
    });
```

The standard pipeline provides a quick path to robust resilience without requiring deep understanding of each strategy. Start with the standard pipeline and customize only when specific requirements demand it.

## Hedging Strategy

Hedging sends multiple requests for the same operation and uses the first successful response. This reduces tail latency by not waiting for slow instances to respond.

```csharp
builder.Services.AddHttpClient("HedgingClient")
    .AddStandardHedgingHandler();
```

When a request takes longer than the hedge delay, the pipeline sends another request. If the first request completes successfully before the second finishes, the second is cancelled. If the first fails, the second continues. This provides the latency benefits of speculative execution without doubling resource consumption in the common case.

Hedging works best for read operations against replicated data where multiple instances can serve the same request. It assumes the downstream service can handle the increased load from concurrent requests. Use hedging when latency variance is high and reducing worst-case latency justifies the extra resource cost.

## Request Abort Handling

ASP.NET Core APIs should respect cancellation tokens to release resources when clients disconnect or requests are aborted. Long-running operations must check cancellation tokens periodically and stop processing when cancellation is requested.

```csharp
app.MapGet("/long-operation", async (CancellationToken cancellationToken) =>
{
    for (int i = 0; i < 100; i++)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await Task.Delay(100, cancellationToken);
    }

    return Results.Ok("Completed");
});
```

When a client cancels the request, ASP.NET Core signals the cancellation token. Operations that check the token can stop immediately rather than wasting resources on work that will never be returned to the client.

HttpClient respects cancellation tokens when passed to request methods. If the API cancels an outbound request, HttpClient stops waiting for the response and releases the connection.

```csharp
app.MapGet("/proxy-operation", async (HttpClient client, CancellationToken cancellationToken) =>
{
    var response = await client.GetAsync("https://api.example.com/data", cancellationToken);
    return Results.Ok(await response.Content.ReadAsStringAsync(cancellationToken));
});
```

Cancellation tokens chain through async operations. When the client cancels the inbound request to your API, the cancellation token passed to HttpClient causes the outbound request to be cancelled as well. This propagates cancellation through the entire call chain, ensuring no resources are wasted on abandoned work.

## Red Flags

**Applying rate limits without partition keys**: Limiting the entire API to a fixed number of requests allows a single client to exhaust capacity for everyone. Always partition by user, IP address, API key, or another client identifier.

**Using AllowAnyOrigin with AllowCredentials**: Browsers reject this combination because it's unsafe. If credentials are needed, specify exact origins.

**Retrying non-idempotent operations without safeguards**: Retrying POST requests that create resources can lead to duplicates. Implement idempotency keys or make operations idempotent by design.

**Opening circuit breakers too aggressively**: A failure ratio that's too low or a minimum throughput that's too high can cause circuits to open during normal transient failures. Tune these values based on observed failure patterns.

**Ignoring cancellation tokens in long-running operations**: Operations that don't check cancellation waste resources processing results that will never be used. Always respect cancellation tokens in async methods.

**Placing UseCors after UseAuthorization**: CORS middleware must run before authorization so preflight requests, which don't include authorization headers, can succeed. The correct order is UseRouting, UseCors, UseAuthentication, UseAuthorization.

**Setting timeouts longer than client expectations**: If clients have a 5-second timeout but your retry policy tries for 30 seconds, the client will have already given up. Align timeout policies with client expectations.

**Forgetting to add retry jitter**: Without jitter, many clients retry simultaneously when a failure resolves, creating a thundering herd that can overwhelm the recovering service. Always enable jitter on retry policies.
