---
title: "Caching and Performance"
layout: guide
category: "ASP.NET Core"
subcategory: "Performance & Operations"
description: "Comprehensive coverage of ASP.NET Core caching strategies including response caching, output caching, HybridCache, ETag-based validation, compression, async patterns, and JSON serialization optimization for high-performance APIs."
tags: [asp-net-core, performance, caching, compression, optimization, async-programming, json-serialization]
---

## Overview

Building high-performance APIs requires understanding the entire response pipeline. Caching prevents redundant work by storing results, compression reduces network transfer time, async patterns prevent thread starvation under load, and optimized serialization removes unnecessary runtime overhead. Each technique targets a different bottleneck, and choosing the right combination depends on your specific constraints.

This guide covers ASP.NET Core's caching middleware options, when to use response caching versus output caching, how HybridCache simplifies distributed caching, ETag-based conditional requests, compression strategies for responses and requests, async streaming patterns for large datasets, performance differences between minimal APIs and controllers, and JSON serialization optimization through source generators.

## Response Caching

Response caching stores HTTP responses based on HTTP headers and serves cached content directly to clients. The response caching middleware examines both client request headers and server response headers to determine cacheability, stores responses in memory, and returns cached responses to subsequent matching requests.

Response caching works through the interaction between the client, server, and caching middleware. When a server response includes appropriate cache headers like `Cache-Control` with a `max-age` directive, clients and intermediary caches can store the response and reuse it for subsequent requests within the specified time window. The middleware respects standard HTTP caching rules, which means both the client and server participate in determining whether caching occurs.

The `[ResponseCache]` attribute configures caching behavior for specific endpoints. When applied to a controller action or minimal API endpoint, it sets the necessary HTTP headers that instruct clients and caching middleware how to cache the response.

```csharp
[HttpGet("products")]
[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "category" })]
public IActionResult GetProducts(string category)
{
    var products = _repository.GetProductsByCategory(category);
    return Ok(products);
}
```

The `Duration` parameter specifies cache lifetime in seconds. `Location` controls where caching occurs: `Any` allows both client-side and server-side caching, `Client` restricts caching to the client only, and `None` disables caching entirely. `VaryByQueryKeys` creates separate cache entries for different query string parameter values, ensuring that requests with different parameters receive correctly cached responses rather than incorrectly shared ones.

Response caching only caches responses with a 200 OK status code. Error responses, redirects, and other status codes bypass caching regardless of headers. The middleware also requires GET or HEAD requests; POST, PUT, and DELETE requests never cache. Additionally, any request with an `Authorization` header or cookie-based authentication automatically disables caching to prevent leaking sensitive data between users.

### When Response Caching Fails

Response caching relies on client cooperation with cache headers, which creates reliability issues in practice. Modern browsers like Chrome and Edge automatically send `Cache-Control: max-age=0` headers on requests, effectively bypassing server-side response caching. This header instructs the server to return fresh content rather than cached content, even when the server has a valid cached response ready.

This behavior makes response caching unreliable for many API scenarios. The server correctly implements caching logic, stores responses in memory, and sets appropriate cache headers, but the client request headers override the server's caching intentions. Each request generates a new response despite the caching infrastructure being in place.

Response caching also stores nothing on the server side when configured with `ResponseCacheLocation.Client`. The middleware only sets headers telling the client to cache the response locally. If the client chooses to ignore those headers or sends override directives, caching doesn't happen at all.

## Output Caching

Output caching stores complete server responses in memory and serves them without executing endpoint logic. Unlike response caching, which relies on HTTP headers and client cooperation, output caching enforces server-side control over what gets cached and for how long. The middleware intercepts requests, checks for cached responses, and returns cached content immediately when available, bypassing controller or endpoint execution entirely.

Output caching was introduced in .NET 7 as a more reliable alternative to response caching. Because output caching ignores client cache headers like `Cache-Control: max-age=0`, it works consistently even when browsers and other clients send cache-busting headers. The server determines caching policy, and clients cannot override it.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(builder => builder.Expire(TimeSpan.FromMinutes(5)));

    options.AddPolicy("products", builder => builder
        .Expire(TimeSpan.FromMinutes(10))
        .SetVaryByQuery("category", "page"));

    options.AddPolicy("frequently-changing", builder => builder
        .Expire(TimeSpan.FromSeconds(30)));
});

var app = builder.Build();

app.UseOutputCache();
```

The base policy applies to all endpoints unless overridden by named policies. Named policies provide granular control over cache duration and cache key variation. The `SetVaryByQuery` method creates separate cache entries based on query parameter values, similar to response caching's `VaryByQueryKeys` but with server-enforced behavior.

Applying output caching to endpoints uses either attributes or extension methods depending on whether you use controllers or minimal APIs.

```csharp
// Controller-based API
[HttpGet("products")]
[OutputCache(PolicyName = "products")]
public IActionResult GetProducts(string category, int page)
{
    var products = _repository.GetProducts(category, page);
    return Ok(products);
}

// Minimal API
app.MapGet("/products", (string category, int page) =>
{
    var products = repository.GetProducts(category, page);
    return Results.Ok(products);
})
.CacheOutput("products");
```

Output caching defaults to in-memory storage through `IOutputCacheStore`, which uses the same underlying infrastructure as distributed caching. This means you can replace the default memory-based implementation with Redis, SQL Server, or another distributed cache provider to share cached responses across multiple application instances.

### Cache Invalidation

Output caching supports programmatic cache invalidation through tags. Tags group related cache entries, allowing you to invalidate multiple entries simultaneously rather than tracking individual cache keys.

```csharp
options.AddPolicy("product-details", builder => builder
    .Expire(TimeSpan.FromMinutes(15))
    .Tag("products"));

// Later, invalidate all entries with the "products" tag
await outputCacheStore.EvictByTagAsync("products", cancellationToken);
```

Tag-based invalidation addresses a common caching challenge: when underlying data changes, all cached representations of that data must be invalidated. Without tags, you would need to track every cache key derived from the changed data and invalidate them individually. Tags provide a declarative way to group related cache entries and invalidate them together with a single operation.

### Output Caching vs Response Caching

Output caching should be the default choice for most APIs. Response caching fails in practice because modern browsers send cache-busting headers that disable server-side caching, while output caching ignores these headers and enforces server-controlled caching policy. Response caching also requires cooperation between client and server, creating unpredictable behavior when clients don't respect cache headers.

Output caching stores responses on the server and serves them without executing endpoint logic, reducing CPU usage and database load. Response caching relies on cache headers and may store nothing on the server when configured for client-side caching only, providing no server-side performance benefit in those cases.

Response caching remains appropriate when you specifically want client-side caching behavior and understand that server-side caching may not occur reliably. Static content served through CDNs often uses response caching because CDNs respect standard HTTP caching headers, unlike browsers making direct API requests.

For UI applications like Razor Pages, output caching provides consistent caching regardless of browser behavior, while response caching frequently fails because browsers set request headers that prevent caching. For APIs, output caching eliminates the reliability issues inherent in response caching's dependency on client cooperation.

## HybridCache

HybridCache is a unified caching library introduced in .NET 9 that combines in-memory caching with distributed caching in a single API. Before HybridCache, implementing a two-tier caching strategy required manually coordinating between `IMemoryCache` for fast local access and `IDistributedCache` for shared state across application instances. HybridCache handles this coordination automatically, providing L1 (in-memory) and L2 (distributed) cache tiers with a simplified API.

The library addresses several common caching problems beyond just multi-tier coordination. Cache stampede protection ensures that when multiple concurrent requests for the same cache key arrive, only one request executes the underlying factory function while others wait for the result. Tag-based invalidation allows bulk invalidation of related cache entries without tracking individual keys. Automatic serialization handles converting objects to byte arrays for distributed cache storage, eliminating manual serialization boilerplate.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(5),
        LocalCacheExpiration = TimeSpan.FromMinutes(1)
    };
});

// Optionally add distributed cache for L2 tier
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
});
```

The `LocalCacheExpiration` controls how long entries stay in the fast L1 in-memory cache, while `Expiration` controls how long entries persist in the slower but shared L2 distributed cache. This separation allows different expiration policies for local versus distributed storage. Data remains locally cached for quick access while ensuring that changes propagate across application instances when the distributed cache updates.

Using HybridCache typically follows a cache-aside pattern where you request a value by key and provide a factory function that executes when the value doesn't exist in either cache tier.

```csharp
public async Task<Product> GetProductAsync(int productId, CancellationToken cancellationToken)
{
    return await _hybridCache.GetOrCreateAsync(
        $"product:{productId}",
        async cancel => await _repository.GetProductByIdAsync(productId, cancel),
        cancellationToken: cancellationToken
    );
}
```

HybridCache checks the L1 cache first. If the value exists there, it returns immediately with minimal overhead. If not found in L1, it checks the L2 distributed cache. If found in L2, it repopulates L1 and returns the value. If the value doesn't exist in either cache tier, it executes the factory function, stores the result in both cache tiers, and returns it.

### Cache Stampede Protection

Cache stampede occurs when a popular cache entry expires and multiple concurrent requests attempt to regenerate it simultaneously. Each request executes the expensive operation independently, creating a sudden spike in database load or external API calls. This spike can overwhelm downstream systems and create cascading failures during high traffic periods.

HybridCache detects concurrent requests for the same cache key and ensures the factory function executes only once. When the first request arrives and finds no cached value, HybridCache marks that key as being computed. Subsequent requests for the same key see the marker and wait for the first request to complete rather than executing the factory function independently. Once the first request completes and stores the result, all waiting requests receive the same cached value.

This behavior applies across both cache tiers and works even when the cache is completely cold. The protection operates through in-process coordination for the L1 cache and, when configured with distributed caching, can coordinate across multiple application instances to prevent stampedes at the L2 level as well.

### Tag-Based Invalidation

Tags group cache entries logically, allowing invalidation of all entries associated with a tag rather than tracking individual keys. When you tag multiple cache entries with the same tag, invalidating that tag removes all associated entries from both L1 and L2 cache tiers.

```csharp
var options = new HybridCacheEntryOptions
{
    Expiration = TimeSpan.FromMinutes(10),
    Tags = new[] { "products", $"category:{categoryId}" }
};

await _hybridCache.GetOrCreateAsync(
    $"product:{productId}",
    async cancel => await _repository.GetProductByIdAsync(productId, cancel),
    options,
    cancellationToken: cancellationToken
);

// Invalidate all product-related cache entries
await _hybridCache.RemoveByTagAsync("products", cancellationToken);
```

Without tag-based invalidation, updating a product would require knowing all cache keys that contain that product's data. If product data appears in search results, detail views, category listings, and recommendation lists, each with different cache keys, you would need to track and invalidate every key manually. Tags eliminate this tracking burden by creating logical groupings that map to data relationships rather than specific cache keys.

### When to Use HybridCache

HybridCache works best when you need caching across multiple application instances and want to avoid manually coordinating between local and distributed caches. Applications running on a single instance without horizontal scaling don't benefit from the distributed cache tier and can use `IMemoryCache` directly with less complexity.

The cache stampede protection provides value in high-traffic scenarios where expensive operations serve many concurrent users. If your application receives low traffic or your factory functions execute quickly, the coordination overhead may exceed the benefit. Similarly, tag-based invalidation matters most when cache entries have complex relationships requiring bulk invalidation; simple key-based invalidation suffices for isolated cache entries.

Applications that already have custom caching logic with fine-tuned behavior may find HybridCache's unified API too opinionated. The abstraction simplifies common cases but makes certain advanced scenarios more difficult, like custom serialization logic or cache-specific optimizations that differ between local and distributed tiers.

## ETag-Based Caching

ETags provide conditional request validation, allowing servers to return a 304 Not Modified response instead of resending unchanged content. An ETag is a hash or version identifier representing the current state of a resource. Clients include the ETag value in subsequent requests via the `If-None-Match` header, and the server compares the client's ETag with the current resource's ETag. When they match, the server returns 304 Not Modified with no response body, saving bandwidth and processing time.

Unlike cache expiration where the client assumes cached content is valid until expiration time, ETags allow the client to validate whether cached content remains current. This matters for resources that change unpredictably or where cache expiration would be too conservative. The client avoids downloading the full response body when content hasn't changed while still ensuring it has the latest version when content does change.

Implementing ETag support requires computing an ETag for responses and comparing it with incoming `If-None-Match` headers. The computation can use a hash of the response content, a version number from a database row, or any stable identifier that changes when the resource changes.

```csharp
public async Task<IActionResult> GetProduct(int productId)
{
    var product = await _repository.GetProductByIdAsync(productId);

    if (product == null)
        return NotFound();

    var etag = Convert.ToBase64String(
        SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(product))
    );

    Response.Headers.ETag = $"\"{etag}\"";

    if (Request.Headers.IfNoneMatch == etag)
        return StatusCode(304);

    return Ok(product);
}
```

The ETag header value must be wrapped in quotes as per HTTP specification. The server serializes the product, computes a hash, and sets the ETag header before checking whether the client's `If-None-Match` header matches. When it matches, returning a 304 status code tells the client to use its cached copy.

### ETag Computation Strategies

Hashing the full response content ensures the ETag changes whenever any property changes, but requires serializing and hashing the entire response on every request. This overhead defeats the purpose of ETags when the content is large or expensive to serialize.

Database version columns provide efficient ETags when available. Many databases support row versioning or timestamps that automatically update on modification. Returning the version column with the entity and using it as the ETag avoids serialization and hashing overhead.

```csharp
public async Task<IActionResult> GetProduct(int productId)
{
    var product = await _repository.GetProductByIdAsync(productId);

    if (product == null)
        return NotFound();

    var etag = $"\"{product.RowVersion}\"";
    Response.Headers.ETag = etag;

    if (Request.Headers.IfNoneMatch == etag)
        return StatusCode(304);

    return Ok(product);
}
```

Combining ETags with caching maximizes efficiency. Output caching or HybridCache stores the full response, eliminating computation and database queries. ETags reduce bandwidth when content hasn't changed. The server checks the ETag first; if it matches, return 304 without retrieving the cached response body. If it doesn't match, retrieve and return the cached response.

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

## Async Patterns and Non-Blocking I/O

ASP.NET Core uses an async programming model to maximize throughput under high concurrency. When a request handler executes synchronous I/O operations like blocking database queries or HTTP calls, it holds a thread from the thread pool until the operation completes. Under heavy load, thread pool exhaustion occurs when all threads are blocked waiting for I/O, preventing the server from accepting new requests even though CPU and network resources remain available.

Async methods using `async` and `await` release threads back to the thread pool while waiting for I/O operations. The thread becomes available to process other requests, and when the I/O completes, the continuation resumes on any available thread pool thread. This allows a small number of threads to handle thousands of concurrent requests as long as those requests spend most of their time waiting for I/O rather than consuming CPU.

```csharp
// Blocks thread until database query completes
public IActionResult GetProducts()
{
    var products = _repository.GetProducts(); // Synchronous
    return Ok(products);
}

// Releases thread while waiting for database query
public async Task<IActionResult> GetProductsAsync()
{
    var products = await _repository.GetProductsAsync(); // Asynchronous
    return Ok(products);
}
```

The async version appears to do the same work but behaves differently under load. When multiple requests call `GetProducts`, each blocks a thread until the database responds. When multiple requests call `GetProductsAsync`, they release threads while waiting for the database, allowing those threads to process other requests. The same thread pool serves more concurrent requests without adding threads.

### Common Async Pitfalls

Mixing synchronous and asynchronous code creates hidden blocking. Calling `.Result` or `.Wait()` on a `Task` turns async code into blocking code, defeating the purpose of async programming. The thread blocks waiting for the task to complete, preventing the runtime from using that thread elsewhere.

```csharp
// Bad: blocks thread despite using async repository method
public IActionResult GetProducts()
{
    var products = _repository.GetProductsAsync().Result;
    return Ok(products);
}
```

This creates a worse situation than pure synchronous code. The application pays the overhead of async machinery while still blocking threads, and in some contexts it can cause deadlocks when the task tries to resume on a blocked synchronization context.

Async methods should avoid CPU-intensive work that doesn't involve I/O. If an operation computes results without waiting for external resources, async provides no benefit. The thread must remain busy performing the computation regardless of whether the method signature uses `async`. Adding `async` to CPU-bound work adds overhead without improving throughput.

Forgetting to await asynchronous calls creates fire-and-forget behavior where the method returns before the async operation completes. The compiler warns about unawaited tasks, but ignoring these warnings leads to incomplete operations, lost exceptions, and unpredictable behavior.

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

## Minimal API vs Controller Performance

Minimal APIs introduced in .NET 6 provide a simplified programming model for building APIs without the overhead of MVC controllers. Benchmarks show minimal APIs consistently perform better than controller-based APIs, though the practical difference in real-world scenarios is often negligible.

Minimal APIs avoid the MVC model binding and action filter infrastructure that controllers rely on. Controllers invoke a pipeline of filters, perform model validation, and resolve parameters through a complex binding system. Minimal APIs use a simpler parameter resolution mechanism and skip features like action filters unless explicitly added.

This reduced infrastructure translates to lower memory allocations per request and faster request processing. In high-throughput scenarios serving thousands of requests per second, the difference becomes measurable. For typical APIs handling hundreds of requests per second, the performance gap is small enough that other factors like database query performance and caching strategy matter more.

```csharp
// Minimal API - lower overhead
app.MapGet("/products/{id}", async (int id, IProductRepository repo) =>
{
    var product = await repo.GetProductByIdAsync(id);
    return product is not null ? Results.Ok(product) : Results.NotFound();
});

// Controller-based API - more infrastructure
[HttpGet("{id}")]
public async Task<ActionResult<Product>> GetProduct(int id)
{
    var product = await _repository.GetProductByIdAsync(id);
    return product is not null ? Ok(product) : NotFound();
}
```

The minimal API version explicitly returns result types like `Results.Ok()` and `Results.NotFound()`, while the controller version uses inherited methods and automatic result conversion. This explicit approach in minimal APIs gives the runtime fewer decisions to make and fewer abstractions to traverse.

### Choosing Between Minimal APIs and Controllers

Performance alone rarely justifies choosing minimal APIs over controllers. The decision should consider team familiarity, project structure preferences, and whether you need controller-specific features like action filters, model binding customization, and the structured organization controllers provide.

Controllers offer better organization for large APIs with many endpoints. Action filters, route groups, and controller-level attributes reduce code duplication. The framework provides more out-of-the-box functionality like automatic model validation and binding from multiple sources simultaneously.

Minimal APIs work well for small to medium APIs, microservices with focused responsibilities, and teams that prefer functional programming styles over object-oriented controller hierarchies. The reduced ceremony and explicit nature make endpoints easier to understand in isolation.

For new projects, Microsoft recommends minimal APIs as the default choice, and controller-based APIs remain fully supported for teams that prefer their structure and features. Hybrid approaches work too; a single application can use minimal APIs for simple endpoints and controllers for complex ones.

## JSON Serialization Performance with Source Generators

ASP.NET Core uses `System.Text.Json` for JSON serialization by default. Traditional reflection-based serialization inspects types at runtime to determine which properties to serialize, how to convert values, and how to handle special cases. This runtime inspection adds overhead to each serialization operation, particularly on startup when the serializer builds metadata about types.

Source generators introduced in .NET 6 eliminate this runtime reflection by generating serialization code at compile time. The generator analyzes your types during compilation and produces optimized serialization methods as source code. The runtime uses these pre-generated methods instead of performing reflection, reducing both startup time and per-request serialization overhead.

```csharp
[JsonSerializable(typeof(Product))]
[JsonSerializable(typeof(List<Product>))]
[JsonSerializable(typeof(ErrorResponse))]
internal partial class AppJsonSerializerContext : JsonSerializerContext
{
}
```

The `JsonSerializable` attributes tell the source generator which types it should generate serialization code for. The context class must be partial so the generator can add its generated code. After defining the context, configure ASP.NET Core to use it.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonSerializerContext.Default);
});
```

This configuration tells the JSON serializer to use the generated context for type information before falling back to reflection. Types registered in the context serialize through generated code, while unregistered types still work through reflection.

### Source Generation Modes

Source generators support two modes: metadata collection and serialization optimization. Metadata mode generates type metadata at compile time but still performs standard serialization logic at runtime. This improves startup time and reduces memory usage compared to reflection while maintaining full compatibility with all serialization features.

Serialization optimization mode, also called fast-path mode, generates specialized serialization methods that directly write JSON to the output stream. This provides the best performance but doesn't support all serialization features like custom converters, reference handling, or polymorphic serialization. The serializer automatically falls back to standard logic when encountering unsupported features.

```csharp
[JsonSerializable(typeof(Product))]
[JsonSourceGenerationOptions(GenerationMode = JsonSourceGenerationMode.Serialization)]
internal partial class FastPathJsonContext : JsonSerializerContext
{
}
```

Most APIs can use serialization optimization mode because they serialize simple data transfer objects without complex features. When the fast path doesn't support your requirements, metadata mode still provides meaningful performance improvements over pure reflection.

### Practical Impact

Serialization performance improvements are most noticeable in high-throughput APIs where serialization becomes a significant portion of request processing time. For APIs that spend most of their time in database queries or external service calls, serialization optimization produces smaller gains.

Startup time reduction matters for serverless functions, containers with short lifetimes, and applications that frequently cold start. Generating serialization metadata at compile time eliminates the reflection-based metadata collection that occurs during the first serialization of each type.

The memory footprint reduction from avoiding reflection can be significant in memory-constrained environments. Pre-generated metadata consumes less memory than runtime-built metadata, and the generated code often produces less garbage during serialization, reducing GC pressure.

## Red Flags

Watch for these signs that caching or performance optimizations are implemented incorrectly or may cause problems:

- **Response caching configured but never working**: If you've configured response caching and it seems ineffective, check for client cache headers. Modern browsers send `Cache-Control: max-age=0` which overrides server caching. Use output caching instead for reliable server-side caching.

- **Cache invalidation by time only**: Relying purely on expiration times for cache invalidation works for stable data but creates data freshness problems for data that changes unpredictably. Combine time-based expiration with event-based invalidation using tags or explicit removal.

- **Caching authenticated responses**: Response caching and output caching should never cache responses for authenticated users. Cached responses might leak to other users. Ensure cache policies exclude authenticated requests or use cache key variation that includes user identity.

- **Synchronous I/O in API endpoints**: Blocking database calls, HTTP client requests, or file I/O operations waste threads under load. Every I/O operation should use async patterns unless you've explicitly verified that synchronous behavior is required.

- **Async methods without await**: Methods marked `async` that don't await anything add overhead without benefit. Either remove the `async` keyword or await asynchronous operations. Fire-and-forget async calls often indicate missing error handling.

- **Streaming endpoints that buffer everything**: Returning `IAsyncEnumerable<T>` but calling `.ToList()` before yielding items defeats the purpose of streaming. The entire collection loads into memory before streaming begins, wasting memory and delaying time-to-first-byte.

- **Compression enabled for pre-compressed content**: Compressing images, videos, or already compressed files wastes CPU without reducing size. Configure compression middleware to skip non-compressible MIME types.

- **No request size limits with decompression**: Request decompression without size limits creates vulnerability to decompression bombs. Set `MaxRequestBodySize` and validate decompressed content size.

- **Source generators not configured**: If you've added JSON source generator attributes but didn't configure `TypeInfoResolverChain`, the runtime ignores the generated code and uses reflection. Verify configuration connects the serializer to the generated context.

- **Using Result or Wait on Tasks**: Blocking on async tasks turns asynchronous code into synchronous code, causing thread starvation and potential deadlocks. Use await instead, or redesign the calling code to be async.

## Key Takeaways

Caching strategies in ASP.NET Core serve different purposes. Output caching provides reliable server-side caching with consistent behavior regardless of client headers, making it the default choice for most APIs. Response caching remains relevant for CDN integration and client-side caching scenarios. HybridCache simplifies distributed caching with automatic coordination between local and distributed cache tiers, cache stampede protection, and tag-based invalidation.

ETag-based validation reduces bandwidth by allowing clients to validate cached content without retransmitting unchanged responses. Combining ETags with caching maximizes efficiency by eliminating computation through caching while eliminating bandwidth waste through conditional requests.

Compression reduces payload size at the cost of CPU time. Brotli provides better compression ratios while gzip compresses faster. The middleware handles content negotiation automatically based on client capabilities. Request decompression handles incoming compressed payloads transparently but requires size limits to prevent decompression-based attacks.

Async programming patterns maximize throughput by releasing threads during I/O operations. The thread pool handles more concurrent requests with fewer threads when requests spend time waiting rather than blocking. Streaming large result sets with `IAsyncEnumerable<T>` reduces memory usage and improves time-to-first-byte by sending data as it becomes available rather than buffering entire collections.

Minimal APIs perform better than controller-based APIs due to reduced infrastructure overhead, though the difference is rarely the deciding factor in choosing between them. JSON source generators eliminate reflection overhead during serialization, reducing startup time, memory usage, and per-request serialization cost. The fast-path serialization mode provides maximum performance for simple data transfer objects while metadata mode improves performance with full feature compatibility.
