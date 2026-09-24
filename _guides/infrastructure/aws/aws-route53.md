---
title: "AWS Route 53 for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "Comprehensive guide to AWS Route 53 covering DNS routing policies, health checks, traffic management, failover strategies, cost optimization, and global traffic distribution"
tags: [aws, route53, dns, routing-policies, health-checks, traffic-management, cost-optimization, fundamentals]
---

## What Is Amazon Route 53?

Amazon Route 53 is a highly available and scalable Domain Name System (DNS) web service that translates domain names into IP addresses and routes end users to applications.

**What Problems Route 53 Solves**:
- **DNS reliability**: Traditional DNS vulnerable to outages; Route 53 provides 100% uptime SLA
- **Global traffic distribution**: Manual traffic routing complex; Route 53 automates based on latency, geography, health
- **Failover complexity**: Detecting and routing around failures requires monitoring; Route 53 health checks automate failover
- **Multi-region applications**: Directing users to nearest region manually is impractical; Route 53 latency-based routing automates
- **Traffic testing**: A/B testing and blue/green deployments require traffic splitting; Route 53 weighted routing enables controlled rollouts

**When to use Route 53**:
- You need highly available DNS with 100% uptime SLA
- You require automated failover for multi-region applications
- You want to route users to the lowest-latency endpoint
- You need geolocation-based content delivery
- You want to implement blue/green deployments or A/B testing

## Routing Policies

Route 53 offers seven routing policies for different traffic management scenarios.

### Simple Routing

One-to-one mapping between domain and single resource.

**How It Works**:
- Returns single resource (IP address, load balancer, CloudFront distribution)
- No health checks
- If multiple values specified, returns all values in random order (client chooses)

**Use Cases**:
- Single web server
- Static websites
- Applications without redundancy

**Example**:
- `example.com` → `203.0.113.5`

### Weighted Routing

Distribute traffic across multiple resources in specified proportions.

**How It Works**:
- Assign weight to each record (0-255)
- Traffic percentage = Record weight / Sum of all weights
- Can associate health checks (skip unhealthy resources)

**Use Cases**:
- **A/B testing**: 90% production, 10% new version
- **Blue/green deployments**: Gradually shift traffic from blue to green
- **Load distribution**: Unequal capacity across regions (70% us-east-1, 30% eu-west-1)

**Example**:
- Record A (weight 7): 70% traffic → us-east-1 load balancer
- Record B (weight 3): 30% traffic → eu-west-1 load balancer

**Cost**: No additional charge beyond standard query fees.

### Latency-Based Routing

Route users to lowest-latency AWS Region.

**How It Works**:
- Route 53 measures latency from user's location to each AWS Region
- Returns resource in Region with lowest latency
- Based on actual latency measurements, not geographic proximity

**Use Cases**:
- Multi-region applications prioritizing performance
- Global user base with uneven distribution
- Applications where speed matters more than data residency

**Example**:
- User in Tokyo → Routes to ap-northeast-1 (lowest latency)
- User in London → Routes to eu-west-2 (lowest latency)
- User in New York → Routes to us-east-1 (lowest latency)

**Performance**: Typically reduces latency by 50-70% vs single-region deployment.

### Failover Routing

Active-passive failover for high availability.

**How It Works**:
- Define primary and secondary resources
- Health check monitors primary resource
- If primary fails, Route 53 automatically returns secondary
- Failback when primary recovers

**Use Cases**:
- **Disaster recovery**: Primary region (us-east-1) fails → Secondary region (us-west-2)
- **Maintenance windows**: Direct traffic to secondary during primary maintenance
- **Active-passive architecture**: Database read replicas, standby servers

**Example**:
- Primary: us-east-1 load balancer (health check: HTTPS on /health)
- Secondary: us-west-2 load balancer (no health check)
- Primary fails → Traffic routes to us-west-2

**Failover Time**: 30-60 seconds (health check frequency + TTL)

### Geolocation Routing

Route based on user's geographic location.

**How It Works**:
- Route 53 identifies user's location (continent, country, state)
- Returns resource mapped to that location
- Can define default location (catch-all)

**Use Cases**:
- **Content localization**: Serve region-specific content (language, currency, pricing)
- **Data residency**: Keep EU users' data in EU regions (GDPR compliance)
- **License restrictions**: Block access from specific countries
- **Load distribution**: Regional load balancers

**Example**:
- Users in EU → eu-west-1 load balancer (GDPR compliance)
- Users in US → us-east-1 load balancer
- Users in Asia → ap-southeast-1 load balancer
- Default → us-east-1 load balancer

**Granularity**: Continent → Country → State (US only)

### Geoproximity Routing (2024 Enhancement)

Route based on geographic location with bias adjustments.

**How It Works**:
- Routes to nearest resource by default
- Apply bias (+/-99) to expand or shrink geographic region
- Positive bias: Attract more traffic from farther away
- Negative bias: Reduce traffic from nearby areas

**Use Cases**:
- **Cost optimization**: Shift traffic to cheaper regions
- **Capacity management**: Reduce load on constrained resources
- **Testing**: Gradually expand new region's coverage
- **Data residency with flexibility**: Prefer local resources but allow overflow

**Example**:
- us-east-1 (bias +50): Expanded coverage, attracts traffic from wider area
- eu-west-1 (bias 0): Standard coverage
- ap-southeast-1 (bias -25): Reduced coverage, only serves nearby users

**2024 Update**: Expanded availability from Traffic Flow to all DNS records (public and private hosted zones).

### Multivalue Answer Routing

Return multiple IP addresses with health checks.

**How It Works**:
- Returns up to 8 healthy records randomly selected
- Each record has own health check
- Client chooses from returned values
- Unhealthy records excluded

**Use Cases**:
- **Simple load distribution**: Multiple web servers without load balancer
- **Cost optimization**: Avoid load balancer costs for small applications
- **DNS-based availability**: Client-side failover

**Example**:
- 10 web server IP addresses with health checks
- Route 53 returns 8 healthy IPs
- Client connects to one randomly

**vs Weighted Routing**: Multivalue is simpler (equal distribution, no weight configuration).

## Health Checks

Health checks monitor resource availability and enable automated failover.

### Types of Health Checks

**1. Endpoint Health Checks**:
- Monitor HTTP/HTTPS/TCP endpoints
- Specified by IP address or domain name
- Check interval: 10 seconds (fast) or 30 seconds (standard)
- Failure threshold: 3 consecutive failures = unhealthy

**2. Calculated Health Checks**:
- Monitor status of other health checks
- Use Boolean logic (AND, OR, NOT)
- Example: Require 2 of 3 child health checks healthy

**3. CloudWatch Alarm Health Checks**:
- Monitor CloudWatch alarms
- Use any CloudWatch metric
- Example: Lambda error rate, DynamoDB throttles

### Health Check Configuration

**Endpoint Health Check Parameters**:
- **Protocol**: HTTP, HTTPS, TCP
- **Port**: Default 80 (HTTP), 443 (HTTPS), or custom
- **Path**: `/health` or custom health check endpoint
- **Interval**: 30 seconds (standard, $0.50/month) or 10 seconds (fast, $1/month)
- **Failure threshold**: Default 3 (1-10 allowed)
- **String matching**: Optional HTTP response body check

**Health Check Regions**:
- Route 53 checks from multiple global locations (15+ regions)
- Majority consensus determines health status
- Prevents false positives from single location issues

### Failover Scenarios

**Active-Passive Failover**:
- Primary resource with health check
- Secondary resource (no health check, always considered healthy)
- Primary unhealthy → Traffic routes to secondary

**Active-Active Failover**:
- Multiple resources, each with health check
- Traffic distributed across healthy resources
- Unhealthy resources automatically excluded

**Combination Failover**:
- Mix routing policies (latency + failover, weighted + health checks)
- Complex multi-region architectures
- Example: Latency-based routing with failover per region

### Health Check Pricing (2024)

- **Standard health checks** (30s interval): $0.50/month per health check
- **Fast health checks** (10s interval): $1.00/month per health check
- **Calculated health checks**: $0.50/month per health check
- **CloudWatch alarm health checks**: $0.50/month per health check

**Example Cost**:
- 10 endpoints × $0.50 = $5/month
- High availability across 3 regions (6 endpoints + 3 calculated) = $4.50/month

## DNS Fundamentals

### Record Types

**A Record**: IPv4 address
- `example.com` → `203.0.113.5`

**AAAA Record**: IPv6 address
- `example.com` → `2001:0db8:85a3::8a2e:0370:7334`

**CNAME Record**: Alias to another domain
- `www.example.com` → `example.com`
- Cannot be used for zone apex (example.com)

**Alias Record** (AWS-specific):
- Points to AWS resources (CloudFront, ALB, S3, API Gateway)
- Can be used for zone apex
- **Free queries** (no charge for Alias record queries to AWS resources)

**MX Record**: Mail exchange
- Priority + mail server
- `10 mail.example.com`

**TXT Record**: Text information
- SPF, DKIM, domain verification

### TTL (Time to Live)

Controls how long DNS resolvers cache the record.

**Short TTL** (60-300 seconds):
- Faster propagation of changes
- Higher query costs (more queries to Route 53)
- Use for: Frequently changing IPs, testing, deployments

**Long TTL** (3600-86400 seconds):
- Lower query costs (fewer queries)
- Slower propagation of changes
- Use for: Stable resources, cost optimization

**Alias Records**: TTL managed by Route 53 (cannot be changed).

**Best Practice**: Start with short TTL (60s) during testing, increase to long TTL (3600s+) for production stability.

## Hosted Zones

Container for DNS records for a domain.

### Public Hosted Zones

DNS records accessible from the internet.

**Pricing**:
- **$0.50/month** per hosted zone
- **$0.40 per million queries** (first 1 billion/month)
- **$0.20 per million queries** (after 1 billion/month)

**Use Cases**:
- Public-facing websites
- APIs accessible from internet
- Email servers

### Private Hosted Zones

DNS records accessible only within VPCs.

**Pricing**:
- **$0.50/month** per hosted zone
- **Queries are FREE** (no per-query charges)

**Use Cases**:
- Internal services (databases, microservices)
- Private APIs
- Service discovery within VPC

**Configuration**:
- Associate with one or more VPCs
- Can span multiple AWS accounts (VPC sharing)

**Best Practice**: Use private hosted zones for internal services to avoid exposing internal DNS and save on query costs.

## Cost Optimization

### Strategies to Reduce Route 53 Costs

<div class="callout callout--tip">
<p class="callout__title">Cost Optimization: Use Alias Records</p>
<p><strong>Queries to Alias records pointing to AWS resources are FREE.</strong> This is the single biggest cost optimization for Route 53.</p>
<p>Example: 100 million queries/month to CloudFront:</p>
<ul>
<li>Via A record: $40/month</li>
<li>Via Alias record: $0/month</li>
<li><strong>Savings: 100%</strong></li>
</ul>
</div>

**1. Use Alias Records for AWS Resources**:
- **Queries to Alias records pointing to AWS resources are FREE**
- Standard A/AAAA records: $0.40 per million queries
- Savings: 100% on queries to CloudFront, ALB, S3, API Gateway

**2. Increase TTL Values**:
- Higher TTL = fewer queries = lower costs
- 60s TTL: ~1.4 billion queries/month for 1,000 req/s traffic
- 3600s TTL: ~24 million queries/month for same traffic
- **Savings**: 98% query reduction

**3. Use Private Hosted Zones for Internal Services**:
- Public hosted zone: $0.50/month + $0.40 per million queries
- Private hosted zone: $0.50/month + **FREE queries**
- Internal services with 1 billion queries: **$400/month savings**

**4. Consolidate Hosted Zones**:
- Multiple subdomains: Use single hosted zone with multiple records
- Example: api.example.com, www.example.com, cdn.example.com → One hosted zone
- Savings: $0.50/month per consolidated domain

**5. Delete Unused Hosted Zones**:
- Audit monthly billing for unused zones
- Each unused zone: $0.50/month wasted

**6. Share Resolver Endpoints Across Accounts**:
- Resolver endpoint: $0.125/hour per ENI = $91/month per endpoint
- Share single endpoint across multiple VPCs/accounts (same region)
- Savings: $91/month per avoided endpoint

### Cost Example

**Scenario**: Website with 100 million requests/month, CloudFront + ALB

**Before Optimization**:
- Hosted zone: $0.50
- A record to CloudFront: 100M queries × $0.40/M = $40
- A record to ALB: 20M queries × $0.40/M = $8
- **Total**: $48.50/month

**After Optimization**:
- Hosted zone: $0.50
- Alias to CloudFront: FREE
- Alias to ALB: FREE
- Increased TTL (300s → 3600s): 80% fewer queries
- **Total**: $0.50/month

**Savings**: $48/month (99%)

## Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **1. Using A records instead of Alias for AWS resources** | $40/100M queries wasted | Use Alias records (free queries to AWS resources) |
| **2. Low TTL on stable resources** | 10-60x higher query costs | Increase TTL to 3600s+ for production (98% cost reduction) |
| **3. No health checks for failover** | Manual failover, downtime during outages | Configure health checks ($0.50/month, automated failover) |
| **4. Public hosted zone for internal services** | $0.40/M queries + security risk | Use private hosted zones (free queries, VPC-only access) |
| **5. No default geolocation record** | Users in unmapped locations get NXDOMAIN | Always define default location (catch-all) |
| **6. Single-region deployment** | Users far from region experience high latency | Use latency-based routing across multiple regions |
| **7. Not testing health checks** | False positives/negatives, improper failover | Test health checks with intentional failures |
| **8. Unused hosted zones** | $0.50/month wasted per zone | Audit and delete unused zones monthly |
| **9. Equal weighted routing for unequal capacity** | Overloading smaller instances | Adjust weights based on capacity (70/30 vs 50/50) |
| **10. No bias in geoproximity routing** | Traffic distribution doesn't match needs | Use bias to shift traffic to preferred regions |
| **11. Missing secondary for failover** | Failover incomplete (no fallback) | Always define secondary resource |
| **12. Health check interval too slow** | 30s+ detection delay | Use fast health checks (10s) for critical apps ($1/month) |
| **13. Not using private hosted zones** | Exposing internal DNS, higher costs | Create private hosted zones for internal services |
| **14. Complex routing without testing** | Unexpected traffic patterns | Test routing policies in dev/staging first |
| **15. No CloudWatch alarms for health checks** | Unnoticed health check failures | Create alarms for HealthCheckStatus metric |

**Cost Impact Examples**:
- **Pitfall #1** (A vs Alias): 100M queries = **$40/month wasted**
- **Pitfall #2** (Low TTL): 60s → 3600s TTL = **98% query reduction**
- **Pitfall #4** (Public vs Private): 1B internal queries = **$400/month wasted**

## Integration Patterns

### Route 53 + CloudFront

**Global Content Delivery**:
- Route 53 Alias record → CloudFront distribution (free queries)
- Latency-based routing to multiple CloudFront distributions (multi-region)
- Geolocation routing for compliance (serve EU content from EU distribution)

### Route 53 + Application Load Balancer

**Multi-Region Load Balancing**:
- Latency-based routing → ALB in each region
- Health checks on ALB targets
- Automatic failover if region becomes unhealthy

**Blue/Green Deployments**:
- Weighted routing: 90% blue ALB, 10% green ALB
- Gradually shift weights: 70/30, 50/50, 30/70, 0/100
- Rollback: Shift weight back to blue

### Route 53 + API Gateway

**API Traffic Management**:
- Alias record → API Gateway (free queries)
- Weighted routing for API version testing (v1: 95%, v2: 5%)
- Geolocation routing for regional APIs (GDPR compliance)

### Route 53 + Multi-Region Databases

**Read Replica Routing**:
- Latency-based routing to RDS read replicas in each region
- Health checks on each replica
- Lowest-latency reads for global applications

**Failover to Secondary Region**:
- Primary record → us-east-1 Aurora cluster (health check)
- Secondary record → us-west-2 Aurora cluster
- Automatic failover if primary cluster fails

## Key Takeaways

**Routing Policies**:
- **Simple**: Single resource, no health checks
- **Weighted**: A/B testing, blue/green (10% new version, 90% old)
- **Latency-Based**: Route to lowest-latency region (50-70% latency reduction)
- **Failover**: Active-passive disaster recovery (30-60s failover)
- **Geolocation**: Content localization, data residency (GDPR)
- **Geoproximity**: Location-based with bias (2024: available for all records)
- **Multivalue**: Simple load distribution (up to 8 healthy IPs)

**Health Checks**:
- Monitor HTTP/HTTPS/TCP endpoints ($0.50/month standard, $1/month fast)
- Enable automated failover (no manual intervention)
- Check from 15+ global locations (majority consensus)
- Calculated health checks combine multiple checks (Boolean logic)

**Cost Optimization**:
- Use Alias records for AWS resources (100% query cost savings)
- Increase TTL for stable resources (98% query reduction: 60s → 3600s)
- Private hosted zones for internal services (free queries vs $0.40/M)
- Consolidate hosted zones ($0.50/month per zone)

**High Availability**:
- Failover routing with health checks (30-60s automated failover)
- Multi-region latency-based routing (50-70% latency improvement)
- Active-active with weighted routing + health checks

**100% Uptime SLA**:
- Route 53 is the only AWS service with 100% availability SLA
- Globally distributed infrastructure (multiple edge locations)
- No single point of failure

**Pricing**:
- Hosted zones: $0.50/month
- Queries: $0.40 per million (first 1B), $0.20 per million (after 1B)
- **Alias queries to AWS resources: FREE**
- Health checks: $0.50-$1/month each
