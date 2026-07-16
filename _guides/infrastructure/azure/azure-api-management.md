---
title: "Azure API Management"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure API Management provides API gateway, developer portal, and lifecycle management capabilities, covering tier selection and its irreversible trade-offs, the policy pipeline, versioning, VNet integration, security, the AI gateway for LLM traffic, and the self-hosted gateway for hybrid deployments."
tags: [api-management, api-gateway, apim-policies, developer-portal, self-hosted-gateway, ai-gateway, practical]
---

## What Is Azure API Management

[Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts){:target="_blank" rel="noopener noreferrer"} (APIM) consists of four core components:

- **API Gateway:** The runtime that proxies API requests, applies policies (throttling, caching, transformation), enforces quotas, and routes calls to backend services
- **Management plane:** The administrative interface for defining APIs, configuring policies, managing users, and viewing analytics
- **Developer portal:** A built-in, customizable self-service website where developers discover APIs, read documentation, and obtain API keys
- **Analytics:** Monitoring built on Azure Monitor for usage, performance, and error insights

APIM supports REST, SOAP, GraphQL, OData, WebSocket, and gRPC APIs, and can expose REST APIs as MCP servers for AI agents. It acts as a facade over your backend services, letting you change implementations without affecting consumers.

Support is not uniform across tiers, and the gaps cluster in Consumption, which has no WebSocket, gRPC, or MCP support and no API analytics dashboard. Pass-through gRPC is classic-tier-only. Check the [gateway feature comparison](https://learn.microsoft.com/en-us/azure/api-management/api-management-gateways-overview#feature-comparison-managed-versus-self-hosted-gateways){:target="_blank" rel="noopener noreferrer"} before committing to a tier for a specific API type.

---

## Tiers

### Classic Tiers

| Tier | Pricing Model | SLA | VNet Injection | Developer Portal | Self-Hosted Gateway | Max Units |
|------|--------------|-----|--------------|-----------------|-------------------|-----------|
| **Consumption** | Pay-per-call (1M free/month) | Yes | No | No | No | Auto |
| **Developer** | Fixed monthly (lowest) | **None** | Yes (External + Internal) | Yes | Yes | 1 |
| **Basic** | Fixed monthly | Yes | No | Yes | No | 2 |
| **Standard** | Fixed monthly | Yes | No | Yes | No | 4 |
| **Premium** | Fixed monthly (highest) | Yes | Yes (External + Internal) | Yes | Yes | 12 per region |

Every tier except Developer carries an SLA, and deploying across availability zones or multiple regions raises the committed uptime. Microsoft publishes the exact percentages in the [SLA for Online Services](https://www.microsoft.com/licensing/docs/view/Service-Level-Agreements-SLA-for-Online-Services){:target="_blank" rel="noopener noreferrer"} document rather than in the product docs. Check there rather than trusting a number quoted secondhand, since the figures are revised.

"VNet injection" above means deploying the service itself into a subnet, which is not the only form of private connectivity. Basic and Standard support inbound private endpoints despite showing "No" for injection, so a "No" in that column does not mean the tier is stuck on the public internet.

**Consumption** is serverless with pay-per-call pricing. It shares infrastructure, has no developer portal, no VNet support, and no built-in cache. Best for low-traffic or variable-traffic APIs behind Azure Functions or Logic Apps.

**Developer** is for development and testing. It has no SLA and cannot scale beyond a single unit, but it provides all features including VNet integration and the self-hosted gateway.

**Premium** is the only tier supporting multi-region deployment, and that holds against the v2 tiers too, which do not offer it at all. It also supports full VNet injection (internal mode) and the self-hosted gateway in production.

### V2 Tiers

The [v2 tiers](https://learn.microsoft.com/en-us/azure/api-management/v2-service-tiers-overview){:target="_blank" rel="noopener noreferrer"} run on modernized infrastructure with faster provisioning (minutes vs 30-45 minutes for classic), faster scaling, and simplified networking.

| Tier | VNet Support | Developer Portal | Availability Zones | Max Units |
|------|--------------|-----------------|-------------------|-----------|
| **Basic v2** | No | Yes | No | 10 |
| **Standard v2** | Outbound VNet integration + inbound Private Endpoints | Yes | No | 10 |
| **Premium v2** | Full VNet injection + Private Endpoints | Yes | Yes | 30 |

All three v2 tiers are generally available, and all three carry an SLA, including Basic v2, which is otherwise the development-and-testing tier. Regional availability still lags the classic tiers, so confirm your region on the [v2 availability list](https://learn.microsoft.com/en-us/azure/api-management/api-management-region-availability){:target="_blank" rel="noopener noreferrer"} before designing around one.

**Standard v2** provides outbound-only VNet integration, so the gateway can reach private backends but always has a public IP for inbound. Combine with Private Endpoints for inbound private access. This gives you private backend connectivity at roughly one-quarter the unit cost of classic Premium.

**Premium v2** provides full VNet injection (both inbound and outbound isolation) without the route tables and service endpoints required by classic Premium. It supports availability zones, and its gateway runs on a dedicated App Service Environment rather than shared infrastructure.

In both cases the virtual network must be in the same region **and the same subscription** as the API Management instance. There is no cross-subscription option, which constrains estates that isolate networking into a separate connectivity subscription.

Workspaces, which let separate teams manage their own APIs within one instance, are available in all three v2 tiers and in classic Premium, so they aren't a Premium v2 exclusive. The tiers differ in how workspace traffic is routed. V2 tiers send it through the default managed gateway, while Premium tiers can give each workspace a dedicated workspace gateway for runtime isolation.

**V2 limitations.** The v2 tiers support most classic capabilities, but the gaps are substantial enough to check against your requirements before choosing one:

| Unavailable in v2 | Why it matters |
|---|---|
| Multi-region deployment | Premium (classic) is the only route to a multi-region gateway |
| Self-hosted gateway | Hybrid and multi-cloud scenarios still require Developer or Premium (classic) |
| Backup and restore | Configuration recovery falls to IaC or APIOps tooling instead |
| Git-based configuration | No Git sync of service configuration |
| Upgrade from a classic tier | There is no migration path, so moving to v2 means building a new instance |
| Resource move | The instance cannot be moved between resource groups or subscriptions |
| Static IP | Backends that allowlist the gateway by IP cannot do so |
| Azure DDoS Protection, Event Grid events, direct Management API access | Various operational and integration gaps |
| Free managed TLS certificate, cipher configuration, client certificate renegotiation | Bring your own certificate, and expect renegotiation-dependent mTLS flows to break |

Two classic features are *replaced* rather than dropped: legacy built-in analytics gives way to an Azure Monitor-based dashboard, and the capacity metric gives way to CPU and memory percentage metrics. Both replacements are also available in the classic tiers.

Because there is no classic-to-v2 migration, choosing a classic tier today is a commitment. Getting to v2 later means standing up a new instance and cutting traffic over. And because v2 tiers have no static IP, any backend that authorizes callers by source IP has to be re-plumbed around private endpoints or VNet integration instead. Those two constraints outlast the rest, since both shape decisions you cannot revisit cheaply.

### Gateway Runtime Limits

Tier choice also sets hard runtime ceilings on individual requests. These are easy to miss because they don't appear in feature comparisons, and the first one can disqualify a tier outright:

| Runtime limit | Classic | V2 | Consumption |
|---|---|---|---|
| **Total request duration** | Unlimited | **30 seconds** | **30 seconds** |
| Request payload size | Unlimited | 1 GiB | 1 GiB |
| Buffered payload size | 500 MiB | 2 MiB | 2 MiB |
| Policy document size | 512 KiB | 512 KiB | 16 KiB |
| Cached response size | 2 MiB | 2 MiB | 2 MiB |
| Concurrent backend connections per HTTP authority | 2,048 per unit (1,024 Developer) | 2,048 | Unlimited |
| Active WebSocket connections per unit | 5,000 | 5,000 | N/A |

The 30-second cap is absolute in the v2 and Consumption tiers. Any long-running synchronous operation like a slow report, a large export, or a chatty backend fails at the gateway no matter how healthy the backend is. No setting raises it. Either move to an asynchronous request-reply pattern or stay on a classic tier.

Calls turned away by a rate limit or quota policy still count toward rate limits, quotas, and billing, so a client hammering a throttled endpoint costs you anyway.

Every tier except Consumption exposes a gateway health check endpoint at `/status-0123456789abcdef`, which returns `200 OK` when the gateway itself is healthy. It tests only the gateway, not backends. Azure uses this same endpoint for its own SLA monitoring, which makes it the right target for your probes too.

### Choosing a Tier

The classic and v2 tables answer different halves of the same question. This tree walks the decision in the order that actually eliminates options, taking the hard blockers first, since each one forces a tier regardless of what else you wanted:

```
Non-production evaluation only?
├── Yes → Developer (no SLA, 1 unit, but every feature)
└── No
    │
    ├── Need multi-region gateways?
    │   └── Yes → Premium (classic). No other tier offers it.
    │
    ├── Need the self-hosted gateway (hybrid/multi-cloud/on-prem)?
    │   └── Yes → Premium (classic). Not in any v2 tier.
    │
    ├── Need a static gateway IP for backend allowlisting?
    │   └── Yes → a classic tier (v2 has no static IP)
    │
    ├── Requests can exceed 30 seconds, or payloads are large?
    │   └── Yes → a classic tier (v2 and Consumption cap at 30s)
    │
    └── None of the above → v2 tiers
        │
        ├── Need full inbound + outbound network isolation,
        │   or availability zones?
        │   └── Yes → Premium v2
        │
        ├── Need to reach private backends
        │   (public inbound acceptable)?
        │   └── Yes → Standard v2 (+ Private Endpoints if
        │              inbound must also be private)
        │
        ├── Traffic is low or highly variable, and you want
        │   no fixed monthly floor?
        │   └── Yes → Consumption (accept: no portal, no cache,
        │              no VNet, no WebSocket/gRPC/MCP)
        │
        └── Otherwise → Basic v2 (dev/test with an SLA)
                        or Standard v2 (general production)
```

---

## Core Concepts

**APIs** represent sets of operations mapping to a backend service. APIs can be imported from OpenAPI (Swagger) specs, WSDL files, Azure services like Functions and Logic Apps, or defined manually.

**Operations** are individual HTTP methods/paths within an API (e.g., `GET /users`, `POST /orders`). Each operation can have its own policies, schemas, and documentation.

**Products** are logical groupings of APIs offered to developers. Products can be **Open** (no subscription required) or **Protected** (subscription required). Products control visibility and access to APIs.

**Subscriptions** provide the primary mechanism for API consumers to access protected products. Each subscription contains a pair of keys (primary and secondary) for rotation. Subscriptions can be scoped to all APIs, a single API, or a product.

**Named values** are global key-value pairs usable across all policies, functioning as constants or configuration variables. Values can be plain text, secrets (encrypted at rest), or references to Azure Key Vault secrets. Referenced in policies as `{{named-value-name}}`.

**Backends** are named entities that abstract backend service URLs and configuration. Instead of hardcoding backend URLs in every policy, define a backend once and reference it. Backends support load balancing, circuit breaking, and authorization configuration.

---

## Policy System

### Policy Pipeline

[Policies](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-policies){:target="_blank" rel="noopener noreferrer"} are XML-based configuration running at four stages of request processing: **inbound** (when request is received), **backend** (before forwarding to backend), **outbound** (after receiving backend response), and **on-error** (when an error occurs in any stage).

Policies are applied at five scopes, from broadest to narrowest: **Global** (all APIs), **Workspace** (all APIs in a workspace), **Product**, **API**, and **Operation**. The `<base />` element controls inheritance, determining where parent-scope policies execute relative to the current scope's policies.

The pipeline runs along two dimensions at once, stages and scopes, and their interaction is where the surprises live:

```
                    ┌──────────────── on-error ───────────────┐
                    │  (any stage's failure jumps here,       │
                    │   skipping the rest of the pipeline)    │
                    └────────────────────┬────────────────────┘
                                         ▲
Client                                   │ error
  │                                      │
  ▼                                      │
┌─── INBOUND ───────────────────────┐    │
│  Global  → Workspace → Product    │────┤
│         → API → Operation         │    │
└───────────────┬───────────────────┘    │
                ▼                        │
┌─── BACKEND ───────────────────────┐    │
│  forward-request to backend       │────┤
└───────────────┬───────────────────┘    │
                ▼                        │
         [ Backend service ]             │
                │                        │
                ▼                        │
┌─── OUTBOUND ──────────────────────┐    │
│  Operation → API → Product        │────┘
│    → Workspace → Global           │
└───────────────┬───────────────────┘
                ▼
             Client

Outbound unwinds in reverse: the narrowest scope runs first.
```

Two consequences follow from that shape. Outbound policies execute in the opposite order from inbound ones, so a header set at Global scope on the way in is removed *last* on the way out, which catches people the first time a transformation lands in the wrong order. And because `on-error` catches from any stage, a policy failure at Operation scope skips every remaining inbound, backend, and outbound policy, including cleanup you assumed would always run.

Remove a scope's `<base />` and that scope silently stops inheriting. Only its own policies apply, and everything configured at Product and broader scopes is ignored. Microsoft ships a built-in Azure Policy definition (`API Management policies should inherit parent scope policies using <base/>`) to audit for exactly this, which is a fair signal of how often it bites.

### Common Policies

APIM ships more than 75 policies. These are the ones you reach for most.

**Access restriction:**
- `rate-limit` / `rate-limit-by-key`: Throttle calls per subscription or custom key (IP, JWT claim, custom expression)
- `quota` / `quota-by-key`: Enforce call count or bandwidth quotas over longer periods
- `ip-filter`: Allow or deny calls from specific IP addresses or CIDR ranges
- `validate-jwt`: Validate JWT tokens checking issuer, audience, claims, and expiration
- `validate-client-certificate`: Validate certificate issuer, subject, thumbprint, and revocation status declaratively

The `-by-key` variants are the ones you want for multi-tenant throttling, and neither they nor `llm-token-limit` are **available in the Consumption tier**. Consumption gives you `rate-limit` and `quota` scoped to subscriptions only, which is a thin story if you need to throttle by caller IP or tenant claim.

**Authentication:**
- `authentication-managed-identity`: Authenticate to backend using managed identity (eliminates credential management)
- `authentication-certificate`: Present client certificate to backend
- `authentication-basic`: Authenticate to backend using Basic auth

**Transformation:**
- `set-header`: Add, modify, or remove HTTP headers
- `set-body`: Set request or response body content
- `rewrite-uri`: Rewrite the request URL before forwarding
- `json-to-xml` / `xml-to-json`: Convert between formats
- `find-and-replace`: String replacement in the body

**Caching:**
- `cache-lookup` / `cache-store`: Built-in response caching (internal cache or external Redis)

**Other:**
- `mock-response`: Return mocked responses for development/testing
- `retry`: Retry on failure with configurable count and interval
- `send-request`: Make outbound HTTP calls within policy (for enrichment or validation)
- `cors`: Configure CORS headers
- `choose`: Conditional logic (if/when/otherwise)

### Policy Expressions

Policies support C# expressions for dynamic behavior. The `context` variable provides access to `Request`, `Response`, `User`, `Subscription`, `Product`, `Api`, `Operation`, and `LastError`.

Common expression patterns include rate limiting by caller IP (`context.Request.IpAddress`), extracting JWT claims for header injection, and conditional routing based on request attributes.

### The Product Scope Trap

Product-scope policies do not always run. If a request arrives with an API-scoped subscription key, an all-APIs subscription key, or the built-in all-access subscription key, APIM skips product-scope policies entirely.

This matters because the product scope is the obvious place to put a shared rate limit or quota across a bundle of APIs, and it will silently do nothing for any caller holding one of those key types. The policy is configured, the portal shows it, and it never executes. If a limit must hold regardless of how the caller subscribed, put it at API or Global scope instead.

---

## AI Gateway

APIM's [AI gateway capabilities](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities){:target="_blank" rel="noopener noreferrer"} extend the same gateway and policy engine to LLM and agent traffic, rather than being a separate product or SKU. The problem it solves is specific. Model providers meter capacity in tokens per minute, and once more than one application shares a model deployment, nothing stops one of them from consuming the entire quota.

**Token limits and quotas.** The `llm-token-limit` policy enforces a TPM limit or a longer-period token quota against any counter key such as subscription ID, caller IP, or a custom expression, so each consumer gets a share rather than racing for the whole allocation. It can precalculate prompt tokens and reject an oversized request at the gateway, before it costs anything at the backend.

**Token metrics.** `llm-emit-token-metric` emits per-consumer token consumption to Application Insights with custom dimensions, which is what makes chargeback by team or application possible at all.

**Semantic caching.** `llm-semantic-cache-lookup` and `llm-semantic-cache-store` compare a prompt's vector proximity to previous prompts and serve a cached completion when they're close enough, cutting both latency and token spend on repetitive prompts. It requires an external RediSearch-compatible cache such as Azure Managed Redis. The built-in cache will not do.

**Content safety.** `llm-content-safety` runs prompts through Azure AI Content Safety before they reach the model.

**Resilience.** The same backend load balancing (round-robin, weighted, priority-based, session-aware) and circuit breaking used for ordinary APIs apply to model endpoints. Priority-based routing earns its keep here. It sends traffic to Provisioned Throughput Units first and spills over to pay-as-you-go only once the PTU capacity saturates, so you exhaust the capacity you already paid for before renting more. The circuit breaker reads the backend's `Retry-After` header to set its trip duration rather than guessing.

**MCP and agents.** APIM can expose existing REST APIs as MCP servers, proxy existing MCP servers, and import A2A agent APIs, putting agent tool traffic behind the same auth, throttling, and logging as everything else.

These capabilities work in all tiers, with two gaps that follow the pattern set elsewhere: semantic caching is unavailable on the self-hosted gateway, and `llm-token-limit` is unavailable in Consumption.

---

## API Versioning and Revisioning

### Versions

[Versions](https://learn.microsoft.com/en-us/azure/api-management/api-management-versions){:target="_blank" rel="noopener noreferrer"} represent breaking changes and allow multiple API versions to coexist.

**Versioning schemes:**
- **Path-based:** `/api/v1/users`, `/api/v2/users`
- **Header-based:** Client sends `Api-Version: v2` header
- **Query string:** `/api/users?api-version=v2`

Each version is technically a separate API in APIM with its own operations, policies, and backend configuration, but logically grouped under a version set. Versions appear grouped in the developer portal.

### Revisions

[Revisions](https://learn.microsoft.com/en-us/azure/api-management/api-management-revisions){:target="_blank" rel="noopener noreferrer"} represent non-breaking changes and provide a safe staging mechanism:

1. Create a new revision (e.g., `rev2`)
2. Edit the revision: add operations, change policies, modify schemas
3. Test the revision using a special URL suffix (`/api/users;rev=2`)
4. When ready, make the revision "current" so all traffic routes to the updated version
5. Optionally add a change log entry visible in the developer portal

Making a revision current is an instant, atomic operation. Each API can have multiple revisions, with only one active at a time. Revisions combine with versions: each version has its own independent revision history.

---

## Developer Portal

The [developer portal](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-developer-portal){:target="_blank" rel="noopener noreferrer"} is a built-in website where API consumers discover APIs, read auto-generated documentation, try APIs via an interactive console, subscribe to products, and manage their API keys.

**Customization:** Visual drag-and-drop editor, custom branding (logo, colors, fonts, CSS), custom content pages, and the ability to self-host the portal source code for full control.

**Authentication options:** Username/password (built-in), Microsoft Entra ID (enterprise SSO), Entra External ID (B2C with social logins), and OAuth 2.0/OpenID Connect providers.

**Availability:** Every tier except Consumption. In the v2 tiers the portal is available but reports and custom HTML/custom widgets are not, so heavily customized portals are a reason to stay on classic.

---

## VNet Integration

### Classic Tiers (Developer and Premium)

Injection into a VNet comes in two modes, and they differ in the shape of the inbound path rather than in a list of attributes:

```
EXTERNAL MODE
                        ┌───────────── VNet ─────────────┐
  Internet ────────────▶│  ┌──────────┐                  │
  (clients reach the    │  │   APIM   │───▶ Private      │
   gateway directly)    │  │ gateway  │     backends     │
                        │  └──────────┘                  │
                        │   public IP + private IP       │
                        └────────────────────────────────┘
  Gateway and developer portal are internet-facing.


INTERNAL MODE
                        ┌───────────── VNet ─────────────┐
                        │                                │
  Internet ──▶┌───────┐ │  ┌──────────┐                  │
              │  App  │─┼─▶│   APIM   │───▶ Private      │
              │Gateway│ │  │ gateway  │     backends     │
              │ (WAF) │ │  └──────────┘                  │
              └───────┘ │   private IP only              │
                        └────────────────────────────────┘
  No public endpoint. Anything internet-facing must be
  fronted by something you place in front of it.
```

**External mode:** APIM is deployed inside a VNet subnet. The gateway and developer portal remain accessible from the public internet, and backend services can be private within the VNet. The gateway gets both public and private IPs.

**Internal mode:** APIM is deployed inside a VNet with no public endpoint. The gateway and developer portal are reachable only from within the VNet. Commonly paired with Application Gateway for public exposure with WAF protection, but see the mTLS caveat under Security before combining the two.

### V2 Tiers

Standard v2 offers outbound VNet integration plus inbound private endpoints; Premium v2 adds full injection, and neither needs the route tables or service endpoints classic Premium requires. The Tiers section covers both, along with the same-region and same-subscription constraint that applies to each.

---

## Security

**Subscription keys** are the primary authentication mechanism. Passed via `Ocp-Apim-Subscription-Key` header or as a query parameter. Each subscription has primary and secondary keys for rotation.

**OAuth 2.0 integration:** APIM does not validate OAuth tokens by default. Configure the `validate-jwt` policy to check issuer, audience, and required claims. Supports providers like Entra ID, Azure AD B2C, or any OIDC-compliant identity provider.

**Client certificates (mTLS):** Available in every tier. Validate incoming certificates with the `validate-client-certificate` policy, or with policy expressions against `context.Request.Certificate` for checks the policy doesn't cover. Certificates can be uploaded to APIM directly or referenced from Key Vault. Prefer Key Vault, since it rotates certificates into APIM automatically (within four hours) instead of leaving you to re-upload them.

Three constraints shape most mTLS deployments:

- **The gateway must be told to ask for a certificate.** Classic tiers enable **Negotiate client certificate** on the custom domain, while Consumption and v2 tiers enable **Request client certificate**. Without it, `context.Request.Certificate` is simply `null` and validation silently passes nothing. Negotiate is unavailable in Consumption, and certificate renegotiation is unsupported in the v2 tiers.
- **Consumption cannot validate self-signed certificates.** CA root certificates aren't supported there, so `Verify()` has nothing to chain to.
- **Application Gateway in front of APIM breaks mTLS.** App Gateway is a Layer 7 proxy, so it terminates the client's TLS connection and opens a new one to APIM, and the client's certificate never reaches the gateway. This conflicts directly with the standard internal-mode topology described above. The workaround is to have App Gateway pass the certificate through [mutual authentication server variables](https://learn.microsoft.com/en-us/azure/application-gateway/rewrite-http-headers-url#mutual-authentication-server-variables){:target="_blank" rel="noopener noreferrer"} in a header, but the certificate is then a header value your policies must trust rather than a TLS-verified identity.

**IP filtering:** The `ip-filter` policy allows or denies requests based on source IP or CIDR range at any scope.

**Managed Identity for backend calls:** Use `authentication-managed-identity` policy to obtain a token from Entra ID and forward it to the backend, eliminating credential management for backend-to-backend auth.

---

## Self-Hosted Gateway

The [self-hosted gateway](https://learn.microsoft.com/en-us/azure/api-management/self-hosted-gateway-overview){:target="_blank" rel="noopener noreferrer"} is a containerized version of the APIM gateway deployable anywhere containers run: on-premises, other clouds, edge locations, or IoT environments. All self-hosted gateways are managed from the cloud-based APIM instance.

The point of the product is that it splits the control plane from the data plane. Configuration and telemetry still flow to Azure, but API traffic never leaves the environment hosting the backends:

```
                 ┌─────────── Azure ────────────┐
                 │   APIM instance              │
                 │   ┌────────────────────┐     │
                 │   │  Management plane  │     │
                 │   │  Developer portal  │     │
                 │   └─────────┬──────────┘     │
                 └─────────────┼────────────────┘
                               │
              config (every 10s), heartbeat (every 60s),
              metrics/traces (outbound TCP/443 only)
                               │
    ┌──────────────────────────┼───── Your environment ────┐
    │                          ▼        (on-prem / AWS /    │
    │                 ┌─────────────────┐  GCP / edge)      │
    │  Clients ──────▶│  Self-hosted    │                   │
    │                 │    gateway      │                   │
    │                 │  (container)    │                   │
    │                 └────────┬────────┘                   │
    │                          │  API traffic stays local   │
    │                          ▼                            │
    │                  [ Local backends ]                   │
    └───────────────────────────────────────────────────────┘
```

That shape is what buys the latency, egress-cost, and data-residency wins: the solid line to the backend never crosses the Azure boundary, while management stays unified.

**When to use:**
- APIs and backends running on-premises alongside Azure
- Multi-cloud deployments across AWS, GCP, and Azure
- Low-latency requirements where the gateway should be close to backends
- Data sovereignty requirements keeping API traffic within specific boundaries

**Deployment options:** Docker containers, Kubernetes (Helm charts), or Azure Arc-enabled Kubernetes. Pin a specific version tag in production, since the rolling `v2` tag can leave you running different versions in parallel after a scaling action.

**Available on:** Developer (single node, for testing) and Premium (classic) only. It is **not** available in any v2 tier, which is one of the strongest reasons to stay on classic Premium.

**Limitations:**
- Requires outbound connectivity to Azure on TCP/443, minimally to the configuration endpoint (`<name>.configuration.azure-api.net`) and the instance's public IP.
- Rate limiting counts synchronize locally among nodes in a cluster, but not with the cloud gateway or other clusters. Each cluster enforces its own limit independently, so a limit of 100/minute across three clusters is actually 300/minute.
- Policies the self-hosted gateway doesn't support are **skipped silently** at execution rather than failing loudly. GraphQL resolvers and validation, `get-authorization-context`, LLM semantic caching, and credential manager all fall in this category, so a policy that secures traffic in the cloud may be a no-op here.
- No TLS session resumption, and no client certificate renegotiation, so mTLS clients must present certificates during the initial handshake.
- Resource logs don't reach Azure Monitor; use local metrics and logs, Application Insights, or the OpenTelemetry Collector instead.

---

## Comparison with AWS API Gateway

| Dimension | Azure APIM | AWS API Gateway |
|-----------|-----------|-----------------|
| **Service model** | Full API lifecycle platform (gateway + portal + analytics) | Primarily an API gateway |
| **Pricing** | Per-unit hourly; Consumption is pay-per-call, and Basic v2 / Standard v2 add per-call charges on top of the unit rate | Pay-per-request |
| **Developer portal** | Built-in, customizable | None (build your own) |
| **Policy system** | XML with C# expressions (75+ policies) | Limited VTL templates (REST API) |
| **API versioning** | Built-in versioning and revisioning | Manual (via stages) |
| **VNet/VPC support** | Full VNet injection (Premium tiers) | VPC Link to NLB/ALB |
| **Multi-region** | Built-in (Premium classic only) | Deploy per region + Route 53 |
| **Hybrid/multi-cloud** | Self-hosted gateway | No equivalent |
| **AI/LLM traffic** | AI gateway policies (token limits, semantic caching, content safety) | No equivalent built in |
| **Backend integration** | Any HTTP endpoint + Azure services | Lambda, HTTP, AWS services directly |
| **Cost for low traffic** | Fixed monthly minimum except in Consumption | No base cost; pay only for requests |
| **Cost for high traffic** | Predictable on classic tiers; v2 unit cost is predictable but call charges still scale | Can become expensive at scale |
| **Best for** | Enterprise API programs with lifecycle management | Serverless architectures, simple API proxying |

**Azure APIM differentiators:** Built-in developer portal, self-hosted gateway for hybrid deployments, richer policy system, built-in versioning/revisioning, SOAP/XML support, AI gateway capabilities for LLM and agent traffic, and a unified product covering all API types.

**AWS API Gateway differentiators:** True serverless pricing with no minimum, faster deployment (seconds), direct AWS service integrations without code (DynamoDB, S3, Step Functions), and lower cost for low-traffic APIs.

---

## Common Pitfalls

### Pitfall 1: Using Premium for VNet Access When Standard v2 Suffices

**Problem:** Deploying classic Premium just for backend VNet connectivity when Standard v2 provides outbound VNet integration.

**Result:** Roughly 4x the unit cost for capabilities that Standard v2 can deliver.

**Solution:** If you need the gateway to reach private backends but inbound internet access is acceptable, use Standard v2 with VNet integration. Add Private Endpoints if inbound private access is also needed. Reserve Premium for multi-region, internal-only mode, or self-hosted gateway requirements. Note that Standard v2 also bills per call on top of its unit rate, so the gap narrows at very high volume. Model both components rather than comparing unit prices alone.

---

### Pitfall 2: Not Configuring JWT Validation

**Problem:** Assuming APIM validates OAuth tokens automatically. APIM does not check tokens by default; subscription keys are the default auth mechanism.

**Result:** APIs accept any request with a valid subscription key, regardless of the caller's identity or authorization. OAuth tokens in the Authorization header are ignored.

**Solution:** Add `validate-jwt` policy to APIs that require OAuth authentication. Configure issuer, audience, and required claims. Use the policy in combination with subscription keys or as a replacement.

---

### Pitfall 3: Classic Tier Provisioning Time

**Problem:** Expecting fast deployment of classic tier instances. Classic tiers take 30-45 minutes to provision and 15-30 minutes to scale.

**Result:** Deployment pipelines time out, and scaling lags traffic spikes by 15-30 minutes, which is well past the point where the spike has already done its damage.

**Solution:** Use v2 tiers (provision in minutes, scale in minutes) for workloads that need fast deployment. For classic tiers, pre-provision capacity and plan for scale-out latency.

---

### Pitfall 4: Self-Hosted Gateway Losing Connectivity

**Problem:** Self-hosted gateways require outbound connectivity to Azure. Network changes or firewall rules may interrupt this connection.

**Result:** The gateway is designed to "fail static," so a *running* gateway keeps serving traffic from its in-memory configuration. The trap is what happens to a *stopped* one. Without local configuration backup enabled, a gateway that restarts during an outage cannot start at all, because it has no configuration to load and nowhere to fetch it from. In Kubernetes, where a pod eviction, node drain, or scaling action can restart a container at any moment, an Azure connectivity outage and a routine pod reschedule combine into a total outage of a gateway that was supposed to survive exactly this.

**Solution:** Enable configuration backup so gateways persist their last-known configuration to a volume and can cold-start from it. Monitor connectivity as a critical health signal, and allow outbound TCP/443 to the configuration endpoint and the instance's public IP. Remember that rate limits and any unsupported policies degrade independently of whether the gateway is up.

---

### Pitfall 5: Choosing a Tier You Cannot Move Off

**Problem:** Picking a classic tier for a feature you need today without registering that there is no upgrade path from classic to v2, or picking v2 for the fast provisioning without first checking whether you need multi-region, the self-hosted gateway, a static IP, or requests longer than 30 seconds.

**Result:** The tier is effectively permanent. Getting from classic to v2 means building a new instance, re-importing every API, and cutting traffic over by DNS. Going the other way is no better: v2 instances can't be moved between resource groups or subscriptions at all, so a v2 instance created in the wrong subscription stays there.

**Solution:** Treat tier selection as an architectural commitment rather than a setting. Walk the blockers before provisioning, since each one forecloses the other family, and confirm the v2 tiers are available in your target region, because regional coverage still trails the classic tiers.

---

## Key Takeaways

1. **APIM is a full API lifecycle platform, not just a gateway.** The developer portal, versioning/revisioning, and policy system differentiate it from simpler API gateways. Use these capabilities to build a developer-friendly API program.

2. **Start from v2 for new deployments, but confirm the blockers first.** V2 tiers provision in minutes rather than 30-45, scale faster, and simplify VNet integration, and Standard v2 with Private Endpoints covers a large share of production architectures at roughly one-quarter the unit cost of classic Premium. Four requirements still force classic: multi-region, the self-hosted gateway, a static gateway IP, and requests longer than 30 seconds.

3. **Tier choice is close to irreversible.** There is no upgrade path from a classic tier to v2, and v2 instances can't be moved between resource groups or subscriptions. Decide before provisioning, not after.

4. **The policy pipeline is APIM's most powerful feature.** Inbound, backend, outbound, and on-error stages enable sophisticated request transformation, security enforcement, caching, and error handling without modifying backend code. Outbound unwinds scopes in reverse, and dropping a `<base />` silently disinherits everything above it.

5. **Revisions provide safe, zero-downtime API updates.** Test changes on a non-current revision, then make it current atomically. Use versions for breaking changes that must coexist.

6. **APIM does not validate OAuth tokens by default.** You must explicitly configure the `validate-jwt` policy to enforce OAuth/OIDC authentication. Subscription keys are the default mechanism.

7. **The self-hosted gateway extends APIM to hybrid and multi-cloud environments.** It runs anywhere containers run, but requires Developer or Premium (classic), since no v2 tier offers it, plus connectivity to Azure for management. Enable configuration backup, or a restart during an outage leaves it unable to start.

8. **The AI gateway is the same gateway.** Token limits, semantic caching, content safety, and priority-based routing across model backends are policies on the existing engine rather than a separate product, which is what lets AI traffic inherit the auth, throttling, and observability you already built.

9. **Managed Identity authentication to backends eliminates credential management.** Use `authentication-managed-identity` policy to authenticate to Entra ID-protected backends without managing secrets or certificates.
