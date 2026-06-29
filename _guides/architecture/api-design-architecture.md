---
title: "API Design & Architecture"
layout: guide
category: Architecture
subcategory: Design
description: "Comprehensive guide to designing, architecting, and evolving APIs for distributed systems including REST, GraphQL, versioning strategies, and API governance"
tags: [architecture, api-design, rest, graphql, integration, microservices, design-patterns, practical]
---

## What is API Design & Architecture?

API (Application Programming Interface) design is the practice of creating stable, maintainable contracts between software components. API architecture addresses how APIs integrate into broader system design, including versioning, security, governance, and evolution over time.

<blockquote class="pull-quote">
<p>APIs are architectural boundaries. They define how systems communicate, what data they exchange, and how dependencies propagate. Poor API design creates technical debt that cascades through every service that consumes it.</p>
</blockquote>

## Core API Design Principles

### Contract-First Design

Design the API contract before implementing either client or server. This forces clarity about what the API actually does and prevents implementation details from leaking into the interface.

**Why it matters**: When you implement first and design second, the API reflects internal data structures rather than client needs. This creates brittle coupling that's expensive to fix later.

**How to do this well**:
- Write the API specification (OpenAPI, GraphQL schema, Protocol Buffers) first
- Review the contract with stakeholders and consumers before writing code
- Use the specification to generate client SDKs and server stubs
- Validate requests/responses against the spec in tests

**Example**: An e-commerce API designed contract-first defines `GET /orders/{orderId}` returning a consistent Order schema. Implementation-first might expose `GET /order_data` returning internal database columns, requiring clients to understand your data model.

### Stability Over Flexibility

API contracts must be stable. Breaking changes force all clients to update simultaneously, creating coordination overhead and deployment risk. Prefer extending APIs over modifying them.

<div class="callout callout--warning">
<p class="callout__title">API Stability Rules</p>
<p><strong>Never</strong>:</p>
<ul>
<li>Remove fields or endpoints without deprecation process</li>
<li>Change field types or semantics</li>
<li>Make optional fields required</li>
<li>Change error response structures</li>
</ul>
<p><strong>Always</strong>:</p>
<ul>
<li>Add new fields as optional</li>
</ul>
</div>

### Resource-Oriented vs Operation-Oriented

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Resource-Oriented (REST)</h4>
<ul>
<li>Models domain as resources (nouns)</li>
<li>Standard operations: GET, POST, PUT, DELETE</li>
<li>Works well for entities and CRUD</li>
<li>Example: GET /orders/{id}</li>
<li>Leverages HTTP semantics</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Operation-Oriented (RPC-style)</h4>
<ul>
<li>Models domain as operations (verbs)</li>
<li>Custom operations for workflows</li>
<li>Works well for complex business logic</li>
<li>Example: POST /orders/{id}/cancel</li>
<li>More explicit about intent</li>
</ul>
</div>
</div>

Neither is universally better, so choose based on your domain. Most systems use both: resource-oriented for data access and operation-oriented for workflows.

## REST API Design

### Resource Modeling

Resources are the fundamental abstraction in REST. A resource is any information that can be named: a document, an image, a user, an order.

**Resource naming conventions**:
- Use nouns, not verbs (`/orders` not `/getOrders`)
- Use plural nouns for collections (`/users`, `/products`)
- Use hierarchical paths for relationships (`/users/{userId}/orders`)
- Use lowercase, hyphen-separated words (`/order-items` not `/orderItems`)

**Common resource patterns**:

| Pattern | Example | Use Case |
|---------|---------|----------|
| Collection | `GET /orders` | List all resources |
| Single resource | `GET /orders/{orderId}` | Retrieve specific resource |
| Sub-collection | `GET /users/{userId}/orders` | Related resources scoped by parent |
| Singleton | `GET /account/profile` | Single resource without collection |
| Controller resource | `POST /orders/{orderId}/cancel` | Complex operations that don't fit CRUD |

### HTTP Method Semantics

Use HTTP methods according to their defined semantics:

| Method | Semantics | Safe? | Idempotent? | Use For |
|--------|-----------|-------|-------------|---------|
| GET | Retrieve representation | Yes | Yes | Reading data |
| POST | Create subordinate resource | No | No | Creating resources, non-idempotent operations |
| PUT | Replace resource | No | Yes | Full updates, idempotent creates |
| PATCH | Partial update | No | No | Partial updates |
| DELETE | Remove resource | No | Yes | Deleting resources |
| HEAD | GET without body | Yes | Yes | Checking existence, metadata |
| OPTIONS | Describe capabilities | Yes | Yes | CORS preflight, capability discovery |

**Safe**: No side effects on the server (read-only).
**Idempotent**: Multiple identical requests produce the same result as a single request.

**Why idempotency matters**: Networks are unreliable. Clients often retry requests. Idempotent operations can be safely retried without duplicating side effects.

### Status Code Conventions

Use HTTP status codes to communicate operation outcomes:

**Success codes**:
- `200 OK`: Request succeeded (GET, PUT, PATCH with response body)
- `201 Created`: Resource created (POST)
- `202 Accepted`: Request accepted for async processing
- `204 No Content`: Success with no response body (DELETE, PUT)

**Client error codes**:
- `400 Bad Request`: Invalid syntax or validation failure
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Request conflicts with current state (e.g., duplicate, version mismatch)
- `422 Unprocessable Entity`: Syntax valid but semantic validation failed
- `429 Too Many Requests`: Rate limit exceeded

**Server error codes**:
- `500 Internal Server Error`: Unexpected server failure
- `502 Bad Gateway`: Upstream service failure
- `503 Service Unavailable`: Temporary unavailability (overload, maintenance)
- `504 Gateway Timeout`: Upstream service timeout

**Be consistent**: Use the same status code for the same condition across your entire API.

### Error Response Design

Provide structured error responses that help clients handle failures:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields failed validation",
    "details": [
      {
        "field": "email",
        "message": "Email address is invalid"
      },
      {
        "field": "age",
        "message": "Must be 18 or older"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

**Essential error fields**:
- **code**: Machine-readable error identifier (stable, never changes)
- **message**: Human-readable description (can change for clarity)
- **details**: Specific validation failures or context
- **request_id**: Correlation ID for debugging
- **timestamp**: When the error occurred

### Pagination Patterns

APIs returning collections must paginate to prevent unbounded response sizes.

**Offset-based pagination** (simple but has consistency issues):
```
GET /orders?limit=20&offset=40
```

**Cursor-based pagination** (consistent but opaque):
```
GET /orders?limit=20&cursor=eyJpZCI6MTIzfQ
```

**Response format**:
```json
{
  "data": [...],
  "pagination": {
    "total": 1247,
    "limit": 20,
    "offset": 40,
    "next": "/orders?limit=20&offset=60",
    "previous": "/orders?limit=20&offset=20"
  }
}
```

**Cursor-based is preferred for large datasets** where consistency matters. New items inserted during pagination don't cause duplicate results or skipped items.

### Filtering, Sorting, and Searching

Provide query parameters for filtering and sorting collections:

**Filtering**:
```
GET /orders?status=pending&customer_id=123
GET /products?price_min=10&price_max=100
```

**Sorting**:
```
GET /orders?sort=created_at:desc,total:asc
```

**Searching** (full-text across multiple fields):
```
GET /products?q=laptop
```

**Field selection** (reduce response size):
```
GET /orders?fields=id,status,total
```

**Guidelines**:
- Document which fields support filtering and the allowed operators
- Support combining filters with AND semantics
- Use standard parameter names (`sort`, `q`, `fields`)
- Validate filter values and return 400 for invalid queries

## GraphQL Design

### When to Use GraphQL

<div class="comparison">
<div class="content-card content-card--accent">
<h4>GraphQL Works Well When</h4>
<ul>
<li>Clients need flexible queries across multiple resources</li>
<li>Over-fetching or under-fetching is a performance problem</li>
<li>Diverse client types (mobile, web, partners) with different data needs</li>
<li>Schema evolution and introspection are valuable</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>REST Works Better When</h4>
<ul>
<li>Simple CRUD dominates</li>
<li>Caching with HTTP semantics is critical</li>
<li>Operations are naturally resource-oriented</li>
<li>Tooling and organizational expertise favor REST</li>
</ul>
</div>
</div>

<div class="callout callout--warning">
<p class="callout__title">Common Mistake</p>
<p>Using GraphQL for everything. GraphQL adds complexity. Use it when flexibility justifies the cost.</p>
</div>

### Schema Design Principles

GraphQL schemas define types, fields, and relationships. Design schemas around client use cases, not database structure.

**Example schema**:
```graphql
type Query {
  order(id: ID!): Order
  orders(status: OrderStatus, limit: Int, cursor: String): OrderConnection!
}

type Order {
  id: ID!
  status: OrderStatus!
  total: Money!
  items: [OrderItem!]!
  customer: Customer!
  createdAt: DateTime!
}

type OrderItem {
  product: Product!
  quantity: Int!
  price: Money!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

type Money {
  amount: Decimal!
  currency: String!
}
```

**Schema design guidelines**:
- Use strong typing (non-null `!` where appropriate)
- Model domain concepts, not database tables
- Use enums for fixed value sets
- Provide pagination for lists (connections pattern)
- Use scalar types for domain primitives (Money, DateTime, Email)

### Mutations and Side Effects

Mutations modify server state. Design mutations to be explicit about inputs and outputs.

```graphql
type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  cancelOrder(orderId: ID!): CancelOrderPayload!
}

input CreateOrderInput {
  items: [OrderItemInput!]!
  shippingAddress: AddressInput!
  paymentMethod: PaymentMethodInput!
}

type CreateOrderPayload {
  order: Order
  userErrors: [UserError!]!
}

type UserError {
  field: String
  message: String!
}
```

**Mutation design patterns**:
- Use input types for mutation arguments
- Return payload types that include both success data and errors
- Support partial success (some items succeeded, others failed)
- Make mutations idempotent where possible

### Resolver Design

Resolvers fetch data for each field. Poor resolver design causes N+1 query problems.

**N+1 problem example**:
```graphql
query {
  orders {
    id
    customer { name }  # Triggers separate query per order
  }
}
```

**Solution: Use DataLoader** for batching and caching:
- Batches multiple requests into single database query
- Caches results within a single request
- Prevents duplicate fetches for the same ID

**Resolver performance guidelines**:
- Implement DataLoader for all relational lookups
- Limit query depth to prevent abuse
- Implement query cost analysis
- Consider persisted queries for production

## API Versioning Strategies

APIs must evolve without breaking existing clients. Versioning strategies manage this evolution.

### URI Versioning

Include version in the URL path:
```
GET /v1/orders
GET /v2/orders
```

**Pros**:
- Explicit and visible
- Easy to route to different implementations
- Clear in logs and monitoring

**Cons**:
- Versions entire API surface (can't version individual resources)
- URL changes break bookmarks and links

### Header Versioning

Specify version in HTTP header:
```
GET /orders
Accept: application/vnd.company.v2+json
```

**Pros**:
- URLs stay stable
- Can version individual resources
- Follows REST principles

**Cons**:
- Less visible (harder to discover in docs)
- Tooling support varies

### Content Negotiation

Use `Accept` header to request different representations:
```
Accept: application/json; version=2
Accept: application/vnd.company.order.v2+json
```

**Pros**:
- Fine-grained control
- Standard HTTP mechanism

**Cons**:
- Complex to implement and document
- Client libraries may not support easily

### Query Parameter Versioning

Pass version as query parameter:
```
GET /orders?version=2
```

**Pros**:
- Simple for clients
- Visible in URLs

**Cons**:
- Pollutes query parameter namespace
- Can conflict with filtering/pagination

### Recommendation: URI Versioning for Major Versions

<div class="callout callout--tip">
<p class="callout__title">Best Practice: URI Versioning</p>
<p><strong>Use URI versioning for major versions</strong> (<code>/v1/</code>, <code>/v2/</code>) when breaking changes occur. Between major versions, make backward-compatible changes only:</p>
<ul>
<li>Add optional fields</li>
<li>Add new endpoints</li>
<li>Add new query parameters with defaults</li>
<li>Deprecate fields (mark deprecated but don't remove)</li>
</ul>
<p><strong>Major version increment triggers</strong>:</p>
<ul>
<li>Removing endpoints or fields</li>
<li>Changing field types or semantics</li>
<li>Changing authentication mechanisms</li>
<li>Changing error response format</li>
</ul>
<p><strong>Goal</strong>: Stay on a single major version as long as possible. Each additional version is code you must maintain.</p>
</div>

## API Security

### Authentication Mechanisms

| Mechanism | Use Case | Pros | Cons |
|-----------|----------|------|------|
| API Keys | Server-to-server, simple clients | Simple, widely supported | No user identity, hard to rotate |
| OAuth 2.0 | User authorization, third-party access | Standard, supports delegated access | Complex, many flows to choose from |
| JWT | Stateless authentication | Self-contained, scales well | Token revocation is hard |
| mTLS | High-security service-to-service | Strong mutual authentication | Complex certificate management |

**Common patterns**:
- **Public APIs**: OAuth 2.0 for user authorization
- **Internal APIs**: JWT or mTLS
- **Partner APIs**: API keys with allowlisting
- **Mobile/Web apps**: OAuth 2.0 with PKCE

### Authorization Models

**API-level authorization**: Control access to entire endpoints.

**Resource-level authorization**: Control access to specific resources (e.g., user can only access their own orders).

**Field-level authorization**: Control access to specific fields (e.g., hide sensitive data from certain roles).

**Implementation pattern**:
```
1. Authenticate: Verify who is making the request
2. Authorize: Check if they can perform this action
3. Filter: Return only data they're allowed to see
```

### Rate Limiting and Throttling

Protect APIs from abuse and ensure fair usage.

**Rate limiting strategies**:
- **Per-user limits**: 1000 requests/hour per API key
- **Per-endpoint limits**: 10 requests/second for expensive operations
- **Burst allowances**: Allow short bursts above average rate

**Response headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 743
X-RateLimit-Reset: 1642244400
```

**When limit exceeded**: Return `429 Too Many Requests` with `Retry-After` header.

**Algorithms**:
- **Token bucket**: Allow bursts, smooth long-term rate
- **Leaky bucket**: Enforce steady rate, reject bursts
- **Fixed window**: Simple but allows double-rate at window boundaries
- **Sliding window**: Fair but more complex

### Input Validation

Validate all inputs at the API boundary. Never trust client data.

**Validation layers**:
1. **Syntax validation**: Parse JSON/XML, check types
2. **Schema validation**: Validate against API spec (OpenAPI, JSON Schema)
3. **Business validation**: Check domain rules (age >= 18, email unique)
4. **Sanitization**: Escape or reject dangerous inputs

**Return detailed validation errors** (see Error Response Design above).

**Security validations**:
- Reject unexpectedly large requests
- Validate content-type headers
- Check for injection attacks (SQL, NoSQL, command injection)
- Sanitize all user-provided strings before logging

## API Gateway Patterns

### What is an API Gateway?

An API gateway is a server that acts as a single entry point for a collection of microservices. It routes requests, enforces policies, and provides cross-cutting concerns.

**Core responsibilities**:
- Request routing and composition
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation
- Protocol translation (REST to gRPC, HTTP to messaging)
- Caching
- Logging and monitoring

### Gateway vs Service Mesh

| Concern | API Gateway | Service Mesh |
|---------|-------------|--------------|
| **Scope** | North-south (client to service) | East-west (service to service) |
| **Layer** | Application layer (L7) | Network layer (L4) and application (L7) |
| **Deployment** | Centralized or edge | Sidecar per service |
| **Use cases** | External API management | Service-to-service reliability |

**You may need both**: Gateway for external APIs, service mesh for internal communication.

### Gateway Patterns

**Backend for Frontend (BFF)**: One gateway per client type (mobile, web, partners). Each BFF provides an API tailored to that client's needs.

**Aggregation**: Gateway calls multiple services and combines responses into single response.

**Transformation**: Gateway adapts legacy SOAP services to modern REST APIs.

**Edge gateway**: Deployed close to users (CDN edge) for low-latency responses.

## API Governance and Standards

### API Standards and Style Guides

Establish API standards across your organization to ensure consistency.

**Key areas to standardize**:
- Naming conventions (resources, fields, parameters)
- Error response format
- Authentication mechanisms
- Versioning strategy
- Status code usage
- Pagination approach
- Date/time formats (ISO 8601)
- Currency and money representation

**Document standards** in a style guide that all teams follow. Review new APIs against the guide.

### API Lifecycle Management

APIs progress through a lifecycle:

1. **Design**: Define contract, review with stakeholders
2. **Develop**: Implement server and client SDKs
3. **Test**: Validate contract compliance, performance, security
4. **Publish**: Deploy to production, publish documentation
5. **Monitor**: Track usage, performance, errors
6. **Version**: Evolve API while maintaining compatibility
7. **Deprecate**: Sunset old versions, migrate clients
8. **Retire**: Remove deprecated versions

**Critical transition: Publish to Monitor**. Once an API is public, you lose control. Treat every API as permanent.

### API Documentation

Documentation must be complete, accurate, and always up to date with the implementation.

**Essential documentation**:
- Overview and purpose
- Authentication and authorization
- Base URL and versioning
- Complete endpoint reference (request/response examples)
- Error codes and meanings
- Rate limits and quotas
- Pagination and filtering
- Code examples in multiple languages
- Changelog

**Documentation generation**: Use OpenAPI (Swagger), GraphQL introspection, or API Blueprint to generate documentation from specifications. This ensures docs stay synchronized with implementation.

**Interactive documentation**: Tools like Swagger UI, GraphQL Playground, and Postman Collections let developers try APIs without writing code.

## API Evolution and Backward Compatibility

### Backward-Compatible Changes

These changes don't break existing clients:

**Safe additions**:
- New optional request fields
- New response fields
- New endpoints
- New optional query parameters
- New error codes (clients should handle unknown codes gracefully)
- New enum values (if clients ignore unknown values)

**Guidelines**:
- Always make new fields optional with sensible defaults
- Never repurpose existing fields for new meanings
- Add fields, don't replace them

### Breaking Changes

These changes break existing clients and require a new major version:

**Breaking changes**:
- Removing endpoints or fields
- Renaming fields
- Changing field types
- Making optional fields required
- Changing authentication mechanisms
- Changing error response structure
- Changing URL structure
- Changing HTTP method semantics

**When you must make breaking changes**: Create a new major version, support both versions during migration, deprecate old version, retire old version.

### Deprecation Process

Deprecating API features safely:

1. **Announce**: Document deprecation in changelog, mark endpoints as deprecated in docs
2. **Deprecation headers**: Return `Sunset` header indicating when endpoint will be removed
   ```
   Sunset: Sat, 31 Dec 2025 23:59:59 GMT
   ```
3. **Warning logs**: Log warnings when deprecated endpoints are called
4. **Client migration**: Work with major clients to migrate
5. **Monitor usage**: Track calls to deprecated endpoints
6. **Sunset**: Remove deprecated features after sufficient notice period (6-12 months typical)

**Never surprise clients with breaking changes**. Communication and transition time are critical.

## API Performance Optimization

### Caching Strategies

HTTP caching reduces latency and server load.

**Cache-Control directives**:
```
Cache-Control: public, max-age=3600         # Cache for 1 hour
Cache-Control: private, max-age=300          # User-specific, cache for 5 min
Cache-Control: no-cache                       # Revalidate every time
Cache-Control: no-store                       # Never cache
```

**ETags for conditional requests**:
```
# Initial request
GET /orders/123
ETag: "v1-abc123"

# Subsequent request
GET /orders/123
If-None-Match: "v1-abc123"

# Response if unchanged
304 Not Modified
```

**Cache invalidation**: Include cache-busting parameters or version identifiers in URLs when content changes.

### Compression

Enable response compression to reduce bandwidth:
```
Accept-Encoding: gzip, deflate
Content-Encoding: gzip
```

**Most APIs should compress responses**. The CPU cost is negligible compared to network transfer time.

### Batch Operations

Allow clients to batch multiple operations into a single request to reduce round trips:

```json
POST /batch
{
  "operations": [
    { "method": "GET", "path": "/orders/123" },
    { "method": "GET", "path": "/orders/124" },
    { "method": "POST", "path": "/orders", "body": {...} }
  ]
}
```

**Response**:
```json
{
  "responses": [
    { "status": 200, "body": {...} },
    { "status": 200, "body": {...} },
    { "status": 201, "body": {...} }
  ]
}
```

**Use cases**: Mobile apps with high latency, bulk imports, reducing connection overhead.

### Partial Responses

Let clients request only the fields they need:
```
GET /orders/123?fields=id,status,total
```

Reduces response size and processing time. Particularly valuable for mobile clients.

## API Testing Strategies

### Contract Testing

Verify that API implementation matches the specification and that clients use the API correctly.

**Provider contract tests**: Verify server responses match the API spec.
**Consumer contract tests**: Verify clients handle responses correctly.

**Tools**: Pact, Spring Cloud Contract, Postman Contract Testing.

### Integration Testing

Test API endpoints end-to-end against a running service.

**Test scenarios**:
- Happy path requests return expected responses
- Validation errors return appropriate 400-level codes
- Authorization is enforced
- Rate limits are applied
- Pagination works correctly
- Error conditions are handled gracefully

### Performance Testing

Validate that the API meets performance requirements under load.

**Test types**:
- **Load testing**: Sustain expected traffic levels
- **Stress testing**: Find breaking point
- **Spike testing**: Handle sudden traffic increases
- **Soak testing**: Sustain load for extended periods (detect memory leaks)

**Key metrics**:
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Resource utilization (CPU, memory, connections)

### Security Testing

Validate security controls:
- Authentication bypass attempts
- Authorization boundary violations
- Injection attacks (SQL, NoSQL, command injection)
- Input validation bypass
- Rate limit enforcement
- HTTPS enforcement
- Sensitive data exposure in logs or error messages

## Common API Antipatterns

### Chatty APIs

**Problem**: Requiring multiple round trips to accomplish simple tasks. Example: Client must call `/user`, then `/user/preferences`, then `/user/orders` separately.

**Solution**: Provide composite endpoints, support field expansion (`/user?expand=preferences,orders`), or use GraphQL.

### Leaking Implementation Details

**Problem**: Exposing database structure, internal service names, or framework details in the API.

**Example**: `GET /orders?join=customers&select=order_id,customer.name`

**Solution**: Design APIs around domain concepts, not database schema. Abstract implementation details behind stable contracts.

### Ignoring HTTP Semantics

**Problem**: Using POST for everything, returning 200 OK for errors, misusing status codes.

**Solution**: Use HTTP methods and status codes according to their defined semantics. REST is built on HTTP; leverage it properly.

### Poor Error Handling

**Problem**: Vague error messages, inconsistent error formats, exposing stack traces.

**Solution**: Return structured errors with machine-readable codes, human-readable messages, and actionable details.

### Versioning Too Frequently

**Problem**: Creating new versions for minor changes, fragmenting the API across many versions.

**Solution**: Make backward-compatible changes whenever possible. Reserve new versions for true breaking changes.

### Lack of Documentation

**Problem**: Incomplete, outdated, or missing documentation.

**Solution**: Generate documentation from API specifications. Include examples for every endpoint. Keep changelog updated.

## Key Takeaways

**APIs are contracts**: Treat them as permanent commitments. Changes are expensive. Design carefully upfront.

**Stability enables evolution**: Backward compatibility allows clients and servers to evolve independently. Breaking changes force coordination.

**REST and GraphQL solve different problems**: REST excels at resource-oriented operations with strong HTTP caching. GraphQL excels at flexible queries across complex graphs. Choose based on your use case.

**Versioning is a governance decision**: Decide once how you'll version APIs and apply it consistently across the organization.

**Security is not optional**: Authentication, authorization, input validation, and rate limiting must be part of every API from day one.

**Documentation quality matters**: Developers evaluate your platform based on documentation quality. Invest in examples, interactive tools, and keeping docs current.

**Monitor API usage**: Track who uses which endpoints, error rates, and performance. This data drives versioning decisions and sunset timelines.
