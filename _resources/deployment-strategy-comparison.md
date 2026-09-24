---
title: "Deployment Strategy Comparison"
layout: resource
type: reference
category: "Infrastructure & Cloud"
description: "Recreate, rolling, blue-green, and canary deployment strategies compared by downtime, extra capacity, whether two versions run at once, blast radius, and rollback."
last_updated: 2026-09-24
tags: [deployment, blue-green, canary, rolling-deployment, reliability]
related_guides:
  - /study-guides/infrastructure/deployment-strategies.html
---

| Strategy | Downtime | Extra capacity | Two versions at once | Blast radius | Rollback |
| --- | --- | --- | --- | --- | --- |
| Recreate | Yes, during the switch | None | No | Everyone | Redeploy the old version, with more downtime |
| Rolling | None, with surge capacity | A small surge | Yes, during the rollout | Grows batch by batch | Roll the old version out again |
| Blue-green | None when requests drain and the switch is at the load balancer | A full second environment during the release | Briefly at the switch, and both share the database throughout | Everyone, at the switch | Switch back, fast, if the data allows it |
| Canary | None | From the canary instances up to a full second copy, depending on the platform | Yes, during the release | A chosen share, widened in steps | Send traffic back to the stable version |

Feature flags combine with any strategy, separating when code is deployed from when users see it. A/B tests split users to measure a business outcome, which makes them experiments rather than a way to roll out a release.
