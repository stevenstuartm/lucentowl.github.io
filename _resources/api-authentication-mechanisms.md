---
title: "API Authentication Mechanisms"
layout: resource
type: reference
description: "API Keys, OAuth 2.0, JWT, and mTLS authentication mechanisms compared by use case, pros, and cons, with common pattern-to-context mappings."
last_updated: 2026-07-02
tags: [architecture, api-design, security, authentication]
related_guides:
  - /study-guides/architecture/api-design-architecture.html
---

| Mechanism | Use Case | Pros | Cons |
| --- | --- | --- | --- |
| API Keys | Server-to-server, simple clients | Simple, widely supported | No user identity, hard to rotate |
| OAuth 2.0 | User authorization, third-party access | Standard, supports delegated access | Complex, many flows to choose from |
| JWT | Stateless authentication | Self-contained, scales well | Token revocation is hard |
| mTLS | High-security service-to-service | Strong mutual authentication | Complex certificate management |

**Common patterns by context**

| Context | Recommended Mechanism |
| --- | --- |
| Public APIs | OAuth 2.0 for user authorization |
| Internal APIs | JWT or mTLS |
| Partner APIs | API keys with allowlisting |
| Mobile/Web apps | OAuth 2.0 with PKCE |
