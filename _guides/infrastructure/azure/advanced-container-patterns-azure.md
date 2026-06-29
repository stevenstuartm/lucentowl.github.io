---
title: "Advanced Container Patterns on Azure"
layout: guide
category: Azure
subcategory: Container Orchestration (Advanced)
description: "AKS advanced networking with Azure CNI overlay, service mesh integration, KEDA event-driven autoscaling, GitOps with Flux, and production-grade container orchestration patterns"
tags: [azure, cloud-computing, kubernetes, infrastructure, scalability, devops, practical, advanced]
---

## What Are Advanced Container Patterns

[Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/aks/intro-kubernetes){:target="_blank" rel="noopener noreferrer"} (AKS) provides managed Kubernetes, but production-grade container platforms require patterns that address observability, security, cost optimization, and operational complexity at scale. Advanced AKS patterns leverage Azure-native integrations like Azure CNI networking modes, workload identity, KEDA autoscaling, and GitOps tooling to build resilient, observable, and cost-effective container platforms.

These patterns extend beyond getting workloads running in Kubernetes to addressing the challenges that emerge when operating container platforms supporting multiple teams, diverse workload types, and stringent reliability requirements.

### What Problems Advanced Container Patterns Solve

**Without advanced patterns:**
- Basic networking limits security isolation and multi-tenancy
- Manual scaling strategies cannot respond to event-driven workload spikes
- Observability gaps make troubleshooting microservices failures difficult
- Manual deployment processes create drift between environments
- Cost management relies on guesswork and reactive rightsizing
- Securing pod-to-Azure service authentication requires complex credential management

**With advanced patterns:**
- Sophisticated networking provides workload isolation, policy enforcement, and optimized pod IP allocation
- Event-driven autoscaling responds to queue depth, custom metrics, and external event sources
- Service mesh provides built-in observability, traffic management, and zero-trust security
- GitOps ensures declarative, auditable deployments with drift detection
- Workload identity eliminates credential management by leveraging Azure Entra ID
- Multi-cluster patterns distribute workloads across regions and failure domains

### How Azure AKS Differs from AWS EKS

Architects familiar with AWS EKS should understand several key differences in how Azure approaches advanced Kubernetes patterns:

| Concept | AWS EKS | Azure AKS |
|---------|---------|-----------|
| **Pod networking** | AWS VPC CNI assigns VPC IPs to pods (consumes VPC address space) | Azure CNI Overlay uses separate pod CIDR (conserves VNet space); Azure CNI Powered by Cilium adds eBPF capabilities |
| **Serverless pods** | Fargate profiles for serverless pod execution | Virtual Nodes (Azure Container Instances burst capacity) |
| **Node autoscaling** | Cluster Autoscaler + Karpenter (AWS-native provisioner) | Cluster Autoscaler + Node Auto-Provisioning (preview); no Karpenter support yet |
| **Service mesh** | AWS App Mesh (managed) + community options | Istio-based Service Mesh add-on (managed), OSM, Linkerd |
| **Workload identity** | IAM Roles for Service Accounts (IRSA) | Workload Identity (Azure Entra ID federation) |
| **GitOps** | Flux via EKS add-on | Flux v2 via AKS GitOps extension |
| **Event-driven autoscaling** | Manual KEDA installation or third-party | KEDA add-on (managed, integrated) |
| **Multi-cluster** | EKS Connector, third-party tools | Azure Fleet Manager (managed multi-cluster orchestration) |

---

## AKS Advanced Networking

### Networking Models Overview

AKS supports four networking models, each with different trade-offs around IP consumption, performance, and operational complexity.

| Networking Model | Pod IPs Source | VNet IP Consumption | Performance | Use Case |
|------------------|----------------|---------------------|-------------|----------|
| **kubenet** | Overlay network (10.244.0.0/16 default) | Only node IPs | Good | Development, small clusters, IP-constrained environments |
| **Azure CNI** | VNet address space | Node + pod IPs | Best | Production workloads needing direct pod-to-VNet connectivity |
| **Azure CNI Overlay** | Separate pod CIDR overlay | Only node IPs | Good | Large clusters needing VNet IP conservation |
| **Azure CNI Powered by Cilium** | Separate pod CIDR overlay | Only node IPs | Best (eBPF-optimized) | Advanced network policy, observability, performance |

### Azure CNI Overlay

[Azure CNI Overlay](https://learn.microsoft.com/en-us/azure/aks/azure-cni-overlay){:target="_blank" rel="noopener noreferrer"} separates the pod IP address space from the VNet, using an overlay network for pod-to-pod communication while preserving direct VNet integration for nodes and services.

**How it works:**
- Nodes get IPs from the VNet subnet as usual
- Pods get IPs from a separate CIDR range (e.g., 10.244.0.0/16) not part of the VNet
- Kubernetes services can still receive VNet IPs via load balancers
- Overlay network routes pod traffic through the node's VNet interface

**Advantages over standard Azure CNI:**
- Supports up to 250 nodes and 100,000 pods per cluster (standard Azure CNI caps at 400 pods per node based on subnet size)
- Conserves VNet address space; large clusters do not exhaust subnet IPs
- Faster cluster scaling because pod IPs do not require VNet IP allocation
- Compatible with existing VNet configurations

**Trade-offs compared to standard Azure CNI:**
- Pods are not directly routable from outside the cluster (requires NodePort, LoadBalancer, or Ingress)
- Some advanced VNet features like Private Endpoints integrated at the pod level may have limitations
- Slight performance overhead from overlay encapsulation

### Azure CNI Powered by Cilium

[Azure CNI Powered by Cilium](https://learn.microsoft.com/en-us/azure/aks/azure-cni-powered-by-cilium){:target="_blank" rel="noopener noreferrer"} combines Azure CNI Overlay with Cilium's eBPF-based data plane for enhanced performance, observability, and security capabilities.

**What Cilium adds:**
- **eBPF-accelerated networking:** Packet processing in the kernel, bypassing iptables overhead
- **Enhanced network policies:** Layer 7 (HTTP, gRPC, Kafka) policy enforcement in addition to Layer 3/4
- **Deep observability:** Hubble provides flow visualization, service dependency mapping, and DNS observability
- **Transparent encryption:** WireGuard-based encryption between pods with minimal performance impact
- **Advanced load balancing:** Maglev consistent hashing for service load balancing

**When to use Azure CNI Powered by Cilium:**
- High-performance workloads where iptables overhead is a bottleneck
- Security requirements for Layer 7 network policies (e.g., only allow GET requests to specific paths)
- Observability requirements for fine-grained service-to-service traffic analysis
- Multi-cluster service mesh architectures leveraging Cilium ClusterMesh
- Zero-trust networking requirements with transparent pod-to-pod encryption

**Trade-offs:**
- More complex troubleshooting when issues arise (eBPF debugging requires specialized knowledge)
- Newer technology with less operational maturity than standard Azure CNI
- Some Kubernetes network policy features behave differently with Cilium's extended policy model

### Network Policy Engines

Kubernetes network policies define rules for pod-to-pod traffic. AKS supports multiple policy engines.

| Engine | Performance | Features | Complexity | Use Case |
|--------|-------------|----------|------------|----------|
| **Azure Network Policies** | Good | Basic L3/L4 policies | Low | Simple production workloads |
| **Calico** | Good | Advanced L3/L4 policies, global network policy, egress controls | Medium | Enterprise security requirements |
| **Cilium** | Best (eBPF) | L7 policies, observability, encryption | High | High-performance workloads with advanced security |

**Recommendation:** Start with Azure Network Policies for simplicity. Upgrade to Calico when you need advanced policy features like global policy or egress gateway. Choose Cilium when performance, observability, or Layer 7 policy enforcement is critical.

---

## Service Mesh Integration

### What a Service Mesh Provides

A service mesh adds observability, traffic management, and security capabilities to microservices communication without changing application code. The mesh intercepts network traffic between services using sidecar proxies deployed alongside each pod.

**Core service mesh capabilities:**
- **Observability:** Automatic metrics, logs, and distributed traces for all service-to-service calls
- **Traffic management:** Canary deployments, traffic splitting, circuit breaking, retries, timeouts
- **Security:** Mutual TLS (mTLS) between services, certificate management, fine-grained authorization policies
- **Resilience:** Automatic retries, outlier detection, connection pooling, load balancing

### Service Mesh Options on AKS

Azure supports three primary service mesh options:

| Service Mesh | Management | Maturity | Complexity | Use Case |
|--------------|-----------|----------|------------|----------|
| **Istio-based Service Mesh add-on** | Managed by Azure | Stable | High | Production workloads needing comprehensive traffic control |
| **Open Service Mesh (OSM)** | Community-maintained | Deprecated (EOL 2024) | Medium | Legacy; migrate to Istio or Linkerd |
| **Linkerd** | Self-managed | Stable | Medium | Lightweight mesh for simpler use cases |

### Istio-based Service Mesh Add-on

The [Istio-based Service Mesh add-on](https://learn.microsoft.com/en-us/azure/aks/istio-about){:target="_blank" rel="noopener noreferrer"} provides a managed Istio installation where Azure handles control plane upgrades, patching, and lifecycle management.

**How it works:**
- Azure manages the Istio control plane (istiod) as a system workload
- Sidecar injection is automatic when you label namespaces (e.g., `istio-injection=enabled`)
- Envoy proxies intercept all pod network traffic
- Configuration uses standard Istio APIs (VirtualService, DestinationRule, Gateway, etc.)

**Key features:**
- **Ingress Gateway:** Managed ingress gateway for external traffic routing
- **Egress Gateway:** Controlled egress for outbound traffic to external services
- **Certificate management:** Automatic certificate rotation for mTLS
- **Integration with Azure Monitor:** Telemetry flows to Azure Monitor for centralized observability
- **Multi-cluster support:** Federate service mesh across multiple AKS clusters

**When to use the Istio add-on:**
- Complex microservices architectures with sophisticated traffic routing needs
- Security requirements for zero-trust mTLS between all services
- Canary deployments, A/B testing, or blue-green deployments at the network layer
- Integration with Azure PaaS services (Application Gateway, Azure Monitor)

**Trade-offs:**
- Resource overhead: Each pod gets an Envoy sidecar, increasing memory and CPU usage
- Increased latency from sidecar proxy hops (typically 1-5ms per hop)
- Steep learning curve for Istio APIs and concepts
- Debugging complexity when traffic behavior differs from expectations

### Linkerd

[Linkerd](https://linkerd.io/){:target="_blank" rel="noopener noreferrer"} is a lightweight, CNCF-graduated service mesh focused on simplicity and performance.

**Advantages over Istio:**
- Lower resource overhead (smaller, more efficient proxies)
- Simpler architecture with fewer moving parts
- Faster control plane and data plane
- Easier to learn and operate

**Disadvantages compared to Istio:**
- Fewer advanced traffic management features
- Smaller ecosystem and community compared to Istio
- Self-managed on AKS; no Azure-managed add-on

**When to use Linkerd:**
- Simpler microservices architectures where basic mTLS and observability suffice
- Resource-constrained environments where sidecar overhead matters
- Teams prioritizing operational simplicity over feature richness

### When You Do NOT Need a Service Mesh

Service meshes add complexity and overhead. Consider whether you need one before adopting.

**You may not need a service mesh if:**
- Your application is a monolith or has few services (service mesh overhead exceeds benefit)
- You already have observability through APM tools (Datadog, New Relic, Application Insights)
- Your services are stateless and failures are handled by Kubernetes retries and readiness probes
- Network security requirements are met by network policies alone

**Alternatives to service mesh:**
- **Application-level instrumentation:** OpenTelemetry SDKs provide observability without a mesh
- **API Gateway:** Azure API Management or open-source gateways provide traffic management at the edge
- **Network policies:** Cilium or Calico network policies enforce pod-to-pod security without mTLS overhead

---

## Event-Driven Autoscaling with KEDA

### What Is KEDA

[KEDA](https://keda.sh/){:target="_blank" rel="noopener noreferrer"} (Kubernetes Event-Driven Autoscaling) extends Kubernetes Horizontal Pod Autoscaler (HPA) to scale workloads based on external event sources like message queues, databases, and custom metrics.

Azure AKS provides KEDA as a managed add-on, eliminating manual installation and maintenance.

### How KEDA Works

Standard Kubernetes HPA scales based on CPU and memory metrics. KEDA extends HPA to scale based on external metrics from dozens of sources.

**KEDA components:**
- **ScaledObject:** Custom resource defining autoscaling rules and trigger metrics
- **ScaledJob:** Scales Kubernetes Jobs based on event sources
- **Scaler:** Plugin for a specific event source (Azure Service Bus, Azure Storage Queue, Kafka, Prometheus, etc.)
- **Metrics Adapter:** Exposes external metrics to HPA

**Scaling behavior:**
- KEDA monitors the event source via the scaler
- When the metric threshold is met (e.g., queue depth > 10), KEDA instructs HPA to scale pods
- When the metric falls to zero, KEDA can scale to zero pods (not possible with standard HPA)

### Common KEDA Scalers for Azure

| Scaler | Event Source | Use Case |
|--------|-------------|----------|
| **Azure Service Bus Queue** | Queue message count or age | Background job processing, async tasks |
| **Azure Service Bus Topic** | Subscription message count | Event-driven microservices |
| **Azure Storage Queue** | Queue message count | Simple job queues without Service Bus features |
| **Azure Blob Storage** | Blob count in container | Batch processing of uploaded files |
| **Azure Event Hubs** | Unprocessed event count (lag) | Stream processing workloads |
| **Prometheus** | Custom application metrics | Scaling based on business metrics (active users, pending orders) |
| **RabbitMQ** | Queue length | Open-source message queue workloads |
| **Kafka** | Consumer group lag | Event streaming platforms |

### Example: Scaling Based on Azure Service Bus Queue

**Scenario:** Pods process messages from an Azure Service Bus queue. When the queue depth exceeds 10 messages, scale up; when empty, scale to zero.

**ScaledObject definition:**

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-scaler
  namespace: production
spec:
  scaleTargetRef:
    name: order-processor
  minReplicaCount: 0
  maxReplicaCount: 30
  triggers:
    - type: azure-servicebus
      metadata:
        queueName: orders
        namespace: mycompany-servicebus
        messageCount: "10"
      authenticationRef:
        name: azure-servicebus-auth
```

**How this works:**
- KEDA monitors the `orders` queue in `mycompany-servicebus`
- When the queue has more than 10 messages, KEDA scales the `order-processor` deployment
- Scaling is proportional: 100 messages scales to approximately 10 pods (100 / 10)
- When the queue empties, KEDA scales to zero, eliminating idle pod costs

### When to Use KEDA

**KEDA is valuable for:**
- Background job processing with unpredictable workload spikes
- Event-driven architectures where work arrives in bursts
- Cost optimization by scaling to zero during idle periods
- Queue-based decoupling between frontend and backend services

**Do not use KEDA for:**
- Workloads requiring constant availability (use standard HPA with min replicas > 0)
- Workloads where cold-start latency is unacceptable (scaling from zero takes time)
- Simple CPU-based scaling where standard HPA suffices

---

## GitOps with Flux v2

### What Is GitOps

GitOps uses Git as the single source of truth for declarative infrastructure and application definitions. Changes are made via pull requests, and automation reconciles the cluster state with the Git repository state.

**GitOps principles:**
1. **Declarative:** Infrastructure and application state is expressed declaratively (YAML manifests)
2. **Versioned and immutable:** Git commits provide version history and immutability
3. **Pulled automatically:** Operators running in the cluster pull changes from Git
4. **Continuously reconciled:** Operators detect drift and restore desired state

### Flux v2 on AKS

The [AKS GitOps extension](https://learn.microsoft.com/en-us/azure/azure-arc/kubernetes/conceptual-gitops-flux2){:target="_blank" rel="noopener noreferrer"} provides a managed Flux v2 installation for continuous delivery to AKS clusters.

**Flux v2 components:**
- **Source Controller:** Fetches manifests from Git, Helm repositories, S3 buckets
- **Kustomize Controller:** Applies Kustomize overlays to manifests
- **Helm Controller:** Manages Helm chart installations
- **Notification Controller:** Sends alerts and integrates with external systems

**How Flux works on AKS:**
1. Configure a `FluxConfiguration` resource pointing to a Git repository
2. Azure provisions Flux controllers in the cluster
3. Flux pulls manifests from the Git repository at regular intervals
4. Flux applies changes to the cluster using Kustomize or Helm
5. Flux detects drift and reconciles cluster state with Git

### Example GitOps Workflow

**Repository structure:**

```
my-app-gitops/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml
│   ├── staging/
│   │   └── kustomization.yaml
│   └── prod/
│       └── kustomization.yaml
```

**FluxConfiguration for production:**

```yaml
apiVersion: fluxcd.io/v1
kind: FluxConfiguration
metadata:
  name: my-app-prod
spec:
  sourceRef:
    kind: GitRepository
    name: my-app-gitops
    namespace: flux-system
  path: overlays/prod
  prune: true
  interval: 5m
```

**Workflow:**
1. Developers change application manifests in the `my-app-gitops` repository
2. Pull request is reviewed and merged to the main branch
3. Flux detects the commit within 5 minutes
4. Flux applies the new manifests to the production cluster
5. If someone manually changes the cluster (e.g., kubectl edit), Flux reverts it to match Git

### Benefits of GitOps on AKS

**Auditability:** Every change is a Git commit with author, timestamp, and review history

**Rollback:** Revert a Git commit to roll back a deployment

**Consistency:** All environments are declaratively defined and continuously reconciled across development, staging, and production

**Security:** Cluster credentials are not required for deployments; Flux pulls from Git, developers never kubectl apply directly

**Multi-cluster:** Deploy to multiple AKS clusters from a single Git repository with branch-based or directory-based separation

### GitOps Anti-Patterns

**Do not use GitOps for:**
- Secrets management (use Azure Key Vault with External Secrets Operator or Sealed Secrets)
- Storing generated or templated files that change frequently (use Helm or Kustomize to generate manifests dynamically)
- Monolithic repositories that become bottlenecks for multiple teams (separate repositories by team or workload)

---

## Workload Identity

### What Is Workload Identity

[Workload Identity](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview){:target="_blank" rel="noopener noreferrer"} enables Kubernetes service accounts to authenticate to Azure services using Azure Entra ID (formerly Azure Active Directory), eliminating the need to manage credentials in pods.

Workload Identity replaces the deprecated Pod Identity model with a simpler, more secure federation-based approach.

### How Workload Identity Works

1. Create an Azure managed identity with permissions to access Azure resources (e.g., Storage, Key Vault)
2. Establish a federated identity credential linking the managed identity to a Kubernetes service account
3. Annotate the Kubernetes service account with the managed identity's client ID
4. Pods using the service account automatically receive an Azure token for authentication

**Under the hood:**
- AKS workload identity uses OpenID Connect (OIDC) federation
- The AKS cluster issues a Kubernetes service account token to the pod
- Azure Entra ID exchanges the Kubernetes token for an Azure access token
- The pod uses the Azure token to authenticate to Azure services

**No credentials are stored in the cluster.** Authentication relies on trust between the AKS OIDC issuer and Azure Entra ID.

### Example: Pod Accessing Azure Key Vault

**Azure setup:**

1. Create a managed identity: `my-app-identity`
2. Grant the identity access to Key Vault: `Key Vault Secrets User` role
3. Create a federated credential for the identity:
   - Issuer: AKS OIDC issuer URL (e.g., `https://eastus.oic.prod-aks.azure.com/tenant-id/issuer-id/`)
   - Subject: `system:serviceaccount:production:my-app`

**Kubernetes setup:**

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  namespace: production
  annotations:
    azure.workload.identity/client-id: "12345678-1234-1234-1234-123456789abc"
```

**Pod using workload identity:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: production
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: my-app
      containers:
        - name: app
          image: mycompany/my-app:latest
          env:
            - name: AZURE_CLIENT_ID
              value: "12345678-1234-1234-1234-123456789abc"
```

**What happens at runtime:**
- The pod receives a Kubernetes service account token
- The Azure SDK exchanges the Kubernetes token for an Azure access token
- The pod authenticates to Key Vault using the Azure token
- No secrets, passwords, or connection strings in the pod

### Workload Identity vs Pod Identity

| Aspect | Workload Identity | Pod Identity (deprecated) |
|--------|------------------|---------------------------|
| **Authentication** | OIDC federation | Managed Identity assigned to VMSS |
| **Credential storage** | None | None |
| **Setup complexity** | Lower (fewer components) | Higher (NMI daemonset, aad-pod-identity) |
| **Security** | Better (OIDC standard) | Good |
| **Status** | Recommended, actively maintained | Deprecated |

**Migration:** If using Pod Identity, migrate to Workload Identity. Microsoft provides a migration guide and tooling.

---

## Node Pool Strategies

### System vs User Node Pools

AKS distinguishes between system node pools (for AKS system components) and user node pools (for application workloads).

| Pool Type | Purpose | Characteristics |
|-----------|---------|-----------------|
| **System node pool** | Runs CoreDNS, metrics-server, kube-proxy, tunnelfront | Must have at least one node, cannot be deleted, and is tainted to repel user pods |
| **User node pool** | Runs application workloads | Can scale to zero, can be deleted, and has no special taints |

**Best practice:** Separate system and user node pools. Use a small system pool with reliable VM SKUs and larger user pools for application workloads. This prevents resource contention from affecting cluster stability.

### Spot Node Pools

[Spot node pools](https://learn.microsoft.com/en-us/azure/aks/spot-node-pool){:target="_blank" rel="noopener noreferrer"} use Azure Spot VMs, offering significant cost savings in exchange for eviction risk when Azure needs capacity.

**Characteristics:**
- Spot VMs can be evicted with 30 seconds notice
- Pricing varies based on demand; typically 60-90% cheaper than on-demand VMs
- AKS gracefully drains spot nodes before eviction when possible

**When to use spot node pools:**
- Batch processing workloads that can tolerate interruptions
- Stateless web applications with multiple replicas
- CI/CD build agents
- Data processing pipelines with checkpointing

**Do not use spot pools for:**
- Stateful workloads without graceful shutdown handling
- Latency-sensitive workloads requiring consistent availability
- Single-replica deployments where eviction causes downtime

**Best practice:** Use pod topology spread constraints or pod anti-affinity to distribute replicas across spot and on-demand node pools, ensuring at least some replicas survive spot evictions.

### GPU Node Pools

AKS supports GPU-enabled VMs for machine learning inference, training, and high-performance computing workloads.

**Common GPU VM series:**

| VM Series | GPU | Use Case |
|-----------|-----|----------|
| **NC-series** | NVIDIA Tesla | ML training, HPC |
| **ND-series** | NVIDIA Volta, Ampere | Large-scale deep learning |
| **NV-series** | NVIDIA Tesla M60 | Visualization, rendering |

**GPU node pool considerations:**
- GPU drivers and device plugins are installed automatically by AKS
- Pods must request GPU resources in resource limits to be scheduled on GPU nodes
- Taints and tolerations prevent non-GPU pods from wasting GPU node capacity
- Cost is significantly higher than CPU-only nodes; use node autoscaler to scale to zero when idle

### Virtual Nodes (Azure Container Instances Burst)

[Virtual Nodes](https://learn.microsoft.com/en-us/azure/aks/virtual-nodes){:target="_blank" rel="noopener noreferrer"} enable AKS to burst workloads to Azure Container Instances (ACI) when cluster capacity is exhausted or for ultra-fast scaling.

**How virtual nodes work:**
- A virtual node appears as a node in the cluster with massive capacity
- Pods scheduled to the virtual node run in ACI, not on VMs
- Pods start in seconds without waiting for VM provisioning
- Billed per-second based on CPU and memory consumption

**When to use virtual nodes:**
- Burst workloads exceeding cluster capacity
- Event-driven jobs requiring instant scale-out
- Cost optimization for infrequent, short-lived workloads

**Limitations:**
- Not all Kubernetes features are supported (host networking, DaemonSets, stateful workloads)
- Networking configuration is more complex (requires subnet delegation)
- Some Azure integrations (like managed identities) require additional configuration

---

## Cluster Autoscaling

### Cluster Autoscaler

The [Cluster Autoscaler](https://learn.microsoft.com/en-us/azure/aks/cluster-autoscaler){:target="_blank" rel="noopener noreferrer"} automatically adjusts the number of nodes in a node pool based on pod scheduling and resource utilization.

**How it works:**
- Pods enter a pending state due to insufficient cluster capacity
- Cluster Autoscaler detects unschedulable pods
- Autoscaler adds nodes to the node pool
- When nodes are underutilized for a period (default 10 minutes), Autoscaler removes them

**Configuration parameters:**

| Parameter | Purpose | Typical Value |
|-----------|---------|---------------|
| `--min-count` | Minimum nodes in pool | 1 (system pool), 0 (user pool) |
| `--max-count` | Maximum nodes in pool | Based on workload requirements |
| `--scale-down-delay-after-add` | Wait time before scale-down after scale-up | 10 minutes |
| `--scale-down-utilization-threshold` | CPU/memory usage threshold for scale-down | 0.5 (50%) |

**Best practices:**
- Set min-count to 0 for user node pools to reduce costs during idle periods
- Set max-count based on quota limits and cost constraints
- Use pod disruption budgets (PDBs) to control scale-down behavior and prevent service disruption
- Configure node pool taints and tolerations to ensure correct workload placement

### Node Auto-Provisioning (Preview)

[Node Auto-Provisioning](https://learn.microsoft.com/en-us/azure/aks/node-autoprovision){:target="_blank" rel="noopener noreferrer"} (NAP) is Azure's next-generation autoscaling feature, inspired by AWS Karpenter.

**How NAP differs from Cluster Autoscaler:**
- Cluster Autoscaler scales existing node pools; NAP provisions new node pools dynamically
- NAP selects optimal VM SKUs based on pod requirements (CPU, memory, GPU, architecture)
- NAP can consolidate workloads onto fewer nodes for cost optimization
- NAP responds faster to scaling events because it is not limited to predefined node pools

**Current status:** Preview feature; not recommended for production yet. Cluster Autoscaler remains the stable choice.

**Watch for:** NAP reaching GA in 2026, at which point it will become the recommended autoscaling solution for AKS.

---

## Multi-Cluster Patterns

### Azure Fleet Manager

[Azure Fleet Manager](https://learn.microsoft.com/en-us/azure/kubernetes-fleet/overview){:target="_blank" rel="noopener noreferrer"} provides centralized management for multiple AKS clusters across regions and subscriptions.

**Core capabilities:**
- **Cluster orchestration:** Manage cluster upgrades, configuration, and policy across fleets
- **Multi-cluster services:** Load balance traffic across clusters with cross-cluster service discovery
- **GitOps at scale:** Apply Flux configurations to multiple clusters from a single definition
- **Resource propagation:** Distribute resources (ConfigMaps, Secrets, Custom Resources) to clusters

**Use cases for Fleet Manager:**

| Scenario | How Fleet Helps |
|----------|-----------------|
| **Multi-region deployments** | Deploy applications to clusters in multiple regions from a central control plane |
| **Disaster recovery** | Distribute workloads across regions with automated failover |
| **Staging and production** | Manage cluster configuration across environments |
| **Global traffic routing** | Route user requests to the nearest regional cluster |

**Fleet resource propagation example:**

```yaml
apiVersion: fleet.azure.com/v1alpha1
kind: ClusterResourcePlacement
metadata:
  name: deploy-app-to-all-regions
spec:
  resourceSelectors:
    - group: apps
      kind: Deployment
      name: my-app
      namespace: production
  policy:
    placementType: PickAll
```

**What this does:**
- Fleet Manager replicates the `my-app` deployment to all clusters in the fleet
- Changes to the deployment in the hub cluster propagate to member clusters
- If a cluster is unhealthy, Fleet removes it from the placement

### Cross-Cluster Service Discovery

Fleet Manager supports service discovery across clusters, allowing pods in one cluster to call services in another.

**How it works:**
1. Export a service from one cluster using `ServiceExport`
2. Fleet Manager creates a `ServiceImport` in other clusters
3. DNS entries are created for cross-cluster service calls
4. Traffic flows through Azure load balancers spanning clusters

**Trade-offs:**
- Latency increases for cross-cluster calls (typically 5-20ms depending on regions)
- Network costs apply for inter-region traffic
- Service mesh complexity increases when spanning multiple clusters

**When to use cross-cluster services:**
- Global applications requiring low-latency local processing with occasional cross-region calls
- Disaster recovery scenarios where services fail over to a secondary cluster
- Multi-region data processing pipelines where stages run in different clusters

---

## Confidential Containers

### What Are Confidential Containers

[Confidential containers on AKS](https://learn.microsoft.com/en-us/azure/confidential-computing/confidential-containers){:target="_blank" rel="noopener noreferrer"} run workloads in hardware-based Trusted Execution Environments (TEEs), protecting data in use from the host OS, hypervisor, and even Azure administrators.

**How confidential containers work:**
- Containers run inside AMD SEV-SNP or Intel SGX enclaves
- Memory is encrypted and isolated from the host
- Attestation verifies that the workload is running in a genuine TEE before processing sensitive data

**Use cases:**
- Processing highly sensitive data like financial records, healthcare information, or government secrets
- Multi-party computation where parties do not trust each other's infrastructure
- Regulatory compliance requirements for data protection at rest, in transit, and in use

**Trade-offs:**
- Limited VM SKU availability (DCasv5, DCadsv5 series)
- Performance overhead from encryption (typically 10-20% depending on workload)
- Smaller memory limits compared to general-purpose VMs
- Additional complexity in application deployment and key management

**Confidential containers are a specialized use case.** Most workloads do not require TEE-level protection and should use standard AKS node pools.

---

## Cost Optimization Strategies

### Spot Instances for Non-Critical Workloads

Spot node pools reduce costs by 60-90% compared to on-demand VMs. Combine spot and on-demand pools with topology spread constraints to balance cost and availability.

### Cluster Start/Stop

AKS supports [stopping and starting clusters](https://learn.microsoft.com/en-us/azure/aks/start-stop-cluster){:target="_blank" rel="noopener noreferrer"} to eliminate compute costs during non-business hours.

**When cluster stop makes sense:**
- Development and test clusters used only during business hours
- Batch processing clusters that run on a schedule
- Demo environments used infrequently

**Limitations:**
- Start time is 5-15 minutes depending on cluster size
- Not suitable for production workloads requiring continuous availability

### Right-Sizing with Vertical Pod Autoscaler

[Vertical Pod Autoscaler](https://learn.microsoft.com/en-us/azure/aks/vertical-pod-autoscaler){:target="_blank" rel="noopener noreferrer"} (VPA) recommends and automatically adjusts pod CPU and memory requests based on observed usage.

**How VPA helps with cost optimization:**
- Prevents over-provisioning by reducing requests for idle resources
- Prevents under-provisioning that causes OOMKills and throttling
- Continuously tunes requests as workload patterns change

**VPA modes:**
- **Recommendation only:** VPA suggests optimal requests but does not apply them
- **Auto:** VPA updates pod requests and restarts pods to apply changes
- **Initial:** VPA sets requests at pod creation but does not modify running pods

**Trade-off:** Auto mode restarts pods, causing brief downtime. Use recommendation mode for production workloads and apply changes during maintenance windows.

### Reserved Instances for Stable Workloads

Azure Reserved Instances provide up to 72% savings for workloads running continuously for one or three years.

**When to use Reserved Instances:**
- Predictable workloads with known capacity requirements
- System node pools that run continuously
- Minimum baseline capacity for user node pools

**When NOT to use Reserved Instances:**
- Dynamic workloads with unpredictable scaling patterns
- Short-lived projects or proof-of-concepts
- Node pools expected to change VM SKUs frequently

### Monitoring Cost with Azure Cost Management

Enable [Azure Cost Management](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis){:target="_blank" rel="noopener noreferrer"} to track AKS costs by node pool, workload namespace, and resource type.

**Key metrics to monitor:**
- Cost per node pool (identify expensive GPU or high-memory pools)
- Cost per namespace (chargeback to teams)
- Idle resource waste (nodes with low utilization)
- Spot instance savings vs eviction frequency

---

## Common Pitfalls

### Pitfall 1: Using Standard Azure CNI for Large Clusters Without Sufficient IP Addresses

**Problem:** Deploying a large AKS cluster with standard Azure CNI in a subnet without enough IP addresses. Azure CNI assigns a VNet IP to every pod, consuming IP space rapidly.

**Result:** Cluster cannot scale because the subnet runs out of IPs. Pods enter a pending state with IP allocation errors.

**Solution:** Use Azure CNI Overlay or Azure CNI Powered by Cilium for large clusters. Calculate IP requirements as (max pods per node) x (max nodes) + node IPs before provisioning. Reserve a /22 or larger subnet for standard Azure CNI clusters.

---

### Pitfall 2: Deploying Service Mesh Without Understanding Resource Overhead

**Problem:** Installing a service mesh like Istio on a cluster without accounting for sidecar resource consumption.

**Result:** Nodes run out of CPU and memory because every pod now has an Envoy sidecar consuming additional resources. Cluster autoscaler scales out, increasing costs unexpectedly.

**Solution:** Before enabling a service mesh, measure baseline resource usage and add sidecar overhead (typically 50-100 MB memory and 10-50m CPU per pod). Increase node pool size or adjust pod resource limits accordingly. Use lightweight meshes like Linkerd for resource-constrained environments.

---

### Pitfall 3: KEDA Scaling to Zero Without Handling Cold Start Latency

**Problem:** Using KEDA to scale workloads to zero without accounting for pod startup time and readiness delays.

**Result:** First requests after scale-up fail or time out because the pod is not ready yet. Users experience errors during scale-up events.

**Solution:** Accept cold start latency as a trade-off for cost savings, or set KEDA minReplicaCount to 1 to keep at least one pod warm. Use readiness probes to ensure pods are fully ready before receiving traffic. For latency-sensitive workloads, use standard HPA instead of KEDA.

---

### Pitfall 4: Mixing Workload Identity and Legacy Pod Identity

**Problem:** Migrating from Pod Identity to Workload Identity incrementally, leaving both systems running simultaneously.

**Result:** Conflicting authentication configurations cause pods to fail Azure authentication intermittently. Troubleshooting is difficult because errors vary based on which identity system the pod uses.

**Solution:** Plan a complete migration from Pod Identity to Workload Identity. Disable Pod Identity after migration completes. Use namespace-based phased migration if necessary, but avoid long-term coexistence.

---

### Pitfall 5: Not Setting Pod Disruption Budgets with Cluster Autoscaler

**Problem:** Enabling Cluster Autoscaler without defining Pod Disruption Budgets (PDBs) for critical services.

**Result:** Autoscaler drains nodes aggressively during scale-down, terminating too many replicas simultaneously and causing service outages.

**Solution:** Define PDBs for all services specifying the minimum available replicas during disruptions. Example: `minAvailable: 2` for a 3-replica deployment ensures at least 2 replicas remain during scale-down.

---

### Pitfall 6: GitOps Repository Structure Causing Deployment Bottlenecks

**Problem:** Using a monolithic Git repository for all applications, causing merge conflicts and bottlenecks when multiple teams deploy simultaneously.

**Result:** Deployments are delayed while teams resolve merge conflicts. Single repository becomes a coordination burden.

**Solution:** Separate Git repositories by team or by workload. Use Flux's multi-source capabilities to compose manifests from multiple repositories. Balance between too many repositories (management overhead) and too few (coordination bottleneck).

---

## Key Takeaways

1. **Azure CNI Overlay and Cilium reduce IP consumption for large clusters.** Standard Azure CNI assigns VNet IPs to every pod, which exhausts subnets quickly. Overlay networking decouples pod IPs from VNet address space, enabling clusters with 100,000+ pods without consuming VNet IPs.

2. **Service meshes add significant value but also complexity and cost.** Istio provides powerful traffic management and zero-trust security, but the resource overhead and operational complexity are real. Evaluate whether application-level observability and network policies meet your needs before adopting a mesh.

3. **KEDA enables cost-effective event-driven workloads by scaling to zero.** Integrating KEDA with Azure Service Bus, Event Hubs, or Storage Queues makes background processing workloads respond to demand dynamically while eliminating costs during idle periods. Handle cold start latency appropriately.

4. **GitOps with Flux provides auditability, consistency, and security.** Using Git as the single source of truth for cluster configuration and application manifests eliminates kubectl-based drift, provides rollback capability, and enforces review processes for all changes.

5. **Workload Identity replaces Pod Identity with simpler, more secure Azure authentication.** Federation-based authentication eliminates credential storage entirely and reduces the attack surface. Migrate legacy Pod Identity workloads to Workload Identity.

6. **Separate system and user node pools for stability and cost optimization.** System node pools run AKS control plane components on reliable, always-on VMs. User node pools scale dynamically and can use spot instances for cost savings.

7. **Cluster Autoscaler is the stable autoscaling solution; watch Node Auto-Provisioning.** Cluster Autoscaler scales predefined node pools based on pod scheduling. Node Auto-Provisioning dynamically creates optimal node pools but is still in preview. Use Cluster Autoscaler for production.

8. **Azure Fleet Manager simplifies multi-cluster management at scale.** Centralized orchestration, GitOps at scale, and cross-cluster service discovery make Fleet Manager essential for multi-region deployments and disaster recovery scenarios.

9. **Spot node pools reduce costs by 60-90% for fault-tolerant workloads.** Batch processing, CI/CD agents, and stateless applications benefit from spot instances. Distribute replicas across spot and on-demand pools to tolerate evictions.

10. **Cost optimization requires a combination of strategies.** Use spot instances for fault-tolerant workloads, Reserved Instances for stable baselines, cluster start/stop for dev/test environments, and Vertical Pod Autoscaler for right-sizing. Monitor costs continuously with Azure Cost Management.
