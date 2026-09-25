---
title: "EC2 for System Architects"
layout: guide
category: AWS
subcategory: Compute Services
description: "How EC2 instances are chosen, launched, secured, paid for, and scaled: instance families and naming, Graviton and Nitro, AMIs and launch templates, IMDSv2 and instance roles, On-Demand, Spot, and commitments, Auto Scaling groups, and placement groups."
tags: [ec2, instance-types, graviton, auto-scaling, spot-instances, imdsv2, fundamentals]
---

## What an EC2 Instance Is

An **EC2 instance** is a virtual server running on AWS hardware in one Availability Zone (AZ). You choose its size and processor, the image it boots from, the subnet it joins, and how you pay for it, and AWS runs the physical machine underneath. EC2 is the most flexible compute option on AWS and the one with the most to manage. The operating system, its patches, the software on it, and how many instances run are all yours to decide.

Four pieces go into every launch:

- An **instance type**, which fixes the vCPUs (virtual CPUs, each usually one hardware thread), memory, network bandwidth, and any accelerators.
- An **Amazon Machine Image (AMI)**, the template for the root volume: an operating system plus whatever software was baked into it.
- **Network placement**, meaning a subnet (which fixes the AZ), security groups (the instance's firewall rules), and optionally a public IP address.
- **Storage**, usually an EBS (Elastic Block Store) network volume for the root disk, which survives a stop and by default is deleted when the instance is terminated. Some types add **instance store** disks on the host itself, which are lost when the instance stops.

An instance moves through a small lifecycle. A **stopped** instance keeps its EBS volumes and stops charging for compute. Starting it again usually lands it on different hardware, and instance store data is gone. **Hibernation** also saves memory to the root volume so the instance resumes where it left off. **Terminated** instances are gone, along with any volumes marked to delete on termination. Windows and the common Linux distributions, including Amazon Linux, Red Hat Enterprise Linux, and Ubuntu, are billed per second with a one-minute minimum. Some Marketplace software is billed by the hour.

---

## Choosing an Instance Type

### Reading an Instance Name

Instance type names pack the choices into a short code. In `c7gn.xlarge`, `c` is the **series** (compute optimized), `7` the **generation**, `gn` the **options**, and `xlarge` the **size**. The option letters that matter most:

| Letter | Meaning |
|---|---|
| `g` | AWS Graviton (Arm) processor |
| `i` | Intel processor |
| `a` | AMD processor |
| `d` | Local NVMe instance store disks |
| `n` | Higher network and EBS bandwidth |
| `e` | Extra memory or storage for the series |
| `z` | Higher CPU clock speed |
| `flex` | Flex instance: a lower price for CPU that runs at full speed most, but not all, of the time |

Within a family, price scales with size, so a `2xlarge` has twice the vCPUs and memory of an `xlarge` and costs twice as much. The steps double up to `8xlarge` and are smaller above it (`12xlarge`, `16xlarge`, `24xlarge`, and so on). `metal` sizes give the whole physical server with no virtualization layer.

### The Families

| Series | Optimized for | Typical workloads |
|---|---|---|
| **M** | Balanced CPU and memory (about 4 GiB per vCPU) | Application servers, the default when unsure |
| **C** | CPU (about 2 GiB per vCPU) | Batch jobs, encoding, high-traffic web tiers, game servers |
| **R, X, U** | Memory (8 GiB per vCPU and up, to many TiB in U) | In-memory caches and databases, SAP HANA |
| **T** | Burstable CPU | Low steady load with occasional peaks, such as small web apps and dev environments |
| **I, D, Im, Is** | Local storage throughput | Databases and search clusters that manage their own replication |
| **P, G, Inf, Trn** | Accelerators: NVIDIA GPUs, AWS Inferentia, AWS Trainium | ML training and inference, rendering, high-performance computing (HPC) |

**T instances** earn CPU credits while running below a baseline and spend them to run above it. In the default **unlimited** mode for current T instances, sustained use above the baseline is billed as surplus credits, so a T instance that stays busy costs more than an M instance of the same size. For a `t3.large`, the break-even against an `m5.large` is around 42% average CPU.

Newer generations generally give better price-performance than older ones at similar prices, so a fleet on an old generation is often leaving savings behind. Not every type is offered in every Region or AZ, and capacity for a specific type can run out in an AZ, which is a reason to let workloads accept several types (see Auto Scaling groups below).

### Graviton

**AWS Graviton** processors are Arm-based CPUs that AWS designs, marked by the `g` in names such as `m8g` and `c8g`. AWS positions them as giving better price-performance than comparable x86 instances for many workloads, and using less energy. The fifth generation, Graviton5, became generally available in June 2026 with the M9g family.

The constraint is the instruction set. Graviton runs Linux (and some BSDs), not Windows or macOS, and every binary, container image, and native library must be built for Arm64. Interpreted and JIT-compiled runtimes such as Java, .NET, Python, and Node.js usually move with little change, while software with x86-only native dependencies may not move at all. Multi-architecture container images, which carry builds for both, let one image run on either kind of instance. Benchmark the actual workload before switching a fleet, since results vary by application.

### The Nitro System

Current EC2 instances run on the **AWS Nitro System**, which moves virtualization work off the host CPU into dedicated hardware. **Nitro cards** handle VPC networking, EBS, and local storage. A lightweight **Nitro hypervisor** manages CPU and memory, and a **Nitro security chip** protects the hardware. Two consequences matter to architects. Nearly all of the host's CPU and memory goes to instances, and the design gives no operator access to instance memory, including by AWS staff.

**Nitro Enclaves** carve isolated compute out of an instance, with no network, no persistent storage, and no interactive access, even from the parent instance's root user. An enclave proves what code it runs through **cryptographic attestation**, and AWS KMS can release a key only to an enclave whose attestation matches, so sensitive data can be decrypted only inside it. Enclaves cost nothing beyond the instance.

---

## AMIs and Launch Templates

An **AMI** captures a root volume and its configuration. AWS, operating system vendors, and AWS Marketplace publish AMIs, and teams build their own **golden images** with security agents, configuration, and sometimes the application already installed. Baking more into the image makes instances start faster and behave more consistently. Baking less, and configuring at boot with **user data** scripts or a configuration tool, keeps images fewer and easier to update. EC2 Image Builder automates building, testing, and distributing images on a schedule, so patched images replace old ones regularly.

AMIs and launch templates are Regional. Using an AMI in another Region, for disaster recovery or a multi-Region fleet, means copying it there first, which Image Builder's distribution settings can do automatically.

A **launch template** records everything needed to launch an instance: AMI, instance type, security groups, IAM instance profile, metadata options, user data, and storage. Templates are versioned, so a change creates a new version and older ones remain for rollback. Auto Scaling groups and most infrastructure tools launch from templates. The older **launch configurations** are frozen. They don't support instance types released since 2023, and accounts created from October 2024 on can't create them at all.

---

## Access and Identity on the Instance

### Instance Roles

Applications on an instance should get AWS credentials from an **IAM role** attached through an **instance profile**, never from access keys stored on disk. EC2 delivers short-lived credentials for the role through the instance metadata service and rotates them automatically, and the AWS SDKs find them without configuration. Each instance's role should grant only what its workload needs, since anyone who controls the instance can use it.

### IMDSv2

The **instance metadata service (IMDS)** answers requests from the instance at `169.254.169.254` with its ID, network details, user data, and the role's temporary credentials. The original version, IMDSv1, answers any HTTP GET. A server-side request forgery bug, where an application can be tricked into fetching a URL an attacker supplies, can then return the role's credentials.

**IMDSv2** requires a session token obtained with a `PUT` request first, which common forgery paths can't make, and it limits how many network hops the token response travels:

{% include figure.html id="aws-imdsv2-hop-limit" %}

Require it everywhere:

- **Per instance**, by setting `HttpTokens` to `required` in the launch template.
- **Per account and Region**, by making IMDSv2 the default for new instances, or by **enforcing** it so launches that allow IMDSv1 fail.
- **Across an organization**, with an EC2 declarative policy, an AWS Organizations policy that holds service settings in every account.
- **Per AMI**, by marking the image as IMDSv2-only, which can't be undone.

Because containers sit one network hop further from the metadata service, set the **hop limit** to 2 on container hosts, or the token never reaches them.

### Shell Access Without SSH

Opening port 22 to reach instances means managing keys and exposing a service. **AWS Systems Manager Session Manager** opens an IAM-controlled, logged shell with no inbound port and no key. **EC2 Instance Connect** pushes a one-time SSH key tied to an IAM identity. It still needs port 22 reachable, either from the service's address range or through an EC2 Instance Connect Endpoint for private instances. Either removes long-lived SSH keys, and Session Manager also removes the open port.

---

## Paying for Instances

| Option | What you commit | Fits |
|---|---|---|
| **On-Demand** | Nothing | Unpredictable or short-lived workloads, and the baseline to compare against |
| **Commitments** (Savings Plans, Reserved Instances) | A spend or instance usage for one or three years, for up to 72% off | Steady baseline usage |
| **Spot** | Nothing, but AWS can reclaim the instance | Fault-tolerant, flexible work |

For instance design, a commitment rewards a steady baseline, while Spot rewards flexibility, and most fleets combine them: commitments for the floor, On-Demand for peaks, and Spot for work that can be interrupted.

### Spot Instances

**Spot instances** run on spare EC2 capacity at a price that moves slowly with supply and demand, which AWS says can be up to 90% below On-Demand. When EC2 needs the capacity back, it interrupts the instance with a **two-minute notice**, delivered through instance metadata and as an event on Amazon EventBridge, AWS's event bus. A **rebalance recommendation** often arrives earlier, when an instance's risk of interruption rises.

Spot works when the workload can be interrupted without losing work: stateless web tiers behind a load balancer, containers, CI builds, batch jobs that checkpoint, and big data processing. The practices that make it reliable are all about flexibility:

- **Accept many instance types and AZs.** Each type in each AZ is a separate capacity pool. The more pools a fleet can draw from, the less any one pool's shortage matters.
- **Use the price-capacity-optimized allocation strategy,** which launches from pools that are both deep and cheap.
- **Handle the notice.** Drain work, deregister from load balancers, and checkpoint within two minutes.

Spot doesn't fit single instances that must stay up, stateful databases, or long jobs that can't checkpoint. Savings Plans don't apply to Spot usage.

### Capacity Reservations

Discounts don't guarantee that capacity exists when you launch. An **On-Demand Capacity Reservation** holds capacity for a given instance type in a specific AZ, billed at On-Demand rates whether used or not, and a Savings Plan can discount it. Reservations suit launches that must succeed, such as disaster recovery or a planned event. **Capacity Blocks for ML** reserve GPU and Trainium instances for a fixed future window, up to eight weeks ahead, and can't be cancelled.

### Dedicated Tenancy

Instances normally share physical hosts with other customers' instances, isolated by Nitro. **Dedicated Instances** run on hardware used only by your account. **Dedicated Hosts** go further and give you a specific physical server, with visibility into its sockets and cores, which is what bring-your-own-license software priced per socket or core, such as some Windows Server and SQL Server licenses, requires. Both cost more than shared tenancy, and neither is needed for security isolation alone.

---

## Auto Scaling Groups

### What a Group Does

An **Auto Scaling group** keeps a fleet of instances at a **desired capacity**, between a minimum and maximum, across the subnets and AZs you give it. It launches from a launch template, balances instances across AZs, replaces instances that fail **health checks**, and registers them with load balancer target groups, the sets of instances a load balancer sends traffic to. Even a fleet that never scales benefits, because the group replaces failed instances on its own.

Two health checks matter. **EC2 status checks** catch a broken host or instance. **Load balancer health checks**, turned on for the group, also catch an instance whose application has failed while the operating system still runs, which is usually what matters. A **health check grace period** keeps a new instance from being replaced while it is still starting.

### Scaling Policies

The group changes desired capacity through policies:

- **Target tracking** holds a metric at a target, such as average CPU at 50% or requests per target at 1,000. It is the usual default, because you state the goal and it works out the steps.
- **Step scaling** adds or removes set amounts as a CloudWatch alarm (a threshold on a metric) crosses its bounds, for finer control.
- **Scheduled scaling** changes capacity at set times, for known patterns such as business hours.
- **Predictive scaling** forecasts load from at least a day of history and scales ahead of it, for regular daily or weekly cycles too sharp for reactive policies. Irregular load gives it nothing to learn from.

Scaling on CPU works best with detailed monitoring turned on, which publishes instance metrics every minute rather than every five.

{% include figure.html id="aws-asg-scaling-loop" %}

Reactive policies act only after a metric moves, and new instances take minutes to boot and warm up. A **default instance warmup**, which AWS strongly recommends but which is off until you set it, keeps a new instance's metrics out of the calculation until it's ready, so the group doesn't overshoot. **Warm pools** keep pre-initialized instances, usually stopped or hibernated, ready to join quickly, for applications with slow starts. Warm pools don't work with Spot instances in a mixed instances group.

### Mixed Instances and Updates

A **mixed instances policy** lets one group launch several instance types and combine On-Demand and Spot, for example an On-Demand base of four instances with everything above it 70% Spot. **Attribute-based instance type selection** goes further, describing requirements such as "4 to 8 vCPUs, at least 16 GiB, current generation" and letting the group use any type that matches, including new ones as they launch.

Changing the launch template doesn't touch running instances. An **instance refresh** replaces them in batches while keeping a minimum share healthy, with optional checkpoints and automatic rollback. **Lifecycle hooks** pause an instance as it launches or terminates, so a script can finish configuration or drain connections before the group moves on.

---

## Placement Groups

By default, EC2 spreads instances across hardware as it sees fit. A **placement group** asks for a particular arrangement. A cluster group lives in one AZ, while partition and spread groups can span the AZs of a Region, with their limits counted per AZ:

{% include figure.html id="aws-ec2-placement-groups" %}

| Strategy | Arrangement | Fits |
|---|---|---|
| **Cluster** | Close together in one AZ, on a high-bandwidth network segment | Tightly coupled HPC and workloads that exchange heavy traffic between instances |
| **Partition** | Up to seven partitions per AZ, each on its own racks | Large replicated systems such as Kafka, Cassandra, or HDFS, which can place replicas in different partitions |
| **Spread** | Each instance on its own rack, at most seven running per AZ | A handful of critical instances that must not fail together |
| **Precision time** (since June 2026) | On hardware with direct access to high-accuracy time sources | Distributed databases and trading systems that order events by microsecond-accurate clocks |

Cluster groups trade resilience for speed, and launching all instances in one request, of one type, gives the best chance of getting the capacity. Partition and spread groups trade capacity for resilience against rack failures, and they complement spreading across AZs rather than replacing it.

---

## Common Pitfalls

### Hand-Built, Long-Lived Instances

An instance configured by hand and patched in place drifts from every other instance and can't be replaced quickly. Build from images and launch templates, run even single instances in an Auto Scaling group of one, and replace instances rather than repairing them.

### IMDSv1 Left On

An application with a request forgery bug on an instance that still allows IMDSv1 can hand its role's credentials to an attacker. Enforce IMDSv2 at the account level, and check the hop limit on container hosts.

### A Fleet That Accepts One Instance Type

A group pinned to one type in one AZ fails to launch when that pool runs out, whether On-Demand or Spot. Give groups several types and every AZ the workload can use.

### Scaling on a Metric That Doesn't Track Load

CPU is a poor signal for applications bound by I/O, memory, or downstream calls. Scale on the metric that rises with the work, such as request count per target or queue depth per instance.

---

## Key Takeaways

1. **An instance is an instance type, an AMI, network placement, and storage.** Instance store data doesn't survive a stop.
2. **Pick the family by the workload's bottleneck, then the newest generation available.** Try Graviton for Linux workloads whose dependencies build for Arm.
3. **Launch from versioned launch templates and images,** and treat instances as replaceable.
4. **Give instances IAM roles, require IMDSv2, and reach them through Session Manager** instead of SSH keys and open ports.
5. **Combine purchase options:** commitments for the steady floor, On-Demand for peaks, and Spot, spread across many pools, for interruptible work.
6. **Run fleets in Auto Scaling groups,** with load balancer health checks, target tracking, several instance types, and instance refresh for updates.
7. **Use placement groups** when instances need to be close together or kept apart within an AZ.
