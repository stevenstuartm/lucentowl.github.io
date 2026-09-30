---
title: "A Shape for Ridgeline's Claims System"
layout: exercise
category: "Architecture"
kind: architecture
world: ridgeline
description: "Choose an architecture style for a fictional insurer's new claims reporting system: extend the portal, build a modular monolith, split out intake, or deploy coarse services."
last_updated: 2026-09-29
tags: [practical, architecture-styles, style-selection, modular-monolith, service-based-architecture]
related_guides:
  - /study-guides/architecture/ArchitectureStyles.html
  - /study-guides/architecture/modular-monolith-architecture.html
  - /study-guides/architecture/service-based-architecture.html
  - /study-guides/architecture/distributed-computing.html
related_case_studies:
  - /case-studies/distributed-event-processing.html
figures:
  - rlc-claims-today
  - rlc-claims-context
  - rlc-claims-storm-load
  - rlc-claims-options
  - rlc-claims-storm-flow
---

## The Situation

Ridgeline Mutual is a regional insurer with about 120,000 policyholders. Every claim starts as a phone call today, and everyone who handles a claim works inside a CRM that Ridgeline rents rather than builds.

### How Claims Work Today

- **The CRM is a third-party product.** It's SaaS that runs in the vendor's cloud. Contact center agents, claims supervisors, and adjusters all use the vendor's own web screens in a browser, signed in with Ridgeline's corporate sign-in. There is no internal agent app.
- **Ridgeline can't touch the CRM's database.** Its own systems reach CRM data only through the CRM's REST API, which slows sharply under heavy load. The CRM can also call out to other systems with a webhook when a case is created or changed, but nothing uses that today.
- **A claim is a free-text case.** When a policyholder phones in a claim, an agent creates a case in the CRM and types what the caller says into its notes.
- **Triage is done by hand.** A claims supervisor reads the queue of new claim cases, judges each one's severity, and assigns it to an adjuster team.
- **Policyholders can check a claim online, but not report one.** Last year Ridgeline's portal team launched a self-service website where policyholders view their policies and documents, update their contact details, and check the status of an open claim. The website runs on the team's Portal API, which reads claim status from the CRM's API. When the portal was built, the company decided the Portal API would accept only policyholder sign-ins, so that customer accounts can never reach internal systems.

{% include figure.html id="rlc-claims-today" %}

On a normal day about 30 claims come in. Then last June a hailstorm brought about 4,800 claims in 72 hours. Hold times passed an hour, and the supervisors' triage queue took days to clear.

{% include figure.html id="rlc-claims-storm-load" %}

### What the Business Wants

Policyholders should be able to report claims themselves on the website, with photos, before the next storm season opens in April. That's seven months away. Agents will keep taking phoned-in claims in the CRM, where they already work, but claims operations will replace the free-text notes with a structured claim form, configured in the CRM without code. Either way, every claim should be triaged automatically, by the same rules.

The new claims system has four jobs:

- **Intake.** Accept a report from the website's new claim form, or a webhook from the CRM when an agent saves a new claim case.
- **Triage.** Score the claim's severity and pick the adjuster queue it belongs in.
- **Handoff.** Create the CRM case for a website report, or add severity and queue to the case an agent already created.
- **Notification.** Tell the policyholder by email or text that the claim was received and who will handle it.

{% include figure.html id="rlc-claims-context" %}

### What You Know

- **The team.** The portal team does the work: five developers, a QA engineer, and a tech lead. They ship every two weeks and will keep running the portal alongside the new system.
- **How they run production.** ASP.NET Core on App Service, Azure SQL, a deployment pipeline with a rehearsed rollback, availability alerts, and Application Insights logs. Nobody on the team has run a message broker or distributed tracing in production.
- **The triage rules will keep changing.** Claims operations has never seen claims reported online. It expects to revise the triage rules every week or two for the first six months while it learns what online reports look like.
- **Triage can't live in the CRM.** The CRM's assignment rules can route a case on one or two field values. Claims operations' triage weighs a dozen answers together, which those rules can't express.
- **Adjusters are being reorganized.** Claims operations is redesigning how adjuster teams are organized, and the queues triage routes to will change with it.
- **Retention.** Claim records and photos must be kept for seven years.
- **The CIO's question.** The CIO has asked whether this should be "our first microservice."

## The Decision

What architecture style should the claims system use?

## The Options

**A. Extend the portal.** Add the claims work to the existing Portal API: an endpoint for the website's claim form, an endpoint for the CRM's webhook, triage, and claims tables. Triage runs inside the request.

**B. A modular monolith.** Build a new claims application: one ASP.NET Core deployment on App Service with four modules (Intake, Triage, Handoff, Notification). Each module owns its own schema in one Azure SQL database. The website's claim form calls it with the policyholder's sign-in, and the CRM's webhook calls it directly. Intake saves the report and returns, and the other modules pick it up afterward in a background worker inside the same application.

**C. Split out intake.** Build a small Intake service that receives website reports and CRM webhooks and writes each one to an Azure Service Bus queue, and a claims application for triage, handoff, and notification that reads from the queue. That makes two deployments, connected by the queue.

**D. Coarse services.** Deploy Intake, Triage, Handoff, and Notification as four separate services, each with its own pipeline, all sharing one Azure SQL database.

{% include figure.html id="rlc-claims-options" %}

## Your Turn

Decide before you read the analysis. Write down three things:

1. The option you'd choose.
2. The fact from the situation that decided it. If another fact would have decided it the other way, name that one too.
3. The main risk you're accepting by choosing it.

<details class="exercise-analysis" markdown="1">
<summary>Show the analysis</summary>

## What Each Option Buys and Costs Here

| Option | Buys | Costs, in this situation |
| --- | --- | --- |
| **A. Extend the portal** | No new deployment. The website already calls the Portal API, and the team already runs it | The CRM's webhook would be the first caller the Portal API accepts that isn't a policyholder. Every triage rule change redeploys the website policyholders use for everything else, during storm season. Claims become a second domain, with their own data and seven-year retention, inside an API built to serve one website |
| **B. Modular monolith** | One deployment of the kind the team already runs, with its own boundary: policyholder sign-ins from the website and a verified webhook from the CRM. Module boundaries can move cheaply while triage rules and adjuster queues settle | A triage defect runs in the same process as intake, so it can take intake down with it. Every triage release redeploys intake |
| **C. Split out intake** | Intake keeps accepting reports and webhooks while triage is deployed or failing. The queue absorbs the storm burst | The team's first message broker in production, arriving with a storm-season deadline. The team would have to learn dead-letter handling and tracing a claim across two deployments, and would need both before April |
| **D. Coarse services** | Each service deploys on its own schedule | One team releases everything, so independent deployment unblocks nobody. The four services share one database, so they gain no data independence either. The boundaries around triage are still moving, and each move now crosses a deployment |

## The Recommendation: B, Under These Constraints

Build the modular monolith. Four facts from the situation decide it.

### One Team, No Release Contention

Distribution pays off when teams block each other's releases, and here one team ships everything on one cadence. Options C and D pay for independent deployment that no one needs yet.

### Boundaries Still Being Learned

Triage rules change every week or two, and the adjuster queues depend on a reorganization still in progress. A modular monolith lets the team move a boundary with a refactoring. With C or D, the same move is a change to a contract between deployments.

### Operations the Team Already Has

The team runs App Service, a pipeline, and a rollback it has rehearsed. Option B needs nothing more. C needs a broker and tracing the team has never operated, and it would need them live before the first storm.

### The CRM Is a Second Kind of Caller

This fact separates B from A, the close runner-up. Extending the portal is the cheapest start, but the CRM's webhook would be the first caller the Portal API ever accepted that isn't a policyholder. The Portal API is where every policyholder's data meets the internet, and keeping it policyholder-only was a deliberate decision. A new claims application sets its own boundary from the start, accepting policyholder sign-ins from the website and verified webhooks from the CRM and nothing else. It also keeps weekly triage releases from redeploying the whole website during storm season.

### How B Handles the Storm

Intake saves each report or webhook in a short transaction and answers right away. Triage, handoff, and notification run afterward in the same application. When 4,800 claims arrive in three days, both ways in stay fast while handoff to the CRM falls behind, and the CRM's throttling slows the handoff rather than the policyholder or the agent. An agent's case exists the moment the agent saves it, and its severity and queue follow once handoff catches up. App Service scales out for those days. Adjusters are the slowest step after triage anyway, so a handoff running minutes behind costs little.

{% include figure.html id="rlc-claims-storm-flow" %}

### The Risk You Accept

A triage defect can take down intake, because they share a process. The mitigations are ones the team already practices: the rehearsed rollback, and module boundaries that keep triage's code out of intake's path. If that risk is unacceptable, the next section names the fact that makes C the better choice.

## What Would Change the Answer

Each rejected option wins under a different, realistic version of this situation.

| Option | It becomes the right choice if |
| --- | --- |
| **A. Extend the portal** | Agent claims keep the supervisor's manual triage, so only website reports are triaged automatically, and claims operations settles its triage rules before launch. Then the claims work is one more policyholder feature: a form, a scoring rule that rarely changes, and a CRM write, with no second kind of caller. A new deployment would add cost for nothing |
| **C. Split out intake** | Ridgeline commits to a stricter availability target for reporting a claim during storm season than for anything else, say 99.99%, while triage rules ship weekly. Intake now has different operational needs from the rest, and a triage release or defect must never touch it. Containment is worth a second deployment and a broker |
| **D. Coarse services** | Claims operations gets its own development team to own the triage rules, and it needs to ship them on its own schedule while the portal team's releases hold it up. Teams blocked on each other's releases is the need coarse services meet |

## Common Traps

### Putting Triage Inside the CRM

Agents and adjusters already work in the CRM, so configuring triage there sounds like it avoids building anything. But the CRM's rules can't express the triage claims operations wants. Website reports would also have to become CRM cases the moment they're submitted, through the API that slows most at the storm's peak.

### Reading the Storm as a Case for Distribution

Fifty times the normal daily volume sounds like a reason for event-driven services. But the whole claims path spikes together, for a few days a year, and scaling out one deployment handles that. Distribution earns its cost when one part needs something the others don't. Nothing in this situation says one part does, unless the availability target in the C row applies.

### Treating the CIO's Question as a Requirement

"Our first microservice" is a preference, not a need. Test it against the needs that justify distribution: teams blocked on releases, parts with different operational needs, failures that must stay contained, and bursty load. If none applies, the honest answer to the CIO is "not this one, and here's what would change that."

### Weighing a Fact That Decides Nothing

Keeping claims and photos for seven years is a hard requirement, but every option meets it the same way. A constraint that every option satisfies equally doesn't help choose between them.

### Drawing Boundaries From an Org Chart in Motion

Splitting services along the new adjuster teams builds today's draft of the reorganization into deployment boundaries. When the reorganization changes, those boundaries have to move too.

</details>
