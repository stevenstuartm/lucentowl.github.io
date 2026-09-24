---
title: "AWS CloudFront for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS CloudFront covering CDN architecture, edge locations, caching strategies, Lambda@Edge vs CloudFront Functions, Origin Shield, security, cost optimization, and global content delivery"
tags: [aws, cloudfront, cdn, edge-computing, caching, performance, cost-optimization, fundamentals]
---

## What Problems CloudFront Solves

AWS CloudFront is a global Content Delivery Network (CDN) service that distributes content to users with low latency and high transfer speeds. It solves critical challenges for web applications and content delivery:

**Performance Problems**:
- Origin servers experience high latency for geographically distant users (200-500ms round-trip times)
- Single origin cannot handle global traffic spikes without massive over-provisioning
- Dynamic content requires computation at the origin, adding latency for every request
- Large files consume origin bandwidth and slow down delivery

**Availability Problems**:
- Origin failures impact all users simultaneously
- DDoS attacks overwhelm origin infrastructure
- Regional outages take down entire applications
- No protection layer between users and origin

**Cost Problems**:
- Origin servers scale up to handle peak global traffic (95% idle during normal periods)
- Data transfer costs from origin are higher than edge transfer costs
- Compute resources run at the origin for every request regardless of result cacheability
- No request consolidation; origin sees every user request directly

**CloudFront's Solution**:
- 225+ edge locations across 90+ cities in 47 countries deliver content close to users
- Caches static and dynamic content at the edge, reducing origin load by 60-90%
- Lambda@Edge and CloudFront Functions execute code at edge locations
- Origin Shield provides additional caching layer, reducing origin requests by another 30-50%
- 99.9% availability SLA with automatic failover across edge locations
- DDoS protection via AWS Shield Standard (included free)
- 1 TB of free data transfer out per month across all distributions

CloudFront integrates with S3, EC2, Load Balancers, and custom origins, providing a unified caching layer for any web application architecture.

## CloudFront Architecture

### Edge Network Hierarchy

CloudFront uses a three-tier caching hierarchy:

**1. Edge Locations (225+ worldwide)**:
- First point of contact for user requests
- Cache popular content locally (cache TTL: 24 hours default)
- Serve cached content directly with <10ms latency
- Forward cache misses to Regional Edge Cache

**2. Regional Edge Caches (13 worldwide)**:
- Intermediate caching layer between edge locations and origin
- Consolidate requests from multiple edge locations
- Larger cache capacity than edge locations (longer retention)
- Reduce origin load by serving content to edge locations

**3. Origin Shield (Optional)**:
- Additional caching layer between Regional Edge Cache and origin
- **Single consolidation point** that collapses simultaneous requests to origin
- Reduces origin load by 30-50% beyond Regional Edge Cache
- Particularly valuable for origins that struggle with parallel connections
- **Cost**: $0.005 per 10,000 requests + origin region data transfer out

**Example Request Flow** (cache miss):
1. User requests `https://cdn.example.com/video.mp4`
2. Edge location checks local cache → miss
3. Edge location queries Regional Edge Cache → miss
4. Regional Edge Cache queries Origin Shield (if enabled) → miss
5. Origin Shield fetches from S3 origin (single request)
6. Response flows back: Origin → Shield → Regional → Edge → User
7. Next user in same region gets <10ms edge cache hit

### CloudFront Distributions

**Two distribution types**:

| Feature | Web Distribution | RTMP Distribution |
|---------|-----------------|-------------------|
| **Protocol** | HTTP/HTTPS | RTMP (Flash streaming) |
| **Use Case** | Websites, APIs, downloads | Flash video (deprecated) |
| **Status** | Fully supported | **Deprecated (Dec 2020)** |
| **Recommendation** | Use for all content | Migrate to HLS/DASH via Web Distribution |

**Focus on Web Distributions** for all modern use cases.

## Caching Strategies

### Cache Behaviors

Cache behaviors define **how CloudFront handles requests** based on path patterns. Each behavior specifies:

**Path Pattern**:
- `/images/*` → Cache for 7 days
- `/api/*` → Cache for 0 seconds (always forward to origin)
- `/static/*` → Cache for 1 year
- `*.jpg` → Cache images
- Default behavior (`*`) → Catch-all for unmatched paths

**Cache Key Configuration**:
- **Query strings**: Include all, include specific, or ignore
- **Headers**: Forward specific headers (e.g., `Accept-Language` for localized content)
- **Cookies**: Include specific cookies (e.g., session IDs for authenticated content)
- More specific cache key = lower cache hit ratio but more personalized content

**TTL Settings**:
- **Minimum TTL**: Overrides origin headers if they specify shorter caching
- **Maximum TTL**: Caps origin headers if they specify longer caching
- **Default TTL**: Used when origin doesn't specify caching headers (24 hours default)

**Example Configuration**:

```
Behavior 1: /api/*
- TTL: Min=0, Max=0, Default=0 (never cache)
- Forward all headers, query strings, cookies
- Use case: Dynamic API responses

Behavior 2: /images/*
- TTL: Min=3600, Max=604800, Default=86400 (1 day default, max 7 days)
- Cache based on query string `size` only
- Use case: Resized images with query param `?size=thumbnail`

Default Behavior: *
- TTL: Min=0, Max=31536000, Default=86400 (1 day default, max 1 year)
- Respect origin Cache-Control headers
- Use case: HTML, CSS, JS with versioned filenames
```

### Cache Hit Ratio Optimization

<div class="callout callout--tip">
<p class="callout__title">Target Cache Hit Ratio</p>
<p>Aim for 85%+ cache hit ratio. Each percentage point improvement reduces origin load and costs while improving user experience.</p>
</div>

**Strategies to improve cache hit ratio**:

**1. Normalize cache keys**:
- ❌ Cache on all query strings → `/product?utm_source=email&id=123` and `/product?id=123&utm_source=email` are different cache entries
- ✅ Cache only on `id` query string → both requests hit same cache entry

**2. Use versioned filenames**:
- ❌ `/styles.css` → Must use short TTL in case file changes
- ✅ `/styles.v2.css` or `/styles.abc123.css` → Use 1-year TTL, change filename when content changes

**3. Enable compression**:
- CloudFront automatically compresses text-based content (HTML, CSS, JS, JSON)
- Reduces file size by 60-80%
- Cached separately: one cache entry for compressed, one for uncompressed
- **Automatic** when viewer sends `Accept-Encoding: gzip` or `br` (Brotli)

**4. Use Origin Shield**:
- Consolidates requests from 13 Regional Edge Caches to single request to origin
- Particularly valuable when cache hit ratio is improving (fewer origin requests during cold start)

**5. Set appropriate TTLs**:
- Static assets (images, videos): 1 day to 1 year
- Frequently updated content (HTML): 1 minute to 1 hour
- Dynamic content (APIs): 0 seconds (always forward to origin)

**Monitoring Cache Performance**:
- CloudFront metrics: `CacheHitRate` (target >85%), `OriginLatency`, `BytesDownloaded`
- Identify paths with low cache hit ratio → adjust cache key configuration
- Monitor `4xxErrorRate` and `5xxErrorRate` to detect origin issues

### Invalidation vs. Versioning

**Cache Invalidation**:
- Force CloudFront to fetch fresh content from origin before TTL expires
- **Cost**: First 1,000 paths/month free, then $0.005 per path
- **Latency**: Takes 10-15 minutes to propagate to all edge locations
- **Use case**: Emergency fixes (security patches, critical bugs)

**Example invalidation**:
```
Invalidate /index.html → Next request fetches fresh content
Invalidate /images/* → Invalidates all images (counts as 1 path if using wildcard)
Invalidate / /about.html /contact.html → 3 invalidation paths
```

**Versioned Filenames (Recommended)**:
- Change filename when content changes: `/styles.v2.css`, `/app.abc123.js`
- No invalidation needed; old files remain cached until TTL expires
- **Cost**: Free
- **Latency**: Immediate (new filename = new cache entry)

**Best Practice**: Use versioned filenames for assets, reserve invalidation for HTML entry points and emergencies.

## Lambda@Edge vs. CloudFront Functions

Both services allow you to execute code at CloudFront edge locations, but they serve different use cases.

### CloudFront Functions

**What They Are**:
- Lightweight JavaScript functions executed at 225+ edge locations
- Sub-millisecond execution time (<1ms typical)
- Execute on **viewer events** only (viewer request, viewer response)

**Runtime Limits**:
- Maximum execution time: **< 1 ms**
- Maximum memory: **2 MB**
- Maximum function size: **10 KB**
- Language: **JavaScript only** (ECMAScript 5.1 compatible)
- Network access: **None** (no external API calls)

**Pricing** (Jan 2025):
- $0.10 per 1 million invocations
- **Example**: 100 million requests/month = $10/month

**Use Cases**:
- Header manipulation (add security headers, A/B test headers)
- URL rewrites and redirects
- Request validation (check auth token format)
- Simple logic that executes in <1ms

**Example Function** (Add security headers):

```javascript
function handler(event) {
    var response = event.response;
    response.headers['strict-transport-security'] = { value: 'max-age=31536000' };
    response.headers['x-content-type-options'] = { value: 'nosniff' };
    response.headers['x-frame-options'] = { value: 'DENY' };
    return response;
}
```

### Lambda@Edge

**What It Is**:
- Full Lambda functions executed at 13 Regional Edge Caches
- Up to 30 seconds execution time (viewer events: 5s, origin events: 30s)
- Execute on **all four CloudFront events** (viewer request, origin request, origin response, viewer response)

**Runtime Limits**:
- Maximum execution time: **5s (viewer events), 30s (origin events)**
- Maximum memory: **128 MB to 3 GB** (10 GB for origin events)
- Maximum function size: **1 MB (viewer), 50 MB (origin)**
- Languages: **Node.js, Python**
- Network access: **Yes** (call external APIs, databases)

**Pricing** (Jan 2025):
- $0.60 per 1 million requests
- $0.00005001 per GB-second of compute time
- **Example**: 100 million requests, 128 MB, 100ms avg = $60 (requests) + $64 (compute) = $124/month

**Use Cases**:
- Complex request/response manipulation
- Authentication and authorization (verify JWT, query user database)
- Dynamic content generation (personalized HTML, image resizing)
- A/B testing with external configuration
- Calling external APIs (fetch user preferences, check inventory)

**Example Function** (Resize images based on query string):

```javascript
exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const queryString = request.querystring;

    // Extract size parameter
    const sizeMatch = queryString.match(/size=(\w+)/);
    const size = sizeMatch ? sizeMatch[1] : 'original';

    // Rewrite URI to request resized version from origin
    request.uri = request.uri.replace(/(\.\w+)$/, `-${size}$1`);

    return request;
};
```

<div class="callout callout--note">
<p class="callout__title">Edge Compute Decision</p>
<p>CloudFront Functions are 12x cheaper but limited to &lt;1ms execution with no network access. Use Lambda@Edge when you need external API calls, complex logic, or longer execution time.</p>
</div>

### Decision Framework: CloudFront Functions vs. Lambda@Edge

| Criteria | CloudFront Functions | Lambda@Edge |
|----------|---------------------|-------------|
| **Execution time** | <1 millisecond | Up to 30 seconds |
| **Memory** | 2 MB | Up to 10 GB |
| **Language** | JavaScript only | Node.js, Python |
| **Network access** | No | Yes |
| **Events** | Viewer request/response only | All 4 CloudFront events |
| **Cost** (100M requests) | $10 | $124+ |
| **Latency** | Sub-millisecond | 10-200ms |
| **Use case** | Simple header manipulation, redirects | Complex logic, external API calls |

**Rule of thumb**:
- Use **CloudFront Functions** for simple, synchronous transformations that execute in <1ms
- Use **Lambda@Edge** when you need external API calls, complex logic, or >1ms execution time
- CloudFront Functions are 12x cheaper but far more limited in capability

## Origin Shield

### What Origin Shield Provides

Origin Shield is an **additional caching layer** between Regional Edge Caches and your origin. It solves the "thundering herd" problem where multiple Regional Edge Caches simultaneously request the same content from the origin.

**Without Origin Shield**:
- 13 Regional Edge Caches can each request same content from origin simultaneously
- Origin sees 13 parallel requests for popular content
- Origin must scale to handle 13x traffic for cold cache scenarios

**With Origin Shield**:
- All Regional Edge Caches request content from Origin Shield
- Origin Shield consolidates requests into single request to origin
- Origin sees 1 request instead of 13
- **Origin load reduction: 30-50%** for typical workloads

### When to Use Origin Shield

**Use Origin Shield when**:
- Origin struggles with parallel connections (databases, legacy systems)
- Origin has limited bandwidth or compute capacity
- Content has high variability (many unique objects, low cache hit ratio)
- Origin costs scale with number of requests (e.g., Lambda charged per invocation)
- You need to minimize origin load for cost or performance reasons

**Skip Origin Shield when**:
- Origin easily handles parallel connections (S3, CloudFront-optimized origins)
- Content is highly cacheable (90%+ cache hit ratio at Regional Edge Caches)
- Origin Shield region is far from origin (adds latency)
- Cost sensitivity (Origin Shield adds $0.005 per 10,000 requests)

**Performance Impact**:
- **Best case**: 45% latency reduction when combined with high Regional Edge Cache hit ratio
- **Typical case**: 20-30% origin load reduction with minimal latency impact
- **Worst case**: Adds latency if Origin Shield region is poorly chosen (place it close to origin)

### Origin Shield Configuration

**Setup**:
1. Enable Origin Shield for specific origin
2. Choose Origin Shield region (select region closest to origin)
3. CloudFront automatically routes Regional Edge Cache requests through Origin Shield

**Cost**:
- **Requests**: $0.005 per 10,000 requests (50% of standard CloudFront request pricing)
- **Data transfer**: Origin region data transfer out pricing (same as direct origin requests)
- **Example**: 1 billion requests/month = $500 (Origin Shield requests) + standard data transfer

**Regional Selection**:
- S3 origin in `us-east-1` → Use Origin Shield in `us-east-1`
- EC2 origin in `eu-west-1` → Use Origin Shield in `eu-west-1`
- Custom origin at `api.example.com` → Use Origin Shield in region closest to origin servers

## Security Features

### HTTPS and TLS

**TLS Version Support**:
- **TLSv1.3** (2024 default, fastest handshake, strongest security)
- TLSv1.2 (supported for legacy clients)
- TLSv1.0/1.1 (deprecated, disabled by default)

**Certificate Options**:

**1. CloudFront Default Certificate** (Free):
- Domain: `d123456abcdef.cloudfront.net`
- No cost, no setup required
- Use case: Testing, internal tools

**2. Custom SSL Certificate via ACM** (Free):
- Use your own domain: `cdn.example.com`
- Certificate managed by AWS Certificate Manager (ACM) in `us-east-1` region (required)
- Automatic renewal
- **Cost**: Free
- **Requirement**: Must use SNI (Server Name Indication) for free option

**3. Dedicated IP Custom SSL** ($600/month):
- Custom domain without requiring SNI (supports very old browsers)
- **Cost**: $600 per certificate per month
- **Use case**: Legacy browser support (IE on Windows XP, Android 2.x)
- **Recommendation**: Use SNI unless you have specific legacy requirements

**SNI (Server Name Indication)**:
- Modern TLS extension that allows multiple SSL certificates on same IP address
- Supported by all browsers since 2010 (Chrome 6+, Firefox 2+, IE 7+ on Vista+)
- Free with CloudFront
- **Use this** unless you need to support ancient clients

**Encryption in Transit**:
- Viewer to CloudFront: HTTPS (TLS 1.2/1.3)
- CloudFront to Origin: HTTPS or HTTP (configurable per origin)
- **Best Practice**: Require HTTPS for both viewer and origin connections

### Field-Level Encryption

**What It Provides**:
- Encrypts specific fields in POST requests at the edge before forwarding to origin
- Data remains encrypted until it reaches application code with decryption keys
- Protects sensitive data (credit cards, SSNs) from intermediate systems (load balancers, application servers)

**How It Works**:
1. User submits form with sensitive fields (e.g., credit card number)
2. CloudFront encrypts specific fields using public key before forwarding to origin
3. Origin receives encrypted fields, decrypts using private key in secure environment
4. Intermediate systems (logs, caches) never see plaintext sensitive data

**Use Case**:
- PCI DSS compliance (credit card processing)
- Healthcare data (HIPAA compliance)
- Any scenario where intermediate systems should not access plaintext sensitive data

**Cost**: Free (no additional charge beyond standard CloudFront pricing)

**Setup Complexity**: Moderate (requires RSA key pair, field-level encryption profile)

### AWS Shield and WAF Integration

**AWS Shield Standard** (Free, automatic):
- DDoS protection against network and transport layer attacks (Layers 3/4)
- Protects against SYN floods, UDP reflection attacks
- Included automatically with CloudFront at no cost
- Absorbs attacks at edge locations before they reach origin

**AWS Shield Advanced** ($3,000/month):
- Application layer (Layer 7) DDoS protection
- 24/7 DDoS Response Team (DRT) support
- Cost protection (refunds for scaling costs during DDoS attack)
- Enhanced metrics and reporting

**AWS WAF** (Web Application Firewall):
- Filter requests based on IP address, geographic location, request headers, SQL injection patterns
- **Pricing**: $5/month per web ACL + $1/month per rule + $0.60 per 1 million requests
- Use case: Block malicious traffic, enforce geographic restrictions, prevent SQL injection/XSS

**Example WAF Rule** (Block SQL injection):
- Inspect query strings for SQL keywords (`UNION`, `SELECT`, `DROP`)
- Block requests matching SQL injection patterns
- Cost: $1/month (rule) + $0.60 per million requests

## Cost Optimization

### Pricing Model (January 2025)

**Data Transfer Out** (varies by region, prices for US/Europe):

| Data Transfer Volume | Price per GB (US/Europe) |
|---------------------|--------------------------|
| First 1 TB per month | **Free** |
| Next 9 TB (1-10 TB) | $0.085 |
| Next 40 TB (10-50 TB) | $0.080 |
| Next 100 TB (50-150 TB) | $0.060 |
| Next 350 TB (150-500 TB) | $0.040 |
| Over 500 TB | $0.030 |

**Request Pricing**:
- **HTTPS requests**: $0.0100 per 10,000 requests
- **HTTP requests**: $0.0075 per 10,000 requests

**Origin Shield**:
- $0.005 per 10,000 requests + origin region data transfer out

**Invalidation**:
- First 1,000 paths per month: Free
- After 1,000 paths: $0.005 per path

### Cost Optimization Strategies

**1. Maximize Free Tier Usage**:
- First 1 TB of data transfer per month is free across all distributions
- First 1,000 invalidation paths per month are free
- For small/medium sites, CloudFront can be completely free

**2. Improve Cache Hit Ratio**:
- **85%+ cache hit ratio target**
- Each cache hit avoids origin request and origin data transfer cost
- **Savings example**: 1B requests, 85% cache hit ratio
  - Origin requests: 150M (vs. 1B without CloudFront)
  - Origin data transfer: 15 TB (vs. 100 TB)
  - **Savings**: $1,275 in data transfer + reduced origin compute costs

**3. Use Price Classes**:
- **Price Class All** (default): Use all 225+ edge locations worldwide
- **Price Class 200**: Exclude most expensive regions (South America, Australia, New Zealand)
- **Price Class 100**: Use only North America and Europe
- **Savings**: 10-25% data transfer cost reduction
- **Trade-off**: Users in excluded regions connect to farther edge locations (higher latency)

**Example Price Class Decision**:
- Global audience → Price Class All
- US/Europe only → Price Class 100 (25% savings)
- Primarily US/Europe, occasional global → Price Class 200 (10% savings, acceptable latency for global users)

**4. Enable Compression**:
- CloudFront automatically compresses text-based content (HTML, CSS, JS, JSON)
- Reduces data transfer by 60-80%
- **Savings example**: 100 GB uncompressed HTML → 20 GB compressed = $6.80 savings (after free tier)

**5. Use Versioned Filenames Instead of Invalidations**:
- Invalidations cost $0.005 per path after 1,000 paths/month
- Versioned filenames are free (no invalidation needed)
- **Savings example**: 10,000 invalidations/month = $45/month → $0/month with versioned filenames

**6. Optimize Origin Data Transfer**:
- Origin Shield reduces origin requests by 30-50%
- Place Origin Shield in same region as origin (avoid cross-region data transfer)
- Use S3 Transfer Acceleration for faster uploads to origin (if using S3)

### Cost Example: Typical Web Application

**Scenario**:
- 10 million page views per month
- 2 MB average page size (HTML + assets)
- 85% cache hit ratio
- US-based audience (Price Class 100)

**CloudFront Costs**:
- **Data transfer**: 20 TB total (10M views × 2 MB), 15% from origin = 3 TB
  - First 1 TB: Free
  - Next 2 TB: $170 ($0.085/GB)
- **Requests**: 10M HTTPS requests = $10
- **Total**: $180/month

**Without CloudFront** (origin serves all traffic):
- **Data transfer**: 20 TB from origin (EC2 data transfer out: $0.09/GB) = $1,800
- **EC2 compute**: Must scale to handle 10M requests (additional cost)
- **Total**: $1,800+ per month

**Savings**: $1,620/month (90% reduction)

## Integration Patterns

### S3 Origin

**What It Is**:
- CloudFront serves content directly from S3 bucket
- Most common pattern for static websites, images, videos, downloads

**Setup**:
1. Create S3 bucket with content
2. Create CloudFront distribution with S3 bucket as origin
3. Configure Origin Access Control (OAC) so only CloudFront can access S3

**Origin Access Control (OAC)**:
- Replaces legacy Origin Access Identity (OAI)
- CloudFront authenticates to S3 using AWS Signature Version 4
- S3 bucket policy allows CloudFront distribution, denies direct public access
- **Security benefit**: Users cannot bypass CloudFront to access S3 directly

**Example S3 Bucket Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE"
        }
      }
    }
  ]
}
```

**Use Case**: Static website hosting, media files, software downloads

### Application Load Balancer (ALB) Origin

**What It Is**:
- CloudFront forwards requests to ALB, which distributes to EC2/ECS/Lambda targets
- Common pattern for dynamic web applications

**Setup**:
1. Create ALB with target group (EC2 instances, ECS tasks, Lambda functions)
2. Create CloudFront distribution with ALB as custom origin
3. Configure cache behaviors (cache static assets, forward dynamic requests)

**Custom Headers**:
- Add custom header to CloudFront → Origin requests
- ALB validates custom header to ensure requests come from CloudFront (not direct internet traffic)
- **Security benefit**: Block direct access to ALB, force all traffic through CloudFront

**Example Configuration**:
- CloudFront adds header: `X-Custom-Secret: abc123xyz`
- ALB listener rule: If `X-Custom-Secret != abc123xyz`, return 403 Forbidden
- Rotate custom header value periodically for additional security

**Use Case**: Dynamic web applications, APIs with caching layer, authenticated content

### API Gateway Origin

**What It Is**:
- CloudFront caches API responses to reduce API Gateway invocations and improve latency
- Common pattern for public APIs with cacheable responses

**Setup**:
1. Create API Gateway REST or HTTP API
2. Create CloudFront distribution with API Gateway as custom origin
3. Configure cache behaviors based on API endpoints

**Cache Behavior Examples**:
- `/api/products` → Cache for 5 minutes (product catalog changes infrequently)
- `/api/search?q={query}` → Cache for 1 hour based on query string
- `/api/user/profile` → Cache for 0 seconds (user-specific, requires authentication)

**Cost Savings**:
- API Gateway: $3.50 per million requests
- CloudFront: $0.01 per 10,000 requests = $10 per million requests
- **With 90% cache hit ratio**: $3.50 (100K origin requests) + $10 (CloudFront requests) = $13.50 per million (vs. $35 without CloudFront)
- **Savings**: 61% cost reduction + 80-95% latency reduction for cached responses

**Use Case**: Public APIs, rate-limited APIs, APIs with expensive backend queries

### Multi-Origin Configurations

**What It Is**:
- Single CloudFront distribution with multiple origins (S3, ALB, API Gateway)
- Route requests to different origins based on path pattern

**Example Configuration**:
- `/images/*` → S3 bucket (static images)
- `/api/*` → API Gateway (REST API)
- `/app/*` → ALB (dynamic web application)
- Default (`*`) → S3 bucket (static website)

**Benefits**:
- Single domain for all content (`cdn.example.com`)
- Centralized caching and security configuration
- Reduced DNS lookups (all content from same domain)

**Use Case**: Microservices architecture, mixed static/dynamic content, separate origins for different content types

## Common Pitfalls and How to Avoid Them

### 1. Low Cache Hit Ratio Due to Unnecessary Cache Key Variations

**Problem**: Including all query strings, headers, or cookies in cache key creates separate cache entries for identical content.

**Example**: `/product?id=123&utm_source=email` and `/product?id=123&utm_source=twitter` are cached separately even though they return identical content.

**Impact**: 50-70% cache hit ratio (should be 85%+), 3x higher origin load, 2-5x higher latency for cache misses.

**Solution**:
- Configure cache behavior to include only relevant query strings (e.g., `id` only)
- Use CloudFront cache policies to normalize cache keys
- Forward only necessary headers (e.g., `Accept-Language` for localized content, not `User-Agent`)

**Cost Impact**: 100M requests at 70% cache hit ratio vs. 85%: 30M origin requests vs. 15M = 2x origin costs.

### 2. Using Invalidations Instead of Versioned Filenames

**Problem**: Frequent invalidations are slow (10-15 minutes), costly ($0.005 per path after 1,000), and create complexity.

**Example**: Deploy new version of `styles.css`, invalidate `/styles.css` path, wait 10-15 minutes for propagation.

**Impact**: Deployment delays, invalidation costs ($45/month for 10,000 invalidations), race conditions (users may see old cached content during propagation).

**Solution**:
- Use versioned filenames: `styles.v2.css`, `app.abc123.js`
- Update HTML to reference new filename
- Old files naturally expire after TTL (no invalidation needed)

**Cost Impact**: 10,000 invalidations/month = $45/month → $0/month with versioned filenames. **Savings: $45/month.**

### 3. Overly Aggressive TTLs for Dynamic Content

**Problem**: Setting long TTLs for frequently changing content serves stale data to users.

**Example**: Cache `/api/inventory` for 1 hour, but inventory updates every 5 minutes.

**Impact**: Users see out-of-stock items as available, leading to failed orders and poor UX.

**Solution**:
- Set TTL based on actual update frequency
- Use `Cache-Control: max-age=300` (5 minutes) for inventory API
- Use `Cache-Control: no-cache` for real-time data (forces revalidation)
- Consider stale-while-revalidate for eventually consistent data

**Cost Impact**: Minimal direct cost impact, but poor UX can reduce conversions by 5-15% for e-commerce sites.

### 4. Not Using Origin Shield for High-Cardinality Content

**Problem**: Without Origin Shield, 13 Regional Edge Caches each request unique content from origin, overwhelming it.

**Example**: Video streaming platform with 100,000 unique videos; Regional Edge Caches request popular videos simultaneously during cache cold start.

**Impact**: Origin sees 13x traffic during cold cache periods, requiring massive over-provisioning.

**Solution**:
- Enable Origin Shield for origins with high-cardinality content
- Place Origin Shield in same region as origin
- Monitor origin request reduction (should see 30-50% reduction)

**Cost Impact**: Origin Shield costs $0.005 per 10,000 requests but reduces origin costs by 30-50%. For 1B requests: $500 (Origin Shield) - $600 (origin savings) = net $100/month savings.

### 5. Choosing Wrong Price Class for Audience

**Problem**: Using Price Class 100 (US/Europe only) for global audience forces users in Asia/Australia to connect to distant edge locations.

**Example**: Australian users connect to Singapore edge location (if available) or Los Angeles (if not), adding 200-400ms latency.

**Impact**: 200-400ms increased latency for users in excluded regions, poor user experience, potential SEO penalties.

**Solution**:
- Analyze CloudFront access logs to identify user geographic distribution
- Use Price Class All if >10% traffic comes from excluded regions
- Use Price Class 200 (excludes only South America/Australia) for broader coverage

**Cost Impact**: Price Class All costs 10-25% more than Price Class 100, but improves UX for global users. For 20 TB/month: $50-$150 additional cost.

### 6. Not Enabling Compression

**Problem**: CloudFront serves uncompressed text content, wasting bandwidth and slowing page loads.

**Example**: 200 KB HTML page served uncompressed vs. 40 KB compressed (80% reduction).

**Impact**: 5x higher data transfer costs for text content, 5x slower page loads on slow connections.

**Solution**:
- Enable automatic compression in CloudFront distribution settings (enabled by default for new distributions)
- Ensure origin doesn't already compress content (CloudFront skips if `Content-Encoding` header present)
- Verify compression with browser developer tools (check `Content-Encoding: gzip` or `br`)

**Cost Impact**: 100 GB uncompressed HTML → 20 GB compressed. Data transfer cost: $8.50 → $1.70. **Savings: $6.80/month per 100 GB.**

### 7. Using Dedicated IP SSL for SNI-Compatible Browsers

**Problem**: Paying $600/month for Dedicated IP SSL when all target browsers support SNI (99.9% of browsers since 2010).

**Example**: Using Dedicated IP SSL "just in case" without verifying actual browser requirements.

**Impact**: $600/month unnecessary cost.

**Solution**:
- Analyze CloudFront access logs to identify actual browser versions
- Use SNI unless logs show significant traffic from ancient browsers (IE on Windows XP, Android 2.x)
- For 99% of use cases, SNI is sufficient

**Cost Impact**: $600/month → $0/month. **Savings: $600/month.**

### 8. Forwarding All Headers to Origin

**Problem**: Forwarding unnecessary headers to origin reduces cache hit ratio and increases latency.

**Example**: Forwarding `User-Agent`, `Accept-Language`, `Accept-Encoding`, and 20+ other headers creates thousands of cache key variations.

**Impact**: Cache hit ratio drops from 85% to 30-50%, origin load increases 3-5x.

**Solution**:
- Forward only headers required by origin (e.g., `Host`, `Authorization`)
- Use CloudFront cache policies to normalize headers
- If you need `User-Agent` for analytics, log it separately (don't include in cache key)

**Cost Impact**: 100M requests at 50% cache hit ratio vs. 85%: 50M origin requests vs. 15M = 3.3x origin costs.

### 9. Not Monitoring Cache Performance Metrics

**Problem**: CloudFront is deployed but never monitored; low cache hit ratio goes unnoticed.

**Example**: Cache hit ratio is 40% due to misconfigured cache keys, but no one notices until origin scaling costs spike.

**Impact**: 2-5x higher origin costs, 2-5x higher latency, wasted CloudFront investment.

**Solution**:
- Enable CloudFront standard logs or real-time logs
- Monitor `CacheHitRate` metric in CloudWatch (target >85%)
- Set CloudWatch alarm for `CacheHitRate < 80%`
- Analyze logs to identify paths with low cache hit ratio

**Cost Impact**: Detecting and fixing 40% → 85% cache hit ratio improvement saves 45% of origin costs. For $1,000/month origin costs: **Savings: $450/month.**

### 10. Placing Origin Shield Far from Origin

**Problem**: Enabling Origin Shield but selecting a region far from origin adds latency instead of reducing it.

**Example**: S3 origin in `us-east-1`, Origin Shield in `eu-west-1`; adds 80-100ms cross-region latency.

**Impact**: Origin Shield requests are slower than direct Regional Edge Cache → Origin requests, negating benefits.

**Solution**:
- Always place Origin Shield in same region as origin
- S3 in `us-east-1` → Origin Shield in `us-east-1`
- Custom origin at `api.example.com` in Europe → Origin Shield in `eu-west-1`

**Cost Impact**: Misconfigured Origin Shield adds latency without reducing origin load. Correct placement reduces origin load by 30-50%.

### 11. Not Using Lambda@Edge/CloudFront Functions for Simple Logic

**Problem**: Executing logic at origin that could run at edge (header manipulation, redirects) wastes origin resources.

**Example**: Origin adds security headers to every response, requiring origin compute for every request.

**Impact**: Origin serves 100M requests/month just to add headers, requiring additional EC2 instances.

**Solution**:
- Use CloudFront Functions to add security headers at edge ($10/month for 100M requests)
- Use Lambda@Edge for complex logic (A/B testing, authentication)
- Reserve origin for business logic that cannot run at edge

**Cost Impact**: Adding headers at origin: 100M requests × $0.01 (EC2 compute) = $1,000/month. CloudFront Functions: $10/month. **Savings: $990/month.**

### 12. Caching Authenticated Content Without Careful Configuration

<div class="callout callout--warning">
<p class="callout__title">Critical Security Risk</p>
<p>Caching authenticated content without including authentication tokens in the cache key can expose one user's data to another. This is a common and serious vulnerability.</p>
</div>

**Problem**: Caching authenticated API responses can leak user data to other users.

**Example**: `/api/user/profile` cached without including `Authorization` header in cache key; User A sees User B's profile.

**Impact**: Critical security vulnerability, data leakage, GDPR violations.

**Solution**:
- Never cache authenticated content unless you explicitly include authentication token in cache key
- Use separate cache behaviors for authenticated vs. unauthenticated endpoints
- For authenticated endpoints, either:
  - Set TTL to 0 (no caching)
  - Include `Authorization` header in cache key (cache per user)
  - Use signed cookies/URLs for private content

**Cost Impact**: Data breach fines (GDPR: up to 4% of global revenue) far exceed any caching cost savings.

### 13. Not Using Origin Custom Headers for Security

**Problem**: ALB or origin is publicly accessible, allowing users to bypass CloudFront and avoid WAF/DDoS protection.

**Example**: Users discover ALB domain (`my-alb-123.us-east-1.elb.amazonaws.com`) and send requests directly, bypassing CloudFront WAF rules.

**Impact**: Attackers bypass WAF, DDoS attacks hit origin directly, security controls ineffective.

**Solution**:
- CloudFront adds custom header (e.g., `X-Custom-Secret: random-value-123`)
- ALB/origin validates header; reject requests without correct header
- Rotate header value periodically
- Use security groups to restrict ALB to CloudFront IP ranges (if possible)

**Cost Impact**: Direct origin attacks can overwhelm origin, requiring emergency scaling (2-10x costs during attack). WAF bypass enables SQL injection, XSS, and other attacks.

### 14. Using HTTP Instead of HTTPS for Origin Connections

**Problem**: CloudFront → Origin connection uses HTTP, exposing data in transit within AWS network.

**Example**: User → CloudFront uses HTTPS, but CloudFront → S3/ALB uses HTTP.

**Impact**: Data visible to anyone with access to AWS network (AWS employees, compromised IAM credentials, insider threats).

**Solution**:
- Require HTTPS for CloudFront → Origin connections
- Use ACM certificates for ALB/CloudFront
- Enable S3 bucket policy to require `aws:SecureTransport`

**Cost Impact**: No cost difference; HTTPS to origin is free.

### 15. Not Testing CloudFront Configuration Changes Before Production

**Problem**: Deploying cache behavior changes, TTL updates, or Lambda@Edge functions without testing causes production incidents.

**Example**: Change cache behavior to include all query strings, accidentally breaking existing application that relied on query string normalization.

**Impact**: Production outages, stale content served to users, emergency rollbacks, 2-6 hour incident response.

**Solution**:
- Use separate CloudFront distribution for staging environment
- Test cache behavior changes with staging distribution before applying to production
- Use CloudFront distribution deployment states (Enabled → Disabled) to quickly revert changes
- Monitor `4xxErrorRate` and `5xxErrorRate` metrics after configuration changes

**Cost Impact**: Production incidents cost 2-8 hours of engineering time ($500-$2,000) + potential revenue loss during outage.

## Key Takeaways

**CloudFront Core Value**:
- Global CDN with 225+ edge locations delivers content with <10ms latency to users worldwide
- Reduces origin load by 60-90% through intelligent caching at edge and regional layers
- 1 TB free data transfer per month makes CloudFront cost-effective for small/medium sites

**Caching Strategy**:
- Target 85%+ cache hit ratio by normalizing cache keys (include only necessary query strings, headers, cookies)
- Use versioned filenames instead of invalidations for instant, free cache updates
- Set TTLs based on actual content update frequency (static assets: 1 day to 1 year, dynamic content: 0 seconds to 5 minutes)

**Edge Compute**:
- Use CloudFront Functions for simple logic (<1ms, $0.10 per million requests)
- Use Lambda@Edge for complex logic with external API calls (up to 30s, $0.60 per million requests)
- Move logic from origin to edge whenever possible to reduce origin load and improve latency

**Origin Shield**:
- Enable Origin Shield when origin struggles with parallel connections or has high-cardinality content
- Place Origin Shield in same region as origin (avoid cross-region latency)
- Reduces origin load by additional 30-50% beyond Regional Edge Caches

**Security**:
- Use SNI for custom SSL certificates (free) unless you specifically need to support ancient browsers ($600/month Dedicated IP SSL)
- Enable Field-Level Encryption for sensitive data (credit cards, PII) to protect from intermediate systems
- Use custom headers to prevent direct origin access (force all traffic through CloudFront)
- Require HTTPS for both viewer → CloudFront and CloudFront → Origin connections

**Cost Optimization**:
- Improve cache hit ratio to 85%+ (reduces origin requests, data transfer, compute costs by 60-90%)
- Use Price Class 100 (US/Europe) or 200 (excludes South America/Australia) if audience is regional (10-25% savings)
- Enable compression for text content (60-80% data transfer reduction)
- Use versioned filenames instead of invalidations (free vs. $0.005 per path)

**Integration Patterns**:
- S3 origin with OAC for static websites, images, videos
- ALB origin for dynamic web applications (use custom headers to prevent direct access)
- API Gateway origin for cacheable APIs (60% cost reduction + 80-95% latency reduction)
- Multi-origin configurations for microservices (single domain, centralized caching)

**What to Monitor**:
- `CacheHitRate` (target >85%)
- `OriginLatency` (should be low; spikes indicate origin issues)
- `4xxErrorRate` and `5xxErrorRate` (detect origin or configuration issues)
- Analyze CloudFront access logs to identify paths with low cache hit ratio

**When NOT to Use CloudFront**:
- Content is already served from edge (S3 static website with CloudFront-like caching)
- Audience is entirely within single region close to origin (minimal latency benefit)
- Content is 100% dynamic and uncacheable (CloudFront adds latency without caching benefits)
- Budget constraints and traffic is very low (though 1 TB free tier covers many small sites)
