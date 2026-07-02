---
title: "API Versioning Strategies"
layout: resource
type: reference
category: "Architecture"
description: "URI, Header, Content Negotiation, and Query Parameter versioning strategies compared by example, pros, and cons, with guidance on what triggers a major version bump."
last_updated: 2026-07-02
tags: [architecture, api-design, rest]
related_guides:
  - /study-guides/architecture/api-design-architecture.html
---

| Strategy | Example | Pros | Cons |
| --- | --- | --- | --- |
| URI Versioning | `GET /v1/orders` | Explicit and visible, easy to route to different implementations, clear in logs and monitoring | Versions the entire API surface, URL changes break bookmarks and links |
| Header Versioning | `Accept: application/vnd.company.v2+json` | URLs stay stable, can version individual resources, follows REST principles | Less visible, harder to discover in docs, tooling support varies |
| Content Negotiation | `Accept: application/json; version=2` | Fine-grained control, standard HTTP mechanism | Complex to implement and document, client libraries may not support easily |
| Query Parameter | `GET /orders?version=2` | Simple for clients, visible in URLs | Pollutes query parameter namespace, can conflict with filtering/pagination |

**Recommendation**: Use URI versioning for major versions (`/v1/`, `/v2/`) when breaking changes occur. Between major versions, make backward-compatible changes only (add optional fields, add endpoints, deprecate without removing).

**Major version increment triggers**: removing endpoints or fields, changing field types or semantics, changing authentication mechanisms, changing error response format.
