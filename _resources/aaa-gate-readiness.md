---
title: "AAA Gate Readiness"
layout: resource
type: cheatsheet
category: "SDLC"
description: "The questions that show whether each AAA gate is genuinely ready, with the signals that usually accompany a yes: leaving Align, leaving Agree, releasing, and accepting delivery."
last_updated: 2026-09-21
tags: [aaa-cycle, readiness, stakeholder-management, delivery, sign-off]
related_guides:
  - /study-guides/sdlc/aaa-phase1-align.html
  - /study-guides/sdlc/aaa-phase2-agree.html
  - /study-guides/sdlc/aaa-phase3-apply.html
---

A signed artifact doesn't prove agreement. Each gate's questions are the test. The signals under them usually come with a genuine yes, but ticking them doesn't produce one.

<div class="content-card content-card--accent gate-card" markdown="1">

## Align → Agree

<div class="callout callout--note" markdown="1">
<p class="callout__title">The test</p>

Can each stakeholder explain the purpose and success criteria without the charter? Do they describe the project consistently? If 20% of scope had to go, would they agree on what to cut? Are they engaging, or signing to move things along?

</div>

**Signals**

- [ ] Project charter is signed by all key stakeholders
- [ ] Stakeholders can explain the project in their own words
- [ ] Success criteria are measurable and agreed (not vague or conflicting)
- [ ] Constraints are documented and acknowledged
- [ ] Key risks are identified with owners and mitigation strategies
- [ ] Budget and resources have firm commitment (not "we'll figure it out")
- [ ] Decision rights are clear (who decides what)
- [ ] No stakeholder is withholding concerns or planning to revisit decisions later

</div>

<div class="content-card content-card--accent gate-card" markdown="1">

## Agree → Apply

<div class="callout callout--note" markdown="1">
<p class="callout__title">The test</p>

Can stakeholders explain the architecture and why it was chosen? Can the team walk through the plan and defend the estimates? Asked for the biggest risks, do stakeholders and team give the same answers?

</div>

**Signals**

- [ ] Architecture design is documented and approved
- [ ] Key design decisions are captured in ADRs
- [ ] Architecture risks, sensitivity points, and tradeoff points are cataloged, with named owners for anything accepted rather than resolved
- [ ] Critical technical assumptions are validated (POC complete if needed)
- [ ] Quality and testing strategy is defined
- [ ] SLOs are established with stakeholder buy-in
- [ ] Implementation plan exists with realistic estimates (team-validated)
- [ ] Budget is formally committed
- [ ] Team genuinely believes in the approach
- [ ] Stakeholders agree with each other (conflicts resolved)
- [ ] Dependencies are identified with contingency plans

</div>

<div class="content-card content-card--accent gate-card" markdown="1">

## Ready for Release

**Signals**

- [ ] All acceptance criteria met
- [ ] Test coverage targets achieved
- [ ] No critical or high-severity bugs
- [ ] Security scan passed
- [ ] Performance meets SLOs
- [ ] UAT completed and approved
- [ ] Rollback plan tested

</div>

<div class="content-card content-card--accent gate-card" markdown="1">

## Delivery Acceptance

**Signals**

- [ ] All must-have requirements implemented
- [ ] Acceptance criteria met and validated
- [ ] SLOs being met in production
- [ ] Documentation complete
- [ ] Operations team trained and ready, with runbooks and an on-call rotation
- [ ] Stakeholders satisfied and delivery signed off

</div>
