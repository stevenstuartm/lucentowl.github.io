---
title: "Advanced Container Patterns on AWS for System Architects"
layout: guide
category: AWS
subcategory: Container Orchestration (Advanced)
description: "Comprehensive guide to advanced ECS and EKS patterns covering service discovery, capacity providers, service mesh, autoscaling, and multi-cluster architectures"
tags: [aws, containers, kubernetes, ecs, eks, microservices, architecture, scalability, practical]
---

## What Problems Advanced Container Patterns Solve

**Basic container orchestration** (covered in AWS Container Services guide) handles:
- Running containers on ECS/EKS/Fargate
- Load balancing with ALB/NLB
- Basic autoscaling based on CPU/memory
- Simple deployments with rolling updates

**Advanced patterns solve production-scale challenges**:

**Service Discovery & Communication**:
- **Problem**: Microservices need to find each other dynamically as instances scale up/down
- **Impact**: Hardcoded IPs break; manual service registry maintenance doesn't scale
- **Solution**: AWS Cloud Map for DNS-based discovery, App Mesh for service-to-service communication

**Capacity Optimization**:
- **Problem**: Fixed Fargate pricing ($0.04/vCPU/hour) costs 3-4× more than EC2 Spot ($0.01/vCPU/hour)
- **Impact**: Running 100 vCPUs on Fargate = $2,880/month vs $720/month on Spot
- **Solution**: Capacity providers mix Fargate (baseline), EC2 On-Demand (critical), and Spot (batch workloads)

**Traffic Management**:
- **Problem**: Blue/green deployments risk full cutover; need gradual traffic shifting with automatic rollback
- **Impact**: Bad deployment takes down entire service instead of 10%
- **Solution**: App Mesh weighted routing, CodeDeploy linear/canary deployments

**Observability & Debugging**:
- **Problem**: Tracing requests across 20 microservices to find latency source
- **Impact**: Mean time to resolution (MTTR) increases from minutes to hours
- **Solution**: X-Ray distributed tracing, CloudWatch Container Insights, service mesh observability

**Multi-Cluster Management**:
- **Problem**: Managing 5 EKS clusters (dev, staging, prod-us, prod-eu, prod-asia) with consistent config
- **Impact**: Configuration drift, security gaps, manual deployments
- **Solution**: GitOps with Flux/ArgoCD, centralized policies with OPA/Kyverno

## ECS Advanced Patterns

### Service Discovery with AWS Cloud Map

**Why Cloud Map matters**:

Without service discovery:
```python
# ❌ Hardcoded endpoint (breaks when service moves)
response = requests.get("http://10.0.1.45:8080/api/users")
```

With Cloud Map:
```python
# ✅ DNS-based discovery (automatically updated)
response = requests.get("http://user-service.local/api/users")
```

**Cloud Map architecture**:
- **Namespace**: DNS namespace for service discovery (e.g., `local`, `prod.internal`)
- **Service**: Named service within namespace (e.g., `user-service`)
- **Instance**: Registered endpoint (IP + port) for service instance

**Creating Cloud Map namespace**:

```bash
aws servicediscovery create-private-dns-namespace \
  --name local \
  --vpc vpc-12345678 \
  --description "Private namespace for ECS service discovery"
```

**ECS task definition with Cloud Map**:

```json
{
  "family": "user-service",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/user-service:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

**ECS service with Cloud Map registration**:

```json
{
  "serviceName": "user-service",
  "taskDefinition": "user-service:1",
  "desiredCount": 3,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-user-service"],
      "assignPublicIp": "DISABLED"
    }
  },
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:us-east-1:123456789012:service/srv-abc123",
      "containerName": "app",
      "containerPort": 8080
    }
  ]
}
```

**How it works**:
1. ECS registers each task IP in Cloud Map when task starts
2. Cloud Map creates DNS A record: `user-service.local` → [10.0.1.10, 10.0.1.20, 10.0.1.30]
3. Applications query DNS to discover service instances
4. ECS automatically deregisters instances when tasks stop

**Health checks**:

```json
{
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:us-east-1:123456789012:service/srv-abc123",
      "containerName": "app",
      "containerPort": 8080
    }
  ],
  "healthCheckGracePeriodSeconds": 60
}
```

Cloud Map integrates with ECS health checks; unhealthy tasks automatically removed from DNS.

### Capacity Providers

**Capacity provider strategy**:

Capacity providers define how ECS places tasks across compute resources:
- **FARGATE**: Serverless, no EC2 management, higher cost ($0.04/vCPU/hour)
- **FARGATE_SPOT**: Serverless spot instances, 70% discount, can be interrupted
- **EC2 Auto Scaling Group**: Self-managed EC2, lower cost, more control

**Cost comparison** (100 vCPUs):

| Type | Cost/vCPU/hour | Monthly Cost (100 vCPUs) | Interruption Risk |
|------|----------------|--------------------------|-------------------|
| Fargate | $0.04 | $2,880 | None |
| Fargate Spot | $0.012 | $864 | 2-min notice |
| EC2 On-Demand (m5.large) | $0.023 | $1,656 | None |
| EC2 Spot (m5.large) | $0.007 | $504 | 2-min notice |

**Strategy 1: Fargate baseline + Spot burst**:

```json
{
  "capacityProviders": ["FARGATE", "FARGATE_SPOT"],
  "defaultCapacityProviderStrategy": [
    {
      "capacityProvider": "FARGATE",
      "weight": 1,
      "base": 2
    },
    {
      "capacityProvider": "FARGATE_SPOT",
      "weight": 4
    }
  ]
}
```

**How it works**:
- **Base**: 2 tasks always on FARGATE (reliable baseline)
- **Weight**: Remaining tasks split 1:4 (20% FARGATE, 80% FARGATE_SPOT)
- **Example**: 10-task service = 2 Fargate + 2 Fargate + 6 Fargate Spot = $0.08 + $0.08 + $0.072 = $0.232/hour vs $0.40 all-Fargate (42% savings)

**Strategy 2: EC2 Spot with Auto Scaling**:

```bash
# Create capacity provider for Spot ASG
aws ecs create-capacity-provider \
  --name spot-capacity \
  --auto-scaling-group-provider '{
    "autoScalingGroupArn": "arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:...",
    "managedScaling": {
      "status": "ENABLED",
      "targetCapacity": 80,
      "minimumScalingStepSize": 1,
      "maximumScalingStepSize": 10
    },
    "managedTerminationProtection": "ENABLED"
  }'
```

**Auto Scaling Group configuration**:

```json
{
  "LaunchTemplate": {
    "LaunchTemplateId": "lt-12345",
    "Version": "1"
  },
  "MinSize": 0,
  "MaxSize": 20,
  "DesiredCapacity": 5,
  "MixedInstancesPolicy": {
    "InstancesDistribution": {
      "OnDemandBaseCapacity": 2,
      "OnDemandPercentageAboveBaseCapacity": 20,
      "SpotAllocationStrategy": "capacity-optimized"
    },
    "LaunchTemplate": {
      "Overrides": [
        {"InstanceType": "m5.large"},
        {"InstanceType": "m5a.large"},
        {"InstanceType": "m5n.large"}
      ]
    }
  }
}
```

**How managed scaling works**:
1. ECS monitors cluster capacity utilization
2. When target capacity (80%) exceeded, ECS triggers ASG scale-out
3. New EC2 instances join cluster and accept task placements
4. When utilization drops, ECS triggers scale-in (with task draining)

**Capacity provider strategy**:

```json
{
  "capacityProviderStrategy": [
    {
      "capacityProvider": "spot-capacity",
      "weight": 4,
      "base": 0
    },
    {
      "capacityProvider": "ondemand-capacity",
      "weight": 1,
      "base": 2
    }
  ]
}
```

**Result**: 2 tasks on On-Demand (base), remaining tasks 80% Spot / 20% On-Demand.

### Task Placement Strategies

**Placement strategies control how ECS distributes tasks across instances**.

**1. Spread** (high availability):

```json
{
  "placementStrategy": [
    {
      "type": "spread",
      "field": "attribute:ecs.availability-zone"
    },
    {
      "type": "spread",
      "field": "instanceId"
    }
  ]
}
```

**Effect**: Spreads tasks evenly across AZs, then across instances. Maximizes availability (single AZ failure affects 33% of tasks).

**2. Binpack** (cost optimization):

```json
{
  "placementStrategy": [
    {
      "type": "binpack",
      "field": "memory"
    }
  ]
}
```

**Effect**: Packs tasks tightly onto fewest instances. Minimizes number of EC2 instances (reduces cost), but reduces availability (instance failure affects more tasks).

**3. Random** (simple distribution):

```json
{
  "placementStrategy": [
    {
      "type": "random"
    }
  ]
}
```

**Use case**: When spread and binpack don't apply (e.g., single-instance services).

**Placement constraints** (restrict where tasks run):

```json
{
  "placementConstraints": [
    {
      "type": "memberOf",
      "expression": "attribute:workload-type == compute-optimized"
    }
  ]
}
```

**Common constraints**:
- `attribute:ecs.instance-type == c5.2xlarge` (specific instance type)
- `attribute:ecs.availability-zone in [us-east-1a, us-east-1b]` (specific AZs)
- Custom attributes: Tag instances with `workload-type=gpu`, constraint tasks to those instances

### ECS Circuit Breaker

**Problem**: Bad deployment rolls out unhealthy tasks, repeatedly fails, and consumes capacity.

**Solution**: Circuit breaker automatically rolls back failed deployments.

```json
{
  "deploymentConfiguration": {
    "deploymentCircuitBreaker": {
      "enable": true,
      "rollback": true
    },
    "maximumPercent": 200,
    "minimumHealthyPercent": 100
  }
}
```

**How it works**:
1. ECS deploys new task revision
2. If tasks fail health checks repeatedly (default: 10 consecutive failures)
3. Circuit breaker triggers automatic rollback to previous task definition
4. CloudWatch Events notify via SNS/Lambda

**Example scenario**:
- Deploy v2 with bug causing crash loop
- Tasks fail health check 10 times in 5 minutes
- Circuit breaker rolls back to v1
- Deployment marked FAILED, team notified

**When to use**:
- Production services (prevent bad deployments from taking down service)
- High-velocity deployments (automated rollback without manual intervention)

**When NOT to use**:
- Canary deployments (CodeDeploy handles gradual rollout + rollback)
- Services with long startup times (circuit breaker may false-trigger during slow startup)

## EKS Advanced Patterns

### Managed Node Groups vs Self-Managed Nodes

**Managed Node Groups** (recommended for most use cases):

```bash
eksctl create nodegroup \
  --cluster my-cluster \
  --name managed-nodes \
  --node-type m5.large \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed
```

**Benefits**:
- Automated AMI updates (EKS optimized AMI with latest patches)
- Graceful node termination (drains pods before terminating)
- Integration with EKS console (view nodes, update node group settings)
- Supports Spot and On-Demand instances

**Self-Managed Nodes**:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: my-cluster
  region: us-east-1
nodeGroups:
  - name: custom-nodes
    instanceType: m5.large
    desiredCapacity: 3
    minSize: 1
    maxSize: 10
    ami: ami-custom-12345
    preBootstrapCommands:
      - "echo 'Custom setup script'"
    overrideBootstrapCommand: |
      #!/bin/bash
      /etc/eks/bootstrap.sh my-cluster \
        --kubelet-extra-args '--max-pods=110'
```

**When to use self-managed**:
- Custom AMI required (compliance, specific kernel version, specialized drivers)
- Custom bootstrap logic (pre-install tools, configure networking)
- Mixed instance types not supported by managed node groups

**Cost**: Managed node groups are free (no additional charge vs self-managed).

### Fargate Profiles

**Fargate for EKS** (serverless pods):

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: my-cluster
  region: us-east-1
fargateProfiles:
  - name: fp-default
    selectors:
      - namespace: default
        labels:
          workload: fargate
      - namespace: production
```

**How it works**:
1. Pod with label `workload: fargate` in `default` namespace is created
2. EKS scheduler places pod on Fargate (not EC2 node)
3. AWS provisions Fargate task with pod's resource requests
4. Pod runs in isolation (no shared nodes)

**Pricing**: Fargate charges per pod (vCPU + memory), not per node.

**Use cases**:
- Burst workloads (don't want to provision EC2 for occasional spikes)
- Isolation required (sensitive workloads shouldn't share nodes)
- Zero node management (fully serverless Kubernetes)

**Limitations**:
- **No DaemonSets** on Fargate (each pod is isolated)
- **No HostPath volumes** (no access to node filesystem)
- **No privileged containers** (security restriction)
- **Higher cost**: ~3× EC2 On-Demand for same resources

### Cluster Autoscaler vs Karpenter

**Cluster Autoscaler** (traditional approach):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: cluster-autoscaler
          image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
          command:
            - ./cluster-autoscaler
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/my-cluster
```

**How it works**:
1. Pods remain Pending due to insufficient capacity
2. Cluster Autoscaler detects pending pods
3. Scales up Auto Scaling Group (adds nodes)
4. Nodes join cluster, pods scheduled
5. Periodically scans for underutilized nodes, scales down

**Limitations**:
- **Node group constraints**: Must define multiple node groups for different instance types
- **Slow scale-up**: 2-5 minutes (ASG launch time + kubelet registration)
- **Inefficient bin-packing**: May launch oversized instances

**Karpenter** (modern replacement):

```yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
metadata:
  name: default
spec:
  requirements:
    - key: karpenter.sh/capacity-type
      operator: In
      values: ["spot", "on-demand"]
    - key: kubernetes.io/arch
      operator: In
      values: ["amd64"]
    - key: karpenter.k8s.aws/instance-family
      operator: In
      values: ["m5", "m5a", "m5n", "m6i"]
  limits:
    resources:
      cpu: 1000
  ttlSecondsAfterEmpty: 30
  ttlSecondsUntilExpired: 604800
  providerRef:
    name: default
---
apiVersion: karpenter.k8s.aws/v1alpha1
kind: AWSNodeTemplate
metadata:
  name: default
spec:
  subnetSelector:
    karpenter.sh/discovery: my-cluster
  securityGroupSelector:
    karpenter.sh/discovery: my-cluster
  instanceProfile: KarpenterNodeInstanceProfile
```

**How it works**:
1. Pods remain Pending
2. Karpenter analyzes pod resource requests (CPU, memory, GPU, etc.)
3. Directly launches EC2 instance sized for pending pods (no ASG)
4. Node joins cluster in ~40 seconds (vs 2-5 minutes for ASG)
5. Consolidates underutilized nodes, replaces with right-sized instances

**Advantages**:
- **Faster scale-up**: 40 seconds vs 2-5 minutes (no ASG overhead)
- **Better bin-packing**: Launches instance precisely sized for pending pods
- **Simpler config**: Single Provisioner vs multiple node groups
- **Automatic consolidation**: Replaces 3 underutilized nodes with 1 right-sized node

**Cost savings**: Karpenter typically reduces cluster costs by 10-30% through better bin-packing and consolidation.

**When to use Karpenter**:
- Large-scale clusters (>50 nodes) with diverse workloads
- Cost optimization priority
- Frequent scaling events

**When to use Cluster Autoscaler**:
- Small clusters (<50 nodes)
- Simple workloads (few instance types)
- Already invested in ASG-based infrastructure

### EKS Add-ons

**Managed add-ons** simplify cluster operations:

```bash
# Install VPC CNI add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni \
  --addon-version v1.15.0 \
  --resolve-conflicts OVERWRITE

# Install CoreDNS add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name coredns \
  --addon-version v1.10.1

# Install kube-proxy add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name kube-proxy \
  --addon-version v1.28.0
```

**Benefits**:
- **Automated updates**: EKS patches add-ons when vulnerabilities discovered
- **Compatibility**: EKS ensures add-on version compatible with cluster version
- **Drift detection**: EKS detects manual changes, can revert to managed config

**Common add-ons**:
- **VPC CNI**: Assigns VPC IP addresses to pods (vs overlay networking)
- **CoreDNS**: Kubernetes DNS resolution
- **kube-proxy**: Kubernetes service networking
- **Amazon EBS CSI Driver**: Persistent volumes backed by EBS
- **Amazon EFS CSI Driver**: Shared persistent volumes backed by EFS
- **AWS Load Balancer Controller**: Creates ALB/NLB for Ingress/Service resources

### IRSA (IAM Roles for Service Accounts)

**Problem**: Pods need AWS API access (e.g., read from S3, write to DynamoDB).

**Anti-pattern**: Store AWS credentials in Secrets, mount into pod.

```yaml
# ❌ Bad: Credentials in Secret
apiVersion: v1
kind: Secret
metadata:
  name: aws-creds
stringData:
  AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE
  AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
---
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      envFrom:
        - secretRef:
            name: aws-creds
```

**Problems**:
- Credentials long-lived (don't rotate)
- Shared across pods (can't scope permissions per pod)
- Stored in etcd (security risk if cluster compromised)

**IRSA solution**:

```yaml
# ✅ Good: IAM Role for Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppRole
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
          image: my-app:latest
```

**IAM role trust policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/ABC123"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.us-east-1.amazonaws.com/id/ABC123:sub": "system:serviceaccount:default:my-app-sa"
        }
      }
    }
  ]
}
```

**How it works**:
1. EKS injects OIDC token into pod as mounted file
2. AWS SDK reads token, exchanges for temporary credentials via STS
3. Credentials scoped to IAM role (e.g., read-only S3 access)
4. Credentials auto-rotate every 15 minutes

**Benefits**:
- **No long-lived credentials**
- **Per-pod permissions** (different ServiceAccounts = different IAM roles)
- **Audit trail** (CloudTrail logs which pod made which API call)

## Service Mesh Architecture

### Why Service Mesh

**Challenges without service mesh**:

1. **Retries and timeouts**: Each service implements retry logic differently (or not at all)
2. **Circuit breaking**: No standardized failure handling across services
3. **Observability**: Manual instrumentation for distributed tracing
4. **Security**: mTLS requires certificate management in every service
5. **Traffic management**: Canary deployments require application code changes

**Service mesh provides**:
- **Automatic retries, timeouts, circuit breaking** (configured declaratively)
- **Distributed tracing** (automatic X-Ray or Jaeger integration)
- **mTLS** (automatic certificate rotation, encryption)
- **Traffic shaping** (weighted routing, canary deployments without code changes)

### AWS App Mesh

**App Mesh architecture**:
- **Virtual services**: Logical service name (e.g., `user-service.local`)
- **Virtual nodes**: Backends for virtual service (e.g., ECS tasks, EKS pods, EC2 instances)
- **Virtual routers**: Route traffic between virtual nodes (weighted routing, path-based)
- **Virtual gateways**: Entry points for external traffic (similar to Ingress)

**Creating App Mesh resources**:

```bash
# Create mesh
aws appmesh create-mesh --mesh-name my-mesh

# Create virtual service
aws appmesh create-virtual-service \
  --mesh-name my-mesh \
  --virtual-service-name user-service.local \
  --spec '{
    "provider": {
      "virtualRouter": {
        "virtualRouterName": "user-service-router"
      }
    }
  }'

# Create virtual router
aws appmesh create-virtual-router \
  --mesh-name my-mesh \
  --virtual-router-name user-service-router \
  --spec '{
    "listeners": [
      {"portMapping": {"port": 8080, "protocol": "http"}}
    ]
  }'

# Create virtual nodes
aws appmesh create-virtual-node \
  --mesh-name my-mesh \
  --virtual-node-name user-service-v1 \
  --spec '{
    "listeners": [
      {"portMapping": {"port": 8080, "protocol": "http"}}
    ],
    "serviceDiscovery": {
      "awsCloudMap": {
        "namespaceName": "local",
        "serviceName": "user-service"
      }
    }
  }'

# Create route (weighted routing)
aws appmesh create-route \
  --mesh-name my-mesh \
  --virtual-router-name user-service-router \
  --route-name user-service-route \
  --spec '{
    "httpRoute": {
      "match": {"prefix": "/"},
      "action": {
        "weightedTargets": [
          {"virtualNode": "user-service-v1", "weight": 90},
          {"virtualNode": "user-service-v2", "weight": 10}
        ]
      }
    }
  }'
```

**ECS task definition with Envoy sidecar**:

```json
{
  "family": "user-service",
  "proxyConfiguration": {
    "type": "APPMESH",
    "containerName": "envoy",
    "properties": [
      {"name": "IgnoredUID", "value": "1337"},
      {"name": "ProxyIngressPort", "value": "15000"},
      {"name": "ProxyEgressPort", "value": "15001"},
      {"name": "AppPorts", "value": "8080"},
      {"name": "EgressIgnoredIPs", "value": "169.254.170.2,169.254.169.254"}
    ]
  },
  "containerDefinitions": [
    {
      "name": "app",
      "image": "my-app:latest",
      "portMappings": [{"containerPort": 8080}],
      "dependsOn": [
        {"containerName": "envoy", "condition": "HEALTHY"}
      ]
    },
    {
      "name": "envoy",
      "image": "public.ecr.aws/appmesh/aws-appmesh-envoy:v1.27.0.0-prod",
      "essential": true,
      "environment": [
        {"name": "APPMESH_RESOURCE_ARN", "value": "arn:aws:appmesh:us-east-1:123456789012:mesh/my-mesh/virtualNode/user-service-v1"}
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -s http://localhost:9901/server_info | grep state | grep -q LIVE"],
        "interval": 5,
        "timeout": 2,
        "retries": 3
      }
    }
  ]
}
```

**How it works**:
1. Envoy sidecar intercepts all inbound/outbound traffic
2. App makes request to `user-service.local:8080`
3. Envoy resolves to virtual service, applies routing rules (90% v1, 10% v2)
4. Envoy adds mTLS, retries, timeouts, circuit breaking
5. Envoy emits metrics to CloudWatch, traces to X-Ray

### Retry and Circuit Breaking Policies

**Retry policy**:

```json
{
  "httpRoute": {
    "match": {"prefix": "/"},
    "retryPolicy": {
      "maxRetries": 3,
      "perRetryTimeout": {"unit": "s", "value": 2},
      "httpRetryEvents": ["server-error", "gateway-error"],
      "tcpRetryEvents": ["connection-error"]
    },
    "action": {
      "weightedTargets": [{"virtualNode": "user-service-v1", "weight": 100}]
    }
  }
}
```

**Circuit breaker (outlier detection)**:

```json
{
  "listeners": [
    {
      "portMapping": {"port": 8080, "protocol": "http"},
      "outlierDetection": {
        "maxServerErrors": 5,
        "interval": {"unit": "s", "value": 10},
        "baseEjectionDuration": {"unit": "s", "value": 30},
        "maxEjectionPercent": 50
      }
    }
  ]
}
```

**How it works**:
- If node returns 5 errors in 10 seconds, eject from load balancing pool for 30 seconds
- Never eject more than 50% of nodes (prevent cascading failure)
- After 30 seconds, node re-enters pool (gradual recovery)

### mTLS (Mutual TLS)

**Enable mTLS**:

```json
{
  "spec": {
    "listeners": [
      {
        "portMapping": {"port": 8080, "protocol": "http"},
        "tls": {
          "mode": "STRICT",
          "certificate": {
            "acm": {
              "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/abc-123"
            }
          }
        }
      }
    ],
    "backends": [
      {
        "virtualService": {
          "virtualServiceName": "backend-service.local",
          "clientPolicy": {
            "tls": {
              "enforce": true,
              "validation": {
                "trust": {
                  "acm": {
                    "certificateAuthorityArns": ["arn:aws:acm-pca:us-east-1:123456789012:certificate-authority/ca-123"]
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

**How it works**:
1. Envoy sidecars establish mTLS connection
2. Certificates issued by ACM Private CA
3. Envoy automatically rotates certificates before expiration
4. All service-to-service traffic encrypted (compliance requirement for many regulations)

## Autoscaling Strategies

### Horizontal Pod Autoscaler (HPA)

**Basic HPA** (CPU-based):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**How it works**:
- If average CPU > 70%, scale up
- If average CPU < 70%, scale down
- Check every 15 seconds (default)

**Custom metrics HPA** (application-specific):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 50
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
```

**Behavior tuning**:
- **scaleUp**: Allow 50% increase every 60 seconds (aggressive scale-up)
- **scaleDown**: Remove max 1 pod every 60 seconds (conservative scale-down)
- **stabilizationWindow**: Wait 5 minutes before scaling down (prevent flapping)

### Target Tracking Scaling (ECS)

**ECS target tracking** (simpler than step scaling):

```json
{
  "ServiceName": "user-service",
  "ScalableDimension": "ecs:service:DesiredCount",
  "PolicyName": "cpu-target-tracking",
  "PolicyType": "TargetTrackingScaling",
  "TargetTrackingScalingPolicyConfiguration": {
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }
}
```

**How it works**:
- ECS automatically calculates how many tasks needed to maintain 70% average CPU
- Scales up immediately when CPU exceeds 70%
- Scales down conservatively (5-minute cooldown)

**Custom metric target tracking** (ALB request count):

```json
{
  "TargetTrackingScalingPolicyConfiguration": {
    "TargetValue": 1000.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/my-alb/1234567890/targetgroup/my-targets/abc123"
    }
  }
}
```

**Scales to maintain 1000 requests/task**. If load increases to 5000 RPS and currently 3 tasks, scales to 5 tasks (5000 / 1000 = 5).

### Vertical Pod Autoscaler (VPA)

**Problem**: Pods with `requests: 100m CPU, 128Mi memory` actually use 500m CPU, 512Mi memory (over-provisioned or under-provisioned).

**VPA solution**:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: app
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
```

**How it works**:
1. VPA monitors actual resource usage
2. Calculates recommended requests/limits
3. Evicts pod, creates new pod with updated requests
4. Repeats periodically to adapt to workload changes

**Modes**:
- **Auto**: Automatically update requests/limits and restart pods
- **Recreate**: Same as Auto (legacy mode name)
- **Initial**: Only set requests at pod creation (not on updates)
- **Off**: Only provide recommendations (no action)

**When to use VPA**:
- Stateless workloads (can tolerate pod restarts)
- Right-size requests to reduce waste (pods requesting 2GB but using 200MB)
- Unknown resource requirements (VPA learns over time)

**When NOT to use VPA**:
- Stateful workloads (VPA evicts pods = potential data loss)
- Combined with HPA on same metric (conflicts)

## Multi-Cluster & Multi-Region Patterns

### GitOps with Flux/ArgoCD

**Problem**: Managing 5 EKS clusters with manual kubectl apply is error-prone and slow.

**GitOps solution**: Git as single source of truth for cluster state.

**Flux installation**:

```bash
flux bootstrap github \
  --owner=my-org \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --personal
```

**GitRepository source**:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/my-org/my-app
  ref:
    branch: main
```

**Kustomization**:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 10m
  sourceRef:
    kind: GitRepository
    name: my-app
  path: ./k8s/production
  prune: true
  validation: client
```

**How it works**:
1. Developer commits manifest changes to Git
2. Flux pulls changes every 1 minute
3. Flux applies changes to cluster (kubectl apply)
4. If manual changes made to cluster, Flux reverts to Git state

**Benefits**:
- **Audit trail**: All changes in Git history (who changed what, when, why)
- **Rollback**: `git revert` to undo changes
- **Disaster recovery**: Recreate cluster from Git
- **Multi-cluster consistency**: Same manifests deployed to all clusters

### Multi-Cluster Service Discovery

**Problem**: Services in cluster A need to call services in cluster B (different regions).

**Solution 1: Global Accelerator + NLB**:

```yaml
# Cluster A (us-east-1)
apiVersion: v1
kind: Service
metadata:
  name: user-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
spec:
  type: LoadBalancer
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 8080
```

**Global Accelerator**:

```bash
aws globalaccelerator create-accelerator \
  --name user-service-accelerator \
  --ip-address-type IPV4

aws globalaccelerator create-listener \
  --accelerator-arn arn:aws:globalaccelerator::123456789012:accelerator/abc-123 \
  --port-ranges FromPort=80,ToPort=80 \
  --protocol TCP

aws globalaccelerator create-endpoint-group \
  --listener-arn arn:aws:globalaccelerator::123456789012:listener/xyz-789 \
  --endpoint-group-region us-east-1 \
  --endpoint-configurations '[
    {"EndpointId": "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/...", "Weight": 100}
  ]'

aws globalaccelerator create-endpoint-group \
  --listener-arn arn:aws:globalaccelerator::123456789012:listener/xyz-789 \
  --endpoint-group-region eu-west-1 \
  --endpoint-configurations '[
    {"EndpointId": "arn:aws:elasticloadbalancing:eu-west-1:123456789012:loadbalancer/net/...", "Weight": 100}
  ]'
```

**How it works**:
- Global Accelerator provides 2 static anycast IPs
- Traffic routed to nearest healthy endpoint (us-east-1 or eu-west-1)
- Automatic failover if region unhealthy

**Cost**: Global Accelerator = $0.025/hour + $0.005/GB data transfer = ~$18/month + usage

**Solution 2: Service mesh federation** (App Mesh):

App Mesh virtual gateway in each region, route traffic between meshes.

## Cost Optimization Strategies

### ECS Cost Optimization

**1. Fargate Spot** (70% discount):

```json
{
  "capacityProviderStrategy": [
    {"capacityProvider": "FARGATE_SPOT", "weight": 4, "base": 0},
    {"capacityProvider": "FARGATE", "weight": 1, "base": 2}
  ]
}
```

**Savings**: 80% of tasks on Spot = 56% cost reduction (80% × 70%)

**2. Savings Plans**:

- **Compute Savings Plans**: Up to 66% discount on Fargate (1-year commitment)
- **EC2 Instance Savings Plans**: Up to 72% discount on EC2 instances

**Example**:
- Current: $2,880/month (100 vCPUs on Fargate)
- With 1-year Compute Savings Plan: $979/month (66% discount)

**3. Right-size tasks**:

```bash
# Before: Over-provisioned
"cpu": "1024", "memory": "2048"  # Actual usage: 200 CPU, 512MB

# After: Right-sized
"cpu": "256", "memory": "512"
```

**Savings**: 75% reduction in vCPU/memory = 75% cost reduction for that task.

### EKS Cost Optimization

**1. Karpenter consolidation**:

Karpenter automatically replaces 3 underutilized m5.large instances (12 vCPUs, $0.069/hour each = $0.207/hour) with 1 m5.xlarge (4 vCPUs, $0.092/hour).

**Before**: 3 × $0.069 = $0.207/hour
**After**: 1 × $0.092 = $0.092/hour
**Savings**: 56%

**2. Spot instances with Karpenter**:

```yaml
spec:
  requirements:
    - key: karpenter.sh/capacity-type
      operator: In
      values: ["spot"]
```

**Savings**: 70% discount on Spot (vs On-Demand)

**3. Cluster optimization**:

- **Delete idle clusters**: Dev/test clusters shut down nights/weekends (70% savings)
- **Consolidate small clusters**: 5 clusters with 10 nodes each → 1 cluster with 50 nodes (reduce control plane costs: $0.10/hour per cluster × 5 = $360/month saved)

## When to Use Which Pattern

### ECS vs EKS

| Consideration | ECS | EKS |
|--------------|-----|-----|
| **Learning curve** | Low (AWS-specific) | High (Kubernetes expertise) |
| **Portability** | AWS-only | Multi-cloud (Kubernetes standard) |
| **Operational overhead** | Low (fully managed) | Medium (managed control plane, self-manage add-ons) |
| **Control plane cost** | Free | $0.10/hour ($73/month per cluster) |
| **Ecosystem** | AWS services integration | Vast Kubernetes ecosystem (Helm, operators) |
| **Use case** | AWS-native architectures, startups, simple microservices | Multi-cloud strategy, complex orchestration, large teams |

**Decision**: Use ECS unless you need Kubernetes portability or advanced Kubernetes features.

### Fargate vs EC2

| Consideration | Fargate | EC2 (ECS/EKS) |
|--------------|---------|--------------|
| **Cost** | $0.04/vCPU/hour | $0.01-0.015/vCPU/hour (depending on instance) |
| **Operational overhead** | Zero (serverless) | Medium (patch, scale, monitor instances) |
| **Startup time** | ~30 seconds | ~5 seconds (warm pool) |
| **DaemonSets** | Not supported | Supported |
| **Use case** | Batch jobs, burst workloads, zero-ops | Long-running services, cost-sensitive, need DaemonSets |

**Decision**: Use Fargate for burst/batch workloads, EC2 for steady-state production (cost savings).

### Service Mesh vs No Service Mesh

| Consideration | With Service Mesh | Without Service Mesh |
|--------------|-------------------|---------------------|
| **Complexity** | High (Envoy, control plane) | Low (direct service calls) |
| **Observability** | Automatic (tracing, metrics) | Manual instrumentation |
| **Traffic management** | Declarative (weighted routing, retries) | Application code |
| **mTLS** | Automatic | Manual certificate management |
| **Use case** | >20 microservices, polyglot (multiple languages), need mTLS | <10 services, single language, simple architecture |

**Decision**: Use service mesh for large microservices architectures requiring mTLS, complex traffic management, or polyglot environments.

## Common Pitfalls

### 1. Not Using Capacity Providers

**Problem**: Running 100% Fargate costs $2,880/month when 80% could run on Spot for $864/month.

**Solution**: Mix Fargate (baseline), Fargate Spot (burst), EC2 Spot (batch):
```json
{
  "capacityProviderStrategy": [
    {"capacityProvider": "FARGATE", "weight": 1, "base": 2},
    {"capacityProvider": "FARGATE_SPOT", "weight": 4}
  ]
}
```

### 2. Ignoring Pod Resource Requests/Limits

**Problem**: Pods without requests/limits cause:
- **Overcommitment**: Node runs out of memory, OOM kills pods
- **Underutilization**: Pods request 2 CPUs but use 0.1 (wasted capacity)

**Solution**: Set requests = typical usage, limits = max usage:
```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### 3. Running DaemonSets on Fargate

**Problem**: Fargate doesn't support DaemonSets (each pod isolated).

**Solution**: Use node selector to restrict DaemonSets to EC2 nodes:
```yaml
spec:
  nodeSelector:
    eks.amazonaws.com/compute-type: ec2
```

### 4. Not Enabling Circuit Breaker

**Problem**: Bad deployment rolls out, takes down service, requires manual rollback.

**Solution**: Enable circuit breaker:
```json
{
  "deploymentCircuitBreaker": {
    "enable": true,
    "rollback": true
  }
}
```

### 5. Using Cluster Autoscaler with Diverse Workloads

**Problem**: Cluster Autoscaler struggles with mixed workloads (GPU, memory-intensive, CPU-intensive) requiring multiple node groups.

**Solution**: Migrate to Karpenter for automatic instance type selection:
```yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
spec:
  requirements:
    - key: karpenter.k8s.aws/instance-family
      operator: In
      values: ["m5", "m6i", "c5", "r5"]
```

### 6. Hardcoding Service Endpoints

**Problem**:
```python
# ❌ Hardcoded IP (breaks when service moves)
response = requests.get("http://10.0.1.45:8080/api/users")
```

**Solution**: Use service discovery:
```python
# ✅ DNS-based discovery
response = requests.get("http://user-service.local/api/users")
```

### 7. Not Using IRSA for Pod IAM Permissions

**Problem**: Storing AWS credentials in Kubernetes Secrets (long-lived, shared, stored in etcd).

**Solution**: Use IRSA:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppRole
```

### 8. Mixing HPA and VPA on Same Metric

**Problem**: HPA scales pods based on CPU, VPA changes CPU requests = conflict.

**Solution**: Use HPA for horizontal scaling, VPA in "recommendation" mode only:
```yaml
spec:
  updatePolicy:
    updateMode: "Off"  # Recommendation only
```

## Key Takeaways

**ECS Advanced Patterns**:
- **Cloud Map service discovery**: DNS-based discovery (no hardcoded IPs), automatic registration/deregistration
- **Capacity providers**: Mix Fargate (baseline), Fargate Spot (burst), EC2 Spot (batch) for 40-60% cost savings
- **Placement strategies**: Spread (HA), binpack (cost), with constraints for specialized workloads
- **Circuit breaker**: Automatic rollback on failed deployments (prevent bad deploys from taking down service)

**EKS Advanced Patterns**:
- **Managed node groups**: Automated AMI updates, graceful termination, simplest operational model
- **Karpenter vs Cluster Autoscaler**: Karpenter provides faster scale-up (40s vs 2-5min), better bin-packing, 10-30% cost savings
- **Fargate profiles**: Serverless pods for burst workloads, isolation, zero node management (3× EC2 cost)
- **IRSA**: IAM roles for pods, no long-lived credentials, per-pod permissions, audit trail

**Service Mesh**:
- **App Mesh**: Automatic retries, timeouts, circuit breaking, mTLS, distributed tracing (Envoy sidecar)
- **When to use**: >20 microservices, polyglot environments, mTLS required, complex traffic management
- **When NOT to use**: <10 services, single language, simple architecture (operational complexity outweighs benefits)

**Autoscaling**:
- **HPA**: Horizontal scaling based on CPU, memory, or custom metrics (maintain target utilization)
- **VPA**: Vertical scaling (right-size requests/limits), evicts pods to update resources
- **Target tracking (ECS)**: Simpler than step scaling, automatically calculates desired count
- **Karpenter**: Node-level autoscaling with consolidation (replaces underutilized nodes)

**Multi-Cluster Patterns**:
- **GitOps (Flux/ArgoCD)**: Git as single source of truth, automatic reconciliation, audit trail, disaster recovery
- **Global Accelerator**: Multi-region service discovery with static anycast IPs, automatic failover
- **Cost**: Multi-cluster adds control plane costs ($73/month per EKS cluster), consolidate when possible

**Cost Optimization**:
- **Fargate Spot**: 70% discount, 80% adoption = 56% total savings
- **Savings Plans**: 66% discount on Fargate, 72% on EC2 (1-3 year commitment)
- **Karpenter consolidation**: 10-30% savings through better bin-packing and Spot usage
- **Right-sizing**: VPA recommendations reduce waste (pods requesting 2GB but using 200MB)

**When to Use What**:
- **ECS**: AWS-native architectures, startups, simple microservices, zero control plane cost
- **EKS**: Multi-cloud portability, complex orchestration, large teams, Kubernetes ecosystem
- **Fargate**: Burst/batch workloads, zero ops, willing to pay premium
- **EC2**: Steady-state production, cost-sensitive, need DaemonSets or privileged containers
- **Service mesh**: >20 microservices, mTLS, complex traffic management, polyglot
