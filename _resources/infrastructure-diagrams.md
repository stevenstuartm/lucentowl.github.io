---
title: "Infrastructure Diagrams"
layout: resource
type: reference
category: "Infrastructure & Cloud"
description: "The diagrams behind the infrastructure as code and cloud operations study guides: how an IaC tool compares code, state, and live resources to produce a reviewed plan, how a change reaches servers when they are patched in place versus replaced from a new image, why two runs against one state need a lock, how separating a rule breaks a dependency cycle, how pipeline delivery differs from GitOps reconciliation, which layers each developer environment model shares, which governance controls each path a change takes passes through, how traffic moves to a new version under each deployment strategy, and where RTO and RPO sit around a disaster."
last_updated: 2026-09-24
figures:
  - infra-plan-apply-loop
  - infra-mutable-immutable
  - infra-state-lock
  - infra-dependency-cycle
  - infra-push-pull-delivery
  - infra-dev-env-models
  - infra-control-placement
  - infra-deploy-traffic-shift
  - infra-rto-rpo-timeline
tags: [diagrams, iac, plan-apply, desired-state]
related_guides:
  - /study-guides/infrastructure/iac-fundamentals.html
  - /study-guides/infrastructure/iac-state-management.html
  - /study-guides/infrastructure/iac-implementation-patterns.html
  - /study-guides/infrastructure/iac-environment-lifecycle.html
  - /study-guides/infrastructure/iac-governance.html
  - /study-guides/infrastructure/deployment-strategies.html
  - /study-guides/infrastructure/disaster-recovery-patterns.html
---
