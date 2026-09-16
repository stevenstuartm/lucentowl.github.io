---
title: "gRPC Architecture and Design"
layout: guide
category: Architecture
subcategory: Design
description: "When and how to use gRPC: Protocol Buffers and HTTP/2, the four streaming modes, deadlines, proto evolution and distribution, the load balancing problem long-lived connections create, gRPC-Web and JSON transcoding for browsers, and how gRPC compares with REST, GraphQL, and messaging."
tags: [practical, grpc, protobuf, http2, streaming, grpc-web, json-transcoding]
---

[gRPC](https://grpc.io/){:target="_blank" rel="noopener noreferrer"} is a remote procedure call framework, originally developed at Google, for calls between services. A client calls a method on a generated stub as if it were local, and gRPC carries the call over the network in a compact binary format with a contract both sides were compiled against.

It trades reach for efficiency and strictness. Browsers can't call it directly, curl can't read its payloads, and every consumer needs the contract compiled in. In exchange, calls are small and fast, streaming works in both directions, and a contract change that breaks a consumer is caught at build time rather than in production. Most of the architectural decisions about gRPC come down to where that trade pays off.

## How gRPC Works

Three pieces combine: Protocol Buffers define the contract and encode the data, HTTP/2 carries the calls, and code generation turns the contract into typed clients and servers.

### Protocol Buffers

[Protocol Buffers](https://protobuf.dev/){:target="_blank" rel="noopener noreferrer"} play two roles. A `.proto` file is the interface definition, declaring services, their methods, and the messages they exchange. The same definitions describe the binary format those messages take on the wire.

```protobuf
edition = "2023";

package orders.v1;

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc WatchOrderStatus(WatchOrderStatusRequest) returns (stream OrderStatusChanged);
}

message GetOrderRequest {
  string order_id = 1;
}

message Order {
  string order_id = 1;
  string customer_id = 2;
  OrderStatus status = 3;
  int64 total_minor_units = 4;
  string currency = 5;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_SHIPPED = 2;
}

// WatchOrderStatusRequest and OrderStatusChanged omitted
```

The numbers after each field are what actually go on the wire. A JSON document repeats every field name in every message, while protobuf encodes a small field number and a compactly encoded value, which is where most of its size advantage comes from.

Newer proto files declare an **edition**, such as `edition = "2023"`, instead of the older `syntax = "proto2"` or `syntax = "proto3"`. Editions express the differences between proto2 and proto3, such as whether a field tracks presence, as features that can be set per file or per field. They don't change the wire format, and edition-based files can import proto2 and proto3 definitions.

### HTTP/2

The gRPC protocol is defined over [HTTP/2](https://httpwg.org/specs/rfc9113.html){:target="_blank" rel="noopener noreferrer"}, and three of its features matter.

- **Multiplexing**: Many concurrent calls share one TCP connection as independent streams, so a slow response doesn't hold up the others at the HTTP layer. A lost TCP packet still delays every stream on that connection, since TCP itself delivers bytes in order.
- **Header compression**: HPACK compresses the headers repeated on every call, such as authorization tokens and trace context, against a table shared across the connection.
- **Trailers**: gRPC sends each call's final status code in HTTP trailers after the response body, which is what lets a streaming response report success or failure at its end. This is also the feature browsers don't expose, and it is why browsers can't speak native gRPC.

### Code Generation

The protobuf compiler, `protoc`, or a tool such as Buf generates a client stub and a server base class per service in each target language. The server team implements the base class, and clients call the stub. Neither writes serialization code, and a change to the contract that breaks one side shows up as a compile error on that side.

## Communication Patterns

| Pattern | Shape | Fits |
|---------|-------|------|
| **Unary** | One request, one response | Queries and commands, the gRPC equivalent of a typical REST call |
| **Server streaming** | One request, a stream of responses | Subscriptions to changes, progress updates, delivering a large result in chunks |
| **Client streaming** | A stream of requests, one response | Uploading a file in chunks, sending a batch of readings for one aggregated result |
| **Bidirectional streaming** | Both sides stream independently over one call | Interactive sessions, long-lived exchanges where both sides produce messages |

Streams are long-lived HTTP/2 streams on a shared connection, so they cost far less than a connection per subscriber. They do complicate everything that assumes requests are short, including load balancing, proxies with idle timeouts, and deployments that need to drain connections.

### Deadlines and Cancellation

Every gRPC call can carry a deadline, the absolute time by which the caller needs an answer. The server sees how much time remains and can stop work that can no longer finish in time. When a service makes further gRPC calls while handling a request, frameworks can propagate the remaining deadline onto those calls, so a whole chain of calls shares one time budget instead of each hop applying its own timeout.

```csharp
var reply = await client.GetOrderAsync(
    new GetOrderRequest { OrderId = orderId },
    deadline: DateTime.UtcNow.AddSeconds(2));
```

A caller that gives up cancels the call, and the cancellation reaches the server, which can stop work nobody is waiting for. Set a deadline on every call. gRPC's default is no deadline at all, which means a hung server holds the caller indefinitely.

## Comparing gRPC, REST, GraphQL, and Messaging

| Dimension | gRPC | REST | GraphQL | Messaging |
|-----------|------|------|---------|-----------|
| **Interaction** | Synchronous calls and streams between known services | Synchronous request and response on resources | Synchronous queries shaped by the client | Asynchronous, through a broker |
| **Wire format** | Binary protobuf over HTTP/2 | Usually JSON over HTTP/1.1, HTTP/2, or HTTP/3 | Usually JSON over HTTP | Broker protocol such as AMQP, MQTT, or Kafka's own |
| **Contract** | `.proto` files compiled into both sides | OpenAPI document, when one is maintained | Schema, validated by the server at runtime | Message schemas, optionally enforced by a schema registry |
| **Contract mismatch caught** | At build time, for consumers built against the new contract | At runtime, unless clients are generated from OpenAPI | At query validation, or build time with generated clients | At runtime, or at publish with a registry |
| **Browser access** | Through gRPC-Web or JSON transcoding | Native | Native | Only through WebSocket bridges such as MQTT or STOMP over WebSocket |
| **Streaming** | Server, client, and bidirectional, natively | Not native, so Server-Sent Events or WebSockets run alongside | Subscriptions, commonly over WebSockets or Server-Sent Events | Inherent: publishers and consumers exchange streams of messages |
| **Payload size and parsing cost** | Small and fast | Larger text payloads | Larger text payloads, plus per-query resolution cost | Depends on the chosen encoding |
| **Human inspection** | Needs tooling such as grpcurl | curl and a browser | GraphiQL or any HTTP client | Broker consoles |
| **Discoverability** | Server reflection, or the proto files | OpenAPI documents | Introspection | Schema registries and topic catalogs |
| **Typical home** | Internal service-to-service calls, streaming | Public and partner APIs, web clients | Client-facing aggregation over many services | Decoupled workflows, events, load leveling |

The rows that decide most choices are interaction style and browser access. Messaging answers a different question, whether the caller needs an answer now, so it complements the other three rather than competing with them. Among the synchronous options, gRPC fits best where both ends are services a single organization controls.

## Designing Contracts That Evolve

Because the wire format uses field numbers rather than names, protobuf's compatibility rules are precise.

| Safe | Breaking |
|------|----------|
| Adding a field with a new number | Changing a field's number |
| Adding an RPC method or a service | Changing a field's type to one with a different wire encoding |
| Adding an enum value, when consumers handle unknown values | Reusing a removed field's number or name for something else |
| Renaming a field, for binary consumers only | Renaming a field, for consumers using JSON mapping |
| Removing a field, once its number and name are reserved | Removing or renaming an RPC method or service |

Consumers that receive a field they don't know skip it and, in most implementations, preserve it when re-serializing. That is what makes adding fields safe in both directions.

When a field is removed, reserve its number and name so no future change can reuse them. A reused number is worse than an error. An old client sending the old field silently has its value read as the new field.

```protobuf
message Order {
  reserved 6, 9;
  reserved "discount_code";

  string order_id = 1;
  // ...
}
```

Put the major version in the package name, such as `orders.v1`, so a genuinely incompatible contract can be introduced as `orders.v2` alongside the old one rather than replacing it.

### Distributing Proto Files

Every consumer needs the proto files, and at scale how they get them becomes a real coordination problem: who owns the canonical copy, how breaking changes are caught before merge, and how teams find services that already exist.

| Strategy | Strengths | Weaknesses |
|----------|-----------|------------|
| **Monorepo** | One source of truth, atomic changes across producer and consumers | Needs a monorepo culture and tooling across the organization |
| **Dedicated contracts repository** | One place to review and lint every contract change | Consumers must pin and update versions deliberately |
| **Generated packages** in NuGet, Maven, or npm | Consumed like any other dependency, with semantic versions | A publish pipeline per contract change, and packages per language |
| **Schema registry** such as the [Buf Schema Registry](https://buf.build/){:target="_blank" rel="noopener noreferrer"} | Breaking-change detection, dependency management, and generated SDKs | Another tool and service to adopt |
| **Copying files between repositories** | No infrastructure | Copies drift, and nobody knows which is current |

Whatever the distribution, run a breaking-change check, such as `buf breaking`, in the producer's build against the last published contract. That turns the compatibility table above from a convention into a gate.

## Load Balancing Long-Lived Connections

gRPC's connection reuse creates a load balancing problem that tends to surface in the first production deployment.

A layer 4 load balancer, including the default Kubernetes Service, balances TCP connections. With HTTP/1.1 that is close enough to balancing requests, because clients open many short connections. A gRPC client opens one HTTP/2 connection and sends every call over it for as long as it runs, so all of that client's traffic lands on whichever instance received the connection. New instances added by autoscaling receive nothing from existing clients.

```
Layer 4 balancing (connection-level)

Client A ══ one connection ══▶ LB ══▶ Pod 1   (all of Client A's calls)
Client B ══ one connection ══▶ LB ══▶ Pod 2   (all of Client B's calls)
                                      Pod 3   (idle, including after scale-out)

Layer 7 or client-side balancing (call-level)

Client A ══ connection ══▶ proxy or client ─┬─▶ Pod 1
                                            ├─▶ Pod 2
                                            └─▶ Pod 3
```

| Approach | How it works | Trade-off |
|----------|--------------|-----------|
| **Client-side balancing** | The client resolves every instance, through a Kubernetes headless Service or a registry, and spreads calls across connections to each | No proxy hop, but each client language needs the balancing configured, and new instances are seen only when the client re-resolves |
| **Layer 7 proxy** | A proxy such as Envoy terminates HTTP/2 and balances individual calls | Works for any client, at the cost of a proxy to run and a hop per call |
| **Service mesh** | Mesh proxies balance calls transparently alongside mTLS and telemetry | The most capable, and the most to operate |
| **Proxyless with xDS** | gRPC clients take balancing and routing configuration directly from an xDS control plane, such as Istio's or Google Cloud Service Mesh | Mesh-style traffic control without a proxy hop, but only for gRPC traffic and only in gRPC libraries with xDS support |

Whichever approach balances calls, configure a maximum connection age on servers. The server then periodically asks clients to reconnect, which forces them to re-resolve and discover new instances, and it lets deployments drain connections instead of waiting for streams that never end.

## Security

Use TLS for every production gRPC connection. Beyond encryption, gRPC libraries generally refuse to attach per-call credentials, such as bearer tokens carried in call metadata, to an insecure channel unless explicitly configured to, so a misconfigured plaintext channel fails rather than leaking tokens.

For service-to-service calls, mutual TLS authenticates both ends by certificate. A service mesh can provide it without application changes. Without one, the certificates have to be issued and rotated by something the team runs.

Per-call authorization rides in metadata. The client attaches a token, and a server interceptor validates it and checks what the caller may do, which keeps transport identity (which service is calling) separate from request authorization (whether this caller may perform this operation).

## Reaching Browsers and External Clients

Browsers can't make native gRPC calls. Their HTTP APIs don't give JavaScript access to HTTP/2 framing or to response trailers, which gRPC depends on for status.

```
Browser ──gRPC-Web (HTTP/1.1 or HTTP/2)──▶ gRPC-Web support ──gRPC──▶ Service
                                          (Envoy, or the server itself)

Browser ──REST + JSON──▶ JSON transcoding ──gRPC──▶ Service
                        (in-process, or a proxy such as grpc-gateway)
```

**gRPC-Web** adapts the protocol to what browsers allow. The browser uses a generated gRPC-Web client, and the translation to native gRPC happens either in a proxy such as Envoy or in the server framework itself, as ASP.NET Core does with its gRPC-Web middleware. It supports unary and server streaming calls. Client and bidirectional streaming aren't available, so interactive browser sessions still need WebSockets or a similar channel.

**JSON transcoding** exposes gRPC methods as ordinary HTTP and JSON endpoints, mapped with `google.api.http` annotations in the proto file. The browser, or any external client, needs no gRPC knowledge at all. ASP.NET Core does this in-process through `AddJsonTranscoding()`, and grpc-gateway and Envoy's transcoding filter do it as proxies. Server streaming is delivered as newline-delimited JSON, and client and bidirectional streaming aren't supported.

```protobuf
rpc GetOrder(GetOrderRequest) returns (Order) {
  option (google.api.http) = { get: "/v1/orders/{order_id}" };
}
```

Transcoding keeps one implementation serving both gRPC and REST, but the REST API it produces is shaped by the proto definitions. For a public API that needs its own carefully designed resource model, a gateway or BFF translating to a separately designed REST contract gives more freedom at the cost of maintaining that mapping.

The common arrangement follows from all this. gRPC runs between internal services, REST or GraphQL serves the edge, and transcoding or a gateway translates between them.

## When gRPC Fits

| gRPC tends to fit | gRPC tends to add friction |
|-------------------|----------------------------|
| Internal calls between services that one organization controls | Public or partner APIs, where consumers expect curl-able REST and documentation |
| High call volumes, where payload size and parsing cost show up in profiles or bills | Low-volume services, where the difference from JSON is noise |
| Streaming in either direction as a first-class interaction | Browser-first applications calling services directly |
| Many languages that must share one strictly enforced contract | Teams without the build and distribution tooling to manage proto files |
| Chains of calls that benefit from propagated deadlines and cancellation | Environments where intermediaries can't handle HTTP/2 end to end |

Signs gRPC has been over-adopted include browser-facing services running it behind gRPC-Web for no streaming benefit, and partners who must install gRPC tooling to integrate. Signs it's under-adopted include JSON serialization dominating internal service profiles, internal OpenAPI documents that have drifted from what services actually do, and services polling each other for changes that a server stream would push.

## Quick Reference

| Topic | Key point |
|-------|-----------|
| **Contract** | Proto files compiled into both sides, and field numbers, not names, define the wire format |
| **Editions** | `edition = "2023"` or later replaces `syntax`, expressing proto2 and proto3 differences as features |
| **Streaming** | Unary, server, client, and bidirectional, all over one HTTP/2 connection |
| **Deadlines** | Set one on every call, and propagate the remainder to downstream calls |
| **Evolution** | Add fields with new numbers, reserve removed ones, and version the package for true breaks |
| **Distribution** | Pick a strategy, and gate the producer's build on a breaking-change check |
| **Load balancing** | Connection-level balancing pins clients to one instance, so balance per call and cap connection age |
| **Security** | TLS always, mutual TLS between services, and tokens in metadata checked by interceptors |
| **Browsers** | gRPC-Web for unary and server streaming, or JSON transcoding for plain REST access |
