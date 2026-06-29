---
title: "API Versioning and OpenAPI"
layout: guide
category: "ASP.NET Core"
subcategory: "API Design & Data"
description: "Comprehensive guide to API versioning strategies and OpenAPI document generation in ASP.NET Core, covering the Asp.Versioning package, OpenAPI 3.1 support, transformers, and client SDK generation."
tags: [asp-net-core, api-design, versioning, openapi, documentation, code-generation]
---

## API Evolution at Scale

APIs must evolve while maintaining compatibility with existing clients. Versioning provides a structured path for introducing breaking changes without forcing all consumers to update simultaneously. OpenAPI document generation turns your API code into machine-readable specifications that enable tooling, testing, and client generation. Together, these capabilities transform API development from manual coordination into automated workflows where contracts drive implementation.

This guide covers API versioning strategies, the Asp.Versioning package for both controllers and minimal APIs, OpenAPI document generation with Microsoft.AspNetCore.OpenApi, schema customization through transformers, and generating client SDKs from OpenAPI specifications.

## Understanding API Versioning

API versioning allows multiple versions of the same API to coexist. When you introduce breaking changes like removing properties, changing response structures, or altering behavior, versioning lets existing clients continue using the old version while new clients adopt the new one. Without versioning, every breaking change forces all consumers to update simultaneously, which becomes impossible as your API scales beyond a handful of internal services.

Versioning creates a contract between API and client. The client specifies which version it expects, and the server routes the request to the appropriate implementation. This decouples deployment cycles and allows gradual migration rather than coordinated big-bang updates across all consumers.

### When to Version

Not every API change requires a new version. Additive changes like new optional properties, new endpoints, or additional query parameters typically maintain backward compatibility. Clients that don't know about new features simply ignore them. Breaking changes require new versions. These include removing properties, renaming fields, changing data types, altering validation rules, or modifying error responses in ways that clients depend on.

The threshold for what constitutes a breaking change depends on your API contract. If you document that response bodies may include additional fields clients should ignore, adding fields isn't breaking. If clients expect strict schema validation, it might be. The key is establishing clear compatibility rules upfront and applying them consistently.

### Versioning Strategy Trade-offs

ASP.NET Core supports four primary versioning strategies. Each trades off between visibility, simplicity, and RESTful purity.

URL path versioning embeds the version in the route itself, such as `/api/v1/products` versus `/api/v2/products`. This approach makes the version explicit and visible in logs, browser history, and documentation. URLs change between versions, which violates REST principles that resources should have stable identifiers, but the pragmatic benefits often outweigh theoretical concerns. URL path versioning works well for public APIs where discoverability and clarity matter more than REST purity.

Query string versioning appends the version as a parameter like `/api/products?api-version=1.0`. This keeps URLs stable while allowing version selection. Browsers and tools make it easy to test different versions by changing a query parameter. The downside is that caching layers might ignore query parameters, causing version confusion if cache keys don't account for the version parameter. Query string versioning suits scenarios where URL stability matters but you don't want versioning in the path.

Header versioning sends the version in a custom HTTP header such as `api-version: 1.0`. This separates versioning from the URL entirely, keeping resources stable and RESTful. The cost is reduced visibility since headers don't appear in browser address bars or casual logs. Header versioning works best for service-to-service APIs where clients are sophisticated enough to manage custom headers and REST principles are valued.

Media type versioning uses content negotiation to specify versions, like `Accept: application/vnd.myapi.v1+json`. This is the most RESTful approach because it treats different versions as different representations of the same resource. The complexity comes from managing custom media types and teaching clients to use them correctly. Media type versioning fits scenarios where you're deeply committed to REST principles and have control over client implementations.

You can combine strategies, and the Asp.Versioning package supports reading versions from multiple sources simultaneously, falling back through query string, header, and media type until it finds a version. This flexibility helps during transitions but adds complexity.

## Configuring the Asp.Versioning Package

The Asp.Versioning package provides versioning infrastructure for ASP.NET Core. Two NuGet packages exist: `Asp.Versioning.Mvc` for controller-based APIs and `Asp.Versioning.Http` for minimal APIs. Both packages share core abstractions but differ in how they integrate with the hosting model.

Adding API versioning starts with registering services and configuring options. The options control default behavior when clients don't specify a version, which versioning strategies to accept, and how to report available versions.

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;

    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new QueryStringApiVersionReader("api-version"),
        new HeaderApiVersionReader("api-version"),
        new MediaTypeApiVersionReader("v")
    );
});
```

The `DefaultApiVersion` defines which version unversioned clients receive. Setting `AssumeDefaultVersionWhenUnspecified` to true means requests without version information default to the specified version rather than failing. This simplifies adoption for clients that haven't implemented versioning yet but can mask issues where clients should be specifying versions explicitly.

Enabling `ReportApiVersions` adds response headers listing supported and deprecated versions. The `api-supported-versions` header shows currently active versions, while `api-deprecated-versions` lists versions marked for removal. These headers help clients discover available versions and plan migrations.

The `ApiVersionReader` determines how the framework extracts version information from requests. Using `ApiVersionReader.Combine` allows multiple strategies simultaneously, checking URL segments first, then query strings, headers, and finally media types. This flexibility supports gradual transitions between versioning strategies.

## Versioning in Controller-Based APIs

Controller-based APIs use attributes to declare which versions a controller or action supports. The `[ApiVersion]` attribute marks supported versions, while `[MapToApiVersion]` maps specific actions to versions.

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
public class ProductsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetV1()
    {
        return Ok(new { Version = "1.0", Data = "..." });
    }

    [HttpGet]
    [MapToApiVersion("2.0")]
    public IActionResult GetV2()
    {
        return Ok(new { Version = "2.0", Data = "...", NewField = "..." });
    }
}
```

The route template includes `{version:apiVersion}` as a placeholder that accepts version values and participates in routing. When a request arrives for `/api/v2.0/products`, the framework extracts `2.0` as the version and routes to actions marked with `[MapToApiVersion("2.0")]`. If no action maps explicitly to that version, any action supporting that version via `[ApiVersion]` becomes a candidate.

Separate controllers per version offer an alternative to multiple actions within one controller. This approach isolates version-specific logic and simplifies understanding what each version does.

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/products")]
[ApiVersion("1.0")]
public class ProductsV1Controller : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { Version = "1.0" });
}

[ApiController]
[Route("api/v{version:apiVersion}/products")]
[ApiVersion("2.0")]
public class ProductsV2Controller : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { Version = "2.0" });
}
```

Separate controllers reduce conditional logic within actions but increase the number of classes. Which approach works better depends on how much code differs between versions. If versions share most logic, keeping them in one controller with shared private methods makes sense. If versions diverge significantly, separate controllers clarify boundaries.

## Versioning in Minimal APIs

Minimal APIs use a fluent API and version sets to define versioned endpoints. Version sets group related endpoints under a common versioning scheme.

```csharp
var versionSet = app.NewApiVersionSet()
    .HasApiVersion(new ApiVersion(1, 0))
    .HasApiVersion(new ApiVersion(2, 0))
    .ReportApiVersions()
    .Build();

app.MapGet("/api/v{version:apiVersion}/products", () =>
{
    return Results.Ok(new { Version = "1.0", Data = "..." });
})
.WithApiVersionSet(versionSet)
.MapToApiVersion(1, 0);

app.MapGet("/api/v{version:apiVersion}/products", () =>
{
    return Results.Ok(new { Version = "2.0", Data = "...", NewField = "..." });
})
.WithApiVersionSet(versionSet)
.MapToApiVersion(2, 0);
```

Defining version sets once and reusing them across multiple endpoints reduces duplication. Route groups simplify applying version sets to many endpoints simultaneously.

```csharp
var productsGroup = app.MapGroup("/api/v{version:apiVersion}/products")
    .WithApiVersionSet(versionSet);

productsGroup.MapGet("", () =>
    Results.Ok(new { Version = "1.0" }))
    .MapToApiVersion(1, 0);

productsGroup.MapGet("", () =>
    Results.Ok(new { Version = "2.0" }))
    .MapToApiVersion(2, 0);
```

Route groups also enable applying common policies like authorization or rate limiting to all versioned endpoints in the group. This reduces boilerplate and ensures consistency across versions.

## Deprecating API Versions

Deprecation signals that a version will stop being supported in the future. Marking a version as deprecated doesn't remove it; it tells clients to plan migration while maintaining backward compatibility during a transition period.

Controller-based APIs mark versions deprecated using the `Deprecated` property on the `[ApiVersion]` attribute.

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0", Deprecated = true)]
[ApiVersion("2.0")]
public class ProductsController : ControllerBase
{
    // Implementation
}
```

Minimal APIs use the `HasDeprecatedApiVersion` method when defining version sets.

```csharp
var versionSet = app.NewApiVersionSet()
    .HasDeprecatedApiVersion(new ApiVersion(1, 0))
    .HasApiVersion(new ApiVersion(2, 0))
    .Build();
```

When `ReportApiVersions` is enabled, responses include an `api-deprecated-versions` header listing deprecated versions. Monitoring logs for usage of deprecated versions helps identify clients that need to migrate before you remove support.

Deprecation works best with a clear timeline. Communicate when a version becomes deprecated and when it will be removed. A common pattern is to support deprecated versions for six months or through the next major release, giving clients time to test migrations without indefinite support burdens.

Removing a version after deprecation means deleting the controller or endpoints supporting that version. Once removed, requests for that version return 400 Bad Request responses indicating the requested version doesn't exist.

## OpenAPI Document Generation

OpenAPI specifications describe REST APIs in a machine-readable format. They document endpoints, request parameters, response schemas, authentication requirements, and error codes. Tooling consumes OpenAPI documents to generate client SDKs, interactive documentation UIs, and automated tests.

Starting with .NET 9, ASP.NET Core includes built-in OpenAPI support through the `Microsoft.AspNetCore.OpenApi` package. This replaces third-party tools like Swashbuckle for document generation. The built-in support works with both controller-based and minimal APIs, supports trimming and Native AOT, and integrates directly with the framework rather than relying on reflection-heavy external libraries.

Enabling OpenAPI document generation involves calling `AddOpenApi` during service registration and `MapOpenApi` to expose the generated document at runtime.

```csharp
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi();
```

By default, this exposes the OpenAPI document at `/openapi/v1.json`. The endpoint returns a JSON document conforming to the OpenAPI 3.1 specification. You can configure the endpoint path and document name through options.

### OpenAPI 3.1 Support

.NET 10 defaults to OpenAPI 3.1, which aligns with the latest specification and supports JSON Schema draft 2020-12. OpenAPI 3.1 unifies schema definitions, improves schema reusability, and supports modern JSON Schema features like `oneOf`, `anyOf`, and `allOf` without limitations present in OpenAPI 3.0.

If you need OpenAPI 3.0 for compatibility with older tooling, you can configure the version explicitly.

```csharp
builder.Services.AddOpenApi(options =>
{
    options.OpenApiVersion = OpenApiSpecVersion.OpenApi3_0;
});
```

The underlying OpenAPI.NET library updated to version 2.0 to support OpenAPI 3.1. This update includes breaking changes where `OpenApiAny` is replaced by `JsonNode` for schema examples and default values. If you have custom transformers using `OpenApiAny`, you'll need to update them to work with `JsonNode` instead.

### Multiple OpenAPI Documents

Applications often expose multiple APIs or group endpoints logically, such as public versus internal APIs or different API versions. You can generate separate OpenAPI documents for each group.

```csharp
builder.Services.AddOpenApi("public");
builder.Services.AddOpenApi("internal");

app.MapOpenApi("/openapi/public/v1.json")
    .WithName("public");
app.MapOpenApi("/openapi/internal/v1.json")
    .WithName("internal");
```

Endpoints declare which OpenAPI document they belong to using metadata.

```csharp
app.MapGet("/api/products", () => Results.Ok())
    .WithOpenApi()
    .WithName("public");

app.MapGet("/admin/settings", () => Results.Ok())
    .WithOpenApi()
    .WithName("internal");
```

This capability supports scenarios where different audiences need different documentation or where you want to avoid exposing internal endpoints in public-facing OpenAPI documents.

## Including Metadata in OpenAPI Documents

OpenAPI documents derive basic information from route definitions and parameter types, but rich documentation requires additional metadata describing request parameters, response types, and endpoint summaries.

### XML Documentation Comments

XML documentation comments provide descriptions that appear in the generated OpenAPI document. Enabling XML comment processing requires configuring the project to generate XML documentation files at build time.

```xml
<PropertyGroup>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
</PropertyGroup>
```

With XML generation enabled, comments written above controllers, actions, and parameters flow into the OpenAPI document automatically.

```csharp
/// <summary>
/// Retrieves all products from the catalog.
/// </summary>
/// <param name="category">Optional category filter.</param>
/// <returns>List of products.</returns>
[HttpGet]
public IActionResult GetProducts(string? category)
{
    // Implementation
}
```

The source generator extracts XML comments at compile time and injects metadata into the runtime without reflection. This approach works with Native AOT and trimming because all processing happens during compilation.

XML comments support tags like `<summary>`, `<param>`, `<returns>`, `<remarks>`, and `<example>`. Tags referencing other types like `<see cref="OtherType"/>` are converted to plain text in the OpenAPI document since OpenAPI doesn't support cross-references in the same way.

### Response Type Annotations

The `[ProducesResponseType]` attribute describes the type and status code of responses. This information appears in the OpenAPI document as possible responses for an endpoint.

```csharp
[HttpGet("{id}")]
[ProducesResponseType<Product>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public IActionResult GetProduct(int id)
{
    var product = FindProduct(id);
    return product == null ? NotFound() : Ok(product);
}
```

Minimal APIs use the `Produces` extension method to achieve the same effect.

```csharp
app.MapGet("/api/products/{id}", (int id) =>
{
    var product = FindProduct(id);
    return product == null ? Results.NotFound() : Results.Ok(product);
})
.Produces<Product>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);
```

Documenting all possible responses helps clients handle success and error cases correctly. When multiple status codes return different schemas, specifying each one ensures the generated OpenAPI document includes all response types.

## Customizing OpenAPI Documents with Transformers

Transformers modify OpenAPI documents after initial generation. They enable adding descriptions, adjusting schemas, injecting security requirements, or restructuring the document based on conventions.

Three transformer types exist, each operating at different scopes. Document transformers modify the entire document and have access to all operations and schemas. Operation transformers target individual endpoints and can adjust parameters, responses, or operation metadata. Schema transformers handle individual schema definitions, allowing type-level customizations like changing property names or adding validation constraints.

### Document Transformers

Document transformers implement `IOpenApiDocumentTransformer` and run after the framework generates the base document.

```csharp
public class AddSecurityTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        document.Info.Title = "My API";
        document.Info.Version = "v1";
        document.Info.Description = "Production API for...";

        return Task.CompletedTask;
    }
}

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<AddSecurityTransformer>();
});
```

Document transformers access the full OpenAPI object model. You can iterate through paths, add global security schemes, inject servers, or apply conventions across all operations. Common uses include adding API keys to security definitions, setting contact information, or grouping operations by tags.

### Operation Transformers

Operation transformers implement `IOpenApiOperationTransformer` and run for each endpoint individually.

```csharp
public class AddResponseHeadersTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        foreach (var response in operation.Responses.Values)
        {
            response.Headers ??= new Dictionary<string, OpenApiHeader>();
            response.Headers["X-Request-Id"] = new OpenApiHeader
            {
                Description = "Unique request identifier",
                Schema = new OpenApiSchema { Type = "string" }
            };
        }

        return Task.CompletedTask;
    }
}
```

Operation transformers are useful for endpoint-specific customizations based on metadata. For instance, you might read custom attributes from the endpoint and use them to set descriptions, adjust parameters, or add headers that the default generation didn't capture.

### Schema Transformers

Schema transformers implement `IOpenApiSchemaTransformer` and apply to schemas for request and response bodies.

```csharp
public class AddExampleTransformer : IOpenApiSchemaTransformer
{
    public Task TransformAsync(
        OpenApiSchema schema,
        OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        if (context.JsonTypeInfo.Type == typeof(Product))
        {
            schema.Example = JsonNode.Parse(@"{
                ""id"": 1,
                ""name"": ""Example Product"",
                ""price"": 29.99
            }");
        }

        return Task.CompletedTask;
    }
}
```

Schema transformers enable type-level conventions such as adding examples, adjusting property formats, or renaming properties without changing your C# models. They run once per schema, not per endpoint, which improves performance when the same type appears in multiple operations.

The context passed to transformers includes a `GetOrCreateSchemaAsync` method in .NET 10. This allows generating schemas for additional types and adding them to the document dynamically, which is helpful for polymorphic scenarios or when you need to reference types not directly used in endpoint signatures.

## Interactive API Documentation

OpenAPI documents become valuable when visualized through interactive UIs that let developers explore and test endpoints. Starting with .NET 9, ASP.NET Core no longer includes Swagger UI by default, but you can integrate lightweight alternatives like Scalar or continue using Swagger UI through the Swashbuckle package.

### Scalar Integration

Scalar is an open-source interactive documentation UI built for OpenAPI. It provides a modern interface with built-in themes, syntax highlighting, example requests in multiple languages, and a test console for sending live requests.

Integrating Scalar involves adding the `Scalar.AspNetCore` package and calling `MapScalarApiReference`.

```csharp
app.MapOpenApi();
app.MapScalarApiReference();
```

By default, Scalar serves its UI at `/scalar/v1`, consuming the OpenAPI document from the `/openapi/v1.json` endpoint. Developers navigating to `/scalar/v1` see the full API documentation with expandable sections for each endpoint, editable request bodies, and response previews.

Scalar supports customization through options, including themes, authentication presets, and display preferences. The UI adapts to screen sizes and works well on mobile devices, which helps when testing APIs remotely.

### Swagger UI

If you prefer Swagger UI, the Swashbuckle package still works with .NET 9 and later. After adding the `Swashbuckle.AspNetCore` package, configure it to consume the built-in OpenAPI document rather than generating its own.

```csharp
builder.Services.AddSwaggerGen();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/openapi/v1.json", "v1");
});
```

Swagger UI remains widely recognized and familiar to many developers. The trade-off is additional dependencies and slightly heavier runtime overhead compared to Scalar's minimal footprint.

## Generating Client SDKs from OpenAPI Specifications

OpenAPI documents enable automated client generation, eliminating manual HTTP plumbing and ensuring clients stay synchronized with API changes. Two primary tools exist for generating .NET clients: NSwag and Kiota.

### NSwag

NSwag generates strongly-typed C# clients from OpenAPI specifications. It produces code that includes models, request builders, and HTTP client wrappers with full IntelliSense support.

NSwag integrates with MSBuild, allowing client generation during compilation whenever the OpenAPI document changes. This ensures clients reflect the latest API shape without manual updates.

```xml
<ItemGroup>
    <OpenApiReference Include="openapi.json"
                      CodeGenerator="NSwagCSharp"
                      Namespace="MyApi.Client" />
</ItemGroup>
```

The generated client exposes methods matching API endpoints, handles serialization and deserialization, and propagates errors from HTTP responses into exceptions. NSwag supports customization through configuration files that control naming conventions, whether to use synchronous or asynchronous methods, and how to handle optional parameters.

NSwag works well for internal APIs where you control both server and client and want tight integration with minimal manual code. The generated clients are comprehensive but can be verbose, especially for large APIs.

### Kiota

Kiota is Microsoft's newer client generator, designed for clarity and modern .NET patterns. It generates lighter-weight clients than NSwag by focusing on request builders and fluent APIs rather than generating full method signatures for every endpoint.

Kiota operates through a command-line tool that searches for OpenAPI documents, downloads them, and generates clients.

```bash
kiota search MyApi
kiota download --url https://api.example.com/openapi/v1.json
kiota generate --language CSharp --namespace MyApi.Client
```

The generated code uses request builders that allow constructing API calls fluently. This approach reduces generated code size and improves readability when working with complex query parameters or headers.

Kiota produces clients compatible with Microsoft Graph SDK patterns, making it a natural choice if you're already using Graph or prefer fluent builder syntax over method-heavy clients. The trade-off is less familiarity compared to NSwag's traditional approach.

### Choosing a Client Generator

NSwag suits scenarios where you want comprehensive, method-based clients and tight integration with MSBuild. It works well for internal service-to-service communication and rapid prototyping where developer convenience outweighs client size.

Kiota fits when you prioritize clean generated code, modern patterns, and compatibility with Microsoft's latest API client conventions. It excels for public APIs or libraries where the client code will be reviewed or extended by others.

Both tools keep clients synchronized with OpenAPI specs. The key is establishing a workflow where OpenAPI documents update automatically as the API evolves, triggering client regeneration and surfacing breaking changes during development rather than at runtime.

## OpenAPI in Native AOT Applications

Native AOT compiles applications to native binaries without a runtime JIT compiler. This reduces startup time, memory usage, and deployment size but restricts runtime code generation and reflection.

The built-in OpenAPI support in .NET 9 and later works with Native AOT because it uses source generators instead of reflection. Schemas and metadata are computed at compile time, avoiding the reflection-based inspection that breaks under AOT constraints.

Enabling OpenAPI in Native AOT applications follows the same patterns as normal applications. The framework detects AOT compatibility and adjusts how it processes types.

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddOpenApi();

var app = builder.Build();
app.MapOpenApi();
```

Custom transformers remain compatible with AOT as long as they don't rely on runtime reflection. If a transformer uses `Type.GetProperties()` or similar reflection APIs, it will fail at runtime in an AOT-compiled application. Using the source-generated `JsonTypeInfo` provided by the transformer context instead of reflection maintains AOT compatibility.

Trimming also affects OpenAPI generation. The trimmer removes unused code, which can eliminate types referenced indirectly through generic parameters or interface implementations. Annotating types with `[DynamicallyAccessedMembers]` or disabling trimming for specific assemblies prevents unintended removal of types needed for OpenAPI schema generation.

## Red Flags and Common Pitfalls

Versioning without deprecation policies creates confusion. Clients don't know whether old versions will remain supported indefinitely or disappear without warning. Establish and communicate timelines for deprecation and removal upfront.

Failing to test all active versions ensures breaking changes slip into older versions unnoticed. Automated tests should cover all supported versions, not just the latest. Deprecating a version doesn't mean ignoring it; clients relying on deprecated versions expect stability until removal.

Combining too many versioning strategies complicates debugging. Supporting URL path, query string, header, and media type versioning simultaneously means understanding which strategy a particular client uses when issues arise. Choose one primary strategy and add others only if specific clients require them.

Overusing versioning fragments APIs unnecessarily. If changes are backward compatible, don't version. Introducing a new version for every minor change creates maintenance burdens and confuses clients about which version they should use. Version intentionally, not reflexively.

Generating OpenAPI documents without response type annotations produces incomplete specs. Clients generated from these documents lack proper error handling because they don't know about 404, 400, or 500 responses. Annotating all possible responses creates accurate documentation and better client code.

Modifying OpenAPI documents manually instead of using transformers creates drift. Manual edits disappear when the document regenerates, forcing repeated fixes. Transformers codify customizations and apply them consistently every time the document updates.

Ignoring OpenAPI validation tools allows invalid documents to reach consumers. Validators catch schema issues, missing descriptions, and structural problems before clients attempt to generate code. Integrating validation into CI pipelines prevents bad documents from propagating.

Using reflection in transformers breaks Native AOT compatibility. If your application targets AOT, ensure transformers use source-generated types and avoid reflection APIs. Testing AOT compatibility locally catches issues before deployment.

Failing to version OpenAPI documents themselves confuses clients. If your API evolves and the OpenAPI document structure changes, clients consuming those documents need to know whether their tooling remains compatible. Versioning the OpenAPI endpoint path like `/openapi/v1.json` and `/openapi/v2.json` signals changes to consumers.
