---
layout: post
title: "The API Gateway Shouldn't Know Your Business"
description: "Business rules drift into API gateways because the gateway is the cheapest place to apply a rule to every external request. Each rule that lands there splits its meaning from its enforcement, covers only the paths that cross the gateway, and leaves the domain's tests behind."
tags: [architecture, api-gateway, api-design, microservices, ownership]
author: steven-stuart
sources:
  - title: "Thoughtworks Technology Radar: Overambitious API gateways"
    url: "https://www.thoughtworks.com/radar/platforms/overambitious-api-gateways"
  - title: "James Lewis and Martin Fowler: Microservices (2014)"
    url: "https://martinfowler.com/articles/microservices.html"
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
  - title: "Sam Newman: Backends For Frontends (2015)"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "Gateway and Proxy Patterns"
    url: "/study-guides/architecture/deployment_infrastructure_patterns.html"
  - title: "AWS API Gateway for System Architects"
    url: "/study-guides/infrastructure/aws/aws-api-gateway.html"
  - title: "Service-Oriented Architecture (SOA)"
    url: "/study-guides/architecture/soa-architecture.html"
---

Your gateway has a pricing rule. Which team owns it?

I like API gateways. They take TLS, token validation, rate limiting, and access logging off every service's plate, and they let the services behind them move without breaking a single client. But a gateway's configuration also tends to collect things nobody designed it to hold, like a check on a customer's plan, a field renamed for one mobile app, or a call to a second service to decide whether the first one should be reached at all. Each of those arrived as a small, sensible change.

My argument is that the drift isn't carelessness. The gateway is the cheapest place in the system to apply a rule to every external request, so rules flow toward it. Each rule that lands there gives its meaning and its enforcement different owners, applies only to the requests that happen to cross the gateway, and leaves the tests of the domain it belongs to. Knowing that business logic doesn't belong in the gateway has been standard advice for a decade, and it hasn't stopped the drift, because the advice names the outcome and not the forces that produce it.

> **AUTHOR** — the author's experience goes here: gateways in front of the banking and financial research platforms, and what their configuration had accumulated.

## A Decade of Warnings Hasn't Stopped the Drift

In March 2014, James Lewis and Martin Fowler described microservices as favoring "smart endpoints and dumb pipes," against the Enterprise Service Bus, whose products "often include sophisticated facilities for message routing, choreography, transformation, and applying business rules." Thoughtworks put "overambitious API gateways" on Hold in its Technology Radar from November 2015 through May 2018. The April 2016 entry calls the pattern "a worrying re-emergence of this disease," the disease being business smarts pushed into middleware, and says that "any domain smarts such as data transformation or rule processing should live in applications or services where they can be controlled by product teams working closely with the domains they support."

The vendors agree. Microsoft's Gateway Offloading pattern, in the Azure Architecture Center, lists among its considerations "Never offload business logic to the gateway." AWS's own documentation for REST API mapping templates recommends that, when possible, teams use a proxy integration instead of transforming data in the gateway.

So the advice is settled and widely read. What it doesn't say is why a team that has read it still ends up with a customer-tier check in its gateway policy. For that, look at what it costs to put a rule anywhere else.

## Why Rules Drift Into the Gateway

Three forces pull a rule toward the gateway, and each one is local and reasonable at the moment it acts.

### Every External Request Passes Through It

Suppose a rule has to apply to every client of an API: premium customers can export more than 10,000 rows, and everyone else can't. In the services, that rule is a change to the export service, and possibly to each service that exposes a large download. In the gateway, it's one policy that reads a claim from the caller's token and rejects the request before any service sees it. The gateway is the only component positioned in front of all of them, so it offers the one-change version of every cross-service rule.

### It Ships on a Different Schedule

A gateway policy usually changes through configuration, often owned by a platform team, and it doesn't wait on the owning service's release train or its backlog. When the domain team is busy and the deadline is close, the rule goes where it can ship this week. But from then on, the rule changes at the gateway team's pace, not the domain's, and that pace slows as more teams' rules share one configuration. Microsoft's pattern lists exactly this as a reason not to offload. If the gateway team's release cycle is slower than the service teams', centralizing a concern "creates a change-management bottleneck." A rule enters the gateway because it was the faster path, and it stays there after it has become the slower one.

### The Product Gives the Rule a Language

A rule can only move into the gateway if the gateway can express it, and gateway products have made sure it can. Amazon API Gateway's REST APIs run mapping templates written in the Velocity Template Language. Azure API Management runs policy expressions written in C#, with conditional `choose` blocks and a `send-request` policy that calls another service and stores its response for later policies to read. Kong's Pre-Function plugin "lets you dynamically run Lua code" inside the gateway. The Radar's complaint was aimed at exactly this, gateway products that invite logic because they sell it.

Here is the export rule written as an API Management policy. It is short, it works, and it is business logic:

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

The position makes the gateway the cheapest place to put the rule, the schedule makes it the fastest, and the product makes it possible. None of those says anything about who should own the rule.

## What a Rule Loses When It Moves

A rule's authority has two parts: who decides what it means, and what enforces it. In the owning service they're the same team and the same code. Moving the rule to the gateway costs it four things.

### Its Meaning and Its Enforcement Get Different Owners

The rule above encodes two business facts. There's a plan called premium, and it has a higher export limit than every other plan. Neither fact belongs to the platform team that owns the gateway. The billing or entitlements team decides what plans exist, and the export team decides what they allow. Microsoft's pattern presents the dedicated gateway team as a benefit, letting specialists own specialized concerns like security. For a business rule, that same arrangement means the team that can change the rule's meaning can't see where it's enforced, and the team that enforces it can't judge whether the rule is still right.

Consider what happens when sales introduces an enterprise plan. Billing adds `enterprise` to the tier claim, and the policy still compares against `premium`. Enterprise customers, who pay the most, now get rejected on large exports. No test fails, because no test in the export service or the billing service ever ran the rule. The fix needs the platform team to change a policy whose meaning they didn't write, and someone has to realize the policy exists first.

A small organization where one team owns both the gateway and the export service avoids this split, since the people who define the plans can see the policy. The next two losses don't depend on who owns what, so they apply there too.

### The Rule Covers Only the Paths That Cross the Gateway

The gateway sits in front of external requests, not in front of the capability. A nightly job that calls the export service directly, an internal admin tool, a message consumer that triggers an export, or a second gateway in another region all reach the export service without passing through that policy. So the rule is enforced for some callers and not others, depending on the route their request took.

That's why the policy is weaker than it looks. The export service still has to decide what to do with a large request from a caller the gateway never saw. Either it enforces the limit too, and now the rule lives in two places that can disagree, or it doesn't, and the limit exists only on one path. Microsoft's pattern treats bypass as a security concern, telling teams to make backends accept requests only through the gateway. That fixes the network path. The job, the consumer, and the admin tool are legitimate callers, and they still run under different rules.

### The Rule Leaves the Domain's Tests

The export team's test suite exercises the export service. The policy sits outside it, so the business rule it encodes has no test that runs when the export service or the plan catalog changes. Gateway logic is also harder to test on its own terms. API Management's documentation says policy expressions have "only limited verification" when defined and run in the gateway at request time, where any exception becomes a runtime error. The Radar's 2016 and 2017 entries named the same cost, designs "difficult to test and deploy."

### Nobody Can Safely Remove It

Adding a rule to the gateway takes one team, but removing it takes two. The platform team can see the policy but can't tell whether any client depends on its behavior. The domain team could answer that, but may not know the policy exists. So rules accumulate, because each one is cheaper to leave than to trace. The ESB concentrated logic through the same ratchet, and the site's SOA guide describes where it leads: a gateway that "starts with routing, then takes on transformation, then orchestration, then business logic, until it is an ESB in all but name."

## What the Gateway Should Own

The gateway still has plenty to own. The dividing line is whether the rule is about the request or about the business, and one question tests it: **could the team that owns the gateway change this rule correctly without asking a domain team?**

| Kind of rule | Example | Where it runs | Who decides its meaning |
| --- | --- | --- | --- |
| About the request | Token expiry, request size, per-caller rate limit | Gateway | Gateway team |
| A limit the business sets | A customer's monthly quota | Gateway, with the value written by the owning service | Entitlements or billing team |
| An adapter for a backend that can't change | Renaming fields for a vendor system | Gateway, temporarily | A named team, with a retirement date |
| Composition for one client | One response for a mobile screen | Backend for frontend | That client's team |
| A business rule | Export limits by plan | Owning service | Domain team |

### Rules About the Request, Not the Business

TLS termination, token signature and expiry checks, request size limits, per-caller rate limits, IP allow lists, and access logging all pass the test, and they're most of what the site's Gateway and Proxy Patterns guide lists as a gateway's job. They're about the shape, identity, or volume of a request, and their correct values don't change when the business changes its mind. A rule that reads a business concept, such as a plan, product, sales region, account status, or price, fails it, however little code it takes.

### Numbers the Gateway Enforces but Doesn't Decide

Some rules straddle the line. Amazon API Gateway's usage plans, covered in the site's AWS API Gateway guide, attach a throttle and a quota to each API key, so the gateway enforces a per-customer limit. Which customers get which limit is a commercial decision. The gateway can enforce a number without owning it, as long as the owning service writes that number. When the entitlements service assigns an API key to a usage plan through the gateway's API as part of provisioning a customer, the gateway enforces the plan and the entitlements team owns the decision. When someone hand-edits the plan's quota in the gateway console, the platform team owns a pricing decision.

### Adapters With an Owner and an End Date

Sometimes a backend's contract can't change, such as a vendor system, a legacy service no one can deploy, or a service partway through a migration, and a gateway transformation is the cheapest adapter available. That's the case mapping templates exist for, and it's a defensible use. The rule still needs what any business logic needs. Name the team that owns the adapter's meaning, test it against the backend it adapts, and record the change that will retire it. An adapter with all three is a deliberate, temporary placement, while one with none of them is where the ratchet starts.

### Composition Belongs to the Client's Team

Aggregating several services into one response for a particular client is a common first step into gateway logic, because a screen needs data from three places and the gateway can already reach all of them. Sam Newman's Backends For Frontends pattern moves that composition into a service owned by the team that builds the client, so the people who need the shape are the ones who change it. Newman's warning about the alternative is the gateway problem in miniature. A single general-purpose API backend becomes a bottleneck "as so many changes are trying to be made to the same deployable artifact," and a separate team is often created just to maintain it. Domain rules still belong in the domain's services. A backend for frontend owns presentation for one experience, not the rules behind it.

## Checking Your Own Gateway

Open your gateway's configuration this week, whether that's policies, plugins, mapping templates, or route rules, and go through it with these questions:

- **List every rule that references a business concept,** such as a plan, tier, product, sales region, account state, or price. Searching the configuration for claim names and domain terms finds most of them.
- **For each one, name the service that owns the concept.** If the platform team couldn't change the rule correctly without asking that service's team, the rule belongs in that service.
- **Trace every path to the capability the rule protects.** List the jobs, consumers, internal tools, and other gateways that reach it, and check whether each one enforces the same rule.
- **Find the test that fails when the rule breaks.** If no test in the owning service's suite would catch it, the rule is unverified wherever it lives.
- **For each transformation, write down its owner and the change that retires it.** A transformation with neither is business logic that stayed.

Moving a rule back usually means adding it to the owning service and deleting the policy once the service enforces it on every path. The order matters, because deleting the policy first leaves the rule enforced nowhere.
