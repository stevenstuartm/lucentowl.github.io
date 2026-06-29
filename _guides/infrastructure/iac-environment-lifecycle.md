---
title: "IaC Environment Lifecycle Patterns"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Managing environment recreation, resource discovery, and handling mutable vs. immutable identifiers when recreating infrastructure."
tags: [infrastructure, iac, environments, lifecycle, practical]
---

## The Core Challenge

When recreating environments (especially dev/test), many resources generate dynamic identifiers that other resources depend on.

### The Problem

**Resources generate unique identifiers each time:**
- RDS endpoint: `mydb.abc123.us-east-1.rds.amazonaws.com` → `mydb.xyz789.us-east-1.rds.amazonaws.com`
- ElastiCache configuration endpoints change
- Load balancer DNS names change
- Resource ARNs include unique identifiers

**Consumers need stable references:**
- Application configuration
- IAM policies
- Parameter Store values
- Security group rules
- DNS records

### The Solution: Indirection

**Three patterns for stable references to changing resources:**

**1. DNS Abstraction**

Stable DNS name points to dynamic endpoint:

```hcl
# DNS record updates automatically when resource recreated
resource "aws_route53_record" "db" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "db.${var.environment}.internal.example.com"
  type    = "CNAME"
  ttl     = 60
  records = [aws_db_instance.main.address]
}

# Application always uses: db.dev.internal.example.com
```

**2. Parameter Store**

Store dynamic values in centralized configuration:

```hcl
resource "aws_ssm_parameter" "db_endpoint" {
  name  = "/${var.environment}/database/endpoint"
  type  = "String"
  value = aws_db_instance.main.endpoint
}
```

Application reads at startup:

```csharp
var ssmClient = new AmazonSimpleSystemsManagementClient();
var dbEndpoint = await ssmClient.GetParameterAsync(
    new GetParameterRequest { Name = $"/{environment}/database/endpoint" }
);
```

**3. Service Discovery**

AWS Cloud Map for microservices:

```hcl
resource "aws_service_discovery_instance" "db" {
  instance_id = aws_db_instance.main.id
  service_id  = aws_service_discovery_service.database.id

  attributes = {
    AWS_INSTANCE_CNAME = aws_db_instance.main.endpoint
  }
}
```

---

## Resource Discovery Patterns

### DNS Abstraction (Recommended for Most Cases)

**Setup once per environment:**

```hcl
# Private hosted zone
resource "aws_route53_zone" "internal" {
  name = "${var.environment}.internal.example.com"
  vpc { vpc_id = aws_vpc.main.id }
}

# Stable DNS for database
resource "aws_route53_record" "database" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "db.${var.environment}.internal.example.com"
  type    = "CNAME"
  ttl     = 60
  records = [aws_db_instance.main.address]
}

# Stable DNS for cache
resource "aws_route53_record" "cache" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "cache.${var.environment}.internal.example.com"
  type    = "CNAME"
  ttl     = 60
  records = [aws_elasticache_cluster.main.configuration_endpoint]
}
```

**Application configuration:**

```json
{
  "ConnectionStrings": {
    "Database": "Server=db.dev.internal.example.com;Database=app;...",
    "Cache": "cache.dev.internal.example.com:6379"
  }
}
```

**Benefits:**
- Universal compatibility
- Low TTL enables fast updates
- No code changes when infrastructure recreated

### Parameter Store for Complex Configuration

**Hierarchical organization:**

```
/{environment}/{service}/{key}

/dev/database/endpoint
/dev/database/port
/dev/cache/endpoint
/global/region
```

**Write from infrastructure:**

```hcl
resource "aws_ssm_parameter" "db_endpoint" {
  name  = "/${var.environment}/database/endpoint"
  type  = "String"
  value = aws_db_instance.main.endpoint
}

resource "aws_ssm_parameter" "cache_endpoint" {
  name  = "/${var.environment}/cache/config-endpoint"
  type  = "String"
  value = aws_elasticache_replication_group.main.configuration_endpoint_address
}
```

**Read from application:**

```csharp
public async Task<Dictionary<string, string>> GetConfigAsync(string service)
{
    var request = new GetParametersByPathRequest
    {
        Path = $"/{_environment}/{service}/",
        Recursive = true,
        WithDecryption = true
    };

    var response = await _ssmClient.GetParametersByPathAsync(request);

    return response.Parameters.ToDictionary(
        p => p.Name.Split('/').Last(),
        p => p.Value
    );
}
```

**Combine with Secrets Manager:**

```hcl
# Secret in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.environment}/database/password"
}

# Store ARN in Parameter Store for discovery
resource "aws_ssm_parameter" "db_password_arn" {
  name  = "/${var.environment}/database/password-secret-arn"
  type  = "String"
  value = aws_secretsmanager_secret.db_password.arn
}
```

### Choosing a Pattern

| Use Case | Pattern |
|----------|---------|
| Database endpoints | DNS (simple) or RDS Proxy (production) |
| Cache clusters | DNS + Parameter Store |
| Complex config (multiple values) | Parameter Store |
| Microservices | Service Discovery |
| Simple references | DNS |
| Mix of static/dynamic config | Parameter Store hierarchy |

---

## Layered Lifecycle Management

Different infrastructure layers have different recreation frequencies.

<div class="callout callout--tip">
<p class="callout__title">Separation Principle</p>
<p>Separate infrastructure by change frequency. Fast-changing application code should not live in the same state file as slow-changing networking infrastructure. This reduces blast radius and speeds up deployments.</p>
</div>

### Layer Definitions

**Foundation Layer (Weeks to Months)**
- VPCs, subnets, routing
- NAT gateways, VPN connections
- Base security groups
- Route53 zones

**Data Layer (Days to Weeks)**
- RDS instances
- ElastiCache clusters
- S3 buckets
- Message queues

**Application Layer (Hours to Days)**
- ECS services, Lambda functions
- Application load balancers
- Auto-scaling groups
- IAM roles for applications

### Implementation

**Separate state files:**

```
infrastructure/
├── foundation/
│   ├── backend.tf     # State: foundation/terraform.tfstate
│   ├── vpc.tf
│   └── dns.tf
├── data/
│   ├── backend.tf     # State: data/terraform.tfstate
│   ├── rds.tf
│   └── elasticache.tf
└── application/
    ├── backend.tf     # State: application/terraform.tfstate
    ├── ecs-service.tf
    └── lambda.tf
```

**Cross-layer references:**

```hcl
# data/main.tf - reads from foundation
data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "${var.environment}/foundation/terraform.tfstate"
  }
}

resource "aws_db_subnet_group" "main" {
  subnet_ids = data.terraform_remote_state.foundation.outputs.database_subnet_ids
}

# Write endpoint to Parameter Store for application discovery
resource "aws_ssm_parameter" "db_endpoint" {
  name  = "/${var.environment}/database/endpoint"
  value = aws_db_instance.main.endpoint
}
```

**Application discovers via Parameter Store:**

```hcl
# application/main.tf - no direct Terraform dependency on data layer
# App reads from Parameter Store at runtime instead
```

### Benefits

**Faster iteration:**
- Deploy only the layer that changed (application: ~2 minutes)
- No need to wait for unchanged layers (data, foundation)
- Much faster than deploying all layers together (~20+ minutes)

**Reduced blast radius:**
- Application layer changes don't risk data layer resources
- Can destroy and recreate application layer without affecting databases
- Data remains intact during application experimentation

**Independent ownership:**
- Platform team: Foundation + Data
- Application teams: Application layer

---

## Circular Dependency Resolution

<div class="callout callout--warning">
<p class="callout__title">Common Gotcha</p>
<p>Circular dependencies are one of the most common IaC deployment failures. The fix is almost always the same: separate resource creation from rule/policy attachment.</p>
</div>

### Common Scenarios

**Security Groups Referencing Each Other**

```hcl
# ❌ Circular dependency
resource "aws_security_group" "app" {
  ingress {
    security_groups = [aws_security_group.db.id]
  }
}

resource "aws_security_group" "db" {
  ingress {
    security_groups = [aws_security_group.app.id]  # Circular!
  }
}
```

**Solution: Separate rules from groups**

```hcl
# ✅ Create groups first
resource "aws_security_group" "app" {
  name = "app-sg"
}

resource "aws_security_group" "db" {
  name = "db-sg"
}

# Then create rules separately
resource "aws_security_group_rule" "app_to_db" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.app.id
  source_security_group_id = aws_security_group.db.id
}

resource "aws_security_group_rule" "db_from_app" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = aws_security_group.app.id
}
```

**IAM Policies Need Resource ARNs Before Resources Exist**

```hcl
# ✅ Use wildcard patterns
resource "aws_iam_role_policy" "lambda_s3" {
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Statement = [{
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "arn:aws:s3:::${var.environment}-app-*/*"  # Pattern
    }]
  })
}

# Bucket name matches pattern
resource "aws_s3_bucket" "data" {
  bucket = "${var.environment}-app-data-${random_id.suffix.hex}"
}
```

**Alternative: Tag-based policies**

```hcl
resource "aws_iam_policy" "app_s3_access" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "*"
      Condition = {
        StringEquals = {
          "s3:ExistingObjectTag/Environment" = var.environment
          "s3:ExistingObjectTag/Application" = "myapp"
        }
      }
    }]
  })
}
```

### Resolution Strategies

| Strategy | When to Use |
|----------|-------------|
| Wildcard patterns | Resource names follow predictable convention |
| Separate rules from resources | Security groups, network ACLs |
| Tag-based policies | Multiple resources with shared access patterns |
| Two-pass deployment | Complex dependencies unavoidable |

---

## Dev Environment Strategies

### Strategy 1: Shared Data Layer

**Structure:**

```
Shared (persistent):
- VPC, subnets
- RDS (dev-shared-db)
- ElastiCache (dev-shared-cache)

Per-developer (ephemeral):
- ECS services (dev-alice-app)
- Lambda functions
- Load balancers
```

**Implementation:**

```hcl
# Shared data (created once, persistent)
resource "aws_db_instance" "shared_dev" {
  identifier = "dev-shared-db"
}

resource "aws_ssm_parameter" "shared_db_endpoint" {
  name  = "/dev-shared/database/endpoint"
  value = aws_db_instance.shared_dev.endpoint
}

# Per-developer app (created/destroyed frequently)
variable "developer_name" {}

resource "aws_ecs_service" "app" {
  name = "dev-${var.developer_name}-app"
  # Reads: /dev-shared/database/endpoint
}
```

**Workflow:**

Developers create/destroy only their application layer:
1. Create workspace or use separate state for their environment
2. Deploy with developer-specific variables (e.g., developer_name=alice)
3. Application connects to shared data resources
4. Can destroy application infrastructure without losing data
5. Redeploy application layer and reconnects to same shared database

**Best for:** Cost-effective, fast iteration, stable schema

### Strategy 2: Dedicated Environments

**Structure:**

```
Per-developer (complete isolation):
- RDS (dev-alice-db)
- ElastiCache (dev-alice-cache)
- All application resources
```

**Implementation:**

```hcl
variable "developer_name" {}

locals {
  environment = "dev-${var.developer_name}"
}

resource "aws_db_instance" "db" {
  identifier = "${local.environment}-db"
  instance_class = "db.t3.micro"  # Small for dev
}

resource "aws_route53_record" "db" {
  name    = "db.${local.environment}.internal"
  records = [aws_db_instance.db.endpoint]
}
```

**Cost management:**

```hcl
# Tag resources for automated stop/start
resource "aws_db_instance" "db" {
  tags = {
    Schedule = "dev-business-hours"  # Stop at 6 PM, start at 8 AM
  }
}
```

**Best for:** Schema changes, complete isolation, production parity

### Strategy 3: Hybrid

**Structure:**

```
Shared foundation:
- VPC, NAT gateways

Per-developer:
- RDS (small instance)
- ElastiCache (minimal)
- Application resources

Shared with isolation:
- S3 (shared bucket, isolated prefixes)
```

**Implementation:**

```hcl
# Foundation layer (shared)
resource "aws_vpc" "dev" {
  cidr_block = "10.0.0.0/16"
}

# Per-developer data layer
resource "aws_db_instance" "db" {
  identifier               = "dev-${var.developer_name}-db"
  db_subnet_group_name     = data.terraform_remote_state.foundation.outputs.db_subnet_group_name
}

# S3 with prefix isolation
resource "aws_ssm_parameter" "data_prefix" {
  name  = "/dev-${var.developer_name}/s3/data-prefix"
  value = "developers/${var.developer_name}/"
}
```

**Application scopes to prefix:**

```csharp
var prefix = await GetParameter($"/{environment}/s3/data-prefix");
var key = $"{prefix}my-file.json";  // developers/alice/my-file.json
```

**Best for:** Many developers, balanced cost and isolation

### Choosing a Strategy

| Scenario | Recommendation |
|----------|---------------|
| Tight budget, stable schema | Shared data layer |
| Frequent schema changes | Dedicated environments |
| Many developers (10+) | Hybrid |
| Short-lived feature branches | Dedicated (ephemeral) |
| Production parity required | Dedicated |
| Rapid app iteration | Shared data layer |

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Shared Data Layer</h4>
<ul>
<li><strong>Cost:</strong> Lowest; one database for all devs</li>
<li><strong>Setup:</strong> Simple; deploy once</li>
<li><strong>Isolation:</strong> Low; shared resources</li>
<li><strong>Schema Changes:</strong> Difficult; affects everyone</li>
<li><strong>Best for:</strong> Stable schemas, tight budgets</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Dedicated Environments</h4>
<ul>
<li><strong>Cost:</strong> Higher; per-developer resources</li>
<li><strong>Setup:</strong> Complex; automate everything</li>
<li><strong>Isolation:</strong> Complete; full separation</li>
<li><strong>Schema Changes:</strong> Easy; isolated testing</li>
<li><strong>Best for:</strong> Schema changes, production parity</li>
</ul>
</div>
</div>

---

## Key Takeaways

**Use indirection for resource discovery:**
- DNS provides stable names for dynamic endpoints
- Parameter Store centralizes configuration
- Application code never contains infrastructure-specific identifiers

**Layer infrastructure by change frequency:**
- Separate state files per layer (foundation, data, application)
- Recreate only what changes
- Reduced blast radius and faster iteration

**Handle circular dependencies proactively:**
- Wildcard patterns in IAM policies
- Separate resource creation from rule association
- Tag-based policies for flexible access control

**Choose dev environment strategy based on needs:**
- Shared data: Fast, cost-effective
- Dedicated: Isolated, safe experimentation
- Hybrid: Balanced approach
