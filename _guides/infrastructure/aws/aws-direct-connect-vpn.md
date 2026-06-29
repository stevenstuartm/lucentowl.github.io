---
title: "AWS Direct Connect & VPN for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS Direct Connect and Site-to-Site VPN covering hybrid connectivity options, resiliency patterns, high availability architectures, cost analysis, and when to use each solution"
tags: [aws, direct-connect, vpn, hybrid-cloud, networking, high-availability, cost-optimization, fundamentals]
---

## What Problems Direct Connect & VPN Solve

AWS Direct Connect and Site-to-Site VPN enable hybrid cloud architectures by connecting on-premises data centers to AWS. They solve critical connectivity challenges:

**Public Internet Connectivity Problems**:
- Public internet has variable latency (50-500ms) and unpredictable performance
- No bandwidth guarantees (best-effort delivery, congestion during peak hours)
- Security concerns (data traverses public networks, requires encryption overhead)
- Compliance requirements prohibit sending sensitive data over public internet

**Performance Problems**:
- High-bandwidth workloads (data migration, backup/restore, video processing) overwhelm internet connections
- Latency-sensitive applications (trading systems, real-time analytics) require <10ms latency
- Hybrid applications need consistent performance between on-premises and cloud components

**Cost Problems**:
- Data transfer over internet is expensive ($0.09 per GB egress from AWS)
- Internet circuits over-provisioned for peak traffic (95% idle during normal periods)
- VPN throughput limited by CPU (encryption/decryption overhead)

**Availability Problems**:
- Single internet connection = single point of failure
- No SLA for public internet connectivity
- DDoS attacks can overwhelm internet gateway

**AWS Solutions**:

**AWS Direct Connect**:
- **Dedicated network connection** from on-premises to AWS (bypass public internet)
- **Predictable performance**: Consistent latency (<5ms typical), guaranteed bandwidth (50 Mbps to 100 Gbps)
- **Lower cost**: Reduced data transfer pricing ($0.02-$0.05 per GB vs. $0.09 per GB)
- **Multiple resiliency models**: 95% to 99.99% SLA depending on architecture
- **Private connectivity**: Data never traverses public internet

**AWS Site-to-Site VPN**:
- **Encrypted IPsec tunnels** over internet (secure hybrid connectivity)
- **Fast deployment**: Provision in minutes vs. weeks for Direct Connect
- **Lower cost**: $0.05 per VPN connection-hour + data transfer
- **Built-in redundancy**: 2 tunnels per VPN connection across multiple AZs
- **Scalability**: Up to 20 Gbps throughput with ECMP across multiple VPN connections

Both integrate with Virtual Private Gateway (VGW), Transit Gateway (TGW), and VPN CloudHub for multi-VPC and multi-site connectivity.

## Direct Connect vs. Site-to-Site VPN Comparison

| Feature | AWS Direct Connect | AWS Site-to-Site VPN |
|---------|-------------------|---------------------|
| **Connection Type** | Dedicated private connection | Encrypted tunnels over internet |
| **Latency** | <5ms (consistent) | 10-100ms (variable, internet-dependent) |
| **Bandwidth** | 50 Mbps to 100 Gbps (dedicated, hosted) | Up to 1.25 Gbps per tunnel, 20 Gbps with ECMP |
| **Setup Time** | 4-12 weeks (physical provisioning) | Minutes to hours |
| **Cost** | $0.30-$162/hour (port) + $0.02-$0.05/GB (data transfer) | $0.05/hour (VPN connection) + $0.09/GB (data transfer) |
| **SLA** | 95% (classic) to 99.99% (maximum resiliency) | 99.95% (service availability, not connectivity) |
| **Encryption** | No (add VPN over Direct Connect for encryption) | Yes (IPsec, AES-256) |
| **Use Case** | High-bandwidth, low-latency, production workloads | Fast deployment, backup connectivity, dev/test |
| **Deployment Complexity** | High (physical installation, cross-connect, LOA-CFA) | Low (software configuration only) |
| **Data Transfer Pricing** | $0.02-$0.05/GB (varies by location) | $0.09/GB (standard internet egress) |
| **Availability** | Requires redundancy (dual connections) | Built-in (2 tunnels per connection) |

### When to Use Direct Connect

**Use Direct Connect when**:
- **High bandwidth**: >1 Gbps sustained traffic between on-premises and AWS
- **Consistent performance**: Applications require predictable latency (<10ms)
- **Cost optimization**: Large data transfers (>10 TB/month) where Direct Connect data transfer pricing saves money
- **Compliance**: Regulations prohibit sensitive data over public internet
- **Production workloads**: Mission-critical applications requiring 99.9%+ availability
- **Hybrid architectures**: Extending on-premises data center to AWS (VMware Cloud on AWS, databases with read replicas)

**Typical use cases**:
- **Data migration**: Petabyte-scale migrations (DataSync, Snowball Edge with Direct Connect)
- **Disaster recovery**: Real-time replication to AWS (continuous data protection)
- **Hybrid applications**: On-premises SAP/Oracle databases with AWS analytics tier
- **Video production**: High-bandwidth media workflows (4K/8K video rendering in AWS)
- **Financial services**: Trading systems requiring <5ms latency

### When to Use Site-to-Site VPN

**Use Site-to-Site VPN when**:
- **Fast deployment**: Need connectivity in minutes/hours, not weeks
- **Low/moderate bandwidth**: <500 Mbps sustained traffic
- **Backup connectivity**: Redundant path for Direct Connect failover
- **Dev/test environments**: Non-production workloads with relaxed performance requirements
- **Branch offices**: Remote sites with occasional AWS access
- **Cost-sensitive**: Small data transfers (<1 TB/month) where VPN is cheaper

**Typical use cases**:
- **Development environments**: Dev/test/staging connectivity to AWS
- **Disaster recovery**: Backup replication over VPN (less critical than Direct Connect)
- **Remote offices**: Branch connectivity to cloud resources
- **Initial deployment**: Use VPN while waiting for Direct Connect provisioning
- **Failover**: Secondary path when Direct Connect fails

### Cost Comparison Example

**Scenario**: 10 TB data transfer per month, 1 Gbps sustained bandwidth

**Direct Connect** (Dedicated 1 Gbps, US East):
- Port hour: $0.30/hour × 730 hours = $219/month
- Data transfer out: 10 TB × $0.02/GB × 1024 GB/TB = $204.80/month
- **Total: $423.80/month**

**Site-to-Site VPN** (4 VPN connections for 1 Gbps via ECMP):
- VPN connections: 4 × $0.05/hour × 730 hours = $146/month
- Data transfer out: 10 TB × $0.09/GB × 1024 GB/TB = $921.60/month
- **Total: $1,067.60/month**

**Direct Connect savings: $643.80/month (60% cheaper)**

**Breakeven**: Direct Connect becomes cheaper at ~5 TB/month of data transfer.

## AWS Direct Connect

### Connection Types

**1. Dedicated Connection** (1 Gbps, 10 Gbps, 100 Gbps):
- **Physical port** dedicated to single customer at AWS Direct Connect location
- Port speeds: 1 Gbps ($0.30/hour), 10 Gbps ($2.25/hour), 100 Gbps ($12.00/hour)
- You manage entire connection (configure both AWS and on-premises ends)
- Requires Letter of Authorization and Connecting Facility Assignment (LOA-CFA)
- **Setup time**: 4-8 weeks (physical provisioning, cross-connect installation)

**2. Hosted Connection** (50 Mbps to 10 Gbps):
- **Virtual connection** provisioned by AWS Direct Connect Partner
- Bandwidth options: 50, 100, 200, 300, 400, 500 Mbps, 1, 2, 5, 10 Gbps
- Partner manages physical infrastructure, you configure virtual interface
- **Setup time**: 1-2 weeks (faster than dedicated)
- **Use case**: Lower bandwidth needs, don't want to manage physical connection

**Pricing** (US East region, January 2025):

| Connection Type | Bandwidth | Port Hour Cost | Monthly Cost (730 hours) |
|----------------|-----------|----------------|--------------------------|
| Dedicated | 1 Gbps | $0.30 | $219 |
| Dedicated | 10 Gbps | $2.25 | $1,642.50 |
| Dedicated | 100 Gbps | $12.00 | $8,760 |
| Hosted (Partner) | 50 Mbps | Varies by partner | ~$50-$100 |
| Hosted (Partner) | 500 Mbps | Varies by partner | ~$150-$250 |
| Hosted (Partner) | 1 Gbps | Varies by partner | ~$250-$400 |

**Data Transfer Out Pricing** (varies by Direct Connect location):
- First 10 TB: $0.02-$0.05 per GB
- Next 40 TB: $0.02-$0.04 per GB
- Over 150 TB: $0.02-$0.03 per GB

### Virtual Interfaces (VIFs)

Direct Connect uses **virtual interfaces** to connect to AWS services:

**1. Private Virtual Interface (Private VIF)**:
- Connects to VPC via Virtual Private Gateway (VGW) or Transit Gateway (TGW)
- Private IP space (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- **Use case**: Access EC2, RDS, ElastiCache, and other VPC resources

**2. Public Virtual Interface (Public VIF)**:
- Connects to AWS public services (S3, DynamoDB, public IP endpoints)
- Uses public IP addresses (not private RFC 1918)
- **Use case**: Access S3, DynamoDB, CloudFront without traversing internet

**3. Transit Virtual Interface (Transit VIF)**:
- Connects to Transit Gateway (TGW) for multi-VPC connectivity
- Single VIF connects to multiple VPCs via TGW
- **Use case**: Hub-and-spoke architecture, centralized connectivity

**Configuration Limits**:
- Dedicated connection: Up to 50 private/public VIFs + 1 transit VIF
- Hosted connection: Up to 1 VIF (private, public, or transit)

### Direct Connect Gateway

**Problem**: Private VIF connects to single VGW in single region. Multi-region architectures require multiple Direct Connect connections.

**Solution**: Direct Connect Gateway (DXGW)
- **Global resource** that connects to VGWs in multiple regions
- Single Direct Connect connection → DXGW → VPCs in multiple regions
- Supports up to 10 VGWs per DXGW
- **No additional cost** (included with Direct Connect)

**Example Architecture**:
```
On-Premises
     ↓
Direct Connect (1 Gbps)
     ↓
Direct Connect Gateway
     ├─ VPC (us-east-1) via VGW
     ├─ VPC (us-west-2) via VGW
     └─ VPC (eu-west-1) via VGW
```

**Use case**: Multi-region applications with single on-premises connection to all regions.

### Direct Connect Resiliency Models

AWS provides four resiliency models with different SLAs:

**1. Maximum Resiliency (99.99% SLA)**:
- **2 connections** to 2 different Direct Connect locations
- Terminates on separate devices in separate locations
- Protects against: Device failure, connectivity failure, location failure
- **Cost**: 2x connection costs
- **Use case**: Mission-critical production workloads

**Architecture**:
```
On-Premises (2 routers)
     ├─ Connection 1 → DC Location A → AWS Region
     └─ Connection 2 → DC Location B → AWS Region
```

**2. High Resiliency (99.9% SLA)**:
- **2 connections** to 2 different Direct Connect locations
- Terminates in single AWS region
- Protects against: Connectivity failure, device failure
- **Cost**: 2x connection costs
- **Use case**: Production workloads with high availability needs

**3. Development and Test (No SLA)**:
- **2 connections** to same Direct Connect location
- Terminates on separate devices
- Protects against: Device failure only (not location failure)
- **Cost**: 2x connection costs
- **Use case**: Non-production environments

**4. Classic (95% SLA)**:
- **1 connection** to Direct Connect location
- No redundancy
- Single point of failure
- **Use case**: Non-critical workloads, cost-sensitive deployments

**Recommendation**: Use Maximum Resiliency (99.99% SLA) for production workloads.

### Link Aggregation Groups (LAG)

**What It Provides**:
- Combine multiple connections into single logical connection
- Aggregate bandwidth (4 × 10 Gbps = 40 Gbps total)
- Active/active load balancing across connections
- Automatic failover if connection fails

**Requirements**:
- All connections must be same bandwidth
- All connections must terminate at same Direct Connect location
- Maximum 4 connections per LAG (dedicated), 2 connections per LAG (hosted)

**Use case**: Scale beyond single connection bandwidth, built-in redundancy.

**Cost**: No additional charge for LAG (pay for individual connection port hours).

## AWS Site-to-Site VPN

### VPN Architecture

**Components**:

**1. Customer Gateway (CGW)**:
- On-premises VPN device or software VPN
- Public IP address
- Supports IPsec, BGP (dynamic routing) or static routing

**2. Virtual Private Gateway (VGW)**:
- AWS-side VPN endpoint attached to VPC
- Supports up to 10 VPN connections
- **Use case**: Single VPC connectivity

**3. Transit Gateway (TGW)**:
- AWS-side VPN endpoint for multi-VPC connectivity
- Supports ECMP for bandwidth aggregation
- **Use case**: Hub-and-spoke, multi-VPC, multi-region

**4. VPN Connection**:
- 2 IPsec tunnels (one per AZ) for high availability
- Each tunnel: Up to 1.25 Gbps throughput
- AES-256 encryption, SHA-2 hashing

### VPN Throughput and Scaling

**Single VPN Connection**:
- 2 tunnels (one per AZ)
- Up to 1.25 Gbps per tunnel
- **Total**: 2.5 Gbps (active/active with ECMP)

**Multiple VPN Connections with ECMP** (Transit Gateway):
- Combine tunnels from multiple VPN connections
- Up to 50 VPN connections per Transit Gateway
- **Example**: 4 VPN connections = 8 tunnels = up to 10 Gbps aggregate bandwidth

**Enhanced Throughput** (2024 announcement):
- New: 5 Gbps tunnels (2x 5 Gbps = 10 Gbps per VPN connection)
- Combine multiple 5 Gbps VPN connections for >10 Gbps aggregate
- **Use case**: High-bandwidth VPN requirements without Direct Connect

### Dynamic Routing with BGP

**BGP (Border Gateway Protocol)**:
- Automatic route propagation between on-premises and AWS
- Route failover when tunnel fails (30-60 seconds)
- Supports route prioritization (AS path prepending)

**Static Routing**:
- Manual route configuration
- No automatic failover
- **Use case**: Simple deployments, devices without BGP support

**Recommendation**: Use BGP for production workloads (automatic failover, easier management).

### VPN Acceleration

**AWS VPN with Global Accelerator**:
- Route VPN traffic through AWS global network instead of public internet
- Reduce latency by 30-60% (fewer hops, optimized routing)
- Improve consistency (avoid internet congestion)
- **Cost**: $0.025/hour per accelerator + data transfer

**Use case**: Global remote offices, latency-sensitive VPN connections.

### VPN Pricing (January 2025)

| Component | Price |
|-----------|-------|
| **VPN Connection** | $0.05 per hour (~$36.50/month) |
| **Data Transfer Out** | $0.09 per GB (standard internet egress) |
| **Data Transfer In** | Free |

**Cost Example**:
- 1 VPN connection: $36.50/month
- 5 TB data transfer out: 5,000 GB × $0.09 = $450/month
- **Total: $486.50/month**

## Hybrid Architectures

### Direct Connect + VPN (Encrypted High-Performance)

**Architecture**:
- **Primary**: Direct Connect for high-bandwidth, low-latency traffic
- **Overlay**: Site-to-Site VPN over Direct Connect for encryption
- Traffic encrypted end-to-end (on-premises to AWS)

**Configuration**:
```
On-Premises → Direct Connect → Transit VIF → Transit Gateway
                                    ↓
                              Site-to-Site VPN (encrypted)
                                    ↓
                                  VPCs
```

**Benefits**:
- Direct Connect performance + VPN encryption
- Compliance: Data encrypted in transit
- Lower cost than internet-based VPN (Direct Connect data transfer pricing)

**Use case**: Financial services, healthcare (HIPAA), regulated industries requiring encryption.

### Direct Connect + VPN Failover (High Availability)

**Architecture**:
- **Primary**: Direct Connect for production traffic
- **Backup**: Site-to-Site VPN for failover when Direct Connect fails

**BGP Configuration**:
- Direct Connect: AS path length 100 (preferred)
- Site-to-Site VPN: AS path length 200 (backup)
- Automatic failover when Direct Connect fails (60-90 seconds)

**Cost Optimization**:
- VPN connection always provisioned ($36.50/month)
- VPN data transfer only during Direct Connect outage (rare)
- **Trade-off**: $36.50/month for failover insurance

**Use case**: Production workloads requiring 99.9%+ uptime without dual Direct Connect cost.

### Multi-VPC Connectivity with Transit Gateway

**Problem**: Each VPC requires separate VPN connection or VGW. Managing 10 VPCs = 10 VPN connections.

**Solution**: Transit Gateway (TGW)
- **Hub-and-spoke** architecture
- Single VPN connection → TGW → multiple VPCs
- Up to 5,000 attachments per TGW (VPCs, VPNs, Direct Connect)

**Architecture**:
```
On-Premises
     ↓
Site-to-Site VPN
     ↓
Transit Gateway
     ├─ VPC 1 (prod)
     ├─ VPC 2 (staging)
     ├─ VPC 3 (dev)
     └─ VPC 4-10
```

**Cost**:
- Transit Gateway: $0.05 per attachment-hour + $0.02 per GB processed
- **Example**: 10 VPC attachments + 1 VPN attachment = 11 attachments × $0.05/hour × 730 hours = $401.50/month
- Plus: $0.02 per GB data processed (on-premises to VPC traffic)

**Use case**: Multi-VPC environments, hub-and-spoke architectures, centralized on-premises connectivity.

## Common Pitfalls

### 1. Not Implementing Redundancy for Direct Connect

**Problem**: Single Direct Connect connection = single point of failure. Fiber cut, device failure, or location outage causes complete connectivity loss.

**Impact**: Production outage (hours to days depending on repair time), revenue loss, SLA violations.

**Solution**:
- Use Maximum Resiliency model (2 connections to 2 locations)
- Add Site-to-Site VPN failover for additional redundancy

**Cost Impact**: Single connection outage costs $10,000-$100,000+ per hour for e-commerce. Redundancy costs $219-$438/month (2x 1 Gbps connections). **ROI: 100x+**

### 2. Not Enabling BFD for Fast Failover

**Problem**: Default BGP keepalive (60 seconds) + hold timer (180 seconds) = 3 minute failover.

**Solution**:
- Enable Bidirectional Forwarding Detection (BFD)
- BFD detects failures in <1 second
- BGP reconverges immediately after BFD detects failure
- **Failover time**: 3 minutes → <10 seconds

**Configuration**:
```
Customer Gateway (on-premises):
  interface GigabitEthernet0/0
    bfd interval 300 min_rx 300 multiplier 3
    ip address 169.254.10.1 255.255.255.252
```

**Cost Impact**: Free. Reduces outage window from 3 minutes to <10 seconds. For $10,000/hour revenue sites, saves $500 per failover event.

### 3. Using Public VIF for VPC Traffic

**Problem**: Public VIF accesses AWS public services (S3, DynamoDB), not VPC private resources (EC2, RDS).

**Example**: Architect provisions Direct Connect with Public VIF, expects to access EC2 instances in VPC. EC2 has private IPs (10.0.1.50). Public VIF cannot route to private IPs.

**Impact**: Cannot access VPC resources, must reprovision with Private VIF (delays, potential downtime).

**Solution**:
- Use **Private VIF** for VPC connectivity
- Use **Public VIF** only for S3, DynamoDB, CloudFront (public AWS services)

**Cost Impact**: Reprovisioning VIF takes 1-2 days, delays project timeline.

### 4. Not Right-Sizing Direct Connect Bandwidth

**Problem**: Provisioned 10 Gbps connection but only using 500 Mbps average (95th percentile).

**Example**:
- 10 Gbps connection: $1,642.50/month
- Actual usage: 500 Mbps (5% utilization)
- Right-size to 1 Gbps: $219/month
- **Wasted: $1,423.50/month**

**Solution**:
- Monitor Direct Connect bandwidth utilization in CloudWatch
- Start with 1 Gbps, upgrade if sustained >80% utilization
- Consider hosted connection (50-500 Mbps) for lower bandwidth needs

**Cost Impact**: Right-sizing saves $1,423.50/month (86% reduction).

### 5. Using VPN for High-Bandwidth Workloads

**Problem**: VPN throughput limited to 1.25 Gbps per tunnel. Large data transfers (10 TB migration) take days instead of hours.

**Example**:
- 10 TB migration over VPN (1.25 Gbps = 156.25 MB/s)
- Transfer time: 10,000 GB ÷ 156.25 MB/s ÷ 3600 seconds/hour = 17.8 hours
- **vs. Direct Connect** (1 Gbps = 125 MB/s): 10,000 GB ÷ 125 MB/s ÷ 3600 = 22.2 hours

Wait, that doesn't seem right. Let me recalculate:
- 10 TB migration over VPN (1.25 Gbps = 1250 Mbps ÷ 8 = 156.25 MB/s)
- Transfer time: 10,000 GB ÷ 0.15625 GB/s = 64,000 seconds = 17.8 hours
- **vs. Direct Connect** (10 Gbps = 1250 MB/s): 10,000 GB ÷ 1.25 GB/s = 8,000 seconds = 2.2 hours

**Impact**: 17.8 hours vs. 2.2 hours (8x slower).

**Solution**:
- Use Direct Connect for data migrations >1 TB
- Or: Use AWS DataSync over Direct Connect
- Or: Ship data via Snowball/Snowmobile

**Cost Impact**: Time = money. 17.8 hours engineering time monitoring migration = $1,780 (at $100/hour). Direct Connect setup saves time on large migrations.

### 6. Not Using Transit Gateway for Multi-VPC Connectivity

**Problem**: 10 VPCs, each with separate VPN connection = 10 VPN connections to manage, 10x $36.50/month.

**Cost**:
- 10 VPN connections: $365/month
- 10x configuration complexity

**Solution**:
- Use Transit Gateway with single VPN connection
- TGW routes traffic to all VPCs

**Cost Comparison**:
- **Before**: 10 VPNs = $365/month
- **After**: 1 VPN ($36.50) + TGW (11 attachments × $36.50 = $401.50) = $438/month

Wait, that's more expensive. Let me recalculate:
- 10 VPNs direct to VPCs: $365/month
- 1 VPN + TGW (1 VPN attachment + 10 VPC attachments = 11 × $0.05/hour × 730 = $401.50) + VPN ($36.50) = $438/month

**Analysis**: TGW costs $73/month more BUT provides centralized management, easier routing, and scalability. Trade-off: Pay 20% more for simplified management.

**Use case**: TGW valuable when you have >10 VPCs, complex routing, or need Transit VIF for Direct Connect.

### 7. Forgetting Data Transfer Costs

**Problem**: Focus on connection costs ($36.50/month VPN or $219/month Direct Connect) but ignore data transfer costs (can be 10x higher).

**Example**:
- 20 TB/month data transfer out via VPN
- VPN connection: $36.50/month
- Data transfer: 20,000 GB × $0.09/GB = $1,800/month
- **Total: $1,836.50/month** (data transfer is 98% of cost)

**Solution**:
- Calculate data transfer costs before choosing connectivity option
- Direct Connect cheaper for >5 TB/month

**Direct Connect Alternative**:
- 1 Gbps connection: $219/month
- Data transfer: 20,000 GB × $0.02/GB = $400/month
- **Total: $619/month**
- **Savings: $1,217.50/month (66% reduction)**

### 8. Not Monitoring Direct Connect Bandwidth Utilization

**Problem**: Direct Connect bandwidth saturated (100% utilization) causing packet drops, but no alerting configured.

**Impact**: Degraded performance, packet loss, application errors (users blame application, not network).

**Solution**:
- Monitor `ConnectionBpsEgress` and `ConnectionBpsIngress` in CloudWatch
- Set alarm for >80% utilization
- Upgrade connection before saturation

**CloudWatch Alarm**:
```
Metric: ConnectionBpsEgress
Threshold: > 800 Mbps (80% of 1 Gbps)
Alarm: Send SNS notification to network team
```

**Cost Impact**: Packet loss during saturation degrades user experience. Early detection prevents production incidents.

### 9. Not Using Direct Connect LOA-CFA Correctly

**Problem**: Ordering Direct Connect without understanding Letter of Authorization and Connecting Facility Assignment (LOA-CFA) process causes delays.

**Correct Process**:
1. Create Direct Connect connection in AWS Console
2. Download LOA-CFA from AWS
3. Provide LOA-CFA to colocation provider or network service provider
4. Colocation provider uses LOA-CFA to create cross-connect from your cage to AWS cage
5. AWS activates connection after cross-connect installed

**Common mistake**: Waiting for AWS to "activate" connection before ordering cross-connect. Connection won't activate until cross-connect installed. Chicken-and-egg problem.

**Impact**: 2-4 week delay in setup.

**Solution**: Order cross-connect immediately after downloading LOA-CFA (don't wait for AWS activation).

### 10. Using VPN Without ECMP for Bandwidth Scaling

**Problem**: Single VPN connection (2 tunnels) limited to 2.5 Gbps. Need 5 Gbps but don't enable ECMP.

**Solution**:
- Use Transit Gateway (required for ECMP)
- Create multiple VPN connections
- Enable ECMP on Transit Gateway
- Traffic load-balanced across all tunnels

**Configuration**:
```
2 VPN connections = 4 tunnels × 1.25 Gbps = 5 Gbps aggregate
4 VPN connections = 8 tunnels × 1.25 Gbps = 10 Gbps aggregate
```

**Cost**:
- 4 VPN connections: $146/month (vs. 1 Gbps Direct Connect $219/month)
- For <5 Gbps sustained, VPN with ECMP may be cheaper than Direct Connect

## Key Takeaways

**Direct Connect**:
- Use for high-bandwidth (>1 Gbps), low-latency (<5ms), production workloads
- Becomes cost-effective at >5 TB/month data transfer
- Requires 4-12 weeks setup time (plan ahead)
- Use Maximum Resiliency (2 connections, 2 locations) for 99.99% SLA
- Enable BFD for <10 second failover
- Monitor bandwidth utilization, upgrade before saturation

**Site-to-Site VPN**:
- Use for fast deployment (minutes), backup connectivity, dev/test environments
- Limited to 1.25 Gbps per tunnel, 20 Gbps with ECMP
- Built-in encryption (IPsec AES-256)
- $0.05/hour connection + $0.09/GB data transfer
- Use BGP for automatic failover (30-60 seconds)
- Scale with Transit Gateway + ECMP for >2.5 Gbps

**Hybrid Architectures**:
- **Direct Connect + VPN**: Encryption over Direct Connect for compliance
- **Direct Connect + VPN Failover**: Primary Direct Connect, backup VPN (99.9%+ uptime)
- **Transit Gateway**: Hub-and-spoke for multi-VPC connectivity

**Cost Optimization**:
- Direct Connect cheaper than VPN for >5 TB/month data transfer
- Right-size bandwidth (start with 1 Gbps, upgrade if needed)
- Use hosted connections (50-500 Mbps) for lower bandwidth needs
- Monitor utilization to avoid over-provisioning

**Resiliency Best Practices**:
- Maximum Resiliency (99.99% SLA): 2 connections to 2 locations
- Enable BFD for fast failover (<10 seconds)
- Use BGP for automatic route propagation
- Test failover regularly (quarterly)

**When NOT to Use**:
- **Direct Connect**: Bandwidth <500 Mbps, data transfer <5 TB/month, can't wait 4-12 weeks
- **VPN**: Bandwidth >5 Gbps sustained, latency <10ms required, encryption overhead unacceptable
