---
title: "Azure DNS & Traffic Manager"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure DNS and Traffic Manager work together for domain hosting, private name resolution, global traffic routing, and hybrid DNS forwarding, with architectural patterns for multi-region and hybrid environments."
tags: [infrastructure, azure, networking, dns, scalability, reliability, practical]
---

## What Is Azure DNS

[Azure DNS](https://learn.microsoft.com/en-us/azure/dns/dns-overview){:target="_blank" rel="noopener noreferrer"} is a hosting service for DNS domains that provides name resolution using Microsoft's global infrastructure. It supports both public DNS zones (internet-facing) and private DNS zones (VNet-internal), and backs the 100% SLA that Azure offers for DNS query resolution.

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

**Supported targets:**
- Azure public IP addresses
- Azure Traffic Manager profiles
- Azure CDN endpoints

**Why alias records matter:**

The most important capability is **zone apex support**. Standard DNS rules prohibit CNAME records at the zone apex (the naked domain like `contoso.com`). Alias records bypass this limitation, letting you point `contoso.com` directly to a Traffic Manager profile or public IP without using a CNAME.

Alias records also prevent dangling DNS entries. If the target resource is deleted, the alias record returns an empty response instead of pointing to a stale IP that could be reassigned to another tenant.

**Scope compared to AWS:** AWS Route 53 alias records support a wider range of targets like CloudFront distributions, ALBs, S3 buckets, and API Gateway endpoints. Azure alias records are limited to public IPs, Traffic Manager, and CDN endpoints. For other Azure services, use CNAME records pointing to the service's FQDN or Traffic Manager as an intermediary.

### DNSSEC

Azure DNS reached general availability for DNSSEC support in early 2025. Zone signing creates a DS (Delegation Signer) record that must be added to the parent zone at your registrar. The parent zone must also support DNSSEC (most major TLDs like .com, .net, and .org already do).

### Pricing

Azure DNS is one of the least expensive Azure services. Pricing is based on the number of hosted zones plus a per-query charge. Private DNS zone queries are free. Overall DNS costs are negligible for most workloads.

---

## Private DNS Zones

[Azure Private DNS](https://learn.microsoft.com/en-us/azure/dns/private-dns-overview){:target="_blank" rel="noopener noreferrer"} provides DNS name resolution within virtual networks without deploying custom DNS servers. Records in a private DNS zone are not resolvable from the internet; they only resolve from VNets that are linked to the zone.

### Virtual Network Links

A private DNS zone must be linked to one or more VNets to be resolvable. There are two types of links:

**Resolution links** allow VMs in the linked VNet to resolve records in the private DNS zone. This is the default link type.

**Registration links** (autoregistration enabled) automatically create and manage A records for VMs in the linked VNet. When a VM is deployed, its A record is created automatically. When the VM's IP changes, the record updates. When the VM is deleted, the record is removed.

**Autoregistration constraints:**
- A VNet can have autoregistration enabled for only one private DNS zone
- A VNet can have resolution-only links to many additional private DNS zones
- A single private DNS zone can have autoregistration links from multiple VNets

### Private Endpoint DNS Resolution

Private Endpoint DNS resolution is one of the most important Azure networking concepts to understand. It uses a CNAME chain mechanism that works transparently with existing application connection strings.

**How the CNAME chain works:**

When you create a Private Endpoint for a storage account called `myaccount`:

1. Azure creates a CNAME in public DNS: `myaccount.blob.core.windows.net` → `myaccount.privatelink.blob.core.windows.net`
2. You create a private DNS zone called `privatelink.blob.core.windows.net` with an A record: `myaccount` → `10.0.3.4` (the Private Endpoint's IP)
3. You link the private DNS zone to your VNet
4. When a VM in the VNet resolves `myaccount.blob.core.windows.net`, Azure's DNS follows the CNAME chain and returns the private IP `10.0.3.4`
5. When an internet client resolves the same name, the CNAME chain resolves to the public IP (since the `privatelink` zone is not available outside the VNet)

**Each Azure service has its own private DNS zone name:**

| Service | Private DNS Zone |
|---------|-----------------|
| Blob Storage | `privatelink.blob.core.windows.net` |
| Azure SQL Database | `privatelink.database.windows.net` |
| Key Vault | `privatelink.vaultcore.azure.net` |
| Cosmos DB | `privatelink.documents.azure.com` |
| Azure Monitor | `privatelink.monitor.azure.com` |

A full list is maintained in the [Private Endpoint DNS documentation](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns){:target="_blank" rel="noopener noreferrer"}.

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

**Performance:** Routes to the endpoint with the lowest network latency from the user's location. Microsoft maintains an Internet Latency Table that maps IP ranges to Azure regions. The closest geographic endpoint is not always the fastest due to network topology; this method uses measured latency, not distance.

**Geographic:** Routes based on the geographic origin of the DNS query (continent, country, or state/province). Each endpoint is mapped to specific regions. A default endpoint catches unmapped regions; without one, unmapped users receive an empty DNS response. Use this for data residency compliance and content localization.

**Multivalue:** Returns multiple healthy endpoint IP addresses (up to 8) in a single DNS response. The client chooses which to connect to, providing client-side failover. Only works with external endpoints that have IPv4 or IPv6 addresses.

**Subnet:** Maps specific source IP address ranges to specific endpoints. When Traffic Manager receives a query, it inspects the source IP and returns the mapped endpoint. Useful for routing corporate office traffic differently from public traffic, or for ISP-specific experiences.

### Endpoint Types

| Endpoint Type | Target | Use Case |
|---------------|--------|----------|
| **Azure** | Azure resources (Web Apps, public IPs, Cloud Services) | Routing to Azure-hosted services |
| **External** | IPv4/IPv6 addresses or FQDNs outside Azure | Routing to on-premises or multi-cloud services |
| **Nested** | Another Traffic Manager profile | Combining routing methods in hierarchies |

### Health Probes

Traffic Manager continuously monitors endpoint health from multiple global locations:

- **Protocols:** HTTP, HTTPS, or TCP
- **Probe interval:** 30 seconds (standard) or 10 seconds (fast, at additional cost)
- **Failure threshold:** 0-9 consecutive failures before marking unhealthy (default: 3)
- **HTTPS probes** check for a 200 OK response but do not validate the TLS certificate
- All endpoints in a profile share the same monitoring configuration; for per-endpoint monitoring settings, use nested profiles

### Nested Profiles

Nested profiles combine routing methods to create sophisticated multi-level routing hierarchies. The parent profile treats the child profile as an endpoint and routes to it based on the parent's routing method; the child profile then further routes within its own method.

**Common nesting patterns:**

| Parent Method | Child Method | Pattern |
|---------------|-------------|---------|
| Performance | Priority | Route to nearest region, then failover within region |
| Performance | Weighted | Route to nearest region, then distribute within region |
| Geographic | Performance | Comply with data residency, then optimize for latency |
| Priority | Performance | Primary region handles all, secondary only during failover |

The parent monitors the child profile's aggregate health through the `MinChildEndpoints` parameter: the minimum number of healthy child endpoints before the parent considers the nested endpoint unhealthy.

### TTL Considerations

Traffic Manager allows TTL values as low as 0 seconds. The TTL directly affects failover speed and query cost:

| TTL | Failover Speed | Cost Impact |
|-----|---------------|-------------|
| 0-30 seconds | Fast (seconds) | Higher (more queries reach Traffic Manager) |
| 60 seconds | Moderate | Balanced |
| 300 seconds | Slow (minutes) | Lower (more caching by resolvers) |

**Real-world failover time** equals the health check interval plus the DNS TTL plus the time for recursive resolvers to expire cached entries. For a critical workload with a 10-second fast probe interval and 30-second TTL, expect failover in roughly 40-70 seconds.

### Pricing

Traffic Manager charges per DNS query plus a per-endpoint monthly fee. Azure endpoints cost less than external or nested endpoints. Fast health probes (10-second interval) and optional Traffic Views incur additional charges. Overall, Traffic Manager is significantly cheaper than Front Door for DNS-only routing scenarios, which makes it attractive when Layer 7 features are not needed.

---

## Traffic Manager vs Azure Front Door

This is one of the most common architectural decisions for Azure networking. The two services solve different problems at different network layers.

| Aspect | Traffic Manager | Azure Front Door |
|--------|----------------|------------------|
| **Layer** | DNS (Layer 3/4) | HTTP reverse proxy (Layer 7) |
| **Data path** | Not in data path (DNS only) | All traffic flows through Front Door |
| **Protocols** | Any (HTTP, TCP, UDP, custom) | HTTP/HTTPS only |
| **Caching** | None | Built-in CDN edge caching |
| **WAF** | None | Integrated WAF with managed rules |
| **SSL termination** | None (endpoint handles TLS) | TLS termination at edge PoPs |
| **Session affinity** | None (DNS-based) | Cookie-based session affinity |
| **URL routing** | None (returns one endpoint per query) | Path-based, header-based, query string |
| **Failover speed** | DNS TTL dependent (30-60s typical) | Near-instant (connection-level) |
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

**When using custom DNS servers, they should forward Azure-specific queries to `168.63.129.16`** to preserve Private DNS zone resolution, Private Endpoint resolution, and Azure platform functionality. Without this forwarding, Azure DNS features break silently.

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

Each endpoint requires its own dedicated subnet (minimum /28) that cannot contain other resources.

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

### Pitfall 3: Geographic Routing Without a Default Endpoint

**Problem:** Configuring Traffic Manager with Geographic routing but not assigning a default endpoint.

**Result:** Users from unmapped regions receive an empty DNS response and cannot reach the application at all.

**Solution:** Always configure a default endpoint in Geographic routing profiles to catch unmapped regions.

---

### Pitfall 4: Ignoring DNS TTL Impact on Failover

**Problem:** Using high TTL values (300+ seconds) with Traffic Manager for critical workloads that need fast failover.

**Result:** Even after Traffic Manager detects an unhealthy endpoint, clients continue using the cached DNS response for the duration of the TTL, sending traffic to the failed endpoint.

**Solution:** Use lower TTL values (30-60 seconds) for workloads that need fast failover. Combine with fast health probes (10-second intervals) for the fastest detection. Accept the trade-off of higher DNS query costs.

---

### Pitfall 5: Alias Record Target Limitations

**Problem:** Trying to create an alias record for the zone apex pointing to an Application Gateway, Azure Front Door, or other services that are not in the supported target list.

**Result:** Alias records only support public IP addresses, Traffic Manager profiles, and CDN endpoints. Other Azure services are not supported as alias record targets.

**Solution:** Place a Traffic Manager profile between the alias record and the unsupported target. The alias record points to Traffic Manager, and Traffic Manager routes to the actual service endpoint.

---

## Key Takeaways

1. **Azure separates DNS hosting from traffic routing.** Azure DNS hosts zones and records. Traffic Manager provides intelligent routing. Understanding how they work together is essential for multi-region architectures.

2. **Traffic Manager is DNS-only and protocol-agnostic.** It returns the best endpoint's address and is never in the data path. This makes it suitable for any protocol but limits it to DNS-level routing without caching, WAF, or session affinity.

3. **Private DNS zones are the foundation for Private Endpoint resolution.** The CNAME chain mechanism (`service.blob.core.windows.net` → `service.privatelink.blob.core.windows.net` → private IP) works transparently but requires the correct private DNS zones to be created and linked to VNets.

4. **Alias records solve the zone apex problem.** Standard CNAME records cannot exist at the zone apex. Alias records can point `contoso.com` directly to a public IP, Traffic Manager profile, or CDN endpoint, and they auto-update when the target resource's IP changes.

5. **DNS Private Resolver replaces forwarder VMs.** For hybrid DNS scenarios where on-premises and Azure need to resolve each other's names, Private Resolver eliminates the operational burden of managing DNS forwarder VMs while providing built-in high availability.

6. **Custom DNS servers must forward to 168.63.129.16.** Without this forwarding, Private DNS zones, Private Endpoints, and Azure platform DNS features break silently. This is one of the most common hybrid networking mistakes.

7. **Traffic Manager failover speed depends on three factors:** health probe interval, DNS TTL, and recursive resolver cache expiration. For critical workloads, use fast probes (10 seconds) with low TTL (30 seconds) for failover in under a minute.

8. **Use Traffic Manager for non-HTTP protocols, Front Door for HTTP/HTTPS.** If the workload is a web application needing WAF, caching, and instant failover, use Front Door. If the workload uses TCP, UDP, or any protocol beyond HTTP, Traffic Manager is the only option.
