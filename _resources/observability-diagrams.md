---
title: "Observability Diagrams"
layout: resource
type: reference
category: "Observability"
description: "The diagrams behind the observability study guides: one checkout request's trace drawn as a waterfall of spans, how trace context crosses service boundaries and what happens when a hop drops it, a CPU flame graph showing which functions consume a service's processor time, how a multiwindow burn-rate alert fires and resets, and how agent and gateway Collectors route spans by trace ID for tail sampling."
last_updated: 2026-09-24
figures:
  - obs-trace-waterfall
  - obs-context-propagation
  - obs-flame-graph
  - obs-multiwindow-alert
  - obs-collector-topology
tags: [diagrams, distributed-tracing, trace-context, flame-graphs, error-budgets, burn-rate]
related_guides:
  - /study-guides/observability/observability-fundamentals.html
  - /study-guides/observability/slos-and-alerting.html
  - /study-guides/observability/observability-architecture.html
---
