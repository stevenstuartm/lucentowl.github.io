---
title: "Azure Front Door & CDN"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "Comprehensive guide to Azure Front Door covering global load balancing, CDN, WAF integration, routing architecture, caching strategies, Private Link, custom domains, and comparisons with Traffic Manager and Application Gateway."
tags: [front-door, cdn, waf, edge-caching, private-link, global-load-balancing, practical]
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
- Name resolution returns the IP of the POP best placed to serve the user, so the entry point is close to them regardless of origin location
- Split TCP terminates connections at the edge and maintains persistent connections to origins, converting long round trips into short ones
- Built-in WAF with managed rule sets, bot protection, and rate limiting (Premium tier)
- Edge caching reduces origin load for static and cacheable content
- Free managed TLS certificates for custom domains, auto-rotating for most domain configurations
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
| **Private origin connectivity** | VPC origins (ALB, NLB, EC2 in private subnets) | Private Link to origins (Premium tier) |
| **TLS certificates** | ACM (free, must be in us-east-1) | Azure-managed certificates (free) or BYOC via Key Vault |
| **Pricing model** | Pay per request + data transfer, no base fee | Base fee per profile + requests + data transfer; Premium roughly 10x Standard base fee |
| **Protocol** | HTTP/1.1, HTTP/2, and HTTP/3 to viewers | HTTP/1.1 and HTTP/2 to clients (no HTTP/3); HTTP/1.1 to origins, so no gRPC |

---

## Standard vs Premium Tiers

Azure Front Door Standard and Premium replaced the older Azure Front Door (Classic) and Azure CDN from Microsoft (Classic) services. Both classic tiers are on the way out, and the migration deadlines that matter have already passed:

| Milestone | Front Door (classic) | CDN from Microsoft (classic) |
|---|---|---|
| New profile creation stopped | April 1, 2025 | August 15, 2025 |
| New domain onboarding stopped | August 15, 2025 | August 15, 2025 |
| Managed certificates stopped being issued | August 15, 2025 | August 15, 2025 |
| Existing managed certificates expired | April 14, 2026 | April 14, 2026 |
| Full retirement | March 31, 2027 | September 30, 2027 |

The certificate dates are the operative ones. Both classic tiers stopped issuing Azure-managed certificates on August 15, 2025, and the last auto-renewed certificates expired on April 14, 2026. A classic profile still serving HTTPS on a managed certificate is not facing a future deadline. Its certificate is already dead, and the only remaining paths are Bring Your Own Certificate or migration to Standard/Premium. The 2027 dates only govern when the resources themselves stop existing.

Treat everything below as describing Standard and Premium. Classic is a migration target, not a design choice.

### Feature Comparison

| Feature | Standard | Premium |
|---------|----------|---------|
| **Base fee (per profile, per month)** | Low fixed monthly | Roughly 10x Standard |
| **Static and dynamic content acceleration** | Yes | Yes |
| **Global load balancing** | Yes | Yes |
| **SSL offload with managed certificates** | Yes | Yes |
| **Custom domains** | Free (no per-domain charge) | Free (no per-domain charge) |
| **Rule sets (rules engine)** | Yes (all free) | Yes (all free) |
| **Custom WAF rules** | Yes (free) | Yes (free) |
| **Managed WAF rule sets (DRS/OWASP)** | No | Yes (free) |
| **Bot protection** | No | Yes (free) |
| **Private Link to origins** | No | Yes (free) |
| **Security analytics and reports** | Basic | Advanced |
| **Upgrade path** | Can upgrade to Premium (zero downtime) | Cannot downgrade to Standard |

Standard is appropriate for workloads that need CDN acceleration and basic WAF with custom rules. Premium is necessary when you need managed WAF rule sets like OWASP/DRS protection, bot management, or Private Link connectivity to origins that should not be publicly exposed.

### Pricing Model

Both tiers charge based on three components beyond the base fee:

- **Outbound data transfer (edge to client):** Varies by geographic zone and volume tier. Rates decrease at higher volumes.
- **Requests:** Charged per batch of HTTP/HTTPS requests. Premium rates are higher than Standard.
- **Outbound data transfer (edge to origin):** Lower rate than edge-to-client transfer, varies by zone.

Inbound data transfer to Front Door is free for both tiers, as is data transfer from an origin hosted in an Azure data center to the Front Door edge. WAF rules, managed rules, bot protection, and Private Link are all included in the Premium tier's base fee with no additional per-feature charges, and there is no per-domain charge for custom domains on either tier.

**The base fee is charged per profile, not per subscription or per tenant.** Microsoft's illustrative figures put Standard at roughly $35/month and Premium at roughly $330/month per profile. That per-profile framing is the detail that decides real bills: an estate that spun up one classic profile per microservice pays the base fee once per profile after migrating, which is why consolidating many profiles into fewer profiles with multiple endpoints is usually the first cost lever. The base fee accrues whenever the profile exists. Front Door resources can't be disabled, only deleted, so an idle profile still bills.

---

## Routing Architecture

### Unicast POP Selection and the Global Edge Network

Front Door historically used anycast: a single IP announced via BGP from every edge location at once, letting internet routing carry each client to the topologically nearest POP. **That is no longer how Standard and Premium work.** Microsoft moved Front Door from anycast to [unicast](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-traffic-acceleration){:target="_blank" rel="noopener noreferrer"} for both DNS and HTTP through March–April 2026, and unicast now covers the entire Front Door infrastructure.

Under unicast, POP selection is a DNS decision rather than a BGP one:

1. The client resolves the domain, and the lookup lands on Front Door's internal Azure Traffic Manager endpoint.
2. That Traffic Manager profile consumes health and availability signals from every Front Door POP worldwide.
3. It picks the optimal POP and returns **that POP's unicast IP**.
4. The client connects directly to the returned IP.

The distinction is easy to dismiss as trivia, but it changes what you are reasoning about when traffic goes to an unexpected POP. Under anycast, POP choice was a function of internet routing, and the answer to "why did this user land there" lived in BGP paths you don't control or see. Under unicast, POP choice is an explicit decision Microsoft's Traffic Manager makes from health and availability telemetry, and it rides on DNS, so it inherits DNS's behavior, including resolver caching and the fact that Front Door sees the resolver's location rather than the client's. It also means Front Door has a hard dependency on Traffic Manager for name resolution, so weigh that before putting Traffic Manager in front of Front Door for "redundancy."

Front Door organizes POPs into **rings**. The outer ring holds locations closest to users and is the preferred target for all traffic. The inner ring absorbs failover and overflow from the outer ring. Each domain gets primary and fallback VIPs announced from both rings, so an unhealthy preferred POP moves traffic to the next optimal one without your involvement.

Front Door currently has 192 edge locations across 109 metro cities (a metro can hold more than one POP), spanning North America, Europe, Asia, South America, Africa, the Middle East, and Australia. Microsoft updates this list regularly, and it's queryable through the Resource Manager API if you need the current set programmatically.

<div class="callout callout--note">
<p class="callout__title">Watch for Stale Anycast Guidance</p>
<p>Much third-party writing about Front Door describes the anycast model, as does Microsoft's own Front Door (classic) documentation, which is still published. When you read that Front Door "announces anycast IPs via BGP," you're reading about classic or about Standard/Premium before the 2026 switch. Verify against the Standard/Premium pivot of the docs rather than the classic one.</p>
</div>

### Split TCP

[Split TCP](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-traffic-acceleration){:target="_blank" rel="noopener noreferrer"} is one of Front Door's most significant performance optimizations. Instead of the client establishing a TCP and TLS connection directly to a distant origin, Front Door splits the connection into two segments:

**Client to Edge POP:** The TCP handshake and TLS negotiation happen at the nearby edge location. This completes in a few milliseconds because the edge is geographically close.

**Edge POP to Origin:** Front Door maintains long-lived, persistent TCP connections from edge locations to origins over Microsoft's private backbone network. These connections are pre-warmed, multiplexed, and optimized. Multiple client connections can share a single backend connection.

Establishing a TCP connection takes three to five round trips. Split TCP doesn't reduce that count. It makes those round trips *short* ones. A user in Tokyo connecting to an origin in US East completes the handshakes against a POP in Tokyo instead of across the Pacific, and only the HTTP request traverses the backbone on a connection that was pre-established and is reused across other users' requests. The effect compounds for TLS, because securing a connection adds more round trips on top of the TCP handshake, and every one of them shrinks.

This is why the benefit is largest exactly where you'd expect: distant origins, TLS-heavy workloads, and short-lived connections that pay handshake costs repeatedly. It is smallest for a client already near its origin on a long-lived connection.

Split TCP also enables protocol conversion: Front Door can accept HTTP/2 connections from clients while communicating with origins over HTTP/1.1.

### Request Flow

```
                    ┌──────────────────────────────┐
   1. DNS lookup    │  Front Door Traffic Manager  │
   ───────────────► │  (consumes POP health from   │
                    │   every POP worldwide)       │
                    └──────────────┬───────────────┘
                       2. returns unicast IP
                          of optimal POP
                                   │
                                   ▼
  ┌────────┐   3. direct connect   ┌───────────────────────────┐
  │ Client │ ────────────────────► │   Selected Front Door POP │
  └────────┘   short RTT: TCP +    │                           │
               TLS terminate here  │  4. Match profile (Host)  │
                                   │  5. TLS handshake         │
                                   │  6. WAF rules             │
                                   │  7. Match route           │
                                   │  8. Rule sets (in order)  │
                                   │  9. Cache lookup ─────────┼──► hit: serve
                                   │ 10. Select origin         │    from edge
                                   └─────────────┬─────────────┘
                                                 │ miss
                          long RTT, pre-established, reused,
                          over Microsoft backbone (HTTP/1.1)
                                                 ▼
                                          ┌────────────┐
                                          │   Origin   │
                                          └────────────┘
```

The ordering matters in two places people get wrong. **WAF runs before route matching**, so a blocked request never reaches your routing logic at all. And **route matching happens before rule sets**, not after. Rule sets are attached to routes, so Front Door must resolve the route first, and only then run that route's rule sets in the order they're configured. A rule set can still override the origin group the route selected, or return a redirect instead of forwarding to any origin.

---

## Origins and Origin Groups

### Origins

An [origin](https://learn.microsoft.com/en-us/azure/frontdoor/origin){:target="_blank" rel="noopener noreferrer"} is the backend application or service that Front Door forwards requests to. Origins can be any publicly accessible (or privately linked) endpoint:

- Azure App Service
- Azure Storage (Blob, static websites)
- Azure Application Gateway
- Azure API Management
- Azure Static Web App
- Azure Container Apps, Container Instances, and Spring Apps
- Public IP address
- Any custom hostname (public IP or FQDN) including non-Azure origins
- Internal Load Balancer (via Private Link, Premium only)

Each origin is configured with a hostname, HTTP/HTTPS port, priority (1-5), and weight (1-1000, default 50).

Origins must be publicly resolvable unless you use Private Link on Premium. You can mix origins from different regions, different clouds, and outside Azure in one origin group, as long as each is reachable.

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

<div class="callout callout--warning">
<p class="callout__title">Latency Sensitivity Defaults to 0 ms, Which Silently Disables Your Weights</p>
<p>The default latency sensitivity is <strong>0 ms</strong>, meaning only the single fastest origin is ever eligible. Because weight is applied <em>after</em> the latency filter, weights then take effect only when two origins measure identical latency, which effectively never happens across regions. Configure a 50/50 weighted split for a blue-green rollout and leave sensitivity at its default, and you will not get 50/50: you will get all traffic on whichever origin the POP measures as fastest, and the rollout you think you're running isn't running. Weighted routing requires deliberately raising the sensitivity range wide enough to make your intended origins eligible.</p>
</div>

Weights are also approximate at low volume. Front Door distributes across many POPs and machines independently, so at low requests-per-second the observed split can look meaningfully skewed from what you configured even when sensitivity is set correctly. Weighted routing is a traffic-shaping tool for real traffic, not something to validate with a handful of test requests.

### Health Probes

[Health probes](https://learn.microsoft.com/en-us/azure/frontdoor/health-probes){:target="_blank" rel="noopener noreferrer"} determine whether each origin is healthy and able to receive traffic. Probes originate from multiple Front Door edge locations independently, providing distributed health assessment that can detect regional network issues.

**Configuration options:**
- **Protocol:** HTTP or HTTPS. Probes reuse the same TCP ports configured for routing; you can't override them.
- **Method:** HEAD or GET. New profiles default to HEAD.
- **Path:** The URL path to probe (e.g., `/health`)
- **Interval:** How frequently to probe, in seconds (default 30 seconds)

Probes carry a `User-Agent` of `Edge Health Probe`, which is how you identify them in origin logs. Only **HTTP 200** counts as healthy. Every other status code, and any non-response, counts as a failure. Latency is measured over a fresh TCP connection per probe, so the measurement isn't biased toward origins that already have warm connections.

**Health evaluation:**
- **Sample size:** The number of recent probe results to consider when evaluating origin health
- **Successful sample required:** How many of the sample must be successful (HTTP 200) to consider the origin healthy

**Probe volume consideration:** Estimate volume by multiplying the number of edge locations by two requests per minute at the default 30-second interval, roughly 200 per minute against a single origin at 100 active POPs. The estimate is an upper bound, not a constant: POPs that aren't receiving real user traffic reduce their probe frequency below the configured value, so a lightly-trafficked origin sees fewer probes than the arithmetic suggests. Using HEAD instead of GET reduces bandwidth and compute overhead per probe. If one endpoint belongs to several origin groups, Front Door probes it at the lowest configured interval among them and reuses the results across all of those groups rather than probing once per group.

**Two behaviors to design around:**

- **If every origin in a group fails its probes, Front Door doesn't stop serving.** It treats them all as unhealthy and distributes traffic round-robin across the whole group, resuming normal load balancing when an origin recovers. This is the sensible choice, since a probe path that breaks shouldn't take down a working application, but it means a globally broken `/health` endpoint looks like normal operation from the outside while every routing decision you configured has quietly stopped applying.
- **Health probes can be disabled only for single-origin groups.** If a group has multiple enabled origins, probing is mandatory, which is the correct constraint: Front Door can't choose between origins it isn't measuring. A single-origin group with probes enabled receives few probes and may show dips in origin health metrics without any traffic impact.

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

Session affinity ensures that subsequent requests from the same client session are routed to the same origin. Front Door implements this using managed cookies named `ASLBSA` and `ASLBSACORS`, with a SHA256 hash of the origin URL as the identifier. When enabled on an origin group, the first request is routed normally, and Front Door sets the cookie. Subsequent requests with that cookie are directed to the same origin. The cookie's lifetime matches the user's session, because Front Door only issues session cookies.

**Affinity is not established when the origin returns a cacheable response.** The reason is sound: setting a per-client cookie on a response that will be cached and served to other clients would hand one user's affinity cookie to everyone else requesting the same resource. So Front Door declines to establish affinity in that case. Affinity is established when the response is non-cacheable, and also when the response carries `Cache-Control: no-store`, carries a valid `Authorization` header, or is an HTTP 302. Once a session is established, cacheability of later responses no longer matters.

This trips people up because the failure is silent and conditional: affinity appears to work in testing against dynamic endpoints, then appears broken for the request that happened to hit a cacheable one. If you need affinity, make sure the response that's supposed to establish it isn't cacheable.

Session affinity is useful for applications that maintain server-side session state, but it reduces the effectiveness of load balancing. Stateless application designs that externalize session state to a shared store are preferable when possible.

---

## Caching

### How Caching Works

Front Door caches content at its edge POPs to reduce origin load and improve response times. When a request arrives at an edge POP, Front Door checks whether a valid cached response exists. If it does, the cached response is served directly. If not, Front Door forwards the request to the origin, caches the response (if cacheable), and returns it to the client.

Only GET requests are cacheable. POST, PUT, DELETE, and other methods are always proxied to the origin. Each POP maintains its own cache, so the same object can be a miss at one POP and a hit at another, so you will tend to see some origin traffic even at a high hit ratio.

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

Responses with `Cache-Control: private`, `no-cache`, or `no-store` are never cached, even when rules attempt to override caching behavior. Cache duration can never exceed **366 days**.

Two guarantees Front Door explicitly does *not* make: it may evict content before expiry if the content isn't frequently requested, and it may serve stale content past expiry when the origin is returning errors. The second behavior is a feature, since it keeps a site partially available while origins are down, but it means "I purged it and users still see it" and "the TTL elapsed so it must be fresh" are both unsafe assumptions.

### Revalidation and Validators

When cached content goes stale, Front Door revalidates against the origin using HTTP validators. **Front Door supports only `Last-Modified`. It does not support `ETag`.**

This surprises people arriving from other CDNs, where `ETag` is the default revalidation mechanism. On Front Door, an origin that emits only `ETag` and no `Last-Modified` gives Front Door nothing to revalidate with. Revalidation uses `If-Modified-Since`: the origin compares the supplied timestamp against the resource's `Last-Modified` and returns 304 if unchanged, or 200 with the new content if it changed.

For content over 8 MB, origins must return **consistent** `Last-Modified` timestamps per asset across replicas. Inconsistent timestamps cause validator mismatch errors, which surface as partial downloads or 5XX failures rather than as anything that names the real cause. Azure Storage may not maintain consistent `Last-Modified` values across replicas, so this is a live concern for large files served from Storage origins, not a hypothetical.

### Cache Behavior Headers

Front Door adds an `X-Cache` response header that indicates whether the response was served from cache. The value describes the **first 8 MB chunk** of the response, not the response as a whole:

| Header Value | Meaning |
|-------------|---------|
| `TCP_HIT` | First chunk served from Front Door cache |
| `TCP_REMOTE_HIT` | First chunk served from Front Door cache (remote node) |
| `TCP_MISS` | Cache miss; content fetched from origin |
| `PRIVATE_NOSTORE` | Origin response included `private` or `no-store` |
| `CONFIG_NOCACHE` | Caching is disabled in the route/profile configuration |

Microsoft also documents a `REVALIDATED_HIT` value, indicating cached content was revalidated with the origin and found unchanged before being served (which also resets cache expiration). Note that the docs describe this one as appearing on the `Cache-Control` response header rather than on `X-Cache`, so don't build alerting on its position without confirming what your profile actually emits.

### Headers Front Door Changes

Caching quietly rewrites part of the request and response, which matters when an origin depends on a header that never arrives:

- **Not forwarded to the origin when caching is enabled:** `Content-Length`, `Transfer-Encoding`, `Accept`, `Accept-Charset`, `Accept-Language`, and `Vary`. An origin that varies its response on `Accept-Language` cannot do so behind a caching Front Door route.
- **`Set-Cookie` is stripped** from responses Front Door considers cacheable, and left intact on non-cacheable ones. An endpoint that sets a cookie *and* advertises itself as cacheable will lose the cookie.
- **Requests carrying an `Authorization` header aren't cached** unless the response includes a `Cache-Control` directive that permits it (`must-revalidate`, `public`, or `s-maxage`). This is a useful safety default against the personalization leak described in the pitfalls below, though not a substitute for setting cache behavior deliberately.

### Cache Purge

When cached content needs to be invalidated before its TTL expires, Front Door supports manual cache purging:

- **Single path:** Purge a specific URL like `/images/logo.png`
- **Wildcard:** Purge all content matching a pattern like `/images/*`
- **Root domain:** Purge everything with `/*`

Purges are case-insensitive and query-string agnostic (purging a URL purges all query string variations of that URL). Propagation takes up to 10 minutes across all edge locations.

**Two operational limits shape how purging works at scale.** Wildcard *domains* can't be purged directly. For `*.contoso.com` you must name each subdomain (`dev.contoso.com/path/*`) rather than purging the wildcard itself. And each purge request accepts a maximum of **100 URLs**, processed in roughly 10 minutes; submitting the next batch before the previous one completes gets the request **rejected**, not queued. Purging 256 URLs is therefore three sequential batches with verification between them, on the order of half an hour, not a single API call.

That arithmetic is the real argument for versioned filenames (e.g., `/styles.v2.css`) over purging for frequently updated content. Versioned filenames take effect immediately, because a new filename is simply a new cache entry with no old entry to invalidate; they cost nothing, they have no batch limit, and they give you instant rollback by pointing back at the previous version. Reserve purging for emergencies and for HTML entry points that can't be versioned.

### Large File Delivery

Front Door uses object chunking to optimize large file delivery. Files are retrieved from the origin in 8 MB chunks, with each chunk cached independently as it arrives. The next chunk is prefetched in parallel while the current chunk is being delivered to the client. The entire file does not need to reside in the Front Door cache before delivery begins.

For this to work efficiently, the origin must support byte-range requests (RFC 7233) and respond with HTTP 206 and a `Content-Range` header whose value matches the actual length of the returned content, including when the origin compresses the response. If the origin can't handle ranges, it should ignore the `Range` header entirely and return a normal 200; what breaks things is a malformed ranged response, not the absence of range support. When `Content-Range` is wrong or missing on a 206, Front Door won't cache the response and behavior gets inconsistent.

Two limits bound this: Front Door doesn't dynamically compress content above 8 MB (though it will serve content the origin pre-compressed, provided range requests work and chunked transfer encoding is off), and if the origin uses **Chunked Transfer Encoding**, responses over 8 MB aren't supported at all.

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
- **Match conditions:** client IP (CIDR), geographic location, request URI, query string, POST args, request body, request headers, cookies, request method, size constraints, AS number, client fingerprint, and service tag. String matching supports regex, along with negation and transforms (lowercase, trim, URL decode, and similar) applied before the match.
- **Actions:** Allow, Block, Log, or Redirect
- **Priority:** A unique integer; lower values evaluate first. Priorities must be unique across all custom rules in the policy.

**Evaluation stops on the first matching rule whose action is anything other than Log.** Allow, Block, and Redirect all terminate evaluation and exit. Only Log falls through to the next rule in priority order. This makes priority ordering load-bearing rather than cosmetic: a broad Allow at a low priority number will short-circuit every stricter rule you wrote below it, and the WAF will look like it's ignoring rules that are in fact never reached. Use Log actions when you want a rule to observe without ending evaluation.

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

The current DRS 2.2 is baselined on OWASP CRS 3.3.4 and organizes roughly 18 rule groups. It also includes Microsoft Threat Intelligence Collection rules, written with Microsoft's threat intelligence team, which block known malicious IPs and domains and patch specific vulnerabilities. These rules aren't a bolt-on: they *replace* certain built-in CRS rules, disabling them in favor of a lower-false-positive equivalent. (Rule 942440, "SQL Comment Sequence Detected," is disabled and replaced by Threat Intelligence rule 99031002, for instance.) So a CRS rule showing as disabled in your policy isn't necessarily a gap. It may already be covered by a better rule.

You can tune managed rules by disabling specific rules, changing actions (from Block to Log), or defining exclusions for specific request fields that trigger false positives.

#### Anomaly Scoring: Why Prevention Mode Doesn't Block on a Single Match

This is the single most misunderstood part of Front Door's WAF, and it changes how you read every log line.

**DRS 2.0 and later use anomaly scoring.** A request matching a rule is *not* blocked immediately, even in Prevention mode. Instead each rule carries an OWASP severity (Critical, Error, Warning, or Notice), and each match contributes points to the request's cumulative **anomaly score**. The WAF acts only once a request accumulates a score of **5 or greater**. Rule sets before DRS 2.0 ran in "traditional" mode, where any single rule match was evaluated on its own and blocked outright.

Two consequences follow directly:

- **A logged rule match is not a blocked request.** Seeing your WAF match a rule in Prevention mode and let the request through isn't a misconfiguration; it's a request that scored below 5. Tuning by chasing individual matches will send you after phantom problems.
- **Blocks are attributable in the logs.** When a block does happen, you'll see rule ID **949110**, "Inbound Anomaly Score Exceeded", which tells you the total was exceeded but not, by itself, which rules got you there. The individual contributing matches are logged separately, which is exactly why anomaly scoring is easier to tune than traditional mode: you can see the full set of rules a request tripped instead of only the first one that fired.

**Paranoia levels** control how aggressive the rule set is. DRS 2.2 runs at Paranoia Level 1 by default with all PL2 rules disabled. PL2 catches more attacks and produces more false positives. The safe path to PL2 is to enable those rules in Log mode first, analyze what they would have caught, tune, and only then switch them to block, the same Detection-before-Prevention discipline applied one level down.

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
- **Group by:** `SocketAddr` (the source IP the WAF sees), `GeoLocation` (traffic grouped by the client IP's geography), or `None` (all matching traffic counted against one shared threshold)
- **Match conditions:** At least one is required. Rate limits can apply to specific conditions (URL paths, headers, geographic regions) or, to cover everything, to a match-all condition such as `Host` header length greater than zero. Every valid request has a `Host` header, so that matches all traffic.

Note that `SocketAddr` is the IP that terminated the TCP connection at Front Door, which for a user behind a proxy or NAT is the proxy's address, not theirs. Rate limiting by socket address therefore rate limits the proxy, and everyone behind it shares one budget. `None` is the option people overlook. It maintains no per-client counters at all and applies the action to *all* traffic matching the rule once the shared threshold breaks, which is a blunt instrument but the right one for protecting a specific expensive endpoint's total capacity.

Rate limiting operates on a fixed-window model. If the threshold is 100 requests per minute and a client sends 100 requests in the first 10 seconds, they are blocked for the remaining 50 seconds of that minute.

<div class="callout callout--warning">
<p class="callout__title">Rate Limits Are Approximate, and Low Thresholds Leak</p>
<p>Counters live on individual Front Door servers, not in a global counter. Requests from one client usually land on the same server, but a client opening a new TCP connection per request can be spread across servers that haven't yet synchronized counters, and the first request to each fresh server passes the check. Microsoft's guidance is explicit: below roughly <strong>200 requests per minute</strong>, expect some requests above your threshold to get through. If you set a threshold of 10/minute expecting exactly 10, you are going to be disappointed by a mechanism working as designed.</p>
<p>This inverts the intuitive tuning instinct. <strong>Larger windows with larger thresholds enforce more accurately</strong> than small ones, and they also mitigate better: an attacker blocked 30 seconds into a one-minute window is only stopped for 30 seconds, while one blocked in the first minute of a five-minute window is stopped for four. For DDoS mitigation, prefer the largest window with the smallest threshold you can tolerate.</p>
</div>

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

**Front Door + Traffic Manager (rare, and less useful than it looks):** Traffic Manager is sometimes placed in front of multiple Front Door profiles for extreme redundancy. Front Door is already globally distributed, so the added value is limited. And since the unicast switch, Front Door *already resolves through an internal Traffic Manager profile* to select a POP. Stacking your own Traffic Manager on top adds a DNS layer above a service that is itself DNS-directed, inheriting a second TTL and a second failover delay while sharing a dependency with the layer beneath it. Reach for this only with a specific requirement you can articulate.

**Patterns that don't work at all:** you can't nest one Front Door profile behind another, and you can't put Azure CDN behind Front Door or vice versa. Both profiles would land on the same Azure edge POPs, producing routing and caching conflicts. Chaining Front Door with a third-party CDN technically works but is discouraged: it negates last-mile acceleration by breaking the optimized origin connection, defeats IP-based access control at the second CDN (which now sees the first CDN's exit nodes as the client), and makes troubleshooting a question of which CDN is at fault.

<div class="callout callout--note">
<p class="callout__title">Architecture Decision</p>
<p>For most modern web applications with global users, start with Front Door. Add Application Gateway as a regional origin only if you need VNet-level routing or a regional WAF layer. Use Traffic Manager only when you need to route non-HTTP protocols or when clients must connect directly to origins.</p>
</div>

---

## Azure CDN: Legacy and Migration Path

### What Azure CDN Was

Azure CDN from Microsoft (Classic) was a standalone content delivery network service. It provided edge caching and content acceleration through Microsoft's POP network, similar to other CDN offerings. It focused purely on content delivery without the global load balancing, WAF, and advanced routing features that Front Door provides.

### Retirement and Migration

Azure CDN Standard from Microsoft (Classic) [will be retired on September 30, 2027](https://learn.microsoft.com/en-us/azure/cdn/classic-cdn-retirement-faq){:target="_blank" rel="noopener noreferrer"} across the public cloud and the Azure Government regions of Arizona and Texas. As covered above, new profiles, new domains, and managed certificates all stopped on August 15, 2025, and the last managed certificates expired on April 14, 2026. Existing resources can still be updated through the portal, Terraform, and CLI until the retirement date.

Microsoft's migration path is to move all CDN Classic workloads to Azure Front Door Standard or Premium. Front Door Standard provides equivalent (and superior) CDN functionality, with the added benefit of global load balancing and rule sets. The two tiers carry the same SLA, so migration isn't an availability trade-off.

**Migration considerations:**
- Zero-downtime migration tooling is available in the Azure portal. **Migration is one-way**. There's no rollback to classic once it completes
- Front Door eliminates separate charges for routing rules and provides free custom WAF rules
- Front Door's data transfer rates are lower per GB than CDN Classic
- Delete the classic resource once migration succeeds; Azure Advisor will nag you until you do

**Cost is usually lower, but not always. Check before you assume.** Front Door Standard and Premium beat classic comfortably on the common shapes: Microsoft's own worked examples put a static site with custom WAF rules and a large file-download workload at roughly 45% and 68% cheaper respectively, driven by lower egress rates and free routing rules. Two shapes invert that result:

- **Request-heavy workloads.** Classic didn't meter requests; Standard and Premium do. At billions of requests against modest data transfer, the request meter can outrun everything you save on egress. Microsoft's example lands Premium about 5% *above* classic.
- **Many small profiles.** The base fee is per profile. An estate of 80 classic profiles (one per microservice, plus dev/test) migrates to 80 base fees; Microsoft's example reaches roughly 1.7x the classic cost, almost entirely from base fees. Consolidating those 80 profiles into a handful with multiple endpoints each turns the same workload into a ~27% saving.

The lesson generalizes past this migration: on Front Door, profile count is a cost decision, and requests are a meter you must actually estimate. Pull the classic profile's Request Count and Billable Response Size metrics and price them before committing.

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

The path is longer than "POP to origin," and the shape explains several of the constraints below:

```
  ┌──────────┐         ┌───────────────────┐         ┌────────────────────────┐
  │  Client  │ ──────► │  Front Door POP   │ ──────► │  Front Door regional   │
  │          │         │                   │   MS    │  cluster               │
  └──────────┘         │  global; any of   │ backbone│                        │
                       │  the 192 POPs     │         │  you pick the region;  │
                       │                   │         │  AZ regions only;      │
                       └───────────────────┘         │  7,200 RPS cap         │
                                                     └───────────┬────────────┘
                                                                 │
                                                                 │ managed private
                                                                 │ endpoint
                                                                 │ (needs approval)
                                                                 ▼
                                                     ┌────────────────────────┐
                                                     │  Your origin, private  │
                                                     │  no public IP needed   │
                                                     └────────────────────────┘
```

Health probes follow this same path, so probe results reflect the private route rather than a public one.

### Supported Origin Types

Private Link origins support these Azure services:

| Origin type | Notes |
|---|---|
| **App Service** | Web Apps and Function Apps |
| **Blob Storage** | |
| **Storage Static Website** | Distinct from Static Web Apps (see below) |
| **Internal load balancers** | Covers anything fronted by an ILB, including AKS and Azure Red Hat OpenShift |
| **API Management** | |
| **Application Gateway** | |
| **Azure Container Apps** | |

**Not supported: App Service deployment slots and Azure Static Web Apps.** The Static Web Apps exclusion catches people out because "Azure Storage static website" *is* supported and the names are close enough to swap by accident. They're different services with opposite answers here. AKS is supported by way of its internal load balancer rather than as a first-class origin type, which is a distinction without a difference in practice but explains why you configure it as an ILB origin.

### Constraints That Shape the Design

- **Regional availability, and you choose the region.** Private Link is offered only in regions with Availability Zone support, since the feature needs zonal resiliency. The feature itself is region-agnostic. If your origin's region isn't on the list, pick the nearest one that is, accepting the extra hop's latency.
- **You cannot mix public and private origins in the same origin group.** Keep public origins in one group and private origins in another. Enabling Private Link on several public origins in a group simultaneously fails for a subtle reason: the update processes origins sequentially, so mid-operation the group briefly holds one private and one still-public origin, and the mixed state is rejected. Enable it one origin at a time, approving each endpoint before adding the next.
- **7,200 RPS per regional cluster, per profile.** Beyond that, Front Door returns `429 Too Many Requests` as a platform protection. This is the limit that ambushes high-traffic Private Link deployments, because nothing about a single origin's capacity predicts it. The fix is to spread load across multiple regional clusters by configuring several origins, each with a *different* Private Link region, even if every origin points at the same hostname.
- **No mTLS.** Front Door supports client/mutual authentication to neither public nor Private Link origins.
- **Private Link is origin-side only.** It secures Front Door to your origin. It does not give clients a private path to Front Door.

### Architecture Implications

Private Link eliminates the need to expose origins to the public internet, which provides several benefits:

- **Zero-trust network model:** Origins accept traffic only from Front Door's private endpoint; no public attack surface
- **Simplified NSG rules:** No need to allowlist Front Door's IP ranges at all
- **Compliance:** Meets requirements for workloads that must not have public internet-facing endpoints

For origin redundancy, configure multiple Private Link-enabled origins within the same origin group. Front Door distributes traffic across them, and if one origin becomes unavailable, traffic automatically shifts to the remaining healthy origins. Redundancy at the *regional cluster* level is a separate concern: give each origin in the group a different Private Link region, so an unreachable regional cluster doesn't take the origin group with it. This is the same configuration that raises the effective RPS ceiling, so one change buys both.

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
- **Subdomains** (e.g., `www.example.com`): Point a CNAME record to your Front Door endpoint
- **Apex domains** (e.g., `example.com`): Use Azure DNS alias records or CNAME flattening to point the zone apex to Front Door
- **Wildcard domains** (e.g., `*.example.com`): Receive traffic for any subdomain

Custom domains carry no per-domain charge on Standard or Premium. (Classic charged $5/month beyond the first 100, which is where the widely-repeated "first 100 free" figure comes from. On the current tiers there's simply no domain meter.)

### TLS Certificate Options

Front Door supports two certificate management approaches:

**Azure-managed certificates (recommended):**
- Free, automatically provisioned and renewed
- No key management, no certificate signing requests, no manual uploads
- Issued by DigiCert. Some domains require a CAA record of `0 issue digicert.com` before issuance will succeed
- Rotated automatically within 45 days of expiry, but **for most, not all, domain configurations** (see below)
- Issuance takes several minutes to an hour, occasionally longer

**Customer-managed certificates (BYOC):**
- Stored in [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview){:target="_blank" rel="noopener noreferrer"} **in the same subscription as the Front Door profile**. A key vault in another subscription fails, full stop
- Front Door authenticates to Key Vault using a managed identity (Private Link to Key Vault isn't supported)
- Uploaded as a certificate object from a PFX file, not as a secret
- Elliptic curve (EC) certificates are **not supported**
- You control the certificate lifecycle (issuance, renewal, revocation)
- Required when you need a specific CA, extended validation, certificate pinning, or the same certificate across multiple systems

Switching from BYOC to managed certificates requires domain revalidation. Switching from managed to BYOC does not. Either switch takes up to an hour to deploy and causes no downtime from an *Approved* state, since Front Door keeps serving the old certificate until the new one is ready.

#### When Managed Certificates Stop Auto-Rotating

Managed certificates are the right default, but "set and forget" is conditional, and the condition is not obvious.

Azure-managed certificates are available for subdomains, apex domains, **and wildcard domains**. The common belief that wildcards force you onto BYOC is simply wrong. What differs is *rotation*, not availability:

| Domain type | Managed certificate available | Rotates automatically |
|---|---|---|
| Subdomain | Yes | Yes |
| Apex domain | Yes | May require revalidation |
| Wildcard domain | Yes | **No** |

Auto-rotation requires the custom domain's CNAME to point **directly** at the Front Door endpoint. It does not happen when:

- The CNAME points at some other DNS record instead of your Front Door endpoint
- The domain reaches Front Door through a CNAME chain
- The domain uses an A record (always use CNAME for Front Door)
- The domain is an apex domain using CNAME flattening

Notice that the last item is the apex pattern recommended two sections above. Pointing an apex at Front Door via alias records or CNAME flattening is correct, and it lands squarely in the non-rotating case. The apex-domain guidance and the auto-rotation guarantee are both true, and they interact badly. When rotation can't happen automatically, the domain moves to *Pending Revalidation* 45 days before expiry, and you must publish a fresh DNS TXT record to prove ownership again. Miss it and the certificate expires. For any of the configurations above, either build the revalidation step into an operational calendar or use BYOC, which Microsoft recommends for indirect CNAME setups.

Validation TXT records expire after seven days, and a stale one causes validation to fail rather than to retry. Replace the old value, don't add alongside it.

### TLS Protocol Support

Front Door supports TLS 1.2 and TLS 1.3 for client connections. All profiles created after September 2019 default to TLS 1.2 minimum, with TLS 1.3 negotiated when the client supports it. **TLS 1.0 and 1.1 aren't supported**, not deprecated on new profiles or scheduled for removal, simply unsupported. Support for DHE cipher suites ended April 1, 2026. Standard and Premium let you set a predefined or custom TLS policy per custom domain to pin the cipher suites you allow.

Front Door does not support client/mutual authentication (**mTLS**) to any origin, public or private. If your architecture requires mTLS between the edge and your backends, Front Door cannot terminate it, and that constraint tends to surface late.

Clients negotiating TLS 1.3 must support one of the Microsoft SDL-compliant EC curves (Secp384r1, Secp256r1, Secp521), and should prefer one of them. Otherwise the handshake spends extra round trips renegotiating the curve, quietly giving back some of the latency Split TCP just saved you.

For origin connections, Front Door negotiates the best TLS version the origin can accept, supporting TLS 1.2 and 1.3.

### End-to-End Encryption

[End-to-end TLS](https://learn.microsoft.com/en-us/azure/frontdoor/end-to-end-tls){:target="_blank" rel="noopener noreferrer"} ensures traffic is encrypted from the client through to the origin:

- **Client to Front Door:** TLS 1.2/1.3 using the custom domain certificate (managed or BYOC)
- **Front Door to Origin:** TLS 1.2/1.3 using the origin's certificate

For origins, Front Door validates the origin's TLS certificate by default. The certificate must present a **complete chain** rooted in the [Microsoft Trusted CA List](https://ccadb.my.salesforce-sites.com/microsoft/IncludedCACertificateReportForMSFT){:target="_blank" rel="noopener noreferrer"}, and its subject name must match the origin hostname. An origin at `myapp.contoso.net` needs `myapp.contoso.net` or `*.contoso.net` in the subject, or Front Door refuses the connection and the client gets an error.

You can disable the **subject name check** on an origin, which is sometimes proposed as a way to use self-signed certificates. It isn't one. Disabling that check relaxes only the hostname match; the origin must still present a certificate with a valid, trusted chain. **Certificates from internal CAs and self-signed certificates are not allowed, and no setting changes that.** If your origin can only offer a self-signed certificate, the answer is to fix the origin's certificate or use HTTP to the origin (accepting that you lose end-to-end encryption), not to hunt for a validation toggle that doesn't exist. Microsoft doesn't recommend disabling the subject name check regardless.

### HTTP/2 and Protocol Limits

Front Door supports HTTP, HTTPS, and HTTP/2 for client connections, with HTTP/2 on by default. **HTTP/3 and QUIC aren't supported.**

Origin connections use HTTP/1.1, and that single fact rules out more than it appears to. **gRPC doesn't work behind Front Door**, because gRPC requires HTTP/2 end to end and Front Door only speaks HTTP/1.1 to origins. This is a common and expensive discovery: the gRPC service works fine directly and fails only once Front Door is in the path.

Application Gateway is not the workaround, despite listing HTTP/2 among its features. Its HTTP/2 support is client-side only and it also speaks HTTP/1.1 to backends, so gRPC fails there for the same reason. The options that do work are Application Gateway for Containers, which speaks gRPC to backends natively on AKS, or a pass-through Layer 4 path such as Azure Load Balancer, which never re-speaks the protocol and so leaves end-to-end HTTP/2 intact.

Front Door also **doesn't support custom error pages**, which surprises teams expecting to brand their 4xx/5xx responses at the edge.

---

## Common Pitfalls and How to Avoid Them

### 1. Not Configuring Query String Caching Appropriately

**Problem:** Using "Use Query String" mode when most query parameters are irrelevant to the response (marketing tracking parameters, random cache busters) creates thousands of separate cache entries for identical content.

**Impact:** Cache hit ratio drops significantly, increasing origin load and latency.

**Solution:** Use "Ignore Specified Query Strings" to exclude parameters like `utm_source`, `utm_medium`, `fbclid`, and `gclid` from the cache key. Alternatively, use "Include Specified Query Strings" to cache only on parameters that genuinely affect the response.

### 2. Caching Authenticated or Personalized Responses

**Problem:** Caching responses that contain user-specific data without including authentication context in the cache key can expose one user's data to another user.

**Impact:** This is a critical security vulnerability that can lead to data leakage and compliance violations.

**Solution:** Never cache authenticated endpoints without careful consideration. Put static and dynamic assets on **separate routes** and disable caching on the dynamic one. This is Microsoft's explicit recommendation, and it's structurally safer than trying to get the cache key right on a mixed route. Front Door gives you one backstop here (requests carrying an `Authorization` header aren't cached unless the response's `Cache-Control` permits it), but don't lean on it: it does nothing for session cookies, API keys in query strings, or any other personalization signal Front Door doesn't recognize as authentication. Front Door also can't use a request header as a cache key, so "just add the user context to the cache key" is not available as a fix.

### 3. Ignoring Health Probe Volume

**Problem:** Setting aggressive health probe intervals (every 5 seconds) across 100+ POPs can generate substantial traffic to origins.

**Impact:** At a 5-second interval with 100 POPs actively serving traffic, an origin can receive on the order of 1,200 probe requests per minute, which is significant for lightweight origins or origins with per-request costs. Probe volume scales with the number of POPs receiving real user traffic, so this ceiling is approached precisely when your application is busiest. The probes pile on at the worst moment rather than sitting at a predictable baseline.

**Solution:** Use HEAD method probes to reduce bandwidth, set intervals appropriate to your failover requirements (30 seconds is often sufficient), and implement a lightweight `/health` endpoint that validates critical dependencies without performing expensive operations. Remember the endpoint is load-bearing in both directions: make it too expensive and probes hurt you, but make it fail everywhere and Front Door round-robins across all origins as though nothing is wrong.

### 4. Using Front Door Without WAF

**Problem:** Deploying Front Door without a WAF policy leaves applications exposed to common web attacks (SQL injection, XSS, bot abuse) despite having a global edge infrastructure.

**Impact:** Attackers bypass the performance benefits of Front Door and directly exploit application vulnerabilities.

**Solution:** At minimum, enable a WAF policy with custom rules on Standard tier. For production workloads handling sensitive data, use Premium tier with managed rule sets (DRS) in Detection mode initially, then switch to Prevention mode after tuning. When you do switch, read the logs through the anomaly-scoring model: matched rules in Prevention mode are contributions to a score, not blocks, and only rule 949110 tells you a request was actually rejected.

### 5. Not Using Private Link When Origins Should Be Private

**Problem:** On Premium tier, configuring origins with public endpoints when they could use Private Link unnecessarily exposes the origin to the internet.

**Impact:** The origin keeps a public IP and must defend against direct-access attacks that bypass Front Door entirely, along with the WAF, rate limits, and routing rules you configured there. An origin reachable directly is an origin where your edge security is optional from the attacker's point of view.

**Solution:** Enable Private Link for all origins that support it. This eliminates the public attack surface rather than merely filtering it.

Where Private Link isn't an option (Standard tier, or an unsupported origin type), don't hand-maintain IP allowlists. Use the **`AzureFrontDoor.Backend` service tag**, which names the IP ranges Front Door uses to reach origins and updates itself as those ranges change. Front Door publishes three tags: `AzureFrontDoor.Backend` (edge to your origins), `AzureFrontDoor.Frontend` (client-facing IPs, for controlling outbound traffic to services behind Front Door), and `AzureFrontDoor.FirstParty` (reserved for Microsoft services). A service tag restricts traffic to Front Door as a *service*, not to *your* profile, so pair it with a shared secret header validated at the origin if you need to prove requests came from your Front Door specifically.

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

### 9. Assuming Weighted Routing Works at Default Settings

**Problem:** Configuring origin weights for a canary, blue-green, or gradual-migration rollout while leaving latency sensitivity at its default of 0 ms.

**Impact:** Weights never apply. Only the single lowest-latency origin is eligible, so a "10% canary" receives either all the traffic from a given POP or none of it, and the rollout you believe you're running isn't happening. Nothing errors, and the configuration looks correct in the portal.

**Solution:** Raise latency sensitivity to a range wide enough that your intended origins are all eligible before relying on weights. Then validate against real traffic, not a handful of requests. Weight distribution is approximate at low RPS by design.

### 10. Planning Deployments Around Instant Configuration Changes

**Problem:** Treating Front Door configuration updates as immediate, and scripting deployments (or purges) that assume the previous step has already taken effect.

**Impact:** Every configuration change (rule sets, routes, origins, domains, WAF) is a global operation taking up to about 15 minutes to propagate. Changes submitted while another is still propagating are **queued behind it**, so back-to-back updates can take roughly 30 minutes. Custom TLS certificate updates can take an hour. Purge requests over 100 URLs are rejected outright rather than queued if the previous batch hasn't finished.

**Solution:** Build propagation time into deployment automation rather than discovering it under time pressure. Batch configuration changes into a single update where possible instead of submitting a sequence of small ones, and verify completion between purge batches.

---

## Key Takeaways

**Architecture and Performance:**
- Front Door provides global, Layer 7 load balancing across 192 edge locations in 109 metro cities
- POP selection is **unicast**, not anycast: name resolution goes through Front Door's internal Traffic Manager, which returns the optimal POP's unicast IP. Anycast guidance describes classic or pre-2026 Standard/Premium
- Split TCP converts long round trips into short ones by terminating TCP and TLS at a nearby POP and reusing pre-established backbone connections to origins
- Only GET requests are cacheable; all other methods are proxied directly to the origin
- Origin connections are HTTP/1.1 only, which rules out gRPC entirely; HTTP/3 isn't supported on either side

**Tier Selection:**
- Standard suits workloads needing CDN acceleration and basic WAF with custom rules
- Premium (roughly 10x the Standard base fee) adds managed WAF rule sets (OWASP/DRS), bot protection, and Private Link at no per-feature charge
- Premium's Private Link enables zero-trust architectures where origins have no public internet exposure
- The base fee is **per profile**, so profile count is a cost decision. The main way Standard/Premium ends up more expensive than classic is many small profiles, or a request-heavy workload meeting the request meter classic never had

**Routing and Traffic Control:**
- Origin groups support priority (active/standby), latency-based (performance), and weighted (proportional) routing, evaluated in that order
- **Latency sensitivity defaults to 0 ms, which disables weights**, so weighted routing requires widening it first
- WAF runs before route matching, and route matching runs before rule sets
- Rule sets provide edge-based request processing with up to 10 match conditions and 5 actions per rule
- Session affinity uses cookies, isn't established on cacheable responses, and should be avoided when stateless architecture is possible

**Caching Strategy:**
- Configure query string handling to avoid cache key bloat from irrelevant parameters
- Use "Honor Origin" cache behavior and ensure origins send correct `Cache-Control` headers
- **Front Door supports `Last-Modified` but not `ETag`**, so origins that revalidate only on ETag have nothing to revalidate with
- Use versioned filenames for instant, free cache updates; reserve purging for emergencies (max 100 URLs per request, ~10 minutes per batch)

**Security:**
- Always attach a WAF policy, even on Standard tier (custom rules are free)
- On Premium, enable managed rule sets in Detection mode first, then switch to Prevention after tuning
- **DRS 2.0+ uses anomaly scoring**: a rule match in Prevention mode doesn't block; the WAF acts at a cumulative score of 5+, logged as rule 949110
- Custom rule evaluation stops on the first match whose action isn't Log, making priority order load-bearing
- Rate limiting is fixed-window and enforced per Front Door server, so thresholds below ~200/minute leak; prefer larger windows
- Managed certificates don't auto-rotate for wildcard domains, apex domains using CNAME flattening, A records, or chained CNAMEs, which need revalidation or BYOC

**When to Use Front Door vs Alternatives:**
- Use Front Door for global HTTP/HTTPS workloads with caching, WAF, and edge acceleration
- Use Traffic Manager for non-HTTP protocols or DNS-level routing without proxying
- Use Application Gateway for regional Layer 7 load balancing within a VNet
- Combine Front Door (global) with Application Gateway (regional) for global applications with VNet-integrated backends
