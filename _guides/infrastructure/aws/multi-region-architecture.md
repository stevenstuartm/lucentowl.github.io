---
title: "Multi-Region Architecture on AWS for System Architects"
layout: guide
category: AWS
subcategory: Architecture Patterns (Advanced)
description: "Comprehensive guide to multi-region AWS architectures covering active-active, active-passive, data replication, Route 53 routing, and cost optimization"
tags: [aws, architecture, distributed-systems, scalability, reliability, multi-region, resilience, practical]
---

## What Problems Multi-Region Architecture Solves

**Single-region deployments introduce risks**:

1. **Regional outages**: AWS regions have failed (US-EAST-1 outages in 2017, 2021, 2023)
   - Example: December 2021 US-EAST-1 outage took down major services for 7+ hours
   - Impact: 100% downtime if single-region deployed

2. **Latency for global users**: User in Sydney accessing US-EAST-1 experiences 200-300ms baseline latency
   - Example: Web app renders in 50ms locally but 300ms globally
   - Impact: Poor user experience, reduced conversion rates

3. **Compliance & data residency**: Regulations require data stored in specific regions
   - Example: GDPR requires EU customer data stored in EU
   - Impact: Cannot serve EU customers from US-only deployment

4. **Disaster recovery limitations**: Single-region DR still vulnerable to regional failure
   - Example: Multi-AZ RDS survives AZ failure, not region failure
   - Impact: Cannot meet aggressive RPO/RTO targets

**Multi-region architecture solves**:
- **Regional failure tolerance**: Continue operating if entire region fails
- **Global performance**: Serve users from nearest region (50-300ms latency reduction)
- **Compliance**: Store and process data in required regions
- **Aggressive DR targets**: RTO/RPO in seconds/minutes vs hours/days

## Multi-Region Deployment Patterns

### Pattern 1: Active-Passive (Warm Standby)

**Architecture**: Primary region serves 100% traffic; secondary region idle (warm) or minimal traffic.

**Components**:
- **Primary**: Full production environment (compute, databases, cache)
- **Secondary**: Scaled-down environment (e.g., 10% capacity) or fully provisioned but idle

**Failover mechanism**:
1. Health check detects primary region failure
2. Route 53 failover routing switches traffic to secondary
3. Secondary scales up to full capacity (if scaled down)
4. Primary traffic drains to secondary

**Cost profile**:
- Primary: 100% of single-region cost
- Secondary (scaled down): ~20% of primary cost (minimal compute, full data replication)
- Total: ~120% of single-region cost

**Example configuration**:

```json
{
  "Primary (us-east-1)": {
    "Compute": "100 EC2 instances (m5.large)",
    "Database": "RDS Multi-AZ (db.r5.2xlarge)",
    "Cache": "ElastiCache cluster (3 nodes)",
    "Cost": "$15,000/month"
  },
  "Secondary (us-west-2)": {
    "Compute": "10 EC2 instances (m5.large) + ASG",
    "Database": "RDS Read Replica",
    "Cache": "ElastiCache cluster (1 node)",
    "Cost": "$3,000/month"
  },
  "Data Transfer": "$500/month (replication)",
  "Total": "$18,500/month"
}
```

**RTO/RPO**:
- **RPO**: ~5-15 minutes (last replicated transaction)
- **RTO**: 5-30 minutes (DNS propagation + scale-up)

**When to use**:
- Cost-sensitive deployments
- Can tolerate 5-30 minute RTO
- Infrequent failover (testing quarterly)

### Pattern 2: Active-Active (Multi-Region)

**Architecture**: Multiple regions serve production traffic simultaneously.

**Components**:
- **All regions**: Full production environment
- **Traffic distribution**: Route 53 geo-proximity or latency-based routing
- **Data synchronization**: Bi-directional replication (DynamoDB Global Tables, Aurora Global Database)

**Advantages**:
- **Zero RTO**: Failure in one region = traffic automatically shifts to healthy regions
- **Performance**: Users served from nearest region (latency optimized)
- **Regional capacity**: Each region handles partial load (easier to scale)

**Challenges**:
- **Data consistency**: Multi-region writes require conflict resolution
- **Cost**: 2× compute costs (full capacity in each region)
- **Complexity**: Orchestrate deployments across regions, manage split-brain scenarios

**Cost profile**:
- Region 1: $15,000/month
- Region 2: $15,000/month
- Data replication: $2,000/month (cross-region transfer)
- Total: $32,000/month (2.1× single-region)

**Example configuration**:

```json
{
  "us-east-1": {
    "Compute": "100 EC2 instances",
    "Database": "Aurora Global Database (writer)",
    "Cache": "ElastiCache cluster",
    "Traffic": "50% (geo-proximity routing)"
  },
  "eu-west-1": {
    "Compute": "100 EC2 instances",
    "Database": "Aurora Global Database (writer)",
    "Cache": "ElastiCache cluster",
    "Traffic": "50% (geo-proximity routing)"
  }
}
```

**RTO/RPO**:
- **RPO**: Near-zero (continuous replication, <1s lag)
- **RTO**: Near-zero (automatic failover via Route 53 health checks)

**When to use**:
- Mission-critical applications (zero downtime requirement)
- Global user base (latency optimization)
- Can justify 2× cost for availability/performance

### Pattern 3: Multi-Region Read Replicas

**Architecture**: Primary region handles writes; multiple regions handle reads.

**Components**:
- **Primary (us-east-1)**: Write traffic, authoritative data source
- **Secondaries (eu-west-1, ap-southeast-1)**: Read-only replicas

**Use cases**:
- Read-heavy workloads (90% reads, 10% writes)
- Geo-distributed read performance required
- Write latency acceptable for global users

**Cost profile**:
- Primary: $15,000/month
- Read replicas (2 regions): $10,000/month ($5K each)
- Data replication: $1,000/month
- Total: $26,000/month (1.7× single-region)

**RTO/RPO**:
- **RPO**: 5-60 seconds (replication lag)
- **RTO**: 5-15 minutes (promote read replica to writer)

**When to use**:
- Read-heavy applications (content delivery, e-commerce product catalog)
- Write centralization acceptable (lower complexity than active-active)
- Cost-conscious (cheaper than active-active)

## Data Replication Strategies

### Aurora Global Database

**Architecture**: Primary region writer, up to 5 secondary regions with read replicas.

**Replication characteristics**:
- **Lag**: Typically <1 second
- **Method**: Physical replication (storage layer)
- **Consistency**: Eventual (read replicas lag behind writer)
- **Failover**: Promotes secondary to primary in <1 minute

**Configuration**:

```bash
# Create global database
aws rds create-global-cluster \
  --global-cluster-identifier my-global-db \
  --engine aurora-mysql \
  --engine-version 8.0.mysql_aurora.3.04.0

# Add primary cluster
aws rds create-db-cluster \
  --db-cluster-identifier primary-cluster \
  --engine aurora-mysql \
  --global-cluster-identifier my-global-db \
  --master-username admin \
  --master-user-password <password> \
  --region us-east-1

# Add secondary cluster
aws rds create-db-cluster \
  --db-cluster-identifier secondary-cluster \
  --engine aurora-mysql \
  --global-cluster-identifier my-global-db \
  --region eu-west-1
```

**Failover process**:

```bash
# Detach secondary from global database
aws rds remove-from-global-cluster \
  --db-cluster-identifier secondary-cluster \
  --global-cluster-identifier my-global-db \
  --region eu-west-1

# Promote secondary to standalone (now writable)
# Secondary is now independent writer
# Application connection strings updated to point to new writer
```

**Cost**:
- Primary cluster: Standard Aurora pricing
- Secondary clusters: Standard Aurora pricing (billed per region)
- Data transfer: $0.02/GB cross-region replication

**When to use**:
- Relational data requiring low-latency reads globally
- Can tolerate <1s replication lag
- Need fast failover (<1 minute RTO)

### DynamoDB Global Tables

**Architecture**: Multi-region, multi-master (all regions writable).

**Replication characteristics**:
- **Lag**: Typically <1 second
- **Method**: Asynchronous replication (stream-based)
- **Consistency**: Eventual (last-writer-wins conflict resolution)
- **Failover**: No failover needed (all regions always writable)

**Configuration**:

```bash
# Create table in primary region
aws dynamodb create-table \
  --table-name users \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region us-east-1

# Create global table
aws dynamodb update-table \
  --table-name users \
  --replica-updates '[
    {"Create": {"RegionName": "eu-west-1"}},
    {"Create": {"RegionName": "ap-southeast-1"}}
  ]' \
  --region us-east-1
```

**Conflict resolution**:

DynamoDB uses last-writer-wins based on timestamp:

```python
# Scenario: Concurrent writes in us-east-1 and eu-west-1

# us-east-1 (10:00:00.500)
dynamodb.put_item(
    TableName='users',
    Item={'user_id': 'user123', 'name': 'Alice', 'email': 'alice@example.com'}
)

# eu-west-1 (10:00:00.700)  # 200ms later
dynamodb.put_item(
    TableName='users',
    Item={'user_id': 'user123', 'name': 'Alice', 'email': 'alice@newdomain.com'}
)

# Result: email = 'alice@newdomain.com' (latest write wins)
```

**Cost**:
- Replicated write units (rWCU): 2× write cost (data written to each region)
- Storage: Charged per region (duplicate data in each region)
- Data transfer: $0.02/GB cross-region replication

**Example**:
- 100 WCU/second, 3 regions
- Cost: 100 WCU × 3 regions × $0.00065/hour = $0.195/hour = $141/month

**When to use**:
- NoSQL data model fits requirements
- Need low-latency writes globally (not just reads)
- Can tolerate eventual consistency and last-writer-wins

### S3 Cross-Region Replication (CRR)

**Architecture**: Replicate objects from source bucket to destination bucket(s) in different region(s).

**Replication characteristics**:
- **Lag**: Typically <15 minutes (99.99% within 15 min)
- **Method**: Asynchronous object-level replication
- **Consistency**: Eventual (objects replicate after write)
- **Filtering**: Replicate by prefix, tags, or all objects

**Configuration**:

```json
{
  "Role": "arn:aws:iam::123456789012:role/s3-replication-role",
  "Rules": [
    {
      "Id": "ReplicateAll",
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::my-bucket-eu-west-1",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {
            "Minutes": 15
          }
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": {
            "Minutes": 15
          }
        }
      },
      "DeleteMarkerReplication": {
        "Status": "Enabled"
      }
    }
  ]
}
```

```bash
aws s3api put-bucket-replication \
  --bucket my-bucket-us-east-1 \
  --replication-configuration file://replication-config.json
```

**S3 Replication Time Control (RTC)**:
- SLA: 99.99% of objects replicated within 15 minutes
- Cost: Additional $0.015/GB (on top of standard replication cost)

**Cost**:
- Replication (standard): $0.02/GB cross-region transfer
- RTC: Additional $0.015/GB
- Storage: Duplicate storage costs in destination region
- Total: $0.02/GB (standard) or $0.035/GB (RTC) + storage

**When to use**:
- Static assets (images, videos, documents)
- Backup and compliance (data durability across regions)
- Content distribution (serve assets from nearest region)

## Traffic Routing with Route 53

### Geolocation Routing

**Use case**: Route traffic based on user's geographic location (country/continent).

**Example**: EU users → eu-west-1, US users → us-east-1, Asia users → ap-southeast-1

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "US",
      "GeoLocation": {
        "ContinentCode": "NA"
      },
      "AliasTarget": {
        "HostedZoneId": "Z123456",
        "DNSName": "us-alb.us-east-1.amazonaws.com"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "EU",
      "GeoLocation": {
        "ContinentCode": "EU"
      },
      "AliasTarget": {
        "HostedZoneId": "Z789012",
        "DNSName": "eu-alb.eu-west-1.amazonaws.com"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "Default",
      "GeoLocation": {
        "ContinentCode": "*"
      },
      "AliasTarget": {
        "HostedZoneId": "Z123456",
        "DNSName": "us-alb.us-east-1.amazonaws.com"
      }
    }
  ]
}
```

**Considerations**:
- **Deterministic**: User in Germany always routes to EU
- **Health checks**: If EU unhealthy, does NOT automatically failover to US (need failover routing)
- **Use case**: Compliance (EU data must stay in EU), content localization

### Latency-Based Routing

**Use case**: Route traffic to region with lowest latency for user.

**Example**: User in London may route to us-east-1 if lower latency than eu-west-1 (rare, but possible during network issues).

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "US-EAST-1",
      "Region": "us-east-1",
      "AliasTarget": {
        "HostedZoneId": "Z123456",
        "DNSName": "us-alb.us-east-1.amazonaws.com"
      },
      "HealthCheckId": "health-check-us"
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "EU-WEST-1",
      "Region": "eu-west-1",
      "AliasTarget": {
        "HostedZoneId": "Z789012",
        "DNSName": "eu-alb.eu-west-1.amazonaws.com"
      },
      "HealthCheckId": "health-check-eu"
    }
  ]
}
```

**Behavior**:
- Route 53 measures latency from user to each region
- Returns lowest-latency endpoint
- If endpoint unhealthy (health check fail), returns next-lowest-latency healthy endpoint

**When to use**:
- Performance optimization (no compliance restrictions)
- Automatic failover to healthy regions
- User base distributed globally

### Geoproximity Routing

**Use case**: Route traffic based on geographic location + bias (shift traffic between regions).

**Example**: Shift 30% of US East Coast traffic from us-east-1 to eu-west-1 (load balancing).

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "US-EAST-1",
      "GeoProximityLocation": {
        "AWSRegion": "us-east-1",
        "Bias": -20
      },
      "AliasTarget": {
        "DNSName": "us-alb.us-east-1.amazonaws.com"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "EU-WEST-1",
      "GeoProximityLocation": {
        "AWSRegion": "eu-west-1",
        "Bias": 20
      },
      "AliasTarget": {
        "DNSName": "eu-alb.eu-west-1.amazonaws.com"
      }
    }
  ]
}
```

**Bias values**:
- **Negative bias (-99 to -1)**: Reduce traffic to this region
- **Zero bias (0)**: No adjustment (geographic proximity only)
- **Positive bias (1 to 99)**: Increase traffic to this region

**When to use**:
- Load balancing between regions (shift traffic gradually)
- Testing new region with small percentage of traffic
- Cost optimization (shift traffic to cheaper region)

### Failover Routing

**Use case**: Primary-secondary failover (active-passive pattern).

```json
{
  "RecordSets": [
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "Primary",
      "Failover": "PRIMARY",
      "HealthCheckId": "health-check-primary",
      "AliasTarget": {
        "DNSName": "primary-alb.us-east-1.amazonaws.com"
      }
    },
    {
      "Name": "app.example.com",
      "Type": "A",
      "SetIdentifier": "Secondary",
      "Failover": "SECONDARY",
      "AliasTarget": {
        "DNSName": "secondary-alb.us-west-2.amazonaws.com"
      }
    }
  ]
}
```

**Behavior**:
- Route 53 returns PRIMARY if health check passes
- Route 53 returns SECONDARY if PRIMARY health check fails
- When PRIMARY recovers, traffic shifts back

**Health check configuration**:

```bash
aws route53 create-health-check \
  --caller-reference $(date +%s) \
  --health-check-config \
    Type=HTTPS,\
    ResourcePath=/health,\
    FullyQualifiedDomainName=primary-alb.us-east-1.amazonaws.com,\
    Port=443,\
    RequestInterval=30,\
    FailureThreshold=3
```

**Thresholds**:
- **Request interval**: 10 or 30 seconds
- **Failure threshold**: Number of consecutive failures before marking unhealthy (1-10)
- **Detection time**: 30s interval × 3 failures = 90 seconds to detect failure

## Multi-Region Application Architectures

### Serverless Multi-Region (Lambda + API Gateway + DynamoDB)

**Architecture**:

```
Users (Global)
    ↓
Route 53 (Latency-based routing)
    ↓
┌─────────────────────────┬─────────────────────────┐
│   us-east-1             │   eu-west-1             │
│   API Gateway           │   API Gateway           │
│       ↓                 │       ↓                 │
│   Lambda                │   Lambda                │
│       ↓                 │       ↓                 │
│   DynamoDB              ←  Replication  →  DynamoDB  │
│   Global Table          │   Global Table          │
└─────────────────────────┴─────────────────────────┘
```

**Deployment with SAM**:

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  Region:
    Type: String
    Default: us-east-1

Resources:
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      EndpointConfiguration:
        Type: REGIONAL

  GetUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: functions/get-user/
      Handler: app.lambda_handler
      Runtime: python3.11
      Environment:
        Variables:
          TABLE_NAME: !Ref UsersTable
          REGION: !Ref Region
      Events:
        GetUser:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /users/{id}
            Method: GET

  UsersTable:
    Type: AWS::DynamoDB::GlobalTable
    Properties:
      TableName: users-global
      BillingMode: PAY_PER_REQUEST
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      AttributeDefinitions:
        - AttributeName: user_id
          AttributeType: S
      KeySchema:
        - AttributeName: user_id
          KeyType: HASH
      Replicas:
        - Region: us-east-1
        - Region: eu-west-1
```

**Deployment script**:

```bash
#!/bin/bash
# deploy-multi-region.sh

REGIONS=("us-east-1" "eu-west-1")

for REGION in "${REGIONS[@]}"; do
  echo "Deploying to $REGION..."
  sam build
  sam deploy \
    --stack-name my-app-$REGION \
    --region $REGION \
    --parameter-overrides Region=$REGION \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset
done
```

**Benefits**:
- **Zero infrastructure management**: Serverless scales automatically
- **Cost-efficient**: Pay per request (no idle capacity)
- **Fast failover**: Route 53 health checks detect API Gateway failure in <60s

**Limitations**:
- **Cold starts**: Lambda cold start adds 100-500ms latency
- **DynamoDB eventual consistency**: Replication lag <1s
- **State management**: Lambda stateless (use DynamoDB or ElastiCache for state)

### Container Multi-Region (ECS + Aurora Global Database)

**Architecture**:

```
CloudFront (Global CDN)
    ↓
Route 53 (Geolocation routing)
    ↓
┌──────────────────────────────┬──────────────────────────────┐
│   us-east-1                  │   eu-west-1                  │
│   ALB                        │   ALB                        │
│    ↓                         │    ↓                         │
│   ECS Fargate (10 tasks)     │   ECS Fargate (10 tasks)     │
│    ↓                         │    ↓                         │
│   Aurora Global DB (Writer)  ←  Replication  →  Aurora (Reader) │
│   ElastiCache (Redis)        │   ElastiCache (Redis)        │
└──────────────────────────────┴──────────────────────────────┘
```

**ECS service configuration**:

```json
{
  "serviceName": "web-app",
  "taskDefinition": "web-app:1",
  "desiredCount": 10,
  "launchType": "FARGATE",
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/web-app/abc123",
      "containerName": "app",
      "containerPort": 8080
    }
  ],
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-app"],
      "assignPublicIp": "DISABLED"
    }
  },
  "healthCheckGracePeriodSeconds": 60,
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100,
    "deploymentCircuitBreaker": {
      "enable": true,
      "rollback": true
    }
  }
}
```

**Application connection logic** (detect region, connect to local Aurora reader):

```python
import boto3
import os

REGION = os.environ['AWS_REGION']

# Primary region uses writer, secondary regions use local reader
if REGION == 'us-east-1':
    DB_ENDPOINT = 'my-global-db-cluster.cluster-xyz.us-east-1.rds.amazonaws.com'  # Writer
else:
    DB_ENDPOINT = f'my-global-db-cluster.cluster-xyz.{REGION}.rds.amazonaws.com'  # Local reader

# For writes in secondary regions, route to primary writer
WRITER_ENDPOINT = 'my-global-db-cluster.cluster-xyz.us-east-1.rds.amazonaws.com'

# Read from local reader (low latency)
read_conn = psycopg2.connect(
    host=DB_ENDPOINT,
    database='mydb',
    user='app_user',
    password=os.environ['DB_PASSWORD']
)

# Write to primary writer (may have higher latency from secondary regions)
write_conn = psycopg2.connect(
    host=WRITER_ENDPOINT,
    database='mydb',
    user='app_user',
    password=os.environ['DB_PASSWORD']
)
```

**Benefits**:
- **Consistent performance**: ECS tasks always warm (no cold starts)
- **Strong consistency**: Aurora supports synchronous replication within region
- **Session affinity**: ALB sticky sessions support stateful apps

**Limitations**:
- **Higher cost**: ECS Fargate + Aurora more expensive than serverless
- **Write latency**: Secondary regions write to primary (added latency)

## Consistency Models & Trade-offs

### Strong Consistency (Aurora Global Database)

**Guarantee**: Read in secondary region may lag behind primary (eventual consistency), but **primary always strongly consistent**.

**Trade-offs**:
- ✅ **Primary writes**: Strongly consistent (synchronous multi-AZ replication)
- ✅ **Failover**: Promotes secondary to primary with <1min RTO, <1s RPO
- ❌ **Secondary writes**: Not supported (read-only)
- ❌ **Replication lag**: Secondary reads may lag <1s behind primary

**Use case**: Financial transactions, inventory management (write centralization acceptable)

### Eventual Consistency (DynamoDB Global Tables)

**Guarantee**: All regions eventually consistent (typically <1s), **last-writer-wins conflict resolution**.

**Trade-offs**:
- ✅ **Multi-region writes**: All regions writable (low-latency writes globally)
- ✅ **Zero RTO**: No failover needed (all regions active)
- ❌ **Conflicts**: Concurrent writes to same item = last-writer-wins (data loss possible)
- ❌ **Consistency**: Reads may return stale data (<1s lag)

**Use case**: User profiles, session state, content metadata (conflicts rare/acceptable)

**Conflict example**:

```
Scenario: User updates profile from phone (us-east-1) and laptop (eu-west-1) simultaneously

Phone (us-east-1, 10:00:00.100):
  PUT /users/user123 { "email": "newemail@example.com" }

Laptop (eu-west-1, 10:00:00.150):
  PUT /users/user123 { "phone": "+1-555-1234" }

# After replication:
# Result in both regions: { "email": "newemail@example.com", "phone": "+1-555-1234" } (merged)
# OR (if same attribute updated): Last write wins (phone update at 10:00:00.150)
```

### Hybrid Model (Aurora Global + DynamoDB Global)

**Strategy**: Use Aurora for strongly consistent data (orders, payments), DynamoDB for eventually consistent data (user sessions, preferences).

**Example architecture**:

```
Orders Service (Aurora Global)
  - Primary (us-east-1): Write orders
  - Secondary (eu-west-1): Read orders (local performance)

Session Service (DynamoDB Global)
  - All regions writable (low-latency session updates)
```

## Cost Optimization Strategies

### Multi-Region Cost Breakdown

**Single-region baseline**: $15,000/month

**Active-passive (warm standby)**:
- Primary region: $15,000/month
- Secondary region: $3,000/month (10% capacity)
- Data replication: $500/month
- **Total**: $18,500/month (23% increase)

**Active-active (multi-region)**:
- Region 1: $15,000/month
- Region 2: $15,000/month
- Data replication: $2,000/month
- **Total**: $32,000/month (113% increase)

### Optimization Techniques

**1. CloudFront for static assets**:

Instead of replicating static assets (images, CSS, JS) to S3 in each region, use CloudFront with single-region origin.

**Before**:
- S3 in us-east-1: 1TB storage ($23/month)
- S3 in eu-west-1: 1TB storage ($23/month)
- CRR: 1TB replication ($20/month)
- Total: $66/month

**After**:
- S3 in us-east-1: 1TB storage ($23/month)
- CloudFront: 1TB data transfer ($85/month)
- Total: $108/month (but better performance + no replication complexity)

**Alternative**: Use CloudFront with regional caching (no S3 replication).

**2. Read replicas vs full multi-region**:

For read-heavy workloads, use read replicas instead of active-active.

**Full active-active**:
- 2 regions × 100 EC2 instances = $30,000/month

**Read replicas**:
- Primary (us-east-1): 100 EC2 instances ($15,000/month)
- Read replica regions: 50 EC2 instances each ($7,500/month × 2 = $15,000/month)
- Total: $30,000/month

**Savings**: No compute savings, but simpler architecture (one writable region).

**3. Scheduled scaling for secondary region**:

If active-passive with predictable failover testing schedule, scale down secondary except during tests.

**Normal operation**:
- Secondary: 10 instances ($1,500/month)

**Failover test (1 day/month)**:
- Secondary: 100 instances ($150/day = $5/month)

**Total secondary cost**: $1,505/month vs $15,000/month (90% savings)

**4. Fargate Spot for secondary regions**:

Use Fargate Spot (70% discount) in secondary regions.

**Primary (us-east-1)**:
- Fargate: 100 vCPUs × $0.04/hour = $2,880/month

**Secondary (eu-west-1)**:
- Fargate Spot: 100 vCPUs × $0.012/hour = $864/month

**Savings**: $2,016/month (70%) on secondary compute

**Risk**: Fargate Spot interruptions (2-minute notice); acceptable for secondary region.

### Data Transfer Cost Optimization

**Cross-region data transfer**: $0.02/GB

**Example application**:
- Database replication: 100GB/day × 30 days = 3TB/month × $0.02 = $60/month
- Application inter-region calls: 50GB/day × 30 days = 1.5TB/month × $0.02 = $30/month
- S3 CRR: 200GB/day × 30 days = 6TB/month × $0.02 = $120/month
- **Total**: $210/month

**Optimization**:
- **Compress data**: Gzip/Brotli reduce transfer by 60-80% ($210 → $42-84/month)
- **Batch replication**: Replicate every 5 minutes vs real-time (reduce overhead)
- **Filter replication**: Only replicate critical data (not logs, temp files)

## Monitoring & Observability

### Multi-Region CloudWatch Dashboard

**Metrics to track**:

```yaml
Metrics:
  - Region: us-east-1
    - EC2: CPUUtilization, NetworkIn, NetworkOut
    - ALB: TargetResponseTime, HealthyHostCount, UnHealthyHostCount
    - RDS: CPUUtilization, DatabaseConnections, ReplicaLag
    - Route53: HealthCheckStatus

  - Region: eu-west-1
    - (Same metrics as us-east-1)

  - Cross-Region:
    - Route53: DNSQueries (by region)
    - Aurora: AuroraGlobalDBReplicationLag
    - DynamoDB: ReplicationLatency
```

**Cross-region dashboard**:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "AuroraGlobalDBReplicationLag", {"region": "us-east-1", "stat": "Maximum"}],
          ["...", {"region": "eu-west-1"}]
        ],
        "period": 60,
        "stat": "Maximum",
        "title": "Aurora Global DB Replication Lag"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Route53", "HealthCheckStatus", {"region": "us-east-1"}],
          ["...", {"region": "eu-west-1"}]
        ],
        "period": 60,
        "stat": "Average",
        "title": "Route 53 Health Checks"
      }
    }
  ]
}
```

### Alarms for Multi-Region Health

**Primary region unhealthy**:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name primary-region-unhealthy \
  --alarm-description "Primary region health check failed" \
  --metric-name HealthCheckStatus \
  --namespace AWS/Route53 \
  --statistic Minimum \
  --period 60 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --datapoints-to-alarm 2 \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts
```

**Replication lag high**:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name aurora-replication-lag-high \
  --alarm-description "Aurora Global DB replication lag > 5 seconds" \
  --metric-name AuroraGlobalDBReplicationLag \
  --namespace AWS/RDS \
  --statistic Maximum \
  --period 60 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --datapoints-to-alarm 3 \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts
```

### Distributed Tracing with X-Ray

**Multi-region tracing**:

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

patch_all()

@xray_recorder.capture('get_user')
def get_user(user_id):
    # Read from local region (Aurora read replica)
    local_region = os.environ['AWS_REGION']
    xray_recorder.put_annotation('region', local_region)
    xray_recorder.put_metadata('db_endpoint', DB_ENDPOINT)

    user = db.query('SELECT * FROM users WHERE id = %s', [user_id])

    return user
```

**X-Ray service map shows**:
- Request originated in us-east-1
- Read from us-east-1 Aurora reader (5ms)
- vs Request originated in eu-west-1
- Read from eu-west-1 Aurora reader (5ms) vs cross-region to us-east-1 writer (50ms)

## When to Use Multi-Region vs Single-Region

### Use Multi-Region When:

**1. High availability requirements** (99.99%+):
- Single-region multi-AZ: 99.95% SLA
- Multi-region: 99.99%+ achievable (regional failures don't cause outage)

**2. Global user base with latency requirements**:
- User in Sydney: 250ms to us-east-1, 50ms to ap-southeast-2
- Multi-region reduces latency 80% (250ms → 50ms)

**3. Compliance and data residency**:
- GDPR: EU data must stay in EU
- Data sovereignty laws: China, Russia require in-country data storage

**4. Disaster recovery with aggressive RTO/RPO**:
- Multi-region active-active: RTO/RPO near-zero
- Single-region backup/restore: RTO 4-8 hours, RPO 1-24 hours

### Use Single-Region When:

**1. Cost-sensitive with acceptable availability**:
- Multi-AZ: 99.95% SLA sufficient for most workloads
- Multi-region: 2-3× cost for 0.04% availability improvement

**2. Regulatory restrictions**:
- Data MUST NOT leave specific region (compliance)
- Multi-region replication violates policy

**3. Simple architecture preferred**:
- Multi-region adds complexity: data consistency, deployment orchestration, monitoring
- Small team may not have expertise/capacity

**4. Low user concurrency**:
- <10K users, <1000 RPS
- Single-region handles easily, multi-region overkill

**Decision matrix**:

| Requirement | Single-Region | Multi-Region |
|-------------|--------------|--------------|
| Availability SLA | 99.9-99.95% | 99.99%+ |
| Latency (global users) | 100-300ms | 10-50ms |
| RTO/RPO | 1-4 hours / 5-15 min | <1 min / <1s |
| Cost | Baseline | 2-3× |
| Complexity | Low | High |
| Compliance (data residency) | Limited | Flexible |

## Common Pitfalls

### 1. Not Testing Failover Regularly

**Problem**: Multi-region deployed but failover never tested. During real outage, discover Route 53 health check misconfigured, secondary region can't handle load.

**Solution**: Quarterly failover drills:
1. Simulate primary region failure (block health check endpoint)
2. Verify Route 53 fails over to secondary
3. Verify secondary scales to handle load
4. Measure actual RTO/RPO vs targets
5. Restore primary, fail back

### 2. Ignoring Data Replication Lag

**Problem**: Aurora Global DB typical lag <1s, but during peak load increases to 10-30s. Secondary region serves stale data.

**Solution**: Monitor replication lag, alert if exceeds threshold:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name replication-lag-high \
  --metric-name AuroraGlobalDBReplicationLag \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold
```

### 3. Forgetting DNS TTL

**Problem**: Route 53 health check detects failure, switches to secondary, but clients cached DNS response (60s TTL). Failover takes 60+ seconds instead of 10s.

**Solution**: Lower TTL for critical records:
```json
{
  "TTL": 10,
  "ResourceRecords": [{"Value": "primary-alb.us-east-1.amazonaws.com"}]
}
```

**Trade-off**: Lower TTL = more Route 53 queries = higher cost ($0.40 per million queries)

### 4. Not Accounting for Cross-Region Latency

**Problem**: Secondary region writes to primary Aurora writer (us-east-1 → eu-west-1 → back to us-east-1 for write). Write latency 100ms+ vs 5ms locally.

**Solution**: Accept write latency in secondary regions, or use DynamoDB Global Tables (multi-master).

### 5. Underprovisioning Secondary Region

**Problem**: Primary region has 100 EC2 instances, secondary has 10 (planning to scale up during failover). Failover happens, ASG takes 10 minutes to scale up, users experience errors.

**Solution**: Keep secondary at 50-100% capacity (accept higher cost), or pre-warm ASG with scheduled scaling before planned failover tests.

### 6. Not Isolating Failure Domains

**Problem**: Both regions share single AWS account. Account-level issue (IAM, billing problem) affects both regions.

**Solution**: Deploy regions in separate AWS accounts (multi-account strategy):
- us-east-1 in Account A
- eu-west-1 in Account B
- Isolates account-level failures

### 7. Hardcoding Region in Application

**Problem**:
```python
DB_ENDPOINT = 'my-db.us-east-1.rds.amazonaws.com'  # ❌ Hardcoded
```

Application deployed to eu-west-1 still connects to us-east-1 (cross-region latency).

**Solution**: Use environment variables, detect region dynamically:
```python
REGION = os.environ['AWS_REGION']
DB_ENDPOINT = f'my-db.{REGION}.rds.amazonaws.com'
```

## Key Takeaways

**Multi-Region Patterns**:
- **Active-Passive (Warm Standby)**: Primary 100% traffic, secondary scaled down (10-50% capacity), failover via Route 53 - RTO 5-30min, RPO 5-15min, Cost 1.2-1.5×
- **Active-Active**: Both regions serve traffic, full capacity in each - RTO/RPO near-zero, Cost 2-2.5×
- **Read Replicas**: Primary handles writes, secondaries handle reads - RTO 5-15min, RPO <1min, Cost 1.5-2×

**Data Replication**:
- **Aurora Global Database**: Physical replication, <1s lag, fast failover (<1min), read-only secondaries, $0.02/GB cross-region transfer
- **DynamoDB Global Tables**: Multi-master, <1s lag, last-writer-wins conflict resolution, all regions writable, 2× write cost
- **S3 CRR**: Object replication, <15min lag (99.99% SLA with RTC), $0.02-0.035/GB

**Traffic Routing**:
- **Geolocation**: Route by user location (compliance, content localization), deterministic
- **Latency-based**: Route to lowest-latency region, performance optimization, automatic failover
- **Geoproximity**: Geographic + bias (shift traffic gradually for load balancing/testing)
- **Failover**: Primary-secondary with health checks, 60-90s detection time

**Consistency Models**:
- **Strong consistency**: Aurora Global DB (primary), single writable region, read replicas eventually consistent
- **Eventual consistency**: DynamoDB Global Tables, multi-master, <1s lag, last-writer-wins
- **Hybrid**: Aurora for transactions (strong), DynamoDB for sessions (eventual)

**Cost Optimization**:
- **CloudFront for static assets**: Eliminate S3 replication costs, global edge caching
- **Read replicas vs active-active**: Lower complexity, same compute cost, fewer writable regions
- **Fargate Spot for secondary**: 70% discount on secondary region compute (accept interruption risk)
- **Compress data**: 60-80% reduction in cross-region transfer costs ($0.02/GB)

**Monitoring**:
- **Replication lag**: Alert if Aurora replication >5s, DynamoDB >2s
- **Health checks**: Route 53 health checks every 10-30s, 1-10 failures before marking unhealthy
- **Distributed tracing**: X-Ray shows cross-region latency, identify bottlenecks

**When to Use**:
- **Multi-region**: 99.99%+ SLA, global latency optimization, data residency compliance, aggressive DR (RTO/RPO <1min)
- **Single-region**: 99.9-99.95% SLA acceptable, cost-sensitive, low user concurrency, simple architecture

**Common Pitfalls**:
- Not testing failover quarterly (discover issues during real outage)
- Ignoring replication lag during peak load (stale data served)
- High DNS TTL prevents fast failover (60s cache vs 10s optimal)
- Underprovisioning secondary region (ASG scale-up takes 10+ minutes during failover)
- Hardcoding region in application code (cross-region latency for all calls)
