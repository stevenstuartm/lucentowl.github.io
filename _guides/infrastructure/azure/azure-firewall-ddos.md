---
title: "Azure Firewall and DDoS Protection"
layout: guide
category: Azure
subcategory: Security and Compliance
description: "A system architect's guide to Azure Firewall and DDoS Protection covering network security, traffic filtering, threat intelligence, distributed denial-of-service mitigation, and Firewall Manager for centralized policy management."
tags: [azure, security, networking, infrastructure, cloud-computing, reliability, scalability, practical]
---

## What Is Azure Firewall

[Azure Firewall](https://learn.microsoft.com/en-us/azure/firewall/overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's first-party firewall service built into Azure networking. Unlike Network Security Groups (NSGs) which provide basic stateful filtering at layers 3-4, Azure Firewall offers application-level inspection, threat intelligence integration, and centralized policy management across your entire Azure estate.

### What Problems Azure Firewall Solves

**Without Azure Firewall:**
- NSGs provide only layer 3-4 filtering (IP, port, protocol)
- No visibility into application-layer protocols (HTTP headers, DNS queries, TLS certificates)
- No centralized firewall policy across multiple VNets or hybrid environments
- Threat intelligence integration requires manual configuration
- No advanced threat protection for DDoS, malware, or intrusion patterns
- Each team manages NSGs independently, leading to inconsistent security policies
- No logging or alerting on blocked traffic crossing the network perimeter

**With Azure Firewall:**
- Application-layer inspection of HTTP, HTTPS, DNS, and other protocols
- Centralized policy management across hub VNets, spokes, and on-premises networks
- Threat intelligence automatically blocks known malicious IP addresses and domains
- Intrusion Detection and Prevention System (IDPS) signatures for advanced threats
- Application rules that reference FQDNs or tags, not just IPs and ports
- Consistent security posture across all network traffic
- Detailed logging and alerting for compliance and troubleshooting

### How Azure Firewall Differs from AWS Equivalents

Architects familiar with AWS should note the architectural and feature differences:

| Aspect | AWS | Azure |
|--------|-----|-------|
| **Primary firewall** | AWS Network Firewall or third-party NVAs | Azure Firewall (managed service) |
| **Centralized management** | AWS Firewall Manager (for Security Groups + Network Firewall) | Azure Firewall Manager (for firewalls + NSGs + WAF) |
| **Threat intelligence** | GuardDuty (findings service) or third-party integrations | Built into Azure Firewall; auto-updates threat feeds |
| **Application inspection** | Network Firewall supports domain list filtering | Azure Firewall Premium with IDPS and TLS inspection |
| **DDoS protection** | AWS Shield (Basic free, Standard paid) | Azure DDoS Protection (Basic free, Standard paid) |
| **Hub-and-spoke firewall** | Network Firewall in VPC with NLB, routing via TGW | Azure Firewall in hub VNet with UDRs |
| **Hybrid inspection** | Network Firewall in VPC, manual on-premises routing | Single firewall inspects cloud and on-premises traffic |
| **Deployment model** | Per-region in VPCs | Per-hub VNet or per-region in Virtual WAN hubs |

---

## Azure Firewall SKUs: Standard vs Premium

Azure Firewall comes in two tiers with increasing capabilities and cost. The choice depends on your threat model and inspection requirements.

### Standard SKU

The Standard SKU provides foundational firewall capabilities sufficient for most organizations:

**Capabilities:**
- Network rules (layers 3-4: IP, port, protocol filtering)
- Application rules (FQDNs, HTTP/HTTPS headers, tags)
- NAT rules for inbound translation (DNAT)
- Threat intelligence for known malicious IPs and domains (auto-updated by Microsoft)
- Stateful inspection and session tracking
- Built-in DDoS protection (layer 3-4 only)
- Centralized logging to Log Analytics or Storage
- Zone-redundant deployment (no need to configure per-zone)
- Scales to 30 Gbps throughput

**When Standard is sufficient:**
- Most enterprise networks without advanced threat modeling
- Organizations focused on lateral movement prevention and perimeter filtering
- Workloads without compliance requirements for deep packet inspection
- Teams without dedicated security operations for signature tuning

### Premium SKU

The Premium SKU adds advanced threat inspection and is necessary for security-critical or highly regulated environments:

**Additional capabilities over Standard:**
- **Intrusion Detection and Prevention System (IDPS):** Signature-based detection of known attacks and malicious patterns
- **TLS inspection:** Decrypts and inspects encrypted HTTPS traffic (requires certificate provisioning)
- **URL filtering:** Block or allow traffic based on URL categories (e.g., social media, adult content, gambling)
- **Web categories:** Pre-defined categories for bulk policy simplification
- **Private certificate support:** Bring your own root CA for TLS decryption in hybrid environments
- **Advanced threat intelligence:** Malware and botnet signatures in addition to IP blocklists

**When Premium is necessary:**
- Compliance mandates (PCI-DSS, HIPAA, SOC 2) requiring encrypted traffic inspection
- Environments with strict data exfiltration prevention requirements
- Organizations implementing Zero Trust architecture with encrypted baseline assumption
- Advanced threat hunting or forensic investigation needs

**Trade-offs of Premium:**
- 3-5x cost increase over Standard
- TLS decryption adds latency and CPU overhead
- Certificate management complexity (private root CA provisioning and rotation)
- Not all traffic is inspectable (authenticated TLS with certificate pinning cannot be decrypted)

---

## Azure Firewall Rule Types

Azure Firewall evaluates rules in a specific priority order. Understanding this order is critical to policy design.

### Rule Evaluation Order

Azure Firewall evaluates rules in this order, and stops at the first match:

1. **NAT rules** (inbound, destination translation)
2. **Network rules** (layers 3-4)
3. **Application rules** (layer 7)
4. **Threat intelligence** (if enabled, blocks known malicious IPs/domains after other rules allow)

If no rules match, traffic is denied by default.

### NAT Rules

NAT rules perform Destination Network Address Translation (DNAT) on inbound traffic, converting the destination address from the firewall's public IP to a private IP in your network.

**Use case:** Exposing a private web server to the internet.

**Example:**
- External traffic arrives at firewall's public IP (1.2.3.4) on port 443
- NAT rule translates destination to private web server (10.0.1.10:443)
- Return traffic automatically translates back to 1.2.3.4

**Important characteristics:**
- Only for inbound (from the internet or on-premises)
- Processed before network and application rules
- One public IP:port combination per NAT rule (cannot have overlapping destinations)
- Symmetric: return traffic is automatically translated

### Network Rules

Network rules operate at layers 3-4 and filter based on source IP, destination IP, port, and protocol (TCP, UDP, ICMP).

**Use case:** Allowing outbound internet access for VMs in a spoke VNet through the hub firewall.

**Example rule:**
- Source: `10.1.0.0/16` (spoke VNet)
- Destination: `Internet` service tag
- Protocol: TCP, UDP
- Port: 443 (HTTPS)
- Action: Allow

**Characteristics:**
- Evaluated before application rules
- Use service tags for broad groupings (VirtualNetwork, Internet, Storage, Sql, AzureMonitor)
- Use IP address prefixes or CIDR ranges for specific filtering
- Support all protocols including non-standard ones
- Lower CPU overhead than application rules

### Application Rules

Application rules filter based on application-layer data: FQDNs, HTTP headers, protocols. They only apply to HTTP, HTTPS, and DNS traffic.

**Use case:** Allowing outbound access to specific websites (e.g., `microsoft.com`).

**Example rule:**
- Source: `10.1.0.0/16` (spoke VNet)
- Protocol: HTTPS
- FQDN: `*.microsoft.com`
- Action: Allow

**Characteristics:**
- Support wildcard domains (e.g., `*.microsoft.com`, `api-*.prod.contoso.com`)
- Can reference Azure tags (e.g., resources tagged `Environment:Production`)
- Have higher CPU cost than network rules (require protocol parsing)
- Require network rules to allow the underlying transport (network rules for TCP 443 if application rule targets HTTPS)
- DNS application rules can block DNS queries to specific domains

**FQDN Filtering:**
Azure Firewall resolves FQDNs to IP addresses at rule evaluation time. This adds latency but enables dynamic filtering even if a domain changes IPs. For high-volume filtering or performance-critical paths, use network rules with IP blocks instead.

---

## Threat Intelligence and Intrusion Detection

### Threat Intelligence Modes

Azure Firewall integrates Microsoft's threat intelligence feeds, automatically blocking traffic to known malicious destinations.

**Off:** Threat intelligence is disabled.

**Alert mode:** Firewall logs and alerts on traffic to known malicious IPs/domains but allows it to pass. Useful for monitoring before enabling block mode.

**Alert and Deny mode:** Firewall blocks traffic to known malicious destinations. This is the recommended configuration for production networks.

**Characteristics:**
- Microsoft updates threat feeds automatically (no manual signature updates needed)
- Includes IP blocklists, malware signatures, and botnet C2 domains
- Applies to both inbound and outbound traffic
- Incurs minimal performance penalty

### IDPS (Intrusion Detection and Prevention System) - Premium Only

The Premium SKU includes IDPS, which inspects traffic for attack patterns and known exploits. IDPS uses Snort-like rule signatures and detects layer 7 attacks (SQL injection, buffer overflows, etc.).

**IDPS modes:**
- **Off:** No intrusion detection
- **Alert:** Log and alert on detected attacks
- **Alert and Deny:** Block traffic matching attack signatures

**Characteristics:**
- CPU-intensive; enabling IDPS reduces firewall throughput
- Signature-based detection (cannot detect zero-day attacks unknown to Snort signatures)
- Focuses on web application exploits, not infrastructure attacks
- Combined with TLS inspection (Premium) for visibility into encrypted attacks

**When to enable IDPS:**
- Compliance requirement mandates intrusion detection
- High-value targets with sophisticated threat actors
- Organizations with dedicated SOC teams to review IDPS alerts

**When to skip IDPS:**
- Performance is critical (IDPS adds significant CPU overhead)
- Workloads without application-layer exposure (internal services only)
- Teams without resources to investigate false positives

---

## TLS Inspection - Premium SKU

TLS inspection (also called SSL/TLS decryption) decrypts outbound HTTPS traffic for inspection, then re-encrypts it before sending to the destination. This is a Premium SKU feature and requires significant operational overhead.

### How TLS Inspection Works

1. **Certificate provisioning:** You deploy a root CA certificate to Azure Firewall (Standard root key provisioning or bring-your-own root CA)
2. **Interception:** When a client connects to `api.example.com`, the firewall intercepts the TLS handshake
3. **Certificate generation:** Firewall dynamically generates a leaf certificate for `api.example.com` signed by the provisioned root CA
4. **Client handshake:** Client receives the firewall-generated certificate
5. **Server connection:** Firewall connects to the real `api.example.com` server
6. **Inspection:** Firewall inspects unencrypted traffic (HTTP headers, body content)
7. **Re-encryption:** Firewall re-encrypts data and sends to client

### When to Enable TLS Inspection

**Enable TLS inspection when:**
- Compliance mandates encrypted traffic inspection (HIPAA, PCI-DSS, SOC 2)
- Data exfiltration prevention requires content inspection of HTTPS traffic
- Malware detection needs to inspect encrypted payloads
- Organization operates as a regulated intermediary

**Do NOT enable TLS inspection when:**
- Client certificate pinning is used (clients validate the server certificate; intercepted certificates fail pinning validation)
- APIs use certificate-based mutual TLS authentication
- Performance is critical (TLS inspection adds 20-50% latency increase)
- Clients are external parties that do not trust your root CA

### TLS Inspection Trade-offs

- **Certificate management:** You become a de facto certificate authority. Certificate renewal, key rotation, and disaster recovery all become your responsibility
- **Client behavior:** Clients without your root CA installed will see certificate warnings or connection failures
- **Performance impact:** TLS decryption/re-encryption is computationally expensive; throughput decreases significantly
- **False positives:** Legitimate encrypted protocols (not HTTPS) may be incorrectly inspected, causing application failures
- **Pinning incompatibility:** Applications using certificate pinning will not work through TLS inspection

---

## Azure Firewall Manager: Centralized Policy

Azure Firewall Manager enables centralized management of firewall policies, NSGs, and WAF rules across multiple Azure Firewall instances and subscriptions.

### Secured Virtual Hubs vs Traditional Hub-and-Spoke

Azure Firewall can be deployed in two topologies: traditional hub-and-spoke VNets or Secured Virtual Hubs within Virtual WAN.

**Traditional Hub-and-Spoke (with Firewall Manager):**
- Azure Firewall deployed in a central hub VNet
- Spoke VNets peered with the hub
- UDRs in spokes force traffic through the hub firewall
- Firewall Manager provides centralized policy, but routing must be manually configured
- Suitable for simpler topologies with <20 spokes

**Secured Virtual Hubs (Virtual WAN):**
- Azure Firewall deployed in a Virtual WAN hub
- Spokes connect via Virtual Network Connections (not peering)
- Routing is automatic; traffic flows through firewall by default
- Firewall Manager integrates natively with Virtual WAN
- Suitable for large-scale environments with many spokes or multi-region deployments
- See the [Virtual WAN & Private Link](/study-guides/infrastructure/azure/azure-private-link-virtual-wan.html) guide for detailed patterns

### Firewall Policies

A Firewall Policy is a collection of rule collections that can be applied to one or more Azure Firewall instances. Policies support inheritance and hierarchical organization.

**Policy structure:**
- Base policy (shared rules for all firewalls)
- Rule collection groups (organization unit for rules)
- Rule collections (NAT, Network, or Application rules)
- Rules (individual allow/deny statements)

**Advantages of Firewall Policies:**
- **Reusability:** One policy applied to multiple firewalls across regions or subscriptions
- **Inheritance:** Child policies inherit rules from parent policies, allowing variable policy stacking (base + team-specific + compliance rules)
- **Versioning:** Policies can be versioned for audit trails
- **Centralized management:** One team (security) defines policies; other teams apply them to their firewalls
- **Separation of concerns:** Policy and firewall instances are decoupled resources

**Example hierarchy:**
```
Base Policy (Enterprise-wide rules)
├── Deny known ransomware IPs
├── Deny high-risk countries
├── Allow common enterprise SaaS (Microsoft 365, GitHub)
├── Parent Policy - Finance
│   └── Child Policy - Finance-Production
│       └── Finance-specific rules (banking APIs, compliance logging)
├── Parent Policy - Engineering
    └── Child Policy - Engineering-Development
        └── Engineering-specific rules (Docker Hub, GitHub, npm registry)
```

### Deploying Firewall Policies

A single Firewall Policy instance cannot be applied to multiple firewalls. Instead, you create a policy and assign it to a firewall during creation or update. For multi-firewall environments, use:

1. **Firewall Manager template:** Deploy and configure policies across multiple firewalls simultaneously
2. **Policy inheritance:** Define a base policy; other policies inherit and extend it
3. **Infrastructure-as-Code (Bicep/Terraform):** Parameterize policies and deploy consistently across regions

---

## NSG vs Azure Firewall vs WAF: Layered Security

Web applications and network infrastructure on Azure require multiple layers of protection. Each tool addresses different threats and network layers.

### Comparison: NSG vs Azure Firewall vs WAF

| Aspect | NSG | Azure Firewall | WAF (Web Application Firewall) |
|--------|-----|---|---|
| **Network layer** | Layer 3-4 (IP, port, protocol) | Layer 3-7 (can inspect application protocols) | Layer 7 (HTTP/HTTPS only) |
| **Traffic direction** | Subnet/NIC boundary filtering | Perimeter (hub firewall) | Application endpoint (Application Gateway/Front Door) |
| **Rule type** | IP/port/protocol | IP/port/protocol + FQDN + threat intel | URI paths, HTTP headers, request body (SQL injection, XSS) |
| **Throughput** | High (minimal overhead) | Medium (depends on SKU and inspection depth) | Medium (depends on WAF rules) |
| **Cost model** | Minimal per-rule cost | Per-firewall per-hour + per-GB data | Per-endpoint + per-rule |
| **Primary use** | Subnet isolation, lateral movement prevention | Perimeter inspection, threat intelligence blocking | Application attack prevention |
| **Scope** | Resources in a subnet/NIC | Hub-and-spoke networks, hybrid environments | Traffic to a specific application |
| **Scalability** | Unlimited rules per NSG | ~30 Gbps per firewall (Standard), higher with Premium | Depends on WAF provider (Application Gateway, Front Door) |

### When to Use Each Layer

**NSG (Layer 3-4):**
- Segment your network by trust zones (frontend, app, data subnets)
- Prevent lateral movement between tiers
- Default deny policy: deny all, allow only necessary traffic
- Example: Allow port 3306 from app subnet only to database subnet

**Azure Firewall (Perimeter):**
- Hub-and-spoke topology requires centralized inspection
- Threat intelligence blocking of malicious IPs/domains
- Application-layer filtering by FQDN or tags
- Hybrid environments (Azure + on-premises) need single inspection point
- Example: Block outbound access to known ransomware C2 domains

**WAF (Application Layer):**
- Protect internet-facing web applications
- Block injection attacks (SQL injection, command injection)
- Enforce request patterns (valid HTTP methods, header validation)
- Rate limiting for brute-force protection
- Example: Block HTTP requests with SQL keywords in query strings

**Three-layer example architecture:**
```
Internet
   ↓
WAF (Application Gateway) - blocks SQL injection, XSS, bot attacks
   ↓
Azure Firewall (Hub) - blocks known malicious IPs, enforces application rules
   ↓
NSG (Subnet) - lateral movement prevention between frontend and app tiers
   ↓
Application
```

---

## Azure DDoS Protection

Distributed Denial of Service (DDoS) attacks overwhelm your application by flooding it with traffic from many sources simultaneously. Azure DDoS Protection mitigates these attacks automatically.

### DDoS Protection Plans: Basic vs Standard

**Basic Plan (Free):**
- Automatically enabled on all Azure public IPs
- Protects against layer 3-4 DDoS attacks (volumetric attacks like UDP floods)
- No additional cost
- No customization or alerting

**Standard Plan (Paid):**
- Enhanced protection against layer 3-4 and layer 7 attacks
- DDoS Response Team (DRT) available 24/7 during active attacks
- Per-attack incident cost mitigation (credit if proven attack occurred)
- Adaptive tuning: protection baseline learned from your typical traffic pattern
- Advanced metrics and alerting
- Cost: fixed monthly + per protected public IP

### Volumetric vs Protocol vs Application Attacks

**Volumetric attacks (layer 3-4):**
- UDP floods, DNS amplification, ICMP floods
- Goal: consume all available bandwidth
- Protected by both Basic and Standard DDoS Protection

**Protocol attacks (layer 4):**
- SYN floods, fragmented packets, invalid packets
- Goal: exploit protocol weaknesses to crash services
- Protected by both Basic and Standard DDoS Protection

**Application-layer attacks (layer 7):**
- HTTP floods, slowloris attacks, bot-driven request floods
- Goal: exhaust application resources without bulk data transfer
- Protected by Standard DDoS Protection with advanced rules
- Often require WAF rules in addition to DDoS Protection

### Adaptive Tuning

Azure DDoS Protection Standard learns your normal traffic baseline over time, then dynamically adjusts detection thresholds. This reduces false positives and adapts to legitimate traffic growth.

**How adaptive tuning works:**
1. Firewall monitors your application's baseline traffic (packet rate, protocol distribution, geographic sources)
2. Over 7-10 days, a statistical model of "normal" traffic is established
3. Detection thresholds are set above the learned baseline
4. Anomalies exceeding the threshold are flagged as potential attacks
5. Baseline is continuously updated as legitimate traffic changes

**Benefits:**
- Fewer false positives than static threshold-based detection
- Detects attacks that might exceed static thresholds but exceed your baseline
- Automatically accommodates business growth and traffic pattern changes

### DDoS Response Team (DRT)

Standard DDoS Protection includes access to the Microsoft DDoS Response Team during active attacks.

**What DRT provides:**
- On-call 24/7 during active, confirmed DDoS attacks
- Attack analysis and real-time mitigation recommendations
- Temporary firewall rule deployment for attack-specific mitigation
- Post-attack forensics and analysis
- Not available during false positives or low-severity incidents

**Activation:**
- Only triggered if the attack is severe enough to cause service degradation
- Requires DDoS Protection Standard enabled
- Requires explicit opt-in to contact DRT during incidents

---

## Architecture Patterns: Azure Firewall Deployment

### Pattern 1: Hub-and-Spoke with Forced Tunneling

The most common enterprise pattern. All internet-bound traffic from spoke VNets is forced through a central Azure Firewall in the hub VNet.

```
Hub VNet (10.0.0.0/16)
├── AzureFirewallSubnet (10.0.1.0/26) → Azure Firewall
├── GatewaySubnet (10.0.2.0/27) → VPN/ExpressRoute
├── AzureBastionSubnet (10.0.3.0/26)
└── Management Subnet (10.0.4.0/24)

Spoke VNet 1 (10.1.0.0/16) ←peered→ Hub
├── Web Subnet (10.1.1.0/24) → UDR: 0.0.0.0/0 → Firewall (10.0.1.4)
├── App Subnet (10.1.2.0/24) → UDR: 0.0.0.0/0 → Firewall (10.0.1.4)
└── Data Subnet (10.1.3.0/24)

Spoke VNet 2 (10.2.0.0/16) ←peered→ Hub
└── (similar structure)
```

**How traffic flows:**
1. VM in `10.1.2.0/24` initiates outbound connection to Internet (e.g., HTTPS to Microsoft.com)
2. UDR matches `0.0.0.0/0` and redirects to firewall at `10.0.1.4`
3. Azure Firewall evaluates application and network rules
4. If allowed, firewall establishes outbound connection and proxies traffic
5. Response traffic returns through firewall

**Firewall rules needed:**
- Application rule: allow HTTPS to `*.microsoft.com`
- Network rule: allow TCP 443 to Internet (fallback if FQDN matching fails)

**Trade-offs:**
- All traffic funnels through single firewall (throughput bottleneck)
- Firewall becomes critical component (must be zone-redundant or duplicated)
- Adds latency to all outbound traffic
- Requires careful UDR management to avoid routing loops
- **Benefit:** Centralized policy, no shadow IT, visibility into all outbound traffic

### Pattern 2: Multi-Region Hub-and-Spoke with Virtual WAN

For organizations with multiple regions and many spokes, Virtual WAN provides automated hub-and-spoke connectivity and integrated Azure Firewall.

```
Virtual WAN

Hub (East US)
├── Virtual Hub (automatic routing)
├── Azure Firewall (integrated)
├── Spoke connections (automatic)
└── ExpressRoute/VPN gateway (integrated)

Hub (West US)
├── Virtual Hub (automatic routing)
├── Azure Firewall (integrated)
└── Spoke connections (automatic)

Inter-hub routing: Automatic (hubs route to each other)
```

**How routing differs from traditional hub-and-spoke:**
- Virtual WAN provides automatic hub-to-hub routing (no peering or UDRs needed)
- Firewall is integrated into the hub (no separate firewall subnet or NAT translation)
- Spoke-to-spoke traffic automatically routes through the hub firewall
- Multi-region connectivity is native (hubs are automatically meshed)

**Benefits over traditional hub-and-spoke:**
- No peering to configure or maintain
- No UDRs to manage in every spoke
- Automatic failover if one hub becomes unavailable
- Scales to 1000+ spokes per hub
- Multi-region deployment is trivial

**For detailed Virtual WAN architecture, see the [Virtual WAN & Private Link](/study-guides/infrastructure/azure/azure-private-link-virtual-wan.html) guide.**

### Pattern 3: Hybrid (Cloud + On-Premises) with Centralized Firewall

Large organizations often need to inspect traffic between Azure and on-premises data centers. A single Azure Firewall in a hub VNet can serve as the inspection point for both cloud-to-cloud and cloud-to-on-premises traffic.

```
On-Premises Data Center
   ↓ (VPN or ExpressRoute)
Hub VNet GatewaySubnet
   ↓
Azure Firewall
   ↓ (UDRs)
Spoke VNets + Local Internet
```

**How it works:**
1. On-premises network establishes VPN or ExpressRoute to hub's GatewaySubnet
2. Routes for on-premises address space point to the firewall (not directly to the gateway)
3. Cloud resources route `0.0.0.0/0` through the firewall
4. All traffic (cloud-to-cloud, cloud-to-internet, on-prem-to-cloud) flows through the firewall for inspection

**Configuration:**
- Create a route table for the hub's internal subnet
- Add UDR: destination = on-premises CIDR, next hop = firewall NIC
- Associate route table to hub internal subnet
- Spoke VNets use UDRs: destination = on-premises CIDR, next hop = firewall (and firewall NATs the response)

**This pattern is complex and requires careful UDR ordering to avoid asymmetric routing.**

### Pattern 4: Firewall as Internal Load Balancer (No Forced Tunneling)

Some organizations prefer explicit application-layer firewall rules over forced tunneling, deploying Azure Firewall as an internal application-level filter rather than a perimeter device.

**Use case:** Microservices environment where applications explicitly connect through the firewall.

**How it differs:**
- No UDRs forcing traffic through firewall
- Applications configure the firewall's private IP as an HTTP/HTTPS proxy
- Firewall acts like a web proxy (intercepts at application layer, not network layer)
- Only applicable to HTTP/HTTPS traffic (cannot filter SMTP, DNS, etc.)

**Benefits:**
- Firewall becomes an opt-in component (only traffic that needs it goes through)
- Lower latency for traffic that bypasses firewall
- Simpler routing configuration

**Drawbacks:**
- Requires application changes (proxy configuration)
- Does not protect non-HTTP protocols
- Easy to bypass if applications are misconfigured
- Does not scale to large enterprises with many teams

---

## Common Pitfalls

### Pitfall 1: Firewall Rules Allow Everything by Default

**Problem:** Creating firewall policies with "allow" rules but no default deny. Teams add specific allow rules but forget that any traffic not matching a deny rule is implicitly allowed.

**Result:** Unintended outbound traffic flows through the firewall and reaches the internet (malware callbacks, data exfiltration, etc.).

**Solution:** Azure Firewall denies by default if no rules match. Do NOT create a catch-all "allow Internet" rule at the end of your application rules. Instead, whitelist only necessary destinations. For network rules, explicitly add a low-priority "deny Internet" rule to catch misconfigured traffic.

---

### Pitfall 2: Forgetting NSGs When Using Azure Firewall

**Problem:** Deploying Azure Firewall for perimeter protection while neglecting NSG rules at the subnet level.

**Result:** Firewall blocks inbound traffic correctly, but NSGs at the subnet/NIC level block it again (redundant blocking) or allow traffic the firewall denies (gaps in coverage).

**Solution:** Use both NSGs and firewall. NSGs provide subnet-level isolation (preventing lateral movement). Azure Firewall provides perimeter inspection (blocking malicious IPs, enforcing FQDN policies). Both layers together provide defense in depth.

---

### Pitfall 3: TLS Inspection Breaking Client-to-Server TLS

**Problem:** Enabling TLS inspection on firewall traffic that includes certificate pinning, mutual TLS, or other certificate-validation mechanisms.

**Result:** Clients cannot complete TLS handshakes because they don't trust the firewall-generated certificate. Legitimate traffic fails mysteriously.

**Solution:** Before enabling TLS inspection, audit your applications for certificate pinning, mutual TLS, or other certificate-dependent authentication. Create allowlist rules for these applications that bypass TLS inspection.

---

### Pitfall 4: UDRs Creating Asymmetric Routing

**Problem:** Configuring UDRs for outbound traffic to force it through the firewall, but forgetting return traffic.

**Result:** Outbound traffic goes through firewall, but return traffic takes a different path (possibly direct). This asymmetry can cause performance issues, application failures, or security policy violations.

**Solution:** UDRs apply to both inbound and outbound traffic when configured correctly. When you add a `0.0.0.0/0` route to the firewall, both outbound and inbound traffic use that route. For on-premises traffic, ensure your on-premises routing also points to the firewall for cloud-bound traffic (via VPN/ExpressRoute).

---

### Pitfall 5: Firewall Performance Degradation with Premium SKU

**Problem:** Enabling TLS inspection or IDPS on a Premium SKU firewall without load testing.

**Result:** Firewall throughput drops 30-50%, introducing latency and timeouts for legitimate traffic.

**Solution:** Test Premium SKU features in a non-critical environment first. Measure throughput impact before enabling in production. Use multiple firewall instances behind an internal load balancer if throughput becomes a bottleneck.

---

### Pitfall 6: DDoS Protection Standard Not Activated During Baseline Period

**Problem:** Enabling DDoS Protection Standard but not waiting the 7-10 day baseline learning period before expecting adaptive tuning to work correctly.

**Result:** Adaptive tuning is inaccurate, leading to false positives or false negatives in attack detection.

**Solution:** Activate DDoS Protection Standard at least 10 days before your critical workloads go live. Let the system learn normal traffic patterns. If you enable it only days before deployment, use static threshold rules instead.

---

### Pitfall 7: Firewall Manager Policy Inheritance Not Respected

**Problem:** Creating child policies that override parent policies without understanding inheritance order.

**Result:** Security rules intended by the parent policy are bypassed by overly permissive child policies.

**Solution:** Understand Firewall Manager policy hierarchy. Parent policy rules are evaluated first; child policies cannot add more permissive rules. If a parent policy denies a destination, child policies cannot allow it. Use policy inheritance to enforce non-bypassable baseline security (parent) while allowing team-specific customization (child).

---

## Key Takeaways

1. **Azure Firewall provides application-layer inspection that NSGs cannot.** NSGs filter by IP, port, and protocol. Azure Firewall filters by FQDN, HTTP headers, and threat intelligence. Both layers are necessary for defense in depth.

2. **Standard SKU is sufficient for most environments.** Premium is only necessary when compliance mandates TLS inspection or when advanced threat detection is worth the performance trade-off.

3. **Threat Intelligence is the highest ROI feature.** Enabling threat intelligence (Alert and Deny mode) blocks known malicious IPs and domains automatically. This catches the bulk of commodity malware without requiring deep packet inspection.

4. **Forced tunneling centralizes policy but adds latency.** UDRs that force all outbound traffic through the hub firewall enforce consistent policy across your environment, but introduce latency and create a bottleneck. Carefully measure the trade-off.

5. **TLS inspection is operationally expensive.** Decrypting and re-encrypting HTTPS traffic reduces throughput by 30-50%, increases latency, and requires certificate management overhead. Enable only when compliance explicitly requires it.

6. **Hub-and-spoke is the standard topology for Azure Firewall.** Centralize your firewall in a hub VNet, peer spokes, and use UDRs to force traffic through the firewall. This is the foundation of Azure Landing Zones.

7. **Firewall Manager enables policy reuse across regions and subscriptions.** Instead of managing firewall rules independently on each instance, define policies once and apply them globally. Use policy inheritance for baseline + team-specific rules.

8. **DDoS Protection Standard requires a baseline learning period.** Activate it 7-10 days before relying on adaptive tuning. During baseline, use static threshold rules if needed.

9. **Layer 7 attacks require both DDoS Protection AND WAF.** DDoS Protection Standard blocks volumetric attacks and protocol exploits, but application-layer attacks (HTTP floods, bot attacks) require a Web Application Firewall on top of DDoS Protection.

10. **NSGs remain the first line of defense for lateral movement.** Azure Firewall is a perimeter device; NSGs prevent lateral movement between subnets. Do not use firewall as a substitute for proper NSG configuration.
