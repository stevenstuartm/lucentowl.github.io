---
title: "Controller-Based APIs"
layout: guide
category: "ASP.NET Core"
subcategory: "API Programming Models"
description: "Comprehensive guide to building controller-based Web APIs in ASP.NET Core, covering routing, model binding, filters, return types, and content negotiation."
tags: [asp-net-core, web-api, mvc, controllers, routing, model-binding, filters]
---

## Controller-Based APIs

The controller-based programming model in ASP.NET Core provides a rich framework for building Web APIs through classes that derive from `ControllerBase` or `Controller`. Controllers organize related HTTP endpoints into logical groups while providing access to request context, automatic model binding, validation, content negotiation, and a filter pipeline for cross-cutting concerns. This programming model offers more structure and convention than minimal APIs while supporting both attribute-based and conventional routing patterns.

## ControllerBase vs Controller

ASP.NET Core provides two base classes for implementing controllers, each designed for different scenarios.

**ControllerBase** serves as the foundation for API controllers. It provides core functionality for handling HTTP requests and returning responses without including features specific to rendering HTML views. ControllerBase gives you access to the HTTP context, request and response objects, URL helpers, and methods for returning various action results. The class focuses exclusively on API scenarios where you're returning data in formats like JSON or XML rather than rendered HTML pages.

**Controller** extends `ControllerBase` to add support for view rendering. It includes everything from `ControllerBase` plus additional features like the `View()` method for rendering Razor views, `PartialView()` for rendering partial views, and helpers for working with form submissions and redirects between pages. Controller is designed for traditional MVC applications that serve HTML pages alongside API endpoints.

For pure API development, prefer `ControllerBase`. It provides exactly what you need without carrying the overhead of view-related infrastructure. Use `Controller` only when building applications that serve both HTML pages and API endpoints, such as traditional web applications with AJAX-driven features.

## The ApiController Attribute

The `[ApiController]` attribute indicates that a controller is designed specifically for serving HTTP API responses. Applying this attribute, either to individual controllers or at the assembly level, enables several behaviors that streamline API development.

### Automatic Model Validation

When a controller has the `[ApiController]` attribute, model validation errors automatically trigger an HTTP 400 Bad Request response. The framework examines the `ModelState` after model binding completes, and if validation fails, it short-circuits the action execution and returns a `ValidationProblemDetails` response describing the errors. This eliminates the need to manually check `ModelState.IsValid` at the beginning of every action.

The automatic validation response follows the RFC 7807 problem details format, providing a standardized structure that clients can parse consistently. The response includes the validation errors organized by property name, making it straightforward for clients to display field-specific error messages.

You can disable this behavior by setting `SuppressModelStateInvalidFilter` to true in the API behavior options if you need more control over validation error responses.

### Binding Source Inference

The `[ApiController]` attribute enables automatic inference of binding sources for action parameters. Without explicit binding attributes, the framework applies these rules:

- Complex types bind from the request body (`[FromBody]`)
- Route parameters bind from route values (`[FromRoute]`)
- Simple types appearing in the route template bind from route values
- Simple types not in the route template bind from the query string (`[FromQuery]`)
- Parameters of type `IFormFile` and `IFormFileCollection` bind from form data (`[FromForm]`)
- Parameters registered in the dependency injection container bind from services (`[FromServices]`)

This inference reduces the need for explicit binding attributes in common scenarios while remaining overridable when you need specific binding behavior.

### Attribute Routing Requirement

Controllers decorated with `[ApiController]` must use attribute routing. Conventional routes defined through methods like `MapControllerRoute` cannot reach actions in API controllers. This requirement ensures that API routes are explicitly defined where they're used rather than relying on global route patterns that might not reflect RESTful URL structures.

### Multipart/Form-Data Request Inference

When an action parameter uses `[FromForm]` or is of type `IFormFile` or `IFormFileCollection`, the framework infers that the action expects multipart/form-data content. This automatically adds the appropriate content type to the API documentation and OpenAPI specifications generated for the endpoint.

### Problem Details for Error Status Codes

API controllers transform error status codes (400 and higher) into `ProblemDetails` responses that follow RFC 7807. This provides a consistent error response format across your API, replacing the default empty responses with structured information about what went wrong.

## Routing Approaches

ASP.NET Core supports two approaches for mapping URLs to controller actions: conventional routing and attribute routing. These approaches differ in where routes are defined and how much flexibility they provide.

### Conventional Routing

Conventional routing defines route patterns globally in the application startup code. Routes are registered through methods like `MapControllerRoute` and rely on conventions to match URL segments to controller and action names.

```csharp
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

This pattern matches URLs where the first segment corresponds to a controller name, the second segment to an action name, and an optional third segment to an ID parameter. The pattern includes default values that apply when segments are omitted.

Conventional routing works well for applications with consistent URL structures where most endpoints follow the same pattern. It's commonly used for applications serving HTML pages where URLs like `/Products/Details/5` map naturally to controller and action names.

For APIs, conventional routing often falls short because RESTful URLs don't necessarily reflect controller and action names. An endpoint like `GET /api/products/5` doesn't clearly indicate whether it should route to a `Products` controller with a `Get` action or a `ProductsController` with a `Details` action.

### Attribute Routing

Attribute routing defines routes directly on controllers and actions using attributes. This approach provides explicit control over each endpoint's URL and is the preferred pattern for API development.

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() { }

    [HttpGet("{id}")]
    public IActionResult GetById(int id) { }

    [HttpPost]
    public IActionResult Create([FromBody] Product product) { }
}
```

The `[Route]` attribute at the controller level defines a base path for all actions in the controller. Action-level attributes like `[HttpGet]` combine with the controller route to form complete URL patterns. The `GetById` action above matches `GET /api/products/{id}` by combining the controller's base path with the action's `{id}` segment.

Attribute routing produces URLs that reflect resource structures rather than code organization. You can design RESTful endpoints that make sense to API consumers without being constrained by controller or action names.

### Route Templates

Route templates define URL patterns using a combination of literal segments and parameters. Parameters are denoted with curly braces and can include constraints that restrict what values match.

The template `api/products/{id:int}` matches URLs like `/api/products/5` but not `/api/products/abc` because the `int` constraint requires the ID parameter to be an integer. Constraints help route requests to the appropriate action when multiple routes share similar patterns.

**Common route constraints:**

| Constraint | Description | Example |
|------------|-------------|---------|
| `int` | Matches any integer | `{id:int}` |
| `guid` | Matches a GUID | `{id:guid}` |
| `bool` | Matches true or false | `{active:bool}` |
| `datetime` | Matches a DateTime value | `{date:datetime}` |
| `decimal` | Matches a decimal number | `{price:decimal}` |
| `double` | Matches a double-precision number | `{value:double}` |
| `long` | Matches a 64-bit integer | `{id:long}` |
| `minlength(n)` | String with minimum length | `{name:minlength(3)}` |
| `maxlength(n)` | String with maximum length | `{name:maxlength(50)}` |
| `length(n)` | String with exact length | `{code:length(5)}` |
| `min(n)` | Integer with minimum value | `{age:min(18)}` |
| `max(n)` | Integer with maximum value | `{quantity:max(100)}` |
| `range(min,max)` | Integer within range | `{month:range(1,12)}` |
| `alpha` | Matches alphabetic characters | `{code:alpha}` |
| `regex(pattern)` | Matches a regular expression | `{ssn:regex(^\\d{{3}}-\\d{{2}}-\\d{{4}}$)}` |

Constraints can be combined by separating them with colons. The template `{id:int:min(1)}` requires the ID to be an integer greater than or equal to 1.

### Route Tokens

Route templates support tokens that are replaced with actual values during route resolution. Tokens reduce duplication and make route templates more maintainable when controller or action names change.

**Available tokens:**

| Token | Replaced With | Example |
|-------|---------------|---------|
| `[controller]` | Controller name without "Controller" suffix | `ProductsController` → `products` |
| `[action]` | Action method name | `GetById` → `getbyid` |
| `[area]` | Area name | `Admin` → `admin` |

```csharp
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet("[action]")]
    public IActionResult Search() { }
}
```

The `Search` action matches the URL `/api/products/search` because `[controller]` is replaced with "products" and `[action]` is replaced with "search." Tokens maintain synchronization between code and routes without requiring manual updates when names change.

## Action Methods and Return Types

Action methods are public methods on controllers that handle HTTP requests. The method signature determines how parameters are bound and what response is returned.

### Synchronous vs Asynchronous Actions

Actions can be synchronous or asynchronous. Asynchronous actions return `Task` or `Task<T>` and allow the thread handling the request to be released while waiting for I/O operations to complete.

```csharp
// Synchronous action
[HttpGet("{id}")]
public IActionResult GetProduct(int id)
{
    var product = _repository.GetById(id);
    return Ok(product);
}

// Asynchronous action
[HttpGet("{id}")]
public async Task<IActionResult> GetProduct(int id)
{
    var product = await _repository.GetByIdAsync(id);
    return Ok(product);
}
```

Asynchronous actions improve scalability by allowing more requests to be processed concurrently. When an action awaits an asynchronous operation, the thread returns to the thread pool where it can serve other requests. Once the awaited operation completes, a thread picks up the action and continues execution.

Use asynchronous actions whenever your code performs I/O operations like database queries, file access, or HTTP calls to other services. The performance benefits are significant under load because threads aren't blocked waiting for external operations to complete.

### Return Type Patterns

ASP.NET Core supports three return type patterns for actions, each with different tradeoffs between type safety, flexibility, and documentation.

**Specific Types** return a concrete type directly from the action. The framework automatically wraps the returned object in a 200 OK response.

```csharp
[HttpGet]
public List<Product> GetAll()
{
    return _repository.GetAll();
}
```

This approach offers the strongest type safety and works well when the action always returns the same type with a 200 status code. However, it doesn't support returning different status codes or action results like `NotFound` or `BadRequest`.

**IActionResult** allows actions to return different types of results, including status codes, redirects, and formatted responses. This interface provides maximum flexibility when multiple return types or status codes are possible.

```csharp
[HttpGet("{id}")]
public IActionResult GetById(int id)
{
    var product = _repository.GetById(id);
    if (product == null)
        return NotFound();

    return Ok(product);
}
```

The `IActionResult` pattern supports all action result types through methods like `Ok()`, `NotFound()`, `BadRequest()`, and `StatusCode()`. The downside is that the return type doesn't indicate what success looks like, making the API harder to document and understand.

**ActionResult\<T\>** combines the benefits of specific types and `IActionResult`. It allows returning either the concrete type `T` or any `IActionResult`, providing both type safety and flexibility.

```csharp
[HttpGet("{id}")]
public ActionResult<Product> GetById(int id)
{
    var product = _repository.GetById(id);
    if (product == null)
        return NotFound();

    return product;
}
```

Implicit conversion operators allow you to return either a `Product` instance directly or an action result like `NotFound()`. The concrete type `T` appears in API documentation and OpenAPI specifications, making it clear what a successful response contains. `ActionResult<T>` is the recommended pattern for API actions because it provides type safety while supporting error responses.

When using `[ProducesResponseType]` attributes to document possible responses, `ActionResult<T>` reduces the need to specify the success response type since it's inferred from `T`. You still need to document error responses with attributes like `[ProducesResponseType(StatusCodes.Status404NotFound)]`.

## Model Binding

Model binding converts HTTP request data into strongly-typed .NET objects that actions can work with directly. The binding system examines action parameters and attempts to populate them from various sources in the HTTP request.

### Binding Sources

By default, model binding searches multiple locations for parameter values in a specific order. You can override this behavior with binding source attributes that explicitly indicate where values should come from.

**[FromQuery]** binds parameters from query string values. This is the default for simple types not appearing in the route template.

```csharp
[HttpGet("search")]
public IActionResult Search([FromQuery] string term, [FromQuery] int page = 1)
{
    // Matches: GET /api/products/search?term=laptop&page=2
}
```

Query string parameters work well for optional filtering, sorting, and pagination parameters that don't represent the core resource being accessed.

**[FromRoute]** binds parameters from route values. This is the default for parameters whose names appear in the route template.

```csharp
[HttpGet("{id}")]
public IActionResult GetById([FromRoute] int id)
{
    // Matches: GET /api/products/5
}
```

Route parameters typically represent resource identifiers and are part of the URL structure rather than optional query data.

**[FromBody]** binds complex parameters from the request body. This is the default for complex types when the `[ApiController]` attribute is present.

```csharp
[HttpPost]
public IActionResult Create([FromBody] Product product)
{
    // Expects JSON in request body:
    // { "name": "Laptop", "price": 999.99 }
}
```

Only one parameter per action can bind from the body. If you need to receive multiple complex objects, wrap them in a container type or use separate endpoints.

**[FromForm]** binds parameters from posted form fields. This is appropriate for traditional form submissions or file uploads with accompanying form data.

```csharp
[HttpPost("upload")]
public IActionResult Upload([FromForm] IFormFile file, [FromForm] string description)
{
    // Expects: Content-Type: multipart/form-data
}
```

Form binding is common when building endpoints that accept file uploads or integrate with traditional HTML forms.

**[FromHeader]** binds parameters from HTTP request headers.

```csharp
[HttpGet]
public IActionResult GetAll([FromHeader(Name = "X-API-Version")] string apiVersion)
{
    // Binds from: X-API-Version header
}
```

Header binding is useful for cross-cutting concerns like API versioning, correlation IDs, or authentication tokens that aren't part of the resource representation.

**[FromServices]** binds parameters from the dependency injection container rather than from the HTTP request.

```csharp
[HttpGet]
public IActionResult GetAll([FromServices] IProductRepository repository)
{
    return Ok(repository.GetAll());
}
```

While constructor injection is generally preferred for dependencies, `[FromServices]` is useful for dependencies needed by only a single action or when you want to make action-level dependencies explicit in the method signature.

### Custom Model Binders

Custom model binders handle specialized binding scenarios that the default binders don't support. You might create a custom binder to decrypt encrypted parameters, look up entities by alternate keys, or parse custom formats.

A custom model binder implements the `IModelBinder` interface, which defines a single asynchronous method:

```csharp
public class ProductIdBinder : IModelBinder
{
    public async Task BindModelAsync(ModelBindingContext bindingContext)
    {
        var value = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);

        if (value == ValueProviderResult.None)
        {
            return;
        }

        var stringValue = value.FirstValue;

        // Custom logic to parse or look up the model
        if (TryParseProductId(stringValue, out var productId))
        {
            bindingContext.Result = ModelBindingResult.Success(productId);
        }
        else
        {
            bindingContext.ModelState.AddModelError(
                bindingContext.ModelName,
                "Invalid product ID format");
        }
    }
}
```

The binder accesses request values through the `ValueProvider` and sets the binding result through `bindingContext.Result`. Setting `ModelState` errors allows validation to catch binding failures.

To apply a custom binder, use the `[ModelBinder]` attribute on the parameter or create a model binder provider that matches specific types:

```csharp
[HttpGet("{id}")]
public IActionResult GetById([ModelBinder(typeof(ProductIdBinder))] ProductId id)
{
}
```

Model binder providers implement `IModelBinderProvider` and return a binder instance when appropriate for the target type. Providers are registered in the MVC options during application startup and are evaluated in order until one returns a binder.

### Value Providers

Value providers extract data from specific parts of the HTTP request and make it available to model binders. The default value providers handle query strings, route data, form data, and other standard sources.

Custom value providers are needed when binding from non-standard sources like custom headers, cookies with specific formats, or encrypted request data. A value provider implements `IValueProvider` and returns values for specific keys:

```csharp
public class CustomHeaderValueProvider : IValueProvider
{
    private readonly IHeaderDictionary _headers;

    public CustomHeaderValueProvider(IHeaderDictionary headers)
    {
        _headers = headers;
    }

    public bool ContainsPrefix(string prefix)
    {
        return _headers.Keys.Any(k => k.StartsWith(prefix));
    }

    public ValueProviderResult GetValue(string key)
    {
        if (_headers.TryGetValue(key, out var value))
        {
            return new ValueProviderResult(value);
        }
        return ValueProviderResult.None;
    }
}
```

Value provider factories create value provider instances for each request and are registered with the MVC options. The factory examines the request and returns a provider if applicable:

```csharp
public class CustomHeaderValueProviderFactory : IValueProviderFactory
{
    public Task CreateValueProviderAsync(ValueProviderFactoryContext context)
    {
        var headers = context.ActionContext.HttpContext.Request.Headers;
        var valueProvider = new CustomHeaderValueProvider(headers);
        context.ValueProviders.Add(valueProvider);
        return Task.CompletedTask;
    }
}
```

Register the factory during startup by adding it to the value provider collection. Value providers run in the order they're registered, and model binders use the first provider that returns a value for a given key.

## Filters

Filters provide a way to run code before or after specific stages in the request processing pipeline. They handle cross-cutting concerns like authorization, caching, error handling, and logging without cluttering action methods with repetitive code.

### Filter Types and Execution Order

ASP.NET Core supports five filter types, each running at a different stage in the pipeline:

**Authorization filters** run first and determine whether the current user is authorized to access the requested resource. Authorization filters can short-circuit the pipeline by returning an immediate response, preventing unnecessary processing when authorization fails.

**Resource filters** run after authorization but before model binding. They can execute code before and after the rest of the pipeline, making them useful for caching scenarios where you want to return cached responses without performing model binding or executing actions. Resource filters can also short-circuit the pipeline.

**Action filters** run immediately before and after action methods execute, but after model binding completes. They have access to the action arguments and can modify them before the action runs. Action filters also see the action result before it executes, allowing them to modify or replace the result.

**Exception filters** run only when an unhandled exception occurs during action execution or while executing earlier filters. They provide a centralized place to handle exceptions and convert them into appropriate HTTP responses.

**Result filters** run before and after the execution of action results. They run only when the action executes successfully, not when earlier filters or actions short-circuit the pipeline. Result filters can modify how results are formatted or add headers to responses.

The complete execution order wraps like nested calls. Authorization filters run first, then resource filters, then action filters, then the action itself, then action filters again, then result filters, then the result execution, then result filters again, then resource filters again. Exception filters intercept any unhandled exceptions that occur during this process.

### Filter Scopes

Filters can be applied at three scopes: global, controller, and action. The scope determines which requests the filter affects.

**Global filters** apply to all controllers and actions in the application. They're registered during startup:

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add<GlobalExceptionFilter>();
});
```

Global filters handle application-wide concerns like security headers, request logging, or error handling that should apply consistently across all endpoints.

**Controller filters** apply to all actions within a specific controller. Apply them with attributes on the controller class:

```csharp
[ServiceFilter(typeof(ProductCacheFilter))]
public class ProductsController : ControllerBase
{
}
```

Controller-level filters handle concerns specific to a logical group of endpoints, such as caching for a particular resource type or validation that applies to all operations on a resource.

**Action filters** apply to individual actions and provide the most granular control:

```csharp
[HttpPost]
[ValidateProductFilter]
public IActionResult Create(Product product)
{
}
```

Action-level filters handle concerns unique to specific operations, such as validation rules that only apply to create or update operations.

When multiple filters of the same type are present, they execute in order from global to controller to action for before-phases and from action to controller to global for after-phases.

### Implementing Custom Filters

Custom filters implement one of several filter interfaces depending on what pipeline stage they need to affect. Action filters are the most commonly implemented.

Synchronous action filters implement `IActionFilter`:

```csharp
public class LoggingActionFilter : IActionFilter
{
    private readonly ILogger<LoggingActionFilter> _logger;

    public LoggingActionFilter(ILogger<LoggingActionFilter> logger)
    {
        _logger = logger;
    }

    public void OnActionExecuting(ActionExecutingContext context)
    {
        _logger.LogInformation("Executing action: {Action}",
            context.ActionDescriptor.DisplayName);
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        _logger.LogInformation("Executed action: {Action}",
            context.ActionDescriptor.DisplayName);
    }
}
```

Asynchronous filters implement async interfaces like `IAsyncActionFilter`:

```csharp
public class TimingActionFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        var stopwatch = Stopwatch.StartNew();

        var resultContext = await next();

        stopwatch.Stop();

        resultContext.HttpContext.Response.Headers.Add(
            "X-Elapsed-Time",
            stopwatch.ElapsedMilliseconds.ToString());
    }
}
```

The `next` delegate represents the rest of the pipeline. Calling it executes the action and any subsequent filters. Code before `await next()` runs before the action, while code after runs after the action completes.

Exception filters implement `IExceptionFilter` or `IAsyncExceptionFilter`:

```csharp
public class BusinessExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is BusinessException businessEx)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Business rule violation",
                Detail = businessEx.Message
            });

            context.ExceptionHandled = true;
        }
    }
}
```

Setting `ExceptionHandled` to true prevents the exception from propagating further. If you don't set this property, the exception continues up the pipeline where it might be handled by middleware or result in an unhandled exception response.

Filters can receive dependencies through constructor injection when registered as service filters:

```csharp
[ServiceFilter(typeof(LoggingActionFilter))]
public class ProductsController : ControllerBase
{
}
```

The `ServiceFilter` attribute resolves the filter from the dependency injection container, allowing it to receive injected dependencies. The filter type must be registered in the container during startup.

## Content Negotiation

Content negotiation allows clients to specify their preferred response format through the `Accept` header, and the server returns the response in that format when possible. This enables APIs to support multiple formats like JSON, XML, or custom types without duplicating action methods.

### How Content Negotiation Works

When an action returns an object, the framework examines the `Accept` header in the request to determine what format the client prefers. It then searches through registered output formatters to find one that can produce the requested format. If a matching formatter is found, the formatter serializes the response. If no formatter matches, the framework uses the first configured formatter by default.

By default, ASP.NET Core includes a JSON formatter that serializes responses using `System.Text.Json`. The framework automatically serializes objects returned from actions into JSON without explicit configuration.

### Adding XML Support

To support XML responses in addition to JSON, add the XML formatters during service configuration:

```csharp
builder.Services.AddControllers()
    .AddXmlSerializerFormatters();
```

This registers formatters that can serialize responses using `XmlSerializer`. Clients can now request XML by sending an `Accept: application/xml` header. Without this header, the API continues returning JSON as the default format.

Configure the `RespectBrowserAcceptHeader` option to ensure the framework honors the `Accept` header:

```csharp
builder.Services.AddControllers(options =>
{
    options.RespectBrowserAcceptHeader = true;
});
```

By default, when no `Accept` header is present or no formatter matches, the framework uses the first registered formatter. You can change formatter order to control which format is used as the default.

### Custom Formatters

Custom formatters handle specialized formats not supported by the built-in formatters. You might create a custom formatter to support CSV exports, custom binary protocols, or domain-specific formats.

Output formatters derive from `TextOutputFormatter` for text-based formats or `OutputFormatter` for binary formats:

```csharp
public class CsvOutputFormatter : TextOutputFormatter
{
    public CsvOutputFormatter()
    {
        SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse("text/csv"));
        SupportedEncodings.Add(Encoding.UTF8);
    }

    protected override bool CanWriteType(Type type)
    {
        return typeof(IEnumerable<Product>).IsAssignableFrom(type);
    }

    public override async Task WriteResponseBodyAsync(
        OutputFormatterWriteContext context,
        Encoding selectedEncoding)
    {
        var response = context.HttpContext.Response;
        var products = (IEnumerable<Product>)context.Object;

        await using var writer = new StreamWriter(response.Body, selectedEncoding);
        await writer.WriteLineAsync("Id,Name,Price");

        foreach (var product in products)
        {
            await writer.WriteLineAsync($"{product.Id},{product.Name},{product.Price}");
        }
    }
}
```

The formatter declares which media types it supports and which .NET types it can serialize. The `WriteResponseBodyAsync` method performs the actual serialization, writing directly to the response stream.

Register custom formatters during service configuration:

```csharp
builder.Services.AddControllers(options =>
{
    options.OutputFormatters.Insert(0, new CsvOutputFormatter());
});
```

Inserting at index 0 makes the custom formatter the highest priority during content negotiation. If the client sends `Accept: text/csv`, your formatter handles the response. The position in the collection determines the default format when no specific format is requested.

Input formatters work similarly but derive from `TextInputFormatter` or `InputFormatter` and implement `ReadRequestBodyAsync` to deserialize request bodies into .NET objects.

## File Uploads and Downloads

APIs frequently need to accept file uploads from clients or stream file downloads in responses. ASP.NET Core provides specialized support for handling files efficiently.

### File Uploads with IFormFile

The `IFormFile` interface represents a file uploaded in an HTTP request with multipart/form-data encoding. It provides access to file metadata like the filename, content type, and length, along with methods to read the file content.

```csharp
[HttpPost("upload")]
public async Task<IActionResult> Upload(IFormFile file)
{
    if (file == null || file.Length == 0)
        return BadRequest("No file uploaded");

    var filePath = Path.Combine("uploads", file.FileName);

    await using var stream = new FileStream(filePath, FileMode.Create);
    await file.CopyToAsync(stream);

    return Ok(new { file.FileName, file.Length });
}
```

The `CopyToAsync` method copies the uploaded file to a target stream. This approach buffers the entire file in memory or in a temporary location before copying, making it suitable for smaller files.

When accepting multiple files, use `IFormFileCollection` or a list of `IFormFile`:

```csharp
[HttpPost("upload-multiple")]
public async Task<IActionResult> UploadMultiple(List<IFormFile> files)
{
    foreach (var file in files)
    {
        // Process each file
    }
    return Ok();
}
```

For large file uploads, buffering the entire file can exhaust server resources. In these scenarios, use streaming to process the file as it arrives:

```csharp
[HttpPost("upload-stream")]
[DisableFormValueModelBinding]
public async Task<IActionResult> UploadStream()
{
    var boundary = Request.GetMultipartBoundary();
    var reader = new MultipartReader(boundary, Request.Body);

    var section = await reader.ReadNextSectionAsync();
    while (section != null)
    {
        var fileSection = section.AsFileSection();
        if (fileSection != null)
        {
            await using var stream = fileSection.FileStream;
            // Process stream without buffering entire file
        }
        section = await reader.ReadNextSectionAsync();
    }

    return Ok();
}
```

Streaming processes the file content directly from the request body without buffering it entirely in memory. This approach is more complex but essential for handling uploads that might exceed available memory.

Always validate uploaded files before processing them. Check file size limits, verify content types, scan for malicious content, and sanitize filenames to prevent security vulnerabilities.

### File Downloads

Returning files from APIs can be done through several action result types depending on whether the file exists on disk, in memory, or needs to be generated on demand.

The `PhysicalFileResult` streams a file from the file system:

```csharp
[HttpGet("download/{filename}")]
public IActionResult Download(string filename)
{
    var filePath = Path.Combine("files", filename);

    if (!System.IO.File.Exists(filePath))
        return NotFound();

    return PhysicalFile(filePath, "application/octet-stream", filename);
}
```

The `PhysicalFile` method returns a result that streams the file content directly from disk. The second parameter specifies the content type, while the third parameter sets the download filename shown to the user.

For files generated in memory, use `FileContentResult`:

```csharp
[HttpGet("report")]
public IActionResult GetReport()
{
    var reportData = GenerateReport();
    return File(reportData, "application/pdf", "report.pdf");
}
```

The `File` method with a byte array creates a result that sends the content directly from memory. This works well for dynamically generated content like reports or images.

For large files or content generated on the fly, stream the response directly:

```csharp
[HttpGet("large-file")]
public async Task<IActionResult> GetLargeFile()
{
    var stream = await GenerateLargeContentAsync();
    return File(stream, "application/octet-stream", "large-file.dat");
}
```

The stream is consumed and sent to the client as it's generated, avoiding the need to hold the entire file in memory. The framework automatically disposes of the stream after the response completes.

When streaming large responses, set appropriate buffer sizes and consider implementing range request support to allow clients to resume interrupted downloads. The `FileStreamResult` supports range requests automatically when the underlying stream supports seeking.

## Common Patterns and Best Practices

### RESTful Endpoint Design

Structure endpoints around resources rather than actions. Use HTTP verbs to indicate the operation and URL paths to identify the resource:

- `GET /api/products` retrieves all products
- `GET /api/products/5` retrieves a specific product
- `POST /api/products` creates a new product
- `PUT /api/products/5` updates an existing product
- `DELETE /api/products/5` deletes a product

Avoid encoding actions in URLs like `/api/products/get` or `/api/products/update/5`. The HTTP verb already indicates the action.

### Async/Await Throughout

Use asynchronous methods consistently across the entire request path. An async action that calls synchronous repository methods wastes the benefits of async by blocking a thread pool thread in the repository layer. Similarly, synchronous actions that call async methods with `.Result` or `.Wait()` can cause deadlocks and defeat the purpose of async code.

### Validation in Multiple Layers

Model validation through data annotations catches basic problems like required fields and format issues, but business rules often require deeper validation. Implement business rule validation in a service layer that runs after model binding but before the core business logic executes:

```csharp
[HttpPost]
public async Task<ActionResult<Product>> Create(Product product)
{
    var validationResult = await _validator.ValidateAsync(product);
    if (!validationResult.IsValid)
        return BadRequest(validationResult.Errors);

    var created = await _service.CreateAsync(product);
    return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
}
```

This separates technical validation (correct format) from business validation (valid according to business rules) while keeping controllers focused on HTTP concerns.

### Consistent Error Responses

Return problem details for all error responses to provide a consistent structure that clients can parse reliably. The `[ApiController]` attribute enables this by default for validation errors, but you should apply the same pattern to business rule violations and unexpected errors through exception filters or explicit problem details responses.

### Resource-Based Authorization

Implement authorization at both the endpoint level through authorization filters and at the resource level within actions. Endpoint-level authorization ensures the user has general permission to access a type of resource, while resource-level authorization checks whether they can access a specific instance:

```csharp
[HttpGet("{id}")]
[Authorize]
public async Task<ActionResult<Product>> GetById(int id)
{
    var product = await _repository.GetByIdAsync(id);
    if (product == null)
        return NotFound();

    if (!await _authService.CanAccessAsync(User, product))
        return Forbid();

    return product;
}
```

This pattern prevents unauthorized users from discovering whether resources exist by distinguishing between "not found" and "forbidden" responses.

## Sources

- [Create web APIs with ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-9.0){:target="_blank" rel="noopener noreferrer"}
- [ApiControllerAttribute Class](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.apicontrollerattribute?view=aspnetcore-9.0){:target="_blank" rel="noopener noreferrer"}
- [Controller action return types in ASP.NET Core web API](https://learn.microsoft.com/en-us/aspnet/core/web-api/action-return-types?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Routing in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/routing?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Routing to controller actions in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/controllers/routing?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Model Binding in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/model-binding?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Custom Model Binding in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/advanced/custom-model-binding?view=aspnetcore-9.0){:target="_blank" rel="noopener noreferrer"}
- [Filters in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/controllers/filters?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Format response data in ASP.NET Core Web API](https://learn.microsoft.com/en-us/aspnet/core/web-api/advanced/formatting?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
- [Upload files in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads?view=aspnetcore-10.0){:target="_blank" rel="noopener noreferrer"}
