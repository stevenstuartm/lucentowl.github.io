---
title: "Middleware Pipeline"
layout: guide
category: "ASP.NET Core"
subcategory: "ASP.NET Fundamentals"
description: "Understanding the ASP.NET Core middleware pipeline, request delegates, middleware ordering, custom middleware patterns, and exception handling strategies."
tags: [asp-net-core, middleware, request-pipeline, exception-handling, dependency-injection, filters, security]
---

## The Heart of Request Processing

ASP.NET Core applications are built around a middleware pipeline. Each HTTP request flows through a sequence of middleware components, and each can examine or modify the request, perform side effects like logging, or short-circuit the pipeline entirely. Understanding how middleware works, when to use it versus filters, and how to implement custom middleware safely is critical for building robust APIs.

## Request Delegates and Pipeline Construction

The middleware pipeline is built using request delegates. These are functions that handle an HTTP request, and they are configured using three extension methods on the application builder.

### Use: Chaining Middleware

The `Use` method adds middleware that can perform work before and after the next component in the pipeline. Each middleware receives a `next` delegate representing the subsequent component. Calling `next` passes control forward; not calling it short-circuits the pipeline.

```csharp
app.Use(async (context, next) =>
{
    // Work before next middleware
    await next(context);
    // Work after next middleware
});
```

This pattern allows middleware to wrap later components. You might log the request before calling `next`, then log the response after `next` returns. The same instance handles both the inbound and outbound phases.

### Run: Terminal Middleware

The `Run` method adds terminal middleware that does not receive a `next` delegate. Any middleware added after a `Run` delegate is unreachable because `Run` ends the pipeline.

```csharp
app.Run(async context =>
{
    await context.Response.WriteAsync("Pipeline ends here.");
});
```

Use `Run` when you want to guarantee that no further middleware executes. Static file handlers or health check endpoints sometimes use this pattern when they know they handle the request completely.

### Map: Path-Based Branching

The `Map` method creates a branch in the pipeline based on the request path. If the request path starts with the specified segment, the branch executes; otherwise, the request continues down the main pipeline.

```csharp
app.Map("/api", apiApp =>
{
    apiApp.UseMiddleware<ApiKeyAuthenticationMiddleware>();
    apiApp.MapControllers();
});
```

Map branches are terminal. If the path matches, the main pipeline below the `Map` call is skipped. This allows you to configure different middleware stacks for different parts of your application.

### MapWhen: Conditional Branching

The `MapWhen` method branches the pipeline based on any predicate. You provide a function that inspects the `HttpContext` and returns true or false.

```csharp
app.MapWhen(context => context.Request.Headers.UserAgent.ToString().Contains("Mobile"),
    mobileApp =>
    {
        mobileApp.UseMiddleware<MobileOptimizedMiddleware>();
        mobileApp.MapControllers();
    });
```

Like `Map`, the `MapWhen` branch is terminal. If the predicate is true, the main pipeline is skipped. Use `MapWhen` when branching logic depends on headers, query strings, or other request properties rather than just the path.

### UseWhen: Rejoining Branches

While `Map` and `MapWhen` create terminal branches, `UseWhen` branches the pipeline conditionally and then rejoins the main pipeline if the branch does not contain terminal middleware.

```csharp
app.UseWhen(context => context.Request.Path.StartsWithSegments("/admin"),
    adminApp =>
    {
        adminApp.UseMiddleware<AdminLoggingMiddleware>();
    });
```

If the condition is met, the branch executes, but control returns to the main pipeline afterward. This is useful for adding extra middleware to specific paths without completely isolating them.

## Middleware Ordering

The order in which middleware is registered matters because each component has access to the request and response as they flow through the pipeline. Middleware executes in registration order for inbound requests and reverse order for outbound responses.

### Standard Middleware Order

ASP.NET Core has an established middleware order that aligns with how the framework expects requests to be processed. Deviating from this order causes failures, often subtle ones that only appear under specific conditions.

The recommended order is:

1. Exception handling and diagnostics
2. HTTPS redirection
3. Static files
4. Routing
5. CORS
6. Authentication
7. Authorization
8. Custom middleware
9. Endpoint execution

This sequence ensures that exception handlers catch all failures, HTTPS redirection happens before expensive processing, static files bypass unnecessary middleware, and authentication runs before authorization.

### Why Authentication Before Authorization

Authorization depends on identity. The authorization middleware checks whether the authenticated user has permission to access the requested resource. If `UseAuthorization` runs before `UseAuthentication`, the `HttpContext.User` property is empty, and authorization fails because the user has not been identified yet.

```csharp
app.UseAuthentication(); // Identifies the user
app.UseAuthorization();  // Checks permissions
```

Reversing this order means authorization decisions happen without knowing who the user is. The result is that all requests appear unauthenticated, and protected endpoints reject every request.

### Why CORS Before Authentication

CORS is a preflight check that determines whether the browser should allow a cross-origin request. If you place authentication or authorization before CORS, the browser receives a 401 or 403 response to the preflight OPTIONS request, and the CORS check fails. The browser blocks the actual request before it even sends credentials.

```csharp
app.UseCors(); // Handles preflight
app.UseAuthentication();
app.UseAuthorization();
```

This order allows the CORS middleware to respond to preflight requests without requiring authentication, which is how the standard expects it to work.

### Why Routing Before Authentication

The routing middleware (`UseRouting`) determines which endpoint will handle the request. Authentication and authorization middleware use this routing information to apply policies specific to the selected endpoint. If you reverse this order, the authentication and authorization middleware do not know which endpoint is being accessed, and endpoint-specific policies do not apply.

```csharp
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

The endpoint selection happens between `UseRouting` and `MapControllers`. Authentication and authorization run in the middle, with knowledge of which endpoint was matched.

## Writing Custom Middleware

There are two main approaches to writing custom middleware: convention-based middleware and factory-based middleware using the `IMiddleware` interface. Both are production-ready; the choice depends on your dependency injection requirements.

### Convention-Based Middleware

Convention-based middleware is the standard pattern. The middleware class requires a constructor that accepts a `RequestDelegate` and an `InvokeAsync` method with an `HttpContext` parameter.

```csharp
public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;

    public RequestTimingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        await _next(context);
        stopwatch.Stop();

        context.Response.Headers["X-Response-Time-Ms"] = stopwatch.ElapsedMilliseconds.ToString();
    }
}
```

Convention-based middleware instances are singletons. The framework creates one instance when the application starts and reuses it for all requests. This means you cannot inject scoped services like database contexts into the constructor; they have per-request lifetimes.

Dependencies required in `InvokeAsync` can be injected as method parameters. The framework resolves these from the request's service scope, allowing safe access to scoped dependencies.

```csharp
public async Task InvokeAsync(HttpContext context, ILogger<RequestTimingMiddleware> logger)
{
    logger.LogInformation("Request started");
    await _next(context);
}
```

Register convention-based middleware using `UseMiddleware<T>` or by creating an extension method.

```csharp
app.UseMiddleware<RequestTimingMiddleware>();
```

### Factory-Based Middleware with IMiddleware

Factory-based middleware implements the `IMiddleware` interface, which defines a single `InvokeAsync` method. Unlike convention-based middleware, factory-based middleware is activated per request, which allows scoped services to be injected into the constructor.

```csharp
public class RequestLoggingMiddleware : IMiddleware
{
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(ILogger<RequestLoggingMiddleware> logger)
    {
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        _logger.LogInformation("Handling request: {Method} {Path}",
            context.Request.Method, context.Request.Path);
        await next(context);
    }
}
```

Factory-based middleware must be registered in the dependency injection container before being added to the pipeline.

```csharp
builder.Services.AddScoped<RequestLoggingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
```

When `UseMiddleware<T>` detects that the middleware type implements `IMiddleware`, it resolves instances from the service container instead of using singleton activation. This allows per-request instantiation and scoped dependency injection.

### When to Use Each Pattern

Use convention-based middleware when dependencies are transient or singleton, and when you want slightly better performance from singleton activation. Use factory-based middleware when you need scoped dependencies like database contexts or when you want explicit control over middleware lifecycle through dependency injection.

Both patterns are valid. Teams often standardize on one approach for consistency.

## Terminal Middleware and Short-Circuiting

Short-circuiting happens when middleware does not call the `next` delegate. The request pipeline stops at that middleware, and the response flows back through the components that already executed.

### When to Short-Circuit

Short-circuit when the middleware has enough information to generate a complete response. Static file handlers short-circuit when they find the requested file because no further processing is needed. Authentication middleware short-circuits when a request fails authentication checks, returning a 401 response without reaching the application logic.

```csharp
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Api-Key"))
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsync("API key required");
        return; // Short-circuit
    }

    await next(context);
});
```

Short-circuiting avoids unnecessary work. If the request cannot be authenticated, there is no reason to execute routing, authorization, or application logic.

### Avoiding Unintended Short-Circuits

Forgetting to call `next` is a common mistake. If middleware performs some work and then exits without calling `next`, the pipeline stops. The endpoint is never reached, and the request appears to hang or return an empty response.

Always ensure that non-terminal middleware calls `next` unless you explicitly intend to short-circuit. If you see requests that do not reach your controllers, check that all middleware is calling `next`.

## Exception Handling in Middleware

Exception handling in ASP.NET Core centers around the exception handler middleware and the `IExceptionHandler` interface introduced in .NET 8. This centralizes error handling and allows you to produce consistent Problem Details responses.

### Exception Handler Middleware

The `UseExceptionHandler` middleware catches unhandled exceptions and re-executes the request pipeline in an alternate path, typically an error handling endpoint.

```csharp
app.UseExceptionHandler("/error");
```

This approach redirects errors to a dedicated error controller or endpoint that generates the response. The original exception is available via `IExceptionHandlerFeature`.

### IExceptionHandler for Centralized Handling

The `IExceptionHandler` interface provides a callback for handling exceptions in a central location. Implementations receive the `HttpContext` and `Exception` and return a boolean indicating whether the exception was handled.

```csharp
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Unhandled exception occurred");

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An error occurred",
            Detail = exception.Message
        };

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true; // Exception handled
    }
}
```

Register the exception handler in the service collection and add exception handling middleware.

```csharp
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

app.UseExceptionHandler();
```

The exception handler middleware iterates through registered handlers in order until one returns true. This allows you to register multiple handlers for different exception types, with a catch-all handler at the end.

### Problem Details and RFC 9457

Problem Details is a standardized format for HTTP API error responses defined by RFC 9457, which replaces the earlier RFC 7807. The format provides a consistent structure with fields like `type`, `title`, `status`, `detail`, and `instance`.

ASP.NET Core includes built-in support for Problem Details through the `AddProblemDetails` method. This registers services that automatically emit Problem Details responses for certain errors, and it integrates with exception handling middleware.

```csharp
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});
```

When combined with `IExceptionHandler`, you can tailor Problem Details responses for specific exceptions. Check the exception type in `TryHandleAsync` and construct an appropriate Problem Details object.

### Development vs. Production Exception Handling

In development environments, the developer exception page (`UseDeveloperExceptionPage`) provides detailed stack traces and diagnostic information. In production, this information is hidden, and the exception handler middleware returns generic error responses.

Separate the two behaviors using environment checks.

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler();
}
```

This ensures that sensitive information like stack traces does not leak to clients in production while preserving the detailed diagnostics developers need during development.

## HTTPS Redirection and HSTS

HTTPS redirection and HTTP Strict Transport Security (HSTS) are middleware components that enforce secure connections.

### HTTPS Redirection Middleware

The `UseHttpsRedirection` middleware intercepts HTTP requests and responds with a redirect to the HTTPS equivalent. This ensures that clients always communicate over an encrypted connection.

```csharp
app.UseHttpsRedirection();
```

The middleware responds with a 307 Temporary Redirect by default, though you can configure it to use 301 Permanent Redirect for production environments.

```csharp
builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status301MovedPermanently;
    options.HttpsPort = 443;
});
```

HTTPS redirection should appear early in the pipeline, before routing and authentication, so that insecure requests are upgraded before reaching sensitive middleware.

### HSTS Middleware

The `UseHsts` middleware adds the `Strict-Transport-Security` header to responses, instructing browsers to only access the site over HTTPS for a specified duration. This prevents downgrade attacks where an attacker forces the client to use HTTP.

```csharp
app.UseHsts();
```

HSTS is generally a browser-only instruction. Phone and desktop API clients do not obey the header, so HSTS is less relevant for pure APIs. However, if your API is also accessed by web browsers, HSTS provides an additional layer of security.

Configure HSTS behavior through options.

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});
```

HSTS should not be used in development because the header persists in the browser, and you cannot easily revert to HTTP. Only enable HSTS in production.

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
```

## Request and Response Logging

Logging HTTP requests and responses is common for diagnostics and auditing. ASP.NET Core provides built-in HTTP logging middleware as well as patterns for custom logging.

### Built-In HTTP Logging

Since .NET 6, ASP.NET Core includes an HTTP logging middleware that logs request and response properties like path, status code, and headers.

```csharp
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPath
        | HttpLoggingFields.RequestMethod
        | HttpLoggingFields.ResponseStatusCode;
});

app.UseHttpLogging();
```

The middleware supports filtering, redaction, and selective logging based on request properties. You can exclude sensitive headers like `Authorization` or redact query string parameters that contain tokens.

### Custom Logging Middleware

For more control, you can implement custom logging middleware. A common pattern is to log the request when it arrives and log the response when the pipeline completes.

```csharp
public class CustomLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CustomLoggingMiddleware> _logger;

    public CustomLoggingMiddleware(RequestDelegate next, ILogger<CustomLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        _logger.LogInformation("Request {Method} {Path} from {RemoteIp}",
            context.Request.Method,
            context.Request.Path,
            context.Connection.RemoteIpAddress);

        await _next(context);

        _logger.LogInformation("Response {StatusCode} for {Method} {Path}",
            context.Response.StatusCode,
            context.Request.Method,
            context.Request.Path);
    }
}
```

### Logging Request and Response Bodies

Logging bodies is more complex because the request and response streams are forward-only. Reading the body consumes the stream, and subsequent middleware or model binding receives an empty stream.

To log request bodies, you must enable buffering, which allows the body to be read multiple times.

```csharp
context.Request.EnableBuffering();

using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
var body = await reader.ReadToEndAsync();
context.Request.Body.Position = 0; // Reset for next middleware

_logger.LogInformation("Request body: {Body}", body);
```

Response bodies require capturing the original response stream and replacing it temporarily with a memory stream.

```csharp
var originalBody = context.Response.Body;
using var responseBody = new MemoryStream();
context.Response.Body = responseBody;

await _next(context);

responseBody.Seek(0, SeekOrigin.Begin);
var responseText = await new StreamReader(responseBody).ReadToEndAsync();
responseBody.Seek(0, SeekOrigin.Begin);
await responseBody.CopyToAsync(originalBody);

_logger.LogInformation("Response body: {Body}", responseText);
```

Logging bodies has performance implications and can expose sensitive data. Use it selectively, typically only in development or for specific diagnostic scenarios.

## Middleware vs. Filters

Both middleware and filters allow you to execute code during request processing, but they operate at different levels of the pipeline and serve different purposes.

### Scope and Execution

Middleware runs globally for every HTTP request, regardless of whether the request reaches an MVC controller, a Razor Page, or a minimal API endpoint. Middleware executes before the routing and endpoint selection phase.

Filters run only within the MVC pipeline, around controller actions and results. Filters have access to MVC-specific concepts like action descriptors, model binding results, and controller instances. Filters do not run for requests that do not reach MVC, such as static files or minimal API endpoints.

### When to Use Middleware

Use middleware for cross-cutting concerns that apply to all requests or that must run before MVC. Examples include authentication, CORS, request logging, and exception handling. Middleware is appropriate when the logic does not depend on MVC-specific features.

Middleware is also preferable when the same logic applies to multiple endpoint types. If your API uses both MVC controllers and minimal API endpoints, middleware ensures the logic runs for both.

### When to Use Filters

Use filters for concerns tied to MVC actions, such as model validation, action-level authorization, or result transformation. Filters have access to route data, action parameters, and model state, which middleware does not.

Filters are scoped more narrowly than middleware. You can apply filters globally, to specific controllers, or to individual actions. This granularity is useful when different endpoints need different behavior.

Filters also execute later in the pipeline, after routing and model binding. If your logic depends on knowing which action was selected or on the bound model, filters are the correct choice.

### Performance Considerations

Middleware runs before MVC and avoids MVC overhead for requests that do not reach controllers. For global concerns that do not require MVC features, middleware is faster.

Filters incur MVC overhead but benefit from the richer context MVC provides. If you need action-level granularity or access to MVC abstractions, the performance cost of filters is justified.

## Common Pitfalls

### Forgetting to Call Next

The most common middleware mistake is forgetting to call the `next` delegate. If middleware does not call `next` and does not write a response, the request hangs, and the client times out.

Always ensure middleware calls `next` unless it explicitly intends to short-circuit the pipeline and write a complete response.

### Incorrect Middleware Ordering

Middleware order is not arbitrary. Placing authorization before authentication, CORS after authentication, or routing after endpoint execution causes failures. These errors are often subtle and only appear under specific conditions, such as when a preflight request arrives or when an unauthenticated user accesses a protected resource.

Follow the standard middleware order unless you have a specific reason to deviate, and test thoroughly when you do.

### Singleton Middleware with Scoped Dependencies

Convention-based middleware instances are singletons. Injecting scoped services like database contexts into the constructor causes the scoped service to become a singleton, leading to incorrect behavior or crashes.

Inject scoped dependencies as parameters to `InvokeAsync`, not in the constructor. Alternatively, use factory-based middleware with `IMiddleware`.

### Modifying Response After It Starts

Once the response has started sending to the client, you cannot modify headers or status codes. Middleware that calls `next` and then tries to set headers will fail if `next` has already started writing the response.

If you need to modify the response after `next` executes, ensure that middleware higher in the pipeline has not yet started the response. Alternatively, use response caching or buffering techniques to delay the response until all modifications are complete.

### Excessive Middleware

Each middleware component adds overhead. Adding middleware for every small concern creates a long pipeline that slows down request processing. Consolidate related logic into fewer middleware components when possible.

## Key Takeaways

Middleware forms the backbone of ASP.NET Core request processing. The pipeline is built using request delegates configured with `Use`, `Run`, `Map`, and `MapWhen`. Middleware executes in registration order for inbound requests and reverse order for outbound responses, and the order matters critically for concerns like authentication, authorization, and CORS.

Custom middleware comes in two forms: convention-based middleware with singleton activation, and factory-based middleware using `IMiddleware` with per-request activation and scoped dependency injection. Both patterns are production-ready and offer different tradeoffs around dependency injection and performance.

Exception handling centers around the `IExceptionHandler` interface and exception handler middleware, which allows centralized error handling and consistent Problem Details responses conforming to RFC 9457. HTTPS redirection and HSTS enforce secure connections, while request and response logging middleware provides diagnostics and auditing.

Middleware applies globally to all requests; filters apply only within the MVC pipeline. Use middleware for cross-cutting concerns that must run before MVC or that apply to all endpoint types. Use filters for MVC-specific logic that requires access to route data, action parameters, or model state.
