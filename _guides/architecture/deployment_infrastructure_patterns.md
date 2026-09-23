---
layout: guide
title: "Gateway and Proxy Patterns"
category: Architecture
subcategory: Patterns
description: "Patterns that move cross-cutting network concerns out of application code: API gateways at the edge, backends for frontends per client experience, and sidecar and ambassador proxies beside each service."
tags: [practical, api-gateway, bff, sidecar, ambassador, reverse-proxy]
---

Every service ends up needing the same network concerns: authenticating callers, limiting their rate, retrying failed calls, encrypting traffic, emitting traces. Built into each service, those concerns get implemented slightly differently in every language and framework, and changing one means redeploying everything. These patterns move them out of application code into a proxy, and differ in where that proxy sits.

An API gateway handles traffic entering the system. A backend for frontend shapes that traffic for one kind of client. A sidecar handles traffic in and out of one service instance, and an ambassador is a sidecar specialized for that instance's outbound calls.

{% include figure.html id="pat-gateway-topology" %}

## API Gateway

A single entry point in front of a system's services. External clients call the gateway, and the gateway routes each request to the service that handles it, applying shared policy on the way through.

**What it typically handles**:
- Routing requests to backend services by path, host, or header
- Authenticating callers and rejecting unauthenticated traffic before it reaches any service
- Rate limiting per client or API key
- TLS termination for external traffic
- Request and response transformation, including protocol translation such as REST to gRPC
- Response caching, request logging, and tracing headers

**Use when**:
- External clients would otherwise need to know the address and interface of many services
- The same edge policy, such as authentication and rate limiting, applies across many services
- Internal service boundaries should be free to change without breaking external clients

**Variations**: A gateway that calls several services and combines their responses into one is doing **aggregation**, which saves clients round trips but puts composition logic in the gateway. An **edge gateway** runs in CDN or regional points of presence so that authentication, caching, and rejection happen close to the user.

**Example**: A retail API exposes `/orders`, `/catalog`, and `/accounts` from one hostname. The gateway validates the caller's token, applies the caller's rate limit, and forwards each path to a separate service, none of which implements token validation or rate limiting itself.

**Trade-offs**: The gateway is on the path of every external request, so it has to be highly available and scaled for peak traffic, and it adds a network hop to each call. It is also a shared component every team's API changes pass through, which can make its configuration a coordination bottleneck. The failure that recurs is business logic creeping into it. Transformation rules turn into orchestration, orchestration turns into domain decisions, and the gateway becomes a central integration hub that every change depends on. For a single service with a single client, a gateway adds that hop and that operational burden without enough shared policy to justify it.

**Common implementations**: managed cloud gateways such as Amazon API Gateway and Azure API Management, and self-hosted options including Envoy, NGINX, Kong, and YARP in .NET.

---

## Backend for Frontend (BFF)

*Named by Phil Calçado from its use at SoundCloud, and described by Sam Newman in 2015*

A backend built for one user experience, owned by the team that builds that experience's frontend. Instead of every client adapting a general-purpose API to its own needs, each experience gets a backend that returns exactly what its screens need.

**Use when**:
- Different client experiences need substantially different data, shapes, or call patterns from the same services
- A general-purpose API has accumulated options and fields that serve one client and burden the others
- Frontend teams are blocked waiting on backend teams for changes that only matter to their client

**Example**: A web storefront shows rich product pages assembled from catalog, reviews, and inventory in one request. The mobile app needs a compact version of the same page in a single small payload over a slow connection. Each has its own BFF, and each BFF calls the same downstream services.

```
Web Browser → Web BFF    → catalog, reviews, inventory (full detail, high-res images)
Mobile App  → Mobile BFF → catalog, inventory          (compact payload, thumbnails)
```

How many BFFs to run follows the experiences, not the device list. Newman's rule of thumb is one experience, one BFF. If the iOS and Android apps offer the same experience, one mobile BFF serves both, and if a web app has a customer-facing experience and an internal admin experience, those can warrant separate BFFs.

**Trade-offs**: Every BFF is another service to deploy and operate. Logic duplicated across BFFs is the usual complaint, and Newman's advice is to tolerate some duplication rather than extract a shared library that couples the BFFs back together. When the same aggregation appears in several BFFs, it usually belongs in a downstream service instead. A BFF owned by a team other than the frontend team loses most of the point, since the benefit is that the people building the screens control the API behind them.

---

## Sidecar

*Named as a single-node container pattern by Brendan Burns in Designing Distributed Systems (2018), alongside the ambassador*

A helper process deployed alongside each instance of a service, sharing its lifecycle and usually its network namespace and storage. The application doesn't call the sidecar through a library. The sidecar intercepts or observes what the application does and adds behavior from outside it.

**Use when**:
- Several services in different languages need identical behavior, such as mutual TLS, log shipping, or metrics collection
- The application can't be modified, or shouldn't have to be, to gain a capability
- The helper's release cycle should be independent of the application's

**Common uses**: proxies that handle a service's inbound and outbound traffic, log and metrics agents, configuration or secret refreshers, and certificate rotators.

**Example**: A service pod runs the application alongside an Envoy proxy. All traffic in and out of the pod passes through Envoy, which applies mutual TLS, retries, and tracing without any change to the application code. A service mesh is this arrangement applied to every service and managed centrally.

{% include figure.html id="pat-sidecar-proxy" %}

Kubernetes also has a native form of the pattern, stable since version 1.33. An init container with `restartPolicy: Always` starts before the application containers, keeps running alongside them, and is stopped after them.

```yaml
spec:
  initContainers:
    - name: log-shipper
      image: fluent/fluent-bit:latest
      restartPolicy: Always          # makes this a sidecar
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
  containers:
    - name: orders-api
      image: example/orders-api:1.4.2
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
  volumes:
    - name: logs
      emptyDir: {}
```

**Trade-offs**: Each instance now runs two processes, so the sidecar's memory and CPU are multiplied by the instance count across the whole fleet. A proxy sidecar adds a hop to every call in both directions. Debugging has one more moving part, and a sidecar failure can take down an instance whose application is healthy. For a single service in a single language, a library usually does the same job with less machinery.

---

## Ambassador

A sidecar dedicated to the service's outbound calls. The application talks to the ambassador as if it were the remote service, typically on localhost, and the ambassador handles finding, connecting to, and calling the real one.

**Use when**:
- A service calls external or remote dependencies that need retries, timeouts, circuit breaking, or service discovery
- The application can't be changed to add those behaviors, as with legacy or third-party code
- Connection details for a dependency, such as sharding or failover between endpoints, should be hidden from the application

**Example**: A legacy application calls `http://localhost:9000/payments`. The ambassador listening there resolves the current payment provider endpoint, originates a TLS connection to it, applies a timeout and retry policy, and opens a circuit when the provider is failing. The application still believes it is making a plain local HTTP call.

{% include figure.html id="pat-ambassador" %}

**Trade-offs**: The ambassador shares the sidecar's costs, and it adds one of its own. Because the application no longer sees the real failures, only whatever the ambassador passes back, a retry policy in the ambassador and another in the application can multiply attempts without either side knowing. Keep each resilience policy in one place.

---

## Quick Reference

| Pattern | Where it sits | Handles | Reach for it when | Main cost |
|---------|---------------|---------|-------------------|-----------|
| **API gateway** | At the edge, once for the system | Inbound external traffic and shared edge policy | Many services sit behind one external API | A shared, always-on component that attracts business logic |
| **BFF** | At the edge, once per client experience | Shaping responses for one experience | Client experiences need different data and call patterns | A service per experience, and some duplicated logic |
| **Sidecar** | Beside each service instance | Inbound and outbound traffic, telemetry, config | Many services need identical behavior regardless of language | Per-instance resource overhead and an extra hop |
| **Ambassador** | Beside each service instance | Outbound calls only | An unmodifiable application needs resilient outbound calls | Sidecar costs, and hidden duplication of retry policy |
