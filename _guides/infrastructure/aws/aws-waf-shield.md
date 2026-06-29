---
title: "AWS WAF & Shield for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "Comprehensive guide to AWS WAF and Shield covering web application firewall, DDoS protection, managed rules, rate limiting, bot control, and cost optimization for application and network layer defense"
tags: [aws, waf, shield, ddos, security, firewall, bot-control, rate-limiting, application-security, fundamentals]
---

## What Problems WAF & Shield Solve

### Without Application and Network Protection

**Security Challenges:**
- SQL injection attacks penetrate web applications
- Cross-site scripting (XSS) exploits steal user sessions
- DDoS attacks overwhelm servers, causing downtime
- Bots scrape content, brute-force login pages, commit fraud
- No rate limiting; single client can exhaust API quota
- Geo-blocking requires custom application logic
- Application-layer attacks (L7) bypass network firewalls

**Real-World Impact:**
- SQL injection: Attacker extracts 10M customer records from database
- DDoS attack: 500 Gbps volumetric flood takes down website for 6 hours; $2M revenue loss
- Credential stuffing: Bots attempt 1M login combinations; legitimate users can't access site
- Content scraping: Competitor's bot downloads entire product catalog daily
- API abuse: Single client makes 1M API calls in 10 minutes; exceeds capacity; service degraded for all users
- Geographic compliance: Cannot prevent access from sanctioned countries

### With WAF & Shield

**Automated Protection:**

**AWS WAF:**
- **Web application firewall**: Filters HTTP/HTTPS requests based on rules
- **Managed rule groups**: Pre-configured protection against OWASP Top 10, known CVEs
- **Custom rules**: Rate limiting, geo-blocking, IP allow/denylists, custom patterns
- **Bot Control**: ML-powered bot detection and mitigation
- **Real-time visibility**: Logs every blocked/allowed request

**AWS Shield:**
- **Shield Standard**: Automatic DDoS protection at L3/L4 (network/transport layer) - **free**
- **Shield Advanced**: Enhanced DDoS protection + DDoS Response Team + cost protection - **$3,000/month**

**Problem-Solution Mapping:**

| Problem | WAF Solution | Shield Solution |
|---------|-------------|-----------------|
| SQL injection attacks | Managed rule group blocks SQLi patterns | N/A (application-layer attack) |
| DDoS attack (500 Gbps) | N/A (volumetric attack at L3/L4) | Shield Standard/Advanced absorbs traffic |
| Brute-force login attempts | Rate-based rule blocks IPs exceeding threshold | N/A |
| Malicious bots | Bot Control managed rule group detects/blocks bots | N/A |
| API rate limiting | Rate-based rule: 100 requests per 5 min per IP | N/A |
| Geographic compliance | Geo-match rule blocks requests from specific countries | N/A |
| Application-layer DDoS (HTTP flood) | Rate-based rule limits requests per IP | Shield Advanced detects anomalies |
| Zero-day exploit | Managed rules updated within hours of CVE disclosure | N/A |

---

## AWS WAF Fundamentals

### What is AWS WAF?

**AWS WAF** (Web Application Firewall) is a managed firewall that protects web applications from common web exploits at the application layer (OSI Layer 7).

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>WAF inspects HTTP/HTTPS requests; allows, blocks, or counts requests based on rules.</p>
</div>

**WAF Components:**

```
Client → [CloudFront/ALB/API Gateway] → WAF → Application
              ↑
         Web ACL (rules)
```

### Web ACL (Access Control List)

**Web ACL:** Collection of rules that define what traffic to allow, block, or count.

**Web ACL Structure:**

```json
{
  "Name": "ProductionWebACL",
  "DefaultAction": "ALLOW",
  "Rules": [
    {
      "Name": "BlockSQLInjection",
      "Priority": 1,
      "Statement": { "ManagedRuleGroupStatement": {...} },
      "Action": "BLOCK"
    },
    {
      "Name": "RateLimitAPI",
      "Priority": 2,
      "Statement": { "RateBasedStatement": {...} },
      "Action": "BLOCK"
    }
  ]
}
```

**Key Fields:**
- `DefaultAction`: Action for requests not matching any rule (ALLOW or BLOCK)
- `Rules`: Ordered list of rules (evaluated by priority, lowest first)
- `Action`: ALLOW, BLOCK, COUNT (count only, for testing)

### Rule Types

**1. Managed Rule Groups**

Pre-built rule sets maintained by AWS or AWS Marketplace sellers.

| Rule Group | Purpose | Cost |
|------------|---------|------|
| **Core Rule Set** | OWASP Top 10 protection | $10/month + $1/M requests |
| **Known Bad Inputs** | Block known malicious patterns | $10/month + $1/M requests |
| **SQL Database** | SQL injection protection | $10/month + $1/M requests |
| **Linux OS** | Linux-specific exploits | $10/month + $1/M requests |
| **Bot Control** | ML-powered bot detection | $10/month + $10/M requests |

**2. Custom Rules**

User-defined rules based on request attributes.

**Statement Types:**

| Statement | Purpose | Example |
|-----------|---------|---------|
| **IP set** | Match source IP | Allow corporate IP range |
| **Geo match** | Match country of origin | Block requests from specific countries |
| **String match** | Match specific strings in request | Block requests containing `/admin` |
| **Regex pattern** | Match regex pattern | Block credit card numbers in query strings |
| **Size constraint** | Match request size | Block requests >8 KB |
| **Rate-based** | Rate limit per IP | Block IPs exceeding 100 req/5min |

**3. Rule Groups**

Collection of rules you can reuse across Web ACLs.

**Use Case:** Create "API Protection" rule group with rate limiting + Bot Control; reuse across multiple API Gateway endpoints.

### Web ACL Capacity Units (WCUs)

**WCU:** Measure of computational resources required to evaluate rule.

**Limits:**
- Max 5,000 WCUs per Web ACL
- Simple rules: 1 WCU
- Complex rules (regex): 25-50 WCUs
- Managed rule groups: 700-1,500 WCUs

**Example:**

```
Core Rule Set: 700 WCUs
Bot Control: 50 WCUs
Custom rate-based rule: 2 WCUs
Custom IP set rule: 1 WCU

Total: 753 WCUs (within 5,000 limit)
```

---

## AWS Shield Fundamentals

### What is AWS Shield?

**AWS Shield** is a managed DDoS (Distributed Denial of Service) protection service.

**Core Concept:** Detect and mitigate DDoS attacks at network (L3), transport (L4), and application (L7) layers.

### Shield Standard (Free)

**Included with All AWS Accounts:**
- **Automatic protection**: CloudFront, Route 53, Global Accelerator
- **Layer 3/4 DDoS mitigation**: SYN floods, UDP floods, reflection attacks
- **Always-on detection**: No configuration required
- **No additional cost**

**Protection Scope:**
- Volumetric attacks (Gbps-scale floods)
- Protocol attacks (TCP SYN flood, ICMP flood)
- Reflection attacks (DNS amplification, NTP amplification)

**What Shield Standard Does NOT Cover:**
- ALB, NLB, Elastic IP (use Shield Advanced)
- Application-layer (L7) DDoS (use WAF + Shield Advanced)
- Cost protection (data transfer charges during attack)
- DDoS Response Team support

### Shield Advanced ($3,000/month)

**Enhanced DDoS Protection + Services:**

**1. Extended Resource Protection**
- CloudFront, Route 53, Global Accelerator (same as Standard)
- **ALB, NLB, Elastic IP** (additional)
- Classic Load Balancer (deprecated, but covered)

**2. Advanced DDoS Detection**
- **Layer 7 (application-layer) DDoS detection**: HTTP floods, slow-read attacks
- **Baseline traffic profiling**: ML learns normal traffic patterns; detects anomalies
- **Near real-time notifications**: SNS alerts when attack detected

**3. DDoS Response Team (DRT)**
- **24/7 support**: AWS DDoS experts available during attacks
- **Incident response**: DRT analyzes attack; recommends mitigations
- **Proactive engagement**: Optional automatic engagement (DRT creates WAF rules during attack)

**4. Cost Protection**
- **Data transfer charge protection**: AWS credits for scaling costs during DDoS attack
- **No overage charges**: Shield Advanced subscription covers DDoS-related data transfer spikes

**5. Advanced Metrics and Reporting**
- **DDoS attack history**: Dashboard showing all detected attacks
- **CloudWatch metrics**: Real-time attack metrics (packets/sec, bits/sec)
- **Attack reports**: Post-attack analysis and recommendations

**When to Use Shield Advanced:**

✅ **Use Shield Advanced when:**
- Protecting ALB, NLB, or Elastic IP (not covered by Shield Standard)
- Need L7 (application-layer) DDoS protection
- DDoS attacks cause significant cost spikes (data transfer charges)
- Business-critical application requiring 24/7 DDoS support
- Require DDoS attack reports for compliance

❌ **Don't need Shield Advanced if:**
- Only using CloudFront/Route 53 (Shield Standard sufficient)
- DDoS risk low (internal application, small traffic volume)
- Can tolerate brief outages without 24/7 support

---

## WAF vs Shield

### Service Comparison

| Feature | AWS WAF | AWS Shield Standard | AWS Shield Advanced |
|---------|---------|---------------------|-------------------|
| **Protection Layer** | Application (L7) | Network/Transport (L3/L4) | L3/L4/L7 |
| **Attack Types** | SQL injection, XSS, bots, rate limiting | Volumetric DDoS, protocol attacks | DDoS + application-layer attacks |
| **Supported Resources** | CloudFront, ALB, API Gateway, AppSync | CloudFront, Route 53, Global Accelerator | Same + ALB, NLB, Elastic IP |
| **Cost** | $5/mo per Web ACL + $1/M requests | Free (included) | $3,000/mo + $1/M requests |
| **Configuration** | Rules, rate limiting, managed rule groups | Automatic (no configuration) | Automatic + DRT support |
| **Use Case** | Block malicious requests, rate limiting, bot control | Automatic DDoS protection | Enhanced DDoS + 24/7 support |

### When to Use Both (Recommended)

**WAF + Shield Advanced = Defense in Depth**

**Architecture:**

```
DDoS Attack (L3/L4) → Shield Advanced (absorbs volumetric flood)
                             ↓
HTTP Flood (L7)          → WAF (rate limits requests per IP)
                             ↓
                    Protected Application
```

**Example: E-Commerce Site During Black Friday**

**Without WAF/Shield:**
- Competitor launches DDoS attack (500 Gbps SYN flood + 100K req/sec HTTP flood)
- Site goes down for 6 hours
- Loss: $2M revenue + reputation damage

**With WAF + Shield Advanced:**
- Shield Advanced absorbs SYN flood (500 Gbps) at network edge
- WAF rate-limits HTTP flood (blocks IPs exceeding 100 req/5min)
- DRT monitors attack; adjusts WAF rules in real-time
- Site stays online
- AWS credits data transfer charges (cost protection)

---

## Managed Rules

### AWS Managed Rule Groups

**Pre-configured rule sets** maintained by AWS Security team.

**Core Rule Set (CRS):**
- **Purpose**: OWASP Top 10 protection
- **Rules**: 50+ rules covering SQL injection, XSS, RCE, LFI, etc.
- **Cost**: $10/month + $1/M requests
- **WCU**: 700

**Example Rules in CRS:**
- `SQLi_QUERYARGUMENTS`: Blocks SQL injection in query strings
- `XSS_COOKIE`: Blocks XSS in cookies
- `SizeRestrictions_BODY`: Blocks oversized request bodies (>8 KB)
- `GenericRFI_QUERYARGUMENTS`: Blocks remote file inclusion

**Known Bad Inputs:**
- **Purpose**: Block requests from known malicious sources
- **Rules**: IP reputation, known malicious user-agents, known attack patterns
- **Cost**: $10/month + $1/M requests
- **WCU**: 200

**Bot Control:**
- **Purpose**: ML-powered bot detection
- **Detection**: Verified bots (Google, Bing), likely bots, likely humans
- **Cost**: $10/month + $10/M requests
- **WCU**: 50

**Bot Control Actions:**

```json
{
  "Name": "BotControl",
  "Statement": {
    "ManagedRuleGroupStatement": {
      "VendorName": "AWS",
      "Name": "AWSManagedRulesBotControlRuleSet",
      "ManagedRuleGroupConfigs": [{
        "AWSManagedRulesBotControlRuleSet": {
          "InspectionLevel": "COMMON"
        }
      }]
    }
  },
  "OverrideAction": {
    "Count": {}
  }
}
```

**Inspection Levels:**
- `COMMON`: Blocks obvious bots, monitors suspicious
- `TARGETED`: More aggressive (may block legitimate automation)

### AWS Marketplace Managed Rules

**Third-party rule sets** from security vendors.

| Vendor | Rule Set | Purpose | Cost |
|--------|----------|---------|------|
| **F5** | F5 BIG-IP | Advanced threat protection | $25-100/mo |
| **Fortinet** | FortiWeb Managed Rules | OWASP + zero-day protection | $20-80/mo |
| **Imperva** | Imperva Managed Rules | PCI-DSS compliance, bot protection | $30-150/mo |
| **Trend Micro** | TippingPoint Threat Rules | Emerging threats, CVE protection | $25-100/mo |

**When to Use Marketplace Rules:**
- Need specialized protection (PCI-DSS compliance from vendor)
- Require zero-day exploit protection with vendor SLAs
- Want threat intelligence from security vendors

---

## Custom Rules and Rate Limiting

### Rate-Based Rules

**Rate-based rule:** Block IPs exceeding request threshold within 5-minute window.

**Use Cases:**
- Prevent brute-force login attempts
- API rate limiting
- Mitigate application-layer DDoS (HTTP floods)

**Example: Block IPs Exceeding 100 Requests per 5 Minutes**

```json
{
  "Name": "RateLimitRule",
  "Priority": 1,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 100,
      "AggregateKeyType": "IP"
    }
  },
  "Action": {
    "Block": {
      "CustomResponse": {
        "ResponseCode": 429,
        "CustomResponseBodyKey": "rate_limit_exceeded"
      }
    }
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "RateLimitRule"
  }
}
```

**Aggregate Key Types:**
- `IP`: Per source IP address
- `FORWARDED_IP`: Per `X-Forwarded-For` header (use with CloudFront/ALB)

**Rate Limit Calculation:**

```
Client makes 110 requests in 5 minutes
Threshold: 100 requests per 5 minutes

Requests 1-100: Allowed
Requests 101-110: Blocked (IP added to block list for 5 minutes)

After 5 minutes: IP removed from block list
```

### Custom String Match Rules

**Block requests containing specific patterns.**

**Example: Block Admin Panel Access**

```json
{
  "Name": "BlockAdminPanel",
  "Statement": {
    "ByteMatchStatement": {
      "SearchString": "/admin",
      "FieldToMatch": {
        "UriPath": {}
      },
      "TextTransformations": [{
        "Priority": 0,
        "Type": "LOWERCASE"
      }],
      "PositionalConstraint": "STARTS_WITH"
    }
  },
  "Action": {
    "Block": {}
  }
}
```

**Positional Constraints:**
- `EXACTLY`: Exact match
- `STARTS_WITH`: Starts with pattern
- `ENDS_WITH`: Ends with pattern
- `CONTAINS`: Contains pattern anywhere

### Geo-Blocking

**Block requests from specific countries.**

**Example: Block Requests from High-Risk Countries**

```json
{
  "Name": "GeoBlockRule",
  "Statement": {
    "GeoMatchStatement": {
      "CountryCodes": ["CN", "RU", "KP"]
    }
  },
  "Action": {
    "Block": {}
  }
}
```

**Use Cases:**
- Compliance (block sanctioned countries)
- Reduce attack surface (block countries with no legitimate traffic)
- Geo-licensing restrictions

---

## Bot Control

### Bot Control Managed Rule Group

**AWS Bot Control** uses ML to classify traffic as bot or human.

**Bot Categories:**

| Category | Description | Default Action |
|----------|-------------|---------------|
| **Verified bot** | Legitimate bots (Google, Bing, Facebook crawler) | Allow |
| **Category: Search engine** | Search engine crawlers | Allow |
| **Category: Monitoring** | Uptime monitors (Pingdom, StatusCake) | Allow |
| **Category: Advertising** | Ad verification bots | Allow |
| **Likely bot** | Suspicious characteristics (no JS execution, unusual user-agent) | Challenge or Block |
| **Likely human** | Verified human (CAPTCHA solved, JS executed) | Allow |

### Bot Control Inspection Levels

**COMMON (Default):**
- Blocks obvious bots (known bad user-agents, headless browsers)
- Challenges suspicious traffic
- Low false positive rate

**TARGETED (Aggressive):**
- Challenges all automated traffic
- Requires CAPTCHA or JavaScript challenge
- Higher false positive rate (may block legitimate automation)

**Configuration:**

```json
{
  "ManagedRuleGroupStatement": {
    "VendorName": "AWS",
    "Name": "AWSManagedRulesBotControlRuleSet",
    "ManagedRuleGroupConfigs": [{
      "AWSManagedRulesBotControlRuleSet": {
        "InspectionLevel": "TARGETED"
      }
    }]
  }
}
```

### CAPTCHA and Challenge

**CAPTCHA:** Present CAPTCHA challenge to suspicious requests.

**Challenge:** Client-side JavaScript challenge (invisible to user).

**Example: Challenge Likely Bots**

```json
{
  "Name": "ChallengeBots",
  "Statement": {
    "ManagedRuleGroupStatement": {
      "VendorName": "AWS",
      "Name": "AWSManagedRulesBotControlRuleSet"
    }
  },
  "OverrideAction": {
    "None": {}
  },
  "RuleActionOverrides": [{
    "Name": "CategoryHttpLibrary",
    "ActionToUse": {
      "Challenge": {}
    }
  }]
}
```

**Challenge Flow:**

```
1. Client makes request
2. WAF detects likely bot
3. WAF returns JavaScript challenge
4. Client executes JavaScript (proves not headless browser)
5. Client retries request with proof token
6. WAF allows request
```

---

## Integration with AWS Services

### CloudFront + WAF

**Protect content delivery with WAF at edge.**

**Architecture:**

```
Client → CloudFront (Edge Locations) → WAF → Origin (S3/ALB)
```

**Benefits:**
- WAF inspection at edge (closest to user)
- Blocks malicious requests before reaching origin
- Low latency (WAF integrated into CloudFront)

**Attach Web ACL to CloudFront:**

```bash
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:123456789012:global/webacl/MyWebACL/abc123 \
  --resource-arn arn:aws:cloudfront::123456789012:distribution/E123456EXAMPLE
```

### ALB + WAF

**Protect application load balancers.**

**Architecture:**

```
Client → ALB → WAF → Target (EC2/ECS/Lambda)
```

**Use Case:** Protect API or web application behind ALB.

**Attach Web ACL to ALB:**

```bash
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:123456789012:regional/webacl/MyWebACL/abc123 \
  --resource-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/my-alb/abc123
```

### API Gateway + WAF

**Protect REST APIs.**

**Architecture:**

```
Client → API Gateway (Regional or Edge-Optimized) → WAF → Lambda/Backend
```

**Use Case:** Rate limiting, API key validation, bot protection.

**Attach Web ACL to API Gateway:**

```bash
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:123456789012:regional/webacl/MyWebACL/abc123 \
  --resource-arn arn:aws:apigateway:us-east-1::/restapis/abc123/stages/prod
```

---

## DDoS Response Team (DRT)

### Shield Advanced DRT Features

**DDoS Response Team (DRT):** AWS experts available 24/7 during DDoS attacks.

**DRT Services:**

**1. Proactive Engagement**
- Optional: DRT automatically engaged when attack detected
- DRT creates/modifies WAF rules during attack (no human approval required)

**2. Reactive Support**
- Manual engagement: Contact DRT via support case during attack
- DRT analyzes traffic; recommends mitigations
- DRT creates WAF rules with your approval

**3. Post-Attack Analysis**
- Detailed attack report (attack vectors, peak traffic, duration)
- Recommendations for improving defenses

**Enable Proactive Engagement:**

```bash
aws shield describe-emergency-contact-settings
aws shield update-emergency-contact-settings \
  --emergency-contact-list \
    EmailAddress=security@company.com,PhoneNumber=+1-555-123-4567,ContactNotes="Primary contact"
```

**Proactive Engagement Workflow:**

```
1. Shield Advanced detects DDoS attack (baseline anomaly)
2. SNS alert sent to emergency contacts
3. DRT automatically engaged (if enabled)
4. DRT analyzes attack
5. DRT creates WAF rules to mitigate (without approval)
6. DRT monitors attack until resolved
7. DRT sends post-attack report
```

---

## Cost Optimization Strategies

### WAF Pricing (us-east-1, 2025)

**Web ACL:**
- $5.00 per Web ACL per month
- $1.00 per million requests

**Rules:**
- $1.00 per rule per month

**Managed Rule Groups:**
- $10.00 per rule group per month (Core Rule Set, Known Bad Inputs, etc.)
- Bot Control: $10.00 per month + $10.00 per million requests

**Example:**

```
Web ACL: $5
Core Rule Set: $10 + ($1 × 10M requests / 1M) = $20
Bot Control: $10 + ($10 × 10M / 1M) = $110
Custom rate-based rule: $1

Total: $146/month for 10M requests
```

### Shield Pricing

**Shield Standard:** Free (included with all AWS accounts)

**Shield Advanced:**
- $3,000 per month per organization
- $1.00 per million requests (WAF portion, if using DRT-created WAF rules)
- Data transfer cost protection (AWS credits for DDoS-related spikes)

### 1. Use Shield Standard for CloudFront/Route 53

**Problem:** Paying $3,000/month Shield Advanced for CloudFront when Shield Standard provides same L3/L4 protection.

**Solution:** Shield Standard covers CloudFront, Route 53, Global Accelerator automatically (free).

**When Shield Advanced Needed:**
- Protecting ALB, NLB, or Elastic IP (not covered by Standard)
- Need L7 DDoS protection
- Need DRT support

**Savings:** $36,000/year if CloudFront is only resource.

---

### 2. Optimize Rule Count

**Problem:** 20 custom rules = $20/month rule charges.

**Solution:** Consolidate rules where possible.

**Example:**

```
Before:
- Block IP 1.2.3.4 (Rule 1)
- Block IP 5.6.7.8 (Rule 2)
- Block IP 9.10.11.12 (Rule 3)
Cost: 3 rules × $1 = $3/month

After:
- Block IP set containing [1.2.3.4, 5.6.7.8, 9.10.11.12] (Rule 1)
Cost: 1 rule × $1 = $1/month

Savings: $2/month (67%)
```

---

### 3. Use COUNT Action for Testing

**Problem:** Enabling new managed rule group immediately blocks legitimate traffic (false positives).

**Solution:** Start with COUNT action (log only); review logs; switch to BLOCK once confident.

**Example:**

```json
{
  "Name": "CoreRuleSet",
  "Statement": {
    "ManagedRuleGroupStatement": {
      "VendorName": "AWS",
      "Name": "AWSManagedRulesCommonRuleSet"
    }
  },
  "OverrideAction": {
    "Count": {}
  }
}
```

**Workflow:**
1. Deploy with COUNT action
2. Monitor CloudWatch Logs for 7 days
3. Identify false positives; add exceptions
4. Switch to BLOCK action

**Cost Benefit:** Avoid blocking legitimate traffic (business impact > rule cost).

---

### 4. Regional vs Global Web ACLs

**Regional Web ACL:** ALB, API Gateway (regional)
**Global Web ACL:** CloudFront

**Pricing Same:** $5/Web ACL regardless of scope.

**Optimization:** Reuse same Web ACL across multiple ALBs/API Gateways (associate same Web ACL with multiple resources).

**Example:**

```
Without reuse:
3 ALBs × $5/Web ACL = $15/month

With reuse:
1 Web ACL × $5 = $5/month (associated with 3 ALBs)

Savings: $10/month (67%)
```

---

### Cost Example: E-Commerce Site (100M Requests/Month)

**WAF Configuration:**
- Web ACL: 1
- Core Rule Set: 1
- Known Bad Inputs: 1
- Bot Control: 1
- Custom rate-based rule: 1
- Requests: 100M/month

**WAF Cost:**

```
Web ACL: $5
Core Rule Set: $10 + ($1 × 100M / 1M) = $110
Known Bad Inputs: $10 + ($1 × 100M / 1M) = $110
Bot Control: $10 + ($10 × 100M / 1M) = $1,010
Rate-based rule: $1

Total WAF: $1,246/month
```

**Shield Advanced (Optional):**

```
Subscription: $3,000/month
WAF rules (if DRT creates): Included in WAF cost above

Total Shield Advanced: $3,000/month
```

**Total Protection Cost:**
- WAF only: $1,246/month
- WAF + Shield Advanced: $4,246/month

**ROI:**
- DDoS attack without protection: $2M revenue loss (6 hours downtime)
- Shield Advanced cost: $4,246/month = $51K/year
- **ROI: Prevent one 6-hour outage per year → 3,900% ROI**

---

## Performance and Scalability

### WAF Latency

**Request Inspection Latency:**
- Typical: 1-5 ms per request
- Complex regex rules: Up to 10 ms
- Bot Control (JS challenge): 50-200 ms (one-time, client caches token)

**Throughput:**
- No hard limits; scales automatically
- Handles millions of requests per second

**Best Practice:** Test WAF rules in staging before production (measure latency impact).

---

## Security Best Practices

### 1. Enable Logging

**WAF Logging** sends all inspected requests to S3, CloudWatch Logs, or Kinesis Firehose.

**Enable Logging:**

```bash
aws wafv2 put-logging-configuration \
  --logging-configuration \
    ResourceArn=arn:aws:wafv2:us-east-1:123456789012:regional/webacl/MyWebACL/abc123,\
    LogDestinationConfigs=arn:aws:s3:::aws-waf-logs-bucket
```

**Log Format:**

```json
{
  "timestamp": 1642176000000,
  "formatVersion": 1,
  "webaclId": "arn:aws:wafv2:...",
  "terminatingRuleId": "RateLimitRule",
  "terminatingRuleType": "RATE_BASED",
  "action": "BLOCK",
  "httpRequest": {
    "clientIp": "203.0.113.42",
    "country": "US",
    "uri": "/api/login",
    "method": "POST",
    "httpVersion": "HTTP/1.1"
  }
}
```

**Use Cases:**
- Security forensics (identify attack patterns)
- Tune rules (identify false positives)
- Compliance (audit trail for blocked requests)

---

### 2. Use IP Reputation Lists

**Reputation lists** block IPs with history of malicious activity.

**Example: Block Amazon IP Reputation List**

```json
{
  "Name": "BlockMaliciousIPs",
  "Statement": {
    "ManagedRuleGroupStatement": {
      "VendorName": "AWS",
      "Name": "AWSManagedRulesAmazonIpReputationList"
    }
  },
  "OverrideAction": {
    "None": {}
  }
}
```

**Benefit:** Proactive blocking of known-bad IPs (botnets, compromised hosts, Tor exit nodes).

---

### 3. Implement Defense in Depth

**Layer WAF with other security controls:**

```
CloudFront (Shield Standard)
    ↓
WAF (SQL injection, XSS, rate limiting)
    ↓
ALB (TLS termination, security groups)
    ↓
EC2/ECS (instance-level firewalls, IAM roles)
    ↓
RDS (encryption, security groups, IAM authentication)
```

**Benefit:** No single point of failure; multiple layers of protection.

---

## Observability and Monitoring

### Key CloudWatch Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `AllowedRequests` | Requests allowed by Web ACL | Monitor for drops (may indicate attack) |
| `BlockedRequests` | Requests blocked by Web ACL | >0 (investigate blocked traffic) |
| `CountedRequests` | Requests counted (test mode) | N/A (review logs) |
| `SampledRequests` | Sample of inspected requests | N/A (debugging) |

### CloudWatch Alarms

**1. High Block Rate**

```
Metric: BlockedRequests
Threshold: >1000 per 5 minutes
Action: Alert security team (potential attack)
```

**2. Shield Advanced Attack Detected**

```
Metric: DDoSDetected
Threshold: >0
Action: Alert security team + engage DRT
```

---

## Common Pitfalls

### Pitfall 1: Default Action ALLOW Without Rules

**Problem:** Web ACL created with default action ALLOW and no rules; all traffic allowed (WAF has no effect).

**Solution:** Add at minimum Core Rule Set or configure default action BLOCK with allow rules.

**Cost Impact:** Paying for WAF with zero protection.

---

### Pitfall 2: Not Testing Rules with COUNT

**Problem:** Deployed managed rule group with BLOCK action immediately. Blocks legitimate traffic. Site down.

**Solution:** Always start with COUNT action. Review logs for 7 days. Adjust rules. Then switch to BLOCK.

**Cost Impact:** Business disruption from false positives.

---

### Pitfall 3: Rate Limit Too Low

**Problem:** Rate limit set to 10 requests/5min; legitimate users hit limit during normal usage.

**Solution:** Analyze normal traffic patterns; set rate limit 2-3× above P99 legitimate usage.

**Cost Impact:** Legitimate users blocked; poor user experience.

---

### Pitfall 4: No WAF Logging

**Problem:** WAF blocking traffic; no visibility into what's blocked or why.

**Solution:** Enable WAF logging to S3 or CloudWatch Logs.

**Cost Impact:** Cannot tune rules; cannot investigate security incidents.

---

### Pitfall 5: Shield Advanced Without ALB/NLB

**Problem:** Paying $3,000/month Shield Advanced for CloudFront only (Shield Standard provides same protection).

**Solution:** Cancel Shield Advanced if only protecting CloudFront/Route 53.

**Cost Impact:** $36,000/year wasted.

---

### Pitfall 6: Bot Control Without Tuning

**Problem:** Enabled Bot Control with TARGETED inspection level; blocks legitimate API clients (mobile apps, CLI tools).

**Solution:** Start with COMMON level; whitelist verified bots; tune based on logs.

**Cost Impact:** Broken integrations; customer complaints.

---

## Key Takeaways

1. **WAF protects application layer (L7); Shield protects network layer (L3/L4).** WAF blocks SQL injection, XSS, malicious bots. Shield mitigates DDoS attacks (SYN floods, UDP floods).

2. **Shield Standard is free and automatic for CloudFront/Route 53.** No configuration required; protects against most DDoS attacks. Shield Advanced required for ALB/NLB/Elastic IP.

3. **Managed rule groups provide instant OWASP Top 10 protection.** Core Rule Set ($10/month) blocks SQL injection, XSS, RCE without custom rules.

4. **Rate-based rules prevent brute-force and API abuse.** Block IPs exceeding threshold (e.g., 100 requests per 5 minutes). Essential for login pages, APIs.

5. **Bot Control uses ML to detect automated traffic.** Blocks malicious bots, challenges suspicious traffic, allows verified bots (Google, Bing).

6. **Shield Advanced costs $3,000/month but includes DRT and cost protection.** DDoS Response Team provides 24/7 support. AWS credits data transfer charges during attacks.

7. **Always test rules with COUNT action before BLOCK.** Review logs for false positives. Tune rules. Then switch to BLOCK. Prevents blocking legitimate traffic.

8. **Web ACL capacity limited to 5,000 WCUs.** Managed rule groups consume 50-1,500 WCUs. Plan rule budget accordingly.

9. **WAF adds 1-5ms latency per request.** Complex regex rules add up to 10ms. Bot Control JS challenge adds 50-200ms (one-time per client).

10. **Reuse Web ACLs across multiple resources.** Same Web ACL can protect multiple ALBs/API Gateways. Saves $5/resource/month.

11. **Enable WAF logging for forensics and tuning.** Logs show all blocked/allowed requests. Essential for investigating attacks and reducing false positives.

12. **Geo-blocking available for compliance.** Block requests from specific countries (e.g., sanctioned countries, no legitimate traffic).

13. **DRT can auto-engage with Shield Advanced proactive engagement.** DRT creates WAF rules during attack without human approval. Fastest response time.

14. **Shield Advanced provides cost protection.** AWS credits data transfer charges caused by DDoS attacks. Important for unpredictable attack-related costs.

15. **WAF integrates with CloudFront, ALB, API Gateway, AppSync.** Choose integration point based on architecture. CloudFront provides edge protection; ALB protects regional applications.

**AWS WAF and Shield provide comprehensive protection against web exploits and DDoS attacks, enabling defense-in-depth security with managed rules, ML-powered bot detection, and 24/7 DDoS response. WAF protects against application-layer threats while Shield mitigates network-layer DDoS; both are essential for production web applications.**
