---
title: "API Versioning and OpenAPI"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Versioning ASP.NET Core APIs with Asp.Versioning for controllers and minimal APIs, deprecation and sunset policies, generating OpenAPI documents with Microsoft.AspNetCore.OpenApi, per-version and per-audience documents, transformers, build-time generation, documentation UIs, and client generation."
tags: [practical, api-versioning, openapi, deprecation, openapi-transformers, client-generation]
---

## Versioning an API

A version lets an API make a breaking change, such as removing a field, renaming one, or changing a type, while existing clients keep calling the old shape. Additive changes, such as a new optional field or a new endpoint, don't need one as long as clients ignore fields they don't recognize. Versioning costs something for every version kept alive, so an API versions when a change would break clients, not for every release.

The client has to say which version it wants, and there are four places to put it. Choosing between them is an API design decision more than an ASP.NET Core one, so this table records only what each looks like in the library covered below:

| Version travels in | Example | Asp.Versioning reader | Consequence |
| --- | --- | --- | --- |
| URL path | `/api/v2/orders` | `UrlSegmentApiVersionReader` | Visible everywhere, and each version is a different URL |
| Query string | `/api/orders?api-version=2.0` | `QueryStringApiVersionReader` | Same path for every version. Caches must key on the query string |
| Header | `api-version: 2.0` | `HeaderApiVersionReader` | Clean URLs, invisible in links and browser address bars |
| Media type | `Accept: application/json;v=2.0` | `MediaTypeApiVersionReader` | Versions a representation rather than a resource. Hardest for clients |

The library can read several at once, but every extra source is one more way a client can ask, and one more to test. Most APIs pick one.

### Setting Up Asp.Versioning

ASP.NET Core has no built-in versioning. The Asp.Versioning libraries, maintained under the .NET Foundation, are the standard choice, and their major version tracks .NET's (10.x for .NET 10).

| Package | Adds |
| --- | --- |
| `Asp.Versioning.Http` | Versioning for minimal APIs, and the core services |
| `Asp.Versioning.Mvc` | Versioning for controllers, enabled with `.AddMvc()` |
| `Asp.Versioning.Mvc.ApiExplorer` | Version-aware API descriptions, enabled with `.AddApiExplorer()` |
| `Asp.Versioning.OpenApi` | One OpenAPI document per version with the built-in generator, enabled with `.AddOpenApi()` |

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.ReportApiVersions = true;
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
})
.AddMvc();   // controllers only
```

Without an `ApiVersionReader`, the library reads the `api-version` query string parameter and a URL segment. `ReportApiVersions` adds `api-supported-versions` and `api-deprecated-versions` headers to responses, so clients can discover what exists.

`AssumeDefaultVersionWhenUnspecified = true` makes a request with no version go to `DefaultApiVersion` instead of failing. It helps when adding versioning to an API that already has clients. It also means a client that forgets the version silently gets version 1 forever, including after version 1 is retired, so it is best kept for that transition.

### Versioned Controllers

Controllers declare the versions they serve with `[ApiVersion]`, and actions pick among them with `[MapToApiVersion]`. With URL versioning, the route template carries the version through the `apiVersion` route constraint:

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/orders")]
[ApiVersion(1.0)]
[ApiVersion(2.0)]
public class OrdersController(IOrderStore orders) : ControllerBase
{
    [HttpGet("{id:int}")]
    [MapToApiVersion(1.0)]
    public async Task<ActionResult<OrderV1>> GetV1(int id) => ...;

    [HttpGet("{id:int}")]
    [MapToApiVersion(2.0)]
    public async Task<ActionResult<OrderV2>> GetV2(int id) => ...;
}
```

`/api/v2/orders/42` and `/api/v2.0/orders/42` both reach `GetV2`. When versions diverge more than a little, one controller per version, each with a single `[ApiVersion]`, keeps each version's code together and makes retiring a version a matter of deleting a class.

### Versioned Minimal APIs

Minimal APIs group endpoints into a *versioned API*, then declare versions on route groups:

```csharp
var orders = app.NewVersionedApi("Orders");

var v1 = orders.MapGroup("/api/v{version:apiVersion}/orders").HasApiVersion(1.0);
var v2 = orders.MapGroup("/api/v{version:apiVersion}/orders").HasApiVersion(2.0);

v1.MapGet("/{id:int}", (int id, IOrderStore store) => ...);
v2.MapGet("/{id:int}", (int id, IOrderStore store) => ...);
```

Every endpoint in a group serves that group's version. An endpoint that needs to serve only some of a group's versions narrows them with `.MapToApiVersion(...)`.

### Requests for Versions That Don't Exist

A request for a version no endpoint serves gets a `400 Bad Request` with a Problem Details body naming the problem. When the version travels only in the URL, the request gets `404 Not Found` instead, because no route matches. A request with no version at all gets `400` too, unless `AssumeDefaultVersionWhenUnspecified` is on. `UnsupportedApiVersionStatusCode` changes the status for the unsupported case.

### Deprecation and Sunset

A deprecated version still works, but clients are told to move off it. Controllers mark it with `[ApiVersion(1.0, Deprecated = true)]`, and minimal API groups with `.HasDeprecatedApiVersion(1.0)`. With `ReportApiVersions` on, responses then list it in `api-deprecated-versions`.

Policies add dates and links. A *sunset policy* says when a version stops working, and a *deprecation policy* says when it became deprecated. The library writes them into the standard `Sunset` (RFC 8594) and `Deprecation` (RFC 9745) response headers, with a `Link` header pointing at the human-readable notice:

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.ReportApiVersions = true;
    options.Policies.Sunset(1.0)
        .Effective(new DateTimeOffset(2027, 6, 30, 0, 0, 0, TimeSpan.Zero))
        .Link("https://example.com/api/v1-retirement")
            .Title("Version 1 retirement")
            .Type("text/html");
});
```

A client can watch for these headers and schedule its migration long before the date. Removing the version afterward means deleting its endpoints, after which requests for it get the `400` or `404` above. Logging which versions each client calls shows who still depends on a deprecated version before that happens.

## Generating OpenAPI Documents

An *OpenAPI document* is a machine-readable description of an API's operations, parameters, request and response schemas, and security requirements. Documentation UIs, client generators, and contract tests all read it. Since .NET 9, ASP.NET Core generates one itself through the `Microsoft.AspNetCore.OpenApi` package, and the project templates no longer include Swashbuckle.

```csharp
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();   // serves /openapi/v1.json
}
```

`MapOpenApi` serves every registered document at `/openapi/{documentName}.json`, and the default document is named `v1`. Passing `"/openapi/{documentName}.yaml"` serves YAML instead. The templates map it only in Development, since a public API usually publishes its document deliberately rather than exposing whatever the running build describes. The generator works with both controllers and minimal APIs, and supports trimming and Native AOT.

.NET 10 produces OpenAPI 3.1 by default, the version aligned with JSON Schema 2020-12. Tools that only read 3.0 get it with `options.OpenApiVersion = OpenApiSpecVersion.OpenApi3_0`.

### What Goes into the Document

The generator builds each operation from what the endpoint declares, so a richer document comes from richer declarations, not from editing the output.

| Source | Contributes |
| --- | --- |
| Route template, parameters, and binding sources | Paths, path and query parameters, and request bodies |
| `TypedResults` return types, such as `Results<Ok<Order>, NotFound>` | Every listed status code and body schema, with no extra code |
| `[ProducesResponseType]` (controllers) or `.Produces<T>(status)` (minimal APIs) | Responses the return type can't express |
| `.WithSummary`, `.WithDescription`, `.WithTags`, or the matching attributes | Operation summaries, descriptions, and grouping |
| XML doc comments (.NET 10), with `<GenerateDocumentationFile>true</GenerateDocumentationFile>` in the project | Summaries and descriptions for operations, parameters, and schema properties, extracted at build time by a source generator |
| Data annotations such as `[Required]`, `[Range]`, and `[StringLength]` | Schema constraints |

`WithOpenApi`, which older samples use to edit an operation inline, is obsolete in .NET 10 (warning ASPDEPR002). Its uses move to the methods above or to an operation transformer.

### Multiple OpenAPI Documents

An API with separate audiences, such as public and internal endpoints, can generate a document for each. Each `AddOpenApi` call registers a named document, and an endpoint joins one with `WithGroupName`:

```csharp
builder.Services.AddOpenApi("public");
builder.Services.AddOpenApi("internal");

app.MapGet("/orders/{id:int}", GetOrder).WithGroupName("public");
app.MapPost("/admin/reindex", Reindex).WithGroupName("internal");

app.MapOpenApi();   // /openapi/public.json and /openapi/internal.json
```

An endpoint with no group name appears in every document, which is the easiest way to leak an internal endpoint into a public document. Each document's `ShouldInclude` option replaces the group-name rule with any predicate over the endpoint's description, such as its route prefix or an attribute.

### One Document per API Version

A versioned API usually wants one document per version, so each version's clients see only the operations and shapes they can call. `Asp.Versioning.OpenApi` builds that on top of the built-in generator:

```csharp
builder.Services.AddApiVersioning()
    .AddApiExplorer()
    .AddOpenApi();   // replaces separate builder.Services.AddOpenApi("v1"), ("v2") calls

app.MapOpenApi().WithDocumentPerVersion();
```

Each version's document includes only that version's endpoints, and the sunset and deprecation policies appear in the documents as well as in the response headers.

### Transformers

A *transformer* edits the generated document in code, so a customization reapplies every time the document is regenerated. There are three kinds, each scoped to one level of the document.

| Transformer | Runs | Typical use |
| --- | --- | --- |
| Document (`IOpenApiDocumentTransformer`) | Once per document | Title and contact details, servers, security schemes |
| Operation (`IOpenApiOperationTransformer`) | Once per endpoint | Adjustments driven by endpoint metadata |
| Schema (`IOpenApiSchemaTransformer`) | Once per schema | Examples, formats, and descriptions for a type |

Each can be a class registered with `AddDocumentTransformer<T>()` and its siblings, which receives constructor injection, or a lambda:

```csharp
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Info.Title = "Orders API";
        document.Info.Contact = new OpenApiContact { Email = "api-team@example.com" };
        return Task.CompletedTask;
    });

    // Mark endpoints carrying [Obsolete] as deprecated in the document
    options.AddOperationTransformer((operation, context, ct) =>
    {
        if (context.Description.ActionDescriptor.EndpointMetadata.OfType<ObsoleteAttribute>().Any())
        {
            operation.Deprecated = true;
        }
        return Task.CompletedTask;
    });

    options.AddSchemaTransformer((schema, context, ct) =>
    {
        if (context.JsonTypeInfo.Type == typeof(Order))
        {
            schema.Example = JsonNode.Parse("""{ "id": 42, "customer": "Contoso", "total": 129.50 }""");
        }
        return Task.CompletedTask;
    });
});
```

.NET 10 moved to OpenAPI.NET 2.x, the library that models the document, and transformers written for .NET 9 need updating. Examples and default values are `JsonNode` rather than `OpenApiAny`, a schema's `Type` is the `JsonSchemaType` enum rather than a string, and most collections on the model can be `null` until something assigns them. A transformer that needs a schema for a type no endpoint uses can create one with `context.GetOrCreateSchemaAsync`, new in .NET 10.

### Generating the Document at Build Time

Serving the document from the running app suits development. Committing it, diffing it in CI to catch breaking changes, or feeding it to a client generator needs a file. Adding the `Microsoft.Extensions.ApiDescription.Server` package makes `dotnet build` write one.

The build doesn't analyze the code statically. It starts the app's entry point against a mock server and asks the generator for the document, so every line of startup code runs, including code that connects to databases or reads secrets. Such code can be skipped by checking for the generator's entry assembly:

```csharp
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")
{
    builder.Services.AddDbContext<AppDbContext>(...);
}
```

The file lands in the project's `obj` folder by default, named after the project. `<OpenApiDocumentsDirectory>` in the project file moves it, and `<OpenApiGenerateDocumentsOptions>` takes `--file-name` and `--document-name` arguments to rename it or generate a single document. Other named documents get the document name appended, as `{ProjectName}_{DocumentName}.json`.

## Documentation UIs

The built-in generator produces the document but no UI to browse it. Two common choices read the generated document directly.

- **Scalar**, from the `Scalar.AspNetCore` package, maps with `app.MapScalarApiReference()` and serves at `/scalar`.
- **Swagger UI**, from the `Swashbuckle.AspNetCore.SwaggerUI` package, maps with `app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "v1"))`. Only the UI package is needed. The full `Swashbuckle.AspNetCore` package's `AddSwaggerGen` and `UseSwagger` generate a second, separate document.

Like `MapOpenApi`, they usually belong behind the Development check. Their "try it out" consoles send real requests with whatever credentials the browser holds.

## Generating Clients

A client generator turns the document into typed C# for calling the API, so client code stops hand-writing URLs and models and breaks at compile time when the API changes. Generating from the build-time file keeps the client in step with the server.

- **NSwag** generates one client class with a method per operation. It runs during the client project's build from an `<OpenApiReference Include="openapi.json" CodeGenerator="NSwagCSharp" />` item, which the `NSwag.ApiDescription.Client` package provides and `dotnet openapi add file` adds.
- **Kiota**, Microsoft's generator and the one behind the Microsoft Graph SDKs, generates fluent request builders that mirror the URL path, such as `client.Orders[42].GetAsync()`. It runs as a CLI tool, and the generated code needs the `Microsoft.Kiota.Bundle` package:

```bash
kiota generate -l CSharp -c OrdersClient -n Contoso.Orders.Client -d ./obj/Orders.Api.json -o ./Client
```

NSwag's method-per-operation clients are quicker to adopt. Kiota's builders stay smaller for large APIs and generate the same shape across languages.

## Key Takeaways

- Version for breaking changes only, and pick one place for the version to travel. Asp.Versioning reads the query string and URL segment by default.
- Controllers declare versions with `[ApiVersion]` and `[MapToApiVersion]`. Minimal APIs use `NewVersionedApi` and `HasApiVersion` on route groups.
- Unsupported versions get `400`, or `404` when the version is only in the URL. `AssumeDefaultVersionWhenUnspecified` hides clients that never send a version.
- Deprecation and sunset policies produce standard `Deprecation`, `Sunset`, and `Link` headers that clients can act on.
- `AddOpenApi` and `MapOpenApi` generate OpenAPI 3.1 in .NET 10. Enrich the document through return types, attributes, XML comments, and transformers, not by editing it.
- Endpoints join named documents with `WithGroupName`, and ungrouped endpoints appear in every document. `Asp.Versioning.OpenApi` generates one document per API version.
- Transformers written for .NET 9 need updating for OpenAPI.NET 2.x.
- `Microsoft.Extensions.ApiDescription.Server` writes the document at build time by running the app's startup code, to `obj` by default.
