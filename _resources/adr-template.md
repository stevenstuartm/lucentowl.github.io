---
title: "Architecture Decision Record (ADR) Template"
layout: resource
type: code
category: "Architecture"
description: "A ready-to-use markdown template for documenting architecturally significant decisions, including status, context, consequences, and compliance tracking."
last_updated: 2026-07-02
tags: [architecture, decision-making, adrs, documentation]
related_guides:
  - /study-guides/architecture/architecture-decision-making.html
---

**Status values:** `Proposed` (under consideration) · `Accepted` (approved and in effect) · `Superseded` (replaced, with a link to the new ADR) · `RFC` (open for feedback until a deadline)

````markdown
# [Number]. [Title]

**Status**: [Proposed | Accepted | Superseded | RFC (deadline: YYYY-MM-DD)]

**Context**:
[Describe the situation, problem, and forces at play. What alternatives did you consider? What constraints exist?]

**Decision**:
We will [clear, specific statement of the decision].

[Justification: Why does this decision make sense given the context? What business value does it provide?]

**Consequences**:

**Pros**:
- [Benefit with specific metrics where possible]
- [Benefit]
- [Benefit]

**Cons**:
- [Trade-off or cost]
- [Trade-off or cost]
- [Trade-off or cost]

**Compliance**:
[How will adherence be measured? What tools or processes ensure compliance?]

**Notes**:
- Author: [Name]
- Date: [YYYY-MM-DD]
- Approved by: [Name/Role]
- Supersedes: [Link to previous ADR if applicable]
- Superseded by: [Link to newer ADR if applicable]
````
