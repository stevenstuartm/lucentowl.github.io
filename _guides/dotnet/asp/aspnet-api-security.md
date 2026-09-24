---
title: "API Security"
layout: guide
category: "ASP.NET Core"
subcategory: "Security & Resilience"
description: "Comprehensive security practices for ASP.NET Core APIs, covering transport security, input validation, authentication, secrets management, and defense against common vulnerabilities."
tags: [asp-net-core, security, authentication, api-security, owasp, data-protection, encryption]
---

## Secure by Design

Building secure APIs requires thinking about security at every layer of the application. Transport security ensures data remains confidential in transit. Input validation prevents malicious data from entering the system. Authentication and authorization control who can access resources and what they can do. Secrets management protects sensitive configuration. Defense-in-depth layers multiple controls so that if one fails, others remain.

ASP.NET Core provides robust security primitives, but understanding when and how to apply them determines whether your API resists real attacks or merely appears secure.

## Transport Security

### HTTPS Enforcement

All API traffic should use HTTPS to protect data in transit. ASP.NET Core provides two mechanisms for enforcing this: redirection middleware and HTTP Strict Transport Security (HSTS).

HTTPS redirection middleware intercepts HTTP requests and returns a 307 redirect to the HTTPS endpoint. While this works for browser-based clients, APIs accessed directly by HTTP clients may experience failures. The CORS preflight request uses the OPTIONS method, and if the client sends it over HTTP, the redirect causes the preflight to fail with an error.

The recommended approach for APIs is to configure the server to only listen on HTTPS ports and reject HTTP connections entirely. This avoids redirect complications and ensures that all traffic uses encryption from the first byte.

```csharp
var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to only listen on HTTPS
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5001, listenOptions =>
    {
        listenOptions.UseHttps();
    });
});
```

### HTTP Strict Transport Security (HSTS)

HSTS instructs browsers to only communicate with the server over HTTPS, even if the user types an HTTP URL or clicks an HTTP link. The server sends a `Strict-Transport-Security` header with a max-age directive telling the browser how long to enforce this policy.

ASP.NET Core provides HSTS middleware that adds this header to responses. The middleware should be added early in the pipeline, before any middleware that might return a response.

```csharp
app.UseHsts();
```

HSTS configuration allows you to specify the max-age duration, whether to include subdomains, and whether to submit the domain to the HSTS preload list. Conservative settings use a short max-age initially, then increase it after verifying that HTTPS works correctly across all scenarios.

HSTS is primarily a browser security feature. Non-browser clients like mobile apps, desktop applications, or server-to-server API calls generally ignore HSTS headers. For APIs that serve non-browser clients, requiring HTTPS at the server configuration level provides stronger enforcement than relying on HSTS.

In development environments, HSTS should typically be disabled because the header is highly cacheable and can interfere with local testing when switching between HTTP and HTTPS configurations.

## HTTPS Redirection and HSTS

HTTPS redirection and HTTP Strict Transport Security (HSTS) are middleware components that enforce secure connections.

### HTTPS Redirection Middleware

The `UseHttpsRedirection` middleware intercepts HTTP requests and responds with a redirect to the HTTPS equivalent. This ensures that clients always communicate over an encrypted connection.

```csharp
app.UseHttpsRedirection();
```

The middleware responds with a 307 Temporary Redirect by default, though you can configure it to use 301 Permanent Redirect for production environments.

```csharp
builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status301MovedPermanently;
    options.HttpsPort = 443;
});
```

HTTPS redirection should appear early in the pipeline, before routing and authentication, so that insecure requests are upgraded before reaching sensitive middleware.

### HSTS Middleware

The `UseHsts` middleware adds the `Strict-Transport-Security` header to responses, instructing browsers to only access the site over HTTPS for a specified duration. This prevents downgrade attacks where an attacker forces the client to use HTTP.

```csharp
app.UseHsts();
```

HSTS is generally a browser-only instruction. Phone and desktop API clients do not obey the header, so HSTS is less relevant for pure APIs. However, if your API is also accessed by web browsers, HSTS provides an additional layer of security.

Configure HSTS behavior through options.

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});
```

HSTS should not be used in development because the header persists in the browser, and you cannot easily revert to HTTP. Only enable HSTS in production.

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
```

## Input Validation as a Security Boundary

Input validation serves two purposes: ensuring data meets application requirements and preventing security vulnerabilities. Validation that only checks for valid states fails to defend against malicious input that exploits application logic.

ASP.NET Core model validation uses data annotations to declare constraints, but these annotations primarily enforce business rules rather than security policies. A string marked as required and having a maximum length still accepts any content within those constraints, including special characters that might be dangerous in downstream contexts like SQL queries or shell commands.

Security-focused validation treats all external input as potentially malicious until proven otherwise. This means validating format, type, range, and allowed characters. A product ID parameter should only accept alphanumeric characters if that's the expected format, even though accepting special characters might not break the application. Rejecting unexpected input reduces the attack surface.

```csharp
public class ProductSearchRequest
{
    [Required]
    [RegularExpression(@"^[a-zA-Z0-9\-]{1,50}$",
        ErrorMessage = "Product ID must be alphanumeric with optional hyphens")]
    public string ProductId { get; set; }

    [Range(1, 1000)]
    public int PageSize { get; set; } = 20;
}
```

Validation should occur as early as possible in the request pipeline. Model binding validation runs automatically when using controller-based APIs with model classes. Minimal APIs require explicit validation using validation attributes and checking the `ModelState` or using validation libraries.

Input that passes validation but still contains potentially dangerous content requires encoding or sanitization before use in contexts where that content could be interpreted as code. HTML encoding prevents XSS attacks when displaying user content. Parameterized queries prevent SQL injection. Properly escaping shell arguments prevents command injection.

### Anti-Forgery Protection

Cross-Site Request Forgery (CSRF) attacks trick authenticated users into executing unwanted actions. An attacker creates a malicious web page that sends a request to your API, and because the browser automatically includes authentication cookies, the request appears legitimate.

ASP.NET Core includes anti-forgery token validation to defend against CSRF. The server generates a unique token and includes it in responses. The client must send this token back with state-changing requests. An attacker's malicious page cannot obtain the token because browsers enforce same-origin policy.

For traditional form-based APIs, anti-forgery tokens are automatically validated when using the `[ValidateAntiForgeryToken]` attribute. For APIs that accept JSON payloads or use minimal APIs, developers must explicitly configure anti-forgery protection.

```csharp
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});

app.Use(async (context, next) =>
{
    var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
    var tokens = antiforgery.GetAndStoreTokens(context);
    context.Response.Cookies.Append("CSRF-TOKEN", tokens.RequestToken!,
        new CookieOptions { HttpOnly = false });
    await next();
});
```

APIs consumed exclusively by non-browser clients typically do not need CSRF protection because these clients do not automatically send cookies with requests. However, if your API uses cookie-based authentication and can be called from a browser, anti-forgery tokens become essential.

Starting with .NET 8, endpoints that accept `IFormFile` or `IFormFileCollection` parameters automatically require anti-forgery validation. This prevents attackers from uploading files through CSRF attacks without requiring explicit developer action.

## Defending Against OWASP API Security Risks

The OWASP API Security Top 10 identifies the most critical risks facing APIs. While the list differs from the traditional OWASP Top 10 for web applications, many principles overlap. ASP.NET Core provides tools to mitigate these risks when applied correctly.

### Broken Object Level Authorization

Broken Object Level Authorization occurs when an API fails to verify that the authenticated user has permission to access a specific resource. The API authenticates the user but does not check whether they should be able to view or modify the requested object.

Consider an endpoint that retrieves order details by ID. Authentication confirms the user is logged in, but without authorization checks, any authenticated user could access any order by guessing or enumerating order IDs.

ASP.NET Core resource-based authorization addresses this by allowing authorization logic to examine both the user's identity and the specific resource being accessed. Authorization handlers receive the resource and make decisions based on its properties.

```csharp
public class OrderAuthorizationHandler : AuthorizationHandler<OperationAuthorizationRequirement, Order>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OperationAuthorizationRequirement requirement,
        Order resource)
    {
        if (context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value == resource.UserId)
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
```

Every endpoint that returns or modifies specific objects must verify that the authenticated user has permission to access those objects. Failing to perform these checks in every location where objects are accessed creates vulnerabilities.

### Broken Authentication and Authorization

Weak authentication mechanisms allow attackers to compromise user accounts or bypass authentication entirely. Common failures include accepting weak passwords, not implementing rate limiting on authentication endpoints, exposing sensitive information in error messages, and failing to protect authentication tokens.

ASP.NET Core Identity provides secure defaults including strong password hashing using PBKDF2 with per-user salts. The framework handles password storage, validation, and account lockout after failed attempts. Using these built-in features avoids common authentication mistakes.

Bearer token authentication requires protecting tokens from exposure and ensuring they expire appropriately. Tokens should have limited lifetimes, be transmitted only over HTTPS, and be stored securely by clients. Refresh token rotation prevents attackers from using stolen tokens indefinitely.

### Excessive Data Exposure

APIs that return entire database entities expose more data than clients need. Even if some properties seem harmless, returning unnecessary data increases the risk of information disclosure and makes the API contract harder to evolve.

Data Transfer Objects (DTOs) explicitly define what data the API returns, separating the API contract from the internal data model. This prevents accidental exposure when new sensitive properties are added to entities.

```csharp
public class UserProfileResponse
{
    public string UserId { get; set; }
    public string DisplayName { get; set; }
    public string Email { get; set; }
    // Internal properties like password hashes, security stamps,
    // and audit fields are not included
}
```

Every API response should include only the minimum data required for the client's use case. If different clients need different data, create separate DTOs rather than returning everything and letting clients ignore what they do not need.

### Unrestricted Resource Consumption

APIs without rate limiting or resource constraints are vulnerable to denial-of-service attacks and unintentional abuse. Attackers or misbehaving clients can overwhelm the server by sending excessive requests or uploading huge files.

ASP.NET Core includes built-in rate limiting middleware that restricts how many requests a client can make within a time window. Policies can be applied globally or to specific endpoints, with different limits for authenticated versus anonymous users.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
    });
});

app.UseRateLimiter();
```

Request body size limits prevent attackers from uploading extremely large payloads that consume memory or disk space. Kestrel enforces a default maximum request body size of approximately 28.6 MB. Endpoints that accept file uploads should set explicit limits based on expected use cases.

```csharp
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10 MB
});
```

Database query timeouts and pagination limits prevent expensive queries from consuming resources indefinitely. APIs should enforce maximum page sizes and reject requests that could trigger unbounded queries.

## Injection Prevention

Injection attacks occur when untrusted data is sent to an interpreter as part of a command or query. The interpreter executes the malicious input as code rather than treating it as data. SQL injection, command injection, and other injection variants all follow this pattern.

### SQL Injection Defense

Parameterized queries separate SQL code from data by sending them to the database as distinct elements. The database treats parameter values as data regardless of content, preventing attackers from injecting SQL syntax through user input.

Entity Framework Core uses parameterized queries by default when LINQ queries are translated to SQL. Interpolated string syntax with `FromSqlInterpolated` also produces parameterized queries safely.

```csharp
var productId = userInput;
var product = await context.Products
    .FromSqlInterpolated($"SELECT * FROM Products WHERE ProductId = {productId}")
    .FirstOrDefaultAsync();
```

The `FromSqlRaw` method requires manual parameterization. If user input is concatenated directly into the SQL string, the query becomes vulnerable to injection. Always use parameter placeholders and pass values separately.

Code analysis tools like the .NET analyzers detect potential SQL injection vulnerabilities. Rule CA3001 warns when untrusted input flows into SQL queries without parameterization, helping catch injection risks during development.

### Command Injection Defense

APIs that invoke shell commands or external processes using user-supplied input risk command injection. Attackers can inject shell metacharacters that alter command behavior or execute arbitrary commands.

Avoid constructing shell commands from user input when possible. Use libraries or APIs that provide structured interfaces rather than shell invocation. When shell execution is necessary, validate input strictly and avoid passing user input directly to shell interpreters.

Escaping shell arguments prevents metacharacters from being interpreted as syntax, but escaping rules vary by platform and shell. Using process invocation APIs that accept argument arrays bypasses the shell entirely and eliminates injection risks.

```csharp
var process = new Process
{
    StartInfo = new ProcessStartInfo
    {
        FileName = "tool.exe",
        Arguments = $"--input \"{sanitizedInput}\"",
        UseShellExecute = false
    }
};
```

## Mass Assignment Protection

Mass assignment vulnerabilities occur when model binding automatically maps request data to object properties without explicit control over which properties can be set. Attackers exploit this by sending unexpected properties that modify sensitive fields.

Consider a user profile endpoint that accepts a JSON payload and binds it to a `User` entity. If the entity includes properties like `IsAdmin` or `AccountBalance`, an attacker can include these fields in the request and modify values they should not control.

### Defense Through DTOs

DTOs define exactly which properties can be set through the API, preventing mass assignment by design. The API accepts a DTO, validates it, and manually maps the allowed properties to the entity.

```csharp
public class UpdateProfileRequest
{
    public string DisplayName { get; set; }
    public string Bio { get; set; }
}

[HttpPut("profile")]
public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
{
    var user = await GetCurrentUser();
    user.DisplayName = request.DisplayName;
    user.Bio = request.Bio;
    // IsAdmin and other sensitive properties cannot be modified
    await context.SaveChangesAsync();
    return Ok();
}
```

Explicit mapping requires more code but provides complete control over what can be changed. Automated mapping libraries like AutoMapper reduce boilerplate while maintaining the security boundary between DTOs and entities.

### The Bind Attribute

The `[Bind]` attribute specifies which properties model binding can set, providing an alternative to DTOs for simple scenarios. While less secure than DTOs because it relies on correct attribute usage, it can prevent mass assignment when applied correctly.

```csharp
[HttpPost]
public async Task<IActionResult> Create(
    [Bind("DisplayName", "Bio")] User user)
{
    // Only DisplayName and Bio can be set through binding
    await context.Users.AddAsync(user);
    await context.SaveChangesAsync();
    return Ok();
}
```

The `[Bind]` attribute becomes error-prone in complex scenarios with nested objects or inheritance. DTOs provide a more maintainable and reviewable approach, making the allowed properties explicit in the type definition rather than hidden in attribute parameters.

## Secrets Management

Applications require secrets like database connection strings, API keys, and encryption keys. Storing these secrets directly in code or configuration files creates security risks when source code is shared or configuration files are accidentally exposed.

### User Secrets for Development

The Secret Manager tool stores sensitive data during development outside the project directory. Secrets are stored in a JSON file in the user profile directory, separate from source control.

```csharp
// Access secrets like any other configuration
var connectionString = builder.Configuration["ConnectionStrings:Database"];
```

User Secrets are only for development. The storage location is not encrypted and provides no production security. Production environments require different secrets management solutions.

### Azure Key Vault for Production

Azure Key Vault provides centralized secrets storage with access control, audit logging, and automatic secret rotation. ASP.NET Core can load configuration directly from Key Vault at startup, making secrets available through the standard configuration API.

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{keyVaultName}.vault.azure.net/"),
    new DefaultAzureCredential());
```

Managed identities eliminate the need to store credentials for accessing Key Vault. The application authenticates to Azure using its managed identity, and Key Vault grants access based on Azure role assignments. This approach removes credentials from configuration entirely.

Key Vault secrets should be cached appropriately to avoid excessive API calls while still allowing updates to propagate. The Key Vault configuration provider caches secrets by default and provides options for controlling cache duration and reload behavior.

## Data Protection API

The Data Protection API provides cryptographic services for protecting sensitive data at rest. Unlike general-purpose encryption libraries, the Data Protection API manages key storage, rotation, and algorithm selection automatically.

The `IDataProtector` interface provides protection and unprotection methods that encrypt and decrypt data using time-limited keys. Protected data includes metadata that identifies the key used for encryption, allowing the system to automatically select the correct key for decryption even after key rotation.

```csharp
public class TokenService
{
    private readonly IDataProtector _protector;

    public TokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("TokenService.PasswordReset");
    }

    public string ProtectToken(string token)
    {
        return _protector.Protect(token);
    }

    public string UnprotectToken(string protectedToken)
    {
        return _protector.Unprotect(protectedToken);
    }
}
```

Purpose strings provide cryptographic isolation between different uses of the Data Protection API. Data protected with one purpose string cannot be decrypted using a protector created with a different purpose string, even within the same application.

The Data Protection API handles key storage and management automatically. In development, keys are stored in the user profile directory. In production, keys should be stored in a central location accessible to all application instances, such as Azure Blob Storage or a database. Key management configuration determines where keys are stored, how they are encrypted at rest, and how long they remain valid.

Time-limited protectors create protected data that automatically expires after a specified duration. This prevents protected tokens from remaining valid indefinitely even if they are leaked or stolen.

```csharp
var timeLimitedProtector = _protector.ToTimeLimitedDataProtector();
var protectedData = timeLimitedProtector.Protect(data, TimeSpan.FromHours(1));
```

## CORS Middleware

Cross-Origin Resource Sharing controls which browser-based applications can call your API. Without CORS policies, browsers block JavaScript from making requests to APIs hosted on different domains than the page that loaded the script.

CORS addresses a security model enforced by web browsers. When a page at https://example.com attempts to fetch data from https://api.example.com, the browser performs a CORS check. If the API does not explicitly allow requests from example.com, the browser blocks the request before it reaches your API.

ASP.NET Core's CORS middleware adds appropriate headers to responses, allowing browsers to permit cross-origin requests according to your policies.

### Configuring CORS Policies

CORS policies define which origins can access your API, which HTTP methods are allowed, which headers can be included, and whether credentials like cookies can be sent.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", builder =>
    {
        builder.WithOrigins("https://example.com", "https://app.example.com")
               .WithMethods("GET", "POST")
               .WithHeaders("Authorization", "Content-Type")
               .AllowCredentials();
    });

    options.AddPolicy("AllowAnyOrigin", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors();
```

The WithOrigins method specifies exact origin URLs. Origins include the scheme, host, and port. https://example.com and http://example.com are different origins. The AllowAnyOrigin method permits requests from any origin, which suits public APIs but sacrifices security for convenience.

WithMethods restricts which HTTP verbs are allowed. AllowAnyMethod permits all verbs including GET, POST, PUT, DELETE, and others. WithHeaders specifies which request headers are allowed beyond simple headers. AllowAnyHeader permits any header.

AllowCredentials indicates that requests can include credentials like cookies or authorization headers. This method cannot be combined with AllowAnyOrigin because allowing credentials from any origin creates security risks. If you need credentials, you must specify explicit origins.

### CORS with Preflight Requests

Complex requests trigger preflight checks where the browser sends an OPTIONS request before the actual request. The preflight asks the server whether the actual request is allowed. The server responds with CORS headers indicating which origins, methods, and headers are permitted.

Requests that include custom headers, use methods other than GET or POST, or send Content-Type headers other than application/x-www-form-urlencoded, multipart/form-data, or text/plain require preflight.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("PreflightPolicy", builder =>
    {
        builder.WithOrigins("https://example.com")
               .WithMethods("GET", "POST", "PUT", "DELETE")
               .WithHeaders("Authorization", "Content-Type", "X-Custom-Header")
               .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});
```

SetPreflightMaxAge tells browsers how long they can cache preflight results. Within that duration, browsers skip the preflight for subsequent matching requests. This reduces latency and server load for repeated requests from the same origin.

### Applying CORS to Endpoints

Apply CORS policies globally to all endpoints or selectively per endpoint. Global application uses middleware without parameters, and endpoint-specific application uses RequireCors on minimal APIs or EnableCors attribute on controllers.

```csharp
app.UseCors("AllowSpecificOrigin");

app.MapGet("/public-data", () => Results.Ok("Available to all"))
    .RequireCors("AllowAnyOrigin");

app.MapPost("/sensitive-operation", () => Results.Ok("Restricted"))
    .RequireCors("AllowSpecificOrigin");
```

Global CORS policies apply unless an endpoint overrides them. Endpoints that specify RequireCors use that policy instead of the global policy. This allows public endpoints to relax restrictions while sensitive endpoints enforce strict origin checks.

For controllers, apply EnableCors at the controller or action level.

```csharp
[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowSpecificOrigin")]
public class SecureController : ControllerBase
{
    [HttpGet("public")]
    [EnableCors("AllowAnyOrigin")]
    public IActionResult GetPublicData() => Ok("Public");

    [HttpPost("protected")]
    public IActionResult PostProtectedData() => Ok("Protected");
}
```

The controller-level attribute provides a default, and action-level attributes override it. This mirrors how rate limiting attributes work.

### CORS and Credentials

When allowing credentials, the origin must be explicit. Browsers reject responses that set Access-Control-Allow-Origin to * while also setting Access-Control-Allow-Credentials to true.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("CredentialPolicy", builder =>
    {
        builder.WithOrigins("https://app.example.com")
               .AllowCredentials()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});
```

Requests that include credentials send cookies, HTTP authentication, or client-side SSL certificates. APIs that rely on cookie-based authentication or require authorization headers must allow credentials and specify exact origins.

## Security Headers

HTTP security headers instruct browsers to enable additional security protections. While these headers primarily benefit browser-based clients, APIs that serve web applications should include them to protect against common browser-based attacks.

### Content Security Policy (CSP)

Content Security Policy controls which resources browsers can load, reducing the impact of cross-site scripting attacks. CSP headers specify allowed sources for scripts, styles, images, and other resource types.

Strict CSP policies can break applications that rely on inline scripts or styles. Gradual implementation using report-only mode allows monitoring violations before enforcing restrictions.

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'");
    await next();
});
```

### X-Content-Type-Options

The `X-Content-Type-Options` header with the value `nosniff` prevents browsers from MIME-sniffing responses away from the declared content type. This mitigates attacks where malicious content is disguised as a benign file type.

### X-Frame-Options

The `X-Frame-Options` header prevents the page from being embedded in frames or iframes, defending against clickjacking attacks where attackers trick users into clicking hidden elements.

The `DENY` value blocks framing entirely. The `SAMEORIGIN` value allows framing by pages from the same origin, permitting legitimate uses while blocking cross-origin attacks.

```csharp
context.Response.Headers.Add("X-Frame-Options", "DENY");
```

Applying security headers through middleware ensures they are added to all responses consistently. Alternatively, headers can be configured at the reverse proxy or load balancer level, centralizing security policy across multiple applications.

## IP Filtering and Allowlisting

IP filtering restricts API access to requests from known IP addresses or ranges. This provides a network-level security control useful for administrative APIs or internal services that should not be accessible from arbitrary locations.

ASP.NET Core middleware can implement IP filtering by checking the remote IP address of each request and rejecting requests from unauthorized addresses.

```csharp
public class IpFilterMiddleware
{
    private readonly RequestDelegate _next;
    private readonly HashSet<IPAddress> _allowedIps;

    public IpFilterMiddleware(RequestDelegate next, IEnumerable<string> allowedIps)
    {
        _next = next;
        _allowedIps = allowedIps
            .Select(IPAddress.Parse)
            .ToHashSet();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        if (!_allowedIps.Contains(remoteIp))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        await _next(context);
    }
}
```

IP allowlists should be stored in configuration and updated without requiring application restarts. Dynamic allowlists loaded from a database or external service provide flexibility for large or frequently changing IP sets.

When applications run behind load balancers or reverse proxies, the remote IP address seen by the application is the proxy's address rather than the original client address. Forwarded headers middleware extracts the original client IP from headers like `X-Forwarded-For`, but this requires trusting the proxy and configuring which proxies are allowed to set these headers.

Action filters provide an alternative to middleware for IP filtering, allowing IP restrictions on specific controllers or actions rather than the entire application. This granularity helps when only certain endpoints require IP filtering while the rest remain publicly accessible.

## Security Logging and Audit Trails

Security logging captures events relevant to detecting and investigating attacks or policy violations. Effective logs include authentication attempts, authorization failures, data access, and configuration changes.

ASP.NET Core includes structured logging through the `ILogger` interface. Security events should be logged with appropriate severity levels and include context like user identity, IP address, and resource accessed.

```csharp
public class SecureOrderController : ControllerBase
{
    private readonly ILogger<SecureOrderController> _logger;

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(string id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        _logger.LogInformation(
            "User {UserId} requested order {OrderId} from {IpAddress}",
            userId, id, HttpContext.Connection.RemoteIpAddress);

        var order = await _orderService.GetOrderAsync(id);
        if (order == null)
        {
            _logger.LogWarning(
                "User {UserId} requested non-existent order {OrderId}",
                userId, id);
            return NotFound();
        }

        if (!await _authService.CanAccessOrder(userId, order))
        {
            _logger.LogWarning(
                "User {UserId} denied access to order {OrderId}",
                userId, id);
            return Forbid();
        }

        return Ok(order);
    }
}
```

Structured logging allows log aggregation systems to query logs by specific properties like user ID or resource ID. This makes investigating security incidents more effective than searching through unstructured text logs.

Sensitive information should never be logged. Passwords, authentication tokens, social security numbers, and other personally identifiable information create security risks when written to logs. Log sanitization removes or redacts sensitive data before writing log entries.

Failed authentication attempts, authorization failures, and unusual access patterns should be logged at warning or error severity levels. High volumes of failed authentication attempts from a single IP address might indicate a brute-force attack. Sudden spikes in authorization failures might indicate an attacker probing for privilege escalation vulnerabilities.

Log retention policies must balance security needs with privacy requirements and storage costs. Audit logs for compliance purposes often require retention for months or years, while operational logs might only need days or weeks. Archiving older logs to cheaper storage helps manage costs while maintaining the ability to investigate historical incidents.

## Red Flags

**Accepting HTTP connections**: APIs that accept unencrypted HTTP traffic expose sensitive data and authentication credentials to network eavesdropping.

**Skipping input validation**: Treating input validation as optional or only validating for business rules rather than security creates injection vulnerabilities and other attack vectors.

**Using string concatenation for SQL**: Building SQL queries by concatenating user input creates SQL injection vulnerabilities regardless of input validation.

**Returning entities directly**: APIs that return database entities rather than DTOs leak internal implementation details and risk exposing sensitive properties.

**No rate limiting**: APIs without rate limiting become easy targets for denial-of-service attacks and credential stuffing.

**Storing secrets in configuration files**: Secrets committed to source control or stored in configuration files eventually leak through repository access, backups, or error messages.

**Missing authorization checks**: Authenticating users but failing to verify they can access specific resources creates broken object-level authorization vulnerabilities.

**Ignoring security logs**: Logging authentication failures and authorization denials without monitoring or alerting on suspicious patterns allows attacks to continue undetected.

**Trusting client input for authorization**: Making authorization decisions based on client-provided data like user IDs or role names rather than server-side verification allows trivial bypasses.

**No certificate validation**: Accepting any client certificate without validating the issuer, expiration, or revocation status defeats the purpose of certificate authentication.
