---
title: "Advanced Container Patterns on Azure"
layout: guide
category: Azure
subcategory: Container Orchestration (Advanced)
description: "AKS pod networking as an IPAM choice separate from the data plane, the Istio add-on and what it cannot do, KEDA event-driven autoscaling, GitOps with Flux v2, workload identity token exchange, and node autoscaling now that node auto-provisioning is Karpenter"
tags: [aks, kubernetes, keda, gitops, workload-identity, service-mesh, advanced]
---

## What Are Advanced Container Patterns

[Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/aks/intro-kubernetes){:target="_blank" rel="noopener noreferrer"} (AKS) gives you managed Kubernetes. Turning that into a production platform means decisions about IP address consumption, pod-to-Azure authentication, how nodes appear and disappear, how deployments reach the cluster, and how much of the network you are willing to put a proxy in front of.

This guide covers those decisions and the Azure-specific mechanics behind them.

### What Problems Advanced Container Patterns Solve

**Without them:**
- Pod IP allocation exhausts VNet address space and caps cluster growth
- Scaling responds to CPU, not to the queue depth that actually drives the work
- Pod-to-Azure authentication depends on secrets someone has to rotate
- Deployments drift from what is in source control, with no record of who changed what
- Node capacity is either over-provisioned or too slow to appear
- Cost is discovered after the fact

**With them:**
- Pod IPs come from a CIDR outside the VNet, so cluster scale is bounded by the API server rather than by a subnet
- Event-driven autoscaling reacts to queue depth, consumer lag, and custom metrics, down to zero replicas
- Workload identity federates a Kubernetes service account to a managed identity, with no secret anywhere
- GitOps reconciles the cluster against Git continuously and reverts manual changes
- Node auto-provisioning picks the VM SKU that fits the pending pods instead of scaling a pool you sized in advance
- Spot pools, right-sizing, and scale-to-zero are applied where the workload tolerates them

### How Azure AKS Differs from AWS EKS

| Concept | AWS EKS | Azure AKS |
|---------|---------|-----------|
| **Pod networking** | VPC CNI assigns VPC IPs to pods by default | Azure CNI Overlay is the default and recommended option, with pod IPs outside the VNet; flat networking is available through Azure CNI Pod Subnet |
| **Node autoscaling** | Cluster Autoscaler, or Karpenter | Cluster Autoscaler, or node auto-provisioning, **which is Karpenter** with an AKS provider |
| **Service mesh** | Community options, self-managed | Istio-based add-on with an Azure-managed control plane |
| **Workload identity** | IAM Roles for Service Accounts (IRSA) | Microsoft Entra Workload ID, also OIDC federation |
| **GitOps** | Flux or Argo CD, self-installed or add-on | Flux v2 through the AKS GitOps extension, managed by Azure |
| **Event-driven autoscaling** | KEDA, self-installed | KEDA as a managed AKS add-on |
| **Multi-cluster** | Self-assembled | Azure Kubernetes Fleet Manager |

---

## Pod Networking

### IPAM and Data Plane Are Separate Choices

The most common mistake in AKS network planning is treating "Azure CNI Overlay" and "Azure CNI Powered by Cilium" as two entries in the same list. They are answers to different questions.

**IPAM** decides where pod IP addresses come from. **The data plane** decides how packets are processed. Azure CNI Powered by Cilium is a data plane, and it composes with Azure CNI Overlay, Azure CNI Pod Subnet, or Azure CNI Node Subnet. You pick one of each.

AKS has two networking models, and the IPAM options sit under them:

```
  OVERLAY  (Azure CNI Overlay)             FLAT  (Azure CNI Pod Subnet)

  ┌── VNet 10.0.0.0/16 ─────────────┐      ┌── VNet 10.0.0.0/16 ─────────────┐
  │  node subnet 10.0.0.0/24        │      │  node subnet 10.0.0.0/24        │
  │    ┌───────────────┐            │      │    ┌───────────────┐            │
  │    │ node 10.0.0.4 │            │      │    │ node 10.0.0.4 │            │
  │    └───────┬───────┘            │      │    └───────┬───────┘            │
  └────────────┼────────────────────┘      │  pod subnet 10.0.1.0/24         │
               │ egress SNAT'd              │    ┌──────┴────────┐           │
               │ to the node IP             │    │ pod 10.0.1.7  │           │
  ┌────────────┴────────────────────┐      │    └───────────────┘            │
  │  pod CIDR 10.244.0.0/16         │      └─────────────────────────────────┘
  │  (not part of the VNet)         │
  │    ┌───────────────┐            │       a peered VNet or on-premises host
  │    │ pod 10.244.0.7│            │       sees 10.0.1.7 and can open a
  │    └───────────────┘            │       connection *to* the pod
  └─────────────────────────────────┘

   a peered VNet sees only 10.0.0.4.        Costs one VNet IP per pod, so the
   Pods can initiate outbound, but          address plan has to hold every pod
   nothing outside can initiate in.         you will ever run.
```

That difference in direction is the whole decision. Overlay conserves addresses and scales, but connections must be **pod-initiated**. Flat networking costs VNet addresses and buys **both-ways** connectivity, which you need when an on-premises system has to call a pod directly.

### The Options

| IPAM option | Model | Position | Notes |
|---|---|---|---|
| **Azure CNI Overlay** | Overlay | Recommended default | Pod IPs from a separate CIDR; 250 pods per node with cluster size bounded by the API server; no direct inbound pod access |
| **Azure CNI Pod Subnet** | Flat | Recommended for flat scenarios | Pods get VNet IPs from a dedicated pod subnet and keep their IP across peered networks; has modes for efficient IP usage or for large-scale clusters (preview) |
| **Azure CNI Node Subnet** | Flat | Legacy | Pods take IPs from the node subnet; limited scale and inefficient address use. Use only when you need an AKS-managed VNet |
| **kubenet** | Overlay | **Retires 31 March 2028** | Manual user-defined routes, limited scale, no Windows node pools, no subnet sharing across clusters, and no Application Gateway for Containers |

Note the distinction that the flat options do not share: with **Azure CNI Pod Subnet**, destinations in peered networks see the pod's own IP. With **Azure CNI Node Subnet**, destinations inside the cluster VNet see the pod IP but destinations outside it see the node IP.

If you are still on kubenet, the migration target is Azure CNI Overlay and the deadline is fixed. Azure's own portal presets (Production Standard, Dev/Test, Production Economy, and Production Enterprise) all now default to Azure CNI Overlay.

### Cluster Limits That Shape the Plan

| Limit | Value |
|---|---|
| Max nodes per cluster (VMSS + Standard Load Balancer) | 5,000 across all node pools |
| Max nodes per node pool | 1,000 |
| Max node pools per cluster | 100 |
| Max pods per node, Azure CNI or kubenet | 250 (default 30 in the portal, 110 via CLI and ARM for kubenet) |
| Max load-balanced Kubernetes services per cluster | 300 |
| Max clusters per subscription globally | 5,000 |

Two more constraints surface as confusing failures rather than clear ones. **Reserved CIDR ranges** (`169.254.0.0/16`, `192.0.2.0/24`, `172.30.0.0/16`, and `172.31.0.0/16`) are rejected for service, pod, and VNet ranges, which means a seemingly reasonable `172.16.0.0/12` pod CIDR is invalid because it contains two of them. And **upgrades temporarily consume extra IPs and vCPU quota**, so a subnet or quota sized exactly to steady state fails the first time you upgrade a node pool.

### Azure CNI Powered by Cilium

Cilium replaces the iptables-based data plane with eBPF programs in the kernel. What that buys:

- Packet processing without the iptables rule-count problem that grows with service count
- Network policy at Layer 7 (HTTP methods and paths, gRPC, Kafka) in addition to L3/L4
- Hubble flow observability, including DNS-level visibility and service dependency maps
- Transparent WireGuard encryption between pods

Two costs come with it. eBPF troubleshooting needs skills your team may not have, and Cilium's extended policy model means some standard Kubernetes NetworkPolicy semantics behave differently than on other engines.

### Network Policy Engines

| Engine | Policy scope | When to choose it |
|--------|---|---|
| **Azure Network Policy Manager** | L3/L4 | Simple isolation requirements with no appetite for another component |
| **Calico** | L3/L4, global network policy, egress controls | Cluster-wide policy that isn't namespace-bound |
| **Cilium** | L3/L4 plus L7, with observability and encryption | Layer 7 enforcement, or performance and visibility requirements |

The portal presets ship with network policy set to **None**, including the production ones. A cluster created from a preset has no pod-to-pod isolation at all until you enable an engine, and you cannot change the engine after cluster creation without recreating the cluster.

---

## Service Mesh

### What a Mesh Buys, and What It Costs

A mesh puts a proxy beside every pod and takes over service-to-service traffic. In exchange you get uniform mTLS, retries, timeouts, circuit breaking, traffic splitting, and per-hop telemetry, without changing application code.

The cost is a proxy per pod: memory, CPU, an extra network hop each way, and a second system that can be the reason traffic is behaving strangely. Both the resource overhead and the latency depend heavily on the workload, and Microsoft publishes no figures for either. Measure your own baseline before and after enabling a mesh rather than budgeting from someone else's numbers.

### Options on AKS

| Mesh | Management | Status |
|---|---|---|
| **Istio-based add-on** | Azure-managed control plane, with managed upgrades | The supported path |
| **Open Service Mesh (OSM)** | Was an AKS add-on | **Unsupported from 30 September 2027**; the upstream project is retired. Migrate to the Istio add-on |
| **Linkerd** | Self-managed | Lighter and simpler, but no Azure add-on, no managed upgrades, and no Azure support |

### The Istio Add-On and Its Limits

The [Istio-based service mesh add-on](https://learn.microsoft.com/en-us/azure/aks/istio-about){:target="_blank" rel="noopener noreferrer"} runs a control plane that Microsoft scales, configures, and upgrades on your trigger, with Istio versions tested against supported AKS versions. It comes with verified ingress setup and verified integration with Azure Monitor managed Prometheus and Azure Managed Grafana. AKS also adjusts `coredns` scaling when the mesh is enabled.

What it **cannot** do is the part to check against your design before you commit:

- **No ambient mode.** The add-on is sidecar-only. Ambient is on the roadmap, not in the product.
- **No multi-cluster deployments.** If your design assumed a mesh federated across clusters, the add-on does not do that.
- **No Windows Server containers**, because upstream Istio does not support them.
- **No virtual node pods in the mesh.**
- **Blocked custom resources:** `ProxyConfig`, `WorkloadEntry`, `WorkloadGroup`, `IstioOperator`, and `WasmPlugin`.
- **Gateway API and GAMMA are not supported yet**, though ingress support is in development. Ingress gateways accept annotation and `externalTrafficPolicy` customization but not port or protocol configuration.
- **`MeshConfig` is only partly customizable**, and `EnvoyFilter` is allowed but out of support scope.
- **It conflicts with the OSM add-on and with self-managed Istio**, so an OSM migration is a replacement, not an overlay.

### When You Do Not Need One

You probably do not need a mesh if you have few services, if you already get distributed tracing from OpenTelemetry instrumentation, or if your security requirement is isolation rather than in-transit encryption between every pair of pods.

The alternatives cover most of what people actually want from a mesh: OpenTelemetry SDKs for tracing and metrics, an API gateway for edge traffic management, and Cilium or Calico network policies for pod-to-pod authorization. Reach for a mesh when you need mTLS everywhere, or traffic splitting that the application cannot do for itself.

---

## Event-Driven Autoscaling with KEDA

### What KEDA Adds

The Horizontal Pod Autoscaler scales on CPU and memory. [KEDA](https://keda.sh/){:target="_blank" rel="noopener noreferrer"} extends it to scale on external signals such as queue depth, consumer lag, or a Prometheus query, and, unlike HPA alone, it can scale **to zero**. AKS ships it as a managed add-on.

**The moving parts:**
- **ScaledObject** attaches autoscaling rules to a Deployment or StatefulSet
- **ScaledJob** scales Kubernetes Jobs from an event source, which fits work that must run to completion
- **Scaler** is the plugin for a given source
- **Metrics adapter** feeds the external metric to HPA, which still does the actual scaling

Underneath, KEDA creates and manages an HPA for you. That matters when you debug: a `ScaledObject` that isn't scaling is often an HPA that cannot read its external metric.

### Common Azure Scalers

| Scaler | Metric | Fits |
|--------|-------------|----------|
| **Azure Service Bus** | Queue or subscription message count, or message age | Background job processing |
| **Azure Storage Queue** | Message count | Simple job queues |
| **Azure Blob Storage** | Blob count in a container | Batch processing of uploaded files |
| **Azure Event Hubs** | Unprocessed event count (lag) | Stream processing |
| **Azure Pipelines** | Queued agent jobs | Self-hosted build agents |
| **Prometheus** | Any PromQL query | Business metrics like pending orders |
| **Kafka** | Consumer group lag | Event streaming |

### Scaling on a Service Bus Queue

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
  pollingInterval: 30
  cooldownPeriod: 300
  triggers:
    - type: azure-servicebus
      metadata:
        queueName: orders
        namespace: mycompany-servicebus
        messageCount: "10"
        activationMessageCount: "1"
      authenticationRef:
        name: azure-servicebus-auth
---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: azure-servicebus-auth
  namespace: production
spec:
  podIdentity:
    provider: azure-workload
    identityId: 12345678-1234-1234-1234-123456789abc
```

`messageCount` is the target **per replica**, so 100 messages against a target of 10 asks for 10 pods. The two fields people leave out are the ones that control behavior at the edges: `activationMessageCount` is the threshold for leaving zero at all, distinct from the scaling target, and `cooldownPeriod` is how long KEDA waits with no events before returning to zero. Set the cooldown too low and a bursty queue thrashes between zero and N.

Authenticate the scaler with workload identity through a `TriggerAuthentication`, not a connection string in a secret. This is the same federation described below, applied to the KEDA operator's own access to Service Bus.

### When Not to Use It

Scale to zero is the feature and also the trap. Do not use it where the first request after idle cannot absorb a pod start, and do not use it for anything that needs to be continuously available. Set `minReplicaCount` above zero instead, which still gives you event-driven scaling without the cold path. If CPU is genuinely the right signal, plain HPA is one fewer component.

---

## GitOps with Flux v2

### The Model

Git holds the declarative state. An operator in the cluster pulls from Git, applies it, and continuously reconciles, so a manual `kubectl edit` is reverted rather than silently kept. Nobody needs cluster credentials to deploy, which removes the most common reason for handing out admin access.

The [AKS GitOps extension](https://learn.microsoft.com/en-us/azure/azure-arc/kubernetes/conceptual-gitops-flux2){:target="_blank" rel="noopener noreferrer"} installs and manages Flux v2 as a cluster extension, and works the same way on Arc-enabled Kubernetes as it does on AKS.

**Flux's controllers**, each of which fails independently, so knowing their names is what makes a stalled reconciliation diagnosable:
- **Source controller** fetches from Git, Helm repositories, OCI registries, and buckets
- **Kustomize controller** builds and applies Kustomize overlays
- **Helm controller** manages Helm releases
- **Notification controller** sends alerts outbound and receives webhooks inbound

### Configuring It

The Azure-managed configuration is an ARM resource, created with the CLI rather than by applying a CRD:

```bash
az k8s-configuration flux create \
  --resource-group myRG \
  --cluster-name myAKS \
  --cluster-type managedClusters \
  --name my-app-prod \
  --namespace flux-system \
  --scope cluster \
  --url https://github.com/mycompany/my-app-gitops \
  --branch main \
  --kustomization name=prod path=./overlays/prod prune=true sync_interval=5m
```

That provisions the controllers and creates the underlying Flux custom resources in the cluster, which you can also read and debug directly:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: prod
  namespace: flux-system
spec:
  interval: 5m
  path: ./overlays/prod
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-app-prod
```

`prune: true` is the setting that makes GitOps mean what people assume it means: without it, deleting a manifest from Git leaves the resource running in the cluster forever.

### Repository Structure

A `base/` directory with the common manifests and an `overlays/<env>/` directory per environment is the standard Kustomize layout, and it maps cleanly onto one Flux configuration per environment pointing at a different path.

**Where GitOps stops being the right tool:**
- **Secrets.** Put them in Key Vault and pull them with the Secrets Store CSI driver or External Secrets Operator. Committing encrypted secrets works but makes rotation a code change.
- **Generated manifests** that change on every build. Generate them with Kustomize or Helm at reconcile time instead of committing the output.
- **One repository for every team**, which turns deployment into a merge-conflict queue. Split by team or workload and let Flux compose from multiple sources.

---

## Workload Identity

### How the Token Exchange Works

[Microsoft Entra Workload ID](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview){:target="_blank" rel="noopener noreferrer"} lets a pod authenticate to Azure with no stored credential. The cluster acts as an OIDC token issuer, and Entra ID trusts it for a specific service account.

```
  ┌────────────────────────────┐
  │ Pod                        │  label:      azure.workload.identity/use: "true"
  │  serviceAccountName: my-app│  annotation: azure.workload.identity/client-id
  └─────────────┬──────────────┘
                │ 1. kubelet projects a service account token,
                │    audience api://AzureADTokenExchange,
                │    at the path in $AZURE_FEDERATED_TOKEN_FILE
                ▼
  ┌────────────────────────────┐   2. token + client ID   ┌──────────────────────┐
  │ Azure Identity library     │─────────────────────────▶│  Microsoft Entra ID  │
  │ (DefaultAzureCredential)   │                          │                      │
  └─────────────▲──────────────┘                          └──────────┬───────────┘
                │                                                    │ 3. fetches
                │                                                    │    the JWKS
                │  5. Entra access token                             ▼    to verify
                │                                         ┌──────────────────────┐
                │                                         │  AKS OIDC issuer     │
                │      4. the federated identity           │ /.well-known/openid- │
                │         credential on the managed        │   configuration      │
                │         identity must match this         │ /openid/v1/jwks      │
                │         issuer URL and subject           └──────────────────────┘
                ▼
  ┌────────────────────────────┐
  │ Azure resource (Key Vault) │  authorized by the managed identity's RBAC
  └────────────────────────────┘
```

Nothing is stored. The trust lives in the **federated identity credential** on the managed identity, which pins an issuer URL and a subject of the form `system:serviceaccount:<namespace>:<name>`.

### Setting It Up

Annotate the service account and label the pod:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  namespace: production
  annotations:
    azure.workload.identity/client-id: "12345678-1234-1234-1234-123456789abc"
---
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
```

The pod label is **required**, not decorative. Only labeled pods are mutated by the admission webhook, and AKS treats its absence as fail-close: a pod that needs workload identity without the label fails after restart. The webhook injects `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_FEDERATED_TOKEN_FILE`, so you do not set them yourself, and `DefaultAzureCredential` reads them without any code change.

Two rules the client libraries enforce that trip people up. **Read the token path from `AZURE_FEDERATED_TOKEN_FILE`** rather than hard-coding a mount path, because the path is a webhook implementation detail and a pod can project more than one token. And **request scopes in the v2 format `<resource>/.default`**, because workload identity uses the Entra v2 token endpoint, not the IMDS `resource` flow that managed identity uses, and a bare resource URI can simply fail.

### Limits and Incompatibilities

- **20 federated identity credentials per managed identity.** This is the ceiling people hit first: one credential per cluster per service account means a fleet of clusters exhausts a shared identity quickly. Identity bindings, in preview, exist to let many clusters share one credential.
- **Virtual nodes are not supported.** The virtual-kubelet-based add-on cannot use workload identity at all.
- Federated credential creation on user-assigned identities is unavailable in some regions.
- Changing a service account annotation requires restarting the pod.

**AKS Automatic** preconfigures workload identity and the OIDC issuer; on AKS Standard you enable both explicitly.

Microsoft Entra pod-managed identity is the previous approach and is being replaced by this one. Migrate rather than running both, because the two put different credentials in front of the same application and produce intermittent, hard-to-attribute authentication failures. A migration sidecar exists that proxies IMDS calls to OIDC as a bridge, but the destination is a supported Azure Identity library version.

---

## Node Pool Strategies

### System and User Pools

| Pool | Runs | Constraints |
|-----------|---------|-----------------|
| **System** | CoreDNS, metrics-server, and other `kube-system` workloads | At least one node, cannot scale to zero, and can be tainted with `CriticalAddonsOnly` to repel application pods |
| **User** | Application workloads | Can scale to zero and can be deleted |

Keep them separate. A system pool starved by an application workload takes CoreDNS down with it, and DNS failure inside a cluster presents as every service being intermittently broken.

Size the system pool with the restrictions in mind: AKS requires at least 2 vCPU and 4 GB for system pool VMs, does not support B-series burstable VMs there, and does not recommend Av1. User pools need at least 2 vCPU and 2 GB. Since May 2025, a cluster created without an explicit VM SKU gets one AKS selects from available capacity rather than the old `Standard_DS2_v2` default, so pin the SKU if you care what you get.

### Spot Node Pools

Spot pools run on surplus capacity at a discount, with eviction when Azure needs it back. Evictions come with **30 seconds** of notice, which is enough for a graceful shutdown if your pods handle `SIGTERM` and not enough if they don't.

The discount varies by SKU, region, and current demand, and Microsoft publishes no fixed percentage. Check the portal's pricing history view or query the Azure Resource Graph `SpotResources` table for the current rate on the SKUs you're considering rather than planning against a number from a blog post.

Spot suits batch processing, CI/CD agents, and stateless replicas with several copies. It does not suit single-replica deployments, stateful workloads without graceful shutdown, or anything latency-sensitive. Run spot alongside an on-demand pool and use pod topology spread constraints so an eviction wave cannot take every replica at once.

### GPU Node Pools

AKS installs GPU drivers and the device plugin for you. Pods must request `nvidia.com/gpu` in their resource limits to land on GPU nodes, and the pools should be tainted so that pods which don't need a GPU cannot occupy one. Because the hourly cost dwarfs CPU nodes, GPU pools are the strongest case for scaling to zero when idle.

### Virtual Nodes

Virtual nodes schedule pods onto Azure Container Instances instead of VMs, so they start without waiting for a node to be provisioned.

The limitations decide it for most clusters. Virtual nodes do **not support workload identity** and **cannot be added to the Istio mesh**, alongside the usual exclusions of DaemonSets, host networking, and stateful workloads. On a cluster built around federated identity and a mesh, which is most production AKS, that rules them out. Node auto-provisioning covers the same fast-scaling need without the exclusions.

---

## Node Autoscaling

### Cluster Autoscaler

The [Cluster Autoscaler](https://learn.microsoft.com/en-us/azure/aks/cluster-autoscaler){:target="_blank" rel="noopener noreferrer"} watches for unschedulable pods and adds nodes to an existing node pool, then removes nodes that stay underutilized.

| Parameter | Controls | Default or typical |
|-----------|---------|---------------|
| `--min-count` / `--max-count` | Node pool bounds | 0 for user pools where the workload tolerates it |
| `--scale-down-delay-after-add` | Delay before scale-down can follow a scale-up | 10 minutes |
| `--scale-down-unneeded-time` | How long a node must look unneeded | 10 minutes |
| `--scale-down-utilization-threshold` | Utilization below which a node is a candidate | 0.5 |

The autoscaler only chooses from the SKUs you already defined, so a pod requesting more memory than any pool's VM provides stays pending forever rather than triggering a larger node.

### Node Auto-Provisioning Is Karpenter

[Node auto-provisioning](https://learn.microsoft.com/en-us/azure/aks/node-auto-provisioning){:target="_blank" rel="noopener noreferrer"} (NAP) is generally available, and it is not merely "inspired by" Karpenter. AKS deploys, configures, and manages **Karpenter itself**, through the open-source AKS Karpenter provider.

The difference from Cluster Autoscaler is what it is allowed to decide. NAP reads the pending pods' actual requirements (CPU, memory, architecture, GPU, zone) and provisions a node of a SKU that fits, rather than adding another copy of a SKU you picked in advance. It also consolidates, moving pods onto fewer nodes and removing the emptied ones.

You configure it with Karpenter's own resources: `NodePool` for the constraints on what may be provisioned, and `AKSNodeClass` for the Azure-specific node configuration. A migration path from Cluster Autoscaler is documented.

Cluster Autoscaler remains the right choice where you need to pin workloads to specific, pre-declared node pools, or where a fixed SKU is a compliance or licensing requirement.

---

## Multi-Cluster with Fleet Manager

[Azure Kubernetes Fleet Manager](https://learn.microsoft.com/en-us/azure/kubernetes-fleet/overview){:target="_blank" rel="noopener noreferrer"} manages a group of AKS clusters as one unit, across regions and subscriptions.

**What it does:**
- **Update orchestration** across member clusters in a defined order, with update runs and stages, so a Kubernetes version rolls through staging before production
- **Resource propagation** through `ClusterResourcePlacement`, which copies selected cluster-scoped resources and namespaces from the hub to member clusters
- **Multi-cluster load balancing and service discovery**, where a service exported from one cluster becomes reachable from others
- **GitOps at scale**, applying Flux configurations across the fleet from one definition

Placement policies select which members receive a resource: all of them, a fixed list, or *N* chosen by the scheduler with affinity and topology spread. That last mode is what makes a fleet useful for regional distribution rather than just fan-out.

**What to weigh:** cross-cluster calls pay inter-region latency and inter-region egress charges, so a fleet is a deployment and lifecycle tool first and a runtime topology second. Design so the common path stays inside one cluster and cross-cluster traffic is the exception.

---

## Confidential Containers

Confidential containers on AKS run pods inside hardware-backed Trusted Execution Environments on AMD SEV-SNP, using Kata Containers to give each pod its own memory-encrypted utility VM. The host OS, the hypervisor, and Azure operators cannot read pod memory, and remote attestation lets a workload prove it is running in a genuine TEE before a secret is released to it.

This fits multi-party computation, processing of data whose owner does not trust your infrastructure, and regulatory requirements that name data-in-use protection specifically. It costs you a restricted set of VM SKUs, a smaller memory ceiling, encryption overhead, and a key release flow to design.

It is a specialized tool. Most workloads should be on standard node pools, and reaching for confidential containers without a data-in-use requirement buys complexity and nothing else.

---

## Cost Optimization

**Spot pools** for anything interruption-tolerant, with topology spread across an on-demand pool so evictions degrade rather than break the service.

**Scale to zero** on user node pools and on GPU pools, and on workloads themselves through KEDA where cold start is acceptable.

**Cluster stop/start** for development and test clusters that nobody uses at night. [Stopping a cluster](https://learn.microsoft.com/en-us/azure/aks/start-stop-cluster){:target="_blank" rel="noopener noreferrer"} deallocates the nodes and stops the control plane. Restart takes long enough that this is a scheduled action, not an on-demand one, so pair it with an automation schedule rather than expecting people to run it.

**Right-sizing with the [Vertical Pod Autoscaler](https://learn.microsoft.com/en-us/azure/aks/vertical-pod-autoscaler){:target="_blank" rel="noopener noreferrer"}.** VPA observes actual usage and adjusts CPU and memory requests, which attacks the most common source of waste: requests copied from an example and never revisited. Its `updateMode` values are `Off` (recommendations only), `Initial` (set at pod creation), `Recreate`, and `Auto`. Run `Off` in production and apply the recommendations deliberately, because the modes that act do so by evicting pods.

**Do not run VPA and HPA against the same resource metric.** VPA raising requests while HPA scales on CPU utilization produces a feedback loop where each one's action changes the other's input.

**Reservations and savings plans** for the baseline capacity that never scales to zero, typically the system pool and the floor of the user pools. Remember that a VM reservation covers compute only, has instance size flexibility but **no region flexibility**, and is therefore a poor fit for a fleet that might move regions.

**Cost visibility** through Azure Cost Management, broken down by node pool and, with the AKS cost analysis add-on, by namespace. Namespace-level attribution is what turns an argument about the cluster bill into a conversation with the team that owns the workload.

---

## Common Pitfalls

### Pitfall 1: Choosing Flat Networking Without an Address Plan

**Problem:** Deploying with Azure CNI Node Subnet or Pod Subnet into a subnet sized for the nodes rather than for every pod.

**Result:** The cluster stops scaling. Pods sit pending with IP allocation errors, and the fix means renumbering a subnet that peered networks and firewall rules already depend on.

**Solution:** Use Azure CNI Overlay unless you specifically need inbound connectivity to pod IPs. If you do need flat networking, size for (max pods per node × max nodes) plus node and upgrade headroom, and use Azure CNI Pod Subnet rather than the legacy node subnet mode.

---

### Pitfall 2: Designing Around Istio Features the Add-On Doesn't Have

**Problem:** Planning a multi-cluster mesh, ambient mode, Gateway API routing, or a `WasmPlugin` on the Azure-managed Istio add-on.

**Result:** None of those are supported. The design either drops back to self-managed Istio, losing managed upgrades and Azure support, or gets rebuilt late.

**Solution:** Check the add-on's limitation list against the design before committing. If you need what the add-on blocks, decide deliberately to self-manage, and note that the add-on and self-managed Istio cannot coexist on one cluster.

---

### Pitfall 3: Scaling to Zero Where Cold Start Is Not Acceptable

**Problem:** KEDA `minReplicaCount: 0` on a workload that serves interactive requests.

**Result:** The first request after an idle period waits for a pod to schedule, pull, start, and pass its readiness probe. Under a load balancer with a short timeout, it fails outright.

**Solution:** Keep `minReplicaCount` at 1 or more for anything user-facing and take the event-driven scaling without the zero. Reserve scale-to-zero for queue-driven work where latency to first message does not matter, and tune `activationMessageCount` and `cooldownPeriod` so a trickle of messages doesn't thrash the deployment.

---

### Pitfall 4: Exhausting Federated Identity Credentials

**Problem:** One managed identity shared across many clusters or many service accounts, with a federated credential added for each.

**Result:** The 21st credential is rejected. On a growing fleet this appears as cluster provisioning failing for reasons unrelated to the cluster.

**Solution:** Use a managed identity per workload rather than a shared one, count credentials against the limit of 20 during design, and evaluate identity bindings if a single identity genuinely must span many clusters.

---

### Pitfall 5: Autoscaling Without Pod Disruption Budgets

**Problem:** Cluster Autoscaler or NAP consolidation enabled, with no PDBs on the services that matter.

**Result:** Scale-down and consolidation drain nodes freely, and a multi-replica service can lose all of its replicas at once because nothing told the scheduler otherwise.

**Solution:** Define a PDB for every service that has an availability requirement. Note the other direction too: a PDB that can never be satisfied, such as `minAvailable` equal to the replica count, blocks scale-down and node upgrades entirely.

---

### Pitfall 6: Creating a Cluster From a Portal Preset and Assuming It Is Hardened

**Problem:** Selecting "Production Standard" or "Production Enterprise" and treating the network configuration as production-ready.

**Result:** Every preset ships with **network policy set to None**, so there is no pod-to-pod isolation. The policy engine cannot be added later without recreating the cluster.

**Solution:** Choose the network policy engine at creation time, alongside the CNI decision. Treat presets as a starting point for the compute shape, not as a security baseline.

---

## Key Takeaways

1. **IPAM and data plane are separate choices.** Azure CNI Overlay, Pod Subnet, and Node Subnet decide where pod IPs come from; Cilium is a data plane that composes with any of them. Overlay is the recommended default and the target for kubenet migration.

2. **kubenet retires 31 March 2028.** It also blocks Windows node pools, subnet sharing, and Application Gateway for Containers today.

3. **The direction of connectivity is what separates overlay from flat.** Overlay pods can initiate outbound but cannot be reached inbound from peered networks. That single property, not IP conservation, is usually the deciding factor.

4. **The Istio add-on has a specific list of things it cannot do:** no ambient mode, no multi-cluster, no Windows containers, no virtual node pods, no Gateway API, and five blocked custom resources. Check it before designing around Istio features.

5. **Open Service Mesh is unsupported from 30 September 2027** and the upstream project is retired. The migration target is the Istio add-on.

6. **Node auto-provisioning is Karpenter and is GA.** It provisions a SKU that fits the pending pods and consolidates them onto fewer nodes. Cluster Autoscaler is now the choice for pinning workloads to pre-declared pools, not the safe default.

7. **Workload identity is capped at 20 federated identity credentials per managed identity**, and does not work with virtual nodes at all. Use one identity per workload and read the token path from `AZURE_FEDERATED_TOKEN_FILE`.

8. **The pod label `azure.workload.identity/use: "true"` is required.** AKS fails closed without it, and pods that need identity break on their next restart.

9. **KEDA scales to zero, which is both the feature and the risk.** Tune `activationMessageCount` and `cooldownPeriod`, and keep interactive workloads above zero.

10. **`prune: true` is what makes GitOps reconcile deletions.** Without it, removing a manifest from Git leaves the resource running in the cluster indefinitely.
