---
title: "Common API Antipatterns"
layout: resource
type: reference
description: "Six recurring API design mistakes — chatty APIs, leaking implementation details, ignoring HTTP semantics, poor error handling, over-versioning, and missing documentation — each with the problem and the fix."
last_updated: 2026-07-02
tags: [architecture, api-design, rest]
related_guides:
  - /study-guides/architecture/api-design-architecture.html
---

| Antipattern | Problem | Solution |
| --- | --- | --- |
| Chatty APIs | Requiring multiple round trips to accomplish simple tasks (e.g., separate calls to `/user`, `/user/preferences`, `/user/orders`) | Provide composite endpoints, support field expansion (`/user?expand=preferences,orders`), or use GraphQL |
| Leaking Implementation Details | Exposing database structure, internal service names, or framework details (e.g., `GET /orders?join=customers&select=order_id,customer.name`) | Design APIs around domain concepts, not database schema; abstract implementation details behind stable contracts |
| Ignoring HTTP Semantics | Using POST for everything, returning 200 OK for errors, misusing status codes | Use HTTP methods and status codes according to their defined semantics |
| Poor Error Handling | Vague error messages, inconsistent error formats, exposing stack traces | Return structured errors with machine-readable codes, human-readable messages, and actionable details |
| Versioning Too Frequently | Creating new versions for minor changes, fragmenting the API across many versions | Make backward-compatible changes whenever possible; reserve new versions for true breaking changes |
| Lack of Documentation | Incomplete, outdated, or missing documentation | Generate documentation from API specs, include examples for every endpoint, keep changelog updated |
