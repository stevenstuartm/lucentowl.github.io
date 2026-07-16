---
title: "Azure Load Balancer & Application Gateway"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure Load Balancer and Application Gateway distribute regional traffic, why the pass-through versus terminating proxy distinction now matters more than the Layer 4/Layer 7 split, and how to choose between them for production deployments."
tags: [load-balancer, application-gateway, waf, health-probes, snat, agic, practical]
---

## What Are Azure's Regional Load Balancers

Azure provides two regional load balancing services, and they handle the client's connection in different ways.

[Azure Load Balancer](https://learn.microsoft.com/en-us/azure/load-balancer/load-balancer-overview){:target="_blank" rel="noopener noreferrer"} distributes inbound TCP and UDP flows across backend instances using a hash-based algorithm. It does not inspect packet payloads, does not understand HTTP, and does not terminate connections. It is fully managed with no user-accessible instances.

[Azure Application Gateway](https://learn.microsoft.com/en-us/azure/application-gateway/overview){:target="_blank" rel="noopener noreferrer"} is a reverse proxy. It terminates the client's connection and opens a separate connection to a backend server. That termination is what enables routing decisions based on URL paths, hostnames, and headers, and since v2 gained [TCP/TLS proxying](https://learn.microsoft.com/en-us/azure/application-gateway/tcp-tls-proxy-overview){:target="_blank" rel="noopener noreferrer"} it terminates non-HTTP traffic as well.

### Pass-Through Versus Terminating

The OSI layer each service operates at is the usual way to tell these apart, and it used to be sufficient. Application Gateway now proxies TCP and TLS alongside HTTP, so "Layer 4 means Load Balancer" no longer settles the question. What still separates them is what happens to the client's connection.

```
Pass-through (Load Balancer)         Terminating proxy (Application Gateway)

  Client                               Client
    │                                    │
    │                                    │  connection 1
    ▼                                    ▼
┌──────────────┐                  ┌───────────────┐
│Load Balancer │ rewrites         │ App Gateway   │ terminates TLS,
│              │ addresses,       │               │ inspects request,
│              │ forwards packets │               │ routes
└──────────────┘                  └───────────────┘
    │                                    │
    │                                    │  connection 2
    ▼                                    ▼
┌──────────┐                      ┌──────────┐
│Backend VM│                      │Backend VM│
└──────────┘                      └──────────┘

 ONE TCP connection,               TWO TCP connections.
 client to backend.                Backend sees the gateway's IP;
 Backend sees the client's         the client IP survives only in
 real source IP.                   the X-Forwarded-For header.
```

Three consequences follow from that difference, and they drive most decisions between the two services.

**Client IP.** Pass-through preserves the original source IP all the way to the backend, so IP-based logic in your application works without changes. Behind Application Gateway, the backend sees the gateway, and recovering the client IP means reading `X-Forwarded-For`.

**Protocol transparency.** A pass-through device doesn't care what rides on top of TCP, so anything the client and backend both speak works through it. A terminating proxy re-speaks the protocol, which means it can only carry protocols it implements. This is why gRPC fails behind Application Gateway even though HTTP/2 appears on its feature list, covered under [AKS Integration](#aks-integration-agic-and-application-gateway-for-containers) below.

**Latency.** Load Balancer adds negligible latency because no connection is established on its behalf. Termination costs a handshake, which is usually irrelevant for web traffic and can matter for chatty internal tier-to-tier calls.

---

## Azure Load Balancer

### How It Works

Load Balancer distributes connections across backend pool instances using a five-tuple hash by default: source IP, source port, destination IP, destination port, and protocol. Each new connection may land on a different backend instance. It is fully managed and horizontally scaled, with no instances you provision or see.

### Public vs Internal

**Public Load Balancer** has a public frontend IP address. It receives inbound traffic from the internet and distributes it to the backend pool. It also provides outbound connectivity for backend VMs through outbound rules.

**Internal Load Balancer** uses a private frontend IP within a VNet. It distributes traffic entirely within the VNet or from peered VNets. There is no internet exposure. This is the standard pattern for tier-to-tier traffic (web-to-app, app-to-database).

Both types can coexist on the same backend pool. A VM can be behind both a public and internal load balancer simultaneously.

**A backend pool is scoped to one VNet.** Every instance in it must live in the same virtual network as the load balancer, and this is the constraint that shapes hub-and-spoke designs. Reach is asymmetric. An internal frontend can be reached from peered VNets, including across regions via Global VNet Peering and from other tenants via Private Link, but the backends themselves cannot be spread across VNets. Balancing across VNets means one load balancer per VNet with something in front of them.

### SKUs

Load Balancer has three SKUs, and the retirement of Basic left two live ones that serve unrelated purposes.

| SKU | Status | Purpose |
|-----|--------|---------|
| **Basic** | Retired September 30, 2025 | None. Open to inbound by default, no zones, no SLA. |
| **Standard** | Current | General-purpose L4 load balancing, inbound and outbound. |
| **Gateway** | Current | Transparent insertion of third-party network virtual appliances. |

Standard is the SKU meant when "Azure Load Balancer" is used without qualification, and it provides:

- Backend pools up to 5,000 instances, NIC-based or IP-based
- Health probes via TCP, HTTP, and HTTPS
- Availability zone support (zone-redundant and zonal frontends)
- Outbound rules for explicit SNAT control
- HA ports for load balancing all protocols and ports simultaneously
- Global tier for cross-region load balancing
- 99.99% SLA
- Closed to inbound by default (NSG required to allow traffic)

Gateway SKU is a different product wearing the load balancer name, and it is covered under [Gateway Load Balancer](#gateway-load-balancer-for-nva-insertion) below. Choosing between Standard and Gateway is not a scale or pricing decision the way Basic versus Standard was. You reach for Gateway only when inserting appliances into a traffic path.

### Distribution Modes

| Mode | Hash Components | Session Persistence | Behavior |
|------|----------------|-------------------|----------|
| **Five-tuple (default)** | Source IP + Source Port + Dest IP + Dest Port + Protocol | None | Each new connection may land on a different backend |
| **Two-tuple** | Source IP + Destination IP | Client IP | All connections from the same client IP go to the same backend |
| **Three-tuple** | Source IP + Dest IP + Protocol | Client IP and Protocol | Same client IP using same protocol always reaches same backend |

Source IP affinity (two-tuple/three-tuple) can cause uneven distribution when many clients sit behind a single proxy or NAT device, since all their traffic appears to come from one IP.

### Health Probes

| Probe Type | Success Condition | Notes |
|-----------|------------------|-------|
| **TCP** | Three-way handshake completes | Validates only that the port is open |
| **HTTP** | Returns exactly HTTP 200 OK | Only 200 is healthy, not the 2xx range |
| **HTTPS** | Returns exactly HTTP 200 OK | Includes TLS handshake. Requires SHA256+ signatures through the whole chain |

The HTTP probe accepting only 200 catches teams out, because Application Gateway's probe accepts the entire 200-399 range. A backend that answers `204 No Content` or redirects its health endpoint is healthy to one service and dead to the other.

Probes originate from IP address `168.63.129.16`, identified by the `AzureLoadBalancer` service tag, which NSGs permit by default. IPv6 probes come from a link-local address instead, so a dual-stack load balancer needs its own NSG rule for the IPv6 probe to work.

**Probe parameters:**
- **Interval:** The Azure portal defaults to 5 seconds. ARM, Bicep, REST, and Terraform default to **15 seconds** (minimum 5), so the same "default" probe reacts three times slower when deployed as code than when clicked together in the portal.
- **Timeout:** HTTP and HTTPS probes time out at 30 seconds and this is not configurable. TCP probes have no timeout at all. They fail once the interval elapses and the next probe fires.
- **Unhealthy threshold:** The number of consecutive failures before the instance leaves rotation. For HTTP probes this only governs timeouts, because an explicit non-200 response marks the instance down immediately.
- **Grace period:** After an instance fluctuates between healthy and unhealthy, the load balancer intentionally waits longer before restoring it.

Probe a port that reflects the health of the instance itself, and never one the instance proxies to another machine. If a probe answer depends on some other VM, one unhealthy backend can mark down every instance in front of it and cascade the failure across the pool. This bites hardest in NVA deployments, where proxying is exactly what the appliance does for a living.

### Outbound Rules and SNAT

Standard Load Balancer provides explicit outbound connectivity through outbound rules. Each public IP added as a frontend contributes 64,000 ports eligible for SNAT, and outbound rules let you divide those ports across the backend pool yourself. Idle connections release their ports after a configurable 4 to 120 minutes, defaulting to 4.

The alternative is to let Azure allocate ports automatically, and the trap is that automatic allocation shrinks as the pool grows:

| Backend pool size (VM instances) | Default SNAT ports per instance |
|---|---|
| 1-50 | 1,024 |
| 51-100 | 512 |
| 101-200 | 256 |
| 201-400 | 128 |
| 401-800 | 64 |
| 801-1,000 | 32 |

Those figures are per frontend IP, and adding frontend IPs raises the allocation only up to a hard ceiling of 1,024 ports per instance. So 1,024 ports per VM is not the default; it is the *best case*, available to pools of 50 or fewer. Scale a 40-VM pool to 120 VMs and each instance silently drops from 1,024 ports to 256, meaning the scale-out intended to handle more load cut per-instance outbound capacity by a factor of four. Microsoft recommends against default allocation for production workloads for exactly this reason.

**SNAT exhaustion** manifests as intermittent connection failures from backend VMs to external endpoints, and it is miserable to diagnose because the load balancer can still show unused ports overall while an individual instance has none left. Monitor the "SNAT Connection Count" metric in Azure Monitor to catch it before it causes outages.

For workloads with high outbound connection rates, Azure NAT Gateway is the better answer and Microsoft ranks it above load balancer outbound rules for every outbound scenario. It allocates ports dynamically across a subnet rather than pinning a fixed slice to each VM, which removes the class of problem the table above creates. NAT Gateway also takes precedence over load balancer outbound rules when both are configured on a subnet. Where the destination is an Azure PaaS service, Private Link avoids SNAT altogether.

### HA Ports

HA Ports is a load balancing rule that distributes all TCP and UDP flows on all ports simultaneously. It is available only on Internal Standard Load Balancer.

**Configuration:** Frontend port = 0, Backend port = 0, Protocol = All.

**Primary use cases:**
- Network Virtual Appliances (Azure Firewall, third-party firewalls, IDS/IPS)
- Any scenario needing to load balance all ports without enumerating each one
- SQL AlwaysOn when combined with floating IP

### Gateway Load Balancer for NVA Insertion

[Gateway Load Balancer](https://learn.microsoft.com/en-us/azure/load-balancer/gateway-overview){:target="_blank" rel="noopener noreferrer"} is a separate SKU built for one job. It puts third-party appliances like firewalls, IDS/IPS, and packet analytics in the path of traffic to a public endpoint without rebuilding your routing.

The mechanism is *chaining* rather than routing. A Standard public load balancer frontend, or a VM's public IP configuration, holds a reference to a Gateway Load Balancer frontend. That reference is the entire configuration. Traffic is encapsulated in VXLAN, detoured through the appliance pool, and returned to the consumer resource with the original source IP intact.

```
   Internet
      │
      ▼
┌──────────────────────┐        ┌──────────────────────────┐
│  Public Standard LB  │  VXLAN │  Gateway Load Balancer   │
│  (consumer VNet)     │───────▶│  (provider VNet, and     │
│                      │        │   optionally another     │
│  frontend chained to │◀───────│   subscription/tenant)   │
│  the Gateway LB      │ return └──────────────────────────┘
└──────────────────────┘                  │      ▲
      │                                   ▼      │
      │                            ┌─────┐┌─────┐┌─────┐
      ▼                            │NVA 1││NVA 2││NVA 3│
┌──────────────────┐               └─────┘└─────┘└─────┘
│   Backend VMs    │            Flow symmetry: each flow returns
│  (original source│            through the NVA that handled it
│   IP preserved)  │
└──────────────────┘
```

Two properties are the reason to prefer it over wiring appliances in by hand. **No UDRs are involved**, and in fact you cannot use a Gateway Load Balancer frontend as a next hop in a user-defined route. **Flow symmetry is maintained automatically**, so packets in both directions traverse the same appliance instance, which stateful appliances require and hand-built designs frequently break. Chaining also crosses subscription and tenant boundaries, so a security team can operate the appliance fleet in its own subscription while application teams simply reference it.

Gateway Load Balancer rules can only be HA ports rules, its frontend is always private, and it doesn't work with the global tier.

This does not replace the internal-load-balancer-plus-UDR pattern. Gateway Load Balancer inserts appliances in front of a *public endpoint*, so it addresses north-south traffic reaching an application. Forcing east-west traffic between spokes through a hub firewall is still a UDR job, and that pattern is covered below.

### Cross-Region Load Balancer

The [global tier](https://learn.microsoft.com/en-us/azure/load-balancer/cross-region-overview){:target="_blank" rel="noopener noreferrer"}, which Microsoft's documentation now calls the global load balancer, distributes traffic across regional load balancers in multiple Azure regions:

- Static anycast IP address (IPv4 and IPv6)
- Layer 4 pass-through (no connection termination)
- Backend consists of regional Standard Load Balancers (not individual VMs)
- Health checks regional LBs every 5 seconds
- Uses geo-proximity to route users to the nearest healthy regional LB
- Preserves original client IP (no X-Forwarded-For header needed)
- Public only (no internal frontend, and no private or internal LB in the backend pool)

**Home regions and participating regions** are different things, and the names suggest an importance the home region doesn't have. The home region is simply where the global load balancer resource and its public IP are deployed, and only about ten regions can serve as one. It has no influence on routing, and if it goes down, traffic keeps flowing. Participating regions are where the anycast IP is actually advertised, and client traffic enters the Microsoft backbone at the closest one. Your regional load balancers, meanwhile, can sit in any public Azure region at all.

Two constraints shape adoption. **You can't upgrade an existing regional load balancer to the global tier**, so global has to be created as a new resource and the regional deployments retained as its backends. And **outbound rules aren't supported** on the global tier, so outbound connectivity stays the job of the regional load balancer or a NAT gateway.

### Floating IP

Floating IP changes what destination IP the backend VM sees. When enabled, the VM receives traffic addressed to the load balancer's frontend IP instead of its own IP. This is required for SQL AlwaysOn Availability Groups, where the listener must use the same port on whichever replica is primary. The guest OS must be configured with a loopback interface bound to the frontend IP.

### Pricing

Standard Load Balancer charges per load balancing rule plus a small per-GB data processing fee. It is one of the least expensive Azure networking services, making cost a non-factor for most deployments. The cost model scales linearly with the number of rules, so consolidating rules where possible keeps costs minimal.

---

## Azure Application Gateway

### V2 SKU

**The v1 SKU retired on April 28, 2026 and is no longer supported.** Anything still running on it needs migrating rather than planning to migrate, and Microsoft publishes a PowerShell script that copies a v1 configuration to v2. The script does not move traffic, which remains yours to cut over.

Application Gateway v2 comes in three SKUs:

| SKU | Status | Positioning |
|-----|--------|-------------|
| **Basic_v2** | Preview (requires feature registration) | Low-traffic applications that don't need advanced traffic management. 99.9% SLA. |
| **Standard_v2** | GA | Production workloads. 99.95% SLA. |
| **WAF_v2** | GA | Standard_v2 plus the integrated Web Application Firewall. |

Basic_v2 matters because Application Gateway's cost floor drives so many architecture decisions, but a preview SKU with a 99.9% SLA is not a production answer yet. Standard_v2 remains the default choice, and it provides:

- **Autoscaling:** 0 to 125 instances, or a fixed instance count for predictable workloads
- **Zone redundancy:** Deployed across at least two availability zones by default, in regions that have zones
- **Static VIP:** Guaranteed static IP throughout the deployment lifecycle, including across restarts
- **5x better TLS offload** performance compared to v1
- **Key Vault integration** for centralized certificate management
- **Header and URL rewrite** capabilities
- **Mutual authentication (mTLS)** for client certificate validation
- **Private Link support** for private endpoint connectivity
- **TCP/TLS proxy** for non-HTTP workloads

The v2 SKU also drops a few v1 behaviors that occasionally matter. It decodes paths before routing, so `/abc%2Fdef` and `/abc/def` are treated identically, and it doesn't support appending a domain to the session affinity cookie, which stops subdomain clients from using it.

### TCP/TLS Proxy

Application Gateway v2 proxies TCP and TLS in addition to HTTP, which erodes the old rule that non-HTTP traffic automatically means Load Balancer. One gateway and one frontend IP can now serve HTTP and non-HTTP workloads together, with listeners of both kinds side by side.

The reason to choose it over Load Balancer for TCP traffic is centralized TLS termination. A TLS listener terminates certificates at the gateway, integrates with Key Vault, and lets a database or message broker sit behind the same certificate management as your web tier without implementing TLS itself. Backends can be VMs, scale sets, PaaS services, or on-premises servers reachable by FQDN or IP, which Load Balancer cannot do at all since its backend pool is confined to one VNet.

The limitations decide most cases:

- **WAF does not inspect TCP or TLS listeners.** A WAF_v2 gateway will happily host them, and traffic on them passes without inspection for exploits or vulnerabilities. A Layer 4 listener on a WAF gateway is unprotected, whatever the SKU name suggests.
- **AGIC doesn't support it**, working only through HTTP(S) listeners.
- **Connection draining is fixed at 30 seconds** and can't be configured, and a configuration update terminates active connections once that window elapses.

For raw throughput and millions of concurrent flows, Load Balancer still wins on both performance and price. TCP/TLS proxy earns its place when TLS termination or backend reach is worth more than pass-through efficiency.

### URL-Based Routing

Application Gateway routes requests to different backend pools based on the URL path:

- `/api/*` routes to the API backend pool
- `/images/*` routes to the image storage pool
- `/video/*` routes to the streaming pool
- Default path catches everything else

URL path maps are attached to request routing rules. Each path map entry specifies a pattern and a target backend pool plus HTTP settings.

### Multi-Site Hosting

Host multiple websites on a single Application Gateway instance by configuring multiple listeners, each with a different hostname. Each listener routes to different backend pools via different routing rules. Wildcard hostnames like `*.contoso.com` are supported, with up to 5 hostnames per listener.

Combined with SNI (Server Name Indication), each site can have its own TLS certificate.

### SSL/TLS Models

**SSL offloading (HTTPS frontend, HTTP backend):** Gateway terminates TLS and sends unencrypted HTTP to backends. Reduces backend CPU significantly. Appropriate when backend VNet traffic is trusted.

**End-to-end TLS (HTTPS frontend, HTTPS backend):** Gateway terminates client TLS, then re-encrypts to the backend. Required for compliance scenarios demanding encryption everywhere. Backend servers need valid certificates (self-signed certificates are acceptable for trusted backends).

**TLS 1.0 and 1.1 were retired on Application Gateway on August 31, 2025**, so TLS 1.2 is now the floor. TLS 1.3 is supported on v2, though only with a 2022 predefined policy or a Customv2 policy. An older policy silently caps you at 1.2. SSL 2.0 and 3.0 are disabled and not configurable.

### Cookie-Based Session Affinity

Application Gateway sets a cookie (`ApplicationGatewayAffinity` on v2) to bind subsequent requests from the same client to the same backend server. The first request is routed based on rules, and subsequent requests with the cookie are directed to the same backend as long as it remains healthy.

### Connection Draining

When a backend pool member is being removed (for planned maintenance or deployment), connection draining allows existing connections to complete within a configurable timeout while preventing new connections from being routed to it.

### WAF v2

The WAF_v2 SKU integrates a Web Application Firewall directly into the gateway, protecting against SQL injection, cross-site scripting, local file inclusion, remote code execution, and protocol violations.

**Managed rule sets** have moved on from the OWASP branding many teams still reach for:

| Rule set | Status |
|---|---|
| **DRS 2.2** | Latest and recommended for new policies. Baselined on OWASP CRS 3.3.4. |
| **DRS 2.1** | Current. |
| **CRS 3.2, 3.1, 3.0** | Legacy, each with an announced end date. |
| **Bot Manager 1.0 / 1.1** | Bot protection, selected alongside a core rule set. |

Reaching for "OWASP CRS" by name now selects a legacy rule set. Microsoft's Default Rule Set is built on CRS and is where the current protections live, so new policies should start at DRS 2.2.

**Detection and Prevention are not quite log-versus-block**, and reading them that way produces a badly mistuned WAF. With CRS or DRS 2.1 and later, the WAF uses anomaly scoring by default. A matching rule doesn't block; it contributes to a score based on its severity, where a Critical match adds 5, Error 4, Warning 3, and Notice 2. Only when a request's cumulative score reaches 5 does Prevention mode block it. So a request can match three Warning rules for a total of 9 and be blocked, while a single Notice match is scored and forgotten. The practical effect is that a log full of rule matches is not a log full of blocked requests, and tuning means finding what crossed the threshold rather than what matched at all.

Start in Detection to tune, then switch to Prevention. That advice survives anomaly scoring, but the logs you are tuning against need reading as scores.

**Custom rules** support IP-based, geo-based, rate limiting, and string/regex matching conditions. Per-site and per-URI WAF policies allow different policies for different listeners or path rules.

**Rate limiting** differs from Front Door's implementation in two ways that break assumptions carried across. Application Gateway uses a **sliding window**, blocking all matching traffic during the first window that breaches the threshold and throttling to the threshold afterward. It also groups counters by `ClientAddr` (per source IP, and the default), `GeoLocation`, `None`, or the `ClientAddrXFFHeader` and `GeoLocationXFFHeader` variants that read the `X-Forwarded-For` header instead. Per-source-IP rate limiting is therefore available here and not on Front Door, so a rate limiting design does not port between the two unchanged. Rate limit rules need the latest WAF engine, which in practice means selecting CRS 3.2 or later as the default rule set.

Thresholds are counted independently per endpoint the policy attaches to, so a single policy on five listeners enforces the threshold five times over rather than once.

**WAF_v2 costs about 80% more than Standard_v2** on both fixed and variable rates. If Azure DDoS Network Protection is enabled, WAF_v2 is billed at the lower Standard_v2 rates, which sounds like a discount to chase and is not. DDoS Network Protection runs roughly $2,944 per month on its own, many times what the WAF premium costs. It's a genuine saving only for estates already paying for DDoS Network Protection for other reasons.

### Health Probes

| Parameter | Default | Custom |
|-----------|---------|--------|
| Protocol | From backend HTTP settings | HTTP or HTTPS |
| Host | 127.0.0.1 | Custom hostname (used for SNI) |
| Path | / | Custom path starting with / |
| Interval | 30 seconds | Configurable |
| Timeout | 30 seconds | Configurable |
| Unhealthy threshold | 3 consecutive failures | Configurable |
| Healthy status codes | 200-399 | Custom (individual codes or ranges) |
| Body match | None | String presence check (max 4,090 chars) |

Probes come from the gateway itself rather than from `168.63.129.16` as Load Balancer's do, and the exact source depends on the backend. A backend that is a private endpoint is probed from the gateway subnet's address space, while a backend that is a public endpoint is probed from the gateway's **frontend public IP**. Allowlisting the subnet is therefore not enough when the backend is public, which is a common cause of backends that stay stubbornly unhealthy behind a correct-looking configuration.

Each gateway instance probes each backend independently, so probe load on a backend scales with instance count.

### Required NSG Rules

Application Gateway's subnet has mandatory connectivity that has nothing to do with your application, and getting it wrong produces a gateway that never reaches a healthy state:

- **Inbound TCP 65200-65535 from the `GatewayManager` service tag** for v2 (65503-65534 for v1). This is the Azure infrastructure control channel, not application traffic, and the traffic is protected by certificates so opening the range does not expose the gateway.
- **Inbound from the `AzureLoadBalancer` service tag** must be allowed.
- **Outbound internet connectivity cannot be blocked.** A deny-all outbound rule breaks the gateway.

Private-only deployments relax the port range requirement.

### AKS Integration: AGIC and Application Gateway for Containers

**Application Gateway Ingress Controller (AGIC)** runs inside an AKS cluster and translates Kubernetes Ingress resources into Application Gateway configuration. Application Gateway routes directly to pod IPs (no NodePort or ClusterIP hop), provides WAF protection at ingress without consuming cluster resources, and handles SSL offloading externally. It remains supported.

**[Application Gateway for Containers](https://learn.microsoft.com/en-us/azure/application-gateway/for-containers/overview){:target="_blank" rel="noopener noreferrer"} (AGC)**, generally available since February 2024, is not a new version of Application Gateway with a Kubernetes wrapper. It is a separate offering with its own control plane and Envoy-based data plane, built for Kubernetes from the ground up and shaped by what Microsoft learned from AGIC. It supports both the Gateway API and the Ingress API, so adoption can be incremental rather than a rewrite, and it offers near real-time convergence on cluster changes. Traffic management adds retries, several load balancing strategies including Ring Hash and Least Request, and its own WAF support.

**AGC is the answer when you need gRPC**, and this is where the pass-through and terminating distinction from the start of this guide pays off. Application Gateway advertises HTTP/2, but only to clients. Communication to backend server pools is always HTTP/1.1. gRPC requires HTTP/2 end to end, so it cannot work through Application Gateway's L7 path no matter how the listener is configured. (Application Gateway's HTTP/2 support is also TLS-only. Cleartext h2c upgrade attempts return 403.) AGC speaks gRPC and HTTP/2 to backends natively and implements `GRPCRoute`. Load Balancer, being pass-through, never interferes with HTTP/2 in the first place, which makes it the option outside AKS.

AGC is available in a subset of Azure regions rather than everywhere, so confirm your region before designing around it.

### Pricing

Application Gateway charges a fixed hourly rate plus a per-capacity-unit (CU) variable charge.

A **capacity unit** bundles three parameters, and you are billed on whichever is most utilized:

- 2,500 persistent connections
- 2.22 Mbps (1 GB/hour) throughput
- 1 compute unit

A **compute unit** is a distinct thing from a capacity unit, and conflating them is the usual source of surprise on the bill. It measures compute consumed by TLS handshakes, URL rewrites, and WAF rule processing. On Standard_v2 one compute unit handles roughly 50 TLS connections per second with an RSA 2048-bit certificate. On WAF_v2 one compute unit handles roughly **10 requests per second**, because inspecting the request is expensive. WAF's higher unit price is therefore only part of its cost. The same traffic also consumes several times the compute units.

Each provisioned instance reserves 10 capacity units, billed whether or not the traffic needs them.

At illustrative East US rates, Standard_v2's fixed charge is $0.246/hour and WAF_v2's is $0.443/hour, which is roughly **$180 and $323 per month** before a single request arrives. Load Balancer, charged per rule with a small per-GB fee, is a different order of magnitude entirely. This gap is the most common cost surprise for teams moving from Load Balancer, and it doesn't scale down with traffic because it isn't a traffic charge.

The fixed cost applies whenever the gateway is provisioned, **including when autoscale minimum is set to 0**. A minimum of 0 avoids the reserved capacity unit charges, not the fixed hourly rate. A WAF_v2 gateway with a zero minimum and literally no traffic for a month still bills its full fixed cost.

---

## Load Balancer vs Application Gateway

| Factor | Load Balancer | Application Gateway |
|--------|--------------|-------------------|
| **Connection model** | Pass-through (one connection, client to backend) | Terminating proxy (two connections) |
| **Client IP at backend** | Preserved | Gateway's IP, client IP in `X-Forwarded-For` |
| **Protocols** | TCP, UDP | HTTP, HTTPS, WebSocket, HTTP/2 (clients only), plus TCP and TLS via L4 proxy |
| **To the backend** | Whatever the client speaks, untouched | HTTP/1.1 always, so no end-to-end gRPC |
| **Backend reach** | One VNet only | Same VNet, peered VNets, PaaS, remote FQDN/IP, on-premises |
| **SSL/TLS** | Pass-through only | Full termination, offload, re-encryption, mTLS |
| **WAF** | None | WAF v2, DRS managed rules, custom rules, bot protection |
| **Routing** | 5-tuple hash, source IP affinity | URL path, hostname, headers, query string, method |
| **Session affinity** | Source IP hash | Cookie-based (application-level) |
| **Header manipulation** | None | Rewrite request/response headers |
| **URL rewrite** | None | Rewrite paths and query strings |
| **Redirect** | None | HTTP-to-HTTPS and custom redirects |
| **Autoscaling** | Fully managed (transparent) | 0-125 instances, or fixed count |
| **Scope** | Regional or global | Regional only |
| **Static IP** | Yes | Static VIP (v2) |
| **Private Link** | Supported (internal LB as service) | Supported (private endpoint to the gateway) |
| **AKS integration** | Service type: LoadBalancer | AGIC / Application Gateway for Containers |
| **Minimum cost** | Very low | Fixed hourly charge even when idle |

### Choosing Between Them

```
Is the traffic HTTP/HTTPS?
│
├─ No ──▶ Need TLS terminated centrally, or backends outside this VNet?
│         │
│         ├─ No ──▶ LOAD BALANCER
│         │         Lowest latency and cost, millions of flows,
│         │         client IP preserved
│         │
│         └─ Yes ─▶ APP GATEWAY TCP/TLS PROXY
│                   Note: WAF does not inspect L4 listeners
│
└─ Yes ─▶ Is it gRPC?
          │
          ├─ Yes ─▶ Running on AKS?
          │         ├─ Yes ─▶ APP GATEWAY FOR CONTAINERS
          │         └─ No ──▶ LOAD BALANCER
          │                   (pass-through keeps HTTP/2 end to end)
          │
          └─ No ──▶ Need URL/host routing, WAF, TLS offload,
                    or cookie affinity?
                    │
                    ├─ No ──▶ LOAD BALANCER
                    │
                    └─ Yes ─▶ APP GATEWAY
                              └─ Also need global entry, CDN, or edge WAF?
                                 └─ Front Door in front of App Gateway
```

Some cases decide themselves regardless of the path above:

- **SQL AlwaysOn availability groups** need Load Balancer with floating IP and a probe on the listener port.
- **Inserting third-party appliances in front of a public endpoint** is Gateway Load Balancer's job, not a routing exercise.
- **Global Layer 4 distribution** across regions is the global tier, and Application Gateway has no equivalent because it is regional only.
- **Cost-sensitive internal tier-to-tier traffic** goes to Load Balancer, because Application Gateway's fixed hourly charge is hard to justify without L7 features.

---

## Architectural Patterns

### Pattern 1: Internal Load Balancer for Tier-to-Tier Traffic

An internal load balancer distributes TCP traffic between application tiers with no internet exposure, so a web tier reaches an app tier through one internal frontend and the app tier reaches a database tier through another. This is the cheapest load balancing option in Azure and it suits any non-HTTP tier-to-tier communication. Each tier needs its own load balancer, since a backend pool cannot span VNets and, more practically, each tier has its own health model.

### Pattern 2: Application Gateway as Web Application Ingress

Application Gateway Standard_v2 fronts a backend pool of VMs, scale sets, or App Services, terminating TLS at the gateway and routing by URL path to different pools. Multi-site hosting serves several domains from one gateway, and cookie-based affinity handles stateful applications. This is the standard shape for a single-region web application, and it's the pattern the fixed hourly cost is easiest to justify against, because the gateway is doing routing, TLS, and affinity work the backends would otherwise implement.

### Pattern 3: Application Gateway + WAF

The same shape on WAF_v2 adds inspection. Per-listener and per-path-rule WAF policies let one gateway apply different security postures across an application, so an admin path can run strict rules while a public marketing path runs permissively. Start in Detection to tune, then switch to Prevention, reading the logs as anomaly scores rather than as a list of blocks.

### Pattern 4: Front Door + Application Gateway (Multi-Region)

```
Users → Front Door (global) → Region A: App Gateway (WAF_v2) → backends
                             → Region B: App Gateway (WAF_v2) → backends
```

Front Door provides global entry, CDN, and edge WAF. Application Gateway provides regional routing, VNet integration, and a second WAF layer. Lock Application Gateway to accept only Front Door traffic by validating the `X-Azure-FDID` header, otherwise the regional gateway's public IP is an open bypass around everything the edge enforces.

### Pattern 5: NVA High Availability with HA Ports

HA ports load-balance all protocols and ports to a pool of appliances behind an internal load balancer in a hub VNet, and UDRs in the spoke subnets force traffic through that frontend. Floating IP lets the appliances see the original destination IP rather than the load balancer's.

Use this for east-west traffic, meaning spoke-to-spoke and spoke-to-on-premises flows that must be inspected. For appliances in front of a public endpoint, Gateway Load Balancer does the same job by chaining, with flow symmetry handled for you and no UDRs to maintain.

### Pattern 6: SQL AlwaysOn with Internal LB

Floating IP is required here because the SQL listener must use the same port on whichever replica is currently primary, and without it the load balancer would rewrite the destination to the VM's own IP. A health probe on a custom port such as 59999 answers only on the primary. When failover occurs, the new primary starts answering the probe, the old one stops, and the load balancer redirects traffic without any reconfiguration. This inverts the usual model. The probe isn't reporting health so much as electing a destination.

---

## Common Pitfalls

### Pitfall 1: Choosing App Gateway When Load Balancer Suffices

**Problem:** Deploying Application Gateway for simple internal TCP traffic where Load Balancer would work.

**Result:** A fixed hourly charge of roughly $180 per month before any traffic, against a Load Balancer bill an order of magnitude smaller, in exchange for connection termination latency and no L7 features being used.

**Solution:** Use Load Balancer for internal tier-to-tier communication unless something specific argues otherwise. Reserve Application Gateway for workloads that genuinely need L7 routing, TLS offloading, or WAF. Now that TCP/TLS proxy exists, "it isn't HTTP" no longer rules Application Gateway out on its own, so the question to ask is whether centralized TLS termination or reaching backends beyond the VNet is worth the cost floor.

---

### Pitfall 2: Forgetting NSG Rules for Load Balancer Probes

**Problem:** Standard Load Balancer is closed to inbound by default. Health probes from `168.63.129.16` (AzureLoadBalancer service tag) are blocked if the NSG does not allow them.

**Result:** All backend instances appear unhealthy. No traffic is distributed.

**Solution:** Ensure NSG rules on the backend subnet allow inbound traffic from the `AzureLoadBalancer` service tag on the health probe port.

---

### Pitfall 3: Application Gateway Minimum Cost Surprise

**Problem:** Deploying Application Gateway for a low-traffic application, then assuming an autoscale minimum of 0 makes an idle gateway free.

**Result:** Unexpected monthly charges for gateways doing nothing. **A minimum of 0 does not deprovision the gateway.** It waives the reserved capacity unit charge, not the fixed hourly rate, which accrues for as long as the resource exists. A WAF_v2 gateway with a zero minimum and no traffic at all still bills its full fixed cost, roughly $323 per month.

**Solution:** Set autoscale minimum to 0 for dev/test to avoid the reserved capacity charge, but understand that the only way to stop the fixed cost is to delete the gateway. For environments that sit idle for long stretches, tear them down rather than scale them to zero. For production, budget the fixed cost as a floor and consider whether Load Balancer or Front Door Standard serves the workload for less.

---

### Pitfall 4: SNAT Port Exhaustion on Load Balancer

**Problem:** Backend VMs making many outbound connections exhaust their SNAT port allocation. The version of this that actually causes incidents is subtler than running out at a fixed ceiling: default allocation *shrinks as the backend pool grows*, so scaling out to handle load cuts each instance's outbound capacity.

**Result:** Intermittent outbound connection failures under load, appearing right after a scale-out that was supposed to help. The load balancer can still report unused SNAT ports overall while individual instances have none.

**Solution:** Don't rely on default allocation in production. Allocate ports explicitly through outbound rules using "ports per instance" for VMs, or "maximum number of backend instances" for scale sets so that scaling out doesn't starve new instances. Better, use Azure NAT Gateway, which allocates dynamically across the subnet and removes the problem rather than raising the threshold at which it appears. Where the destination is an Azure PaaS service, Private Link avoids SNAT entirely.

---

### Pitfall 5: Not Locking App Gateway to Front Door Traffic

**Problem:** Deploying Application Gateway as an origin behind Front Door but leaving it open to direct internet access.

**Result:** Attackers bypass Front Door's WAF and CDN by connecting directly to Application Gateway's public IP.

**Solution:** Configure a WAF custom rule on Application Gateway to validate the `X-Azure-FDID` header matches your Front Door instance ID. Block all requests without a valid header.

---

## Key Takeaways

1. **Pass-through versus terminating separates these services, not Layer 4 versus Layer 7.** Application Gateway v2 proxies TCP and TLS as well as HTTP, so the layer no longer decides. Load Balancer forwards packets and the backend sees the client's real IP on one end-to-end connection. Application Gateway terminates and opens a second connection, which is what buys L7 routing and what costs client IP transparency, protocol transparency, and a handshake.

2. **Load Balancer has two live SKUs, not one.** Basic retired on September 30, 2025. Standard is the general-purpose SKU and is closed to inbound by default, so NSGs must explicitly allow traffic including probes from `168.63.129.16`. Gateway SKU is a separate product for inserting third-party appliances by chaining, with flow symmetry handled automatically and no UDRs.

3. **Application Gateway's fixed cost is a floor you cannot scale away.** Standard_v2 runs roughly $180/month and WAF_v2 roughly $323/month before any traffic, and WAF_v2 costs about 80% more than Standard_v2 on both fixed and variable rates. An autoscale minimum of 0 waives reserved capacity charges but not the fixed hourly rate. Only deleting the gateway stops that.

4. **Default SNAT port allocation shrinks as the backend pool grows.** 1,024 ports per instance is the best case, for pools of 50 or fewer, falling to 32 at 1,000 instances. Scaling out can therefore cause the outbound failures it was meant to relieve. Allocate ports explicitly, or use NAT Gateway.

5. **The WAF scores requests, it doesn't simply match them.** With CRS or DRS 2.1 and later, anomaly scoring is the default and Prevention blocks at a cumulative score of 5, so matched rules in a log are not blocked requests. Start in Detection, tune, then switch. New policies should use DRS 2.2, since the familiar OWASP CRS versions are now legacy.

6. **The global tier provides Layer 4 distribution across regions.** It uses geo-proximity to route to regional load balancers behind a static anycast IP. Existing regional load balancers can't be upgraded into it, and it supports no outbound rules and no internal frontend.

7. **Match the NVA pattern to the traffic direction.** HA ports on an internal load balancer plus UDRs handles east-west inspection between spokes. Gateway Load Balancer handles appliances in front of a public endpoint, and it is the better answer there because chaining preserves flow symmetry that hand-built UDR designs tend to break.

8. **Application Gateway speaks HTTP/1.1 to backends, so gRPC cannot work behind it.** HTTP/2 support is client-side only and TLS-only. Application Gateway for Containers, generally available since February 2024, is a separate Kubernetes-native offering that speaks gRPC and HTTP/2 to backends and supports both Gateway API and Ingress. AGIC is not deprecated and remains supported for Ingress-based AKS deployments.
