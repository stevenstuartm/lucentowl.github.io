---
layout: post
title: "Most Microservices Are Not Services"
description: "A service is a claim of authority over a decision, and a business has a bounded number of those. Most things called microservices hold no such claim, which is why service counts grow far past anything the standard arguments for decomposition can justify."
tags: [architecture, microservices, distributed-systems, domain-driven-design, team-topology]
author: steven-stuart
---

I have been building distributed systems for more than fifteen years, and there is one question I have never answered to my own satisfaction. Why would a company need a thousand services? Or five hundred? Or two hundred?

I understand the arguments and I have made some of them. Independent scaling, team autonomy, technology choice, contained blast radius. Each holds up on its own. None of them accounts for the arithmetic, because the number of deployables in a large estate tends to exceed the number of situations those arguments describe by an order of magnitude.

For a long time I assumed I was missing something about operating at scale. What I think I was actually missing is that the count was never the output of those arguments at all. Most of what gets called a microservice is not a service. Some of it is legitimately something else, and the rest is justified by nothing at all. Once those three are separated, the arithmetic stops being mysterious.

## A Service Is a Claim of Authority

Authority in a software system is decision-making power. Something holds authority over data when it is the canonical source of truth for that data, and over a behavior when it is the only thing that can legitimately enforce it.

### Authority Means Owning a Decision Nothing Else Can Make

An order service that determines whether an order can still be cancelled holds authority over that decision. It knows the fulfillment state, the payment state, and the policy, and no other component can reach the same verdict without duplicating all three. If a second component can also decide, neither one is the authority, and the two will diverge the first time the policy changes and only one of them is updated.

That is the property that makes a boundary worth the cost of a network hop. Everything expensive about distribution, including serialization, partial failure, versioned contracts, and distributed tracing, is the price of protecting a decision that genuinely belongs in one place.

### Not Every Deployable Needs to Hold Authority

A great many deployables own no decision. They transform a payload, forward a message, fan out a notification, or wrap a call to something that does hold the authority.

Some of those are correct. An async handler that calls into a domain holds no authority and is still justified, because it runs on a different operational envelope than the request path, with its own retry semantics and its own scaling profile. It earns a boundary on the second condition rather than the first.

The rest earn it on neither, which gives three terms instead of two. A service is justified by the authority it protects. A worker is justified by the envelope it isolates. Surplus is justified by nothing, and ships on its own schedule because the pipeline permits it rather than because the design requires it.

A useful check is whether the thing can be named without a follow-up explanation. "OrderCancellation" states what it decides. "OrderProcessingWorker" states only when it runs, and whether that is a worker or surplus depends entirely on whether the schedule is genuinely its own.

### Contour Draws the Line, Bond Enforces It

Two properties decide whether a claim of authority holds. Contour is how precisely it is drawn, and it needs behavioral coherence, meaning the decisions inside change together for the same reasons, alongside operational coherence, meaning nothing inside needs to scale or fail independently of the rest. Pricing rules and refund rules change for different reasons, so they are separate claims. A split satisfying neither condition produces a deployment unit.

Bond is whether anything respects the line. A strong bond leaves no route around the contract. A weak one has bypasses like direct database reads, internal calls that skip validation, or a shared table that lets a second writer reach the same state.

They fail differently, and the bills arrive on different schedules:

- A broken bond costs correctness. It fires rarely and hard, and it surfaces in a postmortem rather than a budget.
- Poor operational contour costs money continuously, since a boundary provisioned for the busiest thing inside it over-provisions everything else, every hour.
- Poor behavioral contour costs velocity continuously, and it appears on no invoice at all, which tends to leave it unfunded longest.

### The Boundary Should Cost What It Protects

A boundary can be well contoured and strongly bonded and still cost more than it returns. Both sides of that trade can be priced. The hop is measurable, since latency budget, serialization, contract versioning, telemetry ingestion, and the code that handles partial failure all show up on a bill or a calendar. The authority is estimated rather than measured, but it still resolves to a number. What does it cost when that decision diverges? Pricing rules living in two components that drift apart produce incorrect charges, and incorrect charges have a dollar figure.

The two are paid on different schedules. The hop recurs on every request, forever. The authority pays out only when a decision would otherwise have drifted, which happens rarely and occasionally costs a great deal. A network boundary behaves more like an insurance premium than a purchase, and asking what it insures against sorts an estate quickly.

An envelope returns differently. Its value arrives continuously, delivered on every message rather than banked against a divergence that may never come, which is why a worker justified by a genuine envelope is easier to defend than a service justified by a hypothetical authority.

<blockquote class="pull-quote">
<p>A deployment unit that wraps a call to something else is paying an insurance premium on a policy that can never be claimed.</p>
</blockquote>

| Boundary cost paid | What it buys | What you have |
| --- | --- | --- |
| Yes | Divergence prevented | A service. Fair trade. |
| Yes | An envelope isolated | A worker. Also a fair trade. |
| Yes | Nothing, since nothing else could decide it | Surplus. A premium against a risk that does not exist. |
| Yes | Nothing, since the bond is weak | Full price, no coverage. |
| No | Divergence prevented | An in-process authority. The cheapest correct answer. |

A weak bond charging full price is the row teams tend to recognize last. A service whose database is also read directly by a reporting job, or whose validation is skipped by an internal call, pays the boundary cost on every request while still carrying the divergence risk it was meant to remove.

The final row is the option a count-driven estate forgets exists. A module inside a single deployable can hold authority over a decision perfectly well, and it does so without the premium.

This will not compute to a decimal, and it is not meant to. Its use is in forcing someone to name the divergence a given boundary prevents, so that the absence of an answer becomes conspicuous.

## The Number of Authorities a Business Has Is Bounded

### Reasons to Change Come From the Domain, Not the Org Chart

Count the distinct reasons a business changes its own rules. Pricing changes. Entitlement changes. Fulfillment changes. Settlement changes. A large retailer might have forty such reasons. A bank might have sixty. That number is set by the business, and it grows slowly, roughly at the pace new lines of business appear.

Engineering headcount grows much faster than that, and nothing ties the two together.

### Operational Divergence Is Rarer Than It Looks

Operational coherence is often invoked to justify a split that behavioral coherence would not support, so it deserves a stricter reading. Genuine divergence means orders of magnitude rather than a factor of three. A playback path running ten thousand times the volume of an account settings path has an incompatible operational envelope. Two endpoints where one is somewhat busier than the other usually do not.

Event-driven autoscaling has narrowed this further. Load that once required a separate deployable to absorb is now frequently absorbed by the platform without a boundary change, which removes a category of split that used to be defensible.

### Uber Ran the Census and Published the Result

Uber grouped around 2,200 critical microservices into 70 domains (Source: [Uber Engineering Blog, *Introducing Domain-Oriented Microservice Architecture*](https://www.uber.com/us/en/blog/microservice-architecture/){:target="_blank" rel="noopener noreferrer"}). Seventy business capabilities. Roughly thirty-one deployables each.

Their description of the circumstances that prompted the work is more damning than the ratio. Engineers investigating a root cause "had to work through around 50 services across 12 different teams." Building a simple feature meant working across services owned by different teams, requiring "extensive collaboration with time spent on meetings, design, and code review." And most tellingly, "services that appear to be independent all have to be deployed together to safely perform any change."

That last sentence describes a monolith with network latency between its function calls. The independence that justified the split had already been lost, and the count kept growing anyway.

## Workers Are Bounded by Envelopes, Not by Tasks

Bounding the authorities does not bound the estate. Most deployables in a mature domain are async handlers that were never justified by authority to begin with, so they need their own census, run on the second condition instead of the first.

An envelope is a scaling profile, a retry and failure semantic, a latency tolerance, and a resource shape. A domain tends to have a handful of them. Fast interactive work, bulk reprocessing, long IO-bound calls to something external, scheduled sweeps, and high-fanout notification. Envelopes are also shareable in a way authorities are not, since one bulk-reprocessing runtime can serve many domains. An envelope is a property of the work's physics rather than of the business.

So group the workers by envelope and count the groups. Ten handlers that are all IO-bound, retried three times, and tolerant of minutes of latency share a single envelope between them. Splitting them across ten deployables buys nothing, because they scale identically and fail identically. That is the per-function split again, moved onto the async axis.

Forty domains and two hundred workers comes to five each, which sits at the upper end of plausible rather than past it. The raw number settles nothing. Collapse those two hundred into envelope groups, and if twelve groups come back, the remaining one hundred and eighty-eight were justified by a condition they do not meet.

### Pipelines Move the Invariant Into the Choreography

Splitting one domain operation across a multi-stage pipeline does something worse than waste money. Each stage mutates state the domain is supposed to own, and the rule holding that state together stops living inside the authority and starts living in the ordering. Stage three assumes stage two ran. Nothing enforces that assumption, and partial completion leaves the domain in a condition no single component can detect or repair.

That is a broken bond, and it is the most expensive kind, because it does not look like a bypass. Direct database access announces itself. Choreography looks like an architecture diagram. Meanwhile every stage boundary has added a queue, a retry policy, a dead-letter path, and one more way to be half-finished.

Splitting a worker because it might one day need its own envelope carries that cost forward on speculation. Speculative behavioral splitting costs money and velocity. Speculative operational splitting inside a pipeline costs correctness, since each stage boundary added against a hypothetical is another place the invariant can fall through.

## Why the Count Grows Past the Census

### Creation Was Automated and Deletion Never Was

Standing up a service was optimized down to almost nothing. A repository template, a pipeline definition, an infrastructure module, and half an hour. Retiring one rarely received the same attention. It requires proving nothing still calls you, locating the owner of every caller, coordinating their changes, and then producing nothing anyone can point at in a review.

One direction is frictionless and the other is manual, so the count only accumulates. A service count is rarely a design. It is more often an accumulation of moments when creating something new was cheaper than negotiating a change into something old.

### Forking a Service Routes Around a Person

At two hundred engineers, the alternative to a new service is adding a function to an existing one. At eight thousand, the alternative is negotiating with a team in another time zone that owns that service, has its own roadmap, no incentive to absorb your change, and will inherit the page when it misbehaves.

Forking is how an engineer routes around a person rather than a technical constraint, and it genuinely saves that team months. The cost lands somewhere else, spread across pipelines, telemetry ingestion, idle compute, on-call surface, and the call graph. It rarely appears as a line item anyone can attribute back to the decision that created it, which is why the practice tends to survive review even at companies that review carefully.

### Reorganizations Split Services and Rarely Merge Them

Systems tend to mirror the communication structures of the organizations that build them. When a team splits, its services often follow within a quarter or two. When the organization consolidates again, the services usually stay where they are, because merging them is the unrewarded direction described above. Several reorganizations later, the topology reflects an org chart that no longer exists.

## What the Surplus Costs

### Coupling Moves From the Compiler to the Call Graph

Coupling inside a single deployable is visible to a compiler. Change a signature and the build names every caller, immediately and for free. Split that same coupling across a network and it does not disappear, it just stops being checked. The dependency is still there, but now it surfaces in staging, or in production, or in a postmortem.

Teams that split to gain independent deployability can end up with less of it than they started with, which is the condition Uber described when it observed that nominally independent services had to be released together.

### A Unit With No Authority Cannot Explain Itself

A component that owns a decision can classify its own behavior. It knows that a declined payment is an expected business outcome and a gateway timeout is not, because it holds the policy that makes that difference meaningful. A component that only moves a payload holds neither, so it reports what it can observe, which amounts to status codes, durations, and retry counts.

Multiply that across hundreds of units and the result is enormous telemetry volume carrying very little meaning. Teams then purchase tooling to reconstruct, from the outside, context the code was never asked to author. The tooling can correlate the fragments, but it cannot supply the judgment, because the judgment was never encoded anywhere.

### The Platform Gets Blamed for the Count

Cluster orchestration is sized by compute footprint, meaning node count, bin-packing pressure, and idle capacity. Service count is a separate axis measuring coordination load. The two are independent, and the industry tends to sell them as one.

A video transcoding pipeline running four services across three thousand nodes has an enormous footprint, a trivial count, and a genuine need for a scheduler that can pack them well. Two hundred services on twelve nodes has an enormous count, a trivial footprint, and a coordination problem no scheduler addresses. Teams in the second position often adopt the tool built for the first, then conclude the tool is unreasonably hard to operate. The tool was answering a question they had not asked.

<blockquote class="pull-quote">
<p>Distribution is the price of protecting a decision. When there is no decision to protect, only the price remains.</p>
</blockquote>

## Decomposing on Evidence

None of this argues for a single deployable, and none of it argues that splitting is a mistake. Decomposition against evidence remains correct. The case here is against splitting on neither condition, and against reading a deployable count as though it were an architecture.

Before creating the next one:

- State what it decides, in one sentence that does not contain the word "and"
- If nothing comes, state which envelope it isolates instead, and how that envelope differs from the one the caller already runs on
- If neither answer arrives, treat it as a packaging choice rather than a boundary, and name it accordingly
- Confirm the decisions inside it change together, for the same reasons, on the same schedule
- Confirm anything claiming an operational split diverges by orders of magnitude rather than by a factor of two or three
- For a pipeline stage, name the component that can still detect a half-finished run, and confirm it is the domain rather than the sequence
- Ask what would have to become true for this deployable to be deleted, and whether anyone would ever be rewarded for doing it
- Run both censuses: count the distinct reasons your business changes its rules, count the distinct envelopes your work actually runs on, and treat the gap between their sum and your deployable count as a first estimate of the surplus

Uber's ratio was thirty-one to one. Most estates have never measured theirs, which is part of how they got there.
