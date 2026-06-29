---
title: "AWS API Gateway for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS API Gateway covering REST vs HTTP APIs, authorization mechanisms, throttling and rate limiting, caching strategies, cost optimization, and integration patterns"
tags: [aws, api-gateway, rest-api, http-api, serverless, authentication, cost-optimization, fundamentals]
---

## What Problems API Gateway Solves

AWS API Gateway is a fully managed service that makes it easy to create, publish, maintain, monitor, and secure APIs at any scale. It solves critical challenges for modern application architectures:

**Routing and Integration Problems**:
- Backend services (Lambda, EC2, ECS) require HTTP endpoints but lack built-in API infrastructure
- No standard way to route requests to multiple backend services based on path or method
- Integrating with AWS services (DynamoDB, S3, Step Functions) requires custom API code
- Managing API versions and staging environments is manual and error-prone

**Security Problems**:
- Each backend service must implement authentication and authorization independently
- No centralized API key management or rate limiting
- CORS configuration requires custom code in each service
- SSL/TLS certificate management is manual across multiple services

**Scalability Problems**:
- Backend services must scale to handle peak traffic (over-provisioned 90% of the time)
- No built-in request throttling to protect backends from traffic spikes
- Caching requires separate infrastructure (ElastiCache, CloudFront)
- No automatic DDoS protection

**Monitoring and Observability Problems**:
- Request/response logging requires custom implementation in each service
- No centralized metrics for API usage, latency, error rates
- Debugging distributed systems requires correlation IDs and custom tracing
- No built-in request validation or transformation

**API Gateway's Solution**:
- **Two API types**: REST API (full-featured) and HTTP API (71% cheaper, 60% lower latency)
- **Multiple authorization mechanisms**: IAM, Cognito User Pools, Lambda authorizers, JWT authorizers
- **Built-in throttling**: Request rate limiting (requests/second) and burst limits
- **Response caching**: 0.5 GB to 237 GB cache with TTL control
- **Request validation**: Schema-based validation before invoking backend
- **Request/response transformation**: Modify requests and responses without changing backend code
- **CORS support**: Enable cross-origin requests with simple configuration
- **Custom domain names**: Use your own domain (api.example.com) instead of default AWS domain
- **Usage plans and API keys**: Monetize APIs with per-customer throttling and quotas
- **CloudWatch integration**: Automatic metrics (requests, latency, errors, cache hits)
- **X-Ray integration**: Distributed tracing across API Gateway and backend services

API Gateway integrates with Lambda, ALB, EC2, ECS, DynamoDB, S3, Step Functions, and HTTP endpoints to provide a unified API layer.

## REST API vs. HTTP API

AWS offers two types of API Gateway: REST API (full-featured) and HTTP API (optimized for cost and performance).

### Feature Comparison

| Feature | REST API | HTTP API |
|---------|----------|----------|
| **Cost** | $3.50 per million requests | $1.00 per million requests (71% cheaper) |
| **Latency** | Typical | 60% lower latency |
| **Request Size** | Meters by request count | Meters in 512 KB increments |
| **Authorization** | IAM, Cognito, Lambda authorizers, API keys | IAM, Cognito, Lambda authorizers, JWT authorizers |
| **Per-client throttling** | Yes (usage plans + API keys) | No |
| **Request validation** | Yes | No |
| **Request transformation** | Yes (VTL templates) | No |
| **Response caching** | Yes (0.5-237 GB, $0.02-$3.80/hour) | No |
| **AWS WAF integration** | Yes | No |
| **Private endpoints** | Yes (PrivateLink) | No |
| **Usage plans and API keys** | Yes | No |
| **WebSocket** | Separate API type | No |
| **CORS configuration** | Manual (per method) | Automatic (simple config) |
| **Custom domain names** | Yes | Yes (can share with REST APIs) |
| **CloudWatch metrics** | Detailed (caching, errors, latency) | Basic (requests, latency, errors) |
| **X-Ray tracing** | Yes | Yes |

<div class="callout callout--tip">
<p class="callout__title">API Type Selection</p>
<p>Start with HTTP API for cost and latency benefits, then evaluate if you need REST API features like per-client throttling, caching, or WAF integration.</p>
</div>

### When to Use REST API

**Use REST API when you need**:
- **Per-client throttling**: Different rate limits for different API consumers (SaaS tenants, partner tiers)
- **Response caching**: Reduce backend load and improve latency for cacheable responses
- **AWS WAF**: Protect against SQL injection, XSS, and other OWASP Top 10 threats
- **Request validation**: Validate request bodies against JSON Schema before invoking backend
- **Request/response transformation**: Modify payloads without changing backend code
- **Private APIs**: Expose APIs only to VPCs via PrivateLink (no public internet access)
- **Usage plans and API keys**: Monetize APIs with quotas, throttling, and API key management

**Typical use cases**:
- **SaaS APIs**: Multi-tenant APIs with per-customer throttling and quota enforcement
- **Enterprise APIs**: Private APIs accessible only from corporate VPC
- **Public APIs with monetization**: Usage plans for free/basic/pro tiers
- **Legacy integration**: Request/response transformation to integrate with existing systems

### When to Use HTTP API

**Use HTTP API when you need**:
- **Lower cost**: 71% cheaper ($1.00 vs $3.50 per million requests)
- **Lower latency**: 60% faster response times
- **Simple API**: No need for caching, WAF, or advanced features
- **JWT authorization**: Built-in JWT authorizer for OAuth 2.0 or OIDC tokens

**Typical use cases**:
- **Serverless APIs**: Simple Lambda-backed APIs for internal services
- **Microservices**: Low-latency communication between services
- **Prototyping**: Fast development without complex features
- **Mobile/web backends**: OAuth 2.0 or OIDC authentication with JWT tokens

### Decision Framework

**Start with HTTP API if**:
- Cost and latency are primary concerns
- You don't need per-client throttling
- You don't need response caching
- Simple authorization (JWT, Cognito, IAM) is sufficient

**Use REST API if**:
- You need per-client throttling (multi-tenant SaaS)
- You need response caching (high-traffic, cacheable responses)
- You need AWS WAF (public APIs with security threats)
- You need private endpoints (corporate VPC-only access)
- You need request validation or transformation

<div class="callout callout--warning">
<p class="callout__title">Critical Limitation</p>
<p>HTTP APIs lack per-client throttling. Without the ability to throttle per user/tenant, HTTP APIs are not production-ready for SaaS or partner-facing APIs.</p>
</div>

**Cost crossover**: HTTP APIs meter requests in 512 KB increments. For large requests/responses (>1.5 MB), REST APIs may be cheaper. Example: 2 MB request counts as 4 requests for HTTP API ($0.000004) vs. 1 request for REST API ($0.0000035).

## Authorization Mechanisms

### IAM Authorization

**How It Works**:
- Clients sign requests using AWS Signature Version 4 (SigV4)
- API Gateway verifies signature using IAM
- Caller must have IAM permissions for `execute-api:Invoke` action

**Use Case**:
- Internal AWS service-to-service communication
- Temporary credentials via STS
- Cross-account API access

**Example IAM Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/users"
    }
  ]
}
```

**Cost**: Free

**Pros**:
- No additional infrastructure (uses IAM)
- Fine-grained permissions per API method
- Supports temporary credentials (STS, EC2 instance profiles)

**Cons**:
- Clients must have AWS credentials
- Not suitable for public APIs or mobile/web clients

### Cognito User Pool Authorizers

**How It Works**:
- Users authenticate with Cognito User Pool
- Cognito returns JWT access token or ID token
- Client sends token in `Authorization` header
- API Gateway validates token signature against Cognito public key
- If valid, API Gateway invokes backend with user claims

**Use Case**:
- Web and mobile applications with user authentication
- Social login (Google, Facebook, Amazon, Apple)
- Multi-factor authentication (MFA)

**Configuration**:
```json
{
  "authorizationType": "COGNITO_USER_POOLS",
  "authorizerId": "abc123",
  "userPoolArn": "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_ABC123DEF"
}
```

**Cost**:
- API Gateway: Free
- Cognito User Pool: First 50,000 MAUs free, then $0.0055 per MAU

**Pros**:
- Fully managed user directory
- Built-in UI for sign-up, sign-in, password reset
- Social identity providers (Google, Facebook, etc.)
- MFA support (SMS, TOTP)

**Cons**:
- Tied to Cognito (vendor lock-in)
- Limited customization of authentication flow

### JWT Authorizers (HTTP API Only)

**How It Works**:
- Identity provider (Okta, Auth0, Keycloak) issues JWT token
- Client sends token in `Authorization` header
- API Gateway validates token signature, issuer, audience, expiration
- If valid, API Gateway invokes backend with claims

**Use Case**:
- Bring your own identity provider (BYOIDP)
- Enterprise SSO (Okta, Azure AD, Google Workspace)
- OAuth 2.0 or OIDC standard authentication

**Configuration**:
```json
{
  "identitySource": "$request.header.Authorization",
  "issuerUrl": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF",
  "audience": ["client-id-1", "client-id-2"]
}
```

**Cost**: Free

**Pros**:
- No Lambda invocation cost (unlike Lambda authorizers)
- Fast validation (sub-millisecond)
- Works with any OIDC-compliant identity provider

**Cons**:
- HTTP API only (not available for REST API)
- No custom authorization logic (token validation only)

### Lambda Authorizers

**How It Works**:
- Client sends request with authorization token or request parameters
- API Gateway invokes Lambda authorizer function
- Lambda validates credentials (query database, call external service, custom logic)
- Lambda returns IAM policy document (Allow/Deny) and optional context
- API Gateway caches policy for TTL duration (default 300 seconds)

**Authorizer Types**:

**1. TOKEN Authorizer** (REST API):
- Receives bearer token (e.g., JWT, OAuth token) from `Authorization` header
- Lambda validates token and returns IAM policy
- **Use case**: Custom JWT validation, OAuth token introspection

**2. REQUEST Authorizer** (REST API and HTTP API):
- Receives full request context (headers, query strings, path parameters, source IP)
- Lambda validates request and returns IAM policy
- **Use case**: Complex authorization logic, multiple identity sources

**Example Lambda Response**:
```json
{
  "principalId": "user123",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": "execute-api:Invoke",
        "Effect": "Allow",
        "Resource": "arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/users/*"
      }
    ]
  },
  "context": {
    "userId": "user123",
    "userRole": "admin"
  }
}
```

**Caching**:
- Default TTL: 300 seconds (5 minutes)
- Range: 0-3600 seconds
- Cache key: Token (TOKEN authorizer) or configured identity sources (REQUEST authorizer)
- **Critical**: Cached policies apply to all requests with same cache key

**Cost**:
- Lambda invocations: $0.20 per 1 million invocations
- Lambda duration: $0.0000166667 per GB-second
- **Example**: 1 million requests, 128 MB, 100ms, 300s cache = 3,333 invocations × $0.20 = $0.00067

**Pros**:
- Custom authorization logic (query database, call external APIs)
- Works with any authentication mechanism
- Cache reduces invocation costs

**Cons**:
- Adds latency (10-50ms per cold cache)
- Lambda invocation cost (though caching helps)
- Must implement IAM policy logic

**Best Practice**:
- Use REQUEST authorizer (supports multiple identity sources)
- Set appropriate TTL (300s for most use cases, 0s for frequently changing permissions)
- Handle both Allow and Deny explicitly
- Include user context for backend to consume

## Throttling and Rate Limiting

API Gateway implements throttling at multiple levels to protect backend services from traffic spikes.

### Throttling Levels

**1. AWS Account Level** (Default):
- **Rate limit**: 10,000 requests per second across all APIs in account-region
- **Burst limit**: 5,000 concurrent requests
- Cannot be disabled, can be increased via AWS Support

**2. Per-API, Per-Stage Level**:
- Configure custom rate and burst limits for specific API stage
- Overrides account-level limits for that API
- **Use case**: Different limits for prod vs dev stages

**3. Per-Method Level**:
- Configure custom rate and burst limits for specific API method
- Overrides stage-level limits for that method
- **Use case**: Protect expensive operations (e.g., POST /orders)

**4. Per-Client Level** (REST API Only):
- Configure custom rate, burst, and quota limits per API key
- Requires usage plans and API keys
- **Use case**: Multi-tenant SaaS, partner API tiers

### Rate Limit vs. Burst Limit

**Rate Limit** (Steady State):
- Number of requests per second allowed
- Example: 1,000 RPS = 1,000 requests evenly distributed over 1 second

**Burst Limit** (Spike Handling):
- Number of concurrent requests allowed during traffic spikes
- Uses token bucket algorithm
- Example: 2,000 burst limit = handle up to 2,000 requests simultaneously

**Token Bucket Algorithm**:
- Bucket capacity = burst limit (e.g., 2,000 tokens)
- Tokens refill at rate limit per second (e.g., 1,000 tokens/second)
- Each request consumes 1 token
- If bucket empty, request is throttled (429 response)

**Example Scenario**:
- Rate limit: 1,000 RPS
- Burst limit: 2,000
- Normal traffic: 500 RPS → Tokens accumulate (bucket fills to 2,000)
- Traffic spike: 3,000 requests in 1 second
  - First 2,000 requests: Consume all tokens (allowed)
  - Next 1,000 requests: Bucket empty, throttled with 429 error

### Usage Plans and API Keys (REST API Only)

**What They Provide**:
- **Per-client throttling**: Different rate/burst limits for different customers
- **Quotas**: Monthly request limit per customer
- **API key management**: Generate, distribute, revoke API keys

**Configuration**:

**Step 1**: Create API Key
```json
{
  "name": "customer-abc",
  "enabled": true
}
```

**Step 2**: Create Usage Plan
```json
{
  "name": "Gold Plan",
  "throttle": {
    "rateLimit": 5000,
    "burstLimit": 10000
  },
  "quota": {
    "limit": 1000000,
    "period": "MONTH"
  }
}
```

**Step 3**: Associate API Key with Usage Plan

**Step 4**: Client sends API key in header
```
x-api-key: abc123xyz456
```

**Use Case**: SaaS API with tiered pricing
- **Free tier**: 100 RPS, 200 burst, 100,000 requests/month
- **Basic tier**: 1,000 RPS, 2,000 burst, 5 million requests/month
- **Pro tier**: 5,000 RPS, 10,000 burst, 50 million requests/month

**Cost**: Free (no additional charge for usage plans or API keys)

**Limitation**: HTTP APIs do not support usage plans or API keys. Use Lambda authorizers for custom per-client logic.

### Priority Order

API Gateway applies throttling in this order (most specific wins):

1. **Per-client throttling** (usage plan for specific API key)
2. **Per-method throttling** (specific method like GET /users)
3. **Per-stage throttling** (entire API stage)
4. **Per-account throttling** (all APIs in account-region)

### Error Response

When throttled, API Gateway returns:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "message": "Too Many Requests"
}
```

**Best Practice**: Implement exponential backoff with jitter in client applications.

## Response Caching

API Gateway can cache responses to reduce backend load and improve latency.

### How Caching Works

1. Client sends request to API Gateway
2. API Gateway checks cache using cache key
3. **Cache hit**: Return cached response immediately (no backend invocation)
4. **Cache miss**: Invoke backend, cache response, return to client
5. Cached response expires after TTL (time-to-live)

### Cache Configuration

**Cache Size** (REST API only):

| Cache Size | Hourly Cost | Use Case |
|------------|-------------|----------|
| **0.5 GB** | $0.020 | Small APIs (<100 unique endpoints) |
| **1.6 GB** | $0.038 | Medium APIs (100-500 unique endpoints) |
| **6.1 GB** | $0.200 | Large APIs (500-2000 unique endpoints) |
| **13.5 GB** | $0.250 | Very large APIs |
| **28.4 GB** | $0.500 | |
| **58.2 GB** | $1.000 | |
| **118 GB** | $1.600 | |
| **237 GB** | $3.800 | Massive APIs with high cardinality |

**Cache TTL** (Time-to-Live):
- Default: 300 seconds (5 minutes)
- Range: 0-3600 seconds
- Per-method override available

**Cache Key**:
- Default: Request path + query string parameters
- Optional: Include specific headers or path parameters

**Example**:
```
GET /products?category=electronics&page=2
Cache Key: /products?category=electronics&page=2

GET /users/{userId}
Cache Key: /users/123 (userId=123)
```

### Cache Invalidation

**Explicit Invalidation**:
- Per-stage: Invalidate entire cache for API stage
- Requires `InvalidateCache` permission
- **Use case**: Deploy new version, clear stale data

**Client-Initiated Invalidation**:
- Client sends `Cache-Control: max-age=0` header
- Requires `InvalidateCache` permission in IAM policy
- **Use case**: Force fresh data for specific request

**TTL Expiration**:
- Entries expire automatically after TTL
- Most common invalidation mechanism

### Cache Hit Ratio Optimization

**Target**: 70-90% cache hit ratio for optimal cost/performance balance

**Strategies**:

**1. Optimize Cache Key**:
- ❌ Include all query parameters: `/search?q=laptop&sort=price&page=1&timestamp=1234567890`
- ✅ Include only relevant parameters: `/search?q=laptop&sort=price&page=1`

**2. Set Appropriate TTL**:
- Static data (product catalog): 3600 seconds (1 hour)
- Semi-dynamic data (inventory): 300 seconds (5 minutes)
- Dynamic data (user profile): 60 seconds (1 minute)
- Real-time data (stock prices): 0 seconds (no caching)

**3. Use Method Overrides**:
- GET /products: Cache enabled, TTL 3600s
- POST /orders: Cache disabled (non-idempotent)
- GET /users/me: Cache disabled (user-specific)

**4. Monitor Cache Metrics**:
- `CacheHitCount`: Number of cache hits
- `CacheMissCount`: Number of cache misses
- Cache hit ratio = CacheHitCount / (CacheHitCount + CacheMissCount)

### Cost-Benefit Analysis

**Scenario**: API with 10 million requests/month, 80% cache hit ratio

**Without Caching**:
- API Gateway: 10M requests × $3.50 / 1M = $35.00
- Lambda invocations: 10M × $0.20 / 1M = $2.00
- **Total: $37.00**

**With Caching** (0.5 GB cache):
- API Gateway: 10M requests × $3.50 / 1M = $35.00
- Cache: $0.020/hour × 730 hours = $14.60
- Lambda invocations: 2M (20% cache miss) × $0.20 / 1M = $0.40
- **Total: $50.00**

**Analysis**: Caching costs $13/month more but reduces Lambda invocations by 80% and improves latency from ~100ms to ~10ms. Worth it for high-traffic APIs with performance requirements.

**Breakeven**: Caching becomes cost-effective when backend costs saved exceed cache costs. For expensive backends (EC2, RDS queries), caching saves money. For cheap backends (Lambda), caching improves latency but may increase costs.

## Integration Patterns

### Lambda Function Integration

**Proxy Integration** (Recommended):
- API Gateway passes entire request to Lambda as JSON event
- Lambda returns response with status code, headers, body
- No mapping templates required

**Example Lambda Response**:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"message\":\"Hello World\"}"
}
```

**Custom Integration**:
- API Gateway transforms request using VTL (Velocity Template Language)
- Lambda receives transformed input
- API Gateway transforms Lambda response
- **Use case**: Legacy Lambdas with non-standard response format

**Cost**: Lambda invocations only (no additional API Gateway cost)

### HTTP Endpoint Integration

**Proxy Integration**:
- API Gateway forwards request to HTTP endpoint
- HTTP endpoint returns response
- No transformation

**Example**: Proxy to legacy API at `https://api.example.com`
```
GET /users → https://api.example.com/users
POST /orders → https://api.example.com/orders
```

**Use Case**: Fronting existing REST APIs with API Gateway for throttling, caching, authorization

### AWS Service Integration

**Direct Integration** (No Lambda):
- API Gateway invokes AWS services directly
- Supported services: DynamoDB, S3, Step Functions, SNS, SQS, Kinesis
- Use mapping templates to transform request/response

**Example**: PUT object to S3
```
PUT /files/{filename}
→ S3 PutObject (Bucket=my-bucket, Key={filename}, Body=request.body)
```

**Use Case**: Simple CRUD operations without Lambda overhead

**Cost Savings**: Eliminates Lambda invocation cost ($0.20 per million requests)

### VPC Link Integration (REST API)

**Private Integration**:
- API Gateway connects to resources in VPC via VPC Link
- Resources: ALB, NLB, EC2, ECS (private subnets)
- No public IP required on backend

**Architecture**:
```
Client → API Gateway → VPC Link → NLB → ECS Tasks (private subnet)
```

**Cost**:
- VPC Link: $0.01 per hour + $0.01 per GB processed
- **Example**: 100 GB/month = $7.30 (VPC Link) + $1.00 (data transfer) = $8.30/month

**Use Case**: Expose private microservices to internet via API Gateway without public IPs

## Cost Optimization Strategies

### 1. Use HTTP API for Simple Use Cases

**Savings**: 71% cost reduction ($1.00 vs $3.50 per million requests)

**When Applicable**:
- No need for per-client throttling
- No need for response caching
- No need for AWS WAF
- Simple authorization (JWT, Cognito, IAM)

**Example**:
- Before (REST API): 100M requests × $3.50 / 1M = $350/month
- After (HTTP API): 100M requests × $1.00 / 1M = $100/month
- **Savings: $250/month (71% reduction)**

### 2. Enable Caching for High-Traffic Cacheable Endpoints

**When Cost-Effective**:
- Backend invocation cost > cache cost
- High cache hit ratio (>70%)
- Expensive backend operations (database queries, external API calls)

**Example**:
- 50M requests/month to product catalog API
- 90% cache hit ratio
- Lambda cost: $0.000002 per invocation

**Without Cache**:
- Lambda: 50M × $0.000002 = $100/month

**With Cache** (1.6 GB, $0.038/hour):
- Cache: $0.038 × 730 = $27.74/month
- Lambda: 5M (10% miss) × $0.000002 = $10/month
- **Total: $37.74/month (62% savings)**

### 3. Implement Request Batching

**Reduce Request Count**:
- Instead of 100 individual requests, send 1 batch request with 100 items
- API Gateway charges per request, not per item processed

**Example**:
```
❌ Before: 100 requests × $3.50 / 1M = $0.00035
✅ After: 1 batch request × $3.50 / 1M = $0.0000035
Savings: 99% per batch
```

**Caveat**: HTTP API meters in 512 KB increments. Large batches may cost more.

### 4. Set Appropriate Throttling Limits

**Prevent Unexpected Costs**:
- Throttling limits protect against traffic spikes from DDoS or misbehaving clients
- Without limits, API Gateway scales infinitely (and costs scale linearly)

**Example**:
- Normal traffic: 1,000 RPS
- DDoS attack: 100,000 RPS for 1 hour
- Without throttling: 360M requests × $3.50 / 1M = $1,260 (unexpected cost)
- With throttling (10,000 RPS): 36M requests × $3.50 / 1M = $126
- **Savings: $1,134 (90% reduction)**

### 5. Optimize Data Transfer with Compression

**Enable Compression**:
- API Gateway supports gzip compression for responses >1 KB
- Client sends `Accept-Encoding: gzip` header
- API Gateway compresses response automatically

**Savings**:
- JSON responses compress 60-80%
- Data transfer: $0.09 per GB
- **Example**: 100 GB uncompressed → 20 GB compressed = $7.20/month savings

### 6. Use Regional Endpoints When Possible

**Endpoint Types**:
- **Edge-Optimized** (default): Requests routed through CloudFront edge locations (global)
- **Regional**: Requests go directly to API Gateway in region (no CloudFront)
- **Private**: Accessible only from VPC (no internet access)

**Cost Consideration**:
- Edge-Optimized: No additional CloudFront charges for API Gateway traffic
- Regional: Slightly lower latency for clients in same region
- Private: Lowest latency, no data transfer charges within VPC

**Use Regional When**:
- All clients in same region as API (no benefit from CloudFront)
- Want to use own CloudFront distribution for advanced caching

### 7. Monitor and Right-Size Cache

**Avoid Over-Provisioning**:
- Start with 0.5 GB cache ($0.020/hour = $14.60/month)
- Monitor `CacheMissCount` due to cache evictions
- Increase cache size only if eviction rate is high (>10%)

**Example**:
- Provisioned 13.5 GB cache ($0.250/hour = $182.50/month) "just in case"
- Actual usage: 2 GB
- Right-size to 6.1 GB ($0.200/hour = $146/month)
- **Savings: $36.50/month (20% reduction)**

## Common Pitfalls and How to Avoid Them

### 1. Using HTTP API for Multi-Tenant SaaS Without Per-Client Throttling

**Problem**: HTTP API lacks per-client throttling. Single abusive tenant can exhaust entire API capacity.

**Example**: SaaS API with 100 tenants. Tenant A sends 10,000 RPS (misbehaving or DDoS). Other 99 tenants get throttled (429 errors) because account-level limit is 10,000 RPS.

**Impact**: Service outage for 99% of customers, reputation damage, potential revenue loss.

**Solution**:
- Use REST API with usage plans for per-client throttling
- Or: Implement custom throttling in Lambda authorizer (query DynamoDB for tenant rate limits)

**Cost Impact**: REST API costs $3.50/M vs HTTP API $1.00/M, but prevents multi-tenant outages worth $10,000-$100,000+ in lost revenue.

### 2. Not Setting Method-Level Throttling for Expensive Operations

**Problem**: All API methods share same throttle limit. Expensive operations (e.g., generate report) can starve cheap operations (e.g., health check).

**Example**:
- API has 10,000 RPS limit
- `POST /reports/generate` takes 30 seconds to complete
- Clients send 500 RPS to `/reports/generate`
- 500 concurrent requests × 30 seconds = blocks 15,000 slots (exceeds 10,000 RPS limit)
- Other endpoints get throttled

**Impact**: API unavailable for all operations due to one expensive endpoint.

**Solution**:
- Set method-level throttle for `POST /reports/generate`: 100 RPS, 200 burst
- Reserve capacity for other endpoints

**Configuration**:
```json
{
  "POST /reports/generate": {
    "throttle": {
      "rateLimit": 100,
      "burstLimit": 200
    }
  }
}
```

**Cost Impact**: Prevents API outages costing $1,000-$10,000/hour in lost transactions.

### 3. Caching User-Specific Data Without Including User ID in Cache Key

**Problem**: Response cached for User A is returned to User B (data leakage).

**Example**:
- API endpoint: `GET /users/me` (returns current user profile)
- Cache key: `/users/me` (default, no user ID)
- User A requests `/users/me`, API Gateway caches response
- User B requests `/users/me`, API Gateway returns User A's cached profile

**Impact**: **Critical security vulnerability**, GDPR violation, user data exposed.

**Solution**:
- Disable caching for user-specific endpoints
- Or: Include `Authorization` header in cache key (each user gets separate cache entry)

**Configuration**:
```json
{
  "GET /users/me": {
    "caching": {
      "enabled": false
    }
  }
}
```

**Cost Impact**: Data breach fines (GDPR: up to €20M or 4% of global revenue) far exceed any caching cost savings.

### 4. Not Implementing Exponential Backoff for 429 Errors

**Problem**: Clients retry immediately after 429 (Too Many Requests), amplifying load and extending throttling.

**Example**:
- Client sends 15,000 requests in 1 second (exceeds 10,000 RPS limit)
- API Gateway throttles 5,000 requests (429 response)
- Client retries all 5,000 immediately
- API Gateway throttles again (429 response)
- Retry storm continues for minutes

**Impact**: Extended API outage, backend overwhelmed by retry traffic.

**Solution**:
- Implement exponential backoff with jitter in client
- Example: First retry after 1s, second after 2s, third after 4s, fourth after 8s (max 60s)

**Example Implementation** (C#):
```csharp
int maxRetries = 5;
int baseDelay = 1000; // 1 second

for (int i = 0; i < maxRetries; i++)
{
    HttpResponseMessage response = await client.GetAsync("/api/users");

    if (response.StatusCode != HttpStatusCode.TooManyRequests)
    {
        return response; // Success or non-throttling error
    }

    // Exponential backoff with jitter
    int delay = baseDelay * (int)Math.Pow(2, i);
    int jitter = Random.Shared.Next(0, 1000); // 0-1000ms jitter
    await Task.Delay(delay + jitter);
}
```

**Cost Impact**: Reduces retry storm traffic by 80-95%, prevents extended outages.

### 5. Not Monitoring Cache Hit Ratio

**Problem**: Paying for cache but hit ratio is low (30-50%), wasting money.

**Example**:
- Provisioned 6.1 GB cache ($0.200/hour = $146/month)
- Cache hit ratio: 40%
- Most responses not cacheable or TTL too short

**Impact**: $146/month cache cost with minimal benefit.

**Solution**:
- Monitor `CacheHitCount` and `CacheMissCount` in CloudWatch
- Target >70% hit ratio
- If hit ratio low:
  - Increase TTL for cacheable endpoints
  - Disable cache for non-cacheable endpoints
  - Optimize cache key to reduce cardinality

**Cost Impact**: Disable underutilized cache saves $146/month. Optimize cache key increases hit ratio from 40% to 80%, doubling backend savings.

### 6. Using REST API When HTTP API Would Suffice

**Problem**: Paying 3.5x more for REST API features you don't use.

**Example**:
- Simple Lambda-backed API for internal microservices
- No caching, WAF, usage plans, or request transformation
- 50M requests/month

**Cost**:
- REST API: 50M × $3.50 / 1M = $175/month
- HTTP API: 50M × $1.00 / 1M = $50/month
- **Wasted: $125/month (71%)**

**Solution**:
- Audit REST API features in use
- Migrate to HTTP API if only using basic features (IAM, Cognito, Lambda integration)

**Migration Path**:
1. Create HTTP API with same routes
2. Update DNS to point to HTTP API
3. Monitor for errors
4. Delete REST API after validation

**Cost Impact**: Save $125/month × 12 = $1,500/year for single API.

### 7. Not Setting TTL=0 for Non-Cacheable Endpoints

**Problem**: API Gateway caches POST/PUT/DELETE responses, causing stale data.

**Example**:
- `POST /orders` creates order and returns order confirmation
- Response cached for default 300 seconds
- User creates order, gets cached response from previous order (wrong order ID)

**Impact**: Users see incorrect data, customer support burden, potential refunds.

**Solution**:
- Set TTL=0 for non-idempotent methods (POST, PUT, PATCH, DELETE)
- Only cache GET requests

**Configuration**:
```json
{
  "POST /*": {
    "caching": {
      "ttl": 0
    }
  }
}
```

**Cost Impact**: Free (no cost to disable caching). Prevents customer support issues worth $500-$2,000/incident.

### 8. Not Using Lambda Authorizer Caching

**Problem**: Lambda authorizer invoked for every request, adding latency and cost.

**Example**:
- API receives 10M requests/month
- Lambda authorizer: 128 MB, 100ms
- No caching (TTL=0)

**Cost**:
- Lambda invocations: 10M × $0.20 / 1M = $2.00
- Lambda duration: 10M × 0.1s × 128 MB / 1024 MB × $0.0000166667 = $2.08
- **Total: $4.08/month**

**With Caching** (TTL=300s):
- Unique users: 100,000
- Average requests per user: 100
- Cache hit ratio: 99% (only first request per user invokes Lambda)
- Lambda invocations: 100,000 × $0.20 / 1M = $0.02
- **Total: $0.04/month**
- **Savings: $4.04/month (99% reduction)**

**Solution**:
- Set TTL=300 seconds (5 minutes) for most use cases
- Set TTL=0 only for frequently changing permissions (admin role changes)

**Cost Impact**: Save 99% on Lambda authorizer costs. Also reduces latency from 100ms to <1ms for cached requests.

### 9. Not Validating Request Bodies Before Invoking Backend

**Problem**: Invalid requests reach backend, consuming compute resources and returning generic errors.

**Example**:
- API endpoint: `POST /users` (create user)
- Required fields: email, password, name
- Client sends invalid request: `{"email": "not-an-email"}`
- Backend Lambda invoked, validates request, returns 400 error
- Lambda cost: $0.000002 per invocation

**Impact**: 10M invalid requests/month × $0.000002 = $20/month wasted on invalid requests. Backend overload during attack scenarios.

**Solution** (REST API):
- Enable request validation with JSON Schema
- API Gateway returns 400 error before invoking backend

**Example Schema**:
```json
{
  "type": "object",
  "required": ["email", "password", "name"],
  "properties": {
    "email": {"type": "string", "format": "email"},
    "password": {"type": "string", "minLength": 8},
    "name": {"type": "string", "minLength": 1}
  }
}
```

**Cost Impact**: Save $20/month on invalid request processing. Prevent backend overload during attacks.

**Limitation**: HTTP API does not support request validation. Use Lambda for validation or accept invalid requests.

### 10. Using Edge-Optimized Endpoint for Regional Traffic

**Problem**: All traffic routed through CloudFront even when clients and API are in same region, adding latency.

**Example**:
- API deployed in `us-east-1`
- All clients in `us-east-1`
- Edge-Optimized endpoint routes traffic through CloudFront (adds 5-10ms latency)

**Impact**: 10ms added latency for every request, no benefit from CloudFront.

**Solution**:
- Use Regional endpoint for region-specific traffic
- Use Edge-Optimized for global traffic

**Latency Comparison**:
- Edge-Optimized: 20-30ms (CloudFront + API Gateway)
- Regional: 10-15ms (API Gateway only)
- **Improvement: 30-50% latency reduction**

**Cost Impact**: No direct cost savings, but latency improvement worth considering for performance-sensitive applications.

### 11. Not Using Custom Domain Names

**Problem**: Clients hardcode default API Gateway URL (`abcdef123.execute-api.us-east-1.amazonaws.com`). Difficult to migrate or change APIs.

**Example**:
- Mobile app hardcodes default URL in code
- Want to migrate from REST API to HTTP API (different URL)
- Must release new mobile app version, wait for user adoption (weeks to months)

**Impact**: Vendor lock-in, slow migration, dual-run APIs during transition (2x cost).

**Solution**:
- Use custom domain name from day 1 (api.example.com)
- Change backend API without changing client code
- Instant cutover via DNS

**Cost**:
- Custom domain: Free (API Gateway)
- ACM certificate: Free
- Route 53 hosted zone: $0.50/month

**Cost Impact**: $0.50/month vs. dual-running APIs for 3 months ($300-$1,000 extra costs).

### 12. Not Enabling CloudWatch Logs for Debugging

**Problem**: API errors occur, no logs to debug. Blind troubleshooting wastes engineering time.

**Example**:
- API returns 500 errors for some requests
- No CloudWatch logs enabled
- Must reproduce issue locally, add logging, redeploy (2-4 hour debugging cycle)

**Impact**: 2-4 hours engineering time ($200-$800 at $100/hour).

**Solution**:
- Enable CloudWatch Logs for API Gateway (INFO or ERROR level)
- Logs include request/response, integration latency, Lambda invocation details

**Cost**:
- CloudWatch Logs: $0.50 per GB ingested
- Typical API: 1-5 GB/month = $0.50-$2.50/month

**Cost Impact**: $2.50/month logging vs. $200-$800 debugging time per incident. **ROI: 100x+**

### 13. Not Using X-Ray for Distributed Tracing

**Problem**: Difficult to identify latency bottlenecks in multi-service architectures.

**Example**:
- API Gateway → Lambda → DynamoDB → S3
- Total latency: 500ms
- Don't know which service is slow

**Impact**: Over-provision all services (2x cost) to ensure fast responses.

**Solution**:
- Enable X-Ray tracing on API Gateway, Lambda, DynamoDB
- Visualize service map, identify slow service (e.g., DynamoDB 400ms, others <50ms)
- Optimize DynamoDB (add index, increase capacity)

**Cost**:
- X-Ray: $5 per 1 million traces recorded, $0.50 per 1 million traces retrieved
- **Example**: 10M requests/month = $50 (recording) + $5 (retrieval) = $55/month

**Cost Impact**: $55/month tracing vs. $500/month over-provisioning. **Savings: $445/month**

### 14. Not Implementing CORS Correctly

**Problem**: Browser blocks API requests due to missing CORS headers. Front-end developers blame API.

**Example**:
- Web app at `https://app.example.com` calls API at `https://api.example.com`
- API doesn't return CORS headers
- Browser blocks request with CORS error

**Impact**: API appears broken to front-end, 1-2 day debugging cycle.

**Solution (HTTP API, Simple)**:
```json
{
  "cors": {
    "allowOrigins": ["https://app.example.com"],
    "allowMethods": ["GET", "POST", "PUT", "DELETE"],
    "allowHeaders": ["Content-Type", "Authorization"],
    "maxAge": 86400
  }
}
```

**Solution (REST API, Manual)**:
- Enable CORS on each method
- API Gateway adds OPTIONS method automatically
- Returns `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.

**Cost Impact**: Free. Prevents 1-2 day debugging cycles worth $800-$1,600 engineering time.

### 15. Not Setting Appropriate API Gateway Timeout

**Problem**: Default timeout is 29 seconds (max). Long-running operations time out, client receives 504 Gateway Timeout.

**Example**:
- API endpoint generates PDF report (takes 45 seconds)
- API Gateway times out after 29 seconds
- Client receives 504 error, report generation continues in background (wasted compute)

**Impact**: User sees error, retries, multiple reports generated, wasted backend resources.

**Solution**:
- Use asynchronous pattern for long-running operations
- API returns 202 Accepted with job ID immediately
- Client polls for completion
- Backend uses Step Functions, SQS, or Lambda async invocation

**Example**:
```
1. POST /reports → 202 Accepted {"jobId": "abc123"}
2. GET /reports/abc123 → 200 OK {"status": "in_progress"}
3. GET /reports/abc123 → 200 OK {"status": "completed", "url": "s3://..."}
```

**Cost Impact**: Eliminates duplicate processing from retries. Improves user experience (no timeout errors).

## Key Takeaways

**API Type Selection**:
- **Use HTTP API** for 71% cost savings and 60% lower latency when you don't need advanced features
- **Use REST API** for per-client throttling (multi-tenant SaaS), response caching, AWS WAF, request validation, or private endpoints
- **Critical**: HTTP API lacks per-client throttling, making it unsuitable for production multi-tenant SaaS without custom throttling logic

**Authorization Strategy**:
- **IAM**: Internal AWS service-to-service communication (free)
- **Cognito User Pools**: Web/mobile apps with user authentication ($0.0055 per MAU after 50K free)
- **JWT Authorizers** (HTTP API): Bring your own identity provider (free, fast)
- **Lambda Authorizers**: Custom logic, any authentication mechanism (caching critical for cost/latency)

**Throttling Best Practices**:
- Set account-level limits to prevent unexpected costs during DDoS
- Use method-level throttling for expensive operations
- Use per-client throttling (usage plans) for multi-tenant SaaS
- Implement exponential backoff with jitter in clients

**Caching Strategy**:
- Enable caching when backend cost > cache cost and cache hit ratio >70%
- Start with 0.5 GB cache ($14.60/month), monitor eviction rate, right-size
- Set TTL=0 for POST/PUT/DELETE, TTL=300-3600 for GET
- Never cache user-specific data without including user ID in cache key

**Cost Optimization**:
- HTTP API saves 71% vs REST API ($1.00 vs $3.50 per million requests)
- Caching reduces backend invocations by 70-90% (saves Lambda costs)
- Compression reduces data transfer by 60-80% ($0.09 per GB)
- Throttling prevents DDoS-induced cost spikes (can save $1,000+ per incident)
- Request validation eliminates invalid request processing costs

**Integration Patterns**:
- **Lambda Proxy Integration**: Most common, pass entire request to Lambda
- **HTTP Endpoint Integration**: Front existing APIs with API Gateway
- **AWS Service Integration**: Direct DynamoDB/S3/SQS integration without Lambda
- **VPC Link**: Expose private VPC resources via API Gateway

**Monitoring and Debugging**:
- Enable CloudWatch Logs (INFO level) for debugging ($0.50-$2.50/month)
- Enable X-Ray tracing for distributed systems ($55/month saves $445 in over-provisioning)
- Monitor cache hit ratio, throttle rates, latency, error rates
- Set alarms for 4XX/5XX error rates, latency spikes

**When NOT to Use API Gateway**:
- Very low traffic (<1000 requests/day) where $3.50-$100/month is significant
- Internal microservices with service mesh (use Envoy/Istio instead)
- WebSocket-only applications (use AppSync or ALB WebSocket support)
- Streaming or long-polling (API Gateway has 29s timeout limit)
