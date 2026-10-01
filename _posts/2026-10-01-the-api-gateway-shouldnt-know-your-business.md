---
layout: post
title: "The API Gateway Shouldn't Know Your Business"
date: 2026-10-01
description: "Business rules drift into API gateways because the gateway is the cheapest place to apply a rule to every external request, and each one that lands there splits its meaning from its enforcement, misses paths the gateway never sees, and leaves the domain's tests behind. A rule belongs in the gateway only if the gateway's own team could change it correctly."
tags: [architecture, api-gateway, api-design, microservices, ownership]
author: steven-stuart
sources:
  - title: "James Lewis and Martin Fowler: Microservices (2014)"
    url: "https://martinfowler.com/articles/microservices.html"
  - title: "Thoughtworks Technology Radar: Overambitious API gateways"
    url: "https://www.thoughtworks.com/radar/platforms/overambitious-api-gateways"
  - title: "Azure Architecture Center: Gateway Offloading pattern"
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading"
  - title: "Amazon API Gateway Developer Guide: Mapping template transformations for REST APIs"
    url: "https://docs.aws.amazon.com/apigateway/latest/developerguide/models-mappings.html"
  - title: "Azure API Management: Policy expressions"
    url: "https://learn.microsoft.com/en-us/azure/api-management/api-management-policy-expressions"
  - title: "Azure API Management policy reference: send-request"
    url: "https://learn.microsoft.com/en-us/azure/api-management/send-request-policy"
  - title: "Kong Gateway: Pre-Function plugin"
    url: "https://developer.konghq.com/plugins/pre-function/"
  - title: "Amazon API Gateway Developer Guide: Usage plans and API keys for REST APIs"
    url: "https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html"
  - title: "Sam Newman: Backends For Frontends (2015)"
    url: "https://samnewman.io/patterns/architectural/bff/"
---

I appreciate what an API gateway brings to most systems, at the right time and in the right place. It takes TLS, rate limiting, and access logging off every service's plate, turns away bad tokens at the edge before any service spends work on them, and lets the services behind it move without breaking their clients. But a gateway's configuration also tends to collect things nobody designed it to hold, like a check on a customer's plan, a response field renamed back so an older version of the mobile app keeps working, or a call to a second service to decide whether the first one should be reached at all. Each of those arrived as a small, sensible change.

That drift isn't always carelessness. The gateway is the cheapest place in the system to apply a rule to every external request, so rules flow toward it. Each rule that lands there gives its meaning and its enforcement different owners, applies only to the requests that happen to cross the gateway, and leaves the tests of the domain it belongs to. Advice that business logic doesn't belong in the gateway has been standard for a decade. It hasn't stopped the drift, because it says where business logic shouldn't go and little about the forces that send it there. A rule belongs in the gateway only if the team that owns the gateway could change it correctly without asking a domain team.

## A Decade of Warnings Hasn't Stopped the Drift

In March 2014, James Lewis and Martin Fowler described microservices as favoring "smart endpoints and dumb pipes," against the Enterprise Service Bus, whose products "often include sophisticated facilities for message routing, choreography, transformation, and applying business rules." Thoughtworks put "overambitious API gateways" on Hold in its Technology Radar from November 2015 through May 2018. The April 2016 entry calls the pattern "a worrying re-emergence of this disease," the disease being business smarts pushed into middleware, and says that "any domain smarts such as data transformation or rule processing should live in applications or services where they can be controlled by product teams working closely with the domains they support." The last entry, in May 2018, said these products' functionality "encourages designs that continue to be difficult to test and deploy." The radar dropped the entry after that, but the features it worried about kept shipping, and the major gateway products today run general-purpose code in the request path.

The vendors agree. Microsoft's Gateway Offloading pattern, the Azure Architecture Center's guidance on moving shared concerns like TLS termination, authentication, and throttling out of services and into a gateway, lists among its considerations "Never offload business logic to the gateway." AWS's own documentation for REST API mapping templates recommends that, when possible, teams use a proxy integration instead of transforming data in the gateway.

## Why Rules Drift Into the Gateway

Three forces pull a rule toward the gateway, and each one makes sense to whoever is making the change that day.

### Every External Request Passes Through It

Suppose a rule has to apply to every client of an API: premium customers can request an export of more than 10,000 rows, and everyone else can't. In the services, that rule is a change to the export service, and possibly to each service that exposes a large download. In the gateway, it's one policy that compares the row count in the request against a claim from the caller's token and rejects the request before any service sees it. The gateway is the one component in front of all those services, so for any rule that spans them, it offers a version that takes one change.

### It Ships on a Different Schedule

A gateway policy usually ships as configuration, and a platform team often owns it. Adding the export limit as a policy doesn't wait on the export service's release train or the export team's backlog. What the gateway offers is a different queue, not necessarily a faster one. When the export team is busy and the deadline is close, the rule goes wherever it can ship this week, and that week the platform team's queue is shorter.

After that, every change to the export limit waits in the platform team's queue, even in a week when the export team could have shipped it sooner. The Gateway Offloading pattern lists this among the cases where offloading doesn't fit, when centralizing concerns "creates a change-management bottleneck" because the gateway team's release cycle is slower than the service teams'. The schedule that let the rule in once is the schedule it's stuck with.

### The Product Gives the Rule a Language

A rule can only move into the gateway if the gateway can express it, and gateway products have made sure it can. Amazon API Gateway's REST APIs run mapping templates written in the Velocity Template Language. Azure API Management runs policy expressions written in C#, with conditional `choose` blocks and a `send-request` policy that calls another service and stores its response for later policies to read. Kong's Pre-Function plugin "lets you dynamically run Lua code" inside the gateway. Thoughtworks' later "overambitious API gateways" entries traced the trend to this pressure, noting that vendors in a highly competitive market keep adding features to differentiate their products.

Written as an API Management policy, the export rule is short, it works, and it is business logic:

```xml
<inbound>
  <base />
  <choose>
    <when condition="@(
        context.Request.Headers.GetValueOrDefault("Authorization", "")
            .Split(' ').Last().AsJwt()?.Claims.GetValueOrDefault("tier", "") != "premium"
        && int.Parse(context.Request.Url.Query.GetValueOrDefault("rows", "0")) > 10000)">
      <return-response>
        <set-status code="403" reason="Export limit exceeded for plan" />
      </return-response>
    </when>
  </choose>
</inbound>
```

None of these three forces says anything about who should own the rule.

## What a Rule Loses When It Moves

In the owning service, a rule has one team deciding what it means, runs on every path to the capability it protects, and is tested with the code it governs. In the gateway, it loses all three.

### Its Meaning and Its Enforcement Get Different Owners

The rule above encodes two business facts. There's a plan called premium, and it has a higher export limit than every other plan. Neither fact belongs to the platform team that owns the gateway. The billing or entitlements team decides what plans exist, and the export team decides what they allow. The Gateway Offloading pattern presents a dedicated gateway team as a benefit, letting specialists own specialized concerns like security. For a business rule, that same arrangement means the team that can change the rule's meaning can't see where it's enforced, and the team that enforces it can't judge whether the rule is still right.

Consider what happens when sales introduces an enterprise plan. Billing adds `enterprise` to the tier claim, and the policy still compares against `premium`. Enterprise customers, who pay the most, now get rejected on large exports. No test fails, because no test in the export service or the billing service ever ran the rule. The fix needs the platform team to change a policy whose meaning they didn't write, and someone has to realize the policy exists first.

The same split makes the rule hard to remove. Adding it took one team, but removing it takes two. The platform team can see the policy but can't tell whether any client depends on it, and the domain team could answer that but may not know the policy exists. So rules accumulate, each one cheaper to leave than to trace. Run long enough, that ratchet produces the middleware Lewis and Fowler described, full of routing, transformation, and business rules, which is the disease Thoughtworks saw re-emerging in API gateway products.

This first loss only happens when different teams own the gateway and the export service. In a small organization where one team owns both, the people who define the plans can also see the policy, so nothing splits. The other two losses come from where the rule runs, not from who owns it, so even that team loses paths and tests by putting the rule in the gateway.

### The Rule Covers Only What the Gateway Can See

The gateway can enforce the rule only on requests that pass through it, and only with what those requests contain. Each of those boundaries leaves a gap.

The first gap is the routes that never cross the gateway. Follow one customer on the free plan who wants 50,000 rows. Calling the public API, they get the 403. Then they click Export in the product's web app, whose backend calls the export service over the internal network, and the export runs. They set up a nightly scheduled export, and the scheduler, acting with its own service identity, publishes an `ExportRequested` message that the export service consumes, and that export runs too. The gateway sits in front of the public API, not in front of the export capability, so the same customer gets three different answers to the same question depending on the route.

The Gateway Offloading pattern recommends configuring backends to accept requests only through the gateway, so that clients can't bypass it. That stops an outside client calling the export service directly, but it doesn't help here. The web app's backend and the scheduler are part of the product, not outside clients. The queued message never becomes an HTTP request the gateway could inspect. Even if the scheduler's call went through the gateway, it carries the scheduler's identity rather than the customer's token, so there's no `tier` claim to read.

So the export service still has to decide what to do with a 50,000-row request from a free customer that arrived off a queue. If it enforces the limit too, the rule now lives in a C# check and a gateway policy, and the enterprise-plan change has to land in both. If it doesn't, free customers get unlimited exports by scheduling them.

The second gap is on the gateway's own route. The policy reads `rows` from the query string, because a row count the client declares is all the gateway can see before the export runs. A request that leaves `rows` out falls back to the policy's default of 0, and one that asks for `?from=2020-01-01&to=2026-01-01` never mentions rows at all. Both pass the check, and the service returns however many rows the query matches. Only the service can enforce the limit on the rows an export actually produces, because only the service runs the query.

### The Rule Leaves the Domain's Tests

The export team's test suite exercises the export service. The policy sits outside it, so the business rule it encodes has no test that runs when the export service or the plan catalog changes. Gateway logic also gets less checking on its own terms. API Management's documentation says policy expressions have "only limited verification" when defined and run in the gateway at request time, where any exception becomes a runtime error.

## Keep the Gateway to Rules Its Own Team Can Change

The dividing line is whether the rule is about the request or about the business, and one question tests it: **could the team that owns the gateway change this rule correctly without asking a domain team?**

| Kind of rule | Example | Where it runs | Who decides its meaning |
| --- | --- | --- | --- |
| About the request | Token expiry, request size, per-caller rate limit | Gateway | Gateway team |
| An adapter for a backend that can't change | Renaming fields for a vendor system | Gateway, temporarily | A named team, with a retirement date |
| Composition for one client | One response for a mobile screen | Backend for frontend | That client's team |
| A business rule | Export limits by plan | Owning service | Domain team |

Rules about the request, such as TLS termination, token checks, size limits, per-caller rate limits, and access logging, pass the test. Most of them appear among the cross-cutting concerns that the Gateway Offloading pattern assigns to a gateway, and their correct values don't change when the business changes its mind. A rule that reads a business concept, such as a plan, sales region, account status, or price, fails it, however little code it takes.

Token checks sit on both sides of that line, which is why the export policy can pass for a token check. Rejecting a token that has expired or lacks the scope a route requires passes, because the gateway checks that the scope is present without interpreting what it grants. Reading a claim's value to decide how much the caller gets, as the export policy does with `tier`, is the export rule again.

Rate limits sit on both sides of the line too. A per-caller limit set to protect capacity, such as 100 requests a second per key so one client can't starve the rest, passes, because its right value depends on what the system can handle, not on what the customer bought. A quota sold as part of a plan, such as 10,000 API calls a month on the basic tier, is the export rule again, even though gateways offer it as a feature. Amazon API Gateway's usage plans attach a quota to each API key, but keeping it correct means updating the gateway on every signup, upgrade, downgrade, and cancellation, which turns the gateway into a second copy of each customer's plan. AWS's own documentation adds that usage plan quotas are best-effort, that clients can exceed them, and that teams shouldn't rely on them to control costs or block access.

Keeping business rules out of the gateway doesn't bring back the first force's problem, a rule that spans several services. Moving the export limit out of the gateway doesn't mean copying "premium allows more than 10,000 rows" into every service that serves a large download. The entitlements service owns the decision and publishes its result, such as a per-customer row limit returned by a lookup or issued as a numeric claim. Each service compares the request against that number without knowing what plans exist, so an enterprise plan becomes a change to one service's data rather than to every enforcement point.

The other two rows are narrow exceptions. A transformation in front of a backend whose contract can't change, such as a vendor system or a service partway through a migration, is a defensible use of the gateway if it has a named owner, a test against the backend it adapts, and a recorded change that will retire it. Composing several services into one response for a particular client belongs in a backend for frontend, Sam Newman's pattern of a service owned by the team that builds the client. That service owns presentation for its client, not the domain rules behind it.

## Find the Business Rules Already in Your Gateway

Open your gateway's configuration this week, whether that's policies, plugins, mapping templates, or route rules, and go through it with these questions:

- **List every rule that references a business concept.** Searching for claim names and domain terms finds most of them.
- **Find the service that owns each concept,** and ask whether the gateway team could change the rule correctly without asking that service's team.
- **Trace every path to the capability the rule protects,** including jobs, consumers, internal tools, and other gateways.
- **Find the test that fails when the rule breaks.** If the owning service has none, the rule is unverified.
- **Write down each transformation's owner and the change that retires it.** One with neither is business logic that stayed.

