---
title: "Minimal APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "API Programming Models"
description: "Explores ASP.NET Core Minimal APIs as a lightweight alternative to controllers, covering parameter binding, strongly-typed responses, route organization, filters, validation, and Native AOT compatibility."
tags: [asp-net-core, minimal-apis, web-api, performance, aot, endpoint-filters, parameter-binding]
---

## Philosophy and Choosing an Approach

Minimal APIs provide a streamlined approach to building HTTP APIs in ASP.NET Core. Rather than organizing endpoints into controller classes with action methods, minimal APIs define individual route handlers directly on the application builder. This reduces ceremony, improves startup time, and aligns naturally with microservices and serverless architectures where each endpoint often serves a narrow, focused purpose.

The choice between minimal APIs and controllers comes down to application needs and team preferences. Minimal APIs work well for focused APIs with straightforward routing and relatively few endpoints. Controllers excel when you need extensive shared behavior across related endpoints, complex action filters, or MVC features like view rendering. Minimal APIs offer faster startup and lower memory overhead, especially when published with Native AOT. Controllers provide more structure and familiarity for teams transitioning from traditional ASP.NET or MVC backgrounds.

Performance differences are measurable but often negligible in real applications. Minimal APIs can cold-start three to five times faster under Native AOT compared to controller-based equivalents, and they avoid loading MVC assemblies and features like the Razor view engine. For high-throughput scenarios and serverless deployments where cold start time matters, minimal APIs deliver tangible benefits. For typical line-of-business applications, the difference rarely justifies rewriting existing controller-based code.

## Defining Route Handlers

Route handlers in minimal APIs are the methods that process HTTP requests and generate responses. You can define handlers as inline lambda expressions, local functions, method groups referencing named methods, or instance methods on separate classes.

Inline lambdas work well for simple handlers:

```csharp
app.MapGet("/hello", () => "Hello World");

app.MapPost("/users", (User user) => Results.Created($"/users/{user.Id}", user));
```

Named methods improve readability and testability for handlers with more logic:

```csharp
app.MapGet("/products/{id}", GetProduct);

IResult GetProduct(int id, IProductRepository repo)
{
    var product = repo.FindById(id);
    return product is not null
        ? Results.Ok(product)
        : Results.NotFound();
}
```

Method groups allow you to reference existing static or instance methods without explicitly writing a lambda wrapper. When a handler grows beyond a few lines, extracting it to a named method or separate class makes the route registration cleaner and the handler easier to test in isolation.

## Parameter Binding

Parameter binding is the mechanism that converts incoming HTTP request data into strongly typed method parameters. Minimal APIs support binding from route values, query strings, headers, request body, and dependency injection services.

Route parameters appear in the route template with curly braces and bind by name:

```csharp
app.MapGet("/orders/{orderId}/items/{itemId}", (int orderId, int itemId) =>
{
    return $"Order {orderId}, Item {itemId}";
});
```

Query string parameters bind automatically when parameter names match query keys:

```csharp
app.MapGet("/search", (string query, int page = 1, int size = 20) =>
{
    // Binds ?query=foo&page=2&size=50
    return $"Searching for '{query}' (page {page}, size {size})";
});
```

Header values bind when decorated with the `[FromHeader]` attribute:

```csharp
app.MapGet("/protected", ([FromHeader(Name = "X-Api-Key")] string apiKey) =>
{
    return string.IsNullOrEmpty(apiKey) ? Results.Unauthorized() : Results.Ok();
});
```

The request body binds to complex types when decorated with `[FromBody]`:

```csharp
app.MapPost("/products", ([FromBody] Product product) =>
{
    return Results.Created($"/products/{product.Id}", product);
});
```

Services registered in the dependency injection container bind automatically when a parameter type matches a registered service:

```csharp
app.MapGet("/inventory", (IInventoryService inventory) =>
{
    return inventory.GetStockLevels();
});
```

Special types like `HttpContext`, `HttpRequest`, `HttpResponse`, `ClaimsPrincipal`, and `CancellationToken` bind automatically without attributes. The framework inspects each parameter's type and source to determine the appropriate binding strategy. When ambiguity arises, explicit attributes like `[FromRoute]`, `[FromQuery]`, or `[FromServices]` clarify intent.

## Grouped Parameters with AsParameters

The `[AsParameters]` attribute groups multiple parameter sources into a single parameter object, reducing clutter in route handler signatures. Instead of declaring many individual parameters, you define a record or class that holds related values and decorate it with `[AsParameters]`.

```csharp
public record GetOrderRequest(
    int OrderId,
    [FromQuery] bool includeItems,
    [FromServices] IOrderRepository repository
);

app.MapGet("/orders/{orderId}", ([AsParameters] GetOrderRequest request) =>
{
    var order = request.repository.FindById(request.OrderId);
    if (order is null) return Results.NotFound();

    return request.includeItems
        ? Results.Ok(order)
        : Results.Ok(order with { Items = null });
});
```

This pattern keeps handler signatures concise while maintaining strong typing and clear parameter sources. When an endpoint requires many inputs, grouping them into a dedicated type improves readability and makes the handler easier to refactor or test.

## Strongly-Typed Responses with TypedResults

The `Results` helper class provides factory methods for common HTTP responses like `Ok()`, `NotFound()`, `Created()`, and `BadRequest()`. These methods return `IResult`, which is the base interface for all result types. The `TypedResults` class offers the same factory methods but returns concrete types instead of the interface, enabling the compiler and tooling to understand the exact response shape.

```csharp
app.MapGet("/products/{id}", (int id, IProductRepository repo) =>
{
    var product = repo.FindById(id);
    return product is not null
        ? TypedResults.Ok(product)
        : TypedResults.NotFound();
});
```

Using `TypedResults` instead of `Results` improves compile-time safety and automatically provides OpenAPI metadata for each response type. The endpoint description will reflect both the 200 OK response with a `Product` payload and the 404 Not Found response without requiring explicit `Produces` attributes.

For handlers that return multiple possible result types, the `Results<T1, T2, ...>` union type documents all return possibilities:

```csharp
app.MapGet("/products/{id}", Results<Ok<Product>, NotFound> (int id, IProductRepository repo) =>
{
    var product = repo.FindById(id);
    return product is not null
        ? TypedResults.Ok(product)
        : TypedResults.NotFound();
});
```

This approach makes return types explicit in the method signature, improving both code clarity and generated API documentation. The tradeoff is slightly more verbose signatures, which may not matter for endpoints with simple return types but becomes valuable for complex handlers with varied responses.

## Organizing Routes with MapGroup

Route groups reduce repetition when multiple endpoints share a common prefix or configuration. The `MapGroup()` method creates a group with a shared route prefix, and you can chain additional configuration like filters, metadata, or authorization requirements.

```csharp
var api = app.MapGroup("/api");

api.MapGet("/products", GetProducts);
api.MapGet("/products/{id}", GetProduct);
api.MapPost("/products", CreateProduct);
api.MapPut("/products/{id}", UpdateProduct);
api.MapDelete("/products/{id}", DeleteProduct);
```

Groups can nest to represent hierarchical structures:

```csharp
var api = app.MapGroup("/api");
var productsGroup = api.MapGroup("/products");

productsGroup.MapGet("/", GetProducts);
productsGroup.MapGet("/{id}", GetProduct);
productsGroup.MapPost("/", CreateProduct);

var reviewsGroup = productsGroup.MapGroup("/{productId}/reviews");
reviewsGroup.MapGet("/", GetReviews);
reviewsGroup.MapPost("/", AddReview);
```

You can apply filters, authorization policies, or OpenAPI tags at the group level, and they propagate to all endpoints within that group:

```csharp
var adminGroup = app.MapGroup("/admin")
    .RequireAuthorization("AdminPolicy")
    .WithTags("Administration")
    .AddEndpointFilter<AuditLogFilter>();

adminGroup.MapGet("/users", GetUsers);
adminGroup.MapPost("/users", CreateUser);
```

Groups with an empty prefix allow applying shared configuration without changing route patterns. This is useful when you want to attach metadata or filters to a set of endpoints that don't share a common path segment.

## Endpoint Filters

Endpoint filters run before and after route handlers, similar to action filters in MVC. They intercept requests, inspect or modify context, and optionally short-circuit execution. Filters are useful for cross-cutting concerns like logging, validation, caching, or authorization checks that apply to specific endpoints or groups.

You implement a filter by creating a class that implements `IEndpointFilter`:

```csharp
public class RequestTimingFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await next(context);
        stopwatch.Stop();

        context.HttpContext.Response.Headers.Append(
            "X-Response-Time-Ms",
            stopwatch.ElapsedMilliseconds.ToString());

        return result;
    }
}
```

Attach filters to individual endpoints or route groups:

```csharp
app.MapGet("/products", GetProducts)
    .AddEndpointFilter<RequestTimingFilter>();

var apiGroup = app.MapGroup("/api")
    .AddEndpointFilter<RequestTimingFilter>();
```

Filters execute in the order they are added at each level. If a route group has two filters and an endpoint within that group has one filter, the group filters run first, then the endpoint filter. When multiple groups nest, outer group filters execute before inner group filters, regardless of the order they were added.

Filters can short-circuit the pipeline by returning a result directly instead of calling `next()`:

```csharp
public class ApiKeyFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var apiKey = context.HttpContext.Request.Headers["X-Api-Key"].FirstOrDefault();
        if (string.IsNullOrEmpty(apiKey) || !IsValidApiKey(apiKey))
        {
            return Results.Unauthorized();
        }

        return await next(context);
    }

    private bool IsValidApiKey(string key) => /* validation logic */;
}
```

When a filter short-circuits, subsequent filters and the route handler do not execute. This behavior is useful for authentication, rate limiting, or request validation that must pass before processing continues.

## OpenAPI Metadata

Minimal APIs generate OpenAPI descriptions automatically based on parameter types and return types. You can enrich the generated documentation with extension methods that add names, tags, descriptions, and explicit response types.

```csharp
app.MapGet("/products/{id}", GetProduct)
    .WithName("GetProductById")
    .WithTags("Products")
    .WithDescription("Retrieves a product by its unique identifier")
    .Produces<Product>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound);
```

The `WithName()` method assigns an operation ID that tools like Swagger UI and client generators use to create unique method names. Without explicit names, the framework generates operation IDs based on HTTP method and route pattern, which can be unstable if routes change.

Tags group related operations in Swagger UI and other documentation tools. The `WithTags()` method accepts multiple tags, and you can apply tags to route groups to avoid repeating them on every endpoint.

The `Produces()` method specifies possible response types and status codes. When using `TypedResults`, explicit `Produces()` calls are often unnecessary because the framework infers response types from the return signature. For endpoints that return `IResult` or use `Results`, adding `Produces()` improves generated documentation.

The `Accepts()` method documents request body content types:

```csharp
app.MapPost("/products", CreateProduct)
    .Accepts<Product>("application/json")
    .WithOpenApi();
```

The `WithOpenApi()` method allows modifying the generated OpenAPI operation with a custom transformation:

```csharp
app.MapGet("/products", GetProducts)
    .WithOpenApi(operation =>
    {
        operation.Summary = "Lists all products";
        operation.Description = "Returns a paginated list of products...";
        return operation;
    });
```

This level of customization is useful when the generated metadata needs adjustments that extension methods don't cover directly.

## Validation in .NET 10

Starting with .NET 10, minimal APIs include built-in validation that integrates with data annotations from the `System.ComponentModel.DataAnnotations` namespace. When you enable validation with `builder.Services.AddValidation()`, models bound from requests are automatically validated, and invalid requests receive a standardized 400 Bad Request response with a `ProblemDetails` payload.

```csharp
public record CreateProductRequest(
    [Required, StringLength(100)] string Name,
    [Range(0.01, 10000)] decimal Price,
    [Required] string Category
);

app.MapPost("/products", (CreateProductRequest request) =>
{
    // If validation fails, this handler never executes
    return Results.Created($"/products/{request.Name}", request);
});
```

Validation applies to query parameters, headers, route parameters, and request bodies. You can decorate individual properties with attributes like `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, and others.

For scenarios requiring custom validation logic beyond what data annotations provide, implement `IValidatableObject`:

```csharp
public record CreateOrderRequest(
    [Required] string CustomerId,
    [Required] List<OrderItem> Items
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (Items.Count == 0)
        {
            yield return new ValidationResult(
                "Order must contain at least one item",
                new[] { nameof(Items) });
        }

        if (Items.Sum(i => i.Quantity) > 100)
        {
            yield return new ValidationResult(
                "Total quantity cannot exceed 100",
                new[] { nameof(Items) });
        }
    }
}
```

When validation fails, the framework returns a response that follows the RFC 7807 Problem Details specification, making error responses consistent across your API. If you need to disable validation for specific endpoints, use the `DisableValidation()` extension method:

```csharp
app.MapPost("/legacy-endpoint", LegacyHandler)
    .DisableValidation();
```

This built-in validation eliminates the need for manual validation checks or third-party libraries in many scenarios while maintaining consistency with controller-based APIs that use model validation.

## File Upload and Streaming

Minimal APIs support file uploads through the `IFormFile` and `IFormFileCollection` types. These bind automatically when a request includes multipart form data:

```csharp
app.MapPost("/upload", async (IFormFile file) =>
{
    if (file.Length == 0)
        return Results.BadRequest("File is empty");

    var path = Path.Combine("uploads", file.FileName);
    using var stream = File.OpenWrite(path);
    await file.CopyToAsync(stream);

    return Results.Ok(new { FileName = file.FileName, Size = file.Length });
});
```

For multiple files, use `IFormFileCollection`:

```csharp
app.MapPost("/upload-multiple", async (IFormFileCollection files) =>
{
    var results = new List<object>();
    foreach (var file in files)
    {
        var path = Path.Combine("uploads", file.FileName);
        using var stream = File.OpenWrite(path);
        await file.CopyToAsync(stream);
        results.Add(new { FileName = file.FileName, Size = file.Length });
    }

    return Results.Ok(results);
});
```

Streaming responses allow sending data incrementally without buffering the entire payload in memory. This is useful for large files, real-time data feeds, or long-running operations. You can return a `Stream` directly, and the framework streams its contents to the client:

```csharp
app.MapGet("/download/{filename}", (string filename) =>
{
    var path = Path.Combine("files", filename);
    if (!File.Exists(path))
        return Results.NotFound();

    var stream = File.OpenRead(path);
    return Results.Stream(stream, contentType: "application/octet-stream");
});
```

For custom streaming scenarios, access the response body stream directly:

```csharp
app.MapGet("/stream-data", async (HttpContext context) =>
{
    context.Response.ContentType = "text/plain";
    var writer = new StreamWriter(context.Response.Body, leaveOpen: true);

    for (int i = 0; i < 10; i++)
    {
        await writer.WriteLineAsync($"Line {i}");
        await writer.FlushAsync();
        await Task.Delay(1000);
    }
});
```

Streaming works well with Server-Sent Events, which push updates from server to client over a long-lived HTTP connection.

## Server-Sent Events

Server-Sent Events provide a simple mechanism for pushing real-time updates to clients over HTTP. The server maintains an open connection and sends messages in a text-based format with the `text/event-stream` content type. Clients receive updates as they arrive without polling.

```csharp
app.MapGet("/events", async (HttpContext context) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache";

    var writer = new StreamWriter(context.Response.Body);

    while (!context.RequestAborted.IsCancellationRequested)
    {
        var message = $"data: Server time is {DateTime.UtcNow:O}\n\n";
        await writer.WriteAsync(message);
        await writer.FlushAsync();
        await Task.Delay(1000, context.RequestAborted);
    }
});
```

Each message follows the format `data: <content>\n\n`, with two newlines marking the end of an event. The client connects with JavaScript or another HTTP client that supports SSE:

```javascript
const eventSource = new EventSource('/events');
eventSource.onmessage = (event) => {
    console.log(event.data);
};
```

SSE works well for unidirectional updates like notifications, log streaming, or live dashboards. For bidirectional communication or more complex messaging, WebSockets may be more appropriate.

## REPR Pattern

The REPR (Request-Endpoint-Response) pattern organizes each endpoint as an independent class with a single responsibility. Instead of grouping related endpoints into controller classes, each endpoint becomes its own unit with explicit request and response types. This aligns naturally with vertical slice architecture, where each feature encapsulates its data access, business logic, and API surface.

In minimal APIs, you can adopt REPR principles by defining endpoints as classes with dedicated request and response types:

```csharp
public record GetProductRequest(int Id);
public record GetProductResponse(int Id, string Name, decimal Price);

public class GetProductEndpoint
{
    public static async Task<Results<Ok<GetProductResponse>, NotFound>> Handle(
        [AsParameters] GetProductRequest request,
        IProductRepository repository)
    {
        var product = await repository.FindByIdAsync(request.Id);
        if (product is null)
            return TypedResults.NotFound();

        var response = new GetProductResponse(product.Id, product.Name, product.Price);
        return TypedResults.Ok(response);
    }
}

app.MapGet("/products/{id}", GetProductEndpoint.Handle);
```

This structure makes each endpoint easier to test, understand, and modify in isolation. You avoid coupling unrelated endpoints through shared controller state or dependencies, and each endpoint's request and response contracts are explicit.

## FastEndpoints

FastEndpoints is an open-source library that brings REPR principles and vertical slice architecture to ASP.NET Core with additional conventions and features. It provides base classes, built-in support for FluentValidation, and patterns for organizing endpoints as self-contained classes. While minimal APIs require you to manually wire up endpoints and dependencies, FastEndpoints automates discovery and registration based on conventions.

FastEndpoints performance is comparable to minimal APIs, with both outperforming traditional controllers in startup time and memory overhead. The library does not support data annotations validation and requires FluentValidation instead, which may be a consideration depending on your existing validation approach.

Minimal APIs remain the framework-native solution with full Microsoft support, Native AOT compatibility, and no additional dependencies. FastEndpoints offers more structure and conventions for teams that prefer explicit REPR patterns without building that infrastructure themselves. Choosing between the two depends on whether you value framework minimalism or prefer the additional structure and tooling that FastEndpoints provides.

## Performance Characteristics

Minimal APIs are optimized for low overhead and fast startup. They avoid loading MVC assemblies, the Razor view engine, and controller-specific features, reducing the application's memory footprint and initialization time. In synthetic benchmarks, minimal APIs perform comparably to controllers for request throughput but show significant advantages in cold start scenarios.

When published with Native AOT, minimal APIs can cold-start three to five times faster than controller-based equivalents. This makes them particularly well-suited for serverless environments where cold starts directly impact user experience and costs. The difference is less pronounced in long-running applications where startup time is amortized over many requests, but the reduced memory usage remains beneficial.

For typical APIs handling thousands of requests per second, the performance difference between minimal APIs and controllers is often negligible. Bottlenecks usually lie in database access, external service calls, or business logic rather than framework overhead. The choice between minimal APIs and controllers should weigh development ergonomics, team familiarity, and architectural fit alongside raw performance metrics.

## Native AOT Compatibility

Native AOT (Ahead-of-Time) compilation compiles .NET applications to native machine code, eliminating the need for the just-in-time compiler at runtime. This reduces startup time, memory usage, and deployment size, making it attractive for containers, serverless functions, and resource-constrained environments.

Minimal APIs are designed to be AOT-friendly. They avoid runtime reflection, dynamic code generation, and metadata inspection that AOT restricts or penalizes. Controllers, by contrast, rely heavily on reflection for routing, model binding, and action discovery, which increases AOT complexity and limits compatibility.

When targeting Native AOT, minimal APIs are currently the only supported approach in ASP.NET Core. Controllers require additional trimming configuration and linker hints to function correctly under AOT, and even with those adjustments, some MVC features remain unsupported.

Native AOT has constraints beyond just the programming model. It does not support dynamic assembly loading, runtime code generation, or certain reflection patterns. Frameworks and libraries that depend on these features may not work or may require alternative implementations. JSON serialization with `System.Text.Json` is fully supported with source generators that produce serialization code at compile time, but libraries using Reflection.Emit or dynamic proxies may not function under AOT.

The decision to use Native AOT should consider deployment environment, startup time requirements, and compatibility with existing dependencies. For applications where cold start time is critical and dependencies support AOT, minimal APIs combined with Native AOT publish deliver measurable performance improvements. For applications with complex dependencies or those using features incompatible with AOT, traditional runtime compilation remains the pragmatic choice.

## Red Flags

Watch for these patterns that indicate minimal APIs may not be the best fit or that implementation needs adjustment:

Repeating the same filters, metadata, or configuration across many endpoints suggests that route groups could consolidate shared setup. When multiple endpoints share common prefixes or require identical authorization, validation, or error handling, grouping them reduces duplication and makes changes easier.

Inline lambdas that span many lines make route registrations hard to read and test. Extract handlers to named methods or separate classes when logic exceeds a few lines. This improves testability and keeps the route configuration clean.

Missing OpenAPI metadata results in poor generated documentation. Without explicit names, tags, and response types, tools like Swagger UI generate incomplete or confusing descriptions. Adding metadata as endpoints are created avoids rework later when documentation becomes a priority.

Ignoring parameter binding sources can lead to ambiguous or incorrect bindings. When parameters could plausibly come from multiple sources, explicitly specify `[FromRoute]`, `[FromQuery]`, `[FromBody]`, or `[FromServices]` to avoid surprises.

Overusing `IResult` instead of `TypedResults` loses compile-time safety and metadata inference. While `IResult` works, `TypedResults` improves tooling support and makes return types explicit in method signatures.

Mixing minimal APIs and controllers in the same application without a clear strategy creates confusion. If certain endpoints use minimal APIs for performance and others use controllers for complex action filters, document the decision criteria so future maintainers understand the pattern.

Adopting Native AOT without verifying dependency compatibility can lead to runtime failures or missing functionality. Test thoroughly and review third-party libraries for AOT support before committing to Native AOT deployment.
