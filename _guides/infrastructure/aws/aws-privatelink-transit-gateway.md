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
