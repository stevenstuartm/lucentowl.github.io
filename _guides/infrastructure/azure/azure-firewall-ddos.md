---
title: "Azure Firewall and DDoS Protection"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "How Azure Firewall's three SKUs filter traffic, the order its rules are processed in, when IDPS and TLS inspection earn their cost, and how the DDoS Protection tiers cover the network layer that a WAF does not."
tags: [security, networking, azure-firewall, ddos-protection, idps, waf, practical]
---

## What Is Azure Firewall

[Azure Firewall](https://learn.microsoft.com/en-us/azure/firewall/overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's managed, stateful network firewall. Network Security Groups (NSGs) filter by IP, port, and protocol at the subnet and NIC boundary. Azure Firewall adds application-layer filtering, Microsoft's threat intelligence feed, and one policy object that many firewall instances can share across regions and subscriptions.

### What Problems Azure Firewall Solves

**Without Azure Firewall:**
- NSGs filter only at layers 3-4 (IP, port, protocol)
- No filtering by FQDN, URL, or web category
- No shared firewall policy across multiple VNets or hybrid environments
- No managed threat intelligence feed
- Each team manages NSGs independently, so security posture drifts between teams
- No central log of what was blocked at the network perimeter

**With Azure Firewall:**
- Outbound filtering by FQDN and, on Premium, by full URL and web category
- One Firewall Policy resource shared by firewalls in any region or subscription
- Microsoft's threat intelligence feed blocking known malicious IPs and domains, updated automatically
- Signature-based IDPS on Premium for known exploit patterns
- Inbound DNAT for non-HTTP protocols such as RDP, SSH, and FTP
- Central logging to Log Analytics, Storage, or Event Hubs

### How Azure Firewall Differs from AWS Equivalents

Architects familiar with AWS should note these differences:

| Aspect | AWS | Azure |
|--------|-----|-------|
| **Primary firewall** | AWS Network Firewall or third-party NVAs | Azure Firewall (managed service) |
| **Centralized management** | AWS Firewall Manager (Security Groups, Network Firewall, WAF) | Azure Firewall Manager (Firewall Policy, DDoS plans, WAF policies; not NSGs) |
| **Threat intelligence** | GuardDuty (findings service) or third-party integrations | Built into Azure Firewall; Microsoft updates the feed |
| **Application inspection** | Network Firewall supports domain list filtering | Azure Firewall Premium with IDPS and TLS inspection |
| **DDoS protection** | Shield Standard (free) and Shield Advanced (paid) | Infrastructure protection (free) plus DDoS IP Protection and DDoS Network Protection (both paid) |
| **Hub-and-spoke firewall** | Network Firewall in VPC with NLB, routing via TGW | Azure Firewall in hub VNet with UDRs |
| **Hybrid inspection** | Network Firewall in VPC, manual on-premises routing | Single firewall inspects cloud and on-premises traffic |
| **Deployment model** | Per-region in VPCs | Per-hub VNet or per-region in Virtual WAN hubs |

---

## Azure Firewall SKUs: Basic, Standard, Premium

Azure Firewall ships in [three SKUs](https://learn.microsoft.com/en-us/azure/firewall/features-by-sku){:target="_blank" rel="noopener noreferrer"}. They are not a simple ladder of throughput. Basic drops capabilities that most enterprise designs assume are present, and Premium adds inspection that costs CPU as well as money.

| Capability | Basic | Standard | Premium |
|---|---|---|---|
| **Maximum throughput** | 250 Mbps | 30 Gbps | 100 Gbps |
| **Application FQDN filtering (SNI based)** | Yes | Yes | Yes |
| **FQDNs in network rules (any port/protocol)** | No | Yes | Yes |
| **Threat intelligence** | Alert only | Alert and deny | Alert and deny |
| **DNS proxy and custom DNS** | No | Yes | Yes |
| **Web categories** | No | Yes (FQDN based) | Yes (full URL) |
| **URL filtering (full path)** | No | No | Yes |
| **TLS inspection** | No | No | Yes |
| **IDPS** | No | No | Yes |
| **Public IPs** | Multiple | Up to 250 | Up to 250 |

Two of those rows decide most SKU choices. Basic can only *alert* on threat intelligence, never block it, which removes the single highest-value feature of the service. Basic also has no DNS proxy, which means it cannot resolve FQDNs used in network rules.

### Cost Shape

US East list prices, from the [Azure retail rate card](https://prices.azure.com/api/retail/prices){:target="_blank" rel="noopener noreferrer"}:

| SKU | Fixed deployment | Capacity unit | Data processed |
|---|---|---|---|
| Basic | $0.395/hour | n/a | $0.065/GB |
| Standard | $1.25/hour | $0.07/hour | $0.016/GB |
| Premium | $1.75/hour | $0.11/hour | $0.016/GB |

Three things fall out of that table. Premium's fixed charge is 40% above Standard, not the multiple that "Premium tier" suggests, so the SKU decision is usually about inspection overhead rather than list price. Standard and Premium also bill hourly *capacity units* on top of the deployment charge as the firewall scales out, so a busy firewall costs more than the fixed rate implies. And Basic's data processing rate is four times higher, so its $0.855/hour saving on the fixed charge disappears at roughly 17 GB of processed traffic per hour, before counting capacity units.

### When Each SKU Fits

**Basic** suits small environments under 250 Mbps that need FQDN filtering and central logging, and can accept threat intelligence in alert-only mode.

**Standard** is the default for enterprise hub-and-spoke. It is the lowest SKU that can deny traffic on threat intelligence, resolve FQDNs in network rules, and act as a DNS proxy.

**Premium** is warranted when a requirement names the feature: TLS inspection for a compliance mandate, IDPS for signature-based detection, or URL filtering below the FQDN level. Premium also raises the throughput ceiling to 100 Gbps.

**Trade-offs of Premium beyond price:**
- TLS decryption and IDPS both consume CPU, which lowers effective throughput
- You become a certificate authority for the traffic you decrypt, with renewal, rotation, and recovery to run
- Certificate pinning and mutual TLS cannot be decrypted, so those flows need bypass rules
- IDPS signatures find known patterns; novel attacks pass

---

## Rule Types and Processing Order

Azure Firewall denies everything until a rule allows it. Rules are terminating, so processing stops at the first match. What trips people up is that the order is fixed by rule *type*, not by the priority numbers you assign. A high-priority application rule still runs after every network rule.

```
Packet arrives at the firewall
          |
          v
  Threat intelligence  --- match ---> alert, or deny (Standard/Premium)
          | no match
          v
  DNAT rule collections --- match ---> translate and allow, stop
          | no match
          v
  Network rule collections --- match ---> allow or deny, stop
          | no match, and protocol is HTTP/HTTPS/MSSQL
          v
  Application rule collections --- match ---> allow or deny, stop
          | no match
          v
  Built-in infrastructure rule collection --- match ---> allow
          | no match
          v
       Default deny

  IDPS (Premium) runs beside this pipeline: in Alert mode it inspects
  in parallel, in Alert and Deny mode it inspects inline after the
  rules engine has already decided, and can drop the flow silently.
```

Within each of those three passes, the firewall walks rule collection *groups* by priority, then rule collections by priority inside each group. Rule collection groups inherited from a parent policy always run before the child policy's own, whatever priority numbers they carry.

### Threat Intelligence Runs First

[Threat intelligence-based filtering](https://learn.microsoft.com/en-us/azure/firewall/threat-intel){:target="_blank" rel="noopener noreferrer"} has the highest priority and can block a flow before any configured rule is evaluated. An allow rule you wrote does not override it. If a legitimate destination is caught by the feed, the fix is the threat intelligence allowlist, not a higher-priority rule.

**Modes:**
- **Off:** disabled
- **Alert:** logs traffic to known malicious IPs and domains but lets it pass, which is the only mode Basic supports
- **Alert and deny:** blocks it, and is the mode to run in production

### NAT Rules

DNAT rules translate inbound traffic from a firewall public IP to a private address.

**Use case:** exposing an internal RDP or SSH host to a controlled set of source addresses.

**Example:** traffic arrives at the firewall's public IP on port 443, the rule translates the destination to `10.0.1.10:443`, and return traffic is translated back automatically.

**Characteristics:**
- Inbound only, from the internet or an intranet source
- A DNAT match allows the traffic outright, so network rules never see it
- Application rules are never applied to inbound connections, so inbound HTTP/S filtering needs a WAF instead
- Always scope the source. A wildcard source on a DNAT rule publishes the backend to the internet

### Network Rules

Network rules filter on source, destination, port, and protocol (TCP, UDP, ICMP, or any IP protocol).

**Example rule:** source `10.1.0.0/16`, destination the `Internet` service tag, TCP 443, action Allow.

**Characteristics:**
- Evaluated before application rules, and a match stops processing
- Service tags (VirtualNetwork, Internet, Storage, Sql, AzureMonitor) cover broad groupings
- Cheaper per packet than application rules
- FQDNs are allowed in network rules on Standard and Premium, but only work reliably with DNS proxy enabled on the firewall, because the firewall and the client must resolve the name to the same address

Because network rules win, a broad `Allow TCP 443 to Internet` network rule silently disables every application rule you wrote for HTTPS destinations. That combination is the most common reason FQDN filtering appears not to work.

### Application Rules

Application rules filter on application-layer data and apply to HTTP, HTTPS, and MSSQL traffic only.

**Example rule:** source `10.1.0.0/16`, protocol HTTPS, target FQDN `*.microsoft.com`, action Allow.

**Characteristics:**
- Matching is by Host header for HTTP and by SNI for HTTPS, so the firewall does not need to decrypt to match an FQDN
- The packet's destination IP is ignored in favor of the address resolved from the Host header
- Traffic matched by an application rule is always SNAT'd, so the original client IP does not reach the destination. Use network rules with destination FQDNs when the backend needs to see it
- No network rule is required underneath, and adding one usually breaks the application rule
- Full URL matching and web categories below the FQDN require Premium with TLS inspection

**Wildcards behave asymmetrically.** For target FQDNs, an asterisk works only on the left. `*.contoso.com` matches `any.contoso.com` but *not* `contoso.com`, which has to be listed separately. `*contoso.com` matches `example.anycontoso.com` and also `th3re4lcontoso.com`, so a leading asterisk without the dot is a supply-chain-shaped hole.

### The Infrastructure Rule Collection

Azure Firewall carries a built-in allow list of platform FQDNs (the compute platform image repository, managed disk status storage, and Azure diagnostics) that is processed after your application rules and before the final deny. It is invisible in the portal and cannot be edited. If your compliance posture requires that nothing is allowed implicitly, override it with a deny-all application rule collection processed last, which runs before the infrastructure collection.

---

## Intrusion Detection and Prevention (Premium)

Premium adds a signature-based [intrusion detection and prevention system](https://learn.microsoft.com/en-us/azure/firewall/premium-features){:target="_blank" rel="noopener noreferrer"}: over 67,000 rules across more than 50 categories, with 20 to 40 new signatures released daily, and up to 10,000 of them individually customizable to Disabled, Alert, or Alert and Deny.

**Modes and where they sit in the pipeline:**
- **Off:** no inspection
- **Alert:** the IDPS engine runs in parallel with rule processing, so a flow the rules already allowed or denied can produce a second log entry
- **Alert and Deny:** the engine runs inline *after* the rules engine has decided, and can drop a flow the rules allowed

A silent drop is the behavior to plan for. IDPS session drops send no TCP RST, so the client sees a hang rather than a refusal. Combined with the extra Drop entry that appears in the logs after an Allow entry, this is what an IDPS false positive looks like during an incident.

You also configure private IP ranges so IDPS can tell inbound, outbound, and east-west traffic apart. Leaving that at the default in a network using non-RFC1918 private space means signatures are applied in the wrong direction.

**When to enable IDPS:** a compliance requirement names intrusion detection, the workload is a high-value target, or a SOC exists to triage the alerts.

**When to skip it:** throughput is the binding constraint, the workload has no application-layer exposure, or nobody is resourced to investigate false positives.

---

## TLS Inspection (Premium)

TLS inspection terminates the client's TLS session, inspects the plaintext, and opens a second TLS session to the destination. Azure Firewall holds two connections, one to the client and one to the server.

### How It Works

1. **Certificate provisioning:** you give the firewall an intermediate CA certificate that your clients already trust
2. **Interception:** the firewall terminates the client's TLS handshake for `api.example.com`
3. **Certificate generation:** it mints a leaf certificate for that name, signed by your CA
4. **Server connection:** it opens its own TLS connection to the real server
5. **Inspection:** the plaintext is matched against URL filtering, web categories, and IDPS signatures
6. **Re-encryption:** the response is re-encrypted to the client

Outbound inspection covers Azure-to-internet traffic. East-west inspection covers traffic between Azure workloads and to and from on-premises.

### When to Enable It

**Enable when:**
- A compliance mandate requires inspection of encrypted traffic
- Data exfiltration controls need content inspection, not just destination filtering
- URL filtering below the FQDN, or web categories on HTTPS, are required

**Do not enable when:**
- Clients pin certificates, which will fail validation against your minted leaf
- The flow uses mutual TLS with client certificates
- The clients are external parties who have no reason to trust your CA

### Trade-offs

- **Certificate management:** you operate a CA, including renewal, rotation, and recovery
- **Client trust:** any client missing your root sees certificate errors, not a graceful fallback
- **Throughput:** decryption and re-encryption consume CPU, which reduces the effective ceiling. Size against the published [Azure Firewall performance](https://learn.microsoft.com/en-us/azure/firewall/firewall-performance){:target="_blank" rel="noopener noreferrer"} figures rather than the SKU maximum
- **Bypass lists:** pinned and mutual-TLS applications need explicit bypass rules, and each one is a hole in the inspection you are paying for

---

## Firewall Policy and Firewall Manager

Firewall Policy is a standalone resource holding rule collections, DNS settings, threat intelligence configuration, and the Premium features. It is the recommended way to configure Azure Firewall. Classic rules remain supported but do not carry the Premium settings.

### Policies Are Shared, Not Per-Firewall

A single policy can be associated with many firewalls, in Virtual WAN secured hubs and hub VNets alike, across regions and subscriptions in the same tenant. That association is also the billing boundary: a policy with zero or one firewall attached is free, and a policy attached to multiple firewalls is billed at a fixed rate.

Policy SKUs must match the firewall. Basic policies work only on Basic firewalls, Standard policies on Standard or Premium, and Premium policies only on Premium.

### Inheritance

**Policy structure:**
- Rule collection groups (the first unit processed, by priority)
- Rule collections (NAT, network, or application; one action and one priority each)
- Rules (evaluated top-down within the collection)

**Example hierarchy:**
```
Base Policy (enterprise-wide)
├── Deny known ransomware destinations
├── Allow common enterprise SaaS (Microsoft 365, GitHub)
│
├── Finance policy
│   └── Finance-Production policy
│         └── banking APIs, compliance logging
│
└── Engineering policy
     └── Engineering-Development policy
           └── Docker Hub, GitHub, npm registry
```

**What inheritance guarantees, and what it does not:**
- Parent rule collection groups always process before the child's, whatever priorities are set, so a parent deny cannot be undone by a child allow
- Network rule collections inherited from the parent outrank the child's network collections, and the same holds for application collections
- NAT rules are **not** inherited, because they are specific to one firewall's public IPs, so a child policy must define its own
- Threat intelligence mode is inherited and can only be overridden to a *stricter* mode, never disabled
- The threat intelligence allowlist is inherited, and a child can append to it
- Parent and child must live in the same region, though the firewalls they are attached to can be anywhere
- Changes to the parent propagate automatically to every child

### What Firewall Manager Adds

[Azure Firewall Manager](https://learn.microsoft.com/en-us/azure/firewall-manager/overview){:target="_blank" rel="noopener noreferrer"} is the management plane over policies for two architectures: **secured virtual hubs** (a Virtual WAN hub with security and routing policy attached) and **hub virtual networks** (a VNet you build and peer yourself). It also associates VNets with DDoS protection plans and manages WAF policies for Front Door and Application Gateway. It does not manage NSGs.

Centralized route management, which removes the need to hand-write UDRs in every spoke, is available only for secured virtual hubs. In a hub VNet you still write and maintain the UDRs yourself.

One operational warning from Microsoft's own known-issues list: if a Virtual WAN deployment uses static or custom routes, manage it from the Virtual WAN pages rather than Firewall Manager, because Firewall Manager updates can overwrite those routes and drop traffic.

---

## NSG vs Azure Firewall vs WAF

Each control sits at a different point in the path and answers a different question. They are not substitutes.

| Aspect | NSG | Azure Firewall | WAF |
|--------|-----|---|---|
| **Layers** | 3-4 (IP, port, protocol) | 3-4, plus 7 for HTTP/HTTPS/MSSQL | 7 (HTTP/HTTPS only) |
| **Position** | Subnet and NIC boundary | Hub perimeter and east-west chokepoint | In front of a specific application (Front Door or Application Gateway) |
| **Rule vocabulary** | IP, port, protocol | The above plus FQDN, URL, web category, threat feed | URI paths, headers, request body (SQL injection, XSS), rate limits |
| **Direction** | Both, per subnet or NIC | Outbound and east-west by rules, inbound by DNAT | Inbound only |
| **Cost model** | No charge | Hourly deployment + capacity units + per GB | Per endpoint + per rule |
| **Throughput** | No measurable overhead | 250 Mbps to 100 Gbps by SKU | Depends on the gateway tier |
| **Primary use** | Segmentation, lateral movement | Egress control, threat intelligence, central logging | Application attack prevention |

Note that Azure Firewall never filters inbound HTTP/S at layer 7. Application rules do not run on inbound connections, so a firewall in front of a web app inspects nothing that a WAF would catch.

### Choosing the Layer and the SKU

```
What traffic are you controlling?
│
├─ Inbound HTTP/S from the internet to a web app
│   └─ WAF: Front Door (global, edge) or Application Gateway (regional)
│      Azure Firewall adds nothing at layer 7 here
│
├─ Inbound RDP / SSH / FTP from the internet
│   └─ Azure Firewall DNAT with an explicit source range
│      (Azure Bastion is the better answer for admin access)
│
├─ East-west between subnets or tiers
│   └─ NSG. Free, no throughput cost, no UDR maintenance
│      Firewall only if the flows need FQDN rules or central logs
│
├─ Outbound to the internet, filtered by name or reputation
│   ├─ Under 250 Mbps and alert-only threat intel is acceptable
│   │    └─ Azure Firewall Basic
│   ├─ Need to deny on threat intel, DNS proxy, web categories
│   │    └─ Azure Firewall Standard
│   └─ Need TLS inspection, IDPS, or URL-level filtering
│        └─ Azure Firewall Premium
│
└─ Absorbing a volumetric flood against a public IP
    ├─ Fewer than ~15 protected public IPs
    │    └─ DDoS IP Protection
    └─ More, or you need rapid response, cost protection, WAF discount
         └─ DDoS Network Protection
```

---

## Azure DDoS Protection

A DDoS attack exhausts a service's capacity rather than exploiting a flaw in it. [Azure DDoS Protection](https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-protection-overview){:target="_blank" rel="noopener noreferrer"} mitigates that at **layers 3 and 4 only**. Application-layer floods are a WAF's job, and no DDoS tier changes that.

### Three Levels, Not Two

**Infrastructure protection** is always on, free, and applies to every Azure public IPv4 and IPv6 address, including multi-tenant PaaS services. It defends the platform, so its thresholds are set for Azure's capacity rather than yours. Traffic that Azure shrugs off can still saturate a single application, and this level gives you no telemetry, alerting, or per-application tuning.

The two paid tiers add per-resource monitoring with thresholds profiled against your own traffic:

| Feature | DDoS IP Protection | DDoS Network Protection |
|---|---|---|
| Always-on monitoring and automatic L3/L4 mitigation | Yes | Yes |
| Mitigation policies tuned to the application | Yes | Yes |
| Metrics, alerts, mitigation reports, flow logs | Yes | Yes |
| Microsoft Sentinel connector and workbook | Yes | Yes |
| Protection across subscriptions in a tenant | Yes | Yes |
| Basic-tier public IP protection | No | Yes |
| DDoS Rapid Response (DRR) support | No | Yes |
| Cost protection | No | Yes |
| WAF discount | No | Yes |
| Billing | Per protected IP ($199/IP/month, US list) | Fixed monthly plan covering 100 IPs, then per additional IP |

Microsoft's own [break-even guidance](https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-faq){:target="_blank" rel="noopener noreferrer"} puts the crossover at about 15 protected public IPs. Below that, IP Protection is cheaper. Above it, the Network Protection plan is, and one plan covers every subscription in the tenant.

The WAF discount is easy to miss when comparing the two. With Network Protection enabled on a VNet, an Application Gateway with WAF in that VNet is billed at the non-WAF rate, which claws back a meaningful share of the plan fee for anyone already running WAF v2.

### Attack Types and What Covers Them

**Volumetric (layer 3-4):** UDP floods, DNS amplification, ICMP floods, aiming to consume bandwidth. Covered by all three levels, with per-application thresholds only on the paid tiers.

**Protocol (layer 4):** SYN floods, malformed and fragmented packets, aiming to exhaust connection state. Same coverage.

**Application layer (layer 7):** HTTP floods, slowloris, bot-driven request storms that never approach a bandwidth limit. **Not covered by any DDoS tier.** These need a WAF with rate limiting and bot rules, in front of the application.

### Adaptive Tuning

Azure DDoS Protection profiles a protected IP's traffic over time and machine-learns three mitigation policies per public IP (TCP SYN, TCP, and UDP). Mitigation engages for an IP only once its policy threshold is exceeded, which is why the profiling matters: too low and legitimate bursts trigger mitigation, too high and an attack passes.

The thresholds are not user-configurable. There is no manual policy, no allowlist, and no blocklist, though a [custom policy feature](https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-custom-policy-overview){:target="_blank" rel="noopener noreferrer"} for tuning per-protocol detection is in preview. Plan around the tuning rather than expecting to override it.

### DDoS Rapid Response

Network Protection includes access to the **DDoS Rapid Response (DRR)** team during an active attack, for investigation during the event and analysis afterward. IP Protection does not include it. Cost protection, also Network Protection only, provides service credits for data transfer and scale-out costs incurred during a documented attack.

### Where Protection Does Not Reach

The paid tiers protect public IPs on resources in ARM virtual networks. Several gaps matter at design time:

- **Virtual WAN is not supported.** A secured virtual hub cannot be covered by a DDoS protection plan in the normal way, though customer-provided public IPs on secured hubs can be configured with DDoS Protection (preview).
- **Multi-tenant PaaS is not supported.** Storage, Event Hubs, App Service, and API Management outside VNet integration fall back to infrastructure protection.
- **NAT Gateway public IPs are not supported**, nor are Classic/RDFE virtual machines.
- **VPN and virtual network gateways** are covered by a policy, but without adaptive tuning.

The service is zone-resilient by default with no configuration required.

---

## Architecture Patterns

### Pattern 1: Hub-and-Spoke with Forced Tunneling

The standard enterprise pattern, and the foundation of Azure Landing Zones. All internet-bound traffic from spokes is routed through a firewall in the hub.

```
Hub VNet (10.0.0.0/16)
├── AzureFirewallSubnet (10.0.1.0/26) → Azure Firewall
├── GatewaySubnet (10.0.2.0/27) → VPN / ExpressRoute
├── AzureBastionSubnet (10.0.3.0/26)
└── Management Subnet (10.0.4.0/24)

Spoke VNet 1 (10.1.0.0/16) ←peered→ Hub
├── Web Subnet (10.1.1.0/24) → UDR: 0.0.0.0/0 → 10.0.1.4
├── App Subnet (10.1.2.0/24) → UDR: 0.0.0.0/0 → 10.0.1.4
└── Data Subnet (10.1.3.0/24)

Spoke VNet 2 (10.2.0.0/16) ←peered→ Hub
└── (same structure)
```

**How traffic flows:**
1. A VM in `10.1.2.0/24` opens an outbound HTTPS connection
2. The subnet's UDR matches `0.0.0.0/0` and sends it to the firewall's private IP
3. Threat intelligence runs, then network rules, then application rules
4. If allowed, the firewall SNATs and establishes the outbound connection
5. Return traffic comes back through the firewall

**Requirements that are easy to miss:**
- `AzureFirewallSubnet` must be at least a /26, and that size is sufficient at any scale
- Subnet-level NSGs on `AzureFirewallSubnet` are not supported and are disabled by the platform
- The firewall must keep direct internet connectivity. If the subnet learns a default route from on-premises over BGP, override it with a `0.0.0.0/0` UDR whose next hop is Internet
- The firewall and its VNet must be in the same resource group and subscription

**Trade-offs:**
- Every outbound flow funnels through one resource, which is both the control point and the bottleneck
- Scale-out takes five to seven minutes and starts at 60% of throughput or CPU, so a step change in load is not absorbed instantly
- Latency is added to all outbound traffic
- UDR mistakes cause routing loops and asymmetry
- In exchange: one policy, no shadow egress, and one log of everything that left

### Pattern 2: Virtual WAN Secured Hubs

For many spokes or multiple regions, Virtual WAN replaces peering and per-spoke UDRs with a managed hub.

| | Hub VNet | Secured virtual hub |
|---|---|---|
| Spoke attachment | VNet peering you create | Virtual network connections |
| Route management | UDRs you write per subnet | Centralized in Firewall Manager |
| Inter-hub connectivity | Peering and UDRs | Managed by Virtual WAN |
| Firewall placement | A subnet you size | Integrated into the hub |
| DDoS protection plan | Supported | Not integrated with Virtual WAN |

**Spoke-to-spoke and inter-hub traffic is not inspected by default.** The firewall sits in the hub, but sending private traffic through it requires enabling **routing intent** on the hub. Without it, spoke-to-spoke and branch-to-branch flows bypass the firewall, and inter-hub traffic cannot be filtered at all. This is the assumption most often carried over incorrectly from hub-VNet designs.

Published Virtual WAN scale figures: the hub router carries up to 50 Gbps of VNet-to-VNet traffic, sized against an assumed 2,000 VM workload across all connected VNets, and up to 1,000 branch connections per hub. Multiple hubs per region are supported when those ceilings bind.

### Pattern 3: Hybrid Inspection

One firewall in the hub can inspect both cloud-to-internet and on-premises-to-cloud traffic.

```
On-premises data center
   │  VPN or ExpressRoute
   v
Hub VNet GatewaySubnet ──UDR: spoke CIDRs → firewall──┐
                                                      v
                                              Azure Firewall
                                                      │
                              ┌───────────────────────┼──────────────┐
                              v                       v              v
                       Spoke VNet 1            Spoke VNet 2      Internet
                    (UDR: on-prem CIDR         (UDR: 0.0.0.0/0
                       → firewall)               → firewall)
```

The route table on the GatewaySubnet sends spoke-bound traffic to the firewall, and each spoke sends on-premises-bound and internet-bound traffic back to it. Both halves are required. Configuring only one produces asymmetric routing, where a stateful firewall sees one direction of a flow and drops it.

Note that the firewall does not SNAT when the destination is an RFC 1918 or RFC 6598 private range. If your organization uses public address space privately, the firewall will SNAT that traffic unless you configure its private IP ranges accordingly.

### Pattern 4: Explicit Proxy Instead of Forced Tunneling

Azure Firewall runs as a transparent proxy by default, reached by UDR. [Explicit proxy mode](https://learn.microsoft.com/en-us/azure/firewall/explicit-proxy){:target="_blank" rel="noopener noreferrer"} inverts that: applications point their proxy settings at the firewall's private IP, and traffic egresses through the firewall without any route table involvement. A PAC file can be hosted on the firewall itself, served from blob storage through a user-assigned managed identity.

**Where it fits:** environments that already configure proxies centrally, or where UDR management across many spokes is the larger problem.

**What it gives up:**
- HTTP and HTTPS only, so DNS, SMTP, and every other protocol are unfiltered
- Enforcement depends on client configuration, so a misconfigured application simply bypasses it
- It is configured on the firewall policy, so it applies to every firewall sharing that policy

Explicit proxy is a complement to forced tunneling, not a replacement for it. Most designs that adopt it still keep a default route to the firewall as the backstop.

---

## Common Pitfalls

### Pitfall 1: A Broad Network Rule Silently Disables FQDN Filtering

**Problem:** an allow rule for TCP 443 to the Internet service tag is added as a "fallback" alongside application rules that restrict destinations by FQDN.

**Result:** every HTTPS flow matches the network rule and terminates there. The application rules never run, and the firewall allows any HTTPS destination. The logs show network rule hits, so the configuration looks like it is working.

**Solution:** do not pair a broad network rule with application rules for the same traffic. Application rules need no network rule underneath. Reserve network rules for protocols application rules do not cover, and scope them to specific destinations.

---

### Pitfall 2: Expecting the Firewall to Segment East-West Traffic

**Problem:** treating Azure Firewall as the whole answer and leaving NSGs permissive, or routing intra-VNet traffic through the firewall with a VNet-wide UDR.

**Result:** lateral movement between tiers goes uninspected, or, in the UDR case, traffic between two VMs in the same subnet is hairpinned through the firewall, adding latency and cost for no security benefit.

**Solution:** NSGs are the segmentation control, and Microsoft recommends them over UDRs for internal segmentation. If a VNet-wide UDR is unavoidable, add a more specific route for the local subnet with next hop type Virtual network. Note also that NSGs cannot be applied to `AzureFirewallSubnet`.

---

### Pitfall 3: TLS Inspection Breaking Pinned and Mutual TLS

**Problem:** enabling TLS inspection across all traffic without auditing which applications validate certificates themselves.

**Result:** pinned clients reject the firewall's minted certificate and mutual-TLS handshakes fail. The failures look like intermittent connectivity rather than a policy decision.

**Solution:** inventory pinning and mutual TLS before enabling inspection, and create bypass rules for those destinations. Track the bypass list, because each entry is traffic you are paying to inspect and not inspecting.

---

### Pitfall 4: Asymmetric Routing from Half-Configured UDRs

**Problem:** routing one direction of a flow through the firewall and leaving the return path direct.

**Result:** the firewall sees one side of a connection it has no state for and drops it. Symptoms are timeouts on some flows and not others, which is hard to attribute.

**Solution:** UDRs apply to traffic leaving a subnet, so both ends need their own route. Add routes on the spoke subnets *and* on the GatewaySubnet, and make sure on-premises routing sends Azure-bound traffic to the same firewall.

---

### Pitfall 5: Sizing Premium Against the SKU Maximum

**Problem:** planning capacity from the 100 Gbps Premium headline while running TLS inspection and IDPS.

**Result:** both features consume CPU, the effective ceiling is well below the maximum, and scale-out takes five to seven minutes once triggered at 60% utilization.

**Solution:** size against Microsoft's published performance figures for the features you have enabled, not the SKU maximum. Load test for at least 10 to 15 minutes with new connections, so the test actually exercises scaled-out nodes.

---

### Pitfall 6: Expecting DDoS Protection to Be Instant or Tunable

**Problem:** enabling a paid DDoS tier shortly before launch and treating it as an on/off shield, or planning to hand-tune thresholds if the profile is wrong.

**Result:** mitigation engages only once a policy threshold is crossed, and thresholds are machine-learned from observed traffic, so a service with no traffic history is protected by an untuned profile. There is no manual override to fall back on: policy customization, allowlists, and blocklists are all unavailable.

**Solution:** enable protection well before the traffic you want profiled arrives, and design the application to absorb the window before mitigation engages. A single VM behind a public IP with no ability to scale out is the case Microsoft explicitly calls out as supported but not recommended.

---

### Pitfall 7: Wildcard FQDN Rules That Match More Than Intended

**Problem:** writing `*contoso.com` when `*.contoso.com` was meant, or writing `*.contoso.com` and expecting it to cover the apex domain.

**Result:** the first allows `th3re4lcontoso.com` and any other name ending in that string. The second silently blocks `contoso.com` itself.

**Solution:** always include the dot in a wildcard FQDN, and list the apex domain separately when it is needed. Review existing rules for leading asterisks without a dot, which are an egress allow list an attacker can register into.

---

## Key Takeaways

1. **There are three SKUs, and Basic is not a cheaper Standard.** Basic caps at 250 Mbps, cannot deny on threat intelligence, and has no DNS proxy. Standard is the floor for most enterprise designs.

2. **Rule order is fixed by type, not by your priorities.** Threat intelligence runs first and can block before any rule. Then DNAT, then network, then application. A network rule match stops processing, which is why a broad `Allow 443 to Internet` rule disables FQDN filtering.

3. **Application rules do not filter inbound traffic.** Azure Firewall handles inbound with DNAT at layers 3-4. Layer 7 inbound protection is a WAF, on Front Door or Application Gateway.

4. **Threat intelligence in Alert and Deny mode is the highest-value single setting.** It costs almost nothing in performance and blocks commodity malware destinations without deep packet inspection.

5. **Premium's cost is CPU, not list price.** The fixed hourly charge is 40% above Standard. TLS inspection and IDPS are what actually consume the budget, in throughput and in certificate and false-positive operations.

6. **A Firewall Policy is a shared resource.** One policy attaches to many firewalls across regions and subscriptions, parent rules always beat child rules, and NAT rules are the one type that is never inherited.

7. **Virtual WAN does not inspect spoke-to-spoke traffic until routing intent is enabled.** The firewall sits in the hub either way, but private traffic bypasses it by default.

8. **DDoS Protection is layers 3 and 4 only.** No tier stops an HTTP flood. Application-layer attacks need a WAF with rate limiting, in front of the application.

9. **The DDoS tier choice is roughly a 15-IP break-even**, with Network Protection also carrying Rapid Response, cost protection, and the Application Gateway WAF discount that offsets much of its plan fee.

10. **NSGs remain the segmentation control.** Azure Firewall is an egress and perimeter chokepoint. Microsoft recommends NSGs, not firewall UDRs, for internal segmentation between tiers.
