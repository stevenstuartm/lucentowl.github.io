---
title: "Architecture Style Comparison"
layout: resource
type: reference
category: "Architecture"
description: "Nine software architecture styles compared by type, core strength, primary tradeoff, and typical use cases, from layered monoliths to space-based architecture."
last_updated: 2026-09-15
tags: [architecture, design-patterns, distributed-systems, microservices, monolithic]
related_guides:
  - /study-guides/architecture/ArchitectureStyles.html
  - /study-guides/architecture/layered-architecture.html
  - /study-guides/architecture/pipeline-architecture.html
  - /study-guides/architecture/microkernel-architecture.html
  - /study-guides/architecture/modular-monolith-architecture.html
  - /study-guides/architecture/service-based-architecture.html
  - /study-guides/architecture/event-driven-architecture.html
  - /study-guides/architecture/microservices-architecture.html
  - /study-guides/architecture/soa-architecture.html
  - /study-guides/architecture/space-based-architecture.html
---

| Style | Type | Core Strength | Primary Tradeoff | Typical Use Cases |
| --- | --- | --- | --- | --- |
| Layered | Monolith | Simplicity, fast initial development | Limited scalability, tight coupling | Small apps, MVPs, prototypes, tight budgets |
| Pipeline | Monolith | Clear data flow, composable filters | Limited to sequential processing | ETL, data transformation, build systems |
| Microkernel | Monolith | Customization without core changes | Core becomes bottleneck at scale | Product platforms, plug-in systems |
| Modular Monolith | Monolith | Domain autonomy with simple deployment | Discipline required to maintain boundaries | Domain-driven teams, new systems, tight budgets |
| Service-Based | Distributed | Pragmatic distributed benefits | Coarse services limit fine-grained scaling | Mid-complexity domains, pragmatic teams |
| Event-Driven | Distributed | Responsiveness, decoupling | Complex debugging, eventual consistency | Variable workflows, reactive systems |
| Microservices | Distributed | Maximum evolvability and independence | Operational complexity, eventual consistency | Large systems, mature DevOps teams |
| SOA | Distributed | Legacy integration | Tight coupling through ESB | Enterprise integration scenarios |
| Space-Based | Distributed | Extreme elasticity | Memory limits, eventual consistency | Variable unpredictable load spikes |
