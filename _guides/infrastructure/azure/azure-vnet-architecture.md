---
title: "Azure VNet: Network Architecture"
layout: guide
category: Azure
subcategory: Networking & Content Delivery
description: "VNet fundamentals for architects including subnets, NSGs, Application Security Groups, route tables, NAT Gateway, and multi-VNet patterns for building secure and scalable network architectures on Azure."
tags: [vnet, nsg, nat-gateway, private-endpoints, hub-spoke, vnet-peering, practical]
---

## What Is a Virtual Network

An [Azure Virtual Network](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview){:target="_blank" rel="noopener noreferrer"} (VNet) is a logically isolated network within Azure where you deploy and connect resources. Services like VMs, App Service Environments, AKS clusters, and most PaaS services that need network integration run inside a VNet.

A VNet is scoped to a single Azure region. Resources in different regions require separate VNets connected through VNet peering or Azure Virtual WAN.

### What Problems VNet Solves

**Without VNet:**
- No network isolation between applications or tenants
- No control over IP address ranges or routing
- No ability to implement network-level security policies
- No secure connectivity to on-premises data centers

**With VNet:**
- Network isolation for security and compliance boundaries
- Full control over IP address ranges (private address spaces)
- Granular security filtering through Network Security Groups at the subnet and NIC level
- Secure connectivity to on-premises networks through VPN Gateway or ExpressRoute
- Service integration through Private Endpoints, service endpoints, and subnet delegation

### How VNet Differs from AWS VPC

Architects familiar with AWS should note several important differences:

| Concept | AWS VPC | Azure VNet |
|---------|---------|------------|
| **Internet access** | Requires Internet Gateway attached to VPC | VMs with public IPs route to the internet by default (no gateway resource needed) |
| **Subnet visibility** | Subnets are "public" or "private" based on route tables | All subnets are private by default; public access depends on public IP assignment and NSG rules |
| **Firewall model** | Security Groups (instance) + NACLs (subnet) | NSGs apply at both subnet and NIC level; no separate NACL concept |
| **Outbound internet** | Requires NAT Gateway or IGW route | Default outbound access provided (but Microsoft is deprecating this for new resources; explicit NAT Gateway recommended) |
| **PaaS integration** | VPC endpoints (gateway/interface) | Service endpoints, Private Endpoints, and subnet delegation |
| **Address space** | Single primary CIDR, can add secondary | Multiple address space ranges from creation |
| **Scope** | Regional | Regional |

---

## Core VNet Components

Most of what follows attaches to either a subnet or a NIC, and which one determines what a control can express. This is the map:

```
VNet  (regional; address space 10.0.0.0/16)
│
├── Subnet: frontend  10.0.1.0/24
│     ├── NSG           0 or 1     one NSG can serve many subnets
│     ├── Route table   0 or 1     holds UDRs; can serve many subnets
│     ├── NAT Gateway   0 or 1     one gateway can serve many subnets
│     └── Delegation    0 or 1     locks the subnet to one PaaS service
│
└── Subnet: app  10.0.2.0/24
      ├── NSG           0 or 1
      │
      └── NIC (VM)  10.0.2.4
            ├── NSG     0 or 1     evaluated with the subnet NSG, not instead of it
            └── ASGs    0 or many  named in NSG rules as source/destination
```

The asymmetry drives much of what follows. NSGs are the only control that attaches at both levels, which is why their evaluation order needs its own explanation below. Route tables, NAT Gateways, and delegation attach to subnets only, so each one is a decision you make for every resource in the subnet at once. ASGs attach to NICs only, and they are never attached to an NSG at all. Rules reference them by name.

### Address Space

Every VNet has one or more address spaces that define the available IP address ranges. Unlike AWS VPCs (which start with a single primary CIDR block), Azure VNets can have multiple non-contiguous address ranges from creation.

**Address Space Rules:**
- Use RFC 1918 private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Azure also supports RFC 6598 shared address space: `100.64.0.0/10`
- Minimum size: /29 (8 addresses)
- Maximum size: /2 (theoretical, though practical VNets rarely exceed /16)
- Address spaces cannot overlap with other VNets you plan to peer
- Address spaces cannot overlap with on-premises ranges if you plan to connect via VPN or ExpressRoute
- You can add or remove address ranges after creation (without downtime), as long as no subnets use the range being removed

**Common Choices:**

| Address Space | Usable IPs | Use Case |
|---------------|-----------|----------|
| `10.0.0.0/16` | ~65,000 | Large production environments |
| `10.1.0.0/20` | ~4,000 | Medium workloads |
| `10.2.0.0/24` | ~250 | Small development or test environments |

<div class="callout callout--tip">
<p class="callout__title">Planning Tip</p>
<p>Plan address spaces across your entire Azure estate before creating VNets. CIDR overlaps between VNets prevent peering, and overlaps with on-premises ranges prevent hybrid connectivity. Many organizations maintain a central IP address management (IPAM) spreadsheet or use Azure's built-in IPAM feature in Virtual Network Manager.</p>
</div>

---

## Subnets

A subnet is a range carved from the VNet's address space. Resources like VMs, Private Endpoints, and load balancer frontends are deployed into subnets.

**Subnet Characteristics:**
- A subnet exists within a single VNet and cannot span VNets
- Subnets within a VNet cannot overlap
- Minimum size: /29 (8 addresses, 3 usable after Azure reservations)
- Maximum size: the entire VNet address space (though this is impractical)
- Subnets can be resized after creation if no resources conflict with the new range

### Reserved IPs

Azure reserves **five IP addresses** in every subnet:

| IP Address | Purpose |
|------------|---------|
| First IP (e.g., `10.0.1.0`) | Network address |
| Second IP (e.g., `10.0.1.1`) | Default gateway (Azure fabric router) |
| Third and fourth (e.g., `10.0.1.2`, `10.0.1.3`) | Azure DNS mapping to VNet address space |
| Last IP (e.g., `10.0.1.255`) | Broadcast address |

**Practical Impact:** A /24 subnet has 256 total IPs, but only 251 are usable (256 minus 5 reserved). A /29 subnet has 8 total IPs, but only 3 usable.

### Subnet Delegation

[Subnet delegation](https://learn.microsoft.com/en-us/azure/virtual-network/subnet-delegation-overview){:target="_blank" rel="noopener noreferrer"} reserves a subnet for a specific Azure PaaS service. When you delegate a subnet to a service, Azure allows that service to inject its resources into the subnet and create service-specific network rules.

**Common delegations:**

| Delegation | Purpose |
|-----------|---------|
| `Microsoft.Web/serverFarms` | App Service VNet integration |
| `Microsoft.Sql/managedInstances` | SQL Managed Instance deployment |
| `Microsoft.ContainerInstance/containerGroups` | Azure Container Instances |
| `Microsoft.Databricks/workspaces` | Azure Databricks VNet injection |
| `Microsoft.NetApp/volumes` | Azure NetApp Files |

**Delegation rules:**
- A delegated subnet can only contain resources from the delegated service (plus Private Endpoints in some cases)
- You cannot deploy regular VMs into a delegated subnet
- Only one service delegation per subnet
- Some services require specific minimum subnet sizes (SQL Managed Instance requires /27 or larger)

### Subnet Design Patterns

**By tier (most common for traditional architectures):**

| Subnet | CIDR | Purpose |
|--------|------|---------|
| `frontend` | `10.0.1.0/24` | Load balancers, Application Gateway |
| `app` | `10.0.2.0/24` | Application VMs or container hosts |
| `data` | `10.0.3.0/24` | Database VMs, Private Endpoints for PaaS databases |
| `management` | `10.0.4.0/27` | Jump boxes, bastion hosts, monitoring agents |
| `AzureBastionSubnet` | `10.0.5.0/26` | Azure Bastion (required name and minimum /26) |

**By workload (common for microservices):**

| Subnet | CIDR | Purpose |
|--------|------|---------|
| `aks-nodes` | `10.0.0.0/22` | AKS node pool (needs large range for pods) |
| `aks-ingress` | `10.0.4.0/27` | Internal load balancer for AKS ingress |
| `appgw` | `10.0.5.0/24` | Application Gateway (requires dedicated subnet) |
| `private-endpoints` | `10.0.6.0/24` | Private Endpoints for PaaS services |

<div class="callout callout--note">
<p class="callout__title">Named Subnet Requirements</p>
<p>Some Azure services require subnets with specific names. <code>AzureBastionSubnet</code> (for Azure Bastion), <code>GatewaySubnet</code> (for VPN/ExpressRoute gateways), and <code>AzureFirewallSubnet</code> (for Azure Firewall) must use these exact names. Plan for these in your subnet design.</p>
</div>

---

## Network Security Groups

### How NSGs Work

A [Network Security Group](https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview){:target="_blank" rel="noopener noreferrer"} (NSG) is a stateful firewall that filters network traffic to and from Azure resources. NSGs contain security rules that allow or deny traffic based on source, destination, port, and protocol.

**NSG Characteristics:**
- **Stateful:** If an inbound rule allows traffic, the response is automatically allowed regardless of outbound rules
- **Priority-based:** Rules are evaluated in order from lowest priority number (highest priority) to highest number; first matching rule wins
- **Applied at two levels:** Subnet and/or network interface (NIC)
- **Support allow and deny rules** (unlike AWS Security Groups which are allow-only)
- **Regional resource:** An NSG must be in the same region as the resources it protects

### Default Rules

Every NSG comes with three immutable default rules for each direction (inbound and outbound):

**Default inbound rules:**

| Priority | Name | Source | Destination | Action |
|----------|------|--------|-------------|--------|
| 65000 | AllowVnetInBound | VirtualNetwork | VirtualNetwork | Allow |
| 65001 | AllowAzureLoadBalancerInBound | AzureLoadBalancer | Any | Allow |
| 65500 | DenyAllInBound | Any | Any | Deny |

**Default outbound rules:**

| Priority | Name | Source | Destination | Action |
|----------|------|--------|-------------|--------|
| 65000 | AllowVnetOutBound | VirtualNetwork | VirtualNetwork | Allow |
| 65001 | AllowInternetOutBound | Any | Internet | Allow |
| 65500 | DenyAllOutBound | Any | Any | Deny |

The `VirtualNetwork` service tag includes the VNet address space, all connected on-premises address spaces (through VPN/ExpressRoute), and peered VNets. The `AllowInternetOutBound` default rule is why Azure resources can reach the internet by default.

### NSG Evaluation: Subnet vs NIC

When an NSG is applied at both the subnet and the NIC, both must allow the traffic for it to flow. The order they run in reverses with direction:

```
INBOUND  (source → VM)              OUTBOUND  (VM → destination)

   source                              VM
     ↓                                  ↓
  Subnet NSG ──deny──→ dropped       NIC NSG ──deny──→ dropped
     ↓ allow                            ↓ allow
  NIC NSG ──deny──→ dropped          Subnet NSG ──deny──→ dropped
     ↓ allow                            ↓ allow
    VM                               destination
```

The NSG closest to the VM is always the last one an inbound packet crosses and the first one an outbound packet crosses. Either way both must allow the traffic, so the order does not change *whether* a packet gets through. What it changes is which NSG records the deny, and that is exactly what you are reading when you go to the flow logs to find out why traffic disappeared.

**Best practice:** Apply NSGs at the subnet level for broad rules that apply to all resources in a subnet, and at the NIC level only when specific resources need different rules from their subnet peers. Many organizations use subnet-level NSGs exclusively to avoid complexity.

### Service Tags

[Service tags](https://learn.microsoft.com/en-us/azure/virtual-network/service-tags-overview){:target="_blank" rel="noopener noreferrer"} represent groups of IP address prefixes for Azure services, managed and updated automatically by Microsoft. Using service tags in NSG rules eliminates the need to track and update IP ranges for Azure services.

**Common service tags:**

| Service Tag | Represents |
|-------------|-----------|
| `VirtualNetwork` | VNet address space + peered VNets + on-premises ranges |
| `AzureLoadBalancer` | Azure's infrastructure load balancer |
| `Internet` | All IP addresses outside the VNet address space |
| `Storage` | Azure Storage IP ranges (can be region-scoped: `Storage.EastUS`) |
| `Sql` | Azure SQL Database IP ranges |
| `AzureActiveDirectory` | Entra ID IP ranges |
| `AzureMonitor` | Azure Monitor, Log Analytics, Application Insights |

### Example NSG Rules

**Web tier NSG (applied to frontend subnet):**

| Priority | Direction | Source | Destination | Port | Action | Purpose |
|----------|-----------|--------|-------------|------|--------|---------|
| 100 | Inbound | Internet | Any | 443 | Allow | HTTPS from internet |
| 110 | Inbound | Internet | Any | 80 | Allow | HTTP from internet (redirect to HTTPS) |
| 4096 | Inbound | Any | Any | Any | Deny | Deny all other inbound |

**App tier NSG (applied to app subnet):**

| Priority | Direction | Source | Destination | Port | Action | Purpose |
|----------|-----------|--------|-------------|------|--------|---------|
| 100 | Inbound | `10.0.1.0/24` | Any | 8080 | Allow | Traffic from frontend subnet only |
| 4096 | Inbound | Any | Any | Any | Deny | Deny all other inbound |

**Data tier NSG (applied to data subnet):**

| Priority | Direction | Source | Destination | Port | Action | Purpose |
|----------|-----------|--------|-------------|------|--------|---------|
| 100 | Inbound | `10.0.2.0/24` | Any | 1433 | Allow | SQL from app subnet only |
| 4096 | Inbound | Any | Any | Any | Deny | Deny all other inbound |

---

## Application Security Groups

### What ASGs Solve

[Application Security Groups](https://learn.microsoft.com/en-us/azure/virtual-network/application-security-groups){:target="_blank" rel="noopener noreferrer"} (ASGs) provide logical grouping of VMs and NICs for use in NSG rules. Instead of writing NSG rules with IP addresses or CIDR ranges, you reference ASGs as sources and destinations. This is conceptually similar to using AWS Security Groups as sources in other Security Group rules.

**ASGs are VNet-scoped.** An ASG groups NICs within a single virtual network, not across a subscription or a peered topology. Establish that up front, because it bounds the design: an ASG cannot express "all web servers everywhere," only "all web servers in this VNet." In a hub-and-spoke estate, that means per-VNet ASGs and per-VNet rules rather than one global grouping.

**Without ASGs:**
- NSG rules reference specific IP addresses or CIDR ranges
- When you add a new VM, you may need to update NSG rules with its IP
- Rules become hard to read and maintain as the environment grows

**With ASGs:**
- Create an ASG called `web-servers` and associate VM NICs with it
- Create an ASG called `app-servers` and associate VM NICs with it
- Write an NSG rule: allow traffic from `web-servers` to `app-servers` on port 8080
- When you add a new web server VM, associate its NIC with `web-servers` and the NSG rules automatically apply

**Example with ASGs:**

| Priority | Source | Destination | Port | Action |
|----------|--------|-------------|------|--------|
| 100 | ASG: `web-servers` | ASG: `app-servers` | 8080 | Allow |
| 110 | ASG: `app-servers` | ASG: `db-servers` | 1433 | Allow |
| 4096 | Any | Any | Any | Deny |

**ASG constraints:**
- All NICs in an ASG must be in the same VNet
- Source and destination ASGs in a rule must be in the same VNet
- An NSG rule can reference ASGs or CIDR ranges, but not both in the same rule
- A NIC can belong to multiple ASGs

---

## Routing

### How Routing Works

Azure automatically creates [system routes](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-udr-overview){:target="_blank" rel="noopener noreferrer"} that handle traffic within the VNet, between subnets, and to the internet. You can override or extend system routes with User Defined Routes (UDRs).

### System Routes

Azure creates the following system routes automatically:

| Destination | Next Hop | Purpose |
|-------------|----------|---------|
| VNet address space | VNet (local) | Traffic between subnets routes directly |
| `0.0.0.0/0` | Internet | Default internet route for outbound traffic |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | None (drop) | Drop traffic to RFC 1918 ranges outside VNet (prevents accidental routing) |

Additional system routes are created automatically when you enable features like VNet peering, VPN Gateway, or service endpoints.

### User Defined Routes (UDRs)

UDRs override system routes when you need custom traffic flow. A route table containing UDRs is associated with one or more subnets.

**Next hop types for UDRs:**

| Next Hop Type | When to Use |
|---------------|------------|
| **Virtual appliance** | Route traffic through an NVA like Azure Firewall for inspection |
| **Virtual network gateway** | Route traffic to on-premises through VPN/ExpressRoute gateway |
| **Virtual network** | Override the default system route within the VNet |
| **Internet** | Route specific traffic directly to the internet |
| **None** | Drop traffic (black-hole route) |

### Route Priority

When multiple routes match, Azure uses this evaluation order:

1. **User Defined Routes (UDRs)** take highest priority
2. **BGP routes** (from VPN Gateway or ExpressRoute) are next
3. **System routes** are the fallback

Within each category, the most specific (longest prefix match) route wins. A /24 route takes priority over a /16 route for traffic matching both.

**Exception:** Service endpoint routes cannot be overridden. When you enable a service endpoint on a subnet, Azure adds an optimal route for that service's traffic, and this route takes priority even over UDRs. This can cause confusion when trying to force service traffic through a network virtual appliance.

### Forced Tunneling

Forced tunneling redirects all internet-bound traffic (`0.0.0.0/0`) from a subnet to an on-premises network or network virtual appliance for inspection before reaching the internet.

**Common forced tunneling pattern:**

| Destination | Next Hop | Purpose |
|-------------|----------|---------|
| `0.0.0.0/0` | Virtual appliance (`10.0.4.4`) | All internet traffic goes through Azure Firewall |

**When to use forced tunneling:**
- Compliance requirements mandate traffic inspection before leaving the network
- Organization security policy requires centralized egress through a firewall
- DLP (Data Loss Prevention) inspection of outbound traffic

**Trade-offs:**
- Adds latency to all outbound traffic
- Azure Firewall or NVA becomes a potential bottleneck and single point of failure
- Some Azure services (like Azure Backup, Windows activation) require direct internet access and need exception routes

<div class="callout callout--tip">
<p class="callout__title">Azure Firewall vs NVA</p>
<p>Azure Firewall is Microsoft's managed firewall service that eliminates the operational overhead of managing NVA instances. For most organizations, Azure Firewall is the recommended choice over third-party NVAs unless you have specific feature requirements that only a third-party product satisfies.</p>
</div>

---

## NAT Gateway

### What NAT Gateway Does

[Azure NAT Gateway](https://learn.microsoft.com/en-us/azure/nat-gateway/nat-overview){:target="_blank" rel="noopener noreferrer"} provides outbound internet connectivity for resources in private subnets. It performs source network address translation (SNAT) so that outbound traffic uses the NAT Gateway's public IP address instead of the resource's private IP.

### Why NAT Gateway Matters

Azure is retiring default outbound internet access, and the mechanism is easy to over- or under-react to.

The change lands at the subnet level, not the VM level. In API versions released after March 31, 2026, subnets in **new** virtual networks default to private (`defaultOutboundAccess = false`), so VMs in them cannot reach public endpoints without an explicit outbound method. The Azure portal already defaulted to private subnets ahead of that. Existing virtual networks are untouched: VMs in them, including newly created ones, keep getting default outbound IPs until you make the subnet private yourself. You can still explicitly create nonprivate subnets if something genuinely depends on the old behavior.

The practical upshot is that new environments need explicit outbound connectivity through NAT Gateway, Azure Firewall, or a public IP on the resource, and older IaC pinned to earlier API versions will keep silently getting the old behavior until it is updated.

Even before this change, NAT Gateway is preferred over other outbound options because it avoids SNAT port exhaustion, a common problem when many VMs share Azure Load Balancer's outbound rules.

### How NAT Gateway Works

- NAT Gateway is associated with one or more subnets, and becomes the default next hop for their internet-bound traffic with no route configuration required
- All outbound traffic from associated subnets uses the NAT Gateway's public IP(s)
- Supports up to 16 public IP addresses, each providing 64,512 SNAT ports, so a single gateway scales past a million SNAT ports
- TCP idle timeout is configurable from 4 to 120 minutes (default 4 minutes). UDP is fixed at 4 minutes
- Cannot be attached to a `GatewaySubnet`, and each subnet can have at most one NAT Gateway

### SKUs and Zone Resiliency

This is the detail that most often gets designed wrong, because the two SKUs behave differently under zone failure:

| Aspect | Standard | StandardV2 |
|--------|----------|------------|
| **Availability zones** | **Zonal.** Deployed into one zone and resilient only within it | **Zone-redundant by default**, spanning zones in the region |
| **Throughput** | 50 Gbps per gateway resource, split 25 Gbps outbound / 25 Gbps inbound | 100 Gbps per gateway resource |
| **IP support** | IPv4 only, Standard public IPs | IPv4 and IPv6, requires StandardV2 public IPs |
| **Packets per second** | Up to 5 million | Up to 10 million |

A Standard NAT Gateway is **not** zone-redundant. If you deploy one without specifying a zone, it is *nonzonal*, meaning Azure picks the zone for you and a failure in that zone takes out outbound connectivity for every attached subnet, including VMs sitting in healthy zones. Microsoft explicitly recommends against nonzonal deployment for this reason.

For zone-resilient outbound, use **StandardV2**. If you are pinned to the Standard SKU, the alternative is a zonal stack per zone: a separate subnet, a zonal NAT Gateway, and VMs placed in the matching zone. Note that you cannot upgrade Standard to StandardV2 in place; it requires a redeploy onto new StandardV2 public IPs.

### NAT Gateway vs Other Outbound Options

| Outbound Method | SNAT Ports | Throughput | Management | Cost |
|----------------|------------|------------|------------|------|
| **NAT Gateway** | 64,512 per public IP | 50 Gbps (Standard) / 100 Gbps (StandardV2) per gateway | Managed. Zone-redundant only on StandardV2 | Hourly + per-GB data processed |
| **Load Balancer outbound rules** | Configurable, shared across backend pool | Varies | Manual SNAT port allocation | Included with LB |
| **VM public IP** | 64,000 (dedicated) | VM SKU dependent | Per-VM management | Per-IP cost |
| **Azure Firewall** | ~2,000 per IP | 30 Gbps | Managed, more features | Higher cost |

**Use NAT Gateway when:**
- Workloads need reliable outbound internet access at scale
- You experience SNAT port exhaustion with Load Balancer outbound rules
- You want zone-redundant outbound without managing individual public IPs
- You need predictable outbound IP addresses (for allowlisting by external services)

---

## Service Endpoints and Private Endpoints

Azure provides two mechanisms for connecting VNet resources to PaaS services (like Azure Storage, SQL Database, and Key Vault) without traversing the public internet.

### Service Endpoints

[Service endpoints](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoints-overview){:target="_blank" rel="noopener noreferrer"} extend the VNet identity to Azure PaaS services. When enabled on a subnet, traffic to the service travels over the Azure backbone instead of the public internet, and the PaaS service can restrict access to specific VNet subnets.

**How service endpoints work:**
1. Enable the service endpoint for a service (e.g., `Microsoft.Storage`) on a subnet
2. Azure adds an optimal route for that service's IP prefixes to the subnet's route table
3. Traffic from the subnet to the service uses the Azure backbone network
4. Configure the PaaS service's firewall to allow access from the VNet subnet

**Characteristics:**
- No cost (free to enable and use)
- The PaaS service's public endpoint still exists; service endpoints add an optimized route, not a private IP
- Source IP seen by the PaaS service switches from the VM's public IP to its private IP
- Service endpoint routes override UDRs for the service's IP prefixes

### Private Endpoints

[Private Endpoints](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview){:target="_blank" rel="noopener noreferrer"} are network interfaces deployed into your VNet that provide a private IP address for a specific PaaS resource. Traffic to the PaaS service uses the private IP within your VNet, never touching the public internet.

**How Private Endpoints work:**
1. Create a Private Endpoint for a specific resource (e.g., a particular storage account)
2. Azure provisions a NIC in your subnet with a private IP (e.g., `10.0.3.4`)
3. Configure [Private DNS Zones](https://learn.microsoft.com/en-us/azure/dns/private-dns-overview){:target="_blank" rel="noopener noreferrer"} so that `mystorageaccount.blob.core.windows.net` resolves to `10.0.3.4`
4. Applications connect using the standard FQDN with no code changes

**Characteristics:**
- Charged per hour + per-GB data processed
- Provides an actual private IP in your VNet
- Works across VNet peering and VPN/ExpressRoute (on-premises can reach Private Endpoints)
- The PaaS service's public endpoint can be disabled entirely
- NSGs can be applied to Private Endpoints for granular access control

### Service Endpoints vs Private Endpoints

The two are routinely conflated because both are described as "private access to PaaS." They are not the same shape. A service endpoint changes the *route* your traffic takes to the service's public endpoint; a Private Endpoint changes *what you connect to*:

```
SERVICE ENDPOINT — the target is still the service's public endpoint

  Subnet 10.0.2.0/24  (Microsoft.Storage endpoint enabled)
    VM 10.0.2.4
      │   DNS unchanged: mystorage.blob.core.windows.net → public IP
      │   source IP seen by Storage = 10.0.2.4, the VM's private IP
      ↓   optimized system route over the Azure backbone, not the internet
  Storage account PUBLIC endpoint
      service firewall: allow 10.0.2.0/24
      endpoint still exists, reachable by anything the firewall allows


PRIVATE ENDPOINT — the service gets a NIC inside your VNet

  Subnet 10.0.2.0/24               Subnet 10.0.3.0/24
    VM 10.0.2.4 ───────────────────→ Private Endpoint NIC 10.0.3.4
      DNS: mystorage.blob...           │
        → 10.0.3.4 (private zone)      │ Private Link
      traffic never leaves the VNet    ↓
                                     Storage account
                                     public endpoint can be disabled
```

That difference is what drives every row in the table below. Because a service endpoint's target is still a public endpoint, the service's own firewall is the only thing keeping anyone else out, and the grant is per subnet. Because a Private Endpoint's target is an ordinary NIC in your address space, everything that already works for private IPs, including peering, VPN, ExpressRoute, NSGs, and UDRs, works for it without special cases.

| Aspect | Service Endpoints | Private Endpoints |
|--------|-------------------|-------------------|
| **Cost** | Free | Hourly + data charges |
| **Private IP** | No (traffic uses optimized route, not private IP) | Yes (NIC with private IP in your subnet) |
| **On-premises access** | Not directly (only from VNet subnets) | Yes (via VPN/ExpressRoute + DNS resolution) |
| **Cross-VNet access** | Only from the subnet where enabled | Yes (via VNet peering) |
| **Public endpoint** | Still exists (cannot be fully disabled) | Can disable public endpoint entirely |
| **DNS** | No DNS change needed | Requires Private DNS Zone configuration |
| **NSG support** | Not applicable (route-level control) | Yes (NSGs can filter Private Endpoint traffic) |
| **Granularity** | Entire service in a region (e.g., all Storage in East US) | Specific resource (e.g., one storage account) |

**When to use which:**
- **Service endpoints:** Cost-sensitive workloads that only need VNet-to-PaaS access, without on-premises connectivity requirements and where the public endpoint remaining active is acceptable
- **Private Endpoints:** Security-sensitive workloads, on-premises access to PaaS services, or compliance requirements that mandate no public endpoint exposure

---

## Architectural Patterns

### Pattern 1: Simple Web Application

**Use case:** Small web application with a frontend tier and managed database.

Traffic arrives on a public IP attached to a load balancer or the VM itself, lands in the frontend subnet, and reaches the backend subnet only on the port the backend NSG permits from the frontend range. The database is never in the path from the internet at all, because it is reached through a Private Endpoint on a private IP.

**Components:**
- Single VNet with three subnets (frontend, backend, private-endpoints)
- Frontend NSG allowing 443 inbound from the internet; backend NSG allowing 8080 from the frontend subnet only
- Private Endpoint for Azure SQL (no public database endpoint)
- NAT Gateway on the backend subnet for outbound patching and API calls

**Trade-offs:**
- Simple to deploy and manage
- No high availability across zones
- Suitable for development, testing, or small production workloads

---

### Pattern 2: Multi-Tier with Availability Zones

**Use case:** Production application requiring zone redundancy.

```
Region (East US) — each subnet spans all three zones
│
├── Frontend Subnet (10.0.1.0/24)
│      Application Gateway (zone-redundant)   → Zone 1 │ Zone 2 │ Zone 3
│
├── App Subnet (10.0.2.0/24)
│      VM Scale Set instances (zone-spread)   → Zone 1 │ Zone 2 │ Zone 3
│
└── Data Subnet (10.0.3.0/24)
       Private Endpoint → Azure SQL (zone-redundant)
```

**Components:**
- Application Gateway (zone-redundant) in frontend subnet
- VM Scale Sets or AKS with zone spreading in the app subnet
- Azure SQL Database with zone-redundant configuration
- NAT Gateway on the StandardV2 SKU for outbound, which is the SKU that is actually zone-redundant. A Standard NAT Gateway here would reintroduce a single zonal failure point into an otherwise zone-redundant design
- NSGs on each subnet tier

Azure Availability Zones provide physically separate data centers within a region. Unlike AWS (where you create separate subnets per AZ), Azure subnets span all zones in a region. Zone redundancy is configured on the individual resources, not at the subnet level.

**Trade-offs:**
- Survives entire zone failure
- Higher cost (resources spread across zones)
- No cross-zone data transfer charges within a region (unlike AWS)

---

### Pattern 3: Hub-and-Spoke Network

**Use case:** Enterprise environment with multiple workloads requiring centralized network services and security control.

```
Hub VNet (10.0.0.0/16)
├── AzureFirewallSubnet (10.0.1.0/26) → Azure Firewall
├── GatewaySubnet (10.0.2.0/27) → VPN/ExpressRoute Gateway
├── AzureBastionSubnet (10.0.3.0/26) → Azure Bastion
└── SharedServicesSubnet (10.0.4.0/24) → DNS, monitoring

Spoke VNet 1 - Web App (10.1.0.0/16)  ←peered→  Hub
├── frontend (10.1.1.0/24)
├── app (10.1.2.0/24)
└── data (10.1.3.0/24)

Spoke VNet 2 - Internal App (10.2.0.0/16)  ←peered→  Hub
├── app (10.2.1.0/24)
└── data (10.2.2.0/24)
```

**How it works:**
- Hub VNet contains shared services like Azure Firewall, VPN/ExpressRoute Gateway, Azure Bastion, and DNS
- Spoke VNets are peered with the hub and contain workload resources
- UDRs in spoke subnets route `0.0.0.0/0` through Azure Firewall in the hub for centralized inspection
- Gateway transit allows spoke VNets to use the hub's VPN/ExpressRoute gateway for on-premises connectivity
- Spokes do not peer with each other directly; all inter-spoke traffic flows through Azure Firewall

That last point is the one the topology above cannot show, because the path is created by routing rather than by peering:

```
Spoke 1 (10.1.0.0/16)                        Spoke 2 (10.2.0.0/16)
  app 10.1.2.4                                 app 10.2.1.5
     │                                              ↑
     │ 1. dst is 10.2.1.5, but the subnet's         │ 3. firewall forwards it
     │    UDR sends 10.2.0.0/16 → 10.0.1.4          │    over spoke 2's peering
     │                                              │
     └──── peering ──→ Azure Firewall 10.0.1.4 ─────┘
                       (AzureFirewallSubnet, hub 10.0.0.0/16)
                       2. rules evaluated, traffic allowed or dropped
```

Remove the UDRs and spoke 1 cannot reach spoke 2 at all, even though both are peered to the hub. Peering is non-transitive: the hub's two peerings do not relay traffic between each other. What makes spoke-to-spoke work is that each spoke's route table points the other spoke's range at the firewall, which then forwards over its own peering. This is also why the firewall sees every inter-spoke flow, which is the security property the pattern is bought for.

**Trade-offs:**
- Centralized security policy and inspection
- Single point of management for hybrid connectivity
- Azure Firewall throughput and availability become critical (use Premium SKU for production)
- More complex routing configuration
- Peering has data transfer costs

**This is the most common enterprise pattern on Azure**, recommended by the [Azure Cloud Adoption Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/hub-spoke-network-topology){:target="_blank" rel="noopener noreferrer"} and implemented as the default in Azure Landing Zones.

---

### Pattern 4: Hybrid Connectivity

**Use case:** Connect on-premises data centers to Azure securely.

On-premises connects over either a Site-to-Site VPN (IPsec across the public internet) or ExpressRoute (a private dedicated circuit). Either one terminates on a gateway in the hub's `GatewaySubnet`. Spokes then reach on-premises through gateway transit over their existing hub peering, rather than each running a gateway of its own, which is the main reason the gateway belongs in the hub.

**Connectivity options:**

| Option | Bandwidth | Latency | Cost | Use Case |
|--------|-----------|---------|------|----------|
| **Site-to-Site VPN** | Up to 10 Gbps (VpnGw5) | Variable (internet-dependent) | Lower | Small-medium data transfer, initial cloud adoption |
| **ExpressRoute** | 50 Mbps to 100 Gbps | Low, predictable | Higher | Large data transfer, latency-sensitive workloads, compliance |
| **ExpressRoute + VPN** | Both | Both | Highest | Maximum resiliency (VPN as failover for ExpressRoute) |

---

## VNet Peering

[VNet peering](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-peering-overview){:target="_blank" rel="noopener noreferrer"} connects two VNets so that resources in either VNet can communicate using private IP addresses. Traffic between peered VNets uses the Azure backbone network.

### Regional vs Global Peering

| Aspect | Regional Peering | Global Peering |
|--------|-----------------|----------------|
| **VNet locations** | Same Azure region | Different Azure regions |
| **Latency** | Sub-millisecond (same as within-VNet) | Cross-region latency |
| **Cost** | Inbound + outbound data transfer charges | Higher data transfer rates |
| **Gateway transit** | Supported | Supported |

### Peering Characteristics

- **Non-transitive:** If VNet A is peered with VNet B, and VNet B is peered with VNet C, VNet A cannot reach VNet C through VNet B (unless VNet B has a routing appliance and UDRs configured to forward traffic)
- **No CIDR overlap:** Peered VNets cannot have overlapping address spaces
- **Bidirectional but independently configured:** Each side of a peering must allow traffic. Both VNets must have peering configured for connectivity to work
- **Gateway transit:** A peered VNet can use the other VNet's VPN/ExpressRoute gateway, eliminating the need for every VNet to have its own gateway

### When to Peer vs When to Use Virtual WAN

| Scenario | VNet Peering | Virtual WAN |
|----------|-------------|-------------|
| 2-5 VNets in same region | Peering with UDRs | Overkill |
| Hub-and-spoke with <10 spokes | Peering + Azure Firewall | Either works |
| Hub-and-spoke with 10+ spokes | Complex to manage | Designed for this |
| Multi-region with many VNets | Complex routing | Native multi-region hub support |
| Branch office connectivity | Manual VPN configuration | Automated branch connectivity |

---

## Common Pitfalls

### Pitfall 1: Overlapping Address Spaces

**Problem:** Creating VNets with overlapping CIDR ranges that need to be peered or connected to on-premises.

**Result:** VNet peering fails. VPN/ExpressRoute routes conflict. Resources become unreachable.

**Solution:** Maintain a central IP address plan. Assign non-overlapping ranges to every VNet and on-premises network before provisioning. Use Azure Virtual Network Manager's IPAM feature for governance.

---

### Pitfall 2: NSG at Both Subnet and NIC Without Understanding Evaluation Order

**Problem:** Applying NSGs at both the subnet and NIC level with conflicting rules, then wondering why traffic is blocked.

**Result:** Traffic silently dropped because one of the two NSGs denies it. Debugging is difficult because NSG flow logs show the deny at the more restrictive level.

**Solution:** Standardize on subnet-level NSGs for most scenarios. Use NIC-level NSGs only when specific resources need exceptions. Enable NSG flow logs and use Network Watcher to diagnose issues.

---

### Pitfall 3: Service Endpoint Routes Overriding UDRs

**Problem:** Enabling service endpoints on a subnet that has UDRs forcing traffic through a firewall. The service endpoint route takes priority, and PaaS service traffic bypasses the firewall.

**Result:** Traffic to Azure Storage, SQL, or other services with endpoints skips the firewall unexpectedly, violating security policy.

**Solution:** Use Private Endpoints instead of service endpoints when traffic must be inspected by a firewall. Private Endpoint traffic follows normal UDR routing and can be directed through Azure Firewall.

---

### Pitfall 4: Forgetting Required Named Subnets

**Problem:** Trying to deploy Azure Bastion, Azure Firewall, or VPN Gateway without creating the required named subnet (`AzureBastionSubnet`, `AzureFirewallSubnet`, `GatewaySubnet`).

**Result:** Deployment fails with a confusing error about missing subnets.

**Solution:** Plan required named subnets during VNet design. Reserve CIDR ranges for them even if you don't deploy the services immediately.

---

### Pitfall 5: Not Planning for AKS IP Consumption

**Problem:** Using Azure CNI networking for AKS with a subnet that is too small. Azure CNI assigns a VNet IP to every pod, and a /24 subnet fills up quickly.

**Result:** Pod scheduling fails because the subnet runs out of IP addresses.

**Solution:** For AKS with Azure CNI, use a /22 or larger subnet (1,024+ addresses). Consider Azure CNI Overlay networking if IP conservation is critical. Calculate required IPs as: (max pods per node) x (max nodes) + (node IPs).

---

### Pitfall 6: Default Outbound Access Deprecation

**Problem:** Relying on Azure's default outbound internet access for VMs without configuring explicit outbound connectivity.

**Result:** VMs in new virtual networks have no outbound internet access, because their subnets are now private by default. The failure is confusing because it depends on which API version created the VNet, not on anything visible about the VM: identical templates produce working or broken outbound depending on the API version pinned.

**Solution:** Always configure explicit outbound connectivity. Use NAT Gateway for general workloads, Azure Firewall for workloads requiring inspection, or a public IP on the resource when appropriate. Note that Windows activation and Windows Update need an explicit egress path and will fail on a private subnet without one.

---

## Key Takeaways

1. **VNets are the network foundation for all Azure resources.** Every VM, AKS cluster, and VNet-integrated PaaS service lives within a VNet. Understanding VNets is prerequisite to designing anything on Azure.

2. **Plan address spaces centrally before creating VNets.** CIDR overlaps prevent peering and hybrid connectivity. This is the most impactful and hardest-to-fix networking mistake.

3. **NSGs are your primary network security control.** They are stateful, priority-based, and support both allow and deny rules. Apply them at the subnet level as the standard pattern, and use Application Security Groups to simplify rule management.

4. **Azure subnets span all Availability Zones in a region.** Unlike AWS, you do not create separate subnets per zone. Zone redundancy is configured on individual resources like VM Scale Sets, Application Gateway, and SQL Database.

5. **Use NAT Gateway for explicit outbound connectivity.** Subnets in new virtual networks are private by default, so default outbound access is no longer something to rely on. NAT Gateway provides reliable, scalable outbound with predictable IPs and eliminates SNAT port exhaustion. Choose the StandardV2 SKU if you need zone resiliency, because the Standard SKU is zonal.

6. **Private Endpoints provide the strongest PaaS integration.** They give PaaS services a private IP in your VNet, work across peering and hybrid connectivity, and allow disabling public endpoints entirely. Service endpoints are free but limited to VNet-only access.

7. **Hub-and-spoke is the standard enterprise pattern.** Centralize shared services like firewall, VPN gateway, and DNS in a hub VNet, and peer workload VNets as spokes. This is the foundation of Azure Landing Zones.

8. **UDRs override system routes, but service endpoint routes override UDRs.** If you need firewall inspection for PaaS service traffic, use Private Endpoints instead of service endpoints.

9. **Several subnet names are reserved by Azure services.** Plan for `GatewaySubnet`, `AzureFirewallSubnet`, and `AzureBastionSubnet` in your hub VNet design, even if you are not deploying those services immediately.

10. **VNet peering is non-transitive.** Spoke-to-spoke traffic in a hub-and-spoke topology must route through a network virtual appliance (like Azure Firewall) in the hub, configured with UDRs. Peering alone does not enable transitive connectivity.
