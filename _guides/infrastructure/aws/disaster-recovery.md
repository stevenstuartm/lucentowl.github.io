---
title: "Disaster Recovery on AWS for System Architects"
layout: guide
category: AWS
subcategory: Architecture Patterns (Advanced)
description: "Comprehensive guide to disaster recovery on AWS covering RTO/RPO targets, backup strategies, pilot light, warm standby, multi-site, and cost optimization"
tags: [aws, disaster-recovery, resilience, architecture, reliability, backup, rto-rpo, practical]
---

## What Problems Disaster Recovery Solves

**Disasters that cause data loss or downtime**:

1. **Regional failures**: AWS region outages (rare but happen)
   - Example: US-EAST-1 outage December 2021 (7+ hours)
   - Impact: 100% downtime if single-region, no DR

2. **Data corruption**: Application bugs, ransomware, accidental deletions
   - Example: DELETE FROM users WHERE 1=1 (oops, forgot WHERE clause)
   - Impact: Data loss, cannot restore without backups

3. **Natural disasters**: Hurricanes, earthquakes, floods affecting data centers
   - Example: Hurricane affecting entire AWS region
   - Impact: Extended outage if data center physically damaged

4. **Human error**: Misconfigurations, accidental resource deletions
   - Example: Terraform destroy in production instead of staging
   - Impact: Infrastructure destroyed, requires rebuild from backups

5. **Security incidents**: Ransomware, data breach, malicious deletion
   - Example: Attacker gains admin access, deletes all RDS databases
   - Impact: Data loss, compliance violations, business continuity risk

**DR solves**:
- **Business continuity**: Continue operating during/after disaster
- **Data protection**: Restore data to point before corruption/loss
- **Compliance**: Meet regulatory requirements for data retention and recovery
- **Risk mitigation**: Reduce financial impact of downtime

## RTO and RPO Fundamentals

### Definitions

**Recovery Time Objective (RTO)**: Maximum acceptable downtime

```
Disaster occurs → Recovery begins → Systems operational
|<-------------- RTO ------------->|
```

**Example**: "Our RTO is 4 hours" means systems must be operational within 4 hours of disaster.

**Recovery Point Objective (RPO)**: Maximum acceptable data loss

```
Last successful backup → Disaster occurs
|<------- RPO ------->|
Data created in this window is lost
```

**Example**: "Our RPO is 1 hour" means we can tolerate losing up to 1 hour of data.

### Cost-Complexity Spectrum

| RTO | RPO | DR Strategy | Complexity | Cost (relative to backup/restore baseline) |
|-----|-----|-------------|------------|--------------------------------------------|
| 24h | 24h | Backup & Restore | Low | 1× (baseline) |
| 4-12h | 1-4h | Pilot Light | Medium | 2-3× |
| 1-4h | 5-15min | Warm Standby | Medium-High | 3-5× |
| <1h | <1min | Multi-Site Active-Active | High | 6-10× |

<div class="callout callout--warning">
<p class="callout__title">Key Insight</p>
<p>Aggressive RTO/RPO targets exponentially increase cost and complexity.</p>
</div>

### Business Impact Analysis

**Determine appropriate RTO/RPO**:

1. **Calculate downtime cost**:
   - Revenue per hour: $50,000/hour
   - Lost customers per hour of downtime: 100
   - Customer lifetime value: $1,000
   - Reputation damage: Difficult to quantify but significant

   **Cost of 1-hour outage**: $50,000 (revenue) + $100,000 (lost customers) = $150,000

2. **Evaluate data loss impact**:
   - Financial transactions: Cannot lose any (RPO near-zero)
   - User-generated content: Can tolerate 15 minutes (RPO 15min)
   - Logs and analytics: Can tolerate 24 hours (RPO 24h)

3. **Balance cost vs risk**:
   - Multi-site active-active: $30,000/month to prevent $150,000 loss
   - ROI: $30K/month = $360K/year to protect against $150K per outage
   - If outages happen 1/year: Not worth it ($360K > $150K)
   - If outages happen 3+/year: Worth it ($360K < $450K)

## DR Strategy Selection Framework

### Decision Matrix

**Step 1: Determine RTO/RPO requirements** (from business impact analysis)

**Step 2: Select DR strategy**:

```
┌─────────────────────────────────────────────────────────────┐
│                    DR Strategy Selection                     │
├─────────────────┬───────────┬──────────┬─────────────────────┤
│ Business Need   │ RTO       │ RPO      │ Recommended Strategy│
├─────────────────┼───────────┼──────────┼─────────────────────┤
│ Dev/Test        │ Days      │ 24h      │ Backup & Restore    │
│ Internal Tools  │ 12-24h    │ 4-24h    │ Backup & Restore    │
│ Business Apps   │ 4-12h     │ 1-4h     │ Pilot Light         │
│ Customer-Facing │ 1-4h      │ 5-15min  │ Warm Standby        │
│ Mission-Critical│ <1h       │ <1min    │ Multi-Site Active   │
└─────────────────┴───────────┴──────────┴─────────────────────┘
```

**Step 3: Validate cost-benefit**:
- Estimated DR cost per month: $X
- Estimated outage cost: $Y per incident
- Expected outage frequency: Z per year
- Breakeven: $X × 12 months = $Y × Z incidents

If DR cost < outage cost × frequency: Invest in DR
If DR cost > outage cost × frequency: Accept risk or choose cheaper DR strategy

## Backup and Restore

**Pattern**: Regular backups stored offsite, restore when needed.

**RTO**: `12−24` hours (time to provision infrastructure + restore data)
**RPO**: `1−24` hours (time since last backup)
**Cost**: Baseline (1×); only pay for storage

### Architecture

```
Production (us-east-1)
├── EC2 instances → AMIs (daily snapshots)
├── RDS database → Automated backups (daily) + Manual snapshots (weekly)
├── S3 buckets → Versioning enabled, lifecycle policies
└── EBS volumes → Daily snapshots

Backups stored in:
├── Same region (different AZ) - Fast restore, same-region risk
└── Cross-region (us-west-2) - Slow restore, regional failure protection
```

### Implementation

**RDS automated backups**:

```bash
# Enable automated backups (retention 7-35 days)
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --region us-east-1

# Copy automated backup to another region
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:us-east-1:123456789012:snapshot:mydb-snapshot \
  --target-db-snapshot-identifier mydb-snapshot-dr \
  --source-region us-east-1 \
  --region us-west-2
```

**EBS snapshots** (automated with Data Lifecycle Manager):

```json
{
  "PolicyDetails": {
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [
      {"Key": "Backup", "Value": "true"}
    ],
    "Schedules": [
      {
        "Name": "Daily Snapshots",
        "CreateRule": {
          "Interval": 24,
          "IntervalUnit": "HOURS",
          "Times": ["03:00"]
        },
        "RetainRule": {
          "Count": 7
        },
        "CopyTags": true,
        "CrossRegionCopyRules": [
          {
            "TargetRegion": "us-west-2",
            "Encrypted": true,
            "RetainRule": {
              "Interval": 7,
              "IntervalUnit": "DAYS"
            }
          }
        ]
      }
    ]
  }
}
```

**S3 cross-region replication** (for backup):

```json
{
  "Role": "arn:aws:iam::123456789012:role/s3-replication-role",
  "Rules": [
    {
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::myapp-backup-us-west-2",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {"Minutes": 15}
        }
      },
      "DeleteMarkerReplication": {"Status": "Enabled"}
    }
  ]
}
```

**Infrastructure as Code** (backup via Git):

```bash
# Store Terraform/CloudFormation in Git
git commit -am "Production infrastructure state"
git push origin main

# In DR region, recreate from IaC
git clone https://github.com/myorg/infrastructure
cd infrastructure
terraform init
terraform plan -var-file=dr-region.tfvars
terraform apply
```

### Recovery Process

**Scenario**: US-EAST-1 region failure, recover to US-WEST-2

1. **Provision infrastructure** (4-8 hours):
   ```bash
   # Launch EC2 instances from AMI snapshots copied to us-west-2
   aws ec2 run-instances \
     --image-id ami-backup-12345 \
     --instance-type m5.large \
     --count 10 \
     --region us-west-2
   ```

2. **Restore database** (2-6 hours):
   ```bash
   # Restore RDS from snapshot in us-west-2
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier mydb-restored \
     --db-snapshot-identifier mydb-snapshot-dr \
     --region us-west-2
   ```

3. **Update DNS** (5-60 minutes):
   ```bash
   # Update Route 53 to point to us-west-2 resources
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456 \
     --change-batch '{
       "Changes": [{
         "Action": "UPSERT",
         "ResourceRecordSet": {
           "Name": "app.example.com",
           "Type": "A",
           "AliasTarget": {
             "DNSName": "us-west-2-alb.amazonaws.com",
             "HostedZoneId": "Z789012"
           }
         }
       }]
     }'
   ```

4. **Verify and test** (1-2 hours):
   - Smoke tests: Critical user journeys functional
   - Data integrity: Recent backup data present
   - Performance: Systems handling expected load

**Total RTO**: 8-17 hours (infrastructure + database + DNS + testing)

### Cost

**Storage costs**:
- RDS backups: Free (within retention period)
- EBS snapshots: $0.05/GB-month (incremental)
- S3 CRR: $0.023/GB-month (Standard) + $0.02/GB replication

**Example**:
- RDS: 500GB database, 7-day retention = $0 (included)
- EBS: 1TB snapshots (incremental 20% change/day) = 200GB × $0.05 = $10/month
- S3: 10TB data replicated to DR region = 10TB × $0.023 = $230/month + 10TB × $0.02 = $200 replication
- **Total**: $440/month

**When to use**:
- Non-critical applications (tolerate 12-24h RTO)
- Infrequent disasters (cost of outage < cost of more expensive DR)
- Development/test environments

## Pilot Light

**Pattern**: Minimal infrastructure running in DR region, scaled up during disaster.

**RTO**: 4-12 hours (time to scale up infrastructure + restore data)
**RPO**: 5-60 minutes (near-real-time data replication)
**Cost**: 2-3× backup/restore (DR region has minimal compute + data replication)

### Architecture

```
Primary (us-east-1)
├── EC2 Auto Scaling Group (20 instances)
├── RDS Multi-AZ (db.r5.2xlarge)
├── ElastiCache (3-node cluster)
└── Application Load Balancer

DR Region (us-west-2) - "Pilot Light"
├── EC2 Auto Scaling Group (2 instances minimum, scaled down)
├── RDS Read Replica (db.r5.2xlarge) ← Continuous replication
├── ElastiCache (1-node cluster)
└── Application Load Balancer (unhealthy targets, not receiving traffic)

Route 53 Failover Routing
├── Primary: us-east-1 ALB (health check passing)
└── Secondary: us-west-2 ALB (only used if primary fails)
```

**Key concept**: Core infrastructure (database) continuously replicating, compute minimal but ready to scale.

### Implementation

**RDS cross-region read replica**:

```bash
# Create read replica in DR region
aws rds create-db-instance-read-replica \
  --db-instance-identifier mydb-replica-us-west-2 \
  --source-db-instance-identifier arn:aws:rds:us-east-1:123456789012:db:mydb \
  --db-instance-class db.r5.2xlarge \
  --region us-west-2
```

**Auto Scaling Group** (DR region, scaled down):

```json
{
  "AutoScalingGroupName": "app-asg-dr",
  "MinSize": 2,
  "MaxSize": 20,
  "DesiredCapacity": 2,
  "LaunchTemplate": {
    "LaunchTemplateId": "lt-12345",
    "Version": "$Latest"
  },
  "VPCZoneIdentifier": "subnet-dr-1,subnet-dr-2",
  "TargetGroupARNs": [
    "arn:aws:elasticloadbalancing:us-west-2:123456789012:targetgroup/app-tg-dr/abc123"
  ]
}
```

**Route 53 failover routing**:

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "Primary",
      "Failover": "PRIMARY",
      "HealthCheckId": "health-check-us-east-1",
      "AliasTarget": {
        "DNSName": "app-alb-us-east-1.amazonaws.com",
        "HostedZoneId": "Z123456"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "Secondary",
      "Failover": "SECONDARY",
      "AliasTarget": {
        "DNSName": "app-alb-us-west-2.amazonaws.com",
        "HostedZoneId": "Z789012"
      }
    }
  ]
}
```

### Recovery Process

**Scenario**: US-EAST-1 region failure

1. **Promote read replica to standalone** (5-10 minutes):
   ```bash
   aws rds promote-read-replica \
     --db-instance-identifier mydb-replica-us-west-2 \
     --region us-west-2
   ```

2. **Scale up Auto Scaling Group** (10-20 minutes):
   ```bash
   aws autoscaling set-desired-capacity \
     --auto-scaling-group-name app-asg-dr \
     --desired-capacity 20 \
     --region us-west-2
   ```

3. **Route 53 automatic failover** (1-3 minutes):
   - Health check detects primary failure
   - Traffic automatically routed to secondary (us-west-2)

4. **Verify and test** (30-60 minutes):
   - Database promotion complete (writable)
   - ASG scaled to full capacity
   - Application functional

**Total RTO**: 45 minutes to 1.5 hours

### Cost

**Primary region**: $15,000/month
**DR region**:
- EC2: 2 instances (vs 20) = $300/month
- RDS read replica: $1,500/month (same size as primary)
- ElastiCache: $100/month (1 node vs 3)
- Data replication: $500/month
- **Total DR**: $2,400/month

**Total cost**: $17,400/month (16% increase over single-region)

**When to use**:
- Business-critical applications (4-12h RTO acceptable)
- Budget-conscious (2× vs 6× for active-active)
- Infrequent failovers (quarterly testing acceptable)

## Warm Standby

**Pattern**: Scaled-down but fully functional environment in DR region, scaled up during disaster.

**RTO**: 1-4 hours (time to scale up to full capacity)
**RPO**: 5-15 minutes (near-real-time replication)
**Cost**: 3-5× backup/restore (DR region running at 20-50% capacity)

### Architecture

```
Primary (us-east-1) - 100% capacity
├── EC2 Auto Scaling Group (100 instances)
├── RDS Multi-AZ (db.r5.4xlarge)
├── ElastiCache (6-node cluster)
└── ALB (100% traffic)

DR Region (us-west-2) - 30% capacity
├── EC2 Auto Scaling Group (30 instances, scaled to 100 during failover)
├── Aurora Global Database (read replica, promoted to writer during failover)
├── ElastiCache (2-node cluster, scaled to 6 during failover)
└── ALB (receiving 0% traffic, but healthy and ready)

Route 53 Latency-Based Routing (or Failover)
├── us-east-1: 100% traffic (lower latency for US users)
└── us-west-2: 0% traffic (automatic failover if us-east-1 unhealthy)
```

**Key differences from Pilot Light**:
- **Warm standby**: DR region running at 30-50% capacity (not minimal)
- **Pilot light**: DR region minimal capacity (10% or less)

### Implementation

**Aurora Global Database** (better than RDS for warm standby):

```bash
# Create global database
aws rds create-global-cluster \
  --global-cluster-identifier myapp-global \
  --engine aurora-postgresql \
  --engine-version 14.6

# Primary cluster (us-east-1)
aws rds create-db-cluster \
  --db-cluster-identifier myapp-primary \
  --engine aurora-postgresql \
  --global-cluster-identifier myapp-global \
  --region us-east-1

# Secondary cluster (us-west-2)
aws rds create-db-cluster \
  --db-cluster-identifier myapp-secondary \
  --engine aurora-postgresql \
  --global-cluster-identifier myapp-global \
  --region us-west-2
```

**Auto Scaling with scheduled scaling** (DR region):

```json
{
  "ScheduledActions": [
    {
      "ScheduledActionName": "scale-up-for-failover-test",
      "Schedule": "0 9 * * 1",
      "MinSize": 100,
      "MaxSize": 150,
      "DesiredCapacity": 100
    },
    {
      "ScheduledActionName": "scale-down-after-test",
      "Schedule": "0 18 * * 1",
      "MinSize": 30,
      "MaxSize": 100,
      "DesiredCapacity": 30
    }
  ]
}
```

**CloudWatch alarm to auto-scale during failover**:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name primary-region-down-scale-dr \
  --alarm-description "Scale DR region when primary fails" \
  --metric-name HealthCheckStatus \
  --namespace AWS/Route53 \
  --statistic Minimum \
  --period 60 \
  --threshold 0 \
  --comparison-operator LessThanThreshold \
  --datapoints-to-alarm 3 \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-west-2:123456789012:scale-dr-region
```

**SNS topic triggers Lambda to scale DR**:

```python
import boto3

def lambda_handler(event, context):
    autoscaling = boto3.client('autoscaling', region_name='us-west-2')
    rds = boto3.client('rds', region_name='us-west-2')

    # Scale EC2 Auto Scaling Group to full capacity
    autoscaling.set_desired_capacity(
        AutoScalingGroupName='app-asg-dr',
        DesiredCapacity=100
    )

    # Promote Aurora secondary to primary (writable)
    rds.failover_global_cluster(
        GlobalClusterIdentifier='myapp-global',
        TargetDbClusterIdentifier='myapp-secondary'
    )

    return {'statusCode': 200, 'body': 'DR failover initiated'}
```

### Recovery Process

**Automated failover** (triggered by Route 53 health check failure):

1. **Route 53 detects primary failure** (1-3 minutes)
2. **SNS triggers Lambda** (30 seconds)
3. **Lambda promotes Aurora secondary** (30-60 seconds)
4. **Lambda scales EC2 ASG** (5-10 minutes to reach full capacity)
5. **Route 53 shifts traffic to us-west-2** (1-3 minutes DNS propagation)

**Total RTO**: 10-18 minutes (mostly ASG scale-up time)

**Manual verification**:
- Confirm Aurora promotion successful (now writable)
- Verify ASG reached desired capacity
- Run smoke tests on critical user journeys

### Cost

**Primary region**: $15,000/month
**DR region** (30% capacity):
- EC2: 30 instances (vs 100) = $4,500/month
- Aurora Global DB: $1,800/month (same size as primary, continuous replication)
- ElastiCache: $200/month (2 nodes vs 6)
- Data replication: $800/month
- **Total DR**: $7,300/month

**Total cost**: $22,300/month (49% increase over single-region)

**When to use**:
- Customer-facing applications (1-4h RTO target)
- Can justify 50% cost increase for faster recovery
- Frequent failover testing (monthly) acceptable

## Multi-Site Active-Active

**Pattern**: Full production capacity in multiple regions, all serving traffic simultaneously.

**RTO**: <1 hour (typically seconds to minutes, automatic failover)
**RPO**: <1 minute (continuous replication with minimal lag)
**Cost**: 6-10× backup/restore (full capacity in 2+ regions)

### Architecture

```
Users (Global)
    ↓
Route 53 Geolocation / Latency-Based Routing
    ↓
┌──────────────────────────────┬──────────────────────────────┐
│   us-east-1 (50% traffic)    │   eu-west-1 (50% traffic)    │
│   ├── EC2 ASG (100 instances)│   ├── EC2 ASG (100 instances)│
│   ├── Aurora Global (writer) │   ├── Aurora Global (writer) │
│   ├── DynamoDB Global Table  │   ├── DynamoDB Global Table  │
│   ├── ElastiCache (6 nodes)  │   ├── ElastiCache (6 nodes)  │
│   └── ALB (healthy)           │   └── ALB (healthy)           │
└──────────────────────────────┴──────────────────────────────┘
         ↑                                  ↑
         └───── Cross-Region Replication ───┘
           (Aurora, DynamoDB, S3, ElastiCache Global Datastore)
```

**Key characteristics**:
- Both regions serve production traffic (not standby)
- Database writes in both regions (eventual consistency with conflict resolution)
- Regional failure = traffic shifts to healthy region (automatic, seconds)

### Implementation

**DynamoDB Global Tables** (multi-master):

```bash
aws dynamodb create-table \
  --table-name users \
  --attribute-definitions AttributeName=user_id,AttributeType=S \
  --key-schema AttributeName=user_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1

aws dynamodb update-table \
  --table-name users \
  --replica-updates '[
    {"Create": {"RegionName": "eu-west-1"}},
    {"Create": {"RegionName": "ap-southeast-1"}}
  ]' \
  --region us-east-1
```

**Aurora Global Database with managed failover**:

```bash
# Enable managed planned failover
aws rds modify-global-cluster \
  --global-cluster-identifier myapp-global \
  --enable-global-write-forwarding
```

**ElastiCache Global Datastore** (Redis):

```bash
aws elasticache create-global-replication-group \
  --global-replication-group-id-suffix myapp \
  --primary-replication-group-id myapp-us-east-1 \
  --region us-east-1

aws elasticache create-replication-group \
  --replication-group-id myapp-eu-west-1 \
  --global-replication-group-id myapp-global \
  --replication-group-description "EU West 1 cache" \
  --region eu-west-1
```

**Route 53 health checks with automatic failover**:

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "US-EAST-1",
      "GeoLocation": {"ContinentCode": "NA"},
      "HealthCheckId": "health-check-us-east-1",
      "AliasTarget": {
        "DNSName": "app-alb-us-east-1.amazonaws.com"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "EU-WEST-1",
      "GeoLocation": {"ContinentCode": "EU"},
      "HealthCheckId": "health-check-eu-west-1",
      "AliasTarget": {
        "DNSName": "app-alb-eu-west-1.amazonaws.com"
      }
    }
  ]
}
```

### Recovery Process

**Automatic failover** (no manual intervention):

1. **Route 53 health check detects failure** (30-90 seconds)
2. **Traffic automatically shifts to healthy region** (DNS propagation 10-60 seconds)
3. **Users continue without interruption** (may see brief latency increase)

**Example**: us-east-1 fails
- North America users (previously us-east-1): Automatically route to eu-west-1
- Latency increases from 50ms → 120ms, but service remains available
- Europe users (previously eu-west-1): No change

**Manual verification**:
- Confirm traffic shifted successfully (CloudWatch metrics)
- Verify database replication lag (should remain <1s)
- Monitor error rates (should remain low)

**Total RTO**: 1-3 minutes (health check + DNS propagation)

### Cost

**Region 1 (us-east-1)**: $15,000/month
**Region 2 (eu-west-1)**: $15,000/month
**Data replication**:
- Aurora Global DB: $800/month
- DynamoDB Global Tables: $1,200/month (replicated writes)
- ElastiCache Global Datastore: $400/month
- S3 CRR: $500/month
- **Total replication**: $2,900/month

**Total cost**: $32,900/month (119% increase over single-region, 2.2× total)

**When to use**:
- Mission-critical applications (cannot tolerate downtime)
- Global user base (latency optimization + HA)
- Regulatory compliance (data residency in multiple regions)
- Can justify 2× cost for near-zero RTO/RPO

## Data Backup Strategies

### Database Backups

**RDS automated backups**:
- **Retention**: 7-35 days (configurable)
- **Frequency**: Daily full backup + transaction logs every 5 minutes
- **RPO**: 5 minutes (point-in-time recovery)
- **Cost**: Free (included in RDS pricing)

**Manual snapshots**:
- **Retention**: Indefinite (until manually deleted)
- **Use case**: Pre-upgrade snapshots, long-term retention
- **Cost**: $0.095/GB-month (same as automated backups after retention period)

**Cross-region snapshot copy**:
```bash
# Automated cross-region copy
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --backup-retention-period 7 \
  --copy-tags-to-snapshot \
  --enable-cloudwatch-logs-exports '["error","general","slowquery"]'

# Manual cross-region copy
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:us-east-1:123456789012:snapshot:mydb-2024-11-15 \
  --target-db-snapshot-identifier mydb-dr-2024-11-15 \
  --source-region us-east-1 \
  --region us-west-2 \
  --kms-key-id arn:aws:kms:us-west-2:123456789012:key/abc-123
```

### File System Backups

**EBS snapshots**:
- **Frequency**: Daily/hourly with Data Lifecycle Manager
- **Retention**: 7-30 days typical
- **Incremental**: Only changed blocks stored
- **Cost**: $0.05/GB-month

**EFS backups** (AWS Backup):
```bash
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "EFSDaily",
    "Rules": [{
      "RuleName": "DailyBackup",
      "TargetBackupVaultName": "Default",
      "ScheduleExpression": "cron(0 5 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "DeleteAfterDays": 30
      }
    }]
  }'
```

### Application Data Backups

**S3 versioning + lifecycle policies**:

```json
{
  "Rules": [
    {
      "Id": "Archive old versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "NoncurrentDays": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 365
      }
    }
  ]
}
```

**DynamoDB backups**:

```bash
# Enable point-in-time recovery (PITR)
aws dynamodb update-continuous-backups \
  --table-name users \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# PITR provides 35-day recovery window
# Cost: No additional charge (included in table pricing)

# On-demand backups for long-term retention
aws dynamodb create-backup \
  --table-name users \
  --backup-name users-backup-2024-11-15
```

## Testing and Validation

### Disaster Recovery Testing Cadence

**Quarterly full failover tests**:
- Fail over to DR region
- Verify RTO/RPO targets met
- Document actual recovery time vs target
- Identify gaps, update runbooks

**Monthly component tests**:
- Test database restore from backup
- Test AMI launch in DR region
- Test Route 53 failover routing
- Validate monitoring/alerting

**Weekly backup validation**:
- Verify automated backups completing
- Test restore of recent backup (non-production)
- Confirm cross-region replication working

### DR Test Plan Template

```yaml
DR Test: Quarterly Failover to us-west-2
Date: 2024-11-15
Participants: Ops team, Engineering leads, Security
Objectives:
  - Verify RTO < 4 hours (target)
  - Verify RPO < 1 hour (target)
  - Test runbook accuracy
  - Identify improvement opportunities

Pre-Test Checklist:
  - [ ] Notify stakeholders (internal users, customers if needed)
  - [ ] Verify backups current (< 24h old)
  - [ ] Confirm DR region resources healthy
  - [ ] Schedule test window (low-traffic period)

Test Steps:
  1. [ ] T+0min: Simulate primary region failure (block health check)
  2. [ ] T+3min: Verify Route 53 failover triggered
  3. [ ] T+5min: Promote RDS read replica in us-west-2
  4. [ ] T+15min: Scale up EC2 Auto Scaling Group
  5. [ ] T+20min: Run smoke tests (critical user journeys)
  6. [ ] T+30min: Verify application fully functional
  7. [ ] T+60min: Monitor error rates, latency, throughput
  8. [ ] T+240min: Failback to primary region

Success Criteria:
  - Application operational in DR region within 4 hours
  - Data loss < 1 hour (verify last transaction timestamp)
  - Error rate < 1% during failover
  - No data corruption detected

Post-Test:
  - Document actual RTO/RPO
  - Update runbooks with lessons learned
  - Create tickets for identified issues
  - Schedule next test
```

### Automated DR Validation

**AWS Backup audit**:

```bash
# Check backup compliance
aws backup list-backup-jobs \
  --by-state COMPLETED \
  --max-results 100 \
  --query 'BackupJobs[?CompletionDate>=`2024-11-01`]'

# Alert if backup older than 24 hours
LAST_BACKUP=$(aws rds describe-db-snapshots \
  --db-instance-identifier mydb \
  --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime)[-1].SnapshotCreateTime' \
  --output text)

HOURS_SINCE_BACKUP=$(( ($(date +%s) - $(date -d "$LAST_BACKUP" +%s)) / 3600 ))

if [ $HOURS_SINCE_BACKUP -gt 24 ]; then
  echo "WARNING: Last backup > 24 hours old"
fi
```

**Replication lag monitoring**:

```bash
# Aurora Global DB replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=myapp-global \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum
```

## Cost Optimization

### DR Cost Comparison

**Baseline (single-region)**: $15,000/month

| Strategy | Monthly Cost | Increase | RTO | RPO |
|----------|--------------|----------|-----|-----|
| Backup & Restore | $15,440 | 3% | 12-24h | 1-24h |
| Pilot Light | $17,400 | 16% | 4-12h | 5-60min |
| Warm Standby | $22,300 | 49% | 1-4h | 5-15min |
| Multi-Site | $32,900 | 119% | <1h | <1min |

### Optimization Techniques

**1. Tiered storage for backups**:

```json
{
  "Rules": [
    {
      "Transitions": [
        {"Days": 30, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"},
        {"Days": 365, "StorageClass": "DEEP_ARCHIVE"}
      ]
    }
  ]
}
```

**Savings**: Standard ($0.023/GB) → Deep Archive ($0.00099/GB) = 96% reduction

**2. Fargate Spot for DR compute**:

Pilot light DR region:
- Fargate On-Demand: 10 vCPUs × $0.04/hour = $288/month
- Fargate Spot: 10 vCPUs × $0.012/hour = $86/month
- **Savings**: $202/month (70%)

**3. Aurora Serverless v2 for DR**:

Warm standby with Aurora Serverless v2 (scales down when idle):
- Standard Aurora: $1,800/month (always provisioned)
- Aurora Serverless v2: $500/month average (scales 0.5-1 ACU most of time)
- **Savings**: $1,300/month (72%)

**4. Scheduled scaling for DR region**:

Scale down DR region nights/weekends (if acceptable):
- Standard: 30 instances × 24h/day × 30 days = 21,600 instance-hours
- Scheduled (12h/day weekdays only): 30 instances × 12h × 20 days = 7,200 instance-hours
- **Savings**: 67% compute cost reduction

**5. Right-size DR instances**:

Production uses m5.2xlarge, DR can use m5.large (half the cost) if acceptable:
- Production: 100 × m5.2xlarge × $0.384/hour = $2,765/month
- DR: 30 × m5.large × $0.096/hour = $691/month (vs $1,382 if same instance type)
- **Savings**: $691/month (50%)

## When to Use Which DR Strategy

### Decision Framework

**1. Determine acceptable RTO/RPO** (business impact analysis):
- Financial loss per hour of downtime
- Regulatory requirements
- Customer expectations (SLA commitments)

**2. Calculate DR strategy costs** (from cost comparison table)

**3. Compare cost vs risk**:

Example:
- Downtime cost: $100,000/hour
- Expected outages: 1 per year (based on historical AWS availability)
- Downtime without DR: 24 hours = $2.4M loss

**Backup & Restore**: $440/month = $5,280/year
- Prevents: ~12 hours of downtime (still 12h outage) = Saves $1.2M
- ROI: ($1.2M - $5K) / $5K = 23,900% ROI

**Warm Standby**: $7,300/month = $87,600/year
- Prevents: ~22 hours of downtime (2h outage) = Saves $2.2M
- ROI: ($2.2M - $88K) / $88K = 2,400% ROI

**Multi-Site**: $17,900/month = $214,800/year
- Prevents: ~23.5 hours of downtime (30min outage) = Saves $2.35M
- ROI: ($2.35M - $215K) / $215K = 994% ROI

**Recommendation**: Warm Standby (best ROI given 1/year outage assumption)

### Use Case Matrix

| Application Type | RTO Target | RPO Target | Recommended Strategy |
|-----------------|------------|------------|---------------------|
| Internal dev/test | Days | 24h | Backup & Restore |
| Internal tools | 12-24h | 4-24h | Backup & Restore |
| CRM, analytics | 4-12h | 1-4h | Pilot Light |
| E-commerce | 1-4h | 15min-1h | Warm Standby |
| Financial trading | <1h | <1min | Multi-Site Active |
| Payment processing | <30min | <1min | Multi-Site Active |

## Common Pitfalls

### 1. Not Testing DR Regularly

**Problem**: DR plan looks good on paper, but never tested. During real disaster, discover RDS snapshot restore takes 8 hours (not 2), ASG launch config references deleted AMI.

**Solution**: Quarterly full failover tests, document actual RTO/RPO, update runbooks.

### 2. Forgetting Application Dependencies

**Problem**: Failover database and compute to DR region, but application calls third-party API hardcoded to us-east-1 (e.g., Redis cache, message queue). Application fails despite infrastructure healthy.

**Solution**: Inventory all dependencies (databases, caches, queues, external APIs), ensure DR plan includes all components.

### 3. Insufficient DR Capacity

**Problem**: Primary region handles 10,000 RPS, DR region provisioned for 3,000 RPS (30% capacity). During failover, DR region overwhelmed, crashes.

**Solution**: Load test DR region at expected production load, ensure capacity sufficient or ASG configured to scale rapidly.

### 4. Not Monitoring Replication Lag

**Problem**: Aurora Global DB normally <1s lag, but during peak load increases to 5 minutes. Failover during high lag = 5 minutes of data loss (exceeds RPO).

**Solution**: Monitor replication lag, alert if exceeds threshold, understand lag patterns (increases during peak writes).

### 5. Hardcoded Region in Application

**Problem**:
```python
S3_BUCKET = "myapp-data-us-east-1"  # ❌ Hardcoded
```

Application fails over to eu-west-1 but still reads from us-east-1 S3 bucket (cross-region latency or unavailable).

**Solution**: Use environment variables, detect region dynamically:
```python
REGION = os.environ['AWS_REGION']
S3_BUCKET = f"myapp-data-{REGION}"
```

### 6. Ignoring Data Consistency

**Problem**: Multi-site active-active with DynamoDB Global Tables. Concurrent writes to same item from us-east-1 and eu-west-1 cause last-writer-wins conflict, data loss.

**Solution**: Design for eventual consistency, use conflict-free data structures (CRDTs), or centralize writes to single region.

### 7. No Runbook Automation

**Problem**: DR runbook is 50-page Word document. During real disaster, team scrambles to follow manual steps, makes mistakes, takes 6 hours instead of 2.

**Solution**: Automate DR failover with scripts/Lambda, regularly test automation, keep runbook as fallback for edge cases.

### 8. Underestimating DNS TTL Impact

**Problem**: Route 53 configured with 60s TTL. Health check detects failure in 30s, but clients cached DNS response for 60s. Actual failover time: 90s instead of 30s.

**Solution**: Lower TTL for critical records (10-30s), accept higher Route 53 query costs.

## Key Takeaways

**DR Strategies**:
- **Backup & Restore**: RTO 12-24h, RPO 1-24h, Cost baseline +3%, use for dev/test and non-critical apps
- **Pilot Light**: RTO 4-12h, RPO 5-60min, Cost +16%, minimal DR infrastructure with continuous DB replication
- **Warm Standby**: RTO 1-4h, RPO 5-15min, Cost +49%, scaled-down DR (20-50% capacity) ready to scale up
- **Multi-Site Active-Active**: RTO <1h, RPO <1min, Cost +119%, full capacity in 2+ regions serving traffic

**RTO/RPO Fundamentals**:
- RTO = Maximum acceptable downtime (time to recover)
- RPO = Maximum acceptable data loss (time since last backup)
- Aggressive RTO/RPO exponentially increases cost (1h RTO costs 10× vs 24h RTO)

**Data Replication**:
- **RDS automated backups**: Free, 7-35 day retention, 5-minute RPO with transaction logs
- **Aurora Global Database**: <1s replication lag, <1min failover, read-only secondaries
- **DynamoDB Global Tables**: Multi-master, <1s lag, last-writer-wins conflict resolution
- **S3 CRR**: <15min replication (99.99% SLA with RTC), $0.02-0.035/GB

**Cost Optimization**:
- Tiered storage for backups: Standard → Deep Archive = 96% reduction
- Fargate Spot for DR compute: 70% discount (accept interruption risk)
- Aurora Serverless v2 for DR: 72% savings (scales down when idle)
- Right-size DR instances: Use smaller instances in DR (m5.2xlarge → m5.large) = 50% savings

**Testing**:
- Quarterly full failover tests (verify RTO/RPO targets met)
- Monthly component tests (database restore, AMI launch, Route 53 failover)
- Weekly backup validation (verify automated backups completing)
- Automate DR testing with scripts/Lambda (manual runbooks error-prone)

**Common Pitfalls**:
- Not testing DR regularly (discover issues during real disaster)
- Forgetting application dependencies (database fails over but Redis cache doesn't)
- Insufficient DR capacity (DR region overwhelmed during failover)
- Hardcoding region in application code (cross-region calls after failover)
- Ignoring replication lag (failover during high lag exceeds RPO)

**Decision Framework**:
1. Calculate downtime cost per hour (revenue loss + customer loss + reputation)
2. Determine acceptable RTO/RPO (business impact analysis)
3. Select DR strategy (cost vs risk analysis, ROI calculation)
4. Test quarterly, document actual RTO/RPO vs target
5. Continuously improve (update runbooks, automate, reduce costs)

**When to Use**:
- **Backup & Restore**: Dev/test, internal tools, can tolerate 12-24h RTO, cost-sensitive
- **Pilot Light**: Business-critical apps, 4-12h RTO acceptable, budget-conscious
- **Warm Standby**: Customer-facing apps, 1-4h RTO target, can justify 50% cost increase
- **Multi-Site Active-Active**: Mission-critical apps, cannot tolerate downtime, global users, 2× cost acceptable

The right DR strategy balances cost, complexity, and risk tolerance based on business requirements and acceptable downtime/data loss.
