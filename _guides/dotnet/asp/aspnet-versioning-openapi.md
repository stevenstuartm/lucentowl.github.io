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

The client has to say which version it wants, and there are four places to put it. Choosing between them is an API design decision, covered in [API Design Architecture](/study-guides/architecture/api-design-architecture.html#versioning), so this table records only what each looks like in the library covered below:

| Version travels in | Example | Asp.Versioning reader |
| --- | --- | --- |
| URL path | `/api/v2/orders` | `UrlSegmentApiVersionReader` |
| Query string | `/api/orders?api-version=2.0` | `QueryStringApiVersionReader` |
| Header | `api-version: 2.0` | `HeaderApiVersionReader` |
| Media type | `Accept: application/json;v=2.0` | `MediaTypeApiVersionReader` |

One consequence belongs here because it shows up in production rather than in design review. A path or query string version is part of the URL, so every cache already keys on it. A header or media type version isn't, so responses need a `Vary` header naming it, or a shared cache can serve one version's response to a client that asked for another.

The library can read several at once, but every extra source is one more way a client can ask, and one more to test. Most APIs pick one.

### Setting Up Asp.Versioning

ASP.NET Core has no built-in versioning. The [Asp.Versioning](https://dotnet.github.io/aspnet-api-versioning/){:target="_blank" rel="noopener noreferrer"} libraries, maintained under the .NET Foundation, are the standard choice, and their major version tracks .NET's (10.x for .NET 10).

| Package | Adds |
| --- | --- |
| `Asp.Versioning.Http` | Versioning for minimal APIs, and the core services |
| `Asp.Versioning.Mvc` | Versioning for controllers, enabled with `.AddMvc()` |
| `Asp.Versioning.Mvc.ApiExplorer` | Version-aware endpoint descriptions for documentation, enabled with `.AddApiExplorer()` |
| `Asp.Versioning.OpenApi` | One generated API description per version, enabled with `.AddOpenApi()` |

The last two packages feed the OpenAPI generation covered later in this guide.

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

`AssumeDefaultVersionWhenUnspecified = true` makes a request with no version go to `DefaultApiVersion` instead of failing. It helps when adding versioning to an API that already has clients, because those clients never sent a version. The cost comes later. A client that never sends a version is tied to whatever `DefaultApiVersion` says. Raising the default moves that client to a newer version without warning, and removing version 1 while the default still names it breaks the client with the `400` or `404` described below. Treat the option as a bridge for existing clients, and get them sending an explicit version before retiring anything.

### Versioned Controllers

Controllers declare the versions they serve with `[ApiVersion]`, and actions pick among them with `[MapToApiVersion]`. An action without `[MapToApiVersion]` serves every version its controller declares. With URL versioning, the route template carries the version through the `apiVersion` route constraint:

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

    [HttpDelete("{id:int}")]   // no [MapToApiVersion], so v1 and v2 both serve it
    public async Task<IActionResult> Delete(int id) => ...;
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

Policies add dates and links. A *sunset policy* says when a version stops working, and a *deprecation policy* says when it became deprecated. The library writes them into the standard `Sunset` (RFC 8594) and `Deprecation` (RFC 9745) response headers, with a `Link` header pointing at the human-readable notice. It writes these headers only when `ReportApiVersions` is on, the same switch that produces the version lists:

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.ReportApiVersions = true;   // required for Sunset and Deprecation headers
    options.Policies.Sunset(1.0)
        .Effective(new DateTimeOffset(2027, 6, 30, 0, 0, 0, TimeSpan.Zero))
        .Link("https://example.com/api/v1-retirement")
            .Title("Version 1 retirement")
            .Type("text/html");
});
```

`Policies.Deprecate(1.0)` builds a deprecation policy the same way. A policy given only a version applies to every API that has that version. Passing a versioned API's name, as in `Policies.Sunset("Orders", 1.0)`, scopes it to the API created with `NewVersionedApi("Orders")`, so one API can retire version 1 while another keeps it.

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

`MapOpenApi` serves every registered document at `/openapi/{documentName}.json`, and the default document is named `v1`. Passing `"/openapi/{documentName}.yaml"` serves YAML instead. The templates map it only in Development, because of information disclosure. The document lists every endpoint and schema the running build exposes, which is more than most production APIs mean to publish. The generator works with both controllers and minimal APIs, and supports trimming and Native AOT.

.NET 10 produces OpenAPI 3.1 by default, the version aligned with JSON Schema 2020-12. Tools that only read 3.0 get it with `options.OpenApiVersion = OpenApiSpecVersion.OpenApi3_0`.

### What Goes into the Document

The generator doesn't read the code. It reads ASP.NET Core's *API Explorer*, the service that describes every endpoint as an `ApiDescription`: its HTTP method, route, parameters and where each binds from, and the response types it declares. Anything that shapes those descriptions shapes the document, so a richer document comes from richer declarations, not from editing the output.

| Source | Contributes |
| --- | --- |
| Route template, parameters, and binding sources | Paths, path and query parameters, and request bodies |
| `TypedResults` return types, such as `Results<Ok<Order>, NotFound>` | Every listed status code and body schema, with no extra code |
| `[ProducesResponseType]` (controllers) or `.Produces<T>(status)` (minimal APIs) | Responses the return type can't express |
| `.WithSummary`, `.WithDescription`, `.WithTags`, or the matching attributes | Operation summaries, descriptions, and grouping |
| XML doc comments (.NET 10), with `<GenerateDocumentationFile>true</GenerateDocumentationFile>` in the project | Summaries and descriptions for operations, parameters, and schema properties, extracted at build time by a source generator |
| Data annotations such as `[Required]`, `[Range]`, and `[StringLength]` | Schema constraints |

XML comments attach to named methods and types, not to lambdas. A minimal API endpoint that should carry its XML comments into the document needs a named handler method, as in `app.MapGet("/orders/{id:int}", GetOrder)`.

`WithOpenApi`, which older samples use to edit an operation inline, is obsolete in .NET 10 (warning ASPDEPR002). Its uses move to the methods in the table, or to `.AddOpenApiOperationTransformer(...)` on the endpoint, which runs an operation transformer for that endpoint alone.

### Multiple OpenAPI Documents

An API with separate audiences, such as public and internal endpoints, can generate a document for each. Each `AddOpenApi` call registers a named document, and an endpoint joins one with `WithGroupName`:

```csharp
builder.Services.AddOpenApi("public");
builder.Services.AddOpenApi("internal");

app.MapGet("/orders/{id:int}", GetOrder).WithGroupName("public");
app.MapPost("/admin/reindex", Reindex).WithGroupName("internal");

app.MapOpenApi();   // /openapi/public.json and /openapi/internal.json
```

An endpoint with no group name appears in every document, which is the easiest way to leak an internal endpoint into a public document. Each document's `ShouldInclude` option replaces the group-name rule with any predicate over the endpoint's `ApiDescription`, such as its route prefix or an attribute.

### One Document per API Version

A versioned API usually wants one document per version, so each version's clients see only the operations and shapes they can call. Registering `AddOpenApi("v1")` and `AddOpenApi("v2")` by hand, each with a `ShouldInclude` that matches on version, works, but every new version means another registration, and the documents carry nothing about deprecation. `Asp.Versioning.OpenApi` builds the list from the versions the endpoints declare:

```csharp
builder.Services.AddApiVersioning(options => options.ReportApiVersions = true)
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";         // documents named v1, v2
        options.SubstituteApiVersionInUrl = true;   // /api/v1/orders, not /api/v{version}/orders
    })
    .AddOpenApi();   // replaces builder.Services.AddOpenApi calls

app.MapOpenApi().WithDocumentPerVersion();   // /openapi/v1.json, /openapi/v2.json
```

Each version's document includes only that version's endpoints, and the sunset and deprecation policies appear in the documents as well as in the response headers. A controller-based API adds `.AddMvc()` to the chain as before.

The two API Explorer options matter more than they look. `GroupNameFormat` names each version's document, and it defaults to empty, which formats the version bare and serves `/openapi/1.0.json`. The format `'v'VVV` writes a literal `v` followed by the major version, plus the minor version only when it isn't zero and any status such as `-beta`, so version 1.0 becomes `v1`. `SubstituteApiVersionInUrl` replaces the `{version}` route parameter with the actual version in each document's paths. Without it, every path shows `v{version}` as a parameter the client has to fill in, and generated clients inherit that parameter too.

With versioning in charge of the document list, per-document settings move from `builder.Services.AddOpenApi(...)` to the versioning builder's `.AddOpenApi(options => ...)`, where `options.Document` is the same `OpenApiOptions` object, applied to every version's document. Transformers register there.

### Transformers

A *transformer* edits the generated document in code, so a customization reapplies every time the document is regenerated. The generator models the document with OpenAPI.NET, Microsoft's library of classes for OpenAPI documents (`OpenApiDocument`, `OpenApiOperation`, `OpenApiSchema`), and transformers edit those objects. There are three kinds, each scoped to one level of the document, and they run in the order listed:

| Transformer | Runs | Typical use |
| --- | --- | --- |
| Schema (`IOpenApiSchemaTransformer`) | Once per schema, as the operations using it are built | Examples, formats, and descriptions for a type |
| Operation (`IOpenApiOperationTransformer`) | Once per endpoint | Adjustments driven by endpoint metadata |
| Document (`IOpenApiDocumentTransformer`) | Once per document, last | Title and contact details, servers, security schemes |

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

In a versioned API, the same calls go on `options.Document` in the versioning builder's `.AddOpenApi(options => options.Document.AddDocumentTransformer(...))`.

.NET 10 moved to OpenAPI.NET 2.x, and transformers written for .NET 9 need updating. Examples and default values are `JsonNode` rather than `OpenApiAny`, a schema's `Type` is the `JsonSchemaType` enum rather than a string, and most collections on the model can be `null` until something assigns them. A transformer that needs a schema for a type no endpoint uses can create one with `context.GetOrCreateSchemaAsync`, new in .NET 10.

### Generating the Document at Build Time

Serving the document from the running app suits development. Committing it, diffing it in CI to catch breaking changes, or feeding it to a client generator needs a file. Adding the `Microsoft.Extensions.ApiDescription.Server` package makes `dotnet build` write one.

The build doesn't analyze the code statically. It starts the app's entry point against a mock server and asks the generator for the document, so every line of startup code runs, including code that connects to databases or reads secrets. Such code can be skipped by checking for the generator's entry assembly:

```csharp
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")
{
    builder.Services.AddDbContext<AppDbContext>(...);
}
```

The file lands in the project's `obj` folder by default. A document named `v1` is written as `{ProjectName}.json`, and any other document gets its name appended, as `{ProjectName}_{DocumentName}.json`, so a per-version API produces `Orders.Api.json` and `Orders.Api_v2.json`. `<OpenApiDocumentsDirectory>` in the project file moves the files, and `<OpenApiGenerateDocumentsOptions>` takes `--file-name` and `--document-name` arguments to rename the output or generate a single document.

## Documentation UIs

The built-in generator produces the document but no UI to browse it. Two common choices read the generated document directly.

- **[Scalar](https://github.com/scalar/scalar){:target="_blank" rel="noopener noreferrer"}**, from the `Scalar.AspNetCore` package, maps with `app.MapScalarApiReference()` and serves at `/scalar`.
- **Swagger UI**, from the `Swashbuckle.AspNetCore.SwaggerUI` package of [Swashbuckle](https://github.com/domaindrivendev/Swashbuckle.AspNetCore){:target="_blank" rel="noopener noreferrer"}, maps with `app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "v1"))`. Only the UI package is needed. The full `Swashbuckle.AspNetCore` package's `AddSwaggerGen` and `UseSwagger` generate a second, separate document.

Both need to be told about every document. Swagger UI takes one `SwaggerEndpoint` call per document. With per-version documents, `app.DescribeApiVersions()` lists the versions, and each gets a `SwaggerEndpoint` or, for Scalar, an `AddDocument` call:

```csharp
app.MapScalarApiReference(options =>
{
    foreach (var description in app.DescribeApiVersions())
    {
        options.AddDocument(description.GroupName);
    }
});
```

Like `MapOpenApi`, the UIs usually belong behind the Development check. Their "try it out" consoles send real requests with whatever credentials the browser holds.

## Generating Clients

A client generator turns the document into typed C# for calling the API, so client code stops hand-writing URLs and models and breaks at compile time when the API changes. Generating from the build-time file keeps the client in step with the server.

- **[NSwag](https://github.com/RicoSuter/NSwag){:target="_blank" rel="noopener noreferrer"}** generates a client class with a method per operation. It runs as a CLI tool, `dotnet tool run nswag` or `npx nswag`, driven by an `.nswag` configuration file that names the input document and the output settings.
- **[Kiota](https://learn.microsoft.com/openapi/kiota/overview){:target="_blank" rel="noopener noreferrer"}**, Microsoft's generator and the one behind the Microsoft Graph SDKs, generates fluent request builders that mirror the URL path, such as `client.Api.V1.Orders[42].GetAsync()`. It runs as a CLI tool, and the generated code needs the `Microsoft.Kiota.Bundle` package:

```bash
kiota generate -l CSharp -c OrdersClient -n Contoso.Orders.Client -d ./obj/Orders.Api.json -o ./Client
```

Older samples generate clients during the build with `<OpenApiReference>` items or the `dotnet openapi` command. Both come from the `Microsoft.Extensions.ApiDescription.Client` package, deprecated in .NET 10, and Microsoft's replacement is each generator's own CLI. The CLI runs in CI or in a custom pre-build step, and the generated code is committed like any other source.

NSwag's method-per-operation clients read like hand-written service classes, which makes them quick to adopt. Kiota generates clients for several languages from the same document, and `--include-path` limits a client to the paths it needs, which keeps a client for a small part of a large API small.

## Key Takeaways

- Version for breaking changes only, and pick one place for the version to travel. Asp.Versioning reads the query string and URL segment by default. Header and media type versions need a `Vary` header to stay cache-safe.
- Controllers declare versions with `[ApiVersion]` and `[MapToApiVersion]`. Minimal APIs use `NewVersionedApi` and `HasApiVersion` on route groups.
- Unsupported versions get `400`, or `404` when the version is only in the URL. `AssumeDefaultVersionWhenUnspecified` ties clients that never send a version to `DefaultApiVersion`, so it's a bridge, not a permanent setting.
- Deprecation and sunset policies produce standard `Deprecation`, `Sunset`, and `Link` headers, only when `ReportApiVersions` is on.
- `AddOpenApi` and `MapOpenApi` generate OpenAPI 3.1 in .NET 10 from the API Explorer's endpoint descriptions. Enrich the document through return types, attributes, XML comments, and transformers, not by editing it.
- Endpoints join named documents with `WithGroupName`, and ungrouped endpoints appear in every document. `Asp.Versioning.OpenApi` generates one document per API version, named by `GroupNameFormat`.
- Transformers run schema, then operation, then document, and those written for .NET 9 need updating for OpenAPI.NET 2.x.
- `Microsoft.Extensions.ApiDescription.Server` writes the document at build time by running the app's startup code, to `obj` by default.
