---
title: "Application Security"
layout: guide
category: Security
subcategory: Application Security
description: "Writing application code that resists attack: the OWASP Top 10 2025 as a map of what goes wrong, broken access control, injection, cross-site scripting and request forgery, insecure deserialization, session management, error handling that leaks nothing, security headers, and API-specific concerns such as mass assignment and rate limiting."
tags: [practical, owasp-top-10, secure-coding, injection, xss, access-control, api-security]
---

## Where Application Flaws Come From

Almost every application vulnerability is a failure of one of two things: trusting input that should not be trusted, or failing to check that the caller is allowed to do what they asked. Injection, cross-site scripting, deserialization flaws, and request forgery are variations on the first. Broken access control is the second, and it is consistently the most common category found in real applications.

The [OWASP Top 10](https://top10.owasp.org/2025){:target="_blank" rel="noopener noreferrer"} is the most widely used map of these failures. It is a data-driven awareness document rather than a standard, ranking the categories seen most often across real applications and testing data. The 2025 edition, released in November 2025, reshuffled the list.

| Rank | Category | What it covers |
|---|---|---|
| **A01** | Broken Access Control | Users acting outside their permissions, including server-side request forgery |
| **A02** | Security Misconfiguration | Insecure defaults, unnecessary features, verbose errors, missing hardening |
| **A03** | Software Supply Chain Failures | Risk from dependencies, build systems, and everything else you did not write |
| **A04** | Cryptographic Failures | Sensitive data unprotected in transit or at rest, weak or misused algorithms |
| **A05** | Injection | Untrusted input interpreted as code or commands, including cross-site scripting |
| **A06** | Insecure Design | Missing or flawed security design, as opposed to a flawed implementation |
| **A07** | Authentication Failures | Weak credentials, broken session handling, flawed recovery |
| **A08** | Software or Data Integrity Failures | Unverified updates, insecure deserialization, untrusted CI/CD |
| **A09** | Security Logging and Alerting Failures | Attacks that nobody sees or responds to |
| **A10** | Mishandling of Exceptional Conditions | Error and edge-case handling that fails open or leaks information |

Two changes matter for anyone who learned the 2021 list. **Software Supply Chain Failures** is new at A03, widening the old "Vulnerable and Outdated Components" category to cover the build pipeline and the dependencies you cannot see. **SSRF** is no longer its own entry; it sits inside A01, since it is a failure to control which resources a request may reach.

The rest of this guide covers the classes a developer writes code against directly.

---

## Broken Access Control

Access control decides whether the authenticated caller may perform this action on this object. It breaks in a small number of recurring ways.

**Insecure direct object references** are the most common. An endpoint accepts an identifier and returns the object without checking who owns it:

```csharp
// Vulnerable: any authenticated user can read any invoice
[HttpGet("/api/invoices/{id}")]
public async Task<IActionResult> Get(int id)
{
    var invoice = await _db.Invoices.FindAsync(id);
    return invoice is null ? NotFound() : Ok(invoice);
}

// Fixed: the query is scoped to the caller's organization
[HttpGet("/api/invoices/{id}")]
public async Task<IActionResult> Get(int id)
{
    var orgId = User.GetOrganizationId();
    var invoice = await _db.Invoices
        .SingleOrDefaultAsync(i => i.Id == id && i.OrganizationId == orgId);

    return invoice is null ? NotFound() : Ok(invoice);
}
```

Returning `NotFound` rather than `Forbid` for an object the caller may not see also avoids confirming that the object exists.

Other forms follow the same shape:

- **Missing function-level checks.** An admin action protected only by hiding the button, or by a check in the user interface rather than the server.
- **Privilege escalation through parameters.** Accepting a `role` or `isAdmin` field from the client during registration or profile update.
- **Server-side request forgery (SSRF).** The application fetches a URL supplied by the user, and an attacker points it at an internal service or a cloud metadata endpoint. Validate against an allowlist of permitted hosts and protocols, resolve the hostname and check the resulting address is not internal, and disable redirects.

The structural defenses are to deny by default, to enforce on the server for every request, and to centralize the decision. Scoping data access by tenant or owner at the data access layer, rather than in each controller, removes the chance of forgetting it in one place.

---

## Injection

Injection happens when untrusted input is interpreted as code by some interpreter: a database, a shell, an LDAP directory, an XML parser, or a browser. The fix is always the same in shape. Keep data as data by using an interface that separates code from parameters.

### SQL Injection

```csharp
// Vulnerable: the input becomes part of the statement
var sql = $"SELECT * FROM Users WHERE Email = '{email}'";

// Fixed: the value is sent separately from the statement
var user = await _db.Users
    .SingleOrDefaultAsync(u => u.Email == email);           // parameterized by the ORM

// Or with raw SQL, still parameterized
var cmd = new SqlCommand("SELECT * FROM Users WHERE Email = @email", conn);
cmd.Parameters.AddWithValue("@email", email);
```

Object-relational mappers parameterize by default, but they all have an escape hatch for raw SQL, and string interpolation inside that escape hatch reintroduces the flaw. Dynamic parts that cannot be parameterized, such as a column name in an `ORDER BY`, are validated against an allowlist of known column names rather than escaped.

Least privilege limits the damage: an account with rights only to the tables the application uses cannot read others, and one without DDL rights cannot drop them.

### Command and Other Injection

Passing user input to a shell invites command injection. Call the target program directly with an argument array rather than building a command line, and validate inputs against an allowlist. The same reasoning applies to LDAP filters, XPath expressions, and NoSQL query documents, where user-supplied objects can become query operators.

### Cross-Site Scripting

XSS is injection into a page: attacker-controlled input ends up in HTML or JavaScript that the victim's browser executes, in the victim's session. It comes in three forms.

| Form | Where the payload lives | Typical vector |
|---|---|---|
| **Reflected** | In the request, echoed into the response | A crafted link sent to a victim |
| **Stored** | In the database, served to every viewer | A comment, profile field, or file name |
| **DOM-based** | Never leaves the browser | Client-side code writing untrusted data into the DOM |

The defense is contextual output encoding. Data inserted into HTML text, an HTML attribute, JavaScript, a URL, or CSS each needs different encoding, and a template engine that encodes by default (such as Razor, which HTML-encodes `@model.Value`) handles most cases. The dangerous operations are the ones that bypass it: `Html.Raw`, `innerHTML`, `dangerouslySetInnerHTML`, and building HTML by string concatenation. Where user-supplied HTML genuinely must be rendered, such as rich text, sanitize it with a maintained library against an allowlist of tags and attributes.

A **Content Security Policy** adds a second layer by telling the browser which script sources to execute, so an injected inline script is refused even if encoding failed.

---

## Cross-Site Request Forgery

CSRF abuses the fact that browsers attach cookies to requests automatically. If a user is signed in to a banking site and visits an attacker's page, that page can submit a form to the bank, and the browser includes the session cookie. The bank sees an authenticated request that the user never intended.

Two defenses work together:

- **Anti-forgery tokens.** The server issues a random token tied to the session, the form or request includes it, and the server rejects requests without a valid one. An attacker's page cannot read the token because of the browser's same-origin policy. Modern web frameworks provide this, and in ASP.NET Core it is applied with `[ValidateAntiForgeryToken]` or automatically for Razor Pages.
- **`SameSite` cookies.** A session cookie marked `SameSite=Lax` (the common default) or `Strict` is not sent on cross-site POST requests, which blocks the basic attack. Treat it as defense in depth rather than a replacement for tokens.

APIs that authenticate with an `Authorization` header rather than cookies are not vulnerable to classic CSRF, because the browser does not attach that header automatically.

---

## Session Management

Once a user authenticates, the session is what an attacker wants. Session handling rules are short and mechanical:

- **Generate session identifiers with a cryptographically secure random generator**, long enough not to be guessable, and never derive them from the user ID or a timestamp.
- **Set cookie flags**: `Secure` (HTTPS only), `HttpOnly` (unreadable by JavaScript, which limits what XSS can steal), and an appropriate `SameSite` value.
- **Regenerate the session identifier on privilege change**, especially at login. Reusing a pre-login identifier allows session fixation, where an attacker plants a known identifier before the victim signs in.
- **Expire sessions** with both an idle timeout and an absolute lifetime, and make logout invalidate the session on the server, not just delete the cookie.
- **Where tokens are used instead of server-side sessions**, keep them short-lived, because a stateless token cannot be revoked before it expires unless a revocation list is maintained.

---

## Software Integrity and Deserialization

Deserializing untrusted data with a format that can reconstruct arbitrary object graphs allows an attacker to trigger code execution during deserialization, before any of your validation runs. In .NET, `BinaryFormatter` is the classic example, and it is obsolete and disabled by default in current versions for exactly this reason.

The safe approach is to deserialize untrusted input only into simple data types with a data-only format such as JSON, with polymorphic type handling disabled so the payload cannot choose which types to construct. Where objects must survive a round trip through a client, sign them so tampering is detected.

The same category covers integrity of what the application runs: dependencies pulled from package registries, build pipelines that can inject code, and updates applied without signature verification.

---

## Error Handling and Logging

Errors are a security feature twice over: they must not tell an attacker anything, and they must tell defenders everything.

**What the user sees** is a generic message and a correlation identifier. Stack traces, SQL fragments, framework versions, and file paths in a response are reconnaissance. Configure the framework's production error page rather than relying on each handler to be careful, and make error responses uniform where differences would leak information, as with login failures that distinguish "unknown user" from "wrong password".

**What gets logged** is the detail: the exception, the correlation identifier, the authenticated identity, the action attempted, and the outcome. Security-relevant events deserve explicit logging, including authentication successes and failures, authorization denials, changes to permissions, and administrative actions. Passwords, tokens, card numbers, and personal data do not belong in logs, and logs are protected from modification by the application that writes them.

Handling of exceptional conditions is its own Top 10 category because of what happens when it goes wrong. A caught exception that logs a warning and continues as if the operation succeeded, or a failed authorization lookup treated as a grant, turns an error path into a security bypass. Error paths fail closed.

---

## Security Headers

A few response headers instruct the browser to enforce protections the application cannot enforce alone.

| Header | Effect |
|---|---|
| `Content-Security-Policy` | Restricts where scripts, styles, and other resources may load from, limiting XSS |
| `Strict-Transport-Security` | Forces HTTPS for the domain for a set period, defeating downgrade attempts |
| `X-Content-Type-Options: nosniff` | Stops the browser guessing a content type different from the one declared |
| `X-Frame-Options` or CSP `frame-ancestors` | Prevents the page being framed, which blocks clickjacking |
| `Referrer-Policy` | Limits how much URL information leaks to other sites |

CSP is the one that takes the most effort, since a policy strict enough to matter usually requires removing inline scripts. Deploying it in report-only mode first shows what would break.

---

## API Security

APIs share the flaws above and add a few of their own, because they expose object identifiers and operations directly and have no user interface to constrain what clients send.

- **Object-level authorization** is the top API risk for the same reason it tops the web list. Every request names an object, and every request must be checked against the caller's rights to that object.
- **Mass assignment.** Binding a request body straight onto an entity lets a client set fields it should not, such as `Role` or `AccountBalance`. Bind to a dedicated request model containing only the fields clients may set.
- **Excessive data exposure.** Returning full entities and expecting the client to display a subset means the data is still in the response. Return purpose-built response models.
- **Rate limiting and quotas.** Limits protect against credential stuffing, scraping, and expensive queries. Authentication endpoints, search, and report generation deserve tighter limits than ordinary reads.
- **Validate everything, including structure.** Enforce types, ranges, lengths, and allowed values at the boundary, and reject unexpected fields rather than ignoring them.
- **Version and retire endpoints.** Old API versions left running are frequently the ones missing a control the current version has.

---

## Common Pitfalls

- **Validation on the client only.** Anything enforced in the browser can be bypassed by a tool that sends requests directly. Client-side validation is for user experience.
- **Blocklists instead of allowlists.** Filtering known-bad strings fails against encodings and variants the filter did not anticipate. Define what is allowed.
- **Sanitizing input instead of encoding output.** The same value is safe in one context and dangerous in another, so encoding belongs where the value is used, not where it arrives.
- **A WAF as the fix.** A web application firewall buys time against known patterns. It does not fix the flaw, and it cannot see application logic errors such as broken object-level authorization.
- **Security checks scattered across controllers.** Consistency comes from a shared layer. Scattered checks are what a new endpoint forgets.
- **Logging everything, including secrets.** Logs then become the sensitive data store nobody protected.
