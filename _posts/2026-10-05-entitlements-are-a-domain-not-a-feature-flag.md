---
layout: post
title: "Entitlements Are a Domain, Not a Feature Flag"
date: 2026-10-05
description: "Gating paid features with flag segments is easy to start and hard to undo. Which customers are owed a feature is a commercial decision that needs its own owner, audit trail, and offline rules, so it belongs in its own domain. A flag can hold it only as a deliberate stopgap, with an owner and a written trigger for replacing it."
tags: [feature-flags, entitlements, domain-boundaries, authority, client-architecture, technical-debt]
author: steven-stuart
sources:
  - title: "Martin Fowler: FeatureToggle (2010)"
    url: "https://martinfowler.com/bliki/FeatureToggle.html"
  - title: "Unleash Documentation: Feature flags"
    url: "https://docs.getunleash.io/concepts/feature-flags"
  - title: "Pete Hodgson: Feature Toggles (aka Feature Flags) (martinfowler.com, 2017)"
    url: "https://martinfowler.com/articles/feature-toggles.html"
  - title: "LaunchDarkly Documentation: Using entitlements to manage customer experience"
    url: "https://launchdarkly.com/docs/guides/flags/entitlements"
  - title: "Dawn Parzych: How to Manage Entitlements with Feature Flags (LaunchDarkly, 2020)"
    url: "https://launchdarkly.com/blog/how-to-manage-entitlements-with-feature-flags/"
  - title: "Jens Meinicke, Chu-Pan Wong, Bogdan Vasilescu, and Christian Kästner: Exploring Differences and Commonalities between Feature Flags and Configuration Options (ICSE-SEIP 2020)"
    url: "https://www.cs.cmu.edu/~ckaestne/pdf/icseseip20.pdf"
  - title: "OpenFeature Specification: Flag Evaluation API"
    url: "https://openfeature.dev/specification/sections/flag-evaluation"
  - title: "RevenueCat Documentation: Caching"
    url: "https://www.revenuecat.com/docs/test-and-launch/debugging/caching"
  - title: "Ryan Echternacht: Billing vs Entitlements: What's the Difference? (Schematic, 2026)"
    url: "https://schematichq.com/blog/billing-vs-entitlements-whats-the-difference"
  - title: "LaunchDarkly Documentation: Offline mode"
    url: "https://launchdarkly.com/docs/sdk/features/offline-mode"
  - title: "LaunchDarkly Documentation: Secure mode"
    url: "https://launchdarkly.com/docs/sdk/features/secure-mode"
  - title: "Sam Newman: Backends For Frontends (2015)"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "OpenFeature Documentation: OpenFeature Remote Evaluation Protocol (OFREP)"
    url: "https://openfeature.dev/docs/reference/other-technologies/ofrep/"
  - title: "Statsig: When allocation point and exposure point differ"
    url: "https://www.statsig.com/blog/when-allocation-point-and-exposure-point-differ"
  - title: "Eppo Documentation: JavaScript client SDK quickstart"
    url: "https://docs.geteppo.com/sdks/client-sdks/javascript/quickstart/"
  - title: "GrowthBook Documentation: JavaScript SDK"
    url: "https://docs.growthbook.io/lib/js"
---

It usually starts with one feature. The product team wants the new reporting dashboard available only on the enterprise plan, and there's no plan model in the code yet. The flag service is already wired in and supports targeting, and a segment called `enterprise-customers` takes ten minutes to set up. A year later there are a dozen such segments. Every grant now goes through engineering, the code understands plans only as segment names, billing and access drift apart, and change logs are not sufficient to audit the proper state of customer product access. Most people involved feel the strain, but there's no clear way back.

I think the way back starts with seeing that this was never a flag decision. Release toggles, experiments, and kill switches are decisions about how code behaves, made by the people who build and run it. Deciding which customers are owed a feature is a commercial decision, and it belongs to a business domain with its own owner, policies, and audits. Beyond the more obvious server-side and operational issues, a solution needs to also reconcile the potential reality of client-side apps, which can quickly accelerate the pain and complicate a solution.

## Feature Flags Decide How Code Behaves

Feature flags grew out of continuous integration and trunk-based development. Software design author Martin Fowler's 2010 entry on feature toggles presents them as a way to keep unfinished work on the main branch, integrated and deployed but switched off, when a feature takes longer than a release cycle. Unleash, an open-source feature flag platform, still describes a release flag as a way to "manage the release of new or incomplete features," with an expected lifetime of 40 days.

Experiments and kill switches use the same per-request switch, and each still decides something about the code, either which version should ship or whether it should run right now.

When the team that builds and runs the product decides how the code should behave, it's a feature flag, even when a product manager runs the experiment, because no customer is owed the variant they landed in. When sales, finance, or a contract decides who gets a feature, it's an entitlement that happens to use a flag. A flag service can still carry that answer, but then it runs one department's decisions through a tool built for another's.

## The Standard References Treat Entitlement as a Flag Type

Software delivery consultant Pete Hodgson's catalog of toggle types, published on Fowler's site, sets permissioning toggles beside release, experiment, and ops toggles. Permissioning toggles change "the features or product experience that certain users receive." Hodgson notes these "may be very-long lived compared to other categories of Feature Toggles - at the scale of multiple years."

The vendors built the category in. Unleash ships a permanent permission flag type to "control feature access based on user roles or entitlements," and LaunchDarkly, a commercial flag service, treats entitlement flags in its guide "Using entitlements to manage customer experience" as permanent ones, which "are part of the everyday operation of the application." A 2020 post on LaunchDarkly's blog by Dawn Parzych goes further: "Instead of creating a custom build for a customer requesting a specific feature, wrap a flag around the feature and release it to that particular customer."

A 2020 interview study by Meinicke, Wong, Vasilescu, and Kästner shows teams drifting there without deciding to. Practitioners "usually do not distinguish between different kinds of flags," and "a feature flag that initially guards a new feature may become a configuration option that should be only available for 'premium' users."

## What a Flag Service Can't Do When It Holds the Entitlement

When grants are written straight into the flag service, each of its design choices is likely sensible for a release decision and wrong for a commercial one.

### No Single Fallback Is Right for Every Customer

Flag clients are built to never break the application. OpenFeature, a vendor-neutral standard for flag evaluation APIs, requires in its specification that client methods "MUST NOT throw exceptions" and that evaluation calls "must always return the default value in the event of abnormal execution." For a release flag, that's right. If the service is unreachable, the code falls back to off, which is the old behavior everyone has been running.

For an entitlement there's no safe default. LaunchDarkly's entitlements guide warns that if the application can't connect, "all of your end users will receive a single fallback variation." Default to off, and every enterprise customer loses what they bought. Default to on, and every free customer gets it. The guide's mitigation is its Relay Proxy, a self-hosted cache of flag data with a persistent store, which gives server-side apps the last known state, but a client app that starts with nothing cached still gets the single fallback.

An entitlement service can fail too, so the difference isn't whether there's a fallback but who sets it. A flag's fallback is one value written into the code, and how long its cached values count is the vendor's rule. An entitlement's fallback is a policy the plan owner sets, including how long a cached grant still counts. RevenueCat, which manages in-app subscriptions, sets its own, so an entitlement active when a device went offline "will remain active for up to three days."

### A Change Log Isn't an Audit Trail

When finance, support, or legal asks why a tenant has a feature, they want the agreement that granted it, when it started, and when it ends. A flag service records that someone added a tenant ID to a segment on a given day. A change comment can say why in a sentence, but the contract, trial, or sales exception behind the change lives in a ticket or a Slack thread, if anywhere. That's enough for a rollout but not for a decision with money attached.

### Billing and Access Drift Apart

Once the flag service decides access, billing knows what customers bought and the flag service knows what they can use, and usually nothing reconciles the two. A downgrade in billing doesn't remove the tenant from the segment, and a sales exception granted in the segment never reaches billing. Schematic, an entitlement platform vendor with an interest in the point, describes the common path: "many teams use their feature flag tool for entitlements early on, and then realize the two concerns need to be separated as their pricing gets more complex." LaunchDarkly's guide offers segments that stay in sync with an external system, so billing could feed one, but that only works if every grant goes into billing first, sales exceptions included.

## Entitlement Is a Domain With Its Own Owner

Product access encodes the company's pricing, contracts, and obligations to each customer. It has an owner outside engineering, usually product and sales, policies about who may grant exceptions, and audit requirements because what a customer can use is part of what they're billed for. That's the profile of a bounded context, not a flag type, and modeling it as its own domain closes each gap above. A service answers "may this tenant use this feature?" from data it owns.

| Concern | Entitlement held in a flag service | Entitlement held in its own domain |
| --- | --- | --- |
| Who grants access | Engineering edits segments when sales asks | Product and sales grant it, under their own exception policy |
| What a grant records | Who changed a segment, and when | The agreement behind it, with start and end dates |
| What a renewal touches | Every segment the plan's features use | The contract's dates, once, and every plan feature follows |
| How billing stays in step | Two systems hold one fact, and neither wins | Every grant, sales exceptions included, is written here, and billing reads or feeds it |
| What happens in an outage | One fallback value written into the code | A fallback and offline window the plan owner sets |

## One Contract Can Justify a Temporary Flag

The hardest case is the one Parzych's advice describes. A single customer's contract requires a feature nobody else has asked for. For now, everything about it is in doubt, including its specification, its stability, whether it meets the customer's needs, and whether it will ever sell. The contract item itself isn't negotiable.

### Two Decisions Share One Flag

Who is owed the feature is settled. Whether the feature survives is the open question, and it's partly about the code and partly about the market.

Engineering's usual reason to keep unproven code behind a flag is the ability to turn it off, but turning it off for this tenant breaches a contract, so the off switch is a commercial decision and not an operational one. The fallback problem returns in its starkest form, since no single default can be on for the one tenant who holds the contract and off for everyone else.

### Every Exit Removes the Flag

Neither problem goes away, but both can be accepted on purpose. Making an unproven feature that one contract requires into a plan feature would be premature, and the flag keeps the code isolated until the open question is answered. I think that makes this case a legitimate use of a flag, declared as intentional technical debt and owned by product and sales rather than engineering, since the off switch and the outage fallback are now their risks to carry. What separates it from Hodgson's multi-year permissioning toggles is that it has a decision point, and every way out of that decision removes the flag:

- **Another customer wants it.** The grant moves into the entitlement model as a plan feature, and the flag goes away.
- **It becomes standard.** The code path becomes permanent and the flag is deleted.
- **The contract ends or the feature fails.** The code is removed with the flag.

Parzych's advice is right on the first day. It becomes a problem only when nobody records the exits and the flag turns into a permanent grant with no owner.

## On Client Apps, Vendor Coupling Compounds the Entitlement Problem

So far, the code checking what a tenant may use has run on servers you control. Mobile, desktop, and browser apps need that answer too, and they may be offline when they need it. Entitlements have to reach the client from the business that owns them, and flags usually reach it through the vendor's SDK, which ties every installed build to the vendor.

### Clients Still Need Flags, but Never Decide Entitlements

Client apps arguably need flags more than servers do. A server fix ships in a deploy, while a client fix waits on app store review and on users who don't update, so release toggles and kill switches carry more weight on a device. But the client is never the authority on an entitlement. It can hold a grant the server issued for as long as the plan's rules trust it, but the server enforces, and the client only decides what to show.

### The Vendor's SDK Ties Every Build to the Vendor

The usual way to get flags to a client is the vendor's client-side SDK talking directly to the vendor, so the SDK and its representation of the answer become part of every installed build. Swapping vendors waits on app releases, and until old builds disappear, nothing can be put between the client and the vendor. The layer serving the answer isn't yours either, so you can't merge sources, set expiry and invalidation for each kind of data, or push your own change events. I think direct vendor SDK access from client apps is a trap, though many teams accept it for the streaming updates and built-in experiment analysis that come with it, which a team leaving the SDK has to replace.

Entitlements in the flag service make that coupling worse. Every build then depends on the vendor for what customers are owed. LaunchDarkly's offline-mode documentation says a client SDK that can't reach the vendor uses "the latest stored flag variation values," or the code's fallback if there are none, so the plan owner can only choose among the behaviors the SDK offers. Exposure gets worse too. LaunchDarkly's secure mode, which stops one end user from learning "what flag values another end user receives," covers only its JavaScript-based SDKs. Elsewhere, a modified client can evaluate flags as any tenant whose key it knows or guesses and learn what that customer bought, even when the server enforces every grant.

### A Projection Fixes the Source but Not the Layer

For a team already deep in the hack, a first step back can be fixing where entitlements come from while the flag service keeps serving them. I've used this shape before, with a read store that only receives changes from the audited business store and is never written to directly. The flag service becomes a projection of an entitlement store that sales and product own.

```text
 ┌──────────────────────────────────┐
 │ Entitlement store                │ <── sales and product write
 │ audited source of truth          │
 └────────────────┬─────────────────┘
                  │ events (only writer)
                  v
 ┌──────────────────────────────────┐
 │ Flag service                     │
 │ release flags + entitlement      │
 │ segments, rebuilt from source    │
 └────────────────┬─────────────────┘
                  │ vendor SDK
                  v
               Client
```

That makes LaunchDarkly's synced segment a rule instead of a hope. The sales exception goes into the audited store and arrives as an event like any other change, and two conditions keep the projection honest. Only the sync integration may write to entitlement segments, enforced in the vendor's permissions rather than by agreement, and the whole projection can be rebuilt by replaying the source. It works, but each part is one more thing that can break. It also leaves the device getting grants through the vendor's SDK, with every problem above.

### Entitlements Can Ride on an Endpoint You Already Own

The cheaper way out takes grants off the vendor's path entirely, and it may not need a new endpoint. The app already asks the server who the user is and which tenant they belong to, and that session or account lookup can return the tenant's grants with the answer:

```json
{
  "user": "u_1842",
  "tenant": "acme",
  "entitlements": {
    "generatedAt": "2026-10-05T14:00:00Z",
    "refreshAfterSeconds": 3600,
    "staleSeconds": 259200,
    "grants": ["advanced-reporting"]
  }
}
```

One number says how often to refresh, and the other says how long a cached answer still counts when a refresh fails. Grants change when a contract does, so hourly is plenty, and the plan owner decides they stay trusted for three days offline. That window is a promise, so data a user creates under a cached grant has to sync even if the grant ended while the device was offline. What happens to that data next, whether it stays editable, turns read-only, or waits for a renewal, is the plan owner's call too. `generatedAt` lets the client tell how old its copy is, and nothing in the exchange touches the flag vendor.

### A Facade Decouples Flags From the SDK, as a Separate Choice

Once entitlements have their own path, decoupling flags from the vendor's SDK is a separate choice, and a team climbing out of the debt can leave it for later. The usual shape is a thin endpoint you own in front of the flag service. Sam Newman, author of *Building Microservices*, describes this kind of server component in his backends-for-frontends pattern, one "tightly coupled to a specific user experience," typically maintained by the team that builds the interface. The vendor's contract ends at the server. A team that wants a standard client SDK anyway can have the facade implement OpenFeature's Remote Evaluation Protocol, a vendor-neutral API contract for evaluating a client's flags. If one endpoint serves both grants and flags, the response should keep them apart, because one flat map of booleans can't tell a release toggle from a contract grant.

The facade has its own tradeoffs. An experiment needs a record of which version each user actually saw, and Statsig's experimentation guidance explains that counting users who never reached the feature dilutes the result. For a change that lives entirely in the interface, only the client knows the screen rendered. The vendor's client SDK sends that record automatically, but behind a facade the app has to. Eppo's and GrowthBook's SDKs already have the app log exposures to the team's own analytics, so a team with a pipeline adds one event, while a team that relies on the vendor's built-in analysis has to forward exposures through the facade. A facade also gives up the vendor's real-time streaming of flag changes, which an app shouldn't need. A change too urgent to wait for the next refresh belongs on the server, and an app that depends on one has put that decision on the wrong side.

## A Flag Can Stand In When the Gap Is Written Down

None of this means a startup with one paid tier needs an entitlement service on day one. Yet, I think that holding product access in a flag is still a hack, and the only good reason for it is a timeline or budget that would otherwise block delivery. Even then it's a cost, because paying it off means refactoring the code and migrating the grants, so someone should decide it on purpose and write down that the flag is standing in for an entitlement domain, who owns that gap, and what will trigger paying it off.

Unstated, the gap compounds. Each segment and sales exception adds to a later migration, each client build that reads entitlements from the vendor's SDK adds a contract you can't recall, and the flag service keeps gaining authority because nobody recorded that it was never supposed to have any.

Hacking feature flags can work because a wrong answer is usually recoverable. A tenant who gets a feature a day late complains and gets a credit. A different system layer that decides who can sign in, move money, or read another tenant's data has no such margin, and the same shortcut is never an option. A hack can hold together for a while, but the leaks will show and the costs will add up.
