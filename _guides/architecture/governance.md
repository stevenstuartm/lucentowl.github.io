---
title: "Architecture Governance"
layout: guide
category: Architecture
subcategory: Governance
description: "How organizations decide who makes which architecture decisions and keep those decisions aligned: governance principles, decision rights at each scope, centralized, federated, community, and advice-process models, must/should/may standards, variance management, routing changes to the right level of review, and signs that governance has become theater or a bottleneck."
tags: [practical, governance, decision-rights, architecture-review-board, advice-process, variance-management, standards]
---

Architecture governance is the set of decision rights, standards, and feedback loops an organization uses to keep architecture decisions aligned with its goals. It answers three questions. Who is allowed to make which decisions? What constraints do those decisions have to respect? How does the organization find out whether decisions are working, and change course when they aren't?

Every organization with more than one team has governance, whether or not it's written down. Without deliberate governance, decision rights default to whoever is most senior, most persistent, or first to commit code, and standards live in the heads of a few people. Deliberate governance makes those things explicit so they can be examined and improved. Done badly, it becomes a queue of approvals that slows every team without preventing the problems it was meant to catch. The difference lies mostly in how it's designed.

## Principles

### Explain the Reason Behind Every Standard

A standard stated without its rationale gets followed where it doesn't fit and ignored where it does, because nobody can judge which case they're in. "Services must not share a database" is a rule. "Services must not share a database, because a shared schema couples their release schedules and hides who owns the data" lets a team recognize both when the rule protects them and when an exception might be justified. Standards with a stated reason are also easier to retire, since it's clear when the reason no longer applies.

### Enable Before Enforcing

Teams follow the path that's easiest. When the approved way to build a service is also the fastest way, through templates, shared libraries, reference implementations, and pipelines with the right checks already in them, most teams comply without being asked. This is sometimes called a paved road. Enforcement then matters only for the few cases where the easy path doesn't apply, and automated checks catch many of those without anyone scheduling a review.

### Make Decisions Visible

Decisions recorded where everyone can read them, typically as architecture decision records, let teams learn from each other's reasoning, discover decisions that affect them, and avoid reopening questions that were settled for good reasons. Visibility also makes governance itself accountable, since a pattern of decisions made without consultation or variances granted inconsistently becomes apparent.

### Scale Rigor to Risk

A change to a payment flow and a change to an internal reporting script don't deserve the same scrutiny. Governance that reviews both the same way either slows low-risk work for nothing or waves high-risk work through. The level of review should follow from how much damage a wrong decision could do, how hard it would be to reverse, and how many teams it affects.

### Push Decisions to Where the Knowledge Is

The people closest to a problem usually understand its constraints best, and the people furthest from it are best placed to see effects across teams. Good governance assigns each decision to the level that holds the knowledge it needs, and keeps central decisions for the questions that genuinely span teams, such as shared platforms, cross-cutting security, and data that several domains depend on.

## Decision Rights

Governance becomes concrete when it states who decides what at each scope. The scopes nest, and a decision belongs to the smallest scope that contains all of its consequences.

| Scope | Typical decisions | Decides | Consulted |
|---|---|---|---|
| **Enterprise** | Cloud providers, identity platform, enterprise-wide security and data standards | Chief architect or architecture leadership, often with executive sponsors | Domain architects, security, finance |
| **Domain or portfolio** | Integration patterns between systems in a domain, shared data ownership, domain-level technology choices | Domain or enterprise architects | Solution architects and teams in the domain |
| **Solution** | Architecture style of one system, service boundaries, choice of datastore | Solution architect or lead engineer | Teams building it, owners of systems it integrates with |
| **Team** | Internal design, libraries, code structure within a service | The team | Anyone whose interfaces are affected |

A decision that looks local can reach further than it seems. Choosing a new message broker for one service is a team decision until other services need to consume its events, at which point it has become a domain decision. The consequences decide the scope, not the org chart position of the person proposing the change.

## Governance Models

Organizations distribute decision rights in a few recognizable ways. Most real organizations combine them.

| Model | How decisions are made | Strengths | Weaknesses | Fits |
|---|---|---|---|---|
| **Centralized** | A central architecture group makes significant decisions and approves others | Consistency, clear accountability | Becomes a bottleneck, loses domain context as the organization grows | Small organizations, early platforms, heavily regulated systems |
| **Federated** | Domain architects decide within their domains, and a central group coordinates standards that span domains | Scales with the organization, keeps decisions near domain knowledge | Inconsistency between domains, coordination overhead | Large organizations with distinct business domains |
| **Community-led** | Communities of practice, sometimes called guilds, develop standards and recommendations collaboratively | Strong buy-in, standards grounded in practice | Slow to converge, recommendations may lack authority | Organizations with strong engineering culture and mature teams |
| **Advice process** | Anyone may make an architecture decision after seeking advice from those affected and those with expertise | Fast, decentralized, and still informed | Depends on people actually seeking and weighing advice, and on trust | Organizations moving away from review boards toward team autonomy |

### The Advice Process

Andrew Harmel-Law's advice process takes decentralization furthest. Anyone can make an architecture decision, provided they first seek advice from two groups, the people meaningfully affected by it and people with relevant expertise. The decision-maker doesn't have to follow the advice, but has to seek it and record it, usually in the decision record alongside the options considered.

Four supporting practices keep it from turning into every team doing as it pleases. Decision records make each decision and the advice behind it visible. A regular architecture advisory forum gives teams a place to present proposed decisions and hear advice, but it has no power to approve or block them. Team-sourced architecture principles give decisions a shared basis. An internal technology radar shows which technologies are being adopted, trialed, or retired.

The advice process moves accountability onto the person deciding rather than onto a board that approved the decision. That shift is the point, and also the risk. It works where people take the consultation seriously, and it degrades into unilateral decisions with a paper trail where they don't.

### Combining Models

A common combination keeps a small set of non-negotiable standards centralized, such as security, regulatory compliance, and a handful of platform choices. Communities of practice develop recommendations in their areas, and teams make everything else through an advice process or federated decision rights. Each model covers the decisions it handles best, and the organization states which model applies to which kind of decision.

## Standards

### Must, Should, and May

Standards carry different weights, and blurring them makes all of them weaker. The keywords defined in RFC 2119 for specifications work well here.

| Weight | Meaning | Examples |
|---|---|---|
| **Must** | Required, with deviation only through a formal variance | Encryption of personal data at rest, authentication through the identity platform, regulatory audit logging |
| **Should** | The default, and deviating requires a documented reason but not approval | Preferred datastores, standard observability libraries, recommended architecture patterns |
| **May** | Guidance teams can adopt or ignore | Coding conventions beyond the linter, suggested tools, documentation templates |

A long list of musts is a warning sign. Each one needs enforcement, a variance process, and periodic review, and a standard that nobody enforces teaches teams that the whole list is optional. Keeping musts few, and moving everything else to should or may, gives the musts their weight back.

Each standard also needs an owner, a stated scope, and a date for review. Standards without owners outlive the technology and constraints they were written for.

### Verifying Compliance

Checks that can be automated belong in the delivery pipeline, where they run on every change without anyone scheduling them. Dependency and license scanning, infrastructure policy checks, and rules about which components may depend on which all fall in this group. Manual review remains for what automation can't judge, such as whether a design fits the problem, whether trade-offs were weighed, and whether risks were identified.

## Variance Management

No standard fits every situation, and a governance model without a way to deviate forces teams to choose between compliance that harms their system and quiet non-compliance. A variance process makes deviation explicit:

1. **Request.** The team states which standard it wants to deviate from, why the standard doesn't fit, and what it proposes instead.
2. **Assess.** Reviewers evaluate the risk of the deviation and whether a mitigation reduces it enough.
3. **Decide.** The variance is granted, granted with conditions, or declined, with the reasoning recorded.
4. **Record.** The variance is visible to others, so teams in similar situations can find it.
5. **Expire.** Variances carry an end date or a review date, after which the team either complies or renews the case.

Variances are also data about the standards. When many teams request variances from the same standard, the standard is more likely wrong than all of those teams. A governance group that tracks variance requests by standard learns where its standards need revising.

## Architecture Review

### Routing Changes to the Right Level

Reviewing every change centrally doesn't scale, and reviewing none leaves cross-team risks unseen. Routing each proposed change to a level of review proportional to its risk handles both.

```
                    Proposed architecture change
                                 │
                                 ▼
             Uses approved patterns and technology,
             and its consequences stay within one team?
                 │ yes                          │ no
                 ▼                              ▼
       ┌───────────────────┐    Crosses team or system boundaries,
       │ Self-service      │    introduces new technology, or affects
       │ Automated checks, │    security, compliance, or shared data?
       │ team records the  │         │ no                    │ yes
       │ decision          │         ▼                       ▼
       └───────────────────┘  ┌──────────────────┐  ┌──────────────────────┐
                              │ Peer review      │  │ Board-level review   │
                              │ Another team or  │  │ Review board, or     │
                              │ community of     │  │ broad advice from    │
                              │ practice reviews │  │ affected teams and   │
                              │ the design       │  │ experts              │
                              └──────────────────┘  └──────────────────────┘
```

The routing criteria should be published, so teams can place their own changes and nobody has to ask whether a review is needed. Irreversibility deserves extra weight. A decision that would be expensive to undo, such as a datastore choice or a public API contract, merits more scrutiny than a larger change that could be rolled back in a day.

### The Architecture Review Board

An architecture review board (ARB) is a standing group that reviews significant decisions, grants variances from mandatory standards, resolves conflicts between teams, and maintains the standards themselves. Its members usually include senior architects from different domains, security, and experienced engineers who still work on delivery teams, since a board made only of people who no longer build systems tends to produce standards that don't work in practice.

The most common complaint about review boards is that they review too late. A design reviewed after it's built can only be approved or sent back for expensive rework. Boards that ask for a short written proposal early, while options are still open, and that read it before meeting rather than hearing it presented for the first time, spend their time on the discussion that improves the decision.

### What a Review Examines

A review is most useful when it concentrates on what the team proposing the change is least placed to see for itself:

- **Fit with goals and characteristics.** Does the design deliver the architectural characteristics the system needs, and does it support the business outcome that justified the work?
- **Effects beyond the team.** Which other systems, teams, or shared data does it touch, and have their owners been consulted?
- **Risk and reversibility.** What could go wrong, how much damage would it do, and how hard would the decision be to undo?
- **Operability.** Can it be monitored, supported, and recovered when it fails, and by whom?
- **Consistency.** Does it follow existing standards, and if not, is there a variance with a good reason?

The team usually knows its own design's internals better than any reviewer. Reviews that re-derive internal design choices the team is better placed to make slow the process without adding much.

## Measuring Whether Governance Works

Governance costs time, so it needs evidence that it earns that time. Several signals indicate whether it does:

- **Time to decision.** How long a change waits between asking for review and getting an answer. Growth here is the first sign of a bottleneck.
- **Variance rate by standard.** Standards that attract frequent variances need revisiting.
- **Bypass.** Teams building around governance, through unreviewed services or unapproved technology, signals that the formal path is too slow or too far from their needs.
- **Issues caught.** Problems identified in review that would otherwise have reached production, such as a missed data ownership conflict or a security gap.
- **Repeated incidents.** Production incidents whose root cause was a decision governance should have caught point to review criteria that miss something.

## Common Pitfalls

- **Governance theater.** Reviews that approve everything, standards nobody enforces, and records nobody reads. The process exists and prevents nothing. Cut the reviews that never change an outcome, and put the time into the ones that do.
- **The bottleneck.** Every change waits for a central group whose backlog keeps growing, and teams start routing around it. Tier the reviews, publish routing criteria, and push decisions outward.
- **The ivory tower.** Standards written by people who no longer build systems don't survive contact with delivery. Keep reviewers involved in real delivery work, pilot standards before mandating them, and treat variance requests as feedback.
- **Analysis paralysis.** Reviews that keep requesting more information and reopening settled decisions. Set decision deadlines, use time-boxed spikes for unknowns, and record what's still uncertain rather than waiting for certainty.
- **Inconsistent enforcement.** Some teams are held to standards and others aren't, often legacy systems or favored projects. Apply standards evenly, record every variance, and give legacy systems a migration plan rather than a permanent exemption.
- **Too many musts.** Every mandatory standard needs enforcement and a variance path. A long list dilutes all of them.

## Quick Reference

| Element | Purpose | Keeps it healthy |
|---|---|---|
| **Principles** | Explain reasons, enable before enforcing, make decisions visible, scale rigor to risk, decide near the knowledge | Revisit when decisions keep going against them |
| **Decision rights** | State who decides at enterprise, domain, solution, and team scope | Assign by the reach of consequences, not by seniority |
| **Governance model** | Centralized, federated, community-led, advice process, or a stated combination | Say which model applies to which kind of decision |
| **Standards** | Must, should, and may, each with a reason, owner, scope, and review date | Keep musts few and enforced |
| **Variances** | A visible, expiring path to deviate from a standard | Track variance rate per standard to find standards that are wrong |
| **Review routing** | Self-service, peer review, or board-level review by risk and reach | Publish criteria, weight irreversibility, review early |
| **Measurement** | Time to decision, variance rate, bypass, issues caught | Act on the bottleneck and bypass signals first |
