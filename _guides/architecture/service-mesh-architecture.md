---
title: "Service Mesh Architecture"
layout: guide
category: Architecture
subcategory: Patterns
description: "How a service mesh moves service-to-service networking into infrastructure: data and control planes, sidecar and sidecarless data planes, mTLS and traffic management, how a mesh differs from an API gateway, when it earns its cost, and how Istio, Linkerd, and Consul compare."
tags: [advanced, service-mesh, istio, linkerd, mtls, ambient-mesh, sidecar]
---

A system with a handful of services can put retries, timeouts, encryption, and telemetry in a shared library and call it done. That stops working when the services are written in several languages, owned by many teams, and upgraded on different schedules. The library then exists in five versions across three languages, and a change to the retry policy is a coordinated release of every service.

A service mesh takes those concerns out of the services entirely. Every service-to-service call passes through a proxy the mesh controls, and the mesh configures all of those proxies from one place. Teams write business logic, and the platform decides how calls are encrypted, retried, routed, and measured.

## Data Plane and Control Plane

Every mesh has the same two halves.

The **data plane** is the set of proxies that actually carry traffic. Each call between services goes through at least one of them, which is where encryption, routing, retries, and metrics happen.

The **control plane** never touches request traffic. It watches the platform for services and endpoints, issues certificates that give each workload an identity, turns the operator's routing and security policy into proxy configuration, and pushes that configuration out to the data plane.

```
                        ┌───────────────────────────────┐
  operator policy ────▶ │         Control plane         │ ◀── watches services and
                        │  config · identity · certs    │     endpoints in the platform
                        └───────────────┬───────────────┘
                                        │ pushes config and certificates
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
  ┌──────────────────────────────┐        ┌──────────────────────────────┐
  │ Service A  ◀─▶  proxy        │ ◀────▶ │ proxy  ◀─▶  Service B        │
  └──────────────────────────────┘  mTLS  └──────────────────────────────┘
                              data plane (request traffic)
```

Because the control plane is out of the request path, a control plane outage stops configuration changes and new certificate issuance, but proxies keep serving traffic with the configuration they already have until their certificates expire.

On Kubernetes, the control plane doesn't need services to register themselves. It reads services and endpoints from the Kubernetes API and pushes changes to proxies as they happen, which is how the mesh reacts to instances appearing and disappearing faster than DNS caching would allow.

## Where the Proxies Run

Meshes differ most in how the data plane is deployed, and the choice drives most of a mesh's cost.

```
Sidecar model                           Sidecarless (per-node) model

Node                                    Node
┌────────────────────────────────┐      ┌────────────────────────────────────────────┐
│ Pod: [ Service A | proxy ]     │      │ Pod: [ Service A ]    Pod: [ Service B ]   │
│ Pod: [ Service B | proxy ]     │      │           │                   │            │
│ Pod: [ Service C | proxy ]     │      │           └──── node proxy ───┘            │
└────────────────────────────────┘      │           (L4: mTLS, identity)             │
one proxy per instance, handling        └────────────────────────────────────────────┘
L4 and L7 for that instance                       │ only where L7 policy applies
                                                  ▼
                                        shared L7 proxy per service or namespace
```

**Sidecar**: a proxy is injected into every workload instance, and network rules redirect the instance's traffic through it. Each proxy handles everything for its own instance, so isolation between workloads is strong and every feature is available everywhere. The cost is a proxy per instance, whether or not that instance uses more than encryption, and injecting or upgrading the proxy means restarting the workload.

**Sidecarless**: a shared proxy on each node handles the layer 4 work every workload needs, such as mutual TLS, identity, and connection-level authorization. Layer 7 processing, such as HTTP routing, retries, and request-level authorization, runs in separate shared proxies that traffic passes through only for services that need it. Workloads join and upgrade without restarts, and the fleet pays for layer 7 proxies only where layer 7 policy is used.

Istio's ambient mode is the most established sidecarless design. A per-node proxy called ztunnel provides the layer 4 secure overlay, and optional Envoy-based waypoint proxies provide layer 7 features per namespace or service. Ambient mode [reached general availability in Istio 1.24](https://istio.io/latest/blog/2024/ambient-reaches-ga/){:target="_blank" rel="noopener noreferrer"} in November 2024, and sidecar mode remains fully supported alongside it, with both able to run in the same mesh. Cilium takes a related approach, handling layer 4 in the Linux kernel with eBPF and using a shared proxy per node for layer 7.

The choice is no longer whether a mesh means sidecars. It is whether the workloads need layer 7 features everywhere, which favors sidecars, or mostly need encryption and identity with layer 7 in a few places, which favors a sidecarless data plane.

## What a Mesh Provides

### Identity, Mutual TLS, and Authorization

The control plane issues each workload a certificate identifying it by service identity rather than by IP address. Proxies use those certificates to establish mutual TLS on every connection, so both ends are authenticated and traffic is encrypted, and the certificates rotate automatically without the application ever handling a key.

Identity makes authorization possible at the proxy. A policy can say that only the checkout service may call the payment service, and that only on `POST /charges`, and the destination's proxy rejects anything else before it reaches application code. That is the foundation a zero-trust network needs. No call is trusted because of where it came from on the network, only because of the identity it proves.

The mesh secures traffic between services. It doesn't replace end-user authentication, which is still validated at the edge or by the service itself.

### Traffic Management

Because every call passes through a proxy the control plane configures, routing can change without touching the services involved.

- **Request routing** by header, path, or other request attributes, such as sending internal users to a new version
- **Weighted traffic splitting**, which is what canary releases use to send a small share of traffic to a new version
- **Traffic mirroring**, which sends a copy of live traffic to another version and discards its responses
- **Load balancing** per request, including for long-lived HTTP/2 connections that connection-level balancers route as a single unit
- **Timeouts, retries, and circuit breaking** configured as policy per route rather than coded per service
- **Fault injection**, adding delays or errors to test how callers cope

```
                         ┌──▶ reviews v1 (stable)   90%
caller ──▶ proxy ──split─┤
                         └──▶ reviews v2 (canary)   10%
```

Moving resilience policy into the mesh has one hazard. If the application also retries, the two layers multiply attempts. Decide which layer owns each policy.

### Observability

Every proxy sees every request it carries, so the mesh can report request rate, error rate, and latency for every service-to-service edge, and access logs for every call, without instrumenting any application. That produces a live dependency map of what actually calls what.

Tracing needs slightly more. The proxies generate spans, but a trace only connects across services if each application copies the incoming trace context headers onto its outgoing calls. The mesh can't do that step, because it can't see which inbound request caused a given outbound call.

## Mesh Gateways

The proxies inside the mesh handle traffic between services. Traffic crossing the mesh boundary goes through gateways, which are standalone proxies managed by the same control plane.

```
External client                              External API
      │                                            ▲
      ▼                                            │ TLS originated at the gateway
┌─────────────────┐                        ┌─────────────────┐
│ Ingress gateway │                        │ Egress gateway  │
│ external TLS,   │                        │ allow list,     │
│ mesh routing    │                        │ audit           │
└────────┬────────┘                        └────────▲────────┘
         │           mesh (mTLS inside)             │
         └──────▶ Service A ──────▶ Service B ──────┘
```

An **ingress gateway** brings external traffic into the mesh, so that routing and policy for external requests use the same configuration model as internal ones. An **egress gateway** gives outbound traffic to external services one controlled exit, where calls can be allowed or denied by destination, logged for audit, and given TLS toward the external service, and where outbound firewall rules have a single source to allow. Istio ships both kinds of gateway and configures them through the Kubernetes Gateway API. Linkerd deliberately ships no ingress gateway of its own and instead meshes whichever ingress controller the cluster already runs.

## Service Mesh and API Gateway

A mesh and an API gateway both put proxies in the path of requests, and both can route, authenticate, and rate limit. They answer different questions.

| Aspect | API gateway | Service mesh |
|--------|-------------|--------------|
| **Traffic** | North-south: external clients into the system | East-west: services calling each other |
| **Callers it authenticates** | End users and client applications, through API keys, OAuth tokens, or JWTs | Workloads, through mesh-issued certificates |
| **What it exposes** | A deliberately designed external API, often differing from internal service boundaries | Nothing new, since it manages calls between existing services |
| **Rate limiting** | Per client, per API key, per plan | Protecting a service from other services |
| **Transformation** | Commonly reshapes requests, responses, and protocols | Rarely, since traffic passes through in its original protocol |
| **Owned by** | Often an API or product team | Usually a platform team |

Most systems that run a mesh also run a gateway, with the gateway handling what external clients see and the mesh handling everything behind it. A mesh ingress gateway can serve as the edge for simple cases, but it lacks the API product features, such as developer keys, usage plans, and request transformation, that a dedicated gateway provides.

## When a Mesh Earns Its Cost

A mesh is infrastructure the platform team has to run, upgrade, and debug, and it sits in the path of every internal call. It pays off when the problems it solves are already being felt, not when they are anticipated.

| A mesh tends to pay off when | A mesh tends to cost more than it saves when |
|------------------------------|----------------------------------------------|
| Services span several languages, so a shared library can't give them all the same behavior | One language and framework, where a shared library already standardizes retries, TLS, and telemetry |
| Encryption in transit and service identity are required everywhere, such as for zero-trust or compliance | Internal traffic doesn't need per-service identity, or a cloud platform already provides encryption between services |
| Retry, timeout, and TLS behavior is inconsistent across teams and causing incidents | Few enough services that consistency is a code review, not a platform |
| Teams need progressive delivery, such as canaries, across many services | Deployments are infrequent and whole-service |
| A platform team exists with capacity to operate it | Nobody is staffed to own the mesh's upgrades and incidents |

The count of services is a weak signal on its own. A few dozen services in one language with a good shared library may never need a mesh, while a smaller estate with strict mutual TLS requirements across three languages may need one early.

## Implementations

### Istio

Launched in 2017 by Google, IBM, and Lyft, Istio is the most feature-complete of the widely used meshes. Its control plane is a single binary, istiod, and its data plane is Envoy, either as sidecars or in ambient mode with ztunnel and waypoint proxies. It has the broadest traffic management, including mirroring and fault injection, extensive multi-cluster topologies, and support for workloads on virtual machines. The cost is surface area. There is a lot of configuration to learn, and a misconfigured mesh can break traffic in correspondingly varied ways.

### Linkerd

Linkerd optimizes for operational simplicity. It uses its own purpose-built proxy written in Rust rather than Envoy, installs with automatic mutual TLS on by default, and exposes a smaller set of opinionated features. It runs its control plane on Kubernetes, and since version 2.15 can extend the mesh to workloads on virtual machines and other non-Kubernetes hosts. Check Linkerd's release model before adopting it. Since February 2024 the open source project publishes only edge releases, and stable release builds come from vendors, primarily Buoyant, the company that created Linkerd, as Buoyant Enterprise for Linkerd.

### Consul Service Mesh

HashiCorp Consul's mesh, formerly called Consul Connect, builds on Consul's service catalog and uses Envoy as its data plane. Its distinguishing strength is breadth of platform. The same mesh can span Kubernetes, virtual machines, Nomad, and Amazon ECS, and federate across data centers, which suits organizations whose workloads aren't all on Kubernetes and that already run Consul for service discovery.

| | Istio | Linkerd | Consul service mesh |
|---|-------|---------|---------------------|
| **Data plane** | Envoy sidecars, or ambient ztunnel plus Envoy waypoints | Linkerd's own Rust proxy, as sidecars | Envoy sidecars |
| **Sidecarless option** | Yes, ambient mode | No | No |
| **Platforms** | Kubernetes, with VM workloads | Kubernetes control plane, with VM workloads since 2.15 | Kubernetes, VMs, Nomad, ECS |
| **Feature scope** | Broadest, including mirroring and fault injection | Focused core: mTLS, routing, retries, timeouts, observability | Broad, centered on service discovery and multi-platform networking |
| **Operational weight** | Highest configuration surface | Lowest | Moderate, plus running Consul itself |
| **Suits** | Complex traffic requirements, large multi-cluster estates | Teams wanting mTLS and observability with minimal operation | Mixed Kubernetes and non-Kubernetes estates |

## Adopting a Mesh

Enable one capability at a time, in order of risk. Observability first, since it changes nothing about traffic and immediately shows what calls what. Mutual TLS next, starting in a permissive mode that accepts both encrypted and plain traffic, then enforcing it once every workload is in the mesh. Traffic policy, such as retries, timeouts, and splitting, comes last, because a wrong route or an aggressive retry changes production behavior directly.

Start with a few services that aren't on the critical path, and measure the overhead on them before expanding. Proxy memory, CPU, and added latency depend on the data plane model, traffic volume, and configuration size, so the numbers that matter are the ones measured on your own workloads. Istio publishes its own [performance and scalability measurements](https://istio.io/latest/docs/ops/deployment/performance-and-scalability/){:target="_blank" rel="noopener noreferrer"} per release as a starting reference.

Keep a way out. Removing a namespace's injection label or ambient enrollment should return its workloads to plain networking, and that path should be tested before it is needed, since a mesh misconfiguration can break every call in the namespace at once. Mesh upgrades also need planning, because the control plane and data plane versions have to stay within the skew the mesh supports.

## Quick Reference

| Concept | What it is | Why it matters |
|---------|------------|----------------|
| **Data plane** | The proxies carrying service-to-service traffic | Where encryption, routing, retries, and metrics actually happen |
| **Control plane** | The component configuring proxies and issuing identities | Out of the request path, so its outage freezes configuration, not traffic |
| **Sidecar data plane** | A proxy in every workload instance | Every feature everywhere, at a per-instance cost |
| **Sidecarless data plane** | Per-node layer 4 proxies plus shared layer 7 proxies | Lower cost when most workloads only need mTLS and identity |
| **Mutual TLS** | Both ends authenticate with mesh-issued certificates | Encryption and workload identity without application changes |
| **Ingress and egress gateways** | Proxies at the mesh boundary | One controlled path in and one controlled path out |
| **Mesh vs API gateway** | East-west workload traffic vs north-south client traffic | Most systems with a mesh still need a gateway |
