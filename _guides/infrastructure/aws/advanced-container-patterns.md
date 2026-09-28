---
title: "Advanced Container Patterns on AWS for System Architects"
layout: guide
category: AWS
subcategory: Containers in Production
description: "Running ECS and EKS at production scale: capacity provider strategies, managed scaling, and task placement on ECS; Service Connect and VPC Lattice for service-to-service traffic; Karpenter and EKS Auto Mode for nodes; EKS Pod Identity versus IRSA; pod IP address planning; and operating a fleet of clusters."
tags: [ecs, eks, karpenter, service-connect, vpc-lattice, pod-identity, advanced]
---

## Where the Defaults Stop Working

A single ECS service on Fargate, or a small EKS cluster with one managed node group, runs well on defaults. The problems in this guide show up as a platform grows. Compute bills climb because capacity is sized for peaks, services multiply until hard-coded addresses and one load balancer per service stop scaling, node groups multiply for each new instance shape, pods run out of IP addresses in subnets that looked large, and a handful of clusters drift apart because each was changed by hand.

Each section takes one of those problems on ECS, EKS, or both, and covers the AWS mechanism that addresses it.

---

## ECS Capacity at Scale

### Capacity provider strategies

A **capacity provider strategy** splits a service's tasks across capacity providers with two numbers per provider. **Base** is a minimum number of tasks placed on that provider first, and only one provider in a strategy can have one. **Weight** divides every task beyond the base in proportion. A strategy can mix Fargate and Fargate Spot, or it can mix Auto Scaling group providers, but it can't mix Fargate with Auto Scaling groups.

```json
"capacityProviderStrategy": [
  { "capacityProvider": "FARGATE",      "base": 2, "weight": 1 },
  { "capacityProvider": "FARGATE_SPOT",            "weight": 3 }
]
```

With 10 tasks, the first 2 run on Fargate. The remaining 8 split 1 to 3, so 2 more run on Fargate and 6 on Fargate Spot, for 4 on regular capacity and 6 that can be interrupted. The base is what survives a Spot shortage, so size it to the traffic the service must carry with every Spot task gone. On EC2 capacity, the same pattern uses two Auto Scaling groups, one On-Demand and one Spot, each as its own capacity provider.

A weight of zero makes a provider unused until the strategy changes. The API default weight is 0 while the console default is 1, so a strategy written through the API with weights left out can fail to place anything.

### Managed scaling for EC2 capacity

On Fargate, scaling tasks is the whole job. On EC2, the instances have to scale to fit the tasks, and an Auto Scaling group capacity provider with **managed scaling** does it. ECS publishes a metric, `CapacityProviderReservation`, equal to the instances the tasks need divided by the instances running, and keeps it at the provider's **target capacity** with a target tracking policy on the group.

A target capacity of 100 means no spare instances. New tasks wait in `PROVISIONING` while an instance launches, which can take minutes. A lower target, such as 80, keeps headroom so new tasks start at once, at the price of paying for idle instances. When a group with managed scaling scales out from zero, it launches two instances.

Two settings make scale-in safe:

- **Managed termination protection** stops the group from terminating an instance that still runs tasks. It works only with managed scaling turned on and scale-in protection enabled on the group's instances.
- **Managed instance draining**, on by default, moves service tasks off an instance before it goes away, whether from scale-in, an instance refresh, a failed health check, or a two-minute Spot interruption notice. With it on, the older ECS agent setting for Spot draining is redundant.

Managed scaling has two traps. It sizes scale-out against the smallest instance type in the group, so a task that needs more than that type offers never triggers a scale-out and waits in `PROVISIONING` indefinitely. AWS's guidance is to keep each group to the same or similar instance types, and to give workloads with larger minimum sizes, such as GPU tasks, their own group and capacity provider. Placement constraints can also stall scale-out, because ECS can't tell whether a new instance would satisfy them, so `distinctInstance` is the only constraint AWS recommends with managed scaling.

Spot on EC2 still benefits from diversity within those limits. A Spot group that allows several similar-sized instance types across several Availability Zones, with the `price-capacity-optimized` allocation strategy, draws from the Spot pools least likely to be interrupted. A group limited to one instance type loses all its Spot capacity at once when that pool runs dry.

### Task placement on EC2

On EC2 capacity, **placement strategies** decide which instance gets each task, and **placement constraints** rule instances out. Fargate and ECS Managed Instances don't take strategies. They spread tasks across Availability Zones on a best-effort basis, and Managed Instances accept constraints.

| Strategy | Places each task | Trade-off |
|---|---|---|
| `spread` on `attribute:ecs.availability-zone` | In the zone with the fewest of the service's tasks. This is the default for services | Survives a zone failure, uses more instances |
| `spread` on `instanceId` | On the instance with the fewest of the service's tasks | Survives an instance failure |
| `binpack` on `memory` or `cpu` | On the instance with the least of that resource left | Fewest instances, so lowest cost, but one instance failure takes more tasks |
| `random` | Anywhere that fits | Simplest, with no spread or packing |

Strategies combine in order. Spreading across zones, then bin packing within each zone, gives zone resilience at close to the lowest instance count:

```json
"placementStrategy": [
  { "type": "spread",  "field": "attribute:ecs.availability-zone" },
  { "type": "binpack", "field": "memory" }
]
```

Strategies are best effort, and constraints are binding. `distinctInstance` puts each task on a different instance, and `memberOf` limits tasks to instances matching an expression, such as `attribute:ecs.instance-type =~ c7g.*`. A task no instance satisfies isn't placed, or waits in `PROVISIONING` under a capacity provider, and the service's events say why.

After a zone outage, or when a scaling event leaves tasks unevenly spread, **Availability Zone rebalancing** moves tasks back to an even distribution. ECS turned it on for every eligible service on September 5, 2025.

---

## Service-to-Service Traffic

The options for one service calling another differ in how far they reach:

| Option | Reaches | Mechanism |
|---|---|---|
| **Internal load balancer** per service | Anything that can route to it | An ALB or NLB in front of each service. Simple, but one load balancer per service adds cost and a hop |
| **Cloud Map DNS discovery** | Clients in the VPC | ECS registers each task's IP under a Cloud Map DNS name. Clients resolve task addresses from DNS and do their own balancing and retries |
| **ECS Service Connect** | ECS services in the same namespace | A proxy in every task, with short names, load balancing, retries, and metrics |
| **VPC Lattice** | ECS, EKS, EC2, and Lambda across VPCs and accounts | A managed service network with IAM auth policies. No proxy in the task |

### ECS Service Connect

**Service Connect** puts a managed proxy container in every task of every service configured for it. A **client-server** service publishes an endpoint, a short name and port such as `http://orders:8080`, in a **namespace**, which is an AWS Cloud Map namespace. Tasks of every service in that namespace that has Service Connect configured can call that name. The call goes to the proxy in the caller's own task, which picks a healthy task of the target service, sends the request to the proxy in that task, and retries or ejects failing tasks. Both proxies report request counts, errors, and latency to CloudWatch without application changes.

{% include figure.html id="aws-ecs-service-connect" %}

A namespace spans clusters in one Region, and a namespace shared through AWS Resource Access Manager spans accounts. Names resolve only for services in the same namespace that have Service Connect configured. Anything else, such as a Lambda function, an EC2 instance, or an ECS service in another namespace, needs another path, usually a load balancer or VPC Lattice.

Since July 2026, **zone-aware routing**, on by default, keeps calls in the caller's Availability Zone when the target has healthy tasks there, which cuts cross-zone data transfer charges and latency. Traffic between proxies can be encrypted with TLS using certificates from AWS Private CA, which Service Connect rotates every five days.

Service Connect itself costs nothing. The proxy runs inside each task and uses the task's CPU and memory, so size tasks with it in mind. TLS is where cost appears. The Private CA costs $400 a month in general-purpose mode or $50 in short-lived certificate mode, which AWS recommends here, plus $0.058 per short-lived certificate, about six a month for each service.

### VPC Lattice

**VPC Lattice** connects services across VPCs and accounts through a **service network** that VPCs associate with. An ECS service registers its tasks directly in a Lattice target group, with no load balancer in between, and ECS replaces tasks that fail Lattice health checks. On EKS, the **AWS Gateway API Controller** turns Kubernetes Gateway API resources into Lattice services. Lattice **auth policies** decide which IAM principals may call which services, so an identity check replaces or supplements security group rules. With ECS, Lattice works with rolling deployments only, not blue/green.

Lattice is billed per service, in US East (N. Virginia) $0.025 an hour plus $0.025 per GB processed, with requests beyond 300,000 an hour charged. Lattice suits calls that cross a VPC, account, or compute boundary, such as an EKS service calling an ECS service owned by another team in another account. Service Connect suits ECS services talking to each other inside one team's namespace. Both can run at once.

On EKS without Lattice, services call each other through Kubernetes Services inside the cluster, or through a service mesh your team runs in the cluster.

---

## EKS Node Provisioning

### Why node groups stop scaling

The Kubernetes **Cluster Autoscaler** scales Auto Scaling groups. It sees pods that can't be scheduled, picks a node group whose instance type fits them, and raises that group's desired count. Each node group has one shape, so a cluster with general, memory-heavy, GPU, Arm, and Spot workloads needs a node group per combination, and the autoscaler can only choose among shapes someone created in advance.

### Karpenter

**Karpenter** skips node groups. It reads the requirements of pods that can't be scheduled, such as CPU and memory requests, architecture, zone, capacity type, and tolerations, then launches EC2 instances sized for them directly. When nodes are underused, it moves pods and removes or replaces nodes.

It is configured with two resources, in the `v1` API:

- A **NodePool** sets what Karpenter may launch: instance requirements, taints, limits on total CPU and memory, when nodes expire, and when Karpenter may remove or replace them.
- An **EC2NodeClass** sets how to launch it: the AMI, subnets, security groups, IAM role, and storage.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: general
spec:
  template:
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: kubernetes.io/arch
          operator: In
          values: ["arm64", "amd64"]
      expireAfter: 720h
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 1m
    budgets:
      - nodes: "10%"
  limits:
    cpu: 1000
```

The requirements are deliberately broad. Allowing both architectures, both capacity types, and every instance family that fits lets Karpenter choose the cheapest option that has capacity, and for Spot it uses the `price-capacity-optimized` strategy across that wide set. Pods that need something narrower say so with node selectors or affinities. A NodePool with no `limits` can grow without bound, and limits apply per NodePool, not per cluster.

Karpenter removes and replaces nodes in two kinds of ways:

| Kind | Method | What triggers it |
|---|---|---|
| **Graceful** | **Consolidation** | Empty nodes, or underused nodes whose pods fit on fewer or cheaper nodes |
| **Graceful** | **Drift** | A node that no longer matches its NodePool or EC2NodeClass, such as after the AMI selection, subnets, or security groups change |
| **Forceful** | **Expiration** | A node older than `expireAfter` |
| **Forceful** | **Interruption** | A Spot interruption notice, scheduled maintenance, or instance stop event, received through an SQS queue |
| **Forceful** | **Node repair** | A node that fails health checks |

Drift is how new AMIs and Kubernetes versions reach nodes. Changing the pinned AMI in the EC2NodeClass marks every older node as drifted, and Karpenter replaces them. **Disruption budgets**, such as the `10%` above, cap how many nodes graceful methods replace at once, and pod disruption budgets and the `karpenter.sh/do-not-disrupt` annotation hold graceful disruption back for workloads that can't move. Forceful methods ignore all three. An expired node drains regardless, bounded by `terminationGracePeriod`, so `expireAfter` is a hard maximum node age, not a gentle refresh.

Consolidation packs by resource requests, not usage, so it depends on accurate requests. A pod that requests little memory but bursts far above it can be packed onto a node where several such pods run out of memory together. Setting memory requests equal to limits avoids that.

The Karpenter controller must not run on nodes it manages. Run it on a small managed node group or on Fargate. And pin the AMI version in production rather than following the latest release, so a new AMI reaches production, through drift, only after it has run elsewhere.

### EKS Auto Mode

**EKS Auto Mode** runs Karpenter for you, along with pod networking, load balancing for Kubernetes Services and Ingresses, EBS storage, cluster DNS, and the Pod Identity agent, as parts of the cluster rather than add-ons you install and upgrade. Its nodes run a locked-down Bottlerocket variant with SELinux enforcing and a read-only root file system, allow no SSH or Systems Manager access, and are replaced at most every 21 days. You can add NodePools and NodeClasses of your own beside the defaults, but not edit the defaults.

Auto Mode charges a management fee per instance, for every hour each instance runs, on top of EC2. On a large, steady fleet that fee can exceed the cost of running Karpenter and the add-ons yourself, so Auto Mode suits teams that value not operating those pieces more than the fee. Self-managed Karpenter suits teams that need custom AMIs, node access for debugging, or components Auto Mode doesn't allow.

### Pod and node autoscaling together

Node provisioning only reacts to pods that can't be scheduled. Something else has to create those pods. The **Horizontal Pod Autoscaler** scales a workload's replicas on CPU, memory, or custom metrics. Metrics that live in CloudWatch or SQS, such as queue depth, reach it through an adapter, commonly **KEDA**, which scales on external sources including CloudWatch and SQS. In sequence, load rises, the pod autoscaler adds pods, the new pods can't be scheduled, and Karpenter launches a node for them. Scale-up time is the sum of both steps plus the image pull, so large images and slow-starting pods show up here as latency.

---

## Pod Identity

Pods that call AWS APIs need credentials scoped to the pod, not the node's instance role. EKS has two mechanisms:

| | EKS Pod Identity | IAM roles for service accounts (IRSA) |
|---|---|---|
| **How a role is bound** | An association in the EKS API maps a namespace and service account to a role | An annotation on the service account, plus an OIDC identity provider for each cluster in IAM |
| **Role trust policy** | One service principal, `pods.eks.amazonaws.com`, works for every cluster | Names each cluster's OIDC provider and the service account, so each new cluster edits the policy |
| **Cross-account access** | A target role in another account on the association (June 2025), assumed by role chaining | The pod's SDK assumes a role in the other account |
| **Session tags** | Adds tags for cluster, namespace, and service account, usable in ABAC policies | None added |
| **Runs on** | Linux EC2 nodes, through the Pod Identity agent | Anywhere, including Fargate and Windows nodes |

With Pod Identity, the **Pod Identity agent**, a DaemonSet on each node, serves credentials at a link-local address. EKS sets environment variables in each associated pod that point the AWS SDK's container credential provider at the agent, and the agent gets the role's credentials from the EKS Auth service. An SDK too old to know that provider falls back to the node's instance role without an error, so check SDK versions before moving a workload from IRSA.

{% include figure.html id="aws-eks-pod-identity" %}

EKS Pod Identity is the simpler default. Cluster administrators create associations, IAM administrators write roles, and neither touches the other's system when a cluster is added. A cluster supports up to 5,000 associations. IRSA remains the choice for pods on Fargate or Windows nodes, which Pod Identity doesn't support.

A role for Pod Identity trusts the service principal with two actions:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "pods.eks.amazonaws.com" },
  "Action": ["sts:AssumeRole", "sts:TagSession"]
}
```

```bash
aws eks create-pod-identity-association \
  --cluster-name prod \
  --namespace orders \
  --service-account orders-api \
  --role-arn arn:aws:iam::111122223333:role/orders-api
```

Either way, pod credentials only isolate pods if the pod can't fall back to the node's role. A pod that can reach the instance metadata service can use the node role and possibly other pods' credentials. Requiring IMDSv2 with a hop limit of 1 on nodes blocks pods that don't use host networking from reaching it.

---

## Pod IP Addresses

The **Amazon VPC CNI**, the default network plugin on EKS, gives every pod an IP address from the VPC subnet, so pods are reachable like instances and security groups and VPC Flow Logs see them directly. The cost is address consumption. Each instance type supports a fixed number of network interfaces, each with a fixed number of secondary addresses, and without other settings that product caps how many pods the node can run. The CNI also keeps a warm pool of unused addresses on each node so new pods start without waiting for an EC2 API call. A cluster of 100 nodes running 30 pods each needs about 3,000 addresses plus those warm pools, and subnets sized for instances run out.

Three mechanisms extend the address supply:

- **Prefix delegation** fills each secondary address slot with a /28 prefix of 16 addresses instead of a single address, which lifts the per-node cap and speeds pod launch. It needs Nitro-based instances and free, contiguous /28 blocks in the subnet, so a fragmented subnet can fail to assign prefixes while still showing free addresses. Subnet CIDR reservations set aside space for prefixes. Switching an existing cluster works best with new node groups rather than a rolling change.
- **Custom networking** puts pod addresses in a secondary CIDR block added to the VPC, such as a range from `100.64.0.0/10`, so pods stop competing with instances for the primary range. The node's primary interface no longer hosts pods, which lowers pods per node unless prefix delegation is also on.
- **IPv6 clusters** give pods IPv6 addresses from a range too large to exhaust, and translate for IPv4 destinations. The choice is made when the cluster is created.

**Security groups for pods** attach security groups to individual pods through branch network interfaces, which hang off a trunk interface on the node, for pods that need different network access from others on the same node, such as the one pod allowed to reach a database.

ECS in `awsvpc` mode faces the same pressure, since each task gets its own interface and address. **ENI trunking**, an account setting, raises the number of tasks an EC2 instance can host.

---

## Operating a Fleet of Clusters

A platform tends to become several clusters, split by environment, Region, or team. Two things keep them consistent.

**Declarative delivery.** Cluster configuration and workloads live in Git, and a controller in or beside each cluster applies them and reverts manual changes. **EKS Capabilities** (November 2025) run three such controllers as managed resources outside your nodes, billed per capability-hour plus an hourly charge per resource each manages: **Argo CD** for continuous delivery from Git across many clusters from one instance, **AWS Controllers for Kubernetes (ACK)** for creating AWS resources such as buckets and databases from Kubernetes manifests, and **kro** for composing Kubernetes and AWS resources into higher-level APIs a platform team offers to application teams. The same tools can be self-hosted.

**Version upgrades on a schedule.** Extended support costs six times the standard control plane price, so upgrades are recurring work. An upgrade goes one minor version at a time. Check the cluster's **upgrade insights**, which flag deprecated APIs still in use, upgrade the control plane, then add-ons, then nodes. Karpenter and Auto Mode roll nodes to the new version through the same disruption controls they use for consolidation. Keeping clusters identical enough that one runbook covers all of them is what makes this sustainable, and it is an argument for fewer, larger clusters with namespace isolation where team boundaries allow it.

---

## Common Pitfalls

- **Tasks stuck in `PROVISIONING` on EC2 capacity.** The task needs more than the smallest instance type in the group, or a placement constraint blocks managed scale-out, so the capacity provider never scales. Split groups by task size.
- **Placement constraints no instance satisfies.** No error appears beyond a service event, so check events when a deployment stalls.
- **Pods silently using the node role.** An SDK too old for Pod Identity, or a pod that can reach the metadata service, runs with the node's permissions. Check SDK versions and require IMDSv2 with a hop limit of 1.
- **Pods stuck in `ContainerCreating`.** The subnet ran out of addresses, or of contiguous /28 blocks under prefix delegation, long after the cluster was built. Plan pod address space with the VPC.
- **Nodes that never pick up a new AMI.** A pinned AMI in the EC2NodeClass stays until someone changes it, and expiration alone replaces nodes with the same image.
- **A runaway NodePool.** Without limits, a bad deployment scales nodes until something else stops it. Set limits per NodePool and a billing alarm.

---

## Key Takeaways

- An ECS capacity provider strategy places a base on one provider, then splits the rest by weight. It can't mix Fargate with Auto Scaling groups.
- Managed scaling keeps EC2 capacity at a target utilization, sized against the smallest instance type in the group. Below 100 buys fast task starts with idle instances. Termination protection and managed draining make scale-in safe.
- Placement strategies apply only on EC2: spread across zones, then bin pack. Constraints are binding.
- Service Connect gives ECS services in one namespace short names, retries, and metrics through a proxy in each task. VPC Lattice connects services across VPCs, accounts, and compute types with IAM auth.
- Karpenter launches nodes sized for pending pods from broad NodePool requirements. Consolidation and drift respect disruption budgets, while expiration, interruption, and node repair don't. Drift is how new AMIs roll out. EKS Auto Mode runs Karpenter and the core add-ons for a per-instance fee.
- EKS Pod Identity binds roles through the EKS API with one trust principal for every cluster and supports cross-account target roles. IRSA remains for Fargate and Windows pods.
- The VPC CNI spends a VPC address per pod. Prefix delegation, custom networking, or IPv6 keeps large clusters from exhausting subnets.
- A fleet of clusters stays consistent through Git-driven delivery and a regular, one-version-at-a-time upgrade routine.
