---
title: "AWS ECR & Container Security for System Architects"
layout: guide
category: AWS
subcategory: Container Orchestration (Advanced)
description: "Comprehensive guide to AWS Elastic Container Registry and container security covering image scanning, lifecycle policies, replication, runtime security, and secrets management"
tags: [aws, containers, security, docker, kubernetes, devops, infrastructure, practical]
---

## What Problems ECR & Container Security Solve

**Container registries and security address critical production challenges**:

**Image Distribution Challenges**:
- **Slow deployments**: Pulling images from external registries (Docker Hub) over the internet adds latency, especially for multi-GB images
- **Rate limiting**: Docker Hub free tier limits to 100 pulls per 6 hours from anonymous IPs, 200 pulls for authenticated users - production deployments can exhaust this quickly
- **Supply chain risk**: External registries introduce dependency on third-party availability; Docker Hub outages have blocked production deployments
- **Network costs**: Pulling images from internet sources incurs data transfer charges ($0.09/GB from AWS to internet)

**Security & Compliance Challenges**:
- **Vulnerability management**: Without scanning, vulnerabilities in base images and dependencies go undetected until runtime exploitation
- **Image provenance**: Cannot verify image authenticity or track who built what image when
- **Secrets exposure**: Hardcoded credentials in images or passed via environment variables create security risks
- **Compliance requirements**: Regulations (PCI-DSS, HIPAA, SOC 2) require vulnerability scanning, image signing, and audit trails

**Operational Challenges**:
- **Image sprawl**: Old, unused images accumulate, consuming storage and complicating security scanning
- **Multi-region deployments**: Deploying globally requires image availability in multiple regions; pulling cross-region adds latency and cost
- **Access control**: Fine-grained control over who can push/pull which images across teams and environments

**ECR and container security solve these problems**:

1. **AWS ECR (Elastic Container Registry)**: Fully managed Docker registry with native AWS integration
2. **Image Scanning**: Automated vulnerability detection in container images
3. **Lifecycle Policies**: Automated cleanup of old images based on age or count
4. **Replication**: Cross-region and cross-account image distribution
5. **Runtime Security**: Protection against container escape, lateral movement, and runtime threats
6. **Secrets Management**: Secure injection of credentials into containers without hardcoding

## ECR Fundamentals

### ECR Architecture

**Registry hierarchy**:
- **Registry**: AWS account-specific registry (e.g., `123456789012.dkr.ecr.us-east-1.amazonaws.com`)
- **Repository**: Named collection of related images (e.g., `my-app/backend`)
- **Image**: Specific version identified by tag or digest (e.g., `my-app/backend:v1.2.3` or `sha256:abc123...`)

**Key characteristics**:
- **Regional service**: Each region has separate ECR endpoint (replicate for multi-region)
- **Private by default**: Requires IAM authentication to push/pull (no public access like Docker Hub)
- **Public option**: ECR Public for open-source projects (public.ecr.aws/... namespace)
- **OCI-compliant**: Supports Docker images and OCI (Open Container Initiative) artifacts

### Authentication & Access Control

**Docker authentication**:

```bash
# Get login token (valid 12 hours)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Push image
docker tag my-app:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
```

**IAM policies for ECR**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "arn:aws:ecr:us-east-1:123456789012:repository/my-app"
    }
  ]
}
```

**Push permissions** (for CI/CD):

```json
{
  "Effect": "Allow",
  "Action": [
    "ecr:PutImage",
    "ecr:InitiateLayerUpload",
    "ecr:UploadLayerPart",
    "ecr:CompleteLayerUpload"
  ],
  "Resource": "arn:aws:ecr:us-east-1:123456789012:repository/my-app"
}
```

**Repository policies** (cross-account access):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPull",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::999999999999:root"
      },
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ]
    }
  ]
}
```

### Tagging Strategies

**Effective tagging practices**:

1. **Semantic versioning** (production releases):
   - `my-app:1.2.3` (immutable release)
   - `my-app:1.2` (minor version alias, updated on patch releases)
   - `my-app:1` (major version alias)
   - `my-app:latest` (points to latest stable release)

2. **Git-based tags** (CI/CD):
   - `my-app:main-abc123f` (branch + short commit SHA)
   - `my-app:pr-456` (pull request number)
   - `my-app:build-789` (build number)

3. **Environment tags** (deployment tracking):
   - `my-app:staging-2024-11-15` (environment + date)
   - `my-app:prod-current` (currently deployed to production)

**Tag immutability**:

```bash
# Enable immutable tags (prevents overwriting tags)
aws ecr put-image-tag-mutability \
  --repository-name my-app \
  --image-tag-mutability IMMUTABLE
```

**Why immutability matters**: Prevents accidental overwrites of `latest` tag mid-deployment, ensures reproducible builds, and provides clear audit trail.

## Image Scanning & Vulnerability Management

### Scanning Types

**ECR offers two scanning options**:

1. **Basic scanning** (Amazon ECR with Clair):
   - Uses open-source Clair scanner
   - Scans on push or on-demand
   - Limited to OS package vulnerabilities (not application dependencies)
   - Free (included in ECR pricing)

2. **Enhanced scanning** (Amazon Inspector integration):
   - Continuous scanning (rescans as new CVEs discovered)
   - OS packages AND application dependencies (Java, Python, Node.js, .NET, Go, Ruby)
   - CVSS scores, exploitability data, remediation guidance
   - $0.09 per image scan (first scan per image per repo per month)

### Enabling Enhanced Scanning

```bash
# Enable enhanced scanning for repository
aws ecr put-image-scanning-configuration \
  --repository-name my-app \
  --image-scanning-configuration scanOnPush=true

# Enable Inspector enhanced scanning (registry-wide)
aws ecr put-registry-scanning-configuration \
  --scan-type ENHANCED \
  --rules '[
    {
      "scanFrequency": "CONTINUOUS_SCAN",
      "repositoryFilters": [{"filter": "*", "filterType": "WILDCARD"}]
    }
  ]'
```

### Interpreting Scan Results

**Findings structure**:

```json
{
  "findings": [
    {
      "name": "CVE-2024-1234",
      "severity": "HIGH",
      "packageName": "openssl",
      "packageVersion": "1.1.1k",
      "fixedInVersion": "1.1.1m",
      "cvss": {
        "score": 7.5,
        "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "exploitAvailable": false,
      "description": "OpenSSL denial of service vulnerability..."
    }
  ]
}
```

**Severity interpretation**:
- **CRITICAL** (CVSS 9.0-10.0): Remote code execution, privilege escalation - block deployment
- **HIGH** (CVSS 7.0-8.9): High-impact vulnerabilities - require remediation plan
- **MEDIUM** (CVSS 4.0-6.9): Moderate risk - address in next sprint
- **LOW** (CVSS 0.1-3.9): Minimal risk - address during maintenance windows
- **INFORMATIONAL**: Not a vulnerability, but security best practice recommendation

### Vulnerability Management Workflow

**1. Scan on push (CI/CD integration)**:

```yaml
# GitHub Actions example
- name: Build and scan image
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

- name: Wait for scan results
  run: |
    aws ecr wait image-scan-complete \
      --repository-name $ECR_REPOSITORY \
      --image-id imageTag=$IMAGE_TAG

- name: Get scan findings
  run: |
    aws ecr describe-image-scan-findings \
      --repository-name $ECR_REPOSITORY \
      --image-id imageTag=$IMAGE_TAG \
      --query 'imageScanFindings.findingSeverityCounts'
```

**2. Policy enforcement** (fail builds on critical findings):

```bash
#!/bin/bash
# fail-on-critical.sh

CRITICAL_COUNT=$(aws ecr describe-image-scan-findings \
  --repository-name my-app \
  --image-id imageTag=latest \
  --query 'imageScanFindings.findingSeverityCounts.CRITICAL' \
  --output text)

if [ "$CRITICAL_COUNT" != "None" ] && [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo "❌ Found $CRITICAL_COUNT critical vulnerabilities. Blocking deployment."
  exit 1
fi

echo "✅ No critical vulnerabilities found. Proceeding."
```

**3. Remediation workflow**:

```dockerfile
# Before (vulnerable base image)
FROM node:16.14.0

# After (patched base image)
FROM node:16.19.1  # Updated to patch CVE-2024-1234
```

**4. Exception handling** (for false positives):

```json
{
  "suppressions": [
    {
      "cve": "CVE-2024-5678",
      "reason": "False positive - package not used in production code path",
      "approvedBy": "security-team@company.com",
      "expiresAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Continuous Scanning

**Why continuous scanning matters**:
- **New CVEs discovered daily**: Zero-day vulnerabilities announced after image built
- **Aging images**: Images deployed months ago may accumulate vulnerabilities
- **Compliance**: Regulations require ongoing vulnerability management, not just point-in-time

**Continuous scan configuration**:

```bash
# Configure continuous scanning for critical repositories
aws ecr put-registry-scanning-configuration \
  --scan-type ENHANCED \
  --rules '[
    {
      "scanFrequency": "CONTINUOUS_SCAN",
      "repositoryFilters": [
        {"filter": "prod-*", "filterType": "WILDCARD"}
      ]
    },
    {
      "scanFrequency": "SCAN_ON_PUSH",
      "repositoryFilters": [
        {"filter": "*", "filterType": "WILDCARD"}
      ]
    }
  ]'
```

**Cost consideration**: Continuous scanning rescans images when new CVE data available. With enhanced scanning at $0.09 per scan, a repository with 100 active images might cost $9/month if each rescanned once. Budget accordingly.

## Lifecycle Policies & Image Management

### Why Lifecycle Policies Matter

**Image sprawl consequences**:
- **Storage costs**: ECR charges $0.10/GB/month. A 2GB image with 50 old tags = $10/month wasted
- **Scan costs**: Enhanced scanning scans all images (including unused ones) = $0.09 × 50 = $4.50/month
- **Security noise**: Vulnerability findings in unused images distract from real risks
- **Operational overhead**: Developers scroll through hundreds of old tags to find the right one

**Lifecycle policies automate cleanup**:

### Lifecycle Policy Rules

**Rule types**:

1. **Count-based** (keep last N images):
   - Keep last 10 images tagged with "prod-*"
   - Keep last 100 images overall

2. **Age-based** (expire after X days):
   - Delete images older than 30 days
   - Delete untagged images older than 1 day

**Rule priority**: Rules evaluated in priority order (1 = highest). First matching rule applies.

### Example Lifecycle Policies

**Policy 1: Keep production images, clean up dev**:

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 production images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["prod-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Keep last 5 staging images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["staging-"],
        "countType": "imageCountMoreThan",
        "countNumber": 5
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 3,
      "description": "Expire dev images older than 14 days",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["dev-", "feature-"],
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 14
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 4,
      "description": "Delete untagged images after 1 day",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

**Applying the policy**:

```bash
aws ecr put-lifecycle-policy \
  --repository-name my-app \
  --lifecycle-policy-text file://lifecycle-policy.json
```

**Testing before applying** (dry run):

```bash
# Preview what would be deleted
aws ecr preview-lifecycle-policy \
  --repository-name my-app \
  --lifecycle-policy-text file://lifecycle-policy.json
```

**Policy 2: Semantic versioning retention**:

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep all semantic version tags (1.2.3)",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v", "[0-9]"],
        "countType": "imageCountMoreThan",
        "countNumber": 999999
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Keep last 20 branch builds",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["main-", "develop-"],
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

### Lifecycle Policy Best Practices

**Tag strategy alignment**:
- Use consistent tag prefixes (`prod-`, `staging-`, `dev-`)
- Separate release tags (semantic versions) from build tags (commit SHAs)
- Never delete semantic version releases (keep indefinitely for rollback)

**Testing strategy**:
- Always run `preview-lifecycle-policy` before applying
- Start conservative (keep more images), tighten gradually
- Monitor deleted images for 30 days to catch unintended cleanup

**Cost-benefit analysis**:
- Calculate storage saved: (deleted images × avg size × $0.10/GB/month)
- Calculate scan costs saved: (deleted images × rescan frequency × $0.09)
- Example: Deleting 50 × 2GB images saves $10/month storage + potential scan costs

## ECR Replication

### Why Replication Matters

**Multi-region deployments**:
- **Latency**: ECS in `us-west-2` pulling from ECR in `us-east-1` adds ~60ms per layer pull
- **Cross-region data transfer**: $0.02/GB from `us-east-1` to `us-west-2` (for 5GB image = $0.10 per pull)
- **Availability**: Regional ECR outage blocks deployments if images not replicated
- **Compliance**: Data residency requirements (GDPR, data sovereignty) may require in-region images

**Cross-account deployments**:
- **Centralized CI/CD**: Build in central account, deploy to workload accounts
- **Multi-tenant architectures**: Different customer accounts need same images
- **Security isolation**: Prevent production accounts from pushing images (only pull)

### Replication Configuration

**Cross-region replication**:

```json
{
  "rules": [
    {
      "destinations": [
        {
          "region": "us-west-2",
          "registryId": "123456789012"
        },
        {
          "region": "eu-west-1",
          "registryId": "123456789012"
        }
      ],
      "repositoryFilters": [
        {
          "filter": "prod-*",
          "filterType": "PREFIX_MATCH"
        }
      ]
    }
  ]
}
```

```bash
aws ecr put-replication-configuration \
  --replication-configuration file://replication-config.json
```

**Cross-account replication**:

```json
{
  "rules": [
    {
      "destinations": [
        {
          "region": "us-east-1",
          "registryId": "999999999999"
        }
      ],
      "repositoryFilters": [
        {
          "filter": "*",
          "filterType": "PREFIX_MATCH"
        }
      ]
    }
  ]
}
```

**Destination account policy** (allow replication):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReplication",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecr.amazonaws.com"
      },
      "Action": [
        "ecr:CreateRepository",
        "ecr:ReplicateImage"
      ],
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "123456789012"
        }
      }
    }
  ]
}
```

### Replication Behavior

**Key characteristics**:
- **Automatic**: Replication triggers on image push to source repository
- **Asynchronous**: Images replicate within minutes (not instant)
- **Filter-based**: Only images matching filters replicate (reduce costs)
- **Repository creation**: ECR automatically creates destination repositories if they don't exist
- **Tag preservation**: Tags and manifests replicated exactly

**Replication costs**:
- **Data transfer**: $0.02/GB cross-region within US (varies by region pair)
- **Storage**: Pay for storage in each region ($0.10/GB/month per region)
- **No replication fee**: ECR doesn't charge for replication itself (only data transfer + storage)

**Example cost**:
- 10 images × 2GB each = 20GB
- Replicate from `us-east-1` to `us-west-2`: 20GB × $0.02 = $0.40 one-time
- Store in both regions: 20GB × $0.10 × 2 regions = $4/month

## Runtime Security

### Container Runtime Threats

**Common runtime attack vectors**:

1. **Container escape**:
   - Exploiting kernel vulnerabilities to break out of container namespace
   - Accessing host filesystem via misconfigured volume mounts
   - Example: `docker run -v /:/host` mounts entire host filesystem

2. **Privilege escalation**:
   - Running containers as root unnecessarily
   - Granting excessive capabilities (e.g., `CAP_SYS_ADMIN`)
   - Example: Container with `privileged: true` has full host access

3. **Lateral movement**:
   - Compromised container scanning internal network
   - Exploiting vulnerable services on other containers/hosts
   - Example: Container with overly permissive security group accessing internal databases

4. **Data exfiltration**:
   - Malicious code sending sensitive data to external endpoints
   - Example: Compromised web app container uploading customer data to attacker-controlled S3 bucket

### Runtime Security Best Practices

**1. Use minimal base images**:

```dockerfile
# ❌ Bad: Full OS image (1.2GB, hundreds of packages)
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y python3 python3-pip

# ✅ Good: Distroless image (50MB, minimal attack surface)
FROM python:3.11-slim
# Even better: gcr.io/distroless/python3-debian12
```

**Why distroless**:
- No shell (prevents reverse shell attacks)
- No package manager (can't install malicious tools)
- Minimal libraries (reduces vulnerability count from 500+ to <50)

**2. Run as non-root user**:

```dockerfile
# Create non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Copy files owned by appuser
COPY --chown=appuser:appuser . /app
WORKDIR /app
```

**ECS task definition**:

```json
{
  "containerDefinitions": [
    {
      "name": "my-app",
      "user": "1000",
      "readonlyRootFilesystem": true
    }
  ]
}
```

**3. Drop unnecessary capabilities**:

```json
{
  "containerDefinitions": [
    {
      "name": "my-app",
      "linuxParameters": {
        "capabilities": {
          "drop": ["ALL"],
          "add": ["NET_BIND_SERVICE"]
        }
      }
    }
  ]
}
```

**4. Enable read-only root filesystem**:

```json
{
  "containerDefinitions": [
    {
      "name": "my-app",
      "readonlyRootFilesystem": true,
      "mountPoints": [
        {
          "sourceVolume": "tmp",
          "containerPath": "/tmp"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "tmp",
      "host": {}
    }
  ]
}
```

**5. Network segmentation**:

```json
{
  "taskDefinition": {
    "networkMode": "awsvpc"
  },
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "securityGroups": ["sg-app-only"],
      "subnets": ["subnet-private-1a"]
    }
  }
}
```

**Security group principle of least privilege**:
- **Inbound**: Only ALB security group on port 8080
- **Outbound**: Only database security group on port 5432, HTTPS to internet for external APIs

### Runtime Detection & Response

**AWS GuardDuty for ECS/EKS**:

GuardDuty Runtime Monitoring detects:
- Suspicious process execution (e.g., shell spawned in container)
- Unexpected network connections (e.g., connection to known C2 server)
- File system access anomalies (e.g., reading /etc/shadow)
- Privilege escalation attempts

**Enabling GuardDuty Runtime Monitoring**:

```bash
aws guardduty create-detector --enable --finding-publishing-frequency FIFTEEN_MINUTES

aws guardduty update-detector \
  --detector-id <detector-id> \
  --features '[
    {
      "Name": "ECS_RUNTIME_MONITORING",
      "Status": "ENABLED",
      "AdditionalConfiguration": [
        {
          "Name": "ECS_FARGATE_AGENT_MANAGEMENT",
          "Status": "ENABLED"
        }
      ]
    }
  ]'
```

**Fargate runtime monitoring** (automatic agent injection):
- GuardDuty automatically injects security agent sidecar into Fargate tasks
- No code changes required (enable via detector configuration)
- Agent monitors process, network, and file system activity

**EC2-based ECS/EKS** (manual agent installation):

```bash
# Install GuardDuty agent via SSM
aws ssm send-command \
  --document-name "AWS-ConfigureAWSPackage" \
  --targets "Key=tag:Environment,Values=production" \
  --parameters '{"action":["Install"],"name":["AmazonGuardDutyAgent"]}'
```

## Secrets Management for Containers

### Why Secrets Management Matters

**Common anti-patterns**:

1. **Hardcoded in Dockerfile**:
```dockerfile
# ❌ NEVER DO THIS
ENV DATABASE_PASSWORD=supersecret123
```
- Credentials in image layers (visible to anyone with pull access)
- Exposed in `docker history` and ECR
- Credentials can't rotate without rebuilding image

2. **Passed via environment variables**:
```bash
# ❌ Risky: Visible in process list, logs, crash dumps
docker run -e DATABASE_PASSWORD=supersecret123 my-app
```
- Visible in `docker inspect`
- Logged by orchestrators (ECS task events, Kubernetes events)
- Leaked in application logs if printed

3. **Stored in config files**:
```yaml
# ❌ Bad: Config file baked into image
database:
  password: supersecret123
```
- Same issues as hardcoding in Dockerfile

### AWS Secrets Manager Integration

**Store secrets in Secrets Manager**:

```bash
aws secretsmanager create-secret \
  --name prod/myapp/database \
  --secret-string '{
    "username": "admin",
    "password": "randomly-generated-password-here",
    "host": "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "dbname": "production"
  }'
```

**ECS task definition** (inject at runtime):

```json
{
  "family": "my-app",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest",
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/myapp/database:username::"
        },
        {
          "name": "DATABASE_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/myapp/database:password::"
        }
      ]
    }
  ]
}
```

**IAM permissions** (task execution role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/myapp/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/abc-123-def-456"
    }
  ]
}
```

**How it works**:
1. ECS fetches secret from Secrets Manager at task startup
2. Secrets injected as environment variables into container
3. Application reads from environment variables (no code changes)
4. Secrets never stored in image or visible in ECR

### SSM Parameter Store Integration

**For non-sensitive config** (free tier, simpler):

```bash
aws ssm put-parameter \
  --name /prod/myapp/api-endpoint \
  --value "https://api.example.com" \
  --type String

aws ssm put-parameter \
  --name /prod/myapp/database-password \
  --value "supersecret123" \
  --type SecureString \
  --key-id alias/aws/ssm
```

**ECS task definition**:

```json
{
  "secrets": [
    {
      "name": "API_ENDPOINT",
      "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/prod/myapp/api-endpoint"
    },
    {
      "name": "DATABASE_PASSWORD",
      "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/prod/myapp/database-password"
    }
  ]
}
```

**Secrets Manager vs Parameter Store**:

| Feature | Secrets Manager | Parameter Store (Standard) | Parameter Store (Advanced) |
|---------|----------------|---------------------------|---------------------------|
| **Cost** | $0.40/secret/month + $0.05/10K API calls | Free | $0.05/parameter/month |
| **Rotation** | Built-in Lambda rotation | Manual | Manual |
| **Value size** | 64KB | 4KB | 8KB |
| **Versioning** | Automatic | Manual | Automatic |
| **Cross-region replication** | Built-in | Manual | Manual |
| **Use case** | Database credentials, API keys | Application config | Large config, frequent changes |

**Decision framework**:
- Use **Secrets Manager** for: Database passwords, API keys, OAuth tokens (anything requiring rotation)
- Use **Parameter Store** for: Static config (endpoints, feature flags, non-sensitive settings)

### Kubernetes Secrets (EKS)

**External Secrets Operator** (sync from Secrets Manager):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
  target:
    name: database-secret
  data:
    - secretKey: password
      remoteRef:
        key: prod/myapp/database
        property: password
```

**Pod consumes secret**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
    - name: app
      image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
      env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
```

## Cost Optimization Strategies

### ECR Pricing Model

**Charges**:
- **Storage**: $0.10/GB/month (amount of data stored)
- **Data transfer**: Standard AWS data transfer pricing
  - Free: Within same region
  - $0.02/GB: Cross-region (e.g., us-east-1 to us-west-2)
  - $0.09/GB: To internet
- **Enhanced scanning**: $0.09 per image scan (first scan per image per repo per month)

### Cost Optimization Techniques

**1. Lifecycle policies** (reduce storage):

```bash
# Before: 100 images × 2GB = 200GB × $0.10 = $20/month
# After (lifecycle policy keeps 20): 20 images × 2GB = 40GB × $0.10 = $4/month
# Savings: $16/month (80%)
```

**2. Multi-stage builds** (reduce image size):

```dockerfile
# ❌ Before: 1.5GB image (includes build tools)
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ✅ After: 200MB image (only runtime dependencies)
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Savings**: 1.5GB → 200MB = 1.3GB saved per image × 20 images = 26GB × $0.10 = $2.60/month

**3. Layer caching** (reduce data transfer):

```dockerfile
# ✅ Good: Copy dependency files first (rarely change)
COPY package.json package-lock.json ./
RUN npm install

# Then copy source code (changes frequently)
COPY . .
RUN npm run build
```

**Why this matters**: Docker caches layers. When source code changes but dependencies don't, Docker reuses cached dependency layer, reducing upload size from 1.5GB to 10MB (only source code).

**4. Regional replication strategy**:

```bash
# ❌ Wasteful: Replicate all images to all regions
# Cost: 100 images × 2GB × 3 regions = 600GB × $0.10 = $60/month

# ✅ Strategic: Replicate only production images to active regions
# Cost: 10 prod images × 2GB × 2 regions = 40GB × $0.10 = $4/month
```

**5. Basic vs enhanced scanning**:

```bash
# Enhanced scanning cost: 100 images × $0.09 = $9/month (if rescanned)
# Basic scanning cost: $0 (included)

# Strategy: Use enhanced scanning for production repos, basic for dev/test
# Savings: ~$5-7/month for typical workload
```

### Cost Monitoring

**CloudWatch metric filters**:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ecr-storage-high \
  --alarm-description "Alert when ECR storage exceeds 500GB" \
  --metric-name RepositoryStorageSize \
  --namespace AWS/ECR \
  --statistic Average \
  --period 86400 \
  --threshold 500000000000 \
  --comparison-operator GreaterThanThreshold
```

**Cost allocation tags**:

```bash
aws ecr tag-resource \
  --resource-arn arn:aws:ecr:us-east-1:123456789012:repository/my-app \
  --tags Key=CostCenter,Value=Engineering Key=Environment,Value=Production
```

## Integration Patterns

### CI/CD Pipeline Integration

**GitHub Actions workflow**:

```yaml
name: Build and Push to ECR

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsRole
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: my-app
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Wait for scan
        run: |
          aws ecr wait image-scan-complete \
            --repository-name my-app \
            --image-id imageTag=${{ github.sha }}

      - name: Check scan results
        run: |
          CRITICAL=$(aws ecr describe-image-scan-findings \
            --repository-name my-app \
            --image-id imageTag=${{ github.sha }} \
            --query 'imageScanFindings.findingSeverityCounts.CRITICAL' \
            --output text)

          if [ "$CRITICAL" != "None" ] && [ "$CRITICAL" -gt 0 ]; then
            echo "❌ Critical vulnerabilities found"
            exit 1
          fi
```

### ECS Deployment Integration

**ECS task definition** (reference ECR image):

```json
{
  "family": "my-app",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:prod-v1.2.3",
      "cpu": 256,
      "memory": 512,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Blue/green deployment** (CodeDeploy):

```yaml
# appspec.yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: "arn:aws:ecs:us-east-1:123456789012:task-definition/my-app:2"
        LoadBalancerInfo:
          ContainerName: "app"
          ContainerPort: 8080
        PlatformVersion: "LATEST"
Hooks:
  - BeforeInstall: "LambdaFunctionToValidateBeforeInstall"
  - AfterInstall: "LambdaFunctionToValidateAfterInstall"
  - BeforeAllowTraffic: "LambdaFunctionToValidateBeforeTrafficShift"
  - AfterAllowTraffic: "LambdaFunctionToValidateAfterTrafficShift"
```

### EKS Deployment Integration

**Kubernetes deployment**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:v1.2.3
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
      imagePullSecrets:
        - name: ecr-registry-secret
```

**ECR pull secret** (for private images):

```bash
kubectl create secret docker-registry ecr-registry-secret \
  --docker-server=123456789012.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1)
```

**IRSA (IAM Roles for Service Accounts)** (Better approach):

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppECRAccessRole
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      serviceAccountName: my-app-sa
      containers:
        - name: app
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:v1.2.3
```

No explicit pull secret needed; EKS automatically uses IRSA role to authenticate.

## When to Use ECR vs Alternatives

### ECR vs Docker Hub

| Consideration | AWS ECR | Docker Hub |
|--------------|---------|------------|
| **Pull rate limits** | Unlimited | 100/6h (anonymous), 200/6h (free), 5000/day (Pro) |
| **Private images** | Unlimited private repositories | 1 free private repo (free), unlimited (Pro $5/month) |
| **Cost** | $0.10/GB storage + data transfer | Free (public), $5-9/month (private) |
| **AWS integration** | Native (IAM, VPC endpoints, GuardDuty) | Requires credentials management |
| **Performance** | Low latency from AWS regions | Variable (internet-dependent) |
| **Scanning** | Built-in (basic free, enhanced $0.09/scan) | Paid feature (Pro+) |
| **Use case** | AWS-hosted workloads | Public open-source projects, non-AWS environments |

**Decision**: Use ECR for production AWS workloads; Docker Hub for public images or multi-cloud.

### ECR vs Self-Hosted Registry (Harbor, Artifactory)

| Consideration | AWS ECR | Self-Hosted (Harbor) |
|--------------|---------|---------------------|
| **Management overhead** | Fully managed (zero ops) | Requires HA setup, upgrades, backups |
| **Cost** | $0.10/GB + scanning | EC2/RDS costs + licensing (if commercial) |
| **Customization** | Limited (AWS features only) | Full control (plugins, custom auth) |
| **Multi-cloud** | AWS-only | Works anywhere |
| **Air-gapped environments** | Not suitable | Works offline |
| **Use case** | AWS-native architectures | Multi-cloud, on-prem, air-gapped, custom workflows |

**Decision**: Use ECR unless you need multi-cloud, air-gapped, or highly customized workflows.

### ECR Public vs Docker Hub

| Consideration | ECR Public | Docker Hub |
|--------------|------------|------------|
| **Pull rate limits** | Unlimited | 100/6h (anonymous), 5000/day (Pro) |
| **Bandwidth** | Free (AWS CloudFront) | Free (for reasonable use) |
| **Discoverability** | Lower (newer platform) | Higher (established community) |
| **AWS integration** | Native | Requires credentials |
| **Use case** | Open-source projects targeting AWS users | General open-source projects |

## Common Pitfalls

### 1. Not Enabling Tag Immutability for Production

**Problem**: Developer accidentally overwrites `prod-v1.2.3` tag with different image, breaking deployments.

**Solution**:
```bash
aws ecr put-image-tag-mutability \
  --repository-name my-app \
  --image-tag-mutability IMMUTABLE
```

Prevents tag overwrites. Use immutable tags for production, mutable for dev/staging if needed.

### 2. Missing Lifecycle Policies

**Problem**: Hundreds of old images accumulate, costing $50+/month in storage and scanning.

**Solution**: Implement lifecycle policies from day one:
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 production, 5 staging, 3 dev",
      "selection": {...},
      "action": {"type": "expire"}
    }
  ]
}
```

### 3. Hardcoding Secrets in Dockerfiles

**Problem**:
```dockerfile
ENV DATABASE_PASSWORD=supersecret123
```
Credentials visible in image history and ECR.

**Solution**: Use Secrets Manager or Parameter Store:
```json
{
  "secrets": [
    {
      "name": "DATABASE_PASSWORD",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db"
    }
  ]
}
```

### 4. Not Replicating Production Images

**Problem**: ECR outage in `us-east-1` blocks deployments globally.

**Solution**: Replicate production images to DR region:
```json
{
  "rules": [{
    "destinations": [{"region": "us-west-2"}],
    "repositoryFilters": [{"filter": "prod-*"}]
  }]
}
```

### 5. Running Containers as Root

**Problem**: Container escape grants root access to host.

**Solution**:
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

And in ECS:
```json
{
  "user": "1000",
  "readonlyRootFilesystem": true
}
```

### 6. Large Base Images

**Problem**: `FROM ubuntu` creates 1.2GB image, consuming storage and slowing deployments.

**Solution**: Use slim/distroless images:
```dockerfile
FROM python:3.11-slim  # 200MB vs 1.2GB
# Or: FROM gcr.io/distroless/python3-debian12
```

### 7. Not Monitoring Scan Results

**Problem**: Critical vulnerabilities in production images go undetected for months.

**Solution**: Implement automated checks in CI/CD:
```bash
CRITICAL_COUNT=$(aws ecr describe-image-scan-findings ... | jq '.criticalCount')
if [ "$CRITICAL_COUNT" -gt 0 ]; then exit 1; fi
```

And enable EventBridge alerting:
```json
{
  "source": ["aws.ecr"],
  "detail-type": ["ECR Image Scan"],
  "detail": {
    "finding-severity-counts": {
      "CRITICAL": [{"exists": true}]
    }
  }
}
```

### 8. Forgetting Cross-Account Permissions

**Problem**: Replication fails silently because destination account doesn't allow `ecr:CreateRepository`.

**Solution**: Add registry policy in destination account:
```json
{
  "Sid": "AllowReplication",
  "Effect": "Allow",
  "Principal": {"Service": "ecr.amazonaws.com"},
  "Action": ["ecr:CreateRepository", "ecr:ReplicateImage"]
}
```

### 9. Not Using VPC Endpoints for ECR

**Problem**: Containers in private subnets pull images via NAT Gateway, incurring data transfer costs ($0.045/GB).

**Solution**: Create VPC endpoints for ECR:
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345 \
  --service-name com.amazonaws.us-east-1.ecr.dkr \
  --route-table-ids rtb-12345

aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345 \
  --service-name com.amazonaws.us-east-1.ecr.api \
  --route-table-ids rtb-12345
```

Eliminates NAT Gateway costs for ECR traffic.

## Key Takeaways

**ECR Fundamentals**:
- ECR is a fully managed Docker registry with native AWS integration (IAM, VPC, CloudWatch)
- Private by default (requires IAM authentication); ECR Public available for open-source
- Charges: $0.10/GB storage, $0.02/GB cross-region transfer, $0.09/scan (enhanced)

**Image Scanning**:
- **Basic scanning**: Free, OS packages only, Clair-based
- **Enhanced scanning**: $0.09/scan, continuous rescanning, OS + application dependencies, CVSS scores
- Integrate scanning into CI/CD; fail builds on CRITICAL findings; remediate HIGH+ within SLAs

**Lifecycle Policies**:
- Automate cleanup with count-based (keep last N) or age-based (delete after X days) rules
- Typical policy: Keep 10 production, 5 staging, 3 dev; delete untagged after 1 day
- Saves 80%+ on storage and scanning costs for typical workloads

**Replication**:
- Cross-region: Low latency, high availability, compliance (data residency)
- Cross-account: Centralized CI/CD, multi-tenant architectures
- Cost: $0.02/GB data transfer + storage in each region

**Runtime Security**:
- Use distroless/slim base images to minimize attack surface
- Run as non-root, drop capabilities, read-only root filesystem
- Enable GuardDuty Runtime Monitoring for threat detection
- Segment networks with security groups (principle of least privilege)

**Secrets Management**:
- Never hardcode secrets in Dockerfiles or pass via environment variables
- Use Secrets Manager ($0.40/secret/month) for credentials requiring rotation
- Use Parameter Store (free) for static configuration
- Inject secrets at runtime via ECS task definition or Kubernetes External Secrets Operator

**Cost Optimization**:
- Lifecycle policies: Reduce storage 80% (e.g., $20/month → $4/month)
- Multi-stage builds: Reduce image size 85% (1.5GB → 200MB)
- Strategic replication: Replicate only production to active regions
- VPC endpoints: Eliminate NAT Gateway costs for ECR traffic

**Integration**:
- CI/CD: Authenticate with `aws ecr get-login-password`, scan on push, fail on critical vulnerabilities
- ECS: Reference images by digest for immutability; use task execution role for ECR pull permissions
- EKS: Use IRSA for authentication (no explicit pull secrets); integrate with External Secrets Operator

**When to Use ECR**:
- **Choose ECR** for: AWS-native workloads, unlimited pull rate, native IAM integration, production deployments
- **Consider alternatives** for: Multi-cloud (Harbor), air-gapped (self-hosted), public open-source projects (Docker Hub)
