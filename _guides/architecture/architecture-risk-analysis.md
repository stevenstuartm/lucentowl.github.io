---
layout: guide
title: "Architecture Risk Analysis"
category: Architecture
subcategory: Quality & Risk
description: "Finding and prioritizing the places an architecture is likely to fail its characteristics: rating risk with an impact-and-likelihood matrix, summarizing it across characteristics and domain areas in a risk assessment, running a risk storming session through identification, consensus, and mitigation, and applying the same matrix to story risk."
tags: [practical, risk-storming, risk-matrix, risk-assessment, risk-management, architecture-characteristics]
---

An architecture risk is a chance that the structure of a system fails to deliver something it has to deliver, such as the availability of the ordering service at peak, the integrity of payment data, or the ability to scale a new product line. It differs from project risk, which is about schedule and budget, although the two often share causes. Architecture risk analysis turns a vague unease about a design into a ranked list of specific risks tied to specific parts of the system, which is what makes them possible to mitigate or consciously accept.

The techniques here come from Mark Richards and Neal Ford's *Fundamentals of Software Architecture*, which builds on Simon Brown's risk-storming technique. They share one idea. A risk rated by one person from one perspective misses what others see, so ratings should use a common scale and come from several people looking at the same diagram.

## Rating a Risk

### The Risk Matrix

A risk matrix rates a risk on two dimensions, each scored low (1), medium (2), or high (3):

- **Impact**: how bad the outcome is if the risk occurs
- **Likelihood**: how probable it is that the risk occurs

Multiplying them gives a score from 1 to 9, which falls into one of three bands.

| Impact \ Likelihood | Low (1) | Medium (2) | High (3) |
|---|---|---|---|
| **Low (1)** | 1, low | 2, low | 3, medium |
| **Medium (2)** | 2, low | 4, medium | 6, high |
| **High (3)** | 3, medium | 6, high | 9, high |

| Score | Band | Usual color |
|---|---|---|
| 1-2 | Low | Green |
| 3-4 | Medium | Yellow |
| 6-9 | High | Red |

The score can't be 5, 7, or 8, so the jump from 4 to 6 separates medium from high cleanly. Consider the case of an order service that writes to a single database instance with no replica. If the database fails, customers can't place orders, so impact is high (3). The database has run for two years without an outage, but it has no failover, so likelihood is medium (2). The score is 6, a high risk.

Richards and Ford recommend rating impact before likelihood. Impact is usually easier to agree on, because it follows from what the component does for the business, while likelihood depends on judgments about load, failure rates, and history that people disagree about. Settling impact first anchors the discussion on the part that's less contested.

### When the Matrix Doesn't Apply

Likelihood can only be estimated for things the team understands. A technology nobody on the team has run in production, or a component whose behavior under load is unknown, has a likelihood nobody can rate honestly. Richards and Ford's rule is to give unproven or unknown technology the highest score, 9, rather than guessing. The rating pushes the unknown to the top of the list, where the natural mitigation is to learn more through a prototype, a load test, or advice from someone who has used it.

### What the Numbers Can and Can't Do

A risk matrix is a communication tool, not a measurement. The ratings are subjective, three levels per dimension are coarse, and two risks with the same score can differ widely in how much they matter. Its value is that everyone rates on the same scale, disagreements become visible as different numbers rather than different adjectives, and risks across unrelated parts of the system can be compared and ranked. Reading more precision into the score than that, such as averaging ratings or treating a 6 as twice as bad as a 3, overstates what a three-point scale can express.

## Risk Assessments

A risk assessment summarizes risk across a whole architecture. It is a table with architecture characteristics as rows, such as scalability, availability, and security, and parts of the system as columns, such as domain areas or services. Each cell holds the risk score for that characteristic in that part.

| Characteristic | Catalog | Ordering | Payments | Notifications | Total |
|---|---|---|---|---|---|
| **Scalability** | 2 | 6 | 3 | 1 | 12 |
| **Availability** | 3 | 6 | 9 | 2 | 20 |
| **Performance** | 4 | 4 | 2 | 1 | 11 |
| **Security** | 1 | 2 | 6 | 1 | 10 |
| **Data integrity** | 1 | 6 | 6 | 2 | 15 |
| **Total** | 11 | 24 | 26 | 7 | |

Reading across a row shows where one characteristic is weak, such as availability being a concern in three of the four areas. Reading down a column shows which part of the system carries the most risk. The totals give a quick ranking, but they can also hide a problem, since one 9 surrounded by low scores produces a modest total. The high cells deserve attention on their own, whatever the totals say.

Two adjustments make an assessment easier to act on:

- **Filtering.** Showing only high risks, or only one characteristic, keeps a large assessment from burying the few cells that matter. An assessment presented to business stakeholders often works better with low risks hidden entirely.
- **Direction.** Risk changes over time, so an assessment is repeated, and each cell can show whether risk has risen, fallen, or held since the last one. A payments availability risk that dropped from 9 to 6 after adding a second payment provider shows the mitigation worked, and a catalog performance risk that rose from 2 to 4 flags a trend before it becomes high.

The characteristics in the rows should be the ones the architecture was designed to deliver, not a generic list. An assessment that rates characteristics nobody prioritized produces scores nobody acts on.

## Risk Storming

Risk storming is a collaborative exercise that produces the ratings a risk assessment summarizes. Simon Brown created the technique, and Richards and Ford describe it in three phases.

| Phase | Mode | Outcome |
|---|---|---|
| **Identification** | Individual, before the session | Each participant's own list of risks, rated and placed on the diagram |
| **Consensus** | Collaborative | One agreed set of risks and ratings |
| **Mitigation** | Collaborative, with business stakeholders | Chosen responses to the high risks, with their costs |

### Participants and Scope

Architects alone see the risks visible from the architecture diagram. Senior developers and tech leads add risks visible only from the implementation, such as a library with known performance problems, an integration that fails more than its documentation suggests, or a component nobody currently understands. Including them widens what gets found, and it also builds shared ownership of the architecture among the people who implement it.

Each session covers one dimension of risk, such as availability, scalability, security, data loss, or unproven technology. Rating every characteristic at once spreads attention thin and mixes discussions that need different expertise. Several short focused sessions tend to find more than one broad one.

### Identification

The facilitator sends participants the architecture diagram, the dimension being analyzed, and the session logistics ahead of time. The diagram should be at a level where risks can be pinned to specific parts, which usually means a diagram showing the system's deployable applications, services, and data stores and how they connect.

Each participant then works alone, rating risks with the matrix and writing each one on a sticky note in the band's color, with the score on the note. Working individually matters. In an open discussion the first confident voice tends to anchor everyone else's ratings, and risks that only a quiet participant noticed may never be raised.

### Consensus

At the session, participants place their notes on a large shared copy of the diagram, next to the part each risk applies to. The collaborative work is in the disagreements.

- **Different scores for the same area.** One person rating an area 2 and another rating it 9 usually means one of them knows something the other doesn't. Discussing why brings out the missing information, such as a failover that exists but isn't on the diagram, or a load pattern only one person has seen.
- **A risk only one person identified.** Simon Brown's guidance is to look at these closely, since a risk nobody else spotted may reflect specialist knowledge rather than a mistake.
- **Areas with no notes.** An area nobody flagged might be low risk, or might be an area nobody understands well enough to rate.

The group consolidates the notes into one set of agreed ratings. That set feeds the risk assessment.

```
                    ┌──────────────────┐
                    │  API gateway     │
                    └────────┬─────────┘
               ┌─────────────┴──────────────┐
               ▼                            ▼
      ┌──────────────────┐         ┌──────────────────┐
      │  Order service   │────────▶│ Payment service  │
      └────────┬─────────┘         └────────┬─────────┘
               │                            │
               ▼                            ▼
      ┌──────────────────┐         ┌──────────────────┐
      │ Orders database  │         │ Payment provider │
      │ (single instance)│         │ (one vendor)     │
      └──────────────────┘         └──────────────────┘
   [6] no replica or failover     [9] no fallback provider,
                                      outage stops checkout
```

Placed on the diagram, the agreed availability risks show at a glance that checkout depends on two single points of failure.

### Mitigation

Mitigation looks for changes that reduce the impact or likelihood of each high risk, and prices them. Responses fall into a few kinds:

- **Change the architecture**, such as adding a database replica or a second payment provider, which lowers likelihood or impact directly.
- **Learn more**, through a prototype, a load test, or training, which is the usual response to unproven technology and often turns a 9 into an accurate lower rating.
- **Accept the risk**, deliberately and on record, when mitigation costs more than the risk is worth.
- **Transfer the risk**, for example to a managed service with a contractual availability commitment, while recognizing that the impact on customers remains yours.

Business stakeholders belong in this phase, because the decision is a trade-off between cost and risk, and they own both the budget and the consequences. Presenting options with their costs, such as a replica costing a fixed amount per month that lowers the orders database risk from 6 to 2, gives them something they can decide on. Presenting only the risk invites either a blanket "fix it" or a blanket "not now." After changes are made, rerunning the exercise on the updated diagram confirms whether the ratings actually dropped.

## Story Risk

The same matrix works outside architecture reviews. During backlog refinement, a team can rate each user story's risk of not being completed in the iteration, with impact describing the cost to the release if it slips and likelihood the chance that it does. High-risk stories get split, scheduled early, or given a spike, instead of surfacing as a surprise at the end of the iteration.

## Common Pitfalls

- **Rating likelihood for unknowns.** A confident "medium" on technology nobody has used hides the real risk. Rate it 9 and learn more.
- **Storming every characteristic at once.** Sessions lose focus, and discussions that need different people collide. One dimension per session.
- **Group identification.** Rating risks together from the start anchors everyone to the first opinion voiced. Identify individually first.
- **Treating scores as precise.** Averaging ratings or ranking by small differences in totals reads a three-point scale as a measurement.
- **Letting totals hide a 9.** A column total can look moderate while one cell is critical.
- **Assessing once.** Risk shifts as load, teams, and the system change. Repeat the assessment and track direction.
- **Mitigation without costs or stakeholders.** Architects deciding alone which risks to accept are making business decisions without the business.

## Quick Reference

| Technique | Input | Output | When |
|---|---|---|---|
| **Risk matrix** | One risk | Impact × likelihood score, 1 to 9, in a low, medium, or high band | Any time a risk needs rating |
| **Risk assessment** | Ratings per characteristic and system area | A table of risk across the architecture, with totals and direction | Periodically, and for stakeholder reporting |
| **Risk storming** | An architecture diagram and one risk dimension | Agreed ratings placed on the diagram, and chosen mitigations | Before major design decisions, and after significant changes |
| **Story risk** | A user story | A risk score for not completing it | Backlog refinement |
