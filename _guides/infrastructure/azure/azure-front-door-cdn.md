---
title: "Azure Front Door & CDN"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "Comprehensive guide to Azure Front Door covering global load balancing, CDN, WAF integration, routing architecture, caching strategies, Private Link, custom domains, and comparisons with Traffic Manager and Application Gateway."
tags: [infrastructure, azure, networking, cdn, performance, scalability, security, practical]
---

## What Is Azure Front Door

[Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview){:target="_blank" rel="noopener noreferrer"} is a cloud-native CDN and global load balancer that accelerates delivery of web applications by routing traffic through Microsoft's global edge network. It operates at Layer 7 (HTTP/HTTPS) and provides content caching, SSL/TLS offload, URL-based routing, Web Application Firewall (WAF), and health-based failover across globally distributed origins.

Front Door is not region-scoped. It is a global resource, and its configuration is distributed to all edge locations worldwide. With 192+ edge locations across 109 metro cities, Front Door places your application's entry point close to users regardless of where the origin servers are hosted.

### What Problems Front Door Solves

**Without Front Door:**
- Users in distant geographies experience high latency to origin servers (200-500ms round-trip)
- No global failover mechanism for HTTP/HTTPS traffic
- DDoS and application-layer attacks hit origin servers directly
- No edge caching for static or semi-dynamic content
- SSL/TLS termination happens at the origin, adding latency

**With Front Door:**
- Anycast routing directs users to the nearest edge location for sub-millisecond DNS resolution
- Split TCP terminates connections at the edge and maintains persistent connections to origins, improving latency by up to 3x
- Built-in WAF with managed rule sets, bot protection, and rate limiting (Premium tier)
- Edge caching reduces origin load for static and cacheable content
- Free, auto-rotating managed TLS certificates for custom domains
- Health probes across all edge locations detect origin failures and reroute traffic automatically

### How Front Door Differs from AWS CloudFront

Architects familiar with AWS should note several important differences:

| Concept | AWS CloudFront | Azure Front Door |
|---------|---------------|-----------------|
| **Service model** | Pure CDN with optional Lambda@Edge compute | CDN + global load balancer + WAF in one service |
| **Edge compute** | Lambda@Edge and CloudFront Functions | Rule sets (no custom code execution at edge) |
| **Caching hierarchy** | 3-tier: Edge → Regional Edge Cache → Origin Shield | 2-tier: Edge POP → Origin |
| **Origin failover** | Origin groups with primary/secondary | Origin groups with priority, weight, and latency-based routing |
| **WAF** | Separate AWS WAF service, billed independently | Integrated WAF; managed rules included free with Premium tier |
| **Private origin connectivity** | Not natively supported (use VPC + ALB) | Private Link to origins (Premium tier) |
| **TLS certificates** | ACM (free, must be in us-east-1) | Azure-managed certificates (free, auto-rotating) or BYOC via Key Vault |
| **Pricing model** | Pay per request + data transfer, no base fee | Base fee + requests + data transfer; Premium roughly 10x Standard base fee |
| **Protocol** | HTTP/1.1 and HTTP/2 to viewers, HTTP/1.1 to origins | HTTP/2 to clients, HTTP/1.1 to origins |

---

## Standard vs Premium Tiers

Azure Front Door Standard and Premium replaced the older Azure Front Door (Classic) and Azure CDN from Microsoft (Classic) services. Both classic services are being retired. Front Door Classic retires on March 31, 2027 and CDN Classic retires on September 30, 2027.

### Feature Comparison

| Feature | Standard | Premium |
|---------|----------|---------|
| **Base fee** | Low fixed monthly | Roughly 10x Standard |
| **Static and dynamic content acceleration** | Yes | Yes |
| **Global load balancing** | Yes | Yes |
| **SSL offload with managed certificates** | Yes | Yes |
| **Custom domains** | First 100 free | First 100 free |
| **Rule sets (rules engine)** | Yes (all free) | Yes (all free) |
| **Custom WAF rules** | Yes (free) | Yes (free) |
| **Managed WAF rule sets (DRS/OWASP)** | No | Yes (free) |
| **Bot protection** | No | Yes (free) |
| **Private Link to origins** | No | Yes (free) |
| **Microsoft Threat Intelligence** | No | Yes |
| **Security analytics and reports** | Basic | Advanced |
| **Upgrade path** | Can upgrade to Premium (zero downtime) | Cannot downgrade to Standard |

Standard is appropriate for workloads that need CDN acceleration and basic WAF with custom rules. Premium is necessary when you need managed WAF rule sets like OWASP/DRS protection, bot management, or Private Link connectivity to origins that should not be publicly exposed.

### Pricing Model

Both tiers charge based on three components beyond the base fee:

- **Outbound data transfer (edge to client):** Varies by geographic zone and volume tier. Rates decrease at higher volumes.
- **Requests:** Charged per batch of HTTP/HTTPS requests. Premium rates are higher than Standard.
- **Outbound data transfer (edge to origin):** Lower rate than edge-to-client transfer, varies by zone.

Inbound data transfer to Front Door is free for both tiers. WAF rules, managed rules, bot protection, and Private Link are all included in the Premium tier's base fee with no additional per-feature charges.

---

## Routing Architecture

### Anycast and the Global Edge Network

Azure Front Door uses [anycast](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-traffic-acceleration){:target="_blank" rel="noopener noreferrer"} IP addresses announced via BGP from all edge locations simultaneously. When a client resolves the Front Door endpoint's DNS name, they receive an anycast IP address (with a TTL of 30-60 seconds). Internet routing protocols direct the TCP connection to the topologically nearest POP, minimizing network latency before the first byte of the HTTP request is even sent.

This means Front Door's entry point is always geographically close to the user, regardless of where origins are located. The 192+ edge locations span North America, Europe, Asia, South America, Africa, the Middle East, and Australia.

### Split TCP

[Split TCP](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-traffic-acceleration){:target="_blank" rel="noopener noreferrer"} is one of Front Door's most significant performance optimizations. Instead of the client establishing a TCP and TLS connection directly to a distant origin, Front Door splits the connection into two segments:

**Client to Edge POP:** The TCP handshake and TLS negotiation happen at the nearby edge location. This completes in a few milliseconds because the edge is geographically close.

**Edge POP to Origin:** Front Door maintains long-lived, persistent TCP connections from edge locations to origins over Microsoft's private backbone network. These connections are pre-warmed, multiplexed, and optimized. Multiple client connections can share a single backend connection.

The result is dramatically reduced latency, particularly for TLS-heavy workloads. A user in Tokyo connecting to an origin in US East no longer waits for three round trips across the Pacific (TCP SYN, TLS handshake, HTTP request). Instead, the TCP and TLS handshakes complete locally in Tokyo, and only the HTTP request traverses the backbone on a pre-established, optimized connection.

Split TCP also enables protocol conversion: Front Door can accept HTTP/2 connections from clients while communicating with origins over HTTP/1.1.

### Request Flow

1. Client resolves the Front Door endpoint DNS name and receives an anycast IP
2. BGP routing directs the connection to the nearest edge POP
3. The edge POP terminates TLS and processes the HTTP request
4. WAF rules evaluate the request (if a WAF policy is attached)
5. Rule sets execute match conditions and apply actions like rewrites, redirects, or header modifications
6. The route configuration determines which origin group should handle the request
7. If the response is cached and valid, the edge serves it directly
8. If the response is not cached, Front Door selects a healthy origin from the origin group based on routing method and forwards the request

---

## Origins and Origin Groups

### Origins

An [origin](https://learn.microsoft.com/en-us/azure/frontdoor/origin){:target="_blank" rel="noopener noreferrer"} is the backend application or service that Front Door forwards requests to. Origins can be any publicly accessible (or privately linked) endpoint:

- Azure App Service
- Azure Storage (Blob)
- Azure Application Gateway
- Azure API Management
- Azure Static Web App
- Any custom hostname (public IP or FQDN) including non-Azure origins
- Internal Load Balancer (via Private Link, Premium only)

Each origin is configured with a hostname, HTTP/HTTPS port, priority (1-5), and weight (1-1000).

### Origin Groups

An origin group is a logical collection of origins that serves the same application or content. Origin groups define how Front Door distributes traffic across origins and how it detects origin failures.

**Configuration options for an origin group:**

- **Health probe settings:** Protocol (HTTP/HTTPS), path, method (HEAD or GET), and interval
- **Load balancing settings:** Sample size, successful sample required, and latency sensitivity
- **Session affinity:** Enable or disable cookie-based session affinity

### Routing Methods

Front Door selects origins within an origin group using a combination of three routing dimensions evaluated in order:

**1. Priority (1-5):** Lower values mean higher priority. All priority-1 origins are considered first. Priority-2 origins are used only when all priority-1 origins are unhealthy. This enables active/standby failover patterns.

**2. Latency sensitivity:** Among origins at the same priority level, Front Door measures latency from each edge POP to each origin. Origins within the configured sensitivity range (in milliseconds) of the lowest-latency origin are eligible. For example, with a 30ms sensitivity: if origin A has 15ms latency and origin B has 40ms, only A is eligible. If origin C has 25ms, both A and C are eligible (C is within 30ms of A's 15ms).

**3. Weight (1-1000):** Among the latency-eligible origins, traffic is distributed proportionally by weight. An origin with weight 300 receives three times the traffic of an origin with weight 100.

### Health Probes

[Health probes](https://learn.microsoft.com/en-us/azure/frontdoor/health-probes){:target="_blank" rel="noopener noreferrer"} determine whether each origin is healthy and able to receive traffic. Probes originate from multiple Front Door edge locations independently, providing distributed health assessment that can detect regional network issues.

**Configuration options:**
- **Protocol:** HTTP or HTTPS
- **Method:** HEAD (recommended, lower overhead) or GET
- **Path:** The URL path to probe (e.g., `/health`)
- **Interval:** How frequently to probe, in seconds (default 30 seconds)

**Health evaluation:**
- **Sample size:** The number of recent probe results to consider when evaluating origin health
- **Successful sample required:** How many of the sample must be successful (HTTP 200) to consider the origin healthy

**Probe volume consideration:** At 30-second intervals with approximately 100 active POPs, each origin receives roughly 200 probe requests per minute. Using HEAD instead of GET reduces the bandwidth and compute overhead of these probes.

<div class="callout callout--tip">
<p class="callout__title">Health Probe Best Practice</p>
<p>Use HEAD method probes to reduce origin load. If your origin does not support HEAD, use GET with a lightweight health endpoint that validates backend dependencies (database connectivity, critical service availability) rather than simply returning 200 OK unconditionally.</p>
</div>

---

## Routes, Rule Sets, and Traffic Control

### Routes

A route maps incoming requests to an origin group based on the request's domain and URL path pattern. Each route defines:

- Which custom domains (or the default Front Door endpoint) the route applies to
- The URL path patterns to match (e.g., `/api/*`, `/images/*`, or `/*` for catch-all)
- Which origin group to forward matched requests to
- Whether caching is enabled and how query strings are handled
- Which rule sets to apply for additional processing

### Rule Sets

A [rule set](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine){:target="_blank" rel="noopener noreferrer"} is a collection of rules that process requests at the edge before they reach the origin. Each rule consists of up to 10 match conditions and up to 5 actions.

**Match conditions** are evaluated with AND logic (all must be true for the rule to fire). Available match conditions include:

- Request protocol (HTTP/HTTPS)
- Request method (GET, POST, etc.)
- URL path, filename, or extension
- Query string parameters
- Request headers (including cookies)
- Remote address (IP/CIDR)
- Socket address
- Server variable values (with regex support)

**Actions** define what Front Door does when all conditions match:

- **URL Redirect:** Return 301, 302, 307, or 308 redirects with configurable destination hostname, path, query string, and protocol
- **URL Rewrite:** Rewrite the request path before forwarding to the origin (the client URL does not change)
- **Modify Request Header:** Append, overwrite, or delete request headers before forwarding to origin
- **Modify Response Header:** Append, overwrite, or delete response headers before returning to client
- **Route Configuration Override:** Override the origin group or caching configuration for the matched request

**Processing order:**
1. WAF policy evaluates first
2. Route matching occurs
3. Rule sets execute in the order they are attached to the route
4. Rules within a rule set execute in order
5. If a rule sets "Stop evaluating remaining rules," no further rule sets execute

### URL Rewrite

URL rewrite changes the request path that Front Door sends to the origin without changing what the client sees. This is useful for migrating URL structures, mapping clean user-facing URLs to backend paths, or consolidating multiple backend services behind a single domain.

Front Door supports dynamic path segments with server variables like `{url_path:seg1}` to capture and reuse URL path components, and functions like `{url_path.tolower}` or `{url_path.toupper}` for case normalization.

### URL Redirect

URL redirect returns a redirect response to the client, instructing their browser to navigate to a different URL. Front Door supports 301 (permanent), 302 (found), 307 (temporary redirect), and 308 (permanent redirect, preserves method) status codes. You can modify the destination hostname, path, query string, protocol, and fragment independently.

### Session Affinity

Session affinity ensures that subsequent requests from the same client session are routed to the same origin. Front Door implements this using a cookie (with a SHA256 hash of the origin URL as the identifier). When enabled on an origin group, the first request is routed normally, and Front Door sets a cookie. Subsequent requests with that cookie are directed to the same origin.

Session affinity is useful for applications that maintain server-side session state, but it reduces the effectiveness of load balancing. Stateless application designs that externalize session state to a shared store like [Azure Cache for Redis](/study-guides/infrastructure/azure/azure-cache-redis.html) are preferable when possible.

---

## Caching

### How Caching Works

Front Door caches content at its edge POPs to reduce origin load and improve response times. When a request arrives at an edge POP, Front Door checks whether a valid cached response exists. If it does, the cached response is served directly. If not, Front Door forwards the request to the origin, caches the response (if cacheable), and returns it to the client.

Only GET requests are cacheable. POST, PUT, DELETE, and other methods are always proxied to the origin.

### Cache Key Composition

The cache key determines whether two requests can share the same cached response. Front Door's cache key is built from the request URL path plus the configured query string behavior.

**Four query string handling modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Ignore Query String** | All query string variations share one cache entry | Static assets where query strings are irrelevant (tracking params, cache busters) |
| **Use Query String** | Each unique query string combination is a separate cache entry (parameter order is normalized) | Dynamic content where query strings affect the response |
| **Ignore Specified Query Strings** | Exclude named parameters from the cache key | Ignore marketing parameters like `utm_source` while caching on meaningful parameters |
| **Include Specified Query Strings** | Only named parameters are included in the cache key | Cache on `id` or `version` while ignoring everything else |

### Cache Duration and TTL

Front Door determines how long to cache a response using the following priority order:

1. `Cache-Control: s-maxage=<seconds>` (if present)
2. `Cache-Control: max-age=<seconds>` (if s-maxage absent)
3. `Expires: <http-date>` (if no Cache-Control)
4. If no caching headers are present, Front Door randomly caches for 1-3 days

**Cache behavior options** (configurable per route or via rule set override):

- **Honor Origin:** Respect the origin's cache directives; default to 1-3 days if none are present
- **Override Always:** Ignore origin directives and use the specified cache duration (maximum 366 days)
- **Override If Origin Missing:** Use the specified duration only when the origin does not provide caching headers

Responses with `Cache-Control: private`, `no-cache`, or `no-store` are never cached, even when rules attempt to override caching behavior.

### Cache Behavior Headers

Front Door adds an `X-Cache` response header that indicates whether the response was served from cache:

| Header Value | Meaning |
|-------------|---------|
| `TCP_HIT` | Served from edge POP cache |
| `TCP_REMOTE_HIT` | Served from a remote Front Door cache node |
| `TCP_MISS` | Cache miss; fetched from origin |
| `PRIVATE_NOSTORE` | Origin response included `private` or `no-store` |
| `CONFIG_NOCACHE` | Caching is disabled in the route/profile configuration |
| `REVALIDATED_HIT` | Cached content was revalidated with origin before serving |

### Cache Purge

When cached content needs to be invalidated before its TTL expires, Front Door supports manual cache purging:

- **Single path:** Purge a specific URL like `/images/logo.png`
- **Wildcard:** Purge all content matching a pattern like `/images/*`
- **Root domain:** Purge everything with `/*`

Purges are case-insensitive and query-string agnostic (purging a URL purges all query string variations of that URL). Propagation takes up to 10 minutes across all edge locations.

For frequently updated content, use versioned filenames (e.g., `/styles.v2.css`) instead of relying on cache purging. Versioned filenames take effect immediately (new filename creates a new cache entry) and cost nothing.

### Large File Delivery

Front Door uses object chunking to optimize large file delivery. Files are retrieved from the origin in 8 MB chunks, with each chunk cached independently as it arrives. The next chunk is prefetched in parallel while the current chunk is being delivered to the client. The entire file does not need to reside in the Front Door cache before delivery begins.

For this to work efficiently, the origin must support byte-range requests (RFC 7233) and respond with HTTP 206 and a `Content-Range` header.

---

## Web Application Firewall (WAF)

### WAF Overview

[Azure WAF on Front Door](https://learn.microsoft.com/en-us/azure/web-application-firewall/afds/afds-overview){:target="_blank" rel="noopener noreferrer"} provides centralized, edge-based protection for web applications. WAF policies are attached to Front Door endpoints and evaluate every incoming request before it reaches the origin. Because WAF runs at the edge, malicious traffic is blocked before it consumes origin bandwidth or compute resources.

WAF policies can operate in two modes:

- **Detection mode:** Logs all rule matches without blocking. Use this to tune rules before enforcement.
- **Prevention mode:** Blocks requests that match rules and returns the configured error response.

### Custom Rules

Custom rules are available on both Standard and Premium tiers at no additional cost. They evaluate before managed rules and allow you to define application-specific security logic.

**Custom rule components:**
- **Match conditions:** IP address (RemoteAddr or SocketAddr), geographic location, request URI, query string, request body, request headers, request method
- **Actions:** Allow, Block, Log, or Redirect
- **Priority:** Lower numbers execute first (1-100)

**Common custom rule patterns:**

- **IP allowlist/blocklist:** Allow traffic only from known IP ranges or block specific malicious IPs
- **Geo-filtering:** Block or allow traffic from specific countries/regions based on the source IP's geographic location
- **Rate limiting:** Limit the number of requests from a single IP within a time window (1 minute or 5 minutes)
- **Request size limits:** Block requests with unusually large headers, query strings, or bodies

### Managed Rule Sets (Premium Only)

Premium tier includes [managed rule sets](https://learn.microsoft.com/en-us/azure/web-application-firewall/afds/waf-front-door-drs){:target="_blank" rel="noopener noreferrer"} at no additional per-rule charge. These are pre-configured rule collections maintained by Azure and updated regularly to address new attack signatures.

**Default Rule Set (DRS):** Based on the OWASP Core Rule Set (CRS), the DRS protects against common web attacks:

- SQL injection
- Cross-site scripting (XSS)
- Local file inclusion
- Remote code execution
- Protocol violations
- HTTP protocol anomalies
- Session fixation
- Scanner detection

The DRS also includes Microsoft Threat Intelligence Collection rules that leverage Microsoft's global threat intelligence to block known malicious IP addresses and domains.

You can tune managed rules by disabling specific rules, changing actions (from Block to Log), or defining exclusions for specific request fields that trigger false positives.

### Bot Protection (Premium Only)

The [bot protection rule set](https://learn.microsoft.com/en-us/azure/web-application-firewall/afds/waf-front-door-policy-configure-bot-protection){:target="_blank" rel="noopener noreferrer"} categorizes bots into three groups:

- **Good bots:** Search engine crawlers (Googlebot, Bingbot), monitoring services, and known legitimate automation. Default action: Allow.
- **Bad bots:** Known malicious bots, scrapers, and attack tools. Default action: Block.
- **Unknown bots:** Bots that don't match good or bad categories. Default action: configurable per your application's needs.

Bot classification uses Microsoft's threat intelligence data, which is continuously updated.

### Rate Limiting

[Rate limiting](https://learn.microsoft.com/en-us/azure/web-application-firewall/afds/waf-front-door-rate-limit){:target="_blank" rel="noopener noreferrer"} restricts the number of requests from a single source within a fixed time window. When the threshold is exceeded, all subsequent requests matching the rate limit rule are blocked for the remainder of the time window.

**Configuration:**
- **Threshold:** Maximum number of requests allowed
- **Time window:** 1 minute or 5 minutes
- **Group by:** Socket address (source IP seen by WAF) or client address (original client IP from X-Forwarded-For header)
- **Match conditions:** Rate limits can apply to all traffic or to requests matching specific conditions (URL paths, headers, geographic regions)

Rate limiting operates on a fixed-window model. If the threshold is 100 requests per minute and a client sends 100 requests in the first 10 seconds, they are blocked for the remaining 50 seconds of that minute.

---

## Front Door vs Traffic Manager vs Application Gateway

Azure provides multiple load balancing services, and understanding when to use each (and when to combine them) is critical for architects.

### Comparison Overview

| Characteristic | Front Door | Traffic Manager | Application Gateway |
|---------------|-----------|----------------|-------------------|
| **Scope** | Global | Global | Regional |
| **OSI Layer** | Layer 7 (HTTP/HTTPS) | DNS-level (returns IP addresses) | Layer 7 (HTTP/HTTPS) |
| **Protocols** | HTTP, HTTPS | Any (TCP, UDP, HTTP, etc.) | HTTP, HTTPS, WebSocket |
| **Connection handling** | Terminates and proxies connections | Does not proxy; DNS-based only | Terminates and proxies connections |
| **CDN/Caching** | Yes | No | No |
| **WAF** | Yes (integrated) | No | Yes (WAF v2) |
| **SSL offload** | Yes (at edge) | No | Yes (at regional gateway) |
| **Private Link to origins** | Yes (Premium) | No | No (but sits inside VNet) |
| **Non-HTTP traffic** | No | Yes | No |
| **Session affinity** | Cookie-based | No | Cookie-based |
| **URL-based routing** | Yes | No | Yes |
| **Health probes** | HTTP/HTTPS from edge POPs | HTTP/HTTPS/TCP from Azure | HTTP/HTTPS within region |
| **Failover speed** | Seconds (connection-based) | Minutes (DNS TTL-dependent) | Seconds (within region) |
| **Cost model** | Base fee + requests + data transfer | Per DNS query + health checks | Per gateway-hour + capacity units |

### When to Use Front Door

Front Door is the right choice when you need global HTTP/HTTPS load balancing with edge acceleration:

- Global web applications that serve users across multiple continents
- Applications that benefit from edge caching (static assets, semi-dynamic content)
- Workloads requiring WAF protection at the global edge
- Multi-region active-active or active-passive HTTP/HTTPS deployments
- Applications that need instant failover (not DNS-TTL-dependent)

### When to Use Traffic Manager

[Traffic Manager](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-overview){:target="_blank" rel="noopener noreferrer"} is appropriate for DNS-level routing of any protocol:

- Non-HTTP workloads like TCP-based database connections, UDP-based gaming, or custom protocols
- Scenarios where the client needs to connect directly to the origin (no proxy)
- Extremely simple global load balancing where CDN, WAF, and connection proxying are not needed
- Cost-sensitive workloads where the base fee of Front Door is not justified
- Hybrid routing across Azure, other clouds, and on-premises endpoints

Traffic Manager returns origin IP addresses via DNS, so clients connect directly to origins. This means Traffic Manager cannot provide caching, WAF, SSL offload, or URL-based routing. Failover speed is limited by DNS TTL (typically 30-300 seconds).

### When to Use Application Gateway

[Application Gateway](https://learn.microsoft.com/en-us/azure/application-gateway/overview){:target="_blank" rel="noopener noreferrer"} is the right choice for regional Layer 7 load balancing within a VNet:

- Single-region applications that need URL-based routing, SSL termination, and WAF
- Backend services that are only accessible within a VNet (private endpoints, VMs)
- Applications requiring regional session affinity and cookie-based routing
- Workloads that use WebSocket connections
- Microservices routing within a region (path-based routing to different backend pools)

### Common Combination Patterns

**Front Door + Application Gateway:** This is a common architecture for global applications with regional backends. Front Door provides global load balancing, CDN, and edge WAF. Application Gateway provides regional routing, VNet integration, and (optionally) a second WAF layer. Front Door routes to Application Gateway as its origin, and Application Gateway routes to backend services within the VNet.

**Front Door + Traffic Manager (rare):** In high-availability architectures, Traffic Manager can sit in front of multiple Front Door profiles for extreme redundancy. This is uncommon because Front Door itself is already globally distributed, but some organizations use this pattern for compliance or governance reasons.

<div class="callout callout--note">
<p class="callout__title">Architecture Decision</p>
<p>For most modern web applications with global users, start with Front Door. Add Application Gateway as a regional origin only if you need VNet-level routing or a regional WAF layer. Use Traffic Manager only when you need to route non-HTTP protocols or when clients must connect directly to origins.</p>
</div>

---

## Azure CDN: Legacy and Migration Path

### What Azure CDN Was

Azure CDN from Microsoft (Classic) was a standalone content delivery network service. It provided edge caching and content acceleration through Microsoft's POP network, similar to other CDN offerings. It focused purely on content delivery without the global load balancing, WAF, and advanced routing features that Front Door provides.

### Retirement and Migration

Azure CDN Standard from Microsoft (Classic) [will be retired on September 30, 2027](https://learn.microsoft.com/en-us/azure/cdn/classic-cdn-retirement-faq){:target="_blank" rel="noopener noreferrer"}. Starting August 15, 2025, CDN Classic no longer supports new domain onboarding or the creation of new profiles.

Microsoft's migration path is to move all CDN Classic workloads to Azure Front Door Standard or Premium. Front Door Standard provides equivalent (and superior) CDN functionality at competitive pricing, with the added benefit of global load balancing and rule sets.

**Migration considerations:**
- Front Door Standard and Premium offer significantly lower total cost of ownership than Classic for most workloads, despite having a base monthly fee
- Front Door eliminates separate charges for routing rules and provides free custom WAF rules
- Front Door's data transfer rates are lower per GB than CDN Classic
- Zero-downtime migration tooling is available in the Azure portal

### When Front Door Replaces CDN

For all new workloads, use Azure Front Door instead of Azure CDN. Front Door Standard provides everything CDN Classic offered (edge caching, content acceleration, custom domains, HTTPS) plus global load balancing, rule sets, and WAF custom rules. There is no scenario where CDN Classic is preferable to Front Door for new deployments.

---

## Private Link Integration (Premium Only)

### What Private Link Provides

[Private Link integration](https://learn.microsoft.com/en-us/azure/frontdoor/private-link){:target="_blank" rel="noopener noreferrer"} in Front Door Premium enables secure, private connectivity between Front Door and your origins. Instead of Front Door connecting to a publicly accessible origin over the internet, traffic flows over Microsoft's backbone network through a private endpoint directly into your origin's virtual network.

This means your origin does not need a public IP address or public DNS entry. The origin is completely private, accessible only through Front Door's managed private endpoint.

### How It Works

1. You configure a Private Link origin in Front Door Premium and specify the target resource (App Service, Storage, Internal Load Balancer, API Management, etc.)
2. Front Door creates a managed private endpoint on your behalf from its regional managed virtual network
3. A private endpoint connection request appears on the target resource, pending your approval
4. You approve the private endpoint connection (via Azure portal, CLI, or PowerShell)
5. Traffic from Front Door to the origin flows entirely over Microsoft's backbone network through the private endpoint

### Supported Origin Types

Private Link origins support several Azure services:

- Azure App Service (Web Apps)
- Azure Storage (Blob)
- Internal Load Balancer (for VMs, AKS, or any service behind an ILB)
- Azure API Management
- Azure Kubernetes Service (AKS)
- Azure Static Web Apps (limited support)

**Not supported:** App Service deployment slots.

### Architecture Implications

Private Link eliminates the need to expose origins to the public internet, which provides several benefits:

- **Zero-trust network model:** Origins accept traffic only from Front Door's private endpoint; no public attack surface
- **Simplified NSG rules:** No need to maintain allowlists for Front Door's IP ranges (which change over time)
- **Compliance:** Meets requirements for workloads that must not have public internet-facing endpoints

For origin redundancy, configure multiple Private Link-enabled origins within the same origin group. Front Door distributes traffic across them, and if one origin becomes unavailable, traffic automatically shifts to the remaining healthy origins.

<div class="callout callout--warning">
<p class="callout__title">Approval Required</p>
<p>Private endpoint connections require explicit approval on the origin resource. Front Door cannot send traffic to a Private Link origin until the connection is approved. Plan for this manual approval step in your deployment automation.</p>
</div>

---

## Custom Domains and TLS

### Custom Domain Configuration

Front Door provides a default endpoint hostname in the format `<name>.azurefd.net`. For production applications, you configure [custom domains](https://learn.microsoft.com/en-us/azure/frontdoor/domain){:target="_blank" rel="noopener noreferrer"} like `www.example.com` or `api.example.com`.

**Domain validation:** Front Door requires domain ownership validation before a custom domain can be associated. Validation is performed using a DNS TXT record that proves you control the domain.

**Domain types:**
- **Non-apex domains** (e.g., `www.example.com`): Point a CNAME record to your Front Door endpoint
- **Apex domains** (e.g., `example.com`): Use Azure DNS alias records or CNAME flattening to point the zone apex to Front Door

The first 100 custom domains per profile are included at no extra cost.

### TLS Certificate Options

Front Door supports two certificate management approaches:

**Azure-managed certificates (recommended):**
- Free, automatically provisioned and renewed
- No key management, no certificate signing requests, no manual uploads
- Auto-rotation happens without downtime or intervention
- Suitable for most workloads

**Customer-managed certificates (BYOC):**
- Stored in [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"}
- Front Door authenticates to Key Vault using a managed identity
- You control the certificate lifecycle (issuance, renewal, revocation)
- Required when you need specific certificate attributes (extended validation, specific CA, wildcards not supported by managed certs)

Switching from BYOC to managed certificates requires domain revalidation. Switching from managed to BYOC does not.

### TLS Protocol Support

Front Door supports TLS 1.2 and TLS 1.3 for client connections. All profiles created after September 2019 default to TLS 1.2 minimum, with TLS 1.3 negotiated when the client supports it. TLS 1.0 and 1.1 are no longer supported on new profiles as of March 2025.

For origin connections, Front Door negotiates the best TLS version the origin can accept, supporting TLS 1.2 and 1.3.

### End-to-End Encryption

[End-to-end TLS](https://learn.microsoft.com/en-us/azure/frontdoor/end-to-end-tls){:target="_blank" rel="noopener noreferrer"} ensures traffic is encrypted from the client through to the origin:

- **Client to Front Door:** TLS 1.2/1.3 using the custom domain certificate (managed or BYOC)
- **Front Door to Origin:** TLS 1.2/1.3 using the origin's certificate

For origins, Front Door validates the origin's TLS certificate by default. The origin certificate must be issued by a trusted CA and must match the origin hostname. Self-signed certificates are not supported unless certificate validation is explicitly disabled (not recommended for production).

### HTTP/2 Support

Front Door supports HTTP/2 for client connections by default. HTTP/2 is enabled automatically and cannot be disabled. Origin connections use HTTP/1.1.

---

## Common Pitfalls and How to Avoid Them

### 1. Not Configuring Query String Caching Appropriately

**Problem:** Using "Use Query String" mode when most query parameters are irrelevant to the response (marketing tracking parameters, random cache busters) creates thousands of separate cache entries for identical content.

**Impact:** Cache hit ratio drops significantly, increasing origin load and latency.

**Solution:** Use "Ignore Specified Query Strings" to exclude parameters like `utm_source`, `utm_medium`, `fbclid`, and `gclid` from the cache key. Alternatively, use "Include Specified Query Strings" to cache only on parameters that genuinely affect the response.

### 2. Caching Authenticated or Personalized Responses

**Problem:** Caching responses that contain user-specific data without including authentication context in the cache key can expose one user's data to another user.

**Impact:** This is a critical security vulnerability that can lead to data leakage and compliance violations.

**Solution:** Never cache authenticated endpoints without careful consideration. Set cache behavior to bypass caching for routes that serve personalized content. If caching per-user content is necessary, ensure the cache key includes the authentication context, though this dramatically reduces cache efficiency.

### 3. Ignoring Health Probe Volume

**Problem:** Setting aggressive health probe intervals (every 5 seconds) across 100+ POPs can generate substantial traffic to origins.

**Impact:** At a 5-second interval with 100 POPs, each origin receives approximately 1,200 probe requests per minute, which can be significant for lightweight origins or origins with per-request costs.

**Solution:** Use HEAD method probes to reduce bandwidth, set intervals appropriate to your failover requirements (30 seconds is often sufficient), and implement a lightweight `/health` endpoint that validates critical dependencies without performing expensive operations.

### 4. Using Front Door Without WAF

**Problem:** Deploying Front Door without a WAF policy leaves applications exposed to common web attacks (SQL injection, XSS, bot abuse) despite having a global edge infrastructure.

**Impact:** Attackers bypass the performance benefits of Front Door and directly exploit application vulnerabilities.

**Solution:** At minimum, enable a WAF policy with custom rules on Standard tier. For production workloads handling sensitive data, use Premium tier with managed rule sets (DRS) in Detection mode initially, then switch to Prevention mode after tuning.

### 5. Not Using Private Link When Origins Should Be Private

**Problem:** On Premium tier, configuring origins with public endpoints when they could use Private Link unnecessarily exposes the origin to the internet.

**Impact:** The origin must maintain public IP addresses, NSG rules allowing Front Door IP ranges, and defend against direct-access attacks that bypass Front Door.

**Solution:** Enable Private Link for all origins that support it. This eliminates the public attack surface and simplifies network security configuration.

### 6. Overlooking Rule Set Processing Order

**Problem:** Rule sets attached to a route execute in the order they are configured. If a rule early in the chain sets "Stop evaluating remaining rules," subsequent rule sets (including important security headers or caching overrides) never execute.

**Impact:** Missing security headers, incorrect caching behavior, or failed URL rewrites.

**Solution:** Carefully plan rule set ordering. Place security-related rules (header injection, redirects) before caching rules. Test rule set behavior in a staging environment before applying to production.

### 7. Relying on Cache Purge Instead of Versioned Filenames

**Problem:** Cache purges take up to 10 minutes to propagate across all edge locations. During that window, different users may receive different versions of the content depending on which POP they connect to.

**Impact:** Inconsistent user experience during deployments and no mechanism for instant rollback.

**Solution:** Use versioned filenames for static assets (`/styles.abc123.css`). Reserve cache purging for emergency situations or HTML entry points where versioning is not practical.

### 8. Misconfiguring Origin Response Headers for Caching

**Problem:** Origins that return `Cache-Control: no-store` or `Cache-Control: private` on cacheable content prevent Front Door from caching, even when rule set overrides are configured.

**Impact:** Every request goes to the origin, eliminating the performance and cost benefits of the CDN.

**Solution:** Review origin response headers. Front Door cannot override `private` or `no-store` directives. Ensure origins send appropriate cache headers (`Cache-Control: public, max-age=86400` for static assets). Use the "Override Always" cache behavior only when the origin incorrectly sends no caching headers or inappropriate TTL values.

---

## Key Takeaways

**Architecture and Performance:**
- Front Door provides global, Layer 7 load balancing with 192+ edge locations using anycast routing
- Split TCP and persistent backend connections improve latency by up to 3x for distant origins
- Only GET requests are cacheable; all other methods are proxied directly to the origin

**Tier Selection:**
- Standard suits workloads needing CDN acceleration and basic WAF with custom rules
- Premium (roughly 10x the Standard base fee) adds managed WAF rule sets (OWASP/DRS), bot protection, and Private Link at no per-feature charge
- Premium's Private Link enables zero-trust architectures where origins have no public internet exposure

**Routing and Traffic Control:**
- Origin groups support priority (active/standby), latency-based (performance), and weighted (proportional) routing
- Rule sets provide edge-based request processing with up to 10 match conditions and 5 actions per rule
- Session affinity uses cookies and should be avoided when stateless architecture is possible

**Caching Strategy:**
- Configure query string handling to avoid cache key bloat from irrelevant parameters
- Use "Honor Origin" cache behavior and ensure origins send correct `Cache-Control` headers
- Use versioned filenames for instant, free cache updates; reserve purging for emergencies

**Security:**
- Always attach a WAF policy, even on Standard tier (custom rules are free)
- On Premium, enable managed rule sets in Detection mode first, then switch to Prevention after tuning
- Rate limiting uses fixed-window enforcement with configurable thresholds per source IP

**When to Use Front Door vs Alternatives:**
- Use Front Door for global HTTP/HTTPS workloads with caching, WAF, and edge acceleration
- Use Traffic Manager for non-HTTP protocols or DNS-level routing without proxying
- Use Application Gateway for regional Layer 7 load balancing within a VNet
- Combine Front Door (global) with Application Gateway (regional) for global applications with VNet-integrated backends
