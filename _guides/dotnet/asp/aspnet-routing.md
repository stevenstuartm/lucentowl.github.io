---
title: "Routing"
layout: guide
category: "ASP.NET Core"
subcategory: "Fundamentals"
description: "How ASP.NET Core endpoint routing turns a request into one endpoint: endpoints and their metadata, route templates, constraints and what they're not for, how Order and precedence pick one route among several, what happens when nothing matches, fallback and short-circuit routes, host matching, link generation with LinkGenerator, and diagnosing 404, 405, 415, and ambiguous matches."
tags: [fundamentals, routing, route-templates, route-constraints, link-generation, fallback-routes]
---

## Endpoints, Matching, and Execution

Routing decides which code handles a request. In ASP.NET Core that code is an *endpoint*, made of three things:

- **A request delegate**, the function that takes the `HttpContext` and writes the response.
- **A route pattern**, describing the URLs it answers.
- **Metadata**, a collection of objects describing its requirements, such as an `[Authorize]` attribute, a CORS policy, or the HTTP methods it accepts.

Every minimal API handler (`MapGet`, `MapPost`, and the rest), controller action, Razor Page, SignalR hub, gRPC service, and health check becomes an endpoint in one shared route table, so the rules in this guide apply to all of them.

*Endpoint routing* splits the work into two steps at two points in the middleware pipeline, the chain of components every request passes through. The routing middleware (`UseRouting`) chooses an endpoint and attaches it to the `HttpContext` without running it. The endpoint middleware, at the end of the pipeline, runs whatever was chosen. `WebApplication` places both automatically.

{% include figure.html id="asp-endpoint-selection" %}

The gap between the two steps lets other middleware act on the chosen endpoint before it runs. Methods such as `RequireAuthorization`, `RequireCors`, and `RequireRateLimiting` don't enforce anything themselves. They add metadata to the endpoint, and the authorization, CORS (cross-origin request), and rate-limiting middleware read that metadata from the chosen endpoint and enforce it. Custom metadata attached with `WithMetadata` works the same way for an app's own middleware, which reads it through `context.GetEndpoint()`. Route groups (`MapGroup`) apply a shared prefix and shared metadata to many minimal API endpoints at once.

### What Routing Looks At

Routing reads `Request.Path`, the HTTP method, the `Host` header, and, for endpoints that declare which request body types they accept, the `Content-Type` header. The query string plays no part, so `/orders?status=open` and `/orders` match the same endpoints. Neither does `Request.PathBase`, a prefix the app is mounted under, such as `/shop` behind a reverse proxy. `UsePathBase` moves that prefix out of `Path`, and in a `WebApplication` it has to run before an explicit `UseRouting` to take effect.

### How Routing Chooses

Selection narrows the route table in stages:

{% include figure.html id="asp-route-selection" %}

Routing first finds the templates that fit the path. It then filters those candidates by method, host, and body type, drops any whose constraints reject the values in the URL, and finally picks the best survivor. The rest of this guide covers templates, constraints, and how the best is picked. The failures look different to a client:

- **No endpoint.** When no template fits, or filtering and constraints leave nothing, routing doesn't return a `404` itself. It leaves the endpoint unset and the request continues down the pipeline. Later middleware, such as static files, still gets a chance to answer, and only when nothing does is the result a `404`. A request for a host no endpoint accepts ends up here too.
- **A `405` or `415` endpoint.** When the path fits but no candidate accepts the request's method, routing selects a built-in endpoint that responds `405 Method Not Allowed`. When no candidate accepts the request body's content type, it selects one that responds `415 Unsupported Media Type`, which a minimal API handler with a JSON body parameter can trigger for a request sent as form data. Like any endpoint, these run at the end of the pipeline.
- **An ambiguous match.** When two candidates tie on every ranking rule, routing throws an `AmbiguousMatchException` naming them, which surfaces as a `500`.

The method check runs before constraints. With only `GET orders/{id:int}` mapped, `POST /orders/abc` returns `405`, even though the constraint would also have rejected `abc`. And the `405` only appears when no candidate accepts every method. A fallback route or a `Map` endpoint that handles all verbs on an overlapping path turns what would be a `405` into whatever that endpoint returns.

## Route Templates

A *route template* is the pattern an endpoint answers, such as `api/orders/{id}`. It is made of segments separated by `/`, and each segment is literal text, a parameter in braces, or both. Matching uses the decoded path and ignores case throughout.

| Form | Example | Matches | Notes |
| --- | --- | --- | --- |
| Literal | `api/orders` | `/api/orders` | Only that text |
| Parameter | `api/orders/{id}` | `/api/orders/42`, `/api/orders/abc` | Captures one segment as the route value `id` |
| Optional parameter | `api/orders/{status?}` | `/api/orders`, `/api/orders/open` | No `status` route value when the segment is absent |
| Default value | `api/orders/{status=open}` | `/api/orders`, `/api/orders/closed` | `status` is `open` when the segment is absent |
| Catch-all | `files/{*path}` | `/files/a/b/c.txt` | Captures the rest of the path. Link generation escapes `/` as `%2F` |
| Catch-all, preserving `/` | `files/{**path}` | `/files/a/b/c.txt` | Same match. Link generation keeps `/` unescaped |
| Complex segment | `{name}.{ext}` | `/report.pdf` | Several parameters in one segment. Costlier to match |

Route values are strings until something converts them. Minimal API parameter binding and MVC model binding do that when they fill the handler's parameters, so the same `{id}` becomes an `int` in a handler declared with `int id`, and a missing optional value becomes `null` in a handler declared with `string? status`.

## Route Constraints

A *constraint* restricts which values a parameter accepts, written after a colon: `{id:int}`. A candidate whose segment fails the constraint drops out, and routing considers the rest. Several constraints chain with further colons, as in `{id:int:min(1)}`, and all must pass.

| Kind | Constraints | Notes |
| --- | --- | --- |
| Type | `int`, `long`, `bool`, `guid`, `decimal`, `double`, `float`, `datetime` | Parsed with the invariant culture, so URLs aren't localized |
| Numeric range | `min(n)`, `max(n)`, `range(min,max)` | Integer bounds |
| String length | `minlength(n)`, `maxlength(n)`, `length(n)`, `length(min,max)` | |
| Characters | `alpha` | One or more letters `a` to `z`, case-insensitive |
| Pattern | `regex(expression)` | See below |
| File-like | `file`, `nonfile` | Whether the last segment looks like a file name with an extension |
| Generation | `required` | Requires an explicit value when generating a link |

`WebApplication.CreateSlimBuilder`, the reduced builder meant for trimmed and Native AOT apps, doesn't register the real `regex` constraint, to keep app size down. A route that uses it throws an `InvalidOperationException` on the first request, when routing builds its matcher. Calling `builder.Services.AddRouting()`, or registering the constraint with `RouteOptions.SetParameterPolicy<RegexInlineRouteConstraint>("regex")`, restores it.

### Constraints Select Routes; They Don't Validate Input

Constraints exist to choose between routes that would otherwise overlap, such as sending `/orders/42` to a lookup by ID and `/orders/recent` to a list. They are the wrong tool for input validation. A value that fails a constraint produces a `404 Not Found`, because as far as routing is concerned no endpoint exists for that URL. A client that sends `/orders/-5` to an endpoint constrained with `{id:int:min(1)}` learns nothing about what it did wrong. Validation belongs in the handler, a filter, or the validation system, where it can return a `400 Bad Request` that says what failed.

### Regex Constraints

A regex constraint runs with `RegexOptions.IgnoreCase`, `Compiled`, and `CultureInvariant`, and with a match timeout, since patterns applied to untrusted URLs can otherwise be used for denial of service. It is not anchored automatically. `{code:regex(\d+)}` matches any segment that *contains* a digit, and only `{code:regex(^\d+$)}` requires the whole segment to be digits. Written in an ordinary C# string, each backslash is doubled as usual.

Routing uses `{`, `}`, `[`, and `]` as delimiters, so any of the four inside the expression is written twice. The regex `^[a-z]+$` becomes `{code:regex(^[[a-z]]+$)}` in a template, and a quantifier's braces double the same way. Preferring the typed constraints where one fits avoids both the escaping and the matching cost.

### Custom Constraints

A custom constraint implements `IRouteConstraint`, whose `Match` method returns whether a value is acceptable, and is registered under a name in the route options:

```csharp
builder.Services.Configure<RouteOptions>(options =>
    options.ConstraintMap.Add("slug", typeof(SlugConstraint)));

app.MapGet("/articles/{name:slug}", (string name) => $"Article {name}");
```

Constraints run during matching, potentially for many candidates per request, and synchronously. They should be cheap, self-contained checks on the string. A constraint that looks the value up in a database adds I/O to routing itself, and it turns a "not found" into a `404` from routing rather than an answer from the handler.

## When Several Routes Match

Many templates can match one URL. `/orders/recent` matches both `orders/recent` and `orders/{id}`. Routing doesn't pick the first one registered. It ranks the survivors, first by each endpoint's `Order` value, lower first, and then, among equal `Order`, by how specific the template is:

1. A template with more segments is more specific.
2. A literal segment is more specific than a parameter.
3. A parameter with a constraint is more specific than one without.
4. A complex segment such as `{name}.{ext}` ranks with a constrained parameter.
5. A catch-all parameter is the least specific.

So `orders/recent` wins over `orders/{id}` for `/orders/recent`, and `orders/{id:int}` would win over `orders/{slug}` for `/orders/42` while `/orders/abc` still reaches the slug route. When templates tie too, the filters break the tie where they can: an endpoint for an explicit method beats one that accepts any method, and an exact host beats a wildcard. Only a tie on all of these throws `AmbiguousMatchException`, and the fix is to make one template more specific with a literal or a constraint.

`Order` is 0 by default for minimal API endpoints and attribute-routed controller actions, and controllers can change it through the `Order` property of route attributes. Two kinds of route start elsewhere:

- **Conventional controller routes**, declared with `MapControllerRoute`, get `Order` 1, 2, 3, and so on, in the order they are declared. Any minimal API endpoint or attribute route that matches therefore beats a conventional route, however specific the conventional template is.
- **Fallback and short-circuit routes**, covered next, get the highest possible `Order`, so they rank below every ordinary endpoint.

A route table that depends on explicit `Order` values is harder to reason about than one whose templates don't overlap.

## Fallback and Short-Circuit Routes

Two kinds of route exist for requests that shouldn't go through normal endpoint handling.

### Fallback Routes

A *fallback* route catches requests nothing else matched. `MapFallback` registers a handler that accepts every method, with the highest `Order` and a template of `{*path:nonfile}`, so it answers any unmatched path whose last segment doesn't look like a file name. `MapFallbackToFile("index.html")` is the usual way to serve a single-page application from the same host as its API, so that the client-side router receives deep links like `/orders/42/edit`. Requests for missing files such as `/app.js` still get a `404`, because they fail the `nonfile` constraint.

The same breadth causes the classic problem with that setup. A mistyped or removed API path, such as `/api/ordrs/5`, also matches the fallback and returns `index.html` with `200 OK`, so an API client sees a successful HTML response rather than a `404`. Because the fallback accepts every method, it also swallows what would have been a `405`: a `POST` to a GET-only API route gets the HTML page too. Route templates have no syntax for excluding a prefix, so the usual fix claims the API's prefix with its own catch-all, as in `app.MapShortCircuit(404, "api")`. That route and the fallback share the highest `Order`, and the literal `api` segment is more specific than the fallback's catch-all, so unmatched API paths get a plain `404`. That route accepts every method as well, so a wrong-verb API request gets a `404` rather than a `405`.

### Short-Circuit Routes

Since .NET 8, an endpoint can run straight from the routing middleware and end the request there, skipping every middleware between routing and the endpoint middleware:

```csharp
app.MapGet("/healthz", () => "Healthy").ShortCircuit();

// Answer every path under these prefixes with a 404 and nothing else
app.MapShortCircuit(404, "robots.txt", "favicon.ico");
```

This suits endpoints that don't need the middleware in between, such as liveness probes and the steady stream of `robots.txt` and `favicon.ico` requests an API receives from browsers and crawlers. `MapShortCircuit` treats each string as a prefix, matching the path and anything below it, at the highest `Order`, so any ordinary endpoint that also matches wins.

Skipping the middleware also skips the checks it performs. A short-circuit endpoint that carries authorization metadata (`[Authorize]`, `RequireAuthorization`), CORS metadata (`[EnableCors]`, `RequireCors`), or an antiforgery requirement (a token check that protects form posts from cross-site request forgery) throws an `InvalidOperationException` when a request reaches it, rather than silently serving the request unchecked. The check can be turned off with `RouteOptions.SuppressCheckForUnhandledSecurityMetadata`, which only makes sense when something else enforces those requirements.

## Host Matching

`RequireHost` limits an endpoint to requests whose `Host` header matches a pattern. It accepts an exact host, a wildcard subdomain, a port, or a host and port, and the endpoint matches if any of the patterns match:

```csharp
app.MapGet("/", () => "Contoso").RequireHost("contoso.com", "*.contoso.com");
app.MapGet("/admin/stats", () => "...").RequireHost("*:8080");
```

The port in a pattern is compared with the port named in the `Host` header, not the port the connection arrived on, and the header is whatever the client sent. A client connected to the public listener can send `Host: example.com:8080` and match the second endpoint. Host matching therefore organizes endpoints and doesn't secure them. An endpoint meant only for an internal port needs a check on `HttpContext.Connection.LocalPort`, authorization, or a listener that isn't publicly reachable. Controllers use the `[Host]` attribute for host matching. Rejecting requests for hosts the app doesn't serve at all is the job of host filtering (`AllowedHosts`), which runs before routing.

## Generating URLs

Hardcoded URLs break silently when a template changes. *Link generation* builds URLs from the route table instead, so a changed template changes every generated link with it.

`LinkGenerator` is the service for this. It is a singleton, so it can be injected anywhere, including middleware and background services. It generates a path or an absolute URI to an endpoint identified either by name or, for controllers, by action and controller name. Minimal API endpoints get a name with `WithName`, and names must be unique across the app.

```csharp
app.MapGet("/orders/{id:int}", (int id, IOrderStore orders) => orders.Find(id))
   .WithName("GetOrder");

// Minimal API handlers can take services and the HttpContext as parameters
app.MapPost("/orders", (CreateOrder request, IOrderStore orders, LinkGenerator links, HttpContext http) =>
{
    var order = orders.Create(request);
    var location = links.GetPathByName(http, "GetOrder", new { id = order.Id });
    return Results.Created(location, order);
});
```

| Method | Produces |
| --- | --- |
| `GetPathByName` | A path such as `/orders/42` to a named endpoint |
| `GetUriByName` | An absolute URI including scheme and host |
| `GetPathByAction`, `GetUriByAction` | The same, for a controller action |

The overloads that take `HttpContext` fill in the scheme, host, and path base from the current request. The absolute-URI overloads take the host from the request's `Host` header, so an app that builds absolute links this way needs host filtering, or a client can make it emit links to a host of the client's choosing.

The action-based overloads also reuse the current request's route values as *ambient values*. Controller routes carry the controller and action names as route values, so a link from one action to another in the same controller doesn't have to repeat the controller name. The name-based overloads don't use ambient values, so every value the template needs has to be passed. When no endpoint can be satisfied by the values given, all of these methods return `null` rather than throw.

Controllers can also use `IUrlHelper` through their `Url` property, as in `Url.Action` or `Url.RouteUrl`. It wraps the same machinery but needs a controller or action context, which `LinkGenerator` doesn't. Setting `RouteOptions.LowercaseUrls` makes generated paths lowercase without changing how incoming URLs match.

## Diagnosing Routing Problems

Each failure in the selection figure has a handful of usual causes:

| Symptom | Causes to check |
| --- | --- |
| `404 Not Found` | No template fits the path, a constraint rejected the value, the endpoint requires a different host, a path base wasn't removed before routing, or no later middleware answered |
| `405 Method Not Allowed` | The path fits, but its endpoints accept other methods |
| `415 Unsupported Media Type` | The endpoint declares the body types it accepts, and the request's `Content-Type` isn't one of them |
| `AmbiguousMatchException` (a `500`) | Two endpoints tie on `Order`, template precedence, and the method and host filters |
| `200 OK` with HTML from an API path | An SPA fallback caught a path, or a method, the API doesn't handle |

Several tools show what routing actually did:

- **Debug logging.** Setting the `Microsoft.AspNetCore.Routing` log category to `Debug` logs the candidates considered for each request, which of them a constraint rejected, which endpoint matched, and the steps of link generation.
- **The route table.** `EndpointDataSource`, available from the container, lists every registered endpoint with its display name, a readable label such as `HTTP: GET /orders/{id:int}`, and its metadata. A `WebApplication` adds its endpoints to that list as the pipeline is built, which happens when the app starts, so read it after startup, for example from an `ApplicationStarted` callback, rather than just before `app.Run()`.
- **The chosen endpoint.** Middleware placed after routing can log `context.GetEndpoint()?.DisplayName` for each request.
- **Metrics.** The `Microsoft.AspNetCore.Routing` meter's `aspnetcore.routing.match_attempts` counter records each match attempt, tagged by whether it succeeded and whether a fallback route matched. The fallback tag exposes the SPA problem above in production.

## Routing Performance

Endpoint routing compiles the whole route table into a state machine that consumes the request path segment by segment, so matching time depends on the length of the path rather than on how many routes exist. A typical app is unlikely to have a performance problem just from having many routes.

The costs that do appear come from specific features:

- **Regex constraints**, especially ones whose running time grows quickly on unusual input.
- **Complex segments** like `{name}.{ext}`, which allocate substrings to try each split.
- **Custom constraints that do I/O**, which put data access on the path of every request.
- **Very large route tables with parameters in early segments**, such as thousands of `{tenant}/orders/...` templates. These make the state machine large, and the app uses a lot of memory at startup. Adding constraints to those parameters reduces that memory drastically. Moving parameters to later segments also helps, and dynamic routes (`MapDynamicControllerRoute`) replace many templates with one that resolves its target at request time.

## Key Takeaways

- Every handler becomes an endpoint in one route table. Routing chooses the endpoint early in the pipeline and it runs at the end, so middleware in between can enforce what the endpoint's metadata requires.
- Routing matches the path, method, host, and declared body type, never the query string. Method and host filtering happen before constraints are checked.
- No match isn't a `404` from routing. The request carries on with no endpoint, and the `404` comes from the end of the pipeline if nothing else answers. A wrong method returns `405` and a wrong body type `415`, unless an endpoint that accepts everything overlaps the path.
- Constraints choose between overlapping routes. Using them for validation turns bad input into a `404` with no explanation.
- A regex constraint matches anywhere in the segment unless it is anchored with `^` and `$`.
- `Order` ranks first, then template specificity. Conventional controller routes start at `Order` 1 and lose to any matching minimal API or attribute route.
- An SPA fallback on the same host as an API turns mistyped API paths and wrong methods into `200` HTML responses unless the API prefix is claimed by its own route.
- Short-circuit routes skip the middleware after routing, and refuse to serve endpoints that carry authorization, CORS, or antiforgery requirements.
- `RequireHost` compares patterns with the client-supplied `Host` header, including its port, so it organizes endpoints and doesn't secure them.
- Generate links with `LinkGenerator` and named endpoints. A `null` result means no endpoint could be satisfied by the values given.
