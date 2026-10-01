---
layout: post
title: "The API Gateway Shouldn't Know Your Business"
date: 2026-10-01
description: "Business rules drift into API gateways because the gateway is the cheapest place to apply a rule to every external request, and each one that lands there splits its meaning from its enforcement, misses paths the gateway never sees, and leaves the domain's tests behind. A rule belongs in the gateway only if the gateway's own team could change it correctly, and one that goes there anyway, like an emergency stopgap, goes in as debt with a domain owner and a scheduled removal."
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
  - title: "OWASP API Security Top 10 (2023): API1 Broken Object Level Authorization"
    url: "https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization"
  - title: "Amazon API Gateway Developer Guide: Usage plans and API keys for REST APIs"
    url: "https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html"
  - title: "Sam Newman: Backends For Frontends (2015)"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "NIST SP 800-207: Zero Trust Architecture"
    url: "https://csrc.nist.gov/pubs/sp/800/207/final"
---

I appreciate what an API gateway brings to most systems, at the right time and in the right place. It takes TLS, rate limiting, and access logging off every service's plate, turns away bad tokens at the edge before any service spends work on them, and lets the services behind it move without breaking their clients. But a gateway's configuration also tends to collect things nobody designed it to hold, like a decision about which accounts a user may see, a check on a customer's plan, a response field renamed back so an older version of the mobile app keeps working, or a call to a second service to decide whether the first one should be reached at all. Each of those arrived as a small, sensible change.

That drift isn't always carelessness. The gateway is the cheapest place in the system to apply a rule to every external request, so rules flow toward it. The decade-old advice that business logic doesn't belong there hasn't stopped the drift, because it says where business logic shouldn't go and little about the forces that send it there. A rule belongs in the gateway only if the team that owns the gateway could change it correctly without asking a domain team. Keeping rules out takes an answer to each force, and when an emergency does justify a business rule in the gateway, it goes in as debt, with a domain owner and a scheduled removal.

## A Decade of Warnings Hasn't Stopped the Drift

In March 2014, James Lewis and Martin Fowler described microservices as favoring "smart endpoints and dumb pipes," against the Enterprise Service Bus, whose products "often include sophisticated facilities for message routing, choreography, transformation, and applying business rules." Thoughtworks put "overambitious API gateways" on Hold in its Technology Radar from November 2015 through May 2018. The April 2016 entry calls the pattern "a worrying re-emergence of this disease," the disease being business smarts pushed into middleware, and says that "any domain smarts such as data transformation or rule processing should live in applications or services where they can be controlled by product teams working closely with the domains they support." The radar dropped the entry after 2018, but the features it worried about kept shipping, and the major gateway products today run general-purpose code in the request path.

The vendors agree. Microsoft's Gateway Offloading pattern, the Azure Architecture Center's guidance on moving shared concerns like TLS termination, authentication, and throttling into a gateway, says "Never offload business logic to the gateway." AWS's documentation for REST API mapping templates recommends a proxy integration over transforming data in the gateway when possible.

## Why Rules Drift Into the Gateway

Four forces pull a rule toward the gateway, and each one makes sense to whoever is making the change that day.

### Every External Request Passes Through It

Suppose a rule has to apply to every client of an API: premium customers can export more than 10,000 rows, and everyone else can't. In the services, that rule is a change to the export service, and possibly to each service that exposes a large download. In the gateway, it's one policy that compares the row count in the request against a claim from the caller's token and rejects the request before any service sees it.

### It Ships on a Different Schedule

A gateway policy usually ships as configuration, and a platform team often owns it, so adding the export limit there doesn't wait on the export team's backlog. What the gateway offers is a different queue, not necessarily a faster one. When the export team is busy and the deadline is close, the rule goes wherever it can ship this week.

After that, every change to the export limit waits in the platform team's queue, even when the export team could have shipped it sooner. The Gateway Offloading pattern says offloading doesn't fit when centralizing concerns "creates a change-management bottleneck" because the gateway team's release cycle is slower than the service teams'. The schedule that let the rule in once is the schedule it's stuck with.

### The Product Gives the Rule a Language

A rule can only move into the gateway if the gateway can express it, and gateway products have made sure it can. Amazon API Gateway's REST APIs run mapping templates written in the Velocity Template Language. Azure API Management runs policy expressions written in C#, with conditional `choose` blocks and a `send-request` policy that calls another service and stores its response for later policies to read. Kong's Pre-Function plugin "lets you dynamically run Lua code" inside the gateway. Thoughtworks' later radar entries traced the trend to vendors in a highly competitive market adding features to differentiate their products.

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

### Security Wants One Place to Check

Authorization is often the first business rule to land in the gateway, and the push tends to come from a security group that doesn't trust dozens of service teams to each get it right and wants one place to audit. The gateway already checks tokens, so it looks like that place. The drift starts when the gateway moves from authentication, confirming that a token is well formed, signed, unexpired, and tied to a live session, to authorization, deciding what the caller may do. That tends to begin with a role check on a route and grow into decisions about which records the caller may touch, such as whether a user may export account 4417's data.

## A Gateway Rule Loses Its Owner, Its Coverage, and Its Tests

In the owning service, a rule has one team deciding what it means, runs on every path to the capability it protects, and is tested with the code it governs. In the gateway, it loses all three.

### Its Meaning and Its Enforcement Get Different Owners

The export policy encodes two business facts. There's a plan called premium, and it has a higher export limit than every other plan. The billing or entitlements team decides what plans exist and the export team decides what they allow, but the platform team owns the policy. The Gateway Offloading pattern presents a dedicated gateway team as a benefit for specialized concerns like security. For a business rule, the same arrangement means the team that can change the rule's meaning can't see where it's enforced, and the team that enforces it can't judge whether it's still right.

Consider what happens when sales introduces an enterprise plan. Billing adds `enterprise` to the tier claim, and the policy still compares against `premium`, so enterprise customers, who pay the most, get rejected on large exports. No test fails, because no test in either service ever ran the rule. The fix needs the platform team to change a policy whose meaning they didn't write, once someone realizes it exists.

The same split makes the rule hard to remove. The platform team can see the policy but can't tell whether any client depends on it, and the domain team could answer that but may not know the policy exists. So rules accumulate, each one cheaper to leave than to trace, until the gateway becomes the middleware Lewis and Fowler described, full of routing, transformation, and business rules.

This loss needs separate teams. When one team owns both the gateway and the export service, nothing splits, but that team still loses paths and tests, because those losses come from where the rule runs.

### The Rule Covers Only What the Gateway Can See

The gateway can enforce the rule only on requests that pass through it, and only with what those requests contain.

The first gap is the routes that never cross the gateway. Follow one customer on the free plan who wants 50,000 rows. Calling the public API, they get the 403. Then they click Export in the product's web app, whose backend calls the export service over the internal network, and the export runs. They set up a nightly scheduled export, and the scheduler, acting with its own service identity, publishes an `ExportRequested` message that the export service consumes, and that export runs too. The same customer gets three different answers to the same question depending on the route.

The Gateway Offloading pattern recommends that backends accept requests only through the gateway, which stops outside clients from bypassing it but doesn't help here. The web app's backend and the scheduler are part of the product, the queued message never becomes an HTTP request, and even a scheduler call routed through the gateway would carry the scheduler's identity, with no `tier` claim to read. So the export service needs its own check, and the enterprise-plan change now has to reach two copies of the rule. Without that check, free customers get unlimited exports by scheduling them.

The second gap is on the gateway's own route. The policy reads `rows` from the query string, because a declared row count is all the gateway can see before the export runs. A request that leaves `rows` out defaults to 0, and one that asks for `?from=2020-01-01&to=2026-01-01` never mentions rows at all. Both pass, and the service returns however many rows the query matches. Only the service runs the query, so only the service can enforce the limit on what an export actually produces.

### The Rule Leaves the Domain's Tests

The export team's test suite exercises the export service, not the policy, so the rule has no test that runs when the export service or the plan catalog changes. Gateway logic also gets less checking on its own terms. API Management's documentation says policy expressions have "only limited verification" when defined and run at request time, where any exception becomes a runtime error.

## Keep the Gateway to Rules Its Own Team Can Change

The dividing line is whether the rule is about the request or about the business, and one question tests it: **could the team that owns the gateway change this rule correctly without asking a domain team?**

| Kind of rule | Example | Where it runs | Who decides its meaning |
| --- | --- | --- | --- |
| About the request | Token expiry, request size, per-caller rate limit | Gateway | Gateway team |
| An adapter for a backend that can't change | Renaming fields for a vendor system | Gateway, temporarily | A named team, with a retirement date |
| Composition for one client | One response for a mobile screen | Backend for frontend | That client's team |
| A stopgap during an incident | Blocking large free-plan exports until a fix ships | Gateway, until the fix ships | Domain team, with a removal date |
| A business rule | Export limits by plan | Owning service | Domain team |

Rules about the request, such as TLS termination, token validation, size limits, per-caller rate limits, and access logging, pass the test. Most of them appear among the concerns the Gateway Offloading pattern assigns to a gateway, and their correct values don't change when the business changes its mind. A rule that reads a business concept, such as a plan, sales region, account status, or price, fails, however little code it takes.

Tokens sit on both sides of that line. Rejecting a token that is malformed, badly signed, expired, or tied to a revoked session passes, because what makes a token valid doesn't change when the business does. Any decision about what the caller may do fails, even at the route level, because who counts as an admin and what an admin may do are product decisions. Record-level checks fail most plainly. The gateway sees `/accounts/4417/exports` and a user ID, but only the service that loads account 4417 knows who belongs to it. Broken object level authorization tops the 2023 OWASP API Security Top 10, which describes the check as one "usually implemented at the code level."

Rate limits sit on both sides too. A per-caller limit that protects capacity, such as 100 requests a second per key, passes, because its right value depends on what the system can handle. A quota sold as part of a plan, such as 10,000 API calls a month on the basic tier, fails, even though gateways offer it as a feature. Amazon API Gateway's usage plans attach a quota to each API key, which makes the gateway a second copy of each customer's plan to update on every upgrade and cancellation. AWS's documentation also says those quotas are best-effort and shouldn't be relied on to control costs or block access.

The adapter and composition rows are narrow exceptions. A transformation in front of a backend whose contract can't change, such as a vendor system or a service partway through a migration, can live in the gateway with an owner, a test against the backend, and a recorded change that will retire it. Composition for one client belongs in a backend for frontend, Sam Newman's pattern of a service owned by the team that builds the client. That service owns presentation, not the domain rules behind it.

## Answer Each Force

Under a deadline, the easiest place for a rule wins, so each force needs an answer that makes the owning service as easy a choice.

### Not Every Request Passes Through It

The gateway looks like one change where the services look like several, but it only sees external requests, so the export service needs its own check regardless. Put the check there from the start, and keep plan details out of it. The service asks the team that owns plans for this customer's export limit, as a number, and refuses any export over it. When sales adds an enterprise plan, only the plan team's limits change, and any other service that serves large downloads asks for the same number.

### Borrow the Gateway's Schedule Only as Debt

Sometimes the platform team's shorter queue is exactly what's needed, for a missed deadline or an incident. If a Friday release breaks the export service's limit check and free customers start pulling millions of rows, the platform team can ship the policy above within the hour, long before the export team can safely deploy a fix. Ship it, but ship it as debt:

- **The export team owns the fix,** booked into a specific release the day the policy ships. Once the pressure passes, nothing presses on a policy that seems to work.
- **The policy carries its owner, ticket, and removal date,** so anyone reading the gateway can tell a stopgap from a rule that belongs there.
- **The fix isn't done until the policy is deleted** and the service's own test covers the routes the stopgap never saw.

The borrowed schedule then ends with the export team's release instead of becoming the schedule the rule is stuck with.

### Make the Language Require an Owner

Because the gateway can express almost any rule, a business rule gets in whenever the platform team approves the policy, and that review tends to ask whether the policy works, not whose rule it is. The platform team can't take the language away, but it can stop being the only reviewer. A policy that branches on a claim's value, calls another service, or runs custom code is using the features business rules depend on, so it needs cross-team review from the domain team that owns the concept, or from architecture review when no team clearly owns it. It merges only with the same record a stopgap carries.

### Split Authorization by Who Owns the Facts

Security can get consistent, auditable authorization without the gateway, but how depends on the form of the decision. Role-based decisions, such as who holds the support-agent role or which tenant a user belongs to, rest on facts security or identity already owns, so they can live in one central policy that every service asks on every route. Contextual decisions, such as whether a user may export account 4417 given its status, a legal hold, or the customer's plan, rest on domain facts that change in real time. Centralizing those repeats the gateway's split one layer over, so they stay in the domain service, written and tested by the team that owns the facts.

Where security doesn't own the rules, it can still own how every service enforces them. Shared middleware can reject any request a service doesn't explicitly allow, so a forgotten check refuses access instead of granting it, and every service can record its authorization decisions in one shared log for security to audit.

Either way, the check runs in the service. A gateway-only check leaves the web app and scheduler routes trusted because they run inside the network, and NIST's zero trust architecture, SP 800-207, rejects that assumption, holding that there's no "implicit trust granted to assets or user accounts based solely on their physical or network location."

## Find the Business Rules Already in Your Gateway

Open your gateway's configuration this week, whether that's policies, plugins, mapping templates, or route rules, and go through it with these questions:

- **List every rule that references a business concept.** Searching for claim names and domain terms finds most of them.
- **Find the service that owns each concept,** and ask whether the gateway team could change the rule correctly without asking that service's team.
- **Find every authorization rule,** from route role checks to record access, and move it into the service, with role decisions in a central policy.
- **Trace every path to the capability the rule protects,** including jobs, consumers, internal tools, and other gateways.
- **Find the test that fails when the rule breaks.** If the owning service has none, the rule is unverified.
- **Give each stopgap and transformation an owner and a removal date,** and add the pipeline check that enforces them. One with neither is business logic that stayed.
