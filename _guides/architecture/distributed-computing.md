---
layout: guide
title: "Distributed Computing Fundamentals"
category: Architecture
subcategory: Foundations
description: "The fallacies of distributed computing, including three added by Mark Richards and Neal Ford, the architecture quantum and its static and dynamic coupling, and how to decide whether a system should be distributed at all."
tags: [fundamentals, fallacies-of-distributed-computing, architecture-quantum, static-coupling, dynamic-coupling, monolith-vs-distributed]
---

Distributed systems promise scalability, resilience, and team independence, but they introduce complexity that a single deployable system never has to face. Understanding where that complexity comes from, and what actually defines a boundary between independent parts, helps architects choose the right amount of distribution for their context.

<blockquote class="pull-quote">
<p>The network is reliable. Latency is zero. Bandwidth is infinite. These assumptions seem reasonable until production proves otherwise.</p>
</blockquote>

## The Fallacies of Distributed Computing

*Catalogued at Sun Microsystems in the 1990s. The first seven are most often credited to L Peter Deutsch and colleagues, and James Gosling is credited with the eighth.*

The fallacies are assumptions that hold inside a single process and quietly break once calls cross a network. Teams moving from monolithic to distributed architectures tend to make them without noticing, because the code for a local call and a remote call can look almost identical.

### The Original Eight

| Fallacy | What actually happens | Design response |
|---|---|---|
| **The network is reliable** | Packets are lost, connections drop, and hosts become unreachable | Treat network failure as a normal condition. Set timeouts on every call, retry with backoff, and stop calling dependencies that keep failing |
| **Latency is zero** | A remote call is orders of magnitude slower than an in-process call | Minimize round trips, avoid chatty APIs, batch where possible, and use asynchronous communication when an immediate answer isn't needed |
| **Bandwidth is infinite** | Bandwidth is limited, shared, and in the cloud, billed | Keep payloads small, paginate large result sets, and compress bulk transfers |
| **The network is secure** | Traffic crosses infrastructure you don't control and can be intercepted or altered | Encrypt in transit, authenticate every request, and authorize every operation |
| **Topology doesn't change** | Instances scale, move, fail, and get replaced, so addresses change constantly | Use service discovery rather than hardcoded addresses, and let health checks route around failures |
| **There is one administrator** | Different teams and vendors own different parts of the system | Make dependencies explicit through versioned contracts, and communicate changes early |
| **Transport cost is zero** | Serialization consumes CPU and memory, and network traffic costs money | Count transport cost in the design. Sometimes consolidating services is cheaper than calling between them |
| **The network is homogeneous** | Hardware, operating systems, protocols, and software versions vary | Use standard protocols and formats, and version interfaces |

### Three Fallacies Added by Richards and Ford

Mark Richards and Neal Ford have proposed three more assumptions that distributed architectures break ([Thoughtworks Technology Podcast, 2025](https://www.thoughtworks.com/en-us/insights/podcasts/technology-podcasts/three-new-fallacies-distributed-computing){:target="_blank" rel="noopener noreferrer"}).

**Versioning is easy.** Rolling deployments run old and new versions of a service side by side, and clients upgrade on their own schedules. Every contract change has to work with both sides for as long as both exist, which turns schema evolution and backward compatibility into ongoing design work rather than a one-time step.

**Compensating updates always work.** Distributed workflows often undo a failed step by running a compensating update, such as refunding a charge after a shipment fails. But the compensating update can fail too, and some effects can't be undone at all, like an email already sent or a physical item already shipped. Designs need a plan for when compensation itself fails.

**Observability is optional.** In a monolith, a stack trace often shows where a request failed. In a distributed system, one request crosses many services, and without distributed tracing, structured logging, and metrics, diagnosing a failure becomes guesswork. Observability has to be built in from the start.

## The Architecture Quantum

*Definition from Neal Ford, Mark Richards, Pramod Sadalage, and Zhamak Dehghani, Software Architecture: The Hard Parts (2021)*

<blockquote class="pull-quote">
<p>An architecture quantum is the smallest part of a system that can be deployed, and can run, on its own.</p>
</blockquote>

An architecture quantum is an independently deployable artifact with high functional cohesion, high static coupling, and synchronous dynamic coupling. Each part of that definition does specific work.

**Independently deployable** means the quantum can be released without releasing any other part of the system. It has its own deployment pipeline and release schedule.

**High functional cohesion** means the quantum does something purposeful and complete, such as handling a business capability end to end.

**High static coupling** means everything the quantum needs in order to run belongs to it, including its database, broker, and shared libraries. Two services that share a database are one quantum, however separately they deploy, because neither can run correctly without the shared piece.

**Synchronous dynamic coupling** means components that call each other synchronously are part of the same quantum at runtime. If one must wait for the other's response, the two must be available together and effectively share operational characteristics like availability and scalability.

### Static and Dynamic Coupling

The definition rests on two kinds of coupling.

**Static coupling** is how the system is wired. It covers the dependencies a quantum needs just to start and function, such as its contracts, libraries, databases, and message brokers. It is visible in the code and the deployment configuration.

**Dynamic coupling** is how quanta interact while running. It varies along three dimensions:

- **Communication**: synchronous or asynchronous
- **Consistency**: atomic transactions or eventual consistency
- **Coordination**: a central orchestrator or independent choreography

Communication is the dimension that decides quantum boundaries. A synchronous call binds the caller to the callee's availability. An asynchronous message lets each side continue when the other is slow or down.

```
Synchronous call: one quantum            Asynchronous message: two quanta

┌──────────────────────────────────┐     ┌───────────┐          ┌───────────┐
│  Order ─── request ──▶ Payment   │     │   Order   │─▶ queue ─▶│  Payment  │
│        ◀── response ──           │     └───────────┘          └───────────┘
└──────────────────────────────────┘

If Payment is down, orders stop.         If Payment is down, orders wait in
                                         the queue and are paid later.
```

### Why Quanta Matter

The number of quanta shapes the rest of the architecture. Each quantum can use its own technology, scale on its own, deploy on its own schedule, and belong to its own team, and each can have its own architecture characteristics. More quanta give more of that flexibility.

More quanta also cost more to operate. Distributed tracing, service discovery, network failures, data consistency, and failure handling all get harder with every boundary added.

A few examples show how the definition plays out:

**Single quantum**: An e-commerce application deployed as one unit. Cart, checkout, inventory, and user management all deploy together, and a change to any of them redeploys the whole application.

**Multiple quanta**: Separate order, payment, and inventory services, each with its own database, communicating through events. Each deploys and fails independently.

**Hidden single quantum**: Three services that deploy separately but share one database, or call each other synchronously on every request. They look like three quanta and behave like one, with the operational cost of distribution and the coupling of a monolith.

## Monolith vs Distributed: Making the Decision

The choice between a monolithic and a distributed architecture is a spectrum, not a switch. The questions below help place a system on it.

| Question | Points toward monolithic | Points toward distributed |
|---|---|---|
| Do different parts need different architecture characteristics? | No, one set suffices | Yes, parts differ in scalability, availability, or other needs |
| How critical is independent scalability? | Load is modest or uniform | Load is high or varies sharply between parts |
| Do teams need to deploy independently? | One team, or teams that release together | Several teams blocked by a shared release |
| Are domain boundaries clear and stable? | Unclear or still changing | Clear and stable |
| How mature is operational practice? | Limited experience running distributed systems | Established automation, observability, and incident response |
| How tight are cost and complexity constraints? | Tight | Distribution's cost is justified by the benefits |

If most answers point toward monolithic, start there. A system can distribute later as needs emerge, and moving from distributed back to monolithic tends to be the harder direction.

<div class="callout callout--tip">
<p class="callout__title">The Modular Monolith Middle Ground</p>
<p>A modular monolith keeps a single deployment while organizing code into well-defined modules with clear boundaries. It delivers clear domain boundaries, easier refactoring, and a path to future distribution, while keeping operational complexity low. Many systems are well served by starting as a modular monolith and distributing only the parts whose needs justify it.</p>
</div>

The best architecture is the simplest one that meets the requirements. Distribution is a tool, not a goal.
