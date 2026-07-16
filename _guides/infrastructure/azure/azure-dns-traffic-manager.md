---
title: "Azure DNS & Traffic Manager"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure DNS and Traffic Manager work together for domain hosting, private name resolution, global traffic routing, and hybrid DNS forwarding, with architectural patterns for multi-region and hybrid environments."
tags: [azure-dns, traffic-manager, private-dns-zones, dns-private-resolver, private-endpoints, alias-records, practical]
---

## What Is Azure DNS

[Azure DNS](https://learn.microsoft.com/en-us/azure/dns/dns-overview){:target="_blank" rel="noopener noreferrer"} is a hosting service for DNS domains that provides name resolution using Microsoft's global infrastructure. It supports both public DNS zones (internet-facing) and private DNS zones (VNet-internal). Azure guarantees that valid DNS requests receive a response from at least one Azure DNS name server 100% of the time. That unusually strong SLA comes with a condition. You must delegate your domain to **all four** name servers Azure assigns to the zone, and delegating to fewer forfeits the guarantee.

Unlike AWS Route 53, which combines DNS hosting and traffic routing in a single service, Azure separates these into two services: **Azure DNS** for domain hosting and record management, and **Traffic Manager** for intelligent traffic routing. Understanding how they work together is important for Azure networking design.

### What Problems Azure DNS Solves

**Without managed DNS:**
- Self-hosted DNS servers require patching, monitoring, and high-availability configuration
- No integration with Azure resources (IP changes require manual DNS updates)
- Private name resolution requires deploying and managing internal DNS infrastructure
- No built-in health checking or traffic routing

**With Azure DNS + Traffic Manager:**
- Fully managed DNS with a 100% availability SLA
- Alias records auto-update when Azure resource IPs change
- Private DNS zones provide VNet-internal name resolution with autoregistration
- Traffic Manager adds health-checked, policy-based global routing
- DNS Private Resolver replaces custom forwarder VMs for hybrid scenarios

---

## Public DNS Zones

A public DNS zone in Azure hosts DNS records for a domain that is resolvable from the internet. When you create a zone, Azure assigns four name servers from its global pool that you configure at your domain registrar.

### Record Types

Azure DNS supports all standard record types including A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT, and CAA. SPF records are represented using TXT records.

### Alias Records

[Alias records](https://learn.microsoft.com/en-us/azure/dns/dns-alias){:target="_blank" rel="noopener noreferrer"} are Azure's solution to the problem of DNS records pointing to resources whose IP addresses change. Instead of pointing to a static IP, an alias record points to an Azure resource and automatically updates when the resource's IP changes.

Alias records are a qualification on an A, AAAA, or CNAME record set rather than a record type of their own, and they carry no extra charge.

**Supported targets:**
- Standard SKU public IP addresses
- Azure Traffic Manager profiles
- Azure Front Door endpoints
- Azure CDN endpoints
- Another record set of the same type within the same zone

**Why alias records matter:**

The most important capability is **zone apex support**. Standard DNS rules prohibit CNAME records at the zone apex (the naked domain like `contoso.com`). Alias records bypass this limitation, letting you point `contoso.com` directly to a Traffic Manager profile, Front Door endpoint, or public IP without using a CNAME.

Alias records also prevent dangling DNS entries. If the target resource is deleted, the alias record returns an empty response instead of pointing to a stale IP that could be reassigned to another tenant.

**The zone apex and Traffic Manager combination has a constraint that catches people.** Pointing the apex at a Traffic Manager profile requires an A or AAAA alias, and an A/AAAA alias to Traffic Manager only works if the profile uses **external endpoints specified as static IP addresses**. A profile built on Azure endpoints (Web Apps, public IP resources) or FQDN-based external endpoints cannot be an A/AAAA alias target. CNAME aliases to Traffic Manager carry no such restriction, so the limitation only bites at the apex, which is exactly where you reach for an alias in the first place.

A single Azure resource can be the target of at most 50 alias record sets.

**Scope compared to AWS:** AWS Route 53 alias records support a wider range of targets like CloudFront distributions, ALBs, S3 buckets, and API Gateway endpoints. Azure's list is narrower, and Application Gateway and Load Balancer are notably absent as alias targets in their own right. In practice this matters less than it sounds, because both sit behind a public IP resource, and the public IP *is* an alias target. Point the alias at the front end's public IP rather than at the service.

### DNSSEC

DNSSEC support for Azure public DNS zones reached general availability in February 2025. Zone signing creates a DS (Delegation Signer) record that must be added to the parent zone at your registrar. The parent zone must also support DNSSEC (most major TLDs like .com, .net, and .org already do). Zones are signed with ECDSAP256SHA256, and Azure rolls the zone signing key automatically.

Two limits shape what DNSSEC can do for you here. It applies to **public zones only**, so private DNS zones cannot be signed. And **the Azure-provided resolver at `168.63.129.16` does not perform DNSSEC validation**. Signing your zone protects external resolvers that validate, but it does not mean your own Azure VMs are validating the responses they receive. Validation is the resolver's job, and Azure's default one doesn't do it.

### Pricing

Azure DNS is one of the least expensive Azure services. Both public and private zones are billed the same way, with a monthly charge per hosted zone plus a per-query charge, and volume discounts as usage grows. Private zone queries are billed rather than free, which is a common misconception, though at typical volumes the bill stays negligible. Alias records add no charge.

---

## Private DNS Zones

[Azure Private DNS](https://learn.microsoft.com/en-us/azure/dns/private-dns-overview){:target="_blank" rel="noopener noreferrer"} provides DNS name resolution within virtual networks without deploying custom DNS servers. Records in a private DNS zone are not resolvable from the internet. They only resolve from VNets that are linked to the zone.

**A private DNS zone is a global resource, not a regional one.** Azure stores the zone data outside any single region or VNet, which means one zone can serve VNets in any number of regions and survives a regional service interruption. The zone lives in a resource group for management and billing purposes, but that resource group's location has no bearing on where the zone resolves. This is why centralizing `privatelink.*` zones in a hub subscription works across a global estate rather than needing a copy per region.

Private zones support A, AAAA, CNAME, MX, PTR, SOA, SRV, and TXT records. They do not support NS records, so you cannot delegate a child zone from within a private zone. Create the child domain as its own private zone and link it directly instead. Zone names must have at least two labels (`contoso.com`, not `contoso`), and Azure blocks a reserved list of names including `azure.com`, `windows.net`, `core.windows.net`, and `trafficmanager.net` to keep you from shadowing the platform's own resolution.

### Virtual Network Links

A private DNS zone must be linked to one or more VNets to be resolvable. There are two types of links:

**Resolution links** allow VMs in the linked VNet to resolve records in the private DNS zone. This is the default link type.

**Registration links** (autoregistration enabled) automatically create and manage A records for VMs in the linked VNet. When a VM is deployed, its A record is created automatically. When the VM's IP changes, the record updates. When the VM is deleted, the record is removed.

**Autoregistration constraints:**
- A VNet can have autoregistration enabled for only one private DNS zone
- A VNet can have resolution-only links to as many as 1,000 private DNS zones
- A single private DNS zone can accept autoregistration links from up to 100 VNets, and resolution links from up to 1,000

Disabling autoregistration on an existing link **immediately and permanently deletes every record that link registered**. There is no recovery path short of re-enabling autoregistration and letting the VMs re-register, or recreating the records by hand. Treat the autoregistration toggle on a live link as a destructive operation.

### Private Endpoint DNS Resolution

Private Endpoint DNS resolution is one of the most important Azure networking concepts to understand. It uses a CNAME chain mechanism that works transparently with existing application connection strings.

**How the CNAME chain works:**

When you create a Private Endpoint for a storage account called `myaccount`:

1. Azure creates a CNAME in public DNS: `myaccount.blob.core.windows.net` → `myaccount.privatelink.blob.core.windows.net`
2. You create a private DNS zone called `privatelink.blob.core.windows.net` with an A record: `myaccount` → `10.0.3.4` (the Private Endpoint's IP)
3. You link the private DNS zone to your VNet
4. When a VM in the VNet resolves `myaccount.blob.core.windows.net`, Azure's DNS follows the CNAME chain and returns the private IP `10.0.3.4`
5. When an internet client resolves the same name, the CNAME chain resolves to the public IP (since the `privatelink` zone is not available outside the VNet)

**Each Azure service, and often each sub-resource, has its own private DNS zone name:**

| Service | Private DNS Zone |
|---------|-----------------|
| Blob Storage | `privatelink.blob.core.windows.net` |
| Azure SQL Database | `privatelink.database.windows.net` |
| Key Vault | `privatelink.vaultcore.azure.net` |
| Cosmos DB (SQL API) | `privatelink.documents.azure.com` |
| Azure Monitor | five zones (see below) |

The mapping is not reliably one zone per service, and assuming it is will leave you with a half-working private endpoint. Two patterns break the assumption:

**A service can span several zones.** Storage needs a separate zone per sub-resource (`blob`, `file`, `queue`, `table`, `dfs`, `web`). Cosmos DB uses a different zone per API, with `documents` for SQL, `mongo.cosmos` for MongoDB, `cassandra.cosmos` for Cassandra, and so on. Azure Monitor is the extreme case. A private link scope needs five zones together: `privatelink.monitor.azure.com`, `privatelink.oms.opinsights.azure.com`, `privatelink.ods.opinsights.azure.com`, `privatelink.agentsvc.azure-automation.net`, and `privatelink.blob.core.windows.net`. Miss one and part of the telemetry pipeline silently keeps using public endpoints.

**Auto-creation depends on exact naming.** Azure only wires up the private DNS zone configuration automatically if the zone uses the documented name. A zone named anything else is a zone you maintain by hand.

Don't put records for two different services in one zone, either. The second private endpoint's registration deletes the first one's A record, and resolution breaks for both.

The full mapping, which changes as services are added, is maintained in the [Private Endpoint DNS documentation](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns){:target="_blank" rel="noopener noreferrer"}.

### Split-Horizon DNS

You can create a public DNS zone and a private DNS zone with the same domain name. Resources inside the linked VNet resolve using the private zone, while internet clients resolve using the public zone. This is useful when the same hostname should resolve to different IPs depending on where the query originates.

---

## Azure Traffic Manager

### What Traffic Manager Does

[Azure Traffic Manager](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-overview){:target="_blank" rel="noopener noreferrer"} is a DNS-based global traffic load balancer. It directs client requests to the most appropriate endpoint based on a configured routing method and endpoint health status.

**Traffic Manager is not a proxy.** It returns the DNS address of the best endpoint, and the client connects directly to that endpoint. No application data flows through Traffic Manager. This means there is no added latency on the data path after the initial DNS resolution.

**Because Traffic Manager operates at the DNS layer, it works with any protocol** including HTTP, HTTPS, TCP, UDP, and custom protocols. This is the fundamental differentiator from Azure Front Door, which only handles HTTP/HTTPS.

### Routing Methods

Traffic Manager offers six routing methods, each solving a different traffic distribution problem:

**Priority:** Routes all traffic to the highest-priority (lowest number) healthy endpoint. When the primary fails health checks, traffic shifts to the next priority level. This is the standard active-passive failover pattern.

**Weighted:** Distributes traffic proportionally based on assigned weights (1-1000). A weight of 300 on endpoint A and 100 on endpoint B sends 75% of traffic to A and 25% to B. Useful for gradual traffic migration, A/B testing, and blue/green deployments.

**Performance:** Routes to the endpoint with the lowest network latency from the user's location. Microsoft maintains an Internet Latency Table that maps IP ranges to Azure regions. The closest geographic endpoint is not always the fastest due to network topology, which is why this method uses measured latency rather than distance.

**Geographic:** Routes based on the geographic origin of the DNS query, resolved from the source IP at four granularities: World, regional grouping (Africa, Middle East), country/region, or state/province (the last only for Australia, Canada, and the USA). Each endpoint is mapped to specific regions, and lookup runs finest-to-coarsest, taking the first match. Use this for data residency compliance and content localization.

Two behaviors make Geographic the sharpest-edged routing method. **A region maps to exactly one endpoint.** That is what makes routing deterministic and data-residency boundaries defensible, but it also means there is nowhere to fail over to, so **Traffic Manager returns the mapped endpoint whether or not it is healthy**. And a query from a region with no mapping gets a NODATA response, leaving those users unable to reach the application at all. Both problems have the same fix. Assign the **World** region to a catch-all endpoint, and make your endpoints Nested profiles with at least two children each, so failover happens inside the child where routing isn't geography-constrained. Microsoft recommends this strongly enough that treating it as optional is a mistake.

**Multivalue:** Returns multiple healthy endpoint IP addresses in a single DNS response. The client chooses which to connect to, providing client-side retry without a second DNS round trip. You configure the maximum record count in the response, which defaults to 2 and can go as high as 10. This only works when every endpoint is an external endpoint given as an IPv4 or IPv6 address. It is also the one routing method that lets you mix IPv4 and IPv6 in a single profile, and the one that cannot serve as a parent in a nested hierarchy.

**Subnet:** Maps specific source IP address ranges to specific endpoints. When Traffic Manager receives a query, it inspects the source IP and returns the mapped endpoint. Useful for routing corporate office traffic differently from public traffic, or for ISP-specific experiences.

### Endpoint Types

| Endpoint Type | Target | Use Case |
|---------------|--------|----------|
| **Azure** | Web Apps, Web App slots, PublicIPAddress resources, PaaS cloud services | Routing to Azure-hosted services |
| **External** | IPv4/IPv6 addresses or FQDNs, inside or outside Azure | Routing to on-premises or multi-cloud services |
| **Nested** | Another Traffic Manager profile | Combining routing methods in hierarchies |

Three Azure-endpoint constraints account for most of the failed configurations:

- **A PublicIPAddress resource must have a DNS name assigned** before Traffic Manager will accept it. A bare IP with no DNS label is rejected.
- **Web Apps must be on the Standard SKU or higher.** Adding a lower-tier app fails, and *downgrading* an app that is already an endpoint quietly stops traffic to it.
- **A profile accepts at most one Web App endpoint per Azure region.** To place two apps from the same region in one profile, add the second as an external endpoint.

Endpoint types don't mix freely: external endpoints addressed by IP can't share a profile with Azure endpoints, and you can't combine FQDN-target and IP-target external endpoints in the same profile.

### Health Probes

Traffic Manager continuously monitors endpoint health from multiple global locations:

- **Protocols:** HTTP, HTTPS, or TCP
- **Probe interval:** 30 seconds (standard) or 10 seconds (fast, at additional cost). These are the only two values
- **Tolerated failures:** 0-9 consecutive failures before marking unhealthy (default: 3). A value of 0 means one failed probe takes the endpoint out, which invites removal on transient blips
- **Probe timeout:** 5-10 seconds on a 30-second interval (default 10), 5-9 seconds on a 10-second interval (default 9)
- **Expected status codes:** 200 by default, with up to eight ranges configurable. Anything outside them counts as a failure, including other 2xx codes and 301/302 redirects
- **HTTPS probes** check that a certificate is *present*, not that it is valid. An expired or hostname-mismatched certificate still passes the health check
- All endpoints in a profile share the same monitoring configuration. Use nested profiles when you need per-endpoint monitoring settings

**Probes must be allowed through.** Health checks come from Traffic Manager's own infrastructure, not from your VNet. If an NSG, firewall, or appliance in the path blocks them, every endpoint goes Degraded. Use the `AzureTrafficManager` service tag in NSG and Azure Firewall rules rather than maintaining an IP list by hand.

**When every endpoint is Degraded, Traffic Manager returns them anyway.** Rather than answer with nothing, it makes a best-effort attempt and responds as though all the degraded endpoints were online. Traffic keeps flowing and the application looks fine, which is exactly what makes this dangerous. A profile whose health checks are misconfigured (blocked probes, wrong port, wrong path) behaves indistinguishably from a healthy one under normal conditions, while failover silently cannot happen, because Traffic Manager has no healthy endpoint to prefer. The profile's own status is the tell, and it should read Online rather than Degraded. A Degraded profile that is still serving traffic correctly is not a cosmetic problem. It means the failover you're paying for is not armed.

### Nested Profiles

Nested profiles combine routing methods to create sophisticated multi-level routing hierarchies. The parent profile treats the child profile as an endpoint and routes to it based on the parent's routing method. The child profile then routes further within its own method.

**Common nesting patterns:**

| Parent Method | Child Method | Pattern |
|---------------|-------------|---------|
| Performance | Priority | Route to nearest region, then failover within region |
| Performance | Weighted | Route to nearest region, then distribute within region |
| Geographic | Performance | Comply with data residency, then optimize for latency |
| Priority | Performance | Primary region handles all, secondary only during failover |

The parent does not health-check the child directly. It consumes the child's aggregate health, which propagates up the hierarchy, and applies `MinChildEndpoints`, the minimum number of healthy child endpoints required for the parent to treat the nested endpoint as healthy. It defaults to **1**, so the parent keeps sending traffic to the child until the last child endpoint fails, which is often not what you want. Setting it to 2 in a two-endpoint child profile makes the parent fail the whole region over as soon as either endpoint drops, rather than letting all regional traffic pile onto the survivor. Profiles with IPv4 and IPv6 endpoints have separate `MinChildEndpointsIPv4` and `MinChildEndpointsIPv6` thresholds, both defaulting to 0 for backward compatibility, and a nested Multivalue profile needs them set explicitly.

Profiles nest up to 10 levels deep, and loops are rejected.

### TTL Considerations

Traffic Manager accepts TTL values from 0 seconds up to the RFC-1035 maximum. TTL governs the propagation half of failover and the query bill, trading one against the other:

| TTL | Propagation Delay | Cost Impact |
|-----|---------------|-------------|
| 0-30 seconds | Seconds | Higher (more queries reach Traffic Manager) |
| 60 seconds | About a minute | Balanced |
| 300 seconds | Minutes | Lower (more caching by resolvers) |

TTL is only half the equation, and lowering it cannot buy back time that detection already spent.

**Real-world failover time** is detection plus propagation. Detection is the probe interval multiplied by the tolerated failure count, the term people forget and usually the dominant one. A 10-second probe with the default tolerance of 3 takes about 40 seconds to declare an endpoint dead, not 10. Propagation is the DNS TTL plus however long recursive resolvers and client-side caches take to actually honor it. For a critical workload with fast probes and a 30-second TTL, plan on roughly 40-70 seconds end to end. Microsoft quotes sub-10-second failover, which is achievable only at the aggressive extreme of tolerance 0 and TTL 0, where you trade away all resilience to transient blips and all resolver caching.

### Pricing

Traffic Manager charges per DNS query plus a monthly health-check fee per endpoint. Azure endpoints are billed at a lower health-check rate than external or nested ones. Fast health probes (10-second interval) and optional Traffic View incur additional charges.

Two billing details are easy to get wrong. Health-check billing for an *external* endpoint continues even if you stop or delete the underlying service, and stops only when you disable or delete the endpoint in Traffic Manager itself. Azure endpoints don't behave this way, because Traffic Manager notices a stopped Web App and pauses billing. Endpoints set to "always serve traffic" with health checks disabled are still billed for basic health checks.

Overall, Traffic Manager is significantly cheaper than Front Door for DNS-only routing, which makes it attractive when the edge features are not needed.

---

## Traffic Manager vs Azure Front Door

This is one of the most common architectural decisions for Azure networking. Both distribute traffic globally, but they use different mechanisms to do it. Traffic Manager answers a DNS query and steps out of the way, while Front Door terminates the connection and forwards the request itself. Nearly every difference below follows from that one distinction.

| Aspect | Traffic Manager | Azure Front Door |
|--------|----------------|------------------|
| **Mechanism** | DNS resolution (returns an address) | HTTP reverse proxy (forwards the request) |
| **Data path** | Not in data path (DNS only) | All traffic flows through Front Door |
| **Protocols** | Any (HTTP, TCP, UDP, custom) | HTTP/HTTPS only |
| **Caching** | None | Built-in CDN edge caching |
| **WAF** | None | Integrated WAF with managed rules |
| **SSL termination** | None (endpoint handles TLS) | TLS termination at edge PoPs |
| **Session affinity** | None (DNS-based) | Cookie-based session affinity |
| **URL routing** | None (returns one endpoint per query) | Path-based, header-based, query string |
| **Failover speed** | Probe detection + DNS TTL (~40-70s typical) | Near-instant (connection-level) |
| **Cost** | Lower (per-query DNS charges) | Higher (per-request + data transfer + WAF) |

**Use Traffic Manager when:**
- Non-HTTP protocols are involved (TCP services, databases, gaming, IoT)
- Simple DNS-level failover or distribution is sufficient
- Endpoints already handle their own TLS, WAF, and caching
- Budget constraints make Front Door's per-request pricing impractical

**Use Front Door when:**
- HTTP/HTTPS web applications and APIs need global distribution
- WAF protection, caching, or SSL offloading is required at the edge
- URL-based or header-based routing rules are needed
- Near-instant failover (not DNS-TTL-dependent) is required

**Combined architecture:** Traffic Manager can sit above Front Door for extreme high availability. If Front Door experiences a regional issue, Traffic Manager routes to an alternative destination.

---

## DNS Resolution in Azure

### Azure-Provided DNS (168.63.129.16)

Every VM in Azure uses `168.63.129.16` as its default DNS server. This static virtual IP acts as a recursive resolver that handles:

- Azure Private DNS zone resolution (when VNet links exist)
- Private Endpoint name resolution through the CNAME chain
- Azure-internal VM hostname resolution (`vmname.internal.cloudapp.net`)
- Internet DNS queries (forwarded to public DNS servers)
- Azure platform communication (health probes, DHCP, metadata service)

This address never changes regardless of region or VNet. It is the backbone of all DNS resolution in Azure.

### Custom DNS Servers

You can configure custom DNS servers at the VNet level or individual NIC level (NIC settings override VNet settings). Common reasons include:

- On-premises Active Directory domain resolution
- Custom DNS policies or filtering
- Centralized DNS logging

Setting a custom DNS server replaces Azure's resolution order rather than extending it. A VNet on default DNS settings consults its linked private DNS zones first and Azure-provided DNS second. The moment you specify a custom server, **neither of those happens automatically**, and every query goes to your server and stops there. The private DNS zones are still linked, still populated, and no longer consulted.

**Custom DNS servers must therefore forward Azure-specific queries back to `168.63.129.16`** to restore Private DNS zone resolution, Private Endpoint resolution, and Azure platform functionality. If the custom server is a VM, that means a conditional forwarder. If you'd rather not run forwarder VMs at all, an Azure DNS Private Resolver in a VNet linked to the private zone solves the same problem, and closing this exact gap is what it was built for.

---

## Azure DNS Private Resolver

### What Private Resolver Does

[Azure DNS Private Resolver](https://learn.microsoft.com/en-us/azure/dns/dns-private-resolver-overview){:target="_blank" rel="noopener noreferrer"} is a fully managed service that enables DNS query forwarding between Azure virtual networks and on-premises networks. It replaces the traditional pattern of deploying IaaS VMs running DNS forwarder software like BIND or Windows DNS.

### Components

**Inbound endpoints** provide an IP address within a VNet subnet that on-premises DNS servers can forward queries to. On-premises DNS servers create conditional forwarders pointing to the inbound endpoint's IP, enabling on-premises resources to resolve Azure Private DNS zones and Private Endpoint names.

**Outbound endpoints** enable Azure VMs to forward DNS queries to on-premises DNS servers or external resolvers. They are connected to DNS forwarding rulesets that define which domains get forwarded where.

**DNS forwarding rulesets** define rules that map domain names to target DNS server IPs. A rule for `corp.contoso.com` with target `10.0.0.4` forwards all queries for that domain to the on-premises DNS server at that address. Rulesets can be shared across multiple VNets for consistent forwarding behavior.

### Architecture Pattern

In a hub-and-spoke topology, deploy the Private Resolver in the hub VNet:

```
On-Premises DNS Server
   ↓ conditional forward (privatelink.*.core.windows.net → inbound endpoint IP)
Inbound Endpoint (hub VNet, dedicated /28 subnet)
   → resolves Private DNS zones, Private Endpoints

Azure VMs in spoke VNets
   ↓ DNS query for corp.contoso.com
Outbound Endpoint (hub VNet, separate dedicated /28 subnet)
   → DNS Forwarding Ruleset
   → forwards to on-premises DNS server via ExpressRoute/VPN
```

**Scope:** a resolver is a regional, single-VNet resource. It binds to exactly one VNet in its own region, multiple resolvers cannot share a VNet, and a resolver cannot reach across regions. That constraint is what makes the hub placement above the standard answer. The hub's resolver serves spokes through peering and forwarding rulesets rather than through the resolver itself spanning VNets. Rulesets link to as many as 500 VNets and are the piece that actually scales across the estate.

Each endpoint requires its own subnet, sized between /28 and /24, delegated to `Microsoft.Network/dnsResolvers` and used by nothing else. A /28 accommodates current endpoint limits, while /27 or larger buys headroom if those limits change. Endpoints cannot share a subnet.

A single resolver supports up to 5 inbound and 5 outbound endpoints, and a ruleset holds up to 1,000 forwarding rules. Check the harder edges before committing to a design: rulesets cannot be linked across tenants, IPv6-enabled subnets are not supported, and the service is incompatible with both Azure Lighthouse and ExpressRoute FastPath.

### When You Need Private Resolver

- Hybrid DNS resolution between Azure and on-premises networks
- Replacing existing DNS forwarder VMs to eliminate operational overhead
- On-premises resources need to resolve Azure Private DNS zones and Private Endpoints
- Azure resources need to resolve on-premises Active Directory domains

### When You Do Not Need It

- Pure cloud environments with no on-premises connectivity (Azure-provided DNS handles everything)
- Simple Private Endpoint resolution within a single VNet (VNet links to private DNS zones are sufficient)
- Environments where domain controllers already running DNS must remain the primary DNS infrastructure

### Pricing

Private Resolver charges an hourly rate per endpoint. Most hybrid deployments need both an inbound and outbound endpoint. Compared to running HA VMs as DNS forwarders, Private Resolver is cost-competitive and operationally simpler because it eliminates VM management, patching, and availability configuration.

---

## Common Pitfalls

### Pitfall 1: Missing Private DNS Zone Links for Private Endpoints

**Problem:** Creating Private Endpoints without linking the corresponding `privatelink.*` private DNS zone to the VNet.

**Result:** Private Endpoint names resolve to public IPs instead of private IPs. Traffic goes over the internet instead of staying within the VNet, or fails entirely if the public endpoint is disabled.

**Solution:** Always create the appropriate private DNS zone (e.g., `privatelink.blob.core.windows.net`) and link it to every VNet that needs to resolve Private Endpoint names. In hub-and-spoke topologies, centralize private DNS zones in the hub and link them to all spoke VNets.

---

### Pitfall 2: Custom DNS Servers Without Azure DNS Forwarding

**Problem:** Configuring custom DNS servers on a VNet without forwarding Azure-specific queries to `168.63.129.16`.

**Result:** Private DNS zone resolution breaks. Private Endpoint resolution breaks. Azure platform services that depend on DNS (like Windows activation and Azure Backup) fail.

**Solution:** Configure conditional forwarding rules on custom DNS servers to forward Azure-internal zones to `168.63.129.16`. At minimum, forward `privatelink.*` zones, `internal.cloudapp.net`, and `azure-dns.com`.

---

### Pitfall 3: Geographic Routing Without a World Catch-All or Nested Children

**Problem:** Configuring Geographic routing with endpoints mapped only to the specific regions you serve, each endpoint a plain Azure or external endpoint.

**Result:** Two separate failures. Users from any unmapped region get a NODATA response and cannot reach the application at all, including users whose IP doesn't map cleanly to a region. Worse, because a geographic region maps to exactly one endpoint, there is no alternative to fail over to, so Traffic Manager returns that endpoint even after it goes unhealthy. Geographic routing gives you no failover by construction.

**Solution:** Assign the **World** region to a catch-all endpoint, and make each endpoint a Nested profile with at least two children. Geography then picks the child profile, and the child profile picks a live endpoint within it by routing on Priority or Performance, both of which are health-aware.

---

### Pitfall 4: Ignoring DNS TTL Impact on Failover

**Problem:** Using high TTL values (300+ seconds) with Traffic Manager for critical workloads that need fast failover.

**Result:** Even after Traffic Manager detects an unhealthy endpoint, clients continue using the cached DNS response for the duration of the TTL, sending traffic to the failed endpoint.

**Solution:** Use lower TTL values (30-60 seconds) for workloads that need fast failover, and accept the trade-off of higher DNS query costs. Tune detection at the same time, since TTL only governs propagation. Fast probes at 10-second intervals with a lowered failure tolerance are what shorten the detection half, and a 30-second TTL buys nothing if the endpoint still takes 90 seconds to be declared unhealthy.

Some clients cache DNS beyond the TTL regardless of what you set. Java applications with the default JVM DNS cache and browsers with their own pinning are the usual offenders, so a low TTL sets the floor on failover time rather than guaranteeing it.

---

### Pitfall 5: Zone Apex Alias to a Traffic Manager Profile with Azure Endpoints

**Problem:** Pointing the zone apex at a Traffic Manager profile with an A/AAAA alias record while the profile uses Azure endpoints or FQDN-based external endpoints.

**Result:** The alias cannot be created. A/AAAA aliases to Traffic Manager require the profile to use external endpoints given as static IP addresses, because the record type has to resolve to an address rather than a name.

**Solution:** Convert the profile's endpoints to external endpoints with static public IPs, or front the apex with something that is directly aliasable. Azure Front Door endpoints are supported alias targets, so an HTTP workload can skip Traffic Manager entirely. Application Gateway and Load Balancer front ends are still not alias targets, but their public IP resources are, so alias the public IP instead.

---

## Key Takeaways

1. **Azure separates DNS hosting from traffic routing.** Azure DNS hosts zones and records. Traffic Manager provides intelligent routing. Understanding how they work together is essential for multi-region architectures.

2. **Traffic Manager is DNS-only and protocol-agnostic.** It returns the best endpoint's address and is never in the data path. This makes it suitable for any protocol but limits it to DNS-level routing without caching, WAF, or session affinity.

3. **Private DNS zones are the foundation for Private Endpoint resolution.** The CNAME chain mechanism (`service.blob.core.windows.net` → `service.privatelink.blob.core.windows.net` → private IP) works transparently but requires the correct private DNS zones to be created and linked to VNets.

4. **Alias records solve the zone apex problem.** Standard CNAME records cannot exist at the zone apex. Alias records can point `contoso.com` directly to a Standard SKU public IP, Traffic Manager profile, Front Door endpoint, CDN endpoint, or another record set in the same zone, and they auto-update when the target's IP changes. The apex case has a catch: an A/AAAA alias to Traffic Manager requires the profile to use external endpoints with static IPs.

5. **DNS Private Resolver replaces forwarder VMs.** For hybrid DNS scenarios where on-premises and Azure need to resolve each other's names, Private Resolver eliminates the operational burden of managing DNS forwarder VMs while providing built-in high availability. It binds to one VNet in one region, so the hub is where it belongs.

6. **Custom DNS servers must forward to 168.63.129.16.** Without this forwarding, Private DNS zones, Private Endpoints, and Azure platform DNS features break silently. This is one of the most common hybrid networking mistakes.

7. **Traffic Manager failover speed is detection plus propagation.** Detection is probe interval times tolerated failures, the term most people drop and usually the largest. Propagation is DNS TTL plus resolver cache expiry. Fast probes with a 30-second TTL land around 40-70 seconds, and the sub-10-second figure requires zero failure tolerance and zero TTL.

8. **A Degraded Traffic Manager profile still serves traffic.** When all endpoints fail their health checks, Traffic Manager returns them as if healthy rather than answering with nothing. A misconfigured profile therefore looks perfectly healthy right up until you need failover, which is when you discover it was never armed. Check the profile status, not the application.

9. **Use Traffic Manager for non-HTTP protocols, Front Door for HTTP/HTTPS.** If the workload is a web application needing WAF, caching, and instant failover, use Front Door. If the workload uses TCP, UDP, or any protocol beyond HTTP, Traffic Manager is the only option.
