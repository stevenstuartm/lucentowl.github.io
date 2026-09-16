---
layout: guide
title: "Architecture Risk Analysis"
category: Architecture
subcategory: Quality & Risk
description: "How to rate architectural risk with a risk matrix, assess risk across characteristics and parts of a system, and run collaborative risk storming sessions to identify and mitigate it."
tags: [architecture, risk-management, risk-storming, risk-matrix, practical]
---

## Risk Matrix

**Dimensions**:

1. Impact (Low=1, Medium=2, High=3)
2. Likelihood (Low=1, Medium=2, High=3)

**Score = Impact × Likelihood**

**Risk Levels**:

- 1-2: Low (green)
- 3-4: Medium (yellow)
- 6-9: High (red)

| Impact/Likelihood | Low (1) | Medium (2) | High (3) |
|-------------------|---------|------------|----------|
| **Low (1)** | 1 (green) | 2 (green) | 3 (yellow) |
| **Medium (2)** | 2 (green) | 4 (yellow) | 6 (red) |
| **High (3)** | 3 (yellow) | 6 (red) | 9 (red) |

## Risk Assessments

Use architecture characteristics as criteria. Create matrix of characteristics vs context (services, domains, areas).

**Benefits**: Considers criteria and context | Prioritizes effort | Filters noise | Tracks risk direction (△ ▽ ○)

## Risk Storming

Collaborative exercise to determine risk within specific dimension.

**Participants**: Architects + senior developers + tech leads

**Phase 1: Identification (Individual)**:

1. Facilitator sends diagram, criteria, logistics
2. Participants analyze independently using risk matrix
3. Write risk on colored sticky notes (green/yellow/red)

**Best Practice**: Single criterion or context per session

**Phase 2: Consensus (Collaborative)**:

1. Post large architecture diagram
2. Place sticky notes on diagram
3. Analyze and reach consensus
4. Consolidate notes
5. **Unproven/unknown tech = highest risk (9)**

**Phase 3: Mitigation (Collaborative)**:

1. Identify ways to reduce/eliminate risks
2. Involve business stakeholders (cost vs risk authority)
3. Present options with cost implications
4. Make trade-off decisions

**Bonus**: Apply to user-story risk in iterations
