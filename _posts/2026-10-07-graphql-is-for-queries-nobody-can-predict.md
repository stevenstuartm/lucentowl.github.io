---
layout: post
title: "GraphQL Solved Facebook's Problem. Does It Solve Yours?"
date: 2026-10-07
description: "GraphQL let Facebook's clients write their own queries because no server team could predict every path through its graph. Every team importing it has to show it has the same problem, and a team that locks GraphQL down to persisted queries has already listed every query it will send."
tags: [architecture, api-design, graphql, microservices, domain-boundaries]
author: steven-stuart
sources:
  - title: "GraphQL: A data query language (Engineering at Meta, 2015)"
    url: "https://engineering.fb.com/2015/09/14/core-infra/graphql-a-data-query-language/"
  - title: "OpenAPI Specification"
    url: "https://spec.openapis.org/oas/latest.html"
  - title: "gRPC: Introduction to gRPC"
    url: "https://grpc.io/docs/what-is-grpc/introduction/"
  - title: "Hot Chocolate: Filtering"
    url: "https://chillicream.com/docs/hotchocolate/fetching-data/filtering"
  - title: "Hot Chocolate: Sorting"
    url: "https://chillicream.com/docs/hotchocolate/fetching-data/sorting"
  - title: "Hot Chocolate: Pagination"
    url: "https://chillicream.com/docs/hotchocolate/fetching-data/pagination"
  - title: "OData Version 4.01. Part 2: URL Conventions (OASIS)"
    url: "https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html"
  - title: "Microsoft Learn: Query options in ASP.NET Core OData 8"
    url: "https://learn.microsoft.com/en-us/odata/webapi-8/fundamentals/query-options"
  - title: "Apollo GraphOS Router: Authorization directives"
    url: "https://www.apollographql.com/docs/graphos/routing/security/authorization"
  - title: "Hot Chocolate: Authorization"
    url: "https://chillicream.com/docs/hotchocolate/security/authorization"
  - title: "Microsoft Learn: Simple authorization in ASP.NET Core"
    url: "https://learn.microsoft.com/en-us/aspnet/core/security/authorization/simple"
  - title: "GraphQL.org: Authorization"
    url: "https://graphql.org/learn/authorization/"
  - title: "Apollo GraphOS: Query plans"
    url: "https://www.apollographql.com/docs/graphos/reference/federation/query-plans"
  - title: "Sam Newman: Backends For Frontends"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "Relay: Thinking in Relay"
    url: "https://relay.dev/docs/principles-and-architecture/thinking-in-relay/"
  - title: "Roy Fielding: Architectural Styles and the Design of Network-based Software Architectures, Chapter 5 (2000)"
    url: "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm"
  - title: "GitHub Docs: Rate limits and query limits for the GraphQL API"
    url: "https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api"
  - title: "Neo4j GraphQL Library documentation"
    url: "https://neo4j.com/docs/graphql/current/"
  - title: "Anthropic: Writing effective tools for agents"
    url: "https://www.anthropic.com/engineering/writing-tools-for-agents"
  - title: "Apollo MCP Server: Define tools"
    url: "https://www.apollographql.com/docs/apollo-mcp-server/define-tools"
  - title: "Apollo MCP Server: Overview"
    url: "https://www.apollographql.com/docs/apollo-mcp-server"
  - title: "PortSwigger Web Security Academy: Bypassing GraphQL brute force protections"
    url: "https://portswigger.net/web-security/graphql/lab-graphql-brute-force-protection-bypass"
  - title: "GraphQL.org: Security"
    url: "https://graphql.org/learn/security/"
  - title: "Shopify: GraphQL Admin API rate limits"
    url: "https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits"
  - title: "Relay: Persisted Queries"
    url: "https://relay.dev/docs/guides/persisted-queries/"
  - title: "Hot Chocolate v15: Persisted Operations"
    url: "https://chillicream.com/docs/hotchocolate/v15/performance/persisted-operations/"
  - title: "Apollo GraphOS: Safelisting with Persisted Queries"
    url: "https://www.apollographql.com/docs/graphos/platform/security/persisted-queries"
  - title: "Benjie Gillam: Trusted Documents"
    url: "https://benjie.dev/graphql/trusted-documents"
  - title: "Sapling: Source control that's user-friendly and scalable (Engineering at Meta, 2022)"
    url: "https://engineering.fb.com/2022/11/15/open-source/sapling-source-control-scalable/"
---

Facebook's 2015 engineering post introducing GraphQL explained where the idea came from: "We don't think of data in terms of resource URLs, secondary keys, or join tables; we think about it in terms of a graph of objects." The line most people quote from that post, that "the shape of the returned data is determined entirely by the client's query," is true, but it's a consequence of the graph, not the reason GraphQL exists. No server team can design an endpoint for every path through a graph that size, so the client has to write the query.

GraphQL solved Facebook's problem, and the burden of proof sits with everyone importing it to show that it solves theirs. I don't think most teams can meet it.

Take away every benefit a team can get without GraphQL, and one thing is left: a client composing its own traversal of a graph the server can't predict. GraphQL's own best practices then steer private APIs away from it, toward a lockdown to operations registered ahead of time, often called persisted queries. That registry is a list of every query the team's clients will send, and a team whose build can produce that list doesn't need the client in control of the query at runtime. What's left is the client team writing its own operations, a need that planning across teams usually removes. Where it doesn't, a backend for that team's own screens keeps each operation designed, so the team needs GraphQL only if its graph outruns every server team.

## Most of GraphQL's Benefits Aren't GraphQL's

The case for adopting GraphQL usually arrives as a bundle of typed contracts, flexible filtering, declarative authorization, one endpoint over many services, and frontends that don't wait on backends. The test for each is whether it needs the client to compose the operation.

### Typed Contracts and Codegen Come From Contract-First APIs

A GraphQL schema gives clients types and generated code, as an OpenAPI document does for HTTP APIs and a Protocol Buffers definition does for gRPC. In contract-first development, the team designs, reviews, and publishes each operation on purpose, so the contract states what the service commits to. A GraphQL schema publishes types and entry points, and the operations that matter, meaning which fields combine at what depth, get written later by whoever calls it. Without a registry, the schema commits the service to every operation its types and limits allow.

### Filtering and Sorting Are the Server's Choice, Not a Query Language

Hot Chocolate, a GraphQL server for .NET and the best-designed one I've used, adds filtering, sorting, and paging to a list with an attribute or two. But each attribute is a server decision about which lists callers may filter, on which fields, and how far they may page, the same decisions an endpoint makes about its query parameters. OData, an OASIS standard for REST APIs, defines those parameters as `$filter`, `$orderby`, `$top`, and `$skip`, and ASP.NET Core supports them. In GraphQL or REST, the client fills in only the parameters the server allowed.

### Field-Level Authorization Is a Cost of Client-Written Operations

Apollo's GraphQL router offers `@authenticated` and `@requiresScopes` directives, and Hot Chocolate offers its own `[Authorize]` attribute that runs the same roles and policies ASP.NET Core applies to an endpoint, so the policy engine isn't GraphQL's. The placement is. An endpoint is a designed operation, so its logic knows what the caller is doing and can delegate each conditional check to the component that owns the rule. A root mutation field is designed like an endpoint, but a read reaches a field through any path a caller writes. A support agent may see a customer's email while working that customer's ticket but not in a sales report the agent can also open, and each endpoint knows which one it serves. In GraphQL the same `Customer.email` field sits under both, so its rule has to inspect the path the caller wrote. A ticket-specific customer type fixes that by designing the operation into the types. Either way, a rule meant for a whole operation decorates the contract. The GraphQL Foundation's own guidance tells production codebases to "delegate authorization logic to the business logic layer."

### One Endpoint Over Many Services Fights the Teams Behind It

Apollo Federation and Hot Chocolate's Fusion put one GraphQL endpoint in front of several services, often for teams without a graph. Each service publishes a subgraph, and a gateway composes them into one schema and splits each query into requests to the services that own the fields.

The stitching a client would have done still happens, in a query planner where the fetches are harder to see. Apollo's query-plan documentation says the router runs subgraph fetches in sequence "whenever one subgraph's response depends on data that first must be returned by another subgraph."

A business product built around domains and bounded contexts gives each team authority over its own model. A federated schema asks every team to contribute types to one shared graph, extend each other's entities, and keep a composition that every other team's changes can block. The bounded contexts are still there, but the schema pretends they aren't.

A backend-for-frontend looks like the same facade but points the other way. Sam Newman describes it as a backend dedicated to one user experience and owned by the team building that interface. A backend-for-frontend calls the domains' own contracts like any client, so authority stays where it was, each domain versions its own contract, and its fan-out sits in code its team wrote and can reshape against its latency budget.

Members of my team once proposed a single query endpoint over our services, and I rejected the prototype we built. It added too much latency for our data-heavy, highly responsive web app, and caching fought it too. Each domain, and often each kind of record, had its own TTL, so one response mixing lifetimes defeated a request-level cache, and caching per source meant streaming every domain's invalidations into a gateway no domain team owned. What worked was each layer caching the data it owned.

One product doesn't prove a rule, and a backend-for-frontend's fan-out pays the same network hops, so the lasting case is ownership. A product without our volatile data, varied lifetimes, and team per bounded context might find a federated graph harmless.

### Fragment Colocation Needs GraphQL but Solves a Team Problem

Relay, Meta's GraphQL client for React, is built around colocated fragments, with each component declaring the data it needs and the compiler nesting those fragments into the queries a screen sends. The best defense of persisted queries says the unpredictability hasn't gone away but moved from runtime to development time, because the server team can't predict what the frontend will need next month.

What colocation buys is frontend convenience, and it pays for that with intentional contracts. The need it serves, a frontend team that can't wait on a backend team, is a planning failure before it's a technical one. Most of a screen's data needs are known when the screen is planned, and leads who set priorities across teams can schedule its endpoint in the same release. If falling behind on tickets justified a new query language, every team with a backlog would need one, and colocation shortens the wait only for data a screen can query. The case for the technology rests on one premise, that the teams can't plan together, and that premise is a needle holding up a foundation. Adopting a tool because it removes a symptom, then collecting reasons it fits, is confirmation bias. Choosing it on purpose means proving its security, performance, stability, and testability against the problem at hand, and slowing down to plan together is how a product speeds up.

Where the team split still blocks work, as when a screen changes mid-build or an experiment varies it, the fix is an ownership change. Colocation already gives the frontend team its operations, and a backend-for-frontend gives it the code behind them, which takes a deployable per client, not a new org chart. Say a listing card on web, iOS, and Android gains its seller's rating. With colocation, each client edits a fragment and its build registers a new document. With a backend-for-frontend, each client team adds the field to its own backend's response in the same release, and old app versions ignore a field they never read. Neither waits on a domain team unless the rating doesn't exist yet, and then both do. Its price, which GraphQL avoids, is a backend per platform, with the pipeline and on-call each one brings, a duplication Newman accepts. But each of those backends is intentional, owned, and measured against what its screens need. GraphQL does save backend development time, one endpoint edit per platform's backend. So do plenty of lapses in discipline, and saved time isn't a benefit until it's weighed against what it leaves behind, here an operation nobody designed. Its authorization can't tell a ticket from a sales report, its cost is checked only if someone reviews it, and it can't open to a partner without a cost model. A backend-for-frontend's endpoint settles each of those in code its team owns.

## What's Left Is a Graph Nobody Can Predict

Facebook's data is a graph in the literal sense. GraphQL started in 2012, when Facebook began rebuilding its iOS and Android apps. Native apps needed "an API data version of News Feed," and where a REST service "may require multiple round-trips," "GraphQL naturally follows relationships between objects."

The screens matter as much as the graph's size. Every item in a feed links to its author, its comments, the people who commented, and the groups and pages it came from, and a reader can follow any of those links to the next view. That data also changes constantly. A designed feed endpoint would have to return every relationship any screen on any client version might open next, or come in a variant per screen and version. Facebook passes every test I can think of, and I agree with its conclusion.

### REST Follows One Link at a Time, GraphQL Follows Many

The round trips Facebook described are what REST does by design. Roy Fielding's dissertation defined REST around hypermedia, where each response carries links to the client's next steps and the client follows one per request. Fielding said the REST interface is "optimizing for the common case of the Web, but resulting in an interface that is not optimal for other forms of architectural interaction." A feed is one of those other forms.

| Screen shape | What fits | Why |
| --- | --- | --- |
| One view at a time, with links to the next | Hypermedia REST, as Fielding defined it | The client follows one link per request |
| Many items per view, each linked to many relationships, in a large graph that changes constantly | GraphQL | One request states the whole traversal |
| Known views taking a few planned paths through data that changes slowly enough to cache | Designed endpoints | The server ships each view's shape and caches what it can |

Most APIs called REST today sit in the third row. They're RPC, designed operations over HTTP or gRPC, often with REST's disciplines but not its hypermedia.

Two questions test a product's screens. Does each item in a list summarize itself and open one detail view, rather than link into many of its relationships? Does the data behind those views change slowly enough for a designed endpoint to serve and cache it? If both answers are yes, hand-written endpoints can keep pace with each new screen. A marketplace passes both. Failing the first is what it means for a graph to outrun every server team, and failing the second takes away the cache a designed endpoint leans on.

### GitHub, Agents, and Graph Databases Face Unpredictable Queries

GitHub's repositories, issues, pull requests, users, and organizations form a graph that callers traverse in ways GitHub can't predict. AI agents also compose queries as they go. Over a graph database such as Neo4j, GraphQL is a thin layer on a graph model. Neo4j's GraphQL Library compiles each operation into "a single Cypher query which is executed against the database."

Agents would be GraphQL's best fit, and the advice still points the other way. Anthropic's guidance on writing tools for agents recommends "a few thoughtful tools targeting specific high-impact workflows." Apollo's Model Context Protocol (MCP) server, which exposes GraphQL to agents as tools, offers an open `execute` tool but steers developers toward governing what agents reach "by adopting predefined persisted queries." Predefining an agent's queries gives up the reason to expose a graph to it, and an MCP server built on predefined operations could wrap RPC endpoints just as well.

### Open Queries Can Be Secured Without a Registry

When callers write their own queries, every caller does, because the endpoint shows in the browser's network tab and the schema is often one introspection query away. A query like `users(first: 100) { friends(first: 100) { friends(first: 100) { name } } }` asks for a million records. Aliases let one request call a login mutation a hundred times, which a per-request rate limiter counts as one attempt, as a PortSwigger Web Security Academy lab teaches.

None of this needs a registry. The GraphQL Foundation's security guidance recommends limiting query depth, applying "a separate smaller limit to how deeply lists can be nested," capping operations per batch, and restricting aliases. Cost analysis prices the rest, weighting each field and charging for what a query could return rather than for the request that carried it, so a hundred aliased logins cost a hundred mutations.

GitHub caps a call at 500,000 nodes and meters each user at 5,000 points an hour, scored by the connections a query could traverse. Shopify's Admin API scores each query from its fields before running it and rejects any over 1,000 points. The price is a cost model the server tunes field by field as the schema grows, which is the work an allowlist avoids.

## GraphQL's Own Best Practices Steer Private APIs Away From the Point

### Trusted Documents Are for First-Party APIs Only

With persisted queries, the client's operations are hashed and registered at build time, and in production the client sends only the hash. Relay, Hot Chocolate's `OnlyAllowPersistedDocuments` option, Apollo's safelisting, and the GraphQL Foundation's "trusted documents" describe the same arrangement.

The GraphQL Foundation offers trusted documents for APIs that only serve first-party clients, and Benjie Gillam, a GraphQL Working Group contributor, calls an allowlist "very much a best practice" for the "vast majority of GraphQL users." The Foundation also says "trusted documents can't be used for public APIs." A private API gives up the open, cost-limited mode that a graph nobody can predict justifies.

### GraphQL Is a Poor Interoperability Contract

The split assumes an API stays on one side of it. In my experience, what starts private often has to interoperate with a partner integration, another department, or a customer who wants their data, and many of those consumers expect HTTP conventions. For every GraphQL endpoint I built, I ended up needing a more RESTful one beside it. A designed contract can often open to outsiders behind auth and rate limits, because each operation's cost is already known, but the locked-down GraphQL API can't serve them as built, and registering partners' operations makes the server team write them, as a designed endpoint would. Opening it, or a second open surface, takes on the cost limits and field weights the registry was there to avoid.

### Persisted Queries Carry the Costs of Both Models

The client team composes each operation, but it can't send anything the server hasn't stored, so the client isn't in control. The server runs each operation, bounds it with its schema, and can refuse documents, but it doesn't choose which fields combine in a request. The client team gives up runtime freedom, the server team gives up design, and both run the registry. Registration in CI keeps attackers' queries out, but only review keeps out a costly one a client team wrote.

### A Monorepo Makes the Registry Cheap

Gillam's write-up says the allowlist practice "has been used within Facebook since before GraphQL was open sourced." So Facebook knew its queries before they ran, though the client build, not a server team, generated a list no server team could have written by hand.

And Facebook's code lives largely in one repository, which Meta's post on its Sapling source control system puts at "tens of millions of files." Meta hasn't written that its persisted queries depend on that, but my reading is that they benefit from it. When client, compiler, and registry change in one commit, the hash is a detail of one build rather than a contract between two teams. Where client and server ship from separate repositories, each client release must reach the registry before it reaches users, and every registered document is one team's code that another team runs, reviewed or not.

Without a graph like Facebook's, making every client team's release depend on a hash registry, so a private API can keep a query language it has locked down, is forcing a square block into a round hole.

## Choose Who Controls the Operation

| | Client in control | Server in control | Persisted queries |
| --- | --- | --- | --- |
| Who defines each operation | Client team, at runtime | Server team, or the screen's team through a backend-for-frontend | Client team, at build time |
| Who stores it | Nobody, it travels with the request | Server code | Server registry |
| Typical technology | Open GraphQL with limits and cost analysis | RPC over HTTP or gRPC, or a backend-for-frontend | GraphQL with trusted documents |
| What it fits | Queries nobody can predict, such as public graph APIs and graph databases | Screens that follow known paths through data that changes slowly enough to cache | Graphs that outrun every server team, where client and server ship together, as in a monorepo |

Unless hand-written endpoints can't keep pace with the paths your screens take, choose server or client control, accept its tradeoffs, and don't build machinery to have both.
