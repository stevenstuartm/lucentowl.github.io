---
title: "DDD Context Mapping Patterns"
layout: resource
type: reference
description: "The eight standard relationship patterns between bounded contexts in Domain-Driven Design, with when to use each."
last_updated: 2026-07-02
tags: [architecture, domain-driven-design, design-patterns, microservices]
related_guides:
  - /study-guides/architecture/domain-driven-design.html
---

Context mapping defines relationships between bounded contexts, making integration strategy explicit.

| Pattern | Description | Use When |
| --- | --- | --- |
| Partnership | Two contexts cooperate, teams coordinate closely | Contexts must succeed or fail together |
| Shared Kernel | Two contexts share a small common model | Teams trust each other, shared model is small and stable |
| Customer-Supplier | Upstream context provides services to downstream | Clear customer relationship, negotiated contracts |
| Conformist | Downstream conforms to upstream model | No leverage to influence upstream |
| Anti-Corruption Layer (ACL) | Downstream translates upstream model to its own | Protect domain model from external system's model |
| Open Host Service | Upstream provides protocol for any downstream to use | Multiple consumers, stable public API |
| Published Language | Well-documented shared language for integration | Industry standards, interoperability matters |
| Separate Ways | No integration; contexts are independent | Integration cost exceeds benefit |

**Example** (e-commerce context map):
```
Sales Context (Upstream) --[Open Host Service]--> Order Fulfillment Context (Downstream)
Order Fulfillment Context --[Anti-Corruption Layer]--> Legacy Warehouse System
Billing Context --[Customer-Supplier]--> Payment Gateway (External)
```
