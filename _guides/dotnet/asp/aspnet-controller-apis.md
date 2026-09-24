---
title: "Controller-Based APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Building ASP.NET Core web APIs with controllers: what [ApiController] changes, attribute routing and route tokens, choosing action return types, MVC model binding and custom binders, the five-stage filter pipeline, and content negotiation with input and output formatters."
tags: [practical, controllers, apicontroller, attribute-routing, model-binding, mvc-filters, content-negotiation]
---

## Controllers and Actions

A *controller* is a class whose public methods, called *actions*, handle requests. API controllers derive from `ControllerBase`, which supplies helpers such as `Ok`, `NotFound`, `CreatedAtAction`, and `ValidationProblem`, plus access to the request through properties like `HttpContext`, `Request`, and `User`. The `Controller` class adds view rendering on top and belongs to apps that serve HTML pages.

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrdersController(IOrderStore orders) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Order>> Get(int id) =>
        await orders.FindAsync(id) is { } order ? order : NotFound();
}
```

Controllers are registered with `builder.Services.AddControllers()` and mapped with `app.MapControllers()`, which turns every attribute-routed action into an endpoint in the same route table minimal APIs use. The framework creates a new controller instance for every request, so a field set in one request is never seen by another, and constructor-injected scoped services such as a `DbContext` are safe to use because they belong to the request's scope.

## What [ApiController] Changes

`[ApiController]` switches on a set of behaviors meant for HTTP APIs. It can go on a controller, on a base class that API controllers share, or on the assembly (`[assembly: ApiController]`), in which case every controller gets it and none can opt out.

Two terms come first. *Model state* (`ModelState`) is the per-request record of binding and validation results. Each parameter or property that fails to bind or validate adds an error to it. A *conventional route* is one app-wide URL pattern, such as `{controller}/{action}/{id?}`, from which MVC derives every action's URL by controller and method name. Attribute routing, covered in the next section, is the alternative.

| Behavior | What it does | Turned off by `ApiBehaviorOptions` property |
| --- | --- | --- |
| Attribute routing required | Actions are reachable only through route attributes, never through conventional routes. An action with no attribute route throws when the app first builds its endpoints, usually on the first request | Can't be turned off |
| Automatic `400` responses | A request whose model state is invalid gets a `400` with a `ValidationProblemDetails` body before the action runs | `SuppressModelStateInvalidFilter` |
| Binding source inference | Parameters get a source without `[From...]` attributes (rules below) | `SuppressInferBindingSourcesForParameters` |
| Multipart/form-data inference | `IFormFile` parameters make the action accept `multipart/form-data` | `SuppressConsumesConstraintForFormFileParameters` |
| Problem Details for errors | Error results with no body, such as `NotFound()`, get a Problem Details body, the standard JSON error format from RFC 9457 | `SuppressMapClientErrors` |

The automatic `400` removes the `if (!ModelState.IsValid)` check that every action used to start with. Model state becomes invalid both when a data annotation fails and when a value can't be bound at all, such as `"abc"` for an `int`, so the client gets one consistent error shape for both. Actions that do their own checks should return `ValidationProblem()` rather than `BadRequest()` to produce the same shape.

The options are set with `ConfigureApiBehaviorOptions`, which also replaces the automatic `400` response itself through `InvalidModelStateResponseFactory`, for an API that must return a different error body:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = context =>
            new UnprocessableEntityObjectResult(new ValidationProblemDetails(context.ModelState)));
```

`ValidationProblem()` doesn't use the replacement. It still returns a `400` built by the default Problem Details factory, so after a change like this one, actions that check for themselves and the automatic check disagree on status. Such actions should instead inject `IOptions<ApiBehaviorOptions>` and return the configured factory's result for `ControllerContext`, or share a helper with it.

## Attribute Routing

MVC supports two ways of attaching routes to actions. Conventional routing, declared with `MapControllerRoute`, suits HTML apps whose URLs follow code structure. *Attribute routing* puts a template on each controller and action, which is what APIs need, since a resource URL like `GET /api/orders/42` shouldn't depend on what a method is called.

A `[Route]` on the controller sets a prefix, and the HTTP method attributes on actions (`[HttpGet]`, `[HttpPost]`, and the rest) add to it:

```csharp
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpGet]                          // GET  api/orders
    public Task<Order[]> List() { ... }

    [HttpGet("{id:int}", Name = "GetOrder")]   // GET  api/orders/42
    public Task<ActionResult<Order>> Get(int id) { ... }

    [HttpPost]                         // POST api/orders
    public Task<ActionResult<Order>> Create(CreateOrder request) { ... }

    [HttpGet("/api/order-summaries")]  // GET  api/order-summaries, ignoring the prefix
    public Task<OrderSummary[]> Summaries() { ... }
}
```

Templates, constraints such as `{id:int}`, and precedence work the same way as for any other endpoint. A template on an action that begins with `/` or `~/` replaces the controller's prefix instead of adding to it.

### Route Tokens

Route templates can contain the tokens `[controller]`, `[action]`, and `[area]`, which are replaced with the controller name (minus the `Controller` suffix), the action method name, and the area name. An *area* is a named group of controllers, declared with `[Area("Admin")]`, that larger apps use to split one app into sections. `[Route("api/[controller]")]` on `OrdersController` becomes `api/Orders`. Tokens keep templates short, but they tie the public URL to class and method names, so renaming a method silently changes the API. Many teams avoid `[action]` for that reason.

Token replacement keeps the name's casing. Matching is case-insensitive, so `/api/orders` still reaches the controller, but generated links read `/api/Orders`. A *parameter transformer* rewrites tokens consistently, typically to lowercase with hyphens. It is registered as a *convention*, a class MVC runs once at startup over its model of every controller and action, able to change their routes, names, or filters. Conventions and most other MVC-wide settings live on `MvcOptions`, the `options` object that `AddControllers` passes to its callback:

```csharp
builder.Services.AddControllers(options =>
    options.Conventions.Add(new RouteTokenTransformerConvention(new SlugifyParameterTransformer())));

// A transformer is a small class implementing IOutboundParameterTransformer
public class SlugifyParameterTransformer : IOutboundParameterTransformer
{
    public string? TransformOutbound(object? value) =>
        value is null
            ? null
            : Regex.Replace(value.ToString()!, "([a-z])([A-Z])", "$1-$2",
                RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)).ToLowerInvariant();
}
```

With it, `OrderSummariesController` answers at `api/order-summaries`.

## Action Return Types

An action's return type decides both what it can return and what the *API description* can say about it. The API description is the metadata about each endpoint's parameters and responses that OpenAPI generation reads.

| Return type | Can return | Documents the success type |
| --- | --- | --- |
| A specific type, such as `Order` | Only that type, as `200`, or `204` when the value is `null` | Yes |
| `IActionResult` | Any status and body, through `Ok()`, `NotFound()`, and the rest | No; needs `[ProducesResponseType]` |
| `ActionResult<Order>` | Either an `Order` (as `200`) or any `IActionResult` | Yes |
| `Results<Ok<Order>, NotFound>` (the `HttpResults` types shared with minimal APIs) | Only the listed results, checked by the compiler | Yes, every listed result's status and body type |

`ActionResult<T>` is the usual choice. Implicit conversions let an action `return order;` on success and `return NotFound();` on failure from the same method, and the API description knows a successful response contains an `Order`. The error responses still need declaring with `[ProducesResponseType(StatusCodes.Status404NotFound)]` if the description should list them. One limitation catches people: C# allows no implicit conversion from an interface type, so an expression typed as an interface can't be returned directly. An action declared as `ActionResult<IEnumerable<Order>>` that returns `repository.GetOrders()`, itself typed `IEnumerable<Order>`, fails to compile. Materializing it with `.ToList()` or wrapping it in `Ok(...)` fixes it.

The `HttpResults` types behave differently in a controller than the other return types. Every other return type hands its value to MVC's *output formatters*, the classes that turn an object into a response body in the format the client's `Accept` header asks for (covered at the end of this guide). `HttpResults` types write their own response instead, so `[Produces]`, the formatters, and the `Accept` header have no effect on them, and they serialize with the minimal API JSON settings, not the controller ones. Mixing them into a controller that relies on formatters or on `AddJsonOptions` changes the output silently.

A creation action should return `201 Created` with a `Location` header pointing at the new resource. `CreatedAtAction` and `CreatedAtRoute` build that header through link generation, the first from an action name and the second from a route name such as the `Name = "GetOrder"` set in the earlier sample:

```csharp
[HttpPost]
public async Task<ActionResult<Order>> Create(CreateOrder request)
{
    var order = await orders.CreateAsync(request);
    return CreatedAtAction(nameof(Get), new { id = order.Id }, order);
}
```

MVC trims an `Async` suffix from action names by default, so an action method named `GetAsync` has the action name `Get`. `CreatedAtAction(nameof(GetAsync), ...)` then names an action that doesn't exist, and link generation fails at runtime. Pass the trimmed name, or set `MvcOptions.SuppressAsyncSuffixInActionNames` to `false`.

Two defaults surprise people. An action whose declared type is a model object and that returns `null` produces `204 No Content`, not `200` with a `null` body or a `404`. And an action that returns a `string` produces `text/plain` when the client sends no `Accept` header, `*/*`, or `text/plain`. A client that asks for `application/json` gets a JSON string. Both come from built-in output formatters, covered below, and both go away if those formatters are removed.

## Model Binding

MVC *model binding* fills action parameters from the request. It reads values from *value providers* (route values, the query string, and form fields), reads the body through *input formatters*, and resolves services from the container. Each parameter's source comes from an attribute, or from inference under `[ApiController]`:

| Attribute | Source | Inferred under `[ApiController]` for |
| --- | --- | --- |
| `[FromRoute]` | Route values | Parameters named in the route template |
| `[FromQuery]` | Query string | Any other simple-type parameter |
| `[FromBody]` | The request body, through an input formatter | Complex types not registered in the container |
| `[FromForm]` | Form fields and files | `IFormFile` and `IFormFileCollection` |
| `[FromHeader]` | A request header | Never; always explicit |
| `[FromServices]` | The DI container | Complex types that are registered in the container |

Only one parameter can bind from the body. Simple types never bind from the body by inference, so an action that expects a bare JSON string needs `[FromBody] string value`. A complex type marked `[FromQuery]` binds each of its properties from a query value of the same name, which suits search and paging parameters. Setting `ApiBehaviorOptions.DisableImplicitFromServicesParameters` to `true` turns off the `[FromServices]` inference, for teams that want every injected parameter marked.

Binding failures don't throw. A value that can't be converted, or a required value that's missing, adds an error to `ModelState`, and under `[ApiController]` the automatic `400` handles it. Without `[ApiController]`, the action runs with default values and has to check `ModelState.IsValid` itself.

The JSON settings controllers use are configured with `builder.Services.AddControllers().AddJsonOptions(...)`. `ConfigureHttpJsonOptions`, which configures minimal APIs, has no effect on controllers, and the reverse holds too, so an app with both needs both. The `HttpResults` exception above is the one crossover.

### Custom Binding

Types that implement a static `TryParse` method, or `IParsable<T>`, bind from route and query values without any extra code. For anything else, a custom model binder implements `IModelBinder`:

```csharp
public class OrderReferenceBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        var value = bindingContext.ValueProvider.GetValue(bindingContext.ModelName).FirstValue;

        if (value is not null && OrderReference.TryParseLegacy(value, out var reference))
        {
            bindingContext.Result = ModelBindingResult.Success(reference);
        }
        else if (value is not null)
        {
            bindingContext.ModelState.AddModelError(bindingContext.ModelName, "Not a valid order reference.");
        }

        return Task.CompletedTask;
    }
}

[HttpGet("by-reference/{reference}")]
public Task<ActionResult<Order>> GetByReference(
    [ModelBinder(typeof(OrderReferenceBinder))] OrderReference reference) { ... }
```

Adding an error to `ModelState` rather than throwing keeps the failure inside the normal `400` response. To apply a binder to every parameter of a type without attributes, register an `IModelBinderProvider` in `MvcOptions.ModelBinderProviders`. Providers are asked in order until one returns a binder, and the built-in ones already claim most types, so a custom provider goes in with `Insert(0, ...)` rather than `Add`. A custom *value provider* (`IValueProviderFactory`) adds a new source of values, such as a cookie format, for all binders to read from.

## The Filter Pipeline

MVC *filters* run code at defined stages around an action, after routing has selected it. They are the controller counterpart to minimal API endpoint filters, with more stages. The five filter types nest around one another:

{% include figure.html id="asp-mvc-filter-pipeline" %}

| Filter type | Runs | Typical use |
| --- | --- | --- |
| Authorization (`IAuthorizationFilter`) | First, before anything else | Rejecting requests that aren't authorized. Policy-based authorization with `[Authorize]` usually does this through authorization middleware instead |
| Resource (`IResourceFilter`) | Before model binding, and again after the result has executed | Short-circuiting before binding, such as serving a cached response |
| Action (`IActionFilter`) | Immediately before and after the action method, with bound arguments available | Inspecting or changing arguments; replacing the result |
| Exception (`IExceptionFilter`) | When controller creation, model binding, an action filter, or the action throws | Turning specific exceptions into responses for a subset of controllers |
| Result (`IResultFilter`) | Before and after the result executes | Adding headers or changing how the result is written |

Authorization, resource, and action filters short-circuit by setting a result instead of calling the next stage. A result filter stops the result from executing by setting `Cancel` to `true`, or by not calling `next` in its async form. An exception filter doesn't short-circuit; it handles the exception by setting a result or marking it handled. Result filters don't run after authorization, resource, or exception filters short-circuit, only when an action or action filter produced the result. A filter that must run for every result implements `IAlwaysRunResultFilter`.

Exception filters don't see exceptions thrown by resource filters, by result filters, or during result execution, such as a serialization failure, and they don't see anything outside MVC. Exception handling middleware sees all of those, which is why it is the default for centralized error handling. An exception filter suits the narrower case of one group of controllers that needs different handling.

### Scope and Order

A filter can be registered globally, on a controller, or on an action:

```csharp
builder.Services.AddControllers(options => options.Filters.Add<RequestTimingFilter>());   // global

[ServiceFilter<AuditFilter>]          // controller
public class OrdersController : ControllerBase
{
    [HttpPost]
    [TypeFilter<IdempotencyFilter>]   // action
    public Task<ActionResult<Order>> Create(CreateOrder request) { ... }
}
```

Filters of the same type run global first, then controller, then action, and in reverse order on the way out. A filter that implements `IOrderedFilter` can override that with its `Order` value, lower first.

### Filters with Dependencies

A filter written as an attribute gets its constructor arguments from the attribute usage, so it can't receive injected services. Two built-in attributes bridge the gap. `[ServiceFilter<T>]` resolves the filter from the container, so `T` has to be registered, and its registration decides its lifetime. `[TypeFilter<T>]` creates the filter with constructor injection without requiring a registration. Filters added to `options.Filters` by type are created the same way as `TypeFilter`.

```csharp
public class RequestTimingFilter(ILogger<RequestTimingFilter> logger) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var stopwatch = Stopwatch.StartNew();
        var executed = await next();   // runs the action and any later action filters

        // The result hasn't executed yet, so headers can still be set
        executed.HttpContext.Response.Headers["X-Action-Time-Ms"] = stopwatch.ElapsedMilliseconds.ToString();
        logger.LogDebug("{Action} took {Elapsed} ms", context.ActionDescriptor.DisplayName, stopwatch.ElapsedMilliseconds);
    }
}
```

Endpoint filters, the minimal API kind, also run for controller actions when attached with `app.MapControllers().AddEndpointFilter(...)`, which lets an app with both styles share one implementation. They wrap the action method itself, so they run inside the action filters, after binding, with the bound arguments.

## Content Negotiation and Formatters

Controllers can return the same data in several formats. *Content negotiation* picks one from the request's `Accept` header, and *formatters* do the conversion: output formatters write responses, and input formatters read request bodies.

When an action returns an object, MVC looks through the registered output formatters:

- **With an `Accept` header**, it uses the first formatter that can produce one of the requested media types, in the client's order of preference.
- **When none can**, it falls back to the first formatter that can write the object, or returns `406 Not Acceptable` if `MvcOptions.ReturnHttpNotAcceptable` is `true`.
- **With no `Accept` header, or one containing `*/*`**, it uses the first formatter that can write the object. Browsers send `*/*`, so they get the default format unless `RespectBrowserAcceptHeader` is set to `true`.

The default formatters handle JSON (through `System.Text.Json`), plain text for `string` results, and the `204` for `null` results. XML is one call away with `AddXmlSerializerFormatters()` or `AddXmlDataContractSerializerFormatters()`, which register both an input and an output formatter:

```csharp
builder.Services.AddControllers(options => options.ReturnHttpNotAcceptable = true)
    .AddXmlSerializerFormatters();
```

Two attributes narrow negotiation per action or controller:

- `[Produces("application/json")]` limits the response formats and is also what OpenAPI generation reports. With a single type, a client whose `Accept` header doesn't match still gets that format, unless `ReturnHttpNotAcceptable` is `true`, in which case it gets `406`.
- `[Consumes("application/json")]` limits the request body formats. A request with a different `Content-Type` gets `415 Unsupported Media Type` before the action runs.

### Custom Formatters

A format the framework doesn't support, such as CSV, gets a formatter class. An output formatter derives from `TextOutputFormatter` (or `OutputFormatter` for binary formats), declares the media types and CLR types it handles, and writes the body:

```csharp
public class OrderCsvOutputFormatter : TextOutputFormatter
{
    public OrderCsvOutputFormatter()
    {
        SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse("text/csv"));
        SupportedEncodings.Add(Encoding.UTF8);
    }

    protected override bool CanWriteType(Type? type) =>
        typeof(IEnumerable<Order>).IsAssignableFrom(type);

    public override async Task WriteResponseBodyAsync(OutputFormatterWriteContext context, Encoding encoding)
    {
        var builder = new StringBuilder("Id,Customer,Total\n");
        foreach (var order in (IEnumerable<Order>)context.Object!)
        {
            builder.Append($"{order.Id},{order.Customer},{order.Total}\n");
        }

        await context.HttpContext.Response.WriteAsync(builder.ToString(), encoding);
    }
}

builder.Services.AddControllers(options => options.OutputFormatters.Add(new OrderCsvOutputFormatter()));
```

A client that sends `Accept: text/csv` to an action returning orders now gets CSV, and every other client still gets JSON. Adding the formatter at the end of the list keeps JSON as the default, and inserting it at index 0 would make CSV the default for any client that doesn't ask. An input formatter mirrors this, deriving from `TextInputFormatter` and implementing `ReadRequestBodyAsync`, so the same controller can accept CSV request bodies.

## Key Takeaways

- API controllers derive from `ControllerBase`, get a new instance per request, and map to endpoints through `MapControllers`.
- `[ApiController]` requires attribute routing, returns an automatic `400` for invalid model state, infers binding sources, and gives error results a Problem Details body. Each behavior except the routing requirement can be switched off in `ApiBehaviorOptions`.
- Route tokens tie URLs to class and method names and keep their casing. A parameter transformer convention normalizes them.
- `ActionResult<T>` is the usual return type. A `null` model result gives `204`, and a `string` result gives `text/plain` unless the client asks for a format another formatter produces. `HttpResults` types bypass formatters and negotiation entirely.
- Binding failures land in `ModelState` instead of throwing. Only one parameter binds from the body, and `[FromServices]` is inferred for registered types.
- Filters run in five nested stages: authorization, resource, action, exception, and result. Exception filters miss result execution and everything outside MVC, so middleware stays the default for error handling.
- Filters that need services use `[ServiceFilter<T>]` or `[TypeFilter<T>]`.
- Content negotiation follows the `Accept` header across the registered output formatters, ignores `*/*` from browsers by default, and returns `406` only when asked to. `[Consumes]` mismatches become `415`.
- Controllers read JSON settings from `AddJsonOptions`, not `ConfigureHttpJsonOptions`, except for `HttpResults` types, which use the minimal API settings.
