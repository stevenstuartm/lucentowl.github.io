# Learning Paths — Feature Plan

Curated, ordered routes through existing content toward a stated goal, such as "backend developer to architect", "system design interview prep", or "production-ready .NET services". Each step says why it comes next. The content already exists; a path supplies the order and the reasoning for it.

## Status

Planning. No implementation started.

## The problem

The site has ~390 guides, 54 resources, 10 case studies, and a blog. Within a category, the order in `assets/data/study_guides_config.json` already acts as a fundamentals-to-advanced path, and `guide_navigation.html` renders prev/next from it. What's missing is a route **across** categories: a learner with a goal can't tell which dozen guides from which five categories to read, or in what order.

## Goals

- A learner with a goal can pick a path and know exactly what to read next and why.
- Paths cross categories and content types: guides mostly, plus resources, case studies, or posts where they fit.
- Paths are cheap to maintain: one data file, with no edits to the guides a path includes.
- No per-reader state. No progress bars, completion checkmarks, or "resume where you left off". The site's no-tracking rule applies.

## Non-goals

- Replacing the category order. Category order stays the default reading sequence within a topic.
- Auto-generated paths from tags or links. Curation is the value.
- Quizzes, certificates, or assessments.

## Proposed shape

- **Data:** `assets/data/learning_paths.yml` (or JSON, matching the other configs). Each path has an id, title, goal statement, audience, rough total reading time, and ordered stages. Each stage has a name and a list of steps. Each step is a site-relative URL plus a one-line "why this, why now".
- **Pages:** a listing page (`/learning-paths.html`) and one page per path, generated from the data. Either a new collection with a stub file per path or a single page that renders from a `?path=` query. Stub files give each path a real URL for SEO.
- **Layout:** stages as sections and steps as cards, reusing existing card styles. Titles, descriptions, and reading times come from the collections at build time, so the path data holds only URLs and the "why".
- **Home page:** paths likely become a fifth "way to learn" card, or sit ahead of the existing four as the starting point for new visitors.

## Decisions to make

1. **Collection vs data-only.** Stub files per path (real URLs, indexable, one more place to edit) or pure data rendered by one page (single source, weaker SEO).
2. **In-guide context.** When a reader arrives at a guide from a path, should the guide show "Step 4 of 12 in *Path X* — next: …"? This could be done with a URL parameter and no stored state. It's the biggest UX question: without it, the reader must return to the path page after each guide, and guide prev/next pulls them back into category order.
3. **Which paths first.** Pick 2–3 launch paths that span the most categories and serve distinct audiences. Candidates:
   - Developer to architect (architecture, SDLC, leadership, case studies)
   - System design fundamentals (architecture, data, networking, infrastructure, observability)
   - Production-ready .NET backend (C#, ASP.NET Core, security, observability, deployment)
   - Cloud infrastructure from zero (infrastructure, AWS, security, IaC)
4. **Path length.** Cap on steps per path. Proposed 10–20 steps in 3–5 stages; beyond that, split into two paths.
5. **Optional steps.** Whether a step can be marked optional or "go deeper" without cluttering the main route.
6. **Relation to the shelf.** A "shelve this whole path" action uses the existing local-only shelf and adds no new tracking, but may be clutter. Decide after launch.

## Authoring rules (draft)

- Every step earns its place. If a reader could skip it without missing anything later, cut it.
- The "why" line states what the step enables later in the path. It never restates the guide's description.
- A path never forces the reader to read a guide out of the order its category depends on. If step B depends on A and they're in the same category, keep category order.
- Validate every URL at build time or with a small script. Guides move, and a dead step breaks the path.
- Once the format settles, move these rules into a `.claude/content/learning-path-guide.md` and list it in CLAUDE.md's guides table.

## Work outline

### Phase 1 — Draft one path on paper

- Write one full path in this doc: stages, steps, "why" lines.
- Check it against the authoring rules. This settles decisions 4 and 5 and exposes gaps in the content before any code exists.

### Phase 2 — Build

- Settle decisions 1 and 2.
- Data file, listing page, path layout, home page entry.
- URL validation script (or extend `.figcheck.py`-style tooling).

### Phase 3 — Launch

- Author the remaining launch paths.
- Update CLAUDE.md: architecture entries, and the rule that moving a guide means updating any path that contains it.
- Add a What's New entry.

## Draft path (Phase 1 workspace)

*Not yet drafted.*

## Open questions

- Should paths get a `last_reviewed` date like resources' `last_updated`, so stale paths are visible?
- Does search ([`search-feature-plan.md`](search-feature-plan.md)) index path pages? Probably yes. They are good landing pages for goal-shaped queries like "become an architect".
