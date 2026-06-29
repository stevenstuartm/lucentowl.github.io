---
layout: post
title: "Shaped Kanban: Complete Features, Not Sprints"
date: 2025-11-17
description: "Sprints organize around time intervals. Shaped Kanban organizes around completing features with clear boundaries and circuit breakers to bound risk. Work flows at its natural pace within disciplined constraints."
tags: [agile, kanban, shapeup, aaa-cycle, sdlc]
---

As an architect, a core part of my job is assessing viability and risk before committing a team to building something. That means understanding the problem deeply, testing critical assumptions early, and knowing when to change course. Sprint-based development fights me on every one of these. Planning ceremonies reward estimation speed over depth, sprint commitments pressure teams forward regardless of what they discover, and customer needs get filtered through velocity charts that measure team activity rather than delivered value.

## The Timebox Problem

**Interval-based development organizes work around fixed time periods, not around completing features.** When timeboxes become the primary organizing principle, they corrupt even well-aligned teams.

The intention is sound: prevent endless work, create rhythm, establish accountability. Yet timeboxes attempt to enforce through calendar boundaries what discipline should provide naturally.

### The Calendar Fills Itself

When discovery changes understanding mid-interval, teams are forced to ship incomplete work or carry it over. When planned work gets blocked, teams feel pressure to fill the remaining days with whatever fits: not the most valuable work, not what should naturally come next, just work that squeezes into the artificial deadline. **The timebox itself becomes the constraint that dictates what work happens, not the actual priorities or readiness.**

<blockquote class="pull-quote">
<p>The timebox created the problem it was meant to solve.</p>
</blockquote>

### Different Teams, Forced Cadence

Different team types operate on different natural cadences. Feature teams might deliver every few days while platform teams deliver every few months, yet organizations force synchronization through universal sprint cadences. Timeboxes also conflate three concerns that should be independent: development cycles, deployment cycles, and feedback cycles. Each operates at its own natural frequency; sprints force artificial alignment across all three, stretching fast work to fill the interval and fragmenting slow work across multiple cycles.

### Ceremony Fuels Continuation Bias

Scrum's ceremony structure fails this most visibly. Sprint Planning commits you to work. Daily Standups report progress. Sprint Review demonstrates what was built. The Retrospective redirects for next time. None of these answer the question that matters mid-sprint: should we stop this work two days in because the assumptions were wrong? Most teams don't. They obfuscate and proceed because abandoning the sprint goal feels like failure, and the real failure gets deferred. A team that won't fail a design two days into a sprint won't throw away three sprints of committed work either. The sunk cost grows with every sprint boundary crossed.

<blockquote class="pull-quote">
<p>The redirect you needed was to fail early, not plan differently next time.</p>
</blockquote>

"We can't remove sprints; how would we know when things are done?" That question reveals the dysfunction. If you don't know when work is done without a calendar, you never developed genuine agreement on what "done" means.

<blockquote class="pull-quote">
<p>When alignment exists, delivery cycles follow naturally. When alignment doesn't exist, timeboxes just create the illusion of progress.</p>
</blockquote>

## A Solution: Shaped Kanban

What if you could have discipline without timeboxes?

**Shaped Kanban combines rigorous upfront work definition with continuous flow.** It takes the best ideas from Shape Up (shaping work before betting on it, using circuit breakers to bound risk) and applies them to Kanban's continuous flow model. Unlike Shape Up's fixed 6-week cycles, each piece of work has its own natural timeline within appropriate bounds.

Shaped Kanban replaces timebox mechanics with genuine discipline:
- **Shape work before committing** - Define clear boundaries, identify risks, clarify what "done" looks like
- **Bet flexibly** - Commit resources on a business cadence (quarterly, monthly) or on-demand as priorities shift
- **Use feature-specific circuit breakers** - Each feature gets appropriate time bounds (3 days, 2 weeks, 6 weeks) based on complexity, not universal sprint durations
- **Flow continuously** - Work moves through the system when ready, not when the calendar says so

This allows different team types (feature teams, platform teams, shared services) to operate at their natural cadences without artificial synchronization pressure. Coordination happens explicitly through dependencies, not through forced sprint alignment.

## How Shaped Kanban Works

### 1. Shaping

Before work begins, senior people shape the problem and solution space. Not detailed specifications, but boundaries.

Appetite defines how much time this problem deserves, not how long it will take. Instead of estimating bottom-up ("this will take 6 weeks"), you set a top-down constraint: "this is worth 2 weeks, not more." The appetite becomes a creative constraint that forces the question: what can we solve within this time bound? If you cannot shape a viable solution within the appetite, the problem either needs a bigger appetite or should not be worked on yet.

Shaping answers these questions:
- What problem are we solving, and what is the appetite?
- What are we explicitly not doing?
- What does good enough look like within the appetite?
- What assumptions are we making that, if wrong, would make this unviable?

Shaping happens when needed, not on a fixed schedule. Work entering the system has clear boundaries, identified assumptions, and defined appetites instead of vague user stories.

### 2. Betting

Leadership commits resources to shaped work on a business cycle (quarterly, monthly) or on-demand as priorities shift.

Bets are on shaped work with understood scope, not vague user stories and story point estimates.

The system maintains a hard separation between two artifacts. The Idea Archive is a PM-managed library of potential pitches sitting outside the development workflow. The Dev Backlog contains only accepted bets, each with a defined appetite and documented assumptions. Work moves from the archive to the backlog only when leadership places a formal bet, keeping the development queue clean.

Unlike Shape Up's fixed 6-week cycles, shaping can happen more frequently as business needs emerge. Priorities can change before developers pull the work, capturing the benefit of short planning cadences while preserving context about which assumptions need testing.

### 3. Circuit Breakers

Each feature has built-in boundaries, both temporal and assumption-based.

Temporal boundaries are feature-specific time limits: a simple CRUD screen might have a 3-day limit, a complex workflow with integrations might have a 6-week limit, and a research spike might have a 2-week limit.

Assumption boundaries trigger when testing reveals the work is unviable. Critical assumptions defined during shaping get tested during implementation. If testing proves an assumption wrong and requires massive realignment, the circuit breaker trips and the work moves to Failed status for potential reshaping or Dropped status if unworkable.

When either boundary is hit, you stop and reassess: adjust scope, extend with stakeholder agreement, reshape based on what you learned, or drop the work. Per-feature boundaries make failure localized; one feature can trip its circuit breaker while others continue flowing. In a uniform sprint, stopping mid-cycle puts the whole team's commitment in question, creating social pressure to keep going regardless of what you've learned.

### 4. Kanban Flow

Work flows continuously. When capacity opens, pull the next shaped and bet-on feature. The first order of business is testing critical assumptions identified during shaping, not building features, because the earliest moment to catch a wrong assumption is when a ticket is pulled. Then build until done or the circuit breaker trips.

Work items progress through clear states: Unshaped → Shaped → Accepted → Active → Completed, Failed, or Dropped. Progress tracking uses hill charts from Shape Up: work is either uphill (still figuring it out) or downhill (executing on known work). This avoids the useless "80% done" claims that plague sprint burndowns.

WIP limits and circuit breakers work together: WIP limits constrain how many features run simultaneously while circuit breakers bound how long any individual feature can run.

<blockquote class="pull-quote">
<p>"Done" means the feature delivers the agreed value, period. Not "the sprint ended so we call it done."</p>
</blockquote>

### 5. Technical Debt Without a Cooldown

Shape Up's cooldown sprint handles work like technical debt and exploratory spikes that don't fit a formal pitch. Shaped Kanban removes fixed cycles entirely, which creates a real gap if left unaddressed.

The answer is to reframe technical work so it can compete at the betting table. Every meaningful technical work item falls into one of three categories:

- **Corrections**: mistakes actively hurting the business now, including security vulnerabilities, bugs driving churn, and reliability failures violating SLAs. These are risk mitigation bets, not engineering housekeeping.
- **Optimizations**: improvements that translate directly into margin or efficiency, like reducing cloud spend, speeding page loads, or automating deployments. With numbers attached, they compete well.
- **Re-Alignments**: work that unlocks future capabilities the roadmap depends on. Making the dependency explicit changes the conversation, since leadership is already implicitly betting on this work when they approve downstream features.

Technical debt framed as engineering work gets deprioritized. Framed as business risk, margin opportunity, or roadmap prerequisite, it gets bet on. This demands more rigor than Shape Up's cooldown, but architectural health becomes visible and competes on the same terms as every other bet.

## Shaped Kanban and the AAA Cycle

Shaped Kanban naturally supports the [AAA Cycle](/study-guides/sdlc/aaa-cycle.html){:target="_blank" rel="noopener noreferrer"} discipline: shaping ensures genuine alignment before committing to solutions, betting creates explicit agreement on specific outcomes with understood scope, and Kanban flow supports applying what was agreed without sprint boundaries forcing compromise. When discovery changes understanding mid-work, you can adjust scope, extend the circuit breaker with stakeholder agreement, or stop and reshape. The feature commitment creates accountability to an outcome, not a calendar.

## What About Multi-Team Coordination?

**Multi-team coordination is hard. Shaped Kanban doesn't pretend otherwise.** Scale deserves an honest answer.

Shape Up emerged from small-to-medium consulting work, refined project by project. My own experience with Shaped Kanban at scale sits in that same range: three medium-sized teams working on the same broad system. I have also worked in organizations running Scaled Scrum. That is enough to project how the two approaches compare as teams multiply, though I won't claim confidence about enterprise-level deployments I haven't run.

The most significant dynamic at scale is continuation bias. Scrum's greatest weakness gets worse as teams multiply because you cannot fix the collective without first empowering the individual. Scrum operates on collective abstractions: sprint commitments, velocity charts, planning poker. None of these give individual contributors the tools to recognize when work should stop. Shaped Kanban's core mechanisms (appetites and circuit breakers) work at the individual level. That is exactly the right lever when you need to prevent bad assumptions from propagating across a multi-team program.

Cross-team coordination in Scaled Scrum typically flows through the Scrum of Scrums meeting. But Scrum of Scrums is just another timeboxed event: it begins, it ends, and everyone returns to their sprint. It doesn't build an ongoing, async coordination discipline that is informed and purpose-driven. In Shaped Kanban, dependencies are explicit from the shaping stage. Each team understands how their work connects to the broader program and why, which makes async coordination practical because the context is already documented rather than locked inside a recurring meeting.

Scrum's rigidity also produces a predictable breakdown at scale: a small number of individuals, usually dev leads or architects, silently absorb all the cross-team coordination the process doesn't account for. They become the informal connective tissue holding the program together while everyone else follows the sprint. Shaped Kanban makes that coordination explicit from the start rather than hiding it inside ceremonies that can't actually handle it.

The genuine challenge is visibility. Shaped Kanban at scale requires roadmaps that are explicit about dependencies between epics and features; you cannot hide behind sprint abstractions and hope the pieces fit together. That rigor is demanding, but it also creates the conditions for async, purpose-driven coordination instead of forced synchronization at sprint boundaries.

## How This Approach Can Fail

**Shaped Kanban can be abused just like Kanban can be abused.** The flexibility that makes it powerful also creates opportunities for dysfunction if discipline erodes.

<div class="callout callout--warning">
<p class="callout__title">How This Approach Can Fail</p>
<p><strong>WIP limits must actually limit work.</strong> If WIP limits become suggestions rather than constraints and teams allow constant disruptions and context switching, the framework collapses into chaos. Kanban without strict WIP limits is just a glorified to-do list.</p>
<p><strong>Priorities must be honored.</strong> Bet on work you know has high value, deliver the original priorities, and let the circuit breakers do their job. If every urgent request bypasses the queue or priorities shift weekly, you are practicing reactive chaos with a Kanban board.</p>
<p><strong>Circuit breakers must trip.</strong> When work hits its time boundary or invalidates critical assumptions, stop and reassess. Do not extend deadlines reflexively. If you never let circuit breakers trip, they are theater.</p>
<p><strong>Flexibility requires discipline.</strong> Without discipline, you have just removed the one forcing function that timeboxes provided while keeping all the dysfunction: poorly defined work, shifting priorities, and endless scope creep.</p>
</div>

Timeboxes enforce rhythm mechanically while Shaped Kanban requires you to enforce rhythm through actual alignment and genuine agreement. That is harder. The willingness to change comes first.

## When to Consider This Approach

If your organization struggles with timeboxes fragmenting work, teams forced into artificial synchronization, or discovery invalidating sprint commitments, Shaped Kanban might help.

Shaped Kanban requires these disciplines:
- Define work with clear boundaries before committing
- Start work with uncertainty, knowing you can stop and realign when assumptions break
- Commit to specific outcomes with understood scope
- Build until done or until constraints force reassessment
- Measure whether you delivered value, not just whether you shipped

Shaped Kanban provides structure for these disciplines without artificial time constraints. It is not a perfect solution. Continuous flow across teams demands more intentional coordination than synchronized sprints. But the tradeoff is between value and coordination complexity, and I will take that tradeoff every time because one is intentional and the other is shipping on hope.

Rhythm and tempo come from alignment and natural feature boundaries, not predetermined calendars. You cannot iterate toward value without agreement on what constitutes value. Shaped Kanban makes that agreement explicit, visible, and continuous, without requiring everyone to march to the same drumbeat.
