---
title: "Azure Load Balancer & Application Gateway"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure Load Balancer and Application Gateway provide Layer 4 and Layer 7 load balancing, with decision frameworks for choosing between them and architectural patterns for production deployments."
tags: [infrastructure, azure, networking, scalability, reliability, performance, practical]
---

## What Are Azure's Regional Load Balancers

Azure provides two regional load balancing services that serve different purposes:

[Azure Load Balancer](https://learn.microsoft.com/en-us/azure/load-balancer/load-balancer-overview){:target="_blank" rel="noopener noreferrer"} is a Layer 4 (Transport) load balancer that distributes inbound TCP and UDP flows across backend instances using a hash-based algorithm. It does not inspect packet payloads, does not understand HTTP, and does not terminate connections. It is fully managed with no user-accessible instances.

[Azure Application Gateway](https://learn.microsoft.com/en-us/azure/application-gateway/overview){:target="_blank" rel="noopener noreferrer"} is a Layer 7 (Application) load balancer that acts as a reverse proxy. It terminates client connections, inspects HTTP/HTTPS content, makes routing decisions based on URL paths, hostnames, and headers, then opens new connections to backend servers.

### When to Use Which

| Decision Factor | Load Balancer | Application Gateway |
|----------------|---------------|-------------------|
| **Protocol** | TCP, UDP | HTTP, HTTPS, WebSocket |
| **Routing logic** | 5-tuple hash (IP, port, protocol) | URL path, hostname, headers, query string |
| **SSL/TLS** | Pass-through only | Full termination, offload, and re-encryption |
| **WAF** | None | WAF v2 with OWASP rules and bot protection |
| **Session affinity** | Source IP hash | Cookie-based |
| **Scope** | Regional or global (cross-region tier) | Regional only |
| **Relative cost** | Very low (per-rule + data processed) | Significantly higher (fixed hourly + capacity units) |
| **Use case** | Internal tier-to-tier traffic, non-HTTP protocols | Web application ingress, path-based routing |

---

## Azure Load Balancer

### How It Works

Load Balancer distributes connections across backend pool instances using a five-tuple hash by default: source IP, source port, destination IP, destination port, and protocol. Each new connection may land on a different backend instance. It is fully managed, horizontally scaled, and adds negligible latency.

### Public vs Internal

**Public Load Balancer** has a public frontend IP address. It receives inbound traffic from the internet and distributes it to the backend pool. It also provides outbound connectivity for backend VMs through outbound rules.

**Internal Load Balancer** uses a private frontend IP within a VNet. It distributes traffic entirely within the VNet or from peered VNets. There is no internet exposure. This is the standard pattern for tier-to-tier traffic (web-to-app, app-to-database).

Both types can coexist on the same backend pool. A VM can be behind both a public and internal load balancer simultaneously.

### Standard SKU

The Basic SKU was retired in September 2025. All workloads use the Standard SKU, which provides:

- Backend pools up to 5,000 instances
- Health probes via TCP, HTTP, and HTTPS
- Availability zone support (zone-redundant and zonal frontends)
- Outbound rules for explicit SNAT control
- HA ports for load balancing all protocols and ports simultaneously
- Cross-region load balancing (global tier)
- 99.99% SLA
- Closed to inbound by default (NSG required to allow traffic)

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
| **TCP** | Three-way handshake completes | Most basic; validates port is open |
| **HTTP** | Returns exactly HTTP 200 OK | Only 200 is healthy (not the 2xx range) |
| **HTTPS** | Returns exactly HTTP 200 OK | Includes TLS handshake; requires SHA256+ certificate signature |

Probes originate from IP address `168.63.129.16` (the `AzureLoadBalancer` service tag). NSGs must allow this traffic for probes to reach backend instances.

**Probe parameters:**
- **Interval:** Configurable (default 5 seconds)
- **Unhealthy threshold:** Number of consecutive failures before removing the instance from rotation
- **Grace period:** After an instance fluctuates between healthy and unhealthy, the load balancer intentionally waits longer before restoring it

### Outbound Rules and SNAT

Standard Load Balancer provides explicit outbound connectivity through outbound rules:

- Each public IP provides up to 64,000 SNAT ports
- Default automatic allocation provides 1,024 ports per backend VM
- Idle timeout is configurable from 4 to 120 minutes (default 4 minutes)
- For workloads with high outbound connection rates, add more public IPs or use [Azure NAT Gateway](/study-guides/infrastructure/azure/azure-vnet-architecture.html) instead

**SNAT exhaustion** manifests as intermittent connection failures from backend VMs to external endpoints. Monitor the "SNAT Connection Count" metric in Azure Monitor to detect exhaustion before it causes outages.

### HA Ports

HA Ports is a load balancing rule that distributes all TCP and UDP flows on all ports simultaneously. It is available only on Internal Standard Load Balancer.

**Configuration:** Frontend port = 0, Backend port = 0, Protocol = All.

**Primary use cases:**
- Network Virtual Appliances (Azure Firewall, third-party firewalls, IDS/IPS)
- Any scenario needing to load balance all ports without enumerating each one
- SQL AlwaysOn when combined with floating IP

### Cross-Region Load Balancer

The [global tier](https://learn.microsoft.com/en-us/azure/load-balancer/cross-region-overview){:target="_blank" rel="noopener noreferrer"} distributes traffic across regional load balancers in multiple Azure regions:

- Static anycast IP address (IPv4 and IPv6)
- Layer 4 pass-through (no connection termination)
- Backend consists of regional Standard Load Balancers (not individual VMs)
- Health checks regional LBs every 5 seconds
- Uses geo-proximity to route users to the nearest healthy regional LB
- Preserves original client IP (no X-Forwarded-For header needed)
- Public only (no internal cross-region LB)

### Floating IP

Floating IP changes what destination IP the backend VM sees. When enabled, the VM receives traffic addressed to the load balancer's frontend IP instead of its own IP. This is required for SQL AlwaysOn Availability Groups, where the listener must use the same port on whichever replica is primary. The guest OS must be configured with a loopback interface bound to the frontend IP.

### Pricing

Standard Load Balancer charges per load balancing rule plus a small per-GB data processing fee. It is one of the least expensive Azure networking services, making cost a non-factor for most deployments. The cost model scales linearly with the number of rules, so consolidating rules where possible keeps costs minimal.

---

## Azure Application Gateway

### How It Works

Application Gateway acts as a reverse proxy. It terminates the client's TCP and TLS connections, inspects HTTP headers, URL paths, and other request attributes, makes a routing decision, and opens a new connection to the appropriate backend server. This connection termination enables HTTP-aware features like URL-based routing, SSL offloading, cookie-based session affinity, and WAF inspection.

### V2 SKU

The v1 SKU is deprecated (support ends April 2026). All new deployments use the v2 SKU (Standard_v2 or WAF_v2), which provides:

- **Autoscaling:** 0 to 125 instances based on traffic
- **Zone redundancy:** Automatic multi-AZ deployment
- **Static VIP:** Guaranteed static IP throughout the deployment lifecycle
- **5x better TLS offload** performance compared to v1
- **Key Vault integration** for centralized certificate management
- **Header and URL rewrite** capabilities
- **Mutual authentication (mTLS)** for client certificate validation
- **Private Link support** for private endpoint connectivity

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

Application Gateway v2 supports TLS 1.2 and 1.3. TLS 1.0 and 1.1 will be discontinued on August 31, 2025.

### Cookie-Based Session Affinity

Application Gateway sets a cookie (`ApplicationGatewayAffinity` on v2) to bind subsequent requests from the same client to the same backend server. The first request is routed based on rules, and subsequent requests with the cookie are directed to the same backend as long as it remains healthy.

### Connection Draining

When a backend pool member is being removed (for planned maintenance or deployment), connection draining allows existing connections to complete within a configurable timeout while preventing new connections from being routed to it.

### WAF v2

The WAF_v2 SKU integrates Web Application Firewall directly:

**Managed rule sets:**
- OWASP Core Rule Set (CRS) 3.1 covering SQL injection, XSS, local file inclusion, remote code execution, and protocol violations
- Microsoft Default Rule Set (DRS) 2.1
- Bot Manager rule sets

**Custom rules** support IP-based, geo-based, rate limiting, and string/regex matching conditions. Per-site and per-URI WAF policies allow different policies for different listeners or path rules.

**WAF modes:** Detection (log only) or Prevention (block and log). Start in Detection to tune rules, then switch to Prevention.

WAF_v2 is approximately 80% more expensive than Standard_v2 on both fixed and variable costs. However, if Azure DDoS Network Protection is enabled on the VNet, WAF_v2 is billed at Standard_v2 rates.

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

Probe source is the gateway's own IP from its subnet (not `168.63.129.16` like Load Balancer). Each gateway instance probes each backend independently.

### AKS Integration: AGIC and Application Gateway for Containers

**Application Gateway Ingress Controller (AGIC)** runs inside an AKS cluster and translates Kubernetes Ingress resources into Application Gateway configuration. Application Gateway routes directly to pod IPs (no NodePort or ClusterIP hop), provides WAF protection at ingress without consuming cluster resources, and handles SSL offloading externally.

**Application Gateway for Containers (AGC)** is the next-generation evolution (GA mid-2025). It uses the Kubernetes Gateway API (successor to the Ingress API), has an Envoy-based data plane with near real-time configuration updates, supports higher scale (1,400+ backend pods, 100+ listeners), and includes built-in WAF support.

### Pricing

Application Gateway charges a fixed hourly rate plus a per-capacity-unit (CU) variable charge. Each CU represents approximately 2,500 concurrent connections, 2.22 Mbps throughput, or 50 TLS connections/second (billed on whichever dimension is highest). Each instance guarantees 10 CUs minimum.

Application Gateway has a significant minimum monthly cost even with zero traffic, which is a common surprise for teams accustomed to Load Balancer's much lower pricing. This fixed cost is roughly 5-7x higher than a typical Load Balancer deployment.

---

## Load Balancer vs Application Gateway

| Factor | Load Balancer | Application Gateway |
|--------|--------------|-------------------|
| **Layer** | Layer 4 (Transport) | Layer 7 (Application) |
| **Protocols** | TCP, UDP | HTTP, HTTPS, WebSocket |
| **SSL/TLS** | Pass-through only | Full termination, offload, re-encryption, mTLS |
| **WAF** | None | WAF v2 with OWASP rules, custom rules, bot protection |
| **Routing** | 5-tuple hash, source IP affinity | URL path, hostname, headers, query string, method |
| **Session affinity** | Source IP hash | Cookie-based (application-level) |
| **Header manipulation** | None | Rewrite request/response headers |
| **URL rewrite** | None | Rewrite paths and query strings |
| **Redirect** | None | HTTP-to-HTTPS and custom redirects |
| **Autoscaling** | Fully managed (transparent) | 0-125 instances (configurable) |
| **Scope** | Regional or global | Regional only |
| **Static IP** | Yes | Static VIP (v2) |
| **Private Link** | N/A (operates within VNet) | Supported |
| **AKS integration** | Service type: LoadBalancer | AGIC / Application Gateway for Containers |
| **Minimum cost** | Very low | Significant (fixed hourly charge even when idle) |

### Choose Load Balancer When

- Non-HTTP/HTTPS traffic (database connections, gaming, IoT, custom TCP/UDP)
- Ultra-low latency (LB adds negligible latency vs App Gateway's connection termination)
- Internal tier-to-tier traffic within a VNet
- Global L4 load balancing across regions (cross-region LB)
- SQL AlwaysOn availability groups (floating IP with health probe)
- NVA high availability (HA ports on internal LB)
- Cost-sensitive workloads where L7 features are not needed

### Choose Application Gateway When

- HTTP/HTTPS web applications requiring intelligent routing
- URL path-based or hostname-based routing
- SSL/TLS offloading to reduce backend CPU
- WAF protection against OWASP top 10 web exploits
- Cookie-based session affinity for stateful web applications
- AKS ingress via AGIC or Application Gateway for Containers
- Multi-site hosting (multiple domains on single gateway)
- Header/URL rewrite or HTTP-to-HTTPS redirect

---

## Architectural Patterns

### Pattern 1: Internal Load Balancer for Tier-to-Tier Traffic

```
Web Tier VMs → Internal LB → App Tier VMs → Internal LB → Database Tier
```

Internal LB distributes TCP traffic between application tiers with no internet exposure. The cheapest load balancing option in Azure and appropriate for any non-HTTP tier-to-tier communication.

### Pattern 2: Application Gateway as Web Application Ingress

```
Internet → App Gateway (Standard_v2) → Backend Pool (VMs / App Services / VMSS)
```

SSL termination at the gateway, URL path-based routing to different pools, multi-site hosting for multiple domains, and cookie-based session affinity. This is the standard pattern for single-region web applications.

### Pattern 3: Application Gateway + WAF

```
Internet → App Gateway (WAF_v2) → Backend Pool
                |
           WAF Policy (OWASP CRS, custom rules, bot protection)
```

Start in Detection mode for tuning, then switch to Prevention. Per-listener or per-path-rule WAF policies allow different security postures for different parts of the application.

### Pattern 4: Front Door + Application Gateway (Multi-Region)

```
Users → Front Door (global) → Region A: App Gateway (WAF_v2) → backends
                             → Region B: App Gateway (WAF_v2) → backends
```

Front Door provides global entry, CDN, and edge WAF. Application Gateway provides regional routing, VNet integration, and a second WAF layer. Lock Application Gateway to accept only Front Door traffic by validating the `X-Azure-FDID` header. See the [Front Door & CDN](/study-guides/infrastructure/azure/azure-front-door-cdn.html) guide.

### Pattern 5: NVA High Availability with HA Ports

```
Spoke VNet traffic → Hub VNet: Internal LB (HA ports) → NVA instances (firewalls)
                                                              |
                                                        Inspected traffic → Destination
```

HA ports load-balance all protocols and ports to the NVA pool. Floating IP enables NVAs to see the original destination IP. UDRs in spoke subnets force traffic through the hub's internal LB.

### Pattern 6: SQL AlwaysOn with Internal LB

```
App Tier → Internal LB (floating IP) → SQL AlwaysOn AG Listener
                                              |
                                        Primary replica → Secondary replica
```

Floating IP is required because the SQL listener must use the same port on both replicas. A health probe on a custom port (e.g., 59999) determines which node is primary. When failover occurs, the new primary starts responding to the probe, and the LB redirects traffic automatically.

---

## Common Pitfalls

### Pitfall 1: Choosing App Gateway When Load Balancer Suffices

**Problem:** Deploying Application Gateway for simple internal TCP traffic where Load Balancer would work.

**Result:** Roughly 5-7x cost increase for no benefit; Application Gateway adds connection termination latency and cannot handle non-HTTP protocols.

**Solution:** Use Load Balancer for all non-HTTP traffic and internal tier-to-tier communication. Reserve Application Gateway for workloads that genuinely need L7 routing, SSL offloading, or WAF.

---

### Pitfall 2: Forgetting NSG Rules for Load Balancer Probes

**Problem:** Standard Load Balancer is closed to inbound by default. Health probes from `168.63.129.16` (AzureLoadBalancer service tag) are blocked if the NSG does not allow them.

**Result:** All backend instances appear unhealthy. No traffic is distributed.

**Solution:** Ensure NSG rules on the backend subnet allow inbound traffic from the `AzureLoadBalancer` service tag on the health probe port.

---

### Pitfall 3: Application Gateway Minimum Cost Surprise

**Problem:** Deploying Application Gateway for a low-traffic application without realizing the significant minimum cost even with zero traffic (when autoscale minimum is > 0 instances).

**Result:** Unexpected monthly charges for idle gateways.

**Solution:** Set autoscale minimum to 0 instances for dev/test environments (the gateway deprovisions when idle). For production, budget for the minimum cost. Consider whether a simple Load Balancer or Front Door Standard might serve the workload at lower cost.

---

### Pitfall 4: SNAT Port Exhaustion on Load Balancer

**Problem:** Backend VMs making many outbound connections through Load Balancer outbound rules exhaust the default 1,024 SNAT ports per VM.

**Result:** Intermittent outbound connection failures under load.

**Solution:** Add more public IPs to the outbound rule (each adds 64,000 ports), or use Azure NAT Gateway instead of LB outbound rules for workloads with high outbound connection rates.

---

### Pitfall 5: Not Locking App Gateway to Front Door Traffic

**Problem:** Deploying Application Gateway as an origin behind Front Door but leaving it open to direct internet access.

**Result:** Attackers bypass Front Door's WAF and CDN by connecting directly to Application Gateway's public IP.

**Solution:** Configure a WAF custom rule on Application Gateway to validate the `X-Azure-FDID` header matches your Front Door instance ID. Block all requests without a valid header.

---

## Key Takeaways

1. **Load Balancer is for Layer 4, Application Gateway is for Layer 7.** Load Balancer distributes TCP/UDP traffic without inspecting content. Application Gateway terminates connections and makes HTTP-aware routing decisions. Use both in production architectures.

2. **Standard SKU is the only option for Load Balancer.** Basic was retired in September 2025. Standard is closed to inbound by default, so NSGs must explicitly allow traffic including health probes from `168.63.129.16`.

3. **Application Gateway has a significant minimum cost.** Even idle, Application Gateway charges a fixed hourly rate that is 5-7x more expensive than a typical Load Balancer deployment. WAF_v2 adds roughly 80% on top of that. Budget for this and use autoscale minimum of 0 for non-production environments.

4. **Use Load Balancer for internal tier-to-tier traffic.** It is the most cost-effective way to distribute TCP traffic between application tiers within a VNet.

5. **Application Gateway provides WAF protection at the regional level.** OWASP CRS rules protect against SQL injection, XSS, and other web exploits. Start in Detection mode, tune rules, then switch to Prevention.

6. **Cross-region Load Balancer provides global Layer 4 distribution.** For non-HTTP protocols needing multi-region load balancing, the global tier distributes traffic to regional LBs using geo-proximity routing.

7. **HA Ports on Internal LB is the standard pattern for NVA high availability.** Combined with UDRs forcing traffic through the hub, this enables scalable, resilient network virtual appliance deployments.

8. **Application Gateway for Containers (AGC) is the future of AKS ingress.** It replaces AGIC with Gateway API support, Envoy-based data plane, and near real-time configuration. Plan new AKS deployments with AGC.
