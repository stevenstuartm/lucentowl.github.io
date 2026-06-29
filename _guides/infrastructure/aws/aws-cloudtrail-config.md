---
title: "AWS CloudTrail & Config for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "Comprehensive guide to AWS CloudTrail and Config covering audit logging, compliance monitoring, organizational trails, configuration change tracking, and cost optimization for governance and security"
tags: [aws, cloudtrail, config, audit, compliance, governance, security, logging, monitoring, fundamentals]
---

## What Problems CloudTrail & Config Solve

### Without Audit Logging and Configuration Tracking

**Governance and Compliance Challenges:**
- No audit trail for "who did what, when" across AWS accounts
- Cannot answer: "Who deleted the production database?"
- No visibility into resource configuration changes over time
- Compliance violations undetected until audit
- Manual investigation of security incidents takes days
- No automated enforcement of configuration standards
- Cannot prove compliance to auditors (SOC 2, PCI-DSS, HIPAA)

**Real-World Impact:**
- Production S3 bucket deleted; no record of who did it or when
- Compliance audit requires 6 months of configuration history; manually recreated from memory
- Security group changed to allow 0.0.0.0/0; detected only after breach
- HIPAA audit asks "prove encryption enabled for all RDS instances"; manual check of 200 databases
- Root account used directly; no visibility into what actions were performed
- Regulatory fine: $500K for lack of audit logs proving compliance controls

### With CloudTrail & Config

**Automated Audit and Compliance:**

**CloudTrail:**
- **Complete audit trail**: Every API call recorded (who, what, when, from where)
- **Multi-account logging**: Organizational trail captures all accounts
- **Tamper-proof**: S3 with versioning, encryption, and log file validation
- **90-day retention**: CloudTrail Lake for queryable long-term storage
- **Security analysis**: Detect unusual API calls, privilege escalation, data access

**Config:**
- **Configuration history**: Track every change to AWS resources
- **Compliance evaluation**: Continuous assessment against rules
- **Change tracking**: Timeline showing who changed what configuration when
- **Automated remediation**: Fix non-compliant resources automatically
- **Relationship mapping**: Understand dependencies between resources

**Problem-Solution Mapping:**

| Problem | CloudTrail Solution | Config Solution |
|---------|-------------------|----------------|
| Who deleted production database? | CloudTrail shows API call: `DeleteDBInstance` by user `john@company.com` at 14:32 UTC | Config shows configuration timeline: DB existed until 14:32, deleted by API call |
| Prove compliance to auditors | CloudTrail provides tamper-proof audit log of all security-relevant API calls | Config provides compliance reports showing all resources met standards |
| Detect security group changes | CloudTrail records `AuthorizeSecurityGroupIngress` API call | Config detects rule violation; triggers EventBridge for remediation |
| Track configuration drift | N/A (CloudTrail logs actions, not state) | Config tracks every configuration change; shows drift from baseline |
| Respond to security incident | CloudTrail Insights detects unusual API activity; alerts in real-time | Config shows which resources were modified during incident timeframe |
| Multi-account governance | Organizational trail logs all accounts to central S3 bucket | Config aggregator consolidates compliance data across accounts |

---

## AWS CloudTrail Fundamentals

### What is CloudTrail?

**AWS CloudTrail** is a service that records AWS API calls and related events for your AWS account.

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>Every action in AWS is an API call; CloudTrail logs these calls for audit, security analysis, and compliance.</p>
</div>

**CloudTrail Event:**

```json
{
  "eventVersion": "1.08",
  "userIdentity": {
    "type": "IAMUser",
    "principalId": "AIDAI1234567890EXAMPLE",
    "arn": "arn:aws:iam::123456789012:user/john",
    "accountId": "123456789012",
    "userName": "john"
  },
  "eventTime": "2025-01-14T14:32:00Z",
  "eventSource": "rds.amazonaws.com",
  "eventName": "DeleteDBInstance",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "203.0.113.42",
  "userAgent": "aws-cli/2.9.0",
  "requestParameters": {
    "dBInstanceIdentifier": "production-db"
  },
  "responseElements": null,
  "requestID": "abc123",
  "eventID": "def456",
  "readOnly": false,
  "eventType": "AwsApiCall"
}
```

**Key Fields:**
- `userIdentity`: Who made the call (IAM user, role, service)
- `eventTime`: When (UTC timestamp)
- `eventName`: What action (API call name)
- `sourceIPAddress`: From where (IP address)
- `requestParameters`: What was requested (resource IDs, parameters)
- `errorCode`: If call failed, why

### CloudTrail Event History

**Automatic Event Logging (Free):**
- Last 90 days of management events
- Available via CloudTrail console or API
- No configuration required
- Covers all regions

**Use Case:** Quick investigation ("who deleted this resource yesterday?")

**Limitation:** 90 days only; no data events; no long-term retention.

### CloudTrail Trails

**Trail:** Configuration that delivers CloudTrail events to S3 bucket.

**Why Create Trail:**
- Store events >90 days (unlimited retention in S3)
- Log data events (S3 object-level, Lambda invocations)
- Deliver to CloudWatch Logs for real-time monitoring
- Multi-account logging with organizational trail

**Trail Types:**

| Type | Scope | Use Case |
|------|-------|----------|
| **Single-region trail** | Logs events from one region | Cost optimization (log only primary region) |
| **Multi-region trail** | Logs events from all regions | Complete audit (recommended) |
| **Organizational trail** | Logs events from all accounts in Organization | Central security/compliance team |

### CloudTrail Lake (2022)

**CloudTrail Lake** is a managed data lake for CloudTrail events.

**Benefits:**
- **SQL queries**: Query events with SQL (no Athena setup required)
- **7-year retention**: Store events up to 2,557 days
- **Immutable**: Events cannot be modified or deleted (compliance requirement)
- **Cross-account/cross-region**: Query events from multiple accounts/regions

**Example Query:**

```sql
SELECT
  userIdentity.userName,
  eventName,
  eventTime,
  sourceIPAddress
FROM
  cloudtrail_lake_events
WHERE
  eventName = 'DeleteDBInstance'
  AND eventTime > '2025-01-01T00:00:00Z'
ORDER BY eventTime DESC
```

**Pricing:** $2.50 per GB ingested (7-year retention).

---

## AWS Config Fundamentals

### What is Config?

**AWS Config** is a service that continuously monitors and records AWS resource configurations and evaluates them against desired configurations.

**Core Concept:** Config takes snapshots of resource configurations, tracks changes over time, and evaluates compliance with rules.

**Config Workflow:**

```
1. Config discovers resources (EC2, S3, RDS, IAM, etc.)
2. Records configuration (security groups, tags, encryption settings)
3. Stores configuration snapshots to S3
4. Evaluates against Config Rules
5. Generates compliance report
6. Triggers remediation if non-compliant
```

### Configuration Item (CI)

**Configuration Item:** JSON document capturing resource configuration at point in time.

**Example: S3 Bucket Configuration Item**

```json
{
  "version": "1.3",
  "accountId": "123456789012",
  "configurationItemCaptureTime": "2025-01-14T14:00:00.000Z",
  "configurationItemStatus": "OK",
  "resourceType": "AWS::S3::Bucket",
  "resourceId": "my-bucket",
  "resourceName": "my-bucket",
  "ARN": "arn:aws:s3:::my-bucket",
  "awsRegion": "us-east-1",
  "configuration": {
    "name": "my-bucket",
    "versioning": {
      "status": "Enabled"
    },
    "encryption": {
      "rules": [{
        "applyServerSideEncryptionByDefault": {
          "sseAlgorithm": "AES256"
        }
      }]
    },
    "publicAccessBlockConfiguration": {
      "blockPublicAcls": true,
      "blockPublicPolicy": true,
      "ignorePublicAcls": true,
      "restrictPublicBuckets": true
    }
  },
  "configurationItemDiff": {
    "changedProperties": {
      "Configuration.Encryption": {
        "previousValue": null,
        "updatedValue": {
          "rules": [...]
        }
      }
    }
  }
}
```

**Config tracks:**
- Current configuration
- Configuration history (all changes over time)
- Relationships (e.g., EC2 instance → security group → VPC)
- Compliance status against rules

### Configuration Timeline

**Config provides timeline view:**

```
2025-01-14 14:00:00  Encryption enabled (AES256)
2025-01-10 09:15:00  Versioning enabled
2025-01-05 12:00:00  Public access blocked
2025-01-01 08:30:00  Bucket created
```

**Use Case:** Audit trail for configuration changes ("when was encryption disabled?").

---

## CloudTrail vs Config

### Service Comparison

| Feature | CloudTrail | Config |
|---------|-----------|--------|
| **Purpose** | Audit logging (who did what) | Configuration tracking (what changed) |
| **Data Captured** | API calls (actions) | Resource configurations (state) |
| **Question Answered** | Who deleted the S3 bucket? | What was the bucket's encryption setting before deletion? |
| **Retention** | 90 days (Event History), unlimited (trails to S3) | Indefinite (configuration snapshots in S3) |
| **Compliance** | Audit trail for regulatory compliance | Configuration compliance against standards |
| **Use Case** | Security forensics, user activity monitoring | Compliance enforcement, change tracking, drift detection |
| **Real-Time** | Near real-time (events delivered within 15 min) | Periodic snapshots (every 6 hours by default) + change triggers |

### When to Use Both (Recommended)

**CloudTrail:** Who changed security group and when?
**Config:** What was security group configuration before/after change?

**Example Investigation:**

**Incident:** Production RDS database encryption disabled.

**CloudTrail Investigation:**

```sql
SELECT
  userIdentity.userName,
  eventTime,
  requestParameters
FROM cloudtrail_events
WHERE
  eventName = 'ModifyDBInstance'
  AND requestParameters LIKE '%encryption%'
```

**Result:** User `alice@company.com` called `ModifyDBInstance` at `2025-01-14T10:30:00Z` with `storageEncrypted=false`.

**Config Investigation:**

```
Configuration Timeline for RDS Instance "production-db":

2025-01-14 10:30:00  storageEncrypted: false (API call: ModifyDBInstance by alice@company.com)
2025-01-01 08:00:00  storageEncrypted: true
```

**Conclusion:** Alice disabled encryption on Jan 14 at 10:30 AM. Config shows configuration before/after; CloudTrail shows who/when.

---

## Organizational Trails

### What is an Organizational Trail?

**Organizational Trail** is a CloudTrail trail that logs events for all AWS accounts in an AWS Organization.

**Benefits:**
- **Centralized logging**: All accounts log to same S3 bucket
- **Auto-enable for new accounts**: New accounts automatically covered
- **Simplified compliance**: Single audit log for entire organization
- **Cost optimization**: One trail vs. trail per account

### Setting Up Organizational Trail

**Prerequisites:**
- AWS Organizations enabled
- CloudTrail enabled in management account
- S3 bucket for logs (with appropriate bucket policy)

**Create Organizational Trail:**

```bash
aws cloudtrail create-trail \
  --name organization-trail \
  --s3-bucket-name organization-cloudtrail-logs \
  --is-multi-region-trail \
  --is-organization-trail \
  --enable-log-file-validation

aws cloudtrail start-logging --name organization-trail
```

**S3 Bucket Structure:**

```
s3://organization-cloudtrail-logs/
  └── AWSLogs/
      └── o-abc123/  (Organization ID)
          ├── 111111111111/  (Management account)
          │   └── CloudTrail/
          │       └── us-east-1/
          │           └── 2025/
          │               └── 01/
          │                   └── 14/
          │                       └── 111111111111_CloudTrail_us-east-1_20250114T1400Z_abc123.json.gz
          ├── 222222222222/  (Member account 1)
          └── 333333333333/  (Member account 2)
```

**Cost:** One trail covers all accounts (vs. $2/trail/month per account × 100 accounts = $200/month savings).

---

## Config Rules and Conformance Packs

### Config Rules

**Config Rule:** Desired configuration policy; Config evaluates resources against rule.

**Rule Types:**

**1. AWS Managed Rules (200+ rules)**

Pre-built rules for common compliance checks.

| Rule | Description |
|------|-------------|
| `s3-bucket-public-read-prohibited` | S3 buckets must not allow public read access |
| `encrypted-volumes` | EBS volumes must be encrypted |
| `rds-storage-encrypted` | RDS instances must have encryption enabled |
| `iam-password-policy` | IAM password policy must meet complexity requirements |
| `vpc-default-security-group-closed` | Default security group must not allow any traffic |

**2. Custom Rules (Lambda Functions)**

Custom compliance logic.

**Example: Require specific tags**

```python
import boto3
import json

def lambda_handler(event, context):
    config = boto3.client('config')

    # Get resource configuration
    configuration_item = json.loads(event['configurationItem'])
    resource_type = configuration_item['resourceType']
    resource_id = configuration_item['resourceId']
    tags = configuration_item.get('tags', {})

    # Check for required tags
    required_tags = ['Environment', 'Owner', 'CostCenter']
    compliance_type = 'COMPLIANT'

    for tag in required_tags:
        if tag not in tags:
            compliance_type = 'NON_COMPLIANT'
            break

    # Report compliance
    config.put_evaluations(
        Evaluations=[{
            'ComplianceResourceType': resource_type,
            'ComplianceResourceId': resource_id,
            'ComplianceType': compliance_type,
            'OrderingTimestamp': configuration_item['configurationItemCaptureTime']
        }],
        ResultToken=event['resultToken']
    )
```

### Config Rule Evaluation

**Trigger Types:**

| Trigger | When Rule Evaluates |
|---------|-------------------|
| **Configuration change** | Resource configuration changes |
| **Periodic** | Every 1, 3, 6, 12, or 24 hours |
| **Hybrid** | Both configuration change and periodic |

**Example:** `encrypted-volumes` rule evaluates when:
- New EBS volume created (configuration change trigger)
- Existing volume modified (configuration change trigger)
- Every 24 hours (periodic trigger for all volumes)

### Conformance Packs

**Conformance Pack:** Collection of Config Rules + remediation actions for compliance framework.

**AWS Managed Conformance Packs:**

| Pack | Rules | Framework |
|------|-------|-----------|
| **Operational Best Practices for CIS AWS Foundations Benchmark** | 53 rules | CIS 1.4.0 |
| **Operational Best Practices for PCI-DSS 3.2.1** | 39 rules | PCI-DSS |
| **Operational Best Practices for NIST 800-53 Rev 5** | 189 rules | NIST |
| **Operational Best Practices for HIPAA Security** | 23 rules | HIPAA |

**Deploy Conformance Pack:**

```bash
aws configservice put-conformance-pack \
  --conformance-pack-name cis-aws-foundations-benchmark \
  --template-s3-uri s3://aws-configconformance-packs-us-east-1/aws-cis-foundations-benchmark.yaml
```

**Benefit:** One command deploys all rules for compliance framework.

---

## CloudTrail Event Types

### Management Events

**Management Events:** Control plane operations (create, delete, modify resources).

**Examples:**
- `RunInstances` (launch EC2)
- `CreateBucket` (create S3 bucket)
- `DeleteDBInstance` (delete RDS instance)
- `PutBucketPolicy` (modify S3 bucket policy)

**Cost:** Free (included in all trails).

**Best Practice:** Always log management events (90-day Event History logs these automatically).

### Data Events

**Data Events:** Data plane operations (S3 object access, Lambda invocations).

**S3 Data Events:**
- `GetObject` (download file)
- `PutObject` (upload file)
- `DeleteObject` (delete file)

**Lambda Data Events:**
- `Invoke` (function invocation)

**Cost:** $0.10 per 100,000 events (first 250,000 S3 + 250,000 Lambda events free/month).

**Use Case:**
- Security: Detect unauthorized S3 object access
- Compliance: Audit trail for sensitive data access (HIPAA, PCI-DSS)
- Forensics: Who downloaded customer PII file?

**Enable Data Events (S3 Bucket):**

```bash
aws cloudtrail put-event-selectors \
  --trail-name my-trail \
  --event-selectors '[{
    "ReadWriteType": "All",
    "IncludeManagementEvents": true,
    "DataResources": [{
      "Type": "AWS::S3::Object",
      "Values": ["arn:aws:s3:::sensitive-data-bucket/*"]
    }]
  }]'
```

### Insights Events

**CloudTrail Insights:** ML-powered detection of unusual API activity.

**Detects:**
- Unusual volume of API calls
- Spike in error rates
- Unusual IAM activity

**Example:** User typically makes 10 `RunInstances` calls/day; suddenly makes 500/hour → Insights event generated.

**Cost:** $0.35 per 100,000 write management events analyzed.

**Use Case:** Detect compromised credentials, insider threats, misconfigurations.

---

## Configuration Change Tracking

### Config Change Notifications

**Trigger EventBridge rule on configuration change:**

**EventBridge Rule:**

```json
{
  "source": ["aws.config"],
  "detail-type": ["Config Configuration Item Change"],
  "detail": {
    "configurationItem": {
      "resourceType": ["AWS::EC2::SecurityGroup"],
      "configuration": {
        "ipPermissions": {
          "fromPort": [22],
          "ipRanges": {
            "cidrIp": ["0.0.0.0/0"]
          }
        }
      }
    }
  }
}
```

**Target: Lambda (Remediation)**

```python
import boto3

ec2 = boto3.client('ec2')

def lambda_handler(event, context):
    # Security group allows SSH from 0.0.0.0/0; remediate
    sg_id = event['detail']['configurationItem']['resourceId']

    # Remove rule
    ec2.revoke_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[{
            'IpProtocol': 'tcp',
            'FromPort': 22,
            'ToPort': 22,
            'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
        }]
    )

    # Add rule with company IP range
    ec2.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[{
            'IpProtocol': 'tcp',
            'FromPort': 22,
            'ToPort': 22,
            'IpRanges': [{'CidrIp': '203.0.113.0/24', 'Description': 'Company VPN'}]
        }]
    )

    return {'statusCode': 200, 'body': f'Remediated {sg_id}'}
```

### Config Aggregator

**Problem:** 100 AWS accounts; need compliance view across all accounts.

**Solution:** Config Aggregator consolidates Config data from multiple accounts/regions.

**Setup:**

```bash
aws configservice put-configuration-aggregator \
  --configuration-aggregator-name organization-aggregator \
  --organization-aggregation-source \
    OrganizationSourceDetails={
      OrganizationSourceType=ORGANIZATION,
      AllAwsRegions=true
    }
```

**Benefit:** Single dashboard showing compliance across all accounts.

---

## Integration Patterns

### Pattern 1: CloudTrail → CloudWatch Logs → Metric Filter → Alarm

**Use Case:** Alert on high-privilege API calls.

**Architecture:**

```
CloudTrail → CloudWatch Logs → Metric Filter (detect root account usage) → CloudWatch Alarm → SNS → PagerDuty
```

**Metric Filter:**

```json
{ ($.userIdentity.type = "Root") && ($.userIdentity.invokedBy NOT EXISTS) }
```

**Alarm:** Alert if root account used directly (compliance violation).

---

### Pattern 2: Config Rule → EventBridge → Lambda (Remediation)

**Use Case:** Auto-remediate non-compliant resources.

```
Config evaluates rule → Non-compliant → EventBridge → Lambda → Fix resource → Config re-evaluates → Compliant
```

**Example:** Unencrypted RDS instance → Lambda enables encryption.

---

### Pattern 3: CloudTrail Lake → Athena (Long-Term Analysis)

**Use Case:** Query 2 years of CloudTrail events for security investigation.

**CloudTrail Lake SQL:**

```sql
SELECT
  userIdentity.principalId,
  COUNT(*) as failed_logins
FROM
  cloudtrail_lake_events
WHERE
  eventName = 'ConsoleLogin'
  AND errorCode = 'Failed authentication'
  AND eventTime > '2023-01-01T00:00:00Z'
GROUP BY userIdentity.principalId
ORDER BY failed_logins DESC
LIMIT 10
```

**Use Case:** Detect brute-force login attempts over long timeframe.

---

### Pattern 4: Config Aggregator → QuickSight (Compliance Dashboard)

**Use Case:** Executive dashboard showing compliance across organization.

```
Config Aggregator → S3 (compliance data) → QuickSight → Dashboard
```

**Dashboard Shows:**
- Compliance score per account
- Non-compliant resources by type
- Trend over time

---

## Cost Optimization Strategies

### CloudTrail Pricing (us-east-1, 2025)

**Management Events:**
- First trail: Free
- Additional trails: $2.00 per 100,000 events

**Data Events:**
- S3: $0.10 per 100,000 events (first 250K free/month)
- Lambda: $0.10 per 100,000 events (first 250K free/month)

**Insights Events:**
- $0.35 per 100,000 write management events analyzed

**CloudTrail Lake:**
- Ingestion: $2.50 per GB
- Storage: Included (7-year retention)
- Queries: Free

**S3 Storage:**
- Standard: $0.023 per GB-month
- Intelligent-Tiering: $0.0025 per 1000 objects + storage cost

### Config Pricing

**Configuration Items:**
- $0.003 per configuration item recorded

**Config Rule Evaluations:**
- $0.001 per evaluation (first 100K free/month)

**Conformance Pack Evaluations:**
- $0.0012 per evaluation

### 1. Use One Trail Per Region (Not Per Account)

**Problem:** Default CloudTrail creates trail per account; 100 accounts = 100 trails.

**Solution:** Use organizational trail (one trail covers all accounts).

**Cost Savings:**

```
Without Organizational Trail:
100 accounts × $2/trail = $200/month (trails cost)
+ S3 storage for 100 separate buckets

With Organizational Trail:
First trail free
S3 storage for 1 central bucket

Savings: $200/month
```

---

### 2. Selective Data Event Logging

**Problem:** Logging all S3 data events for 10 TB bucket = millions of events/month.

**Solution:** Log data events only for sensitive buckets.

**Example:**

```
Total S3 buckets: 100
Sensitive buckets requiring data event logging: 5

Cost without optimization:
100 buckets × 1M events/month × $0.10/100K = $1,000/month

Cost with optimization:
5 buckets × 1M events/month × $0.10/100K = $50/month

Savings: $950/month (95%)
```

---

### 3. Lifecycle S3 Logs to Glacier

**Problem:** CloudTrail logs stored in S3 Standard indefinitely.

**Solution:** Lifecycle policy moves old logs to Glacier.

**S3 Lifecycle Policy:**

```json
{
  "Rules": [{
    "Id": "CloudTrail-Log-Lifecycle",
    "Status": "Enabled",
    "Transitions": [
      {
        "Days": 90,
        "StorageClass": "GLACIER"
      },
      {
        "Days": 365,
        "StorageClass": "DEEP_ARCHIVE"
      }
    ],
    "Expiration": {
      "Days": 2557
    }
  }]
}
```

**Cost Comparison (1 TB CloudTrail logs):**

```
S3 Standard: 1 TB × $0.023/GB = $23.55/month
Glacier (after 90 days): 1 TB × $0.004/GB = $4.10/month
Deep Archive (after 1 year): 1 TB × $0.00099/GB = $1.01/month

Savings: $22.54/month (96% for long-term storage)
```

---

### 4. Disable Config for Non-Critical Resources

**Problem:** Config records all resource types; generates configuration items for resources that don't need compliance tracking.

**Solution:** Configure Config to record only critical resource types.

**Example:**

```
Record all resource types:
1,000 resources × 10 changes/month = 10,000 CIs
Cost: 10,000 × $0.003 = $30/month

Record only critical types (EC2, S3, RDS, IAM):
300 resources × 10 changes/month = 3,000 CIs
Cost: 3,000 × $0.003 = $9/month

Savings: $21/month (70%)
```

**Configure Resource Types:**

```bash
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::123456789012:role/ConfigRole \
  --recording-group \
    allSupported=false,\
    includeGlobalResources=false,\
    resourceTypes=AWS::EC2::Instance,AWS::S3::Bucket,AWS::RDS::DBInstance,AWS::IAM::User
```

---

### 5. Use Conformance Packs Instead of Individual Rules

**Problem:** Deploying 50 Config Rules individually = 50× rule evaluation costs.

**Solution:** Use Conformance Pack (single deployment, same evaluations).

**Benefit:** Operational simplicity (one API call vs. 50); same cost.

---

### Cost Example: 100-Account Organization

**CloudTrail:**

```
Organizational trail: Free (first trail)
Management events: Included
Data events (5 sensitive buckets): 5M events/month
  Cost: (5M - 250K free) × $0.10/100K = $47.50/month
S3 storage (10 GB/month): 10 GB × $0.023 = $0.23/month

Total CloudTrail: ~$48/month
```

**Config:**

```
Resources monitored: 5,000 (across 100 accounts)
Changes/month: 5,000 × 5 = 25,000 CIs
CI cost: 25,000 × $0.003 = $75/month

Config Rules: 10 rules per account = 1,000 rules
Evaluations: 25,000 CIs × 1,000 rules = 25M evaluations
Evaluation cost: (25M - 100K free) × $0.001/1K = $24.90/month

Total Config: ~$100/month
```

**Total Audit & Compliance Cost: ~$148/month for 100 accounts** ($1.48/account/month)

---

## Performance and Scalability

### CloudTrail Latency

**Event Delivery:**
- CloudTrail to S3: Typically within 15 minutes
- CloudTrail to CloudWatch Logs: 1-5 minutes
- Event History (console): Real-time to 5 minutes

**Scaling:**
- Fully managed; handles millions of events/sec
- No throttling concerns for standard usage

### Config Latency

**Configuration Recording:**
- Change detection: 1-15 minutes (after AWS API call)
- Configuration snapshot: Every 6 hours (default) + change-triggered
- Rule evaluation: 1-10 minutes (after configuration change)

**Scaling:**
- Fully managed; scales automatically
- Supports thousands of resources per account

---

## Security Best Practices

### 1. Enable Log File Validation

**CloudTrail Log File Validation** ensures logs haven't been tampered with.

**Enable:**

```bash
aws cloudtrail update-trail \
  --name my-trail \
  --enable-log-file-validation
```

**Validation:**

```bash
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:us-east-1:123456789012:trail/my-trail \
  --start-time 2025-01-14T00:00:00Z \
  --end-time 2025-01-14T23:59:59Z
```

**Benefit:** Proves log integrity to auditors (SOC 2, PCI-DSS requirement).

---

### 2. Encrypt CloudTrail Logs with KMS

**Encrypt logs at rest:**

```bash
aws cloudtrail update-trail \
  --name my-trail \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/abc123
```

**Benefit:** Logs encrypted with customer-managed key (additional security layer).

---

### 3. Restrict S3 Bucket Access

**S3 Bucket Policy (CloudTrail Logs):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": {"Service": "cloudtrail.amazonaws.com"},
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::my-cloudtrail-bucket"
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": {"Service": "cloudtrail.amazonaws.com"},
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-cloudtrail-bucket/*",
      "Condition": {
        "StringEquals": {"s3:x-amz-acl": "bucket-owner-full-control"}
      }
    },
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-cloudtrail-bucket/*",
      "Condition": {
        "StringNotEquals": {"s3:x-amz-server-side-encryption": "AES256"}
      }
    }
  ]
}
```

---

### 4. Monitor CloudTrail Configuration Changes

**EventBridge Rule (Detect Trail Deletion):**

```json
{
  "source": ["aws.cloudtrail"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventName": ["DeleteTrail", "StopLogging", "UpdateTrail"]
  }
}
```

**Target:** SNS → Alert security team immediately.

**Benefit:** Detect attacker trying to cover tracks by disabling logging.

---

### 5. Separate S3 Bucket for CloudTrail Logs

**Best Practice:** Dedicated S3 bucket for CloudTrail (not mixed with application data).

**Why:**
- Easier access control (only security team)
- Lifecycle policies specific to logs
- Clear separation for compliance audits

---

## Observability and Monitoring

### Key CloudWatch Metrics

**CloudTrail:**

No native CloudWatch metrics; use CloudWatch Logs metric filters.

**Metric Filter Examples:**

```
Root Account Usage:
{ ($.userIdentity.type = "Root") && ($.userIdentity.invokedBy NOT EXISTS) }

Failed Console Login:
{ ($.eventName = ConsoleLogin) && ($.errorMessage = "Failed authentication") }

Unauthorized API Calls:
{ ($.errorCode = "*UnauthorizedOperation") || ($.errorCode = "AccessDenied*") }

Changes to Network ACLs:
{ ($.eventName = CreateNetworkAcl*) || ($.eventName = DeleteNetworkAcl*) }
```

**Config:**

| Metric (Custom via EventBridge) | Description | Alert Threshold |
|--------------------------------|-------------|-----------------|
| Non-compliant resources | Count of failed compliance checks | >0 (investigate) |
| Config rule evaluation failures | Rules failing to evaluate | >0 (fix rule/permissions) |

---

## Common Pitfalls

### Pitfall 1: CloudTrail Disabled in New Accounts

**Problem:** New AWS account created; CloudTrail not enabled; no audit trail for first 30 days.

**Solution:** Use organizational trail (auto-enables for new accounts).

**Cost Impact:** No audit trail for security incident investigation; compliance violation.

---

### Pitfall 2: Not Monitoring CloudTrail Configuration Changes

**Problem:** Attacker compromises account; disables CloudTrail to cover tracks; no alert.

**Solution:** EventBridge rule alerts on `StopLogging`, `DeleteTrail` API calls.

**Cost Impact:** Extended breach duration; forensic investigation hampered.

---

### Pitfall 3: Config Recording Too Many Resource Types

**Problem:** Config records all resource types; generates CIs for resources that don't need compliance tracking.

**Solution:** Configure Config to record only critical resources (EC2, S3, RDS, IAM).

**Cost Impact:** 3× higher costs for unnecessary CIs.

---

### Pitfall 4: No Lifecycle Policy for CloudTrail Logs

**Problem:** CloudTrail logs accumulate in S3 Standard; costs grow indefinitely.

**Solution:** S3 lifecycle policy moves old logs to Glacier/Deep Archive after 90 days.

**Cost Impact:** 20× higher storage costs vs. Glacier for long-term logs.

---

### Pitfall 5: CloudTrail Logs Not Encrypted

**Problem:** Logs stored unencrypted; compliance violation (PCI-DSS, HIPAA).

**Solution:** Enable KMS encryption for CloudTrail logs.

**Cost Impact:** Compliance audit failure; regulatory fines.

---

### Pitfall 6: Config Rules Without Remediation

**Problem:** Config detects non-compliant resources and generates alerts, but no one fixes them and hundreds of violations accumulate.

**Solution:** Automated remediation with EventBridge + Lambda for common violations.

**Cost Impact:** Security posture degrades over time; compliance score drops.

---

### Pitfall 7: Not Using Config Aggregator

**Problem:** With 100 AWS accounts, the security team checks compliance in each account manually, which takes days.

**Solution:** Config Aggregator provides single dashboard across all accounts.

**Cost Impact:** Operational overhead; delayed incident response.

---

## Key Takeaways

1. **CloudTrail logs actions (who did what); Config tracks state (what changed).** CloudTrail records API calls for audit. Config records resource configurations for compliance.

2. **Enable organizational trail for multi-account logging.** One trail covers all accounts and auto-enables for new accounts with a centralized S3 bucket. This saves $200/month vs. a trail per account.

3. **CloudTrail provides 90-day Event History for free.** Quick investigations covered without creating trail. Create trail for >90 days or data events.

4. **Config evaluates compliance with 200+ managed rules.** Pre-built rules for CIS, PCI-DSS, HIPAA, NIST. Deploy conformance packs in one command.

5. **Use Config Aggregator for multi-account compliance view.** Single dashboard showing compliance across all accounts/regions.

6. **CloudTrail Insights detects unusual API activity with ML.** Identifies compromised credentials, insider threats, misconfigurations automatically.

7. **Automate remediation with Config + EventBridge + Lambda.** Non-compliant resource triggers Lambda to fix automatically (e.g., enable encryption, remove public access).

8. **Log file validation ensures CloudTrail logs not tampered with.** Required for SOC 2, PCI-DSS compliance; proves log integrity to auditors.

9. **Lifecycle S3 logs to Glacier for 96% storage savings.** Move logs >90 days old to Glacier ($0.004/GB vs. $0.023/GB Standard).

10. **Selective data event logging reduces costs 95%.** Enable data events only for sensitive S3 buckets (not all buckets).

11. **Config records configuration items ($0.003/CI).** Optimize cost by recording only critical resource types (EC2, S3, RDS, IAM).

12. **CloudTrail Lake provides SQL queryable audit logs.** Query events across accounts/regions with SQL. It offers 7-year retention at $2.50/GB ingestion.

13. **Monitor CloudTrail configuration changes with EventBridge.** Alert on `StopLogging`, `DeleteTrail` API calls to detect attackers covering tracks.

14. **Config timeline shows configuration changes over time.** Answer "what was security group configuration on Jan 10?" for forensic investigation.

15. **Conformance packs deploy 50+ rules in one command.** CIS, PCI-DSS, NIST, HIPAA frameworks available as pre-packaged conformance packs.

**AWS CloudTrail and Config together provide comprehensive audit logging and compliance monitoring, enabling automated governance, security forensics, and regulatory compliance across multi-account AWS environments. CloudTrail answers "who did what" while Config answers "what changed"; both are essential for defense-in-depth security and compliance.**
