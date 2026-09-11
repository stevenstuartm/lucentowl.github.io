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

> **PROPOSED** - accept, rewrite, or delete. Reframes the opening away from arithmetic.
> That last sentence is the part I no longer believe. The count is what made me
> ask the question, and it is not the answer. A ratio can be defended by anyone
> willing to defend it, and no number settles what any particular deployable is
> for. This is not an argument that some estates have too many services. It is
> an argument that three different things are wearing one word, and that once
> they are separated, the justifications still standing divide into two kinds:
> the ones that can be tested, and the ones that cannot.
>
> This also concedes Sam Newman's position that size is among the least
> interesting properties of a microservice architecture. Conceding it costs the
> post nothing, because the post's real claim was never about size.

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

Two properties decide whether a claim of authority holds. Contour is how precisely the line is drawn, and it requires two kinds of coherence. Behavioral coherence means the decisions inside change together for the same reasons. Operational coherence means nothing inside needs to scale or fail independently of the rest. Pricing rules and refund rules change for different reasons, so they are separate claims. A split satisfying neither condition produces a deployment unit and nothing more.

> **PROPOSED** - accept, rewrite, or delete. Restores the canonical definition
> rather than inventing one.
> Contour, bond, and both coherence conditions were defined in
> [Architecture Is a Belief About Where Authority Belongs](/blog/2026/06/12/architecture-is-a-belief-about-where-authority-belongs.html),
> which states behavioral coherence as: "the authority's decisions, facts, and
> behaviors change together for the same reasons."
>
> The paragraph above keeps one of those three terms and drops the other two. That
> narrowing is what makes the definition read as custody over a piece of data, and
> it is why the boundary here looks smaller than the original intended. Restore the
> published wording:
>
> Behavioral coherence means the authority's decisions, facts, and behaviors change
> together for the same reasons.
>
> Two notes that follow from reading the source rather than reasoning from the
> draft alone. First, that post does not treat Single Responsibility as a rival
> definition to argue against; it treats SRP, normalization, least privilege, and
> bounded contexts as four traditions that each observed the same failure at a
> different altitude and converged on one answer, with SRP as the class-level case.
> This post inherits that position and does not need to relitigate it. Second, the
> draft uses contour, bond, and both coherence conditions without ever citing where
> they were defined. The link above should appear on first use regardless of what
> happens to the rest of this proposal.

Bond is whether anything respects the line. A strong bond leaves no route around the contract. A weak one has bypasses like direct database reads, internal calls that skip validation, or a shared table that lets a second writer reach the same state.

> **PROPOSED** - accept, rewrite, or delete. Same source, same kind of narrowing,
> with a consequence further down the page.
> The original defines bond as "the enforcement strength of the boundary, measured
> by the consequence of bypass: what breaks when the boundary fails," and adds that
> "bond strength is proportional to consequence. A payment processing boundary that
> is bypassed can produce corrupted financial state, while a read model that serves
> slightly stale data can tolerate a weaker bond."
>
> The paragraph above reduces that to whether anything respects the line, which
> makes bond binary. The proportionality is not decoration. It is what makes a weak
> bond on a low-consequence boundary a correct choice rather than a defect, and the
> cost table below currently contains a row reading "Nothing, since the bond is
> weak / Full price, no coverage" that is only true where the consequence of bypass
> is high. Either restore the proportionality here and qualify that row, or state
> plainly that this post is using a stricter reading and why.

They fail differently, and the bills arrive on different schedules:

- A broken bond costs correctness. It fires rarely and hard, and it surfaces in a postmortem rather than a budget.
- Poor operational contour costs money continuously, since a boundary provisioned for the busiest thing inside it over-provisions everything else, every hour.
- Poor behavioral contour costs velocity continuously, and it appears on no invoice at all, which tends to leave it unfunded longest.

### The Boundary Should Cost What It Protects

A boundary can be well contoured and strongly bonded and still cost more than it returns. Both sides of that trade can be priced. The hop is measurable, since latency budget, serialization, contract versioning, telemetry ingestion, and the code that handles partial failure all show up on a bill or a calendar. The authority is estimated rather than measured, but it still resolves to a number. What does it cost when that decision diverges? Pricing rules living in two components that drift apart produce incorrect charges, and incorrect charges have a dollar figure.

The two are paid on different schedules. The hop recurs on every request, forever. The authority pays out only when a decision would otherwise have drifted, which happens rarely and occasionally costs a great deal. A network boundary behaves more like an insurance premium than a purchase, and asking what it insures against sorts an estate quickly.

> **PROPOSED** - accept, rewrite, or delete. Answers the objection that this
> reasoning would equally condemn backups, redundancy, and disaster recovery.
> The comparison carries one more obligation, and it is the one that separates a
> boundary worth buying from a boundary nobody can ever evaluate. Real insurance
> has a claims process. Redundancy, backups, and regional failover each name a
> specific failure, carry a base rate somebody can look up, and, decisively, can
> be exercised. You can run a restore drill. You can fail a region over on a
> Tuesday afternoon and watch what happens. A boundary justified by the incident
> it prevents has no equivalent drill, because the evidence would have to be an
> event that did not occur. A premium that can never be claimed on is not
> insurance. It is a subscription.

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

> **PROPOSED** - the whole of the following section is new, through to the next
> `##` heading. Accept, rewrite, or delete it as a unit. Its placement is also
> open: it may belong here, or it may belong at the front as the post's opening
> move. It delivers the two arguments the introduction promises and the draft
> currently never returns to, technology choice and contained blast radius.

## The Justifications That Survive Have No Test

### A Component Can Pass Every Test Here and Still Be Split

Suppose none of the above applies. The behavior inside the boundary is coherent.
The operational profile is coherent. The bond holds, with no second writer and no
route around the contract. And the estate still runs many small components,
deliberately, because smaller pieces are believed to lower the risk of any single
change and to raise availability. The team knows the price and has decided to pay
it.

Monzo describes something close to this. Asked why the granularity, they
answered: "We want to minimise the risk of change. For example, if we want to
change the way contactless payments work, we're not affecting the chip and PIN
system" (Source: [The Register, *How does Monzo keep 1,600 microservices
spinning?*](https://www.theregister.com/2020/03/09/monzo_microservices/){:target="_blank" rel="noopener noreferrer"}).

At the level of that example they are right, and the framework here agrees with
them. Contactless and chip and PIN plausibly are two authorities. They change for
different reasons, on different schedules, under different scheme rules. That is
a real boundary, and it would be a real boundary at any count.

I am not in a position to say that an estate built this way is wrong. I am in a
position to say what the remaining justifications are made of.

Three of them survive the tests above, and they are precisely the three the
opening of this post named and then walked past: risk of change, availability,
and technology choice. They do not fail the same way. One cannot be tested at
all. One can be tested and usually answers against the person invoking it. One
can be tested and is rarely exercised.

### Might and Will Are Not the Same Kind of Claim

You **might** have a problem with a larger domain and a single change. Somebody
edits pricing, and something in refunds that nobody remembered breaks.

You **will** have a financial and operational problem with ten times the
components. Ten times the pipelines, the telemetry streams, the dependency
upgrades, the certificate rotations, the base image patches, the on-call surface,
the idle floor under each one. That is not a forecast. It arrives monthly, and it
arrives whether or not the boundaries were well drawn.

The two are not the same kind of claim, and the asymmetry is the whole argument.
One side is certain, recurring, and itemized. The other is a counterfactual, and
counterfactuals cannot be produced on request.

So ask it directly. What is the test that proves the assumption?

There is none. Not a hard test or an expensive one. None. The benefit being
claimed is an incident that did not happen, and there is no experiment whose
result is an absence. The cost is on an invoice. The benefit is a belief.

This is also where the question of how far to subdivide answers itself. Pricing
divides into promotional pricing, tiered pricing, and tax, and each changes for
reasons the others do not, so a purely definitional test descends forever and
never reaches a floor. The economic test terminates on its own. Subdivision stops
where nobody can any longer say what the next boundary buys, or describe an
exercise that would show it working.

### Splitting to Lower the Risk of Change Removes the Thing That Measured It

The risk-of-change justification rests on a premise worth stating out loud: that
you cannot reliably know what your own change will affect.

Do you not know what you changed? Do you not have the tests?

Inside a single deployable both questions have better answers than they do across
a network, and this post has already said why. Change a signature and the
compiler names every caller, immediately and for free. A test suite runs over the
whole behavior rather than over one participant in it. Splitting the component
does not remove the coupling. It removes the checking.

Which makes the move self-defeating in a specific way. A split justified by not
being able to see the blast radius destroys the instrument that reported the
blast radius. What used to be a failed build becomes a production incident, and
the trade gets filed under safety.

That is what it looks like to avoid discipline by means of discipline. It may
well be deliberate, and deliberateness is not a defense. It is exactly as brittle
as the scenario it was avoiding, and it is brittle in a place where nothing is
watching.

### Availability Is Testable, and It Usually Answers the Other Way

Availability is the one justification in this group that can be checked, and it
tends not to survive the check.

Ten components at three nines, arranged in series on a request path, multiply
rather than average. The result is roughly two nines, an order of magnitude more
downtime than the single component would have produced. Splitting lowers
availability by default. It raises availability only where each boundary is a
genuine bulkhead, which requires the bond to hold and a degraded path to exist on
the other side of it. A boundary with no fallback behind it is not isolation. It
is one more thing in the chain that has to be up.

Most splits made in the name of availability have neither the bulkhead nor the
fallback, which means the claim is not merely unproven. It is inverted.

### Technology Choice Is Testable and Rarely Exercised

The freedom to write each component in whatever runtime suits it is real, and it
is checkable in a way the others are not. Count the runtimes actually in
production. Most large estates converge on one or two, because hiring, libraries,
build tooling, security patching, and on-call rotation all pull toward
convergence. Where the count is genuinely three or four and each is carrying work
the others could not, the justification holds. Where it is one, the option was
bought and never exercised.

### The Platform Does Not Remove the Cost, It Relocates It

The strongest reply to all of this is that a good platform drives the marginal
cost of a component close to zero, which is roughly what Monzo claims. Their own
account contains the concession, though: the approach runs on "a lot of custom,
in-house tools and libraries that are not easy to replicate."

That is not the cost disappearing. It is the cost moving into a platform
organization whose headcount appears on a different line of the same budget,
which is the same disappearing act described later in this post, where the price
of a decision lands somewhere it can never be attributed back to the decision
that caused it. A cost that has been made invisible has not been removed. It has
been made harder to argue about.

## The Number of Authorities a Business Has Is Bounded

### Reasons to Change Come From the Domain, Not the Org Chart

Count the distinct reasons a business changes its own rules. Pricing changes. Entitlement changes. Fulfillment changes. Settlement changes. Estimates here are rough, but the only published count of this kind put a company the size of Uber at seventy. A large retailer or a bank would plausibly land in the same range, in the dozens rather than the hundreds. What the arithmetic needs is the order of magnitude, and that is set by the business. It grows slowly, roughly at the pace new lines of business appear.

Engineering headcount grows much faster than that, and nothing ties the two together.

> **PROPOSED** - accept, rewrite, or delete. Separately: "the only published
> count of this kind" is a claim about an entire literature and is not sourced.
> Soften it or drop it.
> This is the weakest passage in the post as it stands, because it asks a number
> to carry an argument. It does not need to. Whether a business has seventy
> reasons to change its rules or two hundred and seventy, the test in the section
> above applies unchanged to every boundary either count would produce. What the
> domain supplies is not a target. It is the reason a target is the wrong thing
> to look for.

### Operational Divergence Is Rarer Than It Looks

Operational coherence is often invoked to justify a split that behavioral coherence would not support, so it deserves a stricter reading. Genuine divergence means orders of magnitude rather than a factor of three. A playback path running ten thousand times the volume of an account settings path has an incompatible operational envelope. Two endpoints where one is somewhat busier than the other usually do not.

Event-driven autoscaling has narrowed this further. Scaling on queue depth or request concurrency, which tools like KEDA make routine on Kubernetes, absorbs inside one deployable the spikes that once required a second one. That removes a category of split that used to be defensible.

### Uber Ran the Census and Published the Result

Uber grouped around 2,200 critical microservices into 70 domains (Source: [Uber Engineering Blog, *Introducing Domain-Oriented Microservice Architecture*](https://www.uber.com/us/en/blog/microservice-architecture/){:target="_blank" rel="noopener noreferrer"}). Seventy business capabilities. Roughly thirty-one deployables each.

> **PROPOSED** - accept, rewrite, or delete. Repositions what Uber is evidence of.
> The ratio is the least interesting number on this page and probably should not
> be a number at all. What makes Uber worth citing is not thirty-one to one. It
> is that they wrote the symptoms down, in public, under their own name, and the
> symptoms are what the passage below describes. Read the ratio as the thing that
> prompted somebody there to go and count, which is all a count is ever good for.

Their description of the circumstances that prompted the work is more damning than the ratio. Engineers investigating a root cause "had to work through around 50 services across 12 different teams." Building a simple feature meant working across services owned by different teams, requiring "extensive collaboration with time spent on meetings, design, and code review." And most tellingly, "services that appear to be independent all have to be deployed together to safely perform any change."

That last sentence describes a monolith with network latency between its function calls. Uber writes that such monoliths "can form" rather than declaring their whole estate one, but the sentence sits in a section documenting problems they were having, and the count kept growing regardless.

### Uber's Own Remedy Is the Strongest Objection to This Argument

They did not collapse 2,200 services into 70. They left the services where they were and built a layer over them, with domain gateways and a layer hierarchy, aiming to "reduce overall system complexity while maintaining the flexibility associated with microservice architectures." The company that ran the census declined to act on it the way this post implies it should.

That was a defensible choice, and at their size it may have been the only affordable one. Consolidating 2,200 deployables is a multi-year migration against a codebase that does not hold still, while a gateway layer ships incrementally and starts returning value before it is finished. But it concedes the arithmetic rather than refuting it. If seventy domains is the granularity engineers actually reason about, and a gateway exists to make the estate legible at that granularity, then the 2,200 have become an implementation detail that still carries a full deployment, telemetry, and on-call bill. DOMA makes the surplus survivable. It does not make it justified.

What that argues for is treating the census as a diagnostic rather than a demolition order. Measuring the ratio tells you how much of an estate is structure and how much is sediment. What to do about a gap that already exists is a different question from whether to keep widening it, and the two deserve different answers.

## Workers Are Bounded by Envelopes, Not by Tasks

Bounding the authorities does not bound the estate. Most deployables in a mature domain are async handlers that were never justified by authority to begin with, so they need their own census, run on the second condition instead of the first.

### An Envelope Is Physics, and Physics Is Shareable

An envelope is a scaling profile, a retry and failure semantic, a latency tolerance, and a resource shape. A domain tends to have a handful of them. Fast interactive work, bulk reprocessing, long IO-bound calls to something external, scheduled sweeps, and high-fanout notification. An envelope is a property of the work's physics rather than of the business, which is why envelopes are shareable in a way authorities are not.

That shareability has a limit, and it is the contour rule from earlier. A runtime shared across ten domains that also executes ten domains' business rules holds decisions changing for ten different reasons, which is exactly the grouping contour forbids. The share works when the runtime supplies only the physics, meaning the scheduling, the retry policy, the concurrency limits, and the dead-letter handling, while the domain logic it invokes stays inside the authority that owns it. A shared bulk-reprocessing platform calling into forty domains is one deployable with forty callers. Forty separately deployed bulk reprocessors, each carrying its own retry configuration and its own scaling policy, are forty copies of the same physics.

### Group the Workers by Envelope and Count the Groups

Group the workers by envelope and count the groups. Ten handlers that are all IO-bound, retried three times, and tolerant of minutes of latency share a single envelope between them. Splitting them across ten deployables buys nothing, because they scale identically and fail identically. That is the per-function split again, moved onto the async axis.

Forty domains and two hundred workers comes to five each, which sits at the upper end of plausible rather than past it. But group those two hundred by envelope, and if twelve groups come back, then twelve distinct operational profiles are being carried by two hundred deployments. That gap is not all surplus, since some of it is domain logic that has to stay under its own authority. It is where to look, because every deployable inside it is paying for an envelope that something else already runs.

### Pipelines Move the Invariant Into the Choreography

Splitting one domain operation across a multi-stage pipeline does something worse than waste money. Each stage mutates state the domain is supposed to own, and the rule holding that state together stops living inside the authority and starts living in the ordering. Stage three assumes stage two ran. Nothing enforces that assumption, and partial completion leaves the domain in a condition no single component can detect or repair.

That is a broken bond, and it is the most expensive kind, because it does not look like a bypass. Direct database access announces itself. Choreography looks like an architecture diagram. Meanwhile every stage boundary has added a queue, a retry policy, a dead-letter path, and one more way to be half-finished.

Speculative behavioral splitting costs money and velocity. Speculative operational splitting inside a pipeline costs correctness, since each stage boundary added against a hypothetical is another place the invariant can fall through.

## Why the Count Grows Past the Census

### Creation Was Automated and Deletion Never Was

Standing up a service was optimized down to almost nothing. A repository template, a pipeline definition, an infrastructure module, and half an hour. Retiring one rarely received the same attention. It requires proving nothing still calls you, locating the owner of every caller, coordinating their changes, and then producing nothing anyone can point at in a review.

One direction is frictionless and the other is manual, so the count only accumulates. A service count is rarely a design. It is more often an accumulation of moments when creating something new was cheaper than negotiating a change into something old.

### Forking a Service Routes Around a Person

At two hundred engineers, the alternative to a new service is adding a function to an existing one. At eight thousand, the alternative is negotiating with a team in another time zone that owns that service, has its own roadmap, no incentive to absorb your change, and will inherit the page when it misbehaves.

Forking is how an engineer routes around a person rather than a technical constraint, and it genuinely saves that team months. The cost lands somewhere else, spread across pipelines, telemetry ingestion, idle compute, on-call surface, and the call graph. It rarely appears as a line item anyone can attribute back to the decision that created it, which is why the practice tends to survive review even at companies that review carefully.

### Reorganizations Split Services and Rarely Merge Them

Conway observed in 1968 that systems tend to mirror the communication structures of the organizations that build them (Source: [Melvin E. Conway, *How Do Committees Invent?*, Datamation, April 1968](https://www.melconway.com/research/committees.html){:target="_blank" rel="noopener noreferrer"}). When a team splits, its services often follow within a quarter or two. When the organization consolidates again, the services usually stay where they are, because merging them is the unrewarded direction described above. Several reorganizations later, the topology reflects an org chart that no longer exists.

## What the Surplus Costs

### Coupling Moves From the Compiler to the Call Graph

Coupling inside a single deployable is visible to a compiler. Change a signature and the build names every caller, immediately and for free. Split that same coupling across a network and it does not disappear, it just stops being checked. The dependency is still there, but now it surfaces in staging, or in production, or in a postmortem.

> **PROPOSED** - accept, rewrite, or delete. Structural note, not new argument.
> This paragraph is now load-bearing for the risk-of-change argument in "The
> Justifications That Survive Have No Test," which depends on exactly this
> observation. The two passages sit far apart and currently say the same thing
> twice. Decide whether this section moves up to join that one, or whether that
> one cites this and this one stays where it is.

Teams that split to gain independent deployability can end up with less of it than they started with, which is the condition Uber described when it observed that nominally independent services had to be released together.

### A Unit With No Authority Cannot Explain Itself

A component that owns a decision can classify its own behavior. It knows that a declined payment is an expected business outcome and a gateway timeout is not, because it holds the policy that makes that difference meaningful. A component that only moves a payload holds neither, so it reports what it can observe, which amounts to status codes, durations, and retry counts.

Multiply that across hundreds of units and the result is enormous telemetry volume carrying very little meaning. Teams then purchase tooling to reconstruct, from the outside, context the code was never asked to author. The tooling can correlate the fragments, but it cannot supply judgment that was never encoded anywhere.

### The Platform Gets Blamed for the Count

Cluster orchestration is sized by compute footprint, meaning node count, bin-packing pressure, and idle capacity. Service count is a separate axis measuring coordination load. The two are independent, and the industry tends to sell them as one.

A video transcoding pipeline running four services across three thousand nodes has an enormous footprint, a trivial count, and a genuine need for a scheduler that can pack them well. Two hundred services on twelve nodes has an enormous count, a trivial footprint, and a coordination problem no scheduler addresses. Teams in the second position often adopt the tool built for the first, then conclude the tool is unreasonably hard to operate. The tool was answering a question they had not asked.

<blockquote class="pull-quote">
<p>Distribution is the price of protecting a decision. When there is no decision to protect, only the price remains.</p>
</blockquote>

## Decomposing on Evidence

None of this argues for a single deployable, and none of it argues that splitting is a mistake. The case here is against splitting on neither condition, and against reading a deployable count as though it were an architecture.

### Before Creating the Next One


- State what it decides, in one sentence that does not contain the word "and"
- If nothing comes, state which envelope it isolates instead, and how that envelope differs from the one the caller already runs on
- If neither answer arrives, treat it as a packaging choice rather than a boundary, and name it accordingly
- Confirm the decisions inside it change together, for the same reasons, on the same schedule
- Confirm anything claiming an operational split diverges by orders of magnitude rather than by a factor of two or three
- For a pipeline stage, name the component that can still detect a half-finished run, and confirm it is the domain rather than the sequence
- Ask what would have to become true for this deployable to be deleted, and whether anyone would ever be rewarded for doing it
- Run both censuses: count the distinct reasons your business changes its rules, count the distinct envelopes your work actually runs on, and treat the gap between their sum and your deployable count as a first estimate of the surplus

> **PROPOSED** - accept, rewrite, or delete. Replaces the bullet immediately above.
> That bullet computes a target, and the post no longer believes in targets. It
> also contradicts the worker section, which reasons about five workers per domain
> and then concedes the gap "is not all surplus." A replacement that survives the
> rest of the post:
>
> - Name what the boundary buys, then describe the exercise that would show it
>   working: a restore drill, a failover, a test that fails when the boundary is
>   removed. If no exercise can be described, the justification is a belief, and
>   beliefs should not be billed monthly.

### For the Estate You Already Have

That checklist governs growth. It does nothing about accumulation, and the deletion asymmetry means accumulation does not resolve on its own. Three moves are available, in increasing order of cost.

**Make the ratio visible.** Put the deployable count next to the authority count and the envelope count, on the same dashboard as cost and incident volume. A number nobody computes is a number nobody manages, which is most of how a count reaches four figures without anyone deciding it should.

**Fund deletion the way creation is funded.** Creation is frictionless because somebody built a template for it. Retirement stayed manual because nobody did. Tooling that finds zero-traffic deployables, names their remaining callers, and opens the pull requests changes the economics more than a policy ever will, because the asymmetry was never about intent.

**Collapse on the envelope axis before the authority axis.** Merging two authorities is a domain argument, and it can run for quarters because it should. Merging ten handlers that share a retry policy and a scaling profile is mostly configuration. It removes deployables without reopening a single question about who owns which decision, which makes it the cheapest way to actually bring the count down.

> **PROPOSED** - accept, rewrite, or delete. Adds the move the post names as
> cheapest and then never prescribes.
> **Move an authority in-process before moving it anywhere else.** The cost table
> above calls an in-process authority the cheapest correct answer and calls it the
> option a count-driven estate forgets exists, and then none of the moves here is
> that move. A module inside one deployable can hold a decision as completely as a
> service can, with the same owner, the same tests, and the same enforcement, and
> without the premium. Reaching for it is not a retreat from the boundary. It is
> keeping the boundary and declining the hop.

Uber's ratio was thirty-one to one. Most estates have never measured theirs, which is part of how they got there.

> **PROPOSED** - accept, rewrite, or delete. Replaces the closing line above,
> which is a measurement prescription the post no longer makes.
> A candidate ending built on what the post now argues: the question was never how
> many. It was what each one buys, and whether anyone can name the day it pays
> out. Most of them cannot, and the bill arrives anyway.
