---
title: "Large Payloads, File Uploads, and Streaming"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Moving large request and response bodies through an ASP.NET Core API without holding them in memory: body size limits, buffered and streamed file uploads, upload security, file downloads and range requests, streamed JSON with IAsyncEnumerable, and response compression and request decompression."
tags: [practical, file-uploads, streaming, request-limits, iasyncenumerable, compression]
---

## Buffered or Streamed

ASP.NET Core's convenient APIs buffer. A handler that takes an `IFormFile` or a model bound from JSON doesn't run until the framework has read the whole body, and a handler that returns a list serializes every item before the client sees the first. For payloads of a few kilobytes this costs nothing. For a 2 GB video upload or an export of a million rows, it means memory, temporary disk, and a client that waits for everything before anything happens.

The alternative is to stream: read the request body as it arrives and write the response as it is produced, so the server holds one chunk at a time. Streaming costs more code and gives up some framework help, such as model binding and validation. Most APIs buffer by default and stream the few endpoints whose payloads are large. Either way, the body has to get past the size limits first.

## Body Size Limits

A request body passes several size limits, from the outside in. A reverse proxy applies its own first, then IIS request filtering when the app is hosted in IIS, then the server's body limit, which an endpoint can override, and finally the form limits when the body is read as a form. An inner limit can't widen an outer one, so raising an endpoint's limit to 2 GiB does nothing for a request that the proxy or IIS rejects first.

| Limit | Default | Where it's set | Applies to |
| --- | --- | --- | --- |
| Reverse proxy | Varies. Nginx defaults to 1 MB | The proxy's configuration | Everything behind the proxy |
| IIS request filtering | 30,000,000 bytes | `maxAllowedContentLength` in `web.config` | Requests hosted in IIS, before the app sees them |
| Server body limit | 30,000,000 bytes (about 28.6 MiB) in Kestrel, IIS, and HTTP.sys | `KestrelServerOptions.Limits.MaxRequestBodySize`, and the equivalent `IISServerOptions` and `HttpSysOptions` properties | The whole body of every request |
| Per-endpoint override | None | `[RequestSizeLimit(bytes)]` or `[DisableRequestSizeLimit]` | One endpoint, replacing the server body limit |
| Form limits | 128 MiB per file or field in a multipart upload | `FormOptions`, or per endpoint with `[RequestFormLimits]` (controllers) or `.WithFormOptions(...)` (minimal APIs) | Bodies the framework reads as a form, such as the file uploads below |

The server enforces its body limit as the body is read, not when the request arrives. The first read fails if the request's `Content-Length` already exceeds the limit, and a later read fails once the body grows past it, with an exception in whatever code is reading. What the client sees depends on who that is.

| Where the limit trips | Client gets |
| --- | --- |
| Reverse proxy | The proxy's error, usually `413` |
| IIS request filtering | `404.13` |
| Minimal API binding a form or JSON body | `413 Payload Too Large`, before the handler runs |
| Controller binding a form | A model-binding error. Under `[ApiController]` that is the automatic `400`, and without it the action runs with a `null` file |
| A form limit, in either style | `400` |
| A handler streaming the body itself | `413` partway through the upload, if the exception escapes to the server. Exception handling middleware turns it into a `500` unless configured to map it |

The per-endpoint attributes work on controller actions and on minimal API endpoints alike, because routing applies them before the handler runs. On a minimal API they attach with `.WithMetadata(new RequestSizeLimitAttribute(...))` or as an attribute on the handler lambda. Setting the server limit to `null` removes it, which is rarely wise, because the limit is what stops a client from streaming an endless body at the server. Raising it only for the endpoints that need more is safer than raising it everywhere.

Size isn't the only limit a large transfer meets. Kestrel also times out a body that arrives too slowly, below `MinRequestBodyDataRate` (240 bytes per second after a 5-second grace period by default), and `MinResponseDataRate` does the same for a response the client reads too slowly. Either can cut off a large upload or download on a poor connection.

## Buffered Uploads with IFormFile

A client uploads files in a `multipart/form-data` request, where each file and form field is a separate *section* of the body. `IFormFile` is the framework's view of one file section, with its name, length, content type, and a stream over its content. It binds the same way in both API styles:

```csharp
// Controller action
[HttpPost("documents")]
public async Task<ActionResult<DocumentInfo>> Upload(IFormFile file, CancellationToken ct) =>
    await documents.SaveAsync(file, ct);

// Minimal API endpoint
app.MapPost("/documents", async (IFormFile file, IDocumentStore documents, CancellationToken ct) =>
    TypedResults.Ok(await documents.SaveAsync(file, ct)));
```

`IFormFileCollection` accepts several files in one request in both styles. Controllers also bind `List<IFormFile>`, and minimal APIs bind `IReadOnlyList<IFormFile>` but leave a `List<IFormFile>` parameter empty.

Before the handler runs, the form reader reads the entire body. It keeps each file in memory until the file passes 64 KB, then moves it to a temporary file on disk, and the handler receives `IFormFile` objects over those buffers. The upload therefore lands twice: once in the temporary file and again wherever the handler copies it. Many large concurrent uploads fill the temporary directory as well as the destination.

{% include figure.html id="asp-upload-paths" %}

Minimal API endpoints that bind from a form also require antiforgery validation, the protection against a malicious site submitting a form with the user's cookies. Without the antiforgery middleware in the pipeline, such a request fails with an exception. An API authenticated with bearer tokens, which a browser doesn't attach automatically, turns the check off with `.DisableAntiforgery()`.

## Treat Every Upload as Hostile

Everything about an upload except its bytes comes from the client, and the bytes can't be trusted either.

- **The file name is attacker input.** `IFormFile.FileName` can contain `../` sequences or overwrite an existing file. Store the file under a name the server generates, such as `Path.GetRandomFileName()` or a database id, and keep the original name only as display metadata, encoded wherever it is shown.
- **The content type and extension are claims.** `IFormFile.ContentType` is whatever the client sent, and the extension is part of the attacker's file name. Accept only an allowlist of extensions, and when the type matters, check the file's leading bytes against the signatures of the formats the API accepts.
- **Store uploads outside the web root**, so an uploaded script can never be requested and served as a page, and scan files with an antivirus service before anything else opens them.

## Streaming Uploads

To avoid the buffering, the handler reads the body itself. The simplest form drops multipart entirely. The client sends the file as the raw body of a `PUT` or `POST` with a content type such as `application/octet-stream`, and the handler copies the request stream to its destination:

```csharp
app.MapPut("/videos/{id:guid}", async (Guid id, HttpRequest request, IVideoStore videos, CancellationToken ct) =>
{
    await videos.WriteAsync(id, request.Body, ct);   // copies chunk by chunk
    return TypedResults.NoContent();
})
.WithMetadata(new RequestSizeLimitAttribute(2L * 1024 * 1024 * 1024));   // 2 GiB for this endpoint only
```

A minimal API can also declare a `Stream` parameter, or a `PipeReader`, the lower-allocation reader the server itself uses, and either binds to the raw body in the same way.

When clients must send multipart, because a browser form sends the file alongside other fields, `MultipartReader` walks the body one section at a time:

```csharp
// MediaTypeHeaderValue and ContentDispositionHeaderValue come from Microsoft.Net.Http.Headers,
// MultipartReader from Microsoft.AspNetCore.WebUtilities, StringSegment from Microsoft.Extensions.Primitives
app.MapPost("/videos", async (HttpRequest request, IVideoStore videos, CancellationToken ct) =>
{
    if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var mediaType) ||
        !mediaType.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase))
    {
        return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
    }

    var boundary = HeaderUtilities.RemoveQuotes(mediaType.Boundary).Value!;
    var reader = new MultipartReader(boundary, request.Body);
    var ids = new List<Guid>();

    while (await reader.ReadNextSectionAsync(ct) is { } section)
    {
        if (ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition) &&
            !StringSegment.IsNullOrEmpty(disposition.FileName))
        {
            ids.Add(await videos.CreateAsync(section.Body, ct));   // streams this section to storage
        }
    }

    return Results.Ok(ids);
})
.WithMetadata(new RequestSizeLimitAttribute(2L * 1024 * 1024 * 1024));
```

The endpoint takes `HttpRequest` rather than `IFormFile`, so the form reader never runs and nothing is buffered. It also has no form parameters, so it gets no antiforgery check. That is right for a bearer-token API, but a cookie-authenticated browser form posting to it needs the check added explicitly. The sections arrive in order on one stream, so moving to the next section discards whatever the handler didn't read of the current one.

A controller action needs one extra step. Whenever a request has a form content type and the action has any parameter to bind, even a route id or a `CancellationToken`, MVC reads the whole form first, which buffers the upload before the action runs. The components that do this are called form value providers. The ASP.NET Core documentation's sample `[DisableFormValueModelBinding]` attribute removes those providers for one action. It is sample code to copy, not a framework type. The action then reads `Request.Body` with `MultipartReader` as above.

For files in the gigabytes, the cheapest design keeps them out of the API entirely. The API issues a short-lived signed URL for a blob store, such as an Azure SAS URL or an S3 presigned URL, and the client uploads straight to storage. The API's only work is authorizing the upload and recording the result. The cost is that the bytes never pass through the API, so none of the checks above can run inline. An S3 presigned POST can carry a size cap in its policy, but an Azure SAS or a presigned PUT can't. The size check, file-signature checks, and scanning then run after the upload lands, typically triggered by a storage event, with the file quarantined until they pass.

## Downloads

File results send a file with the right headers and dispose any stream they are given once the response completes. The choice between them decides whether the file passes through memory.

| Source | Controller | Minimal API | Memory use |
| --- | --- | --- | --- |
| A file on disk | `PhysicalFile(path, contentType)` | `TypedResults.PhysicalFile(path, contentType)` | Streamed from disk |
| An open stream | `File(stream, contentType)` | `TypedResults.Stream(stream, contentType)` or `TypedResults.File(stream, contentType)` | Streamed |
| Content written on the fly | The same `TypedResults.Stream`, which controllers can return too | `TypedResults.Stream(async body => ..., contentType)` | Only what the writer holds |
| A byte array | `File(bytes, contentType)` | `TypedResults.File(bytes, contentType)` | The whole file, in memory |

Each of these results accepts a download file name, which sets `Content-Disposition` so a browser saves the file under that name. `PhysicalFile` needs an absolute path and throws on a relative one.

*Range requests* let a client ask for part of a file, so a video player can seek and an interrupted download can resume. File results support them only when `enableRangeProcessing` is `true`, which is off by default, and only when the length is known, as it is for files on disk and seekable streams.

```csharp
app.MapGet("/reports/{id:guid}", async (Guid id, IReportStore reports, CancellationToken ct) =>
    await reports.FindPathAsync(id, ct) is { } path
        ? TypedResults.PhysicalFile(path, "application/pdf", "report.pdf", enableRangeProcessing: true)
        : Results.NotFound());
```

The file is found by id, never by a path built from a request value. A route like `/files/{name}` combined with `Path.Combine` lets a client request `../appsettings.json`.

## Streaming JSON with IAsyncEnumerable

An endpoint that returns `IAsyncEnumerable<T>` streams a JSON array. `System.Text.Json` writes each item as the enumerator produces it and doesn't hold the whole list. It *flushes*, sending what it has written to the network along with the status and headers the first time, as the stream goes on:

```csharp
app.MapGet("/orders/export", (AppDbContext db) =>
    db.Orders.AsNoTracking().OrderBy(o => o.Id).AsAsyncEnumerable());
```

After the first item, the serializer flushes whenever the next item isn't ready yet and whenever its buffer fills. Items that trickle in from a slow source reach the client one by one, and items that arrive quickly go out in buffer-sized batches. Controllers stream the same way, as long as they use the default `System.Text.Json` formatter. A controller configured with the Newtonsoft.Json formatter buffers the sequence first and throws once it passes `MvcOptions.MaxIAsyncEnumerableBufferLimit` items (8,192 by default).

Streaming changes three things about the endpoint.

- **The database connection stays open for the whole response.** EF Core's `AsAsyncEnumerable` reads rows as the client consumes them, so a slow client holds a connection from the pool for as long as it takes to read.
- **Errors can't produce an error response.** The serializer holds back its first flush until the first item arrives, so a query that fails before producing a row still gets a normal error response. After that the `200` status is already sent, and a failure aborts the connection, and the client receives a truncated array that it has to recognize as a failure.
- **The client must read incrementally to benefit.** A client that loads the whole response before parsing gains nothing. .NET clients read the array item by item with `HttpClient.GetFromJsonAsAsyncEnumerable<T>()`.

Streaming suits exports, bulk synchronization, and any consumer that processes the entire dataset. Interactive clients that show one screen at a time are better served by pagination, where each page is a complete response with its own status code.

A stream of separate events rather than one array, such as progress updates or notifications, is a different shape, served as server-sent events (`TypedResults.ServerSentEvents` in .NET 10).

## Compression

### Response Compression

Response compression shrinks bodies on the way out. A reverse proxy or CDN in front of the app usually does it more cheaply, so the middleware is for apps that face clients directly.

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;   // see below before doing this
});

var app = builder.Build();
app.UseResponseCompression();        // before any middleware that writes responses
```

With no providers configured, it offers Brotli and gzip, picks one from the client's `Accept-Encoding` header, preferring Brotli when the client accepts both equally, and adds `Vary: Accept-Encoding` so caches keep the variants apart. Both providers default to `CompressionLevel.Fastest`, which trades compression ratio for CPU per request. It compresses only the MIME types on its list, which by default covers text, HTML, CSS, JavaScript, XML, JSON, and WebAssembly, so images and archives that are already compressed pass through untouched. It has no minimum size, and a response of a few hundred bytes can come out larger than it went in.

Compression over HTTPS is off by default because of the BREACH attack. When a compressed response contains both a secret, such as an antiforgery token, and text an attacker can influence, the attacker can recover the secret by watching how the compressed size changes across many requests. An API whose responses never mix the two can turn on `EnableForHttps`. One whose responses do can still compress selected endpoints, by setting `Mode` on the request's `IHttpsCompressionFeature` to opt one response in or out.

### Request Decompression

Clients can compress large request bodies too, marking them with a `Content-Encoding` header. The request decompression middleware (.NET 7 and later) undoes it before the handler reads the body:

```csharp
builder.Services.AddRequestDecompression();

var app = builder.Build();
app.UseRequestDecompression();
```

It supports Brotli (`br`), `deflate`, and `gzip` by default, and decompresses lazily as the handler reads, so a streamed upload stays streamed. A request with an unsupported encoding, or with more than one `Content-Encoding` value, passes through unchanged, and the handler reads compressed bytes.

A few kilobytes of compressed data can expand to gigabytes. The middleware guards against this *decompression bomb* by applying the request body size limit to the decompressed bytes. The endpoint's `[RequestSizeLimit]` applies if it has one, and the server limit otherwise, and a body that expands past it fails with `413`. The limits from the first section therefore cap both the compressed size on the wire and the decompressed size the handler reads.

## Key Takeaways

- `IFormFile`, model binding, and returned lists all buffer the whole payload. Stream only the endpoints whose payloads are large.
- The server body limit is 30,000,000 bytes by default. Raise it per endpoint with `[RequestSizeLimit]`, which works for controllers and minimal APIs but can't get past a lower proxy or IIS limit.
- The limit is enforced as the body is read, so the status depends on who reads it: `413` in minimal APIs, a model-binding `400` in controllers, and a mid-upload failure in a streaming handler.
- Buffered uploads sit in memory up to 64 KB and then in a temporary file. The upload is written twice.
- Minimal API form endpoints require antiforgery. Token-authenticated APIs turn it off with `.DisableAntiforgery()`.
- Never use the client's file name as a path, and never trust its content type.
- Stream uploads with `HttpRequest.Body` or `MultipartReader`. For very large files, upload directly to blob storage with a signed URL.
- File results stream from disk and streams, but a byte array lives in memory. Range requests need `enableRangeProcessing: true`.
- `IAsyncEnumerable<T>` streams a JSON array, holds its database connection for the whole response, and can't report an error once the first item has gone out.
- Response compression is off for HTTPS by default because of BREACH. Request decompression enforces the body size limit on the decompressed bytes.
