---
title: "AWS Direct Connect & VPN for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How to connect a data center to AWS: Site-to-Site VPN tunnels and their bandwidth, Direct Connect connections, virtual interfaces, and gateways, resiliency models, encryption, BGP failover between the two, and how their costs compare."
tags: [direct-connect, site-to-site-vpn, hybrid-connectivity, bgp, resilience, macsec, practical]
---

## Two Ways Into AWS From a Data Center

A data center or office that needs to reach VPCs privately has two AWS-native options:

| | Site-to-Site VPN | Direct Connect |
|---|---|---|
| **Path** | Encrypted IPsec tunnels over the internet | A private, dedicated circuit from your network into an AWS Direct Connect location |
| **Time to set up** | Minutes to hours | Weeks, because a physical circuit has to be ordered and installed |
| **Bandwidth** | 1.25 Gbps per standard tunnel, or 5 Gbps per large tunnel on a transit gateway, more by spreading traffic across tunnels | Hosted: 50 Mbps to 25 Gbps. Dedicated: 1 to 400 Gbps, more by bundling connections |
| **Latency and jitter** | Varies with the internet path | Consistent, because the path is fixed |
| **Encryption** | Always, by IPsec | None by default, with options to add it |
| **Data transfer out of AWS** | Internet rates, $0.09 per GB for the first 10 TB a month | $0.02 per GB from US Regions to US locations, or none on flat-rate connections |

The usual pattern uses both. Direct Connect carries production traffic, and a VPN stands by as a backup path or carries traffic while the Direct Connect circuit is being provisioned. Smaller sites, branch offices, and early projects often need nothing more than the VPN.

Both connect to the AWS side through one of two gateways. A **virtual private gateway** attaches to a single VPC. A **transit gateway** is a Regional hub that many VPCs attach to, so one VPN or Direct Connect path reaches all of them. Most multi-VPC designs use the transit gateway.

---

## Site-to-Site VPN

### Tunnels and Gateways

A **Site-to-Site VPN connection** runs between a **customer gateway**, the record in AWS of your on-premises VPN device and its public IP address, and a virtual private gateway or transit gateway on the AWS side. Every connection has **two tunnels**, terminating on different AWS endpoints, so AWS maintenance or a single endpoint failure takes down one tunnel and not the connection. Your device should keep both tunnels up.

Routing over the tunnels is either **static**, with routes typed on both sides, or **dynamic**, with **BGP** (Border Gateway Protocol, the protocol routers use to tell each other which address ranges they can reach). BGP is the better default. It fails over between tunnels automatically, advertises new networks without manual changes, and is required for spreading traffic across tunnels, covered next.

### Bandwidth

A standard tunnel carries up to 1.25 Gbps. Since November 2025, a **large bandwidth tunnel** carries up to 5 Gbps, on VPN connections attached to a transit gateway or to Cloud WAN (AWS's managed global network of Transit Gateway-like hubs), not a virtual private gateway. Beyond one tunnel, a transit gateway can spread traffic across many tunnels and connections with **ECMP** (equal-cost multi-path routing), which needs dynamic routing and a customer device that supports it.

In practice, internet conditions, packet sizes, and the customer device's encryption capacity often cap throughput well below those figures. The tunnel MTU (largest packet) is 1446 bytes, so larger packets are fragmented or dropped unless the device lowers the TCP maximum segment size (MSS) that it advertises.

### Variations

- **Accelerated VPN** routes the tunnels to the nearest AWS edge location through AWS Global Accelerator, so traffic crosses less of the public internet. It suits distant sites, and it is available on transit gateway attachments.
- **Private IP VPN** runs IPsec over Direct Connect instead of the internet, using private addresses. It needs a transit gateway reached through a Direct Connect gateway and a transit virtual interface (both covered below), and its throughput is capped at VPN tunnel rates.
- **VPN Concentrator** attaches up to 100 small sites, at up to 100 Mbps each, to one transit gateway, for organizations with many branch offices.

### Cost

In the US East Regions, a standard VPN connection costs $0.05 an hour (about $36 a month) and a large-bandwidth connection $0.60 an hour. Data sent from AWS over the VPN is billed at internet rates, and data into AWS is free. When the connection terminates on a transit gateway, the attachment and its per-GB processing charge apply too.

---

## Direct Connect

### Connections and Locations

**Direct Connect** gives a physical path from your network into AWS through a **Direct Connect location**, a colocation facility where AWS has routers. A **dedicated** connection is your own port there, and a **hosted** one is capacity resold by a partner, as described below. Your router connects to AWS's router there by a **cross-connect**, a fiber run inside the facility. If your equipment isn't in that facility, a network provider carries a circuit from your data center to it.

There are two kinds of connection:

- A **dedicated connection** is a physical port on an AWS router, at 1, 10, 100, or 400 Gbps, ordered from AWS. AWS issues a Letter of Authorization and Connecting Facility Assignment (LOA-CFA), which you give to the facility or your provider to install the cross-connect.
- A **hosted connection** is capacity from 50 Mbps to 25 Gbps on a port that an AWS Direct Connect Partner already owns. The partner provisions it, which is usually faster, and it carries a single virtual interface. The Direct Connect SLA doesn't cover hosted connections.

A **link aggregation group (LAG)** bundles up to four dedicated connections of the same speed on the same AWS device into one logical link (two at 100 or 400 Gbps), which adds capacity but not device or location diversity.

### Virtual Interfaces

A connection is a pipe. What travels over it is divided into **virtual interfaces (VIFs)**, each a VLAN (a tagged, separate logical network on the same link) with its own BGP session:

{% include figure.html id="aws-dx-vifs" %}

| VIF type | Reaches | Addresses |
|---|---|---|
| **Private** | VPCs through a virtual private gateway, directly or through a Direct Connect gateway | Private |
| **Transit** | Transit gateways (and Cloud WAN) through a Direct Connect gateway | Private |
| **Public** | AWS public endpoints, such as S3 and public service IPs, in every Region by default, without crossing the internet | Public, which you must own or receive from AWS |

A dedicated connection can carry up to 51 virtual interfaces, of which up to four are transit VIFs. A hosted connection carries one. Private VIFs support jumbo frames up to 9001 bytes and transit VIFs up to 8500, which suits bulk transfer.

Each VIF limits how many **prefixes** (advertised address ranges, such as `10.20.0.0/16`) it accepts from your side: 100 each for IPv4 and IPv6 by default on a private or transit VIF, raisable to 1,000. Advertising more takes the BGP session down, a common cause of outages when an on-premises team adds networks without summarizing them.

### Direct Connect Gateways

A **Direct Connect gateway** is a global resource that joins virtual interfaces to AWS gateways in any Region. A private VIF attached to one can reach up to 20 virtual private gateways, and a transit VIF can reach up to 6 transit gateways, across Regions. One circuit in one location can therefore serve VPCs worldwide, though traffic still travels over AWS's network to the Region where each VPC lives. The Direct Connect gateway doesn't route between the gateways attached to it, so VPC-to-VPC traffic still needs a transit gateway or VPC peering (a direct link between two VPCs).

With **SiteLink**, traffic between two of your own sites can travel over Direct Connect locations and the AWS backbone, without entering a Region.

### Resiliency

A single connection has many single points of failure: the cross-connect, the AWS router, the facility, your router, and the provider circuit. AWS's resiliency models describe how many connections, devices, and locations remove them:

| Model | Layout | Survives | SLA |
|---|---|---|---|
| **Maximum resiliency** | At least four connections on separate AWS devices, across at least two locations | Device, connection, and whole-location failure | 99.99% |
| **High resiliency** | At least two connections, in two locations | Connection, device, and location failure | 99.9% |
| **Development and test** | Two connections on separate devices in one location | Device failure only | 95%, as single connections |

A single dedicated connection carries a 95% SLA, so connections outside a resilient layout still have one. The 99.9% and 99.99% SLAs also require an Enterprise Support plan, and 99.99% requires a Well-Architected review with AWS. Hosted connections aren't covered by any of them, which matters when choosing a partner's capacity for production.

A layout only delivers its model if each connection can carry the full load alone, and if the on-premises side, including routers and provider circuits, is as diverse as the AWS side. Because AWS prefers Direct Connect locations in a Region's home area, BGP communities that set local preference on the routes you advertise are how you choose which connection AWS sends traffic back through.

### Encryption

Direct Connect traffic is private but unencrypted. Three options add encryption:

- **MACsec** encrypts each frame between your router and the AWS device, on 10, 100, and 400 Gbps dedicated connections at selected locations, when your router supports it. It isn't available on 1 Gbps or hosted connections.
- **A VPN over Direct Connect** adds IPsec at VPN throughput. It runs either as a private IP VPN over a transit VIF, or as an ordinary Site-to-Site VPN whose tunnels reach AWS's public VPN endpoints over a public VIF instead of the internet.
- **Encryption at the application layer**, such as TLS, which most traffic already uses.

### Cost

Direct Connect has two pricing models, chosen per connection and switchable at any time.

**Pay-as-you-go** charges per port hour and per GB sent out of AWS, and incoming data is free. In the US, dedicated ports cost $0.30 an hour at 1 Gbps (about $220 a month), $2.25 at 10 Gbps, $22.50 at 100 Gbps, and $85.00 at 400 Gbps. Hosted connections are priced by capacity, from $0.03 an hour at 50 Mbps to $6.20 at 25 Gbps. Data out from US Regions to US locations is $0.02 per GB. At $0.07 per GB less than the internet's first tier, 10 TB a month out of AWS saves roughly $700, about three times the cost of a 1 Gbps port.

**Flat-rate pricing**, since September 2026, applies to 10 and 100 Gbps dedicated connections. It charges one fixed rate by bandwidth and geographic tier with no per-GB data transfer charges within the tier, and it includes a second connection on a different device or location, a **port-pair**, at no extra charge. For steady, heavy outbound traffic that also needs redundancy, it removes the per-GB calculation entirely.

Under either model, cross-connect fees at the facility and provider circuits are billed separately, often by other companies, and can exceed the AWS charges. Traffic reaching VPCs through a transit gateway also pays the gateway's per-GB processing charge.

---

## Failover Between Direct Connect and VPN

A VPN backing up Direct Connect works through BGP. Both paths advertise the same on-premises networks to AWS, and AWS's route selection picks between them:

{% include figure.html id="aws-dx-vpn-failover" %}

Two conditions make that work. AWS always prefers the most specific prefix first, so a more specific range advertised over the VPN draws traffic to it even while Direct Connect is up. On a transit gateway, static routes also outrank Direct Connect routes, so the backup VPN must use BGP. On the on-premises side, your routers need their own preference for Direct Connect, set with BGP's local preference or by lengthening the AS path on the VPN's routes.

How fast failover happens depends on how fast BGP notices the failure. Without help, a Direct Connect BGP session is declared down after its 90-second hold timer expires. **Bidirectional Forwarding Detection (BFD)** detects a dead link in under a second. AWS enables it on its side of Direct Connect, so turning it on in your router cuts failover to seconds.

Test failover on purpose rather than waiting for an outage. The Direct Connect failover test in the console takes down the BGP sessions on chosen virtual interfaces for a set time, so you can confirm that traffic moves and that the backup path has the capacity for it. A backup VPN that has never carried production traffic can fail when it's needed, through expired keys, a wrong route preference, or too little bandwidth.

---

## Choosing

```
Is the connection needed within days?
├── Yes → Start with Site-to-Site VPN (and order Direct Connect in parallel if it will be needed)
└── No  → Does the traffic need consistent latency, sustained throughput beyond what
          VPN tunnels deliver, or enough data out of AWS that Direct Connect pricing wins?
          ├── No  → Site-to-Site VPN, two connections from two devices
          └── Yes → Direct Connect
                    1. Resilience: high or maximum resiliency for production, plus a VPN backup
                    2. Encryption, if required: MACsec on 10 Gbps and faster, else a VPN over it
```

---

## Common Pitfalls

### Two Connections That Fail Together

Two Direct Connect connections from the same on-premises router, over the same provider, or into the same facility share a failure. Count diversity on the customer side as carefully as on the AWS side.

### Waiting on the Cross-Connect

A dedicated connection stays down until the facility installs the cross-connect, and that work starts only after you hand them the LOA-CFA. Order the cross-connect or provider circuit as soon as the LOA-CFA is issued, and run a VPN in the meantime.

---

## Key Takeaways

1. **VPN is fast to set up and encrypted, and Direct Connect is consistent and cheaper per GB.** Most production designs use Direct Connect with a VPN backup.
2. **Attach both to a transit gateway** when more than one VPC needs on-premises access, and to get large VPN tunnels and ECMP.
3. **Virtual interfaces decide where Direct Connect traffic goes:** private to VPCs, transit to transit gateways, and public to AWS public endpoints. A Direct Connect gateway lets one circuit reach VPCs in any Region.
4. **Resiliency needs separate devices and separate locations,** on both sides, each carrying the full load.
5. **Direct Connect isn't encrypted.** Use MACsec, a VPN over it, or TLS where traffic must be.
6. **Use BGP with BFD, and test failover on purpose.**
