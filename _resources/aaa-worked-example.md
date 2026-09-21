---
title: "AAA Worked Example: Ridgeline Mutual's Portal"
layout: resource
type: reference
category: "SDLC"
description: "One fictional insurer's customer portal followed through Align, Agree, and Apply, with each deliverable filled in, including the assumption that failed and what it cost."
last_updated: 2026-09-21
figures:
  - rl-align-sketch
  - rl-agree-containers
  - rl-apply-deployment
figures_inline: true
tags: [aaa-cycle, project-charter, circuit-breakers, hill-charts, worked-example]
related_guides:
  - /study-guides/sdlc/aaa-cycle.html
  - /study-guides/sdlc/aaa-phase1-align.html
  - /study-guides/sdlc/aaa-phase2-agree.html
  - /study-guides/sdlc/aaa-phase3-apply.html
---

<div class="content-card content-card--accent artifact-card" markdown="1">

### The Project

Ridgeline Mutual is a fictional regional insurer. Most calls to its contact center come from policyholders asking things they could look up themselves: what their policy covers, where a document is, how a claim is going. The project is a self-service portal, and it has to be live before the Q4 renewal season, when calls peak.

The formats below are this team's choices, not the required form. AAA asks for the conversations and commitments, and each team records them its own way. Starting points: [Project Charter Template](/resources/project-charter-template.html), [ADR Template](/resources/adr-template.html).

</div>

<div class="card-group">
<div class="content-card content-card--accent">
<h4><a href="#align">1 · Align</a></h4>
<p>Ten days of discovery, a Medium risk tier, and a Go with one proof of concept named.</p>
</div>
<div class="content-card content-card--accent">
<h4><a href="#agree">2 · Agree</a></h4>
<p>Every open question closed: three containers, a separate customer sign-in, and a passing POC.</p>
</div>
<div class="content-card content-card--accent">
<h4><a href="#apply">3 · Apply</a></h4>
<p>One feature goes back to Agree. Launch slips two weeks, and three of four targets are met.</p>
</div>
</div>

<div class="phase-header" markdown="1">
<p class="phase-header__label">Phase 1 of 3</p>

## Align

The team spent ten days with stakeholders before committing to anything. They came out with a sketch full of open questions, a size, and a charter everyone signed.

</div>

{% include figure.html id="rl-align-sketch" %}

<div class="content-card artifact-card" markdown="1">

### Sizing

<p class="artifact-card__lead">Each domain rated on its own, then scope and novelty combined into one call.</p>

| Domain | Complexity | Why |
| --- | --- | --- |
| Customer sign-in | Average | Standard pattern, but no owner yet |
| CRM profile and claims | Average | Existing SaaS with a documented API |
| Policy documents | Complex | Source system not yet identified |
| Portal UI | Average | Three capabilities, web only |

| Input | Rating |
| --- | --- |
| Scope | Medium |
| Novelty | Unfamiliar: the team has never integrated with the on-premises Policy Admin System |
| Risk tier | **Medium** |
| Effort | 5-7 months, including 25% contingency, validated by the team |
| Constraint | Live before the Q4 renewal season, 7 months out |
| **Recommendation** | **Go**, with the documents integration named for a POC in Agree |

</div>

<div class="content-card artifact-card" markdown="1">

### Charter (excerpt)

<p class="artifact-card__lead">Four of the seven sections: the ones the rest of the project leans on.</p>

**Scope**

| In scope | Out of scope |
| --- | --- |
| Policyholder sign-in and profile management | Native mobile apps (web only) |
| Policy and document viewing | Languages other than English (future phase) |
| Claim status | Billing and payments (separate project) |
| Mobile-responsive web | |

**Success criteria**

| Type | Criterion | Target |
| --- | --- | --- |
| Business | Contact center call volume | -30% |
| User | Policyholders with an active account | 70% within 3 months |
| Technical | Availability | 99.9% |
| Technical | p95 page load | < 2 s |
| Timeline | Launch | End of Q3 |

**Risk register (top 3)**: tier **Medium** (scope medium, novelty unfamiliar)

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Documents system can't be reached from the cloud | M | H | POC in Agree | Lead architect |
| CRM API limits throttle the portal at renewal peak | M | M | Cache reads; ask vendor for a higher limit | Integration lead |
| Contact center staff distrust self-service and keep taking calls | L | H | Contact center lead on the steering group | Sponsor |

**Assumptions**

| ID | Assumption | Invalidated if |
| --- | --- | --- |
| A1 | The Policy Admin System can return documents by policy number | No lookup by policy number exists |
| A2 | The CRM API accepts profile updates from outside systems | Updates are agent-only |
| A3 | CRM claim cases carry a status a customer can understand | Statuses are internal codes |

**Approved by**: VP Customer Operations (sponsor), Head of IT, Contact Center Lead, Compliance Officer

</div>

<div class="phase-header" markdown="1">
<p class="phase-header__label">Phase 2 of 3</p>

## Agree

Agree closed every open question on the sketch. Each answer came from a decision record, a proof of concept, or a risk the team chose to accept with a named owner.

</div>

{% include figure.html id="rl-agree-containers" %}

<div class="content-card artifact-card" markdown="1">

### ADR-001: Separate Customer Identity from Agent SSO

<p class="artifact-card__lead">Sign-in was the first question closed, and the one that reached furthest.</p>

**Status**: Accepted

**Context**: Agents sign in through corporate SSO. Policyholders are 120,000 external accounts that need self-registration, password reset, and MFA, none of which the corporate directory is licensed or designed for.

**Decision**: We will run policyholder accounts in a separate customer identity service (Entra External ID), with the portal as its only application.

**Consequences**:
- **Pros**: Customer accounts can't reach internal systems. Self-registration and reset come built in. Licensing scales per active user.
- **Cons**: Agents can't impersonate a customer session to help on a call. A second identity service to operate.

**Compliance**: Security review confirms no portal route accepts a corporate token.

</div>

<div class="content-card artifact-card" markdown="1">

### Risk Catalog

<p class="artifact-card__lead">Each risk got a route: prove it now, or accept it with an owner and a trigger.</p>

| Risk | Quality attribute | Route |
| --- | --- | --- |
| Documents API latency breaks the 2 s page target | Performance | POC |
| CRM throttling at renewal peak | Availability | Accepted: 5-minute read cache, vendor limit increase requested. Owner: integration lead |
| Claim status meaning (A3) not checked | Correctness | Accepted: too costly to validate before build. Owner: contact center lead. Trigger: first claim status story |

</div>

<div class="content-card artifact-card" markdown="1">

### POC Result

<p class="artifact-card__lead">Five days to find out whether documents could be fetched fast enough.</p>

**Question**: Can the portal fetch a policy document by policy number fast enough?

**Time box**: 5 days, code thrown away.

**Finding**: Yes, over the Policy Admin System's SOAP document API. p95 is 1.4 s, so documents load after the page renders to hold the 2 s page target. A1 validated.

</div>

<div class="content-card artifact-card" markdown="1">

### SLOs

<p class="artifact-card__lead">What the team promised, and the tighter target it steers by.</p>

| SLI | SLO | Committed (SLA) |
| --- | --- | --- |
| Availability | 99.95% | 99.9% (43.8 min/month error budget) |
| p95 page load | < 1.5 s | < 2 s |
| p95 document retrieval | < 3 s | Not committed |

</div>

<div class="content-card artifact-card" markdown="1">

### Appetite and Limits

<p class="artifact-card__lead">Six months overall, and a time limit on every feature. These limits are what Apply's circuit breakers measure against.</p>

| Feature | Time limit | Rests on |
| --- | --- | --- |
| Sign-in and registration | 3 weeks | ADR-001 |
| Profile update | 2 weeks | A2 |
| Claim status | 3 weeks | A3 |
| Policy documents | 6 weeks | A1 |

</div>

<div class="phase-header" markdown="1">
<p class="phase-header__label">Phase 3 of 3</p>

## Apply

Two things went wrong during the build. Both were caught by something the team had set up in an earlier phase.

</div>

{% include figure.html id="rl-apply-deployment" %}

<div class="content-card artifact-card" markdown="1">

### Dependency Register (Month 3)

<p class="artifact-card__lead">The VPN is late, and the fallback was agreed before anyone needed it.</p>

| Dependency | Owner | Expected | Confidence | Status | Fallback |
| --- | --- | --- | --- | --- | --- |
| Site-to-site VPN to the head-office data center | Infrastructure team | Month 3, week 2 | Low | Delayed | Ship documents one sprint after launch behind a feature flag |
| CRM API limit increase | CRM vendor | Month 4 | Medium | On track | Lengthen the read cache to 15 minutes |
| UAT testers | Contact center | Month 5 | High | On track | Product team runs UAT scripts |

</div>

<div class="content-card artifact-card" markdown="1">

### The Claim Status Assumption Fails

<p class="artifact-card__lead">The first claim status story tests whether CRM statuses make sense to a customer. They don't.</p>

| Date | Feature | Breaker | What happened | Response | Agreed by |
| --- | --- | --- | --- | --- | --- |
| Month 3 | Claim status | Assumption A3 | CRM cases carry 14 internal status codes, most meaningless to a customer | Reshape | Sponsor |

</div>

<div class="content-card artifact-card" markdown="1">

### Change Decision: Claim Status Mapping

<p class="artifact-card__lead">The team brought the sponsor options, not a problem, and a recommendation.</p>

**Returns to**: Agree

**What we learned**: A3 was false. Showing raw CRM codes would generate the calls the portal exists to prevent.

**Gap**: About 3 weeks of work that was never planned.

| Option | Trade-off |
| --- | --- |
| Reduce scope | Launch without claim status and lose the largest call category |
| Extend timeline | Launch 2 weeks later, still ahead of renewal season |
| Accept quality risk | Show raw codes and expect confused calls |

**Recommendation**: Extend. Map the 14 codes to 5 customer-facing states in the Portal API, with the contact center lead owning the mapping table.

**Decision**: Agreed as recommended. Launch moves 2 weeks. Signed by the sponsor and contact center lead.

</div>

<div class="content-card artifact-card" markdown="1">

### Hill Chart (Month 4)

<p class="artifact-card__lead">A month after the reshape.</p>

| Scope | Position | Open unknowns |
| --- | --- | --- |
| Sign-in and registration | Downhill | None |
| Profile update | Downhill | None |
| Policy documents | Peak | None: ready to build once the VPN lands |
| Claim status | Uphill | Two codes with no agreed customer meaning |

**Summary**: We're uphill on claim status because two codes still have no agreed meaning. Policy documents are at the peak, ready to build once the VPN lands. Everything else is downhill.

</div>

<div class="content-card artifact-card" markdown="1">

### Delivery Acceptance (3 Months After Launch)

<p class="artifact-card__lead">Measured against the charter's success criteria, including the one that was missed.</p>

| Criterion | Target | Actual | Met |
| --- | --- | --- | --- |
| Contact center call volume | -30% | -34% | Yes |
| Active accounts | 70% | 64% | No: agents now invite callers during the call, reviewed next quarter |
| Availability | 99.9% | 99.96% | Yes |
| p95 page load | < 2 s | 1.3 s | Yes |
| Launch | End of Q3 | Q3 + 2 weeks | As renegotiated |

</div>

<div class="phase-header" markdown="1">
<p class="phase-header__label">Afterward</p>

## Looking Back

The claim status assumption was wrong, and it cost two weeks. It cost no more than that because it was written down in Align, given an owner and a trigger in Agree, and tested at that trigger in Apply. The missed adoption target stays recorded as missed, with a next step, instead of being rounded up.

</div>
