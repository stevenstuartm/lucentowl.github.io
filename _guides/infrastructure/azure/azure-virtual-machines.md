---
title: "Azure Virtual Machines for System Architects"
layout: guide
category: Azure
subcategory: Compute Services
description: "VM fundamentals for architects including instance families, VM Scale Sets, Availability Sets and Zones, Spot VMs, and cost optimization strategies for running compute workloads on Azure."
tags: [virtual-machines, vm-scale-sets, spot-vms, availability-zones, reserved-instances, azure-hybrid-benefit, practical]
---

## What Is an Azure Virtual Machine

An [Azure Virtual Machine](https://learn.microsoft.com/en-us/azure/virtual-machines/overview){:target="_blank" rel="noopener noreferrer"} (VM) is Infrastructure-as-a-Service (IaaS) compute on Azure. You choose the operating system, VM size, disk configuration, and networking, and Azure handles the underlying physical infrastructure. VMs run inside a Virtual Network and can be placed in Availability Sets or Availability Zones for resilience.

VMs are the most flexible compute option on Azure. They support any workload that runs on a standard operating system, whether that is Windows Server, a variety of Linux distributions, or specialized marketplace images for databases, firewalls, and development tools.

### When to Use VMs vs PaaS Compute

VMs are not always the right answer. Azure offers several PaaS compute services that reduce operational overhead at the cost of flexibility.

| Factor | VMs (IaaS) | App Service / Container Apps (PaaS) |
|--------|-----------|--------------------------------------|
| **OS control** | Full control over OS, patches, and configuration | Platform manages OS updates and patches |
| **Custom software** | Install anything the OS supports | Limited to supported runtimes and containers |
| **Licensing** | Bring existing Windows Server / SQL licenses via Hybrid Benefit | License included in platform pricing |
| **Scaling** | Manual or autoscale via VM Scale Sets | Built-in autoscale with less configuration |
| **Operational overhead** | You manage OS patching, security, monitoring | Platform handles infrastructure operations |
| **Migration** | Lift-and-shift from on-premises with minimal changes | Requires application modification |

**Choose VMs when** you need full OS control, must run legacy software that cannot be containerized, require specific kernel configurations, or are performing lift-and-shift migrations. **Choose PaaS** when application portability and reduced operational overhead outweigh the need for infrastructure control.

### What Problems VMs Solve

**Without Azure VMs:**
- Procuring physical servers takes weeks or months
- Capacity planning requires upfront capital expenditure for peak demand
- Hardware failures require manual intervention and spare parts
- Scaling up means buying new servers; scaling down means wasted capital
- Testing and development environments compete for limited physical hardware

**With Azure VMs:**
- Provision compute in minutes with precise resource specifications
- Scale capacity up or down based on demand without capital expenditure
- Azure manages physical infrastructure, power, cooling, and hardware replacements
- Development and test environments can be spun up and torn down on demand
- Reserved Instances and Spot VMs reduce costs for predictable and interruptible workloads

### How Azure VMs Differ from AWS EC2

Architects familiar with AWS should note several differences:

| Concept | AWS EC2 | Azure VMs |
|---------|---------|-----------|
| **Instance naming** | Family + generation + size (e.g., `m5.xlarge`) | Family + version + capabilities + size (e.g., `Standard_D4s_v5`) |
| **Auto scaling** | Auto Scaling Groups (ASG) | VM Scale Sets (VMSS) with Uniform or Flexible orchestration |
| **Placement for HA** | Placement Groups (cluster, spread, partition) | Availability Sets (fault/update domains) or Availability Zones |
| **Spot compute** | Spot Instances with Spot Fleet | Spot VMs with eviction policies per VM or in VMSS |
| **Image management** | AMIs in account/region | Azure Compute Gallery (shared across subscriptions, tenants, regions) |
| **Burstable instances** | T-series with CPU credits | B-series with CPU credits (similar model) |
| **License portability** | License included or BYOL for some | Azure Hybrid Benefit for Windows Server and SQL Server licenses |
| **Reserved pricing** | Reserved Instances (1yr/3yr) | Reserved VM Instances (1yr/3yr) + Savings Plans |
| **Ephemeral storage** | Instance store (lost on stop) | Ephemeral OS disk (re-imaged on redeployment) |
| **SLA (single VM)** | 99.5% instance-level SLA | 99.9% with Premium SSD (all disks) |

---

## VM Sizes and Instance Families

Azure organizes VM sizes into families based on workload characteristics. Each family is optimized for a different balance of CPU, memory, storage, and GPU resources.

### Naming Convention

Azure VM size names follow a structured pattern:

```
Standard_D4s_v5
│        │││  │
│        ││└──└─ Version (v5 = 5th generation)
│        │└──── Capabilities (s = Premium SSD capable)
│        └───── vCPUs or size indicator (4 = 4 vCPUs)
│
└──────── Family (D = General Purpose)
```

**Common capability suffixes:**

| Suffix | Meaning |
|--------|---------|
| `s` | Premium SSD capable |
| `d` | Local temp disk included |
| `a` | AMD processor |
| `i` | Isolated (dedicated physical host) |
| `l` | Low memory per core |
| `m` | High memory per core |
| `t` | Tiny memory (burstable) |
| `p` | ARM-based processor |

A VM like `Standard_E8ds_v5` is a Memory Optimized (E) family, 8 vCPUs, with local temp disk (d), Premium SSD capable (s), version 5.

### Instance Families

| Family | Type | Typical Use Cases | vCPU:Memory Ratio |
|--------|------|-------------------|-------------------|
| **B** | Burstable General Purpose | Dev/test, low-traffic web servers, small databases | Varies (baseline + burst credits) |
| **D** | General Purpose | Enterprise applications, mid-size databases, application servers | 1:4 |
| **E** | Memory Optimized | In-memory analytics, large caches, SAP HANA, relational databases | 1:8 |
| **M** | Memory Optimized (Ultra) | SAP HANA production, large in-memory databases | Up to 1:28 |
| **F** | Compute Optimized | Batch processing, gaming servers, scientific modeling, CPU-intensive analytics | 1:2 |
| **L** | Storage Optimized | Large NoSQL databases like Cassandra, data warehouses, large transactional databases | 1:8 (with high local SSD throughput) |
| **N** | GPU Accelerated | Machine learning training/inference, 3D rendering, video encoding, HPC simulations | Varies (includes NVIDIA GPUs) |
| **H** | High Performance Compute | Fluid dynamics, weather modeling, molecular simulations, finite element analysis | 1:2 (with InfiniBand networking) |

<div class="callout callout--tip">
<p class="callout__title">Choosing a Family</p>
<p>Start with the D-series (General Purpose) for most workloads and right-size from there. If CPU metrics consistently show high utilization with low memory use, move to F-series. If memory pressure is the bottleneck, move to E-series. Use Azure Advisor's right-sizing recommendations to validate choices after workloads are running.</p>
</div>

### B-Series Burstable VMs

B-series VMs operate on a credit-based model similar to AWS T-series instances. Each VM earns CPU credits during periods of low utilization and spends them during bursts. Once credits are depleted, the VM is throttled to its baseline performance.

B-series is the most cost-effective option for workloads with variable CPU usage that stay below the baseline most of the time, such as development servers, low-traffic web applications, and small databases. For production workloads with sustained CPU requirements, D-series or F-series provide consistent performance without the risk of throttling.

---

## VM Images

### Marketplace Images

The [Azure Marketplace](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/cli-ps-findimage){:target="_blank" rel="noopener noreferrer"} provides thousands of pre-configured images from Microsoft and third-party publishers. These include base operating system images (Windows Server, Ubuntu, RHEL, SUSE) and application images (SQL Server, SAP, network appliances, development tools).

Marketplace images follow a four-part identifier: **Publisher : Offer : SKU : Version**. For example, `Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest` identifies an Ubuntu 22.04 LTS image from Canonical.

Some marketplace images carry additional per-hour software licensing costs on top of the VM compute cost. The pricing page for each image specifies whether a software charge applies.

### Custom Images and Azure Compute Gallery

[Azure Compute Gallery](https://learn.microsoft.com/en-us/azure/virtual-machines/azure-compute-gallery){:target="_blank" rel="noopener noreferrer"} (formerly Shared Image Gallery) is the recommended way to manage custom VM images at scale. You create a golden image with your organization's required software, security baselines, and configurations, then publish it through the gallery.

**Gallery capabilities:**
- **Versioning:** Each image definition supports multiple versions, enabling rollback
- **Replication:** Images replicate across Azure regions for faster provisioning
- **Sharing:** Share images across subscriptions, tenants (via RBAC or community gallery), and regions
- **Generalized vs Specialized:** Generalized images run sysprep (Windows) or waagent deprovision (Linux) for unique machine identity; specialized images retain machine identity for cloning exact configurations

For large-scale deployments, pre-replicate images to target regions before provisioning to avoid cross-region image download delays during scale-out events.

---

## Disk Options

Each VM has at least one disk (the OS disk) and can attach additional data disks. Azure also supports ephemeral OS disks for stateless workloads.

### Disk Types Overview

| Disk Type | Performance Tier | IOPS Range | Throughput Range | Use Case |
|-----------|-----------------|------------|------------------|----------|
| **Ultra Disk** | Highest | Up to 400,000 | Up to 10,000 MB/s | Transaction-heavy databases, SAP HANA |
| **Premium SSD v2** | High (granular) | Up to 80,000 | Up to 2,000 MB/s | Production databases, latency-sensitive apps |
| **Premium SSD** | High | Up to 20,000 | Up to 900 MB/s | Production workloads, most databases |
| **Standard SSD** | Medium | Up to 6,000 | Up to 750 MB/s | Web servers, lightly used application servers |
| **Standard HDD** | Low | Up to 2,000 | Up to 500 MB/s | Backup, infrequently accessed data, dev/test |

Premium SSD v2 allows you to independently configure IOPS and throughput without changing disk size, unlike Premium SSD where performance scales with the provisioned disk size. This makes v2 more cost-effective for workloads that need high IOPS on smaller disks.

### Ephemeral OS Disks

[Ephemeral OS disks](https://learn.microsoft.com/en-us/azure/virtual-machines/ephemeral-os-disks){:target="_blank" rel="noopener noreferrer"} use the VM's local temp storage or cache disk for the OS, instead of a remote managed disk. The OS disk is re-created from the VM image every time the VM is deallocated and reallocated.

**When ephemeral OS disks make sense:**
- Stateless workloads where application state lives in external storage or databases
- VM Scale Set instances where each VM is identical and replaceable
- Workloads that benefit from lower read latency on the OS disk (local storage is faster than remote managed disks)
- Reduced cost because there is no managed disk charge for the OS disk

**Trade-off:** Any data written to the OS disk is lost on deallocation, reimage, or host maintenance events. Persistent data must live on attached data disks or external storage.

---

## Networking

### Network Interfaces

Each VM has one or more [network interfaces](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-network-interface-vm){:target="_blank" rel="noopener noreferrer"} (NICs) that connect it to a VNet subnet. The maximum number of NICs depends on the VM size, with larger sizes supporting more NICs for multi-homed configurations.

Each NIC can have:
- One or more private IP addresses (primary + secondary IPs)
- An optional public IP address
- An associated Network Security Group
- Membership in one or more Application Security Groups

### Accelerated Networking

[Accelerated Networking](https://learn.microsoft.com/en-us/azure/virtual-network/accelerated-networking-overview){:target="_blank" rel="noopener noreferrer"} uses single-root I/O virtualization (SR-IOV) to bypass the host's virtual switch and deliver network traffic directly to the VM's NIC. This reduces latency, jitter, and CPU utilization for network operations.

Accelerated Networking is supported on most VM sizes with 2 or more vCPUs and is enabled by default on newer VM images. There is no additional cost. For latency-sensitive workloads like databases, real-time applications, and high-throughput services, confirm that accelerated networking is enabled.

### Proximity Placement Groups

A [Proximity Placement Group](https://learn.microsoft.com/en-us/azure/virtual-machines/co-location){:target="_blank" rel="noopener noreferrer"} (PPG) is a logical grouping that constrains VMs to be physically close within an Azure data center. This minimizes network latency between VMs to sub-millisecond levels.

**When to use PPGs:**
- Tightly coupled applications where inter-VM latency directly impacts performance
- HPC workloads requiring fast inter-node communication
- Application tiers that exchange high volumes of data (such as an application server and its dedicated database)

**Trade-off:** PPGs constrain placement to a smaller set of physical hosts, which can reduce availability during capacity crunches. Do not combine PPGs with Availability Zones, because zones spread resources across physically separate data centers (the opposite of what PPGs accomplish).

---

## Availability

Azure provides three mechanisms for VM high availability, each protecting against different failure scenarios.

### Availability Sets

An [Availability Set](https://learn.microsoft.com/en-us/azure/virtual-machines/availability-set-overview){:target="_blank" rel="noopener noreferrer"} distributes VMs across fault domains and update domains within a single data center.

- **Fault Domains (FDs):** Groups of VMs that share a common power source and network switch. Azure supports up to 3 fault domains per Availability Set. If a rack fails, only VMs in that fault domain are affected.
- **Update Domains (UDs):** Groups of VMs that Azure reboots together during planned maintenance. Up to 20 update domains per Availability Set. Azure reboots one update domain at a time, ensuring that a portion of your VMs remains running during platform updates.

Azure assigns each VM a fault domain and an update domain, spreading instances across both axes so no single rack failure or maintenance reboot can take the whole set down at once:

```
Availability Set placement (3 fault domains x 2 update domains shown)

              UD0     UD1
       FD0    VM1     VM4
       FD1    VM2     VM5
       FD2    VM3     VM6

  Fault domain (row) = shared power + network switch. A rack failure takes one row
                       (e.g. FD1 drops VM2 and VM5); the other rows keep serving.
  Update domain (col) = planned-maintenance reboot group. Azure reboots one column
                       at a time (UD0, then UD1), so most instances stay up.
```

**SLA:** VMs in an Availability Set with 2+ instances across 2+ fault domains receive a 99.95% SLA.

Availability Sets are a legacy construct from before Availability Zones became widely available. They still serve a purpose for regions that do not support zones or for workloads constrained to a single data center, but Availability Zones provide stronger isolation for most production scenarios.

### Availability Zones

[Availability Zones](https://learn.microsoft.com/en-us/azure/reliability/availability-zones-overview){:target="_blank" rel="noopener noreferrer"} are physically separate data centers within an Azure region, each with independent power, cooling, and networking. Zones protect against entire data center failures, not just rack or switch failures.

- Most Azure regions have 3 Availability Zones
- Unlike AWS, Azure VNet subnets span all zones in a region; you do not create separate subnets per zone
- Zone redundancy is configured on individual resources (VMs, load balancers, managed disks)
- There are no cross-zone data transfer charges within a region (unlike AWS)

**SLA:** VMs distributed across 2+ Availability Zones receive a 99.99% SLA.

**Zonal vs Zone-Redundant deployment:**
- **Zonal:** A VM is pinned to a specific zone (Zone 1, 2, or 3). You deploy multiple VMs across zones for redundancy.
- **Zone-Redundant:** Some services like Azure Load Balancer and Application Gateway automatically spread across all zones. Individual VMs are always zonal.

### Single VM SLA

A single VM (not in an Availability Set or Zone) with all OS and data disks using Premium SSD or Ultra Disk receives a 99.9% SLA. AWS also publishes a single-instance SLA for EC2, but at 99.5%, so Azure's single-VM commitment is the higher of the two.

<div class="callout callout--tip">
<p class="callout__title">Choosing an Availability Strategy</p>
<p>For production workloads, deploy across Availability Zones with a load balancer for the strongest protection. Use Availability Sets only when zones are unavailable in the target region or when the workload requires co-location within a single data center. For non-critical single VMs like dev/test or utility servers, the single VM SLA with Premium SSD provides sufficient reliability.</p>
</div>

### Availability Comparison

| Strategy | Protects Against | SLA | Cross-Zone Cost | When to Use |
|----------|-----------------|-----|-----------------|-------------|
| **Single VM (Premium SSD)** | Host hardware failure (auto-migration) | 99.9% | N/A | Dev/test, non-critical single instances |
| **Availability Set** | Rack failure, planned maintenance | 99.95% | N/A (same data center) | Regions without zone support |
| **Availability Zones** | Data center failure | 99.99% | No extra charge | Production workloads in zone-enabled regions |

---

## VM Scale Sets

### What Scale Sets Solve

[VM Scale Sets](https://learn.microsoft.com/en-us/azure/virtual-machine-scale-sets/overview){:target="_blank" rel="noopener noreferrer"} (VMSS) let you create and manage a group of identical VMs that scale automatically based on demand. VMSS is Azure's equivalent to AWS Auto Scaling Groups.

Without Scale Sets, scaling a tier of VMs requires manually provisioning new VMs, configuring them identically, adding them to load balancer backend pools, and removing them during low demand. Scale Sets automate this entire lifecycle.

### Orchestration Modes

VMSS supports two orchestration modes that differ in how much control Azure exercises over individual VM instances:

| Aspect | Uniform | Flexible |
|--------|---------|----------|
| **VM model** | All VMs use the same model (image, size, config) | Mix VM sizes, images, and configurations |
| **Instance management** | Azure manages instance lifecycle | You manage individual VMs with more control |
| **Availability** | Automatic fault domain spreading | Explicit zone or Availability Set assignment |
| **Scaling** | Built-in autoscale policies | Autoscale or manual VM management |
| **Load balancer integration** | Automatic | Automatic or manual |
| **Use case** | Homogeneous stateless workloads (web servers, workers) | Heterogeneous workloads, gradual migration from standalone VMs |

**Uniform mode** is the traditional VMSS experience and remains the right choice for stateless, homogeneous workloads like web server tiers and batch processing pools. All VMs are created from the same model definition.

**Flexible mode** allows mixing different VM sizes, adding existing standalone VMs to the scale set, and provides more granular control over individual instances. Microsoft recommends Flexible mode for new deployments because it offers a superset of Uniform capabilities while providing more control.

### Autoscaling

Scale Sets support autoscaling based on metrics or schedules:

**Metric-based autoscale:**
- Scale on Azure Monitor metrics like CPU percentage, memory utilization, network throughput, or custom application metrics
- Configure scale-out and scale-in rules with thresholds, cooldown periods, and instance count limits
- Set minimum, maximum, and default instance counts to prevent over-scaling or scaling to zero unintentionally

**Schedule-based autoscale:**
- Scale to predetermined instance counts at specific times (such as scaling up before business hours and down overnight)
- Combine with metric-based rules for both predictable patterns and unexpected demand spikes

**Autoscale best practices:**
- Set cooldown periods long enough to prevent flapping (typically 5-10 minutes)
- Use separate scale-out and scale-in rules; scale out aggressively and scale in conservatively
- Monitor the "Autoscale scale actions" metric to verify scaling is behaving as expected
- Test maximum instance count against subscription VM core quotas before production deployment

### Rolling Upgrades

When you update the VM model (new image version, configuration change, or extension update), Scale Sets support rolling upgrades that apply the new model to instances in batches:

- **Max batch percentage:** Controls what percentage of instances are upgraded simultaneously
- **Pause time between batches:** Allows new instances to stabilize before the next batch begins
- **Max unhealthy percentage:** Halts the upgrade if too many instances fail health probes during the rollout
- **Prioritize unhealthy instances:** Upgrades unhealthy instances first to avoid disrupting healthy capacity

Rolling upgrades combined with health probes ensure zero-downtime deployments for stateless workloads. For stateful workloads, consider blue-green deployment patterns with separate scale sets instead.

---

## Spot VMs

### How Spot VMs Work

[Azure Spot VMs](https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms){:target="_blank" rel="noopener noreferrer"} let you use Azure's unused compute capacity at steep discounts, typically up to 90% off pay-as-you-go pricing. In exchange, Azure can evict the VM at any time when it needs the capacity back.

Spot VMs are Azure's equivalent to AWS Spot Instances. They use the same underlying mechanism: surplus capacity is sold at a discount, and Azure reclaims it when demand from pay-as-you-go or reserved customers requires it.

### Eviction Policies

When Azure needs to reclaim capacity, it evicts Spot VMs with 30 seconds of advance notice (accessible via the Azure Metadata Service). You choose what happens on eviction:

| Eviction Policy | Behavior | Billing After Eviction | Best For |
|-----------------|----------|----------------------|----------|
| **Stop-Deallocate** | VM is stopped and deallocated. Disks and IPs are retained. | No compute charges (disk charges continue) | Workloads that can resume from where they stopped |
| **Delete** | VM and all attached resources are deleted | No further charges | Ephemeral batch jobs, scale set instances |

### Max Price Configuration

You can set a maximum price you are willing to pay per hour for a Spot VM. Azure evicts the VM if the current Spot price exceeds your max price. Setting the max price to -1 means you accept the current Spot price up to the pay-as-you-go rate (the VM is evicted only for capacity reasons, not for price reasons).

### When Spot VMs Make Sense

- **Batch processing and rendering:** Jobs that can checkpoint progress and resume after eviction
- **Development and testing:** Non-critical environments where occasional interruptions are acceptable
- **CI/CD build agents:** Build pipelines that can retry failed jobs
- **Large-scale data processing:** MapReduce, Spark, or ETL workloads with built-in fault tolerance
- **Scale Set supplementation:** Use Spot VMs alongside regular instances in a Scale Set, where Spot instances handle burst capacity and regular instances guarantee baseline availability

**When Spot VMs do not make sense:**
- Production workloads with strict availability requirements
- Stateful services that cannot tolerate interruption
- Workloads with tight SLA commitments

<div class="callout callout--note">
<p class="callout__title">Spot VM Availability</p>
<p>Spot availability varies by VM size, region, and time of day. Popular sizes like D-series and F-series in busy regions experience more frequent evictions. Check the <a href="https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms#pricing" target="_blank" rel="noopener noreferrer">Spot pricing history</a> to understand eviction patterns for your target VM size and region before committing to a Spot-based architecture.</p>
</div>

---

## Architectural Patterns

### Pattern 1: Stateless Web Tier with VMSS and Availability Zones

**Use case:** Production web application requiring horizontal scaling and zone redundancy.

```
Internet
   ↓
Application Gateway (WAF_v2, zone-redundant)
   ↓
VM Scale Set (Flexible mode, spread across 3 zones)
   ├── Zone 1: 2 instances
   ├── Zone 2: 2 instances
   └── Zone 3: 2 instances
   ↓
Internal Load Balancer → App Tier VMSS
   ↓
Private Endpoint → Azure SQL Database (zone-redundant)
```

**Components:**
- Application Gateway provides Layer 7 routing, SSL termination, and WAF protection
- Web tier VMSS with autoscale based on CPU percentage (scale out at 70%, scale in at 30%)
- Instances spread across 3 Availability Zones for 99.99% SLA
- Ephemeral OS disks for faster scaling and lower cost
- NAT Gateway for outbound connectivity

**Trade-offs:**
- Requires stateless application design (session state in Redis or database)
- Application Gateway adds cost compared to Load Balancer alone, but provides WAF and Layer 7 features

---

### Pattern 2: Lift-and-Shift with Availability Set

**Use case:** Migrating an on-premises application to Azure with minimal changes.

```
On-Premises
   ↓ (migrated via Azure Migrate)
Azure VNet
   ├── Frontend Subnet
   │   └── Availability Set: 2 Web Server VMs (IIS / Apache)
   ├── App Subnet
   │   └── Availability Set: 2 App Server VMs
   └── Data Subnet
       └── Private Endpoint → Azure SQL Managed Instance
```

**Components:**
- Existing application deployed on VMs with minimal modification
- Availability Sets provide 99.95% SLA within a single data center
- Azure Hybrid Benefit applied for existing Windows Server licenses
- Reserved Instances for predictable 1-year or 3-year commitment
- NSGs enforce tier-to-tier isolation

**Trade-offs:**
- Lower resilience than Availability Zones (single data center)
- Higher operational overhead compared to PaaS alternatives
- Suitable as a first migration step before modernizing to PaaS

---

### Pattern 3: Batch Processing with Spot VMs

**Use case:** Large-scale data processing where cost matters more than completion time guarantees.

```
Azure Storage (input data)
   ↓
VM Scale Set (Spot VMs, autoscale 0-100 instances)
   ├── F-series Compute Optimized for CPU-heavy processing
   ├── Eviction policy: Delete (stateless workers)
   └── Checkpoints written to Azure Storage every N minutes
   ↓
Azure Storage (output data)
```

**Components:**
- Spot VMs at up to 90% discount for batch workers
- Scale Set scales to zero during idle periods (no cost)
- Workers checkpoint progress to Azure Storage; evicted work is retried automatically
- Mix of Spot and regular instances for guaranteed baseline throughput

**Trade-offs:**
- Processing time is unpredictable due to potential evictions
- Application must be designed for interruption (idempotent processing, checkpointing)
- Cost savings of 60-90% compared to pay-as-you-go pricing

---

### Pattern 4: Hub-and-Spoke with Centralized Management VMs

**Use case:** Enterprise environment with shared infrastructure services running on VMs.

```
Hub VNet
   ├── Management Subnet
   │   ├── Domain Controllers (Availability Set, 2 FD / 5 UD)
   │   ├── Monitoring Agents
   │   └── Jump Boxes (or Azure Bastion)
   ├── AzureFirewallSubnet → Azure Firewall
   └── GatewaySubnet → VPN/ExpressRoute Gateway

Spoke VNet 1 (Production)  ←peered→  Hub
   └── VMSS (web tier, app tier)

Spoke VNet 2 (Development)  ←peered→  Hub
   └── Spot VMs (dev/test, auto-shutdown enabled)
```

**Components:**
- Domain controllers in Availability Set for directory services HA
- Spoke workloads use VMSS for production and Spot VMs for development
- All traffic routes through Azure Firewall in the hub for centralized inspection
- Development VMs use auto-shutdown schedules to reduce cost
- Azure Bastion replaces traditional jump boxes for secure RDP/SSH access

---

## Cost Optimization

Azure provides multiple mechanisms to reduce VM compute costs. The strategies stack: you can combine Reserved Instances with Azure Hybrid Benefit and right-sizing for compound savings.

### Reserved VM Instances

[Reserved VM Instances](https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/save-compute-costs-reservations){:target="_blank" rel="noopener noreferrer"} commit to a specific VM size in a specific region for 1 or 3 years. In exchange, you receive significant discounts compared to pay-as-you-go pricing, with 3-year reservations providing steeper savings.

**Reservation scope options:**
- **Single subscription:** Discount applies within one subscription
- **Shared scope:** Discount applies across all subscriptions in a billing account
- **Resource Group:** Discount applies within a specific resource group
- **Management Group:** Discount applies across subscriptions within a management group

**Instance size flexibility** allows a reservation for one VM size to apply to other sizes in the same size family. A reservation for `D4s_v5` can cover two `D2s_v5` instances or half of a `D8s_v5` instance, based on a ratio system.

### Savings Plans

[Azure Savings Plans](https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/savings-plan-compute-overview){:target="_blank" rel="noopener noreferrer"} commit to a fixed hourly spend on compute (not a specific VM size) for 1 or 3 years. Savings Plans provide less discount than equivalent Reserved Instances but offer more flexibility because the commitment applies across VM families, regions, and even across compute services like App Service and Container Apps.

| Strategy | Discount Level | Flexibility | Commitment |
|----------|---------------|------------|------------|
| **Pay-as-you-go** | Baseline | Maximum (no commitment) | None |
| **Savings Plans** | Moderate | High (any VM family/region/compute service) | 1yr or 3yr hourly spend |
| **Reserved Instances** | Highest | Lower (specific VM family, region) | 1yr or 3yr |

Use Reserved Instances for stable, well-understood workloads that will not change VM family or region. Use Savings Plans for dynamic workloads where flexibility matters more than maximizing discount depth.

### Azure Hybrid Benefit

[Azure Hybrid Benefit](https://learn.microsoft.com/en-us/azure/virtual-machines/windows/hybrid-use-benefit-licensing){:target="_blank" rel="noopener noreferrer"} lets you use existing on-premises Windows Server and SQL Server licenses (with active Software Assurance) on Azure VMs. This eliminates the Windows or SQL license cost from the VM price, which represents a substantial portion of Windows VM pricing.

**Eligible licenses:**
- Windows Server Standard or Datacenter with active Software Assurance or a qualifying subscription. Each VM needs a minimum of 8 core licenses and scales up to the VM's actual core count, with each processor license counting as 16 core licenses.
- Datacenter edition additionally grants dual-use rights, meaning the same license can run on-premises and in Azure at the same time, whereas Standard requires moving the license to Azure. (The "run unlimited VMs per host" entitlement applies only to Azure Dedicated Host and Azure VMware Solution, not standard multi-tenant VMs.)
- SQL Server Standard and Enterprise

Hybrid Benefit stacks with Reserved Instances and Savings Plans for maximum savings. An organization running Windows Server workloads on reserved, right-sized VMs with Hybrid Benefit applied can achieve cost reductions exceeding 70% compared to pay-as-you-go Linux-equivalent pricing.

### Right-Sizing with Azure Advisor

[Azure Advisor](https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations){:target="_blank" rel="noopener noreferrer"} analyzes VM utilization metrics over 7 days (default) and provides right-sizing recommendations. Recommendations include suggestions to shut down idle VMs, resize over-provisioned VMs to smaller sizes, or switch from general purpose to compute- or memory-optimized families based on actual utilization patterns.

Right-sizing is the most impactful and often the most overlooked cost optimization. Organizations frequently over-provision VMs during initial deployment and never revisit the sizing. A regular cadence of reviewing Advisor recommendations (monthly or quarterly) prevents persistent over-provisioning.

### Auto-Shutdown for Dev/Test

Azure VMs support [auto-shutdown](https://learn.microsoft.com/en-us/azure/virtual-machines/auto-shutdown-vm){:target="_blank" rel="noopener noreferrer"} schedules that automatically deallocate VMs at a configured time. This is particularly valuable for development and test environments that are only used during business hours.

A VM running 10 hours per day instead of 24 reduces compute cost by roughly 58%. Combined with Spot VMs for non-critical dev/test workloads, costs drop further.

### Cost Optimization Summary

| Strategy | Typical Savings | Applies To | Commitment Required |
|----------|----------------|-----------|-------------------|
| **Right-sizing** | 20-60% | All VMs | None |
| **Auto-shutdown** | 40-60% | Dev/test VMs | None |
| **Spot VMs** | Up to 90% | Interruptible workloads | None (risk of eviction) |
| **Savings Plans** | 15-30% | All compute | 1yr or 3yr spend commitment |
| **Reserved Instances** | 30-72% | Stable workloads | 1yr or 3yr instance commitment |
| **Azure Hybrid Benefit** | 40-80% (Windows/SQL portion) | Licensed Windows/SQL workloads | Existing SA licenses |

---

## Common Pitfalls

### Pitfall 1: Over-Provisioning VM Sizes

**Problem:** Choosing a large VM size during initial deployment based on peak load estimates, then never revisiting the decision.

**Result:** VMs run at 10-20% average CPU and memory utilization, wasting 80% of provisioned capacity. Over-provisioning is the single largest source of VM cost waste.

**Solution:** Start with a reasonable estimate, deploy, and review Azure Advisor right-sizing recommendations after 7-14 days of production traffic. Schedule quarterly right-sizing reviews. Use Azure Monitor metrics to track actual utilization trends.

---

### Pitfall 2: Ignoring Availability Zones for Production

**Problem:** Deploying production VMs without Availability Zones because it requires distributing instances across zones and configuring a load balancer.

**Result:** A single data center failure takes down all instances. The 99.9% single-VM SLA is insufficient for production workloads serving users.

**Solution:** Deploy production workloads across at least 2 Availability Zones with a zone-redundant load balancer. Azure does not charge for cross-zone data transfer within a region, so the only additional cost is running instances in multiple zones.

---

### Pitfall 3: Relying on Default Outbound Internet Without NAT Gateway

**Problem:** Assuming VMs have outbound internet access by default for OS patching, package downloads, and external API calls.

**Result:** New VMs created after Microsoft completes the default outbound access deprecation lose internet connectivity. Even before deprecation, the default outbound mechanism does not provide predictable IP addresses for allowlisting.

**Solution:** Always configure explicit outbound connectivity via NAT Gateway, Azure Firewall, or a public IP.

---

### Pitfall 4: Not Accounting for VM Core Quotas

**Problem:** Configuring a Scale Set to autoscale to 100 instances without verifying that the subscription has enough VM core quota for the target size and region.

**Result:** Autoscale attempts fail with quota exceeded errors during traffic spikes, precisely when additional capacity is needed most.

**Solution:** Check and request quota increases before configuring autoscale maximums. Azure quotas are per-subscription, per-region, and per-VM-family. Request increases well in advance because quota adjustments can take time for large requests.

---

### Pitfall 5: Using Spot VMs for Stateful Workloads

**Problem:** Running databases, message brokers, or other stateful services on Spot VMs to save costs.

**Result:** Eviction causes data loss, service disruption, and complex recovery procedures. The 30-second eviction warning is insufficient for graceful shutdown of most stateful systems.

**Solution:** Reserve Spot VMs for stateless, fault-tolerant workloads. Use Reserved Instances or Savings Plans to reduce costs for stateful workloads that must run continuously.

---

### Pitfall 6: Forgetting Azure Hybrid Benefit

**Problem:** Running Windows Server or SQL Server VMs on Azure without enabling Azure Hybrid Benefit, even though the organization holds active Software Assurance licenses.

**Result:** Paying full pay-as-you-go rates including the Windows or SQL license premium, which can represent 40-80% of the total VM cost for Windows workloads.

**Solution:** Audit existing Software Assurance licenses and enable Azure Hybrid Benefit on all eligible VMs. This is a configuration toggle that can be applied to running VMs without downtime.

---

## Key Takeaways

1. **Start with D-series and right-size from there.** General Purpose D-series VMs handle most workloads. Use Azure Advisor's right-sizing recommendations after 7-14 days of production data to move to the appropriate family and size.

2. **Understand the VM naming convention.** The structured naming pattern (family + version + capabilities + size) tells you exactly what a VM offers. The `s` suffix means Premium SSD capable; the version number indicates the hardware generation.

3. **Deploy production workloads across Availability Zones.** Zones protect against data center failure with a 99.99% SLA. Azure does not charge for cross-zone data transfer, so there is no networking penalty for zone-redundant deployments.

4. **Use Flexible orchestration mode for new Scale Sets.** Flexible mode provides a superset of Uniform capabilities with the ability to mix VM sizes and manage instances individually. Microsoft recommends Flexible mode for all new VMSS deployments.

5. **Stack cost optimization strategies.** Right-sizing + Reserved Instances + Azure Hybrid Benefit compound savings. An over-provisioned Windows VM on pay-as-you-go pricing can cost 3-5x more than a right-sized VM with reservations and Hybrid Benefit applied.

6. **Spot VMs are for interruptible workloads only.** The up to 90% discount comes with a guarantee that Azure can reclaim the VM at any time. Design for eviction with checkpointing, retry logic, and idempotent processing.

7. **Ephemeral OS disks reduce cost and improve performance for stateless workloads.** Scale Set instances that are identical and replaceable benefit from ephemeral disks, which eliminate managed disk charges and provide faster reimaging.

8. **Auto-shutdown and Spot VMs together make dev/test environments dramatically cheaper.** A development environment using Spot VMs with auto-shutdown during off-hours can cost 90%+ less than an always-on pay-as-you-go deployment.

9. **Check VM core quotas before configuring autoscale maximums.** Quota exhaustion during a traffic spike is one of the most preventable and most impactful scaling failures. Verify and increase quotas proactively.

10. **A single VM with Premium SSD carries a 99.9% SLA.** No multiple instances required, and it beats AWS's 99.5% instance-level SLA for EC2. This makes Azure VMs viable for workloads that cannot be load-balanced, such as legacy single-instance applications.
