---
title: "Authentication and Authorization"
layout: guide
category: "ASP.NET Core"
subcategory: "Security & Resilience"
description: "How ASP.NET Core authenticates API callers and authorizes them: schemes and handlers, where 401 and 403 come from, JWT bearer validation and claim mapping, Identity and its API endpoints, API keys, client certificates, combining schemes, authorization policies and handlers, resource-based authorization, the fallback policy, and refresh and revocation for tokens you issue."
tags: [practical, authentication, authorization, jwt-bearer, authorization-policies, claims, api-keys]
---

Authentication establishes who is calling. Authorization decides what that caller may do. ASP.NET Core keeps the two in separate middleware with a clear handoff, and most confusion about the security pipeline, including the classic "why am I getting 401 instead of 403," comes from not knowing where one stops and the other starts.

## How Authentication Works

### Schemes and Handlers

An *authentication scheme* is a named registration of an *authentication handler*, the code that reads a credential from the request and validates it. `AddJwtBearer` registers a handler for bearer tokens under the scheme name `Bearer`, `AddCookie` one for cookies under `Cookies`, and a custom handler can be registered under any name, such as `ApiKey`.

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* ... */ });
```

The name passed to `AddAuthentication` is the *default scheme*, the one the authentication middleware runs on every request. Since .NET 7, an app that registers exactly one scheme gets it as the default without naming it. Other schemes run only when something asks for them, such as an authorization *policy*, a named set of rules an endpoint must satisfy, covered under Authorization below.

### The Middleware Never Rejects

The authentication middleware runs the default scheme's handler and sets `HttpContext.User` to the resulting *principal*, the object that represents the caller and their claims. A request with no credential, or with an invalid one, isn't rejected. It continues with an anonymous user. Rejection belongs to authorization, which runs after routing has selected an endpoint and evaluates that endpoint's policies.

- **Policies satisfied.** The endpoint runs.
- **The user isn't authenticated.** Authorization calls *Challenge* on the scheme. A bearer handler answers with `401 Unauthorized` and a `WWW-Authenticate` header, and a cookie handler redirects to its login page.
- **The user is authenticated, but a policy fails.** Authorization calls *Forbid*. A bearer handler answers `403 Forbidden`, and a cookie handler redirects to its access-denied page.

{% include figure.html id="asp-auth-challenge-forbid" %}

An expired token therefore produces a 401 in two steps. The authentication handler records the failure and leaves the user anonymous, and authorization, finding an anonymous user on a protected endpoint, issues the challenge. A valid token without the right role produces a 403. A client can fix a 401 by getting new credentials, and can't fix a 403 by re-authenticating. Since .NET 10, cookie authentication returns 401 and 403 status codes instead of redirects for requests to known API endpoints, which include `[ApiController]` actions, minimal APIs that read or write JSON, `TypedResults` endpoints, and SignalR hubs. An API that shares an app with Razor Pages no longer answers its callers with an HTML login page.

`WebApplication` adds the authentication and authorization middleware automatically when their services are registered. Calling `UseAuthentication` and `UseAuthorization` explicitly is needed only to control their position, such as placing them after CORS.

### Claims and the Principal

A successful handler produces a `ClaimsPrincipal`, which holds one or more `ClaimsIdentity` objects, each a set of *claims*: typed name-value pairs such as a subject ID, an email, a role, or a tenant. Authorization reads claims, so it never depends on which scheme produced them.

The JWT bearer handler renames some claims on the way in. With `MapInboundClaims` at its default of `true`, a token's `sub` claim appears as `ClaimTypes.NameIdentifier` (`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier`), and `role` as `ClaimTypes.Role`. Code that looks for `"sub"` then finds nothing. Setting `MapInboundClaims = false` keeps the token's own claim names, which is usually the clearer choice for new APIs, and `TokenValidationParameters.RoleClaimType` then tells role checks which claim to read.

### Claims Transformation

`IClaimsTransformation` adjusts the principal after authentication, for example to add permissions loaded from a database or to map an identity provider's groups to application roles. It runs every time the principal is authenticated, which can be more than once per request, so it has to be idempotent: check whether its claims are already present before adding them, and cache any lookup it makes.

```csharp
public class PermissionClaims(IPermissionStore store) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.HasClaim(c => c.Type == "permission") ||
            principal.FindFirst("sub")?.Value is not { } userId)   // with MapInboundClaims = false
        {
            return principal;
        }

        var identity = new ClaimsIdentity();
        foreach (var permission in await store.GetPermissionsAsync(userId))
        {
            identity.AddClaim(new Claim("permission", permission));
        }
        principal.AddIdentity(identity);
        return principal;
    }
}
```

It is registered like any service, `builder.Services.AddTransient<IClaimsTransformation, PermissionClaims>()`.

## JWT Bearer Authentication

Most APIs receive access tokens issued by an identity provider, as JSON Web Tokens (JWTs) in the `Authorization: Bearer` header. How the client obtained the token, through the authorization code flow with PKCE (a one-time secret that stops an intercepted sign-in code from being redeemed by anyone else), a client-credentials grant, or another OAuth 2.0 flow, is the provider's and the client's business. The API's job is to validate the token and read its claims.

The simplest correct configuration names the provider and the API's identifier:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.example.com/tenant-id/v2.0";
        options.Audience = "api://orders";
        options.MapInboundClaims = false;
        options.TokenValidationParameters.NameClaimType = "name";
        options.TokenValidationParameters.RoleClaimType = "role";
    });
```

With claim mapping off, the last two lines tell ASP.NET Core which claims hold the user's name and roles. Without them, `User.Identity.Name` is null and every `[Authorize(Roles = ...)]` check fails.

`Authority` points the handler at the provider's OpenID Connect discovery document, from which it downloads the issuer name and the provider's public signing keys, and refreshes them when the provider rotates its keys. The handler then validates, by default:

- **The signature**, against the provider's public keys, so the token wasn't forged or altered.
- **The issuer (`iss`)**, so the token came from this provider.
- **The audience (`aud`)**, so the token was issued for this API and not for another one that happens to trust the same provider.
- **The lifetime (`exp`, `nbf`)**, with a default clock skew of five minutes.

An API validates *access tokens*. The *ID token* that OpenID Connect also issues describes the sign-in to the client app, and an API that accepts ID tokens as credentials accepts tokens that were never meant for it.

Setting `TokenValidationParameters` with a `SymmetricSecurityKey` instead of an `Authority` is for the case where the app issues its own tokens. Every service that validates such a token then holds the key that can also sign one, which is why tokens from a provider, signed with a private key the API never sees, are the usual choice.

An API that calls another API on the user's behalf needs a token issued for that downstream API, obtained from the provider through a delegation grant. Forwarding the incoming token instead fails the downstream audience check, as it should.

## Where Users and Tokens Come From

### An External Identity Provider

An API with users usually delegates sign-in to an identity provider, whether a hosted one such as Microsoft Entra ID or a self-hosted OpenID Connect server such as Duende IdentityServer or OpenIddict. The provider handles passwords, multi-factor authentication, account recovery, and token issuance, and the API only validates tokens as above. A server-rendered web app that signs users in through the provider uses the OpenID Connect handler (`AddOpenIdConnect`). Its `ResponseType` defaults to an ID-token-only response, so the app sets `ResponseType = "code"` to use the authorization code flow, and PKCE then applies by default.

### ASP.NET Core Identity

ASP.NET Core Identity is a user store and sign-in library for apps that manage their own accounts. It stores users through Entity Framework Core by default, hashes passwords with PBKDF2 using HMAC-SHA512 and 100,000 iterations (the defaults since .NET 7), and supports two-factor authentication through authenticator apps and email or SMS codes. It can lock out an account after repeated failures, but only for sign-in calls that pass `lockoutOnFailure: true`. `MapIdentityApi`'s login does, and the Blazor template's login page doesn't.

`AddIdentityApiEndpoints<TUser>()` registers Identity with a cookie scheme and a bearer-token scheme, and `MapIdentityApi<TUser>()` exposes it as API endpoints for registration, login, refresh, two-factor setup, and account management, for single-page apps and mobile clients that belong to the same app. Login can issue either a cookie or a bearer token.

- **Browser clients should use the cookie.** The browser sends it automatically and never exposes it to JavaScript.
- **The tokens aren't JWTs.** They are an opaque format specific to Identity, meant for first-party clients that can't use cookies. Identity's endpoints are deliberately not a token server for other APIs or third-party clients. An app that needs one needs an OpenID Connect server.

.NET 10 adds passkeys (WebAuthn) to Identity. A passkey is a key pair created by the user's device or security key, with the public half stored by the app, and it replaces the password as a primary sign-in method rather than acting as a second factor. The implementation doesn't validate attestation, the authenticator's proof of which device model created the key, by default. Only the Blazor Web App template includes passkeys, so another kind of app wires them up through `SignInManager`, Identity's sign-in service, following the template's pages.

## Other Credentials

### API Keys

An API key identifies a calling application, not a user, and suits service-to-service calls and developer access to a public API. A custom handler, deriving from `AuthenticationHandler<TOptions>`, reads the key from a header, looks it up, and builds a principal for the caller:

```csharp
public class ApiKeyHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IApiKeyStore keys) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Api-Key", out var provided))
        {
            return AuthenticateResult.NoResult();   // no key: let other schemes try
        }

        var client = await keys.FindByKeyHashAsync(Hash(provided.ToString()));
        if (client is null)
        {
            return AuthenticateResult.Fail("Invalid API key");
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, client.Id), new Claim("client_name", client.Name)],
            Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    private static string Hash(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
}
```

```csharp
builder.Services.AddAuthentication()
    .AddScheme<AuthenticationSchemeOptions, ApiKeyHandler>("ApiKey", null);
```

The store keeps a hash of each key rather than the key, so a leaked database doesn't leak working keys. A key is long and random, unlike a password, so a fast hash such as SHA-256 is enough. Keys belong in a header, not the query string, which servers and proxies log.

### Client Certificates

Certificate authentication identifies the caller by the client certificate presented during the TLS handshake, and is common between services, often as mutual TLS. Kestrel has to ask for the certificate, and the `Microsoft.AspNetCore.Authentication.Certificate` handler validates it and turns it into a principal:

```csharp
builder.WebHost.ConfigureKestrel(kestrel =>
    kestrel.ConfigureHttpsDefaults(https =>
    {
        https.ClientCertificateMode = ClientCertificateMode.RequireCertificate;
        https.AllowAnyClientCertificate();   // let the handler below make the decision
    }));

builder.Services.AddAuthentication(CertificateAuthenticationDefaults.AuthenticationScheme)
    .AddCertificate(options =>
    {
        options.Events = new CertificateAuthenticationEvents
        {
            OnCertificateValidated = context =>
            {
                var allowed = context.HttpContext.RequestServices.GetRequiredService<IAllowedClients>();
                if (!allowed.Contains(context.ClientCertificate.Thumbprint))
                {
                    context.Fail("Unknown client certificate");
                    return Task.CompletedTask;
                }

                context.Principal = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, context.ClientCertificate.Subject)],
                    context.Scheme.Name));
                context.Success();
                return Task.CompletedTask;
            }
        };
    });
```

Without `AllowAnyClientCertificate`, Kestrel itself rejects any certificate the machine doesn't trust during the TLS handshake, so a certificate from a private certificate authority never reaches the handler.

The handler's defaults are strict. It accepts only *chained* certificates (`AllowedCertificateTypes = Chained`), ones signed by a certificate authority, requires that chain to end at a root the machine trusts, and checks revocation online. `ChainTrustValidationMode = CustomRootTrust` with a `CustomTrustStore` trusts a private authority instead. Setting `CertificateTypes.All` also admits self-signed certificates, which anyone can create, so it is safe only with a check like the one above that pins the specific certificates allowed. A valid chain proves only that some trusted authority issued the certificate, which is why `OnCertificateValidated` should still check which client it is.

Behind a proxy that terminates TLS, the certificate arrives in a request header instead. `AddCertificateForwarding` and `UseCertificateForwarding` read it from that header before authentication runs. Azure App Service forwards the certificate but doesn't validate it, so the app's handler is still the only check. Validation is expensive, and `AddCertificateCache` caches results, as long as the validation logic depends only on the certificate.

### Combining Schemes

An API can accept several credentials. An authorization policy or attribute that names schemes runs those schemes for its endpoints *instead of* the default. The principal from the default scheme is discarded for that endpoint, and `User` holds only what the named schemes produced:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ServiceOrUser", policy => policy
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme, "ApiKey")
        .RequireAuthenticatedUser());
});
```

Naming schemes in a policy suits endpoints that accept a fixed set of credentials. When the choice depends on the request itself, a *policy scheme* forwards to another scheme based on the request, and serves as the default:

```csharp
builder.Services.AddAuthentication("Smart")
    .AddPolicyScheme("Smart", "Bearer or API key", options =>
    {
        options.ForwardDefaultSelector = context =>
            context.Request.Headers.ContainsKey("X-Api-Key") ? "ApiKey" : JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options => { /* ... */ })
    .AddScheme<AuthenticationSchemeOptions, ApiKeyHandler>("ApiKey", null);
```

## Authorization

### Roles, Claims, and Policies

The simplest check is a role, and roles are claims of the role claim type.

- `[Authorize(Roles = "Admin,Support")]` passes users in *either* role.
- Two `[Authorize]` attributes on the same endpoint must *both* pass.

Roles fit coarse, organizational access. Finer checks go in named policies, which combine requirements:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("OrdersWrite", policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim("permission", "orders:write"));

    options.AddPolicy("AtLeast21", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(21)));
});
```

`RequireClaim`, `RequireRole`, and `RequireAssertion` cover checks that only read the principal. Anything that needs logic or services, such as a database lookup, becomes a *requirement* with a *handler*. The permission-claim style above, filled in by claims transformation, lets an API change who may do what without changing role definitions in code.

### Requirements and Handlers

A requirement is a class implementing the marker interface `IAuthorizationRequirement`, holding the policy's parameters. A handler evaluates it:

```csharp
public record MinimumAgeRequirement(int MinimumAge) : IAuthorizationRequirement;

public class MinimumAgeHandler(TimeProvider clock) : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        if (context.User.FindFirst("birthdate")?.Value is { } value &&
            DateOnly.TryParse(value, CultureInfo.InvariantCulture, out var birthDate))
        {
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var age = today.Year - birthDate.Year - (today < birthDate.AddYears(today.Year - birthDate.Year) ? 1 : 0);
            if (age >= requirement.MinimumAge)
            {
                context.Succeed(requirement);
            }
        }
        return Task.CompletedTask;
    }
}

builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();
```

The evaluation rules are easy to get wrong.

- **A requirement passes when at least one handler calls `Succeed` for it, and a policy passes when all its requirements pass.** A handler that does nothing leaves the requirement unmet rather than failing it, so several handlers can offer alternative ways to satisfy one requirement.
- **`Fail` vetoes.** Once any handler calls `context.Fail()`, the policy fails, whatever the others do. The remaining handlers still run by default (`InvokeHandlersAfterFailure` is `true`), so a handler can't assume an earlier one has already decided.
- **Handlers are ordinary services.** A handler that needs a `DbContext` is registered as scoped, and one without dependencies on request state can be a singleton.

### Resource-Based Authorization

Some decisions depend on the resource: a user may edit only their own documents, or only documents in a draft state. The resource isn't known when the endpoint's attributes are evaluated, so the endpoint loads it and calls `IAuthorizationService` itself, passing the resource to the policy's handlers:

```csharp
app.MapPut("/documents/{id:int}", async (
    int id, DocumentUpdate update, ClaimsPrincipal user,
    IDocumentStore store, IAuthorizationService authorization) =>
{
    var document = await store.FindAsync(id);
    if (document is null) return Results.NotFound();

    var result = await authorization.AuthorizeAsync(user, document, "DocumentEdit");
    if (!result.Succeeded)
    {
        return user.Identity?.IsAuthenticated == true ? Results.Forbid() : Results.Challenge();
    }

    await store.UpdateAsync(document, update);
    return Results.NoContent();
}).RequireAuthorization();
```

The handler derives from `AuthorizationHandler<TRequirement, TResource>` and receives the document, so it can compare the owner to the user's ID or check the document's state. Returning `Forbid` for a signed-in user and `Challenge` for an anonymous one keeps the 401 and 403 meanings intact. Some APIs return `404` instead of `403` for resources the caller may not see, so the response doesn't confirm that the resource exists.

### Applying Authorization to Endpoints

Controllers and actions take `[Authorize]`, with a policy, roles, or schemes. Minimal API endpoints and route groups take `.RequireAuthorization(...)`, and applying it to a group covers every endpoint in it. `[AllowAnonymous]` or `.AllowAnonymous()` exempts an endpoint and overrides every requirement above it.

```csharp
var orders = app.MapGroup("/orders").RequireAuthorization();
orders.MapGet("/", ListOrders);
orders.MapPost("/", CreateOrder).RequireAuthorization("OrdersWrite");   // group requirement AND this policy
```

Two policies decide what happens when an endpoint doesn't name one.

- **The default policy** applies to `[Authorize]` or `.RequireAuthorization()` with no arguments. Out of the box it requires an authenticated user.
- **The fallback policy** applies to endpoints with no authorization metadata at all. It is `null` by default, which leaves such endpoints open.

Setting the fallback policy makes the app secure by default. An endpoint someone forgot to protect then requires authentication rather than being public, and public endpoints opt out explicitly:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

app.MapGet("/health", () => "ok").AllowAnonymous();
```

The fallback policy also covers static files served as endpoints by `MapStaticAssets`, so an app that serves public assets that way marks them anonymous too.

## Refresh and Revocation for Tokens You Issue

An API that validates tokens from an external provider leaves refresh and revocation to the provider. The provider issues short-lived access tokens with refresh tokens, and the API only has to reject expired tokens, which it does by default. The rest of this section applies to an app that issues its own tokens.

Access tokens stay short-lived, minutes rather than hours, because a JWT is valid until it expires and anyone holding it can use it. A refresh token lasts longer and is exchanged at a refresh endpoint for a new access token. Refresh tokens are stored server-side as hashes, like API keys, and *rotated*: each use issues a new refresh token and invalidates the old one. A second use of an already-rotated refresh token means one copy was stolen, and the issuer should then revoke every token in that session.

Revoking an access token before it expires needs state the token itself doesn't carry. The usual approach is a denylist of token IDs (the `jti` claim), checked on each request, whose entries can be dropped once the token would have expired anyway. That check costs a lookup per request, so many APIs accept the short lifetime as their revocation window and revoke only refresh tokens, which ends a session within minutes.

## Key Takeaways

- Authentication sets `HttpContext.User` and never rejects. Authorization challenges anonymous callers (401 for bearer) and forbids authenticated ones that fail a policy (403).
- Configure JWT bearer with `Authority` and `Audience` so signing keys come from the provider's metadata, and set `MapInboundClaims = false` to keep claim names such as `sub` intact.
- APIs validate access tokens, never ID tokens.
- Identity's API endpoints issue cookies or proprietary tokens for first-party clients, not JWTs for other APIs. Passkeys ship in .NET 10 through the Blazor Web App template.
- Store API keys and refresh tokens hashed, and pin allowed client certificates rather than trusting any valid chain.
- Put permission checks in named policies, and resource checks in handlers invoked through `IAuthorizationService`.
- `Fail` vetoes a policy, but the other handlers still run.
- Set a fallback policy so endpoints are protected unless they explicitly opt out.
