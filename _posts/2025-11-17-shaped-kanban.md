---
layout: post
title: "Shaped Kanban: Complete Features, Not Sprints"
date: 2025-11-17
description: "Sprints organize around time intervals. Shaped Kanban organizes around completing features with clear boundaries and circuit breakers to bound risk. Work flows at its natural pace within disciplined constraints."
tags: [agile, kanban, shapeup, aaa-cycle, sdlc]
author: steven-stuart
sources:
  - title: "Shape Up: Stop Running in Circles and Ship Work that Matters (Ryan Singer, Basecamp)"
    url: "https://basecamp.com/shapeup"
  - title: "The Scrum Guide (Ken Schwaber and Jeff Sutherland, 2020)"
    url: "https://scrumguides.org/scrum-guide.html"
  - title: "Apply Cadence, Synchronize with Cross-Domain Planning (Scaled Agile Framework)"
    url: "https://scaledagileframework.com/apply-cadence-synchronize-with-cross-domain-planning/"
---

As an architect, a core part of my job is assessing viability and risk before committing a team to building something. That means understanding the problem deeply, testing critical assumptions early, and knowing when to change course. Sprint-based development fights me on every one of these. Planning ceremonies reward estimation speed over depth, sprint commitments pressure teams forward regardless of what they discover, and customer needs get filtered through velocity charts that measure team activity rather than delivered value.

## The Timebox Problem

**Interval-based development organizes work around fixed time periods, not around completing features.** When timeboxes become the primary organizing principle, they corrupt even well-aligned teams.

The intention is sound: prevent endless work, create rhythm, establish accountability. Yet timeboxes attempt to enforce through calendar boundaries what discipline should provide naturally.

### The Calendar Fills Itself

When discovery changes understanding mid-interval, teams are forced to ship incomplete work or carry it over. When planned work gets blocked, teams feel pressure to fill the remaining days with whatever fits: not the most valuable work, not what should naturally come next, just work that squeezes into the artificial deadline. In continuous flow, a free WIP slot takes the top-ranked item whatever its size, because nothing ends in four days. In a sprint, the days left tend to decide, so a high-value item that won't fit gets passed over for a smaller one or started and carried over. **The timebox itself becomes the constraint that dictates what work happens, not the actual priorities or readiness.**

<blockquote class="pull-quote">
<p>The timebox created the problem it was meant to solve.</p>
</blockquote>

### Different Teams, Forced Cadence

Different team types operate on different natural cadences. Feature teams might deliver every few days while platform teams deliver every few months, yet many organizations force synchronization through universal sprint cadences because cross-team planning needs shared boundaries. The Scaled Agile Framework makes this explicit, aligning every team's iteration start and end dates within a release train. Timeboxes also conflate three concerns that should be independent: development cycles, deployment cycles, and feedback cycles. Each operates at its own natural frequency. The Scrum Guide lets a team release an increment before the sprint ends, but planning still happens at the boundary, and the Sprint Review is where stakeholders inspect the work. The Guide says the review is never a release gate, yet in practice feedback tends to batch there. Sprints tend to pull all three into alignment anyway, stretching fast work to fill the interval and fragmenting slow work across multiple cycles.

### Ceremony Fuels Continuation Bias

Scrum's ceremony structure fails this most visibly. Sprint Planning commits you to work. Daily Standups report progress. Sprint Review demonstrates what was built. The Retrospective redirects for next time. The Scrum Guide does let the Daily Scrum adapt the sprint backlog, and it lets the Product Owner cancel a sprint whose goal has become obsolete. But adapting the backlog serves the sprint goal, and cancellation is reserved for one role and treated as an exception, so no ceremony routinely asks the question that matters mid-sprint: should we stop this work two days in because the assumptions were wrong? Many teams don't ask it. They obfuscate and proceed because abandoning the sprint goal feels like failure, and the real failure gets deferred. A team that won't fail a design two days into a sprint is unlikely to throw away three sprints of committed work either. The sunk cost grows with every sprint, and each Sprint Planning recommits the team to it in front of stakeholders.

<blockquote class="pull-quote">
<p>The redirect you needed was to fail early, not plan differently next time.</p>
</blockquote>

"We can't remove sprints; how would we know when things are done?" That question reveals the dysfunction. Scrum's own Definition of Done is meant to answer it without reference to the calendar. If a team still can't tell when work is done without one, it has a definition on paper but never developed genuine agreement on what "done" means. Stakeholders who want the forecast a sprint gave them get it from the bet instead: the appetite states what a feature is worth, and the appetites queued ahead of it, against the WIP limit, give a start date that holds unless an earlier bet is extended or reshaped.

<blockquote class="pull-quote">
<p>When alignment exists, delivery cycles follow naturally. When alignment doesn't exist, timeboxes just create the illusion of progress.</p>
</blockquote>

## Shaped Kanban: Discipline Without Shared Timeboxes

What if you could have discipline without a shared timebox organizing everyone's work?

**Shaped Kanban combines rigorous upfront work definition with continuous flow.** It takes the best ideas from Shape Up (shaping work before betting on it, using circuit breakers to bound risk) and applies them to Kanban's continuous flow model. Unlike Shape Up's fixed 6-week cycles, each piece of work has its own natural timeline within appropriate bounds.

Shaped Kanban replaces team-wide timebox mechanics with genuine discipline:
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
- Which other teams' work depends on this, and what does this depend on?

Shaping happens when needed, not on a fixed schedule. Work entering the system has clear boundaries, identified assumptions, and defined appetites instead of vague user stories.

### 2. Betting

Leadership commits resources to shaped work on a business cycle (quarterly, monthly) or on-demand as priorities shift.

The system maintains a hard separation between two artifacts. The Idea Archive is a PM-managed library of potential pitches sitting outside the development workflow. The Dev Backlog contains only accepted bets, each with a defined appetite and documented assumptions. Work moves from the archive to the backlog only when leadership places a formal bet, keeping the development queue clean.

Shaping and betting can happen as often as business needs emerge. Priorities can change before developers pull the work, capturing the benefit of short planning cadences while preserving context about which assumptions need testing.

### 3. Circuit Breakers

Each feature has built-in boundaries, both temporal and assumption-based.

Temporal boundaries are feature-specific time limits: a simple CRUD screen might have a 3-day limit, a complex workflow with integrations might have a 6-week limit, and a research spike might have a 2-week limit.

Assumption boundaries trigger when testing reveals the work is unviable. Critical assumptions defined during shaping get tested during implementation. If testing proves an assumption wrong and requires massive realignment, the circuit breaker trips and the work moves to Failed status for potential reshaping or Dropped status if unworkable.

A temporal boundary is still a time limit, but it differs from a sprint in what it controls. It belongs to one feature and is sized by that feature's appetite, and it exists to force a reassessment, not to decide what work happens. When it trips, there are no leftover days to fill, because the next shaped item is pulled when capacity opens.

When either boundary is hit, anyone building the feature can declare the trip, and work stops at once. The people who placed the bet then decide what happens next: adjust scope, extend, reshape based on what you learned, or drop the work. Stopping never waits for a decision. Only restarting does. An extension is a new bet with a new appetite that competes with the rest of the queue, and it shows on the board, so a quiet slip becomes a visible decision. Per-feature boundaries make failure localized. One feature can trip its circuit breaker while others continue flowing. In a uniform sprint, stopping mid-cycle puts the whole team's commitment in question, creating social pressure to keep going regardless of what you've learned. Here the stop condition was written down before work began, so stopping carries out the plan rather than abandoning it. The appetite said what the problem was worth, not that the team would finish within it, so tripping the breaker is a smaller admission than abandoning a sprint goal. It still takes someone willing to declare it, which is why the failure section below treats tripping as a discipline.

### 4. Kanban Flow

Work flows continuously. When capacity opens, pull the next shaped and bet-on feature. The first order of business is testing critical assumptions identified during shaping, not building features, because the earliest moment to catch a wrong assumption is when a ticket is pulled. Then build until done or the circuit breaker trips.

Work items progress through clear states: Unshaped → Shaped → Accepted → Active → Completed, Failed, or Dropped. Progress tracking uses hill charts from Shape Up. Work is either uphill (still figuring it out) or downhill (executing on known work). This avoids the useless "80% done" claims that plague sprint burndowns.

WIP limits and circuit breakers work together: WIP limits constrain how many features run simultaneously while circuit breakers bound how long any individual feature can run.

<blockquote class="pull-quote">
<p>"Done" means the feature delivers the agreed value, period. Not "the sprint ended so we call it done."</p>
</blockquote>

### 5. Technical Debt Without a Cooldown

Shape Up's two-week cool-down between cycles handles work like technical debt and exploratory spikes that don't fit a formal pitch. Shaped Kanban removes fixed cycles entirely, which creates a real gap if left unaddressed.

Small items too minor to pitch, like a dependency bump or a half-day refactor, travel with the active feature that touches that code, inside its appetite, so shaping leaves room for them in scope. For anything larger, the answer is to reframe technical work so it can compete at the betting table. Every meaningful technical work item falls into one of three categories:

- **Corrections**: mistakes actively hurting the business now, including security vulnerabilities, bugs driving churn, and reliability failures violating SLAs. These are risk mitigation bets, not engineering housekeeping.
- **Optimizations**: improvements that translate directly into margin or efficiency, like reducing cloud spend, speeding page loads, or automating deployments. With numbers attached, they compete well.
- **Re-Alignments**: work that unlocks future capabilities the roadmap depends on. Making the dependency explicit changes the conversation, since leadership is already implicitly betting on this work when they approve downstream features.

Technical debt framed as engineering work gets deprioritized. Framed as business risk, margin opportunity, or roadmap prerequisite, it can win bets. This demands more rigor than Shape Up's cool-down, but architectural health becomes visible and competes on the same terms as every other bet.

## Multi-Team Coordination Through Explicit Dependencies

**Multi-team coordination is hard. Shaped Kanban doesn't pretend otherwise.** Scale deserves an honest answer.

Shape Up emerged from Basecamp's own product development, refined over years as the company grew from four people to about fifty. My own experience with Shaped Kanban at scale sits in that same range: three medium-sized teams working on the same broad system. I have also worked in organizations running Scaled Scrum. That is enough to project how the two approaches compare as teams multiply, though I won't claim confidence about enterprise-level deployments I haven't run.

The most significant dynamic at scale is continuation bias. I expect Scrum's greatest weakness to get worse as teams multiply because you cannot fix the collective without first empowering the individual. Scrum as commonly run operates on collective abstractions: sprint commitments, plus the velocity charts and planning poker that usually come with them, though the Scrum Guide prescribes neither. None of these give individual contributors the tools to recognize when work should stop. Shaped Kanban's core mechanisms work at the level of the individual feature. Its appetite and documented assumptions give the people building it an explicit, pre-agreed trigger to stop, without waiting for a team-wide ceremony or a collective decision. Leadership decides what happens after the stop, not whether it happens. That is the lever I would reach for to prevent bad assumptions from propagating across a multi-team program.

Cross-team coordination in Scaled Scrum typically flows through the Scrum of Scrums meeting. But Scrum of Scrums is just another timeboxed event: it begins, it ends, and everyone returns to their sprint. It doesn't build an ongoing, async coordination discipline that is informed and purpose-driven. Scrum teams can write dependencies down too, but nothing in the sprint process requires it. In Shaped Kanban, dependencies are explicit from the shaping stage, so when one team's circuit breaker trips, the shaped work already lists the downstream bets that depend on it, and those teams hear at once rather than at the next sync meeting. Each team understands how their work connects to the broader program and why, which makes async coordination practical because the context is already documented rather than locked inside a recurring meeting.

Scrum's rigidity also tends to produce a common breakdown at scale: a small number of individuals, usually dev leads or architects, silently absorb all the cross-team coordination the process doesn't account for. They become the informal connective tissue holding the program together while everyone else follows the sprint. Shaped Kanban doesn't remove that load, since senior people still shape the work. It moves the load into shaping, where dependencies are written into the shaped work and visible to every team, rather than held in a few people's heads and hidden inside ceremonies that can't actually handle it.

The genuine challenge is visibility. Shaped Kanban at scale requires roadmaps that are explicit about dependencies between epics and features. You cannot hide behind sprint abstractions and hope the pieces fit together.

## How This Approach Can Fail

**Shaped Kanban can be abused just like Kanban can be abused.** The flexibility that makes it powerful also creates opportunities for dysfunction if discipline erodes.

<div class="callout callout--warning">
<p class="callout__title">How This Approach Can Fail</p>
<p><strong>WIP limits must actually limit work.</strong> If WIP limits become suggestions rather than constraints and teams allow constant disruptions and context switching, the framework collapses into chaos. Kanban without strict WIP limits is just a glorified to-do list.</p>
<p><strong>Priorities must be honored.</strong> Bet on work you know has high value, deliver the original priorities, and let the circuit breakers do their job. If every urgent request bypasses the queue or priorities shift weekly, you are practicing reactive chaos with a Kanban board.</p>
<p><strong>Circuit breakers must trip.</strong> When work hits its time boundary or invalidates critical assumptions, stop and reassess. Do not extend deadlines reflexively. If you never let circuit breakers trip, they are theater.</p>
<p><strong>Flexibility requires discipline.</strong> Without discipline, you have just removed the one forcing function that timeboxes provided while keeping all the dysfunction: poorly defined work, shifting priorities, and endless scope creep.</p>
</div>

Timeboxes enforce rhythm mechanically while Shaped Kanban requires you to enforce rhythm through actual alignment and genuine agreement. That is harder. It also fails more visibly when work runs long, because continuing past an appetite takes a new bet rather than a quiet carryover. The willingness to change comes first.

## When to Consider This Approach

If your organization struggles with timeboxes fragmenting work, teams forced into artificial synchronization, or discovery invalidating sprint commitments, Shaped Kanban might help.

It is the wrong move for a team without senior people who can shape work, or under leadership that won't honor its bets. A shared sprint cadence supplies a forcing function those teams can't yet supply for themselves.

Shaped Kanban requires these disciplines:
- Define work with clear boundaries before committing
- Start work with uncertainty, knowing you can stop and realign when assumptions break
- Commit to specific outcomes with understood scope
- Build until done or until constraints force reassessment
- Measure whether you delivered value, not just whether you shipped

It is not a perfect solution. Continuous flow across teams demands more intentional coordination than synchronized sprints. But the tradeoff is explicit coordination work against synchronized sprints, and I will take that tradeoff every time because one makes dependencies intentional and the other leaves them to hope until the next boundary.

Rhythm and tempo come from alignment and natural feature boundaries, not predetermined calendars. You cannot iterate toward value without agreement on what constitutes value. Shaped Kanban makes that agreement explicit, visible, and continuous, without requiring everyone to march to the same drumbeat.
