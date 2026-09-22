---
title: "Team Architecture & Organization"
layout: guide
category: Software Development Lifecycle
subcategory: SDLC Fundamentals
description: "How team boundaries shape system boundaries, the four Team Topologies team types and the three interaction modes between them, cognitive load as the sizing constraint, aligning teams to bounded contexts, and the structures that reliably slow delivery down."
tags: [fundamentals, team-topologies, conways-law, cognitive-load, platform-teams, bounded-contexts]
---

## Why Team Structure Is an Architecture Decision

Melvin Conway's 1968 paper "How Do Committees Invent?" made a claim that has survived every change in technology since: organizations that design systems are constrained to produce designs that copy the communication structures of those organizations. Three teams that rarely speak will produce three components with awkward interfaces between them, whatever the architecture diagram says.

<blockquote class="pull-quote">
<p>Conway's Law is not a warning. It is a lever, and it points the other way from how most organizations use it.</p>
</blockquote>

Most teams meet Conway's Law as a complaint, an explanation for why the architecture ended up the way it did. The useful reading runs the other direction. If communication structure determines system structure, then choosing the communication structure is a way of choosing the system structure. That deliberate use has a name, the **inverse Conway maneuver**: decide what architecture you want, then organize teams so that architecture is the one that naturally emerges.

This works because it removes a fight rather than winning one. An architecture that cuts across team boundaries has to be defended continuously against the path of least resistance, and it loses slowly. An architecture that matches team boundaries is what happens when nobody is paying attention.

---

## Team Structure Patterns

### Feature Teams and Component Teams

The first structural choice is whether a team owns a slice of user-visible value or a technical layer.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Feature Teams</h4>
<p>Cross-functional teams organized around business features or customer-facing capabilities.</p>
<p><strong>Benefits:</strong> Faster delivery, reduced handoffs, clear ownership, better domain understanding.</p>
<p><strong>Challenges:</strong> Potential code duplication, maintaining consistency, unclear shared ownership.</p>
<p><strong>Best for:</strong> Product-focused orgs, microservices, distinct product areas.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Component Teams</h4>
<p>Teams organized around technical components or layers (UI, API, database).</p>
<p><strong>Benefits:</strong> Deep expertise, consistency within domains, efficient use of specialized skills.</p>
<p><strong>Challenges:</strong> Handoffs slow delivery, lack of end-to-end ownership, risk of bottlenecks.</p>
<p><strong>Best for:</strong> Legacy systems, specialized tech domains, platform teams.</p>
</div>
</div>

The decisive difference is how many teams a typical piece of work has to pass through. Component teams optimize for depth of expertise within a layer and pay for it at every boundary crossing, because almost nothing users want lives entirely inside one layer. A change to checkout touches the interface, the service and the data, so with component teams it becomes three pieces of work in three backlogs with three sets of priorities.

Component teams remain defensible where the component genuinely is the unit of work, which is most often true for platform and infrastructure, and in legacy systems where the specialist knowledge to change a subsystem safely sits with a few people.

Most organizations end up with a mixture: feature teams for product work, platform teams for shared capability, and occasionally a specialist team for a part that resists being spread around.

### Team Topologies

Matthew Skelton and Manuel Pais's *Team Topologies* (2019) sharpened this into a model with only four team types, on the argument that most organizational complexity is accidental. The four types matter less than the second half of the model, which is that only three kinds of interaction are allowed between them, and that every team should know which mode it is in with every other team it touches.

{% include figure.html id="sdlc-team-topologies" %}

**Stream-aligned teams** own a continuous flow of work for one slice of the business and deliver it end to end. This is meant to be the default, and most teams in a healthy organization should be one. The other three types exist to make stream-aligned teams viable.

**Platform teams** provide internal products that stream-aligned teams consume for themselves. The test of a platform team is whether adoption is voluntary. A platform other teams choose because it is easier than the alternative is a platform; a platform teams must route through is a gate, and it will behave like one.

**Enabling teams** close a capability gap in another team, then leave. Their output is the other team's improved ability rather than any artifact of their own, and an enabling team that becomes permanent has quietly turned into either a platform team or a bottleneck.

**Complicated-subsystem teams** own a part that needs deep specialist knowledge, such as a pricing engine or a video codec. This is the type to be most sceptical about, because "this is too complicated for a normal team" is also what an unnecessary silo says about itself.

### The Three Interaction Modes

The interaction modes are the part most often skipped when Team Topologies gets summarized, and they carry most of the model's practical value.

| Mode | What it means | Expected duration |
| --- | --- | --- |
| **Collaboration** | Two teams work closely, with high communication, while something is still being discovered | Temporary, and its end is the goal |
| **X-as-a-Service** | One team consumes something the other provides, with minimal conversation | Long-running and stable |
| **Facilitating** | One team helps another become capable of something, without doing it for them | Temporary |

Collaboration is expensive, and naming it as a mode makes that visible. Two teams in permanent collaboration are not collaborating, they are one team with a reporting line through the middle, and the usual fix is to redraw the boundary or to turn the relationship into a service.

The failure this model is built to catch is a team that is in an undeclared mode. A platform team that believes it is providing X-as-a-Service while its consumers believe they are in collaboration will be permanently disappointed in each other, because one side has staffed for occasional support questions and the other expects a partner.

### Cognitive Load Is the Sizing Constraint

Underneath the team types sits the idea that does most of the work: a team can only hold so much in its head, and that limit, not headcount, is what determines how much of a system a team can own.

Cognitive load comes in three kinds, and only one of them earns its place. The load of the problem domain itself is what you want the team spending its capacity on. The load of the tools and mechanics of doing the work is waste to be removed, and it is exactly what a platform team exists to absorb. The load of holding an unfamiliar or badly-structured system in mind is what accumulates when a team owns more than it can model.

This reframes several common questions. "Can this team take on one more service?" is really "does this team already have more than it can hold?" A team that owns eight services none of its members can explain has a cognitive load problem that adding a ninth will not improve and hiring a tenth member may not either.

---

## Aligning Teams to Domain Boundaries

If team boundaries are going to determine system boundaries, the question becomes where to draw them. Domain-driven design's **bounded context**, a boundary within which one domain model applies consistently, is the most useful answer, because it is defined by where the language changes rather than by the org chart.

A "customer" means something different to billing than it does to support, and the point at which the word changes meaning is a natural seam. Teams drawn along those seams coordinate rarely, because the things that change together are inside one boundary.

### This Applies Inside a Monolith

Aligning teams to domains does not require distributed services, and treating it as a microservices practice is a common and expensive mistake.

Inside a single codebase, each domain can expose an internal interface that other domains call, rather than reaching into its tables. An e-commerce monolith can have catalogue, order, payment and shipping domains, each with an owning team, each reachable only through its own interface. Nothing is deployed separately and the boundaries are as strong as the team discipline that maintains them.

The benefit is immediate rather than deferred. Teams can change their own domain without coordinating, because callers depend on an interface rather than on a schema. That these boundaries also make later extraction possible is a bonus, not the reason to do it.

### What Ownership Has to Include

Ownership only produces the benefits above when it covers the whole lifecycle. A team that owns a domain's code but not its operation will optimize for shipping rather than for running, because nothing in its experience connects the two.

Meaningful ownership means the team owns the code, the data, the deployment, and the pager. It means the team decides how its domain works internally without asking. And it means the team carries the consequences of its own decisions, which is the mechanism that makes the other two safe to grant.

---

## Scaling Team Structures

What changes with organizational size is not the principles but which problem is dominant.

**One to three teams.** Coordination is cheap and mostly happens by people talking. The structure to invest in is ownership, so that it is clear who decides what. Formal process at this size costs more than it returns.

**Four to ten teams.** Nobody can hold the whole system in mind any more, and interfaces between teams stop being obvious. This is where platform teams start to earn their keep, because the same infrastructure work is now being done several times in parallel. It is also where architectural decisions need a home, since "whoever is in the room" stops producing consistent answers.

**Ten or more teams.** Dependencies between teams become the main constraint on delivery, ahead of anything happening inside a team. The work shifts to reducing the need for coordination rather than managing it better, through self-service platforms, clear domain boundaries, and decision rights explicit enough that teams do not have to ask.

### Team Size

Amazon's two-pizza rule, that a team should be small enough to feed with two pizzas, is the best-known heuristic and usually cited as around six to ten people. The number matters less than the reason behind it, which is that communication paths grow quadratically with team size. Five people have ten pairs to keep in sync, and ten people have forty-five.

When a team outgrows that, splitting it along a domain boundary preserves the property that made it work. Splitting it by technical layer replaces one team's internal communication with two teams' coordination overhead, which is the more expensive kind.

---

## Structures That Slow Delivery

Four patterns recur, and each looks locally reasonable to the people inside it.

**The knowledge silo.** Critical knowledge sits with one person or a small group, so work queues behind their availability and their absence is an outage. The forces that produce it are efficiency arguments, since the person who knows the area is genuinely the fastest at changing it. Pairing, rotation and review spread the knowledge at a short-term cost that is smaller than the queue.

**The bottleneck team.** Every other team waits on one team, usually a central platform, database or security group that must approve or perform something. Adding capacity to the bottleneck rarely fixes it, because demand grows to meet supply. What fixes it is removing the team from the path, by turning approvals into self-service with automated policy, or by delegating the decision along with the standard for making it.

**The ivory tower.** Architects decide without building, and the decisions degrade in quality because the feedback that would correct them never reaches them. What breaks this is architects spending time in the code, reviewing changes, and building proofs of concept, so that a decision that does not survive contact with the implementation is discovered by the person who made it.

**Competing teams.** Teams optimize for their own metrics at the expense of the system, duplicating work or working at cross purposes. This is nearly always an incentive problem rather than an attitude problem. Teams measured on their own throughput will protect their own throughput, and the correction is at the level of what gets measured and rewarded rather than at the level of asking people to collaborate more.

---

## What Holds

Team structure is a design decision with the same weight as any architectural one, and it should be revisited on the same terms.

Team boundaries become system boundaries whether or not anyone chose them, so choose them. Size teams by how much they can hold rather than by headcount, and move work off them rather than adding people when they are full. Make every team's interaction with every other team one of three named modes, and treat a permanent collaboration as a boundary in the wrong place. Give ownership that includes operation, because ownership without consequences produces different decisions. And expect the right structure to change, since an arrangement that fits four teams will not fit fourteen.
