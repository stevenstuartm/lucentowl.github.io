---
title: "Should Hearthline Split Its Product?"
layout: exercise
category: "Architecture"
kind: architecture
world: hearthline
description: "Five teams, one codebase, and a CTO asking whether to split into services. Decide what's really slowing the teams down, and whether a new shape would fix it."
last_updated: 2026-09-30
tags: [practical, style-selection, modular-monolith, service-based-architecture, module-boundaries]
related_guides:
  - /study-guides/architecture/ArchitectureStyles.html
  - /study-guides/architecture/modular-monolith-architecture.html
  - /study-guides/architecture/service-based-architecture.html
  - /study-guides/architecture/distributed-computing.html
  - /study-guides/sdlc/cicd.html
figures:
  - hl-today
  - hl-why-changes-wait
  - hl-options
  - hl-jobs-seam
---

## The Situation

Hearthline builds and sells software for home-service contractors: a booking widget for their websites, a dispatch board for their offices, and a mobile app for their technicians. Five product teams work on it.

### How the Product Is Built

- **One application, released as one unit.** Every release carries every team's changes.
- **One shared data layer.** The code is organized in folders by team, but all of it reads and writes one database through one shared data layer, and queries across teams' areas are common.
- **A table nobody owns.** The Jobs table is written by four of the five teams: booking, dispatch, mobile sync, and invoicing.

{% include figure.html id="hl-today" %}

### How Code Ships

- **On Friday,** a release branch is cut. Pull requests run only unit tests before merge. The full end-to-end suite runs on the release branch.
- **On Monday,** the two QA engineers spend the day on a manual regression pass, because the automated tests don't cover the dispatch board's screens.
- **On Tuesday,** the release goes out.
- **When the release branch fails,** the whole weekly release is delayed until the fault is fixed.

Over the last year, 11 of 52 weekly releases were delayed this way. Five delays were flaky tests that passed on a rerun. Four were one team's change breaking another team's tests, three of them through Jobs. Two were database migrations that failed their rehearsal. A change takes about four working days from merge to production.

{% include figure.html id="hl-why-changes-wait" %}

### What Coupling Costs

- **One feature in four needs two or more teams,** and those features take about twice as long to reach production as single-team features.
- **Two thirds of them touch the Jobs table.**
- **Nobody knows where the extra time goes.** The team leads can't say how much is waiting for each other's weekly releases and how much is agreeing on the change itself.

### The Question

This quarter two features promised to large prospects slipped a release, one from a delayed release and one from waiting on another team's change. The CTO asks you: should Hearthline split the product into separately deployed services, so teams stop blocking each other?

The Platform team has proposed process changes, about 8 weeks of work, mostly for QA and Platform:

- **Automate the dispatch board's regression tests,** replacing the Monday manual pass.
- **Run the full test suite on every change before it merges.**
- **Set aside flaky tests** until they're fixed, so they can't block anyone.
- **Revert a breaking change** instead of delaying everyone's release.
- **Change the database schema in backward-compatible steps,** so a rollback always works.
- **Then deploy every day.**

### What Else You Know

- **Migrations have hurt before.** In March a migration renamed a column, the rollback put the old code back on the new schema, and booking was down for 34 minutes.
- **Giving Jobs an owner is estimated.** Making the dispatch team the only one that writes Jobs, with the other teams going through its interface, would take a quarter of that team's capacity for three months, plus a few weeks from each of the other three teams. It includes moving Jobs, the busiest table, into its own schema.
- **Nobody at Hearthline has run separately deployed services** with their own release cycles.
- **The CTO points out** that the largest competitor runs microservices.

## The Decision

Should Hearthline split its product into separately deployed services? If not, what should it do instead?

## The Options

**A. Don't split. Ship the process changes, then measure.** Approve the proposal now. After two months of daily deploys, measure how long multi-team features take and where cross-team failures come from, and decide on the Jobs table with that evidence.

**B. Don't split. Ship the process changes and give Jobs an owner now.** Everything in A, plus a boundary around the Jobs table, started now. The dispatch module becomes the only one that writes Jobs, in its own schema, and every other module goes through its interface.

**C. Split, starting at the edge.** Extract Integrations (accounting sync and partner APIs) as the first separately deployed service, because it's the least tied to Jobs, then extract the other areas one at a time. The services keep sharing the database at first.

{% include figure.html id="hl-options" %}

## Your Turn

Decide before you read the analysis. Write down three things:

1. The option you'd choose.
2. The fact from the situation that decided it. If another fact would have decided it the other way, name that one too.
3. The main risk you're accepting by choosing it.

<details class="exercise-analysis" markdown="1">
<summary>Show the analysis</summary>

## What Each Option Buys and Costs Here

| Option | Buys | Costs, in this situation |
| --- | --- | --- |
| **A. Process changes, then measure** | Removes most of the four days: the wait for Friday and the Monday QA day. A change that breaks another team's test fails its author's pull request instead of delaying the release. Clean evidence about coupling within two months | About 8 weeks of work. Multi-team features keep taking twice as long while it measures |
| **B. Process changes, and Jobs gets an owner now** | Everything in A, plus fewer cross-team breaks at the table behind most multi-team features | A quarter of the dispatch team for three months while two prospects wait. Moving the busiest table into a new schema before the team has practiced backward-compatible changes. Releases stay shared, since every module still ships together |
| **C. Split, starting with Integrations** | A first service with its own release cycle, and practice running one | Doesn't touch Jobs, where most of the coupling is. The other teams keep their waits unless A happens too. With the database still shared, a break between teams shows up at runtime instead of in a test. Schema changes must now suit two services released on different days |

## The Recommendation: A, Under These Constraints

Don't split, and don't start the boundary yet. Ship the process changes, measure for two months, and decide on the Jobs table with that evidence. Four facts from the situation decide it.

### Most of the Waiting Isn't About Shape

A change spends about two working days waiting for Friday and two more on the QA day and the Tuesday release. Delays add a fraction of a day. None of that comes from the code being one release unit. It comes from releasing in a weekly batch behind a manual pass. A split doesn't remove the batch or the QA day. The process changes do.

### The Delays Come From How Tests Run

Five of the eleven delays were flaky tests, and two were migrations. The four cross-team breaks delayed releases because the full suite runs only after merge. Once it runs before every merge, a change that breaks another team's test fails its own author's pull request, and nobody else waits.

### The Evidence for the Boundary Isn't Clean Yet

One feature in four needs several teams and takes twice as long, and two thirds of those touch Jobs. But all of them were measured while every team waited on a weekly release, and one of this quarter's slipped features was waiting on another team's change. Nobody can yet say how much of the extra time is waiting. Daily deploys remove most of it, and two months later the same measurement shows what's left, before the boundary would have been finished anyway.

### The Boundary Is Safer After the Process Changes

Giving Jobs an owner means moving the busiest table into a new schema. That is exactly the kind of change that broke a rollback in March. A teaches the team to change a schema in backward-compatible steps first, so the boundary, if the evidence calls for it, starts on safer ground. Meanwhile the dispatch team stays on the features the prospects are waiting for.

### Splitting Moves the Coupling, It Doesn't Remove It

Option C answers the CTO's question as asked, but separate deployment helps teams that can't ship because they share a deployment. These teams wait on a weekly batch and a shared table, and a new service keeps both. With the database still shared, a break that fails a test today becomes a runtime failure between two services. Starting at the easiest edge is a sound way to learn to run a service, but it doesn't address the CTO's problem.

### What the Measurement Decides

After two months of daily deploys, compare multi-team features with single-team features again, and look at where changes that break another team's tests come from. If multi-team features still take much longer, and the breaks still cluster on Jobs, give Jobs an owner.

{% include figure.html id="hl-jobs-seam" %}

### The Risk You Accept

Multi-team features keep costing extra for two more months, and the measurement might confirm what B would have started today. That delay is the price of not spending a quarter of a team on a boundary the evidence may not need.

## What Would Change the Answer

Each rejected option wins under a different, realistic version of this situation.

| Option | It becomes the right choice if |
| --- | --- |
| **B. Jobs gets an owner now** | The team leads could already show, from ticket history, that multi-team features lose their extra time agreeing on changes to Jobs, not waiting for releases. Then the evidence is clean today, and waiting two months only delays a boundary that process changes can't replace |
| **C. Split, starting with Integrations** | A large partner required sign-off and 90 days' notice before any change to the code serving its integration, while the rest of the product ships daily. Integrations would then need a release cycle of its own, which is what separate deployment provides |

## Common Traps

### Taking the CTO's Words as the Diagnosis

"Teams block each other's releases" sounds like the textbook reason to deploy separately. But here they wait on a weekly batch, a manual pass, and a shared table, and separate deployment removes none of them.

### Believing Services Stop Cross-Team Breakage

Separate services sharing one database still share the tables. The break that fails a test today would reach production as a failure between two services. Breakage stops when the data has one owner, whatever the shape.

### Following the Competitor

The largest competitor's choice reflects its own size, history, and constraints, not Hearthline's. A service per team, each with its own database, would need owned data, experience running services, and a need for independent releases all at once, and Hearthline has none of the three yet.

### Starting the Boundary Before Knowing the Cause

Jobs is the obvious suspect, but a measured problem isn't a measured cause. When the cheaper change produces the missing evidence within weeks, and the expensive one takes a quarter, do the cheap one first.

</details>
