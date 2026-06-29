---
title: "AWS Migration Strategy"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "The 6 Rs migration framework, AWS Cloud Adoption Framework, migration planning, and best practices for successful cloud migrations"
tags: [aws, migration, cloud-strategy, decision-making, architecture, planning]
---

## What Problem This Solves

**The Cloud Migration Challenge**:
Organizations migrating to AWS face critical decisions about how to move each application. Should they lift-and-shift (rehost), refactor for cloud-native architecture, or rebuild entirely? The wrong approach leads to cost overruns, extended timelines, or applications that don't benefit from cloud capabilities.

**What This Guide Provides**:
A systematic approach to planning and executing AWS migrations using:
- **The 6 Rs Framework**: Decision model for application migration strategies
- **AWS Cloud Adoption Framework (CAF)**: Organizational guidance for cloud transformation
- **Migration Planning**: Phased approach with proven patterns
- **Success Metrics**: How to measure and validate migration outcomes

---

## The 6 Rs Migration Framework

AWS defines six migration strategies (the "6 Rs") for moving applications to the cloud. Each strategy represents a different level of effort and business value.

### 1. Rehost (Lift-and-Shift)

**What it is**: Move applications to AWS without modifications. Run on EC2 instances with identical configurations to on-premises servers.

**When to use**:
- Large-scale legacy migrations with tight deadlines
- Applications you plan to optimize later (after migration)
- Minimal cloud expertise available
- Need to exit data center quickly
- Applications with unpredictable behavior (risky to change)

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Rehost Benefits</h4>
<ul>
<li>Fastest migration path (weeks vs months)</li>
<li>Lowest risk (no code changes)</li>
<li>Immediate infrastructure cost savings (30-50%)</li>
<li>Foundation for future optimization</li>
<li>Minimal cloud expertise required</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Rehost Limitations</h4>
<ul>
<li>Minimal cloud-native benefits</li>
<li>Still managing servers (EC2 instances)</li>
<li>Leaves technical debt intact</li>
<li>Higher long-term operational costs vs serverless/managed services</li>
<li>Doesn't leverage AWS-managed services</li>
</ul>
</div>
</div>

**Example**:
```bash
# On-premises: Web server on physical server
# CPU: 8 cores, RAM: 32GB, Storage: 500GB

# AWS Rehost: Identical configuration on EC2
aws ec2 run-instances \
  --instance-type m5.2xlarge \  # 8 vCPUs, 32GB RAM
  --image-id ami-0abcdef1234567890 \  # Application AMI (same OS, same config)
  --key-name my-keypair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0

# Application runs identically, just on AWS infrastructure
```

**Cost**: Lowest upfront migration cost ($10K-50K per application), but ongoing operational costs remain high.

**Timeline**: 2-4 weeks per application.

### 2. Replatform (Lift-Tinker-and-Shift)

**What it is**: Move to AWS with minor cloud optimizations (e.g., use RDS instead of self-managed database) without changing core application architecture.

**When to use**:
- Want immediate cloud benefits without full refactor
- Database is performance bottleneck (migrate to RDS/Aurora)
- Application is stable but could benefit from managed services
- Balance speed and optimization

**Benefits**:
- ✅ Faster than refactoring (80% less effort)
- ✅ Immediate operational improvements (managed databases, autoscaling)
- ✅ 30-50% cost savings from managed services
- ✅ Minimal code changes (configuration only)

**Limitations**:
- ❌ Still not fully cloud-native
- ❌ Limited scalability improvements
- ❌ Application architecture remains unchanged

**Example**:
```yaml
# Before (on-premises):
# - Application server (EC2-equivalent)
# - MySQL database on dedicated server
# - Manual backups, patching, scaling

# After (replatform):
# - Application server on EC2 (same as rehost)
# - Migrate MySQL → Amazon RDS for MySQL (managed)
# - Automatic backups, patching, Multi-AZ failover

# CloudFormation example
Resources:
  AppDatabase:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: app-db
      Engine: mysql
      EngineVersion: '8.0'
      DBInstanceClass: db.t3.medium
      AllocatedStorage: 100
      MasterUsername: admin
      MasterUserPassword: !Ref DBPassword
      MultiAZ: true  # High availability
      BackupRetentionPeriod: 7  # Automatic backups
      PreferredBackupWindow: "03:00-04:00"
      PreferredMaintenanceWindow: "sun:04:00-sun:05:00"

  AppServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: m5.large
      ImageId: ami-0abcdef1234567890
      # Update database connection string to RDS endpoint
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          export DB_HOST=${AppDatabase.Endpoint.Address}
          export DB_PORT=3306
          /opt/app/start.sh
```

**Cost**: Low-moderate migration cost ($20K-100K per application), significant ongoing savings from managed services.

**Timeline**: 4-8 weeks per application.

### 3. Repurchase (Drop-and-Shop)

**What it is**: Replace existing application with cloud-native SaaS alternative (e.g., migrate CRM to Salesforce, email to Microsoft 365).

**When to use**:
- SaaS alternative provides equivalent or better functionality
- Current application is heavily customized legacy software
- Want to eliminate operational burden entirely
- Cost-benefit analysis favors SaaS subscription

**Benefits**:
- ✅ Zero infrastructure management
- ✅ Automatic updates and new features
- ✅ Predictable subscription costs
- ✅ Faster migration than rebuild

**Limitations**:
- ❌ Ongoing subscription costs (can be higher long-term)
- ❌ Less customization flexibility
- ❌ Data migration complexity
- ❌ Vendor lock-in

**Example**:
```
# Before: Self-hosted email server
# - Exchange Server on Windows Server
# - 500 users
# - Annual cost: $150K (licenses, hardware, staff)

# After: Migrate to Microsoft 365
# - 500 users × $12/user/month = $6K/month ($72K/year)
# - Zero infrastructure
# - No patching, backups, or maintenance
# - Total savings: $78K/year + staff time

# Migration process:
# 1. Provision Microsoft 365 tenant
# 2. Migrate mailboxes (AWS DataSync, third-party tools)
# 3. Update DNS records (MX, SPF, DKIM)
# 4. Decommission on-premises Exchange
```

**Cost**: Low migration cost ($10K-50K for data migration), ongoing subscription costs.

**Timeline**: 1-3 months depending on data volume.

### 4. Refactor (Re-architect)

**What it is**: Redesign application using cloud-native architecture (serverless, containers, managed services).

**When to use**:
- Need significant scalability improvements
- Want to reduce operational costs by 50-70%
- Application is strategic and worth investment
- Have cloud-native expertise
- Current architecture is technical debt bottleneck

**Benefits**:
- ✅ Maximum cloud-native benefits (scalability, resilience, cost efficiency)
- ✅ 50-70% operational cost reduction
- ✅ Modern development practices (CI/CD, microservices)
- ✅ Improved agility and time-to-market

**Limitations**:
- ❌ Highest effort and cost (6-18 months)
- ❌ Requires significant code changes
- ❌ Requires cloud-native expertise
- ❌ Business disruption during migration

**Example**:
```python
# Before (monolithic):
# - Single EC2 instance running monolithic app
# - MySQL database on another EC2
# - Manual scaling, always-on infrastructure
# - Cost: $2,000/month for 24/7 operation

# After (serverless refactor):
# - API Gateway + Lambda functions (microservices)
# - DynamoDB (fully managed NoSQL)
# - S3 for static assets
# - CloudFront CDN
# - Cost: $200-500/month (90% cost reduction, pay-per-use)

# Example Lambda function (replacing monolithic endpoint)
import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Products')

def lambda_handler(event, context):
    """Serverless product API endpoint"""
    product_id = event['pathParameters']['id']

    # Query DynamoDB (no database server to manage)
    response = table.get_item(Key={'product_id': product_id})

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(response.get('Item', {}))
    }

# Infrastructure as Code (SAM template)
Resources:
  ProductApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod

  GetProductFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.lambda_handler
      Runtime: python3.9
      Events:
        GetProduct:
          Type: Api
          Properties:
            RestApiId: !Ref ProductApi
            Path: /products/{id}
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref ProductsTable

  ProductsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: Products
      BillingMode: PAY_PER_REQUEST  # No provisioned capacity
      AttributeDefinitions:
        - AttributeName: product_id
          AttributeType: S
      KeySchema:
        - AttributeName: product_id
          KeyType: HASH
```

**Cost**: High migration cost ($200K-1M+ per application), but 50-70% ongoing savings.

**Timeline**: 6-18 months per application.

### 5. Retire

**What it is**: Decommission applications that are no longer needed.

**When to use**:
- Application has <10% usage
- Functionality is redundant (available elsewhere)
- Business process has changed
- Application is end-of-life with no replacement needed

**Benefits**:
- ✅ Immediate cost savings (100%)
- ✅ Reduced security/compliance risk
- ✅ Simplified portfolio

**Limitations**:
- ❌ Requires business validation (ensure truly not needed)
- ❌ Data retention requirements (must archive if needed)

**Example**:
```bash
# Discovery process
# 1. Identify low-usage applications
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-12-31T23:59:59Z \
  --period 86400 \
  --statistics Average

# Result: Average CPU 2%, network 1KB/s
# Conclusion: Application has minimal usage

# 2. Business validation
# - Email stakeholders: "Application X has <1% usage. Plan to retire?"
# - Wait 30 days for objections
# - Document decision

# 3. Decommission process
# - Archive data to S3 Glacier (compliance retention)
aws s3 sync /data/app-archive s3://my-archive-bucket/app-x/ \
  --storage-class GLACIER

# - Terminate resources
aws ec2 terminate-instances --instance-ids i-0123456789abcdef0

# - Update documentation and asset inventory
```

**Cost**: Minimal ($5K-20K for decommissioning), 100% ongoing savings.

**Timeline**: 2-4 weeks.

### 6. Retain

**What it is**: Keep applications on-premises (for now). Do not migrate.

**When to use**:
- Application requires major refactoring but not yet prioritized
- Compliance restrictions prevent cloud migration (temporarily)
- Recently invested in on-premises infrastructure
- Planning to retire in near future (don't migrate)
- Dependencies not yet resolved

**Benefits**:
- ✅ Defer migration costs for low-priority applications
- ✅ Avoid migrating applications that will be retired
- ✅ Focus resources on high-value migrations

**Limitations**:
- ❌ No cloud benefits
- ❌ Ongoing on-premises costs
- ❌ Technical debt accumulates

**Example**:
```
# Scenario: 100 applications in portfolio
# Migration wave planning:

# Wave 1 (Year 1): High-value, low-complexity
# - 20 applications: Rehost/Replatform
# - 5 applications: Retire
# - Cost: $500K, Savings: $1M/year

# Wave 2 (Year 2): Strategic applications
# - 10 applications: Refactor (cloud-native)
# - 15 applications: Rehost/Replatform
# - Cost: $2M, Savings: $3M/year

# Wave 3 (Year 3+): Remaining portfolio
# - 30 applications: Rehost/Replatform
# - 20 applications: Retain (low priority, defer)

# The 20 "Retain" applications:
# - Not migrated yet due to low business priority
# - Remain on-premises until Wave 4 or retirement
# - Decision revisited annually
```

**Cost**: Zero migration cost, ongoing on-premises costs continue.

---

## Decision Framework: Choosing the Right R

### Step 1: Application Assessment

Create an inventory of all applications with these attributes:

| Attribute | Why It Matters |
|-----------|---------------|
| **Business criticality** | High-value apps justify refactor investment |
| **Technical complexity** | Complex dependencies require careful planning |
| **Current state** | Stable apps are easier to migrate |
| **SaaS alternatives** | Commercial alternatives enable repurchase |
| **Usage patterns** | Low usage → candidate for retirement |
| **Compliance requirements** | Some regulations restrict cloud migration |
| **Dependencies** | Must migrate dependencies first |

**Example assessment matrix**:

```python
# Application portfolio assessment
applications = [
    {
        'name': 'Customer Portal',
        'criticality': 'High',
        'complexity': 'Medium',
        'stable': True,
        'usage': 'High',
        'saas_available': False,
        'cloud_ready': True,
        'dependencies': ['Customer DB', 'Auth Service']
    },
    {
        'name': 'Internal Wiki',
        'criticality': 'Low',
        'complexity': 'Low',
        'stable': True,
        'usage': 'Medium',
        'saas_available': True,  # Confluence, Notion
        'cloud_ready': True,
        'dependencies': []
    },
    {
        'name': 'Legacy Reporting Tool',
        'criticality': 'Low',
        'complexity': 'High',
        'stable': False,
        'usage': 'Very Low',  # <5% of users
        'saas_available': False,
        'cloud_ready': False,
        'dependencies': ['Data Warehouse']
    }
]

# Decision logic
def recommend_strategy(app):
    # Retire: Low usage, low criticality
    if app['usage'] == 'Very Low' and app['criticality'] == 'Low':
        return 'RETIRE'

    # Repurchase: SaaS available, not highly customized
    if app['saas_available'] and app['complexity'] == 'Low':
        return 'REPURCHASE'

    # Refactor: High criticality, worth investment
    if app['criticality'] == 'High' and app['stable']:
        return 'REFACTOR (cloud-native)'

    # Replatform: Stable, cloud-ready, medium complexity
    if app['stable'] and app['cloud_ready'] and app['complexity'] == 'Medium':
        return 'REPLATFORM'

    # Rehost: Default for everything else
    return 'REHOST'

# Apply to portfolio
for app in applications:
    strategy = recommend_strategy(app)
    print(f"{app['name']}: {strategy}")

# Output:
# Customer Portal: REFACTOR (cloud-native)
# Internal Wiki: REPURCHASE
# Legacy Reporting Tool: RETIRE
```

### Step 2: Cost-Benefit Analysis

<div class="callout callout--tip">
<p class="callout__title">ROI Calculation Tip</p>
<p>Don't just compare upfront migration costs. Calculate total 3-year costs including migration, ongoing cloud infrastructure, and operational savings to determine true ROI for each migration strategy.</p>
</div>

Calculate ROI for each migration strategy:

```
ROI = (Total Benefits - Total Costs) / Total Costs × 100%

Total Benefits (3 years):
- Infrastructure cost savings
- Operational cost savings (staff time)
- Productivity improvements
- Risk reduction (security, compliance)

Total Costs (3 years):
- Migration project cost (staff, tools, contractors)
- Ongoing cloud infrastructure costs
- Training and upskilling
- Temporary dual-running costs (on-prem + cloud during migration)
```

**Example calculation** (e-commerce application):

| Strategy | Migration Cost | 3-Year Cloud Cost | 3-Year On-Prem Cost | 3-Year Savings | ROI |
|----------|----------------|-------------------|---------------------|----------------|-----|
| **Rehost** | $50K | $360K | $600K | $190K | 380% |
| **Replatform** | $100K | $240K | $600K | $260K | 260% |
| **Refactor** | $500K | $120K | $600K | -$20K | -4% (payback in Year 4) |

**Decision**: Replatform offers best 3-year ROI. Refactor only if 5-year horizon or strategic value justifies higher upfront cost.

### Step 3: Dependency Mapping

<div class="callout callout--warning">
<p class="callout__title">Critical Rule</p>
<p>Always migrate dependencies before dependent applications. Migrating a web app before its database will result in broken functionality post-migration.</p>
</div>

**Critical rule**: Migrate dependencies before dependent applications.

```mermaid
# Dependency graph example

Web App
  ├─→ API Gateway
  │    ├─→ Auth Service
  │    └─→ Product Service
  │         └─→ Product Database
  └─→ CDN (CloudFront)

# Migration order:
# 1. Product Database (Replatform to RDS)
# 2. Auth Service (Rehost to EC2)
# 3. Product Service (Rehost to EC2)
# 4. API Gateway (Refactor to AWS API Gateway)
# 5. Web App (Replatform to ECS)
# 6. CDN (Repurchase CloudFront)
```

**Implementation**:
```python
# Dependency-aware migration sequencing
dependencies = {
    'Web App': ['API Gateway', 'CDN'],
    'API Gateway': ['Auth Service', 'Product Service'],
    'Product Service': ['Product Database'],
    'Auth Service': [],
    'Product Database': [],
    'CDN': []
}

def topological_sort(deps):
    """Order applications for migration (dependencies first)"""
    visited = set()
    order = []

    def visit(app):
        if app in visited:
            return
        visited.add(app)
        for dep in deps.get(app, []):
            visit(dep)
        order.append(app)

    for app in deps:
        visit(app)

    return order

migration_order = topological_sort(dependencies)
print("Migration sequence:", migration_order)
# Output: ['Product Database', 'Auth Service', 'Product Service', 'CDN', 'API Gateway', 'Web App']
```

---

## AWS Cloud Adoption Framework (CAF)

The AWS CAF provides organizational guidance for cloud transformation across six perspectives.

### Business Perspectives

**1. Business Perspective**

**Focus**: Ensure cloud investments align with business outcomes.

**Key activities**:
- Define business case for cloud migration
- Establish cloud financial management (FinOps)
- Measure business value (KPIs, metrics)
- Stakeholder management and communication

**Example KPIs**:
```
Financial:
- Infrastructure cost reduction: Target 30-50%
- Operational cost reduction: Target 40-60%
- TCO improvement: 3-year payback

Agility:
- Deployment frequency: 10x increase
- Time-to-market: 50% reduction
- Infrastructure provisioning: Hours → Minutes

Risk:
- Security incidents: 30% reduction
- Compliance audit findings: 50% reduction
- Availability: 99.9% → 99.99%
```

**2. People Perspective**

**Focus**: Prepare organization for cloud operating model.

**Key activities**:
- Skills gap analysis and training plans
- Organizational change management
- Cloud Center of Excellence (CCoE) establishment
- Hiring strategy for cloud talent

**Example training plan**:
```
# Role-based learning paths

Infrastructure Team:
- AWS Solutions Architect Associate (all team members)
- AWS SysOps Administrator (ops-focused)
- Deep dive: EC2, VPC, RDS, CloudFormation

Development Team:
- AWS Developer Associate
- Serverless development (Lambda, API Gateway)
- Container orchestration (ECS, EKS)

Security Team:
- AWS Security Specialty
- IAM, KMS, GuardDuty, Security Hub
- Compliance frameworks (HIPAA, PCI-DSS)

Timeline: 6 months, $5K/person budget
```

**3. Governance Perspective**

**Focus**: Manage and control cloud environment.

**Key activities**:
- Cloud governance framework
- Cost management and optimization
- Security and compliance controls
- Portfolio management

**Example governance structure**:
```yaml
# Multi-account governance with AWS Organizations

Organization Root
├── Security OU (centralized security)
│   ├── Log Archive Account (CloudTrail, Config, VPC Flow Logs)
│   └── Security Tooling Account (GuardDuty, Security Hub)
├── Infrastructure OU (shared services)
│   ├── Network Account (Transit Gateway, Direct Connect)
│   └── Shared Services Account (AD, DNS)
├── Workloads OU (application accounts)
│   ├── Production Account
│   ├── Staging Account
│   └── Development Account
└── Sandbox OU (experimentation)
    └── Individual developer accounts

# Service Control Policies (SCPs)
# - Prevent root account usage
# - Require encryption at rest
# - Restrict regions (data residency)
# - Enforce tagging standards
```

### Technical Perspectives

**4. Platform Perspective**

**Focus**: Build scalable, resilient cloud infrastructure.

**Key activities**:
- Landing zone design (AWS Control Tower)
- Network architecture (VPCs, Transit Gateway, Direct Connect)
- Compute strategy (EC2, containers, serverless)
- Storage and database selection

**Example landing zone**:
```hcl
# Terraform: Landing zone foundation

# Centralized networking (hub-and-spoke)
resource "aws_ec2_transit_gateway" "main" {
  description = "Central TGW for all VPCs"
  default_route_table_association = "disable"
  default_route_table_propagation = "disable"
}

# Shared Services VPC (hub)
resource "aws_vpc" "shared_services" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true

  tags = {
    Name = "shared-services-vpc"
    Environment = "infrastructure"
  }
}

# Workload VPCs (spokes)
resource "aws_vpc" "production" {
  cidr_block = "10.1.0.0/16"

  tags = {
    Name = "production-vpc"
    Environment = "production"
  }
}

resource "aws_vpc" "development" {
  cidr_block = "10.2.0.0/16"

  tags = {
    Name = "development-vpc"
    Environment = "development"
  }
}

# Attach all VPCs to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "shared_services" {
  subnet_ids         = aws_subnet.shared_services_private.*.id
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id             = aws_vpc.shared_services.id
}

# Centralized logging
resource "aws_cloudtrail" "organization" {
  name                          = "organization-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  is_organization_trail         = true
}
```

**5. Security Perspective**

**Focus**: Implement comprehensive security controls.

**Key activities**:
- Identity and access management strategy
- Data protection (encryption at rest/transit)
- Threat detection and response
- Compliance automation

**Example security baseline**:
```python
# Automated security baseline using AWS Config

config_rules = [
    {
        'name': 'encrypted-volumes',
        'source': 'AWS::Config::ManagedRule',
        'identifier': 'ENCRYPTED_VOLUMES',
        'description': 'Ensure all EBS volumes are encrypted'
    },
    {
        'name': 's3-bucket-public-read-prohibited',
        'source': 'AWS::Config::ManagedRule',
        'identifier': 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
        'description': 'Ensure S3 buckets prohibit public read access'
    },
    {
        'name': 'rds-encryption-enabled',
        'source': 'AWS::Config::ManagedRule',
        'identifier': 'RDS_STORAGE_ENCRYPTED',
        'description': 'Ensure RDS instances have encryption enabled'
    },
    {
        'name': 'iam-password-policy',
        'source': 'AWS::Config::ManagedRule',
        'identifier': 'IAM_PASSWORD_POLICY',
        'description': 'Ensure IAM password policy meets requirements',
        'parameters': {
            'RequireUppercaseCharacters': True,
            'RequireLowercaseCharacters': True,
            'RequireNumbers': True,
            'RequireSymbols': True,
            'MinimumPasswordLength': 14,
            'MaxPasswordAge': 90
        }
    }
]

# Auto-remediation for non-compliant resources
remediation_actions = {
    'encrypted-volumes': 'Create snapshot, create encrypted volume, replace',
    's3-bucket-public-read-prohibited': 'Update bucket policy to block public access',
    'rds-encryption-enabled': 'Create encrypted snapshot, restore to new instance'
}
```

**6. Operations Perspective**

**Focus**: Run, monitor, and optimize cloud workloads.

**Key activities**:
- Operational excellence practices (runbooks, automation)
- Monitoring and observability strategy
- Incident management and response
- Continuous improvement

**Example operational framework**:
```yaml
# Operational excellence pillars

1. Observability:
  Metrics:
    - Application: Custom CloudWatch metrics (latency, errors, saturation)
    - Infrastructure: CPU, memory, disk, network
    - Business: Orders/min, revenue/hour, active users
  Logs:
    - Centralized: CloudWatch Logs → S3 → Athena (queryable)
    - Retention: 7 days hot, 90 days warm, 7 years cold (compliance)
  Traces:
    - X-Ray for distributed tracing
    - APM integration (Datadog, New Relic)

2. Automation:
  Infrastructure:
    - 100% Infrastructure as Code (Terraform, CloudFormation)
    - Automated provisioning (no manual clicks)
  Deployments:
    - CI/CD pipelines (CodePipeline, GitHub Actions)
    - Blue/green deployments for zero-downtime
  Operations:
    - Auto-scaling based on metrics
    - Automated patching (Systems Manager Patch Manager)
    - Self-healing (CloudWatch alarms → Lambda → remediation)

3. Incident Response:
  Detection:
    - CloudWatch Alarms → SNS → PagerDuty
    - GuardDuty findings → Security team
  Response:
    - Runbooks in wiki (troubleshooting steps)
    - Incident command structure (IC, comms, tech lead)
  Post-Incident:
    - Blameless post-mortems
    - Remediation items → backlog
```

---

## Migration Planning: Phased Approach

<div class="callout callout--note">
<p class="callout__title">Migration Phases</p>
<p>Successful migrations follow a phased approach: Assess (understand current state), Mobilize (prepare organization and environment), Migrate (execute waves), and Operate (optimize continuously).</p>
</div>

### Phase 1: Assess (2-4 months)

**Objective**: Understand current state and build migration plan.

**Activities**:
1. **Application discovery**: Inventory all applications, dependencies, infrastructure
2. **Readiness assessment**: Evaluate organization's cloud maturity
3. **TCO analysis**: Calculate costs (current vs cloud)
4. **Migration strategy**: Assign 6 Rs to each application
5. **Migration plan**: Sequence applications into waves

**Tools**:
- **AWS Application Discovery Service**: Automated discovery of on-premises servers
- **AWS Migration Evaluator** (formerly TSO Logic): TCO analysis
- **Migration Readiness Assessment** (MRA): Workshop with AWS

**Deliverables**:
```
1. Application Portfolio Spreadsheet:
   - 100 applications with attributes (criticality, complexity, dependencies)
   - Migration strategy for each (6 Rs)
   - Estimated effort and cost

2. Migration Roadmap:
   - Wave 1 (Months 1-6): 20 applications, $500K budget
   - Wave 2 (Months 7-12): 25 applications, $800K budget
   - Wave 3 (Months 13-18): 30 applications, $1.2M budget

3. Business Case:
   - 3-year TCO: $12M on-prem → $7M AWS (42% savings)
   - Migration cost: $2.5M (payback in 18 months)
   - Risk mitigation: EOL hardware, security improvements
```

### Phase 2: Mobilize (1-3 months)

<div class="callout callout--tip">
<p class="callout__title">Pilot Migration First</p>
<p>Before executing large-scale migration waves, always pilot with 1-2 low-risk applications. This validates your processes, tooling, and team readiness while minimizing business risk.</p>
</div>

**Objective**: Prepare organization and AWS environment for migration.

**Activities**:
1. **Build Cloud Center of Excellence** (CCoE): Dedicated migration team
2. **Set up landing zone**: Multi-account structure, networking, security baseline
3. **Pilot migration**: Migrate 1-2 low-risk applications to validate approach
4. **Training**: Upskill teams on AWS services and cloud operating model
5. **Establish migration factory**: Repeatable processes and tooling

**Landing zone setup**:
```bash
# Use AWS Control Tower for automated landing zone

# 1. Enable Control Tower (via AWS Console)
# - Creates Organization structure
# - Creates Log Archive and Audit accounts
# - Sets up guardrails (SCPs)

# 2. Provision additional accounts
aws organizations create-account \
  --email production@company.com \
  --account-name "Production" \
  --role-name OrganizationAccountAccessRole

aws organizations create-account \
  --email development@company.com \
  --account-name "Development" \
  --role-name OrganizationAccountAccessRole

# 3. Deploy baseline resources (via CloudFormation StackSets)
# - VPCs in each account
# - Transit Gateway attachments
# - Security groups (baseline rules)
# - IAM roles (cross-account access)
# - Config rules (compliance automation)
# - GuardDuty (threat detection)
```

**Pilot migration example**:
```
Application: Internal Wiki (low criticality, low complexity)
Strategy: Repurchase (migrate to Confluence Cloud)

Timeline:
- Week 1: Provision Confluence Cloud, configure SSO
- Week 2: Migrate content (AWS DataSync for file attachments)
- Week 3: User acceptance testing
- Week 4: Cutover, decommission on-premises wiki

Learnings:
- Data migration took 2x longer than estimated (add buffer)
- SSO integration required custom SAML configuration (document)
- Users needed training (create wiki-migration playbook)
```

### Phase 3: Migrate and Modernize (6-24 months)

**Objective**: Execute migration waves, optimize applications.

**Migration factory approach**:
```python
# Repeatable migration process (rehost example)

def migrate_application_rehost(app):
    """Standard rehost migration runbook"""

    # 1. Pre-migration
    backup_on_prem_server(app['server'])
    document_configuration(app['server'])
    test_connectivity(app['dependencies'])

    # 2. Migration
    # Option A: AWS Application Migration Service (MGN)
    install_replication_agent(app['server'])
    replicate_to_aws(app['server'], target_instance_type='m5.large')

    # Option B: Manual AMI creation
    create_ami(app['server'])
    launch_ec2_from_ami(ami_id, vpc_id, subnet_id)

    # 3. Testing
    run_smoke_tests(app['aws_endpoint'])
    run_performance_tests(app['aws_endpoint'])
    validate_dependencies(app['dependencies'])

    # 4. Cutover
    update_dns(app['domain'], new_ip=app['aws_ip'])
    monitor_traffic_shift(app['domain'])

    # 5. Post-migration
    decommission_on_prem_server(app['server'], after_days=30)
    optimize_instance_type(app['aws_instance'])  # Right-size
    enable_backups(app['aws_instance'])

    return {'status': 'success', 'migrated_at': datetime.now()}
```

**Wave execution**:
```
# Wave 1: Low-hanging fruit (6 months)
# - 20 applications: Rehost/Replatform
# - 5 applications: Retire
# - 2 applications: Repurchase

# Week-by-week schedule:
# Weeks 1-4: Applications 1-5 (parallel migration teams)
# Weeks 5-8: Applications 6-10
# Weeks 9-12: Applications 11-15
# Weeks 13-16: Applications 16-20
# Weeks 17-20: Repurchase migrations (SaaS)
# Weeks 21-24: Retirements, optimization, lessons learned
```

### Phase 4: Operate and Optimize (Ongoing)

**Objective**: Continuously improve cloud operations and costs.

**Activities**:
1. **Cost optimization**: Right-size instances, Reserved Instances, Savings Plans
2. **Performance tuning**: Optimize database queries, caching, CDN usage
3. **Security hardening**: Implement least privilege, automated compliance
4. **Modernization**: Gradually refactor rehosted applications to cloud-native

**Example optimization cycle**:
```python
# Monthly cost optimization review

import boto3

# 1. Identify idle resources
ec2 = boto3.client('ec2')
cloudwatch = boto3.client('cloudwatch')

instances = ec2.describe_instances()['Reservations']

for reservation in instances:
    for instance in reservation['Instances']:
        instance_id = instance['InstanceId']

        # Check CPU utilization (last 30 days)
        metrics = cloudwatch.get_metric_statistics(
            Namespace='AWS/EC2',
            MetricName='CPUUtilization',
            Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
            StartTime=datetime.now() - timedelta(days=30),
            EndTime=datetime.now(),
            Period=86400,
            Statistics=['Average']
        )

        avg_cpu = sum(m['Average'] for m in metrics['Datapoints']) / len(metrics['Datapoints'])

        if avg_cpu < 10:
            print(f"⚠️ Idle instance: {instance_id} (Avg CPU: {avg_cpu:.1f}%)")
            print(f"   Recommendation: Stop or downsize")

# 2. Right-sizing recommendations
compute_optimizer = boto3.client('compute-optimizer')

recommendations = compute_optimizer.get_ec2_instance_recommendations()

for rec in recommendations['instanceRecommendations']:
    current = rec['currentInstanceType']
    recommended = rec['recommendationOptions'][0]['instanceType']
    savings = rec['recommendationOptions'][0]['estimatedMonthlySavings']['value']

    if savings > 50:
        print(f"💰 Right-size: {rec['instanceArn']}")
        print(f"   Current: {current} → Recommended: {recommended}")
        print(f"   Estimated savings: ${savings:.2f}/month")

# 3. Reserved Instance opportunities
cost_explorer = boto3.client('ce')

ri_recs = cost_explorer.get_reservation_purchase_recommendation(
    Service='Amazon Elastic Compute Cloud - Compute',
    LookbackPeriodInDays='SIXTY_DAYS',
    TermInYears='ONE_YEAR',
    PaymentOption='NO_UPFRONT'
)

for rec in ri_recs['Recommendations']:
    print(f"📊 RI Recommendation:")
    print(f"   Instance type: {rec['RecommendationDetail']['InstanceDetails']['EC2InstanceDetails']['InstanceType']}")
    print(f"   Estimated savings: ${rec['RecommendationDetail']['EstimatedMonthlySavingsAmount']}/month")
```

---

## Migration Tools

### AWS Application Migration Service (MGN)

**What it is**: Automated lift-and-shift migration (rehost) with continuous replication.

**How it works**:
1. Install replication agent on source server
2. Agent replicates data to AWS staging area
3. Launch test/cutover instances from replicated data
4. Cutover with minimal downtime (<5 minutes)

**Example**:
```bash
# 1. Install MGN agent on source server (Linux)
wget -O ./aws-replication-installer-init.py https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py

sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id AKIAIOSFODNN7EXAMPLE \
  --aws-secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# 2. Agent automatically begins replication to AWS
# 3. Monitor replication progress
aws mgn describe-source-servers \
  --filters name=isArchived,values=false

# 4. Launch test instance
aws mgn start-test \
  --source-server-id s-1234567890abcdef0

# 5. Validate test instance
# - Run smoke tests
# - Verify application functionality

# 6. Cutover
aws mgn start-cutover \
  --source-server-id s-1234567890abcdef0

# 7. Finalize (stops replication, marks migration complete)
aws mgn finalize-cutover \
  --source-server-id s-1234567890abcdef0
```

**Benefits**:
- Minimal downtime (<5 min)
- Automated process (less error-prone)
- Test before cutover (risk mitigation)
- Free for 90 days (no service charges)

### AWS Database Migration Service (DMS)

**What it is**: Migrate databases with minimal downtime using continuous replication.

**Covered in detail**: See the dedicated [AWS Database Migration Service guide](aws-database-migration-service.md).

### AWS DataSync

**What it is**: High-speed data transfer for file storage (NFS, SMB, S3, EFS).

**Use cases**:
- Migrate file servers to EFS or FSx
- Sync on-premises storage to S3
- One-time or continuous replication

**Example**:
```bash
# Migrate on-premises file server to EFS

# 1. Deploy DataSync agent (VM in on-premises environment)
# Download OVA from AWS Console, deploy to VMware/Hyper-V

# 2. Create source location (on-premises NFS)
aws datasync create-location-nfs \
  --server-hostname 192.168.1.100 \
  --subdirectory /shared/data \
  --on-prem-config AgentArns=arn:aws:datasync:us-east-1:123456789012:agent/agent-0abcdef1234567890

# 3. Create destination location (EFS)
aws datasync create-location-efs \
  --efs-filesystem-arn arn:aws:elasticfilesystem:us-east-1:123456789012:file-system/fs-0abcdef1234567890 \
  --subdirectory /migrated-data \
  --ec2-config SubnetArn=arn:aws:ec2:us-east-1:123456789012:subnet/subnet-0abcdef1234567890,SecurityGroupArns=arn:aws:ec2:us-east-1:123456789012:security-group/sg-0abcdef1234567890

# 4. Create and run task
aws datasync create-task \
  --source-location-arn arn:aws:datasync:us-east-1:123456789012:location/loc-0abcdef1234567890 \
  --destination-location-arn arn:aws:datasync:us-east-1:123456789012:location/loc-0abcdef1234567890 \
  --name nfs-to-efs-migration \
  --options VerifyMode=POINT_IN_TIME_CONSISTENT,OverwriteMode=ALWAYS

aws datasync start-task-execution \
  --task-arn arn:aws:datasync:us-east-1:123456789012:task/task-0abcdef1234567890

# 5. Monitor transfer
aws datasync describe-task-execution \
  --task-execution-arn arn:aws:datasync:us-east-1:123456789012:task/task-0abcdef1234567890/execution/exec-0abcdef1234567890
```

**Transfer speeds**: Up to 10 Gbps per task (10x faster than open-source tools).

---

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Migration Pitfalls</p>
<p>The most common migration failures stem from inadequate assessment, lack of testing, and missing rollback plans. Avoid these pitfalls by following proven migration practices.</p>
</div>

### Pitfall 1: Migrating Without Assessment

**Problem**: Teams migrate applications without understanding dependencies, leading to broken functionality.

**Example**:
```
# Scenario: Migrate web app to AWS
# - Migrate web server to EC2 ✅
# - Forget that app depends on on-premises LDAP for authentication ❌
# - Result: Users cannot log in post-migration

# Proper approach:
# 1. Discover all dependencies (Application Discovery Service)
# 2. Map integration points (LDAP, databases, APIs, file shares)
# 3. Migrate dependencies first OR establish hybrid connectivity (Direct Connect, VPN)
```

**Solution**: Use Application Discovery Service + manual validation to map all dependencies before migration.

### Pitfall 2: Lift-and-Shift Everything (No Optimization)

**Problem**: Rehost all applications without evaluating retire, repurchase, or replatform opportunities.

**Impact**:
- Miss 50-70% cost savings from managed services
- Carry technical debt to cloud
- Higher long-term operational costs

**Solution**:
```python
# Apply decision framework to EVERY application
# Example: 100-application portfolio

strategies = {
    'Retire': 15,      # 15% low-usage apps
    'Repurchase': 10,  # 10% have SaaS alternatives
    'Replatform': 30,  # 30% benefit from managed services
    'Rehost': 40,      # 40% migrate as-is (for speed)
    'Refactor': 5      # 5% high-value strategic apps
}

# Result: 30-50% higher savings than rehost-only approach
```

### Pitfall 3: Ignoring Data Transfer Costs

**Problem**: Underestimate data transfer costs for large migrations.

**Example**:
```
# Scenario: Migrate 500TB of data to AWS over internet

# Data transfer costs:
# - Data OUT from on-premises: $0 (ISP outbound usually free)
# - Data IN to AWS: $0 (AWS inbound free)
# - BUT: Transfer time over 1 Gbps link = 46 days

# Better approach: AWS Snowball
# - 80TB device × 7 devices = 560TB capacity
# - Cost: $300/device = $2,100 total
# - Transfer time: 1 week (ship devices to AWS)
# - Savings: 45 days of time + bandwidth saturation avoided
```

**Solution**: For >10TB, use AWS Snowball/Snowmobile instead of network transfer.

### Pitfall 4: No Testing Before Cutover

**Problem**: Cut over to AWS without validating application functionality.

**Solution**:
```bash
# Always test before cutover

# 1. Deploy to AWS (parallel to on-premises)
# 2. Run test suite
pytest tests/ --endpoint=https://aws-staging.company.com

# 3. Performance test
locust -f load_test.py --host=https://aws-staging.company.com --users=1000

# 4. Smoke test critical workflows
# - User login
# - Place order
# - View reports

# 5. ONLY after all tests pass: Update DNS for cutover
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://cutover-dns.json
```

### Pitfall 5: Not Planning for Rollback

**Problem**: Migration fails, no plan to revert to on-premises.

**Solution**:
```
# Rollback plan (always maintain):

# 1. Keep on-premises systems running for 30 days post-migration
# 2. Document rollback procedure:
#    a. Revert DNS to on-premises IP
#    b. Stop AWS resources
#    c. Restore on-premises from last backup (if decommissioned)
# 3. Define rollback criteria:
#    - >10% error rate in AWS
#    - >500ms P99 latency degradation
#    - Critical bug discovered post-cutover

# Example rollback
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "app.company.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "192.168.1.100"}]  # On-prem IP
      }
    }]
  }'
```

---

## Key Takeaways

**The 6 Rs Framework**:
1. **Rehost** (Lift-and-Shift): Fast, low-risk, 30-50% cost savings, minimal cloud benefits
2. **Replatform** (Lift-Tinker-Shift): Best ROI for most apps, 40-60% savings, managed services
3. **Repurchase** (SaaS): Zero ops burden, predictable costs, less customization
4. **Refactor** (Cloud-Native): Maximum benefits (50-70% savings), highest effort (6-18 months)
5. **Retire**: 100% savings, eliminate unused applications
6. **Retain**: Defer migration for low-priority apps

**Decision Framework**:
7. **Always assess first**: Application inventory, dependency mapping, cost-benefit analysis
8. **Retire 10-15%** of portfolio (low-usage apps)
9. **Repurchase 10-20%** (SaaS alternatives available)
10. **Replatform 30-40%** (best ROI with managed services)
11. **Rehost 30-40%** (speed to cloud, optimize later)
12. **Refactor 5-10%** (strategic, high-value applications only)

**Migration Planning**:
13. **Phased approach**: Assess → Mobilize → Migrate → Operate (6-24 months)
14. **Migration waves**: Group applications by complexity, dependencies, business value
15. **Pilot first**: Migrate 1-2 low-risk apps to validate processes
16. **Migration factory**: Repeatable processes, automation, dedicated teams

**AWS CAF Perspectives**:
17. **Business**: Define ROI, KPIs, stakeholder management
18. **People**: Skills training, organizational change, Cloud Center of Excellence
19. **Governance**: Multi-account structure, cost management, compliance
20. **Platform**: Landing zone, networking, compute/storage strategy
21. **Security**: IAM, encryption, threat detection, compliance automation
22. **Operations**: Monitoring, automation, incident response, continuous improvement

**Success Factors**:
23. **Executive sponsorship**: C-level commitment and funding
24. **Dedicated migration team**: Don't treat as side project
25. **Training investment**: $5K/person for AWS certifications
26. **Test before cutover**: Always validate in AWS before DNS switch
27. **Maintain rollback plan**: Keep on-premises running for 30 days
28. **Continuous optimization**: Cost, performance, security improvements post-migration

Cloud migration is a transformation journey, not just an infrastructure project. Success requires strategic planning, organizational readiness, and disciplined execution across all six CAF perspectives.
