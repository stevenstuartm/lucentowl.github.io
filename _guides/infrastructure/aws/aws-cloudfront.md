---
title: "AWS CloudFront for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How CloudFront delivers content from the edge: distributions, origins, and cache behaviors; cache keys and TTLs; the cache tiers and Origin Shield; CloudFront Functions versus Lambda@Edge; locking origins to CloudFront; and flat-rate versus pay-as-you-go pricing."
tags: [cloudfront, cdn, caching, cache-keys, origin-shield, edge-functions, fundamentals]
---

## What CloudFront Does

Amazon CloudFront is AWS's content delivery network (CDN). It answers users from edge locations near them, keeps copies of cacheable responses there, and forwards everything else to the application's servers, which CloudFront calls **origins**. A user in Sydney fetching an image from an application in Virginia gets it from a nearby edge after the first request, rather than crossing the Pacific each time.

That serves three purposes at once:

- **Latency.** Cached responses come from a nearby edge. Uncached ones still benefit, because CloudFront terminates the user's TLS connection nearby and reaches the origin over AWS's network on connections it keeps open.
- **Origin load.** Every cache hit is a request the origin never sees.
- **A protective front door.** CloudFront absorbs network-layer attacks with AWS Shield Standard at no extra charge, and AWS WAF rules can run at the edge before a request reaches the origin.

CloudFront is a global service. Distributions aren't created in a Region, and the TLS certificate a distribution uses, issued by AWS Certificate Manager (ACM), must be requested in us-east-1.

---

## Distributions, Origins, and Behaviors

A **distribution** is one CloudFront configuration, reachable at a `*.cloudfront.net` name or at your own domains through a certificate and a DNS alias. It contains:

- **Origins.** Where CloudFront fetches content: an S3 bucket, a load balancer, an API Gateway API, a Lambda function URL, a server in a VPC, or any HTTP server on the internet. A distribution can have up to 100.
- **Cache behaviors.** Rules matched by path pattern, such as `/api/*` or `*.jpg`, each naming an origin and how to cache and forward requests for that path. A default behavior (`*`) catches everything else.

Behaviors are what let one domain serve a whole application: static files from S3, `/api/*` from a load balancer, and `/images/*` from an image service, each cached its own way.

An **origin group** pairs a primary origin with a secondary one. When the primary returns a chosen error status or doesn't respond, CloudFront retries the request against the secondary. Origin failover applies to reads (GET, HEAD, and OPTIONS requests), which makes it a good fit for serving static content from S3 buckets in two Regions.

---

## How Caching Works

### The Cache Key

CloudFront stores each response under a **cache key**, and a later request with the same key gets the stored copy. By default, the key is just the domain and path. A **cache policy** adds chosen query strings, headers, and cookies to it.

Every value added to the key splits the cache. Including `Accept-Language` stores a copy per language, which is intended. Including every query string stores a separate copy for `?id=1&utm_source=email` and `?utm_source=twitter&id=1`, which return the same page, and that quietly lowers the share of requests served from cache. The rule is to put in the key only what changes the response.

Cache policies are separate from **origin request policies**, which choose what CloudFront passes to the origin without putting it in the key. An origin can receive a `User-Agent` header for its logs, for example, while the cache key ignores it. AWS provides managed policies for the common cases, such as `CachingOptimized` for static content and `CachingDisabled` for responses that must never be cached.

### TTLs

How long a response stays cached comes from the origin's `Cache-Control` or `Expires` headers, bounded by the cache policy:

- The **minimum TTL** is the floor. CloudFront caches at least this long even if the origin asks for less.
- The **maximum TTL** is the ceiling.
- The **default TTL** applies when the origin sends no caching headers. For the `CachingOptimized` policy it is one day.

The minimum TTL overrides more than short lifetimes. When it is above zero, CloudFront caches a response for at least that long even if the origin sends `Cache-Control: no-store`, `no-cache`, or `private`. `CachingOptimized` has a minimum TTL of one second, so it can cache a response the origin marked private. To let the origin decide through `Cache-Control`, use a policy whose minimum TTL is zero, such as the managed `UseOriginCacheControlHeaders` policies or `CachingDisabled`.

Two further directives shape what happens when a cached copy expires. `stale-while-revalidate` lets CloudFront keep serving the expired copy for a set time while it fetches a fresh one in the background, so no viewer waits on the origin. `stale-if-error` lets it serve the expired copy when the origin is down or returns a 5xx error, which turns a short origin outage into stale pages rather than errors. Both are capped by the maximum TTL.

### Invalidation Versus Versioned File Names

To replace a cached file before its TTL runs out, either **invalidate** it or **change its name**. An invalidation tells every edge to drop matching objects, by path or by wildcard. A distribution can also opt in to **cache tags**: the origin labels each response with tags in a header you name, such as `product-123`, and one invalidation of that tag removes every object carrying it, whatever its path. The first 1,000 paths a month are free, then $0.005 per path, and a wildcard such as `/images/*` counts as one path. It takes time to reach every edge, and it only removes copies. Browsers and intermediate caches that already have the file keep it.

Versioned names avoid the problem entirely. A build that emits `app.3f9c2a.js` and updates the HTML to reference it creates a new cache key, so the change is immediate everywhere and the old file can keep a year-long TTL. The usual split is to version static assets and give the HTML that references them a short TTL, reserving invalidation for mistakes.

### The Cache Tiers and Origin Shield

A cacheable request that misses at its edge location usually goes next to a **regional edge cache**, a larger cache that serves many edge locations. Requests that can't be cached skip it: writes such as `POST` and `PUT`, and requests CloudFront treats as dynamic, go straight from the edge location to the origin. With **Origin Shield** turned on for an origin, misses from every regional edge cache also funnel through one more cache layer in a single Region you choose, so as few as one request per object reaches the origin:

{% include figure.html id="aws-cf-cache-tiers" %}

Origin Shield raises the share of requests answered from cache and cuts duplicate fetches when a new object gets popular in many places at once. It helps most when the origin is expensive per request, such as a server that packages video or transforms images on demand, when the origin has limited capacity, or when several CDNs pull from one origin. It fits poorly for dynamic content, content that is rarely requested, and content with low cacheability, and it is charged per request. Every write and every `GET` whose TTL is under an hour or whose caching is disabled counts as dynamic and is billed as an extra layer, so turning it on for an API origin adds cost for little benefit. Choose the Origin Shield Region with the lowest latency to the origin, which for an origin in AWS is usually its own Region.

---

## Running Code at the Edge

CloudFront offers two ways to run code on requests and responses, and they differ in almost every dimension:

| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| **Runs at** | Edge locations | Regional edge caches |
| **Triggers** | Viewer request and viewer response | Viewer request and response, origin request and response |
| **Language** | JavaScript (a restricted runtime) | Node.js or Python |
| **Limits** | 10 KB of code, 2 MB of memory, a strict time budget | Up to 30 seconds and a 50 MB package. Memory is 128 MB on viewer triggers and up to 10,240 MB on origin triggers, and a generated response can be 40 KB on viewer triggers and 1 MB on origin triggers |
| **Network and body access** | Neither | Both, within size limits |
| **Price** | $0.10 per million invocations | $0.60 per million requests plus compute time |

The four triggers sit at the two edges of CloudFront. **Viewer request** runs when a request arrives from the viewer, before the cache lookup, and **viewer response** runs just before the response goes back. **Origin request** runs only on a cache miss, before CloudFront calls the origin, and **origin response** runs when the origin answers, before the response is cached. Code on the origin triggers therefore runs far less often than code on the viewer triggers.

**CloudFront Functions** suit short, high-volume logic on every request: rewriting URLs, redirecting, normalizing headers or query strings before the cache lookup, checking a token's format, and choosing which origin a request goes to. They can read a **KeyValueStore**, a small global key-value store (up to 5 MB), which lets a redirect table or feature flag change without redeploying the function.

**Lambda@Edge** suits logic that needs a network call, the request body, or the origin triggers: looking up routing data in DynamoDB on a cache miss, authenticating against an external service, or generating a response. It carries restrictions ordinary Lambda functions don't. A Lambda@Edge function must be created in us-east-1 as a published, numbered version rather than `$LATEST`, and it can't use a VPC, environment variables, or layers. With Origin Shield on, its origin triggers run in the Origin Shield Region.

Two lighter tools often remove the need for either. A **response headers policy** adds security headers such as `Strict-Transport-Security` and `Content-Security-Policy`, or CORS headers, with no code. A cache policy that leaves unneeded query strings out of the key does much of what normalization functions were written for.

---

## Securing the Path to the Origin

CloudFront only protects an origin that can't be reached any other way. If a load balancer or bucket still accepts requests directly, anyone who finds its address bypasses WAF rules, caching, and geographic restrictions. How to close that path depends on the origin:

| Origin | Lock it to CloudFront with |
|---|---|
| **S3 bucket** | **Origin access control (OAC).** CloudFront signs its requests with AWS credentials, and the bucket policy allows CloudFront only when the request comes from that one distribution. OAC replaces the older origin access identity (OAI) and also supports buckets encrypted with AWS KMS keys |
| **Lambda function URL** | Origin access control, with the function URL set to require IAM authentication. Clients sending a `PUT` or `POST` must include a SHA-256 hash of the body in the `x-amz-content-sha256` header |
| **API Gateway API** | A secret header that CloudFront adds and the API checks, or an API resource policy |
| **ALB, NLB, or EC2 instance** | **VPC origins** (since November 2024). The load balancer or instance sits in a private subnet with no public address, and only CloudFront can reach it |
| **Internet-facing load balancer or server** | Allow only CloudFront's origin-facing managed prefix list (an AWS-maintained list of the addresses CloudFront connects from) in the security group, and have CloudFront add a secret header that the origin checks, since the prefix list admits every CloudFront distribution, not just yours |

Between the viewer and CloudFront, HTTPS uses an ACM certificate at no charge, with Server Name Indication (SNI), the TLS extension that lets many certificates share one address. A dedicated-IP certificate for clients that don't support SNI costs $600 a month and is rarely needed now. CloudFront to the origin can use HTTPS as well, and should wherever the origin supports it.

For content only some users may see, **signed URLs** and **signed cookies** let the application grant time-limited access. CloudFront checks the signature against a public key in a trusted key group before serving. Signed URLs suit individual files such as a download, and signed cookies suit many files such as a streaming video's segments.

### Caching Private Responses

The most damaging CloudFront mistake is caching a response that belongs to one user and serving it to another. It happens when a behavior caches a path such as `/api/profile` whose response depends on an `Authorization` header or session cookie that isn't in the cache key. Put personalized paths on a behavior using `CachingDisabled`, or include the credential in the key when per-user caching is truly wanted. `Cache-Control: private` from the origin only helps under a policy whose minimum TTL is zero.

---

## What CloudFront Costs

Since November 2025, CloudFront has two pricing models.

**Flat-rate plans** attach to a single distribution and charge a fixed monthly price with no overage charges. They bundle CloudFront with AWS WAF, DDoS protection, Route 53 DNS, CloudWatch logging, TLS certificates, CloudFront Functions, and S3 storage credits:

| Plan | Price per month | Included requests | Included data transfer |
|---|---|---|---|
| Free | $0 | 1 million | 100 GB |
| Pro | $15 | 10 million | 50 TB |
| Business | $200 | 125 million | 50 TB |
| Premium | $1,000 | 500 million | 50 TB |

The allowances aren't hard limits. Requests blocked by WAF or DDoS protection don't count against them, and a distribution that stays well over its allowance for months may have its delivery adjusted, for example by serving it from fewer edge locations, rather than being billed more. Features differ by tier: Origin Shield and origin failover come only with Premium, and KeyValueStore isn't in Free. Lambda@Edge stays pay-as-you-go on every plan, and a WAF web ACL must be attached. Some features can't be used on a plan at all, including continuous deployment, Anycast static IPs, real-time logs, dedicated-IP certificates, and origin access identity.

**Pay-as-you-go** charges per GB delivered and per request, with an always-free allowance each month of 1 TB of data transfer, 10 million requests, and 2 million CloudFront Functions invocations. After that, data transfer to viewers in North America and Europe starts at $0.085 per GB and falls with volume, HTTPS requests cost $0.01 per 10,000, and Origin Shield adds $0.0075 per 10,000 requests that reach it in the US. Data transfer from AWS origins to CloudFront is free.

Flat-rate plans suit sites whose bill would otherwise be dominated by the bundled services, or that want a predictable bill during traffic spikes and attacks. Pay-as-you-go stays cheaper for workloads outside the plans' allowances or that use few of the bundled services, and it is the only option for distributions that need the excluded features. **Price classes** on pay-as-you-go limit which edge locations serve a distribution, which cuts cost for audiences concentrated in North America and Europe at the cost of latency for everyone else.

The biggest lever under either model is the share of requests served from cache, since that determines how much work and data transfer the origin pays for.

---

## Common Pitfalls

### A Hit Rate Nobody Watches

A cache key that splits on noise rarely shows up as an error. It shows up as origin load. The console's cache statistics reports show the share of hits, and the `CacheHitRate` CloudWatch metric can be turned on per distribution as a paid additional metric. Check them after every cache policy change.

### Configuration Changes Pushed Straight to Production

A cache policy change can alter the behavior of every cached path at once. **Continuous deployment** lets a staging distribution receive up to 15% of production traffic with the new configuration before it is promoted. It isn't available on flat-rate plans or with HTTP/3, and CloudFront sends all traffic to the primary distribution during peak hours for the CloudFront service as a whole, which you can neither see nor control, so treat it as a check rather than a guarantee.

### CloudFront Where It Adds Little

A single-Region API whose responses are all personalized, used by clients near that Region, gains little from caching and still pays CloudFront's request charges and an extra hop. CloudFront can still earn its place there for WAF, DDoS absorption, and TLS termination near distant clients, but that is a decision to make on purpose.

---

## Key Takeaways

1. **CloudFront is a global front door.** It caches near users, terminates TLS close to them, and runs Shield Standard and optional WAF before traffic reaches the origin.
2. **The cache key decides the hit rate, and the minimum TTL decides what gets cached.** Put in the key only what changes the response, and use a zero minimum TTL wherever the origin must be able to forbid caching.
3. **Version static assets and keep HTML short-lived.** Save invalidation for mistakes.
4. **Origin Shield funnels misses from every region through one cache.** It pays off for expensive or capacity-limited origins, and it charges extra for dynamic requests.
5. **Use CloudFront Functions for small per-request logic and Lambda@Edge for anything needing the network or body.** Try policies first, because they need no code.
6. **Lock the origin to CloudFront** with origin access control for S3 and function URLs, and VPC origins for load balancers and instances.
7. **Choose between flat-rate plans and pay-as-you-go** by comparing the bundled services and allowances against actual usage.
