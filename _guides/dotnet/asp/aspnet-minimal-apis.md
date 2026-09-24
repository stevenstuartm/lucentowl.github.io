---
title: "Minimal APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Building HTTP APIs with ASP.NET Core minimal APIs: when to choose them over controllers, how parameters bind and what happens when binding fails, Results versus TypedResults, organizing endpoints with route groups, endpoint filters, the JSON options trap, and what Native AOT requires."
tags: [practical, minimal-apis, parameter-binding, typedresults, endpoint-filters, native-aot]
---

## Minimal APIs or Controllers

A minimal API maps a handler function straight to a route, with no controller class around it:

```csharp
app.MapGet("/orders/{id:int}", (int id, IOrderStore orders) => orders.Find(id));
```

Minimal APIs and controllers both produce endpoints in the same routing system, run behind the same middleware, and can live in one app. The difference is in how handlers are written and what comes built in. Microsoft recommends minimal APIs for new projects. They have less per-request machinery, and apart from gRPC services they are the only way to build an HTTP API with Native AOT, since MVC doesn't support it.

Controllers still earn their place when an API needs something MVC provides out of the box:

| Need | Minimal APIs | Controllers |
| --- | --- | --- |
| Custom model binding (`IModelBinder`, `IModelBinderProvider`) | `TryParse` and `BindAsync` on the parameter type only | Full model binding extensibility |
| Response formats other than JSON (XML, custom formatters, content negotiation) | JSON through `System.Text.Json` only | Input and output formatters |
| Validation beyond data annotations (`IModelValidator`) | Data annotations and `IValidatableObject`, built in since .NET 10 | Full MVC validation pipeline |
| Application parts, the application model, OData | Not available | Available |
| Native AOT | Supported, with source-generated JSON | Not supported |

For an API without those needs, the choice is mostly about organization and team habit, and the performance difference rarely decides it. Request time in a typical API goes to databases and downstream calls, not to the framework.

## Handlers and Return Values

A handler can be a lambda, a local function, or a static or instance method passed as a method group. Named methods keep route registration readable and let handlers be unit tested directly:

```csharp
app.MapGet("/orders/{id:int}", GetOrder);

static async Task<Results<Ok<Order>, NotFound>> GetOrder(int id, IOrderStore orders) =>
    await orders.FindAsync(id) is { } order
        ? TypedResults.Ok(order)
        : TypedResults.NotFound();
```

What the handler returns decides the response:

| Return type | Response |
| --- | --- |
| `string` | `200` with the string as `text/plain` |
| `IResult` (from `Results` or `TypedResults`) | Whatever the result writes: status code, headers, and body |
| Any other type `T` | `200` with `T` serialized as JSON |

`Task<T>` and `ValueTask<T>` of each behave the same way.

## Parameter Binding

Every handler parameter gets its value from somewhere in the request, or from the container. For a parameter with no attribute, the framework decides the source from its type and name, in this order:

1. **Special types** bind to parts of the request: `HttpContext`, `HttpRequest`, `HttpResponse`, `ClaimsPrincipal` (the user), `CancellationToken` (cancelled if the client disconnects), `IFormFile` and other form types, `Stream` and `PipeReader` for the raw body.
2. **Types with a static `BindAsync` method** bind themselves from the `HttpContext`.
3. **Strings and types with a static `TryParse` method**, such as `int`, `Guid`, and `DateOnly`, bind from the route value of the same name if the template has one, and from the query string otherwise.
4. **Types registered in the container** are injected as services.
5. **Anything else** is read from the JSON request body, except for `GET`, `HEAD`, `OPTIONS`, and `DELETE`, which never bind a body implicitly.

`[FromRoute]`, `[FromQuery]`, `[FromHeader]`, `[FromBody]`, `[FromForm]`, and `[FromServices]` override this. Headers always need `[FromHeader]`, because a plain string parameter binds from the route or query string:

```csharp
app.MapGet("/search", (
    string term,                                         // query: ?term=...
    int page,                                            // query: ?page=...
    [FromHeader(Name = "X-Tenant")] string? tenant,      // header, optional
    ISearchService search,                               // service
    CancellationToken cancellationToken) =>
    search.RunAsync(term, page, tenant, cancellationToken));
```

A form parameter, whether `[FromForm]` or an `IFormFile`, also brings antiforgery validation with it, since forms are what cross-site request forgery attacks submit. The app has to register antiforgery (`AddAntiforgery` and `UseAntiforgery`), or the endpoint fails.

### Required, Optional, and Failed Bindings

A parameter's nullability decides whether it is required. `string term` and `int page` above are required, `string? tenant` is optional, and a parameter with a default value, such as `int page = 1`, is optional and takes the default when absent.

A request that leaves out a required value, or supplies one that doesn't parse, never reaches the handler:

| Failure | Response |
| --- | --- |
| Required value missing | `400` |
| `TryParse` returns `false`, as with `?page=two` for an `int` | `400` |
| The JSON body can't be deserialized | `400` |
| The body's `Content-Type` isn't JSON | `415` |
| `BindAsync` throws | `500` |

In production the `400` goes out with an empty body and a debug-level log entry, which makes binding failures easy to miss. In Development the framework throws a `BadHttpRequestException` instead, so the developer exception page names the parameter that failed.

### Custom Types and Grouped Parameters

A type becomes bindable from the route or query string by implementing `IParsable<T>`, or by declaring a static `TryParse` method. A type that needs more than one string, such as a paging object built from two query values and a header, declares a static `BindAsync(HttpContext, ParameterInfo)` instead.

Handlers with many parameters can group them with `[AsParameters]`, which binds each property or constructor parameter of a type as if it were a handler parameter of its own. It groups; it doesn't nest. Each member binds by the rules above, so a complex property still comes from the body.

```csharp
public record OrderQuery(int Page, int PageSize, [FromHeader(Name = "X-Tenant")] string? Tenant);

app.MapGet("/orders", ([AsParameters] OrderQuery query, IOrderStore orders) =>
    orders.List(query.Page, query.PageSize, query.Tenant));
```

## Results and TypedResults

Handlers that need a status code other than 200 return an `IResult`. Two factory classes create them. `Results.Ok(order)` and its siblings return the `IResult` interface. `TypedResults.Ok(order)` returns the concrete type, here `Ok<Order>`.

Prefer `TypedResults`, for two reasons. The concrete types describe themselves to OpenAPI generation, so an endpoint that returns `Ok<Order>` documents a `200` with an `Order` body without any extra metadata. And a unit test can check the returned type and its value directly rather than executing the result.

The cost is at the return statement. A handler that returns `TypedResults.Ok(order)` on one path and `TypedResults.NotFound()` on another returns two unrelated types, and the compiler can't infer a return type for the lambda. The handler has to declare a union with `Results<T1, T2, ...>`:

```csharp
app.MapGet("/orders/{id:int}", async Task<Results<Ok<Order>, NotFound>> (int id, IOrderStore orders) =>
    await orders.FindAsync(id) is { } order
        ? TypedResults.Ok(order)
        : TypedResults.NotFound());
```

The union also documents both responses for OpenAPI, and returning a result type that isn't listed is a compile error. `Results` doesn't have the problem because every method returns `IResult`, but the endpoint then documents nothing unless it adds `Produces` metadata by hand.

`TypedResults` covers most HTTP responses, including `Problem` and `ValidationProblem` for Problem Details bodies, file and stream results, redirects, and, since .NET 10, `ServerSentEvents`, which streams an `IAsyncEnumerable` to the client as server-sent events.

### The JSON Options Trap

Minimal APIs and controllers read JSON settings from two different options types. `builder.Services.ConfigureHttpJsonOptions(...)` configures minimal APIs, and `builder.Services.AddControllers().AddJsonOptions(...)` configures controllers. Neither affects the other. An app that sets a naming policy or a custom converter for its controllers and then adds minimal API endpoints gets the defaults on the new endpoints, and the two halves of the API serialize the same type differently.

## Organizing Endpoints

A `Program.cs` that maps every endpoint inline stops being readable after a few dozen routes. Two tools keep it in shape.

**Route groups.** `MapGroup` returns a builder that prefixes every endpoint mapped on it and applies the same conventions to all of them. Anything set on the group, such as `RequireAuthorization`, `WithTags`, a filter, or a rate-limiting policy, applies to every endpoint in it, and groups nest:

```csharp
var orders = app.MapGroup("/orders")
    .RequireAuthorization()
    .WithTags("Orders");

orders.MapGet("/", ListOrders);
orders.MapGet("/{id:int}", GetOrder);
orders.MapPost("/", CreateOrder);

var lines = orders.MapGroup("/{orderId:int}/lines");
lines.MapGet("/", ListLines);
```

**Extension methods per feature.** Each feature exposes one method that maps its group, the same convention `Add{Feature}` methods follow for service registration:

```csharp
public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/orders").WithTags("Orders");
        group.MapGet("/", ListOrders);
        group.MapGet("/{id:int}", GetOrder);
        return group;
    }

    static async Task<Results<Ok<Order>, NotFound>> GetOrder(int id, IOrderStore orders) =>
        await orders.FindAsync(id) is { } order ? TypedResults.Ok(order) : TypedResults.NotFound();

    static Task<Order[]> ListOrders(IOrderStore orders) => orders.ListAsync();
}

// Program.cs
app.MapOrderEndpoints();
```

`Program.cs` then reads as a list of features. Teams that want one class per endpoint, each with its own request and response types (the *request-endpoint-response* or REPR style), can apply the same pattern at a finer grain.

Endpoints also carry the metadata that OpenAPI documents are generated from: `WithName` for a stable operation ID, `WithTags`, `WithSummary`, `WithDescription`, and `Produces` for responses a handler returns as plain `IResult`. `WithOpenApi`, the older way to edit the generated operation, is deprecated in .NET 10 in favor of the OpenAPI package's transformers.

## Endpoint Filters

An *endpoint filter* runs around a handler after its parameters have been bound. It can read and change the arguments, return a result of its own without calling the handler, or inspect and replace the handler's result on the way out. That makes filters the place for logic that depends on what the handler receives, which middleware can't see.

```csharp
public class RequireActiveTenantFilter(ITenantDirectory tenants) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var query = context.GetArgument<OrderQuery>(0);   // arguments in declaration order

        if (query.Tenant is null || !await tenants.IsActiveAsync(query.Tenant))
        {
            return TypedResults.Problem("Unknown or inactive tenant.", statusCode: 403);
        }

        return await next(context);
    }
}

app.MapGet("/orders", ([AsParameters] OrderQuery query, IOrderStore orders) =>
        orders.List(query.Page, query.PageSize, query.Tenant))
   .AddEndpointFilter<RequireActiveTenantFilter>();
```

Filters nest like middleware. The code before `next` runs in the order filters were added, and the code after `next` in reverse. Filters on a group run before filters on its endpoints, and an outer group's filters run before an inner group's, whatever order they were added in. Filter classes receive constructor dependencies from the container. The result a filter returns executes after the whole filter chain finishes, so a filter can still set response headers after `next` returns, unless the handler wrote to the response directly.

Two variations cover the less common cases. `AddEndpointFilterFactory` runs once per endpoint at startup with the handler's `MethodInfo`, so a filter can check the handler's signature and attach itself only where it applies. And endpoint filters aren't limited to minimal APIs: attached through `app.MapControllers().AddEndpointFilter(...)`, the same filter runs for controller actions too.

Since .NET 10, the framework's own validation for minimal APIs, enabled with `builder.Services.AddValidation()`, checks data annotations on bound parameters and returns a `400` Problem Details response before the handler runs, which covers most of what hand-written validation filters used to do.

## Native AOT

*Native AOT* publishing compiles the app ahead of time to a single native executable, with no JIT compiler at runtime. The payoff is faster startup, a smaller deployment, and lower memory use, which matter most for containers that scale out often and for serverless hosts. The cost is that nothing can depend on runtime reflection or code generation.

Minimal APIs support Native AOT because the framework can generate their binding code at compile time. With `PublishAot` set, a source generator, the Request Delegate Generator, writes the code that binds each handler's parameters and writes its results, replacing the reflection-based code the framework would otherwise build at startup. The app then has to do its part:

- **Source-generated JSON.** Every type read from a request body or written to a response must be declared on a `JsonSerializerContext`, registered through the options that minimal APIs read:

  ```csharp
  builder.Services.ConfigureHttpJsonOptions(options =>
      options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

  [JsonSerializable(typeof(Order))]
  [JsonSerializable(typeof(Order[]))]
  internal partial class AppJsonContext : JsonSerializerContext { }
  ```

- **AOT-compatible dependencies.** Libraries that scan assemblies, load plugins, or emit code at runtime won't work. MVC is the obvious one, along with most authentication handlers other than JWT bearer.
- **Zero AOT warnings.** Publishing analyzes the whole app, including NuGet packages, and reports anything that relies on unsupported features. An app that publishes with warnings may fail at runtime where the JIT-compiled build worked, so test the published executable, not just `dotnet run`.

The `webapiaot` template starts a project this way, using `CreateSlimBuilder` and source-generated JSON. An app that doesn't need AOT's startup and size gains has no reason to accept its constraints, and minimal APIs work the same with or without it.

## Key Takeaways

- Minimal APIs are the recommended default for new APIs and the only option for Native AOT. Controllers remain the better fit for custom model binding, non-JSON formats, and MVC's application model.
- Binding picks a source from the parameter's type and name: special types, `BindAsync`, route then query for parseable types, services, then the body. Headers always need `[FromHeader]`.
- A missing required value or an unparseable one is a `400` before the handler runs, with an empty body in production. Nullability decides what is required.
- `TypedResults` document themselves for OpenAPI and are easy to test. Handlers returning several of them declare a `Results<...>` return type.
- `ConfigureHttpJsonOptions` and `AddJsonOptions` configure different options objects, so a mixed app has to set both.
- Route groups and one `Map{Feature}Endpoints` method per feature keep `Program.cs` readable, and group conventions apply to every endpoint inside.
- Endpoint filters see bound arguments and results, run in registration order with group filters first, and can be attached to controllers too.
- Native AOT needs source-generated JSON, AOT-compatible libraries, and a warning-free publish.
