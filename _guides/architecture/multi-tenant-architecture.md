---
layout: guide
title: "Multi-Tenant Architecture"
category: Architecture
subcategory: Design
description: "How to choose a tenancy model, isolate tenants' data, compute, and identity, and contain noisy neighbors in a system that serves many customers from shared infrastructure."
tags: [architecture, multi-tenancy, tenant-isolation, noisy-neighbor, practical]
---

A multi-tenant system serves many customers, or tenants, from shared infrastructure. The central design decision is how much each tenant shares with the others. Every step toward sharing lowers the cost per tenant and raises the chance that one tenant's load, data, or failure reaches another.

<!--
Phase 0 seed. Scope assigned by the Architecture refinement plan's ownership map; written in Phase 1.
Planned sections:
- Tenancy models: silo, pool, and bridge, and the cost/isolation trade-off between them
- Data isolation: database per tenant, schema per tenant, shared schema with tenant key; row-level security
- Compute isolation and the noisy neighbor problem: quotas, throttling per tenant, bulkheads, tiering
- Tenant identity and context propagation: resolving the tenant, carrying it through every call
- Tenant-aware operations: onboarding, per-tenant metrics and cost attribution, migrations across tiers
- When not to go multi-tenant
-->
