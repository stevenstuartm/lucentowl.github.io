---
title: "Choosing AWS Compute: EC2, Lambda, and Containers on ECS, EKS, and Fargate"
layout: guide
category: AWS
subcategory: Compute Services
description: "How to choose between EC2, Lambda, and containers, and how AWS runs containers: ECS task definitions, tasks, and services; Fargate, EC2, and ECS Managed Instances as capacity; EKS and when Kubernetes earns its cost; task roles, secrets, deployments, and container cost."
tags: [decision-making, containers, ecs, eks, fargate, kubernetes, fundamentals]
---

## Choosing Compute on AWS

AWS offers several ways to run the same code, and they differ mainly in how much of the stack you operate and how you pay for it. At one end, an EC2 instance gives you a whole server to run and pay for by the second whether it's busy or not. At the other, a Lambda function gives you no server at all and charges only while your code runs. Containers sit between them. They run on an **orchestrator**, either **Amazon ECS** (AWS's own) or **Amazon EKS** (managed Kubernetes), and on capacity that is either your own instances, instances AWS manages for you, or **AWS Fargate**, which runs each container workload on isolated compute with no instances in view.

| Option | You manage | Idle capacity billed | Fits |
|---|---|---|---|
| **EC2 instances** | The operating system, patches, software, and scaling | Yes, for every running instance | Software that needs OS control, licensed or legacy applications, anything that can't be containerized |
| **Containers on EC2** (ECS or EKS) | Container images, plus the instances under them | Yes, for instances left running. Managed scaling can shrink an idle fleet to zero | High, steady container workloads where packing containers onto instances you choose is cheapest |
| **Containers on managed instances** (ECS Managed Instances, EKS Auto Mode) | Container images and instance requirements. AWS provisions, patches, and replaces the instances | Yes, for instances left running, plus a per-instance management fee | Steady workloads that want EC2 pricing and instance choice, including GPUs, without running the fleet |
| **Fargate** | Container images and the size of each workload | No. You pay per second for each running task's requested size | Long-running services and jobs with no servers to operate |
| **Lambda** | Function code | No. You pay per request and per millisecond of execution | Event-driven and request-driven work, spiky or idle traffic, short invocations |

Lambda can also package a function as a container image of up to 10 GB, so "containers" here means a long-running container on an orchestrator, not the packaging format. And **Lambda Managed Instances** run Lambda functions on EC2 instances in your account at EC2 prices plus a fee, for steady, high-volume function traffic.

Three questions narrow the choice:

- **How does the work run?** Short invocations triggered by an event or a request suit Lambda. Long-running processes, persistent connections, and invocations over 15 minutes suit containers or instances.
- **How steady is the load?** Per-use pricing wins when capacity would otherwise sit idle. Instance pricing wins when utilization stays high, because an instance you keep busy costs less per unit of work than paying per request or per task.
- **How fast must it react?** Lambda adds capacity in milliseconds to seconds. A new Fargate task takes tens of seconds, longer for large images, and container capacity on EC2 may first have to launch an instance. Spiky traffic on containers needs headroom or scaling that starts early.

```
Does the work need OS-level control, or software that can't run in a container?
├── Yes → EC2 instances
└── No → Is it event- or request-driven, with each unit of work finishing well inside 15 minutes?
    ├── Yes → Lambda
    │         (steady, high volume that would suit EC2 pricing → Lambda Managed Instances)
    └── No → Containers. Does the team already run Kubernetes, or need its ecosystem or portability?
        ├── Yes → EKS
        └── No → ECS
        Then, for either one, choose capacity: Fargate by default; EC2 or managed instances
        when load is steady enough that instance pricing wins, or workloads need GPUs
```

Two other services come up in this choice. **AWS Batch** schedules queued batch jobs onto Fargate or EC2 and suits large job queues better than building a scheduler yourself. **AWS App Runner** stopped accepting new customers on April 30, 2026, and AWS points new users to ECS Express Mode (below) instead.

---

## What a Container Adds

A **container image** packages an application with its runtime and dependencies into one versioned artifact, so the same image runs the same way on a laptop, in a test environment, and in production. A container shares the host's operating system kernel instead of booting its own, so it starts in seconds and many containers can share one machine. The image is immutable, so a rollback means running the previous image rather than undoing changes on a server. An image is built for one processor architecture, x86 or Arm, unless it's built as a multi-architecture image.

Running containers in production needs the orchestrator. It places containers on capacity, restarts them when they fail, keeps the right number running, connects them to load balancers, and replaces them during a deployment. The part of an orchestrator that makes those decisions is its **control plane**.

---

## Amazon ECS

ECS has no control plane for you to run or pay for. AWS operates it, and you configure everything through AWS APIs, IAM, and the resources ECS integrates with.

### Clusters, Task Definitions, Tasks, and Services

ECS has four objects, and most confusion about it comes from mixing them up:

- A **cluster** is a Regional grouping of capacity and the workloads that run on it.
- A **task definition** is the blueprint: one or more container images, the CPU and memory for each, ports, environment variables, secrets, log settings, and the IAM roles to use. Each change creates a new numbered **revision**, and old revisions stay available for rollback.
- A **task** is one running copy of a task definition revision. Its containers run together on the same capacity.
- A **service** keeps a chosen number of tasks running. It replaces tasks that stop or fail health checks, spreads them across Availability Zones, and runs deployments when you point it at a new revision. With a load balancer attached, it registers each task in a **target group**, the list of destinations the load balancer sends requests to.

A task started without a service runs once and stops, which suits batch jobs and scheduled work. Anything long-running belongs in a service.

{% include figure.html id="aws-ecs-service-anatomy" %}

### Where Tasks Run

A cluster gets capacity through **capacity providers**, each naming one source of capacity, and a service's **capacity provider strategy** says how to split its tasks among them. There are three kinds:

| Capacity | What it is | Trade-off |
|---|---|---|
| **Fargate** | AWS runs each task on its own isolated compute, sized to the task | Nothing to operate and per-task pricing, but no GPUs or privileged containers, and slower task starts |
| **EC2 instances** | Your own Auto Scaling group of instances, each running the **ECS agent** that starts and stops tasks on it | Cheapest at high, steady utilization, but you patch, size, and scale the instances |
| **ECS Managed Instances** | EC2 instances in your account that ECS selects, launches, patches every 14 days, and replaces. They run Bottlerocket, AWS's minimal operating system for containers | EC2 pricing, instance choice, and GPUs without running the fleet, for a per-instance management fee and less control over the OS |

ECS Managed Instances, launched in September 2025, fill the gap that used to force a choice between Fargate's simplicity and EC2's pricing and hardware options. At large, steady scale, the management fee is the price of not running the fleet yourself.

**ECS Express Mode** (November 2025) is a shortcut for the common case of a web service. Given a container image, it creates a Fargate-backed service with an Application Load Balancer, HTTPS, an AWS-provided domain name, auto scaling, and canary deployments. It costs nothing beyond the resources it creates, and every resource stays in your account to modify later.

### Networking

Fargate tasks always use the **awsvpc** network mode, and it's the recommended mode on instances too. Each task gets its own elastic network interface and private IP address in your subnet, which its containers share, so security groups apply per task and load balancers register tasks by IP address. On instances, the older **bridge** mode shares the instance's interface and maps container ports to host ports, and **host** mode puts containers directly on the host's network. Both give up per-task security groups.

A task in a private subnet still needs a path to pull its image, either through a NAT gateway or through VPC endpoints for ECR and S3. For calls between services, **ECS Service Connect** gives each service a short name that other services in the same namespace (a shared registry of service names) can call, with a proxy in each task that handles discovery, retries, and traffic metrics.

### Scaling a Service

A service's task count scales through **Application Auto Scaling**, the AWS service that scales resources other than EC2 instances. **Target tracking** holds a metric near a target, such as average CPU at 60% or requests per task from the load balancer. **Step scaling** adds or removes set numbers of tasks at alarm thresholds, and **predictive scaling** forecasts from past traffic and scales ahead of it. On Fargate that's the whole story. On instance capacity, the instances also have to scale to fit the tasks, which the capacity provider's managed scaling handles.

### Deployments

Pointing a service at a new task definition revision starts a deployment. ECS supports four strategies natively:

| Strategy | How traffic moves | Works with |
|---|---|---|
| **Rolling update** | Tasks are replaced in batches, bounded by `minimumHealthyPercent` (how far below the desired count the service may drop) and `maximumPercent` (how far above it may run during the swap) | Any service |
| **Blue/green** (July 2025) | A full set of new tasks starts beside the old ones, then all traffic shifts at once | Application or Network Load Balancer, Service Connect |
| **Linear** (October 2025) | Traffic shifts to the new tasks in equal steps over a set time | Application Load Balancer, Service Connect |
| **Canary** (October 2025) | A small share of traffic goes to the new tasks first, then the rest after a wait | Application Load Balancer, Service Connect |

A rolling update can stop itself when new tasks keep failing, through the **deployment circuit breaker**, or when a chosen CloudWatch alarm fires, and either can roll back to the last working revision. The other three strategies keep the old tasks running through a **bake time** after traffic moves, so rollback is immediate. Their **lifecycle hooks** can run a Lambda function or pause for approval at each stage, and CloudWatch alarms can trigger rollback. Before these were built in, blue/green on ECS required CodeDeploy, which remains available as a separate deployment controller.

Deployments depend on health checks, and a check that's too strict turns a slow start into a restart loop. The check command has to exist in the image, the timeout has to cover a slow response, and a start period has to cover application startup:

```json
"healthCheck": {
  "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
  "interval": 30,
  "timeout": 5,
  "retries": 3,
  "startPeriod": 60
}
```

This check fails if the image has no `curl`, which minimal and distroless images often don't. When a load balancer also checks the tasks, set the service's health check grace period to cover startup, so the load balancer's checks don't fail tasks that are still starting.

---

## AWS Fargate

**Fargate** runs each ECS task, or each EKS pod (Kubernetes' unit of one or more containers), on its own isolated compute that doesn't share a kernel, CPU, memory, or network interface with other workloads. You choose a size, and Fargate supplies exactly that. Most of the options are ECS-only:

| | Fargate for ECS | Fargate for EKS |
|---|---|---|
| **Sizes** | 0.25 vCPU with 512 MiB up to 16 vCPU with 120 GB in fixed combinations, plus 32 vCPU with 60, 120, or 244 GB | Chosen from the pod's resource requests |
| **Operating systems and processors** | Linux on x86 or Arm (AWS Graviton), and Windows on x86 with at least 1 vCPU | Linux on x86 only |
| **Storage** | 20 GiB of ephemeral storage by default, up to 200 GiB, plus an EBS volume per task or an EFS file system | Ephemeral storage and EFS. No EBS volumes |
| **Spot** | Fargate Spot, on x86 and Arm | Not available |

Neither supports GPUs, privileged containers, or host networking, all of which need instance capacity.

Fargate bills per second, with a one-minute minimum for Linux and five minutes for Windows, for the vCPU and memory a workload requests, from the start of the image pull until it stops. In US East (N. Virginia), Linux on x86 costs about $0.0405 per vCPU-hour and $0.0044 per GB-hour, and Linux on Arm about 20% less. Billing follows the requested size, not what the task uses.

**Fargate Spot** runs ECS tasks on spare capacity for up to 70% off, in exchange for interruption. A task gets a two-minute warning, delivered to its containers as a `SIGTERM`, before it stops, and Spot capacity isn't guaranteed to come back right away. It suits work that can be retried or that has spare tasks to absorb a loss, such as batch jobs, queue workers, and the extra tasks of a stateless service. A capacity provider strategy can keep a base of regular Fargate tasks and add Spot tasks on top, so an interruption never takes the whole service down.

---

## Amazon EKS

**Amazon EKS** runs upstream Kubernetes. In Kubernetes, you describe the desired state of your workloads in **manifests**, and controllers keep the cluster matching them. Workloads run as pods on **nodes**, the machines that make up the cluster's **data plane**. AWS operates the control plane, which is the Kubernetes API server, the scheduler that places pods on nodes, and etcd, the database that stores cluster state. It runs across three Availability Zones in an AWS-managed account and connects to your VPC through network interfaces. The data plane runs in your VPC.

{% include figure.html id="aws-eks-control-data-plane" %}

The control plane costs $0.10 per cluster-hour, about $73 a month, while a Kubernetes version is in standard support (14 months). A cluster left on a version in extended support pays $0.60 per hour for another 12 months, which makes staying current a cost question as well as a security one. Larger clusters can buy a provisioned control plane tier with more capacity.

The data plane can be any mix of:

| Node option | What AWS manages |
|---|---|
| **Managed node groups** | Provisioning and updating EC2 nodes in an Auto Scaling group. You choose the instance types and trigger updates |
| **EKS Auto Mode** | Choosing, launching, patching, and replacing nodes, plus the cluster's core networking, storage, and load balancing components. Charged as a per-instance fee on top of EC2, with less control over the nodes |
| **Fargate** | One isolated compute unit per pod, with no nodes to see. Pods can't be DaemonSets (a copy of a pod on every node) and can't use GPUs or host networking |
| **Self-managed nodes** | Nothing. You run the nodes yourself |
| **Hybrid nodes** | Nothing on the node. On-premises or edge machines join the cluster and are charged per vCPU-hour |

### ECS or EKS

| | ECS | EKS |
|---|---|---|
| **Control plane cost** | None | $73 a month per cluster in standard support |
| **Configuration model** | AWS APIs, IAM, CloudFormation, CDK | Kubernetes manifests and controllers, plus AWS resources for the cluster |
| **Skills needed** | AWS | Kubernetes, and AWS for everything around it |
| **Ecosystem** | AWS services | Helm charts (packaged applications), operators (controllers that deploy, scale, and repair specific software), and the wider Kubernetes tooling |
| **Where it runs** | AWS, and your own servers through ECS Anywhere | AWS, hybrid nodes, and any other Kubernetes cluster, with care over cloud-specific pieces |
| **Upgrades** | None for the orchestrator | A Kubernetes version upgrade at least every 14 months to stay in standard support |

ECS is the simpler default for teams building on AWS, including teams that also run containers on their own servers. EKS earns its extra cost and operational load when a team already runs Kubernetes, depends on tools that only exist for it, or needs the same platform across clouds. Choosing EKS for a handful of services because Kubernetes is the industry default tends to trade feature work for platform work nobody needed.

---

## Identity and Secrets for Tasks

An ECS task uses two IAM roles for two different callers:

| Role | Used by | Grants |
|---|---|---|
| **Task execution role** | ECS itself, while starting and running the task | Pulling the image from ECR, writing logs, and fetching secrets referenced in the task definition |
| **Task role** | Your application code, through the AWS SDK | Whatever the application calls: tables, buckets, queues |

Keep them separate and scope each to one task definition or service. On EKS, pods get AWS permissions through EKS Pod Identity or IAM roles for service accounts, which map a Kubernetes service account to an IAM role.

The isolation behind those roles depends on the capacity. Each Fargate task or pod has its own isolation boundary, and its containers can't reach the instance metadata service. On EC2 instances and ECS Managed Instances, containers are not a security boundary. A container can reach the instance metadata service and use the **instance role**, and it may reach data from other tasks on the same instance. On EC2 instances you run, block that path with the ECS agent's `ECS_AWSVPC_BLOCK_IMDS` option for awsvpc tasks, or an iptables rule dropping traffic to `169.254.169.254` for bridge-mode tasks, and keep the instance role limited to what the agent needs. Workloads that must not share a host belong on Fargate, or in separate clusters.

Secrets referenced in a task definition are injected as environment variables when each container starts. The task execution role needs permission to read them:

```json
"secrets": [
  {
    "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/orders/db-AbCdEf"
  }
]
```

A running container never sees a later change to the secret. After a rotation, running tasks keep the old value until they're replaced, so force a new deployment of the service, or have the application fetch the secret itself at runtime.

---

## Storage, Logs, and Metrics

A container's own storage is ephemeral and disappears with the task. ECS can attach one new **EBS volume** to each task for fast block storage, optionally created from a snapshot, but a service's task volumes are always deleted when their tasks stop. Data that has to outlive tasks goes in an **EFS** file system, which many tasks can mount at once, or in a database or S3. EKS reaches the same storage through CSI drivers, the Kubernetes plugins for storage systems.

Containers write logs to standard output, and the task definition's log configuration decides where they go. The `awslogs` driver sends them to CloudWatch Logs, and **FireLens** runs Fluent Bit as a **sidecar**, a helper container in the same task, which can route logs anywhere, including third-party services. CloudWatch Container Insights adds per-task and per-service CPU, memory, and network metrics.

---

## Cost

Container cost comes down to two decisions: the capacity type, and how closely workload sizes match what they use.

Consider 10 tasks of 1 vCPU and 2 GB running all month in US East (N. Virginia). On Fargate that's 10 vCPU and 20 GB for about 730 hours, or roughly $295 for vCPU and $65 for memory, about $360 a month. Fargate Spot can cut up to 70% of that for tasks that tolerate interruption, and Arm about 20%, once the images are built for Arm. The same tasks on instance capacity cost whatever the instances under them cost. If the tasks pack tightly onto a few instances that stay busy, and those instances are covered by a pricing commitment, EC2 is cheaper. If the instances run half empty, the idle capacity usually erases the difference. Compute Savings Plans, a commitment to an hourly spend, cover Fargate at up to 50% off as well as EC2 and Lambda, so a commitment doesn't lock in a capacity choice.

Right-size before optimizing the pricing model. Task sizes set at first deployment tend to stay unchanged, and a task that requests 2 vCPU and uses 0.5 pays for the other 1.5 every hour on Fargate, and crowds out other tasks on instances. Container Insights shows each service's real CPU and memory use, and AWS Compute Optimizer recommends task sizes for ECS services on Fargate.

---

## Key Takeaways

1. **Choose compute by how work runs, how steady load is, and how fast it must react.** Short event- or request-driven work suits Lambda. Long-running processes suit containers. Steady, high utilization favors instance pricing, and idle or spiky load favors per-use pricing.
2. **ECS is four objects.** A task definition is the blueprint, a task is one running copy, a service keeps a count of tasks running behind a load balancer, and a cluster groups them with capacity.
3. **Capacity is a separate choice from the orchestrator.** Fargate removes servers entirely, instance capacity is cheapest when packed and busy, and ECS Managed Instances or EKS Auto Mode give EC2 pricing without running the fleet, for a fee.
4. **Fargate for EKS is narrower than Fargate for ECS.** It's Linux on x86 only, with no EBS volumes and no Spot.
5. **EKS earns its cost with Kubernetes skills or needs.** It adds a control plane fee, version upgrades, and Kubernetes itself. ECS is the simpler default otherwise.
6. **Two roles, two callers.** The execution role serves ECS and the task role serves your code. On instance capacity, containers can reach the instance role unless you block it.
7. **ECS deploys safely on its own.** Rolling updates with the circuit breaker or alarms, and blue/green, linear, and canary deployments with bake time and alarm-driven rollback.
8. **Right-size before choosing a pricing model.** Fargate bills for requested size, so oversized tasks cost money directly, and Spot, Arm, and Savings Plans then cut from a correct baseline.
