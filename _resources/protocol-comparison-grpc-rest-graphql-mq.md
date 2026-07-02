---
title: "Protocol Comparison: gRPC vs REST vs GraphQL vs Message Queues"
layout: resource
type: reference
description: "Nine-dimension comparison of gRPC, REST, GraphQL, and message queues — protocol, coupling, streaming, tooling, and best-fit use case for each."
last_updated: 2026-07-02
tags: [architecture, api-design, distributed-systems, integration]
related_guides:
  - /study-guides/architecture/grpc-architecture-design.html
---

| Dimension | gRPC | REST | GraphQL | Message Queues |
| --- | --- | --- | --- | --- |
| Protocol | HTTP/2, binary protobuf | HTTP/1.1 or HTTP/2, text JSON | HTTP/1.1 or HTTP/2, text JSON | AMQP, MQTT, proprietary |
| Coupling | Tight (shared proto contracts) | Loose (HTTP conventions) | Medium (shared schema) | Loose (message schemas) |
| Browser Support | Limited (gRPC-Web proxy) | Native | Native | Not applicable |
| Streaming | Full (all four patterns) | Limited (SSE, WebSockets) | Subscriptions (WebSockets) | Pub/Sub, streaming |
| Tooling | Code generation, reflection | OpenAPI, Postman, curl | GraphiQL, Apollo Studio | Broker-specific consoles |
| Discoverability | Server reflection, proto files | Self-describing with HATEOAS | Introspection queries | Schema registries |
| Contract Enforcement | Compile-time, strict | Runtime, often informal | Runtime, schema-validated | Runtime, schema-optional |
| Performance | High (binary, multiplexed) | Moderate (text, connection-per-request) | Moderate (text, query complexity) | High (async, batched) |
| Best For | Internal services, streaming | Public APIs, web clients | Flexible queries, BFF | Async workflows, decoupling |
