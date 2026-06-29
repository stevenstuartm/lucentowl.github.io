---
title: "IaC Implementation Patterns"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Modular design, environment separation, layered architecture, and GitOps workflow patterns for organizing IaC code effectively."
tags: [infrastructure, iac, design-patterns, best-practices, practical]
---

## Modular Design

**What it is:** Breaking infrastructure code into reusable, self-contained components (modules).

**Purpose:** Modules encapsulate resources that work together as a logical unit (e.g., a VPC with subnets, a database with backups). They're about **code reuse and abstraction**, not about deployment organization (that's layering).

**Think of modules as:** Functions or libraries in programming; reusable building blocks you can use anywhere.

### Benefits

- Code reuse across projects and environments
- Easier testing (test module once, use everywhere)
- Encapsulation (module internals hidden, clear interfaces)
- Standardization (everyone uses same VPC module, for example)
- Faster development (don't rewrite common patterns)

### Module Structure

**Each module is self-contained:**

```
modules/
├── vpc/                    # Reusable VPC module
│   ├── main.tf            # VPC, subnets, routing, NAT
│   ├── variables.tf       # Inputs (CIDR, AZ count, etc.)
│   ├── outputs.tf         # Outputs (VPC ID, subnet IDs)
│   └── README.md          # How to use this module
├── rds/                   # Reusable RDS module
│   ├── main.tf            # RDS instance, subnet group, params
│   ├── variables.tf       # Inputs (engine, size, etc.)
│   ├── outputs.tf         # Outputs (endpoint, port)
│   └── README.md
└── eks/                   # Reusable EKS module
    ├── main.tf            # EKS cluster, node groups
    ├── variables.tf
    ├── outputs.tf
    └── README.md
```

### Using Modules

**Modules are consumed by layers (foundation, platform, etc.):**

```hcl
# foundation/networking.tf
# Foundation layer USES the VPC module
module "vpc" {
  source = "../modules/vpc"

  cidr_block     = "10.0.0.0/16"
  azs            = ["us-east-1a", "us-east-1b", "us-east-1c"]
  environment    = "prod"
  enable_nat     = true
}

# platform/shared-database.tf
# Platform layer USES the RDS module
module "shared_db" {
  source = "../modules/rds"

  vpc_id         = data.terraform_remote_state.foundation.outputs.vpc_id
  subnet_ids     = data.terraform_remote_state.foundation.outputs.database_subnet_ids
  engine         = "postgres"
  instance_class = "db.r5.xlarge"
  multi_az       = true
}
```

### Module Best Practices

**1. Single Responsibility**
- Each module should do one thing well
- Avoid monolithic modules
- Keep modules focused and cohesive

**2. Well-Defined Interfaces**
```hcl
# variables.tf - Clear inputs
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# outputs.tf - Clear outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}
```

**3. Version Modules**
```hcl
# Use versioned modules
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"  # Pin to specific version
}
```

**4. Document Modules**

Each module should have a README.md with:
- Purpose and description
- Usage example
- Input variables table
- Output values table

**Example README.md:**

```
# VPC Module

Creates a VPC with public and private subnets across multiple AZs.

## Usage

    module "vpc" {
      source = "./modules/vpc"

      cidr_block  = "10.0.0.0/16"
      environment = "production"
    }

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| cidr_block | VPC CIDR block | string | n/a | yes |
| environment | Environment name | string | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | The ID of the VPC |
| private_subnet_ids | List of private subnet IDs |
```

---

## Environment Separation

**What it is:** Managing separate infrastructure configurations for different environments (dev, staging, production).

### Approaches

**Approach 1: Directory Structure**

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── modules/
    └── ...
```

**Advantages:**
- Clear separation
- Different configurations per environment
- Easy to see all environments

**Disadvantages:**
- Code duplication
- Must update all environments for changes

**Approach 2: Workspaces (Terraform)**

```bash
# Create workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# Switch workspace
terraform workspace select production

# Deploy
terraform apply
```

```hcl
# Use workspace in configuration
resource "aws_instance" "web" {
  instance_type = terraform.workspace == "production" ? "t3.large" : "t3.micro"

  tags = {
    Environment = terraform.workspace
  }
}
```

**Advantages:**
- Single codebase
- Easy to switch environments
- Less duplication

**Disadvantages:**
- All environments share same code
- Harder to apply different configurations
- Risk of accidental changes to wrong environment

**Approach 3: Separate Repositories**

```
infrastructure-dev/
infrastructure-staging/
infrastructure-production/
```

**Advantages:**
- Complete isolation
- Different access controls per environment
- No risk of cross-environment changes

**Disadvantages:**
- Maximum code duplication
- Hard to keep synchronized
- More repositories to manage

### Recommended Approach

**Hybrid: Directories + Separate State**

```
infrastructure/
├── modules/              # Shared modules
│   └── ...
├── environments/
│   ├── dev/
│   │   ├── backend.tf   # Dev state config
│   │   ├── main.tf      # Uses modules
│   │   └── dev.tfvars   # Dev-specific values
│   ├── staging/
│   │   ├── backend.tf
│   │   ├── main.tf
│   │   └── staging.tfvars
│   └── production/
│       ├── backend.tf
│       ├── main.tf
│       └── production.tfvars
```

**Benefits:**
- Shared modules (DRY)
- Separate state files (isolation)
- Environment-specific configurations
- Clear structure

---

## Layered Architecture

<div class="callout callout--note">
<p class="callout__title">Modules vs. Layers</p>
<p><strong>Modules</strong> = Reusable code (VPC module, RDS module)</p>
<p><strong>Layers</strong> = Deployment units that USE modules (foundation layer uses VPC module)</p>
<p>Modules are about code reuse. Layers are about deployment organization and team ownership.</p>
</div>

**What it is:** Organizing infrastructure into separate deployment layers based on ownership and change frequency.

**Purpose:** Layers are about **deployment organization and team ownership**, not code reuse (that's modules). Each layer is deployed independently and has its own state.

**Think of layers as:** Deployment units owned by different teams with different release schedules.

**How layers and modules work together:**
- **Modules** = Reusable code (VPC module, RDS module)
- **Layers** = Deployment units that USE modules (foundation layer uses VPC module)

### Why Layer?

- Faster deployments (deploy only the layer that changed, not everything)
- Reduced blast radius (change to application layer doesn't risk foundation)
- Clear dependencies (application depends on platform, platform depends on foundation)
- Easier rollbacks (rollback one layer without affecting others)
- Better team ownership (platform team owns platform layer, app teams own application layer)

### Common Layers

**Layer 1: Foundation (rarely changes, managed by platform team)**
- VPCs and core networking (subnets, routing tables, NAT gateways)
- Transit gateways and VPN connections
- Base DNS zones
- Core security groups
- Network ACLs

**Layer 2: Platform (changes occasionally, managed by platform/DevOps)**
- Shared databases and data stores (not app-specific)
- Message queues and event buses
- Container registries
- Kubernetes/ECS clusters
- Shared load balancers
- Monitoring and logging infrastructure
- Shared caching layers

**Layer 3: DevOps (changes occasionally, managed by DevOps team)**
- Source code repositories
- CI/CD pipelines
- Artifact stores
- Build agents
- Secret management infrastructure
- Deployment automation tools

**Layer 4: Application (changes frequently, managed by app teams)**
- Application-specific compute (EC2, Lambda, containers)
- Application-owned databases
- Application-specific queues/topics
- Auto-scaling configurations
- Application load balancers
- Application-specific IAM roles
- Feature flags and config

**Key principle:** Layers reflect **organizational ownership and change frequency**, not just resource types. A database might be in Platform (shared) or Application (app-owned) depending on who manages it.

### Implementation

```
infrastructure/
├── foundation/
│   ├── networking.tf
│   ├── vpc.tf
│   └── dns.tf
├── platform/
│   ├── shared-databases.tf
│   ├── message-queues.tf
│   ├── container-registry.tf
│   └── monitoring.tf
├── devops/
│   ├── pipelines.tf
│   ├── artifact-stores.tf
│   └── repositories.tf
└── applications/
    ├── webapp/
    │   ├── compute.tf
    │   ├── database.tf
    │   └── load-balancer.tf
    └── api/
        ├── lambda.tf
        └── api-gateway.tf
```

### Dependency Management

**Use outputs and data sources:**

```hcl
# Layer 1 (foundation/outputs.tf)
output "vpc_id" {
  value = aws_vpc.main.id
}

# Layer 2 (platform/main.tf)
data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "foundation/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_eks_cluster" "main" {
  vpc_config {
    subnet_ids = data.terraform_remote_state.foundation.outputs.private_subnet_ids
  }
}
```

---

## IaC Code Ownership

**The question:** Should application-specific IaC live with the application code or in a centralized infrastructure repository?

**The answer:** Hybrid approach based on layers; application teams own application layer IaC, DevOps owns foundation/platform/devops layers.

### Option 1: IaC With Application Code (Application Layer Only)

**What belongs with the app:**

```
my-payment-service/
├── src/
│   └── ... (application code)
├── Dockerfile
├── infrastructure/
│   ├── compute.tf         # Lambda/ECS/EC2 for this app
│   ├── database.tf        # App-owned database
│   ├── queue.tf           # App-specific queue
│   └── api-gateway.tf     # App-specific API Gateway
└── .github/workflows/
    └── deploy.yml         # Deploys both app and infrastructure
```

**Resources that belong here:**
- Application-specific compute (Lambda functions, ECS tasks, EC2 instances)
- Application-owned databases (not shared with other apps)
- Application-specific queues/topics
- Auto-scaling configurations
- Application load balancers
- Application-specific IAM roles

**Why this works:**
- **Deployment coupling**: App code and infrastructure change together
- **Team autonomy**: App team deploys without waiting for DevOps
- **Versioning**: Infrastructure version matches application version
- **Rollback simplicity**: Roll back app AND its infrastructure together
- **Clear ownership**: App team owns everything related to their service

**Example deployment:**

```yaml
# .github/workflows/deploy.yml
name: Deploy Payment Service

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval

    steps:
      - uses: actions/checkout@v3

      # Deploy infrastructure first
      - name: Deploy Infrastructure
        run: |
          cd infrastructure
          terraform init
          terraform apply -auto-approve
        env:
          AWS_ROLE_ARN: ${{ secrets.PAYMENTS_DEPLOYMENT_ROLE }}

      # Then deploy application
      - name: Deploy Application
        run: |
          docker build -t payments:${{ github.sha }} .
          docker push payments:${{ github.sha }}
          # Deploy to infrastructure created above
```

### Option 2: Centralized IaC Repository (Foundation, Platform, DevOps Layers)

**What stays centralized:**

```
platform-infrastructure/
├── foundation/
│   ├── networking.tf      # VPCs, subnets, routing
│   ├── dns.tf             # Route 53 zones
│   └── security-groups.tf # Base security groups
├── platform/
│   ├── shared-database.tf # Shared RDS instance
│   ├── message-bus.tf     # Shared EventBridge/SQS
│   ├── container-registry.tf  # ECR
│   └── monitoring.tf      # CloudWatch, X-Ray
└── devops/
    ├── pipelines.tf       # CodePipeline
    ├── repositories.tf    # CodeCommit
    └── artifact-stores.tf # S3 for artifacts
```

**Resources that stay centralized:**
- Foundation layer: VPCs, networking, DNS, core security groups
- Platform layer: Shared databases, message queues, container registries, monitoring
- DevOps layer: CI/CD pipelines, repositories, artifact stores

**Why centralized:**
- **Shared across applications**: Many apps use the same VPC, shared database, etc.
- **Requires deep expertise**: Network architecture, security architecture
- **High blast radius**: Changes affect all applications
- **Strict change control**: Needs architecture review and approval

### Security Controls That Make This Safe

**The concern:** "Won't app teams abuse permissions if they control IaC?"

**The answer:** No, because of multiple layers of preventive controls:

**1. IAM Permission Boundaries**

Limit what app teams can create even with their deployment role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowApplicationLayerOnly",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/layer": "application",
          "aws:RequestTag/domain": "payments"
        }
      }
    },
    {
      "Sid": "DenyFoundationChanges",
      "Effect": "Deny",
      "Action": [
        "ec2:DeleteVpc",
        "ec2:DeleteSubnet",
        "ec2:ModifyVpcAttribute",
        "ec2:DeleteRouteTable"
      ],
      "Resource": "*"
    }
  ]
}
```

**2. Service Control Policies (SCPs)**

Enforce tagging at organization level:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RequireTagsOnCreate",
      "Effect": "Deny",
      "Action": [
        "ec2:RunInstances",
        "rds:CreateDBInstance",
        "lambda:CreateFunction"
      ],
      "Resource": "*",
      "Condition": {
        "Null": {
          "aws:RequestTag/environment": "true",
          "aws:RequestTag/layer": "true",
          "aws:RequestTag/domain": "true"
        }
      }
    }
  ]
}
```

**3. CloudFormation Hooks**

Validate templates before deployment:

```yaml
RequireTagsHook:
  Type: AWS::CloudFormation::Hook
  Properties:
    TypeName: AWSSamples::RequireTags::Hook
    TargetStacks: ALL
    FailureMode: FAIL
    Properties:
      RequiredTags:
        - environment
        - layer
        - domain
```

**4. Approval Gates**

Require manual approval for production:

```yaml
environment: production
# GitHub/GitLab requires approval from designated reviewers
```

**5. AWS Config Rules**

Detect non-compliant resources after creation:

```yaml
ResourcesManagedByTeam:
  Type: AWS::Config::ConfigRule
  Properties:
    ConfigRuleName: resources-have-required-tags
    Source:
      Owner: AWS
      SourceIdentifier: REQUIRED_TAGS
    InputParameters:
      tag1Key: environment
      tag2Key: layer
      tag3Key: domain
```

### Recommended Structure

**Hybrid approach combining both:**

```
# Application repos (owned by app teams)
payment-service/
├── src/
├── infrastructure/          # Application layer only
│   ├── compute.tf
│   ├── database.tf
│   └── queue.tf
└── .github/workflows/deploy.yml

identity-service/
├── src/
├── infrastructure/          # Application layer only
│   ├── lambda.tf
│   ├── api-gateway.tf
│   └── dynamodb.tf
└── .github/workflows/deploy.yml

# Platform repo (owned by DevOps/Platform team)
platform-infrastructure/
├── foundation/              # Foundation layer
│   ├── networking.tf
│   ├── dns.tf
│   └── security-groups.tf
├── platform/                # Platform layer
│   ├── shared-database.tf
│   ├── message-bus.tf
│   └── monitoring.tf
└── devops/                  # DevOps layer
    ├── pipelines.tf
    ├── repositories.tf
    └── artifact-stores.tf
```

### Decision Matrix

Use this to decide where IaC should live:

| Question | With App Code | Centralized |
|----------|---------------|-------------|
| Used by only one application? | ✅ | ❌ |
| Shared across multiple apps? | ❌ | ✅ |
| Changes frequently with app? | ✅ | ❌ |
| Rarely changes (weeks/months)? | ❌ | ✅ |
| App team has expertise? | ✅ | ❌ |
| Requires deep infra expertise? | ❌ | ✅ |
| Blast radius = single app? | ✅ | ❌ |
| Blast radius = all apps? | ❌ | ✅ |

**Examples:**

- Lambda function for one app → **With app code**
- VPC used by all apps → **Centralized**
- App-owned DynamoDB table → **With app code**
- Shared RDS instance → **Centralized**
- Application load balancer → **With app code**
- Container registry (ECR) → **Centralized**

### Benefits of Hybrid Approach

**For application teams:**
- Deploy infrastructure and code together
- No waiting for DevOps tickets
- Full ownership of their domain
- Faster iteration cycles
- Clear responsibility boundaries

**For DevOps/Platform team:**
- Focus on shared infrastructure
- Enforce standards via guardrails
- Manage high-impact changes carefully
- Provide self-service capabilities
- Reduce ticket queue

**For the organization:**
- Faster time to market
- Clear ownership and accountability
- Reduced bottlenecks
- Standards enforced via automation
- Auditability (all changes in Git)

---

## GitOps Workflow

**What it is:** Using Git as the single source of truth for infrastructure state and changes.

### Core Principles

1. **Declarative:** Infrastructure defined declaratively
2. **Versioned:** All changes in Git
3. **Immutable:** Don't modify running infrastructure directly
4. **Automated:** Changes automatically applied from Git
5. **Auditable:** Full history in Git

### Workflow

```
Developer
    ↓
Create branch
    ↓
Make changes to IaC
    ↓
Commit and push
    ↓
Create Pull Request
    ↓
Automated checks (lint, validate, plan)
    ↓
Code Review
    ↓
Merge to main
    ↓
CI/CD Pipeline
    ↓
Automated deployment
    ↓
Infrastructure Updated
```

### Implementation

**CI/CD Pipeline Stages:**

**On Pull Request:**
1. Checkout code
2. Initialize IaC tool
3. Validate syntax
4. Generate plan
5. Comment plan output on PR for review
6. Run security/compliance scans

**On Merge to Main:**
1. Checkout code
2. Initialize IaC tool
3. Generate plan (verify it matches approved PR plan)
4. Require approval gate for production changes
5. Apply infrastructure changes
6. Report results

**Key implementation considerations:**
- Trigger pipelines only when infrastructure code changes
- Use separate jobs for plan vs. apply (plan runs on PR, apply runs on merge)
- Store IaC tool state remotely, not in pipeline
- Use environment protection rules for production deployments
- Implement approval gates before applying to sensitive environments

### Benefits

**Audit Trail:**
- Every change tracked in Git
- Who made what change and when
- Easy to see change history

**Easy Rollback:**
- Revert Git commits to previous infrastructure version
- Push the revert commit
- CI/CD automatically applies the rollback
- Full audit trail of what was rolled back and why

**Collaborative:**
- Code review process enforced
- Knowledge sharing through PRs
- Documentation in commit messages

### Tools

**[Atlantis](https://www.runatlantis.io/){:target="_blank" rel="noopener noreferrer"}:**
- Terraform automation via pull requests
- Plan on PR, apply on merge
- Locks to prevent conflicts
- Self-hosted GitOps for Terraform

**[Flux](https://fluxcd.io/){:target="_blank" rel="noopener noreferrer"} / [ArgoCD](https://argo-cd.readthedocs.io/){:target="_blank" rel="noopener noreferrer"}:**
- GitOps for Kubernetes
- Continuous deployment from Git
- Automatic drift detection and reconciliation

---

## Best Practices

### Code Organization

**1. Consistent Structure**
```
infrastructure/
├── README.md
├── .gitignore
├── modules/
├── environments/
└── scripts/
```

**2. Naming Conventions**
```hcl
# Resources: <project>-<environment>-<resource>
resource "aws_s3_bucket" "data" {
  bucket = "myapp-prod-s3-data"
}

# Variables: lowercase with underscores
variable "instance_type" {
  type = string
}
```

**3. DRY (Don't Repeat Yourself)**
- Use modules for repeated patterns
- Use variables for environment differences
- Use locals for computed values

**4. Documentation**
- README in each directory
- Comments for complex logic
- Variable descriptions
- Output descriptions

### Change Management

**1. Always Review Changes**
- Use `terraform plan` before `apply`
- Review plan output carefully
- Use change sets (CloudFormation)

**2. Small, Incremental Changes**
- One logical change per PR
- Easier to review and test
- Simpler to roll back

**3. Automated Testing**
- Lint on every commit
- Validate on every PR
- Integration tests before production

**4. Approval Gates**
```yaml
# Require manual approval for production
environment: production
```

### Version Control

**What to commit:**
- ✅ Infrastructure code
- ✅ Module definitions
- ✅ Documentation
- ✅ Scripts

**What NOT to commit:**
- ❌ State files
- ❌ Sensitive values (.tfvars with secrets)
- ❌ .terraform/ directory
- ❌ Provider plugins

**.gitignore:**
```
# Terraform
**/.terraform/*
*.tfstate
*.tfstate.*
crash.log
*.tfvars  # Or be selective
.terraform.lock.hcl

# Sensitive
*.pem
*.key
secrets.yaml
```

---

