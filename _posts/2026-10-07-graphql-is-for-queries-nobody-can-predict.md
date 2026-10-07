---
layout: post
title: "GraphQL Is for Queries Nobody Can Predict"
date: 2026-10-07
description: "GraphQL exists for graph data queried in ways nobody can predict, which rules out most of the teams running it. Persisted queries are the tell. A team that registers every query has predicted them all, and REST, gRPC, or a backend-for-frontend serves known queries without a hash registry."
tags: [architecture, api-design, graphql, microservices, domain-boundaries]
author: steven-stuart
sources:
  - title: "GraphQL: A data query language (Engineering at Meta, 2015)"
    url: "https://engineering.fb.com/2015/09/14/core-infra/graphql-a-data-query-language/"
  - title: "GraphQL.org: Security"
    url: "https://graphql.org/learn/security/"
  - title: "Apollo GraphOS: Safelisting with Persisted Queries"
    url: "https://www.apollographql.com/docs/graphos/platform/security/persisted-queries"
  - title: "GitHub Docs: Rate limits and query limits for the GraphQL API"
    url: "https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api"
  - title: "Neo4j GraphQL Library documentation"
    url: "https://neo4j.com/docs/graphql/current/"
  - title: "Apollo MCP Server: Overview"
    url: "https://www.apollographql.com/docs/apollo-mcp-server"
  - title: "Apollo MCP Server: Define tools"
    url: "https://www.apollographql.com/docs/apollo-mcp-server/define-tools"
  - title: "Apollo GraphOS: Query plans"
    url: "https://www.apollographql.com/docs/graphos/reference/federation/query-plans"
  - title: "Sam Newman: Backends For Frontends"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "Apollo GraphOS Router: Entity caching"
    url: "https://www.apollographql.com/docs/graphos/routing/performance/caching/entity"
  - title: "PortSwigger Web Security Academy: Bypassing GraphQL brute force protections"
    url: "https://portswigger.net/web-security/graphql/lab-graphql-brute-force-protection-bypass"
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
  - title: "Pact: Consumer-driven contract testing"
    url: "https://docs.pact.io/"
  - title: "Relay: Thinking in Relay"
    url: "https://relay.dev/docs/principles-and-architecture/thinking-in-relay/"
  - title: "Sashko Stubailo: 5 benefits of static GraphQL queries (Apollo, 2016)"
    url: "https://www.apollographql.com/blog/5-benefits-of-static-graphql-queries"
  - title: "Benjie Gillam: Trusted Documents"
    url: "https://benjie.dev/graphql/trusted-documents"
  - title: "Sapling: Source control that's user-friendly and scalable (Engineering at Meta, 2022)"
    url: "https://engineering.fb.com/2022/11/15/open-source/sapling-source-control-scalable/"
---

When Facebook introduced GraphQL publicly in 2015, its engineering post explained where the idea came from: "We don't think of data in terms of resource URLs, secondary keys, or join tables; we think about it in terms of a graph of objects." The team needed an API "powerful enough to describe all of Facebook." The line most people quote from that post, that "the shape of the returned data is determined entirely by the client's query," is true, but it's a consequence of the graph. It isn't the reason GraphQL exists. Nobody can list every path through a graph that size in advance, so the client has to write the query.

Most teams adopt GraphQL for other reasons: one endpoint, fewer round trips, frontend teams that don't have to wait on backend changes. None of those requires queries nobody can predict, and persisted queries show it. They lock an endpoint down to operations registered ahead of time, and the GraphQL Foundation and vendors like Apollo recommend them for any API whose only clients are the team's own apps. A persisted query registry is a list of every query the team predicted. A team that can write that list doesn't need the client in control of the query, and it has answered the question of whether it needed GraphQL.

## GraphQL Exists for Graphs Nobody Can Predict

### Client-Shaped Queries Follow From the Graph

Facebook's data is a graph in the literal sense. People, posts, comments, photos, groups, and pages connect to each other, and an object is rarely useful without the objects around it. A post means little without its author, its comments, and the people reacting to it, and each of those leads somewhere else. Different screens need different depths of the same graph.

GraphQL started in 2012, when Facebook began rebuilding its iOS and Android apps. They were thin wrappers around the mobile website, and they "suffered poor performance and frequently crashed." Native apps needed "an API data version of News Feed," which until then Facebook had only delivered as HTML. A REST service "may require multiple round-trips" where "GraphQL naturally follows relationships between objects." Letting the client shape the query is how you traverse a graph that large without writing an endpoint for every path through it.

### Most Products Don't Have That Graph

In my view, few products have data like that. Most applications have collections of models with a handful of relationships, and a screen that needs a customer with their recent orders can ask for exactly that. A well-built web app fetches what a screen needs when it needs it, caches the result, invalidates it when the data changes, and enriches its local store as the user moves through the app. That accomplishes most of what GraphQL promises without an open-ended query language over the data.

### The Test Is Whether Anyone Can Predict the Queries

GraphQL earns its place when the server can't know in advance what callers will ask of the graph. GitHub's GraphQL API is the clearest case. Repositories, issues, pull requests, users, and organizations form a graph that callers traverse in ways GitHub can't predict, and that unpredictability, not the fact that the API is public, is what justifies GraphQL. AI agents and other open-ended clients pass the same test, because they compose queries as they go and nobody can list them ahead of time. When the data already lives in a graph database and the queries are open-ended, GraphQL is a thin layer over a model that's a graph to begin with, but a known query against that database can still sit behind an ordinary endpoint. The Neo4j GraphQL Library generates a schema from type definitions and turns each operation into "a single Cypher query which is executed against the database."

Even agents get pinned down. Apollo's MCP server can give an agent predefined operations or an open `execute` tool that Apollo warns "isn't pinned to a previously reviewed document." Its guidance is to govern what agents can reach "by adopting predefined persisted queries." But predefining an agent's queries gives up the reason to expose a graph to it at all. An MCP server built on predefined operations could wrap REST or gRPC endpoints just as well.

Everywhere else, the queries are predictable, and a team that can predict its queries can define them on the server. A team that adopts persisted queries has written down every query its clients will send, which is the work GraphQL was built to make unnecessary. Applied honestly, the test rules out most of the teams running GraphQL today. Outside it, GraphQL adds a query language, a schema, a resolver layer, and a security problem to an application that didn't need any of them.

## One Endpoint Over Many Services Fights the Teams Behind It

The most common reason teams adopt GraphQL without a graph is to put one endpoint in front of several services. Apollo Federation and Hot Chocolate's Fusion both work this way. Each service publishes a subgraph, a gateway composes them into one schema, and the gateway splits each incoming query into requests to the services that own the fields.

### The Facade Recreates Cross-Service Orchestration

A client team writes one query instead of calling four services and stitching the results together. But the stitching still happens. It moves into a gateway's query planner, where the fetches are harder to see.

Apollo's documentation on query plans says the router runs subgraph fetches in sequence "whenever one subgraph's response depends on data that first must be returned by another subgraph," which "occurs most commonly when a query requests fields of an entity that are defined across multiple subgraphs." A query that looks like one request to the client is a chain of service calls whose depth depends on how the entities happen to be split.

That split is where the facade meets team topology. A business product built around domains and bounded contexts gives each team authority over its own model. A federated schema asks every team to contribute types to one shared graph, extend each other's entities, and keep a composition that every other team's changes can break. The bounded contexts are still there, but the schema pretends they aren't, and the teams pay for the difference.

### Velocity Has Better Answers Than a Shared Graph

The pressure behind a federated graph is usually delivery speed. Frontend teams don't want to wait on a backend change for every screen, and a shared graph promises they won't have to.

If the round trips between a screen and several services matter, a backend-for-frontend solves them deliberately. Sam Newman describes the pattern as a backend dedicated to one user experience and owned by the team building that interface. The team shapes exactly the responses its screens need, measures them, and changes them on its own schedule. Each change might take a little longer than editing a query, but every piece is intentional, owned, and aligned with what the product needs. Swapping that for a brittle shared graph because the deliberate path feels tedious trades a small, known cost for a large, unknown one.

### Our Prototype Failed on Latency and Caching

Members of my team once proposed a single query endpoint over our services, and we built a prototype before I rejected it. Our system was a business product with domains and bounded contexts, and one query endpoint fought the way the teams were organized. The web app was data heavy, and because it was data heavy, it needed to be extremely responsive. The prototype added enough latency to fail our product constraints.

Caching was the other wall. Each domain, and often each kind of record, had its own TTL. We tried a request-level cache in the prototype first, which fails as soon as one response mixes data with different lifetimes. A cache per source was better, but the data changed so often that keeping it fresh meant a constant stream of invalidation events into the gateway. And our queries carried so many filtering, sorting, and conditional options that the combinations a middle layer would have to cache made the idea unworkable.

Apollo's router does support entity caching with a TTL per subgraph. But that puts the cache for every domain into a gateway no domain team owns, and it assumes a cohesion across domains that a business product's bounded contexts don't have. The cache would know every domain's lifecycle rules and own none of them.

### The Cache Belongs With the Actor That Cares Most

What worked was sorting the data by lifecycle and caching each kind in the layer that owned it:

| Kind of data | Where it was cached | How it stayed fresh |
| --- | --- | --- |
| Shared data batched or streamed from a source | Once, in the service that owns its contract | A system-wide sync refreshed the whole segment as the source updated, often pushed to clients over WebSocket topic subscriptions |
| Low-risk, high-value API responses | Query-response cache in that API | TTL suited to the API |
| User-specific data | Only on the client | Refetched by the client as it needed |
| Highly mutable data | Nowhere | Fetched when the app needed to act on it or when the session token refreshed |

The shared data was where the payoff was largest. It arrived from sources that needed ingress processing, so updating one cache in the service that held the contract meant the service didn't need to scale with reads, the clients got very fast responses, and the data could tolerate eventual consistency.

User-specific data never belonged in a shared layer at all. What a user sees depends on their state, their preferences, and the products they can access, and a middle-layer cache keyed on all of that becomes unpredictable. The client already holds that context, so it's the only place that cache makes sense.

Each decision sat with the actor that cared most about the data, and authority never crossed between teams or layers to make it work. That categorization gave us what GraphQL and a single facade never could.

### The Facade Fails Under Specific Conditions

One product doesn't prove a rule, so here are the conditions that sank ours. The data was heavy and changed often, its lifetimes varied by domain and record, its queries carried many filter and sort options, the screens had a tight latency budget, and separate teams owned separate bounded contexts. A product with most of those traits should expect the same result. A product with few of them, such as read-mostly data owned by one team, might find a federated graph harmless, though it should still ask what the graph gives it that a backend-for-frontend wouldn't.

## Security Doesn't Require Locking the Queries Down

Security is the usual case for persisted queries, and the concern is fair. When callers write their own queries, every caller does, not just the frontend team, because the endpoint shows in the browser's network tab and the schema is often one introspection query away. A query like `users(first: 100) { friends(first: 100) { friends(first: 100) { name } } }` asks for a million records. Aliases let one request call a login mutation a hundred times, which a per-request rate limiter counts as one attempt, and PortSwigger's Web Security Academy teaches that bypass as a lab exercise.

None of this needs a registry. The GraphQL Foundation's security guidance recommends limiting query depth, applying "a separate smaller limit to how deeply lists can be nested," capping operations per batch, and restricting aliases. Cost analysis goes further, weighting each field and rejecting any query over a budget. IBM drafted a GraphQL Cost Directives Specification in 2021 so that "servers can express what is costly for them in a standard way," and Hot Chocolate 14 turned cost analysis on by default. Public APIs over real graphs run this way at scale. GitHub's GraphQL API requires a `first` or `last` argument between 1 and 100 on every connection, caps a call at 500,000 nodes, and meters each user at 5,000 points an hour, and Shopify's Admin API rate-limits by calculated query cost. Neither knows its callers' queries in advance.

A cost budget is an estimate and an allowlist is exact, and the GraphQL Foundation recommends trusted documents for first-party APIs. If a team can't accept open queries even behind limits and cost analysis, though, the problem is the choice of GraphQL, not the absence of a registry.

## Persisted Queries Carry the Costs of Both Models

With persisted queries, the client's operations are extracted at build time, hashed, and registered with the server, and in production the client sends only the hash. Relay's compiler converts each operation's text "to md5 hashes," and Hot Chocolate's `OnlyAllowPersistedDocuments` option, Apollo's safelisting, and the GraphQL Foundation's "trusted documents" describe the same arrangement. The result carries the coordination of both a client-defined and a server-defined API, with the clear ownership of neither.

### Nobody Owns the Operation

The client team composes each operation, but it can't send anything the server hasn't stored, so the client isn't in control. The server runs each operation, but it accepts whatever the client's build produced, so the server isn't in control either. A consumer-driven contract, the practice tools like Pact support, looks similar but keeps ownership clear. Clients record what they expect, the provider's own operations are tested against those expectations, and the server still owns the code it runs. A persisted query makes client-written code part of the server's production surface.

### Build-Time Freedom Is an Organization Problem

The best defense of persisted queries says the unpredictability hasn't gone away. It has moved from runtime to development time. The server team can't predict what the frontend will need next month, and GraphQL lets the frontend team write that query without waiting on a backend deploy. Relay is built around this, with each component declaring the data it needs as a fragment and those fragments nesting into the queries that get persisted.

But a frontend team waiting on a backend team is a symptom of how the teams are split. When teams divide by function, one team owns the screens and another owns the data, and every new screen needs a handoff between them. When teams divide by domain, along vertical slices, each team holds authority over its domain from the interface down to the data, and the team that needs a new query is the team that can write the endpoint. Nobody waits, because nobody is on the other side of the handoff.

Slicing that cleanly gets harder as the scope grows, and a large organization may never get all the way there. That still makes the wait a problem of project management, operations, and organization rather than technology. A query registry works around a split the organization could fix directly, and the workaround needs machinery of its own.

### Drift Machinery Exists Only to Keep GraphQL

Relay's documentation gives the ordering rule: "ship it to your server at deploy time so your server knows about all the queries it could possibly receive." If a client ships before its documents reach the registry, or someone rebuilds the store from the current build while last month's mobile release still sends old hashes, the request carries nothing the server can fall back on.

Teams can prevent that. They register documents in CI before the client deploys, treat the registry as append-only, and track which client versions still send which documents. Apollo's GraphOS keeps persisted query lists for exactly this, and old mobile versions force the same discipline on a REST API that has to keep old endpoints alive. But every piece of that machinery exists to keep GraphQL in place while removing what made it GraphQL. A server-defined API doesn't need a query map, a registration step, or a hash to look up.

## Facebook's Practice Rests on Facebook's Circumstances

Another argument for persisted queries is that Facebook has run GraphQL this way all along. Sashko Stubailo described the practice on Apollo's blog in 2016, where in production "the server only supports the queries that have been previously stored," and Benjie Gillam's write-up on trusted documents says it "has been used within Facebook since before GraphQL was open sourced."

But Facebook's code lives largely in one repository. Meta's post on Sapling, its source control system, says the company spent ten years building it for an internal repository "with tens of millions of files, tens of millions of commits, and tens of millions of branches." Meta hasn't written that its persisted queries depend on that, but my reading is that they benefit from it. When client, compiler, and registry change in one commit, the hash is a detail of one build rather than a contract between two teams.

Teams tend to adopt what Facebook, Google, and Apple do as if scale proved it, when the practice often exists because the company built whatever it took to solve its own problem. Reorganizing a department's repositories and release process so a hash registry stays safe is forcing a square block into a round hole.

## Choose Who Controls the Operation

| | Client in control | Server in control | Persisted queries |
| --- | --- | --- | --- |
| Who defines each operation | Client team, at runtime | Server team, or the screen's team through a backend-for-frontend | Client team, at build time |
| Who stores it | Nobody, it travels with the request | Server code | Server registry |
| Typical technology | Open GraphQL with limits and cost analysis | REST, gRPC, or a backend-for-frontend | GraphQL with trusted documents |
| What breaks a release | An operation over budget | A server change the client didn't expect | Drift between client builds and the registry |
| What it fits | Queries nobody can predict, such as public graph APIs, agents, and graph databases | Most applications | One codebase that ships client and registry together |

If the server should decide what operations exist, REST and gRPC already do that, and a backend-for-frontend lets the team that owns the screen decide them without a registry. If nobody can predict the queries, let the client write them and spend the effort on cost analysis. Choose one, accept its tradeoffs, and don't build machinery to have both.
