---
title: "API Security"
layout: guide
category: "ASP.NET Core"
subcategory: "Security & Resilience"
description: "Hardening an ASP.NET Core API: HTTPS enforcement and HSTS for APIs, the OWASP API Security Top 10 mapped to framework controls, object and property level authorization, mass assignment, injection in EF Core and process calls, CORS, antiforgery, secrets management, the Data Protection API, security headers, IP allowlisting, and security logging."
tags: [practical, owasp-api-security, cors, https, secrets-management, data-protection, antiforgery]
---

Authentication and authorization decide who may call an API and what they may do. This guide covers the rest of an API's defenses: keeping traffic encrypted, keeping callers inside the data they are entitled to, keeping untrusted input from becoming code, and keeping secrets out of reach. The OWASP API Security Top 10 is the checklist most teams measure against, and the section after transport security maps it onto ASP.NET Core.

## Transport Security

### HTTPS for APIs

Every API request should travel over TLS. Browser apps usually enforce that with `UseHttpsRedirection`, which answers a plain HTTP request with a redirect to HTTPS, and the `webapi` template includes that call too. Microsoft advises against relying on it for APIs.

- **A redirect hides the mistake.** By the time the server answers, the client has already sent its request, including any bearer token or body, in plaintext, and no response can undo that. A client that follows the redirect then succeeds, so nobody notices the plaintext call and it keeps happening.
- **Not every client follows redirects.** API clients may not, and a browser's CORS preflight, the permission check covered under CORS below, fails outright when it gets a redirect.

The only way to prevent the plaintext request is to not listen on HTTP at all, which is a matter of endpoint configuration, such as `ASPNETCORE_URLS=https://+:443` or a `Kestrel:Endpoints` entry with only an `https` URL. The fallback is rejecting HTTP with `400 Bad Request`, which there is no built-in middleware for. A small check on `Request.IsHttps` does it, and fails loudly enough that the client gets fixed. Either way, the template's `UseHttpsRedirection` call comes out.

Behind a reverse proxy or load balancer that terminates TLS, the app often listens on plain HTTP inside the network, and the proxy enforces HTTPS for outside callers. The app then needs the forwarded headers middleware, which reads the `X-Forwarded-Proto` and `X-Forwarded-For` headers the proxy adds, configured to trust only that proxy, so that `Request.IsHttps`, generated links, and the client IP reflect the original caller rather than the proxy.

### HSTS

HTTP Strict Transport Security tells a browser to use only HTTPS for a site for a period of time, including for links and typed URLs that say `http://`. `UseHsts` adds the `Strict-Transport-Security` header.

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(60);   // start short, raise once HTTPS is proven everywhere
    options.IncludeSubDomains = true;
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
```

The default `MaxAge` is 30 days, and loopback hosts such as `localhost` are excluded, since the header is cached by the browser and would break local HTTP testing. HSTS is a browser feature. Mobile apps, desktop clients, and other services ignore it, which is why the default API template leaves it out, and why an API relies on not listening on HTTP instead. An API that also serves a browser front end on the same host benefits from it.

## The OWASP API Security Top 10

The OWASP API Security Top 10 (2023 edition) lists the risks most often found in real APIs. Most map to ASP.NET Core features covered elsewhere, and the useful exercise is knowing where each one is handled.

| Risk | What goes wrong | ASP.NET Core control |
|------|-----------------|---------------------|
| **API1: Broken object level authorization** | A caller reads or changes another user's object by changing an ID | Resource-based authorization on every object access (below) |
| **API2: Broken authentication** | Weak credentials, unvalidated tokens, unlimited login attempts | Authentication handlers with full token validation, Identity lockout, rate limits on sign-in endpoints |
| **API3: Broken object property level authorization** | Responses expose properties the caller shouldn't see, or requests set properties the caller shouldn't change | Separate request and response DTOs (below) |
| **API4: Unrestricted resource consumption** | Unbounded request rates, body sizes, page sizes, or query costs | Rate limiting middleware, request body limits, request timeouts, maximum page sizes |
| **API5: Broken function level authorization** | A regular user reaches an admin function | Authorization policies on every endpoint, and a fallback policy so nothing is public by accident |
| **API6: Unrestricted access to sensitive business flows** | Automation abuses a legitimate flow, such as bulk purchasing or sign-up | Per-user rate limits and business-level checks such as quotas and bot detection |
| **API7: Server-side request forgery** | The API fetches a URL the caller supplied, and reaches internal systems | Allowlisting destinations for any outbound call built from input |
| **API8: Security misconfiguration** | Detailed errors, permissive CORS, missing TLS, exposed OpenAPI or reflection endpoints | Problem Details without stack traces, strict CORS, HTTPS only, development-only tooling |
| **API9: Improper inventory management** | Old or undocumented API versions stay reachable and unpatched | API versioning with deprecation and removal, and a published OpenAPI inventory |
| **API10: Unsafe consumption of APIs** | The API trusts data from third-party APIs more than user input | Validating and bounding responses from dependencies, with timeouts |

### Object Level Authorization

Broken object level authorization is first on the list because it is the easiest to write. An endpoint such as `GET /orders/{id}` authenticates the caller, loads the order, and returns it, without asking whether this caller may see *this* order. Changing the ID in the URL then returns someone else's data. Unguessable IDs such as GUIDs make enumeration harder but don't fix the missing check.

The fix is a check on every access to a specific object, typically resource-based authorization. The endpoint loads the object, then calls `IAuthorizationService.AuthorizeAsync(User, order, "OrderAccess")`, and a handler compares the object's owner or tenant with the caller's claims. For multi-tenant data, a global query filter in EF Core that restricts every query to the caller's tenant adds a second line of defense, so that a missing check fails closed.

### Object Property Level Authorization and Mass Assignment

The property-level risk has two directions. On the way out, returning an entity serializes every property it has, including ones added later, such as a password hash or an internal flag. On the way in, binding a request directly to an entity lets a caller set any property the entity exposes. A profile update that binds to `User` accepts `"isAdmin": true` as readily as a new display name, which is called *mass assignment* or overposting.

Separate request and response types, often called DTOs, close both directions, because each type lists exactly the properties that may cross the boundary:

```csharp
public record UpdateProfileRequest(string DisplayName, string? Bio);
public record ProfileResponse(string UserId, string DisplayName, string? Bio);

app.MapPut("/profile", async (UpdateProfileRequest request, ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);   // read "sub" instead if claim mapping is turned off
    var profile = await db.Profiles.SingleAsync(p => p.UserId == userId);
    profile.DisplayName = request.DisplayName;   // only the fields the request type allows
    profile.Bio = request.Bio;
    await db.SaveChangesAsync();
    return TypedResults.Ok(new ProfileResponse(profile.UserId, profile.DisplayName, profile.Bio));
}).RequireAuthorization();
```

MVC's `[Bind("DisplayName", "Bio")]` attribute limits which properties form and route model binding may set, but it has no effect on a JSON body read by an input formatter, which is how most API requests arrive. For JSON APIs, the request type is the control.

## Input Handling

### Validation Is Not Sanitization

Validation checks that input has the expected shape, and it should be strict: a product code that should be alphanumeric gets a pattern that rejects anything else, lengths get maximums, and numbers get ranges. Controllers validate through MVC model validation, and minimal APIs validate through `AddValidation` since .NET 10. Strict validation shrinks what an attacker can send, but valid input can still be dangerous in the wrong context. A perfectly valid name can contain a quote that breaks out of a SQL string, or markup that runs in a browser. The defense against those is handling input correctly where it is used: parameterized queries, argument lists for processes, and encoding when rendering HTML.

### SQL Injection in EF Core

LINQ queries in EF Core are safe from injection: captured variables become parameters, and constants become escaped literals. Raw SQL is where injection happens, and EF Core's API makes the safe path the short one:

```csharp
// Safe: interpolated values become parameters
var orders = await db.Orders
    .FromSql($"SELECT * FROM Orders WHERE CustomerId = {customerId}")
    .ToListAsync();

// Unsafe: string concatenation reaches the database as SQL
var unsafeOrders = await db.Orders
    .FromSqlRaw("SELECT * FROM Orders WHERE CustomerId = '" + customerId + "'")
    .ToListAsync();
```

`FromSql` and `ExecuteSql` take a `FormattableString`, so each interpolated value becomes a `DbParameter`. `FromSqlRaw` takes a plain string and parameterizes only what is passed separately as parameters. Interpolating into a string first and passing it to `FromSqlRaw` builds the injection back in. Identifiers such as column or table names can't be parameters at all, so a query that sorts by a caller-chosen column maps the input to a fixed list of known column names.

### Command Injection

An API that starts a process with caller input has the same problem with a different interpreter. Building an argument string, even with quotes around the value, lets input containing a quote end the argument and add others. `ProcessStartInfo.ArgumentList` passes each argument separately, with the escaping handled by the runtime for a native executable (a batch file is still parsed by `cmd.exe`, which reinterprets it), and `UseShellExecute = false` keeps a shell out of the picture:

```csharp
var startInfo = new ProcessStartInfo("convert-tool") { UseShellExecute = false };
startInfo.ArgumentList.Add("--input");
startInfo.ArgumentList.Add(validatedFileName);   // one argument, however it's spelled

using var process = Process.Start(startInfo)!;
await process.WaitForExitAsync(ct);
```

Validating the value first still matters. `ArgumentList` stops a value from becoming a second argument, but not a value such as `--delete-all` from being interpreted by the tool as an option.

## Browser-Facing Defenses

### CORS

Browsers stop a page from reading responses from another origin (a different scheme, host, or port) unless that server allows it. Cross-Origin Resource Sharing is how the server allows it. CORS isn't a security feature that protects the API. It *relaxes* the browser's same-origin policy for the origins the server names, and it constrains only browsers: curl, a server, or any non-browser client ignores it entirely. A strict CORS policy therefore protects users' browsers from other sites, not the API from attackers, who can call it directly.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Dashboard", policy => policy
        .WithOrigins("https://dashboard.example.com")
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10)));
});

app.UseCors();              // no default policy: endpoints name theirs
app.UseAuthentication();    // called explicitly so they run after CORS
app.UseAuthorization();

app.MapGroup("/api").RequireCors("Dashboard");
```

{% include figure.html id="asp-cors-preflight" %}

`UseCors` is pipeline middleware, and `RequireCors` is endpoint metadata that the middleware reads once routing has chosen the endpoint. The middleware has to run after routing and before authorization and response caching. `WebApplication` inserts the authentication and authorization middleware ahead of the app's own unless the app calls them, so calling them explicitly after `UseCors` is what puts CORS first. Otherwise a preflight, which carries no credentials, can be rejected by authorization before CORS answers it.

A few rules cover most CORS mistakes.

- **Credentials means cookies.** `AllowCredentials()` lets the browser send cookies and HTTP authentication such as Basic or Windows authentication. A bearer token in the `Authorization` header is an ordinary request header, allowed through `WithHeaders`, and needs no `AllowCredentials`.
- **Credentials never pair with any origin.** `AllowAnyOrigin()` with `AllowCredentials()` would let every website make authenticated calls with the user's cookies, so building such a policy throws `InvalidOperationException`.
- **Preflights come first.** A request with a method other than GET, HEAD, or POST, a custom header, or a JSON content type triggers a preflight `OPTIONS` request, and `SetPreflightMaxAge` lets the browser cache the answer.
- **Pick one way to apply policies.** Middleware with a default policy and endpoint-level `RequireCors` or `[EnableCors]` both apply when combined, and Microsoft recommends using one or the other. The sample's middleware has no default policy, so the endpoint policies are the only mechanism.

Browsers don't apply CORS to WebSocket connections, so a WebSocket endpoint restricts origins separately, through `WebSocketOptions.AllowedOrigins`.

### Antiforgery

Cross-site request forgery works because browsers attach cookies to requests automatically, including requests triggered by another site. An API authenticated by bearer tokens isn't exposed, since a malicious page can't make the browser attach a token it doesn't have. An API authenticated by cookies and called from a browser is exposed, and needs two things. The first is a `SameSite` cookie attribute, which cookie authentication already sets to `Lax` by default. `Lax` keeps the cookie off cross-site requests except top-level navigations with safe methods such as GET, so it stops a hostile page from sending a cross-site POST with the user's session. It doesn't cover requests from sibling subdomains, which browsers count as the same site. The second is an antiforgery token on state-changing requests, which a page on another origin can't read and so can't send.

ASP.NET Core's antiforgery service issues the token and validates it from a header or form field. Since .NET 8, minimal API endpoints that bind form data (`IFormFile` or `[FromForm]`) require antiforgery validation automatically. The app must register the antiforgery services and middleware (`AddAntiforgery` and `UseAntiforgery`), and such an endpoint fails without them unless marked `.DisableAntiforgery()`. Controllers opt in with `[AutoValidateAntiforgeryToken]`, which checks every request except GET, HEAD, OPTIONS, and TRACE. A minimal API endpoint that takes a JSON body gets no validation unless it opts in, with `[RequireAntiforgeryToken]` metadata or a call to `IAntiforgery.ValidateRequestAsync`.

### Security Headers

Response headers can tell browsers to turn on extra protections. They matter most for responses a browser renders, but APIs usually set a few anyway, since a JSON response opened directly in a browser tab is still a page.

- **`X-Content-Type-Options: nosniff`** stops the browser from guessing a different content type than the one declared, so a JSON response can't be treated as HTML or script.
- **`Content-Security-Policy`** restricts what a page may load and run. For a pure JSON API, `default-src 'none'; frame-ancestors 'none'` is a strict and harmless default. `frame-ancestors` supersedes the older `X-Frame-Options` header for preventing framing.
- **`Referrer-Policy: no-referrer`** keeps URLs, which may carry IDs, out of the `Referer` header of any request a response triggers.

```csharp
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers.XContentTypeOptions = "nosniff";
    headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
    headers["Referrer-Policy"] = "no-referrer";
    await next();
});
```

Setting headers through the indexer or the typed properties overwrites a value that is already there. `Headers.Add` throws if another component has already set the same header, which makes it a poor choice in middleware. A CSP this strict also breaks documentation UIs such as Swagger UI or Scalar served from the same app, so it either skips their routes or they get a looser policy of their own. Many teams set these headers at the reverse proxy instead, which covers every app behind it.

## Secrets and Keys

### Secrets Management

Connection strings, API keys, and signing keys don't belong in source control or in `appsettings.json`. The configuration system can read them from sources that keep them out of the repository while the code reads them the same way, through `IConfiguration` and options.

- **Development.** The Secret Manager (`dotnet user-secrets`) stores secrets in a JSON file in the user profile, outside the project. `CreateBuilder` loads it only in the Development environment. It isn't encrypted and isn't meant for production.
- **Production.** A secrets store such as Azure Key Vault, loaded at startup through the configuration provider in the `Azure.Extensions.AspNetCore.Configuration.Secrets` package:

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{vaultName}.vault.azure.net/"),
    new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned));
```

A managed identity lets the app authenticate to Key Vault without a credential of its own. `DefaultAzureCredential` tries a chain of credential sources, which suits development, but Azure's guidance for production is a specific credential such as `ManagedIdentityCredential`, so the app can't silently pick up a different identity. The provider reads the secrets once at startup. A rotated secret reaches the app on the next restart, or on a timer if `ReloadInterval` is set in the provider's options.

### The Data Protection API

The Data Protection API encrypts and signs data that the app will read back later, usually after a round trip through an untrusted client. ASP.NET Core uses it for authentication cookies, antiforgery tokens, and TempData, and apps use it for opaque tokens such as signed download links. It picks the algorithms, generates keys, and rotates them, 90 days apart by default, while still decrypting data protected with older keys.

```csharp
public class DownloadLinks(IDataProtectionProvider provider)
{
    private readonly ITimeLimitedDataProtector _protector =
        provider.CreateProtector("ReportDownload.v1").ToTimeLimitedDataProtector();

    public string Create(string reportId) => _protector.Protect(reportId, TimeSpan.FromHours(1));

    public string Read(string token) => _protector.Unprotect(token);   // throws if expired or tampered with
}
```

The *purpose string* passed to `CreateProtector` isolates uses from each other, so a token protected for downloads can't be replayed as anything else. A time-limited token can still be replayed by whoever holds it until it expires, so it suits links that grant read access. A password-reset token also has to stop working once it's used or the password changes, which is why Identity's `GeneratePasswordResetTokenAsync` ties its tokens to the user's security stamp.

The keys must be shared and persistent when the app runs on more than one instance or in containers. Outside Azure App Service, keys live on the local machine by default, so a cookie issued by one instance fails to decrypt on another, and every user is signed out when a container is replaced. App Service stores keys in a folder synchronized across a slot's instances, but a slot swap still loses them. `PersistKeysToAzureBlobStorage` (or a file share, Redis, or a database), with `ProtectKeysWithAzureKeyVault` to encrypt them at rest, makes keys survive all of these.

The API suits data with a bounded lifetime best. Microsoft's docs note it isn't primarily intended for indefinite persistence of confidential payloads and name Windows CNG DPAPI and Azure Rights Management as better fits for that, while allowing that it can be used long term. Data kept for years, such as encrypted database columns, usually belongs with a dedicated key management service.

## Network and Audit Controls

### IP Allowlisting

An administrative or internal API can restrict callers to known networks as an extra layer beyond authentication. .NET 8's `IPNetwork` type handles ranges, and mapping the address to IPv4 handles the IPv4-mapped IPv6 form that dual-stack servers report:

```csharp
IPNetwork[] allowed = [IPNetwork.Parse("10.20.0.0/16"), IPNetwork.Parse("203.0.113.10/32")];

app.MapGroup("/admin")
    .AddEndpointFilter(async (context, next) =>
    {
        var ip = context.HttpContext.Connection.RemoteIpAddress;
        if (ip is null || !allowed.Any(n => n.Contains(ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip)))
        {
            return TypedResults.StatusCode(StatusCodes.Status403Forbidden);
        }
        return await next(context);
    })
    .RequireAuthorization("Admin");
```

Behind a proxy, `RemoteIpAddress` is the proxy's address until the forwarded headers middleware replaces it with the client's. That middleware must trust only the known proxies, since otherwise any caller can set `X-Forwarded-For` to an allowed address and walk past the check. Network restrictions are often easier to enforce at the firewall, gateway, or cloud network layer, where they also block traffic before it reaches the app.

### Security Logging

Security logs answer two questions after an incident: what happened, and who did it. The events to record are sign-in failures, authorization denials, changes to permissions or credentials, access to sensitive records, and rejected input that looks like an attack. Each entry needs the caller's identity, the resource, the source address, and a correlation ID, logged as structured properties so the logs can be queried by any of them.

What stays out of logs matters as much. Passwords, tokens, API keys, and personal data don't belong in logs. ASP.NET Core's "Request starting" log line includes the query string, which can carry tokens, whenever the `Microsoft.AspNetCore` categories log at Information. The templates set them to Warning, and the HTTP logging middleware leaves query strings out by default. The value of the logs comes from someone reading them, so denials and sign-in failures feed alerts, since a burst of 401s from one address or 403s across many IDs is often the first sign of an attack.

## Key Takeaways

- APIs listen only on HTTPS, or reject HTTP with 400, rather than redirecting. HSTS helps browsers only.
- Check authorization on every object access, not just every endpoint. Broken object level authorization tops the OWASP API list.
- Use separate request and response types to stop mass assignment and over-exposure. `[Bind]` doesn't apply to JSON bodies.
- Keep raw SQL on `FromSql`'s interpolated parameters, and start processes with `ArgumentList`.
- CORS relaxes browser restrictions for named origins and doesn't protect the API from non-browser callers. `AllowCredentials` is about cookies, not bearer tokens.
- Cookie-authenticated APIs called from browsers need SameSite cookies and antiforgery tokens. Token-authenticated APIs don't.
- Load production secrets from a secrets store with a managed identity, and share Data Protection keys across instances.
- IP allowlists behind a proxy depend on the forwarded headers middleware trusting only known proxies.
