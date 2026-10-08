---
layout: post
title: "The API Gateway Shouldn't Know Your Business"
date: 2026-10-01
description: "Business rules end up in the API gateway because it's the easiest place to apply a rule to every request, and there they lose their owner, miss traffic that skips the gateway, and leave the domain's tests. Keep a rule in the gateway only if the gateway team could change it correctly on its own, and admit a business rule only as emergency debt with an owner and a removal date."
tags: [architecture, api-gateway, api-design, microservices, ownership]
author: steven-stuart
sources:
  - title: "James Lewis and Martin Fowler: Microservices (2014)"
    url: "https://martinfowler.com/articles/microservices.html"
  - title: "Thoughtworks Technology Radar: Overambitious API gateways"
    url: "https://www.thoughtworks.com/radar/platforms/overambitious-api-gateways"
  - title: "Azure Architecture Center: Gateway Offloading pattern"
    url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading"
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

I appreciate what an API gateway brings to most systems, at the right time and in the right place. It gives every service a shared first layer. TLS, rate limiting, and access logging happen once at the edge, and bad tokens get turned away before any service spends work on them. The services behind it still check what reaches them, but they start from cleaner traffic. The gateway also lets those services move and split behind a stable address without breaking their clients. But a gateway's configuration tends to collect things nobody designed it to hold, like a check on a customer's plan, a response field renamed back for an older client version, or a call to a second service to decide whether the first one should be reached at all.

That drift, away from the gateway's purpose and away from the code that owns the rule, isn't always carelessness. The gateway is the cheapest place in the system to apply a business domain rule to every external request, so rules flow toward it. The decade-old advice that business logic doesn't belong there hasn't removed that pull, because it says where business logic shouldn't go and little about the forces that send it there, or about how to keep a rule out when the need is urgent. A business domain rule belongs in the gateway only if the team that owns the gateway could change it correctly without asking a domain team. Keeping the rest out takes an answer to each force, and an emergency rule that does go in goes in as debt, with a domain owner and a scheduled removal.

## The Advice Has Been Clear Since 2014

In March 2014, James Lewis and Martin Fowler described microservices as favoring "smart endpoints and dumb pipes," against Enterprise Service Bus products that "often include sophisticated facilities for ... applying business rules." Thoughtworks put "overambitious API gateways" on Hold in its Technology Radar from November 2015 through May 2018. The April 2016 entry calls the pattern "a worrying re-emergence of this disease," the disease being business smarts pushed into middleware, and says that "any domain smarts such as data transformation or rule processing should live in applications or services where they can be controlled by product teams."

Vendor guidance agrees. Microsoft's Gateway Offloading pattern says "Never offload business logic to the gateway."

## Why Rules Drift Into the Gateway

Four forces pull a rule toward the gateway, and each one makes sense to whoever is making the change that day.

### Every External Request Passes Through It

Premium customers can request to export more than 10,000 rows, and everyone else can't. In the services, that rule is a change to the export service, and possibly to each service that exposes a large download. In the gateway, it's one policy that rejects the request before any service sees it. The person making the change may not even see it as a pricing rule, because in the moment it can look like an urgent fix to stop large exports from degrading the system for everyone.

### It Ships on a Different Schedule

A gateway policy usually ships as configuration, and a platform team often owns it, so adding the export limit there doesn't wait on the export team's backlog. What the gateway offers is a different queue, not necessarily a faster one. When the export team is busy and the deadline is close, the rule goes wherever it can ship this week.

After that, every change to the export limit waits in the platform team's queue, even when the export team could have shipped it sooner. The Gateway Offloading pattern says offloading doesn't fit when centralizing concerns "creates a change-management bottleneck" because the gateway team's release cycle is slower than the service teams'. The schedule that let the rule in once is the schedule it's stuck with.

### Vendors Compete on Programmability

A rule can only move into the gateway if the gateway can express it, and gateway products have made sure it can. Azure API Management runs policy expressions written in C#, and its `send-request` policy calls another service mid-request. Kong's Pre-Function plugin "lets you dynamically run Lua code." Thoughtworks' later radar entries said vendors in a highly competitive market were continuing the trend by adding features to differentiate their products.

Suppose the export team is booked for the quarter, so leadership overrides the queue and hands the export limit to the platform team, which runs Azure API Management. The platform team writes a policy that takes four steps on each export request:

1. Read the customer ID from the caller's validated token.
2. Ask the entitlements service for that customer's plan with `send-request`, caching the answer for a few minutes.
3. Read the requested row count from the `rows` query parameter, treating a missing value as zero so clients that omit it keep working.
4. Return a 403 if the plan isn't `premium` and the count is over 10,000.

Every step uses a standard gateway feature, and the result is business logic. Once the plan lookup exists, the next rule that needs a customer's plan costs one more condition.

### Security Wants One Place to Check

Authorization can be the first business rule to land in the gateway, pushed by a security group that wants one place to audit rather than trusting each dev team to get it right. The gateway already checks tokens, so it looks like that place. The drift starts when the gateway moves from checking that a token is valid to deciding what the caller may do, usually with a role check on a route that grows into decisions about which records the caller may touch.

## A Gateway Rule Loses Its Owner, Its Coverage, and Its Tests

### Its Meaning and Its Enforcement Get Different Owners

Step 4 of the platform team's export policy encodes two business facts, that a plan called premium exists and that it allows larger exports than every other plan. The entitlements team decides what plans exist and the export team decides what they allow, but the platform team owns the policy. That means the team that can change the rule's meaning can't see where it's enforced, and the team that enforces it can't judge whether it's still right.

Suppose sales introduces an enterprise plan. The entitlements service starts returning `enterprise`, and the gateway rule still compares against `premium`, so enterprise customers, who pay the most, get rejected on large exports. No test fails, because no test in either service ever ran the rule. Hard-coding `premium` would be a bug in the service too, but here the fix needs the platform team to change a rule whose meaning they didn't write, once someone realizes it exists.

The same split makes the rule hard to remove. The platform team can see the rule but can't tell whether any client depends on it, and the domain team could answer that but may not know the rule exists. So rules can accumulate, each one cheaper to leave than to trace, and the gateway drifts toward the middleware Lewis and Fowler described.

### The Rule Covers Only What the Gateway Can See

The first gap is the routes that never cross the gateway. Follow one customer on the free plan who wants 50,000 rows. Calling the public API, they get the 403. Then they click Export in the product's web app, whose backend calls the export service over the internal network, and the export runs. They set up a nightly scheduled export. The scheduler, acting with its own service identity, publishes an `ExportRequested` message that the export service consumes, and that export runs too. The same customer asks the same question three ways and gets two different answers. A capacity limit at the edge misses these paths too, but it protects only the edge, while a plan limit must hold however the customer asks.

The Gateway Offloading pattern recommends that backends accept requests only through the gateway, which stops outside clients from bypassing it but doesn't help here. The web app's backend and the scheduler are part of the product, the queued message never becomes an HTTP request, and even a scheduler call routed through the gateway would carry the scheduler's identity, with no customer for the gateway to look up. So the export service needs its own check, and the enterprise-plan change now has to reach two copies of the rule.

The second gap is on the gateway's own route, where it can check only what a request declares, while an export's size is known only after the query runs. The service treats `rows` as an optional cap, so a request for `?from=2020-01-01&to=2026-01-01` leaves it out, passes as 0, and gets every row the date range matches. Requiring `rows` would close the hole, but that changes the export API's contract for every client, which is the export team's decision.

### The Rule Leaves the Domain's Tests

The export team's test suite exercises the export service, not the policy, so unless gateway config runs in the export team's pipeline, the rule has no test that runs when the export service or the plan catalog changes. API Management's documentation adds that policy expressions have "only limited verification" when defined and run at request time, where any exception becomes a runtime error.

## Keep the Gateway to Rules Its Own Team Can Change

One question tests whether a rule is about the request or about the business: **could the team that owns the gateway change this rule correctly without asking a domain team?** A domain team that keeps its own gateway config avoids the split and the second queue, but the test still sorts its rules by who decides their meaning, and the coverage gaps remain.

| Kind of rule | Example | Where it runs | Who decides its meaning |
| --- | --- | --- | --- |
| About the request | Token expiry, request size, per-caller rate limit | Gateway | Gateway team |
| An adapter for a backend that can't change | Renaming fields for a vendor system | Gateway, until the backend changes | A named team, with a test against the backend |
| Composition for one client | One response for a mobile screen | Backend for frontend | That client's team |
| A stopgap during an incident | Blocking large free-plan exports until a fix ships | Gateway, until the fix ships | Domain team, with a removal date |
| A business rule | Export limits by plan | Owning service | Domain team |

Rules about the request pass because their correct values don't change when the business changes its mind. A rule that reads a business concept, such as a plan, sales region, account status, or price, fails, however little code it takes. A gateway rule that asks entitlements for a number still fails, because which routes count as exports is the export team's decision. When it adds a bulk download endpoint, the gateway rule misses it, while a check in the code that produces exports covers it on release. Tagging export routes in the export team's spec fixes that but still leaves a copy that misses the internal paths.

### Authentication Passes, Authorization Doesn't

Tokens sit on both sides of that line. Rejecting a token that is malformed, badly signed, expired, or tied to a revoked session passes, because what makes a token valid doesn't change when the business does. Any decision about what the caller may do fails the test, even at the route level. A scope per route looks like a property of the token, but which scope `POST /exports` requires is the export team's call. If they split `exports:write` into a standard and a bulk scope, the gateway enforces the old contract until the platform team catches up. Generating the scopes from the service's API spec removes the lag, but the service's check still counts. The Gateway Offloading pattern lists authorization among the concerns a gateway can centralize, and the line drawn here is narrower than Microsoft's. The gateway sees `/accounts/4417/exports` and a user ID, but only the service that loads account 4417 knows who belongs to it. Broken object level authorization tops the 2023 OWASP API Security Top 10, which describes the check as one "usually implemented at the code level."

### Capacity Limits Pass, Plan Quotas Don't

Rate limits sit on both sides too. A per-caller limit that protects capacity, such as 100 requests a second per key, passes, because its right value depends on what the system can handle. A quota sold as part of a plan, such as 10,000 API calls a month on the basic tier, fails. Amazon API Gateway's usage plans attach a quota to each API key, which makes the gateway a second copy of each customer's plan to update on every upgrade and cancellation. Where the API itself is the product and its plans are sold in the gateway, the gateway's owner owns the plan, and the quota passes. The export limit splits the same way. A size cap that protects the system passes, and the extra rows premium customers may request belong in the export service.

### Adapters and Composition Are Narrow Exceptions

A transformation in front of a backend whose contract can't change, such as a vendor system or a service partway through a migration, can live in the gateway with an owner, a test against the backend, and a recorded change that will retire it. Like a stopgap, it fails the ownership test and stays only on those conditions. Composition for one client belongs in a backend for frontend, Sam Newman's pattern of a service owned by the team that builds the client. That service owns presentation, not the domain rules behind it.

## Answer Each Force

Under a deadline, the easiest place for a rule wins, so each force needs an answer that makes the owning service as easy a choice.

### Every Request Reaches the Service

Put the check in the export service from the start, and keep plan details out of it. The service asks the entitlements service for this customer's export limit, as a number, and refuses any export over it. That adds a call to each service that serves large downloads, but each needed the check anyway, and a shared client library with caching keeps it to a few lines. When sales adds an enterprise plan, only the entitlements service's limits change.

### Borrow the Gateway's Schedule Only as Debt

For a one-time change it can make alone, the platform team's queue is short, and sometimes that's exactly what a missed deadline or an incident needs. If a Friday release breaks the export service's limit check and free customers start pulling millions of rows through the public API, the platform team can ship the four-step policy within the hour, changed to refuse any export without a declared row count, long before the export team can safely deploy a fix. Ship it, but ship it as debt:

- **The export team owns the fix and the emergency contract change,** booked into a release the day the policy ships. Once the incident ends, nothing pushes anyone to replace a policy that seems to work.
- **The policy carries its owner, ticket, and removal date,** so anyone reading the gateway can tell a stopgap from a rule that belongs there.
- **The fix isn't done until the policy is deleted** and the service's own test covers the routes the stopgap never saw.

### Make Code in the Gateway Require an Owner

A business rule gets into the gateway whenever the platform team approves the policy, and that review tends to ask whether the policy works, not whose rule it is. A policy that calls another service or runs custom code, which a pipeline can detect, or that compares a claim to a business value needs cross-team review from the domain team that owns the concept, or from architecture review when no team clearly owns it. If that team can't review before an emergency ships, the review joins the stopgap's debt terms. If it fails the ownership test, it merges only with the owner, ticket, and removal date a stopgap carries.

### Split Authorization by Who Owns the Facts

Security can get consistent, auditable authorization without the gateway. Role-based decisions, such as what the support-agent role may do or which tenant a user belongs to, rest on facts that rarely change mid-request, so they can live in one central policy, distributed to every service and evaluated locally on every route, with each domain team owning the entries for its own capabilities. Contextual decisions, such as whether a user may export account 4417 given its status or a legal hold, rest on domain facts that can change from one request to the next. Centralizing those repeats the gateway's split one layer over, so they stay in the domain service, written and tested by the team that owns the facts.

Where security doesn't own the rules, it can still own how every service enforces them. Shared middleware can reject any request a service doesn't explicitly allow, so a forgotten check refuses access instead of granting it, and every service can record its authorization decisions in one shared log for security to audit.

Either way, the check runs in the service. A gateway-only check trusts the web app and scheduler routes for running inside the network, and NIST's zero trust architecture, SP 800-207, rejects that, holding that there's no "implicit trust granted to assets or user accounts based solely on their physical or network location."

## Find the Business Rules Already in Your Gateway

Open your gateway's policies, plugins, mapping templates, and route rules, and work through them:

- **Search for business concepts.** Claim names and domain terms find most of them. Put each through the ownership test.
- **Move each rule that fails into the service that owns it,** with a check and a test that cover every path to the capability, including jobs, consumers, internal tools, and other gateways.
- **Give any stopgap that has to stay an owner and a removal date,** and add a pipeline check that rejects a policy missing either or past its date. A stopgap with neither is business logic that stayed.
