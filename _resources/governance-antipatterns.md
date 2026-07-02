---
title: "Governance Anti-patterns"
layout: resource
type: reference
description: "Five common architecture governance anti-patterns — Governance Theater, Bottleneck Governance, Ivory Tower Architecture, Analysis Paralysis, and Inconsistent Enforcement — with warning signs and fixes for each."
last_updated: 2026-07-02
tags: [architecture, governance, organizational-design]
related_guides:
  - /study-guides/architecture/governance.html
---

| Anti-pattern | Problem | Signs | Solution |
| --- | --- | --- | --- |
| Governance Theater | Process exists but provides no real value, becomes a box-checking exercise | Reviews rubber-stamp every decision; no one reads ADRs after approval; standards exist but aren't enforced; teams bypass governance processes | Demonstrate value through examples; streamline processes; show metrics on prevented issues; make governance opt-in for low-risk changes |
| Bottleneck Governance | Governance team becomes a constraint on delivery velocity | Review backlog grows continuously; teams wait weeks for approvals; frustrated delivery teams; shadow IT emerges | Implement tiered review process; increase self-service options; distribute decision-making authority; add governance capacity |
| Ivory Tower Architecture | Governance team disconnected from implementation reality | Standards that don't work in practice; decisions made without team input; lack of recent hands-on experience; high variance request rate | Architects maintain hands-on involvement; rotate team members through architecture roles; solicit feedback on standards; pilot new standards before mandating |
| Analysis Paralysis | Over-analysis delays decisions indefinitely | Reviews take weeks or months; constant requests for more information; decisions reopened repeatedly; perfect solution sought | Set decision deadlines; use timeboxed spikes for unknowns; accept "good enough" decisions; document what's unknown and plan to learn |
| Inconsistent Enforcement | Standards enforced selectively, creating perceived unfairness | Some teams bypass governance; favoritism accusations; standards apply only to new projects; legacy systems exempt indefinitely | Apply standards consistently; document all variances transparently; create migration plans for legacy systems; regular audits of compliance |
