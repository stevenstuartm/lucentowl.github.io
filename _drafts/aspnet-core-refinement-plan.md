# ASP.NET Core Study Guides Refinement Plan

Tracks the review-and-refine pass over all guides in `_guides/dotnet/asp/` and `_guides/dotnet/aspire/`. Guides are consumed sequentially, in the order they appear in `assets/data/study_guides_config.json` (the "ASP.NET Core" category) — that order already encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope; the config ordering handles that.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

Phase 0 (consolidation) ran and closed; the file set and config are final for Phase 1. Row 22 was recategorized into Architecture › Design but stays in this pass.

## Sources

- Primary: Microsoft Learn ASP.NET Core docs (`learn.microsoft.com/aspnet/core`, check the `?view=aspnetcore-10.0` pivot), the `dotnet/aspnetcore` repo and its release notes, Microsoft Learn .NET docs for runtime/hosting APIs, `aspire.dev` for Aspire (the old `learn.microsoft.com/dotnet/aspire` pages are superseded), Asp.Versioning GitHub wiki, grpc.io and the grpc-dotnet docs, the Polly / Microsoft.Extensions.Http.Resilience docs, Hangfire and Quartz.NET official docs, the OWASP API Security Top 10 (2023).
- Off-limits or unreliable: third-party blogs as the sole source for a version-specific claim; Medium posts; any doc fetched without confirming the version pivot.

## Domain notes

**Item 7 (hierarchy and scope clarity)** in this domain means the host → app → pipeline → endpoint containment: what is registered on the builder (`builder.Services`, app-wide), what is per-request (scoped services, `HttpContext`), what runs in the middleware pipeline (every request) versus the endpoint/filter layer (only matched endpoints, and MVC filters only for controllers). For Aspire: AppHost (dev-time orchestration, never deployed) versus ServiceDefaults (ships with every service) versus service projects.

**Item 9 (tag audit)**, measured across the 21 guides before the pass: `asp-net-core` 18, `performance` 8, `security` 5, `distributed-systems` 5, `testing` 3, `real-time` 3, `observability` 3, `dependency-injection` 3, `api-design` 3; everything else 1–2. Only 2 of 21 carry a skill-level tag. So for this category: drop `asp-net-core` and `dotnet` (restate the category), treat `performance`, `security`, and `distributed-systems` as filler unless the guide is about that concern, and add exactly one skill-level tag to every guide.

## Topic ownership map

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| `WebApplicationBuilder`/`WebApplication`, what `CreateBuilder` registers by default, slim/empty builders, Program.cs layout, environments | aspnet-core-fundamentals | Clause |
| DI lifetimes, captive dependencies, keyed services (general) | `dotnet/c-sharp/libraries/dependency-injection.md` (out of scope) | Fundamentals states only the web mapping (scoped = per request, `RequestServices`) and may link out |
| Configuration providers, options pattern, validation (general) | `dotnet/c-sharp/libraries/configuration-and-options.md` (out of scope) | Fundamentals states only the web defaults (`appsettings.{Env}.json`, `ASPNETCORE_` prefix, user secrets in Development) |
| Middleware pipeline mechanics, `Use`/`Run`/`Map`/`UseWhen`, ordering, custom middleware, short-circuiting | aspnet-middleware | Clause ("middleware runs in registration order") |
| Exception handling, `IExceptionHandler`, Problem Details | aspnet-middleware | Clause |
| Middleware vs filters decision | aspnet-middleware | Omit |
| Endpoint routing, templates, constraints, precedence, link generation, short-circuit routing, host matching | aspnet-routing | Clause; controller guide keeps only attribute-routing specifics (tokens, conventional vs attribute) |
| `MapGroup`, endpoint filters, `TypedResults`, parameter binding for minimal APIs | aspnet-minimal-apis | Clause |
| Choosing minimal APIs vs controllers, including performance | aspnet-minimal-apis | Omit |
| `[ApiController]` behaviors, model binding sources, custom binders, MVC filters, action return types | aspnet-controller-apis | Clause |
| Content negotiation, input/output formatters | aspnet-controller-apis (MVC-only feature) | Clause |
| Validation (data annotations, `IValidatableObject`, FluentValidation, .NET 10 minimal API validation) | aspnet-validation-data-handling | Clause |
| `System.Text.Json` options, converters, source generation | `dotnet/c-sharp/libraries/json-serialization.md` (out of scope) | The web-specific gotcha only (MVC `AddJsonOptions` vs minimal `ConfigureHttpJsonOptions`), in the minimal and controller guides |
| File uploads and downloads, multipart streaming, request body size limits, `IAsyncEnumerable` response streaming, response compression, request decompression | **New:** aspnet-large-payloads | Clause |
| API versioning mechanics (Asp.Versioning), OpenAPI generation, transformers, doc UIs, client generation, build-time spec extraction | aspnet-versioning-openapi | Clause |
| Versioning strategy trade-offs (URL vs header vs media type), REST resource design | `architecture/api-design-architecture.md` (out of scope) | Brief recap in versioning guide only where it drives the reader choice |
| gRPC protocol concepts (protobuf, HTTP/2, deadlines as a concept, load balancing) | `architecture/grpc-architecture-design.md` (out of scope) | Clause in the gRPC guide |
| SignalR hubs, groups, `IHubContext`, hub auth (query-string token), scaling (backplane, Azure SignalR Service), SSE, raw WebSockets | aspnet-signalr-realtime | Clause |
| IoT telemetry dashboard pipeline, throttling, dashboard patterns | signalr-iot-dashboards | — |
| Authentication schemes, JWT bearer, OIDC handler, Identity, API keys, certificate auth, authorization policies/handlers, resource-based authorization, fallback policy, 401 vs 403, token refresh | aspnet-auth | Clause |
| OAuth 2.0 / OIDC protocol flows, PKCE | `security/identity-access-management.md` (out of scope) | Clause in auth guide |
| HTTPS redirection, HSTS, CORS, antiforgery, security headers, mass assignment, Data Protection API, secrets management, OWASP API Top 10 mapping, IP allowlisting | aspnet-api-security | Clause |
| Injection concepts (SQL, command) | `security/application-security.md` (out of scope) | api-security keeps only the EF Core / `Process` specifics |
| Inbound rate limiting, request timeouts middleware, request cancellation (`RequestAborted`) | aspnet-rate-limiting-resilience | Clause |
| Outbound HTTP resilience (Polly pipelines, standard resilience handler, hedging) | `dotnet/c-sharp/libraries/httpclient-and-networking.md` (out of scope) | Clause |
| `WebApplicationFactory`, test service replacement, database test strategies, auth test handlers, snapshot tests, SignalR hub tests | aspnet-api-testing | Clause; gRPC guide keeps gRPC-specific test setup |
| Output caching, response caching, ETags / conditional requests | aspnet-caching-performance | Clause |
| `HybridCache`, `IMemoryCache`, `IDistributedCache` | `dotnet/c-sharp/libraries/caching-patterns.md` (out of scope) | Clause in caching guide |
| Async pitfalls (sync-over-async, `.Result`) | `dotnet/c-sharp/async/async-await-fundamentals.md` (out of scope) | Omit |
| Health checks (liveness/readiness/startup, publishers, background service health), OpenTelemetry setup in ASP.NET Core, HTTP logging middleware | aspnet-health-checks-diagnostics | Clause |
| Telemetry signal concepts, trace propagation | `observability/observability-fundamentals.md` (out of scope) | Clause |
| `ILogger` scopes, correlation | `dotnet/c-sharp/libraries/logging.md` (out of scope) | Clause |
| Kestrel configuration and limits, HTTP.sys, IIS in-process/out-of-process, reverse proxies and forwarded headers, containers, Native AOT for ASP.NET Core, graceful shutdown and drain | aspnet-hosting-deployment | Clause |
| Trimming, self-contained and framework-dependent deployment | `dotnet/c-sharp/foundations/compilation-and-runtime.md` (out of scope) | Clause |
| Hosted services, `BackgroundService`, scoped services in background work, queued work, worker services, Hangfire, Quartz.NET, hosted-service shutdown | aspnet-background-services | Clause |
| `PeriodicTimer`, timer choice | `dotnet/c-sharp/libraries/timers-and-scheduling.md` (out of scope) | Clause |
| `Channel<T>` mechanics | `dotnet/c-sharp/async/streaming-and-pipelines.md` (out of scope) | Clause |
| Aspire app model, AppHost, `WithReference`, ServiceDefaults, dashboard, hosting vs client integrations | aspire-fundamentals | Clause |
| Aspire service discovery details, communication patterns, testing, deployment and publishing | aspire-distributed-applications | Clause |
| SaaS developer portals, docs tooling, API lifecycle communication | api-documentation-strategy (moving to Architecture) | Clause |

## Domain gotchas

- **Aspire changed name, versioning, and docs home.** Aspire 9.5 was followed by Aspire 13 (Nov 2025), without the ".NET" prefix and with polyglot support; docs live on `aspire.dev`. Treat any `learn.microsoft.com/dotnet/aspire` claim as a lead to re-check there.
- **Learn lags the `dotnet/aspnetcore` source on mechanics.** Found so far: the native-AOT page lists `alpha` among the constraints `CreateSlimBuilder` drops (only `regex` is stubbed); the routing page's "URL matching phases" put constraints before the method check (the matcher runs method, host, and content-type policies first); the routing page says Trace for link-generation logs (they're all Debug). For defaults, ordering, and log levels, check the source on `release/10.0`; when the two disagree, the source wins.
- **Learn contradicts itself on where build-time OpenAPI documents land.** The aspnetcore-openapi page says "the app's output directory" but its own sample reads `obj/`. The targets set `OpenApiDocumentsDirectory` to `$(BaseIntermediateOutputPath)`, so `obj/` is correct.
- **Learn's environments page still shows `dotnet run -e Staging`.** Since SDK 9.0.200, `-e` sets an environment variable (`KEY=VALUE`), so that sample is stale. Don't copy it; see the `dotnet run -e` cross-guide fact.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Current versions.** .NET 10 is the current release (LTS); Learn docs already carry an `aspnetcore-11.0` pivot for the preview. Verify against the 10.0 pivot.
- **Middleware WebApplication inserts itself.** Developer exception page (Development) first, then `UseRouting`, then `UseAuthentication`/`UseAuthorization` when their services are registered and not called explicitly, then `UseEndpoints`. User middleware lands between routing and endpoints. CORS needs explicit auth calls after it. (Row 1 owns; others state in a clause.)
- **Native AOT compatibility (10.0 table).** Supported: gRPC, CORS, HealthChecks, HttpLogging, JWT auth, Localization, OutputCaching, RateLimiting, RequestDecompression, ResponseCaching, ResponseCompression, Rewrite, StaticFiles, WebSockets. Partial: Minimal APIs, SignalR. Not supported: MVC, Blazor Server, OData, other authentication, Session, SPA. App types with AOT support: minimal APIs, gRPC, worker services.
- **CreateSlimBuilder** keeps appsettings JSON, user secrets, console logging, and env/command-line config. It drops EventLog/Debug/EventSource logging, IIS integration, static web assets, HTTPS and HTTP/3 in Kestrel, and the `regex` route constraint, which is replaced by a stub that throws `InvalidOperationException` when the matcher is built; restore it with `RouteOptions.SetParameterPolicy<RegexInlineRouteConstraint>("regex")`. `alpha` is still registered (`RouteOptions.cs`, release/10.0), despite the Learn native-AOT page. **CreateEmptyBuilder** needs `UseKestrelCore()`.
- **Default URLs.** Kestrel with no endpoint configuration binds `http://localhost:5000` only. The official container images since .NET 8 use port 8080. Precedence: `Listen` in code, then `Kestrel:Endpoints`, then `urls`/`ASPNETCORE_URLS`/`--urls`; `HTTP_PORTS`/`HTTPS_PORTS` rank lowest. `urls` is read from app configuration, so an `appsettings.json` value beats `ASPNETCORE_URLS`.
- **Shutdown.** `HostOptions.ShutdownTimeout` defaults to 30 seconds (5 seconds before .NET 6). Sequence: ApplicationStopping, then the server stops accepting and drains while hosted services stop, then ApplicationStopped.
- **Scoped services in hosted services.** Microsoft's docs recommend injecting `IServiceScopeFactory` and creating a scope per unit of work (dotnet DI overview, "Scope scenarios"). This settles the row 1/row 17 contradiction: teach the scope factory as the standard pattern and `IDbContextFactory<T>` as an alternative for EF Core, not as a replacement mandate.
- **DI validation.** `ValidateScopes` and `ValidateOnBuild` are on by default in Development only, and can be enabled elsewhere with `UseDefaultServiceProvider`.
- **Authentication never rejects.** Authentication middleware only sets `HttpContext.User`; authorization challenges (401 for bearer, login redirect for cookies) or forbids (403). Learn states "Authentication doesn't short-circuit unauthenticated requests." (Row 2 owns ordering; row 12 owns schemes.)
- **Exception handling (.NET 8-10).** `IExceptionHandler` is registered as a singleton and handlers run in registration order until one returns `true`. Since .NET 10 a handled exception is not logged by the middleware (`SuppressDiagnosticsCallback`). The default Problem Details writer already adds `traceId`. The error-path form re-runs only the middleware after `UseExceptionHandler` and throws if the second pass yields a 404. (Row 2 owns.)
- **Routing selection (source, release/10.0).** The matcher filters by path, then method, host, and accepted content type (405/415 rejection endpoints), and only then checks constraints; the selector ranks by `Order`, then template precedence, then policy preferences. A 405 is suppressed when any candidate accepts all methods (fallbacks, `Map`, `MapShortCircuit`). `Order` is 0 for minimal APIs and attribute routes, 1, 2, 3… for conventional `MapControllerRoute` routes, `int.MaxValue` for fallback and short-circuit routes. `RequireHost` compares against the `Host` header, port included, so `RequireHost("*:8080")` is not a port restriction; use `Connection.LocalPort` or a non-public listener. (Row 3 owns.)
- **Minimal APIs vs controllers (row 4 owns).** Learn recommends minimal APIs for new projects. JSON options are split: `ConfigureHttpJsonOptions` (minimal APIs) and `AddControllers().AddJsonOptions` (MVC) configure different types and don't affect each other. Endpoint filters also run on controller actions via `MapControllers().AddEndpointFilter(...)`. OData 9.4+ supports minimal APIs (query options, results, `$metadata`, delta, batch) but not convention routing. Endpoint filters still run after a non-body binding failure (status already 400, handler skipped); `AddValidation` (.NET 10) inserts its filter outermost. Under Native AOT minimal APIs are "partial"; the Request Delegate Generator runs with `PublishAot`, trimming, or `EnableRequestDelegateGenerator`.
- **`MapStaticAssets` (.NET 9)** serves files as endpoints, so those requests pass through auth and custom middleware; `UseStaticFiles` short-circuits before them.
- **Controller specifics (row 5 owns).** `HttpResults` types returned from a controller write their own response: they skip formatters, content negotiation, and `[Produces]`, and serialize with the `ConfigureHttpJsonOptions` settings. `ControllerBase.ValidationProblem()` always builds a `400` through `ProblemDetailsFactory` and ignores a replaced `InvalidModelStateResponseFactory`. An `[ApiController]` action without an attribute route throws when endpoints are first built (lazily, usually on the first request), not at startup.
- **Validation (row 6 owns).** Controllers use MVC model validation; minimal APIs use `AddValidation` (`Microsoft.Extensions.Validation`, source-generated, calling assembly only, public types only, silent when metadata is missing), which doesn't apply to MVC. The minimal validation filter writes a full problem details body (`type`, `status`, `traceId`) only when `AddProblemDetails()` registers `IProblemDetailsService`; otherwise just `title` and `errors`. It skips `null` arguments. FluentValidation's `FluentValidation.AspNetCore` auto-validation is no longer supported (MVC-only, sync-only); teach explicit `IValidator<T>` calls.
- **Body size limits (row 7 owns).** Kestrel, IIS, and HTTP.sys default to 30,000,000 bytes; IIS request filtering rejects with 404.13. The server checks the limit when the body is read (Kestrel `OnReadStarting`), not on arrival: minimal APIs return 413, MVC form binding catches the `IOException` and yields a model-state 400, form limits (`InvalidDataException`) give 400, and `UseExceptionHandler` turns an escaped 413 into 500. Request decompression applies the same limit to decompressed bytes. `[RequestSizeLimit]` works on minimal APIs via routing metadata. Minimal form endpoints (`IFormFile`, `[FromForm]`) require antiforgery middleware or `.DisableAntiforgery()`.
- **`dotnet run -e`** sets an environment variable (`KEY=VALUE`) since SDK 9.0.200. Use `dotnet run -- --environment Staging` for the environment name.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** — re-verify before acting. Delete the entry once its row is complete. Phase 0 moved sections wholesale; the cuts listed here are the Phase 0 dispositions each row still has to carry out.

| Target row | Lead |
|---|---|
| 8 versioning-openapi | Resume here. Rewritten from scratch (old WithName/Swashbuckle/Kiota samples gone; build-time generation absorbed). Review round 1 done, findings NOT yet applied (all source-checked by the reviewer against a clone of dotnet/aspnet-api-versioning main and aspnetcore release/10.0; spot-check before editing). Errors: (a) `AssumeDefaultVersionWhenUnspecified` does not keep a client on v1 after v1 is retired: the request then gets 400/404. The real risk is breakage at removal, or a silent move to a newer version if `DefaultApiVersion` is raised. (b) Per-version documents are named from `GroupNameFormat`, which defaults to empty, giving `/openapi/1.0.json`; set `.AddApiExplorer(o => { o.GroupNameFormat = "'v'VVV"; o.SubstituteApiVersionInUrl = true; })`, and add `.AddMvc()` for controllers. Without `SubstituteApiVersionInUrl`, documents show `v{version}` as a path parameter. This also fixes the Kiota example path (`client.Api.V1.Orders[42]`) and the build-time file name (only a document named `v1` omits the `_{DocumentName}` suffix). (c) The version-location table puts the cache note on the wrong row: query strings are already part of the cache key, while header and media type need `Vary`. Trim the Consequence column to a pointer, since api-design-architecture owns the trade-offs. Soften: the Kiota "smaller/same shape across languages" claim is unsourced (use multi-language plus `--include-path`); NSwag gives one class per `OpenApiReference` because of its `ClassName` default; give Microsoft's reason for Development-only `MapOpenApi` (information disclosure); `OpenApiReference` comes from `Microsoft.Extensions.ApiDescription.Client` (the NSwag package depends on it); `dotnet openapi` is the separately installed `Microsoft.dotnet-openapi` tool. Missing: transformers in a versioned setup register through `.AddOpenApi(o => o.Document.AddDocumentTransformer(...))`; Sunset/Deprecation headers require `ReportApiVersions`; the per-endpoint replacement for `WithOpenApi` is `.AddOpenApiOperationTransformer(...)`; XML comments don't attach to lambdas, so use named methods; UIs with several documents need one `SwaggerEndpoint` each, or Scalar `AddDocument` per `app.DescribeApiVersions()`; transformer order is schema, then operation, then document; `Policies.Sunset("Orders", 1.0)` scopes a policy to the `NewVersionedApi` name; an action without `[MapToApiVersion]` serves all of the controller's versions; add "why not" for Asp.Versioning.OpenApi versus hand-registered documents. Foundation: "OpenAPI document" is used in the package table before it is defined; explain that the generator reads ApiExplorer descriptions (why `.AddApiExplorer()` is needed); gloss `ApiDescription`; introduce OpenAPI.NET before the transformer sample. Add inline external links for Asp.Versioning, Scalar, Swashbuckle, NSwag, and Kiota. Consider a figure for the deprecation timeline (supported, deprecated, sunset, removed, with headers) or for the endpoints-to-documents fan-in. Remove the duplicated AssumeDefault explanation. Then run review round 2 (the last one), apply it, and mark the row Complete. |
| 10 signalr-realtime | Moved-in `IHubContext` section uses IoT names; rewrite it to fit the guide's chat example. "Hubs are transient" and "Hub<T> unsupported under AOT" need checking. |
| 11 signalr-iot-dashboards | Cut the SignalR fundamentals, scaling, auth, and CORS sections to clauses (rows 10 and 13 own). Azure SignalR tier table (Premium row, message quotas) and "5,000 to 20,000 connections per VM" need sources. |
| 12 auth | Reduce the OAuth/OIDC protocol explanation to a clause (Security › IAM owns). Integrate moved-in certificate authentication. "Passkeys only in the Blazor template" needs checking for .NET 10 GA. |
| 13 api-security | Integrate moved-in HTTPS/HSTS and CORS; the transport section now covers HTTPS twice. Rate-limiting and body-size subsections become clauses (rows 14 and 7). Injection sections trim to EF Core / `Process` specifics. `Headers.Add` samples throw on duplicate keys; prefer `Append` or the indexer. |
| 14 rate-limiting-resilience | The Polly/outbound half (retry, circuit breaker, timeout, bulkhead, standard pipeline, hedging) cuts to a clause (C# HttpClient guide owns). Add request timeouts middleware (`AddRequestTimeouts`, .NET 8). Global limiter sample partitions by the Host header, which is not a client identity. |
| 15 api-testing | Remove the architecture-testing section (not ASP.NET-specific). `services.RemoveAll<DbContext>()` does not remove `DbContextOptions<T>`; the sample is likely wrong. Respawn sample uses an instance field in a static initializer. |
| 16 caching | Remove the async pitfalls and JSON source generation sections (C# guides own); HybridCache cuts to a clause (C# caching guide owns). Title is now "Output Caching and HTTP Caching"; description and tags must follow. "Output cache uses the same infrastructure as distributed caching" and "caches per Accept-Encoding automatically" need checking; the Redis output cache store is a separate package. |
| 17 background-services | Integrate the moved-in fundamentals section (duplicates the opener). Resolve the `IServiceScopeFactory` contradiction with row 1 (the guide teaches it, then its Red Flags reverses). Prefer `PeriodicTimer` over hand-rolled delay loops where the C# timers guide does. Since .NET 8, an unhandled `BackgroundService` exception stops the host by default (`BackgroundServiceExceptionBehavior.StopHost`), so "stops silently" is stale. |
| 18 health-checks | Integrate moved-in HTTP logging and background-service health sections. Telemetry-pillars and correlation-middleware sections cut to clauses (Observability and C# logging own). `MapPrometheusScrapingEndpoint` needs the prerelease exporter package; check status. |
| 19 hosting | Integrate fundamentals' Kestrel/HTTP.sys/proxy sections into the existing server sections (duplicates). "Kestrel built on libuv" is stale (sockets transport). Trimming/self-contained, environment configuration, and "Operational Best Practices" cut to clauses. Dockerfiles pin 8.0. |
| 20 aspire-fundamentals | Rename throughout to "Aspire" (Aspire 13); re-verify every API and template name against aspire.dev. The deployment-manifest subsection moved to row 21. |
| 21 aspire-distributed | Aspirate is superseded by built-in `aspire publish`/`aspire deploy`; re-verify the manifest and `azd` description. Backing-services catalogue shrinks to the pattern plus one example. Integrate the moved-in manifest subsection into the Deployment section. |
| 22 aspnet-api-documentation-strategy | Now an Architecture › Design guide; its inline links to the versioning guide are cross-category and may stay. The tooling landscape (Redoc, Stoplight, ReadMe, Scalar) fails the durable-substance test: keep the selection reasoning, drop the product catalogue. Its "Build-Time Extraction" section now duplicates row 8, which owns the mechanics (`Microsoft.Extensions.ApiDescription.Server`); cut it to a clause. Its inbound links to row 8's "Multiple OpenAPI Documents" section still resolve. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

*(Empty at the start.)*

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Fundamentals | aspnet-core-fundamentals.md | Complete |
| 2 | Fundamentals | aspnet-middleware.md | Complete |
| 3 | Fundamentals | aspnet-routing.md | Complete |
| 4 | Building APIs | aspnet-minimal-apis.md | Complete |
| 5 | Building APIs | aspnet-controller-apis.md | Complete |
| 6 | Building APIs | aspnet-validation-data-handling.md | Complete |
| 7 | Building APIs | aspnet-large-payloads.md | Complete |
| 8 | Building APIs | aspnet-versioning-openapi.md | In progress |
| 9 | Real-Time & RPC | aspnet-grpc.md | Not started |
| 10 | Real-Time & RPC | aspnet-signalr-realtime.md | Not started |
| 11 | Real-Time & RPC | signalr-iot-dashboards.md | Not started |
| 12 | Security & Resilience | aspnet-auth.md | Not started |
| 13 | Security & Resilience | aspnet-api-security.md | Not started |
| 14 | Security & Resilience | aspnet-rate-limiting-resilience.md | Not started |
| 15 | Testing & Operations | aspnet-api-testing.md | Not started |
| 16 | Testing & Operations | aspnet-caching-performance.md | Not started |
| 17 | Testing & Operations | aspnet-background-services.md | Not started |
| 18 | Testing & Operations | aspnet-health-checks-diagnostics.md | Not started |
| 19 | Testing & Operations | aspnet-hosting-deployment.md | Not started |
| 20 | Aspire | aspire-fundamentals.md | Not started |
| 21 | Aspire | aspire-distributed-applications.md | Not started |
| 22 | Architecture › Design | aspnet-api-documentation-strategy.md | Not started |
