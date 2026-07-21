---
title: "Azure Container Services: ACI, AKS, and Container Apps"
layout: guide
category: Azure
subcategory: Compute Services
description: "Azure container platform comparison for architects covering Azure Container Instances, Azure Kubernetes Service, and Azure Container Apps with selection frameworks and architecture patterns."
tags: [aks, container-apps, aci, kubernetes, keda, dapr, practical]
---

## What Are Azure Container Services

[Azure container services](https://learn.microsoft.com/en-us/azure/containers/){:target="_blank" rel="noopener noreferrer"} give architects multiple options for running containerized workloads depending on how much orchestration control they need and how much operational overhead they want to absorb. Rather than a single container platform, Azure offers three services that serve different use cases, and choosing the wrong one leads to either unnecessary complexity or missing capabilities.

Azure Container Instances (ACI) is the simplest option: run a container or a small group of containers without managing any infrastructure. Azure Kubernetes Service (AKS) is a fully managed Kubernetes platform for teams that need the full power and ecosystem of Kubernetes. Azure Container Apps sits between the two, providing serverless container hosting with built-in scaling, traffic splitting, and microservices features while hiding all Kubernetes complexity.

### What Problems Container Services Solve

**Without Azure container services:**
- Running containers on VMs requires manual orchestration, scaling, and health management
- Teams must choose between full Kubernetes complexity or no container support at all
- Batch and event-driven container workloads require custom scheduling infrastructure
- Microservices communication patterns like service discovery, pub/sub, and state management require building or integrating middleware manually

**With Azure container services:**
- Each service matches a different complexity and control requirement, from single containers to full orchestration
- Serverless options like ACI and Container Apps eliminate cluster and node management entirely
- Built-in autoscaling ranges from scale-to-zero (Container Apps) to node-level cluster autoscaling (AKS)
- Integrated networking, identity, and observability reduce the glue code needed to run production workloads

### How Azure Container Services Differ from AWS

Architects familiar with AWS container services should note several important differences in how Azure positions its offerings:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Simple container execution** | AWS Fargate (runs on ECS or EKS) | Azure Container Instances (standalone service) |
| **Managed Kubernetes** | Amazon EKS ($73/month control plane) | Azure Kubernetes Service (free control plane on the Free tier; Standard and Premium charge per cluster hour) |
| **Serverless containers with app platform** | AWS App Runner | Azure Container Apps (more feature-rich, built on KEDA + Envoy + Dapr) |
| **Container-native orchestration** | Amazon ECS (proprietary orchestrator) | No equivalent; Azure uses Kubernetes as the orchestration layer for both AKS and Container Apps |
| **Control plane cost** | EKS charges for the control plane | AKS free tier has no control plane charge; standard and premium tiers charge for uptime SLA and additional features |
| **Event-driven scaling** | Fargate + EventBridge + custom scaling | Container Apps has built-in KEDA scalers; AKS supports KEDA as an add-on |
| **Burst from Kubernetes** | Fargate profiles on EKS | AKS virtual nodes backed by ACI |

A notable structural difference is that Azure does not have a proprietary container orchestrator equivalent to Amazon ECS. Where AWS offers both ECS (native) and EKS (Kubernetes), Azure uses Kubernetes as the orchestration foundation for both AKS and Container Apps. This means Kubernetes concepts underpin the entire Azure container ecosystem, even when they are fully abstracted from the user in Container Apps.

---

## Azure Container Instances

### What ACI Does

[Azure Container Instances](https://learn.microsoft.com/en-us/azure/container-instances/container-instances-overview){:target="_blank" rel="noopener noreferrer"} (ACI) is the fastest way to run a container in Azure without managing any virtual machines or adopting an orchestration platform. You provide a container image, specify CPU and memory, and ACI runs it. There is no cluster, no node pool, and no control plane to manage.

ACI charges per-second for the vCPU and memory allocated to your container group. Billing starts when the container group is requested and stops when it terminates. This makes ACI cost-effective for short-lived workloads but potentially expensive for long-running services compared to AKS or Container Apps.

### Container Groups

The deployment unit in ACI is a [container group](https://learn.microsoft.com/en-us/azure/container-instances/container-instances-container-groups){:target="_blank" rel="noopener noreferrer"}, which is conceptually equivalent to a Kubernetes pod. A container group is a collection of containers that are scheduled on the same host, share the same network namespace (localhost communication), and can share storage volumes.

Container groups enable the sidecar pattern: a primary application container runs alongside helper containers that handle concerns like logging, monitoring, or proxy duties. All containers in the group share the same IP address and port space, and they can communicate over localhost.

**Container group characteristics:**
- Up to 60 containers per group (though practical groups are much smaller)
- All containers share a single public or private IP address
- Containers within the group communicate over localhost on different ports
- Shared Azure Files volumes or emptyDir volumes for data exchange
- Linux and Windows container groups (though Windows groups have fewer features and higher resource minimums)

### Networking Options

By default, ACI container groups receive a public IP address accessible from the internet. For production workloads that should not be publicly exposed, ACI supports [VNet integration](https://learn.microsoft.com/en-us/azure/container-instances/container-instances-vnet){:target="_blank" rel="noopener noreferrer"} by deploying container groups into a delegated subnet within your VNet.

VNet-integrated ACI groups receive a private IP address within the subnet and can communicate with other VNet resources like VMs, AKS clusters, and Private Endpoints. Inbound access is controlled by NSGs on the delegated subnet. This is the recommended approach for any workload that processes sensitive data or communicates with backend services.

### Spot Container Instances

[Spot container instances](https://learn.microsoft.com/en-us/azure/container-instances/container-instances-spot-containers-overview){:target="_blank" rel="noopener noreferrer"} run on surplus Azure capacity at a significant discount compared to regular ACI pricing. Azure can preempt spot instances when it needs the capacity back, so they are appropriate only for workloads that tolerate interruption.

Spot ACI works well for batch processing, data transformation, rendering jobs, and CI/CD build agents where the work can be retried if interrupted.

### When to Use ACI

ACI is the right choice for workloads that are short-lived, do not need orchestration, and should not require managing a cluster:

- **Batch jobs and data processing:** Run a container that processes a file, transforms data, or generates a report, then terminates
- **CI/CD build agents:** Spin up build environments on demand, run the build, tear down the environment
- **Testing and validation:** Run integration tests or load tests in isolated containers
- **Sidecar containers:** Deploy utility containers alongside other Azure services
- **Burst capacity from AKS:** Use ACI as a burst target through AKS virtual nodes when the cluster needs temporary additional capacity
- **Event-driven tasks:** Trigger a container from a Logic App, Azure Function, or Event Grid event

ACI is not a good fit for long-running services that need persistent availability, complex orchestration, automatic scaling, or traffic management. Those workloads belong on AKS or Container Apps.

---

## Azure Kubernetes Service

### What AKS Does

[Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/aks/what-is-aks){:target="_blank" rel="noopener noreferrer"} (AKS) is a managed Kubernetes platform where Microsoft operates the control plane (API server, etcd, scheduler, controller manager) and the customer manages the worker nodes where application pods run. The control plane is fully managed, automatically patched, and distributed across availability zones.

AKS provides the full Kubernetes API and ecosystem. Any tool that works with standard Kubernetes works with AKS, including Helm charts, Kubernetes operators, custom resource definitions, and the entire CNCF landscape. This is both its greatest strength and its primary cost: teams get maximum flexibility but must understand Kubernetes to use it effectively.

### Tiers and Pricing

AKS offers three [pricing tiers](https://learn.microsoft.com/en-us/azure/aks/free-standard-pricing-tiers){:target="_blank" rel="noopener noreferrer"} that determine the control plane capabilities:

| Tier | Control Plane Cost | SLA | Features |
|------|-------------------|-----|----------|
| **Free** | No charge | No SLA (best-effort) | Development, testing, and learning |
| **Standard** | Per-cluster hourly charge | 99.95% (AZ) or 99.9% (non-AZ) uptime SLA | Production workloads, multiple node pools, up to 5,000 nodes |
| **Premium** | Higher per-cluster hourly charge | 99.95% (AZ) or 99.9% (non-AZ) uptime SLA | Long-term support versions, Azure Linux container host, advanced networking |

In all tiers, you also pay for the worker node VMs (or Fargate-equivalent resources when using virtual nodes). The control plane cost is separate from the compute cost.

The free tier is a significant differentiator from AWS EKS, which charges for the control plane regardless of usage. For development clusters and experimentation, AKS free tier eliminates the fixed monthly control plane cost entirely.

### Node Pools

AKS uses [node pools](https://learn.microsoft.com/en-us/azure/aks/create-node-pools){:target="_blank" rel="noopener noreferrer"} to group worker nodes with the same VM configuration. Every cluster has at least one system node pool that runs Kubernetes system components like CoreDNS and the metrics server. You add user node pools for application workloads.

**System node pools** run Kubernetes infrastructure pods. They require a minimum of two nodes for reliability (three nodes recommended for production). System node pools should use a VM size with at least 4 vCPUs and 16 GB memory.

**User node pools** run application workloads. You can create multiple user node pools with different VM sizes, enabling scenarios like:
- A general-purpose pool for typical services and a memory-optimized pool for caching workloads
- A GPU-enabled pool for machine learning inference alongside a standard pool for API services
- Spot VM node pools for fault-tolerant batch processing alongside on-demand pools for critical services

Node pools support autoscaling, taints, labels, and availability zone placement. Kubernetes node selectors and tolerations control which pods are scheduled onto which pools.

### Autoscaling

AKS supports three layers of autoscaling that operate at different levels of the deployment:

**Horizontal Pod Autoscaler (HPA)** scales the number of pod replicas based on CPU utilization, memory utilization, or custom metrics. When the average utilization across pods exceeds a target threshold, HPA adds more replicas. This is the standard Kubernetes pod-level scaling mechanism.

**Cluster Autoscaler** scales the number of nodes in a node pool. When pods cannot be scheduled because existing nodes lack sufficient resources, the cluster autoscaler provisions new nodes. When nodes are underutilized, it drains and removes them. The cluster autoscaler operates at the infrastructure level, responding to scheduling pressure rather than application metrics.

**KEDA (Kubernetes Event-Driven Autoscaling)** is available as an [AKS add-on](https://learn.microsoft.com/en-us/azure/aks/keda-about){:target="_blank" rel="noopener noreferrer"} and provides event-driven scaling based on external event sources. KEDA can scale pods based on Azure Service Bus queue depth, Event Hubs partition lag, Cosmos DB change feed activity, HTTP request rate, cron schedules, and dozens of other event sources. KEDA can also scale pods to zero, which HPA cannot do.

These three scaling mechanisms work together across two levels: KEDA or HPA scale pods, and when the cluster cannot accommodate the new pods, the cluster autoscaler provisions additional nodes.

```
Pod-level scaling
├── HPA   → replicas from CPU / memory / custom metrics
└── KEDA  → replicas from event sources (queue depth, lag, cron); can reach zero
        ↓
   more replicas requested than current nodes can schedule
        ↓
Node-level scaling
└── Cluster Autoscaler → provisions nodes; drains and removes idle ones
```

### Networking

AKS supports several [networking models](https://learn.microsoft.com/en-us/azure/aks/concepts-network){:target="_blank" rel="noopener noreferrer"} that determine how pods receive IP addresses and communicate:

**Azure CNI** assigns a VNet IP address to every pod. Pods are directly addressable from anywhere in the VNet, which simplifies communication with non-Kubernetes resources. The trade-off is high IP address consumption; a node pool with 30 pods per node and 100 nodes consumes 3,000 VNet IP addresses. This requires large subnets (a /22 or larger).

**Azure CNI Overlay** assigns pods IP addresses from a private overlay network that is not part of the VNet address space. Only node IPs consume VNet addresses, dramatically reducing IP requirements. Pod-to-pod communication works through encapsulation. This is the recommended model when VNet IP conservation is a priority.

**Kubenet** is the simplest model, where nodes receive VNet IPs but pods receive addresses from a separate CIDR that is managed by Kubernetes. Route tables are required for cross-node pod communication, and there is a limit of 400 nodes per cluster. Kubenet is not recommended for new clusters. Microsoft is retiring kubenet for AKS on March 31, 2028, and both new and existing clusters must move to Azure CNI Overlay before then.

For most new clusters, Azure CNI Overlay provides the best balance of VNet integration and IP conservation. Use standard Azure CNI when pods must be directly addressable from VNet resources without any NAT or overlay.

### Identity and Security

AKS integrates with [Entra ID](https://learn.microsoft.com/en-us/azure/aks/concepts-identity){:target="_blank" rel="noopener noreferrer"} for both cluster access control and workload identity:

**Cluster access** uses Entra ID authentication combined with Kubernetes RBAC. Administrators authenticate to the cluster using their Entra ID credentials, and Kubernetes ClusterRoleBindings and RoleBindings control what they can do. This replaces Kubernetes-native certificate-based authentication with centralized identity management.

**Workload identity** allows pods to authenticate to Azure services like Key Vault, Storage, and SQL Database using federated credentials tied to Kubernetes service accounts. This is the successor to the older pod-managed identity approach and follows the same conceptual model as IRSA on AWS EKS. Pods receive short-lived tokens without managing secrets.

**Managed identities** are assigned to the AKS cluster itself for operations like pulling images from Azure Container Registry, managing network resources, and attaching disks. The cluster uses a system-assigned managed identity or a user-assigned managed identity for these infrastructure-level operations.

### Storage

AKS provides persistent storage through [Container Storage Interface (CSI) drivers](https://learn.microsoft.com/en-us/azure/aks/csi-storage-drivers){:target="_blank" rel="noopener noreferrer"}:

| Storage Type | Access Mode | Use Case |
|-------------|-------------|----------|
| **Azure Disk CSI** | ReadWriteOnce (single node) | Databases, stateful applications needing low latency |
| **Azure Files CSI** | ReadWriteMany (multiple nodes) | Shared configuration, content management, multi-pod access |
| **Azure Blob CSI** | ReadWriteMany (multiple nodes) | Large-scale unstructured data, media storage |

Applications request storage through Persistent Volume Claims (PVCs), and the CSI drivers dynamically provision the underlying Azure storage resources. Storage classes define the performance tier like Premium SSD vs Standard SSD and the reclaim policy that controls whether volumes are deleted or retained when the PVC is removed.

### Upgrades

AKS clusters require two types of upgrades that architects should plan for:

**Kubernetes version upgrades** move the cluster to a newer Kubernetes minor version (for example, 1.28 to 1.29). AKS supports the current and two previous minor versions. The recommended approach is to upgrade the control plane first, then upgrade node pools sequentially. A blue-green node pool strategy creates a new node pool with the target version, cordons the old pool, migrates workloads, and then removes the old pool.

**Node image upgrades** apply OS-level patches and security updates to node images without changing the Kubernetes version. These can be automated through auto-upgrade channels (patch, stable, rapid, or node-image) and maintenance windows.

### AKS Automatic

[AKS Automatic](https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic){:target="_blank" rel="noopener noreferrer"} is a newer cluster configuration mode where Microsoft manages most cluster settings including node provisioning, scaling, security configuration, and networking setup. AKS Automatic uses opinionated defaults based on best practices, automatically configuring features like KEDA, Azure Monitor, workload identity, and network policies.

AKS Automatic targets teams that want the Kubernetes API and ecosystem without making dozens of infrastructure decisions. It reduces the configuration surface area significantly while still allowing workloads to use standard Kubernetes resources like Deployments, Services, and Ingress.

### When to Use AKS

AKS is the right choice when the team needs full Kubernetes capabilities:

- **Complex microservices architectures** that require service mesh, custom operators, or advanced scheduling
- **Teams with existing Kubernetes expertise** who want to leverage their skills and tooling
- **Multi-cloud or hybrid deployments** where Kubernetes provides a consistent platform across environments
- **Workloads requiring StatefulSets, DaemonSets, or custom controllers** that are not available in Container Apps
- **Regulatory environments** that require granular control over networking, encryption, and pod security policies
- **Large-scale deployments** with hundreds of services that need fine-tuned resource management

---

## Azure Container Apps

### What Container Apps Does

[Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview){:target="_blank" rel="noopener noreferrer"} is a serverless container platform built on top of Kubernetes, [KEDA](https://keda.sh/){:target="_blank" rel="noopener noreferrer"}, [Envoy](https://www.envoyproxy.io/){:target="_blank" rel="noopener noreferrer"}, and [Dapr](https://dapr.io/){:target="_blank" rel="noopener noreferrer"}. It provides the benefits of containers (portability, language flexibility, consistent environments) with the operational simplicity of a serverless platform. You deploy container images, define scaling rules, and Container Apps handles infrastructure, networking, and orchestration.

The Kubernetes underpinning is completely abstracted. There are no nodes to manage, no kubectl commands to run, and no cluster configuration to maintain. Container Apps presents a simplified application-centric model where you work with apps, revisions, and environments rather than pods, deployments, and services.

### Container Apps Environments

A Container Apps [environment](https://learn.microsoft.com/en-us/azure/container-apps/environment){:target="_blank" rel="noopener noreferrer"} is the secure boundary around a group of container apps. Apps within the same environment share a virtual network, can discover each other, and write logs to the same Log Analytics workspace. Environments are analogous to a Kubernetes namespace combined with networking and observability infrastructure.

There are two environment types:
- **Workload profiles environments** let you choose the VM sizes underlying your containers (consumption, dedicated general-purpose, or dedicated memory-optimized profiles). This gives cost and performance control similar to choosing node pool VM sizes in AKS.
- **Consumption-only environments** use a fully serverless model where Azure manages all compute resources and you pay only for the vCPU and memory your containers consume per second.

### Scaling and Revisions

Container Apps scales based on rules you define, and it can scale to zero when there is no demand:

**HTTP scaling** adjusts the number of replicas based on the rate of concurrent HTTP requests. You set a target number of concurrent requests per replica, and Container Apps adds or removes replicas to maintain that target.

**Event-driven scaling** uses KEDA scalers to react to external event sources. Container Apps supports scaling based on Azure Service Bus queue length, Event Hubs messages, Azure Storage queue depth, Cosmos DB change feed lag, and many other sources. This is the same KEDA technology available in AKS, but configured through Container Apps' declarative scaling rules rather than Kubernetes custom resources.

**Revisions** represent immutable snapshots of a container app version. Each time you update the container image, environment variables, or scaling rules, Container Apps creates a new revision. You can split traffic between revisions for blue-green or canary deployments. For example, directing 90% of traffic to the stable revision and 10% to a canary revision lets you validate changes under production traffic before committing.

### Built-in Dapr Integration

Container Apps provides optional [Dapr integration](https://learn.microsoft.com/en-us/azure/container-apps/dapr-overview){:target="_blank" rel="noopener noreferrer"} as a managed sidecar. Dapr (Distributed Application Runtime) provides building blocks for common microservices patterns:

- **Service invocation:** Service-to-service calls with automatic service discovery, retries, and mutual TLS
- **Pub/sub messaging:** Publish and subscribe to messages using Azure Service Bus, Event Hubs, or other message brokers without direct SDK dependencies
- **State management:** Store and retrieve application state using Azure Cosmos DB, Azure Table Storage, or Redis without coupling to a specific store
- **Bindings:** Input and output bindings to external systems like databases, queues, and blob storage

Dapr is optional and enabled per-app. When enabled, Container Apps injects the Dapr sidecar automatically. Applications communicate with Dapr over localhost HTTP or gRPC, so the application code remains portable and not tied to any specific Azure service SDK.

### Container Apps Jobs

[Jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs){:target="_blank" rel="noopener noreferrer"} are container apps that run to completion rather than running continuously. They support three trigger types:

- **Manual jobs** are triggered on demand through the API or portal
- **Scheduled jobs** run on a cron schedule (equivalent to Kubernetes CronJobs)
- **Event-driven jobs** are triggered by KEDA-supported event sources like a new message on a queue or a new blob in storage

Jobs are useful for batch processing, scheduled data cleanup, report generation, and any task that should run, complete, and terminate rather than serve ongoing traffic.

### Ingress and Networking

Container Apps provides built-in HTTP [ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview){:target="_blank" rel="noopener noreferrer"} with custom domains and automatic TLS certificate management. Ingress can be configured as external (accessible from the internet) or internal (accessible only from within the Container Apps environment VNet).

The built-in ingress is backed by Envoy proxy and handles TLS termination, traffic splitting between revisions, and session affinity. For most web applications and APIs, the built-in ingress eliminates the need for a separate Application Gateway or reverse proxy.

Container Apps environments can be integrated with a VNet for private networking. When VNet-integrated, the apps can communicate with other Azure resources like databases, storage accounts, and on-premises networks through Private Endpoints and VPN/ExpressRoute gateways.

### When to Use Container Apps

Container Apps is the right choice when teams want container-based deployment without Kubernetes operational overhead:

- **Microservices and APIs** that need autoscaling, traffic splitting, and service discovery without managing Kubernetes
- **Event-driven processing** that responds to queue messages, event streams, or HTTP requests with scale-to-zero capability
- **Web applications** that benefit from container packaging but do not need complex orchestration
- **Teams without Kubernetes expertise** who want container flexibility without the learning curve
- **Dapr-based architectures** where the built-in Dapr integration simplifies microservices communication

---

## Service Selection Framework

### Decision Matrix

The following comparison captures the primary dimensions that drive the choice between Azure's three container services:

| Dimension | ACI | AKS | Container Apps |
|-----------|-----|-----|----------------|
| **Management overhead** | None (fully serverless) | High (cluster, nodes, upgrades) | Low (serverless, managed environment) |
| **Scaling model** | Manual (fixed replica count) | HPA, Cluster Autoscaler, KEDA | Built-in HTTP and event-driven, scale to zero |
| **Orchestration** | None | Full Kubernetes | Abstracted (built on Kubernetes) |
| **Networking** | Public IP or VNet-integrated | Full VNet integration, CNI options, service mesh | Built-in ingress, VNet integration |
| **Cost model** | Per-second vCPU + memory | VM node costs + optional control plane fee | Per-second vCPU + memory (consumption) or workload profiles |
| **Minimum cost** | Zero (when not running) | VM costs for at least two system nodes | Zero (scale to zero in consumption) |
| **Service discovery** | None | Kubernetes DNS, service mesh | Built-in Dapr service invocation |
| **Stateful workloads** | Shared volumes within group | Persistent volumes, StatefulSets | Limited (no persistent volumes, use external stores) |
| **Traffic splitting** | Not supported | Requires ingress controller or service mesh | Built-in revision-based traffic splitting |
| **Custom controllers/operators** | Not applicable | Full support | Not supported |
| **Maximum scale** | 100 container groups per subscription per region (default) | 5,000 nodes per cluster | 1,000 replicas per app (300 via the portal, 1,000 via CLI/ARM) |

### Decision Tree

```
Need the full Kubernetes API (custom operators, StatefulSets,
DaemonSets, service mesh, GPU or node-level control)?
├── Yes → AKS
└── No
    │
    Is the workload short-lived (batch job, build agent, test run)
    or a burst target from an AKS cluster?
    ├── Yes → ACI
    └── No  → Container Apps
             (long-running HTTP services, APIs, event-driven
              processors; scale-to-zero, traffic splitting, Dapr)
```

### Decision Guidance

**Use ACI when:**
- You need to run a container quickly without any platform setup
- The workload is short-lived like a batch job, build agent, or test runner
- You are bursting from AKS and need temporary overflow capacity via virtual nodes
- You need a simple sidecar pattern with a small number of containers sharing a network

**Use AKS when:**
- Your team has Kubernetes expertise and wants to leverage the full ecosystem
- You need advanced Kubernetes features like StatefulSets, DaemonSets, custom operators, or pod disruption budgets
- You require fine-grained control over networking, storage, and security policies
- You are running a large-scale platform with hundreds of services
- Portability across clouds or hybrid environments is a requirement
- You need GPU workloads, custom node configurations, or specialized VM sizes

**Use Container Apps when:**
- You want to run containers without managing Kubernetes infrastructure
- Your applications are HTTP services, APIs, or event-driven processors
- You need scale-to-zero to minimize cost during idle periods
- You want built-in traffic splitting for blue-green or canary deployments
- You are building microservices and Dapr's building blocks align with your communication patterns
- Your team does not have Kubernetes expertise and you want to avoid the learning curve

### Common Progression Pattern

Many organizations follow a natural progression through Azure's container services as their requirements evolve. Teams often start with Container Apps for new microservices because it provides the fastest path to production with the least operational burden. As the architecture grows in complexity and the team encounters requirements that Container Apps cannot satisfy (custom operators, persistent volumes, specialized networking, or the need for full Kubernetes API access), they migrate specific workloads to AKS.

This progression is not one-directional. Some workloads within the same organization will remain on Container Apps permanently because they benefit from the simplicity, while others graduate to AKS. ACI typically remains a supporting service for burst capacity and batch jobs regardless of which primary platform the team uses.

<div class="callout callout--tip">
<p class="callout__title">Start Simple, Graduate When Needed</p>
<p>Container Apps covers the needs of most web APIs, microservices, and event-driven workloads. Start there unless you have a specific requirement that demands full Kubernetes control. The operational cost of managing AKS clusters, node pools, upgrades, and networking is significant and should be justified by concrete needs rather than assumed future requirements.</p>
</div>

---

## Architecture Patterns

### Pattern 1: Event-Driven Microservices on Container Apps

```
Event Source (Service Bus / Event Hubs)
   ↓
Container Apps (KEDA scaler, scale to zero)
   ↓
Processing App (Dapr state management)
   ↓
Output (Cosmos DB / Blob Storage via Dapr output binding)
```

Container Apps handles the scaling automatically. When the Service Bus queue has messages, KEDA scales up replicas to process them. When the queue drains, replicas scale to zero and billing stops. Dapr provides the service invocation, state management, and output binding without coupling the application code to specific Azure SDKs.

**Trade-offs:**
- Minimal operational overhead; no cluster management
- Scale-to-zero keeps costs proportional to actual work
- Limited to Dapr's supported state stores and bindings
- Not suitable if the processing requires persistent local storage

---

### Pattern 2: AKS with Virtual Node Burst to ACI

```
Steady-State Traffic
   ↓
AKS Cluster (system + user node pools)
   ↓
Traffic Spike
   ↓
Virtual Node (ACI) → burst pods scheduled on ACI
   ↓
Spike Subsides → ACI pods terminated, traffic returns to AKS nodes
```

[Virtual nodes](https://learn.microsoft.com/en-us/azure/aks/virtual-nodes){:target="_blank" rel="noopener noreferrer"} register ACI as a Kubernetes node in the AKS cluster. When the cluster autoscaler cannot provision new nodes fast enough (or when you want to avoid over-provisioning nodes for occasional spikes), pods with the appropriate toleration are scheduled onto the virtual node and run as ACI container groups.

**Trade-offs:**
- Handles sudden traffic spikes without pre-provisioning extra nodes
- ACI per-second billing means you pay only for the burst duration
- Virtual node pods have some limitations including no persistent volumes and no DaemonSet support
- ACI networking must be configured to reach the same VNet resources as the AKS cluster

---

### Pattern 3: Multi-Service Platform on AKS

```
Internet
   ↓
Application Gateway / Application Gateway for Containers
   ↓
AKS Cluster
├── System Node Pool (3 nodes, Standard_D4s_v5)
├── General User Pool (autoscale 3-20, Standard_D4s_v5)
├── Memory-Optimized Pool (autoscale 2-10, Standard_E8s_v5)
├── Spot Pool (autoscale 0-30, Standard_D4s_v5, spot VMs)
└── Shared Services (monitoring, ingress controller, cert-manager)
```

This pattern is common for organizations running dozens to hundreds of services on a shared AKS platform. Multiple node pools with different VM sizes and scaling configurations accommodate diverse workload requirements. Spot VM node pools handle fault-tolerant batch processing and development workloads at reduced cost. KEDA provides event-driven scaling for queue processors and stream consumers.

**Trade-offs:**
- Maximum flexibility in resource allocation and scheduling
- Requires significant Kubernetes operational expertise
- Node pool management, upgrades, and capacity planning add operational burden
- Cost optimization requires right-sizing node pools and using Spot VMs strategically

---

### Pattern 4: Container Apps with VNet Integration

```
Internet
   ↓
Container Apps Environment (external ingress, VNet-integrated)
   ├── Frontend App (revision-based traffic splitting: 90% v2, 10% v3)
   ├── API App (Dapr service invocation from frontend)
   ├── Worker App (KEDA scaler on Service Bus queue)
   └── Scheduled Job (cron: nightly data cleanup)
   ↓
Private Endpoints → Azure SQL, Cosmos DB, Key Vault
```

This pattern uses Container Apps as the primary compute platform with VNet integration for secure connectivity to backend Azure services. The frontend app uses revision-based traffic splitting for canary deployments. The API app uses Dapr for service-to-service communication. The worker app scales based on queue depth. A scheduled job handles nightly maintenance tasks.

**Trade-offs:**
- Low operational overhead with serverless management
- Built-in traffic splitting, Dapr integration, and KEDA scaling
- No persistent volume support; stateful data must live in external services
- Less control over networking, pod scheduling, and resource allocation compared to AKS

---

### Pattern 5: Hybrid AKS and Container Apps

```
AKS Cluster
├── Stateful Services (databases, caches requiring persistent volumes)
├── Services needing custom operators or controllers
└── GPU workloads

Container Apps Environment (same VNet)
├── Stateless APIs (scale to zero, revision traffic splitting)
├── Event-driven processors (KEDA scaling)
└── Background jobs (scheduled and event-triggered)

Both connected via VNet peering or shared VNet
```

Some architectures benefit from running both AKS and Container Apps. Workloads that require full Kubernetes features run on AKS, while simpler stateless services and event-driven processors run on Container Apps. Both platforms can be connected through a shared VNet, and services communicate over private networking.

**Trade-offs:**
- Each workload runs on the platform best suited to its requirements
- Higher architectural complexity from managing two platforms
- Requires clear criteria for which workloads go where to prevent confusion
- Networking configuration must ensure both platforms can reach shared backend services

---

## Common Pitfalls

### Pitfall 1: Choosing AKS When Container Apps Would Suffice

**Problem:** Deploying AKS for a handful of stateless HTTP services that do not need custom operators, StatefulSets, or advanced scheduling.

**Result:** The team spends weeks configuring the cluster, node pools, ingress controller, certificate management, and monitoring. Ongoing effort goes to Kubernetes version upgrades, node image patching, and capacity management. The Kubernetes expertise required exceeds the team's current skills, leading to misconfiguration and operational incidents.

**Solution:** Start with Container Apps for stateless HTTP services, APIs, and event-driven workloads. Container Apps provides built-in ingress, TLS, scaling, and monitoring. Migrate to AKS only when you encounter a concrete limitation that Container Apps cannot satisfy.

---

### Pitfall 2: Running Long-Lived Services on ACI

**Problem:** Using ACI to run services that need to be continuously available, like web APIs or background workers that process requests around the clock.

**Result:** ACI's per-second billing model makes it more expensive than AKS or Container Apps for workloads running 24/7. ACI provides no built-in health checking, autoscaling, or traffic management for long-running services. Restarts after failures require external orchestration.

**Solution:** Use ACI for short-lived, burst, or batch workloads. Move continuously running services to Container Apps (for serverless simplicity) or AKS (for full control).

---

### Pitfall 3: Undersizing AKS Subnets for Azure CNI

**Problem:** Deploying AKS with Azure CNI networking into a subnet that is too small. Azure CNI assigns a VNet IP address to every pod, and a cluster with 10 nodes running 30 pods each consumes 300 IP addresses just for pods plus the node IPs.

**Result:** Pod scheduling fails when the subnet runs out of IP addresses. The cluster cannot scale, and new deployments fail with IP exhaustion errors. Resizing the subnet after deployment is disruptive.

**Solution:** Calculate IP requirements before creating the cluster: (max pods per node) x (max nodes) + (node count) + (buffer for upgrades). Use a /22 or larger subnet for production AKS clusters with Azure CNI. Consider Azure CNI Overlay if VNet IP conservation is a priority, since it only consumes VNet IPs for nodes rather than for every pod.

---

### Pitfall 4: Ignoring AKS Upgrade Planning

**Problem:** Allowing an AKS cluster to fall behind on Kubernetes versions until Microsoft forces the upgrade or the version goes out of support.

**Result:** Forced upgrades skip multiple versions at once, increasing the risk of breaking changes. Applications that depend on deprecated Kubernetes APIs break during the upgrade. The cluster enters an unsupported state where Microsoft cannot provide support for issues.

**Solution:** Establish a regular upgrade cadence that keeps the cluster within the supported version window (current and two previous minor versions). Test upgrades in a non-production cluster first. Use the blue-green node pool strategy for zero-downtime production upgrades: create a new node pool with the target version, migrate workloads, validate, and then remove the old pool.

---

### Pitfall 5: Not Using Scale-to-Zero on Container Apps

**Problem:** Configuring Container Apps with a minimum replica count of 1 or higher for workloads that have long idle periods between bursts of activity.

**Result:** You pay for running replicas during idle periods when no requests or events are being processed. For services with sparse traffic patterns, this can double or triple the monthly cost compared to scale-to-zero.

**Solution:** Set the minimum replica count to 0 for workloads that tolerate cold start latency (typically a few seconds). Event-driven processors, background workers, and low-traffic APIs are good candidates. Keep a minimum of 1 replica only for latency-sensitive services where cold start delay is unacceptable.

---

### Pitfall 6: Overlooking Container Apps Workload Profiles for Cost Control

**Problem:** Running all Container Apps on the consumption plan when some workloads have predictable, steady resource requirements that would be cheaper on dedicated compute.

**Result:** The consumption plan charges per-second for vCPU and memory, which can become expensive for workloads running continuously at high utilization. Consumption pricing is ideal for spiky or idle workloads but not for steady-state compute.

**Solution:** Evaluate workload profiles for Container Apps environments. The dedicated general-purpose and memory-optimized profiles provide fixed-price compute similar to reserving VM capacity. Use consumption for spiky and idle workloads, and dedicated profiles for workloads that run continuously at predictable utilization levels.

---

## Key Takeaways

1. **Azure provides three container platforms for three different operational models.** ACI is for running individual containers without any platform. AKS is for teams that need full Kubernetes. Container Apps is the serverless middle ground that covers most web, API, and event-driven workloads without Kubernetes complexity.

2. **Container Apps is the default starting point for most new container workloads.** It provides built-in scaling (including scale-to-zero), traffic splitting, Dapr integration, and managed ingress with no cluster management. Start here and graduate to AKS only when you hit a concrete limitation.

3. **AKS differentiates from AWS EKS with a free control plane tier.** Development and testing clusters incur no control plane cost on the free tier. Production clusters on the standard tier include an uptime SLA. This makes it cheaper to run multiple AKS clusters for environment isolation compared to EKS.

4. **ACI is a supporting service, not a primary platform.** Use ACI for batch jobs, build agents, burst capacity from AKS (virtual nodes), and short-lived tasks. Its per-second billing model makes it cost-effective for workloads that run for minutes or hours, but expensive for 24/7 services.

5. **AKS operational overhead is significant and must be justified.** Cluster upgrades, node pool management, networking configuration, storage provisioning, and security policies all require Kubernetes expertise. The Kubernetes ecosystem provides unmatched flexibility, but that flexibility comes with ongoing operational investment.

6. **Container Apps' KEDA and Dapr integration eliminates significant microservices boilerplate.** KEDA provides event-driven autoscaling from dozens of sources with declarative configuration. Dapr provides service invocation, pub/sub, and state management without coupling to specific Azure service SDKs. Both are available on AKS as add-ons, but Container Apps manages them automatically.

7. **Networking decisions compound across all three services.** ACI needs VNet integration for private workloads. AKS networking model choice (Azure CNI vs CNI Overlay vs kubenet) affects IP consumption and subnet sizing. Container Apps environments integrate with VNets for private connectivity. Plan networking early and consistently across the services you use.

8. **Traffic splitting on Container Apps replaces the need for separate blue-green infrastructure.** Revision-based traffic splitting lets you direct a percentage of traffic to a new version, monitor for errors, and then shift fully or roll back. This is a built-in feature that requires no additional tooling.

9. **Hybrid architectures using both AKS and Container Apps are a legitimate pattern.** Run stateful services, GPU workloads, and operator-dependent applications on AKS while running stateless APIs and event processors on Container Apps. Connect them through a shared VNet for private communication.

10. **Scale-to-zero on Container Apps and spot instances on ACI and AKS are the primary cost optimization levers.** For workloads with variable demand, scale-to-zero eliminates idle cost entirely. For fault-tolerant workloads, spot VMs (AKS) and spot container instances (ACI) provide significant discounts. Combine these with workload profiles on Container Apps for steady-state workloads to optimize cost across the board.
