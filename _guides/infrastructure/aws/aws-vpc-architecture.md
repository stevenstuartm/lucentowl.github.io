---
title: "AWS VPC: Network Architecture"
layout: guide
category: AWS
subcategory: Networking
description: "VPC fundamentals for architects including subnets, routing, security groups, NACLs, and multi-AZ and multi-VPC patterns for building secure and scalable network architectures."
tags: [infrastructure, aws, networking, vpc, security, practical]
---

## What is a VPC

**Amazon Virtual Private Cloud (VPC)** is a logically isolated network within AWS where you launch and connect AWS resources. Think of it as your own private data center network in the cloud.

### What Problems VPC Solves

**Without VPC:**
- No network isolation between different applications or customers
- No control over IP addressing
- No ability to implement network-level security
- No way to connect to on-premises networks securely

**With VPC:**
- Network isolation for security and compliance
- Full control over IP address ranges (CIDR blocks)
- Multiple layers of security (security groups, NACLs)
- Connectivity to on-premises networks (VPN, Direct Connect)
- Segmentation of resources across availability zones for high availability

### How VPC Works

When you create a VPC, you define:
1. **IP address range** (CIDR block) for the entire VPC
2. **Subnets** within the VPC (carved from the VPC CIDR block)
3. **Route tables** that control traffic between subnets and outside the VPC
4. **Gateways** for connectivity to the internet or other networks
5. **Security controls** (security groups, NACLs) that filter traffic

---

## Core VPC Components

### VPC CIDR Block

Every VPC has a primary CIDR block that defines the IP address range for the entire VPC.

**CIDR Block Constraints:**
- Minimum size: /28 (16 IP addresses)
- Maximum size: /16 (65,536 IP addresses)
- Cannot overlap with other VPCs if you plan to peer them
- Cannot be changed after creation (but you can add secondary CIDR blocks)

**Common Choices:**

| CIDR Block | Usable IPs | Use Case |
|------------|-----------|----------|
| `10.0.0.0/16` | 65,536 | Large production environments with many subnets and resources |
| `10.0.0.0/20` | 4,096 | Medium-sized applications |
| `10.0.0.0/24` | 256 | Small development/test environments |
| `172.31.0.0/16` | 65,536 | Default VPC (AWS provides this automatically) |

**Best Practice:** Use RFC 1918 private address space:
- `10.0.0.0/8` (10.0.0.0 – 10.255.255.255)
- `172.16.0.0/12` (172.16.0.0 – 172.31.255.255)
- `192.168.0.0/16` (192.168.0.0 – 192.168.255.255)

<div class="callout callout--tip">
<p class="callout__title">Planning Tip</p>
<p>Choose a CIDR block large enough for growth but not so large that it wastes address space or conflicts with on-premises networks.</p>
</div>

---

## Subnets and Availability Zones

### Subnets

**Subnet:** A subdivision of the VPC's IP address range. Subnets reside in a single Availability Zone and cannot span multiple AZs.

**Subnet Types:**

1. **Public Subnet:** Has a route to an internet gateway; resources can have public IPs and communicate with the internet
2. **Private Subnet:** No route to an internet gateway; resources cannot be directly accessed from the internet
3. **VPN-Only Subnet:** Routes traffic to a virtual private gateway (VPN or Direct Connect); no internet access

**Subnet CIDR Blocks:**
- Must be carved from the VPC CIDR block
- Cannot overlap with other subnets in the same VPC
- AWS reserves 5 IPs in each subnet (first 4 and last 1)

**Example VPC Breakdown:**

VPC: `10.0.0.0/16` (65,536 IPs)

| Subnet | CIDR | AZ | Type | Purpose |
|--------|------|-------|------|---------|
| Public Subnet 1 | `10.0.1.0/24` | us-east-1a | Public | Load balancers, NAT gateways |
| Public Subnet 2 | `10.0.2.0/24` | us-east-1b | Public | Load balancers, NAT gateways |
| Private Subnet 1 | `10.0.11.0/24` | us-east-1a | Private | Application servers |
| Private Subnet 2 | `10.0.12.0/24` | us-east-1b | Private | Application servers |
| Private Subnet 3 | `10.0.21.0/24` | us-east-1a | Private | Database servers |
| Private Subnet 4 | `10.0.22.0/24` | us-east-1b | Private | Database servers |

**Why This Design:**
- Public subnets for internet-facing resources (ALB, NAT gateways)
- Private subnets for application logic (EC2, ECS)
- Separate private subnets for databases (additional isolation)
- Deployed across 2 AZs for high availability

### Reserved IPs

AWS reserves 5 IP addresses in every subnet:

| IP Address | Purpose |
|------------|---------|
| First IP (e.g., `10.0.1.0`) | Network address |
| Second IP (e.g., `10.0.1.1`) | VPC router |
| Third IP (e.g., `10.0.1.2`) | DNS server (Amazon-provided) |
| Fourth IP (e.g., `10.0.1.3`) | Reserved for future use |
| Last IP (e.g., `10.0.1.255`) | Broadcast address (not used in VPC but reserved) |

**Practical Impact:** A `/24` subnet has 256 total IPs, but only 251 are usable (`256 − 5` reserved).

**Note:** The Amazon-provided DNS server integrates with Route 53 for private hosted zones. For DNS routing strategies, health checks, and traffic management, see [AWS Route 53](aws-route53.md){:target="_blank" rel="noopener noreferrer"}.

---

## Routing and Gateways

### Route Tables

**Route Table:** A set of rules (routes) that determine where network traffic is directed.

**How Routing Works:**

Each subnet is associated with a route table. When traffic leaves a resource in the subnet, the route table determines the next hop.

**Route Priority:** Most specific route (longest prefix match) wins.

**Example Route Table for Public Subnet:**

| Destination | Target | Meaning |
|-------------|--------|---------|
| `10.0.0.0/16` | local | Traffic within VPC stays local |
| `0.0.0.0/0` | igw-12345 | All other traffic goes to internet gateway |

**Example Route Table for Private Subnet:**

| Destination | Target | Meaning |
|-------------|--------|---------|
| `10.0.0.0/16` | local | Traffic within VPC stays local |
| `0.0.0.0/0` | nat-12345 | All other traffic goes to NAT gateway |

<div class="callout callout--note">
<p class="callout__title">Key Concept</p>
<p>The route table association determines whether a subnet is public or private. A public subnet has a route to an internet gateway; a private subnet does not.</p>
</div>

### Internet Gateway (IGW)

**Internet Gateway:** Allows resources with public IPs in the VPC to communicate with the internet.

**Characteristics:**
- Horizontally scaled, redundant, highly available (AWS-managed)
- No bandwidth constraints
- Performs network address translation (NAT) for instances with public IPs
- One IGW per VPC

**When to Use:**
- Public subnets with internet-facing resources (load balancers, bastion hosts)

**How It Works:**
1. Instance in public subnet sends traffic to the internet
2. Route table directs traffic to IGW
3. IGW performs NAT (translates private IP to public IP)
4. Traffic reaches internet
5. Response returns through IGW (translates public IP back to private IP)

### NAT Gateway

**NAT Gateway:** Allows resources in private subnets to initiate outbound connections to the internet (but not inbound).

**Characteristics:**
- Managed by AWS (automatically scaled, highly available within a single AZ)
- Must be deployed in a public subnet (requires public IP)
- Charged per hour + data processed
- Supports 5 Gbps bandwidth (can scale to 100 Gbps)

**When to Use:**
- Private subnets that need to download software updates, access APIs, etc.

**Why Not Just Use an Internet Gateway?**
- Resources in private subnets don't have public IPs
- Internet gateway only works with public IPs
- NAT gateway allows outbound traffic without exposing resources to inbound internet traffic

**High Availability Pattern:**

Deploy one NAT gateway per availability zone. If an AZ fails, resources in other AZs still have internet access.

```
Public Subnet 1a → NAT Gateway 1a → Private Subnet 1a
Public Subnet 1b → NAT Gateway 1b → Private Subnet 1b
```

### NAT Instance (Legacy)

**NAT Instance:** EC2 instance running NAT software (Amazon Linux NAT AMI).

**Why It Exists:** Before NAT Gateway was introduced, this was the only option.

**When to Use NAT Instance Today:**
- Cost optimization (NAT instance can be smaller than NAT gateway's baseline cost)
- Need to use a specific NAT configuration not supported by NAT Gateway

**Trade-Offs:**
- Must manage and patch the instance yourself
- Single point of failure (unless you implement failover)
- Bandwidth limited by instance type

**Recommendation:** Use NAT Gateway unless you have specific requirements that only NAT Instance can meet.

### Virtual Private Gateway (VGW)

**Virtual Private Gateway:** AWS-side endpoint for VPN connections or Direct Connect.

**When to Use:**
- Site-to-site VPN from on-premises to AWS
- AWS Direct Connect for dedicated network connection

**How It Works:**
- Attach VGW to VPC
- Create VPN connection or Direct Connect connection to VGW
- Update route tables to route traffic destined for on-premises through VGW

**For detailed hybrid connectivity architecture, resiliency patterns, and cost analysis, see [AWS Direct Connect & VPN](aws-direct-connect-vpn.md){:target="_blank" rel="noopener noreferrer"}.**

---

## Security Layers

VPC provides two security layers: **Security Groups** (stateful, instance-level) and **NACLs** (stateless, subnet-level).

### Security Groups

**Security Group:** Virtual firewall that controls inbound and outbound traffic for EC2 instances, RDS databases, and other AWS resources.

**Characteristics:**
- **Stateful:** If you allow inbound traffic, the response is automatically allowed (regardless of outbound rules)
- **Operates at instance/resource level** (each resource can have multiple security groups)
- **Default deny:** All inbound traffic is denied by default; all outbound traffic is allowed by default
- **Rules specify allow only** (no deny rules; if it's not explicitly allowed, it's denied)

**Example Security Group for Web Server:**

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| Inbound | HTTP | 80 | `0.0.0.0/0` | Allow all internet traffic on HTTP |
| Inbound | HTTPS | 443 | `0.0.0.0/0` | Allow all internet traffic on HTTPS |
| Inbound | SSH | 22 | `10.0.0.0/16` | Allow SSH from within VPC only |
| Outbound | All | All | `0.0.0.0/0` | Allow all outbound traffic (default) |

**Example Security Group for Database:**

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| Inbound | PostgreSQL | 5432 | `sg-webserver` | Allow traffic only from web server security group |
| Outbound | All | All | `0.0.0.0/0` | Allow all outbound traffic (default) |

**Key Pattern:** Reference other security groups as sources. This creates logical dependencies: database accepts traffic from anything with the web server security group, without needing to know specific IP addresses.

**Why Stateful Matters:**

If you allow inbound HTTP (port 80), the response traffic on ephemeral ports (1024-65535) is automatically allowed, even though you didn't explicitly create an outbound rule for those ports.

### Network ACLs (NACLs)

**Network ACL:** Stateless firewall that controls inbound and outbound traffic at the subnet level.

**Characteristics:**
- **Stateless:** Inbound and outbound rules are evaluated independently (you must explicitly allow both directions)
- **Operates at subnet level** (affects all resources in the subnet)
- **Rules evaluated in order** (lowest rule number first)
- **Default allow:** The default NACL allows all inbound and outbound traffic
- **Supports allow and deny rules** (unlike security groups)

**When to Use NACLs:**
- Additional layer of defense (defense in depth)
- Explicitly deny traffic from specific IP ranges (security groups can't deny)
- Compliance requirements for subnet-level controls

**Example NACL for Public Subnet:**

| Rule # | Type | Protocol | Port | Source/Destination | Allow/Deny |
|--------|------|----------|------|-------------------|------------|
| 100 | Inbound | TCP | 80 | `0.0.0.0/0` | ALLOW |
| 110 | Inbound | TCP | 443 | `0.0.0.0/0` | ALLOW |
| 120 | Inbound | TCP | 1024-65535 | `0.0.0.0/0` | ALLOW (ephemeral ports for responses) |
| 200 | Inbound | TCP | 22 | `203.0.113.0/24` | DENY (block SSH from specific IP range) |
| * | Inbound | All | All | `0.0.0.0/0` | DENY (default rule) |
| 100 | Outbound | TCP | 80 | `0.0.0.0/0` | ALLOW |
| 110 | Outbound | TCP | 443 | `0.0.0.0/0` | ALLOW |
| 120 | Outbound | TCP | 1024-65535 | `0.0.0.0/0` | ALLOW (ephemeral ports for responses) |
| * | Outbound | All | All | `0.0.0.0/0` | DENY (default rule) |

**Why Stateless Matters:**

You must explicitly allow both inbound traffic (port 80) AND outbound response traffic (ephemeral ports 1024-65535). If you forget the ephemeral port rule, connections will fail.

### Security Groups vs. NACLs

| Aspect | Security Groups | NACLs |
|--------|----------------|-------|
| **Scope** | Instance/resource level | Subnet level |
| **State** | Stateful (response allowed automatically) | Stateless (must allow both directions) |
| **Rules** | Allow only | Allow and deny |
| **Rule Evaluation** | All rules evaluated | Rules evaluated in order until match |
| **Default** | Deny all inbound, allow all outbound | Default NACL allows all traffic |
| **Use Case** | Primary security control | Secondary defense layer or explicit denies |

**Best Practice:** Use security groups as the primary security control (more intuitive, stateful). Use NACLs for additional defense or explicit deny rules.

---

## Private Connectivity: PrivateLink and VPC Endpoints

**AWS PrivateLink** enables private connectivity between VPCs, AWS services, and on-premises networks without exposing traffic to the public internet. It uses VPC endpoints to keep traffic within the AWS network.

**Key Benefit:** Traffic never traverses the public internet, reducing exposure to threats, improving security posture, and often reducing costs.

### VPC Endpoint Types

AWS provides three types of VPC endpoints:

| Endpoint Type | Services | Technology | Charges | Use When |
|---------------|----------|------------|---------|----------|
| **Gateway Endpoint** | S3, DynamoDB only | Route table entries | No hourly charge (data transfer only) | Always for S3/DynamoDB access from within VPC |
| **Interface Endpoint** | 130+ AWS services + SaaS | PrivateLink (ENIs with private IPs) | Hourly + data processing | Accessing AWS services from private subnets without NAT/IGW |
| **Gateway Load Balancer Endpoint** | Third-party security appliances | PrivateLink | Hourly + data processing | Traffic inspection with third-party appliances |

### Gateway Endpoints (S3 and DynamoDB)

Gateway endpoints add routes to your route tables directing traffic destined for S3 or DynamoDB through the endpoint instead of an internet gateway or NAT gateway.

**Key Characteristics:**
- No ENIs in your subnets (just route table entries)
- No hourly charges (only standard data transfer charges apply)
- Highly available by default (regional service)
- Can attach endpoint policies to control access

**Cost Impact:**
- Without gateway endpoint: $0.045/GB through NAT gateway + data transfer
- With gateway endpoint: Data transfer charges only
- For workloads transferring large amounts of S3/DynamoDB data, this saves significant cost

**When to Use:**
- ✅ Always for S3 and DynamoDB access from within the VPC
- ✅ Cost optimization (eliminates NAT gateway data processing charges)
- ✅ Security (traffic stays within AWS network)

### Interface Endpoints (AWS Services and SaaS)

Interface endpoints create ENIs with private IP addresses in your subnets, serving as entry points for traffic destined for 130+ AWS services and third-party SaaS providers.

**How They Work:**
1. Create interface endpoint for specific service (e.g., `com.amazonaws.us-east-1.ssm`)
2. AWS creates ENI in specified subnets with private IPs
3. Private DNS resolves service endpoints to ENI private IPs automatically
4. Applications use standard service endpoints with no code changes

**Key Characteristics:**
- ENIs deployed in your subnets (one per AZ for high availability)
- Charged hourly per endpoint + data processing ($0.01/GB in most regions)
- Can attach security groups to control access
- Support endpoint policies for fine-grained control

**Cost Comparison:**

| Approach | Cost per AZ | Data Processing | Security |
|----------|-------------|-----------------|----------|
| NAT Gateway | $0.045/hour + $0.045/GB | Higher cost | Traffic routes through internet gateway |
| Interface Endpoints | $0.01/hour per endpoint + $0.01/GB | Lower cost | Traffic stays private |

For workloads making frequent AWS API calls, interface endpoints are often cheaper and more secure than NAT gateway.

**When to Use:**
- ✅ Private subnets need AWS service access without NAT/IGW
- ✅ Cost optimization (eliminate NAT gateway charges for AWS API calls)
- ✅ Security compliance requires no internet routing
- ✅ On-premises systems need private access to AWS services (via Direct Connect or VPN)

### PrivateLink Best Practices

1. **High Availability:** Deploy interface endpoints in at least two Availability Zones for production workloads
2. **Cost Optimization for S3:** Use gateway endpoints for VPC access (free), interface endpoints for on-premises access only
3. **Security Controls:** Attach security groups and endpoint policies to restrict access
4. **Private DNS:** Enable DNS hostnames and resolution in VPC settings for automatic DNS resolution
5. **Centralized Endpoints:** Share endpoints across accounts using AWS Resource Access Manager (RAM)

### When to Use PrivateLink vs. VPC Peering

| Use PrivateLink When | Use VPC Peering When |
|---------------------|----------------------|
| Exposing specific services to many consumers (SaaS model) | Full VPC-to-VPC connectivity needed |
| Provider-consumer relationship | Peer-to-peer trust relationship |
| Need to scale to thousands of consumers | Small number of VPC connections (2-10) |
| Accessing AWS services privately | Connecting trusted partner VPCs |

**Key Principle:** PrivateLink is one-way (provider → consumer); VPC peering is bidirectional.

**For detailed PrivateLink architecture patterns, Transit Gateway integration, cost optimization strategies, and multi-VPC connectivity, see [AWS PrivateLink & Transit Gateway](aws-privatelink-transit-gateway.md){:target="_blank" rel="noopener noreferrer"}.**

---

## Architectural Patterns

### Pattern 1: Single-Tier Public Architecture

**Use Case:** Simple static website or public-facing application with no backend.

**Architecture:**
- Public subnet with internet gateway
- Web servers with public IPs
- Security group allows HTTP/HTTPS from internet

**Trade-Offs:**
- ✅ Simplest architecture
- ✅ Lowest cost (no NAT gateway)
- ⚠️ All resources exposed to internet
- ⚠️ No defense in depth

**When to Use:** Static websites, development/test environments, very simple applications

---

### Pattern 2: Multi-Tier Architecture (Public + Private Subnets)

**Use Case:** Web application with application servers and databases requiring isolation.

**Architecture:**

```
Internet
   ↓
Internet Gateway
   ↓
Public Subnet (ALB)
   ↓
Private Subnet (Application Servers)
   ↓
Private Subnet (Database)
```

**Components:**
- **Public subnet:** Application Load Balancer with public IP
- **Private subnet 1:** EC2 instances running application (no public IPs)
- **Private subnet 2:** RDS database (no public IPs)
- **NAT gateway:** In public subnet, allows private resources to reach internet for updates

**Security:**
- ALB security group: Allow 80/443 from `0.0.0.0/0`
- Application security group: Allow traffic only from ALB security group
- Database security group: Allow traffic only from application security group

**For detailed load balancing strategies, target group configuration, and health check patterns, see [AWS Elastic Load Balancing](aws-elastic-load-balancing.md){:target="_blank" rel="noopener noreferrer"}.**

**Trade-Offs:**
- ✅ Defense in depth (multiple security layers)
- ✅ Database not exposed to internet
- ✅ Can scale application tier independently
- ⚠️ Higher cost (NAT gateway)
- ⚠️ More complex to configure

**When to Use:** Production applications requiring security and scalability

---

### Pattern 3: Multi-AZ High Availability

**Use Case:** Production application requiring resilience to availability zone failures.

**Architecture:**

```
Region
├── AZ 1
│   ├── Public Subnet 1a (ALB, NAT Gateway)
│   ├── Private Subnet 1a (Application)
│   └── Private Subnet 1a (Database Primary)
└── AZ 2
    ├── Public Subnet 1b (ALB, NAT Gateway)
    ├── Private Subnet 1b (Application)
    └── Private Subnet 1b (Database Standby)
```

**Components:**
- ALB spans both AZs (automatically distributes traffic)
- Application servers in both AZs (Auto Scaling across AZs)
- RDS Multi-AZ (automatic failover to standby)
- NAT gateway in each AZ (prevents single point of failure)

**Why This Works:**
- If AZ 1 fails, ALB routes traffic to AZ 2
- Auto Scaling launches new instances in healthy AZ
- RDS fails over to standby in AZ 2
- NAT gateway in AZ 2 continues to function

**Trade-Offs:**
- ✅ Survives entire AZ failure
- ✅ Higher availability (99.99% instead of 99.9%)
- ⚠️ Higher cost (duplicate resources across AZs)
- ⚠️ Cross-AZ data transfer charges

**When to Use:** Production applications with availability SLAs

---

### Pattern 4: Hybrid Cloud (VPN Connection)

**Use Case:** Connect on-premises data center to AWS VPC securely.

**Architecture:**

```
On-Premises
   ↓
Customer Gateway
   ↓
VPN Connection (encrypted tunnel over internet)
   ↓
Virtual Private Gateway (attached to VPC)
   ↓
Private Subnets
```

**Components:**
- Virtual Private Gateway attached to VPC
- Customer Gateway (on-premises VPN device)
- VPN connection with IPsec tunnels
- Route table entries for on-premises CIDR blocks

**Use Cases:**
- Hybrid cloud (some workloads on-premises, some in AWS)
- Gradual migration to AWS
- Accessing on-premises databases from AWS applications

**Trade-Offs:**
- ✅ Secure encrypted connection
- ✅ Lower cost than Direct Connect
- ⚠️ Limited bandwidth (typically 1.25 Gbps per tunnel)
- ⚠️ Latency depends on internet connection quality

**When to Use:** Small to medium data transfer needs, non-latency-sensitive workloads

---

## Multi-VPC Strategies

### When to Use Multiple VPCs

**Reasons to Create Multiple VPCs:**
- **Environment isolation:** Separate VPCs for dev, test, production
- **Security boundaries:** Different compliance requirements (PCI, HIPAA)
- **Organizational boundaries:** Different departments or teams
- **Resource limits:** VPC has limits (200 subnets, 200 route tables)

**Trade-Offs:**
- More complex networking (VPC peering or Transit Gateway required)
- More overhead to manage
- Potential for IP address conflicts if not planned properly

### VPC Peering

**VPC Peering:** Direct network connection between two VPCs using AWS backbone (not over internet).

**Characteristics:**
- One-to-one relationship (VPC A peers with VPC B)
- Non-transitive (if A peers with B, and B peers with C, A cannot reach C)
- Can peer VPCs across regions (inter-region VPC peering)
- Can peer VPCs across accounts
- No single point of failure, no bandwidth bottleneck

**When to Use:**
- Small number of VPCs need to communicate
- Specific VPC-to-VPC connections

**Limitations:**
- Must manually create peering connection for each pair
- With N VPCs, you need N*(N-1)/2 peering connections (3 VPCs = 3 connections; 10 VPCs = 45 connections)
- Becomes unmanageable at scale

### Transit Gateway

**Transit Gateway:** Central hub that routes traffic between VPCs, VPNs, and Direct Connect.

**Characteristics:**
- Acts as a regional router
- Supports up to 5,000 attachments
- Transitive routing (if A and C attach to transit gateway, they can communicate)
- Simplifies multi-VPC networking

**When to Use:**
- Many VPCs need to communicate (more than 3-4 VPCs)
- Hub-and-spoke network topology
- Centralized egress to internet (all VPCs route through shared egress VPC)

**Trade-Offs:**
- ✅ Simplifies complex multi-VPC networking
- ✅ Centralized route management
- ⚠️ Additional cost (charged per attachment + data processed)
- ⚠️ More complex to set up initially

**Example: 10 VPCs**
- **Without Transit Gateway:** 45 VPC peering connections
- **With Transit Gateway:** 10 attachments to transit gateway (dramatically simpler)

**For detailed Transit Gateway routing, isolation patterns, multi-region connectivity, and cost analysis, see [AWS PrivateLink & Transit Gateway](aws-privatelink-transit-gateway.md){:target="_blank" rel="noopener noreferrer"}.**

---

## VPC Lattice for Service-to-Service Communication

### What is VPC Lattice?

**Amazon VPC Lattice** (launched March 2023) is a fully managed application networking service that consistently connects, monitors, and secures communications between services across VPCs and AWS accounts. It operates at the **application layer (Layer 7)** rather than the network layer.

**Key Innovation:** VPC Lattice abstracts away traditional networking complexity (route tables, CIDR blocks, peering connections) and provides service-level connectivity with built-in security and observability.

### What Problems Does VPC Lattice Solve?

**Traditional VPC Networking Limitations:**
- VPC peering and Transit Gateway solve network-layer connectivity but don't provide application-level routing
- Service mesh solutions (App Mesh, Istio) require managing sidecar proxies in every pod/container
- Complex route table management for multi-VPC architectures
- No built-in service-level authorization (must implement in application code)
- CIDR overlap prevents connectivity between VPCs with overlapping IP ranges
- Difficult to implement canary deployments, weighted routing, blue/green at network level

**VPC Lattice Solutions:**
- **Eliminates sidecar proxies:** Managed control plane and data plane (no Envoy sidecars needed)
- **Service-level abstraction:** Connect services across VPCs without managing routes or IP addresses
- **Works with overlapping CIDRs:** Services can communicate even with conflicting IP ranges
- **Built-in IAM authentication:** Fine-grained authorization at the API level without custom code
- **Unified observability:** CloudWatch metrics provided automatically
- **Simplified multi-account connectivity:** Native AWS Resource Access Manager (RAM) integration
- **Application-layer routing:** Weighted targets, health checks, HTTP/gRPC routing rules

### How VPC Lattice Works

**Core Concepts:**

1. **Service:** Logical unit of application functionality (e.g., "payments-api", "user-service")
2. **Service Network:** Collection of services that can communicate with each other
3. **Target Groups:** Compute resources (EC2, ECS, Lambda, Fargate) that handle requests
4. **Auth Policies:** IAM-based policies defining which principals can access services
5. **Access Policies:** Service-level policies controlling access to service network or individual services

**Architecture:**

```
Service Network: production-services
├── Service: payments-api
│   ├── Target Group: payments-ec2-targets
│   ├── Auth Policy: Allow accounts 111111111111, 222222222222
│   └── Listener: HTTPS:443 → Target Group
├── Service: user-service
│   ├── Target Group: user-lambda-targets
│   └── Auth Policy: Allow specific IAM roles
└── VPC Associations: VPC-A, VPC-B, VPC-C
```

Services in associated VPCs can discover and communicate with each other using service DNS names (e.g., `payments-api.service-network-id.vpc-lattice-svcs.amazonaws.com`).

### When to Use VPC Lattice

**Use VPC Lattice when:**
- ✅ You need service-to-service communication across VPCs/accounts
- ✅ Your traffic is HTTP, HTTPS, gRPC, or TCP (TCP support added December 2024)
- ✅ You want zero-trust security with IAM-based authorization
- ✅ You have overlapping CIDR blocks between VPCs
- ✅ You need application-layer routing (weighted routing, blue/green, canary deployments)
- ✅ You want simplified service discovery across multiple VPCs
- ✅ Your workloads are on EC2, ECS, EKS, Lambda, or Fargate
- ✅ You're replacing service mesh and want managed solution

**Do NOT use VPC Lattice when:**
- ❌ You need network-layer connectivity for all protocols and ports (use Transit Gateway)
- ❌ You're moving large volumes of data between VPCs (use Transit Gateway for higher throughput)
- ❌ You need lowest possible latency (use VPC peering; no intermediate hops)
- ❌ You need extremely complex service mesh capabilities (use Istio; though VPC Lattice covers most use cases)

### VPC Lattice vs. Service Mesh Comparison

| Aspect | VPC Lattice | App Mesh / Istio |
|--------|-------------|------------------|
| **Architecture** | Managed control + data plane, no sidecars | Sidecar proxy (Envoy) in each pod |
| **Deployment Complexity** | Simpler (no pod modifications) | More complex (inject sidecars everywhere) |
| **Scope** | Cross-VPC, cross-account by design | Primarily within clusters |
| **Protocol Support** | HTTP, HTTPS, gRPC, TCP (2024) | All protocols |
| **Security** | IAM-based authorization, AWS-native | mTLS by default (Istio) |
| **Observability** | Built-in CloudWatch metrics | Requires Prometheus/CloudWatch Agent |
| **Load Balancing** | Built-in | Requires separate load balancers |
| **Cost Model** | Pay per service + data + requests | Pay for compute resources for proxies |
| **Traffic Management** | Policy-based, weighted targets | Advanced routing with Virtual Services |
| **Overlapping IPs** | Handles overlapping CIDRs | Requires non-overlapping ranges |
| **Flexibility** | Less flexible, AWS-specific | Highly flexible, open-source, multi-cloud |

**Critical Context:** AWS announced App Mesh deprecation effective September 30, 2026. AWS recommends migrating ECS customers to ECS Service Connect and EKS customers to VPC Lattice.

### VPC Lattice Use Case Example

**Scenario:** Microservices architecture with services in multiple VPCs across dev, staging, and prod accounts.

**Traditional Approach:**
- Create VPC peering or Transit Gateway connections
- Manage security groups in each VPC
- Implement service discovery (DNS, Consul, etc.)
- Build authorization logic into each service
- Set up ALBs for each service
- Configure complex routing for canary deployments

**With VPC Lattice:**

1. **Create service network:** `production-services`
2. **Associate VPCs:** Attach VPCs from different accounts
3. **Create services:**
   - `payments-api` backed by ECS tasks
   - `user-service` backed by Lambda functions
   - `inventory-service` backed by EC2 instances
4. **Set auth policies:** Define which services can call which other services using IAM policies
5. **Services discover each other** using service DNS names automatically

**Benefits:**
- No route table management
- Built-in authorization (IAM policies)
- Automatic service discovery
- Observability included (CloudWatch metrics)
- Works despite CIDR overlaps

### Recent 2024 Updates to VPC Lattice

- **November 18, 2024:** Native Amazon ECS integration (eliminates need for intermediate ALB)
- **December 2024:** TCP support with VPC Resources (access RDS databases, custom DNS, IP endpoints)

### VPC Lattice Best Practices

1. **Use auth policies for zero-trust security:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:role/payments-service-role"
      },
      "Action": "vpc-lattice-svcs:Invoke",
      "Resource": "*"
    }
  ]
}
```

This ensures only the payments service role can invoke the service.

2. **Deploy target groups in multiple AZs** for high availability

3. **Use CloudWatch metrics** to monitor service health, request counts, and latency

4. **Implement weighted routing** for canary deployments (send 5% traffic to new version, 95% to stable)

---

### Multi-VPC Connectivity Comparison

| Criteria | VPC Peering | Transit Gateway | VPC Lattice |
|----------|-------------|-----------------|-------------|
| **Primary Use Case** | Simple VPC-to-VPC connectivity | Complex multi-VPC hub-and-spoke | Service-to-service application networking |
| **Protocol Support** | All (network layer) | All (network layer) | HTTP, HTTPS, gRPC, TCP (application layer) |
| **Scaling** | N*(N-1)/2 connections; max 125 per VPC | Up to 5,000 attachments | Service-centric (not VPC-centric) |
| **Transitive Routing** | No | Yes | Yes (at service level) |
| **Bandwidth** | No limit, lowest latency | 50 Gbps per attachment (burst) | 10 Gbps per AZ / 10k RPS per AZ |
| **Overlapping CIDRs** | Not supported | Not supported | Supported |
| **Cost Model** | Data transfer only | Hourly per attachment + data | Hourly per service + data + requests |
| **Management Complexity** | High at scale (many connections) | Medium (central hub) | Low (service abstraction) |
| **On-Premises Support** | No | Yes (VPN/Direct Connect) | Limited (requires Transit Gateway) |
| **Authorization** | Network-level (security groups) | Network-level | IAM-based service-level |
| **When to Use** | 2-3 VPCs, lowest latency | 5+ VPCs, hybrid connectivity, large data | Microservices across VPCs, HTTP/gRPC traffic |

**Recommendation:** For new microservices architectures in AWS, consider VPC Lattice as the default for service-to-service communication. Use Transit Gateway for network-level connectivity when needed.

---

## IPv4 Cost Optimization and IPv6

### Public IPv4 Charges (February 2024)

**Major Change:** AWS now charges $0.005/hour ($3.60/month, $43.20/year) for ALL public IPv4 addresses, including previously free addresses on EC2, RDS, ELB, NAT Gateway, and other services.

**Cost Impact:**

| Resource | Previous Cost | Current Cost |
|----------|--------------|-------------|
| t2.nano EC2 instance | $4.94/month | $8.74/month (+77%) |
| NAT Gateway in single AZ | $32.85/month | $36.45/month (+11%) |
| NAT Gateway in 3 AZs | $98.55/month | $109.35/month (+11%) |
| ALB with 2 AZs (2 public IPs) | $16.20/month (base) | $23.40/month (+44%) |

**For cost-sensitive workloads, this has significant architectural implications.**

### IPv6 Adoption Strategy

**IPv6 Advantages:**
- **Free:** No per-address charges for IPv6 addresses
- **Abundant:** No address exhaustion concerns
- **AWS Support:** Fully supported across VPC, EC2, ALB, CloudFront, Route 53

**Dual-Stack VPCs:**

```
VPC: 10.0.0.0/16 (IPv4) + 2600:1f1c:1234:5678::/56 (IPv6)
├── Public Subnet 1a: 10.0.1.0/24 + 2600:1f1c:1234:5678:0::/64
│   - ALB: IPv4 + IPv6 (dual-stack)
│   - Egress-Only Internet Gateway (IPv6 outbound-only)
├── Private Subnet 1a: 10.0.11.0/24 + 2600:1f1c:1234:5678:1::/64
│   - EC2 instances: IPv4 + IPv6 (dual-stack)
└── Private Subnet 1b: 10.0.12.0/24 + 2600:1f1c:1234:5678:2::/64
    - RDS database: IPv4 only (IPv6 support varies by service)
```

**Egress-Only Internet Gateway (EIGW):**

For IPv6, the equivalent of NAT Gateway is Egress-Only Internet Gateway:
- Allows outbound IPv6 traffic from private subnets
- Blocks inbound IPv6 traffic
- **No hourly or data processing charges** (unlike NAT Gateway)

**Cost Savings:**

| Scenario | IPv4 Cost (NAT Gateway) | IPv6 Cost (EIGW) | Savings |
|----------|------------------------|------------------|---------|
| 3 AZs with 100GB/month | $109.35/month + $13.50/month = $122.85/month | $0/month | $122.85/month (100%) |

### IPv6 Migration Patterns

**Pattern 1: Dual-Stack for Internet-Facing Resources**

1. Associate IPv6 CIDR block with VPC
2. Assign IPv6 CIDR to public subnets
3. Update ALB/CloudFront to dual-stack
4. Update Route 53 with AAAA records
5. Client applications use IPv6 when available (happy eyeballs algorithm)

**Pattern 2: IPv6-Only for Internal Communication**

1. Create IPv6-only private subnets
2. Use Egress-Only Internet Gateway for outbound traffic
3. Enable DNS64 for accessing IPv4 endpoints from IPv6-only instances
4. Eliminates NAT Gateway costs entirely for those subnets

### IPv4 Cost Optimization Strategies

**1. Minimize Public IP Addresses:**
- Use private subnets wherever possible
- Share NAT Gateways across multiple subnets
- Use PrivateLink for AWS service access instead of NAT Gateway

**2. Use VPC Endpoints:**
- Gateway endpoints for S3 and DynamoDB (free)
- Interface endpoints for other AWS services (cheaper than NAT Gateway for API-heavy workloads)

**3. Adopt IPv6 for Internet-Facing Workloads:**
- Dual-stack ALBs and CloudFront distributions
- Egress-Only Internet Gateway for outbound (free vs. $32.85/month per NAT Gateway)

**4. Consolidate Resources:**
- Use fewer, larger EC2 instances instead of many small instances
- Reduce number of public-facing resources

**5. VPC Sharing:**
- Share NAT Gateways and VPC endpoints across accounts using AWS RAM
- Deploy once, use across multiple accounts

### Best Practices (2024)

1. **New architectures:** Start with dual-stack VPCs
2. **Existing architectures:** Gradually enable IPv6 where possible
3. **Public-facing services:** Use dual-stack ALB/CloudFront
4. **Private subnets:** Consider IPv6-only with DNS64 for cost savings
5. **Monitor IPv4 usage:** Use Cost Explorer to identify high IPv4 costs

**Critical Decision:** For every public IP address you use, ask: "Is this worth $43.20/year?" The answer increasingly drives IPv6 adoption.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update Route Tables

**Problem:** Creating a NAT gateway or internet gateway but forgetting to add routes to route tables.

**Result:** Resources can't reach the internet even though the gateway exists.

**Solution:** After creating gateways, always update the appropriate route tables with routes pointing to the gateway.

---

### Pitfall 2: NACL Ephemeral Port Rules

**Problem:** Creating NACL rules for inbound traffic but forgetting to allow outbound ephemeral ports (1024-65535).

**Result:** Connections fail because response traffic is blocked.

**Solution:** Remember NACLs are stateless. Always allow ephemeral ports for response traffic.

---

### Pitfall 3: Overlapping CIDR Blocks

**Problem:** Creating VPCs with overlapping IP ranges (e.g., both VPCs use `10.0.0.0/16`).

**Result:** Cannot peer VPCs or establish connectivity.

**Solution:** Plan IP address allocation upfront. Use non-overlapping RFC 1918 ranges for each VPC.

---

### Pitfall 4: Not Planning for Growth

**Problem:** Choosing a small CIDR block (e.g., `/24`) for a VPC that will grow.

**Result:** Running out of IP addresses and needing to migrate to a new VPC.

**Solution:** Choose a CIDR block large enough for expected growth. Use `/16` for production VPCs unless you have specific constraints.

---

### Pitfall 5: Single NAT Gateway for High Availability

**Problem:** Using a single NAT gateway for a multi-AZ deployment.

**Result:** If the AZ with the NAT gateway fails, all private subnets lose internet access.

**Solution:** Deploy one NAT gateway per AZ for high availability.

---

### Pitfall 6: Security Group Self-Reference Loops

**Problem:** Creating circular security group rules (e.g., SG-A allows traffic from SG-B, and SG-B allows traffic from SG-A) without understanding the implications.

**Result:** Unintended access patterns or complex debugging when traffic doesn't flow as expected.

**Solution:** Document security group relationships clearly. Use explicit source CIDRs when possible for clarity.

---

## Key Takeaways

1. **VPC is the network foundation for all AWS resources.** Without understanding VPC, you cannot design secure, scalable, and resilient architectures.

2. **Public vs. private subnets are determined by route tables.** A subnet with a route to an internet gateway is public; without that route, it's private.

3. **Use PrivateLink (VPC endpoints) to eliminate NAT Gateway costs and improve security.** Gateway endpoints for S3/DynamoDB are free. Interface endpoints for other AWS services cost less than NAT Gateway for API-heavy workloads and keep traffic private.

4. **Public IPv4 addresses now cost $43.20/year each (as of February 2024).** Minimize public IPs, adopt dual-stack IPv6 where possible, and use Egress-Only Internet Gateway (free) instead of NAT Gateway for IPv6 workloads.

5. **VPC Lattice is AWS's modern approach to service-to-service communication.** For microservices across VPCs, use VPC Lattice instead of complex route table management. It provides IAM-based authorization, service discovery, and works with overlapping CIDR blocks.

6. **Use multiple availability zones for high availability.** Deploy resources across at least two AZs with load balancing to survive AZ failures.

7. **Security groups are stateful and operate at the instance level.** They are your primary security control. NACLs are stateless and operate at the subnet level, providing an additional defense layer.

8. **Plan IP address ranges carefully.** Choose non-overlapping CIDR blocks across VPCs to enable future connectivity. Use `/16` for production VPCs unless you have specific constraints. If overlapping CIDRs are unavoidable, VPC Lattice can still connect services.

9. **Multi-VPC connectivity strategy:** VPC Peering for 2-3 VPCs (lowest latency), Transit Gateway for 5+ VPCs or hybrid connectivity, VPC Lattice for HTTP/gRPC service-to-service communication across VPCs.

10. **Defense in depth: use multiple security layers.** Combine security groups, NACLs, IAM policies, VPC endpoints, and encryption to create comprehensive security.

11. **Document your network design.** Future teams need to understand subnet purposes, CIDR allocations, routing decisions, security group relationships, and why you chose VPC Lattice vs. Transit Gateway. Without documentation, they'll make incorrect assumptions that lead to security vulnerabilities or outages.

12. **Test failover scenarios.** Design for high availability, but also test that failover works as expected. Simulate AZ failures to verify that your architecture is truly resilient.

**VPC is not just networking.** It's the security boundary, availability foundation, connectivity layer, and increasingly the cost optimization target (IPv4 charges) for your entire AWS architecture.
