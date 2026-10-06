---
layout: post
title: "Persisted Queries Are the Tell That You Didn't Need GraphQL"
description: "GraphQL exists for data that only makes sense as a graph, which rules out most of the teams running it. A federated endpoint over bounded contexts fights the teams and the latency budget behind it, and persisted queries show the server wanted to define the operations all along, which REST, gRPC, and a backend-for-frontend already do."
tags: [architecture, api-design, graphql, microservices, domain-boundaries]
author: steven-stuart
sources:
  - title: "GraphQL: A data query language (Engineering at Meta, 2015)"
    url: "https://engineering.fb.com/2015/09/14/core-infra/graphql-a-data-query-language/"
  - title: "GitHub Docs: Rate limits and query limits for the GraphQL API"
    url: "https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api"
  - title: "Apollo GraphOS: Query plans"
    url: "https://www.apollographql.com/docs/graphos/reference/federation/query-plans"
  - title: "GraphQL-Fusion: An open approach towards distributed GraphQL (ChilliCream, 2023)"
    url: "https://chillicream.com/blog/2023-08-15-fusion"
  - title: "Sam Newman: Backends For Frontends"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "Apollo GraphOS Router: Entity caching"
    url: "https://www.apollographql.com/docs/graphos/routing/performance/caching/entity"
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
  - title: "Shopify: API rate limits"
    url: "https://shopify.dev/docs/api/usage/rate-limits"
  - title: "Relay: Persisted Queries"
    url: "https://relay.dev/docs/guides/persisted-queries/"
  - title: "Hot Chocolate v15: Persisted Operations"
    url: "https://chillicream.com/docs/hotchocolate/v15/performance/persisted-operations/"
  - title: "Apollo GraphOS: Safelisting with Persisted Queries"
    url: "https://www.apollographql.com/docs/graphos/platform/security/persisted-queries"
  - title: "Pact: Consumer-driven contract testing"
    url: "https://docs.pact.io/"
  - title: "Apollo Server: Automatic Persisted Queries"
    url: "https://www.apollographql.com/docs/apollo-server/performance/apq"
  - title: "Benjie Gillam: Trusted Documents"
    url: "https://benjie.dev/graphql/trusted-documents"
  - title: "Apollo MCP Server: Overview"
    url: "https://www.apollographql.com/docs/apollo-mcp-server"
  - title: "Apollo MCP Server: Define tools"
    url: "https://www.apollographql.com/docs/apollo-mcp-server/define-tools"
  - title: "Sashko Stubailo: 5 benefits of static GraphQL queries (Apollo, 2016)"
    url: "https://www.apollographql.com/blog/5-benefits-of-static-graphql-queries"
  - title: "Sapling: Source control that's user-friendly and scalable (Engineering at Meta, 2022)"
    url: "https://engineering.fb.com/2022/11/15/open-source/sapling-source-control-scalable/"
---

When Facebook introduced GraphQL publicly in 2015, its engineering post explained where the idea came from: "We don't think of data in terms of resource URLs, secondary keys, or join tables; we think about it in terms of a graph of objects." The team needed an API "powerful enough to describe all of Facebook." The line most people quote from that post, that "the shape of the returned data is determined entirely by the client's query," is true, but it's a consequence of the graph. It isn't the reason GraphQL exists.

> **AUTHOR** — your HotChocolate background goes here: how long, and on what kind of product.

Most teams adopt GraphQL for other reasons: one endpoint, fewer round trips, frontend teams that don't have to wait on backend changes. Persisted queries show where that leads. They lock an endpoint down to operations registered ahead of time, and the ecosystem increasingly recommends them for any first-party API. But once the server runs only operations it already holds, the client no longer shapes anything at runtime. The team has shown it wanted the server to define the operations, and REST, gRPC, or a backend-for-frontend already does that without a hash registry in the middle. Either the client is in control of the query or it isn't, and a team that locks the query down has answered the question of whether it needed GraphQL.

## GraphQL Exists Because of the Graph

### Client-Shaped Queries Follow From the Graph

Facebook's data is a graph in the literal sense. People, posts, comments, photos, groups, and pages connect to each other, and an object is rarely useful without the objects around it. A post means little without its author, its comments, and the people reacting to it, and each of those leads somewhere else. Different screens need different depths of the same graph.

The 2015 post describes the problem that produced GraphQL. Facebook needed "an API data version of News Feed," and its mobile apps, as they grew more complex, "suffered poor performance and frequently crashed." A REST service "may require multiple round-trips" where "GraphQL naturally follows relationships between objects." Letting the client shape the query is how you traverse a graph that large without writing an endpoint for every path through it.

### Most Products Don't Have That Graph

In my view, few products have data like that. Most applications have collections of models with a handful of relationships, and a screen that needs a customer with their recent orders can ask for exactly that. A well-built web app fetches what a screen needs when it needs it, caches the result, invalidates it when the data changes, and enriches its local store as the user moves through the app. That accomplishes most of what GraphQL promises without an open-ended query language over the data.

GraphQL earns its place when the graph is the product, when the data is unusable without its relationships and the useful depth varies by use case. That holds for public APIs too. GitHub's GraphQL API is defensible because repositories, issues, pull requests, users, and organizations form a graph that callers traverse in ways GitHub can't predict, not because the API is public. Applied honestly, that test rules out most of the teams running GraphQL today, and that's the point. Outside it, GraphQL adds a query language, a schema, a resolver layer, and a security problem to an application that didn't need any of them.

## One Endpoint Over Many Services Fights the Teams Behind It

The most common reason teams adopt GraphQL without a graph is to put one endpoint in front of several services. Apollo Federation and HotChocolate's Fusion both work this way. Each service publishes a subgraph, a gateway composes them into one schema, and the gateway splits each incoming query into requests to the services that own the fields.

### The Facade Recreates Cross-Service Orchestration

The appeal is easy to see. A client team writes one query instead of calling four services and stitching the results together. But the stitching still happens. It moves into a gateway's query planner, where the fetches are harder to see.

Apollo's documentation on query plans says the router runs subgraph fetches in sequence "whenever one subgraph's response depends on data that first must be returned by another subgraph," which "occurs most commonly when a query requests fields of an entity that are defined across multiple subgraphs." ChilliCream's introduction to Fusion says the same about its naive plans: "this is not efficient, as we would have to make multiple subgraph requests," which batching then has to recover. A query that looks like one request to the client is a chain of service calls whose depth depends on how the entities happen to be split.

That split is where the facade meets team topology. A business product built around domains and bounded contexts gives each team authority over its own model. A federated schema asks every team to contribute types to one shared graph, extend each other's entities, and keep a composition that every other team's changes can break. The bounded contexts are still there, but the schema pretends they aren't, and the teams pay for the difference.

### Velocity Has Better Answers Than a Shared Graph

The pressure behind a federated graph is usually delivery speed. Frontend teams don't want to wait on a backend change for every screen, and a shared graph promises they won't have to. That problem has better answers that don't fight the lessons the industry has already learned.

If the round trips between a screen and several services matter, a backend-for-frontend solves them deliberately. Sam Newman describes the pattern as a backend dedicated to one user experience and owned by the team building that interface. The team shapes exactly the responses its screens need, measures them, and changes them on its own schedule. If the problem is that one team waits on another, vertical team slices solve it, with each team owning a feature from the interface down to its data. Each change might take a little longer than editing a query, but every piece is intentional, owned, and aligned with what the product needs. Swapping that for a brittle shared graph because the deliberate path feels tedious trades a small, known cost for a large, unknown one.

### Our Prototype Failed on Latency and Caching

Members of my team once proposed a single query endpoint over our services, and we built a prototype before I rejected it. Our system was a business product with domains and bounded contexts, as it should have been, and one query endpoint fought the way the teams were organized. The web app was data heavy, and because it was data heavy, it needed to be extremely responsive. The prototype added enough latency to fail our constraints, and the sequential fetches behind it were latency the customer would feel and the product couldn't absorb.

Caching was the other wall. Each domain, and often each kind of record, had its own TTL. We tried a request-level cache in the prototype first, which fails as soon as one response mixes data with different lifetimes. A cache per source was better, but the data changed so often that keeping it fresh meant a constant stream of invalidation events into the gateway, which is a lot of machinery to keep a facade honest. And our queries carried so many filtering, sorting, and conditional options that the combinations a middle layer would have to cache made the idea unworkable.

Gateways do offer more. Apollo's router supports entity caching with a TTL per subgraph. But that puts the cache for every domain into a gateway no domain team owns, and it assumes a cohesion across domains that a business product's bounded contexts don't have. The cache would know every domain's lifecycle rules and own none of them.

### The Cache Belongs With the Actor That Cares Most

What worked was sorting the data by lifecycle and caching each kind in the layer that owned it:

| Kind of data | Where it was cached | How it stayed fresh |
| --- | --- | --- |
| Shared data batched or streamed from a source | Once, in the service that owns its contract | A system-wide sync refreshed the whole segment as the source updated, often pushed to clients over WebSocket topic subscriptions |
| Low-risk, high-value API responses | Query-response cache in that API | TTL suited to the API |
| User-specific data | Only on the client | Refetched by the client as it needed |
| Highly mutable data | Nowhere | Fetched when the app needed to act on it or when the session token refreshed |

The shared data was where the payoff was largest. It arrived from sources that needed ingress processing, so updating one cache in the service that held the contract meant the service didn't need to scale with reads, the clients got very fast responses, and the data could tolerate eventual consistency. We added the subscriptions when we knew we needed them and not before.

User-specific data never belonged in a shared layer at all. What a user sees depends on their state, their preferences, and the products they can access, and a middle-layer cache keyed on all of that becomes unpredictable. The client already holds that context, so it's the only place that cache makes sense.

Each decision sat with the actor that cared most about the data, and authority never crossed between teams or layers to make it work. That categorization gave us what GraphQL and a single facade never could.

### The Facade Fails Under Specific Conditions

One product doesn't prove a rule, so here are the conditions that sank ours. The data was heavy and changed often, its lifetimes varied by domain and record, its queries carried many filter and sort options, the screens had a tight latency budget, and separate teams owned separate bounded contexts. A product with most of those traits should expect the same result. A product with few of them, such as read-mostly data owned by one team, might find a federated graph harmless, though it should still ask what the graph gives it that a backend-for-frontend wouldn't.

## Open Queries Are the Bargain, and They Need Defending

If the graph does justify GraphQL, the client gets authority over the shape of each request. That applies to every caller, not just the frontend team, because the endpoint is visible in the browser's network tab and the schema is often one introspection query away.

A query like `users(first: 100) { friends(first: 100) { friends(first: 100) { name } } }` asks for a million records, and nothing in the language stops a fourth level. Aliases let one request call the same field many times, so a login mutation aliased a hundred times tries a hundred passwords in what a per-request rate limiter counts as one attempt. PortSwigger's Web Security Academy teaches that bypass as a lab exercise. None of this is a bug in a particular server. Doing GraphQL right means defending the design, not taking the authority back.

### Limits Bound the Shape

The GraphQL Foundation's security guidance recommends limiting query depth, applying "a separate smaller limit to how deeply lists can be nested," capping operations per batch, and restricting aliases. The client still writes the query, and the server decides which shapes are legal.

### Cost Analysis Prices the Shape

Cost analysis assigns weights to fields, estimates list sizes, and rejects any query over a budget. IBM drafted a GraphQL Cost Directives Specification in 2021 so that "servers can express what is costly for them in a standard way." HotChocolate built it into version 14 and turned it on by default, with a field-cost budget of 1,000 and a type-cost budget of 10,000. Tightening it takes a few lines:

```csharp
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMaxExecutionDepthRule(8)
    .ModifyPagingOptions(options => options.RequirePagingBoundaries = true)
    .ModifyCostOptions(options =>
    {
        options.MaxFieldCost = 1_000;
        options.MaxTypeCost = 5_000;
        options.DefaultListSize = 50;
    });
```

Public APIs over real graphs show this works at scale. GitHub's GraphQL API requires a `first` or `last` argument between 1 and 100 on every connection, caps a call at 500,000 nodes, and meters each user at 5,000 points an hour. Shopify's Admin API rate-limits by calculated query cost. Neither knows its callers' queries in advance.

A cost budget is an estimate, and the GraphQL Foundation recommends trusted documents for first-party APIs because an allowlist is exact. If a team can't accept open queries even behind limits and cost analysis, though, the problem is the choice of GraphQL, not the absence of a registry.

## Persisted Queries Split Ownership of Every Operation

With persisted queries, the client's operations are extracted at build time, hashed, and registered with the server. In production, the client sends only the hash, and the server runs only operations it holds. Relay's compiler converts each operation's text "to md5 hashes," and its documentation says the server "will need to be able to lookup the query text corresponding to each ID." HotChocolate's `OnlyAllowPersistedDocuments` option, Apollo's safelisting, and the GraphQL Foundation's "trusted documents" describe the same arrangement.

### The Client Writes It, the Server Holds It

The client team composes each operation from the schema, and the server stores it under an ID that means nothing to anyone reading the request. That isn't the client in control, because it can't send anything the server hasn't stored. It isn't the server in control either, because the server doesn't define the operations. It accepts whatever the client's build produced, and the arrangement takes on the coordination of both models with the clear ownership of neither.

It can look like a consumer-driven contract, the practice tools like Pact support, where each client records what it expects and the provider is tested against those expectations. The difference is what the provider does with them. A consumer-driven contract verifies that the server's own operations still satisfy their clients, and the server keeps ownership of the code it runs. A persisted query has the server execute client-written operations looked up by an ID, so the client's code becomes part of the server's production surface.

### Preventing Drift Takes Machinery Built Only to Keep GraphQL

Relay's documentation gives the ordering rule: "ship it to your server at deploy time so your server knows about all the queries it could possibly receive." If a client ships before its documents reach the registry, or someone rebuilds the store from the current build while last month's mobile release still sends old hashes, the request carries nothing the server can fall back on.

Teams can prevent that. They register documents in CI before the client deploys, treat the registry as append-only, and track which client versions still send which documents. Apollo's GraphOS keeps persisted query lists for exactly this, and old mobile versions force the same discipline on a REST API that has to keep old endpoints alive. But every piece of that machinery exists to keep GraphQL in place while removing what made it GraphQL. A server-defined API doesn't need a query map, a registration step, or a hash to look up.

The lockdown also closes the door on ad hoc queries in production, including the ones engineers run while debugging. HotChocolate lets an interceptor call `AllowNonPersistedOperation()` for requests that meet some condition, such as a developer header. That exemption is only as safe as the check behind it, and a header anyone can set reopens the endpoint to everyone.

Apollo's Automatic Persisted Queries show the contrast. There, an unknown hash makes the client resend the full query, so nothing breaks on a missing ID. Apollo describes the purpose as improving "network performance for large query strings," and Benjie Gillam's write-up on trusted documents says "automatic persisted queries are not a security feature." The version that survives drift is the one where the client stays in control.

### Agents Land on Persisted Queries Too

The newest version of this choice comes from AI agents. Apollo's MCP server can expose a graph to an agent as predefined operations, including ones loaded from a persisted query manifest, or through introspection tools that let the agent write its own queries. Apollo's documentation warns that the open `execute` tool "isn't pinned to a previously reviewed document." An agent may be the first consumer that wants to traverse a composed schema it can't plan in advance, and it tolerates latency a customer won't. But a federated facade hands it one schema across every bounded context, so authorization has to hold in every subgraph and cost limits stop being optional. Apollo's guidance is to govern what agents can reach "by adopting predefined persisted queries." Even for the consumer best suited to open queries, the recommended answer is persisted queries, a server-defined contract by another name.

## Facebook's Practice Rests on Facebook's Circumstances

The strongest argument for persisted queries is that Facebook has run GraphQL this way all along. Sashko Stubailo described the practice on Apollo's blog in 2016, where in production "the server only supports the queries that have been previously stored," and Gillam says it "has been used within Facebook since before GraphQL was open sourced."

### The Hash Is Less Magic Inside One Repository

Facebook's code lives largely in one repository. Meta's post on Sapling, its source control system, says the company spent ten years building it for an internal repository "with tens of millions of files, tens of millions of commits, and tens of millions of branches." Meta hasn't written that its persisted queries depend on that, but my reading is that they benefit from it. When client, compiler, and registry change in one commit, the hash is a detail of one build rather than a contract between two teams.

That monorepo is an architectural answer to a problem most companies don't have, backed by a decade of custom tooling. It isn't wrong, but it's circumstantial, and the context doesn't come with the pattern.

### A Giant's Practice Isn't a Best Practice

Teams tend to adopt what Facebook, Google, and Apple do as if scale proved it, when the practice often exists because the company built whatever it took to solve its own problem its own way. Reorganizing a department's repositories and release process so a hash registry stays safe is effort spent forcing a square block into a round hole.

## Choose Who Controls the Operation

| | Client in control | Server in control | Persisted queries |
| --- | --- | --- | --- |
| Who defines each operation | Client team, at runtime | Server team, or the screen's team through a backend-for-frontend | Client team, at build time |
| Who stores it | Nobody, it travels with the request | Server code | Server registry |
| Typical technology | Open GraphQL with limits and cost analysis | REST, gRPC, or a backend-for-frontend | GraphQL with trusted documents |
| What breaks a release | An operation over budget | A server change the client didn't expect | Drift between client builds and the registry |
| What it fits | Graph-shaped data, public or private | Most applications | One codebase that ships client and registry together |

If the server should decide what operations exist, REST and gRPC already do that, and a backend-for-frontend lets the team that owns the screen decide them without a registry. If the graph is the reason for GraphQL, let the client query it and spend the effort on cost analysis. Choose one, accept its tradeoffs, and don't build machinery to have both.
