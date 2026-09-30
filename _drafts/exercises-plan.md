# Exercises — Plan

A fifth content type: practical scenarios where the reader makes a decision the guides prepared them for, then compares their reasoning with a worked analysis. It covers architecture, code, delivery, security, data, and cloud: anything an existing guide teaches.

## Status

Paused on 2026-09-30 by the author: no exercise is in a learning path until one is solid. Both pilot attempts are kept as drafts: the Ridgeline claims draft in `_drafts/exercises/superseded/` and the Hearthline "split or not" draft in `_drafts/exercises/hearthline/`, each with its figures. The site infrastructure stays in place and inert: the collection, layout, checkpoint card, search tab, related pills, and checker rules. The world canon (`.claude/content/exercise-worlds.md`) keeps Ridgeline and Hearthline for later use.

## The gap

| Type | What the reader does | Evidence |
| --- | --- | --- |
| Study guides | Learns a topic | Sources |
| Resources | Looks something up | Sources |
| Case studies | Sees a real decision play out | First-hand outcome |
| Essays | Follows an argument | The argument |
| **Exercises** | **Practices a decision** | **None claimed. The reasoning is the product** |

Learning path checkpoints already ask the reader to practice (`try`), but only on their own work. A reader without a suitable system has nothing to practice on, and nobody shows them what good reasoning looks like on the problem. An exercise gives everyone the same problem and a worked analysis to check against.

## The founding rule: everything is a tradeoff

Quiz-style scenario sites mark one option as "best." That teaches answer-picking, and the "best" answer usually wins only because the scenario left out whatever would have made another option win. Exercises must teach the opposite:

1. **The answer is conditional.** The analysis recommends an option *under these constraints* and names the constraints that decided it.
2. **Every rejected option has a flip.** For each option not chosen, name one realistic change to the scenario that would make it the right choice. If no realistic change would make an option win, it's a straw man. Cut it.
3. **Fiction claims no outcomes.** An exercise never says what "happened" after the decision. Outcomes come only from case studies. When a case study shows the same decision meeting reality, the exercise links to it. That's how the two types balance each other.

## Scope: path-first, not a catalog

Exercises exist to reinforce learning paths. They are not a standalone collection to browse.

- **Every exercise is a step in at least one learning path.** `.pathcheck.py` fails on an exercise that no path references. An exercise without a path doesn't ship.
- **Published, not advertised.** Each exercise is a real page with its own URL, so it's in the sitemap and in site search (SEO and internal search still work). There's no listing page, main-menu entry, or home card at launch.
- **Discovery routes:** learning path steps (primary), site search, and "Practice this" links on the guides an exercise names.
- **When the set grows** to where someone would browse it (roughly 15–20), add a listing page and a menu entry under **Learning**, not Resources. Resources are things you look up and keep open. An exercise is done once, in order, as part of learning.

## What an exercise is

- **Only what the decision needs.** Every fact on the page is one the reader uses to decide, or a deliberate distractor that a trap then names. The world file can be rich; the page is not. Facts added to answer a reviewer's question belong in the canon unless the reader needs them too.
- **No undefined terms.** Don't lean on jargon the page never defines ("release train", "holds"). Say it plainly ("the weekly release was delayed").
- **Self-contained.** The page gives the reader everything the decision needs, and never points to other content as context or background. That includes a world's worked example: facts from canon are restated as the situation, not linked. Canon's internal labels (ADR numbers, assumption ids like A3) never appear. Say what the decision or rule is instead. Links to further reading live only in the header's related pills.
- **Practice, not teaching.** It introduces no concept a guide doesn't already teach. If solving it needs an explanation, that explanation belongs in a guide, and the gap goes on the guide backlog. This is the same rule as path checkpoints.
- **Grounded.** It declares at least one `related_guides` entry that teaches what it exercises.
- **Fictional and labeled.** The page says the company and scenario are fictional.
- **Original.** Other sites' scenarios are general inspiration only. A scenario, option set, or framing that traces to a single outside source fails [derivation-check.md](../.claude/content/derivation-check.md).

## Shape of an exercise

1. **The situation.** The company, the system or team, and what just happened. Give the constraints as facts: budget, team size and skills, deadline, load, compliance, existing stack. Include at least one constraint that turns out to be irrelevant, because real briefs have noise.
2. **The decision.** One question, stated plainly.
3. **The options.** Two to four, each a sentence or short sketch. Code exercises show code (C# by default). A figure can show the current system or the options side by side: `{% include figure.html id="<id>" %}`, following [figure-guide.md](../.claude/content/figure-guide.md). Exercises aren't resources or figures, but they can embed figures the way guides do.
4. **Your turn.** A prompt to decide before reading on, and what to write down: the choice, the deciding constraint, and the main risk.
5. **The analysis** (collapsed, see below):
   - What each option buys and what it costs, *in this scenario*.
   - The recommendation, and the constraints that decided it.
   - **What would change the answer**: one realistic flip per rejected option.
   - Common traps: the reasoning that sounds right and isn't.
The exercise ends with the analysis. Related guides, and any case study where the same decision met reality, appear only as the header's related pills, from `related_guides` and `related_case_studies`.

**Hiding the analysis.** The analysis sits in a native `<details>` element, closed by default. There's no script, no saved state, and nothing tracked, so it's consistent with the no-tracking rule. Search indexes the text. Printing a closed `<details>` hides its contents, which is acceptable for now.

**Visual aids.** Every exercise has figures, and more is better as long as each one answers its own question. Pick each figure's type and level of detail by the AAA rule: the right diagram, at the right precision, at the point in the reasoning where the reader needs it.

| Point in the exercise | Figure | Precision |
| --- | --- | --- |
| The situation, today | Context diagram (`context`) of how the work happens now: every actor, the component each uses, bought or built, and how they connect | Align level, but complete. No actor or connection the analysis relies on may be missing |
| The situation, to be built | Context diagram (`context`). The system under decision as one box, with open questions drawn dashed, like the Align sketch | Align level: boundaries, users, and neighbors. Internals stay undecided |
| Constraints with a shape | A chart (`chart`) when a number's shape decides something, like a burst, a trend, or a distribution | Only the numbers the decision turns on |
| The options | Options side by side, drawn at the level where they differ (`container` for deployment choices, `component` for code structure) | Agree level: nothing below the level the options differ on |
| The analysis | How the recommended option behaves in the case that tests it (`dynamic`, `state`, or `flow`) | Only the parts the test touches |

Code exercises follow the same rule. Show the code at the level the options differ on, and use a diagram only for structure the code doesn't make visible.

**Figure ownership.** An exercise lists its figures under `figures:` and embeds them inline, like a composite with `figures_inline: true`. `.figcheck.py` treats an exercise as a figure's owner. Exercise figures use the world's prefix plus a topic (`rlc-` for Ridgeline claims). The figure guide's rule still holds: guides never embed a fictional world's figures. Exercise figures live in `_figures/` like any other.

**Size.** Readable in 10–15 minutes. One decision per exercise. A scenario that needs several decisions becomes a numbered series (see Worlds below).

## Kinds

The same shape covers every domain. Examples of the decision each kind asks:

| Domain | Example decision |
| --- | --- |
| Architecture | Split the monolith's billing module now, or modularize in place first? |
| Code | Which of three refactorings of this method is right, given who maintains it next? (C#) |
| Code review | Which of these review comments matter, and which one blocks the merge? |
| Data | Add a read replica, a cache, or a projection for this reporting load? |
| Security | Where does this token get validated, and what does each placement expose? |
| Cloud | ECS on Fargate, Lambda, or EC2 for this workload and this team? |
| Delivery | Launch is in three weeks and a feature is at risk. Cut it, slip, or descope? |
| Leadership | Two seniors disagree about an approach in public. What do you do this week? |

## Worlds: recurring fictional companies

Constraints come from the organization, so a few recurring companies make exercises richer and cheaper to write. Readers learn a company's context once, and later exercises can build on earlier decisions.

- **Realism first.** A world is built in full before any exercise uses it: every actor, the system each one works in, bought or built, how systems connect, what products in each category typically can do (with a source), and the skeptic's questions with their answers. Decisions are found in the world. The rules are at the top of `.claude/content/exercise-worlds.md`.
- **Match the decision to the kind of company.** A regional insurer like Ridgeline mostly buys and configures, so its natural exercises are buy/configure/build, integration, and delivery decisions. Architecture-style exercises belong in a company that builds the software it sells.
- **Ridgeline Mutual** already exists ([AAA worked example](/resources/aaa-worked-example.html)): a regional P&C insurer on a bought core suite and SaaS CRM, with one small in-house team.
- **Planned:** a product company (for style decisions) and a large platform organization (for coordination and platform decisions).
- **Canon file.** `.claude/content/exercise-worlds.md`. Read it before writing, and update it after publishing.
- **Series.** Exercises in one company can be ordered (`series`, `series_order`) when a later decision depends on an earlier one. Each exercise still stands alone: it restates the constraints it needs.

## Front matter

```yaml
---
title: "Cut, Slip, or Descope"
layout: exercise
category: "SDLC"                 # exact top-level category from study_guides_config.json
kind: delivery                   # architecture | code | data | security | cloud | delivery | leadership
world: ridgeline                 # key in exercise-worlds.md; omit for a standalone scenario
series: ridgeline-portal         # optional
series_order: 3                  # optional
description: "..."               # the decision, in one sentence
last_updated: 2026-09-28
tags: [practical, scope-management, release-planning]   # exactly one skill level (fundamentals | practical | advanced), like guides
related_guides:                  # required, at least one
  - /study-guides/sdlc/aaa-phase3-apply.html
related_case_studies:            # optional: where this decision met reality
  - /case-studies/...
---
```

Permalink: `/exercises/<filename>.html`. **Never rename the file.**

## Site integration

| Piece | Change |
| --- | --- |
| `_config.yml` | `exercises` collection, `output: true`, permalink `/exercises/:path.html`, default layout |
| `_layouts/exercise.html` | New. Fictional label, situation, options, "your turn", `<details>` analysis, go deeper. Pagefind markup: `data-pagefind-body`, `data-pagefind-meta="title"`, `data-pagefind-filter="type:Exercise"`, and `data-pagefind-ignore` on the page chrome |
| `assets/js/site-search.js` | Add `Exercise` to the type tab list |
| `_includes/related-links.html` | Guide and case study pages show "Practice this" links to exercises that name them. This is the same one-declaration, two-directions rule resources use. The exercise owns the link, so writing one never edits a guide |
| Learning paths | **Done.** A checkpoint names one exercise (`checkpoint.exercise`), shown as its own card below the checkpoint, with its title, description, and time. A link inline in the checkpoint was tried first and was too easy to miss. Exercises are never steps, so they don't count toward the 40-step limit. `.pathcheck.py` resolves `/exercises/` URLs, rejects an exercise used as a step, and fails on an exercise no checkpoint names. Isolation holds: an exercise never mentions paths |
| Deferred until ~15–20 exercises | `_layouts/exercises.html` and `pages/exercises.md` (listing), a header nav entry under **Learning**, a home page card ("Five ways to learn") |
| `assets/data/whats_new.yml` | Entry at launch |
| `CLAUDE.md` | New "Exercise Format" section; add the content guide to the table |
| `.figcheck.py`, `figure-guide.md` | Accept an exercise's `figures:` list as ownership. Document exercise figures in the figure guide |
| `.claude/content/exercise-guide.md` | The content guide: this plan's rules, the qualification test, a quality checklist |

No config file for ordering. Paths give the order. When a listing arrives, it sorts by category, then world and series, like learning paths do.

## Qualification test

An exercise ships only if all of these hold:

1. **Grounded.** A guide teaches everything the exercise needs.
2. **Has a path.** A specific learning path stage needs it, and it goes in as a step after the guides it exercises.
3. **A real decision.** At least two options that competent people would pick in some realistic situation.
4. **Every flip is realistic.** Each rejected option has a named scenario change that makes it right.
5. **Constraints decide it.** The recommendation cites specific facts from the situation. If it would be the same with the situation deleted, the exercise tests general knowledge, not judgment. Cut it or rewrite it.
6. **Original.** It passes the derivation check.
7. **Consistent with its world's canon.**
8. **Survives a skeptic.** An independent reviewer reads the scenario as a practicing architect and lists every question it would ask before accepting the premise: what the existing products already do, whether a third party handles this, what each actor uses today. Any question the page doesn't answer blocks the exercise.
9. **Buy before build.** If the scenario builds something, the page says why buying or configuring an existing product isn't the answer, unless that is the decision being practiced.

## Rollout

1. **Pick the pilot stages.** Done, see Pilot selection.
2. **Pilot three exercises**, one at a time: build or extend the world first, agree the premise, draft, then run the skeptic review before calling it drafted. Review each pilot before starting the next, and adjust the shape between them. Use them to check the shape. Is the analysis worth hiding? Are the flips realistic? Does 10–15 minutes hold?
3. **Build the collection, layout, search, related-links wiring, and the `.pathcheck.py` changes.** Done early with pilot 1, to try the checkpoint integration. Pilots 2 and 3 are drafted straight into `_exercises/` and named in their checkpoints in the same pass.
4. **Write `exercise-guide.md` and `exercise-worlds.md`** from what the pilots taught, not ahead of them.
5. **Grow the set by path gaps.** Aim for one or two practice steps per path, stage by stage.
6. **Revisit the listing and menu entry** at roughly 15–20 exercises.

## Pilot selection

Surveyed 2026-09-28: all 24 stages across the five paths. A stage is a good exercise home when:

- **The `try` task fails for part of the path's stated audience.** The reader lacks the system, team, or authority it assumes.
- **The stage centers on a choice between competing options**, not a procedure.
- **Its guides already teach everything the choice needs.**
- **Nothing on the site already gives a worked scenario for it.**

### The three pilots

| # | Path · stage | Kind | Why it's the prudent pick |
| --- | --- | --- | --- |
| 1 | Developer to Architect · 3 *Choosing a shape* (Basics, exit) | Architecture | The path's audience is senior developers taking on design, most of whom have never chosen a system's style. The `try` only lets them argue about a style someone else picked. This is the most decision-shaped stage on the site, fully grounded (styles guides, modular monolith, distributed computing, and the style comparison resource), and it has a case study to link for the real-world side. It's the natural showcase for worlds: the same question gets different answers for the startup and for Ridgeline. |
| 2 | Developer to Architect · 6 *Proving the qualities* | Code (C#) | The reliability patterns guide has C# and names the trap exactly: retrying a non-idempotent call. An exercise gives three implementations of one remote call (retry everything, no retry, retry with an idempotency key or a safe-method rule) and asks which one ships. It needs a different operation from the guide's card-charge example, for instance filing a claim with a Ridgeline vendor API, so it practices the idea rather than repeating the guide. The same guide is in Leading a Development Team stage 4, so the exercise can serve both paths. |
| 3 | Leading a Development Team · 5 *Leading the team* | Leadership | The audience is leads "new or about to be". An about-to-be lead has no team, so the `try` (take a debt case to whoever sets priorities) can't be done. The leadership foundations guide's *When Things Go Wrong* section (missed commitments, team conflict) grounds a decision such as a commitment at risk with the team divided on the fix. Nothing on the site practices this. |

Pilot 3 replaces the originally planned AAA delivery exercise. That stage (Developer to Architect · 8) is already served by the [AAA worked example](/resources/aaa-worked-example.html) and the [AAA scenarios guide](/study-guides/sdlc/aaa-scenarios.html). The pilots cover a structural decision, a code decision, and a people decision, which tests whether one shape fits all three.

### Next batch (strong candidates)

| Path · stage | Decision |
| --- | --- |
| Designing on AWS · 3 *Data* | RDS or DynamoDB for a stated set of access patterns, and the key design if DynamoDB. The `try` assumes a workload the reader may not have. |
| Designing on AWS · 2 *Identity, network, compute, storage* | ECS on Fargate, Lambda, or EC2 for a given workload and team. |
| Running AWS at Scale · 1 *The ideas every environment runs on* | Which DR strategy meets an RTO and RPO within a budget, and what the release strategy has to change. |
| Developer to Architect · 4 *Connecting the parts* | Synchronous call, queue, or event for one integration, and where a reporting load that hits production data should move. |
| Developer to Architect · 2 *Finding the boundaries* | Three ways to cut the same system (by table, by journey, by team). Which cut, and why. |

### Low value for now

- **Coding with AI Agents, all stages.** Every `try` works on the reader's own daily assistant use. Nobody lacks the material.
- **Developer to Architect · 8.** Already served, as above.
- **Running AWS at Scale · 2.** A procedure (rebuild with CDK), not a decision.
- **Developer to Architect · 1 and 5.** Their `try` tasks (name characteristics, write an ADR for a past decision) work on any system the reader has worked on.

## Pilot notes

What each pilot taught about the shape, to feed `exercise-guide.md`.

### Pilot 1: ridgeline-claims-shape

- **An option that needs several facts to change before it wins belongs in Common Traps, not in the options.** Full microservices would need more teams, operational maturity, and sustained load all at once, so it appears as the CIO's question and a trap. "Split out intake" stood in for the distributed option, because one realistic change (a stricter availability target for intake) makes it win. This refines qualification test 4: the flip is one realistic situation, and it usually turns on a single fact.
- **Canon did work.** ADR-001 from the AAA worked example ruled out option A. A past decision constraining a new one is the payoff of recurring worlds.
- **The irrelevant constraint needs its own trap entry.** Otherwise the reader doesn't find out it was noise.
- **Show today before tomorrow.** The first draft described only the system to be built, and it never said what agents use now, whether the CRM was bought or built, or whether anything reached a database directly. Answering those questions changed the analysis. Agents stay in the CRM and reach the new system through a webhook, which turned option A from blocked into the close runner-up and added a trap (triage inside the CRM). Every exercise opens with the current state: each actor, the component each one uses, whether it's bought or built, and how the parts connect (API, database, or event). Draw it as its own figure, before the figure of the system to be built.
- **Visual aids came after the first draft and changed it.** Four figures now carry the situation, the burst, the options, and the recommended option under load. Draw the figures while writing, not after.
- **Length:** about 1,700 words, an 8–10 minute read. The collapsed analysis is about 60% of it.
- **Open for review:** whether H2s inside the collapsed analysis should appear in a page table of contents (they would give the answer away), and whether "Your turn" should ask for the fact that would flip the reader's own choice.

### Hearthline premise review (before drafting)

- **Review the premise before drafting.** An independent skeptic read the world and the proposed options and found the verdict rested on facts the world left out: no outage ledger behind the availability number, a target above the market (99.95% against the leader's 99.9% with exclusions), a booking model unlike the category's (named technicians instead of arrival-window capacity), a weakened option A, a straw-man option C, and a missing cheaper option (a precomputed availability feed plus a durable intake queue). Fixing the world cost minutes. Finding the same gaps after drafting cost pilot 1.
- **Check the premise against the stage's guides.** Booking availability needed availability math, caching, reliable publishing, and release engineering, none of which stage 3's guides teach. The premise moved to a later stage, and stage 3 takes the pressure its guides do cover: teams blocking each other's releases.
- **Record causes, not just totals.** A number like "99.7% availability" invites the question "from what?" The world now carries an outage ledger, and the causes were chosen for realism before any option was judged against them.

### Hearthline draft review

- **The draft review changed the recommendation.** The coupling evidence (multi-team features take twice as long) was measured while every change waited on a weekly batch, so it couldn't separate waiting from coordination. The fair answer became "ship the process changes, measure, then decide on the boundary", and the earlier favorite became a flip. Let the review move the answer. Don't defend it.
- **Check the arithmetic in calendar and working days.** "3.5 days waiting plus 2 days for QA and deploy" mixed the two. Averages over a weekly cycle need one unit, stated.
- **Every clause in a cost cell needs its fact on the page.** A cost that cited connection-pool storms relied on a fact only the canon held.
- **Name the other reasons to split, even to rule them out.** A reader who knows the four needs that justify distribution will look for the ones the scenario doesn't test. Scope them out in the situation.

## Decisions

Agreed 2026-09-28:

1. **Name:** Exercises.
2. **Collapsed analysis:** a native `<details>` element, closed by default.
3. **Worlds:** Ridgeline plus two contrasting companies.
4. **Back-links from guides:** yes, the "Practice this" pill.
5. **Scope:** path-first. Every exercise belongs to a path, pages are published and searchable, and there's no catalog until the set warrants one.
6. **Menu placement (when added):** under Learning.
