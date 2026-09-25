---
title: "Output Caching and HTTP Caching"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Operations"
description: "Reusing whole API responses in ASP.NET Core: the output caching middleware and its default rules, policies, cache keys, locking, tag eviction, and Redis storage; Cache-Control headers for clients and CDNs; why the response caching middleware rarely fits; and ETags for 304 revalidation and If-Match optimistic concurrency."
tags: [practical, caching, output-caching, http-caching, etags, optimistic-concurrency]
---

An API that computes the same response for many requests can hand out an earlier copy instead. Where that copy lives decides who controls it. A browser, an HTTP client library, or a CDN in front of the API can keep it, governed by the headers the API sends. The app itself can keep whole responses in its output cache, governed by policies in code. And an endpoint can cache the data it reads, such as with `HybridCache`, which still runs the endpoint but skips the database. This guide covers the first two, where the unit being reused is an HTTP response, and the conditional requests that let a client check whether its copy is still current.

{% include figure.html id="asp-cache-layers" %}

## Output Caching

The output caching middleware, added in .NET 7, stores complete responses on the server and serves them without running the endpoint. The app decides what is cached and for how long, and a client's `Cache-Control` request header can't override it, so a client can't force a fresh response.

```csharp
builder.Services.AddOutputCache();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();   // after CORS, authentication, and authorization

app.MapGet("/products", ListProducts).CacheOutput();
app.MapGet("/products/{id:int}", GetProduct)
    .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(5)).Tag("products"));
```

Registering the middleware caches nothing by itself. Caching happens only for endpoints that opt in, through `CacheOutput()` on a minimal API endpoint or route group, or `[OutputCache]` on a controller or action. The ordering matters for security. Placed before authorization, the middleware could serve a response cached from an authorized request to a caller who would have been refused. It also belongs after `UseCors`, and after `UseRouting` in an app that calls it explicitly.

### What Gets Cached by Default

The default policy, which every policy starts from unless it opts out, caches only a narrow set of responses:

- Only `GET` and `HEAD` requests.
- Only `200 OK` responses.
- Not responses that set a cookie.
- Not requests from an authenticated user or with an `Authorization` header.

The last rule surprises API developers most. An API secured with bearer tokens sends an `Authorization` header on every request, so the default policy caches none of them, even when the response is the same for every caller. Caching those responses takes a custom `IOutputCachePolicy` that allows lookup and storage for authenticated requests. If the response differs by caller, the policy also has to add the caller's identity to the cache key, or one user's data is served to the next.

The default policy doesn't look at the response's own `Cache-Control` header either. A response the endpoint marks `private` or `no-store` is still stored and served to the next caller if the policy allows caching, so `private` protects nothing on the server. In the other direction, output caching writes no `Cache-Control` header for clients, so browsers and CDNs cache nothing unless the endpoint sets headers too.

Entries expire after 60 seconds unless a policy sets a different time. The cache key includes the whole URL: scheme, host, port, path, and every query string parameter, with the path compared case-insensitively.

### Policies and Cache Keys

Named policies collect settings shared by several endpoints. A *base* policy applies to every request, which makes it the easy way to cache everything by accident:

```csharp
builder.Services.AddOutputCache(options =>
{
    // Applies to every endpoint, and starts from the default policy, so it
    // caches every eligible GET in the app, not just the ones marked CacheOutput
    options.AddBasePolicy(policy => policy.Expire(TimeSpan.FromSeconds(30)));

    options.AddPolicy("catalog", policy => policy
        .Expire(TimeSpan.FromMinutes(10))
        .SetVaryByQuery("category", "page")
        .Tag("products"));

    options.AddPolicy("live", policy => policy.NoCache());
});

app.MapGet("/products", ListProducts).CacheOutput("catalog");
app.MapGet("/stock", GetStock).CacheOutput("live");
```

`SetVaryByQuery` replaces the default of every query parameter with the named ones. Two requests that differ only in another parameter, such as a tracking ID, then share one entry, which is right when that parameter doesn't change the response and wrong when it does. `SetVaryByHeader` adds request headers to the key, such as `Accept-Language` for a localized response, and `VaryByValue` adds any value computed from the request. `NoCache()` exempts an endpoint from a base policy.

### Locking Against Stampedes

When a popular entry expires, many requests can miss at once, and each would run the endpoint and hit the database. The middleware prevents that by default. The first request for a missing key computes the response, and concurrent requests for the same key wait for it and receive the stored copy. `SetLocking(false)` turns this off for a policy, which suits endpoints so cheap that waiting costs more than recomputing.

### Evicting with Tags

Expiration alone serves stale data until the entry times out. Tags let a write evict every cached response built from the data it changed:

```csharp
app.MapPut("/products/{id:int}", async (int id, ProductUpdate update,
    AppDbContext db, IOutputCacheStore cache, CancellationToken ct) =>
{
    // ...update and save the product...

    await cache.EvictByTagAsync("products", ct);
    return Results.NoContent();
});
```

A tag names a group of entries, so the write doesn't need to know every URL whose response included the product. In the samples above, both the `catalog` policy and the detail endpoint tag their entries `products`, so one call evicts the list, every filtered page, and every detail entry. A tag that is too broad evicts more than needed, and a large catalogue may tag by category as well as by `products`.

### Storage Across Instances

By default the cache lives in the app's own memory, so each instance keeps its own copy and loses it on restart. Two instances behind a load balancer each compute and cache the response, and evicting a tag on one instance leaves the other serving the old copy. Memory use is capped by `SizeLimit` (100 MB by default), and a response body larger than `MaximumBodySize` (64 MB) isn't cached.

A shared store fixes both problems. The `Microsoft.AspNetCore.OutputCaching.StackExchangeRedis` package adds `AddStackExchangeRedisOutputCache`, which keeps entries and tags in Redis. It is a different method from `AddStackExchangeRedisCache`, which registers an `IDistributedCache`. Microsoft advises against building an output cache store on `IDistributedCache`, because it lacks the atomic operations tagging needs.

## HTTP Caching Headers

The caches outside the app, in the client and in any CDN or proxy between them, follow the headers on the response. A response the client reuses from its own cache never reaches the server at all, which no server-side cache can match.

| Directive | Meaning |
|---|---|
| `max-age=N` | Any cache may reuse the response for N seconds |
| `s-maxage=N` | Overrides `max-age` for shared caches such as CDNs |
| `public` | Shared caches may store it even for a request with an `Authorization` header, which they otherwise refuse |
| `private` | Only the client's own cache may store it, never a shared cache |
| `no-cache` | Caches may store it but must check with the server before each reuse |
| `no-store` | No cache may store it |

An `ETag` header lets a cache check whether its expired copy is still current instead of downloading it again, as covered below. `Vary` names the request headers that change the response, such as `Accept-Encoding` or `Accept-Language`, so a cache keeps a separate copy for each value. A response that depends on who is asking is marked `private` or `no-store`. A `public` response for a signed-in user can end up in a CDN and be served to strangers.

Controllers set these headers with `[ResponseCache]`. `Duration` sets `max-age`, and `Location` sets `public` (`Any`), `private` (`Client`), or `no-cache` (`None`). `NoStore = true` sets `no-store`. The attribute is an MVC filter, so minimal APIs set the header directly:

```csharp
app.MapGet("/countries", (HttpContext http) =>
{
    http.Response.GetTypedHeaders().CacheControl = new CacheControlHeaderValue   // Microsoft.Net.Http.Headers
    {
        Public = true,
        MaxAge = TimeSpan.FromHours(1)
    };
    return Results.Ok(Countries.All);
});
```

Headers and output caching combine well. Output caching saves the server's work, and the headers let clients and a CDN skip the request entirely.

## The Response Caching Middleware

`UseResponseCaching` is an older server-side cache that follows HTTP caching rules instead of app policies. It stores only responses marked `public`, never for a request with an `Authorization` header or a response that sets a cookie. Following the HTTP rules also means honoring the client's request headers. A client that sends `Cache-Control: no-cache`, as browsers commonly do when the user refreshes, gets a freshly computed response every time, and the app has no setting to change that.

Microsoft's docs recommend output caching over it for UI apps, and the same reasoning applies to most APIs. The server, not the client, should decide when its work is reused. The middleware fits only public, anonymous `GET` endpoints whose clients send no cache-busting headers. `[ResponseCache]` doesn't need it. The attribute only writes headers, and only its `VaryByQueryKeys` property depends on the middleware.

## Conditional Requests with ETags

An *ETag* is a response header carrying an identifier for the current version of a resource, in quotes, such as `"AAAAAAAAB9E="`. Clients send it back in a conditional header, and the server answers based on whether the version still matches. The same header supports two different jobs.

### Revalidating a Cached Copy: 304 Not Modified

A client holding an expired copy sends its ETag in `If-None-Match`. If the resource hasn't changed, the server answers `304 Not Modified` with no body, and the client keeps using its copy. That saves the transfer, though not necessarily the work of finding out.

With output caching, revalidation is automatic. An endpoint that sets an `ETag` header gets its response cached with it, and the middleware answers a matching `If-None-Match` with 304 from the cache. Without `If-None-Match`, it also answers 304 to an `If-Modified-Since` date at or after the cached response's `Last-Modified` header, or its `Date` header if the endpoint set no `Last-Modified`. Without output caching, the endpoint compares the tags itself. A row-version column makes a cheap ETag, because the database changes it on every update:

```csharp
app.MapGet("/products/{id:int}", async (int id, HttpContext http, AppDbContext db) =>
{
    var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
    if (product is null) return Results.NotFound();

    var etag = new EntityTagHeaderValue($"\"{Convert.ToBase64String(product.RowVersion)}\"");
    http.Response.GetTypedHeaders().ETag = etag;

    var ifNoneMatch = http.Request.GetTypedHeaders().IfNoneMatch;
    if (ifNoneMatch.Any(tag => tag.Compare(etag, useStrongComparison: false)))
        return Results.StatusCode(StatusCodes.Status304NotModified);

    return Results.Ok(product);
});
```

`RowVersion` is an EF Core `[Timestamp]` property, a `byte[]` on SQL Server, so it needs encoding before it can go in a header. `EntityTagHeaderValue` and the typed header accessors live in `Microsoft.Net.Http.Headers`. `If-None-Match` can list several tags, and they may be *weak* (`W/"..."`), meaning semantically equivalent rather than byte-identical. `EntityTagHeaderValue` parses both, which a plain string comparison doesn't. This version still queries the database on every request. Hashing the serialized response instead also works for data without a version column, but it pays for serialization and hashing on every request just to discover that nothing changed.

### Preventing Lost Updates: If-Match and 412

Two clients read the same product, both edit it, and both save. Without a check, the second save silently overwrites the first. *Optimistic concurrency* prevents that without locking anything. Each write states which version it was based on, and the write fails if that is no longer the current version. Over HTTP, the client sends the ETag it edited in `If-Match`, and the server refuses the write with `412 Precondition Failed` if the resource has changed since.

The server checks twice. It compares the tag against the version it just loaded, which catches edits made before this request. Then EF Core's *concurrency token* covers the gap between that load and the save. For a `[Timestamp]` property, EF Core adds `WHERE RowVersion = <the loaded value>` to the `UPDATE`, so if another write changed the row in between, no row matches and `SaveChangesAsync` throws `DbUpdateConcurrencyException`.

```csharp
app.MapPut("/products/{id:int}", async (int id, ProductUpdate update, HttpContext http, AppDbContext db) =>
{
    var ifMatch = http.Request.GetTypedHeaders().IfMatch;
    if (ifMatch.Count == 0)   // no usable If-Match: require the client to send one
        return Results.StatusCode(StatusCodes.Status428PreconditionRequired);

    var product = await db.Products.FindAsync(id);
    if (product is null) return Results.NotFound();

    // Strong comparison: a weak tag or another version's tag fails the precondition
    var current = new EntityTagHeaderValue($"\"{Convert.ToBase64String(product.RowVersion)}\"");
    if (!ifMatch.Any(tag => tag.Equals(EntityTagHeaderValue.Any)
                         || tag.Compare(current, useStrongComparison: true)))
        return Results.StatusCode(StatusCodes.Status412PreconditionFailed);

    product.Name = update.Name;
    product.Price = update.Price;

    try
    {
        await db.SaveChangesAsync();
    }
    catch (DbUpdateConcurrencyException)
    {
        return Results.StatusCode(StatusCodes.Status412PreconditionFailed);
    }

    return Results.NoContent();
});
```

`If-Match` uses strong comparison, so a weak tag never matches, and `If-Match: *` means any current version, so it only requires that the resource exists. The client's tag is compared as an opaque string, never decoded, so a well-formed but invented tag fails to match and gets 412. A header with no parseable tag at all comes back as an empty list, so it gets the same 428 as a missing header. An API that requires the header answers a request without it with `428 Precondition Required`, which tells clients to read before they write. A client that gets 412 re-reads the resource, reapplies or shows the conflict, and tries again with the new ETag.

## Choosing Where to Cache

| Situation | Use |
|---|---|
| Anonymous `GET`s with the same response for everyone | Output caching, plus `Cache-Control: public` so a CDN can serve them too |
| Responses per user | `Cache-Control: private` for the client's own cache; output caching only with a custom policy keyed on the user, since output caching ignores `private` |
| Data changes at unpredictable times | Output caching with tag eviction on writes, or ETags so clients revalidate cheaply |
| Several app instances | The Redis output cache store, so entries and evictions are shared |
| Reuse data across different responses | A data cache such as `HybridCache` inside the endpoint |
| Concurrent edits to the same resource | `If-Match` with an EF Core concurrency token |

## Key Takeaways

- Output caching is the server-side response cache to reach for. The server decides, clients can't bypass it, and it prevents stampedes and supports tag eviction.
- By default it caches only anonymous `GET` and `HEAD` requests returning 200 without cookies. A request with an `Authorization` header is never cached unless a custom policy allows it, and that policy must key on the user if responses differ by user.
- `UseOutputCache` goes after CORS, authentication, and authorization. A base policy caches every eligible endpoint in the app.
- Output caching ignores the response's `Cache-Control` and doesn't write one, so server caching and client caching are configured separately.
- The in-memory store is per instance. Multiple instances need the Redis output cache store, not an `IDistributedCache`.
- `Cache-Control` headers let clients and CDNs skip the server entirely. Mark per-user responses `private` or `no-store`.
- The response caching middleware obeys client cache headers, so browsers and clients can defeat it. Prefer output caching.
- ETags serve two purposes: `If-None-Match` for 304 revalidation, which output caching handles automatically, and `If-Match` with 412 for optimistic concurrency.
