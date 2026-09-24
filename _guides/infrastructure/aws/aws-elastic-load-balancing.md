---
title: "AWS Elastic Load Balancing for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS Elastic Load Balancing covering ALB, NLB, and GWLB comparison, target groups, health checks, TLS termination, cross-zone load balancing, cost optimization, and deployment patterns"
tags: [aws, load-balancing, alb, nlb, gwlb, high-availability, scalability, cost-optimization, fundamentals]
---

## What Problems Elastic Load Balancing Solves

AWS Elastic Load Balancing (ELB) automatically distributes incoming application traffic across multiple targets to improve availability, scalability, and fault tolerance. It solves critical challenges for production applications:

**Availability Problems**:
- Single EC2 instance cannot provide high availability (instance failure = complete outage)
- Manual failover is slow (5-30 minutes to detect failure and reroute traffic)
- Applications cannot survive Availability Zone (AZ) outages without manual intervention
- Health check monitoring requires custom scripts and external services

**Scalability Problems**:
- Fixed capacity cannot handle traffic spikes (Black Friday, product launches, viral events)
- Manual scaling requires provisioning instances and updating DNS (10-30 minute delay)
- DNS-based scaling has caching issues (TTL delays can be hours)
- No automatic scaling based on real-time traffic patterns

**Security Problems**:
- Applications must handle TLS/SSL termination, consuming CPU resources
- Certificate management across dozens of instances is complex and error-prone
- No central point for Web Application Firewall (WAF) integration
- Backend instances directly exposed to internet without protection layer

**Operational Problems**:
- Traffic distribution is manual and error-prone
- No built-in connection draining for graceful instance removal
- Monitoring individual instances requires complex aggregation
- Blue/green deployments require DNS changes and scripting

**ELB's Solution**:
- **Three load balancer types**: Application Load Balancer (ALB) for HTTP/HTTPS, Network Load Balancer (NLB) for TCP/UDP, Gateway Load Balancer (GWLB) for security appliances
- **Automatic scaling**: Scales to handle millions of requests per second with no manual intervention
- **Built-in health checks**: Automatically detects and routes around unhealthy targets
- **Multi-AZ by default**: Distributes traffic across multiple Availability Zones for 99.99% availability
- **TLS/SSL termination**: Offloads encryption/decryption from backend instances
- **Integration with Auto Scaling**: Automatically adds/removes targets based on demand
- **Free**: No hourly charges for the load balancer resource itself (only for LCUs - Load Balancer Capacity Units)

ELB integrates with VPC, Auto Scaling, Route 53, CloudWatch, and AWS Certificate Manager (ACM) to provide a complete high-availability solution.

## Load Balancer Types Comparison

AWS offers three modern load balancer types, each optimized for specific use cases:

| Feature | Application Load Balancer (ALB) | Network Load Balancer (NLB) | Gateway Load Balancer (GWLB) |
|---------|--------------------------------|----------------------------|------------------------------|
| **OSI Layer** | Layer 7 (Application) | Layer 4 (Transport) | Layer 3 (Network) + Layer 7 |
| **Protocols** | HTTP, HTTPS, HTTP/2, gRPC, WebSocket | TCP, UDP, TLS | IP (all protocols) |
| **Routing** | Path, host, header, query string, method | IP address + port | Transparent (GENEVE) |
| **Latency** | ~10-50ms (connection termination) | <1ms (pass-through) | ~5-15ms (inspection overhead) |
| **Throughput** | Millions of requests/sec | Millions of packets/sec, 100s Gbps | Depends on appliances |
| **Static IP** | No (DNS-based) | Yes (Elastic IP per AZ) | Yes (via GWLB endpoints) |
| **TLS Termination** | Yes (built-in) | Yes (2019+) | No (transparent proxy) |
| **WebSocket** | Yes | Yes (TCP mode) | No |
| **Target Types** | EC2, IP, Lambda, ALB | EC2, IP, ALB | EC2, IP (appliances) |
| **Health Checks** | HTTP, HTTPS, gRPC | TCP, HTTP, HTTPS | TCP, HTTP, HTTPS |
| **Cross-Zone LB** | Always enabled (no charge) | Optional ($0.01/GB processed) | Always enabled (no charge) |
| **Pricing Model** | $0.0225/hour + LCU | $0.0225/hour + NLCU | $0.0125/hour + GLCU |
| **Use Case** | Web apps, microservices, APIs | Gaming, IoT, extreme performance | Firewall, IDS/IPS, DPI |

### When to Use Each Load Balancer

**Use Application Load Balancer (ALB) when**:
- You need HTTP/HTTPS routing (path-based, host-based, header-based)
- You want to route to Lambda functions or containers
- You need AWS WAF integration for security
- You need authentication via Cognito or OIDC
- You want advanced request/response manipulation
- Latency tolerance is 10-50ms (typical web application)

**Use Network Load Balancer (NLB) when**:
- You need ultra-low latency (<1ms) and high throughput
- You require static IP addresses (Elastic IP per AZ)
- You need to preserve source IP addresses
- You're load balancing TCP/UDP traffic (databases, game servers, IoT)
- You want to expose services via AWS PrivateLink
- You need TLS termination for non-HTTP protocols

**Use Gateway Load Balancer (GWLB) when**:
- You need to inspect traffic with third-party security appliances
- You're deploying firewalls, IDS/IPS, or deep packet inspection (DPI) tools
- You want transparent traffic interception (bump-in-the-wire)
- You need centralized security inspection for multiple VPCs
- You're using third-party appliances from AWS Marketplace

<div class="callout callout--tip">
<p class="callout__title">Default Recommendation</p>
<p>Use ALB for most HTTP/HTTPS applications. Use NLB only when you need low latency, static IPs, or PrivateLink. Use GWLB only for security appliance integration.</p>
</div>

## Application Load Balancer (ALB)

### Routing Capabilities

ALB provides sophisticated Layer 7 routing based on request attributes:

**1. Path-Based Routing**:
- `/api/*` → API target group (ECS containers)
- `/images/*` → Image server target group (EC2 instances)
- `/admin/*` → Admin target group (separate security group)

**2. Host-Based Routing**:
- `api.example.com` → API target group
- `www.example.com` → Web server target group
- `admin.example.com` → Admin target group

**3. Header-Based Routing**:
- `X-Forwarded-For: 10.0.*.*` → Internal target group
- `User-Agent: Mobile*` → Mobile-optimized target group

**4. Query String Routing**:
- `?version=2` → New version target group
- `?version=1` → Old version target group

**5. HTTP Method Routing**:
- `GET` → Read-only replica target group
- `POST/PUT/DELETE` → Primary database target group

**6. Source IP Routing**:
- `10.0.0.0/8` → Internal target group
- `0.0.0.0/0` → External target group

**Example: Microservices Routing**:

```
ALB Listener (HTTPS:443)
├─ Rule 1: Host = api.example.com AND Path = /users/* → Users Service (ECS)
├─ Rule 2: Host = api.example.com AND Path = /orders/* → Orders Service (ECS)
├─ Rule 3: Host = api.example.com AND Path = /inventory/* → Inventory Service (Lambda)
├─ Rule 4: Host = www.example.com → Web Frontend (EC2 Auto Scaling)
└─ Default: Return 404
```

### Target Groups

**Target Group Types**:

**1. Instance Target Type** (most common):
- Targets are EC2 instances registered by instance ID
- Traffic routed to primary private IP of instance
- Health checks performed against instance
- Use case: Auto Scaling groups, traditional applications

**2. IP Target Type**:
- Targets are IP addresses (can be in VPC or on-premises)
- Traffic routed to specific IP address and port
- Supports IPv4 and IPv6
- Use case: Containers (ECS/EKS), on-premises servers via Direct Connect/VPN, Lambda functions

**3. Lambda Target Type**:
- Targets are Lambda functions
- ALB invokes Lambda function with HTTP request as JSON event
- Lambda returns HTTP response
- Use case: Serverless APIs, event-driven applications

**4. ALB Target Type** (NLB only):
- NLB can forward traffic to ALB
- Combines NLB static IPs with ALB Layer 7 routing
- Use case: PrivateLink services that need content-based routing

**Target Group Attributes**:

| Attribute | Default | Purpose |
|-----------|---------|---------|
| **Deregistration delay** | 300 seconds | Connection draining timeout |
| **Slow start duration** | 0 seconds (disabled) | Ramp-up time for new targets |
| **Stickiness** | Disabled | Session affinity via cookies |
| **Load balancing algorithm** | Round robin | Request distribution method |
| **HTTP/2** | Enabled | Protocol between ALB and clients |
| **gRPC** | Disabled | gRPC protocol support |

**Deregistration Delay** (Connection Draining):
- When target is deregistered, ALB stops sending new requests
- Existing connections continue for up to deregistration delay (default 300s)
- After delay, ALB forcibly closes remaining connections
- **Best practice**: Set to 30-60 seconds for most applications

**Slow Start**:
- New targets receive gradually increasing share of traffic
- Example: 30-second slow start gives target time to warm up caches
- Linear ramp-up from 0% to full share over slow start duration
- **Use case**: Applications with significant warm-up time (JVM, caches)

**Stickiness** (Session Affinity):
- ALB sets application cookie (`AWSALB`) to bind user to specific target
- Duration: 1 second to 7 days (default 1 day)
- **Use case**: Stateful applications that store session data locally
- **Better alternative**: Use external session store (ElastiCache, DynamoDB)

### Health Checks

ALB performs active health checks to detect unhealthy targets:

**Health Check Configuration**:

| Parameter | Range | Default | Recommendation |
|-----------|-------|---------|----------------|
| **Protocol** | HTTP, HTTPS | HTTP | Match target protocol |
| **Path** | Any URI | `/` | Use dedicated health endpoint |
| **Port** | 1-65535 | Traffic port | Use traffic port unless custom |
| **Interval** | 5-300 seconds | 30 seconds | 10-30s for faster detection |
| **Timeout** | 2-120 seconds | 5 seconds | 5s for most apps |
| **Healthy threshold** | 2-10 | 5 | 2-3 for faster recovery |
| **Unhealthy threshold** | 2-10 | 2 | 2 for faster detection |
| **Success codes** | 200-499 | 200 | 200 for most apps |

**Health Check Example**:
- Interval: 10 seconds
- Timeout: 5 seconds
- Healthy threshold: 2
- Unhealthy threshold: 2

**Behavior**:
- Unhealthy detection: 2 consecutive failures = 20 seconds (2 × 10s interval)
- Healthy recovery: 2 consecutive successes = 20 seconds
- **Best practice**: Use dedicated health endpoint that checks dependencies (database, cache)

**Advanced Health Check Features** (2024):

**Target Group Zonal Health Thresholds**:
- Minimum number of healthy targets per AZ (percentage or count)
- If healthy targets fall below threshold, AZ is marked unhealthy
- DNS failover routes traffic only to healthy AZs
- **Use case**: Prevent cascading failures when AZ is degraded

**Example**:
- Target group has 10 instances across 2 AZs (5 per AZ)
- Zonal health threshold: 50% (minimum 2.5 instances, rounds to 3)
- If AZ-A has only 2 healthy instances, mark AZ-A unhealthy
- Route 53 DNS health check fails for AZ-A, traffic goes only to AZ-B

### TLS/SSL Termination

**Certificate Management**:
- ALB integrates with AWS Certificate Manager (ACM)
- ACM provides free SSL/TLS certificates with automatic renewal
- Supports Server Name Indication (SNI) for multiple certificates
- Up to 25 certificates per ALB (default quota)

**SNI (Server Name Indication)**:
- Single ALB can host multiple HTTPS websites with different certificates
- Client sends hostname in TLS handshake
- ALB selects appropriate certificate based on hostname
- **No additional cost** for SNI

**Example**:
```
ALB Listener (HTTPS:443)
├─ api.example.com → Certificate A (ACM)
├─ www.example.com → Certificate B (ACM)
└─ admin.example.com → Certificate C (ACM)
```

**TLS Policies**:
- ALB supports TLS 1.0, 1.1, 1.2, 1.3
- **Default policy**: ELBSecurityPolicy-TLS13-1-2-2021-06 (TLS 1.2/1.3 only)
- **Recommended**: Use default policy (TLS 1.2/1.3) unless legacy clients required
- **FIPS 140-3 validated**: Use ELBSecurityPolicy-TLS13-1-2-FIPS-2023-04 for compliance

**Cipher Suites**:
- Modern policies support forward secrecy (ECDHE)
- AES-GCM for encryption (faster than CBC)
- ChaCha20-Poly1305 for mobile devices

### Authentication and Authorization

**AWS Cognito Integration**:
- Offload authentication to Cognito User Pools
- ALB verifies JWT tokens automatically
- Redirects unauthenticated users to Cognito login page
- **Use case**: Web applications needing user authentication

**OIDC (OpenID Connect) Integration**:
- Integrate with third-party identity providers (Google, Facebook, Okta, Auth0)
- ALB performs OAuth 2.0 authorization code flow
- Sets headers (`X-Amzn-Oidc-Data`, `X-Amzn-Oidc-Identity`) for backend
- **Use case**: Enterprise SSO, social login

**Configuration Example**:
```
Listener Rule:
  IF Path = /app/*
  THEN
    1. Authenticate via Cognito User Pool
    2. Forward to Application Target Group
```

### Integration with AWS WAF

**WAF Capabilities on ALB**:
- Filter requests based on IP address, geographic location, HTTP headers, body content
- Block SQL injection and cross-site scripting (XSS) attacks
- Rate limiting (requests per IP address per 5 minutes)
- Managed rule groups (OWASP Top 10, known bad inputs, bot control)

**Pricing**:
- Web ACL: $5/month
- Rules: $1/month per rule
- Requests: $0.60 per 1 million requests

**Example Rules**:
- Block traffic from specific countries (geo-blocking)
- Rate limit: Max 2,000 requests per IP per 5 minutes
- AWS Managed Rules: Core Rule Set (CRS) for OWASP Top 10

### Cross-Zone Load Balancing

**ALB Behavior**:
- Cross-zone load balancing is **always enabled** for ALB
- No additional charges for cross-zone traffic
- Traffic distributed evenly across all registered targets in all enabled AZs

**Example**:
- AZ-A: 2 instances
- AZ-B: 8 instances
- Without cross-zone: AZ-A gets 50% traffic (each instance gets 25%), AZ-B gets 50% (each instance gets 6.25%)
- **With cross-zone (ALB default)**: All 10 instances get 10% traffic each (balanced)

### Cost Model

**ALB Pricing** (US East, January 2025):

| Component | Price |
|-----------|-------|
| **Load Balancer Hour** | $0.0225 per hour (~$16.20/month) |
| **LCU (Load Balancer Capacity Unit)** | $0.008 per LCU-hour |

**LCU Dimensions** (charged for highest dimension):
1. **New connections**: 25 connections/second
2. **Active connections**: 3,000 connections/minute
3. **Processed bytes**: 1 GB/hour (2 GB for HTTP/2)
4. **Rule evaluations**: 1,000 rule evaluations/second

**Example Cost Calculation**:

**Scenario**: Web application with moderate traffic
- New connections: 100/second = 4 LCUs
- Active connections: 5,000/minute = 1.67 LCUs
- Processed bytes: 10 GB/hour = 10 LCUs ← **Highest dimension**
- Rule evaluations: 500/second = 0.5 LCUs

**Monthly Cost**:
- Load balancer: $16.20
- LCUs: 10 LCUs × $0.008 × 730 hours = $58.40
- **Total: $74.60/month**

**Cost Optimization**:
- Consolidate multiple ALBs using host-based routing (save $16.20/month per ALB removed)
- Reduce rule complexity (fewer rule evaluations)
- Enable HTTP/2 for clients (better compression, fewer connections)
- Use CloudFront in front of ALB (cache static content, reduce processed bytes by 60-90%)

## Network Load Balancer (NLB)

### Performance Characteristics

**Ultra-Low Latency**:
- **<1 millisecond** latency (vs. ALB's 10-50ms)
- Connection pass-through (no termination)
- Single-packet processing for UDP

**High Throughput**:
- Millions of requests per second
- Handles sudden traffic spikes with no pre-warming
- **100s of Gbps** throughput per AZ

**Millions of Concurrent Connections**:
- Supports millions of simultaneous TCP connections
- No connection limits (unlike ALB)

**Example Use Cases**:
- **Online gaming**: Sub-millisecond latency critical for real-time gameplay
- **IoT**: Millions of device connections
- **Financial trading**: Ultra-low latency requirements
- **Video streaming**: High throughput for live streams

### Static IP Addresses

**Elastic IP Support**:
- NLB assigns **one Elastic IP per AZ**
- Static IP addresses remain constant even if NLB scales
- Supports IP whitelisting for firewalls
- **Use case**: Partners/clients require IP whitelisting

**Example**:
```
NLB in 3 AZs:
  us-east-1a: 54.123.45.67 (Elastic IP A)
  us-east-1b: 54.123.45.68 (Elastic IP B)
  us-east-1c: 54.123.45.69 (Elastic IP C)

DNS record: nlb-example.us-east-1.elb.amazonaws.com
  → Resolves to all 3 Elastic IPs
```

**Private IP Addresses**:
- NLB can use private IPs instead of Elastic IPs
- **Use case**: Internal load balancers

### Source IP Preservation

**Client IP Preservation**:
- NLB preserves source IP address by default (no X-Forwarded-For header needed)
- Backend sees actual client IP in connection
- **Use case**: IP-based access control, logging, analytics

**Behavior**:
- **ALB**: Backend sees ALB's IP, client IP in `X-Forwarded-For` header
- **NLB**: Backend sees client's IP directly

**Proxy Protocol v2**:
- Optional for TCP listeners
- Prepends connection metadata (source IP, destination IP, ports) to TCP stream
- **Use case**: Applications that need client IP but accept connections through proxy

### TLS Termination (2019+)

**NLB TLS Features**:
- Terminate TLS connections at NLB
- Offload TLS from backend instances (80% CPU reduction observed)
- Supports SNI for multiple certificates
- Access logs include TLS protocol version, cipher suite, handshake time

**Performance Impact**:
- **Without TLS termination**: EC2 instances at 80%+ CPU for TLS handshakes
- **With TLS termination**: EC2 instances at ~6% CPU (NLB handles TLS)

**Configuration**:
```
Listener: TLS:443
  Default SSL certificate: ACM certificate
  SSL policy: ELBSecurityPolicy-TLS13-1-2-2021-06
  Target Group: TCP:8080 (unencrypted to backend)
```

**Use case**: Non-HTTP protocols that need TLS (MQTT, custom TCP applications)

### QUIC Protocol Support (2024)

**What is QUIC**:
- Modern transport protocol built on UDP
- Faster connection establishment than TCP+TLS (0-RTT)
- Improved performance on mobile networks (connection migration)
- Used by HTTP/3

**NLB QUIC Support** (announced 2024):
- Forward QUIC traffic (UDP) to targets
- Session stickiness using QUIC Connection IDs
- Ultra-low latency (sub-millisecond)
- **Use case**: Mobile-first applications, HTTP/3, video conferencing

### Cross-Zone Load Balancing

**NLB Behavior**:
- Cross-zone load balancing is **optional** (disabled by default)
- If enabled, charged **$0.01 per GB** processed (cross-AZ data transfer)
- If disabled, traffic distributed only to targets in same AZ as NLB node

**When to Enable Cross-Zone LB**:
- Uneven target distribution across AZs
- Need even traffic distribution regardless of AZ
- Cross-AZ data transfer cost ($0.01/GB) is acceptable

**When to Disable Cross-Zone LB**:
- Targets evenly distributed across AZs
- Want to minimize cross-AZ data transfer costs
- Prefer AZ isolation (traffic stays in same AZ)

**Example**:
- AZ-A: 2 instances
- AZ-B: 8 instances
- **Without cross-zone**: AZ-A instances get 50% each (overloaded), AZ-B instances get 6.25% each
- **With cross-zone**: All 10 instances get 10% each (balanced) but $0.01/GB for cross-AZ traffic

### PrivateLink Integration

**AWS PrivateLink**:
- Expose services to other VPCs without VPC peering or Transit Gateway
- NLB is required for PrivateLink endpoints
- Consumers access service via VPC endpoint (private IP)
- Traffic never traverses public internet

**Use Case**:
- SaaS provider exposing service to customer VPCs
- Sharing internal services across AWS accounts
- Accessing AWS Marketplace partner services

**Example**:
```
Provider VPC:
  Application running on EC2 instances
  NLB in front of instances
  VPC Endpoint Service pointing to NLB

Consumer VPC:
  VPC Endpoint interface in consumer's subnet
  Consumer accesses service via endpoint's private IP
```

### Cost Model

**NLB Pricing** (US East, January 2025):

| Component | Price |
|-----------|-------|
| **Load Balancer Hour** | $0.0225 per hour (~$16.20/month) |
| **NLCU (NLB Capacity Unit)** | $0.006 per NLCU-hour |
| **Cross-Zone Data Transfer** | $0.01 per GB (if enabled) |

**NLCU Dimensions** (charged for highest dimension):
1. **New connections**: 800 connections/second (TCP), 400 flows/second (UDP)
2. **Active connections**: 100,000 connections/minute (TCP), 50,000 flows/minute (UDP)
3. **Processed bytes**: 1 GB/hour

**Example Cost Calculation**:

**Scenario**: Gaming server with high connection rate
- New TCP connections: 5,000/second = 6.25 NLCUs
- Active connections: 200,000/minute = 2 NLCUs
- Processed bytes: 50 GB/hour = 50 NLCUs ← **Highest dimension**

**Monthly Cost**:
- Load balancer: $16.20
- NLCUs: 50 NLCUs × $0.006 × 730 hours = $219
- Cross-zone (100 TB/month): $1,000
- **Total: $1,235.20/month**

**Cost Optimization**:
- Disable cross-zone load balancing if targets are evenly distributed (save $0.01/GB)
- Use Target Group Weighting to route traffic to cheaper regions
- Consolidate NLBs where possible

## Gateway Load Balancer (GWLB)

### Transparent Traffic Inspection

**Bump-in-the-Wire Architecture**:
- GWLB operates transparently (does not modify packets)
- Preserves source/destination IP addresses
- Uses GENEVE protocol (UDP port 6081) to encapsulate traffic
- Security appliances see original packet headers

**GENEVE Encapsulation**:
```
Original Packet:
  Source IP: 203.0.113.5 (client)
  Destination IP: 10.0.1.50 (application server)

GWLB Encapsulates:
  Outer Header: GWLB → Security Appliance
  GENEVE Header: Flow metadata
  Inner Packet: Original packet (unchanged)

Security Appliance:
  Decapsulates GENEVE
  Inspects original packet
  Re-encapsulates and returns to GWLB

GWLB Forwards:
  Original packet to application server (source IP preserved)
```

### Supported Security Appliances

**Third-Party Appliances** (AWS Marketplace):
- **Firewalls**: Palo Alto Networks, Fortinet, Check Point, Cisco
- **IDS/IPS**: Suricata, Snort, Trend Micro
- **Deep Packet Inspection (DPI)**: Gigamon, Ixia, cPacket
- **Network Analytics**: Kentik, Flowmon

**Appliance Requirements**:
- Must support GENEVE encapsulation (UDP port 6081)
- Must be deployed in VPC as EC2 instances or Auto Scaling groups
- Must have health check endpoint

### Deployment Patterns

**1. Centralized Inspection VPC**:
- Dedicated inspection VPC hosts security appliances
- GWLB endpoints in each application VPC
- Traffic flows: App VPC → GWLB Endpoint → Inspection VPC → GWLB → Appliances → GWLB → GWLB Endpoint → App VPC

**Architecture**:
```
Application VPC A                Inspection VPC              Application VPC B
─────────────────                ───────────────             ─────────────────
EC2 Instances                    GWLB                        EC2 Instances
      ↓                            ↓                                ↓
GWLB Endpoint A   ←─────→    Security Appliances    ←─────→   GWLB Endpoint B
                                    ↓
                              Firewall/IDS/IPS
                            (Auto Scaling Group)
```

**Use Case**: Centralized security team manages appliances for multiple application teams

**2. Distributed Ingress Inspection**:
- Each VPC has own GWLB endpoint
- Internet Gateway routes traffic to GWLB endpoint first
- Traffic inspected before reaching application

**Architecture**:
```
Internet Gateway
      ↓
VPC Ingress Route Table: 0.0.0.0/0 → GWLB Endpoint
      ↓
GWLB Endpoint → Inspection VPC → Security Appliances
      ↓
Application Subnet
```

**Use Case**: Inspect all inbound internet traffic for threats

**3. Egress Inspection**:
- Application instances route outbound traffic to GWLB endpoint
- Appliances inspect and allow/block based on policy
- Clean traffic exits via NAT Gateway

**Architecture**:
```
Application Instances
      ↓
Route Table: 0.0.0.0/0 → GWLB Endpoint
      ↓
GWLB → Security Appliances (data loss prevention, malware scanning)
      ↓
GWLB Endpoint → NAT Gateway → Internet
```

**Use Case**: Data loss prevention (DLP), prevent exfiltration

### Transit Gateway Appliance Mode

**Problem**:
- Without appliance mode, forward and reverse flows can go to different appliance instances
- Stateful appliances (firewalls) need both flows to same instance

**Solution**: Transit Gateway Appliance Mode
- Ensures symmetric routing (both directions go to same appliance instance)
- Enabled per attachment on Transit Gateway
- **Use case**: Stateful firewalls, IDS/IPS requiring full flow visibility

**Configuration**:
```
Transit Gateway Attachment to Inspection VPC:
  Appliance Mode Support: Enabled
```

**Behavior**:
- Flow hash based on 5-tuple (source IP, dest IP, source port, dest port, protocol)
- Forward and reverse flow hash to same appliance instance
- Appliance instance sees complete bidirectional flow

### Auto Scaling for Appliances

**Integration with Auto Scaling Groups**:
- Security appliances deployed in Auto Scaling groups
- GWLB automatically registers new instances
- Scales based on CPU, network throughput, or custom metrics

**Example Scaling Policy**:
```
Auto Scaling Group: Security Appliances
  Min: 2 instances (high availability)
  Max: 20 instances (burst capacity)
  Desired: 4 instances

Scaling Policies:
  Scale out: CPU > 70% for 5 minutes
  Scale in: CPU < 30% for 15 minutes
```

**Cost Benefit**:
- Pay only for appliances needed (scale down during off-peak)
- Auto Scaling reduces costs by 40-60% vs. fixed capacity

### Cost Model

**GWLB Pricing** (US East, January 2025):

| Component | Price |
|-----------|-------|
| **Load Balancer Hour** | $0.0125 per hour (~$9.13/month) |
| **GLCU (Gateway LCU)** | $0.004 per GLCU-hour |

**GLCU Dimensions** (charged for highest dimension):
1. **Processed bytes**: 1 GB/hour
2. **New connections**: 600 connections/second

**Example Cost Calculation**:

**Scenario**: Centralized inspection for 3 VPCs
- Processed bytes: 200 GB/hour = 200 GLCUs ← **Highest dimension**
- New connections: 1,000/second = 1.67 GLCUs

**Monthly Cost**:
- GWLB: $9.13
- GLCUs: 200 GLCUs × $0.004 × 730 hours = $584
- Security appliances: 4 × c5.xlarge × $0.17/hour × 730 = $496.40
- **Total: $1,089.53/month**

**Plus**: AWS Marketplace software costs for third-party appliances (varies by vendor)

## Advanced Features

### Connection Draining (Deregistration Delay)

**How It Works**:
1. Target is deregistered (instance terminated, Auto Scaling scale-in, manual deregistration)
2. Load balancer marks target as "draining"
3. Stops sending new connections/requests to draining target
4. Existing connections continue for up to deregistration delay (default 300 seconds)
5. After delay, forcibly closes remaining connections

**Configuration**:
- **ALB**: 0-3600 seconds (default 300)
- **NLB**: 0-3600 seconds (default 300)
- **GWLB**: 0-3600 seconds (default 300)

**Best Practice**:
- Web applications: 30-60 seconds (most requests complete in <30s)
- Long-lived connections: 300-600 seconds (WebSocket, streaming)
- Batch processing: 3600 seconds (allow jobs to complete)

### Target Group Weighting

**Use Case**: Weighted traffic distribution for blue/green deployments, canary releases

**How It Works**:
- Attach multiple target groups to same listener rule
- Assign weight to each target group (0-999)
- Traffic distributed proportionally based on weights

**Example**: Canary Deployment
```
Listener Rule: Path = /api/*
  Target Group 1 (Blue - Current Version): Weight 90
  Target Group 2 (Green - New Version): Weight 10

Result: 90% traffic to Blue, 10% to Green
```

**Cost Benefit**:
- Gradual rollout reduces risk (only 10% users affected by bugs)
- Can validate new version with real traffic before full rollout

### Access Logs

**ALB Access Logs**:
- Captures detailed information about requests
- Stored in S3 bucket (GZIP compressed)
- Includes: timestamp, client IP, latencies, request paths, server responses, TLS cipher, user agent

**NLB Access Logs**:
- Captures TLS connection details
- Includes: TLS protocol version, cipher suite, connection time, handshake time

**GWLB Access Logs**:
- Captures flow information
- Includes: source/destination IPs, ports, protocol, bytes transferred

**Cost**:
- Access logs: Free
- S3 storage: $0.023/GB per month (Standard)
- **Best practice**: Use S3 Intelligent-Tiering or lifecycle policies to reduce storage costs

**Use Case**:
- Security analysis (detect anomalies, brute force attacks)
- Performance monitoring (identify slow endpoints)
- Compliance auditing (access logs for PCI DSS, HIPAA)

### Integration with CloudWatch

**Metrics** (published automatically, no charge):

**ALB Metrics**:
- `ActiveConnectionCount`: Current connections
- `TargetResponseTime`: Latency from target
- `RequestCount`: Total requests
- `HTTPCode_Target_4XX_Count`, `HTTPCode_Target_5XX_Count`: Error rates
- `TargetConnectionErrorCount`: Failed connections to targets
- `UnHealthyHostCount`, `HealthyHostCount`: Target health

**NLB Metrics**:
- `ActiveFlowCount`: Current TCP/UDP flows
- `NewFlowCount`: New flows per minute
- `ProcessedBytes`: Bytes processed
- `TCP_Client_Reset_Count`: Client resets
- `TCP_Target_Reset_Count`: Target resets

**GWLB Metrics**:
- `ActiveFlowCount`: Current flows
- `NewFlowCount`: New flows per minute
- `ProcessedBytes`: Bytes processed

**Alarms** (recommended):
- `UnHealthyHostCount > 0` for 5 minutes → Page on-call engineer
- `TargetResponseTime > 1 second` for 10 minutes → Investigate performance
- `HTTPCode_Target_5XX_Count > 100` for 5 minutes → Investigate application errors

**Cost**:
- Standard metrics: Free
- Alarms: $0.10 per alarm per month (first 10 alarms free)

## Common Pitfalls and How to Avoid Them

### 1. Not Using Dedicated Health Check Endpoints

**Problem**: Health checks against application root (`/`) don't verify dependencies (database, cache, external APIs).

**Example**: Application returns 200 OK from `/` even when database is down. Load balancer considers target healthy and sends traffic. Users get 500 errors.

**Impact**: False positives (unhealthy targets marked healthy), 5-20% error rate during database outages.

**Solution**:
- Create dedicated health check endpoint (`/health` or `/healthz`)
- Check critical dependencies (database connectivity, cache availability)
- Return 200 only if all dependencies healthy, 503 if any dependency unhealthy

**Example Implementation**:
```csharp
[HttpGet("/health")]
public IActionResult HealthCheck()
{
    bool dbHealthy = CheckDatabaseConnection();
    bool cacheHealthy = CheckCacheConnection();

    if (dbHealthy && cacheHealthy)
    {
        return Ok(new { status = "healthy", database = "ok", cache = "ok" });
    }
    else
    {
        return StatusCode(503, new { status = "unhealthy", database = dbHealthy ? "ok" : "degraded", cache = cacheHealthy ? "ok" : "degraded" });
    }
}
```

**Cost Impact**: Reduces error rate from 5-20% to <0.1% during partial outages.

### 2. Setting Deregistration Delay Too High

**Problem**: Long deregistration delay (default 300 seconds) delays Auto Scaling scale-in and deployments.

**Example**: Auto Scaling wants to terminate instance during scale-in. Waits 300 seconds for connections to drain. During this time, paying for idle instance.

**Impact**: 5-10 minutes deployment delays, $0.10-$0.50 wasted per scale-in event.

**Solution**:
- Set deregistration delay to match application's typical request duration
- Web applications: 30-60 seconds
- API services: 30 seconds
- Long-lived WebSocket: 300-600 seconds

**Cost Impact**: Reduce deployment time from 10 minutes to 2 minutes. Save $0.30 per scale-in event × 100 events/month = $30/month.

### 3. Not Enabling Cross-Zone Load Balancing for Uneven Target Distribution

**Problem**: Targets unevenly distributed across AZs, cross-zone LB disabled, some targets overloaded.

**Example** (NLB):
- AZ-A: 2 instances
- AZ-B: 8 instances
- Cross-zone LB disabled
- AZ-A instances get 50% of traffic each (overloaded), AZ-B instances get 6.25% each (underutilized)

**Impact**: AZ-A instances at 90% CPU (slow responses), AZ-B instances at 15% CPU (wasted capacity).

**Solution**:
- **ALB**: Cross-zone always enabled (no action needed)
- **NLB**: Enable cross-zone load balancing if target distribution is uneven
- **Cost**: $0.01/GB for cross-AZ data transfer (NLB only)

**Cost Impact**:
- Cross-zone cost: 100 GB/hour × 730 hours × $0.01 = $730/month
- But: Eliminates need to over-provision AZ-A instances (save $200/month on EC2)
- **Net savings**: -$530/month (cost increase, but better performance and lower EC2 costs)

### 4. Using ALB When NLB is Required for PrivateLink

**Problem**: PrivateLink requires NLB, but ALB was deployed. Must rebuild infrastructure to switch.

**Example**: SaaS provider wants to expose service via PrivateLink for customer VPCs. Deployed ALB. Discovers PrivateLink requires NLB.

**Impact**: 1-2 week project to migrate from ALB to NLB, redeploy VPC endpoint services.

**Solution**:
- If you plan to use PrivateLink, start with NLB
- If you need ALB features (Layer 7 routing) AND PrivateLink, use NLB → ALB chaining

**Configuration** (NLB → ALB):
```
PrivateLink VPC Endpoint Service → NLB (static IPs) → ALB (Layer 7 routing) → Target Group
```

**Cost Impact**: NLB → ALB chaining adds $16.20/month (NLB cost) but enables both PrivateLink and Layer 7 routing.

### 5. Not Setting Slow Start for High-Warmup Applications

**Problem**: New targets receive full traffic immediately, overwhelmed during cache warm-up.

**Example**: Java application with 60-second JVM warm-up. New instance added to target group, immediately receives 10% of traffic. Instance slow to respond (cache cold, JVM not optimized). Users experience 2-5 second response times.

**Impact**: 50% of requests to new instances have 2-5 second latency during first 60 seconds.

**Solution**:
- Enable slow start with duration matching warm-up time (30-120 seconds)
- New targets ramp from 0% to full share over slow start duration

**Configuration**:
```
Target Group:
  Slow start duration: 60 seconds
```

**Cost Impact**: Eliminates latency spikes during scale-out events. Improves user experience (P99 latency: 5 seconds → 500ms).

### 6. Forgetting to Enable HTTP/2 for Better Performance

**Problem**: HTTP/2 disabled, clients forced to use HTTP/1.1 (multiple connections, head-of-line blocking).

**Example**: Web application serves 50 assets per page. HTTP/1.1 requires 6 connections per domain (browser limit). HTTP/2 uses 1 multiplexed connection.

**Impact**: 6x more connections, higher latency (100ms vs. 50ms page load time).

**Solution**:
- Enable HTTP/2 on ALB listeners (enabled by default for new ALBs)
- Verify client applications support HTTP/2

**Cost Impact**: Reduces LCU usage (fewer connections). Save 20-40% on LCU costs. Example: $60/month → $40/month.

### 7. Not Using CloudFront in Front of ALB for Static Content

**Problem**: ALB serves all content including static assets, high processed bytes cost.

**Example**: Application serves images, CSS, JS directly from ALB. 500 GB/hour processed bytes = 500 LCUs × $0.008 × 730 = $2,920/month.

**Impact**: High LCU costs for content that could be cached.

**Solution**:
- Deploy CloudFront in front of ALB
- CloudFront caches static assets (images, CSS, JS) at edge locations
- ALB serves only dynamic content (APIs, authenticated requests)

**Cost Impact**:
- Before: 500 GB/hour × 730 hours = 365 TB processed bytes = $2,920/month (LCUs)
- After: 50 GB/hour × 730 hours = 36.5 TB processed bytes = $292/month (LCUs) + $200/month (CloudFront) = $492/month
- **Savings: $2,428/month (83% reduction)**

### 8. Not Configuring Stickiness for Stateful Applications

**Problem**: Stateful application stores session data locally. Requests from same user routed to different instances. User loses session (logged out).

**Example**: E-commerce application stores shopping cart in instance memory. User adds item to cart (instance A). Next request goes to instance B (no cart data). User sees empty cart.

**Impact**: Poor user experience, lost revenue (users abandon checkout).

**Solution**:
- Enable stickiness (session affinity) on target group
- ALB sets `AWSALB` cookie to bind user to specific instance
- Duration: 1 second to 7 days (default 1 day)

**Better Solution**:
- Use external session store (ElastiCache, DynamoDB)
- Stateless instances can handle any request
- Better scalability and resilience

**Cost Impact**: Enabling stickiness is free. Using ElastiCache costs $30-100/month but enables better scaling and resilience.

### 9. Using Multiple ALBs Instead of Host-Based Routing

**Problem**: Separate ALB for each microservice increases costs and complexity.

**Example**: 5 microservices, each with own ALB. 5 × $16.20/month = $81/month just for load balancer hours.

**Impact**: Unnecessary costs, complex management (5 ALBs to monitor).

**Solution**:
- Use single ALB with host-based or path-based routing
- Route to different target groups based on hostname or path

**Configuration**:
```
ALB Listener (HTTPS:443)
├─ Host = api.example.com → API Target Group
├─ Host = admin.example.com → Admin Target Group
├─ Host = web.example.com → Web Target Group
├─ Host = mobile.example.com → Mobile Target Group
└─ Default → 404
```

**Cost Impact**:
- Before: 5 ALBs × $16.20/month = $81/month
- After: 1 ALB × $16.20/month = $16.20/month
- **Savings: $64.80/month (80% reduction in LB costs)**

### 10. Not Setting Health Check Interval and Thresholds Appropriately

**Problem**: Default health check settings (30s interval, 5 healthy threshold) delay recovery by 150 seconds.

**Example**: Target becomes healthy. Load balancer requires 5 consecutive successes at 30s interval = 150 seconds before routing traffic.

**Impact**: 2.5 minute delay before recovered instance receives traffic.

**Solution**:
- Reduce interval to 10 seconds
- Reduce healthy threshold to 2
- Recovery time: 2 × 10s = 20 seconds

**Configuration**:
```
Health Check:
  Interval: 10 seconds
  Healthy threshold: 2
  Unhealthy threshold: 2
```

**Cost Impact**: Faster recovery reduces error rate during rolling deployments from 5% to 1%. Improves user experience.

### 11. Not Using TLS Termination on NLB for Non-HTTP Protocols

**Problem**: Backend instances handle TLS for custom TCP applications, consuming 80% CPU.

**Example**: MQTT broker over TLS. Each EC2 instance at 80% CPU just for TLS handshakes. Only 20% CPU available for application logic.

**Impact**: Need 4x more instances to handle same application load (high costs).

**Solution**:
- Enable TLS termination on NLB
- Backend instances receive unencrypted TCP traffic
- CPU usage drops from 80% to <10% for TLS

**Cost Impact**:
- Before: 16 × c5.xlarge instances ($0.17/hour) = $1,987/month
- After: 4 × c5.xlarge instances (TLS offloaded) = $497/month
- **Savings: $1,490/month (75% reduction)**

### 12. Deploying Security Appliances Without Auto Scaling (GWLB)

**Problem**: Fixed number of security appliances can't handle traffic spikes, becomes bottleneck.

**Example**: 4 firewall instances handle normal traffic (50 Gbps). Traffic spike to 200 Gbps during DDoS attack. Firewalls overwhelmed, drop packets.

**Impact**: Legitimate traffic dropped during attack, application unavailable.

**Solution**:
- Deploy security appliances in Auto Scaling group
- Scale based on CPU, network throughput, or custom metrics
- GWLB automatically registers new instances

**Configuration**:
```
Auto Scaling Group:
  Min: 2 (HA)
  Max: 20 (burst capacity)
  Scaling Policy: Network In > 10 Gbps per instance → Scale out
```

**Cost Impact**:
- Normal traffic: 4 instances × $1,000/month = $4,000/month
- Traffic spike: 16 instances × $1,000/month × 2 hours/month = $1,000/month (burst)
- **Total: $5,000/month vs. $20,000/month (fixed 16 instances)**
- **Savings: $15,000/month (75% reduction) with better burst capacity**

### 13. Not Configuring Target Group Zonal Health Thresholds

**Problem**: Degraded AZ continues receiving traffic even when most targets are unhealthy, causing cascading failures.

**Example**: AZ-A has 10 instances. Database in AZ-A fails. 8 instances become unhealthy (can't reach database). Load balancer still routes 20% of traffic to AZ-A (2 healthy instances overwhelmed).

**Impact**: 2 healthy instances in AZ-A overwhelmed, become unhealthy. Cascading failure spreads to other AZs.

**Solution**:
- Configure target group zonal health threshold (2024 feature)
- If healthy targets in AZ fall below threshold, mark entire AZ unhealthy
- Route 53 DNS failover routes traffic only to healthy AZs

**Configuration**:
```
Target Group:
  Zonal health threshold: 70% (minimum 7 healthy targets)
```

**Behavior**:
- AZ-A has 10 targets, 8 unhealthy → 20% healthy (below 70% threshold)
- Mark AZ-A unhealthy, stop routing traffic to AZ-A
- AZ-B and AZ-C handle all traffic

**Cost Impact**: Prevents cascading failures that can cause complete outages (cost of outage: $10,000-$100,000+ per hour for e-commerce sites).

### 14. Using Public ALB for Internal Microservices Communication

**Problem**: Public ALB for internal microservices exposes services to internet, increases costs.

**Example**: 5 microservices communicate via public ALB. ALB processes 1 TB/hour of internal traffic. 1 TB/hour × 730 hours = 730 TB/month = $584/month (LCUs) + data transfer.

**Impact**: Unnecessary costs, security risk (services exposed to internet).

**Solution**:
- Use internal (private) ALB for microservices communication
- Internal ALB has no internet-facing IP, only accessible from VPC
- No data transfer charges for traffic within same AZ

**Cost Impact**:
- Before: Public ALB + cross-AZ data transfer = $584/month (LCUs) + $730/month (data transfer) = $1,314/month
- After: Internal ALB + same-AZ targets = $584/month (LCUs) + $0 (data transfer) = $584/month
- **Savings: $730/month (56% reduction)**

### 15. Not Testing Failover Behavior During AZ Outages

**Problem**: Assume multi-AZ setup provides HA, but never test failover. Real AZ outage causes unexpected failures.

**Example**: Application deployed in 2 AZs with ALB. AZ-A fails. ALB routes all traffic to AZ-B. AZ-B targets overwhelmed (capacity planning assumed 50/50 split).

**Impact**: AZ-B targets at 200% expected load, slow responses, some requests timeout.

**Solution**:
- Regularly test AZ failover (monthly or quarterly)
- Simulate AZ failure by manually deregistering all targets in one AZ
- Verify remaining AZs can handle 100% of traffic
- Right-size capacity planning (each AZ should handle 100% load, not just 50%)

**Cost Impact**: Over-provision to 2x capacity costs $1,000/month extra, but prevents outages costing $10,000-$100,000/hour.

## Key Takeaways

**Load Balancer Selection**:
- **Use ALB** for HTTP/HTTPS applications needing Layer 7 routing, WAF integration, Lambda targets, or authentication
- **Use NLB** when you need ultra-low latency (<1ms), static IP addresses, source IP preservation, or PrivateLink integration
- **Use GWLB** only for transparent traffic inspection with third-party security appliances (firewalls, IDS/IPS, DPI)
- **Default choice**: ALB for 80% of use cases

**High Availability**:
- Deploy load balancers in at least 2 AZs (3 AZs recommended for production)
- Enable cross-zone load balancing for even traffic distribution (ALB: always enabled free, NLB: optional $0.01/GB)
- Configure target group zonal health thresholds to prevent cascading failures during AZ degradation
- Test AZ failover regularly (monthly) to verify capacity planning

**Health Checks**:
- Use dedicated health check endpoints that verify critical dependencies (database, cache, external APIs)
- Set aggressive intervals and thresholds for faster detection and recovery (10s interval, 2 thresholds)
- Return 503 (Service Unavailable) when dependencies are unhealthy, not 200 OK

**Performance Optimization**:
- Set deregistration delay to match application request duration (30-60s for web apps, 300-600s for WebSocket)
- Enable slow start for applications with warm-up time (JVM, cache initialization)
- Use HTTP/2 on ALB for better performance and lower costs (reduces connections by 6x)
- Enable TLS termination on load balancer to offload CPU from backend instances (80% CPU reduction)

**Cost Optimization**:
- Consolidate multiple ALBs using host-based or path-based routing (save $16.20/month per ALB removed)
- Use CloudFront in front of ALB to cache static content (reduce processed bytes by 60-90%)
- Disable cross-zone load balancing on NLB if targets are evenly distributed (save $0.01/GB)
- Use internal (private) load balancers for microservices communication (avoid data transfer charges)
- Enable Auto Scaling for GWLB appliances to avoid over-provisioning (save 40-60% vs. fixed capacity)

**Security Best Practices**:
- Always use HTTPS listeners with ACM certificates (free, automatic renewal)
- Use latest TLS policy (TLS 1.2/1.3 only) unless legacy clients required
- Integrate WAF with ALB for Layer 7 threat protection (SQL injection, XSS, rate limiting)
- Use security groups to restrict backend instances to only accept traffic from load balancer
- Enable access logs for compliance auditing and security analysis (stored in S3)

**Architecture Patterns**:
- **NLB → ALB chaining**: Combines NLB static IPs + PrivateLink with ALB Layer 7 routing
- **CloudFront → ALB**: Cache static content at edge, ALB serves dynamic content only
- **GWLB centralized inspection**: Dedicated inspection VPC with security appliances serves multiple application VPCs
- **Internal ALB**: Use for microservices communication to avoid internet exposure and data transfer costs

**Monitoring and Observability**:
- Set CloudWatch alarms for UnHealthyHostCount, TargetResponseTime, HTTPCode_Target_5XX_Count
- Monitor cache hit ratio if using CloudFront in front of ALB (target >85%)
- Enable access logs for detailed request analysis and troubleshooting
- Use X-Ray integration for distributed tracing across ALB and backend services

**When NOT to Use Load Balancers**:
- Single instance applications with no HA requirements (use Elastic IP instead)
- Internal services with <10 requests/second (use Route 53 DNS-based routing)
- Cost-sensitive dev/test environments (use single instance, deploy load balancer for production only)
- Very low traffic (<1000 requests/day) where $16.20/month LB cost is significant
