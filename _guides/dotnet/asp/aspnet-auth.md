---
title: "Authentication and Authorization"
layout: guide
category: "ASP.NET Core"
subcategory: "API Security & Resilience"
description: "Comprehensive guide to authentication schemes, authorization policies, and securing ASP.NET Core API endpoints using JWT, OAuth, Identity, and custom handlers."
tags: [asp-net-core, authentication, authorization, jwt, oauth, security, identity]
---

## Securing API Endpoints

ASP.NET Core provides a flexible authentication and authorization pipeline that works seamlessly with APIs. Understanding how authentication schemes, handlers, claims, and authorization policies interact enables you to build secure APIs that support multiple authentication methods, from JWT bearer tokens to API keys to passkeys. This guide covers the full spectrum from fundamental concepts to advanced patterns like resource-based authorization and token refresh strategies.

## Authentication Fundamentals

Authentication in ASP.NET Core revolves around three core concepts: schemes, handlers, and the claims-based identity model. When a request arrives at your API, the authentication middleware determines which handler should process it, the handler validates credentials and constructs a ClaimsPrincipal representing the authenticated user, and subsequent authorization middleware uses that ClaimsPrincipal to enforce access policies.

### Schemes and Handlers

An authentication scheme is a named configuration that tells ASP.NET Core how to authenticate requests. Common schemes include "Bearer" for JWT tokens, "Cookies" for cookie-based authentication, and custom schemes like "ApiKey" for API key validation. Each scheme is backed by an authentication handler that implements the actual validation logic.

When you register an authentication handler, you assign it a scheme name. The authentication middleware uses that name to select the appropriate handler based on the request context. For example, if a request contains an Authorization header with a Bearer token, the JWT bearer handler processes it. If the request contains an API key header, a custom handler validates that key.

Multiple schemes can coexist in a single application. This is common in APIs that support both user authentication via JWT and service-to-service authentication via API keys. The authentication middleware can be configured to try multiple schemes in sequence or select a scheme based on request characteristics.

### ClaimsPrincipal and ClaimsIdentity

When authentication succeeds, the handler constructs a ClaimsPrincipal object representing the authenticated user or service. The ClaimsPrincipal contains one or more ClaimsIdentity objects, each containing a collection of claims. Claims are key-value pairs that describe attributes of the identity, such as the user's name, email, role, or permissions.

The structure separates identity from attributes. The ClaimsIdentity represents who the user is and how they authenticated (the authentication scheme). The individual claims represent what the application knows about that user. This separation enables flexible authorization logic that queries claims rather than relying on fixed identity properties.

A typical ClaimsPrincipal for a JWT bearer token might include claims like subject (sub), email, roles, and custom application claims such as tenant ID or feature flags. Authorization policies can query these claims to make fine-grained access decisions without coupling authorization logic to specific authentication schemes.

### Claims Transformation

Sometimes the claims provided by an authentication handler don't match the claims your authorization logic expects. Claims transformation allows you to modify or augment the ClaimsPrincipal after authentication but before authorization. This is useful for adding claims based on database lookups, mapping external claims to internal roles, or enriching the identity with application-specific data.

Implementing claims transformation involves creating a class that implements IClaimsTransformation and registering it with dependency injection. The framework invokes the transformation after authentication completes, giving you an opportunity to add, remove, or modify claims before authorization policies evaluate them.

Common scenarios for claims transformation include loading user permissions from a database and adding them as claims, mapping external identity provider roles to application-specific roles, and adding tenant or organization context claims based on the authenticated user.

## JWT Bearer Authentication

JWT bearer authentication is the most common authentication mechanism for modern APIs. The client includes a JSON Web Token in the Authorization header, the API validates the token's signature and claims, and the handler constructs a ClaimsPrincipal from the token's payload.

### Token Validation

Token validation ensures that the JWT was issued by a trusted authority, hasn't been tampered with, and is still valid. ASP.NET Core's JWT bearer handler validates the signature, issuer, audience, and expiration claims automatically when properly configured.

The handler requires several configuration values to validate tokens correctly. The issuer identifies the authority that issued the token, typically your identity provider's URL. The audience identifies the intended recipient of the token, usually your API's identifier. The signing key or public key allows the handler to verify the token's signature and confirm its integrity.

Signature validation is critical for security. With symmetric keys, both the token issuer and the API share the same secret key, and the API uses that key to verify the signature. With asymmetric keys, the issuer signs tokens with a private key and publishes the corresponding public key, and the API retrieves the public key from the issuer's well-known endpoint and uses it to verify signatures. Asymmetric keys are strongly preferred for production scenarios because the API never possesses the private signing key, eliminating the risk of key compromise.

The handler validates several standard JWT claims automatically. The expiration claim (exp) ensures the token hasn't expired. The not-before claim (nbf) ensures the token isn't used before its designated start time. The issuer claim (iss) ensures the token came from the expected authority. The audience claim (aud) ensures the token was intended for your API. If any of these validations fail, the handler rejects the request with a 401 Unauthorized response.

### Configuring JWT Authentication

Registering JWT bearer authentication involves configuring the TokenValidationParameters that control how tokens are validated. These parameters specify the issuer, audience, signing key, and validation options.

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
        };
    });
```

This configuration validates all critical aspects of the token. In production, consider using asymmetric keys and retrieving the signing key from an OpenID Connect metadata endpoint rather than storing it in configuration.

### Error Handling

When token validation fails, the JWT bearer handler returns a 401 Unauthorized response. The response includes a WWW-Authenticate header describing why authentication failed. Common failure reasons include missing tokens, expired tokens, invalid signatures, and incorrect issuer or audience claims.

Distinguishing between authentication failures and authorization failures helps clients understand why their requests were rejected. A 401 response means the client didn't provide valid credentials or the credentials were invalid. A 403 response means the client authenticated successfully but lacks permission to access the requested resource. Returning the correct status code improves the API's usability and helps clients diagnose issues.

## OAuth 2.0 and OpenID Connect

OAuth 2.0 is an authorization framework that enables third-party applications to obtain limited access to protected resources. OpenID Connect builds on OAuth 2.0 to add an authentication layer, allowing clients to verify the identity of the user and obtain basic profile information.

### Understanding the Protocols

OAuth 2.0 defines several grant types that describe how clients obtain access tokens. The authorization code flow is the most secure option for web applications with a backend. The client redirects the user to the authorization server, the user authenticates and grants consent, the authorization server redirects back to the client with an authorization code, and the client exchanges the code for an access token. This flow keeps the access token server-side and never exposes it to the browser.

OpenID Connect extends OAuth 2.0 by adding an ID token alongside the access token. The ID token is a JWT that contains claims about the authenticated user, such as their subject identifier, name, and email. The API can validate the ID token to verify the user's identity without calling the authorization server.

Proof Key for Code Exchange (PKCE) is a security extension that protects the authorization code flow from interception attacks. The client generates a random code verifier, hashes it to create a code challenge, and sends the challenge with the authorization request. When exchanging the authorization code for tokens, the client proves possession of the original verifier. This prevents attackers from using stolen authorization codes. ASP.NET Core's OpenID Connect handler supports PKCE and enables it by default.

### Integration Patterns

Integrating OAuth 2.0 and OpenID Connect with your API depends on your architecture. For APIs that authenticate users directly, the API acts as a client to the authorization server and validates access tokens on incoming requests. For APIs that delegate authentication to a frontend application, the frontend handles the OAuth flow and sends access tokens to the API, which validates them using JWT bearer authentication.

When your API needs to call other protected APIs on behalf of the user, it must obtain access tokens for those APIs. This typically involves the on-behalf-of flow, where your API exchanges the user's access token for a new token scoped to the downstream API. The authorization server validates the original token and issues a new one with the appropriate audience.

### Identity Providers

Several identity providers support OAuth 2.0 and OpenID Connect and integrate well with ASP.NET Core. Microsoft Entra ID (formerly Azure Active Directory) provides enterprise identity management with support for organizational accounts and guest users. Auth0 offers a developer-friendly identity platform with extensive customization options. Duende IdentityServer and OpenIddict are open-source solutions you can host yourself, giving you complete control over the authentication experience.

Each provider has different capabilities and configuration requirements. Microsoft Entra ID excels at enterprise scenarios with Active Directory integration and conditional access policies. Auth0 provides a hosted solution with extensive social login options and flexible user management. Duende IdentityServer and OpenIddict offer maximum flexibility and control but require more operational effort. Choosing a provider depends on your security requirements, operational preferences, and whether you need features like multi-tenancy or federated identity.

## ASP.NET Core Identity

ASP.NET Core Identity is a membership system that provides user management, password hashing, role management, and authentication services. While Identity includes UI components for login and registration, this guide focuses on its role in API authentication.

### User Management

Identity manages users, passwords, and profile data using a store abstraction. The default implementation uses Entity Framework Core to persist data in a relational database, but you can implement custom stores for other data systems. The UserManager class provides methods for creating users, validating passwords, and managing user properties.

Password security is built into Identity. Passwords are hashed using PBKDF2 with HMAC-SHA256 by default, and the hashing configuration can be customized to adjust iteration counts or switch algorithms. Identity enforces password complexity requirements and supports features like account lockout after failed login attempts.

Two-factor authentication is supported through pluggable token providers. Users can enable two-factor authentication using authenticator apps, email codes, or SMS codes. When two-factor authentication is enabled, the login flow requires both the password and a second factor to complete authentication.

### API Authentication with Identity

Using Identity for API authentication typically involves generating JWT tokens after successful login. The API exposes endpoints for registration and login, validates credentials using Identity's UserManager, and issues JWT tokens to authenticated clients. The client includes the token in subsequent requests, and the API validates it using JWT bearer authentication.

Identity's API endpoints provide a streamlined way to expose authentication functionality without building custom controllers. These endpoints support registration, login, two-factor authentication, and account management. They return tokens that clients can use for authenticated requests.

The relationship between Identity and authentication schemes is complementary. Identity manages user accounts and validates credentials. Authentication schemes validate tokens or other credentials on incoming requests. After Identity authenticates a user, you issue a token and the client uses that token with the JWT bearer scheme for subsequent requests.

### Passkey Support

Starting with .NET 10, ASP.NET Core Identity includes built-in support for passkey authentication using WebAuthn and FIDO2 standards. Passkeys allow users to authenticate using biometrics, security keys, or device-based credentials without passwords. This improves security by eliminating password-related vulnerabilities like phishing and credential stuffing.

Passkey support integrates seamlessly with Identity's user management. Users can register passkeys as an authentication method on their accounts, and they can create new accounts without passwords by registering a passkey during account creation. The implementation supports common WebAuthn scenarios but is deliberately scoped to authentication rather than providing a general-purpose WebAuthn library.

The passkey implementation currently appears only in the Blazor Web App template. For APIs that need passkey authentication, you can reference the template's implementation or use community libraries like fido2-net-lib or WebAuthn.Net that provide comprehensive WebAuthn protocol support.

## API Key Authentication

API keys provide a simple authentication mechanism for service-to-service communication or developer access to APIs. An API key is a secret token that identifies the calling application or service. The client includes the key in a header, query parameter, or other agreed-upon location, and the API validates the key against a trusted store.

### Implementation Patterns

Implementing API key authentication involves creating a custom authentication handler that extracts the key from the request, validates it against a store of valid keys, and constructs a ClaimsPrincipal if validation succeeds. The handler extends AuthenticationHandler and overrides the HandleAuthenticateAsync method to perform validation logic.

API keys can be transmitted in several ways. Headers are the most secure option and are commonly used for production APIs. The client includes the key in a custom header like X-API-Key. Query parameters are less secure because URLs are often logged, but they are convenient for testing and development. Authorization headers using a custom scheme like ApiKey provide a standards-based alternative to custom headers.

Storing and validating keys securely is critical. Keys should be hashed in the database using the same approach as passwords, so that compromised database backups don't expose valid keys. When a request arrives, the API hashes the provided key and compares it to stored hashes. This prevents key exposure even if the database is compromised.

### Multiple Authentication Schemes

APIs often need to support multiple authentication methods simultaneously. A public API might accept both JWT bearer tokens for user requests and API keys for service requests. ASP.NET Core supports multiple authentication schemes by registering multiple handlers and selecting the appropriate handler based on request characteristics.

The authentication middleware can be configured with a default scheme and additional named schemes. When an endpoint requires authentication but doesn't specify a scheme, the default scheme is used. Endpoints can specify a specific scheme using authorization attributes or RequireAuthorization with a policy that specifies the scheme.

Composite authentication is another pattern where multiple schemes are evaluated in sequence until one succeeds. This allows fallback behavior, such as trying JWT bearer authentication first and falling back to API key authentication if no bearer token is present. Implementing this requires a custom handler that delegates to other handlers based on request content.

## Authorization Fundamentals

Authorization determines what an authenticated user is allowed to do. ASP.NET Core provides several authorization models ranging from simple role checks to complex policy-based authorization with custom handlers.

### Role-Based Authorization

Role-based authorization is the simplest model. Users are assigned to roles like Admin, User, or Manager, and endpoints require membership in specific roles. The Authorize attribute and RequireAuthorization method accept role parameters that specify which roles are allowed.

Roles are represented as claims with the claim type Role. When a user authenticates, the authentication handler includes role claims in the ClaimsPrincipal, and the authorization middleware checks whether the user has the required role claims. Multiple roles can be specified, and the user must have at least one of the specified roles to access the resource.

Role-based authorization works well for coarse-grained access control where permissions align with organizational roles. It breaks down when you need fine-grained permissions that don't map cleanly to roles or when permissions are dynamic and configured at runtime rather than compile time.

### Claims-Based Authorization

Claims-based authorization makes access decisions based on arbitrary claims rather than predefined roles. Any claim can serve as the basis for authorization, such as email domain, subscription level, or account status. This provides more flexibility than role-based authorization and enables dynamic permission models.

Policies define the requirements that a user's claims must satisfy. A policy might require a specific claim type, a claim with a specific value, or multiple claims that satisfy complex logic. Policies are registered during application startup and referenced by name in authorization attributes or RequireAuthorization calls.

A common pattern is to map roles to permissions and store permissions as claims. When a user authenticates, claims transformation loads their permissions from a database and adds them as claims. Authorization policies check for the presence of permission claims rather than role claims. This decouples authorization logic from role definitions and allows permissions to change without code changes.

### Policy-Based Authorization

Policy-based authorization generalizes claims-based authorization to support arbitrary requirements. A policy consists of one or more requirements, and each requirement has one or more handlers that evaluate whether the user satisfies the requirement. If all requirements are satisfied, authorization succeeds.

Requirements are classes that implement IAuthorizationRequirement, which is a marker interface with no methods. Requirements define what must be true for authorization to succeed, but they don't implement the logic. Handlers implement IAuthorizationHandler and contain the actual authorization logic. This separation allows multiple handlers to evaluate the same requirement in different ways or for different contexts.

Registering policies involves configuring the authorization options during application startup. Each policy has a name and a set of requirements. Authorization attributes and RequireAuthorization calls reference policies by name, and the authorization middleware evaluates the policy's requirements when a request targets a protected endpoint.

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AtLeast21", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(21)));
});
```

This policy defines a requirement that the user must be at least 21 years old. The corresponding handler extracts the user's birthdate from their claims and calculates their age to determine if the requirement is satisfied.

## Custom Authorization Handlers

Custom authorization handlers enable complex authorization logic that goes beyond simple claim checks. Handlers can query databases, call external services, or implement business logic to determine whether access should be granted.

### Implementing IAuthorizationHandler

An authorization handler implements IAuthorizationHandler or extends AuthorizationHandler with a generic requirement type. The handler's HandleAsync method receives an AuthorizationHandlerContext containing the user's ClaimsPrincipal, the resource being accessed, and the requirements being evaluated. The handler evaluates the requirement and calls context.Succeed if the user satisfies it.

Multiple handlers can evaluate the same requirement. If any handler calls Succeed, the requirement is satisfied. If any handler calls Fail, authorization fails immediately regardless of other handlers. If no handler calls Succeed or Fail, the requirement is not satisfied and authorization fails by default.

Handlers are registered with dependency injection using any service lifetime. Transient handlers are created for each authorization check, scoped handlers are created per request, and singleton handlers are shared across the application. The choice depends on whether the handler needs to access request-scoped services like database contexts.

```csharp
public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        MinimumAgeRequirement requirement)
    {
        var birthDateClaim = context.User.FindFirst(c => c.Type == "birthdate");
        if (birthDateClaim == null)
            return Task.CompletedTask;

        var birthDate = DateTime.Parse(birthDateClaim.Value);
        var age = DateTime.Today.Year - birthDate.Year;
        if (birthDate.Date > DateTime.Today.AddYears(-age)) age--;

        if (age >= requirement.MinimumAge)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

This handler extracts the birthdate claim, calculates the user's age, and succeeds if the age meets the requirement. Handlers that don't call Succeed implicitly fail the requirement.

### Resource-Based Authorization

Resource-based authorization makes decisions based on the specific resource being accessed, not just the user's identity and claims. This is necessary when authorization depends on resource ownership, state, or other properties that vary per resource.

The pattern involves deferring authorization until the resource is loaded. Instead of applying authorization at the endpoint level, the handler loads the resource, then invokes the authorization service programmatically, passing both the user and the resource. The authorization handler receives the resource through the context and uses its properties to make the authorization decision.

```csharp
public async Task<IActionResult> Edit(int documentId)
{
    var document = await _repository.GetDocumentAsync(documentId);
    if (document == null)
        return NotFound();

    var authResult = await _authorizationService.AuthorizeAsync(
        User, document, "EditPolicy");

    if (!authResult.Succeeded)
        return Forbid();

    // Process the edit
}
```

The authorization handler for the EditPolicy requirement receives the document object and checks whether the current user owns it or has elevated permissions to edit any document. This enables per-resource authorization rules that aren't possible with endpoint-level authorization.

Resource-based authorization is common in multi-tenant applications, where users can only access resources within their tenant, in document management systems, where users can only modify their own documents or documents they've been granted access to, and in approval workflows, where authorization depends on the document's current state and the user's role in the workflow.

## Authorization in Controllers and Minimal APIs

Protecting endpoints requires applying authorization either through attributes in controller-based APIs or through extension methods in minimal APIs.

### Controller-Based APIs

In controller-based APIs, the Authorize attribute controls access to controllers and actions. Applying the attribute at the controller level requires authorization for all actions in that controller. Applying it at the action level requires authorization only for that action. The AllowAnonymous attribute overrides controller-level authorization to permit unauthenticated access to specific actions.

The Authorize attribute accepts parameters that specify required roles, policies, or authentication schemes. Multiple attributes can be combined to require multiple conditions, such as requiring both a specific role and a specific policy. All specified requirements must be satisfied for authorization to succeed.

```csharp
[Authorize(Policy = "AtLeast21")]
public class ProductsController : ControllerBase
{
    [AllowAnonymous]
    public IActionResult Get() { }

    [Authorize(Roles = "Admin")]
    public IActionResult Delete(int id) { }
}
```

The Get action allows anonymous access despite the controller-level policy requirement. The Delete action requires both the AtLeast21 policy and the Admin role.

### Minimal APIs

Minimal APIs use the RequireAuthorization extension method to apply authorization to route handlers. The method accepts the same parameters as the Authorize attribute, including policy names, roles, and authentication schemes.

```csharp
app.MapGet("/products", GetProducts).RequireAuthorization();
app.MapDelete("/products/{id}", DeleteProduct)
    .RequireAuthorization("AdminPolicy");
```

The first endpoint requires authentication but no specific policy. The second endpoint requires the AdminPolicy policy. The AllowAnonymous method permits unauthenticated access to specific endpoints, overriding global authorization requirements.

### Global Authorization

Requiring authentication by default for all endpoints and explicitly marking public endpoints as anonymous is a secure-by-default approach. This is achieved using a fallback authorization policy.

The fallback policy applies when an endpoint has no explicit authorization metadata, meaning no Authorize attribute, no RequireAuthorization call, and no AllowAnonymous marker. By setting a fallback policy that requires authenticated users, all endpoints are protected by default unless explicitly marked as anonymous.

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
```

With this configuration, forgetting to add authorization to an endpoint results in requiring authentication rather than accidentally exposing the endpoint publicly. This reduces the risk of authorization bugs.

The DefaultPolicy serves a different purpose. It defines the policy used when an endpoint specifies authorization without naming a specific policy. For example, RequireAuthorization() without parameters uses the DefaultPolicy. The FallbackPolicy is used when no authorization is specified at all.

## Handling 401 and 403 Responses

Distinguishing between 401 Unauthorized and 403 Forbidden responses helps clients understand why their requests were rejected and how to fix them.

A 401 response indicates an authentication failure. The client either didn't provide credentials, provided invalid credentials, or the credentials have expired. The response should include a WWW-Authenticate header describing the expected authentication scheme and any additional information about why authentication failed. Clients should respond by obtaining new credentials, such as refreshing an expired token or prompting the user to log in again.

A 403 response indicates an authorization failure. The client authenticated successfully, and the API knows who they are, but they don't have permission to access the requested resource. This might mean they lack a required role, don't satisfy a policy requirement, or aren't the owner of the resource. Clients cannot fix this by re-authenticating because the problem is insufficient permissions, not invalid credentials.

The order of middleware in the pipeline determines which status code is returned. The authentication middleware runs first and returns 401 if authentication fails. If authentication succeeds but authorization fails, the authorization middleware returns 403. This ensures that unauthenticated requests receive 401 and authenticated but unauthorized requests receive 403.

Custom error handling middleware can intercept these responses to add detailed error messages or transform the response format. Be cautious about revealing too much information in error responses, particularly for 403 responses, because describing why authorization failed might expose information about the system's authorization model or the existence of resources that the user shouldn't know about.

## Token Refresh and Revocation

Access tokens should be short-lived to limit the damage if they're stolen. Refresh tokens allow clients to obtain new access tokens without requiring the user to authenticate again. This balances security and usability by keeping access tokens short-lived while avoiding frequent authentication prompts.

### Refresh Token Patterns

The typical flow involves the client authenticating and receiving both an access token and a refresh token. The access token is short-lived, often 5 to 15 minutes, while the refresh token is long-lived, lasting days or weeks. When the access token expires, the client sends the refresh token to a refresh endpoint, which validates the refresh token and issues a new access token and optionally a new refresh token.

Refresh tokens must be stored securely because they grant long-term access. They should be stored server-side in a database, hashed similar to passwords. When a client presents a refresh token, the API hashes it and checks for a matching hash in the database. This prevents stolen database backups from revealing valid refresh tokens.

Token rotation improves security by issuing a new refresh token each time the old one is used and immediately revoking the old token. This limits the window of opportunity for an attacker who steals a refresh token. If a revoked refresh token is used, it indicates potential token theft, and the API can revoke all tokens for that user and require re-authentication.

### Revocation Strategies

Revocation allows the API to invalidate tokens before their expiration time. This is necessary when a user logs out, when a user's account is disabled or deleted, when suspicious activity is detected, or when a token is known to be compromised.

Since access tokens are self-contained JWTs validated without contacting a central authority, revocation requires maintaining a blacklist of invalidated tokens or using a token introspection endpoint. The blacklist stores token identifiers (jti claims) for revoked tokens. On each request, the API checks whether the token's jti is on the blacklist and rejects the request if it is. Tokens automatically fall off the blacklist when they expire naturally.

Refresh tokens are easier to revoke because they're stored server-side. Revoking a refresh token involves deleting its database entry. When a client tries to use a revoked refresh token, the API finds no matching entry and rejects the request. This prevents the client from obtaining new access tokens, and existing access tokens expire quickly due to their short lifetime.

The trade-off with blacklists is the added latency and complexity of checking the blacklist on every request. For high-security scenarios, this is acceptable. For performance-sensitive scenarios, consider shorter access token lifetimes and rely on natural expiration rather than revocation.

## Red Flags and Common Pitfalls

Several mistakes undermine API security or create maintenance burdens. Watch for these patterns.

Long-lived access tokens reduce security. If an access token is valid for hours or days, an attacker who steals it has a long window to exploit it. Keep access tokens short-lived, ideally 5 to 15 minutes, and use refresh tokens for long-term access.

Storing secrets in code or configuration files creates security risks. Use environment variables, secret management services, or configuration providers that retrieve secrets at runtime rather than embedding them in source code or configuration files that might be committed to version control.

Ignoring token validation parameters allows invalid tokens to pass through. Always validate the issuer, audience, signature, and expiration claims. Disabling validation to fix issues during development often leads to accidentally deploying insecure configurations to production.

Using symmetric keys for JWT signing in distributed systems is problematic because every instance of the API must possess the signing key, increasing the risk of key compromise. Use asymmetric keys where the API validates tokens using the public key and only the token issuer possesses the private key.

Failing to distinguish between authentication and authorization leads to confused error handling and unclear authorization logic. Always authenticate first to establish identity, then authorize to enforce access control. Return 401 for authentication failures and 403 for authorization failures.

Implementing custom authentication or cryptography is risky. Use the framework's built-in authentication handlers and token validation whenever possible. When custom logic is necessary, extend the framework's abstractions rather than replacing them entirely. Never implement your own password hashing, token signing, or encryption algorithms.

Exposing detailed error messages in production reveals information about the system's internal workings and authorization model. Log detailed errors for debugging but return generic error messages to clients. For example, return "Access denied" rather than "User lacks Admin role required for this endpoint."

Not protecting against token replay attacks in high-security scenarios creates vulnerabilities. For APIs that require replay protection, use short-lived tokens, implement one-time token usage (revoking tokens after first use), or use additional security mechanisms like signed requests or proof-of-possession tokens.
