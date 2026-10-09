---
layout: post
title: "GraphQL Solved Facebook's Problem. Does It Solve Yours?"
date: 2026-10-07
description: "GraphQL let Facebook's clients write their own queries because no server team could predict every path through its graph. Every team importing it has to show it has the same problem, and a team that locks GraphQL down to persisted queries has already listed every query it will send, so it needs GraphQL only if new queries arrive faster than anyone could hand-write them."
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
  - title: "GraphQL.org: Authorization"
    url: "https://graphql.org/learn/authorization/"
  - title: "Apollo GraphOS Router: Authorization directives"
    url: "https://www.apollographql.com/docs/graphos/routing/security/authorization"
  - title: "Hot Chocolate: Authorization"
    url: "https://chillicream.com/docs/hotchocolate/security/authorization"
  - title: "Microsoft Learn: Simple authorization in ASP.NET Core"
    url: "https://learn.microsoft.com/en-us/aspnet/core/security/authorization/simple"
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

Facebook's 2015 engineering post introducing GraphQL explained where the idea came from: "We don't think of data in terms of resource URLs, secondary keys, or join tables; we think about it in terms of a graph of objects." The line most people quote from that post is that "the shape of the returned data is determined entirely by the client's query." That's true, but it's a consequence of the graph, not the reason GraphQL exists. No server team can design an endpoint for every path through a graph that size, across every app version reading it, so the client has to write the query.

GraphQL solved Facebook's problem, and the burden of proof sits with everyone importing it to show that it solves theirs. I don't think most teams can meet it.

Most of what teams adopt GraphQL for is available without it. Take those benefits away and the main thing left is a client composing its own traversal of a graph the server can't predict.

GraphQL's own best practices then steer private APIs away from even that. They recommend registering every operation ahead of time as a persisted query, so the server knows each query before it runs.

Registered queries still let client teams write their own operations, just not at runtime. Planning across teams, or a backend for their screens, usually gives client teams the same control without GraphQL. A team needs GraphQL only if its graph needs new operations faster than anyone could hand-write them, as Facebook's did.

## Most of GraphQL's Benefits Aren't GraphQL's

The case for adopting GraphQL usually arrives as a bundle: typed contracts, payloads shaped to each screen, flexible filtering, declarative authorization, one endpoint over many services, and frontends that don't wait on backends. For each, the test is whether the client must compose the operation. Most don't.

### Typed Contracts and Codegen Come From Contract-First APIs

A GraphQL schema gives clients types and generated code, as an OpenAPI document does for an HTTP API and a Protocol Buffers definition does for gRPC. What differs is what the contract commits the service to.

In contract-first development, the team designs and publishes each operation on purpose, so the contract states what the service supports. A GraphQL schema publishes types and entry points instead. The operations that matter, meaning which fields combine at what depth, get written later by whoever calls it. Without persisted queries, the schema commits the service to every operation its types and limits allow.

### Filtering and Sorting Are the Server's Choice, Not a Query Language

Hot Chocolate, a GraphQL server for .NET and the best-designed one I've used, adds filtering, sorting, and paging to a list with an attribute or two. But each attribute is the server choosing which lists callers may filter, on which fields, and how far they may page.

An endpoint makes the same choices about its query parameters. OData, an OASIS standard for REST APIs, standardizes those parameters as `$filter`, `$orderby`, `$top`, and `$skip`, and ASP.NET Core lets each endpoint allow only the ones it chooses.

### Field-Level Authorization Is a Cost of Client-Written Operations

The policy engine behind GraphQL authorization isn't GraphQL's, and the GraphQL Foundation tells production codebases to "delegate authorization logic to the business logic layer." Apollo's router offers `@authenticated` and `@requiresScopes` directives, and Hot Chocolate's `[Authorize]` attribute runs the same roles and policies ASP.NET Core applies to an endpoint. What GraphQL changes is where the check has to sit.

An endpoint is a designed operation, so its code knows what the caller is doing and can apply the rule that fits. In GraphQL, a read can reach a field through any path the schema's types allow. Only root mutations are designed like endpoints.

Say a support agent may see a customer's email while working that customer's ticket, but not in a sales report the agent can also open. In GraphQL, the same `Customer.email` field sits under both. A check on the field alone can confirm the agent has an open ticket with that customer, but it can't see the report, so the email shows there too. So the rule needs the parent the caller came through.

A ticket-specific customer type would fix that, as a ticket DTO would in REST. Either fix works, but an endpoint exposes only the paths its designer wrote, while a schema must be right for every path its types allow.

### One Endpoint Over Many Services Fights the Teams Behind It

Apollo Federation and Hot Chocolate's Fusion put one GraphQL endpoint in front of several services, often for teams with predictable queries. Each service publishes a subgraph, and a gateway composes them into one schema and splits each query into requests to the services that own the fields.

The stitching a client would have done still happens, in a query planner where the fetches are harder to see. Apollo's query-plan documentation says the router runs subgraph fetches in sequence "whenever one subgraph's response depends on data that first must be returned by another subgraph."

A product built around bounded contexts gives each team authority over its own model. A federated schema asks for the opposite. Every team contributes types to one shared graph, extends other teams' entities, and passes a composition check that another team's conflicting change can fail. The bounded contexts are still there, but the schema pretends they aren't.

A backend-for-frontend looks like the same facade but points the other way. Sam Newman describes it as a backend dedicated to one user experience and owned by the team building that interface. It calls each domain's published contract like any client, so each domain keeps its own schedule and authority. Its fan-out sits in code its team owns and can tune, and it shapes each response to its screens, so clients don't over-fetch.

Members of my team once proposed a single query endpoint over our services, and I rejected the prototype we built. It added too much latency for our data-heavy, highly responsive web app, and it fought our caching. Each domain, and often each kind of record, had its own TTL. One response mixing those lifetimes defeated a request-level cache, and caching per source meant streaming every domain's invalidations into a gateway no domain team owned. What worked was each layer caching the data it owned.

Latency isn't the lasting case against federation, since a backend-for-frontend's fan-out pays the same network hops. Ownership is. One product doesn't prove a rule, and a product without our volatile data, varied cache lifetimes, and team per bounded context might find a federated graph harmless.

### Fragment Colocation Needs GraphQL but Solves a Team Problem

Relay, Meta's GraphQL client for React, is built around colocated fragments. Each component declares the data it needs, and the compiler nests those fragments into the queries a screen sends.

GraphQL's defenders build on this, arguing that even when every query is registered ahead of time, the unpredictability hasn't gone away. It has moved from runtime to development time, because the server team can't predict what the frontend will need next month.

Colocation buys frontend convenience, and it pays for it by giving up intentional contracts. The need it serves, a frontend team that can't wait on a backend team, is a planning failure before it's a technical one. Most of a screen's data needs show in its design before it's built, and leads who set priorities across teams can schedule its endpoint in the same release.

So this case for the technology rests on one premise, that the teams can't plan together, and that premise is a needle holding up a foundation.

Adopting GraphQL because it removes that wait, and then collecting reasons it fits, invites confirmation bias. Choosing it on purpose means proving its security, performance, stability, and testability against the problem at hand. Slowing down to plan together is how a product speeds up.

Even good planning can't always keep pace, as when a screen changes mid-build or an experiment varies it. Then the frontend team needs to own its operations, and a backend-for-frontend can give it that as well as colocation can.

Say a listing card on web, iOS, and Android gains its seller's rating. With colocation, each client edits a fragment and its build registers a new document. With a backend-for-frontend, each client team adds the field to its own backend's response in the same release. Neither waits on a domain team unless the rating doesn't exist yet, and then both do.

Each fix has a price. A backend-for-frontend needs a backend per platform, each with its own pipeline and on-call. Colocation avoids that and saves an endpoint edit per backend. But saved time isn't a benefit until it's weighed against what it leaves behind.

What colocation leaves behind, whoever owns the GraphQL layer, is an operation no server code was written for. It carries the authorization problem above. Only registered paths run, but no server team chose them. A backend-for-frontend's endpoint settles that check in code its team owns.

## What's Left Is a Graph Nobody Can Predict

GraphQL started in 2012, when Facebook began rebuilding its iOS and Android apps. Native apps needed "an API data version of News Feed," and where a REST service "may require multiple round-trips," "GraphQL naturally follows relationships between objects."

Every item in a feed links to its author, its comments, the people who commented, and the groups and pages it came from. A reader can follow any of those links to the next view. That data also changes constantly. A designed feed endpoint would have to return every relationship any screen on any client version might open next, or come in a variant per screen and version. Facebook meets the burden of proof, and I agree with its conclusion.

### REST Follows One Link at a Time, GraphQL Follows Many

The round trips Facebook described are what REST does by design. Roy Fielding's dissertation defined REST around hypermedia, where each response carries links to the client's next steps and the client follows one per request. Fielding said the REST interface is "optimizing for the common case of the Web, but resulting in an interface that is not optimal for other forms of architectural interaction." A feed is one of those other forms.

| Screen shape | What fits | Why |
| --- | --- | --- |
| One view at a time, with links to the next | Hypermedia REST, as Fielding defined it | One request per link |
| Many items per view, each linked to many relationships, in a large graph that changes constantly | GraphQL | One request states the whole traversal |
| Known views taking a few planned paths through data that changes slowly enough to cache | Designed endpoints | The server ships each view's shape and caches what it can |

Most APIs called REST today sit in the third row. They're RPC, designed operations over HTTP.

Every relationship a list item opens adds operations. For a first-party product, two questions test, screen by screen, whether its operations outrun hand-written endpoints:

1. Does each item in a list summarize itself and open one detail view, rather than link into many of its relationships?
2. Does the data behind those views change slowly enough for a designed endpoint to serve and cache it?

If both answers are yes for most screens, hand-written endpoints can keep pace. A marketplace's listing and detail screens pass both, since each card opens one listing whose text and photos are read far more often than they change.

Volatile data alone doesn't sink a designed endpoint. It hurts when items also link into many relationships, because everything returned just in case must then be fetched fresh.

### GitHub, Agents, and Graph Databases Face Unpredictable Queries

GitHub's repositories, issues, pull requests, users, and organizations form a graph that third-party callers traverse in ways GitHub can't predict, so no screen test applies. Over a graph database such as Neo4j, GraphQL is a thin layer on a graph model, and Neo4j's GraphQL Library compiles each operation into "a single Cypher query which is executed against the database."

AI agents compose queries as they go, which should make them GraphQL's best fit, yet most advice points them toward designed tools. Anthropic's agent-tool guidance recommends "a few thoughtful tools targeting specific high-impact workflows." Apollo's Model Context Protocol server, which exposes GraphQL as agent tools, offers an open `execute` tool but steers developers toward governing what agents reach "by adopting predefined persisted queries." Predefining an agent's queries gives up the reason to expose a graph to it, and those operations could just as well be RPC endpoints.

### Open Queries Can Be Secured Without a Registry

These cases need open queries, and a server that accepts them accepts them from anyone, because the endpoint shows in the browser's network tab and the schema is often one introspection query away. A query like `users(first: 100) { friends(first: 100) { friends(first: 100) { name } } }` asks for a million records. Aliases let one request call a login mutation a hundred times, and a per-request rate limiter counts that as one attempt, as a PortSwigger lab shows.

The GraphQL Foundation's security guidance recommends limiting query depth, applying "a separate smaller limit to how deeply lists can be nested," capping operations per batch, and restricting aliases. Cost analysis prices the rest. It weights each field and charges for what a query could return rather than for the request that carried it, so a hundred aliased logins cost a hundred mutations.

GitHub caps a call at 500,000 nodes and meters each user at 5,000 points an hour, scored by the connections a query could traverse. Shopify's Admin API scores each query from its fields before running it and rejects any over 1,000 points. The price is a cost model the server tunes field by field as the schema grows.

## GraphQL's Own Best Practices Steer Private APIs Away From the Point

### Trusted Documents Are for First-Party APIs Only

For private APIs, GraphQL's own guidance avoids tuning a cost model. It refuses any query the server hasn't seen. With persisted queries, the client's operations are hashed and registered at build time, and in production the client sends only the hash. Relay, Hot Chocolate's `OnlyAllowPersistedDocuments` option, Apollo's safelisting, and the GraphQL Foundation's "trusted documents" describe the same arrangement.

Benjie Gillam, a GraphQL Working Group contributor, calls an allowlist "very much a best practice" for the "vast majority of GraphQL users." The GraphQL Foundation adds that "trusted documents can't be used for public APIs." So for a private API, the recommended practice gives up open queries and leaves client teams composing operations at build time.

### Serving Partners Brings Back the Cost Model

In my experience, what starts private often has to interoperate later, with a partner integration, another department, or a customer who wants their data. Some of those consumers expect HTTP conventions, such as per-resource URLs and HTTP caching. For every GraphQL endpoint I built, I ended up needing a more RESTful one beside it.

A designed contract can often open to outsiders behind auth and rate limits, because the server chose each operation and parameter, bounding its cost. The locked-down GraphQL API can't serve them as built. Registering operations for partners means the server team writes each one anyway. A gateway that translates for partners only moves those endpoints into infrastructure no domain team owns. Opening the API, or adding an open surface beside it, brings back the cost model the registry avoided.

### Persisted Queries Carry the Costs of Both Models

Under persisted queries, the client team composes each operation, but it can't send anything the server hasn't stored. The server runs and can refuse each document, but it doesn't choose which fields combine in a request. The client gives up runtime freedom, and the server gives up design.

Both teams run the registry. Its clearest advantage is that it ties each field to the builds that read it, which makes deprecation safe, especially with long-lived mobile apps. A backend-for-frontend matches that only by keeping each release's response version until its last app build retires.

Registration in CI keeps attackers' queries out, but not a teammate's costly one. No server author designed that document's field combination, so catching its cost means reviewing or scoring each document at registration.

### A Monorepo Makes the Registry Cheaper

Gillam's write-up says the allowlist practice "has been used within Facebook since before GraphQL was open sourced." So Facebook did know its queries before they ran, but only because its client build generated the list, which no team could have written by hand.

Facebook's code also lives largely in one repository, which Meta's post on its Sapling source control system puts at "tens of millions of files." Meta hasn't said its persisted queries depend on that, but I read them as benefiting from it. When client, compiler, and registry change in one commit, the hash is a detail of one build rather than a contract between two teams.

Where client and server ship from separate repositories, the registry becomes that contract. And without a graph like Facebook's, that registry exists only so a private API can keep a query language it has locked down. Keeping a query language only to lock it down is forcing a square block into a round hole.

## Choose Who Controls the Operation

| | Client in control | Server in control | Persisted queries |
| --- | --- | --- | --- |
| Who defines each operation | Client team, at runtime | Server team, or the screen's team through a backend-for-frontend | Client team, at build time |
| Who stores it | Nobody, it travels with the request | Server code | Server registry |
| Typical technology | Open GraphQL with limits and cost analysis | RPC over HTTP or gRPC, or a backend-for-frontend | GraphQL with trusted documents |
| What it fits | Queries nobody can predict, such as public graph APIs, agents whose tasks can't be listed in advance, and graph databases | Screens that follow known paths through data that changes slowly enough to cache | Graphs whose operations outrun hand-written endpoints, cheapest where client and server ship together |

Outside the persisted-query column's narrow case, choose server or client control and accept its tradeoffs.
