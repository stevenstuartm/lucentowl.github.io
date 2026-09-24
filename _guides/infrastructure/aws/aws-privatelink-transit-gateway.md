---
title: "AWS PrivateLink & Transit Gateway for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS PrivateLink and Transit Gateway covering private service connectivity, multi-VPC architectures, hub-and-spoke patterns, cost comparison with VPC peering, and scaling strategies"
tags: [aws, privatelink, transit-gateway, vpc, multi-vpc, networking, cost-optimization, fundamentals]
---

## What Problems PrivateLink & Transit Gateway Solve

AWS PrivateLink and Transit Gateway solve connectivity challenges in complex, multi-VPC and multi-account architectures.

**VPC Peering Complexity Problems**:
- Full mesh peering scales poorly (N VPCs require N×(N-1)/2 peering connections)
- 10 VPCs = 45 peering connections, 20 VPCs = 190 connections (unmanageable)
- Each VPC requires separate route table entries for every other VPC
- Transitive routing not supported (VPC A → VPC B → VPC C requires A ↔ C peering)
- No centralized management or visibility

**Service Exposure Problems**:
- Exposing services to partners/customers requires public internet or VPN
- VPC peering grants access to entire CIDR range (not just specific services)
- No fine-grained access control per service
- Scaling to hundreds of consumer VPCs is impractical with peering

**Multi-Region and Hybrid Problems**:
- Connecting on-premises to multiple VPCs requires separate VPN/Direct Connect per VPC
- Multi-region architectures require complex routing and peering
- No centralized egress/ingress control for security inspection

**AWS Solutions**:

**AWS PrivateLink**:
- **Private service connectivity** without VPC peering or internet
- Expose services to thousands of consumer VPCs via **VPC endpoints**
- Traffic never leaves AWS network (no public IPs, no IGW)
- **Fine-grained access control** per service (not entire VPC)
- **Scales to thousands of consumers** without complexity
- **Pricing**: $0.01 per endpoint-hour + $0.01 per GB processed

**AWS Transit Gateway (TGW)**:
- **Hub-and-spoke architecture** connecting thousands of VPCs and on-premises networks
- Centralized routing with **route tables** and **route propagation**
- Reduces connections from N² to N (10 VPCs: 45 connections → 10 attachments)
- **Transitive routing** (VPC A → TGW → VPC B → TGW → VPC C works)
- **Multi-region peering** for global connectivity
- **Centralized network inspection** (firewall, IDS/IPS)
- **Pricing**: $0.05 per attachment-hour + $0.02 per GB processed

Both integrate with VPN, Direct Connect, VPC, and each other for comprehensive network architectures.

## AWS PrivateLink

### What PrivateLink Provides

**Private Service Access**:
- Consumer VPC accesses services in provider VPC via **private IP addresses**
- Service traffic stays on AWS network (never traverses internet)
- Consumer doesn't need VPC peering, IGW, NAT Gateway, or VPN
- Provider's VPC remains completely isolated (consumer can't access other resources)

**Use Cases**:
- **SaaS providers**: Expose services to customer VPCs without VPC peering
- **Shared services**: Centralized services (DNS, AD, monitoring) accessible from all VPCs
- **Partner integration**: Grant partners access to specific APIs without exposing entire VPC
- **Compliance**: Keep data within AWS network (HIPAA, PCI DSS requirements)

### PrivateLink Architecture

**Components**:

**1. VPC Endpoint Service** (Provider Side):
- Created by service provider in their VPC
- Backed by Network Load Balancer (NLB) with targets (EC2, ECS, Lambda via ALB)
- Service name: `com.amazonaws.vpce.region.vpce-svc-abc123`
- Supports **manual approval** or **auto-accept** for consumer connections

**2. VPC Endpoint** (Consumer Side):
- Interface endpoint (ENI with private IP) created in consumer VPC
- DNS name resolves to endpoint's private IP
- Routes traffic to VPC Endpoint Service via AWS PrivateLink

**Architecture Example**:
```
Provider VPC:
  Application Servers (EC2, ECS)
       ↓
  Network Load Balancer (NLB)
       ↓
  VPC Endpoint Service (vpce-svc-abc123)

Consumer VPC:
  Application
       ↓
  VPC Endpoint (vpce-xyz789) → Private IP: 10.0.1.50
       ↓
  PrivateLink (AWS Network)
       ↓
  VPC Endpoint Service
       ↓
  NLB → Provider Application
```

**Traffic Flow**:
1. Consumer application resolves service DNS to VPC endpoint private IP (10.0.1.50)
2. Traffic sent to VPC endpoint (stays in consumer VPC subnet)
3. PrivateLink routes traffic through AWS network to provider's VPC Endpoint Service
4. VPC Endpoint Service forwards to NLB → backend targets
5. Response returns via same path

### VPC Endpoint Types

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Interface Endpoint (ENI-based)</h4>
<ul>
<li>Elastic Network Interface with private IP</li>
<li>Supports most AWS services and custom services</li>
<li>Required for CloudWatch, KMS, Secrets Manager, etc.</li>
<li>Cost: $0.01/hour + $0.01/GB (~$7.30/month + data)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Gateway Endpoint (Route table-based)</h4>
<ul>
<li>Routes via route table entry (no ENI)</li>
<li>Only supports S3 and DynamoDB</li>
<li>Same functionality as Interface Endpoint</li>
<li>Cost: Free (no hourly charge, no data processing fee)</li>
</ul>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">Cost Optimization</p>
<p>Always use Gateway Endpoints for S3 and DynamoDB. They're free and provide the same functionality as Interface Endpoints, which cost $7.30/month per endpoint.</p>
</div>

**Recommendation**: Use Gateway Endpoints for S3 and DynamoDB (free). Use Interface Endpoints for all other services.

### PrivateLink Access Control

**Service Provider Controls**:
- **Allowlist principals**: Restrict which AWS accounts/IAM principals can create endpoints
- **Manual approval**: Review and approve each endpoint connection request
- **Auto-accept**: Automatically accept connections from trusted principals

**Consumer Controls**:
- **Security groups**: Control which resources can access endpoint (by source IP, security group)
- **Endpoint policies**: IAM policy attached to endpoint restricting actions

**Example Endpoint Policy**:
```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:us-east-1:123456789012:api-id/*"
    }
  ]
}
```

### PrivateLink Pricing (January 2025)

| Component | Price (US East) |
|-----------|-----------------|
| **VPC Endpoint (Interface)** | $0.01 per hour (~$7.30/month) |
| **Data Processing** | $0.01 per GB |
| **Gateway Endpoint (S3, DynamoDB)** | Free |

**Cost Example**:
- 10 VPC endpoints: $73/month
- 100 TB data transfer: 100,000 GB × $0.01 = $1,000/month
- **Total: $1,073/month**

**Comparison to VPC Peering**:
- VPC Peering: Free hourly, $0.01 per GB same-region
- PrivateLink: $7.30/month per endpoint + $0.01 per GB
- **Trade-off**: Pay $7.30/month per endpoint for fine-grained service access vs. full VPC access with peering

## AWS Transit Gateway

### What Transit Gateway Provides

**Hub-and-Spoke Connectivity**:
- Single TGW connects thousands of VPCs, VPNs, Direct Connect
- Centralized routing eliminates complex mesh peering
- **Transitive routing**: VPC A can reach VPC C via TGW (A → TGW → C)
- Scales from 10 to 5,000 attachments

**Use Cases**:
- **Multi-VPC connectivity**: 50+ VPCs in same region
- **Multi-region architectures**: TGW peering across regions
- **Hybrid connectivity**: Single VPN/Direct Connect to TGW reaches all VPCs
- **Centralized egress**: All internet traffic routes through centralized egress VPC
- **Network inspection**: All traffic routes through firewall VPC (with Gateway Load Balancer)

### Transit Gateway Architecture

**Components**:

**1. Transit Gateway**:
- Regional resource (one per region)
- Supports up to 5,000 attachments (VPCs, VPNs, Direct Connect, peering)
- Default or custom route tables
- Automatically scaled by AWS (no capacity planning)

**2. Attachments**:
- **VPC attachment**: Connects VPC to TGW via ENIs in each AZ
- **VPN attachment**: Site-to-Site VPN connection
- **Direct Connect Gateway attachment**: Direct Connect connection
- **Peering attachment**: Inter-region TGW-to-TGW connection
- **Connect attachment**: Third-party SD-WAN appliances

**3. Route Tables**:
- **Default route table**: Auto-created, propagates all routes
- **Custom route tables**: Isolate traffic between groups of VPCs
- **Route propagation**: Automatically add routes from attachments

**Architecture Example** (Hub-and-Spoke):
```
                  Transit Gateway
                        |
        ┌───────────────┼───────────────┐
        |               |               |
    VPC-Prod        VPC-Dev        VPC-Shared
     (10.1)         (10.2)          (10.3)
        |               |               |
    App Tier        Test Env      DNS, AD, Tools
```

**With VPN and Direct Connect**:
```
                  Transit Gateway
                        |
        ┌───────┬───────┼───────┬───────┐
        |       |       |       |       |
    VPC-Prod  VPC-Dev  VPN  Direct   VPC-Shared
                           Connect
                              |
                        On-Premises
```

### Transit Gateway vs. VPC Peering

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Transit Gateway</h4>
<ul>
<li>Scalability: Up to 5,000 attachments</li>
<li>Management: Centralized (single TGW)</li>
<li>Transitive Routing: Yes (A → TGW → B → TGW → C)</li>
<li>Cost: $0.05/hour per attachment + $0.02/GB</li>
<li>Bandwidth: 50 Gbps per AZ (bursts to 100 Gbps)</li>
<li>Hybrid: Single attachment to all VPCs</li>
<li>Network Inspection: Centralized firewall VPC</li>
</ul>
<p><strong>When to Use</strong>: &gt;10 VPCs, transitive routing, hybrid connectivity, centralized inspection</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>VPC Peering</h4>
<ul>
<li>Scalability: 125 peering connections per VPC</li>
<li>Management: Distributed (N² connections)</li>
<li>Transitive Routing: No (requires A ↔ C peering)</li>
<li>Cost: Free hourly + $0.01/GB (same region)</li>
<li>Bandwidth: No limit (within VPC throughput)</li>
<li>Hybrid: Separate attachment per VPC</li>
<li>Network Inspection: Distributed (per VPC)</li>
</ul>
<p><strong>When to Use</strong>: &lt;5 VPCs, simple connectivity, cost-sensitive, maximum bandwidth</p>
</div>
</div>

### Transit Gateway Routing

**Route Propagation**:
- Automatically add routes from attachments to route table
- VPC attachment: Propagates VPC CIDR blocks
- VPN attachment: Propagates BGP routes from on-premises
- Direct Connect: Propagates BGP routes

**Static Routes**:
- Manually add routes to route table
- **Use case**: Override propagated routes, blackhole routes, default routes

**Example Route Table**:
```
Destination         Target              Type
10.1.0.0/16        VPC-Prod           Propagated
10.2.0.0/16        VPC-Dev            Propagated
10.3.0.0/16        VPC-Shared         Propagated
192.168.0.0/16     VPN                Propagated
0.0.0.0/0          VPC-Egress         Static
```

**Blackhole Routes**:
- Drop traffic to specific destinations
- **Use case**: Block traffic to specific CIDR ranges

### Transit Gateway Peering (Multi-Region)

**What It Provides**:
- Connect Transit Gateways across regions
- Encrypted over AWS global network
- Supports static routes (no BGP route propagation)

**Architecture**:
```
Region US-East-1                Region EU-West-1
  Transit Gateway  ←─ Peering ─→  Transit Gateway
       |                               |
  ┌────┴────┐                     ┌────┴────┐
VPC-Prod  VPC-Dev               VPC-EU-Prod VPC-EU-Dev
```

**Cost**:
- Peering attachment: $0.05 per hour (each side)
- Data transfer: Inter-region rates ($0.02 per GB US-East to US-West)

**Use case**: Multi-region applications, disaster recovery, global services.

### Transit Gateway Network Isolation

<div class="callout callout--warning">
<p class="callout__title">Security Isolation</p>
<p>The default TGW route table allows all attached VPCs to communicate. Always use custom route tables to isolate production from dev/test environments to prevent unauthorized access and meet compliance requirements.</p>
</div>

**Problem**: Default route table allows all VPCs to communicate. Need to isolate prod from dev.

**Solution**: Custom Route Tables

**Example**: Isolate Production from Dev/Test

**Route Table 1 (Production)**:
```
Attachments: VPC-Prod, VPC-Shared, VPN
Routes:
  10.1.0.0/16 → VPC-Prod (propagated)
  10.3.0.0/16 → VPC-Shared (propagated)
  192.168.0.0/16 → VPN (propagated)
```

**Route Table 2 (Dev/Test)**:
```
Attachments: VPC-Dev, VPC-Test, VPC-Shared
Routes:
  10.2.0.0/16 → VPC-Dev (propagated)
  10.4.0.0/16 → VPC-Test (propagated)
  10.3.0.0/16 → VPC-Shared (propagated)
```

**Result**:
- Production VPCs can reach shared services and on-premises
- Dev/Test VPCs can reach shared services but NOT production
- Shared services VPC accessible from both (DNS, AD, monitoring)

### Transit Gateway Pricing (January 2025)

| Component | Price (US East) |
|-----------|-----------------|
| **TGW Attachment** | $0.05 per hour (~$36.50/month) |
| **Data Processing** | $0.02 per GB |

**Cost Example**:
- 10 VPC attachments: $365/month
- 1 VPN attachment: $36.50/month
- Total attachments: $401.50/month
- Data processing: 50 TB/month = 50,000 GB × $0.02 = $1,000/month
- **Total: $1,401.50/month**

**VPC Peering Alternative**:
- 10 VPCs full mesh = 45 peering connections
- Peering cost: Free hourly
- Data transfer: 50 TB × $0.01/GB = $500/month
- **Total: $500/month**

**Analysis**: TGW costs $901.50/month more BUT provides centralized management, transitive routing, and hybrid connectivity. Worth it for complex architectures.

## PrivateLink + Transit Gateway Integration

<div class="callout callout--note">
<p class="callout__title">Integration Pattern</p>
<p>PrivateLink and Transit Gateway solve different problems and can be used together. Use TGW for full VPC connectivity and PrivateLink for exposing specific services to hundreds of consumers without granting full VPC access.</p>
</div>

### Use Case: Shared Services Architecture

**Problem**: 50 VPCs need access to centralized services (DNS, Active Directory, monitoring, logging).

**Solution 1: VPC Peering**:
- 50 VPCs × 1 shared VPC = 50 peering connections
- Each VPC route table needs entry for shared VPC CIDR
- Shared services accessible via private IPs

**Solution 2: Transit Gateway**:
- 50 VPCs + 1 shared VPC = 51 attachments to TGW
- Route propagation automatically distributes routes
- **Cost**: 51 attachments × $36.50/month = $1,861.50/month

**Solution 3: PrivateLink**:
- Shared VPC exposes services via VPC Endpoint Services
- Each of 50 VPCs creates VPC Endpoints
- **Cost**: 50 endpoints × $7.30/month = $365/month

**Cost Comparison**:
- VPC Peering: Free (+ $0.01/GB data transfer)
- Transit Gateway: $1,861.50/month (+ $0.02/GB)
- PrivateLink: $365/month (+ $0.01/GB)

**Best Solution**: **PrivateLink** for specific services (DNS, monitoring APIs), VPC Peering for full VPC access if needed.

### Use Case: SaaS Service Delivery

**Problem**: SaaS provider needs to expose service to 1,000 customer VPCs.

**VPC Peering**: Impossible (125 peering limit per VPC)

**Transit Gateway**: Not suitable (customer VPCs in different AWS accounts, don't want transitive routing)

**PrivateLink**: Perfect
- Provider creates VPC Endpoint Service backed by NLB
- Each customer creates VPC Endpoint in their VPC
- Provider manually approves each endpoint (security)
- Customers access service via private IP (no internet exposure)

**Cost** (Provider):
- VPC Endpoint Service: Free
- NLB: $0.0225/hour (~$16.20/month) + LCU costs
- **Total**: $16.20/month + NLB LCU costs (shared across all customers)

**Cost** (Each Customer):
- VPC Endpoint: $7.30/month
- Data transfer: $0.01/GB

**Scalability**: Supports thousands of customers, provider infrastructure doesn't scale linearly.

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

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Common Pitfalls</p>
<p>The most expensive mistakes: forgetting TGW data processing costs, using Interface Endpoints for S3/DynamoDB instead of free Gateway Endpoints, and scaling VPC Peering beyond 10 VPCs.</p>
</div>

### 1. Using VPC Peering for >10 VPCs

**Problem**: Full mesh peering becomes unmanageable. 20 VPCs = 190 peering connections.

**Impact**: Route table explosion, manual management, no transitive routing.

**Solution**: Use Transit Gateway for >10 VPCs.

**Cost Impact**: TGW costs $730/month (20 attachments) but saves hundreds of hours in management.

### 2. Not Using Gateway Endpoints for S3/DynamoDB

**Problem**: Using Interface Endpoints for S3/DynamoDB costs $7.30/month per endpoint.

**Solution**: Use Gateway Endpoints (free for S3/DynamoDB).

**Cost Impact**: 10 Interface Endpoints for S3 = $73/month. Gateway Endpoints = Free. **Savings: $73/month.**

### 3. Forgetting TGW Data Processing Costs

**Problem**: Focus on attachment costs ($36.50/month) but ignore data processing ($0.02/GB).

**Example**: 100 TB/month data transfer via TGW = 100,000 GB × $0.02 = $2,000/month (5x higher than attachment costs).

**Solution**: Calculate data transfer costs before choosing TGW. For high-traffic, consider VPC Peering ($0.01/GB) or optimize data flows.

**Cost Impact**: Unexpected $2,000/month bill.

### 4. Not Isolating Production with TGW Route Tables

**Problem**: Using default TGW route table allows all VPCs to communicate (including dev → prod).

**Impact**: Security risk, compliance violations, potential data leakage.

**Solution**: Create custom route tables to isolate production from dev/test.

**Cost Impact**: Free (no additional cost for custom route tables). Prevents data breaches worth millions.

### 5. Using PrivateLink When VPC Peering Would Suffice

**Problem**: Creating VPC Endpoint for every service when VPC Peering grants access to all services.

**Example**: 20 services × $7.30/month = $146/month for PrivateLink vs. $0/month for VPC Peering.

**Solution**: Use PrivateLink only when you need fine-grained service access or scaling to hundreds of consumers.

**Cost Impact**: Wasted $146/month.

### 6. Not Enabling TGW Route Propagation

**Problem**: Manually adding routes to TGW route table instead of enabling propagation.

**Impact**: Route table becomes out-of-sync when VPC CIDRs change, manual management burden.

**Solution**: Enable route propagation for VPC and VPN attachments.

**Cost Impact**: Free. Saves hours of manual route management.

### 7. Exposing Services Publicly Instead of Using PrivateLink

**Problem**: Exposing internal services via public ALB/NLB for partner access.

**Impact**: Security risk (services accessible from internet), requires VPN or IP whitelisting.

**Solution**: Use PrivateLink to expose services privately to partner VPCs.

**Cost Impact**: VPC Endpoint costs $7.30/month but eliminates security risk and VPN overhead.

### 8. Not Monitoring TGW Bandwidth Utilization

**Problem**: TGW has 50 Gbps per AZ limit (bursts to 100 Gbps). Saturation causes packet drops.

**Impact**: Degraded performance, packet loss, application errors.

**Solution**: Monitor `BytesIn` and `BytesOut` in CloudWatch, set alarms for >40 Gbps per AZ.

**Cost Impact**: Packet loss during saturation degrades user experience.

### 9. Using TGW for Simple 2-VPC Connectivity

**Problem**: Using TGW when simple VPC Peering would work.

**Cost**:
- TGW: 2 attachments × $36.50/month = $73/month + $0.02/GB
- VPC Peering: Free + $0.01/GB

**Solution**: Use VPC Peering for <5 VPCs with simple connectivity.

**Cost Impact**: Wasted $73/month.

### 10. Not Using TGW Network Manager for Visibility

**Problem**: Managing TGW manually without centralized visibility into global network.

**Solution**: Enable TGW Network Manager for topology visualization, CloudWatch metrics, and monitoring.

**Cost**: Free (included with TGW).

**Benefit**: Centralized visibility, faster troubleshooting, network insights.

## Key Takeaways

**AWS PrivateLink**:
- Use for private service exposure to hundreds/thousands of consumer VPCs
- Scales better than VPC Peering (no 125 peering limit)
- Fine-grained access control per service (not entire VPC)
- $0.01 per endpoint-hour + $0.01 per GB processed
- Perfect for SaaS providers, shared services, partner integration

**AWS Transit Gateway**:
- Use for >10 VPCs requiring full mesh connectivity
- Hub-and-spoke reduces connections from N² to N
- Supports transitive routing (VPC A → TGW → VPC B → TGW → VPC C)
- Centralized routing and network inspection
- $0.05 per attachment-hour + $0.02 per GB processed

**Cost Optimization**:
- Use Gateway Endpoints for S3/DynamoDB (free vs. $7.30/month for Interface Endpoints)
- VPC Peering cheaper for <5 VPCs with low data transfer
- PrivateLink cheaper than TGW for specific service access (not full VPC connectivity)
- Monitor data processing costs (often exceed attachment costs)

**Architecture Patterns**:
- **Shared Services**: PrivateLink for specific services, TGW for full VPC access
- **Multi-VPC (>10)**: Transit Gateway with custom route tables for isolation
- **SaaS Delivery**: PrivateLink (scales to thousands of customers)
- **Multi-Region**: TGW Peering for inter-region connectivity

**Best Practices**:
- Enable TGW route propagation (automatic route management)
- Use custom TGW route tables to isolate production from dev/test
- Use Gateway Endpoints for S3/DynamoDB (free)
- Monitor TGW bandwidth utilization (50 Gbps per AZ limit)
- Use PrivateLink for services exposed to many consumers

**When NOT to Use**:
- **PrivateLink**: Simple 2-VPC connectivity (use VPC Peering instead)
- **Transit Gateway**: <5 VPCs with simple requirements (use VPC Peering)
- **VPC Peering**: >10 VPCs full mesh, need transitive routing (use TGW)
