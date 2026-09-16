---
title: "API Design & Architecture"
layout: guide
category: Architecture
subcategory: Design
description: "Designing APIs as long-lived contracts: contract-first design, REST resource modeling, Problem Details error responses, pagination and filtering, GraphQL schema and resolver design, versioning, backward compatibility, and deprecation with the Deprecation and Sunset headers."
tags: [practical, api-design, rest, graphql, api-versioning, pagination, problem-details]
---

An API is a contract between the team that builds a system and every team that depends on it, and unlike internal code it can't be refactored in one commit. Once a client depends on a field, a status code, or an error shape, changing it means coordinating with that client or breaking it. That makes API design less about the first version and more about how cheaply the API can evolve afterwards.

## Design Principles

### Design the Contract First

Write the contract before implementing either side, as an OpenAPI document for HTTP APIs, a GraphQL schema, or Protocol Buffers definitions. Review it with the people who will consume it, then generate server stubs, client SDKs, and request validation from it.

Implementing first and describing afterwards tends to publish the implementation. The resource shapes mirror database tables, field names mirror column names, and clients become coupled to a data model the team will want to change. `GET /orders/{orderId}` returning an order designed for its consumers ages far better than `GET /order_data` returning whatever the table holds.

### Prefer Extension over Change

Every client is coupled to the API's current shape, so the cheapest changes are additions that existing clients can ignore. A new optional request field, a new response field, and a new endpoint can all ship without anyone else changing anything. Removing, renaming, or re-typing a field can't, and neither can changing what an existing field means.

The other half of that bargain belongs to clients. A client that ignores response fields it doesn't recognize and tolerates unknown enum values, known as a tolerant reader, is what lets the server add fields and values without breaking it.

### Resources and Operations

| | Resource-oriented | Operation-oriented |
|---|------------------|--------------------|
| **Models the domain as** | Nouns manipulated with standard methods | Actions with their own names |
| **Example** | `PATCH /orders/{id}` with a new status | `POST /orders/{id}/cancel` |
| **Suits** | Data that is created, read, updated, and deleted | Workflows whose steps have business meaning and rules |
| **Strength** | Uniform, cacheable, predictable across the API | Explicit about intent, so rules attach to the action |

Most APIs need both. Cancelling an order is not merely setting a status field. It releases stock, refunds a payment, and may be refused, so a dedicated operation says what is being asked for more honestly than a generic update does.

## REST API Design

### Resource Modeling

A resource is anything that can be named and addressed: an order, a customer, a customer's orders, the current user's profile.

| Pattern | Example | Use |
|---------|---------|-----|
| Collection | `GET /orders` | List resources, with pagination |
| Item | `GET /orders/{orderId}` | One resource |
| Sub-collection | `GET /customers/{customerId}/orders` | Resources scoped by a parent |
| Singleton | `GET /me/profile` | A resource with no collection |
| Operation | `POST /orders/{orderId}/cancel` | An action that doesn't map onto a standard method |

Use plural nouns for collections, consistent casing across the whole API, and nesting only where the child genuinely belongs to the parent. Deep paths like `/customers/{c}/orders/{o}/lines/{l}/adjustments` couple clients to a hierarchy that rarely survives the domain changing.

### Methods and Status Codes

HTTP methods carry meaning clients and intermediaries rely on. **Safe** methods, such as `GET` and `HEAD`, don't change server state, so caches, crawlers, and prefetchers can call them freely. **Idempotent** methods, such as `PUT` and `DELETE` as well as the safe methods, produce the same end state however many times they are repeated, so a client can retry them after a timeout without doing damage. `POST` and `PATCH` are neither by definition, which is why operations that must be retried safely need an idempotency key.

Status codes tell a client what to do next, not only what happened. A `2xx` means the request worked. A `4xx` means the request itself has to change before it will work, so retrying it unchanged is pointless. A `5xx` means the server failed, and the same request may succeed later. Being consistent matters more than being clever. The same condition should produce the same code everywhere in the API.

### Error Responses with Problem Details

[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html){:target="_blank" rel="noopener noreferrer"}, Problem Details for HTTP APIs, is the standard format for HTTP error bodies. It obsoleted RFC 7807 in July 2023, keeping the same format while tightening guidance. A problem details response uses the media type `application/problem+json` and these members:

| Member | Meaning |
|--------|---------|
| `type` | A URI identifying the kind of problem, which clients branch on. Defaults to `about:blank` |
| `title` | A short, human-readable summary of that kind of problem, the same for every occurrence |
| `status` | The HTTP status code, repeated for convenience |
| `detail` | A human-readable explanation of this particular occurrence |
| `instance` | A URI identifying this particular occurrence, useful for support and log correlation |

A problem type can add its own members. Validation failures commonly add a list of individual errors, each pointing at the part of the request that failed.

```json
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Your request is not valid.",
  "status": 422,
  "detail": "Two fields failed validation.",
  "instance": "/orders/requests/7f3c9a",
  "errors": [
    { "pointer": "#/email", "detail": "Must be a valid email address." },
    { "pointer": "#/quantity", "detail": "Must be greater than zero." }
  ]
}
```

Clients should branch on `type`, which is a stable identifier, and never parse `title` or `detail`, which exist for humans and can be reworded. Error bodies should also never carry stack traces, SQL, or internal hostnames.

ASP.NET Core produces problem details natively. Registering the service makes unhandled exceptions and empty error responses use the format, and endpoints can return problems directly.

```csharp
builder.Services.AddProblemDetails();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapPost("/orders", (CreateOrderRequest request) =>
{
    var errors = OrderValidator.Validate(request);   // Dictionary<string, string[]>
    if (errors.Count > 0)
        return Results.ValidationProblem(errors, statusCode: StatusCodes.Status422UnprocessableEntity);

    // ...
    return Results.Created($"/orders/{orderId}", order);
});
```

### Pagination

Any endpoint returning a collection needs pagination, because collections grow and an unbounded response eventually times out or exhausts memory on one side or the other.

| | Offset pagination | Cursor pagination |
|---|-------------------|-------------------|
| **Request** | `GET /orders?limit=20&offset=40` | `GET /orders?limit=20&cursor=eyJpZCI6MTIzfQ` |
| **Jump to page N** | Yes | No, only next and previous |
| **Items inserted or deleted while paging** | Pages shift, so items are skipped or repeated | Stable, since the cursor marks a position in the ordering |
| **Deep pages** | Slow, because the database still reads and discards every skipped row | Constant cost, since the cursor becomes an indexed range condition |
| **Suits** | Small, stable collections and admin screens | Feeds, large collections, and anything clients sync from |

```json
{
  "data": [ ... ],
  "next_cursor": "eyJpZCI6MTQzfQ",
  "has_more": true
}
```

Keep cursors opaque, so the encoding can change without breaking clients. Think twice before returning a total count: counting a large filtered collection can cost more than fetching the page.

### Filtering, Sorting, and Field Selection

```
GET /orders?status=pending&customer_id=123
GET /orders?created_after=2026-01-01T00:00:00Z
GET /orders?sort=-created_at,total
GET /products?q=laptop
GET /orders/123?fields=id,status,total
```

Choose one convention for each, such as a leading minus for descending sort, and apply it across the whole API. Document which fields can be filtered and sorted, since each one usually needs an index behind it, and reject unsupported filters with a `400` rather than silently ignoring them. A client whose filter is ignored receives the whole collection and believes it was filtered.

## GraphQL Design

### When GraphQL Fits

| GraphQL tends to fit when | REST tends to fit when |
|---------------------------|------------------------|
| Several client types need different shapes of the same data | Clients need broadly the same representations |
| Screens assemble data from many related entities, and REST would take many round trips | Operations map naturally onto resources |
| A frontend team wants to change what it fetches without backend changes | HTTP caching by URL at CDNs and proxies matters |
| A single typed schema over several backends is valuable | Tooling, security review, and team experience are built around HTTP semantics |

GraphQL moves complexity rather than removing it. Clients get flexibility, and the server takes on query cost control, authorization per field, and caching that plain HTTP no longer does for it.

### Schema Design

Design the schema around what clients do, not around database tables, and use the type system to make invalid states unrepresentable. GraphQL's built-in scalars are only `Int`, `Float`, `String`, `Boolean`, and `ID`, so any other primitive, such as a date-time or a decimal amount, has to be declared as a custom scalar.

```graphql
scalar DateTime
scalar Decimal

type Query {
  order(id: ID!): Order
  orders(status: OrderStatus, first: Int, after: String): OrderConnection!
}

type Order {
  id: ID!
  status: OrderStatus!
  total: Money!
  lines: [OrderLine!]!
  customer: Customer!
  createdAt: DateTime!
}

type Money {
  amount: Decimal!
  currency: String!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

Non-null markers are a commitment, since a field declared `String!` can never be made nullable without breaking clients, while a nullable field can later become non-null safely. Paginated lists conventionally follow the connection pattern, with `first`, `after`, and `pageInfo`, which gives cursor pagination a shape clients and tooling recognize.

### Mutations

Model mutations as specific business actions rather than generic updates, take a single input object, and return a payload that can carry either the result or expected errors.

```graphql
type Mutation {
  placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
  cancelOrder(input: CancelOrderInput!): CancelOrderPayload!
}

input PlaceOrderInput {
  clientMutationId: String
  lines: [OrderLineInput!]!
  shippingAddress: AddressInput!
}

type PlaceOrderPayload {
  order: Order
  userErrors: [UserError!]!
}

type UserError {
  field: [String!]
  message: String!
}
```

Returning expected failures, such as an out-of-stock item, as `userErrors` in the payload keeps them typed and part of the schema. GraphQL's top-level `errors` array is better reserved for unexpected failures, since clients can't discover its contents from the schema.

### Resolvers and Query Cost

Each field has a resolver, and naive resolvers produce the N+1 problem. A query for 50 orders with their customers runs one query for the orders and then one per order for its customer.

```graphql
query {
  orders(first: 50) {
    edges { node { id customer { name } } }
  }
}
```

The standard fix is batching through a DataLoader, which collects every customer id requested while resolving one level of the query and loads them in a single call, caching them for the rest of the request.

Because clients write their own queries, the server also has to bound what a query can cost. Limit query depth, assign a cost to fields and reject queries over a budget, cap page sizes, and for first-party clients consider persisted queries, where the server accepts only queries registered in advance.

## Versioning

Versioning is how an API makes a breaking change without breaking existing clients, by running old and new contracts side by side.

| Strategy | Example | Strengths | Weaknesses |
|----------|---------|-----------|------------|
| **URI path** | `GET /v2/orders` | Visible, easy to route, easy to see in logs and to test | Versions the whole API at once, and the same resource gets several URLs |
| **Media type** | `Accept: application/vnd.example.order.v2+json` | Stable URLs, and each resource can version independently | Harder to discover, test, and cache correctly |
| **Custom header** | `Api-Version: 2` | Stable URLs, simple for clients | Invisible in URLs, and caches need `Vary` configured |
| **Query parameter** | `GET /orders?api-version=2` | Simple, visible | Mixes versioning into filtering parameters |

For most HTTP APIs, a major version in the URI path is the pragmatic default. It is the easiest to route, document, and observe, and its main weakness matters little if major versions are rare. Between major versions, make only backward-compatible changes.

The goal is to need versions as seldom as possible. Every live version is a contract to maintain, test, and secure, so a second major version should be a last resort after additive changes have been ruled out, not a routine release.

GraphQL APIs generally don't version at all. The schema evolves continuously, with new fields added alongside old ones and old ones marked `@deprecated` until usage reaches zero.

## Evolution and Compatibility

| Backward-compatible, safe to ship | Breaking, needs a new version or a migration |
|-----------------------------------|----------------------------------------------|
| Adding an endpoint or operation | Removing or renaming an endpoint or field |
| Adding an optional request field or query parameter | Adding a required request field, or making an optional one required |
| Adding a response field | Changing a field's type, format, or meaning |
| Adding an enum value, if clients tolerate unknown values | Removing an enum value |
| Relaxing validation | Tightening validation on existing input |
| Adding a new error `type` for a new condition | Changing the error format, or the status code for an existing condition |

Two changes on the left are only safe if clients cooperate. A client that fails on unknown enum values, or that switches exhaustively over error types, turns an additive change into a breaking one. Say in the API's documentation that clients must tolerate both.

### Deprecation

Removing something clients depend on should be a process with a known end date, not an event.

1. **Announce** the deprecation in the changelog and documentation, with the replacement and the removal date.
2. **Signal it in responses**. The `Deprecation` header, standardized in [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html){:target="_blank" rel="noopener noreferrer"} in March 2025, says when the resource was or will be deprecated, and the `Sunset` header from RFC 8594 says when it will stop responding. A `Link` header can point to migration documentation.
3. **Measure usage** of the deprecated resource per client, and contact the clients still calling it.
4. **Remove** it after the sunset date, once usage has reached a level the business accepts.

```
Deprecation: @1767225600
Sunset: Wed, 30 Jun 2027 23:59:59 GMT
Link: <https://api.example.com/docs/migrate-orders-v2>; rel="deprecation"
```

`Deprecation` uses a structured-field date, an `@` followed by Unix seconds, while `Sunset` keeps the older HTTP-date format, and the sunset must not come before the deprecation. How long the notice period runs depends on who the clients are. Internal teams can move in weeks, while public API consumers may need a year or more.

## HTTP Performance

**Caching**: `Cache-Control` tells browsers, CDNs, and proxies whether and for how long a response can be reused, with `private` restricting reuse to the requesting client and `no-store` forbidding it entirely. Responses that change unpredictably can carry an `ETag`, so clients revalidate with `If-None-Match` and receive a bodiless `304 Not Modified` when nothing changed.

**Compression**: Clients advertise supported encodings in `Accept-Encoding`, commonly `gzip` and Brotli (`br`), and the server compresses accordingly. Text formats like JSON compress well, so compression is usually worthwhile for anything beyond small responses.

**Round trips**: Chatty APIs that need several calls for one screen are slowest on high-latency mobile connections. Composite endpoints designed for a screen, embedding related resources on request with parameters like `?expand=customer`, or field selection all reduce round trips without abandoning resource orientation. Generic batch endpoints that wrap many requests in one are harder to cache, authorize, and debug, and are usually a last resort.

## Governance

In an organization with many APIs, consistency is itself a feature. A client team that has integrated with one API should find the next one familiar.

- **A style guide** fixes the decisions every API would otherwise make differently: naming and casing, error format, pagination style, date and time format (RFC 3339), money representation, versioning strategy, and authentication scheme.
- **Automated linting** of OpenAPI documents against the style guide, with a tool like Spectral, catches deviations in review rather than after release.
- **Design review** of new or changed contracts, before implementation, is where the expensive mistakes are cheapest to fix.
- **Generated reference documentation** from the contract, alongside hand-written guides and examples, keeps documentation from drifting away from behavior.

Authentication and authorization, rate limiting, and testing are all part of an API's design. The API decides how callers are identified and which resources each may reach, publishes its limits and returns `429 Too Many Requests` with `Retry-After` when they are exceeded, and verifies its contract with consumers through contract tests. Each of those is a subject of its own, and the API's job is to apply them consistently.

## Common Antipatterns

| Antipattern | What it looks like | What helps |
|-------------|--------------------|------------|
| Leaking the data model | Field names match columns, and `?join=customers` appears in URLs | Design resources around consumer needs, and map to storage behind the contract |
| Ignoring HTTP semantics | `POST` for everything, and `200 OK` with `"success": false` in the body | Standard methods and status codes, so clients and intermediaries behave correctly |
| Inconsistent errors | Every endpoint invents its own error shape | Problem Details everywhere, with stable `type` URIs |
| Unbounded collections | `GET /orders` returns every order | Mandatory pagination with a maximum page size |
| Versioning by default | `v7` of an API whose changes were mostly additive | Additive evolution, with new versions only for real breaks |
| Silent breaking changes | A field's meaning changes without a version or notice | Compatibility rules, contract tests, and a deprecation process |

## Quick Reference

| Decision | Default | Reach for the alternative when |
|----------|---------|--------------------------------|
| **Contract** | Contract-first OpenAPI or GraphQL schema | Never skip it for an API with consumers outside the team |
| **Style** | Resource-oriented REST, with operations for business actions | Clients need many different shapes of related data, which favors GraphQL |
| **Errors** | RFC 9457 Problem Details, branching on `type` | Rarely, and a documented equivalent is acceptable only if it is used consistently |
| **Pagination** | Cursor-based | The collection is small and stable, or clients need page numbers |
| **Versioning** | Major version in the URI path, rarely incremented | Resources need independent versions, which favors media-type versioning |
| **Evolution** | Additive changes and tolerant readers | A breaking change is unavoidable, so version and deprecate |
| **Deprecation** | `Deprecation` and `Sunset` headers, usage tracking, a published date | Never remove without them |
