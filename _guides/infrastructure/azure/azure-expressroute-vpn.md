---
title: "Azure ExpressRoute & VPN Gateway"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure ExpressRoute and VPN Gateway provide hybrid connectivity, covering VPN types, ExpressRoute circuits and peering, gateway SKUs, high availability patterns, and common pitfalls in hybrid network design."
tags: [infrastructure, azure, networking, security, reliability, practical]
---

## What Problems Hybrid Connectivity Solves

Most enterprises don't move everything to the cloud at once. They need secure, reliable connectivity between on-premises data centers and Azure VNets for migration, hybrid workloads, disaster recovery, and compliance requirements that mandate certain data stays on-premises. Azure provides two primary connectivity options:

- **[VPN Gateway](https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-about-vpngateways){:target="_blank" rel="noopener noreferrer"}:** Encrypted IPsec/IKE tunnels over the public internet. Lower cost, faster setup, suitable for moderate bandwidth needs.
- **[ExpressRoute](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-introduction){:target="_blank" rel="noopener noreferrer"}:** Private, dedicated connections through a connectivity provider. Higher bandwidth, predictable latency, no internet traversal.

Both services deploy into a dedicated `GatewaySubnet` within your VNet and can coexist in the same VNet for failover scenarios.

---

## Azure VPN Gateway

### How VPN Gateway Works

VPN Gateway is a specific type of virtual network gateway that establishes encrypted tunnels between Azure and on-premises networks. Azure deploys two gateway VM instances into the `GatewaySubnet` (active-standby by default, or active-active when configured) that handle tunnel establishment and traffic encryption.

**VPN types:**
- **Route-based (recommended):** Supports IKEv2, all Point-to-Site protocols, active-active, BGP, and ExpressRoute coexistence. Required for most production scenarios.
- **Policy-based (legacy):** Basic SKU only, IKEv1 only. Cannot coexist with ExpressRoute. Avoid for new deployments.

### GatewaySubnet Requirements

The GatewaySubnet has strict requirements that differ from regular subnets:

- Must be named exactly `GatewaySubnet`
- Minimum size `/29` for Basic SKU; `/27` or larger recommended for all other SKUs
- NSGs on the GatewaySubnet are not supported
- UDRs with a `0.0.0.0/0` destination are not supported (breaks management controller access)
- BGP route propagation must remain enabled
- No other resources (VMs, NICs) should be deployed into this subnet

<div class="callout callout--tip">
<p class="callout__title">Always Use /27 or Larger</p>
<p>Even if your current deployment only needs a few IPs, use /27 or larger for the GatewaySubnet. Adding ExpressRoute coexistence or upgrading gateway SKUs later requires more addresses, and you cannot resize a GatewaySubnet without deleting the gateway first.</p>
</div>

### Gateway SKUs

VPN Gateway SKUs determine throughput, tunnel count, and feature availability.

**Generation 1:**

| SKU | S2S Tunnels | P2S Connections | Throughput | BGP | Zone-Redundant |
|-----|-------------|-----------------|------------|-----|----------------|
| **Basic** | 10 | 128 (SSTP only) | 100 Mbps | No | No |
| **VpnGw1/1AZ** | 30 | 250 | 650 Mbps | Yes | AZ only |
| **VpnGw2/2AZ** | 30 | 500 | 1 Gbps | Yes | AZ only |
| **VpnGw3/3AZ** | 30 | 1,000 | 1.25 Gbps | Yes | AZ only |

**Generation 2 (higher throughput at same tier):**

| SKU | S2S Tunnels | P2S Connections | Throughput | BGP | Zone-Redundant |
|-----|-------------|-----------------|------------|-----|----------------|
| **VpnGw2/2AZ** | 30 | 500 | 1.25 Gbps | Yes | AZ only |
| **VpnGw3/3AZ** | 30 | 1,000 | 2.5 Gbps | Yes | AZ only |
| **VpnGw4/4AZ** | 100 | 5,000 | 5 Gbps | Yes | AZ only |
| **VpnGw5/5AZ** | 100 | 10,000 | 10 Gbps | Yes | AZ only |

Basic SKU lacks BGP, IKEv2, RADIUS authentication, active-active mode, and ExpressRoute coexistence. It is suitable only for dev/test. For production, start with VpnGw1AZ or higher.

AZ SKUs deploy gateway instances across Availability Zones for zone-level resilience. If one zone fails, the gateway continues operating from the other zone(s).

### Site-to-Site (S2S) VPN

S2S connections create IPsec/IKE tunnels between the Azure VPN gateway and an on-premises VPN device. Configuration requires three Azure resources:

- **Virtual network gateway:** The VPN gateway deployed in the GatewaySubnet
- **Local network gateway:** Represents the on-premises VPN device (its public IP or FQDN and the on-premises address prefixes)
- **Connection:** Links the virtual network gateway to the local network gateway with a shared key

**Active-standby (default):** One instance handles all traffic. Failover takes 10-15 seconds for planned maintenance, 1-3 minutes for unplanned events. Acceptable for most workloads.

**Active-active:** Both instances establish tunnels simultaneously, each with its own public IP. Traffic distributes across both tunnels. For full redundancy with two on-premises devices, this creates a mesh of four IPsec tunnels and requires BGP.

**BGP support:** All SKUs except Basic support BGP for dynamic route exchange, eliminating manual static route configuration. BGP is required for active-active with dual on-premises devices and for transit routing scenarios.

### Point-to-Site (P2S) VPN

P2S connections allow individual client devices to connect to the Azure VNet from any location.

**Protocols:**

| Protocol | Port | OS Support | Notes |
|----------|------|------------|-------|
| **OpenVPN** | TCP 443 | Windows, macOS, Linux, iOS, Android | Firewall-friendly, most flexible |
| **SSTP** | TCP 443 | Windows only | Microsoft proprietary |
| **IKEv2** | UDP 500/4500 | macOS, Windows | Standards-based IPsec |

**Authentication methods:**

| Method | Supported Protocols | Notes |
|--------|---------------------|-------|
| **Azure certificates** | All | Root CA uploaded to gateway; client certs on each device |
| **RADIUS** | All | Integrates with Active Directory; gateway passes through to RADIUS server |
| **Entra ID** | OpenVPN only | Supports Conditional Access and MFA; requires Azure VPN Client app |

Entra ID authentication is the most enterprise-friendly option, providing centralized identity management with Conditional Access policies, but it requires the OpenVPN protocol.

### VNet-to-VNet Connections

VNet-to-VNet connections use IPsec/IKE tunnels between two Azure VPN gateways. Traffic stays within the Azure backbone (never traverses the public internet). This is useful for cross-region connectivity, but for same-region or high-bandwidth scenarios, [VNet peering](/study-guides/infrastructure/azure/azure-vnet-architecture.html) is simpler and higher performing.

---

## Azure ExpressRoute

### How ExpressRoute Works

[ExpressRoute](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-introduction){:target="_blank" rel="noopener noreferrer"} provides private, dedicated connectivity between on-premises infrastructure and Azure through a connectivity provider. Traffic never touches the public internet.

Each ExpressRoute circuit consists of dual connections to two Microsoft Enterprise Edge (MSEE) routers at a peering location, providing built-in redundancy. ExpressRoute uses BGP for dynamic route exchange between on-premises and Azure.

**Connectivity models:**
- **CloudExchange co-location:** Virtual cross-connection through an Ethernet exchange at a co-location facility
- **Point-to-point Ethernet:** Direct Ethernet link between on-premises and Azure
- **Any-to-any (IPVPN):** WAN integration through a provider's MPLS network
- **ExpressRoute Direct:** Dedicated 10 Gbps or 100 Gbps port pairs directly into Microsoft's global network

### Circuit Bandwidths and SKUs

Standard circuit bandwidths range from 50 Mbps to 10 Gbps. ExpressRoute Direct provides 10 Gbps or 100 Gbps port pairs.

Bandwidth is duplex, so a 1 Gbps circuit provides 1 Gbps in each direction. Circuits can burst up to 2x bandwidth by spreading traffic across redundant links, though this is not guaranteed for sustained use. Bandwidth can be upgraded without downtime if the underlying port has capacity, but downgrades require deleting and recreating the circuit.

**Circuit SKU types:**

| SKU | Regional Access | Route Limit (Private Peering) | VNet Connections (1 Gbps) |
|-----|----------------|-------------------------------|---------------------------|
| **Local** | 1-2 nearby Azure regions only | 4,000 | 10 |
| **Standard** | All regions in same geopolitical area | 4,000 | 10 |
| **Premium** | All Azure regions globally | 10,000 | 50 |

Local SKU is the most cost-effective option when workloads are concentrated in regions near the peering location, because egress data transfer is included in the circuit fee.

### Peering Types

**Azure Private Peering** connects to resources deployed in VNets like VMs, internal load balancers, and PaaS services with VNet integration. It uses private IP addresses and is considered a trusted extension of the on-premises network into Azure. This is the peering type used by most hybrid workloads.

**Microsoft Peering** connects to Microsoft 365 services and Azure PaaS services via their public endpoints. It uses public IP addresses registered in routing registries.

Azure Public Peering has been retired. New circuits only support Private and Microsoft peering.

### ExpressRoute Gateway SKUs

An ExpressRoute gateway in the GatewaySubnet is required to connect a circuit to a VNet. The gateway SKU determines throughput and features.

| Gateway SKU | Throughput | Packets/Sec | Max Circuits | FastPath |
|-------------|-----------|-------------|--------------|----------|
| **Standard / ErGw1Az** | 1 Gbps | 100K | 4 | No |
| **High Perf / ErGw2Az** | 2 Gbps | 200K | 8 | No |
| **Ultra Perf / ErGw3Az** | 10 Gbps | 1M | 16 | Yes |
| **ErGwScale** | 1-40 Gbps | 100K-200K/unit | 4-16 | Yes (10+ units) |

ErGwScale is the newest option, supporting autoscaling based on bandwidth or flow count. It scales from 1 to 40 units (1 Gbps per unit). Direct upgrades from ErGw1Az/ErGw2Az/ErGw3Az are supported without downtime.

A common mistake is pairing a high-bandwidth ExpressRoute circuit with a low-tier gateway. A 10 Gbps circuit connected through a Standard gateway (1 Gbps) creates a bottleneck at the gateway.

### ExpressRoute Global Reach

[Global Reach](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-global-reach){:target="_blank" rel="noopener noreferrer"} connects on-premises networks to each other through ExpressRoute circuits via Microsoft's backbone. For example, a data center in California connected via an ExpressRoute circuit in Silicon Valley can communicate with a data center in Texas connected via ExpressRoute in Dallas, with traffic traversing Microsoft's network instead of the public internet.

Throughput is capped by the smaller of the two circuits. Connecting circuits across geopolitical regions requires Premium SKU on both circuits. Global Reach is available in select countries and regions.

### ExpressRoute Direct

ExpressRoute Direct provides dedicated 10 Gbps or 100 Gbps port pairs directly into Microsoft's global network at strategic peering locations. Use cases include massive data ingestion, physical isolation for regulated industries, and organizations that need multiple ExpressRoute circuits from the same location (circuits are provisioned on the dedicated ports).

Direct also enables [MACsec encryption](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-howto-macsec){:target="_blank" rel="noopener noreferrer"} at the physical layer between your edge routers and Microsoft's edge routers, providing link-level encryption that standard ExpressRoute circuits do not offer.

### ExpressRoute FastPath

FastPath bypasses the ExpressRoute gateway for data-plane traffic, sending packets directly between on-premises networks and VMs in the VNet. This reduces latency and improves throughput by removing the gateway from the data path.

FastPath requires UltraPerformance/ErGw3Az or ErGwScale (minimum 10 units). The gateway is still required for control-plane operations like route exchange. FastPath has IP address limits that vary by circuit type (25,000 for provider circuits, up to 200,000 for 100 Gbps Direct). When the limit is reached, new routes fall back to the gateway.

---

## VPN Gateway vs ExpressRoute

| Dimension | VPN Gateway | ExpressRoute |
|-----------|-------------|--------------|
| **Connection** | Encrypted tunnels over public internet | Private dedicated connection via provider |
| **Max bandwidth** | 10 Gbps (VpnGw5) | 10 Gbps standard; 100 Gbps Direct |
| **Latency** | Variable (internet-dependent) | Predictable, low latency |
| **Encryption** | Built-in IPsec/IKE | No built-in encryption (private link); MACsec available on Direct |
| **SLA** | 99.95% (active-active) | 99.95% (single circuit); 99.99% (geo-redundant) |
| **Setup time** | Minutes to hours | Weeks to months (provider provisioning) |
| **Cost** | Lower (gateway hourly + egress) | Higher (circuit fee + gateway + egress) |
| **BGP** | Optional (except Basic) | Required |
| **Microsoft 365** | Not supported | Yes (Microsoft Peering) |
| **Best for** | Dev/test, low-traffic hybrid, ER backup | Production workloads, data-heavy migration, latency-sensitive apps |

The two services are not mutually exclusive. The most common enterprise pattern uses ExpressRoute as the primary path with VPN Gateway as a failover, both deployed in the same GatewaySubnet.

---

## Hybrid Connectivity Patterns

### Pattern 1: ExpressRoute with S2S VPN Failover

The most common production pattern. ExpressRoute handles primary traffic while a S2S VPN connection provides disaster recovery. Both gateways coexist in the same GatewaySubnet. Azure natively prefers ExpressRoute over VPN when the same route is advertised through both.

Requirements:
- Route-based VPN gateway (policy-based does not support coexistence)
- GatewaySubnet of /27 or larger
- Active-active VPN gateway recommended for better failover throughput
- VPN failover applies to Private Peering only; Microsoft Peering has no VPN failover path

### Pattern 2: Geo-Redundant ExpressRoute

Two ExpressRoute circuits in different peering locations connected to the same VNet for maximum resiliency. Provides the 99.99% SLA. Recommended for mission-critical production workloads where even a single peering location failure is unacceptable.

### Pattern 3: Global Reach for Multi-Site Connectivity

Multiple on-premises sites each connected via their own ExpressRoute circuits, with Global Reach enabling site-to-site traffic through Microsoft's backbone. This avoids hairpinning traffic through a central hub and provides better latency than routing through an on-premises core network.

### Pattern 4: VPN-Only for Dev/Test or Small Offices

A VpnGw1 or VpnGw1AZ with S2S VPN provides cost-effective hybrid connectivity for environments where bandwidth predictability and low latency are not critical. Sufficient for development environments, small branch offices, or as a stepping stone before provisioning ExpressRoute.

---

## Comparison with AWS

| Dimension | Azure VPN Gateway / ExpressRoute | AWS VPN / Direct Connect |
|-----------|----------------------------------|--------------------------|
| **VPN service** | VPN Gateway (S2S + P2S in one) | Site-to-Site VPN + Client VPN (separate) |
| **Private connectivity** | ExpressRoute | Direct Connect |
| **Max VPN throughput** | 10 Gbps (VpnGw5) | 1.25 Gbps per tunnel (multi-tunnel ECMP to ~50 Gbps via Transit Gateway) |
| **Max private bandwidth** | 100 Gbps (Direct) | 100 Gbps (Dedicated) |
| **Private connectivity setup** | Connectivity provider + circuit | AWS partner + connection |
| **Global private backbone** | Global Reach | Direct Connect Gateway + Transit Gateway |
| **Gateway scaling** | SKU-based or ErGwScale autoscaling | Transit Gateway scales automatically |
| **VPN + private coexistence** | Same GatewaySubnet, native failover | Separate constructs, same Transit Gateway |
| **P2S/Client VPN auth** | Certificates, RADIUS, Entra ID | Certificates, Active Directory, SAML |
| **Physical layer encryption** | MACsec on Direct | MACsec on Dedicated |

Azure's model groups VPN capabilities into a single gateway resource, while AWS separates Site-to-Site VPN and Client VPN into distinct services. Both platforms support using VPN as a backup for their private connectivity service.

---

## Common Pitfalls

### Pitfall 1: Undersized GatewaySubnet

**Problem:** Using /28 or smaller for the GatewaySubnet because "only a few IPs are needed right now."

**Result:** Adding ExpressRoute coexistence or upgrading gateway SKUs later fails because there are not enough addresses. Resizing requires deleting the gateway, which means downtime.

**Solution:** Always use /27 or larger, even for initial deployments. The extra address space costs nothing and prevents painful future migration.

---

### Pitfall 2: Gateway Bottleneck on ExpressRoute

**Problem:** Provisioning a 10 Gbps ExpressRoute circuit but connecting it through a Standard/ErGw1Az gateway (1 Gbps throughput).

**Result:** The circuit has ample bandwidth but the gateway restricts actual throughput to 1 Gbps, creating an expensive bottleneck.

**Solution:** Match the gateway SKU to the circuit bandwidth. Use ErGwScale with autoscaling for workloads with variable bandwidth demands.

---

### Pitfall 3: Untested VPN Failover

**Problem:** Deploying VPN as a backup for ExpressRoute but never testing the failover path.

**Result:** When ExpressRoute actually fails, the VPN backup does not work because of stale configurations, expired shared keys, or on-premises routing issues that were never validated.

**Solution:** Test failover quarterly by temporarily disabling ExpressRoute BGP sessions and verifying traffic switches to VPN. Validate that on-premises routing preferences are configured correctly (higher local preference for ExpressRoute routes vs VPN routes).

---

### Pitfall 4: NSGs or UDRs on the GatewaySubnet

**Problem:** Applying NSGs or a default route (0.0.0.0/0) UDR to the GatewaySubnet, often by applying them to "all subnets" in automation scripts.

**Result:** The gateway loses connectivity to its management controller and stops functioning. Tunnels go down with no clear error message.

**Solution:** Exclude the GatewaySubnet from NSG assignments and from UDRs that override the default route. Audit infrastructure-as-code templates to ensure the GatewaySubnet is handled as a special case.

---

### Pitfall 5: Using Basic SKU in Production

**Problem:** Deploying the Basic VPN Gateway SKU for production workloads because it is the cheapest option.

**Result:** No BGP support means manual static route management. No active-active means longer failover. No IKEv2 means weaker security. No ExpressRoute coexistence blocks future hybrid expansion.

**Solution:** Use VpnGw1AZ or higher for any production workload. The cost difference is modest compared to the operational risk of Basic SKU limitations.

---

## Key Takeaways

1. **VPN Gateway and ExpressRoute serve complementary roles.** VPN provides cost-effective encrypted connectivity over the internet. ExpressRoute provides private, high-bandwidth, low-latency connectivity through a provider. Most enterprise architectures use both together.

2. **The GatewaySubnet has unique constraints.** No NSGs, no default-route UDRs, /27 or larger, no other resources. Treat it as a special-purpose subnet in all automation and governance.

3. **Active-active VPN with BGP is the production standard.** Active-standby has 1-3 minute failover for unplanned events. Active-active with BGP provides near-instant convergence and better throughput distribution.

4. **Match ExpressRoute gateway SKU to circuit bandwidth.** A mismatched gateway creates an expensive bottleneck. ErGwScale with autoscaling adapts to variable workloads without manual SKU changes.

5. **ExpressRoute does not encrypt traffic by default.** The connection is private but not encrypted. For encryption requirements, layer MACsec on ExpressRoute Direct or use IPsec over ExpressRoute (VPN tunnel through the private connection).

6. **ExpressRoute setup takes weeks, not minutes.** Circuit provisioning through a connectivity provider involves physical infrastructure changes. Plan for 2-8 weeks lead time and use VPN as interim connectivity during provisioning.

7. **VPN failover for ExpressRoute requires active maintenance.** Deploy it, test it quarterly, and monitor the VPN tunnel health continuously. An untested backup is not a backup.

8. **AZ SKUs are worth the modest premium.** Zone-redundant gateways survive availability zone failures without manual intervention. For any production gateway, use AZ-suffixed SKUs.
