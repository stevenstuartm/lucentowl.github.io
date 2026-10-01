---
layout: post
title: "Your SLO Is Bounded by Your Hard Dependencies"
description: "A service can't be more available than the product of its hard dependencies, and a stack of ordinary cloud SLAs often multiplies to less than the target teams publish on top of it. Whether a dependency is hard is decided at each call site in the caller's own code, which makes an availability target a design output rather than an operations goal."
tags: [architecture, distributed-systems, reliability, slos]
author: steven-stuart
sources:
  - title: "Treynor, Dahlin, Rau, and Beyer: The Calculus of Service Availability (ACM Queue, 2017)"
    url: "https://queue.acm.org/detail.cfm?id=3096459"
  - title: "AWS Well-Architected Reliability Pillar: Availability"
    url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/availability.html"
  - title: "Amazon API Gateway Service Level Agreement"
    url: "https://aws.amazon.com/api-gateway/sla/"
  - title: "AWS Lambda Service Level Agreement"
    url: "https://aws.amazon.com/lambda/sla/"
  - title: "Amazon Cognito Service Level Agreement"
    url: "https://aws.amazon.com/cognito/sla/"
  - title: "Amazon DynamoDB Service Level Agreement"
    url: "https://aws.amazon.com/dynamodb/sla/"
  - title: "Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region"
    url: "https://aws.amazon.com/message/101925/"
  - title: "Amazon Cognito Developer Guide: Verifying JSON Web Tokens"
    url: "https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html"
  - title: "Site Reliability Engineering: Service Level Objectives"
    url: "https://sre.google/sre-book/service-level-objectives/"
---

Four nines sounds achievable until you multiply. Put it on top of five dependencies that each promise three and a half nines, 99.95%, and the product of their promises is about 99.75% before your own code has failed once. Availability targets tend to be chosen as round numbers, in a discussion about ambition and the cost of being on call, and that discussion tends to skip the arithmetic.

I find it one of the more humbling five-minute calculations in architecture. The math isn't mine. A team from Google published it in 2017, and AWS repeats it in its Well-Architected guidance. What I want to add is where the fix lives. Whether a dependency can take your service down is decided in your own code, one call site at a time, and usually by default rather than by choice. That makes an availability target something you derive from the design, not something you pick and then operate toward.

## Hard Dependencies Multiply

AWS's Reliability Pillar splits dependencies into two kinds. A hard dependency is one where "an interruption in a dependent system directly translates to an interruption of the invoking system." A soft dependency is one whose failure "is compensated for in the application." For hard dependencies, the invoking system's availability is the product of theirs. Three independent systems at 99.99% each give 99.97%.

Ben Treynor Sloss, Mike Dahlin, Vivek Rau, and Betsy Beyer made the same point in "The Calculus of Service Availability" (ACM Queue, 2017), in stronger terms. "A service cannot be more available than the intersection of all its critical dependencies." Google's working rule, which they call the rule of the extra 9, is that a service's critical dependencies must each be one nine better than the service itself. A 99.99% service needs 99.999% dependencies.

Their worked example shows why the rule is that strict. A 99.99% service has 53 minutes of downtime to spend in a year. Five critical dependencies at 99.999% take 26 of those minutes, which leaves 27 for everything the service does to itself. The article assumes one full outage a year and three that each take down a fifth of the service, which leaves about 17 minutes per incident to detect it, respond, and recover. The dependencies in that example are an order of magnitude more reliable than the service, and they still consume half its budget.

### A Common AWS Stack Multiplies to Less Than Three Nines

Most teams don't build on 99.999% dependencies. Consider an API built from common AWS parts, with the monthly uptime each service's SLA commits to per region:

| Dependency | SLA commitment |
| --- | --- |
| Amazon API Gateway | 99.95% |
| AWS Lambda | 99.95% |
| Amazon Cognito | 99.9% |
| Amazon DynamoDB (standard tables) | 99.99% |
| **Product, if every request needs all four** | **about 99.79%** |

99.79% allows about 91 minutes of downtime in a 30-day month. A 99.9% SLO allows 43. A team publishing three nines on this stack has promised its users twice as much availability as its providers have promised it, and that's before counting a single bug, bad deploy, or configuration mistake of its own.

### SLAs Are Refund Terms, Not Forecasts

A provider's SLA is a commitment to "commercially reasonable efforts" backed by a service credit, 10% of that service's monthly charge for the first missed tier in each of these four. It marks where the provider starts paying, not a forecast of what it will deliver. The product of SLAs is the lowest availability your providers will accept without owing you anything, not a prediction of your downtime.

That doesn't rescue the target. The credit refunds your AWS bill, not your users' lost hour. When your SLO sits above the product of your providers' SLAs, the gap is a promise you've made that nobody upstream has made to you, and it holds only for as long as the providers keep beating their own commitments.

### Correlated Failures Loosen the Math but Concentrate the Risk

Multiplication assumes dependencies fail independently. They often don't. On October 19 and 20, 2025, a race condition in DynamoDB's DNS automation broke name resolution for its us-east-1 endpoint. AWS's summary puts DynamoDB's own errors between 11:48 PM and 2:40 AM Pacific. Services built on DynamoDB took far longer. EC2 instance launches failed until 1:50 PM, Lambda saw errors until 2:15 PM, and STS until 9:59 AM.

When dependencies fail together, their outages overlap, so total downtime comes in under what the independent product predicts, and the ceiling is a little pessimistic in minutes. But the risk concentrates into rarer and longer events. A 99.9% target allows under nine hours of downtime a year, and a service that couldn't run without Lambda through that 14-hour window could have spent more than a year's budget in one night.

Correlation also undermines the usual escape from the ceiling. The Queue article notes that three copies of a 99.9% store give nine nines only if their failures are uncorrelated, and "in the real world, the correlation is never zero." Two dependencies you counted as independent may share a DNS system, a control plane, or a region.

## Hardness Is Decided at the Call Site

Neither source treats the ceiling as fixed. The Queue article says "the aim is to make as many components as possible noncritical," and lists ways to do it, including capacity caches, failing open, graceful degradation, and asynchronous calls. AWS defines a soft dependency by what "the application" does. The Queue article comes closest to the point when it recommends asynchronous calls so that noncritical dependencies "don't accidentally become critical." Taken one step further, hardness isn't a property of a dependency at all. It's a property of each place your code calls one, it's hard by default, and it can change every time someone edits that code.

### The Same Dependency Can Be Hard on One Path and Soft on Another

Signing in can't work without Cognito, so it's hard for the login path. Every other request carries a token, and Cognito's documentation describes validating it without a network call. The application checks the signature against the user pool's public signing keys, which it caches, and checks the expiry and issuer claims locally. An API that does that doesn't touch Cognito on those requests, so a Cognito outage stops new sign-ins while signed-in users keep working. An API that calls Cognito on every request, to look up attributes or confirm the token is still valid, has made Cognito hard for all of its traffic. It's the same dependency with the same SLA and a different ceiling, decided by the caller's code.

The hard version isn't always a mistake. The same documentation notes that offline checks can't detect a token revoked before it expires, so an application that must honor sign-out immediately has to ask Cognito, or keep token lifetimes short. Authorization resolved at request time from a grants store makes that store hard in the same way. Those are legitimate trades of availability for security. They belong in the product, counted, rather than discovered during an outage.

Take Cognito out of the per-request product and the stack above rises to about 99.89%, or 47 minutes a month. That's still short of three nines, which shows the limit of the lever. API Gateway and Lambda are the platform running the code, and no fallback degrades around the thing executing the fallback. For dependencies like those, the options are redundancy across regions, with the correlation caveats above, or a lower target.

### Every Synchronous Call Is Hard Until Someone Decides Otherwise

A call is awaited, the dependency fails or hangs, the exception propagates, and the request fails. Making the call soft takes three things that default code doesn't have: a timeout so a slow dependency can't hold the request, a fallback, and a decision about what the user gets instead.

```csharp
public async Task<ProductPage> GetProductPage(string productId, CancellationToken ct)
{
    // Hard: without the product there is no page to show.
    var product = await _catalog.GetProduct(productId, ct);

    // Soft: the page is still useful without recommendations.
    IReadOnlyList<Product> recommendations;
    try
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromMilliseconds(200));
        recommendations = await _recommendations.GetFor(productId, timeout.Token);
    }
    catch (Exception ex) when (ex is HttpRequestException
        || (ex is OperationCanceledException && !ct.IsCancellationRequested))
    {
        recommendations = [];
    }

    return new ProductPage(product, recommendations);
}
```

The timeout and the catch are mechanics. The empty list is a product decision, and it's the part no library supplies. For recommendations, showing nothing is fine. For a price, a stale value might be acceptable for a few minutes and wrong after that. The Queue article calls this failing safe, where a system serves cached data and then fails closed once the data is too old to trust. Choosing between these for each dependency is design work.

### Soft Dependencies Drift Back to Hard

A fallback that never runs can break without anyone noticing, until the day it's needed. A new call added to the same path without a fallback makes the path hard again, and the ceiling drops without any change to the SLO. Startup is its own path, too. The Queue article asks how a service handles a dependency being unavailable "upon startup of the service" as well as during runtime, and a service that can't boot without its configuration store has a hard dependency during every deploy and every scale-out.

The article's answer is fault injection, meaning integration tests that verify the system survives the failure of each of its dependencies. That turns softness from a belief about the code into a checked property of it.

## Set the SLO After the Dependency List

Teams tend to choose a target and then operate toward it. The arithmetic reverses that order and makes the target an output of the design. List the calls a user journey makes and mark each one hard or soft. Multiply the hard ones to get the ceiling, then leave room below it for the service's own bugs, deploys, and mistakes. In the Queue article's example, the dependencies and the service itself each get about half of the error budget. What's left is the highest number you can honestly publish.

When that number comes out lower than what callers need, the Queue article gives a service three options: raise its availability, add mitigation, or lower the published target. Of the last, it says "often it is the correct choice," because a gap nobody addresses gets corrected by an outage instead.

The Google SRE book adds a caution from the other direction. "Users build on the reality of what you offer, rather than what you say you'll supply." Google's global Chubby lock service ran so far above its target that other services added dependencies on it assuming it would never go down. The team's answer was to take it down deliberately in any quarter where real failures hadn't already brought it down to its target. A published number protects callers only if it's also the number they experience.

## Checking Your Own Service

For one service this week:

- Pick one user journey and list every synchronous call it makes, including authentication, configuration, and feature flags
- Mark each call hard or soft by reading the code that makes it, and note what it does when the dependency fails and when it hangs
- Look up each hard dependency's SLA, or better, its measured availability, and multiply
- Compare the product with your SLO, leaving room below it for your own failures
- For each fallback, find the test that proves it runs

If the product comes out below your target, the gap is already there, whether or not an outage has shown it yet. You can close it in code by making dependencies soft, in infrastructure through redundancy, or on paper by publishing a number your architecture can support.
