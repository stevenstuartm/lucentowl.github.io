---
layout: post
title: "Persisted Queries Are GraphQL Taking Authority Back"
description: "GraphQL gave every client authority over the shape of its queries, and the ecosystem has spent a decade pulling that authority back through limits, cost analysis, and trusted documents, toward what Facebook did all along. What survives is a typed contract negotiated at build time, which is useful, but not what GraphQL was sold on."
tags: [architecture, api-design, graphql, security]
author: steven-stuart
sources:
  - title: "GraphQL: A data query language (Engineering at Meta, 2015)"
    url: "https://engineering.fb.com/2015/09/14/core-infra/graphql-a-data-query-language/"
  - title: "PortSwigger Web Security Academy: Bypassing GraphQL brute force protections"
    url: "https://portswigger.net/web-security/graphql/lab-graphql-brute-force-protection-bypass"
  - title: "GraphQL.org: Security"
    url: "https://graphql.org/learn/security/"
  - title: "IBM GraphQL Cost Directives Specification"
    url: "https://ibm.github.io/graphql-specs/cost-spec.html"
  - title: "What's new for Hot Chocolate 14 (ChilliCream, 2024)"
    url: "https://chillicream.com/blog/2024/08/30/hot-chocolate-14/"
  - title: "Hot Chocolate v14: Cost Analysis"
    url: "https://chillicream.com/docs/hotchocolate/v14/security/cost-analysis/"
  - title: "GitHub Docs: Rate limits and query limits for the GraphQL API"
    url: "https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api"
  - title: "Shopify: API rate limits"
    url: "https://shopify.dev/docs/api/usage/rate-limits"
  - title: "Sashko Stubailo: 5 benefits of static GraphQL queries (Apollo, 2016)"
    url: "https://www.apollographql.com/blog/5-benefits-of-static-graphql-queries"
  - title: "Benjie Gillam: Trusted Documents"
    url: "https://benjie.dev/graphql/trusted-documents"
  - title: "Relay: Persisted Queries"
    url: "https://relay.dev/docs/guides/persisted-queries/"
  - title: "Hot Chocolate v15: Persisted Operations"
    url: "https://chillicream.com/docs/hotchocolate/v15/performance/persisted-operations/"
  - title: "Apollo GraphOS: Safelisting with Persisted Queries"
    url: "https://www.apollographql.com/docs/graphos/platform/security/persisted-queries"
  - title: "Apollo Server: Automatic Persisted Queries"
    url: "https://www.apollographql.com/docs/apollo-server/performance/apq"
---

When Facebook introduced GraphQL publicly in 2015, its engineering post put the idea in one line: "The shape of the returned data is determined entirely by the client's query, so servers become simpler and easy to generalize." That was the pitch. A frontend developer could change what a screen fetched without waiting on a backend change, and the server stopped growing an endpoint per screen.

> **AUTHOR** — the author's experience goes here: HotChocolate in production behind Vue clients, and whether arbitrary queries were ever locked down there, and what prompted it.

The tooling tells a different story from the pitch. The GraphQL Foundation's security guidance recommends depth limits, alias limits, and cost budgets. HotChocolate now ships with a cost budget enforced by default. And the strictest control, persisted operations that refuse any query the server hasn't registered, turns out to be how Facebook has run GraphQL since before it was open-sourced. Each of those moves authority over query shape from the client back to the server. For an API that serves only its owner's apps, what's left is a typed contract that clients and server negotiate at build time, not client-shaped queries at runtime.

## The Pitch Gave Query Authority to Every Caller

A REST endpoint decides its own response shape. A GraphQL endpoint accepts any document that validates against the schema, so the decision about what work a request does belongs to whoever writes the query. For a first-party app, that's meant to be the frontend team.

The frontend team isn't the only party that can write queries, though. The endpoint a web app calls is visible to anyone who opens the browser's network tab, and the schema they need is often one introspection query away. Whatever authority the pitch granted to the frontend, it granted to every caller.

That authority is broader than it looks. A query like `users(first: 100) { friends(first: 100) { friends(first: 100) { name } } }` asks for a million records in one request, and nothing in the language stops a fourth level. Aliases let one request call the same field many times, so a login mutation aliased a hundred times tries a hundred passwords in what a per-request rate limiter counts as one attempt. PortSwigger's Web Security Academy teaches exactly that bypass as a lab exercise. None of these is a bug in a particular server. Each is the pitch working as designed, used by someone the design didn't have in mind.

## Production Has Been Taking It Back One Control at a Time

Three kinds of control recur across GraphQL servers and public APIs, and each one moves more authority back to the server than the last.

### Limits Bound the Shape

The first controls are structural. The GraphQL Foundation's security guidance recommends limiting query depth, applying "a separate smaller limit to how deeply lists can be nested," capping the number of operations in a batch, and restricting aliases. Each is a rule about what a client may ask for, enforced by the server before anything runs. The client still writes the query, but the server now decides which shapes are legal.

### Cost Analysis Prices the Shape

Limits are blunt, because a shallow query can still be expensive and a deep one cheap. Cost analysis assigns a weight to fields, estimates list sizes, and rejects any query whose total exceeds a budget. IBM drafted a GraphQL Cost Directives Specification in 2021 so that "servers can express what is costly for them in a standard way."

HotChocolate built that specification into version 14 in 2024 and turned it on by default, with a field-cost budget of 1,000 and a type-cost budget of 10,000, so an over-budget query is rejected before any resolver runs. The same release disables introspection when it detects a production environment, though it still serves the schema file on request, so hiding the schema was never the protection. ChilliCream's release post describes the goal as a server that stays secure "even if you do not configure any security related options, even if you do not know about persisted operations, or even if you explicitly want an open GraphQL server." The framework's own defaults no longer trust the client to shape queries freely.

Public APIs, which can't know their callers' queries in advance, lean hardest on pricing. GitHub's GraphQL API requires a `first` or `last` argument between 1 and 100 on every connection, caps a single call at 500,000 nodes, and meters each user at 5,000 points an hour. Shopify's Admin API rate-limits by calculated query cost. Clients of both still shape their queries, inside a budget the server sets and enforces.

### Trusted Documents Remove the Shape From Runtime

The last control takes the authority back entirely. With persisted operations, the client's queries are extracted at build time, hashed, and registered with the server. In production, the client sends a hash, and the server runs only operations it already holds. The GraphQL Foundation's security guidance recommends trusted documents for APIs that serve only first-party clients and treats depth and cost limits separately. For a first-party API, the allowlist should come first, because limits and cost budgets only approximate what an allowlist enforces exactly.

It isn't a late invention. Sashko Stubailo described Facebook's practice on Apollo's blog in 2016. In development, "the server accepts any query you throw at it," on deploy the queries are saved, and in production "the server only supports the queries that have been previously stored." Benjie Gillam's write-up on trusted documents says the technique "has been used within Facebook since before GraphQL was open sourced." Relay, Facebook's GraphQL client, can persist every query at build time and send only its hash, and its documentation gives both reasons, saving upload bytes and letting the server "allowlist queries which improves security by restricting the operations that can be executed by a client." By these accounts, the team that created GraphQL didn't run its own apps the way it was pitched.

In HotChocolate, the lockdown is one option:

```csharp
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .UsePersistedOperationPipeline()
    .AddFileSystemOperationDocumentStorage("./persisted_operations")
    .ModifyRequestOptions(options =>
        options.PersistedOperations.OnlyAllowPersistedDocuments = true);
```

The HotChocolate documentation's case for it is that malicious actors "can no longer craft and execute harmful operations against your GraphQL server." Apollo calls the same feature a safelist. The GraphQL Foundation's guidance uses the name Gillam has pushed the ecosystem to adopt, trusted documents, and recommends them for "GraphQL APIs that only serve first-party clients."

## Performance Doesn't Explain the Pullback

Persisted queries have an obvious performance story, so it's fair to ask whether the authority framing reads motive into a bandwidth optimization. A hash is smaller than a query document, which matters on slow mobile uplinks, and both Stubailo's list and Relay's documentation give bandwidth and security side by side.

What settles it is that the ecosystem later split those two reasons into separate features. Apollo's Automatic Persisted Queries exist, in Apollo Server's words, "to improve network performance for large query strings." The server caches any query it receives under its hash, so any client can register any query, and nothing is restricted. Apollo's safelisting documentation says "APQ doesn't provide safelisting capabilities" and that enabling the safelist means turning APQ off. Gillam puts it plainly: "automatic persisted queries are not a security feature."

If persisted queries were only about bandwidth, APQ would have been enough, and the trusted-document variant would have no reason to exist. Teams built it because they wanted the server to decide which queries run. Security is the reason they give, and authority is why the security problem exists in the first place. An endpoint that lets any caller decide what work it does has to be defended against every caller.

## Who Should Hold the Authority Decides Which GraphQL You Run

The pullback isn't uniform, because the two kinds of GraphQL API answer differently who should hold authority over query shape.

| | First-party API | Public API |
| --- | --- | --- |
| Who writes the queries | Your own client teams | Callers you don't know |
| Can the server know queries in advance | Yes, at build time | No |
| Where authority over shape belongs | Server, through trusted documents | Client, within a budget the server enforces |
| Main controls | Persisted operations, with depth and cost limits as a backstop | Cost analysis, pagination caps, node limits, point-based rate limits |
| Examples | Facebook's own apps, private web and mobile backends | GitHub, Shopify |

A public API keeps the original bargain and prices it, and the GraphQL Foundation's guidance rules trusted documents out there, because third-party operations can't be known in advance. A first-party API that leaves arbitrary queries open takes on a public API's exposure with none of the reasons to accept it.

## What First-Party GraphQL Keeps Is a Typed Contract Negotiated at Build Time

Once trusted documents are on, a first-party GraphQL API looks different from the pitch. Every operation is written by the client team, reviewed, compiled into a hash, and registered with the server as part of a deploy. The server exposes a fixed set of named operations, and the schema is the language both sides use to describe them.

### It Works Like RPC With the Client Writing the Methods

That is close to gRPC. A gRPC contract is a set of `.proto` files compiled into both sides, so every call is known at build time. The difference is who writes the operation. In gRPC, the server team defines each method. With trusted documents, the client team composes each operation from the schema, and the server accepts it by registering it. A REST API changes shape when the backend team ships a new endpoint, while a first-party GraphQL API changes shape when the client team ships a new document.

What survives from the pitch is useful. A frontend team can still change what a screen fetches without a backend code change, as long as the new document ships through the pipeline. The schema is still typed end to end, with generated clients that catch mismatches at build time. And the server gains something the pitch never mentioned, an exact inventory of which fields each registered operation touches, so a deprecated field can be retired once no registered document uses it.

What doesn't survive is clients shaping queries at runtime. With trusted documents on, that becomes a development-mode feature.

### The Build-Time Contract Has Its Own Costs

Trusted documents couple client releases to the server. A document has to be registered before the client that sends it ships, so the deploy pipeline gains an ordering step. Mobile apps make it worse, because old versions stay installed for months or years and the server has to keep every document those versions send until they're gone.

They also close the door on ad hoc queries in production, including the ones engineers run while debugging. HotChocolate lets an interceptor call `AllowNonPersistedOperation()` for requests that meet some condition, such as a developer header. That exemption is only as safe as the check behind it, and a header anyone can set reopens the endpoint to everyone.

None of this makes trusted documents the wrong default for a first-party API. It makes them a contract with a release process, the same kind of cost a gRPC or versioned REST API already carries.

## Checking Your Own Endpoint

Many GraphQL APIs serve only their owner's apps, which puts them in the first column of the table whether or not they're configured that way. A few questions show where yours sits:

- Does your production endpoint accept a query your clients never send? Paste one into an HTTP client and find out
- If introspection is off in production, is that the only thing between a caller and an arbitrary query? Your client bundle already contains the queries
- Does a single request with a hundred aliased calls to your login mutation count as one attempt or a hundred?
- Does your server reject a query by estimated cost before running it, or only time it out after?
- If your apps' queries are known at build time, why does the server still accept others?

If nobody decided the answer to the last one, every caller holds the authority by default, and trusted documents are how the server takes it back.
