---
layout: case-study
title: "When Discipline Makes AI a Force Multiplier"
subtitle: "Rebuilding an undocumented legacy application in four months by applying Anthropic's 4D Framework and Shaped Kanban to every AI interaction"
description: "A production Windows desktop application, unmaintained for two years with no documentation, no tests, and no remaining institutional knowledge, was rebuilt and shipped in four months. Not because of better AI tools, but because of better AI discipline. This case study covers the migration tool dead-end, the three ways unguided AI failed early, and how Anthropic's 4D Framework combined with Shaped Kanban turned chaotic sessions into a deterministic delivery process."
role: "Team Lead"
date: 2026-06-03
headline_metric: "4 Months"
headline_detail: "Legacy rebuild, zero docs or tests, no institutional knowledge"
category: "success"
featured: true
category_label: "AI-Assisted Delivery"
technologies:
  - WinUI3
  - .NET
  - C#
  - MVVM
  - Claude Code
  - Dapper
  - SQLite
  - Serilog
---

## The Project

The application is a customer-facing Windows desktop tool central to client compliance and record management. The existing implementation was built on .NET UWP. The business needed it rebuilt on .NET WinUI3. When I joined, the codebase had gone unmaintained for two years:

- No documentation of any kind
- No tests
- No code comments
- No one remaining with any working knowledge of how it functioned

The institutional context had completely dissolved. What remained was the running application, the source code, a "just get it done" mandate with roughly six months to show something, and one hard constraint: zero regression tolerance. The new application had to maintain perfect functional parity with the legacy. Nothing could break.

### The Approach

Before any other decision, there was the question of how to proceed with the migration. Microsoft provides tooling for the UWP-to-WinUI3 path. That tooling migrates structure: it updates project references, adjusts some API calls, and attempts to rewrite XAML where the two platforms diverge. What it cannot handle is the full surface area of differences between the UWP and WinUI3 SDK sets. Wherever the platforms behave differently in ways the tool does not model, the output is broken in ways that require manual intervention. On an application with years of accumulated business logic, that surface area is large. The cost of repairing migration output was trending toward exceeding the cost of rebuilding from scratch.

But even setting the migration tooling aside, a successful migration alone was not enough. Manual inspection and Claude-assisted code analysis had surfaced the scale of the technical debt: threading issues, memory leaks, blanket logging that produced noise without visibility, and a data access layer that had grown fragile. A clean migration would have carried all of that forward. The result would have been a new version number on a product that customers would still find painful to use, built on a foundation that could not accommodate a significant upcoming shift in the company's API layer without substantial rework.

The legacy UWP application was not a liability in this context; it was a behavioral specification. The decision was to rebuild against it with the quality bar the new version actually required, not to carry those problems forward unchanged.

The data and business logic layers were retained as the foundation; the presentation layer was rebuilt in WinUI3 incrementally, feature by feature. Architectural and dependency changes were introduced across all layers as assumptions were tested and requirements clarified. Code that had not been identified as technical debt remained, often unchanged or lightly refined. The rebuild addressed what needed changing rather than discarding what still worked.

Because the business and data layers were largely intact from the start, the structure of the application was already understood before any WinUI3 code was written. That upfront clarity is what separated this from a ground-up rewrite. Ground-up rewrites spend months recovering understanding of what they are rebuilding. Here, the code map was never lost, only extended.

## What Unguided AI Looks Like

The initial approach was straightforward: open a session, load the relevant files, describe the task, and review what Claude produced. Early sessions moved fast and produced concrete deliverables. That momentum made the emerging problems easy to miss until they had accumulated enough to force attention.

The rebuild used Claude Code as the primary AI development tool throughout. The table below summarizes how each tool was used across the project.

| Tool | Role |
|---|---|
| Claude Code | Primary implementation. Strong context retention, capable architectural reasoning |
| Copilot | Pre-merge quality scans. Better suited to static analysis than holistic design |
| Gemini | Research and architectural decision support |
| Cursor | Evaluated; cost premium didn't justify it for this project |

The tool was right. The problem was the process around it, and that showed up in three failure modes consistent enough across early sessions to form a pattern.

**Context decay.** A large codebase exceeds what any context window can hold at once. Without a system for loading the right context at the right time, Claude made decisions based on incomplete information. A component rebuilt in one session would contradict a pattern established in another. These inconsistencies were not a model failure; they were a process failure.

**Assumption gaps.** Claude would proceed confidently on work where the requirements were genuinely unresolved. In a legacy rebuild, the distance between what the old code did and what the new code should do is often ambiguous. Some of what the legacy application did was intentional business logic, while some was accidental behavior that had accumulated and never been questioned. Claude could not distinguish the two, and when sessions did not force that distinction before work began, Claude filled the gap with inference. Those inferences were built into the implementation before anyone caught them.

**Absent tests.** Without a structure requiring assumptions to be proved before implementation, testing was deferred and problems surfaced during integration, when they were far more expensive to address.

None of these were problems with the tool; they were problems with how the tool was being used. Fixing them required a systematic answer, not better judgment session by session.

## The Framework

Fixing the workflow required two things operating together: a set of task-level disciplines that front-loaded risk resolution before implementation started and a principled model for human-AI collaboration that kept human judgment in the parts of the loop where it belonged.

### Shaped Kanban

Shaped Kanban is a hybrid methodology that combines Shape Up's shaping disciplines with a Kanban continuous flow. In a typical product environment, this includes the full project management apparatus: an Idea Archive, a Shaping Phase, and a Betting Table where leadership commits to work before it enters the backlog. On this project, those layers were unnecessary. The legacy application defined what to build; the running application answered the priority question without any shaping ceremony.

What Shaped Kanban contributed were its task-level disciplines, applied to every piece of work and every AI interaction. Three were central:

**Front-loaded risk.** Every task begins by identifying and testing critical assumptions before any implementation starts. Developers are the first line of defense, not QA, not integration. If the foundational assumptions have not been validated, there is no business writing code against them.

**The Hill Chart mindset.** Every piece of work is either uphill (discovery, unknowns being resolved) or downhill (execution, building with certainty). The transition is not a calendar event; it is the moment all major unknowns are solved. Nothing enters execution while significant questions remain open.

**The Circuit Breaker.** If a critical assumption fails or work threatens to exceed its appetite, work stops. The team realigns before continuing rather than pushing forward on a compromised foundation. Sunk cost is not a justification for continuing in the wrong direction.

### Anthropic's 4D Framework

Anthropic's 4D Framework describes four competencies for effective human-AI collaboration. It is not primarily a prompting guide. It is a model for understanding the human's role in a collaboration where AI is doing significant work.

**Delegation** is deciding which tasks to hand off to AI and which to retain, based on an honest understanding of your goals and what the AI is and is not capable of doing reliably.

**Description** is communicating with precision: providing context, constraints, and instructions that are specific enough for the AI to act on correctly rather than fill gaps with inference.

**Discernment** is evaluating AI outputs with your own critical judgment, assessing quality and accuracy rather than accepting outputs at face value.

**Diligence** is taking responsibility for what you do with AI output and ensuring your overall use is responsible and safe.

Applying this to the rebuild meant building concrete structures around each competency. A live App Map solved the description problem structurally. A custom Claude Code skill enforced discernment by producing a proof-gated task document before any code was written. The sections below describe each of these in detail.

## Delegation: Knowing the Boundary

The context decay and assumption gap failures from the early sessions traced to the same root: work was delegated before it was ready. Requirements were ambiguous, scope was loose, and Claude filled the gaps with inference. The fix was not better prompting; it was a clearer line between what AI could own and what had to stay with a human.

On this project, delegation was bounded deliberately:

- **Claude owned:** implementation tasks where scope was clear, assumptions were proved, and acceptance criteria were explicit
- **Humans owned:** requirement interpretation, assumption identification, architectural decisions, and output review

Equally important was the unit of delegation. The custom skill was only ever invoked for a single, isolated task: one feature or one bug, pulled from a Jira ticket that a human had already scoped and prioritized. This constraint prevented a failure mode common in less-supervised workflows: tasks spawning further tasks until AI-driven scope has grown beyond what anyone agreed to or can meaningfully review.

The architecture decisions on this project demonstrate what proper delegation looks like in practice. The choice to use a Refined Layered Architecture (Presentation, Business Logic, Data Access) rather than attempting a more ambitious restructuring was made and documented before implementation started, not inferred from context during it. The shift from Entity Framework to Dapper for the data access layer was an explicit decision with a documented rationale: simpler queries, better testability, and reduced surface area for the threading and lifecycle issues that EF context management can introduce. Claude implemented these decisions; it did not make them.

## Description: The App Map

The context decay problem had a structural solution. The codebase was decomposed into single-responsibility components, each documented in a directory map describing what the component owned, how it connected to other components, and what patterns it followed. This became the App Map: a live, maintained reference that served as the source of accurate context for every AI session.

Before the App Map existed, sessions required long preambles to orient Claude to the relevant parts of the codebase. After it existed, the relevant sections could be loaded directly, and per-task cost dropped as Claude spent less time resolving context and more time on the work itself.

A byproduct of maintaining the App Map was the automatic maintenance of the application's Technical Guide: a human-readable overview of the architecture for PMs, QA engineers, and support staff. The discipline of keeping the map accurate produced documentation that would not otherwise have been written.

## Discernment: Assumptions Before Code

The assumption gap failure from early sessions pointed directly at when in the workflow the intervention needed to happen: before implementation began. A custom Claude Code skill was built to enforce this discipline automatically. Invoking it produces a structured ticket document that names every assumption the implementation depends on, assigns a proof strategy to each one, and gates implementation on the results of that proof plan. Rather than relying on discipline in the moment, the process required it before momentum existed to override it.

Every assumption must be assigned a proof strategy before implementation begins. Accepted strategies are:

- Unit or integration tests
- Code research and pattern verification in the existing codebase
- Dependency documentation review
- A focused spike
- Explicit human confirmation

Not every assumption can be proved with a test, and that is fine. What is not acceptable is an assumption with no proof strategy assigned, or any assumption still unresolved when implementation starts. All assumptions require proof, regardless of how obvious they seem.

The question the gate forces is: do we actually know what we think we know? It is positioned before any implementation momentum exists because plan-continuation bias makes this question harder to ask honestly once work is underway. Sunk effort makes wrong assumptions feel more defensible than they are.

The output was more predictable, required less rework, and produced fewer surprises during integration.

## Diligence: Closing the Loop

Diligence in the 4D Framework is about responsibility: taking ownership of AI output rather than treating it as a peer-reviewed artifact that passed quality control automatically.

**Validate before implementing.** Code entered implementation only after its foundational assumptions had been validated through the proof plan.

**Prove assumptions with tests.** Tests were written to prove assumptions where possible, with explicit human verification for the rest. The test suite that emerged was the first automated test suite the application had ever had, built use-case-driven and spanning all application layers. It was a natural artifact of the development discipline, not a separate effort.

**Publish reasoning in pull requests.** The full assumption proof plan and task document were published in each pull request. This made the reasoning behind implementation decisions transparent to reviewers and created a historical record that future maintainers could read. Reviewers were reviewing not just whether the code was correct, but whether the decisions that produced it were sound.

**Quality scan before merge.** Copilot quality scans ran before any PR merged. Its strength on this project was static quality analysis, not implementation; the inverse of where Claude excelled.

**Own what you ship.** The original logging approach captured everything and left someone to sort through it later. In practice, logs remained stranded on devices, users were unaware errors had occurred, and when errors were eventually reported the diagnostic context needed to investigate them was gone. Blanket logging created noise without creating visibility.

The replacement was deliberately authored observability: each log entry captures only what requires investigation, includes structured session context and the specific IDs involved in any failure, and is treated by developers as a first-class responsibility rather than an afterthought. A UI health indicator surfaces application state directly so users know when something has gone wrong, without anyone needing to parse logs to find out.

## Outcomes

The project delivered to production in four months, well inside the six-month mandate. Beyond the platform migration, the delivery addressed technical problems the application had carried for years:

- Threading race conditions resolved by migrating to a messaging pattern
- Memory leaks found through profiling and eliminated
- Data access layer rebuilt with Dapper and SQLite, mirroring API response DTOs directly for simpler data flow and better performance
- Blanket logging replaced with deliberately authored structured observability and a UI health indicator
- Significant refactoring to introduce single-responsibility components, interface extraction, and dependency injection, enabling unit test mocks and positioning the codebase to adapt cleanly to upcoming API changes
- The application's first automated test suite, built use-case-driven across all layers
- An App Map documenting every component's ownership, patterns, and connections (maintained as a live artifact throughout the project)
- A Technical Guide derived automatically from the App Map, giving PMs, QA, and support staff a readable overview of the architecture
- A full per-task plan document for every feature and bug, including the assumption proof plan, published in each pull request as a historical record for future maintainers

## Key Lessons

### 1. Solve the description problem structurally, not per-session

A live App Map with explicit component ownership produces compounding returns across every session that follows: lower per-task cost, more consistent output, and accurate documentation as a natural byproduct. Better prompts produce marginal improvements; better infrastructure produces systematic ones.

### 2. Atomic delegation prevents scope from compounding

Controlling the unit of delegation is as important as controlling the type. One task at a time, human-sequenced, keeps AI-driven scope within what anyone agreed to and can meaningfully review.

### 3. Front-loading assumptions is the highest-value intervention in the workflow

Most AI-assisted development failures trace to implementation that proceeded before foundational questions were resolved. Requiring proof before implementation begins forces the question before plan-continuation bias makes wrong assumptions feel too costly to acknowledge.

### 4. Refactoring for testability also refactors for AI and for adaptability

Decomposing the codebase into single-responsibility components with extracted interfaces and dependency injection served App Map accuracy, unit test mocking, and clean adaptability to upcoming API changes all at once. Good structure is good structure regardless of who consumes it, and AI reflects code quality rather than compensating for it.
