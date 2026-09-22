---
title: "SDLC Methodology Selection Guide"
layout: resource
type: reference
category: "SDLC"
description: "Decision matrix and selection questions for choosing a software development methodology (Waterfall, Scrum, Kanban, XP, Shape Up, Lean, DevOps, and others) by project characteristics."
last_updated: 2026-09-22
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

<div class="card-group">
<div class="content-card content-card--accent">
<h4>How stable are requirements?</h4>
<ul>
<li><strong>Very stable</strong> &middot; Waterfall</li>
<li><strong>Somewhat stable</strong> &middot; Scrum, Spiral</li>
<li><strong>Evolving</strong> &middot; Kanban, Lean, XP, Shape Up</li>
<li><strong>Unknown</strong> &middot; XP, Lean, Crystal, Shape Up</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>How important is time to market?</h4>
<ul>
<li><strong>Critical (weeks)</strong> &middot; Lean, XP, Kanban</li>
<li><strong>Important (6-week cycles)</strong> &middot; Shape Up</li>
<li><strong>Important (2-week cycles)</strong> &middot; Scrum, DevOps</li>
<li><strong>Flexible (6+ months)</strong> &middot; Waterfall, FDD, Spiral</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>What's the team size?</h4>
<ul>
<li><strong>1-3 people</strong> &middot; Shape Up, Crystal, XP, Kanban</li>
<li><strong>4-6 people</strong> &middot; Scrum, XP, Kanban, Shape Up</li>
<li><strong>7-12 people</strong> &middot; Scrum, XP, Lean</li>
<li><strong>13-40 people</strong> &middot; Scrum, FDD, Crystal</li>
<li><strong>40+ people</strong> &middot; FDD, Scaled Agile (SAFe)</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>What's the team's Agile experience?</h4>
<ul>
<li><strong>New to Agile</strong> &middot; Scrum (structure helps)</li>
<li><strong>Some experience</strong> &middot; Kanban, Lean, Shape Up</li>
<li><strong>Experienced</strong> &middot; XP, Crystal, Kanban, Shape Up</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>How critical is the system?</h4>
<ul>
<li><strong>Life-critical</strong> &middot; Spiral, Waterfall</li>
<li><strong>Business-critical</strong> &middot; Scrum, FDD, Shape Up</li>
<li><strong>Important</strong> &middot; Most Agile methods</li>
<li><strong>Low criticality</strong> &middot; Crystal, Kanban, Shape Up</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>How much customer involvement is feasible?</h4>
<ul>
<li><strong>Daily</strong> &middot; XP</li>
<li><strong>Weekly/bi-weekly</strong> &middot; Scrum</li>
<li><strong>Every 6 weeks</strong> &middot; Shape Up</li>
<li><strong>Monthly</strong> &middot; Lean, FDD</li>
<li><strong>Minimal</strong> &middot; Waterfall, Spiral</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>What's the regulatory environment?</h4>
<ul>
<li><strong>Heavy regulation</strong> &middot; Waterfall, Spiral (with documentation)</li>
<li><strong>Some regulation</strong> &middot; Scrum/Kanban with documentation</li>
<li><strong>Minimal regulation</strong> &middot; Any Agile method</li>
</ul>
</div>
</div>
