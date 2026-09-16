---
layout: guide
title: "Gateway and Proxy Patterns"
category: Architecture
subcategory: Patterns
description: "Patterns that move cross-cutting network concerns out of application code: API gateways at the edge, backends for frontends per client type, and sidecar and ambassador proxies beside each service."
tags: [architecture, design-patterns, api-gateway, bff, sidecar, ambassador]
---

These patterns decide where cross-cutting network concerns live: at the edge in front of all services, in a backend tailored to one client, or in a proxy deployed beside each service.

## API Gateway

An API gateway is a server that acts as a single entry point for a collection of microservices. It routes requests, enforces policies, and provides cross-cutting concerns.

**Core responsibilities**:
- Request routing and composition
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation
- Protocol translation (REST to gRPC, HTTP to messaging)
- Caching
- Logging and monitoring

**Gateway variations**:

**Aggregation**: Gateway calls multiple services and combines responses into single response.

**Transformation**: Gateway adapts legacy SOAP services to modern REST APIs.

**Edge gateway**: Deployed close to users (CDN edge) for low-latency responses.

---

## Sidecar Pattern

<blockquote class="pull-quote">
<p>The sidecar pattern separates cross-cutting concerns from application code, enabling consistent functionality across polyglot services without code changes.</p>
</blockquote>

Deploys supporting functionality (logging, monitoring, configuration) in a separate process alongside the main application.

**Use When**:
- Need consistent cross-cutting functionality
- Applications use different technologies
- Cannot modify existing applications
- Want to centralize auxiliary functions

**Common Uses**:

- Service mesh proxies
- Logging and monitoring agents
- Configuration management
- Security and authentication

**Example**: Microservice with Envoy sidecar proxy that handles load balancing, circuit breaking, and observability without modifying application code.

```
Pod:
  ├── Application Container (business logic)
  └── Envoy Sidecar (networking, observability, security)

All network traffic goes through Envoy sidecar
```

---

## Ambassador Pattern

A specialized sidecar that handles all outbound network requests for an application, acting as a proxy.

**Use When**:
- Need consistent networking policies
- Want to handle retries, timeouts centrally
- Applications make many external calls
- Need to add networking features without code changes

**Example**: Legacy application with ambassador container that adds circuit breaking, retries, and service discovery to external API calls.

```
Application → Ambassador → External Services
  Ambassador handles:
    - Service discovery
    - Retries
    - Circuit breaking
    - TLS termination
```

---

## Backend for Frontend (BFF)

Creates separate backend services tailored to specific frontend applications or client types.

**Use When**:
- Supporting multiple client types (web, mobile, IoT)
- Clients have different data requirements
- Want to optimize for specific user experiences
- Generic APIs are too complex or inefficient for clients

**Example**: E-commerce platform with separate BFFs for web browsers (rich product data), mobile apps (lightweight responses), and IoT devices (minimal data).

```
Web Browser → Web BFF (rich product details, high-res images)
Mobile App → Mobile BFF (compressed images, minimal data)
IoT Device → IoT BFF (product IDs only, no images)
```

---

## Quick Reference

### Pattern Comparison

| Pattern | Scope | Complexity | Use Case |
|---------|-------|------------|----------|
| **API Gateway** | All external clients | Medium | Single entry point and edge policies |
| **Sidecar** | Single app | Low | Cross-cutting concerns |
| **Ambassador** | Outbound calls | Low | Centralize networking |
| **BFF** | Per client type | Medium | Client-specific needs |

### Decision Tree

| Question | Pattern |
|----------|---------|
| Need one entry point that enforces policy for external clients? | API Gateway |
| Need cross-cutting functionality? | Sidecar |
| Centralize outbound networking? | Ambassador |
| Different client requirements? | BFF |

### Implementation Tools

**API Gateway**: Managed cloud gateways | Envoy | NGINX
**Sidecar**: Kubernetes sidecars | Docker Compose
**Ambassador**: Envoy | NGINX
**BFF**: Custom services | API Gateway with routing

### When to Avoid

<div class="callout callout--warning">
<p class="callout__title">Complexity Warning</p>
<p><strong>API Gateway:</strong> Adds a hop and a shared component to operate for a single service with one client<br>
<strong>Sidecar:</strong> Adds complexity for simple apps<br>
<strong>Ambassador:</strong> Unnecessary for apps with few external calls<br>
<strong>BFF:</strong> Overkill for single client type</p>
</div>

---
