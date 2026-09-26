# Learning Path Guide

This guide covers what qualifies as a learning path, its format, and the rules for writing one. Always also read [writing-standards.md](../skills/refine-prose/writing-standards.md), since the universal rules apply to a path's goal, stage purposes, and "why" lines.

---

## What a Learning Path Is

A learning path is an ordered route through existing content toward a goal. Each step is a guide, resource, case study, or essay the site already has, plus one line on why it comes where it does. The path adds order, reasoning, and practice. Each stage ends with a checkpoint that asks the reader to apply it. It never adds new teaching content.

Category order in `study_guides_config.json` already teaches one topic from the ground up. A path exists for the reader whose goal crosses topics.

### What Qualifies

A candidate becomes a path only if it passes all four tests:

1. **Goal, not topic.** It names something the reader will be able to *do* ("make and defend a structural decision"), not a subject ("architecture"). A topic already has a category.
2. **Category order doesn't already give the route.** In practice the path crosses at least three categories, or mixes content types in an order no category holds. A route inside one category is that category's order.
3. **Distinct audience.** Two paths share no more than 25% of either path's main steps. Heavier overlap means one is a variant of the other: merge them, or make one the other's `prerequisite`.
4. **The content exists.** 10–20 main steps are available today. If the path needs a missing guide, the gap goes on the content backlog and the path waits.

### Paths Are Isolated

A path points to pages. No page points back.

- Never add path links or path mentions to guides, resources, case studies, or essays.
- Never add a feature to a content layout that looks up paths: no "part of this path" note and no path-aware prev/next. Only `_layouts/learning-path.html`, `_layouts/learning-paths.html`, and the home page band read the `learning_paths` collection.
- The path page is the reader's whole navigation. Step and "go deeper" links open in a new tab, so the path page never navigates away. A step page's own prev/next, breadcrumbs, and back links then can't strand the reader, because the path is still one tab over. Don't answer that confusion by hiding or rewriting navigation on content pages.

---

## The Shape of a Path

A path climbs. It opens with the abstract: foundations, theory, and the arguments that frame the subject. Then it moves into basic implementation and the material around it. Then it repeats that move at each deeper level of implementation.

- **Stages are levels:** `Foundations`, `Basics`, `Intermediate`, `Advanced`, in that order. The first stage is always Foundations. Use as many levels as the subject needs, and repeat a level when one would hold too much, but never step back down.
- **Arguments belong at the front.** An essay that frames the subject goes in Foundations, and an essay that frames one level's decision goes at the head of that level. An essay at the end of a path is a sign the order is wrong. It should have shaped everything before it.
- **Inside each level, the why comes before the how.** Theory, argument, or motivating case first, then the implementation, then the templates and references that support it.
- **The stage `name` says what that level is about for this subject.** The `level` says how deep it is. The page shows both ("Stage 2 · Basics", then "Choosing a shape").

---

## Format Requirements

One file per path in `_learning_paths/<id>.md`. The whole path lives in front matter, and the body is empty. The file name is the URL: `/learning-paths/<id>.html`. **Never rename it.**

```yaml
---
title: "Developer to Architect"
order: 1                      # position on the listing and home page band
description: "..."            # SEO and search; one sentence on scope
goal: "..."                   # what the reader will be able to do, one sentence
audience: "..."               # who it's for, shown as "For:"
assumes: "..."                # what the reader should already have, shown as "Assumes:"
prerequisite: other-path-id   # optional; another path the reader should finish first
last_reviewed: 2026-09-25     # unquoted; update on every review pass; maintainer-only, not rendered
stages:
  - level: Foundations        # Foundations | Basics | Intermediate | Advanced
    name: "What architecture is"
    purpose: "One sentence on what this stage gives the reader."
    steps:
      - url: /study-guides/architecture/ArchitectureFoundations.html
        why: "What this step enables later in the path."
    deeper:                   # optional, unnumbered, no "why"
      - /resources/architecture-characteristics-glossary.html
    checkpoint:               # required on every stage
      can: "tell an architectural decision from a design one, ..."   # follows "You can now"
      try: "Pick a system you work on. List its top three ..."       # one task on the reader's own work
      exit: true              # optional; stopping here leaves a complete skill
---
```

- **Step URLs** are site-relative and end in `.html`: `/study-guides/<path>.html`, `/resources/<name>.html`, `/case-studies/<name>.html`, `/blog/YYYY/MM/DD/<slug>.html`.
- **Titles, type badges, and reading times** come from the collections at build time. Never copy a title into the path file.
- **No config file.** The listing sorts by `order`. There is nothing to register.

## Writing a Path

- **Place content by its lesson, not its technology.** A case study built on SQS whose lesson is "the pattern didn't fit the problem" teaches architecture, not AWS. Before placing a step, read its lessons or conclusion and ask what it teaches.
  - A **technology path** (Designing on AWS, Running AWS at Scale, Coding with AI Agents) keeps a step only if the step's lesson is about that technology's domain. Vendor-neutral material in the same domain is fine: DR patterns and IaC fundamentals belong in a cloud path.
  - Lessons about architecture, organizations, decisions, or engineering practice go to the **theory paths** (Developer to Architect, Leading a Development Team), even when the story is set on one vendor's stack.
  - A technology path that depends on that theory says so in `assumes`, rather than borrowing the theory's steps.
- **Order:** follow The Shape of a Path. Place every step by its level first, and by what it depends on second.
- **Size:** a focused path, one skill or one kind of project, runs 10–20 main steps in 3–5 stages. A path that spans a role change (Developer to Architect) may run to 40 steps in up to 8 stages by repeating levels, because the role really has that much ground. Past 40, split it and link the halves with `prerequisite`. Length is never a goal: a long path still cuts every step that doesn't earn its place.
- **Every step earns its place.** If a reader could skip it without missing anything later, cut it or move it to `deeper`.
- **The "why" line says what the step enables later in the path, or why it sits at this position.** It never restates the guide's description. "Coupling is what the style comparisons in the next stage are really arguing about" works. "Covers cohesion, coupling, and connascence" doesn't.
- **Respect category dependencies.** If step B depends on A and both are in the same category, keep category order.
- **Read each step's opening before placing it.** Confirm it stands on its own at that position and doesn't assume a guide the path skipped.
- **At least one non-guide step:** a resource, case study, or essay. Paths are where the content types meet.
- **`deeper` links** are for readers who want more on a stage: sibling styles, related case studies, reference tables. Keep them to about five per stage, and put the most useful first.

## Checkpoints

Every stage ends with a checkpoint. It tells the reader what the stage gave them, and asks them to use it once. Reading alone makes a path feel like homework. The checkpoint is where it turns into something the reader can do.

- **`can` completes "You can now".** Start it lowercase and end it with a period. State one plain outcome, two at most, that the reader would recognize as worth having before reading the stage. It has to make sense to someone who closed the guides a week ago, so use no term the stage introduced and don't list the steps' topics. "Divide a system into parts based on what it does, not on how its data is stored" works. "Find components from journeys and the domain rather than tables" doesn't: it only makes sense while the guide is still open. Don't claim anything the steps don't cover.
- **`try` is one task on the reader's own work.** It should take under an hour and produce something they can look at: a sketch, a list, a paragraph, an ADR, a deployed piece. Aim it at "a system you work on" or "an application you know", so a reader without the perfect project can still do it. Point at a template or resource from the stage when one fits. Later tasks may build on earlier ones ("the characteristics you listed in stage 1").
- **A checkpoint is practice, not teaching.** It never explains a concept or summarizes a step. If a task needs an explanation to be doable, the explanation belongs in a guide.
- **`exit: true` marks a stage where stopping still leaves the reader with a complete, usable skill.** The page labels it "a good place to stop". Use it so a long path reads as several finishable pieces, typically one or two per path. Never on the last stage, which is the end anyway.
- **Nothing is tracked.** Checkpoints are static text. There are no checkboxes, answers, or saved progress.

## Validation

```bash
python .pathcheck.py
```

It resolves every step and `deeper` URL to a content file and checks required fields, a checkpoint on every stage, that levels start at Foundations and only climb, step and stage counts, duplicate URLs, the non-guide rule, `prerequisite` targets, and pairwise overlap. A URL that doesn't resolve also renders as a visible "Missing step" on the path page.

**Run it after moving, renaming, or deleting any guide, resource, case study, or post.** A path that still names the old URL is broken, and nothing else catches that.

## Publishing a Path

1. Write the file and run `python .pathcheck.py` until it's clean.
2. Build and look at the path page and the listing.
3. Add the path to the `learning-paths` What's New entry's `links` (`assets/data/whats_new.yml`), and move that entry to the top. Don't create a separate entry per path.
4. The home page band links the first four paths by `order`. Reorder if the new path should be one of them.
