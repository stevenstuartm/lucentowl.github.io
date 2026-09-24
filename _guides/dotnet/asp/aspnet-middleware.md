---
title: "Middleware Pipeline"
layout: guide
category: "ASP.NET Core"
subcategory: "Fundamentals"
description: "How the ASP.NET Core middleware pipeline runs a request: code before and after next, short-circuiting, branching with Map and UseWhen, the order built-in middleware must follow, writing convention-based and IMiddleware classes, centralized exception handling with IExceptionHandler and Problem Details, and when a filter fits better than middleware."
tags: [fundamentals, middleware, request-pipeline, exception-handling, problem-details, filters]
---

## How a Request Passes Through Middleware

Every request an ASP.NET Core app receives is represented by an `HttpContext`, one object holding the request, the response being built, the user, and the request's services. The request travels through the *pipeline*, a chain of middleware, and usually ends at an *endpoint*: the minimal API handler, controller action, or SignalR hub method that produces the response, together with its metadata (its route, its `[Authorize]` attributes, and so on).

A *middleware* is a component that receives the `HttpContext` and a delegate named `next` that invokes the rest of the pipeline. Everything it does before calling `next` runs on the way in, and everything after `next` returns runs on the way out, once the endpoint and every later middleware have finished. Each middleware therefore wraps everything registered after it. The first one registered is the outermost: it sees the request first and the response last.

```csharp
app.Use(async (context, next) =>
{
    // Runs on the way in, before anything later in the pipeline
    await next(context);
    // Runs on the way out, after everything later has finished
});
```

The `Use` extension method has two overloads. One gives the delegate a parameterless `Func<Task>` for `next`, and the other gives it a `RequestDelegate`, a function that takes an `HttpContext` and returns a `Task`, as above. Prefer the second, which saves two allocations per request.

### Short-Circuiting

A middleware that doesn't call `next` *short-circuits* the pipeline. Nothing registered after it runs, and the response travels back out through the middleware that already ran, which still execute their code after `next`. That is how static file middleware (`UseStaticFiles`) works: when a request matches a file on disk, it writes the file and returns without calling `next`, so routing and endpoints never see the request. Endpoint routing has its own form, `ShortCircuit()`, which runs a matched endpoint immediately and skips the middleware after routing.

{% include figure.html id="asp-middleware-nesting" %}

Short-circuiting is intentional when the middleware can write a complete response on its own:

```csharp
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Api-Key"))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return; // later middleware and the endpoint never run
    }

    await next(context);
});
```

It is a bug when it's accidental. A middleware that returns early without calling `next` and without writing anything sends back an empty `200 OK`, because 200 is the default status code. The request never reaches its endpoint, and nothing in the response says why.

### Once the Response Starts, Headers Are Fixed

Headers and the status code go to the client just before the first byte of the body. After that, `context.Response.HasStarted` is `true`, and setting a header or the status code throws an exception. Writing to the body after `next` returns can also corrupt the response, for example by writing more bytes than the `Content-Length` header announced.

This catches middleware that measures the request and reports the result in a header. By the time `next` returns, the endpoint has usually written its body, so the header can't be added any more. Register the header with `Response.OnStarting`, which runs just before the headers are sent:

```csharp
using System.Diagnostics;

public class RequestTimingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Response-Time-Ms"] =
                stopwatch.ElapsedMilliseconds.ToString();
            return Task.CompletedTask;
        });

        await next(context);
    }
}
```

The header then reports the time until the response began, not the time to send the whole body.

## Building the Pipeline: Use, Run, Map, and UseWhen

The pipeline is assembled on `WebApplication` with a few extension methods, each of which adds a request delegate.

| Method | What it adds | Continues the main pipeline? |
| --- | --- | --- |
| `Use` | Middleware that receives `next` | Yes, when it calls `next` |
| `Run` | *Terminal* middleware, which receives no `next` and always ends the pipeline | No; anything registered after it never runs |
| `Map` | A branch taken when the request path starts with a given segment | No, for requests that take the branch |
| `MapWhen` | A branch taken when a predicate on `HttpContext` returns `true` | No, for requests that take the branch |
| `UseWhen` | A branch taken when a predicate returns `true` | Yes, unless the branch contains terminal middleware |

The difference between `Map` and `UseWhen` is whether the branch rejoins the main pipeline.

{% include figure.html id="asp-middleware-branches" %}

A `UseWhen` branch adds middleware for a subset of requests and then lets them carry on to the same endpoints as everything else. That suits extra logging or a header check on one area of the app:

```csharp
app.UseWhen(
    context => context.Request.Path.StartsWithSegments("/admin"),
    admin => admin.UseMiddleware<AdminAuditMiddleware>());
```

A `Map` branch is a separate pipeline for part of the URL space, and it has to produce the response itself, typically ending in `Run`. `Map` also moves the matched segment from `Request.Path` to `Request.PathBase`, so middleware inside a `/legacy` branch sees a request for `/legacy/orders` as a request for `/orders`:

```csharp
app.Map("/legacy", legacy =>
{
    legacy.UseMiddleware<LegacyHeaderTranslationMiddleware>();
    legacy.Run(async context =>
        await context.Response.WriteAsync($"Legacy path: {context.Request.Path}"));
});
```

Branches work at the middleware level, below endpoint routing, and are rarely the right tool for sending requests to handlers. Routing to controllers, minimal API handlers, and hubs is endpoint routing's job. Endpoint routing also has route groups (`MapGroup`), which give every endpoint under a URL prefix shared metadata and filters. The names invite confusion, because `app.Map("/legacy", ...)` creates a pipeline branch while `app.MapGet("/legacy", ...)` and `app.MapGroup("/legacy")` register endpoints.

## Middleware Order

The order of `app.Use...` calls is the order middleware runs on the way in, and the reverse on the way out. `WebApplication` also places some middleware on its own when the app doesn't, including routing and, when their services are registered, authentication and authorization. Middleware the app adds lands after that automatic routing step unless the app calls `UseRouting` itself, so an explicit `UseRouting` is how to put middleware before route matching.

### The Recommended Order

For an API, the built-in middleware that the app places explicitly goes in this order:

| Order | Middleware | Why it sits there |
| --- | --- | --- |
| 1 | `UseExceptionHandler` (outside Development, which uses the developer exception page instead) and `UseHsts`, which tells browsers to use only HTTPS for the site | Outermost, so the handler catches exceptions thrown by everything after it |
| 2 | `UseStatusCodePages`, if used | Gives empty error responses a body. It has to run before static files and endpoints |
| 3 | `UseHttpsRedirection` | Redirects plain HTTP before any work is done on it |
| 4 | `UseStaticFiles`, if the app serves files | Returns files early and skips the rest of the pipeline |
| 5 | `UseRouting` | Selects the endpoint, so later middleware can read its metadata |
| 6 | `UseRateLimiter` | Rejects requests over a configured rate. It goes after routing when limits are attached to endpoints, and can go before it when only a global limiter is used |
| 7 | `UseCors` | Adds CORS headers before authentication and authorization can reject the request |
| 8 | `UseAuthentication` | Establishes `HttpContext.User` |
| 9 | `UseAuthorization` | Checks the user against the selected endpoint's requirements |
| 10 | Custom middleware | Sees the authenticated user and the selected endpoint |
| 11 | Endpoints (`MapControllers`, `MapGet`, and so on) | Execute the selected endpoint |

`MapStaticAssets`, the .NET 9 replacement for `UseStaticFiles` in most apps, serves files as endpoints rather than as middleware. Its requests therefore run the whole pipeline, including authentication, authorization, and custom middleware, where `UseStaticFiles` returns files before any of those run. An app whose browser scripts fetch static files from another origin moves `UseCors` ahead of `UseStaticFiles`, so those responses carry CORS headers too.

### Routing Before Authorization

`UseRouting` matches the request to an endpoint and attaches that endpoint to the `HttpContext`, but it doesn't run it. The endpoint runs at the end of the pipeline, inside any filters attached to it (covered at the end of this guide), and any middleware between the two points can read the selected endpoint and its metadata.

{% include figure.html id="asp-endpoint-selection" %}

```csharp
using Microsoft.AspNetCore.Authorization;

app.Use(async (context, next) =>
{
    var endpoint = context.GetEndpoint();

    // [Authorize] and RequireAuthorization add IAuthorizeData. This check doesn't
    // see the fallback policy, and doesn't account for [AllowAnonymous].
    var hasAuthorizeAttribute = endpoint?.Metadata.GetMetadata<IAuthorizeData>() is not null;
    // ...
    await next(context);
});
```

Authorization middleware depends on this. It reads the `[Authorize]` attributes, `RequireAuthorization` calls, and policies from the selected endpoint's metadata, so it has to run after routing. Placed before `UseRouting`, it has no endpoint to read and can't enforce endpoint-specific rules.

### Authentication Before Authorization

Authentication middleware reads the request's credentials, such as a bearer token or a cookie, and sets `HttpContext.User`. It doesn't reject anyone. A request with no credentials or bad ones continues down the pipeline with an anonymous user. Authorization middleware is what rejects requests. When the endpoint requires a user and there is none, it *challenges* the client, asking it to authenticate: a `401` with a `WWW-Authenticate` header for bearer tokens, or a redirect to the login page for cookies. When the user lacks permission, it *forbids* the request, typically with a `403`. Reversing the two typically means authorization sees an anonymous user on every request.

### CORS Before Authentication and Authorization

Before a browser sends certain cross-origin requests, it sends a *preflight*: an `OPTIONS` request, without credentials, asking whether the real request is allowed. CORS middleware answers it. `UseCors` goes after `UseRouting` and before `UseAuthentication` and `UseAuthorization`, so that preflights are answered without credentials and CORS headers are added to every response, including the `401` and `403` responses authorization produces. A browser blocks a cross-origin response that lacks those headers, so without them a client sees an opaque CORS error in place of the `401` its code was written to handle. Because `WebApplication` adds authentication and authorization right after routing when the app doesn't, an app that calls `UseCors` has to call `UseAuthentication` and `UseAuthorization` explicitly after it.

`UseCors` also has to come before response caching middleware, so responses served from the cache carry CORS headers too.

## Writing Middleware Classes

Inline `Use` delegates suit a few lines. Anything larger belongs in a class, exposed through a `Use{Feature}` extension method on `IApplicationBuilder` the same way the built-in middleware is. ASP.NET Core supports two kinds of middleware class, and they differ in when they are created, which decides what services they can take. A *scoped* service has one instance per request, and a *transient* one gets a new instance every time it is resolved.

### Convention-Based Middleware

A convention-based middleware class has no interface. It needs a public constructor that takes a `RequestDelegate`, and a public method named `Invoke` or `InvokeAsync` that returns `Task` and takes `HttpContext` as its first parameter.

The framework constructs the class once, when the app starts, and calls `InvokeAsync` for every request, concurrently. Two consequences follow:

- **No per-request state in fields.** One instance serves every request at the same time, so a field written during one request is visible to, and overwritten by, the others.
- **No scoped services in the constructor.** Constructor dependencies come from the root provider, the app-wide container rather than a request's scope, and live as long as the app. In Development, where scope validation is on, a scoped service such as a `DbContext` in the constructor throws at startup. In other environments it is silently captured and shared by every request.

Scoped services go on `InvokeAsync` instead, where each parameter after `HttpContext` is resolved from the current request's scope:

```csharp
public class RequestAuditMiddleware(RequestDelegate next, ILogger<RequestAuditMiddleware> logger)
{
    // OrdersDbContext is scoped, so it's injected per request here, not in the constructor
    public async Task InvokeAsync(HttpContext context, OrdersDbContext db)
    {
        await next(context);

        db.AuditEntries.Add(new AuditEntry(context.Request.Path, context.Response.StatusCode));
        await db.SaveChangesAsync();
        logger.LogDebug("Audited {Path}", context.Request.Path);
    }
}

public static class RequestAuditMiddlewareExtensions
{
    public static IApplicationBuilder UseRequestAudit(this IApplicationBuilder app)
        => app.UseMiddleware<RequestAuditMiddleware>();
}
```

`UseMiddleware<T>` can also pass extra constructor arguments that don't come from the container, such as a settings object.

### Factory-Based Middleware with IMiddleware

A class that implements `IMiddleware` is created differently. `UseMiddleware<T>` sees the interface and asks the `IMiddlewareFactory` to resolve an instance from the request's service scope on every request, so the class is registered in the container like any other service, as scoped or transient. Its constructor can take scoped services directly:

```csharp
public class RequestAuditMiddleware(OrdersDbContext db) : IMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        await next(context);

        db.AuditEntries.Add(new AuditEntry(context.Request.Path, context.Response.StatusCode));
        await db.SaveChangesAsync();
    }
}

// Program.cs
builder.Services.AddScoped<RequestAuditMiddleware>();
// ...
app.UseMiddleware<RequestAuditMiddleware>();
```

`IMiddleware` classes can't receive extra arguments through `UseMiddleware`. Passing one throws a `NotSupportedException` at runtime, so settings have to come from the container, typically through the options pattern (`IOptions<T>` bound from configuration).

### Choosing Between Them

| | Convention-based | `IMiddleware` |
| --- | --- | --- |
| Created | Once, at startup | Per request, from the request scope |
| Scoped services | As `InvokeAsync` parameters | In the constructor |
| Container registration | Not needed | Required, as scoped or transient |
| Extra `UseMiddleware` arguments | Supported | Throw `NotSupportedException` |
| Compile-time checking of the method shape | None; a wrong signature fails at startup | Enforced by the interface |

Convention-based middleware is what the built-in middleware and most libraries use, and it doesn't create an instance per request. `IMiddleware` suits teams that want constructor injection everywhere and a compiler-checked signature.

## Handling Exceptions

The exception handler middleware catches exceptions thrown anywhere after it in the pipeline. It clears the response, sets the status to `500` (or the code `StatusCodeSelector` returns, described below), and first offers the exception to every registered `IExceptionHandler` (covered below). If none of them handles it, the configured fallback produces the response:

| Fallback | What produces the response |
| --- | --- |
| `UseExceptionHandler("/error")` | The part of the pipeline after the handler runs again with the path changed to `/error`, and whatever endpoint handles that path writes the response |
| `UseExceptionHandler(errorApp => ...)` | A small pipeline the app builds for errors, typically ending in `Run` |
| `AddProblemDetails()` plus `UseExceptionHandler()` | A Problem Details body written by the framework |

Calling `UseExceptionHandler()` with no arguments needs a fallback from somewhere. Without an error path, an error pipeline, or `AddProblemDetails`, the app throws an `InvalidOperationException` at startup.

No form can help once the response has started, because the status code and headers are already sent, so the middleware rethrows and the connection is aborted. The error-path form has more constraints, because it runs part of the pipeline a second time for the same request. The handler clears the selected endpoint and changes the path, and everything registered after it runs again, so routing selects the error endpoint. Middleware registered before the handler runs once.

{% include figure.html id="asp-exception-reexecute" %}

- **Later middleware sees the request twice.** It must tolerate that, for example by not re-reading a request body it has already consumed.
- **The error endpoint has to accept every HTTP method.** If the second pass produces a `404`, the middleware throws an `InvalidOperationException` wrapping the original exception, rather than send a `404` for what was a server error. An error endpoint mapped with `MapGet` or `[HttpGet]` causes exactly that for a failed `POST`, so map it without a method restriction.
- **Scoped services carry over.** The second pass reuses the request's scoped services unless `ExceptionHandlerOptions.CreateScopeForErrors` is set, which the Blazor template does.

In Development, the developer exception page shows stack traces, headers, and endpoint metadata instead. `WebApplication` adds it automatically as the outermost middleware, so an app that registers the exception handler only outside Development keeps the page for local debugging. Registered in Development too, the handler sits inside the page and catches exceptions first. JSON APIs often do this on purpose, so that local clients get the same error bodies as production.

### Problem Details

Problem Details is the standard JSON shape for HTTP API errors, defined by RFC 9457, which replaced RFC 7807. It carries `type`, `title`, `status`, `detail`, and `instance`, and allows extension members.

`AddProblemDetails` registers `IProblemDetailsService`, the service that writes these bodies. Once it is registered, the exception handler, the developer exception page, and status code pages middleware all write Problem Details to clients whose `Accept` header allows JSON or that send none. The default writer also adds a `traceId`, the request's trace ID, which ties a client's error report to the server's logs and traces. `UseStatusCodePages` extends the same format to error responses that have no body yet, such as a `404` for an unmatched route.

`CustomizeProblemDetails` adjusts every response in one place, for example to add the name of the server instance that handled the request:

```csharp
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions["instanceName"] = Environment.MachineName);
```

### IExceptionHandler

`IExceptionHandler`, added in .NET 8, gives exception handling a class of its own with dependency injection. Each implementation's `TryHandleAsync` returns `true` if it handled the exception. The middleware calls the registered handlers in registration order until one returns `true`, so specific handlers go first and a general one last.

Handlers are registered as singletons. Like convention-based middleware, they take only singleton-safe services in their constructor, and reach request-scoped ones through `context.RequestServices`.

```csharp
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

public sealed class OrderNotFoundHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not OrderNotFoundException notFound)
        {
            return false; // let the next handler try
        }

        context.Response.StatusCode = StatusCodes.Status404NotFound;
        var written = await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Order not found",
                Detail = $"Order {notFound.OrderId} does not exist."
            }
        });

        if (!written)
        {
            // The client doesn't accept JSON. Restore the status so the fallback starts clean.
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        }

        return written;
    }
}

// Program.cs
builder.Services.AddExceptionHandler<OrderNotFoundHandler>();
builder.Services.AddProblemDetails();
// ...
app.UseExceptionHandler();
```

An exception no handler claims falls through to the default Problem Details response, a `500` with a generic title. Handlers should write only what the client may see. `exception.Message` and stack traces can reveal table names, file paths, and internal state, so they belong in logs, not responses. For the common case of mapping exception types to status codes with no other logic, `ExceptionHandlerOptions.StatusCodeSelector` (.NET 9) does it without a handler class.

Since .NET 10, when a handler returns `true`, the middleware no longer logs the exception or tags the request's metrics as an error. A handler that returns `true` has to log the exception itself if the team still wants it in the logs. Setting `ExceptionHandlerOptions.SuppressDiagnosticsCallback` to return `false` restores the .NET 8 and 9 behavior.

## Middleware or a Filter

Filters are the other place to run code around request handling. They run inside endpoint execution, wrapped around the handler, and they come in two families: MVC filters for controllers and Razor Pages, and endpoint filters for minimal APIs.

| | Middleware | MVC filters | Endpoint filters |
| --- | --- | --- | --- |
| Runs for | Every request that reaches its position, including static files and unmatched routes | Controller actions and Razor Pages only | The minimal API handlers and route groups they're attached to, and controller actions when attached through `MapControllers()` |
| Knows the selected endpoint | Only if placed after `UseRouting` | Yes | Yes |
| Sees bound arguments | No | Yes, plus `ModelState` (the validation results) | Yes, as handler arguments |
| Sees the action result before it executes | No | Yes | Yes, as the handler's return value |
| Scope | The whole pipeline, or a branch | Global, controller, or action | Endpoint or route group |

Use middleware for concerns that apply to requests as HTTP traffic, whatever handles them: exception handling, CORS, compression, request logging, and anything that must happen before routing. Use a filter when the logic depends on what the handler receives or returns, such as bound arguments, model state, or the result object, or when it should apply to specific endpoints rather than to URL patterns. An app with both controllers and minimal APIs can share argument-level logic by writing it as an endpoint filter and attaching it to the controllers too, with `app.MapControllers().AddEndpointFilter(...)`.

Exceptions follow the same split. MVC's exception filters (`IExceptionFilter`) catch exceptions from MVC action execution, including model binding and action filters, but not from result execution, middleware, or minimal APIs. Exception handling middleware sees them all, which is why it is the default for centralized handling. An exception filter earns its place only when one controller needs different handling from the rest of the app.

## Key Takeaways

- Middleware wraps the rest of the pipeline. Code before `next` runs on the way in, code after it runs on the way out, and a middleware that skips `next` short-circuits everything after it.
- Headers and the status code are sent before the first byte of the body, so set response headers with `OnStarting`, not after `next` returns.
- `UseWhen` branches rejoin the main pipeline; `Map` and `MapWhen` branches don't, and `app.Map` is a pipeline branch, not an endpoint.
- Routing selects the endpoint early and it runs at the end, so authorization goes after routing. CORS goes before authentication, and authentication before authorization. Authentication identifies the user; only authorization rejects requests.
- Convention-based middleware is created once and serves concurrent requests, so it keeps no per-request fields and takes scoped services on `InvokeAsync`. `IMiddleware` is resolved per request and can take them in its constructor.
- `IExceptionHandler` implementations are singletons, run in registration order until one handles the exception, and since .NET 10 a handled exception is no longer logged unless the handler logs it.
- Middleware handles HTTP-level concerns for every request; filters handle logic that needs the endpoint's bound arguments or result.
