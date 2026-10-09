---
layout: post
title: "Rebuild Success Often Comes from Realignment, Not New Technology"
date: 2025-11-07
description: "Many celebrated system rebuilds appear successful not because of new technology, but because they force teams to realign with value and best practices. This realignment work could often have happened without the rebuild."
tags: [architecture, leadership, decision-making, aaa-cycle]
author: steven-stuart
sources:
  - title: "David Heinemeier Hansson, We stand to save $7m over five years from our cloud exit"
    url: "https://world.hey.com/dhh/we-stand-to-save-7m-over-five-years-from-our-cloud-exit-53996caa"
  - title: "LinkedIn Moved from Rails to Node: 27 Servers Cut and Up to 20x Faster (High Scalability)"
    url: "https://highscalability.com/linkedin-moved-from-rails-to-node-27-servers-cut-and-up-to-2/"
  - title: "Ikai Lan, Clearing up some things about LinkedIn mobile's move from Rails to node.js"
    url: "http://ikaisays.com/2012/10/04/clearing-up-some-things-about-linkedin-mobiles-move-from-rails-to-node-js/"
  - title: "Kirsten Westeinde, Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity (Shopify Engineering)"
    url: "https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity"
  - title: "Joel Spolsky, Things You Should Never Do, Part I"
    url: "https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/"
  - title: "Nelson P. Repenning and John D. Sterman, Nobody Ever Gets Credit for Fixing Problems that Never Happened (California Management Review, 2001)"
    url: "https://doi.org/10.2307/41166101"
---

Business and technically minded people both tend to credit new technology for the gains seen after a system or tool rebuild. They will also often blame the tech when a rebuild goes awry. But when you examine what actually changed, the technology often didn't drive the gains or cause the failure. The improvements (or their absence) came from alignment with business value and the application of operational discipline. Often the gains were available without the rebuild. Failed rebuilds get misjudged the same way, and when someone tracks one against what it promised, its problems often show long before more development is wasted.

<blockquote class="pull-quote">
<p>The critical error is assuming the new runtime, framework, or platform created the success. Often ignorance was the actual constraint, and rebuilding forced tech and business teams to confront it.</p>
</blockquote>

This misattribution creates dangerous organizational patterns. Teams propose rebuilds when the underlying problem is dysfunction, not technical limitations. The rebuild becomes a moving target that allows leadership to avoid accountability, celebrate "innovation" while making things worse, and mask problems that were never technical to begin with.

## Misattributed Success: The New Technology Gets Credit for the Realignment

The same confound shows up across technical domains:

**Infrastructure migrations**: Consider an organization that blames rising cloud costs on the provider's pricing model and migrates to on-premises infrastructure. Eighteen months later, leadership celebrates reduced hosting bills without mentioning the tripled operations team, degraded availability, and manual processes replacing what cloud automation previously managed.

If those savings trace to right-sizing and decommissioning, the root cause was never the cloud provider. It was absence of operational accountability. No one tracked which resources provided value, right-sized instances, or decommissioned abandoned experiments. The migration forced this discipline, but the same discipline applied to existing infrastructure would have achieved the savings without the rebuild. It would also have avoided the larger operations team and lost availability that came with it.

Not every repatriation is misattributed. David Heinemeier Hansson projected that 37signals would save about $7 million in server costs over five years by leaving AWS, "without changing the size of our ops team." That is what a genuine pricing case looks like: steady, predictable load, an operations team already in place, and savings counted after staffing.

**Runtime rewrites**: Teams celebrate performance gains after rewriting in a faster language. But was it the new runtime, or was it the rewrite that forced them to finally address inefficient database access patterns, redundant service calls, and missing caches?

High Scalability reported LinkedIn's move of its mobile server from Rails to Node.js as up to 20 times faster, with servers cut from 30 to 3. Ikai Lan, who had worked on the Rails version, answered that it made a cross data center call on single-threaded Mongrel servers "leaking memory like a sieve." He added that the comparison set "a lower level server" against "a full stack web framework."

Node's non-blocking I/O did fit the workload better, in his account, but he called it "not a performance panacea." He also said a port to JRuby could have bought "way more concurrency" without leaving the Ruby language.

He listed "the rewrite factor" among the causes. A rebuild from scratch by a team that knew the full requirements would have been "way better." He counted his own inexperience in that factor too, writing that the engineer he became years later would have done a far better job than he did in 2008. The headline credited Node with the whole gap, when part of it came from a team that finally understood the problem.

**Framework modernizations**: Teams credit the new frontend framework for improved responsiveness. But was it the framework's rendering model, or was it the rebuild that forced them to eliminate wasteful re-renders and implement proper state management?

<blockquote class="pull-quote">
<p>The new runtime gets credit, the new provider gets credit, and the new framework gets credit. But the realignment did the work.</p>
</blockquote>

### Credit Follows Visibility, Not Measurement

The misattribution has a mechanism. A rebuild changes the technology, the design, the scope, and the team's understanding of the problem all at once, so a before-and-after comparison can't separate their effects. The technology is the most visible of those changes and the one the proposal promised, so it collects the credit. Teams rarely trace each gain back to the change that produced it, so the credit gets assigned by visibility rather than measurement. That missing trace is also why nobody can say how often this happens.

### Four Checks Trace Each Gain to Its Cause

The way to know is to trace each gain to the change that produced it and ask whether that change needed the new technology. Four checks do most of that work:

1. **Backport the fixes.** Apply the same fixes to the old system and measure how much of the gap closes. Before a rebuild, those fixes come from diagnosis, like profiling the slow path or auditing what each resource costs. A rewrite is an expensive way to run a profiler.
2. **Price the fixes in place.** Compare what those fixes would cost in the old system with the rebuild's estimate, since heavy coupling can make the in-place fix the more expensive path.
3. **Count dropped scope.** A gain from leaving features out of the new system isn't the technology's either. The old system can drop the same scope through incremental deprecation, even though retiring behavior in a live system is harder than leaving it out of a new one.
4. **Ask whether the old stack could adopt the discipline.** Some gains happen because the new technology made them cheap, like a framework whose state model makes wasteful re-renders hard to write. That gain belongs to the technology only if the old stack couldn't adopt the same discipline through a library or a convention.

When the gains trace to fixed queries, right-sized infrastructure, and optimized code, you could have achieved them on the existing system. In those cases the technology wasn't the constraint. Ignorance was. When a gain traces to something the old stack couldn't fix, like a garbage collector that really did cause the latency spikes, the technology earns the credit.

Shopify made this call in public. Kirsten Westeinde's "Deconstructing the Monolith" describes a Rails monolith whose missing boundaries meant an innocuous change could trigger a cascade of unrelated test failures. The team weighed microservices and rejected them for the network, deployment, and coordination costs they would add, then enforced component boundaries by business domain inside the existing application. The coupling was the problem, and they fixed it without a rebuild.

## When Rebuilds Masquerade as Solutions to Organizational Problems

Rebuilds often hide deeper organizational failures, and a rebuild by itself changes none of them.

### Missing Decision Records Make Tradeoffs Look Like Incompetence

When architectural decision records don't exist, future teams assume incompetence rather than recognizing intentional tradeoffs. Someone looks at the current architecture and declares "This is bad" when they really mean "I don't understand why it's designed this way." Without Architecture Decision Records documenting the constraints and reasoning behind key decisions, new technical leads tend to assume the previous team made poor choices rather than reasonable compromises.

Joel Spolsky made the code-level version of this argument in "Things You Should Never Do, Part I." Programmers judge old code a mess because it's harder to read code than to write it, and a rewrite throws away the bug fixes that years of production use put there. His cautionary case was Netscape's decision to rewrite its browser from scratch.

### Stories Without a Shared Agreement Make the System Incoherent

User stories are slices of an agreement, not the agreement itself. They capture deliverable increments but provide no holistic understanding of what you're building or what you built. When organizations treat user stories as the entire agreement rather than fragments of it, coherence collapses.

Teams implement individual stories without understanding how they relate. Related capabilities get built across separate stories with no unifying vision. Each works in isolation, but together they create conflicting mental models. Flows spanning many stories across multiple sprints become impossible to explain end-to-end because no document describes them end-to-end. Each story made sense locally, but globally the system is incoherent.

Eventually someone proposes a rebuild to "clean up the mess." But the mess wasn't created by technical limitations. It was created by treating slices as the whole, by never establishing the agreement that user stories were supposed to slice.

### Systems Drift When Nothing Retires Old Priorities

Systems drift from business needs when there's no mechanism to maintain alignment. Priorities change, but the system keeps implementing old priorities while never removing obsolete ones. New capabilities get added but old ones never get decommissioned. Integrations accumulate. Code paths multiply. Each addition made sense at the time, but no one maintains the whole.

Eventually the system does too much, costs too much, and serves unclear purposes. The rebuild proposal emerges naturally. "Let's start fresh with current priorities," someone suggests. But without changing the process that allowed the drift, the new system will accumulate the same cruft.

### Shifting Priorities Let Rebuilds Escape Accountability

When leadership constantly shifts priorities without acknowledging past commitments, teams can never succeed or fail definitively. Every problem becomes "we were working on the wrong thing" rather than "we failed to deliver what we committed to." Rebuilds fit perfectly into this pattern because they're the ultimate moving target. By the time the rebuild completes, requirements have shifted again, and the cycle continues.

When nobody holds outcomes steady, only visible events get noticed, so leadership tends to reward visible heroics over invisible prevention. Nelson Repenning and John Sterman describe the same trap in process improvement, in a paper titled for it: "Nobody Ever Gets Credit for Fixing Problems that Never Happened." They studied firefighting in operations. Rebuilds fall into the same trap, because a rebuild is visible and the maintenance that would have prevented it is not.

The engineers who prevented the fire through good design, monitoring, and operational discipline get ignored. The engineers who led the visible rebuild get celebrated. This teaches the organization that creating problems and fixing them dramatically is more valuable than preventing problems quietly. Rebuilds become performative rather than necessary.

Breaking this trap around rebuilds takes both sides. Good developers and architects can identify these problems and push for accountability, but without leadership commitment their efforts fail. Leadership must ask hard questions when rebuilds are proposed, acknowledge failures when commitments aren't met, and maintain clarity on what matters. Technical teams must articulate problems clearly while leadership creates an environment where solving the right problem matters more than creating the appearance of progress.

The hidden cost is eroded organizational trust. When rebuilds fail to deliver on commitments but get celebrated anyway, teams learn that outcomes don't matter. This can produce learned helplessness, where engineers stop fighting for quality because leadership doesn't appear to care.

### The Rebuild Adds Costs of Its Own

Escaping these failures through a rebuild also adds costs the old system never had. The old system still needs maintenance during migration, while the new system accumulates debt rapidly because you're learning as you build. You end up maintaining two systems at once, and when the rebuild wasn't justified, neither gets the investment in understanding that would have improved the old one. New systems have immature operational practices, rushed migrations skip security reviews, and unfamiliar platforms lead to misconfigurations.

The largest cost is opportunity. The months or years spent on a misguided rebuild could have been spent delivering actual business value. You're not just wasting the rebuild time. You're wasting all the value you could have created instead.

Without addressing these root causes, the new system tends to develop the same problems. The organization learns that rebuilds are how you "fix" things, entrenching a cycle of waste.

## When Rebuilds Are Justified

Rebuilds aren't always wrong, and some situations demand them. When your runtime or infrastructure reaches end-of-support and security patches stop flowing, you must migrate. Staying on unsupported platforms creates unacceptable risk.

When the system's core architecture cannot support required characteristics, incremental refactoring may cost more than rebuilding. Every rebuild proposal claims this, so test it: state the target for the characteristic, then run a time-boxed spike on the existing system. If the spike can't reach the target, the limit is architectural. Some architectural shifts are fundamental enough that preserving the old system while transforming it creates more complexity than starting fresh.

New regulations sometimes demand capabilities the current system cannot provide. Compliance requirements may force architectural changes that touch every layer. When merging systems from acquired companies, rebuilding to a common platform may be necessary for operational efficiency and reducing long-term maintenance burden.

The difference between justified and unjustified rebuilds is honest assessment. Justified rebuilds have clear, measurable forcing functions. Unjustified rebuilds have vague dissatisfaction and organizational dysfunction masked as technical problems.

## The AAA Discipline: How to Know If You Need a Rebuild

The AAA Cycle (Align, Agree, Apply) is a decision cycle that guards against rebuild disasters by forcing honest assessment before action.

### Align: Understand Before You Prescribe

Before proposing a rebuild, align on reality. What actually provides value? Which features drive business outcomes versus exist because no one removed them? Why was the current architecture chosen? What problems was it designed to solve? What constraints existed? Which tradeoffs were intentional? Read the ADRs if they exist. Interview people who built the system.

Most importantly, determine whether the problem is technical or organizational. Are costs high because of the technology, or because no one is accountable for managing costs? Is the system slow because of architectural limitations, or because of fixable inefficiencies? Many problems that look technical turn out to be process failures.

### Agree: Get Real Commitment, Not Permission

Once you understand reality, agree on what actually matters. State the actual problem, not the symptom. "The platform is expensive" is a symptom, while "We have no operational accountability for cost management" is the problem. Define measurable success criteria with explicit tradeoffs that acknowledge what you're willing to sacrifice and what you're not.

Evaluate alternatives. What could you do besides rebuild? What would those approaches cost? Acknowledge actual constraints: time, budget, team capacity, acceptable risk. Rebuilds hide behind "strategic investment" language to avoid honest resource conversations.

Assign specific ownership. Not "the team" but specific people accountable for specific metrics. If costs don't decrease, who failed? Without genuine agreement, rebuilds become exercises in diffused responsibility where no one can be held accountable.

Agreement also answers a harder case: the organization where only a rebuild can win the budget and attention that realignment needs. There the rebuild may be the only available path. But the organization then pays a rebuild's price for realignment work, and the dysfunction that refused to fund the quiet fix stays in place to cause the same drift again. Stating the actual problem instead of the symptom is what makes realignment fundable on its own terms.

### Apply: Execute with Integrity or Stop

The Apply phase tests whether the agreement was genuine. Implement what you agreed to. If cost reduction was the priority, instrument cost tracking first. Track against the agreement continuously. When metrics diverge from commitments, pause and realign. Don't celebrate "completed migration" when you violated core commitments.

Recognize when agreements were wrong. If the rebuild isn't solving the actual problem, stop. Stopping is cheapest when the rebuild replaces the old system one slice at a time, so each slice is measured against the agreement before the next begins. "We committed to this" isn't a valid reason to continue when reality invalidates the premise.

Stopping a failed rebuild is success, not failure. Update ADRs and share learnings so the organization doesn't repeat the mistake.

The Apply phase makes accountability real. When rebuilds fail to deliver on commitments, AAA makes that failure visible instead of letting it hide behind "strategic transformation" language.

## Realign Before You Rebuild

Rebuilds can solve the wrong problem. When they succeed, it is often not because of new technology, but because they force teams to understand what they're building, align with business value, and apply best practices. Much of that work could have happened without the rebuild, and the four checks show how much.

Before approving a rebuild, answer the AAA Cycle's questions:
- **Align**: Have you traced the problem to the technology rather than to missing accountability or fixable inefficiencies, and run the four checks against the current system?
- **Agree**: Can you state the forcing function, such as end of support, a required characteristic the architecture can't meet, a regulation, or a consolidation, and who owns the success metric?
- **Apply**: What measured result would make you stop the rebuild partway?

Fix the organization, and the technical problems that remain are the ones a rebuild should solve. Rebuild without fixing the organization, and you'll be proposing another rebuild in a few years.

<blockquote class="pull-quote">
<p>Before rebuilding, understand why you're considering it and be willing to be accountable for the outcome.</p>
</blockquote>
