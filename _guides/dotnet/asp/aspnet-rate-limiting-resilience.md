---
title: "Rate Limiting and Request Timeouts"
layout: guide
category: "ASP.NET Core"
subcategory: "Security & Resilience"
description: "Protecting an ASP.NET Core API from overload: the rate limiting middleware and its four algorithms, partitioning by client, global and per-endpoint policies, chained limiters, 429 responses and Retry-After, limits across multiple instances, the request timeouts middleware, and honoring request cancellation."
tags: [practical, rate-limiting, request-timeouts, cancellation, partitioning]
---

An API has to protect itself from more work than it can do, whether the excess comes from one misbehaving client, an attacker, or plain popularity. ASP.NET Core gives it three tools for inbound traffic. The rate limiting middleware caps how many requests each client may make, the request timeouts middleware caps how long a request may run, and request cancellation stops work nobody is waiting for any more. Resilience for the API's own outbound calls, such as retries, circuit breakers, and hedging for `HttpClient` through `Microsoft.Extensions.Http.Resilience`, is a separate topic that belongs with `HttpClient`.

## The Rate Limiting Middleware

`Microsoft.AspNetCore.RateLimiting`, built in since .NET 7, checks each request against limiters and rejects the ones over the limit. A request has to acquire a *permit* from a limiter to proceed. Acquiring one returns a *lease*, which carries whether it succeeded, and a concurrency limiter gets the permit back when the lease is disposed at the end of the request. Setting it up takes services, the middleware, and policies attached to endpoints. The samples use the `System.Threading.RateLimiting` and `Microsoft.AspNetCore.RateLimiting` namespaces, which aren't implicit usings:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("fixed", limiter =>
    {
        limiter.PermitLimit = 100;
        limiter.Window = TimeSpan.FromMinutes(1);
    });
});

var app = builder.Build();

app.UseRateLimiter();   // after UseRouting when endpoint policies are used

app.MapGet("/orders", ListOrders).RequireRateLimiting("fixed");
```

Three details in that sample catch most first attempts.

- **The default rejection status is 503.** `RejectionStatusCode` defaults to `503 Service Unavailable`, which tells clients and monitoring that the server is down rather than that the client is going too fast. Setting it to `429 Too Many Requests` is almost always right.
- **`AddFixedWindowLimiter` creates one shared limiter.** The `Add...Limiter` helpers build a single limiter per policy, shared by every caller, so the sample allows 100 requests per minute to all clients together, not to each. Per-client limits need partitioning, covered below.
- **The middleware runs after routing.** Endpoint policies are endpoint metadata, so the middleware has to run after routing has chosen the endpoint. `WebApplication` routes before the app's own middleware, so calling `UseRateLimiter` in the usual place works. An app that calls `UseRouting` explicitly must call `UseRateLimiter` after it.

The limiters are in memory, so each instance of the app counts separately. Three instances behind a load balancer let a client make three times the configured rate, split unevenly depending on routing. A limit that must hold across instances has to be enforced where all traffic passes, such as an API gateway, or through a custom or third-party `RateLimiter` backed by a shared store such as Redis, since ASP.NET Core doesn't include one. The containment runs instance, then policy, then partition: each instance has its own copy of each policy, and each policy keeps a counter per partition key.

Rate limiting also isn't DDoS protection. A distributed attack comes from too many sources to partition, and it has to be absorbed before it reaches the app, by the hosting platform, a web application firewall, or a CDN.

## Algorithms

The middleware offers four limiters. Three count requests over time, and one counts requests in flight. The three time-based ones treat the same burst very differently, shown here with matching limits of 100 requests per minute rather than the values in the samples below.

{% include figure.html id="asp-rate-limiter-burst" %}

### Fixed Window

A fixed window allows `PermitLimit` requests per `Window`, then resets. It is the simplest to reason about, with one known weakness: a client can use its whole allowance at the end of one window and again at the start of the next, briefly sending twice the intended rate.

### Sliding Window

A sliding window splits each window into `SegmentsPerWindow` segments. Permits used in a segment come back when that segment falls out of the window, one segment at a time, rather than all at once at a boundary. With a 30-second window and three segments, permits return every 10 seconds, which spreads out the boundary burst at the cost of tracking each segment.

```csharp
options.AddSlidingWindowLimiter("sliding", limiter =>
{
    limiter.PermitLimit = 100;
    limiter.Window = TimeSpan.FromSeconds(30);
    limiter.SegmentsPerWindow = 3;
});
```

### Token Bucket

A token bucket holds up to `TokenLimit` tokens, each request spends one, and `TokensPerPeriod` tokens are added every `ReplenishmentPeriod`. A full bucket allows a burst up to the limit, and after that the refill rate sets the sustained rate:

```csharp
options.AddTokenBucketLimiter("bursty", limiter =>
{
    limiter.TokenLimit = 20;                          // burst of up to 20
    limiter.TokensPerPeriod = 5;                      // then 5 per second sustained
    limiter.ReplenishmentPeriod = TimeSpan.FromSeconds(1);
});
```

It suits clients that are idle most of the time and then need a handful of requests at once, such as a page load that fires several calls together.

### Concurrency

A concurrency limiter caps how many requests are in progress at once, with no time period at all. A permit comes back when a request finishes. It protects a resource with fixed capacity, such as an expensive report generator or a downstream system that can handle only a few calls at a time, and it doesn't cap how many requests a client makes per minute.

## Queuing

Every limiter can queue requests over the limit instead of rejecting them. `QueueLimit` sets how many may wait, and `QueueProcessingOrder` decides what happens when the queue is full. With `OldestFirst`, the new request is rejected. With `NewestFirst`, the oldest waiting requests are evicted and fail, and the new one takes their place. A queued request also leaves the queue if its client disconnects. Queuing smooths short bursts, but each waiting request holds a connection, and the client sees latency rather than an error, so queues stay short.

## Partitioning

A limiter without partitions shares one allowance among every caller, so one busy client uses up the capacity for all of them. A *partitioned* limiter keeps a separate counter per key, such as a user, an API key, or a client IP:

```csharp
options.AddPolicy("per-caller", context =>
{
    var key = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
              ?? context.Connection.RemoteIpAddress?.ToString()
              ?? "unknown";

    // The factory runs once per new key, and the limiter it creates is cached for that key
    return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
    {
        TokenLimit = 50,
        TokensPerPeriod = 10,
        ReplenishmentPeriod = TimeSpan.FromSeconds(1)
    });
});
```

The key has to identify the client, and choosing it is where most rate limiting mistakes happen.

- **Authenticated identity is the best key.** A user ID or an API key's client ID can't be changed by the caller without new credentials. The limiter has to run after authentication, or `User` is empty and every caller falls through to the next key. `WebApplication` inserts authentication ahead of the app's own middleware only when the app doesn't call `UseAuthentication` itself. An app that does, for example to place it after CORS, must call `UseRateLimiter` after it.
- **The client IP is a fallback for anonymous traffic, with caveats.** Behind a reverse proxy, `RemoteIpAddress` is the proxy's address until the forwarded headers middleware, trusting only that proxy, replaces it. Otherwise every caller shares one partition. Many users behind one corporate NAT also share an IP, and Microsoft's docs warn that partitioning by IP invites denial of service through spoofed source addresses.
- **Never key on something the caller chooses freely.** The `Host` header, a user agent, or an arbitrary header value can be changed on every request, which gives an attacker a fresh allowance each time. Each new key also creates and caches a new limiter, so unbounded caller-controlled keys can exhaust memory.

A raw API key read from a header has the same problem until it's validated. Keying on the key before authentication lets a caller invent keys to get new partitions, so tiered limits by key read the client identity that the authentication handler established.

## Global Limiters and Named Policies

Limits come from two places, and both can apply to one request.

- **The global limiter**, set as `options.GlobalLimiter`, runs on every request. It is the safety net that applies even to endpoints nobody remembered to protect.
- **Named policies**, added with `AddPolicy` or the `Add...Limiter` helpers, apply to the endpoints that name them, through `RequireRateLimiting(...)` on endpoints and route groups or `[EnableRateLimiting(...)]` on controllers and actions.

When an endpoint has a policy, the request must get a permit from the global limiter and from the policy. An action's `[EnableRateLimiting]` replaces its controller's, but a policy applied with `RequireRateLimiting` on the route mapping, such as `MapControllers().RequireRateLimiting(...)`, takes precedence over the attributes. `[DisableRateLimiting]` or `.DisableRateLimiting()` exempts an endpoint from every limiter, the global one included, which suits health probes that must never be throttled.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Everyone: 300 requests per minute per caller
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1) }));

    // Expensive endpoints, which require sign-in: at most 2 at a time per user, on top of the global limit
    options.AddPolicy("reports", context =>
        RateLimitPartition.GetConcurrencyLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
            _ => new ConcurrencyLimiterOptions { PermitLimit = 2 }));
});

app.MapPost("/reports", GenerateReport).RequireRateLimiting("reports");
app.MapHealthChecks("/healthz").DisableRateLimiting();
```

`PartitionedRateLimiter.CreateChained` combines several global limiters, such as a per-second burst limit and a per-hour quota, so a request needs a permit from each. Inside a named policy, `RateLimiter.CreateChained`, new in .NET 10, does the same for one endpoint's partition. When a later limiter in a chain rejects a request, time-based limiters earlier in the chain don't give back the permit they already granted, so the order of the chain decides which allowances a rejected request still uses up.

A custom policy class implementing `IRateLimiterPolicy<TPartitionKey>` does the same job as the `AddPolicy` delegate, with constructor injection for services it needs, such as a subscription-tier lookup, and its own `OnRejected` callback.

## Rejected Requests

A rejected request gets the configured status code and an empty body unless an `OnRejected` callback writes more. The middleware doesn't add a `Retry-After` header on its own. The fixed window and token bucket limiters attach an estimate of when to retry to a failed lease, as `RetryAfter` metadata, and the callback copies it into the header. The estimate is a whole window or replenishment period, not the exact time left:

```csharp
options.OnRejected = async (context, ct) =>
{
    var response = context.HttpContext.Response;
    response.StatusCode = StatusCodes.Status429TooManyRequests;

    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
    {
        response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds))
            .ToString(NumberFormatInfo.InvariantInfo);
    }

    await Results.Problem(
        statusCode: StatusCodes.Status429TooManyRequests,
        title: "Too many requests").ExecuteAsync(context.HttpContext);
};
```

`Retry-After` takes whole seconds, which is why the sample rounds up and formats with the invariant culture. The sliding window limiter provides no `RetryAfter`, and neither does a concurrency limiter, which can't predict when an in-flight request will finish, so the callback has to handle its absence. Clients that receive a 429 should wait at least as long as `Retry-After` says and add random jitter, so that the clients rejected together don't all retry at the same instant.

The middleware also publishes metrics under the `Microsoft.AspNetCore.RateLimiting` meter, including leases acquired, rejected, and queued, which is how to tell whether limits are protecting the app or just rejecting normal traffic. Limits need load testing before release for the same reason.

## Request Timeouts

Kestrel doesn't limit how long an app spends on a request, because the right limit differs so much between endpoints: a WebSocket may stay open for hours while a lookup should finish in milliseconds. The request timeouts middleware, added in .NET 8, sets per-endpoint and default limits:

```csharp
builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(10) };
    options.AddPolicy("reports", TimeSpan.FromSeconds(60));
});

app.UseRequestTimeouts();   // after UseRouting when it's called explicitly

app.MapGet("/orders/{id:int}", GetOrder);                                   // default: 10 s
app.MapPost("/reports", GenerateReport).WithRequestTimeout("reports");      // 60 s
app.MapGet("/events", StreamEvents).DisableRequestTimeout();                // long-lived
```

A timeout doesn't stop the request. It cancels `HttpContext.RequestAborted`, and the handler stops only if it passes that token to the work it does. If the handler lets the resulting `OperationCanceledException` escape without writing a response, the middleware returns `504 Gateway Timeout`, or the policy's `TimeoutStatusCode`. A handler that ignores the token keeps running to completion. Timeouts also don't fire while a debugger is attached, so they have to be tested without one.

`[RequestTimeout]` does the same for controllers, and `[DisableRequestTimeout]` exempts an action. Timeouts complement concurrency limits. A concurrency limiter caps how many expensive requests run at once, and a timeout, if the handler honors the token, caps how long each one holds its permit. A timeout that has started can also be cancelled from inside the request, through `IHttpRequestTimeoutFeature.DisableTimeout()`, for example when an endpoint switches to streaming.

## Honoring Cancellation

Every request has a cancellation token, `HttpContext.RequestAborted`, which fires when the client disconnects or a request timeout expires. A handler receives it by taking a `CancellationToken` parameter, in both minimal APIs and controller actions, and passes it to everything asynchronous it does:

```csharp
app.MapGet("/orders/{id:int}/summary", async (
    int id, AppDbContext db, HttpClient pricing, CancellationToken ct) =>
{
    var order = await db.Orders.FindAsync([id], ct);
    if (order is null) return Results.NotFound();

    var quote = await pricing.GetFromJsonAsync<Quote>($"/quotes/{order.QuoteId}", ct);   // BaseAddress set at registration
    return Results.Ok(new OrderSummary(order, quote));
});
```

Passing the token means an abandoned request stops its database query and its outbound HTTP call, releasing their connections, instead of finishing work whose result has nowhere to go. That matters most under load, when clients time out and retry, since without cancellation each retry adds new work while the abandoned requests keep running.

Reads are safe to cancel at any point. Writes need more thought, because a disconnect halfway through a sequence of changes, or an outbound payment call, can leave a partial side effect. A write that must finish once started either runs in a transaction that cancellation rolls back cleanly, or deliberately passes `CancellationToken.None` to the steps that must complete.

Cancellation arrives as an `OperationCanceledException` (or `TaskCanceledException`) thrown from the awaited call, and a handler doesn't need to catch it. Since .NET 8, the exception handler middleware recognizes an exception thrown while `RequestAborted` is cancelled, skips the app's exception handlers, logs it at Debug level rather than as an error, and sets status 499 if the response hasn't started. The exception handler therefore belongs outside `UseRequestTimeouts` in the pipeline, so that the timeout middleware handles the cancellation and writes its 504. With the order reversed, the exception handler catches it first and answers 499.

## Key Takeaways

- Set `RejectionStatusCode` to 429, since the default is 503, and call `UseRateLimiter` after routing when endpoint policies are used.
- Partition by authenticated identity where possible. IP addresses need the forwarded headers middleware behind a proxy, and headers the caller chooses freely, such as `Host`, are never partition keys.
- The global limiter and an endpoint's policy both apply. `DisableRateLimiting` exempts an endpoint from both.
- Limits are per instance, so a cluster-wide limit belongs at a gateway or in a shared store. Rate limiting isn't DDoS protection.
- `Retry-After` comes from the lease metadata in an `OnRejected` callback, and only the fixed window and token bucket limiters provide it.
- Request timeouts cancel `RequestAborted` and return 504 only if the handler observes the token.
- Take a `CancellationToken` in every handler and pass it to reads and outbound calls, so abandoned requests stop their work. Writes that must complete need a transaction or `CancellationToken.None`.
