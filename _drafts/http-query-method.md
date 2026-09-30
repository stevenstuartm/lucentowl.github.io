---
layout: post
title: "HTTP QUERY Settles the GET-With-a-Body Argument"
description: "RFC 10008 gives complex reads a method that is safe, idempotent, and carries a body, which ends the choice between overlong GET URLs and POST endpoints that hide the fact that they're reads. The contract works today at endpoints you control, but the caching it promises waits on browsers and CDNs that don't yet key responses on the body."
tags: [architecture, api-design, rest, http, caching]
author: steven-stuart
sources:
  - title: "RFC 10008: The HTTP QUERY Method"
    url: "https://www.rfc-editor.org/rfc/rfc10008.html"
  - title: "RFC 9110: HTTP Semantics"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html"
  - title: "MDN: Using the Fetch API"
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch"
  - title: "Elasticsearch 6.8 Reference: Request Body Search"
    url: "https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-body.html"
  - title: "GraphQL over HTTP (working draft)"
    url: "https://http-spec.graphql.org/draft/"
  - title: "Microsoft.Extensions.Http.Resilience: DisableForUnsafeHttpMethods"
    url: "https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.http.resilience.httpretrystrategyoptionsextensions.disableforunsafehttpmethods"
  - title: "dotnet/aspnetcore #63260: Add HttpMethods.Query"
    url: "https://github.com/dotnet/aspnetcore/pull/63260"
  - title: "dotnet/aspnetcore #61089: Support the new QUERY HTTP method"
    url: "https://github.com/dotnet/aspnetcore/issues/61089"
  - title: "OpenAPI Specification 3.2.0"
    url: "https://spec.openapis.org/oas/v3.2.0.html"
  - title: "spring-projects/spring-framework #34993: Support the HTTP QUERY method"
    url: "https://github.com/spring-projects/spring-framework/pull/34993"
  - title: "envoyproxy/envoy #46496: Add support for the QUERY method"
    url: "https://github.com/envoyproxy/envoy/pull/46496"
  - title: "Mozilla standards-positions #1430: The HTTP QUERY Method"
    url: "https://github.com/mozilla/standards-positions/issues/1430"
  - title: "Amazon CloudFront: Cache behavior settings"
    url: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesCacheBehavior.html"
  - title: "cloudflare/workerd #6849: Support caching HTTP QUERY responses"
    url: "https://github.com/cloudflare/workerd/issues/6849"
  - title: "nodejs/undici #5459: Support HTTP QUERY method"
    url: "https://github.com/nodejs/undici/pull/5459"
  - title: "API Design Architecture"
    url: "/study-guides/architecture/api-design-architecture.html"
---

If you've built a search screen with more than a handful of filters, you've probably had this argument. Someone puts the filters in the query string, the URL grows past what a proxy will accept, and the team splits. One side wants to send the filters as a body on a GET, and the other says GET bodies aren't allowed, so the endpoint becomes a POST. The POST works, and a read now looks like a write to everything between the client and the server.

In June 2026 the IETF published RFC 10008, which defines a QUERY method that is safe and idempotent like GET and carries a body like POST. That settles the argument about what a complex read should be. It doesn't yet deliver everything the method promises. The contract, meaning the retries, the visible intent, and the documentation, works today at endpoints you control. The shared caching that was the method's headline benefit waits on browsers and CDNs that don't yet key a response on the request body.

## Complex Reads Have Had Only Bad Options

### GET Runs Out of URL

RFC 9110 recommends that senders and recipients support URIs of at least 8,000 octets, and that's a recommendation, not a limit anyone has to honor. A request can pass through a browser, a CDN, a load balancer, an API gateway, and a web server, each with its own ceiling, and the client learns the smallest one when a request fails with `414 URI Too Long`. A search with a list of IDs, a polygon, or a nested boolean filter runs into that ceiling at some unpredictable size.

Length isn't the only cost. URLs end up in access logs, browser history, and analytics tools far more often than request bodies do, so a search on customer name or account number leaks into places a body wouldn't. And encoding structured criteria into query parameters means inventing a syntax for nesting and escaping that every client has to reproduce.

### GET With a Body Has No Meaning

The obvious fix is to put the criteria in a GET body. RFC 9110 closes that door. Content in a GET request "has no generally defined semantics, cannot alter the meaning or target of the request, and might lead some implementations to reject the request and close the connection because of its potential as a request smuggling attack." A client "SHOULD NOT" send one unless the origin server has said it will be supported, and even then the server "SHOULD NOT rely on private agreements," because nobody on the path agreed to them.

Browsers settle it for any web client. The Fetch API refuses to send a body with a GET, and MDN's guide to it says so plainly. Elasticsearch, which accepts search criteria in a GET body, also accepts the same request as a POST, and its older reference documentation gave the reason: "Since not all clients support GET with body, POST is allowed as well."

### POST Works by Hiding That the Request Is a Read

So complex reads become POSTs, and GraphQL made that the default for a whole ecosystem. The GraphQL over HTTP specification requires servers to support POST and leaves GET optional, and it tells clients that hit a `414` to "consider using POST instead."

POST gets the criteria to the server, but it tells every component on the path the wrong thing about the request. RFC 10008 states the cost in its introduction. With a POST, "it is not readily apparent," without knowing the specific resource and server, "that a safe, idempotent query is being performed." Two concrete things are lost as a result.

**Caching.** Under RFC 9110, a cached POST response can satisfy a later GET, but "a POST request cannot be satisfied by a cached POST response because POST is potentially unsafe." A search endpoint served by POST gets no help from a shared cache, however often the same search repeats.

**Retries.** RFC 9110 says a client "SHOULD NOT automatically retry a request with a non-idempotent method" unless it knows better. Retry policies tend to decide by method, not by endpoint. In .NET, `Microsoft.Extensions.Http.Resilience` offers `DisableForUnsafeHttpMethods()`, which turns off retries for POST, PATCH, PUT, DELETE, and CONNECT. A team that turns it on, to stop duplicate orders, also stops retrying every search that times out on a transient failure, because the search is a POST too.

Neither loss comes from a mistake by the team that chose POST. They come from HTTP having no method that said "this is a read, and here is its input."

## QUERY Names What a Search Endpoint Is

RFC 10008 defines that method. A QUERY request asks the target resource to run the query described in the body "within the scope of that target resource," and the method is "explicitly safe and idempotent, allowing functions like caching and automatic retries to operate." Julian Reschke of greenbytes, James Snell of Cloudflare, and Mike Bishop of Akamai wrote it in the IETF's HTTP working group, and it's a Proposed Standard registered with IANA, not a vendor extension.

```http
QUERY /orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/json

{ "status": ["pending", "held"], "customerIds": [1042, 2217, 3380], "placedAfter": "2026-01-01" }
```

### The Body Has Defined Semantics

Unlike a GET body, a QUERY body means something, and the RFC is strict about how the server reads it. A server "MUST fail the request" if `Content-Type` is missing or doesn't match the content, and it may not sniff the content to guess the type. The RFC recommends `415 Unsupported Media Type` for a query format the resource doesn't accept, and `422 Unprocessable Content` for a well-formed query it can't run, with the example of a valid SQL query naming a table that doesn't exist. A new `Accept-Query` response header lets a resource advertise which query formats it takes.

The idea isn't new. WebDAV already had safe, idempotent methods with bodies in `SEARCH`, `REPORT`, and `PROPFIND`, and the RFC's appendix says the specification was called SEARCH in its early stages. The working group chose a new name partly because those methods tie their meaning to a generic XML body and, in the RFC's words, "many have mixed feelings" about WebDAV. What's new is a general method any HTTP API can use, with its semantics in the method registry rather than in one server's documentation.

### A Query Can Become a URL

The RFC also answers the objection that important resources should have URIs. A server may give the query itself a URI in the `Location` response header, which the RFC describes as a claim that "a client can send a GET request to the indicated URI to repeat the query operation just performed without resending the query content." A `Content-Location` header can name a URI for the specific results, and a `303 See Other` sends the client to fetch the results with GET. A complex search can start as a QUERY and continue as an ordinary, bookmarkable, cacheable GET.

## The Contract Works Today

Most of what QUERY offers needs support only at the two ends of the request, and those ends are catching up.

### The Frameworks Already Accept It

ASP.NET Core added `HttpMethods.Query` in .NET 10. The `MapQuery` and `[HttpQuery]` helpers passed API review but were cut from that change, so a minimal API maps the method explicitly:

```csharp
app.MapMethods("/orders", [HttpMethods.Query],
    async ([FromBody] OrderSearch search, IOrderReadStore orders, CancellationToken ct) =>
        Results.Ok(await orders.SearchAsync(search, ct)));
```

`HttpClient` has always accepted any method name, so the client side needs nothing new:

```csharp
using var request = new HttpRequestMessage(new HttpMethod("QUERY"), "orders")
{
    Content = JsonContent.Create(search)
};

using var response = await http.SendAsync(request, ct);
```

Elsewhere, OpenAPI 3.2 gave the Path Item Object a `query` field in September 2025, so a QUERY operation documents and generates clients like any other. Spring Framework merged QUERY support for version 7.1 in August 2026, and Envoy merged consistent handling across HTTP/1, HTTP/2, and HTTP/3 the same month.

### The Method Carries Intent and Retry Safety

Once the endpoint is a QUERY, the method says what the endpoint does. Access logs, gateway policies, and API catalogs can tell reads from writes without a list of exceptions for "the POST endpoints that are really searches." A retry policy that keys on the method, like the .NET one above, retries the search after a timeout and still leaves the order endpoint alone.

Supporting QUERY isn't the same as trusting it everywhere, though. Envoy's change deliberately keeps QUERY out of its internal list of safe requests, because a request with a body needs different handling for early data and retry buffering. Intermediaries that pass QUERY through may still treat it more cautiously than GET.

## Caches and Browsers Haven't Caught Up

Caching is where QUERY differs most from POST on paper, and where support is thinnest in practice. The RFC requires the cache key for a QUERY to "incorporate the request content," and it concedes that caching QUERY is "inherently more complex than caching responses to GET, as complete reading of the request's content is needed in order to determine the cache key." Caches from CDNs down to HTTP client libraries have tended to build their keys from the method and URL alone, and the RFC's requirement collides with that design.

### Browsers and CDNs Don't Key on the Body

Browsers send QUERY through `fetch` today, since it isn't a forbidden method, but the request for Mozilla's standards position on RFC 10008 reports that, in its author's testing, browsers didn't cache a repeated, identical QUERY. HTML forms can't send it at all. A `method="query"` form falls back to GET and drops the body, and a companion proposal to change that is still open.

CDNs are further behind. None of the three allowed-method settings in Amazon CloudFront's cache behaviors includes QUERY, and CloudFront caches only GET, HEAD, and optionally OPTIONS. At Cloudflare, whose engineer co-authored the RFC, an issue asking the Workers Cache API to cache QUERY responses keyed on the body was opened in June 2026 and is still open. It describes the cache as "GET-oriented."

### A Cache That Ignores the Body Serves the Wrong Answer

A cache that doesn't support QUERY is safer than one that half-supports it. Node's undici HTTP client shows why. Its QUERY support, merged in July 2026, first marked the method as safe everywhere, and the maintainers found that its cache and deduplication interceptors keyed responses without the body. Two different searches to the same URL would have shared one cached answer, so they removed QUERY from that list to prevent it. Any cache, reverse proxy, or homegrown response-caching middleware that decides cacheability by "is the method safe?" and builds its key from the URL has the same flaw once QUERY counts as safe.

The RFC names the subtler version too. A cache may normalize the body to improve its hit rate, and one that normalizes "incorrectly or in ways that are significantly different from how the resource processes the content can return an incorrect response."

### Cross-Origin QUERY Needs a Preflight, as JSON POST Already Does

The CORS-safelisted methods are GET, HEAD, and POST, so a browser sends an OPTIONS preflight before a cross-origin QUERY, as the RFC notes. That costs a JSON search API nothing new. A cross-origin POST with a JSON body already needs a preflight, because `application/json` isn't one of the safelisted content types. Only an endpoint that takes form-encoded or plain-text POSTs, which skip the preflight, gains a round trip by switching, and `Access-Control-Max-Age` lets the browser reuse the preflight answer after the first request.

### Location Bridges the Gap

Until caches key on the body, the RFC's own mechanism gets much of the caching benefit through infrastructure that exists today. The first request still has to reach the origin, by a route that accepts QUERY, which for a CDN like CloudFront means one that bypasses the distribution. The server answers a QUERY with a `Location` header naming a URI for that query, and the client repeats the search with GET on that URI, which every CDN and browser cache already knows how to cache. The RFC suggests this for simplicity even where QUERY caching works. It costs the server a way to map short URIs back to stored queries, and the RFC warns that when the query holds anything sensitive, the generated URI "SHOULD be chosen such that it does not include any sensitive portions" of the original content.

## Choosing a Method for Each Read

QUERY doesn't replace GET. A read whose inputs fit comfortably in a URL is best served as a GET, which every cache understands, and this site's API design guide covers the conventions for filtering, sorting, and field selection in query strings. QUERY is for reads that don't fit, and POST keeps a place only where the path to the server can't carry QUERY yet.

| The read | Method today | Why |
| --- | --- | --- |
| A few filters, benefits from CDN caching | GET | Every cache, log, and browser already handles it |
| Large or structured criteria, service-to-service | QUERY | Retries and intent work now, and nothing in the path needs a shared cache |
| Large criteria, browser client | QUERY | `fetch` sends it today, and a JSON POST already paid the same cross-origin preflight |
| Large criteria that must be cached at a CDN | QUERY to the origin, answered with `Location`, then GET through the CDN | The CDN caches the GET it already understands |
| A proxy, CDN, or gateway in the path rejects unknown methods | POST, with QUERY added once the path allows it | A read that can't reach the server doesn't help anyone |

This holds for APIs that lean toward RPC as much as for resource-oriented ones. A named operation like `/orders/search` is still a read, and QUERY lets it say so without pretending to be a resource GET.

The argument about GET with a body is over, because the standard now has a method for what that argument was trying to do. What's left is an adoption gap, and it sits in the caches, not in the method.

## Checking Your Own Read Endpoints

- List every POST endpoint in your API that doesn't change state. Each one is a QUERY candidate, and each one is currently invisible to anything that classifies requests by method
- Check whether your HTTP retry policy retries those endpoints. If it disables retries for unsafe methods, your searches don't retry either
- Send a QUERY through your own path, from client through CDN, gateway, and load balancer, and see where it's rejected or rewritten
- Find every response cache in the path, including in-process middleware, and check whether its key includes the request body before you let it treat QUERY as safe
- Look for search endpoints that take criteria in the URL and see whether customer names, account numbers, or other sensitive values end up in your access logs
