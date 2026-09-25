---
title: "SaaS API Documentation Strategy"
layout: guide
category: "Architecture"
subcategory: "Design"
description: "How a SaaS product documents its public API: keeping interactive explorers out of production, a developer portal deployed apart from the API, public and internal OpenAPI documents, a build-time spec pipeline with linting and breaking-change checks, and lifecycle communication."
tags: [openapi, developer-portal, api-design, documentation, saas, deprecation, practical]
---

## From Internal Tooling to Customer-Facing Documentation

Swagger UI is a useful development tool. It lets developers explore endpoints, inspect schemas, and send test requests while they build. The problem starts when that same tool shows up in production as the de facto customer documentation for a SaaS API. What helps an engineer debugging locally is not what a paying customer should see while integrating with your product.

A SaaS product with a public API has to treat its documentation as a product in its own right. That means separating internal API exploration from external documentation, building a pipeline that turns OpenAPI specs into a dedicated developer portal, and investing in the experience that gets customers to a working integration.

## Why Swagger UI Does Not Belong in Production SaaS

Swagger UI renders an OpenAPI specification as an interactive page. Every endpoint, parameter type, validation rule, and response schema in the spec appears on it. That transparency is what makes it risky in production.

When the API serves its full spec and an explorer to anyone who can reach them, it hands over a map of its entire surface. An attacker doesn't need to probe for endpoints. Parameter names, required and optional fields, enum values, error codes, and validation constraints are all listed. Endpoints meant only for internal use appear too, unless they were explicitly excluded from the document.

Putting the explorer behind authentication doesn't solve this. It still shows the full surface to every authenticated user, including trial accounts, compromised credentials, and employees who shouldn't see admin endpoints. Authentication protects the page, not the information on it.

It is also a poor customer experience. Swagger UI groups operations by tag, the labels a spec uses to categorize them, in whatever order the spec lists them. Beyond Markdown in the spec's description field it has no structure for getting-started guides, authentication walkthroughs, or pointers to which endpoints matter for common tasks, so developers have to work out the integration story themselves.

ASP.NET Core's own defaults already point this way. Since .NET 9 the `webapi` template generates the document with the built-in OpenAPI support, maps it only when the environment is Development, and ships no UI at all. An explorer that the API process itself serves, whether Swagger UI or an alternative such as [Scalar](https://scalar.com/){:target="_blank" rel="noopener noreferrer"}, belongs in development and staging. In production the spec is generated at build time, validated, and handed to a documentation site that renders only what customers should see. The same rendering tool can appear in both places. What changes is who serves it and which document it gets.

The rule relaxes for a small, trusted audience. A private API for a handful of partners, served from a public-only document, can reasonably expose a hosted explorer, because the audience is known and the document already excludes the internal surface.

## The Developer Portal Pattern

Companies like [Stripe](https://docs.stripe.com/api){:target="_blank" rel="noopener noreferrer"}, [Twilio](https://www.twilio.com/docs/usage/api){:target="_blank" rel="noopener noreferrer"}, and [GitHub](https://docs.github.com/en/rest){:target="_blank" rel="noopener noreferrer"} don't point customers at an API explorer. They run developer portals as the single entry point for everything an API consumer needs.

A developer portal is more than generated reference pages. It has its own features, roadmap, and success metrics, and it is where customers discover capabilities, authenticate, manage their integration, and troubleshoot. Done well, it cuts support tickets, shortens time to integration, and sets the product apart from competitors.

### What a Developer Portal Contains

Reference documentation (endpoints, parameter schemas, response types) is one layer. A complete portal usually adds:

- Authentication guides and API key management
- A sandbox or test environment
- Rate limit documentation
- A changelog and migration guides
- SDKs and client libraries
- A try-it console for sending requests without writing code

Each serves a different stage of the customer's journey, from evaluation through production and ongoing maintenance.

API key management needs particular care. Customers should create, rotate, and revoke keys without filing a support ticket, keep separate keys for development, staging, and production, and see usage per key. That self-service reduces the operational load on both sides.

### Deploying the Portal Apart from the API

The portal deploys, scales, and updates independently of the API, so a documentation release can't take down the API and an API release can't break the docs. That independence comes from separate deployments, and it works whether the portal lives on its own subdomain (`developer.yourproduct.com`) or on a path routed to a separate site (`yourproduct.com/docs`). A subdomain adds one thing a path can't: a separate browser origin, so the portal's cookies and content security policy are isolated from the product's.

The split also separates caching, CDN, and security configuration. Portal content is mostly static and caches aggressively at the CDN. The API needs different caching, different security headers, and different scaling. A typical setup builds the portal as a static site from the OpenAPI specs plus hand-written guides, serves it through a CDN, and lets it call the API only for interactive features such as the try-it console.

## Separating Public and Internal API Surfaces

A SaaS application with 200 endpoints might expose 80 publicly. Admin endpoints, health checks, debugging routes, feature-flag management, and service-to-service contracts have no place in customer documentation. Publishing them widens the attack surface and leaves customers unsure which endpoints are meant for them.

The separation starts at the specification. Rather than generating one document with everything in it and filtering afterward, maintain separate OpenAPI documents from the start. ASP.NET Core's built-in OpenAPI support does this with named documents and a group name on each endpoint. By default, an endpoint with no group name appears in every document, the public one included. The [API Versioning and OpenAPI guide's "Multiple OpenAPI Documents" section](/study-guides/dotnet/asp/aspnet-versioning-openapi.html) covers the implementation.

### Designing the Boundary

Deciding what goes in the public document means thinking from the customer's side rather than from the application's internal structure. Customers care about operations on their own data, authentication, webhook configuration, and usage and billing. They don't need health checks, internal metrics, background job triggers, or operations only your own team performs.

List every endpoint and ask whether a paying customer would ever call it. Endpoints that fail the test go in the internal document only. Some sit in a gray area, such as advanced configuration or power-user features, and may belong in an "advanced" section of the public documentation rather than hidden entirely.

### Keeping Documents Synchronized

Separate documents can drift. The public document might describe a response the API no longer returns, and generating the documents from code at build time removes that problem for every annotated endpoint.

The other drift runs the dangerous way. Because an unassigned endpoint lands in every document, a new internal endpoint that nobody assigned leaks into the public document rather than going missing. A code review question ("which document does this endpoint belong to?") catches most of these. A CI check catches the rest, either by failing the build on any endpoint without a group name or by comparing the public document's operations against an approved list.

## The OpenAPI Spec Pipeline

Serving the spec from the production API exposes the surface to anyone who finds the endpoint and ties documentation to the API's availability. Generating it during the build instead turns the spec into an artifact of that build, a frozen record of exactly what the build exposes. In ASP.NET Core, `Microsoft.Extensions.ApiDescription.Server` writes the documents during `dotnet build`, and the versioning and OpenAPI guide linked above covers the mechanics. From there, each document goes through two checks before the public one reaches the portal.

{% include figure.html id="des-spec-pipeline" %}

### Linting

A linter applies rules to the document. [Spectral](https://github.com/stoplightio/spectral){:target="_blank" rel="noopener noreferrer"} is a common choice. Its built-in OpenAPI ruleset checks, among other things, that operations have descriptions, that each declares a success response, and that security requirements name a defined scheme. Naming conventions, required error responses, and house style need custom rules or an add-on ruleset such as OWASP's. Run in CI, the linter fails a pull request that adds an endpoint without a description. It can only judge what is in the document, so an endpoint missing from the document is the synchronization check's job, not the linter's.

### Breaking-Change Detection

A diff compares the new document against the last published one. Anything that makes a previously valid request fail, or a previously handled response surprising, breaks customers: removing or renaming an endpoint or property, changing a type, tightening a constraint, and adding a new required field or parameter to a request. A spec-diff tool such as [oasdiff](https://github.com/oasdiff/oasdiff){:target="_blank" rel="noopener noreferrer"} detects these automatically, and the build then blocks the change or requires someone to acknowledge that the break is intentional. The conversation about a breaking change moves to pull request time, when the team can weigh the impact and plan communication, instead of starting when customers report failures.

### Keeping Published Specs

Storing each published spec in version control, or in a spec registry (a service that stores and versions API specifications), records how the API evolved. Each one corresponds to a release, so "what did the 2.3 API look like?" or "when did we add the batch endpoint?" has an answer without digging through the application's history.

## Choosing a Documentation Renderer

Many tools turn OpenAPI documents into documentation, and the product list changes faster than the reasons to pick one. The choice comes down to three shapes:

| Approach | What you get | What it costs |
| --- | --- | --- |
| **Open-source renderer, self-hosted** (Redoc, Scalar, and similar) | Reference pages you host anywhere, with full control of infrastructure and no licensing. Some include a try-it console and code samples; others, such as Redoc's open-source edition, render static reference only | Guides, changelogs, and analytics need separate solutions |
| **Hosted developer-hub platform** (a SaaS product that hosts reference pages, guides, and changelogs together) | Reference pages plus guides, changelogs, a try-it console, and analytics on which endpoints and pages customers use | Subscription cost that grows with usage, and lock-in to the platform's editing and hosting workflow |
| **Custom static site** | OpenAPI-generated fragments inside your own site generator, with any branding or UX you want | You own the documentation build and its maintenance |

A few questions decide between them. Does the team have the capacity to build and run its own documentation pipeline, or would a managed platform free it to work on the API? How much do analytics about documentation usage matter? Do customers need to try requests from the page, or is static reference enough? Is the audience thousands of public developers or a small partner ecosystem?

Early-stage products usually start with a self-hosted renderer for reference pages and hand-written guides on a static site, which costs little. A hosted platform earns its price once analytics and collaboration features matter more than the subscription. Because both consume the same OpenAPI documents, moving between them later changes the renderer, not the pipeline.

## Developer Experience as a Product

Reference documentation tells customers what the API can do. Developer experience decides whether they manage to do it, and the gap between a complete reference and a working integration is usually wider than teams expect.

### The Integration Journey

A new customer follows a predictable path, and each stage needs different documentation:

| Stage | What the customer needs from the portal |
| --- | --- |
| Evaluate | An overview of what the API does and the use cases it serves |
| First request | Authentication setup and a getting-started guide in their language |
| Main use case | Task-oriented guides and the reference pages for the endpoints involved |
| Errors and edge cases | An error reference and rate-limit documentation |
| Go to production | Sandbox differences, key management, and a changelog to watch |

Getting-started guides are among the highest-leverage investments. A guide that takes a customer from nothing to a working request in their own language, with copy-pasteable code, sharply cuts time to first request. Stripe's documentation is the usual benchmark, with language-specific snippets and step-by-step walkthroughs that make the first call easy.

### Code Samples and SDKs

Customers build in different stacks, so samples should cover at least the languages of your largest customer segments. Maintaining samples in several languages by hand is expensive, which is why many teams generate client SDKs from the OpenAPI documents with tools like [Kiota](https://learn.microsoft.com/en-us/openapi/kiota/){:target="_blank" rel="noopener noreferrer"} or [NSwag](https://github.com/RicoSuter/NSwag){:target="_blank" rel="noopener noreferrer"} and document the SDK rather than raw HTTP.

An official SDK removes much of the integration work. Customers call typed methods instead of building requests, attaching authentication headers, and parsing JSON. The SDK is also the natural home for retries, rate-limit handling, and error translation that every consumer would otherwise write for themselves.

### Error Documentation and Sandbox Environments

Error references are often neglected and matter most at the worst moment. When an integration breaks at 2 AM, the customer's first stop is the error response. A generic 400 with a vague message becomes a support ticket. An error code the portal documents, with its meaning, common causes, and fix, often doesn't.

A sandbox lets customers test without touching production data or incurring charges. Document how it differs from production, including rate limits, data persistence, and available features, because surprises during the move to production erode trust.

## API Lifecycle Communication

APIs change, and customers need to see the changes coming. Deprecating an endpoint, shipping a breaking change, and retiring a version all need clear communication through the portal. Done well, these transitions build trust. Done badly, they send customers to competitors.

### Versioned Documentation

When several API versions are live, the portal should document each one. A customer on v1 needs v1's signatures, schemas, and behavior, not v2's, and a version switcher lets them compare the two when planning a migration. If each version produces its own OpenAPI document, the pipeline renders each version's documentation from its own spec. Archive old versions rather than deleting them, so customers on a legacy version always have accurate reference material.

### Changelogs and Migration Guides

A changelog records what changed in each release: new endpoints, changed responses, deprecations, and fixes. Keep it in the portal next to the reference pages, not in a repository release page customers may never find. Each entry needs the date, the affected endpoints, the change, and any action the customer must take. The breaking-change diff from the pipeline is a good first draft of that list.

A migration guide covers the move between versions. For each breaking change it gives the reason, the new way to do the same thing, and before-and-after code. Customers doing the work of migrating deserve a path, not a diff of two spec files.

### One Deprecation Date Everywhere

A deprecation reaches customers through several channels at once. The OpenAPI document marks the operation `deprecated: true`, which renderers show on the reference page and which the breaking-change check can track. The API sends the `Deprecation` and `Sunset` response headers at run time, and in ASP.NET Core, Asp.Versioning's deprecation and sunset policies emit them for a whole API version. Their `Link` header points to the human-readable notice, which should be the portal's deprecation page. The changelog and email carry the same news to people who read neither headers nor reference pages.

The dates in all of these should come from one source, such as the versioning policy or a single configuration value, so the page never says June while the header says September. Announce early, repeat the date in every channel, and keep to it. Moving a sunset date after customers have planned around it destroys the trust the notice was meant to build.

## Red Flags

- **An API explorer in production behind "just auth."** It shows the full surface to every credential holder, including trial users and compromised accounts. Remove it from production and publish through the portal.
- **One OpenAPI document for everything, or unassigned endpoints.** Health checks, admin routes, and internal contracts leak into customer docs. Separate public and internal documents, and fail the build on endpoints with no group.
- **Hand-maintained specs.** Code and spec diverge a little with every release. Generate the documents from code in the build, and make the generation mandatory.
- **No linting or diffing in CI.** Undocumented operations and unnoticed breaking changes reach customers, where they cost the most to fix.
- **Only the current version documented.** Customers on an older version find current behavior described and assume their integration is wrong.
- **Documentation as a side job.** When nobody owns the portal, it improves only when customers complain. Teams with the best developer experience give it an owner, a roadmap, and metrics such as time to first request and support tickets deflected.
