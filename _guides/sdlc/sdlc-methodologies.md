---
title: "Choosing an SDLC Methodology"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Fundamentals
description: "What a development methodology actually commits a team to, the Agile Manifesto, the approaches still encountered without a guide of their own (Spiral, FDD, Crystal), the frameworks for scaling beyond one team, and what should drive the choice."
tags: [fundamentals, agile, agile-manifesto, decision-making, scaling-frameworks, safe, crystal]
---

## What a Methodology Actually Decides

A development methodology does not change what work a team does. Requirements still get gathered, designs still get made, code still gets written and tested and deployed. What a methodology decides is the *shape* of that work, and it does so by fixing a small number of variables and letting the rest float.

<blockquote class="pull-quote">
<p>There is no "best" methodology, only the right methodology for your context, constraints, and team.</p>
</blockquote>

### The Five Axes

Almost every difference between methodologies reduces to where they sit on five axes. A team arguing about Scrum versus Kanban is usually arguing about two or three of these without naming them.

| Axis | One end | The other end |
| --- | --- | --- |
| **Batch size** | The whole system moves through each activity at once | Individual changes flow through independently |
| **What is fixed** | Scope is fixed and time floats | Time is fixed and scope floats |
| **When commitment happens** | Decisions locked early, before building | Decisions deferred until the last responsible moment |
| **Where authority sits** | Planning is done for the team by someone else | The team decides how to meet the goal |
| **How feedback arrives** | At a formal gate, from a reviewer | Continuously, from working software and its users |

The right position on each axis is a consequence of how expensive it is to be wrong. When correcting a mistake is cheap, deferring commitment and shrinking batches costs almost nothing and buys a lot of learning. When correcting a mistake means re-certifying a medical device or re-manufacturing a board, locking decisions early stops being bureaucracy and starts being arithmetic.

### Iterative and Incremental Are Not the Same Thing

These two words get used interchangeably and mean different things, which makes conversations about methodology confusing.

**Incremental** development delivers the system in pieces, each piece finished, adding up to the whole. Build the login flow, then the catalogue, then checkout. Each increment is complete and nothing gets revisited.

**Iterative** development builds a rough version of something and then refines it across passes. Build a crude version of the whole flow, then improve it, then improve it again.

Most methodologies described as "iterative" are actually both, and they need to be. Purely incremental development assumes the design was right the first time, because nothing goes back. Purely iterative development can refine forever without ever finishing a piece a user can have.

---

## The Agile Manifesto

The [Agile Manifesto](https://agilemanifesto.org/){:target="_blank" rel="noopener noreferrer"} was written in 2001 by seventeen practitioners who had each been developing lightweight alternatives to document-driven process. It is short, and its structure matters as much as its content. Each line names two things and says one is valued *more*, not that the other is worthless. The manifesto says so explicitly in its closing line, which is the part most often dropped in quotation.

**The four value statements:**
- **Individuals and interactions** over processes and tools
- **Working software** over comprehensive documentation
- **Customer collaboration** over contract negotiation
- **Responding to change** over following a plan

**The twelve principles** behind them are more prescriptive than the values and get quoted far less:

1. Satisfy the customer through early and continuous delivery of valuable software
2. Welcome changing requirements, even late in development
3. Deliver working software frequently, from a couple of weeks to a couple of months
4. Business people and developers work together daily
5. Build projects around motivated individuals and trust them to get the job done
6. Face-to-face conversation is the most effective way to convey information
7. Working software is the primary measure of progress
8. Sustainable development, maintained indefinitely
9. Continuous attention to technical excellence and good design
10. Simplicity, the art of maximizing the work not done
11. The best architectures, requirements and designs emerge from self-organizing teams
12. At regular intervals, the team reflects and adjusts its behavior accordingly

Principles 9 and 12 separate teams getting value from Agile from teams performing it. A team that welcomes changing requirements but neglects technical excellence accumulates a codebase that makes change progressively harder, which defeats the first principle by way of the ninth.

---

## Methodologies You Will Still Encounter

Three approaches predate the frameworks in common use, still appear in organizations and job descriptions, and each contributes an idea that outlived it.

### Spiral: Risk as the Driver

Barry Boehm described the spiral model in a [1986 paper](https://dl.acm.org/doi/10.1145/12944.12948){:target="_blank" rel="noopener noreferrer"} in *ACM SIGSOFT Software Engineering Notes*, republished in 1988 for a wider audience. Its organizing idea is that the next thing a project should do is resolve its largest remaining risk.

Each spiral passes through four activities. Determine objectives and constraints, identify and evaluate risks, develop and verify the next increment, then plan the next spiral with stakeholders. The cycle repeats, and each pass commits more resources than the last because each pass has removed uncertainty that justified holding back.

{% include figure.html id="sdlc-spiral" %}

What makes Spiral distinctive is that risk, not feature priority, sets the agenda. If the largest risk is that a third-party integration might not support the required throughput, the next spiral builds a prototype of that integration and nothing else. Most modern methodologies handle this with spikes and prototypes without making risk the organizing structure of the whole project.

Spiral suits projects where technical uncertainty is the dominant problem and the budget can absorb prototyping that produces no shippable output. It is heavy for anything small, and it depends on having people who can assess risk credibly, which is a scarcer skill than it sounds.

### Feature-Driven Development

Jeff De Luca devised FDD in 1997 for a 15-month, 50-person project at a large Singapore bank, drawing on Peter Coad's object-modelling work. It was first published in 1999 as a chapter of *Java Modeling in Color with UML*.

FDD organizes everything around a **feature**, defined narrowly as a small client-valued function expressible in the form "action, result, object", such as "calculate the total of a sale". Features are sized to be completable in two weeks or less, and most in days.

The method runs five processes. The first two happen once at the start: develop an overall domain model, then build the feature list from it. The last three repeat for every feature: plan by feature, design by feature, build by feature.

The distinctive mechanism is the **chief programmer**, an experienced developer who takes ownership of a small set of features and forms a temporary team around each one, drawing in the class owners whose code the feature touches. Code has individual owners rather than collective ownership, which is the clearest point of difference from XP.

FDD's appeal is progress tracking. Because features are small and numerous, percentage-complete is a count rather than an estimate, which is why it turns up in large organizations that need credible reporting. Its cost is that it requires a strong up-front domain model and experienced chief programmers.

### Crystal: Weight Scaled to Size and Criticality

Alistair Cockburn developed the Crystal family in the 1990s from a study of what actually distinguished successful projects. His conclusion was that no single process fits all projects, and that the two variables determining how much process a project needs are how many people must coordinate and how bad failure would be.

Crystal is therefore not one method but a family, indexed on two dimensions. **Colour** indicates team size, growing heavier as coordination cost grows.

| Variant | Team size |
| --- | --- |
| Crystal Clear | up to 6 |
| Crystal Yellow | up to 20 |
| Crystal Orange | up to 40 |
| Crystal Red | up to 80 |
| Crystal Maroon | up to 200 |

**Criticality** is the second dimension, and it is the one usually dropped when Crystal gets summarized. It classifies a project by what its failure would destroy, across four levels: Comfort (C), Discretionary money (D), Essential money (E), and Life (L). A six-person team building a life-critical system needs more rigour than a six-person team building an internal dashboard, and the colour alone does not capture that. Crystal Sapphire and Crystal Diamond are the variants for large projects carrying risk to human life.

Crystal's lasting contribution is less the family than the argument behind it. Process weight should be a deliberate choice justified by size and consequence, rather than a default inherited from whatever the organization did last.

Across the family, Cockburn identified properties that successful teams shared, including frequent delivery, reflective improvement, close communication, personal safety to speak up, focus, easy access to expert users, and a technical environment with automated testing and frequent integration.

---

## Scaling Beyond One Team

Every framework in common use was designed for a single team, and most of what they prescribe stops making sense past about ten people. Scaling frameworks exist to answer what happens when one product needs many teams. They differ mostly in how much structure they add, and the amount of structure a framework adds is also the amount of change it demands from the organization.

### SAFe

The [Scaled Agile Framework](https://framework.scaledagile.com/){:target="_blank" rel="noopener noreferrer"} is the most widely adopted and the heaviest. It organizes teams into an **Agile Release Train**, typically 50 to 125 people, all working to a synchronized cadence and planning together at a **PI Planning** event that brings the whole train together. Above the train sits a portfolio layer connecting funding and strategy to execution, and SAFe defines a large catalogue of roles, events, and artifacts across those layers.

SAFe's appeal to large enterprises is that it gives them something recognizable. It maps onto existing hierarchy, budgeting cycles and reporting structures, which makes adoption politically possible where a flatter framework would not be. That is also the substance of the criticism against it, since a framework that fits comfortably into the existing organization may not change much about how that organization actually works.

### LeSS

[Large-Scale Scrum](https://less.works/){:target="_blank" rel="noopener noreferrer"} takes the opposite approach. It scales Scrum by adding as little as possible and removing as much as it can. One Product Owner, one Product Backlog, one shared Sprint across all teams, and one integrated increment at the end of it. LeSS comes in two configurations: basic LeSS for up to eight teams, and LeSS Huge beyond that, which introduces Area Product Owners for distinct requirement areas.

LeSS asks more of an organization than SAFe does despite prescribing less, because most of its adoption effort goes into removing coordination roles and management layers rather than adding them. It suits product organizations with genuinely mature Scrum practice and leadership willing to restructure.

### Nexus

[Nexus](https://www.scrum.org/resources/scaling-scrum){:target="_blank" rel="noopener noreferrer"} is Scrum.org's framework, and it is deliberately minimal, aimed at three to nine teams working on one product. It adds a **Nexus Integration Team** accountable for the integrated increment, and extends the standard Scrum events with cross-team versions covering planning, a daily focused on integration issues, a review over the combined increment, and a retrospective.

Nexus concentrates on one problem, which is integration. Its premise is that the hard part of multiple teams on one product is that their work has to combine into something releasable, and that naming an accountability for it solves more than adding process layers does.

### Scrum@Scale

[Scrum@Scale](https://www.scrumatscale.com/){:target="_blank" rel="noopener noreferrer"}, from Jeff Sutherland, scales by repeating Scrum's own structure rather than by adding a new one. Teams form a Scrum of Scrums with its own Scrum Master, which can itself form a larger grouping, and the same recursion applies to Product Owners.

The framework separates two cycles that intersect at a few defined points. The **Scrum Master cycle** owns how work gets done, covering impediment removal, continuous improvement and cross-team coordination. The **Product Owner cycle** owns what gets built, covering strategic vision, backlog prioritization and release planning. Scrum@Scale is modular by design, so an organization adopts the components it needs rather than the whole thing.

### The Spotify Model

The "Spotify model" of squads, tribes, chapters and guilds came from a 2012 white paper by Henrik Kniberg and Anders Ivarsson describing how Spotify's engineering organization was structured at the time. It is the most copied of all of these, and it is the one to be most careful with.

Kniberg has stated publicly that he did not invent it and that it was never intended as a framework for others to adopt. It described a snapshot of practices that had emerged at one company at one size. Later accounts from inside Spotify, including a widely-read 2020 analysis by former employee Jeremiah Lee, argue the structure was partly aspirational even when it was published and did not survive the company's growth.

That does not make the ideas worthless. Aligning teams to durable missions rather than projects, and using chapters to maintain craft standards across team boundaries, are both sound. But they are ideas rather than a framework, and adopting the vocabulary without the conditions that produced it reliably produces an org chart with new names on it.

### Choosing Among Them

| Framework | Teams | Adds | Demands |
| --- | --- | --- | --- |
| **Nexus** | 3-9 | An integration accountability and cross-team events | Least, since it extends Scrum directly |
| **LeSS** | 2-8, or 8+ as LeSS Huge | Almost nothing, and removes instead | Structural change and mature Scrum |
| **Scrum@Scale** | Modular | Recursive Scrum of Scrums, two intersecting cycles | Component-by-component adoption |
| **SAFe** | 50-125 per train, plus portfolio layers | A large catalogue of roles, events and artifacts | Budget, executive sponsorship, long adoption horizon |

The honest starting position is that most organizations reaching for a scaling framework have a dependency problem rather than a coordination problem. Teams that need to coordinate constantly are usually teams whose boundaries were drawn against the system's seams rather than along them. A scaling framework manages that coordination cost, but redrawing the boundaries removes it, and that is generally the better trade where it is available.

---

## Choosing a Methodology

### What Actually Drives the Choice

Four factors carry most of the weight, and the rest are usually downstream of them.

**How stable the requirements are.** This is the dominant factor. Stable, well-understood requirements make sequential approaches viable and remove most of the value of short feedback loops. Genuinely uncertain requirements make up-front specification a guess dressed as a plan.

**What a wrong decision costs to reverse.** Cheap reversal argues for deferring commitment and small batches. Expensive reversal argues for resolving questions before building, which is the honest case for both Waterfall's phase gates and Spiral's risk-first cycles.

**Regulatory and contractual obligations.** Sequential, documentation-heavy approaches persist in regulated industries because evidence of a controlled process is itself a deliverable. This constrains the choice more than most teams expect, though less than most teams assume, since iterative work can produce the same evidence when the artifacts are planned for.

**What the team can actually do.** A team new to Agile usually does better with the structure Scrum provides than with the discipline Kanban assumes. A team without automated testing cannot run continuous delivery regardless of what it calls its process. Choosing a methodology the team cannot execute produces the ceremony without the benefit.

### Combinations That Work

Few teams run one methodology unmodified, and some combinations recur often enough to have names.

**Scrum with XP engineering practices** is the most common of all. Scrum defines how work is organized and prioritized but is deliberately silent on how code gets written, which leaves a gap that XP's practices fill directly. A large share of Scrum's reported failures are really the absence of engineering discipline that Scrum never claimed to supply.

**Kanban for operational work alongside iterative delivery for product work.** Support, maintenance and incident work arrives unpredictably and does not fit a planned iteration. Running it as a flow system with its own limits, separate from planned work, stops it from silently consuming a team's capacity.

**A fixed architectural phase followed by iterative implementation** suits situations where a structural decision must be settled before parallel work can start. This is honest when the decision genuinely is expensive to reverse, and is a way of smuggling Waterfall back in when it is not.

**Dual-track discovery and delivery** runs research and validation ahead of implementation as a parallel stream rather than a phase, so the delivery track always has validated work available.

### There Is No Best Methodology

The methodology that fits is a function of context, and the factors that matter are project characteristics, team capability, organizational culture, regulatory obligations, and what customers need. Teams that succeed tend to adapt a methodology to their situation rather than following one exactly. Teams that fail tend to do so in one of two ways: adopting a methodology's ceremonies without its underlying discipline, or abandoning a methodology at the first friction rather than at the first evidence it does not fit.

Start with the approach that fits the four factors above, then change it based on what retrospectives actually surface rather than on what the framework says should happen.
