---
title: "AWS Container Services: ECS, EKS, and Fargate"
layout: guide
category: AWS
subcategory: Compute Services
description: "Comprehensive guide to AWS container orchestration covering ECS, EKS, Fargate, cost optimization, deployment patterns, and service selection frameworks"
tags: [aws, containers, ecs, eks, fargate, kubernetes, orchestration, cost-optimization]
---

## What Problems Containers Solve

Containers address several key challenges compared to traditional EC2 instances and serverless Lambda functions.

### vs. EC2 Instances

**Consistency across environments**: Containers package applications with all dependencies, eliminating "works on my machine" problems. The same container runs identically in development, staging, and production.

**Resource efficiency**: Multiple containers share the host OS kernel, using less memory and CPU than separate virtual machines. A single EC2 instance can run dozens of containers.

**Faster deployment**: Container startup takes seconds vs. minutes for EC2 instances. Immutable container images enable rapid rollbacks.

**Portability**: Containers abstract infrastructure details. Move workloads between ECS, EKS, on-premises, and other cloud providers without code changes.

### vs. Lambda

**Longer execution times**: Lambda has a 15-minute maximum timeout. Containers run indefinitely for long-running services.

**Language/framework flexibility**: Lambda supports specific runtimes. Containers support any language or framework that runs on Linux/Windows.

**State management**: Containers handle stateful applications and long-running services better than Lambda's ephemeral execution model.

**Larger package sizes**: Lambda limits deployment packages to 250 MB unzipped. Container images can be several GB.

### When to Use Containers

**Choose containers (ECS/EKS) when**:
- Running long-running applications (web servers, microservices, APIs)
- Need specific languages/frameworks not well-supported by Lambda
- Application runs longer than 15 minutes
- Require full control over runtime environment
- Migrating existing Docker-based applications
- Running stateful applications (databases, message queues)

**Choose Lambda when**:
- Event-driven workloads (S3 uploads, API Gateway requests)
- Execution time under 15 minutes
- Sporadic or variable traffic patterns
- Want zero infrastructure management

**Choose EC2 when**:
- Need full infrastructure control (custom OS, kernel modules)
- Running specialized databases or data stores
- GPU-intensive workloads requiring specific drivers
- Migrating legacy applications requiring specific server configurations

## Amazon ECS (Elastic Container Service)

### ECS Architecture

ECS is AWS's native container orchestration service, designed for simplicity and deep AWS integration.

**Core components**:

**Cluster**: Logical grouping of services and tasks. Region-specific. Can contain EC2 instances, Fargate capacity, or both.

**Task Definition**: JSON blueprint describing 1-10 containers that comprise your application. Specifies container images, CPU/memory requirements, port mappings, network modes, IAM roles, environment variables, and secrets.

**Task**: Instantiation of a task definition (smallest unit of execution in ECS). Can contain one or more containers running together on the same host.

**Service**: Manages desired number of tasks, ensuring they keep running. Handles scheduling, load balancer integration, auto scaling, and rolling deployments. Use services for long-running applications.

### Launch Types: EC2 vs. Fargate

**ECS on EC2**:
- **Control**: Full control over instance types, OS, networking, storage
- **Cost**: Most cost-effective for steady-state workloads (up to 3x cheaper than Fargate with Reserved Instances)
- **Responsibility**: You manage patching, scaling, capacity planning
- **Use case**: High-volume production workloads with predictable traffic

**ECS on Fargate**:
- **Management**: AWS handles all infrastructure—no servers to manage
- **Cost**: Pay only for vCPU and memory used by tasks (per-second billing)
- **Pricing**: $0.04048 per vCPU-hour, $0.004492 per GB-memory-hour (us-east-1, 2024)
- **Use case**: Variable workloads, dev/test environments, microservices

<div class="callout callout--tip">
<p class="callout__title">ECS Managed Instances (2024 Recommendation)</p>
<ul>
<li>AWS fully manages EC2 instances (provisioning, patching, scaling)</li>
<li>Best combination of performance, cost optimization, and operational simplicity</li>
<li>Recommended for new workloads requiring EC2 launch type</li>
</ul>
</div>

### Service Discovery and Load Balancing

**AWS Cloud Map Service Discovery**:
- Defines custom DNS names for services
- Maintains updated locations of dynamically changing resources
- DNS-based discovery with configurable TTL
- Simpler but slower failover (depends on DNS TTL)

**ECS Service Connect (2024 Feature)**:
- Built on Cloud Map with Envoy-based sidecar proxy
- API-based discovery (faster than DNS)
- Automatic failover detection and traffic routing
- Built-in observability (logs, metrics)
- **Limitation**: Cannot use CodeDeploy (no blue/green deployments with CodeDeploy)
- **Cost**: Additional resources for sidecar containers

**Load Balancer Integration**:
- **Application Load Balancer (ALB)**: Best for HTTP/HTTPS, advanced routing (path-based, host-based, header-based)
- **Network Load Balancer (NLB)**: Best for TCP/UDP, ultra-low latency, high throughput, static IPs
- **awsvpc network mode**: Use "ip" target type when tasks have elastic network interfaces

### Auto Scaling

**Target Tracking Scaling (Recommended)**:
- Set target value for a metric (e.g., 70% CPU utilization)
- ECS automatically creates CloudWatch alarms and adjusts task count
- Metrics: CPU utilization, memory utilization, ALB request count per target

**Step Scaling**:
- Define specific thresholds and scaling actions
- React quickly to demand spikes
- Multiple steps for different alarm severity
- Example: Add 2 tasks at 70% CPU, add 5 tasks at 85% CPU

**Predictive Scaling (November 2024)**:
- Uses machine learning to analyze historical patterns
- Scales proactively before demand spikes
- Combines with target tracking for real-time adjustments

### When to Use ECS vs. EKS

**Choose ECS when**:
- Team has little/no Kubernetes experience
- Deploying AWS-centric workloads
- Want minimal operational overhead
- Running simple to moderate complexity microservices
- Prioritizing ease of use and deep AWS integration
- Cost efficiency critical (no control plane costs)

**Choose EKS when**:
- Team already has Kubernetes expertise
- Need multi-cloud or hybrid deployments
- Require fine-grained control over orchestration
- Want access to Kubernetes ecosystem (Helm, operators, CNCF tools)
- Portability is important
- Complex distributed systems requiring advanced orchestration

**Not a binary decision**: Both services can coexist in the same AWS account. Containers ensure portability between them.

## AWS Fargate

### Serverless Container Execution

Fargate is a serverless compute engine that runs containers without managing servers. You define CPU, memory, and networking requirements; AWS handles provisioning, scaling, and patching.

### Fargate vs. EC2 Launch Type

| Factor | Fargate | ECS on EC2 |
|--------|---------|------------|
| **Management** | Zero infrastructure management | Manage instances, patching, capacity |
| **Cost (steady-state)** | 3-9x more than EC2 Reserved Instances | Most cost-effective with Reserved Instances |
| **Cost (variable)** | Pay-per-second for task duration | Pay for instances even if underutilized |
| **Startup time** | ~30-60 seconds | Seconds (if instances already running) |
| **Control** | Limited (AWS-managed) | Full control over instances |
| **Best for** | Variable workloads, batch jobs, dev/test | High-volume production, GPU workloads |

**Real-world cost comparison**:
- Fargate: $0.04048/vCPU-hour + $0.004492/GB-hour (us-east-1)
- EC2 on-demand: ~3x cheaper
- EC2 Reserved Instances (1-year): ~6x cheaper than Fargate
- EC2 Reserved Instances (3-year): ~9x cheaper than Fargate

### Fargate Pricing and Resource Configurations

**Pricing (2024)**:
- **vCPU**: $0.04048 per vCPU-hour (us-east-1)
- **Memory**: $0.004492 per GB-hour
- **Storage**: 20 GB ephemeral storage included; $0.000111 per GB-hour for additional storage (up to 200 GB)
- **Billing**: Per-second billing with 1-minute minimum

**Valid CPU/Memory Configurations**:
- 0.25 vCPU: 0.5 GB, 1 GB, 2 GB memory
- 0.5 vCPU: 1 GB to 4 GB (increments of 1 GB)
- 1 vCPU: 2 GB to 8 GB
- 2 vCPU: 4 GB to 16 GB
- 4 vCPU: 8 GB to 30 GB
- 8 vCPU: 16 GB to 60 GB
- 16 vCPU: 32 GB to 120 GB

### Fargate Spot

**Discount**: Up to 70% off Fargate on-demand pricing

**Interruption**: 2-minute warning before termination when AWS needs capacity back

**Availability**: Capacity not guaranteed

**Use cases**:
- Fault-tolerant workloads
- Batch processing
- Stateless services with built-in resilience
- CI/CD pipelines

**Combining optimizations**:
- **Graviton + Spot**: Up to 76% savings (20% from Graviton, 70% from Spot compounded)
- **Graviton pricing**: ~20% cheaper than x86 (e.g., eu-west-1: $0.03238 vs. $0.04048 per vCPU-hour)
- **Graviton + Spot announcement**: September 2024—Fargate Spot now supports Arm-based Graviton processors

## Amazon EKS (Elastic Kubernetes Service)

### Kubernetes Fundamentals on AWS

EKS runs upstream Kubernetes, ensuring compatibility with standard Kubernetes tooling and APIs. AWS manages the Kubernetes control plane (high availability, patching, upgrades) across multiple Availability Zones.

### EKS Architecture

**Control Plane (AWS-Managed)**:
- Kubernetes API server, etcd, scheduler, controller manager
- Automatically scaled and distributed across 3 AZs
- AWS handles patching, upgrades, high availability
- **Cost**: $0.10 per cluster-hour (~$73/month per cluster)

**Worker Nodes (Customer-Managed Options)**:

**Self-Managed Nodes**:
- Full control over EC2 instances
- Manual scaling, patching, upgrades
- Most flexible but highest operational burden

**Managed Node Groups (Recommended)**:
- AWS handles provisioning, scaling, patching
- No extra cost (only pay for EC2 instances)
- Automated updates with single operation
- Integrates with Auto Scaling Groups

**Fargate**:
- Serverless compute for pods
- No node management
- Per-pod pricing
- Limited features (no DaemonSets, no hostPort)

**Karpenter (Advanced)**:
- Group-less autoscaling—works directly with EC2 Fleet API
- Responds to workload demands in under 1 minute
- Optimizes instance selection based on pod requirements
- More flexible and faster than Cluster Autoscaler

**EKS Auto Mode (December 2024)**:
- Fully automates Kubernetes cluster management
- Handles compute, storage, networking with a single click
- Built on Karpenter
- One-click migration from Managed Node Groups or Fargate

### EKS vs. ECS Decision Framework

| Factor | ECS | EKS |
|--------|-----|-----|
| **Learning curve** | Low | High (requires Kubernetes knowledge) |
| **Operational complexity** | Minimal | Moderate to high |
| **Control plane cost** | Free | $73/month per cluster |
| **AWS integration** | Deep (native AWS service) | Standard Kubernetes integration |
| **Ecosystem** | Limited | Rich (Helm, operators, CNCF tools) |
| **Portability** | AWS-only | Multi-cloud, hybrid, on-premises |
| **Use case** | AWS-centric microservices | Complex distributed systems, multi-cloud |

### When Kubernetes Complexity is Justified

**Use EKS when**:
- Existing Kubernetes expertise in the team
- Need for multi-cloud or hybrid deployments (EKS Hybrid Nodes GA December 2024)
- Require advanced orchestration features (custom controllers, operators, StatefulSets)
- Want vibrant ecosystem and community support (Helm, Prometheus, Istio)
- Migrating from on-premises Kubernetes
- Running complex stateful applications requiring persistent volumes

**Example**: A company running 100+ microservices with complex service mesh requirements, custom operators, and plans to migrate workloads to on-premises data centers benefits from EKS. A startup deploying 5 microservices exclusively on AWS is better served by ECS.

## Container Networking

### VPC Networking Modes

**awsvpc (Recommended)**:
- Each task/pod gets its own elastic network interface (ENI)
- Tasks have their own private IP address
- Full VPC networking features (security groups, NACLs)
- Required for Fargate
- **Limitation**: ENI limits per instance (e.g., m5.large supports 10 ENIs)

**bridge (Docker Default)**:
- Uses Docker's virtual network bridge
- Port mapping required (host port → container port)
- Reduced security isolation
- Not available on Fargate

**host**:
- Container uses host's network directly
- No port mapping needed
- Least isolation
- Not available on Fargate

### Service Mesh

**ECS Service Connect (2024)**:
- Managed Envoy sidecar
- Faster failover than DNS-based service discovery
- Observability built-in (CloudWatch Logs, metrics)
- Only for ECS-to-ECS communication
- Incompatible with blue/green deployments using CodeDeploy

**Amazon VPC Lattice (2024 General Service Mesh)**:
- Eliminates sidecar proxies
- Works across ECS, EKS, Lambda, EC2
- Simplified application networking with consistent connectivity, security, and monitoring
- Preferred for cross-service communication

**AWS App Mesh (Legacy)**:
- New onboarding stopped September 2024
- Migration paths: ECS Service Connect (ECS) or VPC Lattice (general)

### Load Balancing

**Application Load Balancer (ALB)**:
- Layer 7 (HTTP/HTTPS)
- Advanced routing (path-based, host-based, query string, header-based)
- WebSocket support
- SSL/TLS termination
- Native integration with ECS/EKS

**Network Load Balancer (NLB)**:
- Layer 4 (TCP/UDP)
- Ultra-low latency (microseconds)
- Static IP addresses
- Millions of requests per second
- Preserves source IP

**Multiple Target Groups (2024)**:
- ECS services can attach to multiple target groups
- Example: Internal NLB for private traffic + internet-facing ALB for public traffic

## Storage for Containers

### Ephemeral Storage

**ECS on Fargate**:
- **Default**: 20 GB included (free)
- **Maximum**: 200 GB configurable
- **Cost**: $0.000111 per GB-hour for additional storage
- **Encryption**: AES-256 for tasks launched on platform version 1.4.0+ (May 28, 2020 or later)

**EKS on Fargate**:
- **Default**: 20 GB
- **Maximum**: 175 GB per pod

**ECS on EC2**:
- Depends on instance storage (typically 10-30 GB root volume)

### EBS Volumes for ECS Tasks

**Major 2024 Update**: ECS now supports native EBS volume integration (announced January 2024).

**Use cases**:
- Data-intensive workloads requiring high performance, low latency
- Block storage within a single Availability Zone
- Applications needing persistent storage that doesn't span tasks

**Availability**: US East (Ohio, N. Virginia), US West (Oregon), Asia Pacific (Singapore, Sydney, Tokyo), Europe (Frankfurt, Ireland, Stockholm)

### EFS for Shared Persistent Storage

**Amazon EFS (Elastic File System)**:
- **Use case**: Applications spanning many tasks needing concurrent access
- **Availability**: Multi-AZ Regional availability
- **Access modes**: ReadWriteMany (multiple pods/tasks can mount simultaneously)
- **Supported on**: ECS (EC2 and Fargate), EKS

**EBS vs. EFS**:
- **EBS**: Single-AZ, ReadWriteOnce, lower latency, higher IOPS
- **EFS**: Multi-AZ, ReadWriteMany, regional availability, shared access

**Best practice for EKS**: Deploy Amazon EBS CSI driver or Amazon EFS CSI driver via EKS add-ons for security and efficiency.

## Security Best Practices

### IAM Roles for Tasks and Pods

**ECS Task Roles**:
- **Task Execution Role**: Grants ECS agent permission to pull images from ECR and write logs to CloudWatch
- **Task IAM Role**: Grants application code access to AWS services
- **Best practice**: Separate roles for execution vs. application; apply least privilege

**EKS IRSA (IAM Roles for Service Accounts)**:
- Assigns IAM roles to Kubernetes service accounts
- Pod-level permissions without sharing credentials
- Leverages AWS STS for temporary credentials (auto-rotated)
- **2024 Update**: Continues to be supported alongside EKS Pod Identity

**EKS Pod Identity (2023+)**:
- Assigns IAM roles directly to pods (decoupled from service accounts)
- Simpler trust management than IRSA
- More fine-grained control

**Security warning**: Pods can still inherit instance profile permissions. Always block access to instance metadata when using IRSA or Pod Identity.

### Secrets Management

**AWS Secrets Manager and Parameter Store**:
- Store sensitive data (database passwords, API keys)
- Reference in task definitions via ARN
- **Required permission**: `secretsmanager:GetSecretValue` in task execution role

**Example (ECS Task Definition)**:
```json
"secrets": [
  {
    "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-password"
  }
]
```

**Best practices**:
- Never hardcode secrets in container images or environment variables
- Use Secrets Manager for secrets requiring rotation
- Use Parameter Store (SecureString) for static configuration
- Grant minimal IAM permissions for secret access

### Image Scanning

**Amazon Inspector (ECR Integration)**:
- Automatically scans images on push
- Detects vulnerabilities in OS packages and application dependencies
- Maps images to running containers (ECS tasks, EKS pods)
- Prioritizes vulnerabilities based on whether images are currently running

**Best practices**:
- Enable image tag immutability to prevent malicious overwrites
- Use EventBridge to trigger actions (delete insecure images, trigger rebuilds)
- Scan on every push
- Block deployment of images with critical vulnerabilities

### Network Security

**Security Groups**:
- awsvpc mode: Assign security groups directly to tasks/pods
- Control inbound/outbound traffic at task level
- Stateful (return traffic automatically allowed)

**NACLs (Network Access Control Lists)**:
- Subnet-level firewall rules
- Stateless (must configure inbound and outbound separately)
- Defense-in-depth layer

**GuardDuty Runtime Monitoring (2023)**:
- Detects runtime security threats in ECS (EC2 and Fargate) and EKS
- Identifies suspicious activity, malware, unauthorized access

### Runtime Security

**Pod Security Standards (EKS)**:
- Kubernetes-native security policies (Restricted, Baseline, Privileged)
- Enforce via admission controllers (OPA Gatekeeper, Kyverno)
- Limit privileged containers (needed for system components like VPC CNI, but not application pods)

**Container-Optimized OS**:
- **Bottlerocket**: AWS-managed, immutable, minimal attack surface
- Automatically patched via managed node groups

**CIS Benchmark Compliance**:
- Verify EKS/ECS configurations against CIS benchmarks
- Tools: AWS Security Hub, third-party scanners

## Observability

### CloudWatch Container Insights

**Features**:
- Collects, aggregates, and summarizes metrics and logs
- Instance-level, cluster-level, and task/pod-level metrics
- Pre-built dashboards (CPU, memory, network, disk)

**Enhanced ECS Observability (December 2024)**:
- Granular visibility into container workloads
- Proactive monitoring and faster troubleshooting

**Requirements**:
- ECS on EC2: Container agent 1.4.0+ (latest recommended)
- EKS: Deploy CloudWatch agent via DaemonSet or Fargate logging

### Logging

**awslogs Log Driver**:
- Forwards stdout/stderr to CloudWatch Logs
- Simple configuration in task definition

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/my-app",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "ecs"
  }
}
```

**FireLens (Fluent Bit/Fluentd)**:
- Routes logs to third-party services (Datadog, Splunk, Elasticsearch)
- Flexible log transformation and routing
- Sidecar container pattern

### Distributed Tracing

**AWS X-Ray**:
- Traces requests across microservices
- Identifies performance bottlenecks, errors
- Integrates with ECS and EKS via sidecar container or daemon

**ADOT (AWS Distro for OpenTelemetry)**:
- Collects traces and metrics using OpenTelemetry
- Sends data to CloudWatch, X-Ray, Prometheus
- Vendor-neutral instrumentation

### Prometheus and Grafana (EKS)

**Amazon Managed Service for Prometheus**:
- Fully managed Prometheus-compatible monitoring
- Agentless metric collection for EKS (2023)
- Integrates with Grafana for visualization

**Amazon Managed Grafana**:
- Fully managed Grafana for dashboards
- Pre-built dashboards for EKS, ECS

## Deployment Patterns

### Blue/Green Deployments

**ECS Native Blue/Green (2025)**:
- Built-in blue/green without CodeDeploy
- Can change deployment controller after service creation
- Requires ALB
- Validates new revision before routing production traffic
- Instant rollback capability

**EKS Blue/Green**:
- Use separate Kubernetes deployments or namespaces
- Shift traffic via service selector or ingress controller
- Tools: Flagger, Argo Rollouts

### Rolling Updates

**ECS Rolling Update**:
- Default deployment type
- Gradually replaces tasks with new version
- Configurable: `minimumHealthyPercent` and `maximumPercent`
- Example: 50% minimum, 200% maximum = deploy new tasks before stopping old ones

**EKS Rolling Update**:
- Kubernetes-native via Deployment resources
- Configurable: `maxUnavailable`, `maxSurge`

### Canary Deployments

**ECS Native Canary (October 2025)**:
- Route small percentage of traffic to new revision
- Monitor metrics during bake time
- Gradually increase traffic
- Automatic rollback on CloudWatch alarm breach

**EKS Canary**:
- Use Flagger (progressive delivery tool)
- Argo Rollouts (GitOps-based canary)

### CircuitBreaker Deployment (ECS)

**Deployment Circuit Breaker**:
- Monitors deployment health
- Stops launching new tasks if service cannot reach steady state
- Optionally rolls back to last successful deployment
- Only works with rolling update deployment type

```json
"deploymentConfiguration": {
  "deploymentCircuitBreaker": {
    "enable": true,
    "rollback": true
  }
}
```

## Cost Optimization

### EC2 vs. Fargate Cost Comparison

**Scenario: Running 10 tasks, 1 vCPU, 2 GB memory each, 24/7**

| Launch Type | Configuration | Monthly Cost | Annual Cost |
|-------------|---------------|--------------|-------------|
| **Fargate On-Demand** | 10 vCPU, 20 GB | $356 | $4,272 |
| **Fargate Spot** | 10 vCPU, 20 GB | $107 (70% savings) | $1,284 |
| **Fargate Graviton** | 10 vCPU, 20 GB | $285 (20% savings) | $3,420 |
| **Fargate Graviton + Spot** | 10 vCPU, 20 GB | $86 (76% savings) | $1,032 |
| **EC2 Reserved (1-year)** | m5.large × 5 instances | $284 (35% savings vs On-Demand) | $3,408 |
| **EC2 Reserved (3-year)** | m5.large × 5 instances | $189 (57% savings vs On-Demand) | $2,268 |

**Key takeaways**:
- **Fargate Spot + Graviton**: Most cost-effective for fault-tolerant workloads ($86/month)
- **EC2 Reserved (3-year)**: Best for steady-state, long-term workloads ($189/month)
- **Fargate On-Demand**: Most expensive but simplest ($356/month)

### Savings Plans

**Compute Savings Plans**:
- 1-year: Up to 50% savings
- 3-year: Up to 66% savings
- Applies across EC2, Fargate, Lambda
- Flexible across instance families, sizes, regions

**Best practice**: Use Compute Savings Plans for baseline capacity, Spot for fault-tolerant workloads, On-Demand for unpredictable spikes.

### Right-Sizing Containers

**AWS Compute Optimizer**:
- Uses machine learning to analyze utilization
- Recommends optimal CPU and memory configurations
- Customizable thresholds (CPU headroom, memory headroom)
- Lookback periods: 14, 32, or 93 days

**Best practices**:
- Monitor for 30 days to establish baseline
- Rightsize if max memory utilization < 40% over 4 weeks
- Use CloudWatch Container Insights for granular metrics
- EKS: Use Vertical Pod Autoscaler (VPA) for automated rightsizing

### Graviton Processors

**AWS Graviton2/Graviton3**:
- ~20% lower cost than x86 (Intel/AMD)
- Better performance per dollar
- Supported by most popular software packages

**Migration**:
- Rebuild container images for ARM64 architecture
- Test compatibility (most modern software supports ARM)
- Potential effort: Moderate (rebuilding images, testing)

**Fargate Graviton + Spot (September 2024)**:
- Combine 20% Graviton savings with 70% Spot discount
- Total: Up to 76% savings vs. Fargate On-Demand

## Service Selection Framework

### Decision Matrix

| Use Case | Recommended Service | Rationale |
|----------|---------------------|-----------|
| Simple microservices, AWS-centric | **ECS on Fargate** | Minimal management, deep AWS integration |
| High-volume production, cost-critical | **ECS on EC2 with Reserved Instances** | Most cost-effective for steady-state |
| Kubernetes ecosystem required | **EKS with Managed Node Groups** | Standard Kubernetes, rich tooling |
| Multi-cloud, hybrid deployments | **EKS with Hybrid Nodes** | Portability, unified management |
| Variable workloads, dev/test | **ECS on Fargate** | Pay only for usage, no idle costs |
| Batch processing, fault-tolerant | **Fargate Spot** or **EC2 Spot** | Up to 70-90% cost savings |
| GPU workloads, custom kernels | **ECS on EC2** or **EKS on EC2** | Full control over instances |

### Specific Scenarios

**E-commerce platform (200 tasks running 24/7)**:
- **Recommendation**: ECS on EC2 with Reserved Instances
- **Rationale**: Steady-state workload; EC2 Reserved (3-year) saves ~$20,000/year vs. Fargate

**Startup with 10 microservices, unpredictable traffic**:
- **Recommendation**: ECS on Fargate
- **Rationale**: No capacity planning, automatic scaling, pay only for usage

**Financial services (300+ microservices, multi-cloud strategy)**:
- **Recommendation**: EKS
- **Rationale**: Kubernetes provides consistent experience across AWS, Azure, on-premises

**Data processing pipeline (batch jobs)**:
- **Recommendation**: Fargate Spot
- **Rationale**: 70% cost savings, fault-tolerant workloads

## Common Pitfalls

### Over-Provisioning Resources

**Problem**: Allocating too much CPU/memory wastes money.

**Example**: Task configured with 2 vCPU but only using 0.5 vCPU wastes $0.03/hour ($22/month per task).

**Solution**:
- Use AWS Compute Optimizer for rightsizing recommendations
- Monitor actual utilization for 30 days
- Start conservative, scale up as needed

### Not Using Fargate Spot

**Problem**: Running fault-tolerant workloads on Fargate On-Demand pays 3x more than necessary.

**Solution**:
- Identify workloads that tolerate interruptions (batch jobs, CI/CD, stateless services)
- Use Fargate Spot for up to 70% savings
- Implement retry logic for interrupted tasks

**Gotcha**: Fargate Spot capacity not guaranteed; have fallback to On-Demand if Spot unavailable.

### Improper Health Checks

**Problem**: Missing or misconfigured health checks cause endless restart loops.

**Common issues**:
- Health check command not included in container image
- Timeout too short (check executing longer than timeout allows)
- Retry count too low (transient failures mark container unhealthy)

**Best practices**:
- Test health check commands locally
- Set `interval` to 30 seconds, `timeout` to 5 seconds, `retries` to 3
- Use `/health` or `/healthz` endpoints for HTTP-based checks

```json
"healthCheck": {
  "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
  "interval": 30,
  "timeout": 5,
  "retries": 3,
  "startPeriod": 60
}
```

### Missing Auto-Scaling Configuration

**Problem**: Services cannot handle traffic spikes or waste resources during low traffic.

**Example**: Service configured with 10 tasks constantly, but traffic varies 5x throughout the day. Auto-scaling (min 2, max 20) saves $150/month.

**Solution**:
- Configure target tracking scaling (70% CPU utilization)
- Set reasonable min/max task counts
- Test scaling behavior under load

### Kubernetes Over-Engineering

**Problem**: Choosing EKS for simple workloads adds unnecessary complexity and cost.

**Costs of EKS**:
- Control plane: $73/month per cluster
- Operational burden: Managing Kubernetes manifests, namespaces, RBAC, CRDs
- Learning curve: Requires Kubernetes expertise

**When to avoid EKS**:
- Team has no Kubernetes experience
- Running simple microservices (fewer than 20 services)
- No need for Kubernetes ecosystem
- AWS-only deployment

**Example**: Team of 3 developers deploying 5 microservices chose EKS because "Kubernetes is the industry standard." Spent 6 months learning Kubernetes, fighting YAML configuration errors, debugging networking issues. ECS would have taken 1 week to set up.

### Not Blocking Instance Metadata Access

**Problem**: Pods/tasks inherit instance profile permissions, violating least privilege.

**Solution**:
- Use IRSA (EKS) or Task IAM Roles (ECS) for fine-grained permissions
- Block IMDS access via network policy or firewall rules
- ECS: Set `"disableNetworking": true` for task definition
- EKS: Use network policies to block 169.254.169.254

### Using Untagged Images

**Problem**: Untagged images accumulate, wasting ECR storage costs.

**Solution**:
- Implement ECR lifecycle policies
- Expire untagged images after 30 days
- Keep last 30 tagged images per repository

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire untagged images after 30 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

## Key Takeaways

**1. Choose the right service based on expertise and requirements**: ECS for simplicity and AWS integration ($0 control plane cost). EKS for Kubernetes ecosystem and portability ($73/month per cluster). Let team expertise and portability needs guide the decision.

**2. Fargate vs EC2 depends on workload patterns**: Fargate excels at variable workloads and eliminates infrastructure management (pay-per-second). EC2 with Reserved Instances is 3-9x cheaper for steady-state workloads. Use Fargate Spot + Graviton for up to 76% savings on fault-tolerant workloads.

**3. Container networking matters for security and performance**: Use awsvpc mode for task-level security groups (required for Fargate). Use ECS Service Connect or VPC Lattice for service-to-service communication. ALB for HTTP/HTTPS, NLB for TCP/UDP ultra-low latency.

**4. Storage depends on access patterns and availability needs**: Ephemeral storage (20-200 GB) for temporary data. EBS for high-performance single-AZ persistent storage. EFS for shared multi-AZ persistent storage accessible by multiple tasks.

**5. Security requires multiple layers**: Use IAM roles for tasks/pods (not instance profiles). Store secrets in Secrets Manager or Parameter Store (not environment variables). Enable ECR image scanning with Amazon Inspector. Block instance metadata access. Use GuardDuty Runtime Monitoring for threat detection.

**6. Observability is critical for troubleshooting**: Enable CloudWatch Container Insights for metrics. Use awslogs or FireLens for centralized logging. Use X-Ray or ADOT for distributed tracing. For EKS, integrate Amazon Managed Prometheus and Grafana.

**7. Deployment patterns enable zero-downtime releases**: Use ECS native blue/green or canary deployments (2025 features). Enable CircuitBreaker for automatic rollback on failures. Configure rolling updates with appropriate minimumHealthyPercent and maximumPercent.

**8. Cost optimization requires multiple strategies**: Use Compute Savings Plans (up to 66% savings) for baseline capacity. Use Fargate Spot (70% savings) or EC2 Spot (90% savings) for fault-tolerant workloads. Use Graviton processors (20% cheaper). Rightsize containers with Compute Optimizer. Implement ECR lifecycle policies.

**9. Auto-scaling prevents both under-provisioning and waste**: Use target tracking scaling (70% CPU recommended). Enable Predictive Scaling (November 2024) for machine learning-based forecasting. Test scaling behavior under load. Set reasonable min/max task counts.

**10. Avoid common pitfalls**: Don't over-provision resources (use Compute Optimizer). Don't ignore Fargate Spot for fault-tolerant workloads (70% savings). Don't use shallow health checks (verify application health, not just instance responsiveness). Don't choose EKS for simple workloads when ECS suffices. Don't forget to block instance metadata access when using task/pod IAM roles.

**Recent 2024-2025 improvements**: ECS Managed Instances (recommended for new workloads). EKS Auto Mode (December 2024). ECS native blue/green and canary deployments (October 2025). Fargate Spot with Graviton support (September 2024). Enhanced ECS Observability (December 2024). EBS volume support for ECS tasks (January 2024). VPC Lattice general availability (cross-service networking).
