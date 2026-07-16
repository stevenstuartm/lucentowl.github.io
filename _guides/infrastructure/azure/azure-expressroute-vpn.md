---
title: "Azure ExpressRoute & VPN Gateway"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "How Azure ExpressRoute and VPN Gateway provide hybrid connectivity, covering VPN types, ExpressRoute circuits and peering, gateway SKUs, high availability patterns, and common pitfalls in hybrid network design."
tags: [expressroute, vpn-gateway, hybrid-connectivity, global-reach, fastpath, bgp, practical]
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
- **Route-based (recommended):** Supports all Point-to-Site protocols, active-active, BGP, custom IPsec/IKE policy, and ExpressRoute coexistence. Required for most production scenarios. On VpnGw SKUs it accepts both IKEv1 and IKEv2; on Basic it accepts IKEv2 only.
- **Policy-based (legacy):** Basic SKU only, IKEv1 only, and capped at a single site-to-site tunnel. No Point-to-Site, no ExpressRoute coexistence. Since October 2023 it can only be created through PowerShell or the CLI, and a policy-based gateway cannot be converted to route-based. You have to delete it and rebuild. Avoid for new deployments.

The route-based gateway can still terminate tunnels from on-premises policy-based firewalls by configuring policy-based traffic selectors on the connection, which is the escape hatch when the device on the other end only speaks IKEv1 with static selectors.

### GatewaySubnet Requirements

The GatewaySubnet is VNet-scoped, meaning one per virtual network, shared by the VPN gateway and the ExpressRoute gateway when both are deployed. It has strict requirements that differ from regular subnets:

- Must be named exactly `GatewaySubnet`
- `/27` or larger is **required** for every SKU except Basic, which allows `/29`. This is enforced at creation, not advice
- `/26` or larger if you plan to connect 16 ExpressRoute circuits to the gateway
- NSGs on the GatewaySubnet are not supported
- UDRs with a `0.0.0.0/0` destination are not supported (breaks management controller access), as are UDRs covering the GatewaySubnet range whose next hop is None or a traffic-dropping NVA. Gateways configured this way are blocked from being created
- BGP route propagation must remain enabled, or the gateway won't function
- No other resources (VMs, NICs) should be deployed into this subnet

<div class="callout callout--tip">
<p class="callout__title">Size Past the Minimum</p>
<p>/27 is the floor for non-Basic SKUs, not a target. You cannot resize a GatewaySubnet while a gateway occupies it, so growing later means deleting the gateway and taking the downtime. Address space inside a VNet costs nothing, so start at /27 and go wider if 16 ExpressRoute circuits or a dual-stack deployment are plausible.</p>
</div>

### Gateway SKUs

VPN Gateway SKUs determine throughput, tunnel count, and feature availability. Microsoft is consolidating the portfolio down to the availability-zone SKUs, so the AZ-suffixed names are the only ones that apply to new work.

**Generation 1:**

| SKU | S2S Tunnels | P2S SSTP | P2S IKEv2/OpenVPN | Throughput | BGP | Zone-Redundant |
|-----|-------------|----------|-------------------|------------|-----|----------------|
| **Basic** | 10 | 128 | Not supported | 100 Mbps | No | No |
| **VpnGw1AZ** | 30 | 128 | 250 | 650 Mbps | Yes | Yes |
| **VpnGw2AZ** | 30 | 128 | 500 | 1 Gbps | Yes | Yes |
| **VpnGw3AZ** | 30 | 128 | 1,000 | 1.25 Gbps | Yes | Yes |

**Generation 2 (higher throughput at same tier):**

| SKU | S2S Tunnels | P2S SSTP | P2S IKEv2/OpenVPN | Throughput | BGP | Zone-Redundant |
|-----|-------------|----------|-------------------|------------|-----|----------------|
| **VpnGw2AZ** | 30 | 128 | 500 | 1.25 Gbps | Yes | Yes |
| **VpnGw3AZ** | 30 | 128 | 1,000 | 2.5 Gbps | Yes | Yes |
| **VpnGw4AZ** | 100 | 128 | 5,000 | 5 Gbps | Yes | Yes |
| **VpnGw5AZ** | 100 | 128 | 10,000 | 10 Gbps | Yes | Yes |

The two P2S columns are separate ceilings, not alternatives: a VpnGw1AZ carries 128 SSTP connections **and** 250 IKEv2/OpenVPN connections concurrently. The SSTP cap is 128 on every SKU including VpnGw5AZ, so scaling a Windows-only SSTP deployment by moving up the SKU ladder does nothing. If you need thousands of remote users, the protocol choice matters more than the SKU. Above 100 site-to-site tunnels, Microsoft's answer is Virtual WAN rather than a larger VPN gateway.

Throughput figures are aggregate benchmarks shared across every tunnel on the gateway, measured with GCMAES256. Weaker ciphers cost throughput heavily. The same VpnGw3AZ that benchmarks at 1.25 Gbps drops to roughly 140 Mbps on 3DES/SHA256, and heavy P2S use eats into the S2S budget on top of that.

Basic lacks BGP, active-active mode, RADIUS authentication, IPv6, and ExpressRoute coexistence. Its route-based form is limited to 10 tunnels and its policy-based form to one, and it can only be created through PowerShell or the CLI. Microsoft's own guidance is that it shouldn't be used for production. One nuance the feature list obscures: Basic does support IKEv2 for site-to-site. What it lacks is IKEv2 and OpenVPN for *Point-to-Site*, which is why its remote access story is SSTP-only and therefore Windows-only. For production, start at VpnGw1AZ.

Every new VPN gateway requires a Standard SKU public IP address, Basic SKU gateways included. Basic public IPs were retired on 30 September 2025.

<div class="callout callout--warning">
<p class="callout__title">Non-AZ VpnGw1-5 Retire 30 September 2026</p>
<p>Microsoft is transitioning every non-availability-zone SKU to its AZ counterpart. Since 1 November 2025 you can no longer create VpnGw1-5 gateways without AZ support, and existing ones already reject configuration changes. Any management operation returns an error until you migrate. Upgrading within the same SKU family (VpnGw2 to VpnGw2AZ) is seamless and expected to be downtime-free if the gateway already uses a Standard public IP. Changing families at the same time is a resize, and carries resize downtime. Generation 1 has no announced retirement, and gateways move to Generation 2 automatically as part of service updates, so there is no separate Gen2 migration to run.</p>
</div>

AZ SKUs deploy gateway instances across Availability Zones for zone-level resilience: if one zone fails, the gateway keeps operating from the others. In regions without availability zones the AZ SKUs still deploy. They simply stay regional until the region gains zones, at which point Azure enables zone redundancy for them. So there is no region where picking the AZ SKU is the wrong call.

### Site-to-Site (S2S) VPN

S2S connections create IPsec/IKE tunnels between the Azure VPN gateway and an on-premises VPN device. Configuration requires three Azure resources:

- **Virtual network gateway:** The VPN gateway deployed in the GatewaySubnet
- **Local network gateway:** Represents the on-premises VPN device (its public IP or FQDN and the on-premises address prefixes)
- **Connection:** Links the virtual network gateway to the local network gateway with a shared key

**Active-standby (default):** One instance handles all traffic. Failover takes 10-15 seconds for planned maintenance, 1-3 minutes for unplanned events in the worst case. Acceptable for most workloads, but P2S clients are disconnected outright and users must reconnect manually. A gateway that fails over cleanly for S2S still interrupts every remote worker.

**Active-active:** Both instances establish tunnels simultaneously, each with its own public IP, and both tunnels belong to the same connection. Traffic spreads across both, though a single TCP or UDP flow sticks to one tunnel from the Azure side. Your on-premises device has to be configured to accept both tunnels, because Azure creating them doesn't make the far end use them.

Pairing active-active on the Azure side with two on-premises VPN devices produces the full-mesh, four-tunnel topology Microsoft calls dual-redundancy:

```
            Azure VNet, GatewaySubnet
   ┌─────────────────┐      ┌─────────────────┐
   │   Instance 0    │      │   Instance 1    │
   │   Public IP 0   │      │   Public IP 1   │
   └───┬─────────┬───┘      └───┬─────────┬───┘
       │         │              │         │
       │         └──────┐  ┌────┘         │
       │                │  │              │
       │         ┌──────┘  └────┐         │
       │         │              │         │
   ┌───┴─────────┴───┐      ┌───┴─────────┴───┐
   │  On-prem        │      │  On-prem        │
   │  device A       │      │  device B       │
   │  Local NGW A    │      │  Local NGW B    │
   └─────────────────┘      └─────────────────┘

   4 tunnels, all active. BGP + ECMP spread the flows.
   Each instance reaches both devices; each device
   terminates two tunnels.
```

Each on-premises device needs its own local network gateway (with a unique public IP) and its own connection, and each device needs a unique BGP peer IP. BGP and ECMP are both mandatory here. BGP is what lets both connections carry the same on-premises prefixes simultaneously. Every tunnel counts against the SKU's tunnel ceiling.

**BGP support:** All SKUs except Basic support BGP for dynamic route exchange, eliminating manual static route configuration. BGP is required for active-active with dual on-premises devices, and for VNet-to-VNet only when transit routing over that connection is needed.

Transit routing *between* ExpressRoute and VPN, meaning an ExpressRoute-connected site reaching a VPN-connected site through Azure, is a separate problem that BGP alone doesn't solve. It requires [Azure Route Server](https://learn.microsoft.com/en-us/azure/route-server/expressroute-vpn-support){:target="_blank" rel="noopener noreferrer"}, and the VPN gateway's ASN must be left at its default of 65515. Expecting the two gateways to exchange routes with each other by virtue of sharing a VNet is a common and disappointing discovery.

### Point-to-Site (P2S) VPN

P2S connections allow individual client devices to connect to the Azure VNet from any location.

**Protocols:**

| Protocol | Port | OS Support | Notes |
|----------|------|------------|-------|
| **OpenVPN** | TCP 443 | Windows, macOS, Linux, iOS, Android | TLS-based, so it crosses firewalls that only allow 443 outbound |
| **SSTP** | TCP 443 | Windows only | Microsoft proprietary; capped at 128 connections on every SKU |
| **IKEv2** | UDP 500/4500 | Windows, macOS, Linux | Standards-based IPsec; Linux via strongSwan |

P2S requires a route-based gateway regardless of protocol.

**Authentication methods:**

| Method | Supported Protocols | Notes |
|--------|---------------------|-------|
| **Azure certificates** | All | Root CA uploaded to gateway; client certs on each device |
| **RADIUS** | All | Integrates with Active Directory; gateway passes through to RADIUS server. Not supported on Basic |
| **Entra ID** | OpenVPN only | Supports Conditional Access and MFA; requires Azure VPN Client app |

Entra ID authentication is the most enterprise-friendly option, providing centralized identity management with Conditional Access policies, but it requires the OpenVPN protocol. You can enable several authentication types at once; a mechanism that isn't supported by the chosen tunnel type is simply ignored rather than rejected, which is how gateways end up silently not enforcing the Conditional Access someone believed they had configured.

Two Azure VPN Client retirements will force work. The Linux client retires on 31 August 2026, which strands Entra ID authentication on Linux because no other client supports it. Manually registered VPN client app registrations stop working on 31 March 2028 in Azure Public. New gateways should use the Microsoft-registered app ID, which skips tenant app registration entirely.

Azure also rotates the root certificates that gateways present to P2S clients on a published schedule. Every client profile must be regenerated and redistributed when it happens, whatever authentication type is in use. Certificate authentication is not the only thing affected.

### VNet-to-VNet Connections

VNet-to-VNet connections use IPsec/IKE tunnels between two Azure VPN gateways. Traffic stays within the Azure backbone (never traverses the public internet). This is useful for cross-region connectivity, but for same-region or high-bandwidth scenarios, VNet peering is simpler and higher performing.

---

## Azure ExpressRoute

### How ExpressRoute Works

[ExpressRoute](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-introduction){:target="_blank" rel="noopener noreferrer"} provides private, dedicated connectivity between on-premises infrastructure and Azure through a connectivity provider. Traffic never touches the public internet.

A circuit is scoped to a **peering location**, not to an Azure region. "ExpressRoute in Silicon Valley" describes where your traffic enters Microsoft's network, and the circuit SKU then determines how far into Azure it can reach from there. That scoping drives most circuit design decisions, and it is easy to miss because every other resource in this guide is scoped to a region or a VNet. Circuits also cross subscription and tenant boundaries: the circuit owner pays for connectivity and bandwidth, and authorizations let VNets in other subscriptions, tenants, or enrollments link to it without extra configuration.

Each ExpressRoute circuit consists of dual connections to two Microsoft Enterprise Edge (MSEE) routers at a peering location, providing built-in redundancy. Microsoft operates both connections active-active and recommends you do the same. You *can* force active-passive through route advertisements like more specific routes or AS path prepending, but Microsoft warns against it. A passive connection tends to go unmanaged and advertise stale routes, so both paths can fail together. Running active-active means a connection failure drops roughly half the flows instead of all of them. ExpressRoute uses BGP for dynamic route exchange between on-premises and Azure.

**Connectivity models:**
- **CloudExchange co-location:** Virtual cross-connection through an Ethernet exchange at a co-location facility
- **Point-to-point Ethernet:** Direct Ethernet link between on-premises and Azure
- **Any-to-any (IPVPN):** WAN integration through a provider's MPLS network
- **ExpressRoute Direct:** Dedicated 10, 100, or 400 Gbps port pairs directly into Microsoft's global network

### Circuit Bandwidths and SKUs

Provider circuits come in fixed sizes: 50, 100, 200, and 500 Mbps, then 1, 2, 5, and 10 Gbps. ExpressRoute Direct raises that ceiling, covered below.

Bandwidth is duplex, so a 1 Gbps circuit provides 1 Gbps in each direction. Circuits can burst up to 2x bandwidth by spreading traffic across both connections of the redundant pair, though the secondary exists for redundancy and isn't guaranteed for sustained use. Bandwidth can be upgraded without downtime if the underlying port has capacity; if it doesn't, you need a new circuit. Downgrades are not supported at all. You create a smaller circuit and delete the old one. A bandwidth increase also needs your connectivity provider to raise their own throttles, so it isn't purely an Azure-side change.

**Circuit SKU types:**

| SKU | Regional Access | Route Limit (Private Peering) | VNet Connections (1 Gbps) | Global Reach |
|-----|----------------|-------------------------------|---------------------------|--------------|
| **Local** | 1-2 Azure regions in or near the same metro | 4,000 | 10 | Not available |
| **Standard** | All regions in same geopolitical area | 4,000 | 10 | Same geopolitical region only |
| **Premium** | All Azure regions globally | 10,000 | 50 | Cross-geopolitical |

Local SKU is the most cost-effective option when workloads are concentrated in regions near the peering location, because egress data transfer is included in the circuit fee. Three trade-offs come with it, though. Local advertises routes only from its one mapped local region, it isn't offered at peering locations with no nearby Azure region, and it cannot use Global Reach at all.

The Premium VNet-connection limit scales with circuit size rather than sitting at a flat 50. It runs from 20 links on a 50 Mbps circuit up to 100 on a 10 Gbps circuit, while Local and Standard stay at 10 regardless of bandwidth. Premium is all-or-nothing: you can't enable individual features from the bundle, and you can't disable Premium while your usage still exceeds the Standard limits.

### Peering Types

**Azure Private Peering** connects to resources deployed in VNets like VMs, internal load balancers, and PaaS services with VNet integration. It uses private IP addresses and is considered a trusted extension of the on-premises network into Azure. This is the peering type used by most hybrid workloads. It accepts 4,000 IPv4 prefixes from on-premises by default, 10,000 with Premium, and 100 IPv6 prefixes at either tier.

**Microsoft Peering** connects to Microsoft 365 services and Azure PaaS services via their public endpoints. It uses public IP addresses registered in routing registries, and accepts only 200 prefixes, a twentieth of private peering's allowance. Reaching Microsoft 365 over ExpressRoute additionally requires the Premium add-on, which is easy to miss when budgeting a circuit whose whole purpose is Microsoft 365.

Each peering runs its own redundant pair of BGP sessions. Exceeding a prefix limit terminates the session rather than dropping the excess routes, which is why re-advertising Microsoft peering prefixes into private peering is dangerous: Microsoft's prefix list updates monthly and can grow enough to knock over a session that was comfortably inside the limit when you built it.

Azure Public Peering was retired on 31 March 2024. New circuits support Private and Microsoft peering only; circuits created before the deprecation can still manage existing public peering configurations. Microsoft peering with route filters is the replacement, and it reaches Azure PaaS services like Storage and SQL Database through a single routing domain.

### ExpressRoute Gateway SKUs

An ExpressRoute gateway in the GatewaySubnet is required to connect a circuit to a VNet. The gateway SKU determines throughput and features.

| Gateway SKU | Throughput | Packets/Sec | Max Circuits | Routes Learned | FastPath |
|-------------|-----------|-------------|--------------|----------------|----------|
| **Standard / ErGw1Az** | 1 Gbps | 100K | 4 | 4,000 | No |
| **High Perf / ErGw2Az** | 2 Gbps | 200K | 8 | 9,500 | No |
| **Ultra Perf / ErGw3Az** | 10 Gbps | 1M | 16 | 9,500 | Yes |
| **ErGwScale** | 1-40 Gbps | 100K-200K/unit | 4-16 | 9,500 | Yes (10+ units) |

The route-learning column is a separate ceiling from the circuit's prefix limit and it bites earlier: a Premium circuit accepts 10,000 prefixes, but a Standard gateway learns only 4,000 of them. Circuit counts above 4 also require the larger SKUs, and regardless of SKU no more than 4 circuits *from the same peering location* can connect to one VNet. In the other direction, the gateway advertises at most 1,000 VNet routes back to the circuit. Hub-and-spoke estates that outgrow this can summarize using the gateway's `summarizedGatewayPrefixes` property instead of restructuring addressing.

ErGwScale supports autoscaling on bandwidth or flow count, scaling from 1 to 40 units at 1 Gbps per unit. Autoscaling needs a minimum of 2 units; setting minimum and maximum to the same value pins a fixed size, which is what Microsoft recommends when Private Link traffic is in play. Scale operations take up to 30 minutes. Three constraints are easy to trip over: **IPsec over ExpressRoute is not supported on ErGwScale**, which rules it out for the private-peering-plus-encryption pattern; upgrades are seamless only from ErGw1Az/2Az/3Az, while Standard, High Performance, and Ultra Performance require the guided migration tool; and it is unavailable in a handful of significant regions, including West Europe, Japan East, Southeast Asia, South Central US, and East US 2.

Gateway SKU changes are one-directional. You can upgrade within a family, non-AZ to non-AZ or AZ to AZ, but downgrading or crossing between the two families requires deleting and recreating the gateway with the downtime that implies. Microsoft's guided migration tool exists specifically to move existing gateways onto AZ-enabled SKUs without that teardown, and Azure Advisor flags gateways that are eligible.

A common mistake is pairing a high-bandwidth ExpressRoute circuit with a low-tier gateway. A 10 Gbps circuit connected through a Standard gateway (1 Gbps) creates a bottleneck at the gateway.

### ExpressRoute Global Reach

[Global Reach](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-global-reach){:target="_blank" rel="noopener noreferrer"} connects on-premises networks to each other through ExpressRoute circuits via Microsoft's backbone. For example, a data center in California connected via an ExpressRoute circuit in Silicon Valley can communicate with a data center in Texas connected via ExpressRoute in Dallas, with traffic traversing Microsoft's network instead of the public internet.

Throughput is capped by the smaller of the two circuits, and premises-to-premises traffic shares that cap with premises-to-Azure traffic. Global Reach doesn't get its own bandwidth. Connecting circuits across geopolitical regions requires Premium SKU on both; within a geopolitical region, Standard is enough. Global Reach is available in roughly two dozen countries, and **not at all on the Local SKU**.

Two limits catch people. Global Reach connections count against the same per-circuit connection budget as VNet links, so a 10 Gbps Premium circuit's 100 connections are shared between the two, and 5 Global Reach connections leave 95 for gateways. The routes you *receive* on private peering also now include the prefixes of every other on-premises network reachable through Global Reach, not just your Azure VNets, so set the maximum prefix limit on your on-premises router accordingly.

### ExpressRoute Direct

ExpressRoute Direct provides dedicated 10, 100, or 400 Gbps port pairs directly into Microsoft's global network at strategic peering locations. Use cases include massive data ingestion, physical isolation for regulated industries, and organizations that need multiple ExpressRoute circuits from the same location (circuits are provisioned on the dedicated ports).

The port pair sets which circuit sizes you can carve out of it. A 10 Gbps port pair takes circuits of 1, 2, 5, or 10 Gbps; a 100 Gbps pair takes 5, 10, 40, or 100 Gbps; a 400 Gbps pair adds 200 and 400 Gbps. Direct is also the only way to exceed 10 Gbps at all, since provider circuits stop there. 400 Gbps is available only at limited peering locations and requires enrollment.

Direct requires you to own both ends: dual 10/100/400 Gigabit Ethernet ports across a router pair, single-mode LR fiber, and support for Dot1Q or QinQ tagging with multiple BGP sessions per port. LACP and MLAG are not supported. Enrollment is a prerequisite, so register the `AllowExpressRoutePorts` feature on the subscription before you plan to provision ports.

Direct also enables [MACsec encryption](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-howto-macsec){:target="_blank" rel="noopener noreferrer"} at the physical layer between your edge routers and Microsoft's edge routers, providing link-level encryption that standard ExpressRoute circuits do not offer.

### ExpressRoute FastPath

FastPath bypasses the ExpressRoute gateway for data-plane traffic, sending packets directly between on-premises networks and VMs in the VNet. This reduces latency and improves throughput by removing the gateway from the data path. The gateway is still required, and still exchanges routes. FastPath splits the control plane from the data plane rather than eliminating the gateway:

```
                        ┌──── control plane ────┐
                        │    (route exchange)   │
                        │                       ▼
                        │            ┌────────────────────┐
  On-premises ── MSEE ──┤            │  ExpressRoute      │
                        │            │  gateway           │
                        │            │  (GatewaySubnet)   │
                        │            └─────────┬──────────┘
                        │                      │
                        │                      │ everything
                        │                      │ FastPath
                        │                      │ won't carry
                        │                      ▼
                        │            ┌────────────────────┐
                        │            │  Spoke VNets:      │
                        │            │  ILBs, PaaS,       │
                        │            │  Firewall, DNS     │
                        │            │  Private Resolver  │
                        │            └────────────────────┘
                        │
                        └──── data plane ──────┐
                             (FastPath)        ▼
                                     ┌────────────────────┐
                                     │  VMs in hub VNet   │
                                     └────────────────────┘
```

FastPath requires UltraPerformance/ErGw3Az or ErGwScale with a minimum of 10 scale units. That gateway tier, not the feature itself, is what FastPath actually costs, and it sits well above what many workloads would otherwise need.

**FastPath's useful features are ExpressRoute Direct only.** On a provider circuit, FastPath reaches the hub VNet over IPv4 and nothing more: VNet peering over FastPath, UDRs over FastPath, Private Link over FastPath, and IPv6 all require Direct. A hub-and-spoke estate on a provider circuit therefore gets FastPath for hub VMs while every spoke keeps traversing the gateway, which is the opposite of what most people expect when they enable it. Even on Direct, spoke-resident internal load balancers, PaaS services, Azure Firewall, and DNS Private Resolver fall back to the gateway, though the same components in the hub work fine. FastPath with VNet peering also requires all VNets in the same region, since global peering isn't supported.

IP address limits vary by circuit type: 25,000 for provider circuits, 100,000 for 10 Gbps Direct, and 200,000 for 100 and 400 Gbps Direct, applied cumulatively at the port level. When the limit is reached, FastPath silently stops programming new routes and that traffic falls back to the gateway. Nothing errors and nothing alerts. Performance just degrades toward what the gateway can carry, which is why Microsoft suggests an Azure Monitor alert on the route threshold.

---

## VPN Gateway vs ExpressRoute

| Dimension | VPN Gateway | ExpressRoute |
|-----------|-------------|--------------|
| **Connection** | Encrypted tunnels over public internet | Private dedicated connection via provider |
| **Max bandwidth** | 10 Gbps (VpnGw5AZ) | 10 Gbps via provider; 400 Gbps Direct |
| **Latency** | Variable (internet-dependent) | Predictable, low latency |
| **Encryption** | Built-in IPsec/IKE | No built-in encryption (private link); MACsec available on Direct |
| **SLA** | Yes, except Basic | Yes (connection uptime) |
| **Setup time** | Minutes to hours | Weeks to months (provider provisioning) |
| **Cost** | Lower (gateway hourly + egress) | Higher (circuit fee + gateway + egress) |
| **BGP** | Optional (except Basic) | Required |
| **Microsoft 365** | Not supported | Yes, via Microsoft Peering + Premium add-on |
| **Best for** | Dev/test, low-traffic hybrid, ER backup | Production workloads, data-heavy migration, latency-sensitive apps |

Both services carry an SLA, but Microsoft publishes the percentages only in the [SLA for Online Services](https://azure.microsoft.com/support/legal/sla/){:target="_blank" rel="noopener noreferrer"} document rather than in the product documentation, and the figures move. Check it against your own configuration rather than trusting a number quoted secondhand, this guide included. What the product docs *do* commit to is the shape: Basic VPN Gateway is excluded from production recommendations on SLA grounds, zone-redundant gateways rate higher than regional ones, and for ExpressRoute a single circuit is "standard resiliency" while two circuits at two peering locations is "maximum resiliency."

The two services are not mutually exclusive. The most common enterprise pattern uses ExpressRoute as the primary path with VPN Gateway as a failover, both deployed in the same GatewaySubnet.

### Choosing a Circuit SKU

Once ExpressRoute is the answer, three questions settle the SKU, and they interact. Global Reach and Microsoft 365 both override what region scope alone would suggest:

```
Need Microsoft 365 over the circuit?
├── Yes ──────────────────────────────────► PREMIUM (add-on required)
└── No
    │
    Need Global Reach between on-prem sites?
    ├── Yes ── sites in different geopolitical regions? ── Yes ──► PREMIUM (both circuits)
    │          └── No ─────────────────────────────────────────► STANDARD
    └── No
        │
        Which Azure regions must the circuit reach?
        ├── 1-2 regions in the peering location's metro ──► LOCAL
        │      └── egress included in circuit fee; no Global
        │         Reach; not offered at every peering location
        ├── All regions in one geopolitical area ─────────► STANDARD
        └── Regions worldwide ───────────────────────────► PREMIUM
                                 └── also raises route limit
                                    4,000 → 10,000 and VNet
                                    links 10 → 20-100 by size
```

Local is the only SKU that changes the billing model rather than just the reach, so a data-heavy workload sitting next to its peering location can be dramatically cheaper on Local, provided nothing on the Global Reach or multi-region list applies.

---

## Hybrid Connectivity Patterns

### Pattern 1: ExpressRoute with S2S VPN Failover

The most common production pattern. ExpressRoute handles primary traffic while a S2S VPN connection provides disaster recovery. Both gateways coexist in the same GatewaySubnet, each with its own public IP, and the ExpressRoute circuit is always the primary link.

```
                 ┌──────────────┐
   On-premises ──┤ VPN device   │
   10.100.0.0/16 └──┬────────┬──┘
                    │        │
          ┌─────────┘        └──────────┐
          │                             │
    private peering                 IPsec over
    via MSEE pair                 public internet
          │                             │
          ▼                             ▼
  ┌───────────────┐            ┌────────────────┐
  │ ExpressRoute  │            │  VPN gateway   │   both live in
  │ gateway       │            │  (route-based) │   ONE GatewaySubnet
  └───────┬───────┘            └────────┬───────┘   (/27 or larger)
          │                             │
          └──────────────┬──────────────┘
                         ▼
                    Azure VNet
      ER preferred when prefixes match exactly;
      longest prefix match still wins first
```

Azure prefers the ExpressRoute path over VPN when both advertise the *same* route. But route selection runs longest-prefix-match first, so a more specific prefix arriving over VPN beats a broader one over ExpressRoute. If failover behaves backwards in testing, mismatched prefix lengths are the first thing to check, not gateway configuration.

Requirements:
- Route-based VPN gateway (policy-based does not support coexistence, and neither does Basic SKU at all)
- GatewaySubnet of /27 or larger. This is enforced, and adding the second gateway to a /28 fails
- Active-active VPN gateway recommended for better failover throughput
- VPN failover applies to Private Peering only; Microsoft Peering has no VPN failover path
- Set a higher local preference for ExpressRoute routes on-premises, or you get asymmetric routing
- If Microsoft peering is enabled, your VPN gateway's public IP can arrive over ExpressRoute. Route the VPN connection to the internet on-premises, or the backup path runs through the thing it's backing up

### Pattern 2: Geo-Redundant ExpressRoute

Two ExpressRoute circuits in different peering locations connected to the same VNet, which Microsoft calls maximum resiliency as against the standard resiliency of one circuit's redundant connection pair within a single peering location. Recommended for mission-critical production workloads where even a single peering location failure is unacceptable.

Redundancy has to survive the first mile to mean anything. Terminating both connections of a circuit on the same customer edge device, or on the same port of one, discards the redundancy Microsoft built into the circuit and can force your provider to collapse it on their side too. Splitting them too far is its own problem: connections terminated in different geographical locations can differ enough in latency that active load-balancing across them performs worse than one path alone.

### Pattern 3: Global Reach for Multi-Site Connectivity

Multiple on-premises sites each connected via their own ExpressRoute circuits, with Global Reach enabling site-to-site traffic through Microsoft's backbone. This avoids hairpinning traffic through a central hub and provides better latency than routing through an on-premises core network.

The pattern's usual purpose is filling gaps in a WAN provider's footprint rather than replacing it, connecting the branches your provider doesn't reach through a local provider plus Microsoft's network. It rules out Local SKU on any circuit that participates, and each Global Reach link consumes one of the circuit's connection slots.

### Pattern 4: VPN-Only for Dev/Test or Small Offices

A VpnGw1AZ with S2S VPN provides cost-effective hybrid connectivity for environments where bandwidth predictability and low latency are not critical. Sufficient for development environments, small branch offices, or as a stepping stone before provisioning ExpressRoute. Reach for Basic only for genuine throwaway work: no BGP, no active-active, no ExpressRoute coexistence later, and PowerShell or CLI to create it.

---

## Comparison with AWS

| Dimension | Azure VPN Gateway / ExpressRoute | AWS VPN / Direct Connect |
|-----------|----------------------------------|--------------------------|
| **VPN service** | VPN Gateway (S2S + P2S in one) | Site-to-Site VPN + Client VPN (separate) |
| **Private connectivity** | ExpressRoute | Direct Connect |
| **Max VPN throughput** | 10 Gbps (VpnGw5AZ) | 1.25 Gbps per tunnel (multi-tunnel ECMP to ~50 Gbps via Transit Gateway) |
| **Max private bandwidth** | 400 Gbps (Direct) | 100 Gbps (Dedicated) |
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

**Problem:** Carving a /28 or /29 GatewaySubnet because "only a few IPs are needed right now." This is usually inherited from an older deployment or a template written when smaller prefixes were still accepted.

**Result:** /27 is the floor for every SKU except Basic, so the subnet blocks work you didn't know it would block. Adding an ExpressRoute gateway alongside an existing VPN gateway errors out, and the ExpressRoute gateway migration tool refuses to run. The fix is to delete the gateway, resize the subnet, and rebuild, which means cross-premises downtime to correct what amounts to a bookkeeping mistake.

**Solution:** /27 minimum, /26 if 16 ExpressRoute circuits are plausible, and a /64 IPv6 range for dual-stack. Address space inside a VNet is free. If you're stuck on an undersized subnet with a live gateway, try adding a second prefix to the GatewaySubnet via PowerShell, CLI, or ARM before scheduling the outage.

---

### Pitfall 2: Gateway Bottleneck on ExpressRoute

**Problem:** Provisioning a 10 Gbps ExpressRoute circuit but connecting it through a Standard/ErGw1Az gateway (1 Gbps throughput).

**Result:** The circuit has ample bandwidth but the gateway restricts actual throughput to 1 Gbps, creating an expensive bottleneck.

**Solution:** Match the gateway SKU to the circuit bandwidth, and check the route-learning ceiling too, because a Standard gateway learns 4,000 routes no matter how many the circuit accepts. Use ErGwScale with autoscaling for workloads with variable bandwidth demands, after confirming it's offered in your region and that you don't need IPsec over ExpressRoute.

---

### Pitfall 3: Untested VPN Failover

**Problem:** Deploying VPN as a backup for ExpressRoute but never testing the failover path.

**Result:** When ExpressRoute actually fails, the VPN backup does not work because of stale configurations, expired shared keys, or on-premises routing issues that were never validated.

**Solution:** Test failover quarterly by temporarily disabling ExpressRoute BGP sessions and verifying traffic switches to VPN. Validate that on-premises routing preferences are configured correctly (higher local preference for ExpressRoute routes vs VPN routes).

Failure *detection* deserves the same scrutiny as failover. BGP's default hold timer means ExpressRoute takes roughly three minutes to notice a dead path, which is long enough that a "successful" failover test can hide an unacceptable outage. [BFD over private peering](https://learn.microsoft.com/en-us/azure/expressroute/expressroute-bfd){:target="_blank" rel="noopener noreferrer"} cuts that to under a second and is already configured on the Microsoft side of every private peering, so you only enable it on yours. Terminating ExpressRoute BGP sessions on stateful devices is a known cause of failover problems during maintenance, so prefer stateless devices where you have the choice.

---

### Pitfall 4: Expecting ExpressRoute and VPN Sites to Reach Each Other

**Problem:** Connecting one site via ExpressRoute and another via S2S VPN into the same VNet, and assuming the two sites can now talk to each other through Azure. Both gateways sit in the same GatewaySubnet, both speak BGP, and both know the other's routes, so transit looks like it should follow.

**Result:** Each site reaches Azure fine and neither reaches the other. Azure does not transit between an ExpressRoute gateway and a VPN gateway by default, and no amount of BGP configuration on the two gateways changes that.

**Solution:** Deploy [Azure Route Server](https://learn.microsoft.com/en-us/azure/route-server/expressroute-vpn-support){:target="_blank" rel="noopener noreferrer"} to enable the transit, and leave the VPN gateway's ASN at the default 65515, which coexistence requires. If you previously set a custom ASN, changing it back to 65515 requires a gateway reset to take effect.

---

### Pitfall 5: NSGs or UDRs on the GatewaySubnet

**Problem:** Applying NSGs or a default route (0.0.0.0/0) UDR to the GatewaySubnet, often by applying them to "all subnets" in automation scripts. Disabling BGP route propagation on the subnet is the same mistake wearing a different hat.

**Result:** The gateway loses connectivity to its management controller and stops functioning. Tunnels go down with no clear error message. Azure blocks creation of gateways in some of these configurations, which is the good outcome. The bad one is a working gateway that a later policy sweep quietly breaks.

**Solution:** Exclude the GatewaySubnet from NSG assignments and from UDRs that override the default route, and leave BGP route propagation enabled. Audit infrastructure-as-code templates to ensure the GatewaySubnet is handled as a special case. UDRs that merely overlap the GatewaySubnet range or the gateway's public IP range can also disrupt diagnostics and the data path without taking the gateway down outright.

---

### Pitfall 6: Using Basic SKU in Production

**Problem:** Deploying the Basic VPN Gateway SKU for production workloads because it is the cheapest option.

**Result:** No BGP support means manual static route management. No active-active means longer failover. Point-to-Site is SSTP-only, so remote access is Windows-only and capped at 128 connections, with no RADIUS and no Entra ID authentication. No ExpressRoute coexistence blocks future hybrid expansion, and because you can't resize across the coexistence boundary, discovering this later means rebuilding.

**Solution:** Use VpnGw1AZ or higher for any production workload. The cost difference is modest compared to the operational risk of Basic SKU limitations. Basic is not retiring, so it remains a legitimate choice for dev/test, just not for anything you'd page someone about.

---

## Key Takeaways

1. **VPN Gateway and ExpressRoute serve complementary roles.** VPN provides cost-effective encrypted connectivity over the internet. ExpressRoute provides private, high-bandwidth, low-latency connectivity through a provider. Most enterprise architectures use both together.

2. **The GatewaySubnet has unique constraints.** No NSGs, no default-route UDRs, BGP propagation left on, no other resources, and /27 or larger as a hard requirement rather than a recommendation. Treat it as a special-purpose subnet in all automation and governance.

3. **Active-active VPN with BGP is the production standard.** Active-standby has 1-3 minute failover for unplanned events and disconnects every P2S client. Active-active with BGP converges faster and spreads throughput; pairing it with two on-premises devices gives the four-tunnel mesh, which needs BGP and ECMP.

4. **Match ExpressRoute gateway SKU to circuit bandwidth and route count.** A mismatched gateway creates an expensive bottleneck, and a Standard gateway silently caps route learning at 4,000 even behind a 10,000-route Premium circuit.

5. **ExpressRoute does not encrypt traffic by default.** The connection is private but not encrypted. For encryption requirements, layer MACsec on ExpressRoute Direct or use IPsec over ExpressRoute. The latter rules out ErGwScale, which doesn't support it.

6. **ExpressRoute setup takes weeks, not minutes.** Circuit provisioning through a connectivity provider involves physical infrastructure changes. Plan for 2-8 weeks lead time and use VPN as interim connectivity during provisioning.

7. **VPN failover for ExpressRoute requires active maintenance.** Deploy it, test it quarterly, monitor tunnel health continuously, and enable BFD so failures are detected in under a second rather than three minutes. An untested backup is not a backup.

8. **The AZ SKUs are the only VPN SKUs with a future.** Non-AZ VpnGw1-5 can't be created, already reject configuration changes, and retire on 30 September 2026. AZ SKUs deploy in every region, staying regional where zones don't exist yet and becoming zone-redundant automatically once they do, so there's no scenario where the non-AZ SKU is the better pick.

9. **FastPath is an ExpressRoute Direct feature with a provider-circuit trailer.** Spoke VNets, UDRs, Private Link, and IPv6 over FastPath all require Direct. On a provider circuit you get the hub VNet over IPv4 and nothing else, in exchange for a gateway tier of ErGw3Az or 10 ErGwScale units.
