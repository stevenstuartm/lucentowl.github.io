---
layout: post
title: "Entitlements Are a Domain, Not a Feature Flag"
description: "Feature flags exist to separate shipping code from turning it on, and release toggles, experiments, and kill switches all fit that purpose. Deciding which customers are owed a feature does not. It's a business domain with its own owner and contracts."
tags: [feature-flags, entitlements, domain-boundaries, authority, continuous-delivery, technical-debt]
author: steven-stuart
sources:
  - title: "Martin Fowler: FeatureToggle (2010)"
    url: "https://martinfowler.com/bliki/FeatureToggle.html"
  - title: "Jens Meinicke, Chu-Pan Wong, Bogdan Vasilescu, and Christian Kästner: Exploring Differences and Commonalities between Feature Flags and Configuration Options (ICSE-SEIP 2020)"
    url: "https://www.cs.cmu.edu/~ckaestne/pdf/icseseip20.pdf"
  - title: "Unleash Documentation: Feature flag types"
    url: "https://docs.getunleash.io/reference/feature-toggle-types"
  - title: "Pete Hodgson: Feature Toggles (aka Feature Flags) (martinfowler.com, 2017)"
    url: "https://martinfowler.com/articles/feature-toggles.html"
  - title: "LaunchDarkly Documentation: Using entitlements to manage customer experience"
    url: "https://launchdarkly.com/docs/guides/flags/entitlements"
  - title: "Dawn Parzych: How to Manage Entitlements with Feature Flags (LaunchDarkly, 2020)"
    url: "https://launchdarkly.com/blog/how-to-manage-entitlements-with-feature-flags/"
  - title: "OpenFeature Specification: Flag Evaluation API"
    url: "https://openfeature.dev/specification/sections/flag-evaluation"
  - title: "Ryan Echternacht: Billing vs Entitlements: What's the Difference? (Schematic, 2026)"
    url: "https://schematichq.com/blog/billing-vs-entitlements-whats-the-difference"
---

It usually starts with one feature. The product team wants the new reporting dashboard available only on the enterprise plan, and there's no plan model in the code yet. The flag service is already wired in, it already supports targeting, and a segment called `enterprise-customers` takes ten minutes to set up. A year later there are a dozen such segments, sales asks engineering to add tenants to them when deals close, and support checks the flag dashboard to answer "why can't this customer see reports?" Where I've seen this happen, the people involved were convinced it was fine, because this is what feature flags are for.

I don't think it is. Release toggles, experiments, and kill switches are legitimate uses of feature flags because they're decisions about how code behaves, made by the people who build and run it. Deciding which customers are owed a feature is a different kind of decision. It belongs to a business domain with its own owner, policies, and audits, usually its own team, sometimes its own department. 

## Flags Exist to Separate Shipping Code From Turning Features On

The practice called feature flags grew out of continuous integration. Martin Fowler's 2010 entry on feature toggles presents them as the answer to the most common argument for feature branches, that some features take longer than a release cycle. A toggle lets unfinished work live on the main branch, integrated and deployed but switched off. Meinicke, Wong, Vasilescu, and Kästner, in their 2020 study comparing flags with configuration options, describe the same lineage. Flags are used for collaborative development in one branch, for experimentation in production, and for canary releases, and most of the literature on them comes from discussions of continuous delivery and deployment. Unleash, an open-source flag service, says it plainly in its own type list. A release flag is "used to enable trunk-based development for teams practicing Continuous Delivery."

Experiments and kill switches came from other traditions. A/B testing came from product analytics, and kill switches sit beside circuit breakers and load shedding in operations. Flag platforms absorbed both because the mechanism is identical, a value outside the code that picks a branch inside it. Both still fit, though. An experiment decides which version of the code should ship, and a kill switch decides whether code should run right now. Each is a decision about the code, made by engineering or product, and each is reversible by design.

That gives a test for any flag. Ask who owns the decision it encodes and what the decision is about. If the answer is the people who build or run the system, deciding how the code should behave, it's a feature flag. If the answer is sales, finance, or a customer contract, it's an entitlement wearing a flag's mechanism.

## The Standard References Put Entitlement Inside the Flag

Teams that use flags this way aren't improvising. The best-known reference on the subject tells them to. Pete Hodgson's catalog of toggle types on Martin Fowler's site includes permissioning toggles, used to change "the features or product experience that certain users receive," with premium features turned on "for our paying customers" as the first example. Hodgson notes that when a permissioning toggle manages premium access, it "may be very-long lived compared to other categories of Feature Toggles - at the scale of multiple years."

The vendors built the category into their products. Unleash ships a "permission" flag type with a permanent expected lifetime. LaunchDarkly's documentation has a guide titled "Using entitlements to manage customer experience," which describes entitlement flags as permanent flags that "are part of the everyday operation of the application" and suggests segments that sync with external tools. A 2020 LaunchDarkly post by Dawn Parzych goes further: "Instead of creating a custom build for a customer requesting a specific feature, wrap a flag around the feature and release it to that particular customer." The same post encourages handing that control to product, customer success, and sales.

Meinicke's interviews show how teams arrive there without choosing to. The practitioners they spoke with "usually do not distinguish between different kinds of flags and do not explicitly keep track of the goals behind each flag," and the goal behind a flag can shift. Their example is the one this post is about: "a feature flag that initially guards a new feature may become a configuration option that should be only available for 'premium' users." Often no one decides that the flag service should own product access. A release flag that happened to have targeting just stays on for some customers and not others.

## What a Flag Service Can't Do for an Entitlement

A flag service is well designed for its job. The trouble is that its design choices, each sensible for a release decision, are wrong for a commercial one.

### The Fallback Value Decides Who Gets Access

Flag clients are built never to break the application. The OpenFeature specification, the vendor-neutral standard for flag SDKs, requires that evaluation calls "MUST NOT throw exceptions," and that they "must always return the default value in the event of abnormal execution." For a release flag, that's the right rule. If the flag service is unreachable, the code falls back to off, which means the old behavior everyone has been running.

For an entitlement, there's no safe default. LaunchDarkly's entitlements guide says so itself: if the application can't connect, "all of your end users will receive a single fallback variation." Default to off, and every paying enterprise customer loses the feature they bought. Default to on, and every free customer gets it. The guide's mitigation is a relay proxy that keeps serving the last known state, which keeps the flag service available but doesn't change the design. An entitlement system would fail closed for the unpaid and keep serving what each customer's contract grants, because that's what it knows. A flag client only knows the one value someone typed into the SDK call.

### A Change Log Isn't an Audit Trail

When finance, support, or legal asks why a tenant has a feature, they want to know which agreement granted it, when it started, and when it ends. A flag service's history records that someone added a tenant ID to a segment on a given day. It has no field for the contract, the trial, the sales exception, or the credit that justified the change, so the reason lives in a Slack thread or a ticket, if anywhere. That's an adequate record for a rollout, whose only question is who flipped it. It's not adequate for a decision with money attached.

### Billing and Access Drift Apart

Once the flag service decides access, there are two sources of truth about a customer. Billing knows what they bought, and the flag service knows what they can use. Usually nothing reconciles them. A downgrade processed in billing doesn't remove the tenant from the segment, and a sales exception granted in the segment never reaches billing. Schematic, which sells an entitlement platform and so has an interest in the point, describes the common path: "many teams use their feature flag tool for entitlements early on, and then realize the two concerns need to be separated." The interest doesn't make the description wrong. The drift follows from having two systems record one fact, with no rule for which one wins.

### The Lifecycle Belongs to a Contract

A release flag has a simple life. It's off, it rolls out, it's on, it's removed. An entitlement follows a contract through trials that expire, upgrades that take effect mid-cycle, downgrades with grace periods, renewals, add-ons, and per-customer exceptions with end dates. Flag targeting can express a list of who's in, but not why they're in or until when. Every one of those rules ends up as a manual edit to a segment, made by whoever remembers it's due.

## Entitlement Is a Domain With Its Own Owner

Product access isn't a configuration detail. It encodes the company's pricing, its contracts, and its obligations to each customer. It has an owner outside engineering, usually product and revenue operations, and policies about who may grant exceptions. It has audit requirements, because what a customer can use is part of what they're billed for. In most companies that sell tiered software, it eventually gets its own team. That's the profile of a bounded context, not a flag type.

Treating it as one changes the shape of the code. Plans, features, and grants become records in a model that knows their source and their dates. A service answers "may this tenant use this feature?" from data it owns, and the code asks that service. The feature flag doesn't disappear. It goes back to its own question.

The two checks look alike, and that's the reason they get merged. But they answer to different owners, change for different reasons, and need opposite behavior when their backing service fails. The flag check can fall back to the old code. The entitlement check can't fall back to anything without either giving the feature away or taking it from someone who paid.

## A Flag Can Hold the Gap if You State It

None of this means a startup with one paid tier needs an entitlement service on day one. Holding product access in a flag for a while can be a sound decision, the same way any deliberate shortcut can be. What makes it sound is that someone made it on purpose. That means writing down that the flag service is standing in for an entitlement domain, who owns that gap, and what will trigger paying it off. Good triggers are concrete, like a second paid plan, the first contract with custom terms, the first billing dispute that turns on what the flag said, or the first time sales needs engineering to close a deal.

Unstated, the gap compounds. Each new segment and each sales exception adds to what a later migration has to untangle, and the flag service keeps getting more authority because nobody recorded that it was never supposed to have any. The longer it runs, the more it looks like the design rather than a stopgap, and the more convinced everyone becomes that this is what flags are for.

## Find the Entitlements in Your Flag Service

Pull your flag inventory and look for flags that are really product access:

- **Does the targeting list tenants, plans, or customer tiers?** A rollout targets percentages and internal users. A flag that targets named customers indefinitely is deciding who's owed something.
- **Who asked for the last change?** If it was sales, support, or customer success, the flag carries a commercial decision.
- **What does the fallback serve?** If neither on nor off is acceptable for every customer at once, the flag is holding an entitlement.
- **Can you answer why a given tenant has it?** If the answer lives outside the flag service, or nowhere, the audit trail is missing.
- **Is the gap written down?** If the flag service is standing in for an entitlement model, record that it is, who owns the gap, and what will trigger building the real thing.
