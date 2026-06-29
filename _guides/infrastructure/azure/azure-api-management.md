---
title: "Azure API Management"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure API Management provides API gateway, developer portal, and lifecycle management capabilities, covering tiers, policies, versioning, VNet integration, security, and the self-hosted gateway for hybrid deployments."
tags: [infrastructure, azure, networking, security, architecture, scalability, practical]
---

## What Is Azure API Management

[Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts){:target="_blank" rel="noopener noreferrer"} (APIM) consists of four core components:

- **API Gateway:** The runtime that proxies API requests, applies policies (throttling, caching, transformation), enforces quotas, and routes calls to backend services
- **Management plane:** The administrative interface for defining APIs, configuring policies, managing users, and viewing analytics
- **Developer portal:** A built-in, customizable self-service website where developers discover APIs, read documentation, and obtain API keys
- **Analytics:** Built-in monitoring integrated with Azure Monitor for usage, performance, and error insights

APIM supports REST, SOAP, WebSocket, and GraphQL APIs. It acts as a facade over your backend services, letting you change implementations without affecting consumers.

---

## Tiers

### Classic Tiers

| Tier | Pricing Model | SLA | VNet Support | Developer Portal | Self-Hosted Gateway |
|------|--------------|-----|--------------|-----------------|-------------------|
| **Consumption** | Pay-per-call (1M free/month) | 99.95% | No | No | No |
| **Developer** | Fixed monthly (lowest) | No SLA | Yes (External + Internal) | Yes | Yes |
| **Basic** | Fixed monthly | 99.95% | No | No | No |
| **Standard** | Fixed monthly | 99.95% | No | Yes | No |
| **Premium** | Fixed monthly (highest) | 99.95% (99.99% multi-region) | Yes (External + Internal) | Yes | Yes |

**Consumption** is serverless with pay-per-call pricing. It shares infrastructure, has no developer portal, no VNet support, and no built-in cache. Best for low-traffic or variable-traffic APIs behind Azure Functions or Logic Apps.

**Developer** is for development and testing. It has no SLA and cannot scale beyond a single unit, but it provides all features including VNet integration and the self-hosted gateway.

**Premium** is the only classic tier supporting multi-region deployment, full VNet injection (internal mode), and the self-hosted gateway in production.

### V2 Tiers

The [v2 tiers](https://learn.microsoft.com/en-us/azure/api-management/v2-service-tiers-overview){:target="_blank" rel="noopener noreferrer"} run on modernized infrastructure with faster provisioning (minutes vs 30-45 minutes for classic), faster scaling, and simplified networking.

| Tier | VNet Support | Developer Portal | Self-Hosted Gateway |
|------|--------------|-----------------|-------------------|
| **Basic v2** | No | Yes | No |
| **Standard v2** | Outbound VNet integration + inbound Private Endpoints | Yes | No |
| **Premium v2** | Full VNet injection + Private Endpoints | Yes | Yes |

**Standard v2** provides outbound-only VNet integration: the gateway can reach private backends but always has a public IP for inbound. Combine with Private Endpoints for inbound private access. This gives you private backend connectivity at roughly one-quarter the cost of classic Premium.

**Premium v2** provides full VNet injection (both inbound and outbound isolation) without the route tables and service endpoints required by classic Premium. It supports availability zones and workspaces for multi-team management. GA in limited regions as of late 2025.

**V2 limitations:** No Git-based configuration, no backup/restore, and no legacy built-in analytics.

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

Policies are applied at four scopes in order of precedence, starting with Global (all APIs), then Product, API, and finally Operation (most specific). The `<base />` element controls inheritance, determining where parent-scope policies execute relative to the current scope's policies.

### Common Policies

**Access restriction:**
- `rate-limit` / `rate-limit-by-key`: Throttle calls per subscription or custom key (IP, JWT claim, custom expression)
- `quota` / `quota-by-key`: Enforce call count or bandwidth quotas over longer periods
- `ip-filter`: Allow or deny calls from specific IP addresses or CIDR ranges
- `validate-jwt`: Validate JWT tokens checking issuer, audience, claims, and expiration

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

**Availability:** Not available in Consumption and Basic (classic) tiers. Available in Developer, Standard, Premium, and all v2 tiers.

---

## VNet Integration

### Classic Tiers (Developer and Premium)

**External mode:** APIM deployed inside a VNet subnet. Gateway and developer portal accessible from the public internet. Backend services can be private within the VNet. The gateway gets both public and private IPs.

**Internal mode:** APIM deployed inside a VNet with no public endpoint. Gateway and developer portal accessible only from within the VNet. Commonly paired with Application Gateway for public exposure with WAF protection.

### V2 Tiers

**Standard v2:** Outbound-only VNet integration. The gateway can reach private backends but always has a public IP. Combine with Private Endpoints for inbound private access. No route tables or service endpoints required.

**Premium v2:** Full VNet injection (inbound and outbound isolation). Simplified compared to classic Premium (no route tables or service endpoints). Supports Private Endpoints alongside VNet injection.

---

## Security

**Subscription keys** are the primary authentication mechanism. Passed via `Ocp-Apim-Subscription-Key` header or as a query parameter. Each subscription has primary and secondary keys for rotation.

**OAuth 2.0 integration:** APIM does not validate OAuth tokens by default. Configure the `validate-jwt` policy to check issuer, audience, and required claims. Supports providers like Entra ID, Azure AD B2C, or any OIDC-compliant identity provider.

**Client certificates (mTLS):** Validate client certificates on incoming requests using policy expressions (check thumbprint, issuer, subject, expiration). Not available in the Consumption tier.

**IP filtering:** The `ip-filter` policy allows or denies requests based on source IP or CIDR range at any scope.

**Managed Identity for backend calls:** Use `authentication-managed-identity` policy to obtain a token from Entra ID and forward it to the backend, eliminating credential management for backend-to-backend auth.

---

## Self-Hosted Gateway

The [self-hosted gateway](https://learn.microsoft.com/en-us/azure/api-management/self-hosted-gateway-overview){:target="_blank" rel="noopener noreferrer"} is a containerized version of the APIM gateway deployable anywhere containers run: on-premises, other clouds, edge locations, or IoT environments. All self-hosted gateways are managed from the cloud-based APIM instance.

**When to use:**
- APIs and backends running on-premises alongside Azure
- Multi-cloud deployments across AWS, GCP, and Azure
- Low-latency requirements where the gateway should be close to backends
- Data sovereignty requirements keeping API traffic within specific boundaries

**Deployment options:** Docker containers, Kubernetes (Helm charts), or Azure Arc-enabled Kubernetes.

**Available on:** Developer (for testing), Premium (classic), and Premium v2.

**Limitations:** Requires outbound connectivity to Azure on port 443. When connectivity is lost, the gateway continues operating with last-known configuration but cannot receive updates. Rate limiting counts synchronize locally within a cluster but not with the cloud gateway or other clusters. Some cloud-configured policies are silently skipped.

---

## Comparison with AWS API Gateway

| Dimension | Azure APIM | AWS API Gateway |
|-----------|-----------|-----------------|
| **Service model** | Full API lifecycle platform (gateway + portal + analytics) | Primarily an API gateway |
| **Pricing** | Tier-based fixed monthly (except Consumption) | Pay-per-request |
| **Developer portal** | Built-in, customizable | None (build your own) |
| **Policy system** | XML with C# expressions (75+ policies) | Limited VTL templates (REST API) |
| **API versioning** | Built-in versioning and revisioning | Manual (via stages) |
| **VNet/VPC support** | Full VNet injection (Premium tiers) | VPC Link to NLB/ALB |
| **Multi-region** | Built-in (Premium) | Deploy per region + Route 53 |
| **Hybrid/multi-cloud** | Self-hosted gateway | No equivalent |
| **Backend integration** | Any HTTP endpoint + Azure services | Lambda, HTTP, AWS services directly |
| **Cost for low traffic** | Fixed monthly minimum even with zero traffic | No base cost; pay only for requests |
| **Cost for high traffic** | Predictable (fixed per unit) | Can become expensive at scale |
| **Best for** | Enterprise API programs with lifecycle management | Serverless architectures, simple API proxying |

**Azure APIM differentiators:** Built-in developer portal, self-hosted gateway for hybrid deployments, richer policy system, built-in versioning/revisioning, SOAP/XML support, and unified product covering all API types.

**AWS API Gateway differentiators:** True serverless pricing with no minimum, faster deployment (seconds), direct AWS service integrations without code (DynamoDB, S3, Step Functions), and lower cost for low-traffic APIs.

---

## Common Pitfalls

### Pitfall 1: Using Premium for VNet Access When Standard v2 Suffices

**Problem:** Deploying classic Premium just for backend VNet connectivity when Standard v2 provides outbound VNet integration.

**Result:** Roughly 4x cost for capabilities that Standard v2 can deliver.

**Solution:** If you need the gateway to reach private backends but inbound internet access is acceptable, use Standard v2 with VNet integration. Add Private Endpoints if inbound private access is also needed. Reserve Premium for multi-region, internal-only mode, or self-hosted gateway requirements.

---

### Pitfall 2: Not Configuring JWT Validation

**Problem:** Assuming APIM validates OAuth tokens automatically. APIM does not check tokens by default; subscription keys are the default auth mechanism.

**Result:** APIs accept any request with a valid subscription key, regardless of the caller's identity or authorization. OAuth tokens in the Authorization header are ignored.

**Solution:** Add `validate-jwt` policy to APIs that require OAuth authentication. Configure issuer, audience, and required claims. Use the policy in combination with subscription keys or as a replacement.

---

### Pitfall 3: Classic Tier Provisioning Time

**Problem:** Expecting fast deployment of classic tier instances. Classic tiers take 30-45 minutes to provision and 15-30 minutes to scale.

**Result:** Deployment pipelines time out, and scaling cannot respond to traffic spikes in real time.

**Solution:** Use v2 tiers (provision in minutes, scale in minutes) for workloads that need fast deployment. For classic tiers, pre-provision capacity and plan for scale-out latency.

---

### Pitfall 4: Self-Hosted Gateway Losing Connectivity

**Problem:** Self-hosted gateways require outbound connectivity to Azure. Network changes or firewall rules may interrupt this connection.

**Result:** The gateway continues operating with stale configuration but cannot receive policy updates, report telemetry, or sync rate limiting counters.

**Solution:** Monitor self-hosted gateway connectivity as a critical health signal. Ensure firewall rules allow outbound TCP/443 to Azure management endpoints. Plan for degraded operation during connectivity gaps.

---

## Key Takeaways

1. **APIM is a full API lifecycle platform, not just a gateway.** The developer portal, versioning/revisioning, and policy system differentiate it from simpler API gateways. Use these capabilities to build a developer-friendly API program.

2. **V2 tiers are the recommended choice for new deployments.** They provision in minutes (vs 30-45 minutes for classic), scale faster, and simplify VNet integration. Standard v2 provides backend VNet connectivity at roughly one-quarter the cost of classic Premium.

3. **The policy pipeline is APIM's most powerful feature.** Inbound, backend, outbound, and on-error stages enable sophisticated request transformation, security enforcement, caching, and error handling without modifying backend code.

4. **Revisions provide safe, zero-downtime API updates.** Test changes on a non-current revision, then make it current atomically. Use versions for breaking changes that must coexist.

5. **APIM does not validate OAuth tokens by default.** You must explicitly configure the `validate-jwt` policy to enforce OAuth/OIDC authentication. Subscription keys are the default mechanism.

6. **The self-hosted gateway extends APIM to hybrid and multi-cloud environments.** It runs anywhere containers run but requires Premium tier and continuous connectivity to Azure for management.

7. **Standard v2 with Private Endpoints is the sweet spot for many architectures.** Outbound VNet integration for private backends and inbound Private Endpoints for private access, at roughly one-quarter the cost of classic Premium.

8. **Managed Identity authentication to backends eliminates credential management.** Use `authentication-managed-identity` policy to authenticate to Entra ID-protected backends without managing secrets or certificates.
