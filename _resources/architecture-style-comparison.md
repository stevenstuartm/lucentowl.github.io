---
title: "Architecture Style Comparison"
layout: resource
type: reference
category: "Architecture"
description: "Nine software architecture styles compared by type, core strength, primary tradeoff, and typical use cases, from layered monoliths to space-based architecture."
last_updated: 2026-07-02
tags: [architecture, design-patterns, distributed-systems, microservices, monolithic]
related_guides:
  - /study-guides/architecture/ArchitectureStyles.html
---

| Style | Type | Core Strength | Primary Tradeoff | Typical Use Cases |
| --- | --- | --- | --- | --- |
| [Layered](/study-guides/architecture/layered-architecture.html) | Monolith | Simplicity, fast initial development | Limited scalability, tight coupling | Small apps, MVPs, prototypes, tight budgets |
| [Pipeline](/study-guides/architecture/pipeline-architecture.html) | Monolith | Clear data flow, composable filters | Limited to sequential processing | ETL, data transformation, build systems |
| [Microkernel](/study-guides/architecture/microkernel-architecture.html) | Monolith | Customization without core changes | Core becomes bottleneck at scale | Product platforms, plug-in systems |
| [Modular Monolith](/study-guides/architecture/modular-monolith-architecture.html) | Monolith | Domain autonomy with simple deployment | Discipline required to maintain boundaries | Domain-driven teams, new systems, tight budgets |
| [Service-Based](/study-guides/architecture/service-based-architecture.html) | Distributed | Pragmatic distributed benefits | Coarse services limit fine-grained scaling | Mid-complexity domains, pragmatic teams |
| [Event-Driven](/study-guides/architecture/event-driven-architecture.html) | Distributed | Responsiveness, decoupling | Complex debugging, eventual consistency | Variable workflows, reactive systems |
| [Microservices](/study-guides/architecture/microservices-architecture.html) | Distributed | Maximum evolvability and independence | Operational complexity, eventual consistency | Large systems, mature DevOps teams |
| [SOA](/study-guides/architecture/soa-architecture.html) | Distributed | Legacy integration | Tight coupling through ESB | Enterprise integration scenarios |
| [Space-Based](/study-guides/architecture/space-based-architecture.html) | Distributed | Extreme elasticity | Memory limits, eventual consistency | Variable unpredictable load spikes |
