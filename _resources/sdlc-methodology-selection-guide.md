---
title: "SDLC Methodology Selection Guide"
layout: resource
type: reference
category: "Software Development Lifecycle"
description: "Decision matrix and selection questions for choosing a software development methodology (Waterfall, Scrum, Kanban, XP, Shape Up, Lean, DevOps, and others) by project characteristics."
last_updated: 2026-07-02
tags: [sdlc, methodology, agile, decision-making]
related_guides:
  - /study-guides/sdlc/sdlc-methodologies.html
---

## Project Characteristics Matrix

| Project Type | Best Methodology | Alternative | Why |
| --- | --- | --- | --- |
| Well-defined requirements, regulatory | Waterfall | Spiral | Stability suits sequential approach |
| Software products, frequent feedback | Scrum | XP | Structure with agility |
| SaaS products, meaningful completion | Shape Up | Scrum | 6-week cycles enable complete features |
| Maintenance, varied requests | Kanban | Lean | Continuous flow handles variability |
| High-quality code focus | XP | Scrum + engineering practices | Engineering practices are core |
| Resource-constrained, MVP focus | Lean | Kanban | Waste elimination maximizes value |
| Complex, high-risk systems | Spiral | Waterfall | Risk management is paramount |
| Continuous deployment focus | DevOps | Scrum + DevOps | Deployment automation is key |
| Large teams, feature tracking | FDD | Scrum | Scales to large teams |
| Small teams, low criticality | Crystal | Scrum | Lightweight suits context |
| Breaking feature factory pattern | Shape Up | Lean | Appetite-based planning eliminates backlog churn |

## Selection Questions

**How stable are requirements?**
- Very stable: Waterfall
- Somewhat stable: Scrum, Spiral
- Evolving: Kanban, Lean, XP, Shape Up
- Unknown: XP, Lean, Crystal, Shape Up

**How important is time to market?**
- Critical (weeks): Lean, XP, Kanban
- Important (6-week cycles): Shape Up
- Important (2-week cycles): Scrum, DevOps
- Flexible (6+ months): Waterfall, FDD, Spiral

**What's the team size?**
- 1-3 people: Shape Up, Crystal, XP, Kanban
- 4-6 people: Scrum, XP, Kanban, Shape Up
- 7-12 people: Scrum, XP, Lean
- 13-40 people: Scrum, FDD, Crystal
- 40+ people: FDD, Scaled Agile (SAFe)

**What's the team's Agile experience?**
- New to Agile: Scrum (structure helps)
- Some experience: Kanban, Lean, Shape Up
- Experienced: XP, Crystal, Kanban, Shape Up

**How critical is the system?**
- Life-critical: Spiral, Waterfall
- Business-critical: Scrum, FDD, Shape Up
- Important: Most Agile methods
- Low criticality: Crystal, Kanban, Shape Up

**How much customer involvement is feasible?**
- Daily: XP
- Weekly/bi-weekly: Scrum
- Every 6 weeks: Shape Up
- Monthly: Lean, FDD
- Minimal: Waterfall, Spiral

**What's the regulatory environment?**
- Heavy regulation: Waterfall, Spiral (with documentation)
- Some regulation: Scrum/Kanban with documentation
- Minimal regulation: Any Agile method
