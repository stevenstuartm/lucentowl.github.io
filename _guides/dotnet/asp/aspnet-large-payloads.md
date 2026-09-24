---
title: "Large Payloads, File Uploads, and Streaming"
layout: guide
category: "ASP.NET Core"
subcategory: "Building APIs"
description: "Moving large request and response bodies through an ASP.NET Core API without buffering them in memory: file uploads and downloads, multipart streaming, body size limits, streamed results with IAsyncEnumerable, and compression."
tags: [file-uploads, streaming, iasyncenumerable, compression, request-limits, practical]
---

## Form Data Handling

APIs sometimes accept form-encoded data or multipart form data instead of JSON. The `[FromForm]` attribute binds properties from form data.

### Simple Form Data

For `application/x-www-form-urlencoded` content, use `[FromForm]` to bind properties:

```csharp
[HttpPost("login")]
public IActionResult Login([FromForm] string username, [FromForm] string password)
{
    // Authenticate user
    return Ok();
}
```

You can bind entire models from form data:

```csharp
public class LoginRequest
{
    public string Username { get; set; }
    public string Password { get; set; }
}

[HttpPost("login")]
public IActionResult Login([FromForm] LoginRequest request)
{
    return Ok();
}
```

The framework reads form fields and populates the model properties.

### File Uploads with IFormFile

The `IFormFile` interface represents an uploaded file. It provides access to the file name, length, content type, and a stream for reading the file content.

```csharp
[HttpPost("upload")]
public async Task<IActionResult> Upload([FromForm] IFormFile file)
{
    if (file == null || file.Length == 0)
    {
        return BadRequest("No file uploaded");
    }

    var path = Path.Combine(uploadsDirectory, file.FileName);
    using var stream = new FileStream(path, FileMode.Create);
    await file.CopyToAsync(stream);

    return Ok(new { FileName = file.FileName, Size = file.Length });
}
```

The client sends a `multipart/form-data` request with the file attached. The framework buffers the file in memory or on disk, depending on size, and presents it as an `IFormFile`.

### Multiple File Uploads

To accept multiple files, use `IFormFileCollection` or `List<IFormFile>`:

```csharp
[HttpPost("upload-multiple")]
public async Task<IActionResult> UploadMultiple([FromForm] List<IFormFile> files)
{
    if (files == null || files.Count == 0)
    {
        return BadRequest("No files uploaded");
    }

    foreach (var file in files)
    {
        var path = Path.Combine(uploadsDirectory, file.FileName);
        using var stream = new FileStream(path, FileMode.Create);
        await file.CopyToAsync(stream);
    }

    return Ok(new { Count = files.Count });
}
```

The client attaches multiple files to the same form field or different fields, and the framework binds them to the collection.

### File Size Limits

By default, ASP.NET Core limits request body size to 30MB. For larger files, configure limits in multiple places: the server, the framework, and the form options.

Configure Kestrel's maximum request body size:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100 MB
});
```

Configure form options for multipart requests:

```csharp
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100 * 1024 * 1024;
});
```

Use `[RequestSizeLimit]` or `[DisableRequestSizeLimit]` on specific actions:

```csharp
[HttpPost("upload-large")]
[RequestSizeLimit(200 * 1024 * 1024)]
public async Task<IActionResult> UploadLarge([FromForm] IFormFile file)
{
    // Handle large file
    return Ok();
}
```

Increasing limits has implications for server memory and denial-of-service risk. Consider streaming large files instead of buffering them entirely.

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

## Streaming Large Files

Buffering large files consumes significant memory and disk space. Streaming processes files incrementally, reducing resource usage.

### Streaming Uploads

To stream an uploaded file without buffering, disable form value model binding and read the request body directly using `MultipartReader`:

```csharp
[HttpPost("stream-upload")]
[DisableFormValueModelBinding]
public async Task<IActionResult> StreamUpload()
{
    if (!Request.ContentType.StartsWith("multipart/"))
    {
        return BadRequest("Expected multipart request");
    }

    var boundary = HeaderUtilities.RemoveQuotes(
        MediaTypeHeaderValue.Parse(Request.ContentType).Boundary).Value;

    var reader = new MultipartReader(boundary, Request.Body);
    var section = await reader.ReadNextSectionAsync();

    while (section != null)
    {
        if (ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var contentDisposition))
        {
            if (contentDisposition.DispositionType.Equals("form-data") &&
                !string.IsNullOrEmpty(contentDisposition.FileName.Value))
            {
                var fileName = contentDisposition.FileName.Value;
                var path = Path.Combine(uploadsDirectory, fileName);

                using var fileStream = new FileStream(path, FileMode.Create);
                await section.Body.CopyToAsync(fileStream);
            }
        }

        section = await reader.ReadNextSectionAsync();
    }

    return Ok();
}
```

The `[DisableFormValueModelBinding]` attribute prevents model binding from buffering the request. The `MultipartReader` reads each section of the multipart request incrementally, allowing you to process files without loading them entirely into memory.

### Streaming Downloads

To stream a large file in the response, return a `FileStreamResult` or use `Results.Stream`:

```csharp
[HttpGet("download/{filename}")]
public IActionResult Download(string filename)
{
    var path = Path.Combine(downloadsDirectory, filename);
    if (!System.IO.File.Exists(path))
    {
        return NotFound();
    }

    var stream = new FileStream(path, FileMode.Open, FileAccess.Read);
    return File(stream, "application/octet-stream", filename);
}
```

The framework streams the file to the client without buffering it entirely in memory. For minimal APIs:

```csharp
app.MapGet("/download/{filename}", (string filename) =>
{
    var path = Path.Combine(downloadsDirectory, filename);
    if (!System.IO.File.Exists(path))
    {
        return Results.NotFound();
    }

    var stream = new FileStream(path, FileMode.Open, FileAccess.Read);
    return Results.Stream(stream, "application/octet-stream", filename);
});
```

Streaming large downloads reduces server memory usage and allows clients to begin processing data before the entire file transfers.

## Streaming Large Result Sets with IAsyncEnumerable

Returning large collections from APIs traditionally requires loading the entire collection into memory, serializing it to JSON, and sending the complete response. For result sets with thousands or millions of items, this approach consumes excessive memory and delays time-to-first-byte while the server loads and serializes everything.

`IAsyncEnumerable<T>` enables streaming results to clients as items become available. Instead of buffering the entire collection, the API yields items one at a time or in small batches. The serializer sends each item to the client immediately, reducing memory usage and allowing clients to process data incrementally.

```csharp
public async IAsyncEnumerable<Product> GetProductsAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    await foreach (var product in _repository.StreamProductsAsync(cancellationToken))
    {
        yield return product;
    }
}
```

When an endpoint returns `IAsyncEnumerable<T>`, ASP.NET Core's JSON serializer recognizes the streaming intent and begins sending the response immediately. As each item yields, the serializer converts it to JSON and writes it to the response stream. The client receives a standard JSON array but the server doesn't buffer the entire array before transmission.

Entity Framework Core supports `IAsyncEnumerable<T>` natively through `AsAsyncEnumerable()`. Database results stream from the database to the API to the client without materializing the entire result set in memory.

```csharp
public async IAsyncEnumerable<Product> GetAllProductsAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    await foreach (var product in _dbContext.Products
        .AsAsyncEnumerable()
        .WithCancellation(cancellationToken))
    {
        yield return product;
    }
}
```

The `[EnumeratorCancellation]` attribute ensures the cancellation token is properly integrated with the async enumeration. When the client disconnects or cancels the request, the enumeration stops, preventing wasted work processing results that will never be consumed.

### When to Stream Results

Streaming benefits APIs that return large collections where clients need all data but loading everything into memory is impractical. Paginated APIs often work better than streaming for interactive applications where users navigate through results incrementally. Streaming makes sense when the client intends to consume the entire dataset, such as export operations, analytics processing, or bulk synchronization.

Streaming adds complexity to error handling. When the server begins sending items and encounters an error halfway through, it cannot return a clean error response because the response has already started. The JSON array is incomplete, and the client must detect the truncation. Paginated APIs allow each page to return proper error responses independently.

Clients must support streaming consumption to benefit from server-side streaming. If the client buffers the entire response before processing, streaming provides no advantage and may increase total time due to serialization overhead. Streaming works best when both server and client process data incrementally.

## Response Compression

Response compression reduces payload size by compressing HTTP response bodies before sending them to clients. ASP.NET Core provides built-in support for Brotli and gzip compression through the response compression middleware. Brotli achieves better compression ratios than gzip, resulting in smaller file sizes, but requires more CPU for compression. Gzip compresses faster with slightly larger output.

The middleware examines the client's `Accept-Encoding` header to determine supported compression algorithms. Modern browsers support both Brotli and gzip. When both are supported, the middleware prefers Brotli for its superior compression ratio. If the client only supports gzip or doesn't send an `Accept-Encoding` header, the middleware falls back to gzip or sends uncompressed content.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();

    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json", "application/xml" });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

var app = builder.Build();

app.UseResponseCompression();
```

The middleware must be registered early in the pipeline, before middleware that produces responses. `EnableForHttps` allows compression over HTTPS connections, which older guidance discouraged due to CRIME and BREACH attack concerns. Modern applications with proper security controls can safely enable HTTPS compression, particularly for APIs where response content doesn't include user secrets in predictable positions.

The default compression level for Brotli is `Fastest`, which prioritizes speed over compression ratio. Changing it to `Optimal` or `SmallestSize` increases compression time and CPU usage while producing smaller payloads. The right balance depends on your network conditions and CPU capacity. High-latency networks benefit more from smaller payloads, while CPU-constrained servers should prefer faster compression.

### Compression and Caching Interaction

Compressing cached responses requires careful coordination between compression and caching middleware. If compression runs after caching, the middleware caches uncompressed responses and compresses them on every request, wasting CPU. If compression runs before caching, the middleware may cache only one compressed variant while clients request different encoding types.

ASP.NET Core's output caching middleware handles this automatically by storing multiple variants of the same resource based on the `Accept-Encoding` header. When a client requests Brotli encoding, the cached response uses Brotli. When another client requests gzip, the cache stores and serves the gzip variant separately.

Response caching middleware includes similar vary-by-header support through the `VaryByHeader` property, creating separate cache entries for different encoding types. This ensures compressed responses are cached correctly without storing uncompressed variants or repeatedly compressing the same content.

### When Not to Compress

Compression overhead exceeds its benefit for small responses. Responses under 1-2 KB often become larger after compression due to compression metadata and headers. The middleware includes size thresholds to skip compression for small responses automatically, but you can configure this threshold based on your typical response sizes.

Pre-compressed content like images, videos, and already-compressed files should bypass compression middleware. Adding gzip or Brotli compression to a JPEG or PNG provides no benefit and wastes CPU. The `MimeTypes` configuration should include only compressible content types like JSON, XML, HTML, CSS, and JavaScript.

Highly dynamic content that changes on every request reduces caching effectiveness, which diminishes compression benefits. If the response can't be cached, each request pays the full compression cost. In these cases, evaluate whether the network transfer time saved by smaller payloads justifies the additional CPU usage per request.

## Request Decompression

Request decompression middleware automatically decompresses incoming requests that include compressed content. While most APIs focus on compressing responses to reduce bandwidth, large request payloads like file uploads, bulk data imports, or detailed analytics events benefit from client-side compression before transmission.

The middleware examines the `Content-Encoding` header on incoming requests. When the header indicates a supported compression algorithm like gzip, deflate, or Brotli, the middleware wraps the request body stream in a decompression stream. This happens transparently before the request reaches endpoint handlers, so controller actions and minimal API endpoints receive decompressed content without additional code.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRequestDecompression(options =>
{
    options.DecompressionProviders.Add("br", new BrotliDecompressionProvider());
    options.DecompressionProviders.Add("gzip", new GzipDecompressionProvider());
    options.DecompressionProviders.Add("deflate", new DeflateDecompressionProvider());
});

var app = builder.Build();

app.UseRequestDecompression();
```

Decompression occurs lazily when the request body is read during model binding or manual stream access. The middleware doesn't eagerly decompress the entire body on arrival; instead, it wraps the body stream so decompression happens as the application reads from it. This lazy approach reduces memory pressure and allows streaming decompression for large payloads.

If the middleware encounters a request with compressed content but cannot decompress it, such as an unsupported `Content-Encoding` value or multiple encoding values, it passes the request through without modification. The endpoint receives the compressed stream, and attempting to read it as uncompressed content will fail or produce garbage data. Proper error handling at the endpoint level should detect these cases and return appropriate error responses.

### Security Considerations

Request decompression creates potential denial-of-service vectors through decompression bombs. A small compressed payload can expand to gigabytes of data when decompressed, consuming excessive memory and CPU. The middleware doesn't include built-in size limits, so implementing request size limits through other means becomes critical.

ASP.NET Core's `MaxRequestBodySize` configuration limits the total request size before decompression. Setting this on the Kestrel server configuration prevents enormous compressed payloads from reaching the decompression middleware.

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB
});
```

Validating decompressed content size after reading the request body provides defense in depth. If your API expects requests under a certain size, reject requests that exceed that size after decompression, even if the compressed size passed the initial limit.

## Common Pitfalls

### File Uploads and Memory Consumption

Buffering large files consumes memory or disk space. Files larger than 64 KB move to temporary disk storage, but very large files or many concurrent uploads exhaust resources. Streaming avoids buffering but requires more complex code. Choose based on expected file sizes and upload frequency.
