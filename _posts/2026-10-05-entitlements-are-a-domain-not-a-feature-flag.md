---
layout: post
title: "Entitlements Are a Domain, Not a Feature Flag"
date: 2026-10-05
description: "Gating paid features with flag segments is easy to start and hard to undo, because which customers are owed a feature is a commercial decision that needs its own owner, audit trail, and offline rules. It belongs in its own domain, and a flag can hold it only as a deliberate stopgap with an owner and a written trigger for replacing it."
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
  - title: "LaunchDarkly Documentation: Offline mode"
    url: "https://launchdarkly.com/docs/sdk/features/offline-mode"
  - title: "RevenueCat Documentation: Caching"
    url: "https://www.revenuecat.com/docs/test-and-launch/debugging/caching"
  - title: "Ryan Echternacht: Billing vs Entitlements: What's the Difference? (Schematic, 2026)"
    url: "https://schematichq.com/blog/billing-vs-entitlements-whats-the-difference"
  - title: "LaunchDarkly Documentation: Secure mode"
    url: "https://launchdarkly.com/docs/sdk/features/secure-mode"
  - title: "Sam Newman: Backends For Frontends (2015)"
    url: "https://samnewman.io/patterns/architectural/bff/"
  - title: "Statsig: When allocation point and exposure point differ"
    url: "https://www.statsig.com/blog/when-allocation-point-and-exposure-point-differ"
---

It usually starts with one feature. The product team wants the new reporting dashboard available only on the enterprise plan, and there's no plan model in the code yet. The flag service is already wired in and supports targeting, and a segment called `enterprise-customers` takes ten minutes to set up. A year later there are a dozen such segments. Every grant now goes through engineering, the code understands plans only as segment names, billing and access drift apart, and change logs are not sufficient to audit the proper state of customer product access. Most people involved feel the strain, but there's no clear way back.

I think the way back starts with seeing that this was never a flag decision. Release toggles, experiments, and kill switches are decisions about how code behaves, made by the people who build and run it. Deciding which customers are owed a feature is a commercial decision, and it belongs to a business domain with its own owner, policies, and audits. Beyond the server-side and operational issues, a solution also has to account for client-side apps, which can quickly accelerate the pain and complicate a solution.

## Feature Flags Decide How Code Behaves

Martin Fowler's 2010 entry on feature toggles presents them as a way to keep unfinished work deployed but switched off on the main branch when a feature takes longer than a release cycle. Unleash, an open-source feature flag platform, still describes a release flag as a way to "manage the release of new or incomplete features," with an expected lifetime of 40 days.

Experiments and kill switches use the same switch to decide which version should ship or whether code should run right now.

When the team that builds and runs the product decides how the code should behave, it's a feature flag. That holds even when a product manager runs the experiment, because no customer is owed the variant they landed in. By the same test, a beta promised to named design partners is owed for as long as the promise runs, so it's an entitlement. When sales, finance, or a contract decides who gets a feature, it's an entitlement that happens to use a flag. A flag service can still carry that answer, but then it runs one department's decisions through a tool built for another's.

## The Standard References Treat Entitlement as a Flag Type

Pete Hodgson's catalog of toggle types, published on Fowler's site, sets permissioning toggles beside release, experiment, and ops toggles. Permissioning toggles change "the features or product experience that certain users receive." Hodgson notes these "may be very-long lived compared to other categories of Feature Toggles - at the scale of multiple years."

The vendors built the category in. Unleash ships a permanent permission flag type to "control feature access based on user roles or entitlements." LaunchDarkly's entitlements guide treats entitlement flags as permanent ones, which "are part of the everyday operation of the application." A 2020 post on LaunchDarkly's blog by Dawn Parzych goes further: "Instead of creating a custom build for a customer requesting a specific feature, wrap a flag around the feature and release it to that particular customer."

A 2020 interview study by Meinicke, Wong, Vasilescu, and Kästner shows teams drifting there without deciding to. Practitioners "usually do not distinguish between different kinds of flags," and "a feature flag that initially guards a new feature may become a configuration option that should be only available for 'premium' users."

## What a Flag Service Can't Do When It Holds the Entitlement

Each of a flag service's design choices is likely sensible for a release decision and wrong for a commercial one.

### No Single Fallback Is Right for Every Customer

Flag clients are built to never break the application. OpenFeature, a vendor-neutral standard for flag evaluation APIs, requires in its specification that client methods "MUST NOT throw exceptions" and that evaluation calls "must always return the default value in the event of abnormal execution." For a release flag, that's right, because falling back to off means the old behavior everyone has been running.

For an entitlement there's no safe default. LaunchDarkly's entitlements guide warns that if the application can't connect, "all of your end users will receive a single fallback variation." Default to off, and every enterprise customer loses what they bought. Default to on, and every free customer gets it.

An entitlement service can fail too. A client that starts with nothing cached falls back to one default, no matter which system holds the grant. The difference is who decides how long a cached grant still counts. LaunchDarkly's offline-mode documentation says a client SDK that can't reach the vendor uses "the latest stored flag variation values." Unless every app build adds its own expiry check, a cancelled customer's device keeps any paid feature that works offline for as long as it stays offline.

An entitlement system makes that an explicit window. RevenueCat, which manages in-app subscriptions, fixes one for every app, so an entitlement active when a device went offline "will remain active for up to three days." A team that owns its entitlements lets the plan owner set it.

### A Change Log Isn't an Audit Trail

When finance, support, or legal asks why a tenant has a feature, they want the agreement that granted it, when it started, and when it ends. A flag service records that someone added a tenant ID to a segment on a given day. Giving sales a role in the flag tool changes who edits, not what's recorded.

Approvals, a comment, and a removal date can sit on that change, but the contract, trial, or sales exception behind it lives in a ticket or a Slack thread, if anywhere. Even a required contract ID is free text the flag service can't validate or query. Asking which tenants had a feature last quarter, and under which agreements, means replaying segment edits. A segment's history is enough for a rollout but not for a decision with money attached.

### Billing and Access Drift Apart

Once the flag service decides access, billing knows what customers bought and the flag service knows what they can use, and usually nothing reconciles the two. A downgrade in billing doesn't remove the tenant from the segment, and a sales exception granted in the segment never reaches billing. Schematic is an entitlement platform vendor with an interest in the point. It describes the common path: "many teams use their feature flag tool for entitlements early on, and then realize the two concerns need to be separated as their pricing gets more complex."

LaunchDarkly's guide offers segments that stay in sync with an external system, so billing could feed one, but only if every grant, sales exceptions included, goes into billing first. A separate domain still needs that discipline, but it can enforce it. Billing sends plan changes as events, and the entitlement store refuses any grant with no agreement behind it. Exceptions and trials start in the entitlement store and flow out to billing. A hand-edited segment can't refuse anything.

## Entitlement Is a Domain With Its Own Owner

Product access encodes the company's pricing, contracts, and obligations to each customer. It has an owner outside engineering, usually product and sales, policies about who may grant exceptions, and audit requirements because what a customer can use is part of what they're billed for.

It also has its own model of plans that bundle features, contracts that override them with their own dates, expiring trials, and seat limits, none of which a segment expresses. That's the profile of a bounded context, not a flag type. Modeling it as its own domain, with grants that are dated and never overwritten, closes each gap above. A service answers "may this tenant use this feature?" from data it owns. Billing can host that domain if its catalog maps plans to features and also records exceptions and trials with their dates.

| Concern | Entitlement held in a flag service | Entitlement held in its own domain |
| --- | --- | --- |
| Who grants access | Whoever edits segments, checked against nothing | Product and sales grant it, under their own exception policy |
| What a grant records | Who changed a segment, and when | The agreement behind it, with start and end dates |
| What a renewal touches | Removal dates edited per segment, linked to no contract | The contract's dates, once, and every plan feature follows |
| How billing stays in step | Two systems hold one fact, and neither wins | Billing sends plan changes in, and exceptions flow out to it |
| What happens in an outage | On clients, the last stored value with no expiry, or one coded fallback | A fallback and offline window the plan owner sets |

## One Contract Can Justify a Temporary Flag

The hardest case is the one Parzych's advice describes. A single customer's contract requires a feature nobody else has asked for. For now, everything about it is in doubt, including its specification, its stability, whether it meets the customer's needs, and whether it will ever sell. The contract item itself isn't negotiable.

### Two Decisions Share One Flag

Who is owed the feature is settled. Whether the feature survives is the open question, and it's partly about the code and partly about the market.

Engineering's usual reason to keep unproven code behind a flag is the ability to turn it off. For this tenant, turning it off breaches a contract, so the off switch is a commercial decision and not an operational one. The fallback problem returns in its starkest form, since no single default can be on for the one tenant who holds the contract and off for everyone else. Where an entitlement domain already exists, the grant goes there and the flag only isolates the code. Where none exists, the flag carries both decisions.

### Every Exit Removes the Flag

Neither the off switch nor the fallback problem goes away, but both can be accepted on purpose. Making an unproven feature that one contract requires into a plan feature would be premature, and the flag keeps the code isolated until the open question is answered. I think that makes this case a legitimate use of a flag, declared as intentional technical debt and owned by product and sales rather than engineering. The off switch and the outage fallback are now their risks to carry.

That ownership means only product or sales may change the grant, and its exit trigger is recorded with the contract. If engineering needs an incident kill switch, it's a separate flag whose use product signed off on in advance.

What separates it from Hodgson's multi-year permissioning toggles is that it has a decision point, due no later than the first renewal, and every way out of that decision removes the flag:

- **Another customer wants it.** The grant moves into the entitlement model as a plan feature, and the flag goes away.
- **It becomes standard.** The code path becomes permanent and the flag is deleted.
- **The contract ends or the feature fails.** The code is removed with the flag.

Parzych's advice is right on the first day. It becomes a problem only when nobody records the exits and the flag turns into a permanent grant with no owner.

## On Client Apps, Vendor Coupling Compounds the Entitlement Problem

Mobile, desktop, and browser apps need the same answer as servers, sometimes offline, and flags usually reach them through the vendor's SDK.

### Clients Still Need Flags, but Never Decide Entitlements

Client apps arguably need flags more than servers do, since a client fix waits on app store review and on users who don't update. But the client is never the authority on an entitlement. It can hold a grant the server issued for as long as the plan's rules trust it, but the server enforces, and the client only decides what to show.

### The Vendor's SDK Ties Every Build to the Vendor

The vendor's SDK, and its representation of the answer, become part of every installed build. Swapping vendors waits on app releases, and until old builds disappear, you can't put your own layer between the client and the vendor. The layer serving the answer isn't yours either, so you can't merge sources, set expiry and invalidation for each kind of data, or push your own change events. I think direct vendor SDK access from client apps is a trap, though many teams accept it for the streaming updates and built-in experiment analysis that come with it.

Entitlements in the flag service make that coupling worse. Every build then depends on the vendor for what customers are owed. Exposure gets worse too. LaunchDarkly's secure mode exists because a malicious end user "could use a context or user key to identify what flag values another end user receives," and it covers only its JavaScript-based SDKs. Its other SDKs have no such protection. If tenant keys are readable slugs like `acme`, a modified client can probe flags and learn which paid features a named customer holds, even when the server enforces every grant.

### A Projection Fixes the Source but Not the Layer

For a team already deep in the hack, a first step back is fixing where entitlements come from while the flag service keeps serving them. I've used this shape before, with a read store that only receives changes from the audited business store and is never written to directly. The flag service becomes a projection of an entitlement store that sales and product own.

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

That makes LaunchDarkly's synced segment, described earlier, a rule instead of a hope, and two conditions keep the projection honest. Only the sync integration may write to entitlement segments, enforced in the vendor's permissions rather than by agreement, and the whole projection can be rebuilt by replaying the source. It works, but the sync and the rebuild can each break. It also leaves the device getting grants through the vendor's SDK, with every problem above.

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

One number says how often to refresh, and the other says how long a cached answer still counts when a refresh fails. Contract grants change rarely, so hourly is plenty, and an in-app purchase forces a refresh. The plan owner decides grants stay trusted for three days offline. That window is a promise, so data a user creates under a cached grant has to sync even if the grant ended while the device was offline. What happens to that data next is the plan owner's call too. `generatedAt` lets the client tell how old its copy is, and nothing in the exchange touches the flag vendor.

### A Facade Decouples Flags From the SDK, as a Separate Choice

Release flags still come through the vendor's SDK, and moving them can wait. The usual shape is a thin endpoint you own in front of the flag service. It's the kind of server component Sam Newman describes in his backends-for-frontends pattern. The vendor's contract ends at the server. If one endpoint serves both grants and flags, the response should keep them apart, because one flat map of booleans can't tell a release toggle from a contract grant.

The SDK also records who saw each variation, for experiments. Behind a facade, the app takes over that job. Statsig's experimentation guidance explains that counting users who never reached a feature dilutes an experiment's result. For a change that lives entirely in the interface, only the client knows whether the user reached it.

A facade also gives up the vendor's real-time streaming of flag changes, so a client kill switch waits for the next refresh. A change too urgent for that usually belongs on the server. A client-only one, like disabling a crashing native screen, is a reason to keep release flags on the vendor's SDK.

## A Flag Can Stand In When the Gap Is Written Down

None of this means a startup with one paid tier needs an entitlement service on day one. But I think holding product access in a flag is still a hack, and the only good reason for it is a timeline or budget that would otherwise block delivery. Even then it's a cost, because paying it off means refactoring the code and migrating the grants. Someone should decide it on purpose and write down three things: that the flag is standing in for an entitlement domain, who owns that gap, and what will trigger paying it off. A good trigger is the first grant no plan explains, such as a sales exception, after which segments hold facts billing doesn't.

Unstated, the gap compounds. Each segment and sales exception adds to a later migration. Each client build that reads entitlements from the vendor's SDK adds a contract you can't recall. And the flag service keeps gaining authority because nobody recorded that it was never supposed to have any.

Hacking feature flags can work because each wrong answer is usually recoverable on its own. A tenant who gets a feature a day late complains and gets a credit. No credit undoes exposing what other customers bought, though. A different system layer that decides who can sign in, move money, or read another tenant's data has no such margin, and the same shortcut is never an option. A hack can hold together for a while, but the leaks will show and the costs will add up.
