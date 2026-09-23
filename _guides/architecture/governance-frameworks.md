---
title: "Architecture Governance Frameworks"
layout: guide
category: Architecture
subcategory: Governance
description: "What enterprise architecture frameworks actually provide and when they fit: methods, taxonomies, review frameworks, and IT management frameworks compared, TOGAF's Architecture Development Method and content, the Zachman Framework as a classification scheme, COBIT, ITIL, and DoDAF in context, and how to adopt a framework without creating bureaucracy."
tags: [practical, togaf, zachman-framework, enterprise-architecture, cobit, governance]
---

An architecture framework is a published body of practice for describing, developing, or governing architecture across an organization. Frameworks promise a shared vocabulary, a repeatable process, and the assurance that nothing important was forgotten. They also have a reputation for producing documents nobody reads. Both reputations are earned, and which one a framework lives up to depends mostly on whether the organization adopted it to solve a specific problem or to appear thorough.

## Kinds of Framework

Frameworks that get compared as alternatives often do different jobs. Choosing between them starts with knowing which job each does.

| Kind | Answers | Examples |
|---|---|---|
| **Architecture method** | How do we develop and govern architecture, step by step? | TOGAF's Architecture Development Method |
| **Taxonomy** | What descriptions of the enterprise exist, and how are they organized? | Zachman Framework |
| **Architecture review framework** | Is this workload designed well for a given platform? | AWS Well-Architected, Azure Well-Architected |
| **IT governance and management** | How is IT governed, controlled, and audited as a whole? | COBIT |
| **Service management** | How are IT services and products delivered and supported? | ITIL |
| **Domain-specific** | What must architecture descriptions contain in this sector? | DoDAF for US defense |

These combine more often than they compete. An organization might use TOGAF's method to run its architecture practice, ArchiMate to model, cloud well-architected reviews for individual workloads, and COBIT because its auditors expect it.

## TOGAF

[The TOGAF Standard](https://www.opengroup.org/togaf){:target="_blank" rel="noopener noreferrer"}, from The Open Group, is the enterprise architecture framework its publisher describes as the most widely used. Its current version, the 10th Edition, was released in April 2022. It is split into Fundamental Content, which holds the core concepts and method, and Series Guides, which advise on applying them in particular settings such as agile delivery, digital transformation, or security architecture. The split reflects that the framework is meant to be configured for each organization rather than followed whole.

### The Architecture Development Method

TOGAF's core is the Architecture Development Method (ADM), an iterative cycle for developing and changing an enterprise's architecture. A Preliminary phase establishes the architecture capability itself. Eight phases, labeled A through H, then form the cycle, and Requirements Management sits at the center, feeding requirements into every phase and capturing new ones from each.

{% include figure.html id="des-togaf-adm" %}

| Phase | Purpose |
|---|---|
| **Preliminary** | Set up the architecture capability, including principles, tools, and governance |
| **A. Architecture Vision** | Define scope, stakeholders, and the target vision, and get approval to proceed |
| **B. Business Architecture** | Describe the baseline and target business architecture, and the gaps |
| **C. Information Systems Architectures** | Do the same for data and application architecture |
| **D. Technology Architecture** | Do the same for the technology platform |
| **E. Opportunities and Solutions** | Group the gaps into work packages and transition architectures |
| **F. Migration Planning** | Sequence and cost the transition into an implementation roadmap |
| **G. Implementation Governance** | Oversee implementation projects for conformance with the architecture |
| **H. Architecture Change Management** | Monitor changes in business and technology, and decide when a new cycle is needed |
| **Requirements Management** | Maintain requirements continuously across every phase |

The cycle doesn't have to run end to end for every initiative. TOGAF expects phases to be iterated and scoped to the problem, so a single initiative might iterate through B to D several times before moving on, and an organization with a stable architecture practice may spend most of its time in G and H.

### Beyond the Method

TOGAF also defines what an architecture practice produces and where it keeps it. The **Architecture Content Framework** describes the work products, such as catalogs, matrices, and diagrams, and a metamodel relating the elements they describe. The **Enterprise Continuum** classifies architecture assets from generic reference models down to organization-specific architectures, which helps teams reuse rather than re-create. The **Architecture Repository** is where those assets, standards, and governance records live. TOGAF's guidance on **architecture governance** covers an Architecture Board, compliance reviews against the architecture during implementation, and dispensations for justified deviations.

### When TOGAF Fits

TOGAF fits organizations that have to coordinate architecture across many business units, systems, and years, particularly during a large transformation such as a merger, a move off a legacy estate, or a restructuring of how the business operates. Its common vocabulary helps when architects across a large organization, or across partner firms, need to work from the same concepts. Certification also means many enterprise architects already know it.

It fits poorly where no dedicated enterprise architecture function exists to run it, or where the problem is local to a few teams. Running the full ADM for a product organization of a few teams produces documentation overhead far out of proportion to the coordination it saves.

## The Zachman Framework

John Zachman introduced his framework in the *IBM Systems Journal* in 1987, and its current version is 3.0. It is an ontology, a classification scheme for the descriptions of an enterprise, not a method for producing them. It arranges those descriptions in a six-by-six grid.

The **columns** are six interrogatives, each a different aspect of the enterprise:

| Interrogative | Aspect in version 3.0 | Describes |
|---|---|---|
| **What** | Inventory sets | Things the enterprise holds information about |
| **How** | Process flows | Transformations the enterprise performs |
| **Where** | Distribution networks | Locations and the connections between them |
| **Who** | Responsibility assignments | Roles and the work assigned to them |
| **When** | Timing cycles | Events and schedules |
| **Why** | Motivation intentions | Goals, strategies, and the means to reach them |

The **rows** are six perspectives, from the most abstract to the running enterprise: executive, business management, architect, engineer, technician, and the enterprise itself. Each cell is the description of one aspect from one perspective. The intersection of What and the executive perspective is a list of the things that matter to the business. The intersection of What and the engineer perspective is a physical data model.

The grid's value is in the gaps it reveals. Mapping an organization's existing documentation onto it shows, for example, detailed physical data models with no business-level description of what the data means, or process descriptions with no statement of why the processes exist. It says nothing about how to fill the gaps, in what order, or how to govern changes, which is why organizations using Zachman usually pair it with a method. Trying to fill every cell for the whole enterprise is a well-known way to spend years producing documents that are out of date before they're finished.

## Other Frameworks

**COBIT**, from ISACA, is a framework for governance and management of enterprise IT as a whole. Its current version, COBIT 2019, defines governance and management objectives and design factors for tailoring them to an organization. It is oriented toward control, risk, and audit, which makes it common in regulated industries and in organizations whose auditors assess IT against it. It governs IT broadly rather than prescribing how to develop an architecture.

**ITIL**, now owned by PeopleCert, is a body of practice for IT service and product management, covering how services are designed, delivered, supported, and improved. ITIL (Version 5), released in 2026, succeeds ITIL 4 and brings product and service management into one scheme. Architecture work touches ITIL where services are handed to operations, through change enablement, service levels, and incident and problem management.

**DoDAF**, the US Department of Defense Architecture Framework, prescribes the viewpoints and models that defense architecture descriptions must contain. Version 2.02 remains the current version. The Unified Architecture Framework (UAF), an Object Management Group standard, includes a crosswalk from DoDAF views and is positioned as its eventual successor.

**Cloud well-architected frameworks** from AWS, Microsoft, and Google are review frameworks for individual workloads on their platforms, organized as pillars such as reliability, security, cost, operational excellence, and performance efficiency. AWS's framework adds sustainability as a sixth pillar. They answer whether one workload follows a provider's guidance, not how an enterprise governs architecture across workloads, so they sit alongside the frameworks above rather than in place of them.

## Choosing and Adopting a Framework

### Start From the Problem

The most useful selection criterion is the problem the organization is trying to solve, not its size or the framework's reputation.

| Problem | What tends to help |
|---|---|
| Teams make inconsistent technology and design choices | A lightweight governance model with published principles and standards, before any framework |
| A large transformation spans many business units and years | TOGAF's ADM, tailored to the transformation's scope |
| Nobody can tell what architecture documentation exists or what's missing | Zachman as a classification of what exists, used to find gaps |
| Auditors and regulators assess IT controls | COBIT, often alongside an architecture method |
| Workloads on one cloud have recurring reliability, security, or cost problems | That provider's well-architected reviews |
| Defense or government contracts require specific architecture descriptions | The mandated framework, such as DoDAF |

Several of these problems don't need a framework at all. A small organization with inconsistent designs usually gets more from a clear set of principles, decision records, and a lightweight review process than from adopting TOGAF.

### Tailor Rather Than Install

Frameworks are written to cover every organization that might use them, so no single organization needs all of one. Adoption goes better when it starts from the parts that address the problem at hand and grows only as those parts prove useful:

- **Adopt vocabulary first.** Shared terms for phases, artifacts, and viewpoints help even before any process changes.
- **Produce only artifacts someone uses.** Each document the framework describes should have a reader and a decision it informs, or it doesn't get written.
- **Fit the cadence to delivery.** Architecture work that runs on a separate, slower cycle from the teams building systems ends up describing systems that have already changed.
- **Assign an owner.** A framework without people who maintain its repository, standards, and reviews decays into outdated templates.
- **Measure the outcome.** Track whether the problem that justified adoption is improving, such as fewer conflicting designs, faster integration, or audit findings closed, rather than counting artifacts produced.

## Common Pitfalls

- **Adopting a framework to look mature.** Without a specific problem to solve, adoption tends to produce artifacts instead of better decisions.
- **Running TOGAF by the book.** The full ADM applied to every initiative creates overhead that teams route around. Scope each cycle to its problem.
- **Treating Zachman as a method.** It classifies descriptions and says nothing about producing them. Pair it with a method, or use it only to find gaps.
- **Filling every cell.** Complete coverage of an enterprise in any framework takes longer than the enterprise stays still.
- **Architecture on a separate cycle from delivery.** Documents describe a target the delivered systems have already diverged from.
- **Confusing review frameworks with governance.** A well-architected review assesses one workload. It doesn't decide who owns cross-system decisions.

## Quick Reference

| Framework | Kind | Current version | Best used for |
|---|---|---|---|
| **TOGAF** | Architecture method and content framework | 10th Edition (2022) | Coordinating architecture across a large enterprise or transformation |
| **Zachman** | Taxonomy of enterprise descriptions | 3.0 | Classifying existing documentation and finding gaps |
| **COBIT** | IT governance and management | COBIT 2019 | Control, risk, and audit of enterprise IT |
| **ITIL** | Service and product management | Version 5 (2026) | Delivering and supporting IT services |
| **DoDAF** | Domain-specific architecture framework | 2.02, with UAF as its successor | US defense architecture descriptions |
| **Cloud well-architected** | Workload review framework | Maintained continuously by each provider | Reviewing individual workloads on one cloud |
