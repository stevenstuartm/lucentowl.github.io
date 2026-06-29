---
layout: post
title: "Topology Is Not a Trust Model"
date: 2026-06-19
description: "Whether a service request is legitimate is treated as an authentication question, but the answer is also an architectural one: whether legitimacy comes from network position or from verified ownership. That distinction shapes service structure, security posture, and team dynamics in ways that compound as systems grow."
tags: [architecture, api-design, distributed-systems, security, design-patterns, microservices]
---

Every service request arrives with the same question: what makes this request legitimate? It is a question I return to often, because the answer almost always reveals a belief about architecture that was never made explicit.

Most teams treat this as an authentication problem, but the answer shapes how services are structured, where trust boundaries sit, and how teams own their work.

**Positional architecture**: legitimacy granted by placement.
A request is legitimate because it arrived from the right place, to the right place: from behind the perimeter, through the right intermediaries, from a subnet the architecture trusts, or toward a service that grants access on that same basis.

**Identity-oriented architecture**: legitimacy earned by ownership.
A request is legitimate because the caller has proven who it is and what it is authorized to do. Credentials name its bounded scope, not just its network address. Every service validates every caller the same way, and all services relate to each other as peers with clear, bounded authority over their own domains.

The choice typically reflects a single belief about where legitimacy comes from, and that belief determines where authority lives in the system, how teams own their work, and whether the system can adapt as the domain evolves.

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

The checkout client presents credentials each domain service validates directly. When OrderService calls PaymentService, it presents its own service identity; the client's token is never forwarded.

## Bounded Authority

### Authority Is Canonical Ownership

Authority is ownership: a domain service holds the canonical representation of its data, the validation rules governing it, and the contract it exposes. When multiple components claim authority over the same facts, each enforces subtly different rules. No component is the definitive answer, and the drift between them is slow, then sudden.

### The Coordination Objection

The most compelling argument for adding an orchestration layer is avoiding the death star: an uncontrolled web of lateral calls between peer services where no component owns the full decision. Cascading call chains are a sound instinct; a service should call domains it genuinely depends on, not reach sideways into peers that own unrelated concerns. Positional architecture uses layer placement to enforce the cascade, but placement without authority creates pass-through components that fragment the very authority they were supposed to preserve. When authority has broken down, sideways calls become necessary because no single component owns the full decision.

Bounded authority inverts this: a service with tight, well-named scope has no need to reach sideways for decisions it already owns. When one bounded domain genuinely needs to coordinate with another, the call is direct and well-understood. The concern about sibling calls disappears when those siblings are precisely named and their authority is unambiguous. **The tangled dependencies of a death star emerge from many poorly bounded components, not from well-bounded ones communicating directly.**

### A Tier Must Earn Its Place

A layer is a conceptual separation of concerns (domain logic from presentation, for instance) that identity can enforce without a dedicated service sitting between the callers. A tier exists because behaviors need to scale or fail independently. A worker tier has different throughput, concurrency, and instance allocation from the service that enqueues into it; the physical separation is required by operational reality. A facade tier that routes and shapes for a single consumer has no such requirement; identity enforces the same boundary without the deployment cost. Positional architecture conflates these, adding tiers to enforce layers and using placement where identity would suffice. The critique is not of tiers but of tiers that answer no operational question.

### Legitimate Coordination

When a multi-step workflow genuinely requires coordination across bounded domains, there are two legitimate forms.

**Choreography**: each service reacts to domain events it subscribes to, applying its own authority to its own concern. No central coordinator sits in the call path; the workflow emerges from the sequence of autonomous reactions. Events are records of decisions domain services have already made, not instructions to other services. An event mechanism that begins routing on business rules has claimed authority over those decisions; it is a positional layer disguised as infrastructure.

```
Client
  │ [checkout token]
  ▼
CheckoutService ── publishes checkout.initiated
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
       OrderService             PaymentService
      [own authority]           [own authority]
    publishes order.created   publishes payment.authorized
```

**Lifecycle ownership**: a domain service owns the process itself. CheckoutService is not a positional orchestrator if it holds the canonical state of the checkout: when it started, what steps have completed, what its terminal states are. Each sub-service validates CheckoutService's identity directly; it calls them as a peer with bounded authority, not as a layer above them.

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

Remove the coordinator and ask whether canonical state is lost. If yes, the service is a domain, not a layer. If no: all state lives in the sub-services and the coordinator exists only to sequence calls. It becomes what the shared database was in an earlier decomposition: a bypass path that dissolves the authority boundaries the architecture was meant to enforce.

A coordinator whose name reflects a process lifecycle has a genuine authority claim; one named for the services it coordinates, or for every concern it touches, does not. The name is a symptom; the underlying question is always what the service is the definitive source of truth for.

What makes any composite structure legitimate is that every participant holds genuine authority over its own concern, not that it occupies the correct layer position.

## How Positional Architecture Accumulates

Positional architecture can be a deliberate choice; when it is, its trade-offs should be known and accepted. More often it arrives through one of a few recurring paths, each reasonable on its own terms, none of which examined the trust model they were collectively building.

- **Organic accumulation**: a facade added for consumer shaping, an orchestrator grown to coordinate a flow no single service owned, an adapter added for a protocol mismatch. Each decision was reasonable when made; the architecture they collectively implied was not.
- **Pattern cargo-culting**: Companies like Netflix and Uber evolved their layers in response to specific scaling pressures visible in their public postmortems, pressures most teams haven't faced and won't. Teams that copy the pattern have a new domain, a smaller team, and a system that hasn't revealed where the real scaling pressure will sit.
- **Compliance overreach**: PCI-DSS mandates network isolation for the Cardholder Data Environment specifically, not for service architectures generally. HIPAA, SOX, and GDPR prescribe access controls and data protection outcomes; none specify network topology. The pressure toward perimeter models typically comes from implementation guidance and audit practices, not from the frameworks' own text.

The cases where positional architecture genuinely earns its cost are narrow. The one scenario that legitimately forces a specific boundary component is integration with systems outside your change control: acquisitions, partner APIs, and legacy systems that can't support identity-oriented calls. A facade at that boundary is a quarantine scoped to one boundary, not a commitment to positional architecture throughout the system. Almost every other use arrived through one of the paths above, and the controls that would justify it arrive later, applied unevenly, because delivery pressure consistently wins.

## What Positional Architecture Costs

The costs compound predictably as the system grows:

- Debugging requires tracing the entire layer topology; a one-hour fix often takes a day
- Change velocity slows because a domain model change requires coordinated updates across every dependent layer
- Testing multiplies because you need unit tests at each layer, contract tests between layers, and integration tests across the full stack
- Infrastructure costs compound at every layer, sometimes several times per external request
- Capacity planning is nonlinear because one unit of external load fans out to multiple internal calls with different resource profiles at each layer

The real coupling is not shared code but shared call chains: every consumer request travels through the same intermediary services in the same order, and every intermediary couples to the services below it. The layers are separate deployments with separate teams, but a change in any domain service propagates upward through every adapter and facade that depends on it, exactly as it would in a tightly coupled monolith. Every positional system carries the full cost of distributed architecture, including separate deployments, coordinated releases, and network hops, without the independence those costs were supposed to buy.

In identity-oriented architecture, a consumer calls a domain service directly; that service may call one or more supporting services, but the chain ends there. Each service can be reasoned about, scaled, and deployed on its own terms.

At sufficient coupling depth, a true monolith is more defensible: it at least eliminates network hops, serialization overhead, and the coordination cost of deploying multiple services to ship a single feature. Those costs are the price of independence. When independence was never achieved, the price is paid with nothing received in return.

## What Identity-Oriented Architecture Costs

Identity-oriented architecture carries its own operational costs. Every service credential requires a lifecycle: issuance, rotation, and revocation. Token expiry windows and revocation propagation require deliberate design rather than implicit trust. At scale, this becomes a distributed secrets management problem that positional architecture sidesteps by treating network membership as sufficient proof. The infrastructure for it, including workload identity systems and secrets managers, has matured, but the cost is front-loaded: teams pay it before the system is large enough for positional architecture's costs to become visible. That timing asymmetry is part of what makes the positional default durable.

## The Asymmetric Security Posture of Positional Systems

A positional system built to its full specification is the most controlled environment available: mutual TLS on every hop, audit logging at every tier, explicit authorization at each layer. The security problem is not the model; it is the belief that sustains the model and what that belief implies about where security effort should be concentrated.

### Network Membership Is Not Identity

In a positional system, a service's authority comes from its layer placement. Its identity is its tier: facade-tier service, orchestration-tier service, domain-tier service. When that service authenticates to call another, the most natural credential is one that proves it belongs to the trusted network: a cert granted by the internal CA, a service mesh identity that says "internal." That credential proves network citizenship, not bounded identity. It answers "are you one of us?" rather than "are you specifically OrderService with authority over orders?"

Teams in positional systems concentrate security effort at the edge because the edge is where external callers prove they belong. Everything behind it applies implicit trust, because belonging to the internal network already proved legitimacy.

That trust model is exactly what attackers exploit. A single vulnerability such as server-side request forgery, request smuggling, or a compromised internal service gives access to the entire soft interior. The blast radius is the full internal network, not the narrow scope of whatever was actually breached: the difference between rotating one service's credentials and conducting a full incident response across every internal system.

### Authentication Is Not Authorization

The counter-argument is that service meshes like Istio and Linkerd can retrofit mutual TLS and per-hop authentication onto a positional system without changing service code. That solves authentication, not authorization. A mesh-issued cert says "authenticated internal service." It does not say "OrderService, authorized for these operations on order data." A compromised internal service holds an equally valid cert; the mesh cannot tell the difference because the credential encodes network membership, not bounded ownership. The mechanism changed; what it proves didn't.

The distinction is clearance versus need-to-know. A top secret clearance does not entitle the holder to every document at that level; each access still requires a demonstrable need for this specific information. A service mesh cert that proves "authenticated internal service" is a clearance: it proves tier membership and nothing else. Positional architectures treat it as sufficient authorization; identity-oriented architectures demand need-to-know: a bounded authority claim for this caller, independent of where it sits in the network.

Identity-oriented architecture inverts this at the root. Every service presents credentials that prove a specific bounded identity: not "I'm internal" but "I'm OrderService, authorized for these operations on order data." A compromised component can only act within its authorization scope. The security model and the architectural model are aligned because they share the same belief: legitimacy comes from what you are, not from where you sit.

### The Attack Surface Objection Is Circular

A common gut response is that identity-oriented architecture increases the attack surface by exposing domain services directly.

Attack surface is a count of publicly reachable endpoints, and nothing about positional architecture bounds that count. A positional system can grow its public layer without end; every new consumer-facing feature adds endpoints regardless of whether intermediary tiers exist.

In an identity-oriented system, rate limiting, IP flagging, geographic constraints, and gateway-level checks apply everywhere without exception, because there is no interior to fall back on. Positional architecture doesn't make the public layer more secure than a well-secured identity-oriented one; it adds internal layers that receive implicit trust, while the identity-oriented system applies the same controls to every surface.

## Layer Boundaries Become Team Boundaries

Positional architecture tends to produce horizontal teams organized around the layers themselves. The backend team owns domain services, the platform team owns orchestration, the API team owns the external facade. Each team's incentives point inward; the backend team is rewarded for internal quality, not consumer outcomes, and the orchestration team optimizes for the calls it coordinates rather than the features consumers need. Every capability that crosses a layer boundary requires coordination, negotiation, and synchronized releases.

This is Conway's Law expressed architecturally: organizations design systems that mirror their communication structures, then their communication structures solidify around those systems. The result is teams in conflict about the architecture rather than the product. Who owns the latency that appeared between the orchestrator and the domain service? Whose responsibility is it when the contract between the facade and the adapter breaks? These arguments look like culture problems when they're actually architectural ones. The clearest sign that an architecture is serving itself rather than its system is when teams spend more time reasoning about which layer a change belongs to than building the change.

## The Discipline Objection

The most common response is that teams with strong governance, comprehensive testing, and mature observability can operate positional systems effectively. A well-governed positional system beats an undisciplined identity-oriented one. Penetration testing, contract testing between layers, and distributed tracing across hops all work, and teams that apply them consistently can operate positional systems at scale.

The objection treats discipline as an architectural substitute, and it isn't. Both styles require the same disciplines. The difference is what those disciplines cost when you add layers: in a positional system, a change at any hop can ripple through every connected hop, and the connections aren't visible without tracing the full topology. In an identity-oriented system, the discipline a team applies to its own domain stays local; in a positional system, that discipline multiplies across a topology that grows with the system.

## Conclusion

Does legitimacy come from who you are, or from where you sit? Positional architecture defaults toward position as the answer; identity-oriented architecture answers with ownership, and communication structure follows from that rather than preceding it. A system built to control communication paths will keep needing to control them as the domain evolves, because the structure was never derived from the domain.

Positional architecture becomes the wrong answer when it arrives by default rather than by deliberate commitment, when teams inherit the cost without making the trade-off explicit. A system that earns its layers by living with the problems they solve is a different thing from one that inherits them from a diagram.
