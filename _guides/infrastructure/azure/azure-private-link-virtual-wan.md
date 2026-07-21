---
title: "Azure Private Link & Virtual WAN"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure Private Link and Virtual WAN provide private connectivity and managed network topology, covering Private Endpoints, Private Link Service, DNS integration, Service Endpoints, Virtual WAN hub architecture, routing intent, and when to choose each approach."
tags: [private-link, private-endpoints, virtual-wan, private-dns-zones, service-endpoints, routing-intent, practical]
---

## What Problems These Services Solve

By default, Azure PaaS services like Storage, SQL Database, and Key Vault are accessed over public endpoints. Even with firewalls and access controls, traffic traverses the public internet. [Azure Private Link](https://learn.microsoft.com/en-us/azure/private-link/private-link-overview){:target="_blank" rel="noopener noreferrer"} solves this by placing a network interface with a private IP address in your VNet, making the PaaS service accessible as if it were deployed inside your network.

As organizations grow their Azure footprint, managing VNet peering, route tables, and network virtual appliances across dozens or hundreds of VNets becomes operationally expensive. [Azure Virtual WAN](https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-about){:target="_blank" rel="noopener noreferrer"} solves this by providing a Microsoft-managed hub-and-spoke topology with built-in routing, VPN, ExpressRoute, and firewall integration.

---

## Azure Private Link

### Private Endpoints

A [Private Endpoint](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview){:target="_blank" rel="noopener noreferrer"} is a network interface deployed into your VNet subnet that receives a private IP address from your address space. This NIC connects to a specific Azure PaaS resource (or a Private Link Service) over a private connection. Once created, traffic to the service flows entirely over the Microsoft backbone network through the Private Endpoint rather than over the public internet.

**Supported services** include Azure Storage, Azure SQL Database, Cosmos DB, Key Vault, App Service, Azure Container Registry, Event Hubs, Service Bus, Azure Monitor, and many more. The list continues to grow as Microsoft adds Private Link support to additional services.

**How it works:**
1. Create a Private Endpoint in your VNet subnet targeting a specific PaaS resource
2. Azure provisions a NIC with a private IP in your subnet
3. DNS resolution for the service is updated (manually or via Private DNS Zone) to return the private IP instead of the public IP
4. Traffic from your VNet to the service uses the private IP and stays on the Microsoft backbone

Private Endpoints work across regions and across Entra ID tenants, enabling secure connectivity to services in other subscriptions or organizations.

### Private Link Service

[Private Link Service](https://learn.microsoft.com/en-us/azure/private-link/private-link-service-overview){:target="_blank" rel="noopener noreferrer"} lets you expose your own services behind a Standard Azure Load Balancer so that consumers in other VNets, subscriptions, or tenants can connect via Private Endpoints. This is the mechanism Azure PaaS services use internally, and it is available for custom services as well.

**Use cases:**
- SaaS providers exposing services privately to customers without requiring VNet peering
- Internal shared services teams providing platform capabilities to other business units
- Cross-tenant access patterns where VNet peering is not possible

**Visibility and approval controls:** Private Link Service supports auto-approval for trusted subscriptions and manual approval for others. You can restrict visibility to specific subscriptions or make the service discoverable by alias to any Azure customer.

### DNS Configuration

DNS is the most critical and most frequently misconfigured aspect of Private Endpoints. When a Private Endpoint is created, the PaaS service still has its public FQDN (for example, `mystorageaccount.blob.core.windows.net`). Clients must resolve this FQDN to the private IP, not the public IP.

**DNS resolution chain:**

The recommended approach uses [Azure Private DNS Zones](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns){:target="_blank" rel="noopener noreferrer"}. Each PaaS service type has a corresponding Private DNS zone name. For example:

| Service | Private DNS Zone |
|---------|-----------------|
| **Blob Storage** | `privatelink.blob.core.windows.net` |
| **SQL Database** | `privatelink.database.windows.net` |
| **Key Vault** | `privatelink.vaultcore.azure.net` |
| **Cosmos DB** | `privatelink.documents.azure.com` |
| **App Service** | `privatelink.azurewebsites.net` |

The resolution chain works as follows:
1. Client queries `mystorageaccount.blob.core.windows.net`
2. Public DNS returns a CNAME to `mystorageaccount.privatelink.blob.core.windows.net`
3. If the client is using Azure DNS and the Private DNS Zone is linked to the VNet, Azure DNS resolves the privatelink FQDN to the private IP
4. If the client is outside the VNet or uses custom DNS, resolution falls back to the public IP unless the custom DNS is configured to forward to Azure DNS (168.63.129.16)

**On-premises DNS integration:** For hybrid environments where on-premises clients need to reach Private Endpoints, configure on-premises DNS servers to forward queries for `privatelink.*` zones to an [Azure DNS Private Resolver](https://learn.microsoft.com/en-us/azure/dns/dns-private-resolver-overview){:target="_blank" rel="noopener noreferrer"} or a DNS forwarder VM in Azure.

### Network Security for Private Endpoints

By default, NSGs and UDRs do not apply to Private Endpoint traffic. This was a significant limitation because it meant you could not use NSGs to restrict which subnets or IPs could reach the Private Endpoint.

**Network policies** can now be enabled on Private Endpoints by setting the `PrivateEndpointNetworkPolicies` property on the subnet. Once enabled, NSGs and UDRs apply to Private Endpoint traffic, allowing you to restrict access at the network layer in addition to identity-based controls.

---

## Service Endpoints vs Private Endpoints

Both [Service Endpoints](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoints-overview){:target="_blank" rel="noopener noreferrer"} and Private Endpoints connect VNets to PaaS services privately, but they work differently and serve different use cases.

| Dimension | Service Endpoints | Private Endpoints |
|-----------|------------------|-------------------|
| **How it works** | Optimizes routing so traffic stays on Azure backbone; service still uses public IP | Injects a NIC with private IP into your subnet |
| **IP address** | Service retains its public IP; traffic routes optimally | Service gets a private IP in your VNet address space |
| **DNS** | No DNS changes needed; public FQDN still resolves to public IP | Requires Private DNS Zone configuration |
| **On-premises access** | Not reachable from on-premises (unless using ExpressRoute Microsoft Peering) | Reachable from on-premises via ExpressRoute/VPN through the private IP |
| **Cross-region** | Same region only | Cross-region supported |
| **Cross-tenant** | Not supported | Supported with approval workflow |
| **NSG/UDR** | Full NSG/UDR support with service tags | Requires enabling network policies on the subnet |
| **Cost** | Free | Per-endpoint hourly fee + data processing fee |
| **Data exfiltration protection** | Limited (can restrict to specific resource via service endpoint policies for Storage) | Full (endpoint maps to a single resource instance) |

The difference is where the traffic lands. A Service Endpoint sends the client to the service's public IP and only guarantees the packets ride the Azure backbone instead of the internet. A Private Endpoint puts a private IP inside your subnet that maps to one specific resource instance, so the client never targets a public address.

```
Service Endpoint — service keeps its public IP; only the route is optimized
   VNet subnet                                   PaaS service
   ┌─────────┐   backbone route (service tag)   ┌──────────────────┐
   │   VM ────┼─────────────────────────────────▶│ public endpoint  │
   └─────────┘   DNS still resolves public IP    │ (firewall admits │
                                                 │  the subnet)     │
                                                 └──────────────────┘

Private Endpoint — a NIC with a private IP lands in your subnet
   VNet subnet                                   PaaS resource
   ┌────────────────────────┐   backbone        ┌──────────────────┐
   │   VM ──▶ PE NIC 10.0.0.5│──────────────────▶│ one instance,    │
   └────────────────────────┘   DNS resolves    │  mapped 1:1      │
                                 to 10.0.0.5     └──────────────────┘
```

**When to use Service Endpoints:** For simple scenarios where traffic originates only from Azure VNets, cross-region and on-premises access are not needed, and cost is a concern. Service Endpoints are free and simpler to configure.

**When to use Private Endpoints:** For production workloads that need on-premises access, cross-region connectivity, data exfiltration protection (each endpoint maps to a specific resource, not just a service type), or cross-tenant access. Private Endpoints are the recommended approach for most enterprise scenarios.

---

## Azure Virtual WAN

### What Virtual WAN Is

[Azure Virtual WAN](https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-about){:target="_blank" rel="noopener noreferrer"} is a Microsoft-managed networking service that provides hub-and-spoke topology at scale. Instead of building and maintaining your own hub VNets with route tables, NVAs, and peering connections, Virtual WAN provides managed hubs that handle routing, connectivity, and security automatically.

A Virtual WAN resource contains one or more virtual hubs. Each hub is a Microsoft-managed VNet in a specific Azure region. Spoke VNets connect to the hub, and the hub handles all transit routing between spokes, branches (VPN/ExpressRoute), and the internet.

### Hub Types

| Capability | Basic | Standard |
|-----------|-------|----------|
| **Site-to-Site VPN** | Yes | Yes |
| **Point-to-Site VPN** | No | Yes |
| **ExpressRoute** | No | Yes |
| **VNet-to-VNet transit** | No | Yes |
| **VPN/ER transit connectivity** | No | Yes |
| **Azure Firewall** | No | Yes |
| **Hub mesh (auto inter-hub)** | No | Yes |
| **Third-party NVAs in hub** | No | Yes |

Basic hubs support only S2S VPN with no transit routing between VNets. Standard hubs provide the full feature set including any-to-any connectivity (branch-to-branch, VNet-to-VNet, branch-to-VNet) and integrated security.

Basic can be upgraded to Standard but not downgraded.

### Routing Infrastructure

Virtual WAN hubs contain a virtual hub router that manages all routing between connections. The router is sized in routing infrastructure units: it starts at 2 units (3 Gbps aggregate, 2,000 connected VMs) and scales in 1-Gbps/1,000-VM increments up to 50 units (50 Gbps). Regardless of capacity, a hub accepts at most 10,000 routes from its connected VNets, branches, and other hubs.

**Route tables** control which connections can communicate. By default, all connections associate with and propagate to the Default route table, enabling any-to-any connectivity. Custom route tables enable network segmentation (for example, isolating production VNets from development VNets while both can reach shared services).

**[Routing intent and policies](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies){:target="_blank" rel="noopener noreferrer"}** simplify security configuration by defining that all private traffic, internet traffic, or both should route through a security solution (Azure Firewall or supported NVA) in the hub. Routing intent replaces the need for manually creating multiple route tables and UDRs for firewall integration.

### Secured Virtual Hub

A [secured virtual hub](https://learn.microsoft.com/en-us/azure/firewall-manager/secured-virtual-hub){:target="_blank" rel="noopener noreferrer"} is a Virtual WAN hub with Azure Firewall or a supported third-party NVA deployed inside it, managed through Azure Firewall Manager. With routing intent configured, the hub automatically routes all inter-spoke, branch-to-VNet, and internet-bound traffic through the firewall without requiring UDRs on spoke VNets.

This eliminates one of the most operationally complex aspects of traditional hub-and-spoke networks: maintaining UDRs on every spoke subnet to force traffic through a central firewall.

```
Secured hub with routing intent — every path detours through the firewall
                    Region 1 virtual hub
  Spoke A ─────┐   ┌───────────────────────────┐
               └──▶│  hub router ─▶ Azure       │──▶ internet
  Spoke B ────────▶│              Firewall      │
  Branch ─────────▶│  (routing intent forces    │◀──┐ auto
  (VPN/ER)         │   private + internet        │   │ hub-to-hub
                   │   traffic through firewall) │   │ mesh
                   └────────────────────────────┘   ▼
                                            Region 2 hub (same model)

  A-to-B traffic:  Spoke A ─▶ hub firewall ─▶ Spoke B   (no UDRs on spokes)
```

### Any-to-Any Connectivity

Standard Virtual WAN provides transitive connectivity by default:

- **VNet-to-VNet:** Spoke VNets connected to the same hub or different hubs can communicate through the hub router without additional peering
- **Branch-to-VNet:** On-premises sites connected via VPN or ExpressRoute can reach any connected VNet
- **Branch-to-branch:** On-premises sites can communicate with each other through the hub (for example, two branch offices connected via S2S VPN)
- **Inter-hub:** Hubs in different regions are automatically meshed in Standard VWAN, enabling global transit without manual configuration

---

## Virtual WAN vs Traditional Hub-and-Spoke

| Dimension | Traditional Hub-and-Spoke | Virtual WAN |
|-----------|--------------------------|-------------|
| **Hub management** | Customer-managed VNet with NVAs, route tables, peering | Microsoft-managed hub with integrated services |
| **Routing** | Manual UDRs on every spoke subnet | Automatic route propagation; routing intent for security |
| **VNet peering** | Manual peering setup per spoke | Hub connections replace peering |
| **Firewall integration** | Deploy NVA/Firewall, configure UDRs | Secured hub with routing intent (automatic UDRs) |
| **Inter-region transit** | Manual VNet peering between hubs + route configuration | Automatic hub mesh |
| **VPN/ExpressRoute** | Deploy gateways in hub VNet | Integrated gateways in hub, managed scaling |
| **Scale** | Limited by customer's ability to manage complexity | Designed for large-scale deployments (hundreds of branches, dozens of VNets) |
| **Customization** | Full control over every routing decision | Less granular control; must work within VWAN routing model |
| **Cost** | Pay for individual components (VNet peering, NVAs, gateways) | Hub hourly fee + connection fees + data processing |

**When to use Virtual WAN:**
- Large-scale branch connectivity (dozens to hundreds of sites)
- Multi-region deployments needing automatic hub mesh
- Organizations that want Microsoft-managed routing instead of maintaining UDRs
- Deployments where integrated VPN + ExpressRoute + Firewall management reduces operational overhead

**When to use traditional hub-and-spoke:**
- Small deployments with a few VNets and simple routing
- Scenarios requiring full routing control that VWAN's model does not support
- Cost-sensitive environments where the hub hourly fee is not justified
- Teams with strong networking expertise who prefer direct control

---

## Architectural Patterns

### Pattern 1: Private Endpoints for PaaS Security

Replace public PaaS access with Private Endpoints across all environments. Disable public access on PaaS resources after Private Endpoints are configured. Centralize Private DNS Zones in a shared-services subscription and link them to all VNets that need resolution.

This is the most common Private Link pattern and should be the default for any PaaS service that supports Private Endpoints in production environments.

### Pattern 2: Private Link Service for Internal Platform

An internal platform team exposes shared services (APIs, databases, monitoring) behind a Standard Load Balancer with Private Link Service. Consumer teams in other subscriptions create Private Endpoints to connect, with auto-approval configured for known subscriptions.

This provides service isolation without VNet peering sprawl and enables the platform team to control access at the service level.

### Pattern 3: Virtual WAN with Secured Hubs

Deploy Standard Virtual WAN with hubs in each region where workloads exist. Enable routing intent with Azure Firewall in each hub for centralized traffic inspection. Connect on-premises sites via S2S VPN or ExpressRoute to the nearest hub. Spoke VNets connect to their regional hub.

All traffic (inter-spoke, branch-to-VNet, internet-bound) routes through the firewall automatically. Inter-hub traffic flows over Microsoft's backbone without additional configuration.

### Pattern 4: Hybrid with Private Endpoints and Virtual WAN

Combine Virtual WAN for network topology management with Private Endpoints for PaaS security. Spoke VNets access PaaS services through Private Endpoints, while branch offices reach those same services through the Virtual WAN hub routing. Private DNS Zones linked to spoke VNets ensure resolution works from both Azure and on-premises (via DNS forwarding through the hub).

---

## Comparison with AWS

| Dimension | Azure Private Link / Virtual WAN | AWS PrivateLink / Transit Gateway |
|-----------|----------------------------------|-----------------------------------|
| **Private PaaS access** | Private Endpoints (NIC in VNet) | Interface VPC Endpoints (ENI in VPC) |
| **Custom service exposure** | Private Link Service (behind Standard LB) | VPC Endpoint Service (behind NLB or GWLB) |
| **DNS integration** | Private DNS Zones with CNAME chain | Route 53 Private Hosted Zones with alias records |
| **Cross-account/tenant** | Cross-tenant with approval workflow | Cross-account with acceptance |
| **Managed hub-and-spoke** | Virtual WAN (Microsoft-managed hubs) | Transit Gateway (AWS-managed) |
| **Hub routing** | Automatic route propagation + routing intent | Route tables with association/propagation |
| **Integrated firewall** | Secured hub (Azure Firewall in VWAN) | Firewall in inspection VPC via appliance mode |
| **Hub mesh** | Automatic inter-hub mesh (Standard VWAN) | Transit Gateway peering (manual per-region) |
| **Branch connectivity** | Integrated VPN/ER gateways in hub | VPN attachments to Transit Gateway |
| **Service Endpoints equivalent** | Service Endpoints (route optimization) | Gateway VPC Endpoints (S3, DynamoDB only) |

Azure Virtual WAN and AWS Transit Gateway serve the same purpose as managed transit hubs but differ in approach. Virtual WAN provides more integrated management with VPN, ExpressRoute, and Firewall all within the hub, while Transit Gateway offers more granular routing control. Azure Private Link and AWS PrivateLink are architecturally similar, both using NIC injection with DNS-based resolution.

---

## Common Pitfalls

### Pitfall 1: Forgetting DNS Configuration for Private Endpoints

**Problem:** Creating a Private Endpoint without configuring a Private DNS Zone or custom DNS resolution.

**Result:** Clients continue resolving the PaaS service's public IP because no DNS override exists. Traffic still flows over the public internet despite the Private Endpoint existing in the VNet. The Private Endpoint is deployed but functionally useless.

**Solution:** Always create the corresponding Private DNS Zone, link it to relevant VNets, and configure on-premises DNS forwarding if hybrid access is needed. Automate this as part of Private Endpoint provisioning.

---

### Pitfall 2: Private DNS Zone Sprawl

**Problem:** Each team creates their own Private DNS Zones for the same service type (for example, multiple `privatelink.blob.core.windows.net` zones across subscriptions).

**Result:** Conflicting DNS records, inconsistent resolution, and difficulty managing updates across zones. Some VNets resolve to the wrong Private Endpoint or fail to resolve altogether.

**Solution:** Centralize Private DNS Zones in a shared-services or connectivity subscription. Link these zones to all VNets that need resolution. Use Azure Policy to prevent creation of Private DNS Zones outside the centralized location.

---

### Pitfall 3: Not Disabling Public Access After Private Endpoint Creation

**Problem:** Creating Private Endpoints but leaving public access enabled on PaaS resources.

**Result:** The service is accessible both privately and publicly. Data exfiltration via the public endpoint remains possible, undermining the security benefit of Private Link.

**Solution:** After validating that Private Endpoint connectivity works, disable public network access on the PaaS resource. Use Azure Policy to enforce that resources with Private Endpoints must have public access disabled.

---

### Pitfall 4: Using Virtual WAN Basic Hub for Transit

**Problem:** Deploying Basic Virtual WAN because it is cheaper, expecting VNet-to-VNet or branch-to-VNet transit routing.

**Result:** Basic hubs support only S2S VPN with no transit routing. Spoke VNets cannot communicate with each other through the hub. Branch offices cannot reach VNet resources.

**Solution:** Use Standard Virtual WAN for any scenario requiring transit routing, which includes most production deployments. Basic is suitable only for simple S2S VPN connectivity where spoke-to-spoke communication is not needed.

---

### Pitfall 5: Service Endpoints When On-Premises Access Is Needed

**Problem:** Using Service Endpoints instead of Private Endpoints for PaaS connectivity in hybrid environments.

**Result:** On-premises clients cannot reach the PaaS service through the Service Endpoint because Service Endpoints only work from within the Azure VNet. On-premises traffic still hits the public endpoint.

**Solution:** Use Private Endpoints for any PaaS service that needs to be reachable from on-premises networks via ExpressRoute or VPN. The private IP is routable from on-premises through the hybrid connection.

---

## Key Takeaways

1. **Private Endpoints are the recommended approach for PaaS security in production.** They provide private IP access, work from on-premises, support cross-region and cross-tenant scenarios, and map to a single resource instance for data exfiltration protection.

2. **DNS is the hardest part of Private Link.** The Private Endpoint is useless if DNS resolution still returns the public IP. Centralize Private DNS Zones, automate zone creation as part of endpoint provisioning, and configure DNS forwarding for hybrid access.

3. **Service Endpoints are simpler and free but limited.** Use them for dev/test or simple scenarios where all traffic originates from Azure VNets. Use Private Endpoints for production workloads, especially in hybrid environments.

4. **Virtual WAN eliminates manual hub-and-spoke management.** Automatic route propagation, hub mesh, and routing intent replace the operational burden of maintaining UDRs, VNet peering, and firewall integration across large deployments.

5. **Routing intent is the key Virtual WAN feature for security.** It automatically routes all traffic through a security solution in the hub without requiring UDRs on spoke subnets. This eliminates the most error-prone aspect of hub-and-spoke firewall integration.

6. **Virtual WAN Standard is required for most production scenarios.** Basic hubs lack transit routing, ExpressRoute, P2S VPN, and firewall integration. The cost difference is justified by the operational simplification.

7. **Private Link Service enables platform-as-a-service patterns within your organization.** Expose internal shared services to other teams via Private Endpoints without VNet peering, providing clean service boundaries and controlled access.

8. **Always disable public access after enabling Private Endpoints.** A Private Endpoint alongside an open public endpoint provides a false sense of security. Use Azure Policy to enforce this as a governance control.
