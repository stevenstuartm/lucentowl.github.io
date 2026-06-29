---
title: "AWS Security Hub & GuardDuty for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "Comprehensive guide to AWS Security Hub and GuardDuty covering threat detection, security posture management, findings aggregation, integration patterns, automated remediation, and cost optimization for defense-in-depth security"
tags: [aws, security, threat-detection, compliance, monitoring, security-posture, guardduty, security-hub, fundamentals]
---

## What Problems Security Hub & GuardDuty Solve

### Without Centralized Security Monitoring

**Security Visibility Challenges:**
- No automated threat detection across AWS accounts
- Manual review of CloudTrail, VPC Flow Logs, DNS logs for anomalies
- Security findings scattered across 20+ AWS security services
- No centralized compliance dashboard
- Each account monitored separately; no cross-account visibility
- Manual correlation of security events across services
- No automated remediation; everything requires manual intervention

**Real-World Impact:**
- Compromised EC2 instance mining cryptocurrency goes undetected for weeks (cost: $50,000)
- S3 bucket made public; sensitive data exposed; discovered only after customer complaint
- Compliance auditor requests CIS AWS Foundations Benchmark status; takes 2 weeks to compile manually
- 15 AWS accounts; security team spends 40 hours/week reviewing logs across accounts
- Failed compliance check in one account; no visibility into similar issues in other accounts

### With Security Hub & GuardDuty

**Automated Threat Detection and Posture Management:**

**GuardDuty:**
- **Intelligent threat detection**: ML-powered analysis of CloudTrail, VPC Flow Logs, DNS logs
- **Anomaly detection**: Identifies unusual API calls, network traffic, DNS queries
- **Threat intelligence**: Uses AWS threat feeds and 3rd-party feeds (Proofpoint, CrowdStrike)
- **Zero configuration**: Enable in one click; no agents, sensors, or infrastructure

**Security Hub:**
- **Centralized findings**: Aggregates findings from GuardDuty, Inspector, Macie, IAM Access Analyzer, Firewall Manager, etc.
- **Compliance dashboards**: Automated checks against CIS, PCI-DSS, NIST, AWS Best Practices
- **Multi-account view**: Single pane of glass across all AWS accounts
- **Automated remediation**: EventBridge integration triggers remediation workflows

**Problem-Solution Mapping:**

| Problem | GuardDuty Solution | Security Hub Solution |
|---------|-------------------|----------------------|
| Compromised instance undetected | Detects cryptocurrency mining, C2 communication, unusual API calls | Aggregates GuardDuty finding; triggers automated isolation |
| Public S3 buckets | Detects unusual S3 access patterns | Continuous compliance check; alerts when bucket policy allows public access |
| Manual compliance reporting | N/A | Automated compliance dashboard (CIS, PCI-DSS, NIST); generates reports |
| No cross-account visibility | Multi-account GuardDuty via Organizations | Centralized findings across all accounts |
| Log analysis requires experts | ML models detect threats automatically | Actionable findings with remediation guidance |
| Reactive security posture | Proactive threat detection (stop attacks in progress) | Proactive posture management (fix misconfigurations before exploitation) |

---

## AWS GuardDuty Fundamentals

### What is GuardDuty?

**AWS GuardDuty** is a managed threat detection service that continuously monitors AWS accounts for malicious activity and unauthorized behavior.

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>GuardDuty analyzes event data from multiple sources using ML models and threat intelligence to identify threats.</p>
</div>

**Data Sources (Analyzed Automatically):**
1. **AWS CloudTrail Management Events**: API calls (who did what, when)
2. **AWS CloudTrail S3 Data Events**: S3 object-level operations (GetObject, PutObject, DeleteObject)
3. **VPC Flow Logs**: Network traffic metadata (source, destination, ports, protocols)
4. **DNS Logs**: DNS query logs (domains queried by EC2 instances)
5. **EKS Audit Logs**: Kubernetes API calls in EKS clusters
6. **RDS Login Activity**: Database login attempts (Aurora, RDS)
7. **Lambda Network Activity**: Lambda function network connections
8. **S3 Logs**: S3 data access patterns

**No Configuration Required:** GuardDuty accesses these logs automatically (no need to enable CloudTrail, VPC Flow Logs separately for GuardDuty).

### How GuardDuty Works

**1. Continuous Monitoring**

```
CloudTrail → ┐
VPC Logs   → ├→ [GuardDuty ML Models] → Findings → Security Hub / EventBridge
DNS Logs   → ┘        ↓
              Threat Intelligence
              (AWS + 3rd-party feeds)
```

**2. Threat Detection**

GuardDuty uses:
- **Machine learning models** trained on AWS global telemetry
- **Threat intelligence feeds** (AWS Security, Proofpoint ET Intelligence, CrowdStrike)
- **Anomaly detection** (baseline normal behavior, flag deviations)

**3. Finding Generation**

When threat detected, GuardDuty creates finding with:
- **Severity**: Low (1.0-3.9), Medium (4.0-6.9), High (7.0-8.9), Critical (9.0-10.0)
- **Type**: Categorized by threat (e.g., `UnauthorizedAccess:EC2/MaliciousIPCaller.Custom`)
- **Resource**: Affected resource (EC2 instance ID, IAM principal, S3 bucket)
- **Details**: IP addresses, ports, domains, API calls, timestamps
- **Recommended actions**: Remediation steps

### GuardDuty Finding Types

**1. Reconnaissance (Information Gathering)**

| Finding Type | Description |
|-------------|-------------|
| `Recon:EC2/PortProbeUnprotectedPort` | EC2 instance probed on unprotected port (no security group rule) |
| `Recon:EC2/Portscan` | EC2 instance probing multiple ports (port scanning) |
| `Discovery:S3/MaliciousIPCaller` | S3 API called from known malicious IP |

**2. Instance Compromise**

| Finding Type | Description |
|-------------|-------------|
| `CryptoCurrency:EC2/BitcoinTool.B!DNS` | EC2 instance querying cryptocurrency mining pool domain |
| `Backdoor:EC2/C&CActivity.B!DNS` | EC2 instance communicating with C2 server |
| `Trojan:EC2/BlackholeTraffic` | EC2 instance sending traffic to remote host on unusual port |

**3. Account Compromise**

| Finding Type | Description |
|-------------|-------------|
| `UnauthorizedAccess:IAMUser/MaliciousIPCaller.Custom` | AWS API called from IP on custom threat list |
| `Stealth:IAMUser/CloudTrailLoggingDisabled` | CloudTrail logging disabled (attacker covering tracks) |
| `PenTest:IAMUser/KaliLinux` | API calls from Kali Linux (pentesting tool) |

**4. Bucket Compromise**

| Finding Type | Description |
|-------------|-------------|
| `Exfiltration:S3/ObjectRead.Unusual` | Unusual volume of S3 GetObject calls (data exfiltration) |
| `Impact:S3/MaliciousIPCaller` | S3 API called from known malicious IP |
| `Policy:S3/BucketBlockPublicAccessDisabled` | S3 Block Public Access disabled |

**Example Finding:**

```json
{
  "schemaVersion": "2.0",
  "accountId": "123456789012",
  "region": "us-east-1",
  "id": "abc123",
  "resource": {
    "instanceDetails": {
      "instanceId": "i-0abcd1234efgh5678"
    }
  },
  "severity": 8.5,
  "title": "EC2 instance is communicating with a Command & Control server.",
  "type": "Backdoor:EC2/C&CActivity.B!DNS",
  "description": "EC2 instance i-0abcd1234efgh5678 is querying a domain associated with a known Command & Control server."
}
```

### GuardDuty Protection Plans

**1. Foundational Threat Detection (Included)**

- CloudTrail management events
- VPC Flow Logs
- DNS logs

**2. S3 Protection (Optional, +$0.50/GB scanned)**

- S3 data events
- S3 configuration monitoring

**3. EKS Protection (Optional, +$0.012/GB analyzed)**

- EKS audit logs
- EKS runtime monitoring

**4. RDS Protection (Optional, +$0.027/GB analyzed)**

- RDS/Aurora login activity monitoring

**5. Lambda Protection (Optional, +$0.012/GB analyzed)**

- Lambda network activity monitoring

**6. Malware Protection (Optional, +$0.12/GB scanned)**

- EBS volume snapshot scanning for malware
- Triggered when GuardDuty detects potential compromise

---

## AWS Security Hub Fundamentals

### What is Security Hub?

**AWS Security Hub** is a centralized security and compliance service that aggregates findings from multiple AWS services and 3rd-party tools.

**Core Concept:** Single dashboard showing security posture, compliance status, and prioritized findings across all accounts.

**Key Capabilities:**
1. **Findings aggregation** from 50+ AWS services and partner tools
2. **Security standards** (CIS, PCI-DSS, NIST, AWS Foundational Security Best Practices)
3. **Compliance scoring** (percentage of passed checks)
4. **Automated insights** (correlate related findings)
5. **Custom actions** (send findings to remediation workflows)

### Security Hub Architecture

```
┌─ GuardDuty ──┐
├─ Inspector ──┤
├─ Macie ──────┤
├─ IAM Analyzer┤    ┌──────────────────┐      ┌───────────────┐
├─ Firewall Mgr├───→│ Security Hub     │─────→│ EventBridge   │→ Lambda (remediation)
├─ Config ─────┤    │ - Findings       │      │               │→ SNS (alerts)
├─ Detective ──┤    │ - Compliance     │      └───────────────┘
└─ 3rd-party ──┘    │ - Insights       │
                    └──────────────────┘
                            ↓
                    Dashboard / API
```

### Security Standards

**1. AWS Foundational Security Best Practices (FSBP)**

- 227 automated checks
- Covers 30+ AWS services
- Updated quarterly by AWS Security
- Examples:
  - `[S3.1] S3 Block Public Access should be enabled`
  - `[EC2.8] EC2 instances should use IMDSv2`
  - `[RDS.3] RDS DB instances should have encryption at rest enabled`

**2. CIS AWS Foundations Benchmark v1.4.0**

- 53 checks
- Industry-standard compliance framework
- Examples:
  - `[1.12] Ensure no root account access key exists`
  - `[2.1.1] Ensure S3 Bucket Policy is set to deny HTTP requests`
  - `[4.3] Ensure VPC default security group restricts all traffic`

**3. PCI-DSS v3.2.1**

- 136 checks
- Payment Card Industry Data Security Standard
- Examples:
  - `[PCI.EC2.2] VPC default security group should prohibit inbound and outbound traffic`
  - `[PCI.S3.6] S3 Block Public Access should be enabled`

**4. NIST 800-53 Rev 5**

- 202 checks
- National Institute of Standards and Technology framework
- Examples:
  - `[AC-2] Account Management`
  - `[SC-7] Boundary Protection`

### Compliance Score

**Calculation:**

```
Compliance Score = (Passed Checks / Total Checks) × 100%

Example:
Passed: 180
Failed: 45
Not Available: 2
Total: 227

Score: (180 / 227) × 100 = 79.3%
```

**Security Hub Dashboard Shows:**
- Overall score per standard
- Failed checks (highest priority)
- Trend over time
- Per-account breakdown (multi-account)

### Findings Format (ASFF)

**AWS Security Finding Format (ASFF)** is JSON schema for security findings.

**Example:**

```json
{
  "SchemaVersion": "2018-10-08",
  "Id": "arn:aws:securityhub:us-east-1:123456789012:subscription/aws-foundational-security-best-practices/v/1.0.0/S3.1/finding/abc123",
  "ProductArn": "arn:aws:securityhub:us-east-1::product/aws/securityhub",
  "GeneratorId": "aws-foundational-security-best-practices/v/1.0.0/S3.1",
  "AwsAccountId": "123456789012",
  "Types": ["Software and Configuration Checks/AWS Security Best Practices"],
  "CreatedAt": "2025-01-14T12:00:00.000Z",
  "UpdatedAt": "2025-01-14T12:00:00.000Z",
  "Severity": {
    "Label": "MEDIUM",
    "Normalized": 40
  },
  "Title": "S3.1 S3 Block Public Access should be enabled",
  "Description": "S3 Block Public Access setting is disabled for bucket my-bucket",
  "Resources": [
    {
      "Type": "AwsS3Bucket",
      "Id": "arn:aws:s3:::my-bucket",
      "Region": "us-east-1"
    }
  ],
  "Compliance": {
    "Status": "FAILED"
  },
  "Remediation": {
    "Recommendation": {
      "Text": "Enable S3 Block Public Access for the bucket.",
      "Url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html"
    }
  }
}
```

---

## GuardDuty vs Security Hub

### Service Comparison

| Feature | GuardDuty | Security Hub |
|---------|-----------|--------------|
| **Purpose** | Threat detection (active attacks, anomalies) | Security posture management (misconfigurations, compliance) |
| **Detection Method** | ML-based anomaly detection, threat intelligence | Rule-based compliance checks |
| **Data Sources** | CloudTrail, VPC Flow, DNS, EKS, RDS, Lambda logs | Findings from other services (GuardDuty, Config, Inspector, etc.) |
| **Scope** | Runtime threats (happening now) | Configuration compliance (preventive) |
| **Findings** | Threat findings (compromised instance, malicious IP) | Compliance findings (public S3 bucket, unencrypted RDS) |
| **Response Time** | Real-time (minutes) | Periodic checks (hours) |
| **Use Case** | Detect and respond to active threats | Assess and improve security posture |

### When to Use Both (Recommended)

**GuardDuty → Security Hub Integration:**

```
GuardDuty detects threat → Sends finding to Security Hub → EventBridge triggers remediation
```

**Example Workflow:**

1. GuardDuty detects EC2 instance communicating with C2 server (finding: `Backdoor:EC2/C&CActivity`)
2. Finding sent to Security Hub
3. Security Hub Custom Action triggers EventBridge rule
4. EventBridge invokes Lambda function
5. Lambda isolates EC2 instance (modifies security group to deny all traffic)
6. Lambda creates SNS notification to security team

**Benefits of Integration:**
- **GuardDuty**: Real-time threat detection
- **Security Hub**: Central dashboard showing threats + compliance failures
- **EventBridge**: Automated response

---

## Threat Detection Capabilities

### GuardDuty Threat Intelligence

**1. AWS Threat Intelligence**

- Global threat feeds from AWS Security
- Updated continuously
- Covers known malicious IPs, domains

**2. 3rd-Party Threat Feeds**

- **Proofpoint ET Intelligence**: Emerging threats, zero-day exploits
- **CrowdStrike**: Endpoint threat intelligence

**3. Custom Threat Lists**

**Upload custom IP/domain lists:**

```
# Malicious IPs (one per line)
192.0.2.1
198.51.100.44

# Malicious domains
evil.example.com
badactor.net
```

**Use Case:** Add IPs/domains from internal threat intelligence.

**4. Trusted IP Lists (Suppress False Positives)**

```
# Safe IPs (pentesting, security scanning)
203.0.113.5  # Internal pentesting range
203.0.113.10 # Approved security scanner
```

**Use Case:** Suppress findings for authorized security testing.

### GuardDuty Suppression Rules

**Problem:** Benign activity generates false positives.

**Solution:** Create suppression rule to auto-archive findings matching criteria.

**Example: Suppress Findings from Approved Pentesting**

```json
{
  "Filter": {
    "Criterion": {
      "type": {
        "Eq": ["PenTest:IAMUser/KaliLinux"]
      },
      "resource.accessKeyDetails.userName": {
        "Eq": ["pentest-automation"]
      }
    }
  },
  "Action": "ARCHIVE"
}
```

**Best Practice:** Use suppression rules sparingly; review periodically (attacker could mimic suppressed pattern).

---

## Security Standards and Compliance

### Enabling Security Standards

**Enable standards in Security Hub:**

```bash
aws securityhub batch-enable-standards \
  --standards-subscription-requests \
    StandardsArn=arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.4.0 \
    StandardsArn=arn:aws:securityhub:us-east-1::standards/aws-foundational-security-best-practices/v/1.0.0
```

**Cost:** $0.001 per security check per month (after free tier).

### Compliance Workflow

**1. Enable Standard**

Choose CIS, PCI-DSS, NIST, or AWS FSBP.

**2. Initial Assessment**

Security Hub runs all checks (may take hours for large accounts).

**3. Review Failed Checks**

Dashboard shows failed checks sorted by severity.

**Example Failed Check:**

```
[S3.1] S3 Block Public Access should be enabled
Status: FAILED
Severity: MEDIUM
Affected Resources: 12 S3 buckets
Remediation: Enable Block Public Access at account level
```

**4. Remediate**

Fix manually or use automated remediation (EventBridge + Lambda).

**5. Track Progress**

Compliance score increases as checks pass.

### Custom Security Standards

**Create custom control (Config Rule + Security Hub):**

**Example: Require IMDSv2 on All EC2 Instances**

1. Create Config Rule (AWS-managed or custom Lambda)
2. Config evaluates compliance
3. Config sends findings to Security Hub
4. Security Hub includes in custom standard

**Benefit:** Enforce organization-specific requirements.

---

## Findings Management

### Finding States

| State | Meaning |
|-------|---------|
| **NEW** | Finding just created; not yet reviewed |
| **NOTIFIED** | Finding sent to external system (SIEM, ticketing) |
| **RESOLVED** | Issue fixed; finding can be archived |
| **SUPPRESSED** | Finding matches suppression rule; auto-archived |

### Workflow Status

| Status | Use Case |
|--------|----------|
| **NEW** | Default state |
| **ASSIGNED** | Assigned to team member for investigation |
| **IN_PROGRESS** | Investigation underway |
| **DEFERRED** | Acknowledged but not remediating (accepted risk) |
| **RESOLVED** | Issue fixed |

### Finding Aggregation

**Problem:** Same finding across 50 accounts creates 50 separate findings.

**Solution:** Security Hub Aggregation Region

**Setup:**

1. Designate aggregation region (e.g., `us-east-1`)
2. Link all regions to aggregation region
3. Findings from all regions appear in aggregation region dashboard

**Benefit:** Single dashboard for global security posture.

---

## Multi-Account Strategy

### Delegated Administrator

**Best Practice:** Use AWS Organizations delegated administrator for Security Hub.

**Setup:**

```bash
# In management account
aws organizations enable-aws-service-access \
  --service-principal securityhub.amazonaws.com

aws securityhub enable-organization-admin-account \
  --admin-account-id 111111111111
```

**Delegated Admin Account Can:**
- Enable Security Hub in all member accounts
- Centralize findings from all accounts
- Manage security standards across organization
- Configure automated responses

### GuardDuty Organization Setup

**Auto-Enable GuardDuty for New Accounts:**

```bash
aws guardduty create-detector \
  --enable \
  --finding-publishing-frequency FIFTEEN_MINUTES

aws guardduty update-organization-configuration \
  --detector-id abc123 \
  --auto-enable
```

**Benefit:** New AWS accounts automatically protected (GuardDuty enabled on creation).

### Multi-Account Findings Flow

```
Member Account 1 → GuardDuty → Security Hub (local)
Member Account 2 → GuardDuty → Security Hub (local)     ┐
Member Account 3 → GuardDuty → Security Hub (local)     ├→ Security Hub (Delegated Admin)
...                                                      ┘         ↓
Member Account N → GuardDuty → Security Hub (local)            Dashboard
                                                               Compliance Reports
                                                               EventBridge Automation
```

---

## Integration and Automation

### EventBridge Integration

**Route findings to automated workflows:**

**EventBridge Rule (GuardDuty Finding):**

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "severity": [{"numeric": [">=", 7.0]}]  // High/Critical only
  }
}
```

**Target: Lambda (Isolate Compromised Instance)**

```python
import boto3

ec2 = boto3.client('ec2')

def lambda_handler(event, context):
    instance_id = event['detail']['resource']['instanceDetails']['instanceId']

    # Create quarantine security group (deny all traffic)
    sg_response = ec2.create_security_group(
        GroupName=f'quarantine-{instance_id}',
        Description='Quarantine security group for compromised instance'
    )
    sg_id = sg_response['GroupId']

    # Attach to instance
    ec2.modify_instance_attribute(
        InstanceId=instance_id,
        Groups=[sg_id]
    )

    # Create snapshot for forensics
    volumes = ec2.describe_volumes(
        Filters=[{'Name': 'attachment.instance-id', 'Values': [instance_id]}]
    )
    for volume in volumes['Volumes']:
        ec2.create_snapshot(
            VolumeId=volume['VolumeId'],
            Description=f'Forensic snapshot of {instance_id}'
        )

    return {'statusCode': 200, 'body': f'Isolated {instance_id}'}
```

### Security Hub Custom Actions

**Send findings to external systems:**

**EventBridge Rule (Security Hub Custom Action):**

```json
{
  "source": ["aws.securityhub"],
  "detail-type": ["Security Hub Findings - Custom Action"],
  "resources": ["arn:aws:securityhub:us-east-1:123456789012:action/custom/SendToJira"]
}
```

**Target: Lambda (Create Jira Ticket)**

```python
import requests

def lambda_handler(event, context):
    finding = event['detail']['findings'][0]

    jira_api = "https://company.atlassian.net/rest/api/2/issue"
    payload = {
        "fields": {
            "project": {"key": "SEC"},
            "summary": finding['Title'],
            "description": finding['Description'],
            "issuetype": {"name": "Security Finding"}
        }
    }

    response = requests.post(jira_api, json=payload, auth=('user', 'token'))
    return {'statusCode': 200}
```

### Common Automation Patterns

**1. Auto-Remediate S3 Public Buckets**

```
Security Hub finding: [S3.1] Block Public Access disabled
    ↓
EventBridge rule
    ↓
Lambda enables Block Public Access
    ↓
Update finding status to RESOLVED
```

**2. Rotate Compromised IAM Access Keys**

```
GuardDuty finding: UnauthorizedAccess:IAMUser/MaliciousIPCaller
    ↓
Lambda disables access key
    ↓
SNS notifies user to rotate key
```

**3. Isolate Compromised EC2 Instance**

```
GuardDuty finding: CryptoCurrency:EC2/BitcoinTool.B!DNS
    ↓
Lambda applies quarantine security group
    ↓
Lambda creates EBS snapshots for forensics
    ↓
SNS alerts security team
```

---

## Cost Optimization Strategies

### GuardDuty Pricing (us-east-1, 2025)

**Foundational Threat Detection:**
- CloudTrail events: $4.80 per million events
- VPC Flow Logs: $1.17 per GB
- DNS Logs: $0.40 per million events

**Optional Protections:**
- S3 Protection: $0.50 per GB scanned
- EKS Protection: $0.012 per GB analyzed
- RDS Protection: $0.027 per GB analyzed
- Lambda Protection: $0.012 per GB analyzed
- Malware Protection: $0.12 per GB scanned

**30-Day Free Trial:** All features free for first 30 days (per account).

### Security Hub Pricing

- Security checks: $0.001 per check per month
- Finding ingestion: $0.00003 per finding
- 10,000 checks/month free tier per account

**Example: 100-Account Organization**

```
Checks per account: 227 (AWS FSBP)
Total checks: 100 × 227 = 22,700 checks/month

Free tier: 100 × 10,000 = 1M checks (way above usage)
Cost: $0/month (within free tier)

Findings: 1,000 findings/month across all accounts
Cost: 1,000 × $0.00003 = $0.03/month

Total Security Hub Cost: ~$0.03/month
```

### 1. Optimize GuardDuty Data Sources

**Problem:** S3 Protection costs $0.50/GB; high-traffic bucket generates $500/month GuardDuty costs.

**Solution: Exclude Buckets That Don't Need Monitoring**

```bash
aws guardduty update-detector \
  --detector-id abc123 \
  --data-sources S3Logs={Enable=true,ExcludeRegions=[us-west-1,us-west-2]}
```

**Example:**

```
Total S3 data: 10 TB/month
Exclude internal logging buckets: 8 TB
Monitored: 2 TB

Cost before: 10 TB × $0.50 = $5,000/month
Cost after: 2 TB × $0.50 = $1,000/month
Savings: $4,000/month (80%)
```

**Best Practice:** Enable S3 Protection only for buckets with sensitive data.

---

### 2. Use GuardDuty Suppression Rules

**Problem:** False positives from approved pentesting generate 1,000 findings/month; investigation time wasted.

**Solution:** Suppress findings from known-safe activity.

**Cost Impact:** No direct cost savings (findings free); saves operational time (investigation hours).

---

### 3. Centralize Findings with Aggregation Region

**Problem:** Running Security Hub in 10 regions = 10× check costs.

**Solution:** Use regional aggregation; enable Security Hub only in aggregation region + necessary regions.

**Example:**

```
Scenario: 100 accounts, 5 regions

Without Aggregation:
Security Hub in all regions: 100 accounts × 5 regions = 500 Security Hub instances
Checks: 500 × 227 = 113,500 checks/month
Cost: (113,500 - 500,000 free tier) = $0 (within free tier)

With Aggregation:
Security Hub in 1 region per account: 100 accounts × 1 = 100 instances
Checks: 100 × 227 = 22,700 checks/month
Cost: $0 (within free tier)

Additional Benefit: Single dashboard (not 5 separate dashboards)
```

---

### 4. Disable Unused Security Standards

**Problem:** Running all 4 standards (AWS FSBP, CIS, PCI-DSS, NIST) = 618 checks per account.

**Solution:** Enable only standards required for compliance.

**Example:**

```
All standards: 227 + 53 + 136 + 202 = 618 checks
Cost: 618 × $0.001 = $0.618/month per account

Only AWS FSBP: 227 checks
Cost: 227 × $0.001 = $0.227/month per account

Savings: $0.391/month per account
For 100 accounts: $39.10/month savings
```

**Best Practice:** Start with AWS FSBP; add CIS/PCI-DSS/NIST only if required.

---

### Cost Example: 100-Account Organization

**GuardDuty:**

```
CloudTrail events: 50M/month across all accounts
VPC Flow Logs: 500 GB/month
DNS Logs: 10M events/month

GuardDuty Cost:
CloudTrail: 50M × $4.80/M = $240
VPC Flow: 500 GB × $1.17 = $585
DNS: 10M × $0.40/M = $4

Total: $829/month
```

**Security Hub:**

```
Checks: 22,700 (100 accounts × 227 AWS FSBP checks)
Free tier: 1M checks (way above usage)
Cost: $0

Findings: 2,000/month
Cost: 2,000 × $0.00003 = $0.06

Total: ~$0.06/month
```

**Total Security Monitoring Cost: ~$830/month for 100 accounts**

**Value:** Automated threat detection + compliance monitoring for ~$8.30/account/month.

---

## Performance and Scalability

### GuardDuty Latency

**Finding Generation:**
- Typical latency: 5-15 minutes (log collection → analysis → finding)
- Critical findings: May appear within minutes
- Not real-time (slight delay inherent to log-based analysis)

**Scaling:**
- Fully managed; scales automatically
- No throughput limits
- Handles millions of events/sec across all accounts

### Security Hub Latency

**Compliance Checks:**
- Initial assessment: Hours (first time enabling standard)
- Periodic checks: 12 hours (Config-based checks)
- Finding ingestion: Seconds (from GuardDuty, Inspector, etc.)

**Finding Aggregation:**
- Cross-region: Minutes (findings replicated to aggregation region)
- Cross-account: Seconds (member accounts → delegated admin)

---

## Security Best Practices

### 1. Enable GuardDuty and Security Hub in All Accounts

**Use Organizations to auto-enable for new accounts:**

```bash
# GuardDuty
aws guardduty update-organization-configuration \
  --detector-id abc123 \
  --auto-enable

# Security Hub
aws securityhub update-organization-configuration \
  --auto-enable
```

---

### 2. Respond to High/Critical Findings Within SLA

**Recommended SLAs:**

| Severity | Response Time | Action |
|----------|--------------|--------|
| Critical (9.0-10.0) | 15 minutes | Automated isolation + immediate investigation |
| High (7.0-8.9) | 1 hour | Investigation + remediation plan |
| Medium (4.0-6.9) | 24 hours | Review + remediation |
| Low (1.0-3.9) | 7 days | Batch review |

---

### 3. Automate Remediation for Common Issues

**Auto-remediate:**
- Public S3 buckets (enable Block Public Access)
- Unencrypted EBS volumes (stop instance, enable encryption, restart)
- Exposed security groups (remove 0.0.0.0/0 ingress rules)
- Unused IAM access keys (disable keys >90 days old)

---

### 4. Integrate with SIEM/SOAR

**Send findings to external systems:**

```
GuardDuty/Security Hub → EventBridge → Kinesis Firehose → Splunk/Datadog
                                     → Lambda → ServiceNow/Jira
```

**Benefit:** Unified security dashboard across AWS + on-prem + SaaS.

---

### 5. Review Suppression Rules Quarterly

**Risk:** Suppression rule may hide legitimate threats if attacker mimics suppressed pattern.

**Best Practice:** Review suppression rules every 90 days; remove unnecessary rules.

---

## Observability and Monitoring

### Key CloudWatch Metrics

**GuardDuty:**

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| N/A | GuardDuty doesn't publish CloudWatch metrics | Monitor via Security Hub or EventBridge |

**Security Hub:**

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Custom (via EventBridge) | Count of findings by severity | High/Critical findings >0 |
| Custom (via API) | Compliance score | <80% (failed checks increasing) |

### CloudWatch Alarms

**High/Critical GuardDuty Findings:**

```python
# Lambda triggered by EventBridge
import boto3

cloudwatch = boto3.client('cloudwatch')

def lambda_handler(event, context):
    severity = event['detail']['severity']

    if severity >= 7.0:  # High or Critical
        cloudwatch.put_metric_data(
            Namespace='Security',
            MetricData=[
                {
                    'MetricName': 'HighSeverityFindings',
                    'Value': 1,
                    'Unit': 'Count'
                }
            ]
        )
```

**CloudWatch Alarm:**

```
Metric: HighSeverityFindings
Threshold: >0
Period: 5 minutes
Action: SNS → PagerDuty
```

---

## Common Pitfalls

### Pitfall 1: Not Enabling GuardDuty in All Regions

**Problem:** Enabled GuardDuty in `us-east-1` only; compromised instance in `ap-southeast-1` undetected.

**Solution:** Enable GuardDuty in all active regions (or use Organizations auto-enable).

**Cost Impact:** Missed threats; compliance violations.

---

### Pitfall 2: Ignoring Medium Severity Findings

**Problem:** Team focuses only on High/Critical findings. Medium findings accumulate and security posture degrades.

**Example:** 500 Medium findings (public S3 buckets, unencrypted RDS) ignored for months; data breach.

**Solution:** Review Medium findings weekly; automate remediation where possible.

**Cost Impact:** Data breach (millions in damages, reputation loss).

---

### Pitfall 3: No Automated Remediation

**Problem:** Findings sent to email; manual remediation; takes days/weeks.

**Solution:** EventBridge + Lambda for common issues (public S3, exposed security groups).

**Cost Impact:** Extended exposure window; increased risk.

---

### Pitfall 4: Security Hub Enabled but Standards Disabled

**Problem:** Security Hub enabled but no security standards configured; no compliance checks.

**Solution:** Enable at least AWS Foundational Security Best Practices.

**Cost Impact:** False sense of security; misconfigurations undetected.

---

### Pitfall 5: Not Reviewing Compliance Trends

**Problem:** Compliance score decreasing over time; no one notices; failed checks accumulate.

**Solution:** Dashboard review cadence (weekly for security team). Track trends and investigate score drops.

**Cost Impact:** Compliance violations; failed audits.

---

### Pitfall 6: Excessive Suppression Rules

**Problem:** Created suppression rules for every false positive. Now suppressing 90% of findings with real threats hidden.

**Solution:** Use trusted IP lists instead of broad suppression; review suppression rules quarterly.

**Cost Impact:** Missed threats due to overly aggressive suppression.

---

### Pitfall 7: Not Testing Remediation Workflows

**Problem:** EventBridge rule triggers Lambda; Lambda has bug; remediation fails silently.

**Solution:** Test automation workflows and enable Lambda error monitoring (CloudWatch Logs, X-Ray). Set alerts on Lambda failures.

**Cost Impact:** Remediation never happens; threats persist.

---

## Key Takeaways

1. **GuardDuty detects threats; Security Hub manages posture.** GuardDuty uses ML to identify active attacks, anomalies, malicious IPs. Security Hub aggregates findings and checks compliance against standards.

2. **Enable both services for defense-in-depth.** GuardDuty provides runtime protection (threat detection). Security Hub provides preventive protection (compliance checks).

3. **GuardDuty analyzes CloudTrail, VPC Flow, DNS logs automatically.** No configuration required; logs analyzed without impacting account resources.

4. **Security Hub supports 4 compliance standards.** AWS Foundational Security Best Practices (227 checks), CIS (53 checks), PCI-DSS (136 checks), NIST 800-53 (202 checks).

5. **Use AWS Organizations for multi-account deployment.** Auto-enable GuardDuty and Security Hub for new accounts; centralize findings in delegated administrator account.

6. **Automate remediation with EventBridge + Lambda.** Route high-severity findings to Lambda for automated isolation, key rotation, security group updates.

7. **GuardDuty costs scale with log volume.** CloudTrail: $4.80/M events, VPC Flow: $1.17/GB, DNS: $0.40/M events. Optimize by excluding low-risk resources.

8. **Security Hub free tier covers most organizations.** 10,000 checks/month free per account; 100 accounts = 1M free checks (covers AWS FSBP for all accounts).

9. **Suppression rules prevent false positive fatigue.** Suppress findings from approved pentesting, security scanning. Review rules quarterly to avoid hiding real threats.

10. **Compliance score tracks security posture over time.** Monitor trends and investigate score drops. Automate remediation for common failures.

11. **GuardDuty provides 6 protection plans.** Foundational (CloudTrail, VPC, DNS), S3, EKS, RDS, Lambda, Malware. Enable based on workload requirements.

12. **Findings aggregation provides single pane of glass.** Configure aggregation region for global dashboard; all regions + accounts visible in one view.

13. **Response SLAs based on severity.** Critical: 15 min, High: 1 hour, Medium: 24 hours, Low: 7 days. Automate Critical/High responses.

14. **Security Hub integrates with 50+ AWS services.** GuardDuty, Inspector, Macie, Config, IAM Access Analyzer, Firewall Manager, Detective, 3rd-party tools (Palo Alto, Fortinet, Splunk).

15. **Test remediation workflows before production.** Lambda bugs cause silent failures. Monitor Lambda errors and alert on remediation failures.

**AWS GuardDuty and Security Hub together provide comprehensive threat detection and security posture management, enabling automated response to active threats and continuous compliance monitoring across multi-account AWS environments. GuardDuty protects against runtime threats while Security Hub prevents misconfigurations. Both are essential for defense-in-depth security.**
