# Learning Paths — Feature Plan

Curated, ordered routes through existing content toward a stated goal. Each step says why it comes next. The content already exists; a path supplies the order and the reasoning for it.

## Status

**Live:** Developer to Architect, Coding with AI Agents, Cloud Architect on AWS, and Leading Software Delivery (2026-09-25). The feature is built: the `_learning_paths/` collection, the path page, the listing, the home page band, the "Learn" nav group, the search tab, the shelf type, `.pathcheck.py`, and `.claude/content/learning-path-guide.md`. The authored paths in `_learning_paths/` supersede their draft tables below.

Next candidates, ranked by how well the site supports them across content types: Production-ready ASP.NET Core service (2 case studies, 6 essays), then Security for developers (1 case study, 3 essays). Building LLM applications needs a case study first. How distributed systems work was largely absorbed by the expanded Developer to Architect path; drop it, or narrow it to a reliability-and-operations path. Cloud Architect on Azure waits for Azure case studies or essays.

## The problem

The site has ~390 guides, 56 resources, 10 case studies, and ~30 essays. Within a category, the order in `assets/data/study_guides_config.json` already acts as a fundamentals-to-advanced path, and `guide_navigation.html` renders prev/next from it. What's missing is a route **across** categories: a learner with a goal can't tell which dozen guides from which five categories to read, or in what order.

## Goals

- A learner with a goal can pick a path and know exactly what to read next and why.
- Paths cross categories and content types: guides mostly, plus resources, case studies, or essays where they fit.
- Paths are cheap to maintain: one file per path, with no edits to the content a path includes.
- Paths are isolated. A path points to pages; no page, layout, or include points back to paths.
- No per-reader state. No progress bars, completion checkmarks, or "resume where you left off". The site's no-tracking rule applies.

## Non-goals

- Replacing the category order. Category order stays the default reading sequence within a topic.
- Auto-generated paths from tags or links. Curation is the value.
- Quizzes, certificates, or assessments.
- Interview prep framing. The site argues against LeetCode-style interviews (`2025-08-19-leetcode-interviews-categorical-error`); a "crack the interview" path would contradict it.

## Which paths, and why

### What qualifies as a path

A candidate becomes a path only if it passes all four tests:

1. **Goal, not topic.** It names something the reader will be able to *do* ("make and defend a structural decision"), not a subject ("architecture"). A topic already has a category.
2. **Crosses at least three categories.** A route that stays inside one category is the category order, which already exists. This rejects DSA, WinUI, Git/GitHub, and the Building-with-LLMs subcategory on their own.
3. **Distinct audience.** Two paths may share a step, but no more than ~25% of either path's steps. Heavier overlap means one path is a variant of the other; merge them or make one a prerequisite.
4. **The content is there.** 10–20 main steps exist today without writing new guides. If the path needs a missing guide, the gap goes on the content backlog and the path waits.

### Candidate catalogue

| Candidate | Reader | Categories crossed | Verdict |
| --- | --- | --- | --- |
| **Developer to architect** | Senior developer taking on design responsibility | Architecture, Leadership, SDLC, case studies, essays | **Launch.** The site's core subject; the reader has the least obvious route today. |
| **How distributed systems work** | Developer who has built single-process apps and now builds services | Networking, Architecture, Databases, Observability, case studies | **Launch.** Concept-first, vendor-neutral; the widest audience. |
| **Production-ready ASP.NET Core service** | C# developer shipping a first real service | .NET & C#, ASP.NET Core, Observability, Security, case studies | **Launch.** Hands-on, and the deepest content block on the site. |
| Secure by design for application developers | Developer who owns auth and data handling | Security, ASP.NET Core, AWS/Azure identity, essays, case study | Second wave. Strong; the two JWT/session essays and the zero-trust case study fit well. |
| **Coding with AI Agents** (live) | Developer using generative AI tools in daily work | AI & ML, Architecture (testing), resources, case study, essay | **Launch.** The largest audience on the site right now, and the AI category's order is built for builders, not tool users. |
| **Building LLM applications** | Developer adding an LLM feature to a product | AI & ML, Databases (vector), Security, Observability | **Launch.** The builder counterpart to the path above; together they split AI readers by what they're doing. |
| Shipping to the cloud | Developer who deploys but never designed the infrastructure | Infrastructure, SDLC (CI/CD), AWS *or* Azure | Second wave. Needs a decision on provider forks (see Decision 7). |
| IoT end to end | Developer building a device-to-dashboard system | IoT, .NET IoT, Azure IoT, ASP.NET Core (SignalR) | Later. Niche audience, but the content block is complete. |
| Leading a dev team | New tech lead | Leadership, SDLC | Rejected for now. Only ~8 steps exist, and they overlap the architect path beyond 25%. Revisit if leadership content grows. |
| Choosing a data store | Developer picking a database | Databases, AWS/Azure DB selection | Rejected. Mostly one category, and the selection matrix resource already does the job. |
| DSA / interview prep | — | DSA only | Rejected by tests 1 and 2 and the non-goal above. |

### Why these five launch together

The first three cover distinct stages of a career: *understand services* (distributed systems), *build one well* (ASP.NET Core), and *decide for others* (architect). The two AI paths split generative-AI readers by what they're doing: *using* AI to write software, or *building* software that calls a model. That is the question an AI reader brings, and the AI & ML category's order can't answer it, because it runs concept-by-concept for builders.

Overlap stays within the 25% rule:

- The first three share two steps: `distributed-computing` and `observability-fundamentals`.
- The two AI paths share `core-ai-concepts` and `prompt-engineering`, about 15% of each.
- *Building LLM applications* shares `observability-fundamentals` with the distributed systems and ASP.NET Core paths.

If five is too many to finish Phase 1 at once, launch *Coding with AI Agents* with the first three and let *Building LLM applications* lead the second wave.

A path may name another as a prerequisite ("Assumes: *How distributed systems work*, or equivalent experience"). That is the only relation between paths; no graph, no branching.

## Draft paths (Phase 1 workspace)

**Reshape every remaining draft before authoring it.** Paths now climb through levels (Foundations → Basics → Intermediate → Advanced), with theory and arguments first and each level going abstract to concrete. See "The Shape of a Path" in `.claude/content/learning-path-guide.md`. The drafts below predate that rule, so their stage order and essay placement are provisional.

Stage-level drafts with candidate steps. Reading times are computed from word count at 200 wpm, the same rate the guide layout uses. The "why" lines are written only where the reason for the position is not obvious; Phase 1 finishes them all.

### Developer to architect

- **Goal:** Make structural decisions for a system and a team, and defend them in terms the business accepts.
- **Assumes:** Several years building production software.
- **Size:** 17 steps, 5 stages, ~2.2 h.

| # | Stage | Step | Why here |
| --- | --- | --- | --- |
| 1 | What architecture is | Architecture Foundations | Sets the vocabulary every later step uses. |
| 2 | | Architecture Characteristics | Decisions are trade-offs between these; you need the list before you trade. |
| 3 | | Modularity & Coupling | The one characteristic every style is really arguing about. |
| 4 | Choosing a shape | Architecture Styles Overview | |
| 5 | | *Resource:* Architecture Style Comparison | Keep open for the next two steps. |
| 6 | | Modular Monolith Architecture | The default most teams should start from. |
| 7 | | Distributed Computing Fundamentals | What the network costs you before you split anything. |
| 8 | Deciding and recording | Architecture Decision-Making | |
| 9 | | *Resource:* ADR Template | |
| 10 | | Architecture Risk Analysis | |
| 11 | | Total Cost of Ownership | The argument that gets decisions funded. |
| 12 | | *Case study:* Third-Party Integration Boundaries | A boundary decision followed through to its consequences. |
| 13 | Communicating | C4 Model | |
| 14 | | AAA Cycle: Align-Agree-Apply | |
| 15 | Leading | Architecture Leadership | |
| 16 | | Architecture Governance | |
| 17 | | *Essay:* Architecture Is a Belief About Where Authority Belongs | Closes by reframing everything above. |

Go deeper (unnumbered): Microservices Architecture, Event-Driven Architecture, Return on Investment, Architecture Characteristics Glossary, *Rebuild or Realign* essay.

### How distributed systems work

- **Goal:** Explain what changes when a system spans a network, and choose communication, data, and failure-handling patterns on purpose.
- **Assumes:** You've built and deployed a single-process application.
- **Size:** 17 steps, 5 stages, ~3.2 h.

| # | Stage | Step |
| --- | --- | --- |
| 1 | The network | Network Fundamentals for Developers |
| 2 | | DNS: How Names Become Addresses |
| 3 | | HTTP Protocol Versions |
| 4 | What distribution costs | Distributed Computing Fundamentals |
| 5 | | Transactions and Isolation |
| 6 | | Replication and Consistency |
| 7 | Talking between services | Communication Patterns |
| 8 | | Messaging Patterns |
| 9 | | Orchestration and Choreography Patterns |
| 10 | | *Case study:* Distributed Event Processing |
| 11 | Owning data | Data Management Patterns |
| 12 | | *Resource:* Database Selection Matrix |
| 13 | | *Case study:* CQRS and Event Sourcing for Loan Servicing |
| 14 | Surviving failure and load | Reliability Patterns |
| 15 | | Performance and Scalability Patterns |
| 16 | | Observability Fundamentals |
| 17 | | SLOs and Alerting |

Go deeper: Coordination Patterns, Gateway and Proxy Patterns, *Your Reads Should Not Design Your Writes* essay, Networking Quick Reference.

### Production-ready ASP.NET Core service

- **Goal:** Take an ASP.NET Core API from `dotnet new` to something you'd put on call for.
- **Assumes:** C# language fundamentals (the .NET & C# category's Language Fundamentals subcategory).
- **Size:** 18 steps, 5 stages, ~4.8 h (code-heavy guides inflate the word count; real reading time is likely lower).

| # | Stage | Step |
| --- | --- | --- |
| 1 | Runtime habits | C# Async/Await Fundamentals |
| 2 | | C# Dependency Injection |
| 3 | | C# Configuration and Options Pattern |
| 4 | | C# Logging |
| 5 | The web host | ASP.NET Core Fundamentals |
| 6 | | Middleware Pipeline |
| 7 | | Minimal APIs |
| 8 | | Validation |
| 9 | Data and dependencies | Entity Framework Core |
| 10 | | C# HttpClient and Networking |
| 11 | Securing it | Authentication and Authorization |
| 12 | | API Security |
| 13 | | Rate Limiting and Request Timeouts |
| 14 | Running it | Testing ASP.NET Core APIs |
| 15 | | Health Checks and Diagnostics |
| 16 | | Observability Fundamentals |
| 17 | | Hosting, Deployment, and Operational Patterns |
| 18 | | *Case study:* Silent SDK Deadlock |

Go deeper: .NET Aspire Fundamentals, Output Caching, Background Services, *JWTs Are for Authentication, Not Authorization* essay, ASP.NET Core diagrams.

### Coding with AI Agents

*Authored as `_learning_paths/coding-with-ai-agents.md`: 12 steps in 4 stages. It drops the AAA Cycle step (the case study's discipline is assumptions-first delegation, not AAA), folds the case study into the assistant stage, and moves the technique selection table to "go deeper". The table below is the original draft.*

- **Goal:** Get reliable, reviewable work out of AI coding assistants and agents, know where they fail, and keep your organization's data out of places it shouldn't go.
- **Assumes:** You write code professionally. No ML background needed.
- **Size:** 14 steps, 5 stages, ~2.7 h.

| # | Stage | Step | Why here |
| --- | --- | --- | --- |
| 1 | How the tool works | Core AI Concepts | Context windows and sampling explain most "why did it do that" moments. |
| 2 | | Prompt Engineering | |
| 3 | | *Resource:* Prompt Engineering Technique Selection | |
| 4 | Working with an assistant | AI-Assisted Development | |
| 5 | | Testing Strategy & Architecture | Tests are what let you accept code you didn't write. |
| 6 | | *Resource:* Assumptions-First Task Planning Skill | A working example of giving the agent the context it can't infer. |
| 7 | Discipline at project scale | AAA Cycle: Align-Agree-Apply | |
| 8 | | *Case study:* When Discipline Makes AI a Force Multiplier | The previous two steps applied to a real rebuild. |
| 9 | Beyond one session | Model Context Protocol (MCP) | What you're trusting when you connect a tool server to your assistant. |
| 10 | | Beads: Durable Work Memory for Coding Agents | |
| 11 | | Scaling Generative AI Workflows | |
| 12 | | *Resource:* AI Batch Generation Pipeline Template | |
| 13 | Keeping it safe | AI Security for Organizations | |
| 14 | | *Essay:* AI in Practice: The Skill Inversion | Closes on what this shift does to the developer's job. |

Go deeper: Gas City, AI Agents, Tool Calling, Claude Prose Linter (another worked skill), Core AI Concepts Diagrams.

### Building LLM applications

- **Goal:** Ship a product feature built on an LLM that is grounded in your data, measured, and defended against misuse.
- **Assumes:** You build web services. *Coding with AI Agents* is not required.
- **Size:** 12 steps, 5 stages, ~2.4 h.

| # | Stage | Step | Why here |
| --- | --- | --- | --- |
| 1 | The model | Core AI Concepts | |
| 2 | | Prompt Engineering | |
| 3 | Giving it reach | *Resource:* LLM Systems Diagrams | Keep it open; it maps every step of the next two stages. |
| 4 | | Tool Calling | |
| 5 | | Retrieval-Augmented Generation (RAG) | |
| 6 | | Vector Databases | What the retrieval step is actually querying. |
| 7 | | AI Agents | Tools plus a loop; read only after tool calling makes sense. |
| 8 | Knowing it works | LLM Evaluation | |
| 9 | | Observability Fundamentals | |
| 10 | Shipping it safely | Application Security | The ordinary attack surface comes first. |
| 11 | | LLM Application Security | Then what prompt injection and excessive agency add to it. |
| 12 | | Running LLMs in Production | |

Go deeper: Model Context Protocol, LLM Fine-Tuning, Amazon Bedrock, Azure AI & ML Service Selection.

**Content gaps:** this path has no case study or essay. A case study of a shipped LLM feature, covering evaluation and an injection incident or a near miss, would be its strongest step.

## Developer to Architect: content gaps

The path uses 38 steps, and it now draws on every case study on the site. What it still lacks is content, not ordering. Each gap below names where a new piece would slot in. Add it to `_learning_paths/developer-to-architect.md` when it's published.

| Gap | Kind | Where it would go | Why the path needs it |
| --- | --- | --- | --- |
| The shift itself: what changes when a developer becomes an architect (time, breadth over depth, measuring your own impact, staying technical) | Essay | Foundations, step 1 | The path opens on design quality. Nothing yet speaks to the reader's own change of role, which is the reason they picked the path. |
| From business goals to characteristics: stakeholder workshops, quality attribute scenarios, capability mapping | Guide | Basics, head of "Finding the boundaries" | Characteristics are defined and selected, but not *elicited*. Architects get them from people, and the path skips that conversation. |
| Evaluating and adopting technology: spikes, proofs of concept, adoption criteria, running a tech radar | Guide | Intermediate, "Deciding and recording" | Keeping current is a core architect expectation. The site has a Tech Radar page and two adoption-failure case studies (Kubernetes, SignalR), but nothing on *how* to evaluate. |
| Design documents and RFCs: when to write one, structure, running the review | Guide or resource | Intermediate, after the ADR template | ADRs record a decision. Most decisions start as a proposal that needs its own format and review process. |
| Evolutionary architecture: fitness functions as a practice, incremental change, guided evolution | Guide | Advanced, "Proving the qualities" or ahead of Governance | Fitness functions appear inside the characteristics and governance-tools guides, but the idea of designing for continual change has no home. |
| Communicating with the business and navigating politics: framing decisions for executives, influence without authority | Essay or guide | Advanced, "Leading across teams and time" | Build Slow to Go Fast and the TCO guide touch it. The leadership guide covers negotiation with teams, not with the business. |
| A case study at the Advanced level: a governance change, a strangler-fig modernization, or a cross-team decision | Case study | Advanced stages | Every case study is a technical decision. The two Advanced stages have none showing leadership or governance in practice. |
| Practice: architecture katas or worked design exercises | Resource | Closing step, or "go deeper" per level | The path ends on reading. A kata would let the reader apply each level. |

## UI design

Paths are isolated: a path points to pages, and no page points back. Guides, resources, case studies, and essays render exactly as they do today. They have no path bar, no "part of this path" note, and nothing in their layouts that reads path data. The path page is the whole navigation: the reader reads a step, comes back, and takes the next one.

Four surfaces, all on pages that belong to the feature.

### 1. Path listing — `/learning-paths.html`

One card per path, in curated order. With under ten paths there are no filters.

Each card shows: title, the goal sentence, "For:" audience, step count and total reading time, and the categories it crosses as small pills. The whole card links to the path page. A one-paragraph intro above the cards explains what a path is and that nothing is tracked.

### 2. Path page — `/learning-paths/<id>.html`

Since readers come back here between steps, the page has to make "where was I, what's next" quick to answer without tracking anything.

- **Header:** title, goal, "For:", "Assumes:" (linking to a prerequisite path if one is named), step count, reading time, `last_reviewed` date.
- **Body:** stages as `<section>`s, each with a heading and a one-sentence purpose. Steps are a **numbered vertical list on a rail**, not a card grid, because order is the point. Numbering runs continuously across stages, so "I'm on step 7" is easy to remember and find.
- **Each step row:** number, type badge (Guide / Resource / Case study / Essay, same labels as the shelf), title, the "why here" line, reading time. Title and reading time come from the collections at build time; the path file holds only the URL and the "why".
- **Step anchors:** each step has an anchor (`#step-7`), so a reader can bookmark or share their place. This is the URL doing the job, not stored state.
- **Visited links:** step titles keep the browser's `:visited` styling. The browser remembers which steps were opened, the site stores nothing, and the reader gets a free "done so far" cue.
- **Go deeper items** sit under their stage as a single muted line of links, unnumbered and without "why" lines, so the main route stays scannable.
- Step links are plain URLs, with no parameters.

### 3. Home page

A slim "Start with a goal" band directly below "Four ways to learn": a label, one link per path (the first four by `order`), and "All learning paths". The four cards say what the site is; the band offers a route through it. A band, not a card row, so the home page doesn't gain another heavy section. Paths are not a fifth content type, so they stay out of that grid.

Header nav: a "Learn" group holding Learning Paths and Study Guides, alongside Reference and Articles.

### 4. Search, shelf, What's New

- **Search:** path pages get the Pagefind markup (`data-pagefind-body`, title meta, `type:Path` filter), adding a "Paths" tab. Path pages are good landing results for goal-shaped queries like "become an architect". Raise the workflow's minimum indexed-page count only if it becomes tight.
- **Shelf:** path pages get the existing shelf button with a new `paths: 'Path'` type label. Shelve the path, not its steps.
- **What's New:** one entry at launch, one per later path.

## Data model

**Proposed (Decision 1): a `_learning_paths/` collection, one file per path, with the whole path in front matter.** This merges the two options in the original plan: the file is both the single source of data and the stub that gives the path a real URL. There is no separate YAML file to keep in sync.

```yaml
---
title: "Developer to architect"
layout: learning-path
order: 1
goal: "Make structural decisions for a system and a team, and defend them in terms the business accepts."
audience: "Senior developers taking on design responsibility"
assumes: "Several years building production software."
prerequisite: distributed-systems   # optional, another path's id
last_reviewed: 2026-10-01
description: "..."                  # for SEO and the listing card
stages:
  - name: "What architecture is"
    purpose: "The vocabulary and trade-offs every later step relies on."
    steps:
      - url: /study-guides/architecture/ArchitectureFoundations.html
        why: "Sets the vocabulary every later step uses."
      - url: /study-guides/architecture/architecture-characteristics.html
        why: "..."
    deeper:
      - /resources/architecture-characteristics-glossary.html
---
```

- `_config.yml`: add the `paths` collection with `output: true` and permalink `/learning-paths/:name.html`, plus a `layout: path` default. Order comes from `order`, not a config file; with under ten paths a separate config adds a sync step and no value.
- Resolving a step URL to its page reuses the lookup pattern in `related-links.html`, across `site.guides`, `site.resources`, `site.case_studies`, and `site.posts`.

## Decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | Collection vs data-only | **Proposed:** collection, path data in front matter (see Data model). |
| 2 | In-guide context | **Decided:** none at launch. The path page carries the navigation, and content pages know nothing about paths. In-path navigation is a later optimization (see Deferred). |
| 3 | Launch paths | **Proposed:** architect, distributed systems, ASP.NET Core service, Coding with AI Agents, Building LLM applications. |
| 4 | Path length | **Proposed:** 10–20 main steps in 3–5 stages. The three drafts land at 17–18. Beyond 20, split. |
| 5 | Optional steps | **Proposed:** "go deeper" links per stage, unnumbered, with no "why". |
| 6 | Relation to the shelf | **Proposed:** shelve the path page only (surface 4). |
| 7 | Provider forks (AWS vs Azure) | Open. Needed before *Shipping to the cloud*. Options: two sibling paths that share their first stages, or one path whose final stage lists both providers. Leaning toward sibling paths, which keeps "one path, one order". |

## Authoring rules (draft)

- Every step earns its place. If a reader could skip it without missing anything later, cut it or move it to "go deeper".
- The "why" line states what the step enables later in the path. It never restates the guide's description.
- A path never forces the reader to read a guide out of the order its category depends on. If step B depends on A and both are in the same category, keep category order.
- Overlap with any other path stays at or below ~25% of steps.
- Never make content aware of paths. Don't add path links or path mentions to guides, resources, case studies, or essays, and don't add a layout feature that looks up paths.
- Every path has at least one non-guide step (resource, case study, or essay). Paths are the place where the content types meet.
- Once the format settles, move these rules into `.claude/content/learning-path-guide.md` and list it in CLAUDE.md's guides table.

## Validation

A `.pathcheck.py` script, in the style of `.figcheck.py`:

- Every step and "go deeper" URL resolves to a file in `_guides/`, `_resources/`, `_case_studies/`, or `_posts/`.
- No URL appears twice in a path.
- Main step count within 10–20; every main step has a non-empty "why".
- Pairwise overlap between paths reported, failing above 25%.
- `prerequisite` names an existing path.

Run it after any guide move. CLAUDE.md gains the rule that moving or deleting content means running it (or `grep -rn "<old-url>" _learning_paths/`).

## Work outline

### Phase 1 — Finish the drafts on paper

- Sign off on the catalogue and the launch paths.
- Write every "why" line and stage purpose for all three. Read each target guide's opening to confirm it stands on its own at that position; note any step that assumes a guide the path skipped.
- Record content gaps found along the way in this doc.

### Phase 2 — Build

- Done: `_learning_paths/` collection and `learning-path` layout (surface 2), listing page (surface 1).
- Home row and header nav entry (surface 3).
- Pagefind markup, shelf type, `.pathcheck.py` (surface 4, Validation).
- No changes to the guide, resource, case study, or post layouts.

### Phase 3 — Launch

- Update CLAUDE.md: architecture entries, the `_learning_paths/` collection, and the move-means-pathcheck rule.
- Write `.claude/content/learning-path-guide.md` from the authoring rules.
- What's New entry.
- Second-wave paths follow one at a time, starting with *Secure by design*.

## Open questions

- Does a path page deserve a short intro paragraph beyond the goal line, written like a guide's opening? Decide after drafting the first one in full.

## Deferred: in-path navigation

Without it, a reader who finishes a step sees the guide's category prev/next, not the path's next step, and has to go back to the path page. That round trip is acceptable at launch. Revisit once paths have readers.

Any later design has to respect isolation. That rules out the design explored earlier, in which every step page rendered hidden path bars at build time: the step pages' HTML would then carry path data. A design that fits isolation keeps path knowledge out of content pages until the reader brings it in, for example step links carrying `?path=<id>` and a site-wide script that, only when that parameter is present, loads the path's step list and shows a small next-step bar. Its open issues were: the GA4 `page_location` recording `?path=` visits, hiding the bar from Pagefind, and the parameter dropping on in-body links.
