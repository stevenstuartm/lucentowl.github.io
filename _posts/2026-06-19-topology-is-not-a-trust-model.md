---
layout: post
title: "Topology Is Not a Trust Model: Position vs Identity"
date: 2026-06-19
description: "Whether a service request is legitimate is treated as an authentication question, but the answer is also an architectural one: whether legitimacy comes from network position or from verified ownership. That distinction shapes service structure, security posture, and team dynamics in ways that compound as systems grow."
tags: [architecture, api-design, distributed-systems, security, design-patterns, microservices]
author: steven-stuart
sources:
  - title: "RFC 8693: OAuth 2.0 Token Exchange"
    url: "https://datatracker.ietf.org/doc/html/rfc8693"
  - title: "Uber Engineering: Introducing Domain-Oriented Microservice Architecture"
    url: "https://www.uber.com/blog/microservice-architecture/"
  - title: "InfoQ: The Netflix API Optimization Story"
    url: "https://www.infoq.com/news/2013/02/netflix-api-optimization"
  - title: "PCI SSC: Guidance for PCI DSS Scoping and Network Segmentation"
    url: "https://listings.pcisecuritystandards.org/documents/Guidance-PCI-DSS-Scoping-and-Segmentation_v1.pdf"
  - title: "NIST SP 800-207: Zero Trust Architecture"
    url: "https://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-207.pdf"
  - title: "Istio: Security Concepts (identity and authorization policy)"
    url: "https://istio.io/latest/docs/concepts/security/"
  - title: "Melvin Conway: How Do Committees Invent?"
    url: "https://www.melconway.com/Home/Committees_Paper.html"
---

Every service request arrives with the same question: what makes this request legitimate? It is a question I return to often, because the answer is certain to reveal a foundational belief about a system's architecture. That belief might not have been made explicit, and it could hint at a misalignment with the business domain.

The school of **Positional architecture** claims that legitimacy is **granted** by placement. A request is legitimate because it arrived from the right place, to the right place. More specifically, from behind the perimeter, through the right intermediaries, from a subnet the architecture trusts, or toward a service that grants access on that same basis.

The school of **Identity-oriented architecture** claims that legitimacy is **earned** by ownership. A request is legitimate because the caller has proven who it is and what it is authorized to do. Credentials state its bounded scope, not just its network address. Every service validates every caller the same way, and all services relate to each other as peers with clear, bounded authority over their own domains.

The choice typically reflects a single belief about where legitimacy comes from. That belief shapes where authority lives in the system, how teams own their work, and whether the system can adapt as the domain evolves. It shapes them through one question that position-based trust never asks: what is this caller allowed to do?

## Position vs. Identity in Practice

**Positional architecture** would commonly arrange a checkout feature like this:

```
Checkout Client
        │ ← identity verified here (edge)
        ▼
CheckoutFacade          ← owned by the API team; shapes the response for this consumer
        │ ← internal; trusted by position, not verified identity
        ▼
CheckoutOrchestrator    ← owned by the platform team; coordinates the checkout flow
        │               │
        ▼               ▼
  OrderService     PaymentService    ← no credential check; trusted because internal
        │
    orders DB
```

**Identity-oriented architecture** removes the intermediaries:

```
Checkout Client
        │ [checkout token]         │ [checkout token]
        ▼                          ▼
  OrderService ──[order-svc token]──► PaymentService
[validates caller]                  [validates caller]
        │
    orders DB
```

The two diagrams differ in topology as well as trust, but topology and trust can vary independently. A layered system can check bounded identity at every hop. What the trust model decides is whether a tier that owns no data or rules of its own ever has to be justified.

Under identity, a facade can still exist, but it appears in OrderService's policy and logs as a named caller, such as "CheckoutFacade may create orders." The orders team has to justify that grant, and anyone can list who depends on whom. Under positional trust, there is no grant and no list, so a tier that owns nothing borrows another domain's authority without its owners deciding to lend it.

When OrderService calls PaymentService, it presents its own service identity. The client's token is never forwarded. The client still calls each service itself, which works only while no rule spans those calls. A checkout whose order must not stand when payment fails needs a service that owns the checkout's lifecycle.

When PaymentService needs to know which user a payment is for, OrderService exchanges the user's token for a narrowed one carrying both identities, as OAuth 2.0 Token Exchange (RFC 8693) defines. That way a compromised OrderService can't pay for orders no user placed. The common alternative, forwarding the user's token, narrows that risk without closing it. A compromised intermediary can replay a forwarded token against any service that accepts it, while an exchanged token is bound to one audience and one actor.

## Bounded Authority

### Authority Is Canonical Ownership

Authority is ownership: a domain service holds the canonical representation of its data, the validation rules governing it, and the contract it exposes. When multiple components claim authority over the same facts, each enforces different rules. No component is the definitive answer, and the drift between them is slow, then sudden.

### Tangled Calls Come From Weak Boundaries, Not Direct Calls

The most compelling argument for adding an orchestration layer is avoiding the death star: an uncontrolled web of lateral calls between peer services where no component owns the full decision. Keeping calls flowing downward along real dependencies is a sound instinct. Positional architecture uses layer placement to enforce the cascade, but placement without authority creates pass-through components that fragment the authority they were supposed to preserve.

Bounded authority inverts this: a service with tight, well-named scope has no need to reach sideways for decisions it already owns. When one bounded domain needs to coordinate with another, the call is direct and well-understood. Uber's experience bears this out. Its fix for roughly 2,200 tangled microservices was its Domain-Oriented Microservice Architecture, which grouped services into domains and layers with a gateway per domain. Those layers can look positional, but each gateway belongs to its domain, and the layers are dependency rules, not tiers trusted for position. **The tangled dependencies of a death star emerge from many poorly bounded components, not from well-bounded ones communicating directly.**

### A Tier Must Earn Its Place

A layer is a conceptual separation of concerns (domain logic from presentation, for instance) that identity can enforce without a dedicated service sitting between the callers. A tier exists because behaviors need to scale or fail independently. A worker tier has different throughput, concurrency, and instance allocation from the service that enqueues into it, so operational reality requires the separation. A facade tier that routes and shapes for a single consumer has no such requirement.

An aggregation tier that saves mobile clients round trips can pass the test, as long as it owns no business rules and the services behind it still check the caller.

### Legitimate Coordination Is Choreography or Lifecycle Ownership

**Choreography**: each service reacts to domain events it subscribes to. No central coordinator sits in the call path, so no single place shows the whole flow, and tracing a stuck checkout means correlating events across services. Events are records of decisions domain services have already made, not instructions to other services. An event mechanism that begins routing on business rules has claimed authority over those decisions. It is a positional layer disguised as infrastructure.

```
Client
  │ [checkout token]
  ▼
CheckoutService ← owns the cart
  │ publishes checkout.initiated
  ▼
OrderService [own authority]
  │ publishes order.created
  ▼
PaymentService [own authority]
    publishes payment.authorized
```

**Lifecycle ownership**: a domain service owns the process itself. CheckoutService is not a positional orchestrator if it holds the canonical state of the checkout: when it started, what steps have completed, what its terminal states are. Each sub-service validates CheckoutService's identity directly.

```
Client
  │ [checkout token]
  ▼
CheckoutService ← holds checkout state
  │ [checkout-svc token]          │ [checkout-svc token]
  ▼                               ▼
OrderService                PaymentService
[validates caller]          [validates caller]
```

Remove the coordinator and ask whether canonical state is lost. Canonical means business facts that users and other services ask this service for, such as a checkout's status or outcome, not a log of which calls succeeded. If yes, the service is a domain, not a layer.

If no, all state lives in the sub-services and the coordinator exists only to sequence calls. The checkout's own rules, such as whether an order stands when payment fails, then belong to no domain. A shared database causes the same problem when it lets rules about data live outside their owner. The exception is an orchestrator whose saga state users query, which holds canonical state and so is a lifecycle owner that should be owned as one.

## How Positional Architecture Accumulates

Positional architecture can be a deliberate choice, with its trade-offs known and accepted. More often it arrives through one of a few recurring paths, none of which examined the trust model they were collectively building.

- **Organic accumulation**: a facade added for consumer shaping, an orchestrator grown to coordinate a flow no single service owned, an adapter added for a protocol mismatch. Each decision was reasonable when made; the architecture they collectively implied was not.
- **Pattern cargo-culting**: Companies like Netflix and Uber evolved their layers in response to specific scaling pressures they described publicly, such as Netflix's range of client devices and Uber's thousands of services. Most teams haven't faced those pressures and won't. Teams that copy the pattern have a new domain, a smaller team, and a system that hasn't revealed where the real scaling pressure will sit.
- **Compliance overreach**: PCI DSS requires network security controls between the Cardholder Data Environment and untrusted networks, but the PCI Security Standards Council's scoping and segmentation guidance says segmentation is not a requirement, only a way to shrink assessment scope. HIPAA, SOX, and GDPR prescribe access controls and data protection outcomes. None of them dictates how internal services trust each other. The pressure toward perimeter models comes from how organizations and assessors interpret the frameworks, not from their text.

The cases where positional architecture earns its cost are narrow. The one scenario that legitimately forces a specific boundary component is integration with systems outside your change control: acquisitions, partner APIs, and legacy systems that can't support identity-oriented calls. A facade at that boundary is a quarantine, not a commitment to positional architecture throughout the system. The controls that would justify other uses arrive later and unevenly, because delivery pressure tends to win.

## What Positional Architecture Costs

Positional architecture adds hops that answer no operational question and that no owner approved. Each one adds cost:

- Debugging requires tracing the entire layer topology
- Testing multiplies because you need unit tests at each layer, contract tests between layers, and integration tests across the full stack
- Capacity planning gets harder because one unit of external load fans out to multiple internal calls with different resource profiles at each layer

These costs grow with hop count, so a long choreographed flow pays some of them too, but each of its hops is a domain acting on its own authority.

The real coupling is not shared code but shared call chains: every consumer request travels through the same intermediary services in the same order. The layers are separate deployments with separate teams. Yet a change in a domain service propagates upward through every adapter and facade that passes it along rather than translating it, as it would in a tightly coupled monolith.

In identity-oriented architecture, a consumer calls a domain service directly. That service may call one or more supporting services, and having to state what each caller may do tends to keep that chain short. Each service can be reasoned about, scaled, and deployed on its own terms.

At sufficient coupling depth, a true monolith is more defensible. It skips the network hops and multi-service deploys that are the price of independence, a price the coupled layers pay without getting the independence.

## What Identity-Oriented Architecture Costs

Identity-oriented architecture carries its own operational costs. Every service credential requires a lifecycle: issuance, rotation, and revocation. At scale, this becomes a distributed secrets management problem that positional architecture sidesteps by treating network membership as sufficient proof. Delegation also puts a token service on the path of delegated calls, which caching short-lived tokens bounds but doesn't remove.

The infrastructure for workload identity has matured, but most of the cost is front-loaded: teams pay it before the system is large enough for positional architecture's costs to become visible. That timing asymmetry is part of what makes the positional default durable. Paying early can look like the cargo-culting described above, but the first step is small. Any system with two services already has to decide what each may ask of the other, and a per-service allow-list answers that long before a token service is needed.

## The Asymmetric Security Posture of Positional Systems

The security problem with positional systems is the belief that sustains them and what that belief implies about where security effort should be concentrated. It is not the model itself. Built to its full specification, a positional system can be tightly controlled, with mutual TLS on every hop, audit logging at every tier, and explicit authorization at each layer.

That belief can outlive a security overhaul. The security half of this argument is zero trust, which NIST SP 800-207 defines as granting no implicit trust based solely on network location. But a zero-trust rollout can leave the pass-through tiers and layer-shaped teams in place, and they keep pulling security effort back to the edge.

### Network Membership Is Not Identity

In a positional system, a service's authority comes from its layer placement. When that service authenticates to call another, the most natural credential is a cert from the internal CA, accepted by any internal callee that trusts that CA. It answers "are you one of us?" rather than "are you specifically OrderService with authority over orders?"

So security effort tends to concentrate at the edge, where external callers prove they belong, and everything behind it is trusted implicitly.

A single vulnerability such as server-side request forgery, request smuggling, or a compromised internal service can give access to the entire soft interior, not just the narrow scope of whatever was breached.

### Authentication Is Not Authorization

The counter-argument is that service meshes like Istio and Linkerd can retrofit mutual TLS and per-hop authentication onto a positional system without changing service code. A mesh does issue each workload its own identity, and Istio's authorization policies can restrict which identities may call which paths and methods. On a positional system, though, the path of least resistance is the policy that matches its belief: "any authenticated mesh workload may call." A compromised internal service then holds an equally valid ticket.

Per-identity allow-lists are possible, but writing one means answering what each caller is for. Even a strict policy stops at routes and methods. Whether this caller may act on this particular order is a domain decision that only OrderService can make. The mechanism changed; what the system trusts didn't.

The distinction is clearance versus need-to-know. A top secret clearance doesn't entitle the holder to every document at that level without a demonstrable need for each one. A mesh cert accepted under an allow-all-authenticated policy is a clearance that proves tier membership and nothing else.

Identity-oriented architecture demands need-to-know instead. Every service presents credentials that prove a specific bounded identity, and every callee checks that identity against what it owns. A compromised component can act only within its authorization scope and on the requests that reach it while compromised. The security model and the architectural model are aligned because they share the same belief: legitimacy comes from what you are, not from where you sit.

### The Attack Surface Objection Counts Only the Edge

A common gut response is that identity-oriented architecture increases the attack surface by exposing domain services directly.

That objection counts publicly reachable endpoints, and even by that count positional architecture bounds nothing. Every new consumer-facing feature adds public endpoints whether or not intermediary tiers exist. The count also leaves out the interior. Once anything behind the edge is breached, every implicitly trusted internal call is attack surface too.

An identity-oriented system can still put a gateway at the edge for rate limiting, IP flagging, and geographic constraints, and keep network segmentation as defense in depth. Passing the gateway just grants nothing. Every service still checks every caller, because there is no interior to fall back on.

## Layer Boundaries Become Team Boundaries

Positional architecture tends to reinforce horizontal teams organized around the layers themselves. Specialization produces horizontal teams too, but positional architecture gives them a structure to settle into, since every tier needs an owner. The backend team owns domain services, the platform team owns orchestration, the API team owns the external facade. The backend team is rewarded for internal quality, not consumer outcomes, and the orchestration team optimizes for the calls it coordinates rather than the features consumers need.

Every capability that crosses a layer boundary requires coordination, negotiation, and synchronized releases. Identity-oriented systems have platform teams as well, but they own a capability domains consume, not a hop features pass through.

Melvin Conway observed in "How Do Committees Invent?" that organizations design systems that copy their communication structures. Layers tend to push back the other way, because once they exist, communication structures solidify around them. The result is teams in conflict about the architecture rather than the product. Who owns the latency that appeared between the orchestrator and the domain service? Whose responsibility is it when the contract between the facade and the adapter breaks? These arguments look like culture problems when they're architectural ones. The clearest sign that an architecture is serving itself rather than its system is when teams spend more time reasoning about which layer a change belongs to than building the change.

## Discipline Costs More When It Multiplies Across Layers

The most common response is that teams with strong governance, comprehensive testing, and mature observability can operate positional systems effectively. A well-governed positional system beats an undisciplined identity-oriented one.

The objection treats discipline as an architectural substitute, and it isn't. Both styles require the same disciplines. They differ in what those disciplines cost when you add layers. In a positional system, a change at any hop can ripple through every connected hop. Even mature observability can't map that ripple in advance. Tracing shows only the dependencies that happened, since no callee's policy lists the ones its owners approved.

## Position by Default Is the Failure

Does legitimacy come from who you are, or from where you sit?

Positional architecture becomes the wrong answer when it arrives by default rather than by deliberate commitment, when teams inherit the cost without making the trade-off explicit. Three questions expose the default:

- **Does this tier scale or fail differently from its neighbors?** If not, identity could enforce its layer without a deployment.
- **If this coordinator disappeared, would canonical state be lost?** If not, it is a bypass path, not a domain.
- **Does the callee check what this caller may do, or only that the call came from inside?** If only the latter, the interior is soft.

A system that earns its layers by living with the problems they solve is a different thing from one that inherits them from a diagram.
